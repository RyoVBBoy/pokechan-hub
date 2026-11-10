/* ===================== 第5段階：選出の比較（2026/11/10 依頼主「パーティ診断エンジン強化」） =====================
   シングル＝6匹から3匹（20通り）、ダブル＝6匹から4匹（15通り）を全部、60-diag.js の dgTeam（使用率の上位20匹との1対1の計算）で比べる。
   新しい計算は作らず、dgMatch の結果（r・swIn・spd・op.nMax）を組み合わせる。
   ・メガストーンを持つ匹は選出に1匹まで（1試合にメガシンカできるのは1匹なので）。軸は必ず入れる。
   ・パーティの天気：天気を作る匹を選ばない選出では、天気で得をする匹を天気なしで計算し直す（WX_OFF）。
   ・トリックルーム構築：張れる匹を選ぶ選出では、遅い匹はトリックルーム中の計算（resTR）を使う。
   ・ダブルも1対1で計算（範囲技・2匹同時の動き・味方のサポートは入れていない）。 */
let WX_OFF=false;
const SEL_LV={4:1,3:.7,2:.25,1:0};
const DG_SELC=new Map();
function dgSelect(entries){
  const n=entries.length,K=Math.min(PICK(),n);if(n<=K)return null;
  let T;try{T=dgTeam(entries,20)}catch(e){return null}
  const R=T.rows;if(!R.length)return null;
  const key=JSON.stringify([FMT,K,entries.map(x=>[x.no,x.set||0,!!x.axis,!!x.sel]),R.length,Object.keys(LIVE.csv).length]);
  if(DG_SELC.has(key))return DG_SELC.get(key);
  const nm=i=>formInfo(T.ms[i].p).base;
  const stone=i=>{const k=entries[i].set&&entries[i].set.it&&entries[i].set.it.k;return !!k&&isStone(k)};
  const ax=entries.findIndex(x=>x.axis);
  const w=r=>R.indexOf(r)<8?1.5:1,W=R.reduce((t,r)=>t+w(r),0);
  /* パーティの天気：天気を作る匹（名前で探す）と、天気の中で計算した匹 */
  let tw=null;try{tw=teamWx()}catch(e){}
  const wxBy=tw?T.ms.findIndex(o=>formInfo(o.p).base===tw.by):-1;
  const gain=tw?T.ms.map((_,i)=>i).filter(i=>i!==wxBy&&R.some(r=>(r.res.find(z=>z.i===i)||{}).wxTeam)):[];
  const noWx={},noWxTR={};
  if(gain.length){WX_OFF=true;try{gain.forEach(i=>{const a=T.M[i];if(!a)return;
    noWx[i]=R.map(r=>{try{return{i,...dgMatch(a,r.o)}}catch(e){return null}});
    if(T.tr&&T.tr.on){DG_TR=true;try{noWxTR[i]=R.map(r=>{try{return{i,...dgMatch(a,r.o)}}catch(e){return null}})}finally{DG_TR=false}}})}finally{WX_OFF=false}}
  const q4=Math.ceil(R.length*.25);
  const ev=c=>{
    const trUse=!!(T.tr&&T.tr.on&&T.tr.setters.some(s=>c.includes(s.i)));
    const wxOk=!tw||wxBy<0||c.includes(wxBy);
    const slowTR=i=>trUse&&T.tr.slow.includes(i);
    const get=(r,j,i)=>{if(!wxOk&&noWx[i])return (slowTR(i)&&noWxTR[i]?noWxTR[i]:noWx[i])[j];return (slowTR(i)&&r.resTR?r.resTR:r.res).find(x=>x.i===i)};
    let sc=0;const cnt={4:0,3:0,2:0,1:0},rows=[];
    R.forEach((r,j)=>{const zs=c.map(i=>get(r,j,i)).filter(Boolean);
      const st=zs.filter(z=>z.r>=4),ok=zs.filter(z=>z.r>=3),wk=zs.filter(z=>z.r===2);
      const lvl=st.length>=2?4:st.length===1?3:ok.length||wk.length?2:1;cnt[lvl]++;
      const sw=zs.some(z=>z.swIn==='win'),swc=!sw&&zs.some(z=>z.swIn==='sashwin'),fast=zs.some(z=>z.spd===1);
      const oh=zs.filter(z=>z.op&&z.op.nMax===1),danger=oh.length>=Math.ceil(c.length*2/3);
      sc+=w(r)*(SEL_LV[lvl]+.25*sw+.1*swc+.15*fast-.4*danger);
      rows.push({r,lvl,st,sw,swc,fast,oh,danger,zs})});
    /* 役わり：上から倒せる攻撃役・受けに回れる匹（dgAnalyze と同じ基準：上位の4分の1以上） */
    const zi=i=>rows.map((x,j)=>get(x.r,j,i)).filter(Boolean);
    const atk=c.filter(i=>zi(i).filter(z=>z.k==='ko_fast').length>=q4);
    const def=c.filter(i=>{const zz=zi(i);return zz.filter(z=>['switch','wall','tank'].includes(z.k)).length>=q4||zz.filter(z=>!z.op||z.op.fmax<50).length>=q4||zz.filter(z=>z.swIn==='win').length>=q4});
    /* 得意な相手がほとんど同じ2匹（役割の重なり） */
    const good=i=>new Set(rows.filter((x,j)=>{const z=get(x.r,j,i);return z&&z.r>=3}).map(x=>x.r.q.no));
    const over=[];for(let a=0;a<c.length;a++)for(let b=a+1;b<c.length;b++){const A=good(c[a]),B2=good(c[b]);if(A.size<3||B2.size<3)continue;const both=[...A].filter(x=>B2.has(x)).length;if(both/Math.min(A.size,B2.size)>=.85)over.push([c[a],c[b],both])}
    /* 選ばなかった匹に頼っている相手：パーティ全体では ◎○ なのに、この選出では △以下 */
    const lost=rows.filter(x=>x.r.lvl>=3&&x.lvl<=2).map(x=>({q:x.r.q,by:x.r.stable.filter(z=>!c.includes(z.i)).map(z=>z.i)}));
    /* 先発：上位の相手に有利（r>=3）な数が多く、先に一撃で倒される相手が少ない匹 */
    const leadSc=i=>rows.reduce((t,x,j)=>{const z=get(x.r,j,i);if(!z)return t;return t+w(x.r)*((z.r>=4?1:z.r>=3?.6:0)-(z.op&&z.op.nMax===1&&z.spd!==1?.5:0))},0);
    const leads=[...c].sort((a,b)=>leadSc(b)-leadSc(a));
    sc=sc/W-(atk.length?0:.08)-(def.length?0:.05)-.03*over.length;
    /* サポートとエース：場を作る技（登録した技）と、積み技（boost）の匹 */
    const setMv=i=>((entries[i].set&&entries[i].set.mv)||[]).map(m=>m&&MD[m.id]&&MD[m.id][3]).filter(Boolean);
    const SUP={trickroom:'トリックルーム',tailwind:'おいかぜ',reflect:'リフレクター',lightscreen:'ひかりのかべ',auroraveil:'オーロラベール',stealthrock:'ステルスロック',spikes:'まきびし'};
    const sup=c.map(i=>({i,k:setMv(i).filter(k=>SUP[k])})).filter(x=>x.k.length);
    const ace=c.filter(i=>T.M[i]&&T.M[i].boost);
    return{c,sc,cnt,rows,atk,def,over,lost,leads,leadSc:leads.map(leadSc),trUse,wxOk,sw:rows.filter(x=>x.sw).length,swc:rows.filter(x=>x.swc).length,fast:rows.filter(x=>x.fast).length,danger:rows.filter(x=>x.danger),sup,ace};
  };
  const all=combos([...Array(n).keys()],K).filter(c=>c.filter(stone).length<=1&&(ax<0||c.includes(ax)));
  if(!all.length){DG_SELC.set(key,null);return null}
  const list=all.map(ev).sort((a,b)=>b.sc-a.sc);
  const sel=entries.map((x,i)=>x.sel?i:-1).filter(i=>i>=0);
  const mine=sel.length===K?list.find(x=>x.c.length===K&&x.c.every(i=>sel.includes(i))):null;
  const out={K,N:R.length,list,best:list[0],mine,mineRank:mine?list.indexOf(mine)+1:0,total:combos([...Array(n).keys()],K).length,excluded:combos([...Array(n).keys()],K).length-all.length,
    nm,tw,wxBy,gain,tr:T.tr,ax,T};
  DG_SELC.set(key,out);return out;
}
/* 1つの選出の説明（なぜよいか・気をつけること）。数はすべて上の計算から */
function dgSelWhy(S,x,ref){
  const nm=S.nm,L=l=>DG_LV[l][0],good=[],warn=[];
  good.push(`上位${S.N}匹のうち ${L(4)}${x.cnt[4]}・${L(3)}${x.cnt[3]}・${L(2)}${x.cnt[2]}・${L(1)}${x.cnt[1]}（◎＝選出の2匹以上が有利に戦える）`);
  if(ref&&ref!==x){const d4=x.cnt[4]+x.cnt[3]-(ref.cnt[4]+ref.cnt[3]);
    const better=x.rows.filter((y,j)=>y.lvl>ref.rows[j].lvl).map(y=>y.r.q.n),worse=x.rows.filter((y,j)=>y.lvl<ref.rows[j].lvl).map(y=>y.r.q.n);
    if(better.length||worse.length)good.push(`2番目の選出（${ref.c.map(nm).join('・')}）と比べて、良い相手：${better.slice(0,5).join('・')||'なし'}${better.length>5?` など${better.length}匹`:''}／悪い相手：${worse.slice(0,5).join('・')||'なし'}${worse.length>5?` など${worse.length}匹`:''}${d4?`（◎○の数 ${d4>0?'+':''}${d4}）`:''}`)}
  good.push(`先発の候補：${nm(x.leads[0])}（上位の相手に有利な数が多く、先に一撃で倒される相手が少ない）`);
  good.push(`後出しして勝てる匹がいる相手 ${x.sw}匹${x.swc?`（ほか、きあいのタスキ頼みの条件つき ${x.swc}匹）`:''}／先に動ける匹がいる相手 ${x.fast}匹`);
  if(x.atk.length)good.push(`上から倒せる攻撃役：${x.atk.map(nm).join('・')}`);else warn.push('上から倒せる攻撃役がいない（上位の4分の1以上を先に動いて倒しきれる匹がいない）');
  if(x.def.length)good.push(`受けに回れる匹：${x.def.map(nm).join('・')}`);else warn.push('受けに回れる匹がいない（受けて有利・安全に交代・後出しして勝てる、のどれも上位の4分の1未満）');
  if(x.sup.length)good.push(`場を作る技：${x.sup.map(s=>`${nm(s.i)}の${s.k.map(k=>({trickroom:'トリックルーム',tailwind:'おいかぜ',reflect:'リフレクター',lightscreen:'ひかりのかべ',auroraveil:'オーロラベール',stealthrock:'ステルスロック',spikes:'まきびし'})[k]).join('・')}`).join('／')}${x.ace.length?`。積み技で詰める匹：${x.ace.map(nm).join('・')}`:''}`);
  else if(x.ace.length)good.push(`積み技で詰める匹：${x.ace.map(nm).join('・')}`);
  if(x.danger.length)warn.push(`選出の${Math.ceil(x.c.length*2/3)}匹以上が一撃で倒される相手が${x.danger.length}匹：${x.danger.slice(0,5).map(y=>`${y.r.q.n}（${y.oh.map(z=>`${nm(z.i)}に${z.op.mvn} 最大${dgPct(z.op.fmax)}`).join('・')}）`).join('／')}${x.danger.length>5?` ほか${x.danger.length-5}匹`:''}`);
  const x1=x.rows.filter(y=>y.lvl===1);if(x1.length)warn.push(`この選出で答えがない相手（×）：${x1.map(y=>y.r.q.n).join('・')}`);
  if(x.lost.length)warn.push(`選ばなかった匹に頼っている相手（パーティ全体では◎○なのに、この選出では△以下）：${x.lost.slice(0,5).map(l=>`${l.q.n}${l.by.length?`（${l.by.map(nm).join('・')}が有利）`:''}`).join('・')}${x.lost.length>5?` ほか${x.lost.length-5}匹`:''}`);
  x.over.forEach(([a,b,k])=>warn.push(`${nm(a)}と${nm(b)}は得意な相手がほとんど同じ（${k}匹重なる）`));
  if(S.tw&&S.wxBy>=0&&S.gain.length&&!x.wxOk)warn.push(`${nm(S.wxBy)}を選ばないので天気にならず、${S.gain.map(nm).filter((v,i,a)=>a.indexOf(v)===i).join('・')}は天気なしで計算しています`);
  if(S.tr&&S.tr.on)(x.trUse?good:warn).push(x.trUse?`トリックルームを張れる匹がいるので、遅い匹はトリックルーム中の計算を使っています`:'トリックルームを張れる匹がいない選出です（遅い匹はトリックルームなしの計算）');
  return{good,warn};
}
function dgSelHTML(S,entries){
  if(!S||!S.best)return '';
  const nm=i=>esc(S.nm(i)),L=l=>DG_LV[l][0];
  const line=(x,k)=>`<div class="sel-c${k===0?' sel-best':''}"><span class="sel-rk">${k+1}</span><span class="sel-m">${x.c.map(i=>`${nm(i)}${i===x.leads[0]?'<small>先発</small>':''}`).join('・')}</span><span class="sel-n">${L(4)}${x.cnt[4]} ${L(3)}${x.cnt[3]} ${L(2)}${x.cnt[2]} ${L(1)}${x.cnt[1]}</span></div>`;
  const W=dgSelWhy(S,S.best,S.list[1]);
  const mine=S.mine&&S.mine!==S.best?dgSelWhy(S,S.mine,S.best):null;
  return `<div class="pc-i pc-plan sel-box"><b>選出の比較（${S.list.length}通りを計算）</b>
    <p>パーティの${entries.length}匹から${S.K}匹を選ぶ組み合わせを全部、使用率の上位${S.N}匹との1対1の計算（相手ごとの対応力と同じ計算）で比べました。${S.excluded?`メガストーンを持つ匹を2匹以上入れる${S.excluded}通りは、1試合にメガシンカできるのが1匹なので除いています。`:''}${S.ax>=0?`軸の${nm(S.ax)}は必ず入れています。`:''}</p>
    <h4>いちばん良い選出</h4>${line(S.best,0)}
    <ul class="sel-why">${W.good.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>
    ${W.warn.length?`<p class="sel-wh">気をつけること</p><ul class="sel-why sel-warn">${W.warn.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`:''}
    ${S.mine?`<h4>いま★を付けている選出</h4>${line(S.mine,S.mineRank-1)}<p class="vcap">${S.list.length}通りのうち${S.mineRank}番目${S.mine===S.best?'（いちばん良い選出です）':''}</p>${mine?`<ul class="sel-why">${mine.good.filter(t=>/2番目の選出/.test(t)).map(t=>`<li>${esc(t.replace('2番目の選出','いちばん良い選出'))}</li>`).join('')}${mine.warn.map(t=>`<li class="sel-w">${esc(t)}</li>`).join('')}</ul>`:''}`:''}
    <details class="sel-all"><summary>${S.list.length}通りすべてを見る</summary>${S.list.map((x,k)=>line(x,k)).join('')}
      <p class="vcap">並びは、上位の相手への対応（◎1・○0.7・△0.25・×0、上位8匹は1.5倍）＋後出し・先に動ける匹がいるか−選出の多くが一撃で倒される相手、から計算した点の順です。</p></details>
    <p class="vcap">計算の前提：${FMT==='double'?'ダブルも1対1で計算しています（範囲技・2匹同時の動き・味方のサポートは入れていません）。':''}${S.tw?`パーティの天気（${esc(S.tw.by)}の特性）は、その匹を選んだ選出でだけ入れています。`:''}${S.tr&&S.tr.on?'トリックルームは、張れる匹を選んだ選出でだけ、遅い匹に入れています。':''}相手の選出の読み合い・交代の順番は入れていません。</p>
  </div>`;
}
