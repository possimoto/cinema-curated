import { NextResponse } from 'next/server';
import { assertAdmin } from '../../../../lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    assertAdmin(request);
    return NextResponse.json({
      ok: true,
      version: '1.0.0',
      supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      tmdb: Boolean(process.env.TMDB_READ_TOKEN),
      openai: Boolean(process.env.OPENAI_API_KEY),
    });
  } catch (error) { return NextResponse.json({ error: error.message }, { status: error.status || 500 }); }
}
