import archive from '../data/archive.json';
import curated from '../data/curated.json';

const curatedByArchiveId = new Map();
const curatedByTitle = new Map(curated.map((item) => [item.title, item]));
for (const item of curated) for (const id of item.archiveIds || []) curatedByArchiveId.set(id, item);
const archiveById = new Map(archive.map((item) => [item.id, item]));

const THEME_RULES = [
  { keys: ['지쳐', '지쳤', '피곤', '무기력', '힘들', '번아웃', '회복', '쉬고'], themes: ['삶의 태도'], outcomes: ['회복', '위로', '정돈'], moods: ['지침', '무기력'] },
  { keys: ['답답', '열받', '분노', '화나', '스트레스', '카타르시스'], themes: ['장르적 성취'], outcomes: ['카타르시스', '몰입'], moods: ['답답함', '분노'] },
  { keys: ['외롭', '쓸쓸', '고독', '혼자'], themes: ['관계와 사랑'], outcomes: ['위로', '여운'], moods: ['외로움'] },
  { keys: ['연인', '데이트', '애인', '커플'], audiences: ['연인'], themes: ['관계와 사랑'], outcomes: ['여운', '생각'] },
  { keys: ['아이', '자녀', '어린이'], audiences: ['아이와'], outcomes: ['즐거움', '감동'] },
  { keys: ['가족', '부모', '엄마', '아빠'], audiences: ['가족'], themes: ['관계와 사랑'], outcomes: ['감동', '여운'] },
  { keys: ['생각', '정리', '철학', '고민', '복잡', '삶', '인생'], themes: ['삶의 태도'], outcomes: ['생각', '정돈', '여운'] },
  { keys: ['액션', '전율', '강렬', '몰입', '흥미진진'], themes: ['장르적 성취'], outcomes: ['몰입', '카타르시스'] },
  { keys: ['ai', '인공지능', '기술', '로봇', '안드로이드'], themes: ['기술과 인간'], outcomes: ['생각'] },
  { keys: ['욕망', '집착', '자기파괴'], themes: ['욕망과 자기파괴'], outcomes: ['생각'] },
  { keys: ['전쟁', '역사', '폭력', '권력'], themes: ['폭력과 역사'], outcomes: ['생각', '몰입'] },
  { keys: ['성장', '용기', '도전', '앞으로', '나아가'], themes: ['성장과 용기'], outcomes: ['활력', '감동'] },
  { keys: ['예술', '미장센', '창작', '영화사', '영화에 대한'], themes: ['예술과 창작'], outcomes: ['생각', '여운'] },
  { keys: ['자본주의', '사회', '계급', '시스템'], themes: ['사회와 자본주의'], outcomes: ['생각'] },
];

const STOP = new Set(['영화', '작품', '보고', '싶어', '싶다', '같은', '오늘', '그냥', '조금', '정말', '너무', '있는', '없는', '하고', '해서', '같이', '것을', '거를', '뭔가', '지금']);
const STRONG_TERMS = new Set(['좀비','sf','공포','호러','액션','로맨스','멜로','음악','뮤지컬','애니','애니메이션','스포츠','전쟁','역사','ai','인공지능','로봇','가족','연인','아이']);
const NOISY_GRAMS = new Set(['하고','하게','하는','에서','으로','이고','이라','처럼','조금','정말','너무','보고','같이']);

export function normalizeQuery(query = '') {
  return String(query).toLowerCase().replace(/[\u2018\u2019\u201c\u201d"'<>()[\]{}.,!?~:;\/\\|·…_-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function ngrams(word) {
  const out = [];
  if (word.length >= 2) for (let i = 0; i < word.length - 1; i += 1) out.push(word.slice(i, i + 2));
  return out;
}

export function queryTokens(query = '') {
  const words = normalizeQuery(query).split(' ').filter((w) => w.length > 1 && !STOP.has(w));
  const grams = words.flatMap((w) => /[가-힣]/.test(w) && w.length >= 3 ? ngrams(w).filter((g)=>!NOISY_GRAMS.has(g)) : []);
  return [...new Set([...words, ...grams])];
}

export function inferIntent(query = '') {
  const q = normalizeQuery(query);
  const intent = { themes: [], outcomes: [], audiences: [], moods: [], preferLight: false, preferIntense: false, childContext: false };
  for (const rule of THEME_RULES) {
    if (rule.keys.some((key) => q.includes(key))) {
      if (rule.themes) intent.themes.push(...rule.themes);
      if (rule.outcomes) intent.outcomes.push(...rule.outcomes);
      if (rule.audiences) intent.audiences.push(...rule.audiences);
      if (rule.moods) intent.moods.push(...rule.moods);
    }
  }
  intent.preferLight = ['가볍', '편하게', '아무 생각', '부담 없', '편안', '조용', '잔잔'].some((x) => q.includes(x));
  intent.preferIntense = ['강렬', '세게', '전율', '몰입', '카타르시스'].some((x) => q.includes(x));
  intent.childContext = ['아이', '자녀', '어린이'].some((x) => q.includes(x));
  for (const key of ['themes', 'outcomes', 'audiences', 'moods']) intent[key] = [...new Set(intent[key])];
  return intent;
}

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
    item.title, item.comment, ...(item.themes || []), ...(item.critiqueTags || []), ...(item.moods || []), ...(item.outcomes || []), ...(item.audiences || []),
    curatedItem?.why, curatedItem?.quote, curatedItem?.director, ...(curatedItem?.actors || []), ...(curatedItem?.genres || []), ...(curatedItem?.themes || []), ...(curatedItem?.moods || []), ...(curatedItem?.outcomes || []), ...(curatedItem?.audiences || []),
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
  const hasRelevance = score > 0;
  if (hasRelevance) {
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

export function localRetrieve(query, { limit = 18, semantic = new Map(), overrides = {} } = {}) {
  const intent = inferIntent(query);
  const results = [];
  for (const raw of archive) {
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

export function mergeSemanticResults(rows = []) {
  const map = new Map();
  for (const row of rows) if (row?.title_id && Number.isFinite(Number(row.similarity))) map.set(row.title_id, Number(row.similarity));
  return map;
}

export function buildCandidateContext(candidates, max = 10) {
  return candidates.slice(0, max).map(({ item, curated: curatedItem, score, similarity }) => ({
    id: item.id, title: item.title, year: item.year, type: item.type, comment: item.comment,
    themes: [...new Set([...(item.themes || []), ...(curatedItem?.themes || [])])],
    outcomes: curatedItem?.outcomes || item.outcomes || [], audiences: curatedItem?.audiences || item.audiences || [],
    curatedWhy: curatedItem?.why || null, toneScore: item.toneScore,
    retrievalScore: Math.round(score * 10) / 10, similarity: similarity == null ? null : Math.round(similarity * 1000) / 1000,
  }));
}

export function groundedFallback(query, candidates, { mode = 'grounded-keyword', notice = null } = {}) {
  const intent = inferIntent(query);
  const selected = candidates.slice(0, intent.childContext ? 4 : 5);
  return {
    mode, model: null,
    intro: intent.childContext
      ? '아이와 함께 보는 조건은 원문만으로 전체 549편의 연령 적합성을 판단하지 않고, 수기 검토된 ‘아이와’ 큐레이션 안에서만 골랐습니다.'
      : '549개의 실제 감상 기록에서 질문과 가까운 주제와 표현을 찾아 추천했습니다.',
    recommendations: selected.map(({ item, curated: c, score, similarity }) => ({
      id: item.id, title: item.title, year: item.year, type: item.type,
      score: Math.max(45, Math.min(98, Math.round(48 + score / 2))),
      why: c?.why || `이 기록에서 ${shortEvidence(item.comment, 92)}라는 시선이 질문의 상태와 가장 가깝게 연결됩니다.`,
      evidence: shortEvidence(c?.quote || item.comment, 150),
      themes: [...new Set([...(item.themes || []), ...(c?.themes || [])])].slice(0, 4),
      semanticSimilarity: similarity, curated: Boolean(c),
    })),
    notice,
  };
}

export function shortEvidence(text = '', n = 150) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length <= n ? clean : `${clean.slice(0, n).trim()}…`;
}

export function validateAndHydrateModelResult(result, candidates) {
  const byId = new Map(candidates.map((x) => [x.item.id, x]));
  const recs = [];
  for (const rec of result?.recommendations || []) {
    const candidate = byId.get(rec?.id);
    if (!candidate || recs.some((x) => x.id === rec.id)) continue;
    const { item, curated: c, score, similarity } = candidate;
    recs.push({
      id: item.id, title: item.title, year: item.year, type: item.type,
      score: Math.max(45, Math.min(99, Number.isFinite(Number(rec.score)) ? Math.round(Number(rec.score)) : Math.round(55 + score / 2))),
      why: String(rec.why || c?.why || shortEvidence(item.comment, 100)).slice(0, 320),
      evidence: shortEvidence(c?.quote || item.comment, 170),
      themes: [...new Set([...(item.themes || []), ...(c?.themes || [])])].slice(0, 4),
      semanticSimilarity: similarity, curated: Boolean(c),
    });
  }
  return { intro: String(result?.intro || '').slice(0, 420), recommendations: recs.slice(0, 5) };
}

export function getArchiveRecord(id) { return archiveById.get(id) || null; }
