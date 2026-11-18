/* ===================== シーズンごとの上位パーティ =====================
   ・シーズン（名前・期間）は運営者が管理画面で登録する（seasons）
   ・パーティは、ログインした利用者が自分の結果（最終順位・レート・6匹と育成）を登録するか、運営者が登録する（season_teams）
     利用者は1シーズン・1形式につき1件（あとから直せる・消せる）
   ・証拠のスクリーンショット（任意）は運営者だけが見られる。
   ・出どころ（2026/11/18 依頼主の決定）は4つ。保存している値（verified・by_admin・auto）は書きかえず、読むときに `ladderSource` で決める：
       article  記事から集計＝auto=1（by_admin=1 でも、これがいちばん先）
       verified 確認済み＝運営者が証拠のスクリーンショットを見て、その確認を記録したもの（reviewed_at・reviewed_proof が今の証拠と同じ・
                確認したときの中身 review_sig が今の中身と同じ）。確認の記録がないものは確認済みにしない
       operator 運営が登録＝ほかの by_admin=1（確認の記録なし。証拠がないので確認済みにはできない）
       self     自己申告＝利用者の登録。前の版で verified=1 になっていたものも、記録がないので自己申告。
                証拠があって前の版で verified=1 だったものは「もう一度確かめる」（pending）
     確認の記録は rank_reviews（だれが・いつ・どの証拠で・何をしたか）に残す。順位・レート・パーティ・証拠が変わると確認は外れる
     スクリーンショットは media 表に note_id＝-（パーティの番号）で入れる（投稿の画像とは別。1日の掃除の対象にならない）
   ・一覧は順位の小さい順（順位がなければレートの高い順）。よく使われたポケモンも集計する */
let LADDER_READY=false;
async function ladderInit(db){
  if(LADDER_READY)return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS seasons(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,start TEXT,end TEXT,created_at INTEGER)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS season_teams(id INTEGER PRIMARY KEY AUTOINCREMENT,season_id INTEGER NOT NULL,fmt TEXT NOT NULL,uid TEXT,player TEXT,rank INTEGER,rate INTEGER,team TEXT,comment TEXT,proof TEXT,verified INTEGER DEFAULT 0,hidden INTEGER DEFAULT 0,by_admin INTEGER DEFAULT 0,created_at INTEGER,updated_at INTEGER)`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS season_teams_user ON season_teams(season_id,fmt,uid) WHERE uid IS NOT NULL`),
    db.prepare(`CREATE INDEX IF NOT EXISTS season_teams_list ON season_teams(season_id,fmt,hidden)`)
  ]);
  /* あとから足した列：運営者の解説（シーズンのまとめに出す） */
  try{await db.prepare(`ALTER TABLE seasons ADD COLUMN note TEXT`).run()}catch(e){}
  /* 2026/11/18：出どころの確認の記録とゲーム。足すだけ（前の行・前の列はそのまま） */
  for(const c of ['auto INTEGER DEFAULT 0','sources TEXT','gkey TEXT','reviewed_at INTEGER','reviewed_by TEXT','reviewed_proof TEXT','review_sig TEXT',"game TEXT DEFAULT 'pokechamp'"]){
    try{await db.prepare(`ALTER TABLE season_teams ADD COLUMN ${c}`).run()}catch(e){}}
  try{await db.prepare(`ALTER TABLE seasons ADD COLUMN game TEXT DEFAULT 'pokechamp'`).run()}catch(e){}
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS rank_reviews(id INTEGER PRIMARY KEY AUTOINCREMENT,team_id INTEGER NOT NULL,action TEXT NOT NULL,proof TEXT,sig TEXT,by TEXT,note TEXT,created_at INTEGER)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS rank_reviews_t ON rank_reviews(team_id,id)`)
  ]);
  LADDER_READY=true;
}
const isDay=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''));
/* パーティの形を確かめる：1〜6匹、番号は整数、育成（set）は小さなオブジェクト */
function ladderTeam(t){
  if(!Array.isArray(t)||t.length<1||t.length>6)return null;
  const out=t.map(x=>({no:x&&Number.isInteger(x.no)&&x.no>0&&x.no<20000?x.no:0,set:x&&x.set&&typeof x.set==='object'?x.set:undefined}));
  if(out.some(x=>!x.no)||new Set(out.map(x=>x.no)).size!==out.length)return null;
  const s=JSON.stringify(out);return s.length<=8000?s:null;
}
/* 確認に関わる中身（形式・シーズン・順位・レート・パーティ・証拠）の印。確認のあとで変われば確認は外れる */
function ladderSig(r){
  const s=JSON.stringify([r.season_id,r.fmt,r.rank||null,r.rate||null,r.team||'',r.proof||'']);
  let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0}
  return h.toString(16).padStart(8,'0')+':'+s.length;
}
/* 出どころ（article・verified・operator・self）と確認の状態（reviewed・stale・rereview・awaiting・none） */
function ladderSource(r){
  const rec=!!(r.reviewed_at&&r.reviewed_proof);
  const match=rec&&!!r.proof&&r.reviewed_proof===r.proof&&r.review_sig===ladderSig(r);
  let source;
  if(r.auto)source='article';
  else if(match)source='verified';
  else if(r.by_admin)source='operator';
  else source='self';
  let review='none';
  if(source==='verified')review='reviewed';
  else if(source!=='article'&&rec)review='stale';          /* 確認したあとで中身が変わった */
  else if(source==='self'&&r.verified&&r.proof)review='rereview'; /* 前の版の確認済み（記録なし）・証拠あり */
  else if(source!=='article'&&r.proof)review='awaiting';
  return{source,review,pending:review==='rereview'||review==='stale'};
}
const ladderVerified=r=>ladderSource(r).source==='verified';
const intOrNull=(v,max)=>{const n=parseInt(v,10);return n>0&&n<=max?n:null};
/* プロフィールに出す実績（非表示でないもの・新しいシーズン順） */
async function ladderResults(db,uid){
  await ladderInit(db);
  const r=await db.prepare(`SELECT t.*,s.name AS season FROM season_teams t JOIN seasons s ON s.id=t.season_id
    WHERE t.uid=? AND t.hidden=0 ORDER BY COALESCE(s.start,'') DESC,s.id DESC LIMIT 12`).bind(uid).all();
  /* カードに出すのは本人の登録（確認済み・自己申告）だけ。記事から集計・運営が登録は本人のものと確かめられないので出さない（A18・IA §7） */
  return r.results.filter(x=>{const c=ladderSource(x).source;return c==='verified'||c==='self'}).map(x=>{const c=ladderSource(x);return{season:x.season,game:x.game||'pokechamp',fmt:x.fmt,rank:x.rank,rate:x.rate,source:c.source,verified:c.source==='verified'}});
}
const ladderOut=(r,meUid)=>{let team=[];try{team=JSON.parse(r.team||'[]')}catch(e){}
  const c=ladderSource(r);
  return{id:r.id,game:r.game||'pokechamp',fmt:r.fmt,rank:r.rank,rate:r.rate,team,comment:r.comment||'',source:c.source,verified:c.source==='verified',by_admin:!!r.by_admin,proof:!!r.proof,
    player:r.handle?{handle:r.handle,name:r.name}:{name:r.player||'（名前なし）'},mine:!!(meUid&&r.uid===meUid),updated_at:r.updated_at,
    auto:!!r.auto,sources:(()=>{try{return(JSON.parse(r.sources||'[]')||[]).filter(u=>/^https?:\/\//.test(u)).slice(0,8)}catch(e){return[]}})()}};
const LADDER_RULES=['auto=1 は記事から集計（by_admin=1 でもこれが先）','確認の記録があり、記録した証拠と中身が今と同じものだけ確認済み','ほかの by_admin=1 は運営が登録',
  '利用者の登録は自己申告（前の版の verified=1 でも記録がなければ自己申告。証拠があればもう一度確かめる）','確認の記録がないものを確認済みにしない'];
async function ladderLog(db,id,action,proof,sig,by,note,now){
  await db.prepare(`INSERT INTO rank_reviews(team_id,action,proof,sig,by,note,created_at) VALUES(?,?,?,?,?,?,?)`).bind(id,action,proof||null,sig||null,by||null,note||null,now).run();
}
async function ladderApi(req,env,db,path,u,body,now,isAdmin){
  if(!/^\/api\/(seasons|admin\/season)/.test(path))return null;
  await ladderInit(db);await mediaInit(db);
  let m;
  const admErr=()=>J({error:'管理用の合言葉が違います。'},401);
  /* シーズンの一覧（新しい順） */
  if(path==='/api/seasons'&&req.method==='GET'){
    const r=await db.prepare(`SELECT s.id,s.name,s.start,s.end,s.note,(SELECT COUNT(*) FROM season_teams t WHERE t.season_id=s.id AND t.hidden=0) AS n FROM seasons s ORDER BY COALESCE(s.start,'') DESC,s.id DESC`).all();
    return J({seasons:r.results});
  }
  const me=fbPid(env)?await authOf(req,env).catch(()=>null):null;
  const meRow=me?await db.prepare(`SELECT uid,handle,name,banned FROM users WHERE uid=?`).bind(me.uid).first():null;
  const meUid=meRow&&!meRow.banned?meRow.uid:'';
  /* そのシーズンのパーティと、よく使われたポケモン */
  if((m=path.match(/^\/api\/seasons\/(\d+)\/teams$/))&&req.method==='GET'){
    const fmt=u.searchParams.get('fmt')==='double'?'double':'single';
    const s=await db.prepare(`SELECT id,name,start,end,note FROM seasons WHERE id=?`).bind(+m[1]).first();
    if(!s)return J({error:'シーズンが見つかりません。'},404);
    const r=await db.prepare(`SELECT t.*,u.handle,u.name,u.private AS u_private,
      (u.uid IS NOT NULL AND (u.uid=?3 OR EXISTS(SELECT 1 FROM follows f WHERE f.src=?3 AND f.dst=u.uid AND f.ok=1))) AS u_ok,
      u.uid=?3 AS u_me,g.vis AS g_vis
      FROM season_teams t LEFT JOIN users u ON u.uid=t.uid LEFT JOIN game_profiles g ON g.uid=t.uid AND g.game=COALESCE(t.game,'pokechamp')
      WHERE t.season_id=?1 AND t.fmt=?2 AND t.hidden=0 AND (t.uid IS NULL OR (u.uid IS NOT NULL AND u.banned=0))
      ORDER BY t.rank IS NULL,t.rank,t.rate IS NULL,t.rate DESC,t.id LIMIT 200`).bind(s.id,fmt,meUid).all();
    /* 非公開アカウントの登録（2026/11/18 依頼主の決定 A20）：本人と許可されたフォロワー以外には、その行をまるごと送らない
       （名前を隠した行も送らない）。行を外したあとで数えるので、よく使われたポケモン・件数にも入らない（1件から中身が分からないように）
       ゲームのプロフィールを「自分だけ」「フォロワーのみ」にしている人の登録も同じ（実績はゲームの中身。IA §6.2） */
    const hide=x=>x.uid&&!x.u_me&&((x.u_private&&!x.u_ok)||x.g_vis==='only_me'||(x.g_vis==='followers'&&!x.u_ok));
    const teams=r.results.filter(x=>!hide(x)).map(x=>ladderOut(x,meUid));
    /* よく使われたポケモンは確認済みの結果だけで数える（自己申告・記事から集計・運営が登録は入れない） */
    const vt=teams.filter(t=>t.source==='verified');
    const cnt={};vt.forEach(t=>t.team.forEach(x=>{cnt[x.no]=(cnt[x.no]||0)+1}));
    const usage=Object.entries(cnt).map(([no,c])=>({no:+no,n:c,pc:Math.round(c/vt.length*1000)/10})).sort((a,b)=>b.n-a.n).slice(0,20);
    const by={verified:0,self:0,article:0,operator:0};teams.forEach(t=>by[t.source]++);
    return J({season:s,fmt,teams,usage,usage_basis:'verified',verified_total:vt.length,by_source:by,total:teams.length});
  }
  /* 自分の結果を登録する（同じシーズン・形式なら上書き） */
  if((m=path.match(/^\/api\/seasons\/(\d+)\/teams$/))&&req.method==='POST'){
    if(!me)return J({error:'ログインしてください。'},401);
    if(!meRow)return J({error:'先にプロフィールを作ってください。'},403);
    if(meRow.banned)return J({error:'このアカウントは利用を停止しています。'},403);
    const s=await db.prepare(`SELECT id FROM seasons WHERE id=?`).bind(+m[1]).first();if(!s)return J({error:'シーズンが見つかりません。'},404);
    const fmt=body.fmt==='double'?'double':'single',team=ladderTeam(body.team);
    if(!team)return J({error:'パーティ（1〜6匹）を選んでください。'},400);
    const rank=intOrNull(body.rank,1e6),rate=intOrNull(body.rate,9999);
    if(!rank&&!rate)return J({error:'最終順位かレートのどちらかを入れてください。'},400);
    const comment=clean(body.comment,140);const ng=comment&&ngCheck(comment);if(ng)return J({error:ng},400);
    const old=await db.prepare(`SELECT * FROM season_teams WHERE season_id=? AND fmt=? AND uid=?`).bind(s.id,fmt,meUid).first();
    if(!old){const c=await db.prepare(`SELECT COUNT(*) AS c FROM season_teams WHERE uid=? AND created_at>?`).bind(meUid,now-864e5).first();if(c&&c.c>=10)return J({error:'1日に登録できる回数を超えました。'},429)}
    /* 証拠のスクリーンショット（先に /api/media で送ったもの） */
    let proof=old?old.proof:null,newProof=false;
    if(body.proof&&/^[0-9a-f]{32}$/.test(String(body.proof))&&body.proof!==proof){
      const p=await db.prepare(`SELECT key FROM media WHERE key=? AND uid=? AND note_id=0`).bind(String(body.proof),meUid).first();
      if(!p)return J({error:'スクリーンショットを送り直してください。'},400);proof=p.key;newProof=true}
    /* 中身を変えたら、確認済みはいったん外す */
    let id;
    if(old){
      /* 確認に関わる中身（順位・レート・パーティ・証拠）が変わったら、確認の記録を外して履歴に残す。ひとことだけなら確認はそのまま */
      const changed=ladderSig(old)!==ladderSig({...old,rank,rate,team,proof});
      await db.prepare(`UPDATE season_teams SET rank=?,rate=?,team=?,comment=?,proof=?,verified=CASE WHEN ? THEN 0 ELSE verified END,updated_at=? WHERE id=?`)
        .bind(rank,rate,team,comment,proof,changed?1:0,now,old.id).run();id=old.id;
      if(changed&&old.reviewed_at){
        await db.prepare(`UPDATE season_teams SET reviewed_at=NULL,reviewed_by=NULL,reviewed_proof=NULL,review_sig=NULL WHERE id=?`).bind(id).run();
        await ladderLog(db,id,'reset',old.reviewed_proof,null,'system','登録した人が順位・レート・パーティ・証拠を変えた',now)}
      if(newProof&&old.proof)await mediaDrop(env,db,'key=?',old.proof)}
    else{const r=await db.prepare(`INSERT INTO season_teams(season_id,fmt,uid,rank,rate,team,comment,proof,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) RETURNING id`).bind(s.id,fmt,meUid,rank,rate,team,comment,proof,now,now).first();id=r.id}
    if(newProof)await db.prepare(`UPDATE media SET note_id=? WHERE key=?`).bind(-id,proof).run();
    return J({ok:true,id});
  }
  /* 自分の登録を消す */
  if((m=path.match(/^\/api\/seasons\/teams\/(\d+)\/delete$/))&&req.method==='POST'){
    if(!meUid)return J({error:'ログインしてください。'},401);
    const t=await db.prepare(`SELECT id,proof FROM season_teams WHERE id=? AND uid=?`).bind(+m[1],meUid).first();
    if(!t)return J({error:'消せる登録が見つかりません。'},404);
    await db.prepare(`DELETE FROM season_teams WHERE id=?`).bind(t.id).run();
    /* 本人が消したときは、その登録の確認の記録も消す（証拠の鍵・運営者のメモが残らないように） */
    await db.prepare(`DELETE FROM rank_reviews WHERE team_id=?`).bind(t.id).run();
    if(t.proof)await mediaDrop(env,db,'key=?',t.proof);
    return J({ok:true});
  }
  /* ---- 運営者 ---- */
  if(path==='/api/admin/seasons'&&req.method==='POST'){
    if(!isAdmin)return admErr();
    if(body.delete){const n=await db.prepare(`SELECT COUNT(*) AS c FROM season_teams WHERE season_id=?`).bind(+body.id).first();
      if(n&&n.c)return J({error:'登録されたパーティがあるシーズンは消せません（先にパーティを非表示にしてください）。'},400);
      await db.prepare(`DELETE FROM seasons WHERE id=?`).bind(+body.id).run();return J({ok:true})}
    const name=clean(body.name,40);if(!name)return J({error:'シーズンの名前を入れてください。'},400);
    const st=isDay(body.start)?body.start:null,en=isDay(body.end)?body.end:null;
    if(st&&en&&st>en)return J({error:'終わりの日が始まりの日より前です。'},400);
    const note=clean(body.note,2000)||null;
    if(body.id){await db.prepare(`UPDATE seasons SET name=?,start=?,end=?,note=? WHERE id=?`).bind(name,st,en,note,+body.id).run();return J({ok:true,id:+body.id})}
    const r=await db.prepare(`INSERT INTO seasons(name,start,end,note,created_at) VALUES(?,?,?,?,?) RETURNING id`).bind(name,st,en,note,now).first();
    return J({ok:true,id:r.id});
  }
  if(path==='/api/admin/season-teams'&&req.method==='GET'){
    if(!isAdmin)return admErr();
    const r=await db.prepare(`SELECT t.*,u.handle,u.name,s.name AS season FROM season_teams t LEFT JOIN users u ON u.uid=t.uid JOIN seasons s ON s.id=t.season_id
      ORDER BY t.updated_at DESC LIMIT 300`).all();
    /* 確かめる必要があるもの（もう一度確かめる・証拠あり未確認）を先に */
    const pri=x=>{const c=ladderSource(x);return c.pending?0:c.review==='awaiting'?1:2};
    const rows=r.results.slice().sort((a,b)=>pri(a)-pri(b)).slice(0,100);
    return J({teams:rows.map(x=>{const c=ladderSource(x);return{...ladderOut(x,''),review:c.review,pending:c.pending,reviewed_at:c.source==='verified'?x.reviewed_at:null,reviewed_by:c.source==='verified'?x.reviewed_by:null,
      legacy_verified:!!x.verified,season:x.season,season_id:x.season_id,hidden:!!x.hidden,proof_key:x.proof||null}})});
  }
  /* 出どころの分け方の試し（読むだけ・何も書きかえない）：いまの行が4つの出どころ・もう一度確かめる、にいくつずつ分かれるか */
  if(path==='/api/admin/season-teams/classify'&&req.method==='GET'){
    if(!isAdmin)return admErr();
    const r=await db.prepare(`SELECT * FROM season_teams`).all();
    const out={total:r.results.length,by_source:{verified:0,self:0,article:0,operator:0},by_review:{reviewed:0,stale:0,rereview:0,awaiting:0,none:0},
      legacy_verified:{total:0,to:{verified:0,self:0,article:0,operator:0}},pending:0,hidden:0,rules:LADDER_RULES};
    for(const x of r.results){const c=ladderSource(x);out.by_source[c.source]++;out.by_review[c.review]++;if(c.pending)out.pending++;if(x.hidden)out.hidden++;
      if(x.verified){out.legacy_verified.total++;out.legacy_verified.to[c.source]++}}
    return J({dry_run:true,...out});
  }
  /* 確認の履歴 */
  if((m=path.match(/^\/api\/admin\/season-teams\/(\d+)\/reviews$/))&&req.method==='GET'){
    if(!isAdmin)return admErr();
    const r=await db.prepare(`SELECT action,proof,by,note,created_at FROM rank_reviews WHERE team_id=? ORDER BY id DESC LIMIT 50`).bind(+m[1]).all();
    return J({reviews:r.results});
  }
  if(path==='/api/admin/season-teams'&&req.method==='POST'){
    if(!isAdmin)return admErr();
    /* 確認済みにする（証拠を見たことを記録する）・確認を外す・非表示にする */
    if(body.id){const id=+body.id;
      let act=body.review==='verify'||body.review==='unverify'?body.review:('verified' in body?(body.verified?'verify':'unverify'):null);
      if(act){
        const t=await db.prepare(`SELECT * FROM season_teams WHERE id=?`).bind(id).first();
        if(!t)return J({error:'登録が見つかりません。'},404);
        const who='admin'+(clean(body.reviewer,30)?':'+clean(body.reviewer,30):'');
        if(act==='verify'){
          if(t.auto)return J({error:'記事から集計したパーティは確認済みにできません（出典で照らし合わせたものとして別に扱います）。'},400);
          if(!t.proof)return J({error:'証拠のスクリーンショットがない登録は確認済みにできません。'},400);
          const pm=await db.prepare(`SELECT key FROM media WHERE key=?`).bind(t.proof).first();
          if(!pm)return J({error:'証拠のスクリーンショットが見つかりません。'},400);
          if(body.proof!==undefined&&body.proof!==t.proof)return J({error:'見た証拠が今の証拠と違います。画面を読み直してください。'},409);
          const sig=ladderSig(t);
          await db.prepare(`UPDATE season_teams SET reviewed_at=?,reviewed_by=?,reviewed_proof=?,review_sig=? WHERE id=?`).bind(now,who,t.proof,sig,id).run();
          await ladderLog(db,id,'verify',t.proof,sig,who,clean(body.note,200)||null,now);
        }else{
          await db.prepare(`UPDATE season_teams SET reviewed_at=NULL,reviewed_by=NULL,reviewed_proof=NULL,review_sig=NULL,verified=0 WHERE id=?`).bind(id).run();
          await ladderLog(db,id,'unverify',t.proof||null,null,who,clean(body.note,200)||null,now);
        }
      }
      if('hidden' in body)await db.prepare(`UPDATE season_teams SET hidden=? WHERE id=?`).bind(body.hidden?1:0,id).run();
      if(body.delete){const t=await db.prepare(`SELECT proof FROM season_teams WHERE id=?`).bind(id).first();await db.prepare(`DELETE FROM season_teams WHERE id=?`).bind(id).run();if(t&&t.proof)await mediaDrop(env,db,'key=?',t.proof)}
      return J({ok:true})}
    /* 運営者が登録する（「運営が登録」。証拠がないので確認済みにはしない） */
    const s=await db.prepare(`SELECT id FROM seasons WHERE id=?`).bind(+body.season_id).first();if(!s)return J({error:'シーズンを選んでください。'},400);
    const team=ladderTeam(body.team);if(!team)return J({error:'パーティ（1〜6匹）を選んでください。'},400);
    const player=clean(body.player,30);if(!player)return J({error:'プレイヤーの名前を入れてください。'},400);
    const rank=intOrNull(body.rank,1e6),rate=intOrNull(body.rate,9999);
    const r=await db.prepare(`INSERT INTO season_teams(season_id,fmt,player,rank,rate,team,comment,verified,by_admin,created_at,updated_at) VALUES(?,?,?,?,?,?,?,0,1,?,?) RETURNING id`)
      .bind(s.id,body.fmt==='double'?'double':'single',player,rank,rate,team,clean(body.comment,140),now,now).first();
    return J({ok:true,id:r.id});
  }
  return null;
}
