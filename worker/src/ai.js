/* ===================== Game Kid/s AI（Stage A：模擬アダプターだけ・既定は無効） =====================
   仕様：docs/ai/implementation-spec.md。入口は /api/ai/v1/context と /api/ai/v1/answer。
   ・AI_ENABLED='1' のときだけ動く。無効なら DB にも提供元にもつながずに 503 で終える（コミュニティ用の DB 初期化より前に分ける）
   ・認証は既存の authOf（Firebase の署名済み Bearer）、停止中の会員は主DB users.banned で断る
   ・利用枠・費用は別の D1（AI_DB）。worker/migrations-ai/0001_ai_init.sql を当てたものだけを使う（ここで表を作らない）
   ・提供元は AI_PROVIDER='mock' だけ。実際の外部AIは Stage A では呼ばない（登録もしない）
   ・数値・名前・条件はサーバーが根拠台帳（AI_LEDGER）と既存の計算から埋める。模擬AIが返すのは「意図」と「候補の番号」だけ */
const AI_LEDGER_C=__AI_LEDGER__;
const AI_ENGINE_REV='__AI_ENGINE_REV__';
const AI_CALC_SPECIAL=new Set(__AI_CALC_SPECIAL__);   /* 計算の中で名前で特別扱いされる技・特性・持ち物（build.py が計算の関数から集める） */
const AI_SCHEMA_VERSION='1';
const AI_MAX_BODY=8192,AI_MAX_Q=1000,AI_MAX_CANDS=24,AI_MAX_CARDS=8;
const AI_LIMITS={maxInputTokens:2000,maxOutputTokens:500,calls:1,timeoutMs:15000};
const AI_LABEL={official:'公式資料',ingame:'実機で確認',external_match:'外部参照と一致',external_single:'外部参照（1出典・未照合）',site_calc:'サイトの計算・推定',site_estimate:'サイトの計算・推定',site_aggregate:'当サイト集計',insufficient:'根拠不足'};
/* 検証の強さ（弱いほうに合わせてカードの検証状態を決める） */
const AI_RANK={official:6,ingame:5,external_match:4,site_aggregate:3,site_calc:3,external_single:2,site_estimate:1,insufficient:0};
const AI_INTENTS=['species_types','species_stats','species_abilities','species_megas','learns_move','move_info','sp_rule','damage_calc','usage_share','party_tool','legality','unknown'];
const AI_TEMPLATES=['species_types','species_stats','species_abilities','species_megas','learns_move','move_info','sp_rule','damage_calc','usage_share','hold','needs_input','unsupported','unavailable','open_tool'];
/* 計算に影響しない特性（Stage A で計算を許す特性）。build.py が「計算の関数の中に名前が出てこない」ことを確かめる */
const AI_CALC_ABILITY_OK=new Set(['pressure','inner-focus','keen-eye','frisk','unnerve','natural-cure','regenerator','shed-skin','synchronize','early-bird','limber','oblivious','own-tempo','insomnia','vital-spirit','cursed-body','pickpocket','big-pecks','tangled-feet','run-away','pickup','illuminate','stench','shield-dust','magma-armor','immunity','sweet-veil','aroma-veil','damp','suction-cups','sticky-hold','rattled','steadfast','anticipation','forewarn','overcoat','weak-armor','cute-charm','poison-point','static','flame-body','effect-spore','rough-skin','gooey','mummy','wandering-spirit','gluttony','cheek-pouch','ripen','harvest','unburden','klutz','quick-feet','surge-surfer']);

/* ---------- 根拠台帳 ---------- */
let AI_L=null;
const aiNorm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60))
  .replace(/[ぁぃぅぇぉっゃゅょゎ]/g,c=>({'ぁ':'あ','ぃ':'い','ぅ':'う','ぇ':'え','ぉ':'お','っ':'つ','ゃ':'や','ゅ':'ゆ','ょ':'よ','ゎ':'わ'})[c])
  .replace(/ゔ/g,'ぶ').replace(/[\s・()（）\-ー－‐'’.,、。!?！？「」]/g,'');
/* 台帳の小さい形（build.py の ai_ledger.compact）を、検索できる形に広げる。ゲームごとに別の台帳 */
function aiLedgerFrom(C,gameId){
  const recs=new Map(),byEnt=new Map(),ents=new Map(),alias=new Map();
  for(const [eid,field,val,st,sid,checked,ss,rs,kind] of C.r){
    const r={evidenceId:eid+'#'+field,scope:{gameId,rulesetId:rs||null,format:'formatIndependent'},entityId:eid,field,typedValue:val,
      sourceType:C.st[st],sourceRef:'src:'+sid,checkedAt:checked,validFrom:checked,validTo:null,status:C.ss[ss],kind};
    recs.set(r.evidenceId,r);if(!byEnt.has(eid))byEnt.set(eid,{});byEnt.get(eid)[field]=r;
  }
  for(const [id,[kind,label,aliases,extra]] of Object.entries(C.e)){
    const e={id,kind,label,aliases,...extra};ents.set(id,e);
    for(const a of aliases){const k=aiNorm(a);if(k.length<2)continue;if(!alias.has(k))alias.set(k,new Set());alias.get(k).add(id)}
  }
  /* 姿の違い（同じ名前の地方の姿など）：もとの名前ごとの一覧 */
  const fam=new Map();for(const e of ents.values())if(e.kind==='species'&&!e.mega&&e.base){const k=aiNorm(e.base);if(!fam.has(k))fam.set(k,[]);fam.get(k).push(e.id)}
  /* 姿の名前しかない種類（ルガルガン（まひるのすがた）など）は、もとの名前だけでも見つける（どの姿かは決めない） */
  for(const [k,ids] of fam)if(ids.length>1&&k.length>=2){if(!alias.has(k))alias.set(k,new Set());ids.forEach(id=>alias.get(k).add(id))}
  const keys=[...alias.keys()].sort((a,b)=>b.length-a.length);
  return{gameId,recs,byEnt,ents,alias,keys,fam,src:C.src||{},rev:C.rev,man:C.man};
}
function aiLedger(){return AI_L||(AI_L=aiLedgerFrom(AI_LEDGER_C,'pokechamp'))}
/* 質問の中の名前を、長いものから重ならないように拾う。同じ名前の姿が複数あれば、どれかは決めない（候補として返す） */
function aiFindEntities(q,L){
  L=L||aiLedger();const t=aiNorm(q),used=new Array(t.length).fill(false),found=[];
  for(const k of L.keys){
    if(k.length>t.length)continue;
    const ascii=/^[a-z0-9]+$/.test(k);if(ascii&&k.length<3)continue;
    let i=t.indexOf(k);
    while(i>=0){
      let free=true;for(let j=i;j<i+k.length;j++)if(used[j]){free=false;break}
      const edge=!ascii||((i===0||!/[a-z0-9]/.test(t[i-1]))&&(i+k.length>=t.length||!/[a-z0-9]/.test(t[i+k.length])));
      if(free&&edge){for(let j=i;j<i+k.length;j++)used[j]=true;found.push({pos:i,key:k,ids:[...L.alias.get(k)]})}
      i=t.indexOf(k,i+1);
    }
  }
  found.sort((a,b)=>a.pos-b.pos);
  const out=[];
  for(const f of found)for(const id of f.ids){
    const e=L.ents.get(id);let forms=null;
    if(e.kind==='species'&&!e.mega&&e.base){const fl=L.fam.get(aiNorm(e.base))||[];if(fl.length>1&&f.key===aiNorm(e.base))forms=fl}
    if(forms&&out.some(o=>o.forms&&o.pos===f.pos))continue;   /* 同じ名前の姿は1つの候補にまとめる */
    out.push({ref:forms?forms[0]:id,kind:e.kind,label:forms?L.ents.get(forms[0]).base:e.label,pos:f.pos,forms});
  }
  return out.slice(0,AI_MAX_CANDS);
}
function aiEvidenceOut(r,L){
  L=L||aiLedger();const s=L.src[r.sourceRef.slice(4)]||null;
  return{evidenceId:r.evidenceId,entityId:r.entityId,field:r.field,typedValue:r.typedValue,scope:r.scope,sourceType:r.sourceType,label:AI_LABEL[r.sourceType]||AI_LABEL.insufficient,
    sourceRef:r.sourceRef,source:s?{name:s.name,refs:s.refs.filter(x=>x.url&&/^https:\/\//.test(x.url))}:null,checkedAt:r.checkedAt,validFrom:r.validFrom,validTo:r.validTo,status:r.status};
}

/* ---------- ゲーム別アダプター（Pokémon Champions） ---------- */
const AI_CALC_SPECIES_NG=new Set([681,964]);  /* 戦闘中に姿が変わる（ギルガルド・イルカマン）は Stage A の計算対象外 */
/* 台帳だけで答えるゲーム別アダプターの共通部分。ほかのゲームの台帳・ツールには決して流さない */
function aiMakeAdapter(gameId,getL,o){
  o=o||{};
  return{gameId,ledger:getL,
    getCapabilities:o.caps||(()=>({intents:[],formats:['single','double']})),
    resolveScope(req){
      const L=getL(),man=L.man||{rulesets:[],current:null};
      if(req.requestedRulesetId!=null&&!man.rulesets.some(r=>r.id===req.requestedRulesetId))return{error:'ruleset_unknown'};
      const rs=man.rulesets.find(r=>r.id===(req.requestedRulesetId||man.current))||null;
      return{scope:{gameId,rulesetId:rs?rs.id:null,format:req.format,dataRevision:L.rev,engineRevision:o.engineRev||null},ruleset:rs};
    },
    resolveEntities(q){return aiFindEntities(q,getL())},
    findEvidence(scope,entityId,field){
      if(scope.gameId!==gameId)return null;
      const e=getL().byEnt.get(entityId);const r=e&&e[field];if(!r)return null;
      if(r.scope.gameId!==gameId)return null;
      if(r.scope.format!=='formatIndependent'&&r.scope.format!==scope.format)return null;
      if(r.scope.rulesetId&&r.scope.rulesetId!==scope.rulesetId)return null;
      return r;
    },
    runTool(name,input,scope,env){if(scope.gameId!==gameId)return{ok:false,err:'tool_unknown'};const f=(o.tools||{})[name];return f?f(input,scope,env):{ok:false,err:'tool_unavailable'}}
  };
}
const AI_ADAPTERS={
  pokechamp:aiMakeAdapter('pokechamp',aiLedger,{engineRev:AI_ENGINE_REV,tools:{calc:(i,s)=>aiCalc(i,s),usage:(i,s,e)=>aiUsage(i,s,e)},
    caps:()=>({intents:AI_INTENTS.filter(x=>x!=='unknown'),formats:['single','double'],
        calc:{contract:'calc-a1',engineRevision:AI_ENGINE_REV,conditions:['通常の姿（メガシンカ・戦闘中の姿の変化なし）','ランク0','HP満タン','天気・場・状態異常・壁なし','持ち物なし','急所なし','相性が等倍','単体を攻撃する、威力が決まった1回だけ当たる技','計算に影響しない特性だけ'],
          abilities:[...AI_CALC_ABILITY_OK].filter(k=>ABN[k]).sort()},
        usage:{source:'usage_seen',minCount:20,maxAgeHours:6,windowDays:30},
        local:['diag','select','build']})})
};

/* ---------- ダメージ計算（画面と同じ関数 dmgRolls・koInfo。条件は calc-a1 の対応表だけ） ---------- */
function aiCalcCheck(inp,scope){
  const L=aiLedger(),need=[];
  if(!inp||typeof inp!=='object')return{need:['attacker','defender','move']};
  const side=(s,k)=>{
    if(!s||typeof s!=='object'){need.push(k);return null}
    const id=String(s.id||''),m=/^sp:(\d+)$/.exec(id),no=m?+m[1]:0,p=no&&byNo[no];
    if(!p||!L.ents.has(id))return{err:'species_unknown'};
    if(L.ents.get(id).mega||p.dno!==undefined||AI_CALC_SPECIES_NG.has(no))return{err:'form_unsupported'};
    const sp=s.sp;if(!Array.isArray(sp)){need.push(k+'.sp');return null}
    if(sp.length!==6||!sp.every(v=>Number.isInteger(v)&&v>=0&&v<=32)||sp.reduce((a,b)=>a+b,0)>66)return{err:'sp_invalid'};
    const nt=s.nature;if(!nt||typeof nt!=='object'){need.push(k+'.nature');return null}
    const up=nt.up,dn=nt.dn;
    if(!Number.isInteger(up)||!Number.isInteger(dn)||!((up===-1&&dn===-1)||(up>=1&&up<=5&&dn>=1&&dn<=5&&up!==dn)))return{err:'nature_invalid'};
    if(typeof s.ability!=='string'||!s.ability){need.push(k+'.ability');return null}
    const abs=(L.byEnt.get(id).abilities||{typedValue:[]}).typedValue.map(x=>x[0]);
    if(!abs.includes(s.ability))return{err:'ability_not_learnable'};
    if(!AI_CALC_ABILITY_OK.has(s.ability)||AI_CALC_SPECIAL.has(s.ability))return{err:'ability_unsupported'};
    return{no,p,sp:[...sp],up,dn,ab:s.ability,id};
  };
  const a=side(inp.attacker,'attacker'),d=side(inp.defender,'defender');
  for(const x of [a,d])if(x&&x.err)return{err:x.err};
  const mm=/^mv:(\d+)$/.exec(String(inp.move||'')),mid=mm?+mm[1]:0;
  if(!inp.move)need.push('move');
  if(need.length)return{need};
  if(!MV[mid])return{err:'move_not_attack'};
  if(!(LSD[a.no]&&LSD[a.no][1].includes(mid)))return{err:'move_not_learnable'};
  const mv=mvObj(mid),k=mkey(mv);
  if(AI_CALC_SPECIAL.has(k)||!(mv.pow>0)||mv.maxH>1||mv.minH>1||mv.tg!==0)return{err:'move_unsupported'};
  return{a,d,mid,mv};
}
function aiCalc(inp,scope){
  const c=aiCalcCheck(inp,scope);if(c.need||c.err)return{ok:false,...c};
  const {a,d,mv}=c,pf=FMT,pw=B.weather;
  try{
    FMT=scope.format;B.weather=null;
    const A=mkMon(a.p,'me',{ab:a.ab,item:null,moves:[mv],sp:a.sp,up:a.up,dn:a.dn}),D=mkMon(d.p,'op',{ab:d.ab,item:null,moves:[mv],sp:d.sp,up:d.up,dn:d.dn});
    A.stg={atk:0,def:0,spa:0,spd:0,spe:0};D.stg={atk:0,def:0,spa:0,spd:0,spe:0};
    const t=hitType(A,mv),eff=mult(t,D.p.t);
    if(eff!==1)return{ok:false,err:'effectiveness_unsupported'};
    if(A.p.no!==a.no||D.p.no!==d.no||A.stAtk||D.stAtk)return{ok:false,err:'form_unsupported'};
    const opt={format:scope.format,crit:false,spread:false,screen:false,cond:false,cnt:0,hits:0,protean:true};
    const r=dmgRolls(A,mv,D,opt),k=koInfo(r,D.max);
    if(r.loss||r.dist||r.next)return{ok:false,err:'calc_unsupported'};
    const rolls=[...r],mn=Math.min(...rolls),mx=Math.max(...rolls);
    return{ok:true,res:{attacker:a.id,defender:d.id,move:'mv:'+c.mid,format:scope.format,rolls,min:mn,max:mx,hp:D.max,
      pctMin:Math.floor(mn/D.max*1000)/10,pctMax:Math.floor(mx/D.max*1000)/10,ko:{n:k.n,p:k.p,sure:k.sure},
      attackerStats:A.st,defenderStats:D.st,stab:A.p.t.includes(t),moveType:t,
      inputs:{attacker:{sp:a.sp,nature:{up:a.up,dn:a.dn},ability:a.ab},defender:{sp:d.sp,nature:{up:d.up,dn:d.dn},ability:d.ab}},
      engineRevision:AI_ENGINE_REV,contract:'calc-a1'}};
  }finally{FMT=pf;B.weather=pw}
}

/* ---------- 当サイトの使用率（usage_seen の公開集計だけ） ---------- */
async function aiUsage(inp,scope,env,now=Date.now()){
  if(!env.DB)return{ok:false,reason:'usage_unavailable'};
  let row;try{row=await env.DB.prepare(`SELECT data,at FROM usage_cache WHERE fmt=?`).bind(scope.format).first()}catch(e){return{ok:false,reason:'usage_unavailable'}}
  if(!row||!row.data)return{ok:false,reason:'usage_missing'};
  let d;try{d=JSON.parse(row.data)}catch(e){return{ok:false,reason:'usage_missing'}}
  const at=Number(d.at||row.at);
  if(!Number.isFinite(at)||!Number.isInteger(d.previews)||d.v!==2)return{ok:false,reason:'usage_incomplete'};
  if(now-at>6*36e5||at>now+6e4)return{ok:false,reason:'usage_stale'};
  if(d.days!==30||d.fmt!==scope.format)return{ok:false,reason:'usage_period_unknown'};
  const no=+String(inp.species||'').replace(/^sp:/,'');
  const s=(Array.isArray(d.seen)?d.seen:[]).find(x=>Array.isArray(x)&&x[0]===no);
  if(!s||!Number.isInteger(s[1]))return{ok:false,reason:'usage_not_listed'};
  if(s[1]<20)return{ok:false,reason:'usage_below_threshold'};
  if(!(d.previews>0))return{ok:false,reason:'usage_incomplete'};
  const share=Math.round(s[1]/d.previews*1000)/10;
  const jst=t=>new Date(t+9*36e5).toISOString().slice(0,10);
  return{ok:true,res:{species:'sp:'+no,count:s[1],previews:d.previews,share,format:d.fmt,from:jst(at-30*864e5),to:jst(at),generatedAt:at,
    cap:20000,capped:d.previews>=20000,dedup:'同じ人・同じ日・同じ6匹は1回（形式は区別しない）。記録されたサンプルの割合です'}};
}

/* ---------- 模擬アダプター（決まった規則で意図と候補を選ぶ。外へは送らない） ---------- */
const AI_PLAN_KEYS=['intent','refs'];
const AI_REF_KEYS=['species','move','attacker','defender','ability','tool'];
const MockProvider={
  id:'mock',model:'mock-plan-1',
  async generatePlan(input,schema,limits,signal,env){
    const mode=String(env.AI_MOCK_MODE||'normal'),delay=Math.min(+env.AI_MOCK_DELAY_MS||0,10000);
    if(delay)await new Promise((res,rej)=>{const t=setTimeout(res,delay);signal&&signal.addEventListener('abort',()=>{clearTimeout(t);rej(new Error('aborted'))})});
    if(mode==='timeout')await new Promise((res,rej)=>{signal&&signal.addEventListener('abort',()=>rej(Object.assign(new Error('timeout'),{kind:'timeout'})))});
    if(mode==='error')return{ok:false,errorKind:'provider_error',usage:{input:0,output:0,known:true}};
    if(mode==='usage_unknown')return{ok:false,errorKind:'network',usage:{known:false}};
    const q=String(input.question),cs=input.candidates,usage={input:aiTokEst(JSON.stringify(input)),output:96,known:true};
    let intent='unknown';
    const R=[[/ダメージ|確定|何発|乱数|削れ/,'damage_calc'],[/使用率|よく使われ|採用率/,'usage_share'],[/診断|選出|構築|パーティ/,'party_tool'],
      [/使える|使用可能|レギュ|禁止|ルール上/,'legality'],[/覚え/,'learns_move'],[/能力ポイント|\bap\b|ＡＰ|努力値/i,'sp_rule'],
      [/種族値|ステータス|能力値/,'species_stats'],[/タイプ/,'species_types'],[/特性/,'species_abilities'],[/メガ/,'species_megas'],[/威力|命中|分類|優先度/,'move_info']];
    for(const [re,k] of R)if(re.test(q)){intent=k;break}
    const sp=cs.filter(c=>c.kind==='species'),mv=cs.filter(c=>c.kind==='move'),refs={};
    if(['species_types','species_stats','species_abilities','species_megas','usage_share','legality'].includes(intent)&&sp[0])refs.species=sp[0].ref;
    if(intent==='learns_move'){if(sp[0])refs.species=sp[0].ref;if(mv[0])refs.move=mv[0].ref}
    if(intent==='move_info'&&mv[0])refs.move=mv[0].ref;
    if(intent==='damage_calc'){if(sp[0])refs.attacker=sp[0].ref;if(sp[1])refs.defender=sp[1].ref;if(mv[0])refs.move=mv[0].ref}
    if(intent==='party_tool')refs.tool=/選出/.test(q)?'select':/構築/.test(q)?'build':'diag';
    let plan={intent,refs};
    if(mode==='bad_ids')plan={intent:intent==='unknown'?'species_types':intent,refs:{species:'sp:999999'}};
    if(mode==='free_text')plan={intent,refs,text:'ガブリアスは最強です（出典：公式）'};
    if(mode==='bad_template')plan={intent:'write_anything',refs};
    if(mode==='garbage')plan='{not json';
    return{ok:true,plan,usage};
  }
};
const AI_PROVIDERS={mock:MockProvider};
/* トークンの見積もり：文字数から少なく見積もらない（UTF-8 のバイト数の半分。日本語は1文字1.5トークン） */
const aiTokEst=s=>Math.ceil(new TextEncoder().encode(String(s)).length/2);
/* 提供元の返したものを確かめる：決まった形・決まった意図・こちらが渡した候補の番号だけ */
function aiCheckPlan(plan,cands){
  if(!plan||typeof plan!=='object'||Array.isArray(plan))return null;
  if(Object.keys(plan).some(k=>!AI_PLAN_KEYS.includes(k)))return null;
  if(!AI_INTENTS.includes(plan.intent))return null;
  const refs=plan.refs||{};if(typeof refs!=='object'||Array.isArray(refs))return null;
  const ok=new Set(cands.map(c=>c.ref));
  for(const [k,v] of Object.entries(refs)){
    if(!AI_REF_KEYS.includes(k)||typeof v!=='string')return null;
    if(k==='tool'){if(!['diag','select','build'].includes(v))return null;continue}
    if(!ok.has(v))return null;
  }
  return{intent:plan.intent,refs:{...refs}};
}

/* ---------- 回答カード ---------- */
const aiCard=(templateId,slots,evs,vs)=>({templateId,slots,evidenceIds:evs.map(e=>e.evidenceId),verificationStatus:vs||aiWeakest(evs)});
function aiWeakest(evs){if(!evs.length)return'insufficient';let w=null;for(const e of evs){if(!w||AI_RANK[e.sourceType]<AI_RANK[w])w=e.sourceType}return w}
const aiHold=(reasonCode,extra)=>aiCard('hold',{reasonCode,...(extra||{})},[],'insufficient');
/* 意図と候補から回答を組む。根拠のない値は出さない */
async function aiCompose(ad,scope,plan,cands,body,env){
  const out={cards:[],evidence:new Map(),holds:[]},L=ad.ledger();
  const ev=(ent,field)=>{const r=ad.findEvidence(scope,ent,field);if(!r)return null;if(r.status!=='active'){out.holds.push({ent,field,why:r.status});return null}out.evidence.set(r.evidenceId,aiEvidenceOut(r,L));return r};
  const ti=body.toolInput&&body.toolInput.entities||{};
  const pick=(k)=>{const v=ti[k]||plan.refs[k];return v&&L.ents.has(v)?v:null};
  const nm=ent=>{const r=ev(ent,'name');return r?r.typedValue:null};
  const formCheck=(k)=>{const id=pick(k);if(!id)return{need:k};const c=cands.find(x=>x.ref===id);if(!ti[k]&&c&&c.forms)return{need:k,choices:c.forms};return{id}};
  const i=plan.intent;
  if(i==='unknown')return{status:'unsupported',reasonCode:'intent_unsupported',cards:[aiCard('unsupported',{reasonCode:'intent_unsupported'},[],'insufficient')]};
  if(i==='party_tool'){const tool=plan.refs.tool||'diag';return{status:'needs_input',reasonCode:'local_tool_result',nextAction:{kind:'open_tool',tool},cards:[aiCard('open_tool',{tool},[],'site_calc')]}}
  if(i==='legality'){
    return{status:'insufficient_evidence',reasonCode:'ruleset_unverified',cards:[aiHold('ruleset_unverified',{rulesetId:scope.rulesetId})],evidence:[...out.evidence.values()]};
  }
  if(i==='sp_rule'){
    const a=ev('rule:stats','sp_cap'),b=ev('rule:stats','stat_formula'),c=ev('rule:stats','level');
    if(!a)return{status:'insufficient_evidence',reasonCode:'evidence_missing',cards:[aiHold('evidence_missing')]};
    out.cards.push(aiCard('sp_rule',{total:a.typedValue.total,per:a.typedValue.per,formula:b?b.typedValue:null,level:c?c.typedValue:null},[a,b,c].filter(Boolean)));
  }
  const needSp=['species_types','species_stats','species_abilities','species_megas','learns_move','usage_share'];
  if(needSp.includes(i)){
    const f=formCheck('species');
    if(f.need)return{status:'needs_input',reasonCode:f.choices?'form_ambiguous':'species_missing',nextAction:{kind:'choose',field:'species',choices:(f.choices||[]).map(id=>({ref:id,label:L.ents.get(id).label}))},
      cards:[aiCard('needs_input',{field:'species',choices:(f.choices||[]).map(id=>({ref:id,label:L.ents.get(id).label}))},[],'insufficient')]};
    const sp=f.id,name=nm(sp);if(!name)return{status:'insufficient_evidence',reasonCode:'evidence_missing',cards:[aiHold('evidence_missing')]};
    const nmE=ev(sp,'name');
    if(i==='species_types'){const t=ev(sp,'types');if(t)out.cards.push(aiCard('species_types',{species:sp,name,types:t.typedValue},[nmE,t]))}
    if(i==='species_stats'){const t=ev(sp,'stats');if(t)out.cards.push(aiCard('species_stats',{species:sp,name,stats:t.typedValue,total:t.typedValue.reduce((x,y)=>x+y,0)},[nmE,t]))}
    if(i==='species_abilities'){const t=ev(sp,'abilities');if(t){const list=t.typedValue.map(([k,h])=>{const n=ev('ab:'+k,'name');return n?{ability:'ab:'+k,name:n.typedValue,hidden:!!h}:null});
      if(list.every(Boolean))out.cards.push(aiCard('species_abilities',{species:sp,name,abilities:list},[nmE,t,...list.map(x=>L.byEnt.get(x.ability).name)]))}}
    if(i==='species_megas'){const e=L.ents.get(sp);
      if(e.mega){const st=ev(sp,'stats'),s=ev(sp,'mega_stone'),b=ev(sp,'mega_of'),t=ev(sp,'types');if(st&&s&&b&&t)out.cards.push(aiCard('species_megas',{species:sp,name,megas:[{species:sp,name,stone:s.typedValue,types:t.typedValue,stats:st.typedValue}]},[nmE,st,s,b,t]))}
      else{const m=ev(sp,'megas');
        if(!m)out.cards.push(aiCard('species_megas',{species:sp,name,megas:[]},[nmE]));
        else{const list=m.typedValue.map(no=>{const id='sp:'+no,n=ev(id,'name'),s=ev(id,'mega_stone'),t=ev(id,'types'),st=ev(id,'stats');return n&&s&&t&&st?{species:id,name:n.typedValue,stone:s.typedValue,types:t.typedValue,stats:st.typedValue,_e:[n,s,t,st]}:null}).filter(Boolean);
          out.cards.push(aiCard('species_megas',{species:sp,name,megas:list.map(({_e,...x})=>x)},[nmE,m,...list.flatMap(x=>x._e)]))}}
      /* このレギュレーションで使えるかは、期間の根拠が確認できないので答えない */
      out.holds.push({ent:sp,field:'legality',why:'ruleset_unverified'});
    }
    if(i==='learns_move'){const f2=pick('move');if(!f2)return{status:'needs_input',reasonCode:'move_missing',nextAction:{kind:'choose',field:'move'},cards:[aiCard('needs_input',{field:'move',choices:[]},[],'insufficient')]};
      const ls=ev(sp,'learnset'),mn=ev(f2,'name');if(ls&&mn){const no=+f2.slice(3);out.cards.push(aiCard('learns_move',{species:sp,name,move:f2,moveName:mn.typedValue,learns:ls.typedValue.includes(no)},[nmE,mn,ls]))}}
    if(i==='usage_share'){
      const u=await ad.runTool('usage',{species:sp},scope,env);
      if(!u.ok)return{status:'insufficient_evidence',reasonCode:u.reason,cards:[aiHold(u.reason)],evidence:[...out.evidence.values()]};
      const ue={evidenceId:'usage:'+scope.format+':'+u.res.generatedAt+'#'+sp,entityId:sp,field:'usage_share',typedValue:u.res,scope:{...scope},sourceType:'site_aggregate',label:AI_LABEL.site_aggregate,
        sourceRef:'usage_seen',source:{name:'当サイトの集計（選出画面の読み取り・対戦の記録で見た相手の6匹）',refs:[]},checkedAt:new Date(u.res.generatedAt+9*36e5).toISOString().slice(0,10),validFrom:u.res.from,validTo:u.res.to,status:'active'};
      out.evidence.set(ue.evidenceId,ue);out.cards.push(aiCard('usage_share',{...u.res,name},[nmE,ue]));
    }
  }
  if(i==='move_info'){const id=pick('move');if(!id)return{status:'needs_input',reasonCode:'move_missing',nextAction:{kind:'choose',field:'move'},cards:[aiCard('needs_input',{field:'move',choices:[]},[],'insufficient')]};
    const n=ev(id,'name'),fs=['type','power','accuracy','category','priority'].map(f=>[f,ev(id,f)]);
    const got=fs.filter(x=>x[1]);
    if(n&&got.length)out.cards.push(aiCard('move_info',{move:id,name:n.typedValue,...Object.fromEntries(got.map(([f,r])=>[f,r.typedValue]))},[n,...got.map(x=>x[1])]));
    if(n&&!got.length)out.holds.push({ent:id,field:'move_data',why:'evidence_missing'});
  }
  if(i==='damage_calc'){
    const c=body.toolInput&&body.toolInput.calc;
    const merged={...(c||{})};
    if(!merged.attacker&&plan.refs.attacker)merged.attacker={id:plan.refs.attacker};
    if(!merged.defender&&plan.refs.defender)merged.defender={id:plan.refs.defender};
    if(!merged.move&&plan.refs.move)merged.move=plan.refs.move;
    const ck=aiCalcCheck(merged,scope);
    if(ck.need)return{status:'needs_input',reasonCode:'calc_input_missing',nextAction:{kind:'calc_form',need:ck.need,prefill:{attacker:merged.attacker&&merged.attacker.id||null,defender:merged.defender&&merged.defender.id||null,move:merged.move||null}},
      cards:[aiCard('needs_input',{field:'calc',need:ck.need},[],'insufficient')]};
    if(ck.err)return{status:'unsupported',reasonCode:ck.err,nextAction:{kind:'open_calc',route:'#/calc'},cards:[aiCard('unsupported',{reasonCode:ck.err,tool:'calc'},[],'insufficient')]};
    const r=ad.runTool('calc',merged,scope,env);
    if(!r.ok)return{status:'unsupported',reasonCode:r.err||'calc_unsupported',nextAction:{kind:'open_calc',route:'#/calc'},cards:[aiCard('unsupported',{reasonCode:r.err||'calc_unsupported',tool:'calc'},[],'insufficient')]};
    const nA=ev(r.res.attacker,'name'),nD=ev(r.res.defender,'name'),nM=ev(r.res.move,'name');
    const pe=[ev(r.res.attacker,'stats'),ev(r.res.defender,'stats'),ev(r.res.attacker,'types'),ev(r.res.defender,'types'),ev(r.res.move,'power'),ev(r.res.move,'type'),ev(r.res.move,'category')];
    if(!nA||!nD||!nM||pe.some(x=>!x))return{status:'insufficient_evidence',reasonCode:'evidence_missing',cards:[aiHold('evidence_missing')]};
    const ce={evidenceId:'calc:'+AI_ENGINE_REV+':'+r.res.attacker+'>'+r.res.move+'>'+r.res.defender+':'+scope.format,entityId:r.res.move,field:'damage',typedValue:{rolls:r.res.rolls,hp:r.res.hp},scope:{...scope},
      sourceType:'site_calc',label:AI_LABEL.site_calc,sourceRef:'src:calc',source:{name:'このサイトのダメージ計算（画面と同じ関数）',refs:[]},checkedAt:null,validFrom:null,validTo:null,status:'active',engineRevision:AI_ENGINE_REV};
    out.evidence.set(ce.evidenceId,ce);
    out.cards.push(aiCard('damage_calc',{...r.res,attackerName:nA.typedValue,defenderName:nD.typedValue,moveName:nM.typedValue},[nA,nD,nM,...pe,ce],'site_calc'));
  }
  const evidence=[...out.evidence.values()];
  if(!out.cards.length)return{status:'insufficient_evidence',reasonCode:out.holds[0]?out.holds[0].why==='conflict'?'evidence_conflict':out.holds[0].why:'evidence_missing',cards:[aiHold(out.holds[0]?(out.holds[0].why==='conflict'?'evidence_conflict':out.holds[0].why):'evidence_missing')],evidence};
  for(const h of out.holds)out.cards.push(aiHold(h.why==='conflict'?'evidence_conflict':h.why,{entityId:h.ent,field:h.field}));
  return{status:out.holds.length?'partial':'answered',cards:out.cards.slice(0,AI_MAX_CARDS),evidence};
}
/* 最後の検証：カードの番号がすべて返す根拠にあり、スロットの値が根拠の値と同じか。合わなければ定型文に落とす */
function aiVerify(res,L){
  const E=new Map((res.evidence||[]).map(e=>[e.evidenceId,e]));
  for(const c of res.cards||[]){
    if(!AI_TEMPLATES.includes(c.templateId))return false;
    for(const id of c.evidenceIds){const e=E.get(id);if(!e)return false;
      const base=L&&L.recs.get(id);if(base&&JSON.stringify(base.typedValue)!==JSON.stringify(e.typedValue))return false;
      if(!base&&!/^(calc|usage):/.test(id))return false;
      if(e.scope&&res.scope&&e.scope.gameId!==res.scope.gameId)return false;
      if(e.status!=='active')return false}
    const s=c.slots||{},got=f=>{const e=c.evidenceIds.map(x=>E.get(x)).find(e=>e.field===f&&(!s.species||e.entityId===s.species||f==='name'));return e&&e.typedValue};
    if(c.templateId==='species_types'&&JSON.stringify(s.types)!==JSON.stringify(got('types')))return false;
    if(c.templateId==='species_stats'&&JSON.stringify(s.stats)!==JSON.stringify(got('stats')))return false;
    if(c.templateId==='damage_calc'){const d=c.evidenceIds.map(x=>E.get(x)).find(e=>e.field==='damage');if(!d||JSON.stringify(d.typedValue.rolls)!==JSON.stringify(s.rolls))return false}
  }
  return true;
}

/* ---------- 利用枠・費用（AI_DB） ---------- */
const aiJst=t=>new Date(t+9*36e5).toISOString();
const aiDay=t=>aiJst(t).slice(0,10),aiMonth=t=>aiJst(t).slice(0,7);
function aiResets(now){const j=new Date(now+9*36e5);const d=Date.UTC(j.getUTCFullYear(),j.getUTCMonth(),j.getUTCDate()+1)-9*36e5,m=Date.UTC(j.getUTCFullYear(),j.getUTCMonth()+1,1)-9*36e5;return{day:d,month:m}}
async function aiHmac(env,s){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(String(env.AI_HASH_KEY)),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const b=new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(s)));return [...b].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,40)}
const aiCanon=o=>Array.isArray(o)?'['+o.map(aiCanon).join(',')+']':o&&typeof o==='object'?'{'+Object.keys(o).sort().map(k=>JSON.stringify(k)+':'+aiCanon(o[k])).join(',')+'}':JSON.stringify(o);
const aiInt=(v,d)=>{const n=Number(v);return Number.isInteger(n)&&n>=0?n:d};
function aiCfg(env){return{freeDay:aiInt(env.AI_FREE_DAY,5),freeMonth:aiInt(env.AI_FREE_MONTH,30),paidMonth:aiInt(env.AI_PAID_MONTH,300),
  rlUser:aiInt(env.AI_RL_USER_MIN,6),rlIp:aiInt(env.AI_RL_IP_MIN,20),rlAll:aiInt(env.AI_RL_GLOBAL_MIN,600),ttl:aiInt(env.AI_TTL_MS,60000),
  budget:env.AI_BUDGET_MICRO===undefined||env.AI_BUDGET_MICRO===''?null:aiInt(env.AI_BUDGET_MICRO,null)}}
async function aiPlanOf(db,uidH,now){
  const e=await db.prepare(`SELECT plan,valid_to FROM ai_entitlements WHERE uid_h=?`).bind(uidH).first();
  return e&&e.plan==='paid_test'&&(e.valid_to==null||e.valid_to>now)?'paid_test':'free';
}
function aiLimits(cfg,plan){return plan==='paid_test'?{day:cfg.paidMonth,month:cfg.paidMonth}:{day:cfg.freeDay,month:cfg.freeMonth}}
async function aiUsageOf(db,uidH,plan,cfg,now){
  const day=aiDay(now),month=aiMonth(now),lim=aiLimits(cfg,plan);
  const r=await db.prepare(`SELECT
    (SELECT COUNT(*) FROM ai_requests WHERE uid_h=?1 AND day=?2 AND (state IN('reserved','sent') OR consumed=1)) AS d,
    (SELECT COUNT(*) FROM ai_requests WHERE uid_h=?1 AND month=?3 AND (state IN('reserved','sent') OR consumed=1)) AS m`).bind(uidH,day,month).first();
  const rs=aiResets(now);
  return{plan,day:{used:r.d,limit:lim.day,resetAt:rs.day},month:{used:r.m,limit:lim.month,resetAt:rs.month},
    note:'AIの利用には処理費用がかかるため、サイト運営を続けながら、みなさんが公平に使えるよう回数に上限を設けています。'};
}
async function aiPrice(db,provider,model,now){
  return db.prepare(`SELECT id,in_per_m,out_per_m FROM ai_prices WHERE provider=? AND model=? AND valid_from<=? AND (valid_to IS NULL OR valid_to>?) ORDER BY valid_from DESC LIMIT 1`).bind(provider,model,now,now).first();
}
const aiCost=(p,tin,tout)=>Math.ceil(tin*p.in_per_m/1e6)+Math.ceil(tout*p.out_per_m/1e6);
/* 頻度の上限：1分ごとの窓。条件つきの upsert なので同時に来ても上限を超えない */
async function aiRate(db,keys,now){
  const win=Math.floor(now/6e4),st=keys.map(([k,lim])=>db.prepare(`INSERT INTO ai_rate(k,win,n,exp) VALUES(?1,?2,1,?3) ON CONFLICT(k,win) DO UPDATE SET n=n+1 WHERE n<?4`).bind(k,win,now+864e5,lim));
  const rs=await db.batch(st);
  const i=rs.findIndex(r=>!(r.meta&&r.meta.changes>0));
  return i<0?null:{which:keys[i][2],resetAt:(win+1)*6e4};
}
/* 予約：期限切れの回収と、会員枠・同時枠・全体の費用の条件つき INSERT を1つの取引で */
async function aiReserve(db,o){
  const {uidH,rid,inH,plan,lim,cfg,max,provider,model,priceId,now}=o,day=aiDay(now),month=aiMonth(now),old=now-cfg.ttl;
  const rs=await db.batch([
    db.prepare(`UPDATE ai_requests SET state='released',cost_micro=0,updated_at=?1 WHERE state='reserved' AND updated_at<?2`).bind(now,old),
    db.prepare(`UPDATE ai_requests SET state='expired',updated_at=?1 WHERE state='sent' AND updated_at<?2`).bind(now,old),
    db.prepare(`INSERT INTO ai_requests(uid_h,rid,in_h,plan,day,month,state,consumed,max_micro,cost_micro,cost_final,provider,model,price_id,created_at,updated_at)
      SELECT ?1,?2,?3,?4,?5,?6,'reserved',0,?7,?7,0,?8,?9,?10,?11,?11
      WHERE (SELECT COUNT(*) FROM ai_requests WHERE uid_h=?1 AND state IN('reserved','sent'))<1
        AND (SELECT COUNT(*) FROM ai_requests WHERE uid_h=?1 AND day=?5 AND (state IN('reserved','sent') OR consumed=1))<?12
        AND (SELECT COUNT(*) FROM ai_requests WHERE uid_h=?1 AND month=?6 AND (state IN('reserved','sent') OR consumed=1))<?13
        AND (SELECT COALESCE(SUM(cost_micro),0) FROM ai_requests WHERE month=?6)+(SELECT COALESCE(SUM(micro),0) FROM ai_cost_archive WHERE month=?6)+?7<=?14
      ON CONFLICT(uid_h,rid) DO NOTHING`).bind(uidH,rid,inH,plan,day,month,max,provider,model,priceId,now,lim.day,lim.month,cfg.budget)
  ]);
  if(rs[2].meta&&rs[2].meta.changes>0)return{ok:true};
  /* 入らなかった理由（同じ受付ID・同時・日・月・全体の費用） */
  const ex=await db.prepare(`SELECT in_h,state,resp,status FROM ai_requests WHERE uid_h=? AND rid=?`).bind(uidH,rid).first();
  if(ex)return{ok:false,dup:ex};
  const q=await db.prepare(`SELECT
    (SELECT COUNT(*) FROM ai_requests WHERE uid_h=?1 AND state IN('reserved','sent')) AS c,
    (SELECT COUNT(*) FROM ai_requests WHERE uid_h=?1 AND day=?2 AND (state IN('reserved','sent') OR consumed=1)) AS d,
    (SELECT COUNT(*) FROM ai_requests WHERE uid_h=?1 AND month=?3 AND (state IN('reserved','sent') OR consumed=1)) AS m`).bind(uidH,day,month).first();
  const rs2=aiResets(now);
  if(q.c>=1)return{ok:false,limit:'concurrent',resetAt:now+cfg.ttl};
  if(q.m>=lim.month)return{ok:false,limit:'month',resetAt:rs2.month};
  if(q.d>=lim.day)return{ok:false,limit:'day',resetAt:rs2.day};
  return{ok:false,limit:'budget'};
}
async function aiMarkSent(db,uidH,rid,now){const r=await db.prepare(`UPDATE ai_requests SET state='sent',updated_at=? WHERE uid_h=? AND rid=? AND state='reserved'`).bind(now,uidH,rid).run();return r.meta&&r.meta.changes>0}
async function aiRelease(db,uidH,rid,now,reason){await db.prepare(`UPDATE ai_requests SET state='released',cost_micro=0,reason=?,updated_at=? WHERE uid_h=? AND rid=? AND state='reserved'`).bind(reason,now,uidH,rid).run()}
/* 完了：sent のときだけ（冪等）。使用量が分からなければ最大費用のまま（cost_final=0） */
async function aiFinish(db,o){
  const r=await db.prepare(`UPDATE ai_requests SET state='done',consumed=?,cost_micro=MIN(max_micro,?),cost_final=?,status=?,reason=?,resp=?,updated_at=? WHERE uid_h=? AND rid=? AND state='sent'`)
    .bind(o.consumed?1:0,o.cost,o.final?1:0,o.status,o.reason||null,o.resp||null,o.now,o.uidH,o.rid).run();
  return r.meta&&r.meta.changes>0;
}
/* 精算：あとから使用量が確定したときだけ減らす（増やさない。一度だけ） */
async function aiSettle(db,uidH,rid,cost,now){
  const r=await db.prepare(`UPDATE ai_requests SET cost_micro=MIN(cost_micro,?),cost_final=1,updated_at=? WHERE uid_h=? AND rid=? AND state IN('done','expired') AND cost_final=0`).bind(Math.max(0,cost|0),now,uidH,rid).run();
  return r.meta&&r.meta.changes>0;
}
/* 期限削除：IP・頻度は24時間、重複防止の情報（入力のハッシュ・回答）は24時間、受付は90日（費用は匿名の月集計に移す） */
async function aiPurge(db,now){
  const c90=now-90*864e5;
  await db.batch([
    db.prepare(`DELETE FROM ai_rate WHERE exp<?`).bind(now),
    db.prepare(`UPDATE ai_requests SET in_h='',resp=NULL WHERE created_at<? AND (in_h<>'' OR resp IS NOT NULL) AND state IN('done','released','expired')`).bind(now-864e5),
    db.prepare(`INSERT INTO ai_cost_archive(month,micro) SELECT month,SUM(cost_micro) FROM ai_requests WHERE created_at<?1 GROUP BY month HAVING 1 ON CONFLICT(month) DO UPDATE SET micro=micro+excluded.micro`).bind(c90),
    db.prepare(`DELETE FROM ai_requests WHERE created_at<?`).bind(c90)
  ]);
}
/* 会員の削除：その人の受付・権限を消す（費用だけ匿名の月集計に残す）。何度呼んでも同じ結果 */
async function aiForgetUser(env,uid){
  if(!env.AI_DB||!env.AI_HASH_KEY||String(env.AI_HASH_KEY).length<32)return false;
  const db=env.AI_DB,uidH=await aiHmac(env,'u|'+uid);
  await db.batch([
    db.prepare(`INSERT INTO ai_cost_archive(month,micro) SELECT month,SUM(cost_micro) FROM ai_requests WHERE uid_h=?1 GROUP BY month HAVING 1 ON CONFLICT(month) DO UPDATE SET micro=micro+excluded.micro`).bind(uidH),
    db.prepare(`DELETE FROM ai_requests WHERE uid_h=?`).bind(uidH),
    db.prepare(`DELETE FROM ai_entitlements WHERE uid_h=?`).bind(uidH)
  ]);
  return true;
}

/* ---------- 入口 ---------- */
const AJ=(o,st=200,h={})=>new Response(JSON.stringify(o),{status:st,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...h}});
const AE=(st,reasonCode,extra)=>AJ({status:st===429||st===503?'unavailable':'error',reasonCode,...(extra||{})},st);
const AI_ORIGIN=(o,env)=>!!o&&String(env.AI_ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean).includes(o);
async function aiReadBody(req){
  const ct=(req.headers.get('content-type')||'').toLowerCase();
  if(!/^application\/json(\s*;\s*charset=utf-8)?$/.test(ct.trim()))return{err:[400,'content_type']};
  const cl=+req.headers.get('content-length')||0;if(cl>AI_MAX_BODY)return{err:[413,'body_too_large']};
  if(!req.body)return{err:[400,'body_missing']};
  const rd=req.body.getReader(),parts=[];let n=0;
  for(;;){const {done,value}=await rd.read();if(done)break;n+=value.byteLength;if(n>AI_MAX_BODY){try{rd.cancel()}catch(e){}return{err:[413,'body_too_large']}}parts.push(value)}
  const u=new Uint8Array(n);let o=0;for(const p of parts){u.set(p,o);o+=p.byteLength}
  let j;try{j=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(u))}catch(e){return{err:[400,'json_invalid']}}
  return{j};
}
const AI_BODY_KEYS=['gameId','format','requestedRulesetId','question','toolInput','requestId'];
function aiValidBody(b){
  if(!b||typeof b!=='object'||Array.isArray(b))return'body_invalid';
  if(Object.keys(b).some(k=>!AI_BODY_KEYS.includes(k)))return'field_unknown';
  if(typeof b.gameId!=='string'||!/^[a-z0-9_-]{1,32}$/.test(b.gameId))return'game_invalid';
  if(b.format!=='single'&&b.format!=='double')return'format_invalid';
  if(b.requestedRulesetId!==undefined&&b.requestedRulesetId!==null&&(typeof b.requestedRulesetId!=='string'||!/^[A-Za-z0-9-]{1,16}$/.test(b.requestedRulesetId)))return'ruleset_invalid';
  if(typeof b.question!=='string'||!b.question.trim())return'question_missing';
  if([...b.question].length>AI_MAX_Q)return'question_too_long';
  if(typeof b.requestId!=='string'||!/^[A-Za-z0-9_-]{8,64}$/.test(b.requestId))return'request_id_invalid';
  if(b.toolInput!==undefined&&b.toolInput!==null){const t=b.toolInput;
    if(typeof t!=='object'||Array.isArray(t)||Object.keys(t).some(k=>!['entities','calc'].includes(k)))return'tool_input_invalid';
    if(t.entities!==undefined){if(!t.entities||typeof t.entities!=='object'||Array.isArray(t.entities)||Object.entries(t.entities).some(([k,v])=>!['species','move'].includes(k)||typeof v!=='string'||!/^(sp|mv):\d{1,6}$/.test(v)))return'tool_input_invalid'}
    if(t.calc!==undefined){const c=t.calc;if(!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(k=>!['attacker','defender','move'].includes(k)))return'tool_input_invalid';
      if(c.move!==undefined&&(typeof c.move!=='string'||!/^mv:\d{1,6}$/.test(c.move)))return'tool_input_invalid';
      for(const s of [c.attacker,c.defender]){if(s===undefined)continue;if(!s||typeof s!=='object'||Array.isArray(s)||Object.keys(s).some(k=>!['id','sp','nature','ability'].includes(k)))return'tool_input_invalid';
        if(typeof s.id!=='string'||!/^sp:\d{1,6}$/.test(s.id))return'tool_input_invalid';
        if(s.sp!==undefined&&(!Array.isArray(s.sp)||s.sp.length!==6))return'tool_input_invalid';
        if(s.nature!==undefined&&(!s.nature||typeof s.nature!=='object'||Object.keys(s.nature).some(k=>!['up','dn'].includes(k))))return'tool_input_invalid';
        if(s.ability!==undefined&&(typeof s.ability!=='string'||!/^[a-z-]{1,32}$/.test(s.ability)))return'tool_input_invalid'}}}
  return null;
}
async function aiApi(req,env,u,ctx){
  /* 1) 明示的に有効にしていなければ、何にもつながずに終える */
  if(env.AI_ENABLED!=='1')return AE(503,'ai_disabled');
  const path=u.pathname.replace(/\/+$/,'');
  if(path!=='/api/ai/v1/context'&&path!=='/api/ai/v1/answer')return AE(404,'not_found');
  /* 2) 呼び出してよいサイト（AI 用の許可リストだけ。CORS は認証の代わりにしない） */
  if(!AI_ORIGIN(req.headers.get('origin'),env))return AE(403,'origin_forbidden');
  if(path==='/api/ai/v1/context'&&req.method!=='GET')return AE(405,'method');
  if(path==='/api/ai/v1/answer'&&req.method!=='POST')return AE(405,'method');
  /* 3) 本人確認 */
  const me=fbPid(env)?await authOf(req,env):null;
  if(!me)return AE(401,'auth_required');
  /* 4) 依存先と設定。足りなければ提供元を呼ばない */
  const cfg=aiCfg(env),prov=AI_PROVIDERS[env.AI_PROVIDER];
  if(!env.AI_HASH_KEY||String(env.AI_HASH_KEY).length<32)return AE(503,'config_missing');
  if(!prov)return AE(503,'provider_not_enabled');
  if(cfg.budget==null)return AE(503,'budget_unset');
  const db=env.AI_DB;if(!db)return AE(503,'ai_db_missing');
  const now=Date.now();
  try{const m=await db.prepare(`SELECT v FROM ai_meta WHERE k='schema'`).first();if(!m||m.v!==AI_SCHEMA_VERSION)return AE(503,'ai_db_unmigrated')}catch(e){return AE(503,'ai_db_unavailable')}
  /* 5) 停止中の会員（主DB）。読めなければ止める */
  try{if(env.DB){const r=await env.DB.prepare(`SELECT banned FROM users WHERE uid=?`).bind(me.uid).first();if(r&&r.banned)return AE(403,'member_suspended')}}
  catch(e){if(!/no such table/i.test(String(e&&e.message)))return AE(503,'member_check_unavailable')}
  let uidH;try{uidH=await aiHmac(env,'u|'+me.uid)}catch(e){return AE(503,'config_missing')}
  let plan;try{plan=await aiPlanOf(db,uidH,now)}catch(e){return AE(503,'ai_db_unavailable')}
  if(path==='/api/ai/v1/context'){
    const gid=u.searchParams.get('gameId')||'',fmt=u.searchParams.get('format')||'single';
    if(!/^[a-z0-9_-]{1,32}$/.test(gid)||(fmt!=='single'&&fmt!=='double'))return AE(400,'query_invalid');
    let usage;try{usage=await aiUsageOf(db,uidH,plan,cfg,now)}catch(e){return AE(503,'ai_db_unavailable')}
    const ad=AI_ADAPTERS[gid];
    if(!ad)return AJ({status:'unsupported',reasonCode:'game_unsupported',enabled:true,usage});
    const s=ad.resolveScope({format:fmt});
    return AJ({status:'ok',enabled:true,scope:s.scope,ruleset:s.ruleset,capabilities:ad.getCapabilities(),usage,limits:{question:AI_MAX_Q}});
  }
  /* 6) 質問の形 */
  const rb=await aiReadBody(req);if(rb.err)return AE(rb.err[0],rb.err[1]);
  const body=rb.j,bad=aiValidBody(body);if(bad)return AE(400,bad);
  const rid=body.requestId,inp={gameId:body.gameId,format:body.format,requestedRulesetId:body.requestedRulesetId||null,question:body.question.normalize('NFKC').trim(),toolInput:body.toolInput||null};
  const inH=await aiHmac(env,'i|'+uidH+'|'+aiCanon(inp));
  const replay=ex=>{if(ex.in_h!==inH)return AE(409,'request_id_reused');
    if(ex.state==='done'&&ex.resp){let j;try{j=JSON.parse(ex.resp)}catch(e){j=null}if(j)return AJ({...j,replayed:true})}
    if(ex.state==='reserved'||ex.state==='sent')return AJ({status:'unavailable',reasonCode:'duplicate_in_progress',nextAction:{kind:'retry_later'},requestId:rid});
    return AJ({status:'unavailable',reasonCode:'duplicate_finished',nextAction:{kind:'new_request'},requestId:rid})};
  try{const ex=await db.prepare(`SELECT in_h,state,resp FROM ai_requests WHERE uid_h=? AND rid=?`).bind(uidH,rid).first();if(ex)return replay(ex)}catch(e){return AE(503,'ai_db_unavailable')}
  /* 7) ゲームとスコープ（ほかのゲームへ流さない）。未対応は枠を使わない */
  const ad=AI_ADAPTERS[body.gameId];
  let usage0;try{usage0=await aiUsageOf(db,uidH,plan,cfg,now)}catch(e){return AE(503,'ai_db_unavailable')}
  if(!ad)return AJ({status:'unsupported',scope:{gameId:body.gameId},cards:[aiCard('unsupported',{reasonCode:'game_unsupported'},[],'insufficient')],evidence:[],reasonCode:'game_unsupported',usage:usage0,requestId:rid});
  const sc=ad.resolveScope({format:body.format,requestedRulesetId:body.requestedRulesetId});
  if(sc.error)return AJ({status:'unsupported',scope:{gameId:body.gameId,format:body.format},cards:[aiCard('unsupported',{reasonCode:sc.error},[],'insufficient')],evidence:[],reasonCode:sc.error,usage:usage0,requestId:rid});
  const scope=sc.scope,cands=ad.resolveEntities(inp.question);
  const pin={question:inp.question,candidates:cands.map(c=>({ref:c.ref,kind:c.kind,label:c.label})),intents:AI_INTENTS,templates:AI_TEMPLATES};
  const tin=aiTokEst(JSON.stringify(pin));
  if(tin>AI_LIMITS.maxInputTokens)return AE(400,'input_budget');
  /* 8) 頻度の上限（会員・IP・全体）→ 予約 */
  let price;try{price=await aiPrice(db,prov.id,prov.model,now)}catch(e){return AE(503,'ai_db_unavailable')}
  if(!price)return AE(503,'price_missing');
  const max=aiCost(price,AI_LIMITS.maxInputTokens,AI_LIMITS.maxOutputTokens);
  try{
    const ip=req.headers.get('cf-connecting-ip')||'0.0.0.0',ipH=await aiHmac(env,'ip|'+aiDay(now)+'|'+ip);
    const rl=await aiRate(db,[['u:'+uidH,cfg.rlUser,'member'],['i:'+ipH,cfg.rlIp,'ip'],['g',cfg.rlAll,'global']],now);
    if(rl)return AE(429,'rate_'+rl.which,{resetAt:rl.resetAt,usage:usage0});
    if(Math.random()<.02)ctx&&ctx.waitUntil&&ctx.waitUntil(aiPurge(db,now).catch(()=>{}));
  }catch(e){return AE(503,'ai_db_unavailable')}
  const lim=aiLimits(cfg,plan);
  let rv;try{rv=await aiReserve(db,{uidH,rid,inH,plan,lim,cfg,max,provider:prov.id,model:prov.model,priceId:price.id,now})}catch(e){return AE(503,'ai_db_unavailable')}
  if(!rv.ok){
    if(rv.dup)return replay(rv.dup);
    if(rv.limit==='budget')return AE(503,'budget_exhausted');
    return AE(429,'quota_'+rv.limit,{resetAt:rv.resetAt,usage:usage0});
  }
  /* 9) 送る直前に記録 → 模擬アダプター → 検証 → 完了 */
  try{if(!await aiMarkSent(db,uidH,rid,Date.now())){return AE(503,'ai_db_unavailable')}}catch(e){await aiRelease(db,uidH,rid,Date.now(),'mark_failed').catch(()=>{});return AE(503,'ai_db_unavailable')}
  const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),Math.min(aiInt(env.AI_TIMEOUT_MS,AI_LIMITS.timeoutMs),AI_LIMITS.timeoutMs));
  let g;try{g=await prov.generatePlan(pin,{intents:AI_INTENTS,refKeys:AI_REF_KEYS},AI_LIMITS,ctl.signal,env)}
  catch(e){g={ok:false,errorKind:ctl.signal.aborted?'timeout':'provider_error',usage:{known:false}}}
  finally{clearTimeout(tm)}
  const known=g&&g.usage&&g.usage.known,cost=known?aiCost(price,Math.min(g.usage.input||0,AI_LIMITS.maxInputTokens),Math.min(g.usage.output||0,AI_LIMITS.maxOutputTokens)):max;
  const fin=async(status,reason,resp,consumed)=>{try{await aiFinish(db,{uidH,rid,status,reason,resp,consumed,cost,final:!!known,now:Date.now()})}catch(e){}};
  if(!g||!g.ok){await fin('unavailable',g&&g.errorKind||'provider_error',null,false);
    return AE(503,g&&g.errorKind==='timeout'?'provider_timeout':'provider_unavailable',{requestId:rid})}
  const plan2=aiCheckPlan(g.plan,pin.candidates);
  let res;
  if(!plan2)res={status:'unavailable',reasonCode:'plan_invalid',cards:[aiCard('unavailable',{reasonCode:'plan_invalid'},[],'insufficient')],evidence:[]};
  else{try{res=await aiCompose(ad,scope,plan2,cands,body,env)}catch(e){res={status:'unavailable',reasonCode:'compose_failed',cards:[aiCard('unavailable',{reasonCode:'compose_failed'},[],'insufficient')],evidence:[]}}}
  res.evidence=res.evidence||[];
  res.scope=scope;
  if(!aiVerify(res,ad.ledger()))res={status:'unavailable',reasonCode:'verify_failed',cards:[aiCard('unavailable',{reasonCode:'verify_failed'},[],'insufficient')],evidence:[]};
  const consumed=res.status==='answered'||res.status==='partial';
  const outBody={status:res.status,scope,cards:res.cards,evidence:res.evidence,reasonCode:res.reasonCode,nextAction:res.nextAction,requestId:rid,provider:{id:prov.id,model:prov.model,mock:true}};
  await fin(res.status,res.reasonCode,JSON.stringify(outBody),consumed);
  let usage;try{usage=await aiUsageOf(db,uidH,plan,cfg,Date.now())}catch(e){usage=null}
  return AJ({...outBody,usage});
}
