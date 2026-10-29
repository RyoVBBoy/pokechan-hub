// サイトの動作確認：主な画面を順に開き、エラーが出ないこと・中身が表示されることを確かめる
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const pg=await (await b.newContext({viewport:{width:390,height:844}})).newPage();
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.route(/^https?:/,r=>r.abort());   // 外部への通信はしない
const fail=m=>{console.error('NG',m);process.exitCode=1};
await pg.goto(URL0+'#/');await pg.waitForTimeout(600);
const routes=['#/','#/dex','#/p/445','#/p/10230','#/types','#/team','#/tools','#/calc','#/assist','#/meta','#/report','#/community','#/lobby','#/bbs','#/games','#/sources','#/battle','#/edit/0','#/cmp/445','#/account','#/terms','#/privacy','#/tl','#/notif','#/u/someone'];
for(const r of routes){
  await pg.evaluate(h=>{location.hash=h},r);await pg.waitForTimeout(250);
  const n=await pg.evaluate(()=>document.querySelector('main')?.innerText.trim().length||0);
  if(n<20)fail(`${r} の中身が空です`);
}
// 図鑑の「技・特性」タブ
await pg.evaluate(()=>{location.hash='#/p/445'});await pg.waitForTimeout(300);
await pg.click('#seg [data-i="4"]');await pg.waitForTimeout(200);
const mvn=await pg.$$eval('.mvr',x=>x.length);if(mvn<40)fail('覚える技の表示が少なすぎます: '+mvn);
// ダメージ計算が数字を出す
await pg.evaluate(()=>{location.hash='#/calc'});await pg.waitForTimeout(300);
const big=await pg.$eval('.cres-big',x=>x.textContent).catch(()=>'');if(!/%/.test(big))fail('ダメージ計算の結果が出ません');
// 計算エンジンの一貫性
const chk=await pg.evaluate(()=>{const a=mkMon(byNo[445],'me',{item:'garchompitez',moves:[mvObj(89)],ab:'rough-skin'});return[a.p.n,P.length,Object.keys(LSD).length,Object.keys(MD).length]});
if(chk[0]!=='メガガブリアスZ')fail('メガシンカの計算: '+chk[0]);
if(chk[1]<200||chk[2]<200||chk[3]<400)fail('データ件数が少なすぎます: '+chk.join(','));
// マイツール：☆を押すと、ホームの「すぐ使う」の先頭に出る。下のメニューに名前が出る
await pg.evaluate(()=>{location.hash='#/tools'});await pg.waitForTimeout(300);
await pg.click('[data-tpin="cmp"]');await pg.waitForTimeout(200);
if(!(await pg.$('.tgrid .ttile[href="#/cmp"]')))fail('マイツールに入りません');
await pg.evaluate(()=>{location.hash='#/'});await pg.waitForTimeout(300);
if(await pg.$eval('.tgrid .ttile',a=>a.getAttribute('href')).catch(()=>'')!=='#/cmp')fail('ホームの「すぐ使う」の先頭にマイツールが出ません');
if(!(await pg.$eval('.tb[data-k="dex"] span',s=>s.offsetWidth>10).catch(()=>false)))fail('スマホの下のメニューに名前が出ません');
await pg.evaluate(()=>{tTogglePin('cmp')});
// PC（広い画面）：左のメニュー・右の列が出て、横にはみ出さず、「相性を調べる」が開く
for(const [w,side] of [[1440,true],[1024,false]]){
  await pg.setViewportSize({width:w,height:900});await pg.evaluate(()=>{location.hash='#/dex'});await pg.waitForTimeout(300);
  const L=await pg.evaluate(()=>{const r=e=>document.querySelector(e).getBoundingClientRect();
    return{nav:r('.tabbar'),app:r('.app'),side:getComputedStyle(document.querySelector('.pcside')).display,
      over:document.documentElement.scrollWidth>innerWidth,fab:getComputedStyle(document.getElementById('fabwrap')).display}});
  if(!(L.nav.height>500&&L.nav.right<=L.app.left+1))fail(`PC(${w}px)：左のメニューの位置が正しくありません`);
  if(L.app.width>601||L.app.width<599)fail(`PC(${w}px)：本文の幅が600pxではありません: ${L.app.width}`);
  if((L.side!=='none')!==side)fail(`PC(${w}px)：右の列の表示が正しくありません`);
  if(L.over)fail(`PC(${w}px)：横にはみ出しています`);
  if(L.fab!=='none')fail(`PC(${w}px)：右下の丸いボタンが残っています`);
  await pg.click('#pc-post');await pg.waitForTimeout(400);
  if(await pg.evaluate(()=>document.getElementById('sheet').hidden))fail(`PC(${w}px)：「相性を調べる」が開きません`);
  await pg.keyboard.press('Escape');await pg.evaluate(()=>closeSheet());await pg.waitForTimeout(300);
}
await pg.setViewportSize({width:390,height:844});
const bad=errs.filter(e=>!/Failed to load resource|net::/.test(e));
if(bad.length)fail('ページのエラー: '+bad.slice(0,5).join(' / '));
await b.close();
console.log(process.exitCode?'site: NG':'site: OK',`（${routes.length}画面）`);
