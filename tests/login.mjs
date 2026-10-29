// ログイン画面の動作確認：Firebase とサーバーを「にせもの」に差し替えて、
// Googleログイン → プロフィール作成 → 編集 → ログアウト → メールのリンクでログイン、の流れを確かめる
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const pg=await (await b.newContext({viewport:{width:390,height:844}})).newPage();
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
/* にせもののサーバー（/api/me） */
const users={};
await pg.route(/^https?:/,async r=>{
  const u=new URL(r.request().url());const js={status:200,headers:{'Access-Control-Allow-Origin':'*','Content-Type':'text/javascript'}};
  if(u.host==='www.gstatic.com'&&u.pathname.endsWith('/firebase-app.js'))return r.fulfill({...js,body:FB_APP});
  if(u.host==='www.gstatic.com'&&u.pathname.endsWith('/firebase-auth.js'))return r.fulfill({...js,body:FB_AUTH});
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
/* ログアウト */
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
