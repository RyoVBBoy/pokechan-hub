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
/* Shared bcalc does not implement every damage-related ability/item. Keep diagnosis and selection warnings aligned with the calculator's explicit unsupported lists. */
const dgCalcUnsupported=m=>{if(!m)return[];const out=[];
  if(m.ab&&((typeof CALC_UNIMPL!=='undefined'&&CALC_UNIMPL.includes(m.ab))||(typeof CALC_UNVERIFIED!=='undefined'&&CALC_UNVERIFIED[m.ab])||DG_SIMONLY.has(m.ab)))out.push(`特性「${ABN[m.ab]||m.ab}」`);
  if(m.item&&typeof CALC_UNIMPL_IT!=='undefined'&&CALC_UNIMPL_IT.includes(m.item))out.push(`持ち物「${(typeof ITEMN!=='undefined'&&ITEMN[m.item])||m.item}」`);
  /* 2026/11/24：登録した攻撃技のうち計算に入らない技（カウンター等）。その技のダメージは数えていない */
  if(m.item==='focusband')out.push('持ち物「きあいのハチマキ」（10%の確率で1残して耐える。診断の回数には入れていません）');
  if(m.uncalc&&m.uncalc.length)out.push(`技「${m.uncalc.join('・')}」（計算に入っていない攻撃技。この技のダメージは数えていません）`);
  return out};
/* トリックルームの計算をしているあいだだけ true（dgTeam0 が切りかえる） */
let DG_TR=false;
const DG_ROLLS=[85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100];
const DG_K={ko_fast:{r:5,t:'上から倒せる'},tank:{r:4,t:'耐えて倒せる'},switch:{r:4,t:'後出しできる'},wall:{r:3,t:'受けて有利に戦える'},
  shaky:{r:2,t:'勝てるが不安定'},cond:{r:2,t:'条件つき'},lose:{r:1,t:'対応できない'}};
const DG_NOTE='技の反動・自分のHPが減る効果、フィールド（エレキフィールド等）の威力の変化、追い風・ステルスロックなどの場の効果、やけど・まひ以外の状態異常、能力を下げる追加効果、急所は計算に入れていません。'+PROTEAN_ASSUME+'トリックルーム中の行動順は、条件が成立する場合に別途計算します。';
const DG_DOUBLE_SCOPE='ダブルは1対1の対面を組み合わせた暫定評価です。';
const DG_DOUBLE_LIMITS='範囲技も1匹に当たる場合のダメージで計算します。味方の巻き込み・支援、相手2匹の同時攻撃、まもるや技による行動妨害は評価していません。';
/* 1つの技のダメージ（最大HPに対する％）：乱数の最小・最大と、16段階のうち倒しきれる段階の数 */
/* 技の名前：特性で技のタイプが変わるとき（スカイスキン・フェアリースキン等、ウェザーボール）は、それを書く（2026/11/10 依頼主：
   メガボーマンダの すてみタックル がひこう技として計算されているのに、画面では ノーマル技に見えた） */
const dgMvName=(a,mv,d)=>{let tk=null;try{tk=typeof mvTurnK==='function'?mvTurnK(a,mv,d):null}catch(e){}const tt=tk==='charge'?'・ためるので1回に2ターン':tk==='recharge'?'・次のターンは動けない':'';
  try{const t=hitType(a,mv,d);if(t&&mv.t&&t!==mv.t)return `${mv.n}（${SKIN[a.ab]?(ABN[a.ab]||'特性')+'で':'天気で'}${t}技${tt}）`}catch(e){}return tt?`${mv.n}（${tt.slice(1)}）`:mv.n};
const dgAccLabel=x=>x.acc<100?`（命中${Math.round(x.acc)}%）`:'';
function dgMove(a,mv,d){
  /* 2026/11/24：ダメージ計算の画面と同じ部品（bhits・hitCountDist・hitDist・nextUse・useSeq）で数える。
     前は bcalc×回数で、トリプルアクセルの威力の上がり方・おやこあいの2発目・当たりごとの状態を入れていなかった（マニューラのトリプルアクセルが計算の画面の約半分）。
     当たる回数が変わる技は、こちらの「確定」は少ない回数（2〜5回なら2回）、相手の「最大」は多い回数（5回）で数える（前はどちらも3回）。
     min/max＝2回目からの使用（相手はHP満タンでない・使った持ち物・ランクの変化）、fmin/fmax＝1回目の使用。使うごとに変わるなら seqMin/seqMax（duTurns が足して数える） */
  const dg=d.disg;d.disg=false;
  try{
    const cd=hitCountDist(a,mv,d,{}),cs=cd.map(x=>x[0]),cMin=Math.min(...cs),cMax=Math.max(...cs);
    const cMain=cd.reduce((b,x)=>x[1]>b[1]+1e-9?x:b,cd[0])[0];
    const f=(r,c)=>bhits(a,mv,d,{r,nHits:c});
    const lo1=f(85,cMin),hi1=f(100,cMax);
    if(!lo1.total&&!hi1.total||!lo1.eff){const r0=bcalc(a,mv,d,{r:85});return{mv,min:0,max:0,eff:lo1.eff||r0.eff||0,h:cMain,acc:accOf(a,mv,d),ohko:0,absorb:r0.absorb||null}}
    const fixed=fixedDmg(a,mv,d)!=null;
    const u=nextUse(a,mv,d,{nHits:cMain});
    const g=(r,c)=>u.changed?bhits(u.a,mv,u.d,{r,nHits:c}).total:r===85&&c===cMin?lo1.total:r===100&&c===cMax?hi1.total:f(r,c).total;
    const P=v=>v/d.max*100;
    const fmin=P(lo1.total),fmax=P(hi1.total),min=P(g(85,cMin)),max=P(g(100,cMax));
    let seqMin=null,seqMax=null;if(u.changed){seqMin=useSeq(a,mv,d,85,{nHits:cMin});seqMax=useSeq(a,mv,d,100,{nHits:cMax})}
    /* 一撃で倒せる乱数の数（16段階に換算）：1回目の使用の分布（当たる回数の分布・当たりごとの乱数と状態）で HP 以上になる確率×16 */
    let ohko=0;if(fmax>=100){if(fixed)ohko=16;
      else if(lo1.n===1&&cd.length===1)ohko=DG_ROLLS.filter(r=>f(r,1).total>=d.max).length;
      else{let pk=0;for(const [c,w] of cd)for(const [v,q] of hitDist(a,mv,d,{nHits:c,cap:d.max}))if(v>=d.max)pk+=w*q;ohko=pk*16}}
    const half=DU_HALF_AB.includes(d.ab)&&!duIg(a);
    const hit1=[lo1.hits[0]?lo1.hits[0].dmg:0,hi1.hits[0]?hi1.hits[0].dmg:0],hitN=lo1.hits.length>1?[lo1.hits[1].dmg,hi1.hits[1].dmg]:null;
    return{mv,mvn:dgMvName(a,mv,d),min,max,eff:lo1.eff,h:cMain,hMin:cMin,hMax:cMax,acc:accOf(a,mv,d),ohko,fixed,half:half?d.ab:null,fmin,fmax,
      hit1,hitN,hpMax:d.max,seqMin,seqMax,nHit:lo1.n};
  }finally{d.disg=dg}
}
/* 最初の1回で倒せる確率。2発目以降の命中は、連続技の回数の分布に含まれる。 */
function dgKoOnUse(a,x,d){
  if(!x)return null;
  const acc=x.acc/100;
  const special=d.disg||d.hp!==d.max||d.item==='focussash'||d.item==='focusband'||d.ab==='sturdy';
  if(!special)return Math.min(1,x.ohko/16)*acc;
  if(!d.disg&&d.hp===d.max){
    if(x.fmax<100)return 0;
    if(x.nHit===1&&x.hMax===1){
      if(d.item==='focussash'||(d.ab==='sturdy'&&!duIg(a)))return 0;
      return Math.min(1,x.ohko/16)*acc*(d.item==='focusband'?.9:1);
    }
  }
  if(!d.disg){
    const hp=d.hp;
    let ko=0;
    for(const [count,weight] of hitCountDist(a,x.mv,d,{})){
      for(const [damage,probability] of hitDist(a,x.mv,d,{nHits:count,surv:true,cap:hp})){
        if(damage>=hp)ko+=probability*weight;
      }
    }
    return Math.min(1,ko)*acc*(d.item==='focusband'?.9:1);
  }
  const ko=koInfo(dmgRolls(a,x.mv,d,{noNext:true}),d.hp,1);
  return ko.n===1?ko.p*acc:0;
}
/* 初回の撃破判定は、タスキ・がんじょう・ばけのかわを当たりごとに処理する。 */
function dgTurns(a,x,d,upper=false){
  const {mv}=x,damage=upper?x.max:x.min,firstDamage=upper?x.fmax:x.fmin;
  const turns=duTurns(damage,{mv,acc:100,f:firstDamage,seq:upper?x.seqMax:x.seqMin},a,d);
  const survival=d.hp===d.max&&(d.item==='focussash'||(d.ab==='sturdy'&&a.ab!=='mold-breaker'));
  const multi=x.nHit>1||x.hMax>1;
  if(!d.disg&&!(survival&&multi&&firstDamage>=100))return turns;
  const first=bhits(a,mv,d,{r:upper?100:85,nHits:upper?x.hMax:x.hMin,surv:true});
  const kind=typeof mvTurnK==='function'?mvTurnK(a,mv,d):null;
  if(first.fainted)return kind==='charge'?2:1;
  return Math.max(turns,kind==='charge'?4:kind==='recharge'?3:2);
}
/* いちばん頼れる技：確定で倒せる回数が少ない順 → 最小ダメージ×命中の大きい順 */
function dgBest(a,d){
  let best=null;
  /* みらいよち・はめつのねがいは2ターン後に当たるので、1対1の撃ち合いには入れない */
  (a.moves||[]).forEach(mv=>{if(!mv||mv.prot||!(mv.pow>0||mv.fixed||fixedDmg(a,mv,d)!=null))return;if(['futuresight','doomdesire'].includes(mkey(mv))||!moveUsable(mv,{a,d}).ok)return;
    const x=dgMove(a,mv,d);if(!x.max)return;
    x.nMin=dgTurns(a,x,d);x.nMax=dgTurns(a,x,d,true);
    if(MFIRST.has(mkey(mv))&&x.nMin>1)return;
    x.turnKind=typeof mvTurnK==='function'?mvTurnK(a,mv,d):null;
    /* 同じ回数で倒せるなら、命中90以上の技を先に（2026/11/10：だいもんじ〔命中85〕を選んで「不安定」になっていた） */
    const key=[x.nMin,x.acc>=90?0:1,-(x.min*x.acc)];
    if(!best||key[0]<best.key[0]||(key[0]===best.key[0]&&(key[1]<best.key[1]||(key[1]===best.key[1]&&key[2]<best.key[2]))))best={...x,key}});
  return best;
}
/* 先制技で倒しきれるか（確定の回数） */
function dgPrio(a,d,afterSwitch){
  let best=null;
  for(const mv of a.moves||[]){
    if(!mv||mv.prot||!(mv.pow>0))continue;
    const pri=effPri(a,mv);
    if(pri<=0||!moveUsable(mv,{a,d,turn:afterSwitch?'later':undefined}).ok)continue;
    if(afterSwitch){
      const {ourPri,spd,previousMove}=afterSwitch;
      if(pri<ourPri||(pri===ourPri&&spd>0))continue;
      if(previousMove&&previousMove.id!==mv.id)continue;
      if(mkey(mv)==='upperhand'&&ourPri<=0)continue;
    }
    const x=dgMove(a,mv,d);
    const damage=afterSwitch?'max':'min';
    if(!best||x[damage]>best[damage])best=x;
  }
  return best;
}
const dgPct=v=>v>=999?'—':Math.round(v)+'%';
/* ダメージの書き方：マルチスケイル等で初撃が半分なら「初撃 a〜b%・2発目から c〜d%」 */
/* who＝特性を持つ（攻撃を受ける）側：'op' 相手／'me' こちら。マルチスケイル等は「受ける側がHP満タンのとき、受ける1発目だけ半分」（2026/11/10 依頼主：攻撃側の技と混同しない書き方に） */
const dgDmgTxt=(x,who)=>{if(!x)return '';const pc=v=>dgPct(v);
  /* 連続技とマルチスケイル（2026/11/10）：「技を使う回数」と「技が当たる回数」を分けて書く */
  if(x.half&&x.h>1&&x.hit1)return `1回目の使用で${pc(x.fmin)}〜${pc(x.fmax)}（1回で${x.h}回当たる合計：最初の当たり${pc(x.hit1[0]/x.hpMax*100)}〜${pc(x.hit1[1]/x.hpMax*100)}は${who==='me'?'こちら':'相手'}の${ABN[x.half]||'特性'}で半分、2回目の当たりからは1回${pc(x.hitN[0]/x.hpMax*100)}〜${pc(x.hitN[1]/x.hpMax*100)}で半分にならない）・2回目の使用から${pc(x.min)}〜${pc(x.max)}`;
  return x.half?`1発目${pc(x.fmin)}〜${pc(x.fmax)}（${who==='me'?'こちら':'相手'}の${ABN[x.half]||'特性'}でHP満タンのときは半分）・2発目から${pc(x.min)}〜${pc(x.max)}`:`${pc(x.min)}〜${pc(x.max)}`};
const dgHalfTxt=x=>x&&x.half?`（${ABN[x.half]||'特性'}で初撃は${dgPct(x.fmin)}〜${dgPct(x.fmax)}、2発目から${dgPct(x.min)}〜${dgPct(x.max)}）`:'';
const dgKoTxt=x=>{if(!x||!x.max)return '効く技がない';
  if(x.turnKind){
    const describe=n=>n>=9?'9ターン以上':`技${x.turnKind==='charge'?n/2:(n+1)/2}回・${n}ターン`;
    return x.nMin===x.nMax?describe(x.nMin):`最短 ${describe(x.nMax)}／乱数最小 ${describe(x.nMin)}`;
  }
  if(x.nMin===1)return '確定1発';
  if(x.nMax===1)return '1回で倒せる場合あり';
  if(x.nMin===x.nMax)return x.nMin>=9?'倒しきれない':`確定${x.nMin}発`;
  return `乱数${x.nMax}発（確定${x.nMin>=9?'なし':x.nMin+'発'}）`};
/* 1対1：a（こちら）と o（相手）。どちらの技も「確定（乱数最小）」と「最悪の場合（相手は乱数最大）」で見る */
/* 1対1の結果の使い回し（2026/11/24、改善案の計算を速くする）：DG_MEMO があるあいだ（dgImprove の中だけ）、同じ入力の1対1は計算し直さない。
   鍵は、こちら・相手の計算用の姿（実数値・技・特性・持ち物・ランク・HP 等をすべて文字にしたもの。p は図鑑番号）と、
   結果を変える場の状態（トリックルーム中・天気なしの計算・すでにある天気・パーティの天気・パーティにいる匹か）。入力が同じなら結果も同じなので、全部を計算し直したときと同じ答えになる
   （tests/impl-fixes-20261124b.mjs で、使い回しなしの結果と一致することを確かめる）。DG_MEMO_OFF で止められる */
let DG_MEMO=null,DG_MEMO_OFF=false;
const dgMonSig=m=>JSON.stringify(m,(k,v)=>k==='p'?(v&&v.no):v);
function dgMatch(a,o){
  if(!DG_MEMO||DG_MEMO_OFF)return withWx(a,o,()=>dgMatch0(a,o));
  let k;try{let tw=null;try{tw=appliedTeamWx()}catch(e){}
    k=dgMonSig(a)+'|'+dgMonSig(o)+'|'+JSON.stringify([DG_TR,typeof WX_OFF!=='undefined'&&WX_OFF,FMT,B.weather||null,tw,AS_WX,inTeam(a),inTeam(o),LIVE.csv[o.p.base||o.p.no]?.mv])}catch(e){return withWx(a,o,()=>dgMatch0(a,o))}
  if(DG_MEMO.has(k))return DG_MEMO.get(k);
  const v=withWx(a,o,()=>dgMatch0(a,o));DG_MEMO.set(k,v);return v}
function dgMatch0(a,o){
  const me=dgBest(a,o),op=dgBest(o,a);
  /* トリックルーム中（DG_TR）は遅い方が先に動く（先制技はトリックルームでも先） */
  const weather=wxEffK(a,o),tr=DG_TR,sa=effSpd(a,o),so=effSpd(o,a),spd=tr?(sa<so?1:sa>so?-1:0):(sa>so?1:sa<so?-1:0);
  const upTxt=tr?`トリックルーム中は遅い方が先に動く（${sa} 対 ${so}）`:`素早さで上を取れる（${sa} 対 ${so}）`;
  const myN=me?me.nMin:9,myNb=me?me.nMax:9,acc=me?me.acc:100;
  /* 相手の攻撃は乱数最大（こちらにとって最悪）で数える */
  const opW=op?op.nMax:9,opB=op?op.nMin:9;
  const pr=dgPrio(a,o),opPr=dgPrio(o,a);
  const prKO=pr&&dgTurns(a,pr,o)===1;
  /* 先に倒しきれるか：こちらが先に動けるなら myN<=opW、遅ければ myN<opW。先制技のとどめ・相手の先制技も見る */
  const finPr=(n,x,p)=>!x.turnKind&&p&&p.min>0&&(n===1||!MFIRST.has(mkey(p.mv)))&&(n-1)*x.min+p.min>=100;
  let first=spd;
  if(first<=0&&me&&finPr(myN,me,pr)&&!(op&&finPr(opW,op,opPr)))first=1;
  if(first>=0&&op&&finPr(opW,op,opPr)&&!(me&&finPr(myN,me,pr)))first=-1;
  const winSafe0=myN<9&&(first===1?myN<=opW:myN<opW);
  /* こちらのきあいのタスキ・がんじょうで1回耐えるおかげで勝てるだけなら「条件つき」にする */
  const opRaw=op?dgTurns(o,op,{...a,item:a.item==='focussash'?null:a.item,ab:a.ab==='sturdy'?'':a.ab},true):9;
  const winSafe=myN<9&&(first===1?myN<=opRaw:myN<opRaw);
  const sashOnly=winSafe0&&!winSafe;
  const winTie=myN<9&&first===0&&myN<=opW;
  const winBest=myNb<9&&(first>=0?myNb<=opB:myNb<opB);
  const sash=o.item==='focussash'||o.ab==='sturdy',mySash=a.item==='focussash'||a.ab==='sturdy';
  /* 交代で出ると1回ぶん多く受ける */
  /* 9は打ち切り値。相手が9以上でも、こちらが先に倒し切れる根拠が必要。 */
  const swBefore=n=>first===1?n<=opW-1:n<opW-1;
  const swCharge=op?.turnKind==='charge';
  const swOnHit=!swCharge&&myN<9&&(op?opW>=2&&swBefore(myN):!o.uncalc?.length);
  // 命中前提の手数ぎりぎりなら、1回の外しで崩れるので安定した交代先に数えない。
  const swAccRisk=!!op&&swOnHit&&me.acc<100&&!swBefore(myN+1);
  // 交代時に受ける攻撃と、その直後の先制技は別の技になり得る。
  let swPriority=null;
  if(swOnHit&&op?.fmax>0&&op.fmax<100&&opPr?.max>0){
    const hpAfter=Math.max(1,Math.round(a.max*(100-op.fmax)/100));
    const after=a.ab==='gale-wings'?{...a,hp:hpAfter}:a;
    const previousMove=['choiceband','choicespecs','choicescarf'].includes(o.item)?op.mv:null;
    const reply=dgPrio(o,a,{ourPri:effPri(after,me.mv),spd,previousMove});
    if(reply&&Math.round(reply.max*a.max/100)>=hpAfter)swPriority=reply;
  }
  const swOk=swOnHit&&!swAccRisk&&!swPriority;
  const resist=op&&op.eff<=.5;
  /* 素早さの関係は3つに分けて書く（2026/11/10 依頼主：同速を「上を取れる」と言わない） */
  const spdTxt=spd===1?`${upTxt}`:spd===0?`同速（${sa} 対 ${so}。どちらが先に動くかは五分）`:tr?`トリックルーム中でも相手が先（${sa} 対 ${so}。相手の方が遅い）`:`素早さで下になる（${sa} 対 ${so}）`;
  /* 後出し（2026/11/10 依頼主の検証）：交代で受ける1発目と、そのあとの撃ち合いを分ける。
     win＝1発目を耐え、そこから撃ち合っても先に倒せる／survive＝1発目は耐えるが撃ち合いでは負ける（受けてまた交代する役）／no＝1発目で倒される */
  /* 2026/11/10 依頼主の検証⑤：1発目を耐えるのがきあいのタスキ・がんじょうのおかげだけなら「タスキ頼み」＝後出しできるに数えない（1回きりで、砂嵐・連続技・設置技で崩れる） */
  const swSash=!swCharge&&!!op&&opW>=2&&opW<9&&opRaw<2;
  /* 2026/11/10 依頼主の確認①：タスキでHP1で耐えたあと、先に動いて一撃で倒せるなら「条件つきで後出しできる」（sashwin）。
     かるわざなら、タスキがなくなって素早さ2倍。相手の先制技・砂嵐（いわ・じめん・はがね以外）・連続技（タスキが効かない＝opW 1）では崩れる */
  const ub=a.ab==='unburden'&&a.item==='focussash',sa2=ub?sa*2:sa,fast2=tr?sa2<so:sa2>so,fast1=tr?sa<so:sa>so;
  /* 2026/11/10 依頼主の確認：条件つき後出し（sashwin）は「確実に」成り立つときだけ。
     ①交代時はHP満タン（前提）②1発目は相手の乱数最小でも100%以上＝きあいのタスキが必ず発動してHP1（最大だけ100%以上なら、発動しないことがある）
     ③かるわざが要るなら、タスキが必ず発動するときだけ素早さ2倍（同速は不可）④こちらの乱数最小で確定1発（相手のタスキ・がんじょう・マルチスケイルも入れた回数）
     ⑤成り立たない：相手の連続技（どれか1つでも持っていればタスキが効かない）・ダメージを与える先制技・砂嵐（いわ・じめん・はがね以外）・設置技（集計で10%以上使う）・接触で反動を返す特性や持ち物 */
  const sandChip=!!(weather==='sand'&&!a.p.t.some(x=>['いわ','じめん','はがね'].includes(x)));
  const opPrHit=!!(opPr&&opPr.max>0);
  const multiMv=(o.moves||[]).find(m=>m&&m.maxH>1&&(()=>{try{return bcalc(o,m,a,{r:100}).dmg>0}catch(e){return false}})());
  /* さめはだ・てつのトゲ・ゴツゴツメットは、こちらの技が実際に接触するときだけ（えんかく・マジックガードなら受けない。2026/11/24：前は接触しない技でも危ないとしていた） */
  const cntRisk=(['rough-skin','iron-barbs'].includes(o.ab)||o.item==='rockyhelmet')&&!!me&&!!me.mv&&mfl(me.mv,'c')&&a.ab!=='long-reach'&&a.ab!=='magic-guard';
  const hzMv=(()=>{const d=LIVE.csv[o.p.base||o.p.no];if(!d||!d.mv)return null;const h=d.mv.find(([n,pc])=>{const id=MVKA[nrm(n)];return pc>=10&&(id===446||id===191||(id===390&&!a.p.t.some(x=>['どく','はがね'].includes(x))))});return h?mName(MVKA[nrm(h[0])]):null})();
  const sashSure=!!op&&op.fmin>=100,needUb=ub&&!fast1&&fast2;
  /* タスキが発動しなくても先に動けるなら、最小で100%未満でも同じ結果（HPが残るか1か）。かるわざが要るときは発動が確実なことが必要 */
  const spdOk=fast1||(needUb&&sashSure);
  const sashBlock=!me||me.nMin!==1?'nokill':me.acc<90?'acc':!fast2?'slow':!spdOk?'unsure':multiMv?'multi':opPrHit?'prio':sandChip?'sand':hzMv?'hazard':cntRisk?'contact':'';
  const sashWin=swSash&&!sashBlock;
  const sashWhy=`①交代で受ける1発目：${op?`${op.mvn}で${dgPct(op.fmin)}〜${dgPct(op.fmax)}`:''}${sashSure?'（乱数がいちばん低くても100%以上なので、きあいのタスキが必ず発動してHP1で耐える）':'（乱数が低いとタスキは発動せずHPが少し残る。どちらでも耐える）'}②素早さ：${needUb?`タスキがなくなってかるわざが発動し ${sa}→${sa2}、相手の${so}より確実に先`:`${sa} 対 ${so}でもともと先`}③${me?`${me.mvn}は乱数がいちばん低くても${dgPct(me.fmin)}で確定1発（相手のタスキ・がんじょう・マルチスケイルも入れて計算）`:''}`;
  const sashCond=`前提：交代時にHP満タン（それまでにダメージを受けていない）・相手がいちばん痛い技（${op?op.mvn:''}）を使う。確かめたこと：この相手の型に連続技・先制技はなく、砂嵐にもならず、接触で反動を返す特性・持ち物もない${LIVE.csv[o.p.base||o.p.no]?'。ランクバトルで設置技をよく使う相手でもない':''}。それでも成り立たないとき：ほかの相手のステルスロックなどの設置技でHPが減っている／相手が積み技で素早さを上げている`;
  const blockTxt={nokill:'そのあと一撃で倒せない',acc:'倒す技の命中が不安定',slow:`${ub?'かるわざで素早さ2倍にしても':''}先に動けない（${sa2} 対 ${so}）`,unsure:`相手の1発目が乱数しだいで100%未満（${op?dgPct(op.fmin):''}〜）になり、タスキが発動しないことがある。そのときはかるわざも発動せず、素早さ ${sa} 対 ${so}で先に動けない`,
    multi:`相手が連続技（${multiMv?mName(multiMv.id):''}）を持っていて、タスキが効かない`,prio:`HP1になったあと、相手の先制技（${opPr?opPr.mvn:''}）で倒される`,sand:'砂嵐のダメージでHP1から倒れる',hazard:`相手が設置技（${hzMv}）をよく使い、出てきたときにHPが減ってタスキが効かない`,contact:`相手の${o.item==='rockyhelmet'?'ゴツゴツメット':ABN[o.ab]}で、接触技で倒したときに反動でこちらも倒れる`}[sashBlock]||'';
  const swIn=swCharge?'unproven':opW<2?'no':swSash?(sashWin?'sashwin':'sash'):swOk?'win':swAccRisk||swPriority||!op||opW>=9?'unproven':'survive';
  const swLeft=op?Math.max(0,100-op.fmax):100;
  const swTxt=!op?(swIn==='win'
    ?`計算した相手の技ではダメージを受けず、こちらの${me.mvn}${dgAccLabel(me)}で倒せる（${dgKoTxt(me)}）`
    :`計算した相手の技によるダメージはないが、${o.uncalc?.length?'相手に計算できない攻撃技があるため':!me?'こちらも効く技がないため':'こちらが倒し切るまでの回数が計算範囲を超えるため'}、交代後の勝ちは判定できない`)
    :swCharge?`相手の${op.mv.n}はためる必要があります。交代時にためが済んでいるかで結果が変わるため、後出しは判定保留です。`
    :opW<2?`交代で受ける1発目（${op.mvn} 最大${dgPct(op.fmax)}）で倒される`
    :swSash&&sashWin?`条件つきで後出しして勝てる：${sashWhy}。 ${sashCond}`
    :swSash?`交代で受ける1発目：${op.mvn}で${dgPct(op.fmin)}〜${dgPct(op.fmax)}。 ${a.item==='focussash'?'きあいのタスキ':'がんじょう'}で耐えても、${blockTxt}ので、後出しできるとは数えない`
    :`交代で受ける1発目：${op.mvn}で最大${dgPct(op.fmax)}（残りHPは少なくとも${Math.round(swLeft)}%）→ ${swIn==='win'?`そのあと、こちらの${me.mvn}${dgAccLabel(me)}で先に倒せる（${dgKoTxt(me)}）`:swPriority?`相手の先制技「${swPriority.mvn}」で、こちらが動く前に倒される可能性がある`:swAccRisk?`${me.mvn}${dgAccLabel(me)}が1回外れると、計算上は先に倒し切れない`:swIn==='unproven'?'そのあとの撃ち合いで先に倒せる根拠が足りない':'そのあとの撃ち合いでは先に倒される'}`;
  let k='lose',why=[];
  const wxT=weather&&B.weather.team?`${{sun:'晴れ',rain:'雨',sand:'砂嵐',snow:'雪'}[B.weather.k]}の中で計算（パーティの${B.weather.team.by}の${ABN[B.weather.team.ab]||'特性'}で${{sun:'晴れ',rain:'雨',sand:'砂嵐',snow:'雪'}[B.weather.k]}にしてから戦う前提）`:'';
  const meTxt=me?`${me.mvn}で${dgDmgTxt(me,'op')}（${dgKoTxt(me)}）`:'効く技がない';
  const opTxt=op?`相手の${op.mvn}で${dgDmgTxt(op,'me')}（${dgKoTxt(op)}）`:'相手に効く技がない';
  if((first===1&&winSafe)||prKO){k='ko_fast';
    if(prKO&&!(first===1&&winSafe))why.push(`${spd===0?'同速だが':'遅いが'}先制技の${pr.mvn}で${dgDmgTxt(pr,'op')}（確定1発）`);
    else if(me.turnKind&&myN>1)why.push(`${meTxt}。相手が動けるターンを含めて比較しています`);
    else if(spd===1)why.push(myN===1?`${upTxt}。${meTxt}＝先に動いて確定で一撃`:`${upTxt}が、一撃で倒せるとは限らない：${meTxt}。一撃にならなくても、相手の反撃を耐えて${myN}発目で先に倒しきれる`);
    else why.push(`${spd===0?'同速だが':'遅いが'}、最後のとどめを先制技の${pr.mvn}で先に入れられる。${meTxt}`);
    why.push(myN===1&&spd===1?'相手は動く前に倒れる':`相手の反撃：${opTxt.replace(/^相手の/,'')}`)}
  else if(winSafe&&swOk){k='switch';why.push(swTxt,`こちら：${meTxt}`)}
  else if(winSafe){k=resist&&opW>=3?'wall':'tank';why.push(`最大の乱数でも先に倒れない：${opTxt}`,`こちら：${meTxt}`)}
  else if(resist&&opW>=4&&myN<=4){k='wall';why.push(`相手のいちばん痛い技も半減以下：${opTxt}`,`こちら：${meTxt}`)}
  else if(ub&&!tr&&spd<0&&op&&opW===2&&opRaw===1&&op.fmin>=100&&myN<=2&&me.acc>=90&&sa2>so&&!opPrHit&&!sandChip&&!multiMv&&!cntRisk){k='cond';why.push(`相手が先に動くが、${sashWhy}、そのあと先に動いて${myN}発目で倒せる`,`こちら：${meTxt}`,opTxt,sashCond)}
  else if(sashOnly){k='cond';why.push(`${a.item==='focussash'?'きあいのタスキ':'がんじょう'}で1回耐えてから`,`こちら：${meTxt}`,opTxt)}
  else if(winTie||winBest){k='shaky';why.push(winTie?'同じ速さ（どちらが先に動くかは五分）':'乱数が高く出れば勝てる',`こちら：${meTxt}`,opTxt)}
  else{
    let up=null;try{const d=duel(a,o);if(d.up&&d.s>=1)up=d.up}catch(e){}
    if(up){k='cond';why.push(`${up}を1回使ってから戦えば勝てる`,`こちら：${meTxt}`,opTxt)}
    else{k='lose';why.push(`こちら：${meTxt}`,opTxt)}}
  /* 命中：90%未満の技に頼る勝ちは「不安定」に下げる（90%以上は注意書きだけ） */
  if(me&&me.acc<100&&DG_K[k].r>=3&&!(k==='ko_fast'&&prKO)){if(me.acc<90){k='shaky';why.unshift(`${me.mvn}の命中が${Math.round(me.acc)}%なので外れると負ける`)}else why.push(`${me.mvn}の命中は${Math.round(me.acc)}%`)}
  if(spd===0&&!why.some(w=>/同速/.test(w)))why.push(spdTxt);
  if(wxT)why.push(wxT);
  const weatherSuppressed=!!B.weather&&!weather;
  if(weatherSuppressed)why.push('天気を無効にする特性が場にいるため、天気の効果なしで計算しています。');
  if(me&&me.half)why.push(me.h>1?`相手の${ABN[me.half]||'特性'}：相手のHPが満タンのとき、こちらの${me.mvn}（1回で${me.h}回当たる）は最初の当たりだけ半分、2回目の当たりからは半分にならない（1回目と2回目の当たりを乱数ごとに別々に計算して足し、倒すまでの回数を数えています）`:`相手の${ABN[me.half]||'特性'}：相手のHPが満タンのとき、こちらの攻撃の1発目だけダメージが半分になる（倒すまでの回数はこれを入れて数えています）`);
  if(op&&op.half)why.push(`こちらの${ABN[op.half]||'特性'}：こちらのHPが満タンのとき、相手の攻撃の1発目だけダメージが半分になる`);
  if(sash&&me&&me.max>=100)why.push(`相手は${o.item==='focussash'?'きあいのタスキ':'がんじょう'}なので満タンからは一撃で倒せない（計算に入れています）`);
  /* 見出し：上から一撃（確定）と、上から2発以上で倒しきる を分ける */
  /* 2026/11/10：遅い（同速）のに先制技のとどめで先に倒しきれるときは「上から」と書かない */
  const t=k==='ko_fast'?(prKO&&!(first===1&&winSafe)?'先制技で倒せる':me.turnKind&&myN>1?`${myN}ターンで倒し切る見込み`:spd!==1&&!tr?`先制技のとどめで${myN}発で倒しきれる`:myN===1?'上から一撃（確定）':`上から${myN}発で倒しきれる`):DG_K[k].t;
  return{k,r:DG_K[k].r,t:tr&&k==='ko_fast'?t.replace(/^上から/,'トリル中に先に動いて'):t,why,tr,wxTeam:!!wxT,weatherSuppressed,me,op,koOnUse:dgKoOnUse(a,me,o),spd,first,sa,so,myN,opW,pr,spdTxt,swIn,swTxt,swLeft,sa2,sashBlock,sashSure};
}
/* ===================== 診断の準備（2026/11/12 依頼主：同じパーティなのに「総合評価」が開くたびに変わる） =====================
   原因：①使用率の集計・各ポケモンの集計・上位パーティのデータが届く前に、手元のデータ（なければ種族値の上位）で計算して出していた
   ②一時的に読めなかった匹を「集計なし」として黙って計算していた ③前の計算を使い回す鍵がデータの件数だけで、中身の違いを見ていなかった。
   そこで、診断に使うデータ（使用率の集計＝相手の候補・パーティと相手と入れかえ候補の匹の集計・上位パーティ）がそろうまで計算しない。
   読めなかったときは何が読めなかったかを出し、「もう一度読み込む」か、自分で選んだときだけ「読めたデータだけ（集計なし）」で計算する（結果にその旨を出す）。
   判定の基準・重みは変えない。テスト（navigator.webdriver）は、window.__DG_STRICT を付けたときだけこの準備を通す（ほかのテストは前と同じ） */
const DGD={st:'idle',tok:0,p:null,fails:[],allow:null};
const dgStrict=()=>!(typeof navigator!=='undefined'&&navigator.webdriver)||(typeof window!=='undefined'&&!!window.__DG_STRICT);
const dgTopNeed=()=>typeof topLoad==='function'&&typeof location!=='undefined'&&location.protocol!=='file:';
/* 診断で集計を使う匹：パーティ・相手の候補（使用率の上位40）・入れかえ候補（種族値の上位）と、そのメガシンカ前の姿 */
function dgReqNos(entries){
  const s=new Set(),add=p=>{if(!p)return;s.add(p.no);if(p.base)s.add(p.base)};
  entries.forEach(x=>add(byNo[x.no]));metaOpps(40).forEach(add);if(typeof gmOpps==='function')gmOpps().forEach(add);
  return [...s].filter(n=>ENSP[n]).sort((a,b)=>a-b);
}
/* いま診断できるか（同期）：'ready'（そろっている）・'off'（集計なしで計算すると利用者が選んだ）・'partial'（読めたものだけで計算すると選んだ）・'loading'・'error' */
function dgState(entries){
  if(!dgStrict())return 'ready';
  if(DGD.allow==='off'&&LIVE.st==='fail')return 'off';
  if(LIVE.st==='fail'||(typeof META!=='undefined'&&META.st==='fail'))return DGD.allow==='off'?'off':'error';
  if(LIVE.st!=='ready'||typeof META==='undefined'||META.st!=='ready')return DGD.st==='error'?'error':'loading';
  if(dgTopNeed()&&!(TOPT.fmt===FMT&&(TOPT.st==='ok'||TOPT.st==='err')))return 'loading';
  const nos=dgReqNos(entries);
  if(nos.some(n=>LIVE.csv[n]===undefined))return DGD.st==='error'?'error':'loading';
  const bad=nos.some(n=>LIVE.err[n])||(META.errs>0)||(dgTopNeed()&&TOPT.st==='err');
  if(bad)return DGD.allow==='partial'?'partial':'error';
  return 'ready';
}
/* 読めなかったもの（表示用） */
function dgFails(){const f=[];
  if(LIVE.st==='fail')f.push('ランクバトルの使用率の集計（つながりませんでした）');
  else if(typeof META!=='undefined'&&META.st==='fail')f.push('使用率の上位のポケモン');
  const e=Object.keys(LIVE.err).map(Number).filter(n=>byNo[n]);if(e.length)f.push(`ポケモンごとの集計（${e.slice(0,4).map(n=>byNo[n].n).join('・')}${e.length>4?` ほか${e.length-4}匹`:''}）`);
  if(dgTopNeed()&&TOPT.st==='err')f.push('上位パーティのデータ');return f}
/* データを読む（読む順番に関係なく、全部そろってから done を呼ぶ）。読んでいる途中にまた呼ばれたら、読み直さずに done だけ新しいものに替える
   （終わったら最後に頼まれた done を1回だけ呼ぶ＝古い画面の描き直しはしない。描き直す側も、そのときのパーティで dgState を見直す） */
async function dgPrepare(entries,done){
  DGD.cb=done||null;if(DGD.run)return;
  DGD.run=true;const tok=++DGD.tok;DGD.st='loading';
  const fin=st=>{DGD.run=false;if(tok!==DGD.tok)return;DGD.st=st;const cb=DGD.cb;DGD.cb=null;if(cb)cb(st)};
  try{
    if(!(await liveInit()))return fin('error');
    if(!(await metaLoad()))return fin('error');
    if(dgTopNeed()&&!(TOPT.fmt===FMT&&(TOPT.st==='ok'||TOPT.st==='err'))){
      const t0=Date.now();try{await topLoad()}catch(e){}
      while(TOPT.st==='busy'&&Date.now()-t0<20e3)await new Promise(r=>setTimeout(r,200));
      if(TOPT.st==='busy')TOPT.st='err';}
    const nos=dgReqNos(entries).filter(n=>LIVE.csv[n]===undefined);
    for(let i=0;i<nos.length;i+=8)await Promise.all(nos.slice(i,i+8).map(liveMon));
    /* 読み終わっても足りない（読む途中で相手の候補が変わった等）なら、もう一度だけ読みにいく。3回続いたら読めなかったことにする（読み続けない） */
    const s2=dgState(entries);if(s2==='ready'){DGD.loops=0;fin('ready')}else if(s2==='loading'&&(DGD.loops=(DGD.loops||0)+1)<=3)fin('loading');else{DGD.loops=0;fin('error')}
  }catch(e){fin('error')}
}
/* もう一度読み込む：読めなかった匹だけ読み直す（読めた分はそのまま） */
function dgRetry(){
  Object.keys(LIVE.err).forEach(n=>{delete LIVE.csv[n];delete LIVE.err[n]});
  if(LIVE.st==='fail'){LIVE.st='idle'}
  if(typeof META!=='undefined'&&(META.st==='fail'||META.errs>0)){META.st='idle';META.p=null;META.errs=0}
  if(typeof TOPT!=='undefined'&&TOPT.st==='err'){TOPT.st='idle';TOPT.at=0}
  DGD.allow=null;DGD.st='idle';
}
/* 読み込み中・読めなかったときの表示（評価は出さない） */
function dgWaitHTML(st){
  if(st==='loading')return `<div class="dgw" role="status" aria-live="polite"><span class="dgw-sp" aria-hidden="true"></span><b>診断に必要なデータを読み込んでいます…</b><p>使用率の集計・相手のポケモンの型・上位パーティのデータがそろってから計算します（途中のデータで計算した結果は出しません）。</p></div>`;
  const f=dgFails(),offOnly=LIVE.st==='fail';
  return `<div class="dgw dgw-err" role="alert"><b>診断に必要なデータを読み込めませんでした</b><p>読めなかったもの：${f.length?f.map(esc).join('、'):'通信'}。<br>そろっていないデータで計算すると、結果がいつもと違ってしまうため、まだ評価を出していません。</p>
    <div class="dgw-b"><button class="btn btn-p" data-dg-retry>もう一度読み込む</button><button class="btn btn-s" data-dg-allow="${offOnly?'off':'partial'}">${offOnly?'集計なしで診断する':'読めたデータだけで診断する'}</button></div>
    <p class="dgw-n">${offOnly?'集計なし＝相手は合計種族値の上位、型は自動で決めた型で計算します。':'読めなかった匹は、自動で決めた型で計算します。'}結果の上にその旨を表示します。</p></div>`;
}
/* 結果の上に出す注意（読めたデータだけ・集計なしで計算したとき） */
function dgModeNote(st){return st==='off'?'<p class="dgw-note">ランクバトルの集計を読み込めなかったため、<b>集計なし</b>（相手は合計種族値の上位・自動で決めた型）で計算した結果です。<button class="dgu-link" data-dg-retry>もう一度読み込む</button></p>'
  :st==='partial'?`<p class="dgw-note">一部のデータ（${dgFails().map(esc).join('、')}）を読めなかったため、<b>読めたデータだけ</b>で計算した結果です。<button class="dgu-link" data-dg-retry>もう一度読み込む</button></p>`:''}
/* ボタン：もう一度読み込む・読めたデータだけで計算する。押したら描き直す */
function dgWaitBind(root,redraw){if(!root)return;
  root.querySelectorAll('[data-dg-retry]').forEach(b=>b.onclick=()=>{dgRetry();redraw()});
  root.querySelectorAll('[data-dg-allow]').forEach(b=>b.onclick=()=>{DGD.allow=b.dataset.dgAllow;redraw()})}
/* 診断に使ったデータの中身（使い回しの鍵）：形式・相手の候補の並び・集計のある匹・上位パーティ・計算の方法 */
function dgDataSig(){
  const rk=typeof META!=='undefined'&&META.rank?META.rank.map(x=>x.no).join('.'):'';
  const csv=Object.entries(LIVE.csv).filter(([,row])=>row);
  const tp=typeof TOPT!=='undefined'&&typeof topReady==='function'&&topReady()?TOPT.at+':'+TOPT.n:'0';
  return JSON.stringify([FMT,rk,csv,tp,'m'+dgMegaSel(),DGD.allow,B.weather||null]);
}
/* ---- メガシンカは1回の対戦で1匹だけ（2026/11/14 依頼主の判断：診断は「選んだメガだけを見せる」） ----
   メガストーンを持つ匹が2匹以上いれば、1匹だけをメガの姿で計算し、ほかはメガ石を持ったまま通常の姿で計算する（同時に2匹をメガの姿で数えない）。
   どの匹にするかは利用者が選べる（DGM.sel、パーティの枠ごと・localStorage pcdgmega）。選んでいなければ自動＝メガの匹ごとに計算して、
   答えがない相手（×）→△以下→後出しできない相手→半分以上を一撃→◎の多さ→並び順 でいちばん良いもの */
const DGM={sel:(()=>{try{return JSON.parse(localStorage.getItem('pcdgmega')||'{}')||{}}catch(e){return{}}})()};
const dgMegaSlot=()=>typeof TEAMS!=='undefined'&&TEAMS&&TEAMS.cur!=null?String(TEAMS.cur):'0';
function dgMegaSel(){const v=DGM.sel[dgMegaSlot()];return v?+v:0}
function dgMegaSet(no){if(no)DGM.sel[dgMegaSlot()]=+no;else delete DGM.sel[dgMegaSlot()];try{localStorage.setItem('pcdgmega',JSON.stringify(DGM.sel))}catch(e){}}
const dgCalcSet=o=>(o.x.set&&!team.includes(o.x)&&savedToCalc(o.x.no,o.x.set))||mySetFor(o.x.no);
const dgStoneOf=(no,cs)=>cs&&cs.item&&isStone(cs.item)&&megaOf(no,cs.item)?cs.item:null;
/* パーティ（entries）× 相手（metaOpps）の表。相手の型は使用率の高い型（detSet）。集計の有無も返す */
/* 同じパーティ・形式・集計の読み込み状況なら、計算を使い回す（パーティのチェックと「相手ごとの対応力」で同じ結果を使う） */
const DG_CACHE={};
function dgTeam(entries,n){
  n=n||20;
  const key=JSON.stringify([n,dgDataSig(),entries.map(x=>[x.no,x.set||0])]);
  if(DG_CACHE.k===key)return DG_CACHE.v;
  const v=impWith(entries,()=>dgTeam0(entries,n));DG_CACHE.k=key;DG_CACHE.v=v;return v;
}
/* 変更前（T0）と比べるときのメガシンカ（2026/11/24）：メガストーンを持つ匹（計算に使う育成で）が変わらないなら、変更前と同じ匹をメガシンカさせる。
   増えた・減った・持ちかえたなら、変更後のパーティの実際の条件（利用者の選び→自動でいちばん良いメガ）。entries を計算するとき（impWith の中）に呼ぶ */
function dgMegaHolders(entries){return entries.map(x=>{const p=byNo[x.no];if(!p)return null;let cs=null;try{cs=dgCalcSet({x,p})}catch(e){}const k=dgStoneOf(x.no,cs);return k?x.no+':'+k:null}).filter(Boolean).sort().join(',')}
function dgMegaOpt(T0,entries){const M=T0&&T0.mega;if(!M||!M.no)return{};
  const h0=(M.holders||[]).map(h=>h.no+':'+h.stone).sort().join(',');
  return dgMegaHolders(entries)===h0?{megaNo:M.no}:{}}
/* opt.megaNo＝メガシンカさせる匹の番号（変更前と同じメガのまま比べるとき）。無ければ利用者の選び→自動 */
function dgTeam0(entries,n,opt){
  opt=opt||{};
  const ms=entries.map(x=>({x,p:byNo[x.no]})).filter(o=>o.p);
  /* 入れかえ案の匹は、その匹のために組んだ育成（x.set）で計算する（パーティにいない匹は teamSet で引けないため） */
  const CS=ms.map(o=>{try{return dgCalcSet(o)}catch(e){return null}});
  const H=ms.map((o,i)=>dgStoneOf(o.x.no,CS[i])?i:-1).filter(i=>i>=0);
  const evaluate=(i,mode)=>dgTeam1(n,ms,CS,i,H,mode,opt.opponents);
  if(opt.noMega)return evaluate(-1,'none');
  if(H.length<2)return evaluate(H.length?H[0]:-1,'one');
  const pick=no=>no?H.find(i=>ms[i].x.no===+no):undefined;
  let wi=pick(opt.megaNo),mode='fixed';
  if(wi==null){wi=pick(dgMegaSel());mode='user'}
  if(wi!=null)return evaluate(wi,mode);
  const all=H.map(i=>evaluate(i,'auto'));
  const key=T=>{const m=dgMetric(T);return [m.x,m.w,m.nosw,m.ohko,-T.rows.filter(r=>r.lvl===4).length]};
  const cmp=(a,b)=>{const x=key(a),y=key(b);for(let k=0;k<x.length;k++)if(x[k]!==y[k])return x[k]-y[k];return 0};
  const best=[...all].sort(cmp)[0];
  best.mega.alts=all.map(T=>{const m=dgMetric(T);return{i:T.mega.i,no:T.mega.no,x:m.x,w:m.w,nosw:m.nosw,ohko:m.ohko,st:T.rows.filter(r=>r.lvl===4).length}});
  return best;
}
function dgTeam1(n,ms,CS,mi,H,mode,opponents){
  /* メガストーンの匹が2匹以上なら、天気（パーティの天気を作る特性）もこの場合のメガシンカだけで決める */
  if(!H.length||(H.length<2&&mi>=0))return dgTeam2(n,ms,CS,mi,H,mode,opponents);
  const wm=WX_MEGA;WX_MEGA=mi>=0?ms[mi].x.no:null;try{return dgTeam2(n,ms,CS,mi,H,mode,opponents)}finally{WX_MEGA=wm}
}
const dgLevel=rs=>{const stable=rs.filter(r=>r.r>=4).length;return stable>=2?4:stable===1?3:rs.some(r=>r.r>=2)?2:1};
function dgOpponentChoice(variants,indices){
  if(variants.length===1&&!indices)return {...variants[0],abAssume:null};
  const choices=indices?variants.map(v=>({o:v.o,rs:v.rs.filter(r=>indices.includes(r.i))})):variants;
  const value=v=>[dgLevel(v.rs),v.rs.reduce((n,r)=>n+r.r,0),v.rs.filter(r=>r.swIn==='win').length];
  const ordered=choices.map(v=>({v,score:value(v)})).sort((a,b)=>a.score[0]-b.score[0]||a.score[1]-b.score[1]||a.score[2]-b.score[2]);
  const best=ordered[0].v,auto=variants[0].o.ab;
  const fingerprint=rs=>rs.map(r=>[r.k,r.swIn,r.spd].join(':')).join();
  const signature=fingerprint(best.rs);
  const abAssume=best.o.ab!==auto||choices.some(v=>fingerprint(v.rs)!==signature)
    ?{ab:best.o.ab,alts:choices.filter(v=>v.o.ab!==best.o.ab).map(v=>v.o.ab),auto}:null;
  return{...best,abAssume};
}
function dgOpponentVariants(M,opponents){
  return opponents.map(o=>({o,rs:M.flatMap((a,i)=>{
    if(!a)return [];
    try{return [{i,...dgMatch(a,o)}]}catch(e){return []}
  })}));
}
function dgTeam2(n,ms,CS,mi,H,mode,opponents){
  /* 2026/11/20：持ち物が姿と合わない型（formErr）の匹は計算に入れない（null＝いない匹と同じ扱い）。外した匹は formErr で返し、前提に書く */
  const FE=[];
  const M=ms.map((o,i)=>{const cs=CS[i];if(!cs)return null;try{const m=mkMon(o.p,'me',H.includes(i)&&i!==mi?{...cs,evolve:false}:cs);if(m.formErr){FE.push({side:'me',no:o.p.no,why:m.formErr});return null}return m}catch(e){return null}});
  const prevWeather=WX_TEAM;
  if(WX_TEAM===undefined)WX_TEAM=teamWx(ms.filter((_,i)=>M[i]).map(o=>o.x));
  try{
    const fam=q=>q.base||q.no;
    const opps=opponents||metaOpps(n).filter(q=>!ms.some(o=>fam(o.p)===fam(q)));
    const rows=opps.map(q=>{
      const csv=LIVE.csv[q.base||q.no],live=!!csv;
      let set,o;
      try{
        set=(q.base&&byNo[q.base]?{...detSet(byNo[q.base]),ab:q.ab,item:null}:detSet(q))||chooseSet(q,true);
        o=mkMon(q,'op',set);
      }catch(e){return null}
      if(o.formErr){FE.push({side:'op',no:q.no,why:o.formErr});return null}
      const legal=(ABD[q.no]||[]).map(([ab])=>ab);
      const recorded=csv?.ab?.some(([name,pct])=>pct>0&&ABK[nrm(name)]===o.ab&&legal.includes(o.ab));
      const unknown=!q.base&&!o.p.mega&&!recorded&&legal.length>1;
      const abilities=unknown?[...new Set([o.ab,...legal].filter(ab=>legal.includes(ab)))]:[o.ab];
      const variants=dgOpponentVariants(M,abilities.map(ab=>ab===o.ab?o:mkMon(q,'op',{...set,ab})));
      const chosen=dgOpponentChoice(variants),res=chosen.rs;
      o=chosen.o;
      return{q:o.p!==q&&o.p.mega?o.p:q,from:q,o,live,res,
        stable:res.filter(r=>r.r>=4),ok:res.filter(r=>r.r>=3),weak:res.filter(r=>r.r===2),
        lvl:dgLevel(res),abAssume:chosen.abAssume,variants:unknown?variants:null};
    }).filter(Boolean);
    /* トリックルーム構築（2026/11/10 依頼主）：トリックルームを張れる匹（登録した技。技が未登録なら覚えられる匹）がいて、
       パーティの半分より多くが、上位の相手の7割以上より遅いとき。そのときは全部の対面をトリックルーム中（遅い方が先）でも計算する */
    const TRID=+Object.keys(MD).find(i=>MD[i][3]==='trickroom');
    /* 2026/11/10 依頼主の指摘（ブリムオン・リキキリン・コータス…が「晴れ・対面」になった）：技を登録していても、その中にトリックルームが無いと
       張れる匹に数えていなかった。覚えられる匹は「張れる候補」（reg:false）として数え、技に入っていないことは別に知らせる */
    /* 2026/11/24：張れる匹（setters）は、計算に使う育成の技に実際にトリックルームが入っている匹だけ。覚えられるだけの匹は「張れる候補」（cand）として別に持ち、
       トリックルームが張られたことにはしない（tr.on にしない・遅さの弱点を消さない）。cand は「トリックルーム向きの形か」（suit）の判定と、技に入れる提案だけに使う */
    const all=ms.map((o,i)=>{const mv=o.x.set&&o.x.set.mv&&o.x.set.mv.length?o.x.set.mv:null;
      const can=!!M[i]&&lsOf(o.p).includes(TRID),reg=can&&!!mv&&mv.some(m=>m&&+m.id===TRID);
      return reg||can?{i,reg,mv:!!mv}:null}).filter(Boolean);
    const setters=all.filter(s=>s.reg),cand=all.filter(s=>!s.reg);
    const slow=M.map((a,i)=>i).filter(i=>rows.length&&rows.filter(r=>{const z=r.res.find(x=>x.i===i);return z&&z.sa<z.so}).length>=rows.length*.7);
    const many=slow.length*2>ms.length;
    const tr={on:!!setters.length&&many,setters,cand,slow,suit:!!all.length&&many,unset:!setters.length&&!!cand.length&&many};
    if(tr.on){
      const prevTR=DG_TR;DG_TR=true;
      try{rows.forEach(r=>{
        const variants=dgOpponentVariants(M,r.variants?r.variants.map(v=>v.o):[r.o]);
        const chosen=dgOpponentChoice(variants);
        r.resTR=chosen.rs;r.lvlTR=dgLevel(chosen.rs);r.oTR=chosen.o;r.abAssumeTR=chosen.abAssume;
        if(r.variants)r.variantsTR=variants;
      })}finally{DG_TR=prevTR}
    }
    /* 計算に入っていない特性（ABIMPL にないもの）を、こちら・相手ともに書き出す（推測で計算したことにしない） */
    const unk=new Map();const addU=(m,who)=>{if(!m)return;const notes=dgCalcUnsupported(m);if(m.ab&&ABN[m.ab]&&typeof ABIMPL!=='undefined'&&!ABIMPL.has(m.ab)&&!notes.length)notes.push(`特性「${ABN[m.ab]}」`);if(notes.length)unk.set(who+m.p.n,`${m.p.n}の${notes.join('・')}`)};
    M.forEach(m=>addU(m,'me'));rows.forEach(r=>{addU(r.o,'op');if(r.oTR&&r.oTR.ab!==r.o.ab)addU(r.oTR,'op TR')});
    return{ms,M,rows,weather:appliedTeamWx(),opponentSource:metaOppsSource(),live:rows.some(r=>r.live),liveAll:rows.every(r=>r.live),mySet:ms.map(o=>!!(o.x.set&&o.x.set.mv&&o.x.set.mv.length)),unk:[...unk.values()],tr,formErr:FE,
      mega:{i:mi,no:mi>=0?ms[mi].x.no:null,mode,holders:H.map(i=>({i,no:ms[i].x.no,stone:dgStoneOf(ms[i].x.no,CS[i])})),alts:null}};
  }finally{WX_TEAM=prevWeather}
}
const DG_LV={4:['◎','2匹以上で安定して対応できる','ok'],3:['○','1匹だけで対応（その匹に頼っている）','mid'],2:['△','対応が不安定（乱数・同速・条件しだい）','warn'],1:['×','パーティ全体で対応が難しい','bad']};
function dgHTML(){return `<div id="dg-box"><div class="sec"><h2>相手ごとの対応力（計算）</h2></div><p class="empty" style="padding:14px">計算中…</p></div>`}
function dgFill(entries){
  const el=document.getElementById('dg-box');if(!el||!entries.length)return;
  let T;try{T=dgTeam(entries,20)}catch(e){el.innerHTML='';return}
  const cnt=l=>T.rows.filter(r=>r.lvl===l).length;
  const nm1=i=>esc(formInfo(T.ms[i].p).base);
  const rowHTML=r=>{const L=DG_LV[r.lvl],best=[...r.res].sort((a,b)=>b.r-a.r).slice(0,3);
    return `<details class="dg-r dg-${L[2]}"><summary><span class="dg-lv">${L[0]}</span><b>${esc(r.q.n)}</b><small>${r.stable.length?r.stable.map(x=>nm1(x.i)).join('・')+'で対応':r.ok.length||r.weak.length?'不安定':'答えなし'}${(()=>{const w=r.res.filter(x=>x.swIn==='win'),c=r.res.filter(x=>x.swIn==='sashwin');return w.length?`／後出し：${w.map(x=>nm1(x.i)).join('・')}`:c.length?`／<span class="dg-cond">条件つき後出し：${c.map(x=>nm1(x.i)).join('・')}</span>`:'／<span class="dg-nosw">後出しできる匹なし</span>'})()}</small></summary>
      <p class="dg-why">${L[1]}${r.live?'':'（この相手の型は推定で計算）'}${r.abAssume?`。特性を特定できないため、こちらにいちばん不利な${esc(ABN[r.abAssume.ab]||r.abAssume.ab)}で計算（ほかに${r.abAssume.alts.map(k=>esc(ABN[k]||k)).join('・')}もある）`:''}</p>
      ${r.resTR?(()=>{const bt=[...r.resTR].sort((a,b)=>b.r-a.r).slice(0,2);return `<p class="dg-why"><b>トリックルーム中：${DG_LV[r.lvlTR][0]}</b>${r.abAssumeTR?`（推定特性：${esc(ABN[r.oTR.ab]||r.oTR.ab)}）`:''} ${bt.map(x=>`${nm1(x.i)}は${x.t}`).join('／')}</p>`})():''}
      ${typeof dguMatchHTML==='function'?(()=>{const all=[...r.res].sort((a,b)=>b.r-a.r),rest=all.slice(3);const one=x=>dguMatchHTML(x,r.q.n,formInfo(T.ms[x.i].p).base);
        return best.map(one).join('')+(rest.length?`<details class="dgc-ev"><summary>ほかの${rest.length}匹の対面を見る</summary>${rest.map(one).join('')}</details>`:'')})()
      :`<ul>${best.map(x=>`<li><b>${nm1(x.i)}</b>（こちら）は <span class="dg-k dg-k${x.r}">${x.t}</span>：${x.why.map(esc).join('／')}<small>素早さ：${nm1(x.i)} ${x.sa} 対 ${esc(r.q.n)} ${x.so}（${x.spd===1?'こちらが先':x.spd===0?'同速':'相手が先'}）</small></li>`).join('')}</ul>`}</details>`};
  const order=[...T.rows].sort((a,b)=>a.lvl-b.lvl);
  el.innerHTML=`<div class="sec"><h2>相手ごとの対応力（計算）</h2><span style="font-size:12px;color:var(--dim)">${FMTN()}</span></div>
    <p class="note" style="padding-top:0">${esc(T.opponentSource)}${T.rows.length}匹（パーティにいる種類は除く）に、1匹ずつ実際のダメージ計算と素早さで「先に倒せるか・耐えて倒せるか・後出しできるか」を見ています。弱点を突けるだけでは「対応できる」にしません。</p>
    ${FMT==='double'?`<p class="note" role="status">ダブルの◎〜×・後出し判定は暫定評価です。${DG_DOUBLE_LIMITS}</p>`:''}
    ${T.unk.length?`<p class="note" role="status">計算に未反映の効果があります：${T.unk.slice(0,8).map(esc).join('、')}${T.unk.length>8?' ほか':''}。◎〜×と後出し判定は暫定評価です。</p>`:''}
    ${typeof dguBars==='function'?dguBars({4:cnt(4),3:cnt(3),2:cnt(2),1:cnt(1)},T.rows.length):`<div class="dg-sum">${[4,3,2,1].map(l=>`<div class="dg-s dg-${DG_LV[l][2]}"><span>${DG_LV[l][0]}</span><b class="num">${cnt(l)}</b></div>`).join('')}</div>`}
    ${T.tr&&T.tr.on?`<p class="note" style="padding-top:6px"><b>トリックルーム中</b>（${T.tr.setters.map(s=>nm1(s.i)).join('・')}が張ったとき・遅い方が先に動く）：${[4,3,2,1].map(l=>`${DG_LV[l][0]}${T.rows.filter(r=>r.lvlTR===l).length}`).join('　')}。上の数はトリックルームなし。</p>`:''}
    <p class="note" style="padding-top:4px">◎ 2匹以上で安定　○ 1匹に頼っている　△ 不安定　× 答えなし（押すと計算の中身）。◎〜×は先に場にいるとき（対面）の評価で、交代で出したときに勝てる匹は「後出し」に書いています（後出しして勝てる匹がいる相手：${T.rows.filter(r=>r.res.some(x=>x.swIn==='win')).length}／${T.rows.length}匹、条件つき〔きあいのタスキ・かるわざ頼み〕だけの相手：${T.rows.filter(r=>!r.res.some(x=>x.swIn==='win')&&r.res.some(x=>x.swIn==='sashwin')).length}匹）。</p>
    <details class="dgc-ev dg-list"><summary>相手ごとの詳細を見る（${T.rows.length}匹：×${cnt(1)}・△${cnt(2)}・○${cnt(3)}・◎${cnt(4)}の順）</summary>${order.map(rowHTML).join('')}</details>
    <details class="dg-pre"><summary>計算の前提</summary><p class="note">相手は${T.liveAll?'ランクバトルの集計から組み合わせた推定の型（1人が実際に使った型ではない）':T.live?'集計が読めた相手は集計から組み合わせた推定の型、読めなかった相手は自動で決めた型':'自動で決めた型（ランクバトルの集計を読めていません）'}、こちらは${T.mySet.every(Boolean)?'登録した育成':T.mySet.some(Boolean)?'登録した育成（未登録の匹は推定の型か当サイトの提案の型）':'推定の型か当サイトの提案の型（育成が未登録）'}です。こちらのダメージは乱数のいちばん低い値で「確定で倒せるか」、相手のダメージは乱数のいちばん高い値で「必ず耐えられるか」を見ています。きあいのタスキ・がんじょう・マルチスケイル・ばけのかわ・命中・先制技・こだわりスカーフ・天気を入れています。${DG_NOTE}</p></details>`;
}

/* ===================== 第4段階：パーティ全体の分析（2026/11/10） =====================
   dgTeam の1対1の結果（同じ計算）だけから、攻撃・防御・素早さ・役割の問題を拾う。タイプ相性だけでは判定しない。
   返すもの：bad（気になる点）・good（よいところ）・ref（参考）。どれも {area,sev,t,d,how,ev:[根拠の数字]} */
/* 2026/11/15 依頼主（P0）：責める言い方にしない。重さは「どのくらい先に見直すとよいか」で言う（判定・数は同じ） */
const DG_SEV={3:'優先度 高',2:'優先度 中',1:'優先度 低'};
function dgAnalyze(T){
  const bad=[],good=[],ref=[],R=T.rows,n=T.ms.length,N=R.length;
  if(!n||!N)return{bad,good,ref};
  const nm=i=>formInfo(T.ms[i].p).base,qn=r=>r.q.n,top=r=>R.indexOf(r)<8;
  const pc=v=>dgPct(v);
  const x2=(r,i)=>r.res.find(z=>z.i===i);
  /* 深刻度：使用率の上位8匹が2匹以上なら深刻、上位8匹が1匹か全部で3匹以上なら注意、ほかは軽い */
  const sevOf=rs=>{const t=rs.filter(top).length;return t>=2?3:t===1||rs.length>=3?2:1};
  /* 根拠は5匹まで書き、残りは「ほか〇匹（名前）」と明記する（2026/11/10 依頼主：件数と例の数が合わない） */
  const list=(rs,f,k)=>{k=k||5;const a=rs.slice(0,k).map(f);if(rs.length>k)a.push(`ほか${rs.length-k}匹：${rs.slice(k).map(r=>r.q?r.q.n:'').join('・')}`);return a};
  /* ---- 攻撃：確定2発以内（乱数のいちばん低い値でも2回で倒せる）で倒せる匹がいるか ---- */
  const kill=r=>r.res.filter(z=>z.me&&z.me.nMin<=2);
  const noKill=R.filter(r=>!kill(r).length);
  if(noKill.length){
    const bestOf=r=>[...r.res].filter(z=>z.me).sort((a,b)=>b.me.min-a.me.min)[0];
    bad.push({area:'攻撃',sev:sevOf(noKill),opps:noKill.map(qn),t:`確定2発で倒せるポケモンがいない相手が${noKill.length}匹`,
      d:'乱数がいちばん低く出ても2回の攻撃で倒せる匹がいません。削り合いが長引き、相手の積み技や回復を許しやすくなります。',
      ev:list(noKill,r=>{const b=bestOf(r);return b?`${qn(r)}：いちばん削れるのは${nm(b.i)}の${b.me.mvn}で${dgDmgTxt(b.me,'op')}（${dgKoTxt(b.me)}）`:`${qn(r)}：効く攻撃技を持つ匹がいない`}),
      how:'その相手に効果ばつぐんを取れる技か、威力の高いタイプ一致技を覚えさせる・火力を上げる持ち物（いのちのたま・タイプ強化の道具など）を持たせると届くことがあります。変更後の計算は第6段階の改善案で確かめられるようにします。'});
  }else good.push({area:'攻撃',t:`上位${N}匹すべてに、確定2発で倒せる匹がいる`,ev:[]});
  /* 1匹に攻撃役を頼っている相手 */
  const soleK={};R.forEach(r=>{const k=kill(r);if(k.length===1)(soleK[k[0].i]=soleK[k[0].i]||[]).push(r)});
  Object.entries(soleK).filter(([,rs])=>rs.length>=3).forEach(([i,rs])=>bad.push({area:'攻撃',sev:rs.some(top)?2:1,opps:rs.map(qn),t:`${nm(+i)}だけが確定2発で倒せる相手が${rs.length}匹`,
    d:`${nm(+i)}が倒されたり、ほかの相手の相手をしていると、次の相手を倒しきれる匹がいなくなります。`,
    ev:list(rs,r=>{const z=x2(r,+i);return `${qn(r)}：${z.me.mvn}で${dgDmgTxt(z.me,'op')}（${dgKoTxt(z.me)}）`}),
    how:`同じ相手を確定2発で倒せる2匹目を用意すると、${nm(+i)}に頼らずに済みます。`}));
  /* ---- 防御：一撃で倒される危険・後出しできる匹 ---- */
  const half=Math.max(2,Math.ceil(n/2));
  const ohko=R.filter(r=>r.res.filter(z=>z.op&&z.op.nMax===1).length>=half);
  if(ohko.length)bad.push({area:'防御',sev:sevOf(ohko),opps:ohko.map(qn),t:`${n}匹中${half}匹以上を一撃で倒せる相手が${ohko.length}匹`,
    d:'相手の乱数がいちばん高く出たときに、パーティの半分以上が一撃で倒されます。この相手に先に動かれると、数を一気に減らされます。',
    ev:list(ohko,r=>{const o=r.res.filter(z=>z.op&&z.op.nMax===1),s=r.res.filter(z=>z.op&&z.op.nMax>1).sort((a,b)=>a.op.max-b.op.max)[0];
      return `${qn(r)}：${o.map(z=>`${nm(z.i)}（${z.op.mvn} 最大${pc(z.op.fmax)}）`).join('・')}を一撃${s?`。耐えるのは${nm(s.i)}（${s.op.mvn}で最大${pc(s.op.fmax)}）`:''}`}),
    how:'この相手の攻撃を2回耐えられる匹（タイプで半減以下にする・能力ポイントを耐久に回す）を用意するか、相手より先に動いて倒せる匹を入れます。'});
  const sw=r=>r.res.filter(z=>z.swIn==='win'),swSurv=r=>r.res.filter(z=>z.swIn==='survive'||z.swIn==='sash'),swC=r=>r.res.filter(z=>z.swIn==='sashwin');
  const noSw=R.filter(r=>!sw(r).length),noSwC=noSw.filter(r=>swC(r).length);
  if(noSw.length)bad.push({area:'防御',opps:[...noSwC,...noSw.filter(r=>!swC(r).length)].map(qn),sev:sevOf(noSw.filter(r=>!swC(r).length))===3?3:Math.max(1,sevOf(noSw)-(noSwC.length===noSw.length?1:0)),t:`安定して後出しして勝てる匹がいない相手が${noSw.length}匹${noSwC.length?`（うち${noSwC.length}匹は条件つきなら後出しできる）`:''}`,
    d:'交代で出たときに受ける1発目（相手のいちばん痛い技・乱数最大）を耐え、そのあとの撃ち合いでも先に倒せる匹がいません。1発目を耐えられる匹がいれば「受けてもう一度交代する」ことはできますが、勝つには交代後に相手を倒し切る手段も必要です。きあいのタスキ・がんじょうで1だけ残ってから先に一撃で倒せる場合は「条件つき」として分けています（タスキは1回きりで、先制技・連続技・砂嵐・設置技で崩れるので安定とは数えません）。先に場にいる対面と、1発受けてから動く後出しでは結果が変わることがあります。',
    ev:list([...noSwC,...noSw.filter(r=>!swC(r).length)],r=>{const c=swC(r)[0];if(c)return `${qn(r)}：【条件つき】${nm(c.i)}は${c.swTxt}`;const s=swSurv(r).sort((a,b)=>a.op.max-b.op.max)[0]||r.res.find(z=>z.swIn==='unproven')||r.res.filter(z=>z.op).sort((a,b)=>a.op.max-b.op.max)[0];return s?`${qn(r)}：${nm(s.i)}は${s.swTxt}`:qn(r)}),
    how:'相手のいちばん痛い技を半減以下にできるタイプ・特性の匹か、耐久に能力ポイントを回した匹を入れると、交代で受けられるようになります。'});
  const soleS={};R.forEach(r=>{const k=sw(r);if(k.length===1)(soleS[k[0].i]=soleS[k[0].i]||[]).push(r)});
  Object.entries(soleS).filter(([,rs])=>rs.length>=3).forEach(([i,rs])=>bad.push({area:'防御',sev:1,opps:rs.map(qn),t:`後出しできるのが${nm(+i)}だけの相手が${rs.length}匹`,
    d:`${nm(+i)}のHPが減ると、これらの相手を交代で受けられなくなります。`,
    ev:list(rs,r=>{const z=x2(r,+i);return `${qn(r)}：${z.op?`交代で受ける1発目 ${z.op.mvn} 最大${pc(z.op.fmax)}`:'効く技がない'}`}),how:`同じ相手を受けられる2匹目がいると、${nm(+i)}の負担が減ります。`}));
  if(!noSw.length)good.push({area:'防御',t:`上位${N}匹すべてに、後出しできる匹がいる`,ev:[]});
  /* ---- 素早さ ---- */
  const faster=r=>r.res.filter(z=>z.spd===1);
  const slowAll=R.filter(r=>!faster(r).length);
  if(slowAll.length&&T.tr&&T.tr.on){
    /* トリックルーム構築：遅いことは弱点にしない。張れる匹・張る前（切れたあと）の速い相手・トリックルーム中でも先に動かれる相手を出す */
    const trF=R.filter(r=>r.resTR&&!r.resTR.some(z=>z.spd===1));
    ref.push({area:'素早さ',opps:slowAll.map(qn),t:`トリックルームを張る前・切れたあとは、だれよりも速い相手が${slowAll.length}匹`,d:'トリックルーム構築なので、遅いことは弱点として数えていません。張る前と切れたあとの対面の参考です。',ev:list(slowAll,r=>{const f=[...r.res].sort((a,b)=>b.sa-a.sa)[0];return `${qn(r)}（素早さ${f.so}）：いちばん速い${nm(f.i)}は${f.sa}`})});
    if(trF.length)bad.push({area:'素早さ',sev:trF.some(top)?2:1,opps:trF.map(qn),t:`トリックルーム中でも先に動かれる相手が${trF.length}匹`,d:'相手のほうがさらに遅いため、トリックルーム中でもこちらのだれも先に動けません（先制技は入れて計算）。',
      ev:list(trF,r=>{const f=[...r.resTR].sort((a,b)=>a.sa-b.sa)[0];return `${qn(r)}（素早さ${f.so}）：いちばん遅い${nm(f.i)}でも${f.sa}`}),how:'この相手には、トリックルームを張らずに戦う匹を用意するか、さらに遅い匹を入れます。'});
    const sN=T.tr.setters.length;
    (sN<=1?bad:good).push({area:'素早さ',sev:sN<=1?2:0,t:sN<=1?`トリックルームを張れるのが${nm(T.tr.setters[0].i)}だけ`:`トリックルームを張れる匹が${sN}匹（${T.tr.setters.map(s=>nm(s.i)).join('・')}）`,
      d:sN<=1?'張る役が先に倒されると、遅い匹がそのまま上から攻撃されます。':'',ev:T.tr.cand.map(s=>s.mv?`${nm(s.i)}は覚えられるが、いまの技にトリックルームが入っていない（張れる匹に数えていない）`:`${nm(s.i)}は技が未登録のため、張れる匹に数えていない（覚えられる）`),how:sN<=1?'トリックルームを張れる2匹目を入れると安定します。':''});
  }else if(slowAll.length){
    /* 覚えられるだけのトリックルームでは、遅さの弱点を消さない（下の「だれよりも速い相手」はそのまま出す） */
    if(T.tr&&T.tr.unset)bad.push({area:'素早さ',sev:2,t:'遅い匹が多いのに、トリックルームの技が入っていない',d:'パーティの半分より多くが遅いトリックルーム向きの形ですが、計算に使った技にトリックルームがありません。トリックルームは張らない前提で計算しています。',
      ev:T.tr.cand.map(x=>x.mv?`${nm(x.i)}はトリックルームを覚えられるが、いまの技に入っていない`:`${nm(x.i)}はトリックルームを覚えられる（技が未登録）`),how:`${T.tr.cand.map(x=>nm(x.i)).slice(0,2).join('か')}の技にトリックルームを入れると、トリックルーム中の計算もします（パーティの画面の「おすすめの型でまとめて埋める」もトリックルーム入りで組みます）。`});
    const pr=r=>r.res.filter(z=>z.pr&&z.pr.min>0).sort((a,b)=>b.pr.min-a.pr.min)[0];
    const cov=slowAll.filter(r=>{const p=pr(r);return p&&p.pr.min>=100});
    bad.push({area:'素早さ',opps:slowAll.map(qn),sev:Math.max(1,sevOf(slowAll)-(cov.length===slowAll.length?1:0)),t:`パーティのだれよりも速い相手が${slowAll.length}匹`,
      d:'素早さ（こだわりスカーフ・天気で速くなる特性・まひも入れて計算）で、だれも先に動けない相手です。'+(cov.length?`このうち${cov.length}匹は先制技で確定で倒せます。`:''),
      ev:list(slowAll,r=>{const f=[...r.res].sort((a,b)=>b.sa-a.sa)[0],p=pr(r);return `${qn(r)}（素早さ${f.so}）：いちばん速い${nm(f.i)}は${f.sa}${f.sa===f.so?'（同速）':''}${p?`。先制技：${nm(p.i)}の${p.pr.mvn}で${dgDmgTxt(p.pr,'op')}`:''}`}),
      how:'こだわりスカーフ・先制技・素早さに能力ポイントを回すなどで、上を取れる匹を作ります。'});
  }else good.push({area:'素早さ',t:`上位${N}匹すべてに、先に動ける匹がいる`,ev:[]});
  const soleF={};if(!(T.tr&&T.tr.on))R.forEach(r=>{const k=faster(r);if(k.length===1)(soleF[k[0].i]=soleF[k[0].i]||[]).push(r)});
  Object.entries(soleF).filter(([,rs])=>rs.length>=4).forEach(([i,rs])=>bad.push({area:'素早さ',sev:1,opps:rs.map(qn),t:`先に動けるのが${nm(+i)}だけの相手が${rs.length}匹`,
    d:`速さの役目が${nm(+i)}に集まっています。${nm(+i)}がいなくなると、これらの相手には全員が後から動くことになります。`,
    ev:list(rs,r=>{const z=x2(r,+i);return `${qn(r)}：${nm(+i)} ${z.sa} 対 ${z.so}`}),how:'2匹目の速い匹（またはスカーフ・先制技）を用意します。'}));
  /* ---- 役割：倒されると崩れる匹・攻撃役と受け役のバランス・役割の重なり ---- */
  const ans=r=>r.res.filter(z=>z.r>=3);
  const crit={};R.forEach(r=>{const a=ans(r);if(a.length===1)(crit[a[0].i]=crit[a[0].i]||[]).push(r)});
  Object.entries(crit).filter(([,rs])=>rs.length>=3).forEach(([i,rs])=>bad.push({area:'役割',sev:rs.some(top)?3:2,opps:rs.map(qn),t:`${nm(+i)}が倒されると、対応できなくなる相手が${rs.length}匹`,
    d:`これらの相手に有利に戦える（受けて有利以上）のは${nm(+i)}だけです。${nm(+i)}が先に倒されると、パーティが崩れます。`,
    ev:list(rs,r=>{const z=x2(r,+i);return `${qn(r)}：${nm(+i)}が「${z.t}」（${z.why[0]||''}）`}),how:`同じ相手に有利に戦える2匹目を入れるか、${nm(+i)}を最後まで温存できる選出にします。`}));
  /* トリックルーム構築なら、攻撃役はトリックルーム中の計算で数える */
  const trOn=T.tr&&T.tr.on,x2a=(r,i)=>trOn&&r.resTR?r.resTR.find(z=>z.i===i):x2(r,i);
  const atkN=T.ms.map((_,i)=>R.filter(r=>{const z=x2a(r,i);return z&&z.k==='ko_fast'}).length);
  /* 受けの性能は3つに分けて数える（2026/11/10 依頼主の確認②）：
     tank＝場で相手の攻撃を受けながら有利に戦える（耐えて倒せる・半減以下で受けて有利・交代で出て勝てる）
     piv＝交代で出て、相手のいちばん痛い技（乱数最大）を半分未満で受け、もう一度安全に交代できる
     sw＝後出しして、そのあとの撃ち合いにも勝てる（条件つき＝タスキ頼みは別に数える） */
  const defN=T.ms.map((_,i)=>R.filter(r=>{const z=x2(r,i);return z&&['switch','wall','tank'].includes(z.k)}).length);
  const pivN=T.ms.map((_,i)=>R.filter(r=>{const z=x2(r,i);return z&&(!z.op||z.op.fmax<50)}).length);
  const swN0=T.ms.map((_,i)=>R.filter(r=>{const z=x2(r,i);return z&&z.swIn==='win'}).length),swCN=T.ms.map((_,i)=>R.filter(r=>{const z=x2(r,i);return z&&z.swIn==='sashwin'}).length);
  const q4=Math.ceil(N*.25);
  const atk=T.ms.map((_,i)=>i).filter(i=>atkN[i]>=q4),def=T.ms.map((_,i)=>i).filter(i=>defN[i]>=q4||pivN[i]>=q4||swN0[i]>=q4);
  const defTxt=i=>`${nm(i)}：上から倒せる ${atkN[i]}匹／受けて有利 ${defN[i]}匹／安全に交代できる ${pivN[i]}匹／後出しして勝てる ${swN0[i]}匹${swCN[i]?`（ほか条件つき ${swCN[i]}匹）`:''}`;
  if(n>=3){
    if(!atk.length)bad.push({area:'役割',sev:2,t:trOn?'トリックルーム中でも先に動いて倒しきれる攻撃役がいない':'上から倒せる攻撃役がいない',d:`上位${N}匹の4分の1以上に「先に動いて倒しきれる」匹がいません。`,ev:T.ms.map((_,i)=>`${nm(i)}：上から倒せる相手 ${atkN[i]}匹`),how:'素早さと火力の高い匹、またはこだわりスカーフを持たせた匹を入れます。'});
    /* 2026/11/10 依頼主の検証⑤：攻撃役ばかりで受け役がいない（攻撃に偏っている）をはっきり出す */
    const bias=atk.length>=3&&def.length<=1;
    const crit3=`受けの役目は「受けて有利に戦える」「安全に交代できる（いちばん痛い技を半分未満で受ける）」「後出しして勝てる」の3つで数え、どれかが上位${N}匹の4分の1（${q4}匹）以上の匹を受けに回れる匹としています。`;
    if(!def.length)bad.push({area:'役割',sev:bias?3:2,t:bias?`攻撃に偏っている：攻撃役${atk.length}匹に対して、受けに回れる匹が0匹`:'受けに回れる匹がいない',
      d:`${crit3}${bias?'先に場に出た対面では勝てても、不利な対面になったとき交代先がなく、1匹ずつ倒されやすい形です。':''}`,
      ev:T.ms.map((_,i)=>defTxt(i)),how:'弱点の少ないタイプで、HPと防御・特防の高い匹を入れると、不利な対面から交代しやすくなります。'});
    else if(bias&&def.length===1)bad.push({area:'役割',sev:2,t:`攻撃に偏っている：受けに回れるのが${nm(def[0])}の1匹だけ（攻撃役${atk.length}匹）`,d:`${crit3}${nm(def[0])}のHPが減ると、交代で受けられる匹がいなくなります。`,ev:T.ms.map((_,i)=>defTxt(i)),how:`${nm(def[0])}と別の相手を受けられる2匹目を入れると、負担が分かれます。`});
    if(atk.length&&def.length&&!(bias&&def.length===1))good.push({area:'役割',t:`攻撃役（${atk.map(nm).join('・')}）と受けに回れる匹（${def.map(nm).join('・')}）がいる`,ev:[...new Set([...atk,...def])].map(defTxt)});
  }
  for(let a=0;a<n;a++)for(let b=a+1;b<n;b++){
    const sa=R.filter(r=>{const z=x2(r,a);return z&&z.r>=3}),sb=R.filter(r=>{const z=x2(r,b);return z&&z.r>=3});
    if(sa.length<3||sb.length<3)continue;const both=sa.filter(r=>sb.includes(r)).length;
    if(both/Math.min(sa.length,sb.length)>=.85)ref.push({area:'役割',t:`${nm(a)}と${nm(b)}は得意な相手がほとんど同じ`,d:`有利に戦える相手が${both}匹重なっています。片方が倒されても代わりになりますが、ほかの相手への備えが手薄なら、片方を入れかえる候補です。`,ev:[`${nm(a)}：${sa.length}匹／${nm(b)}：${sb.length}匹／重なり：${both}匹`]});
  }
  return{bad:bad.sort((x,y)=>y.sev-x.sev),good,ref};
}
/* 後出し・受けの不足を直す入れかえ案（2026/11/10 依頼主の検証⑤：攻撃偏重のパーティ）。
   候補は使用率の上位＋合計種族値の高い匹（メガの姿は除く）。後出しして勝てない相手への後出しを1対1で数えて上位を選び、
   外す匹（軸は外さない・役目の少ない匹から）と入れかえた6匹で dgTeam0 を計算し直す。
   後出しできない相手が減り、×・△以下が増えず、半分以上を一撃で倒す相手も増えない案だけ、変更前→変更後の数つきで返す */
/* 比べるのは、変更前と変更後の両方にいる相手だけ（パーティに入れた種類は相手の候補から外れるため、相手の顔ぶれが変わる） */
function dgMetric(T,keep){const n=T.ms.length,half=Math.max(2,Math.ceil(n/2)),R=keep?T.rows.filter(r=>keep.has(r.q.no)):T.rows;
  return{n:R.length,nosw:R.filter(r=>!r.res.some(z=>z.swIn==='win')).length,ohko:R.filter(r=>r.res.filter(z=>z.op&&z.op.nMax===1).length>=half).length,
    slow:R.filter(r=>!r.res.some(z=>z.spd===1)).length,x:R.filter(r=>r.lvl===1).length,w:R.filter(r=>r.lvl<=2).length,st:R.filter(r=>r.lvl===4).length}}
/* 入れる匹の育成（2026/11/10 依頼主の確認③：外す匹の持ち物・技を引きつがない）。
   集計があれば使用率の高い型、なければ型の例（archSet）。持ち物は残る5匹と重ならないもの（ゲームにある持ち物だけ） */
function dgSwapSet(c,rest){
  /* 2026/11/13 入れかえ案 MVP（docs/party-building-mvp-spec.md）：M-C で使えると確認でき、同じ形式の PokéKit の集計から組める型だけ。
     組めなければ null（下の自動の型・型の例では埋めない）。下の古い組み方は MVP のデータが無いときだけ */
  if(typeof mvpSwapSet==='function')return mvpSwapSet(c,rest);
  const used=new Set(rest.map(x=>{const s=(x.set&&x.set.it&&x.set.it.k)||((mySetFor(x.no)||{}).item);return s}).filter(Boolean));
  let s=null,src='型の例';
  if(LIVE.csv[c.no]){try{s=detSet(c);src='集計から組み合わせた推定の型'}catch(e){s=null}}
  if(s&&s.item&&used.has(s.item)){s=null}
  if(!s){try{s=archSet(['axis'],c,null,new Set(used));src='型の例'}catch(e){s=null}}
  if(!s)return null;
  const mv=(s.moves||[]).map(m=>typeof m==='number'?{id:m,n:mName(m)}:m&&m.prot?protSaved(m):m&&m.id>0?{id:m.id,n:mName(m.id)}:null).filter(Boolean);
  const sv={ab:s.ab?{k:s.ab,n:ABN[s.ab]||s.ab}:null,it:s.item?{k:s.item,n:ITEMN[s.item]||s.item}:null,mv,sp:s.sp?[...s.sp]:[2,32,0,0,0,32],up:s.up??1,dn:s.dn??3,src:'copy'};
  return{sv,src,txt:`${src}：特性 ${sv.ab?sv.ab.n:'―'}／持ち物 ${sv.it?sv.it.n:'なし'}／性格 ${natName(sv.up,sv.dn)||'補正なし'}／能力ポイント ${SN.map((n,i)=>sv.sp[i]?`${n}${sv.sp[i]}`:'').filter(Boolean).join('・')}／技 ${mv.map(m=>m.n).join('・')}`};
}
/* 変更前→変更後の比べ方：対面（◎〜×）・後出し・素早さ・一撃で半分以上 を、良くなった相手と悪くなった相手の名前つきで */
function dgDiff(T0,T1){
  const by1=new Map(T1.rows.map(r=>[r.q.no,r])),common=T0.rows.filter(r=>by1.has(r.q.no)),keep=new Set(common.map(r=>r.q.no));
  const half=T=>Math.max(2,Math.ceil(T.ms.length/2));
  const f={sw:r=>r.res.some(z=>z.swIn==='win'),fast:r=>r.res.some(z=>z.spd===1),safe:(r,T)=>r.res.filter(z=>z.op&&z.op.nMax===1).length<half(T)};
  const up=[],dn=[];
  const nm=r=>r.q.n,L=l=>DG_LV[l][0];
  const lu=common.filter(r=>by1.get(r.q.no).lvl>r.lvl),ld=common.filter(r=>by1.get(r.q.no).lvl<r.lvl);
  if(lu.length)up.push(`対面：${lu.map(r=>`${nm(r)} ${L(r.lvl)}→${L(by1.get(r.q.no).lvl)}`).join('・')}`);
  if(ld.length)dn.push(`対面：${ld.map(r=>`${nm(r)} ${L(r.lvl)}→${L(by1.get(r.q.no).lvl)}`).join('・')}`);
  const flip=(k,lab,labN,g)=>{const a=common.filter(r=>!g(r,T0)&&g(by1.get(r.q.no),T1)),b=common.filter(r=>g(r,T0)&&!g(by1.get(r.q.no),T1));
    if(a.length)up.push(`${lab}：${a.map(nm).join('・')}`);if(b.length)dn.push(`${labN}：${b.map(nm).join('・')}`)};
  flip('sw','後出しして勝てるようになる','後出しして勝てなくなる',f.sw);
  flip('fast','先に動ける匹ができる','先に動ける匹がいなくなる',f.fast);
  flip('safe','半分以上を一撃で倒されなくなる','半分以上を一撃で倒されるようになる',f.safe);
  const added=T1.rows.filter(r=>!keep.has(r.q.no)).map(nm),gone=T0.rows.filter(r=>!by1.has(r.q.no)).map(nm);
  return{up,dn,keep,b:dgMetric(T0,keep),a:dgMetric(T1,keep),note:added.length||gone.length?`比べたのは両方に共通の相手${common.length}匹（${gone.length?`${gone.join('・')}はパーティに入るので相手から外れる`:''}${gone.length&&added.length?'、':''}${added.length?`${added.join('・')}は外した匹が相手になるので変更後だけ`:''}）`:`比べたのは上位の相手${common.length}匹`};
}
const DG_FIX=new Map();
function dgDefSwaps(entries,T){
  T=T||dgTeam(entries,20);const noSw=T.rows.filter(r=>!r.res.some(z=>z.swIn==='win'));
  if(noSw.length<2||entries.length<2)return[];
  const key=JSON.stringify([dgDataSig(),entries.map(x=>[x.no,x.set||0,!!x.axis])]);
  if(DG_FIX.has(key))return DG_FIX.get(key);
  const fam=q=>q.base||q.no,inT=new Set(entries.map(x=>fam(byNo[x.no]||{no:x.no})));
  const pool=[];const seen=new Set();
  [...metaOpps(40),...(typeof gmOpps==='function'?gmOpps():[])].forEach(q=>{if(!q||q.base||inT.has(q.no)||seen.has(q.no))return;seen.add(q.no);pool.push(q)});
  /* 外す候補：軸以外で、対面で有利（r>=4）か後出しして勝てる相手がいちばん少ない2匹 */
  const contrib=T.ms.map((_,i)=>T.rows.filter(r=>{const z=r.res.find(x=>x.i===i);return z&&(z.r>=4||z.swIn==='win')}).length);
  const outs=entries.map((x,i)=>i).filter(i=>!entries[i].axis).sort((a,b)=>contrib[a]-contrib[b]).slice(0,2);
  const res=[];
  outs.forEach(i=>{const rest=entries.filter((_,k)=>k!==i);
    const sc=pool.map(c=>{const S=dgSwapSet(c,rest);if(!S)return null;let a;try{a=mkMon(c,'me',savedToCalc(c.no,S.sv))}catch(e){return null}
      const won=noSw.filter(r=>{try{return dgMatch(a,r.o).swIn==='win'}catch(e){return false}});return{c,S,won}}).filter(z=>z&&z.won.length>=2).sort((a,b)=>b.won.length-a.won.length||b.c.bst-a.c.bst).slice(0,5);
    sc.forEach(({c,S})=>{let T1;try{const es=entries.map((x,k)=>k===i?{no:c.no,sel:!!x.sel,set:S.sv}:x);T1=impRecalc(es)}catch(e){return}
      if(impTrEvaluation(T,T1)?.loss)return;
      const D=dgDiff(T,T1),b=D.b,a=D.a;
      if(a.nosw<b.nosw&&a.x<=b.x&&a.w<=b.w&&a.ohko<=b.ohko)res.push({i,c,S,b,a,D,gain:(b.nosw-a.nosw)*2+(b.ohko-a.ohko)+(b.w-a.w)+(b.slow-a.slow)*.5})})});
  res.sort((x,y)=>y.gain-x.gain);
  /* 2026/11/14 第3段階 P3-02：入れかえ案の計算（76-mvp.js、メガは1匹ずつ）でも確かめ、新しい大きな弱点ができる・素早さの操作か天気を失う案は出さない（数は mvpDrop） */
  const used=new Set(),out=[];let drop=0,E0=null;
  for(const r of res){if(out.length>=3)break;if(used.has(r.c.no))continue;
    const G=typeof mvpGate==='function'?mvpGate(entries,r.i,{no:r.c.no,sel:!!entries[r.i].sel,set:r.S.sv},E0):{ok:true};E0=G.E0||E0;
    if(!G.ok){drop++;continue}used.add(r.c.no);r.mvp=G.C;out.push(r)}
  out.mvpDrop=drop;
  DG_FIX.set(key,out);return out;
}
/* どのメガで計算したかと、切りかえ（2026/11/14 依頼主の判断：選んだメガだけを見せる）。メガストーンを持つ匹が2匹以上のときだけ出す */
const dgMegaNm=h=>{const m=megaOf(h.no,h.stone);return m&&byNo[m.no]?byNo[m.no].n:formInfo(byNo[h.no]).base};
function dgMegaTxt(T){const M=T&&T.mega;if(!M||M.holders.length<2)return '';const h=M.holders.find(z=>z.i===M.i);
  return `メガシンカは${dgMegaNm(h)}だけで計算（${M.mode==='auto'?'自動：パーティ全体でいちばん結果が良いメガ':'あなたが選んだメガ'}）。1回の対戦でメガシンカできるのは1匹だけなので、ほかのメガストーンを持つ匹（${M.holders.filter(z=>z.i!==M.i).map(z=>formInfo(byNo[z.no]).base).join('・')}）はメガ石を持ったまま通常の姿で計算しています。`}
function dgMegaBarHTML(T){const M=T&&T.mega;if(!M||M.holders.length<2)return '';
  const on=no=>M.mode!=='auto'&&M.no===no;
  const alt=M.alts?`<details class="dgm-alt"><summary>自動で選んだ理由（メガごとの結果）</summary><ul>${M.alts.map(a=>{const h=M.holders.find(z=>z.i===a.i);return `<li${a.i===M.i?' class="dgm-best"':''}><b>${esc(dgMegaNm(h))}</b>：答えがない相手 ${a.x}匹・△以下 ${a.w}匹・後出しできない相手 ${a.nosw}匹・半分以上を一撃で倒される相手 ${a.ohko}匹・◎ ${a.st}匹${a.i===M.i?'（選んだもの）':''}</li>`}).join('')}</ul><p class="note">答えがない相手の少なさ→△以下の少なさ→後出しできない相手の少なさ→一撃で倒される相手の少なさ→◎の多さ、の順で比べています。強さや勝率の保証ではありません。</p></details>`:'';
  return `<div class="dgm-bar"><p class="dgm-t"><b>メガシンカ：${esc(dgMegaNm(M.holders.find(z=>z.i===M.i)))}で計算</b><span class="dgm-mode">${M.mode==='auto'?'自動':'選んだメガ'}</span></p>
    <p class="dgm-n">1回の対戦でメガシンカできるのは1匹だけです。ほかのメガストーンを持つ匹は、メガシンカしない姿で計算しています。下の診断・選出・改善案はすべてこのメガで計算します。</p>
    <div class="dgm-btns" role="group" aria-label="メガシンカさせる匹を選ぶ"><button class="dgm-b" data-dgm="0" aria-pressed="${M.mode==='auto'}">自動</button>${M.holders.map(h=>`<button class="dgm-b" data-dgm="${h.no}" aria-pressed="${on(h.no)}">${esc(dgMegaNm(h))}</button>`).join('')}</div>${alt}</div>`}
function dgMegaBind(root){if(!root)return;root.querySelectorAll('[data-dgm]').forEach(b=>b.onclick=()=>{const no=+b.dataset.dgm;if(no===dgMegaSel())return;dgMegaSet(no);const y=scrY();teamRender();scrTo(0,y)})}
/* パーティのチェックの「計算の前提」に足す文（未対応のこと） */
function dgPremise(T){
  return `${T.formErr&&T.formErr.length?`計算に入れていない匹：${T.formErr.map(x=>`${(byNo[x.no]||{}).n||x.no}（${FORM_WHY[x.why]||x.why}）`).join('・')}。`:''}${dgMegaTxt(T)}${T.opponentSource}${T.rows.length}匹（${T.liveAll?'ランクバトルの集計から組み合わせた推定の型（1人が実際に使った型ではない）':T.live?'集計が読めた相手は集計から組み合わせた推定の型、ほかは当サイトの提案の型':'自動で決めた型。ランクバトルの集計を読めていません'}）。`+
    `${FMT==='double'?DG_DOUBLE_SCOPE+DG_DOUBLE_LIMITS:''}`+
    `${T.rows.some(r=>r.abAssume)?`特性を特定できない相手で結果が変わるときは、こちらにいちばん不利な特性で計算しています（${T.rows.filter(r=>r.abAssume).slice(0,4).map(r=>`${r.q.n}＝${ABN[r.abAssume.ab]||r.abAssume.ab}`).join('・')}${T.rows.filter(r=>r.abAssume).length>4?' ほか':''}）。`:''}${T.unk.length?`計算に入っていない効果：${T.unk.slice(0,8).join('、')}${T.unk.length>8?' ほか':''}。`:''}${DG_NOTE}`;
}

/* ===================== 構築の型のバッジ（2026/11/10 依頼主：パーティの6匹の右上に、どういう型か分かる札） =====================
   ・天気：パーティに天気を作る特性の匹（teamWx、メガストーンならメガ後の特性）
   ・トリックルーム：dgTeam の tr（張れる匹がいて、半分より多くが遅い）
   ・おいかぜ：登録した技におかぜ
   ・対面／サイクル／積み：teamKind（登録した持ち物・技から。3匹以上の育成が要る）
   押すとその型の解説（#/arch/ID）。決まらないときは灰色の「型：判定中」 */
const ARCH_BADGE={sun:['晴れ','sun'],rain:['雨','rain'],sand:['砂嵐','sand'],snow:['雪','snow'],tr:['トリックルーム','tr'],tailwind:['おいかぜ','tailwind'],tm:['対面','taimen'],ac:['攻めサイクル','cycle'],dc:['受けサイクル','cycle'],su:['積み','setup']};
function teamArch(entries,T=null){
  const out=[];if(!entries||!entries.length)return out;
  try{T=T||dgTeam(entries,20)}catch(e){}
  if(entries.length>=3&&T?.tr&&(T.tr.on||T.tr.unset))out.push({k:'tr',unset:!T.tr.on,
    why:`${(T.tr.on?T.tr.setters:T.tr.cand).map(s=>formInfo(T.ms[s.i].p).base).join('・')}が${T.tr.on?'張れて':'覚えられて（いまの技には未登録。計算ではトリックルームを張っていない）'}、${T.tr.slow.length}匹が遅い`});
  const w=T?.weather;
  if(w){
    const gain=T.M.filter(m=>m&&(WX_GAIN[w.k]||[]).includes(m.ab));
    out.push({k:w.k,why:`${w.by}の${ABN[w.ab]||'特性'}で天気を変える${w.guess?'（特性が未登録なので、この特性と仮定）':''}${gain.length?`（${gain.map(m=>formInfo(m.p).base).join('・')}が得をする）`:''}`});
  }
  const TW=+Object.keys(MD).find(i=>MD[i][3]==='tailwind');
  const tw=(T?.ms||[]).filter(({x,p},i)=>T.M[i]&&canLearn(p,TW)&&(x.set?.mv||[]).some(m=>m&&+m.id===TW)).map(o=>o.x);if(tw.length)out.push({k:'tailwind',why:`${tw.map(x=>formInfo(byNo[x.no]).base).join('・')}がおいかぜを使う`});
  try{const K=teamKind(entries);if(K&&K.k&&ARCH_BADGE[K.k])out.push({k:K.k,why:K.why.length?K.why.join('・'):K.name})}catch(e){}
  return out.slice(0,3);
}
function teamArchHTML(entries){
  if(!entries||entries.length<2)return '';
  /* 診断に使うデータがそろうまでは決めない（2026/11/12） */
  if(typeof dgState==='function'&&!['ready','off','partial'].includes(dgState(entries)))return `<span class="tarch-l">構築の型</span><span class="tarch-b tarch-none" title="診断に必要なデータを読み込んでいます">判定中</span>`;
  const A=teamArch(entries);
  if(!A.length)return `<span class="tarch-l">構築の型</span><span class="tarch-b tarch-none" title="技・持ち物を3匹以上登録すると、対面・サイクル・積みなども判定できます">判定中</span>`;
  return `<span class="tarch-l">構築の型</span>${A.map(a=>{const B=ARCH_BADGE[a.k];return `<a class="tarch-b tarch-${a.k}${a.unset?' tarch-unset':''}" href="#/arch/${B[1]}" title="${esc(a.why)}">${esc(B[0])}${a.unset?'（技が未登録）':''}</a>`}).join('')}`;
}
