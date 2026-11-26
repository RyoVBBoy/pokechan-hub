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
/* 足す列：すでにあるときの「duplicate column」だけを無視する（ほかの失敗はそのまま投げる＝閉じる） */
async function lkAddCol(db,t,c){try{await db.prepare(`ALTER TABLE ${t} ADD COLUMN ${c}`).run()}catch(e){if(!/duplicate column/i.test(String(e&&e.message||e)))throw e}}
/* 要る列・索引がそろっているか（そろっていなければ投げる＝この機能と利用停止の確かめは閉じる） */
const LK_SCHEMA={notes:['op'],note_links:['note_id','uid','url','host','state','verdict','verdict_at','expires_at','rev','vh','pol'],link_intents:['token','note_id','who','rev','expires_at','used','used_at','pol'],link_state:['k','v','at','until'],elid_review:['uid','elids','at'],
  sanctions:['id','kind','uid','ehash','kver','permanent','expires_at','status','root_key','case_id','parent','elid','basis','reviewer'],sanction_cases:['id','target_uid','kind','refs','related_root','status','op','ek','lbasis','dsum','lsum','reviewer','signals'],
  user_emails:['uid','ehash','kver','elid'],key_sentinels:['kver','tag'],link_budget_d:['day','month','n'],link_leases:['slot','holder','expires_at'],
  fb_sync:['uid','gen','done_gen','owned','prior','intent','intent_gen','lease','lease_until','attempts','next_at','dead','last_want','checked_at','pend_since','obs_disabled','obs_at','obs_gen','review','unknown','last_op','unk_op'],fb_metrics:['day','k','n'],fb_ops:['op','uid','gen','intent','kind','at','resolved_at','obs','how'],job_runs:['name','last_at','last_ok']};
const LK_INDEXES=['sanctions_root_eh','sanctions_root_uid','sanctions_case_uid','sanctions_kv','note_links_vh','fb_sync_due','notes_op'];
async function linksInit(db){
  if(LK_READY)return;
  await db.batch([
    /* 利用者のリンク（bot の notes.link とは別）。rev＝状態が変わるたびに増える番号。vh＝安全確認の覚えの鍵（同じリンクは同じ） */
    db.prepare(`CREATE TABLE IF NOT EXISTS note_links(note_id INTEGER PRIMARY KEY,uid TEXT NOT NULL,url TEXT NOT NULL,host TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',verdict TEXT,verdict_at INTEGER,expires_at INTEGER,created_at INTEGER,updated_at INTEGER,rev INTEGER NOT NULL DEFAULT 0,vh TEXT)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS note_links_uid ON note_links(uid,created_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS note_links_state ON note_links(state,updated_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS link_intents(token TEXT PRIMARY KEY,note_id INTEGER NOT NULL,who TEXT NOT NULL,rev INTEGER NOT NULL,expires_at INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0,created_at INTEGER,used_at INTEGER)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS link_intents_exp ON link_intents(expires_at)`),
    /* 安全確認の覚え（鍵＝方針の版＋リンク。危険の答えは業者の期限まで消さない） */
    db.prepare(`CREATE TABLE IF NOT EXISTS link_verdicts(h TEXT PRIMARY KEY,verdict TEXT NOT NULL,types TEXT,checked_at INTEGER,expires_at INTEGER)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS link_verdicts_exp ON link_verdicts(expires_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS link_verdicts_chk ON link_verdicts(verdict,checked_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS link_attempts(uid TEXT NOT NULL,at INTEGER NOT NULL)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS link_attempts_uid ON link_attempts(uid,at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS link_clicks(who TEXT NOT NULL,at INTEGER NOT NULL)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS link_clicks_who ON link_clicks(who,at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS link_quota(day TEXT PRIMARY KEY,n INTEGER NOT NULL DEFAULT 0)`),
    /* 外の安全確認の回数（1日・1か月を1行で。UTC で区切る） */
    db.prepare(`CREATE TABLE IF NOT EXISTS link_budget(id TEXT PRIMARY KEY,day TEXT NOT NULL DEFAULT '',dn INTEGER NOT NULL DEFAULT 0,month TEXT NOT NULL DEFAULT '',mn INTEGER NOT NULL DEFAULT 0)`),
    /* 外の安全確認の回数：UTC の日ごとに1行（月の回数は、その月の日の合計）。前の1行の形（link_budget）は使わない */
    db.prepare(`CREATE TABLE IF NOT EXISTS link_budget_d(day TEXT PRIMARY KEY,month TEXT NOT NULL,n INTEGER NOT NULL DEFAULT 0)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS link_budget_d_m ON link_budget_d(month)`),
    /* 状態の印（wr_saturated＝危険の覚えが上限：上限のあいだはリンクの投稿・押す・戻すを閉じる） */
    db.prepare(`CREATE TABLE IF NOT EXISTS link_state(k TEXT PRIMARY KEY,v TEXT,at INTEGER)`),
    /* メールの系統が分かれていた（同じメールと確かめられたのに系統が2つ以上）：自動でまとめず運営者が見る */
    db.prepare(`CREATE TABLE IF NOT EXISTS elid_review(uid TEXT NOT NULL,elids TEXT NOT NULL,at INTEGER,PRIMARY KEY(uid,elids))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS link_leases(slot INTEGER PRIMARY KEY,holder TEXT,expires_at INTEGER NOT NULL DEFAULT 0)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS req_bad(who TEXT NOT NULL,at INTEGER NOT NULL)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS req_bad_who ON req_bad(who,at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS req_bad_at ON req_bad(at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS link_events(id INTEGER PRIMARY KEY AUTOINCREMENT,at INTEGER,uid TEXT,note_id INTEGER,host TEXT,h TEXT,kind TEXT,detail TEXT)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS link_events_at ON link_events(at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS link_events_note ON link_events(note_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS link_events_uid ON link_events(uid,at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sanction_cases(id INTEGER PRIMARY KEY AUTOINCREMENT,target_uid TEXT NOT NULL,kind TEXT NOT NULL,summary TEXT NOT NULL,refs TEXT NOT NULL,related_root TEXT,status TEXT NOT NULL DEFAULT 'open',actor TEXT,created_at INTEGER,updated_at INTEGER,op TEXT)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS sanction_cases_t ON sanction_cases(target_uid,id)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sanctions(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT NOT NULL,uid TEXT,ehash TEXT,kver TEXT,permanent INTEGER NOT NULL DEFAULT 0,starts_at INTEGER,expires_at INTEGER,
      reason TEXT NOT NULL,evidence TEXT,source TEXT,actor TEXT,status TEXT NOT NULL DEFAULT 'active',appeal TEXT,parent INTEGER,created_at INTEGER,updated_at INTEGER,root_key TEXT,case_id INTEGER)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS sanctions_uid ON sanctions(uid,status)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS sanctions_eh ON sanctions(ehash,status)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sanction_events(id INTEGER PRIMARY KEY AUTOINCREMENT,sanction_id INTEGER,at INTEGER,actor TEXT,action TEXT,note TEXT,root_key TEXT)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS sanction_events_s ON sanction_events(sanction_id,id)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS user_emails(uid TEXT NOT NULL,ehash TEXT NOT NULL,kver TEXT NOT NULL,first_at INTEGER,last_at INTEGER,PRIMARY KEY(uid,ehash))`),
    db.prepare(`CREATE INDEX IF NOT EXISTS user_emails_eh ON user_emails(ehash)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS user_emails_kv ON user_emails(kver)`),
    /* 鍵の版ごとの確かめの印（鍵そのものではなく、鍵で決まった文字列を作った値。同じ版で鍵の中身を差しかえたら合わなくなる） */
    db.prepare(`CREATE TABLE IF NOT EXISTS key_sentinels(kver TEXT PRIMARY KEY,tag TEXT NOT NULL,created_at INTEGER)`),
    /* Firebase 側の同期：アカウントごとに1行（命令の列ではなく「あるべき状態」を毎回 D1 から決める）。
       gen＝あるべき状態が変わるかもしれない出来事のたびに増える番号、done_gen＝そこまで Firebase に合わせた番号。
       owned＝この仕組みが止めた（止める前に記録する）、prior＝この仕組みが最初に触る前の Firebase の状態（止める前に記録。null＝まだ見ていない）。
       intent/intent_gen＝これから Firebase に何をするか（外を変える前に記録）。lease/lease_until＝1つのアダプターだけが扱う（番号で古い報告を断る）。
       attempts/next_at＝失敗のやり直し（だんだん間をあける）、dead＝10回失敗（運営者がやり直すまで止める・管理画面に出す）。checked_at＝最後に確かめた時刻（1日ごとに確かめ直す） */
    db.prepare(`CREATE TABLE IF NOT EXISTS fb_sync(uid TEXT PRIMARY KEY,gen INTEGER NOT NULL DEFAULT 1,done_gen INTEGER NOT NULL DEFAULT 0,owned INTEGER NOT NULL DEFAULT 0,prior INTEGER,
      intent TEXT,intent_gen INTEGER,lease TEXT,lease_until INTEGER NOT NULL DEFAULT 0,attempts INTEGER NOT NULL DEFAULT 0,next_at INTEGER NOT NULL DEFAULT 0,dead INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,last_want TEXT,checked_at INTEGER,created_at INTEGER,updated_at INTEGER)`),
    /* Firebase の同期の数（日ごと：done＝終えた・failed＝失敗・unknown＝結果が分からない・stale＝古い報告/期限切れ・lost＝返事が届かなかった報告の再送） */
    db.prepare(`CREATE TABLE IF NOT EXISTS fb_metrics(day TEXT NOT NULL,k TEXT NOT NULL,n INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,k))`),
    /* 結果が分からない Firebase の操作を1つずつ（op＝その回の借りた印）。timeout＝動いているアダプターが時間切れを報告した、crash＝止める/戻す記録のあと報告がないまま借りる時間が切れた。
       片づくのは、その op の読み直し（observe）か運営者のやり直し（replay）だけ。timeout が残っているあいだは、そのアカウントを新しく変えない（claim しない） */
    db.prepare(`CREATE TABLE IF NOT EXISTS fb_ops(op TEXT PRIMARY KEY,uid TEXT NOT NULL,gen INTEGER,intent TEXT,kind TEXT NOT NULL,at INTEGER NOT NULL,resolved_at INTEGER,obs INTEGER,how TEXT)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS fb_ops_uid ON fb_ops(uid,resolved_at)`),
    /* 決まった時刻の仕事の結果（期限の見直しなど） */
    db.prepare(`CREATE TABLE IF NOT EXISTS job_runs(name TEXT PRIMARY KEY,last_at INTEGER,last_ok INTEGER,last_err TEXT,ok_at INTEGER,fails INTEGER NOT NULL DEFAULT 0)`)
  ]);
  /* この版より前の表（このブランチの前の版）に列を足す */
  for(const [t,c] of [['note_links','rev INTEGER NOT NULL DEFAULT 0'],['note_links','vh TEXT'],['link_intents','used_at INTEGER'],['sanctions','root_key TEXT'],['sanctions','case_id INTEGER'],['sanction_events','root_key TEXT'],['sanction_cases','op TEXT'],['sanction_cases','ek TEXT'],['sanction_cases','lbasis TEXT'],['sanction_cases','dsum TEXT'],['notes','op TEXT'],['fb_sync','pend_since INTEGER'],['fb_sync','obs_disabled INTEGER'],['fb_sync','obs_at INTEGER'],['fb_sync','obs_gen INTEGER'],['fb_sync','review INTEGER NOT NULL DEFAULT 0'],['fb_sync','review_why TEXT'],['fb_sync','unknown INTEGER NOT NULL DEFAULT 0'],['fb_sync','intent_at INTEGER'],['fb_sync','unk_intent TEXT'],['sanctions','elid TEXT'],['sanctions','basis TEXT'],['sanctions','reviewer TEXT'],['sanction_cases','lsum TEXT'],['sanction_cases','reviewer TEXT'],['sanction_cases','signals TEXT'],['user_emails','elid TEXT'],['note_links','pol TEXT'],['link_intents','pol TEXT'],['fb_sync','last_op TEXT'],['fb_sync','unk_op TEXT'],['link_state','until INTEGER']])
    await lkAddCol(db,t,c);
  await db.batch([
    /* root_key のない前の行：parent をたどった一番上の行の番号にする（何段でも。輪になっても64段で止める） */
    db.prepare(`WITH RECURSIVE anc(id,rk,d) AS (SELECT id,COALESCE(root_key,'id:'||id),0 FROM sanctions WHERE parent IS NULL OR parent=0 OR parent NOT IN (SELECT id FROM sanctions)
        UNION ALL SELECT s.id,a.rk,a.d+1 FROM sanctions s JOIN anc a ON s.parent=a.id WHERE a.d<64)
      UPDATE sanctions SET root_key=(SELECT rk FROM anc WHERE anc.id=sanctions.id) WHERE root_key IS NULL AND id IN (SELECT id FROM anc)`),
    db.prepare(`UPDATE sanctions SET root_key='id:'||id WHERE root_key IS NULL`),
    /* メールの系統（elid）＝同じメールアドレスの、鍵の版ちがいのハッシュをまとめる印。前の行（elid なし）は控えめに：作り直しのコピーはもとの行の系統、ほかは1行ずつ別の系統 */
    db.prepare(`WITH RECURSIVE ch(id,el,d) AS (SELECT id,'lg:'||id,0 FROM sanctions WHERE kind='email' AND elid IS NULL AND (parent IS NULL OR parent NOT IN (SELECT id FROM sanctions WHERE kind='email'))
        UNION ALL SELECT s.id,c.el,c.d+1 FROM sanctions s JOIN ch c ON s.parent=c.id WHERE s.kind='email' AND c.d<64)
      UPDATE sanctions SET elid=COALESCE((SELECT p.elid FROM sanctions p WHERE p.id=sanctions.parent AND p.kind='email' AND p.elid IS NOT NULL),(SELECT el FROM ch WHERE ch.id=sanctions.id)) WHERE kind='email' AND elid IS NULL AND id IN (SELECT id FROM ch)`),
    db.prepare(`UPDATE sanctions SET elid='lg:'||id WHERE kind='email' AND elid IS NULL`),
    db.prepare(`UPDATE user_emails SET elid='lg:'||ehash WHERE elid IS NULL`),
    /* 前の1行の回数（link_budget）があれば、日ごとの表に1回だけ移す（数を消さない・2回数えない：移したら前の行を0にする。同じ取引） */
    db.prepare(`INSERT OR IGNORE INTO link_budget_d(day,month,n) SELECT day,substr(day,1,7),dn FROM link_budget WHERE id='webrisk' AND day<>'' AND dn>0`),
    db.prepare(`INSERT OR IGNORE INTO link_budget_d(day,month,n) SELECT month||'-00',month,mn-(CASE WHEN substr(day,1,7)=month THEN dn ELSE 0 END) FROM link_budget WHERE id='webrisk' AND month<>'' AND mn-(CASE WHEN substr(day,1,7)=month THEN dn ELSE 0 END)>0`),
    db.prepare(`UPDATE link_budget SET day='',dn=0,month='',mn=0 WHERE id='webrisk' AND (day<>'' OR month<>'')`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS sanctions_root_eh ON sanctions(root_key,ehash) WHERE kind='email'`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS sanctions_root_uid ON sanctions(root_key) WHERE kind='uid'`),
    /* 1つの確認の記録からは UID の停止は1つだけ（同時に送っても2つ目は入らない） */
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS sanctions_case_uid ON sanctions(case_id) WHERE kind='uid' AND case_id IS NOT NULL`),
    db.prepare(`CREATE INDEX IF NOT EXISTS sanctions_root ON sanctions(root_key,status)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS sanctions_kv ON sanctions(kind,status,kver)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS note_links_vh ON note_links(vh)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS fb_sync_due ON fb_sync(dead,next_at)`),
    /* リンク付きの投稿の、リクエストごとの使い捨ての鍵（リンクの行は、この鍵で書いた投稿だけにつける） */
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS notes_op ON notes(op) WHERE op IS NOT NULL`)
  ]);
  /* 確かめ：列と索引がそろっているか */
  for(const [t,cols] of Object.entries(LK_SCHEMA)){
    const have=new Set((await db.prepare(`SELECT name FROM pragma_table_info(?)`).bind(t).all()).results.map(x=>x.name));
    const miss=cols.filter(c=>!have.has(c));if(miss.length)throw new Error('schema:'+t+':'+miss.join(','))}
  const ix=new Set((await db.prepare(`SELECT name FROM sqlite_master WHERE type='index'`).all()).results.map(x=>x.name));
  const mi=LK_INDEXES.filter(x=>!ix.has(x));if(mi.length)throw new Error('schema:index:'+mi.join(','));
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
/* 鍵の束（keyring）：EMAIL_HMAC_KEYRING＝{"版":"鍵（32文字以上）",…}（JSON・32まで）、EMAIL_HMAC_KEY_CURRENT＝新しく記録に使う版。
   前の書き方（EMAIL_HMAC_KEY/_VER・EMAIL_HMAC_KEY_PREV/_PREV_VER）も束に入れる。
   **鍵は時間がたっただけでは外さない**（参照されている版が足りなければ閉じる）。同じ版で鍵の中身を差しかえるのも禁止（key_sentinels で見つけて閉じる）。
   返す値：{cur:{v,k}|null, keys:[{v,k}]（今の版を先に）, err} */
const LK_KEYS_MAX=32;
function emailKeyring(env){
  const m=new Map(),okV=v=>/^[A-Za-z0-9_-]{1,16}$/.test(v),okK=k=>typeof k==='string'&&k.length>=32&&k.length<=512;
  if(env.EMAIL_HMAC_KEYRING){let o;try{o=JSON.parse(String(env.EMAIL_HMAC_KEYRING))}catch(e){return{cur:null,keys:[],err:'keyring-parse'}}
    if(!o||typeof o!=='object'||Array.isArray(o))return{cur:null,keys:[],err:'keyring-parse'};
    for(const [v,k] of Object.entries(o)){if(!okV(v)||!okK(k))return{cur:null,keys:[],err:'keyring-entry'};m.set(v,k)}}
  const k1=String(env.EMAIL_HMAC_KEY||''),v1=String(env.EMAIL_HMAC_KEY_VER||'v1'),k0=String(env.EMAIL_HMAC_KEY_PREV||''),v0=String(env.EMAIL_HMAC_KEY_PREV_VER||'v0');
  for(const [v,k] of [[v1,k1],[v0,k0]])if(k){if(!okV(v)||!okK(k))continue;if(m.has(v)&&m.get(v)!==k)return{cur:null,keys:[],err:'keyring-conflict'};m.set(v,k)}
  if(m.size>LK_KEYS_MAX)return{cur:null,keys:[],err:'keyring-size'};
  const cv=String(env.EMAIL_HMAC_KEY_CURRENT||(k1&&okK(k1)?v1:''))||'';
  if(cv&&!m.has(cv))return{cur:null,keys:[],err:'current-missing'};
  const keys=[...m].map(([v,k])=>({v,k}));keys.sort((a,b)=>(b.v===cv)-(a.v===cv));
  return{cur:cv?{v:cv,k:m.get(cv)}:null,keys,err:null};
}
async function hmacHex(key,msg){const ck=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC',ck,new TextEncoder().encode(msg)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function emailHashes(env,email){const n=emailNorm(email),kr=emailKeyring(env);if(!n||kr.err)return [];const out=[];
  for(const x of kr.keys)out.push({h:await hmacHex(x.k,'gk-email|'+n),v:x.v,cur:!!(kr.cur&&x.v===kr.cur.v)});return out}
/* 鍵の確かめの印：版ごとに1つ。はじめて使う版は記録し（最初に使った鍵を正しいとする）、その後は毎回くらべる。
   isolate ごとに、同じ D1・同じ鍵の中身で確かめ済みなら覚えておく */
/* 覚えは D1 の結びつき（env.DB）ごと・60秒まで（鍵の中身が変われば sig が変わってもう一度確かめる。
   D1 を前の状態に戻した〔restore〕ときも、60秒以内にもう一度確かめる＝60秒より長く古い確かめのままにしない） */
const KS_MEMO=new WeakMap(),KS_TTL=60e3;
async function keySentinels(db,kr){
  if(kr.err||!kr.keys.length)return{ok:!kr.err,mismatch:[]};
  const fps=await Promise.all(kr.keys.map(async x=>({v:x.v,tag:(await hmacHex(x.k,'gk-key-sentinel|1|'+x.v)).slice(0,32)})));
  const sig=fps.map(x=>x.v+':'+x.tag).join('|');
  const now=Date.now(),mm=KS_MEMO.get(db);
  if(mm&&mm.sig===sig&&now-mm.at<KS_TTL)return{ok:true,mismatch:[]};
  await db.batch(fps.map(x=>db.prepare(`INSERT OR IGNORE INTO key_sentinels(kver,tag,created_at) VALUES(?,?,?)`).bind(x.v,x.tag,now)));
  const have=new Map((await db.prepare(`SELECT kver,tag FROM key_sentinels WHERE kver IN (${fps.map(()=>'?').join(',')})`).bind(...fps.map(x=>x.v)).all()).results.map(r=>[r.kver,r.tag]));
  const mismatch=fps.filter(x=>have.get(x.v)!==x.tag).map(x=>x.v);
  if(!mismatch.length)KS_MEMO.set(db,{sig,at:now});else KS_MEMO.delete(db);
  return{ok:!mismatch.length,mismatch};
}
/* 鍵の版が足りているか・中身が同じか：有効なメールの停止（tombstone）が使っている版が、すべて束にあり、印が合うか（毎回）。
   ident:true のときは、記録したハッシュ（あとで停止に使う）が使っている版も確かめる */
async function keyCoverage(db,env,now,o={}){
  const kr=emailKeyring(env),have=new Set(kr.err?[]:kr.keys.map(x=>x.v));
  const tv=(await db.prepare(`SELECT DISTINCT kver FROM sanctions WHERE kind='email' AND status='active' AND (permanent=1 OR expires_at>?)`).bind(now).all()).results.map(x=>x.kver);
  const iv=o.ident?(await db.prepare(`SELECT DISTINCT kver FROM user_emails`).all()).results.map(x=>x.kver):[];
  const ks=(tv.length||o.ident||o.sentinel)?await keySentinels(db,kr):{ok:true,mismatch:[]};
  return{err:kr.err||(ks.mismatch.length?'key-mismatch':null),mismatch:ks.mismatch,current:kr.cur?kr.cur.v:null,versions:[...have],tombstones:tv.length>0,missingTomb:tv.filter(v=>!have.has(v)),missingIdent:iv.filter(v=>!have.has(v))};
}
/* ---------- 利用停止の判定 ---------- */
const SANC_ACTIVE=`status='active' AND (permanent=1 OR expires_at>?)`;
/* 期限が来た「記録による停止（banned=2）」だけを元に戻す。手動の停止（1）は触らない */
const sanctionSweepStmt=(db,now,uid)=>db.prepare(`UPDATE users SET banned=0 WHERE banned=2${uid?' AND uid=?3':''}
  AND NOT EXISTS(SELECT 1 FROM sanctions s WHERE s.kind='uid' AND s.uid=users.uid AND s.status='active' AND (s.permanent=1 OR s.expires_at>?1))
  AND NOT EXISTS(SELECT 1 FROM sanctions s JOIN user_emails ue ON ue.ehash=s.ehash WHERE s.kind='email' AND ue.uid=users.uid AND s.status='active' AND (s.permanent=1 OR s.expires_at>?2))`).bind(...(uid?[now,now,uid]:[now,now]));
/* 期限が来た停止：この仕組みが止めた Firebase のアカウントのうち、もう有効な停止がないものを「確かめ直す」にする（戻すかどうかは、アダプターが動く直前に D1 で決める） */
const fbExpireStmt=(db,now)=>db.prepare(`UPDATE fb_sync SET gen=gen+1,next_at=0,updated_at=?1 WHERE owned=1 AND last_want='disabled' AND done_gen>=gen AND NOT ${fbSancSQL('fb_sync.uid','?1')}`).bind(now);
/* 1時間ごと（cron '0 * * * *'）と掃除：期限が来た停止の表示を戻す。結果は job_runs に残す（失敗は次の回にもう一度。1時間は目安で、保証ではない） */
async function sanctionSweep(db,now){
  await linksInit(db);
  try{await db.batch([sanctionSweepStmt(db,now),fbExpireStmt(db,now)]);
    await db.prepare(`INSERT INTO job_runs(name,last_at,last_ok,ok_at,fails) VALUES('sanction_sweep',?1,1,?1,0) ON CONFLICT(name) DO UPDATE SET last_at=?1,last_ok=1,ok_at=?1,last_err=NULL,fails=0`).bind(now).run()}
  catch(e){try{await db.prepare(`INSERT INTO job_runs(name,last_at,last_ok,last_err,fails) VALUES('sanction_sweep',?1,0,?2,1) ON CONFLICT(name) DO UPDATE SET last_at=?1,last_ok=0,last_err=?2,fails=fails+1`).bind(now,String(e&&e.message||e).slice(0,120)).run()}catch(e2){}throw e}
}
/* その UID・確認済みメールに有効な停止があるか。{deny:{…}} か {hs} か 例外（調べられない＝閉じる） */
async function sanctionState(db,env,uid,email,emailVerified,now){
  const cov=await keyCoverage(db,env,now);
  if(cov.tombstones&&(cov.err||cov.missingTomb.length))throw new Error('sanction-key-missing');
  const hs=email&&emailVerified&&!cov.err?await emailHashes(env,email):[];
  const th=cov.tombstones?hs.map(x=>x.h):[];
  const r=await db.prepare(`SELECT id,kind,permanent,expires_at,root_key,ehash FROM sanctions WHERE status='active' AND (permanent=1 OR expires_at>?1)
    AND ((kind='uid' AND uid=?2) OR (kind='email' AND ehash IN (SELECT ehash FROM user_emails WHERE uid=?2))${th.length?` OR (kind='email' AND ehash IN (${th.map((_,i)=>'?'+(i+3)).join(',')}))`:''})
    ORDER BY permanent DESC,expires_at DESC LIMIT 1`).bind(now,uid,...th).first();
  if(!r)return{hs};
  const cur=hs.find(x=>x.cur);
  if(r.kind==='email'&&cur&&cur.h!==r.ehash&&th.includes(r.ehash))await db.prepare(`INSERT OR IGNORE INTO sanctions(kind,uid,ehash,kver,permanent,starts_at,expires_at,reason,evidence,source,actor,status,parent,created_at,updated_at,root_key,case_id,elid,basis)
    SELECT 'email',NULL,?1,?2,s.permanent,s.starts_at,s.expires_at,s.reason,s.evidence,'rekey',s.actor,'active',s.id,?3,?3,s.root_key,s.case_id,s.elid,s.basis FROM sanctions s
    WHERE s.id=?4 AND s.status='active' AND EXISTS(SELECT 1 FROM sanctions r WHERE r.root_key=s.root_key AND r.kind='uid' AND r.status='active')`).bind(cur.h,cur.v,now,r.id).run();
  return{deny:r,hs};
}
async function emailLink(db,uid,hs,now){
  const cur=hs.find(x=>x.cur);if(!cur)return false;
  const r=await db.prepare(`SELECT last_at FROM user_emails WHERE uid=? AND ehash=?`).bind(uid,cur.h).first();
  if(r&&r.last_at>now-864e5)return true;
  /* 系統（elid）：この人の同じメールの、ほかの版のハッシュがあればその系統、なければ新しい系統（メールそのものは残さない） */
  /* hs はこのリクエストで確かめたトークンのメールから計算した、鍵の版ごとのハッシュ。前の版の行（lg:〜＝系統の記録より前の行も）に同じハッシュがあれば同じ系統。
     ちがう系統が2つ以上当たったら、決まった順でいちばん小さいものを使い、運営者が確かめるように elid_review に残す（管理画面の health） */
  const ex=(await db.prepare(`SELECT DISTINCT elid FROM user_emails WHERE uid=? AND ehash IN (${hs.map(()=>'?').join(',')}) AND elid IS NOT NULL ORDER BY elid`).bind(uid,...hs.map(x=>x.h)).all()).results||[];
  const el=ex.length?ex[0].elid:'el:'+rndHex(8);
  const st=[db.prepare(`INSERT INTO user_emails(uid,ehash,kver,first_at,last_at,elid) VALUES(?,?,?,?,?,?) ON CONFLICT(uid,ehash) DO UPDATE SET last_at=excluded.last_at`).bind(uid,cur.h,cur.v,now,now,el)];
  if(ex.length>1)st.push(db.prepare(`INSERT OR IGNORE INTO elid_review(uid,elids,at) VALUES(?,?,?)`).bind(uid,ex.map(x=>x.elid).join(','),now));
  await db.batch(st);
  return true;
}
const SANC_MSG='このアカウントは利用を停止しています。異議は「お問い合わせ」（ログイン不要）から送れます。';
const SANC_ERR='いまアカウントの状態を確かめられません。少し時間をおいてください。';
/* このリクエストで確かめた、トークンの確認済みメールのハッシュ（投稿を書く文の中でもう一度確かめるため） */
const GATE_HS=new WeakMap();
/* ログインした人のリクエストごとに、利用停止を確かめる（api() の最初。どの機能より先）。
   ・停止中：書きこみ（GET 以外）と /api/me* は 403。ほかの読むだけ（GET）はログインしていない人と同じ扱い
   ・記録を調べられない（表・鍵の版・鍵の中身）：書きこみと /api/me は 503、読むだけはログインしていない人と同じ
   ・ここを通ったあとの書きこみのうち、投稿は書く文の中でもう一度確かめる（social.js の noteIns）。ほかの書きこみは、このリクエストのあいだだけ前の判定のまま
   変数に関係なく、有効な停止はいつも守る */
async function sanctionGate(req,env,db,path,now){
  if(!/^Bearer\s+\S/i.test(req.headers.get('authorization')||'')||!fbPid(env))return null;
  const me=await authOf(req,env);if(!me)return null;
  const meP=path==='/api/me'||path.startsWith('/api/me/');
  let st;
  try{await linksInit(db);st=await sanctionState(db,env,me.uid,me.email,me.emailVerified,now)}
  catch(e){AUTH_DENY.set(req,{err:true});
    if(req.method==='GET'&&!meP)return null;
    return J({error:SANC_ERR},503)}
  GATE_HS.set(req,st.hs||[]);
  if(st.deny){
    /* 停止中でも：お問い合わせ（異議の申し立て。だれの申し立てか分かるようにログインのまま）と、アカウントの削除はできる（利用停止の記録そのものは残る） */
    if(req.method==='POST'&&(path==='/api/contact'||path==='/api/me/delete'))return null;
    AUTH_DENY.set(req,{id:st.deny.id});
    const until=st.deny.permanent?null:st.deny.expires_at;
    const msg='このアカウントは利用を停止しています'+(until?`（${new Date(until+9*3600e3).toISOString().slice(0,10)} まで）`:'')+'。異議は「お問い合わせ」（ログイン不要）から送れます。アカウントの削除もできます。';
    if(req.method!=='GET'||meP)return J({error:msg,sanction:{permanent:!!st.deny.permanent,until}},403);
    return null;
  }
  try{
    if(req.method!=='GET'||path==='/api/me'){await sanctionSweepStmt(db,now,me.uid).run();
      /* 記録する前に、いまの版の鍵の印を確かめる（はじめての版なら印を記録してから。合わなければ記録しない＝ちがう鍵で作ったハッシュを残さない） */
      if(lkOn(env,'SANCTIONS_ON')&&st.hs&&st.hs.length&&(await keySentinels(db,emailKeyring(env))).ok)await emailLink(db,me.uid,st.hs,now)}
  }catch(e){if(req.method!=='GET')return J({error:SANC_ERR},503)}
  return null;
}
/* 投稿を書く文の中で確かめる「停止されていないこと」（?1＝uid、?3＝時刻、?7〜＝トークンのメールのハッシュ） */
const noteSancSQL=n=>`AND EXISTS(SELECT 1 FROM users WHERE uid=?1 AND banned=0)
  AND NOT EXISTS(SELECT 1 FROM sanctions s WHERE s.status='active' AND (s.permanent=1 OR s.expires_at>?3)
    AND ((s.kind='uid' AND s.uid=?1) OR (s.kind='email' AND s.ehash IN (SELECT ehash FROM user_emails WHERE uid=?1))${n?` OR (s.kind='email' AND s.ehash IN (${[...Array(n).keys()].map(i=>'?'+(i+7)).join(',')}))`:''}))`;
/* ---------- 形のおかしいリクエストの回数（接続元ごとに10分30回・全体で10分5000回。超えたら429。書くのは枠の中だけ） ---------- */
async function badReq(db,env,ip,now){
  try{await linksInit(db);
    const who=(await sha(ip+'|bad|'+(env.APP_TOKEN||''))).slice(0,20);
    const r=await db.prepare(`INSERT INTO req_bad(who,at) SELECT ?1,?2 WHERE (SELECT COUNT(*) FROM req_bad WHERE who=?1 AND at>?2-600000)<30 AND (SELECT COUNT(*) FROM req_bad WHERE at>?2-600000)<5000 RETURNING at`).bind(who,now).first();
    return !r}catch(e){return true}
}
/* ---------- 安全確認（Google Cloud Web Risk Lookup v1 uris.search。決まったアドレスだけ・行き先は開かない） ---------- */
/* 覚えの鍵に入れる方針の版（確かめる種類を変えたら版を上げる＝前の答えを使わない） */
const LK_POLICY='p1:'+LK_WR_TYPES.join(',');
const lkVh=checkUrl=>sha('lk|'+LK_POLICY+'|'+checkUrl);
const lkTtl=env=>Math.max(5,Math.min(60,parseInt(env.LINKS_CLEAN_TTL_MIN||'30',10)||30))*60e3;
const lkConc=env=>Math.max(1,Math.min(16,parseInt(env.LINKS_WEBRISK_CONC||'4',10)||4));
const lkMs=env=>Math.max(500,Math.min(5000,+env.LINKS_WEBRISK_MS||3000));
const lkDayCap=env=>Math.max(1,Math.min(100000,parseInt(env.LINKS_WEBRISK_DAY||'3000',10)||3000));
const lkMonCap=env=>Math.max(1,Math.min(1000000,parseInt(env.LINKS_WEBRISK_MONTH||'90000',10)||90000));
/* 覚えの上限：問題なしは「全部で5000行」になるまで（危険の行が多いときは問題なしを覚えない）。危険は20000行まで（期限内の危険は消さない。
   それをこえたら新しい危険は覚えないが、その投稿は止め、ほかの投稿は毎回問い合わせて止める＝開ける方には倒れない） */
const LK_CACHE_MAX=5000,LK_UNSAFE_MAX=20000;
async function lkReadCapped(r,max){
  if(!r.body){const t=await r.text();if(t.length>max)throw new Error('big');return t}
  const rd=r.body.getReader(),ch=[];let n=0;
  for(;;){const {done,value}=await rd.read();if(done)break;n+=value.byteLength;if(n>max){try{await rd.cancel()}catch(e){}throw new Error('big')}ch.push(value)}
  const all=new Uint8Array(n);let o=0;for(const c of ch){all.set(c,o);o+=c.byteLength}
  return new TextDecoder('utf-8',{fatal:true}).decode(all);
}
const rndHex=n=>[...crypto.getRandomValues(new Uint8Array(n))].map(x=>x.toString(16).padStart(2,'0')).join('');
async function lkLease(db,env,now){
  const n=lkConc(env);
  await db.batch([...Array(n).keys()].map(i=>db.prepare(`INSERT OR IGNORE INTO link_leases(slot,holder,expires_at) VALUES(?,NULL,0)`).bind(i)));
  const holder=rndHex(12);
  const r=await db.prepare(`UPDATE link_leases SET holder=?1,expires_at=?2 WHERE slot=(SELECT slot FROM link_leases WHERE slot<?4 AND expires_at<=?3 ORDER BY slot LIMIT 1) RETURNING slot`).bind(holder,now+lkMs(env)+2000,now,n).first();
  return r?{slot:r.slot,holder}:null;
}
const lkRelease=(db,l)=>db.prepare(`UPDATE link_leases SET holder=NULL,expires_at=0 WHERE slot=? AND holder=?`).bind(l.slot,l.holder).run().catch(()=>{});
/* 1日と1か月の回数を、1つの文で同時にとる（片方だけ増えることはない）。日の行は UTC の日ごと、月の回数はその月の日の合計（日・月ごとに別々の数＝
   遅れて届いたリクエストでも、そのリクエストの日・月に数え、ほかの日・月の数を戻したり消したりしない）。外へ送る回数（失敗も）を数え、覚えを使ったときは数えない。
   時刻は、外へ送る直前（札をとったあと）の時刻を渡す */
async function lkBudget(db,env,now){
  const d=new Date(now).toISOString().slice(0,10),mo=d.slice(0,7);
  const r=await db.prepare(`INSERT INTO link_budget_d(day,month,n) SELECT ?1,?2,1 WHERE ?3>0 AND (SELECT COALESCE(SUM(n),0) FROM link_budget_d WHERE month=?2)<?4
    ON CONFLICT(day) DO UPDATE SET n=link_budget_d.n+1 WHERE link_budget_d.n<?3 AND (SELECT COALESCE(SUM(n),0) FROM link_budget_d WHERE month=?2)<?4 RETURNING n`).bind(d,mo,lkDayCap(env),lkMonCap(env)).first();
  return !!r;
}
/* 結果：{v:'clean'|'unsafe'|'error', types, exp, why, h}。
   ・危険の答えは、業者の expireTime まで覚え、その間は（新しく確かめる指定でも）問い合わせずに危険として使う（短くしない）
   ・危険なのに expireTime がない・読めない＝形がおかしい（閉じる）。expireTime が過ぎている＝今回は危険として断り、覚えない
   ・問題なしは、当サイトが決めた短い時間だけ覚える（業者の保証ではない）
   ・覚えを読めない・書けないときは閉じる */
/* 危険の覚えが上限（wr_saturated）か。上限のあいだは、問い合わせも問題なしの覚えも使わず、リンクの投稿・押す・戻すを閉じる（危険を忘れて開く方には倒れない）。
   期限切れで危険の行が上限の9割より少なくなったら外す（そのときに数える） */
/* 上限の印がないこと（投稿・許可を出す・許可を使う・戻すの、最後に書く文の中で確かめる。確かめてから書くまでのあいだに印が立っても書かない） */
const LK_NOSAT=`NOT EXISTS(SELECT 1 FROM link_state WHERE k='wr_saturated')`;
async function lkSaturated(db,now){
  const r=await db.prepare(`SELECT at,until FROM link_state WHERE k='wr_saturated'`).first();if(!r)return false;
  /* 外すのは1つの文で：覚えられなかった危険の答えがすべて期限切れ（until）で、しかも危険の行が上限の9割より少ないときだけ。
     そのあいだにほかのリクエストが印を立て直した（until をのばした）なら、この文は消さない */
  await db.prepare(`DELETE FROM link_state WHERE k='wr_saturated' AND COALESCE(until,9e15)<=?1 AND (SELECT COUNT(*) FROM link_verdicts WHERE verdict='unsafe' AND expires_at>?1)<?2`).bind(now,Math.floor(LK_UNSAFE_MAX*0.9)).run();
  return !!(await db.prepare(`SELECT 1 AS x FROM link_state WHERE k='wr_saturated'`).first());
}
/* 危険の答えを、同じ行き先のすべての投稿のリンクに書く（覚えに入らなくても、投稿の側に残る。rev を上げて、出ている許可も使えなくする） */
const lkMarkVhUnsafe=(db,h,now,exp)=>db.prepare(`UPDATE note_links SET state='unsafe',verdict='unsafe',verdict_at=?1,expires_at=?2,updated_at=?1,rev=rev+1 WHERE vh=?3 AND state='ok'`).bind(now,exp,h);
async function lkThreat(env,db,checkUrl,now,opt={}){
  const h=await lkVh(checkUrl);
  let c;try{c=await db.prepare(`SELECT verdict,types,expires_at FROM link_verdicts WHERE h=?`).bind(h).first()}catch(e){return{v:'error',why:'cache',h}}
  if(c&&c.verdict==='unsafe'&&c.expires_at>now)return{v:'unsafe',types:c.types?c.types.split(','):[],exp:c.expires_at,h,cached:true};
  try{if(await lkSaturated(db,now))return{v:'error',why:'saturated',h}}catch(e){return{v:'error',why:'cache',h}}
  if(c&&c.verdict==='clean'&&c.expires_at>now&&!opt.fresh)return{v:'clean',types:[],exp:c.expires_at,h,cached:true};
  const key=String(env.WEBRISK_API_KEY||'');
  if(!key)return{v:'error',why:'nokey',h};
  let lease;try{lease=await lkLease(db,env,now)}catch(e){return{v:'error',why:'lease',h}}
  if(!lease)return{v:'error',why:'busy',h};
  try{
    let okB;try{okB=await lkBudget(db,env,Date.now())}catch(e){return{v:'error',why:'quota',h}}
    if(!okB)return{v:'error',why:'quota',h};
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
        const ex=typeof t.expireTime==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.test(t.expireTime)?Date.parse(t.expireTime):NaN;
        if(isNaN(ex))return{v:'error',why:'malformed',h};
        if(ex<=now)return{v:'unsafe',types:[...new Set(t.threatTypes)],exp:now,h,nocache:true};
        res={v:'unsafe',types:[...new Set(t.threatTypes)],exp:ex}}
    }finally{clearTimeout(tm)}
    try{
      /* 書きかえの決まり：危険の答えは、届いた順に関係なく（古いリクエストの答えでも）、問題なし・期限の短い危険を上書きする。
         問題なしは、より新しいリクエストの答えで、しかも期限内の危険がないときだけ上書きする（危険を問題なしで消さない） */
      /* 1つの文で：上限（危険は LK_UNSAFE_MAX・問題なしは危険が LK_CACHE_MAX 未満のときだけ）を数えて入れる。同時に入れても上限をこえない。
         問題なしの行を危険に変えるのも「危険が1つ増える」ので上限に数える。もとから危険の行の期限をのばすのは上限に関係なく入れる */
      const UN=`(SELECT COUNT(*) FROM link_verdicts WHERE verdict='unsafe' AND expires_at>?4)`;
      const ins=await db.prepare(`INSERT INTO link_verdicts(h,verdict,types,checked_at,expires_at) SELECT ?1,?2,?3,?4,?5
        WHERE ${UN}<(CASE WHEN ?2='unsafe' THEN ?6 ELSE ?7 END) OR EXISTS(SELECT 1 FROM link_verdicts WHERE h=?1 AND ((verdict='unsafe' AND expires_at>?4) OR ?2='clean'))
        ON CONFLICT(h) DO UPDATE SET verdict=excluded.verdict,types=excluded.types,checked_at=excluded.checked_at,expires_at=excluded.expires_at
        WHERE (excluded.verdict='unsafe' AND (link_verdicts.verdict<>'unsafe' OR link_verdicts.expires_at<excluded.expires_at)
            AND ((link_verdicts.verdict='unsafe' AND link_verdicts.expires_at>excluded.checked_at) OR ${UN}<?6))
          OR (excluded.verdict='clean' AND excluded.checked_at>=link_verdicts.checked_at AND NOT(link_verdicts.verdict='unsafe' AND link_verdicts.expires_at>excluded.checked_at))
        RETURNING verdict`).bind(h,res.v,res.types.join(','),now,res.exp,LK_UNSAFE_MAX,LK_CACHE_MAX).first();
      if(res.v==='unsafe'){
        /* 覚えに入らなかった危険（上限）：上限の印を立てる（閉じる）。どの場合も、同じ行き先の投稿のリンクには危険と書く */
        const kept=ins||await db.prepare(`SELECT 1 AS x FROM link_verdicts WHERE h=? AND verdict='unsafe' AND expires_at>=?`).bind(h,res.exp).first();
        await db.batch([lkMarkVhUnsafe(db,h,now,res.exp),...(kept?[]:[db.prepare(`INSERT INTO link_state(k,v,at,until) VALUES('wr_saturated','unsafe-cache-full',?1,?2) ON CONFLICT(k) DO UPDATE SET at=excluded.at,until=MAX(COALESCE(link_state.until,0),excluded.until)`).bind(now,res.exp)])])}
      /* 上限：期限の切れた行と、古い「問題なし」だけを消す（期限内の「危険」は消さない） */
      await db.batch([db.prepare(`DELETE FROM link_verdicts WHERE expires_at<=?`).bind(now),
        db.prepare(`DELETE FROM link_verdicts WHERE verdict='clean' AND h IN (SELECT h FROM link_verdicts WHERE verdict='clean' ORDER BY checked_at DESC,h LIMIT -1 OFFSET MAX(0,${LK_CACHE_MAX}-(SELECT COUNT(*) FROM link_verdicts WHERE verdict='unsafe')))`)]);
      if(res.v==='clean'){const c2=await db.prepare(`SELECT verdict,types,expires_at FROM link_verdicts WHERE h=?`).bind(h).first();
        if(c2&&c2.verdict==='unsafe'&&c2.expires_at>now)return{v:'unsafe',types:c2.types?c2.types.split(','):[],exp:c2.expires_at,h,cached:true}}
    }catch(e){return{v:'error',why:'cache',h}}
    return{...res,h};
  }finally{await lkRelease(db,lease)}
}
async function lkEvent(db,now,o){
  try{await db.prepare(`INSERT INTO link_events(at,uid,note_id,host,h,kind,detail) VALUES(?,?,?,?,?,?,?)`).bind(now,o.uid||null,o.note_id||null,String(o.host||'').slice(0,253),String(o.h||'').slice(0,16),String(o.kind).slice(0,24),String(o.detail||'').slice(0,120)).run()}catch(e){}
}
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
const lkIntent=(body,text)=>(body.url!==undefined&&body.url!==null&&body.url!=='')||/https?:\/\//i.test(String(text||''));
async function lkForNote(env,db,me,uid,body,text,now){
  const has=body.url!==undefined&&body.url!==null&&body.url!=='';
  if(!lkOn(env,'LINKS_POST')){
    if(has)return{error:'いまはリンクを付けられません。',status:400};
    return{text,link:null};
  }
  if(!lkIntent(body,text))return{text,link:null};
  if(!await lkSlot(db,uid,now))return{error:LK_SLOT_MSG,code:'slot',status:429};
  if(has&&typeof body.url!=='string')return{error:LK_ERR.type,code:'type',status:400};
  const fromT=lkFromText(text);
  if(has&&(fromT.url||fromT.error))return{error:LK_ERR.dup,code:'dup',status:400};
  if(fromT.error)return{error:fromT.error,code:fromT.code,status:400};
  const raw=has?body.url:fromT.url;
  if(!raw)return{text,link:null};
  const rest=has?text:fromT.text;
  const kr=emailKeyring(env);
  if(!lkOn(env,'SANCTIONS_ON')||kr.err||!kr.cur)return{error:'いまリンク付きの投稿は準備中です。',status:503};
  if(!me.email||!me.emailVerified)return{error:'メールアドレスを確認したアカウントだけがリンクを投稿できます。',status:403};
  const hs=await emailHashes(env,me.email);if(!hs.length)return{error:'メールアドレスを確認したアカウントだけがリンクを投稿できます。',status:403};
  if(!await emailLink(db,uid,hs,now))return{error:'いまリンク付きの投稿は準備中です。',status:503};
  const v=lkValidate(raw);
  if(v.error){await lkEvent(db,now,{uid,kind:'reject_syntax',detail:v.code});return{error:v.error,code:v.code,status:400}}
  if(rest&&ngCheck(rest))return/リンク/.test(ngCheck(rest))?{error:LK_ERR.bare,code:'bare',status:400}:{error:ngCheck(rest),code:'ng',status:400};
  return{text:rest,link:v};
}
async function lkCheckForNote(env,db,uid,link,now){
  const t=await lkThreat(env,db,link.check,now);
  if(t.v==='clean')return{ok:true,t};
  if(t.v==='unsafe'){await lkEvent(db,now,{uid,host:link.host,h:t.h,kind:'reject_unsafe',detail:t.types.join(',')});
    return{error:'このリンクは安全確認で危険の可能性があると判定されたため、付けられません。',status:400}}
  await lkEvent(db,now,{uid,host:link.host,h:t.h,kind:'check_error',detail:t.why});
  return{error:LK_THREAT_MSG[t.why]||'リンクの安全確認ができませんでした。リンクを外すか、時間をおいてください。',status:503};
}
function lkOut(r,click){
  if(!r||!r.ulink)return null;
  let a;try{a=JSON.parse(r.ulink)}catch(e){return null}
  if(!Array.isArray(a)||typeof a[0]!=='string')return null;
  const v=a[2]==='ok'?lkValidate(a[0]):null;
  if(!v||v.error)return{state:'blocked'};
  return{host:v.host,state:click?'ok':'off'};
}
async function lkReported(env,db,id,now){
  try{const l=await db.prepare(`SELECT note_id,uid,url,host,state,verdict_at,rev,vh FROM note_links WHERE note_id=?`).bind(id).first();
    if(!l||l.state!=='ok'||(l.verdict_at||0)>now-10*60e3)return;
    await lkRecheck(env,db,l,now,'report')}catch(e){}
}
/* 確かめ直す。書くのは、確かめる前に読んだ rev のままで状態が ok のときだけ */
async function lkRecheck(env,db,l,now,why){
  const v=lkValidate(l.url);
  if(v.error){await db.prepare(`UPDATE note_links SET state='removed',rev=rev+1,updated_at=? WHERE note_id=? AND rev=?`).bind(now,l.note_id,l.rev).run();await lkEvent(db,now,{uid:l.uid,note_id:l.note_id,host:l.host,kind:'invalid',detail:v.code});return{v:'removed'}}
  const t=await lkThreat(env,db,v.check,now,{fresh:why==='report'||why==='admin'});
  let ch=0;
  if(t.v==='clean')ch=(await db.prepare(`UPDATE note_links SET verdict='clean',verdict_at=?,expires_at=?,updated_at=?,vh=?,pol=? WHERE note_id=? AND rev=? AND state='ok'`).bind(now,t.exp,now,t.h,LK_POLICY,l.note_id,l.rev).run()).meta.changes;
  else if(t.v==='unsafe'){ch=(await lkMarkUnsafe(db,l.note_id,l.rev,now,t.exp,t.h)).meta.changes;
    await lkEvent(db,now,{uid:l.uid,note_id:l.note_id,host:l.host,h:t.h,kind:'recheck_unsafe',detail:(why+':'+t.types.join(',')).slice(0,120)})}
  else await lkEvent(db,now,{uid:l.uid,note_id:l.note_id,host:l.host,h:t.h,kind:'check_error',detail:why+':'+t.why});
  return{...t,stale:!ch};
}
const lkMarkUnsafe=(db,id,rev,now,exp,h)=>db.prepare(`UPDATE note_links SET state='unsafe',verdict='unsafe',verdict_at=?,expires_at=?,updated_at=?,rev=rev+1,vh=COALESCE(?,vh) WHERE note_id=? AND rev=? AND state='ok'`).bind(now,exp,now,h||null,id,rev).run();
async function lkAdminWho(env,ip){return 'adm:'+(await sha(ip+'|lkadm|'+(env.ADMIN_TOKEN||''))).slice(0,12)}
const ADM_NG=J=>J({error:'管理用の合言葉が違います。'},401);
const admReason=(r,n=4)=>{const s=clean(r,400);return s.length>=n?s:null};
function jstAddMonths(ms,mo){
  const J=9*3600e3,d=new Date(ms+J),y=d.getUTCFullYear(),m=d.getUTCMonth()+mo;
  const ty=y+Math.floor(m/12),tm=((m%12)+12)%12,last=new Date(Date.UTC(ty,tm+1,0)).getUTCDate();
  return Date.UTC(ty,tm,Math.min(d.getUTCDate(),last),d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds(),d.getUTCMilliseconds())-J;
}
/* 根拠（このサイトの記録）の SQL。その人のものか確かめる。IP アドレス・端末の情報は根拠の種類に無い */
const CASE_REF_SQL={note:`SELECT 1 FROM notes WHERE id=? AND uid=?`,link:`SELECT 1 FROM note_links WHERE note_id=? AND uid=?`,link_event:`SELECT 1 FROM link_events WHERE id=? AND uid=?`,
  report:`SELECT 1 FROM reports rp JOIN notes n ON n.id=rp.target WHERE rp.id=? AND rp.kind='note' AND n.uid=?`};
function caseRefsShape(refs){
  if(!Array.isArray(refs)||refs.length<1||refs.length>10)return null;
  const out=[];
  for(const r of refs){if(!r||typeof r!=='object'||!CASE_REF_SQL[r.t]||!Number.isInteger(r.id)||r.id<1)return null;out.push({t:r.t,id:r.id})}
  return out;
}
/* 根拠がすべてある・その人のものか（いまの状態で） */
function caseRefsCond(refs,uid){const sql=[],b=[];for(const r of refs){sql.push(`EXISTS(${CASE_REF_SQL[r.t]})`);b.push(r.id,uid)}return{sql:sql.join(' AND '),b}}
const CASE_EK=['direct','linkage'];
/* つながりの根拠として認めるもの（運営者が確かめたもの）と、それだけでは認めないもの */
const CASE_LB=['self_admitted','evasion_after_sanction','coordinated_reviewed'],CASE_LB_NG=['shared_url','ip','device','report','scanner'];
/* その人自身の違反のリンク：運営者が確かめて止めた（quarantined）この人のリンク。安全確認の結果（unsafe）だけでは、その人の意図の根拠にしない */
function directCond(refs){const a=refs.filter(r=>r.t==='link').map(r=>r.id);if(!a.length)return null;
  return{sql:`EXISTS(SELECT 1 FROM note_links WHERE note_id IN (${a.map(()=>'?').join(',')}) AND state='quarantined')`,b:a}}
/* 確かめた人の名前（運営者の合言葉は共有なので、だれが確かめたかを本人が書く。合言葉と接続元から作った番号もいっしょに残す） */
/* 確かめた人：運営者の合言葉は1つ（ADMIN_TOKEN）なので、名前は送った人の申告でしかない。Cloudflare の変数 ADMIN_REVIEWER があればサーバーが決める（owner:〜、送った名前は使わない）。
   なければ申告として self:〜 と印を付けて残す（本人確認ではないことを記録に残す。運営者が1人の間だけの決まり。runbook §5） */
const admReviewer=(env,r)=>{const o=clean(String(env&&env.ADMIN_REVIEWER||''),40);if(o.length>=2)return'owner:'+o;const s=clean(r,40);return s.length>=2?'self:'+s:null};
/* 根拠に入っている自動の印（安全確認・通報）と運営者の判断（止めたリンク）を分けて残す */
async function caseSignals(db,refs){const out=new Set();
  for(const r of refs){if(r.t==='report')out.add('report');
    if(r.t==='link'){const l=await db.prepare(`SELECT state FROM note_links WHERE note_id=?`).bind(r.id).first();if(l&&l.state==='quarantined')out.add('staff_quarantine');if(l&&l.state==='unsafe')out.add('scanner_unsafe')}}
  return [...out].sort().join(',')}
/* ずっとの停止の理由として認めるもの（安全確認の結果だけでは認めない） */
const PERM_BASIS=['deliberate_attack','proven_evasion'];
/* 関連アカウントの根拠：対象の人のリンクの記録が、もとの攻撃者の確認の記録にあるリンクと同じ行き先（同じ vh）であること */
function linkedRelCond(refs,parentRefs){
  const a=refs.filter(r=>r.t==='link').map(r=>r.id),p=(parentRefs||[]).filter(r=>r.t==='link').map(r=>r.id);
  if(!a.length||!p.length)return null;
  return{sql:`EXISTS(SELECT 1 FROM note_links a JOIN note_links b ON a.vh=b.vh WHERE a.vh IS NOT NULL AND a.note_id IN (${a.map(()=>'?').join(',')}) AND b.note_id IN (${p.map(()=>'?').join(',')}))`,b:[...a,...p]};
}
const lkJSON=s=>{try{return JSON.parse(s)}catch(e){return null}};
/* Firebase アダプター・ブロッキング関数の合言葉（それぞれ別。32文字以上） */
async function fbTokOk(req,env,name,hdr){const t=String(env[name]||'');if(t.length<32)return false;return tokEq(req.headers.get(hdr)||'',t)}
/* ---------- Firebase 側の同期（tools/firebase-adapter、docs/secure-link-posting-runbook.md §6） ---------- */
/* その UID に有効な利用停止の記録があるか（UID の停止・記録した確認済みメールの停止。保留・取り消しは入らない） */
function fbSancSQL(u,t){return `EXISTS(SELECT 1 FROM sanctions s WHERE s.status='active' AND (s.permanent=1 OR s.expires_at>${t}) AND ((s.kind='uid' AND s.uid=${u}) OR (s.kind='email' AND s.ehash IN (SELECT ehash FROM user_emails WHERE uid=${u}))))`}
/* あるべき状態：disabled（止める）／hold（この仕組みが止めたが、手動の停止〔banned=1〕があるので戻さない）／enabled（この仕組みが止めたので戻す）／none（触らない）。
   手動の停止だけの人は Firebase で止めない（前からの決まり）。この仕組みが止めていない人は戻さない（ほかの理由で止まっているかもしれない） */
/* review＝持ち主がはっきりしない（最初は止まっていた→外で戻された→この仕組みが止めた など）。自動では戻さず、運営者が決める（/api/admin/fb/review） */
function fbWantSQL(u,t){return `CASE WHEN ${fbSancSQL(u,t)} THEN 'disabled' WHEN f.review=1 THEN 'review' WHEN f.owned=1 AND EXISTS(SELECT 1 FROM users WHERE uid=${u} AND banned=1) THEN 'hold' WHEN f.owned=1 THEN 'enabled' ELSE 'none' END`}
/* あるべき状態が変わるかもしれない：その UID の行を作るか、番号を上げる（アダプターがもう一度確かめる） */
/* pend_since＝合わせる必要ができた最初の時刻（借りても変えない。いちばん古い待ちを見るため） */
const fbTouchSQL=(sel,cond='1')=>`INSERT INTO fb_sync(uid,gen,created_at,updated_at,pend_since) SELECT x.uid,1,?,?,?2 FROM (${sel}) x WHERE x.uid IS NOT NULL AND x.uid NOT LIKE 'bot:%' AND ${cond}
  ON CONFLICT(uid) DO UPDATE SET pend_since=CASE WHEN fb_sync.done_gen>=fb_sync.gen OR fb_sync.pend_since IS NULL THEN excluded.updated_at ELSE fb_sync.pend_since END,gen=fb_sync.gen+1,next_at=0,updated_at=excluded.updated_at`;
/* 借りる時間は1つのアカウントだけ・60秒（アダプターは外を変える前に毎回のばす。1回の操作は8秒まで） */
const FB_LEASE_MS=60e3,FB_MAX_ATTEMPTS=10,FB_RECHECK_MS=864e5;
const fbMetric=(db,now,k)=>db.prepare(`INSERT INTO fb_metrics(day,k,n) VALUES(?,?,1) ON CONFLICT(day,k) DO UPDATE SET n=n+1`).bind(new Date(now).toISOString().slice(0,10),k);
/* 同じ取引の前の文が、この報告（op＝借りた印）で行を書きかえたときだけ数える（書きかえなかった報告で数字・成功の記録を進めない） */
const fbMetricIf=(db,now,k,uid,op)=>db.prepare(`INSERT INTO fb_metrics(day,k,n) SELECT ?1,?2,1 WHERE EXISTS(SELECT 1 FROM fb_sync WHERE uid=?3 AND last_op=?4) ON CONFLICT(day,k) DO UPDATE SET n=n+1`).bind(new Date(now).toISOString().slice(0,10),k,uid,op);
/* 見た Firebase の状態は、あるべき状態とは別に残す（古い報告でも、外で本当に起きたことの記録になる） */
const fbObsSQL=`obs_disabled=CASE WHEN ?9 IS NULL THEN obs_disabled ELSE ?9 END,obs_at=CASE WHEN ?9 IS NULL THEN obs_at ELSE ?4 END,obs_gen=CASE WHEN ?9 IS NULL THEN obs_gen ELSE ?3 END`;
/* 停止の記録（root）にかかわる UID（その root の UID の停止・その root のメールの停止にかかる人・その root にむすびついた関連アカウント） */
const FB_ROOT_UIDS=`SELECT uid FROM sanctions WHERE kind='uid' AND root_key=? UNION SELECT ue.uid FROM user_emails ue JOIN sanctions e ON e.ehash=ue.ehash WHERE e.kind='email' AND e.root_key=?
  UNION SELECT s.uid FROM sanctions s JOIN sanction_cases c ON c.id=s.case_id WHERE c.related_root=? AND s.kind='uid'`;
/* 失敗のあとの待ち時間：30秒・1分・2分…（6時間まで） */
const fbBackoff=a=>Math.min(6*3600e3,30e3*Math.pow(2,Math.max(0,a-1)));
/* ---------- API ---------- */
async function linksApi(req,env,db,path,u,body,now,ip,isAdmin){
  if(!/^\/api\/(links|fb|admin\/links|admin\/sanctions|admin\/cases|admin\/fb)(\/|$)/.test(path))return null;
  await socialInit(db);await linksInit(db);
  let m;
  if(path==='/api/links/config'&&req.method==='GET'){const kr=emailKeyring(env);
    return J({post:lkOn(env,'LINKS_POST')&&lkOn(env,'SANCTIONS_ON')&&!kr.err&&!!kr.cur&&!!env.WEBRISK_API_KEY,click:lkOn(env,'LINKS_CLICK')})}
  /* ---- Firebase アダプター（tools/firebase-adapter、FB_ADAPTER_TOKEN）・ブロッキング関数（tools/firebase-blocking、FB_HOOK_TOKEN） ----
     アダプターの手順（UID ごと）：claim（借りる。あるべき状態を D1 から決めて返す）→ Firebase の今の状態を読む →
     intent（外を変える前に、最初の状態と、これからすることを記録。戻すときはここで停止がないことを確かめ直す）→ Firebase を変える → 読み直して確かめる → ack。
     どの報告も、借りたときの印（lease）と番号（gen）が合うときだけ受ける（ほかのアダプター・古い報告を断る）。D1 と Firebase は1つの取引にできない：
     intent と ack のあいだに停止が変わると、一度だけ古い向きに変わることがある（番号が進むので次の回に直す。そのあいだもサイトの門は止める） */
  /* 環境の確かめ（アダプターが外を変える前に、つないだ Worker の環境とプロジェクトを確かめる。合言葉が要る。値は設定の名前だけ） */
  if(path==='/api/fb/env'&&req.method==='GET'){
    if(!await fbTokOk(req,env,'FB_ADAPTER_TOKEN','x-fb-adapter-token'))return J({error:'見つかりません。'},404);
    return J({env:String(env.FB_ENV_ID||''),project:String(env.FIREBASE_PROJECT_ID||'')});
  }
  /* 1回に1つのアカウントだけを借りる（必要になった直前に）。job_runs の fb_adapter は動いた印（成功ではない）。成功は fb_sync_ok */
  if(path==='/api/fb/claim'&&req.method==='POST'){
    if(!await fbTokOk(req,env,'FB_ADAPTER_TOKEN','x-fb-adapter-token'))return J({error:'見つかりません。'},404);
    const lease=rndHex(16),skip=Array.isArray(body.skip)?body.skip.filter(x=>typeof x==='string').slice(0,50):[];
    await db.prepare(`INSERT INTO job_runs(name,last_at,last_ok,ok_at,fails) VALUES('fb_adapter',?1,1,?1,0) ON CONFLICT(name) DO UPDATE SET last_at=?1,last_ok=1,ok_at=?1`).bind(now).run();
    /* 止める/戻す記録（intent）のあと報告がないまま借りる時間が切れた回は、結果が分からない操作（crash）として1つずつ残す（運営者に見せる。そのあとの回の読み直しでは消さない） */
    await db.prepare(`INSERT OR IGNORE INTO fb_ops(op,uid,gen,intent,kind,at) SELECT lease,uid,intent_gen,intent,'crash',?1 FROM fb_sync WHERE lease IS NOT NULL AND lease_until<=?1 AND intent IS NOT NULL AND intent_at>=lease_until-${FB_LEASE_MS}*20`).bind(now).run();
    const x=await db.prepare(`UPDATE fb_sync SET lease=?1,lease_until=?2,updated_at=?3 WHERE uid=(SELECT uid FROM fb_sync WHERE dead=0 AND next_at<=?3 AND lease_until<=?3
        AND NOT EXISTS(SELECT 1 FROM fb_ops o WHERE o.uid=fb_sync.uid AND o.kind='timeout' AND o.resolved_at IS NULL)
        AND (done_gen<gen OR checked_at IS NULL OR checked_at<?4)${skip.length?` AND uid NOT IN (${skip.map((_,i)=>'?'+(i+5)).join(',')})`:''} ORDER BY (done_gen<gen) DESC,next_at,uid LIMIT 1) RETURNING uid,gen,owned,prior,attempts,lease_until,review`)
      .bind(lease,now+FB_LEASE_MS,now,now-FB_RECHECK_MS,...skip).first();
    if(!x)return J({items:[],lease_ms:FB_LEASE_MS});
    const w=await db.prepare(`SELECT ${fbWantSQL('f.uid','?2')} AS want FROM fb_sync f WHERE f.uid=?1`).bind(x.uid,now).first();
    return J({items:[{uid:x.uid,gen:x.gen,lease,lease_until:x.lease_until,want:w?w.want:'none',owned:!!x.owned,prior:x.prior==null?null:!!x.prior,attempts:x.attempts}],lease_ms:FB_LEASE_MS});
  }
  /* 借りている時間をのばす（まだ借りていて、期限が切れていないときだけ） */
  if(path==='/api/fb/renew'&&req.method==='POST'){
    if(!await fbTokOk(req,env,'FB_ADAPTER_TOKEN','x-fb-adapter-token'))return J({error:'見つかりません。'},404);
    const uid=typeof body.uid==='string'?body.uid:'',lease=typeof body.lease==='string'?body.lease:'',gen=Number.isInteger(body.gen)?body.gen:-1;
    const r=await db.prepare(`UPDATE fb_sync SET lease_until=?4,updated_at=?3 WHERE uid=?1 AND lease=?2 AND lease_until>?3 AND gen=?5 RETURNING lease_until`).bind(uid,lease,now,now+FB_LEASE_MS,gen).first();
    if(!r){const c=await db.prepare(`SELECT gen,lease,lease_until FROM fb_sync WHERE uid=?`).bind(uid).first();
      /* まだ借りているが、あるべき状態が変わった（取り消し・新しい停止など）：この回の仕事はやめ、ack(superseded) で見た状態を残して、すぐ確かめ直す */
      return J({error:'借りていないか、状態が変わりました。',stale:true,superseded:!!(c&&c.lease===lease&&c.lease_until>now&&c.gen!==gen)},409)}
    return J({ok:true,lease_until:r.lease_until});
  }
  if(path==='/api/fb/intent'&&req.method==='POST'){
    if(!await fbTokOk(req,env,'FB_ADAPTER_TOKEN','x-fb-adapter-token'))return J({error:'見つかりません。'},404);
    const uid=typeof body.uid==='string'?body.uid:'',lease=typeof body.lease==='string'?body.lease:'',gen=Number.isInteger(body.gen)?body.gen:-1,act=String(body.action||''),obs=body.observed_disabled;
    if(!uid||!lease||gen<0||!['disable','enable'].includes(act)||typeof obs!=='boolean')return J({error:'形が正しくありません。'},400);
    const own=`lease=?2 AND lease_until>?4 AND gen=?3`;
    let r;
    if(act==='disable')
      /* 止める前：まだ見ていなければ最初の状態を記録し、止まっていなかったときだけ「この仕組みが止めた」にする（失敗してやり直しても最初の記録は変えない）。
         最初は止まっていた（prior=1・この仕組みのものではない）のに、いま外で戻されていて、この仕組みが止める：この仕組みが止めたことにするが、持ち主がはっきりしないので review（自動では戻さない） */
      r=await db.prepare(`UPDATE fb_sync SET review=CASE WHEN owned=0 AND prior=1 AND ?5=0 THEN 1 ELSE review END,review_why=CASE WHEN owned=0 AND prior=1 AND ?5=0 THEN 'prior_disabled_then_enabled' ELSE review_why END,
        owned=CASE WHEN owned=1 THEN 1 WHEN prior IS NULL AND ?5=0 THEN 1 WHEN prior=1 AND ?5=0 THEN 1 ELSE owned END,prior=CASE WHEN owned=1 OR prior IS NOT NULL THEN prior ELSE ?5 END,
        obs_disabled=?5,obs_at=?4,obs_gen=?3,intent='disable',intent_gen=?3,intent_at=?4,updated_at=?4 WHERE uid=?1 AND ${own} AND ${fbSancSQL('?1','?4')} RETURNING owned,prior,review`).bind(uid,lease,gen,now,obs?1:0).first();
    else
      /* 戻す直前：この仕組みが止めた・最初は止まっていなかった・持ち主がはっきりしている・いま有効な停止も手動の停止もない、をこの文の中で確かめる */
      r=await db.prepare(`UPDATE fb_sync SET obs_disabled=?5,obs_at=?4,obs_gen=?3,intent='enable',intent_gen=?3,intent_at=?4,updated_at=?4 WHERE uid=?1 AND ${own} AND owned=1 AND COALESCE(prior,0)=0 AND review=0
        AND NOT ${fbSancSQL('?1','?4')} AND NOT EXISTS(SELECT 1 FROM users WHERE uid=?1 AND banned=1) RETURNING owned,prior,review`).bind(uid,lease,gen,now,obs?1:0).first();
    if(!r){await db.batch([db.prepare(`UPDATE fb_sync SET lease=NULL,lease_until=0,next_at=0 WHERE uid=? AND lease=?`).bind(uid,lease),fbMetric(db,now,'stale')]);return J({error:'状態が変わりました。',stale:true},409)}
    return J({ok:true,owned:!!r.owned,prior:r.prior==null?null:!!r.prior,review:!!r.review});
  }
  /* 報告。いま借りていて期限内・番号が合う ときだけ「終えた」にする。期限切れ・ほかが借りた・古い番号の報告は「終えた」にしないが、見た Firebase の状態は残し、すぐ確かめ直す。
     返事が届かずにもう一度送った同じ報告（すでに同じ番号まで終えた）は ok（repeat）。持ち主の記録は、戻したと確かめたときだけ消す */
  if(path==='/api/fb/ack'&&req.method==='POST'){
    if(!await fbTokOk(req,env,'FB_ADAPTER_TOKEN','x-fb-adapter-token'))return J({error:'見つかりません。'},404);
    const uid=typeof body.uid==='string'?body.uid:'',lease=typeof body.lease==='string'?body.lease:'',gen=Number.isInteger(body.gen)?body.gen:-1,res=String(body.result||''),want=String(body.want||'');
    if(!uid||!lease||gen<0||!['done','failed','superseded'].includes(res)||!['disabled','enabled','hold','none','missing','review'].includes(want))return J({error:'形が正しくありません。'},400);
    const obs=typeof body.observed_disabled==='boolean'?(body.observed_disabled?1:0):null;
    const cur=await db.prepare(`SELECT gen,done_gen,lease,lease_until,intent,intent_gen,owned,attempts FROM fb_sync WHERE uid=?`).bind(uid).first();
    if(!cur)return J({error:'見つかりません。'},404);
    if(cur.lease!==lease||!(cur.lease_until>now)){
      if(res==='done'&&cur.lease!==lease&&cur.done_gen>=gen){await fbMetric(db,now,'lost').run();return J({ok:true,repeat:true})}
      await db.batch([db.prepare(`UPDATE fb_sync SET ${fbObsSQL},next_at=0,lease=CASE WHEN lease=?2 THEN NULL ELSE lease END,lease_until=CASE WHEN lease=?2 THEN 0 ELSE lease_until END,updated_at=?4 WHERE uid=?1`).bind(uid,lease,gen,now,null,null,null,null,obs),fbMetric(db,now,'stale')]);
      return J({error:'古い報告です（借りる時間が切れたか、ほかが借りています）。見た状態は残しました。',stale:true,recorded:obs!==null},409)}
    /* あるべき状態が途中で変わった：失敗には数えず、見た状態を残して借りている印を返し、すぐ確かめ直す（持ち主の記録は変えない） */
    if(res==='superseded'){
      await db.batch([db.prepare(`UPDATE fb_sync SET lease=NULL,lease_until=0,next_at=0,last_op=?2,${fbObsSQL},updated_at=?4 WHERE uid=?1 AND lease=?2`).bind(uid,lease,gen,now,null,null,null,null,obs),fbMetricIf(db,now,'superseded',uid,lease)]);
      return J({ok:true,superseded:true})}
    if(res==='failed'){
      const unk=body.unknown===true?1:0;
      const out=await db.batch([db.prepare(`UPDATE fb_sync SET attempts=attempts+1,last_error=?5,next_at=?4+?6,unknown=CASE WHEN ?7=1 THEN 1 ELSE unknown END,unk_intent=CASE WHEN ?7=1 THEN intent ELSE unk_intent END,unk_op=CASE WHEN ?7=1 THEN ?2 ELSE unk_op END,last_op=?2,dead=CASE WHEN attempts+1>=${FB_MAX_ATTEMPTS} THEN 1 ELSE 0 END,lease=NULL,lease_until=0,${fbObsSQL},updated_at=?4
        WHERE uid=?1 AND lease=?2 RETURNING dead,attempts`).bind(uid,lease,gen,now,String(body.error||'error').replace(/[^\w./:-]/g,'').slice(0,80),fbBackoff(cur.attempts+1),unk,null,obs),
        fbMetricIf(db,now,unk?'unknown':'failed',uid,lease),
        ...(unk?[db.prepare(`INSERT OR IGNORE INTO fb_ops(op,uid,gen,intent,kind,at) SELECT ?1,uid,?3,?4,'timeout',?2 FROM fb_sync WHERE uid=?5 AND last_op=?1`).bind(lease,now,gen,cur.intent,uid)]:[])]);
      const r=out[0].results&&out[0].results[0];
      return J({ok:true,dead:!!(r&&r.dead),attempts:r&&r.attempts})}
    /* 終わった：止めた/戻したなら、Firebase を読み直して確かめた結果（observed_disabled）と、止めたならログインの印を取り消したこと（revoked）が要る */
    if(want==='disabled'&&(obs!==1||body.revoked!==true||cur.intent!=='disable'||cur.intent_gen!==gen))return J({error:'止めたことを確かめられていません。'},400);
    if(want==='enabled'&&(obs!==0||cur.intent!=='enable'||cur.intent_gen!==gen))return J({error:'戻したことを確かめられていません。'},400);
    /* 結果が分からない呼び出し（unknown）は、ここでは片づけない：遅れて終わるかもしれないので、それを待って読み直した observe で片づける */
    const out=await db.batch([db.prepare(`UPDATE fb_sync SET done_gen=MAX(done_gen,?3),checked_at=?4,attempts=0,next_at=0,last_error=NULL,intent=NULL,intent_gen=NULL,lease=NULL,lease_until=0,last_want=?5,
      owned=CASE WHEN ?5 IN ('enabled','missing') THEN 0 ELSE owned END,prior=CASE WHEN ?5 IN ('enabled','missing') THEN NULL ELSE prior END,
      pend_since=NULL,last_op=?2,${fbObsSQL},updated_at=?4
      WHERE uid=?1 AND lease=?2 AND lease_until>?4 AND gen=?3 RETURNING done_gen,gen`).bind(uid,lease,gen,now,want,null,null,null,obs),
      fbMetricIf(db,now,'done',uid,lease),
      db.prepare(`INSERT INTO job_runs(name,last_at,last_ok,ok_at,fails) SELECT 'fb_sync_ok',?1,1,?1,0 WHERE EXISTS(SELECT 1 FROM fb_sync WHERE uid=?2 AND last_op=?3) ON CONFLICT(name) DO UPDATE SET last_at=?1,last_ok=1,ok_at=?1`).bind(now,uid,lease)]);
    const r=out[0].results&&out[0].results[0];
    if(!r){
      /* 番号が進んでいた（あるべき状態が途中で変わった）：終えたことにせず、見た状態だけ残して superseded にする */
      const s2=await db.batch([db.prepare(`UPDATE fb_sync SET lease=NULL,lease_until=0,next_at=0,last_op=?2,${fbObsSQL},updated_at=?4 WHERE uid=?1 AND lease=?2 AND lease_until>?4 AND gen<>?3`).bind(uid,lease,gen,now,null,null,null,null,obs),fbMetricIf(db,now,'superseded',uid,lease)]);
      if(s2[0].meta&&s2[0].meta.changes)return J({ok:true,superseded:true});
      return J({error:'古い報告です。',stale:true},409)}
    return J({ok:true,more:r.gen>r.done_gen});
  }
  /* 見た状態だけを残す（時間切れのあとで Firebase の操作が遅れて終わったかもしれないとき、あとで読み直した結果）。終えたことにはしない・持ち主は変えない・すぐ確かめ直す */
  if(path==='/api/fb/observe'&&req.method==='POST'){
    if(!await fbTokOk(req,env,'FB_ADAPTER_TOKEN','x-fb-adapter-token'))return J({error:'見つかりません。'},404);
    const uid=typeof body.uid==='string'?body.uid:'',op=typeof body.op==='string'?body.op:'';
    if(!uid||!op||typeof body.observed_disabled!=='boolean')return J({error:'形が正しくありません。'},400);
    /* 片づけるのは、その op の「結果が分からない」操作の記録（fb_ops）1つだけ。ほかの op・すでに片づいた op・記録のない op は、見た状態だけを残す（持ち主を推しはからない） */
    const ob=body.observed_disabled?1:0;
    const op1=await db.prepare(`UPDATE fb_ops SET resolved_at=?3,obs=?4,how='observe' WHERE op=?1 AND uid=?2 AND resolved_at IS NULL RETURNING intent,kind`).bind(op,uid,now,ob).first();
    if(!op1){const m0=await db.prepare(`UPDATE fb_sync SET obs_disabled=?2,obs_at=?3,next_at=CASE WHEN lease_until>?3 THEN next_at ELSE 0 END,updated_at=?3 WHERE uid=?1 RETURNING uid`).bind(uid,ob,now).first();
      return m0?J({ok:true,recorded_only:true}):J({error:'見つかりません。'},404)}
    /* その操作が「止める」で、読み直すと止まっていた：この仕組みが止めたことにする（持ち主を失わない）。まだ片づいていない操作が残っていれば unknown のまま。
       どの場合も番号を上げて、すぐ今のあるべき状態に合わせ直す（遅れて終わった呼び出しが、あとから合わせた状態をくつがえしたかもしれないため） */
    /* settled＝アダプターが見た、その操作の Firebase を変える呼び出しの本当の終わり方（ok＝遅れて成功・error＝失敗・none＝変える呼び出しは時間切れではなかった）。
       止める操作が遅れて成功し、止まっている＝この仕組みが止めた。止まっているのに、止める呼び出しが成功していない＝ほかの人が外で止めた可能性：持ち主を推しはからず review（運営者が決める） */
    const st=['ok','error','none'].includes(body.settled)?body.settled:'none';
    const own=op1.intent==='disable'&&ob===1&&st==='ok'?1:0,amb=op1.intent==='disable'&&ob===1&&st!=='ok'?1:0;
    const r=await db.prepare(`UPDATE fb_sync SET obs_disabled=?2,obs_at=?3,
      owned=CASE WHEN ?4=1 THEN 1 ELSE owned END,prior=CASE WHEN ?4=1 AND prior IS NULL THEN 0 ELSE prior END,
      review=CASE WHEN ?5=1 AND owned=0 THEN 1 ELSE review END,review_why=CASE WHEN ?5=1 AND owned=0 THEN 'disabled_outside_unknown' ELSE review_why END,
      unknown=CASE WHEN EXISTS(SELECT 1 FROM fb_ops o WHERE o.uid=?1 AND o.kind='timeout' AND o.resolved_at IS NULL) THEN 1 ELSE 0 END,unk_intent=NULL,unk_op=NULL,
      gen=gen+1,pend_since=COALESCE(pend_since,?3),next_at=CASE WHEN lease_until>?3 THEN next_at ELSE 0 END,updated_at=?3 WHERE uid=?1 RETURNING uid,unknown`).bind(uid,ob,now,own,amb).first();
    return r?J({ok:true,still_unknown:!!r.unknown}):J({error:'見つかりません。'},404);
  }
  if(path==='/api/fb/check'&&req.method==='POST'){
    /* ブロッキング関数から：その UID か確認済みメールに有効な停止があるか。答えは deny と、この Worker の環境の名前（FB_ENV_ID）だけ（理由・記録の中身は返さない）。メールは保存も記録もしない */
    if(!await fbTokOk(req,env,'FB_HOOK_TOKEN','x-fb-hook-token'))return J({error:'見つかりません。'},404);
    const uid=typeof body.uid==='string'?body.uid.slice(0,128):'';
    try{const st=await sanctionState(db,env,uid,typeof body.email==='string'?body.email:null,body.email_verified===true,now);return J({deny:!!st.deny,env:String(env.FB_ENV_ID||'')})}
    catch(e){return J({error:'unavailable'},503)}
  }
  /* 押したとき（2段階） */
  if((m=path.match(/^\/api\/links\/(\d+)\/(open|go)$/))&&req.method==='POST'){
    if(!lkOn(env,'LINKS_CLICK'))return J({error:'いまリンクは開けません。',inert:true},403);
    const id=+m[1],go=m[2]==='go';
    const me=fbPid(env)?await authOf(req,env):null;
    const meRow=me?await db.prepare(`SELECT uid,banned FROM users WHERE uid=?`).bind(me.uid).first():null;
    const meUid=meRow&&!meRow.banned?meRow.uid:'';
    const who=meUid?'u:'+meUid:'ip:'+(await sha(ip+'|lkc|'+(env.APP_TOKEN||''))).slice(0,20);
    const ok=await db.prepare(`INSERT INTO link_clicks(who,at) SELECT ?1,?2 WHERE (SELECT COUNT(*) FROM link_clicks WHERE who=?1 AND at>?2-3600000)<120 RETURNING at`).bind(who,now).first();
    if(!ok)return J({error:'短い時間にリンクを開きすぎです。少し時間をおいてください。'},429);
    const INERT=J({error:'このリンクは開けません（安全確認または運営者の確認により止めています）。',inert:true},410);
    /* 見られる投稿のリンクと、同じ行き先の共有の答え（危険）を、1つの問い合わせで読む。t＝そのときの時刻 */
    /* 危険の覚えが上限のあいだは開かない（出ている許可も） */
    if(await lkSaturated(db,now))return J({error:'いまリンクの安全確認ができないため、開けません。時間をおいてください。',saturated:true},503);
    const snap=t=>db.prepare(`SELECT l.note_id,l.uid,l.url,l.host,l.state,l.rev,l.expires_at,l.verdict_at,l.vh,l.pol,(SELECT v.expires_at FROM link_verdicts v WHERE v.h=l.vh AND v.verdict='unsafe' AND v.expires_at>?3) AS unsafe_exp
      FROM notes n ${NOTE_JOIN} JOIN note_links l ON l.note_id=n.id WHERE n.id=?2 AND n.hidden=0 AND n.repost_of=0 AND ${NOTE_OK}`).bind(meUid,id,t);
    if(go){
      const tok=typeof body.intent==='string'&&/^[0-9a-f]{32}$/.test(body.intent)?body.intent:'';
      if(!tok)return J({error:'確認の画面の期限が切れました。もう一度リンクを押してください。',expired:true},410);
      /* 許可を使い切るのと、いまの状態を読むのを、1つの取引で（同じ時点の中身で比べる）。時刻は答える直前のもの */
      const t=Date.now();
      const [ri,rs,rf]=await db.batch([db.prepare(`UPDATE link_intents SET used=1,used_at=?4 WHERE token=?1 AND note_id=?2 AND who=?3 AND used=0 AND expires_at>?4 AND ${LK_NOSAT} RETURNING rev,pol`).bind(tok,id,who,t),snap(t),
        db.prepare(`SELECT 1 AS x FROM link_state WHERE k='wr_saturated'`)]);
      const it=ri.results&&ri.results[0],l=rs.results&&rs.results[0];
      /* 同じ取引の中で上限の印があった：許可は使わずに閉じる（印が外れたら、もう一度押せば開ける） */
      if(rf.results&&rf.results[0])return J({error:'いまリンクの安全確認ができないため、開けません。時間をおいてください。',saturated:true},503);
      if(!it)return J({error:'確認の画面の期限が切れました。もう一度リンクを押してください。',expired:true},410);
      if(!l)return J({error:'投稿が見つかりません（削除された可能性があります）。'},404);
      if(l.unsafe_exp){await lkMarkUnsafe(db,id,l.rev,t,l.unsafe_exp,l.vh);return INERT}
      if(l.state!=='ok'||l.rev!==it.rev||lkValidate(l.url).error)return INERT;
      /* 方針の版が変わった（許可も投稿の答えも前の版）：もう一度押してもらう（開き直すと今の版で確かめ直す） */
      if(it.pol!==LK_POLICY||l.pol!==LK_POLICY)return J({error:'安全確認の決まりが新しくなりました。もう一度リンクを押してください。',expired:true},410);
      if(!(l.expires_at>t))return J({error:'安全確認の期限が切れました。もう一度リンクを押してください。',expired:true},410);
      return J({ok:true,url:l.url,host:l.host});
    }
    let l=await snap(now).first();
    if(!l)return J({error:'投稿が見つかりません（削除された可能性があります）。'},404);
    if(l.state!=='ok'||lkValidate(l.url).error)return INERT;
    /* 同じ行き先のほかの投稿で危険と分かっていれば（前の版の鍵で覚えた危険も）、この投稿の期限の前でも止める */
    if(l.unsafe_exp){await lkMarkUnsafe(db,id,l.rev,now,l.unsafe_exp,l.vh);return J({error:'このリンクは安全確認で危険の可能性があると判定されたため、開けません。',inert:true},410)}
    /* 前の版の行（vh がない）・方針の版（LK_POLICY）が変わった行：今の鍵と版にし、問題なしの答えは使わずに確かめ直す（expires_at=0）。rev を上げて前の版の許可を使えなくする */
    {const vh=await lkVh(lkValidate(l.url).check);if(l.vh!==vh||l.pol!==LK_POLICY){
      await db.prepare(`UPDATE note_links SET vh=?,pol=?,expires_at=0,rev=rev+1,updated_at=? WHERE note_id=? AND rev=? AND state='ok'`).bind(vh,LK_POLICY,now,id,l.rev).run();
      l=await snap(now).first();if(!l)return J({error:'投稿が見つかりません。'},404);if(l.state!=='ok')return INERT}}
    if(l.unsafe_exp){await lkMarkUnsafe(db,id,l.rev,now,l.unsafe_exp,l.vh);return J({error:'このリンクは安全確認で危険の可能性があると判定されたため、開けません。',inert:true},410)}
    if(!(l.expires_at>now)){const t=await lkRecheck(env,db,l,now,'click');
      if(t.v==='unsafe'||t.v==='removed')return J({error:'このリンクは安全確認で危険の可能性があると判定されたため、開けません。',inert:true},410);
      if(t.v!=='clean')return J({error:'いまリンクの安全確認ができないため、開けません。時間をおいてください。'},503)}
    const t2=Date.now();
    const l2=await snap(t2).first();
    if(!l2)return J({error:'投稿が見つかりません（削除された可能性があります）。'},404);
    if(l2.unsafe_exp||l2.state!=='ok'||l2.rev!==l.rev||!(l2.expires_at>t2))return INERT;
    const token=rndHex(16);
    if(l2.pol!==LK_POLICY)return INERT;
    /* 許可を書く文の中で、上限の印・リンクの状態・rev・方針の版・同じ行き先の危険を確かめ直す（読んでから書くまでに変わっても許可を出さない） */
    const ins=await db.prepare(`INSERT INTO link_intents(token,note_id,who,rev,expires_at,created_at,pol) SELECT ?1,?2,?3,?4,?5,?6,?7 WHERE ${LK_NOSAT}
      AND EXISTS(SELECT 1 FROM note_links l WHERE l.note_id=?2 AND l.state='ok' AND l.rev=?4 AND l.pol=?7 AND l.expires_at>?6 AND NOT EXISTS(SELECT 1 FROM link_verdicts v WHERE v.h=l.vh AND v.verdict='unsafe' AND v.expires_at>?6))`)
      .bind(token,id,who,l2.rev,t2+60e3,t2,LK_POLICY).run();
    if(!ins.meta.changes){if(await db.prepare(`SELECT 1 AS x FROM link_state WHERE k='wr_saturated'`).first())return J({error:'いまリンクの安全確認ができないため、開けません。時間をおいてください。',saturated:true},503);return INERT}
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
    const kr=emailKeyring(env),bd=new Date(now).toISOString().slice(0,10),b={day:bd,month:bd.slice(0,7),dn:((await db.prepare(`SELECT n FROM link_budget_d WHERE day=?`).bind(bd).first())||{n:0}).n,mn:(await db.prepare(`SELECT COALESCE(SUM(n),0) AS n FROM link_budget_d WHERE month=?`).bind(bd.slice(0,7)).first()).n};
    return J({links:r.results,events:ev.results,flags:{post:lkOn(env,'LINKS_POST'),click:lkOn(env,'LINKS_CLICK'),sanctions:lkOn(env,'SANCTIONS_ON'),webrisk:!!env.WEBRISK_API_KEY,emailKey:!kr.err&&!!kr.cur},
      budget:{day:b&&b.day||null,day_used:b?b.dn:0,day_cap:lkDayCap(env),month:b&&b.month||null,month_used:b?b.mn:0,month_cap:lkMonCap(env),tz:'UTC'}});
  }
  if((m=path.match(/^\/api\/admin\/links\/(\d+)$/))&&req.method==='POST'){
    const id=+m[1],act=String(body.action||''),reason=admReason(body.reason);
    if(!['quarantine','restore','recheck'].includes(act))return J({error:'操作を選んでください。'},400);
    if(!reason)return J({error:'理由を4文字以上で書いてください。'},400);
    if(body.confirm!==true)return J({error:'確認のうえで実行してください。'},400);
    const l=await db.prepare(`SELECT note_id,uid,url,host,state,verdict_at,rev,vh FROM note_links WHERE note_id=?`).bind(id).first();
    if(!l)return J({error:'リンクが見つかりません。'},404);
    const who=await lkAdminWho(env,ip);
    let t=null;
    if(act==='quarantine'){await db.batch([db.prepare(`UPDATE note_links SET state='quarantined',rev=rev+1,updated_at=? WHERE note_id=?`).bind(now,id),
        ...(body.hide===true?[db.prepare(`UPDATE notes SET hidden=1 WHERE id=?`).bind(id)]:[])])}
    else{
      if(act==='restore'&&l.state==='removed')return J({error:'形の正しくないリンクは戻せません。'},400);
      const v=lkValidate(l.url);if(v.error)return J({error:'形の正しくないリンクです。'},400);
      /* 期限内の「危険」の覚えがあれば、問い合わせずに危険（戻せない） */
      t=await lkThreat(env,db,v.check,now,{fresh:true});
      if(t.v!=='clean'&&act==='restore')return J({error:t.v==='unsafe'?'安全確認で危険の可能性があると判定されたため、戻せません。':'いま安全確認ができないため、戻せません。',verdict:t.v},409);
      let ch=1;
      if(t.v==='clean')ch=(await db.prepare(`UPDATE note_links SET ${act==='restore'?"state='ok',rev=rev+1,":''}verdict='clean',verdict_at=?,expires_at=?,updated_at=?,vh=?,pol=? WHERE note_id=? AND rev=? AND ${LK_NOSAT}`).bind(now,t.exp,now,t.h,LK_POLICY,id,l.rev).run()).meta.changes;
      if(!ch&&t.v==='clean'&&await db.prepare(`SELECT 1 AS x FROM link_state WHERE k='wr_saturated'`).first())return J({error:'いまリンクの安全確認ができないため、戻せません（危険の覚えが上限です）。',saturated:true},409);
      /* 危険（止める方）は rev に関係なくいつも勝つ（lkThreat が同じ行き先の投稿をもう止めて rev を上げていても、ここで止めたことを書く） */
      else if(t.v==='unsafe')ch=(await db.prepare(`UPDATE note_links SET state=CASE WHEN state='ok' THEN 'unsafe' ELSE state END,rev=rev+1,verdict='unsafe',verdict_at=?,expires_at=MAX(COALESCE(expires_at,0),?),updated_at=?,vh=? WHERE note_id=?`).bind(now,t.exp,now,t.h,id).run()).meta.changes;
      if(!ch)return J({error:'確かめているあいだにリンクの状態が変わりました。もう一度確かめてください。',stale:true},409);
    }
    await lkEvent(db,now,{uid:l.uid,note_id:id,host:l.host,kind:'admin_'+act,detail:who+' '+reason});
    try{await tipsLog(db,env,ip,now,'link_'+act,id,reason)}catch(e){}
    const n=await db.prepare(`SELECT state FROM note_links WHERE note_id=?`).bind(id).first();
    return J({ok:true,state:n&&n.state,verdict:t&&t.v});
  }
  /* Firebase の同期で10回失敗したもの（dead）を、運営者が確かめてからやり直す。ふつうの確かめ直しも同じ（番号を上げるだけ。止める・戻すは D1 の今の状態で決まる） */
  if(path==='/api/admin/fb/replay'&&req.method==='POST'){
    const reason=admReason(body.reason);
    if(!reason)return J({error:'理由を4文字以上で書いてください。'},400);
    if(body.confirm!==true)return J({error:'確認のうえで実行してください。'},400);
    const t=await db.prepare(`SELECT uid FROM users WHERE handle=? COLLATE NOCASE`).bind(String(body.handle||'').replace(/^@/,'')).first();
    if(!t)return J({error:'そのユーザーIDの人が見つかりません。'},404);
    const ex=await db.prepare(`SELECT lease_until FROM fb_sync WHERE uid=?`).bind(t.uid).first();
    if(!ex)return J({error:'この人の Firebase の同期の記録はありません。'},404);
    /* アダプターが借りているあいだはやり直さない（借りている印を消さない） */
    /* 運営者が Firebase の画面などで今の状態を確かめた前提で、結果が分からない操作の記録もここで片づける（how='replay'・消さずに残す） */
    const rb=await db.batch([db.prepare(`UPDATE fb_ops SET resolved_at=?1,how='replay' WHERE uid=?2 AND resolved_at IS NULL AND NOT EXISTS(SELECT 1 FROM fb_sync WHERE uid=?2 AND lease_until>?1)`).bind(now,t.uid),
      db.prepare(`UPDATE fb_sync SET dead=0,attempts=0,next_at=0,last_error=NULL,unknown=0,unk_intent=NULL,unk_op=NULL,gen=gen+1,pend_since=COALESCE(pend_since,?1),updated_at=?1 WHERE uid=?2 AND lease_until<=?1 RETURNING gen`).bind(now,t.uid)]);
    const r=rb[1].results&&rb[1].results[0];
    if(!r)return J({error:'いまアダプターが扱っています。少し待ってからやり直してください。',busy:true},409);
    const who=await lkAdminWho(env,ip);
    try{await tipsLog(db,env,ip,now,'fb_replay',0,who+' '+reason)}catch(e){}
    return J({ok:true,gen:r.gen});
  }
  /* 持ち主がはっきりしない Firebase のアカウント（review）を運営者が決める：enable＝この仕組みが止めたものとして戻してよい／keep＝この仕組みのものにしない（止めたまま・触らない） */
  if(path==='/api/admin/fb/review'&&req.method==='POST'){
    const reason=admReason(body.reason,20),dec=String(body.decision||'');
    if(!['enable','keep'].includes(dec))return J({error:'enable（戻してよい）か keep（触らない）を選んでください。'},400);
    if(!reason)return J({error:'確かめた内容を20文字以上で書いてください。'},400);
    if(body.confirm!==true)return J({error:'確認のうえで実行してください。'},400);
    const t=await db.prepare(`SELECT uid FROM users WHERE handle=? COLLATE NOCASE`).bind(String(body.handle||'').replace(/^@/,'')).first();
    if(!t)return J({error:'そのユーザーIDの人が見つかりません。'},404);
    const r=await db.prepare(`UPDATE fb_sync SET review=0,review_why=NULL,${dec==='keep'?'owned=0,prior=NULL,':'owned=1,prior=0,'}gen=gen+1,next_at=0,pend_since=COALESCE(pend_since,?1),updated_at=?1 WHERE uid=?2 AND review=1 AND lease_until<=?1 RETURNING gen`).bind(now,t.uid).first();
    if(!r)return J({error:'見直しの必要な記録がないか、いまアダプターが扱っています。'},409);
    try{await tipsLog(db,env,ip,now,'fb_review_'+dec,0,(await lkAdminWho(env,ip))+' '+reason)}catch(e){}
    return J({ok:true});
  }
  if(path==='/api/admin/cases'&&req.method==='POST'){
    if(!lkOn(env,'SANCTIONS_ON'))return J({error:'利用停止の記録はまだ使えません（SANCTIONS_ON）。'},503);
    const kind=String(body.kind||''),summary=admReason(body.summary,20);
    if(!['attack','linked'].includes(kind))return J({error:'種類（attack＝意図的な攻撃／linked＝関連アカウント）を選んでください。'},400);
    if(!summary)return J({error:'確かめた内容を20文字以上で書いてください。'},400);
    /* 確かめた人の申し立て（自分で根拠を見て確かめた）と、根拠の種類。direct＝その人自身の違反、linkage＝アカウントどうしのつながり */
    if(body.attest!==true)return J({error:'根拠を自分で確かめたことの申し立て（attest）が要ります。'},400);
    const reviewer=admReviewer(env,body.reviewer);if(!reviewer)return J({error:'確かめた人の名前（reviewer）を書いてください。'},400);
    const ek=Array.isArray(body.evidence_kinds)?[...new Set(body.evidence_kinds.filter(x=>CASE_EK.includes(x)))].sort():[];
    if(!ek.includes('direct'))return J({error:'その人自身の違反の根拠（evidence_kinds に direct）が要ります。'},400);
    let lbasis=null,dsum=null,lsum=null;
    if(kind==='linked'){
      /* 同じ行き先・IP・端末・通報・安全確認の結果だけでは、同じ人・共犯の根拠にしない */
      if(CASE_LB_NG.includes(body.linkage_basis))return J({error:'同じリンク・IP アドレス・端末・通報・安全確認の結果だけでは、関連アカウントの根拠になりません。'},400);
      if(!ek.includes('linkage')||!CASE_LB.includes(body.linkage_basis))return J({error:'つながりの根拠（evidence_kinds に linkage と、linkage_basis＝'+CASE_LB.join('／')+'）が要ります。'},400);
      dsum=admReason(body.direct_summary,20);if(!dsum)return J({error:'その人自身がしたこと（direct_summary）を20文字以上で書いてください。'},400);
      lsum=admReason(body.linkage_summary,20);if(!lsum)return J({error:'つながりを示す、ほかとは別の根拠（linkage_summary）を20文字以上で書いてください。'},400);
      lbasis=body.linkage_basis}
    const t=await db.prepare(`SELECT uid,handle FROM users WHERE handle=? COLLATE NOCASE`).bind(String(body.handle||'').replace(/^@/,'')).first();
    if(!t)return J({error:'そのユーザーIDの人が見つかりません。'},404);
    if(t.uid.startsWith('bot:'))return J({error:'運営のアカウントは対象にできません。'},400);
    const refs=caseRefsShape(body.refs);
    const REFS_ERR='根拠には、その人のこのサイトの記録（投稿・リンク・リンクの記録・通報）を1〜10件指定してください。IP アドレスは根拠にできません。';
    if(!refs)return J({error:REFS_ERR},400);
    const rc=caseRefsCond(refs,t.uid);
    if(!(await db.prepare(`SELECT ${rc.sql} AS ok`).bind(...rc.b).first()).ok)return J({error:REFS_ERR},400);
    let rel=null;
    if(kind==='linked'){rel=String(body.related_root||'');
      const p=rel&&await db.prepare(`SELECT s.uid,c.refs FROM sanctions s LEFT JOIN sanction_cases c ON c.id=s.case_id WHERE s.root_key=? AND s.kind='uid' AND s.source='confirmed_attack' AND s.status='active'`).bind(rel).first();
      if(!p)return J({error:'関連アカウントは、確かめた攻撃者の有効な利用停止（root）を指定してください。'},400);
      if(p.uid===t.uid)return J({error:'同じ人を関連アカウントにはできません。'},400);
      /* ふつうの投稿と、関係のない攻撃者の停止だけでは関連の根拠にならない：同じ行き先のリンク（攻撃者の確認の記録にあるもの）が要る */
      const lc=linkedRelCond(refs,lkJSON(p.refs));
      if(!lc||!(await db.prepare(`SELECT ${lc.sql} AS ok`).bind(...lc.b).first()).ok)return J({error:'関連の根拠には、攻撃者の確認の記録にあるリンクと同じ行き先の、この人のリンクの記録（link）が要ります。'},400);
      /* その人自身の違反：運営者が止めた（quarantined）か、危険と判定された（unsafe）この人のリンクが要る（ふつうに紹介しただけのリンクでは足りない） */
      const dc=directCond(refs);
      if(!dc||!(await db.prepare(`SELECT ${dc.sql} AS ok`).bind(...dc.b).first()).ok)return J({error:'その人自身の違反の根拠として、運営者が確かめて止めた、この人のリンクの記録（link）が要ります（安全確認の結果だけでは足りません）。'},400)}
    const who=await lkAdminWho(env,ip);
    const signals=await caseSignals(db,refs);
    const r=await db.prepare(`INSERT INTO sanction_cases(target_uid,kind,summary,refs,related_root,status,actor,created_at,updated_at,ek,lbasis,dsum,lsum,reviewer,signals) VALUES(?,?,?,?,?,'open',?,?,?,?,?,?,?,?,?) RETURNING id`).bind(t.uid,kind,summary,JSON.stringify(refs),rel,who,now,now,ek.join(','),lbasis,dsum,lsum,reviewer,signals).first();
    return J({ok:true,case_id:r.id});
  }
  if(path==='/api/admin/sanctions'&&req.method==='GET'){
    const r=await db.prepare(`SELECT s.id,s.kind,s.permanent,s.starts_at,s.expires_at,s.reason,s.evidence,s.source,s.actor,s.status,s.appeal,s.root_key,s.case_id,s.created_at,s.updated_at,s.kver,us.handle,
      CASE WHEN s.status='active' AND (s.permanent=1 OR s.expires_at>?1) THEN 1 ELSE 0 END AS live FROM sanctions s LEFT JOIN users us ON us.uid=s.uid ORDER BY s.id DESC LIMIT 200`).bind(now).all();
    const cs=await db.prepare(`SELECT c.id,c.kind,c.summary,c.refs,c.related_root,c.status,c.created_at,us.handle FROM sanction_cases c LEFT JOIN users us ON us.uid=c.target_uid ORDER BY c.id DESC LIMIT 100`).all();
    const cov=await keyCoverage(db,env,now,{ident:true});
    const jr=await db.prepare(`SELECT name,last_at,last_ok,last_err,ok_at,fails FROM job_runs`).all();
    const fb=await db.prepare(`SELECT COUNT(*) AS rows,SUM(CASE WHEN done_gen<gen AND dead=0 THEN 1 ELSE 0 END) AS backlog,SUM(dead) AS dead,MIN(CASE WHEN done_gen<gen AND dead=0 THEN COALESCE(pend_since,created_at) END) AS oldest,SUM(owned) AS owned,SUM(review) AS review,SUM(unknown) AS unknown FROM fb_sync`).first();
    const fa=(jr.results||[]).find(x=>x.name==='fb_adapter'),fo=(jr.results||[]).find(x=>x.name==='fb_sync_ok');
    const fm=(await db.prepare(`SELECT day,k,n FROM fb_metrics WHERE day>=? ORDER BY day`).bind(new Date(now-6*864e5).toISOString().slice(0,10)).all()).results;
    const fbH={rows:fb.rows||0,backlog:fb.backlog||0,dead:fb.dead||0,owned:fb.owned||0,review:fb.review||0,unknown:fb.unknown||0,oldest_pending_since:fb.oldest||null,
      adapter_heartbeat_at:fa?fa.last_at:null,last_success_at:fo?fo.last_at:null,metrics_7d:fm,
      /* 知らせること：10回失敗・持ち主の見直し待ち・結果が分からないもの・1時間以上待っているもの（待ちが始まった時刻で）・アダプターが2時間以上動いていないのに待ちがある・動いているのに2時間以上成功がない */
      alert:(fb.dead||0)>0||(fb.review||0)>0||(fb.unknown||0)>0||(!!fb.oldest&&fb.oldest<now-36e5)||(!!fb.backlog&&(!fa||fa.last_at<now-72e5))||(!!fb.backlog&&!!fa&&fa.last_at>now-72e5&&(!fo||fo.last_at<now-72e5))};
    const dl=await db.prepare(`SELECT f.uid,us.handle,f.attempts,f.last_error,f.updated_at,f.dead,f.review,f.review_why,f.unknown FROM fb_sync f LEFT JOIN users us ON us.uid=f.uid WHERE f.dead=1 OR f.review=1 OR f.unknown=1 ORDER BY f.updated_at DESC LIMIT 50`).all();
    const fops=(await db.prepare(`SELECT o.uid,us.handle,o.kind,o.intent,o.at FROM fb_ops o LEFT JOIN users us ON us.uid=o.uid WHERE o.resolved_at IS NULL ORDER BY o.at DESC LIMIT 50`).all()).results||[];
    fbH.open_ops=fops;if(fops.length)fbH.alert=true;
    const er=(await db.prepare(`SELECT e.uid,us.handle,e.elids,e.at FROM elid_review e LEFT JOIN users us ON us.uid=e.uid ORDER BY e.at DESC LIMIT 50`).all()).results||[];
    const sat=await db.prepare(`SELECT v,at FROM link_state WHERE k='wr_saturated'`).first();
    return J({sanctions:r.results,cases:cs.results,enabled:lkOn(env,'SANCTIONS_ON'),jobs:jr.results,fb_sync:fbH,fb_dead:dl.results,
      reviewer_mode:clean(String(env.ADMIN_REVIEWER||''),40).length>=2?'owner':'self',elid_review:er,link_saturated:sat?{why:sat.v,since:sat.at}:null,
      health:{ok:!cov.err&&!cov.missingTomb.length&&!cov.missingIdent.length&&!er.length,elid_review:er.length,err:cov.err,mismatch_versions:cov.mismatch,current:cov.current,versions:cov.versions,missing_tombstone_versions:cov.missingTomb,missing_identity_versions:cov.missingIdent}});
  }
  if(path==='/api/admin/sanctions'&&req.method==='POST'){
    if(!lkOn(env,'SANCTIONS_ON'))return J({error:'利用停止の記録はまだ使えません（SANCTIONS_ON）。'},503);
    const kind=String(body.kind||''),rationale=admReason(body.rationale,20),cid=Number.isInteger(body.case_id)?body.case_id:0;
    if(!['perpetrator','linked','temporary'].includes(kind))return J({error:'種類を選んでください。'},400);
    if(!rationale)return J({error:'停止する理由（確かめたこと）を20文字以上で書いてください。'},400);
    if(body.confirm!=='SANCTION')return J({error:'確認の言葉（SANCTION）を入れてください。'},400);
    const reviewer=admReviewer(env,body.reviewer);if(!reviewer)return J({error:'確かめた人の名前（reviewer）を書いてください。'},400);
    const op=typeof body.op==='string'&&/^[0-9a-f]{16,64}$/.test(body.op)?body.op:rndHex(16);
    const c=cid&&await db.prepare(`SELECT id,target_uid,kind,refs,related_root,status,op,ek FROM sanction_cases WHERE id=?`).bind(cid).first();
    if(!c)return J({error:'確認の記録を指定してください。'},400);
    /* 同じ操作（op）をもう一度送ったときは、前の結果を返す（何度送っても1つ） */
    const done=async()=>{const s=await db.prepare(`SELECT id,root_key,permanent,expires_at FROM sanctions WHERE case_id=? AND kind='uid'`).bind(cid).first();
      const c2=await db.prepare(`SELECT op FROM sanction_cases WHERE id=?`).bind(cid).first();return{s,op2:c2&&c2.op}};
    if(c.status!=='open'){const d=await done();if(d.s&&d.op2===op)return J({ok:true,id:d.s.id,root:d.s.root_key,permanent:!!d.s.permanent,expires_at:d.s.expires_at,repeat:true});
      return J({error:'この確認の記録は、もう停止に使われているか、使えません。',conflict:true},409)}
    if(kind==='perpetrator'&&c.kind!=='attack')return J({error:'確かめた攻撃者の停止には、意図的な攻撃の確認の記録が要ります。'},400);
    if(kind==='perpetrator'&&!PERM_BASIS.includes(body.basis))return J({error:'ずっとの停止は、意図的な攻撃（deliberate_attack）か、確かめた停止逃れ（proven_evasion）と記録したときだけです（安全確認の結果だけでは作りません）。'},400);
    if(kind==='linked'&&c.kind!=='linked')return J({error:'関連アカウントの停止には、関連アカウントの確認の記録が要ります。'},400);
    const perm=kind==='perpetrator';
    let exp=null;
    if(!perm){const mo=body.months==null?null:+body.months;
      if(mo!=null&&!(Number.isInteger(mo)&&mo>=3&&mo<=6))return J({error:'期間は3〜6か月から選んでください。'},400);
      exp=mo?jstAddMonths(now,mo):now+90*864e5}
    const cov=await keyCoverage(db,env,now,{ident:true});
    if(perm&&(cov.err||!cov.current||cov.missingIdent.length||cov.missingTomb.length))return J({error:'メールの鍵の設定が足りないため、いまは作れません（管理画面の「鍵の状態」を確かめてください）。',health:cov},503);
    const refs=caseRefsShape(lkJSON(c.refs))||[];
    const who=await lkAdminWho(env,ip),src=perm?'confirmed_attack':kind==='linked'?'confirmed_linked':'manual',root=rndHex(16);
    /* ①確認の記録を「適用中」にとる（まだ open・対象がいる・根拠がすべてある・関連ならもとの停止が有効で、同じ行き先の根拠がある）。
       ②〜は①がとれたときだけ書く（WHERE EXISTS …op）。全部を1つの取引で。だめなら何も残らない */
    const rc=caseRefsCond(refs,c.target_uid);
    let relSql='',relB=[];
    if(c.kind==='linked'){const p=await db.prepare(`SELECT c.refs FROM sanctions s LEFT JOIN sanction_cases c ON c.id=s.case_id WHERE s.root_key=? AND s.kind='uid'`).bind(c.related_root).first();
      const lc=linkedRelCond(refs,p&&lkJSON(p.refs));if(!lc)return J({error:'関連の根拠がそろっていません。'},409);
      const dc=directCond(refs);if(!dc)return J({error:'その人自身の違反の根拠がそろっていません。'},409);
      relSql=` AND ek='direct,linkage' AND EXISTS(SELECT 1 FROM sanctions s WHERE s.root_key=? AND s.kind='uid' AND s.source='confirmed_attack' AND s.status='active') AND ${lc.sql} AND ${dc.sql}`;relB=[c.related_root,...lc.b,...dc.b]}
    else relSql=` AND ek LIKE '%direct%'`;
    const claimed=`EXISTS(SELECT 1 FROM sanction_cases WHERE id=${+cid} AND op='${op}' AND status='applying')`;
    const q=[db.prepare(`UPDATE sanction_cases SET status='applying',op=?,updated_at=? WHERE id=? AND status='open' AND EXISTS(SELECT 1 FROM users WHERE uid=?)${refs.length?' AND '+rc.sql:' AND 0'}${relSql}`)
        .bind(op,now,cid,c.target_uid,...rc.b,...relB),
      db.prepare(`INSERT INTO sanctions(kind,uid,permanent,starts_at,expires_at,reason,evidence,source,actor,status,created_at,updated_at,root_key,case_id,basis,reviewer) SELECT 'uid',?,?,?,?,?,?,?,?,'active',?,?,?,?,?,? WHERE ${claimed}`)
        .bind(c.target_uid,perm?1:0,now,exp,rationale,'case:'+cid+(perm?'|'+body.basis:''),src,who,now,now,root,cid,perm?body.basis:kind,reviewer)];
    if(perm)q.push(db.prepare(`INSERT OR IGNORE INTO sanctions(kind,uid,ehash,kver,permanent,starts_at,expires_at,reason,evidence,source,actor,status,created_at,updated_at,root_key,case_id,elid,basis,reviewer)
        SELECT 'email',NULL,ue.ehash,ue.kver,1,?,NULL,?,?,?,?,'active',?,?,?,?,COALESCE(ue.elid,'lg:'||ue.ehash),?,? FROM user_emails ue WHERE ue.uid=? AND ${claimed}`).bind(now,rationale,'case:'+cid,src,who,now,now,root,cid,body.basis,reviewer,c.target_uid));
    q.push(db.prepare(`INSERT INTO sanction_events(sanction_id,at,actor,action,note,root_key) SELECT id,?,?,'create',?,root_key FROM sanctions WHERE root_key=? AND kind='uid' AND ${claimed}`).bind(now,who,rationale,root),
      db.prepare(`INSERT INTO sanction_events(sanction_id,at,actor,action,note,root_key) SELECT s.id,?,?,CASE WHEN (SELECT COUNT(*) FROM sanctions e WHERE e.root_key=s.root_key AND e.kind='email')>0 THEN 'email_recorded' WHEN ?=1 THEN 'email_unresolved' ELSE 'email_none' END,(SELECT COUNT(*) FROM sanctions e WHERE e.root_key=s.root_key AND e.kind='email'),s.root_key FROM sanctions s WHERE s.root_key=? AND s.kind='uid' AND ${claimed}`).bind(now,who,perm?1:0,root),
      /* 表示を止める：対象の人と、確かめた攻撃者なら同じ確認済みメールを記録している人（同じ本人。前からのログインのままでも門で止まる） */
      db.prepare(`UPDATE users SET banned=2 WHERE banned=0 AND (uid=?1${perm?` OR uid IN (SELECT ue2.uid FROM user_emails ue2 WHERE ue2.ehash IN (SELECT ehash FROM user_emails WHERE uid=?1))`:''}) AND ${claimed}`).bind(c.target_uid),
      /* Firebase 側（対象の UID を止める・ログインの印を取り消す）。アダプターが読む */
      db.prepare(fbTouchSQL(`SELECT ? AS uid${perm?` UNION SELECT ue2.uid FROM user_emails ue2 WHERE ue2.ehash IN (SELECT ehash FROM user_emails WHERE uid=?)`:''}`,claimed)).bind(now,now,c.target_uid,...(perm?[c.target_uid]:[])),
      db.prepare(`UPDATE sanction_cases SET status='sanctioned',updated_at=? WHERE id=? AND op=? AND status='applying'`).bind(now,cid,op));
    try{await db.batch(q)}catch(e){
      /* 同じ確認の記録への同時の送信（ひとつの UID 停止だけの決まりにふれた）など */
      if(/UNIQUE|constraint/i.test(String(e&&e.message||e)))return J({error:'この確認の記録は、もう停止に使われています。',conflict:true},409);throw e}
    const d=await done();
    if(!d.s||d.op2!==op)return J({error:d.s?'この確認の記録は、もう停止に使われています。':'確認の記録の中身（対象・根拠・もとの停止）が変わったため、停止しませんでした。もう一度確かめてください。',conflict:true},409);
    const es=(await db.prepare(`SELECT COUNT(*) AS n FROM sanctions WHERE root_key=? AND kind='email'`).bind(d.s.root_key).first()).n;
    const t=await db.prepare(`SELECT handle FROM users WHERE uid=?`).bind(c.target_uid).first();
    try{await tipsLog(db,env,ip,now,'sanction_'+kind,d.s.id,'@'+(t&&t.handle||'')+' '+rationale)}catch(e){}
    return J({ok:true,id:d.s.id,root:d.s.root_key,op,permanent:perm,expires_at:exp,email:perm?(es?'recorded':'unresolved'):'none'});
  }
  /* 保留（もとの攻撃者の停止が取り消された関連アカウント）の見直し：
     release＝取り消して終える／reinstate＝その人自身の違反の根拠（direct）がある記録だけ、確かめ直したうえで有効に戻す（つながりの根拠だけでは戻さない） */
  if((m=path.match(/^\/api\/admin\/sanctions\/(\d+)\/resolve$/))&&req.method==='POST'){
    const id=+m[1],dec=String(body.decision||''),reason=admReason(body.reason,dec==='reinstate'?20:4);
    if(!['release','reinstate'].includes(dec))return J({error:'release（取り消す）か reinstate（有効に戻す）を選んでください。'},400);
    if(!reason)return J({error:dec==='reinstate'?'その人自身の違反を確かめ直した内容を20文字以上で書いてください。':'理由を4文字以上で書いてください。'},400);
    if(body.confirm!==true)return J({error:'確認のうえで実行してください。'},400);
    if(dec==='reinstate'&&body.attest!==true)return J({error:'根拠を自分で確かめ直したことの申し立て（attest）が要ります。'},400);
    const s=await db.prepare(`SELECT s.id,s.kind,s.uid,s.status,s.root_key,s.permanent,s.expires_at,c.ek,c.refs FROM sanctions s LEFT JOIN sanction_cases c ON c.id=s.case_id WHERE s.id=?`).bind(id).first();
    if(!s)return J({error:'記録が見つかりません。'},404);
    if(s.status!=='held')return J({error:'保留の記録だけを見直せます。',status:s.status},409);
    /* 保留のあいだも期限は進む。期限が過ぎた停止は有効に戻さない（よみがえらせない） */
    if(dec==='reinstate'&&!s.permanent&&!(s.expires_at>now))return J({error:'この停止は保留のあいだに期限が過ぎたため、有効に戻せません（取り消してください）。',expired:true},409);
    const who=await lkAdminWho(env,ip);
    let cond='1',cb=[];
    if(dec==='reinstate'){const dc=directCond(caseRefsShape(lkJSON(s.refs))||[]);
      if(!dc||!/(^|,)direct(,|$)/.test(s.ek||''))return J({error:'その人自身の違反の根拠がない記録は、有効に戻せません（取り消してください）。'},409);
      const rc=caseRefsCond(caseRefsShape(lkJSON(s.refs)),s.uid);cond=dc.sql+' AND '+rc.sql;cb=[...dc.b,...rc.b]}
    const rs=await db.batch([db.prepare(`UPDATE sanctions SET status=?,updated_at=? WHERE root_key=? AND status='held' AND ${dec==='reinstate'?'(permanent=1 OR expires_at>?) AND ':''}${cond}`).bind(dec==='release'?'reversed':'active',now,s.root_key,...(dec==='reinstate'?[now]:[]),...cb),
      db.prepare(`INSERT INTO sanction_events(sanction_id,at,actor,action,note,root_key) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM sanctions WHERE id=? AND status=? AND updated_at=?)`).bind(id,now,who,'held_'+dec,reason,s.root_key,id,dec==='release'?'reversed':'active',now),
      ...(dec==='reinstate'?[db.prepare(`UPDATE users SET banned=2 WHERE banned=0 AND uid=? AND EXISTS(SELECT 1 FROM sanctions WHERE root_key=? AND status='active' AND (permanent=1 OR expires_at>?))`).bind(s.uid,s.root_key,now)]:[]),
      db.prepare(fbTouchSQL(FB_ROOT_UIDS)).bind(now,now,s.root_key,s.root_key,s.root_key)]);
    if(!rs[0].meta.changes)return J({error:'記録の状態か根拠が変わりました。もう一度確かめてください。',conflict:true},409);
    await sanctionSweepStmt(db,now).run();
    try{await tipsLog(db,env,ip,now,'sanction_held_'+dec,id,reason)}catch(e){}
    return J({ok:true,status:dec==='release'?'reversed':'active'});
  }
  /* メールの停止だけを外す（異議を確かめた結果：そのメールが別の人に渡った・前に使っていただけ など）。
     同じ記録の UID の停止はそのまま（確かめた攻撃者の UID は止めたまま）。ほかの記録（別の root）のメールの停止は触らない */
  if((m=path.match(/^\/api\/admin\/sanctions\/(\d+)\/release-email$/))&&req.method==='POST'){
    const id=+m[1],reason=admReason(body.reason,20);
    if(!reason)return J({error:'異議を確かめた内容を20文字以上で書いてください。'},400);
    if(body.confirm!=='RELEASE')return J({error:'確認の言葉（RELEASE）を入れてください。'},400);
    const reviewer=admReviewer(env,body.reviewer);if(!reviewer)return J({error:'確かめた人の名前（reviewer）を書いてください。'},400);
    /* 選んだメールの停止の行と、同じ記録（root）・同じ系統（elid＝同じメールの鍵の版ちがい）の行だけを外す。ほかのメール・UID の停止・ほかの記録は触らない */
    const s=await db.prepare(`SELECT id,root_key,elid,kind FROM sanctions WHERE id=?`).bind(id).first();
    if(!s)return J({error:'記録が見つかりません。'},404);
    if(s.kind!=='email'||!s.elid)return J({error:'外すメールの停止の行（種類が確認済みメール）を選んでください。'},400);
    const who=await lkAdminWho(env,ip);
    /* 先に、外すメールにかかっていた人を「確かめ直す」にする（外したあとだと、だれにかかっていたか分からないため） */
    const rs=await db.batch([db.prepare(fbTouchSQL(`SELECT ue.uid FROM user_emails ue JOIN sanctions e ON e.ehash=ue.ehash WHERE e.kind='email' AND e.root_key=? AND e.elid=? AND e.status='active'`)).bind(now,now,s.root_key,s.elid),
      db.prepare(`UPDATE sanctions SET status='released',updated_at=? WHERE root_key=? AND kind='email' AND elid=? AND status='active'`).bind(now,s.root_key,s.elid),
      db.prepare(`INSERT INTO sanction_events(sanction_id,at,actor,action,note,root_key) VALUES(?,?,?,?,?,?)`).bind(id,now,who,'email_release',reviewer+': '+reason,s.root_key)]);
    await sanctionSweepStmt(db,now).run();
    try{await tipsLog(db,env,ip,now,'sanction_email_release',id,reason)}catch(e){}
    return J({ok:true,released:rs[1].meta.changes});
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
    if(s.status!=='active'&&s.status!=='held')return J({ok:true,status:s.status});
    /* 取り消し：同じ root のすべての行。もとの攻撃者の取り消しなら、それに結びついた関連アカウントの停止は「保留」（自動で有罪のままにしない・自動で戻しもしない。運営者が見直す）。
       Firebase 側を戻す依頼（戻すかはアダプターがほかの制限を聞いて決める） */
    const rs=await db.batch([db.prepare(`UPDATE sanctions SET status='reversed',updated_at=? WHERE root_key=? AND status IN ('active','held')`).bind(now,s.root_key),
      db.prepare(`INSERT INTO sanction_events(sanction_id,at,actor,action,note,root_key) VALUES(?,?,?,?,?,?)`).bind(id,now,who,'reverse',reason,s.root_key),
      db.prepare(`INSERT INTO sanction_events(sanction_id,at,actor,action,note,root_key) SELECT s.id,?,?,'hold_parent_reversed',?,s.root_key FROM sanctions s JOIN sanction_cases c ON c.id=s.case_id WHERE c.related_root=? AND s.kind='uid' AND s.status='active'`).bind(now,who,s.root_key,s.root_key),
      db.prepare(`UPDATE sanctions SET status='held',updated_at=? WHERE status='active' AND root_key IN (SELECT s.root_key FROM sanctions s JOIN sanction_cases c ON c.id=s.case_id WHERE c.related_root=? AND s.kind='uid')`).bind(now,s.root_key),
      db.prepare(fbTouchSQL(FB_ROOT_UIDS)).bind(now,now,s.root_key,s.root_key,s.root_key)]);
    await sanctionSweepStmt(db,now).run();
    try{await tipsLog(db,env,ip,now,'sanction_reverse',id,reason)}catch(e){}
    return J({ok:true,status:'reversed',rows:rs[0].meta.changes,held:rs[3].meta.changes});
  }
  return null;
}
async function linksCleanup(db,now){
  await linksInit(db);
  await db.batch([db.prepare(`DELETE FROM link_attempts WHERE at<?`).bind(now-2*864e5),db.prepare(`DELETE FROM link_clicks WHERE at<?`).bind(now-2*864e5),
    db.prepare(`DELETE FROM link_verdicts WHERE expires_at<?`).bind(now),db.prepare(`DELETE FROM link_quota WHERE day<?`).bind(new Date(now-7*864e5).toISOString().slice(0,10)),db.prepare(`DELETE FROM link_budget_d WHERE day<?`).bind(new Date(now-70*864e5).toISOString().slice(0,10)),
    db.prepare(`DELETE FROM link_intents WHERE expires_at<?`).bind(now-36e5),db.prepare(`DELETE FROM req_bad WHERE at<?`).bind(now-864e5),
    db.prepare(`DELETE FROM link_events WHERE at<?`).bind(now-180*864e5)]);
  await sanctionSweep(db,now);
}
