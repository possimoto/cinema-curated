import fs from 'node:fs/promises';
import process from 'node:process';
try { process.loadEnvFile?.('.env.local'); } catch {}
try { process.loadEnvFile?.('.env'); } catch {}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 필요합니다.');
  process.exit(1);
}
let store;
try { store = JSON.parse(await fs.readFile(new URL('../data/embeddings.json', import.meta.url), 'utf8')); }
catch { console.error('data/embeddings.json이 없습니다. 먼저 npm run embeddings:build를 실행하세요.'); process.exit(1); }
if (store.dimensions !== 1536) {
  console.error(`현재 Supabase 스키마는 1536차원입니다. embeddings.json은 ${store.dimensions}차원입니다.`);
  process.exit(1);
}
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const entries = Object.entries(store.vectors || {});
for (let i = 0; i < entries.length; i += 1) {
  const [titleId, vector] = entries[i];
  const res = await fetch(`${url}/rest/v1/rpc/set_review_embedding`, {
    method: 'POST', headers,
    body: JSON.stringify({ p_title_id: titleId, p_embedding: `[${vector.join(',')}]` }),
  });
  if (!res.ok) throw new Error(`${titleId}: ${res.status} ${await res.text()}`);
  if ((i + 1) % 25 === 0 || i === entries.length - 1) console.log(`push ${i + 1}/${entries.length}`);
}
console.log('Supabase embedding 업로드 완료');
