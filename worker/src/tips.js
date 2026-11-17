/* ===================== 運営の「Game Kid/s Tips」アカウント（2026/11/16 依頼主 第1段階：画像だけ） =====================
   ・ツールの使い方を1つずつ、短い文と画像（4枚まで）で紹介する運営のアカウント。uid は 'bot:tips'（ログインでは作れない形。お知らせbot・ランキングbot と同じ）。
   ・投稿できるのは管理用の合言葉（ADMIN_TOKEN）を持つ運営者だけ（/api/admin/tips/…）。合言葉の総当たり止めは community.js の api() の決まりのまま。
   ・「運営」の札はサーバーが uid から決める（social.js の NOTE_COLS の off）。利用者が名前や ID で同じ見た目にできないよう、auth.js で ID・表示名を止める。
   ・投稿には、紹介するツール（TIPS_TOOLS のキー）を1つ付ける。画面では「〇〇を開く」ボタンになり、そのツールの画面へ移る（アドレスはサイトの表から作る。投稿の中身からは作らない）。
   ・画像は利用者の投稿と同じ決まり（media.js の mediaSave：JPEG・PNG・WebP、1枚1.2MBまで、1日30枚、投稿に4枚まで）。動画はまだ扱わない。
   ・運営者の操作（投稿・取り消し）は admin_log に残す（だれが＝接続元を合言葉と混ぜた番号だけ。合言葉そのものは残さない）。
   ・通報：Tips の投稿は通報されても自動で隠さない（画像1件・投稿3件の自動の決まりを使わない）。通報は管理画面の「通報」に並び、運営者が確かめる（social.js）。 */
const TIPS_UID='bot:tips',TIPS_HANDLE='gamekids_tips',TIPS_NAME='Game Kid/s Tips';
const TIPS_BIO='Game Kid/s の運営アカウント。ツールの使い方を、実際の画面で1つずつ紹介します。';
/* 紹介できるツール（サイトの 73-help.js の HOWTO と同じキー。画面の 85-tips.js の TIPS_GO と同じ並び） */
const TIPS_TOOLS=['calc','dex','team','assist','types','tier','meta','season','memo','pair','pip','import','replay','cmp','learn'];
const TIPS_MAX=140;
let TIPS_READY=false;
async function tipsInit(db){
  if(TIPS_READY)return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS admin_log(id INTEGER PRIMARY KEY AUTOINCREMENT,at INTEGER,action TEXT,target INTEGER,detail TEXT,who TEXT)`).run();
  try{await db.prepare(`ALTER TABLE notes ADD COLUMN tool TEXT`).run()}catch(e){}
  TIPS_READY=true;
}
/* 運営のアカウントを用意する。ID（@gamekids_tips）がこの決まりより前にほかの人に取られていたら、黙って続けずに止める（2026/11/16 見直し）。
   続けると、Tips の投稿が表示されず（users の行がない）、ツールの画面の入口がその人のプロフィールを開いてしまうため。ほかの人の ID は勝手に変えない（運営者が決める） */
async function tipsUser(db,now){
  const u=await db.prepare(`SELECT uid FROM users WHERE uid=?`).bind(TIPS_UID).first();
  if(!u)await db.prepare(`INSERT OR IGNORE INTO users(uid,handle,name,bio,created_at,updated_at,agreed_at) VALUES(?,?,?,?,?,?,?)`).bind(TIPS_UID,TIPS_HANDLE,TIPS_NAME,TIPS_BIO,now,now,now).run();
  const h=await db.prepare(`SELECT uid FROM users WHERE handle=? COLLATE NOCASE`).bind(TIPS_HANDLE).first();
  return !!h&&h.uid===TIPS_UID;
}
const tipsTaken=()=>J({error:`ユーザーID「@${TIPS_HANDLE}」がほかのアカウントに使われているため、Tips のアカウントを用意できません。管理画面でそのアカウントを確かめてください。`,taken:true},409);
/* 接続元はそのまま残さず、サーバーだけが知る合言葉と混ぜた番号にする（ADMIN_TOKEN も混ぜて、接続元を総当たりで戻せないように） */
const tipsWho=async(ip,env)=>(await sha(ip+'|admlog|'+(env.ADMIN_TOKEN||'')+'|'+(env.APP_TOKEN||''))).slice(0,16);
async function tipsLog(db,env,ip,now,action,target,detail){
  await db.prepare(`INSERT INTO admin_log(at,action,target,detail,who) VALUES(?,?,?,?,?)`).bind(now,action,target||0,String(detail||'').slice(0,200),await tipsWho(ip,env)).run();
}
const tipsDenied=env=>J({error:!env.ADMIN_TOKEN?'管理用の合言葉（ADMIN_TOKEN）がサーバーに設定されていません。':'管理用の合言葉が違います。'},401);
/* 画像（投稿の前に1枚ずつ。中身そのものを受け取るので、JSON を読む前に community.js から呼ぶ） */
async function tipsMedia(req,env,db,now,isAdmin,ip){
  if(!isAdmin)return tipsDenied(env);
  await tipsInit(db);if(!await tipsUser(db,now))return tipsTaken();
  const res=await mediaSave(req,env,db,TIPS_UID,now);
  if(res.status===200)await tipsLog(db,env,ip,now,'tips_media',0,'');
  return res;
}
async function tipsApi(req,env,db,path,body,now,isAdmin,ip){
  if(!path.startsWith('/api/admin/tips'))return null;
  if(!isAdmin)return tipsDenied(env);
  await tipsInit(db);if(!await tipsUser(db,now))return tipsTaken();
  if(path==='/api/admin/tips'&&req.method==='GET'){
    const n=await db.prepare(`SELECT id,body,media,media_hidden,tool,created_at,hidden,(SELECT COUNT(*) FROM reports WHERE kind='note' AND target=notes.id) AS reports FROM notes WHERE uid=? AND repost_of=0 ORDER BY id DESC LIMIT 30`).bind(TIPS_UID).all();
    const l=await db.prepare(`SELECT at,action,target,detail,who FROM admin_log ORDER BY id DESC LIMIT 30`).all();
    return J({tools:TIPS_TOOLS,notes:n.results,log:l.results,user:{handle:TIPS_HANDLE,name:TIPS_NAME}});
  }
  /* 投稿する：本文（1〜140字）・ツール（必ず1つ）・画像（先に送った鍵、4枚まで） */
  if(path==='/api/admin/tips/post'&&req.method==='POST'){
    const text=clean(body.body,TIPS_MAX*2+2),tool=String(body.tool||'');
    if(!TIPS_TOOLS.includes(tool))return J({error:'紹介するツールを選んでください。'},400);
    if(text.length<1)return J({error:'本文を入れてください。'},400);
    if([...text].length>TIPS_MAX)return J({error:`本文は${TIPS_MAX}文字までです。`},400);
    const keys=Array.isArray(body.media)?body.media:[];
    if(keys.length>MEDIA_PER_NOTE)return J({error:`画像は${MEDIA_PER_NOTE}枚までです。`},400);
    const med=await mediaAttach(db,TIPS_UID,keys,0);
    if(med.length!==new Set(keys.map(String)).size)return J({error:'画像を送り直してください（時間がたって消えたか、使えない画像です）。'},400);
    const r=await db.prepare(`INSERT INTO notes(uid,body,created_at,ip,reply_to,media,tool) VALUES(?,?,?,?,0,?,?) RETURNING id`).bind(TIPS_UID,text,now,'admin',med.length?JSON.stringify(med):null,tool).first();
    if(med.length)await mediaAttach(db,TIPS_UID,med.map(x=>x.k),r.id);
    const tg=[...new Set([...tagsOf(text),'tips'])];   /* タグは小文字で持つ（social.js の tagsOf・検索と同じ） */
    await db.batch(tg.map(t=>db.prepare(`INSERT OR IGNORE INTO note_tags(tag,note_id,created_at) VALUES(?,?,?)`).bind(t,r.id,now)));
    await tipsLog(db,env,ip,now,'tips_post',r.id,tool+'・画像'+med.length+'枚');
    return J({ok:true,id:r.id});
  }
  /* 取り消す（非表示にする。restore で戻す） */
  if(path==='/api/admin/tips/hide'&&req.method==='POST'){
    const id=parseInt(body.id,10)||0;
    const n=id?await db.prepare(`SELECT id FROM notes WHERE id=? AND uid=?`).bind(id,TIPS_UID).first():null;
    if(!n)return J({error:'Tips の投稿が見つかりません。'},404);
    await db.prepare(`UPDATE notes SET hidden=? WHERE id=?`).bind(body.restore?0:1,id).run();
    await tipsLog(db,env,ip,now,body.restore?'tips_restore':'tips_hide',id,'');
    return J({ok:true});
  }
  return J({error:'見つかりません。'},404);
}
