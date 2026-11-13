/* ===================== 対戦の振り返り（画面収録の動画から） =====================
   サイトが動画から画面の変わった場面の静止画（最大96枚）を取り出し（スマホの中）、その静止画だけを送ってくる。動画は受け取らない・静止画も保存しない。
   ・POST /api/replay-read：Gemini で事実（相手の6匹・自分の6匹・お互いの選出・相手が使った技と持ち物・勝ち負け）を読む
   ・POST /api/battles（保存）・GET /api/battles（自分の記録）・POST /api/battles/番号/delete
   ログインした人だけ。読み取りは1日20回まで */
const REPLAY_PROMPT=`これは「ポケモンチャンピオンズ」の対戦を画面収録した動画から、時間の順に取り出した静止画の一部です（各画像の前に動画の中の秒数があります）。動画の途中だけの場面なので、選出画面や結果の画面が入っていないことがよくあります。
画面に文字や姿がはっきり映っている事実だけを読み取ってください。推測・補完はしないでください。この画像の中で確かめられない項目は null や空にします。
- opponent_team：対戦前の選出画面で、右側（赤いパネル）に並ぶ相手の6匹の名前。選出画面が映っていなければ空
- my_team：同じ画面で、左側（青いパネル）に並ぶ自分の6匹の名前。選出画面が映っていなければ空
- opponent_used：対戦中に場に出てきた相手のポケモンの名前（出てきた順）。選出画面に並んでいるだけのポケモンは入れない
- my_used：対戦中に場に出てきた自分のポケモンの名前（出てきた順）。選出画面に並んでいるだけのポケモンは入れない
- opponent_moves：相手のポケモンごとに、使ったと画面に出た技の名前（「相手の 〇〇の △△！」のような文字）。自分のポケモンの技は入れない
- opponent_items：相手のポケモンごとに、画面に出た持ち物（メガシンカしたらメガストーンの名前）。文字が出ていなければ入れない
- result：対戦の結果の画面（勝ち・負けの表示）が映っているときだけ、勝ったなら "win"、負けたなら "lose"。映っていなければ "unknown"
- format：画面からシングルかダブルかがはっきり分かるときだけ "single" か "double"。分からなければ null
名前はすべて日本語の正式名。地方の姿は「ライチュウ（アローラ）」の形。メガシンカしたポケモンは元のポケモンの名前にする。
次の JSON だけを返してください：
{"format":null,"result":"unknown","opponent_team":[],"my_team":[],"opponent_used":[],"my_used":[],"opponent_moves":{"名前":["技"]},"opponent_items":{"名前":"持ち物"}}`;
/* AI の答え（12枚ずつの1つの束）を確かめる（2026/11/13）。JSON でない・形が違うときは null＝その束は読めなかった扱い。
   名前は文字の列だけ残す（数や入れ子は捨てる）。ここではまだ図鑑の番号にしない */
function rpParse(text){
  const t=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  let x;try{x=JSON.parse(t)}catch(e){try{x=JSON.parse((t.match(/\{[\s\S]*\}/)||[''])[0])}catch(e2){return null}}
  /* 答えが [ {...} ] の形で来たら、中の最初のものを使う（2026/11/13） */
  if(Array.isArray(x))x=x.find(v=>v&&typeof v==='object'&&!Array.isArray(v));
  if(!x||typeof x!=='object'||Array.isArray(x))return null;
  const str=v=>typeof v==='string'?v.trim().slice(0,40):v&&typeof v==='object'&&typeof v.name==='string'?v.name.trim().slice(0,40):'';
  const arr=v=>(Array.isArray(v)?v:[]).map(str).filter(Boolean).slice(0,12);
  const map=(v,f)=>{const o={};if(v&&typeof v==='object'&&!Array.isArray(v))for(const [k,w] of Object.entries(v).slice(0,12)){const kk=str(k),ww=f(w);if(kk&&ww&&(!Array.isArray(ww)||ww.length))o[kk]=ww}return o};
  return{format:['single','double'].includes(x.format)?x.format:null,result:['win','lose'].includes(x.result)?x.result:null,
    opponent_team:arr(x.opponent_team),my_team:arr(x.my_team),opponent_used:arr(x.opponent_used),my_used:arr(x.my_used),
    opponent_moves:map(x.opponent_moves,arr),opponent_items:map(x.opponent_items,v=>str(v)||null)};
}
const rpEmpty=x=>!x.format&&!x.result&&!x.opponent_team.length&&!x.my_team.length&&!x.opponent_used.length&&!x.my_used.length&&!Object.keys(x.opponent_moves).length&&!Object.keys(x.opponent_items).length;
/* 振り返り専用の AI 呼び出し（2026/11/13、依頼主の iPhone で8か所中7か所が読めなかった件）：
   ・1回ごとに時間を決めて打ち切る（fetch を止める）
   ・考える時間（thinking）を止める：2.5 は thinkingBudget 0、3 以降は thinkingLevel 'minimal'。受け付けないモデルなら設定なしでもう一度
   ・混雑（429/503）なら次のモデル、時間切れはすぐあきらめる
   ・失敗の理由を why（busy・timeout・invalid・error）で返し、画面に出せるようにする */
const rpE=(why,m)=>Object.assign(new Error(m||why),{why});
async function rpGem(env,parts,ms){
  let cands=env.GEMINI_MODEL?[env.GEMINI_MODEL]:[];
  try{cands=[...new Set([...cands,...await listGemini(env)])]}catch(e){if(!cands.length)throw rpE('error','AIのモデル一覧を読めませんでした')}
  let last=rpE('error');
  for(const m of cands.slice(0,3)){
    for(const think of [true,false]){
      const gc={temperature:0,responseMimeType:'application/json'};
      if(think){if(/gemini-2\.5-flash/.test(m))gc.thinkingConfig={thinkingBudget:0};else if(/gemini-([3-9]|\d\d)/.test(m))gc.thinkingConfig={thinkingLevel:'minimal'}}
      const ctl=new AbortController();let tm;
      const stop=new Promise((_,rej)=>{tm=setTimeout(()=>{try{ctl.abort()}catch(e){}rej(rpE('timeout','時間切れ'))},ms)});
      try{
        const r=await Promise.race([fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,{method:'POST',signal:ctl.signal,headers:{'x-goog-api-key':env.GEMINI_API_KEY,'content-type':'application/json'},body:JSON.stringify({contents:[{parts}],generationConfig:gc})}),stop]);
        await aiTick(env,r.status);
        if(r.ok){const j=await Promise.race([r.json(),stop]);const c=(j.candidates||[])[0]||{};return(c.content&&c.content.parts||[]).map(p=>p.text||'').join('')}
        const t=await Promise.race([r.text(),stop]);
        if(r.status===400&&gc.thinkingConfig&&/thinking/i.test(t))continue;
        last=rpE([429,503].includes(r.status)?'busy':'error',`AI ${r.status}`);break;
      }catch(e){if(e.why==='timeout'||ctl.signal.aborted)throw rpE('timeout','時間切れ');last=rpE('error',String(e.message||e).slice(0,60));break}
      finally{clearTimeout(tm)}
    }
  }
  throw last;
}
/* 決めた数ずつ同時に動かす（8か所を一度に送ると AI に断られやすい） */
async function rpPool(items,n,fn){const out=new Array(items.length);let i=0;
  await Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{while(i<items.length){const k=i++;try{out[k]={ok:true,v:await fn(items[k],k)}}catch(e){out[k]={ok:false,e}}}}));return out}
const RP_WHY={busy:'AIが混み合っていた・回数の上限',timeout:'時間切れ',invalid:'AIの答えの形がおかしかった',error:'AIとの通信の失敗'};
let RP_MV=null;
const rpMvMap=()=>{if(RP_MV)return RP_MV;RP_MV={};for(const id in MVN)RP_MV[kkey(MVN[id])]=+id;for(const id in MV)if(!RP_MV[kkey(MV[id][0])])RP_MV[kkey(MV[id][0])]=+id;return RP_MV};
const rpSec=t=>`${Math.round(t)}秒`;
/* 束ごとの答えを合わせる（束は時間の順）。bs=[{t0,t1,x|null}]。
   ・6匹：番号にできた数がいちばん多い束（同じなら早い束）。ほかの束と2匹以上ちがえば知らせる
   ・場に出たポケモン：束の順に足し、同じポケモンは1回（シングル3匹・ダブル4匹まで。多ければ知らせる）
   ・勝ち負け・形式：束によって違えば「わからない」にして知らせる。最後の束を読めなかったら知らせる
   ・技・持ち物：表にない名前・そのポケモンが覚えない技は捨てて、名前を知らせる */
function rpMerge(bs){
  const warn=[],unk={mon:[],mv:[],it:[]},add=(a,v)=>{if(v&&!a.includes(v))a.push(v)};
  const ok=bs.filter(b=>b.x),nm=n=>(BYNO[n]||{}).n||'';
  const mon=n=>{const m=monOf(n);if(!m)add(unk.mon,n);return m};
  const nos=a=>{const o=[];for(const n of a){const m=mon(n);if(m&&!o.includes(m.no))o.push(m.no)}return o};
  const fs=[...new Set(ok.map(b=>b.x.format).filter(Boolean))];
  const fmt=fs.length===1?fs[0]:null;if(fs.length>1)warn.push('シングルかダブルかが、場面によって違って読めました。正しい方を選んでください。');
  const cap=fmt==='single'?3:4;
  const team=(k,who)=>{let best=[];const all=[];ok.forEach(b=>{const v=nos(b.x[k]);if(v.length)all.push(v);if(v.length>best.length)best=v});
    if(all.some(v=>v.filter(n=>!best.includes(n)).length>=2))warn.push(`${who}の6匹が、場面によって違って読めました。確かめてください。`);return best.slice(0,6)};
  const opp=team('opponent_team','相手'),my=team('my_team','自分');
  const used=(k,who)=>{const v=nos(ok.flatMap(b=>b.x[k]));if(v.length>cap){warn.push(`${who}が場に出したポケモンが${v.length}匹と読めました（${fmt==='single'?'シングルは3':fmt==='double'?'ダブルは4':'多くても4'}匹まで）。最初の${cap}匹だけ入れています。確かめてください。`)}return v.slice(0,cap)};
  const opp_sel=used('opponent_used','相手'),my_sel=used('my_used','自分');
  const fit=(sel,tm,who)=>{if(!tm.length){if(sel.length){tm.push(...sel);warn.push(`選出画面が読めなかったため、「${who}の6匹」には場に出たポケモンだけを入れています。`)}return}
    for(const n of sel)if(!tm.includes(n)){if(tm.length<6)tm.push(n);else warn.push(`場に出た${nm(n)}が「${who}の6匹」に入っていません（どちらかの読み間違いかもしれません）。確かめてください。`)}};
  fit(opp_sel,opp,'相手');fit(my_sel,my,'自分');
  const rs=[...new Set(ok.map(b=>b.x.result).filter(Boolean))];let result=rs.length===1?rs[0]:null;
  if(rs.length>1)warn.push('勝ち・負けが場面によって違って読めたため、「わからない」にしています。正しい方を選んでください。');
  const last=bs[bs.length-1];
  if(last&&!last.x)warn.push(result?'最後の場面を読めなかったため、勝ち負けは途中の場面から読んだものです。確かめてください。':'最後の場面を読めなかったため、勝ち負けはわかりませんでした。');
  else if(!rs.length)warn.push('結果の画面が見つからなかったため、勝ち負けは「わからない」にしています。');
  const R=revMaps(),MM=rpMvMap(),info={};
  ok.forEach(b=>{for(const [n,mv] of Object.entries(b.x.opponent_moves)){const m=mon(n);if(!m)continue;if(!opp.includes(m.no)){mv.forEach(x=>add(unk.mv,`${x}（${n}）`));continue}
    const o=info[m.no]=info[m.no]||{};o.mv=o.mv||[];const ls=LSD[m.no]&&LSD[m.no][1];
    for(const x of mv){const id=MM[kkey(x)];if(!id){add(unk.mv,x);continue}if(ls&&!ls.includes(id)){add(unk.mv,`${x}（${m.n}は覚えない技）`);continue}add(o.mv,id)}}
    for(const [n,it] of Object.entries(b.x.opponent_items)){const m=mon(n);if(!m)continue;const k=R.it[kkey(it)];if(!k){add(unk.it,it);continue}if(opp.includes(m.no))(info[m.no]=info[m.no]||{}).it=k}});
  for(const no in info){const o=info[no];if(o.mv&&o.mv.length>4)warn.push(`${nm(no)}の技が${o.mv.length}つ読めました（4つまで）。最初に読めた4つだけ入れています。`);if(o.mv)o.mv=o.mv.slice(0,4);if(o.mv&&!o.mv.length)delete o.mv;if(!Object.keys(o).length)delete info[no]}
  const failed=bs.filter(b=>!b.x);
  if(failed.length)warn.unshift(`動画の一部（${failed.map(b=>`${rpSec(b.t0)}〜${rpSec(b.t1)}`).join('・')}の場面）を読み取れませんでした。その場面の情報は入っていないので、確かめて直してください。`);
  if(failed.length){const w={};failed.forEach(b=>{const k=b.why||'error';w[k]=(w[k]||0)+1});warn.splice(1,0,`読み取れなかった理由：${Object.entries(w).map(([k,n])=>`${RP_WHY[k]||k}（${n}か所）`).join('、')}`)}
  const nothing=!opp.length&&!my.length&&!result&&!fmt;
  return{fmt,result,opp,my,opp_sel,my_sel,info,warn,unknown:unk,nothing,
    batches:{total:bs.length,ok:ok.length,failed:failed.length,empty:ok.filter(b=>rpEmpty(b.x)).length},failed_at:failed.map(b=>[b.t0,b.t1])};
}
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
/* 図鑑にある番号だけ（BYNO にはメガシンカの姿も入る） */
const noList=a=>[...new Set((Array.isArray(a)?a:[]).map(Number).filter(n=>Number.isInteger(n)&&n>0&&BYNO[n]))].slice(0,6);
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
    const fr=(Array.isArray(b.frames)?b.frames:[]).slice(0,100).filter(f=>f&&typeof f.d==='string'&&f.d.length<400000&&/^[A-Za-z0-9+/=]+$/.test(f.d.slice(0,100))).map(f=>({t:Number.isFinite(+f.t)?Math.max(0,+f.t):0,d:f.d}));
    if(fr.length<3)return J({error:'動画から静止画を取り出せませんでした。'},400);
    fr.sort((x,y)=>x.t-y.t);
    /* 1回で全部送ると時間切れ（524）になりやすいので、12枚ずつに分けて同時に読み、あとで時間の順に合わせる */
    const chunks=[];for(let i=0;i<fr.length;i+=12)chunks.push(fr.slice(i,i+12));
    const t0=Date.now(),ms=+env.RP_BATCH_MS||75000;
    const read1=async ch=>{
      const parts=[];ch.forEach(f=>{parts.push({text:rpSec(f.t)});parts.push({inline_data:{mime_type:'image/jpeg',data:f.d}})});parts.push({text:REPLAY_PROMPT});
      const x=rpParse(await rpGem(env,parts,ms));if(!x)throw rpE('invalid','AIの答えの形が正しくありませんでした');return x};
    /* 4つずつ読む。読めなかった束は、時間が残っていれば1回だけ読み直す（混雑なら少し待ってから） */
    const res=await rpPool(chunks,4,read1);
    const again=res.map((r,i)=>r.ok?-1:i).filter(i=>i>=0);
    if(again.length&&Date.now()-t0<120000){
      if(again.some(i=>res[i].e.why==='busy'))await new Promise(r=>setTimeout(r,+env.RP_RETRY_WAIT||3000));
      const r2=await rpPool(again,4,i=>read1(chunks[i]));r2.forEach((r,k)=>{if(r.ok)res[again[k]]=r;else res[again[k]]=r});
    }
    const bs=res.map((r,i)=>({t0:chunks[i][0].t,t1:chunks[i][chunks[i].length-1].t,x:r.ok?r.v:null,why:r.ok?null:(r.e&&r.e.why)||'error'}));
    const whyN={};bs.forEach(b=>{if(b.why)whyN[b.why]=(whyN[b.why]||0)+1});
    if(!bs.some(x=>x.x)){
      /* 全部の束が読めなかった：回数には数えない。理由ごとに返す */
      if(whyN.busy)return J({error:'AIが混み合っているか、AIの1日の回数の上限に達していて、いまは読み取れません。',busy:true,why:whyN},503);
      if(whyN.timeout===bs.length)return J({error:'AIの読み取りに時間がかかりすぎました。少し時間をおいてもう一度試すか、手で記録してください。',why:whyN},504);
      return J({error:'AIの読み取りがうまくいきませんでした。少し時間をおいてもう一度試すか、手で記録してください。',why:whyN},502);
    }
    await db.prepare(`INSERT INTO replay_reads(uid,created_at) VALUES(?,?)`).bind(me.uid,now).run();
    const o=rpMerge(bs);
    return J({...o,why:whyN,frames:fr.length,sec:Math.round((Date.now()-t0)/100)/10});
  }
  if(path==='/api/battles'&&req.method==='POST'){
    let b;try{b=JSON.parse(await req.text())}catch(e){return J({error:'送信内容を読めませんでした。'},400)}
    if(!b||typeof b!=='object'||Array.isArray(b))return J({error:'送信内容を読めませんでした。'},400);
    /* 記録の中身を確かめる（2026/11/13）：図鑑にない番号は捨てる・出したポケモンはシングル3匹／ダブル4匹まで・出したポケモンは6匹にも入れる・
       技と持ち物は表にあるものだけ・勝ち負けは win/lose 以外は「わからない」 */
    const fmt=b.fmt==='double'?'double':'single',cap=fmt==='double'?4:3;
    const opp=noList(b.opp),my=noList(b.my),opp_sel=noList(b.opp_sel),my_sel=noList(b.my_sel);
    if(opp_sel.length>cap||my_sel.length>cap)return J({error:`${fmt==='double'?'ダブル':'シングル'}で出したポケモンは${cap}匹までです。`},400);
    for(const [sel,tm,who] of [[opp_sel,opp,'相手'],[my_sel,my,'自分']])for(const n of sel)if(!tm.includes(n)){if(tm.length>=6)return J({error:`${who}が出したポケモンが「${who}の6匹」に入っていません。`},400);tm.push(n)}
    if(opp.length<1)return J({error:'相手のポケモンを1匹以上入れてください。'},400);
    const c=await db.prepare(`SELECT COUNT(*) AS c FROM battles WHERE uid=? AND created_at>?`).bind(me.uid,now-864e5).first();
    if(c&&c.c>=200)return J({error:'1日に記録できる数（200件）を超えました。'},429);
    const info={};if(b.info&&typeof b.info==='object')for(const [k,v] of Object.entries(b.info).slice(0,12)){const no=+k;if(!opp.includes(no)||!v||typeof v!=='object')continue;
      const mv=[...new Set((Array.isArray(v.mv)?v.mv:[]).map(Number).filter(n=>MVN[n]||MV[n]))].slice(0,4),it=typeof v.it==='string'&&ITEMN[v.it]?v.it:undefined;
      if(mv.length||it)info[no]={mv,it}}
    const result=['win','lose'].includes(b.result)?b.result:null,row=[fmt,result,JSON.stringify(my),JSON.stringify(opp),JSON.stringify(my_sel),JSON.stringify(opp_sel),JSON.stringify(info)];
    /* 二重の記録を防ぐ：同じ人が2分以内に同じ中身を送ったら、前の記録を返す（通信が切れて押し直したときなど） */
    const lt=await db.prepare(`SELECT id,fmt,result,my,opp,my_sel,opp_sel,opp_info FROM battles WHERE uid=? AND created_at>? ORDER BY id DESC LIMIT 1`).bind(me.uid,now-12e4).first();
    if(lt&&[lt.fmt,lt.result,lt.my,lt.opp,lt.my_sel,lt.opp_sel,lt.opp_info].every((v,i)=>v===row[i]))return J({ok:true,id:lt.id,dup:true});
    const r=await db.prepare(`INSERT INTO battles(uid,fmt,result,my,opp,my_sel,opp_sel,opp_info,created_at) VALUES(?,?,?,?,?,?,?,?,?) RETURNING id`)
      .bind(me.uid,...row,now).first();
    await usageSeen(db,me.uid,fmt,opp,'battle',now);
    return J({ok:true,id:r.id});
  }
  if(path==='/api/battles'&&req.method==='GET'){
    const r=await db.prepare(`SELECT * FROM battles WHERE uid=? ORDER BY id DESC LIMIT 300`).bind(me.uid).all();
    const P=s=>{try{return JSON.parse(s||'null')}catch(e){return null}};
    return J({battles:r.results.map(x=>({id:x.id,fmt:x.fmt,result:x.result,my:P(x.my)||[],opp:P(x.opp)||[],my_sel:P(x.my_sel)||[],opp_sel:P(x.opp_sel)||[],info:P(x.opp_info)||{},at:x.created_at}))});
  }
  if((m=path.match(/^\/api\/battles\/(\d+)\/delete$/))&&req.method==='POST'){
    /* 自分の記録だけ消せる（ほかの人の番号を送っても消えない） */
    const d=await db.prepare(`DELETE FROM battles WHERE id=? AND uid=?`).bind(+m[1],me.uid).run();
    if(!(d&&d.meta&&d.meta.changes))return J({error:'この記録は見つかりませんでした（すでに消えているかもしれません）。'},404);
    return J({ok:true});
  }
  return J({error:'見つかりません。'},404);
}
