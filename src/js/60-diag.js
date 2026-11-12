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
/* トリックルームの計算をしているあいだだけ true（dgTeam0 が切りかえる） */
let DG_TR=false;
const DG_ROLLS=[85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100];
const DG_K={ko_fast:{r:5,t:'上から倒せる'},tank:{r:4,t:'耐えて倒せる'},switch:{r:4,t:'後出しできる'},wall:{r:3,t:'受けて有利に戦える'},
  shaky:{r:2,t:'勝てるが不安定'},cond:{r:2,t:'条件つき'},lose:{r:1,t:'対応できない'}};
const DG_NOTE='技の反動・自分のHPが減る効果、フィールド（エレキフィールド等）の威力の変化、追い風・トリックルーム・ステルスロックなどの場の効果、やけど・まひ以外の状態異常、能力を下げる追加効果、急所は計算に入れていません。素早さを変える特性は、天気で速くなる特性（すいすい等）だけ入れています。';
/* 1つの技のダメージ（最大HPに対する％）：乱数の最小・最大と、16段階のうち倒しきれる段階の数 */
/* 技の名前：特性で技のタイプが変わるとき（スカイスキン・フェアリースキン等、ウェザーボール）は、それを書く（2026/11/10 依頼主：
   メガボーマンダの すてみタックル がひこう技として計算されているのに、画面では ノーマル技に見えた） */
const dgMvName=(a,mv)=>{try{const t=hitType(a,mv);if(t&&mv.t&&t!==mv.t)return `${mv.n}（${SKIN[a.ab]?(ABN[a.ab]||'特性')+'で':'天気で'}${t}技）`}catch(e){}return mv.n};
function dgMove(a,mv,d){
  const dg=d.disg;d.disg=false;
  try{
    const h=mv.maxH>1?(mv.minH===mv.maxH?mv.maxH:3):1;
    /* マルチスケイル・ファントムガード（2026/11/10 依頼主の検証で見つけた間違い）：bcalc は満タンのマルチスケイルを半分にし、
       duTurns も「最初の1回は半分」として数えるので、二重に半分になっていた（げきりん 66〜79% が確定3発に見えた。正しくは確定2発）。
       min/max は2発目から（半分にならない）のダメージにし、初撃は first（半分）として別に持つ。回数は duTurns が初撃を半分で数える */
    const half=DU_HALF_AB.includes(d.ab)&&!duIg(a),hp0=d.hp;
    if(half)d.hp=d.max-1;
    let r0,r1;try{r0=bcalc(a,mv,d,{r:85});r1=r0.dmg&&r0.eff?bcalc(a,mv,d,{r:100}):null}finally{d.hp=hp0}
    if(!r0.dmg||!r0.eff)return{mv,min:0,max:0,eff:r0.eff||0,h,acc:accOf(a,mv,d),ohko:0,absorb:r0.absorb||null};
    const min=r0.dmg*h/d.max*100,max=r1.dmg*h/d.max*100;
    const roll=r=>{if(half)d.hp=d.max-1;try{return bcalc(a,mv,d,{r}).dmg}finally{d.hp=hp0}};
    /* 一撃で倒せる段階の数は初撃（マルチスケイル等なら半分）で数える */
    /* 連続技は、マルチスケイルで半分になるのは最初の1回だけ（2回目からはHPが満タンでない）（2026/11/10 依頼主の確認で見つけた間違い：全部の回を半分にしていた） */
    /* 2026/11/10 依頼主の確認（ドラゴンアロー）：1回目（HP満タン＝マルチスケイルで半分）と2回目から（半分にならない）を乱数16段階ずつ別々に bcalc で計算して足す。
       fmin/fmax＝1回の技（全部の回の合計）の1発目のダメージ。一撃で倒せる乱数の数（ohko、16段階に換算）は、1回目と2回目の乱数を別々に組み合わせて数える（3回以上の連続技は2回目以降を同じ乱数と見る） */
    if(!half){let ohko=0;if(max>=100)ohko=r0.fixed?16:DG_ROLLS.filter(r=>roll(r)*h>=d.max).length;
      return{mv,mvn:dgMvName(a,mv),min,max,eff:r0.eff,h,acc:accOf(a,mv,d),ohko,fixed:!!r0.fixed,half:null,fmin:min,fmax:max}}
    const at=(r,full)=>{d.hp=full?d.max:d.max-1;try{return bcalc(a,mv,d,{r}).dmg}finally{d.hp=hp0}};
    const h1=DG_ROLLS.map(r=>at(r,true)),h2=DG_ROLLS.map(r=>at(r,false)),L=DG_ROLLS.length-1;
    const tot=(i,j)=>h1[i]+(h-1)*h2[j];
    let ko=0;h1.forEach((_,i)=>h2.forEach((_,j)=>{if(tot(i,j)>=d.max)ko++}));
    return{mv,mvn:dgMvName(a,mv),min,max,eff:r0.eff,h,acc:accOf(a,mv,d),ohko:r0.fixed?16:ko/DG_ROLLS.length,fixed:!!r0.fixed,half:d.ab,
      fmin:tot(0,0)/d.max*100,fmax:tot(L,L)/d.max*100,hit1:[h1[0],h1[L]],hitN:h>1?[h2[0],h2[L]]:null,hpMax:d.max};
  }finally{d.disg=dg}
}
/* いちばん頼れる技：確定で倒せる回数が少ない順 → 最小ダメージ×命中の大きい順 */
function dgBest(a,d){
  let best=null;
  /* みらいよち・はめつのねがいは2ターン後に当たるので、1対1の撃ち合いには入れない */
  (a.moves||[]).forEach(mv=>{if(!mv||mv.prot||!(mv.pow>0||mv.fixed||fixedDmg(a,mv,d)!=null))return;if(['futuresight','doomdesire'].includes(mkey(mv)))return;
    const x=dgMove(a,mv,d);if(!x.max)return;
    x.nMin=duTurns(x.min,{mv,acc:100,f:x.fmin},a,d);x.nMax=duTurns(x.max,{mv,acc:100,f:x.fmax},a,d);
    /* 同じ回数で倒せるなら、命中90以上の技を先に（2026/11/10：だいもんじ〔命中85〕を選んで「不安定」になっていた） */
    const key=[x.nMin,x.acc>=90?0:1,-(x.min*x.acc)];
    if(!best||key[0]<best.key[0]||(key[0]===best.key[0]&&(key[1]<best.key[1]||(key[1]===best.key[1]&&key[2]<best.key[2]))))best={...x,key}});
  return best;
}
/* 先制技で倒しきれるか（確定の回数） */
function dgPrio(a,d){
  let best=null;
  (a.moves||[]).forEach(mv=>{if(!mv||mv.prot||!(mv.pri>0)||!(mv.pow>0))return;const x=dgMove(a,mv,d);if(!best||x.min>best.min)best=x});
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
  if(x.nMin===1)return '確定1発';
  if(x.nMax===1)return `乱数1発（${Math.round(x.ohko/16*100)}%）`;
  if(x.nMin===x.nMax)return x.nMin>=9?'倒しきれない':`確定${x.nMin}発`;
  return `乱数${x.nMax}発（確定${x.nMin>=9?'なし':x.nMin+'発'}）`};
/* 1対1：a（こちら）と o（相手）。どちらの技も「確定（乱数最小）」と「最悪の場合（相手は乱数最大）」で見る */
function dgMatch(a,o){return withWx(a,o,()=>dgMatch0(a,o))}
function dgMatch0(a,o){
  const me=dgBest(a,o),op=dgBest(o,a);
  /* トリックルーム中（DG_TR）は遅い方が先に動く（先制技はトリックルームでも先） */
  const tr=DG_TR,sa=effSpd(a),so=effSpd(o),spd=tr?(sa<so?1:sa>so?-1:0):(sa>so?1:sa<so?-1:0);
  const upTxt=tr?`トリックルーム中は遅い方が先に動く（${sa} 対 ${so}）`:`素早さで上を取れる（${sa} 対 ${so}）`;
  const myN=me?me.nMin:9,myNb=me?me.nMax:9,acc=me?me.acc:100;
  /* 相手の攻撃は乱数最大（こちらにとって最悪）で数える */
  const opW=op?op.nMax:9,opB=op?op.nMin:9;
  const pr=dgPrio(a,o),opPr=dgPrio(o,a);
  const prKO=pr&&duTurns(pr.min,{mv:pr.mv,acc:100,f:pr.fmin},a,o)===1;
  /* 先に倒しきれるか：こちらが先に動けるなら myN<=opW、遅ければ myN<opW。先制技のとどめ・相手の先制技も見る */
  const finPr=(n,x,p)=>p&&p.min>0&&(n-1)*x.min+p.min>=100;
  let first=spd;
  if(first<=0&&me&&finPr(myN,me,pr)&&!(op&&finPr(opW,op,opPr)))first=1;
  if(first>=0&&op&&finPr(opW,op,opPr)&&!(me&&finPr(myN,me,pr)))first=-1;
  const winSafe0=myN<9&&(first===1?myN<=opW:myN<opW);
  /* こちらのきあいのタスキ・がんじょうで1回耐えるおかげで勝てるだけなら「条件つき」にする */
  const opRaw=op?duTurns(op.max,{mv:op.mv,acc:100,f:op.fmax},o,{...a,item:a.item==='focussash'?null:a.item,ab:a.ab==='sturdy'?'':a.ab}):9;
  const winSafe=myN<9&&(first===1?myN<=opRaw:myN<opRaw);
  const sashOnly=winSafe0&&!winSafe;
  const winTie=myN<9&&first===0&&myN<=opW;
  const winBest=myNb<9&&(first>=0?myNb<=opB:myNb<opB);
  const sash=o.item==='focussash'||o.ab==='sturdy',mySash=a.item==='focussash'||a.ab==='sturdy';
  /* 交代で出ると1回ぶん多く受ける */
  const swOk=opW>=2&&myN<9&&(first===1?myN<=opW-1:myN<opW-1);
  const resist=op&&op.eff<=.5;
  /* 素早さの関係は3つに分けて書く（2026/11/10 依頼主：同速を「上を取れる」と言わない） */
  const spdTxt=spd===1?`${upTxt}`:spd===0?`同速（${sa} 対 ${so}。どちらが先に動くかは五分）`:tr?`トリックルーム中でも相手が先（${sa} 対 ${so}。相手の方が遅い）`:`素早さで下になる（${sa} 対 ${so}）`;
  /* 後出し（2026/11/10 依頼主の検証）：交代で受ける1発目と、そのあとの撃ち合いを分ける。
     win＝1発目を耐え、そこから撃ち合っても先に倒せる／survive＝1発目は耐えるが撃ち合いでは負ける（受けてまた交代する役）／no＝1発目で倒される */
  /* 2026/11/10 依頼主の検証⑤：1発目を耐えるのがきあいのタスキ・がんじょうのおかげだけなら「タスキ頼み」＝後出しできるに数えない（1回きりで、砂嵐・連続技・設置技で崩れる） */
  const swSash=!!op&&opW>=2&&opW<9&&opRaw<2;
  /* 2026/11/10 依頼主の確認①：タスキでHP1で耐えたあと、先に動いて一撃で倒せるなら「条件つきで後出しできる」（sashwin）。
     かるわざなら、タスキがなくなって素早さ2倍。相手の先制技・砂嵐（いわ・じめん・はがね以外）・連続技（タスキが効かない＝opW 1）では崩れる */
  const ub=a.ab==='unburden'&&a.item==='focussash',sa2=ub?sa*2:sa,fast2=tr?sa2<so:sa2>so,fast1=tr?sa<so:sa>so;
  /* 2026/11/10 依頼主の確認：条件つき後出し（sashwin）は「確実に」成り立つときだけ。
     ①交代時はHP満タン（前提）②1発目は相手の乱数最小でも100%以上＝きあいのタスキが必ず発動してHP1（最大だけ100%以上なら、発動しないことがある）
     ③かるわざが要るなら、タスキが必ず発動するときだけ素早さ2倍（同速は不可）④こちらの乱数最小で確定1発（相手のタスキ・がんじょう・マルチスケイルも入れた回数）
     ⑤成り立たない：相手の連続技（どれか1つでも持っていればタスキが効かない）・ダメージを与える先制技・砂嵐（いわ・じめん・はがね以外）・設置技（集計で10%以上使う）・接触で反動を返す特性や持ち物 */
  const sandChip=!!(B.weather&&B.weather.k==='sand'&&!a.p.t.some(x=>['いわ','じめん','はがね'].includes(x)));
  const opPrHit=!!(opPr&&opPr.max>0);
  const multiMv=(o.moves||[]).find(m=>m&&m.maxH>1&&(()=>{try{return bcalc(o,m,a,{r:100}).dmg>0}catch(e){return false}})());
  const cntRisk=['rough-skin','iron-barbs'].includes(o.ab)||o.item==='rockyhelmet';
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
  const swIn=!op||opW>=9?'win':opW<2?'no':swSash?(sashWin?'sashwin':'sash'):swOk?'win':'survive';
  const swLeft=op?Math.max(0,100-op.fmax):100;
  const swTxt=!op?'相手に効く技がないので交代で受けられる':opW<2?`交代で受ける1発目（${op.mvn} 最大${dgPct(op.fmax)}）で倒される`:swSash&&sashWin?`条件つきで後出しして勝てる：${sashWhy}。${sashCond}`:swSash?`交代で受ける1発目：${op.mvn}で${dgPct(op.fmin)}〜${dgPct(op.fmax)}。${a.item==='focussash'?'きあいのタスキ':'がんじょう'}で耐えても、${blockTxt}ので、後出しできるとは数えない`:`交代で受ける1発目：${op.mvn}で最大${dgPct(op.fmax)}（残りHPは少なくとも${Math.round(swLeft)}%）→ そのあと${swIn==='win'?`撃ち合っても先に倒せる（こちら${dgKoTxt(me)}、相手はあと${opW-1}発必要）`:'撃ち合いでは先に倒される（受けてもう一度交代する役なら可）'}`;
  let k='lose',why=[];
  const wxT=B.weather&&B.weather.team?`${{sun:'晴れ',rain:'雨',sand:'砂嵐',snow:'雪'}[B.weather.k]}の中で計算（パーティの${B.weather.team.by}の${ABN[B.weather.team.ab]||'特性'}で${{sun:'晴れ',rain:'雨',sand:'砂嵐',snow:'雪'}[B.weather.k]}にしてから戦う前提）`:'';
  const meTxt=me?`${me.mvn}で${dgDmgTxt(me,'op')}（${dgKoTxt(me)}）`:'効く技がない';
  const opTxt=op?`相手の${op.mvn}で${dgDmgTxt(op,'me')}（${dgKoTxt(op)}）`:'相手に効く技がない';
  if((first===1&&winSafe)||prKO){k='ko_fast';
    if(prKO&&!(first===1&&winSafe))why.push(`${spd===0?'同速だが':'遅いが'}先制技の${pr.mvn}で${dgDmgTxt(pr,'op')}（確定1発）`);
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
  if(me&&me.half)why.push(me.h>1?`相手の${ABN[me.half]||'特性'}：相手のHPが満タンのとき、こちらの${me.mvn}（1回で${me.h}回当たる）は最初の当たりだけ半分、2回目の当たりからは半分にならない（1回目と2回目の当たりを乱数ごとに別々に計算して足し、倒すまでの回数を数えています）`:`相手の${ABN[me.half]||'特性'}：相手のHPが満タンのとき、こちらの攻撃の1発目だけダメージが半分になる（倒すまでの回数はこれを入れて数えています）`);
  if(op&&op.half)why.push(`こちらの${ABN[op.half]||'特性'}：こちらのHPが満タンのとき、相手の攻撃の1発目だけダメージが半分になる`);
  if(sash&&me&&me.max>=100)why.push(`相手は${o.item==='focussash'?'きあいのタスキ':'がんじょう'}なので満タンからは一撃で倒せない（計算に入れています）`);
  /* 見出し：上から一撃（確定）と、上から2発以上で倒しきる を分ける */
  /* 2026/11/10：遅い（同速）のに先制技のとどめで先に倒しきれるときは「上から」と書かない */
  const t=k==='ko_fast'?(prKO&&!(first===1&&winSafe)?'先制技で倒せる':spd!==1&&!tr?`先制技のとどめで${myN}発で倒しきれる`:myN===1?'上から一撃（確定）':`上から${myN}発で倒しきれる`):DG_K[k].t;
  return{k,r:DG_K[k].r,t:tr&&k==='ko_fast'?t.replace(/^上から/,'トリル中に先に動いて'):t,why,tr,wxTeam:!!wxT,me,op,spd,first,sa,so,myN,opW,pr,spdTxt,swIn,swTxt,swLeft,sa2,sashBlock,sashSure};
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
  const have=Object.keys(LIVE.csv).filter(k=>LIVE.csv[k]).sort((a,b)=>a-b).join('.');
  const tp=typeof TOPT!=='undefined'&&typeof topReady==='function'&&topReady()?TOPT.at+':'+TOPT.n:'0';
  return [FMT,rk,have,tp].join('|');
}
/* パーティ（entries）× 相手（metaOpps）の表。相手の型は使用率の高い型（detSet）。集計の有無も返す */
/* 同じパーティ・形式・集計の読み込み状況なら、計算を使い回す（パーティのチェックと「相手ごとの対応力」で同じ結果を使う） */
const DG_CACHE={};
function dgTeam(entries,n){
  n=n||20;
  const key=JSON.stringify([n,dgDataSig(),entries.map(x=>[x.no,x.set||0])]);
  if(DG_CACHE.k===key)return DG_CACHE.v;
  const v=dgTeam0(entries,n);DG_CACHE.k=key;DG_CACHE.v=v;return v;
}
function dgTeam0(entries,n){
  const ms=entries.map(x=>({x,p:byNo[x.no]})).filter(o=>o.p);
  /* 入れかえ案の匹は、その匹のために組んだ育成（x.set）で計算する（パーティにいない匹は teamSet で引けないため） */
  const M=ms.map(o=>{try{return mkMon(o.p,'me',(o.x.set&&!team.includes(o.x)&&savedToCalc(o.x.no,o.x.set))||mySetFor(o.x.no))}catch(e){return null}});
  const fam=q=>q.base||q.no;
  const opps=metaOpps(n).filter(q=>!ms.some(o=>fam(o.p)===fam(q)));
  const rows=opps.map(q=>{
    const live=!!(LIVE.csv[q.base||q.no]);
    let o;try{o=mkMon(q,'op',q.base&&byNo[q.base]?{...detSet(byNo[q.base]),ab:q.ab,item:null}:detSet(q))}catch(e){return null}
    const run=oo=>M.map((a,i)=>{if(!a)return null;try{return{i,...dgMatch(a,oo)}}catch(e){return null}}).filter(Boolean);
    let res=run(o),abAssume=null;
    /* 2026/11/10 依頼主の確認（カイリューのマルチスケイル）：集計がない相手は特性が分からない。自動の型は隠れ特性でない最初の特性（カイリューならせいしんりょく）を選ぶので、
       持てる特性ごとに計算し、結果が変わるときは、こちらにいちばん不利な特性で計算する（推測で有利と言わない）。メガシンカの姿は特性が1つなのでそのまま */
    if(!live&&!q.base){const abs=[...new Set((ABD[q.no]||[]).map(z=>z[0]))];
      if(abs.length>1){const lvOf=rs=>{const st=rs.filter(r=>r.r>=4).length,ok=rs.filter(r=>r.r>=3).length,wk=rs.filter(r=>r.r===2).length;return st>=2?4:st===1?3:ok||wk?2:1};
        const sumR=rs=>rs.reduce((t,r)=>t+r.r,0),swN=rs=>rs.filter(r=>r.swIn==='win').length;
        const V=abs.map(ab=>{const oo={...o,ab};return{ab,oo,rs:ab===o.ab?res:run(oo)}});
        V.sort((x,y)=>lvOf(x.rs)-lvOf(y.rs)||sumR(x.rs)-sumR(y.rs)||swN(x.rs)-swN(y.rs)||(x.ab===o.ab?-1:y.ab===o.ab?1:0));
        const sig=rs=>rs.map(r=>r.k+r.swIn).join();
        if(V[0].ab!==o.ab||V.some(v=>sig(v.rs)!==sig(V[0].rs)))abAssume={ab:V[0].ab,alts:abs.filter(k=>k!==V[0].ab),auto:o.ab};
        o=V[0].oo;res=V[0].rs}}
    const stable=res.filter(r=>r.r>=4),ok=res.filter(r=>r.r>=3),weak=res.filter(r=>r.r===2);
    const lvl=stable.length>=2?4:stable.length===1?3:ok.length||weak.length?2:1;
    return{q,o,live,res,stable,ok,weak,lvl,abAssume};
  }).filter(Boolean);
  /* トリックルーム構築（2026/11/10 依頼主）：トリックルームを張れる匹（登録した技。技が未登録なら覚えられる匹）がいて、
     パーティの半分より多くが、上位の相手の7割以上より遅いとき。そのときは全部の対面をトリックルーム中（遅い方が先）でも計算する */
  const TRID=+Object.keys(MD).find(i=>MD[i][3]==='trickroom');
  /* 2026/11/10 依頼主の指摘（ブリムオン・リキキリン・コータス…が「晴れ・対面」になった）：技を登録していても、その中にトリックルームが無いと
     張れる匹に数えていなかった。覚えられる匹は「張れる候補」（reg:false）として数え、技に入っていないことは別に知らせる */
  const setters=ms.map((o,i)=>{const mv=o.x.set&&o.x.set.mv&&o.x.set.mv.length?o.x.set.mv:null;
    const reg=!!mv&&mv.some(m=>m&&m.id===TRID),can=(LSD[o.p.no]||LSD[o.p.base]||[0,[]])[1].includes(TRID);
    return reg||can?{i,reg,mv:!!mv}:null}).filter(Boolean);
  const slow=M.map((a,i)=>i).filter(i=>rows.length&&rows.filter(r=>{const z=r.res.find(x=>x.i===i);return z&&z.sa<z.so}).length>=rows.length*.7);
  const tr={on:!!setters.length&&slow.length*2>ms.length,setters,slow,unset:!setters.some(s=>s.reg)};
  if(tr.on){DG_TR=true;try{rows.forEach(r=>{r.resTR=M.map((a,i)=>{if(!a)return null;try{return{i,...dgMatch(a,r.o)}}catch(e){return null}}).filter(Boolean);
    const st=r.resTR.filter(x=>x.r>=4),okk=r.resTR.filter(x=>x.r>=3),wk=r.resTR.filter(x=>x.r===2);r.lvlTR=st.length>=2?4:st.length===1?3:okk.length||wk.length?2:1})}finally{DG_TR=false}}
  /* 計算に入っていない特性（ABIMPL にないもの）を、こちら・相手ともに書き出す（推測で計算したことにしない） */
  const unk=new Map();const addU=(m,who)=>{if(m&&m.ab&&ABN[m.ab]&&(DG_SIMONLY.has(m.ab)||(typeof ABIMPL!=='undefined'&&!ABIMPL.has(m.ab))))unk.set(who+m.p.n,`${m.p.n}の${ABN[m.ab]}`)};
  M.forEach(m=>addU(m,'me'));rows.forEach(r=>addU(r.o,'op'));
  return{ms,M,rows,live:rows.some(r=>r.live),liveAll:rows.every(r=>r.live),mySet:ms.map(o=>!!(o.x.set&&o.x.set.mv&&o.x.set.mv.length)),unk:[...unk.values()],tr};
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
      <p class="dg-why">${L[1]}${r.live?'':'（この相手は使用率の集計が読めていないため、自動で決めた型で計算）'}${r.abAssume?`。特性が分からないので、こちらにいちばん不利な${esc(ABN[r.abAssume.ab]||r.abAssume.ab)}で計算（ほかに${r.abAssume.alts.map(k=>esc(ABN[k]||k)).join('・')}もある）`:''}</p>
      ${r.resTR?(()=>{const bt=[...r.resTR].sort((a,b)=>b.r-a.r).slice(0,2);return `<p class="dg-why"><b>トリックルーム中：${DG_LV[r.lvlTR][0]}</b> ${bt.map(x=>`${nm1(x.i)}は${x.t}`).join('／')}</p>`})():''}
      ${typeof dguMatchHTML==='function'?(()=>{const all=[...r.res].sort((a,b)=>b.r-a.r),rest=all.slice(3);const one=x=>dguMatchHTML(x,r.q.n,formInfo(T.ms[x.i].p).base);
        return best.map(one).join('')+(rest.length?`<details class="dgc-ev"><summary>ほかの${rest.length}匹の対面を見る</summary>${rest.map(one).join('')}</details>`:'')})()
      :`<ul>${best.map(x=>`<li><b>${nm1(x.i)}</b>（こちら）は <span class="dg-k dg-k${x.r}">${x.t}</span>：${x.why.map(esc).join('／')}<small>素早さ：${nm1(x.i)} ${x.sa} 対 ${esc(r.q.n)} ${x.so}（${x.spd===1?'こちらが先':x.spd===0?'同速':'相手が先'}）</small></li>`).join('')}</ul>`}</details>`};
  const order=[...T.rows].sort((a,b)=>a.lvl-b.lvl);
  el.innerHTML=`<div class="sec"><h2>相手ごとの対応力（計算）</h2><span style="font-size:12px;color:var(--dim)">${FMTN()}</span></div>
    <p class="note" style="padding-top:0">使用率の上位${T.rows.length}匹（パーティにいる種類は除く）に、1匹ずつ実際のダメージ計算と素早さで「先に倒せるか・耐えて倒せるか・後出しできるか」を見ています。弱点を突けるだけでは「対応できる」にしません。</p>
    ${typeof dguBars==='function'?dguBars({4:cnt(4),3:cnt(3),2:cnt(2),1:cnt(1)},T.rows.length):`<div class="dg-sum">${[4,3,2,1].map(l=>`<div class="dg-s dg-${DG_LV[l][2]}"><span>${DG_LV[l][0]}</span><b class="num">${cnt(l)}</b></div>`).join('')}</div>`}
    ${T.tr&&T.tr.on?`<p class="note" style="padding-top:6px"><b>トリックルーム中</b>（${T.tr.setters.map(s=>nm1(s.i)).join('・')}が張ったとき・遅い方が先に動く）：${[4,3,2,1].map(l=>`${DG_LV[l][0]}${T.rows.filter(r=>r.lvlTR===l).length}`).join('　')}。上の数はトリックルームなし。</p>`:''}
    <p class="note" style="padding-top:4px">◎ 2匹以上で安定　○ 1匹に頼っている　△ 不安定　× 答えなし（押すと計算の中身）。◎〜×は先に場にいるとき（対面）の評価で、交代で出したときに勝てる匹は「後出し」に書いています（後出しして勝てる匹がいる相手：${T.rows.filter(r=>r.res.some(x=>x.swIn==='win')).length}／${T.rows.length}匹、条件つき〔きあいのタスキ・かるわざ頼み〕だけの相手：${T.rows.filter(r=>!r.res.some(x=>x.swIn==='win')&&r.res.some(x=>x.swIn==='sashwin')).length}匹）。</p>
    <details class="dgc-ev dg-list"><summary>相手ごとの詳細を見る（${T.rows.length}匹：×${cnt(1)}・△${cnt(2)}・○${cnt(3)}・◎${cnt(4)}の順）</summary>${order.map(rowHTML).join('')}</details>
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
    d:'交代で出たときに受ける1発目（相手のいちばん痛い技・乱数最大）を耐え、そのあとの撃ち合いでも先に倒せる匹がいません。1発目を耐えられる匹がいれば「受けてもう一度交代する」ことはできますが、その匹だけでは倒しきれません。きあいのタスキ・がんじょうで1だけ残ってから先に一撃で倒せる場合は「条件つき」として分けています（タスキは1回きりで、先制技・連続技・砂嵐・設置技で崩れるので安定とは数えません）。対面で先に場にいれば勝てる匹がいても、交代で出すと負けます。',
    ev:list([...noSwC,...noSw.filter(r=>!swC(r).length)],r=>{const c=swC(r)[0];if(c)return `${qn(r)}：【条件つき】${nm(c.i)}は${c.swTxt}`;const s=swSurv(r).sort((a,b)=>a.op.max-b.op.max)[0]||r.res.filter(z=>z.op).sort((a,b)=>a.op.max-b.op.max)[0];return s?`${qn(r)}：${nm(s.i)}は${s.swTxt}`:qn(r)}),
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
    if(T.tr.unset&&T.tr.setters.some(x=>x.mv))bad.push({area:'素早さ',sev:2,t:'遅い匹が多いのに、トリックルームの技が入っていない',d:'パーティの半分より多くが遅いトリックルーム向きの形ですが、登録した技にトリックルームがありません。いまのままだと、遅いまま上から攻撃されます。',
      ev:T.tr.setters.map(x=>`${nm(x.i)}はトリックルームを覚えられる`),how:`${T.tr.setters.map(x=>nm(x.i)).slice(0,2).join('か')}の技にトリックルームを入れると、下の「トリックルーム中」の計算どおりに戦えます（パーティの画面の「おすすめの型でまとめて埋める」もトリックルーム入りで組みます）。`});
    const sN=T.tr.setters.length;
    (sN<=1?bad:good).push({area:'素早さ',sev:sN<=1?2:0,t:sN<=1?`トリックルームを張れるのが${nm(T.tr.setters[0].i)}だけ`:`トリックルームを張れる匹が${sN}匹（${T.tr.setters.map(s=>nm(s.i)).join('・')}）`,
      d:sN<=1?'張る役が先に倒されると、遅い匹がそのまま上から攻撃されます。':'',ev:T.tr.setters.filter(s=>!s.reg).map(s=>s.mv?`${nm(s.i)}は覚えられるが、いまの技にトリックルームが入っていない`:`${nm(s.i)}は技が未登録のため「覚えられる」で数えています`),how:sN<=1?'トリックルームを張れる2匹目を入れると安定します。':''});
  }else if(slowAll.length){const pr=r=>r.res.filter(z=>z.pr&&z.pr.min>0).sort((a,b)=>b.pr.min-a.pr.min)[0];
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
  const used=new Set(rest.map(x=>{const s=(x.set&&x.set.it&&x.set.it.k)||((mySetFor(x.no)||{}).item);return s}).filter(Boolean));
  let s=null,src='型の例';
  if(LIVE.csv[c.no]){try{s=detSet(c);src='使用率の高い型'}catch(e){s=null}}
  if(s&&s.item&&used.has(s.item)){s=null}
  if(!s){try{s=archSet(['axis'],c,null,new Set(used));src='型の例'}catch(e){s=null}}
  if(!s)return null;
  const mv=(s.moves||[]).map(m=>typeof m==='number'?{id:m,n:mName(m)}:m&&m.prot?{id:182,n:'まもる'}:m&&m.id>0?{id:m.id,n:mName(m.id)}:null).filter(Boolean);
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
  const key=JSON.stringify([FMT,entries.map(x=>[x.no,x.set||0,!!x.axis]),Object.keys(LIVE.csv).length]);
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
    sc.forEach(({c,S,won})=>{let T1;try{T1=dgTeam0(entries.map((x,k)=>k===i?{no:c.no,sel:!!x.sel,set:S.sv}:x),20)}catch(e){return}
      const D=dgDiff(T,T1),b=D.b,a=D.a;
      if(a.nosw<b.nosw&&a.x<=b.x&&a.w<=b.w&&a.ohko<=b.ohko)res.push({i,c,S,won:won.map(r=>r.q.n),b,a,D,gain:(b.nosw-a.nosw)*2+(b.ohko-a.ohko)+(b.w-a.w)+(b.slow-a.slow)*.5})})});
  res.sort((x,y)=>y.gain-x.gain);
  const used=new Set(),out=res.filter(r=>{if(used.has(r.c.no))return false;used.add(r.c.no);return true}).slice(0,3);
  DG_FIX.set(key,out);return out;
}
/* パーティのチェックの「計算の前提」に足す文（未対応のこと） */
function dgPremise(T){
  return `相手は使用率の上位${T.rows.length}匹（${T.liveAll?'ランクバトルの集計から組んだ使用率の高い型':T.live?'集計が読めた相手は使用率の高い型、ほかは自動で決めた型':'自動で決めた型。ランクバトルの集計を読めていません'}）。`+
    `${FMT==='double'?'ダブルでも1対1で計算しています（範囲技の0.75倍・2匹同時の動き・味方のサポートは入れていません）。':''}`+
    `${T.rows.some(r=>r.abAssume)?`集計がない相手で特性によって結果が変わるときは、こちらにいちばん不利な特性で計算しています（${T.rows.filter(r=>r.abAssume).slice(0,4).map(r=>`${r.q.n}＝${ABN[r.abAssume.ab]||r.abAssume.ab}`).join('・')}${T.rows.filter(r=>r.abAssume).length>4?' ほか':''}）。`:''}${T.unk.length?`計算に入っていない特性：${T.unk.slice(0,8).join('、')}${T.unk.length>8?' ほか':''}。`:''}${DG_NOTE}`;
}

/* ===================== 構築の型のバッジ（2026/11/10 依頼主：パーティの6匹の右上に、どういう型か分かる札） =====================
   ・天気：パーティに天気を作る特性の匹（teamWx、メガストーンならメガ後の特性）
   ・トリックルーム：dgTeam の tr（張れる匹がいて、半分より多くが遅い）
   ・おいかぜ：登録した技におかぜ
   ・対面／サイクル／積み：teamKind（登録した持ち物・技から。3匹以上の育成が要る）
   押すとその型の解説（#/arch/ID）。決まらないときは灰色の「型：判定中」 */
const ARCH_BADGE={sun:['晴れ','sun'],rain:['雨','rain'],sand:['砂嵐','sand'],snow:['雪','snow'],tr:['トリックルーム','tr'],tailwind:['おいかぜ','tailwind'],tm:['対面','taimen'],ac:['攻めサイクル','cycle'],dc:['受けサイクル','cycle'],su:['積み','setup']};
function teamArch(entries){
  const out=[];if(!entries||!entries.length)return out;
  /* トリックルームを先に出す（晴れトリルのように天気と重なるときも、トリックルームが主な戦い方なので） */
  if(entries.length>=3){try{const T=dgTeam(entries,20);if(T.tr&&T.tr.on)out.push({k:'tr',unset:T.tr.unset,why:`${T.tr.setters.map(s=>formInfo(T.ms[s.i].p).base).join('・')}が${T.tr.unset?'覚えられて（いまの技には未登録）':'張れて'}、${T.tr.slow.length}匹が遅い`})}catch(e){}}
  try{const w=teamWx();if(w){const gain=entries.filter(x=>{try{const m=mkMon(byNo[x.no],'me',mySetFor(x.no));return (WX_GAIN[w.k]||[]).includes(m.ab)}catch(e){return false}}).map(x=>formInfo(byNo[x.no]).base);
    out.push({k:w.k,why:`${w.by}の${ABN[w.ab]||'特性'}で天気を変える${w.guess?'（特性が未登録なので、この特性と仮定）':''}${gain.length?`（${gain.join('・')}が得をする）`:''}`})}}catch(e){}

  const TW=+Object.keys(MD).find(i=>MD[i][3]==='tailwind');
  const tw=entries.filter(x=>x.set&&(x.set.mv||[]).some(m=>m&&m.id===TW));if(tw.length)out.push({k:'tailwind',why:`${tw.map(x=>formInfo(byNo[x.no]).base).join('・')}がおいかぜを使う`});
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
