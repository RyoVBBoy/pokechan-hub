/* ===================== パーティの同期（ログインしている人だけ） =====================
   パーティ3つ（TEAMS）をサーバー（/api/me/teams）に保存し、どの端末でも同じにする。
   変更した時刻（TEAMS.updated）が新しい方を残す。端末の中身をサーバーの中身で置きかえるときは、念のため pcteams_backup に残す。 */
I.check='<path d="m5 12.5 4.5 4.5L19 7.5"/>';
const SYNC={busy:false,t:null,state:'',at:0};
function teamsApply(t,at){
  const same=JSON.stringify(TEAMS.list.map(s=>s.team))===JSON.stringify(t.list.map(s=>s.team));
  if(!same&&TEAMS.list.some(s=>s.team.length))lsW('pcteams_backup',{at:Date.now(),teams:TEAMS});
  const list=t.list.map(s=>({name:String(s.name||'').slice(0,20),team:cleanTeam(s.team)}));
  while(list.length<TEAM_N)list.push({name:'',team:[]});
  TEAMS.list=list.slice(0,TEAM_N);TEAMS.cur=t.cur>=0&&t.cur<TEAM_N?t.cur:0;TEAMS.updated=at;
  team=TEAMS.list[TEAMS.cur].team.map(x=>({...x}));
  saveTeam(true);
  if(keyOf(cur)==='team'&&document.getElementById('slots'))teamRender();
}
async function teamPush(){
  try{await authFetch('/api/me/teams',{teams:{cur:TEAMS.cur,list:TEAMS.list},updated_at:TEAMS.updated||Date.now()});SYNC.state='ok';SYNC.at=Date.now()}
  catch(e){if(e.status===409){SYNC.busy=false;return teamSync(true)}SYNC.state='err'}
  syncBadge();
}
async function teamSync(force){
  if(!PCF||SYNC.busy)return;
  if(!force&&Date.now()-SYNC.at<20e3)return;
  SYNC.busy=true;
  try{
    await twAuth();
    if(!AUTH.user){SYNC.state='off';return}
    const j=await authFetch('/api/me/teams'),lu=TEAMS.updated||0,su=j.updated_at||0;
    if(j.teams&&su>lu)teamsApply(j.teams,su);
    else if(lu>su){SYNC.busy=false;await teamPush();return}
    SYNC.state='ok';SYNC.at=Date.now();
  }catch(e){SYNC.state='err'}
  finally{SYNC.busy=false;syncBadge()}
}
/* パーティを変えたら少し待ってから保存（続けて変えたときに何度も送らない） */
function teamSyncSoon(){if(!PCF||typeof AUTH==='undefined'||!AUTH.user)return;clearTimeout(SYNC.t);SYNC.t=setTimeout(teamPush,1500)}
function syncBadge(){
  const el=document.getElementById('tsync');if(!el)return;
  const on=typeof AUTH!=='undefined'&&AUTH.user;
  el.innerHTML=on?`<div class="tsync ok">${SVG(I.check,15)}<span>${SYNC.state==='err'?'サーバーに保存できませんでした。電波のよいところで自動でやり直します。':'ログイン中：パーティはどの端末でも同じになります（自動で保存）'}</span></div>`
    :PCF?`<a class="tsync" href="#/account">${SVG(I.user,15)}<span><b>ログイン</b>すると、スマホでもパソコンでも同じパーティを使えます</span></a>`:'';
}
setTimeout(()=>{let was='';try{was=localStorage.getItem('pcin')||''}catch(e){}if(was)teamSync(true)},1200);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&typeof AUTH!=='undefined'&&AUTH.user)teamSync()});
