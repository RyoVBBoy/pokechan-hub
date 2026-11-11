// ブックマークと文字サイズ（2026/11/11 依頼主）の確認：
// 本物のサーバーのプログラム（worker/dist/worker.js、D1 は Node の SQLite）にサイトをつなぎ、ログインだけにせものにする（dm.mjs と同じ形）。
// ①投稿の下の並び＝返信→リポスト→いいね→ブックマーク→共有 ②🔖で「ブックマークに追加しました」と保存、もう一度で外す
// ③左のメニューの「ブックマーク」→ #/bookmarks に保存した投稿（ほかの人には見えない・消された投稿は消える）
// ④設定とプライバシーの「文字サイズ」：見本の投稿・4段階のスライダー（X と同じ）・その場で全体の文字が変わる・この端末に保存・入力欄は16px未満にならない
import {chromium} from 'playwright';
import path from 'node:path';
import {makeD1} from './d1mock.mjs';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
const PID='pokechan-test',SHOT=process.env.SHOT||'';
const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const kp=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...(await crypto.subtle.exportKey('jwk',kp.publicKey)),kid:'k1',use:'sig',alg:'RS256'};
const T0=Math.floor(Date.now()/1000);
const tok=async uid=>{const h=enc({alg:'RS256',kid:'k1',typ:'JWT'}),p=enc({iss:'https://securetoken.google.com/'+PID,aud:PID,sub:uid,iat:T0-10,exp:T0+3600,auth_time:T0-10,email:uid+'@example.com'});
  return h+'.'+p+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',kp.privateKey,new TextEncoder().encode(h+'.'+p))).toString('base64url')};
globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
globalThis.fetch=async u=>String(u).includes('securetoken@system.gserviceaccount.com')?new Response(JSON.stringify({keys:[jwk]})):new Response('',{status:404});
const w=(await import(path.join(ROOT,'worker/dist/worker.js'))).default;
const env={DB:makeD1(),FIREBASE_PROJECT_ID:PID,APP_TOKEN:'t',ADMIN_TOKEN:'admin-secret-123'};
let clock=Date.now();const realNow=Date.now;Date.now=()=>clock;
const call=async(p,t,body)=>{clock+=16e3;const h={'content-type':'application/json','cf-connecting-ip':'10.1.0.1',origin:'null'};if(t)h.authorization='Bearer '+t;
  const r=await w.fetch(new Request('https://x.dev'+p,{method:body?'POST':'GET',headers:h,body:body?JSON.stringify(body):undefined}),env,{waitUntil(){}});return[r.status,await r.json().catch(()=>({}))]};
let n=0;const fail=m=>{console.error('NG',m);process.exitCode=1};const ok=(c,m)=>{n++;if(!c)fail(m)};
const TK={};
for(const [id,h,name] of [['uA','sakura','さくら'],['uB','ren','レン']]){TK[h]=await tok(id);const r=await call('/api/me',TK[h],{handle:h,name,bio:'',agree:true});ok(r[0]===200,'プロフィール '+h)}
const ids=[];for(const b of ['ガブリアスの型の相談です #構築相談','今日のランクバトルの結果','消える予定の投稿']){const r=await call('/api/notes',TK.ren,{body:b});ok(r[0]===200,'投稿 '+JSON.stringify(r));ids.push(r[1].note?r[1].note.id:r[1].id)}
/* サーバー：保存・一覧・ほかの人には見えない・ログインなしは断る */
{let r=await call(`/api/notes/${ids[0]}/bookmark`,TK.sakura,{on:true});ok(r[0]===200&&r[1].saved===true,'保存 '+JSON.stringify(r));
  r=await call(`/api/notes/${ids[2]}/bookmark`,TK.sakura,{on:true});ok(r[0]===200,'保存2');
  r=await call(`/api/notes/${ids[0]}/bookmark`,'',{on:true});ok(r[0]===401,'ログインなしは断る '+r[0]);
  r=await call('/api/me/bookmarks',TK.sakura);ok(r[0]===200&&r[1].notes.map(x=>x.id).join()===[ids[2],ids[0]].join()&&r[1].notes.every(x=>x.saved),'一覧は保存した新しい順 '+JSON.stringify(r[1].notes&&r[1].notes.map(x=>[x.id,x.saved])));
  r=await call('/api/me/bookmarks',TK.ren);ok(r[0]===200&&r[1].notes.length===0,'ほかの人には見えない');
  r=await call('/api/tl?tab=all',TK.sakura);ok(r[1].notes.find(x=>x.id===ids[0]).saved===true&&r[1].notes.find(x=>x.id===ids[1]).saved===false,'タイムラインにも保存済みの印');
  r=await call('/api/tl?tab=all',TK.ren);ok(r[1].notes.every(x=>!x.saved),'投稿した人の画面には印が出ない');
  r=await call(`/api/notes/${ids[2]}/delete`,TK.ren,{});ok(r[0]===200,'投稿を消す');
  r=await call('/api/me/bookmarks',TK.sakura);ok(r[1].notes.map(x=>x.id).join()===String(ids[0]),'消された投稿は一覧から消える');
  r=await call(`/api/notes/${ids[0]}/bookmark`,TK.sakura,{on:false});r=await call('/api/me/bookmarks',TK.sakura);ok(r[1].notes.length===0,'外すと一覧から消える');
  r=await call(`/api/notes/999999/bookmark`,TK.sakura,{on:true});ok(r[0]===404,'ない投稿は保存できない')}
Date.now=realNow;

const FB_APP=`export const initializeApp=c=>({c});`;
const FB_AUTH=`const who=localStorage.getItem('fakeuser');let user=who?{uid:who,email:who+'@example.com',getIdToken:async()=>window.__TOKS[who]}:null;const cbs=[];
export const getAuth=()=>({});export const onAuthStateChanged=(a,f)=>{cbs.push(f);setTimeout(()=>f(user),0)};
export class GoogleAuthProvider{};export class OAuthProvider{constructor(id){this.id=id}addScope(){}};
export const signInWithPopup=async()=>{};export const signInWithRedirect=signInWithPopup;export const signOut=async()=>{user=null;cbs.forEach(f=>f(null))};
export const sendSignInLinkToEmail=async()=>{};export const isSignInWithEmailLink=()=>false;export const signInWithEmailLink=async()=>{};`;
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
async function page(who,vp={width:390,height:844},o={}){
  const ctx=await b.newContext({viewport:vp,locale:'ja-JP',deviceScaleFactor:SHOT?2:1,hasTouch:vp.width<700,isMobile:vp.width<700});
  await ctx.addInitScript(([who,toks])=>{try{if(who){localStorage.setItem('fakeuser',who);localStorage.setItem('pcin','1')}localStorage.setItem('pcstart','1');if(!localStorage.getItem('pctheme'))localStorage.setItem('pctheme','dark')}catch(e){}window.__TOKS=toks},[who,TK]);
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.errs=errs;pg.ctx=ctx;
  await pg.route('**/*',async r=>{const u=new URL(r.request().url());
    const js={status:200,headers:{'Access-Control-Allow-Origin':'*','Content-Type':'text/javascript'}};
    if(u.host==='www.gstatic.com'&&u.pathname.endsWith('/firebase-app.js'))return r.fulfill({...js,body:FB_APP});
    if(u.host==='www.gstatic.com'&&u.pathname.endsWith('/firebase-auth.js'))return r.fulfill({...js,body:FB_AUTH});
    if(u.protocol==='file:')return r.continue();
    if(u.pathname.startsWith('/api/')){const q=r.request(),h=Object.fromEntries(Object.entries(q.headers()));h['cf-connecting-ip']='10.2.0.9';delete h.origin;
      const res=await w.fetch(new Request('https://x.dev'+u.pathname+u.search,{method:q.method(),headers:h,body:['GET','HEAD'].includes(q.method())?undefined:q.postData()}),env,{waitUntil(){}});
      return r.fulfill({status:res.status,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Content-Type':'application/json'},body:await res.text()})}
    return r.fulfill({status:404,body:''})});
  return pg}
const shot=async(pg,name)=>{if(SHOT)await pg.screenshot({path:path.join(SHOT,name+'.png')})};

for(const W of [390,1280]){
  const pg=await page('sakura',{width:W,height:W<700?844:900});
  await pg.goto(URL0+'#/tl');await pg.waitForSelector('.tw[data-id]',{timeout:15000});await pg.waitForTimeout(500);
  /* ① 並び */
  const order=await pg.$eval('.tw .tw-a',a=>[...a.children].map(b=>b.getAttribute('aria-label')).join('>'));
  ok(order==='返信>リポスト>いいね>ブックマーク>共有',W+'：並び '+order);
  const box=await pg.$eval('.tw .tw-a',a=>{const r=a.getBoundingClientRect();return [...a.children].every(b=>{const x=b.getBoundingClientRect();return x.right<=r.right+1&&x.height>=32})});
  ok(box,W+'：5つのボタンが行に収まる');
  /* ② 🔖：トースト・サーバーに保存・もう一度で外す */
  const id=+(await pg.$eval('.tw',e=>e.dataset.id));
  await pg.click(`.tw[data-id="${id}"] [data-bm]`);await pg.waitForTimeout(400);
  const t1=await pg.evaluate(id=>[document.querySelector(`.tw[data-id="${id}"] [data-bm]`).getAttribute('aria-pressed'),[...document.querySelectorAll('.toast')].map(x=>x.textContent).join('|')],id);
  ok(t1[0]==='true'&&t1[1].includes('ブックマークに追加しました'),W+'：🔖でトースト '+t1);
  const sv=await call('/api/me/bookmarks',TK.sakura);ok(sv[1].notes.some(x=>x.id===id),W+'：サーバーに保存された');
  if(W===390)await shot(pg,'bm-saved');
  /* ③ 左のメニュー→ブックマークの一覧 */
  await pg.evaluate(()=>{DR.el&&(DR.el.innerHTML='');drawerOpen()});await pg.waitForTimeout(600);
  ok(await pg.evaluate(()=>{const a=[...document.querySelectorAll('#drawer .dr-i')].map(x=>x.textContent.trim());return a.includes('ブックマーク')&&a.indexOf('ブックマーク')===a.indexOf('メッセージ')+1}),W+'：メニューにブックマーク');
  await pg.click('#drawer a[href="#/bookmarks"]');await pg.waitForTimeout(900);
  const bl=await pg.evaluate(()=>[location.hash,document.querySelector('.hd-t,#hd-t,header h1')?.textContent||document.title,[...document.querySelectorAll('#bm-list .tw')].map(x=>+x.dataset.id),document.querySelector('#bm-list .tw [data-bm]')?.getAttribute('aria-pressed')]);
  ok(bl[0]==='#/bookmarks'&&bl[2].length===1&&bl[2][0]===id&&bl[3]==='true',W+'：ブックマークの一覧 '+JSON.stringify(bl));
  if(W===390)await shot(pg,'bm-list');
  /* 外すとトースト・サーバーからも消える */
  await pg.click(`#bm-list .tw [data-bm]`);await pg.waitForTimeout(400);
  ok(await pg.evaluate(()=>[...document.querySelectorAll('.toast')].some(x=>x.textContent.includes('ブックマークから削除しました'))),W+'：外したときのトースト');
  ok((await call('/api/me/bookmarks',TK.sakura))[1].notes.length===0,W+'：外すとサーバーからも消える');
  /* 共有：共有の画面が使えなければリンクをコピー */
  await pg.evaluate(()=>{navigator.share=undefined;window.__cp='';navigator.clipboard.writeText=async t=>{window.__cp=t}});
  await pg.click('#bm-list .tw [data-share]');await pg.waitForTimeout(300);
  const cp=await pg.evaluate(()=>[window.__cp,[...document.querySelectorAll('.toast')].map(x=>x.textContent).join('|')]);
  ok(cp[0].endsWith('#/n/'+id)&&cp[1].includes('リンクをコピーしました'),W+'：共有はリンクをコピー '+cp);
  /* ④ 文字サイズ */
  await pg.evaluate(()=>settingsOpen());await pg.waitForTimeout(500);
  ok(await pg.evaluate(()=>{const r=document.querySelector('#setm [data-sm-go=fs]');return !!r&&document.getElementById('sm-v-fs').textContent==='標準'}),W+'：設定に「文字サイズ」標準');
  await pg.click('#setm [data-sm-go=fs]');await pg.waitForTimeout(400);
  const fs0=await pg.evaluate(()=>({t:document.getElementById('sm-t').textContent,prev:!!document.querySelector('#setm .fs-prev .tw .tw-b'),r:document.getElementById('fs-r')?.value,
    body:parseFloat(getComputedStyle(document.body).fontSize),tw:parseFloat(getComputedStyle(document.querySelector('#setm .fs-prev .tw-b')).fontSize),inert:document.querySelector('#setm .fs-prev').inert}));
  ok(fs0.t==='文字サイズ'&&fs0.prev&&fs0.r==='1'&&fs0.inert,W+'：見本の投稿とスライダー '+JSON.stringify(fs0));
  if(W===390)await shot(pg,'fs-2');
  /* いちばん大きく：その場で見本・後ろの画面・設定の画面の文字が大きくなる（読み直さない） */
  await pg.evaluate(()=>{window.__noReload=1});
  const r=await pg.$('#fs-r');const rb=await r.boundingBox();
  await pg.mouse.click(rb.x+rb.width-4,rb.y+rb.height/2);await pg.waitForTimeout(200);
  const fs4=await pg.evaluate(()=>({r:document.getElementById('fs-r').value,cur:document.getElementById('fs-cur').textContent,save:localStorage.getItem('pcfs2'),ic:document.querySelector('#bm-list .tw-a svg').getBoundingClientRect().width,k:getComputedStyle(document.documentElement).getPropertyValue('--fsk').trim(),
    body:parseFloat(getComputedStyle(document.body).fontSize),tw:parseFloat(getComputedStyle(document.querySelector('#setm .fs-prev .tw-b')).fontSize),
    back:parseFloat(getComputedStyle(document.querySelector('#bm-list .tw-b')).fontSize),title:parseFloat(getComputedStyle(document.getElementById('sm-t')).fontSize),noReload:window.__noReload,
    dots:document.querySelectorAll('#setm .fs-dots i.on').length}));
  ok(fs4.r==='3'&&fs4.cur==='とても大きい'&&fs4.save==='3'&&fs4.k==='1.124'&&fs4.dots===4&&fs4.noReload===1&&fs4.ic===23,W+'：いちばん大きいを選ぶと保存・絵の大きさは変わらない（X と同じ） '+JSON.stringify(fs4));
  ok(Math.abs(fs4.tw/fs0.tw-1.124)<.02&&Math.abs(fs4.body/fs0.body-1.124)<.02&&fs4.back>fs0.tw,W+'：その場で全体の文字が1.124倍 '+[fs0.tw,fs4.tw,fs0.body,fs4.body,fs4.back]);
  if(W===390)await shot(pg,'fs-4');
  /* いちばん小さく：入力欄は16px未満にならない（iPhone が拡大しないように） */
  await pg.focus('#fs-r');await pg.keyboard.press('Home');await pg.waitForTimeout(200);
  const fs1=await pg.evaluate(()=>({r:document.getElementById('fs-r').value,tw:parseFloat(getComputedStyle(document.querySelector('#setm .fs-prev .tw-b')).fontSize)}));
  ok(fs1.r==='0'&&Math.abs(fs1.tw/fs0.tw-.933)<.02,W+'：小さい '+JSON.stringify(fs1));
  ok(await pg.evaluate(()=>{const ok=[];for(const el of document.querySelectorAll('input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=file]),textarea')){const s=getComputedStyle(el);if(s.display!=='none'&&parseFloat(s.fontSize)<15.9&&innerWidth<700)ok.push(el.id||el.className+':'+s.fontSize)}return !ok.length||ok}),W+'：入力欄は16px以上のまま');
  /* キーボード：矢印で1段ずつ */
  await pg.focus('#fs-r');await pg.keyboard.press('ArrowRight');await pg.waitForTimeout(100);
  ok(await pg.evaluate(()=>document.getElementById('fs-r').value==='1'&&localStorage.getItem('pcfs2')==='1'),W+'：矢印キーで1段');
  /* 一覧に戻ると右の表示が変わっている */
  await pg.click('#setm [data-sm=back]');await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>document.getElementById('sm-v-fs').textContent==='標準'),W+'：一覧の右の表示');
  /* 読み直しても同じ大きさ */
  /* 起動したときに保存した大きさになる（新しいページを、大きさ3を保存した状態で開く。テストのブラウザは保存の直後に読み直すと書きこみが間に合わないことがあるため） */
  const p2=await pg.ctx.newPage();await p2.route(/^https?:/,r=>r.abort());await p2.addInitScript(()=>{try{localStorage.removeItem('pcfs2');localStorage.setItem('pcfs','3')}catch(e){}});
  await p2.goto(URL0+'#/tools');await p2.waitForTimeout(500);
  const rl=await p2.evaluate(()=>({k:getComputedStyle(document.documentElement).getPropertyValue('--fsk').trim(),body:parseFloat(getComputedStyle(document.body).fontSize),v:SM_VAL.fs()}));await p2.close();
  ok(rl.k==='1.067'&&rl.v==='大きい'&&Math.abs(rl.body/fs0.body-1.067)<.02,W+'：前の5段階の「やや大きい」を選んでいた人は「大きい」になる '+JSON.stringify(rl));
  await pg.evaluate(()=>{localStorage.removeItem('pcfs');localStorage.removeItem('pcfs2')});
  ok(!pg.errs.length,W+'：エラー '+pg.errs);await pg.ctx.close();
}
/* ログインしていないとき：🔖はログインへ・ブックマークの画面は案内 */
{const pg=await page('');await pg.goto(URL0+'#/tl');await pg.waitForSelector('.tw[data-id]',{timeout:15000});await pg.waitForTimeout(400);
  await pg.click('.tw [data-bm]');await pg.waitForTimeout(400);
  ok(await pg.evaluate(()=>location.hash==='#/account'&&[...document.querySelectorAll('.toast')].some(x=>x.textContent.includes('ブックマークするにはログイン'))),'ログインなしの🔖');
  await pg.goto(URL0+'#/bookmarks');await pg.waitForTimeout(900);
  ok(await pg.evaluate(()=>!!document.querySelector('#view .bnote a[href="#/account"]')),'ログインなしのブックマークの画面');
  ok(!pg.errs.length,'エラー '+pg.errs);await pg.ctx.close()}
await b.close();
console.log(process.exitCode?'bookmark: NG':`bookmark: OK（${n}項目）`);
