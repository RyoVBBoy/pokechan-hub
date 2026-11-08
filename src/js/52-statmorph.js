/* ===================== 種族値のグラフを滑らかに変える（2026/11/04 依頼主の要望） =====================
   ・同じポケモンの姿の切りかえ（元の姿⇔メガシンカ など、図鑑の上の切りかえ）では、前の姿のグラフ・数字・棒から新しい姿へ動かす
   ・ギルガルドは「バトルスイッチ」、イルカマンは「マイティチェンジ」のトグルスイッチで、戦闘中の姿に切りかえる
     （スイッチの地の色：シールドは青、ブレードは赤。つまみは白）
   ・動きは約0.6秒。グラフは少しだけ行き過ぎて戻る（はずむ）動き、数字と棒はなめらかに止まる動き。動きを減らす設定の端末では、すぐ切りかえる */
let DP_LAST=null,DP_KEEP_TAB=0;
const radarPts=(s,R=80)=>AXO.map((si,k)=>polar(k,R*Math.min(1,Math.max(.07,s[si]/150))).map(n=>n.toFixed(1)).join(',')).join(' ');
const easeOutBack=t=>{const c=1.25,d=t-1;return 1+(c+1)*d*d*d+c*d*d};
const easeOutQuart=t=>1-Math.pow(1-t,4);
/* その場の見た目を、種族値 s で描く（グラフ・グラフの数字・棒・順位） */
function statPaint(root,s,ss,rank,mi){
  /* 上の「合計種族値」「最速 素早さ」も数える */
  const pb=document.querySelectorAll('#view .prof b');if(pb[0])pb[0].textContent=Math.round(s.reduce((a,c)=>a+c,0));if(pb[1])pb[1].textContent=maxSpe({s:s.map(Math.round)});
  const poly=root.querySelector('.radarbox svg polygon[fill^="url"]');if(poly)poly.setAttribute('points',radarPts(ss||s));
  /* ページの上の小さな図形も同じ形に */
  const art=document.querySelector('#artslot svg polygon[fill^="url"]');if(art)art.setAttribute('points',radarPts(ss||s,39));
  root.querySelectorAll('.radarbox .rg-v').forEach((t,k)=>{t.textContent=Math.round(s[AXO[k]])});
  root.querySelectorAll('.stat').forEach((row,i)=>{if(i>5)return;const b=row.querySelector('b'),bar=row.querySelector('.bar'),w=row.querySelector('.bar i'),sm=row.querySelector('small');
    if(b)b.textContent=Math.round(s[i]);if(w)w.style.width=Math.min(100,s[i]/200*100)+'%';if(rank&&sm)sm.textContent=rank[i]+'位';if(mi!=null&&bar)bar.classList.toggle('top',i===mi)});
}
function statMorph(root,from,to,ms=620){
  const rank=rankOf(to),mi=to.indexOf(Math.max(...to));
  if(reduceMotion||!from){statPaint(root,to,null,rank,mi);return}
  const t0=performance.now(),id=(root._mv=(root._mv||0)+1);
  const step=now=>{if(root._mv!==id)return;const t=Math.min(1,(now-t0)/ms),a=easeOutQuart(t),g=easeOutBack(t);
    const s=from.map((v,i)=>v+(to[i]-v)*a),sg=from.map((v,i)=>Math.max(1,v+(to[i]-v)*g));
    statPaint(root,s,sg,t>=1?rank:null,t>=.5?mi:null);
    if(t<1)requestAnimationFrame(step);else statPaint(root,to,null,rank,mi)};
  requestAnimationFrame(step);
}
/* 戦闘中に変わる姿のトグルスイッチ（ギルガルドのバトルスイッチ・イルカマンのマイティチェンジ）。
   地の色：元の姿は青、変わった姿は赤。つまみは白 */
const FORM_SWITCH={
  681:{a:'シールドフォルム',b:'ブレードフォルム',s:[60,140,50,140,50,60],ab:'バトルスイッチ',
    note:'特性バトルスイッチ：攻撃技を使うとブレードフォルム、キングシールドでシールドフォルムに戻ります。'},
  964:{a:'ナイーブフォルム',b:'マイティフォルム',s:[100,160,97,106,87,100],ab:'マイティチェンジ',
    note:'特性マイティチェンジ：一度引っこめて出し直すとマイティフォルムになり、その対戦の終わりまで戻りません。当サイトのダメージ計算はマイティフォルムの能力で行います。'}};
const fsLabel=(f,on)=>`${f.ab}（${on?f.a+'にもどす':f.b+'にする'}）`;
const aegisSwitchHTML=p=>{const f=FORM_SWITCH[p.no];return f?`<div class="bsw"><span class="bsw-l" data-side="0">${f.a}</span>
  <button class="bsw-t" id="bsw" role="switch" aria-checked="false" aria-label="${fsLabel(f,false)}"><i></i></button>
  <span class="bsw-l" data-side="1">${f.b}</span></div><p class="note bsw-n" id="bsw-n">${f.note}</p>`:''};
function statFx(p){
  const root=document.querySelector('#dp-pages [data-panel="0"]');if(!root)return;
  const fam=p.base||p.no;
  /* 同じポケモンの別の姿から来たら、前の姿のグラフから動かす */
  if(DP_LAST&&DP_LAST.fam===fam&&DP_LAST.no!==p.no){statPaint(root,DP_LAST.s,null,null,null);statMorph(root,DP_LAST.s,p.s)}
  DP_LAST={fam,no:p.no,s:p.s.slice()};
  const sw=document.getElementById('bsw');if(!sw)return;
  sw.onclick=()=>{const on=sw.getAttribute('aria-checked')!=='true';sw.setAttribute('aria-checked',String(on));
    const f=FORM_SWITCH[p.no];sw.setAttribute('aria-label',fsLabel(f,on));
    document.querySelector('.bsw').classList.toggle('on',on);
    const from=DP_LAST&&DP_LAST.no===p.no?DP_LAST.s:p.s,to=on?f.s:p.s;
    statMorph(root,from,to);DP_LAST={fam,no:p.no,s:to.slice()};
    const zk=document.getElementById('zk-l');if(zk&&typeof zukanUrl==='function')zk.href=zukanUrl(p,on);
    if(typeof haptic==='function')haptic()};
}

/* 図鑑の「元の姿・メガ」の切りかえ：ページを移さず、その場で入れかえる（2026/11/04 依頼主の指摘：画面がぶれる）。
   画面のすべり込み・いちばん上へのスクロール・戻る履歴の追加をしない。開いているタブとスクロールの位置はそのまま。
   グラフ・数字・名前の横の図形は statFx が前の姿から動かし、名前とタイプは軽くふわっと入れかえる */
document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('.fam-pills a[href^="#/p/"]');if(!a||e.metaKey||e.ctrlKey)return;
  e.preventDefault();e.stopPropagation();const h=a.getAttribute('href');if(h===cur)return;
  const y=scrY(),sel=document.querySelector('#seg [aria-selected="true"]');DP_KEEP_TAB=sel?+sel.dataset.i:0;
  cur=h;setUrl(h,false);route();scrTo(0,y);
  if(!reduceMotion)V.querySelectorAll('.phead h2,.phead .chips,.phead .wash,.fam-pills').forEach(el=>el.animate([{opacity:.25,transform:'translateY(3px)'},{opacity:1,transform:'none'}],{duration:320,easing:'cubic-bezier(.2,.8,.2,1)'}));
},true);
