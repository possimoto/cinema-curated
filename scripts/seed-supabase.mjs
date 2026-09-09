import fs from 'node:fs/promises';
import process from 'node:process';
try { process.loadEnvFile?.('.env.local'); } catch {}
try { process.loadEnvFile?.('.env'); } catch {}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY(또는 legacy SUPABASE_SERVICE_ROLE_KEY)가 필요합니다.');
  process.exit(1);
}

const archive = JSON.parse(await fs.readFile(new URL('../data/archive.json', import.meta.url), 'utf8'));
const curated = JSON.parse(await fs.readFile(new URL('../data/curated.json', import.meta.url), 'utf8'));
const meta = JSON.parse(await fs.readFile(new URL('../data/tmdb-cache.json', import.meta.url), 'utf8'));
const headers = { apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}), 'Content-Type': 'application/json' };

async function upsert(table, rows, conflict) {
  if (!rows.length) return;
  const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${encodeURIComponent(conflict)}`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
}

for (let i=0;i<archive.length;i+=100) {
  const chunk=archive.slice(i,i+100);
  await upsert('titles', chunk.map(r=>{
    const m=meta[r.id]?.status==='matched'?meta[r.id]:{};
    return { id:r.id,title:r.title,year:r.year,media_type:r.type,tmdb_id:m.tmdbId||null,tmdb_media_type:m.mediaType||null,original_title:m.originalTitle||null,overview:m.overview||null,poster_path:m.posterPath||null,backdrop_path:m.backdropPath||null,genres:m.genres||[],directors:m.directors||[],cast_json:m.cast||[],runtime:m.runtime||null,vote_average:m.voteAverage||null,metadata_confidence:m.confidence||null };
  }), 'id');
  await upsert('reviews', chunk.map(r=>({ title_id:r.id,comment:r.comment,source:r.source||'왓챠피디아',themes:r.themes||[],critique_tags:r.critiqueTags||[],moods:r.moods||[],outcomes:r.outcomes||[],audiences:r.audiences||[],intensity:r.intensity||null,tone_score:r.toneScore||null,tone:r.tone||null,tagging:r.tagging||null })), 'title_id');
  console.log(`seed ${Math.min(i+100,archive.length)}/${archive.length}`);
}

const titleToId = new Map(archive.map((r)=>[r.title,r.id]));
const connections = archive.flatMap((r)=>(r.connections||[]).map((mentioned)=>({ from_title_id:r.id, mentioned_title:mentioned, to_title_id:titleToId.get(mentioned)||null, relation_type:'코멘트 내 명시적 연결' })));
for (let i=0;i<connections.length;i+=100) await upsert('connections', connections.slice(i,i+100), 'from_title_id,mentioned_title');

const overrides=[];
for (const c of curated) for (const id of c.archiveIds||[]) overrides.push({
  title_id:id,
  themes:c.themes||[], moods:c.moods||[], outcomes:c.outcomes||[], audiences:c.audiences||[],
  why:c.why||null, quote:c.quote||null, intensity:c.intensity||null, hidden:false,
});
await upsert('curation_overrides', overrides, 'title_id');

console.log(`Supabase seed 완료: titles/reviews ${archive.length}, connections ${connections.length}, curated overrides ${overrides.length}`);
