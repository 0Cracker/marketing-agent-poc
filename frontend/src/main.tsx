import {createRoot} from 'react-dom/client';
import {lazy,Suspense} from 'react';
import '../app/globals.css';
import '../app/marketing.css';
const Workbench=lazy(()=>import('../workbench/workbench'));
const Home=lazy(()=>import('../app/page'));
const workbench=location.pathname==='/workbench'||location.pathname.startsWith('/workbench/');
if(workbench)document.title='퍼포먼스 마케터 대시보드 PoC';
createRoot(document.getElementById('root')!).render(<Suspense fallback={<div role="status">화면을 불러오는 중입니다.</div>}>{workbench?<Workbench/>:<Home/>}</Suspense>);
