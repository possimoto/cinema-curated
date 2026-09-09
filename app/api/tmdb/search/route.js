import { NextResponse } from 'next/server';
import { enrichRecordFromTmdb } from '../../../../lib/tmdb';
import { rateLimit } from '../../../../lib/rateLimit';

export async function GET(request) {
  const limited = rateLimit(request, { key: 'tmdb', limit: 30, windowMs: 60_000 });
  if (!limited.ok) return NextResponse.json({ error: '메타데이터 요청이 잠시 많습니다.' }, { status: 429, headers: { 'Retry-After': String(limited.retryAfter) } });
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const type = searchParams.get('type') === '시리즈' ? '시리즈' : '영화';
    const year = Number(searchParams.get('year')) || null;
    if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 });
    return NextResponse.json({ match: await enrichRecordFromTmdb({ title: query, type, year }) });
  } catch (error) {
    const status = /TMDB_READ_TOKEN/.test(error.message) ? 503 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
