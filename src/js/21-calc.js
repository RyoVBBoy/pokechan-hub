/* ===================== ダメージ計算（乱数16段階） ===================== */
/* 1回の技で与えるダメージ（85〜100%の16段階）。連続技は回数をかけた目安 */
function dmgRolls(a,mv,d,o){
  const h=mv.maxH>1?(mv.minH===mv.maxH?mv.maxH:3):1,r=[];
  const pb=a.ab==='parental-bond'&&h===1&&!o.spread&&fixedDmg(a,mv,d)==null;
  /* トリプルアクセル：20→40→60と威力が上がる3回攻撃 */
  if(mkey(mv)==='tripleaxel'){for(let k=85;k<=100;k++)r.push([20,40,60].reduce((x,pw)=>x+bcalc(a,{...mv,pow:pw},d,{...o,r:k}).dmg,0));return r}
  for(let k=85;k<=100;k++)r.push(bcalc(a,mv,d,{...o,r:k}).dmg*h+(pb?bcalc(a,mv,d,{...o,r:k,pb:true}).dmg:0));
  return r;
}
/* n回当てたときに倒せる確率（いちばん少ない回数と、その確率） */
function koInfo(r,hp){
  if(!r.length||Math.max(...r)<=0)return{n:0,p:0,sure:0};
  let dist=new Map([[0,1]]),first=null;
  for(let n=1;n<=8;n++){
    const nd=new Map();
    for(const[s,c]of dist)for(const v of r){const t=Math.min(s+v,hp);nd.set(t,(nd.get(t)||0)+c)}
    dist=nd;const ko=Math.min(1,(dist.get(hp)||0)/Math.pow(16,n));
    if(ko>0&&!first)first={n,p:ko};
    if(ko>=.9999)return{...(first||{n,p:ko}),sure:n};
  }
  return first?{...first,sure:0}:{n:9,p:0,sure:0};
}
const pctTxt=p=>p<.001?'0.1%未満':(p*100).toFixed(p<.1?1:0)+'%';
const koLabel=k=>!k.n?'ダメージなし':k.n>8?'8発以上':k.p>=.9999?`確定${k.n}発`:`乱数${k.n}発（${pctTxt(k.p)}）${k.sure?`／確定${k.sure}発`:''}`;
const koShort=k=>!k.n||k.n>8?'—':(k.p>=.9999?'確':'乱')+k.n;

let CS=null;
function calcX(no,src){
  const p=byNo[no];const mine=team.some(t=>t.no===no);
  const c=(src!=='common'&&mine)?mySetFor(no):detSet(p),sv=setToSaved(p,c);
  return{no,src:(src!=='common'&&mine)?'mine':'common',ab:c.ab||'',item:c.item||'',sp:[...sv.sp],up:sv.up,dn:sv.dn,
    moves:(c.moves||[]).filter(m=>!m.prot&&m.pow>0),stg:{atk:0,def:0,spa:0,spd:0}};
}
function calcInit(){
  const a=team[0]?team[0].no:445,d=(team[1]&&team[1].no!==a)?149:(a===149?445:149);
  CS={a:calcX(a),d:calcX(d,'common'),mv:null,crit:false,spread:false,burn:false,screen:false,weather:'',aHP:100,dHP:100,dSt:'',cond:false,cnt:0};
  CS.mv=CS.a.moves[0]?CS.a.moves[0].id:null;
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
function calcResult(){
  const a=calcMon('me',CS.a),d=calcMon('op',CS.d);
  const list=calcMoveList(CS.a);let mv=list.find(m=>m.id===CS.mv)||list[0];if(!mv)return null;CS.mv=mv.id;
  const sw=B.weather;B.weather=CS.weather?{k:CS.weather,t:5}:null;
  try{
    const r=dmgRolls(a,mv,d,{crit:CS.crit,spread:FMT==='double'&&CS.spread,screen:CS.screen,cond:CS.cond,cnt:CS.cnt});
    return{a,d,mv,list,r,ko:koInfo(r,d.hp),eff:bcalc(a,mv,d,{}).eff,acc:accOf(a,mv,d)};
  }finally{B.weather=sw}
}
const monOpts=sel=>P.map(p=>`<option value="${p.no}"${p.no===sel?' selected':''}>${p.n}</option>`).join('');
function calcSide(key,X,isAtk){
  const p=byNo[X.no],abl=ABD[X.no]||[];
  const stat=isAtk?[1,3]:[0,2,4];
  const st=calcStats(p,X.sp,X.up,X.dn);
  const ks=[...Object.keys(MEGA).filter(k=>itemFor(X.no,k)),...Object.keys(ITEMN).filter(k=>!isStone(k))];
  return `<div class="cside">
  <div class="natr"><span style="width:62px">${isAtk?'攻撃側':'防御側'}</span><select class="sel" data-c="${key}.no">${monOpts(X.no)}</select></div>
  <div class="pills" style="padding:2px 16px 8px">${team.some(t=>t.no===X.no)?`<button class="pill" data-c="${key}.src" data-v="mine" aria-pressed="${X.src==='mine'}">あなたの育成</button>`:''}<button class="pill" data-c="${key}.src" data-v="common" aria-pressed="${X.src==='common'}">よくある型</button></div>
  <div class="natr"><span style="width:62px">特性</span><select class="sel" data-c="${key}.ab">${abl.length?abl.map(([k,h])=>`<option value="${k}"${k===X.ab?' selected':''}>${ABN[k]||k}${h?'（隠れ）':''}${ABIMPL.has(k)?'':'※計算外'}</option>`).join(''):`<option value="">（なし）</option>`}</select></div>
  <div class="natr"><span style="width:62px">持ち物</span><select class="sel" data-c="${key}.item"><option value="">（なし）</option>${ks.map(k=>`<option value="${k}"${k===X.item?' selected':''}>${ITEMN[k]}</option>`).join('')}</select></div>
  ${megaOf(X.no,X.item)?`<p class="note" style="padding:0 16px 6px;color:var(--acc)">${megaOf(X.no,X.item).n}の姿（特性：${ABN[megaOf(X.no,X.item).ab]||megaOf(X.no,X.item).ab}）で計算します</p>`:''}
  <div class="natr"><span style="width:62px">性格</span><select class="sel" data-c="${key}.nat">${NATS.map(([n,u,d],j)=>`<option value="${j}"${(u===X.up&&d===X.dn)||(u<0&&!(X.up>0))?' selected':''}>${n}${u>0?`（${SN[u]}↑${SN[d]}↓）`:''}</option>`).join('')}</select></div>
  <div class="cgrid">${stat.map(i=>`<label><span>${SN[i]} <b>${st[i]}</b></span><input type="number" min="0" max="${SP_CAP}" value="${X.sp[i]}" data-c="${key}.sp${i}" inputmode="numeric"><small>能力ポイント</small></label>`).join('')}
    ${(isAtk?[['atk','攻撃'],['spa','特攻']]:[['def','防御'],['spd','特防']]).map(([k,n])=>`<label><span>${n}ランク</span><select class="sel" data-c="${key}.stg.${k}">${[6,5,4,3,2,1,0,-1,-2,-3,-4,-5,-6].map(v=>`<option value="${v}"${v===(X.stg[k]||0)?' selected':''}>${v>0?'+'+v:v}</option>`).join('')}</select></label>`).join('')}</div>
  </div>`;
}
function calcView(){
  setHeader('ダメージ計算','#/tools');
  if(!CS)calcInit();
  const draw=()=>{
    const R=calcResult();
    const pct=v=>(v/R.d.max*100).toFixed(1);
    const lo=R?Math.min(...R.r):0,hi=R?Math.max(...R.r):0;
    V.innerHTML=`<div id="calc-root"><div class="fmtbar"><span>対戦の形式</span>${fmtSwitch()}</div>
    <p class="note" style="padding-top:4px">あなたのパーティの育成や、よく使われている型を使って、<b>乱数16段階</b>までのダメージを計算します。数字はすべて変えられます。</p>
    ${calcSide('a',CS.a,true)}
    <div class="natr"><span style="width:62px">技</span><select class="sel" data-c="mv">${R?R.list.map(m=>`<option value="${m.id}"${m.id===R.mv.id?' selected':''}>${m.n}（${m.t}・${['物理','特殊','変化'][m.cls]}・${['seismictoss','nightshade','superfang','endeavor','finalgambit'].includes(mkey(m))?'固定ダメージ':'威力'+(m.pow||'変動')}${m.maxH>1?(m.minH===m.maxH?'×'+m.maxH:'×2〜5'):''}）</option>`).join(''):''}</select></div>
    <div class="btns" style="padding:4px 16px"><button class="btn btn-s" id="c-swap">⇅ 攻守を入れ替える</button></div>
    ${calcSide('d',CS.d,false)}
    <div class="sec"><h2>条件</h2></div>
    <div class="pills" style="padding:0 16px 8px;flex-wrap:wrap">
      <button class="pill" data-t="crit" aria-pressed="${CS.crit}">急所</button>
      ${FMT==='double'?`<button class="pill" data-t="spread" aria-pressed="${CS.spread}">全体技が2匹に当たる（×0.75）</button>`:''}
      <button class="pill" data-t="screen" aria-pressed="${CS.screen}">${R&&R.mv.cls?'ひかりのかべ':'リフレクター'}（相手側）</button>
      <button class="pill" data-t="burn" aria-pressed="${CS.burn}">攻撃側がやけど</button></div>
    <div class="natr"><span style="width:62px">残りHP</span><label class="hpin">攻撃側<input type="number" min="1" max="100" value="${CS.aHP}" data-c="aHP" inputmode="numeric">%</label><label class="hpin">防御側<input type="number" min="1" max="100" value="${CS.dHP}" data-c="dHP" inputmode="numeric">%</label></div>
    <div class="natr"><span style="width:62px">状態</span><select class="sel" data-c="dSt">${[['','防御側：状態異常なし'],['brn','防御側：やけど'],['par','防御側：まひ'],['psn','防御側：どく'],['tox','防御側：もうどく'],['slp','防御側：ねむり'],['frz','防御側：こおり']].map(([k,n])=>`<option value="${k}"${k===CS.dSt?' selected':''}>${n}</option>`).join('')}</select></div>
    ${R&&MCOND[mkey(R.mv)]?`<div class="pills" style="padding:0 16px 8px"><button class="pill" data-t="cond" aria-pressed="${CS.cond}">${MCOND[mkey(R.mv)]}（威力2倍）</button></div>`:''}
    ${R&&MCOUNT[mkey(R.mv)]?`<div class="natr"><span style="width:62px">回数</span><select class="sel" data-c="cnt">${Array.from({length:MCOUNT[mkey(R.mv)][1]+1},(_,i)=>`<option value="${i}"${i===CS.cnt?' selected':''}>${MCOUNT[mkey(R.mv)][0]}：${i}</option>`).join('')}</select></div>`:''}
    <div class="natr"><span style="width:62px">天気</span><select class="sel" data-c="weather">${[['','なし'],['sun','はれ'],['rain','あめ'],['sand','すなあらし'],['snow','ゆき']].map(([k,n])=>`<option value="${k}"${k===CS.weather?' selected':''}>${n}</option>`).join('')}</select></div>
    ${R?`<div class="cres">
      <div class="cres-h">${R.a.p.n}の${R.mv.n} → ${R.d.p.n}</div>
      <div class="cres-big">${pct(lo)}%〜${pct(hi)}%</div>
      <div class="cres-s">${lo}〜${hi} ／ HP ${R.d.max}　${R.eff>=2?'<b style="color:#4ec98a">ばつぐん</b>':R.eff===0?'<b style="color:var(--w4)">こうかなし</b>':R.eff<1?'<b style="color:var(--w2)">いまひとつ</b>':''}${R.acc<100?`　命中${Math.round(R.acc)}`:''}</div>
      <div class="cbar"><i style="left:${Math.min(100,lo/R.d.max*100)}%;width:${Math.max(1,Math.min(100,hi/R.d.max*100)-Math.min(100,lo/R.d.max*100))}%"></i></div>
      <div class="cres-ko">${koLabel(R.ko)}${R.d.hp<R.d.max?`<small style="font-weight:500;color:var(--dim)">（残りHP ${R.d.hp}から）</small>`:''}</div>
      ${mvNote(R)?`<div class="cres-n">${mvNote(R)}</div>`:''}
      <details class="edd" style="margin:8px 0 0"><summary>乱数16段階のダメージ</summary><div class="crolls">${R.r.map((v,i)=>`<span>${85+i}%<b>${v}</b></span>`).join('')}</div></details>
    </div>
    <details class="edd cver" id="c-ver"${DVER.open?' open':''}><summary>ゲームの結果と照らし合わせる</summary>
      <p class="note" style="padding:6px 0 4px">上と同じ条件でゲーム内で技を当て、実際に減ったHPを入れてください。自分のポケモンが受けたときは数値、相手のときは％で入れます。</p>
      <div class="cver-r"><div class="pills" style="padding:0"><button class="pill" data-vu="n" aria-pressed="${DVER.unit==='n'}">数値</button><button class="pill" data-vu="p" aria-pressed="${DVER.unit==='p'}">％</button></div>
        <input type="number" id="c-obs" inputmode="decimal" min="0" placeholder="${DVER.unit==='n'?'例：'+R.r[8]:'例：'+pct(R.r[8])}" aria-label="ゲームで出たダメージ">
        <button class="btn btn-p" id="c-rec">記録</button></div>
      <div id="c-verdict" class="cver-v" aria-live="polite"></div>
      ${dvList()}
    </details>`:'<p class="empty">この組み合わせでは計算できる技がありません。</p>'}
    <p class="note" style="color:var(--mute)">Lv50で計算しています。計算の手順と端数の処理は本編（スカーレット・バイオレット）と同じ方式で、対戦で広く使われている計算機と1万通り以上の組み合わせで一致することを確かめています。メガストーンを持たせるとメガシンカ後の姿で計算します。急所・天気・やけど・ランク・壁・持ち物（こだわり系・いのちのたま・たつじんのおび・ちからのハチマキ・ものしりメガネ・タイプ強化・とつげきチョッキ・メガストーン）と、ダメージに関わる主な特性（メガシンカの特性を含む）に対応しています。けたぐり・ジャイロボール・ふんか・たたりめ・はたきおとす・ちきゅうなげなど、条件で威力やダメージが変わる技も、重さ・素早さ・残りHP・状態異常から計算します。連続技は回数をかけた目安です。オボンのみなどの回復は含みません。</p>
    ${srcLine('formula','calc')}
    </div>`;
    const root=document.getElementById('calc-root');
    root.querySelectorAll('[data-c]').forEach(el=>{
      const ev=el.tagName==='BUTTON'?'click':'change';
      el.addEventListener(ev,()=>{
        const [k1,k2,k3]=el.dataset.c.split('.');const v=el.dataset.v??el.value;
        if(k1==='mv'){CS.mv=+v}
        else if(k1==='weather'){CS.weather=v}
        else if(k1==='aHP'||k1==='dHP'){CS[k1]=Math.max(1,Math.min(100,+v||100))}
        else if(k1==='dSt'){CS.dSt=v}
        else if(k1==='cnt'){CS.cnt=+v}
        else{const X=CS[k1];
          if(k2==='no'){CS[k1]=calcX(+v,k1==='d'?'common':undefined);if(k1==='a')CS.mv=null;calcEnsure(+v)}
          else if(k2==='src'){CS[k1]=calcX(X.no,v);if(k1==='a')CS.mv=null}
          else if(k2==='ab')X.ab=v;
          else if(k2==='item')X.item=v;
          else if(k2==='nat'){const n=NATS[+v];X.up=n[1];X.dn=n[2]}
          else if(k2==='stg')X.stg[k3]=+v;
          else if(k2.startsWith('sp')){const i=+k2.slice(2),others=X.sp.reduce((s,x,j)=>j===i?s:s+x,0);X.sp[i]=Math.max(0,Math.min(+v||0,SP_CAP,SP_TOTAL-others))}
        }
        const y=scrollY;if(el.tagName==='INPUT')setTimeout(()=>{draw();scrollTo(0,y)},0);else{draw();scrollTo(0,y)}
      });
    });
    root.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{CS[b.dataset.t]=!CS[b.dataset.t];const y=scrollY;draw();scrollTo(0,y)});
    bindFmt(root,()=>{CS.a=calcX(CS.a.no,CS.a.src);CS.d=calcX(CS.d.no,CS.d.src);draw();calcEnsure(CS.a.no,CS.d.no).then(c=>{if(c&&keyOf(cur)==='calc'){CS.a=calcX(CS.a.no,CS.a.src);CS.d=calcX(CS.d.no,CS.d.src);draw()}})});
    calcVerBind(R,draw);
    document.getElementById('c-swap').onclick=()=>{const a=CS.a;CS.a=CS.d;CS.d=a;CS.mv=null;const y=scrollY;draw();scrollTo(0,y)};
  };
  draw();
  calcEnsure(CS.a.no,CS.d.no).then(ch=>{if(ch&&keyOf(cur)==='calc'){CS.a=calcX(CS.a.no,CS.a.src);CS.d=calcX(CS.d.no,CS.d.src);draw()}});
}
/* よくある型のためにラダー集計を読み込む（読み込めたら true） */
async function calcEnsure(...nos){
  try{if(!(await liveInit()))return false;const need=nos.filter(n=>LIVE.csv[n]===undefined);if(!need.length)return false;await Promise.all(need.map(liveMon));return true}catch(e){return false}
}

