/* ===================== 戦術メモ（2026/11/06 依頼主の要望） =====================
   「このポケモン（このタイプ）が来たら、どうするか」を自分で書いておき、選出アシストの PiP で対戦中に見られるようにする。
   ・書き方は2つ：手で書く（マニュアル＝空の欄から自分で全部書く）／自動＋書き込み（ハイブリッド＝いまのパーティから計算したメモの下書きに、自分で書き足す）
   ・ポケモンごと（メガシンカの姿は元の姿にまとめる）とタイプごと
   ・保存：この端末（localStorage pcmemo）。ログイン中は /api/me/memo でどの端末でも同じに（1つずつ、新しく書いたほうを残す）
   ・PiP：「戦術メモ」のカード。相手の6匹のうち、メモ（ハイブリッドなら自動の下書きも）がある匹を1枚ずつ */
const MEMO_MAX=400;
const MEMO=(()=>{let m=null;try{m=JSON.parse(localStorage.getItem('pcmemo')||'null')}catch(e){}
  m=m&&typeof m==='object'?m:{};m.mon=m.mon||{};m.type=m.type||{};m.mode=m.mode==='manual'?'manual':'hybrid';return m})();
const memoSave=()=>{try{localStorage.setItem('pcmemo',JSON.stringify(MEMO))}catch(e){}memoSyncSoon()};
const memoKey=p=>p?(p.base&&byNo[p.base]?p.base:p.no):0;
const memoOf=p=>{const e=MEMO.mon[memoKey(p)];return e&&e.t?e.t:''};
const memoTypeOf=t=>{const e=MEMO.type[t];return e&&e.t?e.t:''};
/* 自動の下書き：いまのパーティ（なければ何も作らない）と、相手のよくある型での1対1 */
function memoAuto(q){
  if(!q||!team.length)return '';
  let op;try{op=mkMon(q,'op',q.base&&byNo[q.base]?{...detSet(byNo[q.base]),ab:q.ab,item:null}:detSet(q))}catch(e){return ''}
  const spd=b=>b.st[5]*(b.item==='choicescarf'?1.5:1);
  const rows=team.map(x=>{const p=byNo[x.no];if(!p)return null;try{const a=mkMon(p,'me',mySetFor(x.no)),h=estHit(a,op),r=estHit(op,a);
    const mt=h.pct>0?Math.ceil(100/h.pct):9,ot=r.pct>0?Math.ceil(100/r.pct):9,f=spd(a)>spd(op);
    return{p,h,r,f,sc:Math.max(-2,Math.min(2,(ot-mt)+(f?.5:-.5)))}}catch(e){return null}}).filter(Boolean);
  if(!rows.length)return '';
  const nm=p=>formInfo(p).base,mv=d=>d&&d.mv?d.mv.n:'';
  const L1=[];
  const good=rows.filter(r=>r.sc>=1).sort((a,b)=>b.sc-a.sc||b.h.pct-a.h.pct).slice(0,2);
  if(good.length)L1.push('◎出す：'+good.map(r=>`${nm(r.p)}（${r.f?'先に':'後から'}${mv(r.h)}で約${Math.round(r.h.pct)}%）`).join('、'));
  else L1.push('△1対1で有利な匹がいない。2匹で削るか、交代で受けてから倒す');
  const bad=rows.filter(r=>r.r.pct>=80||r.sc<=-1).sort((a,b)=>b.r.pct-a.r.pct).slice(0,2);
  if(bad.length)L1.push('×出さない：'+bad.map(r=>`${nm(r.p)}（${mv(r.r)}で約${Math.round(r.r.pct)}%）`).join('、'));
  const fast=rows.filter(r=>r.f).map(r=>nm(r.p));
  L1.push(`速さ：相手は最速${maxSpe(q)}。${fast.length?`上から動けるのは${fast.slice(0,3).join('・')}`:'こちらは全員が後から動く'}`);
  const d=typeof LIVE!=='undefined'&&LIVE.csv&&LIVE.csv[q.no];
  if(d&&d.it&&d.it.length){const it=d.it.slice(0,2).map(([n,pc])=>`${(typeof itemJa==='function'&&itemJa(nrm(n)))||n}${Math.round(pc)}%`).join('・');L1.push('よくある持ち物：'+it)}
  return L1.join('\n');
}
/* PiP・画面で見せる中身（モードに合わせる） */
function memoShown(q){
  const own=memoOf(q),types=q.t.map(t=>[t,memoTypeOf(t)]).filter(x=>x[1]);
  const auto=!own&&MEMO.mode==='hybrid'?memoAuto(q):'';
  return{own,auto,types};
}
/* ---- サーバーと合わせる（ログイン中だけ） ---- */
let MEMO_T=null;
function memoSyncSoon(){if(typeof AUTH==='undefined'||!AUTH.user)return;clearTimeout(MEMO_T);MEMO_T=setTimeout(memoPush,1500)}
async function memoPush(){try{await authFetch('/api/me/memo',{memo:{mon:MEMO.mon,type:MEMO.type}})}catch(e){}}
async function memoPull(){
  if(typeof AUTH==='undefined'||!AUTH.user)return;
  let j;try{j=await authFetch('/api/me/memo')}catch(e){return}
  const s=j&&j.memo;if(!s)return memoPush();
  let ch=false;
  for(const k of ['mon','type'])Object.entries(s[k]||{}).forEach(([id,e])=>{const l=MEMO[k][id];if(e&&(!l||(e.at||0)>(l.at||0))){MEMO[k][id]=e;ch=true}});
  try{localStorage.setItem('pcmemo',JSON.stringify(MEMO))}catch(e){}
  const send=['mon','type'].some(k=>Object.entries(MEMO[k]).some(([id,e])=>!s[k]||!s[k][id]||(e.at||0)>(s[k][id].at||0)));
  if(send)memoPush();
  if(ch&&typeof keyOf==='function'&&keyOf(cur)==='memo')memoView(cur.split('/').slice(2).join('/'));
}
/* ---- 画面：#/memo（一覧）・#/memo/番号（ポケモン）・#/memo/t/タイプ ---- */
function memoView(arg){
  arg=decodeURIComponent(arg||'');
  if(arg)return memoEdit(arg);
  setHeader('戦術メモ','#/tools');
  const mons=Object.entries(MEMO.mon).filter(([,e])=>e&&e.t).map(([no,e])=>({p:byNo[+no],e})).filter(x=>x.p).sort((a,b)=>(b.e.at||0)-(a.e.at||0));
  const tys=T.filter(t=>memoTypeOf(t));
  const opp=(typeof opp6!=='undefined'?opp6:[]).map(n=>byNo[n]).filter(Boolean);
  V.innerHTML=`<p class="note">「このポケモン・このタイプが来たら、どうするか」を書いておくと、選出アシストの <b>PiP</b>（ゲームの上に浮かぶ画面）で対戦中に見られます。</p>
  <div class="sec"><h2>書き方</h2></div>
  <div class="pills" style="padding:0 16px 6px" id="mm-mode"><button class="pill" data-mm="hybrid" aria-pressed="${MEMO.mode==='hybrid'}">自動＋書き込み</button><button class="pill" data-mm="manual" aria-pressed="${MEMO.mode==='manual'}">自分で全部書く</button></div>
  <p class="note" style="padding-top:0">${MEMO.mode==='hybrid'?'いまのパーティとの1対1の計算から、出す匹・出さない匹・素早さの下書きを作ります。下書きに自由に書き足せます（書いたメモがあれば、そちらを出します）。':'自動の下書きは作りません。自分で書いたメモだけを PiP に出します。'}</p>
  <button class="btn btn-p" id="mm-add" style="margin:8px 16px 0;width:calc(100% - 32px)">${SVG(I.search,17)}ポケモンのメモを書く</button>
  ${opp.length?`<div class="sec"><h2>いまの相手（選出アシスト）</h2></div>${opp.map(p=>{const s=memoShown(p);return `<a class="row" href="#/memo/${memoKey(p)}"><span class="av">${stamp(p)}</span><div class="row-m"><div class="row-t">${esc(formInfo(p).base)}</div><div class="row-s">${s.own?esc(s.own.split('\n')[0]):s.auto?'自動の下書きあり（押して書き足す）':'メモなし（押して書く）'}</div></div>${SVG(I.chev,18)}</a>`}).join('')}`:''}
  <div class="sec"><h2>ポケモンのメモ</h2><span style="font-size:12px;color:var(--dim)">${mons.length}匹</span></div>
  ${mons.length?mons.map(({p,e})=>`<a class="row" href="#/memo/${memoKey(p)}"><span class="av">${stamp(p)}</span><div class="row-m"><div class="row-t">${esc(formInfo(p).base)}</div><div class="row-s" data-notr>${esc(e.t.split('\n')[0])}</div></div>${SVG(I.chev,18)}</a>`).join(''):'<p class="note">まだありません。</p>'}
  <div class="sec"><h2>タイプのメモ</h2></div>
  <p class="note" style="padding-top:0">そのタイプのポケモンが来たときに、いつも出したいメモ（例：はがねが来たら、ほのおの技を持つ匹を残す）。</p>
  <div class="as-tyg" style="padding:0 16px">${T.map(t=>`<a class="as-tyb" href="#/memo/t/${encodeURIComponent(t)}" style="--tc:${COL[t]};display:grid;place-items:center;text-decoration:none;${memoTypeOf(t)?'opacity:1;box-shadow:0 0 0 2px var(--fg)':''}">${t}</a>`).join('')}</div>
  ${tys.length?tys.map(t=>`<a class="row" href="#/memo/t/${encodeURIComponent(t)}"><div class="row-m"><div class="row-t">${chip(t)}</div><div class="row-s" data-notr>${esc(memoTypeOf(t).split('\n')[0])}</div></div>${SVG(I.chev,18)}</a>`).join(''):''}
  <a class="row" href="#/assist" style="margin-top:16px"><div class="row-m"><div class="row-t">選出アシストの PiP で見る</div><div class="row-s">PiP の「表示するカード」で「戦術メモ」を選びます</div></div>${SVG(I.chev,18)}</a>`;
  V.querySelectorAll('[data-mm]').forEach(b=>b.onclick=()=>{MEMO.mode=b.dataset.mm;memoSave();memoView('')});
  document.getElementById('mm-add').onclick=async()=>{const no=await pickMon(0);if(no)nav('#/memo/'+memoKey(byNo[no]))};
}
function memoEdit(arg){
  const isT=arg.startsWith('t/'),ty=isT?arg.slice(2):null,p=isT?null:byNo[+arg];
  if(isT&&!T.includes(ty)||!isT&&!p){V.innerHTML='<p class="empty">見つかりません。</p>';return}
  setHeader(isT?`${ty}タイプのメモ`:`${formInfo(p).base}のメモ`,'#/memo');
  const box=isT?MEMO.type:MEMO.mon,key=isT?ty:memoKey(p),cur0=box[key]&&box[key].t||'';
  const auto=!isT&&MEMO.mode==='hybrid'?memoAuto(p):'';
  const start=cur0||(auto||'');
  V.innerHTML=`${isT?`<div style="padding:16px 16px 4px">${chip(ty)}</div>`:`<div class="row" style="pointer-events:none"><span class="av">${stamp(p)}</span><div class="row-m"><div class="row-t">${esc(formInfo(p).base)}</div><div class="row-s">${p.t.map(chip).join('')}　最速${maxSpe(p)}</div></div></div>`}
  ${!isT&&MEMO.mode==='hybrid'?(auto?`<p class="note">${cur0?'書いたメモを出しています。':'いまのパーティとの1対1の計算から作った<b>下書き</b>です。'}自由に書きかえてください。${cur0?'':'保存すると、あなたのメモになります。'}</p>`:'<p class="note">パーティを登録すると、自動の下書きが作られます。</p>'):''}
  <div class="cform" style="padding:8px 16px"><textarea id="mm-t" rows="8" maxlength="${MEMO_MAX}" placeholder="${isT?'例：はがねが来たら、ほのおの技を持つ匹を最後まで残す':'例：先発で来たらガブリアスで上から。スカーフの可能性があるので、HPが半分を切ったら交代'}" data-notr style="width:100%;font-size:16px;line-height:1.7">${esc(start)}</textarea>
  <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--dim);margin-top:4px"><span>PiP では上から8行ほどが見えます</span><span id="mm-n" class="num">${start.length}/${MEMO_MAX}</span></div></div>
  <div class="btns"><button class="btn btn-p" id="mm-save">保存する</button>${auto?'<button class="btn btn-s" id="mm-auto" style="flex:none;padding:0 16px">下書きに戻す</button>':''}${cur0?'<button class="btn btn-s" id="mm-del" style="flex:none;padding:0 16px">消す</button>':''}</div>`;
  const ta=document.getElementById('mm-t');ta.oninput=()=>{document.getElementById('mm-n').textContent=`${ta.value.length}/${MEMO_MAX}`};
  document.getElementById('mm-save').onclick=()=>{const v=ta.value.trim().slice(0,MEMO_MAX);
    if(v)box[key]={t:v,at:Date.now()};else box[key]={t:'',at:Date.now()};memoSave();toast('メモを保存しました');nav('#/memo')};
  const ra=document.getElementById('mm-auto');if(ra)ra.onclick=()=>{ta.value=auto;ta.oninput()};
  const dl=document.getElementById('mm-del');if(dl)dl.onclick=async()=>{if(!await askConfirm({title:'メモを消しますか？',text:'このメモを消します。',ok:'消す'}))return;box[key]={t:'',at:Date.now()};memoSave();toast('消しました');nav('#/memo')};
}
/* ---- PiP のカード ---- */
function memoPipPages(opp){
  return opp.map((p,j)=>{const s=memoShown(p);return(s.own||s.auto||s.types.length)?{kind:'memo',p,j,s}:null}).filter(Boolean);
}
function memoPipDraw(g,pg){
  const p=pg.p,s=pg.s;
  p.t.forEach((t,k)=>tIcon(g,t,28+k*58,30,52));
  g.fillStyle='#e7e9ea';fitTxt(g,formInfo(p).base,28+p.t.length*58+10,74,PIP_W-60-p.t.length*58,48,800);
  g.fillStyle='#ffd400';g.font=`800 24px ${FF}`;g.fillText(s.own?'戦術メモ':'戦術メモ（自動の下書き）',28,124);
  /* 折り返して書く */
  let y=150;const W=PIP_W-56,lh=36;
  const wrap=(txt,col,fs)=>{g.fillStyle=col;g.font=`700 ${fs}px ${FF}`;
    for(const para of String(txt).split('\n')){let line='';for(const ch of para){if(g.measureText(line+ch).width>W){if(y>PIP_H-70)return;g.fillText(line,28,y+fs);y+=lh;line=ch}else line+=ch}
      if(y>PIP_H-70)return;g.fillText(line,28,y+fs);y+=lh}};
  wrap(s.own||s.auto,'#e7e9ea',27);
  s.types.forEach(([t,m])=>{if(y>PIP_H-110)return;y+=10;tIcon(g,t,28,y,30);g.fillStyle='#8b98a5';g.font=`800 22px ${FF}`;g.fillText(`${t}タイプのメモ`,68,y+23);y+=40;wrap(m,'#c4c9cc',24)});
}
