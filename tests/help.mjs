// ツールの使い方（はじめての方へのカード・#/help）と、画像を大きく見る画面の拡大（2026/11/12 依頼主）の確認
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
const SHOT=process.env.SHOT||'';
let n=0;const fail=m=>{console.error('NG',m);process.exitCode=1};const ok=(c,m)=>{n++;if(!c)fail(m)};
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
for(const W of [390,1280]){
  const ctx=await b.newContext({viewport:{width:W,height:W<700?844:900},locale:'ja-JP',hasTouch:W<700,isMobile:W<700,deviceScaleFactor:SHOT?2:1});
  await ctx.addInitScript(()=>{try{if(!sessionStorage.getItem('__i')){localStorage.setItem('pchowtotest','1');localStorage.setItem('pcstart','1')}sessionStorage.setItem('__i','1')}catch(e){}});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  const go=async h=>{await pg.evaluate(h=>{location.hash=h},h);await pg.waitForTimeout(500)};
  /* ① はじめて開いたときだけカード */
  await pg.goto(URL0+'#/calc');await pg.waitForTimeout(900);
  ok(await pg.$eval('.ht-tip',e=>e.textContent.includes('はじめての方へ')&&e.querySelectorAll('.ht-steps li').length>=2),W+'：はじめて開くと使い方のカード');
  ok(await pg.$eval('.ht-tip',e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1}),W+'：カードが画面に収まる');
  if(SHOT)await pg.screenshot({path:path.join(SHOT,'help-tip-'+W+'.png')});
  await go('#/assist');ok(await pg.$$eval('.ht-tip',a=>a.length===1&&a[0].textContent.includes('選出アシスト')),W+'：画面を移るとそのツールのカードにかわる');
  await pg.click('.ht-ok');await pg.waitForTimeout(400);
  ok(!(await pg.$('.ht-tip')),W+'：「わかった」で閉じる');
  await go('#/calc');await go('#/assist');ok(!(await pg.$('.ht-tip')),W+'：閉じたツールは次から出ない');
  await go('#/calc');ok(!!(await pg.$('.ht-tip')),W+'：閉じていないツールはまだ出る');
  await pg.click('.ht-more');await pg.waitForTimeout(500);
  ok(await pg.evaluate(()=>location.hash)==='#/help/calc'&&await pg.$eval('#view',e=>e.textContent.includes('使い方')&&e.querySelectorAll('.ht-steps li').length>=3),W+'：くわしい使い方のページ');
  ok(!(await pg.$('.ht-tip')),W+'：使い方のページにはカードを出さない');
  await go('#/calc');ok(!(await pg.$('.ht-tip')),W+'：「くわしい使い方」を押したツールも次から出ない');
  /* ② ヘルプセンターに入口・一覧 */
  ok(await pg.evaluate(()=>drawerHTML?drawerHTML().includes('#/help'):true),W+'：左のメニューのヘルプセンターに「ツールの使い方」');
  await go('#/help');
  const rows=await pg.$$eval('#view a.row[href^="#/help/"]',a=>a.length);ok(rows>=12,W+'：一覧に全部のツール '+rows);
  if(SHOT)await pg.screenshot({path:path.join(SHOT,'help-list-'+W+'.png')});
  await pg.click('#ht-reset');await pg.waitForTimeout(200);await go('#/calc');ok(!!(await pg.$('.ht-tip')),W+'：「もう一度出す」でカードがまた出る');
  /* ③ 画像を大きく見る画面の拡大 */
  await go('#/tl');
  await pg.evaluate(()=>{twViewer(['a','b'],0);const svg=c=>'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="${c}"/></svg>`);
    document.querySelectorAll('.tw-vs img').forEach((i,k)=>i.src=svg(k?'#1d9bf0':'#e5484d'))});
  await pg.waitForTimeout(400);
  const st=()=>pg.evaluate(()=>{const im=document.querySelector('.tw-vs img');const m=(im.style.transform||'').match(/translate\(([-\d.]+)px, ?([-\d.]+)px\) scale\(([\d.]+)\)/);return m?{x:+m[1],y:+m[2],s:+m[3]}:{x:0,y:0,s:1}});
  if(W<700){
    const touch=(type,pts)=>pg.evaluate(([type,pts])=>{const el=document.querySelector('.tw-vs img');const T=pts.map((p,i)=>new Touch({identifier:i+1,target:el,clientX:p[0],clientY:p[1]}));
      el.dispatchEvent(new TouchEvent(type,{touches:type==='touchend'?[]:T,changedTouches:T,targetTouches:type==='touchend'?[]:T,bubbles:true,cancelable:true}))},[type,pts]);
    /* 2本の指で広げる */
    const cy=422;await touch('touchstart',[[150,cy],[240,cy]]);
    for(let k=1;k<=6;k++){await touch('touchmove',[[150-k*15,cy],[240+k*15,cy]]);await pg.waitForTimeout(16)}
    await touch('touchend',[[60,cy],[330,cy]]);await pg.waitForTimeout(100);
    let s=await st();ok(s.s>2.5&&s.s<=4,W+'：2本の指で拡大できる '+JSON.stringify(s));
    ok(await pg.$eval('.tw-view',e=>e.classList.contains('tw-vzoom')),W+'：拡大中の印');
    /* 1本の指で動かす（端より外には動かない） */
    await touch('touchstart',[[200,400]]);for(let k=1;k<=5;k++){await touch('touchmove',[[200+k*200,400]]);await pg.waitForTimeout(16)}await touch('touchend',[[1200,400]]);await pg.waitForTimeout(100);
    const s2=await st(),lim=await pg.evaluate(s=>{const im=document.querySelector('.tw-vs img');return (im.offsetWidth*s-document.querySelector('.tw-vt').clientWidth)/2},s2.s);
    ok(s2.x>0&&Math.abs(s2.x-lim)<1.5,W+'：拡大中は1本の指で動かせて、端で止まる '+JSON.stringify(s2)+' '+lim);
    /* 拡大中は上下のスワイプで閉じない */
    await touch('touchstart',[[200,300]]);for(let k=1;k<=6;k++){await touch('touchmove',[[200,300+k*60]]);await pg.waitForTimeout(16)}await touch('touchend',[[200,660]]);await pg.waitForTimeout(400);
    ok(!!(await pg.$('.tw-view')),W+'：拡大中は下にスワイプしても閉じない');
    /* 2回たたくと元に戻る */
    await touch('touchstart',[[200,420]]);await touch('touchend',[[200,420]]);await pg.waitForTimeout(80);await touch('touchstart',[[200,420]]);await touch('touchend',[[200,420]]);await pg.waitForTimeout(350);
    s=await st();ok(s.s===1,W+'：2回たたくと元の大きさ '+JSON.stringify(s));
    await touch('touchstart',[[200,420]]);await touch('touchend',[[200,420]]);await pg.waitForTimeout(80);await touch('touchstart',[[200,420]]);await touch('touchend',[[200,420]]);await pg.waitForTimeout(350);
    s=await st();ok(Math.abs(s.s-2.5)<.01,W+'：もう一度2回たたくと2.5倍 '+JSON.stringify(s));
    if(SHOT)await pg.screenshot({path:path.join(SHOT,'help-zoom-'+W+'.png')});
    await touch('touchstart',[[200,420]]);await touch('touchend',[[200,420]]);await pg.waitForTimeout(80);await touch('touchstart',[[200,420]]);await touch('touchend',[[200,420]]);await pg.waitForTimeout(350);
    ok(!(await pg.$eval('.tw-view',e=>e.classList.contains('tw-vzoom'))),W+'：元に戻ると拡大中の印が消える');
    /* 元の大きさなら今までどおり下にスワイプで閉じる */
    await touch('touchstart',[[200,300]]);for(let k=1;k<=6;k++){await touch('touchmove',[[200,300+k*50]]);await pg.waitForTimeout(16)}await touch('touchend',[[200,600]]);await pg.waitForTimeout(450);
    ok(!(await pg.$('.tw-view')),W+'：拡大していなければ下にスワイプで閉じる');
  }else{
    const box=await pg.$eval('.tw-vs img',e=>{const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]});
    await pg.mouse.move(box[0],box[1]);for(let k=0;k<3;k++){await pg.mouse.wheel(0,-400);await pg.waitForTimeout(80)}await pg.waitForTimeout(150);
    let s=await st();ok(s.s>2,W+'：ホイールで拡大 '+JSON.stringify(s));
    await pg.mouse.down();await pg.mouse.move(box[0]+300,box[1]+5,{steps:6});await pg.mouse.up();await pg.waitForTimeout(100);
    const s2=await st();ok(s2.x>s.x,W+'：拡大中はドラッグで動かせる '+JSON.stringify([s,s2]));
    ok(!!(await pg.$('.tw-view')),W+'：ドラッグしても閉じない');
    await pg.mouse.dblclick(box[0],box[1]);await pg.waitForTimeout(350);
    s=await st();ok(s.s===1,W+'：ダブルクリックで元の大きさ '+JSON.stringify(s));
    await pg.mouse.dblclick(box[0],box[1]);await pg.waitForTimeout(350);
    s=await st();ok(Math.abs(s.s-2.5)<.01,W+'：ダブルクリックで2.5倍 '+JSON.stringify(s));
    await pg.keyboard.press('Escape');await pg.waitForTimeout(200);ok(!(await pg.$('.tw-view')),W+'：Esc で閉じる');
  }
  ok(errs.length===0,W+'：エラーなし '+errs.join('|'));
  await ctx.close();
}
await b.close();
console.log(process.exitCode?'help: NG':`help: OK（${n}項目）`);
