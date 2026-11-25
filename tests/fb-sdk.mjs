// Firebase の本物の SDK を読みこんで確かめる（docs/secure-link-posting-runbook.md §6）。外へは一切つながない。
// ・tools/firebase-blocking/index.js を firebase-functions 7.x で読みこみ、2つのブロッキング関数が登録されること（種類・合言葉の名前）
// ・関数を run(event) で動かす：承認された環境がない（はじめ）→ 外へ送らず止める答え／承認された環境 → その Worker だけに送る・答えの環境が違えば止める
// ・tools/firebase-adapter の firebase-admin が読みこめること
// 道具は各フォルダで `npm ci --ignore-scripts`（ロックファイルの版）。入っていなければ、FB_SDK_TEST=1（テストだけの CI）のときは失敗、ほかは「入っていない」と書いて飛ばす。
import path from 'node:path';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const BL=path.join(ROOT,'tools/firebase-blocking'),AD=path.join(ROOT,'tools/firebase-adapter');
const have=d=>fs.existsSync(path.join(d,'node_modules'));
if(!have(BL)||!have(AD)){
  if(process.env.FB_SDK_TEST==='1'){console.error('fb-sdk: NG（tools/firebase-blocking と tools/firebase-adapter で npm ci --ignore-scripts が要る）');process.exit(1)}
  console.log('fb-sdk: 道具が入っていないので飛ばしました（テストだけの CI では FB_SDK_TEST=1 で必ず動かす）');process.exit(0)}
let n=0,bad=0;const ok=(c,m,i)=>{n++;if(!c){bad++;console.error('NG',m,JSON.stringify(i)?.slice(0,300))}};
const req=createRequire(path.join(BL,'index.js'));
const ver=(dir,pk)=>JSON.parse(fs.readFileSync(path.join(dir,'node_modules',pk,'package.json'),'utf8')).version;
const lock=JSON.parse(fs.readFileSync(path.join(BL,'package-lock.json'),'utf8'));
ok(ver(BL,'firebase-functions')===lock.packages['node_modules/firebase-functions'].version&&ver(BL,'firebase-admin')===lock.packages['node_modules/firebase-admin'].version,'入っている版がロックファイルと同じ','');
/* 外への通信は、ここで答える（記録して、本物には出さない） */
const SENT=[];let ANSWER={deny:false,env:'stg-env'};
globalThis.fetch=async(u,o={})=>{SENT.push({u:String(u),o});return new Response(JSON.stringify(ANSWER),{status:200,headers:{'content-type':'application/json'}})};
process.env.FB_HOOK_TOKEN='hook-token-sdk-0123456789abcdef-0123';
const load=(map,proj,name)=>{for(const k of Object.keys(req.cache))if(k.startsWith(BL+path.sep)&&!k.includes('node_modules'))delete req.cache[k];
  if(map){const p=req.resolve('./firebase-env.json');req.cache[p]={id:p,filename:p,loaded:true,exports:map}}
  process.env.GCLOUD_PROJECT=proj;process.env.FB_ENV=name||'';process.env.FB_HOOK_ON_ERROR='deny';return req('./index.js')};
const runGate=async(fn,user)=>{try{await fn.run({data:user,eventType:'providers/cloud.auth/eventTypes/user.beforeCreate'});return'allow'}catch(e){return e&&e.code==='permission-denied'?'deny':'error:'+(e&&e.message)}};
/* 1. はじめの対応表（どれも承認されていない） */
let m=load(null,'pokechan-hub','production');
for(const [k,ev] of [['beforecreated','beforeCreate'],['beforesignedin','beforeSignIn']]){
  const f=m[k],ep=f&&f.__endpoint;
  ok(typeof f==='function'&&typeof f.run==='function'&&ep&&ep.platform==='gcfv2'&&ep.blockingTrigger&&ep.blockingTrigger.eventType==='providers/cloud.auth/eventTypes/user.'+ev,'ブロッキング関数として登録される：'+k,ep&&ep.blockingTrigger);
  ok(ep&&JSON.stringify(ep.secretEnvironmentVariables)===JSON.stringify([{key:'FB_HOOK_TOKEN'}]),'合言葉は FB_HOOK_TOKEN だけを使う：'+k,ep&&ep.secretEnvironmentVariables)}
SENT.length=0;
ok(await runGate(m.beforecreated,{uid:'u1',email:'a@b.jp',emailVerified:true})==='deny'&&SENT.length===0,'承認された環境がない（はじめ）：外へ送らず、止める答え（はじめの決まり）',SENT);
/* 2. 承認された環境（テスト用の対応表）・動いているプロジェクトが同じ */
const MAP={environments:{production:{approved:false,project:'pokechan-hub',worker:'https://pokechan-tap.pokechan.workers.dev',workerEnvId:'prod'},staging:{approved:true,project:'stg-proj',worker:'https://stg.example.workers.dev',workerEnvId:'stg-env'}}};
m=load(MAP,'stg-proj','staging');SENT.length=0;ANSWER={deny:false,env:'stg-env'};
ok(await runGate(m.beforecreated,{uid:'u2',email:'a@b.jp',emailVerified:false})==='allow','承認された環境の Worker が deny:false なら通す','');
ok(SENT.length===1&&SENT[0].u==='https://stg.example.workers.dev/api/fb/check'&&SENT[0].o.redirect==='error'&&SENT[0].o.signal instanceof AbortSignal,'その環境の Worker だけに送る（転送に従わない・止められる）',SENT.map(x=>x.u));
ok(JSON.parse(SENT[0].o.body).email===null,'確認されていないメールは送らない',SENT[0].o.body);
ANSWER={deny:true,env:'stg-env'};ok(await runGate(m.beforesignedin,{uid:'u3'})==='deny','deny:true なら止める','');
ANSWER={deny:false,env:'prod'};SENT.length=0;ok(await runGate(m.beforecreated,{uid:'u4'})==='deny','答えの環境が違えば（本番の Worker の答えなど）、届かなかったのと同じ＝止める',SENT.length);
/* 3. 動いているプロジェクトが対応表と違う（テストの関数から本番へ送らない） */
m=load(MAP,'pokechan-hub','staging');SENT.length=0;ANSWER={deny:false,env:'stg-env'};
ok(await runGate(m.beforecreated,{uid:'u5'})==='deny'&&SENT.length===0,'動いているプロジェクトが違えば外へ送らない',SENT);
/* 4. アダプターの SDK */
{const ar=createRequire(path.join(AD,'adapter.mjs'));const al=JSON.parse(fs.readFileSync(path.join(AD,'package-lock.json'),'utf8'));
  ok(ver(AD,'firebase-admin')===al.packages['node_modules/firebase-admin'].version,'アダプターの firebase-admin もロックファイルと同じ版','');
  const app=await import(ar.resolve('firebase-admin/app')),au=await import(ar.resolve('firebase-admin/auth'));
  ok(typeof app.initializeApp==='function'&&typeof app.cert==='function'&&typeof au.getAuth==='function','アダプターが使う関数がある（initializeApp・cert・getAuth）','')}
console.log(bad?`fb-sdk: NG（${bad}/${n}）`:`fb-sdk: OK（${n}項目・firebase-functions ${ver(BL,'firebase-functions')}・firebase-admin ${ver(BL,'firebase-admin')}）`);if(bad)process.exit(1);
