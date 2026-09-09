import fs from 'node:fs/promises';
import path from 'node:path';

let localCache = null;

function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return -1;
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i];
  }
  if (!aa || !bb) return -1;
  return dot / (Math.sqrt(aa) * Math.sqrt(bb));
}

export async function searchSupabase(queryEmbedding, matchCount = 24) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const res = await fetch(`${url}/rest/v1/rpc/match_reviews`, {
    method: 'POST', cache: 'no-store',
    headers: { apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}), 'Content-Type': 'application/json' },
    body: JSON.stringify({ query_embedding: `[${queryEmbedding.join(',')}]`, match_count: matchCount, filter_media_type: null }),
  });
  if (!res.ok) throw new Error(`Supabase vector RPC ${res.status}: ${await res.text()}`);
  return await res.json();
}

async function loadLocalVectors() {
  if (localCache) return localCache;
  try {
    const p = path.join(process.cwd(), 'data', 'embeddings.json');
    localCache = JSON.parse(await fs.readFile(p, 'utf8'));
    return localCache;
  } catch { return null; }
}

export async function searchLocalVectors(queryEmbedding, matchCount = 24) {
  const store = await loadLocalVectors();
  if (!store?.vectors) return null;
  const rows = [];
  for (const [titleId, vector] of Object.entries(store.vectors)) {
    const similarity = cosine(queryEmbedding, vector);
    rows.push({ title_id: titleId, similarity });
  }
  rows.sort((a, b) => b.similarity - a.similarity);
  return rows.slice(0, matchCount);
}

export async function localVectorStatus() {
  const store = await loadLocalVectors();
  return store ? { available: true, model: store.model, dimensions: store.dimensions, count: Object.keys(store.vectors || {}).length } : { available: false };
}
