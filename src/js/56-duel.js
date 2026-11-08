/* ===================== 1対1の判定（2026/11/06 ツールの精度を上げる） =====================
   選出アシストの基本選出（selPlan）・強いポケモンランキング（tierCompute）・戦術メモの下書き（memoAuto/memoPartyAuto）で
   別々に書いていた「お互いの最大ダメージから何回で倒せるか＋素早さ」を、ここ1か所にまとめて、次の点を足した。
   ・きあいのタスキ／がんじょう：HPが満タンなら一撃で倒せない（連続技・かたやぶりは別）
   ・マルチスケイル／ファントムガード：最初の1回はダメージが半分
   ・ばけのかわ：最初の1回は防がれる（1回ぶん多くかかる）。前は「ダメージ0＝倒せない」と数えていた
   ・命中：命中80%の技なら、倒すまでの回数を 1/0.8 倍に（外れる分だけ長くかかる）
   ・素早さ：特性・天気・こだわりスカーフ・まひ込み（effSpd）。同じ速さは五分
   ・先制技：遅くても、最後の1回を先制技でとどめにできるなら先に倒せる
   ・積み技：相手の攻撃を2回以上耐えられるなら、1回積んでから戦ったほうが早いか確かめる
   点（s）は前と同じく −2〜+2（+1以上＝有利、−1以下＝不利）。 */
const DU_SURV_AB=['sturdy'],DU_HALF_AB=['multiscale','shadow-shield'];
const DU_BOOST={swordsdance:[2,0],nastyplot:[2,0],tailglow:[3,0],bellydrum:[0,0],dragondance:[1,1],quiverdance:[1,1],shiftgear:[1,2],
  calmmind:[1,0],bulkup:[1,0],coil:[1,0],honeclaws:[1,0],howl:[1,0],workup:[1,0],growth:[1,0],victorydance:[1,0],tidyup:[1,1],
  shellsmash:[2,2],geomancy:[2,2],noretreat:[1,1],filletaway:[2,2],takeheart:[1,0],curse:[1,0]};
const duIg=a=>['mold-breaker','teravolt','turboblaze'].includes(a.ab);
const duStage=n=>(2+n)/2;
/* 倒すまでの回数（命中を入れた見込み） */
function duTurns(p,h,att,def){
  if(!p||p<=0)return 9;
  const multi=!!(h&&h.mv&&h.mv.maxH>1),ig=duIg(att);
  let n;
  if(!ig&&DU_HALF_AB.includes(def.ab)){const f=p/2;n=f>=100?1:1+Math.ceil((100-f)/p)}else n=Math.ceil(100/p);
  if(n===1&&!multi&&(def.item==='focussash'||(!ig&&DU_SURV_AB.includes(def.ab))))n=2;
  if(!ig&&def.ab==='disguise')n+=1;
  const acc=Math.max(30,(h&&h.acc)||100);
  return Math.min(9,acc<100?n*100/acc:n);
}
/* 先制技でいちばん強いもの（ダメージの割合） */
function duPrio(a,d){
  let best=0;const dg=d.disg;d.disg=false;
  try{a.moves.forEach(mv=>{if(!mv||mv.prot||!(mv.pri>0)||!(mv.pow>0))return;const r=bcalc(a,mv,d,{});best=Math.max(best,r.dmg/d.max*100)})}catch(e){}
  d.disg=dg;return best;
}
function duSetup(a){const k=a.boost;if(!k||!DU_BOOST[k]||k==='bellydrum')return null;const id=Object.keys(MD).find(i=>MD[i][3]===k);return{k,b:DU_BOOST[k],n:id?mName(+id):k}}
/* 先に倒せるのはどちらか：1＝a、−1＝o、0＝五分 */
function duFirst(sa,so,mt,ot,pa,po,ha,ho){
  let f=sa>so?1:sa<so?-1:0;
  const fin=(p,pr,n)=>pr>0&&(Math.ceil(n)-1)*p+pr>=100;
  const fa=fin(ha,pa,mt),fo=fin(ho,po,ot);
  if(f<=0&&fa&&!fo)f=1;else if(f>=0&&fo&&!fa)f=-1;
  return f;
}
function duel(a,o){return withWx(a,o,()=>duel0(a,o))}
function duel0(a,o){
  const h=estHit(a,o),r=estHit(o,a);
  let mt=duTurns(h.pct,h,a,o),ot=duTurns(r.pct,r,o,a);
  const pa=duPrio(a,o),po=duPrio(o,a);
  const sa=effSpd(a),so=effSpd(o);
  let f=duFirst(sa,so,mt,ot,h.pct,r.pct,pa,po);
  let up=null;
  /* 積み技：相手の攻撃を2回以上耐えられるなら、1回積んでから */
  const tryUp=(x,y,hx,mx,my,px,first,sx,sy,dir)=>{
    const s=duSetup(x);if(!s||my<3)return null;
    const pct=hx.pct*duStage(s.b[0]),m2=1+duTurns(pct,hx,x,y),sx2=s.b[1]?Math.floor(sx*duStage(s.b[1])):sx;
    const f2=sx2>sy?1:sx2<sy?-1:0;
    const before=(my-mx)+first*.5*dir,after=(my-m2)+f2*.5*dir;
    return after>before+.25?{m:m2,f:f2,mv:s.n}:null};
  const ua=tryUp(a,o,h,mt,ot,pa,f,sa,so,1);if(ua){mt=ua.m;f=ua.f;up=ua.mv}
  const uo=tryUp(o,a,r,ot,mt,po,-f,so,sa,1);if(uo){ot=uo.m;f=-uo.f}
  const s=Math.max(-2,Math.min(2,(ot-mt)+f*.5));
  return{s,mt,ot,f,h,r,up,oup:uo?uo.mv:null};
}
const duelS=(a,o)=>{try{return duel(a,o).s}catch(e){return 0}};
