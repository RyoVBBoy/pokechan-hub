// 対戦の振り返り（#/replay）の確認（2026/11/13）
// ①サーバー：にせものの Gemini で、束ごとの答えの合わせ方・一部の失敗・おかしな答え・回数の上限・記録の中身の確かめ・持ち主・削除
// ②サイト：動画から場面を取り出す（tests/fixtures の短い動画）・数え方（わからないは勝率に入れない）・直す欄・記録の二度押し・失敗しても中身が残る
import path from 'node:path';
import fs from 'node:fs';
import {makeD1} from './d1mock.mjs';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
let bad=0,n=0;const expect=(name,cond,info)=>{n++;if(!cond){bad++;console.error('NG',name,JSON.stringify(info)?.slice(0,600))}};

/* ---------- ①サーバー ---------- */
const PID='pokechan-test';
const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const kp=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...(await crypto.subtle.exportKey('jwk',kp.publicKey)),kid:'k1',use:'sig',alg:'RS256'};
const now=Math.floor(Date.now()/1000);
const tok=async uid=>{const h=enc({alg:'RS256',kid:'k1',typ:'JWT'}),p=enc({iss:'https://securetoken.google.com/'+PID,aud:PID,sub:uid,iat:now-10,exp:now+3600,auth_time:now-10,email:uid+'@example.com'});
  return h+'.'+p+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',kp.privateKey,new TextEncoder().encode(h+'.'+p))).toString('base64url')};
globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
/* にせものの Gemini：束の最初の秒数ごとに SCRIPT で答えを決める。文字なら答え、数なら HTTP のエラー */
let SCRIPT={},CALLS=0;
const gemReply=t=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:t}]}}]}));
globalThis.fetch=async(u,o)=>{u=String(u);
  if(u.includes('securetoken@system.gserviceaccount.com'))return new Response(JSON.stringify({keys:[jwk]}));
  if(u.includes('generativelanguage')&&u.includes('/models?'))return new Response(JSON.stringify({models:[{name:'models/gemini-2.5-flash',supportedGenerationMethods:['generateContent']}]}));
  if(u.includes('generativelanguage')&&u.includes(':generateContent')){CALLS++;const b=JSON.parse(o.body),t0=parseInt(b.contents[0].parts[0].text);
    const a=SCRIPT[t0]??SCRIPT.def;if(typeof a==='number')return new Response(JSON.stringify({error:{message:'x'}}),{status:a});return gemReply(typeof a==='string'?a:JSON.stringify(a||{}))}
  return new Response('',{status:404})};
const w=(await import(path.join(ROOT,'worker/dist/worker.js'))).default;
const env={DB:makeD1(),FIREBASE_PROJECT_ID:PID,APP_TOKEN:'t',ADMIN_TOKEN:'admin-secret-123',GEMINI_API_KEY:'test-key'};
let ipN=0;
const call=async(p,{method='GET',tok,body}={})=>{const h={'content-type':'application/json','cf-connecting-ip':'10.1.0.'+(++ipN%250)};if(tok)h.authorization='Bearer '+tok;
  const r=await w.fetch(new Request('https://x.dev'+p,{method,headers:h,body:body?JSON.stringify(body):undefined}),env,{waitUntil(){}});return[r.status,await r.json().catch(()=>({}))]};
const A=await tok('rpA'),B=await tok('rpB');
/* 静止画36枚（0〜35秒）＝12枚ずつ3つの束（0秒・12秒・24秒から） */
const FR=k=>Array.from({length:k},(_,i)=>({t:i,d:'QUJD'+'A'.repeat(100)}));
const read=async(script,tk=A,k=36)=>{SCRIPT=script;return call('/api/replay-read',{method:'POST',tok:tk,body:{frames:FR(k)}})};
const OPP=['ガブリアス','カイリュー','サーフゴー','ドラパルト','ガオガエン','ゴリランダー'],MY=['リザードン','カメックス','フシギバナ','ピカチュウ','カビゴン','ゲンガー'];
const S1={format:'single',result:'unknown',opponent_team:OPP,my_team:MY,opponent_used:[],my_used:[]};
const S2={opponent_used:['ガブリアス','カイリュー'],my_used:['リザードン'],opponent_moves:{'ガブリアス':['じしん','まもる','ほげほげ','ハイドロポンプ']}};
const S3={result:'win',opponent_used:['カイリュー','サーフゴー'],my_used:['リザードン','カメックス','フシギバナ'],opponent_items:{'ガブリアス':'こだわりスカーフ','サーフゴー':'ふしぎなアイテム'}};
let r;
r=await read({0:S1,12:S2,24:S3});const R0=r[1];
expect('3つの束を時間の順に合わせる：相手の6匹',r[0]===200&&R0.opp.length===6&&R0.opp[0]===445,R0);
expect('場に出たポケモンは束をまたいでも1回だけ（出た順）',R0.opp_sel.join()==='445,149,1000'&&R0.my_sel.length===3&&R0.my_sel[0]===6,R0);
expect('勝ち負けは結果の画面がある束から',R0.result==='win'&&R0.fmt==='single',R0);
expect('束の数・失敗なし',R0.batches.total===3&&R0.batches.ok===3&&R0.batches.failed===0&&!R0.failed_at.length,R0.batches);
expect('変化技（まもる）も残る',R0.info[445]&&R0.info[445].mv.includes(182)&&R0.info[445].mv.includes(89),R0.info);
expect('表にない技・覚えない技は入れずに知らせる',!R0.info[445].mv.some(x=>x===56)&&R0.unknown.mv.includes('ほげほげ')&&R0.unknown.mv.some(x=>/ハイドロポンプ.*覚えない/.test(x)),R0.unknown);
expect('持ち物：表にあるものだけ',R0.info[445].it==='choicescarf'&&!(R0.info[1000]&&R0.info[1000].it)&&R0.unknown.it.includes('ふしぎなアイテム'),R0);
/* 一部の束が失敗：成功のように見せない */
r=await read({0:S1,12:500,24:S3});
expect('一部の束が失敗しても読めた分は返す・失敗した場面の時間を知らせる',r[0]===200&&r[1].batches.failed===1&&r[1].failed_at[0].join()==='12,23'&&r[1].warn.some(x=>/12秒〜23秒/.test(x))&&r[1].opp.length===6,r[1]);
r=await read({0:S1,12:S2,24:'これはJSONではありません'});
expect('おかしな答え（JSONでない）の束は失敗の扱い',r[0]===200&&r[1].batches.failed===1&&r[1].result===null&&r[1].warn.some(x=>/最後の場面を読めなかった/.test(x)),r[1]);
r=await read({0:S1,12:{...S2,result:'win'},24:503});
expect('最後の束が失敗：途中から読んだ勝ち負けは確かめが要ると知らせる',r[1].result==='win'&&r[1].warn.some(x=>/途中の場面から/.test(x)),r[1]);
r=await read({0:{...S1,result:'lose'},12:S2,24:S3});
expect('勝ち・負けが食い違う：わからないにして知らせる',r[1].result===null&&r[1].warn.some(x=>/違って読めた/.test(x)),r[1]);
r=await read({0:S1,12:{format:'double'},24:S3});
expect('シングル・ダブルが食い違う：わからないにする',r[1].fmt===null&&r[1].warn.some(x=>/シングルかダブルか/.test(x)),r[1]);
/* 形式と選出の数 */
r=await read({0:{...S1,format:'double'},12:{opponent_used:['ガブリアス','カイリュー','サーフゴー','ドラパルト']},24:{my_used:['リザードン','カメックス','フシギバナ','ピカチュウ'],result:'lose'}});
expect('ダブル：出したポケモンは4匹まで入る',r[1].fmt==='double'&&r[1].opp_sel.length===4&&r[1].my_sel.length===4&&r[1].result==='lose',r[1]);
r=await read({0:S1,12:{opponent_used:['ガブリアス','カイリュー','サーフゴー','ドラパルト']},24:S3});
expect('シングルで4匹出たと読めたら3匹にして知らせる',r[1].opp_sel.length===3&&r[1].warn.some(x=>/4匹と読めました/.test(x)),r[1]);
/* 選出画面がない・知らない名前・空の答え・おかしな形 */
r=await read({0:{opponent_used:['ガブリアス','ナゾノポケモン']},12:{},24:{result:'win'}});
expect('選出画面がないときは場に出たポケモンを6匹の欄へ・知らない名前は知らせる',r[1].opp.join()==='445'&&r[1].warn.some(x=>/選出画面が読めなかった/.test(x))&&r[1].unknown.mon.includes('ナゾノポケモン'),r[1]);
r=await read({def:{}});
expect('何も読めなかった：nothing を返す',r[0]===200&&r[1].nothing===true&&r[1].opp.length===0&&r[1].batches.empty===3,r[1]);
r=await read({def:{format:7,result:'draw',opponent_team:'ガブリアス',my_team:[1,{name:'リザードン'},null],opponent_used:{a:1},opponent_moves:['じしん'],opponent_items:{'ガブリアス':{x:1}}}});
expect('型の違う答えでも止まらず、使える所だけ使う',r[0]===200&&r[1].fmt===null&&r[1].result===null&&r[1].opp.length===0&&r[1].my.join()==='6',r[1]);
r=await read({0:S1,12:{opponent_team:['バンギラス','メタグロス','ペリッパー','イダイトウ','ハリーマン','シャワーズ']},24:S3});
expect('6匹が場面によって違う：知らせる',r[1].warn.some(x=>/相手の6匹が、場面によって違って/.test(x)),r[1].warn);
/* 全部失敗：回数に数えない・理由を返す */
const cnt=async()=>(await env.DB.prepare('SELECT COUNT(*) AS c FROM replay_reads WHERE uid=?').bind('rpB').first()).c;
const c0=await cnt();
r=await read({def:429},B);expect('AIの回数切れ・混雑：503 と busy',r[0]===503&&r[1].busy===true,r);
r=await read({def:'{{{'},B);expect('全部おかしな答え：502（日本語の理由）',r[0]===502&&/AIの読み取り/.test(r[1].error),r);
expect('全部失敗は回数に数えない',await cnt()===c0,await cnt());
r=await read({def:S1},B,2);expect('静止画が少なすぎると400',r[0]===400,r);
r=await call('/api/replay-read',{method:'POST',body:{frames:FR(4)}});expect('ログインが必要',r[0]===401,r);
r=await call('/api/replay-read',{method:'POST',tok:B,body:'xx'});expect('おかしな送信内容は400',r[0]===400,r);
/* 1日20回 */
{const C=await tok('rpC');let last;for(let i=0;i<20;i++)last=await read({def:S1},C,4);
const before=CALLS;r=await read({def:S1},C,4);expect('1日20回を超えると429（AIは呼ばない）',last[0]===200&&r[0]===429&&CALLS===before,[last[0],r]);}
/* 記録の中身を確かめる */
const base={fmt:'single',result:'win',opp:[445,149,1000,887,727,812],my:[6,9,3,25,143,94],opp_sel:[445,149],my_sel:[6,9,3],info:{445:{mv:[89,182,99999],it:'choicescarf'},149:{it:'nai-item'},6:{it:'choicescarf'}}};
r=await call('/api/battles',{method:'POST',tok:A,body:base});const id1=r[1].id;expect('記録できる',r[0]===200&&id1>0&&!r[1].dup,r);
r=await call('/api/battles',{method:'POST',tok:A,body:base});expect('同じ中身をすぐ送り直しても2件にしない',r[0]===200&&r[1].dup===true&&r[1].id===id1,r);
r=await call('/api/battles',{tok:A});let bs=r[1].battles;
expect('技・持ち物は表にあるものだけ・相手の6匹にいない匹の情報は捨てる',bs.length===1&&bs[0].info[445].mv.join()==='89,182'&&bs[0].info[445].it==='choicescarf'&&!bs[0].info[149]&&!bs[0].info[6],bs[0]);
expect('自分と相手が入れかわらない',bs[0].opp[0]===445&&bs[0].my[0]===6&&bs[0].my_sel.join()==='6,9,3'&&bs[0].opp_sel.join()==='445,149',bs[0]);
r=await call('/api/battles',{method:'POST',tok:A,body:{...base,result:'draw',opp:[445,999999,-1,'x'],opp_sel:[149],my_sel:[]}});
r=await call('/api/battles',{tok:A});bs=r[1].battles;
expect('図鑑にない番号は捨てる・出したポケモンは6匹にも入れる・win/lose 以外はわからない',bs[0].opp.join()==='445,149'&&bs[0].result===null,bs[0]);
r=await call('/api/battles',{method:'POST',tok:A,body:{...base,my_sel:[6,9,3,25]}});expect('シングルで4匹出したは400',r[0]===400&&/3匹まで/.test(r[1].error),r);
r=await call('/api/battles',{method:'POST',tok:A,body:{...base,fmt:'double',result:'lose',my_sel:[6,9,3,25],opp_sel:[445,149,1000,887]}});expect('ダブルは4匹まで記録できる',r[0]===200,r);
r=await call('/api/battles',{method:'POST',tok:A,body:{...base,result:'lose',opp_sel:[445,248]}});expect('6匹がそろっていて、出したポケモンが6匹にいないと400',r[0]===400,r);
r=await call('/api/battles',{method:'POST',tok:A,body:{...base,opp:[99999],opp_sel:[]}});expect('相手が0匹は400',r[0]===400,r);
r=await call('/api/battles',{method:'POST',tok:A,body:[1,2]});expect('おかしな形は400',r[0]===400,r);
r=await call('/api/battles',{tok:B});expect('ほかの人の記録は見えない',r[1].battles.length===0,r[1]);
r=await call(`/api/battles/${id1}/delete`,{method:'POST',tok:B,body:{}});
expect('ほかの人の記録は消せない（404）',r[0]===404,r);
r=await call('/api/battles',{tok:A});expect('消されていない',r[1].battles.some(b=>b.id===id1),r[1]);
r=await call(`/api/battles/${id1}/delete`,{method:'POST',tok:A,body:{}});expect('自分の記録は消せる',r[0]===200,r);
r=await call('/api/battles',{tok:A});expect('消したら一覧から無くなる',!r[1].battles.some(b=>b.id===id1)&&r[1].battles.length===2,r[1]);
r=await call('/api/battles');expect('記録の一覧もログインが必要',r[0]===401,r);
{const D=await tok('rpD');let last;for(let i=0;i<200;i++)last=await call('/api/battles',{method:'POST',tok:D,body:{...base,result:i%2?'win':'lose'}});
r=await call('/api/battles',{method:'POST',tok:D,body:{...base,result:null}});expect('1日200件を超えると429',last[0]===200&&r[0]===429,r);}
console.log(`replay（サーバー）: ${bad?'NG':'OK'}（${n}項目）`);

/* ---------- ②サイト ---------- */
const {chromium}=await import('playwright');
const URL0='file://'+path.join(ROOT,'dist/index.html');
const br=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const pg=await (await br.newContext({viewport:{width:390,height:844},locale:'ja-JP'})).newPage();
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
const FB_APP=`export const initializeApp=c=>({c});`;
const FB_AUTH=`const user={uid:'u1',email:'a@example.com',getIdToken:async()=>'tok:a'};
export const getAuth=()=>({});export const onAuthStateChanged=(a,f)=>{setTimeout(()=>f(user),0)};
export class GoogleAuthProvider{};export class OAuthProvider{constructor(id){this.id=id}addScope(){}};
export const signInWithPopup=async()=>{};export const signInWithRedirect=signInWithPopup;export const signOut=async()=>{};
export const sendSignInLinkToEmail=async()=>{};export const isSignInWithEmailLink=()=>false;export const signInWithEmailLink=async()=>{};`;
/* にせもののサーバー：記録の保存・一覧・削除と読み取り */
let SV={battles:[],posts:0,failSave:false,slow:0,read:null,nextId:1};
const H={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Content-Type':'application/json'};
await pg.route(/^https?:/,async rt=>{const u=new URL(rt.request().url()),m=rt.request().method();
  const js={status:200,headers:{'Access-Control-Allow-Origin':'*','Content-Type':'text/javascript'}};
  if(u.host==='www.gstatic.com'&&u.pathname.endsWith('/firebase-app.js'))return rt.fulfill({...js,body:FB_APP});
  if(u.host==='www.gstatic.com'&&u.pathname.endsWith('/firebase-auth.js'))return rt.fulfill({...js,body:FB_AUTH});
  if(m==='OPTIONS')return rt.fulfill({status:204,headers:H});
  const J=(o,st=200)=>rt.fulfill({status:st,headers:H,body:JSON.stringify(o)});
  if(u.pathname==='/api/battles'&&m==='GET')return J({battles:SV.battles.slice().reverse()});
  if(u.pathname==='/api/battles'&&m==='POST'){SV.posts++;if(SV.slow)await new Promise(r=>setTimeout(r,SV.slow));if(SV.failSave)return J({error:'x'},500);
    const b=rt.request().postDataJSON();SV.battles.push({...b,id:SV.nextId++,at:Date.now()});return J({ok:true,id:SV.nextId-1})}
  let mm;if((mm=u.pathname.match(/^\/api\/battles\/(\d+)\/delete$/))){SV.battles=SV.battles.filter(b=>b.id!==+mm[1]);return J({ok:true})}
  if(u.pathname==='/api/replay-read'){const x=SV.read;return typeof x==='number'?J({error:'x'},x):J(x)}
  if(u.pathname==='/api/me')return J({user:{handle:'a',name:'A'},email:'a@example.com'});
  if(u.pathname.startsWith('/api/me/'))return J({teams:null,updated_at:0,now:Date.now()});
  if(u.pathname.startsWith('/api/'))return J({});
  return rt.fulfill({status:404,body:''})});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await pg.goto(URL0+'#/replay');await wait(1200);
const ok=(c,m,i)=>expect(m,c,i);
ok(await pg.$('#rp-file'),'ログイン中は動画を選ぶボタンが出る',await pg.textContent('#view'));
ok(!/送ります。、/.test(await pg.textContent('#view')),'説明の文の「。、」を直した');
/* 純粋な関数 */
const P1=await pg.evaluate(()=>{
  const fr=Array.from({length:120},(_,i)=>({t:i,s:i%7,d:''}));const tr=rpTrim(fr,96);
  const bs=[{result:'win',opp:[445,149],opp_sel:[445],my_sel:[6,9,3]},{result:'lose',opp:[445],opp_sel:[445],my_sel:[6,9,3]},{result:null,opp:[445,149],opp_sel:[149],my_sel:[6,9,3]},
    {result:'lose',opp:[445],opp_sel:[],my_sel:[]},{result:'lose',opp:[445,99999],opp_sel:[],my_sel:[]}];
  const S=rpStats(bs);const g=S.seen.find(o=>o.n===445),k=S.seen.find(o=>o.n===149);
  const r=rpFromRead({fmt:null,result:'draw',opp:[445,99999,445],my:[],opp_sel:[445,149,1000,887],my_sel:[],info:{445:{mv:[89],it:'choicescarf'},6:{it:'x'}},warn:['<b>x</b>'],batches:{failed:1},unknown:{mon:['<img>'],mv:[],it:[]}},[6,9]);
  const c1=rpCheck({fmt:'single',opp:[445],my:[],opp_sel:[445,149,1000,887],my_sel:[]}),c2=rpCheck({fmt:'double',opp:[445],my:[],opp_sel:[445,149,1000,887],my_sel:[]}),c3=rpCheck({fmt:'single',opp:[],my:[],opp_sel:[],my_sel:[]}),
    c4=rpCheck({fmt:'single',opp:[1,2,3,4,5,6],my:[],opp_sel:[7],my_sel:[]});
  return{tl:tr.length,first:tr[0].t,last4:tr.slice(-4).map(f=>f.t).join(),sorted:tr.every((f,i)=>!i||tr[i-1].t<f.t),S,g,k,r,c:[c1,c2,c3,c4],short:rpTrim(fr.slice(0,10),96).length};
});
ok(P1.tl===96&&P1.first===0&&P1.last4==='116,117,118,119'&&P1.sorted&&P1.short===10,'96枚にしぼる：最初と最後の4枚を残し時間の順のまま',P1);
ok(P1.S.total===5&&P1.S.known===4&&P1.S.unknown===1&&P1.S.win===1&&P1.S.lose===3,'わからない対戦は勝率に入れない（全部の数には入る）',P1.S);
ok(P1.g.c===5&&P1.g.k===4&&P1.g.w===1,'当たった回数は全部・勝率は勝ち負けがわかる分だけ',P1.g);
ok(P1.S.hard.length===1&&P1.S.hard[0].n===445,'苦手な相手：勝ち負けがわかる3戦以上で45%未満（149 は2戦・1戦が不明なので入らない）',P1.S.hard);
ok(P1.S.mine.length===1&&P1.S.mine[0].c===3&&P1.S.mine[0].kn===2,'選出ごとの勝率も、わからない対戦は勝率に入れない',P1.S.mine);
ok(P1.r.result===null&&P1.r.opp.join()==='445'&&P1.r.opp_sel.length===3&&P1.r.my.join()==='6,9'&&P1.r.myFromTeam&&P1.r.partial,'読み取りの結果を確かめて直す欄の形に（番号の確かめ・いまのパーティで埋めたことを覚える）',P1.r);
ok(P1.r.warn.some(w=>/いまのパーティを入れています/.test(w))&&P1.r.warn.some(w=>/シングルかダブルかは読み取れなかった/.test(w))&&P1.r.warn.some(w=>/<img>/.test(w))&&!P1.r.info[6],'推測で埋めたことは注意に書く',P1.r.warn);
ok(/3匹まで/.test(P1.c[0])&&!P1.c[1]&&/1匹以上/.test(P1.c[2])&&/入っていません/.test(P1.c[3]),'記録する前の確かめ',P1.c);
/* 動画から場面を取り出す */
const vid=f=>fs.readFileSync(path.join(ROOT,'tests/fixtures',f)).toString('base64');
const fx=async(b64,type,name)=>pg.evaluate(async([b64,type,name])=>{const u=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const t0=Date.now();
  try{const x=await rpFrames(new File([u],name,{type}));return{ok:true,n:x.frames.length,ts:x.frames.map(f=>f.t),dur:x.dur,step:x.step,ms:Date.now()-t0,small:x.frames.every(f=>f.d.length<120000)}}catch(e){return{ok:false,code:e.code,msg:e.message,ms:Date.now()-t0}}},[b64,type,name]);
let X=await fx(vid('rp-scenes.webm'),'video/webm','a.webm');if(process.env.RP_DEBUG)console.log(JSON.stringify(X));
ok(X.ok&&X.n>=5&&X.n<=20&&X.ts[0]<1&&X.ts[X.n-1]>=29&&X.small,'画面が変わった場面だけ取り出す（最初・最後の場面を含む）',X);
ok(X.ok&&[6,8,9,10,14,16,17,20,26].every(s=>X.ts.some(t=>Math.abs(t-s)<=1.01)),'画面の一部だけ変わった場面（下の文字の帯・片側の入れかわり）も拾う',X.ts);
X=await fx(vid('rp-nodur.webm'),'video/webm','b.webm');
ok(X.ok&&X.dur>25&&X.ts[X.n-1]>=25,'長さが書かれていない動画も最後まで見る',X);
X=await fx(Buffer.from('これは動画ではありません'.repeat(50)).toString('base64'),'video/mp4','c.mp4');
ok(!X.ok&&X.code==='open'&&X.ms<21000,'壊れた動画はすぐにエラー（待ち続けない）',X);
X=await fx(Buffer.from('abc').toString('base64'),'text/plain','d.txt');
ok(!X.ok&&X.code==='type','動画でないファイルはエラー',X);
/* 画面の流れ：一部失敗した読み取り → 注意を出す・記録の二度押し・失敗しても中身が残る・削除 */
SV.read={fmt:'single',result:null,opp:[445,149,1000],my:[],opp_sel:[445,149],my_sel:[],info:{445:{mv:[182]}},warn:['動画の一部（12秒〜23秒の場面）を読み取れませんでした。'],unknown:{mon:['ナゾ'],mv:[],it:[]},batches:{total:3,ok:2,failed:1,empty:0},failed_at:[[12,23]],nothing:false,sec:3};
await pg.setInputFiles('#rp-file',path.join(ROOT,'tests/fixtures/rp-scenes.webm'));
await pg.waitForSelector('#rp-save',{timeout:30000});await wait(200);
let t=await pg.textContent('#rp-root');if(process.env.RP_SHOT)await (await pg.$('#rp-edit')).screenshot({path:process.env.RP_SHOT.replace('.png','-edit.png')});
ok(/一部は読み取れていないか、確かめが必要/.test(t)&&/確かめてほしいこと/.test(t)&&/12秒〜23秒/.test(t)&&/ナゾ/.test(t),'一部だけ読めたときは、成功ではなく確かめが要ると出す',t.slice(0,600));
ok(/いまのパーティを入れています/.test(t)||!(await pg.evaluate(()=>team.length)),'自分の6匹をパーティで埋めたら知らせる',t.slice(0,600));
ok(/まもる/.test(t),'相手の変化技も表示',t);
ok(/「わからない」の対戦は、勝率には入りません/.test(t),'わからないの説明',t);
SV.failSave=true;await pg.click('#rp-save');await wait(400);
t=await pg.textContent('#rp-root');
ok(/記録できませんでした/.test(t)&&/そのまま残っています/.test(t)&&await pg.$('#rp-save')&&(await pg.$$('[data-rprm^="opp:"]')).length===3,'記録に失敗しても直した中身は残る',t.slice(0,400));
SV.failSave=false;SV.slow=600;const p0=SV.posts;
await pg.evaluate(()=>{const b=document.getElementById('rp-save');b.click();b.click();setTimeout(()=>{const c=document.getElementById('rp-save');if(c)c.click()},50)});
await wait(1500);
ok(SV.posts-p0===1&&SV.battles.length===1,'記録するを何度押しても1件だけ',{posts:SV.posts-p0,n:SV.battles.length});
ok(!(await pg.$('#rp-save'))&&SV.battles[0].opp.join()==='445,149,1000'&&SV.battles[0].result===null,'記録したら欄を閉じる・中身はそのまま送る',SV.battles[0]);
SV.slow=0;await wait(300);
t=await pg.textContent('#rp-stats');ok(/勝ち負けがわからない対戦が1件/.test(t)&&/勝敗不明/.test(t),'わからない対戦は勝敗不明として出す',t.slice(0,300));
/* 読み取りの失敗 → 手で記録する欄が開く */
for(const [st,re] of [[429,/回数.*使い切りました/],[503,/混み合って/],[502,/うまくいきませんでした/]]){
  await pg.evaluate(()=>{RP.read=null;rpEdit()});SV.read=st;
  await pg.setInputFiles('#rp-file',path.join(ROOT,'tests/fixtures/rp-scenes.webm'));
  await pg.waitForSelector('#rp-msg .rp-bad',{timeout:30000});await wait(200);t=await pg.textContent('#rp-root');
  ok(re.test(t)&&/手で記録/.test(t)&&await pg.$('#rp-save')&&!/読み取りが終わりました/.test(t),`読み取りの失敗（${st}）：理由と手で記録する欄`,t.slice(0,400));
}
/* 何も読めなかった */
await pg.evaluate(()=>{RP.read=null;rpEdit()});SV.read={fmt:null,result:null,opp:[],my:[],opp_sel:[],my_sel:[],info:{},warn:[],unknown:{},batches:{total:2,ok:2,failed:0,empty:2},nothing:true,sec:1};
await pg.setInputFiles('#rp-file',path.join(ROOT,'tests/fixtures/rp-scenes.webm'));await pg.waitForSelector('#rp-msg .rp-bad',{timeout:30000});
t=await pg.textContent('#rp-root');ok(/読み取れませんでした/.test(t)&&!/読み取りが終わりました/.test(t),'何も読めなかったときは成功と言わない',t.slice(0,300));
/* 手で記録：シングル3匹まで・ダブル4匹 */
await pg.evaluate(()=>{RP.read=null;rpEdit()});await pg.click('#rp-man');await wait(200);
const add=async(to,q)=>{await pg.selectOption('#rp-to',to);await pg.fill('#rp-q',q);await wait(100);await pg.click('[data-rpadd]')};
await add('opp_sel','ガブリアス');await add('opp_sel','カイリュー');await add('opp_sel','サーフゴー');
ok((await pg.$$('[data-rprm^="opp:"]')).length===3,'出したポケモンは相手の6匹にも入る');
await pg.click('[data-rpfmt=double]');await add('opp_sel','ドラパルト');await pg.click('[data-rpres=lose]');
await pg.click('[data-rpfmt=single]');await wait(100);t=await pg.textContent('#rp-edit');
ok(/3匹まで/.test(t),'シングルに戻すと4匹は記録できないと出す',t.slice(0,300));
const n0=SV.posts;await pg.click('#rp-save');await wait(300);ok(SV.posts===n0,'確かめに引っかかると送らない');
await pg.click('[data-rpfmt=double]');await pg.click('#rp-save');await wait(500);
ok(SV.battles.length===2&&SV.battles[1].fmt==='double'&&SV.battles[1].opp_sel.length===4&&SV.battles[1].result==='lose','ダブル4匹を手で記録できる',SV.battles[1]);
/* 削除で数が変わる */
t=await pg.textContent('#rp-stats');ok(/>?2</.test(await pg.innerHTML('#rp-stats .prof'))||/2対戦/.test(t),'2件の記録',t.slice(0,200));
await pg.click('[data-rpdel]');await wait(300);await pg.click('.xc .xc-ok');await wait(600);
ok(SV.battles.length===1&&(await pg.$$('[data-rpdel]')).length===1,'削除すると一覧と数が変わる',SV.battles.length);
if(process.env.RP_SHOT)await pg.screenshot({path:process.env.RP_SHOT,fullPage:true});
ok(!errs.length,'ページのエラーなし',errs);
await br.close();
console.log(`replay: ${bad?'NG':'OK'}（${n}項目）`);
if(bad)process.exit(1);
