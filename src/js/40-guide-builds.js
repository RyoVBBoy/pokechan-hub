/* ===================== 攻略ガイド：構築の型（当サイトのオリジナルの文章） =====================
   パーティの組み方の代表的な考え方（天気・トリックルーム・おいかぜ・対面・サイクル・積み）を当サイトの言葉で説明し、
   その型の中心になるポケモンは、特性・覚える技・種族値のデータから選ぶ（記事は使わない）。
   #/learn/build（一覧）・#/arch/ID（くわしい画面：いまのパーティがその型にどれだけ合うかも出す）。 */
const bAb=p=>(ABD[p.no]||[]).map(a=>a[0]);
const bHas=(p,keys)=>!!LSD[p.no]&&LSD[p.no][1].some(id=>MD[id]&&keys.includes(MD[id][3]));
const bOff=p=>Math.max(p.s[1],p.s[3]);
const bBulk=p=>p.s[0]+p.s[2]+p.s[4];
const bAbIs=(p,keys)=>bAb(p).some(k=>keys.includes(k));
/* 型：[ID, 名前, ひとこと, 形式, 考え方, [組み方…], [弱点と対策…], [[パーツ名, 条件, 必須か, 先に出す特性, 型の例で入れる技, 入れる数]…], 使う技のキー, 関係する用語] */
const ARCHS=[
 ['rain','あめパーティ','あめで素早さと水の技を強くする','シングル・ダブル',
  'あめの間は、みずタイプの技の威力が1.5倍、ほのおタイプの技は半分になる。特性すいすいのポケモンは素早さが2倍になるので、ふだんは追い抜けない相手にも先に攻撃できる。かみなり・ぼうふうは、あめの間は必ず当たる。天気を作る役と、あめで強くなる役を組み合わせ、あめが続く5ターンの間に一気に押し切るのが基本の流れ。',
  ['特性あめふらしのポケモン（いなければ技の「あまごい」）で天気を作る','すいすいのアタッカーを2匹ほど入れて、あめの間に先手で攻撃する','みずタイプの技に加えて、かみなり・ぼうふうなど、あめで当たりやすくなる技を持たせる','あめが切れたあとに戦える控えも1匹入れておく'],
  ['相手が別の天気を作ると、あめが上書きされる（後から出した天気が残る）','くさタイプ・でんきタイプのように、みずの技を受けやすい相手が苦手','トリックルームを使われると、すいすいで速くした意味がなくなる','天気を作る役が先に倒されると、立て直しにくい'],
  [['あめを作る',p=>bAbIs(p,['drizzle'])||bHas(p,['raindance']),1,['drizzle'],['raindance']],['あめで速くなる',p=>bAbIs(p,['swift-swim']),1],['みずの技で攻める',p=>p.t.includes('みず')&&bOff(p)>=95,0],['あめで回復・強くなる',p=>bAbIs(p,['rain-dish','dry-skin','hydration']),0]],
  ['raindance','thunder','hurricane','weatherball','hydropump','surf'],['weather']],
 ['sun','はれパーティ','はれで素早さと炎の技を強くする','シングル・ダブル',
  'はれの間は、ほのおタイプの技の威力が1.5倍、みずタイプの技は半分になる。特性ようりょくそのポケモンは素早さが2倍になり、ソーラービームはためずにすぐ撃てる。くさタイプのアタッカーは、弱点のほのおを味方の天気で持っておくことにもなる。天気を作る役と、はれで強くなる役をそろえて短い時間で勝負を決める。',
  ['特性ひでりのポケモン（いなければ技の「にほんばれ」）で天気を作る','ようりょくそのアタッカーで、はれの間に先手をとる','ほのおタイプの技や、ためずに撃てるソーラービーム・ウェザーボールを持たせる','はれで弱くなるみずの技を受けられるので、相手のみずタイプを読んで出す'],
  ['相手が別の天気を作ると、はれが上書きされる','いわタイプの技（ほのお・くさ・ひこうに効く）が通りやすい','みずタイプの技を使う相手でも、天気が変わると一気に不利になる','トリックルームで速さの利点を消される'],
  [['はれを作る',p=>bAbIs(p,['drought'])||bHas(p,['sunnyday']),1,['drought'],['sunnyday']],['はれで速くなる',p=>bAbIs(p,['chlorophyll']),1],['ほのおの技で攻める',p=>p.t.includes('ほのお')&&bOff(p)>=95,0],['はれで強くなる特性',p=>bAbIs(p,['solar-power','flower-gift','leaf-guard']),0]],
  ['sunnyday','solarbeam','solarblade','weatherball','heatwave','growth'],['weather']],
 ['sand','すなあらしパーティ','すなあらしで岩タイプを固くし、相手を少しずつ削る','シングル・ダブル',
  'すなあらしの間は、いわ・じめん・はがねタイプ以外のポケモンが毎ターン少しずつダメージを受ける。いわタイプは特防が1.5倍になり、特殊技に強くなる。特性すなかきのポケモンは素早さが2倍、すなのちからはいわ・じめん・はがねの技が強くなる。きあいのタスキやがんじょうを、すなのダメージでつぶせるのも特徴。',
  ['特性すなおこしのポケモンで天気を作る','すなかき・すなのちからのアタッカーを入れる','いわ・じめん・はがねタイプを中心にして、すなのダメージを受けないようにする','いわタイプの特防が上がることを活かし、特殊アタッカーの相手を任せる'],
  ['相手が別の天気を作ると、すなあらしが上書きされる','みず・くさ・かくとう・じめんの技が、いわ・じめん・はがねの多いパーティに通りやすい','味方も、いわ・じめん・はがね以外は毎ターン削られる'],
  [['すなあらしを作る',p=>bAbIs(p,['sand-stream','sand-spit'])||bHas(p,['sandstorm']),1,['sand-stream','sand-spit'],['sandstorm']],['すなで速く・強くなる',p=>bAbIs(p,['sand-rush','sand-force']),1],['いわタイプ（特防が上がる）',p=>p.t.includes('いわ'),0],['すなのダメージを受けない',p=>p.t.some(t=>['いわ','じめん','はがね'].includes(t))||bAbIs(p,['overcoat','sand-veil','magic-guard']),0]],
  ['sandstorm','stoneedge','rockslide','earthquake','highhorsepower'],['weather']],
 ['snow','ゆきパーティ','ゆきで氷タイプを固くし、オーロラベールを張る','シングル・ダブル',
  'ゆきの間は、こおりタイプの防御が1.5倍になり、物理技に強くなる。ふぶきは必ず当たり、オーロラベールは物理・特殊の両方のダメージを減らせる（ゆきのときだけ使える）。特性ゆきかきのポケモンは素早さが2倍になる。オーロラベールで味方を守りながら攻める組み方が中心。',
  ['特性ゆきふらしのポケモン（いなければ技の「ゆきげしき」）で天気を作る','オーロラベールを張れるポケモンで、味方が受けるダメージを減らす','ゆきかきのアタッカーや、ふぶきを使う特殊アタッカーで攻める'],
  ['こおりタイプは弱点が多く、ほのお・かくとう・いわ・はがねの技を受けやすい','相手が別の天気を作ると、ゆきが上書きされる','ちょうはつでオーロラベールを止められる'],
  [['ゆきを作る',p=>bAbIs(p,['snow-warning'])||bHas(p,['snowscape','hail']),1,['snow-warning'],['snowscape']],['オーロラベール',p=>bHas(p,['auroraveil']),1,null,['auroraveil']],['ゆきで速くなる',p=>bAbIs(p,['slush-rush']),0],['こおりタイプで攻める',p=>p.t.includes('こおり')&&bOff(p)>=95,0]],
  ['snowscape','auroraveil','blizzard','iciclecrash','freezedry'],['weather','kabe']],
 ['tr','トリックルームパーティ','遅くて強いポケモンが先に動く','シングル・ダブル',
  'トリックルームを使うと、5ターンの間、素早さの遅いポケモンから先に動くようになる。素早さが低いかわりに攻撃・耐久が高いポケモンを集めると、トリックルームの間は相手より先に大きなダメージを与えられる。トリックルームを使う役が、確実に技を出せるようにするのが一番大事。',
  ['トリックルームを使える、耐久の高いポケモンを1〜2匹入れる（ダブルでは、ねこだまし・このゆびとまれで守ると安定する）','素早さが低く、攻撃か特攻が高いアタッカーを集める','アタッカーの性格は素早さが下がるものにして、素早さに能力ポイントを振らない','トリックルームが切れたあとに備え、もう一度張れる役か、速さに関係なく戦える役を残す'],
  ['ちょうはつでトリックルームを止められる','まもるや交代で5ターンを稼がれる','先にトリックルームを使う役を倒される','相手もトリックルームを使うと、元に戻ってしまう'],
  [['トリックルームを使う',p=>bHas(p,['trickroom']),1,null,['trickroom']],['遅くて強いアタッカー',p=>p.s[5]<=60&&bOff(p)>=105,1],['耐久が高い',p=>bBulk(p)>=300,0]],
  ['trickroom','protect','fakeout','followme','ragepowder'],['tr','speedctl']],
 ['tailwind','おいかぜパーティ','味方全員を速くして、先手で押し切る','ダブル中心',
  'おいかぜを使うと、4ターンの間、味方全員の素早さが2倍になる。中くらいの速さのアタッカーでも相手の速いポケモンを追い抜けるので、2匹で1匹ずつ倒していける。トリックルームと違い、相手が何もしなくても効果が続く時間は短いので、使ったらすぐに攻める。',
  ['おいかぜを使えるポケモンを1〜2匹入れる（特性いたずらごころなら先に使える）','素早さが中くらい（70〜100ほど）で、攻撃か特攻の高いアタッカーを集める','全体技（相手2匹に当たる技）を持たせて、おいかぜの間に一気に削る'],
  ['トリックルームを使われると、おいかぜで速くしたことが逆効果になる','おいかぜを使う役を先に倒される・ちょうはつされる','相手もおいかぜを使うと、速さの差がなくなる'],
  [['おいかぜを使う',p=>bHas(p,['tailwind']),1,['prankster'],['tailwind']],['速くなると強いアタッカー',p=>p.s[5]>=60&&p.s[5]<=105&&bOff(p)>=105,1],['いたずらごころ',p=>bAbIs(p,['prankster']),0]],
  ['tailwind','protect','heatwave','rockslide','dazzlinggleam','hypervoice'],['speedctl','double']],
 ['taimen','対面パーティ','1対1で勝ち続ける','シングル中心',
  '交代をあまりせず、場に出たポケモン同士の1対1を有利に進めて勝つ組み方。素早さと火力の高いアタッカーを中心に、きあいのタスキで1回は必ず行動する、こだわりスカーフで先に動く、などで「倒される前に倒す」回数を増やす。考えることが少なく、初めての人にも組みやすい。',
  ['素早さと攻撃（特攻）の高いアタッカーを中心にする','きあいのタスキ・こだわりスカーフ・いのちのたまなど、1回の行動を強くする持ち物を分けて持たせる','先制技を持つポケモンを入れて、削れた速い相手にとどめを刺せるようにする','タイプが重ならないようにして、1匹に全員が止められないようにする'],
  ['耐久の高いポケモンに、交代で受けられ続けると崩しにくい','先制技や、きあいのタスキをつぶす連続技に弱い','積み技を許すと、1匹に全員倒されることがある'],
  [['速くて強いアタッカー',p=>p.s[5]>=95&&bOff(p)>=100,1],['先制技',p=>!!LSD[p.no]&&LSD[p.no][1].some(id=>{const i=mvInfo(id);return i&&i.pri>0&&i.pow>0&&MD[id]&&MD[id][3]!=='fakeout'}),0],['きあいのタスキを活かせる（耐久が低め）',p=>bBulk(p)<240&&bOff(p)>=100,0]],
  ['closecombat','uturn','suckerpunch','extremespeed','swordsdance'],['taimen','sensei']],
 ['cycle','サイクルパーティ','交代を繰り返して少しずつ有利にする','シングル中心',
  '不利な相手が出てきたら、その技を受けられる味方に交代し、相手が交代し返したらまた有利な味方に交代する。この交代の繰り返し（サイクル）の中で、設置技や状態異常、交代しながら攻撃する技で少しずつ相手を削る。お互いの弱点を受け合えるポケモンを組み合わせるのが基本。',
  ['お互いの弱点を半減以下で受け合える2〜3匹を組み合わせる（タイプ相性の画面で確かめられる）','さいせいりょく・回復技で、何度も場に出られるようにする','とんぼがえり・ボルトチェンジなど、攻撃しながら交代できる技を入れる','ステルスロックなどの設置技で、相手が交代するたびに削る'],
  ['積み技を使う相手に、交代している間に能力を上げられる','かたやぶりや高い火力で、受ける役ごと倒される','どくどく・設置技を重ねられると、交代するたびに削られる'],
  [['耐久が高い',p=>bBulk(p)>=290,1],['回復できる',p=>bBulk(p)>=250&&(bHas(p,GM_HEAL)||bAbIs(p,['regenerator'])),1,null,GM_HEAL],['攻撃しながら交代',p=>bHas(p,GM_PIV),0,null,GM_PIV],['設置技',p=>bHas(p,['stealthrock','spikes','toxicspikes']),0,null,['stealthrock','spikes','toxicspikes']]],
  ['uturn','voltswitch','stealthrock','recover','roost','toxic','willowisp'],['cycle','ukedashi']],
 ['setup','積みエースパーティ','味方が作った安全なターンで能力を上げる','シングル中心',
  '壁・ステルスロック・まひなどで味方が戦いやすい状況を作り（起点作り）、後ろから出てくるエースが積み技で能力を上げて、相手を次々に倒す組み方。エースが積めれば1匹で試合が決まることもある。起点作り役は倒れてもよいので、仕事をしてから倒れるように動く。',
  ['壁・ステルスロック・ちょうはつなどを使える起点作り役を1匹入れる（きあいのタスキで確実に動けるとよい）','りゅうのまい・つるぎのまい・わるだくみなどを覚えるエースを1〜2匹入れる','エースには、積んだあと止められにくいタイプの組み合わせの技を持たせる'],
  ['ほえる・ふきとばし・くろいきりで、積んだ能力を元に戻される','てんねん（能力の変化を無視する）のポケモンに受けられる','先制技や、ちょうはつ・アンコールで積む前に止められる'],
  [['積み技のエース',p=>bOff(p)>=100&&bHas(p,[...GM_PSET,...GM_SSET,...GM_BSET]),1],['起点作り',p=>bHas(p,['reflect','lightscreen','stealthrock','spikes','taunt','thunderwave','yawn','memento']),1,null,['reflect','lightscreen','stealthrock','taunt','thunderwave','yawn'],2]],
  ['swordsdance','dragondance','nastyplot','calmmind','reflect','lightscreen','stealthrock','taunt'],['tsumi','kiten']]
];
const archOf=id=>ARCHS.find(a=>a[0]===id);
/* その型のパーツに当てはまるポケモン（パーツの4つ目に書いた特性を持つものを先に、あとは合計種族値の高い順） */
const archMons=(part,n=8)=>{const top=p=>part[3]&&bAbIs(p,part[3])?1:0;return P.filter(p=>{try{return part[1](p)}catch(e){return false}}).sort((a,b)=>top(b)-top(a)||b.bst-a.bst).slice(0,n)};
/* いまのパーティがどれだけその型に合うか（必須のパーツは2倍で数える） */
function archFit(a,mons){
  const parts=a[7].map(pt=>({name:pt[0],need:!!pt[2],ab:pt[3],who:mons.filter(p=>{try{return pt[1](p)}catch(e){return false}})}));
  const tot=parts.reduce((s,x)=>s+(x.need?2:1),0),got=parts.reduce((s,x)=>s+(x.who.length?(x.need?2:1):0),0);
  return{parts,score:tot?got/tot:0,ok:parts.filter(x=>x.need).every(x=>x.who.length)};
}
/* 型からパーティの例を6匹組む：必須の役→あるとよい役の順に選び、残りは弱点が重なったタイプを受けられるポケモンで埋める */
function archBuild(a){
  const ch=[],base=new Set(),ok=(pt,p)=>{try{return pt[1](p)}catch(e){return false}};
  const multi=p=>a[7].filter(pt=>ok(pt,p)).length;
  const tdup=p=>p.t.reduce((s,t)=>s+(ch.filter(c=>c.t.includes(t)).length>=1?.5:0),0);
  const add=(p,pt)=>{ch.push(p);base.add(formInfo(p).base);ch.part[p.no]=pt};ch.part={};
  const parts=[...a[7].filter(pt=>pt[2]),...a[7].filter(pt=>!pt[2])];
  for(const pt of parts){const n=pt[2]?(pt[3]?1:2):1;
    for(let i=0;i<n&&ch.length<6;i++){
      const top=p=>pt[3]&&bAbIs(p,pt[3])?3:0;
      const c=P.filter(p=>!base.has(formInfo(p).base)&&ok(pt,p)).map(p=>({p,v:top(p)+multi(p)*.5+p.bst/600-tdup(p)})).sort((x,y)=>y.v-x.v)[0];
      if(c)add(c.p,pt)}}
  while(ch.length<6){
    const wc=t=>ch.filter(c=>mult(t,c.t)>=2).length;
    const c=P.filter(p=>!base.has(formInfo(p).base)).map(p=>({p,v:T.reduce((s,t)=>s+(wc(t)>=2?(mult(t,p.t)<1?1:mult(t,p.t)>=2?-1:0):0),0)+p.bst/600+multi(p)*.3-tdup(p)})).sort((x,y)=>y.v-x.v)[0];
    if(!c)break;add(c.p,null)}
  return ch;
}
/* 型の例の1匹ぶんの育成（特性・持ち物・性格・能力ポイント・技）。ポケモンの解説の「型の例」を部品に使い、
   その役に必要な技（あまごい・トリックルームなど）を入れる。持ち物はパーティの中で重ならないようにする */
const ARCH_PREF={tr:['tr','attacker','bulky','support'],cycle:['bulky','support','attacker'],setup:['setup','attacker','support']};
function archSet(a,p,pt,used){
  const g=monGuide(p,{raw:true}),pref=ARCH_PREF[a[0]]||['attacker','setup','bulky','support'];
  /* 天気を特性で作れるなら、天気の技は入れない（いたずらごころのような「あると良い特性」はそのまま技を入れる） */
  const kiten=pt&&pt[4]&&!(pt[3]&&pt[3].some(k=>WSET[k]||k==='sand-spit')&&bAbIs(p,pt[3]));
  const fieldMv=kiten&&['trickroom','tailwind','raindance','sunnyday','sandstorm','snowscape','auroraveil','reflect'].some(k=>pt[4].includes(k));
  const order=kiten?(fieldMv?['support','bulky','attacker','tr','setup']:['bulky','support','attacker','setup']):[...pref.filter(k=>g.keys.includes(k)),...pref,...g.keys,'attacker','bulky','support'];
  let s=null;for(const k of order){s=g.make(k);if(s)break}
  if(!s)return null;
  let mv=[...s.moves];
  if(kiten){const ls=LSD[p.no]?LSD[p.no][1]:[];const add=pt[4].map(k=>ls.find(id=>g.key(id)===k)).filter(Boolean).slice(0,pt[5]||1);
    mv=[...new Set([...add,...mv.filter(id=>!add.includes(id))])].slice(0,4)}
  /* 攻撃技が1つもなくならないように */
  if(!mv.some(id=>{const i=mvInfo(id);return i&&i.pow>0})){const b=g.best(1)[0];if(b)mv=[...mv.slice(0,3),b]}
  let {up,dn,sp}=s;sp=[...sp];
  let item=s.item;
  /* トリックルームの型：みんな遅いほうがよい（素早さを下げる性格・素早さに振らない） */
  if(a[0]==='tr'){if(!kiten&&mv.some(id=>{const i=mvInfo(id);return i&&i.pow>0})){up=g.ai;sp=[0,0,0,0,0,0];sp[0]=32;sp[g.ai]=32;sp[g.lowDef]=2}
    else if(sp[5]){sp[0]=32;sp[5]=0;sp[g.lowDef]=Math.max(sp[g.lowDef],2);if(up===5)up=g.lowDef}dn=5;
    if(item==='choicescarf')item=g.ai===1?'choiceband':'choicespecs';if(item==='focussash')item='sitrusberry'}
  /* 天気・おいかぜで速くなるなら、こだわりスカーフはいらない */
  if(item==='choicescarf'&&(a[0]==='tailwind'||bAbIs(p,['swift-swim','chlorophyll','sand-rush','slush-rush'])))item='lifeorb';
  /* 持ち物はパーティの中で重ならないように。変化技があるときは、とつげきチョッキは持たせない */
  const hasSt=mv.some(id=>{const i=mvInfo(id);return i&&i.cls===2});
  const okIt=k=>ITEMN[k]&&!used.has(k)&&!(k==='assaultvest'&&hasSt);
  if(!okIt(item)){const def=['leftovers','sitrusberry','focussash'].includes(item);
    item=(def?['leftovers','sitrusberry','assaultvest','expertbelt','lifeorb']:['lifeorb','expertbelt',g.ai===1?'choiceband':'choicespecs','choicescarf','sitrusberry','focussash']).find(okIt)
      ||[TYPE_ITEM[p.t[0]],TYPE_ITEM[p.t[1]],g.ai===1?'muscleband':'wiseglasses','focussash','choicescarf','choiceband','choicespecs','assaultvest','expertbelt'].find(k=>k&&okIt(k))||item}
  used.add(item);
  return{ab:s.ab,item,up,dn,sp,moves:mv,title:s.title};
}
const archSets=(a,mons)=>{const used=new Set();return mons.map(p=>archSet(a,p,mons.part&&mons.part[p.no],used))};
const toSaved=s=>s?{ab:s.ab?{n:ABN[s.ab]||s.ab,k:s.ab}:null,it:s.item?{n:ITEMN[s.item]||s.item,k:s.item}:null,mv:s.moves.map(id=>({n:mName(id),id})),sp:[...s.sp],up:s.up,dn:s.dn}:undefined;
function archUse(a,nos,sets){
  let i=TEAMS.cur;
  if(team.length){const e=TEAMS.list.findIndex(x=>!x.team.length);
    if(e>=0)i=e;else if(!confirm(`「${teamName(TEAMS.cur)}」を、${a[1]}の例に入れかえます。よろしいですか？`))return}
  if(i!==TEAMS.cur)switchTeam(i);
  team=nos.map((no,k)=>{const x={no,sel:k<PICK()},sv=sets&&toSaved(sets[k]);if(sv)x.set=sv;return x});if(!TEAMS.list[i].name)TEAMS.list[i].name=a[1].slice(0,20);
  saveTeam();toast(`「${teamName(i)}」に入れました`);nav('#/team');
}
const teamMons=()=>(typeof team!=='undefined'?team:[]).map(x=>byNo[x.no]).filter(Boolean);
function learnBuildsHTML(){
  const ms=teamMons();
  const fits=ms.length?ARCHS.map(a=>({a,f:archFit(a,ms)})).filter(x=>x.f.ok).sort((x,y)=>y.f.score-x.f.score):[];
  return `${ms.length?`<div class="sec"><h2>いまのパーティ</h2></div><p class="note" style="padding-top:0">${fits.length?`「${esc(teamName(TEAMS.cur))}」は、${fits.slice(0,3).map(x=>`<a href="#/arch/${x.a[0]}" style="color:var(--acc)">${esc(x.a[1])}</a>`).join('・')}の形に近いです。`:`「${esc(teamName(TEAMS.cur))}」は、下のどの型にもはっきりとは当てはまりません。型を押すと、足りない役が分かります。`}</p>`:''}
  <div class="sec"><h2>構築の型</h2><span style="font-size:12px;color:var(--dim)">${ARCHS.length}</span></div>
  ${ARCHS.map(a=>`<a class="row" href="#/arch/${a[0]}"><div class="row-m"><div class="row-t">${esc(a[1])}<span class="atag">${esc(a[3])}</span></div><div class="row-s">${esc(a[2])}</div></div><span class="chev">${SVG(I.chev,18)}</span></a>`).join('')}`;
}
function archView(id){
  const a=archOf(id);if(!a){V.innerHTML='<p class="empty">見つかりません。</p>';return}
  setHeader(esc(a[1]),'#/learn/build');
  const ms=teamMons(),fit=ms.length?archFit(a,ms):null,ex=archBuild(a),exs=archSets(a,ex);
  const mvIds=a[8].map(k=>Object.keys(MD).map(Number).find(id=>MD[id][3]===k)).filter(Boolean);
  const mA=p=>`<a class="pill gchip" href="#/p/${p.no}">${esc(formInfo(p).base)}${formInfo(p).tag?'（'+esc(formInfo(p).tag)+'）':''}</a>`;
  V.innerHTML=`<div class="gdoc"><span class="atag">構築の型</span><span class="atag">${esc(a[3])}</span><h2>${esc(a[1])}</h2><p>${esc(a[4])}</p>
    <h3>組み方</h3><ol class="gtips">${a[5].map(x=>`<li>${esc(x)}</li>`).join('')}</ol>
    <h3>弱点と、相手に使われたときの対策</h3><ul class="gtips">${a[6].map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
    ${fit?`<div class="sec"><h2>いまのパーティでは</h2><span style="font-size:12px;color:var(--dim)">${esc(teamName(TEAMS.cur))}</span></div>
      <div class="gdoc" style="padding-top:0">${fit.parts.map(x=>`<div class="adv ${x.who.length?'adv-tip':x.need?'adv-warn':''}" style="margin:8px 0"><b>${x.who.length?'○':'×'} ${esc(x.name)}${x.need?'':'<span class="atag">あるとよい</span>'}</b><p>${x.who.length?x.who.map(p=>esc(p.n)+(x.ab&&!bAbIs(p,x.ab)?'（技で）':'')).join('・'):'まだいません。下の例から探せます。'}</p></div>`).join('')}</div>`:''}
    <div class="sec"><h2>この型のパーティの例</h2><span style="font-size:12px;color:var(--dim)">データから自動で組んだ例</span></div>
    ${ex.map((p,k)=>`<a class="row" href="#/p/${p.no}"><span class="av">${stamp(p)}</span><div class="row-m"><div class="row-t">${nm(p)}</div><div class="row-s">${esc(a[7].filter(pt=>{try{return pt[1](p)}catch(e){return false}}).map(pt=>pt[0]+(pt[3]&&!bAbIs(p,pt[3])?'（技で）':'')).join('・')||'弱点を補う')}</div>${exs[k]?`<div class="row-s" style="color:var(--fg)">${esc(ITEMN[exs[k].item]||'')}／${esc(exs[k].moves.map(mName).join('・'))}</div>`:''}</div><span class="chev">${SVG(I.chev,18)}</span></a>`).join('')}
    <div class="btns"><button class="btn btn-p" id="ar-use">このパーティを使う</button></div>
    <p class="note" style="padding-top:0;color:var(--mute)">型に必要な役から選び、残りは弱点が重ならないように選んでいます。技・持ち物・性格・能力ポイントも入った状態でパーティに入り、育成の画面で変えられます。${team.length?'空いているパーティの枠に入れます（空きがなければ、いまのパーティを入れかえます）。':''}</p>
    <div class="sec"><h2>中心になるポケモンの例</h2><span style="font-size:12px;color:var(--dim)">特性・技・種族値から</span></div>
    ${a[7].map(pt=>{const l=archMons(pt);return l.length?`<div class="gdoc gsub"><h3>${esc(pt[0])}</h3></div><div class="pills gchips">${l.map(mA).join('')}</div>`:''}).join('')}
    ${mvIds.length?`<div class="sec"><h2>この型でよく使う技</h2></div><div class="pills gchips">${mvIds.map(mvChip).join('')}</div>`:''}
    ${a[9].length?`<div class="sec"><h2>関係する言葉</h2></div>${a[9].map(wordOf).filter(Boolean).map(w=>`<a class="row" href="#/word/${w[0]}"><div class="row-m"><div class="row-t">${esc(w[1])}</div></div><span class="chev">${SVG(I.chev,18)}</span></a>`).join('')}`:''}
    <div class="btns"><a class="btn btn-p" href="#/team">パーティを組む</a><a class="btn btn-s" href="#/assist">選出アシストで試す</a></div>
    <p class="note" style="color:var(--mute)">当サイトが書いた説明です。ポケモンの例は、当サイトのデータ（特性・覚える技・種族値）から機械的に選んでいます。</p>`;
  document.getElementById('ar-use').onclick=()=>archUse(a,ex.map(p=>p.no),exs);
}
