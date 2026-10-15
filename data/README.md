# 데이터 영역

- `db/`: 기존 Cloudflare D1 연결 템플릿과 빈 스키마. 현재 프론트 앱에서는 사용하지 않습니다.
- `drizzle/`: 기존 마이그레이션 메타데이터. 실제 테이블·데이터베이스는 구축되지 않았습니다.

현재 시연용 고정 데이터는 `../frontend/lib/demo-scenarios.ts`와 `../frontend/lib/marketing.ts`에 그대로 있습니다. 조사·설계 및 기존 생성 자료는 `../docs/research/marketing-ontology/`에 보존합니다. 이번 정리는 파일 위치만 변경하며 데이터를 생성하거나 가공하지 않습니다.
