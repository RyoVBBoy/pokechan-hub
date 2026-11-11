// フォロー中・フォロワーの一覧（src/js/66-follows.js）と、設定を読み直さずに変える（65-settings.js）の確認（2026/11/11）
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
let n=0,bad=0;const ok=(c,m)=>{n++;if(!c){bad++;console.error('NG',m)}};
const mk=(h,i,o={})=>({handle:h,name:'トレーナー'+i,bio:i%2?'シングルで遊んでいます。#構築相談 よろしくお願いします。とても長い自己紹介の文がここに続いて、二行をこえるとうしろは省略されます。':'',av:null,created_at:0,followed:false,follows_me:false,me:false,...o});
async function page(W,logged=true){
  const ctx=await b.newContext({viewport:{width:W,height:W<700?844:900},locale:'ja-JP',hasTouch:W<700,isMobile:W<700});
  await ctx.addInitScript(()=>{try{if(!localStorage.getItem('pctheme'))localStorage.setItem('pctheme','dark')}catch(e){}});
  const pg=await ctx.newPage();pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));
  pg.calls=[];
  await pg.route(/^https?:/,async r=>{const u=new URL(r.request().url());const p=u.pathname;
    if(!/\/api\//.test(p))return r.abort();
    pg.calls.push(r.request().method()+' '+p+u.search+(r.request().postData()?' '+r.request().postData():''));
    const J=o=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(o)});
    if(p==='/api/u/me1')return J({user:{handle:'me1',name:'わたし',bio:'',av:null,created_at:Date.now(),followers:3,following:60,notes:1,liked:0,followed:false,follows_me:false,me:true,results:[]}});
    const kind=u.searchParams.get('kind');
    if(p==='/api/u/me1/follows'&&kind==='followers')return J({users:[mk('alice',1,{follows_me:true,followed:true}),mk('bob',2),mk('carol',3,{private:true})],next:null});
    if(p==='/api/u/secret/follows')return J({users:[],next:null,locked:true});
    if(p==='/api/u/secret')return J({user:{handle:'secret',name:'ヒミツ',bio:'',av:null,created_at:Date.now(),followers:9,following:9,notes:0,liked:0,private:true,followed:false,follows_me:false,me:false,results:[]}});
    if(p==='/api/u/me1/follows'&&kind==='following'){const before=u.searchParams.get('before');
      return J(before?{users:[mk('last',99)],next:null}:{users:Array.from({length:50},(_,i)=>mk('u'+i,i,{followed:true})),next:12345})}
    if(p==='/api/u/alice')return J({user:{handle:'alice',name:'アリス',bio:'',av:null,created_at:Date.now(),followers:1,following:1,notes:0,liked:0,followed:true,follows_me:true,me:false,results:[]}});
    if(p==='/api/u/alice/notes'||p==='/api/u/me1/notes')return J({notes:[],next:null});
    if(p==='/api/follow'){const b=JSON.parse(r.request().postData()||'{}');const priv=b.handle==='carol'&&b.on!==false;return J({ok:true,followed:b.on!==false&&!priv,requested:priv,followers:2})}
    return r.abort()});
  if(logged)await ctx.addInitScript(()=>{window.__fakeLogin=1});
  return pg}
const login=pg=>pg.evaluate(()=>{AUTH.user={getIdToken:async()=>'t'};AUTH.profile={handle:'me1',name:'わたし',bio:'',av:null}});

for(const W of [390,1280]){
  const pg=await page(W);await pg.goto(URL0+'#/tools');await pg.waitForTimeout(700);await login(pg);
  /* 1. 左のメニューの「◯ フォロワー」を押すと、メニューが閉じて一覧が開く */
  await pg.evaluate(()=>{DR.el&&(DR.el.innerHTML='');drawerOpen()});await pg.waitForTimeout(700);
  const ff=await pg.evaluate(()=>[...document.querySelectorAll('#dr-ff [data-fl]')].map(b=>[b.dataset.fl,b.textContent.trim(),getComputedStyle(b).cursor].join(':')));
  ok(ff.join()==='following:60 フォロー:pointer,followers:3 フォロワー:pointer',W+'：メニューの数が押せる '+ff);
  await pg.click('#dr-ff [data-fl=followers]');await pg.waitForTimeout(700);
  const a=await pg.evaluate(()=>{const o=document.getElementById('flm'),p=o.querySelector('.sm-p').getBoundingClientRect();
    return {open:!o.hidden&&o.classList.contains('on'),drawer:DR.open,w:Math.round(p.width),h:Math.round(p.height),left:Math.round(p.left),
      t:document.getElementById('fl-t').textContent,hd:document.getElementById('fl-hd').textContent,
      tabs:[...o.querySelectorAll('[data-fl-tab]')].map(b=>b.textContent+':'+b.getAttribute('aria-selected')).join(),
      rows:[...o.querySelectorAll('.fl-row')].map(r=>r.dataset.flGo).join(),lock:!!o.querySelector('[data-fl-go=carol] .fl-lock'),
      fm:!!o.querySelector('[data-fl-go=alice] .fl-hd em'),btn:[...o.querySelectorAll('.fl-fb')].map(b=>b.textContent).join('/'),
      line:getComputedStyle(o.querySelector('.fl-row')).borderBottom,clamp:getComputedStyle(o.querySelector('.fl-bio')).webkitLineClamp,
      av:getComputedStyle(o.querySelector('.fl-av')).borderRadius,back:!!o.querySelector('[data-fl-x=back]'),x:!!o.querySelector('[data-fl-x=close]'),
      sw:document.documentElement.scrollWidth-innerWidth}});
  ok(a.open&&!a.drawer&&a.back&&a.x&&a.t==='わたし'&&a.hd==='@me1',W+'：一覧が開く・上に ← 名前 ✕ '+JSON.stringify(a));
  ok(W>=700?(a.w===600&&a.left===340):(a.w===390&&a.h===844),W+'：大きさ '+[a.w,a.h,a.left]);
  ok(a.tabs==='フォロー中:false,フォロワー:true'&&a.rows==='alice,bob,carol',W+'：フォロワーのタブ '+a.tabs+' '+a.rows);
  ok(a.lock&&a.fm&&a.btn==='フォロー中フォロー解除/フォローする/フォローをリクエスト',W+'：🔒・フォローされています・ボタン '+a.btn);
  ok(/1px solid rgba\(255, 255, 255, 0\.08\)/.test(a.line)&&a.clamp==='2'&&a.av==='50%'&&a.sw<=0,W+'：線・自己紹介2行・丸いアイコン '+[a.line,a.clamp,a.av]);
  /* 2. タブの切りかえ（下線がすべる）。フォロー中は50人＋続き */
  await pg.click('#flm [data-fl-tab=following]');await pg.waitForTimeout(500);
  const t=await pg.evaluate(()=>[document.querySelector('#flm [data-fl-tab=following]').getAttribute('aria-selected'),document.querySelector('#flm .fl-ind').style.transform,document.querySelectorAll('#flm .fl-row').length,!!document.querySelector('#flm [data-fl-more]')]);
  ok(t[0]==='true'&&t[1]==='translateX(0%)'&&t[2]===50&&t[3],W+'：フォロー中のタブ '+t);
  await pg.evaluate(()=>{const b=document.querySelector('#flm .fl-body');b.scrollTop=b.scrollHeight;b.dispatchEvent(new Event('scroll'))});await pg.waitForTimeout(500);
  ok(await pg.evaluate(()=>document.querySelectorAll('#flm .fl-row').length===51&&!document.querySelector('#flm [data-fl-more]'))&&pg.calls.some(c=>/follows\?kind=following&before=12345/.test(c)),W+'：下まで見ると続きを読む');
  /* 3. フォローの切りかえ（ワンタップ） */
  await pg.click('#flm [data-fl-tab=followers]');await pg.waitForTimeout(400);
  await pg.click('#flm [data-fl-fb=bob]');await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>{const b=document.querySelector('#flm [data-fl-fb=bob]');return b.classList.contains('on')&&b.getAttribute('aria-pressed')==='true'})&&pg.calls.some(c=>/POST \/api\/follow .*"handle":"bob".*"on":true/.test(c)),W+'：フォローする→フォロー中');
  await pg.click('#flm [data-fl-fb=alice]');await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>!document.querySelector('#flm [data-fl-fb=alice]').classList.contains('on'))&&pg.calls.some(c=>/POST \/api\/follow .*"handle":"alice".*"on":false/.test(c)),W+'：フォロー中→やめる');
  ok(await pg.evaluate(()=>!document.getElementById('flm').hidden),W+'：フォローしても一覧は開いたまま');
  /* 非公開の人はリクエストになる（リクエスト中→押すと取り消す） */
  await pg.click('#flm [data-fl-fb=carol]');await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>{const b=document.querySelector('#flm [data-fl-fb=carol]');return b.classList.contains('on')&&b.querySelector('.fl-a').textContent==='リクエスト中'}),W+'：非公開の人はリクエスト中');
  /* 4. 行を押すとその人のプロフィールへ（一覧は閉じる） */
  await pg.click('#flm [data-fl-go=alice] .fl-nm');await pg.waitForTimeout(700);
  ok(await pg.evaluate(()=>location.hash==='#/u/alice'&&document.getElementById('flm').hidden),W+'：行を押すとプロフィールへ');
  /* 5. プロフィールの「フォロワー」「フォロー中」も押せる */
  await pg.evaluate(()=>{location.hash='#/u/me1'});await pg.waitForTimeout(900);
  ok(await pg.evaluate(()=>getComputedStyle(document.querySelector('.pf-st-b')).cursor==='pointer'),W+'：プロフィールの数は指の形');
  await pg.click('.pf-st-b[data-fl=following]');await pg.waitForTimeout(500);
  ok(await pg.evaluate(()=>!document.getElementById('flm').hidden&&document.querySelector('#flm [data-fl-tab=following]').getAttribute('aria-selected')==='true'),W+'：プロフィールの「フォロー中」から開く');
  /* 6. ✕ と ← で閉じる */
  await pg.click('#flm [data-fl-x=close]');await pg.waitForTimeout(400);
  ok(await pg.evaluate(()=>document.getElementById('flm').hidden&&!document.body.classList.contains('sm-lock')),W+'：✕ で閉じる');
  ok(!pg.errs.length,W+'：エラー '+pg.errs);await pg.close()}

/* 非公開で一覧を見られない人は、その旨を出す */
{const pg=await page(390);await pg.goto(URL0+'#/tools');await pg.waitForTimeout(700);await login(pg);
  await pg.evaluate(()=>followListOpen('secret','followers'));await pg.waitForTimeout(700);
  ok(await pg.evaluate(()=>/非公開のアカウントです/.test(document.querySelector('#flm .fl-list').textContent)&&document.getElementById('fl-t').textContent==='ヒミツ'),'非公開で見られない一覧');
  await pg.close()}
/* 8. ログインしていないときのフォローは、アカウントの画面へ案内 */
{const pg=await page(390,false);await pg.goto(URL0+'#/tools');await pg.waitForTimeout(700);
  await pg.evaluate(()=>followListOpen('me1','followers',{name:'わたし'}));await pg.waitForTimeout(700);
  await pg.click('#flm [data-fl-fb=bob]');await pg.waitForTimeout(500);
  ok(await pg.evaluate(()=>location.hash==='#/account'&&document.getElementById('flm').hidden)&&!pg.calls.some(c=>/POST/.test(c)),'ログインしていなければアカウントへ');
  ok(!pg.errs.length,'エラー '+pg.errs);await pg.close()}
await b.close();
console.log(bad?`follows: ${bad}/${n} 項目が失敗`:`follows: OK（${n}項目）`);process.exit(bad?1:0);
