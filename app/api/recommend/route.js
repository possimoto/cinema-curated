import { NextResponse } from 'next/server';
import { createEmbedding, generateGroundedRecommendation } from '../../../lib/openai';
import { searchSupabase, searchLocalVectors } from '../../../lib/vectorStore';
import { buildCandidateContext, groundedFallback, mergeSemanticResults, validateAndHydrateModelResult } from '../../../lib/recommendation';
import { dynamicLocalRetrieve } from '../../../lib/dynamicRecommendation';
import { loadRuntimeData } from '../../../lib/runtimeData';
import { rateLimit } from '../../../lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const limited = rateLimit(request, { key: 'recommend', limit: 12, windowMs: 60_000 });
  if (!limited.ok) return NextResponse.json({ error: '추천 요청이 잠시 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429, headers: { 'Retry-After': String(limited.retryAfter) } });
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: '잘못된 JSON 요청입니다.' }, { status: 400 }); }
  const query = String(body?.query || '').trim();
  if (query.length < 2) return NextResponse.json({ error: '추천받고 싶은 상태를 조금 더 적어주세요.' }, { status: 400 });
  if (query.length > 600) return NextResponse.json({ error: '질문은 600자 이내로 적어주세요.' }, { status: 400 });

  let semanticRows = null;
  let retrievalMode = 'grounded-keyword';
  let apiNote = null;
  let embeddingModel = null;

  if (process.env.OPENAI_API_KEY) {
    try {
      const emb = await createEmbedding(query);
      embeddingModel = emb.model;
      try {
        semanticRows = await searchSupabase(emb.vectors[0], 28);
        if (semanticRows?.length) retrievalMode = 'rag-supabase';
      } catch (e) { apiNote = `Supabase 검색 실패: ${e.message}`; }
      if (!semanticRows?.length) {
        try {
          semanticRows = await searchLocalVectors(emb.vectors[0], 28);
          if (semanticRows?.length) retrievalMode = 'rag-local-vector';
        } catch (e) { apiNote = [apiNote, `로컬 벡터 검색 실패: ${e.message}`].filter(Boolean).join(' / '); }
      }
    } catch (e) {
      apiNote = `임베딩을 사용할 수 없어 키워드 검색으로 전환했습니다: ${e.message}`;
    }
  }

  const runtime = await loadRuntimeData();
  const semantic = mergeSemanticResults(semanticRows || []);
  const candidates = dynamicLocalRetrieve(query, runtime.archive, { limit: 18, semantic, overrides: runtime.overrides });
  if (!candidates.length) return NextResponse.json({ error: '현재 아카이브에서 충분한 근거를 찾지 못했습니다.' }, { status: 404 });

  const count = runtime.archive.length;
  if (!process.env.OPENAI_API_KEY) {
    const fallback = groundedFallback(query, candidates, { mode: retrievalMode, notice: 'OPENAI_API_KEY가 없어 실제 코멘트 검색 결과를 템플릿으로 설명했습니다.' });
    fallback.intro = fallback.intro.replace(/549개의/g, `${count}개의`).replace(/전체 549편/g, `전체 ${count}편`);
    return NextResponse.json({ ...fallback, retrieval: { mode: retrievalMode, embeddingModel: null, archiveCount: count } });
  }

  try {
    const context = buildCandidateContext(candidates, 11);
    const generated = await generateGroundedRecommendation({ query, candidates: context });
    const hydrated = validateAndHydrateModelResult(generated.result, candidates);
    if (hydrated.recommendations.length < 3) throw new Error('추천 후보를 충분히 반환하지 못했습니다.');
    return NextResponse.json({
      mode: retrievalMode === 'grounded-keyword' ? 'grounded-ai' : retrievalMode,
      model: generated.model,
      intro: hydrated.intro || `실제 ${count}개의 감상 기록에서 질문과 가까운 작품을 골랐습니다.`,
      recommendations: hydrated.recommendations,
      notice: apiNote,
      retrieval: { mode: retrievalMode, embeddingModel, candidates: context.length, archiveCount: count },
    });
  } catch (e) {
    const fallback = groundedFallback(query, candidates, { mode: retrievalMode, notice: `AI 설명 생성에 실패해 근거 검색 결과로 대체했습니다: ${e.message}` });
    fallback.intro = fallback.intro.replace(/549개의/g, `${count}개의`).replace(/전체 549편/g, `전체 ${count}편`);
    return NextResponse.json({ ...fallback, retrieval: { mode: retrievalMode, embeddingModel, archiveCount: count } });
  }
}
