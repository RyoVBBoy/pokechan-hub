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
async function hitsApi(req,env,db,path,now,isAdmin){
  if(path==='/api/hit'&&req.method==='POST'){
    let b={};try{b=JSON.parse(await req.text())}catch(e){}
    const k=String(b.k||'').slice(0,24);if(!/^[a-z0-9_-]{0,24}$/.test(k))return new Response(null,{status:204});
    await hitsInit(db);const day=hitDay(now),keys=['p:'+(k||'home')];
    if(b.v){keys.push('_visit');if(b.d==='pc'||b.d==='sp')keys.push('d:'+b.d);if(['search','social','direct','other'].includes(b.r))keys.push('r:'+b.r)}
    await db.batch(keys.map(x=>db.prepare(`INSERT INTO page_hits(day,k,n) VALUES(?,?,1) ON CONFLICT(day,k) DO UPDATE SET n=n+1`).bind(day,x)));
    return new Response(null,{status:204});
  }
  if(path==='/api/admin/hits'&&req.method==='GET'){
    if(!isAdmin)return J({error:'管理用の合言葉が違います。'},401);
    await hitsInit(db);const days=Math.max(1,Math.min(90,+new URL(req.url).searchParams.get('days')||30));
    const r=await db.prepare(`SELECT day,k,n FROM page_hits WHERE day>=? ORDER BY day`).bind(hitDay(now-(days-1)*864e5)).all();
    return J({days,rows:r.results});
  }
  return null;
}
