// One-time reproduction of the explicitly approved 35 synthetic reviews.
// Run from the project root on the original 50-review source only.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const file='data/roas/roas-reviews.json',sidecar='data/roas/roas-review-classification.json';
const raw=JSON.parse(fs.readFileSync(file,'utf8')),pack=JSON.parse(fs.readFileSync(sidecar,'utf8'));
assert.equal(raw.reviews.length,50,'refuse to append twice or modify another dataset');
const newRows=[],newClassifications=[];
const add=(day,collectedDay,time,source,rating,text,...experiences)=>{
 const id=`REV-S16-${String(26+newRows.length).padStart(3,'0')}`;
 const stamp=(d,t)=>`2026-08-${String(d).padStart(2,'0')}T${t}:00+09:00`;
 newRows.push({id,caseId:'S16',productId:'EDU-P1',sourceId:source==='own'?'own_store':'virtual_external_1',
  sourceName:source==='own'?'자사몰':'쿠팡',writtenAt:stamp(day,time),collectedAt:stamp(collectedDay,'23:10'),rating,ratingScale:5,text});
 newClassifications.push({reviewId:id,status:experiences.length?'classified':'unclassified',assignments:experiences.map(([experienceId,sentiment,evidenceQuote])=>{
  const experience=pack.experiences.find(e=>e.id===experienceId);
  assert(experience&&text.includes(evidenceQuote),id+' quote/category');
  return {categoryId:experience.categoryId,experienceId,sentiment,evidenceQuote};
 })});
};

// Baseline: 15 reviews, own 5 / Coupang 10, four dual-experience reviews.
add(3,4,'09:12','own',5,'단 향보다 쌉싸름한 향을 좋아하는 편인데, 이건 그쪽이라 잘 맞아요. 헹군 뒤 손바닥이 끈적이지 않아 바로 수건을 잡기 좋았습니다.',
 ['scent_preference','positive','단 향보다 쌉싸름한 향을 좋아하는 편인데, 이건 그쪽이라 잘 맞아요'],
 ['residue','positive','헹군 뒤 손바닥이 끈적이지 않아 바로 수건을 잡기 좋았습니다']);
add(4,5,'21:37','external',2,'창문 없는 작은 욕실에서 쓰니 향이 너무 꽉 차는 느낌이에요. 문을 열어 두고 감아야 덜 답답해서 저는 손이 잘 안 갑니다.',
 ['scent_intensity','negative','향이 너무 꽉 차는 느낌이에요. 문을 열어 두고 감아야 덜 답답해서 저는 손이 잘 안 갑니다']);
add(5,7,'18:24','external',3,'출근 전에 감으면 점심까지는 머리를 넘길 때 향이 나고 퇴근할 무렵에는 거의 모르겠어요. 향이 얼마나 가는지 궁금한 분들 참고하세요.',
 ['scent_longevity','neutral','점심까지는 머리를 넘길 때 향이 나고 퇴근할 무렵에는 거의 모르겠어요']);
add(6,7,'07:46','own',5,'머리를 여러 갈래로 나눠 씻는 편인데 마지막 부분을 씻을 때까지 거품이 남아 있어서 좋네요. 연달아 덜어 쓸 때 펌프가 바로 올라와 기다릴 필요도 없어요.',
 ['foam','positive','마지막 부분을 씻을 때까지 거품이 남아 있어서 좋네요'],
 ['pump_operation','positive','연달아 덜어 쓸 때 펌프가 바로 올라와 기다릴 필요도 없어요']);
add(7,8,'22:03','external',1,'귀 뒤쪽을 만지면 샴푸가 남은 듯 미끈해서 그 부분만 다시 헹궜어요. 물을 더 대도 개운하지 않아 결국 오늘은 다른 샴푸로 다시 감았습니다.',
 ['residue','negative','귀 뒤쪽을 만지면 샴푸가 남은 듯 미끈해서 그 부분만 다시 헹궜어요. 물을 더 대도 개운하지 않아']);
add(8,9,'13:18','own',4,'감고 말린 다음 손으로 정수리를 만져 보면 전보다 보송한 느낌이 들어요. 머리끝도 까슬하지 않아서 며칠째 무난하게 쓰고 있습니다.',
 ['after_feel','positive','손으로 정수리를 만져 보면 전보다 보송한 느낌이 들어요. 머리끝도 까슬하지 않아서']);
add(9,10,'10:52','external',2,'젖은 머리를 손가락으로 나눌 때 끝부분이 걸려 자꾸 멈추게 돼요. 말린 뒤에도 끝이 거칠게 느껴져서 그냥 두기는 불편했습니다.',
 ['tangling','negative','젖은 머리를 손가락으로 나눌 때 끝부분이 걸려 자꾸 멈추게 돼요'],
 ['after_feel','negative','말린 뒤에도 끝이 거칠게 느껴져서 그냥 두기는 불편했습니다']);
add(10,11,'20:16','external',3,'손바닥에선 한 덩어리로 모여 있는데 젖은 머리에 올리면 금방 퍼지네요. 손에서 조금 풀어서 바를지 바로 바를지 번갈아 해 보는 중입니다.',
 ['texture_application','neutral','손바닥에선 한 덩어리로 모여 있는데 젖은 머리에 올리면 금방 퍼지네요']);
add(11,12,'08:31','external',2,'며칠 쓰고 나니 펌프를 끝까지 눌러도 위로 천천히 돌아옵니다. 다음 양을 받으려면 손으로 끌어올려야 해서 매번 귀찮아요.',
 ['pump_operation','negative','펌프를 끝까지 눌러도 위로 천천히 돌아옵니다. 다음 양을 받으려면 손으로 끌어올려야 해서 매번 귀찮아요']);
add(11,13,'23:02','external',2,'사용하고 세워 뒀는데 병과 펌프가 만나는 테두리에 내용물이 다시 묻어나요. 닦아 놓아도 다음날 그 부분이 젖어서 선반에 종이를 깔았습니다.',
 ['leakage_residue','negative','병과 펌프가 만나는 테두리에 내용물이 다시 묻어나요. 닦아 놓아도 다음날 그 부분이 젖어서 선반에 종이를 깔았습니다']);
add(12,13,'16:49','own',4,'상자에서 꺼낼 때 종이 고정재가 병 목과 바닥을 따로 잡고 있었어요. 한쪽을 들어도 병이 빠지지 않아 안쪽 보호는 든든해 보였습니다.',
 ['product_packaging','positive','종이 고정재가 병 목과 바닥을 따로 잡고 있었어요. 한쪽을 들어도 병이 빠지지 않아 안쪽 보호는 든든해 보였습니다']);
add(13,14,'19:08','external',3,'집에서 둘이 번갈아 쓰니 혼자 쓸 때보다 눈에 띄게 빨리 줄어요. 두 사람 모두 매일 쓰고 있어서 제품이 유난히 빨리 닳는 건지는 모르겠습니다.',
 ['consumption_rate','neutral','둘이 번갈아 쓰니 혼자 쓸 때보다 눈에 띄게 빨리 줄어요. 두 사람 모두 매일 쓰고 있어서 제품이 유난히 빨리 닳는 건지는 모르겠습니다']);
add(14,17,'11:43','external',3,'사용량 안내대로 한 번 눌렀더니 정수리만 바를 양이어서 옆머리에 얼마나 더 쓸지 모르겠어요. 머리 전체에 나눠 쓸 기준도 적혀 있으면 좋겠습니다. 젖은 머리에 올린 제형은 손바닥으로 두 번 쓸어 주니 넓게 퍼졌습니다.',
 ['usage_guidance','negative','사용량 안내대로 한 번 눌렀더니 정수리만 바를 양이어서 옆머리에 얼마나 더 쓸지 모르겠어요. 머리 전체에 나눠 쓸 기준도 적혀 있으면 좋겠습니다'],
 ['texture_application','neutral','젖은 머리에 올린 제형은 손바닥으로 두 번 쓸어 주니 넓게 퍼졌습니다']);
add(15,18,'15:26','own',4,'도착 예정일보다 하루 먼저 받았어요. 쓰던 샴푸가 바닥난 날이라 기다리지 않고 바로 쓸 수 있었던 게 좋았습니다.',
 ['delivery_timing','positive','도착 예정일보다 하루 먼저 받았어요. 쓰던 샴푸가 바닥난 날이라 기다리지 않고 바로 쓸 수 있었던 게 좋았습니다']);
add(16,19,'17:54','external',4,'선물로 보낼 거라 제가 써 보지는 않았어요. 받는 사람에게 전달했고 사용 후기는 그쪽에서 나중에 알려 주기로 했습니다. 제 사용평은 아직 없습니다.');

// Current: 20 reviews, own 12 / Coupang 8, six dual-experience reviews.
add(17,18,'06:58','own',4,'화장품 같은 달콤한 냄새는 싫어하는데 이건 차분한 풀 계열로 느껴져서 좋네요. 아침에 쓰는 제품들 중에서는 제 취향에 가까웠어요.',
 ['scent_preference','positive','이건 차분한 풀 계열로 느껴져서 좋네요']);
add(17,19,'22:19','own',3,'감는 동안 코 가까이 올라오는 향은 좀 세서 신경 쓰여요. 그래도 머리에 물을 더 묻혀도 거품이 쉽게 꺼지지 않는 건 마음에 듭니다.',
 ['scent_intensity','negative','감는 동안 코 가까이 올라오는 향은 좀 세서 신경 쓰여요'],
 ['foam','positive','머리에 물을 더 묻혀도 거품이 쉽게 꺼지지 않는 건 마음에 듭니다']);
add(18,19,'12:07','external',3,'아침에 남은 향이 마음에 들어서 나갔는데, 오후에 모자를 벗으니 같은 향이 진하게 모여 있어 부담스럽더라고요. 처음의 은은함은 좋았지만 계속 남는 점은 저한테 애매합니다.',
 ['scent_longevity','mixed','처음의 은은함은 좋았지만 계속 남는 점은 저한테 애매합니다']);
add(19,20,'09:34','own',5,'귀 옆까지 손끝으로 오래 문지르는 편이에요. 중간에 거품이 꺼지지 않아서 새로 짜지 않고 마무리할 수 있었어요. 제 씻는 습관에는 이게 꽤 편하네요.',
 ['foam','positive','중간에 거품이 꺼지지 않아서 새로 짜지 않고 마무리할 수 있었어요']);
add(20,21,'23:11','own',2,'머리 안쪽을 헹굴수록 손끝에 미끄러운 막이 남는 것 같아 오래 씻게 돼요. 다 말리고 나서도 뿌리 쪽이 무겁게 느껴져서 제 머리에는 안 맞는 듯합니다.',
 ['residue','negative','머리 안쪽을 헹굴수록 손끝에 미끄러운 막이 남는 것 같아 오래 씻게 돼요'],
 ['after_feel','negative','다 말리고 나서도 뿌리 쪽이 무겁게 느껴져서 제 머리에는 안 맞는 듯합니다']);
add(21,22,'14:42','external',3,'샤워기로 바로 헹구면 빨리 끝나는 건 편한데, 대야에 물을 받아 헹구니 미끄러운 감촉이 남아서 답답했어요. 헹구는 방식에 따라 만족도가 꽤 다르네요.',
 ['residue','mixed','샤워기로 바로 헹구면 빨리 끝나는 건 편한데, 대야에 물을 받아 헹구니 미끄러운 감촉이 남아서 답답했어요']);
add(21,22,'20:53','own',4,'감을 때는 모발이 뻣뻣해서 별로였는데 완전히 말리고 나니 손으로 쓸어내리는 감촉은 부드러워서 좋았어요. 씻는 순간과 마른 뒤 느낌이 다르네요.',
 ['after_feel','mixed','감을 때는 모발이 뻣뻣해서 별로였는데 완전히 말리고 나니 손으로 쓸어내리는 감촉은 부드러워서 좋았어요']);
add(22,23,'07:23','own',5,'수건으로 머리를 감싸 뒀다가 풀면 뒷머리가 한 덩어리로 엉키곤 했어요. 이걸 쓴 뒤에는 그 부분을 빗을 때 덜 걸려서 머리 말리는 준비가 편해졌습니다.',
 ['tangling','positive','이걸 쓴 뒤에는 그 부분을 빗을 때 덜 걸려서 머리 말리는 준비가 편해졌습니다']);
add(23,24,'18:36','own',5,'손바닥에서 한참 문지르지 않고 머리에 조금씩 나눠 올려도 고르게 펴져요. 뒤통수에 바를 때 한 군데 뭉치지 않아서 사용하기 수월했습니다.',
 ['texture_application','positive','머리에 조금씩 나눠 올려도 고르게 펴져요. 뒤통수에 바를 때 한 군데 뭉치지 않아서 사용하기 수월했습니다']);
add(23,24,'21:09','own',3,'다음 날 처음 누를 때는 샴푸가 안 나오고 두세 번 눌러야 나옵니다. 한번 나오기 시작하면 괜찮지만 매일 첫 사용 때 헛누르는 게 번거로워요.',
 ['pump_operation','negative','다음 날 처음 누를 때는 샴푸가 안 나오고 두세 번 눌러야 나옵니다. 한번 나오기 시작하면 괜찮지만 매일 첫 사용 때 헛누르는 게 번거로워요']);
add(24,25,'16:17','external',1,'받고 열어 보니 내부 종이 고정재가 찢어져 병이 상자 안에서 굴러다녔어요. 병 목에서 샴푸가 흘러 포장지까지 젖어 있어서 쓰기 전에 닦는 데 한참 걸렸습니다.',
 ['leakage_residue','negative','병 목에서 샴푸가 흘러 포장지까지 젖어 있어서 쓰기 전에 닦는 데 한참 걸렸습니다'],
 ['product_packaging','negative','내부 종이 고정재가 찢어져 병이 상자 안에서 굴러다녔어요']);
add(25,26,'10:41','own',4,'폭이 넓어서 물 묻은 타일에 내려놓을 때 안정적인 건 좋아요. 다만 선반에 다른 병이랑 나란히 두면 자리를 꽤 차지해서 그 점은 아쉽습니다.',
 ['container_usability','mixed','물 묻은 타일에 내려놓을 때 안정적인 건 좋아요. 다만 선반에 다른 병이랑 나란히 두면 자리를 꽤 차지해서 그 점은 아쉽습니다']);
add(26,27,'13:29','external',4,'겉상자 한 면이 접혀 있었어요. 안쪽은 병 둘레를 감싼 종이가 두 겹이라 풀어도 병 표면에 닿은 자국이 없었고, 제품 보호는 잘됐다고 느꼈습니다.',
 ['product_packaging','positive','병 둘레를 감싼 종이가 두 겹이라 풀어도 병 표면에 닿은 자국이 없었고, 제품 보호는 잘됐다고 느꼈습니다'],
 ['delivery_condition','neutral','겉상자 한 면이 접혀 있었어요']);
add(26,27,'19:56','own',4,'다른 병과 비교할 때 용량 숫자가 바로 보여서 고르기 쉬웠어요. 쓰면서는 빛에 비춰도 남은 양이 안 보여서 얼마나 더 쓸 수 있을지 모르겠네요.',
 ['volume_label','positive','다른 병과 비교할 때 용량 숫자가 바로 보여서 고르기 쉬웠어요'],
 ['remaining_check','negative','쓰면서는 빛에 비춰도 남은 양이 안 보여서 얼마나 더 쓸 수 있을지 모르겠네요']);
add(27,28,'08:14','external',2,'운동 후 한 번, 자기 전에 한 번 감고 있어요. 그걸 감안해도 제가 예상한 것보다 빨리 줄어들어 부담스럽습니다. 한 번에 쓰는 양을 줄여 봐야겠어요.',
 ['consumption_rate','negative','그걸 감안해도 제가 예상한 것보다 빨리 줄어들어 부담스럽습니다']);
add(28,29,'11:32','own',5,'사용량 안내를 보고 평소 덜던 양을 조절했어요. 처음부터 많이 짤 필요가 없다는 걸 알 수 있어서 좋았습니다. 몇 번을 눌러야 하나 고민하던 게 줄었어요.',
 ['usage_guidance','positive','사용량 안내를 보고 평소 덜던 양을 조절했어요. 처음부터 많이 짤 필요가 없다는 걸 알 수 있어서 좋았습니다']);
add(28,29,'22:48','external',2,'샴푸가 안 나올 때가 있어서 다 쓴 건지 확인하고 싶은데 밖에서는 잔량을 볼 수 없네요. 들어서 무게를 가늠해야 하니 교체할 때를 잡기가 불편합니다.',
 ['remaining_check','negative','밖에서는 잔량을 볼 수 없네요. 들어서 무게를 가늠해야 하니 교체할 때를 잡기가 불편합니다']);
add(29,30,'17:05','own',4,'외출 전에 필요했는데 안내된 날짜에 맞춰 와서 좋았어요. 안의 완충 종이가 펌프까지 감싸고 있어 꺼낼 때도 병이 움직이지 않았습니다. 보호 포장은 만족해요.',
 ['delivery_timing','positive','외출 전에 필요했는데 안내된 날짜에 맞춰 와서 좋았어요'],
 ['product_packaging','positive','안의 완충 종이가 펌프까지 감싸고 있어 꺼낼 때도 병이 움직이지 않았습니다. 보호 포장은 만족해요']);
add(30,30,'09:47','external',3,'박스 바닥이 벌어진 채로 와서 들자마자 아래를 받쳤어요. 내용물이 떨어질까 조심해서 옮겨야 했던 건 불편했습니다. 병은 깨지지 않았습니다.',
 ['delivery_condition','negative','박스 바닥이 벌어진 채로 와서 들자마자 아래를 받쳤어요. 내용물이 떨어질까 조심해서 옮겨야 했던 건 불편했습니다']);
add(30,30,'20:22','external',4,'주문할 때 수량을 바꾸고 결제 내역을 확인하는 과정은 편했어요. 오늘은 주문 과정에 대한 후기만 남깁니다. 샴푸 사용 이야기는 다음에 적을게요.');

// QA context is held outside the production schema.
const contexts=JSON.parse(fs.readFileSync('evidence/review-expansion-20261105/contexts.json','utf8'));
for(const group of Object.values(contexts))for(const [suffix,prefix]of Object.entries(group.prefixes))newRows.find(r=>r.id===`REV-S16-${suffix.padStart(3,'0')}`).text=prefix+newRows.find(r=>r.id===`REV-S16-${suffix.padStart(3,'0')}`).text;
assert.equal(newRows.length,35);
assert.equal(newClassifications.flatMap(r=>r.assignments).length,43);
// The internal source key stays stable; this approval changes its display name.
for(const row of raw.reviews)if(row.sourceId==='virtual_external_1')row.sourceName='쿠팡';
raw.reviews.push(...newRows);
pack.reviewClassifications.push(...newClassifications);
const bytes=JSON.stringify(raw,null,2)+'\n';
pack.sourceReviewSha256=createHash('sha256').update(bytes).digest('hex');
fs.writeFileSync(file,bytes);
fs.writeFileSync(sidecar,JSON.stringify(pack,null,2)+'\n');
console.log(JSON.stringify({reviews:raw.reviews.length,added:newRows.length,assignments:pack.reviewClassifications.flatMap(r=>r.assignments).length}));
