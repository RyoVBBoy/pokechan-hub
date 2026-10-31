/* ===================== 当サイトの使用率（利用者のデータから集計） =====================
   ・選出画面のスクショ読み取り（/api/opp-read）と対戦の記録（/api/battles）で見た「相手の6匹」を usage_seen に残す（だれが見たかは集計にだけ使い、公開しない）
   ・育成：ログインした人が保存したパーティ（user_data。ほかから写した型 src:'copy' は数えない）＋シーズンの上位パーティ＋対戦の記録で相手が見せた技・持ち物
   ・毎日の cron と、古くなったとき（6時間）に集め直して usage_cache に置く。GET /api/usage?fmt=single で公開（3人以上が見たポケモンだけ） */
let USAGE_READY=false;
async function usageInit(db){
  if(USAGE_READY)return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS usage_seen(uid TEXT NOT NULL,fmt TEXT,nos TEXT,src TEXT,day TEXT,created_at INTEGER)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS usage_seen_at ON usage_seen(created_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS usage_cache(fmt TEXT PRIMARY KEY,data TEXT,at INTEGER)`)
  ]);
  USAGE_READY=true;
}
/* 相手の6匹を見たことを残す（同じ人・同じ日・同じ6匹は1回） */
async function usageSeen(db,uid,fmt,nos,src,now){
  try{
    nos=[...new Set((nos||[]).map(Number).filter(n=>Number.isInteger(n)&&n>0))].slice(0,6).sort((a,b)=>a-b);
    if(nos.length<4)return;
    await usageInit(db);const day=new Date(now+9*36e5).toISOString().slice(0,10),k=JSON.stringify(nos);
    const d=await db.prepare(`SELECT 1 FROM usage_seen WHERE uid=? AND day=? AND nos=?`).bind(uid,day,k).first();
    if(!d)await db.prepare(`INSERT INTO usage_seen(uid,fmt,nos,src,day,created_at) VALUES(?,?,?,?,?,?)`).bind(uid,fmt==='double'?'double':'single',k,src,day,now).run();
  }catch(e){}
}
const usTop=(m,tot,n)=>Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,n).map(([k,v])=>[isNaN(+k)?k:+k,Math.round(v/tot*1000)/10]);
async function usageBuild(db,fmt,now){
  await usageInit(db);
  const days=30,since=now-days*864e5;
  /* 相手の選出画面に出てきた割合 */
  const rows=(await db.prepare(`SELECT uid,nos FROM usage_seen WHERE fmt=? AND created_at>? ORDER BY created_at DESC LIMIT 20000`).bind(fmt,since).all()).results;
  const cnt={},who={},users=new Set();
  rows.forEach(r=>{let a;try{a=JSON.parse(r.nos)}catch(e){return}users.add(r.uid);a.forEach(no=>{cnt[no]=(cnt[no]||0)+1;(who[no]=who[no]||new Set()).add(r.uid)})});
  const seen=Object.keys(cnt).filter(no=>who[no].size>=3).map(no=>[+no,cnt[no],Math.round(cnt[no]/rows.length*1000)/10]).sort((a,b)=>b[1]-a[1]);
  /* 育成：保存したパーティ・上位パーティ・対戦の記録 */
  const B={};const add=(no,s,w)=>{const b=B[no]=B[no]||{n:0,u:new Set(),it:{},ab:{},mv:{},nat:{},sp:{}};return b};
  const addSet=(no,s,uid)=>{if(!s||typeof s!=='object')return;const it=s.it&&s.it.k,ab=s.ab&&s.ab.k,mv=(Array.isArray(s.mv)?s.mv:[]).map(x=>x&&+x.id).filter(n=>n>0);
    if(!it&&!mv.length)return;const b=add(no);b.n++;if(uid)b.u.add(uid);
    if(it)b.it[it]=(b.it[it]||0)+1;if(ab)b.ab[ab]=(b.ab[ab]||0)+1;[...new Set(mv)].slice(0,4).forEach(id=>b.mv[id]=(b.mv[id]||0)+1);
    if(Number.isInteger(s.up)&&Number.isInteger(s.dn)&&s.up>0&&s.dn>0){const k=s.up+'-'+s.dn;b.nat[k]=(b.nat[k]||0)+1}
    if(Array.isArray(s.sp)&&s.sp.length===6){const k=s.sp.map(v=>+v||0).join('-');b.sp[k]=(b.sp[k]||0)+1}};
  const ud=(await db.prepare(`SELECT uid,teams FROM user_data WHERE updated_at>? LIMIT 3000`).bind(now-90*864e5).all().catch(()=>({results:[]}))).results;
  ud.forEach(r=>{let t;try{t=JSON.parse(r.teams)}catch(e){return}(t&&t.list||[]).forEach(l=>(l.team||[]).forEach(x=>{if(x&&x.set&&x.set.src!=='copy')addSet(x.no,x.set,r.uid)}))});
  try{const st=(await db.prepare(`SELECT uid,player,team FROM season_teams WHERE fmt=? AND hidden=0 ORDER BY id DESC LIMIT 2000`).bind(fmt).all()).results;
    st.forEach(r=>{let t;try{t=JSON.parse(r.team)}catch(e){return}(Array.isArray(t)?t:[]).forEach(x=>x&&addSet(x.no,x.set,r.uid||('p:'+(r.player||''))))})}catch(e){}
  try{const bt=(await db.prepare(`SELECT uid,opp_info FROM battles WHERE fmt=? AND created_at>? LIMIT 5000`).bind(fmt,since).all()).results;
    bt.forEach(r=>{let o;try{o=JSON.parse(r.opp_info||'{}')}catch(e){return}for(const [no,v] of Object.entries(o||{}))addSet(+no,{it:v.it?{k:v.it}:null,mv:(v.mv||[]).map(id=>({id}))},r.uid)})}catch(e){}
  const builds={};
  for(const [no,b] of Object.entries(B)){if(b.u.size<3)continue;
    builds[no]={n:b.n,it:usTop(b.it,b.n,6),ab:usTop(b.ab,b.n,3),mv:usTop(b.mv,b.n,10),nat:usTop(b.nat,b.n,3),sp:usTop(b.sp,b.n,3)}}
  return{fmt,days,previews:rows.length,users:users.size,seen,builds,at:now};
}
async function usageApi(req,env,db,path,now){
  if(path!=='/api/usage'||req.method!=='GET')return null;
  const fmt=new URL(req.url).searchParams.get('fmt')==='double'?'double':'single';
  await usageInit(db);
  const c=await db.prepare(`SELECT data,at FROM usage_cache WHERE fmt=?`).bind(fmt).first();
  if(c&&now-c.at<6*36e5)return new Response(c.data,{headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=600'}});
  const d=JSON.stringify(await usageBuild(db,fmt,now));
  await db.prepare(`INSERT INTO usage_cache(fmt,data,at) VALUES(?,?,?) ON CONFLICT(fmt) DO UPDATE SET data=excluded.data,at=excluded.at`).bind(fmt,d,now).run();
  return new Response(d,{headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=600'}});
}
async function usageDaily(env){
  if(!env.DB)return;const db=env.DB,now=Date.now();await usageInit(db);
  for(const fmt of ['single','double']){try{const d=JSON.stringify(await usageBuild(db,fmt,now));await db.prepare(`INSERT INTO usage_cache(fmt,data,at) VALUES(?,?,?) ON CONFLICT(fmt) DO UPDATE SET data=excluded.data,at=excluded.at`).bind(fmt,d,now).run()}catch(e){}}
  await db.prepare(`DELETE FROM usage_seen WHERE created_at<?`).bind(now-120*864e5).run();
}
