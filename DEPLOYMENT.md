# Cinema, Curated v1.0 — Deployment

## 1. GitHub 준비

새 저장소 예시: `cinema-curated`

프로젝트 루트의 모든 파일을 저장소에 push합니다. `.env.local`은 절대 commit하지 않습니다.

## 2. Vercel Import

Vercel에서 GitHub 저장소를 Import합니다. Framework는 Next.js로 자동 감지되며 기본 build command는 `next build`입니다.

처음에는 환경변수 없이 배포해도 됩니다. 이 경우 SOURCE SEARCH 모드로 동작합니다.

## 3. 최소 운영 환경변수

```env
NEXT_PUBLIC_SITE_URL=https://YOUR-DOMAIN
ADMIN_SECRET=충분히_긴_랜덤_문자열
```

관리자 저장 기능까지 쓰려면 Supabase 설정도 필요합니다.

## 4. Supabase — 권장

SQL Editor에서 순서대로:

1. `supabase/migrations/001_init.sql`
2. `supabase/migrations/002_embeddings_rpc.sql`
3. `supabase/migrations/003_curation_admin_security.sql`

Vercel 환경변수:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

로컬에서:

```bash
npm run supabase:seed
```

## 5. OpenAI — Grounded AI / Vector RAG

Vercel 환경변수:

```env
OPENAI_API_KEY=...
OPENAI_RECOMMEND_MODEL=gpt-6-astra
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

벡터 생성:

```bash
npm run embeddings:build
npm run embeddings:push
```

`embeddings:push`는 Supabase가 준비된 경우 사용합니다.

## 6. TMDB — 포스터·감독·배우·장르

Vercel 환경변수:

```env
TMDB_READ_TOKEN=...
```

전체 보강:

```bash
npm run tmdb:enrich
```

또는 `/admin`에서 작품별 보강과 검수를 할 수 있습니다.

공개 사이트 About/credits 영역에는 TMDB 로고와 다음 고지가 포함되어 있습니다.

> This product uses the TMDB API but is not endorsed or certified by TMDB.

## 7. 배포 전 검증

```bash
npm install
npm run validate
npm run build
```

배포 후:

- `/api/health` 확인
- 자연어 추천 5~10회 점검
- `/admin` 인증 및 저장 확인
- TMDB `low` confidence 항목 검수
- 아이 동반 추천이 수기 검토 목록에만 제한되는지 확인
- 모바일/데스크톱 확인
- 원문 공개 범위 최종 확인

## 8. 추천 운영 상태

| 설정 | 동작 |
|---|---|
| 아무 키 없음 | SOURCE SEARCH |
| OpenAI | GROUNDED AI |
| OpenAI + local embeddings | VECTOR RAG · LOCAL |
| OpenAI + Supabase vectors | VECTOR RAG · SUPABASE |
| TMDB 추가 | 포스터·감독·배우·장르·러닝타임 확장 |
| Supabase + ADMIN_SECRET | 운영자 큐레이션 수정 가능 |

## 9. 도메인

Vercel 프로젝트 설정에서 원하는 도메인을 연결하고 `NEXT_PUBLIC_SITE_URL`을 실제 HTTPS 주소로 변경한 뒤 재배포합니다.
