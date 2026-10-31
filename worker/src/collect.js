/* ===================== 上位パーティの自動集計（記事から事実だけを集めて照らし合わせる） =====================
   方針：記事の文章は使わない。Gemini には「事実（プレイヤー・順位・レート・6匹・持ち物/特性/技）を表にする」ことだけをさせ、
   文章はサイトの「シーズンのまとめ」（41-seasons.js の szSummary）が集計から作る。出典はリンクだけ。
   ・出典（col_sources）：運営者が貼ったページ＋Gemini が Google 検索で見つけたページ
   ・取り出した事実（col_items）：出典ごとに入れ直す（古いものは消す）
   ・照らし合わせ：同じプレイヤー名、または6匹のうち5匹以上が同じなら同じパーティとみなす。
     2つ以上の出典で一致したものだけを自動で season_teams に載せる（auto=1・出典のリンクつき）。
     出典が1つだけのものは「確認待ち」として管理画面に出し、運営者が載せるか決める
   ・毎日1回（Worker の cron）、期間中か終わって14日以内のシーズンを集め直す */
let COLLECT_READY=false;
async function collectInit(db){
  if(COLLECT_READY)return;
  await ladderInit(db);
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS col_sources(id INTEGER PRIMARY KEY AUTOINCREMENT,season_id INTEGER NOT NULL,fmt TEXT NOT NULL,url TEXT NOT NULL,title TEXT,kind TEXT,status TEXT,err TEXT,n INTEGER DEFAULT 0,last_at INTEGER,created_at INTEGER,UNIQUE(season_id,fmt,url))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS col_items(id INTEGER PRIMARY KEY AUTOINCREMENT,source_id INTEGER NOT NULL,season_id INTEGER NOT NULL,fmt TEXT NOT NULL,player TEXT,rank INTEGER,rate INTEGER,team TEXT,nos TEXT,unknown TEXT,created_at INTEGER)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS col_items_s ON col_items(season_id,fmt)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS col_skip(season_id INTEGER,fmt TEXT,gkey TEXT,PRIMARY KEY(season_id,fmt,gkey))`)
  ]);
  for(const c of ['auto INTEGER DEFAULT 0','sources TEXT','gkey TEXT']){try{await db.prepare(`ALTER TABLE season_teams ADD COLUMN ${c}`).run()}catch(e){}}
  COLLECT_READY=true;
}
const okUrl=u=>{try{const x=new URL(String(u));return /^https?:$/.test(x.protocol)&&x.href.length<=600?x.href:null}catch(e){return null}};
/* ---- 名前を図鑑・技・持ち物・特性の番号に ---- */
let REV=null;
function revMaps(){
  if(REV)return REV;
  const it={},ab={},mv={};
  for(const k in ITEMN)it[kkey(ITEMN[k])]=k;
  for(const k in ABN)ab[kkey(ABN[k])]=k;
  for(const id in MV)mv[kkey(MV[id][0])]=+id;
  return REV={it,ab,mv};
}
const REGION=['アローラ','ガラル','ヒスイ','パルデア'];
function monOf(name){
  let s=String(name||'').replace(/^メガ/,'').trim();if(!s)return null;
  let m=BYKEY.get(kkey(s));
  if(!m){/* 「アローラライチュウ」「ライチュウ(アローラのすがた)」などの書き方を「ライチュウ（アローラ）」にそろえる */
    const rg=REGION.find(r=>s.includes(r));
    if(rg){const base=s.replace(rg,'').replace(/[（(].*?[)）]|のすがた|すがた|フォルム/g,'').trim();m=BYKEY.get(kkey(base+'（'+rg+'）'))}}
  if(!m){const e=s.toLowerCase().replace(/[^a-z]/g,'');if(e.length>=3)m=MON.find(x=>x.en&&x.en.toLowerCase().replace(/[^a-z]/g,'')===e)||null}
  return m||null;
}
function teamOf(list){
  const R=revMaps(),out=[],unknown=[];
  for(const x of (Array.isArray(list)?list:[]).slice(0,6)){
    const m=monOf(x&&x.name);if(!m){if(x&&x.name)unknown.push(String(x.name).slice(0,30));continue}
    if(out.some(o=>o.no===m.no))continue;
    const set={};
    const it=x.item&&R.it[kkey(x.item)];if(it)set.it={k:it};
    const ab=x.ability&&R.ab[kkey(x.ability)];if(ab)set.ab={k:ab};
    const mv=(Array.isArray(x.moves)?x.moves:[]).map(n=>R.mv[kkey(n)]).filter(Boolean).slice(0,4);if(mv.length)set.mv=mv.map(id=>({id}));
    out.push(Object.keys(set).length?{no:m.no,set}:{no:m.no});
  }
  return{team:out,unknown};
}
/* ---- Gemini（文章を書かせない。事実だけ JSON で） ---- */
async function gemText(env,body,fast){
  let cands=env.GEMINI_MODEL?[env.GEMINI_MODEL]:[];
  try{cands=[...new Set([...cands,...await listGemini(env)])]}catch(e){if(!cands.length)throw e}
  let last='';
  for(const m of cands.slice(0,3)){
    /* fast：考える時間（thinking）を使わない（2.5 Flash のとき） */
    const bd=fast&&/gemini-2\.5-flash/.test(m)?{...body,generationConfig:{...(body.generationConfig||{}),thinkingConfig:{thinkingBudget:0}}}:body;
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,{method:'POST',headers:{'x-goog-api-key':env.GEMINI_API_KEY,'content-type':'application/json'},body:JSON.stringify(bd)});
    if(r.ok){const j=await r.json();const c=(j.candidates||[])[0]||{};return{text:(c.content&&c.content.parts||[]).map(p=>p.text||'').join(''),meta:c.groundingMetadata||null}}
    const t=await r.text();try{last=JSON.parse(t).error.message}catch(e){last=t}
    if(![404,429,500,503].includes(r.status))throw new Error(`Gemini ${r.status} ${String(last).slice(0,80)}`);
  }
  throw new Error('Gemini が混雑中か、無料枠の回数制限です（'+String(last).slice(0,60)+'）');
}
const FMT_JA=f=>f==='double'?'ダブル':'シングル';
const EXTRACT_PROMPT=(s,fmt,url)=>`あなたは「事実を取り出す係」です。文章（感想・解説・要約・言いかえ）は一切書かないでください。
次のページを読み、ポケモンチャンピオンズのランクバトル「${s.name}」${s.start||s.end?`（${s.start||''}〜${s.end||''}）`:''}・${FMT_JA(fmt)}で上位になったプレイヤーのパーティについて、ページに書かれている事実だけを取り出してください。
ページ：${url}
決まり：
- ページに書かれていないことは推測しない。わからない項目は null。
- 対象と違うシーズン・違う形式（シングル/ダブル）のパーティは入れない。対象に関係のないページなら teams は空にする。
- ポケモンの名前は日本語の正式名。地方の姿は「ライチュウ（アローラ）」の形。メガシンカしているものは元のポケモンの名前にして、持ち物にメガストーンの名前を書く。
- 持ち物・特性・技も日本語の正式名。書かれていなければ null や空。
次の JSON だけを返してください（ほかの文字は書かない）：
{"page_season":"ページに書かれたシーズン名か null","page_format":"single か double か unknown","teams":[{"player":"名前か null","rank":数 か null,"rate":数 か null,"pokemon":[{"name":"","item":null,"ability":null,"moves":[]}]}]}`;
async function collectExtract(env,s,fmt,url){
  const {text}=await gemText(env,{contents:[{parts:[{text:EXTRACT_PROMPT(s,fmt,url)}]}],tools:[{url_context:{}}],generationConfig:{temperature:0}});
  const mm=String(text).match(/\{[\s\S]*\}/);if(!mm)throw new Error('Gemini の答えを読めませんでした');
  const o=JSON.parse(mm[0]);
  if(o.page_format==='single'&&fmt==='double'||o.page_format==='double'&&fmt==='single')return[];
  return(Array.isArray(o.teams)?o.teams:[]).slice(0,60).map(t=>({player:typeof t.player==='string'?t.player.slice(0,30):null,
    rank:intOrNull(t.rank,1e6),rate:intOrNull(t.rate,9999),...teamOf(t.pokemon)})).filter(t=>t.team.length>=4);
}
/* Google 検索で出典の候補を探す（見つけたページのアドレスだけを使う） */
async function collectFind(env,db,s,fmt,now){
  const q=`ポケモンチャンピオンズ ${s.name} ${FMT_JA(fmt)} 上位 構築 パーティ 最終順位`;
  const {meta}=await gemText(env,{contents:[{parts:[{text:`次の言葉で検索して、「${s.name}」${FMT_JA(fmt)}の上位プレイヤーのパーティ（6匹）が載っているページを探してください：${q}\n見つけたページの題名だけを1行ずつ書いてください。`}]}],tools:[{google_search:{}}],generationConfig:{temperature:0}});
  const found=((meta&&meta.groundingChunks)||[]).map(c=>c.web).filter(w=>w&&okUrl(w.uri)).slice(0,6);
  for(const w of found)await db.prepare(`INSERT OR IGNORE INTO col_sources(season_id,fmt,url,title,kind,status,created_at) VALUES(?,?,?,?,'found','new',?)`).bind(s.id,fmt,okUrl(w.uri),String(w.title||'').slice(0,120),now).run();
  return found.length;
}
/* ---- 照らし合わせ ---- */
const pkey=p=>String(p||'').normalize('NFKC').toLowerCase().replace(/[\s_\-・.]/g,'');
const same=(a,b)=>(pkey(a.player)&&pkey(a.player)===pkey(b.player))||a.nos.filter(n=>b.nos.includes(n)).length>=5;
function collectGroups(items){
  const par=items.map((_,i)=>i),f=i=>par[i]===i?i:(par[i]=f(par[i]));
  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++)if(same(items[i],items[j]))par[f(i)]=f(j);
  const g={};items.forEach((x,i)=>{(g[f(i)]=g[f(i)]||[]).push(x)});
  return Object.values(g).map(list=>{
    const srcs=[...new Set(list.map(x=>x.source_id))];
    const mode=a=>{const c={};a.filter(v=>v!=null&&v!=='').forEach(v=>c[v]=(c[v]||0)+1);const e=Object.entries(c).sort((x,y)=>y[1]-x[1]);return e.length?e[0][0]:null};
    /* 6匹：多くの出典に出てくる順 */
    const cnt={};list.forEach(x=>x.nos.forEach(n=>cnt[n]=(cnt[n]||0)+1));
    const nos=Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([n])=>+n);
    /* 育成：同じポケモンについて書かれた持ち物・特性・技の多いほう */
    const team=nos.map(no=>{const sets=list.flatMap(x=>x.team.filter(t=>t.no===no&&t.set).map(t=>t.set));if(!sets.length)return{no};
      const set={};const it=mode(sets.map(s=>s.it&&s.it.k)),ab=mode(sets.map(s=>s.ab&&s.ab.k));if(it)set.it={k:it};if(ab)set.ab={k:ab};
      const mv=sets.map(s=>s.mv||[]).sort((a,b)=>b.length-a.length)[0];if(mv&&mv.length)set.mv=mv;return{no,set}});
    const rank=mode(list.map(x=>x.rank)),rate=mode(list.map(x=>x.rate)),player=mode(list.map(x=>x.player));
    const ranks=new Set(list.map(x=>x.rank).filter(Boolean));
    return{srcs,team,nos,rank:rank?+rank:null,rate:rate?+rate:null,player,gkey:[...nos].sort((a,b)=>a-b).join('-'),conflict:ranks.size>1};
  });
}
async function collectReconcile(db,sid,fmt,now){
  const rows=(await db.prepare(`SELECT i.*,s.url FROM col_items i JOIN col_sources s ON s.id=i.source_id WHERE i.season_id=? AND i.fmt=?`).bind(sid,fmt).all()).results;
  const items=rows.map(r=>({...r,team:JSON.parse(r.team||'[]'),nos:JSON.parse(r.nos||'[]')}));
  const urls={};rows.forEach(r=>urls[r.source_id]=r.url);
  const groups=collectGroups(items);
  const skip=new Set((await db.prepare(`SELECT gkey FROM col_skip WHERE season_id=? AND fmt=?`).bind(sid,fmt).all()).results.map(x=>x.gkey));
  const have=(await db.prepare(`SELECT id,team,auto,player,gkey FROM season_teams WHERE season_id=? AND fmt=?`).bind(sid,fmt).all()).results
    .map(r=>({...r,nos:JSON.parse(r.team||'[]').map(x=>x.no)}));
  let pub=0;const pending=[];
  for(const g of groups){
    if(skip.has(g.gkey))continue;
    const hit=have.find(h=>(h.auto&&h.gkey===g.gkey)||same({player:h.player,nos:h.nos},g));
    if(hit&&!hit.auto)continue; /* 本人や運営者の登録があれば、そちらを優先 */
    if(g.srcs.length<2){if(!hit)pending.push({...g,urls:g.srcs.map(s=>urls[s])});continue}
    await collectPublish(db,sid,fmt,g,g.srcs.map(s=>urls[s]),now,hit&&hit.id);pub++;
  }
  return{published:pub,pending,groups:groups.length};
}
async function collectPublish(db,sid,fmt,g,urls,now,id){
  const team=JSON.stringify(g.team),src=JSON.stringify(urls.filter(Boolean).slice(0,8));
  if(id)await db.prepare(`UPDATE season_teams SET player=?,rank=?,rate=?,team=?,sources=?,gkey=?,updated_at=? WHERE id=?`).bind(g.player||'',g.rank,g.rate,team,src,g.gkey,now,id).run();
  else await db.prepare(`INSERT INTO season_teams(season_id,fmt,player,rank,rate,team,comment,verified,by_admin,auto,sources,gkey,created_at,updated_at) VALUES(?,?,?,?,?,?,'',0,1,1,?,?,?,?)`)
    .bind(sid,fmt,g.player||'',g.rank,g.rate,team,src,g.gkey,now,now).run();
}
/* 1つのシーズン・形式を集め直す（出典は古い順に最大6つ） */
async function collectRun(env,db,sid,fmt,now){
  if(!env.GEMINI_API_KEY)throw new Error('サーバーに GEMINI_API_KEY が設定されていません。');
  const s=await db.prepare(`SELECT id,name,start,end FROM seasons WHERE id=?`).bind(sid).first();if(!s)throw new Error('シーズンが見つかりません。');
  let srcs=(await db.prepare(`SELECT * FROM col_sources WHERE season_id=? AND fmt=? AND status!='off' ORDER BY COALESCE(last_at,0) LIMIT 6`).bind(sid,fmt).all()).results;
  if(!srcs.length){await collectFind(env,db,s,fmt,now);srcs=(await db.prepare(`SELECT * FROM col_sources WHERE season_id=? AND fmt=? AND status!='off' LIMIT 6`).bind(sid,fmt).all()).results}
  const log=[];
  for(const src of srcs){
    try{const ts=await collectExtract(env,s,fmt,src.url);
      await db.batch([db.prepare(`DELETE FROM col_items WHERE source_id=?`).bind(src.id),
        ...ts.map(t=>db.prepare(`INSERT INTO col_items(source_id,season_id,fmt,player,rank,rate,team,nos,unknown,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`)
          .bind(src.id,sid,fmt,t.player,t.rank,t.rate,JSON.stringify(t.team),JSON.stringify(t.team.map(x=>x.no)),t.unknown.length?JSON.stringify(t.unknown):null,now)),
        db.prepare(`UPDATE col_sources SET status='ok',err=NULL,n=?,last_at=? WHERE id=?`).bind(ts.length,now,src.id)]);
      log.push({url:src.url,n:ts.length})}
    catch(e){await db.prepare(`UPDATE col_sources SET status='err',err=?,last_at=? WHERE id=?`).bind(String(e.message||e).slice(0,200),now,src.id).run();log.push({url:src.url,err:String(e.message||e)})}
  }
  return{...await collectReconcile(db,sid,fmt,now),log};
}
async function collectApi(req,env,db,path,body,now,isAdmin){
  if(!/^\/api\/admin\/collect/.test(path))return null;
  if(!isAdmin)return J({error:'管理用の合言葉が違います。'},401);
  await collectInit(db);
  const sid=+body.season_id||+(new URL(req.url).searchParams.get('season_id'))||0,fmt=(body.fmt||new URL(req.url).searchParams.get('fmt'))==='double'?'double':'single';
  if(path==='/api/admin/collect'&&req.method==='GET'){
    const src=(await db.prepare(`SELECT id,url,title,kind,status,err,n,last_at FROM col_sources WHERE season_id=? AND fmt=? ORDER BY id`).bind(sid,fmt).all()).results;
    const r=await collectReconcile(db,sid,fmt,now);
    return J({sources:src,pending:r.pending.map(g=>({gkey:g.gkey,team:g.team,rank:g.rank,rate:g.rate,player:g.player,urls:g.urls}))});
  }
  if(path==='/api/admin/collect/source'&&req.method==='POST'){
    if(body.delete){await db.batch([db.prepare(`DELETE FROM col_items WHERE source_id=?`).bind(+body.id),db.prepare(`DELETE FROM col_sources WHERE id=?`).bind(+body.id)]);return J({ok:true})}
    const url=okUrl(body.url);if(!url)return J({error:'ページのアドレス（https://〜）を入れてください。'},400);
    await db.prepare(`INSERT OR IGNORE INTO col_sources(season_id,fmt,url,title,kind,status,created_at) VALUES(?,?,?,?,'manual','new',?)`).bind(sid,fmt,url,String(body.title||'').slice(0,120),now).run();
    return J({ok:true});
  }
  if(path==='/api/admin/collect/find'&&req.method==='POST'){
    const s=await db.prepare(`SELECT id,name,start,end FROM seasons WHERE id=?`).bind(sid).first();if(!s)return J({error:'シーズンが見つかりません。'},404);
    if(!env.GEMINI_API_KEY)return J({error:'サーバーに GEMINI_API_KEY が設定されていません。'},400);
    try{return J({ok:true,found:await collectFind(env,db,s,fmt,now)})}catch(e){return J({error:e.message},502)}
  }
  if(path==='/api/admin/collect/run'&&req.method==='POST'){
    try{const r=await collectRun(env,db,sid,fmt,now);return J({ok:true,published:r.published,pending:r.pending.length,log:r.log})}catch(e){return J({error:e.message},400)}
  }
  /* 出典が1つだけのものを、運営者が確かめて載せる／載せない */
  if(path==='/api/admin/collect/decide'&&req.method==='POST'){
    const r=await collectReconcile(db,sid,fmt,now),g=r.pending.find(x=>x.gkey===String(body.gkey));
    if(!g)return J({error:'見つかりません（もう載っているか、集め直された可能性があります）。'},404);
    if(body.publish)await collectPublish(db,sid,fmt,g,g.urls,now,null);
    else await db.prepare(`INSERT OR IGNORE INTO col_skip(season_id,fmt,gkey) VALUES(?,?,?)`).bind(sid,fmt,g.gkey).run();
    return J({ok:true});
  }
  return J({error:'見つかりません。'},404);
}
/* 毎日1回：期間中か、終わって14日以内のシーズンを集め直す */
async function collectDaily(env){
  if(!env.DB||!env.GEMINI_API_KEY)return;
  const db=env.DB;await collectInit(db);const now=Date.now(),d=new Date(now-14*864e5).toISOString().slice(0,10);
  const ss=(await db.prepare(`SELECT id FROM seasons WHERE end IS NULL OR end>=?`).bind(d).all()).results;
  for(const s of ss.slice(0,2))for(const fmt of ['single','double']){try{await collectRun(env,db,s.id,fmt,now)}catch(e){}}
}
