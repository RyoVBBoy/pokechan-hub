// ダメージ計算の ⇅（攻守の入れかえ）の確認（21-calc.js の calcSwap、2026/11/11）
// ①⇅ が180度ずつ回る ②上下の段が0.3秒ですれ違う（途中は動いている・終われば元の位置）③中身も入れかわる（2匹の育成・残りHP・状態異常）
// ④もう一度押すと元どおり ⑤入れかえた結果は、はじめからその並びで計算したものと同じ
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
let n=0,bad=0;const ok=(c,m)=>{n++;if(!c){bad++;console.error('NG',m)}};
for(const W of [390,1280]){
  const ctx=await b.newContext({viewport:{width:W,height:W<700?844:900},locale:'ja-JP',hasTouch:W<700,isMobile:W<700});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(/^https?:/,r=>r.abort());
  await pg.goto(URL0+'#/calc');await pg.waitForSelector('#c-swap');await pg.waitForTimeout(300);
  /* 攻撃側を育てて条件を付ける（片方だけの値にして、入れかわったか分かるように） */
  const before=await pg.evaluate(()=>{CS.a.item=CS.a.item||'lifeorb';CS.a.sp=[2,32,0,0,0,32];CS.aHP=70;CS.dHP=40;CS.burn=true;CS.dSt='par';
    const s=JSON.stringify;return {a:s(CS.a),d:s(CS.d),an:CS.a.no,dn:CS.d.no}});
  await pg.evaluate(()=>route());await pg.waitForSelector('#c-swap');await pg.waitForTimeout(200);
  const lab0=await pg.$$eval('.cv-vs .cv-side .mfield, .cv-vs .cv-side button',e=>e.map(x=>x.textContent.trim()).slice(0,2));
  await pg.click('#c-swap');
  /* 途中（0.12秒）：上下の段が動いている・⇅ が回っている */
  await pg.waitForTimeout(120);
  const mid=await pg.evaluate(()=>{const s=[...document.querySelectorAll('.cv-vs .cv-side')];const t=x=>new DOMMatrix(getComputedStyle(x).transform).m42;
    return {t0:t(s[0]),t1:t(s[1]),w:s.map(x=>Math.round(x.getBoundingClientRect().width)),bw:Math.round(s[0].parentElement.getBoundingClientRect().width),rot:getComputedStyle(document.querySelector('.cv-swi')).transform}});
  ok(mid.t0>2&&mid.t1<-2&&mid.w.every(w=>w>mid.bw*0.6),W+'：途中で上の段は下から・下の段は上から動いている '+JSON.stringify(mid));
  await pg.waitForTimeout(400);
  const end=await pg.evaluate(()=>{const s=[...document.querySelectorAll('.cv-vs .cv-side')];const t=x=>getComputedStyle(x).transform;
    const r=new DOMMatrix(getComputedStyle(document.querySelector('.cv-swi')).transform);
    return {t:s.map(t),ang:Math.round(Math.atan2(r.b,r.a)*180/Math.PI),rot:CALC_ROT,anim:!!document.querySelector('.cv-anim'),
      a:JSON.stringify(CS.a),d:JSON.stringify(CS.d),aHP:CS.aHP,dHP:CS.dHP,burn:CS.burn,dSt:CS.dSt,aSt:CS.aSt}});
  ok(end.t.every(x=>x==='none'||x==='matrix(1, 0, 0, 1, 0, 0)')&&!end.anim,W+'：0.3秒で元の位置に止まる '+end.t);
  ok(end.rot===180&&Math.abs(Math.abs(end.ang)-180)<=1,W+'：⇅ が180度回る '+end.rot+' '+end.ang);
  ok(end.a===before.d&&end.d===before.a,W+'：2匹の育成が入れかわる');
  ok(end.aHP===40&&end.dHP===70,W+'：残りHPが入れかわる '+end.aHP+'/'+end.dHP);
  ok(end.burn===false&&end.dSt==='brn'&&end.aSt==='par',W+'：状態異常が入れかわる（やけど→受ける側、まひは覚えておく） '+[end.burn,end.dSt,end.aSt]);
  const lab1=await pg.$$eval('.cv-vs .cv-side .mfield, .cv-vs .cv-side button',e=>e.map(x=>x.textContent.trim()).slice(0,2));
  ok(lab1[0]===lab0[1]&&lab1[1]===lab0[0],W+'：画面の上下の名前が入れかわる '+lab0+' → '+lab1);
  /* 入れかえた結果＝はじめからその並びの計算 */
  const same=await pg.evaluate(()=>{const R=calcResult();const r1=JSON.stringify(R&&R.r);
    const keep=JSON.stringify(CS);CS=JSON.parse(keep);const r2=JSON.stringify(calcResult().r);return [r1,r2,document.querySelector('.cres-big')?.textContent]});
  ok(same[0]===same[1]&&same[0]!=='null',W+'：入れかえ後の計算が正しい '+same);
  /* もう一度押すと元どおり（⇅ はさらに180度＝360度） */
  await pg.click('#c-swap');await pg.waitForTimeout(450);
  const back=await pg.evaluate(()=>({a:JSON.stringify(CS.a),d:JSON.stringify(CS.d),aHP:CS.aHP,dHP:CS.dHP,burn:CS.burn,dSt:CS.dSt,rot:CALC_ROT}));
  ok(back.a===before.a&&back.d===before.d&&back.aHP===70&&back.dHP===40&&back.burn===true&&back.dSt==='par'&&back.rot===360,W+'：2回押すと元どおり '+JSON.stringify({...back,a:0,d:0}));
  /* 速く2回押しても崩れない */
  await pg.click('#c-swap');await pg.waitForTimeout(60);await pg.click('#c-swap');await pg.waitForTimeout(500);
  ok(await pg.evaluate(b=>JSON.stringify(CS.a)===b&&![...document.querySelectorAll('.cv-vs .cv-side')].some(x=>x.style.transform||x.classList.contains('cv-swm')),before.a),W+'：続けて押しても崩れない');
  /* 動きを減らす設定ではすぐ入れかわる */
  await pg.emulateMedia({reducedMotion:'reduce'});await pg.click('#c-swap');await pg.waitForTimeout(30);
  ok(await pg.evaluate(()=>!document.querySelector('.cv-anim')&&CS.a.no!==undefined),W+'：動きを減らす設定');
  if(W===390)await pg.screenshot({path:path.join(ROOT,'out','calcswap.png')}).catch(()=>{});
  ok(!errs.length,W+'：エラー '+errs);await ctx.close();
}
await b.close();
console.log(bad?`calcswap: NG ${bad}/${n}`:`calcswap: OK（${n}項目）`);process.exit(bad?1:0);
