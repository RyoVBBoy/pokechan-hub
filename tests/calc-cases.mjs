// ダメージ計算の決まった場面の確認（2026/11/13）：検証シートの31件（条件を直したもの）＋連続技を1発ずつ確かめる場面
// 期待値は @smogon/calc（本物のポケモン名・技名・特性名・持ち物名で計算。タイプ・重さ・姿は照合先のデータ）から作る。
// 当サイトから渡すのは実数値だけ（ポケモンチャンピオンズの能力ポイントの式はほかの計算機にないため。式そのものはここでは確かめない）。
// 連続技は、照合先の「1発だけ」の計算を、その当たりの直前のHP・乱数・急所で1発ずつ並べて足したものを期待値にする（当サイトの計算は使わない）。
// 照合先にない特性（ポケモンチャンピオンズにだけある特性）は「当サイトの説明どおり」の場面として別に数え、確かめたことにはしない。
import {chromium} from 'playwright';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {calculate,Pokemon,Move,Field,Generations,Side}=require('@smogon/calc');
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const gen=Generations.get(9);
/* calculate は中で能力を作り直すので、渡した実数値を残す（calc-ref.mjs と同じ） */
const oc=Pokemon.prototype.clone;Pokemon.prototype.clone=function(){const c=oc.call(this);c.types=[...this.types];c.rawStats={...this.rawStats};c.stats={...this.stats};c.originalCurHP=this.originalCurHP;return c};

const P_=[2,32,0,0,0,32],S_=[2,0,0,32,0,32],H_=[32,0,2,0,32,0],D_=[32,0,32,0,2,0];
const ATK={sp:P_,up:1,dn:3},SPA={sp:S_,up:3,dn:1},BULK={sp:H_,up:2,dn:3},SBULK={sp:H_,up:4,dn:3};
/* 場面：A＝攻撃側、D＝受ける側（n＝当サイトの名前、en＝照合先の名前〔null なら照合先にない姿なので、当サイトのタイプを入れた Mew で計算〕）
   mv＝当サイトの技の名前（mkey）、en＝照合先の技、o＝条件。hp＝いまのHP（実数）。expect＝照合先で計算できない場面の、当サイトの説明に基づく値 */
const C=[
 {no:1,t:'基本（タイプ一致・効果ばつぐん）',A:{n:'ガブリアス',en:'Garchomp',ab:'rough-skin',...ATK},D:{n:'ブリジュラス',en:'Archaludon',ab:'sturdy',...SBULK,up:4,dn:1},mv:'earthquake'},
 {no:2,t:'特殊・タイプ一致なし（マルチスケイルが働かないよう HP 196/198）',A:{n:'サーフゴー',en:'Gholdengo',ab:'good-as-gold',...SPA},D:{n:'カイリュー',en:'Dragonite',ab:'multiscale',...BULK,hp:196},mv:'thunderbolt'},
 {no:3,t:'マルチスケイル（HP 198/198 で働く）',A:{n:'サーフゴー',en:'Gholdengo',ab:'good-as-gold',...SPA},D:{n:'カイリュー',en:'Dragonite',ab:'multiscale',...BULK},mv:'icebeam'},
 {no:4,t:'急所（受ける側の防御+2は無視される）',A:{n:'ガブリアス',en:'Garchomp',ab:'rough-skin',...ATK},D:{n:'カビゴン',en:'Snorlax',ab:'thick-fat',...BULK,stg:{def:2}},mv:'outrage',o:{crit:true}},
 {no:5,t:'ランク（攻撃+2）',A:{n:'ガブリアス',en:'Garchomp',ab:'rough-skin',...ATK,stg:{atk:2}},D:{n:'カビゴン',en:'Snorlax',ab:'thick-fat',...BULK},mv:'outrage'},
 {no:6,t:'やけど（物理が半分）',A:{n:'ガブリアス',en:'Garchomp',ab:'rough-skin',...ATK,status:'brn'},D:{n:'カビゴン',en:'Snorlax',ab:'thick-fat',...BULK},mv:'outrage'},
 {no:7,t:'天気（はれ・ほのお1.5倍）',A:{n:'ウインディ',en:'Arcanine',ab:'intimidate',...SPA},D:{n:'ブリジュラス',en:'Archaludon',ab:'sturdy',...SBULK},mv:'flamethrower',o:{w:'sun'}},
 {no:8,t:'天気（すなあらし・いわの特防1.5倍）',A:{n:'サーフゴー',en:'Gholdengo',ab:'good-as-gold',...SPA},D:{n:'バンギラス',en:'Tyranitar',ab:'sand-stream',...SBULK},mv:'shadowball',o:{w:'sand'}},
 {no:9,t:'壁（ひかりのかべ・マルチスケイルが働かないよう HP 196/198）',A:{n:'サーフゴー',en:'Gholdengo',ab:'good-as-gold',...SPA},D:{n:'カイリュー',en:'Dragonite',ab:'multiscale',...BULK,hp:196},mv:'shadowball',o:{screen:true}},
 {no:10,t:'ダブル・全体技（×0.75）',A:{n:'ガブリアス',en:'Garchomp',ab:'rough-skin',...ATK},D:{n:'ブリジュラス',en:'Archaludon',ab:'sturdy',...SBULK,up:4,dn:1},mv:'earthquake',o:{spread:true}},
 {no:11,t:'持ち物：いのちのたま',A:{n:'ガブリアス',en:'Garchomp',ab:'rough-skin',item:'lifeorb',...ATK},D:{n:'カビゴン',en:'Snorlax',ab:'thick-fat',...BULK},mv:'earthquake'},
 {no:12,t:'持ち物：半減きのみ（ヤチェのみ）',A:{n:'サーフゴー',en:'Gholdengo',ab:'good-as-gold',...SPA},D:{n:'ガブリアス',en:'Garchomp',ab:'rough-skin',item:'yacheberry',...SBULK},mv:'icebeam'},
 {no:13,t:'特性：あついしぼう',A:{n:'ウインディ',en:'Arcanine',ab:'intimidate',...SPA},D:{n:'カビゴン',en:'Snorlax',ab:'thick-fat',...SBULK},mv:'flamethrower'},
 {no:14,expect:'halfhp',t:'いかりのまえば（相手のいまのHPの半分）',A:{n:'カビゴン',en:'Snorlax',ab:'thick-fat',...ATK},D:{n:'ガブリアス',en:'Garchomp',ab:'rough-skin',...BULK},mv:'superfang'},
 {no:15,t:'けたぐり（相手の重さで威力）',A:{n:'ルカリオ',en:'Lucario',ab:'inner-focus',...ATK},D:{n:'カビゴン',en:'Snorlax',ab:'thick-fat',...BULK},mv:'lowkick'},
 {no:16,t:'ふんか（攻撃側のHP 75/150＝威力75）',A:{n:'バクフーン（ヒスイ）',en:'Typhlosion-Hisui',ab:'blaze',...SPA,hp:75},D:{n:'ブリジュラス',en:'Archaludon',ab:'sturdy',...SBULK},mv:'eruption'},
 {no:17,t:'ボディプレス（自分の防御で計算）',A:{n:'アーマーガア',en:'Corviknight',ab:'mirror-armor',sp:D_,up:2,dn:1},D:{n:'カビゴン',en:'Snorlax',ab:'thick-fat',...BULK},mv:'bodypress'},
 {no:18,t:'スキルリンクの連続技（メガヘラクロス・ロックブラスト5回）',A:{n:'ヘラクロス',en:'Heracross-Mega',ab:'guts',item:'heracronite',...ATK},D:{n:'カビゴン',en:'Snorlax',ab:'thick-fat',...BULK},mv:'rockblast',hits:5},
 {no:19,t:'メガシンカ：メガガブリアス（すなのちから）',A:{n:'ガブリアス',en:'Garchomp-Mega',ab:'rough-skin',item:'garchompite',...ATK},D:{n:'カビゴン',en:'Snorlax',ab:'thick-fat',...BULK},mv:'earthquake'},
 {no:20,t:'メガシンカ：メガガブリアスZ（ドラゴン単タイプ・ふゆう）のじしん',A:{n:'ガブリアス',en:null,ab:'rough-skin',item:'garchompitez',...ATK},D:{n:'カビゴン',en:'Snorlax',ab:'thick-fat',...BULK},mv:'earthquake'},
 {no:21,t:'メガシンカ：メガリザードンY（はれ）',A:{n:'リザードン',en:'Charizard-Mega-Y',ab:'blaze',item:'charizarditey',...SPA},D:{n:'ブリジュラス',en:'Archaludon',ab:'sturdy',...SBULK},mv:'flamethrower',o:{w:'sun'}},
 {no:22,t:'メガシンカ（受ける側）：メガリザードンX（ほのお/ドラゴン）',A:{n:'ガブリアス',en:'Garchomp',ab:'rough-skin',...ATK},D:{n:'リザードン',en:'Charizard-Mega-X',ab:'blaze',item:'charizarditex',...BULK},mv:'outrage'},
 {no:23,t:'ギルガルド：攻撃はブレードフォルム（特攻はブレードフォルムの実数値）',A:{n:'ギルガルド',en:null,blade:true,ab:'stance-change',...SPA},D:{n:'ブリジュラス',en:'Archaludon',ab:'sturdy',...SBULK},mv:'shadowball'},
 {no:24,t:'地方の姿：ウインディ（ヒスイ）',A:{n:'ウインディ（ヒスイ）',en:'Arcanine-Hisui',ab:'intimidate',...ATK},D:{n:'カビゴン',en:'Snorlax',ab:'thick-fat',...BULK},mv:'rockslide'},
 {no:25,t:'レイジングブル（パルデア・ブレイズ種はほのおタイプ）',A:{n:'ケンタロス（パルデア・ブレイズ種）',en:'Tauros-Paldea-Blaze',ab:'intimidate',...ATK},D:{n:'ゲンガー',en:'Gengar',ab:'cursed-body',...BULK},mv:'ragingbull'},
 {no:26,t:'ネズミざん（テクニシャン・10回当たったとき）',A:{n:'イッカネズミ',en:'Maushold',ab:'technician',...ATK},D:{n:'カビゴン',en:'Snorlax',ab:'thick-fat',...BULK},mv:'populationbomb',hits:10},
 {no:27,t:'こんじょう＋やけど（攻撃1.5倍・やけどで半分にならない）',A:{n:'ヘラクロス',en:'Heracross',ab:'guts',...ATK,status:'brn'},D:{n:'カビゴン',en:'Snorlax',ab:'thick-fat',...BULK},mv:'closecombat'},
 {no:28,t:'ふうせんにじめん技（0）',A:{n:'ガブリアス',en:'Garchomp',ab:'rough-skin',...ATK},D:{n:'カビゴン',en:'Snorlax',ab:'thick-fat',item:'airballoon',...BULK},mv:'earthquake'},
 {no:29,t:'連続技＋マルチスケイル（スキルリンクのロックブラスト5回→HP満タンのカイリュー）',A:{n:'ヘラクロス',en:'Heracross-Mega',ab:'guts',item:'heracronite',...ATK},D:{n:'カイリュー',en:'Dragonite',ab:'multiscale',...BULK},mv:'rockblast',hits:5},
 {no:30,t:'メガゲッコウガ：へんげんじざいがこの技で発動（タイプ一致になる）',A:{n:'ゲッコウガ',en:null,ab:'protean',item:'greninjite',...SPA},D:{n:'ガブリアス',en:'Garchomp',ab:'rough-skin',...SBULK},mv:'icebeam',o:{protean:true}},
 {no:31,t:'メガシビルドン（うなぎのぼり）にじめん技（当サイトの説明どおり0。ゲームで未確認）',A:{n:'ガブリアス',en:'Garchomp',ab:'rough-skin',...ATK},D:{n:'シビルドン',en:null,ab:'levitate',item:'eelektrossite',...BULK},mv:'earthquake',expect:'zero',unverified:'うなぎのぼり'},
 /* ここから追加の場面 */
 {no:32,t:'追加：レイジングブルは壁を壊す（リフレクターがあっても半分にならない）',A:{n:'ケンタロス（パルデア・ブレイズ種）',en:'Tauros-Paldea-Blaze',ab:'intimidate',...ATK},D:{n:'カビゴン',en:'Snorlax',ab:'thick-fat',...BULK},mv:'ragingbull',o:{screen:true}},
 {no:33,t:'追加：メガゲッコウガ：へんげんじざいが発動済み（もとのタイプ＝タイプ一致なし）',A:{n:'ゲッコウガ',en:null,refAb:'Pressure',ab:'protean',item:'greninjite',...SPA},D:{n:'ガブリアス',en:'Garchomp',ab:'rough-skin',...SBULK},mv:'icebeam',o:{protean:false}},
 {no:34,t:'追加：メガガブリアスZ（ふゆう）はじめん技を受けない',A:{n:'ガブリアス',en:'Garchomp',ab:'rough-skin',...ATK},D:{n:'ガブリアス',en:null,ab:'rough-skin',item:'garchompitez',...BULK},mv:'earthquake'},
 {no:35,t:'追加：ツインビーム（2回当たる）',A:{n:'サーフゴー',en:'Gholdengo',ab:'good-as-gold',...SPA},D:{n:'カイリュー',en:'Dragonite',ab:'multiscale',...BULK},mv:'twinbeam'},
 {no:36,t:'追加：ロックブラスト5回（HPが満タンでないカイリュー＝マルチスケイルは働かない）',A:{n:'ヘラクロス',en:'Heracross-Mega',ab:'guts',item:'heracronite',...ATK},D:{n:'カイリュー',en:'Dragonite',ab:'multiscale',...BULK,hp:197},mv:'rockblast',hits:5},
];
const EN_MV={earthquake:'Earthquake',thunderbolt:'Thunderbolt',icebeam:'Ice Beam',outrage:'Outrage',flamethrower:'Flamethrower',shadowball:'Shadow Ball',superfang:'Super Fang',lowkick:'Low Kick',eruption:'Eruption',bodypress:'Body Press',rockblast:'Rock Blast',rockslide:'Rock Slide',ragingbull:'Raging Bull',populationbomb:'Population Bomb',closecombat:'Close Combat',twinbeam:'Twin Beam'};
const EN_AB={'rough-skin':'Rough Skin',sturdy:'Sturdy','good-as-gold':'Good as Gold',multiscale:'Multiscale','thick-fat':'Thick Fat',intimidate:'Intimidate','sand-stream':'Sand Stream','inner-focus':'Inner Focus',blaze:'Blaze','mirror-armor':'Mirror Armor','skill-link':'Skill Link','sand-force':'Sand Force',levitate:'Levitate',drought:'Drought','tough-claws':'Tough Claws','stance-change':'Stance Change','cursed-body':'Cursed Body',technician:'Technician',guts:'Guts',protean:'Protean'};
const EN_IT={lifeorb:'Life Orb',yacheberry:'Yache Berry',airballoon:'Air Balloon'};
const TY={ノーマル:'Normal',ほのお:'Fire',みず:'Water',でんき:'Electric',くさ:'Grass',こおり:'Ice',かくとう:'Fighting',どく:'Poison',じめん:'Ground',ひこう:'Flying',エスパー:'Psychic',むし:'Bug',いわ:'Rock',ゴースト:'Ghost',ドラゴン:'Dragon',あく:'Dark',はがね:'Steel',フェアリー:'Fairy'};

/* ---- 当サイトで計算 ---- */
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const pg=await (await b.newContext({locale:'ja-JP'})).newPage();await pg.route(/^https?:/,r=>r.abort());
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('file://'+path.join(ROOT,'dist/index.html'));await pg.waitForTimeout(500);
/* 連続技の1発ずつの場面（5回の乱数と急所を当たりごとに決める） */
const SEQ=[
 {t:'急所なし・全部の当たりが乱数最小',rolls:[85,85,85,85,85],crits:[0,0,0,0,0]},
 {t:'急所なし・全部の当たりが乱数最大',rolls:[100,100,100,100,100],crits:[0,0,0,0,0]},
 {t:'1発目だけ急所',rolls:[92,92,92,92,92],crits:[1,0,0,0,0]},
 {t:'4発目だけ急所',rolls:[92,92,92,92,92],crits:[0,0,0,1,0]},
 {t:'当たりごとに乱数が違う',rolls:[85,100,90,95,87],crits:[0,0,0,0,0]},
 {t:'乱数も急所もばらばら',rolls:[100,85,96,88,93],crits:[1,0,1,0,0]},
];
const site=await pg.evaluate(([C,SEQ])=>{
  const K=k=>+Object.keys(MDK).find(id=>MDK[id].split('|')[0]===k);
  const mk=(c,side)=>{const p=P.find(x=>x.n===c.n);const m=mkMon(p,side,{ab:c.ab,item:c.item||null,moves:[],sp:c.sp,up:c.up,dn:c.dn});
    m.stg={atk:0,def:0,spa:0,spd:0,spe:0,...(c.stg||{})};if(c.status)m.status=c.status;if(c.hp)m.hp=c.hp;return m};
  const out=[];
  for(const c of C){
    const a=mk(c.A,'me'),d=mk(c.D,'op'),mv=mvObj(K(c.mv)),o=c.o||{};
    const opt={crit:!!o.crit,spread:!!o.spread,screen:!!o.screen,protean:!!o.protean,hits:c.hits||0};
    const sw=B.weather;B.weather=o.w?{k:o.w,t:5}:null;
    let r,seq=null,eff,n,dist,hitsMax,ko;
    try{r=dmgRolls(a,mv,d,opt);const h=bhits(a,mv,d,{...opt,r:100});eff=h.eff;n=h.n;hitsMax=h.hits.map(x=>x.dmg);
      dist=r.dist?{sum:r.dist.reduce((s,[,w])=>s+w,0),lo:r.dist[0][0],hi:r.dist[r.dist.length-1][0]}:null;ko=koInfo(r,d.hp);
      if(c.no===29)seq=SEQ.map(q=>bhits(a,mv,d,{...opt,rolls:q.rolls,crits:q.crits.map(Boolean)}).hits.map(x=>x.dmg));
    }finally{B.weather=sw}
    const st=x=>x.st,ast=a.stAtk||a.st;
    out.push({no:c.no,r,n,eff,seq,dist,hitsMax,ko,A:{st:a.st,stAtk:a.stAtk,t:a.p.t,ab:a.ab,form:a.p.n,hp:a.hp,max:a.max,wt:wtOf(a)},D:{st:d.st,t:d.p.t,ab:d.ab,form:d.p.n,hp:d.hp,max:d.max,wt:wtOf(d)},mvt:hitType(a,mv),pow:mv.pow});
  }
  /* スキルリンクは、選んだ回数（hits）があっても最大の回数 */
  {const her=mkMon(P.find(x=>x.n==='ヘラクロス'),'me',{ab:'guts',item:'heracronite',moves:[],sp:[2,32,0,0,0,32],up:1,dn:3}),dra=mkMon(P.find(x=>x.n==='カイリュー'),'op',{ab:'multiscale',moves:[]});
   out.push({no:'sl',slHits:bhits(her,mvObj(K('rockblast')),dra,{hits:2,r:100}).n});}
  return out;
},[C,SEQ]);
await b.close();

/* ---- 照合先で計算 ---- */
const S=a=>({hp:a[0],atk:a[1],def:a[2],spa:a[3],spd:a[4],spe:a[5]});
function mon(x,sx,isA,gen){
  const sp=x.en||'Mew';
  const st=S(isA&&x.blade?sx.stAtk:sx.st);
  const p=new Pokemon(gen,sp,{level:50,ability:x.refAb||EN_AB[sx.ab]||'Pressure',item:x.item&&EN_IT[x.item]?EN_IT[x.item]:undefined,status:x.status||'',
    boosts:x.stg?{...x.stg}:{}});
  /* 照合先にない姿は、当サイトのタイプ・重さを入れる（そのぶん独立した確かめではない）。refAb：照合先で使う特性（発動しない へんげんじざい＝何もしない特性） */
  if(!x.en){p.types=sx.t.map(t=>TY[t]);p.weightkg=sx.wt}
  p.rawStats={...st};p.stats={...st};p.originalCurHP=sx.hp;return p;
}
/* gen：照合先のデータの世代（はじめは第9世代） */
function ref(c,s,curHP,crit,hits1){
  const gen=Generations.get(c.gen||9);
  const o=c.o||{};const a=mon(c.A,s.A,true,gen),d=mon(c.D,s.D,false,gen);if(curHP!=null)d.originalCurHP=curHP;
  const mv=new Move(gen,EN_MV[c.mv],{isCrit:crit!=null?crit:!!o.crit,...(hits1?{hits:1}:{})});
  const f=new Field({gameType:o.spread?'Doubles':'Singles',weather:o.w?{sun:'Sun',rain:'Rain',sand:'Sand',snow:'Snow'}[o.w]:undefined,
    defenderSide:new Side({isReflect:!!o.screen&&mv.category==='Physical',isLightScreen:!!o.screen&&mv.category==='Special'})});
  let r=calculate(gen,a,d,mv,f).damage;if(!Array.isArray(r))r=Array(16).fill(r);
  /* 回数が決まった連続技（ツインビーム等）は1回ずつの表が並んで返る：渡したHPでの1発目の表を使う */
  if(Array.isArray(r[0]))r=r[0];
  return r;
}
let bad=0,n=0,unv=0,rule=0;const ok=(cond,name,info)=>{n++;if(!cond){bad++;console.error('NG',name,JSON.stringify(info))}};
const report=[];
for(const c of C){
  const s=site.find(x=>x.no===c.no),o=c.o||{};
  let exp,how;
  if(c.expect==='zero'){exp=Array(16).fill(0);how='当サイトの説明どおり（照合先にない特性・ゲームで未確認）';unv++}
  /* いかりのまえば：照合先の計算機はこの技を計算しない（どの世代でも0を返す）ので、ゲームの決まり「相手のいまのHPの半分（切り捨て、最低1）」で */
  else if(c.expect==='halfhp'){exp=Array(16).fill(Math.max(1,Math.floor(s.D.hp/2)));how='ゲームの決まり（照合先は未対応）';rule++}
  else if(s.n>1){
    /* 1発ずつ：その当たりの直前のHPで照合先を計算して足す（乱数は全部の当たりで同じ段階＝表の16の値） */
    exp=[];for(let k=0;k<16;k++){let hp=s.D.hp,t=0;for(let i=0;i<s.n;i++){const v=ref(c,s,Math.max(1,hp),null,true)[k];t+=v;hp-=v}exp.push(t)}
    how=`照合先（1発ずつ${s.n}回）`;
  }else{exp=ref(c,s,null,null,false);how='照合先'}
  const same=JSON.stringify(exp)===JSON.stringify(s.r);
  ok(same,`#${c.no} ${c.t}`,{site:[s.r[0],s.r[15]],exp:[exp[0],exp[15]],n:s.n,type:s.mvt});
  report.push({no:c.no,t:c.t,site:`${s.r[0]}〜${s.r[15]}`,exp:`${exp[0]}〜${exp[15]}`,how,pass:same,n:s.n,form:s.A.form+' → '+s.D.form,mvt:s.mvt,ko:s.ko,dmax:s.D.max,dhp:s.D.hp,ahp:s.A.hp,amax:s.A.max,ast:(s.A.stAtk||s.A.st).join('-'),dst:s.D.st.join('-'),aab:s.A.ab,dab:s.D.ab,pow:s.pow});
}
/* 形の確かめ：姿・タイプ・特性・回数 */
const g=no=>site.find(x=>x.no===no);
ok(g(16).A.hp===75&&g(16).A.max===150,'#16 ふんか：攻撃側のHPを75/150で計算',g(16).A);
ok(JSON.stringify(g(20).A.t)==='["ドラゴン"]'&&g(20).A.ab==='levitate'&&g(20).A.form==='メガガブリアスZ','#20 メガガブリアスZ：ドラゴン単タイプ・ふゆう',g(20).A);
ok(g(19).A.ab==='sand-force'&&g(19).A.form==='メガガブリアス','#19 メガガブリアスはすなのちから（Zとは別の姿）',g(19).A);
ok(JSON.stringify(g(22).D.t)==='["ほのお","ドラゴン"]'&&g(22).D.ab==='tough-claws','#22 メガリザードンX：ほのお/ドラゴン・かたいツメ',g(22).D);
ok(JSON.stringify(g(21).A.t)==='["ほのお","ひこう"]'&&g(21).A.ab==='drought','#21 メガリザードンY：ほのお/ひこう・ひでり',g(21).A);
ok(g(23).A.stAtk&&g(23).A.stAtk[3]>g(23).A.st[3],'#23 ギルガルド：攻撃はブレードフォルムの特攻',g(23).A);
ok(g(25).mvt==='ほのお'&&g(25).eff>0,'#25 レイジングブル（ブレイズ種）はほのおタイプでゴーストにも当たる',{t:g(25).mvt,eff:g(25).eff});
ok(g(26).n===10&&g(18).n===5&&g(29).n===5&&g(35).n===2,'連続技の回数（ネズミざん10・スキルリンク5・ツインビーム2）',[g(26).n,g(18).n,g(29).n,g(35).n]);
ok(g(28).eff===0&&g(28).r.every(v=>v===0),'#28 ふうせん：じめん技は0（こうかなし）',g(28).r);
ok(g(34).eff===0,'#34 メガガブリアスZ（ふゆう）はじめん技を受けない',g(34).eff);
ok(g(29).hitsMax[0]*2<=g(29).hitsMax[1]+1&&g(29).hitsMax.slice(1).every(v=>v===g(29).hitsMax[1]),'#29 マルチスケイルは1発目だけ（2発目からは半分にならない）',g(29).hitsMax);
ok(g(36).hitsMax.every(v=>v===g(36).hitsMax[0]),'#36 HPが満タンでなければ1発目も半分にならない',g(36).hitsMax);
for(const no of [18,26,29,35,36]){const x=g(no);ok(x.dist&&Math.abs(x.dist.sum-1)<1e-9&&x.dist.lo===x.r[0]&&x.dist.hi===x.r[15],`#${no} 連続技の合計の分布（確率の合計1・最小と最大が表と同じ）`,x.dist)}
/* 1発ずつの場面（#29）：当たりごとに照合先で計算 */
{const c=C.find(x=>x.no===29),s=g(29);
 SEQ.forEach((q,j)=>{let hp=s.D.hp;const exp=[];for(let i=0;i<5;i++){const v=ref(c,s,Math.max(1,hp),!!q.crits[i],true)[q.rolls[i]-85];exp.push(v);hp-=v}
   ok(JSON.stringify(exp)===JSON.stringify(s.seq[j]),`#29 1発ずつ：${q.t}`,{site:s.seq[j],exp});
   report.push({no:'29-'+(j+1),t:'ロックブラスト5回・'+q.t,site:s.seq[j].join('+')+'='+s.seq[j].reduce((x,y)=>x+y,0),exp:exp.join('+')+'='+exp.reduce((x,y)=>x+y,0),how:'照合先（1発ずつ）',pass:JSON.stringify(exp)===JSON.stringify(s.seq[j])})});}
/* ツインビーム（2回）：当たりごとに乱数が別々の分布を、照合先の256通りと比べる（倒せる確率の土台） */
{const c=C.find(x=>x.no===35),s=g(35);const h1=ref(c,s,s.D.hp,null,true);const tot=new Map();
 /* 2発目は1発目のダメージ後のHP（満タンでない）。値はHPの量によらない（マルチスケイルが外れるだけ）ので1つの表で足す */
 const h2=ref(c,s,s.D.hp-h1[0],null,true);for(const x of h1)for(const y of h2)tot.set(x+y,(tot.get(x+y)||0)+1/256);
 ok(s.dist&&[...tot.keys()].length>0&&Math.min(...tot.keys())===s.dist.lo&&Math.max(...tot.keys())===s.dist.hi,'#35 ツインビーム：2発の合計の最小・最大が照合先と同じ',{lo:s.dist&&s.dist.lo,hi:s.dist&&s.dist.hi});}
ok(site.find(x=>x.no==='sl').slHits===5,'スキルリンクは選んだ回数があっても5回（回数の選択が残っていても）',site.find(x=>x.no==='sl'));
ok(!errs.length,'ページのエラーなし',errs);
if(process.env.CALC_CASES_REPORT)require('fs').writeFileSync(process.env.CALC_CASES_REPORT,JSON.stringify(report,null,1));
console.log(`calc-cases: ${bad?'NG':'OK'}（${n}項目・照合先で確かめた場面 ${C.length-unv-rule}・ゲームの決まりで確かめた場面 ${rule}・照合先にない特性の場面 ${unv}）`);
if(bad)process.exit(1);
