/* ===================== パーティの同期（ログインしている人だけ） =====================
   パーティ3つ（TEAMS）をサーバー（/api/me/teams）に保存し、どの端末でも同じにする。
   変更した時刻（TEAMS.updated）が新しい方を残す。端末の中身をサーバーの中身で置きかえるときは、念のため pcteams_backup に残す。 */
I.check='<path d="m5 12.5 4.5 4.5L19 7.5"/>';
const SYNC={busy:false,t:null,state:'',at:0,skew:0,again:false};
/* 枠ごとに合わせる（2026/11/12）：それぞれの枠で、変更時刻 at の新しいほうを残す。
   at がない（前の版で保存した）枠は、パーティ全体の時刻（端末 lu・サーバー su）で比べる。同じ時刻なら中身のあるほう、それも同じならサーバー */
function teamMerge(loc,srv,lu,su){
  const E={name:'',team:[],at:0};let cl=false,cs=false;
  const list=[];
  for(let i=0;i<TEAM_N;i++){
    const a=loc[i]||E,b=srv[i]||E,ea=a.at||lu||0,eb=b.at||su||0;
    let p;
    if(slotSig(a)===slotSig(b))p={...a,at:Math.max(ea,eb)};
    else if(ea!==eb)p={...(ea>eb?a:b),at:Math.max(ea,eb)};
    else p={...(a.team.length&&!b.team.length?a:b),at:ea};
    p={name:p.name||'',team:p.team,at:p.at||0};
    if(slotSig(p)!==slotSig(a))cl=true;
    if(slotSig(p)!==slotSig(b)||p.at!==(b.at||0))cs=true;
    list.push(p);
  }
  return{list,cl,cs};
}
/* サーバーの中身を端末に入れる。端末の中身が変わるときは、念のため pcteams_backup に残す。
   選んでいる枠はこの端末のまま（端末にパーティが1つもない＝はじめての端末なら、サーバーで選んでいた枠 scur） */
function teamsApply(list,scur){
  const had=TEAMS.list.some(s=>s.team.length);
  if(had)lsW('pcteams_backup',{at:Date.now(),teams:TEAMS});
  if(!had&&scur>=0&&scur<TEAM_N)TEAMS.cur=scur;
  TEAMS.list=list.map(s=>({name:String(s.name||'').slice(0,20),team:cleanTeam(s.team),at:s.at||0}));
  TEAMS.updated=Math.max(TEAMS.updated||0,...TEAMS.list.map(s=>s.at||0));
  TEAM_SIG=TEAMS.list.map(slotSig);
  team=TEAMS.list[TEAMS.cur].team.map(x=>({...x}));
  saveTeam(true);
  if(keyOf(cur)==='team'&&document.getElementById('slots'))teamRender();
}
/* 読む → 枠ごとに合わせる → 変わった方へ書く。送るのは必ず合わせたあとの中身（前は端末の中身をそのまま送り、ほかの端末の変更を消すことがあった） */
async function teamSync(force,retry=0){
  if(!PCF)return;
  if(SYNC.busy){if(force)SYNC.again=true;return}
  if(!force&&Date.now()-SYNC.at<20e3)return;
  SYNC.busy=true;SYNC.again=false;let conflict=false;const started=Date.now();
  try{
    await twAuth();
    if(!AUTH.user){SYNC.state='off';return}
    if(typeof memoPull==='function')memoPull();
    if(typeof favPull==='function')favPull();
    const j=await authFetch('/api/me/teams');
    if(j.now>0)SYNC.skew=j.now-Date.now();
    const su=j.updated_at||0,lu=TEAMS.updated||0;
    const srv=j.teams&&Array.isArray(j.teams.list)?j.teams.list.map(s=>({name:String(s&&s.name||'').slice(0,20),team:cleanTeam(s&&s.team),at:Math.max(0,Math.floor(+(s&&s.at)||0))})):[];
    const m=teamMerge(TEAMS.list,srv,lu,su);
    if(m.cl)teamsApply(m.list,j.teams?Math.floor(+j.teams.cur):-1);else m.list.forEach((x,i)=>{TEAMS.list[i].at=x.at});
    if(m.cs&&(j.teams||m.list.some(s=>s.team.length))){
      const up=Math.max(teamNow(),su+1);
      try{await authFetch('/api/me/teams',{teams:{cur:TEAMS.cur,list:m.list},updated_at:up});TEAMS.updated=Math.max(TEAMS.updated||0,up);try{localStorage.setItem('pcteams',JSON.stringify(TEAMS))}catch(e){}}
      catch(e){if(e.status===409)conflict=true;else throw e}
    }
    /* 同時に書いてサーバーに入らなかったときは「保存済み」にしない（読み直して合わせ直す。3回でだめなら失敗） */
    if(conflict)SYNC.state=retry<3?'retry':'err';else{SYNC.state='ok';SYNC.at=Date.now()}
  }catch(e){SYNC.state='err'}
  finally{
    SYNC.busy=false;syncBadge();
    /* 同期が終わった合図（2026/11/12、育成の画面の「自動保存済み ✓」用）。started より後に変えた分は、この同期には入っていない */
    try{document.dispatchEvent(new CustomEvent('pcsync',{detail:{state:SYNC.state,started}}))}catch(e){}
    /* ほかの端末と同時に書いた・同期の途中でまた変えた：もう一度読み直して合わせる（3回まで） */
    if((conflict||SYNC.again)&&retry<3){SYNC.again=false;setTimeout(()=>teamSync(true,retry+1),conflict?400:50)}
  }
}
/* パーティを変えたら少し待ってから合わせる（続けて変えたときに何度も送らない） */
function teamSyncSoon(){if(!PCF||typeof AUTH==='undefined'||!AUTH.user)return;clearTimeout(SYNC.t);SYNC.t=setTimeout(()=>teamSync(true),1500)}
/* ログアウトの前に、まだ送っていない変更を送る（10秒まで）。送れたら true */
async function userFlush(){
  clearTimeout(SYNC.t);
  const run=async()=>{
    for(let i=0;i<80&&SYNC.busy;i++)await new Promise(r=>setTimeout(r,100));
    await teamSync(true,3);
    const ok=SYNC.state==='ok';
    if(typeof FAV_T!=='undefined')clearTimeout(FAV_T);if(typeof MEMO_T!=='undefined')clearTimeout(MEMO_T);
    const f=typeof favPull==='function'?await favPull():true,m=typeof memoPull==='function'?await memoPull():true;
    return ok&&f!==false&&m!==false;
  };
  return Promise.race([run().catch(()=>false),new Promise(r=>setTimeout(()=>r(false),10e3))]);
}
/* この端末に残っている、ログインしていた人のデータ（パーティ・お気に入り・戦術メモ）を消す（2026/11/12）。
   ログアウトしたとき・前と違う人がログインしたときに使う（前は残ったままで、次にログインした人のアカウントに送られることがあった）。
   サーバーには残っているので、同じ人がもう一度ログインすれば戻る */
function userLocalReset(){
  clearTimeout(SYNC.t);if(typeof FAV_T!=='undefined')clearTimeout(FAV_T);if(typeof MEMO_T!=='undefined')clearTimeout(MEMO_T);
  TEAMS.list=Array.from({length:TEAM_N},()=>({name:'',team:[],at:0}));TEAMS.cur=0;TEAMS.updated=0;team=[];
  TEAM_SIG=TEAMS.list.map(slotSig);saveTeam(true);
  try{localStorage.removeItem('pcteams_backup')}catch(e){}
  if(typeof FAV!=='undefined'){const nos=Object.keys(FAV);nos.forEach(k=>delete FAV[k]);favSave();nos.forEach(n=>favPaint(+n))}
  if(typeof MEMO!=='undefined'){MEMO.mon={};MEMO.type={};MEMO.party={};try{localStorage.setItem('pcmemo',JSON.stringify(MEMO))}catch(e){}}
  SYNC.at=0;SYNC.state='';
  if(keyOf(cur)==='team'&&document.getElementById('slots'))teamRender();
}
function syncBadge(){
  const el=document.getElementById('tsync');if(!el)return;
  const on=typeof AUTH!=='undefined'&&AUTH.user;
  el.innerHTML=on?`<div class="tsync ok">${SVG(I.check,15)}<span>${SYNC.state==='err'?'サーバーに保存できませんでした。電波のよいところで自動でやり直します。':'ログイン中：パーティはどの端末でも同じになります（自動で保存）'}</span></div>`
    :PCF?`<a class="tsync" href="#/account">${SVG(I.user,15)}<span><b>ログイン</b>すると、スマホでもパソコンでも同じパーティを使えます</span></a>`:'';
}
setTimeout(()=>{let was='';try{was=localStorage.getItem('pcin')||''}catch(e){}if(was)teamSync(true)},1200);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&typeof AUTH!=='undefined'&&AUTH.user)teamSync()});
