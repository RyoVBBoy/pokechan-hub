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
/* ===== 表（足すだけ。何度・同時に動いても大丈夫） ===== */
let LK_READY=false;
async function linksInit(db){
  if(LK_READY)return;
  await db.batch([
    /* 利用者のリンク（bot の notes.link とは別）。note_id は notes の番号（INTEGER PRIMARY KEY＝rowid）。rev＝状態が変わるたびに増える番号 */
    db.prepare(`CREATE TABLE IF NOT EXISTS note_links(note_id INTEGER PRIMARY KEY,uid TEXT NOT NULL,url TEXT NOT NULL,host TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',verdict TEXT,verdict_at INTEGER,expires_at INTEGER,created_at INTEGER,updated_at INTEGER,rev INTEGER NOT NULL DEFAULT 0)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS note_links_uid ON note_links(uid,created_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS note_links_state ON note_links(state,updated_at)`),
    /* 押したときの1回だけ使える許可（短い期限） */
    db.prepare(`CREATE TABLE IF NOT EXISTS link_intents(token TEXT PRIMARY KEY,note_id INTEGER NOT NULL,who TEXT NOT NULL,rev INTEGER NOT NULL,expires_at INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0,created_at INTEGER)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS link_intents_exp ON link_intents(expires_at)`),
    /* 安全確認の結果の覚え（リンクの SHA-256 で。期限つき・件数の上限つき） */
    db.prepare(`CREATE TABLE IF NOT EXISTS link_verdicts(h TEXT PRIMARY KEY,verdict TEXT NOT NULL,types TEXT,checked_at INTEGER,expires_at INTEGER)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS link_verdicts_exp ON link_verdicts(expires_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS link_verdicts_chk ON link_verdicts(checked_at)`),
    /* 回数の枠（断ったものも数える）・押した回数・安全確認の1日の回数・同時に外へ送る数（どの isolate でも共通の札） */
    db.prepare(`CREATE TABLE IF NOT EXISTS link_attempts(uid TEXT NOT NULL,at INTEGER NOT NULL)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS link_attempts_uid ON link_attempts(uid,at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS link_clicks(who TEXT NOT NULL,at INTEGER NOT NULL)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS link_clicks_who ON link_clicks(who,at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS link_quota(day TEXT PRIMARY KEY,n INTEGER NOT NULL DEFAULT 0)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS link_leases(slot INTEGER PRIMARY KEY,holder TEXT,expires_at INTEGER NOT NULL DEFAULT 0)`),
    /* 形のおかしいリクエストの回数（接続元は合言葉と混ぜた番号だけ） */
    db.prepare(`CREATE TABLE IF NOT EXISTS req_bad(who TEXT NOT NULL,at INTEGER NOT NULL)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS req_bad_who ON req_bad(who,at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS req_bad_at ON req_bad(at)`),
    /* 記録（URL そのものは残さない：ホスト・リンクのハッシュの先頭・理由の短い札だけ） */
    db.prepare(`CREATE TABLE IF NOT EXISTS link_events(id INTEGER PRIMARY KEY AUTOINCREMENT,at INTEGER,uid TEXT,note_id INTEGER,host TEXT,h TEXT,kind TEXT,detail TEXT)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS link_events_at ON link_events(at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS link_events_note ON link_events(note_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS link_events_uid ON link_events(uid,at)`),
    /* 運営者の確認の記録（利用停止の前に作る。根拠はこのサイトの記録だけ＝投稿・リンク・リンクの記録・通報。IP アドレスは根拠にしない） */
    db.prepare(`CREATE TABLE IF NOT EXISTS sanction_cases(id INTEGER PRIMARY KEY AUTOINCREMENT,target_uid TEXT NOT NULL,kind TEXT NOT NULL,summary TEXT NOT NULL,refs TEXT NOT NULL,related_root TEXT,status TEXT NOT NULL DEFAULT 'open',actor TEXT,created_at INTEGER,updated_at INTEGER)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS sanction_cases_t ON sanction_cases(target_uid,id)`),
    /* 利用停止の記録。root_key＝その停止の変わらない番号（UID の行とメールの行が同じ root_key を持つ）。メールは鍵つきハッシュだけ */
    db.prepare(`CREATE TABLE IF NOT EXISTS sanctions(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT NOT NULL,uid TEXT,ehash TEXT,kver TEXT,permanent INTEGER NOT NULL DEFAULT 0,starts_at INTEGER,expires_at INTEGER,
      reason TEXT NOT NULL,evidence TEXT,source TEXT,actor TEXT,status TEXT NOT NULL DEFAULT 'active',appeal TEXT,parent INTEGER,created_at INTEGER,updated_at INTEGER,root_key TEXT,case_id INTEGER)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS sanctions_uid ON sanctions(uid,status)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS sanctions_eh ON sanctions(ehash,status)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS sanctions_kv ON sanctions(kind,status,kver)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sanction_events(id INTEGER PRIMARY KEY AUTOINCREMENT,sanction_id INTEGER,at INTEGER,actor TEXT,action TEXT,note TEXT,root_key TEXT)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS sanction_events_s ON sanction_events(sanction_id,id)`),
    /* UID と確認済みメールのハッシュの対応（Firebase の署名を確かめた email_verified のメールだけ） */
    db.prepare(`CREATE TABLE IF NOT EXISTS user_emails(uid TEXT NOT NULL,ehash TEXT NOT NULL,kver TEXT NOT NULL,first_at INTEGER,last_at INTEGER,PRIMARY KEY(uid,ehash))`),
    db.prepare(`CREATE INDEX IF NOT EXISTS user_emails_eh ON user_emails(ehash)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS user_emails_kv ON user_emails(kver)`)
  ]);
  /* この版より前の表（このブランチの前の版）に列を足す。すでにあれば無視 */
  for(const [t,c] of [['note_links','rev INTEGER NOT NULL DEFAULT 0'],['sanctions','root_key TEXT'],['sanctions','case_id INTEGER'],['sanction_events','root_key TEXT']]){
    try{await db.prepare(`ALTER TABLE ${t} ADD COLUMN ${c}`).run()}catch(e){}}
  await db.batch([
    db.prepare(`UPDATE sanctions SET root_key='id:'||COALESCE(parent,id) WHERE root_key IS NULL`),
    /* 同じ停止の中で、同じメールのハッシュ・UID の行は1つだけ（何度送っても同じ） */
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS sanctions_root_eh ON sanctions(root_key,ehash) WHERE kind='email'`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS sanctions_root_uid ON sanctions(root_key) WHERE kind='uid'`),
    db.prepare(`CREATE INDEX IF NOT EXISTS sanctions_root ON sanctions(root_key,status)`)
  ]);
  LK_READY=true;
}
/* ---------- 確認済みメールのハッシュ（鍵は版ごとに残す） ---------- */
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
/* 鍵の束（keyring）：EMAIL_HMAC_KEYRING＝{"版":"鍵（32文字以上）",…}（JSON・8つまで）、EMAIL_HMAC_KEY_CURRENT＝新しく記録に使う版。
   前の書き方（EMAIL_HMAC_KEY/_VER・EMAIL_HMAC_KEY_PREV/_PREV_VER）も束に入れる。
   **鍵は時間がたっただけでは外さない**：有効なメールの停止・記録したハッシュが使っている版は、keyCoverage が「足りない」と知らせて閉じる。
   返す値：{cur:{v,k}|null, keys:[{v,k}]（今の版を先に）, err} */
function emailKeyring(env){
  const m=new Map(),okV=v=>/^[A-Za-z0-9_-]{1,16}$/.test(v),okK=k=>typeof k==='string'&&k.length>=32&&k.length<=512;
  if(env.EMAIL_HMAC_KEYRING){let o;try{o=JSON.parse(String(env.EMAIL_HMAC_KEYRING))}catch(e){return{cur:null,keys:[],err:'keyring-parse'}}
    if(!o||typeof o!=='object'||Array.isArray(o))return{cur:null,keys:[],err:'keyring-parse'};
    for(const [v,k] of Object.entries(o)){if(!okV(v)||!okK(k))return{cur:null,keys:[],err:'keyring-entry'};m.set(v,k)}}
  const k1=String(env.EMAIL_HMAC_KEY||''),v1=String(env.EMAIL_HMAC_KEY_VER||'v1'),k0=String(env.EMAIL_HMAC_KEY_PREV||''),v0=String(env.EMAIL_HMAC_KEY_PREV_VER||'v0');
  for(const [v,k] of [[v1,k1],[v0,k0]])if(k){if(!okV(v)||!okK(k))continue;if(m.has(v)&&m.get(v)!==k)return{cur:null,keys:[],err:'keyring-conflict'};m.set(v,k)}
  if(m.size>8)return{cur:null,keys:[],err:'keyring-size'};
  const cv=String(env.EMAIL_HMAC_KEY_CURRENT||(k1&&okK(k1)?v1:''))||'';
  if(cv&&!m.has(cv))return{cur:null,keys:[],err:'current-missing'};
  const keys=[...m].map(([v,k])=>({v,k}));keys.sort((a,b)=>(b.v===cv)-(a.v===cv));
  return{cur:cv?{v:cv,k:m.get(cv)}:null,keys,err:null};
}
async function hmacHex(key,msg){const ck=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC',ck,new TextEncoder().encode(msg)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
/* 鍵の版ごとのハッシュ（今の版を先に）。鍵がなければ [] */
async function emailHashes(env,email){const n=emailNorm(email),kr=emailKeyring(env);if(!n||kr.err)return [];const out=[];
  for(const x of kr.keys)out.push({h:await hmacHex(x.k,'gk-email|'+n),v:x.v,cur:!!(kr.cur&&x.v===kr.cur.v)});return out}
/* 鍵の版が足りているか：有効なメールの停止（tombstone）が使っている版が、すべて鍵の束にあるか（毎回確かめる＝作ったばかりの停止もすぐ効く）。
   ident:true のときは、記録したハッシュ（あとで停止に使う）が使っている版も確かめる（運営者の画面と停止を作るとき） */
async function keyCoverage(db,env,now,o={}){
  const kr=emailKeyring(env),have=new Set(kr.err?[]:kr.keys.map(x=>x.v));
  const tv=(await db.prepare(`SELECT DISTINCT kver FROM sanctions WHERE kind='email' AND status='active' AND (permanent=1 OR expires_at>?)`).bind(now).all()).results.map(x=>x.kver);
  const iv=o.ident?(await db.prepare(`SELECT DISTINCT kver FROM user_emails`).all()).results.map(x=>x.kver):[];
  return{err:kr.err,current:kr.cur?kr.cur.v:null,versions:[...have],tombstones:tv.length>0,missingTomb:tv.filter(v=>!have.has(v)),missingIdent:iv.filter(v=>!have.has(v))};
}
/* ---------- 利用停止の判定 ---------- */
const SANC_ACTIVE=`status='active' AND (permanent=1 OR expires_at>?)`;
/* 期限が来た「記録による停止（banned=2）」だけを元に戻す。手動の停止（1）は触らない */
const sanctionSweepStmt=(db,now,uid)=>db.prepare(`UPDATE users SET banned=0 WHERE banned=2${uid?' AND uid=?3':''}
  AND NOT EXISTS(SELECT 1 FROM sanctions s WHERE s.kind='uid' AND s.uid=users.uid AND s.status='active' AND (s.permanent=1 OR s.expires_at>?1))
  AND NOT EXISTS(SELECT 1 FROM sanctions s JOIN user_emails ue ON ue.ehash=s.ehash WHERE s.kind='email' AND ue.uid=users.uid AND s.status='active' AND (s.permanent=1 OR s.expires_at>?2))`).bind(...(uid?[now,now,uid]:[now,now]));
/* 1時間ごと（cron '0 * * * *'）と掃除：期限が来た停止の表示を戻す。表示が戻るまでの遅れは最大1時間（本人の書きこみでは、すぐ戻る） */
async function sanctionSweep(db,now){await linksInit(db);await sanctionSweepStmt(db,now).run()}
/* その UID・確認済みメールに有効な停止があるか。{deny:{id,permanent,expires_at}} か {hs} か 例外（調べられない＝閉じる） */
async function sanctionState(db,env,uid,email,emailVerified,now){
  /* 問い合わせは2つだけ：①有効なメールの停止が使っている鍵の版 ②UID・この UID の記録したメール・いまのトークンのメールのどれかに有効な停止があるか */
  const cov=await keyCoverage(db,env,now);
  /* メールの停止があるのに、その版の鍵が束にない（外した・間違えた）＝確かめられないので閉じる */
  if(cov.tombstones&&(cov.err||cov.missingTomb.length))throw new Error('sanction-key-missing');
  const hs=email&&emailVerified&&!cov.err?await emailHashes(env,email):[];
  const th=cov.tombstones?hs.map(x=>x.h):[];
  const r=await db.prepare(`SELECT id,kind,permanent,expires_at,root_key,ehash FROM sanctions WHERE status='active' AND (permanent=1 OR expires_at>?1)
    AND ((kind='uid' AND uid=?2) OR (kind='email' AND ehash IN (SELECT ehash FROM user_emails WHERE uid=?2))${th.length?` OR (kind='email' AND ehash IN (${th.map((_,i)=>'?'+(i+3)).join(',')}))`:''})
    ORDER BY permanent DESC,expires_at DESC LIMIT 1`).bind(now,uid,...th).first();
  if(!r)return{hs};
  /* 前の版の鍵で見つかったら、今の版のハッシュでも同じ停止を記録する（同じ root_key・何度送っても1行。もとの停止が取り消し済みなら書かない＝取り消しを生き返らせない） */
  const cur=hs.find(x=>x.cur);
  if(r.kind==='email'&&cur&&cur.h!==r.ehash&&th.includes(r.ehash))await db.prepare(`INSERT OR IGNORE INTO sanctions(kind,uid,ehash,kver,permanent,starts_at,expires_at,reason,evidence,source,actor,status,parent,created_at,updated_at,root_key,case_id)
    SELECT 'email',NULL,?1,?2,s.permanent,s.starts_at,s.expires_at,s.reason,s.evidence,'rekey',s.actor,'active',s.id,?3,?3,s.root_key,s.case_id FROM sanctions s
    WHERE s.id=?4 AND s.status='active' AND EXISTS(SELECT 1 FROM sanctions r WHERE r.root_key=s.root_key AND r.kind='uid' AND r.status='active')`).bind(cur.h,cur.v,now,r.id).run();
  return{deny:r,hs};
}
/* 確認済みメールと UID を結びつける（今の版の鍵で。1日に1回だけ書く） */
async function emailLink(db,uid,hs,now){
  const cur=hs.find(x=>x.cur);if(!cur)return false;
  const r=await db.prepare(`SELECT last_at FROM user_emails WHERE uid=? AND ehash=?`).bind(uid,cur.h).first();
  if(r&&r.last_at>now-864e5)return true;
  await db.prepare(`INSERT INTO user_emails(uid,ehash,kver,first_at,last_at) VALUES(?,?,?,?,?) ON CONFLICT(uid,ehash) DO UPDATE SET last_at=excluded.last_at`).bind(uid,cur.h,cur.v,now,now).run();
  return true;
}
const SANC_MSG='このアカウントは利用を停止しています。';
const SANC_ERR='いまアカウントの状態を確かめられません。少し時間をおいてください。';
/* ログインした人のリクエストごとに、利用停止を確かめる（api() の最初。どの機能より先）。
   ・停止中：書きこみ（GET 以外）と /api/me* は 403。ほかの読むだけ（GET）はログインしていない人と同じ扱い（ふつうに読むのは止めない）
   ・記録を調べられない（表・鍵の版が足りない）：書きこみと /api/me は 503、読むだけはログインしていない人と同じ
   変数（SANCTIONS_ON など）に関係なく、有効な停止はいつも守る。返す値：Response（止める）か null（続ける） */
async function sanctionGate(req,env,db,path,now){
  if(!/^Bearer\s+\S/i.test(req.headers.get('authorization')||'')||!fbPid(env))return null;
  const me=await authOf(req,env);if(!me)return null;
  const meP=path==='/api/me'||path.startsWith('/api/me/');
  let st;
  try{await linksInit(db);st=await sanctionState(db,env,me.uid,me.email,me.emailVerified,now)}
  catch(e){AUTH_DENY.set(req,{err:true});
    if(req.method==='GET'&&!meP)return null;
    return J({error:SANC_ERR},503)}
  if(st.deny){
    AUTH_DENY.set(req,{id:st.deny.id});
    const until=st.deny.permanent?null:st.deny.expires_at;
    const msg=SANC_MSG+(until?`（${new Date(until+9*3600e3).toISOString().slice(0,10)} まで）`:'');
    if(req.method!=='GET'||meP)return J({error:msg,sanction:{permanent:!!st.deny.permanent,until}},403);
    return null;
  }
  try{
    if(req.method!=='GET'||path==='/api/me'){await sanctionSweepStmt(db,now,me.uid).run();
      if(lkOn(env,'SANCTIONS_ON')&&st.hs&&st.hs.length)await emailLink(db,me.uid,st.hs,now)}
  }catch(e){if(req.method!=='GET')return J({error:SANC_ERR},503)}
  return null;
}
/* ---------- 形のおかしいリクエストの回数（接続元ごとに10分30回・全体で10分5000回。超えたら429。書くのは枠の中だけ） ---------- */
async function badReq(db,env,ip,now){
  try{await linksInit(db);
    const who=(await sha(ip+'|bad|'+(env.APP_TOKEN||''))).slice(0,20);
    const r=await db.prepare(`INSERT INTO req_bad(who,at) SELECT ?1,?2 WHERE (SELECT COUNT(*) FROM req_bad WHERE who=?1 AND at>?2-600000)<30 AND (SELECT COUNT(*) FROM req_bad WHERE at>?2-600000)<5000 RETURNING at`).bind(who,now).first();
    return !r}catch(e){return true}
}
/* ---------- 安全確認（Google Cloud Web Risk Lookup。決まったアドレスだけ・行き先は開かない） ---------- */
const LK_DAY=now=>new Date(now+9*3600e3).toISOString().slice(0,10);
const lkTtl=env=>Math.max(5,Math.min(60,parseInt(env.LINKS_CLEAN_TTL_MIN||'30',10)||30))*60e3;
const lkConc=env=>Math.max(1,Math.min(16,parseInt(env.LINKS_WEBRISK_CONC||'4',10)||4));
const lkMs=env=>Math.max(500,Math.min(5000,+env.LINKS_WEBRISK_MS||3000));
const LK_CACHE_MAX=5000;
async function lkReadCapped(r,max){
  if(!r.body){const t=await r.text();if(t.length>max)throw new Error('big');return t}
  const rd=r.body.getReader(),ch=[];let n=0;
  for(;;){const {done,value}=await rd.read();if(done)break;n+=value.byteLength;if(n>max){try{await rd.cancel()}catch(e){}throw new Error('big')}ch.push(value)}
  const all=new Uint8Array(n);let o=0;for(const c of ch){all.set(c,o);o+=c.byteLength}
  return new TextDecoder('utf-8',{fatal:true}).decode(all);
}
const rndHex=n=>[...crypto.getRandomValues(new Uint8Array(n))].map(x=>x.toString(16).padStart(2,'0')).join('');
/* 同時に外へ送る数の札（D1 の link_leases。どの isolate でも共通）。札は期限つき（落ちた isolate の札も期限で戻る）。
   とれなければ null（混み合っている＝閉じる） */
async function lkLease(db,env,now){
  const n=lkConc(env);
  await db.batch([...Array(n).keys()].map(i=>db.prepare(`INSERT OR IGNORE INTO link_leases(slot,holder,expires_at) VALUES(?,NULL,0)`).bind(i)));
  const holder=rndHex(12);
  const r=await db.prepare(`UPDATE link_leases SET holder=?1,expires_at=?2 WHERE slot=(SELECT slot FROM link_leases WHERE slot<?4 AND expires_at<=?3 ORDER BY slot LIMIT 1) RETURNING slot`).bind(holder,now+lkMs(env)+2000,now,n).first();
  return r?{slot:r.slot,holder}:null;
}
const lkRelease=(db,l)=>db.prepare(`UPDATE link_leases SET holder=NULL,expires_at=0 WHERE slot=? AND holder=?`).bind(l.slot,l.holder).run().catch(()=>{});
/* 結果：{v:'clean'|'unsafe'|'error', types, exp, why}。'error' のときはリンクを使わない（閉じる） */
async function lkThreat(env,db,checkUrl,now,opt={}){
  const h=await sha('lk|'+checkUrl);
  const cached=async()=>{const c=await db.prepare(`SELECT verdict,types,expires_at FROM link_verdicts WHERE h=? AND expires_at>?`).bind(h,now).first();
    return c&&(c.verdict==='clean'||c.verdict==='unsafe')?{v:c.verdict,types:c.types?c.types.split(','):[],exp:c.expires_at,h,cached:true}:null};
  if(!opt.fresh){const c=await cached();if(c)return c}
  const key=String(env.WEBRISK_API_KEY||'');
  if(!key)return{v:'error',why:'nokey',h};
  /* 先に同時の札をとり、とれたときだけ1日の回数を使う（混み合って断るときに回数を減らさない） */
  let lease;try{lease=await lkLease(db,env,now)}catch(e){return{v:'error',why:'lease',h}}
  if(!lease)return{v:'error',why:'busy',h};
  try{
    const lim=Math.max(1,Math.min(100000,parseInt(env.LINKS_WEBRISK_DAY||'5000',10)||5000)),day=LK_DAY(now);
    await db.prepare(`INSERT OR IGNORE INTO link_quota(day,n) VALUES(?,0)`).bind(day).run();
    const q=await db.prepare(`UPDATE link_quota SET n=n+1 WHERE day=? AND n<? RETURNING n`).bind(day,lim).first();
    if(!q)return{v:'error',why:'quota',h};
    const ac=new AbortController(),tm=setTimeout(()=>ac.abort(),lkMs(env));
    let res;
    try{
      const qs=LK_WR_TYPES.map(t=>'threatTypes='+t).join('&')+'&uri='+encodeURIComponent(checkUrl);
      let r;try{r=await fetch(LK_WR_EP+'?'+qs,{method:'GET',headers:{'x-goog-api-key':key,accept:'application/json'},redirect:'manual',signal:ac.signal})}
      catch(e){return{v:'error',why:ac.signal.aborted?'timeout':'net',h}}
      if(r.status===429||r.status===403)return{v:'error',why:'quota',h};
      if(r.status!==200)return{v:'error',why:'status',h};
      let j;try{j=JSON.parse(await lkReadCapped(r,8192))}catch(e){return{v:'error',why:ac.signal.aborted?'timeout':'malformed',h}}
      if(!j||typeof j!=='object'||Array.isArray(j)||Object.keys(j).some(k=>k!=='threat'))return{v:'error',why:'malformed',h};
      if(j.threat===undefined)res={v:'clean',types:[],exp:now+lkTtl(env)};
      else{const t=j.threat;
        if(!t||typeof t!=='object'||Array.isArray(t)||!Array.isArray(t.threatTypes)||!t.threatTypes.length||!t.threatTypes.every(x=>LK_WR_TYPES.includes(x)))return{v:'error',why:'malformed',h};
        const ex=t.expireTime==null?NaN:Date.parse(String(t.expireTime));
        if(t.expireTime!=null&&isNaN(ex))return{v:'error',why:'malformed',h};
        res={v:'unsafe',types:[...new Set(t.threatTypes)],exp:Math.min(now+864e5,Math.max(now+10*60e3,isNaN(ex)?0:ex))}}
    }finally{clearTimeout(tm)}
    /* 覚える：古い答えで新しい答えを上書きしない・期限内の「危険」を「問題なし」で上書きしない。件数は上限まで */
    await db.prepare(`INSERT INTO link_verdicts(h,verdict,types,checked_at,expires_at) VALUES(?1,?2,?3,?4,?5)
      ON CONFLICT(h) DO UPDATE SET verdict=excluded.verdict,types=excluded.types,checked_at=excluded.checked_at,expires_at=excluded.expires_at
      WHERE excluded.checked_at>=link_verdicts.checked_at AND NOT(link_verdicts.verdict='unsafe' AND excluded.verdict='clean' AND link_verdicts.expires_at>excluded.checked_at)`).bind(h,res.v,res.types.join(','),now,res.exp).run();
    await db.prepare(`DELETE FROM link_verdicts WHERE h IN (SELECT h FROM link_verdicts ORDER BY checked_at DESC,h LIMIT -1 OFFSET ${LK_CACHE_MAX})`).run();
    /* 同時に別の答え（危険）が入っていたら、そちらを使う */
    if(res.v==='clean'){const c=await cached();if(c&&c.v==='unsafe')return c}
    return{...res,h};
  }finally{await lkRelease(db,lease)}
}
async function lkEvent(db,now,o){
  try{await db.prepare(`INSERT INTO link_events(at,uid,note_id,host,h,kind,detail) VALUES(?,?,?,?,?,?,?)`).bind(now,o.uid||null,o.note_id||null,String(o.host||'').slice(0,253),String(o.h||'').slice(0,16),String(o.kind).slice(0,24),String(o.detail||'').slice(0,120)).run()}catch(e){}
}
/* リンクを付けようとした回数の枠を、1つの文でとる（同時に送られても枠をこえない）。10秒に1回・1時間12回・1日40回（形のおかしいもの・断ったものも数える） */
async function lkSlot(db,uid,now){
  const r=await db.prepare(`INSERT INTO link_attempts(uid,at) SELECT ?1,?2 WHERE (SELECT COUNT(*) FROM link_attempts WHERE uid=?1 AND at>?2-10000)=0
    AND (SELECT COUNT(*) FROM link_attempts WHERE uid=?1 AND at>?2-3600000)<12 AND (SELECT COUNT(*) FROM link_attempts WHERE uid=?1 AND at>?2-86400000)<40 RETURNING at`).bind(uid,now).first();
  return !!r;
}
const LK_SLOT_MSG='リンク付きの投稿が続いています。少し時間をおいてください（10秒に1回・1時間12回・1日40回まで。形のおかしいものも数えます）。';
const LK_THREAT_MSG={nokey:'いまリンクの安全確認が使えないため、リンク付きの投稿はできません。リンクを外して投稿してください。',
  quota:'いまリンクの安全確認が混み合っているため、リンク付きの投稿はできません。リンクを外すか、時間をおいてください。',
  busy:'いまリンクの安全確認が混み合っているため、リンク付きの投稿はできません。リンクを外すか、時間をおいてください。',
  timeout:'リンクの安全確認が時間内に終わりませんでした。リンクを外すか、時間をおいてください。'};
/* リンクを付けようとしているか（リンク欄に何か入っている・本文に http(s):// のかたまりがある） */
const lkIntent=(body,text)=>(body.url!==undefined&&body.url!==null&&body.url!=='')||/https?:\/\//i.test(String(text||''));
/* 投稿（/api/notes の POST）の中のリンク。social.js から呼ぶ。返す値：{text, link}（link は null か {url,host,check}）か {error,status} */
async function lkForNote(env,db,me,uid,body,text,now){
  const has=body.url!==undefined&&body.url!==null&&body.url!=='';
  if(!lkOn(env,'LINKS_POST')){
    /* 止めているとき：前と同じ（本文の URL は ngCheck が断る）。リンク欄を送ってきたら黙って捨てずに断る */
    if(has)return{error:'いまはリンクを付けられません。',status:400};
    return{text,link:null};
  }
  if(!lkIntent(body,text))return{text,link:null};
  /* 枠はいちばん先（形の確かめ・メールの確かめ・安全確認より前）。形がおかしいものも数え、超えたら429 */
  if(!await lkSlot(db,uid,now))return{error:LK_SLOT_MSG,code:'slot',status:429};
  if(has&&typeof body.url!=='string')return{error:LK_ERR.type,code:'type',status:400};
  const fromT=lkFromText(text);
  if(has&&(fromT.url||fromT.error))return{error:LK_ERR.dup,code:'dup',status:400};
  if(fromT.error)return{error:fromT.error,code:fromT.code,status:400};
  const raw=has?body.url:fromT.url;
  if(!raw)return{text,link:null};
  const rest=has?text:fromT.text;
  /* リンクを付けられるのは、確認済みのメールでログインした人だけ（そのメールを利用停止の記録と照らし合わせるため） */
  const kr=emailKeyring(env);
  if(!lkOn(env,'SANCTIONS_ON')||kr.err||!kr.cur)return{error:'いまリンク付きの投稿は準備中です。',status:503};
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
/* 投稿の一覧の ulink（json_array(url,host,state)）を、サイトに渡す形に。一覧には全部のアドレスを出さない（ホストと状態だけ）。
   押せるのは LINKS_CLICK のときだけ（click：止めているときは 'off'）。危険・止めたもの・形の正しくないものは 'blocked'（ホストも出さない） */
function lkOut(r,click){
  if(!r||!r.ulink)return null;
  let a;try{a=JSON.parse(r.ulink)}catch(e){return null}
  if(!Array.isArray(a)||typeof a[0]!=='string')return null;
  const v=a[2]==='ok'?lkValidate(a[0]):null;
  if(!v||v.error)return{state:'blocked'};
  return{host:v.host,state:click?'ok':'off'};
}
/* 通報されたリンクは、前の確認から10分たっていれば確かめ直す（通報だけでは隠さない・停止しない） */
async function lkReported(env,db,id,now){
  try{const l=await db.prepare(`SELECT note_id,uid,url,host,state,verdict_at,rev FROM note_links WHERE note_id=?`).bind(id).first();
    if(!l||l.state!=='ok'||(l.verdict_at||0)>now-10*60e3)return;
    await lkRecheck(env,db,l,now,'report')}catch(e){}
}
/* 確かめ直す。書くのは、確かめる前に読んだ rev のままで状態が ok のときだけ（あとから運営者が止めた・消した・戻したものを上書きしない） */
async function lkRecheck(env,db,l,now,why){
  const v=lkValidate(l.url);
  if(v.error){await db.prepare(`UPDATE note_links SET state='removed',rev=rev+1,updated_at=? WHERE note_id=? AND rev=?`).bind(now,l.note_id,l.rev).run();await lkEvent(db,now,{uid:l.uid,note_id:l.note_id,host:l.host,kind:'invalid',detail:v.code});return{v:'removed'}}
  const t=await lkThreat(env,db,v.check,now,{fresh:why==='report'||why==='admin'});
  let ch=0;
  if(t.v==='clean')ch=(await db.prepare(`UPDATE note_links SET verdict='clean',verdict_at=?,expires_at=?,updated_at=? WHERE note_id=? AND rev=? AND state='ok'`).bind(now,t.exp,now,l.note_id,l.rev).run()).meta.changes;
  else if(t.v==='unsafe'){ch=(await db.prepare(`UPDATE note_links SET state='unsafe',verdict='unsafe',verdict_at=?,expires_at=?,updated_at=?,rev=rev+1 WHERE note_id=? AND rev=? AND state='ok'`).bind(now,t.exp,now,l.note_id,l.rev).run()).meta.changes;
    await lkEvent(db,now,{uid:l.uid,note_id:l.note_id,host:l.host,h:t.h,kind:'recheck_unsafe',detail:(why+':'+t.types.join(',')).slice(0,120)})}
  else await lkEvent(db,now,{uid:l.uid,note_id:l.note_id,host:l.host,h:t.h,kind:'check_error',detail:why+':'+t.why});
  return{...t,stale:!ch};
}
async function lkAdminWho(env,ip){return 'adm:'+(await sha(ip+'|lkadm|'+(env.ADMIN_TOKEN||''))).slice(0,12)}
const ADM_NG=J=>J({error:'管理用の合言葉が違います。'},401);
/* 運営者の理由（必須） */
const admReason=(r,n=4)=>{const s=clean(r,400);return s.length>=n?s:null};
/* 日本時間の暦の月を足す（月末は、その月の最後の日にそろえる：1/31＋1か月＝2/28 か 2/29） */
function jstAddMonths(ms,mo){
  const J=9*3600e3,d=new Date(ms+J),y=d.getUTCFullYear(),m=d.getUTCMonth()+mo;
  const ty=y+Math.floor(m/12),tm=((m%12)+12)%12,last=new Date(Date.UTC(ty,tm+1,0)).getUTCDate();
  return Date.UTC(ty,tm,Math.min(d.getUTCDate(),last),d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds(),d.getUTCMilliseconds())-J;
}
/* 根拠（このサイトの記録）。その人のものか確かめる。IP アドレス・端末の情報は根拠の種類に無い */
async function caseRefsOk(db,uid,refs){
  if(!Array.isArray(refs)||refs.length<1||refs.length>10)return null;
  const out=[];
  for(const r of refs){
    if(!r||typeof r!=='object'||!['note','link','link_event','report'].includes(r.t)||!Number.isInteger(r.id)||r.id<1)return null;
    const q={note:`SELECT 1 AS x FROM notes WHERE id=? AND uid=?`,link:`SELECT 1 AS x FROM note_links WHERE note_id=? AND uid=?`,link_event:`SELECT 1 AS x FROM link_events WHERE id=? AND uid=?`,
      report:`SELECT 1 AS x FROM reports rp JOIN notes n ON n.id=rp.target WHERE rp.id=? AND rp.kind='note' AND n.uid=?`}[r.t];
    if(!await db.prepare(q).bind(r.id,uid).first())return null;
    out.push({t:r.t,id:r.id});
  }
  return out;
}
/* ---------- API ---------- */
async function linksApi(req,env,db,path,u,body,now,ip,isAdmin){
  if(!/^\/api\/(links|admin\/links|admin\/sanctions|admin\/cases)(\/|$)/.test(path))return null;
  await socialInit(db);await linksInit(db);
  let m;
  /* サイトがリンク欄を出すか・押せるか（値は変数だけから決める） */
  if(path==='/api/links/config'&&req.method==='GET'){const kr=emailKeyring(env);
    return J({post:lkOn(env,'LINKS_POST')&&lkOn(env,'SANCTIONS_ON')&&!kr.err&&!!kr.cur&&!!env.WEBRISK_API_KEY,click:lkOn(env,'LINKS_CLICK')})}
  /* 押したとき（2段階）。①open：見られる投稿か・状態・新しい安全確認を確かめ、確認の画面に出すアドレスと、1回だけ・60秒だけ使える許可を返す
     ②go：確認の画面で「開く」を押したとき、許可を使い切り、もう一度すべて確かめてからアドレスを返す。サーバーは転送しない・行き先を開かない */
  if((m=path.match(/^\/api\/links\/(\d+)\/(open|go)$/))&&req.method==='POST'){
    if(!lkOn(env,'LINKS_CLICK'))return J({error:'いまリンクは開けません。',inert:true},403);
    const id=+m[1],go=m[2]==='go';
    const me=fbPid(env)?await authOf(req,env):null;
    const meRow=me?await db.prepare(`SELECT uid,banned FROM users WHERE uid=?`).bind(me.uid).first():null;
    const meUid=meRow&&!meRow.banned?meRow.uid:'';
    const who=meUid?'u:'+meUid:'ip:'+(await sha(ip+'|lkc|'+(env.APP_TOKEN||''))).slice(0,20);
    const ok=await db.prepare(`INSERT INTO link_clicks(who,at) SELECT ?1,?2 WHERE (SELECT COUNT(*) FROM link_clicks WHERE who=?1 AND at>?2-3600000)<120 RETURNING at`).bind(who,now).first();
    if(!ok)return J({error:'短い時間にリンクを開きすぎです。少し時間をおいてください。'},429);
    const visible=()=>db.prepare(`SELECT n.id FROM notes n ${NOTE_JOIN} WHERE n.id=?2 AND n.hidden=0 AND n.repost_of=0 AND ${NOTE_OK}`).bind(meUid,id).first();
    const link=()=>db.prepare(`SELECT note_id,uid,url,host,state,verdict_at,expires_at,rev FROM note_links WHERE note_id=?`).bind(id).first();
    const INERT=J({error:'このリンクは開けません（安全確認または運営者の確認により止めています）。',inert:true},410);
    if(go){
      const tok=typeof body.intent==='string'&&/^[0-9a-f]{32}$/.test(body.intent)?body.intent:'';
      const it=tok&&await db.prepare(`UPDATE link_intents SET used=1 WHERE token=? AND note_id=? AND who=? AND used=0 AND expires_at>? RETURNING rev`).bind(tok,id,who,now).first();
      if(!it)return J({error:'確認の画面の期限が切れました。もう一度リンクを押してください。',expired:true},410);
      if(!await visible())return J({error:'投稿が見つかりません（削除された可能性があります）。'},404);
      const l=await link();
      if(!l||l.state!=='ok'||l.rev!==it.rev||lkValidate(l.url).error)return INERT;
      if(!(l.expires_at>now))return J({error:'安全確認の期限が切れました。もう一度リンクを押してください。',expired:true},410);
      return J({ok:true,url:l.url,host:l.host});
    }
    if(!await visible())return J({error:'投稿が見つかりません（削除された可能性があります）。'},404);
    let l=await link();
    if(!l||l.state!=='ok'||lkValidate(l.url).error)return INERT;
    if(!(l.expires_at>now)){const t=await lkRecheck(env,db,l,now,'click');
      if(t.v==='unsafe'||t.v==='removed')return J({error:'このリンクは安全確認で危険の可能性があると判定されたため、開けません。',inert:true},410);
      if(t.v!=='clean')return J({error:'いまリンクの安全確認ができないため、開けません。時間をおいてください。'},503)}
    /* 確かめているあいだに、止められた・消された・非公開になったかもしれないので、もう一度読む */
    if(!await visible())return J({error:'投稿が見つかりません（削除された可能性があります）。'},404);
    const l2=await link();
    if(!l2||l2.state!=='ok'||l2.rev!==l.rev||!(l2.expires_at>now))return INERT;
    const token=rndHex(16);
    await db.prepare(`INSERT INTO link_intents(token,note_id,who,rev,expires_at,created_at) VALUES(?,?,?,?,?,?)`).bind(token,id,who,l2.rev,now+60e3,now).run();
    return J({ok:true,url:l2.url,host:l2.host,intent:token,ttl:60});
  }
  /* ---- 運営者 ---- */
  if(path.startsWith('/api/admin/')&&!isAdmin)return ADM_NG(J);
  if(path==='/api/admin/links'&&req.method==='GET'){
    const st=u.searchParams.get('state'),sok=st&&/^(ok|unsafe|quarantined|removed|pending)$/.test(st);
    const r=await db.prepare(`SELECT l.note_id,l.url,l.host,l.state,l.verdict,l.verdict_at,l.expires_at,l.created_at,l.updated_at,l.rev,us.handle,n.hidden,
      (SELECT COUNT(*) FROM reports rp WHERE rp.kind='note' AND rp.target=l.note_id) AS reports FROM note_links l LEFT JOIN notes n ON n.id=l.note_id LEFT JOIN users us ON us.uid=l.uid
      ${sok?'WHERE l.state=?':'WHERE ?=?'} ORDER BY l.updated_at DESC LIMIT 100`).bind(...(sok?[st]:[1,1])).all();
    const ev=await db.prepare(`SELECT e.id,e.at,e.note_id,e.host,e.kind,e.detail,us.handle FROM link_events e LEFT JOIN users us ON us.uid=e.uid ORDER BY e.id DESC LIMIT 100`).all();
    const kr=emailKeyring(env);
    return J({links:r.results,events:ev.results,flags:{post:lkOn(env,'LINKS_POST'),click:lkOn(env,'LINKS_CLICK'),sanctions:lkOn(env,'SANCTIONS_ON'),webrisk:!!env.WEBRISK_API_KEY,emailKey:!kr.err&&!!kr.cur}});
  }
  if((m=path.match(/^\/api\/admin\/links\/(\d+)$/))&&req.method==='POST'){
    const id=+m[1],act=String(body.action||''),reason=admReason(body.reason);
    if(!['quarantine','restore','recheck'].includes(act))return J({error:'操作を選んでください。'},400);
    if(!reason)return J({error:'理由を4文字以上で書いてください。'},400);
    if(body.confirm!==true)return J({error:'確認のうえで実行してください。'},400);
    const l=await db.prepare(`SELECT note_id,uid,url,host,state,verdict_at,rev FROM note_links WHERE note_id=?`).bind(id).first();
    if(!l)return J({error:'リンクが見つかりません。'},404);
    const who=await lkAdminWho(env,ip);
    let t=null;
    /* 止める：運営者の判断はいつも勝つ（rev を増やすので、確かめている途中の操作はあとから上書きできない） */
    if(act==='quarantine'){await db.batch([db.prepare(`UPDATE note_links SET state='quarantined',rev=rev+1,updated_at=? WHERE note_id=?`).bind(now,id),
        ...(body.hide===true?[db.prepare(`UPDATE notes SET hidden=1 WHERE id=?`).bind(id)]:[])])}
    else{
      if(act==='restore'&&l.state==='removed')return J({error:'形の正しくないリンクは戻せません。'},400);
      const v=lkValidate(l.url);if(v.error)return J({error:'形の正しくないリンクです。'},400);
      /* 戻すのは、新しい安全確認で問題が見つからず、確かめているあいだに状態が変わっていないときだけ */
      t=await lkThreat(env,db,v.check,now,{fresh:true});
      if(t.v!=='clean'&&act==='restore')return J({error:t.v==='unsafe'?'安全確認で危険の可能性があると判定されたため、戻せません。':'いま安全確認ができないため、戻せません。',verdict:t.v},409);
      let ch=1;
      if(t.v==='clean')ch=(await db.prepare(`UPDATE note_links SET ${act==='restore'?"state='ok',rev=rev+1,":''}verdict='clean',verdict_at=?,expires_at=?,updated_at=? WHERE note_id=? AND rev=?`).bind(now,t.exp,now,id,l.rev).run()).meta.changes;
      else if(t.v==='unsafe')ch=(await db.prepare(`UPDATE note_links SET state=CASE WHEN state='ok' THEN 'unsafe' ELSE state END,rev=rev+1,verdict='unsafe',verdict_at=?,expires_at=?,updated_at=? WHERE note_id=? AND rev=?`).bind(now,t.exp,now,id,l.rev).run()).meta.changes;
      if(!ch)return J({error:'確かめているあいだにリンクの状態が変わりました。もう一度確かめてください。',stale:true},409);
    }
    await lkEvent(db,now,{uid:l.uid,note_id:id,host:l.host,kind:'admin_'+act,detail:who+' '+reason});
    try{await tipsLog(db,env,ip,now,'link_'+act,id,reason)}catch(e){}
    const n=await db.prepare(`SELECT state FROM note_links WHERE note_id=?`).bind(id).first();
    return J({ok:true,state:n&&n.state,verdict:t&&t.v});
  }
  /* 運営者の確認の記録（利用停止の前に作る） */
  if(path==='/api/admin/cases'&&req.method==='POST'){
    if(!lkOn(env,'SANCTIONS_ON'))return J({error:'利用停止の記録はまだ使えません（SANCTIONS_ON）。'},503);
    const kind=String(body.kind||''),summary=admReason(body.summary,20);
    if(!['attack','linked'].includes(kind))return J({error:'種類（attack＝意図的な攻撃／linked＝関連アカウント）を選んでください。'},400);
    if(!summary)return J({error:'確かめた内容を20文字以上で書いてください。'},400);
    const t=await db.prepare(`SELECT uid,handle FROM users WHERE handle=? COLLATE NOCASE`).bind(String(body.handle||'').replace(/^@/,'')).first();
    if(!t)return J({error:'そのユーザーIDの人が見つかりません。'},404);
    if(t.uid.startsWith('bot:'))return J({error:'運営のアカウントは対象にできません。'},400);
    const refs=await caseRefsOk(db,t.uid,body.refs);
    if(!refs)return J({error:'根拠には、その人のこのサイトの記録（投稿・リンク・リンクの記録・通報）を1〜10件指定してください。IP アドレスは根拠にできません。'},400);
    let rel=null;
    if(kind==='linked'){rel=String(body.related_root||'');
      const p=rel&&await db.prepare(`SELECT 1 AS x FROM sanctions WHERE root_key=? AND kind='uid' AND source='confirmed_attack' AND status='active'`).bind(rel).first();
      if(!p)return J({error:'関連アカウントは、確かめた攻撃者の有効な利用停止（root）を指定してください。'},400);
      if(await db.prepare(`SELECT 1 AS x FROM sanctions WHERE root_key=? AND kind='uid' AND uid=?`).bind(rel,t.uid).first())return J({error:'同じ人を関連アカウントにはできません。'},400)}
    const who=await lkAdminWho(env,ip);
    const r=await db.prepare(`INSERT INTO sanction_cases(target_uid,kind,summary,refs,related_root,status,actor,created_at,updated_at) VALUES(?,?,?,?,?,'open',?,?,?) RETURNING id`).bind(t.uid,kind,summary,JSON.stringify(refs),rel,who,now,now).first();
    return J({ok:true,case_id:r.id});
  }
  /* 利用停止の一覧・鍵の状態（メールのハッシュ・UID そのものは返さない） */
  if(path==='/api/admin/sanctions'&&req.method==='GET'){
    const r=await db.prepare(`SELECT s.id,s.kind,s.permanent,s.starts_at,s.expires_at,s.reason,s.evidence,s.source,s.actor,s.status,s.appeal,s.root_key,s.case_id,s.created_at,s.updated_at,s.kver,us.handle,
      CASE WHEN s.status='active' AND (s.permanent=1 OR s.expires_at>?1) THEN 1 ELSE 0 END AS live FROM sanctions s LEFT JOIN users us ON us.uid=s.uid ORDER BY s.id DESC LIMIT 200`).bind(now).all();
    const cs=await db.prepare(`SELECT c.id,c.kind,c.summary,c.refs,c.related_root,c.status,c.created_at,us.handle FROM sanction_cases c LEFT JOIN users us ON us.uid=c.target_uid ORDER BY c.id DESC LIMIT 100`).all();
    const cov=await keyCoverage(db,env,now,{ident:true});
    return J({sanctions:r.results,cases:cs.results,enabled:lkOn(env,'SANCTIONS_ON'),
      health:{ok:!cov.err&&!cov.missingTomb.length&&!cov.missingIdent.length,err:cov.err,current:cov.current,versions:cov.versions,missing_tombstone_versions:cov.missingTomb,missing_identity_versions:cov.missingIdent}});
  }
  if(path==='/api/admin/sanctions'&&req.method==='POST'){
    if(!lkOn(env,'SANCTIONS_ON'))return J({error:'利用停止の記録はまだ使えません（SANCTIONS_ON）。'},503);
    const kind=String(body.kind||''),rationale=admReason(body.rationale,20),cid=Number.isInteger(body.case_id)?body.case_id:0;
    if(!['perpetrator','linked','temporary'].includes(kind))return J({error:'種類を選んでください。'},400);
    if(!rationale)return J({error:'停止する理由（確かめたこと）を20文字以上で書いてください。'},400);
    if(body.confirm!=='SANCTION')return J({error:'確認の言葉（SANCTION）を入れてください。'},400);
    const c=cid&&await db.prepare(`SELECT id,target_uid,kind,related_root,status FROM sanction_cases WHERE id=?`).bind(cid).first();
    if(!c||c.status!=='open')return J({error:'確認の記録（まだ停止していないもの）を指定してください。'},400);
    if(kind==='perpetrator'&&c.kind!=='attack')return J({error:'確かめた攻撃者の停止には、意図的な攻撃の確認の記録が要ります。'},400);
    if(kind==='linked'){if(c.kind!=='linked')return J({error:'関連アカウントの停止には、関連アカウントの確認の記録が要ります。'},400);
      if(!await db.prepare(`SELECT 1 AS x FROM sanctions WHERE root_key=? AND kind='uid' AND status='active'`).bind(c.related_root).first())return J({error:'もとの攻撃者の停止が取り消されています。'},409)}
    const t=await db.prepare(`SELECT uid,handle FROM users WHERE uid=?`).bind(c.target_uid).first();
    const perm=kind==='perpetrator';
    let exp=null;
    if(!perm){const mo=body.months==null?null:+body.months;
      if(mo!=null&&!(Number.isInteger(mo)&&mo>=3&&mo<=6))return J({error:'期間は3〜6か月から選んでください。'},400);
      exp=mo?jstAddMonths(now,mo):now+90*864e5}
    /* メールの停止に使う鍵の版が足りなければ作らない（あとで確かめられない停止を作らない） */
    const cov=await keyCoverage(db,env,now,{ident:true});
    if(perm&&(cov.err||!cov.current||cov.missingIdent.length||cov.missingTomb.length))return J({error:'メールの鍵の設定が足りないため、いまは作れません（管理画面の「鍵の状態」を確かめてください）。',health:cov},503);
    const who=await lkAdminWho(env,ip),src=perm?'confirmed_attack':kind==='linked'?'confirmed_linked':'manual',root=rndHex(16);
    const es=perm?(await db.prepare(`SELECT ehash,kver FROM user_emails WHERE uid=?`).bind(c.target_uid).all()).results:[];
    const email=perm?(es.length?'recorded':'unresolved'):'none';
    /* 作る：UID の行・メールの行・記録・表示（banned=2）・確認の記録の状態を、1つの取引で */
    const q=[db.prepare(`INSERT INTO sanctions(kind,uid,permanent,starts_at,expires_at,reason,evidence,source,actor,status,created_at,updated_at,root_key,case_id) VALUES('uid',?,?,?,?,?,?,?,?,'active',?,?,?,?)`)
        .bind(c.target_uid,perm?1:0,now,exp,rationale,'case:'+c.id,src,who,now,now,root,c.id),
      ...es.map(e=>db.prepare(`INSERT OR IGNORE INTO sanctions(kind,uid,ehash,kver,permanent,starts_at,expires_at,reason,evidence,source,actor,status,created_at,updated_at,root_key,case_id) VALUES('email',NULL,?,?,1,?,NULL,?,?,?,?,'active',?,?,?,?)`)
        .bind(e.ehash,e.kver,now,rationale,'case:'+c.id,src,who,now,now,root,c.id)),
      db.prepare(`INSERT INTO sanction_events(sanction_id,at,actor,action,note,root_key) SELECT id,?,?,'create',?,root_key FROM sanctions WHERE root_key=? AND kind='uid'`).bind(now,who,rationale,root),
      db.prepare(`INSERT INTO sanction_events(sanction_id,at,actor,action,note,root_key) SELECT id,?,?,?,?,root_key FROM sanctions WHERE root_key=? AND kind='uid'`).bind(now,who,'email_'+email,String(es.length),root),
      db.prepare(`UPDATE users SET banned=2 WHERE uid=? AND banned=0`).bind(c.target_uid),
      db.prepare(`UPDATE sanction_cases SET status='sanctioned',updated_at=? WHERE id=? AND status='open'`).bind(now,c.id)];
    await db.batch(q);
    const r=await db.prepare(`SELECT id FROM sanctions WHERE root_key=? AND kind='uid'`).bind(root).first();
    try{await tipsLog(db,env,ip,now,'sanction_'+kind,r.id,'@'+(t&&t.handle||'')+' '+rationale)}catch(e){}
    return J({ok:true,id:r.id,root,permanent:perm,expires_at:exp,email});
  }
  if((m=path.match(/^\/api\/admin\/sanctions\/(\d+)\/(reverse|appeal)$/))&&req.method==='POST'){
    const id=+m[1],act=m[2],reason=admReason(body.reason);
    if(!reason)return J({error:'理由を4文字以上で書いてください。'},400);
    if(body.confirm!==true)return J({error:'確認のうえで実行してください。'},400);
    const s=await db.prepare(`SELECT id,kind,uid,status,root_key FROM sanctions WHERE id=?`).bind(id).first();
    if(!s)return J({error:'記録が見つかりません。'},404);
    const who=await lkAdminWho(env,ip);
    if(act==='appeal'){const st=['open','upheld','granted'].includes(body.decision)?body.decision:'open';
      await db.batch([db.prepare(`UPDATE sanctions SET appeal=?,updated_at=? WHERE root_key=?`).bind(st,now,s.root_key),db.prepare(`INSERT INTO sanction_events(sanction_id,at,actor,action,note,root_key) VALUES(?,?,?,?,?,?)`).bind(id,now,who,'appeal_'+st,reason,s.root_key)]);
      if(st!=='granted')return J({ok:true,appeal:st})}
    /* 取り消し：同じ root_key のすべての行（メールの行・鍵の入れかえの写しも、何回入れかえても）を1つの取引で。ほかの停止（別の root）と手動の停止は触らない */
    const rs=await db.batch([db.prepare(`UPDATE sanctions SET status='reversed',updated_at=? WHERE root_key=? AND status='active'`).bind(now,s.root_key),
      db.prepare(`INSERT INTO sanction_events(sanction_id,at,actor,action,note,root_key) VALUES(?,?,?,?,?,?)`).bind(id,now,who,'reverse',reason,s.root_key)]);
    await sanctionSweepStmt(db,now).run();
    try{await tipsLog(db,env,ip,now,'sanction_reverse',id,reason)}catch(e){}
    return J({ok:true,status:'reversed',rows:rs[0].meta.changes});
  }
  return null;
}
/* 掃除（ときどき）：古い回数の記録・期限の切れた確認の覚え・許可・記録 */
async function linksCleanup(db,now){
  await linksInit(db);
  await db.batch([db.prepare(`DELETE FROM link_attempts WHERE at<?`).bind(now-2*864e5),db.prepare(`DELETE FROM link_clicks WHERE at<?`).bind(now-2*864e5),
    db.prepare(`DELETE FROM link_verdicts WHERE expires_at<?`).bind(now),db.prepare(`DELETE FROM link_quota WHERE day<?`).bind(LK_DAY(now-7*864e5)),
    db.prepare(`DELETE FROM link_intents WHERE expires_at<?`).bind(now-36e5),db.prepare(`DELETE FROM req_bad WHERE at<?`).bind(now-864e5),
    db.prepare(`DELETE FROM link_events WHERE at<?`).bind(now-180*864e5)]);
  await sanctionSweepStmt(db,now).run();
}
