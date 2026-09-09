import { NextResponse } from 'next/server';
import { assertAdmin } from '../../../../lib/admin';
import { getAdminCatalog } from '../../../../lib/runtimeData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try { assertAdmin(request); return NextResponse.json({ items: await getAdminCatalog() }); }
  catch (error) { return NextResponse.json({ error: error.message }, { status: error.status || 500 }); }
}
