/* ===================== ランキングbot（2026/11/04） =====================
   毎朝の公開（GitHub Actions の gen-pages）が作る https://サイト/assets/tier.json（強いポケモンランキング、51-tier.js）を読み、
   1日1回、タイムラインに「今日のSランク・上がった/下がったポケモン」を投稿する（本文は当サイトの計算から作る）。
   ・ランクバトルの集計で作った日（live）だけ。tier.json の日付が今日（日本時間）でなければ投稿しない
   ・前回のランクは bot_state（k='tier_prev'）に覚え、くらべて変化を書く
   ・POST /api/admin/rankbot（管理者）で今すぐ確かめる（force で同じ日でも投稿） */
const RANK_UID='bot:rank';
const RANK_SITE=env=>String(env.SITE_URL||'https://pokechan-hub.pages.dev').replace(/\/$/,'');
const jstDay=ms=>new Date(ms+9*36e5).toISOString().slice(0,10);
async function rankInit(db){
  await db.prepare(`CREATE TABLE IF NOT EXISTS bot_state(k TEXT PRIMARY KEY,v TEXT,updated_at INTEGER)`).run();
  const u=await db.prepare(`SELECT uid FROM users WHERE uid=?`).bind(RANK_UID).first();
  if(!u)await db.prepare(`INSERT OR IGNORE INTO users(uid,handle,name,bio,created_at,updated_at,agreed_at) VALUES(?,?,?,?,?,?,?)`).bind(RANK_UID,'ranking_bot','ランキングbot（当サイトの計算）','強いポケモンランキングの変化を、毎日お知らせします。ランクバトルの使用率と、当サイトのダメージ計算から作っています。',Date.now(),Date.now(),Date.now()).run();
}
function rankBody(T,prev){
  const fm=T.fmt==='double'?'ダブル':'シングル',S=T.rows.filter(r=>r.tier==='S').map(r=>r.name);
  const ord={S:4,A:3,B:2,C:1},up=[],down=[];
  if(prev)T.rows.forEach(r=>{const b=prev[r.no];if(b&&b!==r.tier){(ord[r.tier]>ord[b]?up:down).push(`${r.name}（${b}→${r.tier}）`)}});
  const tail='\n#強いポケモンランキング';
  let s=`【今日の強いポケモン・${fm}】\nSランク：${S.slice(0,6).join('・')||'なし'}`;
  if(up.length)s+=`\n上がった：${up.slice(0,3).join('・')}`;
  if(down.length)s+=`\n下がった：${down.slice(0,2).join('・')}`;
  if(!prev)s+='\n（使用率と当サイトの計算から、毎日お知らせします）';
  return (s.length+tail.length>140?s.slice(0,140-tail.length-1)+'…':s)+tail;
}
async function rankBotRun(env,db,now,force){
  await socialInit(db);await rankInit(db);
  let T;try{const r=await fetch(RANK_SITE(env)+'/assets/tier.json',{cf:{cacheTtl:0}});if(!r.ok)return{posted:false,why:'tier.json '+r.status};T=await r.json()}catch(e){return{posted:false,why:'読めない'}}
  if(!T||!T.live||!Array.isArray(T.rows)||!T.rows.length)return{posted:false,why:'集計なし'};
  const today=jstDay(now);
  if(jstDay(T.at)!==today&&!force)return{posted:false,why:'古いランキング'};
  const last=await db.prepare(`SELECT v FROM bot_state WHERE k='rank_day'`).first();
  if(last&&last.v===today&&!force)return{posted:false,why:'今日は投稿済み'};
  const pv=await db.prepare(`SELECT v FROM bot_state WHERE k='tier_prev'`).first();
  let prev=null;try{prev=pv?JSON.parse(pv.v):null}catch(e){}
  const body=rankBody(T,prev);
  const r=await db.prepare(`INSERT INTO notes(uid,body,created_at,ip,reply_to,media,link) VALUES(?,?,?,?,0,NULL,?) RETURNING id`).bind(RANK_UID,body,now,'bot',RANK_SITE(env)+'/ranking/').first();
  /* #強いポケモンランキング で検索できるように */
  try{const tg=tagsOf(body);if(tg.length)await db.batch(tg.map(t=>db.prepare(`INSERT OR IGNORE INTO note_tags(tag,note_id,created_at) VALUES(?,?,?)`).bind(t,r.id,now)))}catch(e){}
  const cur={};T.rows.forEach(x=>{cur[x.no]=x.tier});
  await db.batch([db.prepare(`INSERT INTO bot_state(k,v,updated_at) VALUES('rank_day',?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v,updated_at=excluded.updated_at`).bind(today,now),
    db.prepare(`INSERT INTO bot_state(k,v,updated_at) VALUES('tier_prev',?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v,updated_at=excluded.updated_at`).bind(JSON.stringify(cur),now)]);
  return{posted:true,id:r.id,body};
}
async function rankCron(env){if(!env.DB)return;try{await rankBotRun(env,env.DB,Date.now())}catch(e){}}
async function rankApi(req,env,db,path,body,now,isAdmin){
  if(path==='/api/admin/rankbot'&&req.method==='POST'){if(!isAdmin)return J({error:'管理用の合言葉が違います。'},401);return J(await rankBotRun(env,db,now,!!body.force))}
  return null;
}
