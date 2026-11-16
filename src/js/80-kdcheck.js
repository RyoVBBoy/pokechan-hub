/* ===================== こだわり条件で組む：型の作り方と、できあがった6匹の確かめ（2026/11/15 依頼主「Fix Team Generation and Pokémon Set Generation」） =====================
   58-kodawari.js の kdBuild が6匹を選んだあと、ここで
   ①1匹ずつの型（技・特性・持ち物・性格・能力ポイント）を、まず同じ形式の使用データ（76-mvp.js の mvpSet＝PokéKit の集計）から、なければ当サイトが計算で組む型（40-guide-builds.js の archSet）から作る。
     どちらも「1つのまとまり」として確かめ直す（kdIssues/kdRepair）：覚える技か・特性と持ち物がゲームにあるか・こだわりスカーフと変化技・積み技と攻撃技の種類・
     性格で下げた能力の技・持ち物が働く技があるか（15-battle.js の lfReq）・攻める構築で変化技が多すぎないか。直したところは型の説明に残す。
   ②構築のタイプ・こだわり条件を、決まった数で確かめられる条件（KD_REQ）にして、6匹と型が決まってから確かめる（kdValidate）。
     メガシンカは1試合に1匹なので、メガストーンを持つ匹ごとに「その1匹だけがメガシンカ」の場合を別々に確かめる（mvpEvalTeam と同じ考え方）。
   ③「先に動く手段」は、先制技・こだわりスカーフ・もともとの速さ・素早さを変える技を分けて数える。条件は「先制技を1匹以上の技に入れる」（ほかの手段だけでは満たしたことにしない）。
   ④「弱点を受け合える」は、タイプ相性だけでなく、上位の相手が実際に使うそのタイプの技を受けたときのダメージ（60-diag.js の dgMove）で確かめる。
     受けられる（いちばん高い乱数で50%未満）・大きく削られる・受けられない・確かめられない（上位の相手にそのタイプの技が無い）を分ける。
     上から倒せる（攻めて返す）匹は、受け出せる匹とは別に書く。 */

/* 1ターン目しか出せない・威力が低いので「先に動く手段」に数えない先制技 */
const KD_PRIO_NG=new Set(['fakeout','firstimpression','feint']);
/* 型の候補に入れない攻撃技（ためる・反動で動けない・自分が倒れる・前のターンしだい等。型の技として筋が通らないもの） */
const KD_ATK_NG=new Set(['focuspunch','solarbeam','solarblade','skyattack','meteorbeam','electroshot','hyperbeam','gigaimpact','blastburn','frenzyplant','hydrocannon','rockwrecker',
  'explosion','selfdestruct','mistyexplosion','finalgambit','lastresort','belch','futuresight','doomdesire','counter','mirrorcoat','metalburst','spitup','fling','dig','dive','fly','bounce',
  'phantomforce','beakblast','uproar','synchronoise','firstimpression','fakeout','feint','dreameater','snore','steelbeam','mindblown','struggle','naturalgift','shelltrap','burnup','doubleshock']);
/* 計算で組む理論上の型からは外す技（使用データの型には入っていればそのまま） */
const KD_ATK_BAD=new Set(['focuspunch','solarbeam','solarblade','skyattack','meteorbeam','electroshot','hyperbeam','gigaimpact','blastburn','frenzyplant','hydrocannon','rockwrecker',
  'explosion','selfdestruct','mistyexplosion','finalgambit','lastresort','belch','beakblast','synchronoise','dreameater','snore','steelbeam','mindblown','naturalgift','shelltrap','burnup','doubleshock']);
/* 素早さを変える技（相手を遅くする・自分たちを速くする）と、素早さが上がる特性 */
const KD_SPDCTL=['tailwind','trickroom','icywind','electroweb','thunderwave','stickyweb','rocktomb','bulldoze','nuzzle','glare','lowsweep','scaryface','stringshot','mudshot'];
const KD_SPDUP=['dragondance','quiverdance','shellsmash','agility','rockpolish','flamecharge','trailblaze','shiftgear','autotomize','aquastep','victorydance','esperwing'];
const KD_SPDAB={'speed-boost':'かそく','unburden':'かるわざ',chlorophyll:'ようりょくそ（はれ）','swift-swim':'すいすい（あめ）','sand-rush':'すなかき（すな）','slush-rush':'ゆきかき（ゆき）'};
/* 積み技が上げる攻撃の種類（0 物理・1 特殊・2 両方） */
const KD_SETUP_CLS={swordsdance:0,bulkup:0,dragondance:0,coil:0,bellydrum:0,howl:0,meditate:0,honeclaws:0,shiftgear:0,victorydance:0,tidyup:0,
  nastyplot:1,calmmind:1,quiverdance:1,tailglow:1,geomancy:1,torchsong:1,takeheart:1,shellsmash:2,growth:2,workup:2,curse:0,noretreat:2,clangoroussoul:2,filletaway:2};
/* 攻撃の種類が自分の能力を使わない技（性格・能力ポイントの食い違いに数えない） */
const KD_CLS_FREE=new Set(['foulplay','bodypress','seismictoss','nightshade','superfang','ruination','naturesmadness','endeavor','psywave','guardianofalola','dragonrage','sonicboom']);
const KD_HEAL=['recover','roost','slackoff','milkdrink','morningsun','synthesis','moonlight','softboiled','shoreup','strengthsap','wish','rest','junglehealing','lifedew','lunarblessing'];
const KD_UTIL_OK=new Set(['protect','detect','kingsshield','spikyshield','banefulbunker','silktrap','substitute']);
const kdMvK=id=>id===182?'protect':(MD[id]&&MD[id][3])||'';
const kdAtk=id=>!!(MV[id]&&MV[id][2]>0);
const kdHits=id=>{const o=mvObj(id);return o.maxH>1?(o.minH===o.maxH?o.maxH:3):1};
const kdPrioMv=id=>kdAtk(id)&&MV[id][5]>0&&!KD_PRIO_NG.has(kdMvK(id))&&MV[id][2]*kdHits(id)>=40;
const kdLs=p=>(LSD[p.no]||(p.base&&LSD[p.base])||[0,[]])[1];
const kdKey2Id=k=>PR_KEY(k)||(k==='protect'?182:null);
/* その型のときの姿（メガストーンならメガの姿） */
const kdForm=(p,s)=>(s&&s.item&&megaOf(p.no,s.item))||p;
/* 物理の型か：能力ポイント→性格→技の数→種族値の順で決める */
function kdPhys(p,s){
  const f=kdForm(p,s);if(s&&s.sp){if(s.sp[1]>s.sp[3])return true;if(s.sp[3]>s.sp[1])return false}
  if(s&&s.up===1)return true;if(s&&s.up===3)return false;
  const at=(s?s.moves:[]).filter(kdAtk),ph=at.filter(id=>MV[id][4]===0).length,sp=at.filter(id=>MV[id][4]===1).length;
  return ph!==sp?ph>sp:f.s[1]>=f.s[3];
}
const kdAtkN=s=>(s?s.moves:[]).filter(kdAtk).length;
/* 攻撃役か（その型の姿で攻撃か特攻が100以上で、攻撃技が2つ以上） */
const kdIsAttacker=(p,s)=>kdAtkN(s)>=2&&prAtk(kdForm(p,s))>=100;
/* 覚える攻撃技のうち、いまの技と並べていちばん良いもの（タイプ一致・新しく突けるタイプ・同じタイプは下げる）。cls＝0 物理・1 特殊 */
function kdAtkPick(p,have,cls,ng){
  const cov=new Set();have.forEach(id=>{if(kdAtk(id))T.forEach(d=>{if(mult(MV[id][1],[d])>=2)cov.add(d)})});
  let best=null;
  kdLs(p).forEach(id=>{if(have.includes(id)||(ng&&ng.has(id))||!kdAtk(id))return;const m=MV[id];if(cls!=null&&m[4]!==cls&&!KD_CLS_FREE.has(kdMvK(id)))return;
    if(KD_ATK_NG.has(kdMvK(id)))return;
    const o=mvObj(id),same=have.some(h=>kdAtk(h)&&MV[h][1]===m[1]),nc=T.filter(d=>!cov.has(d)&&mult(m[1],[d])>=2).length;
    const v=Math.min(m[2]*kdHits(id),160)*Math.min(o.acc||100,100)/100*(p.t.includes(m[1])?1.5:1)*(1+.12*nc)*(same?.35:1)*(o.drain<0?.92:1);
    if(!best||v>best.v)best={id,v}});
  return best?best.id:null;
}
/* 持ち物がその型で働くか（15-battle.js の lfReq と、種類の決まった強化の持ち物） */
function kdItemWorks(p,s,it){
  if(!it)return true;if(isStone(it))return !!megaOf(p.no,it);
  const mv=s.moves.map(id=>({k:kdMvK(id),id})),at=s.moves.filter(kdAtk),abs=new Set([s.ab].filter(Boolean));
  const cl=c=>at.filter(id=>MV[id][4]===c&&!KD_CLS_FREE.has(kdMvK(id))).length;
  if(it==='wiseglasses')return cl(1)>=2;if(it==='muscleband')return cl(0)>=2;
  if(it==='lifeorb')return at.length>=2;if(it==='expertbelt')return new Set(at.map(id=>MV[id][1])).size>=2;
  if(it==='choicescarf')return at.length>=3;
  const r=typeof lfReq==='function'?lfReq(it,p,abs):null;if(!r)return true;
  if(r.ok)return r.ok();return (r.ab&&r.ab.some(a=>abs.has(a)))||mv.some(r.mv);
}
/* 型の気になるところ（直すもの）。ctx.off＝攻める構築（変化技は1つまで）、ctx.keep＝構築の役わりで入れた技 */
function kdIssues(p,s,ctx){
  ctx=ctx||{};const out=[],ls=kdLs(p),f=kdForm(p,s);
  const keys=s.moves.map(kdMvK);
  s.moves.forEach(id=>{if(id!==182&&!ls.includes(id))out.push({k:'learn',id,txt:`${mName(id)}を覚えない`})});
  if(new Set(s.moves).size!==s.moves.length)out.push({k:'dup',txt:'同じ技が2つある'});
  const abOk=f!==p?true:(ABD[p.no]||[]).some(a=>a[0]===s.ab);if(s.ab&&!abOk)out.push({k:'ab',txt:`特性${ABN[s.ab]||s.ab}を持てない`});
  if(s.item&&!(CH_ITEMS.has(s.item)||(isStone(s.item)&&megaOf(p.no,s.item))))out.push({k:'item',txt:`${ITEMN[s.item]||s.item}はこのポケモンが持てる、ゲームにある持ち物ではない`});
  if(!s.moves.some(kdAtk))out.push({k:'atk0',txt:'攻撃技が無い'});
  if(s.src==='theory')s.moves.filter(id=>KD_ATK_BAD.has(kdMvK(id))&&!(ctx.keep||[]).includes(id)).forEach(id=>out.push({k:'bad',id,txt:`${mName(id)}は、ためる・反動で動けない・自分が倒れる等で型の技として使いにくい`}));
  if(s.item==='choicescarf'){const bad=s.moves.filter(id=>!kdAtk(id)&&!LF_CHOICE_OK.includes(kdMvK(id)));if(bad.length)out.push({k:'choice',ids:bad,txt:`こだわりスカーフでは同じ技しか出せないので、${bad.map(mName).join('・')}は使いにくい`})}
  const phys=kdPhys(p,s),at=s.moves.filter(kdAtk);
  /* 使用データで実際に使われている技（その匹の行にある技）は、積み技・攻撃の種類の食い違いとして直さない（アシレーヌのアクアジェット等）。のろいはゴーストタイプなら積み技ではない */
  const real=id=>s.src==='top'||(s.src==='data'&&kdRowPc(s,'mv',id)!=null);
  s.moves.forEach(id=>{if(real(id))return;const c=kdMvK(id)==='curse'&&f.t.includes('ゴースト')?null:KD_SETUP_CLS[kdMvK(id)];if(c==null||c===2)return;if(!at.some(a=>MV[a][4]===c&&!KD_CLS_FREE.has(kdMvK(a))))out.push({k:'setup',id,txt:`${mName(id)}で上がる${c?'特攻':'攻撃'}を使う技が無い`})});
  /* 性格で下げた能力の技（例：おくびょう＝攻撃↓ に物理技） */
  const lowCls=s.dn===1?0:s.dn===3?1:null;
  at.forEach(id=>{const c=MV[id][4];if(KD_CLS_FREE.has(kdMvK(id))||real(id))return;
    if((lowCls!=null&&c===lowCls)||(s.sp&&((c===0&&s.sp[1]===0&&s.sp[3]>0)||(c===1&&s.sp[3]===0&&s.sp[1]>0))&&(c===0?f.s[1]<f.s[3]*.9:f.s[3]<f.s[1]*.9)))
      out.push({k:'cls',id,txt:`${mName(id)}は${c?'特殊':'物理'}技だが、${lowCls===c?'性格で'+(c?'特攻':'攻撃')+'を下げている':(c?'特攻':'攻撃')+'に能力ポイントを振っていない'}`})});
  if(s.item&&!isStone(s.item)&&!kdItemWorks(p,s,s.item))out.push({k:'itemreq',txt:`${ITEMN[s.item]||s.item}が働く技・特性が無い`});
  if(ctx.off&&s.src==='theory'){const st=s.moves.filter(id=>!kdAtk(id)&&!KD_UTIL_OK.has(kdMvK(id))&&!(KD_SETUP_CLS[kdMvK(id)]!=null)&&!(ctx.keep||[]).includes(id));
    if(st.length>=2||(st.length&&s.moves.filter(id=>!kdAtk(id)).length>=3))out.push({k:'off',ids:st.slice(st.length>=2?1:0),txt:`攻める構築なのに変化技（${st.map(mName).join('・')}）が多い`})}
  return out;
}
const kdAltItems=(p,s,role)=>{const ph=kdPhys(p,s),stab=s.moves.filter(id=>kdAtk(id)&&p.t.includes(MV[id][1])).map(id=>TYPE_ITEM[MV[id][1]]).filter(Boolean);
  return role==='def'?['leftovers','sitrusberry','rockyhelmet','lumberry','shellbell']:['lifeorb','expertbelt',ph?'muscleband':'wiseglasses',...stab,'focussash','sitrusberry','lumberry','leftovers','shellbell']};
/* 型を直す（覚えない技を外す・こだわりスカーフの変化技・積み技の食い違い・持ち物が働かない…）。直したことは s.fixes に書く */
function kdRepair(p,s,ctx,used){
  ctx=ctx||{};s.fixes=s.fixes||[];const keep=ctx.keep||[];
  for(let loop=0;loop<6;loop++){
    const is=kdIssues(p,s,ctx);if(!is.length)break;let ch=false;
    const ng=new Set(s.moves);
    const swap=(id,why)=>{const i=s.moves.indexOf(id);if(i<0)return;const n=kdAtkPick(p,s.moves.filter(x=>x!==id),kdPhys(p,s)?0:1,ng);
      if(n){s.moves[i]=n;ng.add(n);s.fixes.push(`${mName(id)}→${mName(n)}（${why}）`)}else{s.moves.splice(i,1);s.fixes.push(`${mName(id)}を外した（${why}）`)}ch=true};
    for(const x of is){
      if(x.k==='learn'){s.moves=s.moves.filter(id=>id!==x.id);s.fixes.push(`覚えない${mName(x.id)}を外した`);ch=true}
      else if(x.k==='dup'){s.moves=[...new Set(s.moves)];ch=true}
      else if(x.k==='ab'){const a=(ABD[p.no]||[])[0];s.ab=a?a[0]:null;s.fixes.push('持てる特性にした');ch=true}
      else if(x.k==='item'){used&&used.delete(s.item);s.item=null;ch=true}
      else if(x.k==='atk0'){const n=kdAtkPick(p,s.moves,kdPhys(p,s)?0:1);if(n){if(s.moves.length>=4)s.moves[3]=n;else s.moves.push(n);s.fixes.push(`攻撃技（${mName(n)}）を入れた`);ch=true}}
      else if(x.k==='choice'){
        /* 構築の役わりの技（あまごい等）が変化技なら、技ではなく持ち物を変える */
        if(x.ids.some(id=>keep.includes(id))){used&&used.delete(s.item);s.item=null;s.fixes.push('こだわりスカーフでは構築の役わりの技が使いにくいので、持ち物を変えた');ch=true}
        else x.ids.forEach(id=>swap(id,'こだわりスカーフでは使いにくい'))}
      else if(x.k==='setup'&&!keep.includes(x.id))swap(x.id,'上がる能力を使う技が無い');
      else if(x.k==='bad')swap(x.id,'使いにくい技');
      else if(x.k==='cls'&&!keep.includes(x.id))swap(x.id,'能力の振り方と合わない');
      else if(x.k==='off')x.ids.forEach(id=>swap(id,'攻める構築なので攻撃技に'));
      else if(x.k==='itemreq'){const o=s.item;used&&used.delete(o);s.item=null;ch=true;s.fixes.push(`${ITEMN[o]||o}は働く技が無いので外した`)}
      if(ch)break}
    if(!ch)break}
  while(s.moves.length<4){const n=kdAtkPick(p,s.moves,kdPhys(p,s)?0:1);if(!n)break;s.moves.push(n)}
  /* 持ち物が無くなったら、型に合う、ほかの匹と重ならない持ち物 */
  if(!s.item&&used){const role=prBulk(kdForm(p,s))>=95*95&&!kdIsAttacker(p,s)?'def':'atk';
    const k=kdAltItems(p,s,role).find(k=>k&&CH_ITEMS.has(k)&&!used.has(k)&&kdItemWorks(p,s,k));if(k){s.item=k;used.add(k);s.fixes.push(`持ち物を${ITEMN[k]}にした`)}}
  return s;
}
/* 1匹の型を作る。stone＝持たせるメガストーン、pt＝構築の役わり（入れる技 pt[4]）、aa＝ARCHS の型、ctx.given＝上位パーティに登録された型。
   型の出どころ src（2026/11/15 依頼主「上位構築・実戦データ」）：
     top＝上位パーティに登録された型（技・持ち物・特性・能力ポイントをまとめて使う。決まりに合わないところだけ直す）
     data＝同じ形式の PokéKit の集計（割合の高い特性・持ち物・技・性格と、いちばん多い能力ポイントの配分）。
          メガシンカしない姿の行が無く、メガシンカ後の行だけがある匹（アブソル→メガアブソルZ 等）は、メガシンカ後の行の技・能力ポイントを参考にする
     theory＝どちらも無い匹は、当サイトが計算で組んだ理論上の型 */
function kdMakeSet(p,stone,pt,aa,used,ctx){
  ctx=ctx||{};let s=null;
  const g=ctx.given;
  if(g&&Array.isArray(g.mv)&&g.mv.filter(x=>x&&x.id).length>=2){
    const it=g.it&&g.it.k||null;
    s={ab:g.ab&&g.ab.k||((ABD[p.no]||[])[0]||[])[0]||null,item:stone||(it&&!isStone(it)?it:null),up:g.up??-1,dn:g.dn??-1,sp:Array.isArray(g.sp)?[...g.sp]:null,
      moves:g.mv.map(x=>x&&x.id).filter(Boolean).slice(0,4),src:'top',srcTxt:ctx.givenTxt||'上位パーティに登録された型',notes:[],fixes:[]};
    if(it&&isStone(it)&&it!==stone)s.fixes.push(`登録の${ITEMN[it]||it}はメガシンカの数に合わせて持たせていない`);
    if(!s.sp){const r=kdRowFor(p.no,stone);if(r&&r.row.sp&&r.row.sp.length){kdApplySp(s,r.row);s.fixes.push('登録に能力ポイントが無いので、使用データでいちばん多い配分にした')}
      else{const ph=kdPhys(p,s);s.sp=[...(ph?MVP_SP.phys:MVP_SP.spec)];s.fixes.push('登録に能力ポイントが無いので、仮の振り方にした')}}
  }
  if(!s&&typeof mvpSet==='function'){
    const R=kdRowFor(p.no,stone,used);
    if(R){const m=R.m,sv=m.sv;
      s={ab:sv.ab.k,item:stone||(R.conflict||R.via==='mega'?null:sv.it&&sv.it.k)||null,up:sv.up,dn:sv.dn,sp:[...sv.sp],moves:sv.mv.map(v=>v.id).slice(0,4),src:'data',row:R.row,
        srcTxt:`${kdMetaTxt(FMT)}で割合の高い特性・持ち物・技・性格${R.via==='base'?'（メガシンカの行が無いので元の姿の行）':R.via==='mega'?`（メガシンカしない姿の行が無いので、${(byNo[R.row.mega]||{}).n||'メガシンカ後'}の行の技・能力ポイントを参考）`:''}`,notes:[...(m.notes||[])],fixes:[]};
      if(R.conflict)s.fixes.push('いちばん多い持ち物がほかの匹と重なるので、持ち物を選び直した');
      if(R.via==='base'&&stone){const mg=megaOf(p.no,stone);if(mg)s.ab=mg.ab}
      if(R.via==='mega'){const a0=((ABD[p.no]||[]).find(a=>!a[1])||(ABD[p.no]||[])[0]||[])[0];s.ab=a0||null;s.fixes.push(`特性はメガシンカしない姿の${ABN[s.ab]||'特性'}（メガシンカ後の特性は使えない）`)}
      if(kdApplySp(s,R.row))s.srcTxt+=`・能力ポイントは集計でいちばん多い配分（${R.row.sp[0][2]}%。決まりに合う形だが、能力ポイントそのものかは未確認）`;else s.srcTxt+='・能力ポイントは仮定'}
  }
  if(!s){let a=null;try{a=archSet(aa,p,pt,new Set(used))}catch(e){a=null}
    if(!a){const c=chooseSet(p,true),phys=p.s[1]>=p.s[3];a={ab:c.ab,item:null,moves:c.moves.map(m=>m.id).filter(id=>id>0),up:phys?1:3,dn:phys?3:1,sp:phys?[...MVP_SP.phys]:[...MVP_SP.spec]}}
    s={ab:a.ab,item:stone||(a.item&&!isStone(a.item)?a.item:null),up:a.up,dn:a.dn,sp:[...(a.sp||[])],moves:[...a.moves],src:'theory',
      srcTxt:`${FMTN()}の使用データ・上位パーティにこのポケモン${stone?'（メガシンカ）':''}の型が無いので、当サイトが種族値・覚える技から計算で組んだ理論上の型（実際に使われた型ではありません）`,notes:[],fixes:[]}}
  /* 型の出どころ（82-prov.js）：上位パーティに登録された型（確認の状態つき）／PokéKit の集計の型（外部の参考）／当サイトの計算 */
  if(typeof mkProv==='function'&&!s.prov)s.prov=s.src==='top'?(ctx.givenProv||mkProv({s:'season',f:FMT})):s.src==='data'?provPokekit(FMT):mkProv({s:'calc',f:FMT});
  if(stone){s.item=stone}
  if(s.item&&used&&used.has(s.item)&&!isStone(s.item))s.item=null;
  /* 構築の役わりの技（トリックルーム・あまごい等）が無ければ入れる */
  const keep=[];
  if(pt&&pt[4]){const want=pt[4].map(kdKey2Id).filter(id=>id&&(kdLs(p).includes(id)||id===182));
    const has=s.moves.filter(id=>want.includes(id));const ab=pt[3]&&(pt[3].includes(s.ab)||(stone&&megaOf(p.no,stone)&&pt[3].includes(megaOf(p.no,stone).ab)));
    if(!ab){const add=want.filter(id=>!has.includes(id)).slice(0,Math.max(0,(pt[5]||1)-has.length));
      add.forEach(id=>{const i=[...s.moves.keys()].reverse().find(i=>!want.includes(s.moves[i])&&!(kdAtk(s.moves[i])&&p.t.includes(MV[s.moves[i]][1])&&s.moves.filter(x=>kdAtk(x)&&p.t.includes(MV[x][1])).length===1));
        if(s.moves.length<4)s.moves.push(id);else if(i!=null){s.fixes.push(`${mName(s.moves[i])}→${mName(id)}（構築の役わり「${pt[0]}」）`);s.moves[i]=id}});
      keep.push(...s.moves.filter(id=>want.includes(id)))}}
  s.keep=keep;
  kdRepair(p,s,{...ctx,keep},used);
  if(s.item&&used)used.add(s.item);
  return s;
}
/* 1つの技を入れる（入れる匹は ok(p,s) を満たす中から、選んだ技の価値 v が高い匹）。入れかえるのは、役わりの技でも1つだけのタイプ一致技でもない、いちばん価値の低い技 */
function kdPutMove(mons,ss,pick,why){
  let best=null;
  mons.forEach((p,i)=>{const s=ss[i];if(!s)return;const c=pick(p,s);if(!c)return;if(!best||c.v>best.v)best={i,...c}});
  if(!best)return null;
  const p=mons[best.i],s=ss[best.i],keep=s.keep||[];
  const stabOnly=id=>kdAtk(id)&&p.t.includes(MV[id][1])&&s.moves.filter(x=>kdAtk(x)&&MV[x][1]===MV[id][1]).length===1;
  const val=id=>!kdAtk(id)?(KD_UTIL_OK.has(kdMvK(id))||KD_SETUP_CLS[kdMvK(id)]!=null?50:20):Math.min(MV[id][2]*kdHits(id),160)*(p.t.includes(MV[id][1])?1.5:1);
  const cands=s.moves.map((id,k)=>({id,k})).filter(x=>!keep.includes(x.id)&&!stabOnly(x.id)).sort((a,b)=>val(a.id)-val(b.id));
  if(s.moves.length<4)s.moves.push(best.id);else if(cands.length){s.fixes.push(`${mName(cands[0].id)}→${mName(best.id)}（${best.why||why}）`);s.moves[cands[0].k]=best.id}else return null;
  s.keep=[...keep,best.id];return best.i;
}
/* 先制技を入れる：その型の攻撃の種類に合う、タイプ一致・威力の高い先制技。遅い匹ほど価値が高い */
/* 使用データ（その匹の行）での技・持ち物の割合。無ければ null */
const kdRowPc=(s,kind,key)=>{const r=s&&s.row;if(!r)return null;const l=kind==='it'?r.it:r.mv;const z=(l||[]).find(([k])=>kind==='it'?k===key:MVKA[nrm(k)]===key);return z?z[1]:null};
/* 持ち物を持たせる匹の選び方の補正：使用データでもその持ち物を持つ匹を先に、実際の型（上位パーティ・使用データ）を崩す匹は後に */
const kdItemAdj=(s,item)=>{const pc=kdRowPc(s,'it',item);return pc!=null?60+pc/2:s&&s.src!=='theory'?-40:0};
function kdPrioPut(mons,ss){
  return kdPutMove(mons,ss,(p,s)=>{const ph=kdPhys(p,s);let b=null;
    kdLs(p).forEach(id=>{if(!kdPrioMv(id)||s.moves.includes(id))return;const m=MV[id];if(m[4]!==(ph?0:1))return;
      /* 実際の型の匹は、使用データでもその先制技を使っていれば先に（割合を理由に書く）、使っていなければ後に（型を崩さないため） */
      const pc=kdRowPc(s,'mv',id),adj=pc!=null?1.3+pc/100:s.src!=='theory'?.4:1;
      const v=m[2]*kdHits(id)*(p.t.includes(m[1])?1.5:1)*(1+Math.max(0,110-kdForm(p,s).s[5])/100)*adj;if(!b||v>b.v)b={id,v,why:pc!=null?`先に動く手段（先制技）。使用データでも${pc}%が採用`:null}});return b},'先に動く手段（先制技）');
}
/* 回復技・設置技を消す技を入れる */
const kdKeyPut=(mons,ss,keys,why)=>kdPutMove(mons,ss,(p,s)=>{const ids=keys.map(kdKey2Id).filter(id=>id&&kdLs(p).includes(id)&&!s.moves.includes(id));
  return ids.length?{id:ids[0],v:prBulk(kdForm(p,s))/100+(kdIsAttacker(p,s)?0:30)}:null},why);

/* ---------- 構築のタイプを、決まった数で確かめられる条件にする ----------
   need＝その数以上、per＝メガシンカの場合ごとに確かめる、how＝何を数えるか（画面に出す） */
const KD_REQ={
  rush:[{id:'rushFast',need:3,per:true,sup:['速いアタッカー','速くて強いアタッカー'],label:'速いアタッカーが3匹以上',how:'上位の相手の半分より多くに素早さで先に動ける（こだわりスカーフ込み）攻撃役'},
        {id:'rushItem',need:2,label:'こだわりスカーフ・きあいのタスキのアタッカーが2匹以上',how:'速攻構築の説明どおり、スカーフで上から攻める匹と、タスキで1回耐えて倒す匹（同じ持ち物は1匹まで）'}],
  taimen:[{id:'atk',need:4,sup:[],label:'攻撃役が4匹以上',how:'攻撃技が2つ以上で、攻撃か特攻が100以上'}],
  bulkyface:[{id:'bulkyAtk',need:3,sup:['硬いアタッカー'],label:'硬いアタッカーが3匹以上',how:'HP×防御・特防の平均が硬め（90×90以上）で、攻撃か特攻が100以上の攻撃役'}],
  ofcycle:[{id:'pivotMv',need:2,label:'交代技を持つ匹が2匹以上',how:'型の技に とんぼがえり・ボルトチェンジ等'},{id:'atk',need:3,label:'攻撃役が3匹以上',how:'攻撃技が2つ以上で、攻撃か特攻が100以上'}],
  pivot:[{id:'pivotMv',need:2,label:'交代技を持つ匹が2匹以上',how:'型の技に とんぼがえり・ボルトチェンジ等'}],
  defcycle:[{id:'wall',need:3,label:'受け役が3匹以上',how:'HP×防御・特防の平均が95×95以上'},{id:'healMv',need:2,label:'回復できる匹が2匹以上',how:'型の技に回復技、または特性さいせいりょく'}],
  tr:[{id:'trSlow',need:3,sup:['遅くて強いアタッカー'],label:'遅いアタッカーが3匹以上',how:'その姿の素早さ種族値60以下の攻撃役'}]};
/* 入れかえで直せる条件と、その条件に合う候補か */
const KD_REVISE=new Set(['rushFast','rushItem','atk','bulkyAtk','wall','trSlow','resistType','resistReal','prio','pivotMv','healMv','heal','clear','mid','immune','balance','phys','spec']);
function kdReviseFit(c,ids,V){
  const has=k=>ids.has(k);
  if((has('rushFast')||has('rushItem'))&&kdFastAtk(c))return true;
  if(has('atk')&&prAtk(c)>=105)return true;
  if(has('bulkyAtk')&&prAtk(c)>=100&&prBulk(c)>=90*90)return true;
  if(has('wall')&&prBulk(c)>=95*95)return true;
  if(has('trSlow')&&c.s[5]<=60&&prAtk(c)>=100)return true;
  if(has('prio')&&kdPrioUse(c))return true;
  if(has('pivotMv')&&kdK(c,PR_PIV))return true;
  if((has('healMv')||has('heal'))&&kdHeal(c))return true;
  if(has('clear')&&kdK(c,LS_CLEAR))return true;
  if(has('mid')&&c.s[5]>=100&&c.s[5]<=130)return true;
  if(has('immune')&&monDef(c).some(z=>z.m===0))return true;
  if((has('resistType')||has('resistReal'))&&V.cover&&prBulk(c)>=85*85)
    return V.cover.some(k=>k.types.some(x=>x.weak.length>=2&&!x.cov.some(z=>z.st==='ok'||z.st==='nodata')&&prDef(c)[x.t]<=.5));
  return false;
}
const KD_REQ_HINT={rushFast:'構築のタイプを「対面＞スタンダード」にする',rushItem:'構築のタイプを「対面＞スタンダード」にする',atk:'構築のタイプを「おまかせ」にする',bulkyAtk:'構築のタイプを「対面＞スタンダード」にする',
  pivotMv:'構築のタイプを「サイクル＞受けサイクル」か「おまかせ」にする',wall:'構築のタイプを「サイクル＞攻めサイクル」にする',healMv:'こだわり条件の「回復できる匹を入れる」を外すか、構築のタイプを変える',trSlow:'構築のタイプを「おまかせ」にする',
  part:'構築のタイプを「おまかせ」にする',prio:'こだわり条件の「先に動く手段を入れる」を外す（先制技を覚えるポケモンを最初の1匹に足す方法もあります）',resistType:'こだわり条件の「弱点を受け合える」を外す',
  resistReal:'こだわり条件の「弱点を受け合える」を外す（または、硬いポケモンを最初の1匹に足す）',mega:'メガシンカの数を1匹にする',must:'最初に決めたポケモンを減らす',sets:'条件を1つ外す',
  heal:'こだわり条件の「回復できる匹を入れる」を外す',clear:'こだわり条件の「設置技を消せる匹を入れる」を外す',scarf:'こだわり条件の「こだわりスカーフ持ちを入れる」を外す',
  mid:'こだわり条件の「中速を入れる」を外す',balance:'こだわり条件の「物理と特殊を半々に」を外す',phys:'こだわり条件の「物理アタッカー中心」を外す',spec:'こだわり条件の「特殊アタッカー中心」を外す',immune:'こだわり条件の「タイプの攻撃を無効にできる匹を入れる」を外す'};
/* 上位の相手（同じ形式の使用データ。76-mvp.js の mvpOpps）。無ければ null（確かめられないと書く） */
const kdOpps=()=>typeof mvpOpps==='function'?mvpOpps(FMT):null;
/* 受ける側 d がタイプ t の技を受けたときの最大のダメージ（上位の相手が型に入れているその種類の技で、いちばん痛いもの）。null＝上位の相手にその技が無い */
const KD_RECV=new Map();
function kdRecvT(d,dSig,t){
  const k=FMT+'|'+dSig+'|'+t;if(KD_RECV.has(k))return KD_RECV.get(k);
  const O=kdOpps();let best=null;
  if(O)O.list.forEach(op=>(op.o.moves||[]).forEach(mv=>{if(!mv||mv.prot||!(mv.pow>0)||mv.t!==t)return;
    try{d.hp=d.max;const r=dgMove(op.o,mv,d);const mx=typeof r.fmax==='number'?r.fmax:r.max;if(!best||mx>best.max)best={max:mx,op:op.n,mv:mv.n}}catch(e){}}));
  d.hp=d.max;KD_RECV.set(k,best);return best;
}
/* メガシンカの場合ごとの姿（mvpEvalTeam と同じ：メガストーンを持つ匹ごとに「その1匹だけがメガシンカ」。ほかのメガストーンは働かない） */
function kdScens(mons,ss){
  const st=mons.map((p,i)=>ss[i]&&ss[i].item&&megaOf(p.no,ss[i].item)?i:-1).filter(i=>i>=0);
  return (st.length?st:[-1]).map(u=>({u,label:u<0?'メガシンカなし':`${(megaOf(mons[u].no,ss[u].item)||{}).n}（${formInfo(mons[u]).base}がメガシンカ）`,
    form:mons.map((p,i)=>i===u?megaOf(p.no,ss[i].item):p),
    sets:mons.map((p,i)=>{const s=ss[i];if(!s)return null;const c=savedToCalc(p.no,toSaved(s));return st.includes(i)&&i!==u?{...c,item:null}:c})}));
}
/* できあがった6匹を確かめる。parts＝構築のタイプの役わり、tp＝構築のタイプ */
function kdValidate(mons,ss,parts,tp,must){
  const req=[],add=(o)=>req.push({hard:true,...o});
  const ok=(pt,p)=>{try{return pt[1](p)}catch(e){return false}};
  const nm=i=>formInfo(mons[i]).base;
  /* 型のまとまり（覚える技・特性・持ち物・持ち物の重なり） */
  const badSets=mons.map((p,i)=>({i,is:ss[i]?kdIssues(p,ss[i],{}).filter(x=>['learn','ab','item','atk0','choice','dup'].includes(x.k)):[{txt:'型が無い'}]})).filter(x=>x.is.length);
  const dup=typeof mvpDupItems==='function'?mvpDupItems(ss.map(s=>s&&s.item)):[];
  add({id:'sets',label:'型がゲームの決まりに合う',ok:!badSets.length&&!dup.length,
    detail:badSets.length||dup.length?[...badSets.map(x=>`${nm(x.i)}：${x.is.map(y=>y.txt).join('・')}`),...dup.map(k=>`${ITEMN[k]||k}を2匹以上が持っている（同じ持ち物は1匹まで）`)].join('／'):'6匹とも、覚える技・持てる特性・ゲームにある持ち物で、同じ持ち物はありません'});
  if(must&&must.length){const miss=must.filter(n=>!mons.some(m=>m.no===kdBase(byNo[n]).no));add({id:'must',label:'最初に決めたポケモン',ok:!miss.length,detail:miss.length?miss.map(n=>formInfo(byNo[n]).base).join('・')+'が入っていない':must.map(n=>formInfo(byNo[n]).base).join('・')})}
  /* メガシンカ */
  const stIdx=mons.map((p,i)=>ss[i]&&ss[i].item&&megaOf(p.no,ss[i].item)?i:-1).filter(i=>i>=0);
  add({id:'mega',label:KD.mega?`メガシンカできる匹 ${KD.mega}匹`:'メガシンカなし',ok:stIdx.length===KD.mega,
    detail:stIdx.length?`${stIdx.map(i=>`${nm(i)}（${ITEMN[ss[i].item]||ss[i].item}）`).join('・')}。1試合でメガシンカできるのは1匹だけなので、下の確かめはメガシンカする匹ごとに分けています`:'メガストーンを持つ匹はいません'});
  const S=kdScens(mons,ss);
  /* 構築のタイプの役わり（必ず要るもの）：入れる技がある役わりは、型の技に入っているか特性で数える（覚えられるだけでは数えない） */
  const sup=new Set((KD_REQ[tp[0]]||[]).flatMap(r=>r.sup||[]));
  parts.filter(pt=>pt[2]&&!sup.has(pt[0])).forEach(pt=>{const who=mons.map((p,i)=>i).filter(i=>{const p=mons[i],s=ss[i];if(!s||!ok(pt,p))return false;if(!pt[4])return true;
      const ids=pt[4].map(kdKey2Id);const mg=megaOf(p.no,s.item);return s.moves.some(id=>ids.includes(id))||(pt[3]&&(pt[3].includes(s.ab)||(mg&&pt[3].includes(mg.ab))))});
    add({id:'part',label:pt[0],ok:who.length>=1,detail:who.length?who.map(nm).join('・')+(pt[4]?'（型の技・特性で確かめた）':''):'当てはまる匹がいない'+(pt[4]?'（覚えられても、型の技に入っていなければ数えない）':'')})});
  /* 上位の相手との1対1（60-diag.js の dgMatch。76-mvp.js の mvpEvalTeam をそのまま使う：同じ形式の使用データの上位20匹、メガは1匹ずつ） */
  let E=null;try{E=typeof mvpEvalTeam==='function'?mvpEvalTeam(mons.map((p,i)=>({no:p.no,sel:false,set:toSaved(ss[i])})),FMT):null}catch(e){E=null}
  const eOk=E&&E.st==='ok';
  const scenRow=sc=>eOk?(E.scen.find(z=>z.u===sc.u)||E.scen[0]):null;
  const fastOf=(sc,i)=>{const R=scenRow(sc);if(!R)return null;const z=R.rows.map(r=>r.z[i]).filter(Boolean);return z.length?z.filter(v=>v.fast).length/z.length:null};
  const isAtk=(sc,i)=>!!ss[i]&&kdAtkN(ss[i])>=2&&prAtk(sc.form[i])>=100;
  const perScen=(id,label,how,need,fn,hint)=>{const rs=S.map(sc=>{const who=mons.map((p,i)=>i).filter(i=>fn(sc,i));return{sc,who}});
    add({id,label,how,ok:rs.every(r=>r.who.length>=need),per:rs.map(r=>({label:r.sc.label,n:r.who.length,ok:r.who.length>=need,who:r.who.map(nm)})),
      detail:rs.map(r=>`${S.length>1?r.sc.label+'：':''}${r.who.length}匹${r.who.length?'（'+r.who.map(nm).join('・')+'）':''}`).join('／')})};
  const cnt=(id,label,how,need,fn)=>{const who=mons.map((p,i)=>i).filter(i=>ss[i]&&fn(mons[i],ss[i],i));add({id,label,how,ok:who.length>=need,detail:`${who.length}匹${who.length?'（'+who.map(nm).join('・')+'）':''}`})};
  (KD_REQ[tp[0]]||[]).forEach(r=>{
    if(r.id==='rushFast'){if(!eOk){add({id:r.id,label:r.label,how:r.how,ok:false,detail:`${FMTN()}の上位の相手のデータが無いので確かめられません`});return}
      perScen(r.id,r.label,r.how,r.need,(sc,i)=>isAtk(sc,i)&&(fastOf(sc,i)||0)>.5)}
    else if(r.id==='rushItem')cnt(r.id,r.label,r.how,r.need,(p,s)=>kdIsAttacker(p,s)&&['choicescarf','focussash'].includes(s.item));
    else if(r.id==='atk')perScen(r.id,r.label,r.how,r.need,isAtk);
    else if(r.id==='bulkyAtk')perScen(r.id,r.label,r.how,r.need,(sc,i)=>isAtk(sc,i)&&prBulk(sc.form[i])>=90*90);
    else if(r.id==='pivotMv')cnt(r.id,r.label,r.how,r.need,(p,s)=>s.moves.some(id=>PR_PIV.includes(kdMvK(id))));
    else if(r.id==='wall')perScen(r.id,r.label,r.how,r.need,(sc,i)=>prBulk(sc.form[i])>=95*95);
    else if(r.id==='healMv')cnt(r.id,r.label,r.how,r.need,(p,s)=>s.moves.some(id=>KD_HEAL.includes(kdMvK(id)))||s.ab==='regenerator');
    else if(r.id==='trSlow')perScen(r.id,r.label,r.how,r.need,(sc,i)=>isAtk(sc,i)&&sc.form[i].s[5]<=60)});
  /* 先に動く手段：4つを分けて数える。条件は先制技 */
  const init={prio:[],scarf:[],fast:[],ctl:[],up:[]};
  mons.forEach((p,i)=>{const s=ss[i];if(!s)return;
    s.moves.filter(kdPrioMv).forEach(id=>init.prio.push({i,txt:`${nm(i)}（${mName(id)}）`}));
    if(s.item==='choicescarf')init.scarf.push({i,txt:nm(i)});
    const f=S.map(sc=>fastOf(sc,i)).filter(x=>x!=null);if(s.item!=='choicescarf'&&f.length&&Math.max(...f)>.5)init.fast.push({i,txt:nm(i)});
    s.moves.filter(id=>KD_SPDCTL.includes(kdMvK(id))).forEach(id=>init.ctl.push({i,txt:`${nm(i)}（${mName(id)}）`}));
    s.moves.filter(id=>KD_SPDUP.includes(kdMvK(id))).forEach(id=>init.up.push({i,txt:`${nm(i)}（${mName(id)}）`}));
    const ab=kdForm(p,s).ab||s.ab;if(KD_SPDAB[ab])init.up.push({i,txt:`${nm(i)}（特性${KD_SPDAB[ab]}）`})});
  const initTxt=[['先制技',init.prio],['こだわりスカーフ',init.scarf],['もともと速い（上位の相手の半分より多くに先に動ける）',init.fast],['相手を遅くする・順番を変える技',init.ctl],['自分の素早さを上げる',init.up]]
    .map(([h,l])=>`${h}：${l.length?l.map(x=>x.txt).join('・'):'なし'}`);
  if(KD.opt.fast&&KD.type!=='tr')add({id:'prio',label:'先に動く手段（先制技）',how:'先制技を1匹以上の型の技に入れる（スカーフ・速さ・素早さ操作だけでは満たしたことにしません）',ok:init.prio.length>=1,detail:initTxt.join('／')});
  /* 弱点の受け合い：タイプ相性と、実際に受けられるか */
  let cover=null;
  if(KD.opt.resist!==false){
    const ents=mons.map((p,i)=>({no:p.no,sel:false,set:toSaved(ss[i])}));
    cover=(typeof mvpCtx==='function'?mvpCtx:(e,f)=>f())(ents,()=>S.map(sc=>{const types=T.map(t=>{const weak=mons.map((p,i)=>i).filter(i=>prDef(sc.form[i])[t]>=2);if(!weak.length)return null;
        const cov=mons.map((p,i)=>i).filter(i=>!weak.includes(i)&&prDef(sc.form[i])[t]<=.5).map(i=>{
          if(prDef(sc.form[i])[t]===0)return{i,st:'ok',txt:`${nm(i)}（無効）`};
          let d=null;try{d=mkMon(mons[i],'me',sc.sets[i])}catch(e){}
          const r=d?kdRecvT(d,mons[i].no+':'+JSON.stringify([sc.sets[i].ab,sc.sets[i].item,sc.sets[i].sp,sc.sets[i].up,sc.sets[i].dn,sc.u===i]),t):null;
          if(!r)return{i,st:'nodata',txt:`${nm(i)}（半減。上位の相手に${t}技が無く、ダメージは確かめていない）`};
          const pc=Math.round(r.max),st=r.max<50?'ok':r.max<100?'chip':'no';
          return{i,st,max:pc,txt:`${nm(i)}（半減。${r.op}の${r.mv}で最大${pc}%${st==='ok'?'＝2回耐えられる':st==='chip'?'＝受けると大きく削られる':'＝一撃で倒される'}）`}});
        return{t,weak,cov}}).filter(Boolean);
      return{sc,types}}));
    const multi=cover.map(c=>c.types.filter(x=>x.weak.length>=2));
    const noType=multi.map((l,k)=>l.filter(x=>!x.cov.length).map(x=>`${S.length>1?cover[k].sc.label+'：':''}${x.t}（弱い匹：${x.weak.map(nm).join('・')}）`)).flat();
    add({id:'resistType',label:'弱点を受け合える（タイプ相性）',how:'2匹以上が弱いタイプは、そのタイプを半減以下にできる仲間がいる',ok:!noType.length,
      detail:noType.length?`受けられる仲間がいない：${noType.join('・')}`:'2匹以上が弱いタイプは、どれも半減以下にできる仲間がいます'});
    const soft=multi.map((l,k)=>l.filter(x=>x.cov.length&&!x.cov.some(c=>c.st==='ok'||c.st==='nodata')).map(x=>({k,x}))).flat();
    add({id:'resistReal',label:'弱点を受け合える（耐久）',how:'2匹以上が弱いタイプは、半減以下にできる仲間が、上位の相手のそのタイプの技を2回耐えられる（いちばん高い乱数で50%未満）',ok:!soft.length&&!noType.length,
      detail:soft.length?(()=>{const by={};soft.forEach(({k,x})=>{(by[x.t]=by[x.t]||{x,sc:[]}).sc.push(cover[k].sc.label)});
          return Object.values(by).map(({x,sc})=>`${x.t}：${x.cov.map(c=>c.txt).join('・')}${S.length>1&&sc.length<S.length?`（${sc.join('・')}の場合）`:''}`).join('／')+'。タイプ相性上は補完できますが、耐久面から安定した受け出しができるとは限りません'})()
        :noType.length?'タイプ相性で受けられないタイプがあります':'2匹以上が弱いタイプは、実際のダメージでも受けられる仲間がいます（確かめられないものは書いています）'});
  }
  /* そのほかのこだわり条件（チェックを入れた＝ゆずれない条件） */
  const anyS=(fn)=>mons.map((p,i)=>i).filter(i=>ss[i]&&fn(mons[i],ss[i]));
  const optReq=(k,label,how,who)=>add({id:k,label,how,ok:who.length>=1,detail:who.length?who.map(nm).join('・'):'いない'});
  if(KD.opt.heal)optReq('heal','回復できる匹','型の技に回復技、または特性さいせいりょく',anyS((p,s)=>s.moves.some(id=>KD_HEAL.includes(kdMvK(id)))||s.ab==='regenerator'));
  if(KD.opt.clear)optReq('clear','設置技を消せる匹','型の技に こうそくスピン・きりばらい等',anyS((p,s)=>s.moves.some(id=>LS_CLEAR.includes(kdMvK(id)))));
  if(KD.opt.scarf)optReq('scarf','こだわりスカーフ持ち','持ち物がこだわりスカーフ',anyS((p,s)=>s.item==='choicescarf'));
  if(KD.opt.mid)optReq('mid','中速','その姿の素早さ種族値100〜130',anyS((p,s)=>{const f=kdForm(p,s);return f.s[5]>=100&&f.s[5]<=130}));
  if(KD.opt.immune)optReq('immune','タイプの攻撃を無効にできる匹','特性・タイプで無効にできるタイプがある',anyS((p,s)=>monDef(kdForm(p,s)).some(z=>z.m===0)));
  if(KD.opt.balance){const ph=mons.filter((p,i)=>ss[i]&&kdIsAttacker(p,ss[i])&&kdPhys(p,ss[i])).length,sp=mons.filter((p,i)=>ss[i]&&kdIsAttacker(p,ss[i])&&!kdPhys(p,ss[i])).length;
    add({id:'balance',label:'物理と特殊が半々',how:'型で見た物理の攻撃役と特殊の攻撃役の差が1匹まで',ok:Math.abs(ph-sp)<=1,detail:`物理${ph}匹・特殊${sp}匹`})}
  if(KD.opt.phys||KD.opt.spec){const w=KD.opt.phys,n=mons.filter((p,i)=>ss[i]&&kdIsAttacker(p,ss[i])&&kdPhys(p,ss[i])===w).length,all=mons.filter((p,i)=>ss[i]&&kdIsAttacker(p,ss[i])).length;
    add({id:w?'phys':'spec',label:w?'物理アタッカー中心':'特殊アタッカー中心',how:'攻撃役の半分より多くが'+(w?'物理':'特殊'),ok:n*2>all,detail:`攻撃役${all}匹のうち${n}匹`})}
  /* 受け出しと、上から倒す（攻めて返す）を分ける：それぞれの匹を一撃で倒す上位の相手に、だれが受け出せるか・だれが上から倒せるか */
  const roles=eOk?S.map(sc=>{const R=scenRow(sc);const out=[];
    R.rows.forEach(r=>{r.z.forEach((v,i)=>{if(!v||!v.oh)return;
      const sw=r.z.map((w,j)=>j!==i&&w&&(w.recv||w.sw)?j:-1).filter(j=>j>=0),rk=r.z.map((w,j)=>j!==i&&w&&w.fast&&w.r>=4&&!w.recv&&!w.sw?j:-1).filter(j=>j>=0);
      out.push({i,op:r.op.n,sw,rk})})});
    return{sc,out}}):null;
  return{req,cover,init,initTxt,roles,E:eOk?E:null,scens:S.map(s=>s.label),pass:req.every(r=>!r.hard||r.ok)};
}
/* 1匹ずつの理由（できあがった6匹から書く。タイプ相性だけで「受けられる」とは書かない） */
function kdWhyFinal(mons,ss,V){
  const why={};const nm=i=>formInfo(mons[i]).base;
  mons.forEach((p,i)=>{const s=ss[i];const r=[];if(!s){why[p.no]=r;return}
    if(s.moves.some(kdPrioMv))r.push(`先制技（${s.moves.filter(kdPrioMv).map(mName).join('・')}）`);
    if(s.item==='choicescarf'&&kdIsAttacker(p,s))r.push('こだわりスカーフで上から攻める');
    if(s.item==='focussash'&&kdIsAttacker(p,s))r.push('きあいのタスキで1回耐えて倒す');
    if(s.item&&megaOf(p.no,s.item))r.push('メガシンカの候補（1試合に1匹）');
    /* 弱点の受け合いは2つまで。実際に受けられるものを先に、タイプ相性だけのものは「受け出しは不安定」と書く */
    if(V.cover){const cv=[];V.cover[0].types.forEach(x=>x.cov.filter(c=>c.i===i).forEach(c=>{const w=x.weak.map(nm).join('・');
      cv.push(c.st==='ok'?{o:0,t:`${w}の弱点の${x.t}を受けられる`}:c.st==='nodata'?{o:1,t:`${w}の弱点の${x.t}を半減（ダメージは未確認）`}:{o:2,t:`${w}の弱点の${x.t}はタイプ相性上だけ半減（受け出しは不安定）`})}));
      cv.sort((a,b)=>a.o-b.o).slice(0,2).forEach(x=>r.push(x.t))}
    if(V.roles){const rk=new Set();V.roles[0].out.forEach(o=>{if(o.rk.includes(i))rk.add(o.op)});if(rk.size)r.push(`上から倒して返せる（受け出しではない）：${[...rk].slice(0,2).join('・')}`)}
    why[p.no]=[...new Set(r)].slice(0,4)});
  return why;
}
/* 結果の画面：条件の確かめ・メガシンカの場合・弱点の受け合い・先に動く手段 */
function kdCheckHTML(R){
  const V=R.V;if(!V)return '';
  const row=r=>`<div class="kdv-r ${r.ok?'ok':'ng'}"><b>${r.ok?'✓':'△'} ${esc(r.label)}</b>${r.how?`<small>${esc(r.how)}</small>`:''}<p>${esc(r.detail||'')}</p></div>`;
  const cov=V.cover?V.cover.map(c=>`${V.cover.length>1?`<div class="kdv-sh">${esc(c.sc.label)}</div>`:''}<ul class="kdv-l">${c.types.map(x=>`<li><b>${esc(x.t)}</b>（弱い：${x.weak.map(i=>esc(formInfo(R.mons[i]).base)).join('・')}）→ ${x.cov.length?x.cov.map(z=>esc(z.txt)).join('・'):'半減以下にできる仲間なし'}</li>`).join('')}</ul>`).join(''):'';
  const roles=V.roles?V.roles.map(c=>{const l=c.out.slice(0,8);return l.length?`${V.roles.length>1?`<div class="kdv-sh">${esc(c.sc.label)}</div>`:''}<ul class="kdv-l">${l.map(o=>`<li>${esc(o.op)}は${esc(formInfo(R.mons[o.i]).base)}を一撃で倒す → 受け出せる：${o.sw.length?o.sw.map(j=>esc(formInfo(R.mons[j]).base)).join('・'):'いない'}／上から倒して返せる：${o.rk.length?o.rk.map(j=>esc(formInfo(R.mons[j]).base)).join('・'):'いない'}</li>`).join('')}</ul>`:''}).join(''):'';
  return `<div class="kdv">${!V.pass?`<p class="kdv-warn">この案は、ゆずれない条件のうち${V.req.filter(r=>r.hard&&!r.ok).map(r=>`「${esc(r.label)}」`).join('')}を満たしていません。</p>`:''}
    <details class="kdv-d"${V.pass?'':' open'}><summary>条件ごとの確かめ方と結果（6匹と型が決まってから確かめた）</summary>${V.req.map(row).join('')}</details>
    ${V.scens.length>1?`<p class="kdv-n">メガシンカは1試合に1匹だけです。上の数は「${V.scens.map(esc).join('」「')}」の場合ごとに確かめています。</p>`:''}
    <details class="kdv-d"><summary>先に動く手段のくわしい内訳</summary><ul class="kdv-l">${V.initTxt.map(t=>`<li>${esc(t)}</li>`).join('')}</ul><p class="kdv-n">先制技は、素早さに関係なく先に動ける手段です。こだわりスカーフ・もともとの速さは、それより速い相手や先制技には先を取られます。</p></details>
    ${cov?`<details class="kdv-d"><summary>弱点の受け合い（タイプ相性と、実際のダメージ）</summary>${cov}<p class="kdv-n">ダメージは${esc(typeof mvpSrcTxt==='function'?mvpSrcTxt(FMT):'')}の上位の相手が型に入れているそのタイプの技で、いちばん痛いもの（いちばん高い乱数）。50%未満なら2回耐えられます。半減でも大きく削られる匹は、安定して受け出せるとは限りません。</p></details>`:''}
    ${roles?`<details class="kdv-d"><summary>受け出せる匹と、上から倒して返す匹</summary>${roles}<p class="kdv-n">「受け出せる」＝交代で1発受けてから勝てるか、いちばん痛い技を2回耐えられる。「上から倒して返せる」＝倒されたあとに出して先に倒せるが、交代で受けることはできない。</p></details>`:''}</div>`;
}
/* ---------- 実戦データの窓口（2026/11/15 依頼主「上位構築・実戦データ・コア組み合わせ」） ----------
   新しいデータの置き場所は作らない。読むのは2つだけ：
   ・上位パーティ（57-topteams.js の TOPT.teams＝サーバーの「上位パーティ」。本人・運営者の登録と、記事の複数の出典で一致した自動集計。いまの形式・新しい2シーズン）
   ・PokéKit（75-mvp-data.js の MVP_DATA。同じ形式・同じ月の Showdown の集計。上位150匹の型・能力ポイントの配分・一緒に使われる仲間の割合）
   どちらにも無いものは作らない（架空の割合・架空の構築は出さない）。3匹がそろって使われる割合は PokéKit に無いので、
   2匹ずつの割合をつないだ3匹は「推定」と書く。 */
/* その匹の行（元の姿の行と、メガシンカ後の行）。メガシンカ後の行だけがあれば、それを参考にする（アブソル→メガアブソルZ） */
function kdRowFor(no,stone,used){
  if(typeof mvpSet!=='function')return null;
  const tryS=(st,via)=>{let m=mvpSet(FMT,no,{stone:st,used,anyMv:true}),conflict=false;
    if(m.st==='item_conflict'){m=mvpSet(FMT,no,{stone:st,anyMv:true});conflict=true}
    return m.st==='ok'?{m,via,conflict,row:mvpRowOf(FMT,no,st||null)}:null};
  let R=tryS(stone||null,'same');
  if(!R&&stone)R=tryS(null,'base');
  if(!R&&!stone){const p=byNo[no];const ks=(p?kdStones(p):[]).map(k=>({k,r:mvpRowOf(FMT,no,k)})).filter(x=>x.r).sort((a,b)=>a.r.rank-b.r.rank);
    for(const x of ks){R=tryS(x.k,'mega');if(R)break}}
  return R;
}
/* いちばん多い振り方と、その振り方の性格（同じ行の値をそのまま使う。能力ポイントの決まりに入る形かは gen-mvp-data.cjs で確かめた。能力ポイントそのものかは未確認） */
function kdApplySp(s,row){
  if(!row||!Array.isArray(row.sp)||!row.sp.length)return false;
  const [nat,ev]=row.sp[0],n=MVP_NAT[nat];s.sp=[...ev];if(n){s.up=n[0];s.dn=n[1]}return true;
}
const kdFam=no=>{const p=byNo[no];return p&&p.base&&byNo[p.base]?p.base:no};
/* PokéKit の名前（id）→ サイトの番号（元の姿）。メガの id は元の姿にまとめる */
const KD_IDNO={};
function kdIdNo(fmt,id){
  const k=fmt+'|'+id;if(k in KD_IDNO)return KD_IDNO[k];
  const R=typeof mvpRows==='function'?mvpRows(fmt):null;let no=null;
  const r=R&&R.rows.find(r=>r.id===id);
  if(r)no=r.no;else{const b=String(id).replace(/mega[xyz]?$/,'');const c=Object.entries(ENSP).filter(([n,v])=>v===b&&byNo[+n]&&!byNo[+n].base);if(c.length===1)no=+c[0][0]}
  return KD_IDNO[k]=no;
}
/* 一緒に使われる仲間：その匹のすべての姿の行（メガシンカ後の行も）の仲間を合わせる。同じ仲間（姿ちがいも1匹）は割合の高い方。
   割合は「その匹を使った人のうち、その仲間も入れていた人の割合」（6匹のパーティそのものではない） */
const KD_PTN={};
function kdPartners(fmt,no){
  const k=fmt+'|'+no;if(KD_PTN[k])return KD_PTN[k];
  const R=typeof mvpRows==='function'?mvpRows(fmt):null,out=new Map();
  if(R)R.rows.filter(r=>r.no===no).forEach(r=>(r.tm||[]).forEach(([id,pc])=>{const n=kdIdNo(fmt,id);if(!n||n===no)return;const o=out.get(n);
    if(!o||pc>o.pc)out.set(n,{no:n,pc,via:r.id,viaN:(byNo[r.mega||r.no]||{}).n||r.name,id,mega:/mega[xyz]?$/.test(id)})}));
  return KD_PTN[k]=[...out.values()].sort((a,b)=>b.pc-a.pc||a.no-b.no);
}
/* 2匹が一緒に使われる割合（どちらの行から見ても。高い方） */
function kdCo(fmt,a,b){
  a=kdFam(a);b=kdFam(b);if(a===b)return null;
  const x=kdPartners(fmt,a).find(z=>z.no===b),y=kdPartners(fmt,b).find(z=>z.no===a);
  if(!x&&!y)return null;const z=!y||(x&&x.pc>=y.pc)?x:y;return{pc:z.pc,from:z===x?a:b,via:z.viaN,x,y};
}
const kdMetaTxt=fmt=>{const m=typeof mvpMeta==='function'&&mvpMeta(fmt);return m?`PokéKit・${fmt==='double'?'ダブル':'シングル'}・${m.month}・${m.battles.toLocaleString()}戦`:'PokéKit'};
/* 上位パーティのうち、決めたポケモン（姿ちがいは同じ）が全部入っているもの。新しいシーズン→確認済み→順位→レートの順 */
function kdTemplates(must){
  if(typeof TOPT==='undefined'||TOPT.st!=='ok'||TOPT.fmt!==FMT||!Array.isArray(TOPT.teams))return[];
  const fam=(must||[]).map(kdFam);
  return TOPT.teams.filter(t=>t.team&&t.team.length>=4&&fam.every(f=>t.team.some(x=>kdFam(x.no)===f)))
    .slice().sort((a,b)=>((a.old||0)-(b.old||0))||((b.ver?1:0)-(a.ver?1:0))||((a.r||1e9)-(b.r||1e9))||((b.rate||0)-(a.rate||0)));
}
const kdTplConf=t=>t.ver?'運営者が確認した登録':t.auto?'記事から自動で集めた（2つ以上の出典で一致）':'本人の申告（未確認）';
const kdTplTxt=t=>`上位パーティ（${[t.s,t.r?t.r+'位':'',t.rate?'レート'+t.rate:''].filter(Boolean).join('・')}、${kdTplConf(t)}）`;
