// お気に入りのポケモンと、ポケモンを選ぶ画面のカテゴリ（2026/11/12 依頼主）の確認：
// 本物のサーバーのプログラム（worker/dist/worker.js、D1 は Node の SQLite）にサイトをつなぎ、ログインだけにせものにする（bookmark.mjs と同じ形）。
// ①サーバー：/api/me/favs の保存・読み出し・本人だけ・ログインなしは断る・おかしな値は捨てる
// ②図鑑の一覧の ☆（画面は移らない）→ 図鑑のページ・選ぶ画面にもすぐ ★、もう一度で外す・同じ匹は1つだけ
// ③姿・地方の姿・メガの姿はそれぞれ別の番号で覚える（選ぶ画面のお気に入りではメガは元の姿で出す）
// ④選ぶ画面の5つのカテゴリ（履歴・お気に入り・環境上位・パーティ・すべて）と、0件のときの案内
// ⑤ログアウト中は端末に残る・ログイン中は別の端末にも伝わる（外したことも）
// ⑥前からの動き：名前の検索・Enter で選ぶ・パーティに足すときはいる匹を出さない
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
const call=async(p,t,body)=>{const h={'content-type':'application/json','cf-connecting-ip':'10.1.0.1',origin:'null'};if(t)h.authorization='Bearer '+t;
  const r=await w.fetch(new Request('https://x.dev'+p,{method:body?'POST':'GET',headers:h,body:body?JSON.stringify(body):undefined}),env,{waitUntil(){}});return[r.status,await r.json().catch(()=>({}))]};
let n=0;const fail=m=>{console.error('NG',m);process.exitCode=1};const ok=(c,m)=>{n++;if(!c)fail(m)};
const TK={};
for(const [id,h,name] of [['uA','sakura','さくら'],['uB','ren','レン']]){TK[h]=await tok(id);const r=await call('/api/me',TK[h],{handle:h,name,bio:'',agree:true});ok(r[0]===200,'プロフィール '+h)}
/* ① サーバー */
{let r=await call('/api/me/favs',TK.ren,{favs:{'6':{on:1,at:5},'abc':{on:1,at:1},'7':'x','10034':{on:0,at:9}}});ok(r[0]===200,'保存 '+JSON.stringify(r));
  r=await call('/api/me/favs',TK.ren);ok(r[0]===200&&JSON.stringify(r[1].favs)===JSON.stringify({'6':{on:1,at:5},'10034':{on:0,at:9}}),'読み出し（おかしな値は捨てる） '+JSON.stringify(r[1]));
  r=await call('/api/me/favs',TK.sakura);ok(r[0]===200&&r[1].favs===null,'ほかの人には見えない');
  r=await call('/api/me/favs','',{favs:{}});ok(r[0]===401,'ログインなしは断る '+r[0]);
  r=await call('/api/me/favs',TK.ren,{favs:[1,2]});ok(r[0]===400,'形がおかしいものは断る');
  r=await call('/api/me/favs',TK.ren,{favs:{}});ok(r[0]===200,'空に戻す')}

const FB_APP=`export const initializeApp=c=>({c});`;
const FB_AUTH=`const who=localStorage.getItem('fakeuser');let user=who?{uid:who,email:who+'@example.com',getIdToken:async()=>window.__TOKS[who]}:null;const cbs=[];
export const getAuth=()=>({});export const onAuthStateChanged=(a,f)=>{cbs.push(f);setTimeout(()=>f(user),0)};
export class GoogleAuthProvider{};export class OAuthProvider{constructor(id){this.id=id}addScope(){}};
export const signInWithPopup=async()=>{};export const signInWithRedirect=signInWithPopup;export const signOut=async()=>{user=null;cbs.forEach(f=>f(null))};
export const sendSignInLinkToEmail=async()=>{};export const isSignInWithEmailLink=()=>false;export const signInWithEmailLink=async()=>{};`;
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
async function page(who,vp={width:390,height:844},ctx0){
  const ctx=ctx0||await b.newContext({viewport:vp,locale:'ja-JP',deviceScaleFactor:SHOT?2:1,hasTouch:vp.width<700,isMobile:vp.width<700});
  if(!ctx0)await ctx.addInitScript(([who,toks])=>{try{if(who&&!sessionStorage.getItem('__init')){localStorage.setItem('fakeuser',who);localStorage.setItem('pcin','1')}sessionStorage.setItem('__init','1');localStorage.setItem('pcstart','1');if(!localStorage.getItem('pctheme'))localStorage.setItem('pctheme','dark')}catch(e){}window.__TOKS=toks},[who,TK]);
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
const pressed=(pg,sel)=>pg.$$eval(sel,a=>a.map(x=>x.getAttribute('aria-pressed')));
const openPick=async(pg,cat,opt)=>{await pg.evaluate(([c,o])=>{localStorage.setItem('pcmptab',JSON.stringify(c));window.__pick=pickMon(0,o||{})},[cat,opt]);await pg.waitForSelector('.mpsheet.on .mp-cats');await pg.waitForTimeout(250)};
const listNos=pg=>pg.$$eval('#mp-list .mp-r',a=>a.map(x=>+(x.dataset.no||x.querySelector('[data-fav]').dataset.fav)));
const closePick=async pg=>{await pg.evaluate(()=>document.querySelector('.mpsheet .psheet-bg').click());await pg.waitForTimeout(260)};

for(const W of [390,1280]){
  /* ログアウト中の端末 */
  const pg=await page('',{width:W,height:W<700?844:900});
  await pg.goto(URL0+'#/dex');await pg.waitForSelector('#dl .row [data-fav]');await pg.waitForTimeout(300);
  /* ② 図鑑の一覧の ☆ */
  await pg.click('#dl .row [data-fav="6"]');await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>location.hash)==='#/dex',W+'：☆を押しても画面は移らない');
  ok((await pressed(pg,'[data-fav="6"]')).every(x=>x==='true'),W+'：一覧の ☆ が ★ に');
  ok(await pg.evaluate(()=>[...document.querySelectorAll('.toast')].some(t=>t.textContent.includes('お気に入りに登録しました'))),W+'：登録のお知らせ');
  const sz=await pg.$eval('#dl .row [data-fav="6"]',e=>{const r=e.getBoundingClientRect();return [r.width,r.height]});ok(sz[0]>=44&&sz[1]>=44,W+'：☆ は押しやすい大きさ '+sz);
  await shot(pg,'fav-dex-'+W);
  /* 図鑑のページにも ★（画面を移っても同じ） */
  await pg.goto(URL0+'#/p/6');await pg.waitForSelector('.phead [data-fav="6"]');
  ok((await pressed(pg,'.phead [data-fav="6"]'))[0]==='true',W+'：図鑑のページにも ★');
  await shot(pg,'fav-detail-'+W);
  /* ③ メガの姿は別の番号 */
  const mega=await pg.evaluate(()=>megasOf(6)[0].no);
  await pg.goto(URL0+'#/p/'+mega);await pg.waitForSelector(`.phead [data-fav="${mega}"]`);
  ok((await pressed(pg,`.phead [data-fav="${mega}"]`))[0]==='false',W+'：メガの姿は別（まだ ☆）');
  await pg.click(`.phead [data-fav="${mega}"]`);await pg.waitForTimeout(200);
  ok(await pg.evaluate(m=>favOn(m)&&favOn(6),mega),W+'：メガの姿も登録できる');
  /* 地方の姿も別の番号（同じ図鑑番号の姿を1つだけ登録） */
  const reg=await pg.evaluate(()=>{const q=P.find(p=>p.dno!==p.no&&P.some(x=>x.no===p.dno));return q?[q.no,q.dno]:null});
  if(reg){await pg.evaluate(n=>favSet(n,true),reg[0]);ok(await pg.evaluate(([a,b2])=>favOn(a)&&!favOn(b2),reg),W+'：姿違いは別々 '+reg)}
  /* 同じ匹は1つだけ（2回登録しても1つ） */
  await pg.evaluate(()=>{favSet(6,true);favSet(6,true)});
  ok(await pg.evaluate(()=>favList().filter(n=>n===6).length===1),W+'：同じ匹は重ならない');
  /* ④ 選ぶ画面：お気に入り（メガは元の姿に。リザードンは1回だけ） */
  await openPick(pg,'fav');
  const fl=await listNos(pg);ok(fl.filter(n=>n===6).length===1&&!fl.includes(mega)&&(!reg||fl.includes(reg[0])),W+'：お気に入りの一覧 '+fl);
  ok(await pg.$eval('.mp-cat[aria-selected=true]',e=>e.dataset.cat)==='fav',W+'：選んでいるカテゴリが分かる');
  const cats=await pg.$$eval('.mp-cat',a=>a.map(x=>x.textContent.trim()).join(','));ok(cats==='履歴,お気に入り,環境上位,パーティ,すべて',W+'：5つのカテゴリ '+cats);
  const fit=await pg.$$eval('.mp-cat',a=>{const p=a[0].parentNode.getBoundingClientRect();return a.every(x=>{const r=x.getBoundingClientRect();return r.left>=p.left-1&&r.right<=p.right+1&&r.height>=44})});ok(fit,W+'：カテゴリが幅に収まる');
  await shot(pg,'fav-pick-fav-'+W);
  /* 選ぶ画面で外す → すぐ消えて、ほかの画面の ☆ も変わる */
  await pg.evaluate(m=>{favSet(m,false)},mega);
  if(reg)await pg.evaluate(n=>favSet(n,false),reg[0]);
  await pg.click('#mp-list [data-fav="6"]');await pg.waitForTimeout(250);
  ok(await pg.evaluate(()=>!!document.querySelector('.mpsheet.on')),W+'：☆を押しても選んだことにならない');
  ok(!(await pg.evaluate(()=>favOn(6))),W+'：選ぶ画面で外せる');
  ok(await pg.$eval('#mp-list',e=>!!e.querySelector('.mp-empty')&&e.textContent.includes('お気に入りはまだありません')&&e.textContent.includes('☆を押すと')),W+'：0件の案内カード');
  ok((await pressed(pg,'.phead [data-fav]'))[0]==='false',W+'：後ろの図鑑のページの ☆ もすぐ変わる');
  await shot(pg,'fav-pick-empty-'+W);
  /* 案内カードから、登録すると一覧に切りかわる */
  await pg.evaluate(()=>favSet(25,true));await pg.waitForTimeout(150);
  ok((await listNos(pg)).join()==='25',W+'：登録すると通常の一覧に');
  /* 履歴：図鑑のページを開いた匹（メガは元の姿）。0件なら案内 */
  await pg.click('.mp-cat[data-cat=hist]');await pg.waitForTimeout(150);
  ok((await listNos(pg))[0]===6,W+'：履歴の先頭は最後に見た匹（メガは元の姿） '+(await listNos(pg)));
  await pg.evaluate(()=>{localStorage.setItem('pcmonrecent','[]')});await pg.click('.mp-cat[data-cat=all]');await pg.click('.mp-cat[data-cat=hist]');await pg.waitForTimeout(150);
  ok(await pg.$eval('#mp-list',e=>e.textContent.includes('履歴はまだありません')),W+'：履歴0件の案内');
  /* 環境上位：集計の上位（読めないときは案内） */
  await pg.evaluate(()=>{META.rank=[];META.st='fail';META.p=Promise.resolve(false)});
  await pg.click('.mp-cat[data-cat=top]');await pg.waitForTimeout(150);
  ok(await pg.$eval('#mp-list',e=>e.textContent.includes('ランキングを読み込めませんでした')),W+'：集計が読めないときの案内');
  await pg.evaluate(()=>{META.rank=[445,6,10034,149,445].map((no,i)=>({no,rank:i+1,d:{}}));META.st='ready';META.p=Promise.resolve(true)});
  await pg.click('.mp-cat[data-cat=all]');await pg.click('.mp-cat[data-cat=top]');await pg.waitForTimeout(150);
  ok((await listNos(pg)).join()==='445,6,149',W+'：環境上位＝集計の順（メガは元の姿・重ならない） '+(await listNos(pg)));
  /* パーティ：0件なら案内 */
  await pg.click('.mp-cat[data-cat=party]');await pg.waitForTimeout(150);
  ok(await pg.$eval('#mp-list',e=>e.textContent.includes('パーティにまだポケモンがいません')),W+'：パーティ0件の案内');
  /* すべて＋検索（前と同じ） */
  await pg.click('.mp-cat[data-cat=all]');await pg.waitForTimeout(150);
  ok((await listNos(pg)).length===(await pg.evaluate(()=>P.length)),W+'：すべて＝全部のポケモン');
  await pg.fill('#mp-q','がぶ');await pg.waitForTimeout(150);
  ok((await listNos(pg))[0]===445,W+'：名前の検索（ひらがな）');
  await pg.press('#mp-q','Enter');const v=await pg.evaluate(()=>window.__pick);ok(v===445,W+'：Enter で選べる '+v);
  /* カテゴリは端末に覚える */
  ok(await pg.evaluate(()=>JSON.parse(localStorage.getItem('pcmptab')))==='all',W+'：最後のカテゴリを覚える');
  /* パーティ：いる匹は選べない形で出す（足すとき）・ほかでは出さない */
  await pg.evaluate(()=>{team=[{no:6},{no:445}];saveTeam&&saveTeam(true)});
  await openPick(pg,'party',{add:true});
  ok(await pg.$$eval('#mp-list .mp-r',a=>a.length===2&&a.every(x=>x.classList.contains('mp-off')&&!x.dataset.no)),W+'：足すときはパーティの匹を薄く・選べない');
  await shot(pg,'fav-pick-party-'+W);
  await pg.click('.mp-cat[data-cat=all]');await pg.waitForTimeout(150);
  ok(!(await listNos(pg)).includes(445),W+'：足すときはすべてにもパーティの匹を出さない（前と同じ）');
  await closePick(pg);
  await openPick(pg,'party');ok((await listNos(pg)).join()==='6,445',W+'：パーティのカテゴリ');await closePick(pg);
  /* ⑤ ログアウト中は端末に残る */
  await pg.reload();await pg.waitForTimeout(500);
  ok(await pg.evaluate(()=>favOn(25)&&!favOn(6)),W+'：読み直しても端末に残る');
  ok(pg.errs.length===0,W+'：エラーなし '+pg.errs.join('|'));
  await pg.ctx.close();
}
/* ⑤ ログイン中：端末Aで登録 → 端末Bに伝わる → Bで外す → Aに伝わる */
{const A=await page('sakura');await A.goto(URL0+'#/dex');await A.waitForSelector('#dl .row [data-fav]');await A.waitForTimeout(1200);
  await A.click('#dl .row [data-fav="3"]');await A.waitForTimeout(1800);
  let r=await call('/api/me/favs',TK.sakura);ok(r[1].favs&&r[1].favs['3']&&r[1].favs['3'].on===1,'ログイン中はサーバーにも保存 '+JSON.stringify(r[1]));
  const B=await page('sakura',{width:1280,height:900});await B.goto(URL0+'#/dex');await B.waitForSelector('#dl .row [data-fav]');await B.waitForTimeout(1500);
  ok(await B.evaluate(()=>favOn(3)),'別の端末に伝わる');
  ok((await pressed(B,'#dl .row [data-fav="3"]'))[0]==='true','別の端末の一覧も ★');
  await B.click('#dl .row [data-fav="3"]');await B.waitForTimeout(1800);
  r=await call('/api/me/favs',TK.sakura);ok(r[1].favs['3'].on===0,'外したこともサーバーに');
  await A.evaluate(()=>teamSync(true));await A.waitForTimeout(1200);
  ok(!(await A.evaluate(()=>favOn(3))),'外したことが別の端末にも伝わる');
  /* ログアウトしても端末の分は残る（消さない）。ほかの人のサーバーの分とは混ざらない */
  r=await call('/api/me/favs',TK.ren);ok(!r[1].favs||!r[1].favs['3'],'ほかの人のサーバーの分と混ざらない');
  ok(A.errs.length===0&&B.errs.length===0,'エラーなし '+A.errs.concat(B.errs).join('|'));
  await A.ctx.close();await B.ctx.close()}
await b.close();
console.log(process.exitCode?'favs: NG':`favs: OK（${n}項目）`);
