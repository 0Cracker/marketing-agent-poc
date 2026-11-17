# v5.0.21 검증 결과

- 날짜: 2026-11-17
- 대상: `claude/gracious-cannon-ebmc8y`, v5.0.20 `f89f036` + v5.0.21 작업 트리
- 환경: Linux, Node 22, Playwright Chromium, `npm run dev:agent:mock`
- 입력: 기존 18개 사례의 캠페인 `targetRoas` 값(전부 3.5). 새 데이터와 스키마 변경 없음.

| 명령 | 결과 |
| --- | --- |
| `npm test` | 99개 통과(`target-roas.test.ts` 3개 추가) |
| `npm run test:agents` | 134개 통과 |
| `npx tsc --noEmit -p .` | v5.0.21 커밋(`0ae95cb`) 시점에는 `target-roas.test.ts`의 암시적 any 3건으로 실패했다. 커밋 기록에 통과로 잘못 적었으며, 후속 커밋에서 타입을 지정해 통과 |
| `npm run build` | 통과 |
| `npm run lint` | 오류 0, 기존 경고 2 |
| `node evidence/v5.0.21/validation/browser-check.cjs` | [5개 통과](ui-results.json) |
| `node evidence/v5.0.20/validation/browser-check.cjs` | 24개 통과(회귀 확인, 해당 Evidence 파일은 덮어쓰지 않고 되돌림) |

- S16: 284.7%, "목표 ROAS 350.0% 대비 -65.3%p, 목표 미달". 독립 계산 284.7-350.0=-65.3.
- S04: 560.0%, "+210.0%p, 목표 달성".
- ROAS 추이에만 목표선이 있고 CVR 상세에는 없다.
- 시행착오: Recharts 3은 기준선 라벨을 선 그룹 밖에 그려 `hasText` 선택이 실패했다. 선 색 속성으로 선택하도록 검사를 고쳤다. 앱 결함이 아니다.
- [ROAS 카드와 목표선 화면](../after/roas-target.png)
- 한계: 목표값은 모든 사례와 캠페인에서 같은 가상값이라, 캠페인별로 목표가 다른 경우는 단위 테스트(평균하지 않고 숨김)로만 확인했다.
