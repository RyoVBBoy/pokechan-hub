/* ===================== 攻略ガイド：技の使いどころ・特性の使い方（当サイトのオリジナルの文章） =====================
   技・特性を「役割」ごとに分け、役割ごとの使いどころを当サイトの言葉で書く。どの技・特性がどの役割に入るかは
   キー（MD の4番目・ABD のキー）で決め、ここにない技・特性は役割なしで表示する。
   #/learn/move・#/learn/ability（一覧）、#/move/番号・#/ability/キー（詳しい画面：覚える／持つポケモンつき）。 */
const mvKeyId={};for(const id in MD)mvKeyId[MD[id][3]]=+id;
const mvInfo=id=>{const u=MVU[id];if(u)return{t:u[0],cls:u[1],pow:u[2],acc:u[3],pp:u[4],pri:u[5]};const m=MV[id];return m?{t:m[1],cls:m[4],pow:m[2],acc:m[3],pp:null,pri:m[5]}:null};
const MOVE_ROLES=[
 ['sensei','先制技','優先度が高く、素早さに関係なく先に出せる攻撃技。威力は控えめなので、相手を削ってからのとどめや、速い相手に上から倒されそうなときの最後の一撃に使う。きあいのタスキで耐えた相手にとどめを刺すのにも向く。',null,id=>{const i=mvInfo(id);return i&&i.pri>0&&i.pow>0}],
 ['setup','積み技（能力を上げる技）','自分の能力を上げて、そのあとの攻撃で一気に勝負を決める技。相手が交代したり、こちらに有利な相手が出ているときに使う。積んでいる間は攻撃できないので、相手に削られにくい場面や、壁・まひなどで味方が作った「安全な1ターン」に合わせるのがコツ。',['swordsdance','dragondance','nastyplot','quiverdance','shellsmash','calmmind','bulkup','bellydrum','shiftgear','coil','tidyup','agility','rockpolish','geomancy','curse','noretreat','growth','irondefense','amnesia','cosmicpower','cottonguard','acidarmor','howl','victorydance','clangoroussoul','filletaway','workup']],
 ['heal','回復技','自分のHPを回復する技。受けて何度も場に出る役が、長く戦うために使う。相手の攻撃で受けるダメージより回復量が多いかどうか（ダメージ計算で確かめられる）が使えるかの目安。',['recover','roost','slackoff','milkdrink','morningsun','synthesis','moonlight','wish','rest','strengthsap','painsplit','aquaring','ingrain','leechseed','lifedew','junglehealing','shoreup']],
 ['protect','守る技','そのターンの相手の攻撃を防ぐ技。相手の行動を見る・天気やトリックルームのターンを稼ぐ・ダブルで味方の攻撃を待つ、などに使う。続けて使うと失敗しやすい。',['protect','detect','kingsshield','spikyshield','banefulbunker','endure','wideguard','quickguard','silktrap','burningbulwark']],
 ['pivot','交代しながら攻める技','攻撃や変化技を出したあと、そのまま味方と交代できる技。不利な相手から引きつつ削れる。先発で相手を見てから、後ろの有利なポケモンにつなぐ動きに向く。',['uturn','voltswitch','flipturn','partingshot','shedtail','chillyreception','batonpass','teleport']],
 ['speed','素早さを操作する技','先に動ける側を入れかえる技。おいかぜは味方を速く、トリックルームは遅い順に、こごえるかぜなどは相手を遅くする。素早さで負けている相手に勝つための手段になる。',['tailwind','trickroom','icywind','electroweb','rocktomb','bulldoze','thunderwave','scaryface','stringshot','mudshot','lowsweep','glare','nuzzle']],
 ['field','天気・フィールドを作る技','5ターンの間、天気やフィールドを変える技。味方の技の威力や特性を活かす「場づくり」に使う。相手も天気を変えられるときは、取り合いになる。',['sunnyday','raindance','sandstorm','snowscape','grassyterrain','mistyterrain','electricterrain','psychicterrain']],
 ['screen','壁の技','味方が受けるダメージを減らす技。リフレクターは物理、ひかりのかべは特殊、オーロラベールは両方（ゆきのときだけ）。起点作り役が張って、後ろのアタッカーが積む・殴る時間を作る。',['reflect','lightscreen','auroraveil']],
 ['status','状態異常にする技','相手をやけど・まひ・どく・ねむりにする技。やけどは物理アタッカーの攻撃を下げ、まひは素早さを下げ、もうどくは受け役を少しずつ削る。相手の役割を崩すのに使う。',['willowisp','thunderwave','toxic','hypnosis','sleeppowder','yawn','glare','stunspore','poisonpowder','sing','confuseray','swagger']],
 ['disrupt','相手を邪魔する技','相手のやりたいことを止める技。ちょうはつは変化技を、アンコールは同じ技を、トリック・はたきおとすは持ち物を、ほえる・ドラゴンテールは積んだ能力を流す。起点作りや積み技の多い相手に強い。',['taunt','encore','trick','switcheroo','knockoff','disable','torment','imprison','haze','clearsmog','roar','whirlwind','dragontail','circlethrow','snarl','spite']],
 ['hazard','設置技・設置を取り除く技','相手の場に、交代で出てきたポケモンにダメージを与えるものをまく技（ステルスロックなど）と、それを取り除く技（こうそくスピン・きりばらいなど）。交代の多いサイクル戦で効いてくる。',['stealthrock','spikes','toxicspikes','stickyweb','rapidspin','defog','mortalspin','courtchange']],
 ['selfdrop','威力が高いが自分の能力が下がる技','インファイトやりゅうせいぐんのように、威力が高いかわりに使ったあと自分の能力が下がる技。一撃で倒したい場面で使い、下がった能力は交代で元に戻す。続けて撃つと威力が落ちる点に注意。',['closecombat','superpower','overheat','dracometeor','leafstorm','hammerarm','makeitrain','headlongrush','armorcannon','psychoboost','vcreate','fleurcannon','icehammer','spinout']],
 ['recoil','反動のある技','与えたダメージの一部を自分も受ける技。威力は高いが、何度も使うと自分のHPが減っていく。いのちのたまと合わせるとさらに減りが早いので、持ち物との組み合わせに注意。',['doubleedge','flareblitz','bravebird','woodhammer','headsmash','wavecrash','volttackle','takedown','headcharge','wildcharge','submission','highjumpkick']],
 ['multi','連続で攻撃する技','1回の行動で何回も攻撃する技。きあいのタスキやばけのかわ、みがわりを1回で壊せる。回数で威力が変わるので、ダメージ計算では回数を選んで確かめる。',['bulletseed','rockblast','iciclespear','scaleshot','tripleaxel','dragondarts','doublehit','dualwingbeat','populationbomb','pinmissile','watershuriken','bonerush','tailslap','surgingstrikes','doublekick','beatup']],
 ['spread','相手全体に当たる技（ダブル）','ダブルで相手2匹（技によっては味方も）に当たる技。1匹に当てるより威力は下がる（0.75倍）が、2匹まとめて削れる。味方にも当たる技（じしんなど）は、味方を浮かせるかまもると組み合わせる。',['earthquake','surf','rockslide','heatwave','dazzlinggleam','hypervoice','discharge','muddywater','blizzard','icywind','snarl','bulldoze','eruption','waterspout','boomburst','lavaplume','sludgewave','electroweb','breakingswipe','makeitrain','petalblizzard','bleakwindstorm']],
 ['support','ダブルの補助技','味方を助けるための技。ねこだましで相手1匹を止め、このゆびとまれ・いかりのこなで攻撃を引きつけ、てだすけで味方の技を強くする。2匹の連携で勝つダブルならではの技。',['fakeout','followme','ragepowder','helpinghand','allyswitch','afteryou','instruct','coaching','quash','dragoncheer']],
 ['fixed','決まったダメージを与える技','相手の耐久や能力に関係なく、決まった量や割合のダメージを与える技（ちきゅうなげ・いかりのまえば・カウンターなど）。耐久の高い相手にも確実にダメージを入れられる。当サイトのダメージ計算では一部を扱っていない。',['seismictoss','nightshade','superfang','finalgambit','endeavor','counter','mirrorcoat','metalburst','comeuppance','ruination']],
 ['sacrifice','自分が倒れるかわりに効果のある技','だいばくはつのように自分が倒れる技や、いやしのねがいのように倒れて味方を助ける技。不利な場面で最後の仕事をして、有利なポケモンを安全に出すために使う。',['explosion','selfdestruct','mistyexplosion','memento','healingwish','finalgambit','destinybond','lunardance']]
];
const ABILITY_ROLES=[
 ['power','技の威力を上げる特性','攻撃や技の威力を上げる特性。てきおうりょくはタイプ一致技をさらに強く、テクニシャンは威力の低い技を、かたいツメは接触技を、スキン系はノーマル技を別のタイプに変えて強くする。持たせる技との組み合わせが大事。',['adaptability','huge-power','pure-power','technician','sheer-force','tough-claws','iron-fist','strong-jaw','mega-launcher','sharpness','punk-rock','aerilate','pixilate','refrigerate','dragonize','hustle','guts','sniper','analytic','reckless','water-bubble','steely-spirit','supreme-overlord','skill-link','parental-bond','fairy-aura','liquid-voice','piercing-drill']],
 ['field','天気・フィールドを作る特性','場に出るだけで天気やフィールドを変える特性。交代で出すたびに場を作り直せるので、天気で強くなる味方（すいすい・ようりょくそ など）と組むと強い。後から出したほうの天気が残る。',['drizzle','drought','sand-stream','snow-warning','electric-surge','grassy-surge','psychic-surge','mega-sol','seed-sower','sand-spit']],
 ['weatherboost','天気で強くなる特性','特定の天気のときに素早さが2倍になったり、技が強くなったりする特性。天気を作る味方と組んで使う。天気が変わると効果がなくなる点に注意。',['swift-swim','chlorophyll','sand-rush','slush-rush','solar-power','sand-force','rain-dish','ice-body','dry-skin','hydration','surge-surfer','leaf-guard','grass-pelt']],
 ['absorb','技を無効にする・吸収する特性','特定のタイプの技を受けないか、受けると回復・強化される特性（ふゆう・ちょすい・もらいび など）。その技を読んで交代で出すと、ダメージを受けずに有利をとれる。',['levitate','water-absorb','volt-absorb','flash-fire','sap-sipper','motor-drive','lightning-rod','earth-eater','bulletproof','soundproof','immunity','good-as-gold','queenly-majesty','armor-tail','purifying-salt','wandering-spirit','well-baked-body']],
 ['bulk','受けるダメージを減らす特性','ダメージを減らしたり、1回の攻撃を耐えたりする特性。マルチスケイルはHP満タンで、ばけのかわは1回だけ、がんじょうは満タンから一撃で倒されない。耐久の高いポケモンを、さらに倒されにくくする。',['multiscale','disguise','fur-coat','fluffy','thick-fat','filter','solid-rock','sturdy','marvel-scale','heatproof','ice-scales','stamina','battle-armor','shell-armor','friend-guard']],
 ['weaken','相手を弱らせる特性','場に出たときなどに相手の力を下げる特性。いかくは相手の攻撃を下げ、物理アタッカーの多い相手に強い。きんちょうかんは相手にきのみを使わせない。',['intimidate','unnerve','pressure','stench','cursed-body']],
 ['speed','先に動ける・素早さが上がる特性','技の優先度を上げたり、素早さを上げたりする特性。いたずらごころは変化技を、はやてのつばさはHPが満タンのときにひこう技を先に出せる。かそくは毎ターン素早さが上がる。',['speed-boost','gale-wings','prankster','quick-draw','unburden','quick-feet','triage']],
 ['pivot','交代で役立つ特性','引っ込めると回復するさいせいりょく、状態異常が治るしぜんかいふくなど、交代を繰り返すサイクル戦で強い特性。',['regenerator','natural-cure','emergency-exit','wimp-out']],
 ['contact','触れた相手に効果のある特性','接触技を受けると、相手にダメージや状態異常を与える特性（さめはだ・せいでんき・ほのおのからだ など）。接触技の多い物理アタッカーへの抑止になる。',['rough-skin','static','flame-body','effect-spore','poison-point','gooey','aftermath','innards-out','mummy','iron-barbs','cute-charm','tangling-hair','wandering-spirit']],
 ['statusab','状態異常に関係する特性','状態異常で強くなる（こんじょう・ふしぎなうろこ）、状態異常にならない（めんえき・ふみん）、状態異常で回復する（ポイズンヒール）など。おにびやどくどくを使う相手との駆け引きが変わる。',['guts','marvel-scale','poison-heal','immunity','insomnia','vital-spirit','limber','magic-guard','shed-skin','water-veil','comatose','purifying-salt']],
 ['stat','能力の変化に関係する特性','能力を下げられると逆に上がる（まけんき・かちき）、能力を下げられない（クリアボディ）、相手の能力変化を無視する（てんねん）など。いかくや積み技との相性が大きく変わる。',['clear-body','competitive','defiant','contrary','unaware','mirror-armor','moody','white-smoke','hyper-cutter','big-pecks','keen-eye','own-tempo','oblivious','inner-focus','guard-dog','rattled']],
 ['special','そのポケモンならではの特性','タイプが変わる（へんげんじざい・リベロ）、姿が変わる（バトルスイッチ・マイティチェンジ）、相手の特性を無視する（かたやぶり）、変化技を跳ね返す（マジックミラー）など、使い方が独特な特性。',['protean','libero','stance-change','zero-to-hero','illusion','imposter','mold-breaker','trace','magic-bounce','infiltrator','scrappy','no-guard','mimicry','hunger-switch','battle-bond']]
];
const mvRoles=id=>{const k=MD[id]&&MD[id][3];return MOVE_ROLES.filter(r=>r[4]?r[4](id):r[3].includes(k))};
const roleMoves=r=>Object.keys(MD).map(Number).filter(id=>r[4]?r[4](id):r[3].includes(MD[id][3]));
const abRoles=k=>ABILITY_ROLES.filter(r=>r[3].includes(k));
const learners=id=>P.filter(p=>LSD[p.no]&&LSD[p.no][1].includes(id));
const abHolders=k=>P.filter(p=>(ABD[p.no]||[]).some(([a])=>a===k));
const mvChip=id=>`<a class="pill gchip" href="#/move/${id}">${esc(mName(id))}</a>`;
const abChip=k=>`<a class="pill gchip" href="#/ability/${k}">${esc(ABN[k]||k)}</a>`;
function learnMovesHTML(){
  return MOVE_ROLES.map(r=>{const ids=roleMoves(r);if(!ids.length)return'';
    return `<div class="sec"><h2>${esc(r[1])}</h2><span style="font-size:12px;color:var(--dim)">${ids.length}</span></div><p class="note" style="padding-top:0">${esc(r[2])}</p><div class="pills gchips">${ids.slice(0,24).map(mvChip).join('')}${ids.length>24?`<span class="gmore">ほか${ids.length-24}件</span>`:''}</div>`}).join('')
  /* すべての技をタイプ別に（役割に入らない技もここから探せる） */
  +`<div class="sec"><h2>すべての技（タイプ別）</h2><span style="font-size:12px;color:var(--dim)">${Object.keys(MD).length}</span></div>`+T.map(t=>{const ids=Object.keys(MD).map(Number).filter(id=>{const i=mvInfo(id);return i&&i.t===t}).sort((a,b)=>(mvInfo(b).pow||0)-(mvInfo(a).pow||0));
    return ids.length?`<details class="gdet"><summary>${chip(t)}<span>${ids.length}</span></summary><div class="pills gchips">${ids.map(mvChip).join('')}</div></details>`:''}).join('');
}
function learnAbilitiesHTML(){
  return ABILITY_ROLES.map(r=>{const ks=r[3].filter(k=>ABN[k]||ABDS[k]);if(!ks.length)return'';
    return `<div class="sec"><h2>${esc(r[1])}</h2><span style="font-size:12px;color:var(--dim)">${ks.length}</span></div><p class="note" style="padding-top:0">${esc(r[2])}</p><div class="pills gchips">${ks.map(abChip).join('')}</div>`}).join('')
  +(()=>{const used=new Set(ABILITY_ROLES.flatMap(r=>r[3])),rest=Object.keys(ABDS).filter(k=>!used.has(k)&&ABN[k]).sort((a,b)=>ABN[a].localeCompare(ABN[b],'ja'));
    return rest.length?`<div class="sec"><h2>そのほかの特性</h2><span style="font-size:12px;color:var(--dim)">${rest.length}</span></div><div class="pills gchips">${rest.map(abChip).join('')}</div>`:''})();
}

/* ---- 技ごとの使いどころ：その技のデータ（優先度・命中・追加効果・反動など）だけから作る（グループの説明は使わない） ---- */
const AIL_TIP={brn:'やけどは毎ターン少しずつ削るうえ、物理技のダメージが半分になるので、物理アタッカーを止めるのに向く。',
  par:'まひは素早さが半分になり、ときどき動けなくなるので、速い相手を遅くしたいときに向く。',
  psn:'どくは毎ターン少しずつHPを削る。',tox:'もうどくは毎ターンのダメージが増えていくので、長く居座る受け役を削るのに向く。',
  slp:'ねむりは数ターン行動できなくなるので、その間に積む・交代するなど大きく動ける。',frz:'こおりは解けるまで行動できなくなる。',
  cnf:'こんらんは、数ターンの間、自分を攻撃してしまうことがある。運に左右されるので、あてにしすぎないこと。',tri:'どの状態異常になるかは運しだい。'};
/* グループの札に添える一言（グループのどの技にも当てはまることだけ） */
const ROLE_TIP={sensei:'優先度が高く、素早さに関係なく先に出せる',setup:'自分の能力を上げる',heal:'自分のHPを回復・確保する',protect:'相手の攻撃から身を守る・耐える',
  pivot:'使ったあと味方と交代できる',speed:'行動の順番を変える',field:'天気やフィールドを変える',screen:'味方が受けるダメージを減らす',
  status:'相手を状態異常やこんらんにする',disrupt:'相手のやりたいことを邪魔する',hazard:'交代で出てくる相手へのしかけ、またはその取り除き',
  selfdrop:'使うと自分の能力が下がる',recoil:'自分のHPが減ることがある',multi:'1回で何回も攻撃する',spread:'ダブルで複数に当たる',
  support:'ダブルで味方を助ける',fixed:'相手の能力に関係ない量のダメージを与える',sacrifice:'自分が倒れることと引きかえの効果がある'};
function moveTips(id){
  const i=mvInfo(id),e=(typeof MVE!=='undefined'&&MVE[id])||{},d=MD[id][1]||'',fl=MD[id][2]||'',out=[];
  const stl=a=>a.map(([k,v])=>`${STN[k]||k}${Math.abs(v)>=2?'を大きく':'を'}`).join('・');
  if(i.pri>0)out.push(i.cls===2?`優先度が+${i.pri}なので、素早さに関係なく、たいていは相手より先に出せる。`:`優先度が+${i.pri}なので、素早さで負けている相手にも先に攻撃できる。威力より「先に動けること」が強みなので、削れた相手へのとどめや、先に倒されそうな場面で使う。`);
  if(i.pri<0)out.push(`優先度が${i.pri}なので、ほとんどの場合あとから動く。相手の行動を受けてから効果が出ることを前提に使う。`);
  if(e.s){const up=e.s.filter(x=>x[1]>0),dn=e.s.filter(x=>x[1]<0);
    if(up.length&&i.cls===2)out.push(`自分の${stl(up)}上げる技。上げたあとの攻撃や耐久で勝負を決めるので、相手に削られにくい場面や、相手が交代してきたときに使う。`);
    else if(up.length&&up[0][2]>=100)out.push(`攻撃しながら自分の${stl(up)}上げられるので、使うほど有利になっていく。`);
    else if(up.length)out.push(`ときどき自分の${up.map(x=>STN[x[0]]).join('・')}が上がる（運しだい）。`);
    if(dn.length)out.push(`使うと自分の${dn.map(x=>STN[x[0]]).join('・')}が下がる。威力の高さを活かして一撃で倒したい場面で使い、続けて使うと弱くなるので、一度交代して元に戻すとよい。`)}
  if(e.t){const sure=e.t.filter(x=>x[2]>=100),maybe=e.t.filter(x=>x[2]<100);
    if(sure.length)out.push(`相手の${sure.map(x=>STN[x[0]]).join('・')}を確実に下げる。${sure.some(x=>x[0]==='spe')?'素早さを下げれば、次のターンから味方が先に動きやすくなる。':'味方の攻撃を通しやすく、または相手の攻撃を受けやすくなる。'}`);
    if(maybe.length)out.push(`${maybe.map(x=>`${x[2]}%の確率で`).join('')}相手の${maybe.map(x=>STN[x[0]]).join('・')}が下がることがある（おまけの効果）。`)}
  if(e.a){const [k,c]=e.a;out.push(c>=100?`相手を${AILN[k]||k}にする技。${AIL_TIP[k]||''}すでに状態異常の相手や、タイプ・特性で効かない相手もいる点に注意。`:`${c}%の確率で相手を${AILN[k]||k}にする（おまけの効果なので、あてにしすぎない）。`)}
  if(e.f)out.push(e.f>=100?'相手をひるませて、そのターンの行動を止められる。':`${e.f}%の確率で相手をひるませる。ひるみは相手より先に当てたときだけ起きるので、速いポケモンで使うと活きる。`);
  if(e.rc)out.push(`与えたダメージの${e.rc}%を反動で受ける。威力は高いが、何度も使うと自分のHPが減っていくので、HPが多いうちに使う。`);
  if(e.dr)out.push(`与えたダメージの${e.dr}%だけ回復できるので、攻撃しながら長く戦える。`);
  if(e.cr)out.push('急所に当たりやすい。急所に当たると、相手の防御が上がっていても、壁があっても大きなダメージを与えられる。');
  if(e.cx)out.push('外すと自分がダメージを受ける。命中を確かめてから使う。');
  if(/[0-9０-９]〜[0-9０-９]回|回連続/.test(d))out.push('連続で攻撃するので、きあいのタスキ・ばけのかわ・みがわりを1回の行動で崩せる。');
  if(/ダブルでは/.test(d))out.push('ダブルでは複数に当たる。そのぶん1匹あたりの威力は下がる（0.75倍）が、まとめて削れる。味方にも当たる技なら、味方を浮かせるかまもると組み合わせる。');
  if(i.acc&&i.acc<90&&i.cls!==2)out.push(`命中が${i.acc}%なので、外れることも考えて使う。大事な場面では、命中の高い技と比べて選ぶ。`);
  if(fl.includes('c')&&i.cls!==2)out.push('接触技なので、さめはだ・せいでんき・ほのおのからだなど、触れると効果のある特性を持つ相手には注意。');
  if(i.pow>=120&&!e.rc&&!(e.s&&e.s.some(x=>x[1]<0))&&!(i.acc&&i.acc<90))out.push(`威力${i.pow}と高く、目立った弱点もないので、主力の一撃になる。`);
  if(i.cls!==2&&i.pow&&i.pow<=60&&!(i.pri>0)&&!out.length)out.push('威力は控えめなので、追加の効果や、タイプの相性を活かして使う。');
  return out;
}
function moveView(id){
  id=+id;const i=mvInfo(id);if(!MD[id]||!i){V.innerHTML='<p class="empty">技が見つかりません。</p>';return}
  setHeader(esc(mName(id)),'#/learn/move');
  const rs=mvRoles(id),ls=learners(id).sort((a,b)=>offense(b)-offense(a));
  const cls=['物理','特殊','変化'][i.cls]||'';
  V.innerHTML=`<div class="gdoc"><span class="atag">技</span><h2>${esc(mName(id))}</h2>
    <div class="chips" style="margin:6px 0 4px">${chip(i.t)}<span class="atag">${cls}</span>${i.pow?`<span class="atag">威力 ${i.pow}</span>`:''}${i.acc?`<span class="atag">命中 ${i.acc}</span>`:'<span class="atag">必ず当たる</span>'}${i.pp?`<span class="atag">PP ${i.pp}</span>`:''}${i.pri?`<span class="atag">優先度 ${i.pri>0?'+':''}${i.pri}</span>`:''}</div>
    <h3>効果</h3><p>${esc(MD[id][1])}</p>
    ${(()=>{const tp=moveTips(id);return tp.length?`<h3>使いどころ</h3><ul class="gtips">${tp.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`:''})()}
    ${rs.length?`<h3>分類</h3><div class="gtags">${rs.map(r=>`<a href="#/learn/move" class="gtag"><b>${esc(r[1])}</b><small>${esc(ROLE_TIP[r[0]]||'')}</small></a>`).join('')}</div>`:''}</div>
    <div class="sec"><h2>覚えるポケモン</h2><span style="font-size:12px;color:var(--dim)">${ls.length}匹（攻撃・特攻の高い順）</span></div>
    ${ls.slice(0,10).map(p=>rowP(p)).join('')||'<p class="empty" style="padding:16px">収録ポケモンでは覚えません。</p>'}
    ${ls.length>10?`<p class="note">ほか${ls.length-10}匹が覚えます。</p>`:''}
    <div class="btns"><a class="btn btn-s" href="#/calc">ダメージ計算で試す</a></div>
    <p class="note" style="color:var(--mute)">技の効果と使いどころは当サイトが書いた説明です（ゲーム内の文章ではありません）。</p>`;
}

const AB_ROLE_TIP={power:'技の威力や攻撃を上げる',field:'場に出ると天気やフィールドが変わる',weatherboost:'特定の天気・フィールドで強くなる',absorb:'特定の技を受けない・受けると得をする',
  bulk:'受けるダメージを減らす・倒されにくくする',weaken:'相手の力や行動を弱める',speed:'先に動ける・素早さが上がる',pivot:'交代や引っ込めることで効果がある',
  contact:'触れた相手に効果がある',statusab:'状態異常に関係する',stat:'能力の変化に関係する',special:'使い方が独特'};
function abilityView(k){
  if(!ABN[k]&&!ABDS[k]){V.innerHTML='<p class="empty">特性が見つかりません。</p>';return}
  setHeader(esc(ABN[k]||k),'#/learn/ability');
  const rs=abRoles(k),hs=abHolders(k).sort((a,b)=>b.bst-a.bst);
  V.innerHTML=`<div class="gdoc"><span class="atag">特性</span><h2>${esc(ABN[k]||k)}</h2>
    <h3>効果</h3><p>${esc(ABDS[k]||'（説明は準備中です）')}</p>
    ${rs.length?`<h3>分類</h3><div class="gtags">${rs.map(r=>`<a href="#/learn/ability" class="gtag"><b>${esc(r[1])}</b><small>${esc(AB_ROLE_TIP[r[0]]||'')}</small></a>`).join('')}</div>`:''}
    <p class="note" style="padding:8px 0 0">${typeof ABIMPL!=='undefined'&&ABIMPL.has(k)?'当サイトのダメージ計算で効果を扱っています。':'当サイトのダメージ計算では、この特性の効果は計算に入っていません。'}</p></div>
    <div class="sec"><h2>持つポケモン</h2><span style="font-size:12px;color:var(--dim)">${hs.length}匹</span></div>
    ${hs.slice(0,12).map(p=>rowP(p)).join('')||'<p class="empty" style="padding:16px">収録ポケモンでは持ちません。</p>'}
    <p class="note" style="color:var(--mute)">特性の効果と使い方は当サイトが書いた説明です（ゲーム内の文章ではありません）。</p>`;
}
