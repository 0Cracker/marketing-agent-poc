import {createHash} from 'node:crypto';

// User-requested synthetic variation. Stable IDs keep all existing references intact.
export function applyDemoOrderFlow(records){
 // Japan's six missing order days were collapsed into Aug 18 by the old generator.
 // Restore those days and shift dependent events by the same delta per order.
 const shifts=new Map();
 for(const r of records.filter(r=>r.dataset_type==='T19'&&r.scope_id.includes('-JP-')&&r.ordered_at.startsWith('2026-08-18'))){
  const index=Number(r.line_id.match(/JP-(\d+)/)?.[1]),day=3+Math.floor(index/2)%28;
  if(day>=12&&day<=17)shifts.set(r.order_id,day-18);
 }
 const shift=(value,delta)=>new Date(Date.parse(value.slice(0,10)+'T00:00:00Z')+delta*86400000).toISOString().slice(0,10)+value.slice(10);
 records=records.map(r=>{const delta=shifts.get(r.order_id||r.order_ref);if(!delta)return r;const changed={...r};for(const key of ['ordered_at','requested_at','processed_at','promised_at','shipped_at','delivered_at'])if(typeof r[key]==='string')changed[key]=shift(r[key],delta);return changed;});
 const profiles={KR:[[1.5,1.9,2.1,2.7,3.1],[2.8,2.5,2.1,1.8,2.0]],JP:[[2.1,2.4,3.2,2.7,2.2],[1.4,1.7,2.0,2.6,2.9]],US:[[3.0,2.6,2.2,2.5,3.3],[1.8,2.3,2.9,2.5,2.0]]};
 const random=key=>createHash('sha256').update(key).digest().readUInt32BE()/2**32;
 const money=cents=>(Number(cents)/100).toFixed(2);
 const cents=value=>BigInt(Math.round(Number(value.amount)*100));
 const minimum=new Map();
 for(const r of records.filter(r=>r.dataset_type==='T20'))minimum.set(r.order_line_ref,(minimum.get(r.order_line_ref)||0)+Number(r.quantity||0));
 const groups=new Map(),updates=new Map();
 for(const r of records.filter(r=>r.dataset_type==='T19')){
  const key=[r.scope_id,r.variant_ref,r.ordered_at.slice(0,10)].join('/');
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);
 }
 for(const [key,rows] of groups){
  rows.sort((a,b)=>a.record_id.localeCompare(b.record_id));
  const country=rows[0].scope_id.split('-')[1],product=rows[0].variant_ref.endsWith('B')?1:0;
  const day=Number(rows[0].ordered_at.slice(8,10)),position=Math.min(4,(day-3)/27*4),index=Math.min(3,Math.floor(position));
  const anchors=profiles[country][product],mean=anchors[index]+(anchors[index+1]-anchors[index])*(position-index);
  const quantities=rows.map(r=>Math.max(1,minimum.get(r.line_id)||0));
  const target=Math.max(quantities.reduce((a,b)=>a+b,0),Math.round(rows.length*mean*(.94+random(key)*.12)));
  const weights=rows.map(r=>.5+random(r.record_id)),total=weights.reduce((a,b)=>a+b,0);
  const remaining=target-quantities.reduce((a,b)=>a+b,0);
  for(let i=0;i<remaining;i++){const pick=(i+.5)/remaining*total;let acc=0;const slot=weights.findIndex(w=>(acc+=w)>=pick);quantities[slot]++;}
  rows.forEach((r,i)=>{
   const quantity=quantities[i],discount=cents(r.line_discount)*BigInt(quantity)/BigInt(r.quantity),tax=cents(r.line_tax)*BigInt(quantity)/BigInt(r.quantity);
   updates.set(r.record_id,{...r,quantity,line_discount:{...r.line_discount,amount:money(discount)},line_tax:{...r.line_tax,amount:money(tax)},line_gross_total:{...r.line_gross_total,amount:money(cents(r.unit_price)*BigInt(quantity)-discount+tax)}});
  });
 }
 const byId=new Map(records.map(r=>[r.record_id,updates.get(r.record_id)||r]));
 return records.map(r=>{
  if(updates.has(r.record_id))return updates.get(r.record_id);
  if(r.dataset_type==='T18'&&['purchase','refund'].includes(r.event_name)){
   const parents=(r.related_record_ids||[]).map(id=>byId.get(id));
   const parent=parents.find(p=>p?.dataset_type===(r.event_name==='purchase'?'T19':'T20'));
   if(!parent)throw Error('Missing commerce event parent '+r.record_id);
   return {...r,quantity:parent.quantity,event_time:r.event_name==='purchase'?parent.ordered_at:parent.processed_at||parent.requested_at};
  }
  if(r.dataset_type!=='T30')return r;
  const parents=r.related_record_ids.map(id=>byId.get(id));
  const gross=parents.filter(p=>p.dataset_type==='T19').reduce((n,p)=>n+cents(p.line_gross_total),0n);
  const refunds=parents.filter(p=>p.dataset_type==='T20'&&p.status==='completed'&&p.refund_amount).reduce((n,p)=>n+cents(p.refund_amount),0n);
  return {...r,net_revenue:{...r.net_revenue,amount:money(gross-refunds)}};
 });
}
