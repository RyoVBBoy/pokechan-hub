/* ===================== 攻略ガイド：ポケモンごとの解説（当サイトのオリジナルの文章） =====================
   ほかのサイトの記事は使わず、このサイトのデータ（種族値・タイプ相性・覚える技・特性）だけから組み立てる。
   図鑑の「解説」タブ（#/p/番号）と、検索向けの静的ページ（tools/gen-pages.cjs）で使う。
   「型の例」は計算で組んだもので、実際によく使われている型とは違うことがある（画面にもそう書く）。 */
const GM_PSET=['swordsdance','dragondance','bulkup','bellydrum','shiftgear','coil','tidyup','curse','noretreat','victorydance','howl','honeclaws','filletaway'];
const GM_SSET=['nastyplot','quiverdance','calmmind','tailglow','geomancy','takeheart'];
const GM_BSET=['shellsmash','growth','workup'];
const GM_HEAL=['recover','roost','slackoff','milkdrink','morningsun','synthesis','moonlight','softboiled','shoreup','strengthsap','junglehealing','lifedew','wish'];
const GM_SUP=['reflect','lightscreen','auroraveil','stealthrock','spikes','toxicspikes','stickyweb','taunt','thunderwave','willowisp','toxic','encore','yawn','trickroom','tailwind','partingshot','memento','healingwish','glare','nuzzle'];
const GM_DBL=['fakeout','followme','ragepowder','helpinghand','allyswitch','wideguard'];
const GM_PIV=['uturn','voltswitch','flipturn','partingshot'];
const GM_RECH=new Set(['hyperbeam','gigaimpact','blastburn','hydrocannon','frenzyplant','rockwrecker','roaroftime','prismaticlaser','eternabeam','meteorassault']);
const GM_WN={sun:'はれ',rain:'あめ',sand:'すなあらし',snow:'ゆき'};
/* 特性で変わるタイプ相性（受ける側）。0＝無効、数字＝倍率にかける */
const AB_DEF={'levitate':{'じめん':0},'flash-fire':{'ほのお':0},'well-baked-body':{'ほのお':0},'water-absorb':{'みず':0},'storm-drain':{'みず':0},'dry-skin':{'みず':0,'ほのお':1.25},
  'volt-absorb':{'でんき':0},'lightning-rod':{'でんき':0},'motor-drive':{'でんき':0},'sap-sipper':{'くさ':0},'earth-eater':{'じめん':0},
  'thick-fat':{'ほのお':.5,'こおり':.5},'heatproof':{'ほのお':.5},'water-bubble':{'ほのお':.5},'purifying-salt':{'ゴースト':.5},'fluffy':{'ほのお':2}};
/* 特性も入れたタイプ相性：どの特性でも同じように変わるなら確定（by）、特性しだいなら maybe に変わったあとの倍率 */
function monDef(p){
  const abs=(ABD[p.no]||(p.ab?[[p.ab,0]]:[])).map(a=>a[0]);
  return defTable(p.t).map(([t,m])=>{
    const vals=abs.map(k=>AB_DEF[k]&&AB_DEF[k][t]!=null?(AB_DEF[k][t]===0?0:m*AB_DEF[k][t]):m);
    const all=abs.length>0&&vals.every(v=>v===vals[0])&&vals[0]!==m,some=!all&&vals.some(v=>v!==m);
    return{t,m:all?vals[0]:m,base:m,by:all?abs[0]:null,maybeBy:some?abs[vals.findIndex(v=>v!==m)]:null,maybe:some?vals.find(v=>v!==m):null};
  });
}
/* 特性の分も入れた弱点の説明（「特性ふゆうで、じめん技は効かない」など） */
const defNotes=p=>monDef(p).filter(x=>x.by||x.maybeBy).map(x=>{const k=x.by||x.maybeBy,v=x.by?x.m:x.maybe;
  return `${x.by?'':'特性が'}${x.by?'特性'+(ABN[k]||k)+'で':(ABN[k]||k)+'なら'}、${x.t}技は${v===0?'効かない':v<x.base?'受けるダメージが半分になる':'受けるダメージが増える'}`});
/* 苦手な相手を探すときの相手：合計種族値の高い60匹＋メガシンカの姿20匹 */
let GM_OPPS=null;
const gmOpps=()=>{if(GM_OPPS)return GM_OPPS;const bst=a=>a.s.reduce((x,y)=>x+y,0),top=(a,n)=>a.filter(q=>q&&q.s).sort((x,y)=>bst(y)-bst(x)).slice(0,n);
  return GM_OPPS=[...top(P,60),...top(MEGAP,20)]};
const gsetIndex=(S,no)=>['single','double'].map(f=>{const a=S.map((x,i)=>[x,i]).filter(([x])=>x.fmt===f);return a.length?`<div class="gidx"><span>${f==='single'?'シングル':'ダブル'}</span>${a.map(([x,i])=>`<a href="javascript:void 0" data-gjump="gset-${no}-${i}">${esc(x.title)}${x.rec?'<i>おすすめ</i>':''}</a>`).join('')}</div>`:''}).join('');
document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('[data-gjump]');if(!a)return;e.preventDefault();const t=document.getElementById(a.dataset.gjump);if(t)t.scrollIntoView({behavior:'smooth',block:'start'})});
/* ランクバトルの使用率（LIVE）の上位：持ち物・特性・技・性格 */
function gmLiveHTML(p,lk){
  const d=LIVE.csv[p.no];if(!d)return '';
  const row=(t,a,f)=>a.length?`<div class="gus"><b>${t}</b><div>${a.map(x=>`<span>${f(x)} <i>${x[x.length-1]}%</i></span>`).join('')}</div></div>`:'';
  const itK=n=>ITEMN[nrm(n)]?nrm(n):null,abK=n=>ABK[nrm(n)],mvK=n=>MVKA[nrm(n)];
  return `<div class="sec"><h2>ランクバトルでの使われ方</h2><span style="font-size:12px;color:var(--dim)">${FMTN()}</span></div>
    <div class="gdoc" style="padding-top:0">${row('持ち物',d.it.slice(0,5),x=>{const k=itK(x[0]);return k?`<a href="${lk('#/item/'+k)}" style="color:var(--acc)">${esc(ITEMN[k])}</a>`:esc(x[0])})}${row('特性',d.ab.slice(0,3),x=>{const k=abK(x[0]);return esc(k?ABN[k]:x[0])})}${row('技',d.mv.slice(0,8),x=>{const id=mvK(x[0]);return id?`<a href="${lk('#/move/'+id)}" style="color:var(--acc)">${esc(mName(id))}</a>`:esc(x[0])})}</div>
    <p class="note" style="padding-top:0;color:var(--mute)">出典：<a href="https://championsbattledata.com" target="_blank" rel="noopener" style="color:var(--acc)">Pokémon Champions Battle Data</a>の集計（${FMTN()}）。形式は上のメニューや流行の画面で切りかえられます。</p>`;
}
function monGuide(p,o={}){
  const mon=o.mon||(no=>'#/p/'+no),lk=o.link||(h=>h);
  /* メガシンカの姿は、元のポケモンの覚える技と、メガシンカ後の特性1つで考える */
  const base=p.base?byNo[p.base]:null;
  const ls=LSD[p.no]?LSD[p.no][1]:base&&LSD[base.no]?LSD[base.no][1]:[];
  /* 2026/11/16 依頼主に届いた報告（ギルガルドが「攻撃50・特攻50と火力が低い」）：戦闘中に姿が変わる匹は、計算と同じ姿の能力で考える
     （ギルガルド＝攻撃するときはブレードフォルムの攻撃・特攻、イルカマン＝いつもマイティフォルム。15-battle.js の BATTLE_FORM） */
  const bfm=typeof BATTLE_FORM!=='undefined'?Object.values(BATTLE_FORM).find(b=>b.no===p.no):null;
  const ps=bfm?(bfm.always?[...bfm.s]:p.s.map((v,i)=>i===1||i===3?bfm.s[i]:v)):p.s;
  const bfl=i=>bfm&&(bfm.always||i===1||i===3)?`（${bfm.name}）`:'';
  const rk=i=>bfm?1+RANKP.filter(q=>q.s[i]>ps[i]).length:p.rank?p.rank[i]:1+P.filter(q=>q.s[i]>p.s[i]).length;
  const stoneK=base?Object.keys(MEGA).find(k=>MEGA[k][base.no]===p.no):null;
  const key=id=>MD[id]&&MD[id][3];
  const have=keys=>ls.filter(id=>keys.includes(key(id))).sort((a,b)=>keys.indexOf(key(a))-keys.indexOf(key(b)));
  const share=f=>{const v=f({...p,s:ps});return P.filter(q=>q.no!==p.no&&f(q)<v).length/Math.max(1,P.length-1)};
  const lvl=x=>x>=.8?'とても高い':x>=.6?'高め':x>=.4?'ふつう':x>=.2?'低め':'とても低い';
  const [h,A,B,C,D,S]=ps;
  const side=A>=C+10?0:C>=A+10?1:2,ai=side===1?3:side===0?1:(A>=C?1:3);
  const offS=share(q=>Math.max(q.s[1],q.s[3])),spdS=share(q=>q.s[5]);
  const pbS=share(q=>(q.s[0]+75)*(q.s[2]+20)),sbS=share(q=>(q.s[0]+75)*(q.s[4]+20)),bulkS=Math.max(pbS,sbS);
  const sr=spdRank(maxSpe(p),p.no);if(p.base)sr.n=P.length;
  /* タイプ相性は特性の分も入れる（ふゆうのじめん無効など。特性しだいのものは入れない） */
  const md=monDef(p),tb=md.map(x=>[x.t,x.m]),weak=tb.filter(x=>x[1]>=2).sort((a,b)=>b[1]-a[1]),res=tb.filter(x=>x[1]<1),imm=tb.filter(x=>x[1]===0);
  const abl=ABD[p.no]||(p.ab?[[p.ab,0]]:[]),abK=abl.map(a=>a[0]);
  const mvA=id=>`<a class="pill gchip" href="${lk('#/move/'+id)}">${esc(mName(id))}</a>`;
  const abA=k=>`<a href="${lk('#/ability/'+k)}" style="color:var(--acc)">${esc(ABN[k]||k)}</a>`;
  const itA=k=>`<a href="${lk('#/item/'+k)}" style="color:var(--acc)">${esc(ITEMN[k]||k)}</a>`;
  const list=a=>a.join('・');
  /* 攻撃技：威力・命中・タイプ一致・失敗しやすさから点数をつける（対戦シミュレーターと同じ考え方） */
  const mx=Math.max(A,C);
  const atk=ls.filter(id=>MV[id]&&!GM_RECH.has(key(id))&&key(id)!=='fakeout').map(mvObj).filter(m=>m.pow>0&&m.cls<2);
  const sc=m=>{let v=m.pow*(m.acc>0?m.acc:100)/100*Math.pow((m.cls?C:A)/mx,2)*simF(null,m);
    if(p.t.includes(m.t))v*=1.5;if(m.maxH>1)v*=m.minH===m.maxH?m.maxH:3.1;if(m.tg)v*=.85;if(m.pri>0)v*=1.1;if(m.drain<0)v*=.92;return v};
  const pickAtk=(n,fix=[])=>{const ch=[...fix],cov=new Set();ch.forEach(m=>T.forEach(d=>{if(mult(m.t,[d])>=2)cov.add(d)}));
    const pool=atk.filter(m=>side===2||m.cls===(ai===1?0:1));
    while(ch.length<n){let best=null;
      pool.forEach(m=>{if(ch.some(c=>c.id===m.id))return;const nc=T.filter(d=>!cov.has(d)&&mult(m.t,[d])>=2).length,same=ch.filter(c=>c.t===m.t).length;
        const v=sc(m)*(1+.15*nc)*(same?.35:1)*(!p.t.includes(m.t)&&!nc?.6:1)*(['thrash','outrage','petaldance','ragingfury'].includes(key(m.id))&&!p.t.includes(m.t)?.7:1);if(!best||v>best.v)best={m,v}});
      if(!best)break;ch.push(best.m);T.forEach(d=>{if(mult(best.m.t,[d])>=2)cov.add(d)})}
    return ch.filter(m=>!fix.includes(m)).map(m=>m.id)};
  const stab=atk.filter(m=>p.t.includes(m.t)).sort((a,b)=>sc(b)-sc(a));
  const bestStab=stab.filter(m=>side===2||m.cls===(ai===1?0:1));
  const prio=atk.filter(m=>m.pri>0&&(p.t.includes(m.t)||offS>=.6));
  /* 特性：役に合うものを選ぶ（ABILITY_ROLES の分類を使う） */
  const pickAb=pref=>{for(const r of pref){const k=abK.find(k=>abRoles(k).some(x=>x[0]===r));if(k)return k}const k=abK.find(k=>abRoles(k).length);if(k)return k;const n=abl.find(a=>!a[1]);return n?n[0]:abK[0]};
  const setup=have(side===1?GM_SSET:side===0?GM_PSET:[...GM_PSET,...GM_SSET]).concat(have(GM_BSET));
  const heal=have(GM_HEAL),sup=have(GM_SUP),dbl=have(GM_DBL),piv=have(GM_PIV),tr=have(['trickroom']);
  const wset=abK.find(k=>WSET[k]),wspd=abK.find(k=>WSPD[k]);
  const atkName=ai===1?'物理':'特殊',atkStat=SN[ai];
  /* ---- 型を組む ---- */
  const lowDef=B<=D?2:4;
  /* 技が4つに満たないときは、攻撃技で埋める */
  const mkSet=(title,why,ab,item,up,dn,sp,moves)=>({title,why,ab,item,up,dn,sp,moves:[...new Set([...moves.filter(Boolean),...pickAtk(4)])].slice(0,4)});
  const spOf=(a,b)=>{const s=[0,0,0,0,0,0];s[a]=32;s[b]=32;const r=[0,lowDef,4,2,5].find(i=>i!==a&&i!==b);s[r]=2;return s};
  const sets={
    attacker:()=>{const item=spdS<.35?'expertbelt':spdS<.7?'choicescarf':'lifeorb';
      const why=item==='choicescarf'?`素早さが中くらいなので、${ITEMN.choicescarf}で上から攻撃できる相手を増やす。`:item==='lifeorb'?`素早さが高いので、技を固定されない${ITEMN.lifeorb}で火力を上げる。`:`素早さは低いが${atkStat}が高いので、${ITEMN[item]}で弱点を突いたときの火力を上げ、受けに来た相手も押し切る。`;
      return mkSet(`${atkName}アタッカー`,why,pickAb(['power','speed','weaken','absorb']),item,item==='choicescarf'||item==='lifeorb'?5:ai,ai===1?3:1,spOf(ai,5),pickAtk(4))},
    setup:()=>{const s=setup[0],isSh=key(s)==='shellsmash',bd=key(s)==='bellydrum';const item=isSh&&bulkS<.5?'focussash':bd?'sitrusberry':bulkS>=.55?'leftovers':'lifeorb';
      return mkSet('積みアタッカー',`${mName(s)}で能力を上げてから、タイプの違う技で一気に倒していく。${item==='focussash'?'耐久が低いので'+ITEMN.focussash+'でHP満タン時に一撃を耐えられる場合がある。':item==='sitrusberry'?ITEMN.sitrusberry+'でHPを戻しながら戦う。':item==='leftovers'?'耐久もあるので、'+ITEMN.leftovers+'で回復しながら何度も積む。':ITEMN.lifeorb+'で、積んだあとの火力をさらに上げる。'}`,
        pickAb(['power','speed','bulk','stat']),item,spdS>=.4&&!['curse'].includes(key(s))?5:ai,ai===1?3:1,key(s)==='curse'?spOf(0,ai):spOf(ai,5),[s,...pickAtk(3)])},
    bulky:()=>{const at=pickAtk(2),aux=[...heal.slice(0,1),...sup.filter(id=>['willowisp','toxic','stealthrock','thunderwave','yawn','spikes','taunt'].includes(key(id))).slice(0,1),...piv.slice(0,1),...have(['knockoff','protect'])];
      const mv=[...aux.slice(0,2),...at,...aux.slice(2)];
      return mkSet('受けて粘る役（サイクル）',`HPと${lowDef===2?'防御':'特防'}を伸ばし、${heal.length?mName(heal[0])+'で回復しながら':'交代を繰り返しながら'}何度も場に出る。${ITEMN.leftovers}で少しずつ回復する。`,
        pickAb(['pivot','bulk','weaken','absorb','statusab','stat']),'leftovers',lowDef,ai===1?3:1,spOf(0,lowDef),mv)},
    support:()=>{const fast=spdS>=.55;const s=sup.slice(0,3);
      return mkSet('起点作り',`${list(s.map(mName))}で味方が戦いやすい状況を作る。${bulkS<.4?'耐久が低いので'+ITEMN.focussash+'でHP満タン時に一撃を耐えられる場合がある。':ITEMN.sitrusberry+'で長く場に残る。'}`,
        pickAb(['speed','weaken','field','bulk']),bulkS<.4?'focussash':'sitrusberry',fast?5:lowDef,ai===1?3:1,fast?spOf(0,5):spOf(0,lowDef),[...s,...pickAtk(1,[]).slice(0,1),...sup.slice(3)])},
    tr:()=>mkSet('トリックルームのアタッカー',`自分でトリックルームを使い、同じ優先度で相手より遅い場合に先に攻撃できる。素早さは下げる性格にして、ポイントは振らない。`,
      pickAb(['weaken','bulk','power']),bulkS>=.5?'sitrusberry':'lifeorb',ai,5,spOf(0,ai),[tr[0],...pickAtk(3)])
  };
  /* ---- 向いている役割 ---- */
  const roles=[];const R=(k,sc,name,text,set)=>roles.push({k,sc,name,text,set});
  if(offS>=.45&&bestStab.length)R('attacker',offS+.3,`${atkName}アタッカー`,`${atkStat}が${ps[ai]}${bfl(ai)}（メガシンカも入れた${RANKP.length}匹中${rk(ai)}位）と${lvl(offS)}。タイプ一致の${list(bestStab.slice(0,2).map(m=>m.n))}が主な攻撃手段になる。`,'attacker');
  if(setup.length&&offS>=.35&&atk.length)R('setup',offS+.42,'積んで勝負を決める役',`${list(setup.slice(0,3).map(mName))}を覚える。相手が交代したときや、壁・まひで作った安全なターンに積むと、そのまま何匹も倒せることがある。`,'setup');
  /* 2026/11/16 依頼主の報告（イダイトウが「攻撃を削って防御」の型になる）：HPだけが高く、防御・特防がどちらも80未満なら受け役にしない */
  if(bulkS>=.65&&Math.max(B,D)>=80&&(heal.length||abK.includes('regenerator')||piv.length))R('bulky',bulkS+.2,'受けて粘る役（サイクル）',`耐久は${lvl(pbS)===lvl(sbS)?'物理・特殊ともに'+lvl(pbS):'物理が'+lvl(pbS)+'・特殊が'+lvl(sbS)}。${heal.length?mName(heal[0])+'で回復でき、':''}${abK.includes('regenerator')?ABN.regenerator+'で引っ込むたびに回復できるので、':''}交代を繰り返す戦い方に向く。`,'bulky');
  if(sup.length>=2)R('support',.4+.08*sup.length,'起点作り',`${list(sup.slice(0,4).map(mName))}など、味方を助ける技が多い。自分は倒れてもよいので、後ろのアタッカーが動きやすい状況を作る。`,'support');
  if(tr.length)R('tr',spdS<.3?.95:.6,'トリックルームを使う役',spdS<.3?'自分も遅いので、トリックルーム中、同じ優先度で相手より遅ければ先に攻撃できる。':'トリックルームを張って、遅い味方を活かす。自分は速いので、張ったあとは交代して味方に任せることが多い。',spdS<.3&&offS>=.4?'tr':null);
  else if(spdS<.25&&offS>=.6)R('slow',.55,'トリックルームで活きるアタッカー',`素早さはとても低いが${atkStat}は高い。味方のトリックルーム中、同じ優先度で相手より遅ければ先に動ける。`,null);
  if(wset)R('wset',1.05,`天気（${GM_WN[WSET[wset]]}）を作る役`,`特性${ABN[wset]}で、場に出るだけで天気が${GM_WN[WSET[wset]]}になる。天気で強くなる味方と組むと、出すたびに天気を作り直せる。`,null);
  if(wspd)R('wspd',.75,`${GM_WN[WSPD[wspd]]}で速くなるアタッカー`,`特性${ABN[wspd]}で、天気が${GM_WN[WSPD[wspd]]}のときは素早さが2倍になる。天気を作る味方と一緒に出したい。`,null);
  if(abK.includes('intimidate'))R('intim',.58,'いかくで相手を弱らせる役',`特性${ABN.intimidate}で、場に出たとき相手の攻撃を下げられる場合がある。物理アタッカーの多い相手に強く、交代で何度も出すと効果が大きい。`,null);
  if(prio.length&&offS>=.45)R('prio',.5,'先制技でとどめを刺す役',`${list(prio.slice(0,2).map(m=>m.n))}で、優先度と発動条件が合えば速い相手より先に攻撃できる。`,null);
  if(piv.length&&spdS>=.5)R('pivot',.46,'交代技を使う役',`${list(piv.map(mName))}で、技が成功すると味方に交代できる。先発で相手を見てから動くのに向く。`,null);
  if(dbl.some(id=>['fakeout','followme','ragepowder'].includes(key(id)))||dbl.length>=2)R('double',.36,'ダブルの補助',`${list(dbl.slice(0,3).map(mName))}を覚える。ダブルでは味方を守ったり、相手の動きを止めたりできる。`,null);
  roles.sort((a,b)=>b.sc-a.sc);
  const topRoles=roles.slice(0,4);
  const setKeys=[...new Set(roles.map(r=>r.set).filter(Boolean))].slice(0,2);
  if(!setKeys.length&&atk.length)setKeys.push('attacker');
  const SETS=setKeys.map(k=>{try{const r=sets[k]();if(r)r.k=k;return r}catch(e){return null}}).filter(s=>s&&s.moves.length);
  /* ダブル用の型：ねこだまし・まもる・相手2匹に当たる技を優先する */
  if(!o.raw&&atk.length)try{
    const fo=have(['fakeout'])[0],pr=have(['protect','detect'])[0],sp2=bestStab.filter(m=>m.tg&&sc(m)>=sc(bestStab[0])*.7)[0];
    const helper=have(['followme','ragepowder'])[0],tw=have(['tailwind','trickroom'])[0];
    const supMode=!!helper&&offS<.55;
    const mv=supMode?[helper,fo,tw,pr,...have(['helpinghand','wideguard'])]:[fo,sp2&&sp2.id,pr].filter(Boolean);
    const item=supMode?'sitrusberry':fo&&bulkS<.45?'focussash':offS>=.6?'lifeorb':'sitrusberry';
    const d=mkSet(supMode?'ダブル用サポート':'ダブル用アタッカー',
      supMode?`${mName(helper)}で相手の攻撃を自分に集め、そのあいだに味方に攻撃や積みをさせる。${tw?mName(tw)+'で味方を先に動かすこともできる。':''}`
        :`${fo?mName(fo)+'で出てすぐに相手1匹を止め、':''}${sp2?'相手2匹に当たる'+esc(sp2.n)+'で両方を削る。':'味方と同じ相手を狙って、1匹ずつ確実に倒す。'}${pr?mName(pr)+'で相手の攻撃を避けながら、味方の動きを待てる。':''}`,
      pickAb(supMode?['weaken','bulk','field']:['power','speed','weaken']),item,supMode?lowDef:offS>=.6&&spdS>=.4?5:ai,ai===1?3:1,supMode?spOf(0,lowDef):spOf(ai,spdS>=.4?5:0),mv);
    if(d.moves.length){d.k=supMode?'dsup':'double';d.fmt='double';SETS.push(d)}
  }catch(e){}
  /* Reviewed strategy examples: independent allocations, no usage statistics or copied article text.
     Only display if every move, ability and item is present in the current game data. */
  if(o.parts&&!base){
    const reviewed=p.no===149?[
      {title:'りゅうのまい物理型（検証用）',why:'HP満タンから積む機会を探し、先制技と通常攻撃を使い分ける。攻撃・素早さを最大配分した比較用の例。',ab:'multiscale',item:'lifeorb',up:1,dn:3,sp:[2,32,0,0,0,32],moves:[349,245,89,337],fmt:'single',k:'setup',refs:[['GameWith','https://gamewith.jp/pokemon-champions/554956'],['Game8','https://game8.jp/pokemon-champions/776110']],reasons:['攻撃・素早さを同時に上げる','削れた相手への先制攻撃','はがねなどへの打点','行動固定のないドラゴン一致技'],itemWhy:'攻撃技の威力を上げる代わりにHPを消費する。マルチスケイルの再発動を妨げる場合がある。'}
    ]:p.no===184?[
      {title:'はらだいこ物理型（検証用）',why:'HPを確保して積む機会を探し、先制技と一致攻撃を使い分ける。HP・攻撃を最大配分した比較用の例。',ab:'huge-power',item:'sitrusberry',up:1,dn:3,sp:[32,32,0,0,2,0],moves:[187,453,583,282],fmt:'single',k:'setup',refs:[['GameWith','https://gamewith.jp/pokemon-champions/555066'],['Game8','https://game8.jp/pokemon-champions/779109']],reasons:['HPを消費して攻撃ランクを最大にする','低い素早さを優先度で補う','みず技が通りにくい相手への一致打点','持ち物を落とせる相手への攻撃手段'],itemWhy:'HPが発動条件を満たす場合に回復する。はらだいこ後の残りHPと発動条件を確認する。'}
    ]:[];
    for(const v of reviewed){
      if(v.moves.length===4&&new Set(v.moves).size===4&&v.moves.every(id=>ls.includes(id)&&(MV[id]||MD[id]))&&abK.includes(v.ab)&&Object.prototype.hasOwnProperty.call(ITEMN,v.item)&&v.sp.every(n=>Number.isInteger(n)&&n>=0&&n<=32)&&v.sp.reduce((a,b)=>a+b,0)===66&&v.up!==v.dn)SETS.unshift(v);
    }
  }
  /* 当サイトの利用者の育成が5件以上あれば、それをもとにした型を先頭に置く（43-usage.js） */
  /* ランクバトルの集計（championsbattledata.com、15-battle.js の LIVE）があれば、いちばん多い組み合わせの型を先頭に置く */
  const liveF=!o.raw&&!base&&typeof LIVE!=='undefined'&&LIVE.csv[p.no]?FMT:null;
  if(liveF)try{const d=LIVE.csv[p.no],b=buildSet(p,d,true),lsl=LSD[p.no]?LSD[p.no][1]:[],mv=[...new Set([...liveFit(p,d,b.ab).moves.map(x=>x.id===0?182:x.id),...d.mv.map(([n])=>MVKA[nrm(n)])].filter(id=>id&&(lsl.includes(id)||id===182)))];
    /* 2026/11/20 RC2：集計の型がメガストーンを持つなら、それはメガシンカの姿の型。元の姿の型として（元の姿の能力で）出さない。名前は「推定」（集計は項目ごとの割合で、1人の型ではない） */
    const lvR=resolveForm(p.no,b.item);
    if(mv.length>=2&&b.sp&&lvR.ok&&!lvR.mega){const it=b.item||'';SETS.splice(Math.max(0,SETS.findIndex(x=>(x.fmt||'single')===liveF)),0,{title:'ランクバトルの集計から組み合わせた推定の型',why:`ランクバトル（${liveF==='double'?'ダブル':'シングル'}）の使用率の集計から、いちばん多い特性・性格・能力ポイントと、いっしょに使って意味のある持ち物と技（ジュエル・タイプ強化の持ち物ならそのタイプの技、こだわり系なら攻撃技だけ等）を組み合わせたものです。`,
      ab:b.ab,item:b.item,up:b.up,dn:b.dn,sp:b.sp,moves:mv.slice(0,4),fmt:liveF,k:/^choice|lifeorb|focussash|expertbelt/.test(it)?'attacker':it==='leftovers'?'bulky':'attacker',live:true})}}catch(e){}
  if(!o.raw&&!base&&typeof usageBuildOf==='function')['double','single'].filter(f=>f!==liveF).forEach(f=>{usageGet(f);const b=usageBuildOf(p.no,f),u=b&&usageSet(p,b);if(u){u.fmt=f;const i=SETS.findIndex(x=>(x.fmt||'single')===f);SETS.splice(i<0?SETS.length:i,0,u)}});
  SETS.forEach((x,i)=>{x.fmt=x.fmt||'single';x.rec=!x.refs&&SETS.findIndex(y=>(y.fmt||'single')===x.fmt)===i});
  /* メガシンカの姿の型は、持ち物をメガストーンにする（持ち物の説明の文は外す） */
  if(stoneK&&!o.raw)SETS.forEach(st=>{st.item=stoneK;const kp=st.why.split('。').filter(x=>x&&!Object.values(ITEMN).some(n=>x.includes(n))).join('。');st.why=(kp?kp+'。':'')+`持ち物は${ITEMN[stoneK]}（メガシンカする）。`});
  /* 構築の型（40-guide-builds.js）から、型を組む部品として使う */
  if(o.raw)return{keys:setKeys,make:k=>{try{const r=sets[k]();return r&&r.moves.length?r:null}catch(e){return null}},key,ai,lowDef,best:n=>pickAtk(n)};
  /* ---- まとめ ---- */
  const spdTxt=sr.rank<=sr.n*.25?'速いほう':sr.rank<=sr.n*.6?'中くらい':'遅いほう';
  const megas=base?[]:megasOf(p.no);
  /* 強いところ・弱いところ：「見出し」＋「なぜそうなのか」＋「対戦ではどうなるか」の順で書く */
  const topPct=x=>Math.max(1,Math.round((1-x)*100));
  const abImm=md.filter(x=>x.by&&x.m===0).map(x=>({t:x.t,k:x.by}));
  const pros=[],cons=[];
  if(weak.length<=1)pros.push([weak.length?`弱点が${weak[0][0]}だけ`:'弱点がない',
    `${list(p.t)}タイプ${abImm.length?`に加えて、特性${esc(ABN[abImm[0].k]||abImm[0].k)}で${list(abImm.map(x=>x.t))}技が効かない`:'の'}ため、${weak.length?`弱点は${weak[0][0]}の1つだけ`:'弱点がない'}。半減以下で受けられるタイプも${res.length}${res.length<10?'つ':'個'}あるので、相手の攻撃を受けながら、交代で出しやすい。`,3,'def']);
  else if(res.length>=8)pros.push(['受けられるタイプが多い',`半減以下で受けられるタイプが${res.length}${res.length<10?'つ':'個'}${imm.length?`（${list(imm.map(x=>x[0]))}は無効）`:''}ある。相手の技を読めば、交代で出してダメージを抑えやすい。`,2,'def']);
  if(spdS>=.75)pros.push(['素早さが高い',`素早さ${S}（最速で${maxSpe(p)}）は、収録${sr.n}匹のうち上から${topPct(spdS)}%ほど。多くの相手より先に攻撃できるので、削れた相手を先に倒しやすい。`,2.5,'off']);
  if(offS>=.75&&bestStab[0])pros.push([`${atkStat}が高い`,`${atkStat}${ps[ai]}${bfl(ai)}はメガシンカも入れた${RANKP.length}匹で${rk(ai)}位。タイプ一致の${esc(bestStab[0].n)}なら、等倍の相手にも大きなダメージを与えられる。`,2.6,'off']);
  if(pbS>=.7&&pbS>=sbS)pros.push(['物理技に強い',`HP${h}・防御${B}で、物理技を受けても倒れにくい。物理アタッカーの多い相手に出しやすい。`,2,'def']);
  else if(sbS>=.7)pros.push(['特殊技に強い',`HP${h}・特防${D}で、特殊技を受けても倒れにくい。特殊アタッカーの多い相手に出しやすい。`,2,'def']);
  if(piv.length)pros.push(['交代技で戦える',`${esc(list(piv.slice(0,2).map(mName)))}で、技が成功すると攻撃や補助のあとに味方へ交代できる。不利な相手から引きつつ、少しずつ削れる。`,1.8,'def']);
  const weakenMv=have(['willowisp','thunderwave','toxic','yawn','taunt','knockoff','trick']);
  if(weakenMv.length)pros.push(['相手を弱らせる技がある',`${esc(list(weakenMv.slice(0,3).map(mName)))}を覚える。相手の攻撃を下げたり、動きを止めたりして、味方が戦いやすくなる。`,1.6,'def']);
  if(h<=65&&Math.max(B,D)>=95)cons.push(['HPが低め',`${B>=D?'防御':'特防'}${Math.max(B,D)}は高いが、HP${h}が低いので、思ったほどは耐えない。等倍の強い技を続けて受けると倒れやすいので、受けに出すときは半減以下で受けられる相手を選ぶ。`,3,'HPが低く、思ったほどは耐えない']);
  const x4=weak.filter(x=>x[1]>=4);
  if(x4.length)cons.push([`${list(x4.map(x=>x[0]))}が4倍の弱点`,`${list(x4.map(x=>x[0]))}タイプの技は4倍のダメージになり、耐久があっても一撃で倒されやすい。${list(x4.map(x=>x[0]))}技を持つ相手の前には出さないようにする。`,3,`${list(x4.map(x=>x[0]))}技を4倍で受ける`]);
  if(weak.length>=5)cons.push(['弱点が多い',`${list(weak.map(x=>x[0]))}の${weak.length}${weak.length<10?'つ':'個'}が弱点。交代で受けに出せる相手が限られるので、先に攻撃して数を減らす使い方が向く。`,2.5,'弱点が多い']);
  if(spdS<.25)cons.push(['素早さが低い',`最速にしても${maxSpe(p)}で、多くの相手に先に攻撃される。トリックルームを使うか、先に攻撃を受けても耐えられる相手に合わせて出す。`,2,'素早さが低く、先に攻撃されやすい']);
  if(offS<.3&&!abK.some(k=>['huge-power','pure-power','water-bubble','technician','hustle','guts','adaptability','strong-jaw','solar-power'].includes(k)))cons.push(['攻撃・特攻が控えめ',`攻撃${A}・特攻${C}という種族値。実際の火力は技・特性・持ち物・相手によって変わる。`,1.5,'火力は高くない']);
  if(bulkS<.25&&!(h<=65&&Math.max(B,D)>=95))cons.push(['打たれ弱い',`HP${h}・防御${B}・特防${D}と耐久が低く、弱点でなくても強い技で倒されやすい。${base?'メガストーンを持つので、耐久を補う持ち物は持てない。先に動ける相手を選んで出し、倒される前に攻撃する使い方が向く。':'先に動ける場面や、HP満タン時にきあいのタスキで一撃を耐える使い方が向く。'}`,2,'打たれ弱い']);
  if(!cons.length&&weak.length)cons.push([`${weak[0][0]}技に弱い`,`${list(weak.map(x=>x[0]))}が弱点。${weak[0][0]}技を持つ相手が出てきたら、受けられる味方に交代する。`,1,`${weak[0][0]}技に弱い`]);
  pros.sort((a,b)=>b[2]-a[2]);cons.sort((a,b)=>b[2]-a[2]);
  /* ひとこと：いちばんの強みと、それに合う役割（守りの強みなら受け・交代・補助、攻めの強みならアタッカー・積み） */
  const want=pros[0]&&pros[0][3]==='def'?['bulky','pivot','support','intim','tr','double']:['attacker','setup','prio','slow','wspd','pivot'];
  const role=roles.find(r=>want.includes(r.k))||topRoles[0];
  /* 「向いている役割」も、ひとことで挙げた役割を先頭にする */
  if(role&&topRoles.includes(role)){topRoles.splice(topRoles.indexOf(role),1);topRoles.unshift(role)}else if(role){topRoles.pop();topRoles.unshift(role)}
  const strong=pros[0]?pros[0][0].replace(/が高い$/,'の高さ').replace(/に強い$/,'への強さ').replace(/^弱点が(.+)だけ$/,'弱点が$1だけという耐性').replace(/^弱点がない$/,'弱点のない耐性').replace(/^受けられるタイプが多い$/,'受けられるタイプの多さ').replace(/^交代技で戦える$/,'交代しながら戦える器用さ').replace(/^相手を弱らせる技がある$/,'相手を弱らせる技'):'';
  const lead=`${esc(p.n)}は、${strong?strong+'を活かして、':''}${role?esc(role.name).replace(/（.*$/,'')+'として活躍しやすいポケモン':'技や特性から戦い方を検討するポケモン'}。${cons[0]?`ただし、${cons[0][3]}点に注意。`:''}`;
  const item=([t,d])=>`<div class="gpt"><b>${esc(t)}</b><p>${d}</p></div>`;
  const dn=defNotes(p);
  const numHTML=`<dl class="gnum">
      <dt>タイプ</dt><dd>${list(p.t)}</dd>
      <dt>種族値</dt><dd>${SN.map((n,i)=>`${n}${p.s[i]}`).join('・')}（合計${p.bst}）</dd>
      <dt>素早さ</dt><dd>最速で${maxSpe(p)}（収録${sr.n}匹の中で${sr.rank}位・${spdTxt}）</dd>
      <dt>弱点</dt><dd>${weak.length?list(weak.map(x=>x[0]+(x[1]>=4?'（4倍）':''))):'なし'}</dd>
      <dt>受けられる</dt><dd>半減以下${res.length}タイプ${imm.length?`（${list(imm.map(x=>x[0]))}は無効）`:''}</dd>
      ${dn.length?`<dt>特性</dt><dd>${esc(dn.join('。'))}</dd>`:''}</dl>`;
  const sum=`<p class="glead">${lead}</p>
    ${pros.length?`<h3>強いところ</h3>${pros.slice(0,3).map(item).join('')}`:''}
    ${cons.length?`<h3>弱いところ</h3>${cons.slice(0,3).map(item).join('')}`:''}
    <h3>数字で見ると</h3>${numHTML}`;
  const megaTxt=megas.map(m=>{const st=Object.keys(MEGA).find(k=>MEGA[k][p.no]===m.no);return `${itA(st)}を持たせるとメガシンカできる（合計種族値${m.bst}${m.t.join('')!==p.t.join('')?'・タイプが'+list(m.t)+'に変わる':''}・特性${esc(ABN[m.ab]||m.ab)}）。`}).join('');
  /* ---- 技の選び方 ---- */
  const stabTypes=[...new Set(stab.map(m=>m.t))];
  const hard=T.filter(d=>stabTypes.length&&stabTypes.every(t=>mult(t,[d])<1));
  const covM=hard.length?atk.filter(m=>!p.t.includes(m.t)&&hard.some(d=>mult(m.t,[d])>=2)).sort((a,b)=>sc(b)-sc(a)).slice(0,4):[];
  const auxIds=[...setup,...heal,...sup,...piv,...dbl,...have(['protect','substitute','knockoff'])];
  const aux=[...new Set(auxIds)].slice(0,10);
  /* ---- 相性のいい味方：弱点を受け合えるか＋天気・トリックルームの組み合わせ ---- */
  const wk=weak.map(x=>x[0]);
  const qAb=q=>(ABD[q.no]||[]).map(a=>a[0]);
  const partners=P.filter(q=>q.no!==p.no&&formInfo(q).base!==formInfo(p).base).map(q=>{
    const cov=wk.filter(w=>mult(w,q.t)<1),dup=wk.filter(w=>mult(w,q.t)>=2);
    const back=defTable(q.t).filter(x=>x[1]>=2&&mult(x[0],p.t)<1).map(x=>x[0]);
    let v=cov.reduce((a,w)=>a+(mult(w,q.t)===0?1.5:1),0)-dup.length*.8+back.length*.4+q.bst/600*.8;
    const why=[];
    if(cov.length)why.push(`${list(cov)}を${cov.every(w=>mult(w,q.t)===0)?'無効にできる':'半減以下で受けられる'}`);
    if(back.length)why.push(`${esc(q.n)}の弱点の${list(back.slice(0,3))}を${esc(p.n)}が受けられる`);
    const qa=qAb(q);
    if(wset&&qa.some(k=>WSPD[k]===WSET[wset])){v+=2;why.unshift(`${GM_WN[WSET[wset]]}で素早さが2倍になる`)}
    if(wspd&&qa.some(k=>WSET[k]===WSPD[wspd])){v+=2.5;why.unshift(`天気を${GM_WN[WSPD[wspd]]}にできる`)}
    if(tr.length&&q.s[5]<=50&&Math.max(q.s[1],q.s[3])>=110){v+=1;why.push('トリックルームの中で先に攻撃できる')}
    return{q,v,why}}).filter(x=>x.why.length).sort((a,b)=>b.v-a.v).slice(0,6);
  /* ---- 有利に戦いやすい相手：こちらのタイプ一致で弱点を突けて、相手のタイプ一致では弱点を突かれない ---- */
  const good=P.filter(q=>q.no!==p.no&&p.t.some(t=>mult(t,q.t)>=2)&&!q.t.some(t=>mult(t,p.t)>=2)).sort((a,b)=>b.bst-a.bst).slice(0,10);
  const mA=q=>`<a class="pill gchip" href="${mon(q.no)}">${esc(formInfo(q).base)}${formInfo(q).tag?'（'+esc(formInfo(q).tag)+'）':''}</a>`;
  const mvParts=[];
  if(bestStab.length)mvParts.push(['タイプ一致の主力技','威力が1.5倍になる、いちばん頼りになる技。',bestStab.slice(0,4).map(m=>m.id)]);
  if(hard.length)mvParts.push(['タイプ一致技では倒しにくい相手',`${list(hard)}タイプには、タイプ一致技がどれも等倍より低い。${covM.length?'次の技で弱点を突ける。':'弱点を突ける技がないので、味方に任せる。'}`,covM.map(m=>m.id)]);
  if(prio.length)mvParts.push(['先制技','優先度と発動条件が合えば素早さの高い相手より先に攻撃できる。削れた相手へのとどめに。',prio.slice(0,3).map(m=>m.id)]);
  if(aux.length)mvParts.push(['補助に使える技','能力を上げる・回復する・相手を邪魔するなど、攻撃以外で役立つ技。',aux]);
  /* 型ごとのくわしい説明：実数値・この型の役割・技の入れ替え候補・苦手な相手（ダメージ計算から） */
  const mvCard=(id,why)=>{const u=MVU[id]||[],d=MD[id]||[];return `<div class="mvr gmvr"><div class="mvr-h"><a href="${lk('#/move/'+id)}" style="color:var(--fg)"><b>${esc(mName(id))}</b></a>${u[0]?chip(u[0]):''}<span class="mvc c${u[1]}">${['物理','特殊','変化'][u[1]]||''}</span></div>
    <div class="mvr-s">${u[1]<2?`<span>威力 <b>${u[2]||'—'}</b></span>`:''}<span>命中 <b>${u[3]||'—'}</b></span><span>PP <b>${u[4]||'—'}</b></span>${u[5]?`<span>優先度 <b>${u[5]>0?'+':''}${u[5]}</b></span>`:''}</div>
    ${d[1]?`<div class="mvr-d">${esc(d[1])}</div>`:''}${why?`<div class="mvr-d" style="color:var(--acc)">${esc(why)}</div>`:''}</div>`};
  const covOf=ids=>{const c=new Set();ids.forEach(id=>{const m=MV[id]&&mvObj(id);if(m&&m.pow>0&&m.cls<2)T.forEach(d=>{if(mult(m.t,[d])>=2)c.add(d)})});return c};
  const ALT_WHY={taunt:'相手の積み技・回復・壁を止められる',protect:'相手の動きを1回見られる。ダブルでは攻撃を避けながら味方を待てる',detect:'相手の動きを1回見られる',uturn:'不利な相手から、削りながら交代できる',voltswitch:'不利な相手から、削りながら交代できる',flipturn:'不利な相手から、削りながら交代できる',
    knockoff:'相手の持ち物をなくして、長く戦う相手を弱らせる',willowisp:'物理アタッカーの攻撃を半分にできる',thunderwave:'速い相手を遅くできる',toxic:'受けに来る相手を少しずつ削れる',toxicspikes:'交代してくる相手をどく状態にできる',spikes:'交代するたびに相手を削れる',stealthrock:'交代するたびに相手を削れる',
    substitute:'状態異常や補助技を防ぎながら動ける',trick:'こだわり系の道具を相手に押しつけて動きを縛れる',encore:'相手を同じ技に縛り、その間に交代や積みができる',yawn:'相手に交代をうながし、場を動かせる',swordsdance:'相手が交代したときに火力を2倍にできる',nastyplot:'相手が交代したときに火力を2倍にできる',
    fakeout:'出てすぐに相手1匹を止められる（ダブルで特に強い）',helpinghand:'味方の技の威力を上げられる（ダブル）',tailwind:'4ターンのあいだ味方全員を速くできる',trickroom:'遅い味方を先に動かせる'};
  const altOf=s=>{
    const cov=covOf(s.moves),out=[];
    const cands=pickAtk(8).filter(id=>!s.moves.includes(id));
    cands.forEach(id=>{if(out.length>=2)return;const m=mvObj(id),nw=T.filter(d=>!cov.has(d)&&mult(m.t,[d])>=2);
      if(nw.length)out.push([id,`今の技では弱点を突けない${list(nw)}タイプに弱点を突ける。`]);
      else if(m.pri>0)out.push([id,'優先度があり、削れた速い相手にも先にとどめを刺せる。'])});
    have(Object.keys(ALT_WHY)).filter(id=>!s.moves.includes(id)&&(MD[id]&&MVU[id]&&MVU[id][1]===2||key(id)==='knockoff'||key(id)==='fakeout'||GM_PIV.includes(key(id)))).filter(id=>s.fmt==='double'||!['helpinghand'].includes(key(id))).slice(0,6)
      .forEach(id=>{if(out.length<4&&!out.some(x=>x[0]===id))out.push([id,ALT_WHY[key(id)]+'。'])});
    /* どの枠と入れかえるか：タイプ一致でない攻撃技のうち、いちばん点の低いもの */
    const rep=s.moves.filter(id=>MV[id]&&!p.t.includes(MV[id][1])&&MV[id][2]>0).sort((a,b)=>sc(mvObj(a))-sc(mvObj(b)))[0];
    return{out,rep}};
  const roleOf=s=>{const mv=s.moves.map(key),pv=s.moves.filter(id=>GM_PIV.includes(key(id))),pr=s.moves.filter(id=>MV[id]&&MV[id][5]>0&&MV[id][2]>0);
    const base={attacker:s.item==='choicescarf'?'素早さを上げて上から攻撃し、相手の速いアタッカーを止める役（ストッパー）。先に出して削る役もこなせる。':
        /^choice(band|specs)$/.test(s.item)?'高い火力で、受けに来た相手ごと押し切る役。技が1つに固定されるので、相手の交代先を読んで技を選ぶ。':'速さと火力で、先に相手の数を減らしていくエース。',
      setup:'相手が交代したときや、攻撃の弱い相手の前で能力を上げ、そのまま後ろの相手まで倒していくエース。積む前に倒されないよう、出す場面を選ぶ。',
      bulky:'相手の攻撃を受けて、交代を繰り返しながら少しずつ削る役。不利な相手からは早めに交代する。',
      support:'先発で場を整え、後ろのアタッカーが戦いやすい状況を作る役。倒れる前に補助技を使い切る。',
      tr:'トリックルームを張り、同じ優先度で相手より遅い場合に先に攻撃する役。トリックルームが終わるターンを数えて動く。',
      double:'味方と2匹で同じ相手を狙い、1ターンに1匹ずつ倒していく役。',dsup:'相手の攻撃を自分に集めて、味方を守る役。'}[s.k]||'';
    return base+(pv.length?`不利な相手の前では${esc(mName(pv[0]))}で交代し、有利な味方につなぐ。`:'')+(pr.length?`${esc(mName(pr[0]))}で、削れた相手に先にとどめを刺せる。`:'')+(s.item==='focussash'?'きあいのタスキはHP満タン時に一撃を耐えるための持ち物。連続技などには注意。':'')};
  const hardOf=s=>{try{
    const me=mkMon(p,'me',{ab:s.ab,item:s.item,moves:s.moves.filter(id=>MV[id]).map(mvObj),sp:s.sp,up:s.up,dn:s.dn});
    const rows=gmOpps().filter(q=>q.no!==p.no&&q.no!==(base&&base.no)).map(q=>{const op=mkMon(q,'op',q.base&&byNo[q.base]?{...detSet(byNo[q.base]),ab:q.ab,item:null}:detSet(q));const a=estHit(me,op),b=estHit(op,me);
      return{q,my:a.pct,their:b.pct,mv:a.mv,resist:!!a.mv&&mult(a.mv.t,q.t)<1}});
    const bad=rows.filter(r=>r.my<45&&r.their>=35).sort((x,y)=>(y.their-y.my)-(x.their-x.my)).slice(0,3);
    if(!bad.length)return null;
    const res=bad.filter(r=>r.resist).length>=2,top=s.moves.filter(id=>MV[id]&&p.t.includes(MV[id][1]))[0];
    const head=res&&top?`${MV[top][1]}技を半減以下で受けるポケモン`:'耐久が高く、ダメージが通りにくいポケモン';
    const why=res&&top?`この型のいちばんの攻撃手段である${mName(top)}を半減以下で受けられ、ほかの技でも大きなダメージを与えにくい。相手の攻撃は受けきれないので、対面したら有利な味方に交代する。`
      :'この型の技では大きなダメージを与えにくく、相手からはしっかりダメージを受ける。対面したら無理に戦わず、有利な味方に交代する。';
    return{head,why,bad}}catch(e){return null}};
  /* Reusable allocation evidence: compare actual stats against the same nature and zero AP.
     Speed comparisons deliberately use explicit opponent assumptions, not usage claims. */
  /* Search the exact legal AP range, including nature rounding plateaus.
     Preserve the strict speed target; redistribute only to HP/defenses. */
  const speedAllocation=(s,target)=>{
    const current=calcStats(p,s.sp,s.up,s.dn);
    if(!Number.isInteger(target)||current[5]<=target)return null;
    let need=-1;
    for(let n=0;n<=s.sp[5];n++){
      const sp=[...s.sp];sp[5]=n;
      if(calcStats(p,sp,s.up,s.dn)[5]>target){need=n;break}
    }
    if(need<0||need===s.sp[5])return null;
    const freed=s.sp[5]-need,sp=[...s.sp];sp[5]=need;
    // Compare each single-point addition using actual HP × defense products.
    // Prefer the weakest of physical/special neutral bulk; do not claim matchup optimality.
    const bulk=v=>Math.min(v[0]*v[2],v[0]*v[4]);
    for(let j=0;j<freed;j++){
      const choices=[0,2,4].filter(i=>sp[i]<32).map(i=>{
        const x=[...sp];x[i]++;
        const st=calcStats(p,x,s.up,s.dn);
        return {i,score:bulk(st),sum:st[0]*(st[2]+st[4])};
      }).sort((a,b)=>b.score-a.score||b.sum-a.sum||a.i-b.i);
      if(!choices.length)return null;
      sp[choices[0].i]++;
    }
    const stats=calcStats(p,sp,s.up,s.dn);
    if(stats[5]<=target||sp.some(v=>v<0||v>32)||sp.reduce((a,b)=>a+b,0)!==s.sp.reduce((a,b)=>a+b,0))return null;
    return {need,freed,sp,stats,current,target};
  };
  const allocationEvidence=s=>{
    const st=calcStats(p,s.sp,s.up,s.dn),zero=calcStats(p,[0,0,0,0,0,0],s.up,s.dn);
    const rows=s.sp.map((v,i)=>({i,v,from:zero[i],to:st[i]})).filter(x=>x.v>0);
    const speeds=P.filter(q=>q.no!==p.no).map(q=>({q,v:calcStats(q,[0,0,0,0,0,32],5,1)[5]}));
    const crossed=speeds.filter(x=>x.v>=zero[5]&&x.v<st[5]).sort((a,b)=>b.v-a.v||a.q.no-b.q.no).slice(0,3);
    const ties=speeds.filter(x=>x.v===st[5]).sort((a,b)=>a.q.no-b.q.no).slice(0,3);
    const candidates=crossed.map(x=>({q:x.q,plan:speedAllocation(s,x.v)})).filter(x=>x.plan);
    const adjustment=candidates[0]||null;
    return {rows,crossed,ties,speed:st[5],adjustment};
  };
  const allocationHTML=s=>{
    const e=allocationEvidence(s);
    const adj=e.adjustment;
    const candidate=adj?'<p><b>素早さを調整する候補</b></p><p>'+esc(adj.q.n)+'（素早さ'+adj.plan.target+'）を同じ優先度で抜くために必要な最小ポイント：'+adj.plan.need+'。'+adj.plan.freed+'ポイントを耐久へ振り替える例。</p><p>'+adj.plan.sp.map((v,i)=>v?esc(SN[i])+v:'').filter(Boolean).join('・')+'</p><p>'+[0,2,4,5].map(i=>esc(SN[i])+' '+adj.plan.current[i]+' → '+adj.plan.stats[i]).join('／')+'</p><p class="vcap">この相手だけを目標とした候補です。ほかの相手への行動順が変わる場合があります。耐久配分はHP×防御・HP×特防の小さい方を優先した簡易比較で、実際の確定数を保証しません。</p>':'';

    return '<details class="gset-alt"><summary>能力配分の計算根拠</summary><ul class="gtips">'+e.rows.map(x=>'<li>'+esc(SN[x.i])+' '+x.v+'ポイント：'+x.from+' → '+x.to+'</li>').join('')+'</ul>'+
      '<p class="vcap">同じ能力補正でポイント0の場合と比較しています。</p>'+
      (e.crossed.length?'<p>素早さ配分によって先に動けるようになる相手の例：'+e.crossed.map(x=>esc(x.q.n)+'（'+x.v+'）').join('・')+'</p>':'')+
      (e.ties.length?'<p>同速になる相手の例：'+e.ties.map(x=>esc(x.q.n)+'（'+x.v+'）').join('・')+'</p>':'')+
      candidate+
      '<p class="vcap">相手は収録通常データ、素早さ上昇補正・素早さ32。自分の素早さ'+e.speed+'。同じ優先度、特性・持ち物・ランク・場の補正なし。環境での使用率や勝率を示すものではありません。</p></details>';
  };
  /* Fixed, legal comparison targets; not claimed to be popular or optimal.
     Use calculator rolls, not estHit's single representative roll. */
  const benchmarkHTML=s=>{
    if(s.fmt!=='single'||typeof dmgRolls!=='function'||typeof koInfo!=='function')return '';
    const fixtures=[
      {no:149,ab:'multiscale',moves:[245,337],sp:[2,32,0,0,0,32],up:1,dn:3},
      {no:184,ab:'huge-power',moves:[453,583],sp:[32,32,0,0,2,0],up:1,dn:3},
      {no:445,ab:'rough-skin',moves:[89,337],sp:[2,32,0,0,0,32],up:1,dn:3}
    ];
    const build=(q,x,side)=>mkMon(q,side,{...x,moves:x.moves.filter(id=>MV[id]).map(mvObj)});
    const simple=new Set([89,337,245,453,583,127,401,710]);
    const result=(a,d,m)=>{
      if(!simple.has(m.id)||!moveUsable(m,{a,d}).ok||a.formErr||d.formErr)return null;
      if([a,d].some(x=>CALC_UNIMPL.includes(x.ab)||CALC_UNIMPL_IT.includes(x.item)))return null;
      if(m.pri>0&&typeof PRIO_BLOCK!=='undefined'&&PRIO_BLOCK.has(d.ab)&&a.ab!=='mold-breaker')return null;
      const o={format:'single',spread:false,crit:false,protean:true};
      const r=dmgRolls(a,m,d,o),vals=r.dist?r.dist.map(x=>x[0]):r;
      if(!vals.length||!vals.every(Number.isFinite))return null;
      const lo=Math.min(...vals),hi=Math.max(...vals),ko=koInfo(r,d.hp);
      return {m,lo,hi,hp:d.max,ko,acc:accOf(a,m,d)};
    };
    // Exact one-axis search, with the other allocations held fixed.
    // Only show targets that the existing build achieves and can preserve with fewer AP.
    const minAP=(idx,goal)=>{
      for(let n=0;n<=s.sp[idx];n++){
        const sp=[...s.sp];sp[idx]=n;
        const candidate=build(p,{...s,sp},'me');
        if(goal(candidate))return n;
      }
      return null;
    };
    const thresholds=(me,op,out,inc)=>{
      const rows=[];
      // Restrict to simple physical/special single-hit moves and ordinary damage states.
      // Do not infer multi-turn survival from first-hit damage.
      const safe=(a,d,m)=>!d.disg&&d.item!=='focussash'&&d.ab!=='sturdy'&&d.item!=='focusband'&&m.maxH<=1&&a.ab!=='parental-bond';
      for(const x of out){
        if(!safe(me,op,x.m)||x.ko.sure!==1||x.ko.n!==1||x.acc!==100)continue;
        const idx=x.m.cls===0?1:3;
        const n=minAP(idx,c=>{const y=result(c,op,x.m);return !!y&&y.ko.sure===1&&y.ko.n===1&&y.acc===100});
        if(n!==null&&n<s.sp[idx])rows.push(esc(mName(x.m.id))+'：確定1発を維持する'+esc(SN[idx])+'の最小ポイント '+n+'（'+(s.sp[idx]-n)+'ポイント節約可能）');
      }
      for(const x of inc){
        if(!safe(op,me,x.m)||x.hi>=me.hp||x.hi<=0)continue;
        for(const idx of [0,x.m.cls===0?2:4]){
          if(!s.sp[idx])continue;
          const n=minAP(idx,c=>{const y=result(op,c,x.m);return !!y&&y.hi<c.hp});
          if(n!==null&&n<s.sp[idx])rows.push(esc(mName(x.m.id))+'：最大ダメージを1回耐える'+esc(SN[idx])+'の最小ポイント '+n+'（'+(s.sp[idx]-n)+'ポイント節約可能）');
        }
      }
      return rows.length?'<details class="gset-alt"><summary>ダメージを基準にした配分候補</summary><ul class="gtips">'+rows.map(t=>'<li>'+t+'</li>').join('')+'</ul><p class="vcap">他の能力配分を固定し、1項目ずつ検査しています。候補同士を同時に適用できるとは限りません。満タン・非急所・指定した技と相手だけの比較です。節約分は未配分です。</p></details>':'';
    };
    /* Bounded coordinate search: retain every selected goal after each change.
       Not an exhaustive global optimum. Never exceed original AP budget. */
    const jointPlan=(me,op,out,inc)=>{
      const safe=(a,d,m)=>!d.disg&&d.item!=='focussash'&&d.ab!=='sturdy'&&d.item!=='focusband'&&m.maxH<=1&&a.ab!=='parental-bond';
      const attack=out.filter(x=>safe(me,op,x.m)&&x.ko.sure===1&&x.ko.n===1&&x.acc===100);
      const defense=inc.filter(x=>safe(op,me,x.m)&&x.hi>0&&x.hi<me.hp);
      const speedTarget=me.st[5]>op.st[5]?op.st[5]:null;
      if(!attack.length||!defense.length||speedTarget===null)return '';
      const valid=sp=>{
        if(sp.some(n=>!Number.isInteger(n)||n<0||n>32)||sp.reduce((a,b)=>a+b,0)>66)return false;
        const c=build(p,{...s,sp},'me');
        if(c.formErr||c.st[5]<=speedTarget)return false;
        return attack.every(x=>{const y=result(c,op,x.m);return y&&y.ko.sure===1&&y.ko.n===1&&y.acc===100})&&
          defense.every(x=>{const y=result(op,c,x.m);return y&&y.hi<c.hp});
      };
      if(!valid(s.sp))return '';
      let sp=[...s.sp];
      for(const i of [5,1,3,0,2,4]){
        for(let n=0;n<sp[i];n++){
          const trial=[...sp];trial[i]=n;
          if(valid(trial)){sp=trial;break}
        }
      }
      const freed=s.sp.reduce((a,b)=>a+b,0)-sp.reduce((a,b)=>a+b,0);
      if(freed<=0||!valid(sp))return '';
      const total=sp.reduce((a,b)=>a+b,0),budget=s.sp.reduce((a,b)=>a+b,0);
      // Restore points only when all constraints still hold.
      for(let j=total;j<budget;j++){
        const choices=[0,2,4].filter(i=>sp[i]<32).map(i=>{const trial=[...sp];trial[i]++;const st=calcStats(p,trial,s.up,s.dn);return {trial,score:Math.min(st[0]*st[2],st[0]*st[4])}}).sort((a,b)=>b.score-a.score);
        const next=choices.find(x=>valid(x.trial));if(!next)break;sp=next.trial;
      }
      if(!valid(sp))return '';
      return '<details class="gset-alt"><summary>火力・耐久・素早さを同時に維持する配分候補</summary><p>'+sp.map((v,i)=>esc(SN[i])+v).join('・')+'（合計'+sp.reduce((a,b)=>a+b,0)+'）</p><ul class="gtips"><li>確定1発：'+attack.map(x=>esc(mName(x.m.id))).join('・')+'</li><li>最大ダメージを1回耐える：'+defense.map(x=>esc(mName(x.m.id))).join('・')+'</li><li>素早さ実数値 '+calcStats(p,sp,s.up,s.dn)[5]+' ＞ '+speedTarget+'</li></ul><p class="vcap">指定の相手・技、満タン・ランク0・非急所、同じ優先度、素早さ補正なしで再計算。順次探索で見つけた候補であり、全配分の最適解や他の相手への性能は保証しません。</p></details>';
    };
    const line=x=>esc(mName(x.m.id))+'：'+x.lo+'〜'+x.hi+' / '+x.hp+' HP（'+(100*x.lo/x.hp).toFixed(1)+'〜'+(100*x.hi/x.hp).toFixed(1)+'%）・'+esc(koLabel(x.ko))+'（命中時）'+(x.acc<100?'・命中 '+x.acc+'%':'');
    // One successful setup from full HP and stage zero; no opposing action is simulated.
    // Unsupported ability/item interactions are excluded rather than guessed.
    const setupState=(me,id,op)=>{
      const stages={349:{atk:1,spe:1},14:{atk:2},417:{spa:2},483:{spa:1,spd:1,spe:1},504:{atk:2,spa:2,spe:2,def:-1,spd:-1},347:{spa:1,spd:1},339:{atk:1,def:1},187:{atk:6}}[id];
      if(!stages||!s.moves.includes(id)||!ls.includes(id)||!MD[id])return null;
      if(!['multiscale','huge-power','inner-focus'].includes(me.ab))return null;
      if(![null,'lifeorb','sitrusberry'].includes(me.item))return null;
      const a={...me,stg:{...me.stg,...stages}};
      if(id===187){
        const cost=Math.floor(a.max/2);if(a.hp<=cost)return null;
        a.hp-=cost;
        if(a.item==='sitrusberry'&&a.hp<=Math.floor(a.max/2)&&op.ab!=='unnerve'){
          a.hp=Math.min(a.max,a.hp+Math.floor(a.max/4));a.item=null;
        }
      }
      return a;
    };
    // Exhaust the HP/physical/special bulk split while keeping both attacks and speed fixed.
    // Compare the actual post-setup HP and one-hit margins, not the HP parity alone.
    const berryPlan=(me,op)=>{
      if(me.item!=='sitrusberry'||!s.moves.includes(187)||op.ab==='unnerve')return '';
      const initial=setupState(me,187,op);if(!initial)return '';
      const incoming=op.moves.filter(m=>simple.has(m.id)&&moveUsable(m,{a:op,d:initial}).ok&&!(m.maxH>1));
      if(!incoming.length)return '';
      const budget=s.sp[0]+s.sp[2]+s.sp[4];
      const score=(a)=>{
        const opt={format:'single',spread:false,crit:false,protean:true,noNext:true};
        const margins=incoming.map(m=>{
          const rr=dmgRolls(op,m,a,opt),v=rr.dist?rr.dist.map(x=>x[0]):rr;
          return v.length&&v.every(Number.isFinite)?a.hp-Math.max(...v):NaN;
        });
        return margins.every(Number.isFinite)?Math.min(...margins):NaN;
      };
      const baseMargin=score(initial);if(!Number.isFinite(baseMargin))return '';
      let best=null;
      for(let h=0;h<=32;h++)for(let d=0;d<=32;d++){
        const f=budget-h-d;if(f<0||f>32)continue;
        const sp=[h,s.sp[1],d,s.sp[3],f,s.sp[5]],c=build(p,{...s,sp},'me'),a=setupState(c,187,op);
        if(!a||a.item!==null||c.formErr||c.st[1]!==me.st[1]||c.st[3]!==me.st[3]||c.st[5]!==me.st[5])continue;
        const margin=score(a);if(!Number.isFinite(margin))continue;
        if(!best||margin>best.margin||(margin===best.margin&&a.hp>best.a.hp))best={sp,a,margin};
      }
      if(!best||best.margin<=baseMargin||best.sp.every((v,i)=>v===s.sp[i]))return '';
      return '<details class="gset-alt"><summary>オボンのみの発動を含めた耐久配分候補</summary><p>'+best.sp.map((v,i)=>esc(SN[i])+v).join('・')+'（合計'+best.sp.reduce((a,b)=>a+b,0)+'）</p><p>はらだいこ後のHP '+initial.hp+'/'+initial.max+' → '+best.a.hp+'/'+best.a.max+'（オボンのみ消費済み）</p><p>比較対象の技：'+incoming.map(m=>esc(mName(m.id))).join('・')+'。最も厳しい最大ダメージ後の残りHP（計算上） '+baseMargin+' → '+best.margin+'</p><p class="vcap">攻撃・特攻・素早さの配分を固定し、残りのHP・防御・特防の全合法配分を比較。満タンから積み技が成功した後、指定の相手の技を1回受ける条件。負の値は不足HPを示します。他の相手や積むターンの安全性は保証しません。</p></details>';
    };
    /* Item-specific candidate search, one opponent at a time.
       Keep the original nature and moves, compare the same attack and defensive threats.
       Choice items are excluded from setup sets (move locking). */
    const itemPlans=(me,op)=>{
      const setup=[349,187,14,417,483,504,347,339].find(id=>s.moves.includes(id));
      const items=setup?['lifeorb','sitrusberry','leftovers','focussash']:['lifeorb','sitrusberry','leftovers','focussash','choiceband','choicespecs','choicescarf'];
      const opt={format:'single',spread:false,crit:false,protean:true,noNext:true};
      // Use unboosted single-turn damage bounds. No end-turn recovery or recoil is modeled here.
      const attacks=me.moves.filter(m=>simple.has(m.id)&&!(m.maxH>1)&&moveUsable(m,{a:me,d:op}).ok);
      const threats=op.moves.filter(m=>simple.has(m.id)&&!(m.maxH>1)&&moveUsable(m,{a:op,d:me}).ok);
      if(!attacks.length||!threats.length||me.formErr||op.formErr||[me,op].some(x=>CALC_UNIMPL.includes(x.ab)||CALC_UNVERIFIED[x.ab]))return '';
      const bounds=(a,d,m)=>{
        if(!moveUsable(m,{a,d}).ok)return null;
        if(m.pri>0&&typeof PRIO_BLOCK!=='undefined'&&PRIO_BLOCK.has(d.ab)&&a.ab!=='mold-breaker')return null;
        const r=dmgRolls(a,m,d,opt),v=r.dist?r.dist.map(x=>x[0]):r;
        return v.length&&v.every(Number.isFinite)?{lo:Math.min(...v),hi:Math.max(...v)}:null;
      };
      const baseline=attacks.map(m=>({m,b:bounds(me,op,m)})).filter(x=>x.b&&x.b.lo>0).sort((a,b)=>b.b.lo-a.b.lo||a.m.id-b.m.id)[0];
      if(!baseline)return '';
      const target=baseline.m,baseSpeed=effSpd(me,op),opSpeed=effSpd(op,me),budget=s.sp.reduce((a,b)=>a+b,0);
      const floorSpeed=Math.min(baseSpeed,opSpeed+1);
      // Preserve the reference damage and the existing speed target where possible.
      // A bounded neighborhood search avoids enumerating millions of legal spreads on page load.
      const evaluate=(item,sp)=>{
        const a=build(p,{...s,item,sp},'me');if(a.formErr)return null;
        const b=bounds(a,op,target);if(!b)return null;
        const incoming=threats.map(m=>bounds(op,a,m));
        if(incoming.some(x=>!x))return null;
        const worst=Math.max(...incoming.map(x=>x.hi)),speed=effSpd(a,op);
        return {item,sp,a,b,worst,speed,margin:a.hp-worst,meets:b.lo>=baseline.b.lo&&speed>=floorSpeed};
      };
      const better=(a,b)=>!b||Number(a.meets)>Number(b.meets)||(a.meets===b.meets&&(a.meets?(a.margin>b.margin||(a.margin===b.margin&&a.b.lo>b.b.lo)):(a.b.lo>b.b.lo||(a.b.lo===b.b.lo&&a.speed>b.speed))));
      const rows=[];
      for(const item of [...new Set([s.item,...items])]){
        if(!item||!items.includes(item)||!Object.prototype.hasOwnProperty.call(ITEMN,item)||CALC_UNIMPL_IT.includes(item))continue;
        let best=evaluate(item,[...s.sp]);if(!best)continue;
        for(let pass=0;pass<2;pass++){
          const origin=[...best.sp];let next=best;
          for(const from of [0,1,2,3,4,5])for(const to of [0,1,2,3,4,5]){
            if(from===to)continue;
            for(const n of [1,2,4,8,16,32]){
              if(origin[from]<n||origin[to]+n>32)continue;
              const sp=[...origin];sp[from]-=n;sp[to]+=n;
              if(sp.reduce((a,b)=>a+b,0)!==budget)continue;
              const x=evaluate(item,sp);if(x&&better(x,next))next=x;
            }
          }
          best=next;if(best.sp.every((v,i)=>v===origin[i]))break;
        }
        rows.push(best);
      }
      if(rows.length<2)return '';
      return '<details class="gset-alt"><summary>持ち物別の能力配分比較（通常時）</summary><p class="vcap">同じ相手・技・能力補正で比較。基準：'+esc(mName(target.id))+'の最小ダメージ'+baseline.b.lo+'、素早さ'+floorSpeed+'以上。各持ち物を個別に装備した候補で、条件を満たすものは耐久を優先。満たせない候補も区別して掲載します。</p>'+rows.map(x=>'<div class="gdoc"><b>'+esc(ITEMN[x.item])+'</b><p>'+x.sp.map((v,i)=>esc(SN[i])+v).join('・')+'（合計'+budget+'）</p><p>'+esc(mName(target.id))+' '+x.b.lo+'〜'+x.b.hi+' / '+op.max+' HP・受ける最大ダメージ '+x.worst+' / '+x.a.max+' HP・素早さ '+x.speed+'</p><p>'+ (x.meets?'基準の火力・素早さを維持':'基準未達：比較用候補')+(x.item==='focussash'?'／満タン時のタスキ発動はこの生ダメージ比較に含まない':x.item==='leftovers'?'／ターン終了時の回復は含まない':x.item==='sitrusberry'?'／被弾後の回復は含まない':x.item==='lifeorb'?'／攻撃後の反動は含まない':'')+'</p></div>').join('')+'<p class="vcap">限定した配分移動を2巡探索。全配分の最適解ではありません。通常時・非急所・満タン・天候なしの比較で、積み技後の状態や対戦全体の勝率は評価しません。</p></details>';
    };
    const setupHTML=(me,op)=>{
      const sections=[349,187,14,417,483,504,347,339].map(id=>{
        const a=setupState(me,id,op);if(!a)return '';
        const outgoing=a.moves.map(m=>result(a,op,m)).filter(Boolean);
        const incoming=op.moves.map(m=>result(op,a,m)).filter(Boolean);
        if(!outgoing.length&&!incoming.length)return '';
        const speed=Math.floor(a.st[5]*stgM(a.stg.spe));
        return '<details class="gset-alt"><summary>'+esc(mName(id))+'使用後の比較</summary><p>残りHP '+a.hp+' / '+a.max+'・持ち物 '+esc(a.item?ITEMN[a.item]||a.item:'なし')+'・素早さ '+me.st[5]+' → '+speed+'</p><p>能力ランク：'+Object.entries(a.stg).filter(([,v])=>v).map(([k,v])=>({atk:'攻撃',def:'防御',spa:'特攻',spd:'特防',spe:'素早さ'}[k])+ (v>0?'+':'')+v).join('・')+'</p><b>与えるダメージ</b>'+outgoing.map(y=>'<p>'+line(y)+'</p>').join('')+'<b>受けるダメージ</b>'+incoming.map(y=>'<p>'+line(y)+'</p>').join('')+'<p class="vcap">HP満タンから積み技が1回成功し、相手の行動やターン終了処理がなかった場合。確定数は残りHPを基準とする計算例。積むターンの安全性は保証しません。</p></details>';
      }).join('');
      return sections;
    };
    /* Compare complete four-move sets against the same legal opponent fixtures.
       Preserve setup/status, priority and existing STAB types; only swap ordinary attacks.
       Cache each move/opponent calculation before evaluating combinations. */
    const movePlans=(me,opponents)=>{
      if(!opponents.length||s.moves.length!==4||me.formErr)return '';
      const supported=id=>simple.has(id)&&!!MV[id];
      const current=s.moves.filter(id=>MV[id]);
      // Do not claim an improvement if an existing attack is outside the evaluated subset.
      if(!current.length||current.some(id=>!supported(id)))return '';
      const candidates=[...new Set(ls.filter(supported))].filter(id=>!s.moves.includes(id));
      const locked=s.moves.filter(id=>!MV[id]||mvObj(id).pri>0);
      const stab=new Set(current.map(id=>mvObj(id).t).filter(t=>p.t.includes(t)));
      const cache=new Map(),opt={format:'single',spread:false,crit:false,protean:true,noNext:true};
      const measure=(id,op)=>{
        const k=id+'|'+op.p.no;if(cache.has(k))return cache.get(k);
        const m=mvObj(id);let v=null;
        if(!me.formErr&&!op.formErr&&!m.prot&&!(m.maxH>1)&&moveUsable(m,{a:me,d:op}).ok&&![me,op].some(x=>CALC_UNIMPL.includes(x.ab)||CALC_UNVERIFIED[x.ab]||CALC_UNIMPL_IT.includes(x.item))&&!(m.pri>0&&typeof PRIO_BLOCK!=='undefined'&&PRIO_BLOCK.has(op.ab)&&me.ab!=='mold-breaker')){
          const rolls=dmgRolls(me,m,op,opt),raw=rolls.dist?rolls.dist.map(x=>x[0]):rolls,acc=accOf(me,m,op);
          if(raw.length&&raw.every(Number.isFinite)&&Number.isFinite(acc))v={id,lo:Math.min(...raw),hi:Math.max(...raw),acc,hp:op.max};
        }
        cache.set(k,v);return v;
      };
      const evaluate=ids=>{
        if(ids.length!==4||new Set(ids).size!==4||!ids.every(id=>ls.includes(id)&&(MD[id]||MV[id]))||!locked.every(id=>ids.includes(id)))return null;
        const atk=ids.filter(id=>MV[id]);if(![...stab].every(t=>atk.some(id=>mvObj(id).t===t)))return null;
        const rows=opponents.map(op=>{
          const all=atk.map(id=>measure(id,op));if(all.some(x=>!x))return null;
          return all.sort((a,b)=>Math.min(1,b.lo/b.hp)*b.acc-Math.min(1,a.lo/a.hp)*a.acc||b.lo/b.hp-a.lo/a.hp||a.id-b.id)[0];
        });
        if(rows.some(x=>!x))return null;
        return rows;
      };
      const baseline=evaluate(s.moves);if(!baseline)return '';
      const value=x=>Math.min(1,x.lo/x.hp)*x.acc/100;
      const options=[];
      for(const from of current.filter(id=>!locked.includes(id)))for(const to of candidates){
        const ids=s.moves.map(id=>id===from?to:id),rows=evaluate(ids);if(!rows)continue;
        const gain=rows.map((x,i)=>value(x)-value(baseline[i]));
        if(!gain.some(v=>v>1e-9)||gain.some(v=>v< -1e-9))continue;
        options.push({from,to,ids,rows,gain:gain.reduce((a,b)=>a+b,0)});
      }
      options.sort((a,b)=>b.gain-a.gain||a.to-b.to||a.from-b.from);
      const best=options.slice(0,3);
      return '<details class="gset-alt"><summary>技構成の比較・入れ替え候補</summary><p class="vcap">積み技・補助技・現在の先制技・一致技のタイプは維持。習得可能な検証対象の攻撃技を1枠ずつ交換し、比較相手全員に対する最小ダメージと命中率を評価します。</p>'+(best.length?best.map(x=>'<div class="gdoc"><b>'+esc(mName(x.from))+' → '+esc(mName(x.to))+'</b><p>技構成：'+x.ids.map(id=>esc(mName(id))).join('・')+'</p>'+x.rows.map((y,i)=>'<p>'+esc(opponents[i].p.n)+'：'+esc(mName(baseline[i].id))+' '+baseline[i].lo+'〜'+baseline[i].hi+' → '+esc(mName(y.id))+' '+y.lo+'〜'+y.hi+' / '+y.hp+' HP（命中 '+baseline[i].acc+' → '+y.acc+'%）</p>').join('')+'</div>').join(''):'<p>今回の条件と検証対象技の範囲では、全比較相手への評価を維持しながら改善する1枠交換は見つかりませんでした。</p>')+'<p class="vcap">満タン・ランク0・非急所・天候なし・固定育成。命中率を考慮した最小ダメージの比較で、勝率や確定数そのものではありません。反動・追加効果・交代・複数ターンの価値は別途検証が必要です。</p></details>';
    };
    /* Joint search over complete legal builds. Every candidate is checked against
       the same opponents, with the same nature and ability. No synthetic win score. */
    const integratedPlans=(me,opponents)=>{
      if(!opponents.length||me.formErr||s.moves.length!==4)return '';
      const original=s.moves.filter(id=>MV[id]),locked=s.moves.filter(id=>!MV[id]||mvObj(id).pri>0);
      // Knock Off is evaluated here only against fixtures without held items.
      const supported=id=>!!MV[id]&&(simple.has(id)||id===282);
      if(!original.length||original.some(id=>!supported(id))||opponents.some(o=>o.item||o.disg||o.formErr))return '';
      const stab=[...new Set(original.map(id=>mvObj(id).t).filter(t=>p.t.includes(t)))];
      const setup=s.moves.find(id=>[349,187,14,417,483,504,347,339].includes(id));
      const items=setup?['lifeorb','sitrusberry']:['lifeorb','sitrusberry','choiceband','choicespecs','choicescarf'];
      const opt={format:'single',spread:false,crit:false,protean:true,noNext:true};
      const budget=s.sp.reduce((a,b)=>a+b,0),cache=new Map();
      const legal=x=>x.moves.length===4&&new Set(x.moves).size===4&&x.moves.every(id=>ls.includes(id)&&(MV[id]||MD[id]))&&locked.every(id=>x.moves.includes(id))&&stab.every(t=>x.moves.some(id=>MV[id]&&mvObj(id).t===t))&&x.sp.length===6&&x.sp.every(n=>Number.isInteger(n)&&n>=0&&n<=32)&&x.sp.reduce((a,b)=>a+b,0)===budget&&budget<=66&&Object.prototype.hasOwnProperty.call(ITEMN,x.item)&&!CALC_UNIMPL_IT.includes(x.item)&&(!setup||!/^choice/.test(x.item));
      const bounds=(a,d,m)=>{
        if(!moveUsable(m,{a,d}).ok||m.maxH>1||m.prot||[a,d].some(x=>CALC_UNIMPL.includes(x.ab)||CALC_UNVERIFIED[x.ab]||CALC_UNIMPL_IT.includes(x.item)))return null;
        if(m.pri>0&&typeof PRIO_BLOCK!=='undefined'&&PRIO_BLOCK.has(d.ab)&&a.ab!=='mold-breaker')return null;
        const r=dmgRolls(a,m,d,opt),v=r.dist?r.dist.map(x=>x[0]):r,acc=accOf(a,m,d);
        return v.length&&v.every(Number.isFinite)&&Number.isFinite(acc)?{lo:Math.min(...v),hi:Math.max(...v),acc,id:m.id}:null;
      };
      const evaluate=x=>{
        const k=JSON.stringify([x.item,x.sp,x.moves]);if(cache.has(k))return cache.get(k);
        if(!legal(x))return null;
        const a=build(p,x,'me');if(a.formErr)return null;
        const rows=[];
        for(const op of opponents){
          const c=setup?setupState(a,setup,op):a;if(!c)return null;
          const attacks=c.moves.map(m=>supported(m.id)?bounds(c,op,m):null);
          const threats=op.moves.map(m=>supported(m.id)?bounds(op,c,m):null);
          if(!attacks.length||!threats.length||attacks.some(v=>!v)||threats.some(v=>!v))return null;
          const quality=v=>Math.min(1,v.lo/op.hp)*v.acc/100;
          const hit=attacks.sort((u,v)=>quality(v)-quality(u)||v.lo-u.lo||u.id-v.id)[0];
          const worst=Math.max(...threats.map(v=>v.hi));
          const speed=effSpd(c,op),oppSpeed=effSpd(op,c);
          rows.push({no:op.p.no,name:op.p.n,hit,hp:op.hp,quality:quality(hit),margin:c.hp-worst,remaining:c.hp,max:c.max,speed,order:Math.sign(speed-oppSpeed),item:c.item});
        }
        const v={x,rows};cache.set(k,v);return v;
      };
      const baseline=evaluate(s);if(!baseline)return '';
      const compare=(a,b)=>a.rows.every((r,i)=>r.quality+1e-9>=b.rows[i].quality&&r.margin>=b.rows[i].margin&&r.order>=b.rows[i].order);
      const improves=(a,b)=>compare(a,b)&&a.rows.some((r,i)=>r.quality>b.rows[i].quality+1e-9||r.margin>b.rows[i].margin||r.order>b.rows[i].order);
      // Seed each legal held item and one-slot move alternative before searching AP.
      // Keep a small deterministic beam; cap calculation work per page.
      const variants=[s.moves];
      for(const from of original.filter(id=>!locked.includes(id)))for(const to of ls.filter(id=>supported(id)&&!s.moves.includes(id)))variants.push(s.moves.map(id=>id===from?to:id));
      const rank=(a,b)=>Number(compare(b,baseline))-Number(compare(a,baseline))||Math.min(...b.rows.map(r=>r.quality))-Math.min(...a.rows.map(r=>r.quality))||Math.min(...b.rows.map(r=>r.margin))-Math.min(...a.rows.map(r=>r.margin));
      let beam=[];
      for(const item of [...new Set([s.item,...items])])for(const moves of variants){
        if(cache.size>=180)break;
        const v=evaluate({...s,item,moves,sp:[...s.sp]});if(v)beam.push(v);
      }
      beam.sort(rank);beam=beam.slice(0,6);
      for(let pass=0;pass<2;pass++){
        const next=[...beam];
        for(const seed of beam){
          for(let from=0;from<6;from++)for(let to=0;to<6;to++)for(const n of [1,2,4,8,16]){
            if(cache.size>=360||from===to||seed.x.sp[from]<n||seed.x.sp[to]+n>32)continue;
            const sp=[...seed.x.sp];sp[from]-=n;sp[to]+=n;
            const v=evaluate({...seed.x,sp});if(v)next.push(v);
          }
        }
        const unique=[...new Map(next.map(v=>[JSON.stringify([v.x.item,v.x.sp,v.x.moves]),v])).values()];
        unique.sort(rank);beam=unique.slice(0,6);
      }
      const best=[...cache.values()].filter(v=>improves(v,baseline)).sort(rank).slice(0,3);
      const render=v=>'<div class="gdoc"><b>'+esc(ITEMN[v.x.item])+'</b><p>'+v.x.moves.map(id=>esc(mName(id))).join('・')+'</p><p>'+v.x.sp.map((n,i)=>esc(SN[i])+n).join('・')+'（合計'+budget+'）</p>'+v.rows.map((r,i)=>'<p>'+esc(r.name)+'：'+esc(mName(baseline.rows[i].hit.id))+' '+baseline.rows[i].hit.lo+'〜'+baseline.rows[i].hit.hi+' → '+esc(mName(r.hit.id))+' '+r.hit.lo+'〜'+r.hit.hi+' / '+r.hp+' HP（命中 '+baseline.rows[i].hit.acc+' → '+r.hit.acc+'%）／被弾後の残りHP指標 '+baseline.rows[i].margin+' → '+r.margin+'／素早さ '+baseline.rows[i].speed+' → '+r.speed+'</p>').join('')+'</div>';
      return '<details class="gset-alt"><summary>技・持ち物・能力ポイントの一体比較</summary><p class="vcap">'+(setup?esc(mName(setup))+'が満タンから1回成功した後':'通常時')+'の比較。相手全員への命中を考慮した最小ダメージ、被弾後の残りHP指標、同優先度での行動順を悪化させない候補だけを掲載。</p>'+(best.length?best.map(render).join(''):'<p>今回の探索範囲では全条件を維持しながら改善する候補は見つかりませんでした。</p>')+'<p class="vcap">比較した育成 '+cache.size+'件。限定した技・持ち物・配分移動による探索で、全組み合わせの最適解ではありません。反動、被弾後のきのみ発動、ターン終了回復、積む際の被弾、技の追加効果は含みません。こだわり系は相手ごとに選んだ1回の攻撃だけを評価します。</p></details>';
    };
    const sw=B.weather;B.weather=null;
    try{
      const me=build(p,s,'me');if(me.formErr)return '';
      const opponents=[];
      const sections=fixtures.filter(x=>x.no!==p.no).map(x=>{
        const q=byNo[x.no],ls=LSD[x.no]?.[1]||[],abs=ABD[x.no]||[];
        if(!q||!abs.some(z=>z[0]===x.ab)||!x.moves.every(id=>ls.includes(id)&&MV[id]))return '';
        const op=build(q,{...x,item:null},'op');
        if(!op.formErr)opponents.push(op);
        const out=me.moves.map(m=>result(me,op,m)).filter(Boolean);
        const inc=op.moves.map(m=>result(op,me,m)).filter(Boolean);
        if(!out.length&&!inc.length)return '';
        return '<details class="gset-alt"><summary>'+esc(q.n)+'との比較</summary><p class="vcap">相手：'+esc(ABN[x.ab]||x.ab)+'・持ち物なし・'+esc(natName(x.up,x.dn))+'・'+x.sp.map((v,i)=>v?SN[i]+v:'').filter(Boolean).join('・')+'</p><b>与えるダメージ</b>'+out.map(y=>'<p>'+line(y)+'</p>').join('')+'<b>受けるダメージ</b>'+inc.map(y=>'<p>'+line(y)+'</p>').join('')+thresholds(me,op,out,inc)+jointPlan(me,op,out,inc)+setupHTML(me,op)+berryPlan(me,op)+itemPlans(me,op)+'</details>';
      }).join('');
      return sections?'<details class="gset-alt"><summary>火力・耐久の計算例</summary><p class="vcap">双方HP満タン・ランク0・天候なし・急所なし。比較用の固定育成であり、環境使用率ではありません。確定数は命中を前提とした計算機の推定で、反動・交代・ターン終了時の回復などは別途確認してください。</p>'+sections+movePlans(me,opponents)+integratedPlans(me,opponents)+'</details>':'';
    }catch(e){return '<p class="vcap">火力・耐久の比較は計算できませんでした。</p>'}finally{B.weather=sw}
  };
  const setHTML=(s,i)=>{const nat=natName(s.up,s.dn),st=calcStats(p,s.sp,s.up,s.dn),alt=altOf(s),hard=hardOf(s);
    /* 2026/11/15 図鑑のページの「型・育成」タブ（o.parts）：形式・姿・出典の札と「この型をパーティに入れる」 */
    const reviewed=Array.isArray(s.refs);
    const meta=o.parts?`<div class="gset-meta"><span class="gsm-f">${s.fmt==='double'?'ダブル':'シングル'}</span><span>姿：${esc(p.n)}</span><span class="gsm-v gsm-${s.live?'ext':s.usage?'site':'calc'}">${s.live?'外部の集計（項目ごとの割合を組み合わせた型）':s.usage?'Game Kid/s 利用者の保存した育成の集計':reviewed?'外部戦術を参考にした独自の検証用育成例':'当サイトが計算で組んだ提案'}</span></div>`:'';
    return `<div class="gset" id="gset-${p.no}-${i}">${meta}<b>${esc(s.title)}${s.rec?'<span class="atag">おすすめ</span>':''}</b><p>${esc(s.why)}</p><dl>
      <dt>特性</dt><dd>${s.ab?abA(s.ab):'—'}</dd><dt>持ち物</dt><dd>${itA(s.item)}</dd><dt>性格</dt><dd>${esc(nat||'—')}</dd>
      <dt>能力ポイント</dt><dd>${s.sp.map((v,i)=>v?`${SN[i]}${v}`:'').filter(Boolean).join('・')}</dd></dl>
      <div class="pills gchips" style="padding:6px 0 0">${s.moves.map(mvA).join('')}</div>
      <table class="gstat"><tr>${SN.map(n=>`<th>${n}</th>`).join('')}</tr><tr>${st.map(v=>`<td>${v}</td>`).join('')}</tr><tr class="gsp">${s.sp.map(v=>`<td>${v||'-'}</td>`).join('')}</tr></table>
      <p class="vcap" style="margin:2px 0 0">上の段はレベル50の実数値、下の段は能力ポイント。</p>
      <h4>この型の役割</h4><p>${reviewed?esc(s.why):roleOf(s)}</p>
      ${reviewed?`<details class="gset-alt"><summary>技・持ち物・能力配分の根拠</summary><ul class="gtips">${s.moves.map((id,j)=>'<li>'+esc(mName(id))+'：'+esc(s.reasons[j])+'</li>').join('')}</ul><p>${esc(s.itemWhy)}</p><p>能力ポイントは最大配分による比較用の例です。特定の相手への最適調整ではありません。</p><p>参考にした戦術（2026-11-28確認）：${s.refs.map(([n,u])=>'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+esc(n)+'</a>').join('・')}</p><p class="vcap">参考記事の型を転載したものではありません。対戦実績・最適性は未検証です。計算例は下の条件付き比較を確認してください。</p></details>`:''}
      ${o.parts&&reviewed?allocationHTML(s):''}
      ${o.parts&&reviewed?benchmarkHTML(s):''}
      ${alt.out.length?(o.parts?`<details class="gset-alt"><summary>技の入れ替え候補（${alt.out.length}）</summary>${alt.rep?`<p>${esc(mName(alt.rep))}の枠は、パーティに合わせて入れかえられる。</p>`:''}${alt.out.map(([id,w])=>mvCard(id,w)).join('')}</details>`
        :`<h4>技の入れ替え候補</h4>${alt.rep?`<p>${esc(mName(alt.rep))}の枠は、パーティに合わせて入れかえられる。</p>`:''}${alt.out.map(([id,w])=>mvCard(id,w)).join('')}`):''}
      ${o.parts?`<p class="vcap" style="margin:6px 0 0">${s.live?'集計の持ち物・技・特性・性格・能力ポイントの割合を、それぞれ多い順に組み合わせた型です。実在の1人の型と同じとは限りません。':s.usage?'当サイトの利用者が保存した育成から作った型です（3人以上）。':'種族値・覚える技・特性から計算で組んだ提案です。実際によく使われている型とは限りません。'}</p>`:''}
      ${hard?`<h4>苦手なポケモン</h4><p><b>${esc(hard.head)}</b><br>${esc(hard.why)}</p><div class="ghard">${hard.bad.map(r=>`<a class="row" href="${mon(r.q.no)}"><span class="av">${stamp(r.q)}</span><div class="row-m"><div class="row-t">${nm(r.q)}</div><div class="row-s">こちらの技で最大 ${Math.round(r.my)}%・${r.their>=100?'相手の技で一撃で倒される':'相手の技で最大 '+Math.round(r.their)+'%'}</div></div></a>`).join('')}</div>${o.parts?'<p class="vcap" style="margin:4px 0 0">相手は合計種族値の高いポケモンとメガシンカの姿を、${SET_MIX}で計算（当サイトのダメージ計算・乱数の真ん中あたり）。</p>':''}`:''}
      ${o.parts?`<div class="btns" style="padding:10px 0 0"><button class="btn btn-s" data-useset="${i}">この型をパーティに入れる</button></div>`:''}
      </div>`};
  /* メガシンカの姿：特徴と「メガシンカで変わるところ」だけを返す（元のポケモンの解説の中に出す） */
  let megaHead='',megaCh=null;
  if(base){
    const stone=stoneK;
    const wl=a=>a.length?list(a.map(x=>x[0]+(x[1]>=4?'（4倍）':''))):'なし';
    const bw=wl(monDef(base).filter(x=>x.m>=2).sort((a,b)=>b.m-a.m).map(x=>[x.t,x.m])),mw=wl(weak);
    const up=SN.map((n,i)=>({n,d:p.s[i]-base.s[i]})).filter(x=>x.d).sort((a,b)=>b.d-a.d);
    const ch=[];
    ch.push(`${itA(stone)}を持たせると、バトル中に1回だけメガシンカできる（1試合に1匹まで）。`);
    ch.push(`種族値の合計が${base.bst}から${p.bst}に上がる（${up.map(x=>`${x.n}${x.d>0?'+':''}${x.d}`).join('・')}）。`);
    if(p.t.join()!==base.t.join()||bw!==mw)ch.push(`${p.t.join()!==base.t.join()?`タイプが${list(base.t)}から${list(p.t)}に変わり、`:'特性が変わるため、'}${bw===mw?`弱点は${mw}のまま`:`弱点が${bw}から${mw}になる`}。`);
    ch.push(`特性は${abA(p.ab)}になる${ABDS[p.ab]?`（${esc(ABDS[p.ab])}）`:''}。`);
    const bs=maxSpe(base),ms=maxSpe(p);
    if(ms!==bs)ch.push(`素早さは最速で${bs}から${ms}に${ms>bs?'上がる':'下がる'}。メガシンカしたターンから速さが変わるので、先に動ける相手も変わる。`);
    ch.push('メガストーンを持たせると、ほかの持ち物は持てない。持ち物の効果とメガシンカのどちらが強いかで選ぶ。');
    megaCh=ch;
    megaHead=`<div class="gmeg-band" id="gm-${p.no}"><span class="atag">メガシンカすると</span><h2>${esc(p.n)}</h2><div class="chips" style="margin-top:6px">${p.t.map(chip).join('')}</div></div>
      <div class="gdoc" style="padding-top:4px">${sum}<h3>メガシンカで変わるところ</h3><ul class="gtips">${ch.map(x=>`<li>${x}</li>`).join('')}</ul></div>`;
  }
  /* ---- このポケモンを軸にしたパーティの例（攻撃・耐久・場づくりのどれかで軸になれるときだけ） ---- */
  let axisHTML='';
  if(!o.noAxis&&(offS>=.55||bulkS>=.6||wset||wspd||tr.length)){
    const team=axisTeam(p,{wset,wspd,slow:spdS<.25&&offS>=.5});
    if(team.length>=6){
      const ss=archSets(['axis'],team);
      if(stoneK&&ss[0])ss[0].item=stoneK;
      const name=(base?'メガ':'')+formInfo(base||p).base+'軸';
      const lst=team.map((q,i)=>({no:i===0&&base?base.no:q.no,set:ss[i]?toSaved(ss[i]):undefined}));
      if(typeof AXIS_DATA!=='undefined')AXIS_DATA[p.no]={name,list:lst};
      const why=q=>{const w=weak.map(x=>x[0]).filter(t=>monDef(q).find(x=>x.t===t).m<1);const sy=[];
        if(wset&&(ABD[q.no]||[]).some(a=>WSPD[a[0]]===WSET[wset]))sy.push(`${GM_WN[WSET[wset]]}で速くなる`);
        if(wspd&&(ABD[q.no]||[]).some(a=>WSET[a[0]]===WSPD[wspd]))sy.push(`天気を${GM_WN[WSPD[wspd]]}にできる`);
        return [...sy,w.length?`${list(w.slice(0,3))}を受けられる`:''].filter(Boolean).join('・')||'苦手な相手を補う'};
      axisHTML=`<div class="sec"><h2>${esc(base?p.n:p.n)}を軸にしたパーティの例</h2><span style="font-size:12px;color:var(--dim)">データから組んだ例</span></div>
        <p class="note" style="padding-top:0">${esc(p.n)}の弱点を受けられる味方、${esc(p.n)}が苦手な相手に強い味方、天気やトリックルームで助け合える味方から選びました。</p>
        ${team.map((q,i)=>{const st=ss[i];return `<a class="row" href="${mon(i===0&&base?base.no:q.no)}"><span class="av">${stamp(q)}</span><div class="row-m"><div class="row-t">${nm(q)}</div><div class="row-s">${i===0?'軸':esc(why(q))}</div>${st?`<div class="row-s" style="color:var(--fg)">${esc(ITEMN[st.item]||'')}／${esc(st.moves.map(mName).join('・'))}</div>`:''}</div></a>`}).join('')}
        <div class="btns">${o.link?`<a class="btn btn-s" href="${lk('#/p/'+(base?base.no:p.no))}">サイトでこのパーティを使う</a>`:`<button class="btn btn-p" data-axis="${p.no}">このパーティを使う</button>`}</div>`;
    }
  }
  const sections=`
  ${topRoles.length?`<div class="sec"><h2>向いている役割</h2></div><div class="gdoc" style="padding-top:0">${topRoles.map(r=>`<div class="adv adv-tip" style="margin:8px 0"><b>${esc(r.name)}</b><p>${r.text.replace(/[<>]/g,'')}</p></div>`).join('')}</div>`:''}
  ${SETS.length?`<div class="sec"><h2>型の例</h2><span style="font-size:12px;color:var(--dim)">データから組んだ例</span></div>${gsetIndex(SETS,p.no)}${SETS.map(setHTML).join('')}
    <p class="note" style="padding-top:2px;color:var(--mute)">${SETS.some(x=>x.live||x.usage)?'「よく使われている型」は使用率の集計から、それ以外は':''}種族値・覚える技・特性から当サイトが計算で組んだ例です。${SETS.some(x=>x.live||x.usage)?'集計の型は項目ごとにいちばん多いものを組み合わせたので、実在の1人の型と同じとは限りません。':'実際によく使われている型とは違うことがあります。'}</p>`:''}
  ${liveF?gmLiveHTML(p,lk):''}  ${base||typeof usageGuideHTML!=='function'?'':usageGuideHTML(p,'single',lk)+usageGuideHTML(p,'double',lk)}
  ${mvParts.length?`<div class="sec"><h2>技の選び方</h2></div>${mvParts.map(([t,d,ids])=>`<div class="gdoc gsub"><h3>${t}</h3>${d?`<p>${d}</p>`:''}</div>${ids.length?`<div class="pills gchips">${ids.map(mvA).join('')}</div>`:''}`).join('')}`:''}
  ${abl.length?`<div class="sec"><h2>特性</h2></div><div class="gdoc" style="padding-top:0">${abl.map(([k,hid])=>{const rs=abRoles(k);return `<div class="gtag" style="margin-top:6px"><b>${abA(k)}${hid?'<span class="atag">隠れ特性</span>':''}${rs.length?`<span class="atag">${esc(rs[0][1].replace(/特性$/,''))}</span>`:''}</b><small>${esc(ABDS[k]||'')}</small></div>`}).join('')}</div>`:''}
  ${partners.length?`<div class="sec"><h2>相性のいい味方の例</h2></div><p class="note" style="padding-top:0">${esc(p.n)}の弱点を受けられるか、天気・トリックルームで助け合えるポケモンです（タイプと特性から計算）。</p>
    ${partners.map(({q,why})=>`<a class="row" href="${mon(q.no)}"><span class="av">${stamp(q)}</span><div class="row-m"><div class="row-t">${nm(q)}</div><div class="row-s">${why.slice(0,2).join('。')}</div></div><span class="chev">${SVG(I.chev,18)}</span></a>`).join('')}`:''}
  ${good.length?`<div class="sec"><h2>有利に戦いやすい相手</h2></div><p class="note" style="padding-top:0">こちらのタイプ一致技で弱点を突けて、相手のタイプ一致技では弱点を突かれない相手です（合計種族値の高い順）。</p><div class="pills gchips">${good.map(mA).join('')}</div>`:''}
  ${axisHTML}`;
  /* 2026/11/15 図鑑のページの6つのタブ（09-pokemon.js）：部品ごとに返す。検索向けの静的ページ（gen-pages）は今までどおり1本の文 */
  if(o.parts){
    const covOne=id=>{const m=MV[id]&&mvObj(id);return m&&m.pow>0&&m.cls<2?T.filter(d=>mult(m.t,[d])>=2):[]};
    const repl=[];SETS.forEach(st=>{const a=altOf(st);if(!a.rep)return;const others=new Set(st.moves.filter(x=>x!==a.rep).flatMap(covOne)),lost=covOne(a.rep).filter(d=>!others.has(d));
      a.out.forEach(([id,w])=>{if(id!==a.rep&&!st.moves.includes(id))repl.push({set:st.title,fmt:st.fmt||'single',live:!!(st.live||st.usage),from:a.rep,to:id,why:w,lost})})});
    /* 概要のひとこと：積む役は「積み技を入れた型だけ」の話なので、ひとことの中心にはしない（2026/11/15 依頼主：積み技のない型まで積む役と書かない） */
    /* いたずらごころで補助技を先に出せるポケモンは、補助の役を中心のまま（オーロンゲ・エルフーン等） */
    const prankSup=abK.includes('prankster')&&roles.find(r=>r.k==='support');
    const wxr=roles.find(r=>r.k==='wset')||(offS>=.45&&!prankSup?roles.find(r=>r.k==='wspd'):null);
    /* 攻撃・特攻が上位なら（上位4割）、守りの強みが先に並んでいてもアタッカーをひとことの中心にする（2026/11/15 依頼主：メガアブソルZ が「起点作り」になっていた） */
    const atkR=offS>=.6&&!prankSup?roles.find(r=>r.k==='attacker'):null;
    const role2=wxr||prankSup||atkR||roles.find(r=>want.includes(r.k)&&r.k!=='setup')||roles.find(r=>r.k!=='setup')||role;
    const offPro=pros.find(x=>x[3]==='off');
    const strong2=prankSup&&role2===prankSup?'いたずらごころ選択時の変化技の優先度':atkR&&role2===atkR?(offPro?offPro[0].replace(/が高い$/,'の高さ'):''):strong;
    const opt=roles.filter(r=>r!==role2&&['setup','support','bulky','tr','pivot'].includes(r.k)).slice(0,2).map(r=>esc(r.name).replace(/（.*$/,''));
    const lead2=`${esc(p.n)}は、${strong2&&!wxr?strong2+'を活かした、':''}${role2?(role2.k==='wset'?esc(role2.name):esc(role2.name).replace(/（.*$/,''))+'として使いやすいポケモン':'技や特性から戦い方を検討するポケモン'}。${opt.length?`型によっては${opt.join('や')}もできる。`:''}${cons[0]?`ただし、${cons[0][3]}点に注意。`:''}`;
    /* 2026/11/16 依頼主に届いた報告（メガガブリアスの図鑑：通常・メガ・メガZ で「どんなポケモン？」が同じ）：
       姿ごとの違いを種族値・タイプ・特性のデータから1文足す。メガの姿＝元の姿から何が変わるか、元の姿＝それぞれのメガで何が変わるか */
    const fdiff=(a,b)=>{const d=SN.map((n,i)=>({n,i,a:a.s[i],b:b.s[i],d:b.s[i]-a.s[i]})).filter(x=>x.d);
      const upx=d.filter(x=>x.d>0).sort((x,y)=>y.d-x.d).slice(0,2),dn=d.filter(x=>x.d<0).sort((x,y)=>x.d-y.d).slice(0,1);
      const kind=q=>q.s[1]>=q.s[3]+10?'物理':q.s[3]>=q.s[1]+10?'特殊':'';
      return{t:[upx.length?`${upx.map(x=>`${x.n}が${x.a}→${x.b}`).join('、')}に上が${dn.length?'り':'る'}`:'',dn.length?`${dn.map(x=>`${x.n}は${x.a}→${x.b}に下がる`).join('')}`:''].filter(Boolean).join('、'),
        ty:a.t.join()!==b.t.join()?`${list(b.t)}タイプになり`:'',kc:kind(a)!==kind(b)&&kind(b)?`${kind(b)}で攻める形に変わる`:''}};
    let formLead='';
    if(base){const x=fdiff(base,p);formLead=`元の姿（${esc(base.n)}）と比べると、${x.ty?x.ty+'、':''}${x.t||'種族値の配分が変わり'}。特性は${esc(ABN[p.ab]||p.ab)}${x.kc?`で、${x.kc}`:'になる'}。`}
    else if(megas.length)formLead=megas.map(m=>{const x=fdiff(p,m);return `${esc(m.n)}にメガシンカすると、${x.ty?x.ty+'、':''}${x.t||'種族値の配分が変わる'}${x.kc?`（${x.kc}）`:''}。`}).join('');
    /* 役割の並びも、ひとことの役を先頭に。積む役には「積み技を入れた型のとき」と添える */
    const roles2=[role2,...topRoles.filter(r=>r!==role2)].filter(Boolean).slice(0,4).map(r=>r.k==='setup'?{...r,name:r.name+'（積み技を入れた型のとき）'}:r);
    return{lead:lead2+formLead,pros:pros.slice(0,3),cons:cons.slice(0,3),num:numHTML,roles:roles2,megaCh,megas:megas.map(m=>({m,stone:Object.keys(MEGA).find(k=>MEGA[k][p.no]===m.no)})),
      sets:SETS,setHTML,live:liveF?gmLiveHTML(p,lk):'',liveF,usage:base||typeof usageGuideHTML!=='function'?'':usageGuideHTML(p,'single',lk)+usageGuideHTML(p,'double',lk),
      mvParts,abl,partners,good,axis:axisHTML,repl,stab:stabTypes,item}}
  if(base)return megaHead+sections;
  const megaHTML=megas.map(m=>monGuide(m,o)).join('');
  return `<div class="gdoc"><span class="atag">ポケモンの解説</span><h2>${esc(p.n)}の特徴</h2>${sum}${megas.length?`<p class="note" style="padding:8px 0 0">下に、${megas.map(m=>esc(m.n)).join('・')}の解説もあります。</p>`:''}</div>
  ${sections}${megaHTML}
  <p class="note" style="color:var(--mute)">この解説は、当サイトのデータ（種族値・タイプ相性・覚える技・特性）から当サイトが組み立てたものです。</p>`;
}
/* 軸のポケモンから6匹を組む：軸と今の味方の弱点を受けられるか・まだ弱点を突けないタイプを突けるか・天気/トリルの組み合わせ */
const AXIS_DATA={};
function axisTeam(p,f){
  const team=[p],seen=new Set([formInfo(p).base]),abOf=q=>q.ab?[q.ab]:(ABD[q.no]||[]).map(a=>a[0]);
  const mdC=new Map(),md=q=>{if(!mdC.has(q.no))mdC.set(q.no,monDef(q));return mdC.get(q.no)};
  const learns=(q,k)=>!!LSD[q.no]&&LSD[q.no][1].some(id=>MD[id]&&MD[id][3]===k);
  while(team.length<6){
    const weakTo=T.map(t=>({t,n:team.filter(m=>md(m).find(x=>x.t===t).m>=2).length})).filter(x=>x.n);
    const hits=new Set();team.forEach(m=>m.t.forEach(a=>T.forEach(d=>{if(mult(a,[d])>=2)hits.add(d)})));
    let best=null;
    for(const q of P){if(seen.has(formInfo(q).base))continue;
      const d=md(q);let v=q.bst/600*1.2;
      weakTo.forEach(({t,n})=>{const m=d.find(x=>x.t===t).m;if(m<1)v+=n*(m===0?1.3:1);else if(m>=2)v-=n*.8});
      v+=T.filter(x=>!hits.has(x)&&q.t.some(a=>mult(a,[x])>=2)).length*.25;
      const qa=abOf(q);
      if(f.wset&&qa.some(k=>WSPD[k]===WSET[f.wset]))v+=2;
      if(f.wspd&&qa.some(k=>WSET[k]===WSPD[f.wspd]))v+=3;
      if(f.slow&&learns(q,'trickroom'))v+=1.5;
      if(!best||v>best.v)best={q,v}}
    if(!best)break;team.push(best.q);seen.add(formInfo(best.q).base);
  }
  return team;
}
