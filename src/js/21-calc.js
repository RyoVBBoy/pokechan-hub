/* ===================== ダメージ計算（乱数16段階） ===================== */
/* 1回の技で与えるダメージ（85〜100%の16段階）。
   2026/11/13：連続技は bhits で1発ずつ（その時点のHP・マルチスケイル・半減きのみ）計算して足す。16の値は「全部の当たりが同じ乱数の段階」のときの合計で、
   最小と最大は正確。倒せる確率は、当たりごとに乱数が別々の分布 r.dist（hitDist）で出す */
function dmgRolls(a,mv,d,o){
  const r=[];for(let k=85;k<=100;k++)r.push(bhits(a,mv,d,{...o,r:k}).total);
  const n=bhits(a,mv,d,{...o,r:100}).n;if(n>1)r.dist=hitDist(a,mv,d,o);
  return r;
}
/* n回当てたときに倒せる確率（いちばん少ない回数と、その確率） */
function koInfo(r,hp){
  if(!r.length||Math.max(...r)<=0)return{n:0,p:0,sure:0};
  /* 1回の使用のダメージの分布：連続技は r.dist（[合計,確率]）、ほかは16段階が同じ確率 */
  const base=r.dist||r.map(v=>[v,1/r.length]);
  let dist=new Map([[0,1]]),first=null;
  for(let n=1;n<=8;n++){
    const nd=new Map();
    for(const[s,c]of dist)for(const[v,w]of base){const t=Math.min(s+v,hp);nd.set(t,(nd.get(t)||0)+c*w)}
    dist=nd;const ko=Math.min(1,dist.get(hp)||0);
    if(ko>1e-12&&!first)first={n,p:ko};
    if(ko>=.9999)return{...(first||{n,p:ko}),sure:n};
  }
  return first?{...first,sure:0}:{n:9,p:0,sure:0};
}
/* 確率の書き方。必ずではないのに四捨五入で「100%」と出さない（2026/11/13：ネズミざん10回などで 99.95% が 100% に見えた） */
const pctTxt=p=>p<.001?'0.1%未満':p<.9999&&p>=.995?'99.5%以上':(p*100).toFixed(p<.1?1:0)+'%';
const koLabel=k=>!k.n?'ダメージなし':k.n>8?'8発以上':k.p>=.9999?`確定${k.n}発`:`乱数${k.n}発（${pctTxt(k.p)}）${k.sure?`／確定${k.sure}発`:''}`;
/* わかりやすい言い方（2026/11/07 依頼主の要望：ダメージ計算をわかりやすく） */
const koPlain=k=>!k.n?L('ダメージを与えられません','No damage'):k.n>8?L('倒すには9回以上かかります','Takes 9+ hits to KO'):k.p>=.9999?L(`${k.n}回当てれば必ず倒せます`,`Guaranteed ${k.n}HKO`):L(`${k.n}回で倒せる確率は ${pctTxt(k.p)}${k.sure?`。${k.sure}回なら必ず倒せます`:''}`,`${pctTxt(k.p)} chance to ${k.n}HKO${k.sure?` (guaranteed ${k.sure}HKO)`:''}`);
/* 結果の札（2026/11/12）：確定○発は塗り、乱数○発（確率）は枠だけで見分ける。koLabel・koPlain と同じ数（計算は変えない）。ダメージなし・9発以上は札を出さない */
/* 操作の回数（2026/11/12 アクセス解析）：利用者が条件を変えて、結果が出たときだけ数える（開いただけ・集計の読み込みでの描き直しは数えない）。同じ条件は1回 */
function calcEv(){try{if(typeof evCount!=='function'||!CS||!document.querySelector('#calc-root .cres-big'))return;
  evCount('calc_done',JSON.stringify([CS.a,CS.d,CS.mv,CS.crit,CS.spread,CS.screen,CS.burn,CS.cond,CS.weather,CS.cnt,CS.aHP,CS.dHP,CS.dSt,FMT]))}catch(e){}}
const koBadge=k=>!k||!k.n||k.n>8?'':k.p>=.9999?`<span class="cv-kb sure" data-notr>${L(`確定${k.n}発`,`Guaranteed ${k.n}HKO`)}</span>`:`<span class="cv-kb rand" data-notr>${L(`乱数${k.n}発`,`${k.n}HKO chance`)}<small>${pctTxt(k.p)}</small></span>`;
const mvNm=m=>(m&&m.id>0&&mName(m.id))||(m&&m.n)||'';
const koShort=k=>!k.n||k.n>8?'—':(k.p>=.9999?'確':'乱')+k.n;

let CS=null;const CALC_OPEN={};
function calcX(no,src){
  const p=byNo[no];const mine=team.some(t=>t.no===no);
  const c=(src!=='common'&&mine)?mySetFor(no):detSet(p),sv=setToSaved(p,c);
  return{no,src:(src!=='common'&&mine)?'mine':'common',ab:c.ab||'',item:c.item||'',sp:[...sv.sp],up:sv.up,dn:sv.dn,
    moves:(c.moves||[]).filter(m=>!m.prot&&m.pow>0),stg:{atk:0,def:0,spa:0,spd:0}};
}
function calcInit(){
  const a=team[0]?team[0].no:445,d=(team[1]&&team[1].no!==a)?149:(a===149?445:149);
  CS={a:calcX(a),d:calcX(d,'common'),mv:null,crit:false,spread:false,burn:false,screen:false,weather:'',aHP:100,dHP:100,dSt:'',cond:false,cnt:0,hits:0,protean:true};
  CS.mv=null;
}
function calcMon(side,X){
  const p=byNo[X.no];
  const m=mkMon(p,side,{ab:X.ab||null,item:X.item||null,moves:X.moves.length?X.moves:chooseSet(p,true).moves,sp:X.sp,up:X.up,dn:X.dn});
  m.stg={atk:0,def:0,spa:0,spd:0,spe:0,...X.stg};
  if(side==='me'&&CS.burn)m.status='brn';
  if(side==='op'&&CS.dSt)m.status=CS.dSt;
  const pc=side==='me'?CS.aHP:CS.dHP;if(pc<100)m.hp=Math.max(1,Math.floor(m.max*pc/100));
  return m;
}
function calcMoveList(X){
  const ls=LSD[X.no],seen=new Set(),out=[];
  X.moves.forEach(m=>{if(!seen.has(m.id)){seen.add(m.id);out.push(m)}});
  (ls?ls[1]:[]).forEach(id=>{if(seen.has(id)||!MV[id])return;seen.add(id);out.push(mvObj(id))});
  return out;
}
/* 計算に渡す条件（2026/11/13：当たる回数・へんげんじざいを足した） */
const calcOpt=()=>({crit:CS.crit,spread:FMT==='double'&&CS.spread,screen:CS.screen,cond:CS.cond,cnt:CS.cnt,hits:CS.hits||0,protean:CS.protean!==false});
/* 計算に入っていない・確かめていない特性と持ち物（2026/11/13 点検）。選ばれていたら結果の下に出す（入っているように見せない） */
const CALC_UNVERIFIED={eelevate:'うなぎのぼりの「じめん技を受けない」は当サイトの特性の説明に合わせた計算で、ゲームではまだ確かめていません','mega-sol':'メガソーラーの効果は当サイトの説明に合わせた計算で、ゲームではまだ確かめていません',dragonize:'ドラゴンスキンの効果（ノーマル技がドラゴン技・1.2倍）は当サイトの説明に合わせた計算で、ゲームではまだ確かめていません'};
const CALC_UNIMPL=['fire-mane','aura-guard','piercing-drill','spicy-spray','sheer-force','reckless','analytic','sniper','punk-rock','steely-spirit','supreme-overlord','stakeout','fluffy','purifying-salt','unaware','liquid-voice','marvel-scale','friend-guard','shell-armor','battle-armor','infiltrator','cloud-nine','bulletproof','soundproof','electric-surge','grassy-surge','psychic-surge','seed-sower','forecast','hunger-switch','stamina'];
const CALC_UNIMPL_IT=['ironball','metronome','electricseed','grassyseed','psychicseed','mistyseed'];
function calcNotes(R){
  const o=[],a=R.a,d=R.d,n=R.n||1,mv=R.mv;
  if(n>1){
    const vr=mv.maxH>1&&mv.minH!==mv.maxH;
    o.push(`${n}回当たったときの合計です${vr?(a.ab==='skill-link'?'（スキルリンクで最大の回数）':`（この技は${mv.minH}〜${mv.maxH}回で変わります。下の「条件」の「当たる回数」で選べます）`):''}。1発ずつ順番に計算し、当たりごとに乱数は別々として倒せる確率を出しています`);
    if(mkey(mv)==='populationbomb')o.push('ネズミざんは1回ごとに命中の判定があり、外れたところで止まります。いつも10回当たるわけではありません');
    if(d.ab==='multiscale'&&d.hp===d.max&&a.ab!=='mold-breaker')o.push('マルチスケイルで半分になるのは、HPが満タンのときに受ける1発目だけです');
  }
  if(a.ab==='protean'||a.ab==='libero')o.push(R.op&&R.op.protean?`${ABN[a.ab]}で技と同じタイプになったとして計算しています（場に出て最初の技のとき）`:`${ABN[a.ab]}がすでに発動していて、もとのタイプのまま攻撃するとして計算しています`);
  if(a.ab==='disguise'||d.ab==='disguise')o.push('ばけのかわが残っているあいだはダメージを受けない前提で計算しています（化けの皮がはがれたあとの計算には対応していません）');
  for(const m of [a,d]){if(CALC_UNVERIFIED[m.ab])o.push(CALC_UNVERIFIED[m.ab]);if(CALC_UNIMPL.includes(m.ab))o.push(`特性「${ABN[m.ab]||m.ab}」の効果は計算に入っていません`);if(m.item&&CALC_UNIMPL_IT.includes(m.item))o.push(`持ち物「${ITEMN[m.item]||m.item}」の効果は計算に入っていません`)}
  return o;
}
function calcResult(){
  const a=calcMon('me',CS.a),d=calcMon('op',CS.d);
  const list=calcMoveList(CS.a);
  /* 技を選んでいないときは、いちばんダメージの大きい技（覚えさせた技の中から） */
  if(CS.mv==null){const set=CS.a.moves.length?CS.a.moves:list.slice(0,8);let best=null;const sw0=B.weather;B.weather=CS.weather?{k:CS.weather,t:5}:null;
    try{set.forEach(m=>{const v=bhits(a,m,d,{protean:CS.protean!==false}).total*(accOf(a,m,d)/100);if(!best||v>best.v)best={m,v}})}catch(e){}finally{B.weather=sw0}
    if(best)CS.mv=best.m.id}
  let mv=list.find(m=>m.id===CS.mv)||list[0];if(!mv)return null;CS.mv=mv.id;
  const sw=B.weather;B.weather=CS.weather?{k:CS.weather,t:5}:null;
  try{
    const op=calcOpt(),r=dmgRolls(a,mv,d,op);
    return{a,d,mv,list,r,ko:koInfo(r,d.hp),eff:bcalc(a,mv,d,{protean:op.protean}).eff,acc:accOf(a,mv,d),n:bhits(a,mv,d,{...op,r:100}).n,op};
  }finally{B.weather=sw}
}
/* 覚えさせた技（使用率の高い型）それぞれのダメージと、相手からの反撃 */
function calcOverview(R){
  const sw=B.weather;B.weather=CS.weather?{k:CS.weather,t:5}:null;
  try{
    const ms=[...CS.a.moves];if(!ms.some(m=>m.id===R.mv.id))ms.push(R.mv);
    const rows=ms.slice(0,6).map(m=>{const r=dmgRolls(R.a,m,R.d,{...calcOpt(),hits:m.id===R.mv.id?CS.hits||0:0});
      return{m,lo:Math.min(...r)/R.d.max*100,hi:Math.max(...r)/R.d.max*100,ko:koInfo(r,R.d.hp),eff:bcalc(R.a,m,R.d,{protean:CS.protean!==false}).eff}});
    let back=null;try{const h=estHit(R.d,R.a);if(h&&h.mv)back={mv:h.mv,pct:h.pct}}catch(e){}
    return{rows,back};
  }finally{B.weather=sw}
}
const monOpts=sel=>P.map(p=>`<option value="${p.no}"${p.no===sel?' selected':''}>${p.n}</option>`).join('');
function calcSide(key,X,isAtk){
  const p=byNo[X.no],abl=ABD[X.no]||[];
  const stat=isAtk?[1,3]:[0,2,4];
  /* 実数値の表示は計算に使う姿で（2026/11/13：メガストーンを持たせても元の姿の数値を出していた）。
     ギルガルドの攻撃側はブレードフォルム、イルカマンはマイティフォルム（mkMon と同じ BATTLE_FORM） */
  const mg=megaOf(X.no,X.item),q=mg||p,bf=BATTLE_FORM[mg?mg.ab:X.ab];
  const st=bf&&bf.no===q.no&&(bf.always||isAtk)?calcStats({...q,s:bf.s},X.sp,X.up,X.dn):calcStats(q,X.sp,X.up,X.dn);
  const ks=[...Object.keys(MEGA).filter(k=>itemFor(X.no,k)),...Object.keys(ITEMN).filter(k=>!isStone(k))];
  return `<div class="cside">
  <div class="pills" style="padding:2px 16px 8px">${team.some(t=>t.no===X.no)?`<button class="pill" data-c="${key}.src" data-v="mine" aria-pressed="${X.src==='mine'}">あなたの育成</button>`:''}<button class="pill" data-c="${key}.src" data-v="common" aria-pressed="${X.src==='common'}">使用率の高い型</button></div>
  <div class="natr"><span style="width:62px">特性</span><select class="sel" data-c="${key}.ab">${abl.length?abl.map(([k,h])=>`<option value="${k}"${k===X.ab?' selected':''}>${ABN[k]||k}${h?'（隠れ）':''}</option>`).join(''):`<option value="">（なし）</option>`}</select></div>
  <div class="natr"><span style="width:62px">持ち物</span><select class="sel" data-c="${key}.item"><option value="">（なし）</option>${ks.map(k=>`<option value="${k}"${k===X.item?' selected':''}>${ITEMN[k]}</option>`).join('')}</select></div>
  ${megaOf(X.no,X.item)?`<p class="note" style="padding:0 16px 6px;color:var(--acc)">${megaOf(X.no,X.item).n}の姿（特性：${ABN[megaOf(X.no,X.item).ab]||megaOf(X.no,X.item).ab}）で計算します</p>`:''}
  <div style="padding:4px 12px 8px">${natGrid(X.up,X.dn,j=>`data-c="${key}.nat" data-v="${j}"`)}</div>
  <div class="cgrid">${stat.map(i=>`<label><span>${SN[i]} <b>${st[i]}</b></span><input type="number" min="0" max="${SP_CAP}" value="${X.sp[i]}" data-c="${key}.sp${i}" inputmode="numeric"><small>能力ポイント</small></label>`).join('')}
    ${(isAtk?[['atk','攻撃'],['spa','特攻']]:[['def','防御'],['spd','特防']]).map(([k,n])=>`<label><span>${n}ランク</span><select class="sel" data-c="${key}.stg.${k}">${[6,5,4,3,2,1,0,-1,-2,-3,-4,-5,-6].map(v=>`<option value="${v}"${v===(X.stg[k]||0)?' selected':''}>${v>0?'+'+v:v}</option>`).join('')}</select></label>`).join('')}</div>
  </div>`;
}
/* 攻守の入れかえ（2026/11/11 依頼主：⇅ を180度回し、上下の2匹を0.3秒ですべらせて入れかえる。表示だけでなく中身も入れかえる）
   中身：2匹の育成（型・技・特性・持ち物・性格・能力ポイント・ランク）・残りHP・状態異常（攻撃側のやけど⇔受ける側の状態。
   攻撃側はやけどしか計算に使わないので、まひ等は CS.aSt に覚えておき、もう一度入れかえると受ける側に戻る）。技は新しい攻撃側のいちばん強い技に選び直す */
let CALC_ROT=0;
/* 入れかえの印：回る2本の矢印（🔄 の形を自分で描いたもの。2026/11/11 依頼主：回転するので ⇅ より 🔄。矢印の先は左右の端で、画面の上下の向き〔右＝下向き・左＝上向き〕） */
I.cycle='<path d="M7.05 7.05A7 7 0 0 1 19 12"/><path d="M16 9.6l3 3 3-3"/><path d="M16.95 16.95A7 7 0 0 1 5 12"/><path d="M2 14.4l3-3 3 3"/>';
function calcSwapData(){
  const a=CS.a;CS.a=CS.d;CS.d=a;CS.mv=null;
  const h=CS.aHP;CS.aHP=CS.dHP;CS.dHP=h;
  const aSt=CS.aSt&&((CS.aSt==='brn')===!!CS.burn)?CS.aSt:(CS.burn?'brn':'');
  CS.aSt=CS.dSt||'';CS.dSt=aSt;CS.burn=CS.aSt==='brn';
}
function calcSwap(draw){
  const box=document.querySelector('#calc-root .cv-vs'),sd=box?[...box.querySelectorAll('.cv-side')]:[];
  /* 動かす前の位置（変形を含まない位置） */
  const t0=sd.length===2?[sd[0].offsetTop,sd[1].offsetTop]:null;
  calcSwapData();CALC_ROT+=180;
  const y=scrY();draw();scrTo(0,y);
  const nb=document.querySelector('#calc-root .cv-vs'),ic=nb&&nb.querySelector('.cv-swi');
  if(!nb||!t0||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const ns=[...nb.querySelectorAll('.cv-side')],d=t0[1]-t0[0];
  /* ⇅ は前の向きから180度回す */
  if(ic){ic.style.transition='none';ic.style.transform=`rotate(${CALC_ROT-180}deg)`;void ic.offsetWidth;ic.style.transition='';ic.style.transform=`rotate(${CALC_ROT}deg)`}
  /* 新しい上の段（もとは下）は下から、新しい下の段（もとは上）は上からすべってくる */
  ns.forEach((el,i)=>{el.classList.remove('cv-swm');el.style.transform=`translateY(${i===0?d:-d}px)`;el.style.opacity='.55'});
  nb.classList.add('cv-anim');void nb.offsetWidth;
  ns.forEach(el=>{el.classList.add('cv-swm');el.style.transform='';el.style.opacity=''});
  clearTimeout(calcSwap.t);calcSwap.t=setTimeout(()=>{nb.classList.remove('cv-anim');ns.forEach(el=>el.classList.remove('cv-swm'))},340);
}
function calcView(){
  setHeader('ダメージ計算','#/tools');
  if(!CS)calcInit();
  const draw=()=>{
    const R=calcResult();
    const pct=v=>(v/R.d.max*100).toFixed(1);
    const lo=R?Math.min(...R.r):0,hi=R?Math.max(...R.r):0;
    const O=R?calcOverview(R):null;
    const nmA=esc(formInfo(byNo[CS.a.no]).base),nmD=esc(formInfo(byNo[CS.d.no]).base);
    const sum=X=>{const parts=[X.ab&&ABN[X.ab],X.item&&ITEMN[X.item],(NATS.find(([n,u,d])=>u===X.up&&d===X.dn)||[''])[0]].filter(Boolean);return esc(parts.join('・')||'特性・持ち物なし')};
    const effTag=e=>e>=4?'<span class="cv-e good">ばつぐん×4</span>':e>=2?'<span class="cv-e good">ばつぐん</span>':e===0?'<span class="cv-e none">こうかなし</span>':e<1?'<span class="cv-e weak">いまひとつ</span>':'';
    /* 受けたあとの残りHP（多く残る〜少なく残る） */
    const remHi=R?Math.max(0,100-Math.min(...R.r)/R.d.max*100):0,remLo=R?Math.max(0,100-Math.max(...R.r)/R.d.max*100):0,cur0=R?R.d.hp/R.d.max*100:100;
    const hpCol=v=>v>50?'#00ba7c':v>20?'#ffb020':'#f4212e';
    V.innerHTML=`<div id="calc-root"><div class="fmtbar"><span>対戦の形式</span>${fmtSwitch()}</div>
    <div class="cv-vs">
      <div class="cv-side"><span class="cv-lab">${L('攻撃する','Attacker')}</span>${monField(`data-c="a.no"`,CS.a.no)}<span class="cv-sum" data-notr>${CS.a.src==='mine'?L('あなたの育成','Your set'):L('使用率の高い型','Common set')}: ${sum(CS.a)}</span></div>
      <button class="cv-swap" id="c-swap" aria-label="攻守を入れ替える" title="攻守を入れ替える"><span class="cv-swi" style="transform:rotate(${CALC_ROT}deg)">${SVG(I.cycle,22)}</span></button>
      <div class="cv-side"><span class="cv-lab">${L('受ける','Defender')}</span>${monField(`data-c="d.no"`,CS.d.no)}<span class="cv-sum" data-notr>${CS.d.src==='mine'?L('あなたの育成','Your set'):L('使用率の高い型','Common set')}: ${sum(CS.d)}</span></div>
    </div>
    ${R?`<div class="cres cv-res">
      <div class="cres-h" data-notr>${L(`${nmA}の<b>${esc(mvNm(R.mv))}</b> → ${nmD}`,`${nmA}'s <b>${esc(mvNm(R.mv))}</b> → ${nmD}`)} ${effTag(R.eff)}${R.acc<100?`<span class="cv-e">命中${Math.round(R.acc)}</span>`:''}</div>
      ${R.eff===0?`<div class="cres-big">0%</div><div class="cv-ko">${L('こうかがありません（タイプか特性で防がれます）','No effect (blocked by type or ability)')}</div>`:`
      <div class="cv-main"><div class="cres-big">${pct(lo)}<small>%</small> 〜 ${pct(hi)}<small>%</small></div>${koBadge(R.ko)}</div>
      <div class="cv-ko" data-notr>${koPlain(R.ko)}</div>
      <div class="cv-hp" aria-label="受けたあとの残りHP"><i class="cv-hp-rem" style="width:${remLo}%;background:${hpCol(remLo)}"></i><i class="cv-hp-rng" style="left:${remLo}%;width:${Math.max(.6,remHi-remLo)}%"></i><i class="cv-hp-lost" style="left:${remHi}%;width:${Math.max(0,cur0-remHi)}%"></i></div>
      <div class="cres-s" data-notr>${L('残りHP','HP left')}: ${remHi<=0?L('0%（倒れます）','0% (KO)'):Math.round(remLo)===Math.round(remHi)?Math.round(remHi)+'%':`${Math.round(remLo)}〜${Math.round(remHi)}%`}</div>
      <div class="cv-raw num" data-notr>${L('ダメージ','Damage')} ${lo}–${hi}<span aria-hidden="true">／</span>HP ${R.d.max}${R.d.hp<R.d.max?`<span aria-hidden="true">／</span>${L('いまのHP','current HP')} ${R.d.hp}`:''}</div>`}
      ${(()=>{const t=[mvNote(R),...calcNotes(R)].filter(Boolean).join('。');return t?`<div class="cres-n">${esc(t)}</div>`:''})()}
    </div>
    ${O&&O.rows.length?`<div class="sec"><h2>技ごとのダメージ</h2><span style="font-size:12px;color:var(--dim)">押すと上に出ます</span></div>
    <div class="cv-mvs">${O.rows.map(x=>`<button class="cv-mv${x.m.id===R.mv.id?' on':''}" data-mvpick="${x.m.id}"><span class="cv-mn" data-notr>${esc(mvNm(x.m))}<small>${x.m.t}・${['物理','特殊','変化'][x.m.cls]}</small></span>
      <span class="cv-mb"><i style="width:${Math.min(100,x.hi)}%;background:${x.eff===0?'var(--line)':x.hi>=100?'#f4212e':x.hi>=50?'#ffb020':'var(--acc)'}"></i></span>
      <span class="cv-mp num">${x.eff===0?L('無効','Immune'):`${Math.round(x.lo)}〜${Math.round(x.hi)}%`}</span><span class="cv-mk" data-notr>${x.eff===0||!x.ko.n||x.ko.n>8?'':x.ko.p>=.9999?L(`確定${x.ko.n}発`,`${x.ko.n}HKO`):L(`乱数${x.ko.n}発`,`chance ${x.ko.n}HKO`)}</span></button>`).join('')}</div>
    <div class="natr" style="padding-top:8px"><span style="width:62px;font-size:13px;color:var(--dim)">ほかの技</span><select class="sel" data-c="mv" data-notr>${R.list.map(m=>`<option value="${m.id}"${m.id===R.mv.id?' selected':''}>${mvNm(m)}（${m.t}・${['物理','特殊','変化'][m.cls]}・${['seismictoss','nightshade','superfang','endeavor','finalgambit'].includes(mkey(m))?'固定ダメージ':'威力'+(m.pow||'変動')}${m.maxH>1?(m.minH===m.maxH?'×'+m.maxH:`×${m.minH}〜${m.maxH}`):''}）</option>`).join('')}</select></div>`:''}
    ${O&&O.back?`<div class="cv-back" data-notr>${L(`反撃されると：${nmD}の<b>${esc(mvNm(O.back.mv))}</b>で、${nmA}は約<b>${Math.round(O.back.pct)}%</b>受けます${O.back.pct>=100?'（一撃で倒されます）':''}`,`If ${nmD} hits back with <b>${esc(mvNm(O.back.mv))}</b>, ${nmA} takes about <b>${Math.round(O.back.pct)}%</b>${O.back.pct>=100?' (OHKO)':''}`)}</div>`:''}`:'<p class="empty">この組み合わせでは計算できる技がありません。</p>'}
    <div class="sec"><h2>条件</h2></div>
    <div class="pills" style="padding:0 16px 8px;flex-wrap:wrap">
      <button class="pill" data-t="crit" aria-pressed="${CS.crit}">急所</button>
      ${FMT==='double'?`<button class="pill" data-t="spread" aria-pressed="${CS.spread}">全体技が2匹に当たる（×0.75）</button>`:''}
      <button class="pill" data-t="screen" aria-pressed="${CS.screen}">${R&&R.mv.cls?'ひかりのかべ':'リフレクター'}</button>
      <button class="pill" data-t="burn" aria-pressed="${CS.burn}">攻撃側がやけど</button>
      ${R&&MCOND[mkey(R.mv)]?`<button class="pill" data-t="cond" aria-pressed="${CS.cond}">${MCOND[mkey(R.mv)]}（威力2倍）</button>`:''}
      ${R&&(R.a.ab==='protean'||R.a.ab==='libero')?`<button class="pill" data-t="protean" aria-pressed="${CS.protean!==false}">${ABN[R.a.ab]}がこの技で発動する</button>`:''}</div>
    ${R&&R.mv.maxH>1&&R.mv.minH!==R.mv.maxH&&R.a.ab!=='skill-link'?`<div class="natr"><span style="width:62px">当たる回数</span><select class="sel" data-c="hits" id="c-hits">${Array.from({length:R.mv.maxH-R.mv.minH+1},(_,i)=>R.mv.minH+i).map(v=>`<option value="${v}"${v===R.n?' selected':''}>${v}回</option>`).join('')}</select></div>`:''}
    <div class="natr"><span style="width:62px">天気</span><select class="sel" data-c="weather">${[['','なし'],['sun','はれ'],['rain','あめ'],['sand','すなあらし'],['snow','ゆき']].map(([k,n])=>`<option value="${k}"${k===CS.weather?' selected':''}>${n}</option>`).join('')}</select></div>
    ${R&&MCOUNT[mkey(R.mv)]?`<div class="natr"><span style="width:62px">回数</span><select class="sel" data-c="cnt">${Array.from({length:MCOUNT[mkey(R.mv)][1]+1},(_,i)=>`<option value="${i}"${i===CS.cnt?' selected':''}>${MCOUNT[mkey(R.mv)][0]}：${i}</option>`).join('')}</select></div>`:''}
    <details class="cv-more"${CALC_OPEN.a?' open':''} data-more="a"><summary><b>${L(`${nmA}の育成を変える`,`Edit ${nmA}'s set`)}</b><span>特性・持ち物・性格・能力ポイント・ランク</span></summary>${calcSide('a',CS.a,true)}</details>
    <details class="cv-more"${CALC_OPEN.d?' open':''} data-more="d"><summary><b>${L(`${nmD}の育成を変える`,`Edit ${nmD}'s set`)}</b><span>特性・持ち物・性格・能力ポイント・ランク</span></summary>${calcSide('d',CS.d,false)}</details>
    <details class="cv-more"${CALC_OPEN.x?' open':''} data-more="x"><summary><b>そのほかの条件</b><span>残りHP・状態異常</span></summary>
      <div class="natr"><span style="width:62px">残りHP</span><label class="hpin">攻撃側<input type="number" min="1" max="100" value="${CS.aHP}" data-c="aHP" inputmode="numeric">%</label><label class="hpin">受ける側<input type="number" min="1" max="100" value="${CS.dHP}" data-c="dHP" inputmode="numeric">%</label></div>
      <div class="natr"><span style="width:62px">状態</span><select class="sel" data-c="dSt">${[['','受ける側：状態異常なし'],['brn','受ける側：やけど'],['par','受ける側：まひ'],['psn','受ける側：どく'],['tox','受ける側：もうどく'],['slp','受ける側：ねむり'],['frz','受ける側：こおり']].map(([k,n])=>`<option value="${k}"${k===CS.dSt?' selected':''}>${n}</option>`).join('')}</select></div></details>
    ${R?`<details class="cv-more"><summary><b>乱数16段階のダメージ</b><span>${R.n>1?'連続技は全部の当たりが同じ段階のときの合計':'ダメージは85〜100%の16通りでばらつきます'}</span></summary><div class="crolls" style="padding:8px 16px 12px">${R.r.map((v,i)=>`<span>${85+i}%<b>${v}</b></span>`).join('')}</div></details>
    <details class="edd cver" id="c-ver"${DVER.open?' open':''}><summary>ゲームの結果と照らし合わせる</summary>
      <p class="note" style="padding:6px 0 4px">上と同じ条件でゲーム内で技を当て、実際に減ったHPを入れてください。自分のポケモンが受けたときは数値、相手のときは％で入れます。</p>
      <div class="cver-r"><div class="pills" style="padding:0"><button class="pill" data-vu="n" aria-pressed="${DVER.unit==='n'}">数値</button><button class="pill" data-vu="p" aria-pressed="${DVER.unit==='p'}">％</button></div>
        <input type="number" id="c-obs" inputmode="decimal" min="0" placeholder="${DVER.unit==='n'?'例：'+R.r[8]:'例：'+pct(R.r[8])}" aria-label="ゲームで出たダメージ">
        <button class="btn btn-p" id="c-rec">記録</button></div>
      <div id="c-verdict" class="cver-v" aria-live="polite"></div>
      ${dvList()}
    </details>`:''}
    <details class="cv-more"><summary><b>計算について</b><span>どこまで計算に入っているか</span></summary>
    <p class="note" style="color:var(--mute)">Lv50で計算しています。計算の手順と端数の処理は本編（スカーレット・バイオレット）と同じ方式です。対戦で広く使われている計算機と、ランダムな組み合わせ（毎回1500通り）と、決まった場面（連続技・メガシンカ・持ち物や特性による無効など）で一致することを確かめています。ポケモンチャンピオンズにだけある特性の効果は、ゲームではまだ確かめていません。メガストーンを持たせるとメガシンカ後の姿で計算します。急所・天気・やけど・ランク・壁・持ち物と、ダメージに関わる主な特性（メガシンカの特性を含む）に対応しています。けたぐり・ジャイロボール・ふんか・たたりめ・はたきおとす・ちきゅうなげなど、条件で威力やダメージが変わる技も計算します。連続技は1発ずつ順番に計算します（2〜5回の技は、選んだ回数。はじめは3回）。フィールド（エレキ・グラス・サイコ・ミスト）にはまだ対応していません。オボンのみなどの回復は含みません。</p>
    ${srcLine('formula','calc')}</details>
    </div>`;
    const root=document.getElementById('calc-root');
    root.querySelectorAll('[data-c]').forEach(el=>{
      const ev=el.tagName==='BUTTON'?'click':'change';
      el.addEventListener(ev,()=>{
        const [k1,k2,k3]=el.dataset.c.split('.');const v=el.dataset.v??el.value;
        if(k1==='mv'){CS.mv=+v;CS.hits=0}
        else if(k1==='hits'){CS.hits=+v}
        else if(k1==='weather'){CS.weather=v}
        else if(k1==='aHP'||k1==='dHP'){CS[k1]=Math.max(1,Math.min(100,+v||100))}
        else if(k1==='dSt'){CS.dSt=v}
        else if(k1==='cnt'){CS.cnt=+v}
        else{const X=CS[k1];
          if(k2==='no'){CS[k1]=calcX(+v,k1==='d'?'common':undefined);CS.mv=null;CS.hits=0;calcEnsure(+v)}
          else if(k2==='src'){CS[k1]=calcX(X.no,v);if(k1==='a')CS.mv=null}
          else if(k2==='ab')X.ab=v;
          else if(k2==='item')X.item=v;
          else if(k2==='nat'){const n=NATS[+v];X.up=n[1];X.dn=n[2]}
          else if(k2==='stg')X.stg[k3]=+v;
          else if(k2.startsWith('sp')){const i=+k2.slice(2),others=X.sp.reduce((s,x,j)=>j===i?s:s+x,0);X.sp[i]=Math.max(0,Math.min(+v||0,SP_CAP,SP_TOTAL-others))}
        }
        const y=scrY();if(el.tagName==='INPUT')setTimeout(()=>{draw();scrTo(0,y);calcEv()},0);else{draw();scrTo(0,y);calcEv()}
      });
    });
    root.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{CS[b.dataset.t]=!CS[b.dataset.t];const y=scrY();draw();scrTo(0,y);calcEv()});
    bindFmt(root,()=>{CS.a=calcX(CS.a.no,CS.a.src);CS.d=calcX(CS.d.no,CS.d.src);draw();calcEnsure(CS.a.no,CS.d.no).then(c=>{if(c&&keyOf(cur)==='calc'){CS.a=calcX(CS.a.no,CS.a.src);CS.d=calcX(CS.d.no,CS.d.src);draw()}})});
    calcVerBind(R,draw);
    root.querySelectorAll('[data-mvpick]').forEach(b=>b.onclick=()=>{CS.mv=+b.dataset.mvpick;CS.hits=0;const y=scrY();draw();scrTo(0,y);calcEv()});
    root.querySelectorAll('details[data-more]').forEach(d=>d.addEventListener('toggle',()=>{CALC_OPEN[d.dataset.more]=d.open}));
    document.getElementById('c-swap').onclick=()=>{calcSwap(draw);setTimeout(calcEv,400)};
    /* 長い一覧（特性・持ち物・ほかの技）は名前で探して選べる（74-sselect.js。中身は今までの select のまま） */
    if(typeof ssEnhance==='function')ssEnhance(root,'[data-c="a.ab"],[data-c="a.item"],[data-c="d.ab"],[data-c="d.item"],[data-c="mv"]');
  };
  draw();
  calcEnsure(CS.a.no,CS.d.no).then(ch=>{if(ch&&keyOf(cur)==='calc'){CS.a=calcX(CS.a.no,CS.a.src);CS.d=calcX(CS.d.no,CS.d.src);draw()}});
}
/* 使用率の高い型のためにラダー集計を読み込む（読み込めたら true） */
async function calcEnsure(...nos){
  try{if(!(await liveInit()))return false;const need=nos.filter(n=>LIVE.csv[n]===undefined);if(!need.length)return false;await Promise.all(need.map(liveMon));return true}catch(e){return false}
}

