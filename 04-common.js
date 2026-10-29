/* ===================== 共通パーツ ===================== */
const AXO=[0,1,2,5,4,3];
const polar=(k,r)=>{const a=-Math.PI/2+k*Math.PI/3;return[Math.cos(a)*r,Math.sin(a)*r]};
let _u=0;
function stamp(p,full){
  const R=full?80:39,ref=150,id='rg'+(++_u);
  const f=n=>n.toFixed(1);
  const hex=m=>AXO.map((_,k)=>polar(k,R*m).map(f).join(',')).join(' ');
  const pts=AXO.map((si,k)=>polar(k,R*Math.min(1,Math.max(.07,p.s[si]/ref))).map(f).join(',')).join(' ');
  const c1=TXT[p.t[0]],c2=TXT[p.t[1]||p.t[0]];
  const defs=`<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>`;
  const poly=`<polygon points="${pts}" fill="url(#${id})" fill-opacity="${full?.5:.8}" stroke="url(#${id})" stroke-width="${full?2:2.2}" stroke-linejoin="round"/>`;
  if(!full)return `<svg viewBox="-50 -50 100 100" role="img" aria-label="${p.n}の種族値の形">${defs}<circle r="48" class="rg-bg"/><polygon class="rg-ring" points="${hex(1)}"/>${poly}</svg>`;
  const rings=[1/3,2/3,1].map(m=>`<polygon class="rg-ring" points="${hex(m)}"/>`).join('');
  const spokes=AXO.map((_,k)=>{const[x,y]=polar(k,R);return `<line class="rg-spoke" x1="0" y1="0" x2="${f(x)}" y2="${f(y)}"/>`}).join('');
  const labs=AXO.map((si,k)=>{const[x,y]=polar(k,R+15);const an=Math.abs(x)<1?'middle':x>0?'start':'end';const dy=k===0?-12:k===3?6:-2;
    return `<text class="rg-t" x="${f(x)}" y="${f(y+dy)}" text-anchor="${an}">${SN[si]}</text><text class="rg-v" x="${f(x)}" y="${f(y+dy+13)}" text-anchor="${an}">${p.s[si]}</text>`}).join('');
  return `<svg viewBox="-125 -122 250 244" role="img" aria-label="${p.n}の種族値レーダー">${defs}${rings}${spokes}${poly}${labs}</svg>`;
}
function artHTML(p){
  if(ART_URL)return `<img src="${ART_URL.replace('{no}',p.no)}" alt="${p.n}" onerror="this.style.display='none'">`;
  return stamp(p);
}
const chip=t=>`<span class="chip" style="background:${COL[t]}26;color:${TXT[t]};box-shadow:inset 0 0 0 1px ${COL[t]}55">${ticon(t,12,'ci')}${t}</span>`;
const tkb=(cols,opts={})=>`<div class="tkb tkb--${cols}" role="group">${T.map(t=>
  `<button class="tk" data-t="${t}" ${opts.pressed?`aria-pressed="${opts.pressed(t)}"`:''} aria-label="${t}" style="background:${COL[t]};color:${ONC[t]}">${ticon(t,cols===9?19:22)}<small>${t}</small></button>`).join('')}</div>`;
const LAB=[[4,'×4','大弱点','var(--w4)'],[2,'×2','弱点','var(--w2)'],[.5,'×½','半減','var(--r2)'],[.25,'×¼','4分の1','var(--r4)'],[0,'×0','無効','var(--r0)']];
const mxBlocks=types=>{const tb=defTable(types);return LAB.map(([v,m,l,c])=>{const g=tb.filter(x=>x[1]===v);
  return g.length?`<div class="mx"><h3 style="color:${c}"><span>${m}</span>${l}<span style="color:var(--mute);font-weight:600">${g.length}</span></h3><div class="chips" style="margin:0">${g.map(x=>chip(x[0])).join('')}</div></div>`:''}).join('')};
const rowP=(p,metric)=>{const v=metric==null?p.bst:p.s[metric],lb=metric==null?'合計':SN[metric];
  return `<a class="row" href="#/p/${p.no}"><span class="av">${stamp(p)}</span><div class="row-m"><div class="row-t">${p.n}<span class="no">#${String(p.dno).padStart(4,'0')}</span></div><div class="chips">${p.t.map(chip).join('')}<span class="rt">${p.roles.join('・')}</span></div></div><div class="row-n"><b>${v}</b><span>${lb}</span></div><span class="chev">${SVG(I.chev,18)}</span></a>`};
const counters=types=>P.filter(p=>p.t.some(t=>mult(t,types)>=2)).sort((a,b)=>b.bst-a.bst);
const adSlot=l=>`<div class="ad">広告枠（${l}）</div>`;

