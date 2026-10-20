# CURRENT 오프라인 계약 평가

**질문 문장 이해와 실제 LLM 품질은 미실행입니다.**

**발견사항: 질문으로 국가·기간을 바꾸는 자동 라우팅이 없습니다(capability_gap 2건). 현재 화면 범위를 직접 바꿔야 합니다.** 이 발견은 실제 모델의 의도 처리 성공/실패 판정이 아닙니다.

단계: final-bounded. pass 33 / fail 0 / not_run 0; 외부 호출 0, 새 마케팅 자료 0, 자료 보존 true.

| ID | 검사 | 상태 |
|---|---|---|
| F01 | KR price 명시 범위 계약 | pass |
| F02 | KR stock 명시 범위 계약 | pass |
| F03 | KR media 명시 범위 계약 | pass |
| F04 | KR measurement 명시 범위 계약 | pass |
| F05 | JP price 명시 범위 계약 | pass |
| F06 | JP stock 명시 범위 계약 | pass |
| F07 | JP media 명시 범위 계약 | pass |
| F08 | JP measurement 명시 범위 계약 | pass |
| F09 | US price 명시 범위 계약 | pass |
| F10 | US stock 명시 범위 계약 | pass |
| F11 | US media 명시 범위 계약 | pass |
| F12 | US measurement 명시 범위 계약 | pass |
| S01 | 제품·기간 변경 시장조회 | pass |
| S02 | 제품·기간 변경 시장조회 | pass |
| S03 | 제품·기간 변경 시장조회 | pass |
| S04 | 제품·기간 변경 시장조회 | pass |
| P01 | 명시 가격→재고 후속 | pass |
| G01 | CURRENT 더미 확보시각은 조회에서 제외 | pass |
| G02 | 경계 data_unavailable | pass |
| G03 | 경계 period_incomparable | pass |
| G04 | 경계 scope_invalid | pass |
| G05 | 경계 product_unknown | pass |
| G06 | 경계 inputs_changed | pass |
| G07 | 경계 followup_reference_required | pass |
| O01 | KR T08 전페이지 원천대조 | pass |
| O02 | KR T13 전페이지 원천대조 | pass |
| O03 | KR T22 전페이지 원천대조 | pass |
| O04 | JP T08 전페이지 원천대조 | pass |
| O05 | JP T13 전페이지 원천대조 | pass |
| O06 | JP T22 전페이지 원천대조 | pass |
| O07 | US T08 전페이지 원천대조 | pass |
| O08 | US T13 전페이지 원천대조 | pass |
| O09 | US T22 전페이지 원천대조 | pass |

범위 모순 두 건은 static_confirmed capability_gap이며 33개 계약 시험이나 의미 품질 통과율에 합산하지 않습니다.
