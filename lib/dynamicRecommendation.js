import curated from '../data/curated.json';
import { inferIntent, normalizeQuery, queryTokens } from './recommendation';

const curatedByArchiveId = new Map();
const curatedByTitle = new Map(curated.map((item) => [item.title, item]));
for (const item of curated) for (const id of item.archiveIds || []) curatedByArchiveId.set(id, item);

const STRONG_TERMS = new Set(['좀비','sf','공포','호러','액션','로맨스','멜로','음악','뮤지컬','애니','애니메이션','스포츠','전쟁','역사','ai','인공지능','로봇','가족','연인','아이']);

function effectivePair(item, overrides = {}) {
  const base = curatedByArchiveId.get(item.id) || curatedByTitle.get(item.title) || null;
  const ov = overrides?.[item.id];
  if (!ov) return { item, curated: base, hidden: false };
  const has = (key) => Array.isArray(ov[key]) && ov[key].length > 0;
  const effectiveItem = {
    ...item,
    themes: has('themes') ? ov.themes : item.themes,
    moods: has('moods') ? ov.moods : item.moods,
    outcomes: has('outcomes') ? ov.outcomes : item.outcomes,
    audiences: has('audiences') ? ov.audiences : item.audiences,
    intensity: ov.intensity ?? item.intensity,
  };
  const curatedItem = base || (ov.why || ov.quote || has('audiences') ? { title: item.title, archiveIds: [item.id] } : null);
  const effectiveCurated = curatedItem ? {
    ...curatedItem,
    why: ov.why || curatedItem.why,
    quote: ov.quote || curatedItem.quote,
    themes: has('themes') ? ov.themes : curatedItem.themes,
    moods: has('moods') ? ov.moods : curatedItem.moods,
    outcomes: has('outcomes') ? ov.outcomes : curatedItem.outcomes,
    audiences: has('audiences') ? ov.audiences : curatedItem.audiences,
    intensity: ov.intensity ?? curatedItem.intensity,
  } : null;
  return { item: effectiveItem, curated: effectiveCurated, hidden: Boolean(ov.hidden) };
}

function itemBlob(item, curatedItem) {
  return normalizeQuery([
    item.title, item.comment,
    ...(item.themes || []), ...(item.critiqueTags || []), ...(item.moods || []), ...(item.outcomes || []), ...(item.audiences || []),
    curatedItem?.why, curatedItem?.quote, curatedItem?.director,
    ...(curatedItem?.actors || []), ...(curatedItem?.genres || []), ...(curatedItem?.themes || []), ...(curatedItem?.moods || []), ...(curatedItem?.outcomes || []), ...(curatedItem?.audiences || []),
  ].filter(Boolean).join(' '));
}

function lexicalScore(item, curatedItem, query, intent, semanticSimilarity = null) {
  const q = normalizeQuery(query);
  const tokens = queryTokens(query);
  const blob = itemBlob(item, curatedItem);
  let score = 0;
  if (q && blob.includes(q)) score += 24;
  for (const token of tokens) if (blob.includes(token)) score += STRONG_TERMS.has(token) ? 6 : token.length >= 4 ? 2.2 : 0.75;
  for (const theme of intent.themes) if (item.themes?.includes(theme) || curatedItem?.themes?.includes(theme)) score += 14;
  for (const outcome of intent.outcomes) if (item.outcomes?.includes(outcome) || curatedItem?.outcomes?.includes(outcome)) score += 9;
  for (const audience of intent.audiences) if (item.audiences?.includes(audience) || curatedItem?.audiences?.includes(audience)) score += 16;
  for (const mood of intent.moods) if (item.moods?.includes(mood) || curatedItem?.moods?.includes(mood)) score += 11;
  if (semanticSimilarity != null) score += Math.max(0, semanticSimilarity) * 70;
  if (score > 0) {
    if (curatedItem) score += 6;
    if ((item.toneScore ?? 50) >= 58) score += 4;
    if ((item.toneScore ?? 50) < 38) score -= 18;
    if (intent.preferLight && (curatedItem?.intensity ?? item.intensity ?? 2) <= 2) score += 8;
    if (intent.preferLight && (curatedItem?.intensity ?? item.intensity ?? 2) >= 4) score -= 8;
    if (intent.preferIntense && (curatedItem?.intensity ?? item.intensity ?? 2) >= 3) score += 8;
  }
  return score;
}

function isEligible(item, curatedItem, intent) {
  if (intent.childContext) return Boolean(curatedItem?.audiences?.includes('아이와'));
  return true;
}

export function dynamicLocalRetrieve(query, archiveItems, { limit = 18, semantic = new Map(), overrides = {} } = {}) {
  const intent = inferIntent(query);
  const results = [];
  for (const raw of archiveItems || []) {
    const { item, curated: curatedItem, hidden } = effectivePair(raw, overrides);
    if (hidden || !isEligible(item, curatedItem, intent)) continue;
    const similarity = semantic.get(item.id) ?? null;
    const score = lexicalScore(item, curatedItem, query, intent, similarity);
    results.push({ item, curated: curatedItem, score, similarity });
  }
  results.sort((a, b) => b.score - a.score || (b.item.toneScore ?? 0) - (a.item.toneScore ?? 0));
  const useful = results.filter((x) => x.score > (intent.childContext ? 8 : 5));
  return (useful.length >= Math.min(limit, 6) ? useful : results).slice(0, limit);
}
