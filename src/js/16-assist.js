/* ===================== 選出アシスト ===================== */
let opp6=(()=>{try{return JSON.parse(localStorage.getItem('pcopp6')||'[]').map(n=>NO_MOVED[n]||n).filter(n=>byNo[n]).slice(0,6)}catch(e){return[]}})();
const saveOpp6=()=>{try{localStorage.setItem('pcopp6',JSON.stringify(opp6))}catch(e){}};
let asMode='atk';
/* 計算用の型：ラダー集計があれば最頻の型、なければ自動で決めた型（乱数なし） */
const detSet=p=>LIVE.csv[p.no]?buildSet(p,LIVE.csv[p.no],true):chooseSet(p,true);
function estHit(a,d){
  let best={pct:0,mv:null,acc:100};
  a.moves.forEach(mv=>{if(mv.prot)return;const r=bcalc(a,mv,d,{});
    const h=mv.maxH>1?(mv.minH===mv.maxH?mv.maxH:3):1,pct=r.dmg*h/d.max*100,acc=accOf(a,mv,d);
    if(pct*acc>best.pct*best.acc)best={pct,mv,acc}});
  return best;
}
function combos(arr,k){const out=[];const rec=(s,c)=>{if(c.length===k){out.push(c.slice());return}for(let i=s;i<arr.length;i++){c.push(arr[i]);rec(i+1,c);c.pop()}};rec(0,[]);return out}
function analyze(myNos,opNos,mySF,opSF,W){
  mySF=mySF||mySetFor;opSF=opSF||(n=>detSet(byNo[n]));
  const sw=B.weather;B.weather=null;
  try{
    const M=myNos.map(n=>mkMon(byNo[n],'me',mySF(n))),O=opNos.map(n=>mkMon(byNo[n],'op',opSF(n)));
    const w=O.map((_,j)=>W?W[j]:1),wt=w.reduce((a,b)=>a+b,0)||1;
    const D=M.map(m=>O.map(o=>estHit(m,o))),R=O.map(o=>M.map(m=>estHit(o,m)));
    const fast=M.map(m=>O.map(o=>effSpd(m)>effSpd(o)));
    const offV=(i,j)=>{const d=D[i][j];let v=Math.min(d.pct*d.acc/100,100)/100;if(d.pct>=100&&fast[i][j])v+=.25;return v};
    const defV=i=>O.reduce((a,_,j)=>a+w[j]*Math.min(R[j][i].pct*R[j][i].acc/100,100)/100,0)/wt;
    const score=idx=>O.reduce((a,_,j)=>a+w[j]*Math.max(...idx.map(i=>offV(i,j))),0)/wt-.6*idx.reduce((a,i)=>a+defV(i),0)/idx.length;
    const k=Math.min(PICK(),M.length);
    const all=combos(M.map((_,i)=>i),k).map(c=>({c,s:score(c)})).sort((a,b)=>b.s-a.s);
    const best=all[0].c;
    const leads=combos(best,Math.min(LEADN(),best.length)).map(c=>({c,s:score(c)+c.reduce((a,i)=>a+fast[i].reduce((x,f,j)=>x+(f?w[j]:0),0)/wt*.15,0)})).sort((a,b)=>b.s-a.s);
    const lead=leads[0].c,back=best.filter(i=>!lead.includes(i));
    return{M,O,D,R,fast,all:all.slice(0,3),full:all,best,lead,back,offV,leads};
  }finally{B.weather=sw}
}
const shortN=n=>n.length>5?n.slice(0,4)+'…':n;
function asReason(A,i){
  const hits=A.O.map((o,j)=>({o,j,d:A.D[i][j]})).filter(x=>x.d.pct>=50&&x.d.pct>=Math.max(...A.best.map(k=>A.D[k][x.j].pct))-1).sort((a,b)=>b.d.pct-a.d.pct);
  const o=[];
  if(hits.length)o.push(`${hits.slice(0,3).map(x=>x.o.p.n).join('・')}に${hits[0].d.mv?hits[0].d.mv.n:''}で大ダメージ`);
  const f=A.fast[i].filter(Boolean).length;
  if(f>=Math.ceil(A.O.length*.6))o.push(`相手${A.O.length}匹中${f}匹より速い`);
  const w=A.O.filter((_,j)=>A.R[j][i].pct>=100).length;
  if(w)o.push(`<span style="color:var(--w2)">${w}匹から一撃で倒されるおそれ</span>`);
  return o.join('。')||'全体に安定して戦える';
}

/* ---- 相手の予想 ----
   相手から見た最適な選出を計算し、点数の近い選出ほど選ばれやすいとして、各ポケモンの「選出されやすさ」を出す。
   相手はこちらの育成を知らないので、こちらの型は「よくある型」と仮定する。 */
const MVEN={"karatechop":2,"doubleslap":3,"cometpunch":4,"megapunch":5,"payday":6,"scratch":10,"vicegrip":11,"guillotine":12,"razorwind":13,"swordsdance":14,"cut":15,"gust":16,"wingattack":17,"whirlwind":18,"fly":19,"slam":21,"vinewhip":22,"stomp":23,"doublekick":24,"jumpkick":26,"rollingkick":27,"sandattack":28,"headbutt":29,"hornattack":30,"furyattack":31,"horndrill":32,"tackle":33,"takedown":36,"thrash":37,"tailwhip":39,"poisonsting":40,"twineedle":41,"leer":43,"growl":45,"roar":46,"sing":47,"supersonic":48,"sonicboom":49,"disable":50,"acid":51,"ember":52,"mist":54,"watergun":55,"psybeam":60,"bubblebeam":61,"aurorabeam":62,"hyperbeam":63,"peck":64,"submission":66,"lowkick":67,"counter":68,"seismictoss":69,"strength":70,"absorb":71,"megadrain":72,"leechseed":73,"growth":74,"razorleaf":75,"solarbeam":76,"poisonpowder":77,"stunspore":78,"sleeppowder":79,"petaldance":80,"stringshot":81,"dragonrage":82,"thundershock":84,"thunderwave":86,"rockthrow":88,"fissure":90,"dig":91,"toxic":92,"confusion":93,"hypnosis":95,"meditate":96,"agility":97,"rage":99,"teleport":100,"nightshade":101,"mimic":102,"screech":103,"doubleteam":104,"recover":105,"harden":106,"minimize":107,"smokescreen":108,"confuseray":109,"withdraw":110,"defensecurl":111,"barrier":112,"lightscreen":113,"haze":114,"reflect":115,"focusenergy":116,"bide":117,"metronome":118,"mirrormove":119,"selfdestruct":120,"eggbomb":121,"lick":122,"smog":123,"sludge":124,"boneclub":125,"clamp":128,"swift":129,"skullbash":130,"spikecannon":131,"constrict":132,"amnesia":133,"kinesis":134,"softboiled":135,"glare":137,"dreameater":138,"poisongas":139,"barrage":140,"lovelykiss":142,"skyattack":143,"transform":144,"bubble":145,"dizzypunch":146,"spore":147,"flash":148,"psywave":149,"splash":150,"acidarmor":151,"explosion":153,"furyswipes":154,"bonemerang":155,"rest":156,"hyperfang":158,"sharpen":159,"conversion":160,"superfang":162,"slash":163,"substitute":164,"struggle":165,"sketch":166,"triplekick":167,"thief":168,"spiderweb":169,"mindreader":170,"nightmare":171,"flamewheel":172,"snore":173,"curse":174,"flail":175,"conversion2":176,"aeroblast":177,"cottonspore":178,"reversal":179,"spite":180,"powdersnow":181,"scaryface":184,"feintattack":185,"sweetkiss":186,"bellydrum":187,"octazooka":190,"spikes":191,"foresight":193,"destinybond":194,"perishsong":195,"detect":197,"lockon":199,"outrage":200,"sandstorm":201,"endure":203,"charm":204,"rollout":205,"falseswipe":206,"swagger":207,"milkdrink":208,"spark":209,"furycutter":210,"meanlook":212,"attract":213,"sleeptalk":214,"healbell":215,"return":216,"present":217,"frustration":218,"safeguard":219,"painsplit":220,"sacredfire":221,"magnitude":222,"dragonbreath":225,"batonpass":226,"encore":227,"pursuit":228,"sweetscent":230,"metalclaw":232,"vitalthrow":233,"morningsun":234,"synthesis":235,"moonlight":236,"hiddenpower":237,"twister":239,"raindance":240,"sunnyday":241,"mirrorcoat":243,"psychup":244,"futuresight":248,"rocksmash":249,"beatup":251,"fakeout":252,"uproar":253,"stockpile":254,"spitup":255,"swallow":256,"hail":258,"torment":259,"flatter":260,"willowisp":261,"memento":262,"focuspunch":264,"smellingsalts":265,"followme":266,"naturepower":267,"charge":268,"taunt":269,"helpinghand":270,"trick":271,"roleplay":272,"wish":273,"assist":274,"ingrain":275,"magiccoat":277,"recycle":278,"revenge":279,"yawn":281,"endeavor":283,"skillswap":285,"imprison":286,"refresh":287,"grudge":288,"snatch":289,"secretpower":290,"dive":291,"armthrust":292,"camouflage":293,"tailglow":294,"lusterpurge":295,"mistball":296,"featherdance":297,"teeterdance":298,"mudsport":300,"iceball":301,"needlearm":302,"slackoff":303,"blastburn":307,"hydrocannon":308,"astonish":310,"weatherball":311,"aromatherapy":312,"faketears":313,"odorsleuth":316,"silverwind":318,"metalsound":319,"grasswhistle":320,"tickle":321,"cosmicpower":322,"signalbeam":324,"skyuppercut":327,"sheercold":329,"irondefense":334,"block":335,"howl":336,"frenzyplant":338,"bulkup":339,"bounce":340,"poisontail":342,"covet":343,"magicalleaf":345,"watersport":346,"calmmind":347,"dragondance":349,"shockwave":351,"doomdesire":353,"psychoboost":354,"roost":355,"gravity":356,"miracleeye":357,"wakeupslap":358,"gyroball":360,"healingwish":361,"brine":362,"naturalgift":363,"tailwind":366,"acupressure":367,"metalburst":368,"payback":371,"assurance":372,"embargo":373,"fling":374,"psychoshift":375,"trumpcard":376,"healblock":377,"wringout":378,"powertrick":379,"gastroacid":380,"luckychant":381,"mefirst":382,"copycat":383,"powerswap":384,"guardswap":385,"punishment":386,"lastresort":387,"worryseed":388,"suckerpunch":389,"toxicspikes":390,"heartswap":391,"aquaring":392,"magnetrise":393,"forcepalm":395,"rockpolish":397,"switcheroo":415,"gigaimpact":416,"nastyplot":417,"avalanche":419,"mudbomb":426,"mirrorshot":429,"rockclimb":431,"defog":432,"trickroom":433,"rockwrecker":439,"magnetbomb":443,"captivate":445,"stealthrock":446,"grassknot":447,"chatter":448,"judgment":449,"attackorder":454,"defendorder":455,"healorder":456,"roaroftime":459,"spacialrend":460,"lunardance":461,"crushgrip":462,"magmastorm":463,"darkvoid":464,"seedflare":465,"ominouswind":466,"shadowforce":467,"honeclaws":468,"wideguard":469,"guardsplit":470,"powersplit":471,"wonderroom":472,"venoshock":474,"autotomize":475,"ragepowder":476,"telekinesis":477,"magicroom":478,"flameburst":481,"quiverdance":483,"heavyslam":484,"synchronoise":485,"electroball":486,"soak":487,"coil":489,"simplebeam":493,"entrainment":494,"afteryou":495,"round":496,"echoedvoice":497,"chipaway":498,"storedpower":500,"quickguard":501,"allyswitch":502,"shellsmash":504,"healpulse":505,"hex":506,"skydrop":507,"shiftgear":508,"incinerate":510,"quash":511,"acrobatics":512,"reflecttype":513,"retaliate":514,"finalgambit":515,"bestow":516,"waterpledge":518,"firepledge":519,"grasspledge":520,"workup":526,"dualchop":530,"heartstamp":531,"heatcrash":535,"leaftornado":536,"steamroller":537,"cottonguard":538,"psystrike":540,"headcharge":543,"geargrind":544,"searingshot":545,"technoblast":546,"relicsong":547,"secretsword":548,"glaciate":549,"boltstrike":550,"blueflare":551,"freezeshock":553,"iceburn":554,"vcreate":557,"fusionflare":558,"fusionbolt":559,"matblock":561,"belch":562,"rototiller":563,"stickyweb":564,"phantomforce":566,"trickortreat":567,"nobleroar":568,"iondeluge":569,"forestscurse":571,"disarmingvoice":574,"partingshot":575,"topsyturvy":576,"craftyshield":578,"flowershield":579,"grassyterrain":580,"mistyterrain":581,"electrify":582,"fairywind":584,"fairylock":587,"kingsshield":588,"playnice":589,"confide":590,"diamondstorm":591,"steameruption":592,"hyperspacehole":593,"spikyshield":596,"aromaticmist":597,"eerieimpulse":598,"venomdrench":599,"powder":600,"geomancy":601,"magneticflux":602,"happyhour":603,"electricterrain":604,"celebrate":606,"holdhands":607,"babydolleyes":608,"holdback":610,"poweruppunch":612,"oblivionwing":613,"thousandarrows":614,"thousandwaves":615,"landswrath":616,"lightofruin":617,"originpulse":618,"precipiceblades":619,"dragonascent":620,"hyperspacefury":621,"zippyzap":729,"splishysplash":730,"floatyfall":731,"pikapapow":732,"bouncybubble":733,"buzzybuzz":734,"sizzlyslide":735,"glitzyglow":736,"baddybad":737,"sappyseed":738,"freezyfrost":739,"sparklyswirl":740,"veeveevolley":741,"doubleironbash":742,"clangoroussoul":775,"decorate":777,"drumbeating":778,"snaptrap":779,"pyroball":780,"behemothblade":781,"behemothbash":782,"branchpoke":785,"overdrive":786,"strangesteam":790,"lifedew":791,"obstruct":792,"falsesurrender":793,"meteorassault":794,"eternabeam":795,"steelbeam":796,"expandingforce":797,"steelroller":798,"meteorbeam":800,"shellsidearm":801,"mistyexplosion":802,"terrainpulse":805,"burningjealousy":807,"poltergeist":809,"corrosivegas":810,"coaching":811,"junglehealing":816,"wickedblow":817,"surgingstrikes":818,"thundercage":819,"dragonenergy":820,"freezingglare":821,"fierywrath":822,"thunderouskick":823,"glaciallance":824,"astralbarrage":825,"eeriespell":826,"powershift":829,"springtidestorm":831,"mysticalpower":832,"chloroblast":835,"mountaingale":836,"victorydance":837,"esperwing":840,"bittermalice":841,"shelter":842,"triplearrows":843,"infernalparade":844,"ceaselessedge":845,"bleakwindstorm":846,"wildboltstorm":847,"sandsearstorm":848,"lunarblessing":849,"takeheart":850,"terablast":851,"silktrap":852,"axekick":853,"lastrespects":854,"orderup":856,"spicyextract":858,"spinout":859,"icespinner":861,"glaiverush":862,"revivalblessing":863,"tripledive":865,"doodle":867,"filletaway":868,"psyblade":875,"hydrosteam":876,"ruination":877,"collisioncourse":878,"electrodrift":879,"shedtail":880,"chillyreception":881,"tidyup":882,"snowscape":883,"hyperdrill":887,"ragefist":889,"doubleshock":892,"comeuppance":894,"blazingtorque":896,"wickedtorque":897,"noxioustorque":898,"combattorque":899,"magicaltorque":900,"bloodmoon":901,"ivycudgel":904,"electroshot":905,"terastarstorm":906,"burningbulwark":908,"thunderclap":909,"mightycleave":910,"tachyoncutter":911,"hardpress":912,"dragoncheer":913,"temperflare":915,"supercellslam":916,"upperhand":918,"malignantchain":919};
let MVJR=null;
const mvNameEn=n=>{const k=nrm(n),id=MVK[k];if(id===0)return'まもる';if(id&&MV[id])return MV[id][0];
  const id2=MVEN[k];if(id2){MVJR=MVJR||Object.fromEntries(Object.entries(MVJ).map(([a,b])=>[b,a]));if(MVJR[id2])return MVJR[id2]}return n};
const itNameEn=n=>{const k=nrm(n);return itemJa(k)||ITEMN[k]||n};
const abNameEn=n=>{const k=ABK[nrm(n)];return k&&ABN[k]||n};
const natNameEn=(u,d)=>{const f=x=>STI[nrm(x).replace(/^spatk$/,'sp.atk').replace(/^spdef$/,'sp.def')]??-1;const r=natName(f(u),f(d));return r?r.replace(/（.*$/,''):'補正なし'};
function oppPredict(myNos,opNos){
  if(opNos.length<=PICK())return{w:opNos.map(()=>1),top:[{c:opNos.map((_,j)=>j),p:1}],lead:null,P:null};
  const P=analyze(opNos,myNos,n=>detSet(byNo[n]),n=>detSet(byNo[n]));
  const mx=P.full[0].s,ex=P.full.map(x=>Math.exp((x.s-mx)/.06)),tot=ex.reduce((a,b)=>a+b,0);
  const pr=P.full.map((x,i)=>({c:x.c,p:ex[i]/tot}));
  const w=opNos.map((_,j)=>pr.reduce((a,x)=>a+(x.c.includes(j)?x.p:0),0));
  return{w,top:pr.slice(0,3),lead:P.lead,P};
}
function oppSetHTML(no){
  const d=LIVE.csv[no];
  if(!d)return `<div class="row-s" style="color:var(--mute)">集計データなし（自動で決めた型で計算）</div>`;
  const pc=x=>`<span style="color:var(--mute)">${Math.round(x)}%</span>`;
  const it=d.it.slice(0,2).map(([n,v])=>`${itNameEn(n)} ${pc(v)}`).join('・');
  const ab=d.ab.slice(0,1).map(([n,v])=>`${abNameEn(n)} ${pc(v)}`).join('');
  const mv=d.mv.slice(0,4).map(([n,v])=>`${mvNameEn(n)} ${pc(v)}`).join('・');
  const sp=d.sp[0],nt=d.nat[0];
  return `<div class="row-s">${[it,ab].filter(Boolean).join('　')}</div><div class="row-s">${mv}</div>${sp?`<div class="row-s" style="color:var(--mute)">${spLine(sp[0])}${nt?`（${natNameEn(nt[0],nt[1])}）`:''} ${Math.round(sp[1])}%</div>`:''}`;
}
function asDataLine(nos){
  const n=nos.filter(x=>LIVE.csv[x]).length;
  if(LIVE.st==='ready')return `型の想定：ラダー集計の最も多い型（${n}/${nos.length}匹分取得）。足りない分は自動で決めた型です。`;
  if(LIVE.st==='fail')return '型の想定：ラダー集計を取得できなかったため、自動で決めた型で計算しています。';
  return '型の想定：ラダー集計を取得しています…';
}
let asTok=0;
async function asFetch(){
  const tok=++asTok;
  if(!(await liveInit()))return asDraw();
  const need=[...team.map(x=>x.no),...opp6].filter(n=>LIVE.csv[n]===undefined);
  if(!need.length)return;
  await Promise.all(need.map(liveMon));
  if(tok===asTok&&keyOf(cur)==='assist')asDraw();
}
function asDraw(){
  const el=document.getElementById('as-res');if(!el)return;
  const cnt=document.getElementById('as-cnt');if(cnt)cnt.textContent=`${opp6.length}/6`;
  document.getElementById('as-opp').innerHTML=opp6.length?`<div class="aopp">${opp6.map(n=>`<span class="aop"><button class="aopi" data-info="${n}" aria-label="${byNo[n].n}の相性"><span class="av">${stamp(byNo[n])}</span><b>${byNo[n].n}</b></button><button class="aox" data-rm="${n}" aria-label="${byNo[n].n}を外す">${SVG(I.x,16)}</button></span>`).join('')}</div><div style="padding:6px 16px 0;text-align:right"><button class="bback" id="as-clear" style="padding:0">すべて外す</button></div>`:'';
  {const w=document.getElementById('as-pipw');if(w)w.hidden=!opp6.length}
  {const bx=document.getElementById('pip-box');if(bx&&PIP.vid&&!bx.contains(PIP.vid))bx.appendChild(PIP.vid)}
  pipUI();if(opp6.length)pipSchedule();
  if(team.length<4){el.innerHTML=`<div class="bnote" style="margin-top:20px"><b>先にあなたのパーティを登録してください</b><br>選出を考えるには、4〜6匹の登録が必要です（いま${team.length}匹）。</div><div class="btns"><a class="btn btn-p" href="#/team">パーティを登録する</a></div>`;return}
  if(!opp6.length){el.innerHTML=`<p class="empty" style="padding:36px 24px">対戦前の画面に出る<b>相手の6匹</b>を、上の欄から入れてください。<br>1匹入れるごとに結果が更新されます。</p>`;return}
  const myNos=team.map(x=>x.no),PR=oppPredict(myNos,opp6),A=analyze(myNos,opp6,null,null,PR.w);
  const pIdx=PR.top[0].c,pNos=pIdx.map(j=>opp6[j]),A2=opp6.length>PICK()?analyze(myNos,pNos):null;
  const same=A2&&A2.best.map(i=>myNos[i]).sort().join()===A.best.map(i=>myNos[i]).sort().join();
  const pct=v=>Math.round(v*100);
  const predRows=opp6.map((n,j)=>({n,j,w:PR.w[j]})).sort((a,b)=>b.w-a.w).map(x=>{const p=byNo[x.n],lead=PR.lead&&PR.lead.includes(x.j);
    return `<div class="row" style="align-items:flex-start;content-visibility:visible"><span class="av">${stamp(p)}</span><div class="row-m"><div class="row-t">${nm(p)}${lead?'<span class="atag on">先発予想</span>':''}</div>${oppSetHTML(x.n)}</div><div class="row-n"><b style="color:${x.w>=.7?'var(--w2)':x.w>=.4?'var(--fg)':'var(--mute)'}">${opp6.length>PICK()?pct(x.w)+'%':'—'}</b><span>選出予想</span></div></div>`}).join('');
  const predHTML=`<div class="sec"><h2>相手の予想</h2><span style="font-size:13px;color:var(--dim)">よくある型と選出</span></div>
  ${opp6.length>PICK()?`<p class="note" style="padding-top:0">相手から見て有利な${PICK()}匹を計算した<b>予想</b>です。いちばん可能性が高いのは <b>${pNos.map(n=>byNo[n].n).join('・')}</b>${PR.top[1]&&PR.top[1].p>PR.top[0].p*.6?'ですが、ほかの組み合わせとの差は小さく、<b>読みにくい相手</b>です':''}。</p>`:'<p class="note" style="padding-top:0">相手を${PICK()+1}匹以上入れると、相手が出してきそうな${PICK()}匹を予想します。</p>'}
  ${predRows}
  ${A2&&!same?`<div class="bnote" style="margin:10px 16px 0"><b>予想どおり ${pNos.map(n=>byNo[n].n.slice(0,4)).join('・')} で来た場合</b>のおすすめは<br><b>${A2.lead.map(i=>A2.M[i].p.n).join('・')}</b>（先発）＋ ${A2.back.map(i=>A2.M[i].p.n).join('・')} です。上のおすすめは、読みが外れた場合も考えた選出です。</div>`:''}
  <p class="note" style="color:var(--mute)">相手はあなたの育成を知らないため、予想では「あなたのポケモンもよくある型」として計算しています。％は計算上の目安で、実際の選出率ではありません。</p>`;
  const covered=A.O.filter((_,j)=>A.best.some(i=>A.D[i][j].pct>=50)).length;
  const mrow=(i,tag)=>{const m=A.M[i];return `<a class="row" href="#/p/${m.p.base||m.p.no}"><span class="av">${stamp(m.p)}</span><div class="row-m"><div class="row-t">${m.p.n}<span class="atag ${tag==='先発'?'on':''}">${tag}</span></div><div class="row-s">${asReason(A,i)}</div></div></a>`};
  const threats=A.O.map((o,j)=>({o,j,hit:A.best.filter(i=>A.R[j][i].pct>=70).length,sum:A.best.reduce((a,i)=>a+Math.min(A.R[j][i].pct,150),0)})).sort((a,b)=>b.sum-a.sum).slice(0,3);
  const thr=threats.map(t=>{const top=A.best.map(i=>({i,r:A.R[t.j][i]})).sort((a,b)=>b.r.pct-a.r.pct)[0];
    const faster=A.best.filter(i=>!A.fast[i][t.j]).length;
    return `<div class="row"><span class="av">${stamp(t.o.p)}</span><div class="row-m"><div class="row-t">${t.o.p.n}</div><div class="row-s">${t.hit?`選出のうち${t.hit}匹に大ダメージ`:'大きな脅威ではない'}${top.r.mv?`（${A.M[top.i].p.n}に${top.r.mv.n}で約${Math.round(top.r.pct)}%）`:''}。${faster?`${faster}匹より速い`:'選出の全員が先に動ける'}</div></div><button class="binfo" style="position:static;flex:none" data-info="${(t.o.p.base||t.o.p.no)}">相性</button></div>`}).join('');
  const cell=(d,mode)=>{const p=Math.round(d.pct);const c=mode==='atk'?(p>=100?'g3':p>=50?'g2':p>=25?'g1':''):(p>=100?'r3':p>=50?'r2':p>=25?'r1':'');return `<td class="${c}">${p>=100?'100+':p}</td>`};
  const hm=`<table class="hm"><tr><th></th>${A.O.map(o=>`<th title="${o.p.n}"><span class="av">${stamp(o.p)}</span>${o.p.n.slice(0,3)}</th>`).join('')}</tr>${A.M.map((m,i)=>`<tr class="${A.best.includes(i)?'on':''}"><th>${shortN(m.p.n)}</th>${A.O.map((o,j)=>cell(asMode==='atk'?A.D[i][j]:A.R[j][i],asMode)).join('')}</tr>`).join('')}</table>`;
  const alt=A.all.slice(1).map(x=>`<div class="row"><div class="row-m"><div class="row-t" style="font-size:14px">${x.c.map(i=>A.M[i].p.n).join('・')}</div><div class="row-s">評価 ${Math.round(x.s*100)}（おすすめは ${Math.round(A.all[0].s*100)}）</div></div></div>`).join('');
  el.innerHTML=`<div class="sec"><h2>おすすめ選出</h2><span style="font-size:13px;color:var(--dim)">${FMTN()}・先発${LEADN()}匹＋控え${PICK()-LEADN()}匹</span></div>
  ${A.lead.map(i=>mrow(i,'先発')).join('')}${A.back.map(i=>mrow(i,'控え')).join('')}
  <p class="note">この${A.best.length}匹で、相手${A.O.length}匹のうち<b>${covered}匹</b>に推定50%以上のダメージを与えられます。${opp6.length>PICK()?'相手が<b>出してきそうなポケモンほど重く見て</b>選んでいます。':''}</p>
  ${FMT==='double'?`<div class="btns"><button class="btn btn-p" id="as-sim" ${opp6.length<4?'disabled':''}>${SVG(I.zap,17)}この選出で模擬戦</button></div>`:''}
  ${FMT==='double'&&opp6.length<4?'<p class="note" style="padding-top:0">模擬戦は相手を4匹以上入れると使えます。</p>':''}
  ${asAdviceHTML(A,PR)}
  ${predHTML}
  <div class="sec"><h2>警戒する相手</h2></div>${thr}
  <div class="sec"><h2>ダメージの目安</h2></div>
  <div class="pills" style="padding-top:0"><button class="pill" data-hm="atk" aria-pressed="${asMode==='atk'}">与えるダメージ</button><button class="pill" data-hm="def" aria-pressed="${asMode==='def'}">受けるダメージ</button></div>
  <p class="note" style="padding-top:4px">${asMode==='atk'?'縦があなた、横が相手。あなたの一番強い技で、相手のHPを何%削れるかの目安です。':'縦があなた、横が相手。相手の一番強い技で、あなたのHPを何%削られるかの目安です。'}色の濃い行がおすすめ選出です。</p>
  <div style="overflow-x:auto;padding:0 16px">${hm}</div>
  ${alt?`<div class="sec"><h2>ほかの候補</h2></div>${alt}`:''}
  ${srcLine('ladder','calc')}<p class="note" style="color:var(--dim);padding-bottom:10px">${asDataLine([...myNos,...opp6])}<br>ダメージは乱数の中央付近・天気なし・1対1で計算した目安です。相手が実際に何を持っているかで変わります。</p>`;
  const sim=document.getElementById('as-sim');
  if(sim)sim.onclick=()=>{
    if(opp6.length<4)return;
    const sets={};myNos.forEach(n=>sets[n]=mySetFor(n));
    const osets={};opp6.forEach(n=>osets[n]=LIVE.csv[n]?buildSet(byNo[n],LIVE.csv[n],false):chooseSet(byNo[n]));
    B={phase:'pick',my:{name:'あなたのパーティ',nos:myNos,src:'own'},mySets:sets,opT:{name:'入力した相手',nos:[...opp6],sets:osets},sel:[...A.lead,...A.back].map(i=>myNos[i])};
    nav('#/battle');
  };
}
function assistView(arg){
  setHeader('選出アシスト','#/tools');
  V.innerHTML=`<div id="as-root"><div class="fmtbar"><span>対戦の形式</span>${fmtSwitch()}</div><p class="note" style="padding-top:4px">対戦前の画面で見える<b>相手の6匹</b>を入れると、あなたのパーティから<b>出すべき${PICK()}匹と先発</b>を出します（${FMTN()}）。実戦中にスマホを横に置いて使う想定です。</p>
  <div class="sec" style="padding-top:16px"><h2>相手の6匹</h2><span id="as-cnt" style="font:700 15px Inter,sans-serif;color:var(--dim)">${opp6.length}/6</span></div>
  <div id="as-opp"></div>

  <div class="pipwrap" id="as-pipw" hidden><div class="pipt"><b>バトル中にPiPで見る</b><span class="atag on" style="margin-left:6px">β</span></div>
  <p class="vcap" style="margin:4px 0 10px">選んだカードを動画にして、PiP（ピクチャ・イン・ピクチャ）でゲームの上に浮かべます。<b>再生中は自動で次のカード、一時停止でそのカードに止まります</b>。</p>
  <div class="pipset"><div class="mx2" style="margin-bottom:6px">おすすめ</div><div class="pills" style="padding:0 0 10px"><button class="pill" data-pp="jissen">実戦</button><button class="pill" data-pp="hajime">はじめて</button></div>
  <div class="mx2" style="margin-bottom:6px">表示するカード（押した順に並びます）</div><div class="pills pcards" style="padding:0 0 10px;flex-wrap:wrap" id="pip-cards"></div>
  <div class="mx2" style="margin-bottom:6px">切り替えの間隔</div><div class="pills" style="padding:0 0 12px" id="pip-sec">${[3,4,6,8].map(n=>`<button class="pill" data-ps="${n}">${n}秒</button>`).join('')}</div></div>
  <div class="btns" style="padding:0 0 8px"><button class="btn btn-a" id="as-pip" disabled>カードを準備中…</button></div>
  <div id="pip-box"></div><p class="vcap" id="pip-msg"></p></div>
  <a class="row" href="#/tap" style="margin-top:10px;border-top:1px solid var(--line)"><div class="row-m"><div class="row-t">背面タップで相手を入力（β）</div><div class="row-s">ゲームを開いたまま、背中を2回たたくだけで相手の弱点を通知で表示</div></div><span class="chev">${SVG(I.chev,18)}</span></a>  
  <div class="srch" style="margin-top:10px">${SVG(I.search,18)}<input id="as-q" placeholder="相手のポケモン名（ひらがなOK）" autocomplete="off" enterkeyhint="done" aria-label="相手のポケモン名"></div>
  <div id="as-sg"></div>
  <div id="as-res"></div></div>`;
  const q=document.getElementById('as-q'),sg=document.getElementById('as-sg');
  const sug=()=>{const t=q.value.trim();const l=t?P.filter(p=>nmHit(p,t)&&!opp6.includes(p.no)).slice(0,6):[];
    sg.innerHTML=l.map(p=>`<button class="row" data-add="${p.no}" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line);text-align:left;color:inherit;font-family:inherit"><span class="av" style="width:40px;height:40px">${stamp(p)}</span><div class="row-m"><div class="row-t">${nm(p)}</div><div class="chips">${p.t.map(chip).join('')}</div></div></button>`).join('')||(t?'<p class="empty" style="padding:16px">見つかりません</p>':'')};
  const add=n=>{if(opp6.length>=6){toast('相手は6匹までです');return}if(!opp6.includes(n)){opp6.push(n);saveOpp6()}q.value='';sug();asDraw();asFetch();q.focus()};
  q.oninput=sug;
  q.onkeydown=e=>{if(e.key==='Enter'){const f=P.find(p=>nmHit(p,q.value.trim())&&!opp6.includes(p.no));if(f)add(f.no)}};
  document.getElementById('as-root').addEventListener('click',e=>{
    const a=e.target.closest('[data-add]');if(a){add(+a.dataset.add);return}
    const r=e.target.closest('[data-rm]');if(r){opp6=opp6.filter(n=>n!==+r.dataset.rm);saveOpp6();asDraw();return}
    const inf=e.target.closest('[data-info]');if(inf){e.preventDefault();openSheet({no:+inf.dataset.info});return}
    if(e.target.closest('#as-clear')){opp6=[];saveOpp6();asDraw();return}
    if(e.target.closest('#as-pip')){pipStart();return}
    const pp=e.target.closest('[data-pp]');if(pp){PIP.cfg.cards=[...PPRESET[pp.dataset.pp]];pipSave();pipSetUI();pipSchedule();return}
    const pc=e.target.closest('[data-pc]');if(pc){const c=pc.dataset.pc,a=PIP.cfg.cards,i=a.indexOf(c);if(i>=0){if(a.length>1)a.splice(i,1)}else a.push(c);pipSave();pipSetUI();pipSchedule();return}
    const ps=e.target.closest('[data-ps]');if(ps){PIP.cfg.sec=+ps.dataset.ps;pipSave();pipSetUI();pipSchedule();return}
    const h=e.target.closest('[data-hm]');if(h){asMode=h.dataset.hm;asDraw()}
  });
  PIP.mode='battle';
  asDraw();asFetch();
  bindFmt(document.getElementById('as-root'),()=>assistView());
  if(arg==='pip')setTimeout(()=>{const w=document.getElementById('as-pipw');
    if(w&&!w.hidden)w.scrollIntoView({behavior:'smooth',block:'start'});else toast('先に相手のポケモンを入れると、PiPが使えるようになります')},350);
}


