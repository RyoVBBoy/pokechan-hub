/* ===================== 模擬戦（ダブル） ===================== */
/* 技・特性・習得技は PokeAPI（Champions版の習得技リスト）をもとにしています。公式の発表との照合は未了です。 */
const PRESETS=[]; /* 将来: 許可を得た実在の構築を {name,src,mons:[図鑑no×6]} で入れると、相手はそこからランダムに選ばれます */
const rnd=n=>Math.floor(Math.random()*n);
const shuf=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
/* 当たる回数：データ（MV）で1回になっていた連続技を直す（2026/11/13 ダメージ計算の点検）。860 ネズミざん＝1〜10回（1回ごとに命中判定）、888 ツインビーム＝2回 */
const mvObj=id=>{const a=MV[id],e=(typeof MVE!=='undefined'&&MVE[id])||{},hh={860:[1,10],888:[2,2]}[id];let drain=a[9];if(e.dr)drain=e.dr;if(e.rc)drain=-e.rc;return{id,n:a[0],t:a[1],pow:a[2],acc:a[3],cls:a[4],pri:a[5],tg:a[6],minH:hh?hh[0]:a[7],maxH:hh?hh[1]:a[8],drain,e}};
const PROT={id:0,n:'まもる',t:null,prot:true,pri:4,pow:0,acc:0,cls:2,tg:0,minH:1,maxH:1,drain:0};
/* 2026/11/24：まもる（182）とみきり（197）は計算では同じ「守る」働きだが、別の技として残す（名前・タイプ・PP・採用率・保存）。
   計算用の技は PROT の働き＋もとの技の番号 sid。保存の形に戻すときは sid を使う（前はみきりを「まもる」182 に書きかえていた） */
const PROT_IDS=new Set([182,197]);
const protMv=id=>{const sid=PROT_IDS.has(+id)?+id:182;return{...PROT,sid,n:(typeof MD!=='undefined'&&MD[sid]&&MD[sid][0])||PROT.n}};
const protSaved=m=>{const id=(m&&m.sid)||182;return{n:(typeof MD!=='undefined'&&MD[id]&&MD[id][0])||'まもる',id}};
/* うなぎのぼりの浮遊は Showdown の Pokemon#isGrounded と Smogon Calc の Champions 計算で確認。
   撃破後の能力上昇は対面評価では扱わない。実機での両効果は未確認。 */
const ABSORB={'levitate':['じめん',0],'eelevate':['じめん',0],'volt-absorb':['でんき',1],'lightning-rod':['でんき',0],'motor-drive':['でんき',0],'water-absorb':['みず',1],'dry-skin':['みず',1],'flash-fire':['ほのお',0],'sap-sipper':['くさ',0],'earth-eater':['じめん',1]};
const PINCH={blaze:'ほのお',torrent:'みず',overgrow:'くさ',swarm:'むし'};
const SKIN={pixilate:['フェアリー'],refrigerate:['こおり'],aerilate:['ひこう'],dragonize:['ドラゴン'],galvanize:['でんき']};
const WSET={drought:'sun',drizzle:'rain','sand-stream':'sand','snow-warning':'snow'};
const WSPD={chlorophyll:'sun','swift-swim':'rain','sand-rush':'sand','slush-rush':'snow'};
const WNAME={sun:'ひざしが つよい',rain:'あめが ふっている',sand:'すなあらし',snow:'ゆきが ふっている'};
const ABIMPL=new Set([...Object.keys(ABSORB),...Object.keys(PINCH),...Object.keys(SKIN),...Object.keys(WSET),...Object.keys(WSPD),
 'intimidate','clear-body','white-smoke','hyper-cutter','mirror-armor','defiant','competitive','huge-power','pure-power','hustle','compound-eyes','no-guard','technician','adaptability',
 'multiscale','solid-rock','filter','tinted-lens','tough-claws','iron-fist','strong-jaw','mega-launcher','sharpness','sand-force','solar-power','fairy-aura','parental-bond','scrappy','mega-sol','levitate','thick-fat','heatproof','water-bubble','fur-coat','sturdy','speed-boost','moxie','stamina','justified','mold-breaker','skill-link','unaware','marvel-scale','sheer-force','compound-eyes','hustle','cloud-nine','air-lock','bulletproof','soundproof','shell-armor','battle-armor','reckless','punk-rock','steely-spirit','fire-mane','purifying-salt','infiltrator','sniper','fluffy','ice-scales','aura-guard','liquid-voice','quick-feet','gale-wings','sand-veil','snow-cloak','long-reach']);
const stgM=s=>s>=0?(2+s)/2:2/(2-s);
/* ちからずく（2026/11/24）：追加効果のある技の威力が1.3倍（5325/4096）になり、その追加効果（相手の状態異常・ひるみ・能力の変化・自分の能力が上がる効果など）は起きない。
   自分の能力が下がる効果（インファイト等）・反動・吸い取る回復・急所に当たりやすい性質は追加効果ではないので残る。いのちのたまの反動は、ちからずくが働いた技のときだけ受けない。
   どの技が「追加効果のある技」かは、技ごとに書いた表（SF_SEC。一般的な「効果あり」の印 MVE の o は使わない）。
   出典：@smogon/calc 0.12.0 の Pokémon Champions の技データの secondaries（Pokémon Showdown と同じ。こおりにする効果のないチャンピオンズのフリーズドライは入らない）＋
   同じ計算の Electro Shot（エレクトロビーム：威力だけ上がり、ためる効果は残る）。第9世代の参照データであり、チャンピオンズの実機では確かめていない */
const SF_SEC=new Set(["acidspray","airslash","alluringvoice","ancientpower","appleacid","aquastep","aurawheel","axekick","barbbarrage","bite","bittermalice","blazekick","blizzard","bodyslam","bounce","breakingswipe","bugbuzz","bulldoze","burningjealousy","ceaselessedge","chargebeam","chillingwater","crosspoison","crunch","crushclaw","darkpulse","direclaw","discharge","dragonrush","drumbeating","dynamicpunch","earthpower","eeriespell","electroweb","energyball","extrasensory","fakeout","fierydance","fireblast","firefang","firelash","firepunch","flamecharge","flamethrower","flareblitz","flashcannon","focusblast","gravapple","gunkshot","heatwave","hurricane","icebeam","icefang","icepunch","iciclecrash","icywind","infernalparade","inferno","ironhead","irontail","lavaplume","liquidation","lowsweep","luminacrash","lunge","matchagotcha","meteormash","moonblast","mortalspin","mountaingale","muddywater","mudshot","mudslap","mysticalfire","nightdaze","nuzzle","playrough","poisonfang","poisonjab","pounce","psychic","psychicnoise","psyshieldbash","pyroball","rapidspin","razorshell","rockslide","rocktomb","saltcure","scald","scorchingsands","shadowball","shellsidearm","skittersmack","skyattack","sludgebomb","sludgewave","snarl","snore","sparklingaria","spiritbreak","spiritshackle","steelwing","stoneaxe","strugglebug","syrupbomb","throatchop","thunder","thunderbolt","thunderfang","thunderpunch","torchsong","trailblaze","triattack","triplearrows","tropkick","upperhand","volttackle","waterfall","waterpulse","zapcannon","zenheadbutt","zingzap"]);
const SF_POW_ONLY=new Set(['electroshot']);
const sfOn=(a,mv)=>!!(a&&mv&&a.ab==='sheer-force'&&(SF_SEC.has(mkey(mv))||SF_POW_ONLY.has(mkey(mv))));
/* メテオビーム・エレクトロビーム：使うたびに特攻が1段階上がる。1対1で何回で倒せるかは、使うごとのダメージ（mbSeq）で数える */
const MB_REP=new Set(['meteorbeam','electroshot']);
function mbSeq(a,mv,d,r,hpFn){if(!mv||!MB_REP.has(mkey(mv)))return null;const out=[];
  for(let k=0;k<6;k++){const hp0=d.hp;if(hpFn)hpFn();try{out.push(bcalc(a,mv,d,{r,useN:k}).dmg/d.max*100)}finally{d.hp=hp0}}return out}
const sfSup=(a,mv)=>!!(a&&mv&&a.ab==='sheer-force'&&SF_SEC.has(mkey(mv)));

/* ---- 持ち物（対応しているもののみ） ---- */
/* ゲームにある持ち物（メガストーン以外）。2026/11/04 依頼主の完全なリスト。こだわりハチマキ・こだわりメガネ・とつげきチョッキ・あつぞこブーツ等はゲームにない */
const CH_ITEMS=new Set(["brightpowder", "whiteherb", "quickclaw", "mentalherb", "kingsrock", "silverpowder", "focusband", "scopelens", "metalcoat", "leftovers", "softsand", "hardstone", "miracleseed", "blackglasses", "blackbelt", "magnet", "mysticwater", "sharpbeak", "poisonbarb", "nevermeltice", "spelltag", "twistedspoon", "charcoal", "dragonfang", "silkscarf", "shellbell", "stick", "widelens", "muscleband", "wiseglasses", "expertbelt", "lightclay", "lifeorb", "focussash", "zoomlens", "metronome", "ironball", "icyrock", "smoothrock", "heatrock", "damprock", "choicescarf", "shedshell", "bigroot", "rockyhelmet", "airballoon", "bindingband", "redcard", "ejectbutton", "normalgem", "terrainextender", "electricseed", "psychicseed", "mistyseed", "grassyseed", "cheriberry", "chestoberry", "pechaberry", "rawstberry", "aspearberry", "leppaberry", "oranberry", "persimberry", "lumberry", "sitrusberry", "occaberry", "passhoberry", "wacanberry", "rindoberry", "yacheberry", "chopleberry", "kebiaberry", "shucaberry", "cobaberry", "payapaberry", "tangaberry", "chartiberry", "kasibberry", "habanberry", "colburberry", "babiriberry", "roseliberry", "chilanberry", "fairyfeather", "lightball"]);
const ITEMN={choicescarf:'こだわりスカーフ',lifeorb:'いのちのたま',focussash:'きあいのタスキ',sitrusberry:'オボンのみ',leftovers:'たべのこし',
 softsand:'やわらかいすな',charcoal:'もくたん',mysticwater:'しんぴのしずく',magnet:'じしゃく',miracleseed:'きせきのタネ',nevermeltice:'とけないこおり',blackbelt:'くろおび',poisonbarb:'どくバリ',sharpbeak:'するどいくちばし',twistedspoon:'まがったスプーン',silverpowder:'ぎんのこな',hardstone:'かたいいし',spelltag:'のろいのおふだ',dragonfang:'りゅうのキバ',blackglasses:'くろいメガネ',metalcoat:'メタルコート',fairyfeather:'ようせいのハネ',silkscarf:'シルクのスカーフ',expertbelt:'たつじんのおび',muscleband:'ちからのハチマキ',wiseglasses:'ものしりメガネ',venusaurite:'フシギバナイト',charizarditex:'リザードナイトX',charizarditey:'リザードナイトY',blastoisinite:'カメックスナイト',alakazite:'フーディナイト',gengarite:'ゲンガナイト',kangaskhanite:'ガルーラナイト',pinsirite:'カイロスナイト',gyaradosite:'ギャラドスナイト',aerodactylite:'プテラナイト',ampharosite:'デンリュウナイト',scizorite:'ハッサムナイト',heracronite:'ヘラクロスナイト',houndoominite:'ヘルガナイト',tyranitarite:'バンギラスナイト',blazikenite:'バシャーモナイト',gardevoirite:'サーナイトナイト',mawilite:'クチートナイト',aggronite:'ボスゴドラナイト',medichamite:'チャーレムナイト',manectite:'ライボルトナイト',banettite:'ジュペッタナイト',absolite:'アブソルナイト',garchompite:'ガブリアスナイト',lucarionite:'ルカリオナイト',abomasite:'ユキノオナイト',swampertite:'ラグラージナイト',sceptilite:'ジュカインナイト',sablenite:'ヤミラミナイト',altarianite:'チルタリスナイト',galladite:'エルレイドナイト',audinite:'タブンネナイト',sharpedonite:'サメハダナイト',slowbronite:'ヤドランナイト',steelixite:'ハガネールナイト',pidgeotite:'ピジョットナイト',glalitite:'オニゴーリナイト',metagrossite:'メタグロスナイト',cameruptite:'バクーダナイト',lopunnite:'ミミロップナイト',salamencite:'ボーマンダナイト',beedrillite:'スピアナイト',clefablite:'ピクシナイト',victreebelite:'ウツボットナイト',starminite:'スターミナイト',dragoninite:'カイリュナイト',meganiumite:'メガニウムナイト',feraligite:'オーダイルナイト',skarmorite:'エアームドナイト',froslassite:'ユキメノコナイト',emboarite:'エンブオナイト',excadrite:'ドリュウズナイト',scolipite:'ペンドラナイト',scraftinite:'ズルズキナイト',eelektrossite:'シビルドナイト',chandelurite:'シャンデラナイト',chesnaughtite:'ブリガロナイト',delphoxite:'マフォクシナイト',greninjite:'ゲッコウガナイト',pyroarite:'カエンジシナイト',floettite:'フラエッテナイト',malamarite:'カラマネナイト',barbaracite:'ガメノデスナイト',dragalgite:'ドラミドナイト',hawluchanite:'ルチャブルナイト',drampanite:'ジジーロナイト',falinksite:'タイレーツナイト',raichunitex:'ライチュウナイトX',raichunitey:'ライチュウナイトY',chimechite:'チリーンナイト',absolitez:'アブソルナイトZ',staraptite:'ムクホークナイト',garchompitez:'ガブリアスナイトZ',lucarionitez:'ルカリオナイトZ',golurkite:'ゴルーグナイト',meowsticite:'ニャオニクスナイト',crabominite:'ケケンカニナイト',golisopite:'グソクムシャナイト',scovillainite:'スコヴィラナイト',glimmoranite:'キラフロルナイト',baxcalibrite:'セグレイブナイト',
 /* 2026/11/04 依頼主の完全なリストで追加（ゲームにある持ち物） */
 brightpowder:'ひかりのこな',whiteherb:'しろいハーブ',quickclaw:'せんせいのツメ',mentalherb:'メンタルハーブ',kingsrock:'おうじゃのしるし',focusband:'きあいのハチマキ',scopelens:'ピントレンズ',shellbell:'かいがらのすず',stick:'ながねぎ',widelens:'こうかくレンズ',lightclay:'ひかりのねんど',zoomlens:'フォーカスレンズ',metronome:'メトロノーム',ironball:'くろいてっきゅう',icyrock:'つめたいいわ',smoothrock:'さらさらいわ',heatrock:'あついいわ',damprock:'しめったいわ',shedshell:'きれいなぬけがら',bigroot:'おおきなねっこ',rockyhelmet:'ゴツゴツメット',airballoon:'ふうせん',bindingband:'しめつけバンド',redcard:'レッドカード',ejectbutton:'だっしゅつボタン',normalgem:'ノーマルジュエル',terrainextender:'グランドコート',electricseed:'エレキシード',psychicseed:'サイコシード',mistyseed:'ミストシード',grassyseed:'グラスシード',cheriberry:'クラボのみ',chestoberry:'カゴのみ',pechaberry:'モモンのみ',rawstberry:'チーゴのみ',aspearberry:'ナナシのみ',leppaberry:'ヒメリのみ',oranberry:'オレンのみ',persimberry:'キーのみ',lumberry:'ラムのみ',occaberry:'オッカのみ',passhoberry:'イトケのみ',wacanberry:'ソクノのみ',rindoberry:'リンドのみ',yacheberry:'ヤチェのみ',chopleberry:'ヨプのみ',kebiaberry:'ビアーのみ',shucaberry:'シュカのみ',cobaberry:'バコウのみ',payapaberry:'ウタンのみ',tangaberry:'タンガのみ',chartiberry:'ヨロギのみ',kasibberry:'カシブのみ',habanberry:'ハバンのみ',colburberry:'ナモのみ',babiriberry:'リリバのみ',roseliberry:'ロゼルのみ',chilanberry:'ホズのみ',lightball:'でんきだま'};
/* 画像の読み取りなどで使う持ち物の名前の表は、ゲームにある持ち物とメガストーンだけにする（ないものに読みまちがえないように） */
Object.keys(ITJ).forEach(n=>{const k=ITJ[n];if(!CH_ITEMS.has(k)&&!(typeof MEGA!=='undefined'&&MEGA[k]))delete ITJ[n]});
/* こうかばつぐんの技を半分にするきのみ（ホズのみはノーマル技なら効果に関係なく） */
const RES_BERRY={occaberry:'ほのお',passhoberry:'みず',wacanberry:'でんき',rindoberry:'くさ',yacheberry:'こおり',chopleberry:'かくとう',kebiaberry:'どく',shucaberry:'じめん',cobaberry:'ひこう',payapaberry:'エスパー',tangaberry:'むし',chartiberry:'いわ',kasibberry:'ゴースト',habanberry:'ドラゴン',colburberry:'あく',babiriberry:'はがね',roseliberry:'フェアリー',chilanberry:'ノーマル'};

const ITEMT={softsand:'じめん',charcoal:'ほのお',mysticwater:'みず',magnet:'でんき',miracleseed:'くさ',nevermeltice:'こおり',blackbelt:'かくとう',poisonbarb:'どく',sharpbeak:'ひこう',twistedspoon:'エスパー',silverpowder:'むし',hardstone:'いわ',spelltag:'ゴースト',dragonfang:'ドラゴン',blackglasses:'あく',metalcoat:'はがね',fairyfeather:'フェアリー',silkscarf:'ノーマル'};

/* ---- ラダー集計データ（Pokémon Champions Battle Data API） ----
   ブラウザから直接取得し、短時間だけ端末内に保存します（データの再配布・ミラーはしません）。
   提供元：https://championsbattledata.com （非公式。Pokémon関連企業とは無関係） */
const CBD='https://championsbattledata.com';
const nrm=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const LIVE={st:'idle',files:null,csv:{},at:null,err:{}};
/* 対戦形式：シングル（3匹選出・先発1）を基本に、ダブル（4匹選出・先発2）にも切り替えられる */
let FMT=(()=>{try{return localStorage.getItem('pcfmt')||'single'}catch(e){return'single'}})();
const PICK=()=>FMT==='single'?3:4;
const LEADN=()=>FMT==='single'?1:2;
const FMTN=()=>FMT==='single'?'シングル':'ダブル';
const FMTDIR=()=>FMT==='single'?'Singles':'Doubles';
function setFmt(f){
  if(f===FMT||(f!=='single'&&f!=='double'))return;
  FMT=f;try{localStorage.setItem('pcfmt',f)}catch(e){}
  LIVE.csv={};LIVE.err={};if(typeof META!=='undefined'){META.st='idle';META.p=null;META.rank=[];META.teams=[];META.errs=0}
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
    else if(r.category==='held_item')d.it.push([nrm(r.name)==='leek'?'Stick':r.name,pc]);/* 集計の英語名 Leek＝ながねぎ（サイトの表は stick）。2026/11/08 ネギガナイトの型でながねぎが抜けていた */
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
  const ca=lsGet('pccsv3'+FMT+no,216e5);if(ca){LIVE.csv[no]=ca;return ca}
  const fn=LIVE.files[key];if(!fn){LIVE.csv[no]=null;return null}
  try{
    const r=await fetch(CBD+'/pokemon_champions_assets/battle_data/'+FMTDIR()+'/'+encodeURIComponent(fn)+'.csv');
    if(!r.ok)throw 0;
    const d=digest(await r.text());if(!d.mv.length)throw 0;
    LIVE.csv[no]=d;lsSet('pccsv3'+FMT+no,d);return d;
  }catch(e){LIVE.csv[no]=null;LIVE.err[no]=1;return null}
}
const wpick=(arr,w)=>{let t=arr.reduce((a,x)=>a+Math.max(w(x),.001),0),r=Math.random()*t;for(const x of arr){r-=Math.max(w(x),.001);if(r<=0)return x}return arr[arr.length-1]};
const STI={'attack':1,'defense':2,'sp.atk':3,'sp.def':4,'speed':5};
/* ===== 持ち物と技の組み合わせを筋の通るものにする（2026/11/08 依頼主の指摘） =====
   集計（championsbattledata）は持ち物・技・特性の割合が別々にしか載っていない。いちばん多いものを別々に選ぶと、
   「ノーマルジュエルなのにノーマル技が1つもない」（オオニューラ）のような、だれも使っていない組み合わせになる。
   持ち物ごとに「その持ち物を持つ理由になる技・特性」（LF_REQ）を決め、
   ・4つの技に入っていれば、その持ち物にする
   ・入っていなくても、集計にその技があり、使われている割合が持ち物の割合の0.35倍以上（かつ5%以上）なら、
     いちばん割合の低い技と入れかえて、その持ち物にする（その持ち物を持つ人は、その技も使っているはずなので）
   ・どちらでもなければ、その持ち物はやめて次に多い持ち物を見る
   こだわり系は、まもる・変化技（トリック・へんしん等は除く）を攻撃技に入れかえる。ただし一緒に使えない技の方が多く使われていれば、こだわり系をやめる。半減きのみは、その技が弱点のときだけ。 */
const LF_BIND=['bind','wrap','firespin','whirlpool','sandtomb','infestation','magmastorm','snaptrap','thundercage'];
const LF_CHOICE_OK=['trick','switcheroo','transform'];
let LF_KEY=null;
const lfId=k=>{if(MVK[k]!==undefined)return MVK[k];if(typeof MD==='undefined')return undefined;
  if(!LF_KEY){LF_KEY={};for(const i in MD)if(MD[i]&&MD[i][3])LF_KEY[MD[i][3]]=+i}return LF_KEY[k]};
const lfAtk=id=>id&&MV[id]?{t:MV[id][1],k:id}:null;
const lfDrain=id=>id&&((typeof MVE!=='undefined'&&MVE[id]&&MVE[id].dr)||(MV[id]&&MV[id][9]>0));
function lfReq(it,p,abs){
  /* フェアリースキン等はノーマル技のタイプが変わる（ニンフィアのハイパーボイス＝フェアリー技） */
  const skin=[...abs].map(a=>SKIN[a]).find(Boolean);
  const T=(typeof ITEMT!=='undefined'&&ITEMT[it])||(it==='normalgem'?'ノーマル':null);
  if(T)return{mv:x=>{const a=lfAtk(x.id);return !!a&&(a.t===T||(skin&&a.t==='ノーマル'&&skin[0]===T&&it!=='normalgem'))}};
  if(it==='bigroot')return{mv:x=>lfDrain(x.id)};
  if(it==='bindingband')return{mv:x=>LF_BIND.includes(x.k)};
  if(it==='lightclay')return{mv:x=>['reflect','lightscreen','auroraveil'].includes(x.k)};
  if(it==='heatrock')return{mv:x=>x.k==='sunnyday',ab:['drought']};
  if(it==='damprock')return{mv:x=>x.k==='raindance',ab:['drizzle']};
  if(it==='smoothrock')return{mv:x=>x.k==='sandstorm',ab:['sand-stream','sandstream']};
  if(it==='icyrock')return{mv:x=>['snowscape','chillyreception'].includes(x.k),ab:['snow-warning','snowwarning']};
  if(it==='terrainextender')return{mv:x=>/terrain$/.test(x.k),ab:['electric-surge','grassy-surge','psychic-surge','misty-surge']};
  if(typeof RES_BERRY!=='undefined'&&RES_BERRY[it]&&it!=='chilanberry')return{ok:()=>typeof mult!=='function'||mult(RES_BERRY[it],p.t)>=2};
  return null;
}
/* d＝集計、ab＝特性、order＝持ち物を見る順（null なら多い順）。戻り値 {item, moves:[{k,id,pc}]（4つまで、多い順）} */
function liveFit(p,d,ab,order){
  /* 特性は選んだもの＋集計で20%以上のもの（天気を作る特性で、あついいわ等を持つ理由になる） */
  const abs=new Set([ab,...(d.ab||[]).filter(x=>x[1]>=20).map(x=>ABK[nrm(x[0])])].filter(Boolean));
  const lsl=typeof LSD!=='undefined'&&LSD[p.no]?LSD[p.no][1]:null;
  const pool=d.mv.map(([n,pc])=>{const k=nrm(n),id=lfId(k);return{k,id,pc}}).filter(x=>x.id!==undefined&&(x.id===0||!lsl||lsl.includes(x.id)));
  const top4=pool.slice(0,4);
  const items=(order||d.it.map(([n,pc])=>[nrm(n),pc])).filter(x=>ITEMN[x[0]]&&itemFor(p.no,x[0]));
  for(const [it,ipc] of items){
    let mv=[...top4];
    if(/^choice/.test(it)){
      const bad=mv.filter(x=>x.id===0||(!MV[x.id]&&!LF_CHOICE_OK.includes(x.k)));
      /* 一緒に使えない技（まもる・積み技等）の方が多く使われていれば、多数派はその技を使う人なので、こだわり系をやめる */
      if(bad.some(x=>x.pc>ipc))continue;
      if(bad.length){const rest=pool.filter(x=>!mv.includes(x)&&(MV[x.id]||LF_CHOICE_OK.includes(x.k))&&x.pc>=5);
        if(rest.length<bad.length)continue;
        mv=mv.filter(x=>!bad.includes(x)).concat(rest.slice(0,bad.length))}
      return{item:it,moves:mv}}
    const r=lfReq(it,p,abs);
    if(!r)return{item:it,moves:mv};
    if(r.ok){if(r.ok())return{item:it,moves:mv};continue}
    if((r.ab&&r.ab.some(a=>abs.has(a)))||mv.some(r.mv))return{item:it,moves:mv};
    const c=pool.find(x=>!mv.includes(x)&&r.mv(x)&&x.pc>=Math.max(5,ipc*.35));
    if(c){const low=mv.reduce((a,x)=>x.pc<a.pc?x:a,mv[0]);if(low){mv=mv.map(x=>x===low?c:x).sort((a,b)=>b.pc-a.pc);return{item:it,moves:mv}}}
  }
  /* どの持ち物も筋が通らなければ、前と同じ（いちばん多い持ち物と上から4つの技） */
  return{item:items.length?items[0][0]:null,moves:top4};
}
/* 集計データから型を1つ組む。top=true なら最頻の型、false なら使用率に応じてランダム */
function buildSet(p,d,top){
  /* 2026/11/12 依頼主（総合評価が開くたびに変わる）：使用率の高い型（top）は土台の型も乱数なしで組む。
     前は chooseSet(p) が乱数で特性・技を選び、集計に特性がない匹や技が4つそろわない匹の型が毎回変わっていた */
  const base=chooseSet(p,top);
  if(!d)return base;
  let ab=base.ab;
  const abl=d.ab.map(([n,pc])=>[ABK[nrm(n)],pc]).filter(x=>x[0]);
  if(abl.length)ab=top?abl[0][0]:wpick(abl,x=>x[1])[0];
  const pool=d.mv.map(([n,pc])=>[MVK[nrm(n)],pc]).filter(x=>x[0]!==undefined);
  /* 持ち物は技と筋の通る組み合わせで決める（liveFit）。ランダムのときは持ち物を割合に応じて1つ選んでから、合わなければ次へ */
  const itl0=d.it.map(([n,pc])=>[nrm(n),pc]).filter(x=>ITEMN[x[0]]&&itemFor(p.no,x[0]));
  let order=null;if(!top&&itl0.length){const f=wpick(itl0,x=>x[1]);order=[f,...itl0.filter(x=>x!==f)]}
  const F=liveFit(p,d,ab,order);
  const moves=[];
  const left=[...pool];
  /* liveFit が選んだ技（攻撃技とまもる）を先に入れる。ランダムのときは持ち物に要る技だけ先に入れる */
  const need=top?F.moves:F.moves.filter(x=>!d.mv.slice(0,4).some(([n])=>nrm(n)===x.k));
  for(const x of need){if(moves.length>=4)break;const q=left.find(y=>y[0]===x.id);if(q){left.splice(left.indexOf(q),1);moves.push(q[0]===0?PROT:mvObj(q[0]))}}
  while(moves.length<4&&left.length){
    const x=top?left[0]:wpick(left,y=>y[1]);left.splice(left.indexOf(x),1);
    moves.push(x[0]===0?PROT:mvObj(x[0]));
  }
  if(moves.filter(m=>!m.prot).length===0)return {...base,ab};
  for(const m of base.moves){if(moves.length>=4)break;if(!moves.some(x=>x.id===m.id&&x.n===m.n))moves.push(m)}
  let item=F.item;
  let sp=null,up=-1,dn=-1;
  if(d.sp.length){
    const s1=top?d.sp[0]:wpick(d.sp.slice(0,6),x=>x[1]);sp=s1[0];
    const sidx=x=>STI[nrm(x).replace(/^spatk$/,'sp.atk').replace(/^spdef$/,'sp.def')];
    const ok=d.nat.filter(([u,w])=>{const ui=sidx(u),wi=sidx(w);return !((ui===1&&!sp[1])||(ui===3&&!sp[3])||(wi!==undefined&&sp[wi]>=20))});
    const pickN=ok.length?(top?ok[0]:wpick(ok,x=>x[2])):null;
    if(pickN){up=sidx(pickN[0])??-1;dn=sidx(pickN[1])??-1}
  }
  /* 積み技（計算の技には入らない変化技）：よく使われる技の上位6つにあれば覚えておく（duel が使う） */
  const bk=typeof DU_BOOST!=='undefined'?d.mv.slice(0,6).filter(([n,pc])=>pc>=25).map(([n])=>nrm(n)).find(k=>DU_BOOST[k]):null;
  return{ab,moves,item,sp,up,dn,boost:bk||null};
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
  /* メガシンカの姿は、元の姿の覚える技＋メガシンカ後の特性＋そのメガストーン（2026/11/20：前はメガの番号で技を探して見つからず、タイプの名前の仮の技「〇〇わざ」で計算していた） */
  const lb=learnBase(p),mg=lb!==p;
  const ab=mg?[[p.ab,0]]:(ABD[p.no]||[]);const ab0=ab.filter(a=>!a[1]);const abk=(ab0.length?ab0:ab).length?(ab0.length?ab0:ab)[det?0:rnd((ab0.length?ab0:ab).length)][0]:null;
  const ls=LSD[lb.no];
  /* 覚える技が分からない姿は型を作らない（仮の技で計算しない）。呼ぶ側が理由を出す */
  if(!ls)return null;
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
  return mg?{ab:abk,item:p.stone,moves:chosen}:{ab:abk,moves:chosen};
}
/* 戦闘中にだけ変わる姿の能力（種族値） */
const BATTLE_FORM={'zero-to-hero':{no:964,s:[100,160,97,106,87,100],always:true,name:'マイティフォルム'},'stance-change':{no:681,s:[60,140,50,140,50,60],name:'ブレードフォルム'}};
/* 図鑑に出す「戦闘中に変わる姿」（パーティには入れられない姿。2026/11/04 依頼主のリストとの照らし合わせで追加） */
const BATTLE_FORMS={351:{why:'特性てんきやで、天気によってタイプが変わります（能力は変わりません）。',forms:[['たいようのすがた','ほのお','はれ'],['あまみずのすがた','みず','あめ'],['ゆきぐものすがた','こおり','ゆき']]},
  681:{why:'特性バトルスイッチで、攻撃技を使うとブレードフォルム、キングシールドを使うとシールドフォルムになります。当サイトの計算では、攻撃するときはブレードフォルム、攻撃を受けるときはシールドフォルムの能力を使います。',forms:[['ブレードフォルム',null,null,[60,140,50,140,50,60]]]},
  964:{why:'特性マイティチェンジで、一度控えに戻るとマイティフォルムになります。当サイトの計算は、マイティフォルムの能力で行います。',forms:[['マイティフォルム',null,null,[100,160,97,106,87,100]]]}};
function battleFormHTML(p){const b=BATTLE_FORMS[p.no];if(!b)return '';
  return `<div class="sec"><h2>戦闘中に変わる姿</h2></div><p class="note" style="padding-top:0">${b.why}</p>
  ${b.forms.map(([n,t,w,s])=>`<div class="row" style="cursor:default"><div class="row-m"><div class="row-t">${p.n.replace(/（.*$/,'')}（${n}）</div><div class="chips">${(t?[t]:p.t).map(chip).join('')}${w?`<span class="rt">${w}のとき</span>`:''}</div>${s?`<div class="row-s">${SN.map((x,i)=>`${x}${s[i]}`).join('・')}（合計${s.reduce((a,c)=>a+c,0)}）</div>`:''}</div></div>`).join('')}`}
function mkMon(p,side,set){
  set=set||chooseSet(p);
  if(!set)throw new Error('form:insufficient-data');
  /* 姿は resolveForm で決める（2026/11/20）。メガストーンを持っていれば、メガシンカ後の姿で計算する（1回の対戦でメガシンカできるのは1匹だけ）。
     持ち物が姿と合わないときは formErr に理由を残す（計算の結果を出す画面は、これを見て結果を出さない） */
  const R=resolveForm(p.no,set.item);let formErr=null;
  if(R.ok&&R.mega){
    p=set.evolve===false?R.base:R.form;
    const abs=ABD[p.no]||[];
    const ab=p.mega?p.ab:abs.some(([k])=>k===set.ab)?set.ab:(abs.find(([,hidden])=>!hidden)||abs[0])?.[0]||null;
    // メガシンカしない場合も石は持ったまま。持ち物の有無で変わる技に反映する。
    set={...set,item:R.stone,ab};
  }
  else if(!R.ok)formErr=R.why;
  const stOf=q=>{if(set.sp)return calcStats(q,set.sp,set.up??-1,set.dn??-1);const phys=p.s[1]>=p.s[3],ai=phys?1:3,sp=[2,0,0,0,0,0];sp[ai]=32;sp[5]=32;return calcStats(q,sp,ai,phys?3:1)};
  let st=stOf(p),stAtk=null;
  /* 戦闘中に変わる姿（2026/11/04 データの見直し）：イルカマンは一度交代するとマイティフォルムになるので、その能力で計算。
     ギルガルドは攻撃するときだけブレードフォルム（攻撃・特攻140／防御・特防50）になるので、攻撃側の能力を別に持つ（受けるときはシールドフォルム） */
  const bf=BATTLE_FORM[set.ab];if(bf&&bf.no===p.no){const q={...p,s:bf.s};if(bf.always)st=stOf(q);else stAtk=stOf(q)}
  return{p,side,st,stAtk,hp:st[0],max:st[0],moves:set.moves,boost:set.boost||null,uncalc:set.uncalc||null,ab:set.ab,item:set.item||null,stg:{atk:0,def:0,spa:0,spd:0,spe:0},prot:false,usedProt:false,lastProt:false,fainted:false,disg:set.ab==='disguise',formErr};
}
let B={phase:'menu'};
const alive=S=>S.act.filter(i=>i!=null).map(i=>S.mons[i]).filter(m=>!m.fainted);
const bn=b=>(b.side==='op'?'相手の':'')+b.p.n;
const abn=b=>ABN[b.ab]||'';
const sideDead=S=>S.mons.every(m=>m.fainted);
const foesOf=b=>b.side==='me'?B.op:B.me, ownOf=b=>b.side==='me'?B.me:B.op;
/* はやあし：状態異常のとき1.5倍で、まひで遅くならない（2026/11/24） */
const effSpd=(b,opp)=>Math.floor(b.st[5]*stgM(b.stg.spe)*(WSPD[b.ab]&&WSPD[b.ab]===wxEffK(b,opp)?2:1)*(b.item==='choicescarf'?1.5:1)*(b.item==='ironball'?.5:1)*(b.ab==='quick-feet'&&b.status?1.5:1)*(b.status==='par'&&b.ab!=='quick-feet'?.5:1));
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
function hitType(a,mv,d){if(a&&a.ab==='liquid-voice'&&mv&&mfl(mv,'o'))return 'みず';if(mkey(mv)==='ragingbull'&&a.p){const rb={10250:'かくとう',10251:'ほのお',10252:'みず'}[a.p.no];if(rb)return rb}if(mkey(mv)==='weatherball'){const w=a.ab==='mega-sol'?'sun':wxEffK(a,d);if(w)return{sun:'ほのお',rain:'みず',sand:'いわ',snow:'こおり'}[w]}return SKIN[a.ab]&&mv.t==='ノーマル'&&!['terrainpulse','weatherball'].includes(mkey(mv))?SKIN[a.ab][0]:mv.t}
/* ---- 条件で威力が変わる技 ---- */
const WT={"3":100,"6":90.5,"9":85.5,"15":29.5,"18":39.5,"24":65,"25":6,"26":30,"10100":21,"36":40,"38":19.9,"10104":19.9,"40":12,"45":18.6,"53":32,"10108":33,"863":28,"59":155,"10230":168,"186":33.9,"65":48,"68":130,"71":15.5,"80":78.5,"10165":70.5,"199":79.5,"10172":79.5,"83":15,"865":117,"94":40.5,"208":400,"464":282.8,"115":80,"121":80,"122":54.5,"866":58.2,"212":118,"900":89,"127":55,"128":88.4,"10250":115,"10251":85,"10252":110,"130":235,"132":4,"134":29,"135":24.5,"136":25,"196":26.5,"197":27,"470":25.5,"471":25.9,"700":23.5,"142":59,"143":460,"149":210,"154":100.5,"157":79.5,"10233":69.8,"160":88.8,"168":33.5,"181":61.5,"184":28.5,"981":160,"205":125.8,"472":42.5,"211":3.9,"904":60.5,"214":54,"461":34,"903":43,"473":291,"227":50.5,"229":35,"899":95.1,"248":202,"254":52.2,"257":52,"260":81.9,"279":28,"282":48.4,"475":52,"302":11,"303":11.5,"306":360,"308":31.5,"310":40.2,"407":14.5,"317":80,"319":88.8,"323":220,"324":80.4,"334":20.6,"350":162,"351":0.8,"354":12.5,"358":1,"359":47,"362":256.5,"478":26.6,"373":102.6,"376":550,"389":310,"392":55,"395":84.5,"398":24.9,"405":42,"409":102.5,"411":149.5,"428":33.3,"442":108,"445":95,"448":54,"450":300,"454":44.4,"460":135.5,"479":0.3,"10008":0.3,"10009":0.3,"10010":0.3,"10011":0.3,"10012":0.3,"497":63,"500":150,"503":94.6,"10236":58.2,"505":27,"510":37.5,"512":30.5,"514":28,"516":29,"518":60.5,"530":40.4,"531":31,"534":87,"545":200.5,"547":6.6,"902":110,"10248":110,"553":96.3,"560":30,"563":76.5,"867":66.6,"569":107.3,"571":81.1,"10239":73,"579":20.1,"584":57.5,"587":5,"604":80.5,"609":34.3,"614":260,"618":11,"10180":20.5,"623":330,"635":160,"637":46,"652":90,"655":39,"658":40,"660":42.4,"663":24.5,"666":17,"668":81.5,"10061":0.9,"671":10,"673":91,"675":136,"676":28,"678":8.5,"681":53,"683":15.5,"685":5,"687":47,"689":96,"691":81.5,"693":35.3,"695":21,"697":270,"699":225,"701":21.5,"702":2.2,"706":150.5,"10242":334.1,"707":3,"709":71,"711":12.5,"10030":9.5,"10031":14,"10032":39,"713":505,"10243":262.4,"715":85,"724":36.6,"10244":37,"727":83,"730":44,"733":26,"740":180,"745":25,"10126":25,"10152":25,"748":14.5,"750":920,"752":82,"758":22.2,"763":21.4,"765":76,"766":82.8,"768":108,"778":0.7,"780":185,"784":78.2,"812":90,"815":33,"818":45.2,"823":75,"828":19.9,"841":1,"842":13,"844":65.5,"849":40,"10184":40,"853":39,"855":0.4,"858":5.1,"861":61,"869":0.5,"870":62,"871":1,"876":28,"10186":28,"877":3,"887":50,"908":31.2,"911":326.5,"914":61.9,"972":15,"956":90,"964":60.2,"930":48.2,"952":15,"939":113,"968":310,"925":2.3,"998":210,"923":41,"931":2.4,"10260":2.4,"10261":2.4,"10262":2.4,"934":240,"970":45,"943":61,"1000":30,"959":112.8,"936":85,"937":62,"983":120,"979":56,"1013":2.2,"1018":60,"1019":93,"10025":8.5,"10033":155.5,"10034":110.5,"10035":100.5,"10036":101.1,"10037":48,"10038":40.5,"10039":100,"10040":59,"10041":305,"10042":79,"10045":61.5,"10046":125,"10047":62.5,"10048":49.5,"10049":255,"10050":52,"10051":48.4,"10052":23.5,"10053":395,"10054":31.5,"10055":44,"10056":13,"10057":49,"10058":95,"10059":57.5,"10060":185,"10064":102,"10065":55.2,"10066":161,"10067":20.6,"10068":56.4,"10069":32,"10070":130.3,"10071":120,"10072":740,"10073":50.5,"10074":350.2,"10076":942.9,"10087":320.5,"10088":28.3,"10089":112.6,"10090":40.5,"10278":42.3,"10279":125.5,"10280":80,"10281":290,"10282":201,"10283":108.8,"10284":40.4,"10285":29.6,"10286":180.3,"10287":60,"10288":230.5,"10289":31,"10290":180,"10291":69.6,"10292":90,"10293":39,"10294":40,"10295":93.3,"10296":100.8,"10297":69.8,"10298":100,"10299":100.3,"10300":25,"10302":240.5,"10303":99,"10304":38,"10305":26,"10306":8,"10307":49,"10308":50,"10309":99,"10310":49.4,"10313":330,"10314":10.1,"10315":252.8,"10316":148,"10320":22,"10321":77,"10325":315,"10326":10.1};
/* 技の英語ID｜性質（c接触 pパンチ bかみつき l波動 s切る o音 w風 x弾 dおどり） */
const MDK={"709":"accelerock|c","151":"acidarmor|","491":"acidspray|x","512":"acrobatics|c","367":"acupressure|","332":"aerialace|cs","495":"afteryou|","97":"agility|","314":"aircutter|sw","403":"airslash|s","914":"alluringvoice|o","502":"allyswitch|","133":"amnesia|","246":"ancientpower|","787":"appleacid|","895":"aquacutter|s","453":"aquajet|c","392":"aquaring|","872":"aquastep|cd","401":"aquatail|c","890":"armorcannon|","597":"aromaticmist|","372":"assurance|c","213":"attract|","396":"aurasphere|lx","783":"aurawheel|","694":"auroraveil|","419":"avalanche|c","853":"axekick|c","608":"babydolleyes|","661":"banefulbunker|","839":"barbbarrage|","226":"batonpass|","690":"beakblast|x","251":"beatup|","562":"belch|","187":"bellydrum|","20":"bind|c","44":"bite|cb","891":"bitterblade|cs","841":"bittermalice|","307":"blastburn|","299":"blazekick|c","59":"blizzard|w","335":"block|","776":"bodypress|c","34":"bodyslam|c","198":"bonerush|","586":"boomburst|o","340":"bounce|c","413":"bravebird|c","784":"breakingswipe|c","280":"brickbreak|c","693":"brutalswing|c","450":"bugbite|c","405":"bugbuzz|o","339":"bulkup|","523":"bulldoze|","418":"bulletpunch|cp","331":"bulletseed|x","807":"burningjealousy|","682":"burnup|","347":"calmmind|","845":"ceaselessedge|cs","268":"charge|","451":"chargebeam|","204":"charm|","886":"chillingwater|","881":"chillyreception|","509":"circlethrow|c","691":"clangingscales|o","775":"clangoroussoul|od","499":"clearsmog|","370":"closecombat|c","811":"coaching|","489":"coil|","894":"comeuppance|c","109":"confuseray|","383":"copycat|","810":"corrosivegas|","322":"cosmicpower|","538":"cottonguard|","178":"cottonspore|","68":"counter|c","756":"courtchange|","343":"covet|c","152":"crabhammer|c","238":"crosschop|c","440":"crosspoison|cs","242":"crunch|cb","306":"crushclaw|cs","174":"curse|","663":"darkestlariat|c","399":"darkpulse|l","605":"dazzlinggleam|","777":"decorate|","432":"defog|","194":"destinybond|","197":"detect|","91":"dig|c","827":"direclaw|cs","50":"disable|","435":"discharge|","291":"dive|c","38":"doubleedge|c","458":"doublehit|c","892":"doubleshock|cp","104":"doubleteam|","434":"dracometeor|","913":"dragoncheer|o","337":"dragonclaw|cs","349":"dragondance|d","751":"dragondarts|","406":"dragonpulse|l","407":"dragonrush|c","525":"dragontail|c","577":"drainingkiss|c","409":"drainpunch|cp","65":"drillpeck|c","529":"drillrun|c","778":"drumbeating|","814":"dualwingbeat|c","223":"dynamicpunch|cp","414":"earthpower|","89":"earthquake|","598":"eerieimpulse|","826":"eeriespell|o","604":"electricterrain|","582":"electrify|","486":"electroball|x","905":"electroshot|","527":"electroweb|","227":"encore|","283":"endeavor|c","203":"endure|","412":"energyball|x","494":"entrainment|","284":"eruption|","797":"expandingforce|","153":"explosion|","326":"extrasensory|","245":"extremespeed|c","263":"facade|c","587":"fairylock|","252":"fakeout|c","313":"faketears|","297":"featherdance|d","364":"feint|","565":"fellstinger|c","907":"ficklebeam|","552":"fierydance|d","515":"finalgambit|","126":"fireblast|","424":"firefang|cb","680":"firelash|c","7":"firepunch|cp","83":"firespin|","660":"firstimpression|c","90":"fissure|","175":"flail|c","488":"flamecharge|c","53":"flamethrower|","394":"flareblitz|c","430":"flashcannon|","260":"flatter|","374":"fling|","812":"flipturn|c","870":"flowertrick|","19":"fly|c","560":"flyingpress|c","411":"focusblast|x","116":"focusenergy|","264":"focuspunch|cp","266":"followme|","571":"forestscurse|","492":"foulplay|c","573":"freezedry|","338":"frenzyplant|","524":"frostbreath|","248":"futuresight|","380":"gastroacid|","202":"gigadrain|","416":"gigaimpact|c","893":"gigatonhammer|","862":"glaiverush|c","137":"glare|","447":"grassknot|c","803":"grassyglide|c","580":"grassyterrain|","788":"gravapple|","356":"gravity|","74":"growth|","470":"guardsplit|","385":"guardswap|","12":"guillotine|c","441":"gunkshot|","360":"gyroball|cx","359":"hammerarm|cp","912":"hardpress|c","114":"haze|","838":"headlongrush|cp","457":"headsmash|c","215":"healbell|o","361":"healingwish|","505":"healpulse|l","535":"heatcrash|c","257":"heatwave|w","484":"heavyslam|c","270":"helpinghand|","506":"hex|","667":"highhorsepower|c","136":"highjumpkick|c","32":"horndrill|c","532":"hornleech|c","336":"howl|o","542":"hurricane|w","308":"hydrocannon|","56":"hydropump|","63":"hyperbeam|","304":"hypervoice|o","95":"hypnosis|","58":"icebeam|","423":"icefang|cb","665":"icehammer|cp","8":"icepunch|cp","420":"iceshard|","861":"icespinner|c","556":"iciclecrash|","333":"iciclespear|","196":"icywind|w","286":"imprison|","844":"infernalparade|","517":"inferno|","611":"infestation|c","275":"ingrain|","689":"instruct|","334":"irondefense|","442":"ironhead|c","231":"irontail|c","746":"jawlock|cb","857":"jetpunch|cp","588":"kingsshield|","282":"knockoff|c","869":"kowtowcleave|cs","808":"lashout|c","387":"lastresort|c","854":"lastrespects|","436":"lavaplume|","348":"leafblade|cs","437":"leafstorm|","141":"leechlife|c","73":"leechseed|","791":"lifedew|","617":"lightofruin|","113":"lightscreen|","710":"liquidation|c","199":"lockon|","67":"lowkick|c","490":"lowsweep|c","855":"luminacrash|","679":"lunge|c","183":"machpunch|cp","750":"magicpowder|","478":"magicroom|","602":"magneticflux|","393":"magnetrise|","874":"makeitrain|","902":"matchagotcha|","212":"meanlook|","224":"megahorn|c","25":"megakick|c","262":"memento|","368":"metalburst|","319":"metalsound|o","794":"meteorassault|","800":"meteorbeam|","309":"meteormash|cp","208":"milkdrink|","107":"minimize|","243":"mirrorcoat|","802":"mistyexplosion|","581":"mistyterrain|","585":"moonblast|","236":"moonlight|","234":"morningsun|","866":"mortalspin|c","836":"mountaingale|","330":"muddywater|","341":"mudshot|","189":"mudslap|","595":"mysticalfire|","417":"nastyplot|","539":"nightdaze|","101":"nightshade|","400":"nightslash|cs","568":"nobleroar|o","748":"noretreat|","609":"nuzzle|c","753":"octolock|","200":"outrage|c","786":"overdrive|o","315":"overheat|","220":"painsplit|","570":"paraboliccharge|","575":"partingshot|o","371":"payback|c","195":"perishsong|o","572":"petalblizzard|w","80":"petaldance|cd","566":"phantomforce|c","42":"pinmissile|","583":"playrough|c","365":"pluck|c","305":"poisonfang|cb","398":"poisonjab|c","77":"poisonpowder|","676":"pollenpuff|x","809":"poltergeist|","860":"populationbomb|cs","884":"pounce|c","408":"powergem|","471":"powersplit|","384":"powerswap|","379":"powertrick|","681":"powertrip|c","438":"powerwhip|c","182":"protect|","94":"psychic|","706":"psychicfangs|cb","917":"psychicnoise|o","678":"psychicterrain|","427":"psychocut|s","244":"psychup|","828":"psyshieldbash|c","473":"psyshock|","780":"pyroball|x","511":"quash|","98":"quickattack|c","501":"quickguard|","483":"quiverdance|d","889":"ragefist|cp","476":"ragepowder|","873":"ragingbull|c","833":"ragingfury|","240":"raindance|","229":"rapidspin|c","534":"razorshell|cs","105":"recover|","278":"recycle|","115":"reflect|","513":"reflecttype|","156":"rest|","179":"reversal|c","863":"revivalblessing|","804":"risingvoltage|","46":"roar|o","350":"rockblast|x","397":"rockpolish|","157":"rockslide|","317":"rocktomb|","439":"rockwrecker|x","272":"roleplay|","355":"roost|","496":"round|o","533":"sacredsword|cs","219":"safeguard|","864":"saltcure|","201":"sandstorm|w","328":"sandtomb|","503":"scald|","799":"scaleshot|","184":"scaryface|","815":"scorchingsands|","103":"screech|o","402":"seedbomb|x","69":"seismictoss|c","120":"selfdestruct|","247":"shadowball|x","421":"shadowclaw|cs","325":"shadowpunch|cp","425":"shadowsneak|c","880":"shedtail|","329":"sheercold|","801":"shellsidearm|","504":"shellsmash|","842":"shelter|","508":"shiftgear|","493":"simplebeam|","47":"sing|o","285":"skillswap|","806":"skittersmack|c","143":"skyattack|","303":"slackoff|","163":"slash|cs","79":"sleeppowder|","214":"sleeptalk|","188":"sludgebomb|x","482":"sludgewave|","479":"smackdown|","684":"smartstrike|c","779":"snaptrap|c","555":"snarl|o","745":"snipeshot|","173":"snore|o","883":"snowscape|","487":"soak|","76":"solarbeam|","669":"solarblade|cs","664":"sparklingaria|o","683":"speedswap|","858":"spicyextract|","191":"spikes|","596":"spikyshield|","789":"spiritbreak|c","662":"spiritshackle|","180":"spite|","255":"spitup|","446":"stealthrock|","796":"steelbeam|","798":"steelroller|c","211":"steelwing|c","564":"stickyweb|","254":"stockpile|","707":"stompingtantrum|c","830":"stoneaxe|cs","444":"stoneedge|","500":"storedpower|","480":"stormthrow|c","668":"strengthsap|","81":"stringshot|","522":"strugglebug|","747":"stuffcheeks|","78":"stunspore|","164":"substitute|","389":"suckerpunch|c","241":"sunnyday|","916":"supercellslam|c","162":"superfang|c","276":"superpower|c","57":"surf|","207":"swagger|","256":"swallow|","186":"sweetkiss|","230":"sweetscent|","415":"switcheroo|","14":"swordsdance|d","235":"synthesis|","903":"syrupbomb|x","541":"tailslap|c","366":"tailwind|w","269":"taunt|","715":"tearfullook|","752":"teatime|","298":"teeterdance|d","915":"temperflare|c","805":"terrainpulse|l","168":"thief|c","37":"thrash|c","675":"throatchop|c","87":"thunder|","85":"thunderbolt|","422":"thunderfang|cb","9":"thunderpunch|cp","86":"thunderwave|","321":"tickle|","882":"tidyup|","576":"topsyturvy|","871":"torchsong|o","259":"torment|","92":"toxic|","390":"toxicspikes|","672":"toxicthread|","885":"trailblaze|c","144":"transform|","161":"triattack|","271":"trick|","567":"trickortreat|","433":"trickroom|","843":"triplearrows|","813":"tripleaxel|c","688":"tropkick|c","888":"twinbeam|","918":"upperhand|c","253":"uproar|o","369":"uturn|c","410":"vacuumwave|","474":"venoshock|","521":"voltswitch|","344":"volttackle|c","127":"waterfall|c","352":"waterpulse|l","594":"watershuriken|","323":"waterspout|","834":"wavecrash|c","311":"weatherball|x","250":"whirlpool|","18":"whirlwind|w","469":"wideguard|","528":"wildcharge|c","261":"willowisp|","273":"wish|","472":"wonderroom|","452":"woodhammer|c","388":"worryseed|","35":"wrap|c","404":"xscissor|cs","281":"yawn|","192":"zapcannon|x","428":"zenheadbutt|c","716":"zingzap|c"};
const mkey=mv=>(MDK[mv.id]||'').split('|')[0];
const wtOf=m=>{let w=WT[m.p.no]||WT[m.p.base]||50;if(m.ab==='heavy-metal')w*=2;if(m.ab==='light-metal')w/=2;return w};
const MCHG=new Set(['solarbeam','solarblade','meteorbeam','electroshot','skyattack','fly','dig','dive','bounce','phantomforce']);
const MRECH=new Set(['hyperbeam','gigaimpact','blastburn','frenzyplant','hydrocannon','rockwrecker','meteorassault']);
/* 1回の使用に何ターンかかる技か（2026/11/24）：'charge'＝ためるターンがある（はれのソーラービーム・あめのエレクトロビーム・メガソーラーは除く）、'recharge'＝使った次のターン動けない。
   1対1の撃ち合い（duTurns）で、相手が動けるターンとして数える。本編の決まり＝前提（パワフルハーブはゲームの持ち物に無い） */
const mvTurnK=(a,mv,d)=>{const k=mkey(mv);if(MCHG.has(k)){const w=wxEffK(a,d);if((k==='solarbeam'||k==='solarblade')&&(w==='sun'||(a&&a.ab==='mega-sol')))return null;if(k==='electroshot'&&w==='rain')return null;return'charge'}return MRECH.has(k)?'recharge':null};
const MSELFKO=new Set(['explosion','selfdestruct','mistyexplosion','finalgambit']);
const MFIRST=new Set(['fakeout','firstimpression']);
const MFAIL=new Set(['belch','lastresort','steelroller','snore','focuspunch']);
/* 計算に入れてよい技か（2026/11/20 1か所にまとめる。対策・1対1・診断・ランキング・選出・メモが使う）。
   決まりはサイトの対戦の計算と同じ＝本編の決まり（チャンピオンズのゲーム内では未確認＝mechanics:'main-series-assumed'、Q8）。
   フィールドは計算に入れないので、アイアンローラーはいつも失敗。ねこだまし・であいがしら（ctx.turn）は依頼主の判断 D8 の待ちなので、turn を渡さない限り数える（前と同じ） */
/* へんげんじざい・リベロの前提（2026/11/20 RC5。画面ごとに違うので、前提として書く。どれが正しいかはゲーム内で未確認＝Q2、依頼主の判断 D6 待ち）：
   ダメージ計算の画面＝はじめは発動する（切りかえあり）、対策・診断・1対1・ランキング・選出・メモ＝発動しない（bcalc に protean を渡さない） */
const PROTEAN_ASSUME='へんげんじざい・リベロは発動しない前提で計算しています（技と同じタイプにならず、タイプ一致の1.5倍は入れていません。ゲーム内での発動のしかたは未確認）。';
/* 先制技を受けない特性（2026/11/24）：テイルアーマー（リキキリン）・じょおうのいげん（アマージョ）。本編（第9世代）の決まり＝前提、かたやぶりは無視できる */
const PRIO_BLOCK=new Set(['armor-tail','queenly-majesty','dazzling']);
const moveUsable=(mv,ctx)=>{const k=mkey(mv);
  if(ctx&&ctx.d&&mv&&effPri(ctx.a,mv)>0&&PRIO_BLOCK.has(ctx.d.ab)&&!(ctx.a&&ctx.a.ab==='mold-breaker'))return{ok:false,why:'blocked-priority',mechanics:'main-series-assumed'};
  if(MFAIL.has(k))return{ok:false,why:k==='steelroller'?'fails-without-terrain':'needs-condition',mechanics:'main-series-assumed'};
  if(MFIRST.has(k)&&ctx&&ctx.turn==='later')return{ok:false,why:'first-turn-only',mechanics:'main-series-assumed'};
  return{ok:true}};
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
    case 'gyroball':{const sa=effSpd(a,d);return sa?Math.min(150,Math.floor(25*effSpd(d,a)/sa)+1):1}
    case 'electroball':{const sd=effSpd(d,a),r=sd?Math.floor(effSpd(a,d)/sd):4;return r>=4?150:r>=3?120:r>=2?80:r>=1?60:40}
    case 'eruption':case 'waterspout':case 'dragonenergy':return Math.max(1,Math.floor(150*a.hp/a.max));
    case 'flail':case 'reversal':{const r=Math.floor(a.hp*48/a.max);return r<=1?200:r<=4?150:r<=9?100:r<=16?80:r<=32?40:20}
    case 'hardpress':return Math.floor(Math.floor((100*(100*Math.floor(d.hp*4096/d.max))+2047)/4096)/100)||1;
    case 'acrobatics':return a.item?pw:pw*2;
    case 'hex':case 'infernalparade':return d.status?pw*2:pw;
    case 'storedpower':case 'powertrip':return pw+20*Object.values(a.stg).reduce((x,v)=>x+(v>0?v:0),0);
    case 'weatherball':{const w=a.ab==='mega-sol'?'sun':wxEffK(a,d);return w?pw*2:pw}
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
    /* 一撃必殺：当たれば倒す（がんじょうなら効かない、ぜったいれいどはこおりタイプに効かない。当たる確率は命中30%で別に見る） */
    case 'guillotine':case 'fissure':case 'horndrill':case 'sheercold':
      /* がんじょうは、かたやぶりの攻撃では働かない（2026/11/24） */
      if((d.ab==='sturdy'&&!(a&&a.ab==='mold-breaker'))||(mkey(mv)==='sheercold'&&d.p&&d.p.t.includes('こおり')))return 0;return d.hp;
  }
  return null;
}
/* ---- ダメージ計算（本編と同じ方式：補正は4096分の1単位で掛け合わせ、端数は五捨五超入） ---- */
const pR=x=>{const f=Math.floor(x);return x-f>.5?f+1:f};
const chM=(c,m)=>(c*m+2048)>>12;
const apM=(v,c)=>pR(v*c/4096);
const stgV=(v,s)=>s>=0?Math.floor(v*(2+s)/2):Math.floor(v*2/(2-s));
/* ばけのかわがはがれたときに減るHP：最大HPの1/8。端数は切り捨て、ただし最低1
   （ポケモン対戦シミュレーター Showdown の処理と同じ：this.damage(baseMaxhp/8) → 1未満は1にし、小数を切り捨てる。チャンピオンズ用の変更もない） */
const disgLoss=d=>Math.max(1,Math.floor(d.max/8));
const REVIEWED_ALWAYS_CRIT=new Set([480,524,870]);
function reviewedCritical(a,mv,d,requested){
  return !!(requested||REVIEWED_ALWAYS_CRIT.has(mv.id))&&(a.ab==='mold-breaker'||!['shell-armor','battle-armor'].includes(d.ab));
}
function bcalc(a,mv,d,o){
  o=o||{};const t=hitType(a,mv,d);
  const ig=a.ab==='mold-breaker',dab=ig?null:d.ab;
  /* くろいてっきゅう：持つと地面に着く（じめん技が ふゆう・ひこうタイプにも当たる。2026/11/24） */
  const grounded=d.item==='ironball'&&t==='じめん';
  if(dab&&ABSORB[dab]&&ABSORB[dab][0]===t&&!(grounded&&(dab==='levitate'||dab==='eelevate')))return{dmg:0,eff:0,absorb:dab};
  /* ふうせん：割れるまでじめん技を受けない（かたやぶりでも防げない） */
  if(d.item==='airballoon'&&t==='じめん')return{dmg:0,eff:0,balloon:true};
  /* ぼうだん・ぼうおん：弾・音の技を受けない（かたやぶりで消える。2026/11/24） */
  if((dab==='bulletproof'&&mfl(mv,'x'))||(dab==='soundproof'&&mfl(mv,'o')))return{dmg:0,eff:0,immune:dab};
  const mk=mkey(mv);
  let eff=grounded?mult(t,d.p.t.filter(x=>x!=='ひこう')):mult(t,d.p.t);
  if(mk==='freezedry'&&d.p.t.includes('みず'))eff=mult(t,d.p.t.filter(x=>x!=='みず'))*2;
  if(mk==='flyingpress')eff=mult('かくとう',d.p.t)*mult('ひこう',d.p.t);
  if(!eff&&a.ab==='scrappy'&&(t==='ノーマル'||t==='かくとう')&&d.p.t.includes('ゴースト'))eff=mult(t,d.p.t.filter(x=>x!=='ゴースト'));
  if(!eff)return{dmg:0,eff:0};
  /* ばけのかわ（2026/11/13 見直し）：タイプで効かない技でははがれない（上で先に0を返す）。効く技（固定ダメージの技・急所も）の1発目は
     技のダメージを0にして、はがれる。かわりに最大HPの1/8（disgLoss）が減る。この減少は技のダメージではないので dmg には入れず loss で返す。
     かたやぶりは、ばけのかわを無視してふつうにダメージを与える（はがれない） */
  if(d.disg&&!ig)return{dmg:0,eff,disg:true,loss:disgLoss(d)};
  const fx=fixedDmg(a,mv,d);if(fx!=null)return{dmg:fx,eff,fixed:true};
  /* シェルアームズ：物理と特殊でダメージが大きいほうになる */
  let phys=!mv.cls;
  if(mk==='shellsidearm'){const A1=stgV(a.st[1],a.stg.atk),C1=stgV(a.st[3],a.stg.spa),B1=stgV(d.st[2],d.stg.def),D1=stgV(d.st[4],d.stg.spd);
    phys=Math.floor(Math.floor(22*90*A1)/B1)>Math.floor(Math.floor(22*90*C1)/D1)}
  /* シェルアーマー・カブトアーマー：急所に当たらない（かたやぶりで消える） */
  const ee=mv.e||{},crit=reviewedCritical(a,mv,d,o.crit);
  /* メガソーラー：自分の技は天気が「はれ」として扱われる */
  const wr=wxEffK(a,d),w=a.ab==='mega-sol'?'sun':wr;
  /* 威力の補正 */
  const pow0=varPow(a,mv,d,o);
  let bm=4096;
  if((mk==='venoshock'||mk==='barbbarrage')&&(d.status==='psn'||d.status==='tox'))bm=chM(bm,8192);
  if(mk==='knockoff'&&d.item&&!isStone(d.item))bm=chM(bm,6144);
  if((mk==='lashout'||mk==='ficklebeam')&&o.cond)bm=chM(bm,8192);
  // Explicit, already-activated double-battle support scenario only.
  if(o.format==='double'&&o.helpingHand===true)bm=chM(bm,6144);
  if(a.ab==='technician'&&pow0<=60)bm=chM(bm,6144);
  if(SKIN[a.ab]&&mv.t==='ノーマル'&&mk!=='weatherball'&&mk!=='terrainpulse')bm=chM(bm,4915);
  if(ITEMT[a.item]===t)bm=chM(bm,4915);
  if(a.item==='normalgem'&&t==='ノーマル')bm=chM(bm,5325);
  if(phys&&a.item==='muscleband')bm=chM(bm,4505);
  if(!phys&&a.item==='wiseglasses')bm=chM(bm,4505);
  if(a.ab==='tough-claws'&&mfl(mv,'c'))bm=chM(bm,5325);
  if(sfOn(a,mv))bm=chM(bm,5325);
  /* すてみ：反動・失敗で自分が傷つく技 1.2倍／パンクロック：音の技 1.3倍／はがねのせいしん：自分のはがね技 1.5倍（味方の分はダブルの未対応）／かんそうはだ：受けるほのお技 1.25倍（2026/11/24、参照の onBasePower） */
  if(a.ab==='reckless'&&(ee.rc||ee.cx))bm=chM(bm,4915);
  if(a.ab==='punk-rock'&&mfl(mv,'o'))bm=chM(bm,5325);
  if(a.ab==='steely-spirit'&&t==='はがね')bm=chM(bm,6144);
  if(dab==='dry-skin'&&t==='ほのお')bm=chM(bm,5120);
  if(a.ab==='iron-fist'&&mfl(mv,'p'))bm=chM(bm,4915);
  if(a.ab==='strong-jaw'&&mfl(mv,'b'))bm=chM(bm,6144);
  if(a.ab==='mega-launcher'&&mfl(mv,'l'))bm=chM(bm,6144);
  if(a.ab==='sharpness'&&mfl(mv,'s'))bm=chM(bm,6144);
  if(a.ab==='sand-force'&&wr==='sand'&&['いわ','じめん','はがね'].includes(t))bm=chM(bm,5325);
  /* フェアリーオーラは場全体の効果で、かたやぶりで消えない（参照の breakable が無い。2026/11/24：前は受ける側のフェアリーオーラをかたやぶりで消していた） */
  if(t==='フェアリー'&&(a.ab==='fairy-aura'||d.ab==='fairy-aura'))bm=chM(bm,5448);
  const facade=mv.id===263&&['brn','psn','tox','par'].includes(a.status);
  if(facade)bm=chM(bm,8192);
  if((mk==='solarbeam'||mk==='solarblade')&&w&&w!=='sun')bm=chM(bm,2048);
  const pow=Math.max(1,apM(pow0,bm));
  /* 攻撃（急所のときは下がったランクを無視） */
  const src=ee.fp?d:a,ak=phys?'atk':'spa';
  const bp=mv.id===776;
  let as=ee.fp?d.stg.atk:bp?a.stg.def:a.stg[ak];
  /* メテオビーム・エレクトロビームは、ためるターンに特攻が1段階上がってから攻撃する */
  /* 2026/11/24：2回目からの使用では、前の使用で上がった分も残る（o.useN＝この対面で前に使った回数。1回目＋1、2回目＋2…最大＋6） */
  if(MB_REP.has(mk)&&!o.roll)as=Math.min(6,as+1+(o.useN||0));
  if(crit&&as<0)as=0;
  /* てんねん：防御側が持つ場合、攻撃側の能力ランクを無視。かたやぶりで無効化される。 */
  /* 2026/11/24：イカサマも、受ける側（攻撃の値を使われる側）がてんねんなら、その攻撃ランクを無視する（Pokémon Showdown・@smogon/calc と同じ：
     てんねんは「てんねんの相手と戦っている側の攻めの能力ランク」を消し、イカサマで使うランクも攻める技のランクとして扱われる）。
     攻める側のてんねんは、イカサマで使う相手の攻撃ランクを消さない */
  if(dab==='unaware')as=0;
  const ast=a.stAtk||a.st;
  let A=stgV(ee.fp?d.st[1]:bp?a.st[2]:(phys?ast[1]:ast[3]),as),am=4096;
  if(phys&&(a.ab==='huge-power'||a.ab==='pure-power'))am=chM(am,8192);
  /* こんじょう：状態異常のとき攻撃1.5倍（やけどの半減もしない＝下の burn の行） */
  if(phys&&a.ab==='guts'&&a.status)am=chM(am,6144);
  if(PINCH[a.ab]===t&&a.hp*3<=a.max)am=chM(am,6144);
  if(a.ab==='water-bubble'&&t==='みず')am=chM(am,8192);
  if(!phys&&a.ab==='solar-power'&&w==='sun')am=chM(am,6144);
  if(phys&&a.item==='choiceband')am=chM(am,6144);
  if(a.item==='lightball'&&a.p.no===25)am=chM(am,8192);
  if(!phys&&a.item==='choicespecs')am=chM(am,6144);
  if(dab==='thick-fat'&&(t==='ほのお'||t==='こおり'))am=chM(am,2048);
  /* ほのおのたてがみ：ほのお技の攻撃・特攻1.5倍／きよめのしお：受けるゴースト技の攻撃・特攻半分（2026/11/24） */
  if(a.ab==='fire-mane'&&t==='ほのお')am=chM(am,6144);
  if(dab==='purifying-salt'&&t==='ゴースト')am=chM(am,2048);
  if((dab==='heatproof'||dab==='water-bubble')&&t==='ほのお')am=chM(am,2048);
  if(bp)am=4096;
  else if(phys&&a.ab==='hustle')A=pR(A*3/2);
  A=Math.max(1,apM(A,am));
  /* 防御（急所のときは上がったランクを無視） */
  const useDef=phys||ee.ps,dk=useDef?'def':'spd';
  let ds=d.stg[dk];if(crit&&ds>0)ds=0;
  /* てんねん：攻撃側が持つ場合、防御側の能力ランクを無視。 */
  if(a.ab==='unaware')ds=0;
  /* せいなるつるぎ・ＤＤラリアット：相手の防御のランク（上がっていても下がっていても）を無視する（2026/11/24） */
  if(mk==='sacredsword'||mk==='darkestlariat')ds=0;
  let D=stgV(useDef?d.st[2]:d.st[4],ds),dm=4096;
  if(wr==='snow'&&useDef&&d.p.t.includes('こおり'))D=pR(D*1.5);
  if(wr==='sand'&&!useDef&&d.p.t.includes('いわ'))D=pR(D*1.5);
  /* ふしぎなうろこ：状態異常なら物理防御が1.5倍。 */
  if(useDef&&dab==='marvel-scale'&&d.status)dm=chM(dm,6144);
  if(useDef&&dab==='fur-coat')dm=chM(dm,8192);
  if(!useDef&&d.item==='assaultvest')dm=chM(dm,6144);
  D=Math.max(1,apM(D,dm));
  /* 基本ダメージ */
  let x=Math.floor(Math.floor(Math.floor(22*pow*A)/D)/50)+2;
  /* 範囲技の0.75倍は、範囲の技（mv.tg＝相手全体・自分以外全体）のときだけ。1匹を狙う技には掛けない（2026/11/24） */
  if(o.spread&&mv.tg)x=apM(x,3072);
  if(o.pb)x=apM(x,1024);
  if(w==='sun'&&(t==='ほのお'||t==='みず'))x=apM(x,t==='ほのお'?6144:2048);
  if(w==='rain'&&(t==='みず'||t==='ほのお'))x=apM(x,t==='みず'?6144:2048);
  if(crit)x=Math.floor(x*1.5);
  /* 乱数（85〜100%の16段階）。o.r で段階を指定、o.roll でランダム、どちらもなければ中央付近 */
  x=Math.floor(x*(o.r?o.r:o.roll?85+rnd(16):92)/100);
  /* へんげんじざい・リベロ：o.protean（この技で発動する＝場に出て最初の技）のときは技と同じタイプになり、タイプ一致になる。
     発動するかは場面しだいなので、呼ぶ側が指定する（指定なしは発動しない＝もとのタイプ） */
  if(a.p.t.includes(t)||(o.protean&&(a.ab==='protean'||a.ab==='libero')))x=apM(x,a.ab==='adaptability'?8192:6144);
  x=Math.floor(x*eff);
  if(phys&&a.status==='brn'&&a.ab!=='guts'&&!facade)x=Math.floor(x/2);
  /* 最後の補正 */
  let fm=4096;
  if(o.format==='double'&&o.friendGuard===true)fm=chM(fm,3072);
  /* かわらわり・サイコファング・レイジングブルは、攻撃の前に壁を壊すので壁の補正がかからない */
  if(o.screen&&!crit&&a.ab!=='infiltrator'&&!['brickbreak','psychicfangs','ragingbull'].includes(mk))/* Wall strength follows battle format, not the number of targets. Legacy callers without format retain the old fallback. Champions-specific multipliers still require device verification. */
  fm=chM(fm,(o.format==='double'||(o.format==null&&o.spread))?2732:2048);
  /* スナイパー：急所のダメージがさらに1.5倍 */
  if(a.ab==='sniper'&&crit)fm=chM(fm,6144);
  if(dab==='multiscale'&&d.hp===d.max&&!o.pb)fm=chM(fm,2048);
  /* もふもふ（ほのお2倍・接触半分を1つの倍率で）・パンクロック（受ける音の技半分）・こおりのりんぷん（特殊半分）・はどうのぼうご（接触半分）。かたやぶりで消える */
  if(dab==='fluffy'){const fl=(t==='ほのお'?2:1)*(mfl(mv,'c')&&a.ab!=='long-reach'?.5:1);if(fl!==1)fm=chM(fm,fl*4096)}
  if(dab==='punk-rock'&&mfl(mv,'o'))fm=chM(fm,2048);
  if(dab==='ice-scales'&&mv.cls===1)fm=chM(fm,2048);
  if(dab==='aura-guard'&&mfl(mv,'c')&&a.ab!=='long-reach')fm=chM(fm,2048);
  if((dab==='solid-rock'||dab==='filter')&&eff>=2)fm=chM(fm,3072);
  if(a.ab==='tinted-lens'&&eff<1)fm=chM(fm,8192);
  if(a.item==='expertbelt'&&eff>=2)fm=chM(fm,4915);
  if(a.item==='lifeorb')fm=chM(fm,5324);
  if(d.item&&RES_BERRY[d.item]===t&&(eff>=2||d.item==='chilanberry'))fm=chM(fm,2048);
  x=apM(x,fm);
  return{dmg:Math.max(1,x),eff,crit};
}
/* ---- 連続技を1発ずつ順番に計算する（2026/11/13 ダメージ計算の点検） ----
   1発ごとに、その時点の相手のHP（マルチスケイルは満タンのときだけ）・乱数（o.rolls[i]、なければ o.r）・急所（o.crits[i]、なければ o.crit）で bcalc を呼ぶ。
   半減きのみは最初に効いた当たりで使われ、次の当たりからは効かない。トリプルアクセルは 20→40→60、おやこあいは2発目が1/4。
   当たる回数：o.hits があればそれ。なければ 決まった回数の技はその回数、スキルリンクは最大、ネズミざんは10回、2〜5回の技は3回。
   相手が途中で倒れても、合計は全部の当たりを足す（ほかの計算機と同じ見せ方。倒せるかは koInfo で見る）。
   ばけのかわ（2026/11/13）：残っていれば最初の当たりは技のダメージ0（dmg:0, disg:true）で、かわりに最大HPの1/8（loss）が減り、はがれる。
   この減少で倒れたら、そこで止める（あとの当たりはない＝fainted）。倒れなければ、残りの当たりはふつうのダメージ（その時点のHP・乱数・急所）。
   total は技のダメージだけ（ばけのかわの減少は入れない）。HPの減りは total＋loss */
function mhCount(a,mv,o){
  if(!(mv.maxH>1))return 1;
  /* 回数が決まった技とスキルリンク（いつも最大）は、選んだ回数より優先する */
  if(mv.minH===mv.maxH||a.ab==='skill-link')return mv.maxH;
  if(o&&o.hits>0)return Math.max(mv.minH||1,Math.min(o.hits,mv.maxH));
  return mkey(mv)==='populationbomb'?10:3;
}
/* ---- 1発ずつの状態の変化（2026/11/24、Pokémon Showdown e7f50cd に合わせた共通の部品） ----
   当たるたびに：ばけのかわ（1発目を防いで1/8）・半減きのみ（効いた当たりで使う）・ふうせん（当たると割れる）・
   じきゅうりょく（当たるたび防御+1）・くだけるよろい（物理で防御−1）・きあいのタスキ／がんじょう（o.surv のときだけ。HP満タンから倒れる当たりを1残す。タスキは使う）。
   相手が倒れたら、そのあとの当たりは状態を変えない（after。合計 total は全部の当たりの「計算上の」ダメージ、dealt は倒れるまでに実際に与えたダメージ） */
function hitStep(a,mv,d,i,r,cr,o,st){
  const k=mkey(mv),m=k==='tripleaxel'?{...mv,pow:[20,40,60][i]||60}:mv;
  const hp0=d.hp,it0=d.item,dg0=d.disg,stg0=d.stg;
  d.hp=Math.max(0,st.hp);d.item=st.item;d.disg=st.disg;d.stg=st.stg;
  try{
    const x=bcalc(a,m,d,{...o,r,crit:cr,pb:st.pb&&i===1});
    const ns={...st};let h;
    if(x.disg){ns.disg=false;ns.hp=st.hp-x.loss;h={dmg:0,disg:true,loss:x.loss,crit:false,r:r||null,hp:st.hp};if(ns.hp<=0)ns.dead=true;return{x,h,ns}}
    let dmg=x.dmg;
    if(o.surv&&x.eff&&st.hp===d.max&&dmg>=st.hp&&!st.dead){
      if(st.item==='focussash'){dmg=st.hp-1;ns.item=null;ns.surv='focussash'}
      else if(d.ab==='sturdy'&&a.ab!=='mold-breaker'){dmg=st.hp-1;ns.surv='sturdy'}}
    h={dmg,crit:!!x.crit,r:r||null,hp:st.hp};
    if(!x.eff)return{x,h,ns:{...ns,stop:true}};
    if(st.item&&RES_BERRY[st.item]&&RES_BERRY[st.item]===hitType(a,m,d)&&(x.eff>=2||st.item==='chilanberry'))ns.item=null;
    if(st.item==='airballoon')ns.item=null;
    ns.hp=st.hp-dmg;
    if(ns.hp>0){
      if(d.ab==='stamina')ns.stg={...ns.stg,def:Math.min(6,(ns.stg.def||0)+1)};
      if(d.ab==='weak-armor'&&m.cls===0)ns.stg={...ns.stg,def:Math.max(-6,(ns.stg.def||0)-1),spe:Math.min(6,(ns.stg.spe||0)+2)};
    }else ns.dead=true;
    return{x,h,ns};
  }finally{d.hp=hp0;d.item=it0;d.disg=dg0;d.stg=stg0}
}
const hsInit=(d,pb)=>({hp:d.hp,item:d.item,disg:d.disg,stg:{...d.stg},pb});
/* Two independent enemy attacks, conditional on both being attempted and
   connecting. Enumerate rolls in both orders; no partner/action simulation.
   Restrict reactive states to the ones represented by hitStep. */
// One friendly target of an all-adjacent attack; not a team recommendation.
function reviewedFriendlyHit(a,m,d){
  if(!a||!m||!d||a===d||a.p.no===d.p.no||a.formErr||d.formErr||![0,1,2].includes(m.tg||0))return null;
  if(m.tg!==2)return {targeted:false,min:0,max:0};
  if(m.maxH>1||m.prot||a.ab==='parental-bond'||[a,d].some(x=>CALC_UNIMPL.includes(x.ab)||CALC_UNVERIFIED[x.ab]||CALC_UNIMPL_IT.includes(x.item)))return null;
  if(!moveUsable(m,{a,d}).ok||!Number.isInteger(d.hp)||d.hp<1||d.hp>d.max)return null;
  if(d.ab==='telepathy'&&a.ab!=='mold-breaker')return {targeted:true,min:0,max:0,protectedBy:'telepathy'};
  if(!['multiscale','huge-power','rough-skin','levitate','pressure','magic-guard','telepathy','sturdy','disguise','inner-focus','water-absorb','flash-fire','volt-absorb','earth-eater','soundproof','bulletproof'].includes(d.ab)||d.item!=null)return null;
  const loss=[];
  for(let r=85;r<=100;r++){
    const y=hitStep(a,m,d,0,r,false,{format:'double',spread:true,surv:true,protean:false},hsInit(d,false));
    const hp=Math.max(0,y.ns.hp);
    if(!Number.isFinite(hp)||hp>d.hp)return null;
    loss.push(d.hp-hp);
  }
  return {targeted:true,min:Math.min(...loss),max:Math.max(...loss),protectedBy:null};
}
function reviewedDoubleFocus(a,m,b,n,d){
  if(!a||!b||!d||!m||!n||a===b||a.p.no===b.p.no||d.formErr||a.formErr||b.formErr)return null;
  if(!Number.isInteger(d.hp)||d.hp<1||d.hp>d.max)return null;
  const allowed=new Set(['pressure','multiscale','sturdy','disguise','stamina','weak-armor','rough-skin','huge-power','levitate','magic-guard','inner-focus','technician','shell-armor','battle-armor','thick-fat']);
  if(!allowed.has(d.ab)||!(d.item==null||['focussash','airballoon','leftovers','lifeorb','expertbelt','muscleband','wiseglasses','choicescarf','choiceband','choicespecs'].includes(d.item)||reviewedFixedMegaItem(d)))return null;
  if([a,b].some(x=>x.ab==='parental-bond'||x.item||CALC_UNIMPL.includes(x.ab)||CALC_UNVERIFIED[x.ab]))return null;
  if([m,n].some(x=>x.maxH>1||x.prot||fixedDmg(a,x,d)!=null||MCHG.has(mkey(x))||MRECH.has(mkey(x))))return null;
  const orders=[];
  for(const seq of [[[a,m],[b,n]],[[b,n],[a,m]]]){
    let min=d.hp,max=0,ko=0;
    for(let r=85;r<=100;r++)for(let t=85;t<=100;t++){
      let st=hsInit(d,false);
      for(let i=0;i<2&&st.hp>0;i++){
        const [x,mv]=seq[i];
        if(!moveUsable(mv,{a:x,d:{...d,hp:st.hp,item:st.item,stg:st.stg}}).ok)return null;
        // An immunity stops this attack only, never the other attack.
        const y=hitStep(x,mv,d,0,i?t:r,false,{format:'double',spread:!!mv.tg,surv:true,protean:false},st);
        st={...y.ns,stop:false};
      }
      const hp=Math.max(0,st.hp);min=Math.min(min,hp);max=Math.max(max,hp);if(!hp)ko++;
    }
    orders.push({first:seq[0][0].p.no,min,max,ko,rolls:256});
  }
  return {orders,min:Math.min(...orders.map(x=>x.min)),max:Math.max(...orders.map(x=>x.max))};
}

/* 1回の使用。当たる回数は n（o.hits・決まった回数・スキルリンク・mhCount） */
function bhits(a,mv,d,o){
  o=o||{};const k=mkey(mv),n=o.nHits||mhCount(a,mv,o);
  /* おやこあい：2回目は1/4。範囲技・連続技・ためる技（ソーラービーム等）・決まったダメージの技には働かない（本編の決まり＝前提。2026/11/24 ためる技を足した） */
  const pb=a.ab==='parental-bond'&&n===1&&!(o.spread&&mv.tg)&&!MCHG.has(k)&&fixedDmg(a,mv,d)==null;
  const out=[];let st=hsInit(d,pb),eff=null,loss=0,fainted=false,disgFaint=false,dealt=0,surv=null;
  for(let i=0;i<(pb?2:n);i++){
    const r=Array.isArray(o.rolls)?o.rolls[i]:o.r,cr=Array.isArray(o.crits)?!!o.crits[i]:!!o.crit;
    if(st.dead){/* 倒れたあと：計算上のダメージだけ（状態は変えない） */const y=hitStep(a,mv,d,i,r,cr,{...o,surv:false},{...st,hp:Math.max(1,st.hp)});if(y.h.disg)break;out.push({...y.h,after:true});continue}
    const {x,h,ns}=hitStep(a,mv,d,i,r,cr,o,st);
    if(eff==null)eff=x.eff;
    if(h.disg){loss=h.loss;out.push(h);st=ns;if(ns.dead){fainted=true;disgFaint=true;break}continue}
    out.push(h);if(ns.stop)break;dealt+=Math.min(h.dmg,Math.max(0,st.hp));if(ns.surv)surv=ns.surv;st=ns;
    if(ns.dead)fainted=true;
  }
  const total=out.reduce((s,h)=>s+h.dmg,0);
  return{hits:out,total,dealt,eff,n:pb?2:n,loss,hpLoss:total+loss,fainted,disgFaint,surv,state:st};
}
/* 1回の使用で当たる回数の分布 [[回数,確率],…]（2026/11/24、Showdown e7f50cd）：
   o.hits・決まった回数・スキルリンク＝その回数／2〜5回の技＝2回35%・3回35%・4回15%・5回15%／ネズミざん・トリプルアクセル＝2発目から毎回命中の判定、外れたら止まる
   （1発目が当たったときの分布。1発目の命中はダメージ計算の画面で別に出す） */
const MACC=new Set(['populationbomb','tripleaxel','triplekick']);
function hitCountDist(a,mv,d,o){
  if(!(mv.maxH>1))return[[1,1]];
  if(o&&o.hits>0)return[[mhCount(a,mv,o),1]];
  if(a.ab==='skill-link')return[[mv.maxH,1]];
  const k=mkey(mv);
  if(MACC.has(k)){const p=Math.min(1,accOf(a,mv,d)/100),N=mv.maxH,out=[];for(let c=1;c<N;c++)out.push([c,Math.pow(p,c-1)*(1-p)]);out.push([N,Math.pow(p,N-1)]);return out.filter(x=>x[1]>0)}
  if(mv.minH===mv.maxH)return[[mv.maxH,1]];
  if(mv.minH===2&&mv.maxH===5)return[[2,.35],[3,.35],[4,.15],[5,.15]];
  const c=mv.maxH-mv.minH+1;return Array.from({length:c},(_,i)=>[mv.minH+i,1/c]);
}
/* 1回の使用の合計ダメージの分布（当たりごとに乱数は別々・状態は当たりごとに変わる）。[[合計,確率],…]
   2026/11/24：前は「1発ごとの値は乱数によらない」として畳み込んでいた（じきゅうりょく・タスキ等で前の当たりによって次が変わると違っていた）。
   同じ状態（防御のランク・持ち物・ばけのかわ・HP満タンか・倒れたか）と同じ合計はまとめて数える。o.nHits があればその回数だけ */
function hitDist(a,mv,d,o){
  o=o||{};const k=mkey(mv),n=o.nHits||mhCount(a,mv,o);
  const pb=a.ab==='parental-bond'&&n===1&&!(o.spread&&mv.tg)&&!MCHG.has(k)&&fixedDmg(a,mv,d)==null;
  /* o.cap：合計が cap 以上になったらそこでまとめる（倒せるかだけを知りたいとき。分布の形は cap より下だけ正確） */
  const N=pb?2:n,cache=new Map(),cap=o.cap||Infinity;
  let S=new Map();const s0=hsInit(d,pb);S.set(JSON.stringify([0,s0]),{t:0,st:s0,p:1});
  for(let i=0;i<N;i++){const nx=new Map();
    for(const v of S.values()){
      if(v.st.capped){const e=nx.get('cap');if(e)e.p+=v.p;else nx.set('cap',{...v});continue}
      if(v.st.dead||v.st.stop){/* 倒れたあとの当たりは計算上の値（状態は変えない・乱数は別々） */
        for(let r=85;r<=100;r++){const y=hitStep(a,mv,d,i,r,!!o.crit,{...o,surv:false},{...v.st,hp:Math.max(1,v.st.hp),dead:false});const t=v.t+(v.st.stop?0:y.h.dmg),key=JSON.stringify([t,v.st]);const e=nx.get(key);if(e)e.p+=v.p/16;else nx.set(key,{t,st:v.st,p:v.p/16})}continue}
      for(let r=85;r<=100;r++){
        const ck=JSON.stringify([i,r,v.st.hp===d.max,v.st.hp,v.st.item,v.st.disg,v.st.stg]);
        let y=cache.get(ck);if(!y){y=hitStep(a,mv,d,i,r,!!o.crit,o,v.st);cache.set(ck,y)}
        const ns=y.ns,t=Math.min(cap,v.t+(y.h.disg?0:y.h.dmg));if(t>=cap){const key='cap';const e=nx.get(key);if(e)e.p+=v.p/16;else nx.set(key,{t,st:{...ns,dead:true,capped:true},p:v.p/16});continue}
        const sk={...ns};const key=JSON.stringify([t,sk]);const e=nx.get(key);if(e)e.p+=v.p/16;else nx.set(key,{t,st:ns,p:v.p/16})}}
    S=nx}
  const out=new Map();for(const v of S.values())out.set(v.t,(out.get(v.t)||0)+v.p);
  return [...out.entries()].sort((x,y)=>x[0]-y[0]);
}
/* Actual remaining HP distribution after one successful move, reusing hitStep.
   Unlike hitDist's theoretical damage, stop at fainting and count Disguise HP cost.
   Conditional on first hit; hitCountDist includes later accuracy checks.
   Recovery berries, recoil and end-of-turn effects are outside this helper. */
function hitRemainingDist(a,mv,d,o={}){
  const opt={...o,surv:true},out=new Map(),k=mkey(mv);
  // nHits is an explicit conditional replay count, not the UI hit selector.
  const counts=Number.isInteger(opt.nHits)&&opt.nHits>=1&&opt.nHits<=Math.max(1,mv.maxH||1)?[[opt.nHits,1]]:hitCountDist(a,mv,d,opt);
  for(const [n,w] of counts){
    const pb=a.ab==='parental-bond'&&n===1&&!(opt.spread&&mv.tg)&&!MCHG.has(k)&&fixedDmg(a,mv,d)==null;
    let states=new Map();
    const put=(map,st,p)=>{const key=JSON.stringify(st),v=map.get(key);if(v)v.p+=p;else map.set(key,{st,p})};
    put(states,hsInit(d,pb),1);
    for(let i=0;i<(pb?2:n);i++){
      const next=new Map();
      for(const {st,p} of states.values()){
        if(st.dead||st.stop){put(next,st,p);continue}
        for(let r=85;r<=100;r++){
          const {ns}=hitStep(a,mv,d,i,r,!!opt.crit,opt,st);
          put(next,ns,p/16);
        }
      }
      states=next;
    }
    for(const {st,p} of states.values()){
      const hp=Math.max(0,Math.min(d.max,st.hp));
      out.set(hp,(out.get(hp)||0)+p*w);
    }
  }
  return [...out.entries()].sort((a,b)=>a[0]-b[0]);
}
/* 1回使ったあとの状態（2026/11/24）：次の使用のダメージを出すため、こちら・相手の写しを作る（もとのものは変えない）。
   こちら：必ず起きる自分の能力の変化（りゅうせいぐん 特攻−2・インファイトは攻撃に関係しない…技の効果の表 MVE.s の確率100%）・メテオビーム/エレクトロビームの特攻+1・使ったノーマルジュエル。
   相手：bhits の終わりの状態（持ち物・ばけのかわ・ランク）とHP（満タンでない＝マルチスケイル等は働かない） */
/* 1回使っても「次の使用のダメージ」が変わりえない技・相手か（速くするための前の確かめ。結果は同じ）。
   ダメージに効くのは：こちらの攻めの能力（物理＝攻撃、特殊＝特攻、ボディプレス＝防御）のランク・メテオビーム・ノーマルジュエル、
   相手の受ける能力のランク（じきゅうりょく・くだけるよろい＝物理）・この技で効く半減きのみ・ばけのかわ・HP満タンで働くマルチスケイル。
   （オボンのみは koInfo、タスキ・がんじょうは1回目の耐えだけ、ふうせんは同じ技なら次もじめん技ではない） */
/* Conditional self-stage changes for the reviewed immediate attacks.
   No turn simulation: connected must be established by the caller. White Herb,
   other items and effects are deliberately not modeled here. */
const REVIEWED_SELF_STAGES={276:{atk:-1,def:-1},370:{def:-1,spd:-1},315:{spa:-2},437:{spa:-2},434:{spa:-2},488:{spe:1},885:{spe:1},872:{spe:1},871:{spa:1}};
// Isolated self-inflicted stage changes: these abilities do not alter
// the reviewed move deltas (except the explicit multipliers and Sheer Force). External stage drops and end-turn effects
// are not part of this predicate.
const REVIEWED_POST_STAGE_AB=new Set(['multiscale','huge-power','inner-focus','rough-skin','technician','magic-guard','cursed-body','contrary','simple','levitate','thick-fat','reckless','hyper-cutter','shell-armor','pressure','soundproof','sheer-force']);
function reviewedSelfStageAfterHit(a,mv,connected){
  const out={...a,stg:{...a.stg}},expected=REVIEWED_SELF_STAGES[mv.id];
  if(!expected)return null;
  if(a.item==='whiteherb')return null;
  const rows=(mv.e&&mv.e.s)||[];
  if(rows.length!==Object.keys(expected).length||Object.entries(expected).some(([k,v])=>!rows.some(([st,n,p])=>st===k&&n===v&&p>=100)))return null;
  if(!connected||sfSup(a,mv))return out;
  const factor=a.ab==='contrary'?-1:a.ab==='simple'?2:1;
  for(const [k,v] of Object.entries(expected)){
    if(!Number.isInteger(out.stg[k])||out.stg[k]<-6||out.stg[k]>6)return null;
    out.stg[k]=Math.max(-6,Math.min(6,out.stg[k]+v*factor));
  }
  return out;
}
/* Guaranteed target secondary drops, evaluated only on an isolated surviving
   target. Reference: Showdown data/abilities.ts, data/moves.ts; Covert Cloak
   blocks secondary effects, including guaranteed drops. No reflection chains,
   Substitute, Mist, Flower Veil, Ability Shield or field state modeled. */
const REVIEWED_TARGET_STAGES={491:{spd:-2},855:{spd:-2},886:{atk:-1},679:{atk:-1},688:{atk:-1}};
const REVIEWED_TARGET_AB=new Set(['multiscale','huge-power','rough-skin','pressure','levitate','inner-focus','magic-guard','clear-body','white-smoke','full-metal-body','hyper-cutter','shield-dust','contrary','simple','defiant','competitive']);
function reviewedTargetStageAfterHit(a,mv,d,connected){
  const delta=REVIEWED_TARGET_STAGES[mv.id];
  if(!delta||!d||typeof connected!=='boolean'||!REVIEWED_TARGET_AB.has(d.ab)||![null,'covertcloak'].includes(d.item)||d.disg||d.substitute||d.volatiles?.substitute)return null;
  const rows=mv.e?.t||[],keys=Object.keys(delta);
  if(rows.length!==keys.length||keys.some(k=>!rows.some(([st,n,p])=>st===k&&n===delta[k]&&p===100)))return null;
  if(!d.stg||['atk','def','spa','spd','spe'].some(k=>!Number.isInteger(d.stg[k])||Math.abs(d.stg[k])>6))return null;
  const out={...d,stg:{...d.stg}};
  if(!connected||sfSup(a,mv)||d.item==='covertcloak')return out;
  const ab=a.ab==='mold-breaker'&&!['full-metal-body','defiant','competitive'].includes(d.ab)?null:d.ab;
  if(['clear-body','white-smoke','full-metal-body','shield-dust'].includes(ab))return out;
  const k=keys[0];if(k==='atk'&&ab==='hyper-cutter')return out;
  const n=delta[k]*(ab==='contrary'?-1:ab==='simple'?2:1);
  const prev=out.stg[k];out.stg[k]=Math.max(-6,Math.min(6,prev+n));
  if(out.stg[k]<prev&&ab==='defiant')out.stg.atk=Math.min(6,out.stg.atk+2);
  if(out.stg[k]<prev&&ab==='competitive')out.stg.spa=Math.min(6,out.stg.spa+2);
  return out;
}
/* Conditional Life Orb HP cost after a damaging hit. The caller must supply
   a confirmed damaging hit (not merely an attempted attack). This is not a
   full turn simulator: contact effects, move recoil and berry triggers are separate.
   Reference: https://dex.pokemonshowdown.com/items/lifeorb
   https://bulbapedia.bulbagarden.net/wiki/Sheer_Force */
function reviewedLifeOrbAfterHit(a,mv,damagingHit){
  if(typeof damagingHit!=='boolean'||!Number.isInteger(a.hp)||!Number.isInteger(a.max)||a.max<1||a.hp<0||a.hp>a.max)return null;
  const out={...a,stg:{...a.stg}};
  if(a.item!=='lifeorb'||!damagingHit||a.hp===0||a.ab==='magic-guard'||sfSup(a,mv))return out;
  out.hp=Math.max(0,a.hp-Math.max(1,Math.floor(a.max/10)));
  return out;
}
/* Damage-based recoil only, using the pinned Showdown e7f50cd reference.
   Exact recoil fractions: data/moves.ts; Champions overrides inherit these.
   sim/battle-actions.ts applyRecoilDamage rounds nearest, minimum one.
   Actual dealt damage must exclude overkill and Disguise HP loss.
   Does not simulate ability replacement, crash damage or fixed self-HP costs. */
const REVIEWED_RECOIL={36:[1,4],38:[33,100],394:[33,100],413:[33,100],452:[33,100],834:[33,100],528:[1,4],457:[1,2],344:[33,100]};
function reviewedMoveRecoilAfterHit(a,mv,dealt){
  const ratio=REVIEWED_RECOIL[mv.id];
  if(!ratio||!Number.isSafeInteger(dealt)||dealt<0||!Number.isInteger(a.hp)||!Number.isInteger(a.max)||a.max<1||a.hp<0||a.hp>a.max)return null;
  // Refuse mismatched local move metadata rather than silently override it.
  if(!Number.isFinite(mv.drain)||Math.abs(-mv.drain-100*ratio[0]/ratio[1])>1e-9)return null;
  const out={...a,stg:{...a.stg}};
  if(!dealt||!a.hp||a.ab==='rock-head'||a.ab==='magic-guard')return out;
  out.hp=Math.max(0,a.hp-Math.max(1,Math.round(dealt*ratio[0]/ratio[1])));
  return out;
}
/* Pinned Showdown e7f50cd: data/moves.ts drain fractions and
   sim/battle.ts spreadDamage / heal. Normal single-target recovery only;
   Liquid Ooze, Big Root and healing prevention need separate review. */
const REVIEWED_DRAIN={409:[1,2],202:[1,2],141:[1,2],532:[1,2],577:[3,4],71:[1,2],72:[1,2],613:[3,4]};
function reviewedDrainAfterHit(a,mv,dealt,d){
  const ratio=REVIEWED_DRAIN[mv.id];
  if(!ratio||!d||d.ab==='liquid-ooze'||a.item==='bigroot'||a.healblock||a.volatiles?.healblock||!Number.isSafeInteger(dealt)||dealt<0||!Number.isInteger(a.hp)||!Number.isInteger(a.max)||a.max<1||a.hp<0||a.hp>a.max)return null;
  if(!Number.isFinite(mv.drain)||Math.abs(mv.drain-100*ratio[0]/ratio[1])>1e-9)return null;
  const out={...a,stg:{...a.stg}};
  if(dealt&&a.hp)out.hp=Math.min(a.max,a.hp+Math.round(dealt*ratio[0]/ratio[1]));
  return out;
}
/* Successful isolated setup action, before incoming hits or residual effects.
   Reference: Showdown e7f50cd data/moves.ts. No entry effects or turn end.
   Caller validates learnset, selected move, format and action legality.
   Keep the ability/item scope explicit; expand only after separate review. */
const REVIEWED_SETUP={349:{atk:1,spe:1},14:{atk:2},417:{spa:2},483:{spa:1,spd:1,spe:1},504:{atk:2,spa:2,spe:2,def:-1,spd:-1},347:{spa:1,spd:1},339:{atk:1,def:1},97:{spe:2},334:{def:2},133:{spd:2},397:{spe:2},187:{atk:6}};
const REVIEWED_SETUP_AB=new Set(['multiscale','huge-power','inner-focus','rough-skin','technician','magic-guard','cursed-body','levitate','thick-fat','reckless','hyper-cutter','shell-armor','pressure','soundproof','simple','contrary']);
// A stone is inert in these isolated actions once the exact Mega form is resolved.
function reviewedFixedMegaItem(a){
  if(!a||!a.p||!a.item||a.formErr||!MEGA[a.item])return false;
  const r=resolveForm(a.p.no,a.item);
  return !!(r.ok&&r.mega&&r.form.no===a.p.no&&r.stone===a.item);
}
function reviewedSetupState(me,id,op){
  const stages=REVIEWED_SETUP[id];
  if(!stages||!op||!REVIEWED_SETUP_AB.has(me.ab)||(![null,'lifeorb','sitrusberry','expertbelt','muscleband','wiseglasses','leftovers'].includes(me.item)&&!reviewedFixedMegaItem(me)))return null;
  if(!Number.isInteger(me.hp)||!Number.isInteger(me.max)||me.hp<1||me.hp>me.max||!me.stg||['atk','def','spa','spd','spe'].some(k=>!Number.isInteger(me.stg[k])||Math.abs(me.stg[k])>6))return null;
  const a={...me,stg:{...me.stg}};
  if(id===187){
    if(a.ab==='simple'||a.ab==='contrary'||a.hp<=a.max/2||a.stg.atk>=6||a.max===1)return null;
    a.hp-=Math.floor(a.max/2);a.stg.atk=6;
    if(a.item==='sitrusberry'&&a.hp<=Math.floor(a.max/2)&&op.ab!=='unnerve'){
      a.hp=Math.min(a.max,a.hp+Math.floor(a.max/4));a.item=null;
    }
  }else{
    const factor=a.ab==='contrary'?-1:a.ab==='simple'?2:1;
    for(const [k,v] of Object.entries(stages))a.stg[k]=Math.max(-6,Math.min(6,a.stg[k]+v*factor));
    if(Object.keys(stages).every(k=>a.stg[k]===me.stg[k]))return null;
  }
  return a;
}
/* Reference e7f50cd data/moves.ts and sim/battle-actions.ts.
   Plain immediate self-heal only. Roost, weather, sleep, delayed recovery,
   PP, action denial, Heal Block and post-action effects are separate.
   Caller must establish that the move may legally be used in this state. */
const REVIEWED_DIRECT_HEAL=new Set([105,303,135,208,456]);
function reviewedDirectHeal(a,id,canAct){
  if(!REVIEWED_DIRECT_HEAL.has(id)||typeof canAct!=='boolean'||!Number.isInteger(a.hp)||!Number.isInteger(a.max)||a.max<1||a.hp<0||a.hp>a.max)return null;
  if(a.healblock||a.volatiles?.healblock)return null;
  const out={...a,stg:{...a.stg}};
  if(!canAct||a.hp===0||a.hp===a.max)return out;
  out.hp=Math.min(a.max,a.hp+Math.round(a.max/2));
  return out;
}
/* Restricted one-action recovery scenario. The caller provides the actual
   incoming HP loss for each state, including full-HP-dependent effects.
   No residual damage, contact effects, items triggering on hit or action denial.
   A speed tie returns both orders rather than assuming either goes first. */
/* Isolated end-of-turn Leftovers recovery, not other residual effects.
   https://www.smogon.com/dex/champions/items/leftovers/
   Floor/minimum-one follows the existing battle engine; device rounding unverified. */
function reviewedLeftoversEnd(a){
  if(!a||!Number.isInteger(a.hp)||!Number.isInteger(a.max)||a.max<1||a.hp<0||a.hp>a.max)return null;
  const out={...a,stg:{...a.stg}};
  if(a.item==='leftovers'&&a.hp>0&&!a.fainted&&!a.healblock&&!a.volatiles?.healblock)out.hp=Math.min(a.max,a.hp+Math.max(1,Math.floor(a.max/16)));
  return out;
}
// Self-targeted direct healing: Prankster adds one, Triage adds three.
 // No Quick Claw, Trick Room, action denial or other order-changing field effects.
// Conditional order comparison for two damaging actions; fields are already active.
// Restricted, already-successful protection; only reviewed ordinary damaging moves.
const REVIEWED_GUARD_ATTACKS=new Set([89,57,58,85,53,94,157,585,337,583,453,245]);
function reviewedDoubleGuard(a,m,d,field={}){
  if(!a||!m||!d||a.formErr||d.formErr||!REVIEWED_GUARD_ATTACKS.has(m.id)||m.prot||m.maxH>1)return null;
  if(!['none','protect','wideGuard'].includes(field.guard)||!Number.isInteger(d.hp)||d.hp<=0)return null;
  if([a,d].some(x=>CALC_UNIMPL.includes(x.ab)||CALC_UNVERIFIED[x.ab]||CALC_UNIMPL_IT.includes(x.item))||a.ab==='parental-bond'||a.ab==='unseen-fist')return null;
  if(!moveUsable(m,{a,d}).ok)return null;
  const blocked=field.guard==='protect'||(field.guard==='wideGuard'&&!!m.tg);
  if(blocked)return {blocked:true,min:0,max:0};
  const r=dmgRolls(a,m,d,{format:'double',spread:field.multipleTargets===true,crit:false,protean:false,noNext:true});
  if(!r.length||r.dist||r.fband||!r.every(Number.isFinite))return null;
  return {blocked:false,min:Math.min(...r),max:Math.max(...r)};
}
function reviewedDoubleOrder(a,m,d,n,field={}){
  if(!a||!d||!m||!n||a.formErr||d.formErr||m.prot||n.prot)return null;
  const unknown=new Set(['quick-draw','stall','mycelium-might','prankster','triage']);
  if([a,d].some(x=>unknown.has(x.ab)||['quickclaw','custapberry','laggingtail','fullincense'].includes(x.item)))return null;
  const sa=effSpd(a,d)*(field.ownTailwind===true?2:1),sd=effSpd(d,a)*(field.oppTailwind===true?2:1);
  const pa=effPri(a,m),pd=effPri(d,n);
  if(![sa,sd,pa,pd].every(Number.isFinite)||sa<1||sd<1)return null;
  return {sa,sd,pa,pd,order:Math.sign(pa-pd)||Math.sign(sa-sd)*(field.trickRoom===true?-1:1)};
}
// Exhaustive single-donor transfers for one declared field scenario.
function reviewedSpeedTransfers(sp,evaluate){
  if(!Array.isArray(sp)||sp.length!==6||sp.some(n=>!Number.isInteger(n)||n<0||n>32)||sp.reduce((a,b)=>a+b,0)>66||typeof evaluate!=='function')return null;
  const valid=v=>Array.isArray(v)&&v.length>0&&v.every(n=>[-1,0,1].includes(n));
  const baseline=evaluate(sp.slice());if(!valid(baseline))return null;
  const best=[];let attempts=0;
  for(let donor=0;donor<5;donor++)for(const direction of [-1,1]){
    let winner=null;
    for(let k=1;k<=32;k++){
      const x=sp.slice();x[5]+=direction*k;x[donor]-=direction*k;
      if(x[5]<0||x[5]>32||x[donor]<0||x[donor]>32)break;
      attempts++;const v=evaluate(x);if(!valid(v)||v.length!==baseline.length||v.some((n,i)=>n<baseline[i]))continue;
      const gains=v.filter((n,i)=>n>baseline[i]).length;
      if(gains&&(!winner||gains>winner.gains))winner={sp:x,donor,delta:direction*k,gains,orders:v};
    }
    if(winner)best.push(winner);
  }
  best.sort((a,b)=>b.gains-a.gains||Math.abs(a.delta)-Math.abs(b.delta)||a.donor-b.donor||a.delta-b.delta);
  return {baseline,attempts,best};
}
// Compare matching per-scenario bounds, never compensate one lost matchup with another.
function reviewedDoubleTradeoff(base,next){
  const valid=v=>Array.isArray(v)&&v.length>0&&v.every(Number.isFinite);
  if(!base||!next||!['out','hp'].every(k=>valid(base[k])&&valid(next[k])&&base[k].length===next[k].length))return null;
  const out=next.out.map((v,i)=>v-base.out[i]),hp=next.hp.map((v,i)=>v-base.hp[i]);
  return {outMin:Math.min(...out),outMax:Math.max(...out),hpMin:Math.min(...hp),hpMax:Math.max(...hp),preserved:[...out,...hp].every(v=>v>=0)};
}
// Bounded independent scenario search; all objective coordinates are maximized.
function reviewedDoubleSearch(original,candidates,legal,evaluate,limit=64){
  if(!Number.isInteger(limit)||limit<1||limit>128||!legal(original))return null;
  const valid=x=>Array.isArray(x)&&x.length>0&&x.every(Number.isFinite);
  const baseline=evaluate(original);if(!valid(baseline))return null;
  const key=x=>JSON.stringify([x.moves,x.item,x.sp]),seen=new Set([key(original)]),best=[];
  let attempts=1,accepted=0;
  for(const x of candidates){
    if(attempts>=limit)break;
    const k=key(x);if(seen.has(k)||!legal(x))continue;
    seen.add(k);attempts++;
    const scores=evaluate(x);
    if(!valid(scores)||scores.length!==baseline.length)continue;
    accepted++;
    if(scores.some((v,i)=>v<baseline[i])||!scores.some((v,i)=>v>baseline[i]))continue;
    if(best.some(v=>v.scores.every((n,i)=>n>=scores[i])))continue;
    for(let i=best.length-1;i>=0;i--)if(scores.every((n,j)=>n>=best[i].scores[j]))best.splice(i,1);
    best.push({x,scores,gains:scores.filter((v,i)=>v>baseline[i]).length});
  }
  best.sort((a,b)=>b.gains-a.gains);
  return {baseline,attempts,accepted,best:best.slice(0,3)};
}
function reviewedRecoveryOrder(a,id,d,m){
  if(!REVIEWED_DIRECT_HEAL.has(id)||!a||!d||!m)return null;
  const selfPriority=a.ab==='triage'?3:a.ab==='prankster'?1:0;
  const attackPriority=effPri(d,m);
  if(selfPriority!==attackPriority)return Math.sign(selfPriority-attackPriority);
  return Math.sign(effSpd(a,d)-effSpd(d,a));
}
function reviewedRecoveryExchange(a,id,order,incoming){
  if(![-1,0,1].includes(order)||typeof incoming!=='function'||!a||!Number.isInteger(a.hp)||a.hp<1||a.hp>=a.max)return null;
  if(![null,'leftovers','lifeorb','expertbelt','muscleband','wiseglasses'].includes(a.item)&&!reviewedFixedMegaItem(a))return null;
  const hit=x=>{const n=incoming(x);return Number.isSafeInteger(n)&&n>=0?{...x,stg:{...x.stg},hp:Math.max(0,x.hp-n)}:null};
  const run=first=>{
    let x={...a,stg:{...a.stg}};
    if(first){x=reviewedDirectHeal(x,id,true);if(!x)return null;x=hit(x);}
    else{x=hit(x);if(!x)return null;if(x.hp>0)x=reviewedDirectHeal(x,id,true);}
    if(!x)return null;const end=reviewedLeftoversEnd(x);return end?{first,hp:x.hp,endHP:end.hp,alive:x.hp>0}:null;
  };
  const rows=(order===0?[true,false]:[order===1]).map(run);
  if(rows.some(x=>!x))return null;
  return {rows,minHP:Math.min(...rows.map(x=>x.hp)),maxHP:Math.max(...rows.map(x=>x.hp)),guaranteedSurvival:rows.every(x=>x.alive),minEndHP:Math.min(...rows.map(x=>x.endHP)),maxEndHP:Math.max(...rows.map(x=>x.endHP))};
}
const nuOffK=mv=>mv.id===776?'def':mv.cls===0?'atk':'spa';
function nextUseCould(a,mv,d){const k=mkey(mv),ok=nuOffK(mv);
  if(MB_REP.has(k)||(mv.e&&mv.e.s&&mv.e.s.some(([st,n,c])=>c>=100&&st===ok)))return true;
  if(a.item==='normalgem'&&hitType(a,mv,d)==='ノーマル')return true;
  if((d.ab==='stamina'||d.ab==='weak-armor')&&mv.cls===0&&mv.id!==776)return true;
  if(d.disg)return true;
  if(d.item&&RES_BERRY[d.item]&&(RES_BERRY[d.item]===hitType(a,mv,d)))return true;
  if(d.hp===d.max&&d.ab==='multiscale')return true;
  return false}
function nextUse(a,mv,d,o){
  if(!nextUseCould(a,mv,d))return{a,d,changed:false};
  const b=bhits(a,mv,d,{...o,r:o&&o.r||100});const st=b.state,k=mkey(mv);
  const a2={...a,stg:{...a.stg}};
  if(MB_REP.has(k))a2.stg.spa=Math.min(6,(a2.stg.spa||0)+1);
  if(!sfSup(a,mv))((mv.e&&mv.e.s)||[]).forEach(([s,n,c])=>{if(c>=100&&a2.stg[s]!=null)a2.stg[s]=Math.max(-6,Math.min(6,a2.stg[s]+n))});
  if(a.item==='normalgem'&&hitType(a,mv,d)==='ノーマル')a2.item=null;
  const d2={...d,stg:{...st.stg},item:st.item,disg:st.disg,hp:Math.min(d.hp,Math.max(1,d.max-1))};
  /* changed は次の使用のダメージに効く変化だけ（ほかの変化も写しには入れておく） */
  const ok=nuOffK(mv),dk=mv.id===776||mv.cls===0||(mv.e&&mv.e.ps)?'def':'spd';
  const berryRel=!!(d.item&&RES_BERRY[d.item]&&RES_BERRY[d.item]===hitType(a,mv,d));
  const changed=(a2.stg[ok]||0)!==(a.stg[ok]||0)||(MB_REP.has(k)&&(a2.stg.spa||0)!==(a.stg.spa||0))||a2.item!==a.item||(d2.stg[dk]||0)!==(d.stg[dk]||0)||(berryRel&&d2.item!==d.item)||d2.disg!==d.disg||(d.hp===d.max&&d.ab==='multiscale');
  return{a:a2,d:d2,changed};
}
/* 使うごとの1回のダメージ（％）の並び：1回目・2回目…（6回まで）。状態が変わらないなら null（呼ぶ側は同じ値を使う） */
function useSeq(a,mv,d,r,o){
  o=o||{};if(!nextUse(a,mv,d,{...o,r,nHits:o.nHits}).changed)return null;
  let A=a,D=d,out=[],any=false;
  for(let k=0;k<6;k++){const b=bhits(A,mv,D,{...o,r,nHits:o.nHits});out.push(b.total/d.max*100);const nx=nextUse(A,mv,D,{...o,r,nHits:o.nHits});if(nx.changed)any=true;A=nx.a;D=nx.d}
  return any?out:null;
}
/* 天気の効果を消す特性（ノーてんき・エアロック）：天気はあるが、効果は出ない（2026/11/24） */
const WX_SUPP=new Set(['cloud-nine','air-lock']);
const wxEffK=(a,d)=>{const k=B.weather&&B.weather.k;if(!k)return null;if((a&&WX_SUPP.has(a.ab))||(d&&WX_SUPP.has(d.ab)))return null;return k};
const MOHKO=new Set(['guillotine','fissure','horndrill','sheercold']);
/* 命中（2026/11/24、Pokémon Showdown e7f50cd の hitStepAccuracy と同じ順）：
   一撃必殺＝30（ぜったいれいどはこおりタイプ以外20、ほかの補正なし）→ 天気（かみなり・ぼうふう：あめで必中・はれで50、ふぶき：ゆきで必中）→ ノーガード →
   命中の補正（ふくがん1.3・はりきり0.8〔物理〕・すながくれ/ゆきがくれ0.8 → こうかくレンズ1.1・ひかりのこな0.9。4096分の1の鎖で掛けて、最後に1回丸める）→
   命中・回避のランク（てんねんで消える）→ 100を超えたら100（必ず当たる＝100%） */
/* 実際の優先度（2026/11/24）：はやてのつばさ＝HP満タンのひこう技+1。いたずらごころは変化技だけ（ダメージの計算には関係しない） */
const effPri=(a,mv)=>{let p=(mv&&mv.pri)||0;if(a&&a.ab==='gale-wings'&&hitType(a,mv)==='ひこう'&&a.hp===a.max)p++;return p};
const accOf=(a,mv,d,o)=>{
  const mk=mkey(mv),ig=a.ab==='mold-breaker',dab=ig?null:d.ab,wx=wxEffK(a,d);
  if(MOHKO.has(mk))return mk==='sheercold'&&!(a.p&&a.p.t.includes('こおり'))?20:30;
  if(!mv.acc)return 100;
  let acc=mv.acc;
  if(mk==='thunder'||mk==='hurricane'){if(wx==='rain')return 100;if(wx==='sun')acc=50}
  if(mk==='blizzard'&&wx==='snow')return 100;
  if(a.ab==='no-guard'||d.ab==='no-guard')return 100;
  let m=4096;
  if(a.ab==='compound-eyes')m=chM(m,5325);
  if(a.ab==='hustle'&&mv.cls===0)m=chM(m,3277);
  if((dab==='sand-veil'&&wx==='sand')||(dab==='snow-cloak'&&wx==='snow'))m=chM(m,3277);
  if(a.item==='widelens')m=chM(m,4505);
  if(d.item==='brightpowder')m=chM(m,3686);
  if(m!==4096)acc=Math.trunc((Math.trunc(acc*m)+2047)/4096);
  const st=x=>Math.max(-6,Math.min(6,x||0));
  const ba=dab==='unaware'?0:st(a.stg&&a.stg.acc),be=a.ab==='unaware'?0:st(d.stg&&d.stg.eva),bo=st(ba-be);
  if(bo>0)acc=Math.trunc(acc*(3+bo)/3);else if(bo<0)acc=Math.trunc(acc*3/(3-bo));
  return Math.max(0,Math.min(100,acc))};
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
      let tot=0,eff=1,n=0,none=false,abs=null,dsg=0;
      for(let h=0;h<hits&&!t.fainted;h++){
        const cr=(mv.e&&mv.e.cr)||0,crit=Math.random()<[1/24,1/8,1/2,1][Math.min(3,cr)];
        const r=bcalc(b,mv,t,{roll:true,spread,crit});if(crit&&r.eff&&!r.absorb&&!r.disg)log('急所に 当たった！');
        if(r.absorb){abs=r.absorb;break}
        /* ばけのかわ（2026/11/13 見直し）：前はここで連続技を止め、HPも減らしていなかった。
           この当たりの技のダメージは0。はがれて最大HPの1/8が減る（技のダメージではない）。0になれば倒れて、残りの当たりはない（for の !t.fainted）。
           倒れなければ、同じ技の残りの当たりはふつうに受ける */
        if(r.disg){t.disg=false;n++;B.hit.push(t);
          const ls=Math.min(r.loss,t.hp);t.hp-=ls;dsg=ls;
          log(`${bn(t)}の ばけのかわが はがれた！ 技の ダメージは 受けなかったが、HPが ${ls}（最大HPの1/8） へった`);
          if(!t.hp)t.fainted=true;
          else if(t.item==='sitrusberry'&&t.hp*2<=t.max){t.hp=Math.min(t.max,t.hp+Math.floor(t.max/4));t.item=null;log(`${bn(t)}は オボンのみで 回復した！`)}
          continue}
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
      if(!(dsg&&n===1))log(`${txt}${bn(t)}に ${pc}%${n>1?`（${n}回）`:''}${dsg?'（ばけのかわの分を除く技のダメージ）':''}`);
      if(mv.drain>0){const hv=Math.floor(tot*mv.drain/100);b.hp=Math.min(b.max,b.hp+hv)}
      if(mv.drain<0&&!b.fainted){b.hp=Math.max(0,b.hp-Math.floor(tot*-mv.drain/100));if(!b.hp){b.fainted=true;log(`<span class="ko">${bn(b)}は 反動で たおれた！</span>`)}}
      if(t.fainted){log(`<span class="ko">${bn(t)}は たおれた！</span>`);if(b.ab==='moxie'&&!b.fainted)chg(b,'atk',1,log,'じしんかじょう')}
      else if(mv.e&&!sfSup(b,mv)){const e=mv.e;
        if(e.a&&Math.random()*100<e.a[1])inflict(t,e.a[0],log);
        if(e.f&&Math.random()*100<e.f)t.flinch=true;
        (e.t||[]).forEach(([k,n,c])=>{if(Math.random()*100>=c)return;if(['clear-body','white-smoke'].includes(t.ab)||(k==='atk'&&t.ab==='hyper-cutter')){log(`${bn(t)}の ${abn(t)}で 能力は 下がらない！`);return}
          chg(t,k,n,log);if(n<0&&t.ab==='defiant')chg(t,'atk',2,log,'まけんき');if(n<0&&t.ab==='competitive')chg(t,'spa',2,log,'かちき')});
        if(t.status==='frz'&&hitType(b,mv)==='ほのお'){t.status=null;log(`${bn(t)}の こおりが 溶けた！`)}}
    }
    if(MSELFKO.has(mk)&&!b.fainted){b.hp=0;b.fainted=true;log(`<span class="ko">${bn(b)}は たおれた！</span>`)}
    if(didHit&&MRECH.has(mk)&&!b.fainted)b.recharge=true;
    if(didHit&&!b.fainted&&mv.e&&mv.e.s)mv.e.s.forEach(([k,n,c])=>{if(n>0&&sfSup(b,mv))return;if(Math.random()*100<c)chg(b,k,n,log)});
    if(b.item==='lifeorb'&&!b.fainted&&b.hp>0&&didHit&&!sfSup(b,mv)){b.hp=Math.max(0,b.hp-Math.max(1,Math.floor(b.max/10)));if(!b.hp){b.fainted=true;log(`<span class="ko">${bn(b)}は いのちのたまで たおれた！</span>`)}}
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


