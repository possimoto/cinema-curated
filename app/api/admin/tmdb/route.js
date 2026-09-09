import { NextResponse } from 'next/server';
import { assertAdmin } from '../../../../lib/admin';
import { enrichRecordFromTmdb } from '../../../../lib/tmdb';
import { getContentRecord, upsertTitleMetadata } from '../../../../lib/runtimeData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    assertAdmin(request);
    if (!process.env.TMDB_READ_TOKEN) return NextResponse.json({ error: 'TMDB_READ_TOKEN이 설정되지 않았습니다.' }, { status: 503 });
    const body = await request.json();
    const ids = [...new Set((body?.ids || []).map(String))].slice(0, 10);
    if (!ids.length) return NextResponse.json({ error: 'ids가 필요합니다.' }, { status: 400 });
    const results = [];
    for (const id of ids) {
      const record = await getContentRecord(id);
      if (!record) { results.push({ id, error: 'not found' }); continue; }
      try {
        const meta = await enrichRecordFromTmdb(record);
        if (!meta) { results.push({ id, title: record.title, error: 'TMDB match not found' }); continue; }
        await upsertTitleMetadata(id, meta);
        results.push({ id, title: record.title, tmdbId: meta.tmdbId, confidence: meta.confidence });
      } catch (error) { results.push({ id, title: record.title, error: error.message }); }
    }
    return NextResponse.json({ results });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: error.status || 500 }); }
}
