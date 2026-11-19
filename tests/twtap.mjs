// 投稿のどこを押しても投稿の画面へ（32-timeline.js の twBind、2026/11/19 依頼主「X と同じに」）の確認
// 本文以外の空いた所（名前の行の右・余白・本文と操作の並びのあいだ）でも移る／リンク・ボタン・画像・操作の並び・名前・アイコンは今までどおり／
// 文字を選んでいるときは移らない／投稿の画面の大きな投稿は移らない／Ctrl・⌘＋クリックとホイールのクリックは新しいタブ
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
let n=0;const ok=(c,m,x)=>{n++;if(!c){console.error('NG',m,x===undefined?'':JSON.stringify(x).slice(0,300));process.exitCode=1}};
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
for(const W of [390,1280]){
  const ctx=await b.newContext({viewport:{width:W,height:W<700?844:900},locale:'ja-JP',hasTouch:W<700,isMobile:W<700});
  await ctx.addInitScript(()=>{try{localStorage.setItem('pcstart','1')}catch(e){}});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));await pg.route(/^https?:/,r=>r.abort());
  await pg.goto(URL0+'#/tools');await pg.waitForTimeout(600);
  /* 投稿を2つ（ふつう・画像とリンクのタグつき）と大きな投稿を、サイトの部品（twHtml・twBind）で描く */
  const setup=async()=>{await pg.keyboard.press('Escape');
    if(await pg.evaluate(()=>location.hash)!=='#/tools'){await pg.evaluate(()=>{location.hash='#/tools'});await pg.waitForTimeout(500)}
    await pg.evaluate(()=>{document.querySelectorAll('.psheet,.sheet-bg,.tw-view,#tt').forEach(e=>e.remove());
    const svg='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#888"/></svg>');
    const base={media:[],created_at:Date.now()-36e5,likes:3,replies:1,reposts:0,user:{handle:'alice',name:'アリス'}};
    const box=document.createElement('div');box.id='tt';document.getElementById('view').prepend(box);
    box.innerHTML=twHtml({...base,id:11,body:'短い本文 #タグ'})+twHtml({...base,id:12,body:'画像つき',media:[{k:'a'.repeat(32),w:400,h:300}]})+twHtml({...base,id:13,body:'大きな投稿'},true);
    box.querySelectorAll('.tw-md img').forEach(i=>i.src=svg);
    twBind(box,()=>{});window.__opened=[];window.open=(u)=>{window.__opened.push(String(u));return null};})};
  const hash=()=>pg.evaluate(()=>location.hash);
  const clickAt=async(sel,fx,fy,mods)=>{await setup();await pg.waitForTimeout(150);const r=await pg.$eval(sel,e=>{e.scrollIntoView({block:'center'});const q=e.getBoundingClientRect();return{x:q.left,y:q.top,w:q.width,h:q.height}});
    if(mods)for(const m of mods)await pg.keyboard.down(m);
    await pg.mouse.click(r.x+r.w*fx,r.y+r.h*fy);
    if(mods)for(const m of mods)await pg.keyboard.up(m);
    await pg.waitForTimeout(250);return hash()};
  /* 移る所 */
  ok(await clickAt('#tt .tw[data-id="11"] .tw-h',0.7,0.5)==='#/n/11',W+'：名前の行の空いた所（時刻と … のあいだ）を押すと投稿の画面へ');
  ok(await clickAt('#tt .tw[data-id="11"]',0.995,0.5)==='#/n/11',W+'：投稿の右の余白を押すと投稿の画面へ');
  ok(await clickAt('#tt .tw[data-id="11"] .tw-b',0.05,0.5)==='#/n/11',W+'：本文を押すと投稿の画面へ（前と同じ）');
  ok(await clickAt('#tt .tw[data-id="11"] .tw-a',0.5,-0.15)==='#/n/11',W+'：本文と下の操作の並びのあいだを押しても投稿の画面へ');
  /* 移らない所（それぞれの動き） */
  const stay=async(sel,label,fx=0.5,fy=0.5)=>{const h=await clickAt(sel,fx,fy);ok(!/^#\/n\//.test(h),W+'：'+label+'を押しても投稿の画面へは移らない',h);return h};
  ok(/^#\/u\/alice/.test(await stay('#tt .tw[data-id="11"] .tw-av','アイコン')),W+'：アイコンはプロフィールへ（前と同じ）');
  ok(/^#\/u\/alice/.test(await stay('#tt .tw[data-id="11"] .tw-who','名前')),W+'：名前はプロフィールへ（前と同じ）');
  ok(/^#\/search\//.test(await stay('#tt .tw[data-id="11"] .tw-b a','本文のタグ')),W+'：本文の #タグ は検索へ（前と同じ）');
  await stay('#tt .tw[data-id="11"] [data-more]','そのほかの操作（…）');
  await stay('#tt .tw[data-id="11"] .tw-a','下の操作の並びの空いた所',0.5,0.5);
  for(const k of ['data-reply','data-rp','data-like','data-bm']){await stay(`#tt .tw[data-id="11"] [${k}]`,'操作 '+k)}
  await stay('#tt .tw[data-id="12"] [data-mi]','画像');
  ok(await pg.evaluate(()=>!!document.querySelector('.tw-view')),W+'：画像は今までどおり大きく見る画面が開く');
  await pg.keyboard.press('Escape');await pg.waitForTimeout(200);
  /* 大きな投稿（投稿の画面）は移らない */
  ok(!/^#\/n\//.test(await clickAt('#tt .tw[data-id="13"] .tw-b',0.1,0.5)),W+'：投稿の画面の大きな投稿は押しても移らない');
  /* 文字を選んでいるときは移らない */
  await setup();await pg.evaluate(()=>{const t=document.querySelector('#tt .tw[data-id="11"] .tw-b');const r=document.createRange();r.selectNodeContents(t);getSelection().removeAllRanges();getSelection().addRange(r);
    t.dispatchEvent(new MouseEvent('click',{bubbles:true}))});await pg.waitForTimeout(200);
  ok(!/^#\/n\//.test(await hash()),W+'：文字を選んでいるときは移らない');await pg.evaluate(()=>getSelection().removeAllRanges());
  /* Ctrl・⌘＋クリック、ホイールのクリック：新しいタブ（この画面はそのまま） */
  const h0=await clickAt('#tt .tw[data-id="11"] .tw-h',0.7,0.5,[process.platform==='darwin'?'Meta':'Control']);
  ok(!/^#\/n\//.test(h0)&&(await pg.evaluate(()=>__opened)).some(u=>u.endsWith('#/n/11')),W+'：Ctrl/⌘＋クリックは新しいタブで開き、この画面は移らない',await pg.evaluate(()=>__opened));
  await setup();await pg.waitForTimeout(150);const r=await pg.$eval('#tt .tw[data-id="11"] .tw-h',e=>{const q=e.getBoundingClientRect();return{x:q.left+q.width*.7,y:q.top+q.height/2}});
  await pg.mouse.click(r.x,r.y,{button:'middle'});await pg.waitForTimeout(250);
  ok((await pg.evaluate(()=>__opened)).some(u=>u.endsWith('#/n/11'))&&!/^#\/n\//.test(await hash()),W+'：ホイールのクリックは新しいタブ');
  ok(await pg.$eval('#tt .tw[data-id="11"]',e=>getComputedStyle(e).cursor)==='pointer'&&await pg.$eval('#tt .tw[data-id="13"]',e=>getComputedStyle(e).cursor)!=='pointer',W+'：押せる投稿は指の形・大きな投稿は違う');
  ok(!errs.length,W+'：エラーなし',errs);await ctx.close();
}
await b.close();
console.log(process.exitCode?'twtap: NG':`twtap: OK（${n}項目）`);
