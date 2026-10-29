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
function teamView(arg){
  setHeader('パーティ');
  if(arg){const ids=[...new Set(arg.split('-').map(Number).filter(n=>byNo[n]))].slice(0,6);
    if(ids.length){team=ids.map((no,i)=>({no,sel:i<PICK()}));saveTeam();cur='#/team';setUrl('#/team')}}
  V.innerHTML=`
  <div class="pills tslots" id="tslots"></div><div id="tsync"></div>
  <p class="note" style="padding:6px 16px 12px">6匹まで登録し、<b>★で選出する${PICK()}匹</b>を決めます（${FMTN()}の形式）。</p>
  <div class="grid3" id="slots"></div>
  <div id="tsets"></div>
  <a class="row" href="#/import" style="border-top:1px solid var(--line);margin-top:12px"><div class="row-m"><div class="row-t">画像から取り込む</div><div class="row-s">ゲームのチーム画面のスクリーンショットから、技・持ち物・能力ポイントまで読み取る</div></div><span class="chev">${SVG(I.chev,18)}</span></a>
  <div class="btns">
    <button class="btn btn-p" id="shr">${SVG(I.share,17)}URLをコピー</button>
    <button class="btn btn-s" id="clr" style="flex:none;padding:0 20px">クリア</button></div>
  <div class="btns" style="padding-top:0"><button class="btn btn-s" id="tren">${SVG(I.list,16)}このパーティの名前を変える</button></div>


  <div id="tout"></div>
  <div class="sec"><h2>ポケモンを追加</h2></div>
  <div class="srch">${SVG(I.search,18)}<input id="tq" value="${tq}" placeholder="ポケモン名で検索" autocomplete="off" aria-label="追加するポケモンを検索"></div>
  <div id="tp" style="margin-top:8px"></div>`;
  document.getElementById('tq').oninput=e=>{tq=e.target.value;tpRender()};
  document.getElementById('shr').onclick=shareTeam;
  document.getElementById('clr').onclick=()=>{if(team.length&&!confirm(`「${teamName(TEAMS.cur)}」のポケモンをすべて外します。よろしいですか？`))return;team=[];saveTeam();teamRender()};
  document.getElementById('tren').onclick=()=>{const v=prompt('パーティの名前（20文字まで）',TEAMS.list[TEAMS.cur].name||teamName(TEAMS.cur));if(v==null)return;TEAMS.list[TEAMS.cur].name=v.trim().slice(0,20);saveTeam();teamRender()};
  document.getElementById('tslots').onclick=e=>{const b=e.target.closest('[data-tslot]');if(!b)return;switchTeam(+b.dataset.tslot);toast(`「${teamName(TEAMS.cur)}」に切り替えました`);teamRender()};
  teamRender();tpRender();syncBadge();if(PCF)teamSync();
}
function tpRender(){
  const q=tq.trim(),l=P.filter(p=>!q||nmHit(p,q)).slice(0,30);
  document.getElementById('tp').innerHTML=l.length?l.map(p=>
    `<button class="row" data-no="${p.no}" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line);text-align:left;color:inherit">
      <span class="av">${stamp(p)}</span><div class="row-m"><div class="row-t">${p.n}</div><div class="chips">${p.t.map(chip).join('')}<span class="rt">${p.roles.join('・')}</span></div></div>
      <div class="row-n"><b>${p.bst}</b><span>合計</span></div></button>`).join('')
    :'<p class="empty">見つかりません。</p>';
  document.querySelectorAll('#tp [data-no]').forEach(b=>b.onclick=()=>addTeam(+b.dataset.no));
}
function shareTeam(){
  if(!team.length){toast('パーティが空です');return}
  const u=location.href.split('#')[0]+'#/team/'+team.map(x=>x.no).join('-');
  (navigator.clipboard?navigator.clipboard.writeText(u):Promise.reject())
    .then(()=>toast('URLをコピーしました')).catch(()=>prompt('URLをコピーしてください',u));
}
function teamRender(){
  const ts=document.getElementById('tslots');
  if(ts)ts.innerHTML=TEAMS.list.map((s,i)=>`<button class="pill" data-tslot="${i}" aria-pressed="${i===TEAMS.cur}"><span data-notr>${esc(teamName(i))}</span><small>${(i===TEAMS.cur?team:s.team).length}${L('匹','')}</small></button>`).join('');
  document.getElementById('slots').innerHTML=Array.from({length:6},(_,i)=>{
    const x=team[i],p=x&&byNo[x.no];
    return p?`<div class="tile${x.sel?' on':''}" data-ti="${i}" style="cursor:pointer">
      <div class="acts"><button data-sel="${i}" class="${x.sel?'lit':''}" aria-label="${p.n}を選出する" aria-pressed="${x.sel}">${SVG(I.star,15).replace('fill="none"',x.sel?'fill="currentColor"':'fill="none"')}</button><button data-rm="${i}" aria-label="${p.n}を外す">${SVG(I.x,15)}</button></div>
      <span class="av" style="width:38px;height:38px">${stamp(p)}</span><div class="nm">${p.n}</div><div class="tt">${p.t.map(t=>`<span style="background:${COL[t]};color:${ONC[t]}" title="${t}">${ticon(t,14)}</span>`).join('')}</div></div>`
    :`<div class="tile empty">枠 ${i+1}</div>`}).join('');
  document.getElementById('tsets').innerHTML=team.length?`<div class="sec" style="padding-top:18px"><h2>育成</h2><span style="font-size:13px;color:var(--dim)">タップで編集</span></div>`+team.map((x,i)=>{const p=byNo[x.no],s=x.set;
    const sub=s&&s.sp?[`<div class="row-s">${[s.ab&&s.ab.n,s.it&&s.it.n,natName(s.up,s.dn)].filter(Boolean).map(esc).join('／')}</div>`,`<div class="row-s">${(s.mv||[]).filter(m=>m&&m.n).map(m=>esc(m.n)).join('・')}</div>`,`<div class="row-s" style="color:var(--mute)">${spLine(s.sp)}</div>`].join('')
      :`<div class="row-s" style="color:var(--mute)">${s?'能力ポイント未入力':'未設定'}（よくある型で計算中）</div>`;
    return `<a class="row" href="#/edit/${i}" style="align-items:flex-start;content-visibility:visible"><span class="av">${stamp(p)}</span><div class="row-m"><div class="row-t">${p.n}${s&&s.src==='manual'?'<span class="atag on" style="margin-left:6px">入力済み</span>':s&&s.sp?'<span class="atag" style="margin-left:6px">画像から</span>':''}</div>${sub}</div><span class="chev">${SVG(I.chev,18)}</span></a>`}).join(''):'';
  document.querySelectorAll('#slots .tile[data-ti]').forEach(t=>t.onclick=e=>{if(e.target.closest('button'))return;nav('#/edit/'+t.dataset.ti)});
  document.querySelectorAll('[data-sel]').forEach(b=>b.onclick=()=>{
    const x=team[+b.dataset.sel];
    if(!x.sel&&team.filter(y=>y.sel).length>=PICK()){toast(`${FMTN()}で選出できるのは${PICK()}匹までです`);return}
    x.sel=!x.sel;saveTeam();teamRender()});
  document.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{team.splice(+b.dataset.rm,1);saveTeam();teamRender()});

  const out=document.getElementById('tout');
  let act=team.filter(x=>x.sel).map(x=>byNo[x.no]);
  if(!act.length)act=team.slice(0,4).map(x=>byNo[x.no]);
  if(!act.length){out.innerHTML='<p class="empty">ポケモンを追加すると診断が始まります。</p>';return}
  const rows=T.map(a=>{const ms=act.map(p=>mult(a,p.t));
    return{a,w:ms.filter(m=>m>1).length,r:ms.filter(m=>m<1).length,x4:ms.some(m=>m>=4)}});
  const danger=rows.filter(r=>r.w>=2&&r.r===0),warn=rows.filter(r=>r.w>=2&&r.r>0);
  const miss=T.filter(d=>!act.some(p=>p.t.some(t=>mult(t,[d])>=2)));
  let score=100-danger.length*14-warn.length*5-miss.length*3-rows.filter(r=>r.x4).length*2;
  if(act.length<4)score-=8;
  score=Math.max(0,Math.min(100,score));
  const g=score>=85?['S','#4ec98a']:score>=70?['A','#e8b33f']:score>=50?['B','#5aa9e6']:['C','#ff5d62'];
  const adv=[];
  if(danger.length)adv.push(`<b>${danger.map(r=>r.a).join('・')}</b>の技は複数が弱点で、受けられる仲間がいません。崩されやすい構成です。`);
  if(warn.length)adv.push(`<b>${warn.map(r=>r.a).join('・')}</b>の技は弱点が重なっています。耐性を持つ仲間に交代して受けましょう。`);
  if(miss.length)adv.push(`タイプ一致技で抜群を取れない相手は<b>${miss.join('・')}</b>です。サブ技か補完役で埋めましょう。`);
  if(!adv.length)adv.push('弱点の重なりも攻撃範囲の穴も目立ちません。バランスの取れた構成です。');
  const spd=[...act].sort((a,b)=>maxSpe(b)-maxSpe(a));
  out.innerHTML=`
  ${srcLine('calc')}<div class="score"><div class="g" style="background:${g[1]}">${g[0]}</div>
    <div><div class="l">総合スコア（選出${act.length}匹で診断）</div><div class="n" style="color:${g[1]}">${score}<i> / 100</i></div></div></div>
  <div class="advs">${adv.map(a=>`<p><span>${a}</span></p>`).join('')}</div>
  <div class="btns"><a class="btn btn-p" href="#/report">強み・弱み・警戒をくわしく見る</a></div>
  ${adSlot('診断結果下')}`;
}

