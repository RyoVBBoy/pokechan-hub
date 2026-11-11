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
const pubUser=u=>u&&{handle:u.handle,name:u.name,bio:u.bio||'',av:u.avatar||null,created_at:u.created_at,private:!!u.private};
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
  /* トレーナーカード（2026/11/05）：相棒のポケモンと看板パーティ（6匹まで・名前20文字）をプロフィールに出す */
  if(path==='/api/me/card'&&req.method==='POST'){
    if(!row)return J({error:'先にプロフィールを作ってください。'},400);
    const okNo=x=>Number.isInteger(x)&&x>0&&x<20000;
    const partner=body.partner==null?null:+body.partner;
    if(partner!=null&&!okNo(partner))return J({error:'相棒のポケモンが正しくありません。'},400);
    let sc=null;
    if(body.showcase){const s=body.showcase,tt=Array.isArray(s.t)?s.t.map(Number):[];
      if(!tt.length||tt.length>6||!tt.every(okNo))return J({error:'看板パーティが正しくありません。'},400);
      const n=clean(s.n||'',20);const ng=n&&ngCheck('x',n,'');if(ng)return J({error:ng},400);
      sc=JSON.stringify({n,t:tt})}
    await db.prepare(`UPDATE users SET partner=?,showcase=?,updated_at=? WHERE uid=?`).bind(partner,sc,now,me.uid).run();
    return J({ok:true});
  }
  /* 戦術メモ（2026/11/06）：ポケモンごと・タイプごとの短い文。どの端末でも同じに（1つずつ、新しく書いたほうをサイトが残す） */
  if(path==='/api/me/memo'){
    try{await db.prepare(`ALTER TABLE user_data ADD COLUMN memo TEXT`).run()}catch(e){}
    if(req.method==='GET'){const r=await db.prepare(`SELECT memo FROM user_data WHERE uid=?`).bind(me.uid).first();let m=null;try{m=r&&r.memo?JSON.parse(r.memo):null}catch(e){}return J({memo:m})}
    if(req.method==='POST'){const m=body.memo,out={mon:{},type:{},party:{}};
      if(!m||typeof m!=='object')return J({error:'メモの形が正しくありません。'},400);
      for(const k of ['mon','type'])for(const [id,e] of Object.entries(m[k]||{}).slice(0,400)){
        if(k==='mon'&&!/^\d{1,5}$/.test(id))continue;if(k==='type'&&String(id).length>8)continue;
        if(!e||typeof e!=='object')continue;out[k][id]={t:clean(String(e.t||''),400),at:Math.min(Date.now()+864e5,Math.max(0,Math.floor(+e.at||0)))}}
      /* パーティの戦術メモ（7つの項目）：パーティの枠 0〜2 ごと */
      const SECS=['kind','lead','pivot','mega','win','lose','flow'];
      for(const [id,e] of Object.entries((m.party&&typeof m.party==='object')?m.party:{}).slice(0,3)){
        if(!/^[0-2]$/.test(id)||!e||typeof e!=='object')continue;const s={};
        SECS.forEach(k=>{const v=e.s&&typeof e.s==='object'?e.s[k]:'';if(v)s[k]=clean(String(v),600)});
        out.party[id]={s,at:Math.min(Date.now()+864e5,Math.max(0,Math.floor(+e.at||0))),sig:String(e.sig||'').replace(/[^\d-]/g,'').slice(0,40)}}
      const txt=JSON.stringify(out);if(txt.length>200000)return J({error:'メモが多すぎます。'},400);
      await db.prepare(`INSERT INTO user_data(uid,memo,updated_at) VALUES(?,?,0) ON CONFLICT(uid) DO UPDATE SET memo=excluded.memo`).bind(me.uid,txt).run();
      return J({ok:true})}
  }
  /* パーティ（3つまで）をどの端末でも同じにする。中身はその人だけが読める。新しい方（updated_at）を残す */
  if(path==='/api/me/teams'&&req.method==='GET'){
    const r=await db.prepare(`SELECT teams,updated_at FROM user_data WHERE uid=?`).bind(me.uid).first();
    let t=null;try{t=r&&r.teams?JSON.parse(r.teams):null}catch(e){}
    return J({teams:t,updated_at:r?r.updated_at:0});
  }
  if(path==='/api/me/teams'&&req.method==='POST'){
    const t=body.teams,at=Math.floor(+body.updated_at||0);
    const ok=t&&typeof t==='object'&&Array.isArray(t.list)&&t.list.length<=3&&t.list.every(s=>s&&Array.isArray(s.team)&&s.team.length<=6&&s.team.every(x=>x&&Number.isInteger(x.no)));
    if(!ok||!(at>0)||at>now+864e5)return J({error:'パーティの形が正しくありません。'},400);
    const txt=JSON.stringify({cur:Math.max(0,Math.min(2,+t.cur||0)),list:t.list.map(s=>({name:clean(s.name,20),team:s.team}))});
    if(txt.length>30000)return J({error:'パーティのデータが大きすぎます。'},400);
    const r=await db.prepare(`SELECT updated_at FROM user_data WHERE uid=?`).bind(me.uid).first();
    if(r&&r.updated_at>at)return J({ok:false,newer:true,updated_at:r.updated_at},409);
    await db.prepare(`INSERT INTO user_data(uid,teams,updated_at) VALUES(?,?,?) ON CONFLICT(uid) DO UPDATE SET teams=excluded.teams,updated_at=excluded.updated_at`).bind(me.uid,txt,at).run();
    return J({ok:true,updated_at:at});
  }
  /* プロフィールの写真（2026/11/03）：先に /api/media で送った画像の鍵を付ける。{remove:true} で外す。
     付けた画像は note_id=AV_NOTE にして、投稿に付かなかった画像の掃除で消えないようにする。前の写真は消す */
  if(path==='/api/me/avatar'&&req.method==='POST'){
    if(!row)return J({error:'先にプロフィールを作ってください。'},403);
    await socialInit(db);await mediaInit(db);
    const old=(await db.prepare(`SELECT avatar FROM users WHERE uid=?`).bind(me.uid).first()||{}).avatar;
    let key=null;
    if(!body.remove){
      key=String(body.key||'');
      const m=/^[0-9a-f]{32}$/.test(key)?await db.prepare(`SELECT key FROM media WHERE key=? AND uid=? AND note_id=0`).bind(key,me.uid).first():null;
      if(!m)return J({error:'写真が見つかりません。もう一度選んでください。'},400);
      await db.prepare(`UPDATE media SET note_id=? WHERE key=?`).bind(AV_NOTE,key).run();
    }
    await db.prepare(`UPDATE users SET avatar=?,updated_at=? WHERE uid=?`).bind(key,now,me.uid).run();
    if(old&&old!==key)await mediaDrop(env,db,'key=? AND uid=?',old,me.uid);
    const u=await db.prepare(`SELECT * FROM users WHERE uid=?`).bind(me.uid).first();
    return J({ok:true,user:pubUser(u)});
  }
  /* アカウントの削除（Firebase 側のアカウントはサイトから消す） */
  if(path==='/api/me/delete'&&req.method==='POST'){
    await socialDeleteUser(db,me.uid,env);
    await db.prepare(`DELETE FROM user_data WHERE uid=?`).bind(me.uid).run();
    await pushInit(db);await db.prepare(`DELETE FROM push_subs WHERE uid=?`).bind(me.uid).run();
    await db.prepare(`DELETE FROM users WHERE uid=?`).bind(me.uid).run();
    return J({ok:true});
  }
  return J({error:'見つかりません。'},404);
}
