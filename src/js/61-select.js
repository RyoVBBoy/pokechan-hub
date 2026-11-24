/* ===================== 第5段階：選出の比較（2026/11/10 依頼主「パーティ診断エンジン強化」） =====================
   シングル＝6匹から3匹（20通り）、ダブル＝6匹から4匹（15通り）を全部、60-diag.js の dgTeam（使用率の上位20匹との1対1の計算）で比べる。
   新しい計算は作らず、dgMatch の結果（r・swIn・spd・op.nMax）を組み合わせる。
   ・メガストーンを持つ匹が選出に2匹以上いてもよい。1試合にメガシンカできるのは1匹なので、選出ごとにその中の1匹ずつをメガシンカさせて計算し（ほかは持ち物なし）、いちばん良い場合をとる。軸は必ず入れる。
   ・パーティの天気：天気を作る匹を選ばない選出では、対面と相手の特性の推定を天気なしで計算し直す（WX_OFF）。
   ・トリックルーム構築：トリックルームを技に入れている匹を選ぶ選出では、選んだ全員をトリックルーム中の計算（resTR）にする。
   ・ダブルも1対1で計算（範囲技・2匹同時の動き・味方のサポートは入れていない）。 */
let WX_OFF=false;
const SEL_LV={4:1,3:.7,2:.25,1:0};
const DG_SELC=new Map();
function dgSelect(entries){return impWith(entries,()=>dgSelect0(entries))}
// 表示と同じ小数第3位で丸めた点を比較する。
const dgSelScore=x=>Number(x.sc.toFixed(3));
function dgSelOrder(a,b){
  return dgSelScore(b)-dgSelScore(a)||a.cnt[1]-b.cnt[1]||a.danger.length-b.danger.length||
    (b.cnt[4]+b.cnt[3])-(a.cnt[4]+a.cnt[3])||b.sw-a.sw||b.fast-a.fast||
    a.c.join().localeCompare(b.c.join())||(a.megaI??-1)-(b.megaI??-1);
}
function dgSelectionIssue(T,entries,K){
  if(T.ms.length!==entries.length)return '図鑑で確認できないポケモンがいます。パーティを見直してください。';
  const ax=entries.findIndex(x=>x.axis);
  if(ax>=0&&!T.M[ax]){
    const err=(T.formErr||[]).find(x=>x.side==='me'&&x.no===entries[ax].no);
    const why=err?FORM_WHY[err.why]:'';
    return `軸の${T.ms[ax].p.n}は計算できません。${why?why+'。':''}育成を修正するか、軸を選び直してください。`;
  }
  const available=T.M.filter(Boolean).length;
  return available<K?`計算できるポケモンは${available}匹です。選出に必要な${K}匹の育成を確認してください。`:'';
}
function dgSelect0(entries){
  const n=entries.length,K=Math.min(PICK(),n);if(n<=K)return null;
  let T;try{T=dgTeam(entries,20)}catch(e){return null}
  const R=T.rows;if(!R.length||dgSelectionIssue(T,entries,K))return null;
  const key=JSON.stringify([K,entries.map(x=>[x.no,x.set||0,!!x.axis,!!x.sel]),R.length,dgDataSig(),'mega-per-sel']);
  if(DG_SELC.has(key))return DG_SELC.get(key);
  const nm=i=>formInfo(T.ms[i].p).base;
  const ax=entries.findIndex(x=>x.axis);
  const w=j=>j<8?1.5:1,W=R.reduce((t,r,j)=>t+w(j),0);
  /* 2026/11/24：メガストーンを持つ匹が2匹以上いても、選出から外さない。選出ごとに、その中のメガストーンの匹を1匹ずつ「この匹だけがメガシンカ」として計算し
     （ほかのメガストーンの匹は持ち物なし＝メガストーンの効果なし、dgTeam1）、いちばん良い場合をその選出の値にする。相手（上位の匹）はどの場合も同じ。 */
  const H=(T.mega&&T.mega.holders)||[],multi=H.length>=2;
  const mkCtx=T1=>{
    const fk=r=>(r.from||r.q).no,byFrom=new Map(T1.rows.map(r=>[fk(r),r]));
    const rows=T1===T?R:R.map(r=>byFrom.get(fk(r))||null);
    const weatherOf=es=>{
      const prev=typeof WX_MEGA==='undefined'?undefined:WX_MEGA;
      try{if(H.length)WX_MEGA=T1.mega.i>=0?T1.mega.no:null;return teamWx(es)}
      finally{if(H.length)WX_MEGA=prev}
    };
    const tw=weatherOf(entries.filter((_,i)=>T1.M[i]));
    const wxBy=tw?T1.ms.findIndex(o=>o.x?.no===tw.no):-1;
    const gain=tw?T1.ms.map((_,i)=>i).filter(i=>i!==wxBy&&rows.some(r=>r&&(r.res.find(z=>z.i===i)||{}).wxTeam)):[];
    const weatherContexts=new Map();
    const withSelectedWeather=c=>{
      const weather=weatherOf(c.map(i=>entries[i]));
      const k=weather?.no??null;
      if(!weatherContexts.has(k)){
        const prev=WX_TEAM;WX_TEAM=weather;
        try{
          const affected=dgTeam0(entries,20,{megaNo:T1.mega.no,noMega:T1.mega.i<0,opponents:R.map(r=>r.from)});
          const lookup=new Map(affected.rows.map(r=>[fk(r),r]));
          weatherContexts.set(k,{T:affected,rows:R.map(r=>lookup.get(fk(r))||null),weather});
        }finally{WX_TEAM=prev}
      }
      return weatherContexts.get(k);
    };
    return{T:T1,rows,tw,wxBy,gain,withSelectedWeather,mi:T1.mega?T1.mega.i:-1};
  };
  const base=mkCtx(T),SC=new Map();
  const ctxFor=h=>{if(T.mega&&T.mega.i===h.i)return base;if(!SC.has(h.i)){let T1=null;try{T1=dgTeam0(entries,20,{megaNo:h.no})}catch(e){}SC.set(h.i,T1&&T1.mega&&T1.mega.i===h.i?mkCtx(T1):null)}return SC.get(h.i)};
  const q4=Math.ceil(R.length*.25);
  const ev=(c,X)=>{
    const {tw,wxBy}=X;
    const wxOk=!tw||wxBy<0||c.includes(wxBy);
    const {T:T1,rows:matchups,weather=tw}=wxOk?X:X.withSelectedWeather(c);
    const tr=T1.tr;
    /* 実際に技を登録した匹を選んだときだけ、選出した全員をトリックルーム中で比較する。 */
    const trUse=!!(tr&&tr.on&&tr.setters.some(s=>c.includes(s.i)));
    const P={cov:0,sw:0,swc:0,fast:0,danger:0};const cnt={4:0,3:0,2:0,1:0},rows=[];
    matchups.forEach((r,j)=>{
      const variants=trUse?r?.variantsTR:r?.variants;
      const chosen=variants?dgOpponentChoice(variants,c):null;
      const zs=chosen?chosen.rs:(trUse?r?.resTR:r?.res)?.filter(z=>c.includes(z.i))||[];
      if(chosen)r={...r,o:chosen.o,abAssume:chosen.abAssume};
      r=r||R[j];
      const st=zs.filter(z=>z.r>=4),ok=zs.filter(z=>z.r>=3),wk=zs.filter(z=>z.r===2);
      const lvl=st.length>=2?4:st.length===1?3:ok.length||wk.length?2:1;cnt[lvl]++;
      const sw=zs.some(z=>z.swIn==='win'),swc=!sw&&zs.some(z=>z.swIn==='sashwin'),fast=zs.some(z=>z.spd===1);
      const oh=zs.filter(z=>z.op&&z.op.nMax===1),danger=oh.length>=Math.ceil(c.length*2/3);
      P.cov+=w(j)*SEL_LV[lvl];P.sw+=w(j)*.25*sw;P.swc+=w(j)*.1*swc;P.fast+=w(j)*.15*fast;P.danger-=w(j)*.4*danger;
      rows.push({r,j,lvl,st,sw,swc,fast,oh,danger,zs})});
    /* 役わり：上から倒せる攻撃役・受けに回れる匹（dgAnalyze と同じ基準：上位の4分の1以上） */
    const byMember=(x,i)=>x.zs.find(z=>z.i===i);
    const zi=i=>rows.map(x=>byMember(x,i)).filter(Boolean);
    const atk=c.filter(i=>zi(i).filter(z=>z.k==='ko_fast').length>=q4);
    const def=c.filter(i=>{const zz=zi(i);return zz.filter(z=>['switch','wall','tank'].includes(z.k)).length>=q4||zz.filter(z=>!z.op||z.op.fmax<50).length>=q4||zz.filter(z=>z.swIn==='win').length>=q4});
    /* 得意な相手がほとんど同じ2匹（役割の重なり） */
    const good=i=>new Set(rows.filter(x=>{const z=byMember(x,i);return z&&z.r>=3}).map(x=>x.r.q.no));
    const over=[];for(let a=0;a<c.length;a++)for(let b=a+1;b<c.length;b++){const A=good(c[a]),B2=good(c[b]);if(A.size<3||B2.size<3)continue;const both=[...A].filter(x=>B2.has(x)).length;if(both/Math.min(A.size,B2.size)>=.85)over.push([c[a],c[b],both])}
    /* 選ばなかった匹に頼っている相手：パーティ全体では ◎○ なのに、この選出では △以下 */
    const lost=rows.filter(x=>R[x.j].lvl>=3&&x.lvl<=2).map(x=>({q:x.r.q,by:R[x.j].stable.filter(z=>!c.includes(z.i)).map(z=>z.i)}));
    /* 先発（2026/11/10 依頼主の確認）：相手の先発になりやすい上位の相手との対面で比べる。
       1匹の値＝有利（r>=4）1・やや有利（r=3）0.6・不安定（r=2）0.25、先に一撃で倒される（相手の乱数最大で1発・こちらが先に動けない）−0.5。上位8匹は1.5倍。
       シングル＝選出の3匹それぞれ、ダブル＝4匹から2匹の6通り（2匹のうち良い方の値、2匹とも先に倒されるなら−0.5、1匹なら−0.2） */
    const lv=z=>z?(z.r>=4?1:z.r>=3?.6:z.r===2?.25:0):0,die=z=>!!(z&&z.op&&z.op.nMax===1&&z.spd!==1);
    const lead1=c.map(i=>{const zz=rows.map(x=>({x,z:byMember(x,i)}));
      return{i,sc:zz.reduce((t,{x,z})=>t+w(x.j)*(lv(z)-(die(z)?.5:0)),0)/W,adv:zz.filter(y=>y.z&&y.z.r>=4),ok:zz.filter(y=>y.z&&y.z.r===3),die:zz.filter(y=>die(y.z)),fast:zz.filter(y=>y.z&&y.z.spd===1).length}})
      .sort((a,b)=>b.sc-a.sc||b.adv.length-a.adv.length||a.die.length-b.die.length||a.i-b.i);
    const pairs=c.length===4?combos(c,2).map(pr=>{const back=c.filter(i=>!pr.includes(i));
      const rr=rows.map(x=>{const z=pr.map(i=>byMember(x,i)),bz=back.map(i=>byMember(x,i));const v=Math.max(...z.map(lv)),d=z.filter(die).length;
        return{x,v,d,cover:v<.6&&bz.some(q=>q&&q.r>=4),best:z.map((q,k)=>({q,i:pr[k]})).sort((a,b)=>lv(b.q)-lv(a.q))[0]}});
      return{pr,back,sc:rr.reduce((t,y)=>t+w(y.x.j)*(y.v-(y.d===2?.5:y.d===1?.2:0)),0)/W,adv:rr.filter(y=>y.v>=1),both:rr.filter(y=>y.d===2),cover:rr.filter(y=>y.cover),rr}})
      .sort((a,b)=>b.sc-a.sc||b.adv.length-a.adv.length||a.both.length-b.both.length||(a.pr.join()<b.pr.join()?-1:1)):null;
    const leads=pairs?[...pairs[0].pr,...pairs[0].back]:lead1.map(l=>l.i);
    P.cov/=W;P.sw/=W;P.swc/=W;P.fast/=W;P.danger/=W;P.role=-(atk.length?0:.08)-(def.length?0:.05);P.over=-.03*over.length;
    const sc=P.cov+P.sw+P.swc+P.fast+P.danger+P.role+P.over;
    /* サポートとエース：場を作る技（登録した技）と、積み技（boost）の匹 */
    const setMv=i=>((entries[i].set&&entries[i].set.mv)||[]).map(m=>m&&MD[m.id]&&MD[m.id][3]).filter(Boolean);
    const SUP={trickroom:'トリックルーム',tailwind:'おいかぜ',reflect:'リフレクター',lightscreen:'ひかりのかべ',auroraveil:'オーロラベール',stealthrock:'ステルスロック',spikes:'まきびし'};
    const sup=c.map(i=>({i,k:setMv(i).filter(k=>SUP[k])})).filter(x=>x.k.length);
    const ace=c.filter(i=>T1.M[i]&&T1.M[i].boost);
    return{c,sc,P,cnt,rows,atk,def,over,lost,leads,lead1,pairs,trUse,wxOk,weather,megaI:X.mi>=0&&c.includes(X.mi)?X.mi:-1,X,tr,sw:rows.filter(x=>x.sw).length,swc:rows.filter(x=>x.swc).length,fast:rows.filter(x=>x.fast).length,danger:rows.filter(x=>x.danger),sup,ace};
  };
  const eligible=T.M.flatMap((m,i)=>m?[i]:[]),groups=combos(eligible,K);
  const all=groups.filter(c=>ax<0||c.includes(ax));
  /* 選出ごとの評価：メガストーンの匹が選出に0匹＝メガシンカなしで計算、1匹以上＝その匹ごとに「この匹だけがメガシンカ」で計算し、いちばん良い場合 */
  let none=base;
  const evSel=c=>{const hs=H.filter(h=>c.includes(h.i));
    if(hs.length===0){if(H.length&&none===base)none=mkCtx(dgTeam0(entries,20,{noMega:true}));const x=ev(c,none);x.megaAlt=[];return x}
    if(!multi){const x=ev(c,base);x.megaAlt=[];return x}
    const V=hs.map(h=>{const X=ctxFor(h);return X?ev(c,X):null}).filter(Boolean);if(!V.length)return null;
    V.sort(dgSelOrder);const x=V[0];
    x.megaAlt=V.slice(1).map(y=>({i:y.megaI,sc:y.sc,cnt:y.cnt}));x.megaHold=hs.map(h=>h.i);return x};
  if(!all.length){DG_SELC.set(key,null);return null}
  /* 順位：点の高い順。点が同じ（小数第3位まで）なら ×が少ない→選出の多くが一撃で倒される相手が少ない→◎○が多い→後出しできる相手が多い→先に動ける相手が多い→パーティの並び順 */
  const list=all.map(evSel).filter(Boolean).sort(dgSelOrder);if(!list.length){DG_SELC.set(key,null);return null}
  list.forEach((x,k)=>x.tie=k>0&&dgSelScore(list[k-1])===dgSelScore(x));
  const sel=entries.map((x,i)=>x.sel?i:-1).filter(i=>i>=0);
  const mine=sel.length===K?list.find(x=>x.c.length===K&&x.c.every(i=>sel.includes(i))):null;
  const out={K,N:R.length,list,best:list[0],mine,mineRank:mine?list.indexOf(mine)+1:0,total:groups.length,excluded:n-eligible.length,
    nm,tw:base.tw,wxBy:base.wxBy,gain:base.gain,tr:T.tr,ax,T,multi,H,megaNm:i=>{const h=H.find(z=>z.i===i);return h?dgMegaNm(h):nm(i)}};
  DG_SELC.set(key,out);return out;
}
/* 1つの選出の説明（なぜよいか・気をつけること）。数はすべて上の計算から */
function dgSelWhy(S,x,ref){
  const nm=S.nm,L=l=>DG_LV[l][0],good=[],warn=[];
  good.push(`比較した${S.N}匹のうち ${L(4)}${x.cnt[4]}・${L(3)}${x.cnt[3]}・${L(2)}${x.cnt[2]}・${L(1)}${x.cnt[1]}（◎＝選出の2匹以上が有利に戦える）`);
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
  const X=x.X||{tw:S.tw,wxBy:S.wxBy,gain:S.gain,T:S.T};
  if(x.megaI>=0&&S.multi)good.push(`メガシンカ：${S.megaNm(x.megaI)}（この選出では${S.nm(x.megaI)}だけがメガシンカする場合で計算${(x.megaHold||[]).filter(i=>i!==x.megaI).length?`。${x.megaHold.filter(i=>i!==x.megaI).map(nm).join('・')}はメガシンカせず、メガストーンの効果なしで計算`:''}${x.megaAlt&&x.megaAlt.length?`。${x.megaAlt.map(a=>`${S.megaNm(a.i)}にした場合は点 ${a.sc.toFixed(3)}`).join('・')}`:''}）`);
  else if(x.megaI>=0)good.push(`メガシンカ：${S.megaNm(x.megaI)}`);
  if(x.weather)good.push(`${x.weather.by}の${ABN[x.weather.ab]||'特性'}で${({sun:'晴れ',rain:'雨',sand:'砂嵐',snow:'雪'})[x.weather.k]}になった場合を、対応する対面に反映しています${x.weather.guess?'（特性は推定）':''}`);
  else if(X.tw&&X.wxBy>=0&&X.gain.length&&!x.wxOk)warn.push(`パーティの天気を作る${nm(X.wxBy)}がこの選出にいないため、味方の天気補正を入れていません`);
  const suppressed=x.rows.filter(y=>y.zs.some(z=>z.weatherSuppressed));
  if(suppressed.length)warn.push(`天気の効果が無効になる対面あり（例 ${suppressed.slice(0,3).map(y=>y.r.q.n).join('・')}）`);
  const assumed=x.rows.filter(y=>y.r.abAssume);
  if(assumed.length)warn.push(`相手の特性はこの選出で比較して推定：${assumed.slice(0,3).map(y=>`${y.r.q.n}（${ABN[y.r.abAssume.ab]||y.r.abAssume.ab}）`).join('・')}${assumed.length>3?' ほか':''}`);
  const tr=x.tr||X.T&&X.T.tr;
  if(tr&&tr.on)(x.trUse?good:warn).push(x.trUse?`トリックルームを技に入れている匹（${tr.setters.filter(s=>x.c.includes(s.i)).map(s=>nm(s.i)).join('・')}）がいるので、選出の全員と相手をトリックルーム中（遅い方が先）の計算にしています`:'トリックルームを張れる匹がいない選出です（遅い匹はトリックルームなしの計算）');
  return{good,warn};
}
/* 1匹の対面を短く：「ガブリアス：上から一撃（確定）／じしん 107〜127%・素早さ 158 対 122」 */
function dgZTxt(S,z,opts){if(!z)return '';const nm=S.nm(z.i);
  return `${nm}：${z.t||DG_K[z.k].t||''}／${z.me?`${z.me.mvn} ${dgDmgTxt(z.me,'op')}`:'効く技なし'}・相手の${z.op?`${z.op.mvn} 最大${dgPct(z.op.fmax)}${z.op.half?`（こちらの${ABN[z.op.half]||'特性'}でHP満タンのとき。2発目から最大${dgPct(z.op.max)}）`:''}`:'効く技なし'}・素早さ ${z.sa} 対 ${z.so}${opts&&opts.sw?`・後出し：${{win:'勝てる',sashwin:'条件つき',sash:'タスキ頼みで不可',survive:'耐えるが撃ち合いで負ける',unproven:'交代後の勝ちは判定保留',no:'1発目で倒される'}[z.swIn]}`:''}`}
/* 先発の比較：シングル＝3匹それぞれ、ダブル＝2匹の6通り。上位8匹（相手の先発になりやすい相手）との対面を根拠に出す。
   2026/11/10 UI改善 第4段階：1行ずつ「有利・やや有利・先に一撃で倒される・先に動ける」の数を札で、1番の理由は相手の名前の札、計算の文はたたむ */
const selOpChips=(a,cls)=>a.length?`<span class="selu-ops">${a.map(n=>`<span class="dgc-op${cls?' '+cls:''}">${esc(n)}</span>`).join('')}</span>`:'<span class="selu-none">なし</span>';
function selStat(l,v,cls){return `<span class="selu-st${cls?' '+cls:''}"><i>${l}</i><b>${v}</b></span>`}
function dgLeadHTML(S,x){
  const nm=i=>esc(S.nm(i)),top=y=>(y.x?y.x.j:y.j)<8;
  if(x.pairs){
    const P0=x.pairs[0];
    return `<div class="selu-sub"><h4>先発の比較（選んだ4匹から先発2匹：6通り・簡易比較）</h4>
      <p class="sel-lim"><b>簡易比較</b>：${DG_DOUBLE_SCOPE}${DG_DOUBLE_LIMITS}この点は対面の比較に使う指標です。</p>
      ${x.pairs.map((p,k)=>`<div class="sel-c selu-row${k===0?' sel-best':''}"><span class="sel-rk">${k+1}</span><span class="sel-m">先発 ${nm(p.pr[0])}・${nm(p.pr[1])}<small class="selu-back">後ろ ${nm(p.back[0])}・${nm(p.back[1])}</small></span><span class="selu-sts">${selStat('どちらかが有利',p.adv.length,'g')}${selStat('2匹とも先に一撃の危険',p.both.length,p.both.length?'b':'')}${selStat('後ろで補える',p.cover.length)}<span class="selu-sc">点 ${p.sc.toFixed(2)}</span></span></div>`).join('')}
      <div class="selu-why"><p><b>${nm(P0.pr[0])}・${nm(P0.pr[1])}</b>を先発にすると</p>
        <div class="dgc-row"><span class="dgc-k">どちらかが有利（上位8匹）</span>${selOpChips(P0.adv.filter(top).map(y=>y.x.r.q.n),'selu-g')}</div>
        <div class="dgc-row"><span class="dgc-k">どちらを狙われても先に一撃で倒されうる</span>${selOpChips(P0.both.map(y=>y.x.r.q.n),'selu-b')}</div>
        ${P0.cover.length?`<div class="dgc-row"><span class="dgc-k">先発で不利でも、後ろの${nm(P0.back[0])}・${nm(P0.back[1])}が有利</span>${selOpChips(P0.cover.map(y=>y.x.r.q.n))}</div>`:''}</div>
      <details class="dgc-ev"><summary>計算根拠と点の決め方を見る</summary>
        <p class="vcap">選出の4匹とは別に、そのうち最初に出す2匹の組み合わせを比べています。上位${S.N}匹を相手の先発の候補として、相手1匹ずつに、2匹のどちらかが1対1で有利に戦えるか・どちらを狙われても先に一撃で倒されうるかを数えました（相手が2匹で同時に1匹を狙う場合は数えていません）。点＝相手ごとに2匹のうち良い方（有利1・やや有利0.6・不安定0.25）−どちらも先に一撃で倒されうる0.5（片方なら0.2）、上位8匹は1.5倍の平均。</p>
        <ul class="sel-why"><li>${esc(`1番の点が高い理由（上位8匹との1対1の計算。同時攻撃・範囲技は入っていない）：`)}<br>${P0.rr.filter(top).map(y=>esc(`${y.x.r.q.n} → ${dgZTxt(S,y.best.q)}${y.d===2?'（どちらを狙われても先に一撃で倒されうる）':''}`)).join('<br>')}</li></ul></details></div>`;
  }
  const L0=x.lead1[0];
  return `<div class="selu-sub"><h4>先発の比較（選んだ3匹それぞれ）</h4>
    ${x.lead1.map((l,k)=>`<div class="sel-c selu-row${k===0?' sel-best':''}"><span class="sel-rk">${k+1}</span><span class="sel-m">${nm(l.i)}${k===0?'<small>先発</small>':''}</span><span class="selu-sts">${selStat('有利',l.adv.length,'g')}${selStat('やや有利',l.ok.length)}${selStat('先に一撃で倒される',l.die.length,l.die.length?'b':'')}${selStat('先に動ける',l.fast)}<span class="selu-sc">点 ${l.sc.toFixed(2)}</span></span></div>`).join('')}
    <div class="selu-why"><p><b>${nm(L0.i)}</b>を先発にする理由（上位8匹との対面）</p>
      <div class="dgc-row"><span class="dgc-k">有利に戦える</span>${selOpChips(L0.adv.filter(top).map(y=>y.x.r.q.n),'selu-g')}</div>
      <div class="dgc-row"><span class="dgc-k">先に一撃で倒される（気をつける）</span>${selOpChips(L0.die.filter(top).map(y=>y.x.r.q.n),'selu-b')}</div>
      ${x.lead1.slice(1).map(l=>`<p class="dgu-note">${esc(`${S.nm(l.i)}を先発にすると：有利 ${l.adv.length}匹（${S.nm(L0.i)}は${L0.adv.length}匹）・先に一撃で倒される ${l.die.length}匹（${S.nm(L0.i)}は${L0.die.length}匹）`)}</p>`).join('')}</div>
    <details class="dgc-ev"><summary>計算根拠と点の決め方を見る</summary>
      <p class="vcap">上位${S.N}匹を相手の先発の候補として、先発にしたときに有利に戦える数と、先に一撃で倒される数を比べています。点＝相手ごとに有利1・やや有利0.6・不安定0.25−先に一撃で倒される0.5、上位8匹は1.5倍の平均。同点なら有利が多い→先に倒される相手が少ない順。</p>
      <ul class="sel-why"><li>${esc(`${S.nm(L0.i)}を先発にする理由（上位8匹との対面）：`)}<br>${L0.adv.filter(top).slice(0,4).map(y=>esc(`有利：${y.x.r.q.n} → ${dgZTxt(S,y.z)}`)).join('<br>')}${L0.die.filter(top).length?'<br>'+L0.die.filter(top).slice(0,3).map(y=>esc(`気をつける：${y.x.r.q.n} → ${dgZTxt(S,y.z)}`)).join('<br>'):''}</li>
      ${x.lead1.slice(1).map(l=>`<li>${esc(`${S.nm(l.i)}を先発にすると：有利 ${l.adv.length}匹（${S.nm(L0.i)}は${L0.adv.length}匹）・先に一撃で倒される ${l.die.length}匹（${S.nm(L0.i)}は${L0.die.length}匹）${l.die.filter(top).length?`。例：${l.die.filter(top).slice(0,2).map(y=>`${y.x.r.q.n}の${y.z.op.mvn} 最大${dgPct(y.z.op.fmax)}（素早さ ${y.z.sa} 対 ${y.z.so}）`).join('・')}`:''}`)}</li>`).join('')}</ul></details></div>`;
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
/* 選出の比較の画面（2026/11/10 UI改善 第4段階）：1番の選出＝匹の札（先発の印）・◎○△×の横棒・数の札（後出し・先手・一撃の危険・攻撃役・受け役）・よい理由・気をつけること
   → 先発の比較 → 2番目との違い（相手の名前の札）→ ★の選出 → たたむ（点の内訳・全部の一覧・計算の前提）。数・文はすべて dgSelect／dgSelWhy のまま */
function dgSelHTML(S,entries){
  if(!S||!S.best)return '';
  const nm=i=>esc(S.nm(i)),L=l=>DG_LV[l][0],B=S.best,N=S.N;
  const lds=x=>x.pairs?x.pairs[0].pr:[x.lead1[0].i];
  const mk=(x,i)=>x.megaI===i&&S.multi?'<small class="sel-mg">メガ</small>':'';
  const line=(x,k)=>`<div class="sel-c${k===0?' sel-best':''}"><span class="sel-rk">${k+1}</span><span class="sel-m">${x.c.map(i=>`${nm(i)}${mk(x,i)}${lds(x).includes(i)?'<small>先発</small>':''}`).join('・')}</span><span class="sel-n">${L(4)}${x.cnt[4]} ${L(3)}${x.cnt[3]} ${L(2)}${x.cnt[2]} ${L(1)}${x.cnt[1]}</span></div>`;
  const mons=x=>`<p class="dgu-sel">${x.c.map(i=>`<span class="dgu-mon${lds(x).includes(i)?' dgu-lead':''}">${nm(i)}${mk(x,i)}${lds(x).includes(i)?'<small>先発</small>':''}</span>`).join('')}</p>`;
  const W=dgSelWhy(S,B,S.list[1]);
  /* よい理由：数の札・先発の比較・2番目との比較に出すものは除く（文はそのまま） */
  const good=W.good.filter(t=>!/^上位\d+匹のうち|^先発|^後出しして勝てる匹がいる相手|^2番目の選出/.test(t));
  const kpi=`<div class="selu-kpi">
    <div><span>後出しして勝てる匹がいる相手</span><b>${B.sw}<small>/${N}匹</small></b>${B.swc?`<em>ほか条件つき ${B.swc}匹（きあいのタスキ頼み）</em>`:''}</div>
    <div><span>先に動ける匹がいる相手</span><b>${B.fast}<small>/${N}匹</small></b></div>
    <div class="${B.danger.length?'selu-bad':''}"><span>選出の${Math.ceil(B.c.length*2/3)}匹以上が一撃で倒される相手</span><b>${B.danger.length}<small>匹</small></b></div>
    <div class="${B.cnt[1]?'selu-bad':''}"><span>答えがない相手（×）</span><b>${B.cnt[1]}<small>匹</small></b></div></div>`;
  /* 2番目との違い：相手ごとの ◎〜× が良くなる／悪くなる相手 */
  const R2=S.list[1];let cmp='';
  if(R2){const better=B.rows.filter((y,j)=>y.lvl>R2.rows[j].lvl).map(y=>y.r.q.n),worse=B.rows.filter((y,j)=>y.lvl<R2.rows[j].lvl).map(y=>y.r.q.n);
    cmp=`<div class="selu-sub"><h4>2番目の選出との違い</h4>${line(R2,1)}
      <div class="dgc-row"><span class="dgc-k">1番の方が良い相手（${better.length}匹）</span>${selOpChips(better,'selu-g')}</div>
      <div class="dgc-row"><span class="dgc-k">2番の方が良い相手（${worse.length}匹）</span>${selOpChips(worse,'selu-b')}</div>
      <p class="dgu-note">点の差 ${(dgSelScore(B)-dgSelScore(R2)).toFixed(3)}${R2.tie?'（同点。×が少ない→一撃の危険が少ない→◎○が多い…の順で決めました）':''}</p>
      ${dgSelCmpHTML(S,B,R2)}</div>`}
  const mine=S.mine&&S.mine!==B?dgSelWhy(S,S.mine,B):null;
  return `<div class="pc-i pc-plan sel-box" id="sel-box"><div class="selu-head"><b>選出の比較</b><span class="dgu-fmt">${S.K}匹の選び方 ${S.list.length}通りを計算${S.K===4?'・先発2匹は選んだ4匹ごとに6通り':''}</span></div>
    ${FMT==='double'?`<p class="dgu-note" role="status">ダブルの選出順位・先発・後出し判定は暫定評価です。${DG_DOUBLE_LIMITS}</p>`:""}
    ${S.excluded?formErrHTML((S.T.formErr||[]).filter(x=>x.side==='me')):''}
    ${S.T.unk&&S.T.unk.length?`<p class="dgu-note" role="status">計算に未反映の効果：${S.T.unk.slice(0,8).map(esc).join("、")}${S.T.unk.length>8?" ほか":""}。選出順位・先発・後出しの判定は暫定評価です。</p>`:""}
    <p class="dgu-note">計算できる${entries.length-S.excluded}匹から${S.K}匹を選ぶ組み合わせを、${esc(S.T.opponentSource)}${N}匹との1対1の計算（相手ごとの対応力と同じ計算）で比べました。${S.multi?`メガストーンを持つ匹が2匹以上入る選出は、1試合にメガシンカできるのが1匹なので、その中の1匹ずつを「この匹だけがメガシンカ（ほかはメガストーンの効果なし）」として計算し、いちばん良い場合で比べています。どの匹をメガシンカさせたかは選出ごとに出しています。`:''}${S.ax>=0?`軸の${nm(S.ax)}は必ず入れています。`:''}</p>
    <div class="selu-best"><p class="selu-lab">いちばん良い選出（1番＝上の基本選出）</p>${mons(B)}
      ${dguBars(B.cnt,N)}${kpi}
      ${good.length?`<p class="sel-wh">この選出のよいところ</p><ul class="sel-why">${good.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`:''}
      ${W.warn.length?`<p class="sel-wh">気をつけること</p><ul class="sel-why sel-warn selu-warn">${W.warn.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`:''}</div>
    ${dgLeadHTML(S,B)}
    ${cmp}
    ${S.mine?`<div class="selu-sub"><h4>いま選んでいる選出</h4>${line(S.mine,S.mineRank-1)}<p class="dgu-note">${S.list.length}通りのうち<b>${S.mineRank}番目</b>${S.mine===B?'（いちばん良い選出です）':''}</p>${mine?`<ul class="sel-why">${mine.good.filter(t=>/2番目の選出/.test(t)).map(t=>`<li>${esc(t.replace('2番目の選出','いちばん良い選出'))}</li>`).join('')}${mine.warn.map(t=>`<li class="sel-w">${esc(t)}</li>`).join('')}</ul>`:''}</div>`:''}
    <details class="sel-all"><summary>${S.list.length}通りすべてを見る</summary>${S.list.map((x,k)=>line(x,k)).join('')}
      <p class="vcap">並びは点の順です（点の決め方は「1番と2番の点の内訳」）。「先発」の印は、その選出の中で比べた先発です。</p></details>
    <details class="sel-all"><summary>計算の前提を見る</summary><p class="vcap">${S.tw?`味方の天気は、選出に入る天候役のうちパーティ順で先頭の1匹が作った場合を評価しています。`:''}${S.tr&&S.tr.on?'トリックルームは、技に入れている匹を選んだ選出でだけ、選出の全員（相手も）をトリックルーム中の順番で計算しています。覚えられるだけの匹では張ったことにしません。':''}相手の選出の読み合い・交代の順番は入れていません。先発の比較では、計算対象の相手を先発の候補として数えています（相手が実際に何を先発にするかは分かりません）。</p></details>
  </div>`;
}
