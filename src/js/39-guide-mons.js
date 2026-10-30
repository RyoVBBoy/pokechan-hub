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
function monGuide(p,o={}){
  const mon=o.mon||(no=>'#/p/'+no),lk=o.link||(h=>h);
  const ls=LSD[p.no]?LSD[p.no][1]:[];
  const key=id=>MD[id]&&MD[id][3];
  const have=keys=>ls.filter(id=>keys.includes(key(id))).sort((a,b)=>keys.indexOf(key(a))-keys.indexOf(key(b)));
  const share=f=>{const v=f(p);return P.filter(q=>q.no!==p.no&&f(q)<v).length/Math.max(1,P.length-1)};
  const lvl=x=>x>=.8?'とても高い':x>=.6?'高め':x>=.4?'ふつう':x>=.2?'低め':'とても低い';
  const [h,A,B,C,D,S]=p.s;
  const side=A>=C+10?0:C>=A+10?1:2,ai=side===1?3:side===0?1:(A>=C?1:3);
  const offS=share(q=>Math.max(q.s[1],q.s[3])),spdS=share(q=>q.s[5]);
  const pbS=share(q=>(q.s[0]+75)*(q.s[2]+20)),sbS=share(q=>(q.s[0]+75)*(q.s[4]+20)),bulkS=Math.max(pbS,sbS);
  const sr=spdRank(maxSpe(p),p.no);
  const tb=defTable(p.t),weak=tb.filter(x=>x[1]>=2).sort((a,b)=>b[1]-a[1]),res=tb.filter(x=>x[1]<1),imm=tb.filter(x=>x[1]===0);
  const abl=ABD[p.no]||[],abK=abl.map(a=>a[0]);
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
  if(offS>=.45&&bestStab.length)R('attacker',offS+.3,`${atkName}アタッカー`,`${atkStat}が${p.s[ai]}（収録${P.length}匹中${p.rank[ai]}位）と${lvl(offS)}。タイプ一致の${list(bestStab.slice(0,2).map(m=>m.n))}が主な攻撃手段になる。`,'attacker');
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
  const SETS=setKeys.map(k=>{try{return sets[k]()}catch(e){return null}}).filter(s=>s&&s.moves.length);
  /* 構築の型（40-guide-builds.js）から、型を組む部品として使う */
  if(o.raw)return{keys:setKeys,make:k=>{try{const r=sets[k]();return r&&r.moves.length?r:null}catch(e){return null}},key,ai,lowDef,best:n=>pickAtk(n)};
  /* ---- まとめ ---- */
  const spdTxt=sr.rank<=sr.n*.25?'速いほう':sr.rank<=sr.n*.6?'中くらい':'遅いほう';
  const megas=megasOf(p.no);
  const sum=`${esc(p.n)}は${list(p.t)}タイプ。いちばん高い能力は${SN[p.mi]}（${p.s[p.mi]}）で、${side===2?'攻撃と特攻のどちらも使える':atkName+'技で攻めるのに向いた'}能力をしている。`
    +`素早さは最速で${maxSpe(p)}、収録${sr.n}匹の中で${sr.rank}位と${spdTxt}。耐久は${lvl(pbS)===lvl(sbS)?'物理・特殊ともに'+lvl(pbS):'物理が'+lvl(pbS)+'・特殊が'+lvl(sbS)}。`
    +(weak.length?`弱点は${list(weak.map(x=>x[0]+(x[1]>=4?'（4倍）':'')))}の${weak.length}つ。`:'弱点がない。')
    +`半減以下で受けられるタイプは${res.length}つ${imm.length?'（'+list(imm.map(x=>x[0]))+'は無効）':''}。`;
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
  const setHTML=s=>{const nat=natName(s.up,s.dn);
    return `<div class="gset"><b>${esc(s.title)}</b><p>${esc(s.why)}</p><dl>
      <dt>特性</dt><dd>${s.ab?abA(s.ab):'—'}</dd><dt>持ち物</dt><dd>${itA(s.item)}</dd><dt>性格</dt><dd>${esc(nat||'—')}</dd>
      <dt>能力ポイント</dt><dd>${s.sp.map((v,i)=>v?`${SN[i]}${v}`:'').filter(Boolean).join('・')}</dd></dl>
      <div class="pills gchips" style="padding:6px 0 0">${s.moves.map(mvA).join('')}</div></div>`};
  return `<div class="gdoc"><span class="atag">ポケモンの解説</span><h2>${esc(p.n)}の特徴</h2><p>${sum}</p>${megaTxt?`<p style="margin-top:8px">${megaTxt}</p>`:''}</div>
  ${topRoles.length?`<div class="sec"><h2>向いている役割</h2></div><div class="gdoc" style="padding-top:0">${topRoles.map(r=>`<div class="adv adv-tip" style="margin:8px 0"><b>${esc(r.name)}</b><p>${r.text.replace(/[<>]/g,'')}</p></div>`).join('')}</div>`:''}
  ${SETS.length?`<div class="sec"><h2>型の例</h2><span style="font-size:12px;color:var(--dim)">データから組んだ例</span></div>${SETS.map(setHTML).join('')}
    <p class="note" style="padding-top:2px;color:var(--mute)">種族値・覚える技・特性から当サイトが計算で組んだ例です。実際によく使われている型とは違うことがあります。</p>`:''}
  ${mvParts.length?`<div class="sec"><h2>技の選び方</h2></div>${mvParts.map(([t,d,ids])=>`<div class="gdoc gsub"><h3>${t}</h3>${d?`<p>${d}</p>`:''}</div>${ids.length?`<div class="pills gchips">${ids.map(mvA).join('')}</div>`:''}`).join('')}`:''}
  ${abl.length?`<div class="sec"><h2>特性</h2></div><div class="gdoc" style="padding-top:0">${abl.map(([k,hid])=>{const rs=abRoles(k);return `<div class="gtag" style="margin-top:6px"><b>${abA(k)}${hid?'<span class="atag">隠れ特性</span>':''}${rs.length?`<span class="atag">${esc(rs[0][1].replace(/特性$/,''))}</span>`:''}</b><small>${esc(ABDS[k]||'')}</small></div>`}).join('')}</div>`:''}
  ${partners.length?`<div class="sec"><h2>相性のいい味方の例</h2></div><p class="note" style="padding-top:0">${esc(p.n)}の弱点を受けられるか、天気・トリックルームで助け合えるポケモンです（タイプと特性から計算）。</p>
    ${partners.map(({q,why})=>`<a class="row" href="${mon(q.no)}"><span class="av">${stamp(q)}</span><div class="row-m"><div class="row-t">${nm(q)}</div><div class="row-s">${why.slice(0,2).join('。')}</div></div><span class="chev">${SVG(I.chev,18)}</span></a>`).join('')}`:''}
  ${good.length?`<div class="sec"><h2>有利に戦いやすい相手</h2></div><p class="note" style="padding-top:0">こちらのタイプ一致技で弱点を突けて、相手のタイプ一致技では弱点を突かれない相手です（合計種族値の高い順）。</p><div class="pills gchips">${good.map(mA).join('')}</div>`:''}
  <p class="note" style="color:var(--mute)">この解説は、当サイトのデータ（種族値・タイプ相性・覚える技・特性）から当サイトが組み立てたものです。</p>`;
}
