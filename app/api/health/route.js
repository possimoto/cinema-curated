import { NextResponse } from 'next/server';
import { localVectorStatus } from '../../../lib/vectorStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const localVector = await localVectorStatus();
  return NextResponse.json({
    version: '1.0.0',
    openai: Boolean(process.env.OPENAI_API_KEY),
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    tmdb: Boolean(process.env.TMDB_READ_TOKEN),
    localVector,
    recommendationModel: process.env.OPENAI_RECOMMEND_MODEL || 'gpt-6-astra',
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  });
}
