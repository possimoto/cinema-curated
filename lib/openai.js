const OPENAI_BASE = 'https://api.openai.com/v1';

function headers() {
  return {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

export async function createEmbedding(input) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
  const model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
  const res = await fetch(`${OPENAI_BASE}/embeddings`, {
    method: 'POST', headers: headers(), cache: 'no-store',
    body: JSON.stringify({ model, input }),
  });
  if (!res.ok) throw new Error(`Embedding API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { model: data.model || model, vectors: data.data.map((x) => x.embedding), usage: data.usage };
}

export async function generateGroundedRecommendation({ query, candidates }) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
  const model = process.env.OPENAI_RECOMMEND_MODEL || 'gpt-5.6-terra';
  const source = JSON.stringify(candidates, null, 2);
  const instructions = `당신은 한 사람의 실제 영화 감상 기록을 바탕으로 추천하는 개인 시네마 큐레이터다.\n\n엄격한 원칙:\n1. 아래 CANDIDATES에 있는 작품만 추천한다. id를 절대로 새로 만들지 않는다.\n2. 추천 이유는 comment, themes, curatedWhy에 실제로 있는 관점만 사용한다. 줄거리나 외부 영화 지식을 보태지 않는다.\n3. 사용자의 감정을 과도하게 심리분석하지 않는다.\n4. 비평자의 말투를 흉내 내지 말고, 그의 관점을 간결하고 자연스럽게 설명한다.\n5. 아이 동반처럼 안전·연령 적합성이 필요한 질문이라면 candidates의 audiences 정보 밖으로 추정하지 않는다.\n6. 서로 비슷한 이유의 작품만 몰아넣지 말고 질문에 맞는 범위에서 약간의 결을 달리한다.\n7. 출력은 설명이나 마크다운 없이 반드시 아래 JSON 형식만 반환한다.\n{\n  "intro": "추천 방향을 설명하는 1~2문장",\n  "recommendations": [\n    {"id":"후보의 id", "score": 0부터 99 사이 정수, "why":"실제 기록에 근거한 1~2문장 추천 이유"}\n  ]\n}\n추천은 3~5편으로 한다.`;
  const input = `USER QUERY:\n${query}\n\nCANDIDATES:\n${source}`;
  const res = await fetch(`${OPENAI_BASE}/responses`, {
    method: 'POST', headers: headers(), cache: 'no-store',
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: 'low' },
      instructions,
      input,
      max_output_tokens: 1200,
      text: {
        format: {
          type: 'json_schema',
          name: 'cinema_recommendation',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              intro: { type: 'string' },
              recommendations: {
                type: 'array',
                minItems: 3,
                maxItems: 5,
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    score: { type: 'integer', minimum: 0, maximum: 99 },
                    why: { type: 'string' }
                  },
                  required: ['id', 'score', 'why'],
                  additionalProperties: false
                }
              }
            },
            required: ['intro', 'recommendations'],
            additionalProperties: false
          }
        }
      }
    }),
  });
  if (!res.ok) throw new Error(`Responses API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.output_text || data.output?.flatMap((x) => x.content || []).find((x) => x.type === 'output_text')?.text || '';
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  let parsed;
  try { parsed = JSON.parse(cleaned); }
  catch { throw new Error('추천 모델이 JSON 형식으로 응답하지 않았습니다.'); }
  return { model: data.model || model, result: parsed, responseId: data.id || null };
}
