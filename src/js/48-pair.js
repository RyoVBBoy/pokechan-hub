/* ===================== このポケモンから組む（相性のいい仲間を、理由つきで1匹ずつ選ぶ） 2026/11/04 =====================
   依頼主の資料「相性のいい組み合わせが成立する論理（シナジーの深層）」の考え方を点数にした（文章はサイトの言葉で書く）：
   ① 縦の相性補完：仲間の弱点を、半減より「無効」で受けられる方を高く。お互いの弱点を受け合えるか。3匹の耐性ループ
      （ほのお・みず・くさ／はがね・ドラゴン・フェアリー）。同じ弱点が重なるのは減点。
   ② 役割集中：同じ側（物理／特殊）の高火力アタッカーを並べ、同じ受け役を2匹で削り切る。
   ③ 対面操作：交代技（とんぼがえり等）。遅くて硬い交代役 → 火力は高いが打たれ弱いエースを無傷で出す。速い交代役 → 上から削って引く。
   ④ 展開リレー：場づくり役（ステルスロック・壁・あくび等）→ 積み技を持つエース。
   ほかに：仲間が苦手な相手（monCounters）に強いか、天気の作る側／使う側（晴れでみず技が半減になる効果も）。
   いまのパーティ（team）を土台に、空いている枠の候補を出す。「パーティに入れる」でその場で追加して、候補を作り直す。 */
const PR_KEY=(()=>{let m=null;return k=>{if(!m){m={};Object.keys(MD).forEach(id=>{m[MD[id][3]]=+id})}return m[k]}})();
const prKnows=(p,keys)=>{const l=LSD[p.no]||LSD[p.base]||null;if(!l)return[];return keys.filter(k=>{const id=PR_KEY(k);return id&&l[1].includes(id)})};
const PR_PIV=['uturn','voltswitch','flipturn','partingshot','teleport'];
const PR_SETUP=['swordsdance','dragondance','nastyplot','calmmind','bulkup','quiverdance','shellsmash','shiftgear','bellydrum','coil','victorydance','tidyup'];
const PR_FIELD=['stealthrock','spikes','toxicspikes','stickyweb','reflect','lightscreen','auroraveil','yawn'];
const PR_WX={drought:['はれ','ほのお',['chlorophyll','solarpower','protosynthesis']],drizzle:['あめ','みず',['swiftswim','raindish','hydration']],sandstream:['すなあらし',null,['sandrush','sandforce']],snowwarning:['ゆき','こおり',['slushrush']]};
const PR_LOOPS=[['ほのお','みず','くさ'],['はがね','ドラゴン','フェアリー']];
/* パーティの1匹を計算用の姿に（メガストーンを持っていればメガシンカ後） */
const prMon=x=>{const it=x.set&&x.set.it&&x.set.it.k;return megaOf(x.no,it)||byNo[x.no]};
/* タイプ相性は何度も使うので覚えておく（2026/11/08 こだわり条件で5案ずつ組むため速くする） */
const PR_DEFC={};
const prDef=p=>PR_DEFC[p.no]||(PR_DEFC[p.no]=(()=>{const d={};monDef(p).forEach(x=>{d[x.t]=x.m});return d})());
const prAbs=p=>(ABD[p.no]||ABD[p.base]||[]).map(a=>a[0]).concat(p.ab?[p.ab]:[]);
const prAtk=p=>Math.max(p.s[1],p.s[3]),prPhys=p=>p.s[1]>=p.s[3];
const prBulk=p=>p.s[0]*(p.s[2]+p.s[4])/2;
const prFrailAce=p=>prAtk(p)>=115&&prBulk(p)<80*80;
const prSlowWall=p=>prBulk(p)>=95*95&&p.s[5]<=75;
let PR_CT={};
const prThreats=p=>PR_CT[p.no]||(PR_CT[p.no]=(()=>{try{const c=monCounters(p);return[...c.ohko,...c.strong].slice(0,4).map(r=>r.q)}catch(e){return[]}})());
/* 1匹の候補の点数と理由 */
function prScore(c,mem){
  const R=[],add=(k,pts,txt)=>R.push({k,pts,txt});
  const cd=prDef(c),cn=formInfo(c).base;
  /* ① 縦の相性補完 */
  mem.forEach(m=>{const md=prDef(m),w=T.filter(t=>md[t]>=2);
    const imm=w.filter(t=>cd[t]===0),res=w.filter(t=>cd[t]>0&&cd[t]<=.5);
    if(imm.length||res.length){add('cover',imm.length*3+res.length*2,`${formInfo(m).base}の弱点（${[...imm,...res].join('・')}）を${imm.length?(res.length?'受けられる（'+imm.join('・')+'は無効）':'無効にできる'):'半減で受けられる'}`)}
    /* 逆向き：候補の弱点を、この仲間が受けられるか（資料：お互いに受け合う関係がいちばん強い） */
    const bImm=T.filter(t=>cd[t]>=2&&md[t]===0),bRes=T.filter(t=>cd[t]>=2&&md[t]>0&&md[t]<=.5);
    if(bImm.length||bRes.length)add('cover',bImm.length*3+bRes.length*2+((imm.length||res.length)?2:0),
      `${cn}の弱点（${[...bImm,...bRes].join('・')}）は${formInfo(m).base}が${bImm.length?'受けられる（'+bImm.join('・')+'は無効）':'半減で受けられる'}${(imm.length||res.length)?'＝お互いに受け合える':''}`)});
  /* いまのパーティで受けにくいタイプを、新しく受けられるか */
  const holes=prHoles(mem).filter(t=>cd[t]<=.5);
  if(holes.length)add('cover',2*holes.length,`いまのパーティで受けにくい${holes.join('・')}を${holes.some(t=>cd[t]===0)?'受けられる（'+holes.filter(t=>cd[t]===0).join('・')+'は無効）':'半減で受けられる'}`);
  const shared=T.filter(t=>cd[t]>=2&&mem.some(m=>prDef(m)[t]>=2)&&!mem.some(m=>prDef(m)[t]<=.5));
  if(shared.length)add('bad',-2*shared.length,`${shared.join('・')}が弱点の仲間がすでにいて、受けられる仲間がいない`);
  PR_LOOPS.forEach(L=>{const have=L.filter(t=>mem.some(m=>m.t.includes(t)));if(have.length===2){const miss=L.find(t=>!have.includes(t));if(c.t.includes(miss))add('cover',4,`${L.join('・')}の3つで、お互いの弱点を受け合う形がそろう`)}});
  /* ② 役割集中 */
  if(prAtk(c)>=110){const same=mem.filter(m=>prAtk(m)>=110&&prPhys(m)===prPhys(c));
    if(same.length===1)add('focus',1.5,`${formInfo(same[0]).base}と同じ${prPhys(c)?'物理':'特殊'}アタッカー。相手の同じ受け役を2匹で削り切れる`)}
  /* ③ 対面操作（交代技） */
  const cPiv=prKnows(c,PR_PIV),aces=mem.filter(prFrailAce),pivs=mem.filter(m=>prKnows(m,PR_PIV).length);
  if(cPiv.length){const mv=mName(PR_KEY(cPiv[0]));
    if(prSlowWall(c)&&aces.length)add('pivot',2,`硬くて遅いので、相手の攻撃を受けてから${mv}で${formInfo(aces[0]).base}を無傷で出せる`);
    else if(c.s[5]>=100)add('pivot',1.5,`速いので、上から${mv}で削ってから有利な仲間に交代できる`)}
  /* 速い交代役から、硬い仲間を安全に出す（資料：マスカーニャ＋アシレーヌ） */
  const fastPiv=mem.filter(m=>m.s[5]>=100&&prKnows(m,PR_PIV).length);
  if(fastPiv.length&&prBulk(c)>=85*85&&!prFrailAce(c))add('pivot',1.5,`${formInfo(fastPiv[0]).base}が上から交代技を使ったあと、硬い${cn}を安全に出せる`);
  if(prFrailAce(c)&&pivs.length)add('pivot',2,`${formInfo(pivs[0]).base}の交代技で、打たれ弱い${cn}を無傷で出せる`);
  /* ④ 展開リレー */
  const cField=prKnows(c,PR_FIELD),cSet=prKnows(c,PR_SETUP);
  const setAces=mem.filter(m=>prKnows(m,PR_SETUP).length&&prAtk(m)>=100),fielders=mem.filter(m=>prKnows(m,PR_FIELD).length);
  if(cField.length&&setAces.length)add('relay',2,`${cField.slice(0,2).map(k=>mName(PR_KEY(k))).join('・')}で場を整えて、${formInfo(setAces[0]).base}の積みを助けられる`);
  if(cSet.length&&prAtk(c)>=100&&fielders.length)add('relay',2,`${formInfo(fielders[0]).base}が場を整えたあと、${mName(PR_KEY(cSet[0]))}で能力を上げて攻められる`);
  /* 天気 */
  const cAb=prAbs(c);
  mem.forEach(m=>{const mAb=prAbs(m);
    Object.entries(PR_WX).forEach(([s,[w,ty,us]])=>{
      if(mAb.includes(s)&&(cAb.some(a=>us.includes(a))||(ty&&c.t.includes(ty))))add('wx',2,`${formInfo(m).base}の${w}で強くなる`);
      if(cAb.includes(s)&&(mAb.some(a=>us.includes(a))||(ty&&m.t.includes(ty))))add('wx',2,`${w}を起こして、${formInfo(m).base}を強くできる`);
      if(s==='drought'&&mAb.includes(s)&&cd['みず']>=2)add('wx',1,`晴れのあいだは、弱点のみず技のダメージが半分になる`)})});
  /* ランクバトルの集計（よく一緒に使われているポケモン・使われているか） */
  mem.forEach(m=>{const d=typeof LIVE!=='undefined'&&LIVE.csv[m.base||m.no];if(!d||!d.tm)return;
    const i=d.tm.findIndex(n=>((SP2NO[nrm(n)]||[])[0])===c.no);
    if(i>=0&&i<12)add('live',i<3?8:i<6?5:3,`ランクバトルで${formInfo(m).base}とよく一緒に使われている（${i+1}番目）`)});
  /* 上位構築でいっしょに入っていることが多い（57-topteams.js） */
  if(typeof topPair==='function')mem.forEach(m=>{const t=topPair(m.no,c.no);if(t&&t.pc>=.06&&t.lift>=1.2)add('top',t.pc>=.25?7:t.pc>=.15?5:3,`上位構築で${formInfo(m).base}といっしょに入っていることが多い（${Math.round(t.pc*100)}%）`)});
  if(typeof LIVE!=='undefined'&&LIVE.files&&LIVE.files[ENSP[c.no]])R.push({k:'pop',pts:1,txt:''});
  return{c,R};
}
/* よくある型どうしの1対1の結果を覚えておく（同じ組み合わせを何度も計算しない。集計を読んだら型が変わるので鍵に含める） */
const PR_HIT={};
function prHit(c,q){
  const k=c.no+'|'+q.no+'|'+FMT+'|'+(LIVE.csv[c.base||c.no]?1:0)+(LIVE.csv[q.base||q.no]?1:0);
  if(PR_HIT[k])return PR_HIT[k];
  const spd=m=>m.st[5]*(m.item==='choicescarf'?1.5:1);
  const me=mkMon(c,'me',detSet(c)),op=mkMon(q,'op',q.base&&byNo[q.base]?{...detSet(byNo[q.base]),ab:q.ab,item:null}:detSet(q)),a=estHit(me,op),b=estHit(op,me);
  return PR_HIT[k]={a:a.pct,mv:a.mv&&a.mv.id,b:b.pct,fast:spd(me)>spd(op)};
}
function prThreatCheck(o,mem){
  const c=o.c;
  const done=new Set();
  mem.forEach(m=>prThreats(m).forEach(q=>{if(done.has(q.no)||q.no===c.no)return;
    try{const h=prHit(c,q);
      if((h.a>=50&&h.b<50)||(h.fast&&h.a>=100)){done.add(q.no);o.R.push({k:'answer',pts:done.size<=2?2:.5,txt:`${formInfo(m).base}が苦手な${formInfo(q).base}に強い（${h.mv?mName(h.mv):'技'}で最大${Math.min(100,Math.round(h.a))}%）`})}}catch(e){}}));
}
function prRank(mem){
  const have=new Set(mem.map(m=>m.base||m.no));
  const pool=P.filter(c=>!have.has(c.no)&&!have.has(c.base));
  let out=pool.map(c=>prScore(c,mem));
  const sum=o=>o.R.reduce((t,r)=>t+r.pts,0)+(o.c.bst-500)/60;
  out.sort((a,b)=>sum(b)-sum(a));
  out.slice(0,40).forEach(o=>prThreatCheck(o,mem));
  out.forEach(o=>{o.score=sum(o)});out.sort((a,b)=>b.score-a.score);
  return out;
}
/* いまのパーティで受けにくいタイプ（2匹以上が弱点で、半減以下で受けられる仲間がいない） */
const prHoles=mem=>T.filter(t=>mem.filter(m=>prDef(m)[t]>=2).length>=2&&!mem.some(m=>prDef(m)[t]<=.5));
const PR_TAG={top:'上位構築',live:'よく一緒',cover:'補完',answer:'対策',focus:'役割集中',pivot:'交代',relay:'場づくり',wx:'天気',bad:'注意'};
let PR_N=8;
/* 表示の切りかえ：list＝相性のいい順／kd＝こだわり条件で組む（58-kodawari.js の kdPanel） */
let PR_MODE=(()=>{try{return sessionStorage.getItem('pcprmode')||'list'}catch(e){return 'list'}})();
const prModeHTML=()=>`<div class="pr-mode"><div class="fmtsw" role="group" aria-label="探し方"><button data-prm="list" aria-pressed="${PR_MODE==='list'}">相性のいい順</button><button data-prm="kd" aria-pressed="${PR_MODE==='kd'}">こだわり条件で組む</button></div></div>`;
const prModeBind=()=>V.querySelectorAll('[data-prm]').forEach(b=>b.onclick=()=>{PR_MODE=b.dataset.prm;try{sessionStorage.setItem('pcprmode',PR_MODE)}catch(e){}const fw=document.getElementById('fabwrap');if(fw)fw.hidden=PR_MODE==='kd'||!curGame().fab;const y=scrY();prDraw();scrTo(0,y)});
async function pairView(arg){
  setHeader('相性のいい仲間を探す','#/team');
  /* 図鑑などから「このポケモンから組む」で来たとき */
  /* #/pair/kd＝こだわり条件で組む（2026/11/08 依頼主：ツールではなくこの画面の中に） */
  if(arg==='kd')PR_MODE='kd';
  const start=+arg;
  if(start&&byNo[start]&&!team.some(x=>x.no===start)){
    if(team.length){const e=TEAMS.list.findIndex(x=>!x.team.length);
      if(e>=0)switchTeam(e);else if(!await askConfirm({title:'パーティを入れかえますか？',text:`パーティの枠がいっぱいです。「${teamName(TEAMS.cur)}」を空にして、${byNo[start].n}から組みますか？`,ok:'入れかえる',danger:false})){nav('#/pair');return}else{team=[];}}
    team.push({no:start,sel:true});saveTeam();cur='#/pair';setUrl('#/pair');
  }
  PR_N=8;prDraw();
  /* ランクバトルの集計が読めたら、よく一緒に使われている仲間も入れて作り直す */
  try{if(await liveInit()){const before=JSON.stringify(team.map(x=>x.no));await Promise.all(team.map(x=>liveMon(prMon(x).base||x.no)));if(keyOf(cur)==='pair'&&before===JSON.stringify(team.map(x=>x.no)))prDraw()}}catch(e){}
}
function prDraw(){
  const mem=team.map(prMon).filter(Boolean);
  if(!mem.length){
    V.innerHTML=`<div class="pr-empty"><p class="lead" style="padding:18px 16px 6px">使いたいポケモンを1匹選ぶと、そのポケモンと<b>相性のいい仲間</b>を、理由つきで順番に出します。こだわり条件で6匹まとめて組むこともできます。</p>
      <div class="btns"><button class="btn btn-p" id="pr-pick">${SVG(I.plus,18)}使いたいポケモンを選ぶ</button></div>
      <p class="note">選んだポケモンは、いまのパーティ（${esc(teamName(TEAMS.cur))}）に入ります。</p></div>
      ${prModeHTML()}${PR_MODE==='kd'?'<div id="kd-root"></div>':''}`;
    document.getElementById('pr-pick').onclick=async()=>{const no=await pickMon(0,{add:true});if(no){team.push({no,sel:true});saveTeam();prDraw()}};
    prModeBind();if(PR_MODE==='kd')kdPanel(document.getElementById('kd-root'));return;
  }
  const holes=prHoles(mem);
  V.innerHTML=`<div class="pr-team">${team.map((x,i)=>{const p=byNo[x.no];return `<button class="pr-m" data-rm="${i}" aria-label="${esc(p.n)}を外す"><span class="av">${stamp(p)}</span><small>${esc(formInfo(p).base)}</small><i>×</i></button>`}).join('')}${Array.from({length:6-team.length},()=>'<span class="pr-m pr-m--e"></span>').join('')}</div>
    ${team.length>=6?`<div class="bnote" style="margin:12px 16px">6匹そろいました。パーティの画面の「チェック」と「構築と選出」で、苦手な相手や選出の考え方を確かめましょう。</div><div class="btns"><a class="btn btn-p" href="#/team">パーティの画面へ</a></div>`:`
    ${holes.length?`<div class="pr-hole"><b>いまのパーティで受けにくいタイプ</b><div class="chips">${holes.map(chip).join('')}</div><small>2匹以上が弱点で、半減以下で受けられる仲間がいません。下の候補で埋められます。</small></div>`:''}
    ${prModeHTML()}
    ${PR_MODE==='kd'?'<div id="kd-root"></div>':`<div class="sec"><h2>次に入れるとよいポケモン</h2><span style="font-size:12px;color:var(--dim)">理由の多い順</span></div>
    <div id="pr-list"><p class="empty">計算中…</p></div>`}`}`;
  V.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{team.splice(+b.dataset.rm,1);saveTeam();if(typeof KD!=='undefined')KD.res=null;prDraw()});
  if(team.length>=6)return;
  prModeBind();
  if(PR_MODE==='kd'){kdPanel(document.getElementById('kd-root'));return}
  setTimeout(()=>{
    const list=prRank(mem).slice(0,PR_N),el=document.getElementById('pr-list');if(!el)return;
    el.innerHTML=list.map((o,k)=>{const c=o.c,rs=o.R.filter(r=>r.k!=='bad'&&r.txt).sort((a,b)=>b.pts-a.pts).slice(0,4),bad=o.R.filter(r=>r.k==='bad');
      return `<div class="pr-c"><a class="row" href="#/p/${c.no}"><span class="av">${stamp(c)}</span><div class="row-m"><div class="row-t">${k<3?`<span class="pr-rank">${k+1}</span>`:''}${nm(c)}</div><div class="chips">${c.t.map(chip).join('')}<span class="rt">${c.roles.join('・')}</span></div></div></a>
        <ul class="pr-why">${rs.map(r=>`<li><span class="pr-tag pr-${r.k}">${PR_TAG[r.k]}</span>${esc(r.txt)}</li>`).join('')}${bad.map(r=>`<li><span class="pr-tag pr-bad">${PR_TAG.bad}</span>${esc(r.txt)}</li>`).join('')}${!rs.length?'<li>能力の高さで選んだ候補です</li>':''}</ul>
        <div class="btns" style="padding:0 16px 12px"><button class="btn btn-s" data-add="${c.no}">${SVG(I.plus,16)}パーティに入れる</button></div></div>`}).join('')
      +`<div class="btns"><button class="btn btn-s" id="pr-more">もっと見る</button></div>
      <p class="note" style="color:var(--mute)">点数は、タイプの受け合い（無効は半減より高く）・同じ受け役を2匹で崩す並び・交代技で仲間を無傷で出す流れ・場づくりから積みエースへのリレー・天気・仲間が苦手な相手への強さから計算しています。苦手な相手は、よくある型どうしのダメージ計算です。</p>`;
    el.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{const no=+b.dataset.add;if(team.length<6&&!team.some(x=>x.no===no)){team.push({no,sel:team.filter(x=>x.sel).length<PICK()});saveTeam();toast(`${byNo[no].n}を入れました`);PR_N=8;prDraw();scrTo(0,0);if(LIVE.files)liveMon(no).then(()=>{if(keyOf(cur)==='pair')prDraw()}).catch(()=>{})}});
    document.getElementById('pr-more').onclick=()=>{PR_N+=8;prDraw()};
  },30);
}
