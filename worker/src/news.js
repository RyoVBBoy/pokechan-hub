/* ===================== 公式のお知らせの自動投稿（タイムライン） =====================
   ポケモンチャンピオンズの公式のお知らせを見つけたら、「お知らせbot」（@news_bot、非公式）が題名とリンクだけを投稿する。本文は写さない。
   ・見つけ方：運営者が管理画面で登録した「お知らせの一覧ページ」をサーバーで直接読み、/news/ を含むリンクから題名・日付・アドレスを取り出す（`newsFromHtml`）。
     リンクが見つからない（あとから読み込むページなど）ときは、ページの文字か、ページそのもの（url_context）を Gemini に読ませて題名・日付・アドレスだけを JSON で取り出す。
     登録がなければ Google 検索（google_search）で探し、見つかったページのアドレス（転送先を開いて本来のアドレスにする）を使う。
   ・公式のサイト（pokemonchampions.jp / pokemon.co.jp / pokemon.com / nintendo.co.jp / nintendo.com など）のアドレスだけを載せる。
   ・同じアドレスは1回だけ（news_seen）。1回に新しいものから3件まで投稿し、それより古い未投稿のものは記録だけ（まとめて投稿しない）。cron（6時間ごと）と管理画面の「今すぐ確認」で動く */
const NEWS_UID='bot:news',NEWS_HOST=/(^|\.)(pokemon-home\.com|pokemonchampions\.jp|pokemonchampions\.com|pokemon\.co\.jp|pokemon\.com|nintendo\.co\.jp|nintendo\.com)$/i;
/* 公式サイトのお知らせの種類（2026/11/03 依頼主の指定） */
const NEWS_CATS=['お知らせ','連携ソフト','メンテナンス','アップデート','不具合','アンケート','ランクバトル','レギュレーション','セレクト','バトルパス','キャンペーン','チャンピオンシップス','オンライン大会','オフライン大会'];
/* 公式サイト（pokemonchampions.jp/ja/news/）が読み込んでいるお知らせのデータ（2026/11/03 公式サイトのスクリプトから確認）：
   ① https://champions-news.pokemon-home.com/ja/json/list.json … {data:[{id,title,infoKind,kindTxt,stAt(秒),link:'page/865.html'}]}。記事は https://news.pokemon-home.com/ja/ ＋ link
   ② https://www.pokemonchampions.jp/news/ja.json … {news:[{id,title,kindTxt,stAt:'2026/03/24 23:00',link}]}。link はサイト内の相対か https
   infoKind 9（その他）は公式サイトと同じく「お知らせ」として扱う */
const NEWS_OFFICIAL=[{url:'https://champions-news.pokemon-home.com/ja/json/list.json',key:'data',base:'https://news.pokemon-home.com/ja/'},{url:'https://www.pokemonchampions.jp/news/ja.json',key:'news',base:'https://www.pokemonchampions.jp/'}];
const newsYmd=v=>{let t=0;if(typeof v==='number'||/^\d+$/.test(String(v||'')))t=+v*1000;else if(v){const d=new Date(String(v).replace(/\./g,'/')+' +0900');t=isNaN(d)?0:d.getTime()}return t?new Date(t+9*36e5).toISOString().slice(0,10):null};
async function newsFromOfficial(d){
  const out=[];d.official=[];
  for(const o of NEWS_OFFICIAL){
    try{const r=await fetch(o.url,{headers:{'user-agent':'Mozilla/5.0 (compatible; PokechanHub/1.0; +https://game-kids.app)',accept:'application/json'},cf:{cacheTtl:600}});
      d.official.push(o.url.replace(/^https:\/\//,'')+' '+r.status);if(!r.ok)continue;
      const j=await r.json();
      for(const x of (Array.isArray(j[o.key])?j[o.key]:[])){
        if(!x||!x.title||!x.link)continue;
        let url=null;try{url=newsOk(String(x.link).startsWith('https://')?x.link:new URL(String(x.link).replace(/^\//,''),o.base).href)}catch(e){}
        if(!url)continue;
        const kind=Number(x.infoKind)===9?'お知らせ':String(x.kindTxt||'');
        out.push({title:newsStrip(x.title).slice(0,100),date:newsYmd(x.stAt),url,cat:newsCat(kind)||null,ts:Number(x.stAt)||Date.parse(String(x.stAt||'').replace(/\./g,'/'))/1000||0})}
    }catch(e){d.official.push(o.url.replace(/^https:\/\//,'')+' err '+String(e.message||e).slice(0,60))}
  }
  return out.sort((a,b)=>(b.date||'').localeCompare(a.date||'')||b.ts-a.ts);
}
const newsCat=v=>{const t=typeof v==='string'?v:v&&typeof v==='object'?(v.name||v.label||v.title||v.ja||''):'';const s=String(t).trim();return NEWS_CATS.find(c=>s===c||s.includes(c))||null};
let NEWS_READY=false;
async function newsInit(db){
  if(NEWS_READY)return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS news_seen(url TEXT PRIMARY KEY,title TEXT,note_id INTEGER,created_at INTEGER)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS news_src(url TEXT PRIMARY KEY,created_at INTEGER)`)
  ]);
  for(const c of ['notes ADD COLUMN link TEXT','news_seen ADD COLUMN cat TEXT','news_seen ADD COLUMN date TEXT'])try{await db.prepare(`ALTER TABLE ${c}`).run()}catch(e){}
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
    if(d)t=t.replace(d[0],' ');
    /* 題名の前後にある種類の札（お知らせ・メンテナンス など）を取り出して、題名から外す */
    let cat=null;for(const c of NEWS_CATS){const re=new RegExp('(^|\\s)'+c+'(\\s|$)');if(re.test(t)){cat=c;t=t.replace(re,' ');break}}
    t=t.replace(/\s+/g,' ').trim();
    if(t.length<4)continue;
    out.push({title:t.slice(0,100),date,url:ok,cat});
  }
  return out;
}
/* ページが「あとから読み込む」作り（HTML にお知らせが無い）のときの探し方：
   ① HTML の中の JSON（__NEXT_DATA__・__NUXT__・application/json など）
   ② HTML と、同じサイトのスクリプトの中に書かれた「news を含むデータのアドレス（.json や /api/）」を開いて JSON を読む
   JSON の中から「題名らしい項目」と「日付」「アドレスか番号」を持つものを集める */
const NEWS_T=['title','name','subject','headline','heading','text'],NEWS_D=['date','publishedAt','published_at','publishDate','publish_date','releaseDate','release_date','startAt','start_at','createdAt','created_at','postDate','day','datetime'],NEWS_U=['url','link','href','path','permalink','uri'],NEWS_ID=['slug','id','key','code','newsId','news_id'];
function newsWalk(o,src,out,depth=0){
  if(!o||depth>8||out.length>60)return;
  if(Array.isArray(o)){o.forEach(x=>newsWalk(x,src,out,depth+1));return}
  if(typeof o!=='object')return;
  const pick=ks=>{for(const k of ks){const v=o[k];if(typeof v==='string'&&v.trim())return v.trim();if(v&&typeof v==='object'){for(const kk of ['ja','jp','ja-JP','value','text','rendered'])if(typeof v[kk]==='string')return v[kk]}}return null};
  const t=pick(NEWS_T),d=pick(NEWS_D);let u=pick(NEWS_U);const id=pick(NEWS_ID)||(typeof o.id==='number'?String(o.id):null);
  if(t&&t.length>=4&&t.length<=120&&(d||u)&&(u||id)){
    let url=null;try{url=u?new URL(u,src).href:null}catch(e){}
    if(!url&&id)url=new URL(String(id).replace(/^\//,'')+'/',src.replace(/[#?].*$/,'').replace(/\/?$/,'/')).href;
    const ok=url&&newsOk(url);
    const dm=d&&String(d).match(/(20\d\d)[-\/.年](\d{1,2})[-\/.月](\d{1,2})/);
    let cat=null;for(const k of ['category','categories','tag','tags','type','label','genre','kind']){const v=o[k];const a=Array.isArray(v)?v:[v];for(const x of a){cat=newsCat(x);if(cat)break}if(cat)break}
    if(ok)out.push({title:newsStrip(t).slice(0,100),date:dm?`${dm[1]}-${dm[2].padStart(2,'0')}-${dm[3].padStart(2,'0')}`:null,url:ok,cat});
  }
  for(const k in o)if(o[k]&&typeof o[k]==='object')newsWalk(o[k],src,out,depth+1);
}
async function newsFromData(html,src,d){
  const out=[],tried=[];
  for(const m of String(html).matchAll(/<script[^>]*(?:id="__NEXT_DATA__"|type="application\/(?:ld\+)?json")[^>]*>([\s\S]*?)<\/script>/gi)){try{newsWalk(JSON.parse(m[1]),src,out)}catch(e){}}
  const nu=String(html).match(/__NUXT_DATA__[^>]*>([\s\S]*?)<\/script>/);if(nu){try{newsWalk(JSON.parse(nu[1]),src,out)}catch(e){}}
  if(out.length){d.data='inline';return out}
  const origin=new URL(src).origin,cand=new Set();
  const grab=txt=>{for(const m of String(txt).matchAll(/["'`]((?:https?:\/\/[^"'`\s]+)?\/[^"'`\s<>]*?(?:news|info|notice|topics)[^"'`\s<>]*?(?:\.json|\/api\/[^"'`\s<>]*|\?[^"'`\s<>]*)?)["'`]/gi)){let u;try{u=new URL(m[1],src)}catch(e){continue}
    if(/\.(png|jpe?g|webp|gif|svg|css|woff2?|mp4)(\?|$)/i.test(u.pathname))continue;if(/\.json$|\/api\//i.test(u.pathname)||/\.json\?|api/i.test(u.href))cand.add(u.href)}};
  grab(html);
  const scripts=[...String(html).matchAll(/<script[^>]*src="([^"]+)"/gi)].map(m=>{try{return new URL(m[1],src)}catch(e){return null}}).filter(u=>u&&u.origin===origin).slice(0,6);
  for(const u of scripts){try{const r=await fetch(u.href);if(r.ok){const t=await r.text();if(t.length<3e6)grab(t)}}catch(e){}}
  d.scripts=scripts.length;d.cand=[...cand].slice(0,8);
  for(const c of [...cand].slice(0,6)){try{const r=await fetch(c,{headers:{accept:'application/json,*/*'}});tried.push(c+' '+r.status);if(!r.ok)continue;const t=await r.text();let j;try{j=JSON.parse(t)}catch(e){continue}const before=out.length;newsWalk(j,src,out);if(out.length>before){d.data=c;break}}catch(e){tried.push(c+' err')}}
  d.tried=tried;return out;
}
/* 検索で探す：Google 検索の結果のアドレスを本来のアドレスにし、題名はそのページの <title> から（取れなければ検索結果の題名） */
async function newsFromSearch(env,q,d){
  const out=[];
  const {meta}=await gemText(env,{contents:[{parts:[{text:`次の言葉で検索して、見つけたお知らせの題名だけを1行ずつ書いてください：${q}`}]}],tools:[{google_search:{}}],generationConfig:{temperature:0}});
  const ch=((meta&&meta.groundingChunks)||[]).slice(0,10);d.search=ch.length;
  for(const c of ch){const w=c.web;if(!w)continue;const url=newsOk(await newsResolve(w.uri));if(!url)continue;
    let title=String(w.title||'');
    try{const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (compatible; PokechanHub/1.0)'}});if(r.ok){const h=await r.text();const m=h.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)||h.match(/<title>([^<]+)<\/title>/i);if(m)title=newsStrip(m[1]).replace(/\s*[|｜\-–]\s*(Pok[eé]mon Champions|ポケモンチャンピオンズ).*$/i,'')}}catch(e){}
    if(title.length>=4&&!/^(www\.)?[a-z0-9.-]+\.[a-z]+$/i.test(title))out.push({title:title.slice(0,100),date:null,url})}
  return out;
}
async function newsFind(env,db,dbg){
  dbg=dbg||{};
  /* まず公式サイトのお知らせのデータを直接読む（いちばん確実） */
  try{const o=await newsFromOfficial(dbg);if(o.length){dbg.via='official';return o}}catch(e){dbg.officialErr=String(e.message||e).slice(0,100)}
  const srcs=(await db.prepare(`SELECT url FROM news_src ORDER BY created_at`).all()).results.map(r=>r.url);
  const out=[];dbg.src=[];
  for(const s of srcs.slice(0,3)){
    const d={url:s};dbg.src.push(d);
    let html='';
    try{const r=await fetch(s,{headers:{'user-agent':'Mozilla/5.0 (compatible; PokechanHub/1.0; +https://game-kids.app)','accept':'text/html,application/xhtml+xml','accept-language':'ja,en;q=0.8'}});
      d.status=r.status;html=r.ok?await r.text():'';d.len=html.length}catch(e){d.err=String(e.message||e)}
    const a=html?newsFromHtml(html,s):[];d.links=a.length;
    if(a.length){out.push(...a);d.via='html';continue}
    if(html){try{const j=await newsFromData(html,s,d);if(j.length){out.push(...j);d.via='data';continue}}catch(e){d.dataErr=String(e.message||e).slice(0,100)}}
    /* HTML にリンクがない（あとから読み込むページなど）ときは、AI にページの文字かページそのものを読ませる */
    const ask=(page)=>`次は「ポケモンチャンピオンズ」の公式のお知らせの一覧ページ（${s}）${page?'の文字です':'です'}。お知らせのうち、新しいものから最大10件の「題名」「日付」「お知らせのページのアドレス」だけを取り出してください。題名はページに書かれたとおり。本文の要約や感想は書かないでください。
ページに種類（${NEWS_CATS.join("・")}）が書かれていれば category に入れてください。
次の JSON だけを返してください：{"items":[{"title":"","date":"YYYY-MM-DD か null","url":"","category":"種類か null"}]}${page?'\n---\n'+page:''}`;
    try{const txt=html?html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,'').replace(/\s+/g,' ').slice(0,60000):'';
      const {text}=await gemText(env,txt?{contents:[{parts:[{text:ask(txt)}]}],generationConfig:{temperature:0}}:{contents:[{parts:[{text:ask('')}]}],tools:[{url_context:{}}],generationConfig:{temperature:0}});
      let o={};try{o=JSON.parse((String(text).match(/\{[\s\S]*\}/)||['{}'])[0])}catch(e){}
      const before=out.length;
      (Array.isArray(o.items)?o.items:[]).forEach(it=>{let url=null;try{url=newsOk(new URL(String(it.url||''),s).href)}catch(e){}if(url&&it.title)out.push({title:String(it.title).slice(0,100),date:/^\d{4}-\d\d-\d\d$/.test(it.date||'')?it.date:null,url,cat:newsCat(it.category)})});
      d.via=txt?'ai-text':'ai-url';d.ai=out.length-before}catch(e){d.aiErr=String(e.message||e).slice(0,120)}
    if(!out.length){try{const h=new URL(s);const r=await newsFromSearch(env,`site:${h.hostname}${h.pathname} お知らせ`,d);out.push(...r);if(r.length)d.via='search'}catch(e){d.searchErr=String(e.message||e).slice(0,100)}}
  }
  if(!srcs.length){
    try{const {meta}=await gemText(env,{contents:[{parts:[{text:'ポケモンチャンピオンズ（Pokémon Champions）の公式サイトの新しいお知らせ（アップデート・レギュレーション・イベント・大会・メンテナンス）を検索してください。見つけたお知らせの題名だけを1行ずつ書いてください。'}]}],tools:[{google_search:{}}],generationConfig:{temperature:0}});
      for(const c of ((meta&&meta.groundingChunks)||[]).slice(0,10)){const w=c.web;if(!w)continue;const url=newsOk(await newsResolve(w.uri));if(url)out.push({title:String(w.title||'').slice(0,100),date:null,url})}}catch(e){dbg.searchErr=String(e.message||e).slice(0,120)}
  }
  const seen=new Set();return out.filter(x=>!seen.has(x.url)&&seen.add(x.url));
}
/* 投稿の本文：【公式・種類】題名（日付） #公式のお知らせ（タグで公式のお知らせだけを検索できる） */
const newsBody=(title,cat,date)=>{const tail=' #公式のお知らせ',head=`【公式・${cat||'お知らせ'}】`,d=date?`（${String(date).replace(/-/g,'/')}）`:'';return head+String(title).slice(0,140-head.length-d.length-tail.length)+d+tail};
async function newsRun(env,db,now,max=3){
  await newsInit(db);await socialInit(db);
  const dbg={};const items=await newsFind(env,db,dbg);let posted=0;const list=[];
  const first=!(await db.prepare(`SELECT 1 FROM news_seen LIMIT 1`).first());
  /* 新しいものから max 件を投稿する（タイムラインで新しいものが上に来るように、古い順に投稿）。初回は残りを記録だけ */
  const fresh=[];for(const it of items){const dup=await db.prepare(`SELECT 1 FROM news_seen WHERE url=?`).bind(it.url).first();if(dup){if(it.cat||it.date)await db.prepare(`UPDATE news_seen SET cat=COALESCE(cat,?),date=COALESCE(date,?) WHERE url=?`).bind(it.cat||null,it.date||null,it.url).run();continue}fresh.push(it)}
  const toPost=new Set(fresh.slice(0,max));
  for(const it of [...fresh].reverse()){
    if(!toPost.has(it)){await db.prepare(`INSERT OR IGNORE INTO news_seen(url,title,note_id,created_at,cat,date) VALUES(?,?,0,?,?,?)`).bind(it.url,it.title,now,it.cat||null,it.date||null).run();continue}
    await newsBot(db,now);
    const body=newsBody(it.title,it.cat,it.date);
    const r=await db.prepare(`INSERT INTO notes(uid,body,created_at,ip,reply_to,media,link) VALUES(?,?,?,?,0,NULL,?) RETURNING id`).bind(NEWS_UID,body,now,'bot',it.url).first();
    await db.prepare(`INSERT OR IGNORE INTO news_seen(url,title,note_id,created_at,cat,date) VALUES(?,?,?,?,?,?)`).bind(it.url,it.title,r.id,now,it.cat||null,it.date||null).run();
    posted++;list.push(it);
  }
  return{posted,found:items.length,first,items:list,dbg};
}
async function newsApi(req,env,db,path,now,isAdmin){
  /* だれでも見られる一覧：GET /api/news?cat=種類（公式のお知らせのページ用） */
  if(path==='/api/news'&&req.method==='GET'){
    await newsInit(db);const cat=newsCat(new URL(req.url).searchParams.get('cat'));
    const r=await db.prepare(`SELECT url,title,cat,date,created_at FROM news_seen ${cat?'WHERE cat=?':''} ORDER BY COALESCE(date,'') DESC,created_at DESC LIMIT 100`).bind(...(cat?[cat]:[])).all();
    return J({cats:NEWS_CATS,items:r.results});
  }
  if(!/^\/api\/admin\/news/.test(path))return null;
  if(!isAdmin)return J({error:'管理用の合言葉が違います。'},401);
  await newsInit(db);
  let b={};if(req.method==='POST'){try{b=JSON.parse(await req.text()||'{}')}catch(e){}}
  if(path==='/api/admin/news'&&req.method==='GET'){
    const src=(await db.prepare(`SELECT url FROM news_src ORDER BY created_at`).all()).results.map(r=>r.url);
    const seen=(await db.prepare(`SELECT url,title,note_id,created_at,cat,date FROM news_seen ORDER BY created_at DESC LIMIT 30`).all()).results;
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
    const url=newsOk(b.url),title=String(b.title||'').trim().slice(0,100),cat=newsCat(b.cat);
    if(!url||!title)return J({error:'題名と、公式サイトのアドレスを入れてください。'},400);
    await newsBot(db,now);await socialInit(db);
    const r=await db.prepare(`INSERT INTO notes(uid,body,created_at,ip,reply_to,media,link) VALUES(?,?,?,?,0,NULL,?) RETURNING id`).bind(NEWS_UID,newsBody(title,cat,null),now,'bot',url).first();
    await db.prepare(`INSERT OR IGNORE INTO news_seen(url,title,note_id,created_at,cat,date) VALUES(?,?,?,?,?,?)`).bind(url,title,r.id,now,cat,null).run();
    return J({ok:true,id:r.id});
  }
  return J({error:'見つかりません。'},404);
}
async function newsCron(env){if(!env.DB)return;try{await newsRun(env,env.DB,Date.now())}catch(e){}}
