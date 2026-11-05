# 조회 선택과 탐색 경로 최종 검증, 2026-10-26

캠페인 또는 집행처로 대상을 찾고 동일 조회 범위에서 지표 상세, 비교 표와 운영 근거를 왕복하는 경로를 PC Chrome에서 직접 확인했다.

기준 HEAD: 3c11e4237c4d74e9efd96fbe5cab4a7391dc4651, main 위의 미커밋 작업이다. 기존 데이터 감사와 생성기 등의 미커밋 변경을 보존했으며 이 보고서는 해당 데이터 변경을 이번 화면 작업의 성과로 주장하지 않는다. 브라우저는 http://127.0.0.1:5173/workbench, 관찰 화면은 약 966×941px다.

## 자동 확인

| 명령 | 종료 코드 | 결과 |
| --- | --- | --- |
| node node_modules/typescript/bin/tsc --noEmit | 0 | 타입 오류 없음 |
| node node_modules/eslint/bin/eslint.js frontend/workbench/training-dashboard.tsx frontend/workbench/training-scope-picker.tsx | 0 | 오류 없음, 기존 pages 디렉터리 안내 경고 |
| node node_modules/vite/bin/vite.js build | 0 | 빌드 성공, navigation-build-final.log |
| node --test tests/training-dashboard.test.mjs | 0 | 24개 통과, navigation-tests-final.log |

일반 npx 실행은 명령이 없어 실패했으며 설치된 Node와 패키지 진입 파일로 실행해 확인했다. 자동 검사 통과는 사용자 이해도의 증거가 아니다.

## 실제 조작과 관찰

- 선택기 열기: 검색에 포커스. 없는캠페인 검색 시 검색에 맞는 캠페인이 없습니다 표시.
- META-FB 검색: Facebook 피드 캠페인 한 건. 선택 후 현황의 해당 캠페인과 ROAS 296.1% 표시.
- 집행처 모드: Google Ads, Meta Ads, 콘텐츠 제휴 그룹. Meta Ads 전체 선택 후 Facebook과 Instagram 피드 2개만 포함, 전체 기기 ROAS 197%. 개별 캠페인에서 집행처 전체로 변경했음을 안내.
- Instagram 검색은 광고와 클릭제휴를 별도 행과 집행처 보조 정보로 구분. 이전 검수에서 직접 수행.
- Meta Ads, PC, S16, 보고 기준 2026-08-31, 분석 08-17~08-30, 비교 08-03~08-16에서 현황 → CVR 상세 → 비교 표 수행. 상단 조회 조건 유지.
- 비교 표에서 15건 운영 기록 펼치기 → 08-17 Facebook 타깃과 예산 설정 → 개별 기록 펼치기. CASE-S16-6, 변경전과 변경후, 적용시각을 읽음.
- 개별 근거에서 브라우저 뒤로 가기: CVR 비교 표로 돌아오고 열린 운영 기록 목록 유지. 앞으로 가기: 같은 근거 다시 열림. X 닫기: 비교 표 복귀, 상세 단계로 중복 이동하지 않음.
- 같은 근거의 성과 현황 버튼: 한 번에 현황 복귀, Meta Ads와 PC 유지, 스크롤 669px 복원. 진입 전 관찰값과 일치.
- 현황 자체의 집계 근거에서도 성과 현황 버튼으로 창이 닫힘을 확인.
- 앞선 동일 구현 검수에서 현황 → 상세 → 비교 표의 브라우저 뒤로 가기 두 번과 앞으로 가기 두 번, 현황 스크롤 574px 복원을 확인.

브라우저 연결 중단으로 검수가 끊겼으나 재연결 후 운영 기록과 복귀 경로를 실제로 완료했다. 뒤로 가기 검증 중 근거 창도 이력의 한 단계로 기록하도록 보완했고 위 결과는 보완 후 확인이다.

## 화면 근거

- [집행처 선택](provider-picker-final.jpg)
- [고정 경로와 CVR 비교 표](comparison-navigation-final.jpg)

가로로 긴 표는 표 내부 스크롤을 사용한다. 모든 열과 전 사례 조작, 키보드 전 경로, 실제 마케터의 과업 성공과 시간, 학습 효과는 미검증이다. 모바일은 사용자 요청으로 제외했다. 실제 광고 계정 API와 계정별 캠페인 통합은 추가하지 않았다. 신규 버전, 커밋, 원격 배포는 수행하지 않았다.
