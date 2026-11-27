// PiP の調査ページ（#/piplab、2026/11/27）の確認
// ここで確かめるのは「ページが動き、試した結果を正しく記録して写せること」だけ。
// iPhone のホーム画面のアプリで PiP が開けるかどうかは、実機の記録でしか決められない（このテストでは決めない）。
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
let n=0;const fail=m=>{console.error('NG',m);process.exitCode=1};const ok=(c,m)=>{n++;if(!c)fail(m)};
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
for(const W of [390,1280]){
  const ctx=await b.newContext({viewport:{width:W,height:W<700?844:900},locale:'ja-JP',hasTouch:W<700,isMobile:W<700});
  await ctx.addInitScript(()=>{try{localStorage.setItem('pcstart','1')}catch(e){}});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(URL0+'#/piplab');await pg.waitForTimeout(800);
  ok(await pg.$('#pl-v')&&await pg.$$eval('[data-plm]',a=>a.length)===9,W+'：試し方のボタンが9つ');
  ok(await pg.$$eval('[data-pls]',a=>a.map(x=>x.dataset.pls).join())==='blob,mp4,mp4a,hls',W+'：動画の種類が4つ');
  ok(await pg.$eval('#pl-env',e=>/ホーム画面のアプリとして開いている/.test(e.textContent)&&/webkitSupportsPresentationMode/.test(e.textContent)),W+'：端末の情報');
  ok(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.body.scrollWidth<=innerWidth+1),W+'：横にはみ出さない');
  /* サイトが作る動画（本番と同じ作り方）が読み込める */
  await pg.waitForFunction(()=>/読み込み：|読み込めません/.test(document.getElementById('pl-srcinfo').textContent),null,{timeout:30000}).catch(()=>{});
  const info=await pg.$eval('#pl-srcinfo',e=>e.textContent);
  ok(/読み込み：/.test(info),W+'：サイトが作る動画を読み込む '+info);
  ok(await pg.evaluate(()=>!PIP.cfg.cards.includes('x')&&PIP.sig===null),W+'：本番の PiP の設定を変えない');
  /* MP4 の動画ファイル */
  await pg.click('[data-pls="mp4"]');
  await pg.waitForFunction(()=>/piplab-h264\.mp4/.test(document.getElementById('pl-srcinfo').textContent),null,{timeout:10000}).catch(()=>{});
  ok(await pg.evaluate(()=>{const v=document.getElementById('pl-v');return /piplab-h264\.mp4$/.test(v.currentSrc)&&v.readyState>=1&&Math.abs(v.duration-8)<0.6}),W+'：MP4 を読み込む（8秒）');
  /* HLS：再生できない端末ではそう書く */
  await pg.click('[data-pls="hls"]');await pg.waitForTimeout(400);
  const canHls=await pg.evaluate(()=>!!document.getElementById('pl-v').canPlayType('application/vnd.apple.mpegurl'));
  if(!canHls)ok(/HLS をそのまま再生できません/.test(await pg.$eval('#pl-srcinfo',e=>e.textContent)),W+'：HLS を再生できない端末ではそう書く');
  await pg.click('[data-pls="mp4"]');await pg.waitForTimeout(500);
  /* 試すと記録される（結果は端末しだいなので、記録の形だけ見る） */
  for(const m of ['std','wk','d0']){await pg.click(`[data-plm="${m}"]`);await pg.waitForTimeout(m==='d0'?600:400)}
  const log=await pg.evaluate(()=>PL.log.filter(x=>x.kind==='try').map(x=>({m:x.m,call:x.call,res:x.res,act:x.act,before:!!x.before})));
  ok(log.length===3&&log.every(x=>x.call&&x.res&&x.before),W+'：試した3つを記録 '+JSON.stringify(log));
  ok(log[0].act===true,W+'：押してすぐ呼んだときは「押した効果」が有効');
  await pg.click('[data-plseen="0"]');
  ok(await pg.evaluate(()=>PL.log.filter(x=>x.kind==='try').pop().seen===false),W+'：「出なかった」を最後の試しに記録');
  /* ホーム画面のアプリで報告どおりの動き（WebKit 303885）をまねて、記録が正しいか */
  await pg.evaluate(()=>{const v=document.getElementById('pl-v');
    v.requestPictureInPicture=()=>Promise.reject(Object.assign(new Error('The video element does not support the Picture-in-Picture mode.'),{name:'NotSupportedError'}));
    v.webkitSupportsPresentationMode=()=>false;v.webkitSetPresentationMode=()=>{};});
  await pg.click('[data-plm="std"]');await pg.waitForTimeout(300);
  const last=await pg.evaluate(()=>PL.log.filter(x=>x.kind==='try').pop());
  ok(last.res==='rejected'&&/NotSupportedError/.test(last.err)&&last.before.wk===false,W+'：NotSupportedError と webkitSupportsPresentationMode=false を記録');
  await pg.click('[data-plm="wk"]');await pg.waitForTimeout(2700);
  const wk=await pg.evaluate(()=>PL.log.filter(x=>x.kind==='try').pop());
  ok(wk.call==='webkitSetPresentationMode'&&wk.res==='called'&&wk.after&&wk.after.mode!=='picture-in-picture',W+'：呼べても PiP にならなかったことが「あと」の状態でわかる');
  /* 写す文 */
  const rep=await pg.$eval('#pl-rep',e=>e.value);
  ok(/^# PiP調査/.test(rep)&&/standalone=false/.test(rep)&&/webkitSupportsPresentationMode\(pip\)=/.test(rep)&&/mp4 × std → requestPictureInPicture rejected \(NotSupportedError/.test(rep)&&/見えた=いいえ/.test(rep),W+'：写す文に環境と結果');
  await pg.click('#pl-clear');ok(await pg.evaluate(()=>PL.log.length===0),W+'：記録を消す');
  ok(await pg.$eval('#pl-safari',a=>/^x-safari-https:\/\//.test(a.getAttribute('href'))),W+'：Safari で開く（最後の手段）');
  ok(!errs.length,W+'：エラーなし '+errs.join(' / '));
  await ctx.close();
}
await b.close();
console.log(`PiP の調査ページ：${n}項目を確認${process.exitCode?'（失敗あり）':''}`);
