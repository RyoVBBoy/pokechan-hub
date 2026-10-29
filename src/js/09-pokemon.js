/* ===================== ポケモン詳細 ===================== */
let st={sp:[0,0,0,0,0,0],up:-1,dn:-1},curNo=null;
function detail(no){
  const p=byNo[no];
  if(!p){setHeader('ポケモン');V.innerHTML='<p class="empty">ポケモンが見つかりません。<br><a href="#/dex" style="color:var(--fg);text-decoration:underline">図鑑へ戻る</a></p>';return}
  setHeader(p.n,'#/dex');
  curNo=+no;st={sp:[0,0,0,0,0,0],up:-1,dn:-1};
  const wash=p.t.length>1
    ?`linear-gradient(140deg,${COL[p.t[0]]}2e,${COL[p.t[1]]}24 60%,transparent)`
    :`linear-gradient(140deg,${COL[p.t[0]]}2e,transparent 70%)`;
  const cs=counters(p.t).filter(q=>q.no!==p.no).slice(0,12);
  const natSel=id=>`<select class="sel" id="${id}" aria-label="性格補正"><option value="-1">なし</option>${SN.slice(1).map((n,i)=>`<option value="${i+1}">${n}</option>`).join('')}</select>`;
  V.innerHTML=`
  <section class="phead"><span class="wash" style="background:${wash}"></span>
    <div style="position:relative;min-width:0">
      <span class="no">#${String(p.dno).padStart(4,'0')}</span>
      <h2>${nm(p,{no:false,big:true})}</h2>
      <div class="chips" style="margin-top:9px">${p.t.map(chip).join('')}</div>
    </div>
    <div class="slot" id="artslot">${artHTML(p)}</div>
  </section>
  <div class="prof">
    <div><b>${p.bst}</b><span>合計種族値</span></div>
    <div><b>${maxSpe(p)}</b><span>最速 素早さ</span></div>
    <div><b>${weakCount(p)}</b><span>弱点タイプ</span></div>
  </div>
  <div class="seg" id="seg">
    ${['種族値','解説','実数値','弱点','対策','技・特性'].map((l,i)=>`<button role="tab" aria-selected="${i===0}" data-i="${i}">${l}</button>`).join('')}
    <span class="seg-i" style="width:16.666%"></span>
  </div>

  <div data-panel="0">
    ${srcLine(['stats',p.no],'calc')}
    <div class="who"><div class="rtags">${p.roles.map(r=>`<span class="rtag">${r}</span>`).join('')}</div>
      <p>${describe(p)}</p></div>
    <p class="note" style="padding-top:4px;color:var(--mute)">種族値から機械的に判定した目安です。実際の役割は技・特性・持ち物で変わります。</p>
    <div class="radarbox">${stamp(p,true)}</div>
    <p class="note" style="text-align:center">六角形は上から右回りに HP・攻撃・防御・素早さ・特防・特攻。いちばん外側の線が種族値150です。</p>
    <div style="height:6px"></div>
    ${p.s.map((v,i)=>`<div class="stat"><em>${SN[i]}</em><b>${v}</b><div class="bar${i===p.mi?' top':''}"><i style="width:${Math.min(100,Math.round(v/200*100))}%"></i></div><small>${p.rank[i]}位</small></div>`).join('')}
    ${megasOf(p.no).map(m=>`<div class="mega"><div class="mega-h">${nm(m,{no:false})}${m.t.map(chip).join('')}</div>
      <div class="mega-s">${m.s.map((v,i)=>`<span><em>${SN[i]}</em><b>${v}</b>${v!==p.s[i]?`<small class="${v>p.s[i]?'up':'dn'}">${v>p.s[i]?'+':''}${v-p.s[i]}</small>`:''}</span>`).join('')}</div>
      <div class="mega-f">特性 ${ABN[m.ab]||m.ab}${ABIMPL.has(m.ab)?'':'（計算では効果なし）'}　持ち物 ${ITEMN[m.stone]}　合計 ${m.bst}</div></div>`).join('')}
    <p class="note">右端は収録${P.length}匹の中での順位です。金色の棒は<b>${SN[p.mi]}</b>（このポケモンの最も高い能力）。</p>
  </div>

  <div data-panel="1" hidden id="gmpanel"></div>

  <div data-panel="2" hidden>${srcLine('formula')}<div class="calc">
    <div class="spbar"><div><div style="font-size:12px;color:var(--dim)">能力ポイント 残り</div><span class="big" id="sp-left">66</span><span style="color:var(--mute);font-size:12px"> / 66</span></div>
      <button class="btn btn-s" style="flex:none;height:34px;padding:0 15px;font-size:12px" id="sp-reset">リセット</button></div>
    ${SN.map((n,i)=>`<div class="sprow"><em>${n}</em><input type="range" min="0" max="${SP_CAP}" value="0" id="sp${i}" aria-label="${n}に振る能力ポイント"><span class="v" id="spv${i}">0</span><span class="o" id="sto${i}">0</span></div>`).join('')}
    <div class="natr"><span>性格で上がる</span>${natSel('up')}</div>
    <div class="natr"><span>性格で下がる</span>${natSel('dn')}</div>
    <p class="note" id="spd-note"></p>
    <p class="note" style="color:var(--mute)">HP＝種族値＋ポイント＋75、ほかの能力＝（種族値＋ポイント＋20）×性格補正。個体値31・Lv50で計算しています。</p>
  </div></div>

  <div data-panel="3" hidden>${srcLine('typechart')}${mxBlocks(p.t)}
    <p class="note">相手のタイプ一致技を受けたときの倍率です。</p></div>

  <div data-panel="4" hidden>
    <p class="note" style="padding:14px 16px 6px">${p.n}に<b>タイプ一致で抜群</b>を取れるポケモンです（合計種族値の高い順・上位12匹）。</p>
    ${cs.map(q=>rowP(q)).join('')||'<p class="empty">該当するポケモンがいません。</p>'}</div>
  <div data-panel="5" hidden id="mvpanel"></div>

  <div class="btns" style="flex-wrap:wrap"><button class="btn btn-p" id="addbtn">パーティに追加</button><button class="btn btn-s" id="oppbtn">${SVG(I.zap,16)}相手として調べる</button><a class="btn btn-s" style="flex-basis:100%" href="#/cmp/${p.no}">${SVG(I.cmp,16)}他のポケモンと比較</a></div>
  ${adSlot('記事下')}`;

  /* タブ */
  const seg=document.getElementById('seg'),ind=seg.querySelector('.seg-i');
  seg.querySelectorAll('button').forEach(b=>b.onclick=()=>{
    const i=+b.dataset.i;
    seg.querySelectorAll('button').forEach(x=>x.setAttribute('aria-selected',x===b));
    ind.style.transform=`translateX(${i*100}%)`;
    V.querySelectorAll('[data-panel]').forEach(pn=>pn.hidden=+pn.dataset.panel!==i);
    if(i===5)movesPanel(p);
    if(i===1){const g=document.getElementById('gmpanel');if(g&&!g.innerHTML)g.innerHTML=monGuide(p)}
  });
  if(MVS.tab4===p.no){seg.querySelector('[data-i="5"]').click()}
  /* 計算 */
  SN.forEach((_,i)=>document.getElementById('sp'+i).oninput=e=>setSP(i,+e.target.value));
  document.getElementById('sp-reset').onclick=()=>{
    st={sp:[0,0,0,0,0,0],up:-1,dn:-1};
    SN.forEach((_,i)=>{const el=document.getElementById('sp'+i);el.value=0;el.style.setProperty('--p','0%')});
    document.getElementById('up').value=-1;document.getElementById('dn').value=-1;updCalc()};
  document.getElementById('up').onchange=e=>{st.up=+e.target.value;updCalc()};
  document.getElementById('dn').onchange=e=>{st.dn=+e.target.value;updCalc()};
  document.getElementById('addbtn').onclick=()=>addTeam(p.no);
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
  r.forEach((v,i)=>{document.getElementById('sto'+i).textContent=v;document.getElementById('spv'+i).textContent=st.sp[i]});
  document.getElementById('sp-left').textContent=SP_TOTAL-st.sp.reduce((a,b)=>a+b,0);
  document.getElementById('spd-note').innerHTML=L(`いまの素早さ <b>${r[5]}</b> は、`,`Current Speed <b>${r[5]}</b>: `)+spdRankHTML(r[5],p.no);
}

