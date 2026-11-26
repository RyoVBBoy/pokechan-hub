// Game Kid/s AI（Stage A）：本物の D1 互換の実行環境（Miniflare＝workerd と D1 の実装）で、同時の受付が上限を超えないかを確かめる。
// Miniflare は npm audit の指摘（sharp・undici）があるため package.json には入れない。別の場所に入れて MINIFLARE_DIR で指す：
//   mkdir -p /tmp/mf && (cd /tmp/mf && npm init -y && npm i miniflare@4.20260730.0)
//   python3 worker/build.py && MINIFLARE_DIR=/tmp/mf node tests/ai-d1.mjs
// 入っていなければ「未実行」と書いて失敗で終える（合格にしない）。
import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import {ROOT,ORIGIN,PID,makeSigner,migrationStatements,baseEnv,rid} from './ai-helpers.mjs';
const dir=process.env.MINIFLARE_DIR;
let Miniflare;
try{Miniflare=createRequire(path.join(dir||'/nonexistent','index.js'))('miniflare').Miniflare}catch(e){console.error('ai-d1: 未実行（MINIFLARE_DIR に miniflare がありません）。このテストは合格扱いにしません');process.exit(2)}
const S=await makeSigner();
const OUT=[];
let bad=0,n=0;const res=(name,cond,info)=>{n++;if(!cond){bad++;console.error('NG',name,info!==undefined?JSON.stringify(info).slice(0,500):'')}else console.log('  ok',name)};
async function mk(o={}){
  const mf=new Miniflare({modules:true,scriptPath:path.join(ROOT,'worker/dist/worker.js'),compatibilityDate:'2025-06-01',d1Databases:['AI_DB','DB'],
    bindings:baseEnv({AI_RL_USER_MIN:'100000',AI_RL_IP_MIN:'100000',AI_RL_GLOBAL_MIN:'100000',AI_FREE_DAY:'100000',AI_FREE_MONTH:'100000',...o}),
    outboundService:req=>{if(req.url.includes('securetoken@system.gserviceaccount.com'))return new Response(JSON.stringify({keys:[S.jwk]}),{headers:{'content-type':'application/json'}});OUT.push(req.url);return new Response('blocked',{status:599})}});
  const ai=await mf.getD1Database('AI_DB');
  for(const s of migrationStatements())await ai.prepare(s).run();
  return{mf,ai};
}
const toks=new Map();const tok=async u=>{if(!toks.has(u))toks.set(u,await S.sign(u));return toks.get(u)};
async function ask(mf,uid,o={}){
  const r=await mf.dispatchFetch('https://w.example/api/ai/v1/answer',{method:'POST',headers:{origin:ORIGIN,authorization:'Bearer '+await tok(uid),'content-type':'application/json','cf-connecting-ip':o.ip||'203.0.113.'+(uid.length%200)},
    body:JSON.stringify({gameId:'pokechamp',format:'single',question:o.q||'ガブリアスのタイプは？',requestId:o.rid||rid()})});
  return{st:r.status,j:await r.json().catch(()=>({}))};
}
const hash=async(uid)=>{const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(baseEnv().AI_HASH_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode('u|'+uid)))].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,40)};
const N=50;
/* 1) 同じ人が同時に50件：同時1件なので1件だけ */
{ const {mf,ai}=await mk({AI_MOCK_DELAY_MS:'1500'});
  const rr=await Promise.all(Array.from({length:N},()=>ask(mf,'same-user')));
  const ok=rr.filter(x=>x.st===200&&x.j.status==='answered').length,conc=rr.filter(x=>x.st===429&&x.j.reasonCode==='quota_concurrent').length;
  /* 「同時1件」＝処理中の期間（予約〜完了）が重ならないこと。先の1件が終わったあとに届いたものは受け付けてよい */
  const iv=(await ai.prepare(`SELECT created_at a,updated_at b,state FROM ai_requests ORDER BY created_at`).all()).results;
  const overlap=iv.some((x,i)=>i>0&&x.a<iv[i-1].b);
  res('同じ人の同時50件 → 処理中は1件だけ（期間が重ならない）・ほかは同時の上限',ok>=1&&ok+conc===N&&!overlap&&iv.length===ok&&iv.every(x=>x.state==='done'),{ok,conc,iv,codes:[...new Set(rr.map(x=>x.st+':'+x.j.reasonCode))]});
  await mf.dispose()}
/* 2) 同じ受付IDを同時に50件：推論は1回・数えるのも1回 */
{ const {mf,ai}=await mk({AI_MOCK_DELAY_MS:'400'});const id=rid('dup');
  const rr=await Promise.all(Array.from({length:N},()=>ask(mf,'dup-user',{rid:id})));
  const rows=await ai.prepare(`SELECT COUNT(*) c,SUM(consumed) s FROM ai_requests`).first();
  const kinds=rr.map(x=>x.st===200&&x.j.status==='answered'?(x.j.replayed?'replay':'answer'):x.j.reasonCode);
  res('同じ受付IDの同時50件 → 推論1回・消費1回（ほかは処理中か同じ答え）',rows.c===1&&rows.s===1&&kinds.filter(k=>k==='answer').length===1&&kinds.every(k=>['answer','replay','duplicate_in_progress'].includes(k)),{rows,kinds:[...new Set(kinds)]});
  await mf.dispose()}
/* 3) 50人が同時：全体の費用の上限（最大費用10件分）→ ちょうど10件 */
{ const max=450;const {mf,ai}=await mk({AI_MOCK_DELAY_MS:'1500',AI_BUDGET_MICRO:String(max*10)});
  const rr=await Promise.all(Array.from({length:N},(_,i)=>ask(mf,'budget-'+i)));
  const ok=rr.filter(x=>x.st===200).length,stop=rr.filter(x=>x.st===503&&x.j.reasonCode==='budget_exhausted').length;
  const sum=(await ai.prepare(`SELECT COALESCE(SUM(cost_micro),0) s FROM ai_requests`).first());
  /* 受け付けた各時点で「処理中は最大費用・完了は実際の費用」の合計が予算以内（終わった分の差額で後から入れるのはよい） */
  const iv=(await ai.prepare(`SELECT created_at a,updated_at b,max_micro m,cost_micro c FROM ai_requests ORDER BY created_at`).all()).results;
  const peak=Math.max(...iv.map(x=>iv.reduce((s,y)=>s+(y.a<=x.a?(x.a<y.b?y.m:y.c):0),0)));
  const first=iv.filter(x=>x.a<iv[0].b).length;
  res('50人の同時 → 受け付けた時点の費用の合計が予算以内・最初に重なったのは10件',ok>=10&&ok+stop===N&&peak<=max*10&&first===10&&sum.s<=max*10,{ok,stop,peak,first,sum});
  await mf.dispose()}
/* 4) 50人が同時：全体の1分あたりの上限20件 → ちょうど20件 */
{ const {mf,ai}=await mk({AI_MOCK_DELAY_MS:'200',AI_RL_GLOBAL_MIN:'20'});
  const rr=await Promise.all(Array.from({length:N},(_,i)=>ask(mf,'rate-'+i)));
  const ok=rr.filter(x=>x.st===200).length,lim=rr.filter(x=>x.st===429&&x.j.reasonCode==='rate_global').length;
  const cnt=(await ai.prepare(`SELECT MAX(n) n FROM ai_rate WHERE k='g'`).first()).n;
  res('50人の同時 → 全体の頻度の上限20件',ok===20&&lim===30&&cnt===20,{ok,lim,cnt});
  await mf.dispose()}
/* 5) 1日の上限：4回使った人が同時に50件 → 1件だけ（5回目）、そのあとの50件は0件 */
{ const {mf,ai}=await mk({AI_MOCK_DELAY_MS:'100',AI_FREE_DAY:'5',AI_FREE_MONTH:'30'});
  for(let i=0;i<4;i++){const r=await ask(mf,'daily');if(r.st!==200)res('準備',false,r)}
  const r1=await Promise.all(Array.from({length:N},()=>ask(mf,'daily')));
  const r2=await Promise.all(Array.from({length:N},()=>ask(mf,'daily')));
  const used=(await ai.prepare(`SELECT COUNT(*) c FROM ai_requests WHERE consumed=1`).first()).c;
  res('1日の上限 → 同時でも5回まで',r1.filter(x=>x.st===200).length===1&&r2.filter(x=>x.st===200).length===0&&r2.every(x=>x.st===429)&&r2.some(x=>x.j.reasonCode==='quota_day')&&used===5,{a:r1.filter(x=>x.st===200).length,b:r2.filter(x=>x.st===200).length,used});
  await mf.dispose()}
/* 6) 本物の D1 でトリガー・CHECK が効く／失敗は消費しない／期限切れの回収 */
{ const {mf,ai}=await mk({AI_MOCK_MODE:'error'});
  const r=await ask(mf,'fail-user');const row=await ai.prepare(`SELECT state,consumed,cost_micro,cost_final FROM ai_requests`).first();
  res('提供元の失敗 → 消費しない（本物の D1）',r.st===503&&row.state==='done'&&row.consumed===0,{r,row});
  let t=false;try{await ai.prepare(`UPDATE ai_requests SET state='reserved'`).run()}catch(e){t=/ai_bad_transition/.test(String(e.message))}res('状態を戻すトリガー（本物の D1）',t);
  t=false;try{await ai.prepare(`UPDATE ai_requests SET cost_micro=cost_micro+1`).run()}catch(e){t=/ai_cost_increase|CHECK/.test(String(e.message))}res('費用を増やさない（本物の D1）',t);
  const h=await hash('stuck');const old=Date.now()-120000;
  await ai.prepare(`INSERT INTO ai_requests(uid_h,rid,in_h,plan,day,month,state,consumed,max_micro,cost_micro,provider,model,price_id,created_at,updated_at) VALUES(?,'s1','x','free',?,?,'sent',0,450,450,'mock','mock-plan-1','mock-test-1',?,?)`)
    .bind(h,new Date(old+9*36e5).toISOString().slice(0,10),new Date(old+9*36e5).toISOString().slice(0,7),old,old).run();
  await mf.dispose();
  const m2=await mk({});await m2.ai.prepare(`INSERT INTO ai_requests(uid_h,rid,in_h,plan,day,month,state,consumed,max_micro,cost_micro,provider,model,price_id,created_at,updated_at) VALUES(?,'s1','x','free',?,?,'sent',0,450,450,'mock','mock-plan-1','mock-test-1',?,?)`)
    .bind(h,new Date(old+9*36e5).toISOString().slice(0,10),new Date(old+9*36e5).toISOString().slice(0,7),old,old).run();
  const r2=await ask(m2.mf,'stuck');const s1=await m2.ai.prepare(`SELECT state,cost_micro FROM ai_requests WHERE rid='s1'`).first();
  res('送ったまま止まった受付は期限切れで回収（費用は保持）、本人はまた使える',r2.st===200&&s1.state==='expired'&&s1.cost_micro===450,{r2:r2.st,s1});
  await m2.mf.dispose()}
/* 7) 退会（既存の /api/me/delete）で AI の枠が消える（本物の D1） */
{ const {mf,ai}=await mk({});
  await ask(mf,'leaver');
  const r=await mf.dispatchFetch('https://w.example/api/me/delete',{method:'POST',headers:{origin:'https://game-kids.app',authorization:'Bearer '+await tok('leaver'),'content-type':'application/json'},body:'{}'});
  const h=await hash('leaver');const left=(await ai.prepare(`SELECT COUNT(*) c FROM ai_requests WHERE uid_h=?`).bind(h).first()).c,arc=(await ai.prepare(`SELECT COALESCE(SUM(micro),0) s FROM ai_cost_archive`).first()).s;
  res('退会で AI の枠を消し、匿名の費用は残す（本物の D1）',r.status===200&&left===0&&arc>0,{st:r.status,left,arc});
  await mf.dispose()}
/* 7) B1：会話の状態（同じ受付は1回だけ・6ターンまで）と、2回目の呼び出しの予約が同時でも予算を超えないこと（本物の D1） */
{ globalThis.caches=globalThis.caches||{default:{match:async()=>null,put:async()=>{}}};
  const A=(await import(path.join(ROOT,'worker/dist/worker_test.js'))).__ai;
  const {seedB1}=await import('./ai-b1-fixture.mjs');
  const b1=async(mf,uid,q,o={})=>{const r=await mf.dispatchFetch('https://w.example/api/ai/v1/answer',{method:'POST',headers:{origin:ORIGIN,authorization:'Bearer '+await tok(uid),'content-type':'application/json','cf-connecting-ip':'203.0.113.'+(uid.length%200)},
    body:JSON.stringify({gameId:'pokechamp',format:'double',question:q,requestId:o.rid||rid(),...(o.conv?{conversationId:o.conv}:{})})});return{st:r.status,j:await r.json().catch(()=>({}))}};
  { const {mf,ai}=await mk({AI_B1_ENABLED:'1'});await seedB1({DB:await mf.getD1Database('DB')},null,A);
    const sv=(await ai.prepare(`SELECT v FROM ai_meta WHERE k='schema'`).first()).v;
    const id=rid();const a=await b1(mf,'conv-user','今オススメのパーティ教えて',{rid:id}),a2=await b1(mf,'conv-user','今オススメのパーティ教えて',{rid:id});
    const t1=(await ai.prepare(`SELECT turns FROM ai_conv WHERE id=?`).bind(a.j.conversationId||'').first()||{}).turns;
    const st=[];for(let i=0;i<7;i++){const r=await b1(mf,'conv-user','サイクル寄りにして',{conv:a.j.conversationId});st.push(r.j.reasonCode||r.j.status)}
    const t2=(await ai.prepare(`SELECT turns FROM ai_conv WHERE id=?`).bind(a.j.conversationId||'').first()||{}).turns;
    res('B1：移行0002（schema 2）・候補3件・同じ受付は会話を1回だけ進める（本物の D1）',sv==='2'&&a.st===200&&(a.j.cards||[]).some(c=>c.templateId==='team_candidates'&&c.slots.candidates.length===3)&&a2.j.replayed&&t1===1,{sv,st:a.st,t1,re:a2.j.replayed});
    res('B1：会話は6ターンまで（そのあとは新しい相談を案内）',t2===6&&st.slice(5).every(x=>x==='conversation_full')&&st.slice(0,5).every(x=>x!=='conversation_full'),{t2,st});
    await mf.dispose()}
  { const {mf,ai}=await mk({AI_B1_ENABLED:'1',AI_MOCK_DELAY_MS:'300'});await seedB1({DB:await mf.getD1Database('DB')},null,A);
    const p=await ai.prepare(`SELECT in_per_m,out_per_m FROM ai_prices WHERE provider='mock' ORDER BY valid_from DESC`).first(),max=A.aiCost(p,A.AI_LIMITS.maxInputTokens,A.AI_LIMITS.maxOutputTokens);
    /* 処理中（sent）の50件が同時に2回目の予約を足す：予算は 1回目50件＋20件ぶん → ちょうど20件だけ入る */
    const mon=A.aiMonth(Date.now()),day=A.aiDay(Date.now());
    for(let i=0;i<N;i++)await ai.prepare(`INSERT INTO ai_requests(uid_h,rid,in_h,plan,day,month,state,consumed,max_micro,cost_micro,provider,model,price_id,created_at,updated_at) VALUES(?,?,'h','free',?,?,'sent',0,?,?,'mock','mock-plan-1','p',1,1)`).bind('U'+i,'r'+i,day,mon,max,max).run();
    const got=await Promise.all(Array.from({length:N},(_,i)=>A.aiReserveMore(ai,'U'+i,'r'+i,max,max*70,mon)));
    const sum=(await ai.prepare(`SELECT SUM(cost_micro) s FROM ai_requests WHERE month=?`).bind(mon).first()).s;
    res('B1：同時50件の2回目の予約は予算の範囲だけ（ちょうど20件・合計は予算以内）',got.filter(Boolean).length===20&&sum<=max*70,{ok:got.filter(Boolean).length,sum,budget:max*70});
    await mf.dispose()}
}
res('外部への送信 0 件',OUT.length===0,OUT);
fs.mkdirSync(path.join(ROOT,'tests/out'),{recursive:true});fs.writeFileSync(path.join(ROOT,'tests/out/ai-d1-results.json'),JSON.stringify({n,bad,parallel:N,runtime:'miniflare (workerd + D1)'},null,1));
console.log(bad?`ai-d1: NG（${bad}件 / ${n}項目）`:`ai-d1: OK（${n}項目・同時${N}件）`);if(bad)process.exitCode=1;
