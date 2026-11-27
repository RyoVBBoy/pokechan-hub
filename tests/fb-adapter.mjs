// Firebase 側の利用停止（docs/secure-link-posting-runbook.md §6）の確認。本物の Firebase には一切つながない（にせものの auth と、本物のサーバーのプログラム）。
// ・確かめた停止で UID を止め、ログインの印を取り消す（fb_sync のあるべき状態 → tools/firebase-adapter/adapter.mjs）
// ・戻すのは、この仕組みが止めた・最初は止まっていなかった・ほかの有効な制限がないときだけ（戻す直前に D1 で確かめ直す）
// ・外を変える前に最初の状態を記録（途中で失敗しても持ち主の記録を失わない）・借りる印と番号で古い報告を断る・だんだん間をあけてやり直す・10回で止めて知らせる
// ・合言葉がちがえば何も返さない
// ・ブロッキング関数の判断（tools/firebase-blocking/decide.js）
import path from 'node:path';
import {createRequire} from 'node:module';
import {makeD1} from './d1mock.mjs';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const require=createRequire(import.meta.url);
const {runOnce,pickEnv}=await import(path.join(ROOT,'tools/firebase-adapter/adapter.mjs'));
const {decide,NEUTRAL,makeBreaker,envFor}=require(path.join(ROOT,'tools/firebase-blocking/decide.js'));
const PID='pokechan-test';
const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const kp=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...(await crypto.subtle.exportKey('jwk',kp.publicKey)),kid:'k1',use:'sig',alg:'RS256'};
const T0=Math.floor(Date.now()/1000);
const tok=async(uid,email)=>{const T0=Math.floor(Date.now()/1000);const h=enc({alg:'RS256',kid:'k1',typ:'JWT'}),p=enc({iss:'https://securetoken.google.com/'+PID,aud:PID,sub:uid,iat:T0-10,exp:T0+3600,auth_time:T0-10,email:email||uid+'@mail.test-gk.net',email_verified:true});
  return h+'.'+p+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',kp.privateKey,new TextEncoder().encode(h+'.'+p))).toString('base64url')};
globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
const OUT=[];globalThis.fetch=async u=>{u=String(u);OUT.push(u);if(u.includes('securetoken@system'))return new Response(JSON.stringify({keys:[jwk]}));if(u.startsWith('https://webrisk.googleapis.com/'))return new Response('{}');return new Response('',{status:404})};
const w=(await import(path.join(ROOT,'worker/dist/worker.js'))).default;
const AT='adapter-token-test-0123456789abcdef-xyz',HT='hook-token-test-0123456789abcdef-xyz-q';
const env={DEBUG_ERR:process.env.FBDBG,DB:makeD1(),FIREBASE_PROJECT_ID:PID,APP_TOKEN:'t',ADMIN_TOKEN:'admin-secret-123',SANCTIONS_ON:'1',LINKS_POST:'1',LINKS_CLICK:'1',EMAIL_HMAC_KEY:'email-hmac-key-test-0123456789abcdef-fb',WEBRISK_API_KEY:'wr',FB_ADAPTER_TOKEN:AT,FB_HOOK_TOKEN:HT,FB_ENV_ID:'test-env'};
let clock=Date.now();Date.now=()=>clock;const tick=(ms=16e3)=>{clock+=ms};
const call=async(p,{method='GET',tok,body,admin,hdr={}}={})=>{const h={'content-type':'application/json','cf-connecting-ip':'10.5.0.1',...hdr};if(tok)h.authorization='Bearer '+tok;if(admin)h['x-admin-token']=admin;
  const r=await w.fetch(new Request('https://x.dev'+p,{method,headers:h,body:body?JSON.stringify(body):undefined}),env,{waitUntil(){}});return[r.status,await r.json().catch(()=>({}))]};
/* アダプターの通信を、本物のサーバーのプログラムへ（外には出さない） */
const fetchImpl=async(u,o={})=>{const x=new URL(u);const r=await w.fetch(new Request('https://x.dev'+x.pathname,{method:o.method||'GET',headers:o.headers,body:o.body}),env,{waitUntil(){}});return r};
let n=0,bad=0;const ok=(c,m,i)=>{n++;if(!c){bad++;console.error('NG',m,JSON.stringify(i)?.slice(0,300))}};
/* にせものの Firebase Auth（失敗の注入：fail＝update が失敗、rfail＝revoke が失敗、hang＝返事をしない、late＝時間切れのあとで本当に終わる、slow＝そのたびに時計を進める） */
const FB={users:{},calls:[],fail:new Set(),rfail:new Set(),hang:new Set(),late:new Map(),afterUpdate:null,slow:0};
const auth={getUser:async uid=>{FB.calls.push(['get',uid]);if(FB.slow)tick(FB.slow);if(!FB.users[uid])throw Object.assign(new Error('nf'),{code:'auth/user-not-found'});return{...FB.users[uid]}},
  updateUser:async(uid,p)=>{FB.calls.push(['update',uid,p]);if(FB.slow)tick(FB.slow);if(FB.hang.has(uid))return new Promise(()=>{});
    if(FB.late.has(uid)){const ms=FB.late.get(uid);return new Promise(r=>setTimeout(()=>{FB.users[uid]={...FB.users[uid],...p};FB.calls.push(['late-done',uid,p]);r()},ms))}
    if(FB.fail.has(uid))throw Object.assign(new Error('x'),{code:'auth/internal-error'});FB.users[uid]={...FB.users[uid],...p};if(FB.afterUpdate)await FB.afterUpdate(uid,p)},
  revokeRefreshTokens:async uid=>{FB.calls.push(['revoke',uid]);if(FB.rfail.has(uid))throw Object.assign(new Error('r'),{code:'auth/internal-error'})}};
const TENV={name:'test',worker:'http://localhost',workerEnvId:'test-env',project:'pokechan-test',serviceAccount:'adapter@pokechan-test.iam.gserviceaccount.com'};
const OPT={env:TENV,token:AT,auth,fetchImpl,sdk:{projectId:'pokechan-test',serviceAccount:TENV.serviceAccount},timeoutMs:300,settleMs:2000};
const run=(o={})=>runOnce({...OPT,...o});
const ADM={admin:'admin-secret-123'};
const RAT='意図的にフィッシングのリンクを広めたと確認したため停止する';
const mk=async(uid,h)=>{const t=await tok(uid);await call('/api/me',{method:'POST',tok:t,body:{handle:h,name:h,agree:true}});FB.users[uid]={uid,disabled:false};return t};
const EXTRA={};
const perp=async(uid,h,{kind='perpetrator',months,extra,useExtra}={})=>{const t=FB.users[uid]?await tok(uid):await mk(uid,h);let nn;
  if(useExtra)nn=EXTRA[uid];else{tick();nn=(await call('/api/notes',{method:'POST',tok:t,body:{body:'証拠の投稿 '+h+' '+clock}}))[1].id}
  if(extra){tick();EXTRA[uid]=(await call('/api/notes',{method:'POST',tok:t,body:{body:'もう1つの証拠の投稿 '+h+' '+clock}}))[1].id}
  const c=await call('/api/admin/cases',{method:'POST',...ADM,body:{handle:h,kind:'attack',summary:'このリンクがフィッシングと確かめた（記録の番号で確認）',refs:[{t:'note',id:nn}],evidence_kinds:['direct'],attest:true,reviewer:'テスト担当'}});
  const s=await call("/api/admin/sanctions",{method:"POST",...ADM,body:{kind,case_id:c[1].case_id,rationale:RAT,confirm:'SANCTION',reviewer:'テスト担当',...(months?{months}:{}),...(kind==='perpetrator'?{basis:'deliberate_attack'}:{})}});ok(s[0]===200,'停止 '+h,s);return{t,id:s[1].id}};
const rev=id=>call(`/api/admin/sanctions/${id}/reverse`,{method:'POST',...ADM,body:{reason:'誤りと確認したため取り消し',confirm:true}});
const row=uid=>env.DB.prepare(`SELECT * FROM fb_sync WHERE uid=?`).bind(uid).first();
const post=(p,b)=>call(p,{method:'POST',body:b,hdr:{'x-fb-adapter-token':AT}});
/* 1. 合言葉 */
let r=await post('/api/fb/claim',{});ok(r[0]===200,'アダプターの合言葉で借りられる',r);
r=await call('/api/fb/claim',{method:'POST',body:{}});ok(r[0]===404,'合言葉なしでは何も返さない',r);
r=await call('/api/fb/claim',{method:'POST',body:{},hdr:{'x-fb-adapter-token':AT+'x'}});ok(r[0]===404,'合言葉がちがえば何も返さない',r);
r=await call('/api/fb/claim',{method:'POST',body:{},hdr:{'x-fb-adapter-token':HT}});ok(r[0]===404,'ブロッキング関数の合言葉ではアダプターの受け口を使えない',r);
for(const p of ['/api/fb/intent','/api/fb/ack','/api/fb/renew','/api/fb/observe']){r=await call(p,{method:'POST',body:{}});ok(r[0]===404,'合言葉なし '+p,r)}
r=await call('/api/fb/env');ok(r[0]===404,'環境の答えも合言葉が要る',r);
r=await call('/api/fb/env',{hdr:{'x-fb-adapter-token':AT}});ok(r[0]===200&&r[1].env==='test-env'&&r[1].project===PID&&Object.keys(r[1]).sort().join()==='env,project','環境の答えは環境の名前とプロジェクトだけ',r);
{const E0={...env,FB_ADAPTER_TOKEN:'short'};const rr=await w.fetch(new Request('https://x.dev/api/fb/claim',{method:'POST',headers:{'x-fb-adapter-token':'short'},body:'{}'}),E0,{waitUntil(){}});ok(rr.status===404,'短い合言葉は設定していないのと同じ',rr.status)}
/* 2. 環境（承認された環境だけ・外を変える前に確かめる） */
{const fs=await import('node:fs');const MAP=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/firebase-env.json'),'utf8'));
  for(const nm of ['production','staging']){let th=null;try{pickEnv(MAP,nm)}catch(e){th=e.message}ok(th==='env-not-approved','はじめはどの環境も承認されていない＝動かない：'+nm,th)}
  ok(JSON.stringify(MAP)===fs.readFileSync(path.join(ROOT,'tools/firebase-blocking/firebase-env.json'),'utf8').replace(/\s+/g,'')===false||JSON.stringify(MAP)===JSON.stringify(JSON.parse(fs.readFileSync(path.join(ROOT,'tools/firebase-blocking/firebase-env.json'),'utf8'))),'アダプターとブロッキング関数の対応表は同じ中身','');
  const M2=JSON.parse(JSON.stringify(MAP));M2.environments.staging={...M2.environments.staging,approved:true};let th=null;try{pickEnv(M2,'staging')}catch(e){th=e.message}ok(/^env-incomplete/.test(th),'決まっていない値（<…>）があれば動かない',th);
  M2.environments.staging={approved:true,project:'pokechan-hub',worker:'https://stg.example.workers.dev',workerEnvId:'stg',serviceAccount:'a@b'};th=null;try{pickEnv(M2,'staging')}catch(e){th=e.message}ok(th==='env-shares-production:project','テスト用の環境が本番と同じプロジェクトを使うなら動かない',th);
  /* http://127.0.0.1 はエミュレーターだけ（demo- のプロジェクト・allowLocal:true）。ほかのプロジェクトでは使えない（ブロッキング関数も同じ） */
  {const L1={environments:{e:{approved:true,allowLocal:true,project:'demo-x',worker:'http://127.0.0.1:1',workerEnvId:'e',serviceAccount:'a@b'}}};let a=null;try{a=pickEnv(L1,'e').worker}catch(e){a=e.message}
   const L2={environments:{e:{...L1.environments.e,project:'real-proj'}}};let b=null;try{pickEnv(L2,'e')}catch(e){b=e.message}
   const L3={environments:{e:{...L1.environments.e,allowLocal:false}}};let c=null;try{pickEnv(L3,'e')}catch(e){c=e.message}
   let d=null;try{d=envFor(L1,'e','demo-x').checkUrl}catch(e){d=e.message}let f=null;try{envFor(L2,'e','real-proj')}catch(e){f=e.message}
   ok(a==='http://127.0.0.1:1'&&b==='env-worker'&&c==='env-worker'&&d==='http://127.0.0.1:1/api/fb/check'&&f==='env-worker','127.0.0.1 は demo- のプロジェクトで allowLocal のときだけ（アダプター・ブロッキング関数とも）',{a,b,c,d,f})}
  M2.environments.staging={approved:true,project:'stg-proj',worker:'https://pokechan-tap.pokechan.workers.dev',workerEnvId:'stg',serviceAccount:'a@b'};th=null;try{pickEnv(M2,'staging')}catch(e){th=e.message}ok(th==='env-shares-production:worker','テスト用の環境が本番の Worker につなぐなら動かない',th);
  M2.environments.staging={approved:true,project:'stg-proj',worker:'http://stg.example',workerEnvId:'stg',serviceAccount:'a@b'};th=null;try{pickEnv(M2,'staging')}catch(e){th=e.message}ok(th==='env-worker','https でない Worker には送らない',th);
  th=null;try{pickEnv(M2,'other')}catch(e){th=e.message}ok(th==='env-unknown','対応表にない環境は動かない',th)}
const FB0=JSON.stringify(FB.users),C0=FB.calls.length;
let th=null;try{await run({sdk:{projectId:'other-proj',serviceAccount:TENV.serviceAccount}})}catch(e){th=e.message}ok(th==='project-mismatch','SDK のプロジェクトが環境と違えば止める',th);
th=null;try{await run({sdk:{projectId:'pokechan-test',serviceAccount:'other@x'}})}catch(e){th=e.message}ok(th==='service-account-mismatch','サービスアカウントが環境と違えば止める',th);
th=null;try{await run({env:{...TENV,workerEnvId:'prod'}})}catch(e){th=e.message}ok(th==='worker-env-mismatch','つないだ Worker の環境が違えば止める（本番とテストを取りちがえない）',th);
th=null;try{await run({env:{...TENV,project:'other-proj'},sdk:{projectId:'other-proj',serviceAccount:TENV.serviceAccount}})}catch(e){th=e.message}ok(th==='worker-env-mismatch','Worker のプロジェクトが違っても止める',th);
ok(JSON.stringify(FB.users)===FB0&&FB.calls.length===C0,'食い違いのときは Firebase に一度もさわらない',FB.calls.slice(C0));
{const seen=[];await run({fetchImpl:async(u,o)=>{seen.push(o);return fetchImpl(u,o)}});ok(seen.length&&seen.every(o=>o.redirect==='error'&&o.signal instanceof AbortSignal),'Worker への通信は転送に従わず、時間を区切る',seen.map(o=>o.redirect))}
th=null;try{await run({timeoutMs:50,fetchImpl:(u,o)=>new Promise((_,rej)=>o.signal.addEventListener('abort',()=>rej(new Error('aborted'))))})}catch(e){th=e.message}ok(th==='aborted','Worker が答えないときは時間で止める',th);
/* 3. 止める・ログインの印を取り消す・確かめる（1つずつ借りる） */
const A=await perp('fbA','fbaaa');
let s=await run();ok(s.done===1&&FB.users.fbA.disabled===true&&FB.calls.some(c=>c[0]==='revoke'&&c[1]==='fbA'),'確かめた停止で Firebase の UID を止め、ログインの印を取り消す',{s,calls:FB.calls.slice(-5)});
let R=await row('fbA');ok(R.owned===1&&R.prior===0&&R.done_gen===R.gen&&R.last_want==='disabled'&&R.obs_disabled===1&&R.pend_since===null,'止める前の状態・持ち主・見た状態を記録し、待ちを終える',R);
s=await run();ok(s.done===0&&s.failed===0&&s.noop===0,'終わったものはもう一度しない',s);
tick();r=await call('/api/notes',{method:'POST',tok:A.t,body:{body:'x'}});ok(r[0]===403,'前に出た ID トークンのままでも、サイトの門が止める',r);
/* 4. 取り消すと戻す（この仕組みが止めたので） */
await rev(A.id);
s=await run();ok(s.done===1&&FB.users.fbA.disabled===false,'取り消すと Firebase も戻す',{s,u:FB.users.fbA});
R=await row('fbA');ok(R.owned===0&&R.prior===null,'戻したら持ち主の記録を消す',R);
/* 5. 前からほかの理由で止まっていたアカウントは、取り消しても戻さない */
const B=await perp('fbB','fbbbb');FB.users.fbB.disabled=true;FB.calls.length=0;
s=await run();ok(s.done===1&&!FB.calls.some(c=>c[0]==='update'&&c[1]==='fbB')&&FB.calls.some(c=>c[0]==='revoke'&&c[1]==='fbB'),'前から止まっていれば変えない（ログインの印は取り消す）',FB.calls);
R=await row('fbB');ok(R.owned===0&&R.prior===1,'前から止まっていたと記録（この仕組みのものにしない）',R);
await rev(B.id);FB.calls.length=0;
s=await run();ok(FB.users.fbB.disabled===true&&!FB.calls.some(c=>c[0]==='update'),'ほかの理由で止まっていたアカウントは戻さない',{s,calls:FB.calls});
/* 5b. 最初は止まっていた → 外で戻された → この仕組みがもう一度止める：持ち主がはっきりしないので review（自動では戻さない） */
FB.users.fbB.disabled=false;const B2=await perp('fbB','fbbbb');
s=await run();R=await row('fbB');ok(FB.users.fbB.disabled===true&&R.owned===1&&R.review===1&&R.review_why==='prior_disabled_then_enabled','最初は止まっていたのに外で戻されていた：止めるが、持ち主の見直しが要る印',R);
await rev(B2.id);s=await run();R=await row('fbB');ok(FB.users.fbB.disabled===true&&R.last_want==='review','見直しが要るあいだは自動で戻さない',{s,R});
r=await call('/api/admin/sanctions',{...ADM});ok(r[1].fb_sync.review===1&&r[1].fb_sync.alert===true&&r[1].fb_dead.some(x=>x.handle==='fbbbb'&&x.review===1),'管理画面に見直し待ちとして出す',r[1].fb_sync);
r=await call('/api/admin/fb/review',{method:'POST',...ADM,body:{handle:'fbbbb',decision:'enable',reason:'短い',confirm:true}});ok(r[0]===400,'見直しの理由は20文字以上',r);
r=await call('/api/admin/fb/review',{method:'POST',body:{handle:'fbbbb',decision:'enable',reason:'外で戻されたあとはこの仕組みが止めたと確かめた',confirm:true}});ok(r[0]===401||r[0]===403,'見直しは運営者だけ',r);
r=await call('/api/admin/fb/review',{method:'POST',...ADM,body:{handle:'fbbbb',decision:'enable',reason:'外で戻されたあとはこの仕組みが止めたと確かめた',confirm:true}});ok(r[0]===200,'運営者が「戻してよい」と決める',r);
s=await run();ok(FB.users.fbB.disabled===false,'決めたあとで戻す',{s,R:await row('fbB')});
/* 6. 止めたあと、印の取り消しが失敗：やり直しで「前から止まっていた」と誤って記録しない（持ち主を失わない） */
const P=await perp('fbP','fbppp');FB.rfail.add('fbP');
s=await run();ok(s.failed===1&&FB.users.fbP.disabled===true,'止めたが印の取り消しに失敗＝失敗として数える',s);
R=await row('fbP');ok(R.owned===1&&R.prior===0&&R.done_gen<R.gen&&R.attempts===1&&R.next_at>clock,'最初の状態（止まっていなかった）と持ち主の記録は残る・待ってからやり直す',R);
s=await run();ok(s.done===0&&s.failed===0,'待ち時間のあいだはやり直さない',s);
FB.rfail.delete('fbP');tick(31e3);s=await run();ok(s.done===1,'待ち時間のあとでやり直す',s);
R=await row('fbP');ok(R.owned===1&&R.prior===0,'やり直しで止まった姿を見ても、最初の状態は変えない',R);
const Pid=(await env.DB.prepare(`SELECT id FROM sanctions WHERE uid='fbP' AND kind='uid'`).first()).id;
await rev(Pid);s=await run();ok(FB.users.fbP.disabled===false,'持ち主の記録が残っているので、取り消すと戻せる',{s,u:FB.users.fbP});
/* 7. 返事が届かない（止めたあと ack を送れずに落ちた） */
{const Q2=await perp('fbQ2','fbqq2');
  const drop=async(u,o)=>{if(String(u).endsWith('/api/fb/ack'))throw new Error('lost');return fetchImpl(u,o)};
  s=await run({fetchImpl:drop});R=await row('fbQ2');ok(FB.users.fbQ2.disabled===true&&R.done_gen<R.gen&&R.owned===1&&R.prior===0,'返事を送れずに落ちた：持ち主と最初の状態は止める前に記録してある',R);
  s=await run();ok(s.done===0,'借りている時間のあいだは、ほかのアダプターは拾わない',s);
  /* R7：報告が届かないまま借りる時間が切れた操作は crash（遅れて外で終わるかもしれない）。片づくまで、そのアカウントを新しく変えない */
  tick(61e3);{const u0=FB.calls.filter(c=>c[0]==='update'&&c[1]==='fbQ2').length;s=await run();R=await row('fbQ2');
    const o=(await env.DB.prepare(`SELECT kind,resolved_at FROM fb_ops WHERE uid='fbQ2'`).all()).results;
    ok(s.done===0&&R.done_gen<R.gen&&o.length===1&&o[0].kind==='crash'&&o[0].resolved_at===null&&FB.calls.filter(c=>c[0]==='update'&&c[1]==='fbQ2').length===u0,'R7 報告が届かないまま借りる時間が切れた：crash として残し、そのアカウントを新しく変えない',{s,R,o})}
  r=await call('/api/admin/fb/replay',{method:'POST',...ADM,body:{handle:'fbqq2',reason:'Firebase の画面で今の状態を確かめた',confirm:true}});
  s=await run();R=await row('fbQ2');ok(r[0]===200&&s.done>=1&&R.done_gen===R.gen&&R.owned===1&&R.prior===0,'運営者が確かめてやり直すと、同じ記録（持ち主）のまま終える',{s,R})}
{const Q=await perp('fbQ','fbqqq');let first=true;
  const lost=async(u,o)=>{const rr=await fetchImpl(u,o);if(String(u).endsWith('/api/fb/ack')&&first){first=false;throw new Error('lost')}return rr};
  s=await run({fetchImpl:lost});R=await row('fbQ');ok(FB.users.fbQ.disabled===true&&R.done_gen===R.gen&&s.lost===1,'届いたのに返事が来なかった報告をもう一度送っても1回分（返事が届かなかった数として数える）',{s,R})}
/* 8. アダプターが2つ同時：同じ人を同時に扱わない・古い印・期限切れの報告は「終えた」にしない（見た状態は残す） */
const M=await perp('fbM','fbmmm');
{const c1=await post('/api/fb/claim',{}),c2=await post('/api/fb/claim',{});
  const it=c1[1].items[0];ok(it&&it.uid==='fbM'&&!(c2[1].items||[]).some(x=>x.uid==='fbM'),'1回に1つだけ借り、同じ人はほかのアダプターに渡さない',{c1:c1[1],c2:c2[1]});
  r=await post('/api/fb/ack',{uid:'fbM',lease:'0'.repeat(32),gen:it.gen,result:'done',want:'none'});ok(r[0]===409&&r[1].stale,'借りていない印の報告は断る',r);
  r=await post('/api/fb/ack',{uid:'fbM',lease:it.lease,gen:it.gen,result:'done',want:'disabled',observed_disabled:true,revoked:true});ok(r[0]===400,'止める前の記録（intent）なしの「止めた」は受けない',r);
  r=await post('/api/fb/intent',{uid:'fbM',lease:it.lease,gen:it.gen+5,action:'disable',observed_disabled:false});ok(r[0]===409,'番号の合わない記録は断る',r);
  const c3=await post('/api/fb/claim',{});const it3=c3[1].items[0];
  if(it3&&it3.uid==='fbM'){r=await post('/api/fb/intent',{uid:'fbM',lease:it3.lease,gen:it3.gen,action:'disable',observed_disabled:false});
    r=await post('/api/admin/fb/replay',{});
    r=await call('/api/admin/fb/replay',{method:'POST',...ADM,body:{handle:'fbmmm',reason:'Firebase の障害が直ったので',confirm:true}});ok(r[0]===409&&r[1].busy,'アダプターが借りているあいだは、運営者のやり直しで借りている印を消さない',r);
    tick(61e3);
    r=await post('/api/fb/ack',{uid:'fbM',lease:it3.lease,gen:it3.gen,result:'done',want:'disabled',observed_disabled:true,revoked:true});
    R=await row('fbM');ok(r[0]===409&&r[1].recorded===true&&R.done_gen<R.gen&&R.obs_disabled===1&&R.owned===1&&R.next_at===0,'借りる時間が切れた同じ番号の報告は「終えた」にしない（見た状態は残し、持ち主は消さず、すぐ確かめ直す）',{r,R})}
  else ok(false,'3回目に借りられる',c3)}
s=await run();ok(FB.users.fbM.disabled===true&&(await row('fbM')).done_gen===(await row('fbM')).gen,'時間が過ぎたら、ほかのアダプターが拾って終える',s);
/* 9. 止めた直後（返事の前）に取り消された：番号が進んでいるので次の回で戻す（見た状態は止まっている・持ち主はこの仕組み） */
const X=await perp('fbX','fbxxx');
FB.afterUpdate=async uid=>{if(uid==='fbX'){FB.afterUpdate=null;await rev(X.id)}};
s=await run();R=await row('fbX');
ok(s.superseded===1&&s.failed===0&&FB.users.fbX.disabled===false&&R.done_gen===R.gen&&R.owned===0&&R.attempts===0,'取り消しと重なって一度止まっても、失敗に数えず、同じ回のうちにすぐ確かめ直して戻す（D1 と Firebase は1つの取引にできない）',{s,R,u:FB.users.fbX});
ok((await env.DB.prepare(`SELECT n FROM fb_metrics WHERE k='superseded'`).first()).n>=1,'途中で変わった回を数える','');
/* 10. 取り消しのあと、古い番号のまま止めようとする：記録の段階で断る（止めない） */
const Y=await perp('fbY','fbyyy');
{const c=await post('/api/fb/claim',{});const it=c[1].items[0];ok(it&&it.uid==='fbY','fbY を借りる',c);await rev(Y.id);
  r=await post('/api/fb/intent',{uid:'fbY',lease:it.lease,gen:it.gen,action:'disable',observed_disabled:false});ok(r[0]===409,'取り消したあとの古い「止める」は断る',r)}
s=await run();ok(FB.users.fbY.disabled===false&&s.failed===0,'止めていないので、そのまま',{s,u:FB.users.fbY});
/* 11. 戻す直前に新しい停止：戻さない */
const Z=await perp('fbZ','fbzzz');await run();await rev(Z.id);
{const c=await post('/api/fb/claim',{});const it=c[1].items[0];ok(it&&it.uid==='fbZ'&&it.want==='enabled','戻す予定',it);
  await perp('fbZ','fbzzz');
  r=await post('/api/fb/intent',{uid:'fbZ',lease:it.lease,gen:it.gen,action:'enable',observed_disabled:true});ok(r[0]===409,'戻す直前に停止があれば戻さない（同じ番号でも、文の中で確かめる）',r)}
s=await run();ok(FB.users.fbZ.disabled===true,'新しい停止のまま',{s,u:FB.users.fbZ});
/* 12. 重なった2つの停止：片方を取り消しても戻さない */
const O1=await perp('fbO','fbooo',{extra:true});await run();
const O2=await perp('fbO','fbooo',{kind:'temporary',useExtra:true});await run();
await rev(O1.id);s=await run();ok(FB.users.fbO.disabled===true,'もう1つの停止があれば戻さない',{s,R:await row('fbO')});
/* 13. 期限つきの停止の期限 → 戻す */
const T=await perp('fbT','fbttt',{kind:'temporary',months:3});await run();ok(FB.users.fbT.disabled===true,'期限つきの停止でも止める','');
tick(95*864e5);await w.scheduled({cron:'0 * * * *'},env,{waitUntil:p=>p});await new Promise(r=>setTimeout(r,50));
s=await run({max:30});ok(FB.users.fbT.disabled===false,'期限が来たら戻す',{s,R:await row('fbT')});
/* 14. 手動の停止（banned=1）があれば戻さない・手動の停止を外すと戻す */
const C=await perp('fbC','fbccc');await run();
await call('/api/admin/ban',{method:'POST',...ADM,body:{handle:'fbccc'}});
await rev(C.id);s=await run();ok(FB.users.fbC.disabled===true&&(await row('fbC')).last_want==='hold','ほかの有効な制限（手動の停止）があれば戻さない',{s,R:await row('fbC')});
await call('/api/admin/ban',{method:'POST',...ADM,body:{handle:'fbccc',on:false}});
s=await run();ok(FB.users.fbC.disabled===false,'手動の停止を外したら、この仕組みが止めた分を戻す（戻さなかったことで、あとの同期が止まったままにならない）',{s,R:await row('fbC')});
/* 15. 失敗が10回 → 止めて知らせる・運営者がやり直す */
const D=await perp('fbD','fbddd');FB.fail.add('fbD');
for(let i=0;i<10;i++){await run({max:30});tick(7*3600e3)}
R=await row('fbD');ok(R.dead===1&&R.attempts===10&&FB.users.fbD.disabled===false,'10回失敗したら止める',R);
s=await run({max:30});ok(s.failed===0,'止めたものは自動ではやり直さない',s);
r=await call('/api/admin/sanctions',{...ADM});ok(r[1].fb_sync.dead===1&&r[1].fb_sync.alert===true&&r[1].fb_dead.some(x=>x.handle==='fbddd'),'管理画面に知らせる',r[1].fb_sync);
ok(r[1].fb_sync.oldest_pending_since===R.pend_since||r[1].fb_sync.oldest_pending_since<=R.pend_since,'いちばん古い待ちは、待ちが始まった時刻で（借りた時刻で新しくならない）',{h:r[1].fb_sync,p:R.pend_since});
{const ks=new Set((await env.DB.prepare(`SELECT DISTINCT k FROM fb_metrics`).all()).results.map(x=>x.k));
  ok(r[1].fb_sync.adapter_heartbeat_at>0&&r[1].fb_sync.last_success_at>0&&r[1].fb_sync.adapter_heartbeat_at>r[1].fb_sync.last_success_at&&Array.isArray(r[1].fb_sync.metrics_7d)&&['done','failed','stale','lost','superseded'].every(k=>ks.has(k)),'動いた印（失敗だけの回でも進む）と成功を分け、終えた・失敗・古い報告・返事が届かなかった・途中で変わった数を日ごとに数える',{h:r[1].fb_sync,ks:[...ks]})}
r=await call('/api/admin/fb/replay',{method:'POST',...ADM,body:{handle:'fbddd',reason:'Firebase の障害が直ったので',confirm:true}});ok(r[0]===200,'運営者がやり直す',r);
r=await call('/api/admin/fb/replay',{method:'POST',body:{handle:'fbddd',reason:'x',confirm:true}});ok(r[0]===401||r[0]===403,'やり直しは運営者だけ',r);
FB.fail.delete('fbD');s=await run({max:30});ok(s.done>=1&&FB.users.fbD.disabled===true,'やり直して止める',s);
/* 16. Firebase の返事がない・時間切れのあとで本当に終わる（結果が分からない） */
const H=await perp('fbH','fbhhh');FB.late.set('fbH',600);
s=await run({max:30});R=await row('fbH');
ok(s.unknown===1&&R.owned===1&&R.prior===0,'時間切れ＝結果が分からないとして数える（持ち主の記録は外を変える前のまま）',{s,R});
ok(FB.calls.some(c=>c[0]==='late-done'&&c[1]==='fbH')&&FB.users.fbH.disabled===true&&R.obs_disabled===1&&s.observed===1&&R.unknown===0&&R.done_gen<R.gen,'遅れて本当に終わった呼び出しを待ってから読み直し、見た状態を残し、確かめ直しにする（終えたことにはしない）',{s,R,calls:FB.calls.filter(c=>c[1]==='fbH')});
ok(FB.calls.filter(c=>c[0]==='update'&&c[1]==='fbH').length===1,'同じ回の中で、結果が分からないアカウントにもう一度さわらない','');
ok((await env.DB.prepare(`SELECT n FROM fb_metrics WHERE k='unknown'`).first()).n>=1,'結果が分からなかった回を数える','');
FB.late.delete('fbH');tick(31e3);s=await run({max:30});R=await row('fbH');ok(R.unknown===0&&R.done_gen===R.gen&&FB.users.fbH.disabled===true,'次の回で確かめて終える',{s,R});
/* 16a. 待っても終わらない（落ちた・止まった）：結果が分からないまま残し、管理画面に知らせる */
const H2=await perp('fbH2','fbhh2');FB.hang.add('fbH2');
s=await run({max:30,settleMs:200});R=await row('fbH2');{const o=(await env.DB.prepare(`SELECT kind,intent,resolved_at FROM fb_ops WHERE uid='fbH2'`).all()).results;ok(R.unknown===1&&o.length===1&&o[0].kind==='timeout'&&o[0].intent==='disable'&&o[0].resolved_at===null,'待っても終わらない呼び出しは、結果が分からないまま残す（止める操作の記録）',{R,o})}
r=await call('/api/admin/sanctions',{...ADM});ok(r[1].fb_sync.unknown>=1&&r[1].fb_sync.alert===true,'結果が分からないものを管理画面に知らせる',r[1].fb_sync);
FB.hang.delete('fbH2');tick(31e3);{const u0=FB.calls.filter(c=>c[0]==='update'&&c[1]==='fbH2').length;s=await run({max:30});
  ok(FB.users.fbH2.disabled===false&&FB.calls.filter(c=>c[0]==='update'&&c[1]==='fbH2').length===u0&&(await row('fbH2')).unknown===1,'結果が分からない操作が残っているあいだは、そのアカウントを新しく変えない（運営者が確かめるまで残る）',await row('fbH2'))}
r=await call('/api/admin/fb/replay',{method:'POST',...ADM,body:{handle:'fbhh2',reason:'Firebase の画面で今の状態を確かめた',confirm:true}});
ok(r[0]===200&&(await env.DB.prepare(`SELECT how FROM fb_ops WHERE uid='fbH2'`).all()).results.every(x=>x.how==='replay'),'運営者のやり直しで、結果が分からない操作を片づける（記録は残す）',r);
s=await run({max:30});ok(FB.users.fbH2.disabled===true&&(await row('fbH2')).unknown===0,'やり直しのあと、次の回で止める',await row('fbH2'));
r=await call('/api/admin/fb/replay',{method:'POST',...ADM,body:{handle:'fbhh2',reason:'Firebase の画面で止まっていると確かめた',confirm:true}});ok(r[0]===200&&(await row('fbH2')).unknown===0,'運営者が確かめてやり直すと、印を外す',r);
/* 16b. 時間切れの「止める」が、借りる時間が切れて取り消され・別の回が戻したあとで本当に終わる（SDK の呼び出しは止められない） */
{const G=await perp('fbG','fbggg');FB.late.set('fbG',900);
  const p1=run({max:30,settleMs:3000});
  for(let i=0;i<100&&!FB.calls.some(c=>c[0]==='update'&&c[1]==='fbG');i++)await new Promise(r=>setTimeout(r,10));
  await new Promise(r=>setTimeout(r,400));
  R=await row('fbG');ok(R.unknown===1&&R.owned===1,'時間切れ＝結果が分からない（持ち主の記録は外を変える前のまま）',R);
  await rev(G.id);tick(61e3);FB.late.delete('fbG');
  const s2=await run({max:30});ok(FB.users.fbG.disabled===false,'取り消されたので、別の回が戻す（まだ遅れた「止める」は終わっていない）',{s2,u:FB.users.fbG});
  const s1=await p1;
  ok(FB.calls.some(c=>c[0]==='late-done'&&c[1]==='fbG')&&FB.users.fbG.disabled===true,'そのあとで遅れた「止める」が本当に終わり、止まってしまう（取り消せない呼び出し）',{s1,u:FB.users.fbG});
  R=await row('fbG');ok(R.obs_disabled===1&&R.next_at===0,'最初の回は、遅れた呼び出しを待ってから読み直し、止まっていると記録して、すぐ確かめ直しにする',R);
  tick(31e3);const s3=await run({max:30});ok(FB.users.fbG.disabled===false&&(await row('fbG')).owned===0,'次の回で、取り消されたあるべき状態に戻す',{s3,R:await row('fbG')})}
/* 17. 1回の時間が借りる時間（60秒）より長くかかっても、1つずつ借りるので、あとのアカウントは期限切れにならない */
{const U=[];for(let i=0;i<4;i++){const id='fbL'+i;await perp(id,'fbll'+i);U.push(id)}
  FB.slow=25e3;s=await run({max:30});FB.slow=0;
  ok(U.every(id=>FB.users[id].disabled===true)&&s.stale===0,'全体で数分かかっても、1つずつ直前に借りてのばすので、どれも期限切れにならず終える',{s,rows:await Promise.all(U.map(row))})}
/* 18a. Firebase にないアカウント・1日ごとの確かめ直し（外で戻されていたら止め直す） */
const E=await perp('fbE','fbeee');delete FB.users.fbE;s=await run({max:30});ok((await row('fbE')).last_want==='missing','Firebase にないアカウントは飛ばす',await row('fbE'));
const A2=await perp('fbA2','fba22');await run({max:30});FB.users.fbA2.disabled=false;
tick(3600e3);s=await run({max:30});ok(FB.users.fbA2.disabled===false,'1日たつまでは確かめ直さない','');
tick(864e5);s=await run({max:60});ok(FB.users.fbA2.disabled===true,'1日ごとに確かめ直し、外で戻されていたら止め直す',s);
/* 18b. ブロッキング関数の受け口（答えは deny だけ・メールは確認済みのときだけ） */
const chk=b=>call('/api/fb/check',{method:'POST',body:b,hdr:{'x-fb-hook-token':HT}});
r=await call('/api/fb/check',{method:'POST',body:{uid:'fbD'}});ok(r[0]===404,'ブロッキング関数の受け口は合言葉が要る',r);
r=await call('/api/fb/check',{method:'POST',body:{uid:'fbD'},hdr:{'x-fb-hook-token':AT}});ok(r[0]===404,'アダプターの合言葉では使えない',r);
r=await chk({uid:'fbD'});ok(r[0]===200&&r[1].deny===true&&Object.keys(r[1]).sort().join()==='deny,env'&&r[1].env==='test-env','停止中の UID は deny と環境の名前だけ（理由・中身は返さない）',r);
r=await chk({uid:'new-uid',email:'fbD@mail.test-gk.net',email_verified:true});ok(r[1].deny===true,'停止中の確認済みメールの新しい UID は deny',r);
r=await chk({uid:'new-uid',email:'fbD@mail.test-gk.net',email_verified:false});ok(r[1].deny===false,'確認されていないメールは本人の証拠にしない',r);
r=await chk({uid:'someone',email:'other@mail.test-gk.net',email_verified:true});ok(r[1].deny===false,'関係のない人は止めない',r);
/* 19. 判断（decide.js） */
const yes=async()=>({deny:true}),no=async()=>({deny:false}),boom=async()=>{throw new Error('x')},weird=async()=>({});
const nb=()=>makeBreaker();
let d=await decide({user:{uid:'u',email:'a@b.jp',emailVerified:true},check:yes,breaker:nb()});ok(d.block&&d.message===NEUTRAL&&!/停止|sanction|メール/.test(d.message),'止めるときの文は理由を言わない',d);
d=await decide({user:{uid:'u'},check:no,breaker:nb()});ok(!d.block,'止めない',d);
d=await decide({user:{uid:'u'},check:boom,breaker:nb()});ok(d.block,'届かないときは（はじめは）止める',d);
d=await decide({user:{uid:'u'},check:boom,onError:'allow',breaker:nb()});ok(!d.block,'設定で、届かないときは通すこともできる（サイトの門はそのまま）',d);
{let aborted=false;const slow=(q,sig)=>new Promise((_,rej)=>sig.addEventListener('abort',()=>{aborted=true;rej(new Error('ab'))}));
  const t0=Date.now();d=await decide({user:{uid:'u'},check:slow,timeoutMs:50,breaker:nb()});ok(d.block&&d.why==='error-deny'&&aborted,'時間を区切り、通信も止める（AbortSignal を渡す）',{d,aborted})}
{const h=process.getActiveResourcesInfo().filter(x=>x==='Timeout').length;await decide({user:{uid:'u'},check:no,timeoutMs:60000,breaker:nb()});
  ok(process.getActiveResourcesInfo().filter(x=>x==='Timeout').length===h,'答えが来たらタイマーを片づける',process.getActiveResourcesInfo())}
d=await decide({user:{uid:'u'},check:weird,breaker:nb()});ok(d.block,'形のおかしい答えは止める',d);
{let seen;await decide({user:{uid:'u',email:'a@b.jp',emailVerified:false,displayName:'x',phoneNumber:'+81'},check:async q=>{seen=q;return{deny:false}},breaker:nb()});
  ok(JSON.stringify(Object.keys(seen))==='["uid","email","email_verified"]'&&seen.email===null&&seen.email_verified===false,'確認されていないメールは送らない（送るのは UID・確認済みのメール・確認済みかだけ）',seen);
  await decide({user:{uid:'u',email:'a@b.jp',emailVerified:true},check:async q=>{seen=q;return{deny:false}},breaker:nb()});ok(seen.email==='a@b.jp'&&seen.email_verified===true,'確認済みのメールは送る',seen)}
{let t=0;const br=makeBreaker({fails:5,coolMs:1000,now:()=>t});let calls=0;const bad=async()=>{calls++;throw new Error('x')};
  for(let i=0;i<5;i++)await decide({user:{uid:'u'},check:bad,breaker:br});
  d=await decide({user:{uid:'u'},check:async()=>{calls++;return{deny:false}},breaker:br});ok(calls===5&&d.block&&d.why==='breaker-deny','5回続けて届かなければ、しばらく聞かずに決まった答え（止める）',{calls,d});
  t=1001;d=await decide({user:{uid:'u'},check:async()=>{calls++;return{deny:false}},breaker:br});ok(calls===6&&!d.block,'時間が過ぎたらまた聞く',{calls,d})}
{const src=(await import('node:fs')).readFileSync(path.join(ROOT,'tools/firebase-blocking/index.js'),'utf8');
  ok(/envFor\(MAP,ENV_NAME\.value\(\),process\.env\.GCLOUD_PROJECT/.test(src)&&/redirect:'error'/.test(src)&&/signal\}/.test(src)&&!/console\.\w+\(/.test(src)&&/j\.env!==e\.workerEnvId/.test(src)&&!/https:\/\/pokechan-tap/.test(src),'ブロッキング関数の送り先は承認された環境の対応表から・転送に従わない・止められる・記録しない・答えの環境を確かめる（本番のアドレスを書きこまない）','');
  const fs=await import('node:fs');const MAP=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/firebase-blocking/firebase-env.json'),'utf8'));
  let t2=null;try{envFor(MAP,'production','pokechan-hub')}catch(e){t2=e.message}ok(t2==='env-not-approved','ブロッキング関数も、承認されていない環境には送らない',t2);
  const M3={environments:{production:MAP.environments.production,staging:{approved:true,project:'stg-proj',worker:'https://stg.example.workers.dev',workerEnvId:'stg'}}};
  t2=null;try{envFor(M3,'staging','pokechan-hub')}catch(e){t2=e.message}ok(t2==='project-mismatch','動いているプロジェクトが対応表と違えば送らない（テストの関数から本番へ送らない）',t2);
  const e3=envFor(M3,'staging','stg-proj');ok(e3.checkUrl==='https://stg.example.workers.dev/api/fb/check'&&e3.workerEnvId==='stg','承認された環境なら、その Worker だけに送る',e3);}
/* R5. 報告の取りちがえ：番号が進んだあとの「終えた」・受け取られなかった報告・重なった「結果が分からない」 */
{FB.hang.clear();FB.late.clear();FB.fail.clear();FB.rfail.clear();
  await env.DB.prepare(`UPDATE fb_sync SET done_gen=gen,dead=0,unknown=0,review=0,lease=NULL,lease_until=0`).run();
  const met=async k=>((await env.DB.prepare(`SELECT COALESCE(SUM(n),0) AS n FROM fb_metrics WHERE k=?`).bind(k).first()).n);
  const okAt=async()=>((await env.DB.prepare(`SELECT last_at FROM job_runs WHERE name='fb_sync_ok'`).first())||{}).last_at;
  /* a 止める記録のあと、番号が進んだ（取り消された）：古い番号の「終えた」は superseded にする・成功の数と成功の時刻を進めない */
  const Q=await perp('fbQ5','fbqqq5');
  let c=await post('/api/fb/claim',{});let it=c[1].items[0];ok(it&&it.uid==='fbQ5','R5 その人を借りる',c);
  r=await post('/api/fb/intent',{uid:it.uid,lease:it.lease,gen:it.gen,action:'disable',observed_disabled:false});ok(r[0]===200,'R5 止める記録',r);
  FB.users.fbQ5.disabled=true;await rev(Q.id);
  const d0=await met('done'),s0=await met('superseded'),k0=await okAt();tick(1000);
  r=await post('/api/fb/ack',{uid:it.uid,lease:it.lease,gen:it.gen,result:'done',want:'disabled',observed_disabled:true,revoked:true});
  let R=await row('fbQ5');
  ok(r[0]===200&&r[1].superseded===true&&R.done_gen<R.gen&&R.obs_disabled===1&&R.lease===null&&(await met('done'))===d0&&(await met('superseded'))===s0+1&&(await okAt())===k0,
    'R5 番号が進んだあとの「終えた」は終えたことにしない（superseded・見た状態は残す・成功の数と時刻は進めない）',{r,R:{gen:R.gen,done_gen:R.done_gen},d:(await met('done'))-d0});
  /* 同じ報告をもう一度：古い報告（数えない） */
  r=await post('/api/fb/ack',{uid:it.uid,lease:it.lease,gen:it.gen,result:'done',want:'disabled',observed_disabled:true,revoked:true});ok(r[0]===409&&(await met('done'))===d0,'R5 同じ古い報告をもう一度送っても数えない',r);
  let s=await run();ok(s.done===1&&FB.users.fbQ5.disabled===false,'R5 次の回で今のあるべき状態（戻す）に合わせる',s);
  /* b 受け取られなかった報告（500）：終えたことに数えない・終わりの値 3 になるよう bad に数える */
  const B5=await perp('fbB5','fbbbb5');
  const f500=async(u,o)=>{if(String(u).endsWith('/api/fb/ack'))return new Response('{}',{status:500});return fetchImpl(u,o)};
  s=await run({fetchImpl:f500});R=await row('fbB5');
  ok(s.bad===1&&s.done===0&&R.done_gen<R.gen&&FB.users.fbB5.disabled===true,'R5 受け取られなかった報告は「終えた」に数えない（bad）',{s,R:{gen:R.gen,done_gen:R.done_gen}});
  tick(61e3);s=await run();ok(s.done===0&&(await env.DB.prepare(`SELECT kind FROM fb_ops WHERE uid='fbB5' AND resolved_at IS NULL`).first())?.kind==='crash','R7 報告が受け取られなかった操作は crash（新しく変えない）',s);
  r=await call('/api/admin/fb/replay',{method:'POST',...ADM,body:{handle:'fbbbb5',reason:'Firebase の画面で今の状態を確かめた',confirm:true}});s=await run();ok(s.done===1&&(await row('fbB5')).done_gen===(await row('fbB5')).gen,'R5 運営者が確かめてやり直したあと、次の回で終える',s);
  /* c 重なった「結果が分からない」：いま残っている回の印と違う observe は、見た状態だけを残す（片づけない・持ち主を推しはからない） */
  const U5=await perp('fbU5','fbuuu5');
  await env.DB.prepare(`UPDATE fb_sync SET unknown=1,unk_intent='disable',owned=0,prior=NULL WHERE uid='fbU5'`).run();
  await env.DB.prepare(`INSERT INTO fb_ops(op,uid,gen,intent,kind,at) VALUES('lease-two','fbU5',1,'disable','timeout',?)`).bind(clock).run();
  r=await post('/api/fb/observe',{uid:'fbU5',observed_disabled:true});ok(r[0]===400,'R5 observe には借りた印（op）が要る',r);
  r=await post('/api/fb/observe',{uid:'fbU5',op:'lease-one',observed_disabled:true});R=await row('fbU5');
  ok(r[0]===200&&r[1].recorded_only===true&&R.unknown===1&&R.owned===0&&R.obs_disabled===1,'R5 古い回の印の observe は見た状態だけ（片づけない・持ち主を推しはからない）',{r,R:{unknown:R.unknown,owned:R.owned}});
  const g0=R.gen;r=await post('/api/fb/observe',{uid:'fbU5',op:'lease-two',observed_disabled:true,settled:'ok'});R=await row('fbU5');
  ok(r[0]===200&&!r[1].recorded_only&&R.unknown===0&&R.owned===1&&R.gen===g0+1,'R5 いまの回の印の observe で片づける（止めたのはこの仕組み）',{r,R:{unknown:R.unknown,owned:R.owned}});
  /* d 時間切れの回は、その回の借りた印を unk_op に残す。アダプターは observe でその印を送る */
  const H5=await perp('fbH5','fbhhh5');FB.late.set('fbH5',500);
  s=await run();R=await row('fbH5');
  ok(s.unknown===1&&s.observed===1&&R.unknown===0&&R.owned===1,'R5 アダプターは時間切れの回の印で observe する（片づく）',{s,R:{unknown:R.unknown,unk_op:R.unk_op,owned:R.owned}});
  FB.late.clear();await run();
  /* e 割りこみ：借りる時間が切れて、ほかが借りた。前の人の「終えた」は数えない */
  const I5=await perp('fbI5','fbiii5');
  c=await post('/api/fb/claim',{});const ia=c[1].items[0];ok(ia&&ia.uid==='fbI5','R5 1人目が借りる',c);
  await post('/api/fb/intent',{uid:ia.uid,lease:ia.lease,gen:ia.gen,action:'disable',observed_disabled:false});
  tick(61e3);c=await post('/api/fb/claim',{});ok(!(c[1].items[0]&&c[1].items[0].uid==='fbI5'),'R7 期限が切れても、1人目の止める操作が片づくまで2人目は借りない（外で遅れて終わるかもしれない）',c);
  const d1=await met('done');FB.users.fbI5.disabled=true;
  r=await post('/api/fb/ack',{uid:ia.uid,lease:ia.lease,gen:ia.gen,result:'done',want:'disabled',observed_disabled:true,revoked:true});
  const oI=await env.DB.prepare(`SELECT how,resolved_at FROM fb_ops WHERE op=?`).bind(ia.lease).first();
  ok(r[0]===409&&(await met('done'))===d1&&oI.how==='late_done'&&oI.resolved_at>0,'R7 1人目の遅れた報告：「終えた」には数えないが、外の呼び出しは終わったので操作は片づく',{r,oI});
  c=await post('/api/fb/claim',{});const ib=c[1].items[0];ok(ib&&ib.uid==='fbI5'&&ib.lease!==ia.lease,'R7 片づいたあとで2人目が借りる（新しい借りた印）',c);
  r=await post('/api/fb/ack',{uid:ib.uid,lease:ib.lease,gen:ib.gen,result:'superseded',want:'disabled'});
  tick(61e3);await run();}
/* R6. 結果が分からない操作を1つずつ：A・B の時間切れ、終わる順の入れかわり、やり直し、ほかの人が外で止めた、落ちた（crash）、同じ結果が2回 */
{FB.hang.clear();FB.late.clear();
  await env.DB.prepare(`UPDATE fb_sync SET done_gen=gen,dead=0,unknown=0,review=0,lease=NULL,lease_until=0`).run();await env.DB.prepare(`UPDATE fb_ops SET resolved_at=1,how='test' WHERE resolved_at IS NULL`).run();
  const claimOf=async uid=>{for(let i=0;i<20;i++){const c=await post('/api/fb/claim',{});const it=c[1].items[0];if(!it)return null;if(it.uid===uid)return it;await post('/api/fb/ack',{uid:it.uid,lease:it.lease,gen:it.gen,result:'superseded',want:'disabled'})}return null};
  const ops=uid=>env.DB.prepare(`SELECT op,kind,resolved_at,how FROM fb_ops WHERE uid=? ORDER BY at,op`).bind(uid).all().then(x=>x.results);
  /* a 時間切れ A のあと、そのアカウントは借りられない（新しく変えない）・2つ目の時間切れ B は起きない */
  const A6=await perp('fbA6','fbaaa6');FB.hang.add('fbA6');
  let s=await run({max:30,settleMs:100});let o=await ops('fbA6');
  ok(s.unknown===1&&o.length===1&&o[0].kind==='timeout'&&o[0].resolved_at===null,'R6 時間切れの操作を1つの記録として残す',{s,o});
  tick(31e3);FB.hang.delete('fbA6');const u0=FB.calls.filter(c=>c[0]==='update'&&c[1]==='fbA6').length;s=await run({max:30});
  ok(FB.calls.filter(c=>c[0]==='update'&&c[1]==='fbA6').length===u0&&(await ops('fbA6')).length===1,'R6 片づいていない時間切れがあるあいだは、2つ目の操作を始めない（B で A を上書きしない）',{s,o:await ops('fbA6')});
  /* b 2つの操作（A＝時間切れ、B＝落ちた回）。B の結果が先に届いても A は残る・A があるあいだは unknown のまま。逆の順も */
  for(const order of [['B','A'],['A','B']]){const u='fbO6'+order[0];await perp(u,'fbo6'+order[0].toLowerCase());
    await env.DB.prepare(`INSERT INTO fb_ops(op,uid,gen,intent,kind,at) VALUES(?1,?3,1,'disable','timeout',?4),(?2,?3,1,'disable','crash',?4)`).bind(u+'-A',u+'-B',u,clock).run();
    await env.DB.prepare(`UPDATE fb_sync SET unknown=1 WHERE uid=?`).bind(u).run();
    const r1=await post('/api/fb/observe',{uid:u,op:u+'-'+order[0],observed_disabled:false,settled:'error'});
    const R1=await row(u);
    ok(r1[0]===200&&!r1[1].recorded_only&&(order[0]==='B'?R1.unknown===1&&r1[1].still_unknown===true:R1.unknown===0),'R6 '+order.join('→')+'：先に届いた結果は、その操作だけを片づける（ほかの操作は残る）',{r1,unknown:R1.unknown});
    const r2=await post('/api/fb/observe',{uid:u,op:u+'-'+order[0],observed_disabled:true,settled:'ok'});
    ok(r2[0]===200&&r2[1].recorded_only===true&&(await row(u)).owned===R1.owned,'R6 同じ操作の結果が2回目に届いても、見た状態だけ（持ち主を変えない）',r2);
    await post('/api/fb/observe',{uid:u,op:u+'-'+order[1],observed_disabled:false,settled:'error'});
    const oo=await ops(u);ok(oo.every(x=>x.resolved_at&&x.how==='observe')&&(await row(u)).unknown===0,'R6 '+order.join('→')+'：両方の結果が届けば片づく',oo)}
  /* c ほかの人が外で止めた：止める操作が成功していないのに止まっている → 持ち主を推しはからず review */
  const X6=await perp('fbX6','fbxxx6');await env.DB.prepare(`UPDATE fb_sync SET owned=0,prior=NULL,unknown=1 WHERE uid='fbX6'`).run();
  await env.DB.prepare(`INSERT INTO fb_ops(op,uid,gen,intent,kind,at) VALUES('x6-op','fbX6',1,'disable','timeout',?)`).bind(clock).run();
  FB.users.fbX6.disabled=true;
  r=await post('/api/fb/observe',{uid:'fbX6',op:'x6-op',observed_disabled:true,settled:'error'});let R=await row('fbX6');
  ok(r[0]===200&&R.owned===0&&R.review===1&&R.review_why==='disabled_outside_unknown','R6 止める呼び出しが失敗したのに止まっている（外で止められた可能性）：この仕組みのものにせず運営者が決める',R);
  /* d 落ちた回（intent のあと報告がないまま借りる時間が切れた）：crash として残し、管理画面に出す。そのアカウントは次の回で読み直して合わせる */
  const C6=await perp('fbC6','fbccc6');let it=await claimOf('fbC6');
  r=await post('/api/fb/intent',{uid:'fbC6',lease:it.lease,gen:it.gen,action:'disable',observed_disabled:false});ok(r[0]===200,'R6 落ちる前に止める記録',r);
  FB.users.fbC6.disabled=true;tick(61e3);
  s=await run({max:30});o=await ops('fbC6');
  ok(o.length===1&&o[0].kind==='crash'&&o[0].op===it.lease&&o[0].resolved_at===null&&(await row('fbC6')).done_gen<(await row('fbC6')).gen&&!FB.calls.some(c=>c[0]!=='get'&&c[1]==='fbC6'),'R7 落ちた回（その借りた印の止める操作）は crash に残し、片づくまでそのアカウントを新しく変えない',{o,s});
  r=await call('/api/admin/sanctions',{...ADM});ok(r[1].fb_sync.alert===true&&r[1].fb_sync.open_ops.some(x=>x.uid==='fbC6'&&x.kind==='crash'),'R6 片づいていない操作を管理画面に出す（知らせる）',r[1].fb_sync.open_ops);
  r=await call('/api/admin/fb/replay',{method:'POST',...ADM,body:{handle:'fbccc6',reason:'Firebase の画面で今の状態を確かめた',confirm:true}});
  ok(r[0]===200&&(await ops('fbC6'))[0].how==='replay','R6 運営者のやり直しで片づける（記録は残す）',await ops('fbC6'));
  s=await run({max:30});ok((await row('fbC6')).done_gen===(await row('fbC6')).gen&&FB.users.fbC6.disabled===true,'R7 運営者が確かめてやり直したあと、次の回で読み直して合わせる',s);
  /* e やり直しのあとで、前の操作の結果が遅れて届いても、見た状態だけ */
  r=await post('/api/fb/observe',{uid:'fbC6',op:it.lease,observed_disabled:false,settled:'ok'});ok(r[0]===200&&r[1].recorded_only===true,'R6 やり直しのあとに届いた前の操作の結果は、見た状態だけ',r);
  tick(61e3);await run({max:30});}
/* R7. 外を変える呼び出しを送ったあとでアダプターが落ちた（報告なし）：遅れて外で終わるかもしれないので、運営者が確かめるまで新しく変えない */
{FB.hang.clear();FB.late.clear();
  await env.DB.prepare(`UPDATE fb_sync SET done_gen=gen,dead=0,unknown=0,review=0,lease=NULL,lease_until=0`).run();await env.DB.prepare(`UPDATE fb_ops SET resolved_at=1,how='test' WHERE resolved_at IS NULL`).run();
  const claimOf=async uid=>{for(let i=0;i<20;i++){const c=await post('/api/fb/claim',{});const it=c[1].items[0];if(!it)return null;if(it.uid===uid)return it;await post('/api/fb/ack',{uid:it.uid,lease:it.lease,gen:it.gen,result:'superseded',want:'disabled'})}return null};
  const opOf=lease=>env.DB.prepare(`SELECT kind,resolved_at,how,intent FROM fb_ops WHERE op=?`).bind(lease).first();
  const touch=uid=>FB.calls.filter(c=>c[0]!=='get'&&c[1]===uid).length;
  const RP=h=>call('/api/admin/fb/replay',{method:'POST',...ADM,body:{handle:h,reason:'Firebase の画面で今の状態を確かめた',confirm:true}});
  /* a 止める呼び出しを送って落ちた → 取り消し → 遅れて止まる。次の回は戻さない（戻したあとで遅れた「止める」が着くかもしれない） */
  const K7=await perp('fbK7','fbkkk7');let it=await claimOf('fbK7');
  r=await post('/api/fb/intent',{uid:'fbK7',lease:it.lease,gen:it.gen,action:'disable',observed_disabled:false});
  let o=await opOf(it.lease);ok(r[0]===200&&o&&o.kind==='pending'&&o.intent==='disable','R7 外を変える前の記録と同じ取引で、その借りた印の操作の記録（pending）を作る',{r,o});
  await rev(K7.id);tick(61e3);FB.users.fbK7.disabled=true;const t0=touch('fbK7');
  let s=await run({max:30});o=await opOf(it.lease);
  ok(touch('fbK7')===t0&&FB.users.fbK7.disabled===true&&o.kind==='crash'&&o.resolved_at===null,'R7 止める呼び出しのあとで落ちた：取り消されても、片づくまで戻さない（crash）',{o,s});
  r=await RP('fbkkk7');s=await run({max:30});ok(r[0]===200&&FB.users.fbK7.disabled===false&&(await row('fbK7')).owned===0,'R7 運営者が確かめてやり直すと戻す',{s,R:await row('fbK7')});
  /* b 戻す呼び出しを送って落ちた → もう一度停止 → 遅れて戻る。次の回は止めない（止めたあとで遅れた「戻す」が着くかもしれない）→ やり直しのあとで止める */
  const K8=await perp('fbK8','fbkkk8');s=await run({max:30});ok(FB.users.fbK8.disabled===true,'R7 止める（前提）',s);
  await rev(K8.id);it=await claimOf('fbK8');
  r=await post('/api/fb/intent',{uid:'fbK8',lease:it.lease,gen:it.gen,action:'enable',observed_disabled:true});ok(r[0]===200&&(await opOf(it.lease)).intent==='enable','R7 戻す前の記録と操作の記録',r);
  await perp('fbK8','fbkkk8');tick(61e3);FB.users.fbK8.disabled=false;const t1=touch('fbK8');
  s=await run({max:30});ok(touch('fbK8')===t1&&(await opOf(it.lease)).kind==='crash','R7 戻す呼び出しのあとで落ちた：新しい停止があっても、片づくまで変えない',s);
  r=await RP('fbkkk8');s=await run({max:30});ok(FB.users.fbK8.disabled===true,'R7 やり直しのあとで止める',s);
  /* c 借りる時間が切れたあとの「時間切れ」の報告：その操作は timeout のまま残る（片づけない） */
  const K9=await perp('fbK9','fbkkk9');it=await claimOf('fbK9');
  await post('/api/fb/intent',{uid:'fbK9',lease:it.lease,gen:it.gen,action:'disable',observed_disabled:false});tick(61e3);
  r=await post('/api/fb/ack',{uid:'fbK9',lease:it.lease,gen:it.gen,result:'failed',unknown:true,want:'disabled',error:'timeout:update'});
  o=await opOf(it.lease);ok(r[0]===409&&o.kind==='timeout'&&o.resolved_at===null,'R7 借りる時間のあとの時間切れの報告は timeout として残す',{r,o});
  /* d 読み直しの結果を片づける取引の途中で失敗：どちらも書かない（片方だけにならない）・そのあいだもアカウントは借りられない・やり直すと片づく */
  const real=env.DB;let inj=true;
  env.DB={prepare:q=>real.prepare(q),batch:async l=>{if(inj&&l.some(x=>x&&/how='observe'/.test(x.sql||''))){inj=false;return real.batch([l[0],real.prepare(`INSERT INTO no_such_table_r7 VALUES(1)`)])}return real.batch(l)}};
  const R0=await row('fbK9');
  r=await post('/api/fb/observe',{uid:'fbK9',op:it.lease,observed_disabled:true,settled:'ok'});
  env.DB=real;o=await opOf(it.lease);let R1=await row('fbK9');
  ok(r[0]>=500&&o.resolved_at===null&&o.kind==='timeout'&&R1.gen===R0.gen&&R1.owned===R0.owned,'R7 途中で失敗した読み直しは、操作も持ち主・番号も変えない（1つの取引）',{r,o,g:[R0.gen,R1.gen]});
  const c9=await post('/api/fb/claim',{});ok(!(c9[1].items[0]&&c9[1].items[0].uid==='fbK9'),'R7 そのあいだもアカウントは借りられない',c9);
  if(c9[1].items[0])await post('/api/fb/ack',{uid:c9[1].items[0].uid,lease:c9[1].items[0].lease,gen:c9[1].items[0].gen,result:'superseded',want:'disabled'});
  r=await post('/api/fb/observe',{uid:'fbK9',op:it.lease,observed_disabled:true,settled:'ok'});o=await opOf(it.lease);R1=await row('fbK9');
  ok(r[0]===200&&!r[1].recorded_only&&o.how==='observe'&&R1.gen===R0.gen+1&&R1.owned===1,'R7 やり直すと片づき、持ち主・番号も同じ取引で変わる',{r,o});
  r=await post('/api/fb/observe',{uid:'fbK9',op:it.lease,observed_disabled:true,settled:'ok'});ok(r[1].recorded_only===true&&(await row('fbK9')).gen===R1.gen,'R7 同じ読み直しをもう一度送っても2回変えない',r);
  tick(61e3);await run({max:30});}
{const fs=await import('node:fs');for(const dir of ['firebase-adapter','firebase-blocking']){const pk=JSON.parse(fs.readFileSync(path.join(ROOT,'tools',dir,'package.json'),'utf8')),lk=JSON.parse(fs.readFileSync(path.join(ROOT,'tools',dir,'package-lock.json'),'utf8'));
  const deps=Object.entries(pk.dependencies||{});ok(deps.length&&deps.every(([k,v])=>/^\d+\.\d+\.\d+$/.test(v)&&lk.packages['node_modules/'+k]&&lk.packages['node_modules/'+k].version===v&&lk.packages['node_modules/'+k].integrity),dir+'：版を固定し、ロックファイルに同じ版と中身の印がある',deps)}}
ok(OUT.every(u=>u.includes('securetoken@system')||u.startsWith('https://webrisk.googleapis.com/')),'本物の Firebase などには通信しない',OUT.filter(u=>!u.includes('securetoken')));
console.log(bad?`fb-adapter: NG（${bad}/${n}）`:`fb-adapter: OK（${n}項目）`);if(bad)process.exit(1);
