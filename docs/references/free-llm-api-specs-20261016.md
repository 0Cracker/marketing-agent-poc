# 무료 LLM API 사양 및 사용량 비교

확인일: 2026-10-16, 한국 시간. 마케팅 분석·예산 에이전트에 필요한 텍스트 생성과 도구 호출을 중심으로 8개 서비스를 조사했다. 공식 공개 문서와 모델 카탈로그 기준이며, 계정 로그인·실제 추론 호출·한국어 품질 시험은 하지 않았다. 모델 제공과 무료 정책은 변경될 수 있다.

**추천: 반복 개발은 Gemini Flash-Lite를 먼저 평가하고, Flash는 어려운 분석의 비교용으로 평가한다.** 아래 보완 조사에서 Flash 20 RPD와 Flash-Lite 500 RPD의 사용자 보고값을 확인했다. 우리 프로젝트의 실제 적용값은 별도 확인해야 한다. Groq는 보조 후보이며, 요청 횟수 외에 토큰·공유 한도를 함께 관리해야 한다.

## 1. 숫자 읽는 법

| 항목 | 의미 |
|---|---|
| RPM / RPD | 분당 / 일일 API 요청 수 |
| TPM / TPD | 분당 / 일일 토큰 수. 입력만인지 입출력 합계인지는 제공사에 따라 다름 |
| RPS / TPH | 초당 요청 수 / 시간당 토큰 수 |
| Context | 한 요청에서 처리할 수 있는 문맥 크기. 일일 토큰 예산과 별개 |
| 최대 출력 | 한 응답의 출력 상한. 문맥 최대치와 동시에 전부 사용할 수 있다는 뜻은 아님 |
| 도구 호출 | 모델이 함수명·인자를 반환하는 기능. 실제 SQL·온톨로지 조회·시뮬레이션은 우리 서버가 실행 |
| 계정 확인 | 관리 화면에 실제 적용 한도가 표시됨 |
| 미공개 | 조사한 공개 문서에서 공통 수치를 확인하지 못함. 무제한이라는 뜻이 아님 |

질문 1회와 API 호출 1회는 다르다. 도구 선택 → 결과 확인 → 추가 조회 → 최종 답변이면 모델을 여러 번 호출한다. 대화 기록·도구 스키마·도구 결과도 입력 토큰을 차지한다.

## 2. 제공사별 무료 정책과 호출 한도

| 서비스 | 무료 방식 | 호출 빈도 | 일일 / 월간 한도 | 토큰·기타 한도 | 적용 범위 |
|---|---|---|---|---|---|
| Gemini Developer API | 대상 모델 입출력 무료 | 계정·모델별 확인 | RPD 계정 확인 | 입력 TPM 등 계정 확인 | 프로젝트별, API 키별 아님 |
| Groq | Free Plan | 주력 3종 30 RPM | 각 모델 공개 표 1,000 RPD | 8,000 TPM·200,000 TPD | 조직·모델별, 계정 예외 가능 |
| OpenRouter | 무료 모델 엔드포인트 | 20 RPM | 결제 이력 없는 계정 50 RPD | 공통 TPM·TPD 미공개, 공급자 제한 추가 | 무료 모델들에 걸친 계정 공유 |
| Cohere | 평가용 무료 키 | Chat 주요 모델 20 RPM | 1,000 API 호출/월 | 공통 TPM·TPD·RPD 미공개 | 월간 평가 한도 공유 |
| Cloudflare Workers AI | 매일 무료 연산량 | 텍스트 생성 기본 300 RPM | 10,000 neurons/일 | 모델·입출력 길이에 따라 차감 | 계정 전체 공유 |
| Mistral | Free mode, 카드 없이 시작 | 모델별 RPS 계정 확인 | 월간 한도 계정 확인 | 모델별 TPM 계정 확인 | 조직 전체, 워크스페이스 합산 |
| Hugging Face Inference Providers | 무료 사용자 월 크레딧 | 공급자·모델별 | $0.10/월 | 가격에 따라 사용량 달라짐 | 월 크레딧, 고정 호출량 아님 |
| Cerebras | 기간 한정 무료 체험 | 5 RPM | RPD 미공개, $5 크레딧·30일 | 비캐시 30,000 TPM·총 90,000 TPM·1M TPH·1M TPD | 조직별, 결제수단 확인 필요 |

근거: [Gemini 한도](https://ai.google.dev/gemini-api/docs/rate-limits), [Groq 한도](https://console.groq.com/docs/rate-limits), [OpenRouter 한도](https://openrouter.ai/docs/api_reference/limits), [Cohere 한도](https://docs.cohere.com/v2/docs/rate-limits), [Cloudflare 가격](https://developers.cloudflare.com/workers-ai/platform/pricing/)·[빈도 제한](https://developers.cloudflare.com/workers-ai/platform/limits/), [Mistral 한도](https://docs.mistral.ai/admin/billing-usage/usage-limits), [HF 크레딧](https://huggingface.co/docs/inference-providers/en/pricing), [Cerebras 체험](https://inference-docs.cerebras.ai/support/rate-limits).

OpenRouter에서 $10 이상 크레딧을 구매한 경우 무료 모델 한도가 1,000 RPD로 올라가는 정책은 **지출 없는 무료 사용과 구분**해야 한다. 키를 여러 개 만든다고 계정·조직·프로젝트의 공유 한도가 늘어나지 않는다.

## 3. Gemini: 모델별 사양

### 보완 조사: 모델별 무료량의 실제 보고값

최초 정리에서 전부 '계정 확인'으로 묶어 모델별 사용량 차이를 빠뜨렸다. 공개 공식 문서의 공통 한도 표가 없다는 사실과, 개발자가 직접 공개한 AI Studio·Cloud Console 한도 및 API 오류의 숫자를 구분해 보완한다. **아래는 Google의 공통 보장 한도가 아니라 개별 프로젝트의 사용자 보고값**이며 2026-10-16 현재 우리 계정에서 검증한 수치는 아니다.

| 모델 | RPM 보고값 | 입력 TPM 보고값 | RPD 보고값 | 직접 자료의 시점 |
|---|---:|---:|---:|---|
| `gemini-3.8-flash` | 5 | 250,000 | 20 | 2026-09-28~29 사용 화면 보고 |
| `gemini-3.6-flash` | 별도 숫자 확인 미완료 | 250,000 | 20 | 2026-08 API 오류·09-17 일일 오류 보고 |
| `gemini-3.5-flash-lite` | 15 | 250,000 | 500 | 2026-09-28~29 사용 화면 보고 |
| `gemini-3.1-flash-lite` | 15 | 250,000 | 500 | 2026-06-18 Cloud Console 한도 보고 |

근거는 사용자의 직접 기록이다: [3.8 Flash·3.5 Flash-Lite 화면 수치](https://discuss.ai.google.dev/t/repeated-503-unavailable-on-free-tier-including-a-tiny-text-only-generatecontent-request-from-apps-script/185898), [3.5 Flash-Lite 별도 기록](https://discuss.ai.google.dev/t/gemini-3-5-flash-lite-repeated-503-unavailable-including-minimal-text-request/185876), [3.1 Flash-Lite 한도 기록](https://discuss.ai.google.dev/t/gemini-api-generatecontent-returns-403-while-models-counttokens-and-quotas-work/171688), [3.6 Flash 입력 TPM 오류](https://discuss.ai.google.dev/t/429-too-many-request-error-for-tpm-limit-but-it-does-not-reset-after-10-min/112035), [Flash 모델별 20 RPD 오류](https://discuss.ai.google.dev/t/gemini-api-free-tier-daily-quota-does-not-reset-persistent-429-resource-exhausted/183406). 포럼이 Google 도메인이어도 사용자 보고는 Google의 공식 보장과 다르다.

2026-10-16 AI Studio 비율 제한 화면을 직접 열었으나 현재 연결 계정에는 표시할 Cloud 프로젝트가 없어 한도 표를 확인하지 못했다. 프로젝트 생성·가져오기·결제 설정·모델 호출은 하지 않았다.

보고된 RPD가 적용되고 다른 제한에 걸리지 않는다고 가정하면, 분석당 4회 호출 시 Flash는 5개/일, Flash-Lite는 125개/일이다. 전체 데모당 8회라면 각각 2개/일·62개/일이다. 500 대 20의 25배 차이 때문에 무료 반복 개발에서는 Flash-Lite를 우선 평가하는 것이 타당하다. 이는 RPD만으로 계산한 상한이며 품질·가용성·추가 토큰 한도 검증이 남는다.

### 공식 가격·기능 사양

현재 가격표에서 입출력 무료를 확인한 최신 텍스트 모델이다. 아래 4종 모두 함수 호출과 구조화 출력을 지원한다. 텍스트 외 이미지·영상·오디오·PDF 입력을 지원하고 출력은 텍스트다.

| 모델 ID | 최대 입력 토큰 | 최대 출력 토큰 | RPM / TPM / RPD |
|---|---:|---:|---|
| `gemini-3.8-flash` | 1,048,576 | 65,536 | 계정 확인 |
| `gemini-3.6-flash` | 1,048,576 | 65,536 | 계정 확인 |
| `gemini-3.5-flash-lite` | 1,048,576 | 65,536 | 계정 확인 |
| `gemini-3.1-flash-lite` | 1,048,576 | 65,536 | 계정 확인 |

근거: [무료 가격표](https://ai.google.dev/gemini-api/docs/pricing), [3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash), [3.6 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash), [3.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), [3.1 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite).

2.5 Pro·Flash·Flash-Lite도 가격표에 무료 항목이 있지만, 현재 모델 안내는 **2.5를 실제 사용하던 사용자로 접근을 제한**한다고 명시한다. 신규 프로젝트 기본 후보에서는 제외한다. Gemini 4 Argon은 무료 티어가 없다. [모델 접근 안내](https://ai.google.dev/gemini-api/docs/models), [가격표](https://ai.google.dev/gemini-api/docs/pricing).

RPD 초기화는 미국 태평양 시간 자정이다. 한국 시간으로 서머타임에는 16시, 겨울에는 17시다. 과거 블로그의 고정 RPM/RPD를 현재 계정에 적용하면 안 된다. AI Studio에서 프로젝트·모델별 실제 한도를 확인해야 한다. 무료 기능에 Google Search/Maps 등 별도 도구까지 포함되는지는 모델별 가격표를 따로 확인한다. [공식 한도](https://ai.google.dev/gemini-api/docs/rate-limits).

무료 서비스의 입력·응답은 제품 개선에 사용될 수 있으므로 데이터 사용 조건을 확인한다. [Gemini 약관](https://ai.google.dev/gemini-api/terms).

## 4. Groq: 공개된 무료 모델별 한도

| 모델 ID | RPM | RPD | TPM | TPD | Context | 최대 출력 | 함수 호출 / 병렬 호출 |
|---|---:|---:|---:|---:|---:|---:|---|
| `openai/gpt-oss-120b` | 30 | 1,000 | 8,000 | 200,000 | 131,072 | 65,536 | 지원 / 미지원 |
| `openai/gpt-oss-20b` | 30 | 1,000 | 8,000 | 200,000 | 131,072 | 65,536 | 지원 / 미지원 |
| `qwen/qwen3.8-27b` | 30 | 1,000 | 8,000 | 200,000 | 131,072 | 16,384 | 지원 / 지원 |
| `openai/gpt-oss-safeguard-20b` | 3 | 1,000 | 2,000 | 200,000 | 131,072 | 65,536 | 지원 / 미지원 |

근거: [무료 한도 표](https://console.groq.com/docs/rate-limits), [모델 사양](https://console.groq.com/docs/models), [도구 지원표](https://console.groq.com/docs/tool-use/overview). gpt-oss는 여기서 Groq가 제공하는 모델이다. Safeguard는 안전성 분류 목적이므로 분석용 주력 후보에서 제외한다.

Qwen은 Preview이며 텍스트·이미지를 받는다. 이미지 최대 3개, 20MB 제한이 있다. [Qwen 사양](https://console.groq.com/docs/model/qwen/qwen3.8-27b).

추가 무료 항목 중 Prompt Guard 22M/86M은 각각 30 RPM·14,400 RPD·15,000 TPM·500,000 TPD지만 안전성 분류기다. Whisper 두 모델은 음성 인식용 20 RPM·2,000 RPD·오디오 7,200초/시간·28,800초/일이다. Orpheus 영어·사우디 아랍어는 음성 생성용 10 RPM·100 RPD다. 이 수치를 일반 분석 챗봇 처리량으로 계산하면 안 된다. [모델별 한도](https://console.groq.com/docs/rate-limits).

현재 모델 목록에서 Llama 3.1 8B·3.3 70B는 Enterprise 문의 대상으로 표시되어 이전의 무료 수치를 재사용하지 않았다. 실제 잔여량과 재시도 시점은 `x-ratelimit-*`·`retry-after` 응답 헤더를 따른다. [모델 목록](https://console.groq.com/docs/models), [헤더 설명](https://console.groq.com/docs/rate-limits).

## 5. OpenRouter: 현재 무료 텍스트 모델 목록

공개 모델 API에서 입력·출력 토큰 가격이 모두 0인 항목을 확인했다. 음악 생성 항목은 제외했다. **아래 모델 전체를 합쳐 20 RPM·50 RPD**이며, 모델별 50회가 아니다. 공급자 가용성에 따라 추가 제한·실패가 생길 수 있다.

| 정확한 모델 ID | Context | 최대 출력 | 도구 호출 |
|---|---:|---:|---|
| `nvidia/nemotron-3.5-super-vl:free` | 1,000,000 | 131,072 | 지원 |
| `dots-studio/dots-3-note-preview:free` | 512,000 | 460,800 | 지원 |
| `liquid/lfm-2.5-2.6b:free` | 65,536 | 8,192 | 지원 |
| `nvidia/nemotron-3.5-lightning:free` | 1,000,000 | 65,536 | 지원 |
| `thinkingmachines/inkling-small:free` | 1,048,576 | 262,144 | 지원 |
| `poolside/laguna-s-2.1:free` | 262,144 | 32,768 | 지원 |
| `thinkingmachines/inkling:free` | 1,048,576 | 262,144 | 지원 |
| `poolside/laguna-xs-2.1:free` | 262,144 | 32,768 | 지원 |
| `cohere/north-mini-code:free` | 256,000 | 64,000 | 지원 |
| `nvidia/nemotron-3.5-content-safety:free` | 128,000 | 8,192 | 카탈로그 지원 표시 없음 |
| `nvidia/nemotron-3-ultra-550b-a55b:free` | 1,000,000 | 65,536 | 지원 |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | 256,000 | 65,536 | 지원 |
| `google/gemma-4-26b-a4b-it:free` | 262,144 | 32,768 | 지원 |
| `google/gemma-4-31b-it:free` | 262,144 | 32,768 | 지원 |
| `nvidia/nemotron-3-super-120b-a12b:free` | 262,144 | 235,929 | 지원 |
| `openrouter/free` | 선택 모델에 따라 다름 | 선택 모델에 따라 다름 | 가능한 모델로 라우팅 |

근거: [실시간 공식 모델 카탈로그](https://openrouter.ai/api/v1/models), [계정 한도](https://openrouter.ai/docs/api_reference/limits). 카탈로그의 도구 지원은 실제 정확도를 보장하지 않는다. `openrouter/free`는 개별 모델이 아니라 라우터여서 재현성 평가에는 명시적 모델 ID가 낫다. Content Safety는 분석 주력 후보에서 제외한다.

모든 무료 항목이 구조화 출력을 같은 방식으로 지원하는 것은 아니다. 카탈로그의 `supported_parameters`에 tools와 structured_outputs/response_format이 있는지 각각 확인해야 한다. 요청당 한도 값이 null이라고 무제한으로 해석하면 안 된다.

## 6. Cohere: 월 1,000회 평가용

아래 Chat 모델은 20 RPM이다. 월 1,000 API 호출을 모델별로 각각 받는 것으로 계산하지 않는다. 별도의 공개 RPD·TPM·TPD는 확인되지 않았다. [평가 키 한도](https://docs.cohere.com/v2/docs/rate-limits).

| 모델 ID | Context | 최대 출력 | 적합한 시험 |
|---|---:|---:|---|
| `command-a-plus-05-2026` | 128k | 64k | 도구·추론·이미지 통합 |
| `command-a-03-2025` | 256k | 8k | 도구·RAG·다국어 |
| `command-a-reasoning-08-2025` | 256k | 32k | 다단계 추론 |
| `command-a-vision-07-2025` | 128k | 8k | 차트·이미지 해석 |
| `command-r-plus-08-2024` | 128k | 4k | 도구·RAG |
| `command-r-08-2024` | 128k | 4k | 도구·RAG |
| `command-r7b-12-2024` | 128k | 4k | 작은 모델의 도구 호출 |
| `north-mini-code-1-0` | 256k | 64k | 코딩 에이전트 |
| `command-a-translate-08-2025` | 8k | 8k | 번역, 분석 주력 후보 제외 |

사양 근거: [공식 모델 표](https://docs.cohere.com/v2/docs/models). k 단위는 원문 표기를 유지했다. 모델별 언어 지원은 다르며 특히 Vision의 한국어 성능은 별도 검증 대상이다.

4회 호출/분석을 가정하면 월 최대 250개 분석에 해당한다. 하루 약 8개는 30일로 나눈 계획상 평균이며 일일 보장량이 아니다. Embed·Rerank 등 다른 평가 API를 쓰면 월 한도도 함께 확인한다.

## 7. Cloudflare: 요청 수 대신 연산량으로 계산

매일 계정에 10,000 neurons가 제공되며 UTC 자정, 한국 시간 오전 9시에 초기화된다. 무료 플랜은 소진 후 중단된다. 유료 플랜에서는 초과 사용이 과금될 수 있다. 일부 최신 프리미엄 모델은 무료 할당량과 별개로 유료 이용 조건이 있으므로 전체 카탈로그를 무료라고 보면 안 된다. [가격·모델별 조건](https://developers.cloudflare.com/workers-ai/platform/pricing/).

아래는 **입력 3,000 + 출력 1,000토큰/호출** 가정으로 직접 계산한 추정 상한이다. 서비스가 보장하는 요청 횟수가 아니다.

| 모델 ID | 입력 100만 토큰당 neurons | 출력 100만 토큰당 neurons | 호출당 계산 | 일일 호출 | 4회/분석 |
|---|---:|---:|---:|---:|---:|
| `@cf/meta/llama-3.1-8b-instruct-fp8-fast` | 4,119 | 34,868 | 47.225 | 211 | 52개/일 |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 26,668 | 204,805 | 284.809 | 35 | 8개/일 |
| `@cf/mistralai/mistral-small-3.1-24b-instruct` | 31,876 | 50,488 | 146.116 | 68 | 17개/일 |

계산식: `호출당 neurons = 입력 토큰 × 입력 단가 / 1,000,000 + 출력 토큰 × 출력 단가 / 1,000,000`. 다른 작업의 사용량이 없고 재시도도 없다는 가정이다. 단가 근거는 [공식 가격표](https://developers.cloudflare.com/workers-ai/platform/pricing/).

70B 엔드포인트는 함수 호출을 지원하지만 제공되는 Context는 **24,000토큰**이다. 기반 모델의 일반 사양을 그대로 가져오면 안 된다. 다른 두 모델의 함수 호출·Context는 연결 전 각 엔드포인트에서 추가 확인한다. [70B 엔드포인트 사양](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/). 텍스트 생성 기본 빈도는 [300 RPM](https://developers.cloudflare.com/workers-ai/platform/limits/)이다.

## 8. Mistral·Hugging Face·Cerebras

### Mistral

카드 없이 시작하는 Free mode가 있지만, 정확한 모델별 RPS·TPM과 조직 월간 한도는 계정 Limits에서 확인한다. 과거 자료의 1 RPS 등 고정 수치를 현재 공통 한도로 인용하지 않았다. 어떤 모델이 무료 모드에서 열리는지도 계정에서 확인해야 한다. [가입 흐름](https://docs.mistral.ai/getting-started/quickstarts/developer/first-api-request), [한도 구조](https://docs.mistral.ai/admin/billing-usage/usage-limits).

### Hugging Face

무료 사용자는 월 $0.10의 Inference Providers 크레딧을 받는다. 요청 길이·모델·공급자 가격에 따라 호출 수가 달라지므로 RPD로 환산할 고정 숫자는 없다. 외부 공급자 키를 직접 연결하면 그 공급자의 별도 요금·한도를 따른다. 장기간 반복 개발보다 소규모 연결 시험에 적합하다는 판단이다. [가격 정책](https://huggingface.co/docs/inference-providers/en/pricing).

### Cerebras: 상시 무료와 구분

현재 문서는 **결제수단 확인 후 $5·30일 체험**을 안내한다. 크레딧 소진 또는 기간 만료 시 추가 구매 전까지 중단된다. 오래된 무료 티어 안내와 현재 체험 정책을 섞지 않았다. 아래 두 모델의 체험 한도는 5 RPM·비캐시 30,000 TPM·전체 90,000 TPM·1M TPH·1M TPD이며 RPD는 미공개다. [현재 한도](https://inference-docs.cerebras.ai/support/rate-limits).

| 모델 | 체험 Context | 도구 호출 | 비고 |
|---|---:|---|---|
| `gpt-oss-120b` | 공식 표 65k | 지원 | 유료 Context 131k와 구분 |
| `qwen-3.8-27b` | 공식 표 64k | 지원 | 유료 128k와 구분, 이미지 2개·요청 10MiB |

근거: [모델별 Context](https://inference-docs.cerebras.ai/models/overview), [함수 호출](https://inference-docs.cerebras.ai/capabilities/tool-use), [Qwen·체험 제한](https://inference-docs.cerebras.ai/support/rate-limits). 토큰 버킷이 지속 보충되는 방식이므로 일일 자정 일괄 리셋으로 가정하지 않는다. 실제 사용 가능량은 크레딧 잔액·요청 토큰 예약에도 제한된다.

## 9. 우리 에이전트의 하루 처리량

설계용 가정: 모델 호출당 한도에 집계되는 토큰 4,000개, 분석 1개당 모델 4회. 실제로는 누적 대화·추론·실패·재시도 때문에 더 소모될 수 있다.

| 선택지 | 계산 결과 | 해석 |
|---|---|---|
| Groq 주력 모델 하나 | min(1,000회, 200,000÷4,000)=50회/일 → 분석 12개 | 1,000 RPD보다 TPD가 먼저 제한 |
| OpenRouter 무결제 계정 | 50회/일 → 분석 12개 | 전체 무료 모델 공유, 공급자 토큰 제한 추가 가능 |
| Cohere 평가 | 1,000회/월 → 분석 250개/월 | 일일 한도로 바꾸면 안 됨 |
| Cloudflare 8B | 위 입력·출력 가정에서 211회/일 → 분석 52개 | 모델 품질·도구 지원은 별도 검증 |
| Cloudflare 70B | 35회/일 → 분석 8개 | 도구 호출 지원 확인 |
| Gemini Flash / Flash-Lite | 사용자 보고 RPD 기준 각각 분석 5개/일·125개/일 | 공식 공통 보장·우리 계정 검증값과 구분, 3절 참조 |

Groq의 8,000 TPM에서 호출당 4,000토큰이면 장기 평균 약 2회/분이 토큰 예산에 해당한다. 30 RPM만 보고 2초마다 요청하는 설계는 맞지 않는다. 순간 허용량은 서버 집계 방식·요청 예약량에 따라 달라진다.

원인 분석 4회 + 예산 제안 4회로 전체 데모에 모델을 8회 호출한다면 Groq 단일 모델의 위 가정상 전체 데모는 약 6개/일이다. 시뮬레이션의 수치 계산을 Python이 수행하고 LLM이 도구 선택·설명에만 관여하면 호출과 토큰을 줄일 여지가 있다. 이는 설계 추정이며 실제 로그로 수정해야 한다.

## 10. 구현 전에 확정할 항목

1. Gemini AI Studio에서 모델별 RPM·입력 TPM·RPD와 무료 티어 상태를 기록한다.
2. Groq는 응답 헤더, OpenRouter는 키의 무료 일일 잔여량, Cloudflare는 neurons 사용량으로 실제 한도를 추적한다.
3. 동일한 소수의 질문으로 한국어 설명·함수 인자 정확도·근거 인용·연속 도구 호출을 비교한다. 무료 제공 여부가 품질 우위를 뜻하지 않는다.
4. 입력/출력/추론 토큰, 모델 호출 수, 재시도, 한도 오류를 분석 실행별로 기록한다.
5. 한도 오류 때는 대기 또는 명시된 대체 모델로 전환한다. 승인 대기 중인 Ads 실행을 자동 재전송하는 방식은 피하고 실행 상태를 먼저 확인한다.

우선순위 제안은 **Gemini Flash-Lite 계정 한도 확인 → Flash-Lite·Flash·Groq의 동일 질문 비교 → 부족할 때 OpenRouter·Cloudflare 추가**다. 여덟 공급자를 처음부터 모두 연결할 필요는 없다.
