import {useState} from 'react';
import {createPortal} from 'react-dom';
import {format,type Row} from './adapter';

// Keep perceptual lightness/chroma close; hue distinguishes the two ends of the scale.
export const ratingColors:Record<string,string>={5:'oklch(72% 0.12 295)',4:'oklch(76% 0.10 285)',3:'oklch(80% 0.07 305)',2:'oklch(76% 0.10 340)',1:'oklch(72% 0.12 350)'};
const stars=[5,4,3,2,1];

export function ReviewDistribution({rows,onOpen}:{rows:Row[];onOpen:(row:Row)=>void}){
 const [active,setActive]=useState<{row:Row;x:number;y:number}|null>(null);
 const show=(row:Row,x:number,y:number)=>setActive({row,x:Math.max(8,Math.min(x+14,window.innerWidth-240)),y:Math.max(8,Math.min(y+14,window.innerHeight-78))});
 const total=rows.reduce((n,r)=>n+Number(r.values.count),0);
 const largest=rows.reduce<Row|null>((best,row)=>Number(row.values.count)>Number(best?.values.count??0)?row:best,null);
 const visible=rows.filter(row=>Number(row.values.count)>0);
 const slices=visible.map((row,index)=>{
  const share=Number(row.values.count)/total,start=-Math.PI/2+visible.slice(0,index).reduce((n,r)=>n+Number(r.values.count),0)/total*Math.PI*2,angle=start+share*Math.PI*2;
  const mid=(start+angle)/2,r=86,point=(a:number)=>`${Math.cos(a)*r},${Math.sin(a)*r}`;
  const path=share===1?`M0,-${r} A${r},${r} 0 1 1 0,${r} A${r},${r} 0 1 1 0,-${r} Z`:`M0,0 L${point(start)} A${r},${r} 0 ${share>0.5?1:0} 1 ${point(angle)} Z`;
  return {row,share,path,mid,offset:row===largest?7:0};
 });
 return <div className="wb-review-pie">
  <div className="wb-pie-canvas">
   <svg viewBox="0 0 320 216" aria-label={`자사 리뷰 별점 분포 · ${total}개`}>
    {slices.map(({row,share,path,mid,offset})=><g key={row.id} className={row===largest?'wb-pie-slice largest':'wb-pie-slice'} transform={`translate(${160+Math.cos(mid)*offset},${108+Math.sin(mid)*offset})`}>
     <path d={path} fill={ratingColors[row.id]} stroke="white" strokeWidth="2" role="button" tabIndex={0} aria-label={`${row.values.name} · ${(share*100).toFixed(0)}% · ${row.values.count}개 · 근거 보기`} onPointerMove={e=>show(row,e.clientX,e.clientY)} onPointerLeave={()=>setActive(null)} onFocus={e=>{const rect=e.currentTarget.getBoundingClientRect();show(row,rect.x+rect.width/2,rect.y+rect.height/2);}} onBlur={()=>setActive(null)} onClick={()=>{setActive(null);onOpen(row);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setActive(null);onOpen(row);}if(e.key==='Escape')setActive(null);}}/>
     <text x={Math.cos(mid)*53} y={Math.sin(mid)*53-3} textAnchor="middle" fill="#302442" pointerEvents="none"><tspan>{row.values.name}</tspan><tspan x={Math.cos(mid)*53} dy="17" className="wb-pie-percent">{(share*100).toFixed(0)}%</tspan></text>
    </g>)}
   </svg>
   {active&&createPortal(<div className="wb-pie-tooltip" role="tooltip" style={{left:active.x,top:active.y}}><b>{active.row.values.name}</b><span>리뷰 {active.row.values.count}개 · 자사 표본 {total}개 중 {(Number(active.row.values.count)/total*100).toFixed(0)}%</span></div>,document.body)}
  </div>
  <div className="wb-rating-legend">{stars.map(star=><span key={star}><i style={{background:ratingColors[star]}}/>{star}점</span>)}</div>
 </div>;
}

export function ReviewProfile({rows,onOpen}:{rows:Row[];onOpen:(row:Row)=>void}){
 return <div className="wb-review-profile">
  <div className="wb-rating-head"><span>제품</span><span>별점 구성</span><span>평균 별점</span><span>표본</span></div>
  <ul>{rows.map(row=><li key={row.id}><button className="wb-rating-row" onClick={()=>onOpen(row)} aria-label={`${row.values.name} · 평균 ${format(row.values.rating,'decimal')}점 · 표본 ${row.values.count}개`}>
   <span className="wb-rating-name">{row.values.name}</span>
   <span className="wb-rating-stack" role="img" aria-label={stars.map(star=>`${star}점 ${row.values['star'+star]}개`).join(', ')}>{stars.map(star=>Number(row.values['star'+star])>0&&<span key={star} style={{width:Number(row.values['star'+star+'Pct'])+'%',background:ratingColors[star]}} title={`${star}점 · ${row.values['star'+star]}개`}/>)}</span>
   <span className="wb-rating-average">{format(row.values.rating,'decimal')}<small>점</small></span><span className="wb-rating-count">{row.values.count}<small>개</small></span>
  </button></li>)}</ul>
  <div className="wb-rating-legend">{stars.map(star=><span key={star}><i style={{background:ratingColors[star]}}/>{star}점</span>)}</div>
 </div>;
}
