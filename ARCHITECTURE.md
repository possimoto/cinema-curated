# Cinema, Curated v1.0 — Architecture

## 제품 정의

이 프로젝트의 핵심은 영화 DB가 아니라 **개인의 감상 기록과 비평 문법을 retrieval source로 사용하는 큐레이션 엔진**입니다.

```text
549 source comments
      │
      ├─ immutable original comment
      ├─ inferred theme / mood / critique tags
      ├─ manually curated overrides
      └─ optional TMDB objective metadata
      │
      ▼
User natural-language request
      │
      ▼
/api/recommend
      │
      ├─ intent extraction / lexical signals
      ├─ curated-context scoring
      ├─ optional semantic vector retrieval
      │      ├─ Supabase pgvector
      │      └─ local embeddings.json
      │
      ▼
Grounded candidates
      │
      ├─ OpenAI off → deterministic grounded explanation
      └─ OpenAI on  → Responses API re-rank + explanation
                          ├─ candidate IDs only
                          ├─ source text only
                          └─ structured JSON output
      │
      ▼
Server validation
      ├─ unknown IDs removed
      ├─ hidden items removed
      ├─ original evidence attached
      └─ runtime metadata hydrated
      │
      ▼
Public UI
      ├─ why this film
      ├─ evidence from original comment
      └─ engine mode disclosure
```

## Source of truth

### `data/archive.json`

원문 549건. 영화 485, 시리즈 64. 코멘트 원문은 불변 데이터로 취급합니다.

### `data/curated.json`

28편 수기 정밀 큐레이션. 감독·배우·장르·관람상황·감정·관람 후 효과·추천 이유 등이 들어 있습니다.

### `data/tmdb-cache.json`

TMDB의 객관 메타데이터 캐시. 개인 비평과 분리합니다.

### `curation_overrides` (Supabase)

운영자가 수정한 추천용 데이터. 원문을 덮어쓰지 않고 런타임에서 overlay합니다.

### `data/embeddings.json` (optional)

549건 임베딩의 로컬 캐시. Supabase 없이도 semantic search를 사용할 때 활용합니다.

## Runtime data merge

우선순위:

```text
archive original
   + curated hand-authored metadata
   + tmdb-cache objective metadata
   + Supabase curation_overrides
   = runtime catalog
```

`comment`는 어떤 레이어에서도 덮어쓰지 않습니다.

## Retrieval

### Source search

- 작품명
- 원문 코멘트
- 한국어 token 및 2-gram 신호
- 주제 일치
- 감정 일치
- 원하는 관람 효과 일치
- 관람상황 일치
- 수기 큐레이션 가중치
- 긍정/부정 tone 및 강도

### Vector retrieval

`text-embedding-3-small`을 사용해 query와 코멘트의 cosine similarity를 계산합니다.

운영 우선순위:

1. Supabase `match_reviews()`
2. local `data/embeddings.json`
3. source search fallback

Supabase에서는 pgvector와 HNSW 인덱스를 사용하도록 마이그레이션이 구성되어 있습니다.

## Grounded LLM

LLM은 영화 지식 DB가 아니라 retrieval 이후의 **재정렬자·설명자** 역할입니다.

허용:
- 전달된 후보 중 선택
- 실제 코멘트의 의미를 압축
- 사용자 상태와 코멘트의 관점을 연결

금지:
- 후보 밖 작품 추천
- 외부 줄거리·수상·평론을 리뷰어 의견으로 추가
- 리뷰어가 쓰지 않은 가치판단을 생성
- 관람등급·아동 적합성 임의 추정

서버는 모델 응답 후에도 후보 ID를 다시 검증합니다.

## Child-context rule

549개 소스에는 전체 작품의 연령 적합성이 기록되어 있지 않습니다. 따라서 `아이/자녀/어린이` 요청은 현재 수기 검토된 `아이와` audience 작품만 후보로 허용합니다.

## Admin architecture

```text
/admin
  │
  ├─ ADMIN_SECRET session-only input
  │
  ▼
/api/admin/*
  │
  ├─ constant-time secret check
  ├─ Supabase service role
  │
  ├─ catalog read
  ├─ curation override upsert
  └─ selected-title TMDB enrich
```

원문은 읽기 전용이며, 운영 변경은 `curation_overrides`에만 저장됩니다.

## Security boundaries

Server-only:
- `OPENAI_API_KEY`
- `TMDB_READ_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_SECRET`

Public:
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`은 현재 서버 fetch의 주소 식별에만 사용하며 service-role key는 절대 노출하지 않습니다.

추가 보호:
- DB RLS + privilege revoke migration
- 추천/TMDB 검색 rate limit
- 관리자 API secret 인증
- `/admin` robots disallow
- 모델 출력 ID validation

## Deployment topology

```text
GitHub
  │ push
  ▼
Vercel / Next.js
  ├─ Public UI
  ├─ Server API Routes
  ├─ OpenAI API (optional)
  ├─ TMDB API (optional)
  └─ Supabase PostgreSQL + pgvector (recommended)
```
