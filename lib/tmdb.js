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

export async function enrichRecordFromTmdb(record) {
  const mediaType = record.type === '시리즈' ? 'tv' : 'movie';
  const params = { query: record.title, language: 'ko-KR', include_adult: 'false' };
  if (record.year) params[mediaType === 'movie' ? 'year' : 'first_air_date_year'] = record.year;
  let search = await tmdbFetch(`/search/${mediaType}`, params);
  if (!search.results?.length && record.year) {
    delete params.year; delete params.first_air_date_year;
    search = await tmdbFetch(`/search/${mediaType}`, params);
  }
  const match = pickBestMatch(search.results, record.title, record.year);
  if (!match) return null;
  const details = await tmdbFetch(`/${mediaType}/${match.id}`, {
    language: 'ko-KR',
    append_to_response: mediaType === 'movie' ? 'credits,release_dates' : 'credits,content_ratings'
  });
  const actualYear = Number((details.release_date || details.first_air_date || '').slice(0, 4)) || null;
  const yearGap = record.year && actualYear ? Math.abs(Number(record.year) - actualYear) : 0;
  const confidence = yearGap === 0 ? 'high' : yearGap <= 1 ? 'medium' : 'low';
  return {
    status: 'matched', confidence,
    tmdbId: details.id, mediaType,
    title: details.title || details.name,
    originalTitle: details.original_title || details.original_name,
    year: actualYear,
    overview: details.overview || '',
    posterPath: details.poster_path || null,
    posterUrl: tmdbPoster(details.poster_path),
    backdropPath: details.backdrop_path || null,
    genres: (details.genres || []).map(x => x.name),
    runtime: details.runtime || details.episode_run_time?.[0] || null,
    directors: (details.credits?.crew || []).filter(x => x.job === 'Director').map(x => x.name),
    cast: (details.credits?.cast || []).slice(0, 12).map(x => ({ name: x.name, character: x.character })),
    voteAverage: details.vote_average || null,
  };
}
