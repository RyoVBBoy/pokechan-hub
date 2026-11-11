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
const users={},cloud={},notes=[],follows=new Set();
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
const handler=async r=>{
  const u=new URL(r.request().url());const js={status:200,headers:{'Access-Control-Allow-Origin':'*','Content-Type':'text/javascript'}};
  if(u.host==='www.gstatic.com'&&u.pathname.endsWith('/firebase-app.js'))return r.fulfill({...js,body:FB_APP});
  if(u.host==='www.gstatic.com'&&u.pathname.endsWith('/firebase-auth.js'))return r.fulfill({...js,body:FB_AUTH});
  if(/^\/api\/(tl|notes|u\/|follow|notifs)/.test(u.pathname))return social(r,u);
  if(u.pathname.startsWith('/api/me')){
    const h={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Content-Type':'application/json'};
    if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:h});
    const tok=(r.request().headers().authorization||'').replace(/^Bearer /,'');
    if(!tok.startsWith('tok:'))return r.fulfill({status:401,headers:h,body:JSON.stringify({error:'ログインし直してください。'})});
    const email=tok.slice(4);let body={};if(u.pathname!=='/api/media')try{body=r.request().postDataJSON?.()||{}}catch(e){}
    if(u.pathname==='/api/me/teams'){if(r.request().method()==='GET')return r.fulfill({headers:h,body:JSON.stringify(cloud[email]||{teams:null,updated_at:0})});
      const c=cloud[email];if(c&&c.updated_at>body.updated_at)return r.fulfill({status:409,headers:h,body:'{"ok":false}'});cloud[email]={teams:body.teams,updated_at:body.updated_at};return r.fulfill({headers:h,body:'{"ok":true}'})}
    /* プロフィールの写真（2026/11/03） */
    if(u.pathname==='/api/media')return r.fulfill({headers:h,body:JSON.stringify({ok:true,key:'a'.repeat(32),w:400,h:400})});
    if(u.pathname==='/api/me/avatar'){users[email]={...users[email],av:body.remove?null:body.key};return r.fulfill({headers:h,body:JSON.stringify({ok:true,user:users[email]})})}
    if(u.pathname==='/api/me/delete'){delete users[email];return r.fulfill({headers:h,body:'{"ok":true}'})}
    if(r.request().method()==='POST'){
      if(!users[email]&&!body.agree)return r.fulfill({status:400,headers:h,body:JSON.stringify({error:'同意が必要です。'})});
      users[email]={handle:body.handle,name:body.name,bio:body.bio||''};return r.fulfill({headers:h,body:JSON.stringify({ok:true,user:users[email]})});
    }
    return r.fulfill({headers:h,body:JSON.stringify({user:users[email]||null,email})});
  }
  return r.abort();
};
await pg.route(/^https?:/,handler);
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
/* アカウントの画面（2026/11/11 依頼主「X のアカウント画面と同じに」）：カード・1行のリスト・赤いログアウト・下に利用規約とプライバシーポリシー、図鑑などのリンク（フッター）は出さない */
{const a=await pg.evaluate(()=>{const R=document.getElementById('ac-root');const rows=[...R.querySelectorAll('.dr-row')];
  return {card:!!R.querySelector('.ac2-card .ac2-me[href="#/u/trainer_01"]'),mail:/ログイン中/.test(R.querySelector('.ac2-mail')?.textContent||''),
    rows:rows.map(r=>r.querySelector('.dr-rt b').textContent).join('/'),
    sub:R.querySelector('.ac2-pv .dr-rt small')?.textContent,tg:!!R.querySelector('.ac2-pv input.pv-sw[data-priv]'),
    line:getComputedStyle(rows[0]).borderBottom,out:getComputedStyle(R.querySelector('#ac-out .dr-rt b')).color,
    legal:[...R.querySelectorAll('.ac2-legal a')].map(a=>a.getAttribute('href')).join(),
    foot:getComputedStyle(document.querySelector('.foot')).display,dex:!!R.querySelector('a[href^="#/dex"],a[href^="#/calc"],a[href^="#/sources"]'),
    form:!!document.getElementById('ac-h')}});
  ok(a.card&&a.mail,'アカウントのカード（自分のページを見る・メール） '+JSON.stringify(a));
  ok(a.rows==='プロフィールを編集/アカウントを非公開にする（鍵垢）/メッセージ設定/フォローのリクエスト/表示・テーマ/ログアウト/アカウントを削除','1行のリストの並び '+a.rows);
  ok(a.sub==='許可したユーザーのみに投稿とメッセージを公開します'&&a.tg,'非公開の行に説明とトグル');
  ok(/1px solid rgba\((255, 255, 255|15, 20, 25), 0\.08\)/.test(a.line)&&a.out==='rgb(244, 33, 46)','線と赤いログアウト '+a.line+' '+a.out);
  ok(a.legal==='#/terms,#/privacy'&&a.foot==='none'&&!a.dex&&!a.form,'下に利用規約とプライバシーポリシーだけ・入力欄はない '+[a.legal,a.foot,a.dex,a.form]);
  /* メッセージ設定の行 → 設定の画面のメッセージ設定のページ */
  await pg.click('[data-ac2=dm]');await wait(500);
  ok(await pg.evaluate(()=>!document.getElementById('setm').hidden&&document.getElementById('sm-t').textContent==='メッセージ設定'&&document.querySelectorAll('#setm [data-dmfrom-set]').length===2),'メッセージ設定のページが開く');
  await pg.click('#setm [data-sm=close]');await wait(400);
  /* 編集の画面：文字数・空の名前・IDの形では保存できない・変えたまま閉じると確かめる */
  await pg.click('#ac-edit');await wait(500);
  const e=await pg.evaluate(()=>{const o=document.getElementById('pem'),p=o.querySelector('.sm-p').getBoundingClientRect();
    return [o.querySelector('#pe-t').textContent,!!o.querySelector('[data-pe=close]'),o.querySelector('#pe-save').textContent,!!o.querySelector('.pe-cam'),o.querySelector('#pe-cn').textContent,o.querySelector('#pe-cb').textContent,o.querySelector('#pe-ch').textContent,Math.round(p.width)]});
  ok(e[0]==='プロフィールを編集'&&e[1]&&e[2]==='保存'&&e[3]&&e[4]==='5/20'&&e[5]==='0/160'&&e[6]==='10/15','編集の画面の形 '+e);
  await pg.fill('#pe-n','');ok(await pg.$eval('#pe-save',b=>b.disabled),'名前が空なら保存できない');
  await pg.fill('#pe-n','トレーナー');await pg.fill('#pe-h','ab');ok(await pg.$eval('#pe-save',b=>b.disabled),'IDが短ければ保存できない');
  await pg.fill('#pe-h','trainer_01');await pg.fill('#pe-b','とちゅう');await pg.click('#pem [data-pe=close]');await wait(300);
  ok(await pg.evaluate(()=>/変更を破棄しますか/.test(document.querySelector('.xc h3')?.textContent||'')),'変えたまま閉じると確かめる');
  await pg.click('.xc .xc-ok');await wait(400);
  ok(await pg.evaluate(()=>document.getElementById('pem').hidden),'破棄すると閉じる');}
/* 2026/11/11：編集は画面の上に開く（69-profile-edit.js）。保存すると閉じてアカウントの画面に出る */
await pg.click('#ac-edit');await wait(500);
ok(await pg.evaluate(()=>!document.getElementById('pem').hidden&&document.getElementById('pe-save').disabled&&document.getElementById('pe-n').value==='トレーナー'),'プロフィールを編集が開かない／はじめから保存できる');
await pg.fill('#pe-b','ガブリアス使いです');await pg.click('#pe-save');await wait(700);
ok(await pg.evaluate(()=>document.getElementById('pem').hidden),'保存しても閉じません');
ok(/ガブリアス使いです/.test(await txt()),'自己紹介の保存が反映されません');
/* プロフィールの写真：選ぶと縮めて送り、自分のアイコン（プロフィール・左上）が写真になる */
{const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAAFElEQVR4nGP4z8DAwMDAxMDAwAAAH/4CAR2T8lEAAAAASUVORK5CYII=','base64');
await pg.click('#ac-edit');await wait(500);
await pg.setInputFiles('#pe-pf',{name:'me.png',mimeType:'image/png',buffer:png});await wait(500);
ok(await pg.$('#pe-av img')&&!await pg.$eval('#pe-save',b=>b.disabled),'写真を選ぶと編集の画面に出て保存できる');
await pg.click('#pe-save');await wait(900);
ok(await pg.$('.ac-card .ac-av img'),'写真を選んでもプロフィールに出ません');
await pg.click('#ac-edit');await wait(500);
ok(await pg.$('#pe-prm'),'「写真を外す」が出ません');
await pg.click('#pem [data-pe=close]');await wait(400);
ok(await pg.evaluate(()=>document.getElementById('pem').hidden),'変えていなければ確かめずに閉じる');
await pg.evaluate(()=>{location.hash='#/'});await wait(500);
ok(await pg.$('#brand img'),'写真を選んでも左上のアイコンが写真になりません');
await pg.evaluate(()=>{location.hash='#/account'});await wait(500);
}
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
/* パーティの同期：この端末で変えたパーティが、別の端末（B）でログインすると出る */
await pg.evaluate(()=>{switchTeam(1);team=[{no:445,sel:true},{no:149,sel:true}];TEAMS.list[1].name='ダブル用';saveTeam()});await wait(2200);
ok(cloud['g@example.com']&&cloud['g@example.com'].teams.list[1].team.length===2,'パーティがサーバーに保存されません');
const pgB=await (await b.newContext({viewport:{width:390,height:844},locale:'ja-JP'})).newPage();
pgB.on('pageerror',e=>errs.push('B: '+e.message));await pgB.route(/^https?:/,handler);
await pgB.goto(URL0+'#/account');await pgB.waitForTimeout(800);await pgB.click('#ac-google');await pgB.waitForTimeout(1200);
await pgB.evaluate(()=>{location.hash='#/team'});await pgB.waitForTimeout(800);
const tb=await pgB.evaluate(()=>[TEAMS.cur,team.map(x=>x.no).join(),TEAMS.list[1].name,document.getElementById('tsync')?.innerText||'']);
ok(tb[0]===1&&tb[1]==='445,149'&&tb[2]==='ダブル用'&&/どの端末でも同じ/.test(tb[3]),'別の端末でパーティが同じになりません: '+JSON.stringify(tb));
/* 端末Bで変えると、端末Aにも戻ってくる */
await pgB.evaluate(()=>{addTeam(248)});await pgB.waitForTimeout(2200);
await pg.evaluate(()=>teamSync(true));await wait(800);
ok(await pg.evaluate(()=>team.map(x=>x.no).join()==='445,149,248'),'別の端末の変更が戻ってきません');
await pgB.close();
/* ログアウト */
await pg.evaluate(()=>{location.hash='#/account'});await wait(500);
await pg.click('#ac-out');await wait(300);
ok(await pg.$('.xc .xc-ok'),'ログアウトの前に確かめません');await pg.click('.xc .xc-ok');await wait(500);
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
