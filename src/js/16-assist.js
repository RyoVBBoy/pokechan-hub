/* ===================== 選出アシスト ===================== */
let opp6=(()=>{try{return JSON.parse(localStorage.getItem('pcopp6')||'[]').map(n=>NO_MOVED[n]||n).filter(n=>byNo[n]).slice(0,6)}catch(e){return[]}})();
const saveOpp6=()=>{try{localStorage.setItem('pcopp6',JSON.stringify(opp6))}catch(e){}};
let asMode='atk';
/* 計算用の型：ラダー集計があれば最頻の型、なければ自動で決めた型（乱数なし） */
/* 型の出どころごとに組む（2026/11/20）。持ち物が姿と合わない型（上位パーティの登録などに混ざりうる）は使わず、次の出どころへ。
   どこからも組めなければ set:null（呼ぶ側は計算しない） */
const detSetInfo=p=>{const tries=[['live',()=>LIVE.csv[p.no]?buildSet(p,LIVE.csv[p.no],true):null],['top',()=>(typeof topSetCalc==='function'&&topSetCalc(p))||null],['theory',()=>chooseSet(p,true)]];
  const skip=[];
  for(const [k,f] of tries){const s=f();if(!s)continue;const R=resolveForm(p.no,s.item);
    if(!R.ok){skip.push({k,why:R.why,item:s.item});continue}
    return{set:s,kind:SET_KIND[k],src:k,form:R.form,skip}}
  return{set:null,kind:SET_KIND.theory,src:null,form:null,skip,why:'insufficient-data'}};
const detSet=p=>detSetInfo(p).set;
/* 計算から外した匹の知らせ（持ち物が姿と合わない等） */
const formErrHTML=L=>L&&L.length?`<p class="bnote" role="status">${L.map(x=>`${esc((byNo[x.no]||{}).n||String(x.no))}：${esc(FORM_WHY[x.why]||x.why)}`).join('<br>')}（この${L.length}匹は計算に入れていません）</p>`:'';
/* detSet の型の出どころ（2026/11/20 表示の正直さ）：どれも1人が実際に使った型ではない。
   live＝ランクバトルの集計の項目ごとの割合を組み合わせた推定／top＝上位パーティの登録を項目ごとに数えて組み合わせた推定／theory＝当サイトが計算で組んだ提案 */
const SET_KIND={live:{k:'synthetic',t:'ランクバトルの集計から組み合わせた推定の型',s:'推定の型（集計）'},top:{k:'synthetic',t:'上位パーティの登録から組み合わせた推定の型',s:'推定の型（上位パーティ）'},theory:{k:'theory',t:'当サイトが計算で組んだ型（提案）',s:'当サイトの提案の型'}};
/* 相手が何匹もいる画面の言い方（相手ごとに出どころが違う） */
const SET_MIX='集計があれば集計から組み合わせた推定の型、なければ当サイトの提案の型（どれも1人が実際に使った型ではありません）';
const detSetKind=p=>detSetInfo(p).kind;
/* その姿として計算する型（2026/11/20 RC2）：集計は種族ごとなので、元の姿の型がメガストーンを持つ（＝メガシンカの型の印）ことがある。
   ・元の姿のページ・対象：メガストーンの型は元の姿の型ではないので使わず、当サイトの提案の型（元の姿）で計算する（集計からメガストーンを除いて組み直すかは依頼主の判断 D1 待ち）
   ・メガシンカの姿のページ・対象：元の姿の集計の型がこのメガストーンを持つなら、それをこの姿の推定の型にする（ほかのストーンなら当サイトの提案の型）
   戻り値 {set,kind,form,note,why}。set が null なら計算しない */
const formSet=p=>{
  if(p.mega){const b=byNo[p.base],bi=b?detSetInfo(b):null;
    if(bi&&bi.set&&bi.src!=='theory'&&bi.set.item===p.stone)return{set:{...bi.set,ab:p.ab},kind:bi.kind,form:p,note:`${b.n}の${bi.kind.t}が${ITEMN[p.stone]||p.stone}を持つので、それをこの姿の型として使っています。`};
    const i=detSetInfo(p);return{...i,note:null}}
  const i=detSetInfo(p);if(!i.set)return{...i,note:null};
  if(i.form&&i.form!==p){const t=chooseSet(p,true);
    return{set:t,kind:SET_KIND.theory,form:p,megaSet:i.set,megaForm:i.form,note:`${i.kind.t}は${ITEMN[i.set.item]||i.set.item}を持つ（${i.form.n}の型）ので、${p.n}は当サイトの提案の型で計算しています。`}}
  return{...i,note:null}};
/* 同時に天候特性が発動する1対1。速い側が先に発動するので、遅い側の天気が残る。
   同速なら順番は未確定。詳細に表示し、代表値には攻撃方向に依存しない順を使う。 */
function wxPairOptions(a,b){
  const ka=a&&WSET[a.ab],kb=b&&WSET[b.ab];
  if(!ka||!kb||ka===kb)return (ka||kb)?[ka||kb]:[];
  const sa=effSpd(a,b),sb=effSpd(b,a);
  return sa===sb?[ka,kb].sort():[sa<sb?ka:kb];
}
const AS_WX_NAME={sun:'晴れ',rain:'雨',sand:'砂嵐',snow:'雪'};
const asWeatherLabel=wx=>wx?`${byNo[wx.no].n}の${AS_WX_NAME[wx.k]}`:'味方の天気の引き継ぎなし';
function asWeatherChoices(M,c){
  const weather=new Map();
  for(const i of c){const m=M[i],k=WSET[m.ab];if(k&&!weather.has(k))weather.set(k,{k,no:m.p.base||m.p.no,ab:m.ab})}
  return [...weather.values(),null];
}
/* パーティの天気（2026/11/10 依頼主：晴れのパーティなのに、ようりょくそ の素早さ2倍が1対1の計算に入っていなかった）。
   1対1では2匹のどちらかが天気を変える特性のときだけ天気を入れていたので、パーティの別の匹（ひでり等）が作る天気が入らなかった。
   こちらのパーティに天気を作る匹がいて、その天気で得をする特性（ようりょくそ・すいすい等の素早さ2倍、サンパワー、すなのちから）の匹が
   こちら側で戦うときは、その天気で計算する（相手が天気を変える特性なら、あとから出る相手の天気が優先＝wxPair）。 */
const WX_GAIN={sun:['chlorophyll','solar-power','protosynthesis'],rain:['swift-swim'],sand:['sand-rush','sand-force'],snow:['slush-rush']};
let TWX_K=null,TWX_V=null;
/* 2026/11/24：メガシンカの場合（診断・選出で「この匹だけがメガシンカ」）。undefined＝決めていない（前と同じ：メガストーンの匹はメガ後の特性）、
   null＝だれもメガシンカしない、番号＝その匹だけがメガシンカ（ほかのメガストーンの匹は通常の姿でもとの特性） */
let WX_MEGA,WX_TEAM;
function teamWx(entries=typeof team==='undefined'?[]:team){if(!entries.length)return null;
  const key=JSON.stringify([WX_MEGA===undefined?'u':WX_MEGA,entries.map(x=>[x.no,x.set&&x.set.ab&&x.set.ab.k,x.set&&x.set.it&&x.set.it.k])]);if(key===TWX_K)return TWX_V;
  let v=null;for(const x of entries){const p=byNo[x.no];if(!p)continue;let ab=null;
    let guess=false;
    try{const it0=x.set&&x.set.it&&x.set.it.k,mega=it0&&megaOf(p.no,it0);
      const active=mega&&(WX_MEGA===undefined||WX_MEGA===x.no);
      const saved=x.set&&x.set.ab&&x.set.ab.k;
      const baseSaved=!mega||active||(ABD[p.no]||[]).some(([k])=>k===saved)?saved:null;
      ab=active?mega.ab:baseSaved;
      /* 特性が未登録で、天気を変える特性を持てる匹（ペリッパーのあめふらし等）は、その特性で使うと仮定する */
      if(!ab){const w=(ABD[p.no]||[]).map(z=>z[0]).find(k=>WSET[k]);ab=w||(mega&&!active?(ABD[p.no]||[])[0]?.[0]:mySetFor(x.no).ab);guess=!!w}}catch(e){}
    if(ab&&WSET[ab]){v={k:WSET[ab],no:x.no,by:formInfo(p).base,ab,guess};break}}
  TWX_K=key;TWX_V=v;return v}
const inTeam=m=>typeof team!=='undefined'&&team.some(x=>{const p=byNo[x.no];return p&&(p.no===(m.p.base||m.p.no)||p.no===m.p.no)});
const appliedTeamWx=()=>typeof WX_OFF!=='undefined'&&WX_OFF?null:WX_TEAM===undefined?teamWx():WX_TEAM;
let AS_WX;
function asWithWeather(wx,fn){
  if(wx===undefined)return fn();
  const prev=AS_WX,weather=B.weather;
  AS_WX=wx;B.weather=null;
  try{return fn()}finally{AS_WX=prev;B.weather=weather}
}
function withWx(a,b,fn){if(typeof B==='undefined'||B.weather)return fn();const direct=wxPairOptions(a,b);let k=direct[0],by=null;
  if(!k){const tw=AS_WX===undefined?appliedTeamWx():AS_WX;if(tw&&[a,b].some(m=>m&&m.side==='me'&&(AS_WX!==undefined||inTeam(m))&&(WX_GAIN[tw.k]||[]).includes(m.ab))){k=tw.k;by=tw}}
  if(!k)return fn();B.weather={k,t:5,team:by,tie:direct.length>1?direct:null};try{return fn()}finally{B.weather=null}}
function estHit(a,d){return withWx(a,d,()=>estHit0(a,d))}
function estHit0(a,d){
  let best={pct:0,mv:null,acc:100};
  /* ばけのかわは1回防ぐだけなので、ダメージは「はがれたあと」で見る（1回多くかかる分は duel が数える） */
  const dg=d.disg;d.disg=false;try{
  /* 2026/11/24：1回の使用を bhits（当たりごとの状態・トリプルアクセル・おやこあい）で。回数が変わる技はいつもの回数（mhCount）。
     かんたんな見積もり（乱数92%）なので、診断の「確定」とは別の数（意図して違う数）。使うごとに変われば seq（useSeq） */
  a.moves.forEach(mv=>{if(mv.prot||!moveUsable(mv,{a,d}).ok)return;const b=bhits(a,mv,d,{});
    const acc=accOf(a,mv,d);
    /* 一撃必殺は当たる確率（3割）の分だけ数える（「一撃で倒せる」と言い切らないように） */
    let pct=b.total/d.max*100;if(['guillotine','fissure','sheercold','horndrill'].includes(mkey(mv)))pct=pct*acc/100;
    if(pct*acc>best.pct*best.acc)best={pct,mv,acc,type:hitType(a,mv,d),eff:b.eff,seq:typeof useSeq==='function'?useSeq(a,mv,d):(typeof mbSeq==='function'?mbSeq(a,mv,d):null)}});
  }finally{d.disg=dg}
  return best;
}
function combos(arr,k){const out=[];const rec=(s,c)=>{if(c.length===k){out.push(c.slice());return}for(let i=s;i<arr.length;i++){c.push(arr[i]);rec(i+1,c);c.pop()}};rec(0,[]);return out}
/* 1対1の比較を、各選出のメガシンカと天気の前提ごとに共用する。 */
function asMatchMatrix(M,O,W,wx,getPair){
  const pairs=M.map(m=>O.map(o=>getPair(m,o,wx)));
  const D=pairs.map(row=>row.map(x=>x.dealt)),R=O.map((_,j)=>pairs.map(row=>row[j].taken));
  const speedDiff=pairs.map(row=>row.map(x=>x.speed));
  const fast=speedDiff.map(row=>row.map(d=>d>0));
  const S=pairs.map(row=>row.map(x=>x.duel));
  const wt=W.reduce((a,b)=>a+b,0)||1;
  const offV=(i,j)=>{const d=D[i][j];let v=Math.min(d.pct*d.acc/100,100)/100;if(d.pct>=100&&fast[i][j])v+=.25;return v};
  const defV=M.map((_,i)=>R.reduce((a,row,j)=>a+W[j]*Math.min(row[i].pct*row[i].acc/100,100)/100,0)/wt);
  const duV=idx=>O.reduce((a,_,j)=>a+W[j]*Math.max(...idx.map(i=>S[i][j]))/2,0)/wt;
  const score=idx=>O.reduce((a,_,j)=>a+W[j]*Math.max(...idx.map(i=>offV(i,j))),0)/wt-.6*idx.reduce((a,i)=>a+defV[i],0)/idx.length+.2*duV(idx);
  const leadFor=line=>combos(line,Math.min(LEADN(),line.length)).map(c=>({c,s:score(c)+c.reduce((a,i)=>a+fast[i].reduce((x,f,j)=>x+(f?W[j]:0),0)/wt*.15,0)})).sort((a,b)=>b.s-a.s);
  return{M,O,D,R,S,fast,speedDiff,offV,score,leadFor,wx};
}
function analyze(myNos,opNos,mySF,opSF,W,keepNo,compareMegas=false){
  mySF=mySF||mySetFor;opSF=opSF||(n=>detSet(byNo[n]));
  const sw=B.weather;B.weather=null;
  try{
    const build=(nos,getSet,side)=>nos.map(no=>{
      const p=byNo[no],set=getSet(no)||chooseSet(p,true),mon=mkMon(p,side,set);
      const normal=compareMegas&&!mon.formErr&&mon.p.mega
        ?mkMon(p,side,{...set,evolve:false}):mon;
      return {mon,normal};
    });
    const my=build(myNos,mySF,'me'),op=build(opNos,opSF,'op');
    const bad=[...my.map(({mon},i)=>mon.formErr?{side:'me',no:myNos[i],why:mon.formErr}:null),...op.map(({mon},i)=>mon.formErr?{side:'op',no:opNos[i],why:mon.formErr}:null)].filter(Boolean);
    if(bad.length){
      if(bad.some(e=>e.side==='me'&&e.no===keepNo))return {formErr:bad,none:true};
      const mn=myNos.filter((_,i)=>!my[i].mon.formErr),on=opNos.filter((_,i)=>!op[i].mon.formErr);
      const result=mn.length&&on.length?analyze(mn,on,mySF,opSF,W?W.filter((_,j)=>!op[j].mon.formErr):W,keepNo,compareMegas):null;
      return result?{...result,formErr:bad}:{formErr:bad,none:true};
    }
    if(!my.length||!op.length)return {none:true};
    const axis=myNos.indexOf(keepNo),indices=my.map((_,i)=>i);
    const candidates=combos(indices,Math.min(PICK(),my.length)).filter(c=>axis<0||c.includes(axis));
    const weights=op.map((_,j)=>W?W[j]:1);
    const holders=(members,line)=>line.filter(i=>members[i].mon.p.mega);
    const forms=(members,active)=>members.map(({mon,normal},i)=>i===active?mon:normal);
    const theirMegas=holders(op,op.map((_,i)=>i));
    const opponents=compareMegas?[-1,...theirMegas].map(i=>forms(op,i)):[op.map(x=>x.mon)];
    const ids=new Map([...my,...op].flatMap(x=>[x.mon,x.normal]).map((m,i)=>[m,i]));
    const cache=new Map();
    const getPair=(m,o,wx)=>{
      const key=JSON.stringify([ids.get(m),ids.get(o),wx?.k,wx?.no]);
      if(!cache.has(key))cache.set(key,asWithWeather(wx,()=>({
        dealt:estHit(m,o),taken:estHit(o,m),
        speed:withWx(m,o,()=>effSpd(m,o)-effSpd(o,m)),
        duel:typeof duelS==='function'?duelS(m,o):0
      })));
      return cache.get(key);
    };
    const matrices=new Map();
    const matrix=(c,megaI,oppI,alternate)=>{
      const M=compareMegas?forms(my,megaI):my.map(x=>x.mon);
      const wx=compareMegas?(alternate===undefined?asWeatherChoices(M,c)[0]:alternate):undefined;
      const key=JSON.stringify([megaI,oppI,wx?.no,wx?.k]);
      if(!matrices.has(key))matrices.set(key,asMatchMatrix(M,opponents[oppI],weights,wx,getPair));
      return matrices.get(key);
    };
    const legacy=compareMegas?candidates:candidates.filter(c=>holders(my,c).length<=1);
    const all=(legacy.length?legacy:candidates).map(c=>{
      const megas=compareMegas?[...holders(my,c),-1]:[-1];
      const variants=megas.map(megaI=>{
        // 相手のメガが未確認なら、通常の姿とメガ1匹ずつを比べ、最も厳しい条件を採用する。
        const worst=opponents.map((_,i)=>{const match=matrix(c,megaI,i);return {match,s:match.score(c),oppI:i}})
          .reduce((a,b)=>b.s<a.s?b:a);
        return {megaI,...worst};
      }).sort((a,b)=>b.s-a.s);
      const {megaI,s,match,oppI}=variants[0];
      return {c,s,megaI,match,oppI,megaOptions:variants.map(v=>({megaI:v.megaI,s:v.s}))};
    }).sort((a,b)=>b.s-a.s);
    const best=all[0].c,match=all[0].match;
    const leadFor=line=>all.find(x=>x.c===line)?.match.leadFor(line)||match.leadFor(line);
    const leads=leadFor(best),lead=leads[0].c,back=best.filter(i=>!lead.includes(i));
    const {megaI,oppI}=all[0];
    const weatherCases=compareMegas?asWeatherChoices(match.M,best).map(wx=>{
      const v=matrix(best,megaI,oppI,wx);
      return {wx,score:v.score(best),lead:v.leadFor(best)[0].c,speedDiff:v.speedDiff};
    }):[];
    const weatherTies=compareMegas?best.flatMap(i=>match.O.flatMap(o=>{
      const cases=wxPairOptions(match.M[i],o);
      return cases.length===2?[{own:match.M[i].p.n,opp:o.p.n,cases}]:[];
    })):[];
    return{...match,myNos,opNos,megaI,leadFor,all:all.slice(0,3),full:all,best,lead,back,leads,weatherCases,weatherTies};
  }finally{B.weather=sw}
}
const asMegaLabel=(M,i)=>i>=0?`${M[i].p.n}にメガシンカ`:'メガシンカなし';
function asWeatherHTML(A){
  const cases=A.weatherCases||[],ties=A.weatherTies||[];
  if(cases.length<2&&!ties.length)return '';
  const rows=cases.map(x=>`<li>${esc(asWeatherLabel(x.wx))}（評価 ${x.score.toFixed(3)}／先発 ${x.lead.map(i=>esc(A.M[i].p.n)).join('・')}）</li>`).join('');
  const tied=ties.map(x=>`${esc(x.own)}と${esc(x.opp)}は同速。発動順で${x.cases.map(k=>AS_WX_NAME[k]).join('・')}が変わります。表では${AS_WX_NAME[x.cases[0]]}の場合を表示しています。`).join('<br>');
  return `<details class="sel-all"><summary>天気の前提と比較</summary>
    ${cases.length>1?`<p class="note">おすすめは「${esc(asWeatherLabel(A.wx))}」を前提に評価しました。同じ選出・同じ相手で、味方の天気だけを変えた場合です。対面するポケモンの天候特性は別に反映します。</p><ul>${rows}</ul>`:''}
    ${tied?`<p class="note">${tied}</p>`:''}</details>`;
}
function asAnalyze(myNos,opNos,weights){
  const A=analyze(myNos,opNos,null,null,weights,team.find(x=>x.axis)?.no,true);
  return A?.none||A?.best?.length!==PICK()?{...A,none:true}:A;
}
function asSpeedSummary(A,j){
  const faster=A.best.filter(i=>A.speedDiff[i][j]<0).length;
  const tied=A.best.filter(i=>A.speedDiff[i][j]===0).length;
  return [faster?`相手の方が速い ${faster}匹`:'',tied?`同速 ${tied}匹`:''].filter(Boolean).join('・')||'選出の全員が相手より速い';
}
function asThreats(A){
  return A.O.map((o,j)=>{
    const hits=A.best.map(i=>({i,r:A.R[j][i]})).filter(x=>x.r.mv).sort((a,b)=>b.r.pct-a.r.pct);
    const severe=hits.filter(x=>x.r.pct>=70).length;
    return {o,j,hits,severe,sum:hits.reduce((n,x)=>n+Math.min(x.r.pct,150),0)};
  }).filter(t=>t.hits.length).sort((a,b)=>b.severe-a.severe||b.sum-a.sum||a.j-b.j);
}
const shortN=n=>n.length>5?n.slice(0,4)+'…':n;
function asReason(A,i){
  const hits=A.O.map((o,j)=>({o,j,d:A.D[i][j]})).filter(x=>x.d.pct>=50&&x.d.pct>=Math.max(...A.best.map(k=>A.D[k][x.j].pct))-1).sort((a,b)=>b.d.pct-a.d.pct);
  const o=[];
  if(hits.length)o.push(hits.slice(0,3).map(x=>`${x.o.p.n}に${x.d.mv?.n||'攻撃'}で約${Math.round(x.d.pct)}%`).join('／'));
  const f=A.fast[i].filter(Boolean).length;
  if(f>=Math.ceil(A.O.length*.6))o.push(`相手${A.O.length}匹中${f}匹より速い`);
  const w=A.O.filter((_,j)=>A.R[j][i].pct>=100).length;
  if(w)o.push(`<span style="color:var(--w2)">${w}匹から一撃で倒されるおそれ</span>`);
  return o.join('。')||'この相手候補では、火力・素早さの目立つ利点を確認できませんでした';
}

/* ---- 相手の予想 ----
   相手から見た最適な選出を計算し、点数の近い選出ほど選ばれやすいとして、各ポケモンの「選出されやすさ」を出す。
   相手はこちらの育成を知らないので、こちらの型は「使用率の高い型」と仮定する。 */
const MVEN={"karatechop":2,"doubleslap":3,"cometpunch":4,"megapunch":5,"payday":6,"scratch":10,"vicegrip":11,"guillotine":12,"razorwind":13,"swordsdance":14,"cut":15,"gust":16,"wingattack":17,"whirlwind":18,"fly":19,"slam":21,"vinewhip":22,"stomp":23,"doublekick":24,"jumpkick":26,"rollingkick":27,"sandattack":28,"headbutt":29,"hornattack":30,"furyattack":31,"horndrill":32,"tackle":33,"takedown":36,"thrash":37,"tailwhip":39,"poisonsting":40,"twineedle":41,"leer":43,"growl":45,"roar":46,"sing":47,"supersonic":48,"sonicboom":49,"disable":50,"acid":51,"ember":52,"mist":54,"watergun":55,"psybeam":60,"bubblebeam":61,"aurorabeam":62,"hyperbeam":63,"peck":64,"submission":66,"lowkick":67,"counter":68,"seismictoss":69,"strength":70,"absorb":71,"megadrain":72,"leechseed":73,"growth":74,"razorleaf":75,"solarbeam":76,"poisonpowder":77,"stunspore":78,"sleeppowder":79,"petaldance":80,"stringshot":81,"dragonrage":82,"thundershock":84,"thunderwave":86,"rockthrow":88,"fissure":90,"dig":91,"toxic":92,"confusion":93,"hypnosis":95,"meditate":96,"agility":97,"rage":99,"teleport":100,"nightshade":101,"mimic":102,"screech":103,"doubleteam":104,"recover":105,"harden":106,"minimize":107,"smokescreen":108,"confuseray":109,"withdraw":110,"defensecurl":111,"barrier":112,"lightscreen":113,"haze":114,"reflect":115,"focusenergy":116,"bide":117,"metronome":118,"mirrormove":119,"selfdestruct":120,"eggbomb":121,"lick":122,"smog":123,"sludge":124,"boneclub":125,"clamp":128,"swift":129,"skullbash":130,"spikecannon":131,"constrict":132,"amnesia":133,"kinesis":134,"softboiled":135,"glare":137,"dreameater":138,"poisongas":139,"barrage":140,"lovelykiss":142,"skyattack":143,"transform":144,"bubble":145,"dizzypunch":146,"spore":147,"flash":148,"psywave":149,"splash":150,"acidarmor":151,"explosion":153,"furyswipes":154,"bonemerang":155,"rest":156,"hyperfang":158,"sharpen":159,"conversion":160,"superfang":162,"slash":163,"substitute":164,"struggle":165,"sketch":166,"triplekick":167,"thief":168,"spiderweb":169,"mindreader":170,"nightmare":171,"flamewheel":172,"snore":173,"curse":174,"flail":175,"conversion2":176,"aeroblast":177,"cottonspore":178,"reversal":179,"spite":180,"powdersnow":181,"scaryface":184,"feintattack":185,"sweetkiss":186,"bellydrum":187,"octazooka":190,"spikes":191,"foresight":193,"destinybond":194,"perishsong":195,"detect":197,"lockon":199,"outrage":200,"sandstorm":201,"endure":203,"charm":204,"rollout":205,"falseswipe":206,"swagger":207,"milkdrink":208,"spark":209,"furycutter":210,"meanlook":212,"attract":213,"sleeptalk":214,"healbell":215,"return":216,"present":217,"frustration":218,"safeguard":219,"painsplit":220,"sacredfire":221,"magnitude":222,"dragonbreath":225,"batonpass":226,"encore":227,"pursuit":228,"sweetscent":230,"metalclaw":232,"vitalthrow":233,"morningsun":234,"synthesis":235,"moonlight":236,"hiddenpower":237,"twister":239,"raindance":240,"sunnyday":241,"mirrorcoat":243,"psychup":244,"futuresight":248,"rocksmash":249,"beatup":251,"fakeout":252,"uproar":253,"stockpile":254,"spitup":255,"swallow":256,"hail":258,"torment":259,"flatter":260,"willowisp":261,"memento":262,"focuspunch":264,"smellingsalts":265,"followme":266,"naturepower":267,"charge":268,"taunt":269,"helpinghand":270,"trick":271,"roleplay":272,"wish":273,"assist":274,"ingrain":275,"magiccoat":277,"recycle":278,"revenge":279,"yawn":281,"endeavor":283,"skillswap":285,"imprison":286,"refresh":287,"grudge":288,"snatch":289,"secretpower":290,"dive":291,"armthrust":292,"camouflage":293,"tailglow":294,"lusterpurge":295,"mistball":296,"featherdance":297,"teeterdance":298,"mudsport":300,"iceball":301,"needlearm":302,"slackoff":303,"blastburn":307,"hydrocannon":308,"astonish":310,"weatherball":311,"aromatherapy":312,"faketears":313,"odorsleuth":316,"silverwind":318,"metalsound":319,"grasswhistle":320,"tickle":321,"cosmicpower":322,"signalbeam":324,"skyuppercut":327,"sheercold":329,"irondefense":334,"block":335,"howl":336,"frenzyplant":338,"bulkup":339,"bounce":340,"poisontail":342,"covet":343,"magicalleaf":345,"watersport":346,"calmmind":347,"dragondance":349,"shockwave":351,"doomdesire":353,"psychoboost":354,"roost":355,"gravity":356,"miracleeye":357,"wakeupslap":358,"gyroball":360,"healingwish":361,"brine":362,"naturalgift":363,"tailwind":366,"acupressure":367,"metalburst":368,"payback":371,"assurance":372,"embargo":373,"fling":374,"psychoshift":375,"trumpcard":376,"healblock":377,"wringout":378,"powertrick":379,"gastroacid":380,"luckychant":381,"mefirst":382,"copycat":383,"powerswap":384,"guardswap":385,"punishment":386,"lastresort":387,"worryseed":388,"suckerpunch":389,"toxicspikes":390,"heartswap":391,"aquaring":392,"magnetrise":393,"forcepalm":395,"rockpolish":397,"switcheroo":415,"gigaimpact":416,"nastyplot":417,"avalanche":419,"mudbomb":426,"mirrorshot":429,"rockclimb":431,"defog":432,"trickroom":433,"rockwrecker":439,"magnetbomb":443,"captivate":445,"stealthrock":446,"grassknot":447,"chatter":448,"judgment":449,"attackorder":454,"defendorder":455,"healorder":456,"roaroftime":459,"spacialrend":460,"lunardance":461,"crushgrip":462,"magmastorm":463,"darkvoid":464,"seedflare":465,"ominouswind":466,"shadowforce":467,"honeclaws":468,"wideguard":469,"guardsplit":470,"powersplit":471,"wonderroom":472,"venoshock":474,"autotomize":475,"ragepowder":476,"telekinesis":477,"magicroom":478,"flameburst":481,"quiverdance":483,"heavyslam":484,"synchronoise":485,"electroball":486,"soak":487,"coil":489,"simplebeam":493,"entrainment":494,"afteryou":495,"round":496,"echoedvoice":497,"chipaway":498,"storedpower":500,"quickguard":501,"allyswitch":502,"shellsmash":504,"healpulse":505,"hex":506,"skydrop":507,"shiftgear":508,"incinerate":510,"quash":511,"acrobatics":512,"reflecttype":513,"retaliate":514,"finalgambit":515,"bestow":516,"waterpledge":518,"firepledge":519,"grasspledge":520,"workup":526,"dualchop":530,"heartstamp":531,"heatcrash":535,"leaftornado":536,"steamroller":537,"cottonguard":538,"psystrike":540,"headcharge":543,"geargrind":544,"searingshot":545,"technoblast":546,"relicsong":547,"secretsword":548,"glaciate":549,"boltstrike":550,"blueflare":551,"freezeshock":553,"iceburn":554,"vcreate":557,"fusionflare":558,"fusionbolt":559,"matblock":561,"belch":562,"rototiller":563,"stickyweb":564,"phantomforce":566,"trickortreat":567,"nobleroar":568,"iondeluge":569,"forestscurse":571,"disarmingvoice":574,"partingshot":575,"topsyturvy":576,"craftyshield":578,"flowershield":579,"grassyterrain":580,"mistyterrain":581,"electrify":582,"fairywind":584,"fairylock":587,"kingsshield":588,"playnice":589,"confide":590,"diamondstorm":591,"steameruption":592,"hyperspacehole":593,"spikyshield":596,"aromaticmist":597,"eerieimpulse":598,"venomdrench":599,"powder":600,"geomancy":601,"magneticflux":602,"happyhour":603,"electricterrain":604,"celebrate":606,"holdhands":607,"babydolleyes":608,"holdback":610,"poweruppunch":612,"oblivionwing":613,"thousandarrows":614,"thousandwaves":615,"landswrath":616,"lightofruin":617,"originpulse":618,"precipiceblades":619,"dragonascent":620,"hyperspacefury":621,"zippyzap":729,"splishysplash":730,"floatyfall":731,"pikapapow":732,"bouncybubble":733,"buzzybuzz":734,"sizzlyslide":735,"glitzyglow":736,"baddybad":737,"sappyseed":738,"freezyfrost":739,"sparklyswirl":740,"veeveevolley":741,"doubleironbash":742,"clangoroussoul":775,"decorate":777,"drumbeating":778,"snaptrap":779,"pyroball":780,"behemothblade":781,"behemothbash":782,"branchpoke":785,"overdrive":786,"strangesteam":790,"lifedew":791,"obstruct":792,"falsesurrender":793,"meteorassault":794,"eternabeam":795,"steelbeam":796,"expandingforce":797,"steelroller":798,"meteorbeam":800,"shellsidearm":801,"mistyexplosion":802,"terrainpulse":805,"burningjealousy":807,"poltergeist":809,"corrosivegas":810,"coaching":811,"junglehealing":816,"wickedblow":817,"surgingstrikes":818,"thundercage":819,"dragonenergy":820,"freezingglare":821,"fierywrath":822,"thunderouskick":823,"glaciallance":824,"astralbarrage":825,"eeriespell":826,"powershift":829,"springtidestorm":831,"mysticalpower":832,"chloroblast":835,"mountaingale":836,"victorydance":837,"esperwing":840,"bittermalice":841,"shelter":842,"triplearrows":843,"infernalparade":844,"ceaselessedge":845,"bleakwindstorm":846,"wildboltstorm":847,"sandsearstorm":848,"lunarblessing":849,"takeheart":850,"terablast":851,"silktrap":852,"axekick":853,"lastrespects":854,"orderup":856,"spicyextract":858,"spinout":859,"icespinner":861,"glaiverush":862,"revivalblessing":863,"tripledive":865,"doodle":867,"filletaway":868,"psyblade":875,"hydrosteam":876,"ruination":877,"collisioncourse":878,"electrodrift":879,"shedtail":880,"chillyreception":881,"tidyup":882,"snowscape":883,"hyperdrill":887,"ragefist":889,"doubleshock":892,"comeuppance":894,"blazingtorque":896,"wickedtorque":897,"noxioustorque":898,"combattorque":899,"magicaltorque":900,"bloodmoon":901,"ivycudgel":904,"electroshot":905,"terastarstorm":906,"burningbulwark":908,"thunderclap":909,"mightycleave":910,"tachyoncutter":911,"hardpress":912,"dragoncheer":913,"temperflare":915,"supercellslam":916,"upperhand":918,"malignantchain":919};
let MVJR=null;
const mvNameEn=n=>{const k=nrm(n),id=MVK[k];if(id===0)return'まもる';if(id&&MV[id])return MV[id][0];
  const id2=MVEN[k];if(id2){MVJR=MVJR||Object.fromEntries(Object.entries(MVJ).map(([a,b])=>[b,a]));if(MVJR[id2])return MVJR[id2]}return n};
const itNameEn=n=>{const k=nrm(n);return itemJa(k)||ITEMN[k]||n};
const abNameEn=n=>{const k=ABK[nrm(n)];return k&&ABN[k]||n};
const natNameEn=(u,d)=>{const f=x=>STI[nrm(x).replace(/^spatk$/,'sp.atk').replace(/^spdef$/,'sp.def')]??-1;const r=natName(f(u),f(d));return r?r.replace(/（.*$/,''):'補正なし'};
/* 相手の6匹の役のめやす：メガシンカできる（メガ枠）・場を作る技を2つ以上覚える（起点作り）・合計種族値525以上で攻撃か特攻120以上（高数値アタッカー） */
function oppRoleTags(opNos){
  const SUPK=typeof GM_SUP!=='undefined'?GM_SUP:[];
  return opNos.map(n=>{const p=byNo[n],ls=LSD[n]?LSD[n][1]:[];
    return{mega:typeof megasOf==='function'&&megasOf(n).length>0,setup:ls.filter(id=>MD[id]&&SUPK.includes(MD[id][3])).length>=2,ace:p.bst>=525&&Math.max(p.s[1],p.s[3])>=120}});
}
function oppPredict(myNos,opNos){
  if(opNos.length<=PICK())return{w:opNos.map(()=>1),top:[{c:opNos.map((_,j)=>j),p:1}],lead:null,P:null};
  const P=analyze(opNos,myNos,n=>detSet(byNo[n]),n=>detSet(byNo[n]),null,null,true);
  /* 上位構築での採用傾向と、起点作り・アタッカーの組み合わせを少し重く見る。 */
  if(!P?.full?.length)return{w:opNos.map(()=>1),top:[],lead:null,P};
  const rk=oppRoleTags(opNos);
  const adj=c=>{const su=c.some(j=>rk[j].setup),at=c.some(j=>rk[j].ace);return(su&&at?.03:su||at?.01:0)+(typeof topFreq==='function'?.03*c.reduce((s,j)=>s+topFreq(opNos[j]),0):0)};
  const original=i=>opNos.indexOf(P.myNos[i]);
  const full=P.full.map(x=>{const c=x.c.map(original);return{c,local:x.c,s:x.s+adj(c)}}).sort((a,b)=>b.s-a.s);
  const mx=full[0].s,ex=full.map(x=>Math.exp((x.s-mx)/.06)),tot=ex.reduce((a,b)=>a+b,0);
  const pr=full.map((x,i)=>({c:x.c,p:ex[i]/tot}));
  const w=opNos.map((_,j)=>pr.reduce((a,x)=>a+(x.c.includes(j)?x.p:0),0));
  return{w,top:pr.slice(0,3),lead:P.leadFor(full[0].local)[0].c.map(original),P};
}
function oppSetHTML(no){
  const d=LIVE.csv[no];
  if(!d)return `<div class="row-s" style="color:var(--mute)">集計データなし（自動で決めた型で計算）</div>`;
  const pc=x=>`<span style="color:var(--mute)">${Math.round(x)}%</span>`;
  const it=d.it.slice(0,2).map(([n,v])=>`${itNameEn(n)} ${pc(v)}`).join('・');
  const ab=d.ab.slice(0,1).map(([n,v])=>`${abNameEn(n)} ${pc(v)}`).join('');
  const mv=d.mv.slice(0,4).map(([n,v])=>`${mvNameEn(n)} ${pc(v)}`).join('・');
  const sp=d.sp[0],nt=d.nat[0];
  return `<div class="row-s">${[it,ab].filter(Boolean).join('　')}</div><div class="row-s">${mv}</div>${sp?`<div class="row-s" style="color:var(--mute)">${spLine(sp[0])}${nt?`（${natNameEn(nt[0],nt[1])}）`:''} ${Math.round(sp[1])}%</div>`:''}`;
}
function asDataLine(nos){
  const n=nos.filter(x=>LIVE.csv[x]).length;
  if(LIVE.st==='ready')return `型の想定：ラダー集計の最も多い型（${n}/${nos.length}匹分取得）。足りない分は自動で決めた型です。`;
  if(LIVE.st==='fail')return '型の想定：ラダー集計を取得できなかったため、自動で決めた型で計算しています。';
  return '型の想定：ラダー集計を取得しています…';
}
let asTok=0;
async function asFetch(){
  const tok=++asTok;
  if(!(await liveInit()))return asDraw();
  const need=[...team.map(x=>x.no),...opp6].filter(n=>LIVE.csv[n]===undefined);
  if(!need.length)return;
  await Promise.all(need.map(liveMon));
  if(tok===asTok&&keyOf(cur)==='assist')asDraw();
}
function asDraw(){
  const el=document.getElementById('as-res');if(!el)return;
  const cnt=document.getElementById('as-cnt');if(cnt)cnt.textContent=`${opp6.length}/6`;
  document.getElementById('as-opp').innerHTML=opp6.length?`<div class="aopp">${opp6.map(n=>`<span class="aop"><button class="aopi" data-info="${n}" aria-label="${byNo[n].n}の相性"><span class="av">${stamp(byNo[n])}</span><b>${byNo[n].n}</b></button><button class="aox" data-rm="${n}" aria-label="${byNo[n].n}を外す">${SVG(I.x,16)}</button></span>`).join('')}</div><div style="padding:6px 16px 0;text-align:right"><button class="bback" id="as-clear" style="padding:0">すべて外す</button></div>`:'';
  {const w=document.getElementById('as-pipw');if(w)w.hidden=!opp6.length}
  {const bx=document.getElementById('pip-box');if(bx&&PIP.vid&&!bx.contains(PIP.vid))bx.appendChild(PIP.vid)}
  pipUI();if(opp6.length)pipSchedule();
  if(team.length<4){el.innerHTML=`<div class="bnote" style="margin-top:20px"><b>先にあなたのパーティを登録してください</b><br>選出を考えるには、4〜6匹の登録が必要です（いま${team.length}匹）。</div><div class="btns"><a class="btn btn-p" href="#/team">パーティを登録する</a></div>`;return}
  if(!opp6.length){el.innerHTML=`<p class="empty" style="padding:36px 24px">対戦前の画面に出る<b>相手の6匹</b>を、上の欄から入れてください。<br>1匹入れるごとに結果が更新されます。</p>`;return}
  const myNos=team.map(x=>x.no),PR=oppPredict(myNos,opp6),A=asAnalyze(myNos,opp6,PR.w);
  if(A.none){el.innerHTML=`${A.formErr?.length?formErrHTML(A.formErr):''}<p class="note" role="status">選出に必要な${PICK()}匹を評価できません。軸と育成を確認してください。</p>`;return}
  /* 操作の回数（2026/11/12）：相手6匹がそろって計算できたとき。同じパーティ・同じ相手は1回 */
  if(opp6.length>=6&&typeof evCount==='function')evCount('assist_done',JSON.stringify([myNos,[...opp6].sort((a,b)=>a-b),FMT]));
  const pNos=(PR.top[0]?.c||[]).map(j=>opp6[j]);
  const scenario=opp6.length>PICK()&&pNos.length?asAnalyze(myNos,pNos):null;
  const A2=scenario&&!scenario.none?scenario:null;
  const selectionKey=a=>JSON.stringify([a.best.map(i=>a.myNos[i]).sort(),a.lead.map(i=>a.myNos[i]).sort(),a.myNos[a.megaI]]);
  const same=A2&&selectionKey(A2)===selectionKey(A);
  const pct=v=>Math.round(v*100);
  const predRows=opp6.map((n,j)=>({n,j,w:PR.w[j]})).sort((a,b)=>b.w-a.w).map(x=>{const p=byNo[x.n],lead=PR.lead&&PR.lead.includes(x.j);
    return `<div class="row" style="align-items:flex-start;content-visibility:visible"><span class="av">${stamp(p)}</span><div class="row-m"><div class="row-t">${nm(p)}${lead?'<span class="atag on">先発予想</span>':''}</div>${oppSetHTML(x.n)}</div><div class="row-n"><b style="color:${x.w>=.7?'var(--w2)':x.w>=.4?'var(--fg)':'var(--mute)'}">${PR.top.length&&opp6.length>PICK()?pct(x.w)+'%':'—'}</b><span>選出予想</span></div></div>`}).join('');
  const feHTML=A&&A.formErr?formErrHTML(A.formErr):'';
  const predictionPending=opp6.length>PICK()?'相手の選出を予想できるデータが足りません。':`相手を${PICK()+1}匹以上入れると、相手が出してきそうな${PICK()}匹を予想します。`;
  const predHTML=feHTML+`<div class="sec"><h2>相手の予想</h2><span style="font-size:13px;color:var(--dim)">推定の型と選出</span></div>
  ${opp6.length>PICK()&&PR.top.length?`<p class="note" style="padding-top:0">相手から見て有利な${PICK()}匹を計算した<b>予想</b>です。いちばん可能性が高いのは <b>${pNos.map(n=>byNo[n].n).join('・')}</b>${PR.top[1]&&PR.top[1].p>PR.top[0].p*.6?'ですが、ほかの組み合わせとの差は小さく、<b>読みにくい相手</b>です':''}。</p>`:`<p class="note" style="padding-top:0">${predictionPending}</p>`}
  ${predRows}
  ${A2&&!same?`<div class="bnote" style="margin:10px 16px 0"><b>予想どおり ${pNos.map(n=>byNo[n].n.slice(0,4)).join('・')} で来た場合</b>のおすすめは<br><b>${A2.lead.map(i=>A2.M[i].p.n).join('・')}</b>（先発）＋ ${A2.back.map(i=>A2.M[i].p.n).join('・')} です（${asMegaLabel(A2.M,A2.megaI)}）。上のおすすめは、読みが外れた場合も考えた選出です。</div>`:''}
  <p class="note" style="color:var(--mute)">相手はあなたの育成を知らないため、予想では「あなたのポケモンも推定の型（集計から組み合わせた型、なければ当サイトの提案の型）」として計算しています。％は計算上の目安で、実際の選出率ではありません。</p>`;
  const covered=A.O.filter((_,j)=>A.best.some(i=>A.D[i][j].pct>=50)).length;
  const mrow=(i,tag)=>{const m=A.M[i];return `<a class="row" href="#/p/${m.p.base||m.p.no}"><span class="av">${stamp(m.p)}</span><div class="row-m"><div class="row-t">${m.p.n}<span class="atag ${tag==='先発'?'on':''}">${tag}</span></div><div class="row-s">${asReason(A,i)}</div></div></a>`};
  const thr=asThreats(A).slice(0,3).map(t=>{
    const top=t.hits[0];
    const damage=`${A.M[top.i].p.n}に${top.r.mv.n}で約${Math.round(top.r.pct)}%`;
    return `<div class="row"><span class="av">${stamp(t.o.p)}</span><div class="row-m"><div class="row-t">${t.o.p.n}</div><div class="row-s">${t.severe?`選出の${t.severe}匹に推定70%以上`:'比較した技では推定70%以上の相手なし'}（${damage}）。${asSpeedSummary(A,t.j)}</div></div><button class="binfo" style="position:static;flex:none" data-info="${(t.o.p.base||t.o.p.no)}">相性</button></div>`;
  }).join('');
  const cell=(d,mode)=>{const p=Math.round(d.pct);const c=mode==='atk'?(p>=100?'g3':p>=50?'g2':p>=25?'g1':''):(p>=100?'r3':p>=50?'r2':p>=25?'r1':'');return `<td class="${c}">${p>=100?'100+':p}</td>`};
  const hm=`<table class="hm"><tr><th></th>${A.O.map(o=>`<th title="${o.p.n}"><span class="av">${stamp(o.p)}</span>${o.p.n.slice(0,3)}</th>`).join('')}</tr>${A.M.map((m,i)=>`<tr class="${A.best.includes(i)?'on':''}"><th>${shortN(m.p.n)}</th>${A.O.map((o,j)=>cell(asMode==='atk'?A.D[i][j]:A.R[j][i],asMode)).join('')}</tr>`).join('')}</table>`;
  const alt=A.all.slice(1).map(x=>`<div class="row"><div class="row-m"><div class="row-t" style="font-size:14px">${x.c.map(i=>x.match.M[i].p.n).join('・')}</div><div class="row-s"> ${asMegaLabel(x.match.M,x.megaI)}・評価 ${Math.round(x.s*100)}（おすすめは ${Math.round(A.all[0].s*100)}）</div></div></div>`).join('');
  el.innerHTML=`<div class="sec"><h2>おすすめ選出</h2><span style="font-size:13px;color:var(--dim)">${FMTN()}・先発${LEADN()}匹＋控え${PICK()-LEADN()}匹</span></div>
  ${FMT==='double'?`<p class="note" role="status">${DG_DOUBLE_SCOPE}${DG_DOUBLE_LIMITS}</p>`:''}
  <p class="note">${asMegaLabel(A.M,A.megaI)}を前提にした評価です。相手は推定の型で、通常の姿と、推定の型にメガ石がある場合はメガシンカも比較し、より厳しい条件で採点しています。</p>
  ${A.lead.map(i=>mrow(i,'先発')).join('')}${A.back.map(i=>mrow(i,'控え')).join('')}
  ${asWeatherHTML(A)}
  <p class="note">この${A.best.length}匹で、相手${A.O.length}匹のうち<b>${covered}匹</b>に推定50%以上のダメージを与えられます。${opp6.length>PICK()?'相手が<b>出してきそうなポケモンほど重く見て</b>選んでいます。':''}</p>
  ${typeof threeStepHTML==='function'?threeStepHTML(myNos,PR):''}
  ${asAdviceHTML(A,{...PR,w:A.opNos.map(no=>PR.w[opp6.indexOf(no)])})}
  ${predHTML}
  <div class="sec"><h2>警戒する相手</h2></div>${thr||'<p class="note">この型の攻撃技からは、受けるダメージを確認できませんでした。</p>'}
  <div class="sec"><h2>ダメージの目安</h2></div>
  <div class="pills" style="padding-top:0"><button class="pill" data-hm="atk" aria-pressed="${asMode==='atk'}">与えるダメージ</button><button class="pill" data-hm="def" aria-pressed="${asMode==='def'}">受けるダメージ</button></div>
  <p class="note" style="padding-top:4px">${asMode==='atk'?'上のメガシンカを前提とした目安です。縦があなた、横が相手。あなたの一番強い技で、相手のHPを何%削れるかの目安です。':'上のメガシンカを前提とした目安です。縦があなた、横が相手。相手の一番強い技で、あなたのHPを何%削られるかの目安です。'}色の濃い行がおすすめ選出です。</p>
  <div style="overflow-x:auto;padding:0 16px">${hm}</div>
  ${alt?`<div class="sec"><h2>ほかの候補</h2></div>${alt}`:''}
  ${srcLine('ladder','calc')}<p class="note" style="color:var(--dim);padding-bottom:10px">${asDataLine([...myNos,...opp6])}<br>ダメージは乱数の中央付近・天気を変える特性を含む1対1の目安です。フィールドの効果は反映していません。相手が実際に何を持っているかで変わります。</p>`;
  const sim=document.getElementById('as-sim');
  if(sim)sim.onclick=()=>{
    if(opp6.length<4)return;
    const sets={};myNos.forEach(n=>sets[n]=mySetFor(n));
    const osets={};opp6.forEach(n=>osets[n]=LIVE.csv[n]?buildSet(byNo[n],LIVE.csv[n],false):chooseSet(byNo[n]));
    B={phase:'pick',my:{name:'あなたのパーティ',nos:myNos,src:'own'},mySets:sets,opT:{name:'入力した相手',nos:[...opp6],sets:osets},sel:[...A.lead,...A.back].map(i=>A.myNos[i])};
    nav('#/battle');
  };
}
function assistView(arg){
  setHeader('選出アシスト','#/tools');
  V.innerHTML=`<div id="as-root"><div class="fmtbar"><span>対戦の形式</span>${fmtSwitch()}</div><p class="note" style="padding-top:4px">対戦前の画面で見える<b>相手の6匹</b>を入れると、あなたのパーティから<b>出すべき${PICK()}匹と先発</b>を出します（${FMTN()}）。実戦中にスマホを横に置いて使う想定です。</p>
  <div class="as-read"><label class="btn btn-p" for="as-shot" style="cursor:pointer">${SVG(I.image,18)}選出画面のスクショから読む</label><input type="file" id="as-shot" accept="image/*" hidden>
    <p class="vcap">ゲームの選出画面でスクリーンショットを撮り、ここで選びます（いちばん新しい写真が先頭に出ます）。相手の6匹を読み取り、すぐにおすすめ選出を出します。下の「PiPで見る」を使うと、結果をゲームの上に浮かべておけます。</p>
    <div id="as-read-msg"></div></div>
  <div class="sec" style="padding-top:16px"><h2>相手の6匹</h2><span id="as-cnt" style="font:700 15px Inter,sans-serif;color:var(--dim)">${opp6.length}/6</span></div>
  <div id="as-opp"></div>

  <div class="pipwrap" id="as-pipw" hidden><div class="pipt"><b>バトル中にPiPで見る</b><span class="atag on" style="margin-left:6px">β</span></div>
  <p class="vcap" style="margin:4px 0 10px">選んだカードを動画にして、PiP（ピクチャ・イン・ピクチャ）でゲームの上に浮かべます。<b>再生中は自動で次のカード、一時停止でそのカードに止まります</b>。</p>
  <div class="pipset"><div class="mx2" style="margin-bottom:6px">おすすめ</div><div class="pills" style="padding:0 0 10px"><button class="pill" data-pp="jissen">実戦</button><button class="pill" data-pp="hajime">はじめて</button></div>
  <div class="mx2" style="margin-bottom:6px">表示するカード（押した順に並びます）</div><div class="pills pcards" style="padding:0 0 10px;flex-wrap:wrap" id="pip-cards"></div>
  <div class="mx2" style="margin-bottom:6px">切り替えの間隔</div><div class="pills" style="padding:0 0 12px" id="pip-sec">${[3,4,6,8].map(n=>`<button class="pill" data-ps="${n}">${n}秒</button>`).join('')}</div></div>
  <div class="btns" style="padding:0 0 8px"><button class="btn btn-a" id="as-pip" disabled>カードを準備中…</button></div>
  <div id="pip-box"></div><p class="vcap" id="pip-msg"></p></div>
  
  <div class="srch" style="margin-top:10px">${SVG(I.search,18)}<input id="as-q" placeholder="相手のポケモン名（ひらがなOK）" autocomplete="off" enterkeyhint="done" aria-label="相手のポケモン名"></div>
  <details class="as-ty" id="as-ty"><summary>タイプで探す（画面のタイプのマークを押す）</summary>
    <div class="as-tyg">${T.map(t=>`<button class="as-tyb" data-ty="${t}" style="--tc:${COL[t]}" aria-pressed="false">${t}</button>`).join('')}</div></details>
  <div id="as-sg"></div>
  <div id="as-res"></div></div>`;
  const q=document.getElementById('as-q'),sg=document.getElementById('as-sg');
  /* タイプで探す（2026/11/05）：AI の読み取りが混み合って使えないときも、選出画面のタイプのマーク（1〜2個）を押せば候補がしぼれる。
     候補はランクバトルでよく使われている順（集計がなければ合計種族値の高い順） */
  let asTy=[];
  const tyRank=p=>{const r=typeof META!=='undefined'&&META.rank?META.rank.findIndex(x=>x.no===p.no||x.no===p.base):-1;return r<0?1e4-(p.bst||0):r};
  const sug=()=>{const t=q.value.trim();
    const l=t?P.filter(p=>nmHit(p,t)&&!opp6.includes(p.no)).slice(0,6)
      :asTy.length?P.filter(p=>!opp6.includes(p.no)&&asTy.every(x=>p.t.includes(x))&&(asTy.length<2||p.t.length===2)).sort((a,b)=>tyRank(a)-tyRank(b)).slice(0,8):[];
    sg.innerHTML=l.map(p=>`<button class="row" data-add="${p.no}" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line);text-align:left;color:inherit;font-family:inherit"><span class="av" style="width:40px;height:40px">${stamp(p)}</span><div class="row-m"><div class="row-t">${nm(p)}</div><div class="chips">${p.t.map(chip).join('')}</div></div></button>`).join('')||(t?'<p class="empty" style="padding:16px">見つかりません</p>':'')};
  /* スクショから相手の6匹を読む（読むのはサーバー＝AI、選出の計算はこのスマホでする） */
  document.getElementById('as-shot').onchange=async e=>{
    const f=e.target.files[0];e.target.value='';if(!f)return;
    const msg=document.getElementById('as-read-msg'),say=(t,bad)=>{msg.innerHTML=`<div class="bnote" style="margin:8px 0 0${bad?';box-shadow:inset 0 0 0 1px var(--w2)':''}">${t}</div>`};
    try{
      say('読み取りの準備中…');
      try{await fbLoad();await AUTH.wait}catch(err){}
      if(!AUTH.user){say('スクショから読むには<a href="#/account" style="color:var(--acc)">ログイン</a>が必要です（AIの利用回数を守るため）。',true);return}
      const x=await twShrink(f,1100);say('相手の6匹を読み取っています…（数秒かかります）');
      let r;try{r=await fetch(COMM_API+'/api/opp-read?fmt='+FMT,{method:'POST',headers:{'Content-Type':x.blob.type,Authorization:'Bearer '+await AUTH.user.getIdToken()},body:x.blob})}
      catch(err){if(typeof evCount==='function')evCount('oppread_ng');say('通信できませんでした。電波のよいところで、もう一度選んでください。',true);return}
      const j=await r.json().catch(()=>({}));if(!r.ok){if(typeof evCount==='function')evCount('oppread_ng');say((r.status===429?'<b>今日のAI読み取りの回数を使い切りました（明日また使えます）。</b>相手のポケモンは、下の欄から名前か「タイプで探す」で手で入れられます。':esc(j.error||'読み取れませんでした。'))+(j.busy?'<br><b>下の「タイプで探す」で、画面のタイプのマークを押すと、すぐに入れられます。</b>選出の計算はこれまでどおり使えます。':'<br>もう一度選ぶか、下の欄から名前か「タイプで探す」で入れてください。'),true);
        const d=document.getElementById('as-ty');if(d){d.open=true;d.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'center'})}return}
      const got=(j.opps||[]).filter(o=>o.no&&byNo[o.no]),nos=[...new Set(got.map(o=>o.no))].slice(0,6);
      if(!nos.length){if(typeof evCount==='function')evCount('oppread_ng');say('相手のポケモンを読み取れませんでした。選出画面（相手の6匹が並ぶ画面）のスクリーンショットか確かめて、もう一度選んでください。',true);return}
      if(typeof evCount==='function')evCount('oppread_ok');
      opp6=nos;saveOpp6();q.value='';sug();asDraw();asFetch();
      const unsure=got.filter(o=>!o.sure).map(o=>byNo[o.no].n),miss=(j.opps||[]).length-got.length;
      say(`${nos.length}匹を読み取りました（${j.sec}秒）。${unsure.length?`<b>${esc(unsure.join('・'))}</b>は自信が低めです。`:''}${miss?`読めなかったポケモンが${miss}匹います。`:''}違っていたら、下の「相手の6匹」で×を押して入れ直してください。`);
      const res=document.getElementById('as-res');if(res)res.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'start'});
    }catch(err){say(esc(err.message||'読み取れませんでした。'),true)}
  };
  const add=n=>{if(opp6.length>=6){toast('相手は6匹までです');return}if(!opp6.includes(n)){opp6.push(n);saveOpp6()}q.value='';
    if(asTy.length){asTy=[];document.querySelectorAll('#as-ty [data-ty]').forEach(x=>x.setAttribute('aria-pressed','false'))}else q.focus();sug();asDraw();asFetch()};
  q.oninput=sug;
  document.getElementById('as-ty').addEventListener('click',e=>{const b=e.target.closest('[data-ty]');if(!b)return;const ty=b.dataset.ty;
    asTy=asTy.includes(ty)?asTy.filter(x=>x!==ty):[...asTy,ty].slice(-2);
    document.querySelectorAll('#as-ty [data-ty]').forEach(x=>x.setAttribute('aria-pressed',String(asTy.includes(x.dataset.ty))));q.value='';sug()});
  q.onkeydown=e=>{if(e.key==='Enter'){const f=P.find(p=>nmHit(p,q.value.trim())&&!opp6.includes(p.no));if(f)add(f.no)}};
  document.getElementById('as-root').addEventListener('click',e=>{
    const a=e.target.closest('[data-add]');if(a){add(+a.dataset.add);return}
    const r=e.target.closest('[data-rm]');if(r){opp6=opp6.filter(n=>n!==+r.dataset.rm);saveOpp6();asDraw();return}
    const inf=e.target.closest('[data-info]');if(inf){e.preventDefault();openSheet({no:+inf.dataset.info});return}
    if(e.target.closest('#as-clear')){opp6=[];saveOpp6();asDraw();return}
    if(e.target.closest('#as-pip')){pipStart();return}
    const pp=e.target.closest('[data-pp]');if(pp){PIP.cfg.cards=[...PPRESET[pp.dataset.pp]];pipSave();pipSetUI();pipSchedule();return}
    const pc=e.target.closest('[data-pc]');if(pc){const c=pc.dataset.pc,a=PIP.cfg.cards,i=a.indexOf(c);if(i>=0){if(a.length>1)a.splice(i,1)}else a.push(c);pipSave();pipSetUI();pipSchedule();return}
    const ps=e.target.closest('[data-ps]');if(ps){PIP.cfg.sec=+ps.dataset.ps;pipSave();pipSetUI();pipSchedule();return}
    const h=e.target.closest('[data-hm]');if(h){asMode=h.dataset.hm;asDraw()}
  });
  PIP.mode='battle';
  asDraw();asFetch();
  bindFmt(document.getElementById('as-root'),()=>assistView());
  if(arg==='pip')setTimeout(()=>{const w=document.getElementById('as-pipw');
    if(w&&!w.hidden)w.scrollIntoView({behavior:'smooth',block:'start'});else toast('先に相手のポケモンを入れると、PiPが使えるようになります')},350);
}


