/* ===================== タイムライン（投稿・フォロー・いいね・通知） =====================
   ログインしてプロフィールを作った人だけが書き込める（見るのはだれでも）。
   ・投稿は140文字。NGワード・リンク・連投は掲示板と同じく不可。ログインした人3人から通報されると自動で非表示
   ・media 列は将来の画像用（いまは使わない）
   ・タイムラインは「読むときに集める」方式（フォロー中の人の投稿を、そのつど索引で探す）。
     利用者が大きく増えたら「書くときに配る」方式（各自の受け取り箱）に切り替える
   ・ページングは id の小さい方へ（?before=最後のid）。OFFSET は使わない（件数が増えても速さが変わらない） */
const NOTE_MAX=140,PAGE=20;
let SOCIAL_READY=false;
async function socialInit(db){
  if(SOCIAL_READY)return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS notes(id INTEGER PRIMARY KEY AUTOINCREMENT,uid TEXT NOT NULL,body TEXT,media TEXT,created_at INTEGER,likes INTEGER DEFAULT 0,hidden INTEGER DEFAULT 0,ip TEXT)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS notes_all ON notes(hidden,id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS notes_uid ON notes(uid,id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS notes_rate ON notes(uid,created_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS follows(src TEXT NOT NULL,dst TEXT NOT NULL,created_at INTEGER,PRIMARY KEY(src,dst))`),
    db.prepare(`CREATE INDEX IF NOT EXISTS follows_dst ON follows(dst,created_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS follows_rate ON follows(src,created_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS likes(uid TEXT NOT NULL,note_id INTEGER NOT NULL,created_at INTEGER,PRIMARY KEY(uid,note_id))`),
    db.prepare(`CREATE INDEX IF NOT EXISTS likes_note ON likes(note_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS likes_rate ON likes(uid,created_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS notifs(id INTEGER PRIMARY KEY AUTOINCREMENT,uid TEXT NOT NULL,kind TEXT,actor TEXT,note_id INTEGER DEFAULT 0,created_at INTEGER,UNIQUE(uid,kind,actor,note_id))`),
    db.prepare(`CREATE INDEX IF NOT EXISTS notifs_uid ON notifs(uid,id)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS user_state(uid TEXT PRIMARY KEY,notif_seen INTEGER DEFAULT 0)`)
  ]);
  SOCIAL_READY=true;
}
/* 投稿の一覧で返す形（uid やIPアドレスは出さない） */
const NOTE_COLS=`n.id,n.body,n.created_at,n.likes,u.handle,u.name,EXISTS(SELECT 1 FROM likes l WHERE l.uid=?1 AND l.note_id=n.id) AS liked`;
const noteOut=r=>({id:r.id,body:r.body,created_at:r.created_at,likes:r.likes||0,liked:!!r.liked,mine:!!r.mine,user:{handle:r.handle,name:r.name}});
const pageOut=rows=>({notes:rows.map(noteOut),next:rows.length===PAGE?rows[rows.length-1].id:null});
const beforeOf=u=>{const b=parseInt(u.searchParams.get('before')||'',10);return b>0?b:9e15};
async function socialRate(db,uid,now){
  const r=await db.prepare(`SELECT (SELECT COUNT(*) FROM notes WHERE uid=?1 AND created_at>?2) AS n,(SELECT COUNT(*) FROM notes WHERE uid=?1 AND created_at>?3) AS d`).bind(uid,now-15e3,now-864e5).first();
  if(r&&r.n>0)return '連続の投稿は15秒あけてください。';
  if(r&&r.d>=100)return '1日に投稿できる回数（100件）を超えました。';
  return null;
}
async function socialApi(req,env,db,path,u,body,now,ip){
  if(!/^\/api\/(tl|notes|follow|notifs|u\/)/.test(path))return null;
  await socialInit(db);
  let m;
  /* ログイン（見るだけなら不要）。書き込みにはプロフィールが必要 */
  const me=fbPid(env)?await authOf(req,env):null;
  const meRow=me?await db.prepare(`SELECT uid,handle,banned FROM users WHERE uid=?`).bind(me.uid).first():null;
  const meUid=meRow&&!meRow.banned?meRow.uid:'';
  const need=()=>!me?J({error:'ログインしてください。'},401):!meRow?J({error:'先にプロフィールを作ってください。'},403):meRow.banned?J({error:'このアカウントは利用を停止しています。'},403):null;
  const withMine=rows=>rows.map(r=>({...r,mine:meUid&&r.handle===meRow.handle}));

  /* タイムライン：みんな／フォロー中 */
  if(path==='/api/tl'&&req.method==='GET'){
    const tab=u.searchParams.get('tab')==='following'?'following':'all',before=beforeOf(u);
    if(tab==='following'){
      const e=need();if(e)return e;
      const r=await db.prepare(`SELECT ${NOTE_COLS} FROM notes n JOIN users u ON u.uid=n.uid AND u.banned=0
        WHERE n.hidden=0 AND n.id<?2 AND (n.uid=?1 OR n.uid IN (SELECT dst FROM follows WHERE src=?1)) ORDER BY n.id DESC LIMIT ${PAGE}`).bind(meUid,before).all();
      return J(pageOut(withMine(r.results)));
    }
    const r=await db.prepare(`SELECT ${NOTE_COLS} FROM notes n JOIN users u ON u.uid=n.uid AND u.banned=0
      WHERE n.hidden=0 AND n.id<?2 ORDER BY n.id DESC LIMIT ${PAGE}`).bind(meUid,before).all();
    return J(pageOut(withMine(r.results)));
  }
  /* 投稿する */
  if(path==='/api/notes'&&req.method==='POST'){
    const e=need();if(e)return e;
    const text=clean(body.body,NOTE_MAX*2+2);
    if(text.length<1)return J({error:'本文を入れてください。'},400);
    if([...text].length>NOTE_MAX)return J({error:`投稿は${NOTE_MAX}文字までです。`},400);
    const ng=ngCheck(text)||await socialRate(db,meUid,now);if(ng)return J({error:ng},400);
    const r=await db.prepare(`INSERT INTO notes(uid,body,created_at,ip) VALUES(?,?,?,?) RETURNING id`).bind(meUid,text,now,ip).first();
    return J({ok:true,id:r&&r.id});
  }
  /* 1件を読む */
  if((m=path.match(/^\/api\/notes\/(\d+)$/))&&req.method==='GET'){
    const r=await db.prepare(`SELECT ${NOTE_COLS} FROM notes n JOIN users u ON u.uid=n.uid AND u.banned=0 WHERE n.id=?2 AND n.hidden=0`).bind(meUid,+m[1]).first();
    return r?J({note:noteOut(withMine([r])[0])}):J({error:'投稿が見つかりません（削除された可能性があります）。'},404);
  }
  /* 自分の投稿を消す */
  if((m=path.match(/^\/api\/notes\/(\d+)\/delete$/))&&req.method==='POST'){
    const e=need();if(e)return e;const id=+m[1];
    const r=await db.prepare(`DELETE FROM notes WHERE id=? AND uid=?`).bind(id,meUid).run();
    if(!(r.meta&&r.meta.changes))return J({error:'消せる投稿が見つかりません。'},404);
    await db.batch([db.prepare(`DELETE FROM likes WHERE note_id=?`).bind(id),db.prepare(`DELETE FROM notifs WHERE note_id=?`).bind(id),db.prepare(`DELETE FROM reports WHERE kind='note' AND target=?`).bind(id)]);
    return J({ok:true});
  }
  /* いいね（on:false で取り消し） */
  if((m=path.match(/^\/api\/notes\/(\d+)\/like$/))&&req.method==='POST'){
    const e=need();if(e)return e;const id=+m[1];
    const n=await db.prepare(`SELECT id,uid FROM notes WHERE id=? AND hidden=0`).bind(id).first();
    if(!n)return J({error:'投稿が見つかりません。'},404);
    if(body.on===false){
      await db.batch([db.prepare(`DELETE FROM likes WHERE uid=? AND note_id=?`).bind(meUid,id),
        db.prepare(`DELETE FROM notifs WHERE kind='like' AND actor=? AND note_id=?`).bind(meUid,id),
        db.prepare(`UPDATE notes SET likes=(SELECT COUNT(*) FROM likes WHERE note_id=?1) WHERE id=?1`).bind(id)]);
    }else{
      const c=await db.prepare(`SELECT COUNT(*) AS c FROM likes WHERE uid=? AND created_at>?`).bind(meUid,now-36e5).first();
      if(c&&c.c>=300)return J({error:'短い時間にいいねしすぎです。少し時間をおいてください。'},429);
      const q=[db.prepare(`INSERT OR IGNORE INTO likes(uid,note_id,created_at) VALUES(?,?,?)`).bind(meUid,id,now),
        db.prepare(`UPDATE notes SET likes=(SELECT COUNT(*) FROM likes WHERE note_id=?1) WHERE id=?1`).bind(id)];
      if(n.uid!==meUid)q.push(db.prepare(`INSERT OR IGNORE INTO notifs(uid,kind,actor,note_id,created_at) VALUES(?,'like',?,?,?)`).bind(n.uid,meUid,id,now));
      await db.batch(q);
    }
    const r=await db.prepare(`SELECT likes FROM notes WHERE id=?`).bind(id).first();
    return J({ok:true,liked:body.on!==false,likes:r?r.likes:0});
  }
  /* 通報（ログインした人。3人で自動的に非表示） */
  if((m=path.match(/^\/api\/notes\/(\d+)\/report$/))&&req.method==='POST'){
    const e=need();if(e)return e;const id=+m[1];
    const reason=REASONS.includes(body.reason)?body.reason:'その他',rid='u'+(await sha('note|'+meUid)).slice(0,15);
    await db.prepare(`INSERT OR IGNORE INTO reports(kind,target,reason,aid,created_at) VALUES('note',?,?,?,?)`).bind(id,reason,rid,now).run();
    const c=await db.prepare(`SELECT COUNT(*) AS n FROM reports WHERE kind='note' AND target=?`).bind(id).first();
    if(c&&c.n>=3)await db.prepare(`UPDATE notes SET hidden=1 WHERE id=?`).bind(id).run();
    return J({ok:true});
  }
  /* 公開プロフィール（フォロー数つき） */
  if((m=path.match(/^\/api\/u\/([A-Za-z0-9_]{3,15})$/))&&req.method==='GET'){
    const p=await db.prepare(`SELECT uid,handle,name,bio,created_at,
      (SELECT COUNT(*) FROM follows WHERE dst=users.uid) AS followers,(SELECT COUNT(*) FROM follows WHERE src=users.uid) AS following,
      (SELECT COUNT(*) FROM notes WHERE uid=users.uid AND hidden=0) AS notes,
      EXISTS(SELECT 1 FROM follows WHERE src=?2 AND dst=users.uid) AS followed,EXISTS(SELECT 1 FROM follows WHERE src=users.uid AND dst=?2) AS follows_me
      FROM users WHERE handle=?1 COLLATE NOCASE AND banned=0`).bind(m[1],meUid).first();
    if(!p)return J({error:'ユーザーが見つかりません。'},404);
    return J({user:{...pubUser(p),followers:p.followers,following:p.following,notes:p.notes,followed:!!p.followed,follows_me:!!p.follows_me,me:p.uid===meUid}});
  }
  /* その人の投稿 */
  if((m=path.match(/^\/api\/u\/([A-Za-z0-9_]{3,15})\/notes$/))&&req.method==='GET'){
    const r=await db.prepare(`SELECT ${NOTE_COLS} FROM notes n JOIN users u ON u.uid=n.uid AND u.banned=0
      WHERE u.handle=?3 COLLATE NOCASE AND n.hidden=0 AND n.id<?2 ORDER BY n.id DESC LIMIT ${PAGE}`).bind(meUid,beforeOf(u),m[1]).all();
    return J(pageOut(withMine(r.results)));
  }
  /* フォロー（on:false でやめる） */
  if(path==='/api/follow'&&req.method==='POST'){
    const e=need();if(e)return e;
    const t=await db.prepare(`SELECT uid FROM users WHERE handle=? COLLATE NOCASE AND banned=0`).bind(String(body.handle||'')).first();
    if(!t)return J({error:'ユーザーが見つかりません。'},404);
    if(t.uid===meUid)return J({error:'自分はフォローできません。'},400);
    if(body.on===false){
      await db.batch([db.prepare(`DELETE FROM follows WHERE src=? AND dst=?`).bind(meUid,t.uid),db.prepare(`DELETE FROM notifs WHERE kind='follow' AND actor=? AND uid=?`).bind(meUid,t.uid)]);
    }else{
      const c=await db.prepare(`SELECT COUNT(*) AS c FROM follows WHERE src=? AND created_at>?`).bind(meUid,now-36e5).first();
      if(c&&c.c>=100)return J({error:'短い時間にフォローしすぎです。少し時間をおいてください。'},429);
      const all=await db.prepare(`SELECT COUNT(*) AS c FROM follows WHERE src=?`).bind(meUid).first();
      if(all&&all.c>=5000)return J({error:'フォローできるのは5000人までです。'},400);
      await db.batch([db.prepare(`INSERT OR IGNORE INTO follows(src,dst,created_at) VALUES(?,?,?)`).bind(meUid,t.uid,now),
        db.prepare(`INSERT OR IGNORE INTO notifs(uid,kind,actor,note_id,created_at) VALUES(?,'follow',?,0,?)`).bind(t.uid,meUid,now)]);
    }
    const f=await db.prepare(`SELECT COUNT(*) AS c FROM follows WHERE dst=?`).bind(t.uid).first();
    return J({ok:true,followed:body.on!==false,followers:f?f.c:0});
  }
  /* お知らせ */
  if(path==='/api/notifs/count'&&req.method==='GET'){
    if(!meUid)return J({unread:0});
    const r=await db.prepare(`SELECT COUNT(*) AS c FROM notifs WHERE uid=?1 AND id>COALESCE((SELECT notif_seen FROM user_state WHERE uid=?1),0)`).bind(meUid).first();
    return J({unread:r?Math.min(r.c,99):0});
  }
  if(path==='/api/notifs'&&req.method==='GET'){
    const e=need();if(e)return e;
    const r=await db.prepare(`SELECT n.id,n.kind,n.note_id,n.created_at,a.handle,a.name,substr(t.body,1,80) AS body
      FROM notifs n JOIN users a ON a.uid=n.actor AND a.banned=0 LEFT JOIN notes t ON t.id=n.note_id
      WHERE n.uid=?1 AND n.id<?2 ORDER BY n.id DESC LIMIT 30`).bind(meUid,beforeOf(u)).all();
    const seen=await db.prepare(`SELECT notif_seen FROM user_state WHERE uid=?`).bind(meUid).first();
    return J({notifs:r.results.map(x=>({id:x.id,kind:x.kind,note_id:x.note_id||null,body:x.body,created_at:x.created_at,user:{handle:x.handle,name:x.name}})),
      seen:seen?seen.notif_seen:0,next:r.results.length===30?r.results[29].id:null});
  }
  if(path==='/api/notifs/seen'&&req.method==='POST'){
    const e=need();if(e)return e;
    await db.prepare(`INSERT INTO user_state(uid,notif_seen) VALUES(?1,(SELECT COALESCE(MAX(id),0) FROM notifs WHERE uid=?1))
      ON CONFLICT(uid) DO UPDATE SET notif_seen=excluded.notif_seen`).bind(meUid).run();
    return J({ok:true});
  }
  return null;
}
/* アカウントを消すときに、その人のタイムラインの記録もすべて消す */
async function socialDeleteUser(db,uid){
  await socialInit(db);
  await db.batch([
    db.prepare(`DELETE FROM likes WHERE note_id IN (SELECT id FROM notes WHERE uid=?)`).bind(uid),
    db.prepare(`DELETE FROM notifs WHERE note_id IN (SELECT id FROM notes WHERE uid=?)`).bind(uid),
    db.prepare(`DELETE FROM notes WHERE uid=?`).bind(uid),
    db.prepare(`UPDATE notes SET likes=MAX(0,likes-1) WHERE id IN (SELECT note_id FROM likes WHERE uid=?)`).bind(uid),
    db.prepare(`DELETE FROM likes WHERE uid=?`).bind(uid),
    db.prepare(`DELETE FROM follows WHERE src=? OR dst=?`).bind(uid,uid),
    db.prepare(`DELETE FROM notifs WHERE uid=? OR actor=?`).bind(uid,uid),
    db.prepare(`DELETE FROM user_state WHERE uid=?`).bind(uid)
  ]);
}
async function socialCleanup(db){
  const now=Date.now();
  await socialInit(db);
  await db.batch([
    db.prepare(`UPDATE notes SET ip='' WHERE created_at<? AND ip!=''`).bind(now-90*864e5),
    db.prepare(`DELETE FROM notifs WHERE created_at<?`).bind(now-90*864e5)
  ]);
}
