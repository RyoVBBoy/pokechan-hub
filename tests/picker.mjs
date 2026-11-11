// ポケモンを選ぶ画面（11-matchup.js の pickMon）：スマホでキーボードを出したとき、後ろのパーティの画面が透けて見えない（2026/11/11 依頼主の iPhone の画面）
// iPhone のキーボードは Playwright では出せないので、キーボードが出たときと同じく画面の高さを縮め（visualViewport に合わせた高さ）、その下に何が見えるかを調べる
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
let n=0,bad=0;const ok=(c,m)=>{n++;if(!c){bad++;console.error('NG',m)}};
for(const th of ['dark','light']){
  const ctx=await b.newContext({viewport:{width:390,height:844},locale:'ja-JP',hasTouch:true,isMobile:true});
  await ctx.addInitScript(t=>{try{localStorage.setItem('pctheme',t)}catch(e){}},th);
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(/^https?:/,r=>r.abort());
  await pg.goto(URL0+'#/team');await pg.waitForTimeout(500);
  await pg.evaluate(()=>{window.__pick=pickMon(0,{add:true})});await pg.waitForSelector('.mpsheet.on');await pg.waitForTimeout(300);
  /* キーボードが出たとき：上から440pxだけが見える高さ */
  await pg.evaluate(()=>{const o=document.querySelector('.mpsheet');o.style.top='0px';o.style.height='440px'});await pg.waitForTimeout(250);
  const r=await pg.evaluate(()=>{
    const o=document.querySelector('.mpsheet'),pane=o.querySelector('.psheet-p');
    /* 縮めた画面の下（キーボードの後ろ）を何がふさいでいるか（ふさぐ部分は押しても反応しない作りなので、調べる間だけ当たるようにする） */
    const st=document.createElement('style');st.textContent='.mpsheet.mpfull::after{pointer-events:auto!important}';document.head.appendChild(st);
    const below=[600,700,840].map(y=>{const e=document.elementFromPoint(195,y);return !!(e&&(e===o||o.contains(e)))});st.remove();
    const af=getComputedStyle(o,'::after'),bg=getComputedStyle(document.body).getPropertyValue('--bg').trim();
    const op=x=>{const m=x.match(/rgba?\(([^)]+)\)/);if(!m)return 1;const v=m[1].split(',');return v.length>3?+v[3]:1};
    return {below,afBg:af.backgroundColor,afOp:af.opacity,afH:parseFloat(af.height),paneBg:getComputedStyle(pane).backgroundColor,bg,
      listShown:!!document.querySelector('#mp-list .mp-r'),inputBottom:Math.round(document.getElementById('mp-q').getBoundingClientRect().bottom),
      opaque:op(af.backgroundColor)===1&&op(getComputedStyle(pane).backgroundColor)===1}});
  ok(r.below.every(Boolean),th+'：キーボードの後ろも選ぶ画面がふさいでいる '+r.below);
  ok(r.opaque&&r.afOp==='1'&&r.afH>=800,th+'：下地は透けない色 '+JSON.stringify(r));
  ok(r.listShown&&r.inputBottom<440,th+'：検索欄と一覧は見える所にある');
  if(th==='dark')await pg.screenshot({path:path.join(ROOT,'out','picker-kb.png')}).catch(()=>{});
  /* 選ぶと閉じて、ふさいでいたものも消える */
  await pg.click('#mp-list .mp-r');await pg.waitForTimeout(400);
  ok(await pg.evaluate(async()=>!document.querySelector('.mpsheet')&&!!(await window.__pick)),th+'：選ぶと閉じる');
  ok(!errs.length,th+'：エラー '+errs);await ctx.close();
}
await b.close();
console.log(bad?`picker: NG ${bad}/${n}`:`picker: OK（${n}項目）`);process.exit(bad?1:0);
