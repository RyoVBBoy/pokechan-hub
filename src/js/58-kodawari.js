/* ===================== こだわり条件で組む（2026/11/08 依頼主の要望：物件探しの「こだわり条件」のように） =====================
   #/kodawari。利用者の「こだわり」を条件として選んでもらい、それに合うパーティを6匹＋育成まで組む。
   ・構築のタイプ（1つ）：おまかせ・対面・攻めサイクル・受けサイクル・積み・あめ・はれ・すなあらし・ゆき・トリックルーム・おいかぜ
   ・絶対入れたいポケモン（3匹まで）／入れたくないポケモン
   ・メガシンカ：2匹（使い分け）／1匹／入れない
   ・そのほか：先に動く手段を入れる・物理と特殊を半々に・人気のポケモン中心／読まれにくいポケモン中心
   組み方：絶対入れたい匹から始め、1匹ずつ「構築のタイプに合うか（40-guide-builds.js の ARCHS の役わり）」＋
   「いまの仲間との相性（48-pair.js の prRank）」＋こだわりの点で選ぶ。育成は archSets（型の例）。条件はこの端末に覚える（pckd）。 */
/* 構築のタイプは2段階（2026/11/08 依頼主：大まかな分布→細かい型）。[キー,名前,ARCHS の id か null,ひとこと] */
/* 2026/11/08 依頼主の指摘で整理：おいかぜ・トリルは「積み」ではなく素早さの順番を入れかえる S操作として別の分類。展開にバトン展開。
   害悪から「ちょうはつ・アンコール」を外し、催眠ハメ・受けループ（TOD）・滅び＋逃げられなくする を追加。どこにも入らない尖った型は「コンボ・特殊」 */
const KD_BIG=[['auto','おまかせ'],['taimen','対面'],['cycle','サイクル'],['tenkai','展開（積み）'],['speed','S操作'],['weather','天候'],['field','フィールド'],['stall','害悪'],['combo','コンボ・特殊']];
const KD_SUB={
  auto:[['auto','おまかせ',null,'条件に合わせて、組み合わせのいい6匹を選びます']],
  taimen:[['taimen','スタンダード','taimen','有利な相手にぶつけて、交代せずに押し切る'],['rush','速攻','taimen','こだわりスカーフ・きあいのタスキの速いアタッカーで、先に数を減らす'],['bulkyface','耐久寄り','taimen','硬いアタッカーで殴り合いに勝つ']],
  cycle:[['ofcycle','攻めサイクル','cycle','攻撃しながら交代技で回し、有利な形を作り続ける'],['defcycle','受けサイクル','cycle','硬いポケモンで受けて回復しながら、少しずつ削る'],['pivot','交代技で回す','cycle','とんぼがえり・ボルトチェンジで有利な仲間に回す']],
  tenkai:[['setup','積みエース','setup','場を整えて、能力を上げたエースで一気に倒す'],['screens','壁展開',null,'リフレクター・ひかりのかべを張って、エースを安全に積ませる'],['hazard','設置技で削る',null,'ステルスロックなどをまいて、交代のたびに削る'],['baton','バトン展開',null,'能力を上げてから、バトンタッチで上がった能力ごと仲間に引き継ぐ']],
  speed:[['tailwind','おいかぜ','tailwind','4ターンの間、味方の素早さを2倍にして上から攻める（能力のランクは変わらない）'],['tr','トリックルーム','tr','5ターンの間、遅いポケモンから動けるようにして攻める']],
  weather:[['rain','あめ','rain','あめで素早さと水の技を強くする'],['sun','はれ','sun','はれで素早さと炎の技を強くする'],['sand','すなあらし','sand','すなあらしで削りながら、すなで強くなる仲間で戦う'],['snow','ゆき','snow','ゆきとオーロラベールで守りながら戦う']],
  field:[['eterrain','エレキフィールド',null,'でんきの技を強くし、ねむりを防ぐ'],['gterrain','グラスフィールド',null,'くさの技を強くし、毎ターン少し回復する'],['pterrain','サイコフィールド',null,'エスパーの技を強くし、先制技を防ぐ'],['mterrain','ミストフィールド',null,'状態異常を防ぎ、ドラゴンの技を弱める']],
  stall:[['toxstall','どくまもみがわり',null,'もうどくをあびせて、まもる・みがわりで時間をかせぐ'],['status','状態異常で止める',null,'おにび・でんじは・あくびなどで相手の動きを止める'],['sleep','催眠ハメ',null,'ねむりごな・さいみんじゅつで眠らせて、その間に積む・削る（ふくがんで当てやすく）'],['tod','受けループ（TOD）',null,'回復できる硬いポケモンで受け続け、時間切れや詰みまで粘る'],['perish','滅び・逃がさない',null,'くろいまなざし・とおせんぼうで逃げられなくして、ほろびのうたで倒す']],
  combo:[['moody','ムラっけ',null,'ムラっけで毎ターン能力が上がるのを、まもる・みがわりで待つ'],['revival','さいきのいのり',null,'倒れた仲間をさいきのいのりで復活させて、数で上回る'],['ohko','一撃必殺',null,'じわれ・ぜったいれいど・ハサミギロチン・つのドリルで、当たれば一撃で倒す'],['copy','能力コピー',null,'へんしん・じこあんじなどで、相手の能力の上がり方をそのまま使う']]};
const KD_TYPES=Object.values(KD_SUB).flat();
/* ARCHS にない型の役わり（ARCHS の部品と同じ形：[名前,条件,必須か,先に出す特性,入れる技,技の数]） */
const kdK=(p,ks)=>prKnows(p,ks).length>0;
const KD_PARTS={
  rush:[['速いアタッカー',p=>p.s[5]>=100&&prAtk(p)>=100,true]],
  bulkyface:[['硬いアタッカー',p=>prBulk(p)>=90*90&&prAtk(p)>=100,true]],
  pivot:[['交代技を使う',p=>kdK(p,PR_PIV),true,null,['uturn','voltswitch','flipturn','partingshot'],1]],
  screens:[['壁を張る役',p=>kdK(p,['reflect'])&&kdK(p,['lightscreen'])||kdK(p,['auroraveil']),true,['prankster'],['reflect','lightscreen','auroraveil'],2],['積み技のエース',p=>kdK(p,PR_SETUP)&&prAtk(p)>=100,true]],
  hazard:[['設置技をまく役',p=>kdK(p,['stealthrock','spikes','toxicspikes']),true,null,['stealthrock','spikes'],1],['削れた相手を倒すアタッカー',p=>prAtk(p)>=110,false]],
  eterrain:[['エレキフィールドを作る',p=>(ABD[p.no]||[]).some(a=>a[0]==='electric-surge')||kdK(p,['electricterrain']),true,['electric-surge'],['electricterrain'],1],['でんきの技で攻める',p=>p.t.includes('でんき')&&prAtk(p)>=90,true]],
  gterrain:[['グラスフィールドを作る',p=>(ABD[p.no]||[]).some(a=>a[0]==='grassy-surge')||kdK(p,['grassyterrain']),true,['grassy-surge'],['grassyterrain'],1],['くさの技で攻める',p=>p.t.includes('くさ')&&prAtk(p)>=90,true]],
  pterrain:[['サイコフィールドを作る',p=>(ABD[p.no]||[]).some(a=>a[0]==='psychic-surge')||kdK(p,['psychicterrain']),true,['psychic-surge'],['psychicterrain'],1],['エスパーの技で攻める',p=>p.t.includes('エスパー')&&prAtk(p)>=90,true]],
  mterrain:[['ミストフィールドを作る',p=>(ABD[p.no]||[]).some(a=>a[0]==='misty-surge')||kdK(p,['mistyterrain']),true,['misty-surge'],['mistyterrain'],1],['フェアリーで戦う',p=>p.t.includes('フェアリー'),false]],
  toxstall:[['どくまもで粘る',p=>kdK(p,['toxic'])&&kdK(p,['protect'])&&prBulk(p)>=85*85,true,null,['toxic','protect','substitute'],3]],
  status:[['状態異常をまく',p=>kdK(p,['willowisp','thunderwave','yawn','spore','sleeppowder','toxic','glare']),true,null,['willowisp','thunderwave','yawn','toxic'],1]],
  baton:[['バトンタッチで引き継ぐ役',p=>kdK(p,['batonpass'])&&kdK(p,PR_SETUP),true,null,['batonpass'],1],['受け取るエース',p=>prAtk(p)>=110,true]],
  sleep:[['眠らせる役',p=>kdK(p,['sleeppowder','hypnosis','spore','darkvoid','lovelykiss','sing']),true,['compound-eyes'],['sleeppowder','hypnosis','spore','sing'],1],['眠っている間に積むエース',p=>kdK(p,PR_SETUP)&&prAtk(p)>=100,false]],
  tod:[['回復できる受け役',p=>prBulk(p)>=95*95&&kdHeal(p),true],['どく・やどりぎで削る',p=>kdK(p,['toxic','leechseed'])&&prBulk(p)>=85*85,true,null,['toxic','leechseed'],1]],
  perish:[['ほろびのうたを使う',p=>kdK(p,['perishsong']),true,null,['perishsong','protect'],2],['逃げられなくする',p=>kdK(p,['meanlook','block'])||(ABD[p.no]||[]).some(a=>['shadow-tag','arena-trap'].includes(a[0])),true,['shadow-tag','arena-trap'],['meanlook','block'],1]],
  moody:[['ムラっけ',p=>(ABD[p.no]||[]).some(a=>a[0]==='moody'),true,['moody'],['protect','substitute'],2]],
  revival:[['さいきのいのりを使う',p=>kdK(p,['revivalblessing']),true,null,['revivalblessing'],1]],
  ohko:[['一撃必殺の技を持つ',p=>kdK(p,['fissure','sheercold','guillotine','horndrill']),true,['no-guard'],['fissure','sheercold','guillotine','horndrill'],1]],
  copy:[['相手に変身する役',p=>(ABD[p.no]||[]).some(a=>a[0]==='imposter')||kdK(p,['transform']),true,['imposter'],['transform'],1],['じこあんじで能力の上がり方をうつす',p=>kdK(p,['psychup'])&&prAtk(p)>=100,false,null,['psychup'],1]]};
/* こだわり条件（SUUMO のような2列のチェック）。人気の条件と、すべての条件（分類ごと） */
const KD_OPT=[
  ['人気のこだわり条件',[['resist','弱点を受け合える'],['fast','先に動く手段を入れる'],['heal','回復できる匹を入れる'],['balance','物理と特殊を半々に'],['popular','人気のポケモン中心'],['rare','読まれにくいポケモン中心']]],
  ['素早さ',[['fast','先に動く手段を入れる'],['mid','中速（素早さ100〜130）を入れる'],['scarf','こだわりスカーフ持ちを入れる']]],
  ['攻撃',[['balance','物理と特殊を半々に'],['phys','物理アタッカー中心'],['spec','特殊アタッカー中心']]],
  ['耐久・場',[['heal','回復できる匹を入れる'],['clear','設置技を消せる匹を入れる'],['immune','タイプの攻撃を無効にできる匹を入れる']]],
  ['ポケモンの選び方',[['popular','人気のポケモン中心'],['rare','読まれにくいポケモン中心'],['bst','合計種族値の高いポケモン中心']]]];
const KD_EXCL=[['popular','rare'],['balance','phys'],['balance','spec'],['phys','spec']];
const KD=(()=>{let o=null;try{o=JSON.parse(localStorage.getItem('pckd')||'null')}catch(e){}
  o=o&&typeof o==='object'?o:{};const type=KD_TYPES.some(t=>t[0]===o.type)?o.type:'auto';
  return{type,big:KD_BIG.some(b=>b[0]===o.big)?o.big:(Object.keys(KD_SUB).find(k=>KD_SUB[k].some(s=>s[0]===type))||'auto'),must:Array.isArray(o.must)?o.must.filter(n=>byNo[n]).slice(0,3):[],ng:Array.isArray(o.ng)?o.ng.filter(n=>byNo[n]).slice(0,10):[],
    mega:[0,1,2].includes(o.mega)?o.mega:2,opt:o.opt&&typeof o.opt==='object'?o.opt:{fast:true,resist:true},seed:0,res:null,all:false}})();
const kdSave=()=>{try{localStorage.setItem('pckd',JSON.stringify({type:KD.type,big:KD.big,must:KD.must,ng:KD.ng,mega:KD.mega,opt:KD.opt}))}catch(e){}};
const kdBase=p=>p&&p.base&&byNo[p.base]?byNo[p.base]:p;
const kdStones=p=>Object.keys(MEGA).filter(k=>MEGA[k][p.no]&&byNo[MEGA[k][p.no]]);
const kdPrio=p=>{const l=LSD[p.no];return !!l&&l[1].some(id=>MV[id]&&MV[id][5]>0&&MV[id][2]>0)};
const kdHeal=p=>prKnows(p,['recover','roost','slackoff','milkdrink','morningsun','synthesis','moonlight','softboiled','shoreup','strengthsap']).length>0;
const kdRand=s=>{let x=s||1;return()=>{x=(x*16807)%2147483647;return x/2147483647}};
/* 人気のめやす（使用率の順位、なければ合計種族値の順）：0〜1 */
function kdPop(){const L=(typeof metaOpps==='function'?metaOpps(80):gmOpps().slice(0,80)).map(q=>q.base||q.no);return no=>{const i=L.indexOf(no);return i<0?0:1-i/L.length}}
function kdBuild(){
  const tp=KD_TYPES.find(t=>t[0]===KD.type)||KD_TYPES[0],a=tp[2]?ARCHS.find(x=>x[0]===tp[2]):null;
  /* 細かい型の役わり（KD_PARTS）を先に、ARCHS の役わりも足す */
  const parts=[...(KD_PARTS[KD.type]||[]),...(a?a[7]:[])];
  const ok=(pt,p)=>{try{return pt[1](p)}catch(e){return false}};
  const rnd=kdRand(KD.seed*7919+13),pop=kdPop(),ng=new Set(KD.ng.map(n=>kdBase(byNo[n]).no));
  const mons=[],why={},wantStone={};
  KD.must.forEach(n=>{const q=byNo[n],b=kdBase(q);if(!b||mons.some(m=>m.no===b.no))return;mons.push(b);why[b.no]=['絶対入れたい'];
    if(q.base){const k=Object.keys(MEGA).find(k=>MEGA[k][b.no]===q.no);if(k)wantStone[b.no]=k}});
  const fill=pt=>mons.filter(m=>ok(pt,m)).length;
  const fit=c=>{let v=0;const r=[];
    parts.forEach(pt=>{if(!ok(pt,c))return;const want=pt[2]?(pt[3]?1:2):1;if(fill(pt)<want){v+=pt[2]?(fill(pt)<1?8+3*mons.length:6):3;r.push(pt[0])}else v+=.5});
    if(KD.type==='ofcycle'){if(prKnows(c,PR_PIV).length){v+=3;r.push('交代技で回せる')}if(prAtk(c)>=100)v+=1.5}
    if(KD.type==='defcycle'){if(prBulk(c)>=95*95){v+=3;r.push('硬く受けられる')}if(kdHeal(c)||(ABD[c.no]||[]).some(x=>x[0]==='regenerator')){v+=2.5;r.push('回復できる')}if(prAtk(c)>=125&&prBulk(c)<80*80)v-=1.5}
    if(KD.type==='taimen'||KD.type==='rush'||KD.type==='bulkyface'){if(prAtk(c)>=110){v+=2;r.push('攻撃が高い')}if(c.s[5]>=100)v+=KD.type==='rush'?2:1}
    if(KD.type==='bulkyface'){if(prBulk(c)>=90*90){v+=2.5;r.push('硬い')}else if(prBulk(c)<80*80)v-=3}
    if(KD.type==='rush'){if(c.s[5]>=100){v+=1.5;r.push('素早い')}else if(c.s[5]<80)v-=2.5}
    if(KD.type==='pivot'&&prKnows(c,PR_PIV).length){v+=2;r.push('交代技で回せる')}
    if(KD.type==='tod'&&kdHeal(c)&&prBulk(c)>=90*90){v+=2;r.push('回復しながら受けられる')}
    if(KD.big==='stall'){if(prBulk(c)>=90*90)v+=2;if(prAtk(c)>=120&&prBulk(c)<80*80)v-=2}
    if(KD.opt.mid&&!mons.some(m=>m.s[5]>=100&&m.s[5]<=130)&&c.s[5]>=100&&c.s[5]<=130){v+=1.5;r.push('中速')}
    if(KD.opt.scarf&&!mons.some(m=>m.s[5]>=90&&prAtk(m)>=110)&&c.s[5]>=90&&prAtk(c)>=110){v+=1.5;r.push('スカーフで活きる')}
    if(KD.opt.phys){v+=prPhys(c)?1.5:-1}if(KD.opt.spec){v+=prPhys(c)?-1:1.5}
    if(KD.opt.heal&&!mons.some(m=>kdHeal(m))&&kdHeal(c)){v+=1.5;r.push('回復できる')}
    if(KD.opt.clear&&!mons.some(m=>kdK(m,LS_CLEAR))&&kdK(c,LS_CLEAR)){v+=2;r.push('設置技を消せる')}
    if(KD.opt.immune&&!mons.some(m=>monDef(m).some(z=>z.m===0))&&monDef(c).some(z=>z.m===0)){v+=1;r.push(monDef(c).filter(z=>z.m===0).map(z=>z.t).join('・')+'を無効')}
    if(KD.opt.bst)v+=(c.bst-520)/40;
    if(KD.type==='setup'&&prKnows(c,PR_SETUP).length&&prAtk(c)>=100){v+=2;r.push('積み技のエース')}
    /* 弱点の重なり：仲間の2匹以上が弱いタイプに、さらに弱い匹は大きく減点。受けられる匹は加点 */
    const cd=monDef(c);let wk=0,rs=0;T.forEach(t=>{const n=mons.filter(m=>monDef(m).find(z=>z.t===t).m>=2).length,m=cd.find(z=>z.t===t).m;if(n>=2&&m>=2)wk++;if(n>=2&&m<=.5)rs++});
    if(KD.opt.resist!==false){v+=-3*wk+1.2*rs;if(rs)r.push('仲間の弱点を受けられる')}
    if(KD.type==='tr'){if(c.s[5]<=60){v+=2.5;r.push('遅いのでトリックルームで先に動ける')}else if(c.s[5]>=95)v-=4}
    if(KD.type==='tailwind'&&c.s[5]>=60&&c.s[5]<=100)v+=1;
    const p=pop(c.no);if(KD.opt.popular){v+=3*p}if(KD.opt.rare){v+=p>.5?-2.5*p:1}
    if(KD.opt.fast&&KD.type!=='tr'&&!mons.some(m=>m.s[5]>=110||kdPrio(m))&&(c.s[5]>=110||kdPrio(c))){v+=2;r.push(c.s[5]>=110?'素早い':'先制技を覚える')}
    if(KD.opt.balance){const ph=mons.filter(prPhys).length,sp=mons.length-ph;if(ph!==sp&&prPhys(c)===(ph<sp)){v+=1.5;r.push(prPhys(c)?'物理で半々に':'特殊で半々に')}}
    const st=mons.filter(m=>kdStones(m).length).length;if(KD.mega&&st<KD.mega&&kdStones(c).length){v+=2;r.push('メガシンカできる')}
    return{v,r}};
  while(mons.length<6){
    let rank=[];try{rank=mons.length?prRank(mons):P.filter(c=>!c.base).map(c=>({c,score:(c.bst-500)/60,R:[]}))}catch(e){rank=P.map(c=>({c,score:0,R:[]}))}
    const have=new Set(mons.map(m=>m.no));
    /* 相性の上位90匹に加えて、型に必ず要る役わりをまだ満たしていないなら、その役わりの匹は順位に関係なく候補に入れる（さいきのいのりのパーモットなど） */
    const need=parts.filter(pt=>pt[2]&&fill(pt)<1),okR=rank.filter(o=>o.c&&!o.c.base&&!have.has(o.c.no)&&!ng.has(o.c.no));
    const pool=[...okR.slice(0,90),...okR.slice(90).filter(o=>need.some(pt=>ok(pt,o.c)))];
    /* 残りの枠が、まだ満たしていない必ず要る役わりの数と同じになったら、その役わりの匹からしか選ばない（相性の点が積み上がって後回しになるのを防ぐ） */
    const must0=need.length>=6-mons.length?pool.filter(o=>need.some(pt=>ok(pt,o.c))):[];
    const cand=(must0.length?must0:pool).map(o=>{const f=fit(o.c);return{o,f,sc:o.score*.45+f.v+rnd()*(KD.seed?2.2:.01)}}).sort((x,y)=>y.sc-x.sc);
    const best=cand[0];if(!best)break;
    mons.push(best.o.c);why[best.o.c.no]=[...best.f.r.slice(0,2),...(best.o.R||[]).filter(r=>r.pts>0).sort((x,y)=>y.pts-x.pts).slice(0,1).map(r=>r.txt)];
  }
  /* 育成：構築のタイプの役わり（天気・トリル・おいかぜの技）を入れる */
  const aa=a||[KD.type==='defcycle'?'cycle':KD.type];mons.part={};
  mons.forEach(m=>{const pt=parts.find(pt=>pt[4]&&ok(pt,m));if(pt)mons.part[m.no]=pt});
  let ss=[];try{ss=archSets(aa,mons)}catch(e){ss=mons.map(()=>null)}
  /* メガシンカの数を、こだわりに合わせる（絶対入れたいメガの姿は必ずそのメガストーン） */
  const alt=used=>['lifeorb','expertbelt','sitrusberry','leftovers','focussash','lumberry','rockyhelmet','choicescarf'].find(k=>!used.has(k));
  const used=new Set(ss.map(s=>s&&s.item).filter(Boolean));
  const forced=mons.map((m,i)=>wantStone[m.no]?i:-1).filter(i=>i>=0);
  forced.forEach(i=>{if(ss[i]){used.delete(ss[i].item);ss[i]={...ss[i],item:wantStone[mons[i].no]};used.add(ss[i].item)}});
  const keep=new Set(forced);
  const pick=megaPick(mons,mons.map((_,i)=>keep.has(i)),Math.max(0,KD.mega-forced.length));
  pick.forEach(({i})=>keep.add(i));
  ss.forEach((s,i)=>{if(!s)return;if(keep.has(i)&&!isStone(s.item)){const k=(pick.find(x=>x.i===i)||{}).k;if(k){used.delete(s.item);ss[i]={...s,item:k};used.add(k)}}
    else if(!keep.has(i)&&isStone(s.item)){used.delete(s.item);const k=alt(used);ss[i]={...s,item:k||null};if(k)used.add(k)}});
  if(KD.opt.scarf&&!ss.some(s=>s&&s.item==='choicescarf')){const i=mons.map((m,i)=>({m,i})).filter(x=>ss[x.i]&&!isStone(ss[x.i].item)&&prAtk(x.m)>=100).sort((x,y)=>y.m.s[5]-x.m.s[5])[0];
    if(i){const o=ss.findIndex(s=>s&&s.item==='choicescarf');ss[i.i]={...ss[i.i],item:'choicescarf'}}}
  /* 条件の確かめ */
  const st=ss.filter(s=>s&&isStone(s.item)).length;
  /* 3匹以上が同じ弱点で、そのタイプを半減以下で受けられる仲間がいないときだけ△ */
  const weak=T.map(t=>mons.some(m=>monDef(m).find(z=>z.t===t).m<=.5)?0:mons.filter(m=>monDef(m).find(z=>z.t===t).m>=2).length),maxW=Math.max(...weak),wt=T[weak.indexOf(maxW)];
  const checks=[
    [tp[1]+(tp[0]==='auto'?'':'構築'),parts.filter(pt=>pt[2]).every(pt=>fill(pt)>=1)],
    [`メガシンカ ${KD.mega?KD.mega+'匹':'なし'}`,st===KD.mega],
    ...(KD.must.length?[['絶対入れたいポケモン',KD.must.every(n=>mons.some(m=>m.no===kdBase(byNo[n]).no))]]:[]),
    ...(KD.opt.fast&&KD.type!=='tr'?[['先に動く手段',mons.some(m=>m.s[5]>=110||kdPrio(m))]]:[]),
    ...(KD.opt.balance?[['物理と特殊が半々',Math.abs(mons.filter(prPhys).length*2-mons.length)<=2]]:[]),
    ...(KD.opt.heal?[['回復できる匹',mons.some(kdHeal)]]:[]),
    ...(KD.opt.clear?[['設置技を消せる匹',mons.some(m=>kdK(m,LS_CLEAR))]]:[]),
    ...(KD.opt.scarf?[['こだわりスカーフ持ち',ss.some(s=>s&&s.item==='choicescarf')]]:[]),
    ...(KD.opt.mid?[['中速',mons.some(m=>m.s[5]>=100&&m.s[5]<=130)]]:[]),
    ...(KD.opt.resist!==false?[[maxW>=3?`${wt}が弱点の匹が${maxW}匹（受けられる仲間なし）`:'弱点を受け合える',maxW<3]]:[])];
  return{mons,ss,why,checks,type:tp};
}
/* 条件に合いそうなポケモンの数（帯に出す）：入れたくない匹を除き、選んだ型の役わりのどれかに当てはまる匹 */
/* 組み合わせが何通りあるか（2026/11/08 依頼主：「匹」より「パーティが何通り」の方が正確）。
   候補＝入れたくない匹と絶対入れたい匹を除いたポケモン。残りの枠に入れる組み合わせのうち、型に必ず要る役わり（まだ絶対入れたい匹で満たしていないもの）を
   1匹ずつは含むもの（包除原理で数える）。素早さ・持ち物などのこだわりは、組むときの点で寄せるので数には入れない */
function kdCombos(){
  const tp=KD_TYPES.find(t=>t[0]===KD.type),a=tp&&tp[2]?ARCHS.find(x=>x[0]===tp[2]):null,parts=[...(KD_PARTS[KD.type]||[]),...(a?a[7]:[])];
  const ok=(pt,p)=>{try{return pt[1](p)}catch(e){return false}};
  const must=KD.must.map(n=>kdBase(byNo[n])).filter(Boolean),mb=new Set(must.map(m=>m.no)),ng=new Set(KD.ng.map(n=>kdBase(byNo[n]).no));
  const pool=P.filter(p=>!p.base&&!ng.has(p.no)&&!mb.has(p.no)),k=6-must.length;
  const req=parts.filter(pt=>pt[2]&&!must.some(m=>ok(pt,m))).map(pt=>new Set(pool.filter(p=>ok(pt,p)).map(p=>p.no)));
  const C=(n,r)=>{if(r<0||n<r)return 0;let x=1;for(let i=0;i<r;i++)x=x*(n-i)/(i+1);return x};
  let tot=0;const R=req.slice(0,5);
  for(let m=0;m<(1<<R.length);m++){const u=new Set();let bits=0;R.forEach((s,i)=>{if(m>>i&1){bits++;s.forEach(x=>u.add(x))}});tot+=(bits%2?-1:1)*C(pool.length-u.size,k)}
  return Math.max(0,Math.round(tot));
}
const kdNum=x=>x>=1e12?`約${(x/1e12).toFixed(x<1e13?1:0)}兆`:x>=1e8?`約${(x/1e8).toFixed(x<1e9?1:0)}億`:x>=1e4?`約${Math.round(x/1e4).toLocaleString()}万`:x.toLocaleString();
function kdCount(){const ng=new Set(KD.ng.map(n=>kdBase(byNo[n]).no));const tp=KD_TYPES.find(t=>t[0]===KD.type),a=tp&&tp[2]?ARCHS.find(x=>x[0]===tp[2]):null,parts=[...(KD_PARTS[KD.type]||[]),...(a?a[7]:[])];
  return P.filter(p=>!p.base&&!ng.has(p.no)&&(!parts.length||parts.some(pt=>{try{return pt[1](p)}catch(e){return false}}))).length}
function kodawariView(){
  setHeader('こだわり条件で組む','#/tools');
  const cb=(on,attr,label)=>`<button class="kd-cb" ${attr} aria-pressed="${on}"><i>${on?'✓':''}</i><span>${label}</span></button>`;
  const chips=(list,key)=>list.map((n,i)=>`<span class="kd-chip"><span class="av" style="width:24px;height:24px">${stamp(byNo[n])}</span>${esc(formInfo(byNo[n]).base)}${formInfo(byNo[n]).tag?`<small>${esc(formInfo(byNo[n]).tag)}</small>`:''}<button data-kd-rm="${key}:${i}" aria-label="外す">×</button></span>`).join('');
  const subs=KD_SUB[KD.big]||KD_SUB.auto,cur0=KD_TYPES.find(t=>t[0]===KD.type)||KD_TYPES[0];
  const optSec=([h,list])=>`<div class="kd-sh">${h}</div><div class="kd-grid">${list.map(([k,l])=>cb(k==='resist'?KD.opt.resist!==false:!!KD.opt[k],`data-kd-opt="${k}"`,l)).join('')}</div>`;
  const R=KD.res;
  V.innerHTML=`<p class="note">家さがしの「こだわり条件」のように、ゆずれない条件にチェックを入れてください。ポケモンを1匹も決めていなくても組めます。</p>
  <div class="kd-card">
    <div class="kd-sh">構築のタイプ</div>
    <div class="kd-grid">${KD_BIG.map(([k,l])=>cb(KD.big===k,`data-kd-big="${k}"`,l)).join('')}</div>
    ${KD.big!=='auto'?`<div class="kd-sh kd-sh2">${esc((KD_BIG.find(b=>b[0]===KD.big)||[])[1])}の中で</div><div class="kd-grid">${subs.map(s=>cb(KD.type===s[0],`data-kd-type="${s[0]}"`,s[1])).join('')}</div>`:''}
    <p class="kd-d">${esc(cur0[3])}</p>
  </div>
  <div class="kd-card">
    <div class="kd-sh">メガシンカ</div>
    <div class="kd-grid">${[[2,'2匹（相手で使い分け）'],[1,'1匹'],[0,'入れない']].map(([v,l])=>cb(KD.mega===v,`data-kd-mega="${v}"`,l)).join('')}</div>
  </div>
  <div class="kd-card">${optSec(KD_OPT[0])}
    <button class="kd-all" id="kd-all" aria-expanded="${KD.all}"><b>すべてのこだわり条件</b><span>${KD.all?'︿':'﹀'}</span></button>
    ${KD.all?KD_OPT.slice(1).map(optSec).join(''):''}
  </div>
  <div class="kd-card">
    <div class="kd-sh">絶対入れたいポケモン<span>任意・3匹まで</span></div>
    <div class="kd-chips">${chips(KD.must,'must')}${KD.must.length<3?`<button class="kd-add" id="kd-must">${SVG(I.plus,16)}選ぶ</button>`:''}</div>
    <div class="kd-sh kd-sh2">入れたくないポケモン<span>任意</span></div>
    <div class="kd-chips">${chips(KD.ng,'ng')}${KD.ng.length<10?`<button class="kd-add" id="kd-ng">${SVG(I.plus,16)}選ぶ</button>`:''}</div>
  </div>
  <div class="kd-bar"><div class="kd-cnt">組み合わせ<b class="num">${kdNum(kdCombos())}</b>通り</div><button class="btn btn-p" id="kd-go">選択した条件で組む</button></div>
  <div id="kd-res">${R?kdResHTML(R):''}</div>`;
  const re=()=>{kdSave();KD.res=null;const y=scrY();kodawariView();scrTo(0,y)};
  V.querySelectorAll('[data-kd-big]').forEach(b=>b.onclick=()=>{KD.big=b.dataset.kdBig;KD.type=(KD_SUB[KD.big]||KD_SUB.auto)[0][0];re()});
  V.querySelectorAll('[data-kd-type]').forEach(b=>b.onclick=()=>{KD.type=b.dataset.kdType;re()});
  V.querySelectorAll('[data-kd-mega]').forEach(b=>b.onclick=()=>{KD.mega=+b.dataset.kdMega;re()});
  V.querySelectorAll('[data-kd-opt]').forEach(b=>b.onclick=()=>{const k=b.dataset.kdOpt;
    if(k==='resist'){KD.opt.resist=KD.opt.resist===false}else{KD.opt[k]=!KD.opt[k];if(KD.opt[k])KD_EXCL.forEach(([x,y])=>{if(k===x)KD.opt[y]=false;if(k===y)KD.opt[x]=false})}re()});
  V.querySelectorAll('[data-kd-rm]').forEach(b=>b.onclick=()=>{const [k,i]=b.dataset.kdRm.split(':');KD[k].splice(+i,1);re()});
  document.getElementById('kd-all').onclick=()=>{KD.all=!KD.all;const y=scrY();kodawariView();scrTo(0,y)};
  const addTo=async k=>{const no=await pickMon(0);if(!no)return;if(KD[k].includes(no))return;
    const other=k==='must'?'ng':'must';KD[other]=KD[other].filter(n=>kdBase(byNo[n]).no!==kdBase(byNo[no]).no);
    if(k==='must'&&KD.must.some(n=>kdBase(byNo[n]).no===kdBase(byNo[no]).no)){toast('同じポケモンはもう入っています');return}
    KD[k].push(no);re()};
  const bm=document.getElementById('kd-must');if(bm)bm.onclick=()=>addTo('must');
  const bn=document.getElementById('kd-ng');if(bn)bn.onclick=()=>addTo('ng');
  document.getElementById('kd-go').onclick=()=>kdRun(0);
  kdResBind();
}
function kdRun(seed){
  const box=document.getElementById('kd-res');if(box)box.innerHTML='<p class="empty">組んでいます…</p>';
  setTimeout(()=>{KD.seed=seed;try{KD.res=kdBuild()}catch(e){KD.res=null;toast('組めませんでした。条件を少しゆるめてください')}
    const b=document.getElementById('kd-res');if(!b)return;b.innerHTML=KD.res?kdResHTML(KD.res):'';kdResBind();if(KD.res)b.scrollIntoView({behavior:'smooth',block:'start'})},30);
}
function kdResHTML(R){
  return `<div class="sec"><h2>あなたのこだわりで組んだパーティ</h2></div>
  <div class="kd-checks">${R.checks.map(([t,ok])=>`<span class="kd-ck ${ok?'ok':'ng'}">${ok?'✓':'△'} ${esc(t)}</span>`).join('')}</div>
  <div class="kd-team">${R.mons.map((m,i)=>{const s=R.ss[i];return `<a class="kd-mon" href="#/p/${m.no}"><span class="av">${stamp(m)}</span>
    <div class="kd-mi"><b>${esc(formInfo(m).base)}</b><div class="kd-ty">${m.t.map(chip).join('')}</div>
    ${s?`<div class="kd-set">${esc([s.item&&ITEMN[s.item],s.moves.slice(0,4).map(id=>mName(id)).join('・')].filter(Boolean).join(' ／ '))}</div>`:''}
    ${(R.why[m.no]||[]).length?`<div class="kd-why">${R.why[m.no].map(t=>`<span>${esc(t)}</span>`).join('')}</div>`:''}</div></a>`}).join('')}</div>
  <div class="btns" style="padding:10px 16px 4px;flex-wrap:wrap"><button class="btn btn-p" id="kd-use">このパーティを使う</button><button class="btn btn-s" id="kd-again">別の案を見る</button></div>
  <p class="note">育成は計算で組んだ型の例です（実際によく使われる型とは違うことがあります）。「このパーティを使う」でパーティの空いている枠に入り、あとから自由に変えられます。</p>`;
}
function kdResBind(){
  const R=KD.res;const u=document.getElementById('kd-use');if(!u||!R)return;
  u.onclick=()=>useTeam(`${R.type[1]}${R.type[0]==='auto'?'':'構築'}`,R.mons.map((m,i)=>({no:m.no,set:toSaved(R.ss[i])})));
  document.getElementById('kd-again').onclick=()=>kdRun((KD.seed||0)+1);
}
