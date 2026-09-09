# Cinema, Curated v1.0

549개의 영화·시리즈 감상 기록을 **개인 비평 관점이 추천 엔진이 되는 시네마 큐레이션 서비스**로 만든 Next.js 프로젝트입니다.

## 무엇이 들어 있나

- 영화 코멘트 485건 + 시리즈 코멘트 64건 = 원문 549건
- 원문과 자동 태그를 분리하여 원자료를 수정하지 않음
- 28편의 수기 정밀 큐레이션 데이터
- 자연어 추천 API `/api/recommend`
- 작품 전체 아카이브 검색·필터
- TMDB 메타데이터(포스터·감독·배우·장르·러닝타임) 연동 경로
- OpenAI Responses API 기반 근거 제한 추천 설명
- `text-embedding-3-small` + pgvector 기반 semantic search
- Supabase 운영 DB 및 RLS/서비스 역할 보안 마이그레이션
- 관리자 콘솔 `/admin`
- Vercel 배포 설정과 GitHub Actions 검증 워크플로

## 추천 엔진

서비스는 준비된 키와 데이터에 따라 자동으로 다음 단계 중 가장 높은 수준을 사용합니다.

### 1. SOURCE SEARCH

키가 하나도 없어도 작동합니다. 제목, 원문 코멘트, 주제·감정·관람상황 신호와 수기 큐레이션을 이용한 하이브리드 검색입니다.

### 2. GROUNDED AI

`OPENAI_API_KEY`가 있으면 검색된 실제 후보만 모델에 전달합니다. 모델은 후보 밖 작품을 추천할 수 없고, 전달된 코멘트와 태그 밖의 정보를 리뷰어의 생각처럼 추가하지 못하도록 제한합니다.

### 3. VECTOR RAG

549개 코멘트에 임베딩을 생성하면 의미 유사도 검색이 추가됩니다.

- Supabase 벡터가 준비되면 `VECTOR RAG · SUPABASE`
- 로컬 `data/embeddings.json`만 있으면 `VECTOR RAG · LOCAL`
- 준비되지 않으면 SOURCE SEARCH로 자동 폴백

## 로컬 실행

```bash
npm install
cp .env.example .env.local
npm run validate
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 환경변수

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000

OPENAI_API_KEY=
OPENAI_RECOMMEND_MODEL=gpt-5.6-terra
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

TMDB_READ_TOKEN=

NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SECRET_KEY=
# legacy fallback
SUPABASE_SERVICE_ROLE_KEY=

ADMIN_SECRET=
```

`OPENAI_API_KEY`, `SUPABASE_SECRET_KEY`(또는 legacy `SUPABASE_SERVICE_ROLE_KEY`), `TMDB_READ_TOKEN`, `ADMIN_SECRET`은 서버 전용입니다. `NEXT_PUBLIC_` 접두사를 붙이지 마세요.

## Supabase 설치

SQL Editor에서 다음 순서로 실행합니다.

1. `supabase/migrations/001_init.sql`
2. `supabase/migrations/002_embeddings_rpc.sql`
3. `supabase/migrations/003_curation_admin_security.sql`

그 다음:

```bash
npm run supabase:seed
```

`003_curation_admin_security.sql`은 운영용 큐레이션 오버라이드 테이블을 만들고, 데이터베이스 직접 접근을 서비스 역할 중심으로 제한합니다.

## 임베딩 만들기

```bash
npm run embeddings:build
npm run validate
```

생성 파일은 `data/embeddings.json`입니다. Supabase를 사용할 경우:

```bash
npm run embeddings:push
```

## TMDB 메타데이터

TMDB API Read Access Token을 `TMDB_READ_TOKEN`에 넣은 뒤:

```bash
npm run tmdb:enrich
```

자동 매칭은 제목과 연도를 사용하며 신뢰도도 저장합니다. `low` 매칭은 운영자 화면에서 검수하세요. 운영자 화면에서는 선택한 작품 하나만 다시 TMDB와 매칭해 저장할 수도 있습니다.

## 관리자 콘솔

`/admin`에서 다음을 관리합니다.

- 주제 태그
- 감정 태그
- 원하는 관람 효과
- 관람상황
- 추천 이유
- 대표 인용
- 강도
- 공개/숨김 여부
- TMDB 메타데이터 보강

중요: **원문 코멘트는 관리자 화면에서도 읽기 전용**입니다. 수정되는 것은 `curation_overrides`뿐입니다.

관리자 쓰기 기능은 `ADMIN_SECRET`과 Supabase가 모두 있을 때 활성화됩니다. 비밀은 브라우저 `sessionStorage`에만 임시 보관하고 API 요청 시 헤더로 전달됩니다.

## 추천 API

### `POST /api/recommend`

```json
{
  "query": "오늘 좀 지쳤는데 감상적인 위로보다는 삶을 다시 정돈하고 싶어"
}
```

응답:

- 추천 모드
- 검색 방식
- 추천 방향 설명
- 작품별 추천 이유
- 실제 원문 근거 문장

추천 후보는 기본적으로 549개 감상 아카이브 안에서만 선택됩니다.

### `GET /api/health`

OpenAI, Supabase, TMDB, local embedding 준비 상태를 확인합니다. 비밀 키 값은 반환하지 않습니다.

## 안전·정확성 원칙

- 원문 549건은 수정하지 않음
- 자동 추론 데이터는 항상 별도 필드
- 외부 메타데이터와 개인 비평 데이터를 분리
- LLM은 retrieval 후보 안에서만 추천
- AI 추천 이유에는 실제 원문 근거를 함께 노출
- 아이 동반 요청은 현재 수기 검토된 `아이와` 작품만 허용
- API 오류가 나면 source-grounded 검색으로 폴백
- `/api/recommend`, `/api/tmdb/search`에 메모리 기반 rate limit 적용
- 관리자 API는 `ADMIN_SECRET` 검증

## 배포

자세한 절차는 `DEPLOYMENT.md`를 참고하세요.

가장 빠른 배포는 키 없이 GitHub → Vercel로 올리는 방식이며, 이 상태에서도 SOURCE SEARCH는 동작합니다. 이후 OpenAI, TMDB, Supabase 키를 단계적으로 넣으면 같은 코드가 자동으로 기능을 확장합니다.

## 검증

```bash
npm run validate
npm run build
```

또는:

```bash
npm run check
```

GitHub Actions와 Vercel에서 `npm install`, 데이터 검증, `next build`를 자동 검증합니다.
