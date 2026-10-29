// タイムラインの確認：投稿・ページング・フォロー・いいね・通知・通報・削除をサーバーで確かめる
import path from 'node:path';
import {makeD1} from './d1mock.mjs';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const PID='pokechan-test';
const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const kp=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...(await crypto.subtle.exportKey('jwk',kp.publicKey)),kid:'k1',use:'sig',alg:'RS256'};
const now=Math.floor(Date.now()/1000);
const tok=async uid=>{const h=enc({alg:'RS256',kid:'k1',typ:'JWT'}),p=enc({iss:'https://securetoken.google.com/'+PID,aud:PID,sub:uid,iat:now-10,exp:now+3600,auth_time:now-10,email:uid+'@example.com'});
  return h+'.'+p+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',kp.privateKey,new TextEncoder().encode(h+'.'+p))).toString('base64url')};
globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
globalThis.fetch=async u=>String(u).includes('securetoken@system.gserviceaccount.com')?new Response(JSON.stringify({keys:[jwk]})):new Response('',{status:404});
const w=(await import(path.join(ROOT,'worker/dist/worker.js'))).default;
const env={DB:makeD1(),FIREBASE_PROJECT_ID:PID,APP_TOKEN:'t'};
let ipN=0;
const call=async(p,{method='GET',tok,body,ip}={})=>{const h={'content-type':'application/json','cf-connecting-ip':ip||('10.0.0.'+(++ipN%250))};if(tok)h.authorization='Bearer '+tok;
  const r=await w.fetch(new Request('https://x.dev'+p,{method,headers:h,body:body?JSON.stringify(body):undefined}),env,{waitUntil(){}});return[r.status,await r.json().catch(()=>({}))]};
let bad=0,n=0;const expect=(name,cond,info)=>{n++;if(!cond){bad++;console.error('NG',name,JSON.stringify(info))}};
/* 投稿の連投制限（15秒）をテストでは時計を進めて回避する */
let clock=Date.now();const realNow=Date.now;Date.now=()=>clock;const tick=(ms=16e3)=>{clock+=ms};

const A=await tok('userA'),B=await tok('userB'),C=await tok('userC'),D=await tok('userD');
let r;
r=await call('/api/notes',{method:'POST',body:{body:'こんにちは'}});expect('ログインなしでは投稿できない',r[0]===401,r);
r=await call('/api/notes',{method:'POST',tok:A,body:{body:'こんにちは'}});expect('プロフィールなしでは投稿できない',r[0]===403,r);
for(const [t,h] of [[A,'alice'],[B,'bob'],[C,'carol'],[D,'dave']]){r=await call('/api/me',{method:'POST',tok:t,body:{handle:h,name:h.toUpperCase(),agree:true}});expect('プロフィール作成 '+h,r[0]===200,r)}
r=await call('/api/notes',{method:'POST',tok:A,body:{body:'はじめての投稿'}});expect('投稿できる',r[0]===200&&r[1].id>0,r);const n1=r[1].id;
r=await call('/api/notes',{method:'POST',tok:A,body:{body:'すぐ次の投稿'}});expect('連投は拒否',r[0]===400,r);
tick();r=await call('/api/notes',{method:'POST',tok:A,body:{body:'あ'.repeat(141)}});expect('141文字は拒否',r[0]===400,r);
r=await call('/api/notes',{method:'POST',tok:A,body:{body:'😀'.repeat(140)}});expect('絵文字140文字は受け付ける',r[0]===200,r);
tick();r=await call('/api/notes',{method:'POST',tok:A,body:{body:'見てね https://example.com'}});expect('リンクは拒否',r[0]===400,r);
r=await call('/api/notes',{method:'POST',tok:A,body:{body:'   '}});expect('空は拒否',r[0]===400,r);
/* ページング：bob が25件 */
for(let i=1;i<=25;i++){tick();r=await call('/api/notes',{method:'POST',tok:B,body:{body:'bob '+i}});if(r[0]!==200){expect('bob の投稿',false,r);break}}
r=await call('/api/tl');expect('みんなのタイムライン（ログインなしで見られる）',r[0]===200&&r[1].notes.length===20&&r[1].notes[0].body==='bob 25'&&r[1].next,r[1].next);
expect('uid やIPアドレスを出さない',!JSON.stringify(r[1]).match(/userA|userB|10\.0\.0\./),'');
const p2=await call('/api/tl?before='+r[1].next);expect('2ページ目',p2[0]===200&&p2[1].notes.length===7&&p2[1].next===null&&p2[1].notes[0].body==='bob 5',p2[1].notes.map(x=>x.body));
/* フォロー */
r=await call('/api/tl?tab=following',{tok:C});expect('フォロー0人なら空',r[0]===200&&r[1].notes.length===0,r);
r=await call('/api/follow',{method:'POST',tok:C,body:{handle:'ALICE'}});expect('フォロー（大文字でも）',r[0]===200&&r[1].followers===1,r);
r=await call('/api/follow',{method:'POST',tok:C,body:{handle:'carol'}});expect('自分はフォローできない',r[0]===400,r);
r=await call('/api/tl?tab=following',{tok:C});expect('フォロー中のタイムライン',r[0]===200&&r[1].notes.length===2&&r[1].notes.every(x=>x.user.handle==='alice'),r[1].notes.map(x=>x.user.handle));
r=await call('/api/u/alice',{tok:C});expect('プロフィールにフォロー数と状態',r[0]===200&&r[1].user.followers===1&&r[1].user.followed&&r[1].user.notes===2&&!('uid' in r[1].user),r);
r=await call('/api/u/carol',{tok:A});expect('フォローされているのがわかる',r[1].user.follows_me&&r[1].user.following===1,r);
r=await call('/api/u/alice/notes');expect('その人の投稿',r[0]===200&&r[1].notes.length===2,r);
/* いいね */
r=await call(`/api/notes/${n1}/like`,{method:'POST',tok:C,body:{}});expect('いいね',r[0]===200&&r[1].likes===1,r);
r=await call(`/api/notes/${n1}/like`,{method:'POST',tok:C,body:{}});expect('二重いいねは数えない',r[1].likes===1,r);
r=await call(`/api/notes/${n1}/like`,{method:'POST',tok:B,body:{}});expect('別の人のいいね',r[1].likes===2,r);
r=await call('/api/notes/'+n1,{tok:C});expect('いいね済みがわかる',r[1].note.liked&&r[1].note.likes===2,r);
/* 通知 */
r=await call('/api/notifs/count',{tok:A});expect('お知らせの未読数（フォロー1・いいね2）',r[1].unread===3,r);
r=await call('/api/notifs',{tok:A});expect('お知らせの一覧',r[0]===200&&r[1].notifs.length===3&&r[1].notifs.some(x=>x.kind==='follow'&&x.user.handle==='carol'),r);
await call('/api/notifs/seen',{method:'POST',tok:A,body:{}});
r=await call('/api/notifs/count',{tok:A});expect('既読にできる',r[1].unread===0,r);
r=await call(`/api/notes/${n1}/like`,{method:'POST',tok:B,body:{on:false}});expect('いいねを取り消せる',r[1].likes===1,r);
r=await call('/api/notifs',{tok:A});expect('取り消したいいねは通知から消える',r[1].notifs.length===2,r);
/* 通報：同じ人は1回、3人で非表示 */
for(const t of [B,B,C]){r=await call(`/api/notes/${n1}/report`,{method:'POST',tok:t,body:{reason:'その他'}})}
r=await call('/api/notes/'+n1);expect('2人の通報ではまだ表示',r[0]===200,r);
await call(`/api/notes/${n1}/report`,{method:'POST',tok:D,body:{reason:'その他'}});
r=await call('/api/notes/'+n1);expect('3人の通報で非表示',r[0]===404,r);
/* 削除 */
tick();r=await call('/api/notes',{method:'POST',tok:C,body:{body:'消す投稿'}});const n3=r[1].id;
r=await call(`/api/notes/${n3}/delete`,{method:'POST',tok:A,body:{}});expect('他人の投稿は消せない',r[0]===404,r);
r=await call(`/api/notes/${n3}/delete`,{method:'POST',tok:C,body:{}});expect('自分の投稿は消せる',r[0]===200,r);
r=await call('/api/tl',{tok:C});expect('消した投稿はタイムラインから消える',!r[1].notes.some(x=>x.body==='消す投稿'),r);
r=await call('/api/u/alice/notes',{tok:A});expect('自分の投稿には mine が付く',r[1].notes.length&&r[1].notes.every(x=>x.mine),r);
r=await call('/api/u/alice/notes',{tok:B});expect('他人の投稿には mine が付かない',r[1].notes.every(x=>!x.mine),r);
/* アカウント削除で全部消える */
await call(`/api/notes/${(await call('/api/u/bob/notes'))[1].notes[0].id}/like`,{method:'POST',tok:C,body:{}});
r=await call('/api/me/delete',{method:'POST',tok:C,body:{}});expect('アカウント削除',r[0]===200,r);
r=await call('/api/u/alice');expect('削除した人のフォローは消える',r[1].user.followers===0,r);
r=await call('/api/u/bob/notes');expect('削除した人のいいねは数から引かれる',r[1].notes[0].likes===0,r[1].notes[0]);
r=await call('/api/notifs',{tok:A});expect('削除した人からの通知は消える',r[1].notifs.length===0,r);
/* 掲示板は従来どおり */
r=await call('/api/boards');expect('掲示板は従来どおり',r[0]===200,r);
Date.now=realNow;
console.log(bad?`social: NG（${bad}件）`:`social: OK（${n}項目）`);if(bad)process.exitCode=1;
