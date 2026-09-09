# Cinema, Curated v1.0 — Data schema

## `data/archive.json`

한 작품/시즌당 한 레코드입니다.

```json
{
  "id": "movie-2023-perfect-days",
  "title": "퍼펙트 데이즈",
  "year": 2023,
  "type": "영화",
  "comment": "원문 코멘트",
  "source": "왓챠피디아",
  "themes": ["삶의 태도"],
  "critiqueTags": [],
  "moods": [],
  "outcomes": [],
  "audiences": [],
  "connections": [],
  "intensity": 2,
  "toneScore": 80,
  "tone": "긍정",
  "tagging": "auto"
}
```

`comment`는 원문이며 수정하지 않습니다. 그 밖의 추천용 자동 필드는 교정 가능한 파생 데이터입니다.

## `data/curated.json`

수기로 정밀 큐레이션한 작품입니다.

```json
{
  "id": "curated-perfect-days",
  "archiveIds": ["movie-2023-perfect-days"],
  "title": "퍼펙트 데이즈",
  "year": 2023,
  "type": "영화",
  "director": "빔 벤더스",
  "actors": [],
  "genres": ["드라마"],
  "themes": ["삶의 태도"],
  "moods": ["지침"],
  "outcomes": ["정돈", "여유"],
  "audiences": ["혼자"],
  "why": "추천 이유",
  "quote": "대표 근거 문장",
  "intensity": 2
}
```

## `data/tmdb-cache.json`

키는 archive ID입니다.

```json
{
  "movie-2023-perfect-days": {
    "status": "matched",
    "confidence": "high",
    "tmdbId": 976893,
    "mediaType": "movie",
    "title": "퍼펙트 데이즈",
    "originalTitle": "Perfect Days",
    "year": 2023,
    "overview": "...",
    "posterPath": "/...jpg",
    "backdropPath": "/...jpg",
    "genres": ["드라마"],
    "runtime": 124,
    "directors": ["Wim Wenders"],
    "cast": [{"name":"...","character":"..."}],
    "voteAverage": 7.8
  }
}
```

## `data/embeddings.json`

선택 데이터입니다.

```json
{
  "model": "text-embedding-3-small",
  "dimensions": 1536,
  "items": [
    {"id":"movie-2023-perfect-days","embedding":[0.01, -0.02]}
  ]
}
```

실제 벡터는 1536개 값입니다.

## Supabase `curation_overrides`

원문을 덮어쓰지 않는 운영자 레이어입니다.

- `title_id`
- `themes[]`
- `moods[]`
- `outcomes[]`
- `audiences[]`
- `why`
- `quote`
- `intensity`
- `hidden`
- `updated_at`

런타임은 `archive → curated → TMDB → override` 순서로 합치되 `comment`는 항상 archive 원문을 사용합니다.
