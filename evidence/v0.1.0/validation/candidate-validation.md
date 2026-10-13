# v0.1.0 후보 검증

날짜: 2026-10-13 (Asia/Seoul). 환경: Windows, Node v24.19.0, TypeScript 5.9.3, Vite 8.0.13. 대상: 현재 로컬 결과물 및 같은 파일을 원격 main(659530e) 위로 가져온 dev. 기능·Mock를 새로 변경하지 않았다.

| 실행 명령 | 결과 |
| --- | --- |
| node --experimental-strip-types tests/marketing.test.ts | 종료 0: 집계·0 분모·6개 규칙형 시나리오·컨텍스트·근거 제한 |
| node --experimental-strip-types tests/demo.test.ts | 종료 0: 6개 CTI 사례·18개 Q&A·36개 월 기록, CTI/기여도/리뷰/매체·판단 계약·연대기·실험/유지·모의 곡선 |
| node node_modules/typescript/bin/tsc --noEmit --incremental false | 종료 0: 타입 검사, 기존 캐시 갱신 없음 |
| node node_modules/vite/bin/vite.js build | 종료 0: 2576 modules, CSS 178.44kB / JS 707.41kB (gzip 204.87kB) |

JS 청크 500kB 초과와 플러그인 소요 시간 경고가 남는다. 코드 분할·새 의존성은 이번 범위에 추가하지 않는다. 실제 효과·인과·시간 절감·모바일/전 브라우저 호환성은 미검증이다.

원격 main 위로 가져온 뒤 원래 stash ZIP과 141개 파일을 줄바꿈 정규화 기준으로 비교해 보존을 확인했다. Windows CRLF 때문에 최초 diff 검사에서 경고가 발생해 Git add --renormalize로 텍스트 줄바꿈만 정규화했고 staged diff --check는 통과했다. 기존 파일의 의미를 변경하지 않았다. 문서와 Evidence의 로컬 링크 44개도 확인했다.

## 브라우저 확인

Codex in-app browser, 1280×720, http://127.0.0.1:5174, 고정 4월 대비 9월 A/B 데이터. 격리된 5173 서버 접근 실패 후 호스트의 5174 서버에서 확인했다.

- A: 원인 분석의 -10.15pt·네 기여도·지지/반대 근거, 실행안 이동, 조사 계획 승인 → 아직 등록 전 → Mock A-202610-01 등록 확인.
- E: 전환 시 대화 초기화, CTI/CPM 계산 불가·노출 미수집·예산 재배분 disabled 확인.
- C: 총액 1,200만원 유지, CTI 56.35 → 57.02pt의 가정 기반 모의 효과, 실제 전환 자료 없음, 조건부 실험 계획·성공/중단 조건 확인.
- B: 경쟁사 활동 비교 조사·예산 유지, CTI 43.19pt.
- D: 리뷰 조사·광고 유지, CTI 57.00pt.
- F: 현행 유지·2주 관찰, CTI 65.25pt. 차트·카드 표시 확인.

[A 등록](../after/a-mock-request.png), [E 결측](../after/e-missing-data.png), [C 실험](../after/c-budget-experiment.png)은 실제 세션 캡처다. 실제 팀 전달·광고 집행은 없다. 전체 접근성·시각 품질을 보증하지 않는다. 발행 후 Git 결과는 태그 트리를 수정하지 않고 PR/Release와 별도 최종 보고서에 기록한다.
