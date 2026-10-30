/* ===================== タイムライン（投稿・フォロー・いいね・通知） =====================
   ログインしてプロフィールを作った人だけが書き込める（見るのはだれでも）。
   ・投稿は140文字。NGワード・リンク・連投は掲示板と同じく不可。ログインした人3人から通報されると自動で非表示
   ・media 列は将来の画像用（いまは使わない）
   ・返信は reply_to（返信先の投稿の番号）、リポストは repost_of（元の投稿の番号・本文なし）を持つ1行。
     リポストもふつうの投稿と同じ行なので、タイムラインの並び・ページングはそのまま使える
   ・タイムラインは「読むときに集める」方式（フォロー中の人の投稿を、そのつど索引で探す）。
     利用者が大きく増えたら「書くときに配る」方式（各自の受け取り箱）に切り替える
   ・ページングは id の小さい方へ（?before=最後のid）。OFFSET は使わない（件数が増えても速さが変わらない） */
const NOTE_MAX=140,PAGE=20;
/* ハッシュタグの取り出し（#のあとの文字・数字・_・ー。30文字まで、1投稿10個まで。大文字小文字・全角半角はそろえる） */
const tagsOf=t=>[...new Set([...String(t).matchAll(/[#＃]([\p{L}\p{N}_ー]{1,30})/gu)].map(m=>m[1].normalize('NFKC').toLowerCase()))].slice(0,10);
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
    db.prepare(`CREATE TABLE IF NOT EXISTS user_state(uid TEXT PRIMARY KEY,notif_seen INTEGER DEFAULT 0)`),
    /* ハッシュタグ（#〇〇）：投稿ごとに取り出して索引にする。検索は tag で探して新しい順 */
    db.prepare(`CREATE TABLE IF NOT EXISTS note_tags(tag TEXT NOT NULL,note_id INTEGER NOT NULL,created_at INTEGER,PRIMARY KEY(tag,note_id))`),
    db.prepare(`CREATE INDEX IF NOT EXISTS note_tags_note ON note_tags(note_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS note_tags_time ON note_tags(created_at)`)
  ]);
  /* あとから足した列（返信・リポスト）。すでにあるときのエラーは無視する */
  for(const c of ['reply_to INTEGER DEFAULT 0','repost_of INTEGER DEFAULT 0','replies INTEGER DEFAULT 0','reposts INTEGER DEFAULT 0']){
    try{await db.prepare(`ALTER TABLE notes ADD COLUMN ${c}`).run()}catch(e){}}
  await db.batch([
    db.prepare(`CREATE INDEX IF NOT EXISTS notes_reply ON notes(reply_to,id)`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS notes_repost ON notes(repost_of,uid) WHERE repost_of>0`)
  ]);
  SOCIAL_READY=true;
}
/* 投稿の一覧で返す形（uid やIPアドレスは出さない） */
/* リポストの行（n）は、元の投稿（o）の中身を出す。rid は並び・ページング用の行の番号 */
const NOTE_JOIN=`JOIN users u ON u.uid=n.uid AND u.banned=0 LEFT JOIN notes o ON o.id=n.repost_of AND n.repost_of>0 LEFT JOIN users ou ON ou.uid=o.uid`;
const NOTE_OK=`(n.repost_of=0 OR (o.hidden=0 AND ou.banned=0))`;
const NOTE_COLS=`n.id AS rid,COALESCE(o.id,n.id) AS id,COALESCE(o.body,n.body) AS body,COALESCE(o.created_at,n.created_at) AS created_at,
  COALESCE(o.media,n.media) AS media,COALESCE(o.media_hidden,n.media_hidden) AS media_hidden,COALESCE(o.likes,n.likes) AS likes,COALESCE(o.replies,n.replies) AS replies,COALESCE(o.reposts,n.reposts) AS reposts,COALESCE(o.reply_to,n.reply_to) AS reply_to,
  CASE WHEN o.id IS NULL THEN u.handle ELSE ou.handle END AS handle,CASE WHEN o.id IS NULL THEN u.name ELSE ou.name END AS name,
  CASE WHEN o.id IS NULL THEN NULL ELSE u.handle END AS rp_handle,CASE WHEN o.id IS NULL THEN NULL ELSE u.name END AS rp_name,
  (SELECT pu.handle FROM notes pn JOIN users pu ON pu.uid=pn.uid AND pu.banned=0 WHERE pn.id=COALESCE(o.reply_to,n.reply_to) AND pn.hidden=0) AS reply_handle,
  EXISTS(SELECT 1 FROM likes l WHERE l.uid=?1 AND l.note_id=COALESCE(o.id,n.id)) AS liked,
  EXISTS(SELECT 1 FROM notes x WHERE x.uid=?1 AND x.repost_of=COALESCE(o.id,n.id)) AS reposted`;
const mediaOut=r=>{let m=[];try{m=r.media?JSON.parse(r.media):[]}catch(e){}return Array.isArray(m)?m:[]};
const noteOut=r=>({id:r.id,body:r.body,media:r.media_hidden?[]:mediaOut(r),media_hidden:r.media_hidden?mediaOut(r).length:0,created_at:r.created_at,likes:r.likes||0,replies:r.replies||0,reposts:r.reposts||0,liked:!!r.liked,reposted:!!r.reposted,mine:!!r.mine,
  user:{handle:r.handle,name:r.name},reply_to:r.reply_to||null,reply_handle:r.reply_to?(r.reply_handle||''):null,rp:r.rp_handle?{handle:r.rp_handle,name:r.rp_name}:null});
const pageOut=rows=>({notes:rows.map(noteOut),next:rows.length===PAGE?rows[rows.length-1].rid:null});
/* 返信・リポストの数を数え直す */
const recount=(db,id)=>db.prepare(`UPDATE notes SET replies=(SELECT COUNT(*) FROM notes WHERE reply_to=?1 AND hidden=0),reposts=(SELECT COUNT(*) FROM notes WHERE repost_of=?1) WHERE id=?1`).bind(id);
const beforeOf=u=>{const b=parseInt(u.searchParams.get('before')||'',10);return b>0?b:9e15};
async function socialRate(db,uid,now){
  const r=await db.prepare(`SELECT (SELECT COUNT(*) FROM notes WHERE uid=?1 AND created_at>?2) AS n,(SELECT COUNT(*) FROM notes WHERE uid=?1 AND created_at>?3) AS d`).bind(uid,now-15e3,now-864e5).first();
  if(r&&r.n>0)return '連続の投稿は15秒あけてください。';
  if(r&&r.d>=100)return '1日に投稿できる回数（100件）を超えました。';
  return null;
}
async function socialApi(req,env,db,path,u,body,now,ip,ctx){
  const later=p=>{if(ctx&&ctx.waitUntil)ctx.waitUntil(p);else return p};
  if(!/^\/api\/(tl|notes|follow|notifs|u\/|search|tags)/.test(path))return null;
  await socialInit(db);
  let m;
  /* ログイン（見るだけなら不要）。書き込みにはプロフィールが必要 */
  const me=fbPid(env)?await authOf(req,env):null;
  const meRow=me?await db.prepare(`SELECT uid,handle,name,banned FROM users WHERE uid=?`).bind(me.uid).first():null;
  const meUid=meRow&&!meRow.banned?meRow.uid:'';
  const need=()=>!me?J({error:'ログインしてください。'},401):!meRow?J({error:'先にプロフィールを作ってください。'},403):meRow.banned?J({error:'このアカウントは利用を停止しています。'},403):null;
  const withMine=rows=>rows.map(r=>({...r,mine:meUid&&r.handle===meRow.handle}));

  /* タイムライン：みんな／フォロー中 */
  if(path==='/api/tl'&&req.method==='GET'){
    const tab=u.searchParams.get('tab')==='following'?'following':'all',before=beforeOf(u);
    if(tab==='following'){
      const e=need();if(e)return e;
      const r=await db.prepare(`SELECT ${NOTE_COLS} FROM notes n ${NOTE_JOIN}
        WHERE n.hidden=0 AND ${NOTE_OK} AND n.id<?2 AND (n.uid=?1 OR n.uid IN (SELECT dst FROM follows WHERE src=?1)) ORDER BY n.id DESC LIMIT ${PAGE}`).bind(meUid,before).all();
      return J(pageOut(withMine(r.results)));
    }
    const r=await db.prepare(`SELECT ${NOTE_COLS} FROM notes n ${NOTE_JOIN}
      WHERE n.hidden=0 AND ${NOTE_OK} AND n.id<?2 ORDER BY n.id DESC LIMIT ${PAGE}`).bind(meUid,before).all();
    return J(pageOut(withMine(r.results)));
  }
  /* 投稿する */
  if(path==='/api/notes'&&req.method==='POST'){
    const e=need();if(e)return e;
    const text=clean(body.body,NOTE_MAX*2+2);
    /* 画像（先に /api/media で送ったもの）。画像だけの投稿もできる */
    const med=await mediaAttach(db,meUid,body.media,0);
    if(Array.isArray(body.media)&&body.media.length&&!med.length)return J({error:'画像を送り直してください（時間がたって消えた可能性があります）。'},400);
    if(text.length<1&&!med.length)return J({error:'本文を入れてください。'},400);
    if([...text].length>NOTE_MAX)return J({error:`投稿は${NOTE_MAX}文字までです。`},400);
    const ng=(text&&ngCheck(text))||await socialRate(db,meUid,now);if(ng)return J({error:ng},400);
    /* 返信なら、返信先が見られる投稿か確かめる（リポストの行には返信できない） */
    const to=parseInt(body.reply_to,10)>0?parseInt(body.reply_to,10):0;
    const pa=to?await db.prepare(`SELECT n.id,n.uid,n.body FROM notes n JOIN users u ON u.uid=n.uid AND u.banned=0 WHERE n.id=? AND n.hidden=0 AND n.repost_of=0`).bind(to).first():null;
    if(to&&!pa)return J({error:'返信先の投稿が見つかりません（削除された可能性があります）。'},404);
    const r=await db.prepare(`INSERT INTO notes(uid,body,created_at,ip,reply_to,media) VALUES(?,?,?,?,?,?) RETURNING id`).bind(meUid,text,now,ip,to,med.length?JSON.stringify(med):null).first();
    if(r&&med.length)await mediaAttach(db,meUid,med.map(x=>x.k),r.id);
    const tg=tagsOf(text);if(r&&tg.length)await db.batch(tg.map(t=>db.prepare(`INSERT OR IGNORE INTO note_tags(tag,note_id,created_at) VALUES(?,?,?)`).bind(t,r.id,now)));
    if(pa&&r){const q=[recount(db,to)];
      if(pa.uid!==meUid)q.push(db.prepare(`INSERT OR IGNORE INTO notifs(uid,kind,actor,note_id,created_at) VALUES(?,'reply',?,?,?)`).bind(pa.uid,meUid,r.id,now));
      await db.batch(q);
      if(pa.uid!==meUid)await later(pushTo(db,pa.uid,{title:`${meRow.name}さんがあなたの投稿に返信しました`,body:text.slice(0,80),url:'#/n/'+r.id,tag:'reply-'+r.id},'reply:'+r.id))}
    return J({ok:true,id:r&&r.id});
  }
  /* 1件を読む */
  if((m=path.match(/^\/api\/notes\/(\d+)$/))&&req.method==='GET'){
    const r=await db.prepare(`SELECT ${NOTE_COLS} FROM notes n ${NOTE_JOIN} WHERE n.id=?2 AND n.hidden=0 AND n.repost_of=0`).bind(meUid,+m[1]).first();
    if(!r)return J({error:'投稿が見つかりません（削除された可能性があります）。'},404);
    /* 返信先の投稿もいっしょに返す */
    const pa=r.reply_to?await db.prepare(`SELECT ${NOTE_COLS} FROM notes n ${NOTE_JOIN} WHERE n.id=?2 AND n.hidden=0 AND n.repost_of=0`).bind(meUid,r.reply_to).first():null;
    return J({note:noteOut(withMine([r])[0]),parent:pa?noteOut(withMine([pa])[0]):null});
  }
  /* その投稿への返信（新しい順） */
  if((m=path.match(/^\/api\/notes\/(\d+)\/replies$/))&&req.method==='GET'){
    const r=await db.prepare(`SELECT ${NOTE_COLS} FROM notes n ${NOTE_JOIN} WHERE n.reply_to=?3 AND n.hidden=0 AND n.repost_of=0 AND n.id<?2 ORDER BY n.id DESC LIMIT ${PAGE}`).bind(meUid,beforeOf(u),+m[1]).all();
    return J(pageOut(withMine(r.results)));
  }
  /* 自分の投稿を消す */
  if((m=path.match(/^\/api\/notes\/(\d+)\/delete$/))&&req.method==='POST'){
    const e=need();if(e)return e;const id=+m[1];
    const own=await db.prepare(`SELECT reply_to,repost_of FROM notes WHERE id=? AND uid=?`).bind(id,meUid).first();
    const r=await db.prepare(`DELETE FROM notes WHERE id=? AND uid=?`).bind(id,meUid).run();
    if(!(r.meta&&r.meta.changes))return J({error:'消せる投稿が見つかりません。'},404);
    /* その投稿のリポストも消し、返信先・リポスト元の数を数え直す */
    await db.prepare(`DELETE FROM notes WHERE repost_of=?`).bind(id).run();
    await mediaDrop(env,db,'note_id=?',id);
    if(own&&own.reply_to)await recount(db,own.reply_to).run();
    if(own&&own.repost_of)await recount(db,own.repost_of).run();
    await db.batch([db.prepare(`DELETE FROM note_tags WHERE note_id=?`).bind(id),db.prepare(`DELETE FROM likes WHERE note_id=?`).bind(id),db.prepare(`DELETE FROM notifs WHERE note_id=?`).bind(id),db.prepare(`DELETE FROM reports WHERE kind='note' AND target=?`).bind(id)]);
    return J({ok:true});
  }
  /* いいね（on:false で取り消し） */
  if((m=path.match(/^\/api\/notes\/(\d+)\/like$/))&&req.method==='POST'){
    const e=need();if(e)return e;const id=+m[1];
    const n=await db.prepare(`SELECT id,uid,body FROM notes WHERE id=? AND hidden=0 AND repost_of=0`).bind(id).first();
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
      const had=await db.prepare(`SELECT 1 AS x FROM likes WHERE uid=? AND note_id=?`).bind(meUid,id).first();
      await db.batch(q);
      /* はじめてのいいねだけ、相手のスマホに通知 */
      if(!had&&n.uid!==meUid)await later(pushTo(db,n.uid,{title:`${meRow.name}さんがあなたの投稿にいいねしました`,body:String(n.body||'').slice(0,80),url:'#/n/'+id,tag:'like-'+id},'like:'+meUid+':'+id));
    }
    const r=await db.prepare(`SELECT likes FROM notes WHERE id=?`).bind(id).first();
    return J({ok:true,liked:body.on!==false,likes:r?r.likes:0});
  }
  /* リポスト（on:false で取り消し）。元の投稿の番号を指定する */
  if((m=path.match(/^\/api\/notes\/(\d+)\/repost$/))&&req.method==='POST'){
    const e=need();if(e)return e;const id=+m[1];
    const n=await db.prepare(`SELECT n.id,n.uid,n.body FROM notes n JOIN users u ON u.uid=n.uid AND u.banned=0 WHERE n.id=? AND n.hidden=0 AND n.repost_of=0`).bind(id).first();
    if(!n)return J({error:'投稿が見つかりません。'},404);
    if(body.on===false){
      await db.batch([db.prepare(`DELETE FROM notes WHERE uid=? AND repost_of=?`).bind(meUid,id),
        db.prepare(`DELETE FROM notifs WHERE kind='repost' AND actor=? AND note_id=?`).bind(meUid,id),recount(db,id)]);
    }else{
      const c=await db.prepare(`SELECT COUNT(*) AS c FROM notes WHERE uid=? AND repost_of>0 AND created_at>?`).bind(meUid,now-36e5).first();
      if(c&&c.c>=100)return J({error:'短い時間にリポストしすぎです。少し時間をおいてください。'},429);
      const had=await db.prepare(`SELECT 1 AS x FROM notes WHERE uid=? AND repost_of=?`).bind(meUid,id).first();
      if(!had){const q=[db.prepare(`INSERT OR IGNORE INTO notes(uid,body,created_at,ip,repost_of) VALUES(?,'',?,?,?)`).bind(meUid,now,ip,id),recount(db,id)];
        if(n.uid!==meUid)q.push(db.prepare(`INSERT OR IGNORE INTO notifs(uid,kind,actor,note_id,created_at) VALUES(?,'repost',?,?,?)`).bind(n.uid,meUid,id,now));
        await db.batch(q);
        if(n.uid!==meUid)await later(pushTo(db,n.uid,{title:`${meRow.name}さんがあなたの投稿をリポストしました`,body:String(n.body||'').slice(0,80),url:'#/n/'+id,tag:'repost-'+id},'repost:'+meUid+':'+id))}
    }
    const r=await db.prepare(`SELECT reposts FROM notes WHERE id=?`).bind(id).first();
    return J({ok:true,reposted:body.on!==false,reposts:r?r.reposts:0});
  }
  /* 通報（ログインした人。3人で自動的に非表示） */
  if((m=path.match(/^\/api\/notes\/(\d+)\/report$/))&&req.method==='POST'){
    const e=need();if(e)return e;const id=+m[1];
    const reason=REASONS.includes(body.reason)?body.reason:'その他',rid='u'+(await sha('note|'+meUid)).slice(0,15);
    await db.prepare(`INSERT OR IGNORE INTO reports(kind,target,reason,aid,created_at) VALUES('note',?,?,?,?)`).bind(id,reason,rid,now).run();
    const c=await db.prepare(`SELECT COUNT(*) AS n FROM reports WHERE kind='note' AND target=?`).bind(id).first();
    /* 画像つきの投稿は、通報1件で画像を確認待ちにする（運営者が確認して戻す） */
    await db.prepare(`UPDATE notes SET media_hidden=1 WHERE id=? AND media IS NOT NULL`).bind(id).run();
    if(c&&c.n>=3){await db.prepare(`UPDATE notes SET hidden=1 WHERE id=?`).bind(id).run();const p=await db.prepare(`SELECT reply_to FROM notes WHERE id=?`).bind(id).first();if(p&&p.reply_to)await recount(db,p.reply_to).run()}
    return J({ok:true});
  }
  /* 公開プロフィール（フォロー数つき） */
  if((m=path.match(/^\/api\/u\/([A-Za-z0-9_]{3,15})$/))&&req.method==='GET'){
    const p=await db.prepare(`SELECT uid,handle,name,bio,created_at,
      (SELECT COUNT(*) FROM follows WHERE dst=users.uid) AS followers,(SELECT COUNT(*) FROM follows WHERE src=users.uid) AS following,
      (SELECT COUNT(*) FROM notes WHERE uid=users.uid AND hidden=0 AND repost_of=0) AS notes,
      EXISTS(SELECT 1 FROM follows WHERE src=?2 AND dst=users.uid) AS followed,EXISTS(SELECT 1 FROM follows WHERE src=users.uid AND dst=?2) AS follows_me
      FROM users WHERE handle=?1 COLLATE NOCASE AND banned=0`).bind(m[1],meUid).first();
    if(!p)return J({error:'ユーザーが見つかりません。'},404);
    return J({user:{...pubUser(p),followers:p.followers,following:p.following,notes:p.notes,followed:!!p.followed,follows_me:!!p.follows_me,me:p.uid===meUid}});
  }
  /* その人の投稿 */
  if((m=path.match(/^\/api\/u\/([A-Za-z0-9_]{3,15})\/notes$/))&&req.method==='GET'){
    const r=await db.prepare(`SELECT ${NOTE_COLS} FROM notes n ${NOTE_JOIN}
      WHERE u.handle=?3 COLLATE NOCASE AND n.hidden=0 AND ${NOTE_OK} AND n.id<?2 ORDER BY n.id DESC LIMIT ${PAGE}`).bind(meUid,beforeOf(u),m[1]).all();
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
      const had=await db.prepare(`SELECT 1 AS x FROM follows WHERE src=? AND dst=?`).bind(meUid,t.uid).first();
      if(!had)await later(pushTo(db,t.uid,{title:`${meRow.name}さんにフォローされました`,body:'@'+meRow.handle,url:'#/u/'+meRow.handle,tag:'follow-'+meRow.handle},'follow:'+meUid));
      await db.batch([db.prepare(`INSERT OR IGNORE INTO follows(src,dst,created_at) VALUES(?,?,?)`).bind(meUid,t.uid,now),
        db.prepare(`INSERT OR IGNORE INTO notifs(uid,kind,actor,note_id,created_at) VALUES(?,'follow',?,0,?)`).bind(t.uid,meUid,now)]);
    }
    const f=await db.prepare(`SELECT COUNT(*) AS c FROM follows WHERE dst=?`).bind(t.uid).first();
    return J({ok:true,followed:body.on!==false,followers:f?f.c:0});
  }
  /* 検索：#タグ なら索引から、それ以外は本文に含むもの（新しい順・続きから）。人も名前・IDで探す */
  if(path==='/api/search'&&req.method==='GET'){
    const q=String(u.searchParams.get('q')||'').trim().slice(0,40),before=beforeOf(u);
    if(!q)return J({notes:[],users:[],next:null});
    const tag=q.match(/^[#＃]([\p{L}\p{N}_ー]{1,30})$/u);
    let r;
    if(tag)r=await db.prepare(`SELECT ${NOTE_COLS} FROM note_tags g JOIN notes n ON n.id=g.note_id ${NOTE_JOIN}
      WHERE g.tag=?3 AND n.hidden=0 AND n.id<?2 ORDER BY n.id DESC LIMIT ${PAGE}`).bind(meUid,before,tag[1].normalize('NFKC').toLowerCase()).all();
    else r=await db.prepare(`SELECT ${NOTE_COLS} FROM notes n ${NOTE_JOIN}
      WHERE n.hidden=0 AND ${NOTE_OK} AND n.id<?2 AND instr(lower(n.body),lower(?3))>0 ORDER BY n.id DESC LIMIT ${PAGE}`).bind(meUid,before,q).all();
    let users=[];
    if(!tag&&before>=9e15){const like='%'+q.replace(/[%_\\]/g,c=>'\\'+c)+'%';
      users=(await db.prepare(`SELECT handle,name,bio FROM users WHERE banned=0 AND (name LIKE ?1 ESCAPE '\\' OR handle LIKE ?1 ESCAPE '\\') LIMIT 5`).bind(like).all()).results.map(x=>({handle:x.handle,name:x.name,bio:x.bio||''}))}
    return J({...pageOut(withMine(r.results)),users});
  }
  /* よく使われているハッシュタグ（この7日間） */
  if(path==='/api/tags/trend'&&req.method==='GET'){
    const r=await db.prepare(`SELECT g.tag,COUNT(*) AS n FROM note_tags g JOIN notes n ON n.id=g.note_id AND n.hidden=0 WHERE g.created_at>? GROUP BY g.tag ORDER BY n DESC LIMIT 10`).bind(now-7*864e5).all();
    return J({tags:r.results});
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
async function socialDeleteUser(db,uid,env){
  await socialInit(db);await mediaInit(db);
  await mediaDrop(env,db,'uid=?',uid);
  await ladderInit(db);await db.prepare(`DELETE FROM season_teams WHERE uid=?`).bind(uid).run();
  /* 先に、この人が返信・リポストした相手の投稿の数を数え直す対象を控える */
  const tg=(await db.prepare(`SELECT DISTINCT CASE WHEN repost_of>0 THEN repost_of ELSE reply_to END AS id FROM notes WHERE uid=? AND (repost_of>0 OR reply_to>0)`).bind(uid).all()).results.map(x=>x.id);
  await db.batch([
    db.prepare(`DELETE FROM notes WHERE repost_of IN (SELECT id FROM notes WHERE uid=?)`).bind(uid),
    db.prepare(`DELETE FROM likes WHERE note_id IN (SELECT id FROM notes WHERE uid=?)`).bind(uid),
    db.prepare(`DELETE FROM notifs WHERE note_id IN (SELECT id FROM notes WHERE uid=?)`).bind(uid),
    db.prepare(`DELETE FROM note_tags WHERE note_id IN (SELECT id FROM notes WHERE uid=?)`).bind(uid),
    db.prepare(`DELETE FROM notes WHERE uid=?`).bind(uid),
    db.prepare(`UPDATE notes SET likes=MAX(0,likes-1) WHERE id IN (SELECT note_id FROM likes WHERE uid=?)`).bind(uid),
    db.prepare(`DELETE FROM likes WHERE uid=?`).bind(uid),
    db.prepare(`DELETE FROM follows WHERE src=? OR dst=?`).bind(uid,uid),
    db.prepare(`DELETE FROM notifs WHERE uid=? OR actor=?`).bind(uid,uid),
    db.prepare(`DELETE FROM user_state WHERE uid=?`).bind(uid)
  ]);
  if(tg.length)await db.batch(tg.map(id=>recount(db,id)));
}
async function socialCleanup(db,env){
  const now=Date.now();
  await socialInit(db);await mediaInit(db);
  /* 投稿に付かなかった画像は1日で消す */
  await mediaDrop(env,db,'note_id=0 AND created_at<?',now-864e5);
  await db.batch([
    db.prepare(`UPDATE notes SET ip='' WHERE created_at<? AND ip!=''`).bind(now-90*864e5),
    db.prepare(`DELETE FROM notifs WHERE created_at<?`).bind(now-90*864e5)
  ]);
}
