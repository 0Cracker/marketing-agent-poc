import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {TrainingData} from '../../shared/roas/training-dashboard.mjs';
import {RoasConversation} from '../roas/roas-conversation';
import '../roas/workbench.css';
import './agent-trace-chat.css';

const filters={channel:'all',source:'all',campaignId:'all',device:'all'} as const;
const selectRun=(runId:string)=>window.parent.postMessage({type:'agent-trace-run',runId},window.location.origin);

function TraceChat(){
  const [data,setData]=useState<TrainingData>();
  const [error,setError]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    void fetch('/agent-trace/data',{signal:controller.signal}).then(response=>{
      if(!response.ok)throw Error('data_unavailable');
      return response.json() as Promise<TrainingData>;
    }).then(setData).catch(()=>{if(!controller.signal.aborted)setError(true);});
    return ()=>controller.abort();
  },[]);
  return <main className="wb trace-chat">
    {data?<RoasConversation data={data} snapshot="initial" filters={filters} metric="" screenTitle="성과 현황"
      exchanges={[]} onExchange={()=>{}} apiBase="/agent-api" onRunSelected={selectRun}/>
      :<p role={error?'alert':'status'}>{error?'S16 데이터를 불러오지 못했습니다. 새로고침해 주세요.':'S16 데이터를 불러오는 중입니다.'}</p>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<TraceChat/>);
