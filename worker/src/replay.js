/* ===================== 対戦の振り返り（画面収録の動画から） =====================
   サイトが動画から画面の変わった場面の静止画（最大96枚）を取り出し（スマホの中）、その静止画だけを送ってくる。動画は受け取らない・静止画も保存しない。
   ・POST /api/replay-read：Gemini で事実（相手の6匹・自分の6匹・お互いの選出・相手が使った技と持ち物・勝ち負け）を読む
   ・POST /api/battles（保存）・GET /api/battles（自分の記録）・POST /api/battles/番号/delete
   ログインした人だけ。読み取りは1日20回まで */
const REPLAY_PROMPT=`これは「ポケモンチャンピオンズ」の対戦を画面収録した動画から、時間の順に取り出した静止画の一部です（選出画面や結果の画面が入っていないこともあります）（各画像の前に秒数があります）。
画面に映っている事実だけを読み取ってください。推測はしないでください。わからない項目は null や空にします。
- opponent_team：対戦前の選出画面で、右側（赤いパネル）に並ぶ相手の6匹の名前
- my_team：同じ画面で、左側（青いパネル）に並ぶ自分の6匹の名前
- opponent_used：対戦中に場に出てきた相手のポケモンの名前（出てきた順）
- my_used：対戦中に場に出てきた自分のポケモンの名前（出てきた順）
- opponent_moves：相手のポケモンごとに、使ったと画面に出た技の名前（「相手の 〇〇の △△！」のような文字。自分のポケモンの技は入れない）
- opponent_items：相手のポケモンごとに、画面に出た持ち物（メガシンカしたらメガストーンの名前）
- result：最後に勝ったなら "win"、負けたなら "lose"、わからなければ "unknown"
- format：シングルなら "single"、ダブルなら "double"
名前はすべて日本語の正式名。地方の姿は「ライチュウ（アローラ）」の形。メガシンカしたポケモンは元のポケモンの名前にする。
次の JSON だけを返してください：
{"format":"","result":"","opponent_team":[],"my_team":[],"opponent_used":[],"my_used":[],"opponent_moves":{"名前":["技"]},"opponent_items":{"名前":"持ち物"}}`;
let REPLAY_READY=false;
async function replayInit(db){
  if(REPLAY_READY)return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS battles(id INTEGER PRIMARY KEY AUTOINCREMENT,uid TEXT NOT NULL,fmt TEXT,result TEXT,my TEXT,opp TEXT,my_sel TEXT,opp_sel TEXT,opp_info TEXT,created_at INTEGER)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS battles_uid ON battles(uid,id)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS replay_reads(uid TEXT NOT NULL,created_at INTEGER)`)
  ]);
  REPLAY_READY=true;
}
const nosOf=a=>[...new Set((Array.isArray(a)?a:[]).map(n=>monOf(n)).filter(Boolean).map(m=>m.no))].slice(0,6);
const noList=a=>[...new Set((Array.isArray(a)?a:[]).map(Number).filter(n=>Number.isInteger(n)&&n>0&&n<20000))].slice(0,6);
async function replayApi(req,env,db,path,now){
  if(!/^\/api\/(replay-read|battles)/.test(path))return null;
  await replayInit(db);
  const me=fbPid(env)?await authOf(req,env):null;
  if(!me)return J({error:'ログインしてください。'},401);
  let m;
  if(path==='/api/replay-read'&&req.method==='POST'){
    if(!env.GEMINI_API_KEY)return J({error:'AIの読み取りがまだ設定されていません（運営者の設定が必要です）。'},503);
    const c=await db.prepare(`SELECT COUNT(*) AS c FROM replay_reads WHERE uid=? AND created_at>?`).bind(me.uid,now-864e5).first();
    if(c&&c.c>=20)return J({error:'1日に読み取れる回数（20回）を超えました。'},429);
    let b;try{b=JSON.parse(await req.text())}catch(e){return J({error:'送信内容を読めませんでした。'},400)}
    const fr=(Array.isArray(b.frames)?b.frames:[]).slice(0,100).filter(f=>f&&typeof f.d==='string'&&f.d.length<400000&&/^[A-Za-z0-9+/=]+$/.test(f.d.slice(0,100)));
    if(fr.length<3)return J({error:'動画から静止画を取り出せませんでした。'},400);
    /* 1回で全部送ると時間切れ（524）になりやすいので、12枚ずつに分けて同時に読み、あとで合わせる */
    const chunks=[];for(let i=0;i<fr.length;i+=12)chunks.push(fr.slice(i,i+12));
    const t0=Date.now();
    const rs=await Promise.allSettled(chunks.map(async ch=>{
      const parts=[];ch.forEach(f=>{parts.push({text:`${Math.round(+f.t||0)}秒`});parts.push({inline_data:{mime_type:'image/jpeg',data:f.d}})});parts.push({text:REPLAY_PROMPT});
      const {text}=await gemText(env,{contents:[{parts}],generationConfig:{temperature:0,responseMimeType:'application/json'}},true);
      try{return JSON.parse((String(text).match(/\{[\s\S]*\}/)||['{}'])[0])}catch(e){return{}}
    }));
    const ok=rs.filter(r=>r.status==='fulfilled').map(r=>r.value);
    if(!ok.length)return J({error:String((rs[0].reason&&rs[0].reason.message)||rs[0].reason)},502);
    await db.prepare(`INSERT INTO replay_reads(uid,created_at) VALUES(?,?)`).bind(me.uid,now).run();
    /* 合わせ方：6匹は最初に読めたもの、場に出たのは順に足す、勝ち負けは最後の方の画像から */
    const A=k=>ok.map(x=>Array.isArray(x[k])?x[k]:[]),O=k=>Object.assign({},...ok.map(x=>x[k]&&typeof x[k]==='object'&&!Array.isArray(x[k])?x[k]:{}));
    const o={format:(ok.find(x=>x.format==='single'||x.format==='double')||{}).format,
      result:([...ok].reverse().find(x=>x.result==='win'||x.result==='lose')||{}).result,
      opponent_team:A('opponent_team').sort((a,b)=>b.length-a.length)[0]||[],my_team:A('my_team').sort((a,b)=>b.length-a.length)[0]||[],
      opponent_used:A('opponent_used').flat(),my_used:A('my_used').flat(),opponent_moves:{},opponent_items:O('opponent_items')};
    ok.forEach(x=>{for(const [n,mv] of Object.entries(x.opponent_moves||{}))o.opponent_moves[n]=[...new Set([...(o.opponent_moves[n]||[]),...(Array.isArray(mv)?mv:[])])]});
    const R=revMaps(),info={};
    for(const [n,mv] of Object.entries(o.opponent_moves||{})){const mm=monOf(n);if(!mm)continue;(info[mm.no]=info[mm.no]||{}).mv=(Array.isArray(mv)?mv:[]).map(x=>R.mv[kkey(x)]).filter(Boolean).slice(0,4)}
    for(const [n,it] of Object.entries(o.opponent_items||{})){const mm=monOf(n);const k=it&&R.it[kkey(it)];if(mm&&k)(info[mm.no]=info[mm.no]||{}).it=k}
    return J({fmt:o.format==='double'?'double':o.format==='single'?'single':null,result:['win','lose'].includes(o.result)?o.result:null,
      opp:nosOf(o.opponent_team),my:nosOf(o.my_team),opp_sel:nosOf(o.opponent_used),my_sel:nosOf(o.my_used),info,sec:Math.round((Date.now()-t0)/100)/10});
  }
  if(path==='/api/battles'&&req.method==='POST'){
    let b;try{b=JSON.parse(await req.text())}catch(e){return J({error:'送信内容を読めませんでした。'},400)}
    const opp=noList(b.opp);if(opp.length<1)return J({error:'相手のポケモンを1匹以上入れてください。'},400);
    const c=await db.prepare(`SELECT COUNT(*) AS c FROM battles WHERE uid=? AND created_at>?`).bind(me.uid,now-864e5).first();
    if(c&&c.c>=200)return J({error:'1日に記録できる数を超えました。'},429);
    const info={};for(const [k,v] of Object.entries(b.info||{})){const no=+k;if(!opp.includes(no)||!v)continue;info[no]={mv:(Array.isArray(v.mv)?v.mv:[]).map(Number).filter(n=>n>0).slice(0,4),it:typeof v.it==='string'?v.it.slice(0,40):undefined}}
    const r=await db.prepare(`INSERT INTO battles(uid,fmt,result,my,opp,my_sel,opp_sel,opp_info,created_at) VALUES(?,?,?,?,?,?,?,?,?) RETURNING id`)
      .bind(me.uid,b.fmt==='double'?'double':'single',['win','lose'].includes(b.result)?b.result:null,JSON.stringify(noList(b.my)),JSON.stringify(opp),JSON.stringify(noList(b.my_sel)),JSON.stringify(noList(b.opp_sel)),JSON.stringify(info),now).first();
    return J({ok:true,id:r.id});
  }
  if(path==='/api/battles'&&req.method==='GET'){
    const r=await db.prepare(`SELECT * FROM battles WHERE uid=? ORDER BY id DESC LIMIT 300`).bind(me.uid).all();
    const P=s=>{try{return JSON.parse(s||'null')}catch(e){return null}};
    return J({battles:r.results.map(x=>({id:x.id,fmt:x.fmt,result:x.result,my:P(x.my)||[],opp:P(x.opp)||[],my_sel:P(x.my_sel)||[],opp_sel:P(x.opp_sel)||[],info:P(x.opp_info)||{},at:x.created_at}))});
  }
  if((m=path.match(/^\/api\/battles\/(\d+)\/delete$/))&&req.method==='POST'){
    await db.prepare(`DELETE FROM battles WHERE id=? AND uid=?`).bind(+m[1],me.uid).run();return J({ok:true});
  }
  return J({error:'見つかりません。'},404);
}
