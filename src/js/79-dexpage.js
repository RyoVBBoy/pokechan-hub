/* ===================== 図鑑のページの6つのタブ（2026/11/15 依頼主「Comprehensive Redesign of the Pokémon Detail Page」） =====================
   前の7つ（種族値・解説・実数値・弱点・対策・技・特性）→ 概要・能力・相性・技・特性・型・育成・対策。
   中身は今までの計算と文をそのまま使う：monGuide(p,{parts:true})（39-guide-mons.js）の部品・mxBlocks・movesPanel・breakHTML・calcStats。
   新しい判定・ダメージの式は作らない。姿（メガシンカ等）はそれぞれのページ（#/p/番号）で、その姿のデータだけを出す */
const DP_TABS=['概要','能力','相性','技・特性','型・育成','対策'];
let DPF=null;   /* 型・育成タブの形式（はじめは対戦の形式 FMT） */
const dpList=a=>a.join('・');
const dpTyA=a=>a.map(t=>chip(t)).join('');
/* ---- 1. 概要：どんなポケモンか・強いところ・弱いところ・向いている役割・姿の違い ---- */
function dpOverviewHTML(p,g){
  /* 2026/11/15 依頼主「Premium UI」：枠の中に枠を重ねない。見出し・余白・区切り線で分け、1行ずつ押すと説明が開く（› が回る）。説明の中身は前と同じ */
  const base=p.base?byNo[p.base]:null;
  const li=(t,d,o={})=>`<details class="dp-li${o.cls||''}"><summary><span class="dp-li-t">${t}</span>${o.tag?`<span class="dp-li-tag${o.tagc?' '+o.tagc:''}">${o.tag}</span>`:''}<span class="dp-li-c" aria-hidden="true">›</span></summary><p>${d}</p></details>`;
  /* 役割：はじめ（ひとことの役）を「メイン」、積み技など条件のある役は「条件つき」と分ける。役の判定は前と同じ */
  const roles=g.roles.map((r,i)=>{const cond=/（(.+)のとき）$/.exec(r.name);return li(esc(cond?r.name.replace(/（.+のとき）$/,''):r.name),String(r.text).replace(/[<>]/g,''),
    {tag:i===0?'メイン':cond?esc(cond[1]):'',tagc:i===0?'is-main':cond?'is-cond':''})}).join('');
  let forms='';
  if(base&&g.megaCh)forms=`<section class="dp-sec"><h3 class="dp-st">メガシンカで変わるところ</h3><ul class="dp-ul">${g.megaCh.map(x=>`<li>${x}</li>`).join('')}</ul>
    <a class="dp-link" href="#/p/${base.no}"><span>元の姿（${esc(base.n)}）</span><span aria-hidden="true">›</span></a></section>`;
  else if(g.megas.length)forms=`<section class="dp-sec"><h3 class="dp-st">ほかの姿</h3>${g.megas.map(({m,stone})=>{const tc=m.t.join()!==p.t.join();
    return `<a class="dp-form" href="#/p/${m.no}"><span class="av">${stamp(m)}</span><span class="dp-form-m"><span class="dp-form-n">${nm(m)}</span><span class="dp-form-s">${esc(ITEMN[stone]||'メガストーン')}でメガシンカ・合計 ${p.bst}→${m.bst}${tc?`・${esc(dpList(m.t))}タイプに`:''}・特性 ${esc(ABN[m.ab]||m.ab)}</span></span><span class="dp-li-c" aria-hidden="true">›</span></a>`}).join('')}
    <p class="dp-fn">1回の対戦でメガシンカできるのは1匹だけです。</p></section>`;
  /* 英語のときは文が日本語だけと知らせる（攻略ガイドと同じ、英語は未翻訳） */
  const en=typeof LANG!=='undefined'&&LANG==='en';
  return `${en?'<p class="note" style="padding:12px 16px 0">This overview is currently available in Japanese only.</p>':''}<div class="dp-ov" data-notr>
    <section class="dp-intro"><h2 class="dp-ov-h">${esc(p.n)}はどんなポケモン？</h2><p class="dp-lead">${g.lead}</p></section>
    ${g.pros.length?`<section class="dp-sec"><h3 class="dp-st"><i class="dp-dot is-good" aria-hidden="true"></i>強いところ</h3><div class="dp-list">${g.pros.map(([t,d])=>li(esc(t),d)).join('')}</div></section>`:''}
    ${g.cons.length?`<section class="dp-sec"><h3 class="dp-st"><i class="dp-dot is-bad" aria-hidden="true"></i>弱いところ</h3><div class="dp-list">${g.cons.map(([t,d])=>li(esc(t),d)).join('')}</div></section>`:''}
    ${g.roles.length?`<section class="dp-sec"><h3 class="dp-st">向いている役割</h3><div class="dp-list">${roles}</div>
      <p class="dp-fn">種族値と覚える技から見た目安です。どの役で使うかは型（技・持ち物）で決まり、条件のある役はその技を入れた型のときだけです。</p></section>`:''}
    ${forms}
    <section class="dp-sec"><h3 class="dp-st">くわしく見る</h3><nav class="dp-nav" aria-label="ほかのタブへ">
      <button type="button" class="dp-link" data-dpgo="4"><span>型・育成<small>使われている型と、計算で組んだ型</small></span><span aria-hidden="true">›</span></button>
      <button type="button" class="dp-link" data-dpgo="2"><span>相性<small>受けるとき・攻めるときのタイプ相性</small></span><span aria-hidden="true">›</span></button>
      <button type="button" class="dp-link" data-dpgo="5"><span>対策<small>相手にいるときの崩し方</small></span><span aria-hidden="true">›</span></button></nav></section>
    <p class="dp-fn dp-fn-end">この概要は、当サイトのデータ（種族値・タイプ相性・覚える技・特性）から当サイトが組み立てたものです。</p></div>`;
}
/* ---- 3. 相性（攻めるとき）：タイプ一致技で弱点を突けるタイプ・半減以下のタイプ・いまの型の技の範囲 ---- */
function dpOffenseHTML(p,g){
  const st=g.stab||[];
  const se=T.filter(d=>st.some(t=>mult(t,[d])>=2)),bad=T.filter(d=>st.length&&st.every(t=>mult(t,[d])<1)),imm=bad.filter(d=>st.every(t=>mult(t,[d])===0));
  const fmt=DPF||FMT,set=g.sets.find(s=>(s.fmt||'single')===fmt)||g.sets[0];
  let setHTML='';
  if(set){const at=set.moves.filter(id=>MV[id]).map(mvObj).filter(m=>m&&m.pow>0&&m.cls<2);
    const cov=T.filter(d=>at.some(m=>mult(m.t,[d])>=2)),hard=T.filter(d=>at.length&&at.every(m=>mult(m.t,[d])<1));
    setHTML=`<h3>いまの型の技で見ると</h3><p class="note" style="padding:0">「${esc(set.title)}」（${(set.fmt||'single')==='double'?'ダブル':'シングル'}）の攻撃技：${esc(dpList(at.map(m=>m.n)))||'なし'}</p>
      <div class="dp-tyl"><b>弱点を突けるタイプ</b><div class="chips">${cov.length?dpTyA(cov):'<span class="note" style="padding:0">なし</span>'}</div></div>
      <div class="dp-tyl"><b>どの技でも等倍より低いタイプ</b><div class="chips">${hard.length?dpTyA(hard):'<span class="note" style="padding:0">なし</span>'}</div></div>
      <p class="note" style="padding:4px 0 0">技を入れかえると範囲が変わります。入れかえで良くなること・失うことは「技・特性」タブにあります。</p>`}
  return `<div class="dp-h"><h2>攻めるとき（攻撃の相性）</h2><p>${esc(p.n)}が相手を攻撃したときの倍率です。タイプだけで見ています。</p></div>
    <div class="gdoc" style="padding-top:0">
    ${st.length?`<h3>タイプ一致技（${dpTyA(st)}）で</h3>
      <div class="dp-tyl"><b>弱点を突けるタイプ</b><div class="chips">${se.length?dpTyA(se):'<span class="note" style="padding:0">なし</span>'}</div></div>
      <div class="dp-tyl"><b>${st.length>1?'どのタイプ一致技でも半減以下になるタイプ':'半減以下になるタイプ'}${imm.length?'（うち無効：'+esc(dpList(imm))+'）':''}</b><div class="chips">${bad.length?dpTyA(bad):'<span class="note" style="padding:0">なし</span>'}</div></div>
      ${st.length>1?(()=>{const one=st.map(t=>[t,T.filter(d=>mult(t,[d])===0)]).filter(x=>x[1].length);return one.length?`<p class="note" style="padding:2px 0 0">${one.map(([t,ds])=>`${esc(t)}技は${esc(dpList(ds))}タイプに効かない`).join('。')}。もう片方のタイプ一致技で攻撃します。</p>`:''})():''}`
      :'<p>タイプ一致の攻撃技を覚えません。</p>'}
    ${setHTML}
    ${g.good.length?`<h3>タイプ相性で有利に見える相手</h3><p class="note" style="padding:0 0 4px">こちらのタイプ一致技で弱点を突けて、相手のタイプ一致技では弱点を突かれない相手です。<b>タイプ相性だけの目安</b>で、素早さ・耐久・特性・持ち物しだいで負けることもあります。</p>
      <div class="pills gchips">${g.good.map(q=>`<a class="pill gchip" href="#/p/${q.no}">${esc(formInfo(q).base)}${formInfo(q).tag?'（'+esc(formInfo(q).tag)+'）':''}</a>`).join('')}</div>`:''}
    <div class="dp-3l"><b>3つの見方を分けています</b>
      <p><b>タイプ相性</b>（このタブ）＝倍率だけ。<b>ダメージ計算</b>（「型・育成」の苦手なポケモン・ダメージ計算のツール）＝能力・技の威力・持ち物まで入れた数字。<b>実戦の有利・不利</b>（「対策」タブ）＝素早さと、お互い何回で倒せるかまで見た目安。</p></div>
    </div>`;
}
/* ---- 4. 技・特性：目的ごとの技・入れかえ候補（良くなること／失うこと）・姿ごとの特性。覚える技の一覧は movesPanel（28-moves.js） ---- */
function dpMovesHTML(p,g){
  const base=p.base?byNo[p.base]:null;
  const mvA=id=>`<a class="pill gchip" href="#/move/${id}">${esc(mName(id))}</a>`;
  const fm=f=>f==='double'?'ダブル':'シングル';
  const rp=g.repl.slice(0,8);
  let abForm='';
  if(base)abForm=`<p class="note" style="padding:0 16px 6px">この姿の特性は<b>${esc(ABN[p.ab]||p.ab)}</b>（メガシンカで変わる）。元の姿（${esc(base.n)}）の特性は${esc(dpList((ABD[base.no]||[]).map(a=>ABN[a[0]]||a[0])))}です。技は元の姿と同じです。</p>`;
  else if(g.megas.length)abForm=`<p class="note" style="padding:0 16px 6px">下の特性は元の姿のものです。メガシンカすると特性が変わります：${g.megas.map(({m})=>`${esc(m.n)}＝<b>${esc(ABN[m.ab]||m.ab)}</b>`).join('、')}。</p>`;
  return `${g.mvParts.length?`<div class="dp-h"><h2>目的ごとの技</h2><p>どの技も必ず入れる技ではありません。型の目的に合わせて選びます。</p></div>
    ${g.mvParts.map(([t,d,ids])=>`<div class="gdoc gsub"><h3>${t}</h3>${d?`<p>${d}</p>`:''}</div>${ids.length?`<div class="pills gchips">${ids.map(mvA).join('')}</div>`:''}`).join('')}`:''}
    ${rp.length?`<div class="dp-h"><h2>技の入れかえ候補</h2><p>型の例の技を1つ入れかえたときに、良くなること・失うことです（技のデータとタイプ相性から計算）。</p></div>
      <div class="dp-rpl">${rp.map(r=>`<div class="dp-rp"><div class="dp-rp-h"><span class="dp-rp-f">${fm(r.fmt)}・${esc(r.set)}</span></div>
        <div class="dp-rp-m"><span class="dp-rp-out">${esc(mName(r.from))}</span><span aria-hidden="true">→</span><a class="dp-rp-in" href="#/move/${r.to}">${esc(mName(r.to))}</a></div>
        <p><b>良くなること：</b>${esc(r.why)}</p><p><b>失うこと：</b>${r.lost.length?`${esc(dpList(r.lost))}タイプに弱点を突けなくなる`:'弱点を突けるタイプの範囲は変わらない（威力や命中は変わる）'}</p></div>`).join('')}</div>`:''}
    ${abForm}`;
}
/* ---- 5. 型・育成：実際の使用データ／計算で組んだ提案／自分で組む。シングルとダブルを分ける ---- */
function dpBuildsHTML(p,g){
  const f=DPF||FMT;
  const idx=s=>g.sets.indexOf(s),of=a=>a.filter(s=>(s.fmt||'single')===f);
  const live=of(g.sets.filter(s=>s.live||s.usage)),calc=of(g.sets.filter(s=>!s.live&&!s.usage));
  const usage=typeof usageGuideHTML==='function'&&!p.base?usageGuideHTML(p,f,h=>h):'';
  return `<div class="dp-h"><h2>型・育成</h2><p>型は3種類に分けています：<b>実際の使用データ</b>・<b>当サイトが計算で組んだ提案</b>・<b>自分で組む</b>。</p></div>
    <div class="pills dp-fmt" role="tablist" aria-label="対戦の形式">${[['single','シングル'],['double','ダブル']].map(([k,l])=>`<button class="pill" role="tab" data-dpf="${k}" aria-selected="${k===f}" aria-pressed="${k===f}">${l}</button>`).join('')}</div>
    <div class="dp-bsec"><h3>実際の使用データから（${f==='double'?'ダブル':'シングル'}）</h3>
      ${live.length?live.map(s=>g.setHTML(s,idx(s))).join(''):`<p class="note" style="padding:0">${p.base?'メガシンカの姿は、元の姿のページで集計を見られます。':(typeof CBD_DETAIL!=='undefined'&&CBD_DETAIL?'':LIVE.off?'ランクバトルの集計は、提供元の利用条件を確認しているため休止しています。':'この形式の使用データはまだありません（集計の上位にいない・まだ読み込めていない）。')}</p>`}
      ${!p.base&&typeof CBD_DETAIL!=='undefined'&&CBD_DETAIL?'<div id="cbdd-box"></div>':''}
      ${g.liveF===f?g.live:''}${usage}</div>
    <div class="dp-bsec"><h3>当サイトが計算で組んだ提案（${f==='double'?'ダブル':'シングル'}）</h3>
      ${calc.length?calc.map(s=>g.setHTML(s,idx(s))).join(''):'<p class="note" style="padding:0">この形式の提案はありません。</p>'}</div>
    <div class="dp-bsec"><h3>自分で組む</h3><p class="note" style="padding:0">性格・能力ポイント・持ち物・特性・技4つは、パーティの育成の画面で決めます。実数値は「能力」タブでも試せます。</p>
      <div class="btns" style="flex-wrap:wrap"><button class="btn btn-p" data-dpcustom>パーティに入れて育成を決める</button><button class="btn btn-s" data-dpgo-stats>能力タブで実数値を試す</button></div></div>
    ${g.partners.length?`<div class="dp-bsec"><h3>相性のいい味方の例</h3><p class="note" style="padding:0">${esc(p.n)}の弱点を受けられるか、天気・トリックルームで助け合えるポケモンです（タイプと特性から計算。実際の勝ち負けまでは見ていません）。</p>
      ${g.partners.map(({q,why})=>`<a class="row" href="#/p/${q.no}"><span class="av">${stamp(q)}</span><div class="row-m"><div class="row-t">${nm(q)}</div><div class="row-s">${why.slice(0,2).join('。')}</div></div><span class="chev">${SVG(I.chev,18)}</span></a>`).join('')}</div>`:''}
    ${g.axis}`;
}
/* パーティに入れる：同じポケモンがいれば育成を置きかえる前に確かめる。6匹いれば何もしない（黙って入れかえない） */
async function dpToParty(p,s){
  const no=p.base||p.no,name=byNo[no].n,i=team.findIndex(x=>x.no===no);
  const sv=s?{...toSaved(s),src:'copy'}:undefined;
  if(i>=0){
    if(!s){nav('#/edit/'+i);return}
    if(team[i].set&&!(await askConfirm({title:`${name}の育成を置きかえますか？`,text:`いまのパーティ（${typeof teamName==='function'?teamName(TEAMS.cur):''}）にいる${name}の技・持ち物などが、この型に置きかわります。`,ok:'置きかえる',danger:true})))return;
    team[i].set=sv;saveTeam();toast(`${name}の育成をこの型にしました`);return}
  if(team.length>=6){toast('パーティが6匹そろっています。入れかえる匹を外してから入れてください');return}
  team.push({no,sel:team.filter(x=>x.sel).length<PICK(),...(sv?{set:sv}:{})});saveTeam();
  if(!s){nav('#/edit/'+(team.length-1));return}
  toast(`${name}をこの型でパーティに入れました`);
}
function dpBuildsBind(el,p,g){
  if(typeof cbddMount==='function')cbddMount(el,p,DPF||FMT);
  el.querySelectorAll('[data-dpf]').forEach(b=>b.onclick=()=>{DPF=b.dataset.dpf;el.innerHTML=dpBuildsHTML(p,g);dpBuildsBind(el,p,g);
    const off=document.getElementById('dp-off');if(off&&off.innerHTML)off.innerHTML=dpOffenseHTML(p,g)});
  el.querySelectorAll('[data-useset]').forEach(b=>b.onclick=()=>{const s=g.sets[+b.dataset.useset];if(s)dpToParty(p,s)});
  const c=el.querySelector('[data-dpcustom]');if(c)c.onclick=()=>dpToParty(p,null);
  const sg=el.querySelector('[data-dpgo-stats]');if(sg)sg.onclick=()=>{const b=document.querySelector('#seg [data-i="1"]');if(b)b.click();const r=document.getElementById('dp-real');if(r)r.scrollIntoView({block:'start'})};
  el.querySelectorAll('[data-axis]').forEach(b=>b.onclick=()=>{const d=AXIS_DATA[b.dataset.axis];if(d)useTeam(d.name,d.list)});
}
