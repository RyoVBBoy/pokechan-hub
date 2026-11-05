/* ===================== アクセス解析（どの画面がどれだけ開かれたか） =====================
   クッキー・IPアドレス・利用者の番号は保存しない。日付ごと・画面ごとの回数だけを数える（page_hits）。
   ・POST /api/hit（本文 {k:'画面', v:1=この訪問の最初の画面, d:'sp'|'pc', r:'search'|'social'|'direct'|'other'}）。sendBeacon で送るので text/plain
   ・GET /api/admin/hits?days=30（管理者だけ） */
let HITS_READY=false;
async function hitsInit(db){
  if(HITS_READY)return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS page_hits(day TEXT NOT NULL,k TEXT NOT NULL,n INTEGER DEFAULT 0,PRIMARY KEY(day,k))`).run();
  HITS_READY=true;
}
const hitDay=now=>new Date(now+9*36e5).toISOString().slice(0,10);
/* 使用量の記録（2026/11/05 管理画面の「使用量」）：page_hits に日付ごとの合計として足す。_req＝サーバーへのアクセス（20回に1回だけ書いて20を足す見積もり）、_ai＝AI を呼んだ回数、_ai_ng＝混雑・回数制限で断られた回数 */
async function useTick(env,k,n=1){try{if(!env||!env.DB)return;await hitsInit(env.DB);await env.DB.prepare(`INSERT INTO page_hits(day,k,n) VALUES(?,?,?) ON CONFLICT(day,k) DO UPDATE SET n=n+?3`).bind(hitDay(Date.now()),k,n).run()}catch(e){}}
const aiTick=(env,st)=>useTick(env,[429,503].includes(st)?'_ai_ng':'_ai');
async function hitsApi(req,env,db,path,now,isAdmin){
  if(path==='/api/hit'&&req.method==='POST'){
    let b={};try{b=JSON.parse(await req.text())}catch(e){}
    const k=String(b.k||'').slice(0,24);if(!/^[a-z0-9_-]{0,24}$/.test(k))return new Response(null,{status:204});
    await hitsInit(db);const day=hitDay(now),keys=['p:'+(k||'home')];
    if(b.v){keys.push('_visit');if(b.d==='pc'||b.d==='sp')keys.push('d:'+b.d);if(['search','social','direct','other'].includes(b.r))keys.push('r:'+b.r)}
    await db.batch(keys.map(x=>db.prepare(`INSERT INTO page_hits(day,k,n) VALUES(?,?,1) ON CONFLICT(day,k) DO UPDATE SET n=n+1`).bind(day,x)));
    return new Response(null,{status:204});
  }
  /* 使用量（無料枠の目安と比べる） */
  if(path==='/api/admin/quota'&&req.method==='GET'){
    if(!isAdmin)return J({error:'管理用の合言葉が違います。'},401);
    await hitsInit(db);const since=hitDay(now-6*864e5);
    const rows=(await db.prepare(`SELECT day,k,n FROM page_hits WHERE day>=? AND (substr(k,1,1)='_' OR substr(k,1,2)='p:')`).bind(since).all()).results;
    const days={};rows.forEach(r=>{const d=days[r.day]||(days[r.day]={req:0,ai:0,ai_ng:0,visit:0,view:0});
      if(r.k==='_req')d.req+=r.n;else if(r.k==='_ai')d.ai+=r.n;else if(r.k==='_ai_ng')d.ai_ng+=r.n;else if(r.k==='_visit')d.visit+=r.n;else if(r.k.startsWith('p:'))d.view+=r.n});
    const one=async(sql,...a)=>{try{return await db.prepare(sql).bind(...a).first()}catch(e){return null}};
    const sz=await db.prepare(`SELECT COUNT(*) AS n FROM users`).run().catch(()=>null);
    const med=await one(`SELECT COUNT(*) AS n,COALESCE(SUM(CASE WHEN store='r2' THEN 0 ELSE size END),0) AS d1,COALESCE(SUM(CASE WHEN store='r2' THEN size ELSE 0 END),0) AS r2 FROM media`);
    const users=await one(`SELECT COUNT(*) AS n FROM users WHERE uid NOT LIKE 'bot:%'`);
    const t0=now-864e5;
    const reads=await one(`SELECT (SELECT COUNT(*) FROM opp_reads WHERE created_at>?1) AS opp`,t0);
    const rep=await one(`SELECT COUNT(*) AS n FROM replay_reads WHERE created_at>?`,t0);
    const notes=await one(`SELECT COUNT(*) AS n FROM notes WHERE created_at>?`,t0);
    return J({days,today:hitDay(now),db_bytes:sz&&sz.meta&&sz.meta.size_after||null,media:med,r2:!!env.MEDIA,users:users&&users.n,
      opp_reads:reads&&reads.opp||0,replay_reads:rep&&rep.n||0,notes:notes&&notes.n||0,ai2:!!env.ANTHROPIC_API_KEY});
  }
  if(path==='/api/admin/hits'&&req.method==='GET'){
    if(!isAdmin)return J({error:'管理用の合言葉が違います。'},401);
    await hitsInit(db);const days=Math.max(1,Math.min(90,+new URL(req.url).searchParams.get('days')||30));
    const r=await db.prepare(`SELECT day,k,n FROM page_hits WHERE day>=? ORDER BY day`).bind(hitDay(now-(days-1)*864e5)).all();
    return J({days,rows:r.results});
  }
  return null;
}
