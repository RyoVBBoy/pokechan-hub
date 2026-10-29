
/* ===================== 掲示板・対戦募集（Cloudflare D1） =====================
   Workerの「設定」→「バインディング」で D1 データベースを変数名 DB で追加すると使えます。
   表は初回のアクセスで自動的に作られます。
   ・書き込みは匿名。表示用IDは「IPアドレス＋日付」から作る（日が変わると変わる）
   ・通報が3人分たまると自動で非表示。管理者（ADMIN_TOKEN。APP_TOKENとは別）は削除と通報一覧の確認ができる
   ・NGワード・リンク・連投は受け付けない。IPアドレスは悪用時の対応のため90日保存し、その後消す */
const BOARDS={zatsu:'雑談',kouchiku:'構築相談',shitsumon:'質問',taikai:'大会・イベント'};
const NG=['死ね','殺す','氏ね','きもい','キモい','ガイジ','池沼','在日','チョン','支那','ちんこ','まんこ','セックス','せっくす','援交','パパ活','LINE交換','ライン交換','電話番号','住所教','裏垢','RMT','リアルマネー','代行','アカウント売','垢売'];
const REASONS=['誹謗中傷・嫌がらせ','個人情報','売買・代行・RMT','わいせつ・出会い目的','宣伝・荒らし・スパム','不正行為の紹介','その他'];
const LIMIT={title:40,body:1000,name:16,comment:200};
let DB_READY=false;
async function dbInit(db){
  if(DB_READY)return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS threads(id INTEGER PRIMARY KEY AUTOINCREMENT,board TEXT,title TEXT,created_at INTEGER,last_at INTEGER,count INTEGER DEFAULT 0,hidden INTEGER DEFAULT 0,aid TEXT,ip TEXT)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS posts(id INTEGER PRIMARY KEY AUTOINCREMENT,thread_id INTEGER,no INTEGER,name TEXT,body TEXT,created_at INTEGER,hidden INTEGER DEFAULT 0,aid TEXT,ip TEXT)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS lobby(id INTEGER PRIMARY KEY AUTOINCREMENT,fmt TEXT,rule TEXT,pass TEXT,comment TEXT,name TEXT,created_at INTEGER,expires_at INTEGER,hidden INTEGER DEFAULT 0,aid TEXT,ip TEXT)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT,target INTEGER,reason TEXT,aid TEXT,created_at INTEGER,UNIQUE(kind,target,aid))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS users(uid TEXT PRIMARY KEY,handle TEXT UNIQUE COLLATE NOCASE,name TEXT,bio TEXT,created_at INTEGER,updated_at INTEGER,agreed_at INTEGER,banned INTEGER DEFAULT 0)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS user_data(uid TEXT PRIMARY KEY,teams TEXT,updated_at INTEGER)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS posts_t ON posts(thread_id,no)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS threads_b ON threads(board,last_at)`)
  ]);
  DB_READY=true;
}
async function sha(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
const today=()=>new Date(Date.now()+9*3600e3).toISOString().slice(0,10);
async function aidOf(ip,env){return (await sha(ip+'|'+today()+'|'+(env.APP_TOKEN||'pc'))).slice(0,8)}
const clean=(s,n)=>String(s||'').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g,'').replace(/\r\n?/g,'\n').trim().slice(0,n);
function ngCheck(...xs){
  const t=xs.join(' ').normalize('NFKC').toLowerCase();
  if(/https?:\/\/|www\.|\.com\b|\.jp\b|discord\.gg|line\.me/.test(t))return 'リンク（URL）は書き込めません。';
  const hit=NG.find(w=>t.includes(w.normalize('NFKC').toLowerCase()));
  if(hit)return '書き込めない言葉が含まれています。';
  return null;
}
async function rateOk(db,ip){
  const now=Date.now();
  const r=await db.prepare(`SELECT (SELECT COUNT(*) FROM posts WHERE ip=?1 AND created_at>?2)+(SELECT COUNT(*) FROM lobby WHERE ip=?1 AND created_at>?2) AS n,
    (SELECT COUNT(*) FROM posts WHERE ip=?1 AND created_at>?3)+(SELECT COUNT(*) FROM lobby WHERE ip=?1 AND created_at>?3) AS d`).bind(ip,now-20e3,now-864e5).first();
  if(r&&r.n>0)return '連続の書き込みは20秒あけてください。';
  if(r&&r.d>=60)return '1日に書き込める回数を超えました。';
  return null;
}
async function cleanup(db){
  const now=Date.now();
  await db.batch([
    db.prepare(`UPDATE posts SET ip='' WHERE created_at<? AND ip!=''`).bind(now-90*864e5),
    db.prepare(`UPDATE threads SET ip='' WHERE created_at<? AND ip!=''`).bind(now-90*864e5),
    db.prepare(`DELETE FROM lobby WHERE expires_at<?`).bind(now-864e5)
  ]);
}
const J=(o,st=200)=>new Response(JSON.stringify(o),{status:st,headers:{...CORS,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
async function api(req,env,u,ctx){
  if(!env.DB)return J({error:'掲示板はまだ準備中です。'},503);
  const db=env.DB;await dbInit(db);await socialInit(db);
  const ip=req.headers.get('cf-connecting-ip')||'0.0.0.0',path=u.pathname.replace(/\/+$/,''),now=Date.now();
  /* 管理者は ADMIN_TOKEN（利用者に配る APP_TOKEN とは別）。未設定なら管理機能は使えない */
  const adminTok=req.headers.get('x-admin-token')||'';
  const isAdmin=!!env.ADMIN_TOKEN&&String(env.ADMIN_TOKEN).length>=12&&adminTok.length===String(env.ADMIN_TOKEN).length&&await sha(adminTok)===await sha(String(env.ADMIN_TOKEN));
  let body={};if(req.method==='POST'){const t=await req.text();if(t){try{body=JSON.parse(t)}catch(e){return J({error:'送信内容を読めませんでした。'},400)}}}
  if(Math.random()<.02)ctx&&ctx.waitUntil(cleanup(db).then(()=>socialCleanup(db)).catch(()=>{}));
  let m;
  /* タイムライン・フォロー・通知（social.js） */
  {const r=await socialApi(req,env,db,path,u,body,now,ip);if(r)return r}
  /* ログイン・ユーザー */
  {const r=await userApi(req,env,db,path,body,now);if(r)return r}
  /* 板の一覧 */
  if(path==='/api/boards')return J({boards:Object.entries(BOARDS).map(([k,n])=>({k,n}))});
  /* スレッド一覧 */
  if(path==='/api/threads'&&req.method==='GET'){
    const b=u.searchParams.get('board');if(!BOARDS[b])return J({error:'板が見つかりません。'},404);
    const r=await db.prepare(`SELECT id,title,created_at,last_at,count FROM threads WHERE board=? AND hidden=0 ORDER BY last_at DESC LIMIT 50`).bind(b).all();
    return J({threads:r.results});
  }
  /* スレッドを立てる */
  if(path==='/api/threads'&&req.method==='POST'){
    const b=body.board,title=clean(body.title,LIMIT.title),text=clean(body.body,LIMIT.body),name=clean(body.name,LIMIT.name)||'名無しのトレーナー';
    if(!BOARDS[b])return J({error:'板が見つかりません。'},404);
    if(title.length<2||text.length<2)return J({error:'タイトルと本文を入れてください。'},400);
    const ng=ngCheck(title,text,name)||await rateOk(db,ip);if(ng)return J({error:ng},400);
    const aid=await aidOf(ip,env);
    const t=await db.prepare(`INSERT INTO threads(board,title,created_at,last_at,count,aid,ip) VALUES(?,?,?,?,1,?,?) RETURNING id`).bind(b,title,now,now,aid,ip).first();
    await db.prepare(`INSERT INTO posts(thread_id,no,name,body,created_at,aid,ip) VALUES(?,1,?,?,?,?,?)`).bind(t.id,name,text,now,aid,ip).run();
    return J({ok:true,id:t.id});
  }
  /* スレッドを読む */
  if((m=path.match(/^\/api\/threads\/(\d+)$/))&&req.method==='GET'){
    const t=await db.prepare(`SELECT id,board,title,created_at,last_at,count FROM threads WHERE id=? AND hidden=0`).bind(+m[1]).first();
    if(!t)return J({error:'スレッドが見つかりません（削除された可能性があります）。'},404);
    const r=await db.prepare(`SELECT id,no,name,body,created_at,aid,hidden FROM posts WHERE thread_id=? ORDER BY no LIMIT 1000`).bind(t.id).all();
    return J({thread:t,posts:r.results.map(p=>p.hidden?{id:p.id,no:p.no,hidden:1}:p)});
  }
  /* 返信する */
  if((m=path.match(/^\/api\/threads\/(\d+)\/posts$/))&&req.method==='POST'){
    const tid=+m[1],text=clean(body.body,LIMIT.body),name=clean(body.name,LIMIT.name)||'名無しのトレーナー';
    if(text.length<1)return J({error:'本文を入れてください。'},400);
    const t=await db.prepare(`SELECT id,count FROM threads WHERE id=? AND hidden=0`).bind(tid).first();
    if(!t)return J({error:'スレッドが見つかりません。'},404);
    if(t.count>=1000)return J({error:'このスレッドは1000件に達しました。新しいスレッドを立ててください。'},400);
    const ng=ngCheck(text,name)||await rateOk(db,ip);if(ng)return J({error:ng},400);
    const aid=await aidOf(ip,env);
    await db.batch([
      db.prepare(`INSERT INTO posts(thread_id,no,name,body,created_at,aid,ip) VALUES(?,(SELECT COALESCE(MAX(no),0)+1 FROM posts WHERE thread_id=?),?,?,?,?,?)`).bind(tid,tid,name,text,now,aid,ip),
      db.prepare(`UPDATE threads SET count=count+1,last_at=? WHERE id=?`).bind(now,tid)
    ]);
    return J({ok:true});
  }
  /* 対戦募集の一覧 */
  if(path==='/api/lobby'&&req.method==='GET'){
    const r=await db.prepare(`SELECT id,fmt,rule,pass,comment,name,created_at,expires_at,aid FROM lobby WHERE hidden=0 AND expires_at>? ORDER BY created_at DESC LIMIT 60`).bind(now).all();
    return J({lobby:r.results});
  }
  /* 対戦募集を出す */
  if(path==='/api/lobby'&&req.method==='POST'){
    const fmt=body.fmt==='single'?'single':'double',rule=clean(body.rule,20)||'フリー',pass=clean(body.pass,16).replace(/[^0-9A-Za-z]/g,''),comment=clean(body.comment,LIMIT.comment),name=clean(body.name,LIMIT.name)||'名無しのトレーナー';
    const minutes=Math.max(10,Math.min(120,+body.minutes||30));
    if(!pass)return J({error:'ルームのあいことば（数字・英字）を入れてください。'},400);
    const ng=ngCheck(rule,comment,name)||await rateOk(db,ip);if(ng)return J({error:ng},400);
    const aid=await aidOf(ip,env);
    const r=await db.prepare(`INSERT INTO lobby(fmt,rule,pass,comment,name,created_at,expires_at,aid,ip) VALUES(?,?,?,?,?,?,?,?,?) RETURNING id`).bind(fmt,rule,pass,comment,name,now,now+minutes*60e3,aid,ip).first();
    return J({ok:true,id:r&&r.id});
  }
  /* 自分の募集をしめきる（同じIDのときだけ） */
  if((m=path.match(/^\/api\/lobby\/(\d+)\/close$/))&&req.method==='POST'){
    const aid=await aidOf(ip,env);
    const r=await db.prepare(`UPDATE lobby SET expires_at=? WHERE id=? AND (aid=? OR ?)`).bind(now,+m[1],aid,isAdmin?1:0).run();
    return J({ok:!!(r.meta&&r.meta.changes)});
  }
  /* 通報（3人分で自動的に非表示） */
  if(path==='/api/report'&&req.method==='POST'){
    const kind=['post','thread','lobby'].includes(body.kind)?body.kind:null,id=+body.id;
    if(!kind||!id)return J({error:'通報の内容を読めませんでした。'},400);
    const aid=await aidOf(ip,env);
    const reason=REASONS.includes(body.reason)?body.reason:'その他';
    await db.prepare(`INSERT OR IGNORE INTO reports(kind,target,reason,aid,created_at) VALUES(?,?,?,?,?)`).bind(kind,id,reason,aid,now).run();
    const c=await db.prepare(`SELECT COUNT(*) AS n FROM reports WHERE kind=? AND target=?`).bind(kind,id).first();
    if(c&&c.n>=3){const tb=kind==='post'?'posts':kind==='thread'?'threads':'lobby';await db.prepare(`UPDATE ${tb} SET hidden=1 WHERE id=?`).bind(id).run()}
    return J({ok:true});
  }
  /* 管理者：通報の一覧と削除 */
  if(path==='/api/reasons')return J({reasons:REASONS});
  if(path==='/api/admin/reports'&&req.method==='GET'){
    if(!isAdmin)return J({error:!env.ADMIN_TOKEN?'管理用の合言葉（ADMIN_TOKEN）がサーバーに設定されていません。':String(env.ADMIN_TOKEN).length<12?'サーバーの ADMIN_TOKEN を12文字以上にしてください。':'管理用の合言葉が違います。'},401);
    const r=await db.prepare(`SELECT r.kind,r.target,COUNT(*) AS n,MAX(r.created_at) AS last,GROUP_CONCAT(r.reason,' / ') AS reasons,
      CASE r.kind WHEN 'post' THEN (SELECT body FROM posts WHERE id=r.target) WHEN 'note' THEN (SELECT body FROM notes WHERE id=r.target) WHEN 'thread' THEN (SELECT title FROM threads WHERE id=r.target) ELSE (SELECT COALESCE(comment,'')||'（あいことば '||pass||'）' FROM lobby WHERE id=r.target) END AS content,
      CASE r.kind WHEN 'post' THEN (SELECT hidden FROM posts WHERE id=r.target) WHEN 'note' THEN (SELECT hidden FROM notes WHERE id=r.target) WHEN 'thread' THEN (SELECT hidden FROM threads WHERE id=r.target) ELSE (SELECT hidden FROM lobby WHERE id=r.target) END AS hidden,
      CASE r.kind WHEN 'post' THEN (SELECT thread_id FROM posts WHERE id=r.target) WHEN 'thread' THEN r.target ELSE NULL END AS thread_id,
      CASE r.kind WHEN 'post' THEN (SELECT aid FROM posts WHERE id=r.target) WHEN 'note' THEN (SELECT '@'||u.handle FROM notes n JOIN users u ON u.uid=n.uid WHERE n.id=r.target) WHEN 'thread' THEN (SELECT aid FROM threads WHERE id=r.target) ELSE (SELECT aid FROM lobby WHERE id=r.target) END AS aid
      FROM reports r GROUP BY r.kind,r.target ORDER BY last DESC LIMIT 100`).all();
    return J({reports:r.results});
  }
  if(path==='/api/admin/recent'&&req.method==='GET'){
    if(!isAdmin)return J({error:!env.ADMIN_TOKEN?'管理用の合言葉（ADMIN_TOKEN）がサーバーに設定されていません。':String(env.ADMIN_TOKEN).length<12?'サーバーの ADMIN_TOKEN を12文字以上にしてください。':'管理用の合言葉が違います。'},401);
    const p=await db.prepare(`SELECT p.id,p.thread_id,p.no,p.name,p.body,p.created_at,p.aid,p.hidden,t.title FROM posts p LEFT JOIN threads t ON t.id=p.thread_id ORDER BY p.created_at DESC LIMIT 60`).all();
    const l=await db.prepare(`SELECT id,fmt,rule,pass,comment,name,created_at,expires_at,aid,hidden FROM lobby ORDER BY created_at DESC LIMIT 30`).all();
    const n=await db.prepare(`SELECT n.id,n.body,n.created_at,n.hidden,u.handle,u.name FROM notes n LEFT JOIN users u ON u.uid=n.uid ORDER BY n.id DESC LIMIT 60`).all();
    return J({posts:p.results,lobby:l.results,notes:n.results});
  }
  if(path==='/api/admin/dismiss'&&req.method==='POST'){
    if(!isAdmin)return J({error:!env.ADMIN_TOKEN?'管理用の合言葉（ADMIN_TOKEN）がサーバーに設定されていません。':String(env.ADMIN_TOKEN).length<12?'サーバーの ADMIN_TOKEN を12文字以上にしてください。':'管理用の合言葉が違います。'},401);
    await db.prepare(`DELETE FROM reports WHERE kind=? AND target=?`).bind(String(body.kind),+body.id).run();
    return J({ok:true});
  }
  if(path==='/api/admin/delete'&&req.method==='POST'){
    if(!isAdmin)return J({error:!env.ADMIN_TOKEN?'管理用の合言葉（ADMIN_TOKEN）がサーバーに設定されていません。':String(env.ADMIN_TOKEN).length<12?'サーバーの ADMIN_TOKEN を12文字以上にしてください。':'管理用の合言葉が違います。'},401);
    const kind=body.kind,id=+body.id,tb=kind==='post'?'posts':kind==='note'?'notes':kind==='thread'?'threads':kind==='lobby'?'lobby':null;
    if(!tb||!id)return J({error:'削除する対象を読めませんでした。'},400);
    await db.prepare(`UPDATE ${tb} SET hidden=? WHERE id=?`).bind(body.restore?0:1,id).run();
    return J({ok:true});
  }
  return J({error:'見つかりません。'},404);
}
