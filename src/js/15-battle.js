/* ===================== 模擬戦（ダブル） ===================== */
/* 技・特性・習得技は PokeAPI（Champions版の習得技リスト）をもとにしています。公式の発表との照合は未了です。 */
const PRESETS=[]; /* 将来: 許可を得た実在の構築を {name,src,mons:[図鑑no×6]} で入れると、相手はそこからランダムに選ばれます */
const rnd=n=>Math.floor(Math.random()*n);
const shuf=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
const mvObj=id=>{const a=MV[id],e=(typeof MVE!=='undefined'&&MVE[id])||{};let drain=a[9];if(e.dr)drain=e.dr;if(e.rc)drain=-e.rc;return{id,n:a[0],t:a[1],pow:a[2],acc:a[3],cls:a[4],pri:a[5],tg:a[6],minH:a[7],maxH:a[8],drain,e}};
const PROT={id:0,n:'まもる',t:null,prot:true,pri:4,pow:0,acc:0,cls:2,tg:0,minH:1,maxH:1,drain:0};
const ABSORB={'levitate':['じめん',0],'volt-absorb':['でんき',1],'lightning-rod':['でんき',0],'motor-drive':['でんき',0],'water-absorb':['みず',1],'dry-skin':['みず',1],'flash-fire':['ほのお',0],'sap-sipper':['くさ',0],'earth-eater':['じめん',1]};
const PINCH={blaze:'ほのお',torrent:'みず',overgrow:'くさ',swarm:'むし'};
const SKIN={pixilate:['フェアリー'],refrigerate:['こおり'],aerilate:['ひこう'],dragonize:['ドラゴン'],galvanize:['でんき']};
const WSET={drought:'sun',drizzle:'rain','sand-stream':'sand','snow-warning':'snow'};
const WSPD={chlorophyll:'sun','swift-swim':'rain','sand-rush':'sand','slush-rush':'snow'};
const WNAME={sun:'ひざしが つよい',rain:'あめが ふっている',sand:'すなあらし',snow:'ゆきが ふっている'};
const ABIMPL=new Set([...Object.keys(ABSORB),...Object.keys(PINCH),...Object.keys(SKIN),...Object.keys(WSET),...Object.keys(WSPD),
 'intimidate','clear-body','white-smoke','hyper-cutter','mirror-armor','defiant','competitive','huge-power','pure-power','hustle','compound-eyes','no-guard','technician','adaptability',
 'multiscale','solid-rock','filter','tinted-lens','tough-claws','iron-fist','strong-jaw','mega-launcher','sharpness','sand-force','solar-power','fairy-aura','parental-bond','scrappy','mega-sol','levitate','thick-fat','heatproof','water-bubble','fur-coat','sturdy','speed-boost','moxie','stamina','justified','mold-breaker','skill-link']);
const stgM=s=>s>=0?(2+s)/2:2/(2-s);

/* ---- 持ち物（対応しているもののみ） ---- */
const ITEMN={choicescarf:'こだわりスカーフ',choiceband:'こだわりハチマキ',choicespecs:'こだわりメガネ',lifeorb:'いのちのたま',focussash:'きあいのタスキ',sitrusberry:'オボンのみ',assaultvest:'とつげきチョッキ',leftovers:'たべのこし',
 softsand:'やわらかいすな',charcoal:'もくたん',mysticwater:'しんぴのしずく',magnet:'じしゃく',miracleseed:'きせきのタネ',nevermeltice:'とけないこおり',blackbelt:'くろおび',poisonbarb:'どくバリ',sharpbeak:'するどいくちばし',twistedspoon:'まがったスプーン',silverpowder:'ぎんのこな',hardstone:'かたいいし',spelltag:'のろいのおふだ',dragonfang:'りゅうのキバ',blackglasses:'くろいメガネ',metalcoat:'メタルコート',fairyfeather:'ようせいのハネ',silkscarf:'シルクのスカーフ',expertbelt:'たつじんのおび',muscleband:'ちからのハチマキ',wiseglasses:'ものしりメガネ',venusaurite:'フシギバナイト',charizarditex:'リザードナイトX',charizarditey:'リザードナイトY',blastoisinite:'カメックスナイト',alakazite:'フーディナイト',gengarite:'ゲンガナイト',kangaskhanite:'ガルーラナイト',pinsirite:'カイロスナイト',gyaradosite:'ギャラドスナイト',aerodactylite:'プテラナイト',ampharosite:'デンリュウナイト',scizorite:'ハッサムナイト',heracronite:'ヘラクロスナイト',houndoominite:'ヘルガナイト',tyranitarite:'バンギラスナイト',blazikenite:'バシャーモナイト',gardevoirite:'サーナイトナイト',mawilite:'クチートナイト',aggronite:'ボスゴドラナイト',medichamite:'チャーレムナイト',manectite:'ライボルトナイト',banettite:'ジュペッタナイト',absolite:'アブソルナイト',garchompite:'ガブリアスナイト',lucarionite:'ルカリオナイト',abomasite:'ユキノオナイト',swampertite:'ラグラージナイト',sceptilite:'ジュカインナイト',sablenite:'ヤミラミナイト',altarianite:'チルタリスナイト',galladite:'エルレイドナイト',audinite:'タブンネナイト',sharpedonite:'サメハダナイト',slowbronite:'ヤドランナイト',steelixite:'ハガネールナイト',pidgeotite:'ピジョットナイト',glalitite:'オニゴーリナイト',metagrossite:'メタグロスナイト',cameruptite:'バクーダナイト',lopunnite:'ミミロップナイト',salamencite:'ボーマンダナイト',beedrillite:'スピアナイト',clefablite:'ピクシナイト',victreebelite:'ウツボットナイト',starminite:'スターミナイト',dragoninite:'カイリュナイト',meganiumite:'メガニウムナイト',feraligite:'オーダイルナイト',skarmorite:'エアームドナイト',froslassite:'ユキメノコナイト',emboarite:'エンブオナイト',excadrite:'ドリュウズナイト',scolipite:'ペンドラナイト',scraftinite:'ズルズキナイト',eelektrossite:'シビルドナイト',chandelurite:'シャンデラナイト',chesnaughtite:'ブリガロナイト',delphoxite:'マフォクシナイト',greninjite:'ゲッコウガナイト',pyroarite:'カエンジシナイト',floettite:'フラエッテナイト',malamarite:'カラマネナイト',barbaracite:'ガメノデスナイト',dragalgite:'ドラミドナイト',hawluchanite:'ルチャブルナイト',drampanite:'ジジーロナイト',falinksite:'タイレーツナイト',raichunitex:'ライチュウナイトX',raichunitey:'ライチュウナイトY',chimechite:'チリーンナイト',absolitez:'アブソルナイトZ',staraptite:'ムクホークナイト',garchompitez:'ガブリアスナイトZ',lucarionitez:'ルカリオナイトZ',golurkite:'ゴルーグナイト',meowsticite:'ニャオニクスナイト',crabominite:'ケケンカニナイト',golisopite:'グソクムシャナイト',scovillainite:'スコヴィラナイト',glimmoranite:'キラフロルナイト',baxcalibrite:'セグレイブナイト'};
const ITEMT={softsand:'じめん',charcoal:'ほのお',mysticwater:'みず',magnet:'でんき',miracleseed:'くさ',nevermeltice:'こおり',blackbelt:'かくとう',poisonbarb:'どく',sharpbeak:'ひこう',twistedspoon:'エスパー',silverpowder:'むし',hardstone:'いわ',spelltag:'ゴースト',dragonfang:'ドラゴン',blackglasses:'あく',metalcoat:'はがね',fairyfeather:'フェアリー',silkscarf:'ノーマル'};

/* ---- ラダー集計データ（Pokémon Champions Battle Data API） ----
   ブラウザから直接取得し、短時間だけ端末内に保存します（データの再配布・ミラーはしません）。
   提供元：https://championsbattledata.com （非公式。Pokémon関連企業とは無関係） */
const CBD='https://championsbattledata.com';
const nrm=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const LIVE={st:'idle',files:null,csv:{},at:null};
/* 対戦形式：シングル（3匹選出・先発1）を基本に、ダブル（4匹選出・先発2）にも切り替えられる */
let FMT=(()=>{try{return localStorage.getItem('pcfmt')||'single'}catch(e){return'single'}})();
const PICK=()=>FMT==='single'?3:4;
const LEADN=()=>FMT==='single'?1:2;
const FMTN=()=>FMT==='single'?'シングル':'ダブル';
const FMTDIR=()=>FMT==='single'?'Singles':'Doubles';
function setFmt(f){
  if(f===FMT||(f!=='single'&&f!=='double'))return;
  FMT=f;try{localStorage.setItem('pcfmt',f)}catch(e){}
  LIVE.csv={};if(typeof META!=='undefined'){META.st='idle';META.p=null;META.rank=[];META.teams=[]}
  const n=PICK();let c=0;team.forEach(x=>{x.sel=c<n;if(x.sel)c++});saveTeam();
}
const fmtSwitch=()=>`<div class="fmtsw" role="group" aria-label="対戦形式"><button data-fmtsw="single" aria-pressed="${FMT==='single'}">シングル</button><button data-fmtsw="double" aria-pressed="${FMT==='double'}">ダブル</button></div>`;
function bindFmt(root,redraw){(root||document).querySelectorAll('[data-fmtsw]').forEach(b=>b.onclick=()=>{setFmt(b.dataset.fmtsw);toast(FMTN()+'の形式に切り替えました');redraw()})}
const lsGet=(k,ttl)=>{try{const o=JSON.parse(localStorage.getItem(k)||'null');if(o&&Date.now()-o.t<ttl)return o.v}catch(e){}return null};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify({t:Date.now(),v}))}catch(e){}};
const SP2NO={};Object.entries(ENSP).forEach(([no,n])=>{(SP2NO[n]=SP2NO[n]||[]).push(+no)});
async function liveInit(){
  if(LIVE.st==='ready')return true;
  if(LIVE.st==='fail')return false;
  try{
    let files=lsGet('pcidx',864e5);
    if(!files){
      const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),15000);
      const r=await fetch(CBD+'/data/pokemon-index.json',{signal:ctl.signal});clearTimeout(tm);
      if(!r.ok)throw new Error('index '+r.status);
      const txt=await r.text();files={};
      for(const m of txt.matchAll(/battle_data\/Doubles\/([^"\\\/]+?)\.csv/g)){const fn=decodeURIComponent(m[1]);files[nrm(fn)]=fn}
      if(!Object.keys(files).length)throw new Error('no files');
      lsSet('pcidx',files);
    }
    LIVE.files=files;LIVE.at=new Date();LIVE.st='ready';return true;
  }catch(e){LIVE.st='fail';LIVE.err=String(e&&e.message||e);return false}
}
function digest(txt){
  const L=txt.trim().split(/\r?\n/),h=L[0].split(',');const d={mv:[],it:[],ab:[],tm:[],nat:[],sp:[]};
  for(let i=1;i<L.length;i++){
    const c=L[i].split(','),r={};h.forEach((k,j)=>r[k]=c[j]);const pc=parseFloat(r.percentage)||0;
    if(d.rank==null&&r.column_position)d.rank=+r.column_position;
    if(r.category==='move')d.mv.push([r.name,pc]);
    else if(r.category==='held_item')d.it.push([r.name,pc]);
    else if(r.category==='ability')d.ab.push([r.name,pc]);
    else if(r.category==='teammate')d.tm.push(r.name);
    else if(r.category==='stat_alignment')d.nat.push([r.stat_up,r.stat_down,pc]);
    else if(r.category==='stat_points')d.sp.push([[+r.hp_points,+r.attack_points,+r.defense_points,+r.sp_atk_points,+r.sp_def_points,+r.speed_points],pc]);
  }
  return d;
}
async function liveMon(no){
  const key=ENSP[no];if(!key||!LIVE.files)return null;
  if(LIVE.csv[no]!==undefined)return LIVE.csv[no];
  const ca=lsGet('pccsv2'+FMT+no,216e5);if(ca){LIVE.csv[no]=ca;return ca}
  const fn=LIVE.files[key];if(!fn){LIVE.csv[no]=null;return null}
  try{
    const r=await fetch(CBD+'/pokemon_champions_assets/battle_data/'+FMTDIR()+'/'+encodeURIComponent(fn)+'.csv');
    if(!r.ok)throw 0;
    const d=digest(await r.text());if(!d.mv.length)throw 0;
    LIVE.csv[no]=d;lsSet('pccsv2'+FMT+no,d);return d;
  }catch(e){LIVE.csv[no]=null;return null}
}
const wpick=(arr,w)=>{let t=arr.reduce((a,x)=>a+Math.max(w(x),.001),0),r=Math.random()*t;for(const x of arr){r-=Math.max(w(x),.001);if(r<=0)return x}return arr[arr.length-1]};
const STI={'attack':1,'defense':2,'sp.atk':3,'sp.def':4,'speed':5};
/* 集計データから型を1つ組む。top=true なら最頻の型、false なら使用率に応じてランダム */
function buildSet(p,d,top){
  const base=chooseSet(p);
  if(!d)return base;
  let ab=base.ab;
  const abl=d.ab.map(([n,pc])=>[ABK[nrm(n)],pc]).filter(x=>x[0]);
  if(abl.length)ab=top?abl[0][0]:wpick(abl,x=>x[1])[0];
  const pool=d.mv.map(([n,pc])=>[MVK[nrm(n)],pc]).filter(x=>x[0]!==undefined);
  const moves=[];
  const left=[...pool];
  while(moves.length<4&&left.length){
    const x=top?left[0]:wpick(left,y=>y[1]);left.splice(left.indexOf(x),1);
    moves.push(x[0]===0?PROT:mvObj(x[0]));
  }
  if(moves.filter(m=>!m.prot).length===0)return {...base,ab};
  for(const m of base.moves){if(moves.length>=4)break;if(!moves.some(x=>x.id===m.id&&x.n===m.n))moves.push(m)}
  let item=null;
  const itl=d.it.map(([n,pc])=>[nrm(n),pc]).filter(x=>ITEMN[x[0]]&&itemFor(p.no,x[0]));
  if(itl.length)item=top?itl[0][0]:wpick(itl,x=>x[1])[0];
  let sp=null,up=-1,dn=-1;
  if(d.sp.length){
    const s1=top?d.sp[0]:wpick(d.sp.slice(0,6),x=>x[1]);sp=s1[0];
    const sidx=x=>STI[nrm(x).replace(/^spatk$/,'sp.atk').replace(/^spdef$/,'sp.def')];
    const ok=d.nat.filter(([u,w])=>{const ui=sidx(u),wi=sidx(w);return !((ui===1&&!sp[1])||(ui===3&&!sp[3])||(wi!==undefined&&sp[wi]>=20))});
    const pickN=ok.length?(top?ok[0]:wpick(ok,x=>x[2])):null;
    if(pickN){up=sidx(pickN[0])??-1;dn=sidx(pickN[1])??-1}
  }
  return{ab,moves,item,sp,up,dn};
}
/* ラダー集計から「一緒によく使われるポケモン」をたどって6匹を組む */
async function liveTeam(top){
  if(!(await liveInit()))return null;
  const avail=P.filter(p=>LIVE.files[ENSP[p.no]]);
  if(avail.length<20)return null;
  for(let tries=0;tries<4;tries++){
    const seed=avail[rnd(avail.length)];const d0=await liveMon(seed.no);if(!d0)continue;
    const team=[seed.no];const data={[seed.no]:d0};
    const frontier=[seed.no];
    while(team.length<6&&frontier.length){
      const cur=frontier.shift(),dd=data[cur];
      const cands=dd.tm.map((n,i)=>({no:(SP2NO[nrm(n)]||[])[0],w:1/(i+2)})).filter(x=>x.no&&!team.includes(x.no)&&LIVE.files[ENSP[x.no]]);
      const need=6-team.length;const picks=[];
      const pool=[...cands];
      while(picks.length<Math.min(need,3)&&pool.length){const x=wpick(pool,y=>y.w);pool.splice(pool.indexOf(x),1);picks.push(x.no)}
      const got=await Promise.all(picks.map(liveMon));
      picks.forEach((n,i)=>{if(got[i]){team.push(n);data[n]=got[i];frontier.push(n)}});
    }
    if(team.length===6){
      const sets={};team.forEach(n=>sets[n]=buildSet(byNo[n],data[n],top));
      return{name:'ラダー集計から生成',src:'live',nos:team,sets};
    }
  }
  return null;
}


function genTeam(){
  if(PRESETS.length){const t=PRESETS[rnd(PRESETS.length)];return{name:t.name,src:t.src||'preset',nos:[...t.mons]}}
  const pool=P.filter(p=>p.bst>=480);
  for(let k=0;k<300;k++){
    const pick=[];
    for(const p of shuf(pool)){
      if(pick.length===6)break;
      const nx=[...pick,p];
      if(!T.some(a=>nx.filter(m=>mult(a,m.t)>=2).length>=3))pick.push(p);
    }
    if(pick.length===6)return{name:'ランダム構築',src:'sample',nos:pick.map(x=>x.no)};
  }
  return{name:'ランダム構築',src:'sample',nos:shuf(pool).slice(0,6).map(x=>x.no)};
}
/* 技構成と特性を自動で決める（使用率データがないため、威力・タイプ一致・攻め範囲から選びます） */
function chooseSet(p,det){
  const nz=()=>det?1:(.85+Math.random()*.3);
  const ab=ABD[p.no]||[];const ab0=ab.filter(a=>!a[1]);const abk=(ab0.length?ab0:ab).length?(ab0.length?ab0:ab)[det?0:rnd((ab0.length?ab0:ab).length)][0]:null;
  const ls=LSD[p.no];
  if(!ls){const phys=p.s[1]>=p.s[3];return{ab:abk,moves:p.t.map(t=>({id:-1,n:t+'わざ',t,pow:90,acc:100,cls:phys?0:1,pri:0,tg:0,minH:1,maxH:1,drain:0}))}}
  const A=p.s[1],C=p.s[3],mx=Math.max(A,C);
  const pool=ls[1].filter(id=>MV[id]).map(mvObj).filter(m=>!(m.id===0));
  const sc=m=>{let v=(m.pow||60)*(m.acc||100)/100*Math.pow((m.cls?C:A)/mx,2)*simF(null,m);
    if(p.t.includes(m.t))v*=1.5;if(m.maxH>1)v*=m.minH===m.maxH?m.maxH:3.1;if(m.tg)v*=.85;if(m.pri>0)v*=1.12;if(m.drain<0)v*=.9;return v};
  const chosen=[],cov=new Set();
  for(let i=0;i<3&&pool.length>chosen.length;i++){
    let best=null;
    pool.forEach(m=>{if(chosen.includes(m))return;
      const nc=T.filter(d=>!cov.has(d)&&mult(m.t,[d])>=2).length;
      const same=chosen.filter(c=>c.t===m.t).length;
      const v=sc(m)*nz()*(1+.12*nc)*(same>=1?.35:1);
      if(!best||v>best.v)best={m,v}});
    chosen.push(best.m);T.forEach(d=>{if(mult(best.m.t,[d])>=2)cov.add(d)});
  }
  if(ls[0])chosen.push(PROT);
  else{let best=null;pool.forEach(m=>{if(chosen.includes(m))return;const v=sc(m)*nz();if(!best||v>best.v)best={m,v}});if(best)chosen.push(best.m)}
  return{ab:abk,moves:chosen};
}
function mkMon(p,side,set){
  set=set||chooseSet(p);
  /* メガストーンを持っていれば、メガシンカ後の姿で計算する（1回の対戦でメガシンカできるのは1匹だけ） */
  const mg=megaOf(p.no,set.item);
  if(mg){p=mg;set={...set,ab:mg.ab}}
  let st;
  if(set.sp)st=calcStats(p,set.sp,set.up??-1,set.dn??-1);
  else{const phys=p.s[1]>=p.s[3],ai=phys?1:3,sp=[2,0,0,0,0,0];sp[ai]=32;sp[5]=32;st=calcStats(p,sp,ai,phys?3:1)}
  return{p,side,st,hp:st[0],max:st[0],moves:set.moves,ab:set.ab,item:set.item||null,stg:{atk:0,def:0,spa:0,spd:0,spe:0},prot:false,usedProt:false,lastProt:false,fainted:false,disg:set.ab==='disguise'};
}
let B={phase:'menu'};
const alive=S=>S.act.filter(i=>i!=null).map(i=>S.mons[i]).filter(m=>!m.fainted);
const bn=b=>(b.side==='op'?'相手の':'')+b.p.n;
const abn=b=>ABN[b.ab]||'';
const sideDead=S=>S.mons.every(m=>m.fainted);
const foesOf=b=>b.side==='me'?B.op:B.me, ownOf=b=>b.side==='me'?B.me:B.op;
const effSpd=b=>Math.floor(b.st[5]*stgM(b.stg.spe)*(B.weather&&WSPD[b.ab]===B.weather.k?2:1)*(b.item==='choicescarf'?1.5:1)*(b.status==='par'?.5:1));
function chg(b,k,n,log,why){
  const o=b.stg[k];b.stg[k]=Math.max(-6,Math.min(6,o+n));
  const nm={atk:'攻撃',def:'防御',spa:'特攻',spd:'特防',spe:'素早さ'}[k];
  if(b.stg[k]!==o)log(`${bn(b)}の ${nm}が ${n>0?'上がった':'下がった'}！${why?`（${why}）`:''}`);
}
function enter(b,log){
  b.inTurn=B.turn||0;
  const k=WSET[b.ab];
  if(k&&!(B.weather&&B.weather.k===k)){B.weather={k,t:5};log(`<span class="ab">${bn(b)}の ${abn(b)}！ ${WNAME[k]}。</span>`)}
  if(b.ab==='intimidate'){
    alive(foesOf(b)).forEach(f=>{
      if(['clear-body','white-smoke','hyper-cutter'].includes(f.ab))log(`${bn(f)}の ${abn(f)}で 攻撃は 下がらない！`);
      else if(f.ab==='mirror-armor'){log(`${bn(f)}の ミラーアーマー！`);chg(b,'atk',-1,log)}
      else{log(`<span class="ab">${bn(b)}の いかく！</span>`);chg(f,'atk',-1,log);
        if(f.ab==='defiant')chg(f,'atk',2,log,'まけんき');if(f.ab==='competitive')chg(f,'spa',2,log,'かちき')}
    });
  }
}
function refill(S,log){
  S.act=S.act.map(i=>i!=null&&!S.mons[i].fainted?i:null);
  for(let k=0;k<2;k++)if(S.act[k]==null){
    const j=S.mons.findIndex((m,x)=>!m.fainted&&!S.act.includes(x));
    if(j>=0){S.act[k]=j;log(`<span class="ko">${bn(S.mons[j])}が 出てきた！</span>`);enter(S.mons[j],log)}
  }
}
function hitType(a,mv){if(mkey(mv)==='weatherball'){const w=a.ab==='mega-sol'?'sun':(B.weather&&B.weather.k);if(w)return{sun:'ほのお',rain:'みず',sand:'いわ',snow:'こおり'}[w]}return SKIN[a.ab]&&mv.t==='ノーマル'&&!['terrainpulse','weatherball'].includes(mkey(mv))?SKIN[a.ab][0]:mv.t}
/* ---- 条件で威力が変わる技 ---- */
const WT={"3":100,"6":90.5,"9":85.5,"15":29.5,"18":39.5,"24":65,"25":6,"26":30,"10100":21,"36":40,"38":19.9,"10104":19.9,"40":12,"45":18.6,"53":32,"10108":33,"863":28,"59":155,"10230":168,"186":33.9,"65":48,"68":130,"71":15.5,"80":78.5,"10165":70.5,"199":79.5,"10172":79.5,"83":15,"865":117,"94":40.5,"208":400,"464":282.8,"115":80,"121":80,"122":54.5,"866":58.2,"212":118,"900":89,"127":55,"128":88.4,"10250":115,"10251":85,"10252":110,"130":235,"132":4,"134":29,"135":24.5,"136":25,"196":26.5,"197":27,"470":25.5,"471":25.9,"700":23.5,"142":59,"143":460,"149":210,"154":100.5,"157":79.5,"10233":69.8,"160":88.8,"168":33.5,"181":61.5,"184":28.5,"981":160,"205":125.8,"472":42.5,"211":3.9,"904":60.5,"214":54,"461":34,"903":43,"473":291,"227":50.5,"229":35,"899":95.1,"248":202,"254":52.2,"257":52,"260":81.9,"279":28,"282":48.4,"475":52,"302":11,"303":11.5,"306":360,"308":31.5,"310":40.2,"407":14.5,"317":80,"319":88.8,"323":220,"324":80.4,"334":20.6,"350":162,"351":0.8,"354":12.5,"358":1,"359":47,"362":256.5,"478":26.6,"373":102.6,"376":550,"389":310,"392":55,"395":84.5,"398":24.9,"405":42,"409":102.5,"411":149.5,"428":33.3,"442":108,"445":95,"448":54,"450":300,"454":44.4,"460":135.5,"479":0.3,"10008":0.3,"10009":0.3,"10010":0.3,"10011":0.3,"10012":0.3,"497":63,"500":150,"503":94.6,"10236":58.2,"505":27,"510":37.5,"512":30.5,"514":28,"516":29,"518":60.5,"530":40.4,"531":31,"534":87,"545":200.5,"547":6.6,"902":110,"10248":110,"553":96.3,"560":30,"563":76.5,"867":66.6,"569":107.3,"571":81.1,"10239":73,"579":20.1,"584":57.5,"587":5,"604":80.5,"609":34.3,"614":260,"618":11,"10180":20.5,"623":330,"635":160,"637":46,"652":90,"655":39,"658":40,"660":42.4,"663":24.5,"666":17,"668":81.5,"10061":0.9,"671":10,"673":91,"675":136,"676":28,"678":8.5,"681":53,"683":15.5,"685":5,"687":47,"689":96,"691":81.5,"693":35.3,"695":21,"697":270,"699":225,"701":21.5,"702":2.2,"706":150.5,"10242":334.1,"707":3,"709":71,"711":12.5,"10030":9.5,"10031":14,"10032":39,"713":505,"10243":262.4,"715":85,"724":36.6,"10244":37,"727":83,"730":44,"733":26,"740":180,"745":25,"10126":25,"10152":25,"748":14.5,"750":920,"752":82,"758":22.2,"763":21.4,"765":76,"766":82.8,"768":108,"778":0.7,"780":185,"784":78.2,"812":90,"815":33,"818":45.2,"823":75,"828":19.9,"841":1,"842":13,"844":65.5,"849":40,"10184":40,"853":39,"855":0.4,"858":5.1,"861":61,"869":0.5,"870":62,"871":1,"876":28,"10186":28,"877":3,"887":50,"908":31.2,"911":326.5,"914":61.9,"972":15,"956":90,"964":60.2,"930":48.2,"952":15,"939":113,"968":310,"925":2.3,"998":210,"923":41,"931":2.4,"10260":2.4,"10261":2.4,"10262":2.4,"934":240,"970":45,"943":61,"1000":30,"959":112.8,"936":85,"937":62,"983":120,"979":56,"1013":2.2,"1018":60,"1019":93,"10025":8.5,"10033":155.5,"10034":110.5,"10035":100.5,"10036":101.1,"10037":48,"10038":40.5,"10039":100,"10040":59,"10041":305,"10042":79,"10045":61.5,"10046":125,"10047":62.5,"10048":49.5,"10049":255,"10050":52,"10051":48.4,"10052":23.5,"10053":395,"10054":31.5,"10055":44,"10056":13,"10057":49,"10058":95,"10059":57.5,"10060":185,"10064":102,"10065":55.2,"10066":161,"10067":20.6,"10068":56.4,"10069":32,"10070":130.3,"10071":120,"10072":740,"10073":50.5,"10074":350.2,"10076":942.9,"10087":320.5,"10088":28.3,"10089":112.6,"10090":40.5,"10278":42.3,"10279":125.5,"10280":80,"10281":290,"10282":201,"10283":108.8,"10284":40.4,"10285":29.6,"10286":180.3,"10287":60,"10288":230.5,"10289":31,"10290":180,"10291":69.6,"10292":90,"10293":39,"10294":40,"10295":93.3,"10296":100.8,"10297":69.8,"10298":100,"10299":100.3,"10300":25,"10302":240.5,"10303":99,"10304":38,"10305":26,"10306":8,"10307":49,"10308":50,"10309":99,"10310":49.4,"10313":330,"10314":10.1,"10315":252.8,"10316":148,"10320":22,"10321":77,"10325":315,"10326":10.1};
/* 技の英語ID｜性質（c接触 pパンチ bかみつき l波動 s切る o音 w風 x弾 dおどり） */
const MDK={"709":"accelerock|c","151":"acidarmor|","491":"acidspray|x","512":"acrobatics|c","367":"acupressure|","332":"aerialace|cs","495":"afteryou|","97":"agility|","314":"aircutter|sw","403":"airslash|s","914":"alluringvoice|o","502":"allyswitch|","133":"amnesia|","246":"ancientpower|","787":"appleacid|","895":"aquacutter|s","453":"aquajet|c","392":"aquaring|","872":"aquastep|cd","401":"aquatail|c","890":"armorcannon|","597":"aromaticmist|","372":"assurance|c","213":"attract|","396":"aurasphere|lx","783":"aurawheel|","694":"auroraveil|","419":"avalanche|c","853":"axekick|c","608":"babydolleyes|","661":"banefulbunker|","839":"barbbarrage|","226":"batonpass|","690":"beakblast|x","251":"beatup|","562":"belch|","187":"bellydrum|","20":"bind|c","44":"bite|cb","891":"bitterblade|cs","841":"bittermalice|","307":"blastburn|","299":"blazekick|c","59":"blizzard|w","335":"block|","776":"bodypress|c","34":"bodyslam|c","198":"bonerush|","586":"boomburst|o","340":"bounce|c","413":"bravebird|c","784":"breakingswipe|c","280":"brickbreak|c","693":"brutalswing|c","450":"bugbite|c","405":"bugbuzz|o","339":"bulkup|","523":"bulldoze|","418":"bulletpunch|cp","331":"bulletseed|x","807":"burningjealousy|","682":"burnup|","347":"calmmind|","845":"ceaselessedge|cs","268":"charge|","451":"chargebeam|","204":"charm|","886":"chillingwater|","881":"chillyreception|","509":"circlethrow|c","691":"clangingscales|o","775":"clangoroussoul|od","499":"clearsmog|","370":"closecombat|c","811":"coaching|","489":"coil|","894":"comeuppance|c","109":"confuseray|","383":"copycat|","810":"corrosivegas|","322":"cosmicpower|","538":"cottonguard|","178":"cottonspore|","68":"counter|c","756":"courtchange|","343":"covet|c","152":"crabhammer|c","238":"crosschop|c","440":"crosspoison|cs","242":"crunch|cb","306":"crushclaw|cs","174":"curse|","663":"darkestlariat|c","399":"darkpulse|l","605":"dazzlinggleam|","777":"decorate|","432":"defog|","194":"destinybond|","197":"detect|","91":"dig|c","827":"direclaw|cs","50":"disable|","435":"discharge|","291":"dive|c","38":"doubleedge|c","458":"doublehit|c","892":"doubleshock|cp","104":"doubleteam|","434":"dracometeor|","913":"dragoncheer|o","337":"dragonclaw|cs","349":"dragondance|d","751":"dragondarts|","406":"dragonpulse|l","407":"dragonrush|c","525":"dragontail|c","577":"drainingkiss|c","409":"drainpunch|cp","65":"drillpeck|c","529":"drillrun|c","778":"drumbeating|","814":"dualwingbeat|c","223":"dynamicpunch|cp","414":"earthpower|","89":"earthquake|","598":"eerieimpulse|","826":"eeriespell|o","604":"electricterrain|","582":"electrify|","486":"electroball|x","905":"electroshot|","527":"electroweb|","227":"encore|","283":"endeavor|c","203":"endure|","412":"energyball|x","494":"entrainment|","284":"eruption|","797":"expandingforce|","153":"explosion|","326":"extrasensory|","245":"extremespeed|c","263":"facade|c","587":"fairylock|","252":"fakeout|c","313":"faketears|","297":"featherdance|d","364":"feint|","565":"fellstinger|c","907":"ficklebeam|","552":"fierydance|d","515":"finalgambit|","126":"fireblast|","424":"firefang|cb","680":"firelash|c","7":"firepunch|cp","83":"firespin|","660":"firstimpression|c","90":"fissure|","175":"flail|c","488":"flamecharge|c","53":"flamethrower|","394":"flareblitz|c","430":"flashcannon|","260":"flatter|","374":"fling|","812":"flipturn|c","870":"flowertrick|","19":"fly|c","560":"flyingpress|c","411":"focusblast|x","116":"focusenergy|","264":"focuspunch|cp","266":"followme|","571":"forestscurse|","492":"foulplay|c","573":"freezedry|","338":"frenzyplant|","524":"frostbreath|","248":"futuresight|","380":"gastroacid|","202":"gigadrain|","416":"gigaimpact|c","893":"gigatonhammer|","862":"glaiverush|c","137":"glare|","447":"grassknot|c","803":"grassyglide|c","580":"grassyterrain|","788":"gravapple|","356":"gravity|","74":"growth|","470":"guardsplit|","385":"guardswap|","12":"guillotine|c","441":"gunkshot|","360":"gyroball|cx","359":"hammerarm|cp","912":"hardpress|c","114":"haze|","838":"headlongrush|cp","457":"headsmash|c","215":"healbell|o","361":"healingwish|","505":"healpulse|l","535":"heatcrash|c","257":"heatwave|w","484":"heavyslam|c","270":"helpinghand|","506":"hex|","667":"highhorsepower|c","136":"highjumpkick|c","32":"horndrill|c","532":"hornleech|c","336":"howl|o","542":"hurricane|w","308":"hydrocannon|","56":"hydropump|","63":"hyperbeam|","304":"hypervoice|o","95":"hypnosis|","58":"icebeam|","423":"icefang|cb","665":"icehammer|cp","8":"icepunch|cp","420":"iceshard|","861":"icespinner|c","556":"iciclecrash|","333":"iciclespear|","196":"icywind|w","286":"imprison|","844":"infernalparade|","517":"inferno|","611":"infestation|c","275":"ingrain|","689":"instruct|","334":"irondefense|","442":"ironhead|c","231":"irontail|c","746":"jawlock|cb","857":"jetpunch|cp","588":"kingsshield|","282":"knockoff|c","869":"kowtowcleave|cs","808":"lashout|","387":"lastresort|c","854":"lastrespects|","436":"lavaplume|","348":"leafblade|cs","437":"leafstorm|","141":"leechlife|c","73":"leechseed|","791":"lifedew|","617":"lightofruin|","113":"lightscreen|","710":"liquidation|c","199":"lockon|","67":"lowkick|c","490":"lowsweep|c","855":"luminacrash|","679":"lunge|c","183":"machpunch|cp","750":"magicpowder|","478":"magicroom|","602":"magneticflux|","393":"magnetrise|","874":"makeitrain|","902":"matchagotcha|","212":"meanlook|","224":"megahorn|c","25":"megakick|c","262":"memento|","368":"metalburst|","319":"metalsound|o","794":"meteorassault|","800":"meteorbeam|","309":"meteormash|cp","208":"milkdrink|","107":"minimize|","243":"mirrorcoat|","802":"mistyexplosion|","581":"mistyterrain|","585":"moonblast|","236":"moonlight|","234":"morningsun|","866":"mortalspin|c","836":"mountaingale|","330":"muddywater|","341":"mudshot|","189":"mudslap|","595":"mysticalfire|","417":"nastyplot|","539":"nightdaze|","101":"nightshade|","400":"nightslash|cs","568":"nobleroar|o","748":"noretreat|","609":"nuzzle|c","753":"octolock|","200":"outrage|c","786":"overdrive|o","315":"overheat|","220":"painsplit|","570":"paraboliccharge|","575":"partingshot|o","371":"payback|c","195":"perishsong|o","572":"petalblizzard|w","80":"petaldance|cd","566":"phantomforce|c","42":"pinmissile|","583":"playrough|c","365":"pluck|c","305":"poisonfang|cb","398":"poisonjab|c","77":"poisonpowder|","676":"pollenpuff|x","809":"poltergeist|","860":"populationbomb|cs","884":"pounce|c","408":"powergem|","471":"powersplit|","384":"powerswap|","379":"powertrick|","681":"powertrip|c","438":"powerwhip|c","182":"protect|","94":"psychic|","706":"psychicfangs|cb","917":"psychicnoise|o","678":"psychicterrain|","427":"psychocut|s","244":"psychup|","828":"psyshieldbash|c","473":"psyshock|","780":"pyroball|x","511":"quash|","98":"quickattack|c","501":"quickguard|","483":"quiverdance|d","889":"ragefist|cp","476":"ragepowder|","873":"ragingbull|c","833":"ragingfury|","240":"raindance|","229":"rapidspin|c","534":"razorshell|cs","105":"recover|","278":"recycle|","115":"reflect|","513":"reflecttype|","156":"rest|","179":"reversal|c","863":"revivalblessing|","804":"risingvoltage|","46":"roar|o","350":"rockblast|x","397":"rockpolish|","157":"rockslide|","317":"rocktomb|","439":"rockwrecker|x","272":"roleplay|","355":"roost|","496":"round|o","533":"sacredsword|cs","219":"safeguard|","864":"saltcure|","201":"sandstorm|w","328":"sandtomb|","503":"scald|","799":"scaleshot|","184":"scaryface|","815":"scorchingsands|","103":"screech|o","402":"seedbomb|x","69":"seismictoss|c","120":"selfdestruct|","247":"shadowball|x","421":"shadowclaw|cs","325":"shadowpunch|cp","425":"shadowsneak|c","880":"shedtail|","329":"sheercold|","801":"shellsidearm|","504":"shellsmash|","842":"shelter|","508":"shiftgear|","493":"simplebeam|","47":"sing|o","285":"skillswap|","806":"skittersmack|c","143":"skyattack|","303":"slackoff|","163":"slash|cs","79":"sleeppowder|","214":"sleeptalk|","188":"sludgebomb|x","482":"sludgewave|","479":"smackdown|","684":"smartstrike|c","779":"snaptrap|c","555":"snarl|o","745":"snipeshot|","173":"snore|o","883":"snowscape|","487":"soak|","76":"solarbeam|","669":"solarblade|cs","664":"sparklingaria|o","683":"speedswap|","858":"spicyextract|","191":"spikes|","596":"spikyshield|","789":"spiritbreak|c","662":"spiritshackle|","180":"spite|","255":"spitup|","446":"stealthrock|","796":"steelbeam|","798":"steelroller|c","211":"steelwing|c","564":"stickyweb|","254":"stockpile|","707":"stompingtantrum|c","830":"stoneaxe|cs","444":"stoneedge|","500":"storedpower|","480":"stormthrow|c","668":"strengthsap|","81":"stringshot|","522":"strugglebug|","747":"stuffcheeks|","78":"stunspore|","164":"substitute|","389":"suckerpunch|c","241":"sunnyday|","916":"supercellslam|c","162":"superfang|c","276":"superpower|c","57":"surf|","207":"swagger|","256":"swallow|","186":"sweetkiss|","230":"sweetscent|","415":"switcheroo|","14":"swordsdance|d","235":"synthesis|","903":"syrupbomb|x","541":"tailslap|c","366":"tailwind|w","269":"taunt|","715":"tearfullook|","752":"teatime|","298":"teeterdance|d","915":"temperflare|c","805":"terrainpulse|l","168":"thief|c","37":"thrash|c","675":"throatchop|c","87":"thunder|","85":"thunderbolt|","422":"thunderfang|cb","9":"thunderpunch|cp","86":"thunderwave|","321":"tickle|","882":"tidyup|","576":"topsyturvy|","871":"torchsong|o","259":"torment|","92":"toxic|","390":"toxicspikes|","672":"toxicthread|","885":"trailblaze|c","144":"transform|","161":"triattack|","271":"trick|","567":"trickortreat|","433":"trickroom|","843":"triplearrows|","813":"tripleaxel|c","688":"tropkick|c","888":"twinbeam|","918":"upperhand|c","253":"uproar|o","369":"uturn|c","410":"vacuumwave|","474":"venoshock|","521":"voltswitch|","344":"volttackle|c","127":"waterfall|c","352":"waterpulse|l","594":"watershuriken|","323":"waterspout|","834":"wavecrash|c","311":"weatherball|x","250":"whirlpool|","18":"whirlwind|w","469":"wideguard|","528":"wildcharge|c","261":"willowisp|","273":"wish|","472":"wonderroom|","452":"woodhammer|c","388":"worryseed|","35":"wrap|c","404":"xscissor|cs","281":"yawn|","192":"zapcannon|x","428":"zenheadbutt|c","716":"zingzap|c"};
const mkey=mv=>(MDK[mv.id]||'').split('|')[0];
const wtOf=m=>{let w=WT[m.p.no]||WT[m.p.base]||50;if(m.ab==='heavy-metal')w*=2;if(m.ab==='light-metal')w/=2;return w};
const MCHG=new Set(['solarbeam','solarblade','meteorbeam','electroshot','skyattack','fly','dig','dive','bounce','phantomforce']);
const MRECH=new Set(['hyperbeam','gigaimpact','blastburn','frenzyplant','hydrocannon','rockwrecker']);
const MSELFKO=new Set(['explosion','selfdestruct','mistyexplosion','finalgambit']);
const MFIRST=new Set(['fakeout','firstimpression']);
const MFAIL=new Set(['belch','lastresort','steelroller','snore','focuspunch']);
/* 条件つきで威力2倍：計算画面のチェックで指定（模擬戦では使わない） */
const MCOND={payback:'相手より後に動く',avalanche:'先に相手から攻撃を受けている',assurance:'このターン、相手がすでにダメージを受けている',stompingtantrum:'前のターンに自分の技が失敗した',temperflare:'前のターンに自分の技が失敗した',lashout:'このターンに能力を下げられた',boltbeak:'相手より先に動く',fishiousrend:'相手より先に動く',ficklebeam:'威力2倍が出た（30%の確率）'};
const MCOUNT={ragefist:['攻撃を受けた回数',6],lastrespects:['倒れた味方の数',5]};
/* 自動の型づくり・相手の技選びでの使いやすさ（ためる・反動で動けない・自分が倒れる技などは下げる） */
function simF(b,mv){
  const k=mkey(mv);
  if(MFAIL.has(k)||k==='steelroller')return 0;
  if(MFIRST.has(k))return b&&B.turn!=null&&b.inTurn!=null&&B.turn-b.inTurn>1?0:.3;
  if(k==='upperhand')return .2;
  if(MSELFKO.has(k))return .2;
  if(MCHG.has(k)){const w=B.weather&&B.weather.k;if((k==='solarbeam'||k==='solarblade')&&(w==='sun'||(b&&b.ab==='mega-sol')))return 1;if(k==='electroshot'&&w==='rain')return 1;return .45}
  if(MRECH.has(k))return .6;
  /* 型を組むとき（b なし）：必ず急所の技は1.5倍、イカサマは相手の攻撃しだいなので低めに見る */
  if(!b&&['flowertrick','wickedblow','surgingstrikes','frostbreath','stormthrow'].includes(k))return 1.5;
  if(!b&&k==='foulplay')return .55;
  return 1;
}
function varPow(a,mv,d,o){
  const k=mkey(mv),pw=mv.pow,hr=m=>m.hp/m.max;
  switch(k){
    case 'lowkick':case 'grassknot':{const w=wtOf(d);return w>=200?120:w>=100?100:w>=50?80:w>=25?60:w>=10?40:20}
    case 'heavyslam':case 'heatcrash':{const r=wtOf(a)/wtOf(d);return r>=5?120:r>=4?100:r>=3?80:r>=2?60:40}
    case 'gyroball':{const sa=effSpd(a);return sa?Math.min(150,Math.floor(25*effSpd(d)/sa)+1):1}
    case 'electroball':{const sd=effSpd(d),r=sd?Math.floor(effSpd(a)/sd):4;return r>=4?150:r>=3?120:r>=2?80:r>=1?60:40}
    case 'eruption':case 'waterspout':case 'dragonenergy':return Math.max(1,Math.floor(150*a.hp/a.max));
    case 'flail':case 'reversal':{const r=Math.floor(a.hp*48/a.max);return r<=1?200:r<=4?150:r<=9?100:r<=16?80:r<=32?40:20}
    case 'hardpress':return Math.floor(Math.floor((100*(100*Math.floor(d.hp*4096/d.max))+2047)/4096)/100)||1;
    case 'acrobatics':return a.item?pw:pw*2;
    case 'hex':case 'infernalparade':return d.status?pw*2:pw;
    case 'storedpower':case 'powertrip':return pw+20*Object.values(a.stg).reduce((x,v)=>x+(v>0?v:0),0);
    case 'weatherball':{const w=a.ab==='mega-sol'?'sun':(B.weather&&B.weather.k);return w?pw*2:pw}
    case 'payback':case 'avalanche':case 'assurance':case 'stompingtantrum':case 'temperflare':case 'boltbeak':case 'fishiousrend':return o.cond?pw*2:pw;
    case 'ragefist':return Math.min(350,pw+50*(o.cnt||0));
    case 'lastrespects':return Math.min(300,pw+50*(o.cnt||0));
  }
  return pw;
}
/* 決まったダメージを与える技（Lv50） */
function fixedDmg(a,mv,d){
  switch(mkey(mv)){
    case 'seismictoss':case 'nightshade':return 50;
    case 'superfang':case 'ruination':return Math.max(1,Math.floor(d.hp/2));
    case 'endeavor':return Math.max(0,d.hp-a.hp);
    case 'finalgambit':return a.hp;
  }
  return null;
}
/* ---- ダメージ計算（本編と同じ方式：補正は4096分の1単位で掛け合わせ、端数は五捨五超入） ---- */
const pR=x=>{const f=Math.floor(x);return x-f>.5?f+1:f};
const chM=(c,m)=>(c*m+2048)>>12;
const apM=(v,c)=>pR(v*c/4096);
const stgV=(v,s)=>s>=0?Math.floor(v*(2+s)/2):Math.floor(v*2/(2-s));
function bcalc(a,mv,d,o){
  o=o||{};const t=hitType(a,mv);
  const ig=a.ab==='mold-breaker',dab=ig?null:d.ab;
  if(dab&&ABSORB[dab]&&ABSORB[dab][0]===t)return{dmg:0,eff:0,absorb:dab};
  if(d.disg&&!ig)return{dmg:0,eff:1,disg:true};
  const mk=mkey(mv);
  let eff=mult(t,d.p.t);
  if(mk==='freezedry'&&d.p.t.includes('みず'))eff=mult(t,d.p.t.filter(x=>x!=='みず'))*2;
  if(mk==='flyingpress')eff=mult('かくとう',d.p.t)*mult('ひこう',d.p.t);
  if(!eff&&a.ab==='scrappy'&&(t==='ノーマル'||t==='かくとう')&&d.p.t.includes('ゴースト'))eff=mult(t,d.p.t.filter(x=>x!=='ゴースト'));
  if(!eff)return{dmg:0,eff:0};
  const fx=fixedDmg(a,mv,d);if(fx!=null)return{dmg:fx,eff,fixed:true};
  /* シェルアームズ：物理と特殊でダメージが大きいほうになる */
  let phys=!mv.cls;
  if(mk==='shellsidearm'){const A1=stgV(a.st[1],a.stg.atk),C1=stgV(a.st[3],a.stg.spa),B1=stgV(d.st[2],d.stg.def),D1=stgV(d.st[4],d.stg.spd);
    phys=Math.floor(Math.floor(22*90*A1)/B1)>Math.floor(Math.floor(22*90*C1)/D1)}
  const ee=mv.e||{},crit=!!o.crit||['flowertrick','frostbreath','stormthrow'].includes(mk);
  /* メガソーラー：自分の技は天気が「はれ」として扱われる */
  const wr=B.weather&&B.weather.k,w=a.ab==='mega-sol'?'sun':wr;
  /* 威力の補正 */
  const pow0=varPow(a,mv,d,o);
  let bm=4096;
  if((mk==='venoshock'||mk==='barbbarrage')&&(d.status==='psn'||d.status==='tox'))bm=chM(bm,8192);
  if(mk==='knockoff'&&d.item&&!isStone(d.item))bm=chM(bm,6144);
  if((mk==='lashout'||mk==='ficklebeam')&&o.cond)bm=chM(bm,8192);
  if(a.ab==='technician'&&pow0<=60)bm=chM(bm,6144);
  if(SKIN[a.ab]&&mv.t==='ノーマル'&&mk!=='weatherball'&&mk!=='terrainpulse')bm=chM(bm,4915);
  if(ITEMT[a.item]===t)bm=chM(bm,4915);
  if(phys&&a.item==='muscleband')bm=chM(bm,4505);
  if(!phys&&a.item==='wiseglasses')bm=chM(bm,4505);
  if(a.ab==='tough-claws'&&mfl(mv,'c'))bm=chM(bm,5325);
  if(a.ab==='iron-fist'&&mfl(mv,'p'))bm=chM(bm,4915);
  if(a.ab==='strong-jaw'&&mfl(mv,'b'))bm=chM(bm,6144);
  if(a.ab==='mega-launcher'&&mfl(mv,'l'))bm=chM(bm,6144);
  if(a.ab==='sharpness'&&mfl(mv,'s'))bm=chM(bm,6144);
  if(a.ab==='sand-force'&&wr==='sand'&&['いわ','じめん','はがね'].includes(t))bm=chM(bm,5325);
  if(t==='フェアリー'&&(a.ab==='fairy-aura'||dab==='fairy-aura'))bm=chM(bm,5448);
  const facade=mv.id===263&&['brn','psn','tox','par'].includes(a.status);
  if(facade)bm=chM(bm,8192);
  if((mk==='solarbeam'||mk==='solarblade')&&w&&w!=='sun')bm=chM(bm,2048);
  const pow=Math.max(1,apM(pow0,bm));
  /* 攻撃（急所のときは下がったランクを無視） */
  const src=ee.fp?d:a,ak=phys?'atk':'spa';
  const bp=mv.id===776;
  let as=ee.fp?d.stg.atk:bp?a.stg.def:a.stg[ak];
  /* メテオビーム・エレクトロビームは、ためるターンに特攻が1段階上がってから攻撃する */
  if((mk==='meteorbeam'||mk==='electroshot')&&!o.roll)as=Math.min(6,as+1);
  if(crit&&as<0)as=0;
  let A=stgV(ee.fp?d.st[1]:bp?a.st[2]:(phys?a.st[1]:a.st[3]),as),am=4096;
  if(phys&&(a.ab==='huge-power'||a.ab==='pure-power'))am=chM(am,8192);
  if(PINCH[a.ab]===t&&a.hp*3<=a.max)am=chM(am,6144);
  if(a.ab==='water-bubble'&&t==='みず')am=chM(am,8192);
  if(!phys&&a.ab==='solar-power'&&w==='sun')am=chM(am,6144);
  if(phys&&a.item==='choiceband')am=chM(am,6144);
  if(!phys&&a.item==='choicespecs')am=chM(am,6144);
  if(dab==='thick-fat'&&(t==='ほのお'||t==='こおり'))am=chM(am,2048);
  if((dab==='heatproof'||dab==='water-bubble')&&t==='ほのお')am=chM(am,2048);
  if(bp)am=4096;
  else if(phys&&a.ab==='hustle')A=pR(A*3/2);
  A=Math.max(1,apM(A,am));
  /* 防御（急所のときは上がったランクを無視） */
  const useDef=phys||ee.ps,dk=useDef?'def':'spd';
  let ds=d.stg[dk];if(crit&&ds>0)ds=0;
  let D=stgV(useDef?d.st[2]:d.st[4],ds),dm=4096;
  if(wr==='snow'&&useDef&&d.p.t.includes('こおり'))D=pR(D*1.5);
  if(wr==='sand'&&!useDef&&d.p.t.includes('いわ'))D=pR(D*1.5);
  if(useDef&&dab==='fur-coat')dm=chM(dm,8192);
  if(!useDef&&d.item==='assaultvest')dm=chM(dm,6144);
  D=Math.max(1,apM(D,dm));
  /* 基本ダメージ */
  let x=Math.floor(Math.floor(Math.floor(22*pow*A)/D)/50)+2;
  if(o.spread)x=apM(x,3072);
  if(o.pb)x=apM(x,1024);
  if(w==='sun'&&(t==='ほのお'||t==='みず'))x=apM(x,t==='ほのお'?6144:2048);
  if(w==='rain'&&(t==='みず'||t==='ほのお'))x=apM(x,t==='みず'?6144:2048);
  if(crit)x=Math.floor(x*1.5);
  /* 乱数（85〜100%の16段階）。o.r で段階を指定、o.roll でランダム、どちらもなければ中央付近 */
  x=Math.floor(x*(o.r?o.r:o.roll?85+rnd(16):92)/100);
  if(a.p.t.includes(t))x=apM(x,a.ab==='adaptability'?8192:6144);
  x=Math.floor(x*eff);
  if(phys&&a.status==='brn'&&a.ab!=='guts'&&!facade)x=Math.floor(x/2);
  /* 最後の補正 */
  let fm=4096;
  if(o.screen&&!crit)fm=chM(fm,o.spread?2732:2048);
  if(dab==='multiscale'&&d.hp===d.max&&!o.pb)fm=chM(fm,2048);
  if((dab==='solid-rock'||dab==='filter')&&eff>=2)fm=chM(fm,3072);
  if(a.ab==='tinted-lens'&&eff<1)fm=chM(fm,8192);
  if(a.item==='expertbelt'&&eff>=2)fm=chM(fm,4915);
  if(a.item==='lifeorb')fm=chM(fm,5324);
  x=apM(x,fm);
  return{dmg:Math.max(1,x),eff};
}
const accOf=(a,mv,d)=>{if(!mv.acc||a.ab==='no-guard'||d.ab==='no-guard')return 100;let v=mv.acc;if(a.ab==='compound-eyes')v*=1.3;if(a.ab==='hustle'&&!mv.cls)v*=.8;return v};
function aiChoose(b,foes,ally){
  if(!b.lastProt&&Math.random()<.12&&b.moves.some(m=>m.prot))return{b,mv:b.moves.find(m=>m.prot)};
  let best=null;
  b.moves.filter(m=>!m.prot).forEach(mv=>{
    const tgs=mv.tg?[null]:foes;
    tgs.forEach(t=>{
      let sc=0;const hit=mv.tg?foes:[t];
      hit.forEach(f=>{const r=bcalc(b,mv,f,{spread:mv.tg&&foes.length>1});sc+=Math.min(r.dmg*((mv.maxH>1)?(mv.minH===mv.maxH?mv.maxH:3):1),f.hp)/f.max+(r.dmg>=f.hp?.4:0)});
      if(mv.tg===2&&ally&&!ally.fainted){const r=bcalc(b,mv,ally,{spread:true});sc-=Math.min(r.dmg,ally.hp)/ally.max*1.2+(r.dmg>=ally.hp?.5:0)}
      sc*=(accOf(b,mv,foes[0]||b)/100)*(1+(mv.pri>0?.08:0))*simF(b,mv);
      sc+=Math.random()*.18;
      if(!best||sc>best.sc)best={b,mv,tg:t||foes[0],sc};
    });
  });
  return best||{b,mv:null};
}
function startBattle(){
  const me=B.myNos.map(n=>mkMon(byNo[n],'me',B.mySets[n])),op=B.opPick.map(n=>mkMon(byNo[n],'op',B.opT.sets&&B.opT.sets[n]));
  B.me={mons:me,act:[0,1]};B.op={mons:op,act:[0,1]};B.weather=null;
  B.turn=0;const lg=[`<span class="ko">${bn(op[0])}と${bn(op[1])}が 勝負をしかけてきた！</span>`];
  [me[0],me[1],op[0],op[1]].sort((x,y)=>effSpd(y)-effSpd(x)).forEach(b=>enter(b,x=>lg.push(x)));
  B.log=lg;B.se={me:0,op:0};B.plan=[];B.hit=[];B.phase='battle';B.mode='move';
}
function runTurn(){
  const lg=[];const log=x=>lg.push(x);B.turn++;B.hit=[];
  const acts=[...B.plan];
  alive(B.op).forEach(b=>{const ally=alive(B.op).find(x=>x!==b);acts.push(aiChoose(b,alive(B.me),ally))});
  acts.forEach(a=>{a.pri=a.mv?a.mv.pri:0;a.r=Math.random()});
  acts.sort((x,y)=>y.pri-x.pri||effSpd(y.b)-effSpd(x.b)||x.r-y.r);
  for(const a of acts){
    if(a.b.fainted)continue;
    a.done=true;
    const b=a.b;
    if(b.recharge){b.recharge=false;log(`${bn(b)}は 反動で 動けない！`);continue}
    const wasCharging=!!b.charging;const mv=b.charging||a.mv;b.charging=null;
    if(b.flinch){log(`${bn(b)}は ひるんで 技が 出せない！`);continue}
    if(b.status==='slp'){if(b.slpT>0){b.slpT--;log(`${bn(b)}は ぐうぐう 眠っている。`);continue}b.status=null;log(`${bn(b)}は 目を 覚ました！`)}
    if(b.status==='frz'){if(Math.random()<.2){b.status=null;log(`${bn(b)}の こおりが 溶けた！`)}else{log(`${bn(b)}は こおって 動けない！`);continue}}
    if(b.status==='par'&&Math.random()<.25){log(`${bn(b)}は 体が しびれて 動けない！`);continue}
    if(!mv||mv.prot){
      if(b.lastProt)log(`${bn(b)}の まもるは 失敗した！`);
      else{b.prot=true;b.usedProt=true;log(`${bn(b)}は まもりの かまえを とった！`)}
      continue;
    }
    const FS=foesOf(b),foes=alive(FS),ally=alive(ownOf(b)).find(x=>x!==b);
    let tgs;
    if(mv.tg===1)tgs=foes;else if(mv.tg===2)tgs=[...foes,...(ally?[ally]:[])];
    else{let t=a.tg;if(!t||t.fainted){if(!foes.length)continue;t=foes[0]}tgs=[t]}
    if(!tgs.length)continue;
    const mk=mkey(mv);
    if(!wasCharging&&MCHG.has(mk)&&simF(b,mv)<1){b.charging=mv;log(`${bn(b)}の <b>${mv.n}</b>！ ${bn(b)}は 力を ためている！`);if(mk==='meteorbeam'||mk==='electroshot')chg(b,'spa',1,log);continue}
    log(`${bn(b)}の <b>${mv.n}</b>！`);
    {const t0=tgs[0],ta=acts.find(x=>x.b===t0);let fail=MFAIL.has(mk)||mk==='steelroller'||(MFIRST.has(mk)&&B.turn-(b.inTurn||0)>1);
      if(mk==='suckerpunch'&&(!ta||ta.done||!ta.mv||ta.mv.prot||ta.mv.cls===2))fail=true;
      if(mk==='upperhand'&&(!ta||ta.done||!ta.mv||!(ta.mv.pri>0)))fail=true;
      if(mk==='poltergeist'&&!t0.item)fail=true;
      if(mk==='focuspunch'&&B.hit.includes(b))fail=true;
      if(fail){log('しかし うまく 決まらなかった！');continue}}
    const spread=tgs.length>1;let didHit=false;
    for(const t of tgs){
      if(t.fainted)continue;
      if(t.prot){log(`${bn(t)}は 攻撃を まもった！`);continue}
      if(Math.random()*100>=accOf(b,mv,t)){log(`${bn(b)}の 攻撃は 外れた！`);if(mv.e&&mv.e.cx){b.hp=Math.max(0,b.hp-Math.floor(b.max/2));log(`${bn(b)}は 反動を 受けた！`);if(!b.hp){b.fainted=true;log(`<span class="ko">${bn(b)}は たおれた！</span>`)}}continue}
      const hits=mv.maxH>1?(mv.minH===mv.maxH?mv.maxH:b.ab==='skill-link'?5:[2,2,3,3,4,5][rnd(6)]):1;
      let tot=0,eff=1,n=0,none=false,abs=null;
      for(let h=0;h<hits&&!t.fainted;h++){
        const cr=(mv.e&&mv.e.cr)||0,crit=Math.random()<[1/24,1/8,1/2,1][Math.min(3,cr)];
        const r=bcalc(b,mv,t,{roll:true,spread,crit});if(crit&&r.eff&&!r.absorb&&!r.disg)log('急所に 当たった！');
        if(r.absorb){abs=r.absorb;break}
        if(r.disg){t.disg=false;log(`${bn(t)}の ばけのかわが はがれた！`);none=true;break}
        if(!r.eff){none=true;break}
        eff=r.eff;let dm=r.dmg;
        if(t.hp===t.max&&dm>=t.hp){if(t.ab==='sturdy'&&b.ab!=='mold-breaker'){dm=t.hp-1;log(`${bn(t)}は がんじょうで もちこたえた！`)}else if(t.item==='focussash'){dm=t.hp-1;t.item=null;log(`${bn(t)}は きあいのタスキで もちこたえた！`)}}
        const real=Math.min(dm,t.hp);t.hp-=real;tot+=real;n++;
        B.hit.push(t);
        if(t.ab==='stamina')chg(t,'def',1,log,'じきゅうりょく');
        if(t.ab==='justified'&&hitType(b,mv)==='あく')chg(t,'atk',1,log,'せいぎのこころ');
        if(!t.hp)t.fainted=true;
        else if(t.item==='sitrusberry'&&t.hp*2<=t.max){t.hp=Math.min(t.max,t.hp+Math.floor(t.max/4));t.item=null;log(`${bn(t)}は オボンのみで 回復した！`)}
      }
      if(abs){
        const [ty,heal]=ABSORB[abs];
        log(`<span class="ab">${bn(t)}の ${ABN[abs]}！</span> ${hitType(b,mv)}わざを うけない`);
        if(heal&&t.hp<t.max){t.hp=Math.min(t.max,t.hp+Math.floor(t.max/4))}
        if(abs==='motor-drive')chg(t,'spe',1,log);if(abs==='sap-sipper')chg(t,'atk',1,log);if(abs==='lightning-rod')chg(t,'spa',1,log);
        continue;
      }
      if(none&&!n){log(`${bn(t)}には 効果が ないようだ…`);continue}
      if(!n)continue;
      didHit=true;
      const pc=Math.round(tot/t.max*100);
      if(t.side!==b.side&&eff>=2)B.se[b.side]++;
      const txt=eff>=2?`<span class="se">こうかは ばつぐんだ！${eff>=4?'(4倍) ':''}</span>`:eff<1?'<span class="nv">こうかは いまひとつ…</span>':'';
      log(`${txt}${bn(t)}に ${pc}%${n>1?`（${n}回）`:''}`);
      if(mv.drain>0){const hv=Math.floor(tot*mv.drain/100);b.hp=Math.min(b.max,b.hp+hv)}
      if(mv.drain<0&&!b.fainted){b.hp=Math.max(0,b.hp-Math.floor(tot*-mv.drain/100));if(!b.hp){b.fainted=true;log(`<span class="ko">${bn(b)}は 反動で たおれた！</span>`)}}
      if(t.fainted){log(`<span class="ko">${bn(t)}は たおれた！</span>`);if(b.ab==='moxie'&&!b.fainted)chg(b,'atk',1,log,'じしんかじょう')}
      else if(mv.e&&b.ab!=='sheer-force'){const e=mv.e;
        if(e.a&&Math.random()*100<e.a[1])inflict(t,e.a[0],log);
        if(e.f&&Math.random()*100<e.f)t.flinch=true;
        (e.t||[]).forEach(([k,n,c])=>{if(Math.random()*100>=c)return;if(['clear-body','white-smoke'].includes(t.ab)||(k==='atk'&&t.ab==='hyper-cutter')){log(`${bn(t)}の ${abn(t)}で 能力は 下がらない！`);return}
          chg(t,k,n,log);if(n<0&&t.ab==='defiant')chg(t,'atk',2,log,'まけんき');if(n<0&&t.ab==='competitive')chg(t,'spa',2,log,'かちき')});
        if(t.status==='frz'&&hitType(b,mv)==='ほのお'){t.status=null;log(`${bn(t)}の こおりが 溶けた！`)}}
    }
    if(MSELFKO.has(mk)&&!b.fainted){b.hp=0;b.fainted=true;log(`<span class="ko">${bn(b)}は たおれた！</span>`)}
    if(didHit&&MRECH.has(mk)&&!b.fainted)b.recharge=true;
    if(didHit&&!b.fainted&&mv.e&&mv.e.s)mv.e.s.forEach(([k,n,c])=>{if(Math.random()*100<c)chg(b,k,n,log)});
    if(b.item==='lifeorb'&&!b.fainted&&b.hp>0&&didHit){b.hp=Math.max(0,b.hp-Math.max(1,Math.floor(b.max/10)));if(!b.hp){b.fainted=true;log(`<span class="ko">${bn(b)}は いのちのたまで たおれた！</span>`)}}
    if(sideDead(B.me)||sideDead(B.op))break;
  }
  const over=sideDead(B.me)||sideDead(B.op);
  if(!over){
    if(B.weather){
      if(B.weather.k==='sand')[...alive(B.me),...alive(B.op)].forEach(m=>{if(!m.p.t.some(x=>['いわ','じめん','はがね'].includes(x))){const d=Math.max(1,Math.floor(m.max/16));m.hp=Math.max(0,m.hp-d);if(!m.hp){m.fainted=true;log(`<span class="ko">${bn(m)}は すなあらしで たおれた！</span>`)}}});
      if(--B.weather.t<=0){log('天気が もとに もどった。');B.weather=null}
    }
    [...alive(B.me),...alive(B.op)].forEach(m=>{
      if(m.status==='brn'||m.status==='psn'||m.status==='tox'){const d=m.status==='brn'?Math.floor(m.max/16):m.status==='psn'?Math.floor(m.max/8):Math.floor(m.max*(++m.toxN)/16);
        if(m.ab!=='magic-guard'&&!(m.ab==='poison-heal'&&m.status!=='brn')){m.hp=Math.max(0,m.hp-Math.max(1,d));log(`${bn(m)}は ${ST_NOW[m.status]}の ダメージを 受けた！`);if(!m.hp){m.fainted=true;log(`<span class="ko">${bn(m)}は たおれた！</span>`)}}}});
    [...alive(B.me),...alive(B.op)].forEach(m=>{if(m.ab==='speed-boost')chg(m,'spe',1,log,'かそく');if(m.item==='leftovers'&&m.hp<m.max)m.hp=Math.min(m.max,m.hp+Math.max(1,Math.floor(m.max/16)))});
  }
  [...B.me.mons,...B.op.mons].forEach(m=>{m.lastProt=m.usedProt;m.usedProt=false;m.prot=false;m.flinch=false});
  if(sideDead(B.me)||sideDead(B.op)){B.phase='end';B.won=sideDead(B.op)&&!sideDead(B.me);B.draw=sideDead(B.op)&&sideDead(B.me)}
  else{refill(B.me,log);refill(B.op,log)}
  B.log=lg;B.plan=[];B.mode='move';
}
const hpCol=r=>r>.5?'#4ec98a':r>.2?'var(--gold)':'var(--w4)';
const stgTxt=b=>{const o=[];for(const[k,n]of[['atk','攻'],['def','防'],['spa','特攻'],['spd','特防'],['spe','速']])if(b.stg[k])o.push(`${n}${b.stg[k]>0?'+':''}${b.stg[k]}`);return o.join(' ')};
function bcard(b){
  const r=b.hp/b.max;
  return `<div class="bc ${b.side}${b.fainted?' dead':''}${B.hit&&B.hit.includes(b)?' hit':''}"><div class="top"><span class="av">${stamp(b.p)}</span><div style="min-width:0"><b>${b.p.n}</b><div class="chips">${b.p.t.map(chip).join('')}</div></div></div><div class="hpb"><i style="width:${(r*100).toFixed(1)}%;background:${hpCol(r)}"></i></div>${b.status&&!b.fainted?`<span class="stchip st-${b.status}">${ST_NOW[b.status]}</span>`:''}<div class="hpt"><span>${b.side==='me'?`${b.hp} / ${b.max}`:`${Math.round(r*100)}%`}</span>${b.side==='op'&&!b.fainted?`<button class="binfo" data-info="${b.p.base||b.p.no}">相性</button>`:''}</div>${b.ab?`<div class="bab">${b.side==='me'?ABN[b.ab]+(b.item?'／'+ITEMN[b.item]:''):'特性・持ち物：？'}${stgTxt(b)?`　<span style="color:var(--gold)">${stgTxt(b)}</span>`:''}</div>`:''}</div>`;
}
const effTag=m=>m>=4?'×4':m>=2?'×2':m===0?'×0':m<1?'×½':'×1';
const clsN=['物理','特殊','変化'];
const SPN=['HP','攻撃','防御','特攻','特防','素早さ'];
const setTxt=s=>{
  const o=[];if(s.ab)o.push(`特性 ${ABN[s.ab]}${ABIMPL.has(s.ab)?'':'（戦闘では効果なし）'}`);
  o.push(s.item?`持ち物 ${ITEMN[s.item]}`:'持ち物 なし');return o.join('　');
};
const spTxt=s=>s.sp?`能力ポイント ${s.sp.map((v,i)=>v?SPN[i]+v:'').filter(Boolean).join(' ')}${s.up>=0&&s.dn>=0?`　性格 ${SPN[s.up]}↑${SPN[s.dn]}↓`:''}`:'';
function battleMenu(){
  setHeader('模擬戦（ダブル・β）','#/tools');
  const own=team.length>=4;
  V.innerHTML=`<div class="bnote"><b>ダブルバトル</b>の簡易版です。6匹から4匹を選び、前の2匹で戦います（倒れたら選んだ順に交代）。<br>技・特性は、PokeAPIの<b>Champions版習得技リスト</b>が元です（公式の発表との照合は未了）。</div>
  ${srcLine('learn','movedata','ladder','calc')}
  <div class="bnote"><b>ラダー集計の構築</b><br>「Pokémon Champions Battle Data」のラダー集計（技・特性・持ち物・能力ポイント・性格・よく一緒に使われるポケモン）から、<b>よく使われる型</b>の6匹を組みます。実在プレイヤーの構築そのものではなく、<b>集計をもとに自動で組んだ構築</b>です。集計は現行レギュレーション（M-C）のもので、このサイトの図鑑（${P.length}匹）にいるポケモンだけを使います。<br><span style="color:var(--mute)">Battle data provided by <a href="${CBD}" target="_blank" rel="noopener" style="color:var(--fg);text-decoration:underline">Pokémon Champions Battle Data</a>（非公式）</span></div>
  <div class="bnote"><b>未対応のもの</b><br>メガシンカ、状態異常、変化技（まもる以外）、ひるみ・急所、一部の技・特性・持ち物です。集計に出てくる未対応の技は、対応する技に置き換えます。持ち物は対応している約25種のみ反映します。</div>
  <div class="btns" style="flex-direction:column"><button class="btn btn-p" id="b-live">${SVG(I.zap,17)}ラダー集計の構築で対戦</button><button class="btn btn-s" id="b-rand">サンプル構築で対戦（オフラインでも可）</button><button class="btn btn-s" id="b-own" ${own?'':'disabled style="opacity:.4"'}>保存したパーティで対戦${own?'':'（4匹以上登録すると使えます）'}</button></div>
  <p class="note" id="b-msg" style="min-height:1.6em"></p>`;
  const msg=document.getElementById('b-msg'),btns=[...V.querySelectorAll('.btns .btn')];
  const busy=on=>{btns.forEach(b=>b.disabled=on);msg.textContent=on?'ラダー集計を取得しています…':''};
  const start=(my,opT,note)=>{
    const sets=my.sets||{};my.nos.forEach(n=>{if(!sets[n])sets[n]=chooseSet(byNo[n])});
    B={phase:'pick',my,mySets:sets,opT,sel:my.src==='own'?team.filter(x=>x.sel).map(x=>x.no):[],note};
    battleView();
  };
  document.getElementById('b-live').onclick=async()=>{
    busy(true);
    const my=await liveTeam(true),opT=await liveTeam(false);
    busy(false);
    if(my&&opT)start(my,opT);
    else start(genTeam(),genTeam(),'ラダー集計を取得できなかったため、サンプル構築で代用しました。'+(LIVE.err?`（${LIVE.err}）`:''));
  };
  document.getElementById('b-rand').onclick=()=>start(genTeam(),genTeam());
  document.getElementById('b-own').onclick=async()=>{
    if(!own)return;busy(true);
    const nos=team.map(x=>x.no),sets={};
    const ok=await liveInit();
    for(const n of nos){const t=teamSet(n);if(t){sets[n]=t;continue}const d=ok?await liveMon(n):null;sets[n]=buildSet(byNo[n],d,true)}
    const opT=(await liveTeam(false))||genTeam();
    busy(false);
    start({name:'あなたのパーティ',nos,sets,src:'own'},opT);
  };
}
function battlePick(){
  setHeader('選出','#/battle');
  const sel=B.sel;
  V.innerHTML=`${B.note?`<div class="bnote" style="color:var(--w2)">${B.note}</div>`:''}<p class="note" style="padding-top:14px">相手のパーティが見えています。<b>弱点を突ける4匹</b>を、出したい順にタップ。1・2番目が最初に出ます。相手の「相性」ボタンで弱点を確認できます。</p>
  <div class="blbl">相手（${B.opT.name}）　技・特性・持ち物は非公開</div>
  <div class="bteam">${B.opT.nos.map(n=>{const q=byNo[n];return `<div class="bp view"><span class="av">${stamp(q)}</span><div style="min-width:0"><b>${q.n}</b><div class="chips">${q.t.map(chip).join('')}</div></div><button class="binfo" data-info="${n}">相性</button></div>`}).join('')}</div>
  <div class="blbl" style="padding-top:18px">あなた（${B.my.name}）　${sel.length}/4</div>
  <div class="bteam one">${B.my.nos.map(n=>{const q=byNo[n],k=sel.indexOf(n),s=B.mySets[n];return `<button class="bp${k>=0?' on':''}" data-pick="${n}"><span class="av">${stamp(q)}</span><div style="min-width:0"><b>${q.n}</b><div class="chips">${q.t.map(chip).join('')}</div><div class="bsm">${setTxt(s)}</div><div class="bsm">${s.moves.map(m=>m.n).join('・')}</div>${s.sp?`<div class="bsm" style="color:var(--mute)">${spTxt(s)}</div>`:''}</div>${k>=0?`<span class="no">${k+1}</span>`:''}</button>`}).join('')}</div>
  <div class="btns"><button class="btn btn-s" id="b-reroll">型を組み直す</button><button class="btn btn-p" id="b-start" ${sel.length===4?'':'disabled style="opacity:.4"'}>バトル開始</button></div>`;
  V.querySelectorAll('[data-pick]').forEach(e=>e.onclick=()=>{const n=+e.dataset.pick,k=sel.indexOf(n);if(k>=0)sel.splice(k,1);else if(sel.length<4)sel.push(n);const y=scrY();battlePick();scrTo(0,y)});
  V.querySelectorAll('[data-info]').forEach(e=>e.onclick=ev=>{ev.stopPropagation();openSheet({no:+e.dataset.info})});
  document.getElementById('b-reroll').onclick=()=>{B.my.nos.forEach(n=>B.mySets[n]=buildSet(byNo[n],LIVE.csv[n]||null,false));const y=scrY();battlePick();scrTo(0,y)};
  document.getElementById('b-start').onclick=()=>{
    if(sel.length!==4)return;
    const mine=B.my.nos.map(n=>byNo[n]);
    const sc=q=>mine.reduce((a,m)=>a+matchup(q,m.t).diff-matchup(m,q.t).diff*.5,0)+Math.random()*3;
    B.myNos=[...sel];B.opPick=B.opT.nos.map(n=>byNo[n]).sort((a,b)=>sc(b)-sc(a)).slice(0,4).map(q=>q.no);
    startBattle();battleView();scrTo(0,0);
  };
}
function moveBtn(m,cur,opA,hint,i){
  if(m.prot)return `<button class="bm pr" data-m="${i}"><b>まもる</b><small>このターン攻撃を防ぐ（連続は失敗）</small></button>`;
  const stab=cur.p.t.includes(hitType(cur,m));
  const pp=MVU[m.id]&&MVU[m.id][4];const info=[clsN[m.cls],'威力'+m.pow+(m.maxH>1?(m.minH===m.maxH?'×'+m.maxH:'×2〜5'):''),m.acc?'命中'+m.acc:'必中',pp?'PP'+pp:''].filter(Boolean).join('・');
  const tagTg=m.tg===1?'全体':m.tg===2?'味方にも当たる':'';
  return `<button class="bm" data-m="${i}" style="background:${COL[m.t]};color:${ONC[m.t]}"><b>${m.n}</b><small>${m.t}${stab?'・一致':''}</small><small>${info}</small>${tagHTML(m.id)}${hint?`<span class="hint">${opA.map(o=>`<em>${o.p.n.slice(0,4)} ${effTag(mult(m.t,o.p.t))}</em>`).join('')}</span>`:''}</button>`;
}
function battleFight(){
  setHeader('模擬戦','#/battle');
  const myA=alive(B.me),opA=alive(B.op),k=B.plan.length,cur=myA[k];
  const bench=S=>S.mons.filter((m,i)=>!S.act.includes(i)&&!m.fainted).map(m=>m.p.n).join('、')||'なし';
  let act='';
  if(B.phase==='end'){
    const msg=B.se.me>B.se.op?'ばつぐんを多く取れていました。相性を活かした攻めができています。':B.se.me===B.se.op?'ばつぐんの回数は互角でした。選出で相手の弱点を突ける技タイプを持つポケモンを増やすと有利になります。':'相手のほうがばつぐんを多く取っていました。選出の段階で、相手の弱点を突ける技タイプを持つポケモンを選ぶと有利になります。';
    act=`<div class="bres"><h2 style="color:${B.draw?'var(--dim)':B.won?'#4ec98a':'var(--w4)'}">${B.draw?'引き分け':B.won?'勝利！':'敗北…'}</h2><p>${B.turn}ターン／ばつぐんを取った回数：あなた ${B.se.me}回、相手 ${B.se.op}回</p></div>
    <div class="bnote">${msg}</div>
    <div class="btns"><button class="btn btn-p" id="b-again">別の相手と対戦</button><button class="btn btn-s" id="b-menu">メニューへ</button></div>`;
  }else if(B.mode==='move'){
    const hint=B.hint!==false;
    act=`<div class="bact"><h3>${cur.p.n}はどうする？</h3><div class="bmoves">${cur.moves.map((m,i)=>moveBtn(m,cur,opA,hint,i)).join('')}</div>
    ${k>0?'<button class="bback" id="b-undo">← ひとつ前の選択に戻る</button>':''}
    <div style="padding-top:10px"><label class="mx2" style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" id="b-hint" ${hint?'checked':''}>相性ヒントを表示（×2＝ばつぐん）</label></div></div>`;
  }else{
    act=`<div class="bact"><h3>どの相手を狙う？</h3><div class="btg">${opA.map((o,i)=>{const m=mult(hitType(cur,B.pickMv),o.p.t),v=m>=2?['ばつぐん','#4ec98a']:m===0?['効果なし','var(--w4)']:m<1?['いまひとつ','var(--w2)']:['等倍','var(--dim)'];return `<button class="bt" data-t="${i}"><span class="av">${stamp(o.p)}</span><div style="min-width:0"><b>${o.p.n}</b><div class="mx2">残りHP ${Math.round(o.hp/o.max*100)}%</div></div><span class="verd" style="color:${v[1]}">${B.hint===false?'':v[0]+' ×'+fmt(m)}</span></button>`}).join('')}</div><button class="bback" id="b-undo">← 技を選び直す</button></div>`;
  }
  const wl=B.weather?`<span class="verd" style="color:var(--gold);margin-left:8px">${WNAME[B.weather.k]}（あと${B.weather.t}ターン）</span>`:'';
  V.innerHTML=`<div class="blbl">相手　${B.op.mons.filter(m=>!m.fainted).length}/4${wl}</div>
  <div class="bfield">${B.op.act.map(i=>i==null?'<div></div>':bcard(B.op.mons[i])).join('')}</div>
  <div class="bbench">控え：${bench(B.op)}</div>
  <div class="blbl">あなた　${B.me.mons.filter(m=>!m.fainted).length}/4</div>
  <div class="bfield">${B.me.act.map(i=>i==null?'<div></div>':bcard(B.me.mons[i])).join('')}</div>
  <div class="bbench">控え：${bench(B.me)}</div>
  ${B.log.length?`<div class="blog">${B.turn?`<p style="color:var(--mute);font-size:11px">ターン${B.turn}</p>`:''}${B.log.map(x=>`<p>${x}</p>`).join('')}</div>`:''}
  ${act}`;
  V.querySelectorAll('[data-info]').forEach(e=>e.onclick=()=>openSheet({no:+e.dataset.info}));
  const q=id=>document.getElementById(id);
  if(q('b-again'))q('b-again').onclick=()=>{const o=B.my,ms=B.mySets,sel=[...B.myNos];B={phase:'pick',my:{name:o.name,nos:o.nos},mySets:ms,opT:genTeam(),sel,note:'相手はサンプル構築です。ラダー集計の相手と戦うには、メニューから選び直してください。'};battleView()};
  if(q('b-menu'))q('b-menu').onclick=()=>{B={phase:'menu'};battleView()};
  if(q('b-hint'))q('b-hint').onchange=e=>{B.hint=e.target.checked;battleFight()};
  if(q('b-undo'))q('b-undo').onclick=()=>{if(B.mode==='target')B.mode='move';else B.plan.pop();battleFight()};
  const commit=(mv,tg)=>{
    B.plan.push({b:cur,mv,tg});
    if(B.plan.length>=myA.length){
      B.revealed=B.revealed||new Set();
      runTurn();
    }else B.mode='move';
    battleFight();scrTo(0,0);
  };
  V.querySelectorAll('[data-m]').forEach(e=>e.onclick=()=>{
    const i=+e.dataset.m,mv=cur.moves[i];
    if(mv.prot||mv.tg||opA.length===1)return commit(mv,opA[0]);
    B.pickMv=mv;B.mode='target';battleFight();
  });
  V.querySelectorAll('[data-t]').forEach(e=>e.onclick=()=>{B.mode='move';commit(B.pickMv,opA[+e.dataset.t])});
}
function battleView(){
  if(!B||!B.phase)B={phase:'menu'};
  if(B.phase==='menu')battleMenu();
  else if(B.phase==='pick')battlePick();
  else battleFight();
}


