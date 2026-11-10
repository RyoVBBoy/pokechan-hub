/* ===================== 図鑑 ===================== */
let dq={q:'',type:'',sort:'no',role:''};
/* 役割の札の説明（2026/11/10）：02-data.js の roles() の判定と同じ言葉（高速＝素早さ種族値が100以上）。RDESC の3つ目をそのまま使う */
const dxRoleDesc=r=>{const d=RDESC.find(x=>x[0]===r);return d?`${d[0]}（${d[2]}）`:''};
/* いまの条件（絞り込み→並び替えの順）を1行で。判定は upd() のまま、ここは見せるだけ */
const DX_SN_EN=['HP','Attack','Defense','Sp. Atk','Sp. Def','Speed'];
function dxCond(){const f=[];if(dq.q.trim())f.push(L(`名前「${dq.q.trim()}」`,`name "${dq.q.trim()}"`));if(dq.type)f.push(L(`タイプ：${dq.type}`,`type: ${typeof NAMES!=='undefined'&&NAMES.en&&NAMES.en.t&&NAMES.en.t[dq.type]||dq.type}`));
  if(dq.role){const d=RDESC.find(x=>x[0]===dq.role);f.push(L(dxRoleDesc(dq.role),dq.role==='高速'?'Fast (base Speed 100 or more)':(EN[`${d[0]}：${d[2]}`]||dq.role)))}
  const so=dq.sort==='no'?L('図鑑番号順','Pokédex order'):dq.sort==='bst'?L('合計種族値順','Base stat total'):L(`${SN[+dq.sort]}が高い順`,`${DX_SN_EN[+dq.sort]}, high to low`);
  return `<span class="dx-cond">${esc(f.length?L(`絞り込み：${f.join('・')}／並び替え：${so}（絞り込んだ中で並び替え）`,`Filter: ${f.join(', ')} / Sort: ${so} (within the filtered list)`):L(`並び替え：${so}`,`Sort: ${so}`))}</span>`}
function dex(){
  setHeader('図鑑');
  if(typeof toastDropOld==='function')toastDropOld();
  V.innerHTML=`
  <div style="padding:14px 0 0">
    <div class="srch">${SVG(I.search,18)}<input id="dq" value="${dq.q}" placeholder="ポケモン名で検索" autocomplete="off" aria-label="ポケモン名で検索"></div>
    <div class="filt dx-filt">
      <label class="dx-f"><span class="dx-cap">${L('絞り込み：タイプ','Filter: type')}</span><select class="sel" id="dt" aria-label="タイプで絞り込む"><option value="">すべてのタイプ</option>${T.map(t=>`<option ${dq.type===t?'selected':''}>${t}</option>`).join('')}</select></label>
      <label class="dx-f"><span class="dx-cap">${L('並び替え','Sort')}</span><select class="sel" id="ds" aria-label="並び替え"><option value="no">図鑑番号順</option><option value="bst">合計種族値順</option>${SN.map((n,i)=>`<option value="${i}">${n}が高い順</option>`).join('')}</select></label>
    </div>
  </div>
  <p class="dx-cap dx-cap-r">${L('絞り込み：役割（種族値で決まる札）','Filter: role (tags set from base stats)')}</p>
  <div class="pills" id="pills">${[['','すべて'],...RDESC.map(r=>[r[0],r[0]])].map(([r,l])=>`<button class="pill" data-r="${r}" aria-pressed="false"${r?` title="${esc(dxRoleDesc(r))}"`:''}>${l}</button>`).join('')}</div>
  <div id="dl"></div>`;
  document.getElementById('ds').value=dq.sort;
  const upd=()=>{
    const q=dq.q.trim();
    let l=P.filter(p=>(!q||nmHit(p,q))&&(!dq.type||p.t.includes(dq.type))&&(!dq.role||p.roles.includes(dq.role)));
    if(dq.sort==='bst')l=[...l].sort((a,b)=>b.bst-a.bst);
    else if(dq.sort!=='no')l=[...l].sort((a,b)=>b.s[dq.sort]-a.s[dq.sort]);
    const m=dq.sort==='no'||dq.sort==='bst'?null:+dq.sort;
    document.getElementById('dl').innerHTML=l.length
      ?`<div class="dx-meta"><p class="dx-cnt"><b>${l.length}匹</b>${dxCond()}</p><div class="dx-src"><span class="dx-src-k">${L('データの出典','Data source')}</span>${srcBadge('stats',null,{long:true})}<span class="dx-src-d">${esc(L(`${LV[lvOf('stats').lv][0]}＝${LV[lvOf('stats').lv][2]}。押すと出典の名前とくわしい説明が出ます。`,`${EN[LV[lvOf('stats').lv][0]]||LV[lvOf('stats').lv][0]} = ${EN[LV[lvOf('stats').lv][2]]||'how this data was checked'}. Tap for the source names and details.`))}</span></div></div>`+l.map(p=>rowP(p,m)).join('')
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

