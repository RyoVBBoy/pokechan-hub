/* ===================== 公式のお知らせの自動投稿（タイムライン） =====================
   ポケモンチャンピオンズの公式のお知らせを見つけたら、「お知らせbot」（@news_bot、非公式）が題名とリンクだけを投稿する。本文は写さない。
   ・見つけ方：運営者が管理画面で登録した「お知らせの一覧ページ」をサーバーで直接読み、/news/ を含むリンクから題名・日付・アドレスを取り出す（`newsFromHtml`）。
     リンクが見つからない（あとから読み込むページなど）ときは、ページの文字か、ページそのもの（url_context）を Gemini に読ませて題名・日付・アドレスだけを JSON で取り出す。
     登録がなければ Google 検索（google_search）で探し、見つかったページのアドレス（転送先を開いて本来のアドレスにする）を使う。
   ・公式のサイト（pokemonchampions.jp / pokemon.co.jp / pokemon.com / nintendo.co.jp / nintendo.com など）のアドレスだけを載せる。
   ・同じアドレスは1回だけ（news_seen）。1回に3件まで。cron（6時間ごと）と管理画面の「今すぐ確認」で動く */
const NEWS_UID='bot:news',NEWS_HOST=/(^|\.)(pokemonchampions\.jp|pokemonchampions\.com|pokemon\.co\.jp|pokemon\.com|nintendo\.co\.jp|nintendo\.com)$/i;
let NEWS_READY=false;
async function newsInit(db){
  if(NEWS_READY)return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS news_seen(url TEXT PRIMARY KEY,title TEXT,note_id INTEGER,created_at INTEGER)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS news_src(url TEXT PRIMARY KEY,created_at INTEGER)`)
  ]);
  try{await db.prepare(`ALTER TABLE notes ADD COLUMN link TEXT`).run()}catch(e){}
  NEWS_READY=true;
}
const newsOk=u=>{try{const x=new URL(String(u));return x.protocol==='https:'&&NEWS_HOST.test(x.hostname)&&x.href.length<=500?x.href:null}catch(e){return null}};
async function newsBot(db,now){
  const u=await db.prepare(`SELECT uid FROM users WHERE uid=?`).bind(NEWS_UID).first();
  if(!u)await db.prepare(`INSERT OR IGNORE INTO users(uid,handle,name,bio,created_at,updated_at,agreed_at) VALUES(?,?,?,?,?,?,?)`).bind(NEWS_UID,'news_bot','お知らせbot（非公式）','ポケモンチャンピオンズの公式サイトの新しいお知らせを、題名とリンクで自動で紹介します。このサイトは非公式のファンサイトです。',now,now,now).run();
}
/* 検索結果のリンク（Google の転送用アドレス）を開いて、本来のアドレスにする */
async function newsResolve(u){
  try{const x=new URL(u);if(!/grounding-api-redirect|vertexaisearch/.test(x.href))return u;
    const r=await fetch(u,{method:'GET',redirect:'manual'});return r.headers.get('location')||null}catch(e){return null}
}
/* 一覧ページの HTML から、お知らせへのリンク（/news/ を含むアドレス）と題名・日付を取り出す。サーバーで直接読むので、いちばん確実 */
const newsStrip=h=>String(h).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
function newsFromHtml(html,src){
  const out=[],base=new URL(src);
  for(const m of String(html).matchAll(/<a\s[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    let url;try{url=new URL(m[1].replace(/&amp;/g,'&'),src)}catch(e){continue}
    if(!/\/news\//.test(url.pathname)||url.href.replace(/[#?].*$/,'').replace(/\/$/,'')===base.href.replace(/[#?].*$/,'').replace(/\/$/,''))continue;
    if(/\/news\/?(page\/\d+\/?)?$/.test(url.pathname)||/[?&]page=/.test(url.search))continue;
    const ok=newsOk(url.href);if(!ok)continue;
    let t=newsStrip(m[2]);const d=t.match(/(20\d\d)[.\/年-]\s*(\d{1,2})[.\/月-]\s*(\d{1,2})日?/);
    const date=d?`${d[1]}-${String(d[2]).padStart(2,'0')}-${String(d[3]).padStart(2,'0')}`:null;
    if(d)t=t.replace(d[0],' ');t=t.replace(/\s+/g,' ').trim();
    if(t.length<4)continue;
    out.push({title:t.slice(0,100),date,url:ok});
  }
  return out;
}
async function newsFind(env,db,dbg){
  const srcs=(await db.prepare(`SELECT url FROM news_src ORDER BY created_at`).all()).results.map(r=>r.url);
  const out=[];dbg=dbg||{};dbg.src=[];
  for(const s of srcs.slice(0,3)){
    const d={url:s};dbg.src.push(d);
    let html='';
    try{const r=await fetch(s,{headers:{'user-agent':'Mozilla/5.0 (compatible; PokechanHub/1.0; +https://pokechan-hub.pages.dev)','accept':'text/html,application/xhtml+xml','accept-language':'ja,en;q=0.8'}});
      d.status=r.status;html=r.ok?await r.text():'';d.len=html.length}catch(e){d.err=String(e.message||e)}
    const a=html?newsFromHtml(html,s):[];d.links=a.length;
    if(a.length){out.push(...a);d.via='html';continue}
    /* HTML にリンクがない（あとから読み込むページなど）ときは、AI にページの文字かページそのものを読ませる */
    const ask=(page)=>`次は「ポケモンチャンピオンズ」の公式のお知らせの一覧ページ（${s}）${page?'の文字です':'です'}。お知らせのうち、新しいものから最大10件の「題名」「日付」「お知らせのページのアドレス」だけを取り出してください。題名はページに書かれたとおり。本文の要約や感想は書かないでください。
次の JSON だけを返してください：{"items":[{"title":"","date":"YYYY-MM-DD か null","url":""}]}${page?'\n---\n'+page:''}`;
    try{const txt=html?html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,'').replace(/\s+/g,' ').slice(0,60000):'';
      const {text}=await gemText(env,txt?{contents:[{parts:[{text:ask(txt)}]}],generationConfig:{temperature:0}}:{contents:[{parts:[{text:ask('')}]}],tools:[{url_context:{}}],generationConfig:{temperature:0}});
      let o={};try{o=JSON.parse((String(text).match(/\{[\s\S]*\}/)||['{}'])[0])}catch(e){}
      const before=out.length;
      (Array.isArray(o.items)?o.items:[]).forEach(it=>{let url=null;try{url=newsOk(new URL(String(it.url||''),s).href)}catch(e){}if(url&&it.title)out.push({title:String(it.title).slice(0,100),date:/^\d{4}-\d\d-\d\d$/.test(it.date||'')?it.date:null,url})});
      d.via=txt?'ai-text':'ai-url';d.ai=out.length-before}catch(e){d.aiErr=String(e.message||e).slice(0,120)}
  }
  if(!srcs.length){
    try{const {meta}=await gemText(env,{contents:[{parts:[{text:'ポケモンチャンピオンズ（Pokémon Champions）の公式サイトの新しいお知らせ（アップデート・レギュレーション・イベント・大会・メンテナンス）を検索してください。見つけたお知らせの題名だけを1行ずつ書いてください。'}]}],tools:[{google_search:{}}],generationConfig:{temperature:0}});
      for(const c of ((meta&&meta.groundingChunks)||[]).slice(0,10)){const w=c.web;if(!w)continue;const url=newsOk(await newsResolve(w.uri));if(url)out.push({title:String(w.title||'').slice(0,100),date:null,url})}}catch(e){dbg.searchErr=String(e.message||e).slice(0,120)}
  }
  const seen=new Set();return out.filter(x=>!seen.has(x.url)&&seen.add(x.url));
}
async function newsRun(env,db,now,max=3){
  await newsInit(db);await socialInit(db);
  if(!env.GEMINI_API_KEY)return{posted:0,found:0,error:'GEMINI_API_KEY がありません'};
  const dbg={};const items=await newsFind(env,db,dbg);let posted=0;const list=[];
  /* 初めて動いたときは、いまあるお知らせを「見たもの」として記録だけする（古いお知らせをまとめて投稿しない） */
  const first=!(await db.prepare(`SELECT 1 FROM news_seen LIMIT 1`).first());
  for(const it of items){
    const dup=await db.prepare(`SELECT 1 FROM news_seen WHERE url=?`).bind(it.url).first();if(dup)continue;
    if(first||posted>=max){await db.prepare(`INSERT OR IGNORE INTO news_seen(url,title,note_id,created_at) VALUES(?,?,0,?)`).bind(it.url,it.title,now).run();continue}
    await newsBot(db,now);
    const body=`【公式のお知らせ】${it.title}${it.date?`（${it.date.replace(/-/g,'/')}）`:''}`.slice(0,140);
    const r=await db.prepare(`INSERT INTO notes(uid,body,created_at,ip,reply_to,media,link) VALUES(?,?,?,?,0,NULL,?) RETURNING id`).bind(NEWS_UID,body,now,'bot',it.url).first();
    await db.prepare(`INSERT OR IGNORE INTO news_seen(url,title,note_id,created_at) VALUES(?,?,?,?)`).bind(it.url,it.title,r.id,now).run();
    posted++;list.push(it);
  }
  return{posted,found:items.length,first,items:list,dbg};
}
async function newsApi(req,env,db,path,now,isAdmin){
  if(!/^\/api\/admin\/news/.test(path))return null;
  if(!isAdmin)return J({error:'管理用の合言葉が違います。'},401);
  await newsInit(db);
  let b={};if(req.method==='POST'){try{b=JSON.parse(await req.text()||'{}')}catch(e){}}
  if(path==='/api/admin/news'&&req.method==='GET'){
    const src=(await db.prepare(`SELECT url FROM news_src ORDER BY created_at`).all()).results.map(r=>r.url);
    const seen=(await db.prepare(`SELECT url,title,note_id,created_at FROM news_seen ORDER BY created_at DESC LIMIT 30`).all()).results;
    return J({src,seen});
  }
  if(path==='/api/admin/news/src'&&req.method==='POST'){
    const url=newsOk(b.url);if(b.del){await db.prepare(`DELETE FROM news_src WHERE url=?`).bind(String(b.url||'')).run();return J({ok:true})}
    if(!url)return J({error:'公式サイト（pokemonchampions.jp・pokemon.co.jp・pokemon.com・nintendo.co.jp・nintendo.com）の https のアドレスを入れてください。'},400);
    await db.prepare(`INSERT OR IGNORE INTO news_src(url,created_at) VALUES(?,?)`).bind(url,now).run();return J({ok:true});
  }
  if(path==='/api/admin/news/run'&&req.method==='POST'){
    try{return J(await newsRun(env,db,now))}catch(e){return J({error:String(e.message||e)},502)}
  }
  /* 手で投稿する（自動で見つからなかったとき用）：題名とアドレス */
  if(path==='/api/admin/news/post'&&req.method==='POST'){
    const url=newsOk(b.url),title=String(b.title||'').trim().slice(0,100);
    if(!url||!title)return J({error:'題名と、公式サイトのアドレスを入れてください。'},400);
    await newsBot(db,now);await socialInit(db);
    const r=await db.prepare(`INSERT INTO notes(uid,body,created_at,ip,reply_to,media,link) VALUES(?,?,?,?,0,NULL,?) RETURNING id`).bind(NEWS_UID,`【公式のお知らせ】${title}`.slice(0,140),now,'bot',url).first();
    await db.prepare(`INSERT OR IGNORE INTO news_seen(url,title,note_id,created_at) VALUES(?,?,?,?)`).bind(url,title,r.id,now).run();
    return J({ok:true,id:r.id});
  }
  return J({error:'見つかりません。'},404);
}
async function newsCron(env){if(!env.DB)return;try{await newsRun(env,env.DB,Date.now())}catch(e){}}
