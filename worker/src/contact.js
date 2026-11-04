/* ===================== お問い合わせ・間違いの報告（2026/11/04） =====================
   ・POST /api/contact {kind,body,page,reply}：だれでも送れる（ログインしていれば uid も残す）。
     kind＝data（データの間違い）・bug（不具合）・idea（要望）・other。page＝どの画面から（#/p/445 など）。reply＝返事がほしいときの連絡先（任意・運営者だけが見る）
     同じ人（IPアドレスを合言葉でまぜた番号。IP そのものは保存しない）から1時間に5件・1日に20件まで。本文2000文字まで。
   ・GET /api/admin/contacts?st=new|done|all、POST /api/admin/contacts {id,st:'done'|'new',note}（管理者だけ） */
let CONTACT_READY=false;
async function contactInit(db){
  if(CONTACT_READY)return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS contacts(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT,body TEXT,page TEXT,reply TEXT,uid TEXT,who TEXT,ua TEXT,st TEXT DEFAULT 'new',note TEXT,created_at INTEGER)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS contacts_st ON contacts(st,created_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS contacts_who ON contacts(who,created_at)`)
  ]);
  CONTACT_READY=true;
}
const CONTACT_KINDS=['data','bug','idea','other'];
async function contactApi(req,env,db,path,body,now,isAdmin,ip){
  if(path==='/api/contact'&&req.method==='POST'){
    await contactInit(db);
    const kind=CONTACT_KINDS.includes(body.kind)?body.kind:'other';
    const text=String(body.body||'').replace(/\r/g,'').trim().slice(0,2000),page=String(body.page||'').slice(0,120),reply=String(body.reply||'').trim().slice(0,100);
    if(text.length<5)return J({error:'内容を5文字以上で書いてください。'},400);
    const who=(await sha(ip+'|contact|'+(env.APP_TOKEN||'pc'))).slice(0,16);
    const c=await db.prepare(`SELECT SUM(created_at>?2) AS h,COUNT(*) AS d FROM contacts WHERE who=?1 AND created_at>?3`).bind(who,now-36e5,now-864e5).first();
    if(c&&(c.h||0)>=5)return J({error:'続けて送れるのは1時間に5件までです。少し時間をあけてください。'},429);
    if(c&&(c.d||0)>=20)return J({error:'1日に送れる件数を超えました。'},429);
    let uid=null;try{if(fbPid(env)){const me=await authOf(req,env);if(me)uid=me.uid}}catch(e){}
    const ua=String(req.headers.get('user-agent')||'').slice(0,160);
    await db.prepare(`INSERT INTO contacts(kind,body,page,reply,uid,who,ua,created_at) VALUES(?,?,?,?,?,?,?,?)`).bind(kind,text,page,reply||null,uid,who,ua,now).run();
    return J({ok:true});
  }
  if(path==='/api/admin/contacts'){
    if(!isAdmin)return J({error:'管理用の合言葉が違います。'},401);
    await contactInit(db);
    if(req.method==='GET'){const st=new URL(req.url).searchParams.get('st')||'new';
      const r=st==='all'?await db.prepare(`SELECT * FROM contacts ORDER BY id DESC LIMIT 200`).all():await db.prepare(`SELECT * FROM contacts WHERE st=? ORDER BY id DESC LIMIT 200`).bind(st==='done'?'done':'new').all();
      const n=await db.prepare(`SELECT COUNT(*) AS n FROM contacts WHERE st='new'`).first();
      return J({contacts:r.results.map(x=>({id:x.id,kind:x.kind,body:x.body,page:x.page,reply:x.reply,login:!!x.uid,ua:x.ua,st:x.st,note:x.note,created_at:x.created_at})),unread:n?n.n:0})}
    if(req.method==='POST'){const id=+body.id;if(!id)return J({error:'番号がありません。'},400);
      await db.prepare(`UPDATE contacts SET st=?,note=? WHERE id=?`).bind(body.st==='new'?'new':'done',String(body.note||'').slice(0,500)||null,id).run();return J({ok:true})}
  }
  return null;
}
