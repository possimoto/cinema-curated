import { randomUUID } from 'node:crypto';
import localArchive from '../data/archive.json';
import curated from '../data/curated.json';
import localTmdb from '../data/tmdb-cache.json';

export function supabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = rawUrl
    ? rawUrl.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '')
    : '';
  return url && key ? { url, key } : null;
}

export async function sbFetch(path, options = {}) {
  const cfg = supabaseConfig();
  if (!cfg) return null;
  const cleanPath = String(path || '').replace(/^\/+/, '');
  const res = await fetch(`${cfg.url}/rest/v1/${cleanPath}`, {
    ...options,
    cache: 'no-store',
    headers: {
      apikey: cfg.key,
      ...(cfg.key.startsWith('eyJ') ? { Authorization: `Bearer ${cfg.key}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function titleMeta(row) {
  if (!row?.tmdb_id) return null;
  return {
    status: 'matched',
    tmdbId: row.tmdb_id,
    mediaType: row.tmdb_media_type,
    originalTitle: row.original_title,
    overview: row.overview || '',
    posterPath: row.poster_path,
    backdropPath: row.backdrop_path,
    genres: row.genres || [],
    directors: row.directors || [],
    cast: row.cast_json || [],
    runtime: row.runtime,
    voteAverage: row.vote_average,
    confidence: row.metadata_confidence || 'medium',
  };
}

function toArchiveItem(title, review) {
  if (!title || !review) return null;
  return {
    id: title.id,
    title: title.title,
    year: title.year,
    type: title.media_type,
    comment: review.comment,
    source: review.source || '직접 입력',
    themes: review.themes || [],
    critiqueTags: review.critique_tags || [],
    moods: review.moods || [],
    outcomes: review.outcomes || [],
    audiences: review.audiences || [],
    intensity: review.intensity,
    toneScore: review.tone_score,
    tone: review.tone,
    tagging: review.tagging,
    createdAt: review.created_at || null,
    updatedAt: review.updated_at || review.created_at || null,
  };
}

const titleSelect = 'id,title,year,media_type,tmdb_id,tmdb_media_type,original_title,overview,poster_path,backdrop_path,genres,directors,cast_json,runtime,vote_average,metadata_confidence,updated_at';
const reviewSelect = 'id,title_id,comment,source,themes,critique_tags,moods,outcomes,audiences,intensity,tone_score,tone,tagging,created_at,updated_at';

async function loadSupabaseRows() {
  const [titles, reviews, overrideRows] = await Promise.all([
    sbFetch(`titles?select=${titleSelect}&limit=2000`),
    sbFetch(`reviews?select=${reviewSelect}&limit=2000`),
    sbFetch('curation_overrides?select=*&limit=2000'),
  ]);
  const reviewByTitle = new Map((reviews || []).map((row) => [row.title_id, row]));
  const archive = (titles || [])
    .map((title) => toArchiveItem(title, reviewByTitle.get(title.id)))
    .filter(Boolean);
  const tmdb = { ...(localTmdb || {}) };
  for (const title of titles || []) {
    const meta = titleMeta(title);
    if (meta) tmdb[title.id] = meta;
  }
  const overrides = Object.fromEntries((overrideRows || []).map((row) => [row.title_id, row]));
  return { archive, tmdb, overrides, titles: titles || [], reviews: reviews || [] };
}

export async function loadRuntimeData() {
  const cfg = supabaseConfig();
  if (!cfg) return { archive: localArchive, tmdb: { ...(localTmdb || {}) }, overrides: {}, source: 'local' };
  try {
    const rows = await loadSupabaseRows();
    return { archive: rows.archive, tmdb: rows.tmdb, overrides: rows.overrides, source: 'supabase' };
  } catch (error) {
    console.error('loadRuntimeData:', error.message);
    return { archive: localArchive, tmdb: { ...(localTmdb || {}) }, overrides: {}, source: 'local-fallback', error: error.message };
  }
}

export async function loadOverridesMap() {
  const cfg = supabaseConfig();
  if (!cfg) return {};
  try {
    const rows = await sbFetch('curation_overrides?select=*&limit=2000');
    return Object.fromEntries((rows || []).map((row) => [row.title_id, row]));
  } catch (error) {
    console.error('loadOverridesMap:', error.message);
    return {};
  }
}

export async function getContentRecord(id) {
  const safeId = encodeURIComponent(String(id || ''));
  if (!safeId) return null;
  const cfg = supabaseConfig();
  if (!cfg) return localArchive.find((item) => item.id === id) || null;
  const [titles, reviews] = await Promise.all([
    sbFetch(`titles?select=${titleSelect}&id=eq.${safeId}&limit=1`),
    sbFetch(`reviews?select=${reviewSelect}&title_id=eq.${safeId}&limit=1`),
  ]);
  const item = toArchiveItem(titles?.[0], reviews?.[0]);
  if (!item) return null;
  return { ...item, metadata: titleMeta(titles[0]) };
}

export async function getAdminCatalog() {
  const runtime = await loadRuntimeData();
  const curatedById = new Map();
  for (const c of curated) for (const id of c.archiveIds || []) curatedById.set(id, c);
  return runtime.archive.map((item) => ({
    ...item,
    curated: curatedById.get(item.id) || null,
    override: runtime.overrides[item.id] || null,
    metadata: runtime.tmdb[item.id] || null,
  }));
}

export async function createContent(input) {
  if (!supabaseConfig()) throw new Error('Supabase가 설정되지 않았습니다.');
  const id = `u-${randomUUID()}`;
  const now = new Date().toISOString();
  const titlePayload = {
    id,
    title: input.title,
    year: input.year || null,
    media_type: input.type,
    updated_at: now,
  };
  await sbFetch('titles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(titlePayload),
  });
  try {
    await sbFetch('reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        title_id: id,
        comment: input.comment,
        source: input.source || '직접 입력',
        themes: input.themes || [],
        critique_tags: input.critiqueTags || [],
        moods: input.moods || [],
        outcomes: input.outcomes || [],
        audiences: input.audiences || [],
        intensity: input.intensity ?? null,
        updated_at: now,
      }),
    });
  } catch (error) {
    await sbFetch(`titles?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => {});
    throw error;
  }
  return getContentRecord(id);
}

export async function updateContent(id, patch) {
  if (!supabaseConfig()) throw new Error('Supabase가 설정되지 않았습니다.');
  const safeId = encodeURIComponent(String(id));
  const now = new Date().toISOString();
  const titlePatch = {};
  if (patch.title !== undefined) titlePatch.title = patch.title;
  if (patch.year !== undefined) titlePatch.year = patch.year || null;
  if (patch.type !== undefined) titlePatch.media_type = patch.type;
  if (Object.keys(titlePatch).length) {
    titlePatch.updated_at = now;
    await sbFetch(`titles?id=eq.${safeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(titlePatch),
    });
  }
  const reviewPatch = {};
  if (patch.comment !== undefined) reviewPatch.comment = patch.comment;
  if (patch.source !== undefined) reviewPatch.source = patch.source || '직접 입력';
  if (patch.themes !== undefined) reviewPatch.themes = patch.themes || [];
  if (patch.critiqueTags !== undefined) reviewPatch.critique_tags = patch.critiqueTags || [];
  if (patch.moods !== undefined) reviewPatch.moods = patch.moods || [];
  if (patch.outcomes !== undefined) reviewPatch.outcomes = patch.outcomes || [];
  if (patch.audiences !== undefined) reviewPatch.audiences = patch.audiences || [];
  if (patch.intensity !== undefined) reviewPatch.intensity = patch.intensity ?? null;
  if (Object.keys(reviewPatch).length) {
    reviewPatch.updated_at = now;
    await sbFetch(`reviews?title_id=eq.${safeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(reviewPatch),
    });
  }
  return getContentRecord(id);
}

export async function deleteContent(id) {
  if (!supabaseConfig()) throw new Error('Supabase가 설정되지 않았습니다.');
  const safeId = encodeURIComponent(String(id));
  await sbFetch(`titles?id=eq.${safeId}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  return { id };
}

export async function upsertOverride(titleId, patch) {
  if (!supabaseConfig()) throw new Error('Supabase가 설정되지 않았습니다.');
  const payload = {
    title_id: titleId,
    themes: patch.themes || [],
    moods: patch.moods || [],
    outcomes: patch.outcomes || [],
    audiences: patch.audiences || [],
    why: patch.why || null,
    quote: patch.quote || null,
    intensity: Number.isFinite(Number(patch.intensity)) ? Number(patch.intensity) : null,
    hidden: Boolean(patch.hidden),
    updated_at: new Date().toISOString(),
  };
  await sbFetch('curation_overrides?on_conflict=title_id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(payload),
  });
  return payload;
}

export async function upsertTitleMetadata(titleId, meta) {
  if (!supabaseConfig()) throw new Error('Supabase가 설정되지 않았습니다.');
  const payload = {
    tmdb_id: meta.tmdbId || null,
    tmdb_media_type: meta.mediaType || null,
    original_title: meta.originalTitle || null,
    overview: meta.overview || null,
    poster_path: meta.posterPath || null,
    backdrop_path: meta.backdropPath || null,
    genres: meta.genres || [],
    directors: meta.directors || [],
    cast_json: meta.cast || [],
    runtime: meta.runtime || null,
    vote_average: meta.voteAverage || null,
    metadata_confidence: meta.confidence || null,
    updated_at: new Date().toISOString(),
  };
  await sbFetch(`titles?id=eq.${encodeURIComponent(titleId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(payload),
  });
  return payload;
}
