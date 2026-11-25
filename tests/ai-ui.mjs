// Game Kid/s AI（Stage A）の画面のテスト：既定では出ない／有効にすると、決まった Worker（中身は手元の Worker のコードそのもの）と話す。
// 計算は、固定評価の計算ケースを「いまのダメージ計算の画面（calcResult）」でその場で計算し直し、Worker の答えと全件同じかを見る（シングル・ダブル）。
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {makeD1} from './d1mock.mjs';
import {ROOT,ORIGIN,makeSigner,migrate,baseEnv} from './ai-helpers.mjs';
const S=await makeSigner();
globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
const OUT=[];globalThis.fetch=async u=>{u=String(u);if(u.includes('securetoken@system.gserviceaccount.com'))return new Response(JSON.stringify({keys:[S.jwk]}));OUT.push(u);throw new Error('blocked')};
const mod=await import(path.join(ROOT,'worker/dist/worker_test.js'));const w=mod.default,A=mod.__ai;
const FIX=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/ai-eval/fixed-v1.json'),'utf8'));
const AI=makeD1();await migrate(AI);
const env=baseEnv({AI_DB:AI,DB:makeD1(),AI_FREE_DAY:'1000',AI_FREE_MONTH:'1000',AI_RL_USER_MIN:'1000',AI_RL_IP_MIN:'1000'});
const TOKEN=await S.sign('ui-user');
const R={};let bad=0;const res=(suite,name,cond,info)=>{(R[suite]=R[suite]||{n:0,ok:0}).n++;if(cond)R[suite].ok++;else{bad++;console.error('NG',suite,name,info!==undefined?JSON.stringify(info).slice(0,400):'')}};
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const URL0='file://'+path.join(ROOT,'dist/index.html');
let aiCalls=0,inject=null;
async function page(o={}){
  const ctx=await b.newContext({viewport:o.vp||{width:390,height:844},locale:'ja-JP'});const pg=await ctx.newPage();
  const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.route('https://pokechan-tap.pokechan.workers.dev/api/ai/**',async r=>{aiCalls++;
    const q=r.request(),hd={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Content-Type':'application/json'};
    if(q.method()==='OPTIONS')return r.fulfill({status:204,headers:hd});
    if(inject)return r.fulfill({status:200,headers:hd,body:JSON.stringify(inject)});
    /* 本番のページから送ったのと同じ形にして、手元の Worker のコードに渡す */
    const h={origin:ORIGIN,authorization:q.headers().authorization||''};if(q.method()==='POST')h['content-type']='application/json';
    const x=await w.fetch(new Request(q.url().replace('https://pokechan-tap.pokechan.workers.dev','https://w.example'),{method:q.method(),headers:h,body:q.method()==='POST'?q.postData():undefined}),env,{waitUntil(){}});
    return r.fulfill({status:x.status,headers:hd,body:await x.text()})});
  if(o.ai)await pg.addInitScript(()=>{try{sessionStorage.setItem('pcaitest','1')}catch(e){}});
  await pg.goto(URL0+'#/');await pg.waitForTimeout(500);
  return{pg,ctx,errs};
}
const login=pg=>pg.evaluate(t=>{AUTH.user={uid:'ui-user',email:null,getIdToken:async()=>t}},TOKEN);

/* ---------- 既定では無効 ---------- */
{ const {pg,ctx,errs}=await page();aiCalls=0;
  await pg.evaluate(()=>{location.hash='#/tools'});await pg.waitForTimeout(400);
  res('ui','既定ではツール一覧に AI の入口がない',!(await pg.$('a[href="#/ai"]')));
  await pg.evaluate(()=>{location.hash='#/ai'});await pg.waitForTimeout(400);
  res('ui','既定では #/ai は準備中',/準備中/.test(await pg.textContent('#view'))&&!(await pg.$('#ai-q')));
  await login(pg);await pg.evaluate(()=>route());await pg.waitForTimeout(400);
  res('ui','既定ではログインしても AI に送らない',aiCalls===0,aiCalls);
  res('ui','PC_CONFIG.ai.enabled は false',await pg.evaluate(()=>window.PC_CONFIG.ai&&window.PC_CONFIG.ai.enabled===false));
  res('ui','画面のエラーなし（既定）',!errs.length,errs);await ctx.close()}

/* ---------- 有効（テスト用の切りかえ）：ログイン前・ログイン後 ---------- */
const {pg,ctx,errs}=await page({ai:true});
await pg.evaluate(()=>{location.hash='#/tools'});await pg.waitForTimeout(400);
res('ui','有効ならツール一覧に入口',!!(await pg.$('a[href="#/ai"]')));
aiCalls=0;await pg.evaluate(()=>{location.hash='#/ai'});await pg.waitForTimeout(400);
res('ui','ログイン前はログインを案内し、送らない',/ログイン/.test(await pg.textContent('#ai-quota'))&&aiCalls===0);
await login(pg);await pg.evaluate(()=>aiView());await pg.waitForTimeout(600);
res('ui','残りの回数と説明',/残り：今日/.test(await pg.textContent('#ai-quota'))&&/公平に使える/.test(await pg.textContent('#ai-quota')));
res('ui','ゲームと形式を表示',/Pokémon Champions|ポケモン/.test(await pg.textContent('.ai-scope'))&&await pg.$eval('[data-aifmt="single"]',e=>e.getAttribute('aria-pressed'))==='true');
const askUI=async q=>{await pg.fill('#ai-q',q);await pg.click('#ai-send');await pg.waitForFunction(()=>!document.querySelector('#ai-send').disabled&&document.querySelector('#ai-out .ai-ans,#ai-out .ai-card'),null,{timeout:10000});return pg.textContent('#ai-out')};
let t=await askUI('ガブリアスのタイプは？');
res('ui','回答カード（タイプ）',/ガブリアス/.test(t)&&/ドラゴン・じめん/.test(t)&&/回答/.test(t),t);
await pg.click('.ai-ev summary');t=await pg.textContent('.ai-ev');
res('ui','根拠：ラベル・出典・確認日',/実機で確認/.test(t)&&/外部参照と一致/.test(t)&&/2026-10-19/.test(t),t);
res('ui','根拠のリンクは https だけ・新しいタブ',await pg.$$eval('.ai-ev a',as=>as.every(a=>a.href.startsWith('https://')&&a.target==='_blank'&&/noopener/.test(a.rel))));
t=await askUI('ウインディの特性');
res('ui','同じ名前の姿は選ばせる',/選んでください/.test(t)&&(await pg.$$('[data-aichoose]')).length===2,t);
await pg.click('[data-aichoose="sp:10230"]');await pg.waitForFunction(()=>/ヒスイ/.test(document.querySelector('#ai-out').textContent),null,{timeout:10000});
res('ui','選んだ姿で答える',/ウインディ（ヒスイ）/.test(await pg.textContent('#ai-out')));
t=await askUI('ガブリアスはいまのレギュレーションで使える？');
res('ui','保留の表示',/保留/.test(t)&&/レギュレーション/.test(t)&&/根拠不足/.test(t),t);
t=await askUI('リザードンのメガシンカは？');
res('ui','一部だけ回答（メガは答え、使えるかは保留）',/一部だけ回答/.test(t)&&/メガリザードンX/.test(t)&&/保留/.test(t),t);

/* ---------- 計算：画面と同じ（固定評価の全ケースを、いまの画面で計算し直して比べる） ---------- */
const calcCases=FIX.cases.filter(c=>c.suite==='calc'&&c.expect.status==='answered');
for(const c of calcCases){
  const scr=await pg.evaluate(([c])=>{
    const sv=FMT;FMT=c.format;const sc=CS;
    try{const X=s=>({no:+s.id.slice(3),src:'common',ab:s.ability,item:'',sp:[...s.sp],up:s.nature.up,dn:s.nature.dn,moves:[],stg:{atk:0,def:0,spa:0,spd:0,spe:0}});
      CS={a:X(c.calc.attacker),d:X(c.calc.defender),mv:+c.calc.move.slice(3),crit:false,spread:false,burn:false,screen:false,weather:'',aHP:100,dHP:100,dSt:'',cond:false,cnt:0,hits:0,protean:true};
      const R=calcResult();return{rolls:[...R.r],hp:R.d.max,ko:{n:R.ko.n,p:R.ko.p,sure:R.ko.sure}}}finally{FMT=sv;CS=sc}},[c]);
  const wk=A.aiCalc(c.calc,{gameId:'pokechamp',rulesetId:'M-C',format:c.format});
  res('calc','画面と同じ '+c.id+' '+c.format,wk.ok&&JSON.stringify(wk.res.rolls)===JSON.stringify(scr.rolls)&&wk.res.hp===scr.hp&&wk.res.ko.n===scr.ko.n&&wk.res.ko.sure===scr.ko.sure&&wk.res.ko.p===scr.ko.p
    &&JSON.stringify(scr.rolls)===JSON.stringify(c.expect.rolls),{wk:wk.res,scr});
}
/* 画面の表示（数字の行）とも同じ（シングル・ダブル各2件） */
for(const c of [...calcCases.filter(x=>x.format==='single').slice(0,2),...calcCases.filter(x=>x.format==='double').slice(0,2)]){
  const txt=await pg.evaluate(async([c])=>{const sv=FMT,sc=CS;FMT=c.format;
    const X=s=>({no:+s.id.slice(3),src:'common',ab:s.ability,item:'',sp:[...s.sp],up:s.nature.up,dn:s.nature.dn,moves:[],stg:{atk:0,def:0,spa:0,spd:0,spe:0}});
    CS={a:X(c.calc.attacker),d:X(c.calc.defender),mv:+c.calc.move.slice(3),crit:false,spread:false,burn:false,screen:false,weather:'',aHP:100,dHP:100,dSt:'',cond:false,cnt:0,hits:0,protean:true};
    calcView();await new Promise(r=>setTimeout(r,50));const t=document.querySelector('.cv-raw').textContent;FMT=sv;CS=sc;return t},[c]);
  res('calc','画面の表示の数字 '+c.id,txt.includes(`${c.expect.min}–${c.expect.max}`)&&txt.includes('HP '+c.expect.hp),txt);
}
/* AI の画面の計算の欄（入力にない前提は補わない） */
await pg.evaluate(()=>{location.hash='#/ai'});await pg.waitForTimeout(300);await pg.evaluate(()=>aiView());await pg.waitForTimeout(500);
{ const c=calcCases[0];const nmA=await pg.evaluate(n=>byNo[n].n,+c.calc.attacker.id.slice(3)),nmD=await pg.evaluate(n=>byNo[n].n,+c.calc.defender.id.slice(3)),mvn=await pg.evaluate(n=>mName(n),+c.calc.move.slice(3));
  t=await askUI(`${nmA}の${mvn}で${nmD}へのダメージは？`);
  res('ui','計算は条件を求める（補わない）',/条件を確認できると計算できます/.test(t)&&!!(await pg.$('#ai-calc-go')),t);
  await pg.evaluate(([c])=>{const f=document.querySelector('.ai-calc'),v=(k,x)=>{const e=f.querySelector(`[data-ai="${k}"]`);e.value=String(x)};
    for(const [k,s] of [['attacker',c.calc.attacker],['defender',c.calc.defender]]){s.sp.forEach((x,i)=>v(`${k}.sp${i}`,x));v(k+'.up',s.nature.up);v(k+'.dn',s.nature.dn);v(k+'.ab',s.ability)}
    v('move',c.calc.move.slice(3))},[c]);
  await pg.click('#ai-calc-go');await pg.waitForFunction(()=>document.querySelector('[data-tpl="damage_calc"]'),null,{timeout:10000});
  t=await pg.textContent('[data-tpl="damage_calc"]');
  res('ui','計算の答えは画面と同じ数字・前提・リビジョン',t.includes(`${c.expect.min}〜${c.expect.max}`)&&/HP満タン/.test(t)&&t.includes(A.AI_ENGINE_REV)&&/サイトの計算・推定/.test(t),t)}
t=await askUI('ガブリアスのタネマシンガンでカイリューへのダメージ');
res('ui','対応しない条件は数字を出さず、計算の画面へ',!/[0-9]+〜[0-9]+/.test(t)&&!!(await pg.$('#ai-out a[href="#/calc"]')),t);

/* ---------- この端末で計算済みの診断・選出だけを表示 ---------- */
await pg.evaluate(()=>{team.length=0;aiView()});await pg.waitForTimeout(300);
await pg.click('[data-ailocal="diag"]');res('tools','パーティがなければ作らない',/パーティがまだありません/.test(await pg.textContent('#ai-local')));
await pg.evaluate(()=>{FMT='single';team.push(...[445,149,6,887,1000,778].filter(n=>byNo[n]).map(no=>({no,set:null})));aiView()});await pg.waitForTimeout(300);
await pg.click('[data-ailocal="diag"]');
res('tools','未計算なら結果を作らず画面へ案内',/まだこの端末で計算されていません/.test(await pg.textContent('#ai-local'))&&!!(await pg.$('#ai-local a[href="#/team"]'))&&await pg.$eval('.ai-local',e=>e.dataset.ok)==='0');
const exp=await pg.evaluate(()=>{const T=dgTeam(team,20);dgSelect(team);return{n:T.rows.length,c:[4,3,2,1].map(l=>T.rows.filter(r=>r.lvl===l).length)}});
await pg.click('[data-ailocal="diag"]');t=await pg.textContent('#ai-local');
res('tools','計算済みの診断の数（元の結果と同じ）',t.includes(`上位 ${exp.n} 匹`)&&t.includes(`◎${exp.c[0]}・○${exp.c[1]}・△${exp.c[2]}・×${exp.c[3]}`)&&/サーバーでは確かめていません/.test(t)&&/目安/.test(t),{t,exp});
await pg.click('[data-ailocal="select"]');t=await pg.textContent('#ai-local');
const sel=await pg.evaluate(()=>{const S=dgSelect(team);return S.best.c.map(i=>byNo[team[i].no].n)});
res('tools','計算済みの選出（元の結果と同じ）',sel.every(n=>t.includes(n))&&/シングル/.test(t),{t,sel});
await pg.click('[data-aifmt="double"]');await pg.waitForTimeout(300);await pg.click('[data-ailocal="diag"]');
res('tools','形式が違えば表示しない',/違うため表示しません/.test(await pg.textContent('#ai-local')));
await pg.click('[data-ailocal="build"]');res('tools','構築は画面へ案内だけ',!!(await pg.$('#ai-local a[href="#/pair"]'))&&await pg.$eval('.ai-local',e=>e.dataset.ok)==='0');
await pg.click('[data-aifmt="single"]');await pg.waitForTimeout(300);
t=await askUI('パーティの診断をして');res('tools','診断の質問はこの端末の結果へ',/この端末/.test(t)&&/◎/.test(t),t);

/* ---------- 返ってきた文字は文字として出す（HTML にしない） ---------- */
inject={status:'answered',scope:{gameId:'pokechamp',format:'single'},cards:[{templateId:'species_types',slots:{name:'<img src=x onerror="window.__x=1">',types:['<b>x</b>']},evidenceIds:['e1'],verificationStatus:'ingame'}],
  evidence:[{evidenceId:'e1',field:'types',sourceType:'ingame',source:{name:'<script>window.__y=1</script>',refs:[{name:'bad',url:'javascript:alert(1)'},{name:'ok',url:'https://pokeapi.co/'}]},checkedAt:'2026-10-19'}]};
await askUI('ガブリアスのタイプは？');await pg.waitForTimeout(200);
res('ui','返ってきた文字は HTML にしない・javascript: のリンクは出さない',!(await pg.evaluate(()=>window.__x||window.__y))&&!(await pg.$('#ai-out img'))&&(await pg.$$eval('.ai-ev a',as=>as.map(a=>a.href))).every(h=>h.startsWith('https://')));
inject=null;
/* ---------- 見た目（スマホ・PC）：はみ出しなし ---------- */
fs.mkdirSync(path.join(ROOT,'tests/out'),{recursive:true});
for(const vp of [{width:390,height:844},{width:1280,height:900}]){
  await pg.setViewportSize(vp);await pg.evaluate(()=>aiView());await pg.waitForTimeout(400);await askUI('ガブリアスの種族値を教えて');
  res('ui','横にはみ出さない '+vp.width,await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.body.scrollWidth<=innerWidth+1));
  await pg.screenshot({path:path.join(ROOT,`tests/out/ai-${vp.width}.png`)});
}
res('ui','画面のエラーなし',!errs.length,errs);
res('ui','外部への送信 0 件',OUT.length===0,OUT);
await ctx.close();await b.close();
for(const [k,v] of Object.entries(R))console.log(`  ${k}: ${v.ok}/${v.n}`);
const tot=Object.values(R).reduce((a,v)=>a+v.n,0);
fs.writeFileSync(path.join(ROOT,'tests/out/ai-ui-results.json'),JSON.stringify({total:tot,bad,suites:R},null,1));
console.log(bad?`ai-ui: NG（${bad}件 / ${tot}項目）`:`ai-ui: OK（${tot}項目）`);if(bad)process.exitCode=1;
