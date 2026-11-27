// Game Kid/s AI Stage B1 のテスト（docs/ai/stage-b-conversation-spec.md の B1）。
// 1) 固定評価 tests/ai-eval/b1-v1.json（あいまいな短い質問・組み合わせの条件・続きの質問・新しさ／出どころ／使えるか・分離／失敗／利用枠）
// 2) OpenAI の構造化出力アダプター（HTTP はまねる。本物の送信は1件もしない）
// 外部への送信：api.openai.com はこのファイルのまねだけが答える。それ以外は数えて失敗させる。
import fs from 'node:fs';
import path from 'node:path';
import {makeD1} from './d1mock.mjs';
import {ROOT,ORIGIN,PID,makeSigner,migrate,baseEnv,rid} from './ai-helpers.mjs';
import {TEAMS,seedB1} from './ai-b1-fixture.mjs';
const S=await makeSigner();
const OUT=[],OAI=[];let OAI_FN=null;
globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
globalThis.fetch=async(u,init)=>{u=String(u);
  if(u.includes('securetoken@system.gserviceaccount.com'))return new Response(JSON.stringify({keys:[S.jwk]}));
  if(u==='https://api.openai.com/v1/responses'&&OAI_FN){const b=JSON.parse(init.body);OAI.push({url:u,init,body:b});return OAI_FN(b,init)}
  OUT.push(u);throw new Error('外部への送信は禁止: '+u)};
const mod=await import(path.join(ROOT,'worker/dist/worker_test.js'));
const w=mod.default,A=mod.__ai;
const EV=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/ai-eval/b1-v1.json'),'utf8'));
const only=process.argv.includes('--eval-only');

/* ---------- 環境と呼び出し ---------- */
const users=new Map();
const tok=async u=>{if(!users.has(u))users.set(u,await S.sign(u));return users.get(u)};
async function mkEnv(o={},kind){
  const AI=makeD1();await migrate(AI);const DB=makeD1();
  const env=baseEnv({AI_DB:AI,DB,AI_B1_ENABLED:'1',AI_FREE_DAY:'100000',AI_FREE_MONTH:'100000',AI_RL_USER_MIN:'100000',AI_RL_IP_MIN:'100000',AI_RL_GLOBAL_MIN:'100000',...o});
  for(const [k,v] of Object.entries(o))if(v==='')delete env[k];
  env.__ids=await seedB1(env,kind,A);return env;
}
async function ask(env,question,o={}){
  const body={gameId:o.game||'pokechamp',question,requestId:o.rid||rid('b1')};
  if(o.fmt)body.format=o.fmt;if(o.conv)body.conversationId=o.conv;
  const r=await w.fetch(new Request('https://w.example/api/ai/v1/answer',{method:'POST',headers:{origin:ORIGIN,authorization:'Bearer '+await tok(o.uid||'alice'),'content-type':'application/json'},body:JSON.stringify(body)}),env,{waitUntil(){}});
  const text=await r.text();let j={};try{j=JSON.parse(text)}catch(e){}
  return{st:r.status,j};
}
const dayCount=async(env,uid)=>{const h=await A.aiHmac(env,'u|'+uid);return (await env.AI_DB.prepare(`SELECT COUNT(*) c FROM ai_requests WHERE uid_h=? AND consumed=1`).bind(h).first()).c};
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

/* ---------- 固定評価 ---------- */
const R={};let bad=0;const LAT=[];
const add=(cat,ok,name,why)=>{const r=R[cat]=R[cat]||{n:0,ok:0,a:0,aok:0};r.n++;if(ok)r.ok++;else{bad++;console.error('NG',cat,name,why)}};
A.AI_ADAPTERS.fakeb1=A.aiMakeAdapter('fakeb1',A.aiLedger,{fmtDep:['team_recommend','team_followup'],caps:()=>({intents:[],formats:['ranked']})});
for(const c of EV.cases){
  const env=await mkEnv(c.env||{},c.fixture),ids=env.__ids,why=[];let conv=null,assertN=0;
  const key=cid=>{const id=+String(cid).replace('team:','');return Object.keys(ids).find(k=>ids[k]===id&&!/^S\d$/.test(k))||cid};
  let rsAdded=null;
  if(c.ruleset){const all=[...new Set(Object.values(TEAMS).flatMap(t=>t.team.map(m=>m.no)).concat([10034,10035,10039,10046]))];
    const legal=c.ruleset.legalAll?all:all.filter(n=>!(c.ruleset.legalExcept||[]).includes(n));
    rsAdded={id:'rs-b1-test',game:'pokechamp',formats:['double'],start:'2000-01-01T00:00:00+09:00',end:'2100-01-01T00:00:00+09:00',legalComplete:true,seasons:c.ruleset.seasons.map(s=>ids[s]),legal,officialUrl:'https://www.pokemonchampions.jp/ja/news/',checkedAt:'2026-11-26'};A.AI_RULESETS.push(rsAdded)}
  for(const [si,s] of c.steps.entries()){
    const uid=s.uid||'alice',tag=`#${si+1}`;
    if(s.setup==='expire'&&conv)await env.AI_DB.prepare(`UPDATE ai_conv SET expires_at=1 WHERE id=?`).bind(conv).run();
    if(s.setup==='turns6'&&conv)await env.AI_DB.prepare(`UPDATE ai_conv SET turns=6 WHERE id=?`).bind(conv).run();
    if(s.setup==='oldrev'&&conv){const r=await env.AI_DB.prepare(`SELECT state FROM ai_conv WHERE id=?`).bind(conv).first();const st=JSON.parse(r.state);st.rev='old-rev';await env.AI_DB.prepare(`UPDATE ai_conv SET state=? WHERE id=?`).bind(JSON.stringify(st),conv).run()}
    if(s.setup&&s.setup.startsWith('hide:'))await env.DB.prepare(`UPDATE season_teams SET hidden=1 WHERE id=?`).bind(ids[s.setup.slice(5)]).run();
    if(s.setup==='forget')await A.aiForgetUser(env,uid);
    if(s.setup&&s.setup.startsWith('ruleset:')&&!rsAdded){const all=[...new Set(Object.values(TEAMS).flatMap(t=>t.team.map(m=>m.no)).concat([10034,10035,10039,10046]))];
      rsAdded={id:'rs-b1-test',game:'pokechamp',formats:['double'],start:'2000-01-01T00:00:00+09:00',end:'2100-01-01T00:00:00+09:00',legalComplete:true,seasons:[ids[s.setup.slice(8)]],legal:all,officialUrl:'https://www.pokemonchampions.jp/ja/news/',checkedAt:'2026-11-26'};A.AI_RULESETS.push(rsAdded)}
    const b0=await dayCount(env,uid);
    const T0=performance.now();
    const {st,j}=await ask(env,s.q,{fmt:s.fmt,uid,conv:s.conv==='prev'?conv:null,game:s.game});
    LAT.push(performance.now()-T0);
    const b1=await dayCount(env,uid),na=j.nextAction||{};
    const card=(j.cards||[]).find(k=>k.templateId==='team_candidates'),cs=card?card.slots.candidates:[],keys=cs.map(x=>key(x.cid));
    const holds=(j.cards||[]).filter(k=>k.templateId==='hold').map(k=>k.slots.reasonCode);
    const chk=(ok,m)=>{assertN++;if(!ok)why.push(tag+' '+m)};
    if(s.http)chk(st===s.http,'HTTP '+st);else if(s.httpNot)chk(st!==s.httpNot,'HTTP '+st);else chk(st===200,'HTTP '+st+' '+JSON.stringify(j).slice(0,160));
    if(s.status)chk(j.status===s.status,'状態 '+j.status+'/'+j.reasonCode);
    if(s.reason)chk(j.reasonCode===s.reason,'理由 '+j.reasonCode);
    if(s.next)chk(na.kind===s.next,'次 '+na.kind);
    if(s.route)chk(na.route===s.route,'道具 '+na.route);
    if(s.cands)chk(eq(keys,s.cands),'候補 '+JSON.stringify(keys));
    if(s.noCands)chk(!card,'候補が出た');
    if(s.never)chk(s.never.every(k=>!keys.includes(k)),'出してはいけない行 '+JSON.stringify(keys));
    if(s.holds)chk(s.holds.every(h=>holds.includes(h)),'保留 '+JSON.stringify(holds));
    if(s.noHolds)chk(s.noHolds.every(h=>!holds.includes(h)),'保留 '+JSON.stringify(holds));
    if(s.choices)chk(eq((na.choices||[]).map(x=>x.ref),s.choices),'選択肢 '+JSON.stringify(na.choices));
    if(s.consumed!==undefined)chk((b1>b0)===s.consumed,'枠 '+b0+'→'+b1);
    if(s.style)chk(cs.length&&cs.every(x=>x.style&&x.style.k===s.style),'戦い方 '+JSON.stringify(cs.map(x=>x.style)));
    if(s.basisHas)chk(cs[0]&&cs[0].style.basis.some(b=>b.who===s.basisHas),'根拠');
    if(s.reasons)chk(cs[0]&&s.reasons.every(r=>cs[0].reasons.some(x=>x.id===r))&&cs[0].reasons.length<=2,'理由 '+JSON.stringify(cs[0]&&cs[0].reasons));
    if(s.keepNames)chk(cs.length&&cs.every(x=>eq(x.conditions.keep,s.keepNames)),'残す条件 '+JSON.stringify(cs[0]&&cs[0].conditions));
    if(s.dropNames)chk(cs.length&&cs.every(x=>eq(x.conditions.drop,s.dropNames)),'外す条件');
    if(s.rulesetAll)chk(cs.every(x=>x.ruleset.status===s.rulesetAll),'版 '+JSON.stringify(cs.map(x=>x.ruleset)));
    if(s.legalAll)chk(cs.every(x=>x.ruleset.legal===s.legalAll),'使えるか');
    if(s.rulesetOf)for(const [k,v] of Object.entries(s.rulesetOf))chk((cs.find(x=>key(x.cid)===k)||{ruleset:{}}).ruleset.status===v,'版 '+k);
    if(s.legalOf)for(const [k,v] of Object.entries(s.legalOf))chk((cs.find(x=>key(x.cid)===k)||{ruleset:{}}).ruleset.legal===v,'使えるか '+k);
    if(s.sourceType)chk((j.evidence||[]).length===cs.length&&j.evidence.every(e=>e.sourceType===s.sourceType&&e.label),'根拠の種類');
    if(s.attacker){const p=na.prefill||{};chk(p.attacker===s.attacker&&p.defender===s.defender,'役わり '+JSON.stringify(p))}
    if(s.resetAt)chk(j.resetAt>Date.now()&&(s.resetAt!=='month'||j.resetAt===A.aiResets(Date.now()).month),'回復の時刻 '+j.resetAt);
    if(s.calls){const h=await A.aiHmac(env,'u|'+uid);const r=await env.AI_DB.prepare(`SELECT calls,usage_in,usage_out FROM ai_requests WHERE uid_h=? ORDER BY created_at DESC LIMIT 1`).bind(h).first();chk(r.calls===s.calls&&r.usage_in>0&&r.usage_out>0,'呼び出し '+JSON.stringify(r))}
    if(s.overMicro){const r=await env.AI_DB.prepare(`SELECT over_micro FROM ai_requests ORDER BY created_at DESC LIMIT 1`).first();chk(r.over_micro>0,'予約を超えた分 '+JSON.stringify(r))}
    /* どの答えにも：登録した人・コメント・証拠は出さない。答えの中の番号は根拠と同じ */
    const txt=JSON.stringify(j);chk(!/player-|コメント（AI|proof-|u_pub|u_priv/.test(txt),'個人の情報が出た');
    if(card)chk(cs.length<=3&&cs.every(x=>x.members.length===6&&x.source.route.startsWith('#/season/')&&x.reasons.length<=2),'候補の形');
    if(s.newConv)chk(j.conversationId&&j.conversationId!==conv,'新しい会話の番号');
    if(j.conversationId)conv=j.conversationId;
  }
  if(rsAdded)A.AI_RULESETS.splice(A.AI_RULESETS.indexOf(rsAdded),1);
  add(c.cat,!why.length,c.id,why.join(' / '));R[c.cat].a+=assertN;R[c.cat].aok+=assertN-why.length;
}
const total=Object.values(R).reduce((a,r)=>a+r.n,0);
for(const [k,r] of Object.entries(R))console.log(`  b1.${k}: ケース ${r.ok}/${r.n}・アサーション ${r.aok}/${r.a}`);
console.log(`  固定評価（b1-v1）: ${total}ケース`);
{const s=[...LAT].sort((a,b)=>a-b),p=q=>Math.round(s[Math.min(s.length-1,Math.floor(q*s.length))]);console.log(`  処理時間（模擬・手元、1回の質問）: 中央値 ${p(.5)}ms・P95 ${p(.95)}ms（${s.length}回）`)}

/* ---------- OpenAI アダプター（HTTP をまねる） ---------- */
const T={n:0,ok:0};const t=(name,cond,info)=>{T.n++;if(cond)T.ok++;else{bad++;console.error('NG openai',name,info!==undefined?JSON.stringify(info).slice(0,300):'')}};
if(!only){
  const OENV={AI_PROVIDER:'openai',AI_OPENAI_APPROVED:'1',AI_FREE_TEXT_APPROVED:'1',OPENAI_API_KEY:'sk-test-not-real',AI_OPENAI_MODEL:'test-model-1'};
  const plan=(o={})=>({intent:'team_recommend',refs:{species:null,move:null,attacker:null,defender:null,tool:null},format:null,keep:[],keepMegaAny:[],keepNoMega:[],prefer:[],drop:[],pick:null,style:null,...o});
  const ok=(obj,u={input_tokens:120,output_tokens:30})=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(obj)}]}],usage:u}),{status:200});
  const oenv=async(o={})=>{const e=await mkEnv({...OENV,...o});
    await e.AI_DB.prepare(`INSERT INTO ai_prices(id,provider,model,in_per_m,out_per_m,valid_from,valid_to) VALUES('oai-test','openai','test-model-1',1000000,4000000,0,NULL)`).run();return e};
  /* 承認がそろわなければ使わない */
  for(const k of ['AI_OPENAI_APPROVED','AI_FREE_TEXT_APPROVED','OPENAI_API_KEY','AI_OPENAI_MODEL']){
    const e=await oenv({[k]:''});OAI.length=0;OAI_FN=()=>ok(plan());const r=await ask(e,'今オススメのパーティ教えて',{fmt:'double'});
    t(k+' が無ければ使わない',r.st===503&&r.j.reasonCode==='provider_not_enabled'&&OAI.length===0,r.j)}
  t('既定（AI_PROVIDER なし）では選ばれない',A.aiProviderFor({})===null);
  t('模型名の形が変なら使わない',A.aiProviderFor({...OENV,AI_OPENAI_MODEL:'a b/c'})===null);
  /* ふつうの流れ：2回（読み取り→並び）、固定のアドレス・store:false・strict な JSON スキーマ・個人の情報を減らす */
  { const e=await oenv();OAI.length=0;
    OAI_FN=b=>b.text.format.name==='gk_order'?ok({order:[...b.text.format.schema.properties.order.items.enum].reverse()},{input_tokens:80,output_tokens:10}):ok(plan());
    const r=await ask(e,'今オススメのパーティ教えて。連絡は taro@example.com か @taro_x、090-1234-5678 まで https://example.com/x',{fmt:'double'});
    const keys=(r.j.cards||[]).find(k=>k.templateId==='team_candidates');
    t('答えが返る',r.st===200&&keys&&keys.slots.candidates.length===3,r.j);
    t('2回だけ呼ぶ',OAI.length===2,OAI.length);
    t('固定のアドレス',OAI.every(x=>x.url==='https://api.openai.com/v1/responses'));
    t('store:false',OAI.every(x=>x.body.store===false));
    t('構造化出力（strict・追加の項目なし）',OAI.every(x=>x.body.text.format.type==='json_schema'&&x.body.text.format.strict===true&&x.body.text.format.schema.additionalProperties===false));
    t('鍵は Authorization だけ',OAI.every(x=>x.init.headers.authorization==='Bearer sk-test-not-real')&&!JSON.stringify(OAI.map(x=>x.body)).includes('sk-test'));
    const sent=JSON.stringify(OAI[0].body);
    t('メール・@ID・電話・URL を送らない',!/taro@example|@taro_x|090-1234|example\.com\/x/.test(sent),sent.slice(0,400));
    t('出力の上限を付ける',OAI.every(x=>x.body.max_output_tokens>0&&x.body.max_output_tokens<=A.AI_LIMITS.maxOutputTokens));
    t('並びは逆に（2回目の結果を使う）',keys&&keys.slots.candidates[0].index===1&&+keys.slots.candidates[2].cid.slice(5)===e.__ids.D1);
    const h=await A.aiHmac(e,'u|alice'),row=await e.AI_DB.prepare(`SELECT calls,usage_in,usage_out,cost_micro,max_micro,over_micro,prompt_ver,provider,model FROM ai_requests WHERE uid_h=?`).bind(h).first();
    t('使用量は2回分の合計',row.calls===2&&row.usage_in===200&&row.usage_out===40,row);
    t('費用は使用量から（120+80 入力・30+10 出力）',row.cost_micro===A.aiCost({in_per_m:1000000,out_per_m:4000000},200,40)&&row.over_micro===0,row);
    t('2回分を予約した',row.max_micro>=2*A.aiCost({in_per_m:1000000,out_per_m:4000000},A.AI_LIMITS.maxInputTokens,A.AI_LIMITS.maxOutputTokens),row);
    t('プロンプトの版・提供元を残す',row.prompt_ver===A.AI_PROMPT_VERSION&&row.provider==='openai'&&row.model==='test-model-1',row);
    t('応答に模擬でないと書く',r.j.provider&&r.j.provider.id==='openai'&&r.j.provider.mock===false,r.j.provider);
    /* 続き：前の質問文は送らない（会話の状態の要約だけ） */
    OAI.length=0;OAI_FN=b=>b.text.format.name==='gk_order'?ok({order:b.text.format.schema.properties.order.items.enum}):ok(plan({intent:'team_followup',pick:2,style:'cycle'}));
    const r2=await ask(e,'2つ目をサイクル寄りに',{fmt:'double',conv:r.j.conversationId});
    const s2=OAI[0]?OAI[0].body.input[1].content:'';
    t('続きは前の候補から',r2.st===200&&((r2.j.cards||[]).find(k=>k.templateId==='team_candidates')||{slots:{candidates:[]}}).slots.candidates.length>=1,r2.j);
    t('前の質問文を送らない',!/今オススメ|taro/.test(s2)&&/"cands":3/.test(s2),s2.slice(0,300));
  }
  /* 失敗の種類（どれも枠を使わない・候補を出さない） */
  const cases=[['拒否',()=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'no'}]}],usage:{input_tokens:5,output_tokens:1}})),503],
    ['途中で切れた',()=>new Response(JSON.stringify({status:'incomplete',output:[],usage:{input_tokens:5,output_tokens:1}})),503],
    ['JSON でない本文',()=>new Response('<html>'),503],
    ['出力が JSON でない',()=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'一番強いのは…'}]}],usage:{input_tokens:5,output_tokens:5}})),503],
    ['HTTP 500',()=>new Response('{}',{status:500}),503],
    ['HTTP 429',()=>new Response('{}',{status:429}),503],
    ['大きすぎる応答',()=>new Response('x'.repeat(70000)),503],
    ['通信の失敗',()=>{throw new Error('net')},503],
    ['知らない番号',()=>ok(plan({keep:['sp:999999']})),200],
    ['決まっていない項目',()=>ok({...plan(),text:'自由文'}),200],
    ['決まっていない意図',()=>ok(plan({intent:'write_anything'})),200]];
  for(const [n,fn,code] of cases){const e=await oenv();OAI_FN=fn;const r=await ask(e,'今オススメのパーティ教えて',{fmt:'double'});
    t(n+'：答えない',r.st===code&&!(r.j.cards||[]).some(k=>k.templateId==='team_candidates')&&(code===503||r.j.reasonCode==='plan_invalid'),{st:r.st,j:r.j});
    t(n+'：枠を使わない',await dayCount(e,'alice')===0)}
  { const e=await oenv({AI_TIMEOUT_MS:'50'});OAI_FN=(b,init)=>new Promise((res,rej)=>init.signal.addEventListener('abort',()=>rej(new Error('abort'))));
    const r=await ask(e,'今オススメのパーティ教えて',{fmt:'double'});t('時間切れ',r.st===503&&r.j.reasonCode==='provider_timeout',r.j)}
  /* 予約を超えた使用量：切り捨てずに記録して止める */
  { const e=await oenv();OAI_FN=()=>ok(plan({style:'rain'}),{input_tokens:A.AI_LIMITS.maxInputTokens*3,output_tokens:A.AI_LIMITS.maxOutputTokens*3});
    const r=await ask(e,'雨のおすすめのパーティ',{fmt:'double'});const row=await e.AI_DB.prepare(`SELECT over_micro,cost_micro,max_micro FROM ai_requests`).first();
    t('予約を超えた分を残す',row.over_micro>0&&row.cost_micro===row.max_micro,row);
    const r2=await ask(e,'砂のおすすめのパーティ',{fmt:'double'});t('そのあとは止まる',r2.st===503&&r2.j.reasonCode==='ai_halted',r2.j)}
  /* 失敗が続けば止める（10分で5件以上・半分以上） */
  { const e=await oenv();OAI_FN=()=>new Response('{}',{status:500});
    for(let i=0;i<5;i++)await ask(e,'今オススメのパーティ教えて',{fmt:'double'});
    OAI.length=0;OAI_FN=()=>ok(plan());const r=await ask(e,'今オススメのパーティ教えて',{fmt:'double'});
    t('失敗が続くと止まる（送らない）',r.st===503&&r.j.reasonCode==='ai_halted'&&OAI.length===0,r.j)}
  /* 費用の急増で止める */
  { const e=await oenv({AI_HOURLY_MICRO:'1'});OAI_FN=b=>b.text.format.name==='gk_order'?ok({order:b.text.format.schema.properties.order.items.enum}):ok(plan());
    await ask(e,'今オススメのパーティ教えて',{fmt:'double'});const r=await ask(e,'今オススメのパーティ教えて',{fmt:'double'});
    t('1時間の費用を超えると止まる',r.st===503&&r.j.reasonCode==='ai_halted'&&r.j.haltReason==='cost_spike',r.j)}
  /* 予算が1回分しかなければ2回目は呼ばない */
  { const max=A.aiCost({in_per_m:1000000,out_per_m:4000000},A.AI_LIMITS.maxInputTokens,A.AI_LIMITS.maxOutputTokens);
    const e=await oenv({AI_BUDGET_MICRO:String(max)});OAI.length=0;OAI_FN=b=>b.text.format.name==='gk_order'?ok({order:[...b.text.format.schema.properties.order.items.enum].reverse()}):ok(plan());
    const r=await ask(e,'今オススメのパーティ教えて',{fmt:'double'});
    t('予算が足りなければ並びは呼ばない',r.st===200&&OAI.length===1&&+((r.j.cards||[]).find(k=>k.templateId==='team_candidates').slots.candidates[0].cid.slice(5))===e.__ids.D1,{n:OAI.length})}
  /* 並びの答えがおかしければ使わない（番号の入れかえ・知らない番号） */
  { const e=await oenv();OAI_FN=b=>b.text.format.name==='gk_order'?ok({order:['team:999999','team:1','team:2']}):ok(plan());
    const r=await ask(e,'今オススメのパーティ教えて',{fmt:'double'});const c=(r.j.cards||[]).find(k=>k.templateId==='team_candidates');
    t('おかしな並びは使わない',c&&+c.slots.candidates[0].cid.slice(5)===e.__ids.D1,c&&c.slots.candidates.map(x=>x.cid))}
  /* 1件だけなら1回だけ */
  { const e=await oenv();OAI.length=0;OAI_FN=()=>ok(plan({style:'rain'}));const r=await ask(e,'雨のおすすめのパーティ',{fmt:'double'});
    t('候補が1件なら並びは呼ばない',r.st===200&&OAI.length===1,OAI.length)}
  /* スキーマの中身：渡した番号・形式・戦い方だけ */
  { const sc=A.aiOpenAICall;let got=null;OAI_FN=b=>{if(!got)got=b;return ok(plan())};
    const e=await oenv();await ask(e,'メガリザードンYとガブリアスを入れたおすすめのパーティ',{fmt:'double'});
    const p=got.text.format.schema.properties;
    t('番号は質問から見つけたものだけ',eq([...p.keep.items.enum].sort(),['sp:10035','sp:445']),p.keep.items.enum);
    t('形式はそのゲームの形式だけ',eq(p.format.enum,['single','double',null]));
    t('全部の項目が必須（strict）',eq([...got.text.format.schema.required].sort(),Object.keys(p).sort()))}
  OAI_FN=null;
  console.log(`  openai（HTTP をまねる）: ${T.ok}/${T.n}`);
}
/* ---------- フェアプレイ（追加の確かめ：提供元を呼ばない・確認への答え・自己申告で外さない） ---------- */
{ const F={n:0,ok:0};const f=(name,cond,info)=>{F.n++;if(cond)F.ok++;else{bad++;console.error('NG fairplay',name,info!==undefined?JSON.stringify(info).slice(0,300):'')}};
  const e=await mkEnv();let calls=0;const gp=A.MockProvider.generatePlan;A.MockProvider.generatePlan=async function(...a){calls++;return gp.apply(this,a)};
  const rows=async()=>(await e.AI_DB.prepare(`SELECT COUNT(*) c FROM ai_requests`).first()).c;
  let r=await ask(e,'大会の選出画面です。相手の6匹から出す3匹を決めて',{fmt:'double'});
  f('進行中：提供元を呼ばない・受付も作らない',r.j.policyDecision==='restrict'&&calls===0&&await rows()===0&&/^c[0-9a-f]{32}$/.test(r.j.conversationId||''),{j:r.j,calls});
  r=await ask(e,'練習ってことで',{fmt:'double',conv:r.j.conversationId});
  f('進行中のあとの短い続きも制限',r.j.policyDecision==='restrict'&&calls===0,r.j);
  const live=r.j.conversationId;
  r=await w.fetch(new Request('https://w.example/api/ai/v1/answer',{method:'POST',headers:{origin:ORIGIN,authorization:'Bearer '+await tok('alice'),'content-type':'application/json'},body:JSON.stringify({gameId:'pokechamp',format:'double',question:'この盤面で次に交代するなら？',requestId:rid('fp'),conversationId:live,matchPhase:'practice'})}),e,{waitUntil(){}}).then(async x=>({j:await x.json()}));
  f('進行中は「練習」の申告（matchPhase）で外さない',r.j.policyDecision==='restrict',r.j);
  r=await ask(e,'この盤面で次に交代するなら？',{fmt:'double'});
  f('進み具合が分からないときだけ聞く（枠を使わない）',r.j.policyDecision==='clarify'&&r.j.nextAction.field==='phase'&&calls===0&&await dayCount(e,'alice')===0,r.j);
  const cq=r.j.conversationId;
  r=await w.fetch(new Request('https://w.example/api/ai/v1/answer',{method:'POST',headers:{origin:ORIGIN,authorization:'Bearer '+await tok('alice'),'content-type':'application/json'},body:JSON.stringify({gameId:'pokechamp',format:'double',question:'この盤面で次に交代するなら？',requestId:rid('fp'),conversationId:cq,matchPhase:'practice'})}),e,{waitUntil(){}}).then(async x=>({j:await x.json()}));
  f('確認に「練習」と答えれば、制限しない',r.j.policyDecision==='allow',r.j);
  r=await ask(e,'試合が終わった。さっきのダブルのおすすめのパーティ教えて',{fmt:'double',conv:live});
  f('同じ相談では終了申告のあとも振り返りツールを案内する',r.j.policyDecision==='restrict'&&r.j.nextAction?.kind==='after_match'&&!(r.j.cards||[]).some(k=>k.templateId==='team_candidates'),r.j);
  const beforeLiveCalc=await dayCount(e,'alice');
  r=await ask(e,'対戦中だけど、ガブリアスのじしんでカイリューへのダメージは？',{fmt:'double'});
  f('進行中の計算は、読み取ったあとでも止める（計算しない・枠を使わない）',r.j.policyDecision==='restrict'&&!(r.j.cards||[]).some(k=>k.templateId==='damage_calc')&&await dayCount(e,'alice')===beforeLiveCalc,r.j);
  r=await ask(e,'対戦中だけど、まもるの一般仕様を教えて',{fmt:'double'});
  f('進行中でも一般の仕様は答える',r.j.policyDecision==='allow_general',r.j);
  r=await ask(e,'ガブリアスのじしんでカイリューへのダメージは？',{fmt:'single'});
  f('ふだんのダメージの質問は止めない（Stage A のまま）',r.j.policyDecision==='allow',r.j);
  A.MockProvider.generatePlan=gp;
  console.log(`  fairplay（追加の確かめ）: ${F.ok}/${F.n}`);
}
/* ---------- 既定は無効 ---------- */
{ const e=await mkEnv({AI_B1_ENABLED:''});const r=await ask(e,'今オススメのパーティ教えて',{fmt:'double'});
  const ok=r.j.status==='unsupported'&&r.j.reasonCode==='b1_disabled';if(!ok){bad++;console.error('NG 既定で無効',r.j)}
  const cfg=JSON.parse(fs.readFileSync(path.join(ROOT,'config/public.json'),'utf8'));if(cfg.ai&&cfg.ai.enabled){bad++;console.error('NG 画面の AI が有効')}
  if(fs.readFileSync(path.join(ROOT,'worker/ai-rulesets.json'),'utf8').trim()!=='[]'&&!process.env.B1_ALLOW_RULESETS){/* 確かめた記録を足すときは報告に書く */}
}
if(OUT.length){bad++;console.error('NG 外部への送信',OUT)}
console.log(`  外部への送信: ${OUT.length}件（OpenAI はまねだけ）`);
console.log(bad?`ai-b1: NG（${bad}件）`:`ai-b1: OK（固定評価 ${total}ケース${only?'':'・OpenAI '+T.n+'件'}）`);
process.exit(bad?1:0);
