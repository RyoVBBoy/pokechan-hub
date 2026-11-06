/* ===================== 上位構築の考え方を取り入れる（2026/11/06 依頼主「最近の上位構築や大会優勝者の構築の考え方も取り入れる」） =====================
   データ：ツール「上位パーティ」に載っている最近のシーズンのパーティ（本人・運営者の登録と、複数の出典で一致した自動集計。事実だけ）。
   ほかのサイトの文章は使わない。どのポケモン・どの組み合わせ・どの型が上位で使われているかを数えて、計算に混ぜる。
   ・相手の候補（selPlan・負けやすい理由・強いポケモンランキング）：使用率の順に、上位構築で多いポケモンを足して並べかえる（metaOpps）
   ・相手の型（detSet）：ランクバトルの集計がないポケモンは、上位構築に登録された型をまとめたもの（topSetCalc）
   ・相性のいい仲間（prScore）：上位構築でよく一緒に入っている組み合わせ
   ・構築と選出のタブ：上位構築によくある組み合わせ（2匹・3匹）と、いまのパーティに入っているもの
   新しいシーズンほど重く、順位が高いほど重く数える。データがなければ何もしない（今までどおり）。 */
const TOPT={st:'idle',fmt:null,at:0,n:0,W:0,freq:{},pair:{},sets:{},core2:[],core3:[],kinds:{},season:null};
const topKey=no=>{const p=byNo[no];return p?(p.base&&byNo[p.base]?p.base:p.no):0};
const topReady=()=>TOPT.st==='ok'&&TOPT.n>=3&&TOPT.fmt===(typeof FMT!=='undefined'?FMT:'single');
async function topLoad(force){
  const fmt=typeof FMT!=='undefined'?FMT:'single';
  if(!force&&TOPT.fmt===fmt&&(TOPT.st==='ok'||TOPT.st==='busy')&&Date.now()-TOPT.at<6*3600e3)return TOPT;
  if(!force){try{const c=JSON.parse(localStorage.getItem('pctopt')||'null');if(c&&c.fmt===fmt&&Date.now()-c.at<6*3600e3&&Array.isArray(c.teams)){topBuild(c.teams,fmt,c.at,c.season);return TOPT}}catch(e){}}
  TOPT.st='busy';TOPT.fmt=fmt;
  try{
    const ss=((await authFetch('/api/seasons')).seasons||[]).filter(s=>s.n>0).slice(0,2);
    const teams=[];
    for(let i=0;i<ss.length;i++){let j;try{j=await authFetch(`/api/seasons/${ss[i].id}/teams?fmt=${fmt}`)}catch(e){continue}
      (j.teams||[]).forEach(t=>teams.push({r:t.rank||null,old:i,v:t.verified||t.auto?1:0,team:(t.team||[]).map(x=>({no:x.no,set:x.set||null})).filter(x=>byNo[x.no])}))}
    const at=Date.now(),season=ss[0]?ss[0].name:null;
    try{localStorage.setItem('pctopt',JSON.stringify({fmt,at,teams,season}))}catch(e){}
    topBuild(teams,fmt,at,season);
  }catch(e){TOPT.st='err';TOPT.at=Date.now()}
  return TOPT;
}
function topBuild(teams,fmt,at,season){
  const freq={},pair={},sets={},tri={},kinds={};let W=0;
  teams.filter(t=>t.team.length>=4).forEach(t=>{
    const w=(t.old?.6:1)*(t.r&&t.r<=100?1.5:t.r&&t.r<=1000?1.2:1)*(t.v?1.1:1);W+=w;
    const ks=[...new Set(t.team.map(x=>topKey(x.no)).filter(Boolean))];
    ks.forEach(k=>{freq[k]=(freq[k]||0)+w});
    for(let i=0;i<ks.length;i++)for(let j=i+1;j<ks.length;j++){const a=Math.min(ks[i],ks[j]),b=Math.max(ks[i],ks[j]),k=a+'-'+b;pair[k]=(pair[k]||0)+w;
      for(let l=j+1;l<ks.length;l++){const z=[ks[i],ks[j],ks[l]].sort((x,y)=>x-y).join('-');tri[z]=(tri[z]||0)+w}}
    t.team.forEach(x=>{if(x.set&&(x.set.mv||x.set.it)){const k=x.no;(sets[k]=sets[k]||[]).push({s:x.set,w})}});
    try{const tk=teamKind(t.team);if(tk&&tk.why&&tk.why.length){const nm=tk.name.replace(/（.*$/,'');kinds[nm]=(kinds[nm]||0)+w}}catch(e){}
  });
  Object.keys(freq).forEach(k=>freq[k]/=W||1);
  const top=(o,min)=>Object.entries(o).filter(([,v])=>v>=min).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({nos:k.split('-').map(Number),w:v,pc:Math.round(v/(W||1)*100)}));
  Object.assign(TOPT,{st:'ok',fmt,at,n:teams.filter(t=>t.team.length>=4).length,W,freq,pair,sets,kinds,season,SC:{},
    core2:top(pair,Math.max(2,W*.12)).slice(0,12),core3:top(tri,Math.max(2,W*.08)).slice(0,8)});
}
const topFreq=no=>topReady()?(TOPT.freq[topKey(no)]||0):0;
/* 2匹がいっしょに入っている割合と、たまたま以上か（持ち上げ＝lift） */
function topPair(a,b){if(!topReady())return null;const x=topKey(a),y=topKey(b);if(!x||!y||x===y)return null;
  const v=TOPT.pair[Math.min(x,y)+'-'+Math.max(x,y)]||0;if(!v)return null;
  const pc=v/TOPT.W,fx=TOPT.freq[x]||0,fy=TOPT.freq[y]||0;return{pc,lift:fx&&fy?pc/(fx*fy):0,n:v}}
/* 上位構築に登録された型をまとめる（持ち物・特性は多いもの、技は多い順に4つ、能力ポイントは同じものが多ければそれ） */
function topSetCalc(p){
  if(!topReady())return null;const no=p.no;
  if(TOPT.SC[no]!==undefined)return TOPT.SC[no];
  const L=TOPT.sets[no]||[];if(L.length<2){TOPT.SC[no]=null;return null}
  const cnt=(f)=>{const m=new Map();L.forEach(({s,w})=>{const v=f(s);if(v==null)return;(Array.isArray(v)?v:[v]).forEach(k=>m.set(k,(m.get(k)||0)+w))});return[...m.entries()].sort((a,b)=>b[1]-a[1])};
  const it=cnt(s=>s.it&&s.it.k||null)[0],ab=cnt(s=>s.ab&&s.ab.k||null)[0];
  const mv=cnt(s=>(s.mv||[]).map(m=>m&&m.id).filter(Boolean)).slice(0,4).map(([id])=>({id:+id}));
  const sp=cnt(s=>Array.isArray(s.sp)?JSON.stringify([s.sp,s.up??-1,s.dn??-1]):null)[0];
  const saved={mv,it:it?{k:it[0]}:null,ab:ab?{k:ab[0]}:null};
  if(sp){const [a,u,d]=JSON.parse(sp[0]);saved.sp=a;saved.up=u;saved.dn=d}
  let r=null;try{r=savedToCalc(no,saved)}catch(e){}
  /* 登録された技が4つに足りなければ、自動で決めた技で埋める */
  if(r&&r.moves.length<4){try{for(const m of chooseSet(p,true).moves){if(r.moves.length>=4)break;if(!r.moves.some(x=>x.id===m.id&&x.n===m.n))r.moves.push(m)}}catch(e){}}
  TOPT.SC[no]=r;return r;
}
/* 相手の候補：使用率（なければ合計種族値）の順に、上位構築で多いポケモンを足して並べかえる */
function metaOpps(n){
  const live=typeof META!=='undefined'&&META.rank&&META.rank.length>=20;
  const base=(live?META.rank.map(x=>byNo[x.no]):gmOpps()).filter(Boolean);
  if(!topReady())return base.slice(0,n);
  const L=base.length,sc=new Map();
  base.forEach((q,i)=>sc.set(q,(live?1:.5)*(1-i/L)));
  Object.entries(TOPT.freq).forEach(([k,f])=>{if(f<.06)return;const q=byNo[+k];if(!q)return;
    const hit=base.find(x=>(x.base||x.no)===q.no);const key=hit||q;sc.set(key,(sc.get(key)||0)+1.4*f)});
  return [...sc.entries()].sort((a,b)=>b[1]-a[1]).map(([q])=>q).slice(0,n);
}
/* 構築と選出のタブ：上位構築によくある組み合わせ */
function topCoresHTML(entries){
  if(!topReady())return '';
  const ks=new Set(entries.map(x=>topKey(x.no)));
  const nm=no=>esc(formInfo(byNo[no]).base);
  const row=c=>{const has=c.nos.filter(k=>ks.has(k)).length,all=has===c.nos.length;
    return `<div class="tc-r${all?' on':''}"><span class="tc-m">${c.nos.map(k=>`<span class="av" style="width:28px;height:28px">${stamp(byNo[k])}</span>`).join('')}</span><span class="tc-t">${c.nos.map(nm).join('＋')}</span><span class="tc-p num">${c.pc}%</span>${all?'<span class="tc-ok">入っている</span>':has?`<span class="tc-h">あと${c.nos.length-has}匹</span>`:''}</div>`};
  const cores=[...TOPT.core3.slice(0,4),...TOPT.core2.slice(0,6)];
  if(!cores.length)return '';
  const kinds=Object.entries(TOPT.kinds).sort((a,b)=>b[1]-a[1]),kt=kinds.reduce((a,b)=>a+b[1],0);
  return `<div class="sec"><h2>上位構築によくある組み合わせ</h2></div>
  <p class="note" style="padding-top:0">${esc(TOPT.season||'最近のシーズン')}などの上位パーティ${TOPT.n}件で、いっしょに入っていることが多い組み合わせです（％＝入っていたパーティの割合）。いっしょに使われるのには、弱点を受け合う・場を作って活かすなどの理由があります。</p>
  <div class="tc">${cores.map(row).join('')}</div>
  ${kt?`<p class="note">上位パーティの構築のタイプ：${kinds.slice(0,4).map(([k,v])=>`${esc(k)} ${Math.round(v/kt*100)}%`).join('・')}</p>`:''}`;
}
