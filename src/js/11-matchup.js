/* ===================== 相性ワンタップ ===================== */
const kata=q=>q.replace(/[ぁ-ゖ]/g,c=>String.fromCharCode(c.charCodeAt(0)+0x60));
const nmHit=(p,q)=>{q=q.trim();return p.n.includes(kata(q))||(p.ja&&p.ja.includes(kata(q)))||(LANG==='en'&&!!q&&p.n.toLowerCase().includes(q.toLowerCase()))};
I.cmp='<path d="M7 7h11m0 0-3-3m3 3-3 3M17 17H6m0 0 3-3m-3 3 3 3"/>';
const fmt=m=>m===.5?'½':m===.25?'¼':String(m);
const effLabel=m=>m>=4?'4倍ばつぐん':m>=2?'ばつぐん':m===1?'等倍':m===0?'こうかなし':m>=.5?'いまひとつ':'かなりいまひとつ';
const pts=m=>m>=4?2:m>=2?1:m===0?-2:m<1?-1:0;
const verd=d=>d>=2?['かなり有利','#4ec98a']:d===1?['有利','#4ec98a']:d===0?['五分','var(--dim)']:d===-1?['不利','var(--w2)']:['かなり不利','var(--w4)'];
const chipx=(t,v)=>`<span class="chip" style="background:${COL[t]}26;color:${TXT[t]};box-shadow:inset 0 0 0 1px ${COL[t]}55">${t} ×${fmt(v)}</span>`;
/* mon のタイプ一致技が相手 O に与える最大倍率(atk) と、O のタイプ一致技を mon が受ける最大倍率(def) */
function matchup(mon,O){
  const atk=Math.max(...mon.t.map(t=>mult(t,O)));
  const def=Math.max(...O.map(o=>mult(o,mon.t)));
  return{atk,def,diff:pts(atk)-pts(def)};
}
function activeTeam(){const sl=team.filter(x=>x.sel);return(sl.length?sl:team).map(x=>byNo[x.no]).filter(Boolean)}

let opp={no:null,types:[]},oppQ='';
const getRecent=()=>{try{return JSON.parse(localStorage.getItem('pcrecent')||'[]').filter(n=>byNo[n])}catch(e){return[]}};
function setOppMon(no){opp={no,types:[...byNo[no].t]};try{localStorage.setItem('pcrecent',JSON.stringify([no,...getRecent().filter(n=>n!==no)].slice(0,8)))}catch(e){}}
function setOppTypes(ts){opp={no:null,types:ts}}

function mrow(m,O){
  const r=matchup(m,O),v=verd(r.diff);
  return `<a class="row" href="#/p/${m.no}"><span class="av">${stamp(m)}</span><div class="row-m"><div class="row-t">${m.n}</div><div class="chips">${m.t.map(chip).join('')}</div><div class="mx2" style="margin-top:5px">攻め ×${fmt(r.atk)}　受け ×${fmt(r.def)}</div></div><span class="verd" style="color:${v[1]}">${v[0]}</span></a>`;
}

function oppResultHTML(){
  const O=opp.types;
  if(!O.length)return '<p class="empty" style="padding:34px 24px">相手のポケモン名を入力するか、タイプをタップしてください。<br>効く技のタイプと、出すといいポケモンがすぐ分かります。</p>';
  const mon=opp.no?byNo[opp.no]:null,tb=defTable(O);
  const strong=tb.filter(x=>x[1]>=2).sort((a,b)=>b[1]-a[1]);
  const poor=tb.filter(x=>x[1]>0&&x[1]<1).sort((a,b)=>a[1]-b[1]);
  const none=tb.filter(x=>x[1]===0);
  const clr='<button class="btn btn-s" data-clear style="flex:none;height:34px;padding:0 15px;font-size:12px;margin-left:auto">クリア</button>';
  const head=mon
    ?`<div class="opp"><span class="av">${stamp(mon)}</span><div style="min-width:0"><h3>${mon.n}</h3><div class="chips" style="margin-top:4px">${mon.t.map(chip).join('')}<span class="rt">${mon.roles.join('・')}</span></div><div class="sub" style="margin-top:4px">素早さ種族値 ${mon.s[5]}（最速 ${maxSpe(mon)}）</div></div>${clr}</div>`
    :`<div class="opp"><div><h3 style="font-size:16px">相手のタイプ</h3><div class="chips" style="margin-top:6px">${O.map(chip).join('')}</div></div>${clr}</div>`;
  const effs=strong.length
    ?`<div class="effs">${strong.map(([t,v])=>`<div class="eff${v>=4?' x4':''}" style="background:${COL[t]};color:${ONC[t]}"><i>${v>=4?'4倍':'2倍'}</i><b>${ticon(t,30)}</b><span>${t}</span></div>`).join('')}</div>`
    :'<p class="mx2" style="font-size:13px;font-weight:500;margin:0">ばつぐんを取れる技タイプはありません。</p>';
  const avoid=(poor.length||none.length)
    ?`<div style="margin-top:14px"><div class="mx2">効きにくい技タイプ（避けたい）</div><div class="chips" style="margin-top:6px">${none.map(([t])=>chipx(t,0)).join('')}${poor.map(([t,v])=>chipx(t,v)).join('')}</div></div>`:'';
  const tips=[];
  none.forEach(([t])=>tips.push(`<b>${t}</b>の技は<b>効きません</b>（こうかがない）。`));
  const x4=strong.filter(x=>x[1]>=4);
  if(x4.length)tips.push(`<b>${x4.map(x=>x[0]).join('・')}</b>の技は<b>4倍</b>です。2つのタイプの弱点が重なっています。`);
  if(!strong.length)tips.push('弱点がありません。いまひとつの技を避けて、等倍の技で押しましょう。');
  const q4=tb.filter(x=>x[1]>0&&x[1]<=.25);
  if(q4.length)tips.push(`<b>${q4.map(x=>x[0]).join('・')}</b>の技は<b>4分の1</b>まで下がります。`);
  if(O.length===2)tips.push('2タイプの相手は、それぞれの倍率を<b>かけ算</b>します（×2と×2で4倍、×2と×½で等倍）。');
  tips.push('「ばつぐん」かどうかは<b>技のタイプ</b>で決まります。ポケモン自身のタイプではありません。');
  const guard=O.map(o=>{
    const res=T.filter(d=>mult(o,[d])<1),weak=T.filter(d=>mult(o,[d])>=2);
    return `<div class="gline"><span>${chip(o)}<div class="mx2" style="margin-top:4px">の技を</div></span><div style="flex:1;min-width:0"><div class="mx2">半減・無効で受けられる</div><div class="chips" style="margin:4px 0 10px">${res.map(chip).join('')||'<span class="mx2">なし</span>'}</div><div class="mx2">ばつぐんを受ける</div><div class="chips" style="margin-top:4px">${weak.map(chip).join('')||'<span class="mx2">なし</span>'}</div></div></div>`}).join('');
  const tm=activeTeam();
  const teamHTML=tm.length
    ?`<div class="sec"><h2>あなたのパーティでは</h2><span style="font-size:11px;color:var(--mute)">強い順</span></div>`+[...tm].map(m=>({m,r:matchup(m,O)})).sort((a,b)=>b.r.diff-a.r.diff).map(x=>mrow(x.m,O)).join('')+`<p class="note">攻め＝こちらのタイプ一致技の最大倍率、受け＝相手のタイプ一致技を受ける倍率です。</p>`
    :`<div class="sec"><h2>あなたのパーティでは</h2></div><a class="row" href="#/team"><div class="row-m"><div class="row-t">パーティを登録する</div><div class="row-s">登録すると、この相手に誰を出せばいいかも分かります</div></div><span class="chev">${SVG(I.chev,18)}</span></a>`;
  const picks=P.filter(x=>x.no!==opp.no).map(x=>({x,r:matchup(x,O)})).sort((a,b)=>b.r.diff-a.r.diff||b.x.bst-a.x.bst).slice(0,8);
  return head
   +`<div class="ans"><h3>この技タイプで攻める<small>ばつぐん</small></h3>${effs}${avoid}</div>`
   +`<ul class="tips">${tips.map(t=>`<li><span>${t}</span></li>`).join('')}</ul>`
   +`<div class="ans" style="padding-top:20px"><h3>相手の技に注意<small>相手のタイプ一致技</small></h3><div class="guard">${guard}</div></div>`
   +teamHTML
   +`<div class="sec"><h2>この相手に出したいポケモン</h2><span style="font-size:11px;color:var(--mute)">全${P.length}匹から</span></div>`
   +picks.map(o=>mrow(o.x,O)).join('')
   +`<p class="note" style="padding-bottom:12px;color:var(--mute)">タイプ一致技だけで計算した目安です。技構成・特性・持ち物・素早さで結果は変わります。</p>`;
}

function matchMount(host,ctx){
  host.innerHTML=`<div class="mq">
    <div class="srch">${SVG(I.search,18)}<input data-q value="${oppQ}" placeholder="相手のポケモン名（ひらがなでもOK）" autocomplete="off" aria-label="相手のポケモン名"></div>
    <div data-sugg style="margin-top:6px"></div>
    <div class="recent" data-recent></div>
    <p class="cap2">または、相手のタイプをタップ（2つまで）</p>
    ${tkb(6,{pressed:()=>false})}
    <div data-res></div>
    ${ctx&&ctx.sheet?`<a class="row" href="#/types" data-mx style="margin-top:6px"><div class="row-m"><div class="row-t">相性の早見表を見る</div><div class="row-s">18タイプ×18タイプの一覧</div></div><span class="chev">${SVG(I.chev,18)}</span></a>`:''}
  </div>`;
  const root=host.firstElementChild;
  const q=root.querySelector('[data-q]'),sg=root.querySelector('[data-sugg]'),rc=root.querySelector('[data-recent]'),rs=root.querySelector('[data-res]');
  const draw=()=>{
    root.querySelectorAll('.tk').forEach(b=>{const on=opp.types.includes(b.dataset.t);b.setAttribute('aria-pressed',on);b.style.opacity=opp.types.length&&!on?'.4':'1'});
    const sq=oppQ.trim();
    const l=sq?P.filter(p=>nmHit(p,sq)).slice(0,6):[];
    sg.innerHTML=l.length?l.map(p=>`<button class="row" data-no="${p.no}" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line);text-align:left;color:inherit;font-family:inherit"><span class="av" style="width:40px;height:40px">${stamp(p)}</span><div class="row-m"><div class="row-t">${p.n}</div><div class="chips">${p.t.map(chip).join('')}</div></div></button>`).join(''):(sq?'<p class="empty" style="padding:18px">見つかりません。タイプを直接選んでください。</p>':'');
    const rl=getRecent();
    rc.innerHTML=!sq&&rl.length?`<h4>最近の相手</h4><div class="pills">${rl.map(n=>`<button class="pill" data-no="${n}" aria-pressed="${opp.no===n}">${byNo[n].n}</button>`).join('')}</div>`:'';
    rs.innerHTML=oppResultHTML();
  };
  q.oninput=e=>{oppQ=e.target.value;draw()};
  q.onkeydown=e=>{if(e.key==='Enter'){const f=P.find(p=>nmHit(p,oppQ));if(f){setOppMon(f.no);oppQ='';q.value='';draw()}}};
  root.addEventListener('click',e=>{
    const nb=e.target.closest('[data-no]');
    if(nb&&root.contains(nb)){setOppMon(+nb.dataset.no);oppQ='';q.value='';draw();return}
    const tk=e.target.closest('.tk');
    if(tk){const t=tk.dataset.t;const ts=opp.no?[]:[...opp.types];const i=ts.indexOf(t);
      if(i>=0)ts.splice(i,1);else{if(ts.length>=2)ts.shift();ts.push(t)}
      setOppTypes(ts);draw();return}
    if(e.target.closest('[data-clear]')){opp={no:null,types:[]};oppQ='';q.value='';draw();return}
    if(e.target.closest('[data-mx]'))typesTab='matrix';
  });
  draw();
}

/* ---- 早見表 ---- */
function matrixHTML(){
  const tile=t=>`<span style="background:${COL[t]};color:${ONC[t]}" title="${t}">${ticon(t,13)}</span>`;
  const head=`<tr><th></th>${T.map(d=>`<th data-c="${d}">${tile(d)}</th>`).join('')}</tr>`;
  const rows=T.map(a=>`<tr data-r="${a}"><th>${tile(a)}</th>${T.map(d=>{const m=mult(a,[d]);return `<td data-c="${d}" class="${m>=2?'x2':m===0?'x0':m<1?'xh':''}">${m>=2?'2':m===0?'0':m<1?'½':''}</td>`}).join('')}</tr>`).join('');
  return `<p class="note" style="padding-top:16px">縦が<b>攻撃する技のタイプ</b>、横が<b>受けるタイプ</b>です。<b style="color:var(--w2)">2</b>はばつぐん、<b style="color:var(--r2)">½</b>はいまひとつ、<b>0</b>は効果なし、空欄は等倍。セルや見出しをタップすると、意味が下に出ます。</p>
  <table class="mtx">${head}${rows}</table><p class="note" id="mxe" style="min-height:3.6em;color:var(--fg)">タイプやセルをタップしてください。</p>`;
}
function matrixBind(body){
  const t=body.querySelector('.mtx'),ex=body.querySelector('#mxe');let hr=null,hc=null;
  t.onclick=e=>{
    const c=e.target.closest('th,td');if(!c)return;
    const tr=c.parentElement;
    if(c.tagName==='TD'){hr=tr.dataset.r;hc=c.dataset.c}
    else if(c.dataset.c){hr=null;hc=c.dataset.c}
    else if(tr.dataset.r){hr=tr.dataset.r;hc=null}
    else return;
    t.querySelectorAll('.hl').forEach(x=>x.classList.remove('hl'));
    if(hr)t.querySelectorAll(`tr[data-r="${hr}"] td, tr[data-r="${hr}"] th`).forEach(x=>x.classList.add('hl'));
    if(hc)t.querySelectorAll(`[data-c="${hc}"]`).forEach(x=>x.classList.add('hl'));
    if(hr&&hc)ex.innerHTML=`<b>${hr}</b>の技 → <b>${hc}</b>タイプ：<b>${effLabel(mult(hr,[hc]))}</b>（×${fmt(mult(hr,[hc]))}）`;
    else if(hr)ex.innerHTML=`<b>${hr}</b>の技がばつぐん：${T.filter(d=>mult(hr,[d])>=2).join('・')||'なし'}<br>いまひとつ：${T.filter(d=>mult(hr,[d])>0&&mult(hr,[d])<1).join('・')||'なし'}　効果なし：${T.filter(d=>mult(hr,[d])===0).join('・')||'なし'}`;
    else ex.innerHTML=`<b>${hc}</b>タイプが受けて<b>ばつぐん</b>になる技：${T.filter(a=>mult(a,[hc])>=2).join('・')||'なし'}<br>いまひとつ：${T.filter(a=>mult(a,[hc])>0&&mult(a,[hc])<1).join('・')||'なし'}　効果なし：${T.filter(a=>mult(a,[hc])===0).join('・')||'なし'}`;
  };
}

/* ---- 相性ページ ---- */
let typesTab='lookup';
function typesView(){
  setHeader('タイプ相性','#/tools');
  V.innerHTML=`<div class="pills" id="tp2" style="padding-top:14px"><button class="pill" data-m="lookup">相手から調べる</button><button class="pill" data-m="matrix">早見表</button></div><div id="tbody"></div>`;
  const body=document.getElementById('tbody');
  const show=()=>{
    V.querySelectorAll('#tp2 .pill').forEach(b=>b.setAttribute('aria-pressed',b.dataset.m===typesTab));
    if(typesTab==='lookup')matchMount(body,{});
    else{body.innerHTML=matrixHTML();matrixBind(body)}
  };
  V.querySelectorAll('#tp2 .pill').forEach(b=>b.onclick=()=>{typesTab=b.dataset.m;show()});
  show();
}

/* ---- 全画面から開く相性シート ---- */
const sheet=document.getElementById('sheet'),sbody=document.getElementById('sheet-body');
let sheetOpen=false,lastFocus=null;
function openSheet(pre){
  if(pre&&pre.no)setOppMon(pre.no);else if(pre&&pre.types)setOppTypes(pre.types);
  oppQ='';lastFocus=document.activeElement;
  document.getElementById('sheet-t').textContent='相性を調べる';
  sheet.hidden=false;sheetOpen=true;document.body.style.overflow='hidden';
  matchMount(sbody,{sheet:true});
  sbody.scrollTop=0;
  const cb=sheet.querySelector('.ibtn');if(cb)cb.focus();
}
function closeSheet(anim){
  if(anim&&sheetOpen&&!reduceMotion){sheet.classList.add('closing');setTimeout(()=>{sheet.classList.remove('closing');closeSheet()},210);return}
  if(!sheetOpen)return;
  sheet.hidden=true;sheetOpen=false;document.body.style.overflow='';sbody.innerHTML='';
  if(lastFocus&&lastFocus.focus)lastFocus.focus();
}
sheet.addEventListener('click',e=>{if(e.target.closest('[data-close]'))closeSheet(true)});
addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet(true)});
/* 下にスワイプで閉じる */
(()=>{
  const hd=sheet.querySelector('.sheet-h'),pn=sheet.querySelector('.sheet-p');let y0=null,dy=0,t0=0;
  const down=e=>{if(e.target.closest('button'))return;y0=e.clientY;dy=0;t0=performance.now();pn.style.transition='none';hd.setPointerCapture&&hd.setPointerCapture(e.pointerId)};
  const move=e=>{if(y0==null)return;dy=Math.max(0,e.clientY-y0);pn.style.transform=`translateY(${dy}px)`};
  const up=()=>{if(y0==null)return;const v=dy/Math.max(1,performance.now()-t0);y0=null;
    pn.style.transition='transform .25s cubic-bezier(.2,.8,.2,1)';
    if(dy>110||v>.6){pn.style.transform='translateY(100%)';setTimeout(()=>{pn.style.transform='';pn.style.transition='';closeSheet()},230)}
    else{pn.style.transform='';setTimeout(()=>pn.style.transition='',260)}};
  hd.addEventListener('pointerdown',down);hd.addEventListener('pointermove',move);
  hd.addEventListener('pointerup',up);hd.addEventListener('pointercancel',up);
})();
document.getElementById('fab').onclick=()=>openSheet();

