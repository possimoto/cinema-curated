const buckets = globalThis.__cinemaRateBuckets || new Map();
globalThis.__cinemaRateBuckets = buckets;

export function rateLimit(request, { key = 'default', limit = 12, windowMs = 60_000 } = {}) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  const now = Date.now();
  const bucketKey = `${key}:${ip}`;
  const current = buckets.get(bucketKey);
  if (!current || now - current.startedAt >= windowMs) {
    buckets.set(bucketKey, { count: 1, startedAt: now });
    return { ok: true, remaining: limit - 1 };
  }
  current.count += 1;
  if (current.count > limit) return { ok: false, retryAfter: Math.max(1, Math.ceil((windowMs - (now - current.startedAt)) / 1000)) };
  return { ok: true, remaining: Math.max(0, limit - current.count) };
}
