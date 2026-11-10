/* ===================== 対面の診断エンジン（2026/11/10 依頼主「パーティ診断エンジン強化」第2・3段階） =====================
   ダメージは 15-battle.js の bcalc（本編と同じ式・calc-ref で照合済み）を、乱数のいちばん低い 85% といちばん高い 100% で呼ぶ。
   ・estHit（16-assist.js）は乱数の真ん中（92%）だけなので「確定2発」と「乱数2発」を区別できなかった。ここでは
     確定（85%でも届く）・乱数（100%なら届く。16段階のうち何段階で届くかの確率も）を分ける。
   ・倒すまでの回数は 56-duel.js の duTurns（きあいのタスキ・がんじょう・マルチスケイル・ファントムガード・ばけのかわ）をそのまま使う。
   ・素早さは effSpd（能力ポイント・性格・こだわりスカーフ・天気で速くなる特性・まひ）。同じ速さは「同速（五分）」。
   ・天気は withWx（場に出ると天気を変える特性）。
   ・先制技は、こちらが遅くても先制技だけで倒しきれる（または削ったあとのとどめ）なら先に倒せる。
   判定（dgMatch の k）：
     ko_fast  上から倒せる（先に動いて、相手に倒される前に確定で倒しきれる）／先制技で確定で倒せる
     tank     耐えて倒せる（相手のいちばん痛い技を最大の乱数でも耐え、確定で倒しきれる）
     switch   後出しできる（交代で1回受けても、そこから撃ち合いに勝てる）
     wall     攻撃を半減・無効で受けて有利に戦える
     shaky    勝てるが不安定（乱数・同速・命中しだい）
     cond     条件つき（きあいのタスキ・がんじょう・積み技に頼る）
     lose     対応できない
   計算に入っていないもの（DG_NOTE）は、画面にそのまま書く。 */
const DG_ROLLS=[85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100];
const DG_K={ko_fast:{r:5,t:'上から倒せる'},tank:{r:4,t:'耐えて倒せる'},switch:{r:4,t:'後出しできる'},wall:{r:3,t:'受けて有利に戦える'},
  shaky:{r:2,t:'勝てるが不安定'},cond:{r:2,t:'条件つき'},lose:{r:1,t:'対応できない'}};
const DG_NOTE='技の反動・自分のHPが減る効果、フィールド（エレキフィールド等）の威力の変化、追い風・トリックルーム・ステルスロックなどの場の効果、やけど・まひ以外の状態異常、能力を下げる追加効果、急所は計算に入れていません。素早さを変える特性は、天気で速くなる特性（すいすい等）だけ入れています。';
/* 1つの技のダメージ（最大HPに対する％）：乱数の最小・最大と、16段階のうち倒しきれる段階の数 */
function dgMove(a,mv,d){
  const dg=d.disg;d.disg=false;
  try{
    const h=mv.maxH>1?(mv.minH===mv.maxH?mv.maxH:3):1;
    const r0=bcalc(a,mv,d,{r:85});if(!r0.dmg||!r0.eff)return{mv,min:0,max:0,eff:r0.eff||0,h,acc:accOf(a,mv,d),ohko:0,absorb:r0.absorb||null};
    const r1=bcalc(a,mv,d,{r:100});
    const min=r0.dmg*h/d.max*100,max=r1.dmg*h/d.max*100;
    let ohko=0;if(max>=100)ohko=r0.fixed?16:DG_ROLLS.filter(r=>bcalc(a,mv,d,{r}).dmg*h>=d.max).length;
    return{mv,min,max,eff:r0.eff,h,acc:accOf(a,mv,d),ohko,fixed:!!r0.fixed};
  }finally{d.disg=dg}
}
/* いちばん頼れる技：確定で倒せる回数が少ない順 → 最小ダメージ×命中の大きい順 */
function dgBest(a,d){
  let best=null;
  (a.moves||[]).forEach(mv=>{if(!mv||mv.prot||!(mv.pow>0||mv.fixed||fixedDmg(a,mv,d)!=null))return;
    const x=dgMove(a,mv,d);if(!x.max)return;
    x.nMin=duTurns(x.min,{mv,acc:100},a,d);x.nMax=duTurns(x.max,{mv,acc:100},a,d);
    const key=[x.nMin,-(x.min*x.acc)];
    if(!best||key[0]<best.key[0]||(key[0]===best.key[0]&&key[1]<best.key[1]))best={...x,key}});
  return best;
}
/* 先制技で倒しきれるか（確定の回数） */
function dgPrio(a,d){
  let best=null;
  (a.moves||[]).forEach(mv=>{if(!mv||mv.prot||!(mv.pri>0)||!(mv.pow>0))return;const x=dgMove(a,mv,d);if(!best||x.min>best.min)best=x});
  return best;
}
const dgPct=v=>v>=999?'—':Math.round(v)+'%';
const dgKoTxt=x=>{if(!x||!x.max)return '効く技がない';
  if(x.nMin===1)return '確定1発';
  if(x.nMax===1)return `乱数1発（${Math.round(x.ohko/16*100)}%）`;
  if(x.nMin===x.nMax)return x.nMin>=9?'倒しきれない':`確定${x.nMin}発`;
  return `乱数${x.nMax}発（確定${x.nMin>=9?'なし':x.nMin+'発'}）`};
/* 1対1：a（こちら）と o（相手）。どちらの技も「確定（乱数最小）」と「最悪の場合（相手は乱数最大）」で見る */
function dgMatch(a,o){return withWx(a,o,()=>dgMatch0(a,o))}
function dgMatch0(a,o){
  const me=dgBest(a,o),op=dgBest(o,a);
  const sa=effSpd(a),so=effSpd(o),spd=sa>so?1:sa<so?-1:0;
  const myN=me?me.nMin:9,myNb=me?me.nMax:9,acc=me?me.acc:100;
  /* 相手の攻撃は乱数最大（こちらにとって最悪）で数える */
  const opW=op?op.nMax:9,opB=op?op.nMin:9;
  const pr=dgPrio(a,o),opPr=dgPrio(o,a);
  const prKO=pr&&duTurns(pr.min,{mv:pr.mv,acc:100},a,o)===1;
  /* 先に倒しきれるか：こちらが先に動けるなら myN<=opW、遅ければ myN<opW。先制技のとどめ・相手の先制技も見る */
  const finPr=(n,x,p)=>p&&p.min>0&&(n-1)*x.min+p.min>=100;
  let first=spd;
  if(first<=0&&me&&finPr(myN,me,pr)&&!(op&&finPr(opW,op,opPr)))first=1;
  if(first>=0&&op&&finPr(opW,op,opPr)&&!(me&&finPr(myN,me,pr)))first=-1;
  const winSafe0=myN<9&&(first===1?myN<=opW:myN<opW);
  /* こちらのきあいのタスキ・がんじょうで1回耐えるおかげで勝てるだけなら「条件つき」にする */
  const opRaw=op?duTurns(op.max,{mv:op.mv,acc:100},o,{...a,item:a.item==='focussash'?null:a.item,ab:a.ab==='sturdy'?'':a.ab}):9;
  const winSafe=myN<9&&(first===1?myN<=opRaw:myN<opRaw);
  const sashOnly=winSafe0&&!winSafe;
  const winTie=myN<9&&first===0&&myN<=opW;
  const winBest=myNb<9&&(first>=0?myNb<=opB:myNb<opB);
  const sash=o.item==='focussash'||o.ab==='sturdy',mySash=a.item==='focussash'||a.ab==='sturdy';
  /* 交代で出ると1回ぶん多く受ける */
  const swOk=opW>=2&&myN<9&&(first===1?myN<=opW-1:myN<opW-1);
  const resist=op&&op.eff<=.5;
  let k='lose',why=[];
  const meTxt=me?`${me.mv.n}で${dgPct(me.min)}〜${dgPct(me.max)}（${dgKoTxt(me)}）`:'効く技がない';
  const opTxt=op?`相手の${op.mv.n}で${dgPct(op.min)}〜${dgPct(op.max)}（${dgKoTxt(op)}）`:'相手に効く技がない';
  if((first===1&&winSafe)||prKO){k='ko_fast';why.push(prKO&&!(first===1&&winSafe)?`先制技の${pr.mv.n}で${dgPct(pr.min)}〜${dgPct(pr.max)}（確定1発）`:`先に動ける。${meTxt}`);if(!prKO||first===1)why.push(myN===1?'相手は動く前に倒れる':opTxt)}
  else if(winSafe&&swOk){k='switch';why.push(`交代で1回受けてからでも勝てる：${opTxt}`,`こちら：${meTxt}`)}
  else if(winSafe){k=resist&&opW>=3?'wall':'tank';why.push(`最大の乱数でも先に倒れない：${opTxt}`,`こちら：${meTxt}`)}
  else if(resist&&opW>=4&&myN<=4){k='wall';why.push(`相手のいちばん痛い技も半減以下：${opTxt}`,`こちら：${meTxt}`)}
  else if(sashOnly){k='cond';why.push(`${a.item==='focussash'?'きあいのタスキ':'がんじょう'}で1回耐えてから`,`こちら：${meTxt}`,opTxt)}
  else if(winTie||winBest){k='shaky';why.push(winTie?'同じ速さ（どちらが先に動くかは五分）':'乱数が高く出れば勝てる',`こちら：${meTxt}`,opTxt)}
  else{
    let up=null;try{const d=duel(a,o);if(d.up&&d.s>=1)up=d.up}catch(e){}
    if(up){k='cond';why.push(`${up}を1回使ってから戦えば勝てる`,`こちら：${meTxt}`,opTxt)}
    else{k='lose';why.push(`こちら：${meTxt}`,opTxt)}}
  /* 命中：90%未満の技に頼る勝ちは「不安定」に下げる（90%以上は注意書きだけ） */
  if(me&&me.acc<100&&DG_K[k].r>=3&&!(k==='ko_fast'&&prKO)){if(me.acc<90){k='shaky';why.unshift(`${me.mv.n}の命中が${Math.round(me.acc)}%なので外れると負ける`)}else why.push(`${me.mv.n}の命中は${Math.round(me.acc)}%`)}
  if(sash&&me&&me.max>=100)why.push(`相手は${o.item==='focussash'?'きあいのタスキ':'がんじょう'}なので満タンからは一撃で倒せない（計算に入れています）`);
  return{k,r:DG_K[k].r,t:DG_K[k].t,why,me,op,spd,first,sa,so,myN,opW,pr};
}
/* パーティ（entries）× 相手（metaOpps）の表。相手の型は使用率の高い型（detSet）。集計の有無も返す */
function dgTeam(entries,n){
  n=n||20;
  const ms=entries.map(x=>({x,p:byNo[x.no]})).filter(o=>o.p);
  const M=ms.map(o=>{try{return mkMon(o.p,'me',mySetFor(o.x.no))}catch(e){return null}});
  const fam=q=>q.base||q.no;
  const opps=metaOpps(n).filter(q=>!ms.some(o=>fam(o.p)===fam(q)));
  const rows=opps.map(q=>{
    const live=!!(LIVE.csv[q.base||q.no]);
    let o;try{o=mkMon(q,'op',q.base&&byNo[q.base]?{...detSet(byNo[q.base]),ab:q.ab,item:null}:detSet(q))}catch(e){return null}
    const res=M.map((a,i)=>{if(!a)return null;try{return{i,...dgMatch(a,o)}}catch(e){return null}}).filter(Boolean);
    const stable=res.filter(r=>r.r>=4),ok=res.filter(r=>r.r>=3),weak=res.filter(r=>r.r===2);
    const lvl=stable.length>=2?4:stable.length===1?3:ok.length||weak.length?2:1;
    return{q,o,live,res,stable,ok,weak,lvl};
  }).filter(Boolean);
  return{ms,M,rows,live:rows.some(r=>r.live),liveAll:rows.every(r=>r.live),mySet:ms.map(o=>!!(o.x.set&&o.x.set.mv&&o.x.set.mv.length))};
}
const DG_LV={4:['◎','2匹以上で安定して対応できる','ok'],3:['○','1匹だけで対応（その匹に頼っている）','mid'],2:['△','対応が不安定（乱数・同速・条件しだい）','warn'],1:['×','パーティ全体で対応が難しい','bad']};
function dgHTML(){return `<div id="dg-box"><div class="sec"><h2>相手ごとの対応力（計算）</h2></div><p class="empty" style="padding:14px">計算中…</p></div>`}
function dgFill(entries){
  const el=document.getElementById('dg-box');if(!el||!entries.length)return;
  let T;try{T=dgTeam(entries,20)}catch(e){el.innerHTML='';return}
  const cnt=l=>T.rows.filter(r=>r.lvl===l).length;
  const nm1=i=>esc(formInfo(T.ms[i].p).base);
  const rowHTML=r=>{const L=DG_LV[r.lvl],best=[...r.res].sort((a,b)=>b.r-a.r).slice(0,3);
    return `<details class="dg-r dg-${L[2]}"><summary><span class="dg-lv">${L[0]}</span><b>${esc(r.q.n)}</b><small>${r.stable.length?r.stable.map(x=>nm1(x.i)).join('・')+'で対応':r.ok.length||r.weak.length?'不安定':'答えなし'}</small></summary>
      <p class="dg-why">${L[1]}${r.live?'':'（この相手は使用率の集計が読めていないため、自動で決めた型で計算）'}</p>
      <ul>${best.map(x=>`<li><span class="dg-k dg-k${x.r}">${x.t}</span><b>${nm1(x.i)}</b>：${x.why.map(esc).join('／')}<small>素早さ ${x.sa} 対 ${x.so}${x.spd===0?'（同速）':''}</small></li>`).join('')}</ul></details>`};
  const order=[...T.rows].sort((a,b)=>a.lvl-b.lvl);
  el.innerHTML=`<div class="sec"><h2>相手ごとの対応力（計算）</h2><span style="font-size:12px;color:var(--dim)">${FMTN()}</span></div>
    <p class="note" style="padding-top:0">使用率の上位${T.rows.length}匹（パーティにいる種類は除く）に、1匹ずつ実際のダメージ計算と素早さで「先に倒せるか・耐えて倒せるか・後出しできるか」を見ています。弱点を突けるだけでは「対応できる」にしません。</p>
    <div class="dg-sum">${[4,3,2,1].map(l=>`<div class="dg-s dg-${DG_LV[l][2]}"><span>${DG_LV[l][0]}</span><b class="num">${cnt(l)}</b></div>`).join('')}</div>
    <p class="note" style="padding-top:4px">◎ 2匹以上で安定　○ 1匹に頼っている　△ 不安定　× 答えなし（押すと計算の中身）</p>
    ${order.map(rowHTML).join('')}
    <details class="dg-pre"><summary>計算の前提</summary><p class="note">相手は${T.liveAll?'ランクバトルの集計から組んだ使用率の高い型':T.live?'集計が読めた相手は使用率の高い型、読めなかった相手は自動で決めた型':'自動で決めた型（ランクバトルの集計を読めていません）'}、こちらは${T.mySet.every(Boolean)?'登録した育成':T.mySet.some(Boolean)?'登録した育成（未登録の匹は使用率の高い型）':'使用率の高い型（育成が未登録）'}です。こちらのダメージは乱数のいちばん低い値で「確定で倒せるか」、相手のダメージは乱数のいちばん高い値で「必ず耐えられるか」を見ています。きあいのタスキ・がんじょう・マルチスケイル・ばけのかわ・命中・先制技・こだわりスカーフ・天気を入れています。${DG_NOTE}</p></details>`;
}
