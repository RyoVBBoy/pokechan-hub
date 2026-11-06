/* ===================== 強いポケモンランキング（2026/11/04、#/tier・検索向けの静的ページ ranking/） =====================
   当サイトの計算だけで作る（ほかのサイトの評価は使わない）：
   ・相手＝使用率の上位30匹（ランクバトルの集計 META.rank。読めなければ合計種族値の高い順 gmOpps）
   ・1匹ずつ、相手それぞれと「よくある型どうし」で1対1：お互いの最大ダメージから何回で倒せるか＋素早さ（selPlan と同じ考え方）
   ・強さ＝上位の相手への有利さ（使用率の高い相手ほど重く）×0.65 ＋ 使用率の順位×0.35（集計がないときは有利さだけ）
   ・S＝上位1割、A＝次の2割、B＝次の3割、C＝残り。理由＝使用率の順位・有利な相手の数と例・苦手な相手・素早さ
   ・計算は1日1回、形式ごとに端末に覚えておく（pctier） */
const TIER_N=30;
function tierCompute(){
  const live=typeof META!=='undefined'&&META.rank&&META.rank.length>=20;
  const pool=(live?META.rank.map(x=>byNo[x.no]):gmOpps()).filter(Boolean).slice(0,live?60:80);
  const opps=metaOpps(TIER_N),urank=new Map(live?META.rank.map(x=>[x.no,x.rank]):[]);
  const mk=(q,side)=>{try{return mkMon(q,side,q.base&&byNo[q.base]?{...detSet(byNo[q.base]),ab:q.ab,item:null}:detSet(q))}catch(e){return null}};
  const spd=m=>m.st[5]*(m.item==='choicescarf'?1.5:1);
  const O=opps.map(q=>mk(q,'op')),w=opps.map((_,j)=>1-j/(opps.length*1.6));
  const rows=pool.map(p=>{const me=mk(p,'me');if(!me)return null;
    let sum=0,ws=0;const good=[],bad=[];
    opps.forEach((q,j)=>{const o=O[j];if(!o||(q.base||q.no)===(p.base||p.no))return;
      const s=duelS(me,o);sum+=s*w[j];ws+=w[j];
      if(s>=1)good.push(q);else if(s<=-1)bad.push(q)});
    return{p,m:ws?sum/ws:0,good,bad,u:urank.get(p.no)||null,spe:Math.round(spd(me)),mega:me.p!==p?me.p:null}}).filter(Boolean);
  const ms=rows.map(r=>r.m),mn=Math.min(...ms),mx=Math.max(...ms);
  const umax=Math.max(1,...rows.map(r=>r.u||0));
  rows.forEach(r=>{const mN=mx>mn?(r.m-mn)/(mx-mn):.5,uN=r.u?1-(r.u-1)/umax:0;r.score=live?mN*.65+uN*.35:mN});
  rows.sort((a,b)=>b.score-a.score);
  const n=rows.length;rows.forEach((r,i)=>{const q=i/n;r.tier=q<.1?'S':q<.3?'A':q<.6?'B':'C'});
  const spdRank=[...rows].sort((a,b)=>b.spe-a.spe);rows.forEach(r=>{r.spdPos=spdRank.indexOf(r)+1});
  return{live,rows,n,opps:opps.length,at:Date.now(),fmt:typeof FMT!=='undefined'?FMT:'single'};
}
const tierName=q=>formInfo(q).base+(formInfo(q).tag?`（${formInfo(q).tag}）`:'');
function tierWhy(r,T){
  const out=[];
  if(r.u)out.push(`ランクバトルの使用率${r.u}位`);
  out.push(`${T.live?'使用率':'合計種族値'}の上位${T.opps}匹のうち、有利に戦える相手が${r.good.length}匹${r.good.length?`（${r.good.slice(0,3).map(tierName).join('・')}など）`:''}`);
  if(r.bad.length)out.push(`苦手な相手：${r.bad.slice(0,3).map(tierName).join('・')}`);
  out.push(`素早さはこの一覧の${r.spdPos}番目（${r.spe}）${r.mega?`。メガシンカ後（${tierName(r.mega)}）で計算`:''}`);
  return out;
}
function tierHTML(T,link){
  const L2=link||(q=>`#/p/${q.no}`);
  const head=`<p class="note" style="padding-top:12px">${T.live?`ランクバトルの使用率と、使用率の上位${T.opps}匹との1対1の計算（よくある型どうし・お互いの最大ダメージと素早さ）から、当サイトが並べた強さの目安です。`:`ランクバトルの集計が読めなかったため、合計種族値の高いポケモンどうしの1対1の計算だけで並べています。`}育成や組み合わせしだいで評価は変わります。</p>
    <p class="note" style="padding-top:0;color:var(--mute)">${new Date(T.at).toLocaleDateString('ja-JP')} 時点・${T.fmt==='double'?'ダブル':'シングル'}・${T.n}匹</p>`;
  const sec=t=>{const l=T.rows.filter(r=>r.tier===t);return l.length?`<div class="sec"><h2><span class="tr-t tr-${t}">${t}</span>${({S:'環境の中心',A:'とても強い',B:'活躍できる',C:'組み合わせしだい'})[t]}</h2><span style="font-size:12px;color:var(--dim)">${l.length}匹</span></div>
    ${l.map(r=>`<a class="row tr-r" href="${L2(r.p)}"><span class="av">${stamp(r.p)}</span><div class="row-m"><div class="row-t">${nm(r.p)}</div><div class="chips">${r.p.t.map(chip).join('')}</div>
      <ul class="tr-why">${tierWhy(r,T).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></a>`).join('')}`:''};
  return head+['S','A','B','C'].map(sec).join('');
}
async function tierView(){
  setHeader('強いポケモンランキング','#/tools');
  V.innerHTML='<p class="empty">ランクバトルの集計を読み込み中…</p>';
  try{await metaLoad()}catch(e){}
  if(keyOf(cur)!=='tier')return;
  const ck='pctier'+(typeof FMT!=='undefined'?FMT:'')+new Date().toISOString().slice(0,10);
  let T=null;try{const c=JSON.parse(localStorage.getItem(ck)||'null');if(c&&c.live===(typeof META!=='undefined'&&META.rank.length>=20)){
    c.rows.forEach(r=>{r.p=byNo[r.p];r.good=r.good.map(n=>byNo[n]).filter(Boolean);r.bad=r.bad.map(n=>byNo[n]).filter(Boolean);r.mega=r.mega?byNo[r.mega]:null});if(c.rows.every(r=>r.p))T=c}}catch(e){}
  if(!T){V.innerHTML='<p class="empty">強さを計算中…（数秒かかります）</p>';await new Promise(r=>setTimeout(r,30));if(keyOf(cur)!=='tier')return;
    T=tierCompute();
    try{localStorage.setItem(ck,JSON.stringify({...T,rows:T.rows.map(r=>({...r,p:r.p.no,good:r.good.map(q=>q.no),bad:r.bad.map(q=>q.no),mega:r.mega?r.mega.no:null}))}))}catch(e){}}
  V.innerHTML=tierHTML(T)+`<div class="btns"><a class="btn btn-s" href="#/meta">使用率と流行のパーティを見る</a><a class="btn btn-s" href="#/pair">相性のいい仲間を探す</a></div>`;
}
