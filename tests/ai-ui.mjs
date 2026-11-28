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
/* 利用枠は既定値（無料 1日5回・月30回）のまま。画面の操作が多いので、テストの利用者は有料テスト権限（月300回）で動かす */
const env=baseEnv({AI_DB:AI,DB:makeD1(),AI_RL_USER_MIN:'1000',AI_RL_IP_MIN:'1000'});
{const h=await A.aiHmac(env,'u|ui-user');await AI.prepare(`INSERT INTO ai_entitlements(uid_h,plan,valid_to,updated_at) VALUES(?,'paid_test',NULL,1)`).bind(h).run()}
const TOKEN=await S.sign('ui-user');
const SHOTS=[];const R={};let bad=0;const res=(suite,name,cond,info)=>{(R[suite]=R[suite]||{n:0,ok:0}).n++;if(cond)R[suite].ok++;else{bad++;console.error('NG',suite,name,info!==undefined?JSON.stringify(info).slice(0,400):'')}};
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
  /* にせものの Firebase（ログインの状態はページの中だけ。__set で本物と同じ onAuthStateChanged を起こす） */
  await pg.route(/www\.gstatic\.com\/firebasejs\/.*\/firebase-(app|auth)\.js/,r=>r.fulfill({status:200,headers:{'Content-Type':'text/javascript','Access-Control-Allow-Origin':'*'},
    body:/firebase-app/.test(r.request().url())?'export const initializeApp=c=>({c});':`let user=null;const cbs=[];const fire=()=>cbs.forEach(f=>f(user));
export const getAuth=()=>({});export const onAuthStateChanged=(a,f)=>{cbs.push(f);setTimeout(()=>f(user),0)};
export const signOut=async()=>{user=null;fire()};export const getRedirectResult=async()=>null;
export const __set=u=>{user=u;fire()};export class GoogleAuthProvider{};export class OAuthProvider{};`}));
  if(o.ai)await pg.addInitScript(()=>{try{sessionStorage.setItem('pcaitest','1')}catch(e){}});
  await pg.goto(URL0+'#/');await pg.waitForTimeout(500);
  if(o.ai)await pg.evaluate(()=>{AI_CFG.auditHold=false});
  else if(JSON.parse(fs.readFileSync(path.join(ROOT,'config/public.json'),'utf8')).ai.auditHold){
    const hidden=await pg.evaluate(()=>{
      AI_CFG.enabled=true;AI_CFG.partyConsult=true;
      sessionStorage.setItem('pcaitest','1');
      const blocked=AI_CFG.auditHold===true&&!aiUiOn()&&!aiUiOn(true);
      AI_CFG.enabled=false;AI_CFG.partyConsult=false;sessionStorage.removeItem('pcaitest');
      return blocked;
    });
    res('ui','配信設定の公開停止はテストフラグより優先',hidden);
  }
  return{pg,ctx,errs};
}
const login=pg=>pg.evaluate(t=>{AUTH.user={uid:'ui-user',email:null,getIdToken:async()=>t}},TOKEN);
/* 本物の onAuthStateChanged の処理（29-account.js）を通してログイン・切りかえる */
const fbSet=(pg,uid,tk)=>pg.evaluate(async([uid,tk])=>{await fbLoad();AUTH.fb.au.__set(uid?{uid,email:null,getIdToken:async()=>tk}:null);await new Promise(r=>setTimeout(r,30))},[uid,tk]);

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

/* ---------- 有効（テスト用の切りかえ）：会話の形・下の入力欄 ---------- */
const {pg,ctx,errs}=await page({ai:true});
const shot=async n=>{const f=`tests/out/ai-${n}.png`;fs.mkdirSync(path.join(ROOT,'tests/out'),{recursive:true});await pg.screenshot({path:path.join(ROOT,f)});SHOTS.push(f)};
await pg.evaluate(()=>{location.hash='#/tools'});await pg.waitForTimeout(400);
res('ui','有効ならツール一覧に入口',!!(await pg.$('a[href="#/ai"]')));
aiCalls=0;await pg.evaluate(()=>{location.hash='#/ai'});await pg.waitForTimeout(400);
res('ui','ログイン前はログインを案内し、送らない',/ログイン/.test(await pg.textContent('#ai-root'))&&aiCalls===0);
await login(pg);await pg.evaluate(()=>aiView());await pg.waitForTimeout(600);
res('ui','形式の切りかえを常に出さない',!(await pg.$('[data-aifmt]'))&&!/シングル|ダブル/.test(await pg.textContent('.ai-top')));
res('ui','右下の相性ボタン（⚡）を出さない',await pg.evaluate(()=>document.getElementById('fabwrap').hidden));
res('ui','入力欄は1つ・送信ボタンが中に',(await pg.$$('#ai-root textarea')).length===1&&await pg.evaluate(()=>{const f=document.querySelector('#ai-comp').getBoundingClientRect(),b=document.querySelector('#ai-send').getBoundingClientRect();return b.left>=f.left&&b.right<=f.right&&b.top>=f.top&&b.bottom<=f.bottom}));
res('ui','残りの回数はたたむ',await pg.$eval('#ai-quota',e=>!e.open)&&/今日あと\d+回/.test(await pg.textContent('#ai-quota summary')));
await pg.click('#ai-quota summary');t0:{const q=await pg.textContent('#ai-quota .ai-qd');
  res('ui','開くと日・月のリセット時刻と上限の理由',/今日：\d+／\d+回（.*に戻ります）/.test(q)&&/今月：/.test(q)&&/処理費用/.test(q)&&/公平/.test(q),q)}
await pg.click('#ai-quota summary');
const geo=()=>pg.evaluate(()=>{const c=document.querySelector('#ai-comp').getBoundingClientRect(),tb=document.querySelector('.tabbar');const t=tb?tb.getBoundingClientRect():null;
  return{cTop:c.top,cBot:c.bottom,tbTop:t&&getComputedStyle(tb).visibility!=='hidden'?t.top:null,h:innerHeight,vis:tb?getComputedStyle(tb).visibility:'none'}});
let g=await geo();res('ui','スマホ：入力欄は下のメニューの上（重ならない）',g.tbTop!==null&&g.cBot<=g.tbTop&&g.cBot<=g.h,g);
const askUI=async(q,o={})=>{const n0=await pg.$$eval('#ai-log .ai-msg.bot',x=>x.length);
  if(q!==null){await pg.fill('#ai-q',q);await pg.click('#ai-send')}
  await pg.waitForFunction(n=>document.querySelectorAll('#ai-log .ai-msg.bot').length>=n&&!document.querySelector('#ai-log .ai-wait'),n0+(q===null?0:1),{timeout:10000});
  return pg.$eval('#ai-log .ai-msg.bot:last-child',e=>e.textContent)};
const used=()=>pg.evaluate(()=>AI_ST.ctx?null:null).then(async()=>{const h=await A.aiHmac(env,'u|ui-user');return (await AI.prepare(`SELECT COUNT(*) c FROM ai_requests WHERE uid_h=? AND consumed=1`).bind(h).first()).c});
let t=await askUI('ガブリアスのタイプは？');
res('ui','形式に関係ない質問はそのまま答える',/ドラゴン・じめん/.test(t)&&!/どちらの形式/.test(t),t);
res('ui','会話の形（自分の質問の吹き出し）',(await pg.$$eval('#ai-log .ai-msg.me .ai-bub',x=>x.map(e=>e.textContent))).includes('ガブリアスのタイプは？'));
await pg.click('#ai-log .ai-msg.bot:last-child .ai-ev summary');t=await pg.textContent('#ai-log .ai-msg.bot:last-child .ai-ev');
res('ui','根拠：何の値か・出典・段階・確認日',/ガブリアスのタイプ/.test(t)&&/実機で確認/.test(t)&&/確認日：2026-10-19/.test(t)&&/ガブリアスの名前/.test(t)&&/外部参照（1出典・未照合）/.test(t),t);
res('ui','根拠のリンクは https だけ・新しいタブ',await pg.$$eval('.ai-ev a',as=>as.every(a=>a.href.startsWith('https://')&&a.target==='_blank'&&/noopener/.test(a.rel))));
t=await askUI('ガブリアスの種族値を教えて');
const cols=await pg.$eval('#ai-log .ai-msg.bot:last-child .ai-sg',e=>getComputedStyle(e).gridTemplateColumns.split(' ').length);
const rows=await pg.$$eval('#ai-log .ai-msg.bot:last-child .ai-sg>div',ds=>new Set(ds.map(d=>Math.round(d.getBoundingClientRect().top))).size);
res('ui','種族値は3×2のます',cols===3&&rows===2&&/108/.test(t)&&/102/.test(t),{cols,rows});
await shot('390-stats');
/* 形式で答えが変わる質問：その場で形式を聞き、同じ質問を続ける（確認では回数を使わない） */
const u0=await used();t=await askUI('ガブリアスのじしんでカイリューへのダメージは？');
const u1=await used();
res('ui','形式が要る質問だけ形式を聞く',/シングルとダブルで答えが変わります/.test(t)&&(await pg.$$('#ai-log .ai-msg.bot:last-child [data-aichoose]')).length===2,t);
res('ui','形式の確認では回数を使わない',u1===u0,{u0,u1});
const nMe=await pg.$$eval('#ai-log .ai-msg.me',x=>x.length);
await pg.click('#ai-log .ai-msg.bot:last-child [data-aichoose="single"]');t=await askUI(null);
res('ui','選ぶと同じ質問を続ける（質問は増えない）',(await pg.$$eval('#ai-log .ai-msg.me',x=>x.length))===nMe&&/条件を確認できると計算できます/.test(t),t);
res('ui','続けても計算の条件の確認では回数を使わない',(await used())===u0);
/* 計算の欄：片方を変えてももう片方はそのまま・送る前に特性と条件 */
const fillSide=(k,sp,j)=>pg.evaluate(([k,sp,j])=>{const box=document.querySelector('#ai-log .ai-msg.bot:last-child .ai-calc');sp.forEach((v,i)=>{const e=box.querySelector(`[data-ai="${k}.sp${i}"]`);e.value=String(v);e.dispatchEvent(new Event('change',{bubbles:true}))});
  box.querySelector(`[data-ainat="${j}"][data-aiside="${k}"]`).click()},[k,sp,j]);
await fillSide('attacker',[2,32,0,0,0,32],2);   // いじっぱり
let sum=await pg.textContent('#ai-log .ai-msg.bot:last-child .ai-csum');
res('ui','計算の欄は枠の中に収まる（性格のます・能力ポイント）',await pg.$eval('#ai-log .ai-msg.bot:last-child .ai-calc',e=>[...e.querySelectorAll('.natg-t,.ai-sp,.ai-side')].every(x=>x.scrollWidth<=x.clientWidth+1)&&e.getBoundingClientRect().right<=innerWidth));
res('ui','送る前に特性・性格・能力ポイント・条件を表示',/さめはだ|すながくれ/.test(sum)&&/いじっぱり/.test(sum)&&/A32/.test(sum)&&/シングル・Lv50・ランク0・HP満タン・持ち物なし/.test(sum),sum);
res('ui','計算に影響する特性は「計算の対象外」と表示',/計算の対象外/.test(await pg.textContent('#ai-log .ai-msg.bot:last-child [data-ai="attacker.ab"]')));
await pg.evaluate(()=>{const s=document.querySelector('#ai-log .ai-msg.bot:last-child [data-ai="defender.no"]');s.value='6';s.dispatchEvent(new Event('change',{bubbles:true}))});
await pg.waitForTimeout(100);
const att=await pg.evaluate(()=>{const b=document.querySelector('#ai-log .ai-msg.bot:last-child .ai-calc');return{sp:[0,1,2,3,4,5].map(i=>+b.querySelector(`[data-ai="attacker.sp${i}"]`).value),no:b.querySelector('[data-ai="attacker.no"]').value,mv:b.querySelector('[data-ai="move"]').value,nat:b.querySelector('[data-aiside="attacker"][aria-pressed="true"]')?.dataset.ainat}});
res('ui','受ける側を変えても攻撃する側の入力と技はそのまま',att.no==='445'&&JSON.stringify(att.sp)===JSON.stringify([2,32,0,0,0,32])&&att.mv==='89'&&att.nat==='2',att);
await pg.evaluate(()=>{const s=document.querySelector('#ai-log .ai-msg.bot:last-child [data-ai="defender.no"]');s.value='149';s.dispatchEvent(new Event('change',{bubbles:true}))});
await fillSide('defender',[32,0,2,0,32,0],0);
/* 計算できる特性を選ぶ（ガブリアスは計算に影響する特性しかないので、送ると「対象外」になることを見る） */
await pg.click('#ai-log .ai-msg.bot:last-child [data-ai-go]');t=await askUI(null);
res('ui','計算に影響する特性は数字を出さず、計算の画面へ',/計算に影響するため|ここではまだ計算できません/.test(t)&&!!(await pg.$('#ai-log .ai-msg.bot:last-child a[href="#/calc"]'))&&!/%/.test(t),{t,body:await pg.evaluate(()=>AI_ST.log[AI_ST.log.length-1].body)});
await shot('390-calcform');
/* 固定評価の対応ケースで、計算の答えの確定数の書き方が画面と同じ */
const cc=FIX.cases.find(c=>c.suite==='calc'&&c.expect.status==='answered'&&c.format==='single');
await pg.evaluate(()=>{const s=AI_ST.log;});
inject=null;
{ const r=await pg.evaluate(async([c])=>{const body={gameId:'pokechamp',format:c.format,question:c.q,requestId:aiRid(),toolInput:{calc:c.calc}};
    const root=document.getElementById('ai-root');AI_ST.log.push({who:'me',text:c.q});const m={who:'bot',wait:true};AI_ST.log.push(m);
    const {status,j}=await aiFetch('/api/ai/v1/answer',body);Object.assign(m,{wait:false,status,j,body,question:c.q});aiDrawLog(root);
    const card=j.cards.find(x=>x.templateId==='damage_calc');return{badge:koBadge(card.slots.ko),plain:koPlain(card.slots.ko),html:document.querySelector('#ai-log .ai-msg.bot:last-child [data-tpl="damage_calc"]').innerHTML,txt:document.querySelector('#ai-log .ai-msg.bot:last-child [data-tpl="damage_calc"]').textContent}},[cc]);
  res('ui','確定数は計算の画面と同じ部品（koBadge・koPlain）',r.html.replace(/ data-notr=""/g,' data-notr').includes(r.badge)&&r.txt.includes(r.plain.replace(/<[^>]+>/g,''))&&r.txt.includes(`${cc.expect.min}〜${cc.expect.max}`),r)}
await shot('390-calc');
/* 役わりが決まらないときは選ばせる → 選ぶと同じ質問を続ける */
t=await askUI('ガブリアスとカイリューのじしんのダメージはシングルで');
res('ui','攻撃する側が決まらないときは選ばせる',/どちらが攻撃して/.test(t)&&(await pg.$$('#ai-log .ai-msg.bot:last-child [data-airole]')).length===2,t);
await pg.click('#ai-log .ai-msg.bot:last-child [data-airole="1"]');t=await askUI(null);
const pre=await pg.evaluate(()=>{const b=document.querySelector('#ai-log .ai-msg.bot:last-child .ai-calc');return b&&{a:b.querySelector('[data-ai="attacker.no"]').value,d:b.querySelector('[data-ai="defender.no"]').value}});
res('ui','選んだ役わりで計算の欄に入る',pre&&pre.a==='149'&&pre.d==='445',{pre,t});
/* 姿が決まらないときも選ばせる */
t=await askUI('ウインディのフレアドライブでカイリューへのダメージ シングル');
res('ui','攻撃する側の姿が決まらないときは選ばせる',/同じ名前の姿/.test(t)&&(await pg.$$('#ai-log .ai-msg.bot:last-child [data-aichoose]')).length===2,t);
/* 比べる質問は限界を書いて比較の画面へ */
t=await askUI('ガブリアスとカイリューどっちが強い？');
const href=await pg.$eval('#ai-log .ai-msg.bot:last-child a',a=>a.getAttribute('href'));
res('ui','比べる質問は答えず、ポケモン比較へ',/条件（相手・型・形式）で変わる/.test(t)&&href==='#/cmp/445-149'&&/ポケモン比較を開く/.test(t),{t,href});
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
for(const c of [...calcCases.filter(x=>x.format==='single').slice(0,2),...calcCases.filter(x=>x.format==='double').slice(0,2)]){
  const txt=await pg.evaluate(async([c])=>{const sv=FMT,sc=CS;FMT=c.format;
    const X=s=>({no:+s.id.slice(3),src:'common',ab:s.ability,item:'',sp:[...s.sp],up:s.nature.up,dn:s.nature.dn,moves:[],stg:{atk:0,def:0,spa:0,spd:0,spe:0}});
    CS={a:X(c.calc.attacker),d:X(c.calc.defender),mv:+c.calc.move.slice(3),crit:false,spread:false,burn:false,screen:false,weather:'',aHP:100,dHP:100,dSt:'',cond:false,cnt:0,hits:0,protean:true};
    calcView();await new Promise(r=>setTimeout(r,50));const t=document.querySelector('.cv-raw').textContent;FMT=sv;CS=sc;return t},[c]);
  res('calc','画面の表示の数字 '+c.id,txt.includes(`${c.expect.min}–${c.expect.max}`)&&txt.includes('HP '+c.expect.hp),txt);
}
await pg.evaluate(()=>{location.hash='#/ai'});await pg.waitForTimeout(400);

/* ---------- この端末で計算済みの診断・選出だけを表示（使った相手のデータの名前つき） ---------- */
const localClick=async k=>{await pg.click(`#ai-log .ai-msg.bot:first-child [data-ailocal="${k}"]`);await pg.waitForTimeout(150);return pg.$eval('#ai-log .ai-msg.bot:last-child',e=>e.textContent)};
await pg.evaluate(()=>{team.length=0;aiView()});await pg.waitForTimeout(300);
res('tools','パーティがなければ作らない',/パーティがまだありません/.test(await localClick('diag')));
await pg.evaluate(()=>{FMT='single';team.push(...[445,149,6,887,1000,778].filter(n=>byNo[n]).map(no=>({no,set:null})));aiView()});await pg.waitForTimeout(300);
t=await localClick('diag');
res('tools','未計算なら結果を作らず画面へ案内',/まだこの端末で計算されていません/.test(t)&&/パーティの診断を開く/.test(t));
const exp=await pg.evaluate(()=>{const T=dgTeam(team,20);dgSelect(team);return{n:T.rows.length,c:[4,3,2,1].map(l=>T.rows.filter(r=>r.lvl===l).length),live:T.rows.filter(r=>r.live).length,meta:!!(META.rank&&META.rank.length>=20)}});
t=await localClick('diag');
res('tools','計算済みの診断の数（元の結果と同じ）',t.includes(`◎${exp.c[0]}・○${exp.c[1]}・△${exp.c[2]}・×${exp.c[3]}`)&&/サーバーでは確かめていません/.test(t),{t,exp});
res('tools','診断のラベルは実際に使った相手のデータ',exp.meta?/ランクバトルの使用率の集計で上位の/.test(t):(/合計種族値の高い\d+匹（使用率の集計を読めなかったための代わり）/.test(t)&&t.includes(`使用率の集計の型 ${exp.live}匹`)),{t,exp});
t=await localClick('select');const sel=await pg.evaluate(()=>{const S=dgSelect(team);return S.best.c.map(i=>byNo[team[i].no].n)});
res('tools','計算済みの選出（元の結果と同じ）',sel.every(n=>t.includes(n))&&/シングル/.test(t)&&/相手：/.test(t),{t,sel});
res('tools','構築は「パーティ構築を開く」',(await pg.$eval('#ai-log .ai-msg.bot:first-child [data-ailocal="build"]',e=>e.textContent))==='パーティ構築を開く');
t=await askUI('ダブルの選出は？');res('tools','形式が違う結果は出さない',/違うため表示しません/.test(t),t);
t=await askUI('シングルのパーティの診断をして');res('tools','形式が同じなら診断の質問はこの端末の結果へ',/この端末/.test(t)&&/◎/.test(t),t);
await pg.click('#ai-log .ai-msg.bot:last-child a[href="#/team"]');await pg.waitForTimeout(300);
res('tools','画面を移ると下の入力欄の印を外す',!(await pg.evaluate(()=>document.body.classList.contains('ai-on'))));
await pg.evaluate(()=>{location.hash='#/ai'});await pg.waitForTimeout(300);

/* ---------- キーボード：入力欄は見える範囲の下・下のメニューは隠す ---------- */
await pg.focus('#ai-q');await pg.evaluate(()=>aiKbApply(320));await pg.waitForTimeout(100);
g=await geo();res('ui','キーボードが出ても入力欄は見える範囲にあり、下のメニューと重ならない',g.cBot<=844-320&&g.cTop>0&&g.vis==='hidden',g);
await shot('390-keyboard');
await pg.evaluate(()=>aiKbApply(0));await pg.locator('#ai-q').blur();
/* 最後の回答が入力欄に隠れない */
await pg.evaluate(()=>document.scrollingElement&&0);
const hid=await pg.evaluate(()=>{const l=document.querySelector('#ai-log').lastElementChild;l.scrollIntoView({block:'end'});const a=l.getBoundingClientRect(),c=document.querySelector('#ai-comp').getBoundingClientRect();return{a:a.bottom,c:c.top}});
res('ui','いちばん下の回答は入力欄の上まで送れる',hid.a<=hid.c+1,hid);


/* ---------- ログアウト・アカウントの削除・ほかの人のログインで、会話・書きかけ・待っている答えを消す ---------- */
const TOKEN2=await S.sign('ui-other');
{ await pg.setViewportSize({width:390,height:844});
  await fbSet(pg,'ui-user',TOKEN);await pg.evaluate(()=>{location.hash='#/ai'});await pg.waitForTimeout(400);
  const seed=async()=>{await askUI('ガブリアスのタイプは？');await pg.fill('#ai-q','書きかけの質問');await pg.dispatchEvent('#ai-q','input')};
  const state=()=>pg.evaluate(()=>({log:AI_ST.log.filter(m=>!m.intro).length,q:AI_ST.q,box:(document.getElementById('ai-q')||{}).value||'',txt:(document.getElementById('ai-log')||{}).textContent||'',uid:AI_ST.uid}));
  await seed();let s=await state();res('acct','準備：会話と書きかけがある',s.log>=2&&s.q==='書きかけの質問',s);
  /* ほかの人のログイン（本物の onAuthStateChanged の処理） */
  await fbSet(pg,'ui-other',TOKEN2);await pg.waitForTimeout(200);s=await state();
  res('acct','ほかの人がログインしたら会話と書きかけを消す',s.log===0&&s.q===''&&s.box===''&&!/ドラゴン・じめん/.test(s.txt)&&s.uid==='ui-other',s);
  /* ログアウト（acSignOut：本物の手順） */
  await fbSet(pg,'ui-user',TOKEN);await pg.evaluate(()=>{location.hash='#/ai'});await pg.waitForTimeout(300);await seed();
  /* パーティの同期のサーバーはこのテストに無いので、未送信の確かめ（userFlush）だけ「送れた」にする。サインアウト・acForget は本物 */
  await pg.evaluate(async()=>{userFlush=async()=>true;await acSignOut()});await pg.waitForTimeout(200);s=await state();
  res('acct','ログアウトで会話と書きかけを消す',s.log===0&&s.q===''&&s.box===''&&!/ドラゴン・じめん/.test(s.txt),s);
  res('acct','ログアウトのあとはログインを案内',/ログイン/.test(await pg.textContent('#ai-root')));
  /* アカウントの削除（acForget＝削除の手順で呼ばれる） */
  await fbSet(pg,'ui-user',TOKEN);await pg.evaluate(()=>{location.hash='#/ai'});await pg.waitForTimeout(300);await seed();
  await pg.evaluate(()=>{acForget()});await pg.waitForTimeout(100);s=await state();
  res('acct','アカウントの削除で会話と書きかけを消す',s.log===0&&s.q===''&&s.box==='',s);
  /* 待っている答え：答えが届く前にほかの人がログインしたら、その答えは出さない */
  await pg.evaluate(()=>{AI_ST.log=[];aiView()});await pg.waitForTimeout(200);
  let hold;const gate=new Promise(r=>hold=r);
  await pg.unroute('https://pokechan-tap.pokechan.workers.dev/api/ai/**');
  await pg.route('https://pokechan-tap.pokechan.workers.dev/api/ai/**',async r=>{const q=r.request(),hd={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Content-Type':'application/json'};
    if(q.method()==='OPTIONS')return r.fulfill({status:204,headers:hd});
    if(q.method()==='POST')await gate;
    const h={origin:ORIGIN,authorization:q.headers().authorization||''};if(q.method()==='POST')h['content-type']='application/json';
    const x=await w.fetch(new Request(q.url().replace('https://pokechan-tap.pokechan.workers.dev','https://w.example'),{method:q.method(),headers:h,body:q.method()==='POST'?q.postData():undefined}),env,{waitUntil(){}});
    return r.fulfill({status:x.status,headers:hd,body:await x.text()})});
  await pg.fill('#ai-q','ガブリアスの種族値を教えて');await pg.click('#ai-send');await pg.waitForTimeout(150);
  res('acct','準備：答えを待っている',await pg.evaluate(()=>AI_ST.busy&&!!document.querySelector('#ai-log .ai-wait')));
  await fbSet(pg,'ui-other',TOKEN2);hold();await pg.waitForTimeout(500);s=await state();
  res('acct','切りかえたあとに届いた答えは出さない',s.log===0&&!/108/.test(s.txt)&&!(await pg.evaluate(()=>AI_ST.busy)),s);
  res('acct','切りかえたあとも送れる',!(await pg.$eval('#ai-send',b=>b.disabled)));
  await fbSet(pg,'ui-user',TOKEN);await pg.evaluate(()=>{AI_ST.log=[];location.hash='#/ai'});await pg.waitForTimeout(300);
}
/* ---------- キーボードが出ていても、最後の答えとその根拠を入力欄の上まで送れる ---------- */
{ await pg.evaluate(()=>aiView());await pg.waitForTimeout(200);await askUI('ガブリアスのタイプは？');await askUI('ガブリアスの種族値を教えて');
  await pg.focus('#ai-q');await pg.evaluate(()=>aiKbApply(330));await pg.waitForTimeout(100);
  await pg.click('#ai-log .ai-msg.bot:last-child .ai-ev summary');await pg.waitForTimeout(150);
  const g2=await pg.evaluate(()=>{const ev=document.querySelector('#ai-log .ai-msg.bot:last-child .ai-ev'),c=document.querySelector('#ai-comp').getBoundingClientRect();
    ev.scrollIntoView({block:'end'});const e=ev.getBoundingClientRect(),a=[...ev.querySelectorAll('a')].map(x=>{const rs=[...x.getClientRects()],r=rs[0],R=x.getBoundingClientRect();const el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return{top:R.top,bot:R.bottom,hit:el===x||x.contains(el)}});
    const c2=document.querySelector('#ai-comp').getBoundingClientRect();return{evBot:e.bottom,evTop:e.top,compTop:c2.top,compBot:c2.bottom,kbTop:innerHeight-330,links:a,open:ev.open}});
  res('kb','キーボードが出ていても根拠の下まで入力欄の上に見える',g2.open&&g2.evBot<=g2.compTop+1&&g2.compBot<=g2.kbTop+1,g2);
  res('kb','根拠のリンクを押せる（入力欄・キーボードに隠れない）',g2.links.length>0&&g2.links.every(l=>l.hit&&l.bot<=g2.compTop),g2.links);
  await shot('390-keyboard-evidence');
  const top=await pg.evaluate(()=>{const m=document.querySelector('#ai-log .ai-msg.bot:last-child');m.scrollIntoView({block:'start'});return{top:m.getBoundingClientRect().top,hd:document.getElementById('hdr').getBoundingClientRect().bottom}});
  res('kb','答えの上の端まで戻って読める（見出しに隠れない）',top.top>=top.hd-1&&top.top<260,top);
  await pg.evaluate(()=>aiKbApply(0));await pg.locator('#ai-q').blur();
}
/* ---------- 返ってきた文字は文字として出す（HTML にしない） ---------- */
inject={status:'answered',scope:{gameId:'pokechamp',format:'single'},cards:[{templateId:'species_types',slots:{name:'<img src=x onerror="window.__x=1">',types:['<b>x</b>']},evidenceIds:['e1'],verificationStatus:'ingame'}],
  evidence:[{evidenceId:'e1',field:'types',sourceType:'ingame',source:{name:'<script>window.__y=1</script>',refs:[{name:'bad',url:'javascript:alert(1)'},{name:'ok',url:'https://pokeapi.co/'}]},checkedAt:'2026-10-19'}]};
await askUI('ガブリアスのタイプは？');await pg.waitForTimeout(200);
res('ui','返ってきた文字は HTML にしない・javascript: のリンクは出さない',!(await pg.evaluate(()=>window.__x||window.__y))&&!(await pg.$('#ai-log img'))&&(await pg.$$eval('.ai-ev a',as=>as.map(a=>a.href))).every(h=>h.startsWith('https://')));
inject=null;
/* ---------- 見た目（スマホ・PC）：はみ出しなし ---------- */
for(const vp of [{width:390,height:844},{width:1280,height:900}]){
  await pg.setViewportSize(vp);await pg.evaluate(()=>{AI_ST.log=[];aiView()});await pg.waitForTimeout(400);await askUI('ガブリアスの種族値を教えて');await askUI('ガブリアスのタイプは？');
  res('ui','横にはみ出さない '+vp.width,await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.body.scrollWidth<=innerWidth+1));
  if(vp.width>=700){const d=await pg.evaluate(()=>{const c=document.querySelector('#ai-comp').getBoundingClientRect();return{bot:c.bottom,h:innerHeight}});res('ui','PC：入力欄は画面の下に見える',d.bot<=d.h&&d.bot>d.h-80,d)}
  await shot(vp.width+'-chat');
}
res('ui','画面のエラーなし',!errs.length,errs);
res('ui','外部への送信 0 件',OUT.length===0,OUT);
await ctx.close();await b.close();
for(const [k,v] of Object.entries(R))console.log(`  ${k}: ${v.ok}/${v.n}`);
const tot=Object.values(R).reduce((a,v)=>a+v.n,0);
fs.writeFileSync(path.join(ROOT,'tests/out/ai-ui-results.json'),JSON.stringify({total:tot,bad,suites:R,shots:SHOTS},null,1));
console.log(bad?`ai-ui: NG（${bad}件 / ${tot}項目）`:`ai-ui: OK（${tot}項目）`);if(bad)process.exitCode=1;
