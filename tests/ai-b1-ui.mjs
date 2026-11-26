// Game Kid/s AI B1 の画面のテスト：自由文のパーティ相談 → 形式を聞く → 候補 → 続き（2つ目・残したい・メガの姿）／回数切れで質問を残す。
// Worker は手元のコードそのもの（模擬の提供元）。外部への送信はしない。
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {makeD1} from './d1mock.mjs';
import {ROOT,ORIGIN,makeSigner,migrate,baseEnv} from './ai-helpers.mjs';
import {seedB1} from './ai-b1-fixture.mjs';
const S=await makeSigner();
globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
const OUT=[];globalThis.fetch=async u=>{u=String(u);if(u.includes('securetoken@system.gserviceaccount.com'))return new Response(JSON.stringify({keys:[S.jwk]}));OUT.push(u);throw new Error('blocked')};
const mod=await import(path.join(ROOT,'worker/dist/worker_test.js'));const w=mod.default,A=mod.__ai;
async function mkEnv(o){const AI=makeD1();await migrate(AI);const env=baseEnv({AI_DB:AI,DB:makeD1(),AI_B1_ENABLED:'1',AI_RL_USER_MIN:'1000',AI_RL_IP_MIN:'1000',...o});env.__ids=await seedB1(env,null,A);return env}
let env=await mkEnv({AI_FREE_DAY:'100',AI_FREE_MONTH:'100'});
const TOKEN=await S.sign('b1-user');
const SHOTS=[];const R={n:0,ok:0};let bad=0;const res=(name,cond,info)=>{R.n++;if(cond)R.ok++;else{bad++;console.error('NG',name,info!==undefined?JSON.stringify(info).slice(0,400):'')}};
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const URL0='file://'+path.join(ROOT,'dist/index.html');
async function page(vp){
  const ctx=await b.newContext({viewport:vp,locale:'ja-JP'});const pg=await ctx.newPage();
  const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.route('https://pokechan-tap.pokechan.workers.dev/api/ai/**',async r=>{
    const q=r.request(),hd={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Content-Type':'application/json'};
    if(q.method()==='OPTIONS')return r.fulfill({status:204,headers:hd});
    const h={origin:ORIGIN,authorization:q.headers().authorization||''};if(q.method()==='POST')h['content-type']='application/json';
    const x=await w.fetch(new Request(q.url().replace('https://pokechan-tap.pokechan.workers.dev','https://w.example'),{method:q.method(),headers:h,body:q.method()==='POST'?q.postData():undefined}),env,{waitUntil(){}});
    return r.fulfill({status:x.status,headers:hd,body:await x.text()})});
  await pg.addInitScript(()=>{try{sessionStorage.setItem('pcaitest','1')}catch(e){}});
  await pg.goto(URL0+'#/');await pg.waitForTimeout(400);
  await pg.evaluate(t=>{AUTH.user={uid:'b1-user',email:null,getIdToken:async()=>t}},TOKEN);
  await pg.evaluate(()=>{location.hash='#/ai'});await pg.waitForTimeout(500);
  return{pg,ctx,errs};
}
for(const vp of [{width:390,height:844},{width:1280,height:900}]){
  const {pg,ctx,errs}=await page(vp),W=vp.width;
  const shot=async n=>{const f=`tests/out/ai-b1-${W}-${n}.png`;fs.mkdirSync(path.join(ROOT,'tests/out'),{recursive:true});await pg.screenshot({path:path.join(ROOT,f)});SHOTS.push(f)};
  const askUI=async q=>{const n0=await pg.$$eval('#ai-log .ai-msg.bot',x=>x.length);
    if(q!==null){await pg.fill('#ai-q',q);await pg.click('#ai-send')}
    await pg.waitForFunction(n=>document.querySelectorAll('#ai-log .ai-msg.bot').length>=n&&!document.querySelector('#ai-log .ai-wait'),n0+(q===null?0:1),{timeout:10000});
    return pg.$eval('#ai-log .ai-msg.bot:last-child',e=>e.textContent)};
  const names=()=>pg.$$eval('#ai-log .ai-msg.bot:last-child .ai-tm',x=>x.map(e=>[...e.querySelectorAll('.ai-tm-p')].map(p=>p.textContent).join(',')));
  let t=await askUI('今オススメのパーティ教えて');
  res(W+' 形式が無ければ聞く',/シングルとダブルで答えが変わります/.test(t)&&(await pg.$$('#ai-log .ai-msg.bot:last-child [data-aichoose]')).length===2,t);
  await pg.click('#ai-log .ai-msg.bot:last-child [data-aichoose="double"]');t=await askUI(null);
  let tm=await names();
  res(W+' 候補は3件・6匹ずつ',tm.length===3&&tm.every(x=>x.split(',').length===6),tm);
  res(W+' 現行を確認できないことを書く',/「今のおすすめ」とは言えません/.test(t)&&/過去のシーズン/.test(t),t);
  res(W+' 出どころ（運営が確認した記録・シーズンへのリンク）',/運営が証拠を確認した上位の記録/.test(t)&&(await pg.$$eval('#ai-log .ai-msg.bot:last-child .ai-tm a',as=>as.every(a=>/^#\/season\/\d+$/.test(a.getAttribute('href'))))),t);
  res(W+' 登録した人・コメントは出さない',!/player-|コメント（AI/.test(t));
  res(W+' 続きの例を出す',(await pg.$$('#ai-log .ai-msg.bot:last-child [data-aifill]')).length>=1);
  res(W+' 会話の番号を覚える',await pg.evaluate(()=>/^c[0-9a-f]{32}$/.test(AI_ST.conv||'')));
  await shot('candidates');
  t=await askUI('2つ目で、メガリザードンYは残したい');tm=await names();
  res(W+' 続き：2つ目に近く、メガリザードンYを残す',tm.length===1&&tm[0].includes('メガリザードンY')&&/案2と\d匹が同じ/.test(t)&&/残す メガリザードンY/.test(t),{tm,t});
  t=await askUI('さっきの案でメガリザードンは残したい');
  /* 前の条件（Y）が残っているので、聞かずにそのまま */
  res(W+' 条件は引きつぐ（Yのまま・聞き直さない）',!(await pg.$('#ai-log .ai-msg.bot:last-child [data-aichoose]'))&&/メガリザードンY/.test(t),t);
  /* 新しく相談：メガの姿を聞く → 選ぶと同じ相談に続ける */
  await pg.evaluate(()=>{AI_ST.conv=null});
  t=await askUI('ダブルでメガリザードンを入れたおすすめのパーティ教えて');
  const ch=await pg.$$eval('#ai-log .ai-msg.bot:last-child [data-aichoose]',x=>x.map(e=>e.textContent));
  res(W+' メガの姿で変わるときだけ聞く',/どのメガシンカの姿か/.test(t)&&ch.includes('メガリザードンX')&&ch.includes('メガリザードンY'),{t,ch});
  await pg.click('#ai-log .ai-msg.bot:last-child [data-aichoose="sp:10034"]');t=await askUI(null);tm=await names();
  res(W+' 選んだ姿で続ける',tm.length>=1&&tm.every(x=>x.includes('メガリザードンX')),tm);
  /* 条件に合わなければゆるめずに道具へ */
  t=await askUI('雪寄りにして');
  res(W+' 合わなければゆるめず、こだわり条件で組むへ',/条件はゆるめていません/.test(t)&&!!(await pg.$('#ai-log .ai-msg.bot:last-child a[href="#/pair/kd"]')),t);
  res(W+' 横にはみ出さない',await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await shot('followup');
  /* ログアウトで会話の番号も消す */
  await pg.evaluate(()=>aiReset());res(W+' 消去で会話の番号も消える',await pg.evaluate(()=>AI_ST.conv===null));
  res(W+' 画面のエラーなし',!errs.length,errs);
  await ctx.close();
}
/* 回数切れ：質問を入力欄に残し、回復の時刻と AI を使わないツールを出す */
{ env=await mkEnv({AI_FREE_DAY:'1',AI_FREE_MONTH:'30'});const {pg,ctx,errs}=await page({width:390,height:844});
  const askUI=async q=>{const n0=await pg.$$eval('#ai-log .ai-msg.bot',x=>x.length);await pg.fill('#ai-q',q);await pg.click('#ai-send');
    await pg.waitForFunction(n=>document.querySelectorAll('#ai-log .ai-msg.bot').length>=n&&!document.querySelector('#ai-log .ai-wait'),n0+1,{timeout:10000});return pg.$eval('#ai-log .ai-msg.bot:last-child',e=>e.textContent)};
  await askUI('ダブルのおすすめのパーティ教えて');
  const t=await askUI('ダブルの雨のおすすめのパーティ');
  res('回数切れ：理由と回復の時刻',/今日の回数を使い切りました/.test(t)&&/以降にまた使えます/.test(t),t);
  res('回数切れ：質問を入力欄に残す',(await pg.inputValue('#ai-q'))==='ダブルの雨のおすすめのパーティ');
  res('回数切れ：AI を使わないツール',(await pg.$$eval('#ai-log .ai-msg.bot:last-child a',as=>as.map(a=>a.getAttribute('href')))).join()==='#/dex,#/calc,#/pair/kd');
  const f=`tests/out/ai-b1-390-quota.png`;await pg.screenshot({path:path.join(ROOT,f)});SHOTS.push(f);
  res('画面のエラーなし（回数切れ）',!errs.length,errs);await ctx.close()}
await b.close();
res('外部への送信 0 件',OUT.length===0,OUT);
fs.writeFileSync(path.join(ROOT,'tests/out/ai-b1-ui-results.json'),JSON.stringify({total:R.n,bad,shots:SHOTS},null,1));
console.log(bad?`ai-b1-ui: NG（${bad}件 / ${R.n}項目）`:`ai-b1-ui: OK（${R.n}項目）`);if(bad)process.exitCode=1;
