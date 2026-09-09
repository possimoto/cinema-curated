import archive from '../data/archive.json';
import curated from '../data/curated.json';
import localTmdb from '../data/tmdb-cache.json';

function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

async function sbFetch(path, options = {}) {
  const cfg = supabaseConfig();
  if (!cfg) return null;
  const res = await fetch(`${cfg.url}/rest/v1/${path}`, {
    ...options,
    cache: 'no-store',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function loadRuntimeData() {
  const tmdb = { ...(localTmdb || {}) };
  const overrides = {};
  const cfg = supabaseConfig();
  if (!cfg) return { tmdb, overrides, source: 'local' };

  try {
    const [titles, rows] = await Promise.all([
      sbFetch('titles?select=id,tmdb_id,tmdb_media_type,original_title,overview,poster_path,backdrop_path,genres,directors,cast_json,runtime,vote_average,metadata_confidence&limit=1000'),
      sbFetch('curation_overrides?select=*&limit=1000'),
    ]);

    for (const m of titles || []) {
      if (!m.tmdb_id) continue;
      tmdb[m.id] = {
        status: 'matched',
        tmdbId: m.tmdb_id,
        mediaType: m.tmdb_media_type,
        originalTitle: m.original_title,
        overview: m.overview || '',
        posterPath: m.poster_path,
        backdropPath: m.backdrop_path,
        genres: m.genres || [],
        directors: m.directors || [],
        cast: m.cast_json || [],
        runtime: m.runtime,
        voteAverage: m.vote_average,
        confidence: m.metadata_confidence || 'medium',
      };
    }
    for (const row of rows || []) overrides[row.title_id] = row;
    return { tmdb, overrides, source: 'supabase' };
  } catch (error) {
    console.error('loadRuntimeData:', error.message);
    return { tmdb, overrides, source: 'local-fallback', error: error.message };
  }
}

export async function loadOverridesMap() {
  const cfg = supabaseConfig();
  if (!cfg) return {};
  try {
    const rows = await sbFetch('curation_overrides?select=*&limit=1000');
    return Object.fromEntries((rows || []).map((row) => [row.title_id, row]));
  } catch (error) {
    console.error('loadOverridesMap:', error.message);
    return {};
  }
}

export async function getAdminCatalog() {
  const runtime = await loadRuntimeData();
  const curatedById = new Map();
  for (const c of curated) for (const id of c.archiveIds || []) curatedById.set(id, c);
  return archive.map((item) => ({
    ...item,
    curated: curatedById.get(item.id) || null,
    override: runtime.overrides[item.id] || null,
    metadata: runtime.tmdb[item.id] || null,
  }));
}

export async function upsertOverride(titleId, patch) {
  const cfg = supabaseConfig();
  if (!cfg) throw new Error('Supabase가 설정되지 않았습니다.');
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
  const cfg = supabaseConfig();
  if (!cfg) throw new Error('Supabase가 설정되지 않았습니다.');
  const payload = {
    id: titleId,
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
  await sbFetch('titles?on_conflict=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(payload),
  });
  return payload;
}
