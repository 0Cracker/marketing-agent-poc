# 현재 ROAS 데이터

현재 화면과 API는 roas/만 읽는다. 기존 41유형 원천, 구 manifest와 이전 ROAS 자료는 ../legacy/data/에 보존한다.

roas/manifest.json은 roas-data/1 계약이며 파일 경로, 바이트 크기, SHA-256과 전체 자료 해시를 관리한다. 네 payload 파일은 이동 전 바이트를 유지했다. source-ads.jsonl은 기존 R001 광고 원천 28행의 복사본이며 생성기의 요일 패턴 재현에만 사용한다. 새 관측값은 생성하지 않았다.

배포는 /workbench-data/roas/ 아래의 사례별 성과와 리뷰 파생 응답만 제공한다. manifest, 원본 payload, 재현 원천은 직접 공개하지 않는다.

`node scripts/roas/generate-training-dashboard.mjs`는 쓰기 없이 재생성 결과를 검산한다. --write는 차단한다. 데이터 내용 변경과 재생성 설치는 별도 승인 대상이다.

2026-11-05 사용자 승인 증량: S16 샴푸 리뷰는 비교 27건, 분석 33건, 총 60건이며 S17은 25건, 전체는 85건이다. 외부 판매처 표시명은 쿠팡, 내부 식별자는 virtual_external_1이다. 모든 리뷰는 합성 시나리오이며 실제 쿠팡에서 수집한 고객 후기를 뜻하지 않는다. 원문, 분류 파일과 manifest의 해당 해시를 갱신했다. ROAS 원시 수치와 상품 메타데이터는 보존한다. [승인](../docs/research/marketing-ontology/data-proposal.md), [검증](../evidence/review-expansion-20261105/validation.md)을 따른다.
