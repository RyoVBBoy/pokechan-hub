/* ===================== メッセージ（1対1・グループ）と非公開アカウント（2026/11/11） =====================
   ・ログインしてプロフィールを作った人だけが使える。中身は本人たち（会話に入っている人）だけが読める
   ・1対1の会話は dm_convs.pair（2人の uid を並べた鍵）で1つにまとめる。最初の送信のときに作る
   ・相手が非公開アカウント（users.private=1）なら、許可されたフォロワー（follows.ok=1）か、
     相手がこちらをフォローしている（相互フォローを含む）ときだけ送れる。そうでなければ送信を断り、理由 DM_LOCKED を返す
   ・外部のSNS・連絡先（URL・ID・メール・電話番号）への誘導は送れない（dmOutside）。NGワードは掲示板と同じ ngCheck
   ・500文字まで、2秒に1件・1日300件。グループは20人まで・1日10個まで作れる */
const DM_MAX=500,DM_PAGE=50,DM_GROUP_MAX=20;
const DM_LOCKED='このユーザーは非公開アカウントのためメッセージを送信できません';
let DM_READY=false;
async function dmInit(db){
  if(DM_READY)return;
  await socialInit(db);
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS dm_convs(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT NOT NULL,pair TEXT UNIQUE,title TEXT,owner TEXT,created_at INTEGER,last_at INTEGER DEFAULT 0,last_body TEXT,last_uid TEXT)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS dm_members(conv_id INTEGER NOT NULL,uid TEXT NOT NULL,last_read INTEGER DEFAULT 0,joined_at INTEGER,PRIMARY KEY(conv_id,uid))`),
    db.prepare(`CREATE INDEX IF NOT EXISTS dm_members_uid ON dm_members(uid,conv_id)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS dm_msgs(id INTEGER PRIMARY KEY AUTOINCREMENT,conv_id INTEGER NOT NULL,uid TEXT NOT NULL,body TEXT,created_at INTEGER)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS dm_msgs_conv ON dm_msgs(conv_id,id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS dm_msgs_rate ON dm_msgs(uid,created_at)`)
  ]);
  DM_READY=true;
}
/* 外部のSNS・連絡先への誘導を見つける。見つけたら理由の文、なければ null。
   すき間・記号を入れてごまかした書き方（d i s c o r d、ら い ん）も、詰めた文字列で調べる */
const DM_SNS=['discord','ディスコ','でぃすこ','twitter','ツイッター','ついったー','instagram','インスタ','いんすた','tiktok','ティックトック','てぃっくとっく',
  'facebook','フェイスブック','kakao','カカオ','telegram','テレグラム','wechat','skype','スカイプ','snapchat','bluesky','threads.net','ラインid','ラインやって','ライン交換','らいん','lineid','x.com','gmail','icloud','yahoo','メアド','メールアドレス','電話番号','でんわばんごう'];
function dmOutside(text){
  const s=String(text).normalize('NFKC').toLowerCase();
  const z=s.replace(/[\s​-‍⁠﻿・･\-‐_*'"`|\/\\()（）「」【】]+/g,'');
  if(/https?:|www\.|:\/\/|[a-z0-9-]+\.(com|net|org|jp|gg|me|io|app|co|ly|tv|xyz|link|cc|be|info|biz|to|dev|page|site)\b/.test(s))return '外部のURL（リンク）は送れません。';
  if(/[a-z0-9._%+-]+@[a-z0-9-]+\.[a-z.]{2,}/.test(s))return 'メールアドレスは送れません。';
  if(DM_SNS.some(w=>z.includes(w))||/(^|[^a-z])line([^a-z]|$)/.test(s)||/(^|[^a-z])(dc|ig|insta|tw)\s*[:：]/.test(s))return '外部のSNS・連絡先の名前やIDは送れません。';
  if(/@[a-z0-9_.]{2,}/.test(s)||/(^|[^a-z])id\s*[:：は=]/.test(s))return 'IDは送れません。';
  if(/0\d{9,10}/.test(s.replace(/[\s\-‐ー()（）]/g,'')))return '電話番号は送れません。';
  return null;
}
/* from が to（users の行）にメッセージを送れるか。送れなければ理由の文 */
const DM_FOLLOWING='このユーザーは、自分がフォローしている人からのメッセージだけを受け取る設定にしています。';
async function dmBlock(db,fromUid,to){
  if(!to||to.banned)return 'ユーザーが見つかりません。';
  if(to.uid===fromUid)return '自分にはメッセージを送れません。';
  if(to.private){
    const r=await db.prepare(`SELECT 1 AS x FROM follows WHERE ((src=?1 AND dst=?2) OR (src=?2 AND dst=?1)) AND ok=1 LIMIT 1`).bind(fromUid,to.uid).first();
    if(!r)return DM_LOCKED}
  /* メッセージの設定（2026/11/11）：「自分がフォローしている人だけ」なら、相手からフォローされている人だけ送れる */
  if(to.dm_from==='following'){
    const r=await db.prepare(`SELECT 1 AS x FROM follows WHERE src=? AND dst=? AND ok=1`).bind(to.uid,fromUid).first();
    if(!r)return DM_FOLLOWING}
  return null;
}
const dmUser=x=>({handle:x.handle,name:x.name,av:x.avatar||null,private:!!x.private});
const dmMsgOut=(x,me)=>({id:x.id,body:x.body,created_at:x.created_at,mine:x.uid===me,user:x.handle?{handle:x.handle,name:x.name,av:x.avatar||null}:null});
async function dmMsgs(db,conv,me,u){
  const after=parseInt(u.searchParams.get('after')||'',10)||0,before=parseInt(u.searchParams.get('before')||'',10)||9e15;
  const r=after?await db.prepare(`SELECT m.id,m.uid,m.body,m.created_at,s.handle,s.name,s.avatar FROM dm_msgs m LEFT JOIN users s ON s.uid=m.uid WHERE m.conv_id=? AND m.id>? ORDER BY m.id LIMIT ${DM_PAGE}`).bind(conv,after).all()
    :await db.prepare(`SELECT m.id,m.uid,m.body,m.created_at,s.handle,s.name,s.avatar FROM dm_msgs m LEFT JOIN users s ON s.uid=m.uid WHERE m.conv_id=? AND m.id<? ORDER BY m.id DESC LIMIT ${DM_PAGE}`).bind(conv,before).all();
  const l=after?r.results:r.results.reverse();
  return{msgs:l.map(x=>dmMsgOut(x,me)),more:!after&&r.results.length===DM_PAGE};
}
async function dmRead(db,conv,me){
  await db.prepare(`UPDATE dm_members SET last_read=(SELECT COALESCE(MAX(id),0) FROM dm_msgs WHERE conv_id=?1) WHERE conv_id=?1 AND uid=?2`).bind(conv,me).run();
}
async function dmApi(req,env,db,path,u,body,now,ip,ctx){
  if(!/^\/api\/(dm(\/|$)|me\/(private|dmfrom)$)/.test(path))return null;
  if(!fbPid(env))return J({error:'ログイン機能は準備中です。'},503);
  const later=p=>{if(ctx&&ctx.waitUntil)ctx.waitUntil(p);else return p};
  const me=await authOf(req,env);
  if(!me)return J({error:'ログインしてください。'},401);
  await dmInit(db);
  const meRow=await db.prepare(`SELECT uid,handle,name,banned,private FROM users WHERE uid=?`).bind(me.uid).first();
  if(!meRow)return J({error:'先にプロフィールを作ってください。'},403);
  if(meRow.banned)return J({error:'このアカウントは利用を停止しています。'},403);
  const uid=meRow.uid;let m;

  /* 非公開アカウントの切りかえ {on}。公開に戻すと、待っていたリクエストはすべて許可する */
  /* メッセージを受け取る相手の設定（2026/11/11 依頼主）：all＝だれでも（非公開アカウントの決まりは別に効く）／following＝自分がフォローしている人だけ */
  if(path==='/api/me/dmfrom'&&req.method==='POST'){
    const v=body.v==='following'?'following':'all';
    await db.prepare(`UPDATE users SET dm_from=?,updated_at=? WHERE uid=?`).bind(v,now,uid).run();
    return J({ok:true,dm_from:v});
  }
  if(path==='/api/me/private'&&req.method==='POST'){
    const on=!!body.on;
    const st=[db.prepare(`UPDATE users SET private=?,updated_at=? WHERE uid=?`).bind(on?1:0,now,uid)];
    if(!on)st.push(db.prepare(`UPDATE follows SET ok=1 WHERE dst=? AND ok=0`).bind(uid),db.prepare(`UPDATE notifs SET kind='follow' WHERE uid=? AND kind='freq'`).bind(uid));
    await db.batch(st);
    return J({ok:true,private:on});
  }
  /* 会話の一覧 ?kind=dm（個人）／group（グループ） */
  if(path==='/api/dm'&&req.method==='GET'){
    const kind=u.searchParams.get('kind')==='group'?'group':'dm';
    const r=(await db.prepare(`SELECT c.id,c.kind,c.title,c.last_at,c.last_body,c.last_uid,
      (SELECT COUNT(*) FROM dm_msgs x WHERE x.conv_id=c.id AND x.id>m.last_read AND x.uid<>?1) AS unread,
      (SELECT COUNT(*) FROM dm_members y WHERE y.conv_id=c.id) AS n
      FROM dm_members m JOIN dm_convs c ON c.id=m.conv_id WHERE m.uid=?1 AND c.kind=?2 AND c.last_at>0 ORDER BY c.last_at DESC LIMIT 100`).bind(uid,kind).all()).results;
    const mem=r.length?(await db.prepare(`SELECT m.conv_id,s.handle,s.name,s.avatar,s.private FROM dm_members m JOIN users s ON s.uid=m.uid AND s.banned=0
      WHERE m.conv_id IN (SELECT conv_id FROM dm_members WHERE uid=?1) AND m.uid<>?1`).bind(uid).all()).results:[];
    const by={};for(const x of mem)(by[x.conv_id]=by[x.conv_id]||[]).push(dmUser(x));
    const out=r.map(c=>({id:c.id,kind:c.kind,title:c.title||'',n:c.n,last_at:c.last_at,last:c.last_body||'',last_mine:c.last_uid===uid,unread:Math.min(c.unread,99),members:(by[c.id]||[]).slice(0,5)}))
      .filter(c=>c.kind==='group'||c.members.length);
    return J({convs:out});
  }
  /* 読んでいない数（下のメニューの印） */
  if(path==='/api/dm/unread'&&req.method==='GET'){
    const r=await db.prepare(`SELECT COUNT(*) AS c FROM dm_members m JOIN dm_msgs x ON x.conv_id=m.conv_id AND x.id>m.last_read AND x.uid<>?1 WHERE m.uid=?1`).bind(uid).first();
    return J({unread:r?Math.min(r.c,99):0});
  }
  /* 1対1の会話を開く：相手・送れるか（理由）・やりとり */
  if((m=path.match(/^\/api\/dm\/with\/([A-Za-z0-9_]{3,15})$/))&&req.method==='GET'){
    const t=await db.prepare(`SELECT uid,handle,name,avatar,private,dm_from,banned FROM users WHERE handle=? COLLATE NOCASE`).bind(m[1]).first();
    if(!t||t.banned)return J({error:'ユーザーが見つかりません。'},404);
    if(t.uid===uid)return J({error:'自分にはメッセージを送れません。'},400);
    const reason=await dmBlock(db,uid,t);
    const c=await db.prepare(`SELECT id FROM dm_convs WHERE pair=?`).bind([uid,t.uid].sort().join('|')).first();
    let msgs={msgs:[],more:false};
    if(c){msgs=await dmMsgs(db,c.id,uid,u);await dmRead(db,c.id,uid)}
    return J({user:dmUser(t),conv:c?c.id:null,can:!reason,reason:reason||null,...msgs});
  }
  /* グループの会話を開く */
  if((m=path.match(/^\/api\/dm\/(\d+)$/))&&req.method==='GET'){
    const c=await db.prepare(`SELECT c.id,c.kind,c.title,c.owner FROM dm_convs c JOIN dm_members m ON m.conv_id=c.id AND m.uid=? WHERE c.id=?`).bind(uid,+m[1]).first();
    if(!c)return J({error:'この会話は見つかりません。'},404);
    const mem=(await db.prepare(`SELECT s.handle,s.name,s.avatar,s.private,s.uid FROM dm_members m JOIN users s ON s.uid=m.uid AND s.banned=0 WHERE m.conv_id=? ORDER BY m.joined_at`).bind(c.id).all()).results;
    const msgs=await dmMsgs(db,c.id,uid,u);
    if(!u.searchParams.get('after')||msgs.msgs.length)await dmRead(db,c.id,uid);
    return J({conv:{id:c.id,kind:c.kind,title:c.title||'',owner:c.owner===uid,members:mem.filter(x=>x.uid!==uid).map(dmUser)},can:true,reason:null,...msgs});
  }
  /* 送る {to:相手のID} か {conv:会話の番号}、{body} */
  if(path==='/api/dm/send'&&req.method==='POST'){
    const text=clean(body.body,DM_MAX*2+2);
    if(!text)return J({error:'メッセージを入れてください。'},400);
    if([...text].length>DM_MAX)return J({error:`メッセージは${DM_MAX}文字までです。`},400);
    let conv=0,others=[],url;
    if(body.to){
      const t=await db.prepare(`SELECT uid,handle,name,private,dm_from,banned FROM users WHERE handle=? COLLATE NOCASE`).bind(String(body.to)).first();
      const why=await dmBlock(db,uid,t);if(why)return J({error:why,locked:why===DM_LOCKED,limited:why===DM_FOLLOWING},why===DM_LOCKED||why===DM_FOLLOWING?403:t?400:404);
      others=[t.uid];url='#/messages/'+meRow.handle;
      const pair=[uid,t.uid].sort().join('|');
      const c=await db.prepare(`SELECT id FROM dm_convs WHERE pair=?`).bind(pair).first();
      conv=c?c.id:0;
    }else{
      conv=parseInt(body.conv,10)||0;
      const c=conv&&await db.prepare(`SELECT c.kind FROM dm_convs c JOIN dm_members m ON m.conv_id=c.id AND m.uid=? WHERE c.id=?`).bind(uid,conv).first();
      if(!c)return J({error:'この会話は見つかりません。'},404);
      others=(await db.prepare(`SELECT m.uid FROM dm_members m JOIN users s ON s.uid=m.uid AND s.banned=0 WHERE m.conv_id=? AND m.uid<>?`).bind(conv,uid).all()).results.map(x=>x.uid);
      /* 1対1の会話を番号で送るときも、相手が非公開になっていないか確かめる */
      if(c.kind==='dm'){const t=others[0]&&await db.prepare(`SELECT uid,private,banned FROM users WHERE uid=?`).bind(others[0]).first();
        const why=await dmBlock(db,uid,t);if(why)return J({error:why,locked:why===DM_LOCKED},403);url='#/messages/'+meRow.handle}
      else url='#/messages/g/'+conv;
    }
    const ng=dmOutside(text)||ngCheck(text);if(ng)return J({error:ng,outside:true},400);
    const rt=await db.prepare(`SELECT (SELECT COUNT(*) FROM dm_msgs WHERE uid=?1 AND created_at>?2) AS n,(SELECT COUNT(*) FROM dm_msgs WHERE uid=?1 AND created_at>?3) AS d`).bind(uid,now-2e3,now-864e5).first();
    if(rt&&rt.n>0)return J({error:'少し時間をあけて送ってください。'},429);
    if(rt&&rt.d>=300)return J({error:'1日に送れる数（300件）を超えました。'},429);
    if(!conv){
      const pair=[uid,others[0]].sort().join('|');
      await db.prepare(`INSERT OR IGNORE INTO dm_convs(kind,pair,owner,created_at,last_at) VALUES('dm',?,?,?,0)`).bind(pair,uid,now).run();
      conv=(await db.prepare(`SELECT id FROM dm_convs WHERE pair=?`).bind(pair).first()).id;
      await db.batch([uid,others[0]].map(x=>db.prepare(`INSERT OR IGNORE INTO dm_members(conv_id,uid,last_read,joined_at) VALUES(?,?,0,?)`).bind(conv,x,now)));
    }
    const r=await db.prepare(`INSERT INTO dm_msgs(conv_id,uid,body,created_at) VALUES(?,?,?,?) RETURNING id`).bind(conv,uid,text,now).first();
    await db.batch([db.prepare(`UPDATE dm_convs SET last_at=?,last_body=?,last_uid=? WHERE id=?`).bind(now,text.slice(0,80),uid,conv),
      db.prepare(`UPDATE dm_members SET last_read=? WHERE conv_id=? AND uid=?`).bind(r.id,conv,uid)]);
    /* 通知は同じ会話で10分に1回まで（中身は先頭だけ） */
    for(const o of others)await later(pushTo(db,o,{title:`${meRow.name}さんからメッセージ`,body:text.slice(0,60),url,tag:'dm-'+conv},'dm:'+conv+':'+Math.floor(now/6e5)));
    return J({ok:true,conv,msg:{id:r.id,body:text,created_at:now,mine:true,user:{handle:meRow.handle,name:meRow.name,av:null}}});
  }
  /* グループを作る {title, handles:[…]}（相手ごとに、送れる相手か確かめる） */
  if(path==='/api/dm/group'&&req.method==='POST'){
    const title=clean(body.title,30);
    if(!title)return J({error:'グループの名前を入れてください。'},400);
    const ng=dmOutside(title)||ngCheck(title);if(ng)return J({error:ng},400);
    const hs=[...new Set((Array.isArray(body.handles)?body.handles:[]).map(x=>String(x).toLowerCase()))].filter(x=>/^[a-z0-9_]{3,15}$/.test(x));
    if(hs.length<1)return J({error:'メンバーを1人以上選んでください。'},400);
    if(hs.length>DM_GROUP_MAX-1)return J({error:`グループは${DM_GROUP_MAX}人までです。`},400);
    const mk=await db.prepare(`SELECT COUNT(*) AS c FROM dm_convs WHERE owner=? AND kind='group' AND created_at>?`).bind(uid,now-864e5).first();
    if(mk&&mk.c>=10)return J({error:'1日に作れるグループは10個までです。'},429);
    const mem=[];
    for(const h of hs){const t=await db.prepare(`SELECT uid,handle,name,private,dm_from,banned FROM users WHERE handle=? COLLATE NOCASE`).bind(h).first();
      const why=await dmBlock(db,uid,t);if(why)return J({error:(t?`@${t.handle}：`:'')+why,locked:why===DM_LOCKED},why===DM_LOCKED?403:400);mem.push(t.uid)}
    const c=await db.prepare(`INSERT INTO dm_convs(kind,title,owner,created_at,last_at,last_body,last_uid) VALUES('group',?,?,?,?,?,?) RETURNING id`).bind(title,uid,now,now,'グループを作りました',uid).first();
    await db.batch([uid,...mem].map(x=>db.prepare(`INSERT OR IGNORE INTO dm_members(conv_id,uid,last_read,joined_at) VALUES(?,?,0,?)`).bind(c.id,x,now)));
    for(const o of mem)await later(pushTo(db,o,{title:`${meRow.name}さんがグループ「${title}」に追加しました`,body:'',url:'#/messages/g/'+c.id,tag:'dm-'+c.id},'dmg:'+c.id));
    return J({ok:true,conv:c.id});
  }
  /* 既読にする */
  if((m=path.match(/^\/api\/dm\/(\d+)\/read$/))&&req.method==='POST'){await dmRead(db,+m[1],uid);return J({ok:true})}
  /* グループを抜ける（だれもいなくなったら会話ごと消す） */
  if((m=path.match(/^\/api\/dm\/(\d+)\/leave$/))&&req.method==='POST'){
    const c=await db.prepare(`SELECT c.id FROM dm_convs c JOIN dm_members m ON m.conv_id=c.id AND m.uid=? WHERE c.id=? AND c.kind='group'`).bind(uid,+m[1]).first();
    if(!c)return J({error:'この会話は見つかりません。'},404);
    await db.prepare(`DELETE FROM dm_members WHERE conv_id=? AND uid=?`).bind(c.id,uid).run();
    const left=await db.prepare(`SELECT COUNT(*) AS c FROM dm_members WHERE conv_id=?`).bind(c.id).first();
    if(!left||!left.c)await db.batch([db.prepare(`DELETE FROM dm_msgs WHERE conv_id=?`).bind(c.id),db.prepare(`DELETE FROM dm_convs WHERE id=?`).bind(c.id)]);
    return J({ok:true});
  }
  return J({error:'見つかりません。'},404);
}
/* アカウントを消すとき：1対1の会話は相手の分も含めて消し、グループからは抜けて、その人のメッセージを消す */
async function dmDeleteUser(db,uid){
  await dmInit(db);
  const pairs=(await db.prepare(`SELECT c.id FROM dm_convs c JOIN dm_members m ON m.conv_id=c.id AND m.uid=? WHERE c.kind='dm'`).bind(uid).all()).results.map(x=>x.id);
  const st=[];
  for(const id of pairs)st.push(db.prepare(`DELETE FROM dm_msgs WHERE conv_id=?`).bind(id),db.prepare(`DELETE FROM dm_members WHERE conv_id=?`).bind(id),db.prepare(`DELETE FROM dm_convs WHERE id=?`).bind(id));
  st.push(db.prepare(`DELETE FROM dm_msgs WHERE uid=?`).bind(uid),db.prepare(`DELETE FROM dm_members WHERE uid=?`).bind(uid));
  await db.batch(st);
  await db.prepare(`DELETE FROM dm_convs WHERE kind='group' AND id NOT IN (SELECT conv_id FROM dm_members)`).run();
}
