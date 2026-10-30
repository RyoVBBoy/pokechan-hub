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
const env={DB:makeD1(),FIREBASE_PROJECT_ID:PID,APP_TOKEN:'t',ADMIN_TOKEN:'admin-secret-123'};
let ipN=0;
const call=async(p,{method='GET',tok,body,ip,admin}={})=>{const h={'content-type':'application/json','cf-connecting-ip':ip||('10.0.0.'+(++ipN%250))};if(tok)h.authorization='Bearer '+tok;if(admin)h['x-admin-token']=admin;
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
/* ハッシュタグ・検索 */
tick();r=await call('/api/notes',{method:'POST',tok:B,body:{body:'今日の構築 #ガブリアス #シングル'}});const nt=r[1].id;
tick();r=await call('/api/notes',{method:'POST',tok:B,body:{body:'＃ガブリアス 全角でもOK'}});
tick();r=await call('/api/notes',{method:'POST',tok:B,body:{body:'タグなしでガブリアスの話'}});
r=await call('/api/search?q='+encodeURIComponent('#ガブリアス'));expect('タグで探せる（全角＃も同じ）',r[0]===200&&r[1].notes.length===2,r[1].notes&&r[1].notes.map(x=>x.body));
r=await call('/api/search?q='+encodeURIComponent('ガブリアス'));expect('言葉で探せる',r[1].notes.length===3,r[1].notes.map(x=>x.body));
r=await call('/api/search?q=bob');expect('人も探せる',r[1].users.some(x=>x.handle==='bob')&&!JSON.stringify(r[1].users).includes('uid'),r[1].users);
r=await call('/api/tags/trend');expect('よく使われているタグ',r[1].tags[0].tag==='ガブリアス'&&r[1].tags[0].n===2,r[1].tags);
await call(`/api/notes/${nt}/delete`,{method:'POST',tok:B,body:{}});
r=await call('/api/search?q='+encodeURIComponent('#シングル'));expect('消した投稿はタグからも消える',r[1].notes.length===0,r[1].notes);
r=await call('/api/search?q='+encodeURIComponent("%' OR 1=1 --"));expect('記号だけの検索でも壊れない',r[0]===200&&r[1].notes.length===0,r);
/* 返信 */
const x=(await call('/api/u/bob/notes'))[1].notes[0].id;
tick();r=await call('/api/notes',{method:'POST',tok:D,body:{body:'返信です',reply_to:x}});expect('返信できる',r[0]===200,r);const rp1=r[1].id;
tick();r=await call('/api/notes',{method:'POST',tok:D,body:{body:'消えた投稿へ',reply_to:999999}});expect('ない投稿には返信できない',r[0]===404,r);
r=await call('/api/notes/'+x);expect('返信の数が増える',r[1].note.replies===1,r[1].note);
r=await call('/api/notes/'+rp1);expect('返信には返信先が付く',r[1].note.reply_to===x&&r[1].note.reply_handle==='bob'&&r[1].parent&&r[1].parent.id===x,r[1]);
r=await call(`/api/notes/${x}/replies`);expect('返信の一覧',r[0]===200&&r[1].notes.length===1&&r[1].notes[0].body==='返信です',r[1]);
r=await call('/api/notifs',{tok:B});expect('返信されたらお知らせ',r[1].notifs.some(n=>n.kind==='reply'&&n.note_id===rp1&&n.body==='返信です'),r[1].notifs);
/* リポスト */
r=await call(`/api/notes/${x}/repost`,{method:'POST',tok:A,body:{}});expect('リポストできる',r[0]===200&&r[1].reposts===1,r);
r=await call(`/api/notes/${x}/repost`,{method:'POST',tok:A,body:{}});expect('二重リポストは数えない',r[1].reposts===1,r);
r=await call('/api/tl',{tok:A});expect('タイムラインにリポストが出る（中身は元の投稿）',r[1].notes[0].id===x&&r[1].notes[0].rp&&r[1].notes[0].rp.handle==='alice'&&r[1].notes[0].user.handle==='bob'&&r[1].notes[0].reposted,r[1].notes[0]);
await call('/api/follow',{method:'POST',tok:D,body:{handle:'alice'}});
r=await call('/api/tl?tab=following',{tok:D});expect('フォローしている人のリポストが出る',r[1].notes.some(n=>n.id===x&&n.rp&&n.rp.handle==='alice'),r[1].notes.map(n=>[n.id,n.rp]));
r=await call('/api/u/alice');expect('リポストは投稿数に数えない',r[1].user.notes===(await call('/api/u/alice/notes'))[1].notes.filter(n=>!n.rp).length,r[1].user);
r=await call('/api/notifs',{tok:B});expect('リポストされたらお知らせ',r[1].notifs.some(n=>n.kind==='repost'&&n.note_id===x),r[1].notifs);
r=await call(`/api/notes/${x}/repost`,{method:'POST',tok:A,body:{on:false}});expect('リポストを取り消せる',r[1].reposts===0,r);
r=await call('/api/tl',{tok:A});expect('取り消したリポストは消える',!r[1].notes.some(n=>n.rp),r[1].notes[0]);
await call(`/api/notes/${x}/repost`,{method:'POST',tok:A,body:{}});
r=await call(`/api/notes/${x}/delete`,{method:'POST',tok:B,body:{}});expect('元の投稿を消せる',r[0]===200,r);
r=await call('/api/tl',{tok:A});expect('元の投稿を消すとリポストも消える',!r[1].notes.some(n=>n.rp||n.id===x),r[1].notes.slice(0,2));
r=await call('/api/notes/'+rp1);expect('返信先が消えても返信は残る',r[0]===200&&r[1].note.reply_handle===''&&!r[1].parent,r[1]);
/* 管理者によるアカウント停止 */
r=await call('/api/admin/ban',{method:'POST',body:{handle:'dave'}});expect('停止は管理者だけ',r[0]===401,r);
r=await call('/api/admin/ban',{method:'POST',admin:'admin-secret-123',body:{handle:'@dave'}});expect('アカウントを停止できる',r[0]===200,r);
r=await call('/api/u/dave');expect('停止中の人のプロフィールは出ない',r[0]===404,r);
tick();r=await call('/api/notes',{method:'POST',tok:D,body:{body:'停止中の投稿'}});expect('停止中は投稿できない',r[0]===403,r);
r=await call('/api/notes/'+rp1);expect('停止中の人の投稿は出ない',r[0]===404,r);
r=await call('/api/admin/banned',{admin:'admin-secret-123'});expect('停止中の一覧',r[1].users.some(u=>u.handle==='dave'),r);
r=await call('/api/admin/ban',{method:'POST',admin:'admin-secret-123',body:{handle:'dave',on:false}});r=await call('/api/u/dave');expect('停止を解除できる',r[0]===200,r);
/* 画像つき投稿 */
const up=async(t,bytes,q='w=4&h=3')=>{const h={'content-type':'application/octet-stream','cf-connecting-ip':'10.9.9.9'};if(t)h.authorization='Bearer '+t;
  const r=await w.fetch(new Request('https://x.dev/api/media?'+q,{method:'POST',headers:h,body:bytes}),env,{waitUntil(){}});return[r.status,await r.json().catch(()=>({}))]};
const getM=async(k,admin)=>{const r=await w.fetch(new Request('https://x.dev/m/'+k,{headers:admin?{'x-admin-token':admin}:{}}),env,{waitUntil(){}});return[r.status,r.headers.get('content-type'),new Uint8Array(await r.arrayBuffer())]};
const JPG=new Uint8Array([0xFF,0xD8,0xFF,0xE0,...Array(300).fill(7)]);
r=await up(null,JPG);expect('画像：ログインなしは拒否',r[0]===401,r);
r=await up(B,new Uint8Array([60,115,99,114,105,112,116,62,...Array(300).fill(1)]));expect('画像：画像でないものは拒否',r[0]===400,r);
r=await up(B,new Uint8Array(1.3e6).fill(0xFF));expect('画像：大きすぎるものは拒否',r[0]===413,r);
r=await up(B,JPG);expect('画像：送れる',r[0]===200&&/^[0-9a-f]{32}$/.test(r[1].key),r);const k1=r[1].key;
r=await getM(k1);expect('画像：投稿に付く前は見えない',r[0]===404,r[0]);
tick();r=await call('/api/notes',{method:'POST',tok:A,body:{body:'',media:[k1]}});expect('画像：ほかの人の画像は付けられない',r[0]===400,r);
tick();r=await call('/api/notes',{method:'POST',tok:B,body:{body:'',media:[k1]}});expect('画像だけの投稿ができる',r[0]===200,r);const nm1=r[1].id;
r=await call('/api/notes/'+nm1);expect('画像が投稿に付く',r[1].note.media.length===1&&r[1].note.media[0].k===k1&&r[1].note.media[0].w===4,r[1].note);
r=await getM(k1);expect('画像：見られる',r[0]===200&&r[1]==='image/jpeg'&&r[2].length===JPG.length,r.slice(0,2));
tick();r=await call('/api/notes',{method:'POST',tok:B,body:{body:'使い回し',media:[k1]}});expect('画像：1つの画像は1つの投稿だけ',r[0]===400,r);
r=await call(`/api/notes/${nm1}/report`,{method:'POST',tok:A,body:{reason:'その他'}});
r=await call('/api/notes/'+nm1);expect('通報1件で画像は確認待ち',r[0]===200&&r[1].note.media.length===0&&r[1].note.media_hidden===1,r[1].note);
r=await getM(k1);expect('確認待ちの画像は見えない',r[0]===404,r[0]);
r=await getM(k1,'admin-secret-123');expect('管理者は確認待ちの画像を見られる',r[0]===200,r[0]);
r=await call('/api/admin/dismiss',{method:'POST',admin:'admin-secret-123',body:{kind:'note',id:nm1}});
r=await getM(k1);expect('問題なしにすると画像が戻る',r[0]===200,r[0]);
r=await call(`/api/notes/${nm1}/delete`,{method:'POST',tok:B,body:{}});r=await getM(k1,'admin-secret-123');expect('投稿を消すと画像も消える',r[0]===404,r[0]);
/* シーズンごとの上位パーティ */
const ADM='admin-secret-123',TM6=[445,149,887,1000,727,812].map(no=>({no,set:{it:{k:'choicescarf'}}}));
r=await call('/api/admin/seasons',{method:'POST',body:{name:'シーズン1'}});expect('シーズン：登録は管理者だけ',r[0]===401,r);
r=await call('/api/admin/seasons',{method:'POST',admin:ADM,body:{name:'シーズン1',start:'2026-10-01',end:'2026-10-31'}});expect('シーズン：登録できる',r[0]===200&&r[1].id>0,r);const S1=r[1].id;
r=await call('/api/admin/seasons',{method:'POST',admin:ADM,body:{name:'おかしい',start:'2026-11-30',end:'2026-11-01'}});expect('シーズン：期間が逆なら拒否',r[0]===400,r);
r=await call('/api/seasons');expect('シーズンの一覧（だれでも）',r[0]===200&&r[1].seasons.some(x=>x.id===S1&&x.name==='シーズン1'),r);
r=await call(`/api/seasons/${S1}/teams`,{method:'POST',body:{fmt:'single',rank:10,team:TM6}});expect('結果の登録はログインが必要',r[0]===401,r);
r=await call(`/api/seasons/${S1}/teams`,{method:'POST',tok:A,body:{fmt:'single',team:TM6}});expect('順位もレートもなければ拒否',r[0]===400,r);
r=await call(`/api/seasons/${S1}/teams`,{method:'POST',tok:A,body:{fmt:'single',rank:3,team:[{no:445},{no:445}]}});expect('同じポケモン2匹は拒否',r[0]===400,r);
r=await up(A,JPG);const pk=r[1].key;
r=await call(`/api/seasons/${S1}/teams`,{method:'POST',tok:A,body:{fmt:'single',rank:30,rate:1850,team:TM6,comment:'初めての上位',proof:pk}});expect('結果を登録できる',r[0]===200,r);const T1=r[1].id;
r=await call(`/api/seasons/${S1}/teams`,{method:'POST',tok:B,body:{fmt:'single',rank:5,team:TM6.slice(0,3)}});expect('別の人も登録できる',r[0]===200,r);
r=await call(`/api/seasons/${S1}/teams`,{method:'POST',tok:A,body:{fmt:'single',rank:12,rate:1900,team:TM6,comment:'更新'}});expect('同じシーズンは上書き',r[0]===200&&r[1].id===T1,r);
r=await call('/api/admin/season-teams',{method:'POST',admin:ADM,body:{season_id:S1,fmt:'single',player:'有名な人',rank:1,rate:2100,team:TM6.slice(0,6)}});expect('運営者が登録できる',r[0]===200,r);
r=await call(`/api/seasons/${S1}/teams?fmt=single`,{tok:A});
expect('順位の小さい順に並ぶ',r[0]===200&&r[1].teams.map(t=>t.rank).join()==='1,5,12',r[1].teams&&r[1].teams.map(t=>t.rank));
expect('運営者の登録は確認済み・自分のには mine',r[1].teams[0].verified&&r[1].teams[0].player.name==='有名な人'&&r[1].teams[2].mine&&!r[1].teams[1].mine,r[1].teams);
expect('よく使われたポケモン',r[1].usage[0].n===3&&r[1].usage[0].pc===100&&r[1].total===3,r[1].usage);
expect('証拠のスクショの中身・uid は出さない',!JSON.stringify(r[1]).includes(pk)&&!JSON.stringify(r[1]).includes('userA'),'');
r=await getM(pk);expect('証拠のスクショはだれでも見られるわけではない',r[0]===404,r[0]);
r=await getM(pk,ADM);expect('運営者は証拠のスクショを見られる',r[0]===200,r[0]);
r=await call(`/api/seasons/${S1}/teams?fmt=double`);expect('形式ごとに分かれる',r[1].teams.length===0,r[1]);
r=await call('/api/admin/season-teams',{admin:ADM});expect('運営者の一覧に証拠の鍵',r[1].teams.some(t=>t.id===T1&&t.proof_key===pk),r[1].teams.map(t=>[t.id,t.proof_key]));
await call('/api/admin/season-teams',{method:'POST',admin:ADM,body:{id:T1,verified:true}});
r=await call(`/api/seasons/${S1}/teams`);expect('確認済みにできる',r[1].teams.find(t=>t.id===T1).verified,r[1].teams);
await call('/api/admin/season-teams',{method:'POST',admin:ADM,body:{id:T1,hidden:true}});
r=await call(`/api/seasons/${S1}/teams`);expect('非表示にできる',!r[1].teams.some(t=>t.id===T1),r[1].teams);
await call('/api/admin/season-teams',{method:'POST',admin:ADM,body:{id:T1,hidden:false}});
r=await call(`/api/seasons/teams/${T1}/delete`,{method:'POST',tok:B,body:{}});expect('他人の登録は消せない',r[0]===404,r);
r=await call(`/api/seasons/teams/${T1}/delete`,{method:'POST',tok:A,body:{}});expect('自分の登録は消せる',r[0]===200,r);
r=await getM(pk,ADM);expect('登録を消すとスクショも消える',r[0]===404,r[0]);
r=await call('/api/admin/seasons',{method:'POST',admin:ADM,body:{id:S1,delete:true}});expect('パーティのあるシーズンは消せない',r[0]===400,r);
/* パーティの同期（/api/me/teams） */
r=await call('/api/me/teams',{tok:A});expect('パーティ：最初は空',r[0]===200&&r[1].teams===null&&r[1].updated_at===0,r);
r=await call('/api/me/teams',{method:'POST',body:{teams:{cur:0,list:[]},updated_at:clock}});expect('パーティ：ログインなしは拒否',r[0]===401,r);
const TM={cur:1,list:[{name:'A',team:[{no:445,sel:true}]},{name:'<b>B</b>',team:[{no:149}]},{name:'',team:[]}]};
r=await call('/api/me/teams',{method:'POST',tok:A,body:{teams:TM,updated_at:clock}});expect('パーティ：保存',r[0]===200,r);
r=await call('/api/me/teams',{tok:A});expect('パーティ：読める',r[1].updated_at===clock&&r[1].teams.cur===1&&r[1].teams.list[0].team[0].no===445,r);
r=await call('/api/me/teams',{tok:B});expect('パーティ：ほかの人のは見えない',r[1].teams===null,r);
r=await call('/api/me/teams',{method:'POST',tok:A,body:{teams:TM,updated_at:clock-1000}});expect('パーティ：古い内容では上書きしない',r[0]===409,r);
r=await call('/api/me/teams',{method:'POST',tok:A,body:{teams:{cur:0,list:[{team:Array(7).fill({no:1})}]},updated_at:clock+1}});expect('パーティ：7匹は拒否',r[0]===400,r);
r=await call('/api/me/teams',{method:'POST',tok:A,body:{teams:{cur:0,list:[{name:'x'.repeat(40000),team:[]}]},updated_at:clock+1}});expect('パーティ：名前は20文字に切る',r[0]===200,r);
await call('/api/me/delete',{method:'POST',tok:A,body:{}});r=await call('/api/me/teams',{tok:A});expect('パーティ：アカウント削除で消える',r[1].teams===null,r);
Date.now=realNow;
console.log(bad?`social: NG（${bad}件）`:`social: OK（${n}項目）`);if(bad)process.exitCode=1;
