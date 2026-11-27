// Stage B1 の独立評価（tests/ai-eval/stage-b1-acceptance.json の通常60件）を、手元の Worker のコードに流す。
// 期待値（outcome・invariant）は書きかえない。ここでは、setup の名前を具体的なフィクスチャ・前のターンに、outcome をこの実装の応答の形に対応づけるだけ。
// fair_play の28件は tests/ai-eval-fair-play.mjs（そのまま使う）。
// 1件（reliability-11：アカウントの切りかえ直後の遅い応答を画面に出さない）は画面の動きなので tests/ai-b1-ui.mjs で確かめる（ここでは数えない）。
import fs from 'node:fs';
import path from 'node:path';
import {makeD1} from './d1mock.mjs';
import {ROOT,ORIGIN,makeSigner,migrate,baseEnv,rid} from './ai-helpers.mjs';
import {TEAMS,EXTRA,seedB1} from './ai-b1-fixture.mjs';
const S=await makeSigner();
const OUT=[];let OAI_FN=null;
globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
globalThis.fetch=async(u,init)=>{u=String(u);
  if(u.includes('securetoken@system.gserviceaccount.com'))return new Response(JSON.stringify({keys:[S.jwk]}));
  if(u==='https://api.openai.com/v1/responses'&&OAI_FN)return OAI_FN(JSON.parse(init.body));
  OUT.push(u);throw new Error('外部への送信は禁止: '+u)};
const mod=await import(path.join(ROOT,'worker/dist/worker_test.js'));
const w=mod.default,A=mod.__ai;
const FX=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/ai-eval/stage-b1-acceptance.json'),'utf8'));
const CASES=FX.cases.filter(c=>c.group!=='fair_play');
if(CASES.length!==60)throw new Error('通常の独立評価は60件のはず: '+CASES.length);
/* 提供元に渡した入力（登録者・コメント・証拠を送っていないかを見る） */
const SEEN=[];const gp0=A.MockProvider.generatePlan;A.MockProvider.generatePlan=async function(i,...r){SEEN.push(JSON.stringify(i));return gp0.call(this,i,...r)};
const ALL=[...new Set(Object.values({...TEAMS,...EXTRA}).flatMap(t=>t.team.map(m=>m.no)).concat([10034,10035,10039,10046,10058,10281]))];
const RS=(seasons,id='rs-accept-1')=>({id,game:'pokechamp',formats:['single','double'],start:'2000-01-01T00:00:00+09:00',end:'2100-01-01T00:00:00+09:00',legalComplete:true,seasons,legal:ALL,officialUrl:'https://www.pokemonchampions.jp/ja/news/',checkedAt:'2026-11-26'});
const tokens=new Map();const tok=async u=>{if(!tokens.has(u))tokens.set(u,await S.sign(u));return tokens.get(u)};
async function mkEnv(o={},seed={}){const AI=makeD1();await migrate(AI);const DB=makeD1();
  const env=baseEnv({AI_DB:AI,DB,AI_B1_ENABLED:'1',AI_RL_USER_MIN:'1000',AI_RL_IP_MIN:'1000',...o});
  env.__ids=await seedB1(env,seed.kind||null,A,{extra:true,...(seed.only?{only:seed.only}:{})});return env}
async function ask(env,q,o={}){
  const body={gameId:'pokechamp',question:q,requestId:o.rid||rid('acc'),...(o.fmt?{format:o.fmt}:{}),...(o.conv?{conversationId:o.conv}:{})};
  const r=await w.fetch(new Request('https://w.example/api/ai/v1/answer',{method:'POST',headers:{origin:ORIGIN,authorization:'Bearer '+await tok(o.uid||'acc-user'),'content-type':'application/json'},body:JSON.stringify(body)}),env,{waitUntil(){}});
  return{st:r.status,j:await r.json().catch(()=>({}))};
}
const consumed=async(env,uid='acc-user')=>{const h=await A.aiHmac(env,'u|'+uid);return (await env.AI_DB.prepare(`SELECT COUNT(*) c FROM ai_requests WHERE uid_h=? AND consumed=1`).bind(h).first()).c};
const preload=async(env,n,{day,month}={},uid='acc-user')=>{const h=await A.aiHmac(env,'u|'+uid),now=Date.now();
  for(let i=0;i<n;i++)await env.AI_DB.prepare(`INSERT INTO ai_requests(uid_h,rid,in_h,plan,day,month,state,consumed,max_micro,cost_micro,provider,model,price_id,created_at,updated_at) VALUES(?,?,'h','free',?,?,'done',1,450,1,'mock','mock-plan-1','mock-test-1',?,?)`)
    .bind(h,'pre'+i,day||A.aiDay(now),month||A.aiMonth(now),now-1000,now-1000).run()};

/* setup → 環境と前のターン。戻り値 {env, conv, before(env)}。前のターンの答えは検査しない（最後の質問だけを採点） */
const SETUP={
  current_verified:async()=>({rs:RS([12])}),
  no_matching_team:async()=>({rs:RS([12]),seed:{only:['D2','D3','D5','SG1','SG2']}}),
  await_format:async()=>({rs:RS([12]),turns:[['今オススメのパーティ教えて',null]]}),
  two_candidates:async()=>({rs:RS([12]),turns:[['ダブルのトリルのおすすめのパーティ','double']]}),
  double_context:async()=>({rs:RS([12]),turns:[['ダブルのおすすめのパーティ','double']]}),
  missing_history:async()=>({rs:RS([12])}),
  garchomp_required:async()=>({rs:RS([12]),turns:[['ダブルでガブリアスは固定','double']]}),
  charizard_y_locked:async()=>({rs:RS([12]),turns:[['ダブルでメガリザードンYは残したい','double']]}),
  ruleset_rotated:async()=>({rs:RS([12]),turns:[['ダブルのおすすめのパーティ','double']],between:()=>{A.AI_RULESETS.length=0;A.AI_RULESETS.push(RS([12],'rs-accept-2'))}}),
  expired_context:async()=>({rs:RS([12]),turns:[['ダブルのおすすめのパーティ','double']],between:async(env,conv)=>{await env.AI_DB.prepare(`UPDATE ai_conv SET expires_at=1 WHERE id=?`).bind(conv).run()}}),
  duplicate_request:async()=>({rs:RS([12]),turns:[['ダブルのおすすめのパーティ','double']],dup:true}),
  no_official_ruleset:async()=>({rs:null}),
  only_previous_ruleset:async()=>({rs:RS([99])}),
  no_public_verified_team:async()=>({rs:RS([12]),seed:{only:['L_priv','L_only','L_foll','L_ban','L_hidden','L_auto','L_self','L_stale','L_oper','L_game','L_five']}}),
  private_top:async()=>({rs:RS([12])}),
  restricted_profiles:async()=>({rs:RS([12])}),
  hidden_or_banned:async()=>({rs:RS([12])}),
  unverified_only:async()=>({rs:RS([12]),seed:{only:['L_auto','L_self','L_stale','L_oper']}}),
  illegal_or_unknown_sets:async()=>({rs:RS([12])}),
  usage_only:async()=>({rs:RS([12]),seed:{kind:'empty'}}),
  stale_or_conflicting:async()=>({rs:RS([12]),seed:{only:['L_stale']}}),
  unknown_candidate:async()=>({rs:RS([12]),env:{AI_MOCK_MODE:'bad_ids'}}),
  provider_refusal:async()=>({rs:RS([12]),openai:()=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'no'}]}],usage:{input_tokens:5,output_tokens:1}}))}),
  uncertain_provider_outcome:async()=>({rs:RS([12]),env:{AI_MOCK_MODE:'usage_unknown'}}),
  halt_enabled:async()=>({rs:RS([12]),pre:async env=>{await env.AI_DB.prepare(`INSERT INTO ai_halt(k,reason,until,at) VALUES('halt','manual_test',?,?)`).bind(Date.now()+36e5,Date.now()).run()}}),
  budget_exhausted:async()=>({rs:RS([12]),env:{AI_BUDGET_MICRO:'10'}}),
  daily_limit:async()=>({rs:RS([12]),pre:env=>preload(env,5)}),
  monthly_limit:async()=>({rs:RS([12]),pre:env=>{const d=new Date(Date.now()+9*36e5);const first=A.aiMonth(Date.now())+'-01';return preload(env,30,{day:first===A.aiDay(Date.now())?'1999-01-01':first})}}),
  one_answer_remaining:async()=>({rs:RS([12]),pre:env=>preload(env,4)}),
  parallel_duplicate:async()=>({rs:RS([12]),turns:[['ダブルのおすすめのパーティ','double']],parallel:true}),
  foreign_context:async()=>({rs:RS([12]),turns:[['ダブルのおすすめのパーティ','double','other-user']]}),
  jst_boundary:async()=>({rs:RS([12]),pre:env=>{const y=A.aiDay(Date.now()-864e5);const sameMonth=y.slice(0,7)===A.aiMonth(Date.now());return preload(env,5,{day:y,month:sameMonth?A.aiMonth(Date.now()):y.slice(0,7)})}})
};
const keyOf=(ids,cid)=>{const id=+String(cid).replace('team:','');return Object.keys(ids).find(k=>ids[k]===id&&!/^S\d$/.test(k))||cid};
/* outcome → この実装の応答の形 */
const OUTCOME={
  ask_format:x=>x.st===200&&x.j.status==='needs_input'&&x.j.reasonCode==='format_missing'&&eqs((x.j.nextAction.choices||[]).map(c=>c.ref),['single','double'])&&x.dq===0,
  answer:x=>x.st===200&&x.cs.length>0&&['answered','partial'].includes(x.j.status)&&x.dq===1,
  partial_or_clarify:x=>x.st===200&&((x.j.status==='needs_input'&&x.dq===0)||(x.j.status==='partial'&&x.cs.length>0)),
  handoff:x=>x.st===200&&!x.cs.length&&!x.num&&['open_tool','open_calc','calc_form','choose'].includes((x.j.nextAction||{}).kind)&&x.dq===0,
  ask_form:x=>x.st===200&&x.j.status==='needs_input'&&x.j.reasonCode==='mega_ambiguous'&&x.dq===0,
  clarify:x=>x.st===200&&x.j.status==='needs_input'&&!x.cs.length&&x.dq===0,
  /* 保留：候補を作らない、または「今の候補」と言わず（どの候補も過去・未確認と書き）保留の理由を出す */
  hold:x=>x.dq===0&&!x.cs.length?true:x.st===200&&x.cs.every(c=>c.ruleset.status!=='current_verified')&&x.holds.length>0,
  hold_or_historical:x=>OUTCOME.hold(x)||(x.st===200&&x.cs.length>0&&x.cs.every(c=>c.ruleset.status==='past_or_unverified')&&x.holds.some(h=>/ruleset_unverified_b1|candidate_season_old/.test(h))),
  hold_or_partial:x=>OUTCOME.hold(x)||(x.st===200&&x.holds.length>0),
  hold_or_revalidate:x=>OUTCOME.hold(x)||(x.st===200&&x.holds.some(h=>h==='ruleset_changed'||h==='data_updated')),
  hold_or_clarify:x=>!x.cs.length&&x.dq===0&&(x.st===200),
  blocked:x=>!x.cs.length&&x.dq===0&&(x.st===503||x.st===200),
  limit:x=>x.st===429&&/^quota_(day|month)$/.test(x.j.reasonCode)&&x.j.resetAt>Date.now()
};
const eqs=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
/* invariant を、確かめられる形で（case id ごと） */
const has=(c,no)=>c.members.some(m=>m.no===no||(m.mega&&false));
const INV={
  'intent-03':x=>x.cs.every(c=>c.fmt==='single'),
  'intent-04':x=>x.cs.every(c=>c.fmt==='double'),
  'intent-05':x=>x.cs.every(c=>c.ruleset.status==='current_verified'&&'style' in c&&c.season&&c.season.name),
  'intent-06':x=>x.holds.includes('beginner_unverified'),
  'intent-09':x=>x.cs.some(c=>c.ruleset.status==='current_verified'),
  'intent-10':x=>!x.cs.length,
  'intent-11':x=>(x.j.nextAction||{}).route==='#/news'&&!x.cs.length,
  'intent-12':x=>!x.num,
  'constraints-01':x=>x.cs.every(c=>c.members.some(m=>m.no===6&&m.mega==='メガリザードンY')),
  'constraints-03':x=>x.cs.every(c=>c.fmt==='single'&&!has(c,149)),
  'constraints-04':x=>x.cs.every(c=>c.members.some(m=>m.mega==='メガリザードンY')&&has(c,445)),
  'constraints-05':x=>x.cs.every(c=>has(c,445)&&!has(c,149)),
  'constraints-06':x=>x.j.reasonCode==='constraint_conflict',
  'constraints-07':x=>x.cs.every(c=>!c.conditions.keep.includes('ガブリアス')&&c.conditions.prefer.includes('ガブリアス'))&&x.cs.some(c=>c.reasons.some(r=>r.id==='prefers')),
  'constraints-08':x=>x.cs.every(c=>has(c,445)&&!c.conditions.drop.includes('ガブリアス')),
  'constraints-09':x=>x.cs.every(c=>c.fmt==='single'&&!has(c,149))&&x.holds.includes('style_unverified'),
  'constraints-10':x=>x.cs.every(c=>c.members.some(m=>m.no===6&&!m.stone)),
  'constraints-11':x=>(x.j.nextAction||{}).route==='#/pair/kd',
  'constraints-12':x=>x.cs.every(c=>has(c,149))&&x.holds.includes('no_guarantee'),
  'followup-01':x=>x.cs.every(c=>c.fmt==='double'),
  'followup-02':x=>x.cs.every(c=>c.members.some(m=>m.mega==='メガリザードンY')),
  'followup-03':x=>x.cs.every(c=>c.style&&c.style.k==='cycle'),
  'followup-04':x=>x.cs.every(c=>c.fmt==='single'),
  'followup-07':x=>x.cs.every(c=>!has(c,445)),
  'followup-08':x=>x.cs.every(c=>c.members.some(m=>m.mega==='メガリザードンY')),
  'followup-09':x=>!x.cs.some(c=>c.ruleset.status==='current_verified'&&!x.holds.includes('ruleset_changed')),
  'followup-10':x=>x.j.reasonCode==='conversation_missing',
  'followup-11':x=>x.j.reasonCode==='game_mismatch',
  'followup-12':x=>x.dupSame&&x.dqTotal<=1,
  'evidence-03':x=>x.j.reasonCode==='no_verified_teams',
  'evidence-04':x=>!x.keys.includes('L_priv'),
  'evidence-05':x=>!x.keys.some(k=>k==='L_only'||k==='L_foll'),
  'evidence-06':x=>!x.keys.some(k=>k==='L_ban'||k==='L_hidden'),
  'evidence-07':x=>x.j.reasonCode==='no_verified_teams',
  'evidence-08':x=>!x.keys.includes('DX')&&x.holds.includes('sets_not_shown'),
  'evidence-09':x=>!/勝率[0-9０-９]|[0-9]+%の勝率/.test(JSON.stringify(x.j.cards||[])),
  'evidence-10':x=>!x.keys.includes('L_stale'),
  'evidence-11':x=>x.cs.every(c=>c.season&&c.fmt&&c.source.route)&&(x.j.evidence||[]).every(e=>e.sourceType==='site_verified'&&e.validFrom),
  'evidence-12':x=>!/proof-|player-|コメント（AI/.test(JSON.stringify(x.j))&&!SEEN.some(s=>/proof-|player-|コメント（AI/.test(s))&&x.holds.includes('proof_not_shown'),
  'reliability-01':x=>x.j.reasonCode==='plan_invalid',
  'reliability-02':x=>x.st===503&&x.j.reasonCode==='provider_unavailable',
  'reliability-03':x=>x.row&&x.row.cost_micro===x.row.max_micro&&!x.row.consumed,
  'reliability-04':x=>x.st===503&&x.j.reasonCode==='ai_halted'&&x.calls===0,
  'reliability-05':x=>x.st===503&&x.j.reasonCode==='budget_exhausted'&&x.calls===0,
  'reliability-06':x=>x.j.reasonCode==='quota_day'&&x.j.resetAt===A.aiResets(Date.now()).day,
  'reliability-07':x=>x.j.reasonCode==='quota_month'&&x.j.resetAt===A.aiResets(Date.now()).month,
  'reliability-09':x=>x.dqTotal<=1&&x.parOk,
  'reliability-10':x=>x.j.conversationId!==x.foreignConv,
  'reliability-12':x=>x.j.usage&&x.j.usage.day.used===1
};
const UI_ONLY=new Set(['reliability-11']);
let bad=0;const by={};
for(const c of CASES){
  const g=by[c.group]=by[c.group]||{n:0,ok:0};
  if(UI_ONLY.has(c.id)){g.ui=(g.ui||0)+1;continue}
  g.n++;
  const sp=await SETUP[c.setup]();
  A.AI_RULESETS.length=0;if(sp.rs)A.AI_RULESETS.push(sp.rs);
  const env=await mkEnv(sp.env||{},sp.seed||{}),ids=env.__ids;
  if(sp.openai){Object.assign(env,{AI_PROVIDER:'openai',AI_OPENAI_APPROVED:'1',AI_FREE_TEXT_APPROVED:'1',OPENAI_API_KEY:'sk-test',AI_OPENAI_MODEL:'test-model-1'});
    await env.AI_DB.prepare(`INSERT INTO ai_prices(id,provider,model,in_per_m,out_per_m,valid_from,valid_to) VALUES('oai','openai','test-model-1',1000000,4000000,0,NULL)`).run();OAI_FN=sp.openai}
  if(sp.pre)await sp.pre(env);
  let conv=null,foreignConv=null;
  for(const [q,f,u] of sp.turns||[]){const r=await ask(env,q,{fmt:f,uid:u,conv});conv=r.j.conversationId||conv;if(u)foreignConv=conv}
  if(sp.between)await sp.between(env,conv);
  SEEN.length=0;let calls0=SEEN.length;
  const q=c.question,d0=await consumed(env),fmt=null;
  let r,dupSame=true,parOk=true;
  if(sp.dup||sp.parallel){const id=rid('dup');
    const rr=sp.parallel?await Promise.all([ask(env,q,{rid:id,conv}),ask(env,q,{rid:id,conv})]):[await ask(env,q,{rid:id,conv}),await ask(env,q,{rid:id,conv})];
    r=rr.find(x=>(x.j.cards||[]).some(k=>k.templateId==='team_candidates'))||rr[0];
    dupSame=JSON.stringify((rr[0].j.cards||[]))===JSON.stringify((rr[1].j.cards||[]));
    parOk=rr.every(x=>x.st===200);
  }else r=await ask(env,q,{conv});
  OAI_FN=null;
  const d1=await consumed(env);
  const card=(r.j.cards||[]).find(k=>k.templateId==='team_candidates'),cs=card?card.slots.candidates:[];
  const x={st:r.st,j:r.j,cs,keys:cs.map(cc=>keyOf(ids,cc.cid)),holds:(r.j.cards||[]).filter(k=>k.templateId==='hold').map(k=>k.slots.reasonCode),
    dq:d1-d0,dqTotal:d1-d0,dupSame,parOk,foreignConv,calls:SEEN.length-calls0,num:(r.j.cards||[]).some(k=>k.templateId==='damage_calc')};
  if(c.setup==='uncertain_provider_outcome'){const h=await A.aiHmac(env,'u|acc-user');x.row=await env.AI_DB.prepare(`SELECT cost_micro,max_micro,consumed FROM ai_requests WHERE uid_h=? ORDER BY created_at DESC LIMIT 1`).bind(h).first()}
  const why=[];
  const f0=OUTCOME[c.expect.outcome];
  if(!f0)why.push('対応のない outcome '+c.expect.outcome);else if(!f0(x))why.push(`outcome ${c.expect.outcome} に合わない：${r.st} ${r.j.status}/${r.j.reasonCode} 候補${JSON.stringify(x.keys)} 保留${JSON.stringify(x.holds)} 枠+${x.dq}`);
  if(INV[c.id]&&!INV[c.id](x))why.push('invariant「'+c.expect.invariant+'」：'+JSON.stringify({keys:x.keys,holds:x.holds,rc:r.j.reasonCode,cond:cs[0]&&cs[0].conditions,dq:x.dq}).slice(0,300));
  if(why.length){bad++;console.error('NG',c.id,why.join(' / '))}else g.ok++;
}
A.AI_RULESETS.length=0;A.MockProvider.generatePlan=gp0;
let n=0,ok=0,ui=0;for(const [k,g] of Object.entries(by)){console.log(`  ${k}: ${g.ok}/${g.n}${g.ui?`（ほか ${g.ui}件は画面のテスト ai-b1-ui.mjs）`:''}`);n+=g.n;ok+=g.ok;ui+=g.ui||0}
if(OUT.length){bad++;console.error('NG 外部への送信',OUT)}
console.log(bad?`ai-eval-b1-acceptance: NG（${bad}件 / ${n}件）`:`ai-eval-b1-acceptance: OK（${ok}/${n}件・画面で確かめる ${ui}件・外部への送信 0件）`);
process.exit(bad?1:0);
