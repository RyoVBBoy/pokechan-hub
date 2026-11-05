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
  o.list.forEach(s=>{s.team=cleanTeam(s.team);s.name=String(s.name||'').slice(0,20)});return o})();
team=TEAMS.list[TEAMS.cur].team.map(x=>({...x}));
const teamName=i=>TEAMS.list[i].name||L(`パーティ${i+1}`,`Team ${i+1}`);
const saveTeam=fromServer=>{TEAMS.list[TEAMS.cur].team=team;if(fromServer!==true){TEAMS.updated=Date.now();if(typeof teamSyncSoon==='function')teamSyncSoon()}try{localStorage.setItem('pcteams',JSON.stringify(TEAMS));localStorage.setItem('pcteam',JSON.stringify(team))}catch(e){}};
function switchTeam(i){if(i===TEAMS.cur||!TEAMS.list[i])return;saveTeam();TEAMS.cur=i;team=TEAMS.list[i].team.map(x=>({...x}));saveTeam()}
let tq='';
function addTeam(no){
  if(team.some(x=>x.no===no)){nav('#/team');return}
  if(team.length>=6){toast('パーティは6匹までです');return}
  team.push({no,sel:team.filter(x=>x.sel).length<PICK()});saveTeam();nav('#/team');
}
/* パーティの画面の下半分はタブで分ける（育成・チェック・構築と選出）。重い計算（構築と選出）は開いたときだけ */
const TTABS=[['sets','育成'],['check','チェック'],['plan','構築と選出']];
let TTAB=(()=>{try{return sessionStorage.getItem('pcttab')||'sets'}catch(e){return 'sets'}})();
function teamView(arg){
  setHeader('パーティ');
  if(arg){const ids=[...new Set(arg.split('-').map(Number).filter(n=>byNo[n]))].slice(0,6);
    if(ids.length){team=ids.map((no,i)=>({no,sel:i<PICK()}));saveTeam();cur='#/team';setUrl('#/team')}}
  V.innerHTML=`
  <div class="pills tslots" id="tslots"></div><div id="tsync"></div>
  <p class="note" style="padding:6px 16px 12px">6匹まで登録し、<b>★で選出する${PICK()}匹</b>を決めます（${FMTN()}の形式）。</p>
  <div class="grid3" id="slots"></div>
  <div class="seg" id="tt-seg" style="margin-top:14px">${TTABS.map(([k,l])=>`<button data-tt="${k}" aria-selected="${k===TTAB}">${l}</button>`).join('')}<span class="seg-i" style="width:${100/TTABS.length}%;transform:translateX(${TTABS.findIndex(x=>x[0]===TTAB)*100}%)"></span></div>
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
    teamRender();
    segSlideIn(V.querySelector(`[data-tp="${k}"]`),dir||(ttIdx()>from?1:-1))};
  V.querySelectorAll('[data-tt]').forEach(b=>b.onclick=()=>ttGo(b.dataset.tt));
  segSwipe(V.querySelector('#tt-pages'),{n:TTABS.length,idx:ttIdx,ind,go:(j,d)=>ttGo(TTABS[j][0],d)});
  document.getElementById('shr').onclick=shareTeam;document.getElementById('shr-img').onclick=shareTeamImage;
  document.getElementById('clr').onclick=async()=>{if(team.length&&!await askConfirm({title:'パーティをクリアしますか？',text:`「${teamName(TEAMS.cur)}」のポケモンと育成をすべて外します。この操作は取り消せません。`,ok:'クリア'}))return;team=[];saveTeam();teamRender()};
  document.getElementById('tren').onclick=()=>{const v=prompt('パーティの名前（20文字まで）',TEAMS.list[TEAMS.cur].name||teamName(TEAMS.cur));if(v==null)return;TEAMS.list[TEAMS.cur].name=v.trim().slice(0,20);saveTeam();teamRender()};
  document.getElementById('tslots').onclick=e=>{const b=e.target.closest('[data-tslot]');if(!b)return;switchTeam(+b.dataset.tslot);toast(`「${teamName(TEAMS.cur)}」に切り替えました`);teamRender()};
  teamRender();syncBadge();if(PCF)teamSync();
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
function teamRender(){
  const ts=document.getElementById('tslots');
  if(ts)ts.innerHTML=TEAMS.list.map((s,i)=>`<button class="pill" data-tslot="${i}" aria-pressed="${i===TEAMS.cur}"><span data-notr>${esc(teamName(i))}</span><small>${(i===TEAMS.cur?team:s.team).length}${L('匹','')}</small></button>`).join('');
  document.getElementById('slots').innerHTML=Array.from({length:6},(_,i)=>{
    const x=team[i],p=x&&byNo[x.no];
    return p?`<div class="tile${x.sel?' on':''}" data-ti="${i}" style="cursor:pointer">
      <button class="t-rm" data-rm="${i}" aria-label="${p.n}を外す">${SVG(I.x,16)}</button>
      <span class="av" style="width:38px;height:38px">${stamp(p)}</span><div class="nm">${nm(p,{no:false})}</div><div class="tt">${p.t.map(t=>`<span style="background:${COL[t]};color:${ONC[t]}" title="${t}">${ticon(t,14)}</span>`).join('')}</div>
      <button class="t-sel${x.sel?' lit':''}" data-sel="${i}" aria-label="${p.n}を選出する" aria-pressed="${x.sel}">${SVG(I.star,16).replace('fill="none"',x.sel?'fill="currentColor"':'fill="none"')}<span>${x.sel?L('選出','Picked'):L('選出する','Pick')}</span></button></div>`
    :`<button class="tile empty tadd" data-add="1">${SVG(I.plus,22)}<span>追加する</span></button>`}).join('');
  document.getElementById('tsets').innerHTML=team.length?`<p class="note" style="padding-top:10px">押すと、技・持ち物・能力ポイントを編集できます。</p>`+team.map((x,i)=>{const p=byNo[x.no],s=x.set;
    const sub=s&&s.sp?[`<div class="row-s">${[s.ab&&s.ab.n,s.it&&s.it.n,natName(s.up,s.dn)].filter(Boolean).map(esc).join('／')}</div>`,`<div class="row-s">${(s.mv||[]).filter(m=>m&&m.n).map(m=>esc(m.n)).join('・')}</div>`,`<div class="row-s" style="color:var(--mute)">${spLine(s.sp)}</div>`].join('')
      :`<div class="row-s" style="color:var(--mute)">${s?'能力ポイント未入力':'未設定'}（よくある型で計算中）</div>`;
    return `<a class="row" href="#/edit/${i}" style="align-items:flex-start;content-visibility:visible"><span class="av">${stamp(p)}</span><div class="row-m"><div class="row-t">${nm(p)}${s&&s.src==='manual'?'<span class="atag on" style="margin-left:6px">入力済み</span>':s&&s.sp?'<span class="atag" style="margin-left:6px">画像から</span>':''}</div>${sub}</div><span class="chev">${SVG(I.chev,18)}</span></a>`}).join(''):'';
  document.querySelectorAll('#slots [data-add]').forEach(b=>b.onclick=async()=>{const no=await pickMon(0,{add:true});if(no)addTeam(no)});
  document.querySelectorAll('#slots .tile[data-ti]').forEach(t=>t.onclick=e=>{if(e.target.closest('button'))return;nav('#/edit/'+t.dataset.ti)});
  document.querySelectorAll('[data-sel]').forEach(b=>b.onclick=()=>{
    const x=team[+b.dataset.sel];
    if(!x.sel&&team.filter(y=>y.sel).length>=PICK()){toast(`${FMTN()}で選出できるのは${PICK()}匹までです`);return}
    x.sel=!x.sel;saveTeam();teamRender()});
  document.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{team.splice(+b.dataset.rm,1);saveTeam();teamRender()});

  {const st=document.getElementById('tsteps');if(st){st.innerHTML=teamStepsHTML();teamStepsBind(st)}}
  const out=document.getElementById('tout'),pl=document.getElementById('tplan');
  if(!team.length){out.innerHTML=pl.innerHTML='<p class="empty">上の「追加する」からポケモンを入れると、チェックと選出の考え方が出ます。</p>';return}
  if(TTAB==='plan'){pl.innerHTML=planHTML(team);planBind(pl)}
  if(TTAB!=='check'){out.innerHTML='';return}
  const C=partyCheck(team);
  const item=(x,bad)=>`<div class="pc-i ${bad?'pc-fix':'pc-ok'}"><b>${bad?'！':'✓'} ${x.t}</b>${x.d?`<p>${x.d}</p>`:''}${x.how?`<p class="pc-how"><b>こうすると良くなる：</b>${x.how}</p>`:''}${x.sw&&x.sw.length?`<div class="pc-sws">${x.sw.map(w=>`<div class="pc-sw"><span><b>${esc(w.out.p.n)}</b> → <a href="#/p/${w.inP.no}">${esc(w.inP.n)}</a>${w.inX?'<small>★を付けかえ</small>':''}</span><button class="bback" data-psw="${team.indexOf(w.out.x)}:${w.inX?'x'+team.indexOf(w.inX):w.inP.no}">入れかえる</button></div>`).join('')}</div>`:''}${x.c&&x.c.length?`<div class="pills gchips" style="padding:6px 0 0">${x.c.map(p=>`<a class="pill gchip" href="#/p/${p.no}">${esc(formInfo(p).base)}${formInfo(p).tag?'（'+esc(formInfo(p).tag)+'）':''}</a>`).join('')}</div>`:''}</div>`;
  out.innerHTML=`${teamStepsHTML()}${loseHTML()}
  <div class="sec"><h2>パーティのチェック</h2></div>
  <p class="note" style="padding-top:0">${C.scope}を、タイプ相性（特性も入れて）・組み合わせ・持ち物・技・素早さの面から見ています。点数はつけず、気になる点にはそれぞれ直し方を書いています。</p>
  ${C.fix.length?`<h3 class="pc-h">気になる点（${C.fix.length}件）</h3>${C.fix.map(x=>item(x,true)).join('')}`:'<p class="note">いまのところ、大きく気になる点はありません。</p>'}
  ${C.good.length?`<h3 class="pc-h">よいところ</h3>${C.good.map(x=>item(x,false)).join('')}`:''}
  ${adSlot('診断結果下')}`;teamStepsBind(out);
  setTimeout(()=>loseFill(team),20);
  /* 入れかえ：パーティの中の匹なら★を付けかえ、新しいポケモンならその枠を置きかえる（育成は消える） */
  out.querySelectorAll('[data-psw]').forEach(b=>b.onclick=async()=>{
    const [i,v]=b.dataset.psw.split(':'),o=team[+i];if(!o)return;
    if(v[0]==='x'){const n=team[+v.slice(1)];if(!n)return;n.sel=o.sel;o.sel=false;saveTeam();toast(`${byNo[o.no].n} → ${byNo[n.no].n}（★を付けかえました）`);teamRender();return}
    const q=byNo[+v];if(!q||!await askConfirm({title:`${byNo[o.no].n}を${q.n}に入れかえますか？`,text:`${byNo[o.no].n}の育成は消えます。`,ok:'入れかえる',danger:false}))return;
    team[+i]={no:q.no,sel:o.sel};saveTeam();toast(`${byNo[o.no].n} → ${q.n}に入れかえました`);teamRender()});
}
function planBind(pl){
  const fb=pl.querySelector('[data-bdfill]');if(fb)fb.onclick=()=>bdFill();
  pl.querySelectorAll('[data-axis-pick]').forEach(b=>b.onclick=()=>{const i=+b.dataset.axisPick,on=!team[i].axis;team.forEach(x=>delete x.axis);if(on)team[i].axis=true;saveTeam();toast(on?`${byNo[team[i].no].n}を軸にしました`:'軸を外しました');teamRender()});
  const pb=pl.querySelector('[data-plan]');if(pb)pb.onclick=()=>{const b=pb.dataset.plan.split(',').map(Number);team.forEach((x,i)=>x.sel=b.includes(i));saveTeam();toast('基本選出に★を付けました');teamRender()};
  pl.querySelectorAll('[data-plsw]').forEach(b=>b.onclick=()=>{const [o,i]=b.dataset.plsw.split(':').map(Number);const base=b.closest('[data-base]').dataset.base.split(',').map(Number);team.forEach((x,k)=>x.sel=base.includes(k)&&k!==o||k===i);saveTeam();toast(`${byNo[team[o].no].n} → ${byNo[team[i].no].n}の選出に★を付けました`);teamRender()});
}
function planHTML(entries){
  let P0;try{P0=selPlan(entries)}catch(e){return ''}
  const axCard=`<div class="pc-i pc-plan"><b>軸のポケモン</b><p>いちばん使いたい1匹を選ぶと、基本選出に必ず入れ、入れかえ案でも外しません。</p>
    <div class="pills gchips" style="padding:4px 0 0">${entries.map((x,i)=>`<button class="pill" data-axis-pick="${i}" aria-pressed="${!!x.axis}">${esc(byNo[x.no].n)}</button>`).join('')}</div>
    ${entries.some(x=>x.axis)&&entries.length<6?`<button class="btn btn-s" data-bdfill style="margin-top:10px;width:100%">軸に合わせて、空いている${6-entries.length}枠を埋める</button><p class="vcap">軸の弱点を受けられる・まだ突けないタイプを突ける匹を選び、育成も計算で組みます（実際の型とは違うことがあります）。</p>`:''}</div>`;
  if(!P0)return entries.length?`<div class="sec"><h2>構築の診断</h2></div>${axCard}<p class="empty">選出を考えるには、選出する数（${PICK()}匹）より多くポケモンを入れてください。</p>`:'';
  const nmI=i=>esc(byNo[entries[i].no].n),chipsOf=a=>a.slice(0,5).map(q=>`<a class="pill gchip" href="#/p/${q.no}">${esc(formInfo(q).base)}${formInfo(q).tag?'（'+esc(formInfo(q).tag)+'）':''}</a>`).join('');
  const isSel=P0.sel.length===P0.base.length&&P0.base.every(i=>P0.sel.includes(i));
  const kd=teamKind(entries),R=P0.roles,mons=a=>chipsOf(a.slice(0,4));
  const finTxt=P0.finWhy?{prio:`先制技の${esc(P0.finWhy[1])}`,scarf:`${esc(P0.finWhy[1])}`,setup:`積み技の${esc(P0.finWhy[1])}`}[P0.finWhy[0]]:'';
  const mid=P0.base.filter(i=>!P0.lead.includes(i)&&i!==P0.finisher);
  /* 読まれにくさ：ランクバトルの集計と比べて、あまり使われていない持ち物・技 */
  const zur=[];entries.forEach(x=>{const d=typeof LIVE!=='undefined'&&LIVE.csv[x.no];if(!d||!x.set)return;const p=byNo[x.no];
    const it=x.set.it&&x.set.it.k,top2=d.it.slice(0,2).map(([nn])=>nrm(nn));if(it&&!isStone(it)&&!top2.includes(it)&&d.it.length)zur.push(`${esc(p.n)}の${esc(ITEMN[it]||it)}（よく使われるのは${esc(d.it.slice(0,2).map(([nn])=>ITEMN[nrm(nn)]||nn).join('・'))}）`);
    const use={};d.mv.forEach(([nn,pc])=>{const id=MVKA[nrm(nn)];if(id)use[id]=pc});(x.set.mv||[]).forEach(m=>{if(m&&m.id&&(use[m.id]||0)<10)zur.push(`${esc(p.n)}の${esc(mName(m.id))}（使われているのは${use[m.id]?use[m.id]+'%':'ほとんどなし'}）`)})});
  return `<div class="sec"><h2>構築の診断</h2><span style="font-size:12px;color:var(--dim)">${FMTN()}</span></div>
  ${axCard.replace(/<\/div>$/,'')}
    ${kd?`<h4>構築のタイプ</h4><p><b>${kd.name}</b>${kd.why.length?`<br><span class="vcap">理由：${esc(kd.why.join('・'))}</span>`:''}${kd.mix&&kd.mix.length?`<br><span class="vcap">${esc(kd.mix.join('・'))}の要素も同じくらいあります。方向をそろえると、選出で迷いにくくなります。</span>`:''}</p>`:'<p class="vcap">育成（持ち物・技）を3匹以上登録すると、構築のタイプ（対面・サイクル・積み）も診断します。</p>'}
  </div>
  <div class="sec"><h2>選出の考え方</h2><span style="font-size:12px;color:var(--dim)">${FMTN()}</span></div>
  <p class="note" style="padding-top:0">${P0.live?'ランクバトルの使用率の上位':'種族値の高い'}${P0.total}匹を相手に、1対1でどちらが有利かを計算して選びました（育成を登録した匹はその育成で計算）。</p>
  <div class="pc-i pc-plan" data-base="${P0.base.join(',')}"><b>基本選出</b>
    <p class="pc-mons">${P0.base.map(i=>`<span${P0.lead.includes(i)?' class="lead"':''}>${nmI(i)}${P0.lead.includes(i)?'<small>先発</small>':''}</span>`).join('')}</p>
    <p>${P0.total}匹のうち<b>${P0.good}匹</b>に、選出のだれかが有利に戦えます。先発は、多くの相手に有利な${P0.lead.map(nmI).join('・')}。</p>
    <h4>勝ち筋</h4><ol class="pc-story"><li>先発の<b>${P0.lead.map(nmI).join('・')}</b>で、相手の先発に有利をとって削る。${R[P0.lead[0]].go.length?`（有利な相手：${R[P0.lead[0]].go.slice(0,3).map(q=>esc(q.n)).join('・')}）`:''}</li>
      ${mid.length?`<li>不利な相手が出てきたら<b>${mid.map(nmI).join('・')}</b>に任せて、数を減らす。</li>`:''}
      <li>${P0.finWhy?`最後は<b>${nmI(P0.finisher)}</b>の${finTxt}で、削れた相手を詰める。`:`最後の詰め役がはっきりしません。いちばん速い<b>${nmI(P0.finisher)}</b>で詰めることになりますが、先制技・こだわりスカーフ・積み技のどれかを持たせると、終盤に競り負けにくくなります。`}</li></ol>
    ${isSel?'<p class="vcap">いま★を付けている選出です。</p>':`<button class="bback" data-plan="${P0.base.join(',')}" style="padding:0;color:var(--acc)">この選出に★を付ける</button>`}
    ${P0.situ.length?`<h4>こういう相手のときは入れかえる</h4>${P0.situ.map(x=>`<div class="pc-situ"><p>相手に ${chipsOf(x.opps)}${x.opps.length>5?` など${x.opps.length}匹`:''} がいるとき</p><div class="pc-sw"><span><b>${nmI(x.out)}</b> → <b style="color:var(--acc)">${nmI(x.in)}</b></span><button class="bback" data-plsw="${x.out}:${x.in}">この選出にする</button></div></div>`).join('')}`:''}
  </div>
  <div class="pc-i pc-plan"><b>よく使われる相手への答え</b><p>${P0.live?'ランクバトルの使用率':'種族値'}の上位8匹に、パーティのだれが有利に戦えるかです。</p>
    ${P0.top.map(({q,ans})=>`<div class="pc-top"><a href="#/p/${q.no}">${esc(q.n)}</a><span>${ans.length?ans.slice(0,2).map(i=>`<b>${nmI(i)}</b>`).join('・')+'が有利':'<b style="color:var(--w2)">有利に戦える匹がいない</b>'}</span></div>`).join('')}
    ${P0.top.some(x=>!x.ans.length)?'<p class="vcap">答えがいない相手には、受けられる匹か、上から倒せる匹を1匹用意すると安定します。</p>':''}
  </div>
  <div class="pc-i pc-plan"><b>1匹ずつの役割</b><p>それぞれ「どの相手に出すか・出さないか」です。出す相手がいない匹は、役割がはっきりしていない匹です。</p>
    ${entries.map((x,i)=>`<div class="pc-role"><b>${nmI(i)}${i===P0.ax?'<small>軸</small>':''}</b>${R[i].go.length?`<p>出す：${mons(R[i].go)}</p>`:'<p style="color:var(--w2)">出す相手がはっきりしません（パーティのほかの匹の方が有利な相手ばかり）。</p>'}${R[i].no.length?`<p>出さない：${mons(R[i].no)}</p>`:''}</div>`).join('')}
  </div>
  ${typeof buildDiagHTML==='function'?buildDiagHTML(entries,P0):''}
  ${zur.length?`<div class="pc-i pc-ok"><b>✓ 読まれにくい要素</b><p>ランクバトルであまり使われていない持ち物・技です。相手が型を読み違えやすくなります。</p><p>${zur.slice(0,4).join('<br>')}</p></div>`:''}
  ${P0.sel.length===P0.base.length&&!isSel&&P0.selWeak.length?`<div class="pc-i pc-fix"><b>いまの★の選出が苦手な相手</b><p>${P0.selWeak.map(({q})=>`<a class="pill gchip" href="#/p/${q.no}">${esc(formInfo(q).base)}</a>`).join('')}</p><p>選出のだれも有利に戦いにくい相手です。この相手が見えたら、上の基本選出や入れかえを考えます。</p></div>`:''}`;
}
/* ---- パーティのチェック：タイプだけでなく、組み合わせ・持ち物・技・素早さも見て、直し方を添える（点数はつけない） ---- */
function partyCheck(entries){
  /* 選出（★）が決まっていれば（${PICK()}匹）その匹で、決まっていなければパーティ全体で見る */
  const sel=entries.filter(x=>x.sel),full=sel.length===Math.min(PICK(),entries.length);
  const use=full?sel:entries;
  const scope=full?`★を付けた選出の${sel.length}匹（${FMTN()}）`:`パーティの${entries.length}匹全体（★を${PICK()}匹付けると、選出の${PICK()}匹で見ます${sel.length?`。いま★は${sel.length}匹`:''}）`;
  const allMs=entries.map(x=>({x,p:byNo[x.no]})).filter(o=>o.p);
  const ms=use.map(x=>({x,p:byNo[x.no]})).filter(o=>o.p);
  const inTeam=new Set(entries.map(x=>formInfo(byNo[x.no]||{n:''}).base));
  /* メガストーンを持つ匹は、メガシンカ後の特性で見る */
  const ab=o=>{const k=o.x.set&&o.x.set.it&&o.x.set.it.k,mg=k&&megaOf(o.p.no,k);if(mg&&mg.ab)return[mg.ab];return o.x.set&&o.x.set.ab&&o.x.set.ab.k?[o.x.set.ab.k]:(ABD[o.p.no]||[]).map(a=>a[0])};
  const mvKeys=o=>((o.x.set&&o.x.set.mv)||[]).map(m=>m&&MD[m.id]&&MD[m.id][3]).filter(Boolean);
  const learns=(o,k)=>{const ls=LSD[o.p.no]?LSD[o.p.no][1]:[];return ls.some(id=>MD[id]&&MD[id][3]===k)};
  const hasSets=ms.some(o=>o.x.set&&o.x.set.mv&&o.x.set.mv.length);
  const good=[],fix=[];
  const names=a=>a.map(o=>esc(o.p.n)).join('・');
  /* 1. 弱点の重なり（特性も入れる） */
  const md=new Map(ms.map(o=>[o.p.no,monDef(o.p)]));
  const m=(o,t)=>md.get(o.p.no).find(z=>z.t===t).m;
  const rows=T.map(t=>({t,w:ms.filter(o=>m(o,t)>=2),r:ms.filter(o=>m(o,t)<1)}));
  const need=Math.max(2,Math.ceil(ms.length/2));
  const danger=rows.filter(r=>r.w.length>=need&&!r.r.length);
  const cands=types=>P.filter(p=>!inTeam.has(formInfo(p).base)&&types.every(t=>monDef(p).find(z=>z.t===t).m<1)).sort((a,b)=>b.bst-a.bst).slice(0,4);
  /* 入れかえ案（だれ→だれ）：外す1匹は、問題に関わる匹のうちメガストーンを持たない・合計種族値の低い方。
     選出（★）で見ているときは、まずパーティの中の★なしの匹との入れかえ、その次に新しいポケモン */
  const stoneOf=o=>{const k=o.x.set&&o.x.set.it&&o.x.set.it.k;return !!k&&isStone(k)};
  const outOf=f=>[...ms.filter(o=>!o.x.axis).filter(f)].sort((a,b)=>stoneOf(a)-stoneOf(b)||a.p.bst-b.p.bst)[0];
  const bench=allMs.filter(o=>!use.includes(o.x));
  const swaps=(out,okP,news)=>{if(!out)return[];const r=[];
    if(full)bench.filter(o=>okP(o.p)).slice(0,2).forEach(o=>r.push({out,inP:o.p,inX:o.x}));
    (news||[]).slice(0,3-r.length).forEach(p=>r.push({out,inP:p}));return r};
  if(danger.length)danger.slice(0,2).forEach(r=>fix.push({k:'type',t:`${r.t}技を受けられるポケモンがいない`,d:`${names(r.w)}の${r.w.length}匹が${r.t}技を弱点で受け、半減以下で受けられる味方がいません。${r.t}技を持つ相手に続けて押し込まれやすい形です。`,
    how:`${r.t}技を半減以下で受けられるポケモンと入れかえるか、${r.t}技を使う相手を先に倒せる味方を用意します。`,sw:swaps(outOf(o=>r.w.includes(o)),q=>monDef(q).find(z=>z.t===r.t).m<1,cands([r.t]))}));
  else if(ms.length>=3)good.push({t:'弱点が大きく重なっていない',d:`${need}匹以上が同じ弱点で、受けられる味方もいない、というタイプはありません。`});
  /* 2. 攻撃の範囲：登録した技があればその技、なければタイプ一致技で */
  const atkTypes=o=>{const mv=((o.x.set&&o.x.set.mv)||[]).map(z=>z&&mvInfo(z.id)).filter(i=>i&&i.pow>0).map(i=>i.t);return mv.length?mv:o.p.t};
  const hits=new Set();ms.forEach(o=>atkTypes(o).forEach(a=>T.forEach(d=>{if(mult(a,[d])>=2)hits.add(d)})));
  const miss=T.filter(d=>!hits.has(d));
  if(miss.length>=3){const sub=[];
    ms.forEach(o=>{const ls=LSD[o.p.no]?LSD[o.p.no][1]:[];const best=ls.map(id=>({id,i:mvInfo(id)})).filter(z=>z.i&&z.i.pow>=70&&z.i.cls<2&&miss.some(d=>mult(z.i.t,[d])>=2)).sort((a,b)=>miss.filter(d=>mult(b.i.t,[d])>=2).length-miss.filter(d=>mult(a.i.t,[d])>=2).length||b.i.pow-a.i.pow)[0];
      if(best)sub.push(`${esc(o.p.n)}の${esc(mName(best.id))}（${best.i.t}）`)});
    fix.push({k:'type',t:`効果ばつぐんを取れないタイプが${miss.length}タイプある`,d:`${hasSets?'登録した技':'タイプ一致の技'}では、${miss.join('・')}タイプの相手に効果ばつぐんを取れません。`,how:sub.length?`サブの技を入れると範囲が広がります。例：${sub.slice(0,3).join('、')}。またはポケモンを入れかえます。`:'ほかのタイプの技を持つポケモンと入れかえます。',
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
  else if(ms.length>=3&&T.some(t=>m(ms[0],t)>=2))fix.push({k:'type',t:'交代で受け合える組み合わせが少ない',d:'お互いの弱点を受け合える2匹がいないので、不利な相手が出てきたときに、交代で受けにくい形です。',how:`${esc(ms[0].p.n)}の弱点（${T.filter(t=>m(ms[0],t)>=2).join('・')||'なし'}）を受けられるポケモンと入れかえると、交代しやすくなります。`,sw:swaps(outOf(x=>x!==ms[0]),q=>T.filter(t=>m(ms[0],t)>=2).every(t=>monDef(q).find(z=>z.t===t).m<1),cands(T.filter(t=>m(ms[0],t)>=2)))});
  /* 4. 持ち物（何を持たせているか） */
  const it=o=>o.x.set&&o.x.set.it&&o.x.set.it.k;
  const megas=ms.filter(o=>it(o)&&isStone(it(o)));
  /* メガシンカは1試合に1匹。パーティに2匹（相手を見てどちらかを選ぶ）はよくある形なので、気になる点にするのは
     「選出（★）に2匹以上」と「パーティに3匹以上」のときだけ */
  const allMegas=allMs.filter(o=>it(o)&&isStone(it(o)));
  if(full&&megas.length>=2){const keep=[...megas].sort((a,b)=>(megaOf(b.p.no,it(b))||b.p).bst-(megaOf(a.p.no,it(a))||a.p).bst)[0],out=megas.find(o=>o!==keep);
    fix.push({t:'選出にメガストーンが2匹',d:`メガシンカできるのは1試合に1匹だけなので、選出の${names(megas)}のうち1匹はメガシンカできません。`,how:`${esc(keep.p.n)}をメガシンカさせるなら、${esc(out.p.n)}をメガストーンを持たない匹と入れかえます。`,
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
  if(fastest>=165)good.push({t:'速いポケモンがいる',d:`いちばん速いポケモンは最速で${fastest}。多くの相手より先に動けます。`});
  else if(!scarf&&!prio&&!tw&&!trS.length)fix.push({t:'先に動く手段が少ない',d:`いちばん速いポケモンでも最速で${fastest}で、速い相手には先に攻撃されます。`,how:'こだわりスカーフ・先制技（でんこうせっか など）・おいかぜ・トリックルームのどれかを用意すると、速い相手にも対応しやすくなります。'});
  if(ms.length<entries.length||entries.length<6){}
  /* 選出（3〜4匹）では、受けられないタイプ・突けないタイプがあるのは当たり前なので、タイプの重なりは気になる点にしない（代わりに「選出の考え方」で相手ごとの選び方を出す） */
  return{scope,good,fix:full?fix.filter(x=>x.k!=='type'):fix};
}
/* ---- 選出の考え方：よく使われる相手40匹との1対1から、基本選出と「この相手がいるときはこう入れかえる」を出す ----
   1対1の点：お互いの最大ダメージから、何回で倒せるか（素早さで先に動ける方が有利）。選出は「相手のだれにも、選出のだれかが有利に戦える」が多い組み合わせ */
function selPlan(entries){
  const n=entries.length,K=Math.min(PICK(),n);if(n<=K)return null;
  const live=typeof META!=='undefined'&&META.rank&&META.rank.length>=20;
  const opps=(live?META.rank.map(x=>byNo[x.no]):gmOpps()).filter(Boolean).slice(0,40);
  const me=entries.map(x=>{try{return mkMon(byNo[x.no],'me',mySetFor(x.no))}catch(e){return null}});
  const spd=b=>b.st[5]*(b.item==='choicescarf'?1.5:1);
  const S=me.map(a=>opps.map(q=>{if(!a)return -2;try{
    const o=mkMon(q,'op',q.base&&byNo[q.base]?{...detSet(byNo[q.base]),ab:q.ab,item:null}:detSet(q));
    const x=estHit(a,o).pct,y=estHit(o,a).pct,mt=x>0?Math.ceil(100/x):9,ot=y>0?Math.ceil(100/y):9,f=spd(a)>spd(o);
    return Math.max(-2,Math.min(2,(ot-mt)+(f?.5:-.5)))}catch(e){return 0}}));
  const w=opps.map((_,j)=>1-j/(opps.length*2));
  const val=sub=>opps.reduce((t,_,j)=>t+w[j]*(Math.max(...sub.map(i=>S[i][j]))+.15*sub.reduce((u,i)=>u+S[i][j],0)/sub.length),0);
  /* メガシンカは1試合に1匹なので、メガストーンを持つ匹は選出に1匹まで */
  const stone=i=>{const k=entries[i].set&&entries[i].set.it&&entries[i].set.it.k;return !!k&&isStone(k)};
  const okSub=c=>c.filter(stone).length<=1;
  /* 軸（利用者が決めた、外さない1匹）は必ず選出に入れる */
  const ax=entries.findIndex(x=>x.axis);
  const all=combos([...Array(n).keys()],K).filter(c=>okSub(c)&&(ax<0||c.includes(ax)));if(!all.length)return null;
  const base=all.reduce((b,c)=>{const v=val(c);return !b||v>b.v?{c,v}:b},null).c;
  const avg=i=>S[i].reduce((t,v,j)=>t+v*w[j],0);
  const lead=[...base].sort((a,b)=>avg(b)-avg(a)).slice(0,LEADN());
  const good=sub=>opps.filter((_,j)=>Math.max(...sub.map(i=>S[i][j]))>=1).length;
  /* 入れかえ：控えの1匹が、基本選出が苦手な相手に強いとき */
  const bm=j=>Math.max(...base.map(i=>S[i][j])),weakJ=opps.map((_,j)=>j).filter(j=>bm(j)<1);
  const situ=[];
  [...Array(n).keys()].filter(i=>!base.includes(i)).forEach(b=>{
    const js=weakJ.filter(j=>S[b][j]>=1&&S[b][j]>=bm(j)+1);if(!js.length)return;
    const out=[...base].filter(x=>x!==ax&&okSub([...base.filter(y=>y!==x),b])).sort((x,y)=>js.reduce((t,j)=>t+S[x][j],0)-js.reduce((t,j)=>t+S[y][j],0)||avg(x)-avg(y))[0];if(out==null)return;
    situ.push({out,in:b,opps:js.map(j=>opps[j])})});
  situ.sort((a,b)=>b.opps.length-a.opps.length);
  /* ★で選んでいる選出が苦手な相手 */
  const sel=entries.map((x,i)=>x.sel?i:-1).filter(i=>i>=0);
  const selWeak=sel.length===K?opps.map((q,j)=>({q,j})).filter(({j})=>Math.max(...sel.map(i=>S[i][j]))<.5).slice(0,6):[];
  /* 1匹ずつの役割：出す相手（パーティでいちばん有利に戦える相手）・出さない相手（不利な相手） */
  const roles=[...Array(n).keys()].map(i=>{
    const go=opps.map((q,j)=>({q,j})).filter(({j})=>S[i][j]>=1&&S[i][j]>=Math.max(...S.map(r=>r[j]))).map(x=>x.q);
    const no=opps.map((q,j)=>({q,j})).filter(({j})=>S[i][j]<=-1).map(x=>x.q);return{go,no}});
  /* 詰め役：先制技・こだわりスカーフ・積み技、なければいちばん速い匹 */
  const fin=i=>{const a=me[i];if(!a)return null;const pr=a.moves.find(m=>m&&m.pri>0&&m.pow>0);if(pr)return['prio',pr.n];if(a.item==='choicescarf')return['scarf',ITEMN.choicescarf];
    const k=((entries[i].set&&entries[i].set.mv)||[]).map(m=>m&&MD[m.id]&&MD[m.id][3]).find(z=>[...GM_PSET,...GM_SSET,...GM_BSET].includes(z));if(k){const id=Object.keys(MD).find(x=>MD[x][3]===k);return['setup',mName(+id)]}return null};
  const fins=base.filter(i=>fin(i));
  const finisher=fins.length?fins.sort((a,b)=>spd(me[b])-spd(me[a]))[0]:[...base].sort((a,b)=>spd(me[b])-spd(me[a]))[0];
  /* 環境の上位8匹に、だれが有利に戦えるか */
  const top=opps.slice(0,8).map((q,j)=>({q,ans:[...Array(n).keys()].filter(i=>S[i][j]>=1).sort((a,b)=>S[b][j]-S[a][j])}));
  return{base,lead,situ:situ.slice(0,3),good:good(base),total:opps.length,live,sel,selWeak,S,opps,roles,finisher,finWhy:fin(finisher),top,ax,me};
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
  return{name:{tm:'対面（有利な相手にぶつけて押し切る）',ac:'攻めのサイクル（攻撃しながら交代して有利を取る）',dc:'受けのサイクル（受けて回復しながら削る）',su:'積み（能力を上げて一気に抜く）'}[k],why:why[k].slice(0,4),mix:Object.keys(sc).filter(z=>z!==k&&sc[z]>=sc[k]-0).map(z=>({tm:'対面',ac:'攻めのサイクル',dc:'受けのサイクル',su:'積み'}[z]))};
}

