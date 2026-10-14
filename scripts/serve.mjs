import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat,readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist');
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.mp4':'video/mp4'};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');let name=decodeURIComponent(url.pathname),p;
  if(/^\/_local-media\/[A-Za-z0-9_-]{11}\.mp4$/.test(name))p=path.resolve('source-videos',name.split('/').pop());
  else{p=path.resolve(root,'.'+name);if(p!==root&&!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}if((await stat(p)).isDirectory())p=path.join(p,'index.html');}
  const s=await stat(p),range=req.headers.range;
  const headers={'Content-Type':types[path.extname(p)]||'application/octet-stream','Cache-Control':'no-store','Accept-Ranges':'bytes'};
  if(range){const m=/^bytes=(\d+)-(\d*)$/.exec(range);if(!m){res.writeHead(416).end();return;}const start=Number(m[1]),end=m[2]?Math.min(Number(m[2]),s.size-1):s.size-1;if(start>end||start>=s.size){res.writeHead(416,{'Content-Range':`bytes */${s.size}`}).end();return;}res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${s.size}`,'Content-Length':end-start+1});if(req.method==='HEAD')res.end();else createReadStream(p,{start,end}).pipe(res);}
  else{res.writeHead(200,{...headers,'Content-Length':s.size});if(req.method==='HEAD')res.end();else createReadStream(p).pipe(res);}
 }catch{res.writeHead(404,{'Content-Type':'text/html'});res.end(await readFile(path.join(root,'404.html'),'utf8').catch(()=> 'Not found'));}
});
const port=Number(process.env.PORT||4173);server.listen(port,'127.0.0.1',()=>console.log(`Klobfactor: http://127.0.0.1:${port}`));
