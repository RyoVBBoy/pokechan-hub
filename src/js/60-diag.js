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
/* 対戦の進め方（バトルの画面）では入っているが、1対1のダメージ計算には入らない特性（場に出たとき・倒したとき・受けたときに能力が変わる） */
const DG_SIMONLY=new Set(['intimidate','speed-boost','moxie','stamina','justified','defiant','competitive']);
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
/* 同じパーティ・形式・集計の読み込み状況なら、計算を使い回す（パーティのチェックと「相手ごとの対応力」で同じ結果を使う） */
const DG_CACHE={};
function dgTeam(entries,n){
  n=n||20;
  const key=JSON.stringify([FMT,n,Object.keys(LIVE.csv).length,typeof META!=='undefined'&&META.rank?META.rank.length:0,entries.map(x=>[x.no,x.set||0])]);
  if(DG_CACHE.k===key)return DG_CACHE.v;
  const v=dgTeam0(entries,n);DG_CACHE.k=key;DG_CACHE.v=v;return v;
}
function dgTeam0(entries,n){
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
  /* 計算に入っていない特性（ABIMPL にないもの）を、こちら・相手ともに書き出す（推測で計算したことにしない） */
  const unk=new Map();const addU=(m,who)=>{if(m&&m.ab&&ABN[m.ab]&&(DG_SIMONLY.has(m.ab)||(typeof ABIMPL!=='undefined'&&!ABIMPL.has(m.ab))))unk.set(who+m.p.n,`${m.p.n}の${ABN[m.ab]}`)};
  M.forEach(m=>addU(m,'me'));rows.forEach(r=>addU(r.o,'op'));
  return{ms,M,rows,live:rows.some(r=>r.live),liveAll:rows.every(r=>r.live),mySet:ms.map(o=>!!(o.x.set&&o.x.set.mv&&o.x.set.mv.length)),unk:[...unk.values()]};
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

/* ===================== 第4段階：パーティ全体の分析（2026/11/10） =====================
   dgTeam の1対1の結果（同じ計算）だけから、攻撃・防御・素早さ・役割の問題を拾う。タイプ相性だけでは判定しない。
   返すもの：bad（気になる点）・good（よいところ）・ref（参考）。どれも {area,sev,t,d,how,ev:[根拠の数字]} */
const DG_SEV={3:'深刻',2:'注意',1:'軽い'};
function dgAnalyze(T){
  const bad=[],good=[],ref=[],R=T.rows,n=T.ms.length,N=R.length;
  if(!n||!N)return{bad,good,ref};
  const nm=i=>formInfo(T.ms[i].p).base,qn=r=>r.q.n,top=r=>R.indexOf(r)<8;
  const pc=v=>dgPct(v);
  const x2=(r,i)=>r.res.find(z=>z.i===i);
  /* 深刻度：使用率の上位8匹が2匹以上なら深刻、上位8匹が1匹か全部で3匹以上なら注意、ほかは軽い */
  const sevOf=rs=>{const t=rs.filter(top).length;return t>=2?3:t===1||rs.length>=3?2:1};
  const list=(rs,f,k)=>rs.slice(0,k||5).map(f);
  /* ---- 攻撃：確定2発以内（乱数のいちばん低い値でも2回で倒せる）で倒せる匹がいるか ---- */
  const kill=r=>r.res.filter(z=>z.me&&z.me.nMin<=2);
  const noKill=R.filter(r=>!kill(r).length);
  if(noKill.length){
    const bestOf=r=>[...r.res].filter(z=>z.me).sort((a,b)=>b.me.min-a.me.min)[0];
    bad.push({area:'攻撃',sev:sevOf(noKill),t:`確定2発で倒せるポケモンがいない相手が${noKill.length}匹`,
      d:'乱数がいちばん低く出ても2回の攻撃で倒せる匹がいません。削り合いが長引き、相手の積み技や回復を許しやすくなります。',
      ev:list(noKill,r=>{const b=bestOf(r);return b?`${qn(r)}：いちばん削れるのは${nm(b.i)}の${b.me.mv.n}で${pc(b.me.min)}〜${pc(b.me.max)}（${dgKoTxt(b.me)}）`:`${qn(r)}：効く攻撃技を持つ匹がいない`}),
      how:'その相手に効果ばつぐんを取れる技か、威力の高いタイプ一致技を覚えさせる・火力を上げる持ち物（いのちのたま・タイプ強化の道具など）を持たせると届くことがあります。変更後の計算は第6段階の改善案で確かめられるようにします。'});
  }else good.push({area:'攻撃',t:`上位${N}匹すべてに、確定2発で倒せる匹がいる`,ev:[]});
  /* 1匹に攻撃役を頼っている相手 */
  const soleK={};R.forEach(r=>{const k=kill(r);if(k.length===1)(soleK[k[0].i]=soleK[k[0].i]||[]).push(r)});
  Object.entries(soleK).filter(([,rs])=>rs.length>=3).forEach(([i,rs])=>bad.push({area:'攻撃',sev:rs.some(top)?2:1,t:`${nm(+i)}だけが確定2発で倒せる相手が${rs.length}匹`,
    d:`${nm(+i)}が倒されたり、ほかの相手の相手をしていると、次の相手を倒しきれる匹がいなくなります。`,
    ev:list(rs,r=>{const z=x2(r,+i);return `${qn(r)}：${z.me.mv.n}で${pc(z.me.min)}〜${pc(z.me.max)}（${dgKoTxt(z.me)}）`}),
    how:`同じ相手を確定2発で倒せる2匹目を用意すると、${nm(+i)}に頼らずに済みます。`}));
  /* ---- 防御：一撃で倒される危険・後出しできる匹 ---- */
  const half=Math.max(2,Math.ceil(n/2));
  const ohko=R.filter(r=>r.res.filter(z=>z.op&&z.op.nMax===1).length>=half);
  if(ohko.length)bad.push({area:'防御',sev:sevOf(ohko),t:`${n}匹中${half}匹以上を一撃で倒せる相手が${ohko.length}匹`,
    d:'相手の乱数がいちばん高く出たときに、パーティの半分以上が一撃で倒されます。この相手に先に動かれると、数を一気に減らされます。',
    ev:list(ohko,r=>{const o=r.res.filter(z=>z.op&&z.op.nMax===1),s=r.res.filter(z=>z.op&&z.op.nMax>1).sort((a,b)=>a.op.max-b.op.max)[0];
      return `${qn(r)}：${o.map(z=>nm(z.i)).join('・')}を一撃${s?`。耐えるのは${nm(s.i)}（${s.op.mv.n}で最大${pc(s.op.max)}）`:''}`}),
    how:'この相手の攻撃を2回耐えられる匹（タイプで半減以下にする・能力ポイントを耐久に回す）を用意するか、相手より先に動いて倒せる匹を入れます。'});
  const sw=r=>r.res.filter(z=>z.opW>=3);
  const noSw=R.filter(r=>!sw(r).length);
  if(noSw.length)bad.push({area:'防御',sev:sevOf(noSw),t:`後出しできる匹がいない相手が${noSw.length}匹`,
    d:'相手のいちばん痛い技を最大の乱数で3回耐えられる匹がいません（交代で1回受けて、さらに撃ち合うには3回分の余裕が要ります）。この相手が場に出ると、交代で受けることができず、倒されるまで殴り合うしかありません。',
    ev:list(noSw,r=>{const s=r.res.filter(z=>z.op).sort((a,b)=>a.op.max-b.op.max)[0];return s?`${qn(r)}：いちばん硬い${nm(s.i)}でも${s.op.mv.n}で最大${pc(s.op.max)}（${dgKoTxt(s.op)}）`:qn(r)}),
    how:'相手のいちばん痛い技を半減以下にできるタイプ・特性の匹か、耐久に能力ポイントを回した匹を入れると、交代で受けられるようになります。'});
  const soleS={};R.forEach(r=>{const k=sw(r);if(k.length===1)(soleS[k[0].i]=soleS[k[0].i]||[]).push(r)});
  Object.entries(soleS).filter(([,rs])=>rs.length>=3).forEach(([i,rs])=>bad.push({area:'防御',sev:1,t:`後出しできるのが${nm(+i)}だけの相手が${rs.length}匹`,
    d:`${nm(+i)}のHPが減ると、これらの相手を交代で受けられなくなります。`,
    ev:list(rs,r=>{const z=x2(r,+i);return `${qn(r)}：${z.op?`${z.op.mv.n}で最大${pc(z.op.max)}`:'効く技がない'}`}),how:`同じ相手を受けられる2匹目がいると、${nm(+i)}の負担が減ります。`}));
  if(!noSw.length)good.push({area:'防御',t:`上位${N}匹すべてに、後出しできる匹がいる`,ev:[]});
  /* ---- 素早さ ---- */
  const faster=r=>r.res.filter(z=>z.spd===1);
  const slowAll=R.filter(r=>!faster(r).length);
  if(slowAll.length){const pr=r=>r.res.filter(z=>z.pr&&z.pr.min>0).sort((a,b)=>b.pr.min-a.pr.min)[0];
    const cov=slowAll.filter(r=>{const p=pr(r);return p&&p.pr.min>=100});
    bad.push({area:'素早さ',sev:Math.max(1,sevOf(slowAll)-(cov.length===slowAll.length?1:0)),t:`パーティのだれよりも速い相手が${slowAll.length}匹`,
      d:'素早さ（こだわりスカーフ・天気で速くなる特性・まひも入れて計算）で、だれも先に動けない相手です。'+(cov.length?`このうち${cov.length}匹は先制技で確定で倒せます。`:''),
      ev:list(slowAll,r=>{const f=[...r.res].sort((a,b)=>b.sa-a.sa)[0],p=pr(r);return `${qn(r)}（素早さ${f.so}）：いちばん速い${nm(f.i)}は${f.sa}${f.sa===f.so?'（同速）':''}${p?`。先制技：${nm(p.i)}の${p.pr.mv.n}で${pc(p.pr.min)}〜${pc(p.pr.max)}`:''}`}),
      how:'こだわりスカーフ・先制技・素早さに能力ポイントを回すなどで、上を取れる匹を作ります。'});
  }else good.push({area:'素早さ',t:`上位${N}匹すべてに、先に動ける匹がいる`,ev:[]});
  const soleF={};R.forEach(r=>{const k=faster(r);if(k.length===1)(soleF[k[0].i]=soleF[k[0].i]||[]).push(r)});
  Object.entries(soleF).filter(([,rs])=>rs.length>=4).forEach(([i,rs])=>bad.push({area:'素早さ',sev:1,t:`先に動けるのが${nm(+i)}だけの相手が${rs.length}匹`,
    d:`速さの役目が${nm(+i)}に集まっています。${nm(+i)}がいなくなると、これらの相手には全員が後から動くことになります。`,
    ev:list(rs,r=>{const z=x2(r,+i);return `${qn(r)}：${nm(+i)} ${z.sa} 対 ${z.so}`}),how:'2匹目の速い匹（またはスカーフ・先制技）を用意します。'}));
  /* ---- 役割：倒されると崩れる匹・攻撃役と受け役のバランス・役割の重なり ---- */
  const ans=r=>r.res.filter(z=>z.r>=3);
  const crit={};R.forEach(r=>{const a=ans(r);if(a.length===1)(crit[a[0].i]=crit[a[0].i]||[]).push(r)});
  Object.entries(crit).filter(([,rs])=>rs.length>=3).forEach(([i,rs])=>bad.push({area:'役割',sev:rs.some(top)?3:2,t:`${nm(+i)}が倒されると、対応できなくなる相手が${rs.length}匹`,
    d:`これらの相手に有利に戦える（受けて有利以上）のは${nm(+i)}だけです。${nm(+i)}が先に倒されると、パーティが崩れます。`,
    ev:list(rs,r=>{const z=x2(r,+i);return `${qn(r)}：${nm(+i)}が「${z.t}」（${z.why[0]||''}）`}),how:`同じ相手に有利に戦える2匹目を入れるか、${nm(+i)}を最後まで温存できる選出にします。`}));
  const atkN=T.ms.map((_,i)=>R.filter(r=>{const z=x2(r,i);return z&&z.k==='ko_fast'}).length);
  const defN=T.ms.map((_,i)=>R.filter(r=>{const z=x2(r,i);return z&&(z.k==='switch'||z.k==='wall')}).length);
  const atk=T.ms.map((_,i)=>i).filter(i=>atkN[i]>=Math.ceil(N*.25)),def=T.ms.map((_,i)=>i).filter(i=>defN[i]>=Math.ceil(N*.25));
  if(n>=3){
    if(!atk.length)bad.push({area:'役割',sev:2,t:'上から倒せる攻撃役がいない',d:`上位${N}匹の4分の1以上に「先に動いて倒しきれる」匹がいません。`,ev:T.ms.map((_,i)=>`${nm(i)}：上から倒せる相手 ${atkN[i]}匹`),how:'素早さと火力の高い匹、またはこだわりスカーフを持たせた匹を入れます。'});
    if(!def.length)bad.push({area:'役割',sev:2,t:'交代で受ける役がいない',d:`上位${N}匹の4分の1以上に「後出しできる・受けて有利」な匹がいません。`,ev:T.ms.map((_,i)=>`${nm(i)}：後出し・受けられる相手 ${defN[i]}匹`),how:'弱点の少ないタイプで、HPと防御・特防の高い匹を入れると、不利な対面から交代しやすくなります。'});
    if(atk.length&&def.length)good.push({area:'役割',t:`攻撃役（${atk.map(nm).join('・')}）と受け役（${def.map(nm).join('・')}）がいる`,ev:[...atk.map(i=>`${nm(i)}：上から倒せる相手 ${atkN[i]}匹`),...def.map(i=>`${nm(i)}：後出し・受けられる相手 ${defN[i]}匹`)]});
  }
  for(let a=0;a<n;a++)for(let b=a+1;b<n;b++){
    const sa=R.filter(r=>{const z=x2(r,a);return z&&z.r>=3}),sb=R.filter(r=>{const z=x2(r,b);return z&&z.r>=3});
    if(sa.length<3||sb.length<3)continue;const both=sa.filter(r=>sb.includes(r)).length;
    if(both/Math.min(sa.length,sb.length)>=.85)ref.push({area:'役割',t:`${nm(a)}と${nm(b)}は得意な相手がほとんど同じ`,d:`有利に戦える相手が${both}匹重なっています。片方が倒されても代わりになりますが、ほかの相手への備えが手薄なら、片方を入れかえる候補です。`,ev:[`${nm(a)}：${sa.length}匹／${nm(b)}：${sb.length}匹／重なり：${both}匹`]});
  }
  return{bad:bad.sort((x,y)=>y.sev-x.sev),good,ref};
}
/* パーティのチェックの「計算の前提」に足す文（未対応のこと） */
function dgPremise(T){
  return `相手は使用率の上位${T.rows.length}匹（${T.liveAll?'ランクバトルの集計から組んだ使用率の高い型':T.live?'集計が読めた相手は使用率の高い型、ほかは自動で決めた型':'自動で決めた型。ランクバトルの集計を読めていません'}）。`+
    `${FMT==='double'?'ダブルでも1対1で計算しています（範囲技の0.75倍・2匹同時の動き・味方のサポートは入れていません）。':''}`+
    `${T.unk.length?`計算に入っていない特性：${T.unk.slice(0,8).join('、')}${T.unk.length>8?' ほか':''}。`:''}${DG_NOTE}`;
}
