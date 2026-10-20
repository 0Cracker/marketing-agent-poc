# 마케팅 에이전트 대시보드 화면설계 레퍼런스 조사

- 조사일·문서 저장일: 2026-10-13 (Asia/Seoul)
- 목적: 두 마케팅 에이전트 데모에서 사용할 가상 대시보드의 데이터와 화면설계 참고 자료를 보존한다.
- 범위: 시장·경쟁 분석, 브랜드·소비자 분석, 광고 성과 분석, 예산 최적화·승인.
- 자료: 공식 제품 소개, 도움말, 공개 템플릿을 바탕으로 정리한 40개 레퍼런스.
- 상태: 레퍼런스 조사 결과와 데모 구성 제안이다. 실제 데이터 연동, 화면 구현, 예측 모델 검증을 완료한 명세가 아니다.

## 1. 조사 방향과 자료 해석

에이전트가 판단할 데이터를 사람이 어떤 대시보드에서 확인해왔는지 조사한다. 데이터 출처 → 주요 지표 → 표시 방식 → 판단 용도를 연결하고, 이후 실제 사용하는 것 같은 가상의 대시보드 구축에 활용한다.

사용자가 지정한 네 영역은 다음과 같다.

1. 시장·경쟁 분석: 국가, 제품 카테고리, 브랜드별 시장점유율과 경쟁 우위 비교.
2. 브랜드·소비자 분석: 검색 관심도, 리뷰, 소비자 반응과 브랜드 인식 변화.
3. 광고 성과: Google Ads, Meta Ads 등 매체별 광고비, 노출, 클릭, 전환, ROAS 분석.
4. 예산 최적화: 매체별 예산 배분, 시나리오 비교, 예상 성과, 집행 승인.

공식 제품 화면·도움말·공개 템플릿을 기준으로 조사했다. 일부는 로그인해야 전체 화면을 볼 수 있다. 공개 자료에 포함된 제품 소개·샘플을 실제 고객 계정 화면으로 간주하지 않는다. 모든 인터랙티브 화면을 직접 조작해 검증한 것은 아니다.

표에서 ‘구성 권장’은 공개된 데이터·기능을 바탕으로 우리 데모에 적용할 시각화 제안이며, 해당 제품의 정확한 화면 배치를 확인했다는 의미가 아니다. ‘참고’로 표시한 내용도 구현 시 원문 화면·도움말을 다시 확인한다. 링크와 제품 기능은 조사일 기준이며 이후 변경될 수 있다.

## 2. 네 대시보드가 답해야 하는 질문

| 영역 | 사람이 확인하던 질문 | 에이전트에게 필요한 데이터 |
| --- | --- | --- |
| 시장·경쟁 분석 | 어느 국가·카테고리에서 성장하거나 밀리고 있는가? 경쟁사는 어디에서 강한가? | 시장 규모, 브랜드별 판매액·판매량, 가격, 유통 범위, 경쟁사 트래픽·광고 활동 |
| 브랜드·소비자 분석 | 관심과 인식이 어떻게 변했는가? 무엇 때문에 소비자 반응이 달라졌는가? | 검색 관심도, 설문, 리뷰 원문·평점, 온라인 언급, 감성·토픽 |
| 광고 성과 분석 | 어떤 매체·캠페인·소재에서 성과가 변했는가? 어느 단계에서 이탈하는가? | 광고비, 노출, 클릭, 전환, 주문·매출, 소재, 타깃, 랜딩 페이지 |
| 예산 최적화 | 예산을 어디로 옮기면 좋은가? 예상 효과와 제약은 무엇인가? | 현재 배분, 성과 이력, 반응 곡선, 목표, 채널별 제한, 예산·승인 상태 |

## 3. 시장·경쟁 분석 레퍼런스 — 10개

판매 기반 시장 데이터와 디지털 경쟁 데이터를 함께 참고한다.

| # | 공개 사례·출처 | 사용하는 데이터·주요 지표 | 화면에서 참고할 표시 방식·판단 |
| --- | --- | --- | --- |
| 1 | [NIQ Retail Measurement / Discover](https://nielseniq.com/global/en/products/retail-measurement-services-rms/) | 소매 POS 데이터. 판매액·판매량, 시장점유율, 가격, 유통률, 판촉 효과 | 국가·채널·브랜드별 성과 비교. 점유율 추이, 브랜드 순위, 가격·유통률 비교 구성 권장 |
| 2 | [NIQ Digital Purchases](https://nielseniq.com/global/en/products/digital-purchases/) | 소비자 전자 영수증·온라인 구매 패널. 브랜드·상품·판매처별 구매, 점유율, 가격·판촉 | 온라인 시장의 판매처·브랜드·제품 비교. 카테고리별 점유율과 경쟁사 가격 비교 구성 권장 |
| 3 | [Euromonitor Passport](https://www.euromonitor.com/solutions/passport) | 국가·카테고리별 시장 규모, 기업·브랜드 점유율, 과거 실적·전망 | 국가×카테고리 비교, 성장 기회 탐색. 시장 규모·성장률 산점도와 브랜드 점유율 표 구성 권장 |
| 4 | [Passport E-Commerce](https://www.euromonitor.com/solutions/passport/e-commerce) | 국가·세부 카테고리·소매업체·공급사·브랜드별 온라인 판매 | 온라인 판매 분석용 인터랙티브 대시보드. 국가·카테고리 필터와 브랜드/리테일러 비교 참고 |
| 5 | [Similarweb Market Share Dashboard](https://www.similarweb.com/corp/custom-performance-reporting/market-share-dashboard/) | 웹 방문·앱 이용 기반 디지털 점유율. 국가·지역별 비중, 일별 변화 | 경쟁사별 점유율 추이와 국가별 분해. 어느 지역에서 디지털 존재감이 변하는지 확인 |
| 6 | [Similarweb Market Players](https://support.similarweb.com/hc/en-us/articles/12272617115421-Market-Players) | 방문 규모·성장률, 직접 유입, 브랜드 검색량 등 | 사분면·버블 차트로 경쟁 위치 비교. 브랜드 강도는 직접 유입×브랜드 검색량, 버블 크기는 방문수 |
| 7 | [Similarweb Industry Analysis](https://support.similarweb.com/hc/en-us/articles/20933558469277-Industry-Analysis) | 산업 내 도메인별 방문수·점유율·전년 대비 성장 | 트리맵, 막대·추이 차트. 큰 경쟁사와 빠르게 성장하는 경쟁사를 동시에 파악 |
| 8 | [Semrush Growth Quadrant](https://www.semrush.com/news/242721-zoom-in-on-your-market-with-the-new-growth-quadrant/) | 경쟁 도메인의 트래픽 규모·성장 | 규모×성장률 사분면. Leaders, Established Players, Game Changers, Niche Players로 위치 표시 |
| 9 | [Stackline Sales / Market Share Analytics](https://www.stackline.com/sales) | 리테일러·지역·판매 채널·제품군별 판매와 점유율 | 브랜드·경쟁사·제품군별 비교 및 세부 탐색. 카테고리→브랜드→SKU로 내려가는 화면 구성 권장 |
| 10 | [Sensor Tower Market Size Report](https://sensortower.com/blog/platform-updates-summer-2025) | 앱 카테고리·국가·기기별 다운로드, 매출, 다운로드당 매출, 이용시간 | 시계열과 세부 필터로 시장 규모·성장 비교. 앱·디지털 서비스 업종에 적합 |

### 우선 참고할 조합

Passport의 국가·카테고리 구조 + NIQ의 판매 점유율 + Similarweb의 경쟁 위치 차트.

### 데이터 해석 기준

매출 점유율, 판매량 점유율, 웹 방문 점유율은 각각 분모가 다르다. Similarweb의 디지털 점유율을 판매 기반 시장점유율로 표시하지 않는다. 시장 전체의 판매 자료가 없으면 자사 주문 데이터만으로 전체 시장점유율을 계산할 수 없다.

- [NIQ 지표 설명](https://nielseniq.com/global/en/products/retail-measurement-services-rms/)
- [Similarweb 디지털 점유율 정의](https://www.similarweb.com/corp/custom-performance-reporting/market-share-dashboard/)
- [NIQ Discover 화면·플랫폼 소개](https://nielseniq.com/global/en/products/discover/)

## 4. 브랜드·소비자 분석 레퍼런스 — 10개

관심 변화, 인식 변화, 변화의 원문 근거를 연결하는 사례를 참고한다.

| # | 공개 사례·출처 | 사용하는 데이터·주요 지표 | 화면에서 참고할 표시 방식·판단 |
| --- | --- | --- | --- |
| 11 | [Google Trends / Supermetrics 템플릿](https://supermetrics.com/blog/google-data-studio-google-trends) | 검색어·주제별 관심도, 기간·국가·카테고리 | 검색 관심도 추이와 지역 비교. 자사·경쟁 브랜드를 같은 조건으로 비교 |
| 12 | [네이버 데이터랩 통합검색어 트렌드](https://developers.naver.com/products/service-api/datalab/datalab.md) | 주제군별 검색 추이. 성별·연령·PC/모바일 구분 | 브랜드·제품군별 추이 선 그래프. 어떤 소비자 집단에서 관심이 달라졌는지 확인 |
| 13 | [네이버 데이터랩 쇼핑인사이트](https://developers.naver.com/products/service-api/datalab/datalab.md) | 네이버 쇼핑 영역의 검색 클릭 추이. 분야·연령·성별·기기 | 카테고리 수요 추이와 소비자 세그먼트 비교 구성 권장. 검색 관심과 쇼핑 탐색을 연결 |
| 14 | [YouGov BrandIndex](https://yougov.com/en-us/business/products/brandindex?campaign=mkt_solutions) | 지속적인 소비자 설문. 인지도, 광고 인지도, 품질·가치 인식, 만족도, 고려도, 구매 의향 | 경쟁 브랜드·국가·소비자 집단별 비교. 브랜드 건강도 추이와 인지도→고려→구매 의향 퍼널 참고 |
| 15 | [Qualtrics BX Dashboards](https://www.qualtrics.com/support/brand-experience/bx-dashboards-overview/) | 브랜드 트래킹 설문과 응답자 속성 | 브랜드 인식·속성·퍼널을 위젯으로 구성. 브랜드별 비교와 소비자 집단별 필터 참고 |
| 16 | [Brandwatch Listen 분석 화면](https://social-media-management-help.brandwatch.com/en/articles/17450103-viewing-and-analyzing-listen-searches) | 온라인 언급, 플랫폼, 감성, 감정, 관심사, 언어, 국가 | 언급량·감성 차트와 원문 목록, 플랫폼·국가별 분해. 반응 변화의 근거 확인 |
| 17 | [Talkwalker Social Listening Dashboard](https://www.talkwalker.com/blog/social-listening-dashboard-made-easy) | 브랜드 언급, 시간별 급증, 감성·주제·소비자 집단 | 언급 급증 그래프와 사건 요약. 이상 변화가 발생한 시점과 관련 대화를 연결 |
| 18 | [Talkwalker Social Benchmarking](https://www.talkwalker.com/products/social-benchmarking) | 자사·경쟁사 소셜 성과, 감성, 산업 벤치마크 | 경쟁사·산업·감성 비교 화면. 자사 변화가 산업 전체 변화인지 구분 |
| 19 | [Yotpo Insights — Topics](https://support.yotpo.com/v1/docs/insights-topics) | 리뷰 원문에서 추출한 배송·품질·가격 등의 토픽, 감성, 의견수, 제품·국가 | 토픽별 점수·증감 카드, 감성 누적 막대, 관련 리뷰 원문. 소비자 불만의 구체적 원인 탐색 |
| 20 | [Yotpo Reviews Atlas](https://support.yotpo.com/docs/en/reviews-atlas-overview) | 리뷰수·평점·최근성·검증 여부·제품별 리뷰 성과 | 제품별 성과표, 평점 분포, 30일 감성 추이, 제품 상세 패널. 어떤 제품에서 문제가 발생했는지 확인 |

### 우선 참고할 조합

YouGov의 브랜드 인식·퍼널 + Yotpo의 토픽별 리뷰 분석 + 검색 트렌드.

Yotpo Topics는 분석 에이전트 데모에 특히 적합하다. ‘배송’ 토픽의 부정 반응 증가를 누르면 관련 제품·국가·리뷰 원문까지 확인할 수 있어 에이전트의 설명을 원천 근거에 연결하기 좋다.

### 데이터 해석 기준

Google Trends는 0~100으로 정규화된 상대 검색 관심도다. ‘검색 관심지수’로 표시하고, 절대 검색량이나 시장점유율과 구분한다. 리뷰의 감성과 설문 기반 브랜드 인식도 서로 다른 자료로 표시한다.

- [Google Trends 공식 데이터 설명](https://support.google.com/trends/answer/4365533?hl=en)
- [Yotpo 토픽·감성·원문 탐색 설명](https://support.yotpo.com/v1/docs/insights-topics)

## 5. 광고 성과 분석 레퍼런스 — 12개

매체별 요약에서 캠페인 → 광고그룹 → 소재·타깃 → 사이트 행동 → 실제 주문으로 내려가는 구성을 참고한다.

| # | 공개 사례·출처 | 사용하는 데이터·주요 지표 | 화면에서 참고할 표시 방식·판단 |
| --- | --- | --- | --- |
| 21 | [Porter Cross-channel Dashboard](https://portermetrics.com/en/examples/cross-channel-porter-example/) | Google·Meta·LinkedIn·TikTok 광고비, 클릭·전환율, 도달·참여 | 매체 통합 비교. 상단 KPI, 채널별 추이·성과표 구성 권장 |
| 22 | [Funnel Performance Marketing](https://funnel.io/templates/performance-marketing) | 광고 플랫폼 데이터 + Google Analytics. 비용, 전환, 노출, 유입 출처 | 광고 성과와 사이트 성과를 연결한 통합 화면. 유입 이후 성과까지 확인 |
| 23 | [Zoho Google Ads Dashboard](https://www.zoho.com/analytics/dashboard-examples/marketing.html) | 광고비, 노출, 클릭, CTR, CPC, 전환, 전환당 비용, ROAS | 계정 전체 요약과 캠페인별 비교. 비용 증가·전환 감소 캠페인 탐색 |
| 24 | [Porter Meta Ads — Kodalogic 사례](https://portermetrics.com/en/examples/meta-ads-kodalogic-example/) | Meta 광고 캠페인·광고세트·광고 단위 성과 | 캠페인·광고 단위 성과 비교 참고. 매체 담당자의 운영 화면에 가까운 레퍼런스 |
| 25 | [Porter LinkedIn Ads — Understory 사례](https://portermetrics.com/en/examples/linkedin-ads-understory-example/) | 광고비, 리드, CPL, CTR, 전환율, 광고 형식·목표 | 리드 획득 성과와 캠페인·광고별 비교. B2B 데모에 적합 |
| 26 | [Funnel TikTok Ads Dashboard](https://funnel.io/templates/tiktok-ads) | 비용, 클릭, 노출, 전환 | 매체 성과와 세부 지표 탐색. 트래픽·전환·앱 설치 목적별 비교 참고 |
| 27 | [Zoho YouTube Ads Dashboard](https://www.zoho.com/analytics/dashboard-examples/marketing.html) | 조회수, VTR, CPV, 노출, 획득 행동, 전환, 광고비 | 영상 광고 성과 요약과 캠페인 비교. 영상 반응과 최종 전환의 차이 확인 |
| 28 | [Triple Whale Creative Analysis](https://kb.triplewhale.com/en/articles/6362638-analyze-creative-performance-with-the-creative-analysis-dashboard) | 소재별 광고비·ROAS·CTR 등, 광고 이미지·영상, 채널·소재 그룹 | 썸네일 카드·막대·선 그래프 전환, 소재 상세 탐색. 성과가 좋은 소재와 피로 징후 비교 |
| 29 | [Coupler Keyword Performance](https://www.coupler.io/dashboard-examples/marketing-dashboard) | Google Ads 키워드 단위 성과 | 갤러리의 ‘Keyword performance dashboard’. 키워드별 비용·전환·효율 정렬표 구성 권장 |
| 30 | [Google Ads Auction Insights](https://support.google.com/google-ads/answer/2579754?hl=en-AU) | 노출 점유율, 중복률, 경쟁사보다 높은 순위 비율, 상단 노출률 등 | 경쟁 광고주 비교표, 기간·기기별 분해. 경쟁 강도 변화와 입찰·예산 판단 연결 |
| 31 | [Coupler GA4 Ecommerce Sales Funnel](https://www.coupler.io/dashboard-examples/marketing-dashboard) | GA4 전자상거래 행동·전환 데이터 | 갤러리의 ‘Ecommerce sales funnel dashboard for GA4’. 상품 조회→장바구니→결제→구매 퍼널 구성 참고 |
| 32 | [Porter Shopify Attribution](https://portermetrics.com/en/examples/shopify-attribution-porter-example/) | Shopify 주문·매출과 마케팅 유입·귀속 데이터 | 채널별 주문·매출 귀속 비교. 광고 플랫폼 성과와 실제 판매 결과를 연결 |

### 우선 참고할 조합

Funnel의 매체·사이트 통합 구조 + Triple Whale의 소재 비교 + 실제 주문·매출.

소재 화면은 광고 이미지/영상 + 광고비 + CTR + CPA/ROAS + 시간 추이를 함께 표시하는 방식이 좋다. Triple Whale은 카드·막대·선 그래프를 전환하고 여러 소재와 지표를 비교하는 화면을 제공한다.

### 데모 집계 기준 제안

기존 PoC의 데이터 원칙과 연결해 다음을 유지한다.

- 광고비·매출·전환수는 원천값을 합산하고 비율은 합계에서 계산한다. 행별 비율을 단순 평균하지 않는다.
- ROAS = 귀속 매출 / 광고비, CPA = 광고비 / 정의한 전환수, CTR = 클릭수 / 노출수. CVR은 분모가 클릭인지 세션인지 명시한다.
- 전환의 정의, 귀속 모델·기간, 통화, 시간대, 갱신 시각을 표시한다.
- 플랫폼별 귀속 매출은 중복 가능성이 있으므로 검증 없이 합산하지 않는다. 실제 주문 매출과 플랫폼 귀속 매출을 구분한다.
- 분모가 0이거나 데이터가 결측이면 계산 불가·결측으로 표시한다.

이 기준은 제품별 기능 조사 결과가 아니라 우리 데모 데이터 설계 제안이다.

## 6. 예산 최적화·승인 레퍼런스 — 8개

예산 소진 관리, 성과 예측, 배분안 비교, 승인 관리를 함께 참고한다.

| # | 공개 사례·출처 | 사용하는 데이터·주요 지표 | 화면에서 참고할 표시 방식·판단 |
| --- | --- | --- | --- |
| 33 | [Supermetrics Campaign Budget Pacing](https://supermetrics.com/template-gallery/google-sheets-budget-pacing-campaign-level) | 캠페인별 월 예산, 누적 지출, 전월·당월 지출 | 캠페인별 예산 소진 표와 계획 대비 비교. 초과·미달 집행 발견 |
| 34 | [Optmyzr Budget Dashboard](https://help.optmyzr.com/en/articles/11080391-budget-dashboard-user-guide) | 목표·실제 지출, 지출 전망, 요일별 패턴, 매체 구성, 예산별 성과 | 목표 대비 지출, 예상 소진, 매체 배분, 예산 순위 위젯. 조정할 예산 탐색 |
| 35 | [Google Ads Performance Planner](https://support.google.com/google-ads/answer/12633931?hl=en--) | 캠페인 실적·예측, 계획 기간·예산·목표 | 총지출에 따른 예상 성과 곡선 + 캠페인별 예측표. 예산 변경에 따른 전환·CPA 비교 |
| 36 | [Google Meridian Scenario Planner](https://developers.google.com/meridian/docs/scenario-planning/meridian-scenario-planner) | 학습된 마케팅 믹스 모델, 매체 지출·성과, 총예산·채널별 제한 | 현재/최적 배분 비교, 예산 증감, 예상 성과, 반응 곡선. 고정·가변 예산 시나리오 탐색 |
| 37 | [Meta Robyn Budget Allocator](https://facebookexperimental.github.io/Robyn/docs/analysts-guide-to-MMM/) | 마케팅 믹스 모델의 채널 기여·효율·포화 곡선, 예산 제약 | 기존/최적 배분, 기존/예상 성과, 채널별 반응 곡선. 포화된 채널에서 예산 이동 검토 |
| 38 | [Adobe Marketing Scenario Planning](https://business.adobe.com/products/mix-modeler/marketing-scenario-planning.html) | 계획 기간, 총예산, 채널 제한, 비용·가치 가정, 예측 모델 | 여러 계획의 나란한 비교, 채널 배분·예상 결과. 대안별 효과와 절충점 검토 |
| 39 | [Planful Marketing Dashboards](https://planful.com/blog/what-belongs-in-a-marketing-dashboard/) | 계획·확정·실제 지출, 예산 담당자, 전략 목표, 캠페인 | 기간·조직·지출 유형·목표별 예산 화면. 광고비를 재무·사업 목표와 연결 |
| 40 | [Planful Marketing Budget Management](https://planful.com/solution-hub/marketing-budget-management/) | 예산 계획·실적·차이, 채널·지역·캠페인, 재배분·승인 | 계획 대비 실적과 차이 분석, 예산 재배분·승인 흐름. 최적화안을 업무 결정으로 연결 |

### 우선 참고할 조합

- 예산 시뮬레이션: Meridian과 Adobe.
- 일상적인 지출 관리: Optmyzr.
- 승인·재무 연결: Planful.

Meridian은 현재와 최적 예산을 채널별로 비교하고, 반응 곡선 위에 현재·최적 지출 위치를 표시한다. ‘왜 이 매체의 예산을 늘리거나 줄이는가?’를 보여주기 좋은 레퍼런스다.

### 데모 해석 기준 제안

가상 시나리오의 예상 효과는 관측 성과와 구분한다. 학습·검증된 모델 없이 만든 반응 곡선이나 성과 수치는 가정 기반 모의 결과로 표시한다. 예산 소진 예측과 광고 성과 예측도 서로 다른 계산이다. 승인 상태와 실제 집행 결과는 각각 표시한다.

## 7. 우리 가상 대시보드에 필요한 데이터 묶음

다음은 위 사례를 종합한 데모 구성 제안이다. 실제 구축 시 업종·국가·데모 질문에 따라 필요한 범위를 확정한다.

| 데이터 묶음 | 가상 데이터에 넣을 핵심 항목 | 연결할 화면 |
| --- | --- | --- |
| 시장 판매 | 기간, 국가, 카테고리, 브랜드, 판매액·판매량, 시장 전체 합계, 조사 범위 | 시장 규모·점유율 |
| 가격·유통 | SKU, 정상가·실판매가, 할인, 판매처, 유통률, 재고·품절 | 경쟁 우위·성과 원인 |
| 경쟁 활동 | 경쟁 브랜드, 출시·프로모션·광고 소재, 발생일, 출처 | 경쟁 상황·사건 타임라인 |
| 검색 관심 | 검색어/주제, 지역, 기간, 관심지수, 비교 조건 | 브랜드 관심 변화 |
| 브랜드 설문 | 조사일, 브랜드, 소비자 집단, 응답자수, 인지도·고려도·구매 의향 | 브랜드 인식·퍼널 |
| 리뷰·소비자 반응 | 원문, 평점, 제품, 국가, 날짜, 토픽, 감성, 검증 여부, 원문 링크 | 불만·선호·인식 변화 |
| 소셜·미디어 | 언급, 채널, 작성일, 참여, 감성, 토픽, 브랜드, 원문 링크 | 언급량·반응·이슈 |
| 광고 실적 | 날짜, 매체, 계정, 캠페인, 광고그룹, 소재, 타깃, 비용·노출·클릭·전환 | 매체·캠페인·소재 성과 |
| 사이트 행동 | 유입 출처, 랜딩 페이지, 기기, 상품 조회·장바구니·결제·구매 | 전환 퍼널 |
| 실제 주문·수익 | 주문·고객·제품 ID, 매출, 할인, 환불, 원가, 신규/기존 고객 | 실제 판매·수익성 |
| 예산·예측 | 현재 배분, 총예산, 목표, 최소·최대 배분, 시나리오, 예상 결과·가정 | 최적화·시나리오 비교 |
| 승인·집행 | 제안 버전, 변경 전후, 담당자, 승인 상태, 적용일, 집행 결과 | 검토·승인·후속 확인 |

### 공통 데이터 조건

- 출처, 갱신 시각, 단위, 관측/추정/가상 여부, 결측 상태를 붙인다.
- 국가·브랜드·카테고리·제품은 화면 사이에서 같은 식별자로 연결한다.
- 데이터별 집계 주기·기간·표본·시장 범위를 표시한다. 월간 시장 자료와 일간 광고 자료의 기간을 일치시켜 비교한다.
- 리뷰·언급은 요약 수치와 원문 근거를 연결한다. 데모 원문·인물·URL은 가상임을 표시한다.
- 예산 시나리오는 동일한 기준 데이터·기간·가정 아래 비교하고 제안 버전을 보존한다.

## 8. 네 화면에서 이어지는 가상 시나리오

독립적인 차트 모음보다 동일한 사건과 연결된 가상 데이터가 실제 업무처럼 보이는 데 유리하다. 다음은 예시이며 실제 관측이나 확정된 인과관계가 아니다.

| 화면 | 보이는 상황 | 에이전트가 할 판단 |
| --- | --- | --- |
| 시장·경쟁 | 특정 국가에서 자사 점유율 하락, 경쟁사 판촉 확대 | 시장 전체 둔화인지 자사만의 문제인지 비교 |
| 브랜드·소비자 | 검색 관심은 유지되지만 배송 관련 부정 리뷰 증가 | 관심 부족·경쟁 활동·고객 경험 문제를 가설로 비교 |
| 광고 성과 | 클릭은 유지되지만 구매 전환율 하락 | 매체·소재·기기·제품별로 하락 위치 확인 |
| 예산 최적화 | 현행 유지, 일부 재배분, 제한 실험 시나리오 비교 | 근거와 제약을 제시하고 실행안 검토·승인으로 연결 |

분석 에이전트는 ‘무엇이 변했으며 어떤 근거가 있는가?’, 최적화 에이전트는 ‘어떤 변경안을 어떤 조건에서 검토할 것인가?’를 보여주는 구성이다. 리뷰와 전환율이 함께 변했다는 관측만으로 원인을 확정하지 않고, 확인할 자료·실험까지 연결한다.

## 9. 화면설계 착수 시 우선순위

| 화면 | 먼저 볼 레퍼런스 | 가져올 구조 |
| --- | --- | --- |
| 시장·경쟁 | Passport·NIQ·Similarweb | 국가·카테고리 필터, 판매 점유율, 경쟁사 위치·성장 비교 |
| 브랜드·소비자 | YouGov·Yotpo·검색 트렌드 | 브랜드 인식 퍼널, 관심도 추이, 토픽별 감성·원문 근거 |
| 광고 성과 | Funnel·Triple Whale | 채널 통합 성과, 소재 썸네일 비교, 사이트·주문 성과 연결 |
| 예산 최적화·승인 | Meridian·Optmyzr·Planful | 배분 전후·반응 곡선, 예산 소진, 승인·집행 상태 |

기존 PoC 문맥과 화면 디자인 기준은 같은 폴더의 `marketing-poc-design.md` 및 `marketing-poc-v0.1.0-release-result.md`에 있다. 이 조사 문서는 후속 화면 구축을 위한 참고 자료이며 기존 CTI 정의·시나리오·승인 동작을 자동 변경하지 않는다.

## 10. 추가 탐색용 갤러리와 상세 자료

- [Supermetrics 템플릿 갤러리](https://supermetrics.com/template-gallery)
- [Coupler 마케팅 대시보드 갤러리](https://www.coupler.io/dashboard-examples/marketing-dashboard)
- [Porter 실제 사례·템플릿 모음](https://portermetrics.com/en/examples/)
- [Klipfolio 인터랙티브 예시](https://www.klipfolio.com/live-dashboards)
- [Adriel 템플릿 라이브러리](https://www.adriel.com/template-library)
- [Whatagraph 마케팅 대시보드 사례](https://whatagraph.com/blog/articles/marketing-dashboard-examples)
- [Euromonitor 데이터 연동·국가/카테고리/브랜드 구조](https://www.euromonitor.com/solutions/passport/connect/api)
- [Brandwatch 대시보드 집계 데이터](https://developers.brandwatch.com/docs/data-retrieval)
- [Supermetrics 예산 소진 지표·계산 설명](https://supermetrics.com/blog/ad-spend-tracking)
- [Google Performance Planner 계획 검토·적용](https://support.google.com/google-ads/answer/12632213?hl=en)

## 11. 화면 구축 전에 확정할 사항

1. 데모 업종, 제품 카테고리, 국가와 브랜드 수.
2. 시장점유율의 기준: 매출·판매량·디지털 방문 등 각각의 정의와 분모.
3. 가상 데이터 기간·집계 주기와 네 화면을 관통할 대표 사건.
4. 전환·매출 귀속 기준과 실제 주문 데이터 연결 범위.
5. 두 에이전트의 질문·출력·근거 탐색·승인 흐름.
6. 예산 시나리오의 목표·제약·가정과 모의 집행 범위.

위 항목은 조사 이후의 설계 결정 사항으로 남겨둔다.
