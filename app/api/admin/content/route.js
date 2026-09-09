import { NextResponse } from 'next/server';
import { assertAdmin } from '../../../../lib/admin';
import { createContent, deleteContent, getContentRecord, updateContent } from '../../../../lib/runtimeData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cleanText = (value, max) => String(value ?? '').trim().slice(0, max);
const cleanList = (value) => [...new Set((Array.isArray(value) ? value : []).map((x) => String(x).trim()).filter(Boolean))].slice(0, 30);

function normalizePayload(input = {}, { partial = false } = {}) {
  const out = {};
  if (!partial || input.title !== undefined) {
    out.title = cleanText(input.title, 240);
    if (!partial && !out.title) throw Object.assign(new Error('작품 제목을 입력해주세요.'), { status: 400 });
    if (partial && !out.title) throw Object.assign(new Error('작품 제목은 비워둘 수 없습니다.'), { status: 400 });
  }
  if (!partial || input.type !== undefined) {
    out.type = input.type === '시리즈' ? '시리즈' : input.type === '영화' ? '영화' : '';
    if (!out.type) throw Object.assign(new Error('유형은 영화 또는 시리즈여야 합니다.'), { status: 400 });
  }
  if (!partial || input.year !== undefined) {
    const year = Number(input.year);
    out.year = Number.isFinite(year) && year >= 1888 && year <= 2100 ? Math.trunc(year) : null;
  }
  if (!partial || input.comment !== undefined) {
    out.comment = cleanText(input.comment, 20000);
    if (!partial && !out.comment) throw Object.assign(new Error('김정웅의 코멘트를 입력해주세요.'), { status: 400 });
    if (partial && !out.comment) throw Object.assign(new Error('코멘트는 비워둘 수 없습니다.'), { status: 400 });
  }
  if (!partial || input.source !== undefined) out.source = cleanText(input.source || '직접 입력', 100) || '직접 입력';
  for (const key of ['themes','critiqueTags','moods','outcomes','audiences']) if (!partial || input[key] !== undefined) out[key] = cleanList(input[key]);
  if (!partial || input.intensity !== undefined) {
    const intensity = Number(input.intensity);
    out.intensity = Number.isFinite(intensity) ? Math.max(1, Math.min(5, Math.trunc(intensity))) : null;
  }
  return out;
}

export async function POST(request) {
  try {
    assertAdmin(request);
    const body = await request.json();
    const item = await createContent(normalizePayload(body));
    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function PATCH(request) {
  try {
    assertAdmin(request);
    const body = await request.json();
    const id = cleanText(body?.id, 200);
    if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
    if (!await getContentRecord(id)) return NextResponse.json({ error: '존재하지 않는 작품입니다.' }, { status: 404 });
    const item = await updateContent(id, normalizePayload(body?.patch || {}, { partial: true }));
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function DELETE(request) {
  try {
    assertAdmin(request);
    const body = await request.json();
    const id = cleanText(body?.id, 200);
    if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
    if (!await getContentRecord(id)) return NextResponse.json({ error: '존재하지 않는 작품입니다.' }, { status: 404 });
    await deleteContent(id);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
