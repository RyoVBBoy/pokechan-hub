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
function monGuide(p,o={}){
  const mon=o.mon||(no=>'#/p/'+no),lk=o.link||(h=>h);
  /* メガシンカの姿は、元のポケモンの覚える技と、メガシンカ後の特性1つで考える */
  const base=p.base?byNo[p.base]:null;
  const ls=LSD[p.no]?LSD[p.no][1]:base&&LSD[base.no]?LSD[base.no][1]:[];
  const rk=i=>p.rank?p.rank[i]:1+P.filter(q=>q.s[i]>p.s[i]).length;
  const stoneK=base?Object.keys(MEGA).find(k=>MEGA[k][base.no]===p.no):null;
  const key=id=>MD[id]&&MD[id][3];
  const have=keys=>ls.filter(id=>keys.includes(key(id))).sort((a,b)=>keys.indexOf(key(a))-keys.indexOf(key(b)));
  const share=f=>{const v=f(p);return P.filter(q=>q.no!==p.no&&f(q)<v).length/Math.max(1,P.length-1)};
  const lvl=x=>x>=.8?'とても高い':x>=.6?'高め':x>=.4?'ふつう':x>=.2?'低め':'とても低い';
  const [h,A,B,C,D,S]=p.s;
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
    attacker:()=>{const item=spdS<.35?(ai===1?'choiceband':'choicespecs'):spdS<.7?'choicescarf':'lifeorb';
      const why=item==='choicescarf'?`素早さが中くらいなので、${ITEMN.choicescarf}で上から攻撃できる相手を増やす。`:item==='lifeorb'?`素早さが高いので、技を固定されない${ITEMN.lifeorb}で火力を上げる。`:`素早さは低いが${atkStat}が高いので、${ITEMN[item]}でさらに火力を上げ、受けに来た相手も押し切る。`;
      return mkSet(`${atkName}アタッカー`,why,pickAb(['power','speed','weaken','absorb']),item,item==='choicescarf'||item==='lifeorb'?5:ai,ai===1?3:1,spOf(ai,5),pickAtk(4))},
    setup:()=>{const s=setup[0],isSh=key(s)==='shellsmash',bd=key(s)==='bellydrum';const item=isSh&&bulkS<.5?'focussash':bd?'sitrusberry':bulkS>=.55?'leftovers':'lifeorb';
      return mkSet('積みアタッカー',`${mName(s)}で能力を上げてから、タイプの違う技で一気に倒していく。${item==='focussash'?'耐久が低いので'+ITEMN.focussash+'で1回は確実に積む。':item==='sitrusberry'?ITEMN.sitrusberry+'でHPを戻しながら戦う。':item==='leftovers'?'耐久もあるので、'+ITEMN.leftovers+'で回復しながら何度も積む。':ITEMN.lifeorb+'で、積んだあとの火力をさらに上げる。'}`,
        pickAb(['power','speed','bulk','stat']),item,spdS>=.4&&!['curse'].includes(key(s))?5:ai,ai===1?3:1,key(s)==='curse'?spOf(0,ai):spOf(ai,5),[s,...pickAtk(3)])},
    bulky:()=>{const at=pickAtk(2),aux=[...heal.slice(0,1),...sup.filter(id=>['willowisp','toxic','stealthrock','thunderwave','yawn','spikes','taunt'].includes(key(id))).slice(0,1),...piv.slice(0,1),...have(['knockoff','protect'])];
      const mv=[...aux.slice(0,2),...at,...aux.slice(2)];
      return mkSet('受けて粘る役（サイクル）',`HPと${lowDef===2?'防御':'特防'}を伸ばし、${heal.length?mName(heal[0])+'で回復しながら':'交代を繰り返しながら'}何度も場に出る。${ITEMN.leftovers}で少しずつ回復する。`,
        pickAb(['pivot','bulk','weaken','absorb','statusab','stat']),'leftovers',lowDef,ai===1?3:1,spOf(0,lowDef),mv)},
    support:()=>{const fast=spdS>=.55;const s=sup.slice(0,3);
      return mkSet('起点作り',`${list(s.map(mName))}で味方が戦いやすい状況を作る。${bulkS<.4?'耐久が低いので'+ITEMN.focussash+'で確実に1回は動く。':ITEMN.sitrusberry+'で長く場に残る。'}`,
        pickAb(['speed','weaken','field','bulk']),bulkS<.4?'focussash':'sitrusberry',fast?5:lowDef,ai===1?3:1,fast?spOf(0,5):spOf(0,lowDef),[...s,...pickAtk(1,[]).slice(0,1),...sup.slice(3)])},
    tr:()=>mkSet('トリックルームのアタッカー',`自分でトリックルームを使い、遅さを活かして先に攻撃する。素早さは下げる性格にして、ポイントは振らない。`,
      pickAb(['weaken','bulk','power']),bulkS>=.5?'sitrusberry':'lifeorb',ai,5,spOf(0,ai),[tr[0],...pickAtk(3)])
  };
  /* ---- 向いている役割 ---- */
  const roles=[];const R=(k,sc,name,text,set)=>roles.push({k,sc,name,text,set});
  if(offS>=.45&&bestStab.length)R('attacker',offS+.3,`${atkName}アタッカー`,`${atkStat}が${p.s[ai]}（収録${P.length}匹中${rk(ai)}位）と${lvl(offS)}。タイプ一致の${list(bestStab.slice(0,2).map(m=>m.n))}が主な攻撃手段になる。`,'attacker');
  if(setup.length&&offS>=.35&&atk.length)R('setup',offS+.42,'積んで勝負を決める役',`${list(setup.slice(0,3).map(mName))}を覚える。相手が交代したときや、壁・まひで作った安全なターンに積むと、そのまま何匹も倒せることがある。`,'setup');
  if(bulkS>=.65&&(heal.length||abK.includes('regenerator')||piv.length))R('bulky',bulkS+.2,'受けて粘る役（サイクル）',`耐久は${lvl(pbS)===lvl(sbS)?'物理・特殊ともに'+lvl(pbS):'物理が'+lvl(pbS)+'・特殊が'+lvl(sbS)}。${heal.length?mName(heal[0])+'で回復でき、':''}${abK.includes('regenerator')?ABN.regenerator+'で引っ込むたびに回復できるので、':''}交代を繰り返す戦い方に向く。`,'bulky');
  if(sup.length>=2)R('support',.4+.08*sup.length,'起点作り',`${list(sup.slice(0,4).map(mName))}など、味方を助ける技が多い。自分は倒れてもよいので、後ろのアタッカーが動きやすい状況を作る。`,'support');
  if(tr.length)R('tr',spdS<.3?.95:.6,'トリックルームを使う役',spdS<.3?'自分も遅いので、トリックルームを張ったあとにそのまま先手で攻撃できる。':'トリックルームを張って、遅い味方を活かす。自分は速いので、張ったあとは交代して味方に任せることが多い。',spdS<.3&&offS>=.4?'tr':null);
  else if(spdS<.25&&offS>=.6)R('slow',.55,'トリックルームで活きるアタッカー',`素早さはとても低いが${atkStat}は高い。味方のトリックルームの中では、先に動いて大きなダメージを与えられる。`,null);
  if(wset)R('wset',1.05,`天気（${GM_WN[WSET[wset]]}）を作る役`,`特性${ABN[wset]}で、場に出るだけで天気が${GM_WN[WSET[wset]]}になる。天気で強くなる味方と組むと、出すたびに天気を作り直せる。`,null);
  if(wspd)R('wspd',.75,`${GM_WN[WSPD[wspd]]}で速くなるアタッカー`,`特性${ABN[wspd]}で、天気が${GM_WN[WSPD[wspd]]}のときは素早さが2倍になる。天気を作る味方と一緒に出したい。`,null);
  if(abK.includes('intimidate'))R('intim',.58,'いかくで相手を弱らせる役',`特性${ABN.intimidate}で、出るたびに相手の攻撃を下げられる。物理アタッカーの多い相手に強く、交代で何度も出すと効果が大きい。`,null);
  if(prio.length&&offS>=.45)R('prio',.5,'先制技でとどめを刺す役',`${list(prio.slice(0,2).map(m=>m.n))}で、速い相手にも先に攻撃できる。削れた相手へのとどめに使う。`,null);
  if(piv.length&&spdS>=.5)R('pivot',.46,'交代しながら削る役',`${list(piv.map(mName))}で、攻撃しながら有利な味方に交代できる。先発で相手を見てから動くのに向く。`,null);
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
  /* 当サイトの利用者の育成が5件以上あれば、それをもとにした型を先頭に置く（43-usage.js） */
  if(!o.raw&&!base&&typeof usageBuildOf==='function')['double','single'].forEach(f=>{usageGet(f);const b=usageBuildOf(p.no,f),u=b&&usageSet(p,b);if(u){u.fmt=f;const i=SETS.findIndex(x=>(x.fmt||'single')===f);SETS.splice(i<0?SETS.length:i,0,u)}});
  SETS.forEach((x,i)=>{x.fmt=x.fmt||'single';x.rec=SETS.findIndex(y=>(y.fmt||'single')===x.fmt)===i});
  /* メガシンカの姿の型は、持ち物をメガストーンにする（持ち物の説明の文は外す） */
  if(stoneK&&!o.raw)SETS.forEach(st=>{st.item=stoneK;st.why=st.why.split('。').filter(x=>x&&!Object.values(ITEMN).some(n=>x.includes(n))).join('。')+(st.why?'。':'')+`持ち物は${ITEMN[stoneK]}（メガシンカする）。`});
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
    `${list(p.t)}タイプ${abImm.length?`に加えて、特性${esc(ABN[abImm[0].k]||abImm[0].k)}で${list(abImm.map(x=>x.t))}技が効かない`:''}ため、${weak.length?`弱点は${weak[0][0]}の1つだけ`:'弱点がない'}。半減以下で受けられるタイプも${res.length}つあるので、相手の攻撃を受けながら、交代で出しやすい。`,3,'def']);
  else if(res.length>=8)pros.push(['受けられるタイプが多い',`半減以下で受けられるタイプが${res.length}つ${imm.length?`（${list(imm.map(x=>x[0]))}は無効）`:''}ある。相手の技を読めば、交代で出してダメージを抑えやすい。`,2,'def']);
  if(spdS>=.75)pros.push(['素早さが高い',`素早さ${S}（最速で${maxSpe(p)}）は、収録${sr.n}匹のうち上から${topPct(spdS)}%ほど。多くの相手より先に攻撃できるので、削れた相手を先に倒しやすい。`,2.5,'off']);
  if(offS>=.75&&bestStab[0])pros.push([`${atkStat}が高い`,`${atkStat}${p.s[ai]}は収録${P.length}匹で${rk(ai)}位。タイプ一致の${esc(bestStab[0].n)}なら、等倍の相手にも大きなダメージを与えられる。`,2.6,'off']);
  if(pbS>=.7&&pbS>=sbS)pros.push(['物理技に強い',`HP${h}・防御${B}で、物理技を受けても倒れにくい。物理アタッカーの多い相手に出しやすい。`,2,'def']);
  else if(sbS>=.7)pros.push(['特殊技に強い',`HP${h}・特防${D}で、特殊技を受けても倒れにくい。特殊アタッカーの多い相手に出しやすい。`,2,'def']);
  if(piv.length)pros.push(['交代しながら攻撃できる',`${esc(list(piv.slice(0,2).map(mName)))}で、攻撃や補助のあとに有利な味方へ交代できる。不利な相手から引きつつ、少しずつ削れる。`,1.8,'def']);
  const weakenMv=have(['willowisp','thunderwave','toxic','yawn','taunt','knockoff','trick']);
  if(weakenMv.length)pros.push(['相手を弱らせる技がある',`${esc(list(weakenMv.slice(0,3).map(mName)))}を覚える。相手の攻撃を下げたり、動きを止めたりして、味方が戦いやすくなる。`,1.6,'def']);
  if(h<=65&&Math.max(B,D)>=95)cons.push(['HPが低め',`${B>=D?'防御':'特防'}${Math.max(B,D)}は高いが、HP${h}が低いので、思ったほどは耐えない。等倍の強い技を続けて受けると倒れやすいので、受けに出すときは半減以下で受けられる相手を選ぶ。`,3,'HPが低く、思ったほどは耐えない']);
  const x4=weak.filter(x=>x[1]>=4);
  if(x4.length)cons.push([`${list(x4.map(x=>x[0]))}が4倍の弱点`,`${list(x4.map(x=>x[0]))}タイプの技は4倍のダメージになり、耐久があっても一撃で倒されやすい。${list(x4.map(x=>x[0]))}技を持つ相手の前には出さないようにする。`,3,`${list(x4.map(x=>x[0]))}技を4倍で受ける`]);
  if(weak.length>=5)cons.push(['弱点が多い',`${list(weak.map(x=>x[0]))}の${weak.length}つが弱点。交代で受けに出せる相手が限られるので、先に攻撃して数を減らす使い方が向く。`,2.5,'弱点が多い']);
  if(spdS<.25)cons.push(['素早さが低い',`最速にしても${maxSpe(p)}で、多くの相手に先に攻撃される。トリックルームを使うか、先に攻撃を受けても耐えられる相手に合わせて出す。`,2,'素早さが低く、先に攻撃されやすい']);
  if(offS<.3)cons.push(['攻撃・特攻が控えめ',`攻撃${A}・特攻${C}と火力は高くないので、ダメージで押すより、補助技や交代で味方を助ける役に向く。`,1.5,'火力は高くない']);
  if(bulkS<.25&&!(h<=65&&Math.max(B,D)>=95))cons.push(['打たれ弱い',`HP${h}・防御${B}・特防${D}と耐久が低く、弱点でなくても強い技で倒されやすい。先に動ける場面や、きあいのタスキで確実に1回動く使い方が向く。`,2,'打たれ弱い']);
  if(!cons.length&&weak.length)cons.push([`${weak[0][0]}技に弱い`,`${list(weak.map(x=>x[0]))}が弱点。${weak[0][0]}技を持つ相手が出てきたら、受けられる味方に交代する。`,1,`${weak[0][0]}技に弱い`]);
  pros.sort((a,b)=>b[2]-a[2]);cons.sort((a,b)=>b[2]-a[2]);
  /* ひとこと：いちばんの強みと、それに合う役割（守りの強みなら受け・交代・補助、攻めの強みならアタッカー・積み） */
  const want=pros[0]&&pros[0][3]==='def'?['bulky','pivot','support','intim','tr','double']:['attacker','setup','prio','slow','wspd','pivot'];
  const role=roles.find(r=>want.includes(r.k))||topRoles[0];
  /* 「向いている役割」も、ひとことで挙げた役割を先頭にする */
  if(role&&topRoles.includes(role)){topRoles.splice(topRoles.indexOf(role),1);topRoles.unshift(role)}else if(role){topRoles.pop();topRoles.unshift(role)}
  const strong=pros[0]?pros[0][0].replace(/が高い$/,'の高さ').replace(/に強い$/,'への強さ').replace(/^弱点が(.+)だけ$/,'弱点が$1だけという耐性').replace(/^弱点がない$/,'弱点のない耐性').replace(/^受けられるタイプが多い$/,'受けられるタイプの多さ').replace(/^交代しながら攻撃できる$/,'交代しながら戦える器用さ').replace(/^相手を弱らせる技がある$/,'相手を弱らせる技'):'';
  const lead=`${esc(p.n)}は、${strong?strong+'を活かして、':''}${role?esc(role.name).replace(/（.*$/,'')+'として活躍しやすいポケモン':'いろいろな役をこなせるポケモン'}。${cons[0]?`ただし、${cons[0][3]}点に注意。`:''}`;
  const item=([t,d])=>`<div class="gpt"><b>${esc(t)}</b><p>${d}</p></div>`;
  const dn=defNotes(p);
  const sum=`<p class="glead">${lead}</p>
    ${pros.length?`<h3>強いところ</h3>${pros.slice(0,3).map(item).join('')}`:''}
    ${cons.length?`<h3>弱いところ</h3>${cons.slice(0,3).map(item).join('')}`:''}
    <h3>数字で見ると</h3><dl class="gnum">
      <dt>タイプ</dt><dd>${list(p.t)}</dd>
      <dt>種族値</dt><dd>${SN.map((n,i)=>`${n}${p.s[i]}`).join('・')}（合計${p.bst}）</dd>
      <dt>素早さ</dt><dd>最速で${maxSpe(p)}（収録${sr.n}匹の中で${sr.rank}位・${spdTxt}）</dd>
      <dt>弱点</dt><dd>${weak.length?list(weak.map(x=>x[0]+(x[1]>=4?'（4倍）':''))):'なし'}</dd>
      <dt>受けられる</dt><dd>半減以下${res.length}タイプ${imm.length?`（${list(imm.map(x=>x[0]))}は無効）`:''}</dd>
      ${dn.length?`<dt>特性</dt><dd>${esc(dn.join('。'))}</dd>`:''}</dl>`;
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
  if(prio.length)mvParts.push(['先制技','素早さに関係なく先に攻撃できる。削れた相手へのとどめに。',prio.slice(0,3).map(m=>m.id)]);
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
      tr:'トリックルームを張り、その中で先に攻撃する役。トリックルームが終わるターンを数えて動く。',
      double:'味方と2匹で同じ相手を狙い、1ターンに1匹ずつ倒していく役。',dsup:'相手の攻撃を自分に集めて、味方を守る役。'}[s.k]||'';
    return base+(pv.length?`不利な相手の前では${esc(mName(pv[0]))}で交代し、有利な味方につなぐ。`:'')+(pr.length?`${esc(mName(pr[0]))}で、削れた相手に先にとどめを刺せる。`:'')+(s.item==='focussash'?'きあいのタスキで1回は確実に動ける。':'')};
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
  const setHTML=(s,i)=>{const nat=natName(s.up,s.dn),st=calcStats(p,s.sp,s.up,s.dn),alt=altOf(s),hard=hardOf(s);
    return `<div class="gset" id="gset-${p.no}-${i}"><b>${esc(s.title)}${s.rec?'<span class="atag">おすすめ</span>':''}</b><p>${esc(s.why)}</p><dl>
      <dt>特性</dt><dd>${s.ab?abA(s.ab):'—'}</dd><dt>持ち物</dt><dd>${itA(s.item)}</dd><dt>性格</dt><dd>${esc(nat||'—')}</dd>
      <dt>能力ポイント</dt><dd>${s.sp.map((v,i)=>v?`${SN[i]}${v}`:'').filter(Boolean).join('・')}</dd></dl>
      <div class="pills gchips" style="padding:6px 0 0">${s.moves.map(mvA).join('')}</div>
      <table class="gstat"><tr>${SN.map(n=>`<th>${n}</th>`).join('')}</tr><tr>${st.map(v=>`<td>${v}</td>`).join('')}</tr><tr class="gsp">${s.sp.map(v=>`<td>${v||'-'}</td>`).join('')}</tr></table>
      <p class="vcap" style="margin:2px 0 0">上の段はレベル50の実数値、下の段は能力ポイント。</p>
      <h4>この型の役割</h4><p>${roleOf(s)}</p>
      ${alt.out.length?`<h4>技の入れ替え候補</h4>${alt.rep?`<p>${esc(mName(alt.rep))}の枠は、パーティに合わせて入れかえられる。</p>`:''}${alt.out.map(([id,w])=>mvCard(id,w)).join('')}`:''}
      ${hard?`<h4>苦手なポケモン</h4><p><b>${esc(hard.head)}</b><br>${esc(hard.why)}</p><div class="ghard">${hard.bad.map(r=>`<a class="row" href="${mon(r.q.no)}"><span class="av">${stamp(r.q)}</span><div class="row-m"><div class="row-t">${nm(r.q)}</div><div class="row-s">こちらの技で最大 ${Math.round(r.my)}%・${r.their>=100?'相手の技で一撃で倒される':'相手の技で最大 '+Math.round(r.their)+'%'}</div></div></a>`).join('')}</div>`:''}
      </div>`};
  /* メガシンカの姿：特徴と「メガシンカで変わるところ」だけを返す（元のポケモンの解説の中に出す） */
  let megaHead='';
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
    <p class="note" style="padding-top:2px;color:var(--mute)">種族値・覚える技・特性から当サイトが計算で組んだ例です。実際によく使われている型とは違うことがあります。</p>`:''}
  ${base||typeof usageGuideHTML!=='function'?'':usageGuideHTML(p,'single',lk)+usageGuideHTML(p,'double',lk)}
  ${mvParts.length?`<div class="sec"><h2>技の選び方</h2></div>${mvParts.map(([t,d,ids])=>`<div class="gdoc gsub"><h3>${t}</h3>${d?`<p>${d}</p>`:''}</div>${ids.length?`<div class="pills gchips">${ids.map(mvA).join('')}</div>`:''}`).join('')}`:''}
  ${abl.length?`<div class="sec"><h2>特性</h2></div><div class="gdoc" style="padding-top:0">${abl.map(([k,hid])=>{const rs=abRoles(k);return `<div class="gtag" style="margin-top:6px"><b>${abA(k)}${hid?'<span class="atag">隠れ特性</span>':''}${rs.length?`<span class="atag">${esc(rs[0][1].replace(/特性$/,''))}</span>`:''}</b><small>${esc(ABDS[k]||'')}</small></div>`}).join('')}</div>`:''}
  ${partners.length?`<div class="sec"><h2>相性のいい味方の例</h2></div><p class="note" style="padding-top:0">${esc(p.n)}の弱点を受けられるか、天気・トリックルームで助け合えるポケモンです（タイプと特性から計算）。</p>
    ${partners.map(({q,why})=>`<a class="row" href="${mon(q.no)}"><span class="av">${stamp(q)}</span><div class="row-m"><div class="row-t">${nm(q)}</div><div class="row-s">${why.slice(0,2).join('。')}</div></div><span class="chev">${SVG(I.chev,18)}</span></a>`).join('')}`:''}
  ${good.length?`<div class="sec"><h2>有利に戦いやすい相手</h2></div><p class="note" style="padding-top:0">こちらのタイプ一致技で弱点を突けて、相手のタイプ一致技では弱点を突かれない相手です（合計種族値の高い順）。</p><div class="pills gchips">${good.map(mA).join('')}</div>`:''}
  ${axisHTML}`;
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
