# 보관용 구현

구 대시보드, 초기 CTI, 이전 ROAS, 데이터와 검사를 보존한다. 현재 앱은 이 폴더를 import하거나 읽지 않는다. 버전, 승인, 연구와 Evidence 정본은 저장소 루트의 docs/, evidence/에 유지한다.

이전 원천과 현재 ROAS 원천의 동일 파일은 보관 당시 바이트를 독립적으로 소유한다. 현재 ROAS를 바꿔도 보관본은 동기화하지 않는다.

실행: 저장소 루트에서 npm run dev:legacy, 브라우저 /workbench는 구 탐색, /는 초기 CTI다. 보관 UI의 빌드 산출물은 work/legacy-dist에만 생성한다. npm run test:legacy는 초기 시연 검사이며 전체 과거 검증을 대신하지 않는다. 보관 DB 생성은 npm run db:generate:legacy로 명시적으로 선택한다.
