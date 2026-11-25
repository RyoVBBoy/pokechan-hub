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
    db.prepare(`CREATE INDEX IF NOT EXISTS note_tags_time ON note_tags(created_at)`),
    /* ブックマーク（2026/11/11）：本人だけが見られる保存。相手には知らせない・数も出さない */
    db.prepare(`CREATE TABLE IF NOT EXISTS bookmarks(uid TEXT NOT NULL,note_id INTEGER NOT NULL,created_at INTEGER,PRIMARY KEY(uid,note_id))`),
    db.prepare(`CREATE INDEX IF NOT EXISTS bookmarks_uid ON bookmarks(uid,created_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS bookmarks_note ON bookmarks(note_id)`)
  ]);
  /* あとから足した列（返信・リポスト）。すでにあるときのエラーは無視する */
  /* tool＝運営の Tips が紹介するツール（tips.js、2026/11/16） */
  for(const c of ['reply_to INTEGER DEFAULT 0','repost_of INTEGER DEFAULT 0','replies INTEGER DEFAULT 0','reposts INTEGER DEFAULT 0','link TEXT','tool TEXT']){
    try{await db.prepare(`ALTER TABLE notes ADD COLUMN ${c}`).run()}catch(e){}}
  /* プロフィールの写真（media の鍵。2026/11/03） */
  try{await db.prepare(`ALTER TABLE users ADD COLUMN avatar TEXT`).run()}catch(e){}
  /* トレーナーカード（2026/11/05）：相棒のポケモン（番号）と看板パーティ（JSON {n:名前,t:[番号…]}） */
  try{await db.prepare(`ALTER TABLE users ADD COLUMN partner INTEGER`).run()}catch(e){}
  try{await db.prepare(`ALTER TABLE users ADD COLUMN showcase TEXT`).run()}catch(e){}
  /* ゲームごとのカード（2026/11/18）：相棒・看板パーティはゲームの中身なので、共通の users ではなく game_profiles に（uid・game ごとに1行）。
     前の users.partner・users.showcase はポケモンチャンピオンズの分として残し、game_profiles に行がないときに読む（書きかえない・消さない） */
  await db.prepare(`CREATE TABLE IF NOT EXISTS game_profiles(uid TEXT NOT NULL,game TEXT NOT NULL,partner INTEGER,showcase TEXT,updated_at INTEGER,PRIMARY KEY(uid,game))`).run();
  /* ゲームごとの公開範囲（IA A5・A19）：inherit＝アカウントに合わせる（はじめ）／public／followers／only_me。アカウントが非公開なら public でもフォロワーのみ */
  try{await db.prepare(`ALTER TABLE game_profiles ADD COLUMN vis TEXT DEFAULT 'inherit'`).run()}catch(e){}
  /* ゲームカードを作ったか（2026/11/18）：本人が「ゲームカードを作る／保存する」を押したときだけ 1。
     相棒・看板パーティ・戦績・前の版の users の列からは決めない（前からいる人は 0 のまま＝勝手にカードを作らない） */
  try{await db.prepare(`ALTER TABLE game_profiles ADD COLUMN card INTEGER DEFAULT 0`).run()}catch(e){}
  /* 非公開アカウント（鍵垢、2026/11/11）：users.private=1 の人をフォローすると、本人が許可するまで follows.ok=0（リクエスト中）。
     ok=1 のフォローだけをフォロー数・フォロー中のタイムライン・投稿を見られる人・メッセージを送れる人に数える */
  try{await db.prepare(`ALTER TABLE users ADD COLUMN private INTEGER DEFAULT 0`).run()}catch(e){}
  /* メッセージを受け取る相手（2026/11/11）：'all'＝だれでも／'following'＝自分がフォローしている人だけ */
  try{await db.prepare(`ALTER TABLE users ADD COLUMN dm_from TEXT DEFAULT 'all'`).run()}catch(e){}
  /* 公式の運営の札（2026/11/19）：users.off＝1 のアカウントに「運営」の札。付けられるのは管理用の合言葉を持つ運営者だけ（tips.js の /api/admin/official）。
     本人の保存（/api/me）では変えられない。Tips（bot:tips）は前と同じく uid でいつも付く */
  try{await db.prepare(`ALTER TABLE users ADD COLUMN off INTEGER DEFAULT 0`).run()}catch(e){}
  try{await db.prepare(`ALTER TABLE follows ADD COLUMN ok INTEGER DEFAULT 1`).run()}catch(e){}
  await db.batch([
    db.prepare(`CREATE INDEX IF NOT EXISTS notes_reply ON notes(reply_to,id)`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS notes_repost ON notes(repost_of,uid) WHERE repost_of>0`)
  ]);
  /* 利用者のリンク・利用停止の記録の表（links.js。足すだけ・消さない） */
  await linksInit(db);
  SOCIAL_READY=true;
}
/* 投稿の一覧で返す形（uid やIPアドレスは出さない） */
/* リポストの行（n）は、元の投稿（o）の中身を出す。rid は並び・ページング用の行の番号 */
const NOTE_JOIN=`JOIN users u ON u.uid=n.uid AND u.banned=0 LEFT JOIN notes o ON o.id=n.repost_of AND n.repost_of>0 LEFT JOIN users ou ON ou.uid=o.uid`;
/* 非公開アカウントの投稿は、本人と許可されたフォロワーだけに見せる（?1＝見ている人の uid。ログインしていなければ空） */
const VIS=a=>`(${a}.private IS NULL OR ${a}.private=0 OR ${a}.uid=?1 OR EXISTS(SELECT 1 FROM follows vf WHERE vf.src=?1 AND vf.dst=${a}.uid AND vf.ok=1))`;
const NOTE_OK=`(n.repost_of=0 OR (o.hidden=0 AND ou.banned=0 AND ${VIS('ou')})) AND ${VIS('u')}`;
/* その人のゲームカードを、見ている人（p＝見ている人の uid の引数）が見られるか（作った・アカウントとゲームの公開範囲）。
   アイコンの輪（アカウントの印とは別の「ゲームカードがある」印）にだけ使う。見られない人には 0（あることも出さない） */
const CARDVIS=(a,p='?1')=>`EXISTS(SELECT 1 FROM game_profiles cg WHERE cg.uid=${a}.uid AND cg.game='pokechamp' AND cg.card=1 AND (cg.uid=${p} OR (COALESCE(cg.vis,'inherit')<>'only_me'
  AND ((COALESCE(cg.vis,'inherit') IN ('inherit','public') AND COALESCE(${a}.private,0)=0) OR EXISTS(SELECT 1 FROM follows cf WHERE cf.src=${p} AND cf.dst=${a}.uid AND cf.ok=1)))))`;
/* 「運営」の札が付くアカウントか（サーバーだけが決める。名前・ID では決めない） */
const OFFX=a=>`(${a}.uid='bot:tips' OR COALESCE(${a}.off,0)=1)`;
const NOTE_COLS=`n.id AS rid,COALESCE(o.id,n.id) AS id,COALESCE(o.body,n.body) AS body,COALESCE(o.created_at,n.created_at) AS created_at,
  COALESCE(o.media,n.media) AS media,COALESCE(o.link,n.link) AS link,COALESCE(o.tool,n.tool) AS tool,
  CASE WHEN o.id IS NULL THEN ${OFFX('u')} ELSE ${OFFX('ou')} END AS off,COALESCE(o.media_hidden,n.media_hidden) AS media_hidden,COALESCE(o.likes,n.likes) AS likes,COALESCE(o.replies,n.replies) AS replies,COALESCE(o.reposts,n.reposts) AS reposts,COALESCE(o.reply_to,n.reply_to) AS reply_to,
  CASE WHEN o.id IS NULL THEN u.handle ELSE ou.handle END AS handle,CASE WHEN o.id IS NULL THEN u.name ELSE ou.name END AS name,CASE WHEN o.id IS NULL THEN u.avatar ELSE ou.avatar END AS av,
  CASE WHEN o.id IS NULL THEN NULL ELSE u.handle END AS rp_handle,CASE WHEN o.id IS NULL THEN NULL ELSE u.name END AS rp_name,
  (SELECT pu.handle FROM notes pn JOIN users pu ON pu.uid=pn.uid AND pu.banned=0 WHERE pn.id=COALESCE(o.reply_to,n.reply_to) AND pn.hidden=0) AS reply_handle,
  EXISTS(SELECT 1 FROM likes l WHERE l.uid=?1 AND l.note_id=COALESCE(o.id,n.id)) AS liked,
  EXISTS(SELECT 1 FROM notes x WHERE x.uid=?1 AND x.repost_of=COALESCE(o.id,n.id)) AS reposted,
  EXISTS(SELECT 1 FROM bookmarks bk WHERE bk.uid=?1 AND bk.note_id=COALESCE(o.id,n.id)) AS saved,
  CASE WHEN o.id IS NULL THEN ${CARDVIS('u')} ELSE ${CARDVIS('ou')} END AS card,
  (SELECT json_array(nl.url,nl.host,nl.state) FROM note_links nl WHERE nl.note_id=COALESCE(o.id,n.id)) AS ulink`;
const mediaOut=r=>{let m=[];try{m=r.media?JSON.parse(r.media):[]}catch(e){}return Array.isArray(m)?m:[]};
/* link＝運営の bot のリンク（notes.link、利用者は書けない）。ulink＝利用者のリンク（note_links、links.js の lkOut） */
const noteOut=r=>({id:r.id,body:r.body,link:r.link||null,...(r.ulink?{ulink:lkOut(r,r.lkc)}:{}),media:r.media_hidden?[]:mediaOut(r),media_hidden:r.media_hidden?mediaOut(r).length:0,created_at:r.created_at,likes:r.likes||0,replies:r.replies||0,reposts:r.reposts||0,liked:!!r.liked,reposted:!!r.reposted,saved:!!r.saved,mine:!!r.mine,
  user:{handle:r.handle,name:r.name,av:r.av||null,...(r.off?{off:true}:{}),...(r.card?{card:true}:{})},...(r.tool?{tool:r.tool}:{}),reply_to:r.reply_to||null,reply_handle:r.reply_to?(r.reply_handle||''):null,rp:r.rp_handle?{handle:r.rp_handle,name:r.rp_name}:null});
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
/* 投稿を書く（15秒に1件・1日100件を、書く文そのものの中で確かめる＝同時に送られても決まりをこえない。数え方は socialRate と同じ） */
/* 停止の確かめも同じ文の中で（門を通ったあとに停止が作られても書かない。links.js の noteSancSQL。hs＝このリクエストのトークンの確認済みメールのハッシュ） */
const noteIns=(db,uid,text,now,ip,to,med,hs=[])=>db.prepare(`INSERT INTO notes(uid,body,created_at,ip,reply_to,media) SELECT ?1,?2,?3,?4,?5,?6
  WHERE NOT EXISTS(SELECT 1 FROM notes WHERE uid=?1 AND created_at>?3-15000) AND (SELECT COUNT(*) FROM notes WHERE uid=?1 AND created_at>?3-86400000)<100 ${noteSancSQL(hs.length)} RETURNING id`)
  .bind(uid,text,now,ip,to,med.length?JSON.stringify(med):null,...hs.map(x=>x.h));
async function socialApi(req,env,db,path,u,body,now,ip,ctx){
  const later=p=>{if(ctx&&ctx.waitUntil)ctx.waitUntil(p);else return p};
  if(!/^\/api\/(tl|notes|follow|notifs|u\/|search|tags|me\/bookmarks)/.test(path))return null;
  await socialInit(db);
  let m;
  /* ログイン（見るだけなら不要）。書き込みにはプロフィールが必要 */
  const me=fbPid(env)?await authOf(req,env):null;
  const meRow=me?await db.prepare(`SELECT uid,handle,name,banned FROM users WHERE uid=?`).bind(me.uid).first():null;
  const meUid=meRow&&!meRow.banned?meRow.uid:'';
  const need=()=>!me?J({error:'ログインしてください。'},401):!meRow?J({error:'先にプロフィールを作ってください。'},403):meRow.banned?J({error:'このアカウントは利用を停止しています。'},403):null;
  /* lkc：利用者のリンクを押せるか（LINKS_CLICK）。止めているときは一覧でも押せない文字にする（links.js の lkOut） */
  const lkc=lkOn(env,'LINKS_CLICK');
  const withMine=rows=>rows.map(r=>({...r,mine:meUid&&r.handle===meRow.handle,lkc}));

  /* タイムライン：みんな／フォロー中 */
  if(path==='/api/tl'&&req.method==='GET'){
    const tab=u.searchParams.get('tab')==='following'?'following':'all',before=beforeOf(u);
    if(tab==='following'){
      const e=need();if(e)return e;
      const r=await db.prepare(`SELECT ${NOTE_COLS} FROM notes n ${NOTE_JOIN}
        WHERE n.hidden=0 AND ${NOTE_OK} AND n.id<?2 AND (n.uid=?1 OR n.uid IN (SELECT dst FROM follows WHERE src=?1 AND ok=1)) ORDER BY n.id DESC LIMIT ${PAGE}`).bind(meUid,before).all();
      return J(pageOut(withMine(r.results)));
    }
    const r=await db.prepare(`SELECT ${NOTE_COLS} FROM notes n ${NOTE_JOIN}
      WHERE n.hidden=0 AND ${NOTE_OK} AND n.id<?2 ORDER BY n.id DESC LIMIT ${PAGE}`).bind(meUid,before).all();
    return J(pageOut(withMine(r.results)));
  }
  /* 投稿する */
  if(path==='/api/notes'&&req.method==='POST'){
    const e=need();if(e)return e;
    /* リンクを開いているとき（links.js）：形の違う値は断り、長さは形を直す前に確かめる（黙って切らない）。止めているときは前と同じ */
    const lkp=lkOn(env,'LINKS_POST');
    if(lkp){const bad=(body.body!=null&&typeof body.body!=='string')?'本文を読めませんでした。':(body.reply_to!=null&&typeof body.reply_to!=='number'&&typeof body.reply_to!=='string')?'返信先を読めませんでした。'
        :(typeof body.body==='string'&&body.body.length>LK_BODY_RAW_MAX)?`投稿は${NOTE_MAX}文字までです。`:null;
      /* 形のおかしいものも回数を数え（接続元ごと）、リンクを付けようとしていれば本人の枠も使う。超えたら429 */
      if(bad){if(await badReq(db,env,ip,now)||(lkIntent(body,typeof body.body==='string'?body.body:'')&&!await lkSlot(db,meUid,now)))return J({error:'形のおかしい送信が続いています。少し時間をおいてください。'},429);
        return J({error:bad},400)}}
    let text=clean(body.body,lkp?LK_BODY_RAW_MAX:NOTE_MAX*2+2);
    const lk=await lkForNote(env,db,me,meUid,body,text,now);
    if(lk.error)return J({error:lk.error,...(lk.code?{code:lk.code}:{})},lk.status||400);
    text=lk.text;
    /* 画像（先に /api/media で送ったもの）。画像だけの投稿もできる */
    const med=await mediaAttach(db,meUid,body.media,0);
    if(Array.isArray(body.media)&&body.media.length&&!med.length)return J({error:'画像を送り直してください（時間がたって消えた可能性があります）。'},400);
    if(text.length<1&&!med.length&&!lk.link)return J({error:'本文を入れてください。'},400);
    if([...text].length>NOTE_MAX)return J({error:`投稿は${NOTE_MAX}文字までです。`},400);
    const ng=(text&&ngCheck(text))||await socialRate(db,meUid,now);if(ng)return J({error:ng},400);
    /* 返信なら、返信先が見られる投稿か確かめる（リポストの行には返信できない） */
    const to=parseInt(body.reply_to,10)>0?parseInt(body.reply_to,10):0;
    const pa=to?await db.prepare(`SELECT n.id,n.uid,n.body FROM notes n JOIN users u ON u.uid=n.uid AND u.banned=0 WHERE n.id=? AND n.hidden=0 AND n.repost_of=0`).bind(to).first():null;
    if(to&&!pa)return J({error:'返信先の投稿が見つかりません（削除された可能性があります）。'},404);
    let r;const hs=GATE_HS.get(req)||[];
    if(lk.link){
      /* 安全確認はいちばん最後（ほかの確かめで断るものは外に送らない）。問題がなければ、投稿とリンクを1つの取引で書く */
      const c=await lkCheckForNote(env,db,meUid,lk.link,now);if(c.error)return J({error:c.error},c.status);
      /* リンクの行は、いま書いた投稿（同じ人・同じ時刻）が本当に書けたときだけ（回数の決まりで書けなければ、リンクも書かない） */
      /* last_insert_rowid() は使わない（書けなかったときに前の行の番号が残るため。Miniflare で確かめた）。
         同じ人・同じ時刻の投稿は15秒の決まりで1つしかないので、それを鍵にする */
      const out=await db.batch([noteIns(db,meUid,text,now,ip,to,med,hs),
        db.prepare(`INSERT INTO note_links(note_id,uid,url,host,state,verdict,verdict_at,expires_at,created_at,updated_at,rev,vh) SELECT n.id,?1,?2,?3,'ok','clean',?4,?5,?4,?4,0,?6
          FROM notes n WHERE n.uid=?1 AND n.created_at=?4 AND n.repost_of=0 ORDER BY n.id DESC LIMIT 1 RETURNING note_id AS id`).bind(meUid,lk.link.url,lk.link.host,now,c.t.exp,c.t.h)]);
      r=out[1]&&out[1].results&&out[1].results[0];
    }else r=await noteIns(db,meUid,text,now,ip,to,med,hs).first();
    /* 同時に送られて、15秒に1件・1日100件の決まりで書けなかった */
    if(!r){
      /* 書けなかった：門のあとに停止が作られたか（同じ文の中の確かめで止まった）・回数の決まりか */
      const sx=await db.prepare(`SELECT 1 AS x WHERE 1 ${noteSancSQL(hs.length)}`).bind(meUid,null,now,null,null,null,...hs.map(x=>x.h)).first();
      if(!sx)return J({error:SANC_MSG},403);
      return J({error:await socialRate(db,meUid,now)||'連続の投稿は15秒あけてください。'},400)}
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
    const r=await db.prepare(`SELECT ${NOTE_COLS} FROM notes n ${NOTE_JOIN} WHERE n.id=?2 AND n.hidden=0 AND n.repost_of=0 AND ${NOTE_OK}`).bind(meUid,+m[1]).first();
    if(!r)return J({error:'投稿が見つかりません（削除された可能性があります）。'},404);
    /* 返信先の投稿もいっしょに返す */
    const pa=r.reply_to?await db.prepare(`SELECT ${NOTE_COLS} FROM notes n ${NOTE_JOIN} WHERE n.id=?2 AND n.hidden=0 AND n.repost_of=0 AND ${NOTE_OK}`).bind(meUid,r.reply_to).first():null;
    return J({note:noteOut(withMine([r])[0]),parent:pa?noteOut(withMine([pa])[0]):null});
  }
  /* その投稿への返信（新しい順） */
  if((m=path.match(/^\/api\/notes\/(\d+)\/replies$/))&&req.method==='GET'){
    const r=await db.prepare(`SELECT ${NOTE_COLS} FROM notes n ${NOTE_JOIN} WHERE n.reply_to=?3 AND n.hidden=0 AND n.repost_of=0 AND ${NOTE_OK} AND n.id<?2 ORDER BY n.id DESC LIMIT ${PAGE}`).bind(meUid,beforeOf(u),+m[1]).all();
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
    await db.batch([db.prepare(`DELETE FROM note_links WHERE note_id=?`).bind(id),db.prepare(`DELETE FROM note_tags WHERE note_id=?`).bind(id),db.prepare(`DELETE FROM likes WHERE note_id=?`).bind(id),db.prepare(`DELETE FROM bookmarks WHERE note_id=?`).bind(id),db.prepare(`DELETE FROM notifs WHERE note_id=?`).bind(id),db.prepare(`DELETE FROM reports WHERE kind='note' AND target=?`).bind(id)]);
    return J({ok:true});
  }
  /* ブックマーク（on:false で外す）。本人だけの保存なので、相手への通知・数はない。1人2000件まで */
  if((m=path.match(/^\/api\/notes\/(\d+)\/bookmark$/))&&req.method==='POST'){
    const e=need();if(e)return e;const id=+m[1];
    if(body.on===false){await db.prepare(`DELETE FROM bookmarks WHERE uid=? AND note_id=?`).bind(meUid,id).run();return J({ok:true,saved:false})}
    const n=await db.prepare(`SELECT id FROM notes WHERE id=? AND hidden=0 AND repost_of=0`).bind(id).first();
    if(!n)return J({error:'投稿が見つかりません。'},404);
    const c=await db.prepare(`SELECT COUNT(*) AS c FROM bookmarks WHERE uid=?`).bind(meUid).first();
    if(c&&c.c>=2000)return J({error:'ブックマークは2000件までです。いらないものを外してください。'},429);
    await db.prepare(`INSERT OR IGNORE INTO bookmarks(uid,note_id,created_at) VALUES(?,?,?)`).bind(meUid,id,now).run();
    return J({ok:true,saved:true});
  }
  /* 自分のブックマークの一覧（保存した新しい順。before＝前のページの最後の保存時刻） */
  if(path==='/api/me/bookmarks'&&req.method==='GET'){
    const e=need();if(e)return e;
    const r=await db.prepare(`SELECT ${NOTE_COLS},bm.created_at AS bat FROM bookmarks bm JOIN notes n ON n.id=bm.note_id ${NOTE_JOIN}
      WHERE bm.uid=?1 AND bm.created_at<?2 AND n.hidden=0 AND n.repost_of=0 AND ${NOTE_OK} ORDER BY bm.created_at DESC LIMIT ${PAGE}`).bind(meUid,beforeOf(u)).all();
    const rows=withMine(r.results);
    return J({notes:rows.map(noteOut),next:rows.length===PAGE?rows[rows.length-1].bat:null});
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
    /* 運営の Tips の投稿（2026/11/16）：通報で自動に隠さない（1件で画像・3件で投稿の決まりを使わない）。通報は管理画面の「通報」に並び、運営者が確かめる */
    /* 公式の運営の札のアカウント（2026/11/19）も同じ：通報で自動に隠さず、運営者が確かめる */
    const own=await db.prepare(`SELECT n.uid,${OFFX('x')} AS off FROM notes n LEFT JOIN users x ON x.uid=n.uid WHERE n.id=?`).bind(id).first();
    /* 利用者のリンク付きの投稿は、通報で安全確認をし直す（通報だけで止めたり停止したりはしない。links.js） */
    await later(lkReported(env,db,id,now));
    if(own&&(own.uid==='bot:tips'||own.off))return J({ok:true,review:true});
    const c=await db.prepare(`SELECT COUNT(*) AS n FROM reports WHERE kind='note' AND target=?`).bind(id).first();
    /* 画像つきの投稿は、通報1件で画像を確認待ちにする（運営者が確認して戻す） */
    await db.prepare(`UPDATE notes SET media_hidden=1 WHERE id=? AND media IS NOT NULL`).bind(id).run();
    if(c&&c.n>=3){await db.prepare(`UPDATE notes SET hidden=1 WHERE id=?`).bind(id).run();const p=await db.prepare(`SELECT reply_to FROM notes WHERE id=?`).bind(id).first();if(p&&p.reply_to)await recount(db,p.reply_to).run()}
    return J({ok:true});
  }
  /* 公開プロフィール（フォロー数つき） */
  if((m=path.match(/^\/api\/u\/([A-Za-z0-9_]{3,15})$/))&&req.method==='GET'){
    const p=await db.prepare(`SELECT uid,handle,name,bio,avatar,created_at,partner,showcase,private,${OFFX('users')} AS off,
      (SELECT partner FROM game_profiles WHERE uid=users.uid AND game='pokechamp') AS g_partner,(SELECT showcase FROM game_profiles WHERE uid=users.uid AND game='pokechamp') AS g_showcase,
      EXISTS(SELECT 1 FROM game_profiles WHERE uid=users.uid AND game='pokechamp') AS g_has,(SELECT vis FROM game_profiles WHERE uid=users.uid AND game='pokechamp') AS g_vis,
      (SELECT card FROM game_profiles WHERE uid=users.uid AND game='pokechamp') AS g_card,
      (SELECT COUNT(*) FROM follows WHERE dst=users.uid AND ok=1) AS followers,(SELECT COUNT(*) FROM follows WHERE src=users.uid AND ok=1) AS following,
      (SELECT COUNT(*) FROM notes WHERE uid=users.uid AND hidden=0 AND repost_of=0) AS notes,
      EXISTS(SELECT 1 FROM follows WHERE src=?2 AND dst=users.uid AND ok=1) AS followed,EXISTS(SELECT 1 FROM follows WHERE src=users.uid AND dst=?2 AND ok=1) AS follows_me,
      EXISTS(SELECT 1 FROM follows WHERE src=?2 AND dst=users.uid AND ok=0) AS requested
      FROM users WHERE handle=?1 COLLATE NOCASE AND banned=0`).bind(m[1],meUid).first();
    if(!p)return J({error:'ユーザーが見つかりません。'},404);
    /* 非公開アカウント（2026/11/18）：本人と許可されたフォロワー以外には、自己紹介・相棒・看板パーティ・実績・もらったいいねを返さない
       （画面で隠すだけでなく、サーバーから送らない）。名前・ID・アイコン・数（フォロー・フォロワー・投稿）は X と同じく見せる */
    const locked=!!p.private&&p.uid!==meUid&&!p.followed;
    /* ゲームごとのカード：game_profiles の行があればそれ、なければ前の users の列（ポケモンチャンピオンズの分） */
    const gp=p.g_has?p.g_partner:p.partner,gs=p.g_has?p.g_showcase:p.showcase;
    /* ゲームの公開範囲：アカウントの設定がいつも先（非公開なら public でもフォロワーのみ） */
    const me=p.uid===meUid,gv=gameVisOf(p.g_vis),eff=gameEff(gv,!!p.private),gOk=me||eff==='public'||(eff==='followers'&&!!p.followed);
    const show=!locked&&gOk;
    let sc=null;if(show)try{sc=gs?JSON.parse(gs):null}catch(e){}
    const base=pubUser(p);if(locked)base.bio='';
    const results=show?await ladderResults(db,p.uid):[];
    /* games：ゲームごとの中身（いまはポケモンチャンピオンズだけ）。見られない人には、そのゲームがあることも送らない。本人には設定と、実際の公開範囲 */
    /* created：本人が「ゲームカードを作る」で保存したときだけ true（game_profiles.card）。相棒・看板パーティ・戦績からは決めない */
    const created=!!p.g_card;
    const games=show?{pokechamp:{created,partner:gp||null,showcase:sc,results:results.filter(x=>x.game==='pokechamp'),...(me?{vis:gv,eff,capped:gv==='public'&&!!p.private}:{})}}:{};
    return J({user:{...base,...(p.off?{off:true}:{}),...(show&&created?{card:true}:{}),partner:show?gp||null:null,showcase:sc,games,followers:p.followers,following:p.following,notes:p.notes,followed:!!p.followed,follows_me:!!p.follows_me,requested:!!p.requested,private:!!p.private,
      locked,me:p.uid===meUid,results}});
  }
  /* その人の投稿 */
  if((m=path.match(/^\/api\/u\/([A-Za-z0-9_]{3,15})\/notes$/))&&req.method==='GET'){
    const pu=await db.prepare(`SELECT uid,private FROM users WHERE handle=? COLLATE NOCASE AND banned=0`).bind(m[1]).first();
    if(pu&&pu.private&&pu.uid!==meUid&&!await db.prepare(`SELECT 1 AS x FROM follows WHERE src=? AND dst=? AND ok=1`).bind(meUid,pu.uid).first())return J({notes:[],next:null,locked:true});
    const r=await db.prepare(`SELECT ${NOTE_COLS} FROM notes n ${NOTE_JOIN}
      WHERE u.handle=?3 COLLATE NOCASE AND n.hidden=0 AND ${NOTE_OK} AND n.id<?2${u.searchParams.get('media')==='1'?" AND n.repost_of=0 AND n.media IS NOT NULL AND n.media<>'' AND n.media<>'[]'":''} ORDER BY n.id DESC LIMIT ${PAGE}`).bind(meUid,beforeOf(u),m[1]).all();
    return J(pageOut(withMine(r.results)));
  }
  /* フォロー中・フォロワーの一覧（2026/11/11 依頼主）：?kind=following（この人がフォローしている）／followers（この人をフォローしている）。
     許可されたフォロー（ok=1）だけ。非公開アカウントは本人と許可されたフォロワーだけが見られる。新しい順に50人ずつ（?before=フォローした時刻） */
  if((m=path.match(/^\/api\/u\/([A-Za-z0-9_]{3,15})\/follows$/))&&req.method==='GET'){
    const pu=await db.prepare(`SELECT uid,private FROM users WHERE handle=? COLLATE NOCASE AND banned=0`).bind(m[1]).first();
    if(!pu)return J({error:'ユーザーが見つかりません。'},404);
    if(pu.private&&pu.uid!==meUid&&!await db.prepare(`SELECT 1 AS x FROM follows WHERE src=? AND dst=? AND ok=1`).bind(meUid,pu.uid).first())return J({users:[],next:null,locked:true});
    const fl=u.searchParams.get('kind')==='followers';
    const before=parseInt(u.searchParams.get('before')||'',10)||9e15;
    const r=(await db.prepare(`SELECT f.created_at AS at,x.handle,x.name,x.bio,x.avatar,x.private,
      EXISTS(SELECT 1 FROM follows a WHERE a.src=?2 AND a.dst=x.uid AND a.ok=1) AS followed,EXISTS(SELECT 1 FROM follows a WHERE a.src=?2 AND a.dst=x.uid AND a.ok=0) AS requested,
      EXISTS(SELECT 1 FROM follows a WHERE a.src=x.uid AND a.dst=?2 AND a.ok=1) AS follows_me,x.uid=?2 AS me,${CARDVIS('x','?2')} AS card,${OFFX('x')} AS off
      FROM follows f JOIN users x ON x.uid=${fl?'f.src':'f.dst'} AND x.banned=0
      WHERE ${fl?'f.dst':'f.src'}=?1 AND f.ok=1 AND f.created_at<?3 ORDER BY f.created_at DESC LIMIT 50`).bind(pu.uid,meUid,before).all()).results;
    /* 非公開アカウントの自己紹介は、本人と許可されたフォロワーにだけ */
    return J({users:r.map(x=>({handle:x.handle,name:x.name,bio:x.private&&!x.followed&&!x.me?'':x.bio||'',av:x.avatar||null,private:!!x.private,followed:!!x.followed,requested:!!x.requested,follows_me:!!x.follows_me,me:!!x.me,...(x.card?{card:true}:{}),...(x.off?{off:true}:{})})),
      next:r.length===50?r[49].at:null});
  }
  /* フォローのリクエストの一覧（2026/11/11 依頼主）：届いたもの（本人に許可を待っている）と、自分が送ったもの */
  if(path==='/api/follow/requests'&&req.method==='GET'){
    const e=need();if(e)return e;
    const q=sent=>db.prepare(`SELECT f.created_at AS at,x.handle,x.name,x.bio,x.avatar,x.private FROM follows f JOIN users x ON x.uid=${sent?'f.dst':'f.src'} AND x.banned=0
      WHERE ${sent?'f.src':'f.dst'}=? AND f.ok=0 ORDER BY f.created_at DESC LIMIT 200`).bind(meUid).all();
    const o=x=>({handle:x.handle,name:x.name,bio:x.bio||'',av:x.avatar||null,private:!!x.private,at:x.at});
    return J({incoming:(await q(false)).results.map(o),sent:(await q(true)).results.map(o)});
  }
  /* フォロー（on:false でやめる・リクエストを取り消す）。相手が非公開アカウントなら「リクエスト」（ok=0）になり、本人が許可するとフォロー */
  if(path==='/api/follow'&&req.method==='POST'){
    const e=need();if(e)return e;
    const t=await db.prepare(`SELECT uid,private FROM users WHERE handle=? COLLATE NOCASE AND banned=0`).bind(String(body.handle||'')).first();
    if(!t)return J({error:'ユーザーが見つかりません。'},404);
    if(t.uid===meUid)return J({error:'自分はフォローできません。'},400);
    let requested=false;
    if(body.on===false){
      await db.batch([db.prepare(`DELETE FROM follows WHERE src=? AND dst=?`).bind(meUid,t.uid),db.prepare(`DELETE FROM notifs WHERE kind IN ('follow','freq') AND actor=? AND uid=?`).bind(meUid,t.uid)]);
    }else{
      const c=await db.prepare(`SELECT COUNT(*) AS c FROM follows WHERE src=? AND created_at>?`).bind(meUid,now-36e5).first();
      if(c&&c.c>=100)return J({error:'短い時間にフォローしすぎです。少し時間をおいてください。'},429);
      const all=await db.prepare(`SELECT COUNT(*) AS c FROM follows WHERE src=?`).bind(meUid).first();
      if(all&&all.c>=5000)return J({error:'フォローできるのは5000人までです。'},400);
      const had=await db.prepare(`SELECT ok FROM follows WHERE src=? AND dst=?`).bind(meUid,t.uid).first();
      if(had)requested=!had.ok;
      else if(t.private){requested=true;
        await later(pushTo(db,t.uid,{title:`${meRow.name}さんからフォローのリクエストが届きました`,body:'@'+meRow.handle,url:'#/notif',tag:'freq-'+meRow.handle},'freq:'+meUid));
        await db.batch([db.prepare(`INSERT OR IGNORE INTO follows(src,dst,created_at,ok) VALUES(?,?,?,0)`).bind(meUid,t.uid,now),
          db.prepare(`INSERT OR IGNORE INTO notifs(uid,kind,actor,note_id,created_at) VALUES(?,'freq',?,0,?)`).bind(t.uid,meUid,now)]);
      }else{
        await later(pushTo(db,t.uid,{title:`${meRow.name}さんにフォローされました`,body:'@'+meRow.handle,url:'#/u/'+meRow.handle,tag:'follow-'+meRow.handle},'follow:'+meUid));
        await db.batch([db.prepare(`INSERT OR IGNORE INTO follows(src,dst,created_at,ok) VALUES(?,?,?,1)`).bind(meUid,t.uid,now),
          db.prepare(`INSERT OR IGNORE INTO notifs(uid,kind,actor,note_id,created_at) VALUES(?,'follow',?,0,?)`).bind(t.uid,meUid,now)]);
      }
    }
    const f=await db.prepare(`SELECT COUNT(*) AS c FROM follows WHERE dst=? AND ok=1`).bind(t.uid).first();
    return J({ok:true,followed:body.on!==false&&!requested,requested,followers:f?f.c:0});
  }
  /* フォローのリクエストに答える（非公開アカウントの本人）：{handle, ok:true 許可／false 断る} */
  if(path==='/api/follow/answer'&&req.method==='POST'){
    const e=need();if(e)return e;
    const t=await db.prepare(`SELECT uid FROM users WHERE handle=? COLLATE NOCASE`).bind(String(body.handle||'')).first();
    const q=t&&await db.prepare(`SELECT ok FROM follows WHERE src=? AND dst=?`).bind(t.uid,meUid).first();
    if(!t||!q||q.ok)return J({error:'このリクエストはもうありません。'},404);
    const st=[db.prepare(`DELETE FROM notifs WHERE kind='freq' AND actor=? AND uid=?`).bind(t.uid,meUid)];
    if(body.ok){st.push(db.prepare(`UPDATE follows SET ok=1,created_at=? WHERE src=? AND dst=?`).bind(now,t.uid,meUid),
        db.prepare(`INSERT OR IGNORE INTO notifs(uid,kind,actor,note_id,created_at) VALUES(?,'facc',?,0,?)`).bind(t.uid,meUid,now));
      await later(pushTo(db,t.uid,{title:`${meRow.name}さんがフォローを許可しました`,body:'@'+meRow.handle,url:'#/u/'+meRow.handle,tag:'facc-'+meRow.handle},'facc:'+meUid))}
    else st.push(db.prepare(`DELETE FROM follows WHERE src=? AND dst=?`).bind(t.uid,meUid));
    await db.batch(st);
    return J({ok:true,accepted:!!body.ok});
  }
  /* 検索：#タグ なら索引から、それ以外は本文に含むもの（新しい順・続きから）。人も名前・IDで探す */
  if(path==='/api/search'&&req.method==='GET'){
    const q=String(u.searchParams.get('q')||'').trim().slice(0,40),before=beforeOf(u);
    if(!q)return J({notes:[],users:[],next:null});
    const tag=q.match(/^[#＃]([\p{L}\p{N}_ー]{1,30})$/u);
    let r;
    if(tag)r=await db.prepare(`SELECT ${NOTE_COLS} FROM note_tags g JOIN notes n ON n.id=g.note_id ${NOTE_JOIN}
      WHERE g.tag=?3 AND n.hidden=0 AND ${NOTE_OK} AND n.id<?2 ORDER BY n.id DESC LIMIT ${PAGE}`).bind(meUid,before,tag[1].normalize('NFKC').toLowerCase()).all();
    else r=await db.prepare(`SELECT ${NOTE_COLS} FROM notes n ${NOTE_JOIN}
      WHERE n.hidden=0 AND ${NOTE_OK} AND n.id<?2 AND instr(lower(n.body),lower(?3))>0 ORDER BY n.id DESC LIMIT ${PAGE}`).bind(meUid,before,q).all();
    let users=[];
    if(!tag&&before>=9e15){const like='%'+q.replace(/[%_\\]/g,c=>'\\'+c)+'%';
      users=(await db.prepare(`SELECT handle,name,bio,avatar,private,uid=?2 AS me,EXISTS(SELECT 1 FROM follows f WHERE f.src=?2 AND f.dst=users.uid AND f.ok=1) AS followed,${CARDVIS('users','?2')} AS card,${OFFX('users')} AS off FROM users WHERE banned=0 AND (name LIKE ?1 ESCAPE '\\' OR handle LIKE ?1 ESCAPE '\\') LIMIT 5`).bind(like,meUid).all()).results
        .map(x=>({handle:x.handle,name:x.name,bio:x.private&&!x.followed&&!x.me?'':x.bio||'',av:x.avatar||null,private:!!x.private,...(x.card?{card:true}:{}),...(x.off?{off:true}:{})}))}
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
    const rq=await db.prepare(`SELECT COUNT(*) AS c FROM follows WHERE dst=? AND ok=0`).bind(meUid).first();
    return J({unread:r?Math.min(r.c,99):0,requests:rq?Math.min(rq.c,99):0});
  }
  if(path==='/api/notifs'&&req.method==='GET'){
    const e=need();if(e)return e;
    const r=await db.prepare(`SELECT n.id,n.kind,n.note_id,n.created_at,a.handle,a.name,a.avatar,substr(t.body,1,80) AS body,${CARDVIS('a')} AS card,${OFFX('a')} AS off
      FROM notifs n JOIN users a ON a.uid=n.actor AND a.banned=0 LEFT JOIN notes t ON t.id=n.note_id
      WHERE n.uid=?1 AND n.id<?2 ORDER BY n.id DESC LIMIT 30`).bind(meUid,beforeOf(u)).all();
    const seen=await db.prepare(`SELECT notif_seen FROM user_state WHERE uid=?`).bind(meUid).first();
    return J({notifs:r.results.map(x=>({id:x.id,kind:x.kind,note_id:x.note_id||null,body:x.body,created_at:x.created_at,user:{handle:x.handle,name:x.name,av:x.avatar||null,...(x.card?{card:true}:{}),...(x.off?{off:true}:{})}})),
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
  await ladderInit(db);
  /* 消した人の登録の確認の記録も消す（A11）。登録より先に */
  await db.prepare(`DELETE FROM rank_reviews WHERE team_id IN (SELECT id FROM season_teams WHERE uid=?)`).bind(uid).run();
  await db.prepare(`DELETE FROM season_teams WHERE uid=?`).bind(uid).run();
  await db.prepare(`DELETE FROM game_profiles WHERE uid=?`).bind(uid).run();
  await replayInit(db);await db.prepare(`DELETE FROM battles WHERE uid=?`).bind(uid).run();
  /* 先に、この人が返信・リポストした相手の投稿の数を数え直す対象を控える */
  const tg=(await db.prepare(`SELECT DISTINCT CASE WHEN repost_of>0 THEN repost_of ELSE reply_to END AS id FROM notes WHERE uid=? AND (repost_of>0 OR reply_to>0)`).bind(uid).all()).results.map(x=>x.id);
  await db.batch([
    db.prepare(`DELETE FROM notes WHERE repost_of IN (SELECT id FROM notes WHERE uid=?)`).bind(uid),
    db.prepare(`DELETE FROM likes WHERE note_id IN (SELECT id FROM notes WHERE uid=?)`).bind(uid),
    db.prepare(`DELETE FROM notifs WHERE note_id IN (SELECT id FROM notes WHERE uid=?)`).bind(uid),
    db.prepare(`DELETE FROM note_tags WHERE note_id IN (SELECT id FROM notes WHERE uid=?)`).bind(uid),
    db.prepare(`DELETE FROM note_links WHERE uid=? OR note_id IN (SELECT id FROM notes WHERE uid=?)`).bind(uid,uid),
    db.prepare(`DELETE FROM notes WHERE uid=?`).bind(uid),
    db.prepare(`UPDATE notes SET likes=MAX(0,likes-1) WHERE id IN (SELECT note_id FROM likes WHERE uid=?)`).bind(uid),
    db.prepare(`DELETE FROM likes WHERE uid=?`).bind(uid),
    db.prepare(`DELETE FROM bookmarks WHERE uid=? OR note_id IN (SELECT id FROM notes WHERE uid=?)`).bind(uid,uid),
    db.prepare(`DELETE FROM follows WHERE src=? OR dst=?`).bind(uid,uid),
    db.prepare(`DELETE FROM notifs WHERE uid=? OR actor=?`).bind(uid,uid),
    db.prepare(`DELETE FROM user_state WHERE uid=?`).bind(uid)
  ]);
  await dmDeleteUser(db,uid);
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
