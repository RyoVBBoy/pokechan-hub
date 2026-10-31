/* ポケチャン攻略Hub 背面タップ連携サーバー v5（掲示板・対戦募集つき）（Cloudflare Workers 用・このファイルをそのまま貼り付け）
   iPhoneのショートカットから選出画面のスクリーンショットを受け取り、画像を理解できるAI（Claude）で
   相手のポケモンとタイプを読み取って、通知に収まる短い要約を返します。
   必要な設定（Workerの「設定」→「変数とシークレット」）:
     ANTHROPIC_API_KEY … AnthropicのAPIキー（シークレット）
     APP_TOKEN         … 合言葉（シークレット・任意の文字列）。ショートカットからも同じ値を送ります
     MODEL             … 使うモデル（任意。既定 claude-haiku-5-5）
     MODEL_RETRY       … 読み取りが怪しいときに使い直すモデル（任意。既定 claude-sonnet-5-5）
     GEMINI_API_KEY    … GoogleのGemini APIキー（シークレット）。テスト用に無料枠で使えます
     GEMINI_MODEL      … Geminiのモデル名（任意。使えない名前なら、使える最新のFlashを自動で選びます）
     READER            … 使う読み取り方式を固定したいとき：anthropic / gemini / demo（任意）
     ADMIN_TOKEN       … 掲示板の管理画面に入るための合言葉（シークレット・12文字以上）。APP_TOKEN とは別の値にすること
     DB（バインディング）… 掲示板・対戦募集を使うときの D1 データベース（変数名 DB）
   どちらのキーも入れていない間は「見本モード」で動きます（画像を受け取ったことと、見本の通知を返します）。
   読み取り部分は READERS に差し込む形なので、あとから別のAIや自前の判別に差し替えられます。 */
const SPECIES=`__SPECIES__`;
const RAW=__RAW__;
const TC=__TC__;
const EMO={ノーマル:'⚪',ほのお:'🔥',みず:'💧',でんき:'⚡',くさ:'🌿',こおり:'❄️',かくとう:'👊',どく:'☠️',じめん:'⛰️',ひこう:'🪽',エスパー:'🔮',むし:'🐛',いわ:'🪨',ゴースト:'👻',ドラゴン:'🐉',あく:'🌙',はがね:'⚙️',フェアリー:'🧚'};
const T=Object.values(TC);
const CH={};for(const k in RAW)CH[k]=RAW[k].map(s=>s?s.split(','):[]);
const mult=(a,d)=>d.reduce((p,t)=>p*(CH[a][0].includes(t)?2:CH[a][1].includes(t)?.5:CH[a][2].includes(t)?0:1),1);
const MON=[],BYNO={},BYKEY=new Map();
const SMALL={'ぁ':'あ','ぃ':'い','ぅ':'う','ぇ':'え','ぉ':'お','っ':'つ','ゃ':'や','ゅ':'ゆ','ょ':'よ','ゎ':'わ'};
const kkey=s=>String(s||'').normalize('NFKC').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60)).normalize('NFD').replace(/[゙゚]/g,'').normalize('NFC').replace(/[ぁぃぅぇぉっゃゅょゎ]/g,c=>SMALL[c]).replace(/[^ぁ-んー]/g,'');
for(const l of SPECIES.split('\n')){const a=l.split(',');const m={no:+a[0],n:a[1],t:[...a[2]].map(c=>TC[c]),s:a.slice(3,9).map(Number),en:a[9],roster:a[10]==='1'};m.k=kkey(m.n);MON.push(m);BYNO[m.no]=m;if(!BYKEY.has(m.k))BYKEY.set(m.k,m)}
function lev(a,b){const m=a.length,n=b.length;if(!m)return n;if(!n)return m;let p=Array.from({length:n+1},(_,i)=>i);for(let i=1;i<=m;i++){const c=[i];for(let j=1;j<=n;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c}return p[n]}
/* 文字認識の結果から、ポケモン名を順番に見つける */
function findMons(text){
  const out=[];
  const pieces=String(text||'').split(/[\n\r\t　 ,、・/|]+/).map(kkey).filter(x=>x.length>=2&&x.length<=12);
  for(const k of pieces){
    let m=BYKEY.get(k);
    if(!m){let best=null,bd=9;for(const c of MON){if(Math.abs(c.k.length-k.length)>1||c.k[0]!==k[0]&&c.k.slice(-1)!==k.slice(-1))continue;const d=lev(k,c.k);if(d<bd){bd=d;best=c}}
      if(best&&bd<=Math.max(1,Math.floor(best.k.length/4))&&best.k.length>=3)m=best}
    if(m)out.push(m)
  }
  return out;
}
const maxSpe=p=>Math.floor((p.s[5]+32+20)*1.1);
const short=n=>n.length>4?n.slice(0,3):n;
/* ラダー集計（Pokémon Champions Battle Data・非公式）から、こだわりスカーフの採用率を取得（任意・失敗しても続行） */
async function scarfRate(m,ctx){
  if(!m.en)return 0;
  const url='https://championsbattledata.com/pokemon_champions_assets/battle_data/Doubles/'+encodeURIComponent(m.en)+'.csv';
  try{
    const cache=caches.default;let r=await cache.match(url);
    if(!r){r=await fetch(url,{cf:{cacheTtl:21600}});if(!r.ok)return 0;const c=new Response(r.clone().body,r);c.headers.set('Cache-Control','max-age=21600');ctx&&ctx.waitUntil(cache.put(url,c))}
    const t=await r.text();const line=t.split('\n').find(l=>/,held_item,\d+,Choice Scarf,/.test(l));
    return line?parseFloat(line.split(',')[5])||0:0;
  }catch(e){return 0}
}
async function summarize(text,teamNos,ctx,opts){
  let found=findMons(text);
  const mine=teamNos.map(n=>BYNO[n]).filter(Boolean);
  /* 画面全体を読んだとき（mode=full）は、自分のパーティの名前を1回ずつ除外（ミラーで相手も同じポケモンなら2回目が残る） */
  if(opts.excludeMine){const left=mine.map(m=>m.no);found=found.filter(m=>{const i=left.indexOf(m.no);if(i>=0){left.splice(i,1);return false}return true})}
  {const seen=new Set();found=found.filter(m=>!seen.has(m.no)&&seen.add(m.no))}
  found=found.slice(0,6);
  if(!found.length)return '相手のポケモンが見つかりませんでした。選出画面で背面タップしてください。';
  const sc=opts.ladder?await Promise.all(found.map(m=>scarfRate(m,ctx))):found.map(()=>0);
  return found.map((o,i)=>{
    const wk=T.map(a=>[a,mult(a,o.t)]).filter(x=>x[1]>=2).sort((a,b)=>b[1]-a[1]);
    let s=`${o.n} 弱${wk.length?wk.map(([a,v])=>EMO[a]+(v>=4?'×4':'')).join(''):'なし'} S${maxSpe(o)}`;
    if(sc[i]>=15)s+=`(ス${Math.floor(maxSpe(o)*1.5)})`;
    if(mine.length){
      const atk=mine.map(m=>({m,v:Math.max(...m.t.map(t=>mult(t,o.t))),p:Math.max(m.s[1],m.s[3])})).filter(x=>x.v>=2).sort((a,b)=>b.v-a.v||b.p-a.p)[0];
      const thr=mine.map(m=>({m,v:Math.max(...o.t.map(t=>mult(t,m.t)))})).filter(x=>x.v>=2).sort((a,b)=>b.v-a.v)[0];
      if(atk)s+=` 攻${short(atk.m.n)}`;if(thr)s+=` 危${short(thr.m.n)}${thr.v>=4?'!':''}`;
    }
    return s;
  }).join('\n');
}

/* ---- 画像からの読み取り（AI） ---- */
const TYPES_JA=['ノーマル','ほのお','みず','でんき','くさ','こおり','かくとう','どく','じめん','ひこう','エスパー','むし','いわ','ゴースト','ドラゴン','あく','はがね','フェアリー'];
const PROMPT=`これは「ポケモンチャンピオンズ」の対戦前の画面（選出画面・対戦準備中画面）のスクリーンショットです。
画面の右側に縦に並ぶ赤いパネルが「相手のポケモン」です（最大6匹）。左側の青いパネルは自分のポケモンなので無視してください。
相手の各パネルについて、上から順に次を読み取ってください。
1. types: パネル右上のタイプアイコン（1〜2個）。アイコンの見た目の目安：
   ほのお=赤地に炎 / みず=青地にしずく / くさ=緑地に草の葉 / でんき=黄色地に稲妻 / こおり=水色地に結晶 / かくとう=オレンジ地に拳 /
   どく=紫地にどくろや泡 / じめん=茶色地に地層 / ひこう=水色地に翼 / エスパー=ピンク紫地に人影・目 / むし=黄緑地に虫 /
   いわ=ベージュ地に岩 / ゴースト=紫地におばけ / ドラゴン=青紫地に竜の頭 / あく=黒地に牙・U字 / はがね=青灰色地に金属の形 /
   フェアリー=ピンク地にリボン・蝶 / ノーマル=白灰色地に円・八角形
2. name: ポケモンの種類の日本語の正式名（ニックネームではなく種族名）。絵とタイプの両方に合うものを選んでください。自信がなければ空文字にしてください。
3. confidence: name の自信（0〜1）。
次のJSONだけを出力してください（説明文は不要）。
{"opponent":[{"name":"ガブリアス","types":["ドラゴン","じめん"],"confidence":0.9}]}
types は必ず次の18語から選びます：${TYPES_JA.join('、')}`;
function b64(buf){let s='';const a=new Uint8Array(buf);for(let i=0;i<a.length;i+=0x8000)s+=String.fromCharCode.apply(null,a.subarray(i,i+0x8000));return btoa(s)}
function mediaType(buf){const a=new Uint8Array(buf.slice(0,12));
  if(a[0]===0x89&&a[1]===0x50)return'image/png';if(a[0]===0xff&&a[1]===0xd8)return'image/jpeg';
  if(a[0]===0x52&&a[1]===0x49&&a[8]===0x57&&a[9]===0x45)return'image/webp';if(a[0]===0x47&&a[1]===0x49)return'image/gif';return null}
async function askVision(env,buf,mt,model){
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01','content-type':'application/json'},
    body:JSON.stringify({model,max_tokens:700,messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:mt,data:b64(buf)}},{type:'text',text:PROMPT}]}]})});
  if(!r.ok)throw new Error('AI '+r.status+' '+(await r.text()).slice(0,160));
  const j=await r.json();const t=(j.content||[]).map(c=>c.text||'').join('');const m=t.match(/\{[\s\S]*\}/);if(!m)throw new Error('AIの返答を読めませんでした');
  const o=JSON.parse(m[0]);return Array.isArray(o.opponent)?o.opponent:[];
}

let GEM_LIST=null;
/* このキーで使えるモデル一覧から、画像に対応したFlashを「安定版の新しい順→試験版→軽量版」に並べる */
async function listGemini(env){
  if(GEM_LIST)return GEM_LIST;
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',{headers:{'x-goog-api-key':env.GEMINI_API_KEY}});
  if(!r.ok)throw new Error('Geminiのモデル一覧を取得できません（'+r.status+'）');
  const ms=((await r.json()).models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes('generateContent')).map(m=>m.name.replace(/^models\//,''))
    .filter(n=>/^gemini-[\d.]+-flash/.test(n)&&!/(image|tts|audio|live|embed|thinking)/.test(n));
  const ver=n=>parseFloat((n.match(/gemini-([\d.]+)/)||[])[1]||0),lite=n=>/lite/.test(n)?1:0,pre=n=>/preview|exp/.test(n)?1:0;
  ms.sort((x,y)=>lite(x)-lite(y)||pre(x)-pre(y)||ver(y)-ver(x)||x.length-y.length);
  if(!ms.length)throw new Error('使えるGeminiのFlashモデルが見つかりません');
  return GEM_LIST=ms;
}
async function askGemini(env,buf,mt){
  /* 速くするために：考える時間（thinking）を使わない・1回20秒で打ち切って次のモデルへ。画像の変換は1回だけ */
  const data=b64(buf);
  const call=async(m,noThink)=>{const gc={responseMimeType:'application/json',temperature:0};
    if(!noThink&&/gemini-2\.5-flash/.test(m))gc.thinkingConfig={thinkingBudget:0};
    const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),20000);
    try{const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,{method:'POST',signal:ctl.signal,
      headers:{'x-goog-api-key':env.GEMINI_API_KEY,'content-type':'application/json'},
      body:JSON.stringify({contents:[{parts:[{inline_data:{mime_type:mt,data}},{text:PROMPT}]}],generationConfig:gc})});
      /* thinking の設定を受け付けないモデルなら、設定なしでもう一度 */
      if(r.status===400&&!noThink&&gc.thinkingConfig){const t=await r.clone().text();if(/thinking/i.test(t))return call(m,true)}
      return r}
    catch(e){return new Response(JSON.stringify({error:{message:'20秒で応答がありませんでした'}}),{status:503})}
    finally{clearTimeout(tm)}};
  /* 混雑（503）・回数制限（429）・使えない（404）なら、次のモデルで最大3回まで試す */
  let cands=env.GEMINI_MODEL?[env.GEMINI_MODEL]:[];
  try{cands=[...new Set([...cands,...await listGemini(env)])]}catch(e){if(!cands.length)throw e}
  let r,last='',busy=false;
  const start=Date.now();
  for(const m of cands.slice(0,3)){
    if(r&&Date.now()-start>22000)break; /* 全体で20秒あまりを超えたら、次のモデルは試さない（ショートカットが待ちきれなくなるため） */
    r=await call(m);if(r.ok)break;
    const t=await r.text();try{last=JSON.parse(t).error.message}catch(e){last=t}
    if(r.status===400&&/API key/i.test(last))throw new Error('GEMINI_API_KEY が正しくありません');
    if(![404,429,500,503].includes(r.status))throw new Error(`Gemini ${r.status}（${m}）${last.slice(0,80)}`);
    if(r.status!==404)busy=true;
  }
  if(!r.ok)throw new Error(busy?'Geminiが混雑中か、無料枠の回数制限です。少し待ってからもう一度背面タップしてください':'使えるGeminiのモデルが見つかりませんでした');
  const j=await r.json();const t=((j.candidates||[])[0]?.content?.parts||[]).map(p=>p.text||'').join('');const mm=t.match(/\{[\s\S]*\}/);if(!mm)throw new Error('Geminiの返答を読めませんでした');
  const o=JSON.parse(mm[0]);return Array.isArray(o.opponent)?o.opponent:[];
}
/* AIの答えを検算：タイプは18語に限定、名前は図鑑と照合し、タイプと合わなければ「?」を付ける */
function checkOpp(list){
  return list.slice(0,6).map(x=>{
    const types=(x.types||[]).map(t=>TYPES_JA.find(y=>y===String(t).trim())).filter(Boolean).slice(0,2);
    const k=kkey(x.name||'');let m=k?BYKEY.get(k):null;
    if(!m&&k.length>=3){let best=null,bd=9;for(const c of MON){const d=lev(k,c.k);if(d<bd){bd=d;best=c}}if(best&&bd<=1)m=best}
    const same=m&&types.length&&types.length===m.t.length&&types.every(t=>m.t.includes(t));
    if(m&&!types.length)return{mon:m,types:m.t,sure:(x.confidence||0)>=.6};
    if(same)return{mon:m,types,sure:(x.confidence||0)>=.5};
    /* 名前とタイプが食い違う：タイプを信じ、そのタイプの組み合わせのポケモンで名前の近いものを探す */
    const pool=MON.filter(c=>c.roster&&c.t.length===types.length&&types.every(t=>c.t.includes(t)));
    let alt=null;if(pool.length===1)alt=pool[0];else if(k){let bd=9;for(const c of pool){const d=lev(k,c.k);if(d<bd){bd=d;alt=c}}if(bd>3)alt=null}
    return{mon:alt,types,sure:false};
  }).filter(o=>o.types.length);
}
function formatOpp(opps,mine,sc){
  return opps.map((o,i)=>{
    const wk=T.map(a=>[a,mult(a,o.types)]).filter(x=>x[1]>=2).sort((a,b)=>b[1]-a[1]);
    const nm=o.mon?o.mon.n+(o.sure?'':'?'):o.types.map(t=>EMO[t]).join('')+'(種類不明)';
    let s=`${nm} 弱${wk.length?wk.map(([a,v])=>EMO[a]+(v>=4?'×4':'')).join(''):'なし'}`;
    if(o.mon)s+=` S${maxSpe(o.mon)}`+(sc[i]>=15?`(ス${Math.floor(maxSpe(o.mon)*1.5)})`:'');
    if(mine.length){
      const atk=mine.map(m=>({m,v:Math.max(...m.t.map(t=>mult(t,o.types))),p:Math.max(m.s[1],m.s[3])})).filter(x=>x.v>=2).sort((a,b)=>b.v-a.v||b.p-a.p)[0];
      const thr=mine.map(m=>({m,v:Math.max(...o.types.map(t=>mult(t,m.t)))})).filter(x=>x.v>=2).sort((a,b)=>b.v-a.v)[0];
      if(atk)s+=` 攻${short(atk.m.n)}`;if(thr)s+=` 危${short(thr.m.n)}${thr.v>=4?'!':''}`;
    }
    return s;
  }).join('\n');
}

/* バナー（ゲーム中は2行しか見えない）用の要約：1行目＝選出案と注意、2行目＝素早さ順 */
function headline(opps,mine,sc,demo){
  const spe=(o,i)=>o.mon?(sc[i]>=15?Math.floor(maxSpe(o.mon)*1.5):maxSpe(o.mon)):0;
  const nm=o=>o.mon?o.mon.n.slice(0,3)+(o.sure?'':'?'):o.types.map(t=>EMO[t]).join('');
  let l1='';
  if(mine.length){
    const top=Math.max(...opps.map(spe));
    const pick=mine.map(m=>{let v=0;for(const o of opps){
        if(Math.max(...m.t.map(t=>mult(t,o.types)))>=2)v+=1;
        const th=Math.max(...o.types.map(t=>mult(t,m.t)));if(th>=4)v-=1.5;else if(th>=2)v-=.7;}
      if(maxSpe(m)>=top)v+=.5;return{m,v}}).sort((a,b)=>b.v-a.v).slice(0,4).map(x=>x.m.n.slice(0,3));
    const warn=opps.map(o=>({o,v:mine.filter(m=>Math.max(...o.types.map(t=>mult(t,m.t)))>=2).length-mine.filter(m=>Math.max(...m.t.map(t=>mult(t,o.types)))>=2).length})).sort((a,b)=>b.v-a.v)[0];
    l1=`選出 ${pick.join('・')}`+(warn&&warn.v>0?` ／注意 ${nm(warn.o)}`:'');
  }else l1='相手 '+opps.map(nm).join('・');
  const order=opps.map((o,i)=>({o,i,v:spe(o,i)})).filter(x=>x.v).sort((a,b)=>b.v-a.v);
  const l2='速 '+order.map(x=>nm(x.o)+x.v+(sc[x.i]>=15?'ス':'')).join(' ');
  return (demo?'見本｜':'')+l1+'\n'+l2;
}

/* ===================== 対戦計算（サイトの選出アシストと同じ計算） =====================
   build.py がサイト（champions-hub.html）から計算部分とデータを取り込みます。 */
const ENG=__ENGDATA__;
const MV=ENG.MV,MVE=ENG.MVE,LSD=ENG.LSD,ABD=ENG.ABD,MVK=ENG.MVK,ABK=ENG.ABK,ABN=ENG.ABN;
const B={weather:null};
let FMT='single';
const byNo=BYNO;
__ENGFUNCS__
MEGAP.forEach(m=>{m.dno=m.base;byNo[m.no]=m});
/* パーティコード：v1「445,6,…」／v2「図鑑番号:能力ポイント:性格:持ち物:技:特性」を「_」でつなぐ */
function parseTeam(code){
  code=String(code||'').trim();
  /* 先頭の「D!」はダブル。なければシングル */
  FMT=/^D!/i.test(code)?'double':'single';code=code.replace(/^[DS]!/i,'');
  if(!code)return[];
  if(!/[:_]/.test(code))return code.split(/[^0-9]+/).map(Number).filter(n=>BYNO[n]).slice(0,6).map(no=>({no,set:null}));
  return code.split('_').map(e=>{const f=e.split(':'),no=+f[0];if(!BYNO[no])return null;if(f.length<2)return{no,set:null};
    const sp=(f[1]||'').split('.').map(Number);const [up,dn]=(f[2]||'-1.-1').split('.').map(Number);
    const moves=(f[4]||'').split('.').map(Number).filter(x=>x).map(id=>id===182||id===197?PROT:MV[id]?mvObj(id):null).filter(Boolean);
    const p=BYNO[no];const base=chooseSet(p,true);
    return{no,set:{ab:f[5]||base.ab,item:f[3]||null,moves:moves.some(m=>!m.prot)?moves:base.moves,sp:sp.length===6&&sp.every(x=>x>=0)?sp:null,up:up??-1,dn:dn??-1}};
  }).filter(Boolean).slice(0,6);
}
/* ラダー集計（championsbattledata）を取得して型の材料にする */
const LADDER={};
async function ladder(m,ctx){
  const key=FMT+m.no;if(!m.en)return null;if(LADDER[key]!==undefined){LADDER[m.no]=LADDER[key];return LADDER[key]}
  const url='https://championsbattledata.com/pokemon_champions_assets/battle_data/'+FMTDIR()+'/'+encodeURIComponent(m.en)+'.csv';
  try{const cache=caches.default;let r=await cache.match(url);
    if(!r){r=await fetch(url,{cf:{cacheTtl:21600}});if(!r.ok){LADDER[m.no]=LADDER[key]=null;return null}const c=new Response(r.clone().body,r);c.headers.set('Cache-Control','max-age=21600');ctx&&ctx.waitUntil(cache.put(url,c))}
    const d=digest(await r.text());LADDER[m.no]=LADDER[key]=d.mv.length?d:null;return LADDER[m.no];
  }catch(e){LADDER[m.no]=LADDER[key]=null;return null}
}
/* 計算用の型は同じポケモンなら毎回同じなので、覚えておいて使い回す（サーバーの計算時間を減らす。無料プランは1回あたりの計算時間が短い） */
const DETC=new Map();
const detSet=p=>{const k=p.no+(LADDER[p.no]?'L':'');let v=DETC.get(k);if(!v){v=LADDER[p.no]?buildSet(p,LADDER[p.no],true):chooseSet(p,true);DETC.set(k,v)}return v};
let MYSETS={};
const mySetFor=n=>MYSETS[n]||detSet(BYNO[n]);
function oppPredict(myNos,opNos){
  if(opNos.length<=PICK())return{w:opNos.map(()=>1),top:[{c:opNos.map((_,j)=>j),p:1}],lead:null};
  const P=analyze(opNos,myNos,n=>detSet(BYNO[n]),n=>detSet(BYNO[n]));
  const mx=P.full[0].s,ex=P.full.map(x=>Math.exp((x.s-mx)/.06)),tot=ex.reduce((a,b)=>a+b,0);
  const pr=P.full.map((x,i)=>({c:x.c,p:ex[i]/tot}));
  return{w:opNos.map((_,j)=>pr.reduce((a,x)=>a+(x.c.includes(j)?x.p:0),0)),top:pr.slice(0,3),lead:P.lead};
}
const sn=n=>n.slice(0,3);
/* 計算つきの通知：1行目＝選出（先発＋控え）と注意、2行目＝相手の予想選出 */
async function battleNote(opps,team,ctx,demo){
  const known=[];opps.forEach((o,i)=>{if(o.mon&&!known.some(k=>k.mon.no===o.mon.no))known.push({...o,i})});
  Object.keys(LADDER).forEach(k=>{if(/^\d+$/.test(k))delete LADDER[k]});
  for(const k of DETC.keys())if(/L$/.test(k))DETC.delete(k);
  await Promise.all([...known.map(o=>ladder(o.mon,ctx)),...team.filter(t=>!t.set).map(t=>ladder(BYNO[t.no],ctx))]);
  MYSETS={};team.forEach(t=>{if(t.set)MYSETS[t.no]=t.set});
  const myNos=team.map(t=>t.no),opNos=known.map(o=>o.mon.no);
  const PR=oppPredict(myNos,opNos),A=analyze(myNos,opNos,mySetFor,n=>detSet(BYNO[n]),PR.w);
  const nm=o=>sn(o.mon.n)+(o.sure?'':'?');
  const thr=known.map((o,j)=>({o,j,v:A.best.reduce((a,i)=>a+Math.min(A.R[j][i].pct,150),0)*PR.w[j]})).sort((a,b)=>b.v-a.v)[0];
  const l1=`選出 ${A.lead.map(i=>sn(A.M[i].p.n)).join('・')}＋${A.back.map(i=>sn(A.M[i].p.n)).join('・')}`+(thr?` ／注意 ${nm(thr.o)}`:'');
  const l2=opNos.length>PICK()?'相手予想 '+known.map((o,j)=>({o,w:PR.w[j]})).sort((a,b)=>b.w-a.w).slice(0,PICK()).map(x=>nm(x.o)+Math.round(x.w*100)).join(' ')
    :'速 '+known.map((o,j)=>({o,v:effSpd(A.O[j])})).sort((a,b)=>b.v-a.v).map(x=>nm(x.o)+x.v).join(' ');
  const det=opps.map(o=>{
    if(!o.mon)return `${o.types.map(t=>EMO[t]).join('')}(種類不明)`;
    const j=opNos.indexOf(o.mon.no),O=A.O[j],d=LADDER[o.mon.no];
    let s=o.mon.n+(o.sure?'':'?');
    if(opNos.length>PICK())s+=` 予${Math.round(PR.w[j]*100)}%`;
    if(d&&d.it[0]){const k=nrm(d.it[0][0]);s+=` ${(ITEMN[k]||d.it[0][0]).replace('こだわり','')}${Math.round(d.it[0][1])}%`}
    s+=` S${O.st[5]}`+(O.item==='choicescarf'?`(ス${Math.floor(O.st[5]*1.5)})`:'');
    const atk=A.best.map(i=>({i,d:A.D[i][j]})).sort((a,b)=>b.d.pct-a.d.pct)[0],thr2=A.best.map(i=>({i,d:A.R[j][i]})).sort((a,b)=>b.d.pct-a.d.pct)[0];
    if(atk&&atk.d.pct>=30)s+=` 攻${sn(A.M[atk.i].p.n)}${Math.min(100,Math.round(atk.d.pct))}%`;
    if(thr2&&thr2.d.pct>=50)s+=` 危${sn(A.M[thr2.i].p.n)}${Math.min(100,Math.round(thr2.d.pct))}%`;
    return s});
  return (demo?'見本｜':'')+l1+'\n'+l2+'\n'+det.join('\n');
}
/* 読み取り部分（差し替え可能な枠）：画像 → [{name,types,confidence}] を返す */
const READERS={
  anthropic:{label:'AI（Claude）',read:(env,buf,mt,retry)=>askVision(env,buf,mt,retry?(env.MODEL_RETRY||'claude-sonnet-5-5'):(env.MODEL||'claude-haiku-5-5'))},
  gemini:{label:'AI（Gemini）',read:(env,buf,mt)=>askGemini(env,buf,mt)},
  demo:{label:'見本モード',read:async()=>[{name:'ガブリアス',types:['ドラゴン','じめん'],confidence:1},{name:'ルカリオ',types:['かくとう','はがね'],confidence:1},{name:'ソウブレイズ',types:['ほのお','ゴースト'],confidence:1},{name:'ジャローダ',types:['くさ'],confidence:1},{name:'ピクシー',types:['フェアリー'],confidence:1},{name:'',types:['みず','むし'],confidence:0}]}
};
async function fromImage(buf,teamNos,env,ctx,opts){
  const mt=mediaType(buf);if(!mt)return '画像の形式が読めませんでした（JPEGかPNGで送ってください）。';
  const key=env.READER||(env.ANTHROPIC_API_KEY?'anthropic':env.GEMINI_API_KEY?'gemini':'demo'),R=READERS[key]||READERS.demo;
  let opps=checkOpp(await R.read(env,buf,mt,false));
  const weak=opps.length<6||opps.filter(o=>!o.sure).length>=2;
  if(key==='anthropic'&&weak&&opts.retry){try{const l2=checkOpp(await R.read(env,buf,mt,true));if(l2.filter(o=>o.sure).length>opps.filter(o=>o.sure).length||l2.length>opps.length)opps=l2}catch(e){}}
  if(!opps.length)return '相手のポケモンを読み取れませんでした。選出画面で背面タップしてください。';
  const team=Array.isArray(teamNos)?teamNos.map(no=>({no,set:null})):teamNos.list;
  const tail=key==='demo'?`\n（見本：画像${Math.round(buf.byteLength/1024)}KBを受信。AI読み取りが未設定のため、内容は固定の見本です）`:'';
  if(team.length>=PICK()&&opps.some(o=>o.mon)){try{return await battleNote(opps,team,ctx,key==='demo')+tail}catch(e){}}
  const mine=team.map(t=>BYNO[t.no]).filter(Boolean);
  const sc=opts.ladder?await Promise.all(opps.map(o=>o.mon?scarfRate(o.mon,ctx):0)):opps.map(()=>0);
  const top=headline(opps,mine,sc,key==='demo');
  return top+'\n'+formatOpp(opps,mine,sc)+tail;
}
__COMMUNITY__
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-App-Token,X-Team,X-Admin-Token,Authorization'};
export default{
  /* 毎日1回（wrangler.toml の crons）：上位パーティの自動集計 */
  async scheduled(ev,env,ctx){ctx.waitUntil(collectDaily(env).catch(()=>{}))},
  async fetch(req,env,ctx){
    if(req.method==='OPTIONS')return new Response(null,{headers:CORS});
    const u=new URL(req.url);let text=u.searchParams.get('text')||'',team=u.searchParams.get('team')||req.headers.get('x-team')||'',mode=u.searchParams.get('mode')||'';
    const H={...CORS,'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'};
    if(u.pathname.startsWith('/m/')&&req.method==='GET')return mediaGet(req,env,u.pathname.slice(3));
    if(u.pathname.startsWith('/api/'))return api(req,env,u,ctx);
    if(req.method==='POST'&&env.APP_TOKEN&&(req.headers.get('x-app-token')||u.searchParams.get('token'))!==env.APP_TOKEN)return new Response('合言葉（APP_TOKEN）が違います。',{status:401,headers:H});
    if(req.method==='POST'){const ct=req.headers.get('content-type')||'';
      /* 画像そのものが送られてきた場合 */
      if(/^image\/|octet-stream/.test(ct)||(!ct.includes('json')&&!ct.includes('form')&&!ct.includes('text'))){
        const buf=await req.arrayBuffer();
        if(buf.byteLength>200){const teamNos={list:parseTeam(team)},t0=Date.now();
          /* 最後に、かかった時間を小さく付ける（遅いときに原因を探しやすくするため） */
          try{const out=await fromImage(buf,teamNos,env,ctx,{retry:u.searchParams.get('retry')!=='0',ladder:u.searchParams.get('ladder')!=='0'});
            return new Response(out+`\n（${((Date.now()-t0)/1000).toFixed(1)}秒${buf.byteLength>700000?'・画像が大きめ':''}）`,{headers:H})}
          catch(e){return new Response('読み取りでエラー：'+(e.message||e),{status:200,headers:H})}}
      }
      try{if(ct.includes('json')){const j=await req.json();text=j.text??text;team=String(j.team??team);mode=j.mode??mode}
        else if(ct.includes('form')){const f=await req.formData();text=f.get('text')||text;team=f.get('team')||team;mode=f.get('mode')||mode}
        else text=await req.text()||text}catch(e){}}
    if(!text)return new Response('ポケチャン攻略Hub 背面タップ連携サーバーは動いています。',{headers:{...CORS,'Content-Type':'text/plain; charset=utf-8'}});
    const teamNos=parseTeam(team).map(t=>t.no);
    const out=await summarize(text,teamNos,ctx,{excludeMine:mode==='full',ladder:u.searchParams.get('ladder')!=='0'});
    return new Response(out,{headers:{...CORS,'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
  }
};
