// Firebase 側の利用停止（docs/secure-link-posting-runbook.md §6）の確認。本物の Firebase には一切つながない（にせものの auth と、本物のサーバーのプログラム）。
// ・確かめた停止で UID を止め、ログインの印を取り消す（順番待ち fb_outbox → tools/firebase-adapter/adapter.mjs）
// ・戻すのは、この仕組みが止めた・前から止まっていなかった・ほかの有効な制限がないときだけ
// ・失敗は数えて次にやり直す・合言葉がちがえば何も返さない
// ・ブロッキング関数の判断（tools/firebase-blocking/decide.js）
import path from 'node:path';
import {createRequire} from 'node:module';
import {makeD1} from './d1mock.mjs';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const require=createRequire(import.meta.url);
const {runOnce}=await import(path.join(ROOT,'tools/firebase-adapter/adapter.mjs'));
const {decide,NEUTRAL}=require(path.join(ROOT,'tools/firebase-blocking/decide.js'));
const PID='pokechan-test';
const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const kp=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...(await crypto.subtle.exportKey('jwk',kp.publicKey)),kid:'k1',use:'sig',alg:'RS256'};
const T0=Math.floor(Date.now()/1000);
const tok=async(uid,email)=>{const h=enc({alg:'RS256',kid:'k1',typ:'JWT'}),p=enc({iss:'https://securetoken.google.com/'+PID,aud:PID,sub:uid,iat:T0-10,exp:T0+3600,auth_time:T0-10,email:email||uid+'@mail.test-gk.net',email_verified:true});
  return h+'.'+p+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',kp.privateKey,new TextEncoder().encode(h+'.'+p))).toString('base64url')};
globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
const OUT=[];globalThis.fetch=async u=>{u=String(u);OUT.push(u);if(u.includes('securetoken@system'))return new Response(JSON.stringify({keys:[jwk]}));if(u.startsWith('https://webrisk.googleapis.com/'))return new Response('{}');return new Response('',{status:404})};
const w=(await import(path.join(ROOT,'worker/dist/worker.js'))).default;
const AT='adapter-token-test-0123456789abcdef-xyz',HT='hook-token-test-0123456789abcdef-xyz-q';
const env={DB:makeD1(),FIREBASE_PROJECT_ID:PID,APP_TOKEN:'t',ADMIN_TOKEN:'admin-secret-123',SANCTIONS_ON:'1',LINKS_POST:'1',LINKS_CLICK:'1',EMAIL_HMAC_KEY:'email-hmac-key-test-0123456789abcdef-fb',WEBRISK_API_KEY:'wr',FB_ADAPTER_TOKEN:AT,FB_HOOK_TOKEN:HT};
let clock=Date.now();Date.now=()=>clock;const tick=(ms=16e3)=>{clock+=ms};
const call=async(p,{method='GET',tok,body,admin,hdr={}}={})=>{const h={'content-type':'application/json','cf-connecting-ip':'10.5.0.1',...hdr};if(tok)h.authorization='Bearer '+tok;if(admin)h['x-admin-token']=admin;
  const r=await w.fetch(new Request('https://x.dev'+p,{method,headers:h,body:body?JSON.stringify(body):undefined}),env,{waitUntil(){}});return[r.status,await r.json().catch(()=>({}))]};
/* アダプターの通信を、本物のサーバーのプログラムへ（外には出さない） */
const fetchImpl=async(u,o={})=>{const x=new URL(u);const r=await w.fetch(new Request('https://x.dev'+x.pathname,{method:o.method||'GET',headers:o.headers,body:o.body}),env,{waitUntil(){}});return r};
let n=0,bad=0;const ok=(c,m,i)=>{n++;if(!c){bad++;console.error('NG',m,JSON.stringify(i)?.slice(0,300))}};
/* にせものの Firebase Auth */
const FB={users:{},calls:[],fail:new Set()};
const auth={getUser:async uid=>{FB.calls.push(['get',uid]);if(!FB.users[uid])throw Object.assign(new Error('nf'),{code:'auth/user-not-found'});return{...FB.users[uid]}},
  updateUser:async(uid,p)=>{FB.calls.push(['update',uid,p]);if(FB.fail.has(uid))throw Object.assign(new Error('x'),{code:'auth/internal-error'});FB.users[uid]={...FB.users[uid],...p}},
  revokeRefreshTokens:async uid=>{FB.calls.push(['revoke',uid])}};
const run=()=>runOnce({api:'http://localhost',token:AT,auth,fetchImpl});
const ADM={admin:'admin-secret-123'};
const RAT='意図的にフィッシングのリンクを広めたと確認したため停止する';
const mk=async(uid,h)=>{const t=await tok(uid);await call('/api/me',{method:'POST',tok:t,body:{handle:h,name:h,agree:true}});FB.users[uid]={uid,disabled:false};return t};
const perp=async(uid,h)=>{const t=await mk(uid,h);tick();const nn=(await call('/api/notes',{method:'POST',tok:t,body:{body:'x'}}))[1].id;
  const c=await call('/api/admin/cases',{method:'POST',...ADM,body:{handle:h,kind:'attack',summary:'このリンクがフィッシングと確かめた（記録の番号で確認）',refs:[{t:'note',id:nn}]}});
  const s=await call('/api/admin/sanctions',{method:'POST',...ADM,body:{kind:'perpetrator',case_id:c[1].case_id,rationale:RAT,confirm:'SANCTION'}});ok(s[0]===200,'停止 '+h,s);return{t,id:s[1].id}};
/* 1. 合言葉 */
let r=await call('/api/fb/outbox');ok(r[0]===404,'合言葉なしでは何も返さない',r);
r=await call('/api/fb/outbox',{hdr:{'x-fb-adapter-token':AT+'x'}});ok(r[0]===404,'合言葉がちがえば何も返さない',r);
r=await call('/api/fb/outbox',{hdr:{'x-fb-adapter-token':HT}});ok(r[0]===404,'ブロッキング関数の合言葉ではアダプターの受け口を使えない',r);
{const E0={...env,FB_ADAPTER_TOKEN:'short'};const rr=await w.fetch(new Request('https://x.dev/api/fb/outbox',{headers:{'x-fb-adapter-token':'short'}}),E0,{waitUntil(){}});ok(rr.status===404,'短い合言葉は設定していないのと同じ',rr.status)}
/* 2. 止める・ログインの印を取り消す */
const A=await perp('fbA','fbaaa');
let s=await run();ok(s.done===1&&FB.users.fbA.disabled===true&&FB.calls.some(c=>c[0]==='revoke'&&c[1]==='fbA'),'確かめた停止で Firebase の UID を止め、ログインの印を取り消す',{s,calls:FB.calls});
s=await run();ok(s.done===0&&s.failed===0,'終わったものはもう一度しない',s);
tick();r=await call('/api/notes',{method:'POST',tok:A.t,body:{body:'x'}});ok(r[0]===403,'前に出た ID トークンのままでも、サイトの門が止める',r);
/* 3. 取り消すと戻す（この仕組みが止めたので） */
await call(`/api/admin/sanctions/${A.id}/reverse`,{method:'POST',...ADM,body:{reason:'誤りと確認したため取り消し',confirm:true}});
s=await run();ok(s.done===1&&FB.users.fbA.disabled===false,'取り消すと Firebase も戻す',{s,u:FB.users.fbA});
/* 4. 前からほかの理由で止まっていたアカウントは、取り消しても戻さない */
const B=await perp('fbB','fbbbb');FB.users.fbB.disabled=true;FB.calls.length=0;
s=await run();ok(s.done===1&&!FB.calls.some(c=>c[0]==='update'&&c[1]==='fbB'),'前から止まっていれば変えない（ログインの印は取り消す）',FB.calls);
await call(`/api/admin/sanctions/${B.id}/reverse`,{method:'POST',...ADM,body:{reason:'誤りと確認したため取り消し',confirm:true}});
s=await run();ok(s.skipped===1&&FB.users.fbB.disabled===true,'ほかの理由で止まっていたアカウントは戻さない',{s,u:FB.users.fbB});
/* 5. 手動の停止（banned=1）があれば戻さない */
const C=await perp('fbC','fbccc');await run();
await call('/api/admin/ban',{method:'POST',...ADM,body:{handle:'fbccc'}});
await call(`/api/admin/sanctions/${C.id}/reverse`,{method:'POST',...ADM,body:{reason:'記録は取り消すが手動の停止は続ける',confirm:true}});
s=await run();ok(s.skipped===1&&FB.users.fbC.disabled===true,'ほかの有効な制限（手動の停止）があれば戻さない',{s,u:FB.users.fbC});
/* 6. 失敗はやり直す・見つからないアカウントは飛ばす */
const D=await perp('fbD','fbddd');FB.fail.add('fbD');
s=await run();ok(s.failed===1&&FB.users.fbD.disabled===false,'Firebase の失敗は数える',s);
ok((await env.DB.prepare(`SELECT attempts,status FROM fb_outbox WHERE uid='fbD'`).first()).attempts===1,'失敗の回数を残し、順番待ちのまま','');
FB.fail.delete('fbD');s=await run();ok(s.done===1&&FB.users.fbD.disabled===true,'次の回でやり直して止める',s);
const E=await perp('fbE','fbeee');delete FB.users.fbE;s=await run();ok(s.skipped===1,'Firebase にないアカウントは飛ばす',s);
/* 7. 何度送っても1つ */
ok((await env.DB.prepare(`SELECT COUNT(*) AS c FROM fb_outbox WHERE uid='fbA' AND action='disable'`).first()).c===1,'同じ停止の依頼は1つ','');
/* 8. ブロッキング関数の受け口（答えは deny だけ・メールは確認済みのときだけ） */
const chk=b=>call('/api/fb/check',{method:'POST',body:b,hdr:{'x-fb-hook-token':HT}});
r=await call('/api/fb/check',{method:'POST',body:{uid:'fbD'}});ok(r[0]===404,'ブロッキング関数の受け口は合言葉が要る',r);
r=await call('/api/fb/check',{method:'POST',body:{uid:'fbD'},hdr:{'x-fb-hook-token':AT}});ok(r[0]===404,'アダプターの合言葉では使えない',r);
r=await chk({uid:'fbD'});ok(r[0]===200&&r[1].deny===true&&Object.keys(r[1]).join()==='deny','停止中の UID は deny（理由・中身は返さない）',r);
r=await chk({uid:'new-uid',email:'fbD@mail.test-gk.net',email_verified:true});ok(r[1].deny===true,'停止中の確認済みメールの新しい UID は deny',r);
r=await chk({uid:'new-uid',email:'fbD@mail.test-gk.net',email_verified:false});ok(r[1].deny===false,'確認されていないメールは本人の証拠にしない',r);
r=await chk({uid:'someone',email:'other@mail.test-gk.net',email_verified:true});ok(r[1].deny===false,'関係のない人は止めない',r);
/* 9. 判断（decide.js） */
const yes=async()=>({deny:true}),no=async()=>({deny:false}),boom=async()=>{throw new Error('x')},slow=()=>new Promise(()=>{}),weird=async()=>({});
let d=await decide({user:{uid:'u',email:'a@b.jp',emailVerified:true},check:yes});ok(d.block&&d.message===NEUTRAL&&!/停止|sanction|メール/.test(d.message),'止めるときの文は理由を言わない',d);
d=await decide({user:{uid:'u'},check:no});ok(!d.block,'止めない',d);
d=await decide({user:{uid:'u'},check:boom});ok(d.block,'届かないときは（はじめは）止める',d);
d=await decide({user:{uid:'u'},check:boom,onError:'allow'});ok(!d.block,'設定で、届かないときは通すこともできる（サイトの門はそのまま）',d);
d=await decide({user:{uid:'u'},check:slow,timeoutMs:50});ok(d.block&&d.why==='error-deny','時間を区切る',d);
d=await decide({user:{uid:'u'},check:weird});ok(d.block,'形のおかしい答えは止める',d);
{let seen;await decide({user:{uid:'u',email:'a@b.jp',emailVerified:false,displayName:'x',phoneNumber:'+81'},check:async q=>{seen=q;return{deny:false}}});
  ok(JSON.stringify(Object.keys(seen))==='["uid","email","email_verified"]'&&seen.email_verified===false,'送るのは UID・メール・確認済みかだけ',seen)}
ok(OUT.every(u=>u.includes('securetoken@system')||u.startsWith('https://webrisk.googleapis.com/')),'本物の Firebase などには通信しない',OUT.filter(u=>!u.includes('securetoken')));
console.log(bad?`fb-adapter: NG（${bad}/${n}）`:`fb-adapter: OK（${n}項目）`);if(bad)process.exit(1);
