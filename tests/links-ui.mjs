// タイムラインのリンクの画面の確認（docs/secure-link-posting-handoff.md）。本物のサーバーのプログラムにサイトをつなぎ、ログインと安全確認だけにせもの。
// ・投稿の中でリンクを勝手に開かない・先に読みこまない（行き先への通信が0回）・本文の HTML は文字のまま
// ・押す→サーバーで確かめる→確認の画面（ホストと全部のアドレス・キーボードで操作・キャンセル・Esc）→「開く」で別のタブ（opener なし・リファラーなし）
// ・投稿欄：リンク欄・本文に貼ったリンクをリンク欄に移す・止めているときは出さない。スマホ（390）とパソコン（1280）
import {chromium} from 'playwright';
import path from 'node:path';
import {makeD1} from './d1mock.mjs';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
const PID='pokechan-test';
const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const kp=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...(await crypto.subtle.exportKey('jwk',kp.publicKey)),kid:'k1',use:'sig',alg:'RS256'};
const T0=Math.floor(Date.now()/1000);
const tok=async uid=>{const h=enc({alg:'RS256',kid:'k1',typ:'JWT'}),p=enc({iss:'https://securetoken.google.com/'+PID,aud:PID,sub:uid,iat:T0-10,exp:T0+3600,auth_time:T0-10,email:uid+'@mail.test-gk.net',email_verified:true});
  return h+'.'+p+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',kp.privateKey,new TextEncoder().encode(h+'.'+p))).toString('base64url')};
globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
const SRV=[];
globalThis.fetch=async u=>{u=String(u);SRV.push(u);if(u.includes('securetoken@system.gserviceaccount.com'))return new Response(JSON.stringify({keys:[jwk]}));
  if(u.startsWith('https://webrisk.googleapis.com/'))return new Response('{}');return new Response('',{status:404})};
const w=(await import(path.join(ROOT,'worker/dist/worker.js'))).default;
const env={DB:makeD1(),FIREBASE_PROJECT_ID:PID,APP_TOKEN:'t',ADMIN_TOKEN:'admin-secret-123',LINKS_POST:'1',LINKS_CLICK:'1',SANCTIONS_ON:'1',EMAIL_HMAC_KEY:'email-hmac-key-test-0123456789abcdef-ui',WEBRISK_API_KEY:'wr-ui-key-xxxxxxxxxxxx'};
let clock=Date.now();const realNow=Date.now;Date.now=()=>clock;
const call=async(p,t,body)=>{clock+=16e3;const h={'content-type':'application/json','cf-connecting-ip':'10.1.0.1'};if(t)h.authorization='Bearer '+t;
  const r=await w.fetch(new Request('https://x.dev'+p,{method:body?'POST':'GET',headers:h,body:body?JSON.stringify(body):undefined}),env,{waitUntil(){}});return[r.status,await r.json().catch(()=>({}))]};
let n=0;const fail=m=>{console.error('NG',m);process.exitCode=1};const ok=(c,m)=>{n++;if(!c)fail(m)};
const TK={};
for(const [id,h] of [['uA','sakura'],['uB','ren']]){TK[h]=await tok(id);const r=await call('/api/me',TK[h],{handle:h,name:h.toUpperCase(),agree:true});ok(r[0]===200,'プロフィール '+h)}
let r=await call('/api/notes',TK.ren,{body:'構築記事です <img src=x onerror="window.__xss=1"> #構築',url:'https://note.com/ren/n/n0123456789ab?from=share'});ok(r[0]===200,'リンク付きの投稿 '+JSON.stringify(r));const NID=r[1].id;
r=await call('/api/notes',TK.ren,{body:'リンクなし'});
Date.now=realNow;

const FB_APP=`export const initializeApp=c=>({c});`;
const FB_AUTH=`const who=localStorage.getItem('fakeuser');let user=who?{uid:who,email:who+'@mail.test-gk.net',emailVerified:true,getIdToken:async()=>window.__TOKS[who]}:null;const cbs=[];
export const getAuth=()=>({});export const onAuthStateChanged=(a,f)=>{cbs.push(f);setTimeout(()=>f(user),0)};
export class GoogleAuthProvider{};export class OAuthProvider{constructor(id){this.id=id}addScope(){}};
export const signInWithPopup=async()=>{};export const signInWithRedirect=signInWithPopup;export const signOut=async()=>{user=null;cbs.forEach(f=>f(null))};
export const sendSignInLinkToEmail=async()=>{};export const isSignInWithEmailLink=()=>false;export const signInWithEmailLink=async()=>{};`;
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const REQ=[];
async function page(who,vp,E=env){
  const ctx=await b.newContext({viewport:vp,locale:'ja-JP'});
  await ctx.addInitScript(([who,toks])=>{try{if(who)localStorage.setItem('fakeuser',who);localStorage.setItem('pcin','1');localStorage.setItem('pcstart','1')}catch(e){}window.__TOKS=toks},[who,TK]);
  ctx.on('request',q=>REQ.push({url:q.url(),ref:q.headers()['referer']||''}));
  await ctx.route('**/*',async rt=>{const u=new URL(rt.request().url());
    const js={status:200,headers:{'Access-Control-Allow-Origin':'*','Content-Type':'text/javascript'}};
    if(u.host==='www.gstatic.com'&&u.pathname.endsWith('/firebase-app.js'))return rt.fulfill({...js,body:FB_APP});
    if(u.host==='www.gstatic.com'&&u.pathname.endsWith('/firebase-auth.js'))return rt.fulfill({...js,body:FB_AUTH});
    if(u.protocol==='file:')return rt.continue();
    if(u.host==='pokechan-tap.pokechan.workers.dev'&&u.pathname.startsWith('/api/')){const q=rt.request(),h={...q.headers(),'cf-connecting-ip':'10.2.0.9'};delete h.origin;
      const res=await w.fetch(new Request('https://x.dev'+u.pathname+u.search,{method:q.method(),headers:h,body:['GET','HEAD'].includes(q.method())?undefined:q.postData()}),E,{waitUntil(){}});
      return rt.fulfill({status:res.status,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Content-Type':'application/json'},body:await res.text()})}
    /* 行き先（note.com）を開いたときは、中身を出さずに止める（通信があったことだけ記録する） */
    return rt.fulfill({status:404,body:''})});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.errs=errs;pg.ctx=ctx;
  return pg;
}
const dest=()=>REQ.filter(x=>/note\.com/.test(x.url));
for(const vp of [{width:390,height:844},{width:1280,height:900}]){
  const W=vp.width;REQ.length=0;
  const pg=await page('sakura',vp);
  await pg.goto(URL0+'#/tl');await pg.waitForTimeout(1500);
  const art=`.tw[data-id="${NID}"]`;
  ok(await pg.$(art+' .tw-ul[data-ul]'),W+'：リンクのボタンが出る');
  ok(await pg.$eval(art+' .tw-ul small',e=>e.textContent)==='note.com',W+'：ホストだけを見せる');
  ok(!(await pg.$$eval(art+' a',l=>l.map(a=>a.getAttribute('href')||''))).some(h=>/note\.com/.test(h)),W+'：投稿の中にリンク先の <a> を置かない');
  ok(await pg.$eval(art+' .tw-b',e=>e.textContent.includes('<img src=x onerror')&&!e.querySelector('img')),W+'：本文の HTML は文字のまま');
  ok(await pg.evaluate(()=>window.__xss===undefined),W+'：本文の中のスクリプトは動かない');
  ok(await pg.$eval(art+' .htag',e=>e.textContent)==='#構築'&&!(await pg.$$eval(art+' .htag',l=>l.some(a=>/note|share/.test(a.textContent)))),W+'：リンクはハッシュタグにならない');
  ok(dest().length===0,W+'：表示しただけでは行き先に通信しない（先読み・プレビューなし） '+JSON.stringify(dest()));
  /* キーボードで開く */
  await pg.focus(art+' .tw-ul');await pg.keyboard.press('Enter');await pg.waitForTimeout(500);
  ok(await pg.$('.ulc.on'),W+'：Enter で確認の画面');
  ok(await pg.$eval('.ulc .ulc-host',e=>e.textContent)==='note.com'&&await pg.$eval('.ulc .ulc-url',e=>e.textContent)==='https://note.com/ren/n/n0123456789ab?from=share',W+'：確認の画面にホストと全部のアドレス');
  ok(await pg.$eval('.ulc a.xc-ok',a=>a.target==='_blank'&&['noopener','noreferrer','nofollow','ugc'].every(x=>a.relList.contains(x))&&a.getAttribute('href')==='https://note.com/ren/n/n0123456789ab?from=share'),W+'：開くボタンは別のタブ・noopener noreferrer nofollow ugc');
  ok(await pg.evaluate(()=>document.activeElement&&document.activeElement.classList.contains('xc-no')),W+'：はじめはキャンセルに焦点');
  await pg.keyboard.press('Tab');ok(await pg.evaluate(()=>document.activeElement.classList.contains('xc-ok')),W+'：Tab で開くボタンへ');
  await pg.keyboard.press('Tab');ok(await pg.evaluate(()=>document.activeElement.classList.contains('xc-no')),W+'：Tab は画面の中で回る');
  await pg.keyboard.press('Escape');await pg.waitForTimeout(300);
  ok(!(await pg.$('.ulc'))&&dest().length===0,W+'：Esc で閉じ、開かない');
  ok(await pg.evaluate(()=>document.activeElement&&document.activeElement.classList.contains('tw-ul')),W+'：閉じたら元のボタンに焦点を戻す');
  await pg.click(art+' .tw-ul');await pg.waitForTimeout(500);await pg.click('.ulc .xc-no');await pg.waitForTimeout(300);
  ok(!(await pg.$('.ulc'))&&dest().length===0&&pg.url().startsWith('file:'),W+'：キャンセルで閉じ、移動しない');
  ok(!(await pg.evaluate(()=>location.hash)).includes('note'),W+'：画面の移動（#/）に入れない');
  /* 開く */
  await pg.click(art+' .tw-ul');await pg.waitForTimeout(500);
  const [pop]=await Promise.all([pg.ctx.waitForEvent('page'),pg.click('.ulc a.xc-ok')]);
  await pop.waitForLoadState().catch(()=>{});
  ok(await pop.evaluate(()=>window.opener===null).catch(()=>true),W+'：開いたタブから元の画面に触れない（opener なし）');
  ok(dest().length===1&&dest()[0].ref==='',W+'：「開く」を押したときだけ1回・リファラーなし '+JSON.stringify(dest()));
  await pop.close();await pg.waitForTimeout(200);ok(!(await pg.$('.ulc')),W+'：開いたら確認の画面を閉じる');
  /* サーバーから届いた値も確かめ直す（危険な値は押せない文字） */
  ok(await pg.evaluate(()=>[{state:'ok',url:'javascript:alert(1)',host:'x'},{state:'ok',url:'https://a.com\\@b.net/'},{state:'ok',url:'https://u:p@a.com/'},{state:'ok',url:'https://127.0.0.1/'},{state:'blocked'},{state:'ok',url:'https://a.com:8443/'},{state:'ok',url:'data:text/html,x'}]
    .every(l=>/tw-ul--off/.test(ulinkHTML({ulink:l}))&&!/javascript|data:/.test(ulinkHTML({ulink:l})))),W+'：形のおかしいリンクは押せない文字');
  ok(await pg.evaluate(()=>!ulinkSafe('https://note.com/a"><script>')||ulinkHTML({ulink:{state:'ok',url:'https://note.com/a',host:'<b>'}}).indexOf('<b>')<0),W+'：ホストの文字も安全な形で出す');
  /* 投稿欄：リンク欄・貼ったリンクを移す */
  if(W===390){await pg.goto(URL0+'#/');await pg.waitForTimeout(1500)}else{await pg.goto(URL0+'#/');await pg.waitForTimeout(1500)}
  ok(await pg.$eval('#twc-u-w',e=>!e.hidden).catch(()=>false),W+'：開いているときは投稿欄にリンク欄');
  await pg.focus('#twc-t');await pg.keyboard.type('S3 の記事 ');
  await pg.evaluate(()=>{const t=document.getElementById('twc-t'),dt=new DataTransfer();dt.setData('text/plain','https://note.com/sakura/n/n999');t.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}))});
  ok(await pg.$eval('#twc-u',e=>e.value)==='https://note.com/sakura/n/n999'&&await pg.$eval('#twc-t',e=>e.value)==='S3 の記事 ',W+'：本文に貼ったリンクをリンク欄に移す（まわりの文は残す）');
  await pg.evaluate(()=>{const t=document.getElementById('twc-t'),dt=new DataTransfer();dt.setData('text/plain','ふつうの文');t.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}))});
  ok(await pg.$eval('#twc-u',e=>e.value)==='https://note.com/sakura/n/n999',W+'：リンクでない文は移さない');
  clock=Math.max(clock,realNow())+W*100;Date.now=()=>clock;
  await pg.click('#twc-b');await pg.waitForTimeout(1200);
  Date.now=realNow;
  const mine=(await env.DB.prepare(`SELECT n.body,l.url FROM notes n JOIN note_links l ON l.note_id=n.id WHERE n.uid='uA' ORDER BY n.id DESC LIMIT 1`).first());
  ok(mine&&mine.url==='https://note.com/sakura/n/n999'&&mine.body==='S3 の記事',W+'：投稿欄から本文とリンクを送る '+JSON.stringify(mine));
  ok(await pg.$eval('#twc-u',e=>e.value)==='',W+'：送ったらリンク欄を空に');
  ok(dest().length===1,W+'：投稿しても行き先に通信しない');
  ok(!pg.errs.length,W+'：ページのエラーなし '+pg.errs.join(' / '));
  await pg.ctx.close();
}
/* 止めているとき：投稿欄にリンク欄を出さない・押しても開かない */
{const E={...env,LINKS_POST:'',LINKS_CLICK:''};REQ.length=0;const pg=await page('sakura',{width:390,height:844},E);
  await pg.goto(URL0+'#/');await pg.waitForTimeout(1500);
  ok(!(await pg.$('#twc-u'))&&!(await pg.$('#twc-u-w')),'止めているとき：リンク欄を出さない');
  const art=`.tw[data-id="${NID}"]`;await pg.click(art+' .tw-ul');await pg.waitForTimeout(600);
  ok(!(await pg.$('.ulc'))&&dest().length===0,'止めているとき：押しても開かない');
  ok(await pg.$(art+' .tw-ul--off'),'止めているとき：押したあと押せない文字にする');
  await pg.ctx.close()}
/* ログインしていない人も、確かめてから開ける（読むのは止めない） */
{REQ.length=0;const pg=await page('',{width:390,height:844});await pg.goto(URL0+'#/tl');await pg.waitForTimeout(1500);
  await pg.click(`.tw[data-id="${NID}"] .tw-ul`);await pg.waitForTimeout(600);ok(await pg.$('.ulc.on'),'ログインしていなくても確認の画面');await pg.ctx.close()}
/* 運営者の画面：リンクは文字だけ（押せるリンクにしない）・メールやハッシュを出さない */
{REQ.length=0;const pg=await page('',{width:1280,height:900});await pg.addInitScript(()=>{try{sessionStorage.setItem('pcadmin','admin-secret-123')}catch(e){}});
  await pg.goto(URL0+'#/admin');await pg.waitForTimeout(1200);await pg.click('[data-at="links"]');await pg.waitForTimeout(1200);
  const tx=await pg.$eval('#adm-list',e=>e.textContent),hs=await pg.$$eval('#adm-list a',l=>l.map(a=>a.href));
  ok(tx.includes('https://note.com/ren/n/n0123456789ab?from=share')&&!hs.some(h=>/note\.com/.test(h)),'運営者の画面：リンクは文字だけ');
  ok(!/mail\.test-gk|ehash/.test(await pg.$eval('#adm-list',e=>e.innerHTML)),'運営者の画面：メール・ハッシュを出さない');
  ok(dest().length===0,'運営者の画面でも行き先に通信しない');ok(!pg.errs.length,'運営者の画面のエラーなし '+pg.errs.join('/'));await pg.ctx.close()}
ok(SRV.every(u=>u.startsWith('https://webrisk.googleapis.com/')||u.includes('securetoken@system')),'サーバーは安全確認と鍵のほかに通信しない '+SRV.filter(u=>!u.includes('webrisk')&&!u.includes('securetoken')).join(','));
await b.close();
console.log(process.exitCode?'links-ui: NG':'links-ui: OK',`（${n}項目）`);
