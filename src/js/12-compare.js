/* ===================== ポケモン比較 ===================== */
let cmp={a:null,b:null},cmpQ='';
function radar2(A,B){
  const R=80,ref=150,f=n=>n.toFixed(1);
  const hex=m=>AXO.map((_,k)=>polar(k,R*m).map(f).join(',')).join(' ');
  const pts2=p=>AXO.map((si,k)=>polar(k,R*Math.min(1,Math.max(.07,p.s[si]/ref))).map(f).join(',')).join(' ');
  const rings=[1/3,2/3,1].map(m=>`<polygon class="rg-ring" points="${hex(m)}"/>`).join('');
  const spokes=AXO.map((_,k)=>{const[x,y]=polar(k,R);return `<line class="rg-spoke" x1="0" y1="0" x2="${f(x)}" y2="${f(y)}"/>`}).join('');
  const labs=AXO.map((si,k)=>{const[x,y]=polar(k,R+14);const an=Math.abs(x)<1?'middle':x>0?'start':'end';const dy=k===0?-3:k===3?11:4;
    return `<text class="rg-t" x="${f(x)}" y="${f(y+dy)}" text-anchor="${an}">${SN[si]}</text>`}).join('');
  return `<svg viewBox="-125 -112 250 232" role="img" aria-label="${A.n}と${B.n}の種族値レーダー">${rings}${spokes}<polygon points="${pts2(A)}" fill="#ffffff" fill-opacity=".14" stroke="#ffffff" stroke-width="2.2" stroke-linejoin="round"/><polygon points="${pts2(B)}" fill="#e8b33f" fill-opacity=".16" stroke="#e8b33f" stroke-width="2.2" stroke-linejoin="round"/>${labs}</svg>`;
}
function cmpOut(){
  const A=byNo[cmp.a],B=byNo[cmp.b];
  if(!A||!B)return '<p class="empty" style="padding:30px 24px">比べたい2匹を選んでください。</p>';
  const r=matchup(A,B.t),v=verd(r.diff);
  const rows=[...A.s.map((x,i)=>[SN[i],x,B.s[i],200]),['合計',A.bst,B.bst,700]];
  const side=(val,hi,sc,cls)=>`<div class="${cls}"><b class="${hi?'hi':''}">${val}</b><div class="bar"><i style="width:${Math.min(100,val/sc*100).toFixed(0)}%;background:${hi?'var(--fg)':'var(--line2)'}"></i></div></div>`;
  return `<div class="radarbox" style="padding-top:14px">${radar2(A,B)}</div>
  <div class="lg"><span><i style="background:#fff"></i>${A.n}</span><span><i style="background:var(--gold)"></i>${B.n}</span></div>
  <div style="height:4px"></div>
  ${rows.map(([n,a,b,sc])=>`<div class="cr">${side(a,a>b,sc,'l')}<em>${n}</em>${side(b,b>a,sc,'r')}</div>`).join('')}
  <div class="sec"><h2>タイプ相性</h2><span class="verd" style="color:${v[1]}">${A.n}から見て ${v[0]}</span></div>
  <div class="advs" style="border-top:1px solid var(--line)">
    <p><span>${A.n}のタイプ一致技 → ${B.n}：<b>${effLabel(r.atk)}</b>（×${fmt(r.atk)}）</span></p>
    <p><span>${B.n}のタイプ一致技 → ${A.n}：<b>${effLabel(r.def)}</b>（×${fmt(r.def)}）</span></p>
    <p><span>素早さ種族値：${A.n} ${A.s[5]}／${B.n} ${B.s[5]}。技構成・持ち物・性格で変わります。</span></p>
  </div>
  <div class="btns"><button class="btn btn-s" id="cshare">${SVG(I.share,17)}URLをコピー</button></div>`;
}
function cmpView(arg){
  setHeader('ポケモン比較','#/dex');
  if(arg){const ids=arg.split('-').map(Number).filter(n=>byNo[n]);cmp={a:ids[0]||null,b:ids[1]||null};cur='#/cmp';setUrl('#/cmp')}
  V.innerHTML=`<div id="cmproot"><p class="note" style="padding:16px 16px 0">2匹まで選んで、種族値とタイプ相性を並べて比べます。選んだ枠をタップすると外せます。</p>
  <div class="cmpslots" id="cs"></div>
  <div class="srch">${SVG(I.search,18)}<input id="cq" value="${cmpQ}" placeholder="ポケモン名で検索（ひらがなでもOK）" autocomplete="off" aria-label="比較するポケモンを検索"></div>
  <div id="csg" style="margin-top:6px"></div><div id="cout"></div></div>`;
  const root=document.getElementById('cmproot'),qi=document.getElementById('cq');
  const draw=()=>{
    document.getElementById('cs').innerHTML=[['a','A'],['b','B']].map(([k,l])=>{const p=byNo[cmp[k]];
      return p?`<button class="cslot ${k}" data-k="${k}" aria-label="${p.n}を外す"><span class="tag">${l}</span><div style="display:flex;gap:8px;align-items:center"><span class="av" style="width:38px;height:38px">${stamp(p)}</span><b style="font-size:15px">${p.n}</b></div><div class="chips" style="margin:0">${p.t.map(chip).join('')}</div></button>`
        :`<div class="cslot empty">${l}：未選択</div>`}).join('');
    const sq=cmpQ.trim();
    const l=sq?P.filter(p=>nmHit(p,sq)&&p.no!==cmp.a&&p.no!==cmp.b).slice(0,6):[];
    document.getElementById('csg').innerHTML=l.length?l.map(p=>`<button class="row" data-no="${p.no}" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line);text-align:left;color:inherit;font-family:inherit"><span class="av" style="width:40px;height:40px">${stamp(p)}</span><div class="row-m"><div class="row-t">${nm(p)}</div><div class="chips">${p.t.map(chip).join('')}</div></div></button>`).join(''):(sq?'<p class="empty" style="padding:16px">見つかりません。</p>':'');
    document.getElementById('cout').innerHTML=cmpOut();
  };
  qi.oninput=e=>{cmpQ=e.target.value;draw()};
  root.addEventListener('click',e=>{
    const nb=e.target.closest('[data-no]');
    if(nb){const n=+nb.dataset.no;if(!cmp.a)cmp.a=n;else if(!cmp.b)cmp.b=n;else cmp.b=n;cmpQ='';qi.value='';draw();return}
    const sl=e.target.closest('.cslot[data-k]');
    if(sl){cmp[sl.dataset.k]=null;draw();return}
    if(e.target.closest('#cshare')){
      const u=location.href.split('#')[0]+'#/cmp/'+cmp.a+'-'+cmp.b;
      (navigator.clipboard?navigator.clipboard.writeText(u):Promise.reject()).then(()=>toast('URLをコピーしました')).catch(()=>prompt('URLをコピーしてください',u));
    }
  });
  draw();
}

