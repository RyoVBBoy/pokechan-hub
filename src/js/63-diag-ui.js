/* ===================== 診断の見せ方（2026/11/10 依頼主「UI改善」第1段階：診断結果の最初の画面） =====================
   新しい判定は作らない。数字はすべて今の計算結果から取る：
   ・◎○△×＝dgTeam の lvl（相手ごとの対応力と同じ）。匹数と割合
   ・4分野（攻撃・防御・素早さ・役割）＝dgAnalyze の気になる点の重要度（sev：深刻3・注意2・軽い1）のいちばん重いもの。なければ「問題なし」
   ・最も深刻な弱点＝パーティのチェックの「対面の計算で見つかった弱点」と同じ並び（重い順）の先頭3つ
   ・おすすめの選出＝選出の比較（dgSelect）の1番と先発
   ・改善案＝dgImprove の1番（画面を出したあと後ろで計算。同じパーティ・同じ条件なら使い回す） */
/* 記号は「問題なし」の✓だけ（2026/11/10 依頼主：深刻・注意は記号なしで、文字と色で分ける） */
const DGU_SEV={3:['深刻','','sv3'],2:['注意','','sv2'],1:['軽い','','sv1'],0:['問題なし','✓','sv0']};
const DGU_AREAS=['攻撃','防御','素早さ','役割'];
const DGU_LV=[[4,'◎','安定して対応（2匹以上）'],[3,'○','対応できるが1匹に頼る'],[2,'△','条件つき・不安定'],[1,'×','対応できない']];
/* ◎○△× の横棒：実際の匹数と割合 */
function dguBars(cnt,N){
  return `<div class="dgu-bars" role="list">${DGU_LV.map(([l,m,lab])=>{const n=cnt[l]||0,p=N?Math.round(n/N*100):0;
    return `<div class="dgu-bar dgu-l${l}" role="listitem"><span class="dgu-bm">${m}</span><span class="dgu-bl">${lab}</span><span class="dgu-bt"><i style="width:${p}%"></i></span><span class="dgu-bn"><b>${n}匹</b>（${p}%）</span></div>`}).join('')}</div>`;
}
const dguSevTag=s=>{const v=DGU_SEV[s]||DGU_SEV[0];return `<span class="dgu-sev ${v[2]}">${v[1]?`<i aria-hidden="true">${v[1]}</i>`:''}${v[0]}</span>`};
function dguSumHTML(){return `<div id="dgu-sum" class="dgu-card"><p class="dgu-loading">診断をまとめています…</p></div>`}
function dguSumFill(entries,C){
  const box=document.getElementById('dgu-sum');if(!box)return;
  let T,A;try{T=dgTeam(entries,20);A=dgAnalyze(T)}catch(e){box.innerHTML='';return}
  const N=T.rows.length;if(!N){box.innerHTML='';return}
  const cnt={1:0,2:0,3:0,4:0};T.rows.forEach(r=>cnt[r.lvl]++);
  /* 4分野の状態＝その分野の気になる点のいちばん重い重要度 */
  const areaSev=a=>Math.max(0,...A.bad.filter(x=>x.area===a).map(x=>x.sev||0));
  /* 最も深刻な弱点：パーティのチェックの計算の弱点と同じ並び（partyCheck の fix のうち計算のもの＝重い順）の先頭3つ */
  const W=(C&&C.fix?C.fix.filter(x=>x.k==='calc'):A.bad).slice(0,3);
  const nBad=(C&&C.fix?C.fix.filter(x=>x.k==='calc'):A.bad).length;
  let S=null;try{S=dgSelect(entries)}catch(e){}
  const nm=i=>esc(formInfo(T.ms[i].p).base);
  const sel=S&&S.best?(()=>{const b=S.best,ld=b.pairs?b.pairs[0].pr:[b.lead1[0].i];
    return `<div class="dgu-sec"><h3>おすすめの選出</h3><p class="dgu-sel">${b.c.map(i=>`<span class="dgu-mon${ld.includes(i)?' dgu-lead':''}">${nm(i)}${ld.includes(i)?'<small>先発</small>':''}</span>`).join('')}</p>
      <p class="dgu-note">${S.list.length}通りの選出を比べた1番です。この選出で ◎${b.cnt[4]}・○${b.cnt[3]}・△${b.cnt[2]}・×${b.cnt[1]}（上位${S.N}匹）。${b.pairs?'先発2匹は簡易比較です。':''}</p>
      <button class="dgu-link" data-dgu-tab="plan">選出の理由・先発の比較を見る（構築 › 選出アシスト）</button></div>`})():'';
  box.innerHTML=`<div class="dgu-head"><h2>診断のまとめ</h2><span class="dgu-fmt">${FMTN()}・使用率の上位${N}匹と1匹ずつ計算</span></div>
    <nav class="dgu-jump" aria-label="診断の中を移動">${[['pcw0','弱点のカード'],['lose-box','敗因の診断'],['dg-box','相手ごとの対応力'],['imp-box','改善案']].filter(([id])=>document.getElementById(id)).map(([id,t])=>`<a href="#" data-dgu-go="${id}">${t}</a>`).join('')}</nav>
    <div class="dgu-sec"><h3>総合評価</h3>
      <div class="dgu-areas">${DGU_AREAS.map(a=>`<div class="dgu-area"><span class="dgu-an">${a}</span>${dguSevTag(areaSev(a))}</div>`).join('')}</div>
      ${dguBars(cnt,N)}
      ${T.tr&&T.tr.on?`<p class="dgu-note">トリックルーム中：${DGU_LV.map(([l,m])=>`${m}${T.rows.filter(r=>r.lvlTR===l).length}匹`).join('・')}（上の数はトリックルームなし）</p>`:''}
      <p class="dgu-note">点数はつけていません。4つの分野は、下の「対面の計算で見つかった弱点」の重要度のいちばん重いものです。</p></div>
    <div class="dgu-sec"><h3>最も深刻な弱点${nBad>3?`（${nBad}件のうち重い順に3件）`:''}</h3>
      ${W.length?`<ol class="dgu-weak">${W.map((x,k)=>`<li><a href="#" data-dgu-go="pcw${k}">${dguSevTag(x.sev||1)}<span class="dgu-wa">${esc(x.area||'')}</span><span class="dgu-wt">${x.t}</span></a></li>`).join('')}</ol>`:'<p class="dgu-ok">✓ 対面の計算で見つかった深刻・注意の弱点はありません。</p>'}</div>
    <div class="dgu-sec"><h3>最優先で改善すること</h3>
      ${W.length&&W[0].how?`<p class="dgu-how"><b>${esc(W[0].t.replace(/<[^>]+>/g,''))}</b>：${W[0].how}</p>`:''}
      <div id="dgu-imp" class="dgu-imp"><p class="dgu-loading">改善案を計算中…（変更後のパーティを計算し直しています）</p></div></div>
    ${sel}`;
  box.querySelectorAll('[data-dgu-go]').forEach(a=>a.onclick=e=>{e.preventDefault();const t=document.getElementById(a.dataset.dguGo);if(t){t.scrollIntoView({behavior:'smooth',block:'start'});t.classList.add('dgu-flash');setTimeout(()=>t.classList.remove('dgu-flash'),1200)}});
  /* 選出の理由へ：構築と選出タブの「選出の比較」まで送る（タブの切りかえは ttJump） */
  box.querySelectorAll('[data-dgu-tab]').forEach(b=>b.onclick=()=>ttJump(b.dataset.dguTab,'sel-box'));
  /* 改善案：画面を出したあと後ろで計算（すでにあれば使い回す） */
  dguImp(entries);
}
function dguImpHTML(R){
  const o=R&&R.list&&R.list[0];
  if(!o)return `<p class="dgu-note">${R&&R.note?esc(R.note):'計算した範囲では、ほかを悪くせずに良くなる変更は見つかりませんでした。'}</p>`;
  const B=o.J.b,A=o.J.a,ch=[];
  [['x','答えがない相手'],['w','△以下の相手'],['nosw','後出しできない相手'],['ohko','半分以上を一撃で倒される相手'],['slow','だれも先に動けない相手']].forEach(([k,l])=>{if(B[k]!=null&&A[k]!=null&&B[k]!==A[k])ch.push(`<span class="dgu-chg ${A[k]<B[k]?'up':'dn'}">${l} ${B[k]}→${A[k]}</span>`)});
  if(B.st!=null&&A.st!=null&&B.st!==A.st)ch.push(`<span class="dgu-chg ${A.st>B.st?'up':'dn'}">◎ ${B.st}→${A.st}</span>`);
  return `<p class="dgu-it"><span class="pc-area">${IMP_KIND[o.kind]}</span><b>${esc(o.title)}</b></p><p class="dgu-chgs">${ch.join('')}</p>
    <button class="dgu-link" data-dgu-go2="imp-box">ほかの改善案（${R.list.length}件）と、変更前後の詳細を見る</button>`;
}
function dguImp(entries){
  const el=document.getElementById('dgu-imp');if(!el)return;
  const show=R=>{const e=document.getElementById('dgu-imp');if(!e)return;e.innerHTML=dguImpHTML(R);
    e.querySelectorAll('[data-dgu-go2]').forEach(b=>b.onclick=()=>{const t=document.getElementById(b.dataset.dguGo2);if(t)t.scrollIntoView({behavior:'smooth',block:'start'})});
    const box=document.getElementById('imp-box');if(box&&typeof impRender==='function')impRender(box,R)};
  const c=typeof impCached==='function'&&impCached(entries);if(c){show(c);return}
  const sig=impKey(entries);
  const go=()=>{if(!document.getElementById('dgu-imp')||impKey(team)!==sig)return;
    let R;try{R=impGet(entries)}catch(e){const e2=document.getElementById('dgu-imp');if(e2){e2.innerHTML=`<p class="dgu-note">改善案を計算できませんでした。</p><button class="dgu-link" id="dgu-retry">もう一度計算する</button>`;e2.querySelector('#dgu-retry').onclick=()=>{e2.innerHTML='<p class="dgu-loading">改善案を計算中…</p>';setTimeout(go,30)}}return}
    show(R)};
  /* 描画が終わってから（ブラウザが空いたとき）計算する */
  setTimeout(()=>{if(typeof requestIdleCallback==='function')requestIdleCallback(go,{timeout:1500});else go()},120);
}
/* ===================== 第2段階：深刻な弱点・注意事項のカード（2026/11/10） =====================
   1枚のカード＝重要度・分野・問題の名前／起きる相手（名前の札）／理由／改善する方法／入れかえ案／計算根拠（たたむ。中身は今までの根拠を全部）。
   深刻・注意は理由と改善を最初から出す。軽い（sev1）はコンパクトに、理由・改善・根拠をたたむ。よいところは✓の1行。
   数・文はすべて partyCheck／dgAnalyze の項目そのまま（作り直さない） */
const DGU_OPP_SHOW=6;
function dguOpps(list){
  if(!list||!list.length)return '';
  const a=list.slice(0,DGU_OPP_SHOW).map(n=>`<span class="dgc-op">${esc(n)}</span>`).join('');
  return `<div class="dgc-row"><span class="dgc-k">起きる相手（${list.length}匹）</span><div class="dgc-ops">${a}${list.length>DGU_OPP_SHOW?`<span class="dgc-more">ほか${list.length-DGU_OPP_SHOW}匹：${esc(list.slice(DGU_OPP_SHOW).join('・'))}</span>`:''}</div></div>`;
}
function dguEv(x){return x.ev&&x.ev.length?`<details class="dgc-ev"><summary>計算根拠を見る（${x.ev.length}件）</summary><ul class="pc-ev">${x.ev.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></details>`:''}
/* bad＝気になる点、swHTML＝入れかえ案（13-party.js が作る。ボタンの動きはそちら）、chips＝ポケモンの札 */
function dguCard(x,bad,swHTML,chips){
  const id=x.id?` id="${x.id}"`:'';
  if(bad==='ref')return `<div class="pc-i dgc dgc-ref"${id}><div class="dgc-h"><span class="dgu-sev svref">参考</span>${x.area?`<span class="dgu-wa">${esc(x.area)}</span>`:''}<b class="dgc-t">${x.t}</b></div>${dguOpps(x.opps)}${x.d||x.how||(x.ev&&x.ev.length)?`<details class="dgc-ev"><summary>くわしく見る</summary>${x.d?`<p class="dgc-p">${x.d}</p>`:''}${x.how?`<p class="dgc-p"><b>改善する方法：</b>${x.how}</p>`:''}${swHTML||''}${chips||''}${x.ev&&x.ev.length?`<ul class="pc-ev">${x.ev.map(e=>`<li>${esc(e)}</li>`).join('')}</ul>`:''}</details>`:''}</div>`;
  if(!bad)return `<div class="pc-i dgc dgc-ok"${id}><div class="dgc-h"><span class="dgu-sev sv0"><i aria-hidden="true">✓</i>よい</span>${x.area?`<span class="dgu-wa">${esc(x.area)}</span>`:''}<b class="dgc-t">${x.t}</b></div>${x.d?`<p class="dgc-p">${x.d}</p>`:''}${dguEv(x)}</div>`;
  const s=x.sev||0,head=`<div class="dgc-h">${s?dguSevTag(s):''}${x.area?`<span class="dgu-wa">${esc(x.area)}</span>`:''}<b class="dgc-t">${x.t}</b></div>`;
  const why=x.d?`<div class="dgc-row"><span class="dgc-k">理由</span><p class="dgc-p">${x.d}</p></div>`:'';
  const how=x.how?`<div class="dgc-row dgc-how"><span class="dgc-k">改善する方法</span><p class="dgc-p">${x.how}</p></div>`:'';
  if(s===1)return `<div class="pc-i dgc dgc-s1"${id}>${head}${dguOpps(x.opps)}<details class="dgc-ev"><summary>理由・改善する方法・計算根拠を見る</summary>${why}${how}${swHTML||''}${chips||''}${x.ev&&x.ev.length?`<ul class="pc-ev">${x.ev.map(e=>`<li>${esc(e)}</li>`).join('')}</ul>`:''}</details></div>`;
  /* 入れかえ案（計算し直した数・育成・良くなる/悪くなる）は長いので、件数つきでたたむ */
  const swN=x.sw&&x.sw.length?x.sw.length:0,swBox=swN?`<details class="dgc-ev dgc-sw"><summary>計算し直した入れかえ案を見る（${swN}件）</summary>${swHTML}</details>`:'';
  return `<div class="pc-i dgc${s?' dgc-s'+s:' dgc-s0'}"${id}>${head}${dguOpps(x.opps)}${why}${how}${swBox}${chips||''}${dguEv(x)}</div>`;
}
/* ===================== 第3段階：相手ごとの対応力とダメージの表（2026/11/10） =====================
   1匹の対面＝結論（〇〇（こちら）は 上から一撃（確定））＋表：技・ダメージ・一撃で倒せる確率・確定何発・相手の技・素早さ・行動順・後出し。
   数はすべて dgMatch の結果そのまま（me・op・sa・so・spd・swIn）。一撃で倒せる確率＝乱数16段階のうち倒せる数（dgMove の ohko）。
   もとの理由の文（why・swTxt）は「計算根拠を見る」に全部残す */
const DGU_SW={win:'後出しして勝てる',sashwin:'条件つきで後出しできる（きあいのタスキ頼み）',sash:'後出しできない（タスキで1だけ残るだけ）',survive:'1発目は耐えるが、撃ち合いで負ける',no:'交代で受ける1発目で倒される'};
function dguKoPct(x){if(!x||!x.max)return '—';if(x.nMin===1)return '100%（確定）';if(x.nMax===1)return `${Math.round(x.ohko/16*100)}%`;return '0%（一撃では倒せない）'}
function dguMatchHTML(z,oppName,meName){
  const order=z.spd===1?(z.tr?'こちらが先（トリックルーム中）':'こちらが先'):z.spd===0?'同速（どちらが先かは五分）':(z.tr?'相手が先（トリックルーム中）':'相手が先');
  const rows=[
    ['技',z.me?esc(z.me.mvn):'効く技がない'],
    ['ダメージ',z.me?esc(dgDmgTxt(z.me,'op')):'—'],
    ['一撃で倒せる確率',z.me?dguKoPct(z.me):'—'],
    ['確定何発',z.me?esc(dgKoTxt(z.me)):'—'],
    ['相手の技',z.op?`${esc(z.op.mvn)}：${esc(dgDmgTxt(z.op,'me'))}（${esc(dgKoTxt(z.op))}）`:'こちらに効く技がない'],
    ['素早さ',`${esc(meName)} ${z.sa} 対 ${esc(oppName)} ${z.so}`],
    ['行動順',order],
    ['後出し',esc(DGU_SW[z.swIn]||'—')]];
  return `<div class="dgm"><p class="dgm-c"><b>${esc(meName)}</b>（こちら）は <span class="dg-k dg-k${z.r}">${esc(z.t)}</span></p>
    <dl class="dgm-t">${rows.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    <details class="dgc-ev"><summary>計算根拠を見る</summary><ul class="pc-ev">${z.why.map(w=>`<li>${esc(w)}</li>`).join('')}<li>${esc(z.spdTxt||'')}</li>${z.swTxt?`<li>後出し：${esc(z.swTxt)}</li>`:''}</ul></details></div>`;
}
/* ===================== 第7段階：関連画面（2026/11/10） =====================
   「変更前 → 変更後」の数の見せ方を、改善案のカード・パーティのチェックの入れかえ案・相性のいい仲間の入れかえ案でそろえる。
   b・a＝変更前・変更後の数（dgMetric と同じ形。持っている数だけ出す）。変わった数だけ行にし、良くなる／悪くなるの札を付ける。数は計算のまま */
function dguChgHTML(b,a,o={}){
  if(!b||!a)return '';
  const keys=(typeof IMP_MET!=='undefined'?IMP_MET:[]).filter(([k])=>b[k]!=null&&a[k]!=null);
  const ch=keys.filter(([k])=>b[k]!==a[k]),same=keys.filter(([k])=>b[k]===a[k]);
  const rows=ch.map(([k,lab,low])=>{const up=low?a[k]<b[k]:a[k]>b[k];
    return `<div class="imp-mr ${up?'up':'dn'}"><span class="imp-ml">${lab}</span><span class="imp-mv">${b[k]}<i>→</i><b>${a[k]}</b>匹</span><span class="imp-mt">${up?'良くなる':'悪くなる'}</span></div>`}).join('');
  return `<div class="imp-m${o.cls?' '+o.cls:''}"><p class="imp-mh">${esc(o.title||'変更前 → 変更後（計算し直した数）')}</p>${rows||'<p class="selu-none">数の変化はなし</p>'}${same.length&&o.same!==false?`<p class="imp-same">変わらない：${same.map(([k,lab])=>`${lab} ${b[k]}匹`).join('・')}</p>`:''}${o.note?`<p class="imp-same">${esc(o.note)}</p>`:''}</div>`;
}
