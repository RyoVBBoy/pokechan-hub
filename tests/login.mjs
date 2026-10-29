// ログイン画面の動作確認：Firebase とサーバーを「にせもの」に差し替えて、
// Googleログイン → プロフィール作成 → 編集 → ログアウト → メールのリンクでログイン、の流れを確かめる
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const pg=await (await b.newContext({viewport:{width:390,height:844},locale:'ja-JP'})).newPage();
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
const fail=m=>{console.error('NG',m);process.exitCode=1};
let n=0;const ok=(c,m)=>{n++;if(!c)fail(m)};

/* にせものの Firebase（ログイン状態はページの中だけで持つ） */
const FB_APP=`export const initializeApp=c=>({c});`;
const FB_AUTH=`let user=null;const cbs=[];const fire=()=>cbs.forEach(f=>f(user));
const mk=email=>({uid:'uid-'+email,email,getIdToken:async()=>'tok:'+email,delete:async()=>{user=null;fire()}});
export const getAuth=()=>({});
export const onAuthStateChanged=(a,f)=>{cbs.push(f);setTimeout(()=>f(user),0)};
export class GoogleAuthProvider{};export class OAuthProvider{constructor(id){this.id=id}addScope(){}};
export const signInWithPopup=async()=>{user=mk('g@example.com');fire()};
export const signInWithRedirect=signInWithPopup;
export const signOut=async()=>{user=null;fire()};
export const sendSignInLinkToEmail=async(a,email,s)=>{window.__sent={email,url:s.url,inApp:s.handleCodeInApp}};
export const isSignInWithEmailLink=(a,h)=>/[?&]oobCode=/.test(h);
export const signInWithEmailLink=async(a,email)=>{user=mk(email);fire()};`;
/* にせもののサーバー（/api/me とタイムライン） */
const users={},notes=[],follows=new Set();
async function social(r,u){
  const h={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Content-Type':'application/json'};
  if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:h});
  const email=(r.request().headers().authorization||'').replace(/^Bearer tok:/,'')||null,me=email&&users[email];
  const body=r.request().postDataJSON?.()||{},P=u.pathname,J=(o,st=200)=>r.fulfill({status:st,headers:h,body:JSON.stringify(o)});
  const out=n=>({...n,liked:n.likedBy.has(email),likes:n.likedBy.size,mine:n.email===email,user:{handle:users[n.email].handle,name:users[n.email].name}});
  let m;
  if(P==='/api/tl')return J({notes:notes.slice().reverse().filter(n=>u.searchParams.get('tab')!=='following'||n.email===email||follows.has(users[n.email].handle)).map(out),next:null});
  if(P==='/api/notes'){if(!me)return J({error:'ログインしてください。'},401);notes.push({id:notes.length+1,email,body:body.body,created_at:Date.now(),likedBy:new Set()});return J({ok:true,id:notes.length})}
  if((m=P.match(/^\/api\/notes\/(\d+)\/like$/))){const n=notes[m[1]-1];body.on===false?n.likedBy.delete(email):n.likedBy.add(email);return J({ok:true,likes:n.likedBy.size})}
  if((m=P.match(/^\/api\/u\/(\w+)\/notes$/)))return J({notes:notes.filter(n=>users[n.email].handle===m[1]).reverse().map(out),next:null});
  if((m=P.match(/^\/api\/u\/(\w+)$/))){const e=Object.keys(users).find(k=>users[k].handle===m[1]);if(!e)return J({error:'ユーザーが見つかりません。'},404);
    return J({user:{...users[e],followers:follows.has(m[1])?1:0,following:0,notes:notes.filter(n=>n.email===e).length,followed:follows.has(m[1]),follows_me:false,me:e===email}})}
  if(P==='/api/follow'){body.on===false?follows.delete(body.handle):follows.add(body.handle);return J({ok:true,followed:body.on!==false,followers:follows.has(body.handle)?1:0})}
  if(P==='/api/notifs/count')return J({unread:me?1:0});
  if(P==='/api/notifs')return J({notifs:[{id:1,kind:'follow',note_id:null,created_at:Date.now(),user:{handle:'bob',name:'ボブ'}}],seen:0,next:null});
  if(P==='/api/notifs/seen')return J({ok:true});
  return J({error:'見つかりません。'},404);
}
await pg.route(/^https?:/,async r=>{
  const u=new URL(r.request().url());const js={status:200,headers:{'Access-Control-Allow-Origin':'*','Content-Type':'text/javascript'}};
  if(u.host==='www.gstatic.com'&&u.pathname.endsWith('/firebase-app.js'))return r.fulfill({...js,body:FB_APP});
  if(u.host==='www.gstatic.com'&&u.pathname.endsWith('/firebase-auth.js'))return r.fulfill({...js,body:FB_AUTH});
  if(/^\/api\/(tl|notes|u\/|follow|notifs)/.test(u.pathname))return social(r,u);
  if(u.pathname.startsWith('/api/me')){
    const h={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Content-Type':'application/json'};
    if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:h});
    const tok=(r.request().headers().authorization||'').replace(/^Bearer /,'');
    if(!tok.startsWith('tok:'))return r.fulfill({status:401,headers:h,body:JSON.stringify({error:'ログインし直してください。'})});
    const email=tok.slice(4),body=r.request().postDataJSON?.()||{};
    if(u.pathname==='/api/me/delete'){delete users[email];return r.fulfill({headers:h,body:'{"ok":true}'})}
    if(r.request().method()==='POST'){
      if(!users[email]&&!body.agree)return r.fulfill({status:400,headers:h,body:JSON.stringify({error:'同意が必要です。'})});
      users[email]={handle:body.handle,name:body.name,bio:body.bio||''};return r.fulfill({headers:h,body:JSON.stringify({ok:true,user:users[email]})});
    }
    return r.fulfill({headers:h,body:JSON.stringify({user:users[email]||null,email})});
  }
  return r.abort();
});
const txt=()=>pg.evaluate(()=>document.querySelector('main')?.innerText||'');
const wait=ms=>pg.waitForTimeout(ms);

await pg.goto(URL0+'#/account');await wait(800);
ok(await pg.$('#ac-google'),'ログインしていないときに「Googleでログイン」が出ません');
/* Googleでログイン → プロフィールを作る画面 */
await pg.click('#ac-google');await wait(500);
ok(/プロフィールを作りましょう/.test(await txt()),'ログイン後にプロフィール作成の画面になりません');
await pg.fill('#ac-h','trainer_01');await pg.fill('#ac-n','トレーナー');
await pg.click('#ac-save');await wait(200);
ok(/同意のチェック/.test(await txt()),'同意なしでプロフィールを作れてしまいます');
await pg.check('#ac-ag');await pg.click('#ac-save');await wait(500);
ok(/@trainer_01/.test(await txt()),'プロフィールを作った後の表示が出ません');
ok(/g@example\.com/.test(await txt()),'ログイン中のメールアドレスが出ません');
/* 編集 */
await pg.fill('#ac-b','ガブリアス使いです');await pg.click('#ac-save');await wait(500);
ok(/ガブリアス使いです/.test(await txt()),'自己紹介の保存が反映されません');
/* タイムライン：投稿 → 表示 → いいね → 自分のページ */
await pg.evaluate(()=>{location.hash='#/tl'});await wait(600);
ok(await pg.$('#twc-t'),'タイムラインに投稿する欄が出ません');
ok(await pg.$eval('#twc-b',b=>b.disabled),'空のまま投稿できてしまいます');
await pg.fill('#twc-t','あ'.repeat(141));ok(await pg.$eval('#twc-b',b=>b.disabled),'141文字で投稿できてしまいます');
await pg.fill('#twc-t','はじめての投稿です');await pg.click('#twc-b');await wait(500);
ok(/はじめての投稿です/.test(await txt()),'投稿がタイムラインに出ません');
await pg.click('.tw [data-like]');await wait(300);
ok(await pg.$eval('.tw [data-like]',b=>b.getAttribute('aria-pressed')==='true'&&b.textContent.trim()==='1'),'いいねが反映されません');
await pg.click('.tw-who');await wait(600);
ok(/@trainer_01/.test(await txt())&&/1 投稿/.test((await txt()).replace(/\s+/g,' '))&&/プロフィールを編集/.test(await txt()),'自分のページの表示が正しくありません');
await pg.evaluate(()=>{location.hash='#/notif'});await wait(500);
ok(/あなたをフォローしました/.test(await txt()),'お知らせが出ません');
/* ログアウト */
await pg.evaluate(()=>{location.hash='#/account'});await wait(500);
await pg.click('#ac-out');await wait(500);
ok(await pg.$('#ac-google'),'ログアウト後にログイン画面へ戻りません');
/* メールでログイン：リンクを送る */
await pg.click('#ac-send');await wait(200);
ok(/正しく入れて/.test(await txt()),'空のメールアドレスで送れてしまいます');
await pg.fill('#ac-mail','m@example.com');await pg.click('#ac-send');await wait(300);
const sent=await pg.evaluate(()=>window.__sent);
ok(sent&&sent.email==='m@example.com'&&sent.inApp&&/index\.html\?login=mail$/.test(sent.url),'ログイン用のリンクの送り方が正しくありません: '+JSON.stringify(sent));
/* メールのリンクから戻ってくる（新しく開き直す） */
await pg.goto(URL0+'?login=mail&mode=signIn&oobCode=abc&apiKey=x');await wait(1000);
ok(/プロフィールを作りましょう/.test(await txt()),'メールのリンクから戻ったときにログインできません');
ok(await pg.evaluate(()=>location.hash==='#/account'&&!location.search),'メールのリンクから戻った後のアドレスが整理されません');
ok(await pg.evaluate(()=>{try{return !localStorage.getItem('pcmail')}catch(e){return true}}),'ログイン後もメールアドレスが残っています');

const bad=errs.filter(e=>!/Failed to load resource|net::/.test(e));
if(bad.length)fail('ページのエラー: '+bad.slice(0,5).join(' / '));
await b.close();
console.log(process.exitCode?'login: NG':'login: OK',`（${n}項目）`);
