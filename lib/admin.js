import crypto from 'node:crypto';

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export function assertAdmin(request) {
  const expected = process.env.ADMIN_SECRET;
  if (!expected) throw Object.assign(new Error('ADMIN_SECRET가 설정되지 않았습니다.'), { status: 503 });
  const supplied = request.headers.get('x-admin-secret') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!safeEqual(supplied, expected)) throw Object.assign(new Error('운영자 인증에 실패했습니다.'), { status: 401 });
  return true;
}
