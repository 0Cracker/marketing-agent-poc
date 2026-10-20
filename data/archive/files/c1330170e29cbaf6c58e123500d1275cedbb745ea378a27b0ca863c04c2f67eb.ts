// Fixed authored content. Generated offline by scripts/author-demo.mjs; no runtime analysis or data access.
export type DemoCase = {
 decision:{kind:string;title:string;risk:string;reason:string;rule:string;alternative:string;resource:string;timeline:string;success:string;stop:string;followup:string;why:string;tasks:{owner:string;due:string;action:string;inputs:string;done:string}[]};
 proof:{name:string;source:string;beforeA:number;beforeB:number;currentA:number|null;currentB:number|null;beforeShare:number;currentShare:number|null;weight:number;contribution:number|null;formula:string}[];
 process:{title:string;detail:string}[];chronology:string;
 id:string;name:string;focus:string;tag:string;raw:(number|null)[];review:number[];peerReviews:number;spend:number;
 headline:string;observation:string;claim:string;support:string;counter:string;alternative:string;actions:string[];
 responses:Record<'lookup'|'diagnosis'|'action',{question:string;title:string;conclusion:string}>;
 topics:(string|number)[][];event:string;context:string;period:string;comparison:string;
 baseline:number[];current:number|null;shares:(number|null)[];contributions:(number|null)[];
 history:{month:string;raw:(number|null)[];shares:(number|null)[];cti:number|null}[];
 channels:{name:string;beforeSpend:number;spend:number;beforeImpressions:number;impressions:number|null}[];
 reviewBaseline:number[];baselinePeerReviews:number;
 budget:null|{total:number;currentCti:number;currentM:number;competitorImpressions:number;expectedImpressions:number;expectedM:number;expectedCti:number;assumption:string;curves:({budget:number}&Record<string,number>)[];rows:{name:string;current:number;recommended:number;min:number;max:number;k:number;q:number;currentImpressions:number;expectedImpressions:number}[]};
};
export const demoCases: DemoCase[] = [
  {
    "id": "A",
    "name": "리뷰 경쟁력 하락",
    "focus": "review",
    "tag": "고객 경험",
    "raw": [
      5500,
      4500,
      450,
      550,
      5300,
      4700,
      450000,
      550000
    ],
    "review": [
      900,
      450,
      150,
      300,
      3.6
    ],
    "peerReviews": 1000,
    "spend": 10000000,
    "headline": "리뷰 경쟁력 약화가 CTI 하락에 가장 크게 기여했습니다.",
    "observation": "긍정 리뷰 점유율은 65%에서 45%로 하락했습니다. 광고 노출 점유율 하락도 함께 관측됩니다.",
    "claim": "제품 경험과 상대적 리뷰 경쟁력이 함께 약해졌을 가능성",
    "support": "자사 긍정률이 65%에서 50%로 낮아지고 평균 평점도 4.4에서 3.6으로 하락했습니다.",
    "counter": "리뷰 건수도 1,000건에서 900건으로 감소했습니다. 수집 범위와 플랫폼 구성 변화는 배제하지 못합니다.",
    "alternative": "경쟁사 긍정 리뷰 증가와 리뷰 수집 구성 변화도 상대 점유율 하락을 설명할 수 있습니다.",
    "actions": [
      "제품·CS 팀이 사용감 관련 불만을 확인하고 개선 과제를 먼저 정합니다.",
      "광고 노출 약화는 별도 예산 실험으로 검토하되, 광고로 제품 경험 문제가 해결된다고 가정하지 않습니다."
    ],
    "topics": [
      [
        "사용 후 건조함",
        35,
        120
      ],
      [
        "향에 대한 불만",
        20,
        65
      ],
      [
        "배송 불만",
        45,
        50
      ]
    ],
    "event": "8월부터 사용감 관련 불만이 증가한 가상 기록. CTI와의 동시 변화는 인과 증명이 아닙니다.",
    "decision": {
      "kind": "investigation",
      "title": "CS·제품팀의 고객 경험 조사 승인",
      "risk": "긍정 반응 감소와 사용감 불만 증가를 조기에 확인할 필요가 있습니다. 매출 위험의 크기는 아직 알 수 없습니다.",
      "reason": "긍정률 65→50%, 평점 4.4→3.6, 건조함 불만 35→120건이 함께 악화했습니다. 광고 이동보다 고객 경험 원인 확인이 우선입니다.",
      "rule": "데모의 검토 규칙: 긍정률 10%p 이상 하락과 평점 0.5점 이상 하락이 함께 나타나면 고객 경험 조사. CTI 단독 임계값으로 개입하지 않습니다.",
      "alternative": "현행 유지 시 사용감 불만의 원인을 확인하지 못합니다. 광고비를 옮겨도 제품·배송·수집 구성 문제를 해결한다는 근거가 없습니다.",
      "resource": "광고비 1,000만원 유지 · 기존 CS/제품팀 조사 배정 · 추가 지출 승인 없음",
      "timeline": "10/12 표본 확인 → 10/14 원인 후보 검토 → 10/16 개선·추가 조사 결정",
      "success": "50건의 조사 표본을 중복 제거하고 출처·사용 조건·구매 시점·제품 정보를 확인. 제품팀과 CS팀이 증거와 대안 설명을 포함한 개선/추가 조사 결론을 작성하면 완료입니다.",
      "stop": "플랫폼·기간별 수집 범위가 비교 불가능하거나 표본 출처가 확인되지 않으면 제품 결함 판단을 중단하고 데이터 검증으로 전환합니다.",
      "followup": "10/16 마케팅 책임자가 제품 개선 과제의 착수 여부를 결정합니다. 후기 2주 긍정률은 관찰하되 개선 효과의 인과 증명으로 사용하지 않습니다.",
      "tasks": [
        {
          "owner": "CS팀",
          "due": "10/12",
          "action": "9월 부정 리뷰 300건에서 가상 조사 표본 50건을 층화 추출",
          "inputs": "동일 플랫폼 4월/9월 리뷰, 고객 문의, 중복/구매 인증 정보",
          "done": "출처·사용 조건을 확인한 표본표와 미확인 항목 목록"
        },
        {
          "owner": "제품팀 + CS팀",
          "due": "10/14",
          "action": "건조함 불만 120건의 사용 조건과 제품 정보를 검토",
          "inputs": "사용 방법, 구매 시점, 제품 로트 정보 요청, 문의 기록",
          "done": "제품·사용법·배송·표본 구성별 근거와 반대 근거를 구분한 후보표"
        },
        {
          "owner": "마케팅 책임자",
          "due": "10/16",
          "action": "제품 개선 또는 추가 조사의 착수 범위 결정",
          "inputs": "후보표, 증거 누락 목록, 광고 운영 기록",
          "done": "담당 팀과 다음 검토일을 지정한 결정 메모"
        }
      ],
      "why": "긍정 리뷰는 구매 판단의 관련 단서가 될 수 있지만 이 데이터는 고객 이탈이나 매출 감소를 입증하지 않습니다. 그래서 판매 예측 대신 고객 경험 조사라는 낮은 비용의 검증 결정을 제안합니다."
    },
    "proof": [
      {
        "name": "검색 관심",
        "source": "A-202604 / A-202609 · 검색 관심",
        "beforeA": 6000,
        "beforeB": 4000,
        "currentA": 5500,
        "currentB": 4500,
        "beforeShare": 60,
        "currentShare": 55,
        "weight": 0.35,
        "contribution": -1.75,
        "formula": "5,500 ÷ (5,500 + 4,500) × 100 = 55%; (55 − 60) × 0.35 = -1.75pt"
      },
      {
        "name": "긍정 리뷰",
        "source": "A-202604 / A-202609 · 긍정 리뷰",
        "beforeA": 650,
        "beforeB": 350,
        "currentA": 450,
        "currentB": 550,
        "beforeShare": 65,
        "currentShare": 45,
        "weight": 0.25,
        "contribution": -5,
        "formula": "450 ÷ (450 + 550) × 100 = 45%; (45 − 65) × 0.25 = -5pt"
      },
      {
        "name": "디지털 참여",
        "source": "A-202604 / A-202609 · 디지털 참여",
        "beforeA": 5500,
        "beforeB": 4500,
        "currentA": 5300,
        "currentB": 4700,
        "beforeShare": 55,
        "currentShare": 53,
        "weight": 0.2,
        "contribution": -0.4,
        "formula": "5,300 ÷ (5,300 + 4,700) × 100 = 53%; (53 − 55) × 0.2 = -0.4pt"
      },
      {
        "name": "광고 노출",
        "source": "A-202604 / A-202609 · 광고 노출",
        "beforeA": 600000,
        "beforeB": 400000,
        "currentA": 450000,
        "currentB": 550000,
        "beforeShare": 60,
        "currentShare": 45,
        "weight": 0.2,
        "contribution": -3,
        "formula": "450,000 ÷ (450,000 + 550,000) × 100 = 45%; (45 − 60) × 0.2 = -3pt"
      }
    ],
    "process": [
      {
        "title": "비교 범위와 품질 확인",
        "detail": "일본·헤어케어·A/B·4월 대비 9월·동일 수집 기준이라는 시연 가정으로 비교합니다. 네 구성요소의 원천값이 존재하고 리뷰 감성 합계와 채널 노출 합계를 대사했습니다."
      },
      {
        "title": "원천값 → 상대 비중 → 가중 기여도",
        "detail": "각 A/(A+B) 비중의 전후 차이에 고정 가중치를 곱합니다. 네 기여도의 합 -10.15pt가 CTI 변화와 일치합니다."
      },
      {
        "title": "시점과 별도 근거 대조",
        "detail": "검색·노출 약화는 5월부터, 리뷰 악화는 8월부터입니다. 사용감 불만의 시작 시점은 리뷰 변화와 일치하지만 앞선 검색·노출 변화 전체를 설명하지 못합니다."
      },
      {
        "title": "관측과 원인 가설 구별",
        "detail": "긍정 리뷰는 구매 판단의 관련 단서가 될 수 있지만 이 데이터는 고객 이탈이나 매출 감소를 입증하지 않습니다. 그래서 판매 예측 대신 고객 경험 조사라는 낮은 비용의 검증 결정을 제안합니다."
      },
      {
        "title": "검증할 결정 선택",
        "detail": "긍정률 65→50%, 평점 4.4→3.6, 건조함 불만 35→120건이 함께 악화했습니다. 광고 이동보다 고객 경험 원인 확인이 우선입니다. 현행 유지 시 사용감 불만의 원인을 확인하지 못합니다. 광고비를 옮겨도 제품·배송·수집 구성 문제를 해결한다는 근거가 없습니다."
      }
    ],
    "chronology": "검색·노출 약화는 5월부터, 리뷰 악화는 8월부터입니다. 사용감 불만의 시작 시점은 리뷰 변화와 일치하지만 앞선 검색·노출 변화 전체를 설명하지 못합니다.",
    "responses": {
      "lookup": {
        "question": "제품 A의 CTI 현황을 보여줘.",
        "title": "CTI 현황",
        "conclusion": "CTI는 60.25 → 50.10pt, -10.15pt 변했습니다."
      },
      "diagnosis": {
        "question": "제품 A의 CTI 변화 원인을 분석해 줘.",
        "title": "리뷰 경쟁력 하락 분석",
        "conclusion": "리뷰 경쟁력 약화가 CTI 하락에 가장 크게 기여했습니다."
      },
      "action": {
        "question": "제품 A의 CTI 개선을 위해 무엇을 해야 해?",
        "title": "실행 결정",
        "conclusion": "긍정률 65→50%, 평점 4.4→3.6, 건조함 불만 35→120건이 함께 악화했습니다. 광고 이동보다 고객 경험 원인 확인이 우선입니다."
      }
    },
    "context": "일본 / 헤어케어 / 제품 A vs B",
    "period": "2026년 4월–9월",
    "comparison": "2026년 4월 대비 9월",
    "baseline": [
      6000,
      4000,
      650,
      350,
      5500,
      4500,
      600000,
      400000
    ],
    "current": 50.1,
    "shares": [
      55,
      45,
      53,
      45
    ],
    "contributions": [
      -1.75,
      -5,
      -0.4,
      -3
    ],
    "history": [
      {
        "month": "4월",
        "raw": [
          6000,
          4000,
          650,
          350,
          5500,
          4500,
          600000,
          400000
        ],
        "shares": [
          60,
          65,
          55,
          60
        ],
        "cti": 60.25
      },
      {
        "month": "5월",
        "raw": [
          5960,
          4040,
          650,
          350,
          5500,
          4500,
          588000,
          412000
        ],
        "shares": [
          59.6,
          65,
          55,
          58.8
        ],
        "cti": 59.87
      },
      {
        "month": "6월",
        "raw": [
          5900,
          4100,
          650,
          350,
          5500,
          4500,
          570000,
          430000
        ],
        "shares": [
          59,
          65,
          55,
          57
        ],
        "cti": 59.3
      },
      {
        "month": "7월",
        "raw": [
          5800,
          4200,
          650,
          350,
          5480,
          4520,
          540000,
          460000
        ],
        "shares": [
          58,
          65,
          54.8,
          54
        ],
        "cti": 58.31
      },
      {
        "month": "8월",
        "raw": [
          5650,
          4350,
          530,
          470,
          5400,
          4600,
          495000,
          505000
        ],
        "shares": [
          56.5,
          53,
          54,
          49.5
        ],
        "cti": 53.725
      },
      {
        "month": "9월",
        "raw": [
          5500,
          4500,
          450,
          550,
          5300,
          4700,
          450000,
          550000
        ],
        "shares": [
          55,
          45,
          53,
          45
        ],
        "cti": 50.1
      }
    ],
    "channels": [
      {
        "name": "Google 검색",
        "beforeSpend": 4000000,
        "spend": 4000000,
        "beforeImpressions": 180000,
        "impressions": 135000
      },
      {
        "name": "Meta",
        "beforeSpend": 3000000,
        "spend": 3000000,
        "beforeImpressions": 270000,
        "impressions": 202500
      },
      {
        "name": "YouTube",
        "beforeSpend": 2000000,
        "spend": 2000000,
        "beforeImpressions": 90000,
        "impressions": 67500
      },
      {
        "name": "기타",
        "beforeSpend": 1000000,
        "spend": 1000000,
        "beforeImpressions": 60000,
        "impressions": 45000
      }
    ],
    "budget": {
      "total": 10000000,
      "currentCti": 50.1,
      "currentM": 45,
      "competitorImpressions": 550000,
      "rows": [
        {
          "name": "Google 검색",
          "current": 4000000,
          "recommended": 4000000,
          "min": 500000,
          "max": 6000000,
          "k": 2000000,
          "q": 122882.29559462306,
          "currentImpressions": 135000,
          "expectedImpressions": 135000
        },
        {
          "name": "Meta",
          "current": 3000000,
          "recommended": 3000000,
          "min": 500000,
          "max": 6000000,
          "k": 2000000,
          "q": 220999.7252573015,
          "currentImpressions": 202500,
          "expectedImpressions": 202500
        },
        {
          "name": "YouTube",
          "current": 2000000,
          "recommended": 2000000,
          "min": 500000,
          "max": 6000000,
          "k": 2000000,
          "q": 97381.91526000503,
          "currentImpressions": 67500,
          "expectedImpressions": 67500
        },
        {
          "name": "기타",
          "current": 1000000,
          "recommended": 1000000,
          "min": 500000,
          "max": 6000000,
          "k": 2000000,
          "q": 110983.65580693942,
          "currentImpressions": 45000,
          "expectedImpressions": 45000
        }
      ],
      "curves": [
        {
          "budget": 0,
          "Google 검색": 0,
          "Meta": 0,
          "YouTube": 0,
          "기타": 0
        },
        {
          "budget": 1000000,
          "Google 검색": 49824.483267853255,
          "Meta": 89607.67749332638,
          "YouTube": 39484.96879867804,
          "기타": 45000
        },
        {
          "budget": 2000000,
          "Google 검색": 85175.51673214676,
          "Meta": 153185.33646662105,
          "YouTube": 67500,
          "기타": 76928.00811081546
        },
        {
          "budget": 3000000,
          "Google 검색": 112595.90856477343,
          "Meta": 202500,
          "YouTube": 89230.14640489696,
          "기타": 101693.29520540984
        },
        {
          "budget": 4000000,
          "Google 검색": 135000,
          "Meta": 242793.01395994742,
          "YouTube": 106984.96879867803,
          "기타": 121928.00811081544
        },
        {
          "budget": 5000000,
          "Google 검색": 153942.38940464528,
          "Meta": 276860.2718499978,
          "YouTube": 121996.45723888828,
          "기타": 139036.21410316962
        },
        {
          "budget": 6000000,
          "Google 검색": 170351.03346429352,
          "Meta": 306370.6729332421,
          "YouTube": 135000,
          "기타": 153856.0162216309
        }
      ],
      "expectedImpressions": 450000,
      "expectedM": 45,
      "expectedCti": 50.1,
      "assumption": "다음 달에도 현재 경쟁사 노출과 S/R/E가 유지된다는 가정입니다. 곡선은 관측값에 기준점을 맞춘 모의 함수입니다."
    },
    "reviewBaseline": [
      1000,
      650,
      200,
      150,
      4.4
    ],
    "baselinePeerReviews": 700
  },
  {
    "id": "B",
    "name": "경쟁사 급성장",
    "focus": "competitor",
    "tag": "상대 경쟁력",
    "raw": [
      6000,
      8000,
      650,
      700,
      5500,
      9000,
      600000,
      800000
    ],
    "review": [
      1000,
      650,
      200,
      150,
      4.4
    ],
    "peerReviews": 2000,
    "spend": 10000000,
    "headline": "자사 절대 실적은 유지됐지만, 경쟁사 성장으로 상대 점유율이 낮아졌습니다.",
    "observation": "자사 검색·긍정 리뷰·참여·광고 노출은 모두 유지됐습니다. 경쟁사 원천값은 각각 두 배가 됐습니다.",
    "claim": "경쟁사 디지털 접점 확대가 상대적 열위와 관련됐을 가능성",
    "support": "자사 긍정률 65%와 평점 4.4가 유지되는 동안 경쟁사 긍정 리뷰는 350→700건으로 증가했습니다.",
    "counter": "경쟁사 성장 자체가 자사 고객 이탈이나 제품 품질 저하를 증명하지는 않습니다. 자사 절대 실적은 감소하지 않았습니다.",
    "alternative": "경쟁사 측정 커버리지 확대나 신제품 초기 관심도 같은 요인을 추가로 확인해야 합니다.",
    "actions": [
      "경쟁사 캠페인·검색·리뷰 증가 구간을 비교해 차별화 메시지를 점검합니다.",
      "자사 고객 반응을 유지하면서 노출 경쟁력에 대한 제한된 예산안을 검토합니다."
    ],
    "topics": [
      [
        "사용 후 건조함",
        35,
        35
      ],
      [
        "향에 대한 불만",
        20,
        20
      ],
      [
        "배송 불만",
        45,
        45
      ]
    ],
    "event": "경쟁사 B가 7월 신제품 캠페인을 시작한 가상 기록. 캠페인의 인과 효과는 확인되지 않았습니다.",
    "decision": {
      "kind": "investigation",
      "title": "경쟁사 활동 비교 조사 · 자사 예산 유지",
      "risk": "자사 지표가 안정적이어도 경쟁군 내 주목도가 뒤처질 수 있습니다. 고객 이탈 여부는 별도 확인이 필요합니다.",
      "reason": "자사 네 원천값과 긍정률·평점은 그대로이고 경쟁사 네 원천값이 두 배입니다. 자사 품질 악화 대응을 먼저 할 근거가 없습니다.",
      "rule": "데모 검토 규칙: 자사 절대값 유지 + 경쟁사 지표 확대 시 경쟁 활동·수집 범위를 비교. CTI 하락만으로 예산 확대하지 않습니다.",
      "alternative": "즉시 광고 확대는 경쟁사 성장이 수집 범위 변화인지 캠페인 영향인지 구분하지 못한 채 비용을 늘립니다.",
      "resource": "광고비 1,000만원 유지 · 마케팅 전략팀 조사",
      "timeline": "10/13 경쟁사 기록 확인 → 10/16 메시지 테스트 여부 결정",
      "success": "경쟁사 7월 캠페인·신제품·수집 범위를 월별 지표와 대조하고 자사 메시지 공백 후보와 반대 근거를 정리합니다.",
      "stop": "경쟁사 수집 범위가 확대된 것으로 확인되면 성장 해석을 보류하고 동일 범위로 비교합니다.",
      "followup": "마케팅 책임자가 차별화 메시지 테스트를 별도 승인합니다. 구매·이탈 변화가 확인되기 전 전체 예산은 유지합니다.",
      "tasks": [
        {
          "owner": "마케팅 전략팀",
          "due": "10/13",
          "action": "7월 경쟁사 캠페인과 지표 확대 구간 대조",
          "inputs": "공개 캠페인 기록, 월별 자사/경쟁사 원천값, 수집 범위 기록",
          "done": "실제 활동 변화와 측정 변화가 구분된 비교표"
        },
        {
          "owner": "브랜드팀",
          "due": "10/16",
          "action": "차별화 메시지 테스트 필요성 검토",
          "inputs": "경쟁 비교표, 자사 메시지·제품 차별점",
          "done": "현행 유지 또는 별도 테스트 제안 결정"
        }
      ],
      "why": "분모인 경쟁사 값이 커져 자사의 상대 비중이 낮아진 사례입니다. 자사의 고객 경험이 나빠졌다고 단정하는 대신 경쟁 환경 대응 여부를 검토합니다."
    },
    "proof": [
      {
        "name": "검색 관심",
        "source": "B-202604 / B-202609 · 검색 관심",
        "beforeA": 6000,
        "beforeB": 4000,
        "currentA": 6000,
        "currentB": 8000,
        "beforeShare": 60,
        "currentShare": 42.857142857142854,
        "weight": 0.35,
        "contribution": -6.000000000000001,
        "formula": "6,000 ÷ (6,000 + 8,000) × 100 = 42.86%; (42.86 − 60) × 0.35 = -6pt"
      },
      {
        "name": "긍정 리뷰",
        "source": "B-202604 / B-202609 · 긍정 리뷰",
        "beforeA": 650,
        "beforeB": 350,
        "currentA": 650,
        "currentB": 700,
        "beforeShare": 65,
        "currentShare": 48.148148148148145,
        "weight": 0.25,
        "contribution": -4.212962962962964,
        "formula": "650 ÷ (650 + 700) × 100 = 48.15%; (48.15 − 65) × 0.25 = -4.21pt"
      },
      {
        "name": "디지털 참여",
        "source": "B-202604 / B-202609 · 디지털 참여",
        "beforeA": 5500,
        "beforeB": 4500,
        "currentA": 5500,
        "currentB": 9000,
        "beforeShare": 55,
        "currentShare": 37.93103448275862,
        "weight": 0.2,
        "contribution": -3.4137931034482762,
        "formula": "5,500 ÷ (5,500 + 9,000) × 100 = 37.93%; (37.93 − 55) × 0.2 = -3.41pt"
      },
      {
        "name": "광고 노출",
        "source": "B-202604 / B-202609 · 광고 노출",
        "beforeA": 600000,
        "beforeB": 400000,
        "currentA": 600000,
        "currentB": 800000,
        "beforeShare": 60,
        "currentShare": 42.857142857142854,
        "weight": 0.2,
        "contribution": -3.4285714285714293,
        "formula": "600,000 ÷ (600,000 + 800,000) × 100 = 42.86%; (42.86 − 60) × 0.2 = -3.43pt"
      }
    ],
    "process": [
      {
        "title": "비교 범위와 품질 확인",
        "detail": "일본·헤어케어·A/B·4월 대비 9월·동일 수집 기준이라는 시연 가정으로 비교합니다. 네 구성요소의 원천값이 존재하고 리뷰 감성 합계와 채널 노출 합계를 대사했습니다."
      },
      {
        "title": "원천값 → 상대 비중 → 가중 기여도",
        "detail": "각 A/(A+B) 비중의 전후 차이에 고정 가중치를 곱합니다. 네 기여도의 합 -17.06pt가 CTI 변화와 일치합니다."
      },
      {
        "title": "시점과 별도 근거 대조",
        "detail": "4–6월은 원천값 유지, 경쟁사 캠페인이 시작된 7월부터 경쟁사 값이 확대됩니다. 시점 일치는 캠페인 인과 효과의 증명이 아닙니다."
      },
      {
        "title": "관측과 원인 가설 구별",
        "detail": "분모인 경쟁사 값이 커져 자사의 상대 비중이 낮아진 사례입니다. 자사의 고객 경험이 나빠졌다고 단정하는 대신 경쟁 환경 대응 여부를 검토합니다."
      },
      {
        "title": "검증할 결정 선택",
        "detail": "자사 네 원천값과 긍정률·평점은 그대로이고 경쟁사 네 원천값이 두 배입니다. 자사 품질 악화 대응을 먼저 할 근거가 없습니다. 즉시 광고 확대는 경쟁사 성장이 수집 범위 변화인지 캠페인 영향인지 구분하지 못한 채 비용을 늘립니다."
      }
    ],
    "chronology": "4–6월은 원천값 유지, 경쟁사 캠페인이 시작된 7월부터 경쟁사 값이 확대됩니다. 시점 일치는 캠페인 인과 효과의 증명이 아닙니다.",
    "responses": {
      "lookup": {
        "question": "제품 A의 CTI 현황을 보여줘.",
        "title": "CTI 현황",
        "conclusion": "CTI는 60.25 → 43.19pt, -17.06pt 변했습니다."
      },
      "diagnosis": {
        "question": "제품 A의 CTI 변화 원인을 분석해 줘.",
        "title": "경쟁사 급성장 분석",
        "conclusion": "자사 절대 실적은 유지됐지만, 경쟁사 성장으로 상대 점유율이 낮아졌습니다."
      },
      "action": {
        "question": "제품 A의 CTI 개선을 위해 무엇을 해야 해?",
        "title": "실행 결정",
        "conclusion": "자사 네 원천값과 긍정률·평점은 그대로이고 경쟁사 네 원천값이 두 배입니다. 자사 품질 악화 대응을 먼저 할 근거가 없습니다."
      }
    },
    "context": "일본 / 헤어케어 / 제품 A vs B",
    "period": "2026년 4월–9월",
    "comparison": "2026년 4월 대비 9월",
    "baseline": [
      6000,
      4000,
      650,
      350,
      5500,
      4500,
      600000,
      400000
    ],
    "current": 43.19467250501733,
    "shares": [
      42.857142857142854,
      48.148148148148145,
      37.93103448275862,
      42.857142857142854
    ],
    "contributions": [
      -6.000000000000001,
      -4.212962962962964,
      -3.4137931034482762,
      -3.4285714285714293
    ],
    "history": [
      {
        "month": "4월",
        "raw": [
          6000,
          4000,
          650,
          350,
          5500,
          4500,
          600000,
          400000
        ],
        "shares": [
          60,
          65,
          55,
          60
        ],
        "cti": 60.25
      },
      {
        "month": "5월",
        "raw": [
          6000,
          4000,
          650,
          350,
          5500,
          4500,
          600000,
          400000
        ],
        "shares": [
          60,
          65,
          55,
          60
        ],
        "cti": 60.25
      },
      {
        "month": "6월",
        "raw": [
          6000,
          4000,
          650,
          350,
          5500,
          4500,
          600000,
          400000
        ],
        "shares": [
          60,
          65,
          55,
          60
        ],
        "cti": 60.25
      },
      {
        "month": "7월",
        "raw": [
          6000,
          5000,
          650,
          438,
          5500,
          5625,
          600000,
          500000
        ],
        "shares": [
          54.54545454545455,
          59.74264705882353,
          49.438202247191015,
          54.54545454545455
        ],
        "cti": 54.82330221414408
      },
      {
        "month": "8월",
        "raw": [
          6000,
          6600,
          650,
          578,
          5500,
          7425,
          600000,
          660000
        ],
        "shares": [
          47.61904761904762,
          52.931596091205215,
          42.5531914893617,
          47.61904761904762
        ],
        "cti": 47.934013511149836
      },
      {
        "month": "9월",
        "raw": [
          6000,
          8000,
          650,
          700,
          5500,
          9000,
          600000,
          800000
        ],
        "shares": [
          42.857142857142854,
          48.148148148148145,
          37.93103448275862,
          42.857142857142854
        ],
        "cti": 43.19467250501733
      }
    ],
    "channels": [
      {
        "name": "Google 검색",
        "beforeSpend": 4000000,
        "spend": 4000000,
        "beforeImpressions": 180000,
        "impressions": 180000
      },
      {
        "name": "Meta",
        "beforeSpend": 3000000,
        "spend": 3000000,
        "beforeImpressions": 270000,
        "impressions": 270000
      },
      {
        "name": "YouTube",
        "beforeSpend": 2000000,
        "spend": 2000000,
        "beforeImpressions": 90000,
        "impressions": 90000
      },
      {
        "name": "기타",
        "beforeSpend": 1000000,
        "spend": 1000000,
        "beforeImpressions": 60000,
        "impressions": 60000
      }
    ],
    "budget": {
      "total": 10000000,
      "currentCti": 43.19467250501733,
      "currentM": 42.857142857142854,
      "competitorImpressions": 800000,
      "rows": [
        {
          "name": "Google 검색",
          "current": 4000000,
          "recommended": 4000000,
          "min": 500000,
          "max": 6000000,
          "k": 2000000,
          "q": 163843.06079283074,
          "currentImpressions": 180000,
          "expectedImpressions": 180000
        },
        {
          "name": "Meta",
          "current": 3000000,
          "recommended": 3000000,
          "min": 500000,
          "max": 6000000,
          "k": 2000000,
          "q": 294666.30034306867,
          "currentImpressions": 270000,
          "expectedImpressions": 270000
        },
        {
          "name": "YouTube",
          "current": 2000000,
          "recommended": 2000000,
          "min": 500000,
          "max": 6000000,
          "k": 2000000,
          "q": 129842.5536800067,
          "currentImpressions": 90000,
          "expectedImpressions": 90000
        },
        {
          "name": "기타",
          "current": 1000000,
          "recommended": 1000000,
          "min": 500000,
          "max": 6000000,
          "k": 2000000,
          "q": 147978.2077425859,
          "currentImpressions": 60000,
          "expectedImpressions": 59999.99999999999
        }
      ],
      "curves": [
        {
          "budget": 0,
          "Google 검색": 0,
          "Meta": 0,
          "YouTube": 0,
          "기타": 0
        },
        {
          "budget": 1000000,
          "Google 검색": 66432.64435713767,
          "Meta": 119476.90332443517,
          "YouTube": 52646.62506490406,
          "기타": 59999.99999999999
        },
        {
          "budget": 2000000,
          "Google 검색": 113567.35564286234,
          "Meta": 204247.1152888281,
          "YouTube": 90000,
          "기타": 102570.67748108727
        },
        {
          "budget": 3000000,
          "Google 검색": 150127.87808636457,
          "Meta": 270000,
          "YouTube": 118973.52853986261,
          "기타": 135591.0602738798
        },
        {
          "budget": 4000000,
          "Google 검색": 180000,
          "Meta": 323724.0186132632,
          "YouTube": 142646.62506490404,
          "기타": 162570.67748108724
        },
        {
          "budget": 5000000,
          "Google 검색": 205256.51920619368,
          "Meta": 369147.0291333304,
          "YouTube": 162661.94298518437,
          "기타": 185381.61880422616
        },
        {
          "budget": 6000000,
          "Google 검색": 227134.71128572468,
          "Meta": 408494.2305776562,
          "YouTube": 180000,
          "기타": 205141.35496217455
        }
      ],
      "expectedImpressions": 600000,
      "expectedM": 42.857142857142854,
      "expectedCti": 43.19467250501733,
      "assumption": "다음 달에도 현재 경쟁사 노출과 S/R/E가 유지된다는 가정입니다. 곡선은 관측값에 기준점을 맞춘 모의 함수입니다."
    },
    "reviewBaseline": [
      1000,
      650,
      200,
      150,
      4.4
    ],
    "baselinePeerReviews": 700
  },
  {
    "id": "C",
    "name": "광고비 증가·성과 하락",
    "focus": "media",
    "tag": "매체 효율",
    "raw": [
      5800,
      4200,
      650,
      350,
      5400,
      4600,
      450000,
      550000
    ],
    "review": [
      1000,
      650,
      200,
      150,
      4.4
    ],
    "peerReviews": 1000,
    "spend": 12000000,
    "headline": "지출은 늘었지만 노출은 감소했습니다. 구매 가능한 노출 효율을 먼저 점검해야 합니다.",
    "observation": "광고비는 20% 증가하고 노출은 25% 감소했습니다. 총 CPM은 약 60% 상승했습니다.",
    "claim": "광고 단가와 캠페인 운영 변화가 노출 경쟁력 약화와 관련됐을 가능성",
    "support": "광고비 1,000만→1,200만원, 노출 60만→45만회. CPM은 약 16,667→26,667원입니다.",
    "counter": "CPM만으로 경쟁 심화·소재 피로도·타기팅 실패 중 어느 것이 원인인지 구분할 수 없습니다. 리뷰는 안정적입니다.",
    "alternative": "캠페인 믹스·입찰·시즌·운영 중단 변화가 같은 현상을 설명할 수 있습니다.",
    "actions": [
      "채널·캠페인별 CPM과 운영 변경 기록을 비교합니다.",
      "가정된 노출 효율을 기준으로 예산 이동안을 검토하고 실제 효과는 별도 실험으로 확인합니다."
    ],
    "topics": [
      [
        "사용 후 건조함",
        35,
        35
      ],
      [
        "향에 대한 불만",
        20,
        20
      ],
      [
        "배송 불만",
        45,
        45
      ]
    ],
    "event": "8월 검색 입찰과 캠페인 믹스 변경·검색 지출 확대 기록. 운영 변화와 시점이 가까우나 인과는 미확립입니다.",
    "decision": {
      "kind": "experiment",
      "title": "현행안 대비 14일 광고 배분 실험 승인",
      "risk": "동일한 노출을 사는 데 드는 비용이 증가했습니다. 예산을 유지하더라도 노출 확보 효율을 검증할 필요가 있습니다.",
      "reason": "광고비 +20%, 노출 −25%로 CPM이 16,667→26,667원(+60%)입니다. 리뷰는 안정적이므로 매체 운영 점검과 제한된 비교 실험을 우선합니다.",
      "rule": "데모 검토 규칙: 광고비 증가와 노출 감소가 동시 발생하면 캠페인 믹스/운영을 점검한 뒤 실험. 구매 성과 지표 확보 전 확대 집행하지 않습니다.",
      "alternative": "현행 유지가 대조안입니다. 검색 200만원을 Meta·기타에 각 100만원 옮기는 안은 효율 검증 후보이며 최적안이 아닙니다.",
      "resource": "월간 총액 1,200만원 고정 · 추가 예산 0원 · 대조/실험 각 300만원 상한 · 잔여 600만원 현행 배분",
      "timeline": "10/12 계측·랜덤 분할 준비 → 10/13–10/26 14일 비교 → 10/27 판단",
      "success": "가상 승인 기준: 동시 무작위 비교에서 실험 셀 CPM이 대조 셀보다 10% 이상 낮고, CVR 감소의 95% 신뢰구간 하한이 −5% 상대변화보다 높으며 셀별 100건 이상 전환 확보. 이 데이터에는 클릭·전환이 없어 실행 전 계측 검증이 필요합니다.",
      "stop": "계측 누락 즉시 중단. 충분한 노출을 얻은 뒤 3일 연속 실험 CPM이 대조보다 15% 이상 높거나 비용 상한 초과 시 원복. 소재·대상·기간 비교 조건 불일치 시 판단 보류.",
      "followup": "10/27 퍼포먼스 책임자가 유지/원복/확대 여부를 결정합니다. 표본 부족 시 성공 판정 없이 보류합니다. 모의 CTI 상승은 성공 기준으로 쓰지 않습니다.",
      "tasks": [
        {
          "owner": "퍼포먼스팀 + 분석팀",
          "due": "10/12",
          "action": "클릭·전환 계측과 중복 없는 무작위 비교 셀 검증",
          "inputs": "8월 입찰·믹스 변경 기록, 소재·타기팅, 클릭·전환 이벤트",
          "done": "동시 대조/실험 셀, 동일 조건, 셀별 비용 300만원 상한을 정의한 계획"
        },
        {
          "owner": "매체 운영팀",
          "due": "10/13–10/26",
          "action": "현행 유지 대비 재배분 실험을 제한 집행",
          "inputs": "승인한 셀별 배분·운영 조건·중단 기준",
          "done": "매일 비용·노출·CPM·CVR·계측 상태 기록"
        },
        {
          "owner": "퍼포먼스 책임자",
          "due": "10/27",
          "action": "성공·중단·표본 부족 조건으로 유지/원복/보류 결정",
          "inputs": "14일 비교표와 불확실성",
          "done": "효과 검증 여부와 다음 배분 결정 메모"
        }
      ],
      "why": "CPM 상승은 계산으로 확인되지만 경쟁 심화·입찰·소재·대상 중 원인은 확정되지 않습니다. 한 점에 맞춘 모의 곡선은 후보안 비교에만 쓰고, 현행 유지 대비 실제 측정 실험으로 효과를 검증합니다."
    },
    "proof": [
      {
        "name": "검색 관심",
        "source": "C-202604 / C-202609 · 검색 관심",
        "beforeA": 6000,
        "beforeB": 4000,
        "currentA": 5800,
        "currentB": 4200,
        "beforeShare": 60,
        "currentShare": 58,
        "weight": 0.35,
        "contribution": -0.7,
        "formula": "5,800 ÷ (5,800 + 4,200) × 100 = 58%; (58 − 60) × 0.35 = -0.7pt"
      },
      {
        "name": "긍정 리뷰",
        "source": "C-202604 / C-202609 · 긍정 리뷰",
        "beforeA": 650,
        "beforeB": 350,
        "currentA": 650,
        "currentB": 350,
        "beforeShare": 65,
        "currentShare": 65,
        "weight": 0.25,
        "contribution": 0,
        "formula": "650 ÷ (650 + 350) × 100 = 65%; (65 − 65) × 0.25 = 0pt"
      },
      {
        "name": "디지털 참여",
        "source": "C-202604 / C-202609 · 디지털 참여",
        "beforeA": 5500,
        "beforeB": 4500,
        "currentA": 5400,
        "currentB": 4600,
        "beforeShare": 55,
        "currentShare": 54,
        "weight": 0.2,
        "contribution": -0.2,
        "formula": "5,400 ÷ (5,400 + 4,600) × 100 = 54%; (54 − 55) × 0.2 = -0.2pt"
      },
      {
        "name": "광고 노출",
        "source": "C-202604 / C-202609 · 광고 노출",
        "beforeA": 600000,
        "beforeB": 400000,
        "currentA": 450000,
        "currentB": 550000,
        "beforeShare": 60,
        "currentShare": 45,
        "weight": 0.2,
        "contribution": -3,
        "formula": "450,000 ÷ (450,000 + 550,000) × 100 = 45%; (45 − 60) × 0.2 = -3pt"
      }
    ],
    "process": [
      {
        "title": "비교 범위와 품질 확인",
        "detail": "일본·헤어케어·A/B·4월 대비 9월·동일 수집 기준이라는 시연 가정으로 비교합니다. 네 구성요소의 원천값이 존재하고 리뷰 감성 합계와 채널 노출 합계를 대사했습니다."
      },
      {
        "title": "원천값 → 상대 비중 → 가중 기여도",
        "detail": "각 A/(A+B) 비중의 전후 차이에 고정 가중치를 곱합니다. 네 기여도의 합 -3.9pt가 CTI 변화와 일치합니다."
      },
      {
        "title": "시점과 별도 근거 대조",
        "detail": "8월 입찰·캠페인 믹스 변경 구간부터 노출 감소를 작성했습니다. 전체 CPM의 전후 비교는 비용 효율 경고이며 특정 운영 변경의 인과 효과는 아닙니다."
      },
      {
        "title": "관측과 원인 가설 구별",
        "detail": "CPM 상승은 계산으로 확인되지만 경쟁 심화·입찰·소재·대상 중 원인은 확정되지 않습니다. 한 점에 맞춘 모의 곡선은 후보안 비교에만 쓰고, 현행 유지 대비 실제 측정 실험으로 효과를 검증합니다."
      },
      {
        "title": "검증할 결정 선택",
        "detail": "광고비 +20%, 노출 −25%로 CPM이 16,667→26,667원(+60%)입니다. 리뷰는 안정적이므로 매체 운영 점검과 제한된 비교 실험을 우선합니다. 현행 유지가 대조안입니다. 검색 200만원을 Meta·기타에 각 100만원 옮기는 안은 효율 검증 후보이며 최적안이 아닙니다."
      }
    ],
    "chronology": "8월 입찰·캠페인 믹스 변경 구간부터 노출 감소를 작성했습니다. 전체 CPM의 전후 비교는 비용 효율 경고이며 특정 운영 변경의 인과 효과는 아닙니다.",
    "responses": {
      "lookup": {
        "question": "제품 A의 CTI 현황을 보여줘.",
        "title": "CTI 현황",
        "conclusion": "CTI는 60.25 → 56.35pt, -3.90pt 변했습니다."
      },
      "diagnosis": {
        "question": "제품 A의 CTI 변화 원인을 분석해 줘.",
        "title": "광고비 증가·성과 하락 분석",
        "conclusion": "지출은 늘었지만 노출은 감소했습니다. 구매 가능한 노출 효율을 먼저 점검해야 합니다."
      },
      "action": {
        "question": "제품 A의 CTI 개선을 위해 무엇을 해야 해?",
        "title": "실행 결정",
        "conclusion": "광고비 +20%, 노출 −25%로 CPM이 16,667→26,667원(+60%)입니다. 리뷰는 안정적이므로 매체 운영 점검과 제한된 비교 실험을 우선합니다."
      }
    },
    "context": "일본 / 헤어케어 / 제품 A vs B",
    "period": "2026년 4월–9월",
    "comparison": "2026년 4월 대비 9월",
    "baseline": [
      6000,
      4000,
      650,
      350,
      5500,
      4500,
      600000,
      400000
    ],
    "current": 56.349999999999994,
    "shares": [
      58,
      65,
      54,
      45
    ],
    "contributions": [
      -0.7,
      0,
      -0.2,
      -3
    ],
    "history": [
      {
        "month": "4월",
        "raw": [
          6000,
          4000,
          650,
          350,
          5500,
          4500,
          600000,
          400000
        ],
        "shares": [
          60,
          65,
          55,
          60
        ],
        "cti": 60.25
      },
      {
        "month": "5월",
        "raw": [
          6000,
          4000,
          650,
          350,
          5500,
          4500,
          600000,
          400000
        ],
        "shares": [
          60,
          65,
          55,
          60
        ],
        "cti": 60.25
      },
      {
        "month": "6월",
        "raw": [
          5980,
          4020,
          650,
          350,
          5500,
          4500,
          600000,
          400000
        ],
        "shares": [
          59.8,
          65,
          55,
          60
        ],
        "cti": 60.17999999999999
      },
      {
        "month": "7월",
        "raw": [
          5960,
          4040,
          650,
          350,
          5490,
          4510,
          600000,
          400000
        ],
        "shares": [
          59.6,
          65,
          54.9,
          60
        ],
        "cti": 60.09
      },
      {
        "month": "8월",
        "raw": [
          5880,
          4120,
          650,
          350,
          5450,
          4550,
          502500,
          497500
        ],
        "shares": [
          58.8,
          65,
          54.5,
          50.25
        ],
        "cti": 57.78
      },
      {
        "month": "9월",
        "raw": [
          5800,
          4200,
          650,
          350,
          5400,
          4600,
          450000,
          550000
        ],
        "shares": [
          58,
          65,
          54,
          45
        ],
        "cti": 56.349999999999994
      }
    ],
    "channels": [
      {
        "name": "Google 검색",
        "beforeSpend": 4000000,
        "spend": 6000000,
        "beforeImpressions": 150000,
        "impressions": 112500
      },
      {
        "name": "Meta",
        "beforeSpend": 3000000,
        "spend": 3000000,
        "beforeImpressions": 270000,
        "impressions": 202500
      },
      {
        "name": "YouTube",
        "beforeSpend": 2000000,
        "spend": 2000000,
        "beforeImpressions": 90000,
        "impressions": 67500
      },
      {
        "name": "기타",
        "beforeSpend": 1000000,
        "spend": 1000000,
        "beforeImpressions": 90000,
        "impressions": 67500
      }
    ],
    "budget": {
      "total": 12000000,
      "currentCti": 56.349999999999994,
      "currentM": 45,
      "competitorImpressions": 550000,
      "rows": [
        {
          "name": "Google 검색",
          "current": 6000000,
          "recommended": 4000000,
          "min": 500000,
          "max": 6000000,
          "k": 2000000,
          "q": 81151.5960500042,
          "currentImpressions": 112500,
          "expectedImpressions": 89154.14066556504
        },
        {
          "name": "Meta",
          "current": 3000000,
          "recommended": 4000000,
          "min": 500000,
          "max": 6000000,
          "k": 2000000,
          "q": 220999.7252573015,
          "currentImpressions": 202500,
          "expectedImpressions": 242793.01395994742
        },
        {
          "name": "YouTube",
          "current": 2000000,
          "recommended": 2000000,
          "min": 500000,
          "max": 6000000,
          "k": 2000000,
          "q": 97381.91526000503,
          "currentImpressions": 67500,
          "expectedImpressions": 67500
        },
        {
          "name": "기타",
          "current": 1000000,
          "recommended": 2000000,
          "min": 500000,
          "max": 6000000,
          "k": 2000000,
          "q": 166475.48371040914,
          "currentImpressions": 67500,
          "expectedImpressions": 115392.0121662232
        }
      ],
      "curves": [
        {
          "budget": 0,
          "Google 검색": 0,
          "Meta": 0,
          "YouTube": 0,
          "기타": 0
        },
        {
          "budget": 1000000,
          "Google 검색": 32904.140665565035,
          "Meta": 89607.67749332638,
          "YouTube": 39484.96879867804,
          "기타": 67500
        },
        {
          "budget": 2000000,
          "Google 검색": 56250,
          "Meta": 153185.33646662105,
          "YouTube": 67500,
          "기타": 115392.0121662232
        },
        {
          "budget": 3000000,
          "Google 검색": 74358.45533741414,
          "Meta": 202500,
          "YouTube": 89230.14640489696,
          "기타": 152539.94280811478
        },
        {
          "budget": 4000000,
          "Google 검색": 89154.14066556504,
          "Meta": 242793.01395994742,
          "YouTube": 106984.96879867803,
          "기타": 182892.01216622317
        },
        {
          "budget": 5000000,
          "Google 검색": 101663.71436574025,
          "Meta": 276860.2718499978,
          "YouTube": 121996.45723888828,
          "기타": 208554.32115475443
        },
        {
          "budget": 6000000,
          "Google 검색": 112500,
          "Meta": 306370.6729332421,
          "YouTube": 135000,
          "기타": 230784.0243324464
        }
      ],
      "expectedImpressions": 514839.1667917356,
      "expectedM": 48.34900732876868,
      "expectedCti": 57.01980146575373,
      "assumption": "다음 달에도 현재 경쟁사 노출과 S/R/E가 유지된다는 가정입니다. 곡선은 관측값에 기준점을 맞춘 모의 함수입니다."
    },
    "reviewBaseline": [
      1000,
      650,
      200,
      150,
      4.4
    ],
    "baselinePeerReviews": 700
  },
  {
    "id": "D",
    "name": "복합 요인",
    "focus": "mixed",
    "tag": "상반된 변화",
    "raw": [
      6000,
      4000,
      400,
      600,
      5500,
      4500,
      750000,
      250000
    ],
    "review": [
      1000,
      400,
      250,
      350,
      3.5
    ],
    "peerReviews": 1000,
    "spend": 10000000,
    "headline": "광고 개선이 리뷰 하락을 일부 상쇄했지만, 전체 CTI는 하락했습니다.",
    "observation": "리뷰 기여도 −6.25pt와 광고 기여도 +3.00pt가 동시에 발생했습니다. 순변화는 −3.25pt입니다.",
    "claim": "고객 경험 약화가 광고 개선 효과를 상쇄했을 가능성",
    "support": "긍정률은 65→40%, 광고 노출 점유율은 60→75%입니다. 두 변화의 방향이 다릅니다.",
    "counter": "광고 노출은 개선됐지만 고유 도달·구매·수익 개선까지 확인된 것은 아닙니다.",
    "alternative": "리뷰 표본 구성 변화와 특정 고객군 불만 집중을 함께 확인해야 합니다.",
    "actions": [
      "리뷰 개선과 고객 대응을 우선하고 효과적인 광고 운영은 유지합니다.",
      "CTI 하락만으로 광고 예산 전체를 감축하지 않습니다. 추가 배분은 별도 가정으로 검토합니다."
    ],
    "topics": [
      [
        "사용 후 건조함",
        35,
        155
      ],
      [
        "향에 대한 불만",
        20,
        90
      ],
      [
        "배송 불만",
        45,
        45
      ]
    ],
    "event": "9월 자사 캠페인 노출 개선과 불만 증가가 동시 관측된 가상 기록.",
    "decision": {
      "kind": "investigation",
      "title": "리뷰 조사 승인 · 광고 배분 유지",
      "risk": "광고 노출 확대가 고객 반응 악화를 가릴 수 있습니다. 합계만 보면 필요한 고객 대응을 놓칠 수 있습니다.",
      "reason": "리뷰 −6.25pt, 노출 +3.00pt로 상쇄되어 CTI 순변화는 −3.25pt입니다. 리뷰 개선 조사와 광고 현행 유지를 분리합니다.",
      "rule": "데모 검토 규칙: 구성요소 방향이 반대이면 합계와 별도로 악화 항목 검토. CTI 하락을 광고 축소 근거로 사용하지 않습니다.",
      "alternative": "광고를 줄이면 이미 확보한 노출을 잃을 수 있고, 추가 광고 확대는 리뷰 문제를 해결한다는 근거가 없습니다.",
      "resource": "광고비 1,000만원·배분 유지 · CS/제품 조사",
      "timeline": "10/13 고객군 비교 → 10/16 개선 범위 결정",
      "success": "9월 불만 350건의 고객군·제품 조건·플랫폼 구성을 확인하고 캠페인 노출 확대와 리뷰 문제를 분리한 조사 결과 작성.",
      "stop": "노출과 리뷰의 대상 고객군이 연결되지 않으면 광고가 불만을 유발했다는 해석을 중단합니다.",
      "followup": "제품·CS 조사 결론에 따라 개선 과제를 결정합니다. 광고 확대/축소는 별도 사업 성과 검증 뒤 판단합니다.",
      "tasks": [
        {
          "owner": "CS팀 + 분석팀",
          "due": "10/13",
          "action": "9월 부정 리뷰의 고객군·제품·수집 구성 확인",
          "inputs": "리뷰 원문, 고객군·제품 정보, 9월 캠페인 운영 기록",
          "done": "광고 대상과 리뷰 표본의 연결 가능 여부를 명시한 비교표"
        },
        {
          "owner": "제품팀",
          "due": "10/16",
          "action": "불만 개선 또는 추가 조사 범위 결정",
          "inputs": "건조함 155건·향 90건의 근거와 비교표",
          "done": "개선 대상·추가 자료·담당 팀 결정"
        }
      ],
      "why": "같은 가중 합계 안에서 음수와 양수가 상쇄되는 사례입니다. 광고 노출 증가가 구매나 고객 만족 개선이라는 뜻은 아니므로 리뷰 조사와 매체 운영 판단을 분리합니다."
    },
    "proof": [
      {
        "name": "검색 관심",
        "source": "D-202604 / D-202609 · 검색 관심",
        "beforeA": 6000,
        "beforeB": 4000,
        "currentA": 6000,
        "currentB": 4000,
        "beforeShare": 60,
        "currentShare": 60,
        "weight": 0.35,
        "contribution": 0,
        "formula": "6,000 ÷ (6,000 + 4,000) × 100 = 60%; (60 − 60) × 0.35 = 0pt"
      },
      {
        "name": "긍정 리뷰",
        "source": "D-202604 / D-202609 · 긍정 리뷰",
        "beforeA": 650,
        "beforeB": 350,
        "currentA": 400,
        "currentB": 600,
        "beforeShare": 65,
        "currentShare": 40,
        "weight": 0.25,
        "contribution": -6.25,
        "formula": "400 ÷ (400 + 600) × 100 = 40%; (40 − 65) × 0.25 = -6.25pt"
      },
      {
        "name": "디지털 참여",
        "source": "D-202604 / D-202609 · 디지털 참여",
        "beforeA": 5500,
        "beforeB": 4500,
        "currentA": 5500,
        "currentB": 4500,
        "beforeShare": 55,
        "currentShare": 55,
        "weight": 0.2,
        "contribution": 0,
        "formula": "5,500 ÷ (5,500 + 4,500) × 100 = 55%; (55 − 55) × 0.2 = 0pt"
      },
      {
        "name": "광고 노출",
        "source": "D-202604 / D-202609 · 광고 노출",
        "beforeA": 600000,
        "beforeB": 400000,
        "currentA": 750000,
        "currentB": 250000,
        "beforeShare": 60,
        "currentShare": 75,
        "weight": 0.2,
        "contribution": 3,
        "formula": "750,000 ÷ (750,000 + 250,000) × 100 = 75%; (75 − 60) × 0.2 = 3pt"
      }
    ],
    "process": [
      {
        "title": "비교 범위와 품질 확인",
        "detail": "일본·헤어케어·A/B·4월 대비 9월·동일 수집 기준이라는 시연 가정으로 비교합니다. 네 구성요소의 원천값이 존재하고 리뷰 감성 합계와 채널 노출 합계를 대사했습니다."
      },
      {
        "title": "원천값 → 상대 비중 → 가중 기여도",
        "detail": "각 A/(A+B) 비중의 전후 차이에 고정 가중치를 곱합니다. 네 기여도의 합 -3.25pt가 CTI 변화와 일치합니다."
      },
      {
        "title": "시점과 별도 근거 대조",
        "detail": "4–8월은 유지, 9월 리뷰 악화와 노출 개선이 동시에 관측됩니다. 상반된 변화의 가중 합계를 분리해 봅니다."
      },
      {
        "title": "관측과 원인 가설 구별",
        "detail": "같은 가중 합계 안에서 음수와 양수가 상쇄되는 사례입니다. 광고 노출 증가가 구매나 고객 만족 개선이라는 뜻은 아니므로 리뷰 조사와 매체 운영 판단을 분리합니다."
      },
      {
        "title": "검증할 결정 선택",
        "detail": "리뷰 −6.25pt, 노출 +3.00pt로 상쇄되어 CTI 순변화는 −3.25pt입니다. 리뷰 개선 조사와 광고 현행 유지를 분리합니다. 광고를 줄이면 이미 확보한 노출을 잃을 수 있고, 추가 광고 확대는 리뷰 문제를 해결한다는 근거가 없습니다."
      }
    ],
    "chronology": "4–8월은 유지, 9월 리뷰 악화와 노출 개선이 동시에 관측됩니다. 상반된 변화의 가중 합계를 분리해 봅니다.",
    "responses": {
      "lookup": {
        "question": "제품 A의 CTI 현황을 보여줘.",
        "title": "CTI 현황",
        "conclusion": "CTI는 60.25 → 57.00pt, -3.25pt 변했습니다."
      },
      "diagnosis": {
        "question": "제품 A의 CTI 변화 원인을 분석해 줘.",
        "title": "복합 요인 분석",
        "conclusion": "광고 개선이 리뷰 하락을 일부 상쇄했지만, 전체 CTI는 하락했습니다."
      },
      "action": {
        "question": "제품 A의 CTI 개선을 위해 무엇을 해야 해?",
        "title": "실행 결정",
        "conclusion": "리뷰 −6.25pt, 노출 +3.00pt로 상쇄되어 CTI 순변화는 −3.25pt입니다. 리뷰 개선 조사와 광고 현행 유지를 분리합니다."
      }
    },
    "context": "일본 / 헤어케어 / 제품 A vs B",
    "period": "2026년 4월–9월",
    "comparison": "2026년 4월 대비 9월",
    "baseline": [
      6000,
      4000,
      650,
      350,
      5500,
      4500,
      600000,
      400000
    ],
    "current": 57,
    "shares": [
      60,
      40,
      55,
      75
    ],
    "contributions": [
      0,
      -6.25,
      0,
      3
    ],
    "history": [
      {
        "month": "4월",
        "raw": [
          6000,
          4000,
          650,
          350,
          5500,
          4500,
          600000,
          400000
        ],
        "shares": [
          60,
          65,
          55,
          60
        ],
        "cti": 60.25
      },
      {
        "month": "5월",
        "raw": [
          6000,
          4000,
          650,
          350,
          5500,
          4500,
          600000,
          400000
        ],
        "shares": [
          60,
          65,
          55,
          60
        ],
        "cti": 60.25
      },
      {
        "month": "6월",
        "raw": [
          6000,
          4000,
          650,
          350,
          5500,
          4500,
          600000,
          400000
        ],
        "shares": [
          60,
          65,
          55,
          60
        ],
        "cti": 60.25
      },
      {
        "month": "7월",
        "raw": [
          6000,
          4000,
          650,
          350,
          5500,
          4500,
          600000,
          400000
        ],
        "shares": [
          60,
          65,
          55,
          60
        ],
        "cti": 60.25
      },
      {
        "month": "8월",
        "raw": [
          6000,
          4000,
          650,
          350,
          5500,
          4500,
          600000,
          400000
        ],
        "shares": [
          60,
          65,
          55,
          60
        ],
        "cti": 60.25
      },
      {
        "month": "9월",
        "raw": [
          6000,
          4000,
          400,
          600,
          5500,
          4500,
          750000,
          250000
        ],
        "shares": [
          60,
          40,
          55,
          75
        ],
        "cti": 57
      }
    ],
    "channels": [
      {
        "name": "Google 검색",
        "beforeSpend": 4000000,
        "spend": 4000000,
        "beforeImpressions": 180000,
        "impressions": 225000
      },
      {
        "name": "Meta",
        "beforeSpend": 3000000,
        "spend": 3000000,
        "beforeImpressions": 270000,
        "impressions": 337500
      },
      {
        "name": "YouTube",
        "beforeSpend": 2000000,
        "spend": 2000000,
        "beforeImpressions": 90000,
        "impressions": 112500
      },
      {
        "name": "기타",
        "beforeSpend": 1000000,
        "spend": 1000000,
        "beforeImpressions": 60000,
        "impressions": 75000
      }
    ],
    "budget": {
      "total": 10000000,
      "currentCti": 57,
      "currentM": 75,
      "competitorImpressions": 250000,
      "rows": [
        {
          "name": "Google 검색",
          "current": 4000000,
          "recommended": 4000000,
          "min": 500000,
          "max": 6000000,
          "k": 2000000,
          "q": 204803.82599103844,
          "currentImpressions": 225000,
          "expectedImpressions": 225000
        },
        {
          "name": "Meta",
          "current": 3000000,
          "recommended": 3000000,
          "min": 500000,
          "max": 6000000,
          "k": 2000000,
          "q": 368332.87542883586,
          "currentImpressions": 337500,
          "expectedImpressions": 337500
        },
        {
          "name": "YouTube",
          "current": 2000000,
          "recommended": 2000000,
          "min": 500000,
          "max": 6000000,
          "k": 2000000,
          "q": 162303.1921000084,
          "currentImpressions": 112500,
          "expectedImpressions": 112500
        },
        {
          "name": "기타",
          "current": 1000000,
          "recommended": 1000000,
          "min": 500000,
          "max": 6000000,
          "k": 2000000,
          "q": 184972.75967823237,
          "currentImpressions": 75000,
          "expectedImpressions": 75000
        }
      ],
      "curves": [
        {
          "budget": 0,
          "Google 검색": 0,
          "Meta": 0,
          "YouTube": 0,
          "기타": 0
        },
        {
          "budget": 1000000,
          "Google 검색": 83040.80544642209,
          "Meta": 149346.12915554398,
          "YouTube": 65808.28133113007,
          "기타": 75000
        },
        {
          "budget": 2000000,
          "Google 검색": 141959.19455357792,
          "Meta": 255308.89411103513,
          "YouTube": 112500,
          "기타": 128213.34685135909
        },
        {
          "budget": 3000000,
          "Google 검색": 187659.84760795571,
          "Meta": 337500,
          "YouTube": 148716.91067482828,
          "기타": 169488.82534234974
        },
        {
          "budget": 4000000,
          "Google 검색": 225000,
          "Meta": 404655.0232665791,
          "YouTube": 178308.28133113007,
          "기타": 203213.34685135906
        },
        {
          "budget": 5000000,
          "Google 검색": 256570.64900774212,
          "Meta": 461433.78641666303,
          "YouTube": 203327.4287314805,
          "기타": 231727.0235052827
        },
        {
          "budget": 6000000,
          "Google 검색": 283918.38910715585,
          "Meta": 510617.78822207026,
          "YouTube": 225000,
          "기타": 256426.69370271818
        }
      ],
      "expectedImpressions": 750000,
      "expectedM": 75,
      "expectedCti": 57,
      "assumption": "다음 달에도 현재 경쟁사 노출과 S/R/E가 유지된다는 가정입니다. 곡선은 관측값에 기준점을 맞춘 모의 함수입니다."
    },
    "reviewBaseline": [
      1000,
      650,
      200,
      150,
      4.4
    ],
    "baselinePeerReviews": 700
  },
  {
    "id": "E",
    "name": "측정 문제",
    "focus": "quality",
    "tag": "데이터 품질",
    "raw": [
      5500,
      4500,
      450,
      550,
      5300,
      4700,
      null,
      550000
    ],
    "review": [
      900,
      450,
      150,
      300,
      3.6
    ],
    "peerReviews": 1000,
    "spend": 10000000,
    "headline": "9월 광고 노출이 누락돼 전체 CTI와 하락 폭을 확정할 수 없습니다.",
    "observation": "S=55%, R=45%, E=53%는 계산 가능하지만 M은 결측입니다. 남은 가중치를 재정규화하지 않습니다.",
    "claim": "측정 누락으로 성과 판단이 제한됨",
    "support": "자사 광고 노출 9월 값이 미수집 상태입니다. 0회 노출과 다른 상태입니다.",
    "counter": "리뷰 관련 악화는 별도로 관측됩니다. 광고 결측이 리뷰 변화까지 무효화하지는 않습니다.",
    "alternative": "실제 노출 감소와 수집 실패를 분리하려면 원천 누락을 먼저 복구해야 합니다.",
    "actions": [
      "광고 노출 수집을 복구하고 같은 기준으로 CTI를 다시 검산합니다.",
      "리뷰 이슈는 부분 근거로 검토하되 전체 CTI 진단과 예산안 승인 판단은 보류합니다."
    ],
    "topics": [
      [
        "사용 후 건조함",
        35,
        120
      ],
      [
        "향에 대한 불만",
        20,
        65
      ],
      [
        "배송 불만",
        45,
        50
      ]
    ],
    "event": "9월 광고 노출 수집 실패 기록. 차트의 빈 구간은 0으로 연결하지 않습니다.",
    "decision": {
      "kind": "hold",
      "title": "성과·예산 판단 보류 · 계측 복구 요청",
      "risk": "수집 실패를 실제 성과 악화로 오해하면 잘못된 예산 변경을 승인할 수 있습니다.",
      "reason": "9월 자사 노출만 결측이므로 네 항목의 전체 CTI를 산출할 수 없습니다. 리뷰 악화는 부분 관측으로만 남깁니다.",
      "rule": "필수 원천값 결측 시 전체 CTI·예산 효과 산출 및 예산 승인 보류. 결측을 0으로 치환하거나 가중치를 재배분하지 않습니다.",
      "alternative": "0 치환은 실제 노출이 없었다는 가정을 넣고, 재정규화는 기간별 지표 정의를 바꾸므로 둘 다 사용하지 않습니다.",
      "resource": "예산 변경 0원 · 데이터팀 복구 요청",
      "timeline": "10/09 누락 확인 → 10/12 원천 대사·재검산",
      "success": "모든 채널의 9월 노출이 원천과 대사되고 결측 플래그가 해소됨. 기존 가중치로 CTI 재계산 후 검토 재개.",
      "stop": "원천 자체가 소실돼 동일 기준 복구가 불가능하면 CTI 공백을 유지하고 예산 판단은 보류합니다.",
      "followup": "분석팀이 복구 후 동일 비교군/기간으로 다시 검토합니다. 복구 전 성과 승인 버튼은 제공하지 않습니다.",
      "tasks": [
        {
          "owner": "데이터팀",
          "due": "10/09",
          "action": "9월 노출 수집 실패 위치·기간 확인",
          "inputs": "수집 로그, 매체별 원천 추출 파일, 누락 플래그",
          "done": "수집 실패와 실제 0 노출을 구분한 점검표"
        },
        {
          "owner": "분석팀",
          "due": "10/12",
          "action": "채널 합계·기간·원천 대사 후 재검산",
          "inputs": "복구한 동일 측정 범위의 노출값",
          "done": "결측 0개·원천 합계 일치·검산 결과 또는 복구 불가 기록"
        }
      ],
      "why": "성과 수치가 없다는 사실과 성과가 0이라는 사실은 다릅니다. 먼저 측정을 복구해야 예산 판단의 근거가 성립합니다."
    },
    "proof": [
      {
        "name": "검색 관심",
        "source": "E-202604 / E-202609 · 검색 관심",
        "beforeA": 6000,
        "beforeB": 4000,
        "currentA": 5500,
        "currentB": 4500,
        "beforeShare": 60,
        "currentShare": 55,
        "weight": 0.35,
        "contribution": -1.75,
        "formula": "5,500 ÷ (5,500 + 4,500) × 100 = 55%; (55 − 60) × 0.35 = -1.75pt"
      },
      {
        "name": "긍정 리뷰",
        "source": "E-202604 / E-202609 · 긍정 리뷰",
        "beforeA": 650,
        "beforeB": 350,
        "currentA": 450,
        "currentB": 550,
        "beforeShare": 65,
        "currentShare": 45,
        "weight": 0.25,
        "contribution": -5,
        "formula": "450 ÷ (450 + 550) × 100 = 45%; (45 − 65) × 0.25 = -5pt"
      },
      {
        "name": "디지털 참여",
        "source": "E-202604 / E-202609 · 디지털 참여",
        "beforeA": 5500,
        "beforeB": 4500,
        "currentA": 5300,
        "currentB": 4700,
        "beforeShare": 55,
        "currentShare": 53,
        "weight": 0.2,
        "contribution": -0.4,
        "formula": "5,300 ÷ (5,300 + 4,700) × 100 = 53%; (53 − 55) × 0.2 = -0.4pt"
      },
      {
        "name": "광고 노출",
        "source": "E-202604 / E-202609 · 광고 노출",
        "beforeA": 600000,
        "beforeB": 400000,
        "currentA": null,
        "currentB": 550000,
        "beforeShare": 60,
        "currentShare": null,
        "weight": 0.2,
        "contribution": null,
        "formula": "9월 자사 노출 결측 → 비중·기여도 계산 보류"
      }
    ],
    "process": [
      {
        "title": "비교 범위와 품질 확인",
        "detail": "일본·헤어케어·A/B·4월 대비 9월·동일 수집 기준이라는 시연 가정으로 비교합니다. 9월 노출 결측으로 전체 CTI를 보류합니다."
      },
      {
        "title": "원천값 → 상대 비중 → 가중 기여도",
        "detail": "확인 가능한 세 항목만 별도로 계산합니다. 결측 항목을 0으로 넣거나 가중치를 재정규화하지 않습니다."
      },
      {
        "title": "시점과 별도 근거 대조",
        "detail": "리뷰 약화는 8월부터, 광고 노출 누락은 9월입니다. 앞선 관측은 유지하고 9월 전체 CTI만 공백으로 남깁니다."
      },
      {
        "title": "관측과 원인 가설 구별",
        "detail": "성과 수치가 없다는 사실과 성과가 0이라는 사실은 다릅니다. 먼저 측정을 복구해야 예산 판단의 근거가 성립합니다."
      },
      {
        "title": "검증할 결정 선택",
        "detail": "9월 자사 노출만 결측이므로 네 항목의 전체 CTI를 산출할 수 없습니다. 리뷰 악화는 부분 관측으로만 남깁니다. 0 치환은 실제 노출이 없었다는 가정을 넣고, 재정규화는 기간별 지표 정의를 바꾸므로 둘 다 사용하지 않습니다."
      }
    ],
    "chronology": "리뷰 약화는 8월부터, 광고 노출 누락은 9월입니다. 앞선 관측은 유지하고 9월 전체 CTI만 공백으로 남깁니다.",
    "responses": {
      "lookup": {
        "question": "제품 A의 CTI 현황을 보여줘.",
        "title": "CTI 현황",
        "conclusion": "4월 CTI는 60.25pt입니다. 9월은 광고 노출 결측으로 계산할 수 없습니다."
      },
      "diagnosis": {
        "question": "제품 A의 CTI 변화 원인을 분석해 줘.",
        "title": "측정 문제 분석",
        "conclusion": "9월 광고 노출이 누락돼 전체 CTI와 하락 폭을 확정할 수 없습니다."
      },
      "action": {
        "question": "제품 A의 CTI 개선을 위해 무엇을 해야 해?",
        "title": "실행 결정",
        "conclusion": "9월 자사 노출만 결측이므로 네 항목의 전체 CTI를 산출할 수 없습니다. 리뷰 악화는 부분 관측으로만 남깁니다."
      }
    },
    "context": "일본 / 헤어케어 / 제품 A vs B",
    "period": "2026년 4월–9월",
    "comparison": "2026년 4월 대비 9월",
    "baseline": [
      6000,
      4000,
      650,
      350,
      5500,
      4500,
      600000,
      400000
    ],
    "current": null,
    "shares": [
      55,
      45,
      53,
      null
    ],
    "contributions": [
      -1.75,
      -5,
      -0.4,
      null
    ],
    "history": [
      {
        "month": "4월",
        "raw": [
          6000,
          4000,
          650,
          350,
          5500,
          4500,
          600000,
          400000
        ],
        "shares": [
          60,
          65,
          55,
          60
        ],
        "cti": 60.25
      },
      {
        "month": "5월",
        "raw": [
          5960,
          4040,
          650,
          350,
          5500,
          4500,
          600000,
          400000
        ],
        "shares": [
          59.6,
          65,
          55,
          60
        ],
        "cti": 60.11
      },
      {
        "month": "6월",
        "raw": [
          5900,
          4100,
          650,
          350,
          5500,
          4500,
          600000,
          400000
        ],
        "shares": [
          59,
          65,
          55,
          60
        ],
        "cti": 59.9
      },
      {
        "month": "7월",
        "raw": [
          5800,
          4200,
          650,
          350,
          5480,
          4520,
          600000,
          400000
        ],
        "shares": [
          58,
          65,
          54.8,
          60
        ],
        "cti": 59.51
      },
      {
        "month": "8월",
        "raw": [
          5650,
          4350,
          530,
          470,
          5400,
          4600,
          600000,
          400000
        ],
        "shares": [
          56.5,
          53,
          54,
          60
        ],
        "cti": 55.825
      },
      {
        "month": "9월",
        "raw": [
          5500,
          4500,
          450,
          550,
          5300,
          4700,
          null,
          550000
        ],
        "shares": [
          55,
          45,
          53,
          null
        ],
        "cti": null
      }
    ],
    "channels": [
      {
        "name": "Google 검색",
        "beforeSpend": 4000000,
        "spend": 4000000,
        "beforeImpressions": 180000,
        "impressions": null
      },
      {
        "name": "Meta",
        "beforeSpend": 3000000,
        "spend": 3000000,
        "beforeImpressions": 270000,
        "impressions": null
      },
      {
        "name": "YouTube",
        "beforeSpend": 2000000,
        "spend": 2000000,
        "beforeImpressions": 90000,
        "impressions": null
      },
      {
        "name": "기타",
        "beforeSpend": 1000000,
        "spend": 1000000,
        "beforeImpressions": 60000,
        "impressions": null
      }
    ],
    "budget": null,
    "reviewBaseline": [
      1000,
      650,
      200,
      150,
      4.4
    ],
    "baselinePeerReviews": 700
  },
  {
    "id": "F",
    "name": "성과 개선",
    "focus": "growth",
    "tag": "유지 전략",
    "raw": [
      6500,
      3500,
      700,
      300,
      6000,
      4000,
      650000,
      350000
    ],
    "review": [
      1000,
      700,
      180,
      120,
      4.6
    ],
    "peerReviews": 1000,
    "spend": 10000000,
    "headline": "네 접점이 함께 개선됐습니다. 효과를 유지하며 확대 가능성을 검토합니다.",
    "observation": "CTI는 60.25→65.25, +5.00pt입니다. 검색 +1.75pt, 리뷰 +1.25pt, 참여 +1.00pt, 광고 +1.00pt입니다.",
    "claim": "고객 반응과 디지털 접점의 동반 개선 가능성",
    "support": "긍정률은 65→70%, 평점은 4.4→4.6으로 개선됐고 광고 노출도 증가했습니다.",
    "counter": "CTI 상승은 매출·ROAS·수익 증가를 증명하지 않습니다. 계절성과 경쟁사 변화도 존재할 수 있습니다.",
    "alternative": "시장 관심 변화와 경쟁사 접점 감소가 상대 점유율 개선에 기여했을 수 있습니다.",
    "actions": [
      "고객 반응과 운영 조건을 유지하고 개선 구간을 지속 관찰합니다.",
      "현재 예산·운영을 유지하고 2주 모니터링 후 확대 실험 필요성을 검토합니다."
    ],
    "topics": [
      [
        "사용 후 건조함",
        35,
        20
      ],
      [
        "향에 대한 불만",
        20,
        15
      ],
      [
        "배송 불만",
        45,
        30
      ]
    ],
    "event": "9월 긍정 반응과 노출이 함께 개선된 가상 기록. 실제 사업 성과는 별도 검증이 필요합니다.",
    "decision": {
      "kind": "maintain",
      "title": "현행 예산·운영 유지 · 2주 모니터링",
      "risk": "CTI 개선을 매출·수익 개선으로 오해해 검증 없이 예산을 늘릴 수 있습니다.",
      "reason": "네 구성요소가 모두 개선되고 긍정률 70%, 평점 4.6입니다. 급한 재배분 근거가 없어 현행 유지가 합리적인 비교안입니다.",
      "rule": "데모 검토 규칙: 모든 항목 개선 + 고객 반응 안정이면 현행 유지. 예산 확대는 전환·수익 자료로 별도 검증.",
      "alternative": "즉시 확대는 검증되지 않은 한계 효과와 수익을 가정합니다. 현재 예산과 운영 조건을 유지해 지속성을 먼저 관찰합니다.",
      "resource": "광고비 1,000만원·배분 유지 · 추가 지출 0원",
      "timeline": "10/12–10/25 유지 관찰 → 10/26 검토",
      "success": "2주 동일 수집 기준에서 각 구성요소·긍정률·평점을 기록하고 전환/수익 자료의 확보 가능성을 보고. 상승 유지 자체는 광고 인과 효과의 증명이 아닙니다.",
      "stop": "긍정률 10%p 이상 또는 평점 0.5점 이상 하락 시 유지 판단을 재검토. 계측 누락 시 CTI 판단을 보류합니다.",
      "followup": "10/26 마케팅 책임자가 유지 또는 별도 확대 실험 필요성을 결정합니다. 전환/수익 근거가 없으면 확대 보류.",
      "tasks": [
        {
          "owner": "마케팅 운영팀",
          "due": "10/12–10/25",
          "action": "현재 예산·소재·타기팅 유지하며 관측",
          "inputs": "현재 운영 설정, 주별 리뷰·검색·참여·노출",
          "done": "조건 변경과 계측 상태를 포함한 2주 관측표"
        },
        {
          "owner": "분석팀",
          "due": "10/26",
          "action": "개선 지속성과 사업 성과 자료 가용성 검토",
          "inputs": "관측표, 전환·수익 자료 확보 여부",
          "done": "유지 또는 별도 실험 필요성 결정 메모"
        }
      ],
      "why": "접점의 상대 비중이 개선됐다는 관측을 넘어 매출·수익 효과를 주장하지 않습니다. 불필요한 배분 변경을 피하고 유지 여부를 확인하는 것도 의사결정입니다."
    },
    "proof": [
      {
        "name": "검색 관심",
        "source": "F-202604 / F-202609 · 검색 관심",
        "beforeA": 6000,
        "beforeB": 4000,
        "currentA": 6500,
        "currentB": 3500,
        "beforeShare": 60,
        "currentShare": 65,
        "weight": 0.35,
        "contribution": 1.75,
        "formula": "6,500 ÷ (6,500 + 3,500) × 100 = 65%; (65 − 60) × 0.35 = 1.75pt"
      },
      {
        "name": "긍정 리뷰",
        "source": "F-202604 / F-202609 · 긍정 리뷰",
        "beforeA": 650,
        "beforeB": 350,
        "currentA": 700,
        "currentB": 300,
        "beforeShare": 65,
        "currentShare": 70,
        "weight": 0.25,
        "contribution": 1.25,
        "formula": "700 ÷ (700 + 300) × 100 = 70%; (70 − 65) × 0.25 = 1.25pt"
      },
      {
        "name": "디지털 참여",
        "source": "F-202604 / F-202609 · 디지털 참여",
        "beforeA": 5500,
        "beforeB": 4500,
        "currentA": 6000,
        "currentB": 4000,
        "beforeShare": 55,
        "currentShare": 60,
        "weight": 0.2,
        "contribution": 1,
        "formula": "6,000 ÷ (6,000 + 4,000) × 100 = 60%; (60 − 55) × 0.2 = 1pt"
      },
      {
        "name": "광고 노출",
        "source": "F-202604 / F-202609 · 광고 노출",
        "beforeA": 600000,
        "beforeB": 400000,
        "currentA": 650000,
        "currentB": 350000,
        "beforeShare": 60,
        "currentShare": 65,
        "weight": 0.2,
        "contribution": 1,
        "formula": "650,000 ÷ (650,000 + 350,000) × 100 = 65%; (65 − 60) × 0.2 = 1pt"
      }
    ],
    "process": [
      {
        "title": "비교 범위와 품질 확인",
        "detail": "일본·헤어케어·A/B·4월 대비 9월·동일 수집 기준이라는 시연 가정으로 비교합니다. 네 구성요소의 원천값이 존재하고 리뷰 감성 합계와 채널 노출 합계를 대사했습니다."
      },
      {
        "title": "원천값 → 상대 비중 → 가중 기여도",
        "detail": "각 A/(A+B) 비중의 전후 차이에 고정 가중치를 곱합니다. 네 기여도의 합 5pt가 CTI 변화와 일치합니다."
      },
      {
        "title": "시점과 별도 근거 대조",
        "detail": "6월부터 각 접점이 점진적으로 개선됩니다. 9월은 최종 관측값이며 한 번의 사건이 전체 개선을 유발했다고 가정하지 않습니다."
      },
      {
        "title": "관측과 원인 가설 구별",
        "detail": "접점의 상대 비중이 개선됐다는 관측을 넘어 매출·수익 효과를 주장하지 않습니다. 불필요한 배분 변경을 피하고 유지 여부를 확인하는 것도 의사결정입니다."
      },
      {
        "title": "검증할 결정 선택",
        "detail": "네 구성요소가 모두 개선되고 긍정률 70%, 평점 4.6입니다. 급한 재배분 근거가 없어 현행 유지가 합리적인 비교안입니다. 즉시 확대는 검증되지 않은 한계 효과와 수익을 가정합니다. 현재 예산과 운영 조건을 유지해 지속성을 먼저 관찰합니다."
      }
    ],
    "chronology": "6월부터 각 접점이 점진적으로 개선됩니다. 9월은 최종 관측값이며 한 번의 사건이 전체 개선을 유발했다고 가정하지 않습니다.",
    "responses": {
      "lookup": {
        "question": "제품 A의 CTI 현황을 보여줘.",
        "title": "CTI 현황",
        "conclusion": "CTI는 60.25 → 65.25pt, +5.00pt 변했습니다."
      },
      "diagnosis": {
        "question": "제품 A의 CTI 변화 원인을 분석해 줘.",
        "title": "성과 개선 분석",
        "conclusion": "네 접점이 함께 개선됐습니다. 효과를 유지하며 확대 가능성을 검토합니다."
      },
      "action": {
        "question": "제품 A의 CTI 개선을 위해 무엇을 해야 해?",
        "title": "실행 결정",
        "conclusion": "네 구성요소가 모두 개선되고 긍정률 70%, 평점 4.6입니다. 급한 재배분 근거가 없어 현행 유지가 합리적인 비교안입니다."
      }
    },
    "context": "일본 / 헤어케어 / 제품 A vs B",
    "period": "2026년 4월–9월",
    "comparison": "2026년 4월 대비 9월",
    "baseline": [
      6000,
      4000,
      650,
      350,
      5500,
      4500,
      600000,
      400000
    ],
    "current": 65.25,
    "shares": [
      65,
      70,
      60,
      65
    ],
    "contributions": [
      1.75,
      1.25,
      1,
      1
    ],
    "history": [
      {
        "month": "4월",
        "raw": [
          6000,
          4000,
          650,
          350,
          5500,
          4500,
          600000,
          400000
        ],
        "shares": [
          60,
          65,
          55,
          60
        ],
        "cti": 60.25
      },
      {
        "month": "5월",
        "raw": [
          6000,
          4000,
          650,
          350,
          5500,
          4500,
          600000,
          400000
        ],
        "shares": [
          60,
          65,
          55,
          60
        ],
        "cti": 60.25
      },
      {
        "month": "6월",
        "raw": [
          6050,
          3950,
          655,
          345,
          5550,
          4450,
          605000,
          395000
        ],
        "shares": [
          60.5,
          65.5,
          55.5,
          60.5
        ],
        "cti": 60.75
      },
      {
        "month": "7월",
        "raw": [
          6125,
          3875,
          663,
          338,
          5625,
          4375,
          612500,
          387500
        ],
        "shares": [
          61.25,
          66.23376623376623,
          56.25,
          61.25
        ],
        "cti": 61.49594155844156
      },
      {
        "month": "8월",
        "raw": [
          6275,
          3725,
          678,
          323,
          5775,
          4225,
          627500,
          372500
        ],
        "shares": [
          62.75,
          67.73226773226773,
          57.75,
          62.75
        ],
        "cti": 62.995566933066925
      },
      {
        "month": "9월",
        "raw": [
          6500,
          3500,
          700,
          300,
          6000,
          4000,
          650000,
          350000
        ],
        "shares": [
          65,
          70,
          60,
          65
        ],
        "cti": 65.25
      }
    ],
    "channels": [
      {
        "name": "Google 검색",
        "beforeSpend": 4000000,
        "spend": 4000000,
        "beforeImpressions": 180000,
        "impressions": 195000
      },
      {
        "name": "Meta",
        "beforeSpend": 3000000,
        "spend": 3000000,
        "beforeImpressions": 270000,
        "impressions": 292500
      },
      {
        "name": "YouTube",
        "beforeSpend": 2000000,
        "spend": 2000000,
        "beforeImpressions": 90000,
        "impressions": 97500
      },
      {
        "name": "기타",
        "beforeSpend": 1000000,
        "spend": 1000000,
        "beforeImpressions": 60000,
        "impressions": 65000
      }
    ],
    "budget": {
      "total": 10000000,
      "currentCti": 65.25,
      "currentM": 65,
      "competitorImpressions": 350000,
      "rows": [
        {
          "name": "Google 검색",
          "current": 4000000,
          "recommended": 4000000,
          "min": 500000,
          "max": 6000000,
          "k": 2000000,
          "q": 177496.6491922333,
          "currentImpressions": 195000,
          "expectedImpressions": 195000
        },
        {
          "name": "Meta",
          "current": 3000000,
          "recommended": 3000000,
          "min": 500000,
          "max": 6000000,
          "k": 2000000,
          "q": 319221.82537165773,
          "currentImpressions": 292500,
          "expectedImpressions": 292500
        },
        {
          "name": "YouTube",
          "current": 2000000,
          "recommended": 2000000,
          "min": 500000,
          "max": 6000000,
          "k": 2000000,
          "q": 140662.76648667394,
          "currentImpressions": 97500,
          "expectedImpressions": 97500
        },
        {
          "name": "기타",
          "current": 1000000,
          "recommended": 1000000,
          "min": 500000,
          "max": 6000000,
          "k": 2000000,
          "q": 160309.72505446806,
          "currentImpressions": 65000,
          "expectedImpressions": 65000
        }
      ],
      "curves": [
        {
          "budget": 0,
          "Google 검색": 0,
          "Meta": 0,
          "YouTube": 0,
          "기타": 0
        },
        {
          "budget": 1000000,
          "Google 검색": 71968.69805356581,
          "Meta": 129433.31193480478,
          "YouTube": 57033.84382031273,
          "기타": 65000
        },
        {
          "budget": 2000000,
          "Google 검색": 123031.3019464342,
          "Meta": 221267.70822956375,
          "YouTube": 97500,
          "기타": 111118.23393784456
        },
        {
          "budget": 3000000,
          "Google 검색": 162638.5345935616,
          "Meta": 292500,
          "YouTube": 128887.98925151784,
          "기타": 146890.3152967031
        },
        {
          "budget": 4000000,
          "Google 검색": 195000,
          "Meta": 350701.0201643685,
          "YouTube": 154533.8438203127,
          "기타": 176118.23393784455
        },
        {
          "budget": 5000000,
          "Google 검색": 222361.22914004317,
          "Meta": 399909.28156110796,
          "YouTube": 176217.10490061642,
          "기타": 200830.08703791167
        },
        {
          "budget": 6000000,
          "Google 검색": 246062.6038928684,
          "Meta": 442535.4164591275,
          "YouTube": 195000,
          "기타": 222236.46787568912
        }
      ],
      "expectedImpressions": 650000,
      "expectedM": 65,
      "expectedCti": 65.25,
      "assumption": "다음 달에도 현재 경쟁사 노출과 S/R/E가 유지된다는 가정입니다. 곡선은 관측값에 기준점을 맞춘 모의 함수입니다."
    },
    "reviewBaseline": [
      1000,
      650,
      200,
      150,
      4.4
    ],
    "baselinePeerReviews": 700
  }
];

export const componentNames = ['검색 관심', '긍정 리뷰', '디지털 참여', '광고 노출'];
export const componentWeights = [.35, .25, .20, .20];
export type QuestionLevel = 'lookup' | 'diagnosis' | 'action';
export const levels: {id:QuestionLevel;name:string;question:string}[] = [
 {id:'lookup',name:'단순 조회',question:'제품 A의 CTI 현황을 보여줘.'},
 {id:'diagnosis',name:'원인 분석',question:'제품 A의 CTI 변화 원인을 분석해 줘.'},
 {id:'action',name:'대응 방안',question:'제품 A의 CTI 개선을 위해 무엇을 해야 해?'},
];
export const budgetQuestion='현재 총예산 안에서 광고비를 재배분해 줘.';
export const approvalQuestion='추천안으로 진행할게.';
export const references=[
 {label:'고객 리뷰와 사회적 증거',url:'https://www.thinkwithgoogle.com/_qs/documents/9998/Decoding_Decisions_The_Messy_Middle_of_Purchase_Behavior.pdf',note:'리뷰는 구매 판단에 관련된 단서입니다. 이 사례에서 판매 영향을 추정한 것은 아닙니다.'},
 {label:'광고 반응 곡선과 한계 효과',url:'https://developers.google.com/meridian/docs/post-modeling/roi-mroi-response-curves',note:'평균 성과와 추가 투자 효과를 구별합니다. 데모 log 노출 곡선은 실제 광고 효과 추정이 아닙니다.'},
 {label:'인과 추정의 가정',url:'https://developers.google.com/meridian/docs/causal-inference/about-mmm-causal-inference-methodology',note:'관측 변화와 인과 효과를 구별합니다. CTI의 산술적 기여도는 인과 기여율이 아닙니다.'},
];
