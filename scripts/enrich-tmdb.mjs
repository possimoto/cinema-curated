import fs from 'node:fs/promises';
import process from 'node:process';

try { process.loadEnvFile?.('.env.local'); } catch {}
try { process.loadEnvFile?.('.env'); } catch {}

const token = process.env.TMDB_READ_TOKEN;
if (!token) {
  console.error('TMDB_READ_TOKEN이 없습니다. .env.local에 토큰을 넣은 뒤 다시 실행하세요.');
  process.exit(1);
}

const archive = JSON.parse(await fs.readFile(new URL('../data/archive.json', import.meta.url), 'utf8'));
const cachePath = new URL('../data/tmdb-cache.json', import.meta.url);
let cache = {};
try { cache = JSON.parse(await fs.readFile(cachePath, 'utf8')); } catch {}

const API = 'https://api.themoviedb.org/3';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

async function api(path, params = {}) {
  const url = new URL(`${API}${path}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

function scored(results, title, year) {
  const target = norm(title);
  return (results || []).map(item => {
    const names = [item.title, item.original_title, item.name, item.original_name].map(norm);
    const y = Number((item.release_date || item.first_air_date || '').slice(0,4)) || null;
    const exact = names.some(n => n === target);
    const partial = names.some(n => n && (n.includes(target) || target.includes(n)));
    let score = exact ? 100 : partial ? 72 : 25;
    if (year && y) score += Math.max(-20, 28 - Math.abs(Number(year) - y) * 12);
    score += Math.min(8, Math.log10((item.popularity || 0) + 1) * 2.5);
    return { item, score, matchedYear: y };
  }).sort((a,b) => b.score - a.score)[0] || null;
}

async function enrich(record) {
  const media = record.type === '시리즈' ? 'tv' : 'movie';
  const yearKey = media === 'movie' ? 'year' : 'first_air_date_year';
  let search = await api(`/search/${media}`, { query: record.title, language: 'ko-KR', include_adult: 'false', [yearKey]: record.year });
  if (!search.results?.length) search = await api(`/search/${media}`, { query: record.title, language: 'ko-KR', include_adult: 'false' });
  const best = scored(search.results, record.title, record.year);
  if (!best) return { status: 'not_found', queryTitle: record.title, queryYear: record.year };
  const details = await api(`/${media}/${best.item.id}`, { language: 'ko-KR', append_to_response: media === 'movie' ? 'credits,release_dates' : 'credits,content_ratings' });
  const confidence = best.score >= 118 ? 'high' : best.score >= 92 ? 'medium' : 'low';
  return {
    status: 'matched', confidence, matchScore: Math.round(best.score),
    tmdbId: details.id, mediaType: media,
    title: details.title || details.name,
    originalTitle: details.original_title || details.original_name,
    year: Number((details.release_date || details.first_air_date || '').slice(0,4)) || null,
    overview: details.overview || '', posterPath: details.poster_path || null,
    backdropPath: details.backdrop_path || null,
    genres: (details.genres || []).map(x => x.name),
    runtime: details.runtime || details.episode_run_time?.[0] || null,
    directors: (details.credits?.crew || []).filter(x => x.job === 'Director').map(x => x.name),
    cast: (details.credits?.cast || []).slice(0, 12).map(x => ({ name: x.name, character: x.character })),
    voteAverage: details.vote_average || null,
    fetchedAt: new Date().toISOString()
  };
}

let done = 0;
for (const record of archive) {
  if (cache[record.id]?.status === 'matched') continue;
  try {
    cache[record.id] = await enrich(record);
    done++;
    console.log(`[${done}] ${record.id} ${record.title} → ${cache[record.id].status}${cache[record.id].confidence ? `/${cache[record.id].confidence}` : ''}`);
  } catch (e) {
    cache[record.id] = { status: 'error', error: e.message, fetchedAt: new Date().toISOString() };
    console.error(`${record.title}: ${e.message}`);
  }
  if (done % 10 === 0) await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
  await sleep(140);
}
await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
const vals = Object.values(cache);
console.log(`완료: ${vals.filter(x=>x.status==='matched').length} matched / ${vals.filter(x=>x.status==='not_found').length} not found / ${vals.filter(x=>x.status==='error').length} error`);
