import {createServer} from 'node:http';
import {existsSync,readFileSync} from 'node:fs';
import {createHash,randomBytes} from 'node:crypto';
import {createRunRoutes,RunApiError} from './index.mjs';

const chatBuild=new URL('../../../.agent-state/trace-ui/',import.meta.url);
const fonts=new URL('../../../frontend/public/fonts/',import.meta.url);
const contentTypes={js:'text/javascript',css:'text/css',woff2:'font/woff2'};

export function createTraceServer(store,{engine,loadData,mode,port:tracePort}={}) {
  const html=readFileSync(new URL('./trace.html',import.meta.url),'utf8').replace(/\r\n?/g,'\n');
  const scriptHash=createHash('sha256').update(html.match(/<script>([\s\S]*?)<\/script>/)[1]).digest('base64');
  const origins=new Set(['http://127.0.0.1:'+tracePort,'http://localhost:'+tracePort]);
  const token=engine?randomBytes(32).toString('hex'):null;
  const routes=engine&&createRunRoutes({store,engine,authContext:{
    allowedOrigins:origins,
    verify({req}) {
      if(req.headers['x-agent-token']!==token)throw new RunApiError('authentication_required');
      return {accountId:'qa-local',browserId:'operator-local-browser'};
    }
  }});
  const server=createServer(async(req,res)=>{
    function send(status,body,type='application/json',chat=false) {
      const csp=chat?"default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'":
        `default-src 'none'; script-src 'sha256-${scriptHash}'; style-src 'unsafe-inline'; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`;
      res.writeHead(status,{
        'content-type':type+(type==='font/woff2'?'':'; charset=utf-8'),
        'cache-control':'no-store',
        'x-content-type-options':'nosniff',
        'cross-origin-resource-policy':'same-origin',
        'referrer-policy':'no-referrer',
        'content-security-policy':csp
      });
      res.end(type==='application/json'?JSON.stringify(body):body);
    }
    const {host,origin,'sec-fetch-site':site}=req.headers;
    const port=server.address()?.port;
    // The static shell can be opened from a link, while its data stays same-origin.
    const shellRequest=req.method==='GET'&&req.url?.split('?')[0]==='/agent-trace';
    if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(host)||
       (origin&&origin!==`http://${host}`)||(site&&!['same-origin','none'].includes(site)&&!shellRequest)) {
      return send(403,{error:'local_only'});
    }
    try {
      const url=new URL(req.url,'http://127.0.0.1');
      if(routes&&await routes.handle(req,res))return;
      if(req.method!=='GET')return send(405,{error:'method_not_allowed'});
      if(url.pathname==='/agent-trace')return send(200,html,'text/html');
      if(routes&&url.pathname==='/agent-api/session')return send(200,{token,mode,externalModelEnabled:mode==='remote_model',realAdsEnabled:false});
      if(loadData&&url.pathname==='/agent-trace/data')return send(200,loadData());
      if(url.pathname==='/agent-trace/chat') {
        const entry=new URL('agent-trace-chat.html',chatBuild);
        const ready=routes&&existsSync(entry);
        return send(ready?200:503,ready?readFileSync(entry):
          '<!doctype html><html lang="ko"><meta charset="utf-8"><p>채팅을 열려면 npm run build:agent-trace 실행 후 새로고침해 주세요.</p></html>',
          'text/html',true);
      }
      const asset=url.pathname.match(/^\/assets\/([a-z0-9_-]+\.(js|css))$/i);
      const font=url.pathname.match(/^\/fonts\/(PretendardVariable\.woff2|SUIT-Variable\.woff2)$/);
      if(asset||font) {
        const resource=asset?new URL('assets/'+asset[1],chatBuild):new URL(font[1],fonts);
        if(existsSync(resource))return send(200,readFileSync(resource),contentTypes[asset?asset[2]:'woff2']);
      }
      if(url.pathname==='/agent-trace/runs')return send(200,store.listTraceRuns());
      const run=url.pathname.match(/^\/agent-trace\/runs\/([a-f0-9-]{36})(\/original)?$/i);
      if(!run)return send(404,{error:'not_found'});
      const after=url.searchParams.get('afterEventSeq')??'0';
      if(!/^\d+$/.test(after)||!Number.isSafeInteger(Number(after)))return send(400,{error:'invalid_cursor'});
      const result=store.getTraceRun(run[1],Number(after),Boolean(run[2]));
      return result?send(200,result):send(404,{error:'run_not_found'});
    } catch {
      if(res.headersSent)return res.end();
      return send(500,{error:'trace_unavailable'});
    }
  });
  return server;
}
