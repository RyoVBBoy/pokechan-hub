// スマホへの通知の確認：登録・送信・暗号化（標準のライブラリ http_ece で復号できるか）・送り主の署名・消えた宛先の削除
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {makeD1} from './d1mock.mjs';
const require=createRequire(import.meta.url);const ece=require('http_ece');
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const PID='pokechan-test';
const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const kp=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...(await crypto.subtle.exportKey('jwk',kp.publicKey)),kid:'k1',use:'sig',alg:'RS256'};
const now=Math.floor(Date.now()/1000);
const tok=async uid=>{const h=enc({alg:'RS256',kid:'k1',typ:'JWT'}),p=enc({iss:'https://securetoken.google.com/'+PID,aud:PID,sub:uid,iat:now-10,exp:now+3600,auth_time:now-10,email:uid+'@example.com'});
  return h+'.'+p+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',kp.privateKey,new TextEncoder().encode(h+'.'+p))).toString('base64url')};
/* 受け取る端末（ブラウザ）の鍵をまねて作る */
const ua=crypto.createECDH('prime256v1');ua.generateKeys();const authSecret=crypto.randomBytes(16);
const sub={endpoint:'https://push.example.com/send/abc123',keys:{p256dh:ua.getPublicKey().toString('base64url'),auth:authSecret.toString('base64url')}};
const sent=[];let gone=false;
globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
globalThis.fetch=async(u,o)=>{u=String(u);
  if(u.includes('securetoken@system.gserviceaccount.com'))return new Response(JSON.stringify({keys:[jwk]}));
  if(u.startsWith('https://push.example.com/')){sent.push({u,o});return new Response('',{status:gone?410:201})}
  return new Response('',{status:404})};
const w=(await import(path.join(ROOT,'worker/dist/worker.js'))).default;
const env={DB:makeD1(),FIREBASE_PROJECT_ID:PID,APP_TOKEN:'t'};
const waits=[];
const call=async(p,{method='GET',tok,body}={})=>{const h={'content-type':'application/json','cf-connecting-ip':'10.0.0.'+Math.floor(Math.random()*200)};if(tok)h.authorization='Bearer '+tok;
  const r=await w.fetch(new Request('https://x.dev'+p,{method,headers:h,body:body?JSON.stringify(body):undefined}),env,{waitUntil(p){waits.push(p)}});await Promise.all(waits.splice(0));return[r.status,await r.json().catch(()=>({}))]};
let bad=0,n=0;const expect=(name,cond,info)=>{n++;if(!cond){bad++;console.error('NG',name,JSON.stringify(info))}};
const A=await tok('pa'),B=await tok('pb');
for(const [t,h] of [[A,'alice'],[B,'bob']])await call('/api/me',{method:'POST',tok:t,body:{handle:h,name:h==='alice'?'アリス':'ボブ',agree:true}});
let r=await call('/api/push/key');expect('送り主の鍵がもらえる',r[0]===200&&Buffer.from(r[1].key,'base64url').length===65,r);const vapidPub=r[1].key;
r=await call('/api/push/key');expect('送り主の鍵は毎回同じ',r[1].key===vapidPub,r);
r=await call('/api/me/push',{method:'POST',body:sub});expect('ログインなしは登録できない',r[0]===401,r);
r=await call('/api/me/push',{method:'POST',tok:A,body:{endpoint:'http://bad',keys:{}}});expect('おかしな登録は拒否',r[0]===400,r);
r=await call('/api/me/push',{method:'POST',tok:A,body:sub});expect('通知を登録できる',r[0]===200,r);
/* ボブがアリスの投稿にいいね → アリスに通知 */
r=await call('/api/notes',{method:'POST',tok:A,body:{body:'メガガブリアスZ #構築'}});const nid=r[1].id;
r=await call(`/api/notes/${nid}/like`,{method:'POST',tok:B,body:{}});
expect('いいねで通知が送られる',sent.length===1,sent.length);
const m=sent[0];
if(m){
  const hd=m.o.headers;expect('暗号化の形式',hd['Content-Encoding']==='aes128gcm'&&+hd.TTL>0,hd);
  /* 標準のライブラリで復号できること */
  let plain=null;try{plain=JSON.parse(ece.decrypt(Buffer.from(m.o.body),{version:'aes128gcm',privateKey:ua,authSecret}).toString())}catch(e){console.error(e)}
  expect('通知の中身を復号できる',plain&&plain.title==='ボブさんがあなたの投稿にいいねしました'&&plain.url==='#/n/'+nid&&/メガガブリアスZ/.test(plain.body),plain);
  /* 送り主の署名（VAPID）が正しいこと */
  const [, t, k]=hd.Authorization.match(/^vapid t=([^,]+), k=(.+)$/)||[];
  expect('送り主の鍵が一致',k===vapidPub,k);
  const [h2,p2,s2]=(t||'..').split('.');const pl=JSON.parse(Buffer.from(p2,'base64url'));
  const pubKey=await crypto.subtle.importKey('raw',Buffer.from(vapidPub,'base64url'),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  const ok=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},pubKey,Buffer.from(s2,'base64url'),new TextEncoder().encode(h2+'.'+p2));
  expect('送り主の署名が正しい',ok&&pl.aud==='https://push.example.com'&&pl.exp>now&&/^https:|^mailto:/.test(pl.sub),pl);
}
r=await call(`/api/notes/${nid}/like`,{method:'POST',tok:B,body:{on:false}});r=await call(`/api/notes/${nid}/like`,{method:'POST',tok:B,body:{}});
expect('同じ人の2回目のいいねでは通知しない',sent.length===1,sent.length);
r=await call('/api/follow',{method:'POST',tok:B,body:{handle:'alice'}});
expect('フォローで通知が送られる',sent.length===2,sent.length);
/* 端末が通知をやめた（410）→ 宛先を消す */
gone=true;r=await call('/api/me/push/test',{method:'POST',tok:A,body:{}});gone=false;
r=await call('/api/me/push/test',{method:'POST',tok:A,body:{}});expect('受け取れない宛先は消える',sent.length===3,sent.length);
r=await call('/api/me/push',{method:'POST',tok:A,body:sub});r=await call('/api/me/push/delete',{method:'POST',tok:A,body:{endpoint:sub.endpoint}});
r=await call('/api/me/push/test',{method:'POST',tok:A,body:{}});expect('通知をオフにすると届かない',sent.length===3,sent.length);
console.log(bad?`push: NG（${bad}件）`:`push: OK（${n}項目）`);if(bad)process.exitCode=1;
