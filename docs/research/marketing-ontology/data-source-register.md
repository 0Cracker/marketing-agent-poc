# 마케팅 데이터 소스 조사 목록

확인일: 2026-10-13 (Asia/Seoul). 44개 소스 항목. 실제 계정 인증·API 요청·데이터 다운로드는 하지 않았다. 공개 문서·공식 코드·데이터 소개를 읽어 구조와 접근 경로를 확인했다. 공급자 문서의 기능 설명은 우리 회사의 접근 권한·데이터 보유·완전성을 증명하지 않는다.

[종류별 상세 필드](data-landscape.md), [그래프 연결 제안](graph-data-design.md), [전체 조사 목록](research-status.md)과 연결한다. M은 이번 소스 식별자, S는 기존 근거 식별자다.

## 확인 수준

- 본문 확인: 관련 공식 원문을 읽었다. 전체 스키마·국가별 지원·계약은 도입 때 추가 확인한다.
- 코드 확인: 공식 SDK의 필드 존재를 확인했다. 지표 의미·실제 조회 권한·조합 지원은 별도다.
- 부분 확인: 공식 검색 색인 또는 포털 소개만 확인. 원문 접근 실패·내용 미추출을 명시한다.
- 아래 갱신일 미확인은 추정값으로 채우지 않는다. 링크의 latest/main은 변할 수 있으므로 실제 커넥터 개발 시 버전·커밋을 고정한다.

## 광고·검색·행동

| ID | 기관·제목·링크 | 확인 수준·날짜 | 확보 경로·대상 | 단위·확인한 내용·제약 |
| --- | --- | --- | --- | --- |
| M01 | [Google Ads Reporting overview](https://developers.google.com/google-ads/api/docs/reporting/overview) | 본문, 갱신 2026-10-01 UTC | 계정 인증·권한·개발자 토큰, GAQL/API 또는 계정 리포트 | 계정→캠페인→키워드 리소스와 속성·세그먼트·지표를 조회. 경쟁사 비공개 전환·매출을 얻는 경로가 아님 |
| M02 | [Google Ads Generate historical metrics](https://developers.google.com/google-ads/api/docs/keyword-planning/generate-historical-metrics) | 본문·필드, 갱신일 미확인 | Ads 계정의 Keyword Planner/API | 키워드·지역·언어별 평균/월별 검색량 근사, 경쟁 정도, 입찰가 범위. 실제 클릭·제품 구매 기록과 구별 |
| M03 | [Google Ads Auction insights](https://support.google.com/google-ads/answer/2579754?hl=en) | 본문, 갱신일 미표시 | 광고 계정 보고서·내보내기 | 공유 경매에서의 비중·중복·순위 비교. 캠페인 유형별 지표 다름. UI 자료 확인이며 동일 API 제공을 보장하지 않음 |
| M04 | [Meta 공식 Business SDK AdsInsights](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adsinsights.py) | 공식 코드 확인, main 커밋 미고정 | 권한 있는 자사 Ads 계정 | spend, impressions, reach, frequency, actions, action_values 등 필드 존재. 의미·귀속·breakdown 조합은 문서/계정 추가 확인. Insights 문서 직접 접근은 429 실패 |
| M05 | [TikTok API for Business Reporting](https://business-api.tiktok.com/portal/docs/api-reference/v2.0) | 부분: 공식 색인 확인, 본문 0줄 | 자사 광고주 인증·승인된 보고 기능 | 보고 차원·지표·비동기 작업 존재. 상세 필드/소액 지표 억제는 실제 명세에서 재확인. 확정 구현 근거로 사용하지 않음 |
| M06 | [LINE Ads reporting partner specification](https://ads.line.me/public-docs/pages/v3/3.12.3/reporting-general-partner/) | 본문·필드, 문서 버전 3.12.3 | 광고 계정/Reporting Partner 권한 | 계정·캠페인·그룹·광고 단위 보고. Impressions, Clicks, CPM, CTR, CPC 등. 일반 공개 무인증 API가 아님 |
| M07 | [GA4 BigQuery Export schema](https://support.google.com/analytics/answer/7029846?hl=en) | 본문·필드, 갱신일 미표시 | 자사 GA4-BigQuery 연결·권한 | 이벤트·파라미터·상품·기기·지역·유입·동의 상태. user_pseudo_id는 모든 플랫폼을 잇는 전역 고객 ID가 아님 |
| M08 | [GA4 Measure ecommerce](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce) | 본문·필드, 갱신일 미확인 | 자사 웹/앱 계측·서버 이벤트 | 상품 조회·장바구니·결제·구매·환불, transaction_id와 items. 구현하지 않은 이벤트는 자동 확보되지 않음 |
| M09 | [Search Console Search Analytics query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query) | 본문·필드, 갱신일 미확인 | 권한 있는 사이트 속성·API/내보내기 | 검색어·페이지·국가·기기·기간별 clicks, impressions, ctr, position. 자사 사이트 검색 결과이며 시장 전체 검색량이 아님 |
| M10 | [Google Trends data FAQ](https://support.google.com/trends/answer/4365533?hl=en) | 본문, 갱신일 미표시 | 공개 웹 조회·내보내기, API 권한은 이번 조사 미확정 | 시간·지역·검색어/주제별 표본 기반 상대 관심도. 0–100 정규화 값은 검색 횟수가 아님. 서로 다른 요청의 분모·정규화 기준 보존 |

## 상품·판매·경쟁·고객 경험

| ID | 기관·제목·링크 | 확인 수준·날짜 | 확보 경로·대상 | 단위·내용·제약 |
| --- | --- | --- | --- | --- |
| M11 | [Shopify Product](https://shopify.dev/docs/api/admin-graphql/latest/objects/Product) | 본문·필드, latest 2026-10 | 자사 상점 read_products | 제품·분류·설명·옵션·변형·게시 상태. 성분·효능·내부 분류는 별도 PIM/메타필드/문서가 필요할 수 있음 |
| M12 | [Shopify Order](https://shopify.dev/docs/api/admin-graphql/latest/objects/Order) | 본문·필드, latest 2026-10 | 자사 상점 read_orders 등 | 주문·상품 행·통화·할인·환불·배송 상태. 기본 조회 기간 제한이 있어 장기 데이터 권한 별도 확인 |
| M13 | [Shopify InventoryLevel](https://shopify.dev/docs/api/admin-graphql/latest/objects/InventoryLevel) | 본문·필드, latest 2026-10 | 상점 재고 권한 | 위치별 재고 품목·quantities·갱신 시간. 현재 상태 API가 과거 품절 시계열을 자동 제공한다고 가정하지 않음 |
| M14 | [Shopify InventoryItem](https://shopify.dev/docs/api/admin-graphql/latest/objects/InventoryItem) | 본문·필드, latest 2026-10 | 권한 있는 상점 품목 정보 | sku, tracked, unitCost 등. 매출총이익에 필요한 반품·수수료·배송 비용까지 한 번에 제공하는 자료는 아님 |
| M15 | [Rakuten Ichiba Item Search](https://webservice.rakuten.co.jp/documentation/ichiba-item-search) | 본문·필드, API 2026-07-01 | 앱 등록·현재 인증 요건을 충족한 상품 조회 | 상품 코드·이름·가격·상점·URL·리뷰 수/평균·장르. 개별 리뷰 원문과 경쟁사 주문 전체를 제공하는 API가 아님 |
| M16 | [Merchant API Understand the market](https://developers.google.com/merchant/api/guides/reports/understand-the-market) | 본문·예제, 갱신일 미확인 | 적격 Merchant Center 계정의 Reports | 국가·카테고리·상품별 인기·가격 비교·제안. benchmark/예측은 공급자 지표이며 전체 시장 실측과 구별 |
| M17 | [Trustpilot Business Units API](https://developers.trustpilot.com/business-units-api/) | 본문, 갱신일 미표시 | 엔드포인트별 API key/OAuth·이용 조건 | 사업체 서비스 리뷰·별점·문장·날짜·언어 등. 특정 SKU의 제품 경험과 혼합하지 않음 |
| M18 | [Trustpilot Product Reviews API](https://developers.trustpilot.com/product-reviews-api/) | 본문·필드, 갱신일 미표시 | 제품 리뷰 권한/키/계약 확인 | SKU/customerProductId 기반 제품 리뷰·별점·언어·내용·집계. 리뷰 본문과 요약 엔드포인트를 구분 |
| M19 | [Amazon SP-API Customer Feedback](https://developer-docs.amazon.com/sp-api/docs/customer-feedback-api) | 본문, API 2024-06-01 | Sellers/Vendors·권한 있는 요청 | ASIN/Browse Node의 리뷰·반품 주제, 언급·별점 영향·월별 변화·일부 snippet. 일본 포함, 주간 갱신·영어 제공. 전체 원문/일본어 원문 접근으로 확대 해석하지 않음 |
| M20 | [Google Business Profile reviews.list](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list) | 본문, 갱신일 미확인 | 관리·검증된 위치의 권한 있는 계정 | 장소 리뷰·평균·개수·개별 리뷰. 제품 SKU 리뷰와 구별, 임의 경쟁사 장소 전체 접근 경로가 아님 |

## 소셜·CRM·조사

| ID | 기관·제목·링크 | 확인 수준·날짜 | 확보 경로·대상 | 단위·내용·제약 |
| --- | --- | --- | --- | --- |
| M21 | [YouTube Videos](https://developers.google.com/youtube/v3/docs/videos) | 본문·필드, 갱신일 미확인 | API key/요청 유형별 권한 | 공개 영상 ID·채널·게시일·제목·설명·통계. 누적 공개 통계와 자사 Analytics 일별 성과는 다른 자료 |
| M22 | [YouTube CommentThreads](https://developers.google.com/youtube/v3/docs/commentThreads) | 본문, 갱신일 미확인 | API key/요청별 권한 | 댓글 thread·대상 영상·본문 댓글과 reply 구조. 모든 댓글/답글 완전 수집이나 전체 대중 의견 대표성을 보장하지 않음 |
| M23 | [Mailchimp Campaign reports](https://mailchimp.com/developer/marketing/api/reports/list) | 본문·필드, 갱신일 미표시 | 자사 계정 인증 | 캠페인 발송·반송·클릭·오픈·구독 해지·구매 연결. 오픈은 프록시 영향 등을 구별. 개별 activity 문서 요청은 실패해 별도 세부 미확정 |
| M24 | [HubSpot Deals developer guide](https://developers.hubspot.com/blog/a-developers-guide-to-hubspot-crm-objects-deals-object) | 본문, 게시일 이번 확인 미확정 | 자사 CRM·앱 권한 | dealname, amount, dealstage, pipeline, closedate, 연관 연락처. B2B 세일즈 기회와 소비재 주문은 구별 |
| M25 | [Zendesk Tickets](https://developer.zendesk.com/api-reference/ticketing/tickets/tickets/) | 부분: 공식 색인 필드 확인, 원문 요청 실패 | 자사 Support 계정 권한 | subject, description, status, priority, tags, custom_fields, 생성/수정일 등은 색인에서 확인. 구현 전 본문·권한 재확인 |
| M26 | [Google DV360 Brand Lift](https://support.google.com/displayvideo/answer/9570506?hl=en) | 본문, 갱신일 미표시 | 대상 광고주·설문·이용 조건 | 광고 회상·인지·고려·리프트. 노출/클릭 지표와 구별. 응답·표본 설계와 실제 제공되는 집계 확인 필요 |
| M27 | [NIQ Retail Measurement Services](https://nielseniq.com/global/en/products/retail-measurement-services-rms/) | 공식 제품 설명, 날짜 미표시 | 상업 계약·국가/카테고리 커버리지 확인 | POS 기반 매출·물량·가격·유통·프로모션. 투영·모델 기반 시장치 포함, 실제 제공 grain/스키마는 계약별 확인 |
| M28 | [Worldpanel consumer/shopper research 공식 설명](https://www.kantar.com/uki/Solutions/Consumer-and-Shopper-Behaviour) | 공식 제품 설명, 날짜 미표시 | 상업 패널 계약·국가 커버리지 확인 | 구매·사용·설문 연결 조사. 패널 표본에서 추정한 침투·재구매 등은 전고객 거래 실측이 아님. 일본 제공 범위 미확인 |

## 외부 환경·변경·실험·공개 데이터

| ID | 기관·제목·링크 | 확인 수준·날짜 | 확보 경로·대상 | 단위·내용·제약 |
| --- | --- | --- | --- | --- |
| M29 | [일본 정부 e-Stat API](https://www.e-stat.go.jp/api/en) | API 소개 본문, 개별 통계표 미선정 | 공개 통계 다운로드·등록 API | 통계표별 지역·기간·분류·값·단위. 인구·가계지출·물가 등 후보, 브랜드별 판매로 간주하지 않음 |
| M30 | [일본 기상청 과거 기상 검색](https://www.data.jma.go.jp/stats/etrn/index.php) | 포털 확인, 다운로드 세부 스키마 미확정 | 관측소·기간·항목 선택/공개 자료 | 지역 관측·기온·강수 등의 조건변수 후보. 빈도·품질 표시는 실제 자료 선택 후 확인 |
| M31 | [GDELT data documentation](https://gdeltproject.org/data.html) | 본문, 2.0 코드북 경로 확인 | 공개 자료·BigQuery·데이터 파일 | 기사·출처·언급 조직/장소/주제·자동분석 메타데이터. 감성/기사 빈도는 수요·여론 실측과 구별 |
| M32 | [Chrome UX Report API](https://developer.chrome.com/docs/crux/api/) | 본문, 갱신일 미확인 | API key·공개 적격 URL/origin | 실사용 페이지 성능 분포·집계기간. 28일 rolling 자료를 당일 장애·개별 사용자 세션으로 만들지 않음 |
| M33 | [Google Ads Change Event](https://developers.google.com/google-ads/api/docs/change-event) | 본문·필드, 갱신일 미확인 | 자사 Ads 권한 | 변경 시각·리소스·변경 필드·이전/이후값·클라이언트. 최근 30일 조회 제약, 웹 변경 기록의 전부와 같지 않을 수 있음 |
| M34 | [Google Ads Transparency Center 공식 소개](https://blog.google/innovation-and-ai/technology/ads/announcing-the-launch-of-the-new-ads-transparency-center/) | 본문, 2023-03-29 | 공개 조사/화면·현재 사용 조건 확인 | 광고주·광고 형식·지역·마지막 노출 시점 조사. 경쟁사 spend/conversions 전체를 제공한다고 가정하지 않음. 일반 자동 수집 API 미확정 |
| M35 | [Google Ads Experiments overview](https://developers.google.com/google-ads/api/docs/experiments/overview) | 본문, 갱신일 미확인 | 자사 실험 권한·캠페인 조건 | 실험·대조/실험 arm·배분·기간·상태. 단순 전후 비교와 구별, 실험 유형에 맞는 결과 자료 추가 |
| M36 | [GA4 공개 ecommerce 샘플 소개](https://developers.google.com/analytics/bigquery/web-ecommerce-demo-dataset) | 본문, 원 데이터 2020-11-01–2021-01-31 | BigQuery public dataset·프로젝트 | 가려진 이벤트 자료의 실제 형태 참고 가능. 내부 일관성 제한을 명시한 샘플. 이번에는 조회·가져오기 미실행 |
| M37 | [UCI Online Retail](https://archive.ics.uci.edu/dataset/352/online%2Bretail) | 데이터·필드 소개 본문, 실제 파일 미다운로드 | 공개 데이터·라이선스 확인 | InvoiceNo, StockCode, Description, Quantity, InvoiceDate, UnitPrice, CustomerID, Country. 오래된 영국 소매 자료이며 일본 헤어케어 분포로 이식하지 않음 |
| M38 | [Meridian Collect data](https://developers.google.com/meridian/docs/pre-modeling/collect-data) | 앞선 S04 본문 확인, 갱신 2026-09-17 UTC | 자사 KPI·매체·통제 자료를 정리 | 시간·지역·집행·반응·조건변수를 일관되게 연결. 현재 6개월 사례는 실제 MMM 충분성으로 주장하지 않음 |
| M39 | [Meridian Interpret optimizations](https://developers.google.com/meridian/docs/post-modeling/interpret-optimizations) | 앞선 S05 본문 확인, 갱신 2026-05-15 UTC | 학습·검증된 모델 또는 명시한 모의 모형 | 목표·총예산·제약·현행/변경·반응 곡선. 원천 관측과 예측 결과는 다른 데이터 층 |

## 접근 실패·제외·대체 기록

- Meta Insights/Ad Library 원문: 429/접근 실패. 비공식 블로그로 권한·필드를 확정하지 않고 M04 공식 코드만 필드 참고로 사용. Ad Library는 추가 조사 후보이며 M34와 기능이 동일하다고 주장하지 않음.
- TikTok 포털: 본문 미추출. M05는 후보 확인 수준. 세부 지표와 권한은 구현 전 재확인.
- Zendesk 본문: 요청 실패. M25는 공식 색인에서 확인한 수준만 사용.
- Amazon `.../lang-en_EN/docs/customer-feedback-api`: 404. 현재 일반 docs 경로 M19의 본문으로 대체 확인.
- e-Stat `/en/api/`: 접근 실패. `/api/en` M29로 대체 확인.
- Merchant `reports/price-insights`, `reports/best-sellers`: 요청 실패. 현재 `understand-the-market` M16으로 대체. Deprecated Content API 자료는 새 커넥터 명세로 채택하지 않음.
- Google Ads fields/latest/metrics·shared-budgets 경로: 이번 요청 실패. 모든 세그먼트·예산 기능을 지원한다고 문서화하지 않음. 광고 필드는 M01/M06/M04 범위에서 확인.
- Worldpanel 옛 consumer-panels URL: 원문 접근 실패. M28의 접근 가능한 공식 제품 소개로 대체. 현재 소유·브랜드 명칭이나 일본 지원을 추정하지 않음.
- Reddit·비공식 API 래퍼·마케팅 블로그는 후보 검색에 등장했지만 상세 스키마 근거로 사용하지 않음.

원문을 확인했다고 실제 운영 커넥터를 검증한 것은 아니다. 통계·API를 사용할 때 최신 필드·조회 범위·필수 인증·약관·원천 기간을 다시 확인하고 그 결과를 남긴다.

## 국가·카테고리 선택에 따른 추가 근거

사용자가 한국·일본·미국과 한 카테고리의 브랜드/제품 비교를 선택했다. 샴푸는 추천 초안이다. 다음 자료는 국가별 소스와 카테고리 매핑의 근거이며 실제 값을 조회하지 않았다.

| ID | 기관·제목·링크 | 확인 수준·날짜 | 확보 경로·대상 | 단위·내용·제약 |
| --- | --- | --- | --- | --- |
| M40 | [네이버 쇼핑 검색 API](https://developers.naver.com/docs/serviceapi/search/shopping/shopping.md) | 본문·필드, 갱신일 미표시 | 앱 등록·클라이언트 인증 | 상품명·상품 ID·판매처·브랜드·분류·최저/최고 가격. 일부 가격 0은 미제공 의미이므로 무료 가격으로 해석하지 않음 |
| M41 | [네이버 데이터랩 쇼핑인사이트](https://developers.naver.com/docs/serviceapi/datalab/shopping/shopping.md) | 본문, 갱신일 미표시 | 앱 등록·클라이언트 인증 | 쇼핑 분야/검색어의 클릭 추이와 제공되는 조건별 상대 비율. 검색 횟수·주문·매출과 다른 지표 |
| M42 | [Google product taxonomy 공식 분류](https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt) | 공식 분류 목록 확인, 기준 버전 별도 고정 필요 | 공개 분류 자료 | 외부 상품 분류 ID·계층. 우리의 비교 카테고리·제품 성능·구매자 특성을 자동 결정하지 않음 |
| M43 | [KOSIS 공유서비스](https://kosis.kr/openapi/) | 소개·개발 가이드 경로 확인, 개별 통계표 미선정 | 인증키·통계표 API | 한국 통계표·분류·기간·값·설명 자료의 경로. 향후 사용할 통계표·기준년·국가 범위 별도 확정 |
| M44 | [BLS Public Data API v2](https://www.bls.gov/developers/api_signature_v2.htm) | 본문·응답 구조, 개별 series 미선정 | 미국 공표 통계 API·요청 조건 | series ID·연도·기간·값·각주. 일본/한국 통계와 지수 기준이 같다고 가정하지 않음 |

스키마 형식 근거: [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12), [object/required/추가 속성 설명](https://json-schema.org/understanding-json-schema/reference/object). 2026-10-13 확인. 형식 선언과 필드 간 의미·참조 검증은 별개다. 공급자 데이터 소스 개수에는 포함하지 않았다.

## 시간 간격·집계에 관한 추가 공식 근거

2026-10-13 [Google Ads segmentation](https://developers.google.com/google-ads/api/docs/reporting/segmentation), [GA4 engagement rate](https://support.google.com/analytics/answer/12195621?hl=en), [Neo4j temporal values](https://neo4j.com/docs/cypher-manual/current/values-and-types/temporal/) 본문을 확인했다. 소스44개를 추가로 수집했다는 의미가 아니라 설계 근거 보완이다. 각각 날짜 세그먼트/호환성·비율의 분자/분모·시간 자료형을 설명한다. 발견·반영·한계는 [시간 계약의 근거 표](temporal-design.md)에 기록했다. 24개월과28일·건수·그래프 관계는 우리의 설계 제안이다.
