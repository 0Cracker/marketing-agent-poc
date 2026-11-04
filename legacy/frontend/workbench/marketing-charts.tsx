import {PieChart,Pie,Cell,Tooltip,ResponsiveContainer} from 'recharts';
import type {Chart,Row} from './contract';
const colors=['#8968C6','#A796D6','#C3B9DF','#BD8DB5','#D3A8C9','#B8BFCC'];
const number=(value:unknown)=>typeof value==='number'?value.toLocaleString('ko-KR',{maximumFractionDigits:1}):String(value??'—');
export function MarketingChart({chart,onOpen}:{chart:Chart;onOpen:(row:Row)=>void}){
 const key=chart.series[0]?.key||'v0';
 if(chart.kind==='donut'){
  const total=chart.data.reduce((n,r)=>n+Number(r.values[key]||0),0),data=chart.data.map(r=>({name:String(r.values.name),value:Number(r.values[key]||0),row:r}));
  return <div className="wb-marketing-donut"><div className="wb-donut-plot"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" innerRadius="61%" outerRadius="90%" paddingAngle={2} isAnimationActive={false} onClick={(_,index)=>onOpen(chart.data[index])}>{data.map((d,i)=><Cell key={d.name} fill={colors[i%colors.length]}/>)}</Pie><Tooltip formatter={v=>[number(v)+' '+chart.unit,'표본']} /></PieChart></ResponsiveContainer><div className="wb-donut-total"><b>{number(total)}</b><span>{chart.unit}</span></div></div><div className="wb-donut-key">{data.map((d,i)=><button key={d.name} onClick={()=>onOpen(d.row)}><i style={{background:colors[i%colors.length]}}/><span>{d.name}</span><b>{number(d.value)}</b><small>{total?(d.value/total*100).toFixed(1):'0'}%</small></button>)}</div></div>;
 }
 if(chart.kind==='stages')return <div className="wb-stage-grid">{chart.data.map((r,i)=><button key={r.id} onClick={()=>onOpen(r)}><span>{String(r.values.name)}</span><strong>{number(r.values[key])}<small>{chart.unit}</small></strong><i style={{background:colors[i%colors.length]}}/></button>)}</div>;
 if(chart.kind==='comparison')return <div className="wb-comparison"><table><thead><tr><th>비교 대상</th>{chart.series.map(s=><th key={s.key}>{s.name}</th>)}</tr></thead><tbody>{chart.data.map(r=><tr key={r.id}><th><button onClick={()=>onOpen(r)}>{String(r.values.name)}</button></th>{chart.series.map(s=><td key={s.key}>{number(r.values[s.key])}</td>)}</tr>)}</tbody></table></div>;
 if(chart.kind==='range'){
  const all=chart.data.flatMap(r=>[Number(r.values.min),Number(r.values.max)]).filter(Number.isFinite),low=Math.min(...all)*.9,high=Math.max(...all)*1.05,position=(v:unknown)=>(Number(v)-low)/(high-low||1)*100;
  return <div className="wb-range-list">{chart.data.map(r=><button key={r.id} onClick={()=>onOpen(r)}><span>{String(r.values.name)}</span><div><i style={{left:position(r.values.min)+'%',width:(position(r.values.max)-position(r.values.min))+'%'}}/><b style={{left:position(r.values.median)+'%'}}/></div><span>{number(r.values.min)}–{number(r.values.max)}</span></button>)}<p>같은 제품의 판매처별 최저–최고 가격 · 점은 중앙값</p></div>;
 }
 if(chart.kind==='calendar'){
  const names=[...new Set(chart.data.map(r=>String(r.values.name)))],dates=[...new Set(chart.data.map(r=>String(r.values.date)))].sort();
  if(!dates.length)return <p>기록된 사건이 없습니다.</p>;
  const start=new Date(dates[0]+'T00:00:00Z'),end=new Date(dates.at(-1)!+'T00:00:00Z'),days:string[]=[];
  for(let d=+start;d<=+end;d+=86400000)days.push(new Date(d).toISOString().slice(0,10));
  return <div className="wb-observation-calendar"><div style={{minWidth:Math.max(280,days.length*23+140)}}><div className="wb-calendar-head"><span>{dates[0].slice(0,7).replace('-','.')}</span><div style={{gridTemplateColumns:`repeat(${days.length},minmax(21px,1fr))`}}>{days.map(d=><span key={d}>{d.slice(-2)}</span>)}</div></div>{names.map(name=><div className="wb-calendar-row" key={name}><b>{name}</b><div style={{gridTemplateColumns:`repeat(${days.length},minmax(21px,1fr))`}}>{days.map(date=>{const entries=chart.data.filter(r=>r.values.name===name&&r.values.date===date),r=entries[0],status=r?String(r.values.status):'unknown';return <button key={date} disabled={!r} className={'state-'+status} title={`${name} · ${date} · ${r?String(r.values.detail||r.values.status):'기록 없음'}`} aria-label={`${name} ${date} ${r?String(r.values.detail||r.values.status):'기록 없음'}`} onClick={()=>r&&onOpen({...r,source:entries.flatMap(e=>e.source)})}>{status==='incident'?number(r.values.hours)+'h':status==='out'?'!':''}</button>;})}</div></div>)}</div><p><i className="legend-observed"/>관측됨 <i className="legend-incident"/>장애·품절 관측 <i className="legend-unknown"/>기록 없음</p></div>;
 }
 return null;
}
