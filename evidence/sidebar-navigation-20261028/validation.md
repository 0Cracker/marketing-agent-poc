# 왼쪽 지표 탐색 검증, 2026-10-28

- 대상: v0.4.8 be1ef40 이후 v0.4.9 작업 diff, Windows 로컬.
- node --test tests/training-dashboard.test.mjs: 24개 통과, 종료 0. 원천 보존과 집계 일치 포함.
- TypeScript --noEmit --incremental false, 대상 ESLint, Vite build: 종료 0. 기존 폰트 런타임 해석, Next pages 경로 경고는 유지.
- 인앱 브라우저: 성과 메뉴의 그룹과 다섯 지표, CTR 직접 진입, CPC 이동, 뒤로 가기 CTR 복원, 경로의 성과 현황 복귀 확인.
- [CTR 화면](ctr-sidebar.jpg): 왼쪽 들여쓰기와 현재 지표 강조, 가로 탐색 바 제거 확인.
- 모바일 실기기와 전체 과업 사용성은 미검증. 데이터, 스키마 변경 없음.
