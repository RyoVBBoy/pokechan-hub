// セキュリティの決まり（_headers の CSP など）を付けた状態でサイトを開き、決まりのせいで止まった読み込みが無いかを確かめる
// （2026/11/05 セキュリティ対策。file:// で開く site.mjs では、Cloudflare Pages が付ける見出しを確かめられないため）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..'),DIST=path.join(ROOT,'dist');
const fail=m=>{console.error('NG '+m);process.exitCode=1};
/* _headers の「/*」の見出しを読む */
const hdr={};let on=false;
for(const l of fs.readFileSync(path.join(DIST,'_headers'),'utf8').split('\n')){
  if(!l.startsWith(' ')){on=l.trim()==='/*';continue}
  if(on){const i=l.indexOf(':');hdr[l.slice(0,i).trim()]=l.slice(i+1).trim()}
}
for(const k of ['Content-Security-Policy','Strict-Transport-Security','X-Content-Type-Options','X-Frame-Options','Referrer-Policy','Permissions-Policy'])if(!hdr[k])fail('見出しがありません: '+k);
const csp=hdr['Content-Security-Policy']||'';
for(const k of ["object-src 'none'","base-uri 'none'","frame-ancestors 'none'","default-src 'self'"])if(!csp.includes(k))fail('CSP に '+k+' がありません');
if(/script-src[^;]*'unsafe-inline'/.test(csp)||/script-src[^;]*'unsafe-eval'/.test(csp))fail('script-src にゆるい許可（unsafe-inline / unsafe-eval）があります');
if(fs.existsSync(path.join(DIST,'single.html')))fail('single.html を公開しようとしています');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};
const srv=http.createServer((req,res)=>{
  let p=decodeURIComponent(new URL(req.url,'http://x').pathname);if(p.endsWith('/'))p+='index.html';
  const f=path.join(DIST,p);if(!f.startsWith(DIST)||!fs.existsSync(f)){res.writeHead(404);return res.end()}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream',...hdr});fs.createReadStream(f).pipe(res);
}).listen(0);
const port=srv.address().port,BASE=`http://localhost:${port}/`;
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const pg=await (await b.newContext({locale:'ja-JP'})).newPage();
const bad=[];
pg.on('console',m=>{if(/Content Security Policy|Refused to/.test(m.text()))bad.push(m.text().slice(0,220))});
pg.on('pageerror',e=>bad.push('JS: '+e.message));
await pg.route(/^https?:/,r=>{const u=r.request().url();return u.startsWith(BASE)?r.continue():r.abort()});   // 外へは出ない（決まりの判定は通信の前に行われる）
const screens=['#/','#/tools','#/dex','#/p/445','#/p/681','#/team','#/assist','#/calc','#/learn','#/meta','#/community','#/search','#/account','#/season','#/u/someone','#/tier','#/pair','#/replay','#/import','#/types','#/contact/','#/news'];
for(const h of screens){await pg.goto(BASE+h);await pg.waitForTimeout(500)}
/* 画面の中で作るもの（画像・PiP 用の部品）も止められないか */
await pg.evaluate(()=>new Promise(r=>{const i=new Image();i.onload=i.onerror=r;i.src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII='}));
await b.close();srv.close();
const uniq=[...new Set(bad)];
if(uniq.length)fail('セキュリティの決まりで止まったもの・エラー：\n'+uniq.join('\n'));
console.log(process.exitCode?'csp: NG':`csp: OK （${screens.length}画面・見出し${Object.keys(hdr).length}つ）`);
