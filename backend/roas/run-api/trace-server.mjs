import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

export function createTraceServer(store) {
  const html=readFileSync(new URL('./trace.html',import.meta.url),'utf8').replace(/\r\n?/g,'\n');
  const scriptHash=createHash('sha256').update(html.match(/<script>([\s\S]*?)<\/script>/)[1]).digest('base64');
  const server=createServer((req,res)=>{
    function send(status,body,htmlResponse=false) {
      res.writeHead(status,{
        'content-type':(htmlResponse?'text/html':'application/json')+'; charset=utf-8',
        'cache-control':'no-store',
        'x-content-type-options':'nosniff',
        'cross-origin-resource-policy':'same-origin',
        'referrer-policy':'no-referrer',
        'content-security-policy':`default-src 'none'; script-src 'sha256-${scriptHash}'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`
      });
      res.end(htmlResponse?body:JSON.stringify(body));
    }
    const {host,origin,'sec-fetch-site':site}=req.headers;
    const port=server.address()?.port;
    // The static shell can be opened from a link, while its data stays same-origin.
    const shellRequest=req.method==='GET'&&req.url?.split('?')[0]==='/agent-trace';
    if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(host)||
       (origin&&origin!==`http://${host}`)||(site&&!['same-origin','none'].includes(site)&&!shellRequest)) {
      return send(403,{error:'local_only'});
    }
    if(req.method!=='GET')return send(405,{error:'read_only'});
    try {
      const url=new URL(req.url,'http://127.0.0.1');
      if(url.pathname==='/agent-trace')return send(200,html,true);
      if(url.pathname==='/agent-trace/runs')return send(200,store.listTraceRuns());
      const run=url.pathname.match(/^\/agent-trace\/runs\/([a-f0-9-]{36})(\/original)?$/i);
      if(!run)return send(404,{error:'not_found'});
      const after=url.searchParams.get('afterEventSeq')??'0';
      if(!/^\d+$/.test(after)||!Number.isSafeInteger(Number(after)))return send(400,{error:'invalid_cursor'});
      const result=store.getTraceRun(run[1],Number(after),Boolean(run[2]));
      return result?send(200,result):send(404,{error:'run_not_found'});
    } catch {
      return send(500,{error:'trace_unavailable'});
    }
  });
  return server;
}
