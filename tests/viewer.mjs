// 画像を大きく見る画面（32-timeline.js の twViewer、2026/11/19 依頼主）
//  ①PC：画像が画面に収まる（上下64px・左右80px を空け、矢印・✕・枚数と重ならない）。縦長・横長・正方形のどれも
//  ②前後の矢印が丸のまん中（文字ではなく描いた印）・丸は画面の上下のまん中
//  ③スマホも縦長の画像が画面からはみ出さない・2回たたくと拡大できる（前と同じ）
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
let n=0,bad=0;const ok=(c,m,i)=>{n++;if(!c){bad++;console.error('NG',m,i===undefined?'':JSON.stringify(i))}};
const SZ={wide:[4000,1500],tall:[1200,3000],sq:[2400,1800],tiny:[200,120]};
const svg=([w,h])=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#36a"/></svg>`;
for(const [W,H] of [[1024,768],[1280,800],[1920,1080],[390,844]]){
  const pc=W>=700;
  const ctx=await b.newContext({viewport:{width:W,height:H},locale:'ja-JP',isMobile:!pc,hasTouch:!pc});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(/^https?:/,r=>{const u=new URL(r.request().url());const k=u.pathname.replace(/^\/m\//,'');if(SZ[k])return r.fulfill({status:200,contentType:'image/svg+xml',body:svg(SZ[k])});return r.abort()});
  await pg.goto(URL0+'#/tools');await pg.waitForTimeout(700);
  const keys=['wide','tall','sq','tiny'];
  for(let i=0;i<keys.length;i++){
    await pg.evaluate(i=>{document.querySelectorAll('.tw-view').forEach(x=>x.remove());twViewer(['wide','tall','sq','tiny'],i)},i);await pg.waitForTimeout(450);
    const r=await pg.evaluate(()=>{const R=[...document.querySelectorAll('.tw-vs img')].map(x=>x.getBoundingClientRect()).find(q=>q.left>-2&&q.left<innerWidth);return{l:Math.round(R.left),t:Math.round(R.top),r:Math.round(R.right),b:Math.round(R.bottom),w:Math.round(R.width),h:Math.round(R.height)}});
    const [iw,ih]=SZ[keys[i]];
    const inside=pc?r.l>=79&&r.t>=63&&r.r<=W-79&&r.b<=H-63:r.l>=-1&&r.t>=-1&&r.r<=W+1&&r.b<=H+1;
    ok(inside,`${W}：${keys[i]} の画像が画面に収まる${pc?'（矢印・✕・枚数の場所を空ける）':''}`,r);
    ok(Math.abs(r.w/r.h-iw/ih)<0.02,`${W}：${keys[i]} の縦横の比は変えない`,[r.w/r.h,iw/ih]);
    if(keys[i]==='tiny')ok(r.w<=iw+1,`${W}：小さい画像は引きのばさない`,r);
  }
  if(pc){
    const a=await pg.evaluate(()=>[...document.querySelectorAll('.tw-vp,.tw-vn')].map(x=>{const B=x.getBoundingClientRect(),G=x.querySelector('svg path').getBoundingClientRect();
      return{bx:B.left+B.width/2,by:B.top+B.height/2,gx:G.left+G.width/2,gy:G.top+G.height/2,txt:x.textContent.trim(),label:x.getAttribute('aria-label')}}));
    ok(a.length===2&&a.every(x=>!x.txt&&x.label),W+'：前後の矢印は文字ではなく印（読み上げの名前あり）',a);
    ok(a.every(x=>Math.abs(x.gx-x.bx)<=1.6&&Math.abs(x.gy-x.by)<=0.6),W+'：矢印の印が丸のまん中',a.map(x=>[x.gx-x.bx,x.gy-x.by]));
    ok(a.every(x=>Math.abs(x.by-H/2)<=1),W+'：丸は画面の上下のまん中',a.map(x=>x.by));
    /* 前後の切りかえは前と同じ（›で次の画像へ） */
    await pg.evaluate(()=>{document.querySelectorAll('.tw-view').forEach(x=>x.remove());twViewer(['wide','tall','sq','tiny'],0)});await pg.waitForTimeout(450);
    const c0=await pg.evaluate(()=>document.querySelector('.tw-vc').textContent.trim());await pg.click('.tw-vn');await pg.waitForTimeout(600);
    const c1=await pg.evaluate(()=>document.querySelector('.tw-vc').textContent.trim());ok(c0==='1 / 4'&&c1==='2 / 4',W+'：› で次の画像へ',[c0,c1]);
  }
  /* 拡大（2回たたく・ダブルクリック）は前と同じ */
  await pg.evaluate(()=>{document.querySelectorAll('.tw-view').forEach(x=>x.remove());twViewer(['sq'],0)});await pg.waitForTimeout(450);
  const im=await pg.$('.tw-vs img');const bb=await im.boundingBox();
  await pg.mouse.dblclick(bb.x+bb.width/2,bb.y+bb.height/2);await pg.waitForTimeout(450);
  ok(await pg.evaluate(()=>document.querySelector('.tw-view').classList.contains('tw-vzoom')||/scale\((?!1\))/.test(document.querySelector('.tw-vs img').style.transform)),W+'：ダブルクリック・2回たたくと拡大できる（前と同じ）');
  ok(!errs.length,W+'：エラーなし',errs);await ctx.close();
}
await b.close();
console.log(bad?`viewer: NG（${bad}件）`:`viewer: OK（${n}項目）`);if(bad)process.exitCode=1;
