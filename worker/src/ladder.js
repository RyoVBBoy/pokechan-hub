/* ===================== シーズンごとの上位パーティ =====================
   ・シーズン（名前・期間）は運営者が管理画面で登録する（seasons）
   ・パーティは、ログインした利用者が自分の結果（最終順位・レート・6匹と育成）を登録するか、運営者が登録する（season_teams）
     利用者は1シーズン・1形式につき1件（あとから直せる・消せる）
   ・証拠のスクリーンショット（任意）は運営者だけが見られる。運営者が確かめたら「確認済み」（verified）。運営者の登録は最初から確認済み
     スクリーンショットは media 表に note_id＝-（パーティの番号）で入れる（投稿の画像とは別。1日の掃除の対象にならない）
   ・一覧は順位の小さい順（順位がなければレートの高い順）。よく使われたポケモンも集計する */
let LADDER_READY=false;
async function ladderInit(db){
  if(LADDER_READY)return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS seasons(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,start TEXT,end TEXT,created_at INTEGER)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS season_teams(id INTEGER PRIMARY KEY AUTOINCREMENT,season_id INTEGER NOT NULL,fmt TEXT NOT NULL,uid TEXT,player TEXT,rank INTEGER,rate INTEGER,team TEXT,comment TEXT,proof TEXT,verified INTEGER DEFAULT 0,hidden INTEGER DEFAULT 0,by_admin INTEGER DEFAULT 0,created_at INTEGER,updated_at INTEGER)`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS season_teams_user ON season_teams(season_id,fmt,uid) WHERE uid IS NOT NULL`),
    db.prepare(`CREATE INDEX IF NOT EXISTS season_teams_list ON season_teams(season_id,fmt,hidden)`)
  ]);
  /* あとから足した列：運営者の解説（シーズンのまとめに出す） */
  try{await db.prepare(`ALTER TABLE seasons ADD COLUMN note TEXT`).run()}catch(e){}
  LADDER_READY=true;
}
const isDay=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''));
/* パーティの形を確かめる：1〜6匹、番号は整数、育成（set）は小さなオブジェクト */
function ladderTeam(t){
  if(!Array.isArray(t)||t.length<1||t.length>6)return null;
  const out=t.map(x=>({no:x&&Number.isInteger(x.no)&&x.no>0&&x.no<20000?x.no:0,set:x&&x.set&&typeof x.set==='object'?x.set:undefined}));
  if(out.some(x=>!x.no)||new Set(out.map(x=>x.no)).size!==out.length)return null;
  const s=JSON.stringify(out);return s.length<=8000?s:null;
}
const intOrNull=(v,max)=>{const n=parseInt(v,10);return n>0&&n<=max?n:null};
/* プロフィールに出す実績（非表示でないもの・新しいシーズン順） */
async function ladderResults(db,uid){
  await ladderInit(db);
  const r=await db.prepare(`SELECT t.fmt,t.rank,t.rate,t.verified,s.name AS season FROM season_teams t JOIN seasons s ON s.id=t.season_id
    WHERE t.uid=? AND t.hidden=0 ORDER BY COALESCE(s.start,'') DESC,s.id DESC LIMIT 12`).bind(uid).all();
  return r.results.map(x=>({season:x.season,fmt:x.fmt,rank:x.rank,rate:x.rate,verified:!!x.verified}));
}
const ladderOut=(r,meUid)=>{let team=[];try{team=JSON.parse(r.team||'[]')}catch(e){}
  return{id:r.id,fmt:r.fmt,rank:r.rank,rate:r.rate,team,comment:r.comment||'',verified:!!r.verified,by_admin:!!r.by_admin,proof:!!r.proof,
    player:r.handle?{handle:r.handle,name:r.name}:{name:r.player||'（名前なし）'},mine:!!(meUid&&r.uid===meUid),updated_at:r.updated_at}};
async function ladderApi(req,env,db,path,u,body,now,isAdmin){
  if(!/^\/api\/(seasons|admin\/season)/.test(path))return null;
  await ladderInit(db);await mediaInit(db);
  let m;
  const admErr=()=>J({error:'管理用の合言葉が違います。'},401);
  /* シーズンの一覧（新しい順） */
  if(path==='/api/seasons'&&req.method==='GET'){
    const r=await db.prepare(`SELECT s.id,s.name,s.start,s.end,s.note,(SELECT COUNT(*) FROM season_teams t WHERE t.season_id=s.id AND t.hidden=0) AS n FROM seasons s ORDER BY COALESCE(s.start,'') DESC,s.id DESC`).all();
    return J({seasons:r.results});
  }
  const me=fbPid(env)?await authOf(req,env).catch(()=>null):null;
  const meRow=me?await db.prepare(`SELECT uid,handle,name,banned FROM users WHERE uid=?`).bind(me.uid).first():null;
  const meUid=meRow&&!meRow.banned?meRow.uid:'';
  /* そのシーズンのパーティと、よく使われたポケモン */
  if((m=path.match(/^\/api\/seasons\/(\d+)\/teams$/))&&req.method==='GET'){
    const fmt=u.searchParams.get('fmt')==='double'?'double':'single';
    const s=await db.prepare(`SELECT id,name,start,end,note FROM seasons WHERE id=?`).bind(+m[1]).first();
    if(!s)return J({error:'シーズンが見つかりません。'},404);
    const r=await db.prepare(`SELECT t.*,u.handle,u.name FROM season_teams t LEFT JOIN users u ON u.uid=t.uid
      WHERE t.season_id=? AND t.fmt=? AND t.hidden=0 AND (t.uid IS NULL OR (u.uid IS NOT NULL AND u.banned=0))
      ORDER BY t.rank IS NULL,t.rank,t.rate IS NULL,t.rate DESC,t.verified DESC,t.id LIMIT 200`).bind(s.id,fmt).all();
    const teams=r.results.map(x=>ladderOut(x,meUid));
    const cnt={};teams.forEach(t=>t.team.forEach(x=>{cnt[x.no]=(cnt[x.no]||0)+1}));
    const usage=Object.entries(cnt).map(([no,c])=>({no:+no,n:c,pc:Math.round(c/teams.length*1000)/10})).sort((a,b)=>b.n-a.n).slice(0,20);
    return J({season:s,fmt,teams,usage,total:teams.length});
  }
  /* 自分の結果を登録する（同じシーズン・形式なら上書き） */
  if((m=path.match(/^\/api\/seasons\/(\d+)\/teams$/))&&req.method==='POST'){
    if(!me)return J({error:'ログインしてください。'},401);
    if(!meRow)return J({error:'先にプロフィールを作ってください。'},403);
    if(meRow.banned)return J({error:'このアカウントは利用を停止しています。'},403);
    const s=await db.prepare(`SELECT id FROM seasons WHERE id=?`).bind(+m[1]).first();if(!s)return J({error:'シーズンが見つかりません。'},404);
    const fmt=body.fmt==='double'?'double':'single',team=ladderTeam(body.team);
    if(!team)return J({error:'パーティ（1〜6匹）を選んでください。'},400);
    const rank=intOrNull(body.rank,1e6),rate=intOrNull(body.rate,9999);
    if(!rank&&!rate)return J({error:'最終順位かレートのどちらかを入れてください。'},400);
    const comment=clean(body.comment,140);const ng=comment&&ngCheck(comment);if(ng)return J({error:ng},400);
    const old=await db.prepare(`SELECT id,proof,verified FROM season_teams WHERE season_id=? AND fmt=? AND uid=?`).bind(s.id,fmt,meUid).first();
    if(!old){const c=await db.prepare(`SELECT COUNT(*) AS c FROM season_teams WHERE uid=? AND created_at>?`).bind(meUid,now-864e5).first();if(c&&c.c>=10)return J({error:'1日に登録できる回数を超えました。'},429)}
    /* 証拠のスクリーンショット（先に /api/media で送ったもの） */
    let proof=old?old.proof:null,newProof=false;
    if(body.proof&&/^[0-9a-f]{32}$/.test(String(body.proof))&&body.proof!==proof){
      const p=await db.prepare(`SELECT key FROM media WHERE key=? AND uid=? AND note_id=0`).bind(String(body.proof),meUid).first();
      if(!p)return J({error:'スクリーンショットを送り直してください。'},400);proof=p.key;newProof=true}
    /* 中身を変えたら、確認済みはいったん外す */
    let id;
    if(old){await db.prepare(`UPDATE season_teams SET rank=?,rate=?,team=?,comment=?,proof=?,verified=0,updated_at=? WHERE id=?`).bind(rank,rate,team,comment,proof,now,old.id).run();id=old.id;
      if(newProof&&old.proof)await mediaDrop(env,db,'key=?',old.proof)}
    else{const r=await db.prepare(`INSERT INTO season_teams(season_id,fmt,uid,rank,rate,team,comment,proof,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) RETURNING id`).bind(s.id,fmt,meUid,rank,rate,team,comment,proof,now,now).first();id=r.id}
    if(newProof)await db.prepare(`UPDATE media SET note_id=? WHERE key=?`).bind(-id,proof).run();
    return J({ok:true,id});
  }
  /* 自分の登録を消す */
  if((m=path.match(/^\/api\/seasons\/teams\/(\d+)\/delete$/))&&req.method==='POST'){
    if(!meUid)return J({error:'ログインしてください。'},401);
    const t=await db.prepare(`SELECT id,proof FROM season_teams WHERE id=? AND uid=?`).bind(+m[1],meUid).first();
    if(!t)return J({error:'消せる登録が見つかりません。'},404);
    await db.prepare(`DELETE FROM season_teams WHERE id=?`).bind(t.id).run();
    if(t.proof)await mediaDrop(env,db,'key=?',t.proof);
    return J({ok:true});
  }
  /* ---- 運営者 ---- */
  if(path==='/api/admin/seasons'&&req.method==='POST'){
    if(!isAdmin)return admErr();
    if(body.delete){const n=await db.prepare(`SELECT COUNT(*) AS c FROM season_teams WHERE season_id=?`).bind(+body.id).first();
      if(n&&n.c)return J({error:'登録されたパーティがあるシーズンは消せません（先にパーティを非表示にしてください）。'},400);
      await db.prepare(`DELETE FROM seasons WHERE id=?`).bind(+body.id).run();return J({ok:true})}
    const name=clean(body.name,40);if(!name)return J({error:'シーズンの名前を入れてください。'},400);
    const st=isDay(body.start)?body.start:null,en=isDay(body.end)?body.end:null;
    if(st&&en&&st>en)return J({error:'終わりの日が始まりの日より前です。'},400);
    const note=clean(body.note,2000)||null;
    if(body.id){await db.prepare(`UPDATE seasons SET name=?,start=?,end=?,note=? WHERE id=?`).bind(name,st,en,note,+body.id).run();return J({ok:true,id:+body.id})}
    const r=await db.prepare(`INSERT INTO seasons(name,start,end,note,created_at) VALUES(?,?,?,?,?) RETURNING id`).bind(name,st,en,note,now).first();
    return J({ok:true,id:r.id});
  }
  if(path==='/api/admin/season-teams'&&req.method==='GET'){
    if(!isAdmin)return admErr();
    const r=await db.prepare(`SELECT t.*,u.handle,u.name,s.name AS season FROM season_teams t LEFT JOIN users u ON u.uid=t.uid JOIN seasons s ON s.id=t.season_id
      ORDER BY (t.proof IS NOT NULL AND t.verified=0) DESC,t.updated_at DESC LIMIT 100`).all();
    return J({teams:r.results.map(x=>({...ladderOut(x,''),season:x.season,season_id:x.season_id,hidden:!!x.hidden,proof_key:x.proof||null}))});
  }
  if(path==='/api/admin/season-teams'&&req.method==='POST'){
    if(!isAdmin)return admErr();
    /* 確認済みにする・非表示にする */
    if(body.id){const id=+body.id;
      if('verified' in body)await db.prepare(`UPDATE season_teams SET verified=? WHERE id=?`).bind(body.verified?1:0,id).run();
      if('hidden' in body)await db.prepare(`UPDATE season_teams SET hidden=? WHERE id=?`).bind(body.hidden?1:0,id).run();
      if(body.delete){const t=await db.prepare(`SELECT proof FROM season_teams WHERE id=?`).bind(id).first();await db.prepare(`DELETE FROM season_teams WHERE id=?`).bind(id).run();if(t&&t.proof)await mediaDrop(env,db,'key=?',t.proof)}
      return J({ok:true})}
    /* 運営者が登録する（はじめから確認済み） */
    const s=await db.prepare(`SELECT id FROM seasons WHERE id=?`).bind(+body.season_id).first();if(!s)return J({error:'シーズンを選んでください。'},400);
    const team=ladderTeam(body.team);if(!team)return J({error:'パーティ（1〜6匹）を選んでください。'},400);
    const player=clean(body.player,30);if(!player)return J({error:'プレイヤーの名前を入れてください。'},400);
    const rank=intOrNull(body.rank,1e6),rate=intOrNull(body.rate,9999);
    const r=await db.prepare(`INSERT INTO season_teams(season_id,fmt,player,rank,rate,team,comment,verified,by_admin,created_at,updated_at) VALUES(?,?,?,?,?,?,?,1,1,?,?) RETURNING id`)
      .bind(s.id,body.fmt==='double'?'double':'single',player,rank,rate,team,clean(body.comment,140),now,now).first();
    return J({ok:true,id:r.id});
  }
  return null;
}
