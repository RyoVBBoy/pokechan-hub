// B1 のテスト用の上位パーティ（主DB）。ai-b1.mjs と ai-b1-ui.mjs で共通。
/* ---------- フィクスチャ（主DB：シーズン・上位記録・利用者） ---------- */
const M=(no,o={})=>({no,set:{...(o.it?{it:{k:o.it}}:{}),...(o.ab?{ab:{k:o.ab}}:{}),mv:(o.mv||[]).map(id=>({id}))}});
const UT=369,TW=366,TR=433,FO=252;
export const TEAMS={
  D1:{s:'S2',fmt:'double',rank:3,rate:2100,team:[M(279,{ab:'drizzle',mv:[UT,542,182,TW]}),M(823,{mv:[UT]}),M(445),M(6,{it:'charizarditey'}),M(1000),M(730)]},
  D2:{s:'S2',fmt:'double',rank:10,rate:2050,team:[M(450,{ab:'sand-stream'}),M(530),M(778,{mv:[TR]}),M(115,{it:'kangaskhanite',mv:[FO]}),M(212,{mv:[UT]}),M(1000)]},
  D3:{s:'S2',fmt:'double',rank:20,rate:2000,team:[M(6,{it:'charizarditex'}),M(445),M(823,{mv:[UT]}),M(1000),M(861),M(212,{mv:[UT]})]},
  D5:{s:'S2',fmt:'double',rank:30,rate:1980,team:[M(450,{ab:'sand-stream'}),M(530),M(212,{mv:[UT]}),M(823,{mv:[UT]}),M(1000),M(1018)]},
  D6:{s:'S2',fmt:'double',rank:40,rate:1950,team:[M(450),M(530),M(778,{mv:[TR]}),M(6,{it:'charizarditey'}),M(212,{mv:[UT]}),M(1000)]},
  D4:{s:'S1',fmt:'double',rank:5,rate:2080,team:[M(6,{it:'charizarditey'}),M(130),M(302),M(324,{ab:'drought'}),M(186),M(149)]},
  SG1:{s:'S2',fmt:'single',rank:2,rate:2150,team:[M(445),M(149),M(6,{it:'charizarditex'}),M(212),M(1000),M(730)]}
};
/* 独立評価（stage-b1-acceptance.json）用に足す行：カイリューのいないシングル・メガシンカしないリザードン・図鑑にない番号の入った行 */
export const EXTRA={
  SG2:{s:'S2',fmt:'single',rank:5,rate:2100,team:[M(445),M(6,{it:'charizarditex'}),M(823,{mv:[UT]}),M(1000),M(730),M(212,{mv:[UT]})]},
  D7:{s:'S2',fmt:'double',rank:50,rate:1900,team:[M(6),M(445),M(823,{mv:[UT]}),M(1000),M(730),M(861)]},
  DX:{s:'S2',fmt:'double',rank:2,rate:2200,team:[M(999999),M(445),M(823),M(1000),M(730),M(861)]}
};
/* 出してはいけない行（どれも順位1・雨・メガリザードンY。漏れればすぐ分かる） */
const LEAK=()=>[M(279,{ab:'drizzle',mv:[UT,TW]}),M(149),M(130),M(6,{it:'charizarditey'}),M(445),M(823,{mv:[UT]})];
const LEAKS={L_priv:{uid:'u_priv'},L_only:{uid:'u_only'},L_foll:{uid:'u_foll'},L_ban:{uid:'u_ban'},L_hidden:{hidden:1},L_auto:{auto:1},L_self:{uid:'u_self',noReview:true},
  L_stale:{stale:true},L_oper:{by_admin:1,noReview:true},L_game:{game:'othergame'},L_five:{five:true}};
export async function seedB1(env,kind,A,opt={}){
  const DB=env.DB;
  await DB.prepare(`CREATE TABLE IF NOT EXISTS users(uid TEXT PRIMARY KEY,handle TEXT,name TEXT,banned INTEGER DEFAULT 0,private INTEGER DEFAULT 0)`).run();
  if(kind==='nodb')return{};
  await DB.prepare(`CREATE TABLE IF NOT EXISTS game_profiles(uid TEXT NOT NULL,game TEXT NOT NULL,partner INTEGER,showcase TEXT,updated_at INTEGER,vis TEXT DEFAULT 'inherit',card INTEGER DEFAULT 0,PRIMARY KEY(uid,game))`).run();
  /* ladder.js の ladderInit と同じ表（ladderInit は1回目の DB でしか作らないので、ここで作る） */
  await DB.prepare(`CREATE TABLE seasons(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,start TEXT,end TEXT,created_at INTEGER,note TEXT,game TEXT DEFAULT 'pokechamp')`).run();
  await DB.prepare(`CREATE TABLE season_teams(id INTEGER PRIMARY KEY AUTOINCREMENT,season_id INTEGER NOT NULL,fmt TEXT NOT NULL,uid TEXT,player TEXT,rank INTEGER,rate INTEGER,team TEXT,comment TEXT,proof TEXT,verified INTEGER DEFAULT 0,hidden INTEGER DEFAULT 0,by_admin INTEGER DEFAULT 0,created_at INTEGER,updated_at INTEGER,auto INTEGER DEFAULT 0,sources TEXT,gkey TEXT,reviewed_at INTEGER,reviewed_by TEXT,reviewed_proof TEXT,review_sig TEXT,game TEXT DEFAULT 'pokechamp')`).run();
  const ids={};if(kind==='empty')return ids;
  await DB.prepare(`INSERT INTO seasons(id,name,start,end,created_at) VALUES(11,'シーズンM-1','2026-09-01','2026-09-30',1),(12,'シーズンM-2','2026-10-01','2026-10-31',2)`).run();
  const s1=11,s2=12;let nid=100;
  ids.S1=s1;ids.S2=s2;
  for(const [u,o] of [['u_priv',{private:1}],['u_only',{}],['u_foll',{}],['u_ban',{banned:1}],['u_self',{}],['u_pub',{}]])
    await DB.prepare(`INSERT INTO users(uid,handle,name,banned,private) VALUES(?,?,?,?,?)`).bind(u,u,u,o.banned||0,o.private||0).run();
  await DB.prepare(`INSERT INTO game_profiles(uid,game,vis) VALUES('u_only','pokechamp','only_me'),('u_foll','pokechamp','followers')`).run();
  const ins=async(key,t)=>{
    const sid=t.s==='S1'?s1:s2,team=JSON.stringify(t.team),proof='proof-'+key;
    const id=++nid;await DB.prepare(`INSERT INTO season_teams(id,season_id,fmt,uid,player,rank,rate,team,comment,proof,verified,hidden,by_admin,auto,game,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,1,?,?,?,?,1,1)`)
      .bind(id,sid,t.fmt,t.uid||null,'player-'+key,t.rank,t.rate,team,'コメント（AI に出さない）',proof,t.hidden||0,t.by_admin||0,t.auto||0,t.game||'pokechamp').run();
    if(!t.noReview){const row=await DB.prepare(`SELECT * FROM season_teams WHERE id=?`).bind(id).first();
      await DB.prepare(`UPDATE season_teams SET reviewed_at=1,reviewed_by='op',reviewed_proof=?,review_sig=? WHERE id=?`).bind(proof,A.ladderSig(row),id).run();
      if(t.stale)await DB.prepare(`UPDATE season_teams SET rank=2 WHERE id=?`).bind(id).run()}
    ids[key]=id};
  const use=k=>!opt.only||opt.only.includes(k);
  for(const [k,t] of Object.entries({...TEAMS,...(opt.extra?EXTRA:{})}))if(use(k))await ins(k,t);
  for(const [k,o] of Object.entries(LEAKS)){const team=o.five?LEAK().slice(0,5):LEAK();if(use(k))await ins(k,{s:'S2',fmt:'double',rank:1,rate:2300,team,...o})}
  return ids;
}
