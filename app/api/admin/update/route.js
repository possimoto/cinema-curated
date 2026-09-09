import { NextResponse } from 'next/server';
import { assertAdmin } from '../../../../lib/admin';
import { getContentRecord, upsertOverride } from '../../../../lib/runtimeData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cleanList = (v) => [...new Set((Array.isArray(v) ? v : []).map((x)=>String(x).trim()).filter(Boolean))].slice(0, 30);

export async function POST(request) {
  try {
    assertAdmin(request);
    const body = await request.json();
    const id = String(body?.id || '');
    if (!await getContentRecord(id)) return NextResponse.json({ error: '존재하지 않는 작품 ID입니다.' }, { status: 404 });
    const p = body?.patch || {};
    const patch = {
      themes: cleanList(p.themes), moods: cleanList(p.moods), outcomes: cleanList(p.outcomes), audiences: cleanList(p.audiences),
      why: String(p.why || '').slice(0, 1000), quote: String(p.quote || '').slice(0, 1000),
      intensity: Math.max(1, Math.min(5, Number(p.intensity) || 2)), hidden: Boolean(p.hidden),
    };
    return NextResponse.json({ ok: true, override: await upsertOverride(id, patch) });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: error.status || 500 }); }
}
