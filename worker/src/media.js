/* ===================== 画像つき投稿の画像 =====================
   ・保存先：Cloudflare R2（binding MEDIA）があればそこへ。なければ D1 の media 表の data 列（小さく縮めた画像だけなので当面は足りる）
   ・画像はサイト側で縮めて（長い辺1600px・WebP/JPEG）送る。縮めるときに撮影場所などの情報（EXIF）も消える
   ・サーバーでは中身の先頭を見て JPEG・PNG・WebP だけ受け付ける（拡張子や申告は信じない）
   ・流れ：POST /api/media（画像だけ・投稿前）→ 鍵（key）が返る → POST /api/notes に media:[key…] を付けて投稿
     投稿に付かなかった画像は1日で消す
   ・見せる：GET /m/鍵。投稿が非表示・画像が確認待ち（media_hidden）・停止中の人なら出さない（管理者は X-Admin-Token で見られる）
   ・見回り：画像つきの投稿は、通報1件で画像だけ隠して確認待ちにする（3件で投稿ごと非表示は今までどおり） */
const MEDIA_MAX=1.2e6,MEDIA_PER_NOTE=4,MEDIA_PER_DAY=30;
let MEDIA_READY=false;
async function mediaInit(db){
  if(MEDIA_READY)return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS media(key TEXT PRIMARY KEY,uid TEXT NOT NULL,note_id INTEGER DEFAULT 0,ctype TEXT,size INTEGER,w INTEGER,h INTEGER,created_at INTEGER,store TEXT,data BLOB)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS media_note ON media(note_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS media_uid ON media(uid,created_at)`)
  ]);
  for(const c of ['media_hidden INTEGER DEFAULT 0']){try{await db.prepare(`ALTER TABLE notes ADD COLUMN ${c}`).run()}catch(e){}}
  MEDIA_READY=true;
}
/* 中身の先頭で画像の種類を見分ける */
function mediaSniff(b){
  if(b.length>3&&b[0]===0xFF&&b[1]===0xD8&&b[2]===0xFF)return'image/jpeg';
  if(b.length>8&&b[0]===0x89&&b[1]===0x50&&b[2]===0x4E&&b[3]===0x47)return'image/png';
  if(b.length>12&&b[0]===0x52&&b[1]===0x49&&b[2]===0x46&&b[3]===0x46&&b[8]===0x57&&b[9]===0x45&&b[10]===0x42&&b[11]===0x50)return'image/webp';
  return null;
}
const mediaKey=()=>[...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,'0')).join('');
/* 画像を受け取る（投稿の前に1枚ずつ） */
async function mediaUpload(req,env,db,now){
  await mediaInit(db);
  const me=fbPid(env)?await authOf(req,env):null;
  const row=me?await db.prepare(`SELECT uid,banned FROM users WHERE uid=?`).bind(me.uid).first():null;
  if(!me)return J({error:'ログインしてください。'},401);
  if(!row)return J({error:'先にプロフィールを作ってください。'},403);
  if(row.banned)return J({error:'このアカウントは利用を停止しています。'},403);
  const c=await db.prepare(`SELECT COUNT(*) AS c FROM media WHERE uid=? AND created_at>?`).bind(row.uid,now-864e5).first();
  if(c&&c.c>=MEDIA_PER_DAY)return J({error:`1日に送れる画像（${MEDIA_PER_DAY}枚）を超えました。`},429);
  const len=+req.headers.get('content-length')||0;if(len>MEDIA_MAX)return J({error:'画像が大きすぎます。'},413);
  const buf=new Uint8Array(await req.arrayBuffer());
  if(buf.length>MEDIA_MAX)return J({error:'画像が大きすぎます。'},413);
  const ct=mediaSniff(buf);if(!ct)return J({error:'JPEG・PNG・WebP の画像だけ送れます。'},400);
  const u=new URL(req.url),w=Math.max(1,Math.min(10000,parseInt(u.searchParams.get('w'),10)||1)),h=Math.max(1,Math.min(10000,parseInt(u.searchParams.get('h'),10)||1));
  const key=mediaKey();
  if(env.MEDIA){await env.MEDIA.put(key,buf,{httpMetadata:{contentType:ct}});
    await db.prepare(`INSERT INTO media(key,uid,ctype,size,w,h,created_at,store) VALUES(?,?,?,?,?,?,?,'r2')`).bind(key,row.uid,ct,buf.length,w,h,now).run()}
  else await db.prepare(`INSERT INTO media(key,uid,ctype,size,w,h,created_at,store,data) VALUES(?,?,?,?,?,?,?,'d1',?)`).bind(key,row.uid,ct,buf.length,w,h,now,buf).run();
  return J({ok:true,key,w,h});
}
/* 投稿に画像を付ける：自分が送った・まだどこにも付いていない画像だけ。付けた画像の [{k,w,h}] を返す */
async function mediaAttach(db,uid,keys,noteId){
  keys=[...new Set((Array.isArray(keys)?keys:[]).map(String).filter(k=>/^[0-9a-f]{32}$/.test(k)))].slice(0,MEDIA_PER_NOTE);
  if(!keys.length)return[];
  const out=[];
  for(const k of keys){const r=await db.prepare(`SELECT key,w,h FROM media WHERE key=? AND uid=? AND note_id=0`).bind(k,uid).first();if(r)out.push({k:r.key,w:r.w,h:r.h})}
  if(noteId&&out.length)await db.batch(out.map(x=>db.prepare(`UPDATE media SET note_id=? WHERE key=?`).bind(noteId,x.k)));
  return out;
}
/* 画像を消す（投稿を消したとき・付かなかった画像の掃除・アカウント削除） */
async function mediaDrop(env,db,where,...args){
  const r=(await db.prepare(`SELECT key,store FROM media WHERE ${where}`).bind(...args).all()).results;
  if(!r.length)return;
  if(env&&env.MEDIA){const r2=r.filter(x=>x.store==='r2').map(x=>x.key);if(r2.length)try{await env.MEDIA.delete(r2)}catch(e){}}
  await db.batch(r.map(x=>db.prepare(`DELETE FROM media WHERE key=?`).bind(x.key)));
}
/* 画像を見せる */
async function mediaGet(req,env,key){
  if(!env.DB||!/^[0-9a-f]{32}$/.test(key))return new Response('見つかりません',{status:404,headers:CORS});
  const db=env.DB;await mediaInit(db);
  const adminTok=req.headers.get('x-admin-token')||'';
  const isAdmin=!!env.ADMIN_TOKEN&&String(env.ADMIN_TOKEN).length>=12&&adminTok.length===String(env.ADMIN_TOKEN).length&&await sha(adminTok)===await sha(String(env.ADMIN_TOKEN));
  /* 管理者は、投稿に付いていない画像（シーズンの結果の証拠のスクリーンショットなど）も見られる */
  const r=isAdmin?await db.prepare(`SELECT key,ctype,store,data,0 AS hidden,0 AS media_hidden,0 AS banned FROM media WHERE key=?`).bind(key).first()
    :await db.prepare(`SELECT m.key,m.ctype,m.store,m.data,n.hidden,n.media_hidden,u.banned FROM media m JOIN notes n ON n.id=m.note_id JOIN users u ON u.uid=n.uid WHERE m.key=?`).bind(key).first();
  if(!r||(!isAdmin&&(r.hidden||r.media_hidden||r.banned)))return new Response('見つかりません',{status:404,headers:{...CORS,'Cache-Control':'no-store'}});
  let body=null;
  if(r.store==='r2'&&env.MEDIA){const o=await env.MEDIA.get(key);if(o)body=o.body}
  else if(r.data!=null)body=r.data instanceof ArrayBuffer||ArrayBuffer.isView(r.data)?r.data:new Uint8Array(r.data);
  if(!body)return new Response('見つかりません',{status:404,headers:CORS});
  return new Response(body,{headers:{...CORS,'Content-Type':r.ctype,'X-Content-Type-Options':'nosniff','Cache-Control':isAdmin?'no-store':'public, max-age=3600','Content-Disposition':'inline'}});
}
