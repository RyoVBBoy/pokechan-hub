/* ===================== Game Kid/s AI（Stage A・既定は無効） =====================
   仕様：docs/ai/implementation-spec.md。#/ai。
   ・既定では画面もツール一覧の入口も出さない（config/public.json の ai.enabled が true のときだけ。テストでは navigator.webdriver かつ sessionStorage pcaitest=1）
   ・送り先は決まった Worker だけ（AI_API）。COMM_API のような端末の設定での上書きはしない（Bearer をほかへ送らないため）
   ・回答は「カードの種類＋サーバーが埋めた値」だけを、この画面の決まった文で表示する（HTML として入れない）
   ・診断・選出は、パーティの画面で計算済みの結果だけをこの端末の中で表示する（サーバーには送らない・サーバーで確かめた値とは書かない） */
const AI_CFG=(typeof window!=='undefined'&&window.PC_CONFIG&&window.PC_CONFIG.ai)||{};
const AI_API='https://pokechan-tap.pokechan.workers.dev';
const AI_GAME='pokechamp';
function aiUiOn(){
  if(AI_CFG.enabled===true)return true;
  try{return !!navigator.webdriver&&sessionStorage.getItem('pcaitest')==='1'}catch(e){return false}
}
const AI_ST={fmt:null,ctx:null,busy:false,last:null,q:''};
const AI_VLAB={official:'公式資料',ingame:'実機で確認',external_match:'外部参照と一致',external_single:'外部参照（1出典・未照合）',site_calc:'サイトの計算・推定',site_estimate:'サイトの計算・推定',site_aggregate:'当サイト集計',insufficient:'根拠不足'};
const AI_REASON={
  ai_disabled:'AI はいま止めています。',auth_required:'使うにはログインしてください。',origin_forbidden:'このページからは使えません。',member_suspended:'このアカウントは停止されています。',
  quota_day:'今日の回数を使い切りました。',quota_month:'今月の回数を使い切りました。',quota_concurrent:'ひとつ前の質問の処理中です。少し待ってください。',
  rate_member:'短い時間に送りすぎました。少し待ってください。',rate_ip:'短い時間に送りすぎました。少し待ってください。',rate_global:'いま混み合っています。少し待ってください。',
  budget_exhausted:'今月の運営の予算に達したため、一時停止しています。',provider_timeout:'時間がかかりすぎたため止めました（回数は使っていません）。',provider_unavailable:'いま答えを作れません（回数は使っていません）。',
  plan_invalid:'質問をうまく読み取れませんでした。言い方を変えてください。',verify_failed:'答えを確かめられなかったため表示しません。',compose_failed:'答えを作れませんでした。',
  intent_unsupported:'この質問にはまだ対応していません。図鑑やツールの画面をご利用ください。',game_unsupported:'このゲームにはまだ対応していません。',ruleset_unknown:'そのレギュレーションのデータはありません。',
  ruleset_unverified:'レギュレーションの期間を公式の資料で確認できていないため、使えるかどうかは答えません。',evidence_missing:'根拠となるデータがありません。',evidence_conflict:'データの確認結果が食い違っているため答えません。',
  usage_stale:'集計が6時間より古いため、数値を出しません。',usage_missing:'集計がまだありません。',usage_incomplete:'集計の件数・時刻が分からないため、数値を出しません。',usage_period_unknown:'集計の期間が分からないため、数値を出しません。',
  usage_below_threshold:'観測が20件未満のため、数値を出しません。',usage_not_listed:'集計に入っていません（3人以上が見たポケモンだけ）。',usage_unavailable:'集計を読めませんでした。',
  form_unsupported:'メガシンカ・戦闘中に姿が変わるポケモンは、ここではまだ計算できません。',ability_unsupported:'その特性は計算に影響するため、ここではまだ計算できません。',ability_not_learnable:'そのポケモンが持てない特性です。',
  move_not_attack:'攻撃技ではありません。',move_not_learnable:'そのポケモンが覚えない技です。',move_unsupported:'連続技・威力が変わる技・範囲技などは、ここではまだ計算できません。',effectiveness_unsupported:'相性が等倍でないときは、ここではまだ計算できません。',
  calc_unsupported:'この条件は、ここではまだ計算できません。',sp_invalid:'能力ポイントは1つ32まで・合計66までです。',nature_invalid:'性格の指定が正しくありません。',species_unknown:'ポケモンが見つかりません。',
  duplicate_in_progress:'同じ質問を処理中です。',duplicate_finished:'この受付は終わっています。もう一度送ってください。',request_id_reused:'受付の番号が重複しました。もう一度送ってください。',
  form_ambiguous:'同じ名前の姿が複数あります。どれか選んでください。',species_missing:'ポケモンの名前を入れてください。',move_missing:'技の名前を入れてください。',calc_input_missing:'条件を確認できると計算できます。',
  local_tool_result:'パーティの診断・選出・構築は、それぞれの画面で計算した結果をこの端末で表示します。',input_budget:'質問が長すぎます。'};
const aiR=k=>AI_REASON[k]||'いまは答えられません。';
const aiNm=ref=>{const m=/^sp:(\d+)$/.exec(ref||'');return m&&byNo[+m[1]]?byNo[+m[1]].n:''};
const aiTime=t=>{try{return new Date(t).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}catch(e){return''}};
async function aiFetch(path,body){
  if(!AUTH.user)throw Object.assign(new Error(aiR('auth_required')),{status:401});
  const h={Authorization:'Bearer '+await AUTH.user.getIdToken()};if(body)h['Content-Type']='application/json';
  let r;try{r=await fetch(AI_API+path,body?{method:'POST',headers:h,body:JSON.stringify(body)}:{headers:h})}catch(e){throw new Error('通信できませんでした。')}
  const j=await r.json().catch(()=>({}));return{status:r.status,j};
}
const aiRid=()=>{const a=new Uint8Array(12);crypto.getRandomValues(a);return 'r'+[...a].map(x=>x.toString(16).padStart(2,'0')).join('')};
/* ---------- カード（決まった文に値を入れるだけ。値は esc で文字として出す） ---------- */
function aiCardText(c){
  const s=c.slots||{},E=esc;
  switch(c.templateId){
    case 'species_types':return `<b>${E(s.name)}</b> のタイプは <b>${(s.types||[]).map(E).join('・')}</b> です。`;
    case 'species_stats':return `<b>${E(s.name)}</b> の種族値：${(s.stats||[]).map((v,i)=>`${E(SN[i])} ${E(v)}`).join('・')}（合計 ${E(s.total)}）`;
    case 'species_abilities':return `<b>${E(s.name)}</b> の特性：${(s.abilities||[]).map(a=>E(a.name)+(a.hidden?'（隠れ特性）':'')).join('・')}`;
    case 'species_megas':return (s.megas||[]).length?`<b>${E(s.name)}</b> のメガシンカ：${s.megas.map(m=>`${E(m.name)}（${(m.types||[]).map(E).join('・')}／種族値 ${(m.stats||[]).map(E).join('-')}）`).join('、')}`:`<b>${E(s.name)}</b> のメガシンカのデータはありません。`;
    case 'learns_move':return `<b>${E(s.name)}</b> は <b>${E(s.moveName)}</b> を${s.learns?'覚えます':'覚えません'}（当サイトの習得技のデータ）。`;
    case 'move_info':return `<b>${E(s.name)}</b>：${s.type?`タイプ ${E(s.type)}`:''}${s.category?`・${E(s.category)}`:''}${s.power!=null?`・威力 ${E(s.power)}`:''}${s.accuracy!=null?`・命中 ${E(s.accuracy)}`:''}${s.priority?`・優先度 ${E(s.priority)}`:''}`;
    case 'sp_rule':return `能力ポイントは <b>合計 ${E(s.total)}・1つの能力に ${E(s.per)} まで</b> です${s.level?`（Lv${E(s.level)}）`:''}。${s.formula?`<br><small>HP＝${E(s.formula.hp)}、ほか＝${E(s.formula.other)}</small>`:''}`;
    case 'damage_calc':{const k=s.ko||{};const ko=!k.n?'ダメージなし':k.n>8?'倒すには9回以上':k.p>=.9999?`確定${E(k.n)}発`:`乱数${E(k.n)}発（${E((k.p*100).toFixed(1))}%）`;
      return `<b>${E(s.attackerName)}</b> の <b>${E(s.moveName)}</b> → <b>${E(s.defenderName)}</b>：<b>${E(s.min)}〜${E(s.max)}</b>（${E(s.pctMin)}〜${E(s.pctMax)}%・HP ${E(s.hp)}）${ko}
        <br><small>前提：${s.format==='double'?'ダブル':'シングル'}・Lv50・ランク0・HP満タン・持ち物なし・天気や場なし・急所なし・相性等倍。計算のリビジョン ${E(s.engineRevision)}。当サイトの計算上の目安です。</small>`}
    case 'usage_share':return `<b>${E(s.name)}</b> は、当サイトで記録した${s.format==='double'?'ダブル':'シングル'}の相手の選出画面 ${E(s.previews)} 件のうち <b>${E(s.count)} 件（${E(s.share)}%）</b> に出てきました（${E(s.from)}〜${E(s.to)}、${E(aiTime(s.generatedAt))} 集計）。
      <br><small>${E(s.dedup)}${s.capped?`。集計の上限（${E(s.cap)}件）に達しています`:''}。ランクバトル全体の使用率ではありません。</small>`;
    case 'hold':return `<span class="ai-hold">保留：${E(aiR(s.reasonCode))}</span>`;
    case 'needs_input':return E(aiR(s.field==='calc'?'calc_input_missing':s.field==='species'&&(s.choices||[]).length?'form_ambiguous':s.field==='species'?'species_missing':'move_missing'));
    case 'unsupported':return E(aiR(s.reasonCode));
    case 'unavailable':return E(aiR(s.reasonCode));
    case 'open_tool':return E(aiR('local_tool_result'));
  }
  return E(aiR(''));
}
function aiEvHTML(c,evs){
  const by=new Map((evs||[]).map(e=>[e.evidenceId,e]));
  const list=(c.evidenceIds||[]).map(id=>by.get(id)).filter(Boolean);
  if(!list.length)return '';
  return `<details class="ai-ev"><summary>根拠 ${list.length}件</summary><ul>${list.map(e=>{const refs=(e.source&&e.source.refs||[]).filter(r=>r.url&&/^https:\/\//.test(r.url));
    return `<li><span class="ai-lab ai-lab-${esc(e.sourceType)}">${esc(AI_VLAB[e.sourceType]||'根拠不足')}</span> ${esc(e.field)}：${esc(e.source?e.source.name:e.sourceRef)}${e.checkedAt?`（${esc(e.checkedAt)} 確認）`:''}${refs.map(r=>` <a href="${esc(r.url)}" target="_blank" rel="noopener nofollow">${esc(r.name)}</a>`).join('')}</li>`}).join('')}</ul></details>`;
}
/* ---------- この端末で計算済みの診断・選出（パーティの画面の結果） ---------- */
function aiLocal(tool){
  const out={ok:false,html:''},fmtN=FMT==='double'?'ダブル':'シングル';
  /* 元の結果のゲーム・形式がこの画面と同じときだけ出す */
  if((typeof curGame==='function'&&curGame().id&&curGame().id!==AI_GAME)||FMT!==AI_ST.fmt)return{ok:false,html:`パーティの画面は${fmtN}で計算しています。この画面の形式（${AI_ST.fmt==='double'?'ダブル':'シングル'}）と違うため表示しません。`};
  try{
    if(typeof team==='undefined'||!team.length)return{ok:false,html:'パーティがまだありません。'};
    if(tool==='select'){
      const key=JSON.stringify([Math.min(PICK(),team.length),team.map(x=>[x.no,x.set||0,!!x.axis,!!x.sel]),(DG_CACHE.v&&DG_CACHE.v.rows||[]).length,dgDataSig()]);
      const S=DG_SELC.get(key);if(!S||!S.best)return out;
      const b=S.best,nms=(b.c||[]).map(i=>team[i]&&byNo[team[i].no]?byNo[team[i].no].n:'').filter(Boolean);
      return{ok:true,html:`${fmtN}のおすすめの選出（当サイトの計算上の目安）：<b>${nms.map(esc).join('・')}</b>`};
    }
    const key=JSON.stringify([20,dgDataSig(),team.map(x=>[x.no,x.set||0])]);
    if(DG_CACHE.k!==key||!DG_CACHE.v)return out;
    const R=DG_CACHE.v.rows||[],cnt=[4,3,2,1].map(l=>R.filter(r=>r.lvl===l).length);
    return{ok:true,html:`${fmtN}の使用率上位 ${R.length} 匹との対面（当サイトの計算上の目安）：◎${cnt[0]}・○${cnt[1]}・△${cnt[2]}・×${cnt[3]}`};
  }catch(e){return out}
}
const AI_TOOL={diag:['パーティの診断','#/team'],select:['選出の評価','#/team'],build:['パーティの構築','#/pair']};
function aiLocalHTML(tool){
  const t=AI_TOOL[tool]||AI_TOOL.diag,r=tool==='build'?{ok:false,html:''}:aiLocal(tool);
  return `<div class="ai-local" data-notr data-ok="${r.ok?1:0}">${r.ok?`<p>${r.html}</p><p class="ai-small">この端末でパーティの画面が計算した結果です。サーバーでは確かめていません。</p>`:`<p>${r.html?r.html:esc(t[0])+'の結果は、まだこの端末で計算されていません。'}</p>`}
    <a class="btn btn-s" href="${t[1]}">${esc(t[0])}を開く</a></div>`;
}
/* ---------- ダメージ計算の条件の欄（入力にない前提は補わない） ---------- */
function aiCalcFormHTML(pre){
  const side=(k,lab,no)=>{const p=byNo[no];const abs=p&&ABD[p.no]?ABD[p.no].map(a=>a[0]):[];
    return `<fieldset class="ai-side" data-side="${k}"><legend>${lab}</legend>${monField(`data-ai="${k}.no"`,no||0)}
      <label>特性 <select class="sel" data-ai="${k}.ab">${abs.map(a=>`<option value="${esc(a)}">${esc(ABN[a]||a)}</option>`).join('')}</select></label>
      <div class="ai-sp">${SN.map((n,i)=>`<label>${esc(n)}<input type="number" min="0" max="32" value="0" data-ai="${k}.sp${i}" inputmode="numeric"></label>`).join('')}</div>
      <label>性格で上がる <select class="sel" data-ai="${k}.up"><option value="-1">なし</option>${SN.slice(1).map((n,i)=>`<option value="${i+1}">${esc(n)}</option>`).join('')}</select></label>
      <label>下がる <select class="sel" data-ai="${k}.dn"><option value="-1">なし</option>${SN.slice(1).map((n,i)=>`<option value="${i+1}">${esc(n)}</option>`).join('')}</select></label></fieldset>`};
  const a=pre&&pre.attacker?+String(pre.attacker).slice(3):0,d=pre&&pre.defender?+String(pre.defender).slice(3):0,mv=pre&&pre.move?+String(pre.move).slice(3):0;
  const ls=a&&LSD[a]?LSD[a][1].filter(id=>MV[id]):[];
  return `<div class="ai-calc"><p class="ai-small">条件を確認できると計算できます。能力ポイント・性格・特性を入れてください（入れていない条件はおぎないません）。</p>
    ${side('attacker','攻撃する',a)}<label>技 <select class="sel" data-ai="move">${ls.map(id=>`<option value="${id}"${id===mv?' selected':''}>${esc(mName(id))}</option>`).join('')}</select></label>${side('defender','受ける',d)}
    <button class="btn btn-p" id="ai-calc-go">この条件で計算する</button> <a class="btn btn-s" href="#/calc">ダメージ計算の画面を開く</a></div>`;
}
function aiCalcBind(root,box){
  const cf=box.querySelector('.ai-calc');
  cf.addEventListener('change',e=>{const k=e.target.dataset.ai;if(k!=='attacker.no'&&k!=='defender.no')return;
    const no=s=>{const el=cf.querySelector(`[data-ai="${s}.no"]`);return el&&+el.value?'sp:'+el.value:null};
    const mv=cf.querySelector('[data-ai="move"]');
    box.innerHTML=aiCalcFormHTML({attacker:no('attacker'),defender:no('defender'),move:k==='attacker.no'?null:(mv&&mv.value?'mv:'+mv.value:null)});aiCalcBind(root,box)});
  cf.querySelector('#ai-calc-go').onclick=()=>{const c=aiCalcRead(cf);if(!c.attacker||!c.defender||!c.move){toast(aiR('calc_input_missing'));return}aiAsk(root,{toolInput:{calc:c}})};
}
function aiCalcRead(root){
  const v=k=>root.querySelector(`[data-ai="${k}"]`),side=k=>{const no=+v(k+'.no').value;if(!no)return null;
    return{id:'sp:'+no,sp:SN.map((_,i)=>Math.max(0,Math.min(32,+v(k+'.sp'+i).value|0))),nature:{up:+v(k+'.up').value,dn:+v(k+'.dn').value},ability:v(k+'.ab').value}};
  const m=v('move')&&v('move').value;
  return{attacker:side('attacker'),defender:side('defender'),move:m?'mv:'+m:undefined};
}
/* ---------- 画面 ---------- */
function aiView(){
  setHeader('AI攻略アシスト（試験中）','#/tools');
  if(!aiUiOn()){V.innerHTML=`<div class="ai-root" data-notr><p class="note" style="padding-top:14px">この機能は準備中です。</p><div class="btns"><a class="btn btn-s" href="#/tools">ツールの一覧へ</a></div></div>`;return}
  AI_ST.fmt=AI_ST.fmt||FMT;
  const g=typeof curGame==='function'?curGame():{name:'Pokémon Champions'};
  V.innerHTML=`<div class="ai-root" id="ai-root" data-notr>
    ${typeof LANG!=='undefined'&&LANG==='en'?'<p class="note">This feature is available in Japanese only.</p>':''}
    <div class="ai-scope"><span class="ai-chip">${esc(g.name||'')}</span>
      <div class="ai-fmt" role="group" aria-label="対戦の形式"><button data-aifmt="single" aria-pressed="${AI_ST.fmt==='single'}">シングル</button><button data-aifmt="double" aria-pressed="${AI_ST.fmt==='double'}">ダブル</button></div></div>
    <p class="ai-small">当サイトの図鑑・計算・集計のデータから、根拠つきで答えます。答えられないことは「保留」と表示します。いまは試験用の模擬AIで動いています。</p>
    <div id="ai-quota" class="ai-quota" aria-live="polite"></div>
    <label class="ai-q"><span>質問</span><textarea id="ai-q" maxlength="1000" rows="3" placeholder="例：ガブリアスの種族値は？／ガブリアスはじしんを覚える？">${esc(AI_ST.q)}</textarea></label>
    <div class="btns"><button class="btn btn-p" id="ai-send">質問する</button></div>
    <div id="ai-out" aria-live="polite"></div>
    <div class="sec"><h2>この端末で計算した結果を見る</h2></div>
    <div class="btns ai-tools">${Object.entries(AI_TOOL).map(([k,[t]])=>`<button class="btn btn-s" data-ailocal="${k}">${esc(t)}</button>`).join('')}</div>
    <div id="ai-local"></div></div>`;
  const root=document.getElementById('ai-root');
  root.querySelectorAll('[data-aifmt]').forEach(b=>b.onclick=()=>{AI_ST.fmt=b.dataset.aifmt;AI_ST.q=root.querySelector('#ai-q').value;aiView()});
  root.querySelectorAll('[data-ailocal]').forEach(b=>b.onclick=()=>{root.querySelector('#ai-local').innerHTML=aiLocalHTML(b.dataset.ailocal)});
  root.querySelector('#ai-send').onclick=()=>aiAsk(root,{});
  aiCtx(root);
}
async function aiCtx(root){
  const el=root.querySelector('#ai-quota');
  if(!AUTH.user){el.innerHTML=`<p>使うには <a href="#/account">ログイン</a> してください。</p>`;return}
  try{const {status,j}=await aiFetch(`/api/ai/v1/context?gameId=${AI_GAME}&format=${AI_ST.fmt}`);
    if(status!==200){el.textContent=aiR(j.reasonCode);return}
    AI_ST.ctx=j;aiQuota(el,j.usage)}catch(e){el.textContent=e.message}
}
function aiQuota(el,u){
  if(!el||!u)return;
  el.innerHTML=`<p>残り：今日 <b>${Math.max(0,u.day.limit-u.day.used)}</b>／${u.day.limit}回・今月 <b>${Math.max(0,u.month.limit-u.month.used)}</b>／${u.month.limit}回（今日の分は ${esc(aiTime(u.day.resetAt))} に戻ります）</p><p class="ai-small">${esc(u.note||'')}</p>`;
}
async function aiAsk(root,extra){
  if(AI_ST.busy)return;
  const q=root.querySelector('#ai-q').value.trim(),out=root.querySelector('#ai-out');
  if(!q){out.innerHTML=`<p>${esc(aiR('species_missing'))}</p>`;return}
  AI_ST.q=q;AI_ST.busy=true;const btn=root.querySelector('#ai-send');btn.disabled=true;out.innerHTML='<p class="ai-small">確かめています…</p>';
  try{
    const body={gameId:AI_GAME,format:AI_ST.fmt,question:q,requestId:aiRid(),...extra};
    const {status,j}=await aiFetch('/api/ai/v1/answer',body);
    AI_ST.last=j;aiRender(root,j,status,body);
  }catch(e){out.innerHTML=`<p>${esc(e.message)}</p>`}
  finally{AI_ST.busy=false;btn.disabled=false}
}
function aiRender(root,j,status,body){
  const out=root.querySelector('#ai-out');
  if(status!==200){out.innerHTML=`<div class="ai-card ai-err"><p>${esc(aiR(j.reasonCode))}</p>${j.resetAt?`<p class="ai-small">${esc(aiTime(j.resetAt))} 以降にまた使えます。</p>`:''}</div>`;if(j.usage)aiQuota(root.querySelector('#ai-quota'),j.usage);return}
  const st={answered:'回答',partial:'一部だけ回答',needs_input:'条件が必要',insufficient_evidence:'根拠不足のため保留',unsupported:'未対応',unavailable:'いまは答えられません'}[j.status]||'';
  out.innerHTML=`<div class="ai-ans" data-status="${esc(j.status)}"><div class="ai-st">${esc(st)}</div>
    ${(j.cards||[]).map(c=>`<div class="ai-card" data-tpl="${esc(c.templateId)}"><div class="ai-vs"><span class="ai-lab ai-lab-${esc(c.verificationStatus)}">${esc(AI_VLAB[c.verificationStatus]||'根拠不足')}</span></div><p>${aiCardText(c)}</p>${aiEvHTML(c,j.evidence)}</div>`).join('')}
    ${aiNextHTML(j)}</div>`;
  const na=j.nextAction||{};
  out.querySelectorAll('[data-aichoose]').forEach(b=>b.onclick=()=>aiAsk(root,{toolInput:{...(body.toolInput||{}),entities:{...((body.toolInput||{}).entities||{}),[na.field]:b.dataset.aichoose}}}));
  const box=out.querySelector('.ai-calcbox');if(box)aiCalcBind(root,box);
  if(j.usage)aiQuota(root.querySelector('#ai-quota'),j.usage);
}
function aiNextHTML(j){
  const n=j.nextAction;if(!n)return '';
  if(n.kind==='choose'&&(n.choices||[]).length)return `<div class="btns">${n.choices.map(c=>`<button class="btn btn-s" data-aichoose="${esc(c.ref)}">${esc(c.label)}</button>`).join('')}</div>`;
  if(n.kind==='calc_form')return `<div class="ai-calcbox">${aiCalcFormHTML(n.prefill)}</div>`;
  if(n.kind==='open_calc')return `<div class="btns"><a class="btn btn-s" href="#/calc">ダメージ計算の画面で計算する</a></div>`;
  if(n.kind==='open_tool')return aiLocalHTML(n.tool);
  return '';
}
