// Firebase の公式エミュレーター（Auth・Functions）で、ブロッキング関数とアダプターを本物の SDK で確かめる（docs/secure-link-posting-runbook.md §6）。
// ・プロジェクトは demo-gk（demo- で始まるプロジェクトは本物の資源につながらない）。合成の利用者だけ。合言葉・サービスアカウントの鍵は使わない
// ・Worker は、このプロセスの中で http://127.0.0.1 に立てる（tests/d1mock.mjs の D1）。外への通信は止める（ログインの鍵の取得だけ、このテストの鍵で答える）
// ・確かめること：新規登録と停止中のログインをブロッキング関数が Worker に聞いて止める／アダプターが止める・戻す（取り消し・期限）／時間切れのあと遅れて終わった操作
// 動かし方：firebase-tools を入れて FB_EMU_BIN=<firebase の実行ファイル> node tests/fb-emulator.mjs（tools/firebase-blocking で npm ci --ignore-scripts が要る）。
// FB_EMU_BIN がなければ「飛ばした」と書いて終わる（FB_EMU_TEST=1 なら失敗）。
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {makeD1} from './d1mock.mjs';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const BIN=process.env.FB_EMU_BIN||'';
if(!BIN||!fs.existsSync(BIN)){
  if(process.env.FB_EMU_TEST==='1'){console.error('fb-emulator: NG（FB_EMU_BIN に firebase-tools の firebase を指定してください）');process.exit(1)}
  console.log('fb-emulator: firebase-tools がないので飛ばしました（FB_EMU_BIN=<firebase> で動かす）');process.exit(0)}
const BL=path.join(ROOT,'tools/firebase-blocking'),AD=path.join(ROOT,'tools/firebase-adapter');
if(!fs.existsSync(path.join(BL,'node_modules'))||!fs.existsSync(path.join(AD,'node_modules'))){console.error('fb-emulator: NG（tools/firebase-blocking・tools/firebase-adapter で npm ci --ignore-scripts）');process.exit(1)}
const PROJECT='demo-gk',WPORT=18787,APORT=19099,FPORT=15001,HUB=14400;
let n=0,bad=0;const ok=(c,m,i)=>{n++;if(!c){bad++;console.error('NG',m,JSON.stringify(i)?.slice(0,400))}};
/* 1. 本物の資源に行かないことの前提 */
ok(/^demo-/.test(PROJECT)&&!process.env.GOOGLE_APPLICATION_CREDENTIALS,'demo- のプロジェクト・サービスアカウントの鍵なし（本物の資源に行かない）',{p:PROJECT,cred:!!process.env.GOOGLE_APPLICATION_CREDENTIALS});
/* 2. Worker（このプロセスの中）。ログインの鍵はこのテストの鍵で答え、ほかの外への通信は止めて記録する */
const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const kp=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...(await crypto.subtle.exportKey('jwk',kp.publicKey)),kid:'k1',use:'sig',alg:'RS256'};
const OUT=[];const realFetch=globalThis.fetch;
globalThis.fetch=async(u,o)=>{u=String(u);if(u.includes('securetoken@system'))return new Response(JSON.stringify({keys:[jwk]}));
  if(/^http:\/\/127\.0\.0\.1:/.test(u))return realFetch(u,o);OUT.push(u);return new Response('blocked',{status:599})};
globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
const w=(await import(path.join(ROOT,'worker/dist/worker.js'))).default;
const AT='adapter-token-emulator-0123456789abcdef',HT='hook-token-emulator-0123456789abcdef-q';
const env={DB:makeD1(),FIREBASE_PROJECT_ID:PROJECT,APP_TOKEN:'t',ADMIN_TOKEN:'admin-secret-emu',SANCTIONS_ON:'1',EMAIL_HMAC_KEY:'email-hmac-key-emulator-0123456789abcdef',
  FB_ADAPTER_TOKEN:AT,FB_HOOK_TOKEN:HT,FB_ENV_ID:'emu-env'};
const HOOKS=[];
const srv=http.createServer(async(req,res)=>{const ch=[];for await(const c of req)ch.push(c);const body=Buffer.concat(ch);
  if(req.url==='/api/fb/check')HOOKS.push(JSON.parse(body.toString()||'{}'));
  const r=await w.fetch(new Request('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:body}),env,{waitUntil(){}});
  res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()))});
await new Promise(r=>srv.listen(WPORT,'127.0.0.1',r));
const W='http://127.0.0.1:'+WPORT;
const tok=async uid=>{const T0=Math.floor(Date.now()/1000);const h=enc({alg:'RS256',kid:'k1',typ:'JWT'}),p=enc({iss:'https://securetoken.google.com/'+PROJECT,aud:PROJECT,sub:uid,iat:T0-10,exp:T0+3600,auth_time:T0-10,email:uid+'@example.invalid',email_verified:true});
  const sig=Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',kp.privateKey,new TextEncoder().encode(h+'.'+p))).toString('base64url');return h+'.'+p+'.'+sig};
const call=async(p,{method='GET',t,body,admin}={})=>{const h={'content-type':'application/json'};if(t)h.authorization='Bearer '+t;if(admin)h['x-admin-token']=admin;
  const r=await realFetch(W+p,{method,headers:h,body:body?JSON.stringify(body):undefined});let j=null;try{j=await r.json()}catch(e){}return[r.status,j]};
const ADM={admin:'admin-secret-emu'};
/* 3. ブロッキング関数の写し（承認された「エミュレーターの環境」だけを持つ対応表。もとの tools/firebase-blocking/firebase-env.json は変えない） */
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'fbemu-'));const FN=path.join(TMP,'fn');fs.mkdirSync(FN);
for(const f of ['index.js','decide.js','package.json'])fs.copyFileSync(path.join(BL,f),path.join(FN,f));
fs.symlinkSync(path.join(BL,'node_modules'),path.join(FN,'node_modules'));
const MAP={environments:{production:JSON.parse(fs.readFileSync(path.join(BL,'firebase-env.json'),'utf8')).environments.production,
  emu:{approved:true,allowLocal:true,project:PROJECT,worker:W,workerEnvId:'emu-env',serviceAccount:'emulator@'+PROJECT+'.invalid'}}};
fs.writeFileSync(path.join(FN,'firebase-env.json'),JSON.stringify(MAP));
fs.writeFileSync(path.join(FN,'.env'),'FB_ENV=emu\nFB_HOOK_ON_ERROR=deny\n');
fs.writeFileSync(path.join(FN,'.secret.local'),'FB_HOOK_TOKEN='+HT+'\n');
fs.writeFileSync(path.join(TMP,'firebase.json'),JSON.stringify({functions:{source:'fn'},emulators:{auth:{port:APORT,host:'127.0.0.1'},functions:{port:FPORT,host:'127.0.0.1'},hub:{port:HUB,host:'127.0.0.1'},ui:{enabled:false},logging:{port:14500},singleProjectMode:true}}));
const logF=path.join(TMP,'emu.log');const lf=fs.openSync(logF,'w');
const cp=spawn(BIN,['emulators:start','--project',PROJECT,'--only','auth,functions'],{cwd:TMP,stdio:['ignore',lf,lf],env:{...process.env,GOOGLE_APPLICATION_CREDENTIALS:'',FIREBASE_CLI_EXPERIMENTS:'',CI:'1'}});
const stop=()=>{try{cp.kill('SIGINT')}catch(e){}};process.on('exit',stop);
let up=false;for(let i=0;i<360&&!up;i++){await new Promise(r=>setTimeout(r,500));up=/All emulators ready/.test(fs.readFileSync(logF,'utf8'));if(cp.exitCode!==null)break}
const L0=fs.readFileSync(logF,'utf8');
ok(up,'エミュレーターが起動する（Auth・Functions）',L0.slice(-1500));
if(!up){console.log(L0.slice(-3000));stop();srv.close();process.exit(1)}
/* 関数が読みこまれるまで少し待つ */
for(let i=0;i<60;i++){if(/beforecreated|beforesignedin/.test(fs.readFileSync(logF,'utf8')))break;await new Promise(r=>setTimeout(r,500))}
ok(/beforecreated/.test(fs.readFileSync(logF,'utf8'))&&/beforesignedin/.test(fs.readFileSync(logF,'utf8')),'2つのブロッキング関数が読みこまれる',fs.readFileSync(logF,'utf8').slice(-1500));
/* 4. Firebase Admin（アダプターと同じ版）。エミュレーターに向ける（FIREBASE_AUTH_EMULATOR_HOST）。鍵なし */
process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:'+APORT;
const ar=createRequire(path.join(AD,'adapter.mjs'));
const {initializeApp}=await import(ar.resolve('firebase-admin/app'));const {getAuth}=await import(ar.resolve('firebase-admin/auth'));
const app=initializeApp({projectId:PROJECT},'emu');const auth=getAuth(app);
const {runOnce,pickEnv}=await import(path.join(AD,'adapter.mjs'));
const AENV=pickEnv(MAP,'emu');ok(AENV.worker===W,'アダプターは承認されたエミュレーターの環境だけを選ぶ（demo- と 127.0.0.1）','');
{let t=null;try{pickEnv({environments:{x:{approved:true,allowLocal:true,project:'real-proj',worker:W,workerEnvId:'e',serviceAccount:'s@x'}}},'x')}catch(e){t=e.message}ok(t==='env-worker','demo- でないプロジェクトは http://127.0.0.1 を使えない',t)}
const run=o=>runOnce({env:AENV,token:AT,auth,sdk:{projectId:PROJECT,serviceAccount:AENV.serviceAccount},fetchImpl:realFetch,timeoutMs:4000,settleMs:5000,...o});
/* 利用者の登録（Auth エミュレーターの REST。key は何でもよい） */
const IDT='http://127.0.0.1:'+APORT+'/identitytoolkit.googleapis.com/v1';
const signUp=(email,pw)=>realFetch(IDT+'/accounts:signUp?key=fake',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:pw,returnSecureToken:true})}).then(async r=>[r.status,await r.json()]);
const signIn=(email,pw)=>realFetch(IDT+'/accounts:signInWithPassword?key=fake',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:pw,returnSecureToken:true})}).then(async r=>[r.status,await r.json()]);
let r=await signUp('emu.one@example.invalid','pw-123456');
ok(r[0]===200&&r[1].localId&&HOOKS.length>=1&&HOOKS[0].uid===r[1].localId&&HOOKS[0].email===null,'新規登録：ブロッキング関数が Worker に聞く（確認されていないメールは送らない）・停止がなければ通す',{r:r[0],HOOKS});
const U1=r[1].localId;
/* Worker の側に、同じ UID のプロフィール・確認の記録・停止を作る */
const t1=await tok(U1);await call('/api/me',{method:'POST',t:t1,body:{handle:'emuone',name:'E',agree:true}});
const nt=await call('/api/notes',{method:'POST',t:t1,body:{body:'証拠の投稿（合成）'}});
const cs=await call('/api/admin/cases',{method:'POST',...ADM,body:{handle:'emuone',kind:'attack',summary:'合成の利用者のフィッシングを確かめた（エミュレーターのテスト）',refs:[{t:'note',id:nt[1].id}],evidence_kinds:['direct'],attest:true,reviewer:'テスト'}});
const sc=await call('/api/admin/sanctions',{method:'POST',...ADM,body:{kind:'temporary',case_id:cs[1].case_id,rationale:'エミュレーターのテストのための一時的な停止です（合成）',confirm:'SANCTION',reviewer:'テスト',months:3}});
ok(sc[0]===200,'Worker で一時的な停止を作る',sc);
const h0=HOOKS.length;r=await signIn('emu.one@example.invalid','pw-123456');
ok(r[0]!==200&&/BLOCKING_FUNCTION_ERROR|PERMISSION_DENIED|permission/i.test(JSON.stringify(r[1]))&&HOOKS.length===h0+1,'停止中のログイン：ブロッキング関数が止める',r);
/* 5. アダプター：止める → 確かめる */
let s=await run();let u=await auth.getUser(U1);
ok(s.done===1&&u.disabled===true,'アダプターがエミュレーターのアカウントを止める（本物の SDK）',{s,disabled:u.disabled});
/* 6. 取り消し → 戻す */
await call(`/api/admin/sanctions/${sc[1].id}/reverse`,{method:'POST',...ADM,body:{reason:'エミュレーターのテストで取り消す',confirm:true}});
s=await run();u=await auth.getUser(U1);ok(s.done===1&&u.disabled===false,'取り消すとアダプターが戻す',{s,disabled:u.disabled});
r=await signIn('emu.one@example.invalid','pw-123456');ok(r[0]===200,'取り消したあとはログインできる',r[0]);
/* 7. 期限：期限が過ぎると戻す（Worker の時計を進めて1時間ごとの仕事を動かす） */
const sc2=await call('/api/admin/sanctions',{method:'POST',...ADM,body:{kind:'temporary',case_id:(await call('/api/admin/cases',{method:'POST',...ADM,body:{handle:'emuone',kind:'attack',summary:'合成の利用者の2回目の確認（エミュレーターのテスト）',refs:[{t:'note',id:nt[1].id}],evidence_kinds:['direct'],attest:true,reviewer:'テスト'}}))[1].case_id,rationale:'エミュレーターのテストのための2回目の停止です（合成）',confirm:'SANCTION',reviewer:'テスト',months:3}});
s=await run();ok((await auth.getUser(U1)).disabled===true,'2回目の停止で止める',s);
const realNow=Date.now;let clock=realNow()+200*864e5;Date.now=()=>clock;
await w.scheduled({cron:'0 * * * *',scheduledTime:clock},env,{waitUntil(p){return p}});
s=await run();Date.now=realNow;ok((await auth.getUser(U1)).disabled===false,'期限が過ぎるとアダプターが戻す',s);
/* 8. 時間切れ：止める呼び出しを時間切れにする（エミュレーターでは遅れて本当に終わる） */
r=await signUp('emu.two@example.invalid','pw-123456');const U2=r[1].localId;const t2=await tok(U2);
await call('/api/me',{method:'POST',t:t2,body:{handle:'emutwo',name:'T',agree:true}});const n2=await call('/api/notes',{method:'POST',t:t2,body:{body:'証拠の投稿（合成2）'}});
const c3=await call('/api/admin/cases',{method:'POST',...ADM,body:{handle:'emutwo',kind:'attack',summary:'合成の利用者2のフィッシングを確かめた（エミュレーターのテスト）',refs:[{t:'note',id:n2[1].id}],evidence_kinds:['direct'],attest:true,reviewer:'テスト'}});
await call('/api/admin/sanctions',{method:'POST',...ADM,body:{kind:'temporary',case_id:c3[1].case_id,rationale:'エミュレーターのテストのための停止です（時間切れ）',confirm:'SANCTION',reviewer:'テスト',months:3}});
const slowAuth={getUser:x=>auth.getUser(x),revokeRefreshTokens:x=>auth.revokeRefreshTokens(x),updateUser:(x,p)=>new Promise((res,rej)=>setTimeout(()=>auth.updateUser(x,p).then(res,rej),600))};
s=await runOnce({env:AENV,token:AT,auth:slowAuth,sdk:{projectId:PROJECT,serviceAccount:AENV.serviceAccount},fetchImpl:realFetch,timeoutMs:200,settleMs:5000});
const st=await call('/api/admin/sanctions',{...ADM});
ok(s.unknown===1&&s.observed===1&&(await auth.getUser(U2)).disabled===true&&st[1].fb_sync.open_ops.every(x=>x.uid!==U2),'時間切れの止める呼び出しが遅れて終わった：その操作の印で読み直して片づける（持ち主はこの仕組み）',{s,open:st[1].fb_sync.open_ops});
s=await run();ok((await auth.getUser(U2)).disabled===true,'次の回で確かめて終える',s);
/* 9. 外へは出ていない */
ok(OUT.length===0,'本物の Google・Firebase には通信していない（このプロセス）',OUT);
const LF=fs.readFileSync(logF,'utf8');ok(!/googleapis\.com\/.*(denied|403)/.test(LF),'エミュレーターの記録に本物の資源への問い合わせの失敗がない','');
stop();srv.close();try{fs.rmSync(TMP,{recursive:true,force:true})}catch(e){}
console.log(bad?`fb-emulator: NG（${bad}/${n}）`:`fb-emulator: OK（${n}項目・Firebase Auth/Functions エミュレーター・${PROJECT}）`);
process.exit(bad?1:0);
