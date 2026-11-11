// メッセージ（DM）と非公開アカウントの画面の確認（2026/11/11）：
// 本物のサーバーのプログラム（worker/dist/worker.js、D1 は Node の SQLite）にサイトをつなぎ、ログインだけにせものにして、
// 下のメニューの「メッセージ」・プロフィールの ✉・会話・外部への誘導の注意・鍵垢への送信の制限を確かめる。
// SHOT=フォルダ を付けるとスクリーンショットも撮る
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
for(const [id,h,name,bio] of [['uA','sakura','さくら','シングルでガブリアス軸。'],['uB','ren','レン','ダブル勢です'],['uC','kagi','カギ','非公開アカウントです'],['uD','mio','ミオ','']]){
  TK[h]=await tok(id);const r=await call('/api/me',TK[h],{handle:h,name,bio,agree:true});ok(r[0]===200,'プロフィール '+h)}
await call('/api/me/private',TK.kagi,{on:true});
await call('/api/notes',TK.kagi,{body:'鍵の中の投稿'});
/* さくら⇔レンの会話・グループ */
for(const [f,t,b] of [['ren','sakura','こんにちは！ ガブリアスの型、参考にしました'],['sakura','ren','ありがとうございます！ どの型にしましたか？'],['ren','sakura','スカーフ型です。\n地震と逆鱗で上から殴れて強いです'],['sakura','ren','いいですね。今度プライベート対戦しましょう'],['ren','sakura','ぜひ！ #対戦募集 のタグで募集します']]){
  const r=await call('/api/dm/send',TK[f],{to:t,body:b});ok(r[0]===200,'会話の準備 '+JSON.stringify(r))}
await call('/api/dm/send',TK.mio,{to:'sakura',body:'はじめまして。相互フォローお願いします'});
{const g=await call('/api/dm/group',TK.ren,{title:'シングル構築相談',handles:['sakura','mio']});await call('/api/dm/send',TK.mio,{conv:g[1].conv,body:'次のシーズンの環境どうなりそう？'});await call('/api/dm/send',TK.ren,{conv:g[1].conv,body:'カイリューが増えそうです'})}
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
/* ログインのユーザーを TK の鍵で切りかえるため、fakeuser には handle をそのまま入れる */
const go=async(pg,h)=>{await pg.evaluate(x=>{location.hash=x},h);await pg.waitForTimeout(700)};
const shot=async(pg,name)=>{if(SHOT)await pg.screenshot({path:path.join(SHOT,name+'.png')})};
let pg=await page('sakura');
await pg.goto(URL0+'#/');await pg.waitForTimeout(1200);
const tabs=await pg.$$eval('.tabbar .tb',l=>l.map(x=>[x.dataset.k,x.getAttribute('aria-label')]));
ok(tabs[tabs.length-1][0]==='messages'&&tabs[tabs.length-1][1]==='メッセージ','5つ目のタブがメッセージ '+JSON.stringify(tabs));
ok(!tabs.some(t=>t[0]==='community'),'コミュニティのタブは無い');
await pg.waitForTimeout(1200);
ok(await pg.$eval('.tb[data-k="messages"] .tb-badge',e=>+e.textContent).catch(()=>0)>0,'読んでいないメッセージの数がタブに出る');
await pg.click('.tb[data-k="messages"]');await pg.waitForTimeout(900);
ok(await pg.evaluate(()=>location.hash)==='#/messages','タブで #/messages');
ok(await pg.$eval('.tb[data-k="messages"]',e=>e.getAttribute('aria-current')==='page'),'タブが選ばれている');
ok((await pg.$$('.dm-row')).length===2,'個人の会話が2つ');
ok(await pg.$eval('[data-dmk=dm]',e=>e.getAttribute('aria-selected')==='true')&&!!await pg.$('.dm-new'),'個人・グループの切りかえと新しいメッセージ');
await shot(pg,'m-list');
await pg.click('[data-dmk=group]');await pg.waitForTimeout(700);
ok(await pg.$eval('#dm-list',e=>e.textContent.includes('シングル構築相談')),'グループの一覧');
await shot(pg,'m-group');
await pg.click('[data-dmk=dm]');await pg.waitForTimeout(500);
/* プロフィールの「メッセージを送る」 */
await go(pg,'#/u/ren');await pg.waitForTimeout(500);
ok(!!await pg.$('#pf-dm')&&await pg.$eval('#pf-dm',e=>e.getAttribute('aria-label'))==='メッセージを送る','プロフィールにメッセージを送るボタン');
await shot(pg,'m-profile');
await pg.click('#pf-dm');await pg.waitForTimeout(1000);
ok(await pg.evaluate(()=>location.hash)==='#/messages/ren','メッセージを送るで1対1の会話へ');
ok((await pg.$$('.dm-m')).length===5,'これまでのやりとり');
await pg.fill('#dm-t','次の土曜の夜はどうですか？');
ok(!await pg.$eval('#dm-send',e=>e.disabled),'送信ボタンが押せる');
await pg.click('#dm-send');await pg.waitForTimeout(700);
ok(await pg.$eval('#dm-log',e=>e.textContent.includes('次の土曜の夜はどうですか？')),'送ったメッセージが出る');
ok((await call('/api/dm/with/sakura',TK.ren))[1].msgs.some(m=>m.body==='次の土曜の夜はどうですか？'),'相手に届いている');
await pg.fill('#dm-t','discordやってる？ IDは abc#1234');await pg.waitForTimeout(150);
ok(await pg.$eval('#dm-send',e=>e.disabled)&&await pg.$eval('#dm-warn',e=>e.classList.contains('bad')&&e.textContent.includes('送れません')),'外部への誘導は打っている間に注意して送れない');
await shot(pg,'m-talk-warn');
await pg.fill('#dm-t','');
/* 相手から届いたメッセージが4秒ごとに出る */
await call('/api/dm/send',TK.ren,{to:'sakura',body:'土曜の21時でお願いします！'});
await pg.waitForTimeout(4600);
ok(await pg.$eval('#dm-log',e=>e.textContent.includes('土曜の21時でお願いします')),'相手のメッセージがその場で届く');
ok(await pg.$eval('.tabbar',e=>getComputedStyle(e).display==='none'),'会話の画面では下のメニューを隠す（スマホ）');
await shot(pg,'m-talk');
/* 鍵垢 */
await go(pg,'#/u/kagi');await pg.waitForTimeout(500);
ok(await pg.$eval('#twp-f',e=>e.textContent)==='フォローをリクエスト','非公開アカウントにはフォローをリクエスト');
ok(!!await pg.$('.pf-lock')&&!!await pg.$('.pf-locked'),'鍵の印と、投稿は見られない表示');
await shot(pg,'m-kagi-profile');
await pg.click('#pf-dm');await pg.waitForTimeout(1000);
ok(await pg.evaluate(()=>location.hash)==='#/messages/kagi','鍵垢にも会話の画面は開く');
ok(await pg.$eval('.dm-lock',e=>e.textContent.includes('このユーザーは非公開アカウントのためメッセージを送信できません')),'非公開アカウントのため送れないと出る');
ok(await pg.$eval('#dm-t',e=>e.disabled)&&await pg.$eval('#dm-send',e=>e.disabled),'入力欄と送信ボタンが止まる');
ok((await call('/api/dm/send',TK.sakura,{to:'kagi',body:'こんにちは'}))[0]===403,'サーバーでも送れない');
await shot(pg,'m-kagi-locked');
await go(pg,'#/u/kagi');await pg.click('#twp-f');await pg.waitForTimeout(600);
ok(await pg.$eval('#twp-f',e=>e.textContent)==='リクエスト中','リクエスト中');
/* 鍵垢の本人：リクエストを許可すると送れるようになる */
const pk=await page('kagi');await pk.goto(URL0+'#/notif');await pk.waitForTimeout(1500);
ok(!!await pk.$('[data-req="sakura"]'),'お知らせにフォローのリクエスト');
await shot(pk,'m-kagi-notif');
await pk.click('[data-req="sakura"] [data-ans="1"]');await pk.waitForTimeout(600);
await go(pg,'#/messages/kagi');await pg.waitForTimeout(800);
ok(!await pg.$('.dm-lock')&&!await pg.$eval('#dm-t',e=>e.disabled),'許可されると送れる');
/* 鍵垢の切りかえ（アカウントの画面・左のメニュー） */
await go(pk,'#/account');await pk.waitForTimeout(800);
ok(await pk.$eval('[data-priv]',e=>e.checked)&&await pk.$eval('.pv-row',e=>e.textContent.includes('アカウントを非公開にする（鍵垢）')),'アカウントの画面に鍵垢の切りかえ（オン）');
await pk.evaluate(()=>scrTo(0,document.querySelector('.pv-row').getBoundingClientRect().top+scrY()-140));await pk.waitForTimeout(200);
await shot(pk,'m-account');
await go(pg,'#/account');await pg.waitForTimeout(800);
await pg.click('.pv-row .pv-sw');await pg.waitForTimeout(600);
ok((await call('/api/u/sakura',TK.mio))[1].user.private===true,'切りかえるとサーバーに保存');
await go(pg,'#/');await pg.click('#brand');await pg.waitForTimeout(500);
ok(await pg.$eval('#drawer',e=>e.textContent.includes('コミュニティ')&&e.textContent.includes('メッセージ')),'左のメニューにコミュニティとメッセージ');
await pg.click('[data-dr=settings]');await pg.waitForTimeout(700);
ok(await pg.$eval('#setm',e=>!!e.querySelector('.pv-dr [data-priv]')&&e.querySelector('[data-priv]').checked),'設定とプライバシーに鍵垢の切りかえ（オン）');
await shot(pg,'m-settings');
await pg.keyboard.press('Escape');await pg.waitForTimeout(400);
/* 新しいメッセージ */
await go(pg,'#/messages/new');await pg.fill('#dm-q','mio');await pg.waitForTimeout(800);
ok(!!await pg.$('[data-h="mio"]'),'相手を探せる');
await pg.click('[data-h="mio"]');await pg.waitForTimeout(800);
ok(await pg.evaluate(()=>location.hash)==='#/messages/mio','選ぶと会話へ');
ok(!pg.errs.length&&!pk.errs.length,'画面のエラーなし '+JSON.stringify([...pg.errs,...pk.errs]));
/* フォロー中・フォロワーの一覧（2026/11/11） */
await call('/api/me/private',TK.sakura,{on:false});
for(const [f,t] of [['ren','sakura'],['mio','sakura'],['sakura','ren']])await call('/api/follow',TK[f],{handle:t});
/* メッセージの設定（2026/11/11）：「自分がフォローしている人だけ」なら、さくらがフォローしているレンだけ送れる */
{let r=await call('/api/me/dmfrom',TK.sakura,{v:'following'});ok(r[0]===200&&r[1].dm_from==='following','メッセージの設定を保存');
  r=await call('/api/me',TK.sakura);ok(r[1].user&&r[1].user.dm_from==='following','自分の情報に設定が入る');
  r=await call('/api/u/sakura',TK.mio);ok(!('dm_from' in r[1].user),'ほかの人には設定を見せない');
  r=await call('/api/dm/send',TK.mio,{to:'sakura',body:'設定の確認です'});ok(r[0]===403&&r[1].limited,'フォローしていない人からは送れない '+JSON.stringify(r[1]));
  r=await call('/api/dm/send',TK.ren,{to:'sakura',body:'設定の確認です'});ok(r[0]===200,'フォローしている人からは送れる '+JSON.stringify(r[1]));
  r=await call('/api/me/dmfrom',TK.sakura,{v:'all'});ok(r[1].dm_from==='all','だれでもに戻す');
  r=await call('/api/dm/send',TK.mio,{to:'sakura',body:'設定の確認です'});ok(r[0]===200,'だれでもなら送れる');
}
await go(pg,'#/u/sakura');await pg.waitForTimeout(600);
/* 2026/11/11 依頼主（別の作業）：プロフィールの数を押すと、画面の上に一覧（68-follow-modal.js）。アドレス #/u/ID/followers の一覧の画面はそのまま */
await pg.click('.pf-stats [data-fl="followers"]');await pg.waitForTimeout(900);
ok(await pg.evaluate(()=>!document.getElementById('flm').hidden&&[...document.querySelectorAll('#flm .fl-row')].map(x=>x.dataset.flGo).sort().join()==='mio,ren'),'フォロワーの数を押すと一覧が画面の上に開く（ミオ・レン）');
await pg.click('#flm [data-fl-x=close]');await pg.waitForTimeout(400);
await go(pg,'#/u/sakura/followers');await pg.waitForTimeout(900);
ok(await pg.evaluate(()=>location.hash)==='#/u/sakura/followers','アドレスでフォロワーの一覧の画面');
ok((await pg.$$eval('#fw-list .fw-row',l=>l.map(x=>x.dataset.fh))).sort().join()==='mio,ren','フォロワーの一覧（ミオ・レン）');
ok(await pg.$eval('[data-fh="ren"] [data-ff]',e=>e.textContent)==='フォロー中','フォローしている人にはフォロー中');
ok(await pg.$eval('[data-fh="mio"]',e=>e.textContent.includes('フォローされています')),'フォローされている印');
await shot(pg,'f-followers');
await pg.click('.fw-seg a[href$="/following"]');await pg.waitForTimeout(800);
ok(await pg.evaluate(()=>location.hash)==='#/u/sakura/following'&&(await pg.$$eval('#fw-list .fw-row',l=>l.map(x=>x.dataset.fh))).sort().join()==='kagi,ren','フォロー中に切りかえ（カギ・レン）');
await go(pg,'#/u/kagi/followers');await pg.waitForTimeout(800);
ok(!!await pg.$('#fw-list [data-fh="sakura"]'),'許可された鍵垢のフォロワー一覧は見られる');
/* フォローのリクエストの画面（2026/11/11） */
await call('/api/follow',TK.ren,{handle:'kagi'});await call('/api/follow',TK.mio,{handle:'kagi'});
await go(pk,'#/notif');await pk.waitForTimeout(1200);
ok(await pk.$eval('#nf-fq',e=>!e.hidden&&e.textContent.includes('2')),'お知らせの画面の上にフォローリクエスト2件');
await pk.click('#nf-fq');await pk.waitForTimeout(1000);
ok(await pk.evaluate(()=>location.hash)==='#/requests'&&(await pk.$$('#fq-list .fw-row')).length===2,'リクエストの画面に2件');
await shot(pk,'f-requests');
await pk.click('[data-fh="ren"] [data-ok="1"]');await pk.waitForTimeout(150);
ok(!!await pk.$('.fw-row.fw-out'),'許可した行がなめらかに消える');await pk.waitForTimeout(500);
ok((await pk.$$('#fq-list .fw-row')).length===1&&(await call('/api/u/kagi',TK.ren))[1].user.followed,'許可するとフォローになる');
await pk.click('[data-fh="mio"] [data-ok="0"]');await pk.waitForTimeout(700);
ok(await pk.$eval('#fq-list',e=>e.textContent.includes('届いているリクエストはありません'))&&!(await call('/api/u/kagi',TK.mio))[1].user.requested,'断るとリクエストが消える');
await go(pk,'#/u/kagi');await pk.waitForTimeout(800);
ok(!!await pk.$('.pf-fq[href="#/requests"]'),'鍵垢の本人のプロフィールにフォローリクエストの入口');
/* リアルタイム：相手が送ったメッセージが2秒ほどで出る */
await go(pg,'#/messages/ren');await pg.waitForTimeout(800);
await call('/api/dm/send',TK.ren,{to:'sakura',body:'リアルタイムの確認です'});await pg.waitForTimeout(2600);
ok(await pg.$eval('#dm-log',e=>e.textContent.includes('リアルタイムの確認です')),'会話は2秒ほどで届く');
/* 画像を左右にスワイプ（2026/11/11） */
const imgs=await pg.evaluate(()=>[['#e5484d','1'],['#1d9bf0','2'],['#30a46c','3']].map(([c,t])=>{const k=document.createElement('canvas');k.width=800;k.height=600;const g=k.getContext('2d');g.fillStyle=c;g.fillRect(0,0,800,600);g.fillStyle='#fff';g.font='bold 300px sans-serif';g.fillText(t,300,420);return k.toDataURL('image/png').split(',')[1]}));
const keys=[];for(const d of imgs){const r=await w.fetch(new Request('https://x.dev/api/media?w=800&h=600',{method:'POST',headers:{authorization:'Bearer '+TK.ren,'content-type':'image/png','cf-connecting-ip':'10.3.0.1'},body:Buffer.from(d,'base64')}),env,{waitUntil(){}});keys.push((await r.json()).key)}
ok(keys.every(Boolean),'画像を送れた');
await call('/api/notes',TK.ren,{body:'構築の画像3枚です',media:keys});
await go(pg,'#/u/ren');await pg.waitForTimeout(1500);
ok(await pg.$eval('.tw-car',e=>getComputedStyle(e).display==='flex'&&getComputedStyle(e).scrollSnapType.includes('x')),'スマホでは画像が横に並んで、ぴたっと止まる');
ok(await pg.$eval('.tw-mdw .tw-cnum',e=>e.textContent)==='1/3'&&(await pg.$$('.tw-mdw .tw-dots i')).length===3,'1/3 と点が3つ');
await pg.$eval('.tw-car',e=>e.scrollTo({left:e.clientWidth,behavior:'instant'}));await pg.waitForTimeout(300);
ok(await pg.$eval('.tw-mdw .tw-cnum',e=>e.textContent)==='2/3'&&await pg.$eval('.tw-dots i:nth-child(2)',e=>e.classList.contains('on')),'スワイプすると2/3・2つ目の点');
await shot(pg,'f-carousel');
await pg.click('.tw-car .tw-mi[data-mi="1"]');await pg.waitForTimeout(500);
ok(await pg.$eval('.tw-vc',e=>e.textContent)==='2 / 3','押した画像から大きく見られる');
await pg.$eval('.tw-vt',e=>e.scrollTo({left:e.clientWidth*2,behavior:'instant'}));await pg.waitForTimeout(300);
ok(await pg.$eval('.tw-vc',e=>e.textContent)==='3 / 3','大きく見る画面でもスワイプで切りかえ');
await shot(pg,'f-viewer');
await pg.click('.tw-vx');await pg.waitForTimeout(200);
ok(!await pg.$('.tw-view'),'閉じる');
{const pc=await page('sakura',{width:1280,height:860});await pc.goto(URL0+'#/u/ren');await pc.waitForTimeout(1800);
  ok(await pc.$eval('.tw-car',e=>getComputedStyle(e).display==='grid'),'パソコンでは画像を今までどおり並べる');await shot(pc,'f-pc-images');
  await go(pc,'#/u/sakura/followers');await pc.waitForTimeout(1000);await shot(pc,'f-pc-followers');}
/* PC の幅 */
if(SHOT){const pc=await page('sakura',{width:1280,height:860});await pc.goto(URL0+'#/messages');await pc.waitForTimeout(1500);await shot(pc,'m-pc-list');
  await go(pc,'#/messages/ren');await pc.waitForTimeout(800);await shot(pc,'m-pc-talk');await go(pc,'#/messages/kagi');await pc.waitForTimeout(600);await shot(pc,'m-pc-kagi')}
await b.close();
console.log(process.exitCode?'dm: NG':`dm: OK（${n}項目）`);
