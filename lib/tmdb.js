const API = 'https://api.themoviedb.org/3';

export function tmdbPoster(path, size = 'w500') {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

export async function tmdbFetch(path, params = {}) {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) throw new Error('TMDB_READ_TOKEN is not configured.');
  const url = new URL(`${API}${path}`);
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
    next: { revalidate: 60 * 60 * 24 }
  });
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${await res.text()}`);
  return res.json();
}

export function pickBestMatch(results, title, year) {
  if (!Array.isArray(results) || !results.length) return null;
  const norm = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const target = norm(title);
  return results
    .map(item => {
      const names = [item.title, item.original_title, item.name, item.original_name].map(norm);
      const date = item.release_date || item.first_air_date || '';
      const y = Number(date.slice(0, 4)) || null;
      let score = Math.max(...names.map(n => n === target ? 100 : n.includes(target) || target.includes(n) ? 70 : 0));
      if (year && y) score += Math.max(0, 25 - Math.abs(Number(year) - y) * 10);
      if (item.popularity) score += Math.min(10, Math.log10(item.popularity + 1) * 3);
      return { item, score };
    })
    .sort((a, b) => b.score - a.score)[0]?.item || results[0];
}

function tvTitleInfo(title = '') {
  let baseTitle = String(title).trim();
  let seasonNumber = null;

  baseTitle = baseTitle.replace(/\s*:\s*감독판\s*$/u, '').trim();

  const seasonPatterns = [
    /\s*시즌\s*(\d+)\s*$/u,
    /\s*(\d+)\s*기\s*$/u,
    /\s+(\d+)\s*$/u,
  ];
  for (const pattern of seasonPatterns) {
    const match = baseTitle.match(pattern);
    if (match) {
      seasonNumber = Number(match[1]);
      baseTitle = baseTitle.replace(pattern, '').trim();
      break;
    }
  }

  baseTitle = baseTitle.replace(/\s*파트\s*\d+\s*$/u, '').trim();
  return { baseTitle: baseTitle || String(title).trim(), seasonNumber };
}

async function searchTmdb(mediaType, record, query, useYear = true) {
  const params = { query, language: 'ko-KR', include_adult: 'false' };
  if (useYear && record.year) params[mediaType === 'movie' ? 'year' : 'first_air_date_year'] = record.year;
  return tmdbFetch(`/search/${mediaType}`, params);
}

export async function enrichRecordFromTmdb(record) {
  const mediaType = record.type === '시리즈' ? 'tv' : 'movie';
  const tvInfo = mediaType === 'tv' ? tvTitleInfo(record.title) : { baseTitle: record.title, seasonNumber: null };

  const attempts = [];
  if (mediaType === 'movie') {
    attempts.push({ query: record.title, useYear: true }, { query: record.title, useYear: false });
  } else {
    attempts.push({ query: record.title, useYear: true });
    if (tvInfo.baseTitle !== record.title) attempts.push({ query: tvInfo.baseTitle, useYear: false });
    attempts.push({ query: record.title, useYear: false });
  }

  let match = null;
  for (const attempt of attempts) {
    const search = await searchTmdb(mediaType, record, attempt.query, attempt.useYear);
    if (!search.results?.length) continue;
    match = pickBestMatch(search.results, attempt.query, record.year);
    if (match) break;
  }
  if (!match) return null;

  const details = await tmdbFetch(`/${mediaType}/${match.id}`, {
    language: 'ko-KR',
    append_to_response: mediaType === 'movie' ? 'credits,release_dates' : 'credits,content_ratings'
  });

  let season = null;
  if (mediaType === 'tv' && tvInfo.seasonNumber) {
    try {
      season = await tmdbFetch(`/tv/${match.id}/season/${tvInfo.seasonNumber}`, { language: 'ko-KR' });
    } catch {
      season = null;
    }
  }

  const date = season?.air_date || details.release_date || details.first_air_date || '';
  const actualYear = Number(date.slice(0, 4)) || null;
  const yearGap = record.year && actualYear ? Math.abs(Number(record.year) - actualYear) : 0;
  const confidence = yearGap === 0 ? 'high' : yearGap <= 1 ? 'medium' : 'low';
  const posterPath = season?.poster_path || details.poster_path || null;

  return {
    status: 'matched', confidence,
    tmdbId: details.id, mediaType,
    title: details.title || details.name,
    originalTitle: details.original_title || details.original_name,
    year: actualYear,
    overview: season?.overview || details.overview || '',
    posterPath,
    posterUrl: tmdbPoster(posterPath),
    backdropPath: details.backdrop_path || null,
    genres: (details.genres || []).map(x => x.name),
    runtime: details.runtime || details.episode_run_time?.[0] || null,
    directors: (details.credits?.crew || []).filter(x => x.job === 'Director').map(x => x.name),
    cast: (details.credits?.cast || []).slice(0, 12).map(x => ({ name: x.name, character: x.character })),
    voteAverage: season?.vote_average || details.vote_average || null,
  };
}
