// 左上のゲームの切り替え（2026/11/19、27-games.js の gswDraw・gameSheet・readyGames・curGame）
//  ・PC：左の列のいちばん上。略称（「ポケ」）ではなくゲームの印（線の絵）と正式な名前（1280px以上・省略しない）。押すと対応しているゲームだけの一覧
//  ・スマホ：左から出るメニューのいちばん上に「いまのゲーム」。押すと下から一覧
//  ・選んだゲームを覚える（pcgames.last）・対応していないゲームは選ばれない・ゲームを足すと一覧に並び、切りかえるとメニューとホームが変わり、共通の項目はそのまま
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
let n=0,bad=0;const ok=(c,m,i)=>{n++;if(!c){bad++;console.error('NG',m,i===undefined?'':JSON.stringify(i))}};
async function page(W,H,{theme='dark',lang,init}={}){
  const ctx=await b.newContext({viewport:{width:W,height:H},locale:'ja-JP',hasTouch:W<700,isMobile:W<700});
  await ctx.addInitScript(([t,l,i])=>{try{localStorage.setItem('pctheme',t);if(l)localStorage.setItem('pclang',l);if(i)for(const [k,v] of Object.entries(i))localStorage.setItem(k,v)}catch(e){}},[theme,lang||null,init||null]);
  const pg=await ctx.newPage();pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));await pg.route(/^https?:/,r=>r.abort());
  await pg.goto(URL0+'#/tools');await pg.waitForTimeout(900);return pg}
/* ---- PC ---- */
for(const [W,H] of [[1024,800],[1280,900],[1920,1080]]){
  const pg=await page(W,H);
  const r=await pg.evaluate(()=>{const g=document.getElementById('gsw'),R=g.getBoundingClientRect(),rail=document.querySelector('.tabbar').getBoundingClientRect(),first=document.querySelector('.tabbar').firstElementChild;
    const t=g.querySelector('.gsw-t b');return{tag:g.tagName,first:first===g,txt:g.textContent,svg:!!g.querySelector('.gmark svg path'),label:g.getAttribute('aria-label'),title:g.title,pop:g.getAttribute('aria-haspopup'),
      inRail:R.left>=rail.left-1&&R.right<=rail.right+1,shown:t&&getComputedStyle(t).display!=='none'&&t.getBoundingClientRect().width>0,full:t&&t.scrollWidth<=t.clientWidth+1,w:Math.round(rail.width)}});
  ok(r.tag==='BUTTON'&&r.first&&r.svg&&!/ポケ(?!モン)|GK/.test(r.txt.replace('Game Kid/s','')),W+'：左の列のいちばん上は切り替えのボタン・略称ではなく Game Kid/s の印',r);
  ok(/ポケモンチャンピオンズ/.test(r.label)&&r.title==='ポケモンチャンピオンズ'&&r.pop==='dialog'&&r.inRail,W+'：正式な名前（読み上げ・マウスを乗せたとき）・左の列の中',r);
  ok(W>=1280?r.shown&&r.full&&/ポケモンチャンピオンズ/.test(r.txt):!r.shown,W+'：1280px以上は正式な名前を省略せずに出す（それより狭いと印だけ）',r);
  ok(r.w===(W>=1280?260:88),W+'：左の列の幅は前と同じ',r.w);
  await pg.click('#gsw');await pg.waitForTimeout(350);
  const o=await pg.evaluate(()=>{const p=document.querySelector('.gsw-o .psheet-p'),R=p.getBoundingClientRect(),bt=document.getElementById('gsw').getBoundingClientRect(),items=[...document.querySelectorAll('.gsw-o .gsw')];
    return{n:items.length,ready:readyGames().length,ids:items.map(x=>x.dataset.g),sel:items.filter(x=>x.getAttribute('aria-selected')==='true').map(x=>x.dataset.g),below:R.top>=bt.bottom-1&&R.top<=bt.bottom+20,inView:R.right<=innerWidth&&R.bottom<=innerHeight,
      exp:document.getElementById('gsw').getAttribute('aria-expanded'),focus:document.activeElement&&document.activeElement.dataset.g,bg:getComputedStyle(p).backgroundColor,body:getComputedStyle(document.body).backgroundColor}});
  ok(o.n===o.ready&&!o.ids.includes('efootball')&&o.sel.join()==='pokechamp',W+'：一覧は対応しているゲームだけ（準備中のゲームは出さない）・いまのゲームに印',o);
  ok(o.below&&o.inView&&o.exp==='true'&&o.focus==='pokechamp',W+'：ボタンのすぐ下に開く・画面の中・いまのゲームに焦点',o);
  ok(!/rgba\(.*, 0\.[0-8]\d*\)$/.test(o.bg),W+'：一覧の下地は透けない（後ろの文字と重ならない）',o.bg);
  await pg.keyboard.press('Escape');await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>!document.querySelector('.gsw-o')&&document.activeElement&&document.activeElement.id==='gsw'&&document.getElementById('gsw').getAttribute('aria-expanded')==='false'),W+'：Esc で閉じ、ボタンに焦点が戻る');
  ok(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),W+'：横にはみ出さない');
  ok(!pg.errs.length,W+'：エラーなし',pg.errs);await pg.close();
}
/* ---- スマホ：左から出るメニューのいちばん上 ---- */
for(const W of [390,430]){
  const pg=await page(W,844,{theme:'light'});
  await pg.click('#brand');await pg.waitForTimeout(500);
  const d=await pg.evaluate(()=>{const g=document.querySelector('.dr-game'),me=document.querySelector('.dr-head'),R=g.getBoundingClientRect(),p=document.querySelector('.dr-p').getBoundingClientRect();
    return{after:me.nextElementSibling===g,txt:g.textContent,svg:!!g.querySelector('.gmark svg path'),inP:R.left>=p.left&&R.right<=p.right,h:Math.round(R.height),full:g.querySelector('.gsw-t b').scrollWidth<=g.querySelector('.gsw-t b').clientWidth+1}});
  ok(d.after&&/いまのゲーム/.test(d.txt)&&/ポケモンチャンピオンズ/.test(d.txt)&&d.svg&&d.inP&&d.h>=44&&d.full,W+'：メニューのいちばん上に「いまのゲーム」と正式な名前（省略しない）・押しやすい高さ',d);
  await pg.click('.dr-game');await pg.waitForTimeout(700);
  const o=await pg.evaluate(()=>({n:document.querySelectorAll('.gsw-o .gsw').length,ready:readyGames().length,pc:document.querySelector('.gsw-o').classList.contains('gsw-pc'),bottom:Math.round(innerHeight-document.querySelector('.gsw-o .psheet-p').getBoundingClientRect().bottom),dr:DR.open}));
  ok(o.n===o.ready&&!o.pc&&o.bottom<=2&&!o.dr,W+'：押すとメニューを閉じて、下から一覧（対応しているゲームだけ）',o);
  await pg.click('.gsw-o .psheet-x');await pg.waitForTimeout(300);ok(await pg.evaluate(()=>!document.querySelector('.gsw-o')),W+'：閉じる');
  ok(!pg.errs.length,W+'：エラーなし',pg.errs);await pg.close();
}
/* ---- 覚える・対応していないゲームは選ばれない ---- */
{const pg=await page(1280,900,{init:{pcgames:JSON.stringify({last:'efootball'})}});
  ok(await pg.evaluate(()=>curGame().id==='pokechamp'&&/ポケモンチャンピオンズ/.test(document.getElementById('gsw').textContent)),'準備中のゲームが覚えてあっても、対応しているゲームを開く');
  await pg.close()}
/* ---- ゲームを足したとき（GAMES に1件）：一覧に並び、切りかえるとメニューとホームが変わり、共通の項目はそのまま・選んだゲームを覚える ---- */
{const pg=await page(1280,900);
  const r=await pg.evaluate(async()=>{
    GAMES.push({id:'testgame',name:'テストゲーム',en:'Test Game',short:'テスト',home:'#/tools',status:'ready',color:'#22aaff',desc:'テスト用',sym:'<circle cx="12" cy="12" r="7"/>',tabs:[['',I.home,'ホーム'],['tools',I.tool,'ツール']],fab:false,tools:()=>[{id:'calc',sec:'計算',href:'#/calc',ic:I.calc,t:'ダメージ計算',s:'ダメ計',d:'x'}]});
    document.getElementById('gsw').click();await new Promise(r=>setTimeout(r,300));
    const ids=[...document.querySelectorAll('.gsw-o .gsw')].map(x=>x.dataset.g);
    const pcm0=[...document.querySelectorAll('#pc-more .pcm')].map(x=>x.getAttribute('href')||x.dataset.pcm||'help').join();
    document.querySelector('.gsw-o [data-g=testgame]').click();await new Promise(r=>setTimeout(r,700));
    const tabs=[...document.querySelectorAll('#nav .tb')].map(x=>x.dataset.k).join();
    const pcm1=[...document.querySelectorAll('#pc-more .pcm')].map(x=>x.getAttribute('href')||x.dataset.pcm||'help').join();
    const out={ids,tabs,last:JSON.parse(localStorage.getItem('pcgames')).last,cur:curGame().id,btn:document.getElementById('gsw').textContent,hash:location.hash,fab:document.getElementById('pc-post').hidden,same:pcm0===pcm1,tools:toolsOf(curGame()).map(t=>t.id).join()};
    GAMES.pop();return out});
  ok(r.ids.join()==='pokechamp,testgame','足したゲームが一覧に並ぶ',r.ids);
  ok(r.last==='testgame'&&r.cur==='testgame'&&/テストゲーム/.test(r.btn)&&r.hash==='#/tools','切りかえるとそのゲームのホームへ・左上の名前が変わる・選んだゲームを覚える',r);
  ok(r.tabs===',tools,messages'&&r.fab===true&&r.tools==='calc','メニュー・ツール・右下のボタンはそのゲームのもの（メッセージは共通）',r);
  ok(r.same,'お知らせ・アカウント・設定など共通の項目はそのまま',r);
  await pg.close()}
/* ---- 英語 ---- */
{const pg=await page(1280,900,{lang:'en'});
  ok(await pg.evaluate(()=>/Pokémon Champions/.test(document.getElementById('gsw').textContent)&&/Pokémon Champions/.test(document.getElementById('gsw').getAttribute('aria-label'))),'英語では Pokémon Champions');
  await pg.close()}
await b.close();
console.log(bad?`gameswitch: NG（${bad}件）`:`gameswitch: OK（${n}項目）`);if(bad)process.exitCode=1;
