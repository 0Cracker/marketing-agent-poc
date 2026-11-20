// Index of the funnel step whose step conversion rate fell the most at one decimal %p, or undefined when none fell.
export function worstStage(rates:([number|null,number|null]|null)[]){
 let worst:number|undefined,drop=0;
 rates.forEach((pair,index)=>{
  if(!pair||pair[0]===null||pair[1]===null)return;
  const change=Math.round((pair[1]-pair[0])*1000)/10;
  if(change<drop){drop=change;worst=index;}
 });
 return worst;
}
