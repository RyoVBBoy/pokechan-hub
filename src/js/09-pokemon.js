/* ===================== ポケモン詳細 ===================== */
let st={sp:[0,0,0,0,0,0],up:-1,dn:-1},curNo=null;
function detail(no){
  /* 「〇〇の対策を見る」（2026/11/10 依頼主：サイトの外の対策ページから戻れない）：#/p/番号/break なら図鑑の「対策」タブで開く。左上の←で前の画面に戻れる */
  if(/^#\/p\/\d+\/break/.test(location.hash)&&typeof DP_KEEP_TAB!=='undefined')DP_KEEP_TAB=5;
  const p=byNo[no];
  if(!p){setHeader('ポケモン');V.innerHTML='<p class="empty">ポケモンが見つかりません。<br><a href="#/dex" style="color:var(--fg);text-decoration:underline">図鑑へ戻る</a></p>';return}
  setHeader(p.n,p.base?'#/p/'+p.base:'#/dex');
  if(typeof monRecentAdd==='function')monRecentAdd(p.no);
  /* 姿の切りかえ（元の姿とメガシンカの姿） */
  const fam=p.base?[byNo[p.base],...megasOf(p.base)]:megasOf(p.no).length?[p,...megasOf(p.no)]:[];
  curNo=+no;st={sp:[0,0,0,0,0,0],up:-1,dn:-1};
  const wash=p.t.length>1
    ?`linear-gradient(140deg,${COL[p.t[0]]}2e,${COL[p.t[1]]}24 60%,transparent)`
    :`linear-gradient(140deg,${COL[p.t[0]]}2e,transparent 70%)`;
  V.innerHTML=`
  <section class="phead dp-head"><span class="wash" style="background:${wash}"></span>
    <div style="position:relative;min-width:0">
      <span class="no">No.${String(p.dno).padStart(4,'0')}</span>
      <div class="ph-nm"><h2>${nm(p,{no:false,big:true})}</h2>${typeof favBtn==='function'?favBtn(p.no,{cls:'fav-big',size:24}):''}</div>
      <div class="chips" style="margin-top:9px">${p.t.map(chip).join('')}</div>
      ${zukanLink(p)}
    </div>
    <div class="slot" id="artslot">${artHTML(p)}</div>
  </section>
  ${fam.length?`<div class="pills fam-pills">${fam.map(q=>`<a class="pill" href="#/p/${q.no}" aria-pressed="${q.no===p.no}">${q.base?esc(formInfo(q).tag||'メガ'):'元の姿'}</a>`).join('')}</div>`:''}
  ${FORM_SWITCH[p.no]?`<div class="dp-fsw">${aegisSwitchHTML(p)}</div>`:''}
  <div class="prof dp-prof">
    <div><b>${p.bst}</b><span>合計種族値</span></div>
    <div><b>${maxSpe(p)}</b><span>最速の素早さ</span></div>
    <div><b>${weakCount(p)}</b><span>弱点のタイプ数</span></div>
  </div>
  <div class="seg dp-seg" id="seg">
    ${DP_TABS.map((l,i)=>`<button role="tab" aria-selected="${i===0}" data-i="${i}">${l}</button>`).join('')}
    <span class="seg-i" style="width:16.666%"></span>
  </div>

  <div class="tt-pages" id="dp-pages">
  <div data-sw data-panel="0" id="ovpanel"><p class="dgu-loading" style="padding:16px">${esc(p.n)}の概要をまとめています…</p></div>

  <div data-sw data-panel="1" hidden>
    <div class="dp-h"><h2>種族値</h2><p>このポケモンがもともと持っている能力の高さです（${esc(p.n)}の値）。</p></div>
    ${srcLine(['stats',p.no],'calc')}
    <div class="who"><div class="rtags">${p.roles.map(r=>`<span class="rtag">${r}</span>`).join('')}</div>
      <p>${describe(p)}</p></div>
    <p class="note" style="padding-top:4px;color:var(--mute)">種族値から機械的に判定した目安です。実際の役割は技・特性・持ち物で変わります。</p>
    <div class="radarbox">${stamp(p,true)}</div>
    <p class="note" style="text-align:center">六角形は上から右回りに HP・攻撃・防御・素早さ・特防・特攻。いちばん外側の線が種族値150です。</p>
    <div style="height:6px"></div>
    ${p.s.map((v,i)=>`<div class="stat"><em>${SN[i]}</em><b>${v}</b><div class="bar${i===p.mi?' top':''}"><i style="width:${Math.min(100,Math.round(v/200*100))}%"></i></div><small>${p.rank[i]}位</small></div>`).join('')}
    <p class="note">右端は、メガシンカの姿も入れた${RANKP.length}匹の中での順位です（種族値が同じ姿は1匹と数え、同じ値は同じ順位）。青い棒は<b>${SN[p.mi]}</b>（このポケモンの最も高い能力）。</p>
    ${megasOf(p.no).map(m=>`<a class="mega" href="#/p/${m.no}"><div class="mega-h">${nm(m,{no:false})}${m.t.map(chip).join('')}</div>
      <div class="mega-s">${m.s.map((v,i)=>`<span><em>${SN[i]}</em><b>${v}</b>${v!==p.s[i]?`<small class="${v>p.s[i]?'up':'dn'}">${v>p.s[i]?'+':''}${v-p.s[i]}</small>`:''}</span>`).join('')}</div>
      <div class="mega-f">特性 ${ABN[m.ab]||m.ab}${ABIMPL.has(m.ab)?'':'（計算では効果なし）'}　持ち物 ${ITEMN[m.stone]}　合計 ${m.bst}</div><div class="mega-go">この姿のページを見る ›</div></a>`).join('')}
    ${p.base?`<p class="note">${esc(byNo[p.base].n)}が${esc(ITEMN[p.stone]||'')}を持つと、バトル中にこの姿にメガシンカします。順位は、メガシンカの姿も入れた${RANKP.length}匹と比べたものです。</p>`:''}
    <div class="dp-h" id="dp-real"><h2>実数値（レベル50）</h2><p>実際の対戦での能力の値です。下で性格と能力ポイントを変えると、その場で計算し直します。</p>
      <p class="dp-cond">条件：<b>${esc(p.n)}</b>・レベル50・個体値31・性格と能力ポイントは下で選んだもの・持ち物と特性の効果は入れていない</p></div>
    ${srcLine('formula')}<div class="calc">
    <div class="spbar"><div><div style="font-size:12px;color:var(--dim)">能力ポイント 残り</div><span class="big" id="sp-left">66</span><span style="color:var(--mute);font-size:12px"> / 66</span></div>
      <button class="btn btn-s" style="flex:none;height:34px;padding:0 15px;font-size:12px" id="sp-reset">リセット</button></div>
    ${SN.map((n,i)=>`<div class="sprow"><em>${n}</em><input type="range" min="0" max="${SP_CAP}" value="0" id="sp${i}" aria-label="${n}に振る能力ポイント"><span class="v" id="spv${i}">0</span><span class="o" id="sto${i}">0</span></div>`).join('')}
    <div id="dp-nat" style="padding:4px 12px 8px">${natGrid(-1,-1,j=>`data-nat="${j}"`)}</div>
    <p class="note" id="spd-note"></p>
    <p class="note" style="color:var(--mute)">HP＝種族値＋ポイント＋75、ほかの能力＝（種族値＋ポイント＋20）×能力補正（HPには無し）。赤い印＝上がる能力で補正前の値が10で割り切れる、青い印＝下がる能力で補正前の値の一の位が1。個体値31・Lv50で計算しています。能力ポイントは全部で66・1つの能力に32までです（本編の努力値とは別のしくみ）。</p>
    <p class="note" style="color:var(--mute)">素早さの順位は、収録している${P.length}匹（メガシンカの姿は入れていない）のそれぞれの最速（素早さを上げる性格・ポイント32）の実数値と比べたものです。種族値・タイプは${esc(SRC.stats.date)}時点のデータです。</p>
  </div></div>

  <div data-sw data-panel="2" hidden>
    <div class="dp-h"><h2>受けるとき（防御の相性）</h2><p>${esc(p.n)}（${p.t.join('・')}）が相手の技を受けたときの倍率です。タイプだけで計算しています。</p></div>
    ${srcLine('typechart')}${mxBlocks(p.t)}
    ${defNotes(p).length?`<div class="bnote" style="margin:0 16px 12px">特性による違い：${esc(defNotes(p).join('。'))}。</div>`:''}
    <div id="dp-off"><p class="dgu-loading" style="padding:12px 16px">攻めるときの相性をまとめています…</p></div>
  </div>

  <div data-sw data-panel="3" hidden>
    <div id="dp-mvrec"></div>
    <div id="mvpanel"></div>
  </div>
  <div data-sw data-panel="4" hidden id="bdpanel"><p class="dgu-loading" style="padding:16px">型をまとめています…</p></div>
  <div data-sw data-panel="5" hidden>
    <div class="dp-h"><h2>${esc(p.n)}が相手にいるとき</h2><p>場面ごとに分けています：<b>上から一撃</b>＝先に動いて倒せる（味方が倒されたあとに出して倒す役にも）／<b>強く出られる</b>＝1対1で有利／<b>受けてから返せる</b>＝交代で受けられる／<b>出すと危ない</b>＝出さない方がよい相手。味方の補助（壁・まひ・いかく等）での対処は計算に入っていません。</p></div>
    <div id="brpanel"></div>
  </div>
  </div>
  ${battleFormHTML(p)}
  <div class="btns dp-acts" style="flex-wrap:wrap"><button class="btn btn-p" id="addbtn">パーティに追加</button><button class="btn btn-s" id="oppbtn">${SVG(I.zap,16)}相手として調べる</button><a class="btn btn-s" style="flex-basis:100%" href="#/tb/${byNo[p.base]?p.base:p.no}">${SVG(I.plus,16)}このポケモンから組む</a><a class="btn btn-s" style="flex-basis:100%" href="#/cmp/${p.no}">${SVG(I.cmp,16)}他のポケモンと比較</a><a class="btn btn-s" style="flex-basis:100%" href="#/contact" data-report>このページの間違いを報告</a></div>
  ${adSlot('記事下')}`;
  /* 姿の切りかえでグラフを滑らかに動かす・ギルガルドのバトルスイッチ（52-statmorph.js） */
  statFx(p);

  /* タブ（2026/11/15 依頼主：概要・能力・相性・技・特性・型・育成・対策の6つ） */
  const seg=document.getElementById('seg'),ind=seg.querySelector('.seg-i');
  /* 姿の切りかえ（52-statmorph.js の famSwap）では、開いていたタブのまま動かさずに出す */
  let dpI=DP_KEEP_TAB||0;
  const dpGo=(i,dir)=>seg.querySelector(`[data-i="${i}"]`).onclick(null,dir);
  /* 解説の部品（39-guide-mons.js の monGuide(p,{parts:true})）は、概要・相性・技・型のタブで共有する。集計が届いたら作り直す */
  let G=null;const getG=()=>{if(!G)try{G=monGuide(p,{parts:true})}catch(e){G=null}return G};
  const filled=new Set();
  const fillTab=i=>{if(filled.has(i))return;
    const g=getG();
    if(i===0){const el=document.getElementById('ovpanel');if(el){el.innerHTML=g?dpOverviewHTML(p,g):'<p class="empty">まとめられませんでした。</p>';el.querySelectorAll('[data-dpgo]').forEach(b=>b.onclick=()=>{dpGo(+b.dataset.dpgo);seg.scrollIntoView({block:'start'})})}}
    if(i===2){const el=document.getElementById('dp-off');if(el)el.innerHTML=g?dpOffenseHTML(p,g):''}
    if(i===3){const el=document.getElementById('dp-mvrec');if(el)el.innerHTML=g?dpMovesHTML(p,g):'';movesPanel(p)}
    if(i===4){const el=document.getElementById('bdpanel');if(el){el.innerHTML=g?dpBuildsHTML(p,g):'<p class="empty">型を作れませんでした。</p>';dpBuildsBind(el,p,g)}}
    if(i===5){const el=document.getElementById('brpanel');if(el&&!el.innerHTML)el.innerHTML=breakHTML(p)}
    filled.add(i)};
  seg.querySelectorAll('button').forEach(b=>b.onclick=(e,dir)=>{
    const i=+b.dataset.i,from=dpI;dpI=i;
    /* 2026/11/16 依頼主の報告（ガブリアス：姿を切りかえると概要から急に技・特性へ移る）：技・特性のタブを覚えておくのは、技のページから戻ったときのためだけ。ほかのタブを選んだら忘れる */
    if(i!==3)MVS.tab4=null;
    seg.querySelectorAll('button').forEach(x=>x.setAttribute('aria-selected',x===b));
    ind.style.transform=`translateX(${i*100}%)`;
    ind.style.transition='';
    V.querySelectorAll('[data-panel]').forEach(pn=>pn.hidden=+pn.dataset.panel!==i);
    if(i!==from)segSlideIn(V.querySelector(`[data-panel="${i}"]`),dir||(i>from?1:-1));
    fillTab(i);
  });
  /* ランクバトルの集計をまだ読んでいなければ読み、届いたら部品を作り直す（メガシンカの姿は元の姿の集計） */
  if(!p.base&&LIVE.csv[p.no]===undefined&&typeof liveInit==='function')liveInit().then(ok=>ok&&liveMon(p.no)).then(d=>{if(!d||!document.getElementById('ovpanel')||curNo!==p.no)return;
    G=null;[...filled].forEach(i=>{filled.delete(i);if(i===3){const el=document.getElementById('dp-mvrec');if(el)el.innerHTML=''}fillTab(i)})}).catch(()=>{});
  if(dpI){ind.style.transition='none';ind.style.transform=`translateX(${dpI*100}%)`;seg.querySelector(`[data-i="${dpI}"]`).onclick();DP_KEEP_TAB=0}
  else if(MVS.tab4===p.no){seg.querySelector('[data-i="3"]').click()}
  else setTimeout(()=>{if(curNo===p.no)fillTab(0)},0);
  segSwipe(document.getElementById('dp-pages'),{n:6,idx:()=>dpI,ind,go:dpGo});
  /* 計算 */
  SN.forEach((_,i)=>document.getElementById('sp'+i).oninput=e=>setSP(i,+e.target.value));
  document.getElementById('sp-reset').onclick=()=>{
    st={sp:[0,0,0,0,0,0],up:-1,dn:-1};
    SN.forEach((_,i)=>{const el=document.getElementById('sp'+i);el.value=0;el.style.setProperty('--p','0%')});
    natGridSync(document.getElementById('dp-nat'),-1,-1);updCalc()};
  document.querySelectorAll('#dp-nat [data-nat]').forEach(b=>b.onclick=()=>{const n=NATS[+b.dataset.nat];st.up=n[1];st.dn=n[2];natGridSync(document.getElementById('dp-nat'),n[1],n[2]);updCalc()});
  /* メガシンカの姿は、元の姿にメガストーンを持たせてパーティに入れる */
  document.getElementById('addbtn').onclick=()=>{if(!p.base){addTeam(p.no);return}
    addTeam(p.base);const x=team.find(t=>t.no===p.base);if(x&&p.stone){x.set={...(x.set||{}),it:{n:ITEMN[p.stone],k:p.stone}};saveTeam()}};
  document.getElementById('oppbtn').onclick=()=>openSheet({no:p.no});
  updCalc();
}
function setSP(i,v){
  const others=st.sp.reduce((a,b,j)=>j===i?a:a+b,0);
  v=Math.max(0,Math.min(v,SP_CAP,SP_TOTAL-others));
  st.sp[i]=v;const el=document.getElementById('sp'+i);el.value=v;
  el.style.setProperty('--p',(v/SP_CAP*100)+'%');updCalc();
}
function updCalc(){
  const p=byNo[curNo];if(!p||!document.getElementById('sp0'))return;
  const r=calcStats(p,st.sp,st.up,st.dn);
  r.forEach((v,i)=>{const e=document.getElementById('sto'+i),mk=natMark(p,st.sp,st.up,st.dn,i);e.textContent=v;e.style.color=mk?NAT_MARK_COL[mk]:'';e.dataset.mark=mk;document.getElementById('spv'+i).textContent=st.sp[i]});
  document.getElementById('sp-left').textContent=SP_TOTAL-st.sp.reduce((a,b)=>a+b,0);
  document.getElementById('spd-note').innerHTML=L(`いまの素早さ <b>${r[5]}</b> は、`,`Current Speed <b>${r[5]}</b>: `)+spdRankHTML(r[5],p.no);
}

