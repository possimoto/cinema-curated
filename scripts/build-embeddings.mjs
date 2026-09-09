import fs from 'node:fs/promises';
import process from 'node:process';
try { process.loadEnvFile?.('.env.local'); } catch {}
try { process.loadEnvFile?.('.env'); } catch {}

const key = process.env.OPENAI_API_KEY;
if (!key) {
  console.error('OPENAI_API_KEY가 필요합니다.');
  process.exit(1);
}
const model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const archive = JSON.parse(await fs.readFile(new URL('../data/archive.json', import.meta.url), 'utf8'));
const curated = JSON.parse(await fs.readFile(new URL('../data/curated.json', import.meta.url), 'utf8'));
const curatedByArchiveId = new Map();
for (const item of curated) for (const id of item.archiveIds || []) curatedByArchiveId.set(id, item);

function embeddingText(item) {
  const c = curatedByArchiveId.get(item.id);
  return [
    `작품: ${item.title} (${item.year}, ${item.type})`,
    item.themes?.length ? `주제: ${item.themes.join(', ')}` : '',
    item.critiqueTags?.length ? `비평 기준: ${item.critiqueTags.join(', ')}` : '',
    c?.why ? `큐레이션 해석: ${c.why}` : '',
    `감상 기록: ${item.comment}`,
  ].filter(Boolean).join('\n');
}

const vectors = {};
const batchSize = 64;
for (let i = 0; i < archive.length; i += batchSize) {
  const chunk = archive.slice(i, i + batchSize);
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: chunk.map(embeddingText) }),
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  const data = await res.json();
  for (const row of data.data) vectors[chunk[row.index].id] = row.embedding;
  console.log(`embeddings ${Math.min(i + batchSize, archive.length)}/${archive.length}`);
}
const first = Object.values(vectors)[0] || [];
const out = { model, dimensions: first.length, count: Object.keys(vectors).length, generatedAt: new Date().toISOString(), vectors };
await fs.writeFile(new URL('../data/embeddings.json', import.meta.url), JSON.stringify(out));
console.log(`완료: ${out.count}개 / ${out.dimensions}차원 / data/embeddings.json`);
