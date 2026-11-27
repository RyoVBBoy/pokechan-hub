// Game Kid/s AI（Stage A）の固定評価だけを、ほかのテストとは別に何度でも流す（npm run test:ai-eval）。
// fixed-v1.json（112ケース：図鑑の事実60・計算52。期待値はサイトの元データと計算の画面から作って保存）と
// fixed-v2.json（役わり・形式・比較・使用率・保留・入力の形。期待値は人が決めた答え）を読み、1ケースずつ新しい環境で Worker のコードに通す。
// 外部への送信は0件（fetch は Google の公開鍵だけ答える）。模擬アダプターだけ。
import fs from 'node:fs';
import path from 'node:path';
import {makeD1} from './d1mock.mjs';
import {ROOT,ORIGIN,makeSigner,migrate,baseEnv,rid} from './ai-helpers.mjs';
const S=await makeSigner();
const OUT=[];
globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
globalThis.fetch=async u=>{u=String(u);if(u.includes('securetoken@system.gserviceaccount.com'))return new Response(JSON.stringify({keys:[S.jwk]}));OUT.push(u);throw new Error('外部への送信は禁止')};
const mod=await import(path.join(ROOT,'worker/dist/worker_test.js'));const w=mod.default,A=mod.__ai;
const V1=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/ai-eval/fixed-v1.json'),'utf8')),V2=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/ai-eval/fixed-v2.json'),'utf8'));
/* 元データ（AI の台帳を使わずに読む）：fixed-v1 の図鑑の事実を二重に確かめる */
const src=JSON.parse(fs.readFileSync(path.join(ROOT,'src/js/order.json'),'utf8')).map(f=>fs.readFileSync(path.join(ROOT,'src/js',f),'utf8')).join('');
const TC=JSON.parse(fs.readFileSync(path.join(ROOT,'worker/src/chart.txt'),'utf8').split('\n')[1].replace(/'/g,'"'));
const BY={};for(const re of [/const RAWDATA=`(.*?)`/s,/const MEGAP=`(.*?)`/s])for(const l of src.match(re)[1].trim().split('\n')){const a=l.split(',');BY[+a[0]]={t:[...a[2]].map(c=>TC[c]),s:a.slice(3,9).map(Number)}}
/* 架空の第2ゲーム（形式 ranked／casual・使用率のツールつき）。fixed-v2 の setup.fake で入れる */
const FAKE={st:['official','ingame','external_match','external_single','site_calc','site_aggregate','site_estimate'],ss:['active','unverified','conflict','expired'],rev:'dfake2',
  man:{rulesets:[{id:'S1',validFrom:'2026-01-01',validTo:null,status:'official'}],current:'S1'},src:{fk:{id:'fk',name:'架空の公式資料',lv:'official',date:'2026-11-01',refs:[]}},
  e:{'sp:9001':['species','テストモン',['テストモン'],{base:'テストモン',no:9001}]},
  r:[['sp:9001','name','テストモン',0,'fk','2026-11-01',0,0,'species'],['sp:9001','types',['みず'],0,'fk','2026-11-01',0,0,'species']]};
const fakeUsage=(i,sc)=>({ok:true,res:{species:i.species,count:sc.format==='ranked'?42:7,previews:100,share:sc.format==='ranked'?42:7,format:sc.format,from:'2026-10-26',to:'2026-11-25',generatedAt:Date.now()-36e5,cap:20000,capped:false,dedup:'架空の集計',sourceName:'架空のゲームの集計'}});
function fakeOn(){const L=A.aiLedgerFrom(FAKE,'fakegame2');A.AI_ADAPTERS.fakegame2=A.aiMakeAdapter('fakegame2',()=>L,{fmtDep:['usage_share'],fmtWords:{ranked:/ランクマッチ/,casual:/カジュアル/},tools:{usage:fakeUsage},
  caps:()=>({intents:['usage_share','species_types'],formats:['ranked','casual'],formatLabels:{ranked:'ランクマッチ',casual:'カジュアル'}})})}
const fakeOff=()=>{delete A.AI_ADAPTERS.fakegame2};
/* 1ケース＝新しい AI_DB・主DB（利用枠は既定値、頻度の上限だけゆるめる） */
const TOK=await S.sign('eval-user');
async function run(c){
  const env=baseEnv({AI_DB:makeD1(),DB:makeD1(),AI_RL_USER_MIN:'1000',AI_RL_IP_MIN:'1000',AI_FREE_DAY:'1000',AI_FREE_MONTH:'1000'});await migrate(env.AI_DB);
  const st=c.setup||{};
  /* fixed-v1 は q・format・calc の形（形式はシングルで流していた。そのまま） */
  if(!c.req&&!c.raw)c={...c,req:{question:c.q,format:c.format||'single',...(c.calc?{toolInput:{calc:c.calc}}:{})}};
  if(st.usage){await env.DB.prepare(`CREATE TABLE usage_cache(fmt TEXT PRIMARY KEY,data TEXT,at INTEGER)`).run();
    for(const [f,u] of Object.entries(st.usage)){const at=Date.now()-Math.round((u.ageH||1)*36e5),d={...u,at};delete d.ageH;if(d.previews===null)delete d.previews;
      await env.DB.prepare(`INSERT INTO usage_cache(fmt,data,at) VALUES(?,?,?)`).bind(f,JSON.stringify(d),at).run()}}
  if(st.fake)fakeOn();
  try{
    const body=c.raw?{gameId:'pokechamp',requestId:rid('ev'),...c.raw}:{gameId:c.req.gameId||'pokechamp',question:c.req.question,requestId:rid('ev'),...(c.req.format!==undefined?{format:c.req.format}:{}),...(c.req.toolInput?{toolInput:c.req.toolInput}:{}),...(c.req.requestedRulesetId?{requestedRulesetId:c.req.requestedRulesetId}:{})};
    const r=await w.fetch(new Request('https://w.example/api/ai/v1/answer',{method:'POST',headers:{origin:ORIGIN,authorization:'Bearer '+TOK,'content-type':'application/json'},body:JSON.stringify(body)}),env,{waitUntil(){}});
    const j=await r.json().catch(()=>({}));
    const h=await A.aiHmac(env,'u|eval-user'),consumed=(await env.AI_DB.prepare(`SELECT COUNT(*) c FROM ai_requests WHERE uid_h=? AND consumed=1`).bind(h).first()).c;
    return{http:r.status,j,consumed};
  }finally{if(st.fake)fakeOff()}
}
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function checkV1(c,{http,j}){
  const x=c.expect,card=(j.cards||[]).find(k=>!['hold','needs_input','unsupported','unavailable'].includes(k.templateId))||(j.cards||[])[0]||{},s=card.slots||{},why=[];
  if(c.suite==='evidence'){
    if(http!==200||j.status!==x.status)why.push(`状態 ${http}/${j.status}（期待 ${x.status}）`);
    if(x.template&&card.templateId!==x.template)why.push('カード '+card.templateId);
    if(x.template==='species_types'&&!(eq(s.types,x.types)&&eq(s.types,BY[x.species].t)))why.push('タイプ');
    if(x.template==='species_stats'&&!(eq(s.stats,x.stats)&&eq(s.stats,BY[x.species].s)))why.push('種族値');
    if(x.template==='species_abilities'&&!eq((s.abilities||[]).map(a=>a.ability.slice(3)),x.abilities))why.push('特性');
    if(x.template==='learns_move'&&s.learns!==x.learns)why.push('覚える');
    if(x.template==='move_info'&&!(s.type===x.type&&s.power===x.power&&(x.accuracy==null?s.accuracy==null:s.accuracy===x.accuracy)))why.push('技');
    if(x.template==='species_megas'&&!(eq((s.megas||[]).map(m=>+m.species.slice(3)).sort((a,b)=>a-b),x.megas)&&(j.cards||[]).some(k=>k.templateId==='hold'&&k.slots.reasonCode===x.hold)))why.push('メガ');
    if(x.template==='sp_rule'&&!(s.total===x.total&&s.per===x.per))why.push('ルール');
    if(x.status==='needs_input'&&(j.reasonCode!==x.reasonCode||(x.choices&&!eq((j.nextAction.choices||[]).map(c=>+c.ref.slice(3)).sort((a,b)=>a-b),x.choices))))why.push('選ばせ方');
    if(x.status==='insufficient_evidence'&&j.reasonCode!==x.reasonCode)why.push('理由 '+j.reasonCode);
  }else{
    const cd=(j.cards||[]).find(k=>k.templateId==='damage_calc'),d=cd&&cd.slots;
    if(x.status==='answered'){if(!(http===200&&j.status==='answered'&&d&&eq(d.rolls,x.rolls)&&d.hp===x.hp&&d.ko.n===x.ko.n&&d.ko.sure===x.ko.sure&&Math.abs(d.ko.p-x.ko.p)<1e-12&&d.format===c.format))why.push('計算 '+JSON.stringify(d&&d.rolls))}
    else if(!(http===200&&j.status===x.status&&x.reasonCodes.includes(j.reasonCode)&&!cd))why.push(`未対応 ${j.status}/${j.reasonCode}`);
  }
  return why;
}
function checkV2(c,{http,j,consumed}){
  const x=c.expect,why=[],na=j.nextAction||{};
  const card=(j.cards||[]).find(k=>!['hold','needs_input','unsupported','unavailable','open_tool'].includes(k.templateId))||{};
  if((x.http||200)!==http)why.push('HTTP '+http);
  if(x.status&&j.status!==x.status)why.push('状態 '+j.status);
  if(x.statusIn&&!x.statusIn.includes(j.status))why.push('状態 '+j.status);
  if(x.statusNot&&j.status===x.statusNot)why.push('状態 '+j.status);
  if(x.reasonCode&&j.reasonCode!==x.reasonCode)why.push('理由 '+j.reasonCode);
  if(x.reasonCodeNot&&j.reasonCode===x.reasonCodeNot)why.push('理由 '+j.reasonCode);
  if(x.roles){const p=na.prefill||{};if(p.attacker!=='sp:'+x.roles.attacker||p.defender!=='sp:'+x.roles.defender)why.push(`役わり ${p.attacker}→${p.defender}`)}
  if(x.choices&&!eq((na.choices||[]).map(c=>c.ref),x.choices))why.push('形式の選択肢 '+JSON.stringify(na.choices));
  if(x.labels&&!eq((na.choices||[]).map(c=>c.label),x.labels))why.push('形式の名前');
  if(x.choiceNos&&!eq((na.choices||[]).map(c=>+c.ref.slice(3)).sort((a,b)=>a-b),x.choiceNos))why.push('姿の選択肢');
  if(x.field&&na.field!==x.field)why.push('聞く側 '+na.field);
  if(x.route&&na.route!==x.route)why.push('行き先 '+na.route);
  if(x.template&&card.templateId!==x.template)why.push('カード '+card.templateId);
  if(x.slots)for(const [k,v] of Object.entries(x.slots))if(!eq((card.slots||{})[k],v))why.push(`値 ${k}=${JSON.stringify((card.slots||{})[k])}`);
  if('scopeFormat' in x&&!(j.scope&&j.scope.format===x.scopeFormat))why.push('形式 '+JSON.stringify(j.scope&&j.scope.format));
  if(x.scopeGame&&!(j.scope&&j.scope.gameId===x.scopeGame))why.push('ゲーム');
  if(x.evidenceGame&&!(j.evidence||[]).every(e=>e.scope&&e.scope.gameId===x.evidenceGame))why.push('根拠のゲーム');
  if(x.noEvidence&&(j.evidence||[]).length)why.push('根拠がある');
  if(x.noNumbers&&/"rolls"|"pctMin"/.test(JSON.stringify(j)))why.push('数字を出した');
  if(x.consumed!==undefined&&consumed!==x.consumed)why.push('回数 '+consumed);
  return why;
}
const ROWS=[];
for(const [set,cases,chk] of [['v1',V1.cases,checkV1],['v2',V2.cases,checkV2]])
  for(const c of cases){const r=await run(c);const why=chk(c,r);ROWS.push({set,id:c.id,suite:c.suite,ok:!why.length,why});if(why.length)console.error('NG',set,c.id,c.suite,c.q||(c.req&&c.req.question)||'',why.join(' / '))}
const by={};for(const r of ROWS){const k=r.set+'.'+r.suite;by[k]=by[k]||{n:0,ok:0};by[k].n++;if(r.ok)by[k].ok++}
for(const [k,v] of Object.entries(by))console.log(`  ${k}: ${v.ok}/${v.n}`);
const bad=ROWS.filter(r=>!r.ok).length;
/* 回答可能とした集合（fixed-v1 の答える・一部答えるケース）の回答率 */
const ans=V1.cases.filter(c=>c.suite==='evidence'&&['answered','partial'].includes(c.expect.status)).map(c=>ROWS.find(r=>r.id===c.id&&r.set==='v1'));
const rate=ans.filter(r=>r.ok).length/ans.length;
if(V1.cases.length!==112){console.error('NG fixed-v1 のケース数が112ではない',V1.cases.length)}
if(OUT.length)console.error('NG 外部への送信',OUT);
fs.mkdirSync(path.join(ROOT,'tests/out'),{recursive:true});
fs.writeFileSync(path.join(ROOT,'tests/out/ai-eval-results.json'),JSON.stringify({cases:ROWS.length,v1:V1.cases.length,v2:V2.cases.length,bad,answerRate:rate,suites:by,fails:ROWS.filter(r=>!r.ok)},null,1));
const fail=bad||V1.cases.length!==112||OUT.length||ROWS.length<200||rate<.95;
console.log(fail?`ai-eval: NG（${bad}件 / ${ROWS.length}ケース）`:`ai-eval: OK（${ROWS.length}ケース＝fixed-v1 ${V1.cases.length}＋fixed-v2 ${V2.cases.length}、回答可能 ${(rate*100).toFixed(0)}%）`);if(fail)process.exitCode=1;
