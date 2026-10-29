/* ===================== スマホに届く通知（Web Push） =====================
   ・送り主の鍵（VAPID）はサーバーが最初に必要になったときに作って D1 に保存する（人が合言葉を入れなくてよい）
   ・通知の中身は RFC 8291（aes128gcm）で暗号化して送る。受け取れない宛先（404/410）は消す
   ・宛先は D1 の push_subs（1人で複数の端末を登録できる） */
const PUSH_SUB='https://pokechan-hub.pages.dev';
const pB64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const pUnB64=s=>Uint8Array.from(atob(String(s).replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(String(s).length/4)*4,'=')),c=>c.charCodeAt(0));
const cat=(...a)=>{const o=new Uint8Array(a.reduce((n,x)=>n+x.length,0));let i=0;for(const x of a){o.set(x,i);i+=x.length}return o};
const te=s=>new TextEncoder().encode(s);
let PUSH_READY=false,VAPID=null;
async function pushInit(db){
  if(PUSH_READY)return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS push_keys(id INTEGER PRIMARY KEY,pub TEXT,jwk TEXT)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS push_subs(endpoint TEXT PRIMARY KEY,uid TEXT NOT NULL,p256dh TEXT,auth TEXT,created_at INTEGER)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS push_subs_uid ON push_subs(uid)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS push_sent(k TEXT PRIMARY KEY,at INTEGER)`)
  ]);
  PUSH_READY=true;
}
async function vapidKeys(db){
  if(VAPID)return VAPID;
  await pushInit(db);
  let r=await db.prepare(`SELECT pub,jwk FROM push_keys WHERE id=1`).first();
  if(!r){
    const kp=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
    const pub=pB64(await crypto.subtle.exportKey('raw',kp.publicKey)),jwk=JSON.stringify(await crypto.subtle.exportKey('jwk',kp.privateKey));
    await db.prepare(`INSERT OR IGNORE INTO push_keys(id,pub,jwk) VALUES(1,?,?)`).bind(pub,jwk).run();
    r=await db.prepare(`SELECT pub,jwk FROM push_keys WHERE id=1`).first();
  }
  const priv=await crypto.subtle.importKey('jwk',JSON.parse(r.jwk),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  return VAPID={pub:r.pub,priv};
}
const hkdf=async(salt,ikm,info,len)=>new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},await crypto.subtle.importKey('raw',ikm,'HKDF',false,['deriveBits']),len*8));
/* 通知の中身の暗号化（RFC 8291 / 8188 aes128gcm、1レコード） */
async function pushEncrypt(p256dh,auth,payload){
  const ua=pUnB64(p256dh),sec=pUnB64(auth);
  const eph=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const as=new Uint8Array(await crypto.subtle.exportKey('raw',eph.publicKey));
  const uaKey=await crypto.subtle.importKey('raw',ua,{name:'ECDH',namedCurve:'P-256'},false,[]);
  const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:uaKey},eph.privateKey,256));
  const ikm=await hkdf(sec,shared,cat(te('WebPush: info\0'),ua,as),32);
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const cek=await hkdf(salt,ikm,te('Content-Encoding: aes128gcm\0'),16),nonce=await hkdf(salt,ikm,te('Content-Encoding: nonce\0'),12);
  const key=await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['encrypt']);
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},key,cat(te(payload),new Uint8Array([2]))));
  const rs=new Uint8Array([0,0,16,0]);/* レコードの大きさ 4096 */
  return cat(salt,rs,new Uint8Array([as.length]),as,ct);
}
async function vapidAuth(db,endpoint){
  const v=await vapidKeys(db),aud=new URL(endpoint).origin;
  const h=pB64(te(JSON.stringify({typ:'JWT',alg:'ES256'}))),p=pB64(te(JSON.stringify({aud,exp:Math.floor(Date.now()/1000)+12*3600,sub:PUSH_SUB})));
  const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},v.priv,te(h+'.'+p));
  return`vapid t=${h}.${p}.${pB64(sig)}, k=${v.pub}`;
}
/* その人の登録している端末すべてに送る。once（例 like:相手:投稿）があれば、同じ通知は24時間に1回だけ（いいねの付け外しで何度も届かないように） */
async function pushTo(db,uid,msg,once){
  try{
    await pushInit(db);
    if(once){const now=Date.now(),k=uid+'|'+once,r=await db.prepare(`SELECT at FROM push_sent WHERE k=?`).bind(k).first();
      if(r&&r.at>now-864e5)return;
      await db.prepare(`INSERT INTO push_sent(k,at) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET at=excluded.at`).bind(k,now).run();
      if(Math.random()<.02)await db.prepare(`DELETE FROM push_sent WHERE at<?`).bind(now-864e5).run()}
    const subs=(await db.prepare(`SELECT endpoint,p256dh,auth FROM push_subs WHERE uid=? LIMIT 10`).bind(uid).all()).results;
    for(const s of subs){
      try{
        const body=await pushEncrypt(s.p256dh,s.auth,JSON.stringify(msg));
        const r=await fetch(s.endpoint,{method:'POST',headers:{'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',TTL:'86400',Urgency:'normal',Authorization:await vapidAuth(db,s.endpoint)},body});
        if(r.status===404||r.status===410)await db.prepare(`DELETE FROM push_subs WHERE endpoint=?`).bind(s.endpoint).run();
      }catch(e){}
    }
  }catch(e){}
}
async function pushApi(req,env,db,path,body,now){
  if(path==='/api/push/key'&&req.method==='GET')return J({key:(await vapidKeys(db)).pub});
  if(!path.startsWith('/api/me/push'))return null;
  if(!fbPid(env))return J({error:'ログイン機能は準備中です。'},503);
  const me=await authOf(req,env);if(!me)return J({error:'ログインし直してください。'},401);
  await pushInit(db);
  if(path==='/api/me/push'&&req.method==='POST'){
    const ep=String(body.endpoint||''),k=body.keys||{};
    if(!/^https:\/\/[^\s]{10,800}$/.test(ep)||!/^[A-Za-z0-9_-]{80,100}$/.test(k.p256dh||'')||!/^[A-Za-z0-9_-]{16,32}$/.test(k.auth||''))return J({error:'通知の登録の形が正しくありません。'},400);
    const n=await db.prepare(`SELECT COUNT(*) AS c FROM push_subs WHERE uid=?`).bind(me.uid).first();
    if(n&&n.c>=10)await db.prepare(`DELETE FROM push_subs WHERE endpoint IN (SELECT endpoint FROM push_subs WHERE uid=? ORDER BY created_at LIMIT 1)`).bind(me.uid).run();
    await db.prepare(`INSERT INTO push_subs(endpoint,uid,p256dh,auth,created_at) VALUES(?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET uid=excluded.uid,p256dh=excluded.p256dh,auth=excluded.auth`).bind(ep,me.uid,k.p256dh,k.auth,now).run();
    return J({ok:true});
  }
  if(path==='/api/me/push/delete'&&req.method==='POST'){
    await db.prepare(`DELETE FROM push_subs WHERE endpoint=? AND uid=?`).bind(String(body.endpoint||''),me.uid).run();
    return J({ok:true});
  }
  if(path==='/api/me/push/test'&&req.method==='POST'){
    await pushTo(db,me.uid,{title:'ポケチャン攻略Hub',body:'通知のテストです。このように届きます。',url:'#/notif'});
    return J({ok:true});
  }
  return null;
}
