// §16 コンパクトな名前の表示（2026/11/18）：お知らせ（G1）とグループのメッセージ（G2）。
// アイコンと名前はその人のプロフィール（#/u/ID）へ、行・吹き出しのほかの所は前と同じ行き先、ボタンは別。プレイヤーカードは #/u/ だけ。
// 本物のサーバーのプログラム（worker/dist/worker.js、D1 は Node の SQLite）にサイトをつなぐ（tests/dm.mjs と同じしくみ）。SHOT=フォルダ でスクリーンショット
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
const realFetch=globalThis.fetch;
globalThis.fetch=async u=>String(u).includes('securetoken@system.gserviceaccount.com')?new Response(JSON.stringify({keys:[jwk]})):new Response('',{status:404});
const w=(await import(path.join(ROOT,'worker/dist/worker.js'))).default;
const env={DB:makeD1(),FIREBASE_PROJECT_ID:PID,APP_TOKEN:'t',ADMIN_TOKEN:'admin-secret-123'};
let clock=Date.now()-6e4;const realNow=Date.now;Date.now=()=>clock;
const call=async(p,t,body)=>{clock+=3e3;const h={'content-type':'application/json','cf-connecting-ip':'10.1.0.1',origin:'null'};if(t)h.authorization='Bearer '+t;
  const r=await w.fetch(new Request('https://x.dev'+p,{method:body?'POST':'GET',headers:h,body:body?JSON.stringify(body):undefined}),env,{waitUntil(){}});return[r.status,await r.json().catch(()=>({}))]};
let n=0;const fail=m=>{console.error('NG',m);process.exitCode=1};const ok=(c,m)=>{n++;if(!c)fail(m)};
const TK={};let ipN=0;
/* 見本の人：さくら（公開）・レン・ミオ（公開）・カギ（非公開、自己紹介あり）・ヒロ（非公開） */
for(const [id,h,name,bio] of [['uA','sakura','さくら','シングルでガブリアス軸。'],['uB','ren','レン','ダブル勢です'],['uC','kagi','カギ','カギの秘密の自己紹介'],['uD','mio','ミオ',''],['uE','hiro','ヒロ','ヒロの秘密の自己紹介']]){
  TK[h]=await tok(id);const r=await call('/api/me',TK[h],{handle:h,name,bio,agree:true});ok(r[0]===200,'プロフィール '+h)}
await call('/api/me/private',TK.kagi,{on:true});await call('/api/me/private',TK.hiro,{on:true});
/* さくらへのお知らせ：いいね（レン）・返信（レン）・リポスト（ミオ）・フォロー（カギ＝非公開の人） */
clock+=2e4;const n1=(await call('/api/notes',TK.sakura,{body:'S6 は最終1桁でした'}))[1].id;
await call(`/api/notes/${n1}/like`,TK.ren,{on:true});
clock+=2e4;const rp=(await call('/api/notes',TK.ren,{body:'おめでとうございます！',reply_to:n1}))[1].id;
await call(`/api/notes/${n1}/repost`,TK.mio,{on:true});
await call('/api/follow',TK.kagi,{handle:'sakura',on:true});
/* ヒロ（非公開）へのフォローのリクエスト（ミオ） */
await call('/api/follow',TK.mio,{handle:'hiro',on:true});
/* グループ：レンが作る。ミオ2通→レン1通→ミオ1通→さくら1通 */
const G=(await call('/api/dm/group',TK.ren,{title:'構築相談',handles:['sakura','mio']}))[1].conv;
const LONG='長いメッセージ。'.repeat(14);
for(const [f,t] of [['mio','次のシーズンの環境どうなりそう？'],['mio','ガブリアスはまだ多そう'],['ren',LONG],['mio','たしかに'],['sakura','サーフゴーも増えそうです']]){const r=await call('/api/dm/send',TK[f],{conv:G,body:t});ok(r[0]===200,'グループに送る '+f)}
/* 1対1（吹き出しの幅をくらべる用） */
await call('/api/dm/send',TK.ren,{to:'sakura',body:LONG});
/* ゲームカード（アイコンの輪）：レン＝公開、ミオ＝フォロワーのみ（さくらはミオをフォローしていない）、カギ＝非公開アカウント（さくらは許可されたフォロワーではない）、ヒロ＝作っていない */
for(const [h,v] of [['ren','public'],['mio','followers'],['kagi','public']]){const r=await call('/api/me/card',TK[h],{partner:445,vis:v,card:true});ok(r[0]===200&&r[1].created===true,'カードを作る '+h)}
/* フォロワーの一覧の輪を見る用に、ナナ（公開）をレン・ミオ・カギ・ヒロがフォロー（さくらへのお知らせは増やさない） */
TK.nana=await tok('uN');ok((await call('/api/me',TK.nana,{handle:'nana',name:'ナナ',bio:'',agree:true}))[0]===200,'プロフィール nana');
for(const h of ['ren','mio','kagi','hiro'])await call('/api/follow',TK[h],{handle:'nana',on:true});
Date.now=realNow;
const FB_APP=`export const initializeApp=c=>({c});`;
const FB_AUTH=`const who=localStorage.getItem('fakeuser');let user=who?{uid:who,email:who+'@example.com',getIdToken:async()=>window.__TOKS[who]}:null;const cbs=[];
export const getAuth=()=>({});export const onAuthStateChanged=(a,f)=>{cbs.push(f);setTimeout(()=>f(user),0)};
export class GoogleAuthProvider{};export class OAuthProvider{constructor(id){this.id=id}addScope(){}};
export const signInWithPopup=async()=>{};export const signInWithRedirect=signInWithPopup;export const signOut=async()=>{user=null;cbs.forEach(f=>f(null))};
export const sendSignInLinkToEmail=async()=>{};export const isSignInWithEmailLink=()=>false;export const signInWithEmailLink=async()=>{};`;
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
async function page(who,vp={width:390,height:844}){
  const ctx=await b.newContext({viewport:vp,locale:'ja-JP',deviceScaleFactor:SHOT?2:1});
  await ctx.addInitScript(([who,toks])=>{try{localStorage.setItem('fakeuser',who);localStorage.setItem('pcin','1');localStorage.setItem('pcstart','1')}catch(e){}window.__TOKS=toks},[who,TK]);
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.errs=errs;
  await pg.route('**/*',async r=>{const u=new URL(r.request().url());
    const js={status:200,headers:{'Access-Control-Allow-Origin':'*','Content-Type':'text/javascript'}};
    if(u.host==='www.gstatic.com'&&u.pathname.endsWith('/firebase-app.js'))return r.fulfill({...js,body:FB_APP});
    if(u.host==='www.gstatic.com'&&u.pathname.endsWith('/firebase-auth.js'))return r.fulfill({...js,body:FB_AUTH});
    if(u.protocol==='file:')return r.continue();
    if(u.pathname.startsWith('/m/')){const res=await w.fetch(new Request('https://x.dev'+u.pathname),env,{waitUntil(){}});
      return r.fulfill({status:res.status,headers:{'Access-Control-Allow-Origin':'*','Content-Type':res.headers.get('content-type')||'image/png'},body:Buffer.from(await res.arrayBuffer())})}
    if(u.pathname.startsWith('/api/')){const q=r.request(),h=Object.fromEntries(Object.entries(q.headers()));h['cf-connecting-ip']='10.2.0.'+(++ipN%200);delete h.origin;
      const res=await w.fetch(new Request('https://x.dev'+u.pathname+u.search,{method:q.method(),headers:h,body:['GET','HEAD'].includes(q.method())?undefined:q.postData()}),env,{waitUntil(){}});
      return r.fulfill({status:res.status,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Content-Type':'application/json'},body:await res.text()})}
    return r.fulfill({status:404,body:''})});
  return pg;
}

const go=async(pg,h)=>{await pg.evaluate(x=>{location.hash=x},h);await pg.waitForTimeout(900)};
const hash=pg=>pg.evaluate(()=>location.hash);
for(const W of [390,1280]){
  const vp={width:W,height:W<700?844:900};
  /* ---------- G1：お知らせ ---------- */
  let pg=await page('sakura',vp);await pg.goto(URL0+'#/notif');await pg.waitForTimeout(1600);
  const rows=await pg.$$eval('.twn',l=>l.map(r=>({kind:r.dataset.kind,av:(r.querySelector('.twn-av a.tw-av')||{}).getAttribute?.call(r.querySelector('.twn-av a.tw-av'),'href'),
    avLabel:r.querySelector('.twn-av a.tw-av')?.getAttribute('aria-label')||'',badge:!!r.querySelector('.twn-av .twn-k.twn-i--'+(r.dataset.kind==='freq'?'follow':r.dataset.kind)+' svg'),
    who:r.querySelector('a.twn-who')?.getAttribute('href'),go:r.querySelector('a.twn-go')?.getAttribute('href'),txt:r.textContent})));
  const K=k=>rows.find(r=>r.kind===k)||{};
  ok(rows.length===4,W+'：お知らせが4件 '+rows.map(r=>r.kind));
  for(const [k,h,dest] of [['like','ren','#/n/'+n1],['reply','ren','#/n/'+rp],['repost','mio','#/n/'+n1],['follow','kagi','#/u/kagi']]){const r=K(k);
    ok(r.av==='#/u/'+h&&r.who==='#/u/'+h,`${W}：${k} のアイコンと名前は #/u/${h} `+JSON.stringify([r.av,r.who]));
    ok(r.badge,`${W}：${k} のアイコンに種類の印`);
    ok(r.go===dest,`${W}：${k} の行の行き先は前と同じ ${dest} `+r.go);
    ok(/のプロフィール$/.test(r.avLabel),`${W}：${k} のアイコンの読み上げ名 `+r.avLabel)}
  ok(!K('follow').txt.includes('カギの秘密'),W+'：非公開の人の自己紹介はお知らせに出ない');
  /* 輪：サーバーが許したときだけ（レン＝公開→輪、ミオ＝フォロワーのみ・カギ＝非公開アカウント→輪なし） */
  {const rg=await pg.evaluate(()=>[...document.querySelectorAll('.twn')].map(r=>[r.dataset.kind,r.querySelector('.twn-av .tw-av').classList.contains('gk-cr')].join(':')).sort().join());
   ok(rg==='follow:false,like:true,reply:true,repost:false',W+'：お知らせのアイコンの輪はサーバーが許した人だけ '+rg)}
  /* 押した場所で行き先が分かれる */
  /* 本当に指で押したときと同じく、その場所の画面上の点を押す（どの要素が受けるかは画面の重なりで決まる） */
  const clickIn=async(k,sel)=>{const el=await pg.$(`.twn[data-kind="${k}"] ${sel}`);await el.evaluate(e=>e.scrollIntoView({block:'center'}));await pg.waitForTimeout(150);const bx=await el.boundingBox();await pg.mouse.click(bx.x+Math.min(12,bx.width/2),bx.y+bx.height/2);await pg.waitForTimeout(500);const h=await hash(pg);await go(pg,'#/notif');await pg.waitForTimeout(600);return h};
  ok(await clickIn('like','.twn-av a.tw-av')==='#/u/ren',W+'：アイコンを押すとプロフィール');
  ok(await clickIn('like','a.twn-who')==='#/u/ren',W+'：名前を押すとプロフィール');
  ok(await clickIn('like','.tw-m > div:nth-child(2)')==='#/n/'+n1,W+'：行のほかの所（文）を押すと前と同じ投稿へ');
  ok(await clickIn('reply','.twn-b')==='#/n/'+rp,W+'：返信の本文を押すと返信の投稿へ');
  ok(await clickIn('follow','.tw-m > div:nth-child(2)')==='#/u/kagi',W+'：フォローのお知らせの行はプロフィールへ（前と同じ）');
  /* 文字を選んでコピーできる（2026/11/18 の直し）：指・マウスでドラッグして選んでも移動しない */
  const dragSel=async(sel)=>{const el=await pg.$(sel);await el.evaluate(e=>e.scrollIntoView({block:'center'}));await pg.waitForTimeout(120);const bx=await el.boundingBox();
    await pg.mouse.move(bx.x+2,bx.y+bx.height/2);await pg.mouse.down();await pg.mouse.move(bx.x+bx.width-2,bx.y+bx.height/2,{steps:8});await pg.mouse.up();await pg.waitForTimeout(450);
    return{h:await hash(pg),t:await pg.evaluate(()=>getSelection().toString())}};
  {const r=await dragSel('.twn[data-kind="reply"] .twn-b');ok(r.h==='#/notif'&&/おめでとう/.test(r.t),W+'：返信の本文をドラッグで選んでも移動しない・選べる '+JSON.stringify(r))}
  {const r=await dragSel('.twn[data-kind="like"] .tw-m > div:nth-child(2)');ok(r.h==='#/notif'&&/いいねしました/.test(r.t),W+'：お知らせの文を選んでも移動しない '+JSON.stringify(r))}
  /* リンクの上のドラッグはブラウザがリンクのドラッグにする（文字の選択にはならない）。移動しないことだけ確かめる */
  await pg.evaluate(()=>getSelection().removeAllRanges());
  {const r=await dragSel('.twn[data-kind="like"] a.twn-who b');ok(r.h==='#/notif',W+'：名前の上でドラッグしても移動しない '+JSON.stringify(r))}
  /* 選んだ文字は、そのお知らせの文（リンクの文字は選ぶ範囲の途中に入ってもよい） */
  {await pg.evaluate(()=>getSelection().removeAllRanges());const r=await dragSel('.twn[data-kind="like"] .tw-m');ok(r.h==='#/notif'&&/いいねしました/.test(r.t),W+'：お知らせ全体をなぞって選んでも移動しない '+JSON.stringify(r))}
  await pg.keyboard.press(process.platform==='darwin'?'Meta+C':'Control+C');await pg.waitForTimeout(200);ok(await hash(pg)==='#/notif',W+'：コピーのキーで移動しない');
  /* 選んだ文字が残っていても、アイコン・名前・行のほかの所は前と同じ行き先 */
  await dragSel('.twn[data-kind="reply"] .twn-b');
  ok(await clickIn('like','.twn-av a.tw-av')==='#/u/ren',W+'：文字を選んだあとでもアイコンはプロフィールへ');
  await dragSel('.twn[data-kind="reply"] .twn-b');
  ok(await clickIn('like','a.twn-who')==='#/u/ren',W+'：文字を選んだあとでも名前はプロフィールへ');
  await pg.evaluate(()=>getSelection().removeAllRanges());
  ok(await clickIn('repost','.tw-m > div:nth-child(2)')==='#/n/'+n1,W+'：行のほかの所はリポストした投稿へ（前と同じ）');
  {const el=await pg.$('.twn[data-kind="like"]');const bx=await el.boundingBox();await pg.mouse.click(bx.x+bx.width-14,bx.y+bx.height/2);await pg.waitForTimeout(500);
   ok(await hash(pg)==='#/n/'+n1,W+'：行の右の空いている所を押しても投稿へ');await go(pg,'#/notif');await pg.waitForTimeout(600)}
  /* キーボード：行のリンクで Enter＝前と同じ行き先、名前で Enter＝プロフィール */
  await pg.focus('.twn[data-kind="like"] a.twn-go');
  await pg.keyboard.press('Enter');await pg.waitForTimeout(500);ok(await hash(pg)==='#/n/'+n1,W+'：行のリンクで Enter を押すと投稿へ');await go(pg,'#/notif');await pg.waitForTimeout(600);
  await pg.focus('.twn[data-kind="follow"] a.twn-go');await pg.keyboard.press('Enter');await pg.waitForTimeout(500);ok(await hash(pg)==='#/u/kagi',W+'：フォローのお知らせの行のリンクで Enter を押すとプロフィールへ');await go(pg,'#/notif');await pg.waitForTimeout(600);
  await pg.focus('.twn[data-kind="like"] a.twn-who');await pg.keyboard.press('Enter');await pg.waitForTimeout(500);ok(await hash(pg)==='#/u/ren',W+'：名前で Enter を押すとプロフィールへ');await go(pg,'#/notif');await pg.waitForTimeout(600);
  ok(await pg.evaluate(()=>{const g=document.querySelector('.twn[data-kind="like"] a.twn-go');g.focus();const r=g.getBoundingClientRect(),row=g.parentElement.getBoundingClientRect();return Math.abs(r.width-row.width)<=3&&Math.abs(r.height-row.height)<=3}),W+'：行のリンクは行いっぱい（キーボードの枠が行を囲む）');
  /* キーボード：行の行き先・アイコン・名前がそれぞれ別に選べる */
  const tabs=await pg.evaluate(()=>{const r=document.querySelector('.twn[data-kind="like"]');return [...r.querySelectorAll('a')].map(a=>a.className.split(' ')[0])});
  ok(tabs.join()==='twn-go,tw-av,twn-who',W+'：選べる所が3つ（行・アイコン・名前） '+tabs);
  const ov=await pg.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1||document.body.scrollWidth>innerWidth+1);ok(!ov,W+'：お知らせがはみ出さない');
  if(SHOT)await pg.screenshot({path:path.join(SHOT,`notif-${W}.png`)});
  ok(!(await pg.$('.pc,.pf')),W+'：お知らせにプレイヤーカードを出さない');
  /* フォローのリクエスト（ヒロの画面）：許可・断るは別のボタンのまま */
  if(W!==390){clock=Math.max(clock,realNow())+1e4;Date.now=()=>clock;await call('/api/follow',TK.ren,{handle:'hiro',on:true});Date.now=realNow}
  const fqFrom=W===390?'mio':'ren';
  const ph=await page('hiro',vp);await ph.goto(URL0+'#/notif');await ph.waitForTimeout(1600);
  const fq=await ph.evaluate(()=>{const r=document.querySelector('.twn[data-kind="freq"]:not(:has(.twn-act span))');return r&&{av:r.querySelector('.twn-av a.tw-av')?.getAttribute('href'),who:r.querySelector('a.twn-who')?.getAttribute('href'),go:!!r.querySelector('.twn-go'),badge:!!r.querySelector('.twn-k svg'),btn:r.querySelectorAll('[data-ans]').length}});
  ok(fq&&fq.av==='#/u/'+fqFrom&&fq.who==='#/u/'+fqFrom&&!fq.go&&fq.badge&&fq.btn===2,W+'：リクエストのお知らせにアイコンと名前のリンク・ボタン2つ '+JSON.stringify(fq));
  if(W===390){await ph.click('.twn[data-kind="freq"] [data-ans="1"]');await ph.waitForTimeout(700);
    ok(await hash(ph)==='#/notif'&&/許可しました/.test(await ph.textContent('.twn[data-kind="freq"]')),'許可するのボタンは移動しない')}
  else{/* 行の文の所を押しても移動しない（リクエストの行には行き先がない）・断るのボタンは移動しない */
    {const el=await ph.$('.twn[data-kind="freq"]:not(:has(.twn-act span)) .tw-m > div:nth-child(2)');const bx=await el.boundingBox();await ph.mouse.click(bx.x+10,bx.y+bx.height/2);await ph.waitForTimeout(400)}
    ok(await hash(ph)==='#/notif','リクエストの行の文を押しても移動しない');
    await ph.click('.twn[data-kind="freq"]:not(:has(.twn-act span)) [data-ans="0"]');await ph.waitForTimeout(700);
    ok(await hash(ph)==='#/notif'&&/断りました/.test(await ph.textContent('.twn[data-kind="freq"]')),'断るのボタンは移動しない')}
  await ph.close();
  /* フォロワーの一覧（画面の上に開く）：レン＝輪、ミオ・カギ＝輪なし */
  await pg.evaluate(()=>followListOpen('nana','followers',{name:'ナナ'}));await pg.waitForTimeout(900);
  {const fr=await pg.evaluate(()=>[...document.querySelectorAll('#flm .fl-row')].map(r=>r.dataset.flGo+':'+r.querySelector('.fl-av').classList.contains('gk-cr')).sort().join());
   ok(fr==='hiro:false,kagi:false,mio:false,ren:true',W+'：フォロワーの一覧の輪はサーバーが許した人だけ '+fr)}
  await pg.keyboard.press('Escape');await pg.waitForTimeout(400);
  /* ---------- G2：グループ ---------- */
  await go(pg,'#/messages/g/'+G);await pg.waitForTimeout(1200);
  const g=await pg.evaluate(()=>[...document.querySelectorAll('#dm-log .dm-m')].map(m=>{const av=m.querySelector('a.dm-sav'),wh=m.querySelector('a.dm-who');const vis=e=>!!e&&getComputedStyle(e).display!=='none';
    return{me:m.classList.contains('me'),u:m.dataset.u||'',head:vis(av)&&vis(wh),av:av&&av.getAttribute('href'),who:wh&&wh.getAttribute('href'),size:av&&vis(av)?Math.round(av.getBoundingClientRect().width):0}}));
  /* 2回目（1280）は、1回目の終わりにミオが2通送った続きがある */
  ok(g.map(x=>x.me?'me':x.u+(x.head?'+':'')).join()===(W===390?'mio+,mio,ren+,mio+,me':'mio+,mio,ren+,mio+,me,mio+,mio'),W+'：続けて送ったはじめにだけアイコンと名前 '+g.map(x=>x.me?'me':x.u+(x.head?'+':'')).join());
  ok(g.filter(x=>x.head).every(x=>x.size===28&&x.av==='#/u/'+x.u&&x.who==='#/u/'+x.u),W+'：アイコンは28px・アイコンと名前は #/u/ID '+JSON.stringify(g.filter(x=>x.head)));
  ok(!g.find(x=>x.me).av,W+'：自分のメッセージにはアイコンを付けない');
  const bw=async()=>pg.evaluate(()=>{const b=[...document.querySelectorAll('#dm-log .dm-b')].find(x=>x.textContent.startsWith('長いメッセージ'));return Math.round(b.getBoundingClientRect().width)});
  const gW=await bw();
  if(SHOT)await pg.screenshot({path:path.join(SHOT,`group-${W}.png`)});
  ok(!(await pg.$('.pc,.pf')),W+'：グループの会話にプレイヤーカードを出さない');
  /* 新しく届いた分：前がさくらなので、ミオの1通目はアイコンつき、2通目は続き */
  clock=Math.max(clock,realNow())+1e4;Date.now=()=>clock;
  {const r1=await call('/api/dm/send',TK.mio,{conv:G,body:'新しい1通目'+W}),r2=await call('/api/dm/send',TK.mio,{conv:G,body:'新しい2通目'+W});ok(r1[0]===200&&r2[0]===200,W+'：あとから送る '+JSON.stringify([r1,r2]))}Date.now=realNow;
  await pg.waitForTimeout(3200);
  const g2=await pg.evaluate(()=>[...document.querySelectorAll('#dm-log .dm-m')].slice(-2).map(m=>({u:m.dataset.u,head:getComputedStyle(m.querySelector('.dm-sav')).display!=='none'})));
  /* 1回目：前がさくら→1通目にアイコン。2回目：前がミオ（1回目の2通）→どちらも続き（読み込みの境目でもくり返さない） */
  ok(g2.length===2&&(W===390?g2[0].head:!g2[0].head)&&!g2[1].head,W+'：あとから届いたメッセージも、続けて送ったはじめにだけアイコン '+JSON.stringify(g2));
  {const el=await pg.$('#dm-log .dm-m.dm-g:not(.cont) a.dm-sav');await el.evaluate(e=>e.scrollIntoView({block:'center'}));await pg.waitForTimeout(150);const bx=await el.boundingBox();await pg.mouse.click(bx.x+bx.width/2,bx.y+bx.height/2)}await pg.waitForTimeout(600);ok(await hash(pg)==='#/u/mio',W+'：グループのアイコンを押すとプロフィール');
  await go(pg,'#/messages/g/'+G);await pg.waitForTimeout(1000);
  {const el=await pg.$('#dm-log .dm-m.dm-g[data-u="ren"]:not(.cont) a.dm-who');await el.evaluate(e=>e.scrollIntoView({block:'center'}));await pg.waitForTimeout(150);const bx=await el.boundingBox();await pg.mouse.click(bx.x+bx.width/2,bx.y+bx.height/2)}await pg.waitForTimeout(600);ok(await hash(pg)==='#/u/ren',W+'：グループの名前を押すとプロフィール');
  /* 吹き出しの幅は1対1と同じ */
  await go(pg,'#/messages/ren');await pg.waitForTimeout(1000);
  const oW=await bw();ok(Math.abs(oW-gW)<=1,W+'：長い吹き出しの幅は1対1と同じ '+[gW,oW]);
  ok(!(await pg.$('#dm-log .dm-sav')),W+'：1対1の会話は前と同じ（アイコンなし）');
  /* プライバシー：グループのメッセージのサーバーの返事は名前・ID・アイコンだけ */
  const keys=await pg.evaluate(async g=>{const j=await authFetch('/api/dm/'+g);return [...new Set(j.msgs.filter(m=>m.user).flatMap(m=>Object.keys(m.user)))].sort().join()},G);
  ok(keys==='av,handle,name',W+'：メッセージの送り主は名前・ID・アイコンだけ '+keys);
  /* プレイヤーカードは #/u/ だけ */
  for(const h of ['#/tl','#/search/sakura','#/messages']){await go(pg,h);ok(!(await pg.$('.pf')),`${W}：${h} にプレイヤーカードなし`)}
  await go(pg,'#/u/ren');await pg.waitForTimeout(800);ok(!!(await pg.$('.pf')),W+'：#/u/ID ではプレイヤーカード');
  ok(!pg.errs.length,W+'：エラーなし '+pg.errs.join('|'));
  await pg.close();
}
await b.close();
console.log(process.exitCode?'compactid: NG':`compactid: OK（${n}項目）`);
