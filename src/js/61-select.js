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
    const P={cov:0,sw:0,swc:0,fast:0,danger:0};const cnt={4:0,3:0,2:0,1:0},rows=[];
    R.forEach((r,j)=>{const zs=c.map(i=>get(r,j,i)).filter(Boolean);
      const st=zs.filter(z=>z.r>=4),ok=zs.filter(z=>z.r>=3),wk=zs.filter(z=>z.r===2);
      const lvl=st.length>=2?4:st.length===1?3:ok.length||wk.length?2:1;cnt[lvl]++;
      const sw=zs.some(z=>z.swIn==='win'),swc=!sw&&zs.some(z=>z.swIn==='sashwin'),fast=zs.some(z=>z.spd===1);
      const oh=zs.filter(z=>z.op&&z.op.nMax===1),danger=oh.length>=Math.ceil(c.length*2/3);
      P.cov+=w(r)*SEL_LV[lvl];P.sw+=w(r)*.25*sw;P.swc+=w(r)*.1*swc;P.fast+=w(r)*.15*fast;P.danger-=w(r)*.4*danger;
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
    /* 先発（2026/11/10 依頼主の確認）：相手の先発になりやすい上位の相手との対面で比べる。
       1匹の値＝有利（r>=4）1・やや有利（r=3）0.6・不安定（r=2）0.25、先に一撃で倒される（相手の乱数最大で1発・こちらが先に動けない）−0.5。上位8匹は1.5倍。
       シングル＝選出の3匹それぞれ、ダブル＝4匹から2匹の6通り（2匹のうち良い方の値、2匹とも先に倒されるなら−0.5、1匹なら−0.2） */
    const lv=z=>z?(z.r>=4?1:z.r>=3?.6:z.r===2?.25:0):0,die=z=>!!(z&&z.op&&z.op.nMax===1&&z.spd!==1);
    const lead1=c.map(i=>{const zz=rows.map((x,j)=>({x,z:get(x.r,j,i)}));
      return{i,sc:zz.reduce((t,{x,z})=>t+w(x.r)*(lv(z)-(die(z)?.5:0)),0)/W,adv:zz.filter(y=>y.z&&y.z.r>=4),ok:zz.filter(y=>y.z&&y.z.r===3),die:zz.filter(y=>die(y.z)),fast:zz.filter(y=>y.z&&y.z.spd===1).length}})
      .sort((a,b)=>b.sc-a.sc||b.adv.length-a.adv.length||a.die.length-b.die.length||a.i-b.i);
    const pairs=c.length===4?combos(c,2).map(pr=>{const back=c.filter(i=>!pr.includes(i));
      const rr=rows.map((x,j)=>{const z=pr.map(i=>get(x.r,j,i)),bz=back.map(i=>get(x.r,j,i));const v=Math.max(...z.map(lv)),d=z.filter(die).length;
        return{x,v,d,cover:v<.6&&bz.some(q=>q&&q.r>=4),best:z.map((q,k)=>({q,i:pr[k]})).sort((a,b)=>lv(b.q)-lv(a.q))[0]}});
      return{pr,back,sc:rr.reduce((t,y)=>t+w(y.x.r)*(y.v-(y.d===2?.5:y.d===1?.2:0)),0)/W,adv:rr.filter(y=>y.v>=1),both:rr.filter(y=>y.d===2),cover:rr.filter(y=>y.cover),rr}})
      .sort((a,b)=>b.sc-a.sc||b.adv.length-a.adv.length||a.both.length-b.both.length||(a.pr.join()<b.pr.join()?-1:1)):null;
    const leads=pairs?[...pairs[0].pr,...pairs[0].back]:lead1.map(l=>l.i);
    P.cov/=W;P.sw/=W;P.swc/=W;P.fast/=W;P.danger/=W;P.role=-(atk.length?0:.08)-(def.length?0:.05);P.over=-.03*over.length;
    const sc=P.cov+P.sw+P.swc+P.fast+P.danger+P.role+P.over;
    /* サポートとエース：場を作る技（登録した技）と、積み技（boost）の匹 */
    const setMv=i=>((entries[i].set&&entries[i].set.mv)||[]).map(m=>m&&MD[m.id]&&MD[m.id][3]).filter(Boolean);
    const SUP={trickroom:'トリックルーム',tailwind:'おいかぜ',reflect:'リフレクター',lightscreen:'ひかりのかべ',auroraveil:'オーロラベール',stealthrock:'ステルスロック',spikes:'まきびし'};
    const sup=c.map(i=>({i,k:setMv(i).filter(k=>SUP[k])})).filter(x=>x.k.length);
    const ace=c.filter(i=>T.M[i]&&T.M[i].boost);
    return{c,sc,P,cnt,rows,atk,def,over,lost,leads,lead1,pairs,trUse,wxOk,sw:rows.filter(x=>x.sw).length,swc:rows.filter(x=>x.swc).length,fast:rows.filter(x=>x.fast).length,danger:rows.filter(x=>x.danger),sup,ace};
  };
  const all=combos([...Array(n).keys()],K).filter(c=>c.filter(stone).length<=1&&(ax<0||c.includes(ax)));
  if(!all.length){DG_SELC.set(key,null);return null}
  /* 順位：点の高い順。点が同じ（差が0.001未満）なら ×が少ない→選出の多くが一撃で倒される相手が少ない→◎○が多い→後出しできる相手が多い→先に動ける相手が多い→パーティの並び順 */
  const tie=(a,b)=>a.cnt[1]-b.cnt[1]||a.danger.length-b.danger.length||(b.cnt[4]+b.cnt[3])-(a.cnt[4]+a.cnt[3])||b.sw-a.sw||b.fast-a.fast||(a.c.join()<b.c.join()?-1:1);
  const list=all.map(ev).sort((a,b)=>Math.abs(b.sc-a.sc)>=.001?b.sc-a.sc:tie(a,b));
  list.forEach((x,k)=>x.tie=k>0&&Math.abs(list[k-1].sc-x.sc)<.001);
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
  good.push(x.pairs?`先発の2匹の候補：${nm(x.pairs[0].pr[0])}・${nm(x.pairs[0].pr[1])}（4匹から2匹の6通りを1対1の計算で比べた簡易比較の1番。下の「先発の比較」）`:`先発：${nm(x.lead1[0].i)}（3匹それぞれを先発にした場合を比べた1番。下の「先発の比較」）`);
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
/* 1匹の対面を短く：「ガブリアス：上から一撃（確定）／じしん 107〜127%・素早さ 158 対 122」 */
function dgZTxt(S,z,opts){if(!z)return '';const nm=S.nm(z.i);
  return `${nm}：${z.t||DG_K[z.k].t||''}／${z.me?`${z.me.mvn} ${dgDmgTxt(z.me,'op')}`:'効く技なし'}・相手の${z.op?`${z.op.mvn} 最大${dgPct(z.op.fmax)}${z.op.half?`（こちらの${ABN[z.op.half]||'特性'}でHP満タンのとき。2発目から最大${dgPct(z.op.max)}）`:''}`:'効く技なし'}・素早さ ${z.sa} 対 ${z.so}${opts&&opts.sw?`・後出し：${{win:'勝てる',sashwin:'条件つき',sash:'タスキ頼みで不可',survive:'耐えるが撃ち合いで負ける',no:'1発目で倒される'}[z.swIn]}`:''}`}
/* 先発の比較：シングル＝3匹それぞれ、ダブル＝2匹の6通り。上位8匹（相手の先発になりやすい相手）との対面を根拠に出す */
function dgLeadHTML(S,x){
  const nm=i=>esc(S.nm(i)),top=y=>S.T.rows.indexOf(y.x?y.x.r:y.r)<8;
  if(x.pairs){
    const P0=x.pairs[0];
    return `<h4>先発の比較（選んだ4匹から先発2匹：6通り・簡易比較）</h4><p class="sel-lim">これは<b>簡易比較</b>です。ダブルの実際の対戦（相手2匹から同時に攻撃される・範囲技・味方のサポート・まもる・ねこだまし・このゆびとまれ・交代）は計算に入っていません。1対1の計算を組み合わせて候補を並べただけなので、点は勝率や実戦での強さではなく、1番が実戦でいつも最適な先発とは限りません。</p><p class="vcap">選出の4匹（上）とは別に、そのうち最初に出す2匹の組み合わせを比べています。上位${S.N}匹を相手の先発の候補として、相手1匹ずつに、2匹のどちらかが1対1で有利に戦えるか・どちらを狙われても先に一撃で倒されうるかを数えました（相手が2匹で同時に1匹を狙う場合は数えていません）。点＝相手ごとに2匹のうち良い方（有利1・やや有利0.6・不安定0.25）−どちらも先に一撃で倒されうる0.5（片方なら0.2）、上位8匹は1.5倍の平均。</p>
      ${x.pairs.map((p,k)=>`<div class="sel-c${k===0?' sel-best':''}"><span class="sel-rk">${k+1}</span><span class="sel-m">先発 ${nm(p.pr[0])}・${nm(p.pr[1])}<small>後ろ ${nm(p.back[0])}・${nm(p.back[1])}</small></span><span class="sel-n">点 ${p.sc.toFixed(2)}：どちらかが1対1で有利 ${p.adv.length}／どちらを狙われても先に一撃で倒されうる ${p.both.length}／後ろで補える ${p.cover.length}</span></div>`).join('')}
      <ul class="sel-why"><li>${esc(`1番の点が高い理由（上位8匹との1対1の計算。同時攻撃・範囲技は入っていない）：`)}${P0.rr.filter(top).map(y=>esc(`${y.x.r.q.n} → ${dgZTxt(S,y.best.q)}${y.d===2?'（どちらを狙われても先に一撃で倒されうる）':''}`)).join('<br>')}</li>
      ${P0.cover.length?`<li>${esc(`先発で不利でも、後ろの${S.nm(P0.back[0])}・${S.nm(P0.back[1])}が有利な相手：${P0.cover.map(y=>y.x.r.q.n).join('・')}`)}</li>`:''}</ul>`;
  }
  const L0=x.lead1[0];
  return `<h4>先発の比較（選んだ3匹それぞれ）</h4><p class="vcap">上位${S.N}匹を相手の先発の候補として、先発にしたときに有利に戦える数と、先に一撃で倒される数を比べています。点＝相手ごとに有利1・やや有利0.6・不安定0.25−先に一撃で倒される0.5、上位8匹は1.5倍の平均。同点なら有利が多い→先に倒される相手が少ない順。</p>
    ${x.lead1.map((l,k)=>`<div class="sel-c${k===0?' sel-best':''}"><span class="sel-rk">${k+1}</span><span class="sel-m">${nm(l.i)}</span><span class="sel-n">点 ${l.sc.toFixed(2)}：有利 ${l.adv.length}・やや有利 ${l.ok.length}／先に一撃で倒される ${l.die.length}／先に動ける ${l.fast}</span></div>`).join('')}
    <ul class="sel-why"><li>${esc(`${S.nm(L0.i)}を先発にする理由（上位8匹との対面）：`)}<br>${L0.adv.filter(top).slice(0,4).map(y=>esc(`有利：${y.x.r.q.n} → ${dgZTxt(S,y.z)}`)).join('<br>')}${L0.die.filter(top).length?'<br>'+L0.die.filter(top).slice(0,3).map(y=>esc(`気をつける：${y.x.r.q.n} → ${dgZTxt(S,y.z)}`)).join('<br>'):''}</li>
    ${x.lead1.slice(1).map(l=>`<li>${esc(`${S.nm(l.i)}を先発にすると：有利 ${l.adv.length}匹（${S.nm(L0.i)}は${L0.adv.length}匹）・先に一撃で倒される ${l.die.length}匹（${S.nm(L0.i)}は${L0.die.length}匹）${l.die.filter(top).length?`。例：${l.die.filter(top).slice(0,2).map(y=>`${y.x.r.q.n}の${y.z.op.mvn} 最大${dgPct(y.z.op.fmax)}（素早さ ${y.z.sa} 対 ${y.z.so}）`).join('・')}`:''}`)}</li>`).join('')}</ul>`;
}
/* 1位と2位の点の内訳と、相手ごとの違い（ダメージ・素早さ・後出しの根拠つき） */
function dgSelCmpHTML(S,a,b){
  if(!b)return '';const nm=S.nm,f=v=>(v>=0?'+':'')+v.toFixed(3);
  const K=[['cov','対応（◎1・○0.7・△0.25・×0、上位8匹は1.5倍）'],['sw','後出しして勝てる匹がいる（＋0.25）'],['swc','条件つきの後出しだけ（＋0.1）'],['fast','先に動ける匹がいる（＋0.15）'],['danger','選出の多くが一撃で倒される（−0.4）'],['role','攻撃役がいない−0.08・受けに回れる匹がいない−0.05'],['over','得意な相手がほとんど同じ2匹（1組−0.03）']];
  const diff=a.rows.map((y,j)=>({y,z:b.rows[j]})).filter(d=>d.y.lvl!==d.z.lvl||d.y.sw!==d.z.sw||d.y.danger!==d.z.danger);
  const bestZ=y=>[...y.zs].sort((p,q)=>q.r-p.r)[0];
  return `<details class="sel-all"><summary>1番と2番の点の内訳・相手ごとの違い</summary>
    <table class="sel-pt"><tr><th></th><th>1番</th><th>2番</th></tr>${K.map(([k,l])=>`<tr><td>${esc(l)}</td><td>${f(a.P[k])}</td><td>${f(b.P[k])}</td></tr>`).join('')}<tr><td><b>合計</b></td><td><b>${a.sc.toFixed(3)}</b></td><td><b>${b.sc.toFixed(3)}</b></td></tr></table>
    <p class="vcap">各項目は上位${S.N}匹の平均（上位8匹は1.5倍）。「選ばなかった匹に頼る相手」は、その相手への対応が△以下として「対応」の点に入っているので、別には引いていません（二重に数えないため）。点の差が0.001未満なら、×が少ない→選出の多くが一撃で倒される相手が少ない→◎○が多い→後出しできる相手が多い→先に動ける相手が多い、の順で決めます。${b.tie?'<b>1番と2番は同点で、この順で決めました。</b>':''}</p>
    ${diff.map(d=>`<div class="sel-d"><b>${esc(d.y.r.q.n)}</b>：1番 ${DG_LV[d.y.lvl][0]}${d.y.sw?'・後出し可':''}${d.y.danger?'・一撃の危険':''} ／ 2番 ${DG_LV[d.z.lvl][0]}${d.z.sw?'・後出し可':''}${d.z.danger?'・一撃の危険':''}
      <small>1番（${esc(a.c.map(nm).join('・'))}）：${d.y.zs.map(z=>esc(dgZTxt(S,z,{sw:1}))).join('<br>')}</small><small>2番（${esc(b.c.map(nm).join('・'))}）：${d.z.zs.map(z=>esc(dgZTxt(S,z,{sw:1}))).join('<br>')}</small></div>`).join('')}
  </details>`;
}
function dgSelHTML(S,entries){
  if(!S||!S.best)return '';
  const nm=i=>esc(S.nm(i)),L=l=>DG_LV[l][0];
  const lds=x=>x.pairs?x.pairs[0].pr:[x.lead1[0].i];
  const line=(x,k)=>`<div class="sel-c${k===0?' sel-best':''}"><span class="sel-rk">${k+1}</span><span class="sel-m">${x.c.map(i=>`${nm(i)}${lds(x).includes(i)?'<small>先発</small>':''}`).join('・')}</span><span class="sel-n">${L(4)}${x.cnt[4]} ${L(3)}${x.cnt[3]} ${L(2)}${x.cnt[2]} ${L(1)}${x.cnt[1]}</span></div>`;
  const W=dgSelWhy(S,S.best,S.list[1]);
  const mine=S.mine&&S.mine!==S.best?dgSelWhy(S,S.mine,S.best):null;
  return `<div class="pc-i pc-plan sel-box"><b>選出の比較（${S.K}匹の選び方 ${S.list.length}通りを計算${S.K===4?'。先発2匹は選んだ4匹ごとに6通り':''}）</b>
    <p>パーティの${entries.length}匹から${S.K}匹を選ぶ組み合わせを全部、使用率の上位${S.N}匹との1対1の計算（相手ごとの対応力と同じ計算）で比べました。${S.excluded?`メガストーンを持つ匹を2匹以上入れる${S.excluded}通りは、1試合にメガシンカできるのが1匹なので除いています。`:''}${S.ax>=0?`軸の${nm(S.ax)}は必ず入れています。`:''}</p>
    <h4>いちばん良い選出</h4>${line(S.best,0)}
    <ul class="sel-why">${W.good.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>
    ${W.warn.length?`<p class="sel-wh">気をつけること</p><ul class="sel-why sel-warn">${W.warn.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`:''}
    ${dgLeadHTML(S,S.best)}
    ${dgSelCmpHTML(S,S.best,S.list[1])}
    ${S.mine?`<h4>いま★を付けている選出</h4>${line(S.mine,S.mineRank-1)}<p class="vcap">${S.list.length}通りのうち${S.mineRank}番目${S.mine===S.best?'（いちばん良い選出です）':''}</p>${mine?`<ul class="sel-why">${mine.good.filter(t=>/2番目の選出/.test(t)).map(t=>`<li>${esc(t.replace('2番目の選出','いちばん良い選出'))}</li>`).join('')}${mine.warn.map(t=>`<li class="sel-w">${esc(t)}</li>`).join('')}</ul>`:''}`:''}
    <details class="sel-all"><summary>${S.list.length}通りすべてを見る</summary>${S.list.map((x,k)=>line(x,k)).join('')}
      <p class="vcap">並びは点の順です（点の決め方は「1番と2番の点の内訳」）。「先発」の印は、その選出の中で比べた先発です。</p></details>
    <p class="vcap">計算の前提：${FMT==='double'?'ダブルも1対1で計算しています（範囲技・2匹同時の動き・味方のサポートは入れていません）。':''}${S.tw?`パーティの天気（${esc(S.tw.by)}の特性）は、その匹を選んだ選出でだけ入れています。`:''}${S.tr&&S.tr.on?'トリックルームは、張れる匹を選んだ選出でだけ、遅い匹に入れています。':''}相手の選出の読み合い・交代の順番は入れていません。先発の比較は、使用率の上位を相手の先発の候補として数えています（相手が実際に何を先発にするかは分かりません）。</p>
  </div>`;
}
