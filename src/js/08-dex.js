/* ===================== 図鑑 ===================== */
let dq={q:'',type:'',sort:'no',role:''};
function dex(){
  setHeader('図鑑');
  V.innerHTML=`
  <div style="padding:14px 0 0">
    <div class="srch">${SVG(I.search,18)}<input id="dq" value="${dq.q}" placeholder="ポケモン名で検索" autocomplete="off" aria-label="ポケモン名で検索"></div>
    <div class="filt">
      <select class="sel" id="dt" aria-label="タイプで絞り込む"><option value="">すべてのタイプ</option>${T.map(t=>`<option ${dq.type===t?'selected':''}>${t}</option>`).join('')}</select>
      <select class="sel" id="ds" aria-label="並び替え"><option value="no">図鑑番号順</option><option value="bst">合計種族値順</option>${SN.map((n,i)=>`<option value="${i}">${n}が高い順</option>`).join('')}</select>
    </div>
  </div>
  <div class="pills" id="pills">${[['','すべて'],...RDESC.map(r=>[r[0],r[0]])].map(([r,l])=>`<button class="pill" data-r="${r}" aria-pressed="false">${l}</button>`).join('')}</div>
  <div id="dl"></div>`;
  document.getElementById('ds').value=dq.sort;
  const upd=()=>{
    const q=dq.q.trim();
    let l=P.filter(p=>(!q||nmHit(p,q))&&(!dq.type||p.t.includes(dq.type))&&(!dq.role||p.roles.includes(dq.role)));
    if(dq.sort==='bst')l=[...l].sort((a,b)=>b.bst-a.bst);
    else if(dq.sort!=='no')l=[...l].sort((a,b)=>b.s[dq.sort]-a.s[dq.sort]);
    const m=dq.sort==='no'||dq.sort==='bst'?null:+dq.sort;
    document.getElementById('dl').innerHTML=l.length
      ?`<p class="cnt">${l.length}匹</p>${srcLine('stats')}`+l.map(p=>rowP(p,m)).join('')
      :`<p class="empty">条件に合うポケモンがいません。<br>検索語や絞り込みを変えてください。</p>`;
  };
  document.getElementById('dq').oninput=e=>{dq.q=e.target.value;upd()};
  document.getElementById('dt').onchange=e=>{dq.type=e.target.value;upd()};
  document.getElementById('ds').onchange=e=>{dq.sort=e.target.value;upd()};
  const pl=document.getElementById('pills');
  const sync=()=>pl.querySelectorAll('.pill').forEach(b=>b.setAttribute('aria-pressed',(b.dataset.r||'')===(dq.role||'')));
  pl.querySelectorAll('.pill').forEach(b=>b.onclick=()=>{dq.role=b.dataset.r||'';sync();upd()});
  sync();
  upd();
}

