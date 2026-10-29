/* ===================== ログイン（Firebase Authentication） =====================
   サイト・アプリから届く IDトークン（Authorization: Bearer ...）を、Google の公開鍵で確かめる。
   パスワードなどはこのサーバーでは一切扱わない。FIREBASE_PROJECT_ID が未設定ならログイン機能は止まる。 */
const FB_PID='__FIREBASE_PROJECT_ID__';   /* config/public.json の projectId（組み立て時に入る） */
const fbPid=env=>env.FIREBASE_PROJECT_ID||FB_PID;
let JWKS=null,JWKS_AT=0;
const b64u=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'=')),c=>c.charCodeAt(0));
async function authKeys(){
  if(JWKS&&Date.now()-JWKS_AT<3600e3)return JWKS;
  const r=await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  if(!r.ok)throw new Error('ログインの確認用の鍵を取得できませんでした');
  JWKS=(await r.json()).keys||[];JWKS_AT=Date.now();return JWKS;
}
async function verifyIdToken(tok,env){
  const pid=fbPid(env);if(!pid||!tok)return null;
  const parts=String(tok).split('.');if(parts.length!==3)return null;
  const [h,p,s]=parts;let hd,pl;
  try{hd=JSON.parse(new TextDecoder().decode(b64u(h)));pl=JSON.parse(new TextDecoder().decode(b64u(p)))}catch(e){return null}
  if(hd.alg!=='RS256'||!hd.kid)return null;
  const now=Math.floor(Date.now()/1000);
  if(pl.aud!==pid||pl.iss!=='https://securetoken.google.com/'+pid||typeof pl.sub!=='string'||!pl.sub||pl.sub.length>128)return null;
  if(!(pl.exp>now-30)||pl.iat>now+300||(pl.auth_time&&pl.auth_time>now+300))return null;
  const k=(await authKeys()).find(x=>x.kid===hd.kid);if(!k)return null;
  const key=await crypto.subtle.importKey('jwk',{kty:k.kty,n:k.n,e:k.e,alg:'RS256',ext:true},{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const ok=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,b64u(s),new TextEncoder().encode(h+'.'+p));
  if(!ok)return null;
  return{uid:pl.sub,email:pl.email||null,emailVerified:!!pl.email_verified,provider:(pl.firebase&&pl.firebase.sign_in_provider)||''};
}
async function authOf(req,env){
  const a=req.headers.get('authorization')||'';const m=a.match(/^Bearer\s+(.+)$/i);
  if(!m)return null;
  try{return await verifyIdToken(m[1].trim(),env)}catch(e){return null}
}
/* ユーザーID（@の後ろ）：半角英数字と_の3〜15文字。運営や公式と紛らわしいものは使えない */
const HANDLE_RE=/^[A-Za-z0-9_]{3,15}$/;
const HANDLE_NG=['admin','administrator','root','system','support','official','pokemon','nintendo','gamefreak','creatures','pokechan','pokechanhub','staff','unei','moderator','null','undefined','me','api','account'];
function handleError(h){
  if(!HANDLE_RE.test(h))return 'ユーザーIDは半角英数字と _ の3〜15文字にしてください。';
  const l=h.toLowerCase();if(HANDLE_NG.some(x=>l===x||l.startsWith('official')||l.includes('pokemon')||l.includes('nintendo')))return 'このユーザーIDは使えません。';
  return null;
}
const pubUser=u=>u&&{handle:u.handle,name:u.name,bio:u.bio||'',created_at:u.created_at};
async function userApi(req,env,db,path,body,now){
  /* 公開プロフィール（/api/u/…）は social.js */
  if(!path.startsWith('/api/me'))return null;
  if(!fbPid(env))return J({error:'ログイン機能は準備中です。'},503);
  const me=await authOf(req,env);
  if(!me)return J({error:'ログインし直してください。'},401);
  const row=await db.prepare(`SELECT * FROM users WHERE uid=?`).bind(me.uid).first();
  if(row&&row.banned)return J({error:'このアカウントは利用を停止しています。'},403);
  /* 自分の情報 */
  if(path==='/api/me'&&req.method==='GET')return J({user:row?pubUser(row):null,email:me.email,provider:me.provider});
  /* プロフィールの作成・変更 */
  if(path==='/api/me'&&req.method==='POST'){
    const handle=String(body.handle||'').trim(),name=clean(body.name,20),bio=clean(body.bio,160);
    const he=handleError(handle);if(he)return J({error:he},400);
    if(name.length<1)return J({error:'表示名を入れてください。'},400);
    const ng=ngCheck(handle,name,bio);if(ng)return J({error:ng},400);
    if(!row&&!body.agree)return J({error:'利用規約とプライバシーポリシーへの同意が必要です。'},400);
    const dup=await db.prepare(`SELECT uid FROM users WHERE handle=? COLLATE NOCASE`).bind(handle).first();
    if(dup&&dup.uid!==me.uid)return J({error:'このユーザーIDはすでに使われています。'},409);
    if(row)await db.prepare(`UPDATE users SET handle=?,name=?,bio=?,updated_at=? WHERE uid=?`).bind(handle,name,bio,now,me.uid).run();
    else await db.prepare(`INSERT INTO users(uid,handle,name,bio,created_at,updated_at,agreed_at) VALUES(?,?,?,?,?,?,?)`).bind(me.uid,handle,name,bio,now,now,now).run();
    const u=await db.prepare(`SELECT * FROM users WHERE uid=?`).bind(me.uid).first();
    return J({ok:true,user:pubUser(u)});
  }
  /* アカウントの削除（Firebase 側のアカウントはサイトから消す） */
  if(path==='/api/me/delete'&&req.method==='POST'){
    await socialDeleteUser(db,me.uid);
    await db.prepare(`DELETE FROM users WHERE uid=?`).bind(me.uid).run();
    return J({ok:true});
  }
  return J({error:'見つかりません。'},404);
}
