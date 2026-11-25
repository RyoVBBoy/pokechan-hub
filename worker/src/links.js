/* ===================== タイムラインのリンク・安全確認・利用停止の記録（2026/11/25 docs/secure-link-posting-handoff.md） =====================
   すべて「はじめは止めてある」。Cloudflare の変数で開く（本番で開くのは、独立した確認と依頼主の承認のあと）：
     LINKS_POST=1   … ログインした人の投稿・返信に、https のリンクを1つだけ付けられる（SANCTIONS_ON=1・EMAIL_HMAC_KEY・WEBRISK_API_KEY も要る）
     LINKS_CLICK=1  … 投稿のリンクを押したときに、サーバーで確かめてから確認の画面を出す（止めると、すべてのリンクが押せない文字になる）
     SANCTIONS_ON=1 … 管理画面から理由つきの利用停止（UID・確認済みメールの記録）を作れる。メールの記録（ハッシュ）を始める
   止めても投稿・利用停止の記録は消さない（docs/secure-link-posting-runbook.md）。
   すでにある「有効な利用停止」は、変数に関係なく守る（止めた瞬間に停止が解けないように）。
   合言葉（変数の値）：WEBRISK_API_KEY（Google Cloud Web Risk）、EMAIL_HMAC_KEY（32文字以上）・EMAIL_HMAC_KEY_VER、
     入れかえ中の前の鍵 EMAIL_HMAC_KEY_PREV・EMAIL_HMAC_KEY_PREV_VER。どれもサイトには送らず、記録にも残さない。
   users.banned：0＝ふつう、1＝運営者の手動の停止（前からの /api/admin/ban）、2＝この利用停止の記録による停止（期限が来ると0に戻す。1は戻さない） */
const LK_URL_MAX=2048,LK_BODY_RAW_MAX=1200;
const lkOn=(env,k)=>String((env&&env[k])||'')==='1';
const LK_WR_EP='https://webrisk.googleapis.com/v1/uris:search';
const LK_WR_TYPES=['MALWARE','SOCIAL_ENGINEERING','UNWANTED_SOFTWARE','SOCIAL_ENGINEERING_EXTENDED_COVERAGE'];
/* 短縮URL（行き先が見えない）と、外部の連絡先へ誘うもの（メッセージ・招待）。安全の保証ではなく、よくある形を断るだけ */
const LK_SHORT=['bit.ly','bitly.com','t.co','goo.gl','tinyurl.com','ow.ly','is.gd','v.gd','x.gd','buff.ly','cutt.ly','rebrand.ly','shorturl.at','rb.gy','tiny.cc','t.ly','s.id','bl.ink','adf.ly','shorte.st','qr.ae','dlvr.it','ift.tt','trib.al','po.st','x.co','u.nu','lnkd.in','amzn.to','amzn.asia','g.co','surl.li','tr.ee','linktr.ee','lit.link','00m.in','ux.nu','urx.nu','onl.bz','kutt.it','short.io','shorturl.com','tinu.be','page.link','app.link','onelink.me','smarturl.it','hyperurl.co'];
const LK_CONTACT=['line.me','lin.ee','line.naver.jp','discord.gg','discord.com','discordapp.com','discord.new','t.me','telegram.me','telegram.org','wa.me','whatsapp.com','chat.whatsapp.com','m.me','messenger.com','open.kakao.com','kakao.com','signal.me','skype.com','join.skype.com','kik.me','viber.com','wechat.com','weixin.qq.com'];
const LK_INTERNAL=['localhost','local','localdomain','internal','intranet','lan','home','corp','private','test','example','invalid','onion','arpa','alt','i2p','home.arpa','test.dev'];
/* 合言葉・ログインの印などが入っていそうなパラメータ（入れると、その人のアカウントが乗っ取られることがある） */
const LK_SENS=new Set(['token','access_token','id_token','refresh_token','auth','authorization','apikey','api_key','key','password','passwd','pwd','pass','secret','client_secret','session','sessionid','session_id','sid','sig','signature','x-amz-signature','x-amz-credential','x-goog-signature','jwt','otp','code_verifier']);
/* 転送（オープンリダイレクト）によく使われる名前 */
const LK_REDIR=new Set(['url','u','redirect','redirect_uri','redirect_url','redir','next','goto','go','return','returnto','return_to','returnurl','continue','dest','destination','target','to','out','link','r','q']);
const hostIn=(h,l)=>l.some(d=>h===d||h.endsWith('.'+d));
const LK_ERR={
  type:'リンクの形を読めませんでした。',long:`リンクが長すぎます（${LK_URL_MAX}バイトまで）。`,ascii:'リンクに空白・全角の文字・見えない文字が入っています。ブラウザのアドレス欄からコピーし直してください。',
  backslash:'リンクに「\\」が入っています。正しいリンクをコピーし直してください。',http:'https:// で始まるリンクだけ付けられます（http:// は付けられません）。',scheme:'https:// で始まるリンクだけ付けられます。',
  cred:'ユーザー名やパスワードを含むリンクは付けられません。',port:'ポート番号の付いたリンクは付けられません。',enc:'リンクの文字の書き方（%の表し方）が正しくありません。',
  ambiguous:'リンクに見えない文字・向きを変える文字が入っています。',parse:'リンクの形が正しくありません。',host:'リンク先のドメインの形が正しくありません。',
  ip:'IPアドレスのリンクは付けられません。ドメイン名のリンクにしてください。',internal:'公開されていない（端末・社内向けの）アドレスは付けられません。',
  short:'短縮URLは付けられません（行き先が見えないため）。元のリンクを付けてください。',contact:'外部の連絡先（メッセージ・招待など）へのリンクは付けられません。',
  redirect:'別のサイトへ転送するリンクは付けられません。行き先のリンクを直接付けてください。',sens:'ログインの印・合言葉などが入っていそうなリンクは付けられません（アカウントを乗っ取られるおそれがあります）。',
  ng:'書き込めない言葉が含まれています。',multi:'リンクは1つの投稿に1つだけです。',bare:'本文にURLやドメインのような書き方があります。リンクは「リンク」欄に1つだけ入れてください。',
  edge:'リンクの前後は空白か改行で区切ってください。',dup:'本文とリンク欄の両方にリンクがあります。リンクは1つだけにしてください。'
};
/* リンク1つを確かめて、決まった形（canonical）にする。順番：①型 ②長さ（形を直す前） ③使える文字 ④スキーム ⑤ユーザー名・ポート ⑥%の書き方 ⑦見えない文字
   ⑧WHATWG URL で読む ⑨ホスト（入力そのままと読んだ結果が同じか・IP・1語・社内・短縮・連絡先） ⑩パラメータ（転送・合言葉） ⑪NGワード ⑫直したあとの長さ */
function lkValidate(raw){
  const E=k=>({error:LK_ERR[k],code:k});
  if(typeof raw!=='string')return E('type');
  if(raw.length>LK_URL_MAX)return E('long');
  const s=raw.trim();
  if(new TextEncoder().encode(s).length>LK_URL_MAX)return E('long');
  if(!s)return E('type');
  if(!/^[\x21-\x7e]+$/.test(s))return E('ascii');
  if(s.includes('\\'))return E('backslash');
  /* URL に書けない記号（"<>`{}|^）：HTML に入れる攻撃・見た目のごまかしに使われる */
  if(/[<>"`{}|^]/.test(s))return E('ascii');
  if(/^http:\/\//i.test(s))return E('http');
  if(!/^https:\/\//i.test(s))return E('scheme');
  const auth=s.slice(8).split(/[\/?#]/)[0];
  if(auth.includes('@'))return E('cred');
  if(auth.includes(':'))return E('port');
  if(auth.includes('%')||/%(?![0-9A-Fa-f]{2})/.test(s))return E('enc');
  let dec;try{dec=decodeURIComponent(s)}catch(e){return E('enc')}
  if(/[\u0000-\u001f\u007f-\u009f­͏؜ᅟᅠ឴឵᠎​-‏‪-‮⁠-⁯ㅤ︀-️﻿ﾠ￹-￻\\]/.test(dec))return E('ambiguous');
  let u;try{u=new URL(s)}catch(e){return E('parse')}
  if(u.protocol!=='https:')return E('scheme');
  if(u.username||u.password)return E('cred');
  if(u.port)return E('port');
  const h=u.hostname;
  /* 入力したホストと読んだ結果が同じでなければ断る（0x7f.1 のような書き方・末尾の点・大文字小文字以外の書きかえ） */
  if(h!==auth.toLowerCase())return E('host');
  if(h.startsWith('[')||/^[0-9.]+$/.test(h))return E('ip');
  if(h.length>253||!h.includes('.'))return E('host');
  const lb=h.split('.');
  if(!lb.every(x=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(x)))return E('host');
  const tld=lb[lb.length-1];
  if(!(/^[a-z]{2,63}$/.test(tld)||/^xn--[a-z0-9-]{1,59}$/.test(tld)))return E('host');
  if(hostIn(h,LK_INTERNAL))return E('internal');
  if(hostIn(h,LK_SHORT))return E('short');
  if(hostIn(h,LK_CONTACT))return E('contact');
  if(/:\/\/|^\/\//.test(decodeURIComponent(u.pathname)))return E('redirect');
  for(const [k,v] of u.searchParams){
    const kl=k.toLowerCase();
    if(LK_SENS.has(kl))return E('sens');
    if(/^\s*(?:[a-z][a-z0-9+.\-]*:)?\/\//i.test(v)||/^\s*(?:https?|javascript|data|vbscript|file|blob):/i.test(v)||(LK_REDIR.has(kl)&&/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(v)))return E('redirect');
  }
  /* #のあと（ログインの印が #access_token= の形で入ることがある） */
  if(u.hash.includes('=')){let hp;try{hp=new URLSearchParams(u.hash.slice(1))}catch(e){return E('enc')}
    for(const [k,v] of hp){if(LK_SENS.has(k.toLowerCase()))return E('sens');if(/^\s*(?:[a-z][a-z0-9+.\-]*:)?\/\//i.test(v))return E('redirect')}}
  if(ngWords(dec))return E('ng');
  const url=u.href;
  if(new TextEncoder().encode(url).length>LK_URL_MAX)return E('long');
  const ck=new URL(url);ck.hash='';
  return{url,host:h,check:ck.href};
}
/* 本文の中のリンク。https:// のかたまり（ASCII の URL の文字だけ）を探し、最後の句読点・かっこは外す。
   返す形：{text（リンクを除いた本文）, url（見つかった1つ）} か {error}。見つからなければ {text, url:null} */
const LK_TOK=/https?:\/\/[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+/gi;
function lkFromText(t){
  const ms=[...String(t).matchAll(LK_TOK)];
  if(!ms.length)return{text:t,url:null};
  if(ms.length>1)return{error:LK_ERR.multi,code:'multi'};
  const m=ms[0];let tok=m[0];
  /* 最後の句読点・閉じかっこ（開きかっこが足りないもの）は本文に戻す */
  for(;;){const c=tok[tok.length-1];
    if(/[.,;:!?'"]/.test(c)){tok=tok.slice(0,-1);continue}
    if(c===')'&&(tok.split('(').length<tok.split(')').length)){tok=tok.slice(0,-1);continue}
    if(c===']'&&(tok.split('[').length<tok.split(']').length)){tok=tok.slice(0,-1);continue}
    break}
  const a=m.index,b=a+tok.length,pre=t.slice(0,a),post=t.slice(b);
  /* 前後は空白・改行・本文の始め終わり・日本語などの ASCII でない文字・句読点やかっこ（「見て(https://…)」） */
  if(pre&&/[A-Za-z0-9]$/.test(pre))return{error:LK_ERR.edge,code:'edge'};
  if(post&&/^[\x21-\x7e]/.test(post)&&!/^[.,;:!?'")\]]/.test(post))return{error:LK_ERR.edge,code:'edge'};
  const L=pre.replace(/[ \t]+$/,''),R=post.replace(/^[ \t]+/,'');
  const sep=L&&R&&!/\n$/.test(L)&&!/^\n/.test(R)&&(L!==pre||R!==post)?' ':'';
  const text=(L+sep+R).trim();
  return{text,url:tok};
}
let LK_READY=false;
async function linksInit(db){
  if(LK_READY)return;
  await db.batch([
    /* 利用者のリンク（bot の notes.link とは別）。note_id は notes の番号（INTEGER PRIMARY KEY＝rowid） */
    db.prepare(`CREATE TABLE IF NOT EXISTS note_links(note_id INTEGER PRIMARY KEY,uid TEXT NOT NULL,url TEXT NOT NULL,host TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',verdict TEXT,verdict_at INTEGER,expires_at INTEGER,created_at INTEGER,updated_at INTEGER)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS note_links_uid ON note_links(uid,created_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS note_links_state ON note_links(state,updated_at)`),
    /* 安全確認の結果の覚え（リンクの SHA-256 で。期限つき） */
    db.prepare(`CREATE TABLE IF NOT EXISTS link_verdicts(h TEXT PRIMARY KEY,verdict TEXT NOT NULL,types TEXT,checked_at INTEGER,expires_at INTEGER)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS link_verdicts_exp ON link_verdicts(expires_at)`),
    /* リンクを付けようとした回数（断ったものも数える）・押した回数・安全確認の1日の回数 */
    db.prepare(`CREATE TABLE IF NOT EXISTS link_attempts(uid TEXT NOT NULL,at INTEGER NOT NULL)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS link_attempts_uid ON link_attempts(uid,at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS link_clicks(who TEXT NOT NULL,at INTEGER NOT NULL)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS link_clicks_who ON link_clicks(who,at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS link_quota(day TEXT PRIMARY KEY,n INTEGER NOT NULL DEFAULT 0)`),
    /* 記録（URL そのものは残さない：ホスト・リンクのハッシュの先頭・理由の短い札だけ） */
    db.prepare(`CREATE TABLE IF NOT EXISTS link_events(id INTEGER PRIMARY KEY AUTOINCREMENT,at INTEGER,uid TEXT,note_id INTEGER,host TEXT,h TEXT,kind TEXT,detail TEXT)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS link_events_at ON link_events(at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS link_events_note ON link_events(note_id)`),
    /* 利用停止の記録（UID は変わらない番号。メールは鍵つきハッシュだけ） */
    db.prepare(`CREATE TABLE IF NOT EXISTS sanctions(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT NOT NULL,uid TEXT,ehash TEXT,kver TEXT,permanent INTEGER NOT NULL DEFAULT 0,starts_at INTEGER,expires_at INTEGER,
      reason TEXT NOT NULL,evidence TEXT,source TEXT,actor TEXT,status TEXT NOT NULL DEFAULT 'active',appeal TEXT,parent INTEGER,created_at INTEGER,updated_at INTEGER)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS sanctions_uid ON sanctions(uid,status)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS sanctions_eh ON sanctions(ehash,status)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sanction_events(id INTEGER PRIMARY KEY AUTOINCREMENT,sanction_id INTEGER,at INTEGER,actor TEXT,action TEXT,note TEXT)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS sanction_events_s ON sanction_events(sanction_id,id)`),
    /* UID と確認済みメールのハッシュの対応（Firebase の署名を確かめた email_verified のメールだけ） */
    db.prepare(`CREATE TABLE IF NOT EXISTS user_emails(uid TEXT NOT NULL,ehash TEXT NOT NULL,kver TEXT NOT NULL,first_at INTEGER,last_at INTEGER,PRIMARY KEY(uid,ehash))`),
    db.prepare(`CREATE INDEX IF NOT EXISTS user_emails_eh ON user_emails(ehash)`)
  ]);
  LK_READY=true;
}
/* ---------- 確認済みメールのハッシュ ---------- */
/* ならし方：前後の空白を外す・NFC・全体を小文字（Firebase のメールは大文字小文字を区別しない）・ドメインは IDN を ASCII（punycode）に。
   「+」や「.」はならさない（別の人の別のアドレスを同じと見なさないため）。形がおかしければ null */
function emailNorm(e){
  if(typeof e!=='string')return null;
  const s=e.trim().normalize('NFC');
  if(!s||s.length>254||/[\s\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/.test(s))return null;
  const at=s.lastIndexOf('@');if(at<1||at!==s.indexOf('@')||at===s.length-1)return null;
  const loc=s.slice(0,at).toLowerCase(),dom=s.slice(at+1);
  if(loc.length>64)return null;
  let d;try{d=new URL('https://'+dom+'/').hostname}catch(e){return null}
  if(!d||!d.includes('.')||d.startsWith('[')||d.endsWith('.')||d!==d.toLowerCase())return null;
  return loc+'@'+d;
}
const emailKeys=env=>{const l=[];const k=String(env.EMAIL_HMAC_KEY||''),p=String(env.EMAIL_HMAC_KEY_PREV||'');
  if(k.length>=32)l.push({k,v:String(env.EMAIL_HMAC_KEY_VER||'v1').slice(0,16)});
  if(p.length>=32&&p!==k)l.push({k:p,v:String(env.EMAIL_HMAC_KEY_PREV_VER||'v0').slice(0,16),prev:true});
  return l};
async function hmacHex(key,msg){const ck=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC',ck,new TextEncoder().encode(msg)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
/* 鍵ごとのハッシュ（今の鍵を先に）。鍵がなければ [] */
async function emailHashes(env,email){const n=emailNorm(email);if(!n)return [];const out=[];
  for(const x of emailKeys(env))out.push({h:await hmacHex(x.k,'gk-email|'+n),v:x.v,prev:!!x.prev});return out}
/* ---------- 利用停止の判定 ---------- */
const SANC_ACTIVE=`status='active' AND (permanent=1 OR expires_at>?)`;
/* 期限が来た「記録による停止（banned=2）」だけを元に戻す。手動の停止（1）は触らない */
const sanctionSweepStmt=(db,now,uid)=>db.prepare(`UPDATE users SET banned=0 WHERE banned=2${uid?' AND uid=?3':''}
  AND NOT EXISTS(SELECT 1 FROM sanctions s WHERE s.kind='uid' AND s.uid=users.uid AND s.status='active' AND (s.permanent=1 OR s.expires_at>?1))
  AND NOT EXISTS(SELECT 1 FROM sanctions s JOIN user_emails ue ON ue.ehash=s.ehash WHERE s.kind='email' AND ue.uid=users.uid AND s.status='active' AND (s.permanent=1 OR s.expires_at>?2))`).bind(...(uid?[now,now,uid]:[now,now]));
async function sanctionSweep(db,now){await linksInit(db);await sanctionSweepStmt(db,now).run()}
/* その UID・確認済みメールに有効な停止があるか。{deny:{id,permanent,expires_at}} か {} か 例外（調べられない） */
async function sanctionState(db,env,uid,email,emailVerified,now){
  const u=await db.prepare(`SELECT id,permanent,expires_at FROM sanctions WHERE kind='uid' AND uid=? AND ${SANC_ACTIVE} ORDER BY permanent DESC,expires_at DESC LIMIT 1`).bind(uid,now).first();
  if(u)return{deny:u};
  /* この UID につながっている確認済みメールのハッシュ（前に記録したもの）にも停止があるか */
  const e=await db.prepare(`SELECT s.id,s.permanent,s.expires_at FROM sanctions s JOIN user_emails ue ON ue.ehash=s.ehash WHERE s.kind='email' AND ue.uid=? AND s.status='active' AND (s.permanent=1 OR s.expires_at>?) LIMIT 1`).bind(uid,now).first();
  if(e)return{deny:e};
  const any=await db.prepare(`SELECT 1 AS x FROM sanctions WHERE kind='email' AND ${SANC_ACTIVE} LIMIT 1`).bind(now).first();
  let hs=[];
  if(email&&emailVerified)hs=await emailHashes(env,email);
  if(any){
    /* メールの停止があるのに鍵がなければ確かめられない＝閉じる */
    if(!emailKeys(env).length)throw new Error('sanction-key-missing');
    for(const x of hs){const r=await db.prepare(`SELECT id,permanent,expires_at,reason,evidence,source,actor,parent FROM sanctions WHERE kind='email' AND ehash=? AND ${SANC_ACTIVE} LIMIT 1`).bind(x.h,now).first();
      if(r){
        /* 前の鍵で見つかったら、今の鍵のハッシュでも同じ停止を記録する（鍵の入れかえ） */
        if(x.prev&&hs[0]&&!hs[0].prev)await db.prepare(`INSERT INTO sanctions(kind,uid,ehash,kver,permanent,starts_at,expires_at,reason,evidence,source,actor,status,parent,created_at,updated_at)
          SELECT 'email',NULL,?,?,permanent,starts_at,expires_at,reason,evidence,'rekey',actor,'active',id,?,? FROM sanctions WHERE id=? AND NOT EXISTS(SELECT 1 FROM sanctions WHERE kind='email' AND ehash=? AND status='active')`).bind(hs[0].h,hs[0].v,now,now,r.id,hs[0].h).run();
        return{deny:r,hs}}}
  }
  return{hs};
}
/* 確認済みメールと UID を結びつける（SANCTIONS_ON=1 と鍵があるときだけ。1日に1回だけ書く） */
async function emailLink(db,uid,hs,now){
  const cur=hs.find(x=>!x.prev);if(!cur)return false;
  const r=await db.prepare(`SELECT last_at FROM user_emails WHERE uid=? AND ehash=?`).bind(uid,cur.h).first();
  if(r&&r.last_at>now-864e5)return true;
  await db.prepare(`INSERT INTO user_emails(uid,ehash,kver,first_at,last_at) VALUES(?,?,?,?,?) ON CONFLICT(uid,ehash) DO UPDATE SET last_at=excluded.last_at,kver=excluded.kver`).bind(uid,cur.h,cur.v,now,now).run();
  return true;
}
const SANC_MSG='このアカウントは利用を停止しています。';
/* ログインした人のリクエストごとに、利用停止を確かめる（api() の最初）。
   ・停止中：書きこみ（GET 以外）は 403。読むだけ（GET）はログインしていない人と同じ扱い（ふつうに読むのは止めない）。/api/me は 403 で理由を伝える
   ・記録を調べられない（表がない・鍵がない）：閉じる＝503
   返す値：Response（止める）か null（続ける） */
async function sanctionGate(req,env,db,path,now){
  if(!/^Bearer\s+\S/i.test(req.headers.get('authorization')||'')||!fbPid(env))return null;
  const me=await authOf(req,env);if(!me)return null;
  let st;
  try{await linksInit(db);st=await sanctionState(db,env,me.uid,me.email,me.emailVerified,now)}
  catch(e){AUTH_DENY.set(req,{err:true});
    /* 読むだけ（GET）は、ログインしていない人と同じ扱いで続ける（ふつうに読むのは止めない）。書きこみと /api/me は閉じる */
    if(req.method==='GET'&&path!=='/api/me')return null;
    return J({error:'いまアカウントの状態を確かめられません。少し時間をおいてください。'},503)}
  if(st.deny){
    AUTH_DENY.set(req,{id:st.deny.id});
    const until=st.deny.permanent?null:st.deny.expires_at;
    const msg=SANC_MSG+(until?`（${new Date(until+9*3600e3).toISOString().slice(0,10)} まで）`:'');
    if(req.method!=='GET'||path==='/api/me')return J({error:msg,sanction:{permanent:!!st.deny.permanent,until}},403);
    return null;
  }
  try{
    /* 期限が来ていれば、この人の記録による停止（banned=2）を戻す */
    if(req.method!=='GET'||path==='/api/me'){await sanctionSweepStmt(db,now,me.uid).run();
      if(lkOn(env,'SANCTIONS_ON')&&st.hs&&st.hs.length)await emailLink(db,me.uid,st.hs,now)}
  }catch(e){if(req.method!=='GET')return J({error:'いまアカウントの状態を確かめられません。少し時間をおいてください。'},503)}
  return null;
}
/* ---------- 安全確認（Google Cloud Web Risk Lookup。決まったアドレスだけ・行き先は開かない） ---------- */
let LK_INFLIGHT=0;
const LK_DAY=now=>new Date(now+9*3600e3).toISOString().slice(0,10);
const lkTtl=env=>Math.max(5,Math.min(60,parseInt(env.LINKS_CLEAN_TTL_MIN||'30',10)||30))*60e3;
async function lkReadCapped(r,max){
  if(!r.body){const t=await r.text();if(t.length>max)throw new Error('big');return t}
  const rd=r.body.getReader(),ch=[];let n=0;
  for(;;){const {done,value}=await rd.read();if(done)break;n+=value.byteLength;if(n>max){try{await rd.cancel()}catch(e){}throw new Error('big')}ch.push(value)}
  const all=new Uint8Array(n);let o=0;for(const c of ch){all.set(c,o);o+=c.byteLength}
  return new TextDecoder('utf-8',{fatal:true}).decode(all);
}
/* 結果：{v:'clean'|'unsafe'|'error', types, exp, why}。'error' のときはリンクを使わない（閉じる） */
async function lkThreat(env,db,checkUrl,now,opt={}){
  const h=await sha('lk|'+checkUrl);
  if(!opt.fresh){const c=await db.prepare(`SELECT verdict,types,expires_at FROM link_verdicts WHERE h=? AND expires_at>?`).bind(h,now).first();
    if(c&&(c.verdict==='clean'||c.verdict==='unsafe'))return{v:c.verdict,types:c.types?c.types.split(','):[],exp:c.expires_at,h,cached:true}}
  const key=String(env.WEBRISK_API_KEY||'');
  if(!key)return{v:'error',why:'nokey',h};
  if(LK_INFLIGHT>=4)return{v:'error',why:'busy',h};
  const lim=Math.max(1,Math.min(100000,parseInt(env.LINKS_WEBRISK_DAY||'5000',10)||5000)),day=LK_DAY(now);
  await db.prepare(`INSERT OR IGNORE INTO link_quota(day,n) VALUES(?,0)`).bind(day).run();
  const q=await db.prepare(`UPDATE link_quota SET n=n+1 WHERE day=? AND n<? RETURNING n`).bind(day,lim).first();
  if(!q)return{v:'error',why:'quota',h};
  if(LK_INFLIGHT>=4)return{v:'error',why:'busy',h};
  LK_INFLIGHT++;
  const ac=new AbortController(),tm=setTimeout(()=>ac.abort(),Math.max(500,Math.min(5000,+env.LINKS_WEBRISK_MS||3000)));
  try{
    const qs=LK_WR_TYPES.map(t=>'threatTypes='+t).join('&')+'&uri='+encodeURIComponent(checkUrl);
    let r;try{r=await fetch(LK_WR_EP+'?'+qs,{method:'GET',headers:{'x-goog-api-key':key,accept:'application/json'},redirect:'manual',signal:ac.signal})}
    catch(e){return{v:'error',why:ac.signal.aborted?'timeout':'net',h}}
    if(r.status===429||r.status===403)return{v:'error',why:'quota',h};
    if(r.status!==200)return{v:'error',why:'status',h};
    let j;try{j=JSON.parse(await lkReadCapped(r,8192))}catch(e){return{v:'error',why:ac.signal.aborted?'timeout':'malformed',h}}
    if(!j||typeof j!=='object'||Array.isArray(j)||Object.keys(j).some(k=>k!=='threat'))return{v:'error',why:'malformed',h};
    let res;
    if(j.threat===undefined)res={v:'clean',types:[],exp:now+lkTtl(env)};
    else{const t=j.threat;
      if(!t||typeof t!=='object'||!Array.isArray(t.threatTypes)||!t.threatTypes.length||!t.threatTypes.every(x=>LK_WR_TYPES.includes(x)))return{v:'error',why:'malformed',h};
      const ex=t.expireTime==null?NaN:Date.parse(String(t.expireTime));
      if(t.expireTime!=null&&isNaN(ex))return{v:'error',why:'malformed',h};
      res={v:'unsafe',types:[...new Set(t.threatTypes)],exp:Math.min(now+864e5,Math.max(now+10*60e3,isNaN(ex)?0:ex))}}
    await db.prepare(`INSERT OR REPLACE INTO link_verdicts(h,verdict,types,checked_at,expires_at) VALUES(?,?,?,?,?)`).bind(h,res.v,res.types.join(','),now,res.exp).run();
    return{...res,h};
  }finally{clearTimeout(tm);LK_INFLIGHT--}
}
async function lkEvent(db,now,o){
  try{await db.prepare(`INSERT INTO link_events(at,uid,note_id,host,h,kind,detail) VALUES(?,?,?,?,?,?,?)`).bind(now,o.uid||null,o.note_id||null,String(o.host||'').slice(0,253),String(o.h||'').slice(0,16),String(o.kind).slice(0,24),String(o.detail||'').slice(0,120)).run()}catch(e){}
}
/* リンクを付けようとした回数の枠を、1つの文でとる（同時に送られても枠をこえない）。10秒に1回・1時間12回・1日40回（断ったものも数える） */
async function lkSlot(db,uid,now){
  const r=await db.prepare(`INSERT INTO link_attempts(uid,at) SELECT ?1,?2 WHERE (SELECT COUNT(*) FROM link_attempts WHERE uid=?1 AND at>?2-10000)=0
    AND (SELECT COUNT(*) FROM link_attempts WHERE uid=?1 AND at>?2-3600000)<12 AND (SELECT COUNT(*) FROM link_attempts WHERE uid=?1 AND at>?2-86400000)<40 RETURNING at`).bind(uid,now).first();
  return !!r;
}
const LK_THREAT_MSG={nokey:'いまリンクの安全確認が使えないため、リンク付きの投稿はできません。リンクを外して投稿してください。',
  quota:'いまリンクの安全確認が混み合っているため、リンク付きの投稿はできません。リンクを外すか、時間をおいてください。',
  busy:'いまリンクの安全確認が混み合っているため、リンク付きの投稿はできません。リンクを外すか、時間をおいてください。',
  timeout:'リンクの安全確認が時間内に終わりませんでした。リンクを外すか、時間をおいてください。'};
/* 投稿（/api/notes の POST）の中のリンク。social.js から呼ぶ。返す値：{text, link}（link は null か {url,host,check,exp}）か {error,status} */
async function lkForNote(env,db,me,uid,body,text,now){
  const has=body.url!==undefined&&body.url!==null&&body.url!=='';
  const off=!lkOn(env,'LINKS_POST');
  if(off){
    /* 止めているとき：前と同じ（本文の URL は ngCheck が断る）。リンク欄を送ってきたら黙って捨てずに断る */
    if(has)return{error:'いまはリンクを付けられません。',status:400};
    return{text,link:null};
  }
  if(has&&typeof body.url!=='string')return{error:LK_ERR.type,code:'type',status:400};
  const fromT=lkFromText(text);
  if(fromT.error&&!has){await lkSlot(db,uid,now);return{error:fromT.error,code:fromT.code,status:400}}
  if(has&&(fromT.url||fromT.error))return{error:LK_ERR.dup,code:'dup',status:400};
  const raw=has?body.url:fromT.url;
  if(!raw)return{text,link:null};
  const rest=has?text:fromT.text;
  /* 断ったものも数える枠（形の確かめより先） */
  if(!await lkSlot(db,uid,now))return{error:'リンク付きの投稿が続いています。少し時間をおいてください（10秒に1回・1時間12回・1日40回まで）。',status:429};
  /* リンクを付けられるのは、確認済みのメールでログインした人だけ（そのメールを利用停止の記録と照らし合わせるため） */
  if(!lkOn(env,'SANCTIONS_ON')||!emailKeys(env).length)return{error:'いまリンク付きの投稿は準備中です。',status:503};
  if(!me.email||!me.emailVerified)return{error:'メールアドレスを確認したアカウントだけがリンクを投稿できます。',status:403};
  const hs=await emailHashes(env,me.email);if(!hs.length)return{error:'メールアドレスを確認したアカウントだけがリンクを投稿できます。',status:403};
  if(!await emailLink(db,uid,hs,now))return{error:'いまリンク付きの投稿は準備中です。',status:503};
  const v=lkValidate(raw);
  if(v.error){await lkEvent(db,now,{uid,kind:'reject_syntax',detail:v.code});return{error:v.error,code:v.code,status:400}}
  /* リンクを外した本文にも、URL・ドメインのような書き方があれば断る（2つ目のリンク・隠したリンクを通さない） */
  if(rest&&ngCheck(rest))return/リンク/.test(ngCheck(rest))?{error:LK_ERR.bare,code:'bare',status:400}:{error:ngCheck(rest),code:'ng',status:400};
  return{text:rest,link:v};
}
/* 本文・返信先などを確かめたあと、最後に安全確認（ここで初めて外の業者に送る） */
async function lkCheckForNote(env,db,uid,link,now){
  const t=await lkThreat(env,db,link.check,now);
  if(t.v==='clean')return{ok:true,t};
  if(t.v==='unsafe'){await lkEvent(db,now,{uid,host:link.host,h:t.h,kind:'reject_unsafe',detail:t.types.join(',')});
    return{error:'このリンクは安全確認で危険の可能性があると判定されたため、付けられません。',status:400}}
  await lkEvent(db,now,{uid,host:link.host,h:t.h,kind:'check_error',detail:t.why});
  return{error:LK_THREAT_MSG[t.why]||'リンクの安全確認ができませんでした。リンクを外すか、時間をおいてください。',status:503};
}
/* 投稿の一覧の ulink（json_array(url,host,state,expires_at)）を、サイトに渡す形に。危険・止めたものは URL を出さない */
function lkOut(r){
  if(!r||!r.ulink)return null;
  let a;try{a=JSON.parse(r.ulink)}catch(e){return null}
  if(!Array.isArray(a)||typeof a[0]!=='string')return null;
  if(a[2]!=='ok'||lkValidate(a[0]).error)return{state:'blocked'};
  return{url:a[0],host:String(a[1]||''),state:'ok'};
}
/* 通報されたリンクは、前の確認から10分たっていれば確かめ直す（通報だけでは隠さない・停止しない） */
async function lkReported(env,db,id,now){
  try{const l=await db.prepare(`SELECT note_id,uid,url,host,state,verdict_at FROM note_links WHERE note_id=?`).bind(id).first();
    if(!l||l.state!=='ok'||(l.verdict_at||0)>now-10*60e3)return;
    await lkRecheck(env,db,l,now,'report')}catch(e){}
}
async function lkRecheck(env,db,l,now,why){
  const v=lkValidate(l.url);
  if(v.error){await db.prepare(`UPDATE note_links SET state='removed',updated_at=? WHERE note_id=?`).bind(now,l.note_id).run();await lkEvent(db,now,{uid:l.uid,note_id:l.note_id,host:l.host,kind:'invalid',detail:v.code});return{v:'removed'}}
  const t=await lkThreat(env,db,v.check,now,{fresh:why==='report'||why==='admin'});
  if(t.v==='clean')await db.prepare(`UPDATE note_links SET verdict='clean',verdict_at=?,expires_at=?,updated_at=? WHERE note_id=?`).bind(now,t.exp,now,l.note_id).run();
  else if(t.v==='unsafe'){await db.prepare(`UPDATE note_links SET state='unsafe',verdict='unsafe',verdict_at=?,expires_at=?,updated_at=? WHERE note_id=?`).bind(now,t.exp,now,l.note_id).run();
    await lkEvent(db,now,{uid:l.uid,note_id:l.note_id,host:l.host,h:t.h,kind:'recheck_unsafe',detail:(why+':'+t.types.join(',')).slice(0,120)})}
  else await lkEvent(db,now,{uid:l.uid,note_id:l.note_id,host:l.host,h:t.h,kind:'check_error',detail:why+':'+t.why});
  return t;
}
async function lkAdminWho(env,ip){return 'adm:'+(await sha(ip+'|lkadm|'+(env.ADMIN_TOKEN||''))).slice(0,12)}
const ADM_NG=J=>J({error:'管理用の合言葉が違います。'},401);
/* 運営者の理由（必須） */
const admReason=r=>{const s=clean(r,200);return s.length>=4?s:null};
/* ---------- API ---------- */
async function linksApi(req,env,db,path,u,body,now,ip,isAdmin){
  if(!/^\/api\/(links|admin\/links|admin\/sanctions)(\/|$)/.test(path))return null;
  await socialInit(db);await linksInit(db);
  let m;
  /* サイトがリンク欄を出すか・押せるか（値は変数だけから決める） */
  if(path==='/api/links/config'&&req.method==='GET')return J({post:lkOn(env,'LINKS_POST')&&lkOn(env,'SANCTIONS_ON')&&emailKeys(env).length>0&&!!env.WEBRISK_API_KEY,click:lkOn(env,'LINKS_CLICK')});
  /* 押したとき：見られる投稿か・リンクの状態・新しい安全確認を確かめてから、行き先を返す（サーバーは転送しない・行き先を開かない） */
  if((m=path.match(/^\/api\/links\/(\d+)\/open$/))&&req.method==='POST'){
    if(!lkOn(env,'LINKS_CLICK'))return J({error:'いまリンクは開けません。',inert:true},403);
    const me=fbPid(env)?await authOf(req,env):null;
    const meRow=me?await db.prepare(`SELECT uid,banned FROM users WHERE uid=?`).bind(me.uid).first():null;
    const meUid=meRow&&!meRow.banned?meRow.uid:'';
    const who=meUid?'u:'+meUid:'ip:'+(await sha(ip+'|lkc|'+(env.APP_TOKEN||''))).slice(0,20);
    const ok=await db.prepare(`INSERT INTO link_clicks(who,at) SELECT ?1,?2 WHERE (SELECT COUNT(*) FROM link_clicks WHERE who=?1 AND at>?2-3600000)<60 RETURNING at`).bind(who,now).first();
    if(!ok)return J({error:'短い時間にリンクを開きすぎです。少し時間をおいてください。'},429);
    const id=+m[1];
    const vis=await db.prepare(`SELECT n.id FROM notes n ${NOTE_JOIN} WHERE n.id=?2 AND n.hidden=0 AND n.repost_of=0 AND ${NOTE_OK}`).bind(meUid,id).first();
    if(!vis)return J({error:'投稿が見つかりません（削除された可能性があります）。'},404);
    const l=await db.prepare(`SELECT note_id,uid,url,host,state,verdict_at,expires_at FROM note_links WHERE note_id=?`).bind(id).first();
    if(!l||l.state!=='ok')return J({error:'このリンクは開けません（安全確認または運営者の確認により止めています）。',inert:true},410);
    if(lkValidate(l.url).error)return J({error:'このリンクは開けません。',inert:true},410);
    if(!(l.expires_at>now)){const t=await lkRecheck(env,db,l,now,'click');
      if(t.v==='unsafe'||t.v==='removed')return J({error:'このリンクは安全確認で危険の可能性があると判定されたため、開けません。',inert:true},410);
      if(t.v!=='clean')return J({error:'いまリンクの安全確認ができないため、開けません。時間をおいてください。'},503)}
    return J({ok:true,url:l.url,host:l.host});
  }
  /* ---- 運営者：リンク ---- */
  if(path.startsWith('/api/admin/')&&!isAdmin)return ADM_NG(J);
  if(path==='/api/admin/links'&&req.method==='GET'){
    const st=u.searchParams.get('state');
    const r=await db.prepare(`SELECT l.note_id,l.url,l.host,l.state,l.verdict,l.verdict_at,l.expires_at,l.created_at,l.updated_at,us.handle,n.hidden,
      (SELECT COUNT(*) FROM reports rp WHERE rp.kind='note' AND rp.target=l.note_id) AS reports FROM note_links l LEFT JOIN notes n ON n.id=l.note_id LEFT JOIN users us ON us.uid=l.uid
      ${st&&/^(ok|unsafe|quarantined|removed|pending)$/.test(st)?'WHERE l.state=?':'WHERE ?=?'} ORDER BY l.updated_at DESC LIMIT 100`).bind(...(st&&/^(ok|unsafe|quarantined|removed|pending)$/.test(st)?[st]:[1,1])).all();
    const ev=await db.prepare(`SELECT e.at,e.note_id,e.host,e.kind,e.detail,us.handle FROM link_events e LEFT JOIN users us ON us.uid=e.uid ORDER BY e.id DESC LIMIT 100`).all();
    return J({links:r.results,events:ev.results,flags:{post:lkOn(env,'LINKS_POST'),click:lkOn(env,'LINKS_CLICK'),sanctions:lkOn(env,'SANCTIONS_ON'),webrisk:!!env.WEBRISK_API_KEY,emailKey:emailKeys(env).length>0}});
  }
  if((m=path.match(/^\/api\/admin\/links\/(\d+)$/))&&req.method==='POST'){
    const id=+m[1],act=String(body.action||''),reason=admReason(body.reason);
    if(!['quarantine','restore','recheck'].includes(act))return J({error:'操作を選んでください。'},400);
    if(!reason)return J({error:'理由を4文字以上で書いてください。'},400);
    if(body.confirm!==true)return J({error:'確認のうえで実行してください。'},400);
    const l=await db.prepare(`SELECT note_id,uid,url,host,state,verdict_at FROM note_links WHERE note_id=?`).bind(id).first();
    if(!l)return J({error:'リンクが見つかりません。'},404);
    const who=await lkAdminWho(env,ip);
    if(act==='quarantine'){await db.prepare(`UPDATE note_links SET state='quarantined',updated_at=? WHERE note_id=?`).bind(now,id).run();
      if(body.hide===true)await db.prepare(`UPDATE notes SET hidden=1 WHERE id=?`).bind(id).run()}
    let t=null;
    if(act==='restore'||act==='recheck'){
      if(act==='restore'&&l.state==='removed')return J({error:'形の正しくないリンクは戻せません。'},400);
      /* 戻すのは、新しい安全確認で問題が見つからなかったときだけ */
      const v=lkValidate(l.url);if(v.error)return J({error:'形の正しくないリンクです。'},400);
      t=await lkThreat(env,db,v.check,now,{fresh:true});
      if(t.v!=='clean'&&act==='restore')return J({error:t.v==='unsafe'?'安全確認で危険の可能性があると判定されたため、戻せません。':'いま安全確認ができないため、戻せません。',verdict:t.v},409);
      if(t.v==='clean')await db.prepare(`UPDATE note_links SET ${act==='restore'?"state='ok',":''}verdict='clean',verdict_at=?,expires_at=?,updated_at=? WHERE note_id=?`).bind(now,t.exp,now,id).run();
      else if(t.v==='unsafe')await db.prepare(`UPDATE note_links SET state=CASE WHEN state='ok' THEN 'unsafe' ELSE state END,verdict='unsafe',verdict_at=?,expires_at=?,updated_at=? WHERE note_id=?`).bind(now,t.exp,now,id).run()}
    await lkEvent(db,now,{uid:l.uid,note_id:id,host:l.host,kind:'admin_'+act,detail:who+' '+reason});
    try{await tipsLog(db,env,ip,now,'link_'+act,id,reason)}catch(e){}
    const n=await db.prepare(`SELECT state FROM note_links WHERE note_id=?`).bind(id).first();
    return J({ok:true,state:n&&n.state,verdict:t&&t.v});
  }
  /* ---- 運営者：利用停止 ---- */
  if(path==='/api/admin/sanctions'&&req.method==='GET'){
    const r=await db.prepare(`SELECT s.id,s.kind,s.permanent,s.starts_at,s.expires_at,s.reason,s.evidence,s.source,s.actor,s.status,s.appeal,s.parent,s.created_at,s.updated_at,us.handle,
      CASE WHEN s.status='active' AND (s.permanent=1 OR s.expires_at>?1) THEN 1 ELSE 0 END AS live FROM sanctions s LEFT JOIN users us ON us.uid=s.uid ORDER BY s.id DESC LIMIT 200`).bind(now).all();
    /* メールのハッシュ・UID そのものは返さない */
    return J({sanctions:r.results,enabled:lkOn(env,'SANCTIONS_ON'),emailKey:emailKeys(env).length>0});
  }
  if(path==='/api/admin/sanctions'&&req.method==='POST'){
    if(!lkOn(env,'SANCTIONS_ON'))return J({error:'利用停止の記録はまだ使えません（SANCTIONS_ON）。'},503);
    const kind=String(body.kind||''),reason=admReason(body.reason),evidence=clean(body.evidence,80);
    if(!['perpetrator','linked','temporary'].includes(kind))return J({error:'種類を選んでください。'},400);
    if(!reason)return J({error:'理由を4文字以上で書いてください。'},400);
    if(!evidence)return J({error:'根拠の番号（通報・リンクの記録など）を書いてください。'},400);
    if(body.confirm!=='SANCTION')return J({error:'確認の言葉（SANCTION）を入れてください。'},400);
    const t=await db.prepare(`SELECT uid,handle,banned FROM users WHERE handle=? COLLATE NOCASE`).bind(String(body.handle||'').replace(/^@/,'')).first();
    if(!t)return J({error:'そのユーザーIDの人が見つかりません。'},404);
    if(t.uid.startsWith('bot:'))return J({error:'運営のアカウントは対象にできません。'},400);
    const perm=kind==='perpetrator';
    let exp=null;
    if(!perm){const mo=body.months==null?null:+body.months;
      if(mo!=null&&!(Number.isInteger(mo)&&mo>=3&&mo<=6))return J({error:'期間は3〜6か月から選んでください。'},400);
      if(mo){const d=new Date(now);d.setUTCMonth(d.getUTCMonth()+mo);exp=d.getTime()}else exp=now+90*864e5}
    const who=await lkAdminWho(env,ip),src=kind==='perpetrator'?'confirmed_attack':kind==='linked'?'confirmed_linked':'manual';
    const r=await db.prepare(`INSERT INTO sanctions(kind,uid,permanent,starts_at,expires_at,reason,evidence,source,actor,status,created_at,updated_at) VALUES('uid',?,?,?,?,?,?,?,?,'active',?,?) RETURNING id`)
      .bind(t.uid,perm?1:0,now,exp,reason,evidence,src,who,now,now).first();
    const q=[db.prepare(`INSERT INTO sanction_events(sanction_id,at,actor,action,note) VALUES(?,?,?,?,?)`).bind(r.id,now,who,'create',reason),
      db.prepare(`UPDATE users SET banned=2 WHERE uid=? AND banned=0`).bind(t.uid)];
    let email='none';
    if(perm){
      /* 確かめた人：その UID に記録されている確認済みメールのハッシュも、いつまでも使えないように記録する。記録がなければ「未解決」（推測で結びつけない） */
      const es=(await db.prepare(`SELECT ehash,kver FROM user_emails WHERE uid=?`).bind(t.uid).all()).results;
      if(!es.length)email='unresolved';
      else{email='recorded';for(const e of es)q.push(db.prepare(`INSERT INTO sanctions(kind,uid,ehash,kver,permanent,starts_at,expires_at,reason,evidence,source,actor,status,parent,created_at,updated_at) VALUES('email',NULL,?,?,1,?,NULL,?,?,?,?,'active',?,?,?)`)
        .bind(e.ehash,e.kver,now,reason,evidence,src,who,r.id,now,now))}
      q.push(db.prepare(`INSERT INTO sanction_events(sanction_id,at,actor,action,note) VALUES(?,?,?,?,?)`).bind(r.id,now,who,'email_'+email,String(es.length)));
    }
    await db.batch(q);
    try{await tipsLog(db,env,ip,now,'sanction_'+kind,r.id,'@'+t.handle+' '+reason)}catch(e){}
    return J({ok:true,id:r.id,permanent:perm,expires_at:exp,email});
  }
  if((m=path.match(/^\/api\/admin\/sanctions\/(\d+)\/(reverse|appeal)$/))&&req.method==='POST'){
    const id=+m[1],act=m[2],reason=admReason(body.reason);
    if(!reason)return J({error:'理由を4文字以上で書いてください。'},400);
    if(body.confirm!==true)return J({error:'確認のうえで実行してください。'},400);
    const s=await db.prepare(`SELECT id,kind,uid,status FROM sanctions WHERE id=?`).bind(id).first();
    if(!s)return J({error:'記録が見つかりません。'},404);
    const who=await lkAdminWho(env,ip);
    if(act==='appeal'){const st=['open','upheld','granted'].includes(body.decision)?body.decision:'open';
      await db.batch([db.prepare(`UPDATE sanctions SET appeal=?,updated_at=? WHERE id=?`).bind(st,now,id),db.prepare(`INSERT INTO sanction_events(sanction_id,at,actor,action,note) VALUES(?,?,?,?,?)`).bind(id,now,who,'appeal_'+st,reason)]);
      if(st!=='granted')return J({ok:true,appeal:st})}
    if(s.status!=='active')return J({ok:true,status:s.status});
    /* 取り消し：その記録と、そこから作ったメールの記録（鍵の入れかえの写しも）を取り消す。手動の停止（banned=1）は触らない */
    await db.batch([db.prepare(`UPDATE sanctions SET status='reversed',updated_at=?1 WHERE id=?2 OR parent=?2 OR parent IN (SELECT id FROM sanctions WHERE parent=?2)`).bind(now,id),
      db.prepare(`INSERT INTO sanction_events(sanction_id,at,actor,action,note) VALUES(?,?,?,?,?)`).bind(id,now,who,'reverse',reason)]);
    await sanctionSweepStmt(db,now).run();
    try{await tipsLog(db,env,ip,now,'sanction_reverse',id,reason)}catch(e){}
    return J({ok:true,status:'reversed'});
  }
  return null;
}
/* 掃除（ときどき）：古い回数の記録・期限の切れた確認の覚え・記録 */
async function linksCleanup(db,now){
  await linksInit(db);
  await db.batch([db.prepare(`DELETE FROM link_attempts WHERE at<?`).bind(now-2*864e5),db.prepare(`DELETE FROM link_clicks WHERE at<?`).bind(now-2*864e5),
    db.prepare(`DELETE FROM link_verdicts WHERE expires_at<?`).bind(now),db.prepare(`DELETE FROM link_quota WHERE day<?`).bind(LK_DAY(now-7*864e5)),
    db.prepare(`DELETE FROM link_events WHERE at<?`).bind(now-180*864e5)]);
  /* 覚えは多くても5000件 */
  await db.prepare(`DELETE FROM link_verdicts WHERE h IN (SELECT h FROM link_verdicts ORDER BY checked_at DESC LIMIT -1 OFFSET 5000)`).run();
  await sanctionSweepStmt(db,now).run();
}
