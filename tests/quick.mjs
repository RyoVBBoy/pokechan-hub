// ⚡ボタンのカスタマイズ（src/js/64-quick.js）の確認（2026/11/10）
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
let n=0,bad=0;const ok=(c,m)=>{n++;if(!c){bad++;console.error('NG',m)}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function page(W,init){
  const ctx=await b.newContext({viewport:{width:W,height:844},locale:'ja-JP',hasTouch:W<700,isMobile:W<700});
  if(init)await ctx.addInitScript(init);
  const pg=await ctx.newPage();pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));
  await pg.route(/^https?:/,r=>r.abort());return pg}
const N=(pg,s)=>pg.evaluate(s=>P.find(x=>x.n===s).no,s);
/* パーティを3枠ぶん用意する（数＝それぞれの匹数） */
const setTeams=(pg,counts)=>pg.evaluate(counts=>{const pool=['ガブリアス','サーフゴー','アシレーヌ','カイリュー','ドドゲザン','ウルガモス'].map(s=>P.find(x=>x.n===s).no);
  TEAMS.list.forEach((s,i)=>{s.team=pool.slice(0,counts[i]).map(no=>({no}));s.name=''});TEAMS.cur=0;team=TEAMS.list[0].team.map(x=>({...x}));saveTeam();
  return JSON.stringify(TEAMS.list)},counts);

/* 1. はじめ（保存なし）：相性を調べる。⚡で相性の画面が開く */
{const pg=await page(390);await pg.goto(URL0+'#/tools');await pg.waitForTimeout(700);
  const r=await pg.evaluate(()=>[qaGet(),localStorage.getItem('pcquick'),document.getElementById('fab').querySelector('.fl').textContent]);
  ok(r[0]==='type-check'&&r[1]===null&&r[2]==='相性','はじめは相性を調べる '+r);
  await pg.click('#fab');await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>!document.getElementById('sheet').hidden&&document.getElementById('sheet-t').textContent==='相性を調べる'),'⚡で相性の画面が開かない');
  await pg.keyboard.press('Escape');
  /* 2. ⚙ から切りかえ：3つ・44px以上・画面の中・✓・すぐ保存・再読み込みしても残る */
  await pg.evaluate(()=>{if(typeof closeSheet==='function')closeSheet();location.hash='#/tools'});await pg.waitForTimeout(400);
  await pg.click('#fabwrap .qa-more');await pg.waitForTimeout(200);
  const m=await pg.evaluate(()=>{const m=document.getElementById('qa-menu'),r=m.getBoundingClientRect(),it=[...m.querySelectorAll('[data-qa]')];
    return {n:it.length,h:Math.min(...it.map(x=>x.getBoundingClientRect().height)),in:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,ck:it.filter(x=>x.getAttribute('aria-checked')==='true').map(x=>x.dataset.qa),over:document.body.scrollWidth<=innerWidth,gear:document.querySelector('#fabwrap .qa-more').getBoundingClientRect()}});
  ok(m.n===3&&m.h>=44&&m.in&&m.ck.join()==='type-check'&&m.over,'スマホの設定メニュー '+JSON.stringify(m));
  /* ▾は⚡と一体（⚡のふちに重なる・独立した ⚙ はない）。⚡の大きさは今までどおり */
  const f=await pg.evaluate(()=>{const a=document.getElementById('fab').getBoundingClientRect(),g=document.querySelector('#fabwrap .qa-more').getBoundingClientRect();
    return {gear:document.querySelectorAll('.qa-gear').length,w:a.width,h:a.height,over:g.left<a.right&&g.right>a.left&&g.top<a.bottom&&g.bottom>a.top,in:g.right<=innerWidth}});
  ok(f.gear===0&&f.w===58&&f.h===64&&f.over&&f.in,'⚡と一体の▾ '+JSON.stringify(f));
  /* 開いただけでは設定は変わらない。外を押す・Esc で閉じる */
  ok(await pg.evaluate(()=>localStorage.getItem('pcquick')===null),'開いただけで設定が変わった');
  await pg.mouse.click(30,200);await pg.waitForTimeout(150);
  ok(await pg.evaluate(()=>!document.getElementById('qa-menu')),'外を押しても閉じない');
  await pg.click('#fabwrap .qa-more');await pg.waitForTimeout(150);await pg.keyboard.press('Escape');await pg.waitForTimeout(100);
  ok(await pg.evaluate(()=>!document.getElementById('qa-menu')&&localStorage.getItem('pcquick')===null),'Esc で閉じない');
  /* 長押し（0.5秒）でも開き、そのあとの「押した」では実行しない */
  const fb=await pg.$('#fab');const bx=await fb.boundingBox();
  await pg.mouse.move(bx.x+20,bx.y+30);await pg.mouse.down();await pg.waitForTimeout(650);await pg.mouse.up();await pg.waitForTimeout(150);
  ok(await pg.evaluate(()=>!!document.getElementById('qa-menu')&&document.getElementById('sheet').hidden),'長押しでメニューが開かない／相性の画面が開いた');
  /* 選ぶ＝保存して、その機能をすぐ実行（パーティ新規作成＝空き枠へ） */
  await pg.click('#qa-menu [data-qa="party-create"]');await pg.waitForTimeout(700);
  const s=await pg.evaluate(()=>[localStorage.getItem('pcquick'),!document.getElementById('qa-menu'),document.getElementById('fab').querySelector('.fl').textContent,document.getElementById('fab').getAttribute('aria-label'),location.hash,!!document.querySelector('.mpsheet')]);
  ok(s[0]==='party-create'&&s[1]&&s[2]==='パーティ'&&s[3]==='パーティ新規作成'&&s[4]==='#/team'&&s[5],'選ぶと保存して実行 '+s);
  await pg.evaluate(()=>{document.querySelectorAll('.mpsheet').forEach(e=>e.remove());location.hash='#/tools'});await pg.waitForTimeout(300);
  await pg.reload();await pg.waitForTimeout(700);
  ok(await pg.evaluate(()=>qaGet()==='party-create'&&document.getElementById('fab').querySelector('.fl').textContent==='パーティ'),'再読み込みで設定が残らない');
  await pg.click('#fabwrap .qa-more');await pg.waitForTimeout(150);
  ok(await pg.evaluate(()=>document.querySelector('#qa-menu [aria-checked=true]').dataset.qa==='party-create'),'✓が今の設定に付かない');
  await pg.click('#qa-menu [data-qa="type-check"]');await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>localStorage.getItem('pcquick')==='type-check'&&!document.getElementById('sheet').hidden),'相性に戻して実行できない');
  ok(!pg.errs.length,'エラー '+pg.errs);await pg.close()}

/* 3. おかしな値・localStorage が使えない：相性を調べる に戻り、エラーにならない */
{const pg=await page(390,()=>{try{localStorage.setItem('pcquick','xxx')}catch(e){}});await pg.goto(URL0+'#/tools');await pg.waitForTimeout(600);
  ok(await pg.evaluate(()=>qaGet()==='type-check'),'おかしな値で相性に戻らない');ok(!pg.errs.length,'おかしな値でエラー '+pg.errs);await pg.close()}
{const pg=await page(390,()=>{const g=Storage.prototype.getItem,s=Storage.prototype.setItem;Storage.prototype.getItem=function(k){if(k==='pcquick')throw new Error('blocked');return g.call(this,k)};Storage.prototype.setItem=function(k,v){if(k==='pcquick')throw new Error('blocked');return s.call(this,k,v)}});
  await pg.goto(URL0+'#/tools');await pg.waitForTimeout(600);
  const r=await pg.evaluate(()=>{qaSet('party-create');return qaGet()});
  ok(r==='type-check'&&!pg.errs.length,'localStorage が使えないとき '+r+' '+pg.errs);await pg.close()}

/* 4. パーティ新規作成：空いている枠へ（1枠・2枠空き）、3枠とも埋まっていれば上書きせずお知らせだけ */
{const pg=await page(390,()=>{try{localStorage.setItem('pcquick','party-create')}catch(e){}});await pg.goto(URL0+'#/tools');await pg.waitForTimeout(700);
  for(const [counts,want] of [[[6,0,0],1],[[6,4,0],2],[[0,3,6],0],[[3,0,5],1]]){
    await pg.evaluate(()=>{document.querySelectorAll('.mpsheet').forEach(e=>e.remove());location.hash='#/tools'});await pg.waitForTimeout(300);
    const before=await setTeams(pg,counts);
    await pg.click('#fab');await pg.waitForTimeout(700);
    const r=await pg.evaluate(()=>({cur:TEAMS.cur,hash:location.hash,pick:!!document.querySelector('.mpsheet'),list:JSON.stringify(TEAMS.list.map(s=>s.team.map(x=>x.no)))}));
    const bl=JSON.stringify(JSON.parse(before).map(s=>s.team.map(x=>x.no)));
    ok(r.cur===want&&r.hash==='#/team'&&r.pick&&r.list===bl,`空き枠 ${counts}→${want}：`+JSON.stringify(r));
  }
  await pg.evaluate(()=>{document.querySelectorAll('.mpsheet').forEach(e=>e.remove());location.hash='#/tools'});await pg.waitForTimeout(300);
  const before=await setTeams(pg,[6,5,1]);
  await pg.click('#fab');await pg.waitForTimeout(500);
  const r=await pg.evaluate(()=>({cur:TEAMS.cur,hash:location.hash,toast:document.getElementById('toast').textContent,on:document.getElementById('toast').classList.contains('on'),pick:!!document.querySelector('.mpsheet'),list:JSON.stringify(TEAMS.list),saved:localStorage.getItem('pcteams')}));
  ok(r.cur===0&&r.hash==='#/tools'&&r.toast==='空いている枠がありません'&&r.on&&!r.pick&&r.list===before&&JSON.stringify(JSON.parse(r.saved).list)===before,'3枠とも埋まっているとき '+JSON.stringify({...r,list:0,saved:0}));
  /* 5. 書きかけの投稿：キャンセル＝そのまま（文・画面・設定）、移動する＝開く、空なら確認なし */
  await pg.evaluate(()=>{const t=document.createElement('textarea');t.id='twc-t';t.value='書きかけの文';document.getElementById('view').appendChild(t)});
  await setTeams(pg,[6,0,0]);
  await pg.click('#fab');await pg.waitForTimeout(300);
  const c=await pg.evaluate(()=>{const d=document.querySelector('.xc');return d&&d.querySelector('#xc-t').textContent});
  ok(c==='この画面を離れると、書きかけの投稿が消えます。移動しますか？','書きかけの確認が出ない '+c);
  await pg.click('.xc .xc-no');await pg.waitForTimeout(300);
  const k=await pg.evaluate(()=>[location.hash,document.getElementById('twc-t').value,TEAMS.cur,localStorage.getItem('pcquick'),!!document.querySelector('.mpsheet')]);
  ok(k[0]==='#/tools'&&k[1]==='書きかけの文'&&k[2]===0&&k[3]==='party-create'&&!k[4],'キャンセルで何も変わらない '+k);
  await pg.click('#fab');await pg.waitForTimeout(300);await pg.click('.xc .xc-ok');await pg.waitForTimeout(700);
  ok(await pg.evaluate(()=>location.hash==='#/team'&&TEAMS.cur===1&&!!document.querySelector('.mpsheet')),'移動するで開かない');
  await pg.evaluate(()=>{document.querySelectorAll('.mpsheet').forEach(e=>e.remove());location.hash='#/tools'});await pg.waitForTimeout(300);
  await setTeams(pg,[6,0,0]);
  await pg.evaluate(()=>{const t=document.createElement('textarea');t.id='twc-t';t.value='   ';document.getElementById('view').appendChild(t)});
  await pg.click('#fab');await pg.waitForTimeout(600);
  ok(await pg.evaluate(()=>!document.querySelector('.xc')&&location.hash==='#/team'),'空の投稿欄で確認が出た');
  /* メニューから選んだときも、書きかけがあれば先に確認。キャンセル＝保存も実行もしない、移動する＝保存して実行 */
  await pg.evaluate(()=>{document.querySelectorAll('.mpsheet').forEach(e=>e.remove());localStorage.setItem('pcquick','type-check');qaPaint();location.hash='#/tools'});await pg.waitForTimeout(300);
  await setTeams(pg,[6,0,0]);
  await pg.evaluate(()=>{const t=document.createElement('textarea');t.id='twc-t';t.value='書きかけ';document.getElementById('view').appendChild(t)});
  await pg.click('#fabwrap .qa-more');await pg.waitForTimeout(150);
  const mi=await pg.evaluate(()=>[...document.querySelectorAll('#qa-menu [data-qa]')].map(b=>[b.dataset.qa,!!b.querySelector('.qa-ic svg'),b.querySelector('.qa-tx small').textContent.length>0,getComputedStyle(b.querySelector('.qa-ck')).visibility]));
  ok(mi.length===3&&mi.every(x=>x[1]&&x[2])&&mi.filter(x=>x[3]==='visible').map(x=>x[0]).join()==='type-check','メニューのアイコン・説明・✓ '+JSON.stringify(mi));
  await pg.click('#qa-menu [data-qa="party-create"]');await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>!!document.querySelector('.xc')),'メニューから選んだとき書きかけの確認が出ない');
  await pg.click('.xc .xc-no');await pg.waitForTimeout(300);
  const mc=await pg.evaluate(()=>[localStorage.getItem('pcquick'),location.hash,TEAMS.cur,document.getElementById('twc-t').value,document.getElementById('fab').querySelector('.fl').textContent]);
  ok(mc[0]==='type-check'&&mc[1]==='#/tools'&&mc[2]===0&&mc[3]==='書きかけ'&&mc[4]==='相性','キャンセルで設定・画面が変わった '+mc);
  await pg.click('#fabwrap .qa-more');await pg.waitForTimeout(150);await pg.click('#qa-menu [data-qa="party-create"]');await pg.waitForTimeout(300);
  await pg.click('.xc .xc-ok');await pg.waitForTimeout(700);
  ok(await pg.evaluate(()=>localStorage.getItem('pcquick')==='party-create'&&location.hash==='#/team'&&TEAMS.cur===1&&!!document.querySelector('.mpsheet')),'移動するで保存・実行されない');
  ok(!pg.errs.length,'エラー '+pg.errs);await pg.close()}

/* 6. 新規投稿：ログインしていなければ、今までの投稿ボタンと同じくアカウントの画面へ。書きかけがあれば確認 */
{const pg=await page(390,()=>{try{localStorage.setItem('pcquick','community-post')}catch(e){}});await pg.goto(URL0+'#/tools');await pg.waitForTimeout(700);
  ok(await pg.evaluate(()=>document.getElementById('fab').querySelector('.fl').textContent==='投稿'),'新規投稿の名前');
  await pg.evaluate(()=>{const t=document.createElement('textarea');t.id='twc-t';t.value='下書き';document.getElementById('view').appendChild(t)});
  await pg.click('#fab');await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>!!document.querySelector('.xc')),'新規投稿で書きかけの確認が出ない');
  await pg.click('.xc .xc-ok');await pg.waitForTimeout(500);
  const r=await pg.evaluate(()=>[location.hash,document.getElementById('toast').textContent]);
  ok(r[0]==='#/account'&&r[1]==='投稿するにはログインしてください','ログインしていないときの新規投稿 '+r);
  /* 7. ホーム・タイムラインの右下は設定に関係なく投稿（⚙ も出さない） */
  for(const h of ['#/','#/tl']){await pg.evaluate(h=>{localStorage.setItem('pcquick','party-create');location.hash=h},h);await pg.waitForTimeout(700);
    const before=await pg.evaluate(()=>JSON.stringify(TEAMS));
    const s=await pg.evaluate(()=>[document.getElementById('fab').dataset.mode,document.getElementById('fab').getAttribute('aria-label'),document.querySelector('#fabwrap .qa-more').hidden]);
    await pg.click('#fab');await pg.waitForTimeout(500);
    const a=await pg.evaluate(()=>[location.hash,document.getElementById('toast').textContent,JSON.stringify(TEAMS)]);
    ok(s[0]==='post'&&s[1]==='投稿する'&&s[2]&&a[0]==='#/account'&&a[1]==='投稿するにはログインしてください'&&a[2]===before,`${h} の右下は投稿のまま `+s+' '+a.slice(0,2));}
  ok(!pg.errs.length,'エラー '+pg.errs);await pg.close()}

/* 8. PC：押す前に「⚡ 機能名」、⚙ から切りかえ、メニューは画面の中、1280px以上は文字も変わる */
for(const W of [1000,1280]){const pg=await page(W);await pg.goto(URL0+'#/dex');await pg.waitForTimeout(700);
  const a=await pg.evaluate(()=>{const p=document.getElementById('pc-post'),g=document.querySelector('.qa-more-pc');return [p.title,g&&g.getBoundingClientRect().width>0]});
  ok(a[0]==='⚡ 相性を調べる'&&a[1],W+'：PC の⚡の名前と▾ '+a);
  const z=await pg.evaluate(W=>{const p=document.getElementById('pc-post').getBoundingClientRect(),g=document.querySelector('.qa-more-pc').getBoundingClientRect(),nav=document.querySelector('.tabbar').getBoundingClientRect();
    return {gear:document.querySelectorAll('.qa-gear').length,w:Math.round(p.width),h:Math.round(p.height),over:g.left<p.right&&g.right>p.left&&g.top<p.bottom&&g.bottom>p.top,inNav:g.right<=nav.right+1}},W);
  ok(z.gear===0&&z.h===52&&(W>=1280||z.w===52)&&z.over&&z.inNav,W+'：PC の⚡と一体の▾ '+JSON.stringify(z));
  /* 右クリックでも開き、開いただけでは変わらない */
  await pg.click('#pc-post',{button:'right'});await pg.waitForTimeout(200);
  ok(await pg.evaluate(()=>!!document.getElementById('qa-menu')&&localStorage.getItem('pcquick')===null&&document.getElementById('sheet').hidden),W+'：右クリックで開かない');
  await pg.keyboard.press('Escape');await pg.waitForTimeout(100);
  await pg.hover('#pc-post');await pg.click('.qa-more-pc');await pg.waitForTimeout(200);
  const m=await pg.evaluate(()=>{const m=document.getElementById('qa-menu'),r=m.getBoundingClientRect();return [m.querySelectorAll('[data-qa]').length,r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,Math.min(...[...m.querySelectorAll('[data-qa]')].map(x=>x.getBoundingClientRect().height))]});
  ok(m[0]===3&&m[1]&&m[2]>=44,W+'：PC の設定メニュー '+m);
  await pg.click('#qa-menu [data-qa="community-post"]');await pg.waitForTimeout(500);
  const t=await pg.evaluate(W=>{const p=document.getElementById('pc-post');return [p.title,p.getAttribute('aria-label'),W<1280||p.querySelector('span').textContent==='新規投稿',location.hash]},W);
  ok(t[0]==='⚡ 新規投稿'&&t[1]==='新規投稿'&&t[2]&&t[3]==='#/account',W+'：PC で選ぶと保存して実行（未ログインはアカウントへ） '+t);
  /* 元の相性の画面は右の列・ツールから今までどおり開ける */
  ok(await pg.evaluate(()=>typeof openSheet==='function'),'相性の画面');
  ok(!pg.errs.length,W+'：エラー '+pg.errs);await pg.close()}
await b.close();
console.log(bad?`quick: ${bad}/${n} 項目が失敗`:`quick: OK（${n}項目）`);process.exit(bad?1:0);
