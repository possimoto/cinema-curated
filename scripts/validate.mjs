import fs from 'node:fs/promises';
const archive = JSON.parse(await fs.readFile(new URL('../data/archive.json', import.meta.url),'utf8'));
const curated = JSON.parse(await fs.readFile(new URL('../data/curated.json', import.meta.url),'utf8'));
const stats = JSON.parse(await fs.readFile(new URL('../data/stats.json', import.meta.url),'utf8'));
const ids = new Set(archive.map(x=>x.id));
if (archive.length !== 549) throw new Error(`archive count ${archive.length}`);
if (stats.total !== 549 || stats.movies !== 485 || stats.series !== 64) throw new Error('stats count mismatch');
if (ids.size !== archive.length) throw new Error('duplicate archive id');
if (curated.length !== 28) throw new Error(`curated count ${curated.length}`);
for (const r of archive) {
  if (!r.id || !r.title || !r.year || !r.type || typeof r.comment !== 'string') throw new Error(`invalid record ${r.id}`);
  if (!['영화','시리즈'].includes(r.type)) throw new Error(`invalid media type ${r.id}`);
}
for (const c of curated) for (const id of c.archiveIds || []) if (!ids.has(id)) throw new Error(`curated archive id missing: ${c.title} -> ${id}`);
try {
  const embeddings = JSON.parse(await fs.readFile(new URL('../data/embeddings.json', import.meta.url),'utf8'));
  if (embeddings.count !== 549) throw new Error(`embedding count ${embeddings.count}`);
  if (embeddings.dimensions !== 1536) throw new Error(`embedding dimensions ${embeddings.dimensions}`);
  for (const id of ids) if (!embeddings.vectors?.[id]) throw new Error(`embedding missing ${id}`);
  console.log('OK: optional embeddings.json = 549 x 1536');
} catch (e) {
  if (e?.code !== 'ENOENT') throw e;
  console.log('INFO: embeddings.json not generated yet (OPENAI_API_KEY needed).');
}
console.log('OK: v1.0 source data 549 archive / 28 curated / unique IDs / references');
