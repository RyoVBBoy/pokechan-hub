/* ===================== パーティ診断 ===================== */
let team=[];
/* 図鑑の見直しで番号が変わったもの（旧670フラエッテ → えいえんのはな） */
const NO_MOVED={670:10061};
/* パーティは3つまで保存できる（pcteams：{cur:いま選んでいる番号, list:[{name,team}]}）。
   いま選んでいるパーティが team（ほかの画面はすべて team を使う）。pcteam は前の版との互換のために同じ中身を入れておく */
const TEAM_N=3;
const cleanTeam=a=>(Array.isArray(a)?a:[]).map(x=>x&&NO_MOVED[x.no]?{...x,no:NO_MOVED[x.no]}:x).filter(x=>x&&(byNo[x.no]||ensureMon(x.no)));
let TEAMS=(()=>{let o=null;try{o=JSON.parse(localStorage.getItem('pcteams')||'null')}catch(e){}
  if(!o||!Array.isArray(o.list)){let old=[];try{old=JSON.parse(localStorage.getItem('pcteam')||'[]')}catch(e){}o={cur:0,list:[{name:'',team:old}]}}
  while(o.list.length<TEAM_N)o.list.push({name:'',team:[]});o.list=o.list.slice(0,TEAM_N);if(!(o.cur>=0&&o.cur<TEAM_N))o.cur=0;
  o.list.forEach(s=>{s.team=cleanTeam(s.team);s.name=String(s.name||'').slice(0,20);s.at=Math.max(0,Math.floor(+s.at||0))});return o})();
team=TEAMS.list[TEAMS.cur].team.map(x=>({...x}));
const teamName=i=>TEAMS.list[i].name||L(`パーティ${i+1}`,`Team ${i+1}`);
/* 枠ごとの変更時刻 at（2026/11/12）：中身（名前・6匹・育成）が変わった枠だけ進める。選んでいる枠を切りかえただけでは進めない
   （前は切りかえでもパーティ全体の時刻が進み、古い中身の端末がほかの端末で直した新しいパーティを上書きすることがあった）。
   中身が変わったかは、最後に保存したときの文字列 TEAM_SIG と比べる（育成をその場で書きかえる画面もあるため、中身どうしでは比べない）。
   時刻はサーバーの時計に合わせる（SYNC.skew、33-sync.js）＝端末の時計がずれていても順番がくるいにくい */
const slotSig=s=>JSON.stringify([s.name||'',s.team]);
let TEAM_SIG=TEAMS.list.map(slotSig);
const teamNow=()=>{const t=Math.round(Date.now()+(typeof SYNC!=='undefined'&&SYNC.skew||0));return Math.max(t,...TEAMS.list.map(s=>(s.at||0)+1))};
const saveTeam=fromServer=>{TEAMS.list[TEAMS.cur].team=team;
  let ch=false;
  TEAMS.list.forEach((s,i)=>{const g=slotSig(s);if(g===TEAM_SIG[i])return;TEAM_SIG[i]=g;if(fromServer!==true){s.at=teamNow();ch=true}});
  if(ch){TEAMS.updated=Math.max(TEAMS.updated||0,...TEAMS.list.map(s=>s.at||0));if(typeof teamSyncSoon==='function')teamSyncSoon()}
  /* 端末に保存できたら true（2026/11/12、育成の画面の保存の表示に使う。前は失敗しても何も返さなかった） */
  try{localStorage.setItem('pcteams',JSON.stringify(TEAMS));localStorage.setItem('pcteam',JSON.stringify(team));return true}catch(e){return false}};
function switchTeam(i){if(i===TEAMS.cur||!TEAMS.list[i])return;saveTeam();TEAMS.cur=i;team=TEAMS.list[i].team.map(x=>({...x}));saveTeam()}
/* 同じブラウザのほかのタブでパーティを変えたら、このタブの中身も読み直す（2026/11/12。前は古い中身のまま保存して、ほかのタブの変更を消していた）。
   選んでいる枠はタブごとのまま */
function teamsFromStore(v){
  let o=null;try{o=v?JSON.parse(v):null}catch(e){return}
  const src=o&&Array.isArray(o.list)?o.list:[];
  const list=src.slice(0,TEAM_N).map(s=>({name:String(s&&s.name||'').slice(0,20),team:cleanTeam(s&&s.team),at:Math.max(0,Math.floor(+(s&&s.at)||0))}));
  while(list.length<TEAM_N)list.push({name:'',team:[],at:0});
  TEAMS.list=list;TEAMS.updated=o&&+o.updated||0;
  TEAM_SIG=list.map(slotSig);team=list[TEAMS.cur].team.map(x=>({...x}));
  const k=keyOf(cur);
  if(k==='team'&&document.getElementById('slots'))teamRender();
  else if(k==='edit'||k==='share')route();
}
addEventListener('storage',e=>{if(e.storageArea===localStorage&&(e.key==='pcteams'||e.key===null))teamsFromStore(e.key===null?null:e.newValue)});
let tq='';
let TEAM_DGMODE='ready';
/* 選ぶ画面を閉じずに続けて足す（2026/11/12）。重なり・6匹の上限は addTeam と同じ決まり。描き直しは選ぶ画面を閉じたあと1回だけ（teamPickMany） */
function teamAddQuiet(no){
  const p=byNo[no];if(!p)return{ok:false,msg:'このポケモンは選べません'};
  if(team.some(x=>x.no===no))return{ok:false,msg:`${p.n}はもうパーティに入っています`};
  if(team.length>=6)return{ok:false,full:true,msg:'パーティは6匹までです'};
  team.push({no,sel:team.filter(x=>x.sel).length<PICK()});
  if(saveTeam()===false)toast('この端末に保存できませんでした');
  return{ok:true,n:team.length,max:6,full:team.length>=6};
}
async function teamPickMany(){
  if(team.length>=6){toast('パーティは6匹までです');return}
  const n0=team.length;
  await pickMon(0,{add:true,multi:teamAddQuiet,slots:()=>team.map(x=>x.no),max:6});
  if(keyOf(cur)==='team'&&document.getElementById('slots')){
    teamRender();
    const guide=document.getElementById('ai-party-start-title');
    if(guide&&team.length>n0)requestAnimationFrame(()=>{
      if(!guide.isConnected)return;
      guide.focus({preventScroll:true});
      scrTo(0,0);
    });
  }
  if(team.length>n0)toast(team.length>=6?'パーティが6匹そろいました':`${team.length-n0}匹を追加しました（${team.length}/6）`);
}
function addTeam(no){
  if(team.some(x=>x.no===no)){nav('#/team');return}
  if(team.length>=6){toast('パーティは6匹までです');return}
  team.push({no,sel:team.filter(x=>x.sel).length<PICK()});saveTeam();nav('#/team');
}
/* パーティの画面の下半分はタブで分ける（育成・チェック・構築と選出）。重い計算（構築と選出）は開いたときだけ */
/* 2026/11/12 依頼主：「構築と選出」→「構築」。中に「構築｜選出アシスト」の小さなタブ（PSUB、sessionStorage pcpsub）。キー（plan）は前と同じ */
const TTABS=[['sets','育成'],['check','チェック'],['plan','構築']];
const PSUBS=[['build','構築'],['sel','選出アシスト']];
let PSUB=(()=>{try{const v=sessionStorage.getItem('pcpsub');return v==='sel'?'sel':'build'}catch(e){return 'build'}})();
let TTAB=(()=>{try{return sessionStorage.getItem('pcttab')||'sets'}catch(e){return 'sets'}})();
function teamView(arg){
  setHeader('パーティ');
  const consult=arg==='consult'&&typeof aiUiOn==='function'&&aiUiOn(true)&&curGame().id==='pokechamp';
  if(consult)TTAB='check';
  if(arg&&arg!=='consult'){const ids=[...new Set(arg.split('-').map(Number).filter(n=>byNo[n]))].slice(0,6);
    if(ids.length){team=ids.map((no,i)=>({no,sel:i<PICK()}));saveTeam();cur='#/team';setUrl('#/team')}}
  V.innerHTML=`
  ${consult?`<section class="stg-card ai-party-start" aria-labelledby="ai-party-start-title"><h2 id="ai-party-start-title" tabindex="-1">攻略AIに相談（ベータ版）</h2>
    <p class="note">パーティの強みや、次に試す練習を相談できます。</p>
    <div id="ai-party-start-action"></div></section>`:''}
  <div class="pills tslots" id="tslots"></div><div id="tsync"></div>
  <div class="thd"><p class="note thd-n">6匹まで登録し、<b>「選出する」を押して、出す${PICK()}匹</b>を決めます（${FMTN()}）。</p><div class="tarch" id="tarch"></div></div>
  <div id="tonb"></div>
  <div class="grid3" id="slots"></div>
  <nav class="tqa" aria-label="ほかのツール">
    <a class="tqa-ext" href="#/calc" title="ダメージ計算のツールを開きます">${SVG(I.calc,16)}<span>ダメージ計算</span><span class="tqa-arr" aria-hidden="true">↗</span></a>
    ${!consult&&typeof aiUiOn==='function'&&aiUiOn(true)&&curGame().id==='pokechamp'?aiPartyShortcutHTML():''}
  </nav>
  <div class="seg" id="tt-seg" style="margin-top:8px">${TTABS.map(([k,l])=>`<button data-tt="${k}" aria-selected="${k===TTAB}">${l}</button>`).join('')}<span class="seg-i" style="width:${100/TTABS.length}%;transform:translateX(${TTABS.findIndex(x=>x[0]===TTAB)*100}%)"></span></div>
  <div id="tt-pages" class="tt-pages">
  <div data-sw data-tp="sets"${TTAB!=='sets'?' hidden':''}>
  <div id="tsteps"></div><div id="tsets"></div>
  <a class="row" href="#/pair" style="border-top:1px solid var(--line);margin-top:12px"><div class="row-m"><div class="row-t">相性のいい仲間を探す</div><div class="row-s">いまのパーティに合うポケモンを、理由つきで順番に出します。1匹から組むときにも</div></div><span class="row-n" aria-hidden="true">›</span></a>
  <a class="row" href="#/import"><div class="row-m"><div class="row-t">画像から取り込む</div><div class="row-s">ゲームのチーム画面のスクリーンショットから、技・持ち物・能力ポイントまで読み取る</div></div><span class="chev">${SVG(I.chev,18)}</span></a>
  <div class="btns">
    <button class="btn btn-p" id="shr-img">${SVG(I.share,17)}画像で共有</button><button class="btn btn-s" id="shr">URLをコピー</button>
    <button class="btn btn-s" id="clr" style="flex:none;padding:0 20px">クリア</button></div>
  <div class="btns" style="padding-top:0"><button class="btn btn-s" id="tren">${SVG(I.list,16)}このパーティの名前を変える</button></div>
  </div>
  <div data-sw data-tp="check"${TTAB!=='check'?' hidden':''}><div id="tout"></div></div>
  <div data-sw data-tp="plan"${TTAB!=='plan'?' hidden':''}><div id="tplan"></div></div>
  </div>`;
  /* タブの切りかえ：押す・左右にスワイプ。新しい中身は進む向きからすべり込む */
  const ttIdx=()=>TTABS.findIndex(x=>x[0]===TTAB),ind=V.querySelector('#tt-seg .seg-i');
  const ttGo=(k,dir)=>{if(k===TTAB)return;const from=ttIdx();TTAB=k;try{sessionStorage.setItem('pcttab',TTAB)}catch(e){}
    V.querySelectorAll('[data-tt]').forEach(x=>x.setAttribute('aria-selected',x.dataset.tt===k));ind.style.transition='';ind.style.transform=`translateX(${ttIdx()*100}%)`;
    V.querySelectorAll('[data-tp]').forEach(x=>{x.hidden=x.dataset.tp!==k;x.style.transform='';x.style.transition=''});
    /* 2026/11/15 依頼主「チェックの反応が悪い」：チェック・構築は計算に時間がかかるので、先にタブを切りかえて「計算しています」の動きを出し、
       その絵が出てから（次の描画のあと）計算する。計算の中身は同じ */
    const heavy=(k==='check'||k==='plan')&&team.length&&!['loading','error'].includes(dgState(team)),box=heavy&&document.getElementById(k==='check'?'tout':'tplan');
    if(box)box.innerHTML=ttLoadHTML(k);
    if(consult&&heavy)aiPartyStartUpdate();
    segSlideIn(V.querySelector(`[data-tp="${k}"]`),dir||(ttIdx()>from?1:-1));
    if(box)requestAnimationFrame(()=>setTimeout(()=>{if(TTAB===k&&document.getElementById('tout'))teamRender()},40));else teamRender()};
  V.querySelectorAll('[data-tt]').forEach(b=>b.onclick=()=>ttGo(b.dataset.tt));
  segSwipe(V.querySelector('#tt-pages'),{n:TTABS.length,idx:ttIdx,ind,go:(j,d)=>ttGo(TTABS[j][0],d)});
  document.getElementById('shr').onclick=shareTeam;document.getElementById('shr-img').onclick=shareTeamImage;
  document.getElementById('clr').onclick=async()=>{if(team.length&&!await askConfirm({title:'パーティをクリアしますか？',text:`「${teamName(TEAMS.cur)}」のポケモンと育成をすべて外します。この操作は取り消せません。`,ok:'クリア'}))return;team=[];saveTeam();teamRender()};
  document.getElementById('tren').onclick=()=>{const v=prompt('パーティの名前（20文字まで）',TEAMS.list[TEAMS.cur].name||teamName(TEAMS.cur));if(v==null)return;TEAMS.list[TEAMS.cur].name=v.trim().slice(0,20);saveTeam();teamRender()};
  document.getElementById('tslots').onclick=e=>{const b=e.target.closest('[data-tslot]');if(!b)return;switchTeam(+b.dataset.tslot);toast(`「${teamName(TEAMS.cur)}」に切り替えました`);teamRender()};
  TT_DEFER=true;teamRender();syncBadge();if(PCF)teamSync();
}
function tpRender(){
  const q=tq.trim(),l=P.filter(p=>!q||nmHit(p,q)).slice(0,30);
  document.getElementById('tp').innerHTML=l.length?l.map(p=>
    `<button class="row" data-no="${p.no}" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line);text-align:left;color:inherit">
      <span class="av">${stamp(p)}</span><div class="row-m"><div class="row-t">${nm(p)}</div><div class="chips">${p.t.map(chip).join('')}<span class="rt">${p.roles.join('・')}</span></div></div>
      <div class="row-n"><b>${p.bst}</b><span>合計</span></div></button>`).join('')
    :'<p class="empty">見つかりません。</p>';
  document.querySelectorAll('#tp [data-no]').forEach(b=>b.onclick=()=>addTeam(+b.dataset.no));
}
function shareTeam(){
  if(!team.length){toast('パーティが空です');return}
  /* 共有のリンク（/t/番号-番号…）。開いた人のパーティは書きかえず、見るだけの画面（#/share）になる */
  const u=shareLink(shareNos(team));
  (navigator.clipboard?navigator.clipboard.writeText(u):Promise.reject())
    .then(()=>toast('URLをコピーしました')).catch(()=>prompt('URLをコピーしてください',u));
}
/* 未設定の匹は、計算に使っている使用率の高い型の持ち物と採用率を出す（2026/11/09 依頼主） */
function tsLiveLine(x){const d=LIVE.csv[x.no];if(!d||(x.set&&x.set.it&&x.set.it.k))return '';
  let c;try{c=mySetFor(x.no)}catch(e){return ''}const k=c&&c.item;if(!k||!ITEMN[k])return '';
  const pc=(d.it.find(([n])=>nrm(n)===k)||[])[1];
  return `<div class="row-s" style="color:var(--mute)">持ち物：${esc(ITEMN[k])}${pc!=null?`（採用率${pc}%）`:''}</div>`}
/* 空のパーティのはじめ方（おすすめ＝構築の型の一覧〔型ごとに「このパーティを使う」〕・画像から取り込む・1匹ずつ選ぶ） */
function teamOnbHTML(){
  return `<section class="tonb" aria-labelledby="tonb-h"><h2 id="tonb-h">「${esc(teamName(TEAMS.cur))}」はまだ空です</h2>
    <p>はじめ方を選んでください。あとから入れかえ・育成の変更ができます。</p>
    <div class="tonb-b"><a class="btn btn-p" href="#/learn/build">${SVG(I.grid,18)}おすすめパーティから始める</a>
    <a class="btn btn-s" href="#/import">${SVG(I.image||I.share,18)}画像から取り込む</a></div>
    <button class="tonb-l" id="tonb-pick">${SVG(I.plus,16)}ポケモンを1匹ずつ選ぶ</button></section>`;
}
/* 選出のボタンの見た目だけを変える（描き直しを待たない） */
function selBtnPaint(b,on){b.classList.toggle('lit',on);b.setAttribute('aria-pressed',on);
  b.innerHTML=`${on?SVG(I.check,16):SVG('<circle cx="12" cy="12" r="7.5"/>',16)}<span>${on?L('選出','Picked'):L('選出する','Pick')}</span>`;
  const tl=b.closest('.tile');if(tl)tl.classList.toggle('on',on)}
/* 描き直しを少しあとに1回だけ（続けて押したときもまとめて1回）。そのあいだ下の中身は「更新中」でうすく */
let TEAM_RT=0;
/* 計算中の表示：動く線と、出てくる中身の形（灰色の帯）。すぐ中身に置きかわる */
let TT_DEFER=false;
function ttLoadHTML(k){return `<div class="tt-load" role="status" aria-live="polite"><div class="tt-load-bar"><i></i></div>
  <p class="tt-load-t">${k==='check'?'パーティの対面を計算しています…':'選出と構築を計算しています…'}</p>
  <div class="tt-sk tt-sk-h"></div><div class="tt-sk"></div><div class="tt-sk tt-sk-s"></div><div class="tt-sk"></div><div class="tt-sk tt-sk-s"></div></div>`}
function teamRenderSoon(){clearTimeout(TEAM_RT);['tout','tplan'].forEach(id=>{const e=document.getElementById(id);if(e)e.classList.add('t-busy')});
  TEAM_RT=setTimeout(()=>requestAnimationFrame(()=>{TEAM_RT=0;if(document.getElementById('tout'))teamRender()}),160)}
function teamRender(){
  ['tout','tplan'].forEach(id=>{const e=document.getElementById(id);if(e)e.classList.remove('t-busy')});
  const ts=document.getElementById('tslots');
  if(ts)ts.innerHTML=TEAMS.list.map((s,i)=>`<button class="pill" data-tslot="${i}" aria-pressed="${i===TEAMS.cur}"><span data-notr>${esc(teamName(i))}</span><small>${(i===TEAMS.cur?team:s.team).length}${L('匹','')}</small></button>`).join('');
  {const ta=document.getElementById('tarch');if(ta)ta.innerHTML=teamArchHTML(team)}
  /* 育成のタブでも、構築の型の札のために診断のデータを読んでおく（そろったら描き直す） */
  if(team.length>=2&&dgState(team)==='loading')dgPrepare(team,()=>{if(keyOf(cur)==='team'&&document.getElementById('tout'))teamRender()});
  document.getElementById('slots').innerHTML=Array.from({length:6},(_,i)=>{
    const x=team[i],p=x&&byNo[x.no];
    return p?`<div class="tile mon-card${x.sel?' on':''}" data-ti="${i}" style="cursor:pointer">
      ${monCardArt(p)}<button class="t-rm" data-rm="${i}" aria-label="${p.n}を外す">${SVG(I.x,16)}</button>
      <div class="nm">${nm(p,{no:false})}</div><div class="chips">${p.t.map(chip).join('')}</div>
      <button class="t-sel${x.sel?' lit':''}" data-sel="${i}" aria-label="${p.n}を選出する" aria-pressed="${x.sel}">${x.sel?SVG(I.check,16):SVG('<circle cx="12" cy="12" r="7.5"/>',16)}<span>${x.sel?L('選出','Picked'):L('選出する','Pick')}</span></button></div>`
    :`<button class="tile empty tadd" data-add="1">${SVG(I.plus,22)}<span>追加する</span></button>`}).join('');
  document.getElementById('tsets').innerHTML=team.length?`<p class="note" style="padding-top:10px">押すと、技・持ち物・能力ポイントを編集できます。</p>`+team.map((x,i)=>{const p=byNo[x.no],s=x.set;
    const sub=s&&s.sp?[`<div class="row-s">${[s.ab&&s.ab.n,s.it&&s.it.n,natName(s.up,s.dn)].filter(Boolean).map(esc).join('／')}</div>`,`<div class="row-s">${(s.mv||[]).filter(m=>m&&m.n).map(m=>esc(m.n)).join('・')}</div>`,`<div class="row-s" style="color:var(--mute)">${spLine(s.sp)}</div>`].join('')
      :`<div class="row-s" style="color:var(--mute)">${s?'能力ポイント未入力':'未設定'}（${byNo[x.no]?detSetKind(byNo[x.no]).s:'推定の型'}で計算中）</div>${tsLiveLine(x)}`;
    return `<a class="row mon-card mon-card-row" href="#/edit/${i}">${monCardArt(p)}<div class="row-m"><div class="row-t">${nm(p)}${s&&s.src==='manual'?'<span class="atag on" style="margin-left:6px">入力済み</span>':s&&s.sp?'<span class="atag" style="margin-left:6px">画像から</span>':''}</div>${sub}</div><span class="chev">${SVG(I.chev,18)}</span></a>`}).join(''):'';
  document.querySelectorAll('#slots [data-add]').forEach(b=>b.onclick=()=>teamPickMany());
  /* 空のパーティ（2026/11/12）：6つの「追加する」の代わりに、はじめ方を3つ出す。パーティが要る「診断」「選出」のボタンは隠す（ダメージ計算はパーティなしでも使えるので残す） */
  {const ob=document.getElementById('tonb'),sl=document.getElementById('slots'),em=!team.length;
    if(ob){ob.innerHTML=em?teamOnbHTML():'';const pk=ob.querySelector('#tonb-pick');if(pk)pk.onclick=()=>teamPickMany()}
    sl.hidden=em;
  }
  document.querySelectorAll('#slots .tile[data-ti]').forEach(t=>t.onclick=e=>{if(e.target.closest('button'))return;nav('#/edit/'+t.dataset.ti)});
  /* 選出する（2026/11/15 依頼主「押すとラグがある」）：押したらすぐボタンの見た目を変え、重い描き直し（診断の計算）は画面が変わったあとに1回だけ */
  document.querySelectorAll('[data-sel]').forEach(b=>b.onclick=e=>{
    /* 枠（.tile）の「押すと育成の画面へ」に届かないように。見た目を変えると押した所の要素が入れかわり、枠の側でボタンと分からなくなるため */
    e.stopPropagation();
    const x=team[+b.dataset.sel];
    if(!x.sel&&team.filter(y=>y.sel).length>=PICK()){toast(`${FMTN()}で選出できるのは${PICK()}匹までです`);return}
    x.sel=!x.sel;selBtnPaint(b,x.sel);saveTeam();teamRenderSoon()});
  document.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{team.splice(+b.dataset.rm,1);saveTeam();teamRender()});

  {const st=document.getElementById('tsteps');if(st){st.innerHTML=teamStepsHTML();teamStepsBind(st)}}
  const out=document.getElementById('tout'),pl=document.getElementById('tplan');
  if(typeof aiPartyStartUpdate==='function')aiPartyStartUpdate();
  if(!team.length){out.innerHTML=pl.innerHTML='<p class="empty">上の「追加する」からポケモンを入れると、チェックと構築・選出の考え方が出ます。</p>';return}
  /* 診断に使うデータがそろうまで計算しない（2026/11/12、60-diag.js の dgState）。そろったら描き直す。古い読み込みの結果では描き直さない（dgPrepare の番号） */
  /* 画面を開いたときも、チェック・構築なら先に「計算しています」を出してから計算する */
  /* データを読み込み中・読めないときは前と同じ「読み込んでいます」を出す（計算中の表示は、データがそろって計算だけが残っているときだけ） */
  if(TT_DEFER&&(TTAB==='plan'||TTAB==='check')&&!['loading','error'].includes(dgState(team))){TT_DEFER=false;(TTAB==='check'?out:pl).innerHTML=ttLoadHTML(TTAB);(TTAB==='check'?pl:out).innerHTML='';
    requestAnimationFrame(()=>setTimeout(()=>{if(document.getElementById('tout'))teamRender()},40));return}
  TT_DEFER=false;
  if(TTAB==='plan'||TTAB==='check'){const st=dgState(team),tgt=TTAB==='plan'?pl:out;
    if(st==='error'&&typeof evCount==='function')evCount('diag_ng',JSON.stringify([team.map(x=>x.no),dgFails()]));
    if(st==='loading'||st==='error'){tgt.innerHTML=dgWaitHTML(st);(TTAB==='plan'?out:pl).innerHTML='';dgWaitBind(tgt,teamRender);
      if(st==='loading')dgPrepare(team,()=>{if(keyOf(cur)==='team'&&document.getElementById('tout'))teamRender()});
      return}
    TEAM_DGMODE=st}
  if(TTAB==='plan'){pl.innerHTML=dgModeNote(TEAM_DGMODE)+planHTML(team);planBind(pl);dgWaitBind(pl,teamRender)}
  if(TTAB!=='check'){out.innerHTML='';return}
  const C=partyCheck(team);
  /* 操作の回数（2026/11/12）：診断を出したら数える。同じパーティ・同じデータ・同じ形式は1回（描き直し・タブの切りかえでは増えない） */
  if(typeof evCount==='function')evCount('diag_done',JSON.stringify([team.map(x=>[x.no,x.set||0,!!x.sel]),dgDataSig(),TEAM_DGMODE]));
  /* 2026/11/10 UI改善 第2段階：カードの形は 63-diag-ui.js の dguCard（重要度・起きる相手・理由・改善・計算根拠をたたむ） */
  const swOf=x=>`${x.sw&&x.sw.length?`<div class="pc-sws">${x.sw.map(w=>`<div class="pc-sw"><span><b>${esc(w.out.p.n)}</b> → <a href="#/p/${w.inP.no}">${esc(w.inP.n)}</a>${w.inX?'<small>選出を付けかえ</small>':''}${w.set?`<small class="pc-swc"><b>計算に使った${esc(w.inP.n)}の育成</b>（${esc(byNo[w.out.x.no].n)}の持ち物・技は引きつがない）：${esc(w.set)}</small>`:''}${w.cb&&typeof dguChgHTML==='function'?dguChgHTML(w.cb,w.ca,{title:'入れかえた6匹で計算し直した数',note:w.cnote}):w.calc?`<small class="pc-swc">${esc(w.calc)}</small>`:''}${w.up?`<small class="pc-swc pc-up"><b>良くなる：</b>${w.up.length?w.up.map(esc).join('／'):'なし'}</small><small class="pc-swc pc-dn"><b>悪くなる：</b>${w.dn.length?w.dn.map(esc).join('／'):'なし'}</small>`:''}</span><button class="bback" data-psw="${team.indexOf(w.out.x)}:${w.inX?'x'+team.indexOf(w.inX):w.inP.no}">入れかえる</button></div>`).join('')}</div>`:''}`,chOf=x=>`${x.c&&x.c.length?`<div class="pills gchips" style="padding:6px 0 0">${x.c.map(p=>`<a class="pill gchip" href="#/p/${p.no}">${esc(formInfo(p).base)}${formInfo(p).tag?'（'+esc(formInfo(p).tag)+'）':''}</a>`).join('')}</div>`:''}`;
  const item=(x,bad)=>typeof dguCard==='function'?dguCard(x,bad,swOf(x),chOf(x)):`<div class="pc-i ${bad?'pc-fix':'pc-ok'}${x.sev&&bad?' pc-s'+x.sev:''}"${x.id?` id="${x.id}"`:''}><b>${bad?'！':'✓'} ${x.area?`<span class="pc-area">${esc(x.area)}</span>`:''}${x.sev&&bad?`<span class="pc-sev pc-sev${x.sev}">${DG_SEV[x.sev]}</span>`:''}${x.t}</b>${x.d?`<p>${x.d}</p>`:''}${x.ev&&x.ev.length?`<ul class="pc-ev">${x.ev.map(e=>`<li>${esc(e)}</li>`).join('')}</ul>`:''}${x.how?`<p class="pc-how"><b>こうすると良くなる：</b>${x.how}</p>`:''}${x.sw&&x.sw.length?`<div class="pc-sws">${x.sw.map(w=>`<div class="pc-sw"><span><b>${esc(w.out.p.n)}</b> → <a href="#/p/${w.inP.no}">${esc(w.inP.n)}</a>${w.inX?'<small>選出を付けかえ</small>':''}${w.set?`<small class="pc-swc"><b>計算に使った${esc(w.inP.n)}の育成</b>（${esc(byNo[w.out.x.no].n)}の持ち物・技は引きつがない）：${esc(w.set)}</small>`:''}${w.cb&&typeof dguChgHTML==='function'?dguChgHTML(w.cb,w.ca,{title:'入れかえた6匹で計算し直した数',note:w.cnote}):w.calc?`<small class="pc-swc">${esc(w.calc)}</small>`:''}${w.up?`<small class="pc-swc pc-up"><b>良くなる：</b>${w.up.length?w.up.map(esc).join('／'):'なし'}</small><small class="pc-swc pc-dn"><b>悪くなる：</b>${w.dn.length?w.dn.map(esc).join('／'):'なし'}</small>`:''}</span><button class="bback" data-psw="${team.indexOf(w.out.x)}:${w.inX?'x'+team.indexOf(w.inX):w.inP.no}">入れかえる</button></div>`).join('')}</div>`:''}${x.c&&x.c.length?`<div class="pills gchips" style="padding:6px 0 0">${x.c.map(p=>`<a class="pill gchip" href="#/p/${p.no}">${esc(formInfo(p).base)}${formInfo(p).tag?'（'+esc(formInfo(p).tag)+'）':''}</a>`).join('')}</div>`:''}</div>`;
  C.fix.filter(x=>x.k==='calc').forEach((x,k)=>x.id='pcw'+k);
  /* 2026/11/15 依頼主「Party Evaluation Redesign」：最初に戦い方・強み・選出・流れ（78-strategy.js）→ 気をつけたい相手・場面 → くわしい分析（たたむ。中身は前のまま） */
  let advOpen=false;try{advOpen=sessionStorage.getItem('pcdgadv')==='1'}catch(e){}
  out.innerHTML=`${dgModeNote(TEAM_DGMODE)}${typeof stHTML==='function'&&team.length>=2?stHTML():''}${teamStepsHTML()}${typeof dguSumHTML==='function'&&team.length>=2?dguSumHTML():''}${loseHTML()}
  <details id="dg-adv" class="dg-adv"${advOpen?' open':''}><summary><b>くわしい分析</b><small>相手ごとの対応力・改善案・パーティのチェックの全項目</small></summary>
  ${dgHTML()}${typeof impHTML==='function'&&team.length>=3?impHTML():''}
  <div class="sec"><h2>パーティのチェック</h2></div>
  <p class="note" style="padding-top:0">${C.scope}を、${esc(C.opponentSource)}との実際のダメージ計算と素早さ（攻撃・防御・素早さ・役割）、組み合わせ・持ち物の面から見ています。タイプ相性だけで分かることは、計算で裏付けがあるときだけ「気になる点」にし、それ以外は下の参考にまとめています。</p>
  ${C.good.length?`<h3 class="pc-h">よいところ</h3>${C.good.map(x=>item(x,false)).join('')}`:''}
  ${(()=>{const fc=C.fix.filter(x=>x.k==='calc'),fo=C.fix.filter(x=>x.k!=='calc'),sv=v=>fc.filter(x=>x.sev===v).length;
    /* 2026/11/10 依頼主：件数の意味を分ける。上＝相手との1対1の計算で見つかった弱点、下＝組み合わせ・タイプ・持ち物の点検 */
    return (fc.length?`<h3 class="pc-h">対面のポイント（${fc.length}件）</h3><p class="note pc-sevn">優先度 高${sv(3)}・中${sv(2)}・低${sv(1)}</p><p class="note" style="padding-top:0">${esc(C.opponentSource)}と1匹ずつダメージ・素早さを計算した結果です。</p>${fc.map(x=>item(x,true)).join('')}`:'')+
      (fo.length?`<h3 class="pc-h">組み合わせのポイント（${fo.length}件）</h3><p class="note" style="padding-top:0">パーティの形（タイプの重なり・持ち物・技の組み合わせ）の点検です。</p>${fo.map(x=>item(x,true)).join('')}`:'')})()}${C.fix.length?'':'<p class="note">いまのところ、大きく気になる点はありません。</p>'}
  ${C.ref&&C.ref.length?`<details class="pc-ref"><summary>参考（タイプ相性の上で・役割の重なり）${C.ref.length}件</summary>${C.ref.map(x=>item(x,'ref')).join('')}</details>`:''}
  ${C.premise?`<details class="pc-ref"><summary>計算の前提</summary><p class="note">${esc(C.premise)}</p></details>`:''}
  </details>
  ${adSlot('診断結果下')}`;teamStepsBind(out);dgWaitBind(out,teamRender);
  {const ad=out.querySelector('#dg-adv');if(ad)ad.addEventListener('toggle',()=>{try{sessionStorage.setItem('pcdgadv',ad.open?'1':'0')}catch(e){}})}
  if(typeof stFill==='function')setTimeout(()=>stFill(team),0);
  if(typeof dguSumFill==='function')setTimeout(()=>dguSumFill(team,C),0);setTimeout(()=>loseFill(team),20);setTimeout(()=>dgFill(team),40);if(typeof impFill==='function')impFill(team);
  /* 入れかえ：パーティの中の匹なら★を付けかえ、新しいポケモンならその枠を置きかえる（育成は消える） */
  const swapStamp=teamActionStamp();
  out.querySelectorAll('[data-psw]').forEach(b=>b.onclick=async()=>{
    if(!b.isConnected||!teamActionCurrent(swapStamp))return;
    const [i,v]=b.dataset.psw.split(':'),o=team[+i];if(!o)return;
    if(v[0]==='x'){const n=team[+v.slice(1)];if(!n)return;n.sel=o.sel;o.sel=false;saveTeam();toast(`${byNo[o.no].n} → ${byNo[n.no].n}（選出を付けかえました）`);teamRender();return}
    const q=byNo[+v],st=PC_SWSET[+v];if(!q||!await askConfirm({title:`${byNo[o.no].n}を${q.n}に入れかえますか？`,text:`${byNo[o.no].n}の育成は消えます。${st?`${q.n}は、計算に使った育成で入ります（あとで変えられます）。`:''}`,ok:'入れかえる',danger:false}))return;
    if(!teamActionCurrent(swapStamp)||!b.isConnected)return;
    team[+i]={no:q.no,sel:o.sel,...(st?{set:JSON.parse(JSON.stringify(st))}:{})};saveTeam();toast(`${byNo[o.no].n} → ${q.n}に入れかえました`);teamRender()});
}
/* パーティの画面のタブを切りかえて、中の場所（id）まで送る（2026/11/10 UI改善 第7段階：TTAB を変えて描き直すだけでは中身が隠れたままだったので、タブのボタンと同じ切りかえを使う） */
/* くわしい分析（たたんだ枠）の中へ移動するときは開く */
function dgAdvOpen(id){const t=id&&document.getElementById(id),d=t&&t.closest('details.dg-adv');if(d&&!d.open){d.open=true;try{sessionStorage.setItem('pcdgadv','1')}catch(e){}}}
function ttJump(k,id){const b=document.querySelector(`#tt-seg [data-tt="${k}"]`);if(b&&TTAB!==k)b.click();else if(!b){TTAB=k;try{sessionStorage.setItem('pcttab',k)}catch(e){}teamRender()}
  if(!id){scrTo(0,0);return}
  /* チェック・構築は「計算しています」のあとに中身が出るので、中身ができてから開く・送る（毎回ためす） */
  const prep=()=>{dgAdvOpen(id);const t=document.getElementById(id),pp=t&&t.closest('[data-psub-p]');if(pp&&pp.hidden)psubGo(document.getElementById('tplan'),pp.dataset.psubP)};
  prep();
  let n=0;const go=()=>{prep();const t=document.getElementById(id);if(t&&t.offsetParent){t.scrollIntoView({block:'start'});/* 上の中身があとから描かれて位置がずれたら、もう一度合わせる */setTimeout(()=>{const y=t.getBoundingClientRect().top;if(Math.abs(y-72)>40)t.scrollIntoView({block:'start'})},700);t.classList.add('dgu-flash');setTimeout(()=>t.classList.remove('dgu-flash'),1200)}else if(n++<40)setTimeout(go,100)};setTimeout(go,80)}
// 評価を表示した時の形式・データ・パーティ枠と、保存前の状態を照合する。
function teamActionStamp(entries=team){
  let stored=null;
  // 別タブの保存が済んでいて、storage イベントがまだ届いていない場合も検出する。
  try{stored=JSON.parse(localStorage.getItem('pcteams'))?.list?.map(slotSig)||null}catch(e){}
  return JSON.stringify([TEAMS.cur,impKey(entries),stored]);
}
function teamActionCurrent(stamp){
  if(teamActionStamp()===stamp)return true;
  toast('パーティや計算条件が更新されました。新しい結果を確認してください');
  if(keyOf(cur)==='team')teamRender();
  return false;
}
function planBind(pl){
  pl.querySelectorAll('[data-psub]').forEach(b=>b.onclick=()=>psubGo(pl,b.dataset.psub));
  const fb=pl.querySelector('[data-bdfill]');if(fb)fb.onclick=()=>bdFill();
  pl.querySelectorAll('[data-axis-pick]').forEach(b=>b.onclick=()=>{const i=+b.dataset.axisPick,on=!team[i].axis;team.forEach(x=>delete x.axis);if(on)team[i].axis=true;saveTeam();toast(on?`${byNo[team[i].no].n}を軸にしました`:'軸を外しました');teamRender()});
  const stamp=teamActionStamp();
  const pb=pl.querySelector('[data-plan]');if(pb)pb.onclick=()=>{if(!pb.isConnected||!teamActionCurrent(stamp))return;const b=pb.dataset.plan.split(',').map(Number);team.forEach((x,i)=>x.sel=b.includes(i));saveTeam();toast('基本選出を選出にしました');teamRender()};
  /* 関連画面（2026/11/10 UI改善 第7段階）：かんたんな計算の注意から、チェックタブのくわしい計算へ */
  pl.querySelectorAll('[data-go-check]').forEach(b=>b.onclick=()=>ttJump('check',b.dataset.goCheck));
  pl.querySelectorAll('[data-plsw]').forEach(b=>b.onclick=()=>{if(!b.isConnected||!teamActionCurrent(stamp))return;const [o,i]=b.dataset.plsw.split(':').map(Number);const base=b.closest('[data-base]').dataset.base.split(',').map(Number);team.forEach((x,k)=>x.sel=base.includes(k)&&k!==o||k===i);saveTeam();toast(`${byNo[team[o].no].n} → ${byNo[team[i].no].n}を選出に入れました`);teamRender()});
}
/* 「構築」タブ（2026/11/12）：中を「構築｜選出アシスト」の小さなタブに分ける。中身は planHTML0 のまま（<!--B--> と <!--S--> で分けるだけ） */
function planHTML(entries){
  const h=planHTML0(entries),B=[],S=[];let mode='B';
  h.split(/<!--([BS])-->/).forEach((part,i)=>{if(i%2){mode=part;return}(mode==='B'?B:S).push(part)});
  const sel=S.join('').trim()||`<p class="empty">選出を考えるには、選出する数（${PICK()}匹）より多くポケモンを入れてください。</p>`;
  const asLink=`<a class="tqa-ext psub-ext" href="#/assist" title="選出アシストのツールを開きます">${SVG(I.target,16)}<span>相手の6匹を入れて選出を決める</span><span class="tqa-arr" aria-hidden="true">↗</span></a>`;
  return `<div class="psub" role="tablist" aria-label="構築の中の表示">${PSUBS.map(([k,l])=>`<button role="tab" data-psub="${k}" aria-selected="${k===PSUB}">${l}</button>`).join('')}</div>
    <div data-psub-p="build" role="tabpanel"${PSUB!=='build'?' hidden':''}>${B.join('')}</div>
    <div data-psub-p="sel" role="tabpanel"${PSUB!=='sel'?' hidden':''}><p class="note psub-lead">いまのパーティから、どの${PICK()}匹を出すと戦いやすいかを計算します。1匹ずつの「選出する」で、出す匹を決めます。</p>${sel}${asLink}</div>`;
}
/* 小さなタブの切りかえ（その場で入れかえる。スクロールしない・描き直さない） */
function psubGo(root,k){if(!root||!PSUBS.some(x=>x[0]===k))return;PSUB=k;try{sessionStorage.setItem('pcpsub',k)}catch(e){}
  root.querySelectorAll('[data-psub]').forEach(b=>b.setAttribute('aria-selected',b.dataset.psub===k));
  root.querySelectorAll('[data-psub-p]').forEach(p=>p.hidden=p.dataset.psubP!==k)}
function planHTML0(entries){
  /* 上位構築のデータがまだなら読んで、届いたら作り直す */
  if(typeof topLoad==='function'&&!topReady()&&TOPT.st!=='busy'&&TOPT.st!=='err'&&location.protocol!=='file:')topLoad().then(()=>{if(topReady()&&typeof keyOf==='function'&&keyOf(cur)==='team')teamRender()}).catch(()=>{});
  let P0;try{P0=selPlan(entries)}catch(e){return ''}
  const axCard=`<div class="pc-i pc-plan"><b>軸のポケモン</b><p>いちばん使いたい1匹を選ぶと、基本選出に必ず入れ、入れかえ案でも外しません。</p>
    <div class="pills gchips" style="padding:4px 0 0">${entries.map((x,i)=>`<button class="pill" data-axis-pick="${i}" aria-pressed="${!!x.axis}">${esc(byNo[x.no]?.n||String(x.no))}</button>`).join('')}</div>
    ${entries.some(x=>x.axis)&&entries.length<6?`<button class="btn btn-s" data-bdfill style="margin-top:10px;width:100%">軸に合わせて、空いている${6-entries.length}枠を埋める</button><p class="vcap">軸の弱点を受けられる・まだ突けないタイプを突ける匹を選び、育成も計算で組みます（実際の型とは違うことがあります）。</p>`:''}</div>`;
  if(!P0)return entries.length?`<!--B--><div class="sec"><h2>構築の診断</h2></div>${axCard}<p class="empty">選出を考えるには、選出する数（${PICK()}匹）より多くポケモンを入れてください。</p>`:'';
  if(P0.issue){
    const note=`<p class="dgu-note" role="status">${esc(P0.issue)}</p>`;
    return `<!--B--><div class="sec"><h2>構築の診断</h2></div>${axCard}${note}<!--S-->${note}`;
  }
  const nmI=i=>esc(byNo[entries[i].no].n),chipsOf=a=>a.slice(0,5).map(q=>`<a class="pill gchip" href="#/p/${q.no}">${esc(formInfo(q).base)}${formInfo(q).tag?'（'+esc(formInfo(q).tag)+'）':''}</a>`).join('');
  const isSel=P0.sel.length===P0.base.length&&P0.base.every(i=>P0.sel.includes(i));
  const kd=teamKind(entries),R=P0.roles,mons=a=>chipsOf(a.slice(0,4));
  const flow=stSelectionFlow(P0,entries);
  /* 読まれにくさ：ランクバトルの集計と比べて、あまり使われていない持ち物・技 */
  const zur=[];entries.forEach(x=>{const d=typeof LIVE!=='undefined'&&LIVE.csv[x.no];if(!d||!x.set)return;const p=byNo[x.no];
    const it=x.set.it&&x.set.it.k,top2=d.it.slice(0,2).map(([nn])=>nrm(nn));if(it&&!isStone(it)&&!top2.includes(it)&&d.it.length)zur.push(`${esc(p.n)}の${esc(ITEMN[it]||it)}（よく使われるのは${esc(d.it.slice(0,2).map(([nn])=>ITEMN[nrm(nn)]||nn).join('・'))}）`);
    const use={};d.mv.forEach(([nn,pc])=>{const id=MVKA[nrm(nn)];if(id)use[id]=pc});(x.set.mv||[]).forEach(m=>{if(m&&m.id&&(use[m.id]||0)<10)zur.push(`${esc(p.n)}の${esc(mName(m.id))}（使われているのは${use[m.id]?use[m.id]+'%':'ほとんどなし'}）`)})});
  return `<!--B--><div class="sec"><h2>構築の診断</h2><span style="font-size:12px;color:var(--dim)">${FMTN()}</span></div>
  ${axCard.replace(/<\/div>$/,'')}
    ${kd?`<h4>構築のタイプ</h4><p><b>${kd.name}</b>${kd.why.length?`<br><span class="vcap">理由：${esc(kd.why.join('・'))}</span>`:''}${kd.mix&&kd.mix.length?`<br><span class="vcap">${esc(kd.mix.join('・'))}の要素も同じくらいあります。方向をそろえると、選出で迷いにくくなります。</span>`:''}</p>`:'<p class="vcap">育成（持ち物・技）を3匹以上登録すると、構築のタイプ（対面・サイクル・積み）も診断します。</p>'}
  </div>
  <!--S--><div class="sec"><h2>選出の考え方</h2><span style="font-size:12px;color:var(--dim)">${FMTN()}</span></div>
  <p class="note" style="padding-top:0">${P0.DS.list.length}通りの選出を${esc(P0.DS.T.opponentSource)}${P0.DS.N}匹との1対1で比較しました。${FMT==='double'?DG_DOUBLE_SCOPE+DG_DOUBLE_LIMITS:''}</p>
  <div class="pc-i pc-plan" data-base="${P0.base.join(',')}"><b>基本選出</b>
    <p class="pc-mons">${P0.base.map(i=>`<span${P0.lead.includes(i)?' class="lead"':''}>${nmI(i)}${P0.lead.includes(i)?'<small>先発</small>':''}</span>`).join('')}</p>
    <p>比較した${P0.DS.N}匹のうち、◎${P0.DS.best.cnt[4]}・○${P0.DS.best.cnt[3]}。先発候補は${P0.lead.map(nmI).join('・')}です。</p>
    <h4>戦い方の流れ（目安）</h4><ol class="pc-story">${flow.steps.map(([label,tip])=>`<li><b>${label}</b> ${esc(tip)}</li>`).join('')}</ol>
    ${isSel?'<p class="vcap">いま選出に選んでいる組み合わせです。</p>':`<button class="btn btn-p pc-planbtn" data-plan="${P0.base.join(',')}">この組み合わせを選出にする</button>`}
    ${P0.situ.length?`<h4>こういう相手のときは入れかえる</h4>${P0.situ.map(x=>`<div class="pc-situ"><p>相手に ${chipsOf(x.opps)}${x.opps.length>5?` など${x.opps.length}匹`:''} がいるとき</p><div class="pc-sw"><span><b>${nmI(x.out)}</b> → <b style="color:var(--acc)">${nmI(x.in)}</b></span><button class="bback" data-plsw="${x.out}:${x.in}">この選出にする</button></div></div>`).join('')}`:''}
  </div>
  ${typeof dgSelHTML==='function'?dgSelHTML(P0.DS,entries):''}
  <div class="pc-i pc-plan"><b>主な比較相手への答え</b><p>比較相手の先頭8匹について、この選出で有利に戦えるポケモンを表示します。</p>
    ${P0.top.map(({q,ans})=>`<div class="pc-top"><a href="#/p/${q.no}">${esc(q.n)}</a><span>${ans.length?ans.slice(0,2).map(i=>`<b>${nmI(i)}</b>`).join('・')+'が有利':'<b style="color:var(--w2)">有利に戦える匹がいない</b>'}</span></div>`).join('')}
    ${P0.top.some(x=>!x.ans.length)?'<p class="vcap">答えがいない相手には、受けられる匹か、上から倒せる匹を1匹用意すると安定します。</p>':''}
    <p class="pc-simple">パーティ全体の通常時の対面結果です。おすすめ選出の場の条件が異なる場合は、選出側の結果を確認してください。<button class="dgu-link" data-go-check="dg-box">くわしい計算（チェックの「相手ごとの対応力」）を見る</button></p>
  </div>
  <div class="pc-i pc-plan"><b>1匹ずつの役割</b><p>それぞれ「どの相手に出すか・出さないか」です。出す相手がいない匹は、役割がはっきりしていない匹です。</p><p class="pc-simple">パーティ全体の通常時の対面結果です。おすすめ選出の場の条件が異なる場合は、選出側の結果を確認してください。<button class="dgu-link" data-go-check="dg-box">くわしい計算を見る</button></p>
    ${entries.map((x,i)=>`<div class="pc-role"><b>${nmI(i)}${i===P0.ax?'<small>軸</small>':''}</b>${R[i].go.length?`<p>出す：${mons(R[i].go)}</p>`:'<p style="color:var(--w2)">出す相手がはっきりしません（パーティのほかの匹の方が有利な相手ばかり）。</p>'}${R[i].no.length?`<p>出さない：${mons(R[i].no)}</p>`:''}</div>`).join('')}
  </div>
  <!--B-->${typeof buildDiagHTML==='function'?buildDiagHTML(entries,P0):''}
  ${typeof topCoresHTML==='function'?topCoresHTML(entries):''}
  ${zur.length?`<div class="pc-i pc-ok"><b>✓ 読まれにくい要素</b><p>ランクバトルであまり使われていない持ち物・技です。相手が型を読み違えやすくなります。</p><p>${zur.slice(0,4).join('<br>')}</p></div>`:''}
  <!--S-->${P0.sel.length===P0.base.length&&!isSel&&P0.selWeak.length?`<div class="pc-i pc-fix"><b>いまの選出が苦手な相手</b><p>${P0.selWeak.map(({q})=>`<a class="pill gchip" href="#/p/${q.no}">${esc(formInfo(q).base)}</a>`).join('')}</p><p>選出のだれも有利に戦いにくい相手です。この相手が見えたら、上の基本選出や入れかえを考えます。</p></div>`:''}`;
}
/* ---- パーティのチェック：タイプだけでなく、組み合わせ・持ち物・技・素早さも見て、直し方を添える（点数はつけない） ---- */
const PC_SWSET={};
function partyCheck(entries){
  /* 選出（★）が決まっていれば（${PICK()}匹）その匹で、決まっていなければパーティ全体で見る */
  const sel=entries.filter(x=>x.sel),full=sel.length===Math.min(PICK(),entries.length);
  const use=full?sel:entries;
  const scope=full?`選出に選んだ${sel.length}匹（${FMTN()}）`:`パーティの${entries.length}匹全体（選出を${PICK()}匹選ぶと、選出の${PICK()}匹で見ます${sel.length?`。いま選出は${sel.length}匹`:''}）`;
  const allMs=entries.map(x=>({x,p:byNo[x.no]})).filter(o=>o.p);
  const ms=use.map(x=>({x,p:byNo[x.no]})).filter(o=>o.p);
  const inTeam=new Set(entries.map(x=>formInfo(byNo[x.no]||{n:''}).base));
  /* メガストーンを持つ匹は、メガシンカ後の特性で見る */
  const ab=o=>{const k=o.x.set&&o.x.set.it&&o.x.set.it.k,mg=k&&megaOf(o.p.no,k);if(mg&&mg.ab)return[mg.ab];return o.x.set&&o.x.set.ab&&o.x.set.ab.k?[o.x.set.ab.k]:(ABD[o.p.no]||[]).map(a=>a[0])};
  const mvKeys=o=>((o.x.set&&o.x.set.mv)||[]).map(m=>m&&MD[m.id]&&MD[m.id][3]).filter(Boolean);
  const learns=(o,k)=>{const ls=LSD[o.p.no]?LSD[o.p.no][1]:[];return ls.some(id=>MD[id]&&MD[id][3]===k)};
  const hasSets=ms.some(o=>o.x.set&&o.x.set.mv&&o.x.set.mv.length);
  const good=[],fix=[],ref=[];
  const names=a=>a.map(o=>esc(o.p.n)).join('・');
  /* 第4段階（2026/11/10）：実際のダメージ計算と素早さ（60-diag.js の dgTeam・dgAnalyze）で見る。タイプ相性だけの項目は、計算で裏付けがあるときだけ「気になる点」にする */
  let DT=null,DA=null;try{if(ms.length){DT=dgTeam(use,20);DA=dgAnalyze(DT)}}catch(e){DT=DA=null}
  const T_MS=i=>DT.ms[i].p;
  /* 1. 弱点の重なり（特性も入れる） */
  const md=new Map(ms.map(o=>[o.p.no,monDef(o.p)]));
  const m=(o,t)=>md.get(o.p.no).find(z=>z.t===t).m;
  const rows=T.map(t=>({t,w:ms.filter(o=>m(o,t)>=2),r:ms.filter(o=>m(o,t)<1)}));
  const need=Math.max(2,Math.ceil(ms.length/2));
  const danger=rows.filter(r=>r.w.length>=need&&!r.r.length);
  const cands=types=>P.filter(p=>!inTeam.has(formInfo(p).base)&&types.every(t=>monDef(p).find(z=>z.t===t).m<1)&&(typeof mvpSet!=='function'||mvpSet(FMT,p.no,{}).st==='ok')).sort((a,b)=>b.bst-a.bst).slice(0,4);
  /* 入れかえ案（だれ→だれ）：外す1匹は、問題に関わる匹のうちメガストーンを持たない・合計種族値の低い方。
     選出（★）で見ているときは、まずパーティの中の★なしの匹との入れかえ、その次に新しいポケモン */
  const stoneOf=o=>{const k=o.x.set&&o.x.set.it&&o.x.set.it.k;return !!k&&isStone(k)};
  const outOf=f=>[...ms.filter(o=>!o.x.axis).filter(f)].sort((a,b)=>stoneOf(a)-stoneOf(b)||a.p.bst-b.p.bst)[0];
  const bench=allMs.filter(o=>!use.includes(o.x));
  const swaps=(out,okP,news)=>{if(!out)return[];const r=[];
    if(full)bench.filter(o=>okP(o.p)).slice(0,2).forEach(o=>r.push({out,inP:o.p,inX:o.x}));
    (news||[]).slice(0,3-r.length).forEach(p=>r.push({out,inP:p}));return r};
  /* 計算で、上位の相手が実際にこのタイプの技で弱点の匹を押し込んでくるか（その相手への対応が不安定以下） */
  const typeHit=t=>DT?DT.rows.filter(row=>row.lvl<=2&&row.res.some(z=>z.op&&hitType(row.o,z.op.mv)===t&&z.op.eff>=2)):null;
  if(danger.length)danger.slice(0,2).forEach(r=>{const th=typeHit(r.t);(th&&!th.length?ref:fix).push({k:'type',ev:th&&th.length?th.slice(0,4).map(row=>{const z=row.res.filter(z=>z.op&&hitType(row.o,z.op.mv)===r.t).sort((a,b)=>b.op.max-a.op.max)[0];return `${row.q.n}${SKIN[row.o.ab]?'（'+(ABN[row.o.ab]||'')+'）':''}：${formInfo(T_MS(z.i)).base}に${z.op.mvn}で最大${dgPct(z.op.max)}`}):th?['計算では、このタイプで押し込まれる相手は見つかりませんでした（タイプ相性の上での参考）']:[],t:`${r.t}技を受けられるポケモンがいない`,d:`${names(r.w)}の${r.w.length}匹が${r.t}技を弱点で受け、半減以下で受けられる味方がいません。${r.t}技を持つ相手に続けて押し込まれやすい形です。`,
    how:`${r.t}技を半減以下で受けられるポケモンと入れかえるか、${r.t}技を使う相手を先に倒せる味方を用意します。`,sw:swaps(outOf(o=>r.w.includes(o)),q=>monDef(q).find(z=>z.t===r.t).m<1,cands([r.t]))})});
  else if(ms.length>=3)good.push({t:'弱点が大きく重なっていない',d:`${need}匹以上が同じ弱点で、受けられる味方もいない、というタイプはありません。`});
  /* 2. 攻撃の範囲：登録した技があればその技、なければタイプ一致技で */
  const atkTypes=o=>{const mv=((o.x.set&&o.x.set.mv)||[]).map(z=>z&&mvInfo(z.id)).filter(i=>i&&i.pow>0).map(i=>i.t);return mv.length?mv:o.p.t};
  const hits=new Set();ms.forEach(o=>atkTypes(o).forEach(a=>T.forEach(d=>{if(mult(a,[d])>=2)hits.add(d)})));
  const miss=T.filter(d=>!hits.has(d));
  if(miss.length>=3){const sub=[];
    ms.forEach(o=>{const ls=LSD[o.p.no]?LSD[o.p.no][1]:[];const best=ls.map(id=>({id,i:mvInfo(id)})).filter(z=>z.i&&z.i.pow>=70&&z.i.cls<2&&miss.some(d=>mult(z.i.t,[d])>=2)).sort((a,b)=>miss.filter(d=>mult(b.i.t,[d])>=2).length-miss.filter(d=>mult(a.i.t,[d])>=2).length||b.i.pow-a.i.pow)[0];
      if(best)sub.push(`${esc(o.p.n)}の${esc(mName(best.id))}（${best.i.t}）`)});
    (DA?ref:fix).push({k:'type',t:`効果ばつぐんを取れないタイプが${miss.length}タイプある`,ev:DA?['実際に倒しきれるかは、上の「攻撃」の項目（ダメージ計算）で見ています。ここはタイプ相性の上での参考です']:[],d:`${hasSets?'登録した技':'タイプ一致の技'}では、${miss.join('・')}タイプの相手に効果ばつぐんを取れません。`,how:sub.length?`サブの技を入れると範囲が広がります。例：${sub.slice(0,3).join('、')}。またはポケモンを入れかえます。`:'ほかのタイプの技を持つポケモンと入れかえます。',
      sw:(()=>{const hitN=q=>miss.filter(d=>q.t.some(a=>mult(a,[d])>=2)).length;return swaps(outOf(()=>true),q=>hitN(q)>=2,P.filter(q=>!inTeam.has(formInfo(q).base)&&hitN(q)>=2).sort((a,b)=>hitN(b)-hitN(a)||b.bst-a.bst))})()})}
  else good.push({t:'攻撃の範囲が広い',d:`${hasSets?'登録した技':'タイプ一致の技'}で、18タイプのうち${18-miss.length}タイプに効果ばつぐんを取れます。`});
  /* 3. 組み合わせ：天気・トリックルーム・物理/特殊の偏り */
  const setter=ms.filter(o=>ab(o).some(k=>WSET[k])),abuser=ms.filter(o=>ab(o).some(k=>WSPD[k]));
  setter.forEach(o=>{const w=WSET[ab(o).find(k=>WSET[k])];const ok=abuser.some(a=>ab(a).some(k=>WSPD[k]===w));
    if(ok)good.push({t:`天気（${GM_WN[w]}）の組み合わせがある`,d:`${esc(o.p.n)}が${GM_WN[w]}にし、${names(abuser.filter(a=>ab(a).some(k=>WSPD[k]===w)))}がその天気で速くなります。`})});
  abuser.forEach(o=>{const w=WSPD[ab(o).find(k=>WSPD[k])];if(setter.some(s=>ab(s).some(k=>WSET[k]===w))||ms.some(s=>mvKeys(s).includes({rain:'raindance',sun:'sunnyday',sand:'sandstorm',snow:'snowscape'}[w])))return;
    const inParty=allMs.filter(s=>!ms.includes(s)&&ab(s).some(k=>WSET[k]===w));
    if(inParty.length){fix.push({t:`${esc(o.p.n)}の特性が活きにくい`,d:`${esc(o.p.n)}は${GM_WN[w]}のときに素早さが2倍になりますが、選出に天気を${GM_WN[w]}にできる味方がいません。`,how:`パーティにいる${names(inParty)}を一緒に選出すると、組み合わせで強くなります。`,sw:swaps(outOf(x=>x!==o),q=>inParty.some(z=>z.p===q),[])});return}
    fix.push({t:`${esc(o.p.n)}の特性が活きにくい`,d:`${esc(o.p.n)}は${GM_WN[w]}のときに素早さが2倍になりますが、天気を${GM_WN[w]}にできる味方がいません。`,how:`天気を${GM_WN[w]}にする特性のポケモンと入れかえると、組み合わせで強くなります。`,sw:swaps(outOf(x=>x!==o),()=>false,P.filter(p=>!inTeam.has(formInfo(p).base)&&(ABD[p.no]||[]).some(a=>WSET[a[0]]===w)).sort((a,b)=>b.bst-a.bst))})});
  const trS=ms.filter(o=>hasSets?mvKeys(o).includes('trickroom'):false),slow=ms.filter(o=>o.p.s[5]<=50&&Math.max(o.p.s[1],o.p.s[3])>=100);
  if(trS.length&&slow.length)good.push({t:'トリックルームの組み合わせがある',d:`${names(trS)}がトリックルームを使い、遅くて強い${names(slow)}が先に動けます。`});
  else if(slow.length>=2&&!trS.length)fix.push({t:'遅いポケモンが多い',d:`${names(slow)}は遅いぶん、相手に先に攻撃されやすくなります。`,how:`トリックルームを使える味方を入れると、遅さが強みに変わります。${ms.filter(o=>learns(o,'trickroom')).length?`${names(ms.filter(o=>learns(o,'trickroom')))}も覚えられます。`:'候補：'}`,c:ms.some(o=>learns(o,'trickroom'))?[]:P.filter(p=>!inTeam.has(formInfo(p).base)&&LSD[p.no]&&LSD[p.no][1].some(id=>MD[id]&&MD[id][3]==='trickroom')).sort((a,b)=>(a.s[5]-b.s[5])||(b.bst-a.bst)).slice(0,3)});
  const phys=ms.filter(o=>o.p.s[1]>=o.p.s[3]+15).length,spec=ms.filter(o=>o.p.s[3]>=o.p.s[1]+15).length;
  if(ms.length>=3&&(phys===ms.length||spec===ms.length))fix.push({t:`${phys===ms.length?'物理':'特殊'}アタッカーばかり`,d:`全員が${phys===ms.length?'攻撃':'特攻'}で戦うので、${phys===ms.length?'いかく・おにび・リフレクター':'ひかりのかべ・特防の高い相手'}でまとめて止められやすくなります。`,how:`${phys===ms.length?'特殊':'物理'}で攻めるポケモンを1匹入れると、受けられにくくなります。`});
  /* 交代で受け合える組み合わせ（Aの弱点をBが、Bの弱点をAが半減以下で受けられる） */
  let pair=null;
  for(let a=0;a<ms.length;a++)for(let b=a+1;b<ms.length;b++){const A=ms[a],B=ms[b];
    const wa=T.filter(t=>m(A,t)>=2),wb=T.filter(t=>m(B,t)>=2);if(!wa.length||!wb.length)continue;
    const v=wa.filter(t=>m(B,t)<1).length/wa.length+wb.filter(t=>m(A,t)<1).length/wb.length;if(!pair||v>pair.v)pair={A,B,v,wa,wb}}
  if(pair&&pair.v>=1.4)good.push({t:`${esc(pair.A.p.n)}と${esc(pair.B.p.n)}が弱点を受け合える`,d:`${esc(pair.A.p.n)}の弱点（${pair.wa.join('・')}）の多くを${esc(pair.B.p.n)}が、${esc(pair.B.p.n)}の弱点（${pair.wb.join('・')}）の多くを${esc(pair.A.p.n)}が受けられます。不利な相手が出てきたら、交代で受け合えます。`});
  else if(ms.length>=3&&T.some(t=>m(ms[0],t)>=2))(DA?ref:fix).push({k:'type',t:'交代で受け合える組み合わせが少ない',ev:DA?['実際に後出しできるかは、上の「防御」の項目（ダメージ計算）で見ています。ここはタイプ相性の上での参考です']:[],d:'お互いの弱点を受け合える2匹がいないので、不利な相手が出てきたときに、交代で受けにくい形です。',how:`${esc(ms[0].p.n)}の弱点（${T.filter(t=>m(ms[0],t)>=2).join('・')||'なし'}）を受けられるポケモンと入れかえると、交代しやすくなります。`,sw:swaps(outOf(x=>x!==ms[0]),q=>T.filter(t=>m(ms[0],t)>=2).every(t=>monDef(q).find(z=>z.t===t).m<1),cands(T.filter(t=>m(ms[0],t)>=2)))});
  /* 4. 持ち物（何を持たせているか） */
  const it=o=>o.x.set&&o.x.set.it&&o.x.set.it.k;
  const megas=ms.filter(o=>it(o)&&isStone(it(o)));
  /* メガシンカは1試合に1匹。パーティに2匹（相手を見てどちらかを選ぶ）はよくある形なので、気になる点にするのは
     「選出（★）に2匹以上」と「パーティに3匹以上」のときだけ */
  const allMegas=allMs.filter(o=>it(o)&&isStone(it(o)));
  if(full&&megas.length>=2){const keep=[...megas].sort((a,b)=>(megaOf(b.p.no,it(b))||b.p).bst-(megaOf(a.p.no,it(a))||a.p).bst)[0],out=megas.find(o=>o!==keep);
    fix.push({t:'選出にメガストーンが2匹',d:`メガシンカできるのは1試合に1匹だけなので、選出の${names(megas)}のうち1匹はメガシンカせず、メガストーンの効果なし（持ち物なしと同じ）で戦うことになります。`,how:`${esc(keep.p.n)}をメガシンカさせるなら、${esc(out.p.n)}をメガストーンを持たない匹と入れかえます。`,
      sw:swaps(out,q=>{const o=allMs.find(z=>z.p===q);return o&&!stoneOf(o)},[])})}
  else if(!full&&allMegas.length>=3)fix.push({t:`メガストーンが${allMegas.length}匹`,d:`メガシンカできるのは1試合に1匹だけで、選出（${PICK()}匹）に入れられるメガストーンもふつう1匹です。${names(allMegas)}のうち、選ばれない匹の持ち物がむだになりやすい形です。`,how:`メガシンカの候補は2匹までにして、残りには別の持ち物を持たせます。例：${esc([...allMegas].sort((a,b)=>a.p.bst-b.p.bst)[0].p.n)}の持ち物：${esc(ITEMN[it([...allMegas].sort((a,b)=>a.p.bst-b.p.bst)[0])]||'メガストーン')} → いのちのたま・こだわりスカーフ など。`});
  else if(!full&&allMegas.length===2)good.push({t:'メガシンカの候補が2匹',d:`${names(allMegas)}。相手のパーティを見て、どちらをメガシンカさせるか選べます（選出に入れるのはどちらか1匹）。`});
  ms.forEach(o=>{const k=it(o);if(!k)return;const mv=mvKeys(o);
    if(/^choice/.test(k)&&mv.some(z=>[...GM_PSET,...GM_SSET,...GM_BSET].includes(z)))fix.push({t:`${esc(o.p.n)}：こだわり系と積み技`,d:`${esc(ITEMN[k])}を持つと最初に選んだ技しか出せないので、積み技を使うと攻撃できなくなります。`,how:'積み技を外して攻撃技にするか、持ち物をいのちのたまなどに変えます。'});
    if(k==='assaultvest'&&mv.some(z=>{const id=Object.keys(MD).find(i=>MD[i][3]===z);const i=id&&mvInfo(+id);return i&&i.cls===2}))fix.push({t:`${esc(o.p.n)}：とつげきチョッキと変化技`,d:'とつげきチョッキを持つと、変化技（攻撃しない技）が使えません。',how:'変化技を攻撃技に変えるか、持ち物を変えます。'});});
  const items=ms.map(it).filter(Boolean);
  if(items.length>=3&&new Set(items).size===items.length)good.push({t:'持ち物が分かれている',d:`${items.length}匹の持ち物が重なっていません。`});
  /* 持ち物がまだ無いことは「気になる点」にしない（2026/11/05：パーティ作りの進み具合 teamStepsHTML で、次にやることとして案内する） */
  /* 5. 素早さ：先に動く手段があるか */
  const fastest=Math.max(...ms.map(o=>maxSpe(o.p)));
  const scarf=ms.some(o=>it(o)==='choicescarf'),prio=ms.some(o=>((o.x.set&&o.x.set.mv)||[]).some(z=>{const i=z&&mvInfo(z.id);return i&&i.pri>0&&i.pow>0}));
  const tw=ms.some(o=>mvKeys(o).includes('tailwind'));
  if(DA){}
  else if(fastest>=165)good.push({t:'速いポケモンがいる',d:`いちばん速いポケモンは最速で${fastest}。多くの相手より先に動けます。`});
  else if(!scarf&&!prio&&!tw&&!trS.length)fix.push({t:'先に動く手段が少ない',d:`いちばん速いポケモンでも最速で${fastest}で、速い相手には先に攻撃されます。`,how:'こだわりスカーフ・先制技（でんこうせっか など）・おいかぜ・トリックルームのどれかを用意すると、速い相手にも対応しやすくなります。'});
  if(ms.length<entries.length||entries.length<6){}
  /* 選出（3〜4匹）では、受けられないタイプ・突けないタイプがあるのは当たり前なので、タイプの重なりは気になる点にしない（代わりに「選出の考え方」で相手ごとの選び方を出す） */
  /* 後出し・受けの不足には、入れかえた6匹で計算し直した案を付ける（dgDefSwaps） */
  if(DA&&DT){const tg=DA.bad.find(x=>/後出しして勝てる匹がいない|攻撃に偏っている|受けに回れる匹がいない/.test(x.t));
    if(tg){let S=[];try{S=dgDefSwaps(use,DT)}catch(e){}
      const msOf=i=>allMs.find(o=>o.x===use[i]);
      S.forEach(r=>{PC_SWSET[r.c.no]=r.S.sv});
      tg.sw=S.map(r=>({out:msOf(r.i),inP:r.c,set:r.S.txt,calc:`入れかえた6匹で計算し直すと（${r.D.note}）：◎ ${r.b.st}→${r.a.st}匹・△以下 ${r.b.w}→${r.a.w}匹・後出しして勝てる匹がいない相手 ${r.b.nosw}→${r.a.nosw}匹・だれも先に動けない相手 ${r.b.slow}→${r.a.slow}匹・半分以上を一撃で倒す相手 ${r.b.ohko}→${r.a.ohko}匹`,cb:{...r.b},ca:{...r.a},cnote:r.D.note,up:r.D.up,dn:r.D.dn})).filter(w=>w.out);
      if(!S.length)tg.how+='（入れかえ候補を計算し直しましたが、後出しできない相手を減らせて、ほかが悪くならない1匹の入れかえは見つかりませんでした。技・持ち物・能力ポイントを耐久に回すことを考えてください）';
      if(S.mvpDrop)tg.how+=`（ほかに${S.mvpDrop}案は、「相性のいい仲間を探す」の入れかえ案の計算〔メガシンカは1匹ずつ〕で新しい大きな弱点ができるか、素早さの操作・天気を失うので出していません）`}}
  if(DA){fix.unshift(...DA.bad.map(x=>({...x,k:'calc'})));good.unshift(...DA.good.map(x=>({...x,k:'calc'})));ref.push(...DA.ref)}
  /* 2026/11/20：持ち物が姿と合わない匹は計算から外しているので、いちばん上の気になる点として知らせる */
  if(DT&&DT.formErr)DT.formErr.filter(x=>x.side==='me').forEach(x=>fix.unshift({k:'calc',area:'役割',sev:3,t:`${esc((byNo[x.no]||{}).n||'')}：持ち物が姿と合わない`,d:`${FORM_WHY[x.why]||''}。このポケモンは診断の計算に入れていません。`,how:'育成の画面で、このポケモンが持てる持ち物を選び直してください。'}));
  return{scope,diagnosis:DT,analysis:DA,opponentSource:DT?.opponentSource||'比較相手',good,fix:full?fix.filter(x=>x.k!=='type'):fix,ref:full?ref.filter(x=>x.k!=='type'):ref,premise:DT?dgPremise(DT):''};
}
// 選出・先発・代替候補は同じ対面と場の条件で比較する。
function selPlan(entries){
  const n=entries.length,K=Math.min(PICK(),n);
  if(n<=K)return null;
  const T=dgTeam(entries,20),issue=dgSelectionIssue(T,entries,K);
  if(issue)return{issue};
  const DS=dgSelect(entries);
  if(!DS?.best)return{issue:'比較できる相手がいないため、選出の判定を保留しています。'};
  const best=DS.best,base=best.c,lead=best.leads.slice(0,LEADN());
  const opps=T.rows.map(r=>r.q);
  const S=T.M.map((_,i)=>T.rows.map(r=>{
    const z=r.res.find(x=>x.i===i);
    return !z||z.r===1?-2:z.r===2?0:z.r===3?1:2;
  }));
  const roles=S.map(row=>({
    go:opps.filter((_,j)=>row[j]>=1&&row[j]===Math.max(...S.map(scores=>scores[j]))),
    no:opps.filter((_,j)=>row[j]<0)
  }));
  const seen=new Set(),situ=[];
  for(const alternative of DS.list){
    const out=base.find(i=>!alternative.c.includes(i)),incoming=alternative.c.filter(i=>!base.includes(i));
    if(incoming.length!==1||seen.has(incoming[0]))continue;
    const improved=alternative.rows.filter((r,j)=>best.rows[j].lvl<=2&&r.lvl>=3).map(r=>r.r.q);
    if(improved.length){
      seen.add(incoming[0]);
      situ.push({out,in:incoming[0],opps:improved});
      if(situ.length===3)break;
    }
  }
  const me=best.X.T.M;
  // 終盤候補は、実際の選出条件で有利な対面があり、根拠になる技や持ち物がある匹。
  const finish=base.map(i=>{
    const rows=best.rows.flatMap(r=>r.zs.filter(z=>z.i===i&&z.r>=4));
    const pr=rows.find(z=>z.pr&&z.pr.min>0)?.pr;
    const setup=best.ace.includes(i)&&entries[i].set?.mv?.find(m=>MD[m?.id]?.[3]===me[i]?.boost);
    const why=pr?['prio',pr.mvn]:rows.some(z=>z.spd===1)&&me[i]?.item==='choicescarf'?['scarf',ITEMN.choicescarf]:rows.length&&setup?['setup',mName(setup.id)]:null;
    return{i,why,n:rows.length};
  }).filter(x=>x.why).sort((a,b)=>b.n-a.n||a.i-b.i)[0];
  const sel=entries.map((x,i)=>x.sel?i:-1).filter(i=>i>=0);
  const selWeak=DS.mine?DS.mine.rows.filter(r=>r.lvl<=2).slice(0,6).map(r=>({q:r.r.q,j:r.j})):[];
  const top=best.rows.slice(0,8).map(r=>({q:r.r.q,ans:r.zs.filter(z=>z.r>=4).sort((a,b)=>b.r-a.r).map(z=>z.i)}));
  return{DS,base,lead,megaI:best.megaI,situ,sel,selWeak,S,opps,roles,finisher:finish?.i??base[0],finWhy:finish?.why??null,top,ax:DS.ax,me};
}
/* 構築のタイプ（対面・攻めサイクル・受けサイクル・積み）：登録した育成の持ち物・技・特性から数える */
function teamKind(entries){
  const sc={tm:0,ac:0,dc:0,su:0},why={tm:[],ac:[],dc:[],su:[]};let withSet=0;
  entries.forEach(x=>{const p=byNo[x.no];if(!p||!x.set)return;const it=x.set.it&&x.set.it.k,mv=(x.set.mv||[]).map(m=>m&&MD[m.id]&&MD[m.id][3]).filter(Boolean),ab=x.set.ab&&x.set.ab.k;
    if(it||mv.length)withSet++;
    const add=(k,w)=>{sc[k]+=1;why[k].push(p.n+'の'+w)};
    if(['focussash','choiceband','choicespecs','choicescarf','lifeorb'].includes(it))add('tm',ITEMN[it]);
    const pv=mv.find(k=>GM_PIV.includes(k));if(pv)add('ac',mName(+Object.keys(MD).find(i=>MD[i][3]===pv)));
    const hl=mv.find(k=>GM_HEAL.includes(k));if(hl||ab==='regenerator'||it==='leftovers')add('dc',hl?mName(+Object.keys(MD).find(i=>MD[i][3]===hl)):ab==='regenerator'?ABN.regenerator:ITEMN.leftovers);
    const st=mv.find(k=>[...GM_PSET,...GM_SSET,...GM_BSET].includes(k));if(st)add('su',mName(+Object.keys(MD).find(i=>MD[i][3]===st)))});
  if(withSet<3)return null;
  const k=Object.keys(sc).sort((a,b)=>sc[b]-sc[a]||['tm','ac','dc','su'].indexOf(a)-['tm','ac','dc','su'].indexOf(b))[0];
  if(!sc[k])return{name:'まだはっきりしない',why:[]};
  return{k,name:{tm:'対面（有利な相手にぶつけて押し切る）',ac:'攻めのサイクル（攻撃しながら交代して有利を取る）',dc:'受けのサイクル（受けて回復しながら削る）',su:'積み（能力を上げて一気に抜く）'}[k],why:why[k].slice(0,4),mix:Object.keys(sc).filter(z=>z!==k&&sc[z]>=sc[k]-0).map(z=>({tm:'対面',ac:'攻めのサイクル',dc:'受けのサイクル',su:'積み'}[z]))};
}

