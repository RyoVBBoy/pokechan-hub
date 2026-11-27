/* ===================== 図鑑のページの6つのタブ（2026/11/15 依頼主「Comprehensive Redesign of the Pokémon Detail Page」） =====================
   前の7つ（種族値・解説・実数値・弱点・対策・技・特性）→ 概要・能力・相性・技・特性・型・育成・対策。
   中身は今までの計算と文をそのまま使う：monGuide(p,{parts:true})（39-guide-mons.js）の部品・mxBlocks・movesPanel・breakHTML・calcStats。
   新しい判定・ダメージの式は作らない。姿（メガシンカ等）はそれぞれのページ（#/p/番号）で、その姿のデータだけを出す */
const DP_TABS=['概要','能力','相性','技・特性','型・育成','対策'];
let DPF=null;   /* 型・育成タブの形式（はじめは対戦の形式 FMT） */
const dpList=a=>a.join('・');
const dpTyA=a=>a.map(t=>chip(t)).join('');
/* ---- 1. 概要：どんなポケモンか・強いところ・弱いところ・向いている役割・姿の違い ---- */

/* Evidence-first overview: only measured values, legal ability/move choices and explicit conditions.
   No invented overall strength scores. The deeper tabs retain their existing calculations. */
function dpEvidenceHTML(p){
  const abs=(p.ab?[[p.ab,0]]:ABD[p.no]||[]).map(a=>a[0]);
  const ids=(LSD[p.no]||LSD[p.base]||[0,[]])[1]||[];
  const facts={
    'huge-power':'攻撃の実数値が2倍になる。物理技で活かせる。',
    'pure-power':'攻撃の実数値が2倍になる。物理技で活かせる。',
    'water-bubble':'みず技の火力を強化し、ほのお技の被ダメージを半減する。',
    'fur-coat':'物理技に対する耐久を高める。',
    'magic-bounce':'対象となる相手の変化技を跳ね返す。',
    'zero-to-hero':'一度交代して戻るとマイティフォルムで戦える。',
    'stance-change':'攻撃時と防御時の姿で能力が異なる。',
    'emergency-exit':'攻撃を受けHPが半分以下になると交代が発生する場合がある。',
    'prankster':'変化技の優先度が上がる。相手のあくタイプなどには制約がある。',
    'intimidate':'場に出たとき相手の攻撃を下げる。無効化や反応する特性に注意。',
    'multiscale':'HP満タン時に受ける攻撃のダメージを軽減する。',
    'disguise':'最初の対象となる攻撃を受けると姿が変わる。',
    'regenerator':'交代で引くとHPを回復する。',
    'technician':'条件を満たす低威力技を強化する。'
  };
  const special=abs.filter(k=>facts[k]);
  const ordered=[...special,...abs.filter(k=>!special.includes(k))];
  const abRows=ordered.map(k=>'<details class="dp-li"><summary><span class="dp-li-t">'+esc(ABN[k]||k)+'</span><span class="dp-li-c" aria-hidden="true">›</span></summary><p>'+esc(facts[k]||ABDS[k]||'効果は特性の詳細で確認してください。')+'</p></details>').join('');
  const hit=abs.filter(k=>k==='huge-power'||k==='pure-power');
  const raw=calcStats(p,[0,32,0,0,0,0],1,3)[1];
  const bar=(label,v,max)=>'<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 8px;margin:8px 0"><span>'+esc(label)+'</span><b>'+v+'</b><span style="grid-column:1/-1;height:9px;border-radius:6px;background:var(--line);overflow:hidden"><span style="display:block;width:'+Math.min(100,v/max*100)+'%;height:100%;background:var(--acc);border-radius:6px"></span></span></div>';
  const chart=hit.length?'<section class="dp-sec"><h3 class="dp-st">特性で変わる攻撃</h3>'+bar('特性の補正なし',raw,raw*2)+bar(ABN[hit[0]]+'の補正あり',raw*2,raw*2)+'<p class="dp-fn">攻撃上昇補正・能力ポイント32。特性が有効な場合の計算上の攻撃値であり、最終ダメージではありません。</p></section>':'';
  const speed=calcStats(p,[0,0,0,0,0,32],5,1)[5];
  const comparisons=[
    ['water-bubble','みず技の威力補正',2,'みず技を使う場合'],
    ['fur-coat','物理防御の補正',2,'特性が有効な場合'],
    ['ice-scales','特殊技の被ダメージ補正',0.5,'特性が有効な場合'],
    ['multiscale','被ダメージ補正',0.5,'HP満タン時'],
    ['swift-swim','素早さ',2,'雨のとき'],
    ['chlorophyll','素早さ',2,'晴れのとき'],
    ['sand-rush','素早さ',2,'砂嵐のとき'],
    ['slush-rush','素早さ',2,'雪のとき']
  ].filter(([k])=>abs.includes(k));
  const extra=comparisons.map(([k,label,m,cond])=>{
    const isSpeed=label==='素早さ',v=isSpeed?speed:100,max=Math.max(v,v*m);
    return '<details class="dp-li"><summary>'+esc(ABN[k]||k)+'：'+esc(label)+'</summary>'+bar('補正なし',v,max)+bar('補正あり',v*m,max)+'<p class="dp-fn">'+esc(cond)+(isSpeed?'。素早さ上昇補正・能力ポイント32。':'。補正なしを100とした比較。最終ダメージではありません。')+'</p></details>';
  }).join('');
  const mvIds=ids.filter(id=>MV[id]).filter(id=>{const k=MD[id]&&MD[id][3];return ['aquajet','suckerpunch','extremespeed','machpunch','bulletpunch','iceshard','shadowsneak','fakeout','uturn','voltswitch','flipturn','partingshot','trickroom','tailwind','bellydrum','swordsdance','nastyplot','quiverdance','followme','ragepowder','wideguard'].includes(k)});
  const tags=mvIds.slice(0,8).map(id=>'<a class="pill gchip" href="#/move/'+id+'">'+esc(mName(id))+'</a>').join('');
  const form=p.base?byNo[p.base]:null;
  const delta=form?'<section class="dp-sec"><h3 class="dp-st">メガシンカ前後の種族値</h3>'+SN.map((n,i)=>{const a=form.s[i],b=p.s[i],d=b-a;return '<div style="display:grid;grid-template-columns:4em minmax(0,1fr) auto;align-items:center;gap:6px;margin:8px 0"><span>'+n+'</span><span style="height:8px;border-radius:5px;background:var(--line);overflow:hidden"><span style="display:block;height:100%;width:'+Math.abs(d)/Math.max(1,...p.s.map((v,j)=>Math.abs(v-form.s[j])))*100+'%;background:var(--acc)"></span></span><b>'+a+' → '+b+' ('+(d>0?'+':'')+d+')</b></div>'}).join('')+'<p class="dp-fn">棒の長さは変化量の絶対値。合計種族値や特性の効果とは別です。</p></section>':'';
  const statNames=['HP','攻撃','防御','特攻','特防','素早さ'];
  const hasMove=id=>ids.includes(id)&&!!MV[id];
  const dragonDance=hasMove(349);
  const priority=ids.filter(id=>MV[id]&&mvObj(id)&&mvObj(id).pri>0&&mvObj(id).cls<2);
  const danceStats=calcStats(p,[2,32,0,0,0,32],1,3);
  const danceChart=dragonDance?'<details class="dp-li"><summary>りゅうのまい：攻撃・素早さの変化</summary>'+[1,5].map(i=>bar(statNames[i]+'（使用前）',danceStats[i],Math.floor(danceStats[i]*1.5))+bar(statNames[i]+'（1回使用後）',Math.floor(danceStats[i]*1.5),Math.floor(danceStats[i]*1.5))).join('')+'<p class="dp-fn">攻撃上昇・特攻下降補正、HP2・攻撃32・素早さ32。ランク0から1へ上昇した場合。特性・持ち物・場の補正なし。</p></details>':'';
  const priorityText=priority.length?'<details class="dp-li"><summary>先制攻撃の選択肢</summary>'+priority.map(id=>'<p>'+esc(mName(id))+'：優先度 +'+mvObj(id).pri+'</p>').join('')+'<p class="dp-fn">技の成功条件や優先度の高い相手の技、先制技を防ぐ効果に注意。</p></details>':'';
  const formatMoves=(label,entries)=>{
    const rows=entries.filter(([id])=>hasMove(id)).map(([id,why])=>'<p><a href="#/move/'+id+'">'+esc(mName(id))+'</a>：'+esc(why)+'</p>').join('');
    return rows?'<details class="dp-li"><summary>'+label+'</summary>'+rows+'</details>':'';
  };
  const singleRoles=formatMoves('シングル：戦い方の候補',[[349,'攻撃と素早さを上げる積み技'],[14,'攻撃を2段階上げる積み技'],[417,'特攻を2段階上げる積み技'],[245,'優先度+2の攻撃技。無効タイプなどに注意']]);
  const doubleRoles=formatMoves('ダブル：味方と連携する技',[[366,'味方側の素早さを上げる'],[433,'同じ優先度内の素早さ順を逆転させる'],[266,'対象となる相手の技を自分に引き寄せる'],[476,'対象となる相手の技を自分に引き寄せる。粉技無効の相手などに注意'],[469,'対象となる範囲攻撃から味方側を守る'],[252,'場に出た最初のターンに使える先制技。ひるみ無効などに注意']]);
  const moveEvidence=danceChart+priorityText+singleRoles+doubleRoles;

  const topStat=p.s.reduce((best,v,i)=>v>p.s[best]?i:best,0);
  const headline=hit.length?'特性'+ABN[hit[0]]+'を選ぶと物理火力を伸ばせる。':special.length?ABN[special[0]]+'：'+facts[special[0]]:'最も高い種族値は'+statNames[topStat]+'（'+p.s[topStat]+'）。特性や習得技と合わせて戦い方を考えられる。';
  return {headline:esc(headline),html:chart+(moveEvidence?'<section class="dp-sec"><h3 class="dp-st">技による性能の変化</h3>'+moveEvidence+'</section>':'')+(extra?'<section class="dp-sec"><h3 class="dp-st">条件による性能の変化</h3>'+extra+'</section>':'')+(abRows?'<section class="dp-sec"><h3 class="dp-st">特性で変わる戦い方</h3><div class="dp-list">'+abRows+'</div><p class="dp-fn">特性は同時に発動するものではありません。選んだ特性と発動条件によって性能が変わります。</p></section>':'')+(tags?'<section class="dp-sec"><h3 class="dp-st">戦い方を広げる技</h3><div class="pills gchips">'+tags+'</div><p class="dp-fn">習得できる技の一例。採用率や同時採用を示すものではありません。</p></section>':'')+delta};
}

function dpOverviewHTML(p,g){
  const evidence=dpEvidenceHTML(p);
  /* 2026/11/15 依頼主「Premium UI」：枠の中に枠を重ねない。見出し・余白・区切り線で分け、1行ずつ押すと説明が開く（› が回る）。説明の中身は前と同じ */
  const base=p.base?byNo[p.base]:null;
  const li=(t,d,o={})=>`<details class="dp-li${o.cls||''}"><summary><span class="dp-li-t">${t}</span>${o.tag?`<span class="dp-li-tag${o.tagc?' '+o.tagc:''}">${o.tag}</span>`:''}<span class="dp-li-c" aria-hidden="true">›</span></summary><p>${d}</p></details>`;
  /* 役割：はじめ（ひとことの役）を「メイン」、積み技など条件のある役は「条件つき」と分ける。役の判定は前と同じ */
  const roles=g.roles.map((r,i)=>{const cond=/（(.+)のとき）$/.exec(r.name);return li(esc(cond?r.name.replace(/（.+のとき）$/,''):r.name),String(r.text).replace(/[<>]/g,''),
    {tag:cond?esc(cond[1]):'候補',tagc:cond?'is-cond':''})}).join('');
  let forms='';
  if(base&&g.megaCh)forms=`<section class="dp-sec"><h3 class="dp-st">メガシンカで変わるところ</h3><ul class="dp-ul">${g.megaCh.map(x=>`<li>${x}</li>`).join('')}</ul>
    <a class="dp-link" href="#/p/${base.no}"><span>元の姿（${esc(base.n)}）</span><span aria-hidden="true">›</span></a></section>`;
  else if(g.megas.length)forms=`<section class="dp-sec"><h3 class="dp-st">ほかの姿</h3>${g.megas.map(({m,stone})=>{const tc=m.t.join()!==p.t.join();
    return `<a class="dp-form" href="#/p/${m.no}"><span class="av">${stamp(m)}</span><span class="dp-form-m"><span class="dp-form-n">${nm(m)}</span><span class="dp-form-s">${esc(ITEMN[stone]||'メガストーン')}でメガシンカ・合計 ${p.bst}→${m.bst}${tc?`・${esc(dpList(m.t))}タイプに`:''}・特性 ${esc(ABN[m.ab]||m.ab)}</span></span><span class="dp-li-c" aria-hidden="true">›</span></a>`}).join('')}
    <p class="dp-fn">1回の対戦でメガシンカできるのは1匹だけです。</p></section>`;
  /* 英語のときは文が日本語だけと知らせる（攻略ガイドと同じ、英語は未翻訳） */
  const en=typeof LANG!=='undefined'&&LANG==='en';
  return `${en?'<p class="note" style="padding:12px 16px 0">This overview is currently available in Japanese only.</p>':''}<div class="dp-ov" data-notr>
    <section class="dp-intro"><h2 class="dp-ov-h">${esc(p.n)}はどんなポケモン？</h2><p class="dp-lead">${evidence.headline}</p><details class="dp-li"><summary>役割・姿の詳しい説明</summary><p>${g.lead}</p></details></section>${evidence.html}
    ${g.pros.length?`<section class="dp-sec"><h3 class="dp-st"><i class="dp-dot is-good" aria-hidden="true"></i>強いところ</h3><div class="dp-list">${g.pros.slice(0,3).map(([t,d])=>li(esc(t),d)).join('')}</div></section>`:''}
    ${g.cons.length?`<section class="dp-sec"><h3 class="dp-st"><i class="dp-dot is-bad" aria-hidden="true"></i>弱いところ</h3><div class="dp-list">${g.cons.slice(0,2).map(([t,d])=>li(esc(t),d)).join('')}</div></section>`:''}
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
      ${live.length?live.map(s=>g.setHTML(s,idx(s))).join(''):`<p class="note" style="padding:0">${p.base?'メガシンカの姿は、元の姿のページで集計を見られます。':'この形式の使用データはまだありません（集計の上位にいない・まだ読み込めていない）。'}</p>`}
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
  el.querySelectorAll('[data-dpf]').forEach(b=>b.onclick=()=>{DPF=b.dataset.dpf;el.innerHTML=dpBuildsHTML(p,g);dpBuildsBind(el,p,g);
    const off=document.getElementById('dp-off');if(off&&off.innerHTML)off.innerHTML=dpOffenseHTML(p,g)});
  el.querySelectorAll('[data-useset]').forEach(b=>b.onclick=()=>{const s=g.sets[+b.dataset.useset];if(s)dpToParty(p,s)});
  const c=el.querySelector('[data-dpcustom]');if(c)c.onclick=()=>dpToParty(p,null);
  const sg=el.querySelector('[data-dpgo-stats]');if(sg)sg.onclick=()=>{const b=document.querySelector('#seg [data-i="1"]');if(b)b.click();const r=document.getElementById('dp-real');if(r)r.scrollIntoView({block:'start'})};
  el.querySelectorAll('[data-axis]').forEach(b=>b.onclick=()=>{const d=AXIS_DATA[b.dataset.axis];if(d)useTeam(d.name,d.list)});
}
