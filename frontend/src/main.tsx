import {createRoot} from 'react-dom/client';
import {lazy,Suspense} from 'react';
import '../roas/base.css';
import '../roas/workbench.css';
const Dashboard=lazy(()=>import('../roas/training-dashboard'));
document.title='퍼포먼스 마케터 대시보드 PoC';
createRoot(document.getElementById('root')!).render(<Suspense fallback={<div role="status">화면을 불러오는 중입니다.</div>}><Dashboard active={true}/></Suspense>);
