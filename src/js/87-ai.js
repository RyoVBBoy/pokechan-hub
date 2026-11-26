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
const AI_ST={ctx:null,busy:false,log:[],q:'',seq:0,uid:null,gen:0,conv:null};
/* 会話・書きかけ・待っている答えは、ログインしている人のものだけ。ログアウト・アカウントの削除・ほかの人のログインで全部消す。
   待っている答えは gen（世代）で見分け、消したあとに届いた答えは出さない。会話は端末にも保存しない（この画面のメモリだけ） */
function aiReset(){
  AI_ST.gen++;AI_ST.log=[];AI_ST.q='';AI_ST.ctx=null;AI_ST.busy=false;AI_ST.uid=null;AI_ST.conv=null;
  const q=document.getElementById('ai-q');if(q)q.value='';
  if(document.getElementById('ai-root')&&typeof keyOf==='function'&&keyOf(cur)==='ai')aiView();
}
function aiAuthChanged(uid){if((uid||null)!==AI_ST.uid)aiReset();AI_ST.uid=uid||null}
const aiMine=(gen,uid)=>gen===AI_ST.gen&&!!AUTH.user&&AUTH.user.uid===uid;
const AI_VLAB={official:'公式資料',ingame:'実機で確認',external_match:'外部参照と一致',external_single:'外部参照（1出典・未照合）',site_calc:'サイトの計算・推定',site_estimate:'サイトの計算・推定',site_aggregate:'当サイト集計',site_verified:'運営が証拠を確認した記録',insufficient:'根拠不足'};
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
  local_tool_result:'パーティの診断・選出・構築は、それぞれの画面で計算した結果をこの端末で表示します。',input_budget:'質問が長すぎます。',
  format_missing:'シングルとダブルで答えが変わります。どちらの形式ですか？（この確認では回数を使いません）',roles_ambiguous:'どちらが攻撃して、どちらが受けるかを選んでください。',
  b1_disabled:'パーティの相談は、いまは使えません。',no_match:'条件に合う確認済みの上位パーティはありません（条件はゆるめていません）。条件を変えるか、こだわり条件で組む画面をお試しください。',
  no_verified_teams:'運営が確認した上位パーティの記録が、この形式にはまだありません。',teams_unavailable:'上位パーティの記録を読めませんでした。',
  ruleset_unverified_b1:'現行のレギュレーションを公式の資料で確認できていないため、「今のおすすめ」とは言えません。下は過去のシーズンの確認済みの記録です。',
  candidate_season_old:'一部は過去のシーズンの記録です（現行のレギュレーションで同じように強いとは限りません）。',
  conversation_missing:'前の相談が見つかりません（30分で消えます）。もう一度、はじめから聞いてください。',conversation_full:'1つの相談は6回までです。新しく相談してください。',
  conversation_invalid:'前の相談の番号が正しくありません。新しく相談してください。',format_changed:'形式が変わったため、前の相談の続きにはできません。新しく相談してください。',game_changed:'ゲームが変わったため、前の相談の続きにはできません。',
  pick_out_of_range:'その番号の案はありません。',candidate_gone:'選んだ案は、いまは見られなくなりました（非公開・取り下げなど）。ほかの記録から選んでいます。',
  data_updated:'データが更新されたため、条件に合うかを確かめ直しました。',ruleset_changed:'レギュレーションの記録が変わったため、候補を取り直しました。',format_switched:'形式を変えたので、残す・外す条件だけ引きついで、候補を取り直しました。',
  fairplay_live:'進行中の対戦への個別の助言は控えています。試合が終わったら、選出や立ち回りを一緒に振り返れます。',
  policy_refused:'その内容にはお答えできません（フェアプレイと安全のため）。ルールや一般的な仕組みについてなら説明できます。',
  match_phase_unknown:'この相談は、練習用・仮想の盤面ですか？それとも終わった試合の振り返りですか？（進行中の対戦への個別の助言は控えています）',
  unverified_claim:'未発表・未確認の情報は、確定した事実としては出せません。公式の発表を確かめてからお答えします。',
  game_mismatch:'ここではポケモンチャンピオンズの相談だけを扱います。ほかのゲームの候補や条件は使いません。',
  constraint_conflict:'同じポケモンを「入れる」と「外す」の両方に指定しています。どちらにしますか？',
  open_news:'最新情報は、公式のお知らせの画面で確かめられます（ここではモデルの記憶から答えません）。',
  style_unverified:'その戦い方は、登録された技・特性から確かめられないため、絞り込みに使っていません。',
  beginner_unverified:'扱いやすさを確かめたデータはないため、初心者向けとは言えません。',no_guarantee:'勝てることは保証できません。確認済みの上位記録を並べています。',
  no_win_rate:'勝率・順位の順には並べていません（その集計はありません）。',sets_not_shown:'技・持ち物などの育成は、ここでは出しません。シーズンのページで確かめてください。',
  proof_not_shown:'証拠の画像・登録した人の情報は出しません。',match_phase_invalid:'送った内容の形が正しくありません。',mega_ambiguous:'どのメガシンカの姿かで候補が変わります。どれですか？（この確認では回数を使いません）',
  ai_halted:'安全のため、AI を一時的に止めています。しばらくしてからお試しください。',provider_not_enabled:'AI の提供元が設定されていません。',
  compare_unsupported:'どちらが強いかは、条件（相手・型・形式）で変わるため、ここでは答えません。「ポケモン比較」で種族値とタイプ相性を並べて比べられます。'};
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
/* ---------- 回答の文（決まった文に値を入れるだけ。値は esc で文字として出す） ---------- */
const AI_FIELD={name:'名前',name_en:'英語名',types:'タイプ',stats:'種族値',abilities:'特性',learnset:'覚える技',megas:'メガシンカの姿',mega_of:'元の姿',mega_stone:'メガストーン',
  type:'技のタイプ',power:'威力',accuracy:'命中',category:'分類',priority:'優先度',hits:'当たる回数',sp_cap:'能力ポイントの上限',stat_formula:'実数値の計算式',level:'レベル',period:'期間',damage:'ダメージ計算',usage_share:'当サイトの集計'};
const aiFmtN=f=>f==='double'?'ダブル':f==='single'?'シングル':'';
const aiStatGrid=st=>`<div class="ai-sg">${(st||[]).map((v,i)=>`<div><span>${esc(SN[i])}</span><b>${esc(v)}</b></div>`).join('')}</div>`;
function aiCardText(c){
  const s=c.slots||{},E=esc;
  switch(c.templateId){
    case 'species_types':return `<b>${E(s.name)}</b> のタイプは <b>${(s.types||[]).map(E).join('・')}</b> です。`;
    case 'species_stats':return `<b>${E(s.name)}</b> の種族値（合計 ${E(s.total)}）${aiStatGrid(s.stats)}`;
    case 'species_abilities':return `<b>${E(s.name)}</b> の特性：${(s.abilities||[]).map(a=>E(a.name)+(a.hidden?'（隠れ特性）':'')).join('・')}`;
    case 'species_megas':return (s.megas||[]).length?`<b>${E(s.name)}</b> のメガシンカ${s.megas.map(m=>`<div class="ai-mg"><b>${E(m.name)}</b>（${(m.types||[]).map(E).join('・')}）${aiStatGrid(m.stats)}</div>`).join('')}`:`<b>${E(s.name)}</b> のメガシンカのデータはありません。`;
    case 'learns_move':return `<b>${E(s.name)}</b> は <b>${E(s.moveName)}</b> を${s.learns?'覚えます':'覚えません'}（当サイトの習得技のデータ）。`;
    case 'move_info':return `<b>${E(s.name)}</b>：${[s.type&&`タイプ ${E(s.type)}`,s.category&&E(s.category),s.power!=null&&`威力 ${E(s.power)}`,s.accuracy!=null&&`命中 ${E(s.accuracy)}`,s.priority&&`優先度 ${E(s.priority)}`].filter(Boolean).join('・')}`;
    case 'sp_rule':return `能力ポイントは <b>合計 ${E(s.total)}・1つの能力に ${E(s.per)} まで</b> です${s.level?`（Lv${E(s.level)}）`:''}。${s.formula?`<br><small>HP＝${E(s.formula.hp)}、ほか＝${E(s.formula.other)}</small>`:''}`;
    case 'damage_calc':{const k=s.ko||{};
      /* 確定数の書き方はダメージ計算の画面と同じ（koBadge・koPlain） */
      return `<b>${E(s.attackerName)}</b> の <b>${E(s.moveName)}</b> → <b>${E(s.defenderName)}</b>
        <div class="ai-dmg"><b>${E(s.pctMin)}〜${E(s.pctMax)}%</b> ${typeof koBadge==='function'?koBadge(k):''}</div>
        <div class="ai-small">${E(typeof koPlain==='function'?koPlain(k):'')}。ダメージ ${E(s.min)}〜${E(s.max)}／HP ${E(s.hp)}</div>
        <div class="ai-small">前提：${E(aiFmtN(s.format))}・Lv50・ランク0・HP満タン・持ち物なし・天気や場なし・急所なし・相性等倍。当サイトの計算上の目安（計算のリビジョン ${E(s.engineRevision)}）。</div>`}
    case 'usage_share':return `<b>${E(s.name)}</b> は、当サイトで記録した${E(aiFmtN(s.format))}の相手の選出画面 ${E(s.previews)} 件のうち <b>${E(s.count)} 件（${E(s.share)}%）</b> に出てきました（${E(s.from)}〜${E(s.to)}、${E(aiTime(s.generatedAt))} 集計）。
      <div class="ai-small">${E(s.dedup)}${s.capped?`。集計の上限（${E(s.cap)}件）に達しています`:''}。ランクバトル全体の使用率ではありません。</div>`;
    case 'team_candidates':return aiTeamsHTML(s);
    case 'hold':return `<span class="ai-hold">保留：${E(aiR(s.reasonCode))}</span>`;
    case 'needs_input':if(s.field==='phase')return E(aiR('match_phase_unknown'));if(s.field==='constraint')return E(aiR('constraint_conflict'));if(s.field==='conversation')return E(aiR(s.reason||'conversation_missing'));if(s.field==='candidate')return E(aiR('pick_out_of_range'));if(s.field==='mega')return E(aiR('mega_ambiguous'));
      return E(aiR(s.field==='calc'?'calc_input_missing':s.field==='format'?'format_missing':s.field==='roles'?'roles_ambiguous':(s.choices||[]).length?'form_ambiguous':s.field==='species'?'species_missing':'move_missing'));
    case 'unsupported':return E(aiR(s.reasonCode));
    case 'unavailable':return E(aiR(s.reasonCode));
    case 'open_tool':return E(aiR('local_tool_result'));
  }
  return E(aiR(''));
}
/* B1：確認済みの上位パーティの候補（最大3件）。並び・理由はサーバーが確かめた値だけ */
const aiRsnTxt=r=>r.id==='keeps'?`残したい条件（${r.names.join('・')}）を満たす`:r.id==='style'?`${r.label}の手がかりがある`:r.id==='similar'?`案${r.anchorIndex}と${r.shared}匹が同じ`:
  r.id==='verified_rank'?`${r.season}で${r.rank?r.rank+'位':''}${r.rate?`（レート${r.rate}）`:''}の確認済みの記録`:'';
function aiTeamsHTML(s){
  const E=esc;
  return `<div class="ai-tms">${(s.candidates||[]).map(c=>`<div class="ai-tm"><div class="ai-tm-h"><b>案${E(c.index)}</b> <span class="ai-small">${E(aiFmtN(c.fmt))}・${E(c.season.name)}${c.rank?`・${E(c.rank)}位`:''}${c.rate?`・レート${E(c.rate)}`:''}</span></div>
    <div class="ai-tm-m">${c.members.map(m=>`<span class="ai-tm-p">${E(m.mega||m.name)}</span>`).join('')}</div>
    <div class="ai-small">戦い方：${c.style?`${E(c.style.label)}（根拠：${c.style.basis.map(b=>E(b.who)+'の'+E(b.what)).join('・')}）`:'登録された技・特性からは決められません'}</div>
    ${c.reasons.length?`<ul class="ai-tm-r">${c.reasons.map(r=>`<li>${E(aiRsnTxt(r))}</li>`).join('')}</ul>`:''}
    <div class="ai-small">${c.ruleset.status==='current_verified'?`現行のレギュレーション（公式の資料で確認）・${c.ruleset.legal==='verified'?'全員が参加できると確認':'参加できるか確認できない匹がいます'}`:'過去のシーズン、または現行のレギュレーションを確認できていない記録です'}</div>
    <div class="ai-small">運営が証拠を確認した上位の記録 ・ <a href="${E(/^#\/season\/\d+$/.test(c.source.route)?c.source.route:'#/season')}">${E(c.source.label)}</a></div></div>`).join('')}
    ${s.constraints&&(s.constraints.keep.length||s.constraints.drop.length||s.constraints.style)?`<p class="ai-small">いまの条件：${[s.constraints.keep.length&&'残す '+s.constraints.keep.map(E).join('・'),s.constraints.drop.length&&'外す '+s.constraints.drop.map(E).join('・'),s.constraints.style&&'戦い方 '+E(s.constraints.style)].filter(Boolean).join('／')}</p>`:''}</div>`;
}
/* 根拠：項目ごとに「何の値か・どこから・確認の段階・確認日」を読める形で */
function aiEvHTML(c,evs){
  const by=new Map((evs||[]).map(e=>[e.evidenceId,e]));
  const list=(c.evidenceIds||[]).map(id=>by.get(id)).filter(Boolean);
  if(!list.length)return '';
  const who=e=>{const m=/^sp:(\d+)$/.exec(e.entityId||'');if(m&&byNo[+m[1]])return byNo[+m[1]].n;const v=/^mv:(\d+)$/.exec(e.entityId||'');if(v)return mName(+v[1]);return ''};
  return `<details class="ai-ev"><summary>根拠を見る（${list.length}件）</summary><ul>${list.map(e=>{const refs=(e.source&&e.source.refs||[]).filter(r=>r.url&&/^https:\/\//.test(r.url));
    return `<li><div class="ai-ev-h"><span class="ai-ev-f">${esc(who(e))}${who(e)?'の':''}${esc(AI_FIELD[e.field]||e.field)}</span><span class="ai-lab ai-lab-${esc(e.sourceType)}">${esc(AI_VLAB[e.sourceType]||'根拠不足')}</span></div>
      <div class="ai-ev-s">出典：${esc(e.source?e.source.name:e.sourceRef)}${e.checkedAt?`<br>確認日：${esc(e.checkedAt)}`:''}${refs.length?`<br>${refs.map(r=>`<a href="${esc(r.url)}" target="_blank" rel="noopener nofollow">${esc(r.name)}</a>`).join('・')}`:''}</div></li>`}).join('')}</ul></details>`;
}
/* ---------- この端末で計算済みの診断・選出（パーティの画面の結果） ---------- */
const AI_TOOL={diag:['パーティの診断','#/team','パーティの診断を開く'],select:['選出の評価','#/team','選出の評価を開く'],build:['パーティの構築','#/pair','パーティ構築を開く']};
/* 診断で使った相手のデータを、実際に使ったものの名前で書く（使用率の集計か、合計種族値の代わりか・相手の型の出どころ） */
function aiOppLabel(R){
  const live=typeof META!=='undefined'&&META.rank&&META.rank.length>=20;
  const top=typeof topReady==='function'&&topReady();
  const nl=R.filter(r=>r.live).length;
  const list=live?`ランクバトルの使用率の集計で上位の${R.length}匹${META.at?`（${esc(aiTime(META.at))} に読んだ集計）`:''}`:`合計種族値の高い${R.length}匹（使用率の集計を読めなかったための代わり）`;
  return `相手：${list}${top?'。上位パーティでよく使われる匹の割合も加えた並び':''}。相手の型：使用率の集計の型 ${nl}匹・当サイトが自動で組んだ型 ${R.length-nl}匹。`;
}
function aiLocal(tool,fmt){
  const out={ok:false,html:''},fmtN=aiFmtN(FMT);
  if((typeof curGame==='function'&&curGame().id&&curGame().id!==AI_GAME))return{ok:false,html:'このゲームの結果ではありません。'};
  if(fmt&&FMT!==fmt)return{ok:false,html:`パーティの画面は${fmtN}で計算しています。聞かれた形式（${esc(aiFmtN(fmt))}）と違うため表示しません。`};
  try{
    if(typeof team==='undefined'||!team.length)return{ok:false,html:'パーティがまだありません。'};
    if(tool==='select'){
      const key=JSON.stringify([Math.min(PICK(),team.length),team.map(x=>[x.no,x.set||0,!!x.axis,!!x.sel]),(DG_CACHE.v&&DG_CACHE.v.rows||[]).length,dgDataSig()]);
      const S=DG_SELC.get(key);if(!S||!S.best)return out;
      const nms=(S.best.c||[]).map(i=>team[i]&&byNo[team[i].no]?byNo[team[i].no].n:'').filter(Boolean);
      return{ok:true,html:`${fmtN}のおすすめの選出（当サイトの計算上の目安）：<b>${nms.map(esc).join('・')}</b><div class="ai-small">${aiOppLabel(DG_CACHE.v.rows||[])}</div>`};
    }
    const key=JSON.stringify([20,dgDataSig(),team.map(x=>[x.no,x.set||0])]);
    if(DG_CACHE.k!==key||!DG_CACHE.v)return out;
    const R=DG_CACHE.v.rows||[],cnt=[4,3,2,1].map(l=>R.filter(r=>r.lvl===l).length);
    return{ok:true,html:`${fmtN}・相手ごとの対応力（当サイトの計算上の目安）：◎${cnt[0]}・○${cnt[1]}・△${cnt[2]}・×${cnt[3]}<div class="ai-small">${aiOppLabel(R)}</div>`};
  }catch(e){return out}
}
function aiLocalHTML(tool,fmt){
  const t=AI_TOOL[tool]||AI_TOOL.diag,r=tool==='build'?{ok:false,html:''}:aiLocal(tool,fmt);
  return `<div class="ai-local" data-ok="${r.ok?1:0}">${r.ok?`<p>${r.html}</p><p class="ai-small">この端末でパーティの画面が計算した結果です。サーバーでは確かめていません。</p>`:`<p>${r.html?r.html:tool==='build'?'パーティの構築は、構築の画面で行います。':esc(t[0])+'の結果は、まだこの端末で計算されていません。'}</p>`}
    <a class="btn btn-s" href="${t[1]}">${esc(t[2])}</a></div>`;
}
/* ---------- ダメージ計算の条件の欄（入力にない前提は補わない。片方を変えても、もう片方はそのまま） ---------- */
const aiCalcOk=k=>{const c=AI_ST.ctx&&AI_ST.ctx.capabilities&&AI_ST.ctx.capabilities.calc;return !c||!c.abilities||c.abilities.includes(k)};
function aiSideNew(no){const abs=no&&ABD[no]?ABD[no].map(a=>a[0]):[];return{no:no||0,ab:abs.find(aiCalcOk)||abs[0]||'',sp:[0,0,0,0,0,0],up:-1,dn:-1}}
function aiSideHTML(k,lab,S){
  const abs=S.no&&ABD[S.no]?ABD[S.no].map(a=>a[0]):[];
  return `<fieldset class="ai-side" data-side="${k}"><legend>${lab}</legend>${monField(`data-ai="${k}.no"`,S.no||0)}
    <label class="ai-fl">特性 <select class="sel" data-ai="${k}.ab">${abs.map(a=>`<option value="${esc(a)}"${a===S.ab?' selected':''}>${esc(ABN[a]||a)}${aiCalcOk(a)?'':'（計算の対象外）'}</option>`).join('')}</select></label>
    <div class="ai-sp" role="group" aria-label="能力ポイント（1つ32まで・合計66まで）">${SN.map((n,i)=>`<label>${esc(n)}<input type="number" min="0" max="32" value="${S.sp[i]}" data-ai="${k}.sp${i}" inputmode="numeric"></label>`).join('')}</div>
    <div class="ai-nat">${natGrid(S.up,S.dn,j=>`data-ainat="${j}" data-aiside="${k}"`)}</div></fieldset>`;
}
function aiCalcSummary(F){
  const sd=S=>{if(!S.no)return '（未選択）';const p=byNo[S.no];const n=natIdx(S.up,S.dn);
    return `${esc(p.n)}（特性 ${esc(ABN[S.ab]||'—')}${aiCalcOk(S.ab)?'':'＝計算の対象外'}・性格 ${esc(n?NATS[n][0]:'まじめ')}・能力ポイント ${esc(spLine(S.sp))}）`};
  const sum=s=>s.sp.reduce((a,b)=>a+b,0);
  const bad=[F.attacker,F.defender].some(S=>S.no&&(sum(S)>66||S.sp.some(v=>v>32)));
  return `<div class="ai-csum"><b>この条件で計算します</b><ul><li>攻撃する：${sd(F.attacker)}</li><li>技：${F.move?esc(mName(F.move)):'（未選択）'}</li><li>受ける：${sd(F.defender)}</li>
    <li>${esc(aiFmtN(F.fmt))}・Lv50・ランク0・HP満タン・持ち物なし・天気や場なし・急所なし</li></ul>${bad?'<p class="ai-warn">能力ポイントは1つ32まで・合計66までです。</p>':''}</div>`;
}
function aiCalcFormHTML(F){
  const ls=F.attacker.no&&LSD[F.attacker.no]?LSD[F.attacker.no][1].filter(id=>MV[id]):[];
  return `<div class="ai-calc"><p class="ai-small">条件を確認できると計算できます。入れていない条件はおぎないません。</p>
    ${aiSideHTML('attacker','攻撃する',F.attacker)}<label class="ai-fl">技 <select class="sel" data-ai="move"><option value="">選んでください</option>${ls.map(id=>`<option value="${id}"${id===F.move?' selected':''}>${esc(mName(id))}</option>`).join('')}</select></label>${aiSideHTML('defender','受ける',F.defender)}
    <div class="ai-csumw">${aiCalcSummary(F)}</div>
    <div class="btns"><button class="btn btn-p" data-ai-go>この条件で計算する</button><a class="btn btn-s" href="#/calc">ダメージ計算の画面を開く</a></div></div>`;
}
function aiCalcBind(box,F,onGo){
  const draw=()=>{box.innerHTML=aiCalcFormHTML(F);bind()};
  const bind=()=>{const cf=box.querySelector('.ai-calc'),sum=()=>{cf.querySelector('.ai-csumw').innerHTML=aiCalcSummary(F)};
    cf.addEventListener('change',e=>{const k=e.target.dataset.ai;if(!k)return;
      const m=/^(attacker|defender)\.(no|ab|sp(\d))$/.exec(k);
      if(k==='move'){F.move=+e.target.value||0;sum();return}
      if(!m)return;const S=F[m[1]];
      if(m[2]==='no'){const no=+e.target.value;const keep={sp:S.sp,up:S.up,dn:S.dn};Object.assign(S,aiSideNew(no),keep);
        if(m[1]==='attacker'&&F.move&&!(LSD[no]&&LSD[no][1].includes(F.move)))F.move=0;draw();return}
      if(m[2]==='ab')S.ab=e.target.value;
      if(m[3]!==undefined)S.sp[+m[3]]=Math.max(0,Math.min(32,+e.target.value|0));
      sum()});
    cf.querySelectorAll('[data-ainat]').forEach(b=>b.onclick=()=>{const S=F[b.dataset.aiside],n=NATS[+b.dataset.ainat];S.up=n[1];S.dn=n[2];
      natGridSync(b.closest('.ai-nat'),S.up,S.dn);sum()});
    cf.querySelector('[data-ai-go]').onclick=()=>{
      if(!F.attacker.no||!F.defender.no||!F.move){toast(aiR('calc_input_missing'));return}
      const side=S=>({id:'sp:'+S.no,sp:[...S.sp],nature:{up:S.up,dn:S.dn},ability:S.ab});
      onGo({attacker:side(F.attacker),defender:side(F.defender),move:'mv:'+F.move})}};
  draw();
}
/* ---------- 画面（会話の形・下に入力欄1つ） ---------- */
const AI_SEND_SVG='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function aiView(){
  setHeader('AI攻略アシスト（試験中）','#/tools');
  if(!aiUiOn()){V.innerHTML=`<div class="ai-root" data-notr><p class="note" style="padding-top:14px">この機能は準備中です。</p><div class="btns"><a class="btn btn-s" href="#/tools">ツールの一覧へ</a></div></div>`;return}
  const g=typeof curGame==='function'?curGame():{name:'Pokémon Champions'};
  /* 前に会話した人と違う人なら、前の会話を出さない */
  const nu=AUTH.user?AUTH.user.uid:null;if(AI_ST.uid&&AI_ST.uid!==nu)aiReset();if(nu)AI_ST.uid=nu;
  document.body.classList.add('ai-on');
  V.innerHTML=`<div class="ai-root" id="ai-root" data-notr>
    ${typeof LANG!=='undefined'&&LANG==='en'?'<p class="note">This feature is available in Japanese only.</p>':''}
    <div class="ai-top"><span class="ai-chip">${esc(g.name||'')}</span><details class="ai-quota" id="ai-quota"><summary>残りの回数</summary><div class="ai-qd"></div></details></div>
    <div class="ai-log" id="ai-log" aria-live="polite"></div>
    <form class="ai-comp" id="ai-comp" autocomplete="off"><label class="sr-only" for="ai-q">質問</label>
      <textarea id="ai-q" maxlength="1000" rows="1" placeholder="質問を入力" enterkeyhint="send">${esc(AI_ST.q)}</textarea>
      <button id="ai-send" type="submit" aria-label="送信">${AI_SEND_SVG}</button></form></div>`;
  const root=document.getElementById('ai-root'),q=root.querySelector('#ai-q');
  if(!AI_ST.log.length)AI_ST.log.push({who:'bot',intro:true});
  aiDrawLog(root);
  const grow=()=>{q.style.height='auto';q.style.height=Math.min(q.scrollHeight,140)+'px'};
  q.addEventListener('input',()=>{AI_ST.q=q.value;grow()});grow();
  q.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();root.querySelector('#ai-comp').requestSubmit()}});
  root.querySelector('#ai-comp').addEventListener('submit',e=>{e.preventDefault();const v=q.value.trim();if(!v||AI_ST.busy)return;q.value='';AI_ST.q='';grow();aiAsk(root,v,{})});
  aiKbWatch();aiCtx(root);
}
/* キーボード：入力欄を見える範囲の下に置き、下のメニューと重ならないようにする（visualViewport） */
function aiKbApply(kb){document.documentElement.style.setProperty('--ai-kb',Math.max(0,Math.round(kb))+'px');document.body.classList.toggle('ai-kb',kb>40);
  if(kb>40){const l=document.querySelector('#ai-log');const x=l&&l.lastElementChild;if(x)x.scrollIntoView({block:'end'})}}
let AI_KBW=false;
function aiKbWatch(){
  if(AI_KBW||!window.visualViewport)return;AI_KBW=true;
  const f=()=>{if(!document.getElementById('ai-root'))return aiKbApply(0);const v=visualViewport;aiKbApply(innerHeight-(v.height+v.offsetTop))};
  visualViewport.addEventListener('resize',f);visualViewport.addEventListener('scroll',f);
}
function aiIntroHTML(){
  return `<div class="ai-card"><p>図鑑・ダメージ計算・当サイトの集計のデータから、根拠つきで答えます。答えられないことは「保留」と表示します。いまは試験用の模擬AIで動いています。</p>
    <p class="ai-small">例：「ガブリアスの種族値は？」「ガブリアスのじしんでカイリューへのダメージは？」「能力ポイントの上限は？」「ダブルのおすすめのパーティ教えて」</p>
    <div class="ai-chips">${Object.entries(AI_TOOL).map(([k,[t]])=>`<button type="button" class="ai-cbtn" data-ailocal="${k}">${esc(k==='build'?'パーティ構築を開く':t+'の結果を見る')}</button>`).join('')}</div></div>`;
}
function aiDrawLog(root){
  const L=root.querySelector('#ai-log');
  L.innerHTML=AI_ST.log.map((m,i)=>m.who==='me'?`<div class="ai-msg me"><div class="ai-bub">${esc(m.text)}</div></div>`
    :`<div class="ai-msg bot" data-i="${i}">${m.intro?aiIntroHTML():m.wait?'<div class="ai-card ai-wait">確かめています…</div>':m.html||aiAnsHTML(m)}</div>`).join('');
  AI_ST.log.forEach((m,i)=>{const el=L.querySelector(`.ai-msg.bot[data-i="${i}"]`);if(el&&m.bind)m.bind(el)});
  L.querySelectorAll('[data-ailocal]').forEach(b=>b.onclick=()=>{const k=b.dataset.ailocal;
    if(k==='build'){location.hash='#/pair';return}
    AI_ST.log.push({who:'bot',html:aiLocalHTML(k,null)});aiDrawLog(root)});
  /* 根拠を開いたら、その下までを入力欄の上に見せる（キーボードが出ていても） */
  L.querySelectorAll('.ai-ev').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)d.scrollIntoView({block:'end'})}));
  const last=L.lastElementChild;if(last)last.scrollIntoView({block:'end'});
}
async function aiCtx(root){
  const el=root.querySelector('#ai-quota');
  /* ログインの状態は、ほかの画面と同じく Firebase を読み込んでから見る（開き直した直後でもログインのまま扱う） */
  if(!AUTH.user&&typeof fbLoad==='function'){try{await fbLoad();await AUTH.wait}catch(e){}if(!document.body.contains(el))return;if(AUTH.user){aiView();return}}
  if(!AUTH.user){el.outerHTML=`<p class="ai-small ai-login">使うには <a href="#/account">ログイン</a> してください。</p>`;return}
  const gen=AI_ST.gen,uid=AUTH.user.uid;
  try{const {status,j}=await aiFetch(`/api/ai/v1/context?gameId=${AI_GAME}`);
    if(!aiMine(gen,uid))return;
    if(status!==200){el.querySelector('summary').textContent=aiR(j.reasonCode);return}
    AI_ST.ctx=j;aiQuota(root,j.usage)}catch(e){el.querySelector('summary').textContent=e.message}
}
function aiQuota(root,u){
  const el=root&&root.querySelector('#ai-quota');if(!el||!u)return;
  const dl=Math.max(0,u.day.limit-u.day.used),ml=Math.max(0,u.month.limit-u.month.used);
  el.querySelector('summary').textContent=`今日あと${Math.min(dl,ml)}回`;
  el.querySelector('.ai-qd').innerHTML=`<p>今日：${u.day.used}／${u.day.limit}回（${esc(aiTime(u.day.resetAt))} に戻ります）<br>今月：${u.month.used}／${u.month.limit}回（${esc(aiTime(u.month.resetAt))} に戻ります）</p>
    <p class="ai-small">${esc(u.note||'')}</p><p class="ai-small">数えるのは答えが出たときだけです（保留・確認の質問・失敗は数えません）。</p>`;
}
async function aiAsk(root,question,extra,opt){
  if(AI_ST.busy)return;
  if(!AUTH.user){AI_ST.log.push({who:'bot',html:`<div class="ai-card ai-err"><p>${esc(aiR('auth_required'))}</p></div>`});aiDrawLog(root);return}
  const gen=AI_ST.gen,uid=AUTH.user.uid;AI_ST.uid=uid;
  AI_ST.busy=true;root.querySelector('#ai-send').disabled=true;
  if(!(opt&&opt.resume))AI_ST.log.push({who:'me',text:question});
  const wait={who:'bot',wait:true};AI_ST.log.push(wait);aiDrawLog(root);
  try{
    const body={gameId:AI_GAME,question,requestId:aiRid(),...(AI_ST.conv?{conversationId:AI_ST.conv}:{}),...extra};
    const {status,j}=await aiFetch('/api/ai/v1/answer',body);
    /* 待っている間にログアウト・ほかの人のログイン・会話の消去があれば、この答えは捨てる */
    if(!aiMine(gen,uid))return;
    Object.assign(wait,{wait:false,status,j,body,question});
    if(j.conversationId)AI_ST.conv=j.conversationId;
    if(j.nextAction&&j.nextAction.kind==='new_conversation')AI_ST.conv=null;
    /* 回数・頻度の上限：送った質問は消さずに入力欄へ戻す（あとでそのまま送れる） */
    if(status===429){const qi=document.getElementById('ai-q');if(qi&&!qi.value){qi.value=question;AI_ST.q=question}}
    if(j.usage)aiQuota(root,j.usage);
  }catch(e){if(!aiMine(gen,uid))return;Object.assign(wait,{wait:false,html:`<div class="ai-card ai-err"><p>${esc(e.message)}</p></div>`})}
  finally{if(gen===AI_ST.gen){AI_ST.busy=false;const r2=document.getElementById('ai-root');if(r2){const b=r2.querySelector('#ai-send');if(b)b.disabled=false;aiDrawLog(r2)}}}
}
const AI_ST_LAB={answered:'回答',partial:'一部だけ回答',needs_input:'確認させてください',insufficient_evidence:'根拠不足のため保留',unsupported:'ここでは答えられません',unavailable:'いまは答えられません'};
function aiAnsHTML(m){
  const j=m.j||{};
  if(m.status!==200){m.bind=null;return `<div class="ai-card ai-err"><p>${esc(aiR(j.reasonCode))}</p>${j.resetAt?`<p class="ai-small">${esc(aiTime(j.resetAt))} 以降にまた使えます。</p>`:''}${m.status===429?`<p class="ai-small">質問は入力欄に残しました。AI を使わないツールは、回数に関係なく使えます。</p><div class="btns"><a class="btn btn-s" href="#/dex">図鑑</a><a class="btn btn-s" href="#/calc">ダメージ計算</a><a class="btn btn-s" href="#/pair/kd">こだわり条件で組む</a></div>`:''}</div>`}
  m.bind=el=>aiAnsBind(el,m);
  return `<div class="ai-ans" data-status="${esc(j.status)}"><div class="ai-st">${esc(j.reasonCode==='local_tool_result'?'この端末で計算した結果':AI_ST_LAB[j.status]||'')}</div>
    ${(j.cards||[]).map(c=>`<div class="ai-card" data-tpl="${esc(c.templateId)}">${['hold','needs_input','unsupported','unavailable','open_tool'].includes(c.templateId)?'':`<div class="ai-vs"><span class="ai-lab ai-lab-${esc(c.verificationStatus)}">${esc(AI_VLAB[c.verificationStatus]||'根拠不足')}</span></div>`}<div class="ai-tx">${aiCardText(c)}</div>${aiEvHTML(c,j.evidence)}</div>`).join('')}
    ${aiNextHTML(j,m)}</div>`;
}
/* 確認の質問：同じ質問を、選んだ条件で続ける（確認だけでは回数を使わない）。形式・姿・役わりはどのゲームでも同じ形 */
function aiNextHTML(j,m){
  const n=j.nextAction;if(!n)return '';
  if(n.kind==='choose'&&(n.choices||[]).length)return `<div class="ai-chips">${n.choices.map(c=>`<button type="button" class="ai-cbtn" data-aichoose="${esc(c.ref)}">${esc(c.label)}</button>`).join('')}</div>`;
  if(n.kind==='choose_roles')return n.options.length?`<div class="ai-chips">${n.options.map((o,i)=>`<button type="button" class="ai-cbtn" data-airole="${i}">${esc(o.label)}</button>`).join('')}</div>`:'';
  if(n.kind==='calc_form')return `<div class="ai-calcbox"></div>`;
  if(n.kind==='open_calc')return `<div class="btns"><a class="btn btn-s" href="#/calc">ダメージ計算の画面で計算する</a></div>`;
  if(n.kind==='open_tool'&&n.tool==='news')return `<div class="btns"><a class="btn btn-s" href="#/news">公式のお知らせを見る</a></div>`;
  if(n.kind==='after_match')return `<p class="ai-small">ルール・技や特性の一般的な仕組みの質問、試合が終わってからの振り返りはできます。</p>`;
  if(n.kind==='choose_constraint')return `<div class="ai-chips">${(n.choices||[]).map(c=>`<button type="button" class="ai-cbtn" data-aisay="${esc(c.label)}">${esc(c.label)}</button>`).join('')}</div>`;
  if(n.kind==='open_tool'&&n.tool==='kodawari')return `<div class="btns"><a class="btn btn-s" href="#/pair/kd">こだわり条件で組む</a></div>`;
  if(n.kind==='followup')return `<p class="ai-small">続けて条件を足せます（同じ相談の条件は引きつぎます）：</p><div class="ai-chips">${(n.examples||[]).map(x=>`<button type="button" class="ai-cbtn" data-aifill="${esc(x)}">${esc(x)}</button>`).join('')}</div>`;
  if(n.kind==='new_conversation')return `<div class="ai-chips"><button type="button" class="ai-cbtn" data-ainew="1">新しく相談する</button></div>`;
  if(n.kind==='open_tool'&&n.tool==='compare')return `<div class="btns"><a class="btn btn-s" href="${esc(/^#\/cmp(\/[\d-]+)?$/.test(n.route||'')?n.route:'#/cmp')}">ポケモン比較を開く</a></div>`;
  if(n.kind==='open_tool')return aiLocalHTML(n.tool,(j.scope&&j.scope.format)||(m.body&&m.body.format));
  return '';
}
function aiAnsBind(el,m){
  const root=document.getElementById('ai-root'),j=m.j,n=j.nextAction||{},b=m.body||{};
  const resume=extra=>aiAsk(root,m.question,{...(b.format?{format:b.format}:{}),...(b.toolInput?{toolInput:b.toolInput}:{}),...extra},{resume:true});
  el.querySelectorAll('[data-aichoose]').forEach(x=>x.onclick=()=>{const v=x.dataset.aichoose,ti=b.toolInput||{};
    if(n.field==='format')return resume({format:v});
    if(n.field==='phase')return resume({matchPhase:v});
    /* メガシンカの姿：選んだ姿を「残したい」として同じ相談に続ける */
    if(n.field==='mega')return aiAsk(root,x.textContent+'を残したい',b.format?{format:b.format}:{});
    if(n.field==='attacker'||n.field==='defender'){const k=n.keep||{},calc={...(ti.calc||{})};
      for(const s of ['attacker','defender'])if(!calc[s]&&k[s])calc[s]=k[s];if(!calc.move&&k.move)calc.move=k.move;calc[n.field]={id:v};return resume({toolInput:{...ti,calc}})}
    resume({toolInput:{...ti,entities:{...(ti.entities||{}),[n.field]:v}}})});
  el.querySelectorAll('[data-aisay]').forEach(x=>x.onclick=()=>aiAsk(root,x.dataset.aisay,b.format?{format:b.format}:{}));
  el.querySelectorAll('[data-aifill]').forEach(x=>x.onclick=()=>{const qi=document.getElementById('ai-q');if(qi){qi.value=x.dataset.aifill;AI_ST.q=qi.value;qi.focus()}});
  el.querySelectorAll('[data-ainew]').forEach(x=>x.onclick=()=>{AI_ST.conv=null;const qi=document.getElementById('ai-q');if(qi)qi.focus()});
  el.querySelectorAll('[data-airole]').forEach(x=>x.onclick=()=>{const o=n.options[+x.dataset.airole],ti=b.toolInput||{};
    resume({toolInput:{...ti,calc:{...(ti.calc||{}),attacker:{id:o.attacker},defender:{id:o.defender},...(n.move?{move:n.move}:{})}}})});
  const box=el.querySelector('.ai-calcbox');
  if(box){
    if(!m.form){const p=n.prefill||{},no=x=>x?+String(x).slice(3):0,ti=(b.toolInput&&b.toolInput.calc)||{};
      const side=(k)=>{const s=ti[k];const S=aiSideNew(no(s&&s.id||p[k]));if(s&&Array.isArray(s.sp))S.sp=[...s.sp];if(s&&s.nature){S.up=s.nature.up;S.dn=s.nature.dn}if(s&&s.ability)S.ab=s.ability;return S};
      m.form={attacker:side('attacker'),defender:side('defender'),move:no(p.move),fmt:b.format||null}}
    aiCalcBind(box,m.form,calc=>resume({toolInput:{...(b.toolInput||{}),calc}}));
  }
}
