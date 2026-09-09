# Privacy notes

Cinema, Curated는 기본 SOURCE SEARCH 모드에서는 외부 AI API 없이도 동작합니다.

OpenAI 기능을 활성화한 경우 사용자가 추천 입력창에 작성한 문장은 서버를 통해 OpenAI API에 전달될 수 있습니다. 추천에 필요한 후보 감상 기록 일부도 grounding context로 함께 전달됩니다. 프로젝트는 Responses API 요청에 `store: false`를 설정합니다.

TMDB 기능을 활성화한 경우 작품명·연도·영화/시리즈 유형이 TMDB API 검색에 사용됩니다.

Supabase를 활성화하면 549개 아카이브, 외부 메타데이터, 큐레이션 오버라이드 및 선택적으로 임베딩이 운영 데이터베이스에 저장됩니다.

비밀 키는 다음 원칙을 따릅니다.

- `OPENAI_API_KEY`: server only
- `TMDB_READ_TOKEN`: server only
- `SUPABASE_SERVICE_ROLE_KEY`: server only
- `ADMIN_SECRET`: server validation only
- `.env.local`은 Git에 commit하지 않음

공개 서비스로 운영하기 전에는 실제 도메인, 운영 주체, 로그/분석 도구 사용 여부에 맞는 정식 개인정보처리 안내를 별도로 작성하는 것을 권장합니다.
