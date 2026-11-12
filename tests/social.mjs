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
/* にせものの Gemini：出典ごとに決まった「事実」を返す（記事から事実だけを集める仕組みの確認用） */
const PM=(n,x={})=>({name:n,item:null,ability:null,moves:[],...x});
const GEM_PAGES={
  'https://a.example/1':{page_format:'single',teams:[{player:'Taro',rank:1,rate:2100,pokemon:[PM('ガブリアス',{item:'こだわりスカーフ',moves:['じしん']}),PM('カイリュー'),PM('サーフゴー'),PM('ドラパルト'),PM('ガオガエン'),PM('ゴリランダー')]},
    {player:'Solo',rank:50,pokemon:[PM('バンギラス'),PM('メタグロス'),PM('ペリッパー'),PM('イダイトウ'),PM('アローラライチュウ'),PM('ゴーゴート')]}]},
  'https://b.example/2':{page_format:'single',teams:[{player:'taro',rank:1,pokemon:[PM('ガブリアス',{item:'こだわりスカーフ'}),PM('カイリュー'),PM('サーフゴー'),PM('ドラパルト'),PM('ガオガエン'),PM('シャワーズ')]},
    {player:'Hanako',rank:3,pokemon:[PM('ペリッパー'),PM('イダイトウ'),PM('ハリーマン'),PM('シャワーズ'),PM('ヌメルゴン'),PM('ゴーゴート')]}]},
  'https://c.example/3':{page_format:'double',teams:[{player:'X',rank:2,pokemon:[PM('ガブリアス'),PM('カイリュー'),PM('サーフゴー'),PM('ドラパルト'),PM('ガオガエン'),PM('ゴリランダー')]}]}
};
const gemReply=t=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:t}]}}]}));
globalThis.fetch=async(u,o)=>{u=String(u);
  if(u.includes('securetoken@system.gserviceaccount.com'))return new Response(JSON.stringify({keys:[jwk]}));
  if(u.includes('generativelanguage')&&u.includes('/models?'))return new Response(JSON.stringify({models:[{name:'models/gemini-2.5-flash',supportedGenerationMethods:['generateContent']}]}));
  if(u.includes('generativelanguage')&&u.includes(':generateContent')&&globalThis.GEM_BUSY)return new Response(JSON.stringify({error:{message:'quota'}}),{status:429});
  if(u.includes('generativelanguage')&&u.includes(':generateContent')){const b=JSON.parse(o.body);
    if(b.tools&&b.tools[0].google_search)return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'C'}]},groundingMetadata:{groundingChunks:[{web:{uri:'https://c.example/3',title:'C'}},{web:{uri:'javascript:alert(1)',title:'bad'}}]}}]}));
    if(b.contents[0].parts.length>2&&b.contents[0].parts.some(p=>/画面収録/.test(p.text||'')))return gemReply(JSON.stringify({format:'single',result:'win',opponent_team:['ガブリアス','カイリュー','サーフゴー','ドラパルト','ガオガエン','ゴリランダー'],my_team:['リザードン','カメックス'],opponent_used:['ガブリアス','サーフゴー'],my_used:['リザードン'],opponent_moves:{'ガブリアス':['じしん','げきりん']},opponent_items:{'ガブリアス':'こだわりスカーフ'}}));
    if(b.contents[0].parts[0].inline_data)return gemReply(JSON.stringify({opponent:[{name:'ガブリアス',types:['ドラゴン','じめん'],confidence:.9},{name:'カイリュー',types:['ドラゴン','ひこう'],confidence:.9},{name:'サーフゴー',types:['はがね','ゴースト'],confidence:.4},{name:'？？？',types:['ほのお'],confidence:.2}]}));
    const url=(b.contents[0].parts[0].text.match(/ページ：(\S+)/)||[])[1];return gemReply('```json\n'+JSON.stringify(GEM_PAGES[url]||{teams:[]})+'\n```')}
  if(u.startsWith('https://note.com/api/v3/hashtags/'))return new Response(JSON.stringify({data:{is_last_page:true,notes:[
    {key:'n0123456789ab',name:'【ポケモンチャンピオンズ】シーズン2 最終12位 構築',user:{urlname:'taro'}},{key:'nabcdef012345',name:'レート2100 到達パーティ',user:{urlname:'hana'}},
    {key:'n999999999999',name:'初心者の日記',user:{urlname:'jiro'}}]}}));
  if(u.startsWith('https://note.com/api/v2/creators/'))return new Response(JSON.stringify({data:{isLastPage:true,contents:[{key:'n111111111111',name:'S2 使用構築 最終45位',noteUrl:'https://note.com/kyo/n/n111111111111'}]}}));
  if(u.startsWith('https://blog.example/'))return new Response(`<html><a href="/login">ログイン</a><a href="https://note.com/hashtag/x">#x</a>
    <a href="https://note.com/taro/n/n0123456789ab"><h3>【ポケモンチャンピオンズ】シーズン2 最終12位 構築</h3></a>
    <div data-url="https://note.com/hana/n/nabcdef012345?from=list"></div><a href="https://note.com/taro/n/n0123456789ab">同じ記事</a>
    <a href="https://other.example/x">よそ</a><a href="/archives/77">シーズン2 最終3位 構築</a><a href="/about">このブログについて</a></html>`,{headers:{'content-type':'text/html'}});
  if(u.endsWith('/assets/tier.json'))return new Response(JSON.stringify(TIERJ));
  return new Response('',{status:404})};
let TIERJ={at:Date.now(),live:true,fmt:'single',rows:[{no:445,name:'ガブリアス',tier:'S',u:1},{no:149,name:'カイリュー',tier:'A',u:2},{no:887,name:'ドラパルト',tier:'B',u:3}]};
const w=(await import(path.join(ROOT,'worker/dist/worker.js'))).default;
const env={DB:makeD1(),FIREBASE_PROJECT_ID:PID,APP_TOKEN:'t',ADMIN_TOKEN:'admin-secret-123',GEMINI_API_KEY:'test-key'};
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
/* 公式のお知らせ：管理者だけ。公式サイト以外のアドレスは断る。投稿はリンク付きでタイムラインに出る */
r=await call('/api/admin/news');expect('お知らせ：管理者以外は使えない',r[0]===401,r);
r=await call('/api/admin/news/src',{method:'POST',admin:'admin-secret-123',body:{url:'https://example.com/news'}});expect('お知らせ：公式以外の一覧ページは断る',r[0]===400,r);
r=await call('/api/admin/news/src',{method:'POST',admin:'admin-secret-123',body:{url:'https://www.pokemonchampions.jp/ja/news/'}});expect('お知らせ：ポケモンチャンピオンズ公式サイトの一覧ページを登録できる',r[0]===200,r);
r=await call('/api/admin/news/post',{method:'POST',admin:'admin-secret-123',body:{cat:'メンテナンス',title:'ver1.2 のお知らせ',url:'https://www.pokemon.co.jp/info/test'}});expect('お知らせ：手で投稿できる',r[0]===200,r);
r=await call('/api/tl');{const n=r[1].notes.find(x=>x.user.handle==='news_bot');expect('お知らせ：リンク付きでタイムラインに出る',n&&n.link==='https://www.pokemon.co.jp/info/test'&&/【公式・メンテナンス】/.test(n.body)&&/#公式のお知らせ/.test(n.body),r[1].notes[0])}
r=await call('/api/news?cat='+encodeURIComponent('メンテナンス'));expect('お知らせ：種類ごとの一覧',r[0]===200&&r[1].items.length===1&&r[1].items[0].cat==='メンテナンス',r[1]);
r=await call('/api/news?cat='+encodeURIComponent('不具合'));expect('お知らせ：ほかの種類には出ない',r[1].items.length===0,r[1]);
/* アクセス解析：画面ごとの回数だけを数え、管理者だけが見られる */
await call('/api/hit',{method:'POST',body:{k:'assist',v:1,d:'sp',r:'search'}});await call('/api/hit',{method:'POST',body:{k:'assist'}});await call('/api/hit',{method:'POST',body:{k:'bad key!'}});
r=await call('/api/admin/hits');expect('アクセス解析：管理者以外は見られない',r[0]===401,r);
r=await call('/api/admin/hits',{admin:'admin-secret-123'});const hitN=k=>(r[1].rows.find(x=>x.k===k)||{}).n;
expect('アクセス解析：画面・訪問・端末・来た場所を数える',hitN('p:assist')===2&&hitN('_visit')===1&&hitN('d:sp')===1&&hitN('r:search')===1&&!r[1].rows.some(x=>/bad/.test(x.k)),r[1]);
r=await call('/api/admin/ban',{method:'POST',admin:'admin-secret-123',body:{handle:'dave',on:false}});r=await call('/api/u/dave');expect('停止を解除できる',r[0]===200,r);
/* 機能の操作の回数（2026/11/12）：決めた種類だけ・日付ごとの合計。中身は受け取らない。表示の記録とは分けて数える */
{const hit=async b=>{const rr=await w.fetch(new Request('https://x.dev/api/hit',{method:'POST',headers:{'content-type':'text/plain','cf-connecting-ip':'10.7.7.7'},body:typeof b==='string'?b:JSON.stringify(b)}),env,{waitUntil(){}});return rr.status};
  const st=[await hit({e:'calc_done'}),await hit({e:'calc_done'}),await hit({e:'oppread_ng'}),await hit({e:'oppread_ok'})];
  expect('操作：決めた種類は数える',st.every(x=>x===204),st);
  const bad=[await hit({e:'bogus'}),await hit({e:'calc_done',k:'x'}),await hit({e:5}),await hit({e:'calc_done',q:'ガブリアス'}),await hit({e:'CALC_DONE'}),await hit('{bad json')];
  expect('操作：知らない種類・中身つき・形のおかしいものは断る',bad.slice(0,5).every(x=>x===400),bad);
  r=await call('/api/admin/hits?days=7&cmp=1',{admin:'admin-secret-123'});const en=k=>(r[1].rows.find(x=>x.k===k)||{}).n;
  expect('操作：種類ごと・成功と失敗を分けて数える',en('e:calc_done')===2&&en('e:oppread_ng')===1&&en('e:oppread_ok')===1&&!r[1].rows.some(x=>/bogus|CALC/.test(x.k)),r[1].rows);
  expect('操作を足しても、表示・訪問・端末・来た場所の数は前のまま',en('p:assist')===2&&en('_visit')===1&&en('d:sp')===1&&en('r:search')===1,r[1].rows);
  expect('操作：記録を始めた日・期間・日本時間を返す',r[1].evStart&&r[1].tz==='Asia/Tokyo'&&r[1].days===7&&r[1].from&&r[1].to&&r[1].pfrom&&r[1].pto,r[1]);
  r=await call('/api/admin/hits?days=7&cmp=1');expect('操作：管理者以外は見られない',r[0]===401,r);
  r=await call('/api/admin/hits?days=7&cmp=1',{admin:'wrong-secret-xyz'});expect('操作：合言葉が違うと見られない',r[0]===401,r);
  /* 期間（7・30・90日）と前の期間：日本時間の日付で区切る */
  const jd=ms=>new Date(ms+9*36e5).toISOString().slice(0,10),T0=Date.now(),dd=k=>jd(T0-k*864e5);
  for(const k of [0,6,7,13,14,29,30,59,60,89,90,179,180])await env.DB.prepare(`INSERT INTO page_hits(day,k,n) VALUES(?,?,?)`).bind(dd(k),'p:zz',1000+k).run();
  const got=async d=>{const q=await call(`/api/admin/hits?days=${d}&cmp=1`,{admin:'admin-secret-123'});const x=q[1];
    const inR=(a,b)=>x.rows.filter(y=>y.k==='p:zz'&&y.day>=a&&y.day<=b).map(y=>y.n-1000).sort((a,b)=>a-b).join();return[inR(x.from,x.to),inR(x.pfrom,x.pto),x.from,x.to,x.pfrom,x.pto]};
  let g=await got(7);expect('期間7日：今日〜6日前、前の期間は7〜13日前',g[0]==='0,6'&&g[1]==='7,13'&&g[2]===dd(6)&&g[3]===dd(0)&&g[4]===dd(13)&&g[5]===dd(7),g);
  g=await got(30);expect('期間30日：今日〜29日前、前の期間は30〜59日前',g[0]==='0,6,7,13,14,29'&&g[1]==='30,59',g);
  g=await got(90);expect('期間90日：今日〜89日前、前の期間は90〜179日前',g[0]==='0,6,7,13,14,29,30,59,60,89'&&g[1]==='90,179',g);
  r=await call('/api/admin/hits?days=30',{admin:'admin-secret-123'});expect('前の呼び方（cmp なし）は今までどおり期間の中だけ',!r[1].from&&r[1].rows.every(y=>y.day>=dd(29))&&r[1].rows.some(y=>y.k==='p:assist'),r[1]);
  /* 日本時間の0時で日付が変わる（世界時の15時） */
  const realNow=Date.now;try{
    Date.now=()=>Date.UTC(2031,0,1,14,59,59);await hit({e:'kd_done'});
    Date.now=()=>Date.UTC(2031,0,1,15,0,0);await hit({e:'kd_done'});await hit({e:'kd_done'});
  }finally{Date.now=realNow}
  const jr=(await env.DB.prepare(`SELECT day,n FROM page_hits WHERE k='e:kd_done' ORDER BY day`).all()).results.map(x=>x.day+':'+x.n).join();
  expect('日本時間の0時で日付が変わる',jr==='2031-01-01:1,2031-01-02:2',jr);
  await env.DB.prepare(`DELETE FROM page_hits WHERE day LIKE '2031-%' OR k='p:zz'`).run();
  r=await call('/api/admin/quota',{admin:'admin-secret-123'});expect('使用量は今までどおり読める',r[0]===200&&r[1].days,r[0]);}

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
/* プロフィールの写真（2026/11/03） */
r=await up(B,JPG);const av1=r[1].key;
r=await call('/api/me/avatar',{method:'POST',tok:A,body:{key:av1}});expect('写真：ほかの人の画像は使えない',r[0]===400,r);
r=await call('/api/me/avatar',{method:'POST',tok:B,body:{key:av1}});expect('写真：付けられる',r[0]===200&&r[1].user.av===av1,r);
r=await getM(av1);expect('写真：だれでも見られる',r[0]===200,r[0]);
r=await call('/api/u/'+(await call('/api/me',{tok:B}))[1].user.handle);expect('写真：プロフィールに出る',r[1].user.av===av1,r[1].user);
r=await call('/api/tl');expect('写真：投稿の一覧に出る',r[1].notes.some(n=>n.user.av===av1),r[1].notes.map(n=>n.user));
r=await up(B,JPG);const av2=r[1].key;r=await call('/api/me/avatar',{method:'POST',tok:B,body:{key:av2}});
r=await getM(av1,'admin-secret-123');expect('写真：変えると前の写真は消える',r[0]===404,r[0]);
r=await call('/api/me/avatar',{method:'POST',tok:B,body:{remove:true}});expect('写真：外せる',r[0]===200&&r[1].user.av===null,r);
r=await getM(av2);expect('写真：外した写真は見えない',r[0]===404,r[0]);
/* お問い合わせ・間違いの報告（2026/11/04） */
r=await call('/api/contact',{method:'POST',body:{kind:'data',body:'短い'}});expect('問い合わせ：短すぎるものは拒否',r[0]===400,r);
r=await call('/api/contact',{method:'POST',body:{kind:'data',body:'ガブリアスの素早さの種族値が違う気がします',page:'#/p/445',reply:'x@example.com'}});expect('問い合わせ：ログインなしで送れる',r[0]===200,r);
r=await call('/api/contact',{method:'POST',tok:A,body:{kind:'bug',body:'ボタンが押せません。iPhoneです'}});expect('問い合わせ：ログインしていても送れる',r[0]===200,r);
r=await call('/api/admin/contacts');expect('問い合わせ：一覧は管理者だけ',r[0]===401,r);
r=await call('/api/admin/contacts',{admin:'admin-secret-123'});
expect('問い合わせ：管理者は内容・画面・連絡先を見られる',r[0]===200&&r[1].unread===2&&r[1].contacts.some(x=>x.page==='#/p/445'&&x.reply==='x@example.com'&&x.kind==='data')&&r[1].contacts.some(x=>x.login),r[1]);
expect('問い合わせ：IPアドレスは返さない',!JSON.stringify(r[1]).includes('10.'),'');
{const id=r[1].contacts[0].id;await call('/api/admin/contacts',{method:'POST',admin:'admin-secret-123',body:{id,st:'done',note:'直した'}});
 r=await call('/api/admin/contacts',{admin:'admin-secret-123'});expect('問い合わせ：対応済みにできる',r[1].unread===1&&!r[1].contacts.some(x=>x.id===id),r[1])}
for(let i=0;i<6;i++)r=await call('/api/contact',{method:'POST',ip:'10.9.8.7',body:{kind:'other',body:'連続で送る試し'+i}});
expect('問い合わせ：1時間に5件まで',r[0]===429,r);
/* ランキングbot（rankbot.js） */
TIERJ.at=Date.now();
r=await call('/api/admin/rankbot',{method:'POST',body:{}});expect('ランキングbot：管理者だけ',r[0]===401,r);
r=await call('/api/admin/rankbot',{method:'POST',admin:'admin-secret-123',body:{}});expect('ランキングbot：投稿する',r[0]===200&&r[1].posted&&/Sランク：ガブリアス/.test(r[1].body)&&/#強いポケモンランキング/.test(r[1].body),r[1]);
r=await call('/api/admin/rankbot',{method:'POST',admin:'admin-secret-123',body:{}});expect('ランキングbot：同じ日は1回だけ',r[1].posted===false,r[1]);
TIERJ={...TIERJ,rows:[{no:445,name:'ガブリアス',tier:'A',u:1},{no:149,name:'カイリュー',tier:'S',u:2},{no:887,name:'ドラパルト',tier:'B',u:3}]};
r=await call('/api/admin/rankbot',{method:'POST',admin:'admin-secret-123',body:{force:true}});expect('ランキングbot：上がった・下がったを書く',r[1].posted&&/上がった：カイリュー（A→S）/.test(r[1].body)&&/下がった：ガブリアス（S→A）/.test(r[1].body)&&[...r[1].body].length<=140,r[1]);
r=await call('/api/tl');{const n=r[1].notes.find(x=>x.user.handle==='ranking_bot');expect('ランキングbot：タイムラインに出てランキングへのリンク',n&&/\/ranking\/$/.test(n.link),n)}
r=await call('/api/search?q='+encodeURIComponent('#強いポケモンランキング'));expect('ランキングbot：タグで探せる',r[1].notes.some(x=>x.user.handle==='ranking_bot'),r[1]);
TIERJ={...TIERJ,live:false};r=await call('/api/admin/rankbot',{method:'POST',admin:'admin-secret-123',body:{force:true}});expect('ランキングbot：集計がない日は投稿しない',r[1].posted===false,r[1]);
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
r=await call('/api/u/alice');expect('プロフィールに実績（確認済み）',r[1].user.results.length===1&&r[1].user.results[0].rank===12&&r[1].user.results[0].verified&&r[1].user.results[0].season==='シーズン1',r[1].user.results);
await call('/api/admin/seasons',{method:'POST',admin:ADM,body:{id:S1,name:'シーズン1',start:'2026-10-01',end:'2026-10-31',note:'運営者の解説\n2行目'}});
r=await call(`/api/seasons/${S1}/teams`);expect('運営者の解説が付く',r[1].season.note==='運営者の解説\n2行目',r[1].season);
r=await call(`/api/seasons/teams/${T1}/delete`,{method:'POST',tok:B,body:{}});expect('他人の登録は消せない',r[0]===404,r);
r=await call(`/api/seasons/teams/${T1}/delete`,{method:'POST',tok:A,body:{}});expect('自分の登録は消せる',r[0]===200,r);
r=await getM(pk,ADM);expect('登録を消すとスクショも消える',r[0]===404,r[0]);
r=await call('/api/admin/seasons',{method:'POST',admin:ADM,body:{id:S1,delete:true}});expect('パーティのあるシーズンは消せない',r[0]===400,r);
/* 記事から事実だけを集めて照らし合わせる（collect.js） */
r=await call('/api/admin/seasons',{method:'POST',admin:ADM,body:{name:'シーズン2',start:'2026-11-01',end:'2026-11-30'}});const S2=r[1].id;
r=await call('/api/admin/collect/source',{method:'POST',body:{season_id:S2,fmt:'single',url:'https://a.example/1'}});expect('自動集計は管理者だけ',r[0]===401,r);
r=await call('/api/admin/collect/source',{method:'POST',admin:ADM,body:{season_id:S2,fmt:'single',url:'javascript:alert(1)'}});expect('出典は https のアドレスだけ',r[0]===400,r);
for(const url of ['https://a.example/1','https://b.example/2','https://c.example/3'])await call('/api/admin/collect/source',{method:'POST',admin:ADM,body:{season_id:S2,fmt:'single',url}});
r=await call('/api/admin/collect/list',{method:'POST',body:{season_id:S2,fmt:'single',url:'https://note.com/hashtag/x'}});expect('一覧から拾うのも管理者だけ',r[0]===401,r);
r=await call('/api/admin/collect/list',{method:'POST',admin:ADM,body:{season_id:S2,fmt:'single',url:'https://note.com/hashtag/x'}});
expect('note のハッシュタグから、上位の結果らしい題名の記事だけを拾う',r[0]===200&&r[1].added===2&&r[1].scanned===3,r[1]);
r=await call('/api/admin/collect/list',{method:'POST',admin:ADM,body:{season_id:S2,fmt:'single',url:'https://note.com/kyo'}});
expect('note の書いた人のページからも拾う',r[0]===200&&r[1].added===1,r[1]);
r=await call('/api/admin/collect/list',{method:'POST',admin:ADM,body:{season_id:S2,fmt:'single',url:'https://note.com/search?q=x'}});
expect('note の検索のページは読めないと案内',r[0]===502&&/ハッシュタグ/.test(r[1].error),r[1]);
r=await call('/api/admin/collect/list',{method:'POST',admin:ADM,body:{season_id:S2,fmt:'single',url:'https://blog.example/list'}});
expect('ふつうのブログの一覧：同じサイトの記事だけ（ログイン・案内・よそは拾わない）',r[0]===200&&r[1].added===1,r[1]);
r=await call(`/api/admin/collect?season_id=${S2}&fmt=single`,{admin:ADM});
expect('拾った記事は題名つきで出典に入る',r[1].sources.some(s=>s.url==='https://note.com/taro/n/n0123456789ab'&&/最終12位/.test(s.title))&&r[1].sources.some(s=>s.url==='https://blog.example/archives/77'),r[1].sources.map(s=>[s.url,s.title]));
for(const s of r[1].sources.filter(s=>/note\.com|blog\.example/.test(s.url)))await call('/api/admin/collect/source',{method:'POST',admin:ADM,body:{season_id:S2,fmt:'single',id:s.id,delete:true}});
r=await call('/api/admin/collect/run',{method:'POST',admin:ADM,body:{season_id:S2,fmt:'single'}});
expect('集めて照らし合わせる：2つの出典で一致した1件だけ自動で載る',r[0]===200&&r[1].published===1&&r[1].pending===2,r[1]);
expect('違う形式のページは数えない',r[1].log.find(x=>x.url==='https://c.example/3').n===0,r[1].log);
r=await call(`/api/seasons/${S2}/teams?fmt=single`);const at=r[1].teams[0];
expect('自動で載ったパーティ：順位・出典2つ・6匹',r[1].teams.length===1&&at.auto&&at.rank===1&&at.sources.length===2&&at.team.length===6&&!at.verified,at);
expect('自動で載ったパーティ：持ち物も事実から',at.team.find(x=>x.no===445).set.it.k==='choicescarf',at.team);
r=await call(`/api/admin/collect?season_id=${S2}&fmt=single`,{admin:ADM});
expect('出典が1つだけのものは確認待ち（地方の姿の名前も読める）',r[1].pending.length===2&&r[1].pending.some(g=>g.player==='Solo'&&g.team.some(x=>x.no===10100)),r[1].pending.map(g=>[g.player,g.team.map(x=>x.no)]));
const hk=r[1].pending.find(g=>g.player==='Hanako').gkey,sk=r[1].pending.find(g=>g.player==='Solo').gkey;
await call('/api/admin/collect/decide',{method:'POST',admin:ADM,body:{season_id:S2,fmt:'single',gkey:hk,publish:true}});
await call('/api/admin/collect/decide',{method:'POST',admin:ADM,body:{season_id:S2,fmt:'single',gkey:sk,publish:false}});
r=await call(`/api/admin/collect?season_id=${S2}&fmt=single`,{admin:ADM});expect('確認待ちを載せる／載せないを決められる',r[1].pending.length===0,r[1].pending);
r=await call(`/api/seasons/${S2}/teams?fmt=single`);expect('運営者が載せたものも並ぶ',r[1].teams.length===2&&r[1].teams[1].player.name==='Hanako',r[1].teams.map(t=>t.player.name));
r=await call('/api/admin/collect/run',{method:'POST',admin:ADM,body:{season_id:S2,fmt:'single'}});
r=await call(`/api/seasons/${S2}/teams?fmt=single`);expect('集め直しても同じパーティは増えない',r[1].teams.length===2,r[1].teams.map(t=>t.player.name));
r=await call('/api/admin/collect/find',{method:'POST',admin:ADM,body:{season_id:S2,fmt:'double'}});expect('Google検索で出典を探す（変なアドレスは除く）',r[0]===200&&r[1].found===1,r);
r=await call(`/api/admin/collect?season_id=${S2}&fmt=double`,{admin:ADM});expect('見つけた出典が入る',r[1].sources.length===1&&r[1].sources[0].kind==='found',r[1].sources);
/* 選出画面のスクショから相手を読む（読むだけ。計算はスマホ側） */
const shot=async(t,bytes)=>{const h={'content-type':'image/jpeg'};if(t)h.authorization='Bearer '+t;const r=await w.fetch(new Request('https://x.dev/api/opp-read',{method:'POST',headers:h,body:bytes}),env,{waitUntil(){}});return[r.status,await r.json().catch(()=>({}))]};
r=await shot(null,JPG);expect('スクショ読み取りはログインが必要',r[0]===401,r);
r=await shot(A,new Uint8Array([1,2,3,...Array(300).fill(0)]));expect('画像でないものは拒否',r[0]===400,r);
r=await shot(A,JPG);expect('スクショから相手を読める（番号・自信）',r[0]===200&&r[1].opps.filter(o=>o.no).map(o=>o.no).join()==='445,149,1000'&&r[1].opps.find(o=>o.no===445).sure&&!r[1].opps.find(o=>o.no===1000).sure,r[1]);
/* AI が混み合っている・無料枠を使い切ったとき（2026/11/05）：busy を付けて返し、サイトは「タイプで探す」に案内する */
globalThis.GEM_BUSY=true;r=await shot(A,JPG);globalThis.GEM_BUSY=false;expect('AIが混み合っているときは busy を返す',r[0]===503&&r[1].busy===true,r);
/* 対戦の振り返り */
const fr=Array.from({length:4},(_,i)=>({t:i*3,d:'QUJD'+'A'.repeat(100)}));
r=await call('/api/replay-read',{method:'POST',body:{frames:fr}});expect('振り返り：ログインが必要',r[0]===401,r);
r=await call('/api/replay-read',{method:'POST',tok:B,body:{frames:fr.slice(0,1)}});expect('振り返り：静止画が少なすぎると拒否',r[0]===400,r);
r=await call('/api/replay-read',{method:'POST',tok:B,body:{frames:fr}});
expect('振り返り：動画の静止画から読み取る',r[0]===200&&r[1].opp.length===6&&r[1].opp[0]===445&&r[1].result==='win'&&r[1].opp_sel.join()==='445,1000'&&r[1].info[445].it==='choicescarf'&&r[1].info[445].mv.length===2,r[1]);
const rd=r[1];
r=await call('/api/battles',{method:'POST',tok:B,body:rd});expect('振り返り：記録できる',r[0]===200&&r[1].id>0,r);const bid=r[1].id;
r=await call('/api/battles',{tok:B});expect('振り返り：自分の記録だけ見える',r[1].battles.length===1&&r[1].battles[0].result==='win',r[1]);
r=await call('/api/battles',{tok:A});expect('振り返り：ほかの人の記録は見えない',r[1].battles.length===0,r[1]);
await call(`/api/battles/${bid}/delete`,{method:'POST',tok:B,body:{}});r=await call('/api/battles',{tok:B});expect('振り返り：消せる',r[1].battles.length===0,r[1]);
/* 当サイトの使用率：3人が同じ相手を記録すると集計に出る。保存した育成（写したものは数えない）も集計 */
{const opp6=[445,887,1000,6,149,248];
for(const t of [A,C,D])await call('/api/battles',{method:'POST',tok:t,body:{...rd,opp:opp6,fmt:'single',info:{445:{mv:[89],it:'choicescarf'}}}});
const tm=(no,s)=>({cur:0,list:[{name:'x',team:[{no,set:{it:{k:'choicescarf'},ab:{k:'roughskin'},mv:[{id:89},{id:200}],sp:[2,32,0,0,0,32],up:1,dn:3,src:s}}]}]});
for(const u of ['us1','us2','us3']){const t=await tok(u);await call('/api/me/teams',{method:'POST',tok:t,body:{teams:tm(445,'manual'),updated_at:Date.now()}});await call('/api/me/teams',{method:'POST',tok:await tok(u+'c'),body:{teams:tm(6,'copy'),updated_at:Date.now()}})}
r=await call('/api/usage?fmt=single',{});const g=r[1].seen.find(x=>x[0]===445);
expect('使用率：3人が見た相手が集計に出る',r[0]===200&&r[1].previews>=3&&g&&g[2]>0,r[1]);
const b=r[1].builds[445];expect('使用率：育成の集計（写した型は数えない）',b&&b.it[0][0]==='choicescarf'&&b.mv[0][0]===89&&!r[1].builds[6],r[1].builds);
r=await call('/api/usage?fmt=double',{});expect('使用率：形式ごとに分かれる',r[1].previews===0,r[1]);}
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
/* 戦術メモ（2026/11/06）：本人だけが保存・読み出しできる */
r=await call('/api/me/memo',{method:'POST',body:{memo:{mon:{445:{t:'x',at:1}}}}});expect('メモはログインが必要',r[0]===401||r[0]===503,r);
r=await call('/api/me/memo',{method:'POST',tok:A,body:{memo:{mon:{445:{t:'上から殴る',at:5},'bad':{t:'x',at:1}},type:{'はがね':{t:'ほのおを残す',at:6}}}}});
r=await call('/api/me/memo',{tok:A});expect('メモを読み出せる（変な番号は捨てる）',r[0]===200&&r[1].memo.mon[445].t==='上から殴る'&&!r[1].memo.mon.bad&&r[1].memo.type['はがね'].t==='ほのおを残す',r[1]);
r=await call('/api/me/memo',{method:'POST',tok:A,body:{memo:{mon:{},type:{},party:{'0':{s:{win:'プランA：積んで全抜き',zzz:'x'},at:7},'9':{s:{win:'x'},at:1}}}}});
r=await call('/api/me/memo',{tok:A});expect('パーティの戦術メモを読み出せる（知らない項目・枠は捨てる）',r[0]===200&&r[1].memo.party['0'].s.win==='プランA：積んで全抜き'&&!r[1].memo.party['0'].s.zzz&&!r[1].memo.party['9'],r[1]);
r=await call('/api/me/memo',{tok:B});expect('ほかの人のメモは見えない',r[0]===200&&!(r[1].memo&&r[1].memo.mon&&r[1].memo.mon[445]),r[1]);
/* 使用量（2026/11/05）：AI を呼んだ回数・断られた回数が数えられ、管理者だけが見られる */
r=await call('/api/admin/quota');expect('使用量は管理者だけ',r[0]===401,r);
r=await call('/api/admin/quota',{admin:'admin-secret-123'});
/* テストは時計を先に進めて記録するので、日本時間の0時の直前に動くと、記録の日付が「今日」より1日先になる（2026/11/12 公開で失敗）。いちばん新しい日で見る */
{const dk=Object.keys(r[1].days||{}).sort().pop(),d=dk&&r[1].days[dk]||{};expect('使用量：AIの回数と断られた回数',r[0]===200&&d.ai>=1&&d.ai_ng>=1&&typeof r[1].opp_reads==='number',r[1]);}
/* セキュリティ対策（2026/11/05）：管理用の合言葉の総当たり。同じ接続元から8回まちがえると、正しい合言葉でも1時間止まる。ほかの接続元は使える */
for(let i=0;i<8;i++)await call('/api/admin/banned',{admin:'wrong-token-'+i,ip:'198.51.100.7'});
r=await call('/api/admin/banned',{admin:'admin-secret-123',ip:'198.51.100.7'});expect('合言葉の総当たりで止まる',r[0]===429,r);
r=await call('/api/admin/banned',{admin:'admin-secret-123',ip:'198.51.100.8'});expect('ほかの接続元は管理機能を使える',r[0]===200,r);
r=await call('/api/me/card',{method:'POST',body:{partner:445}});expect('ログインしないとカードを保存できない',r[0]===401||r[0]===503,r);
/* メッセージ（DM）と非公開アカウント（2026/11/11） */
{clock=realNow()+6e5;Date.now=()=>clock;const E=await tok('userE'),F=await tok('userF'),G=await tok('userG'),H=await tok('userH');
for(const [t,h] of [[E,'eve'],[F,'frank'],[G,'gina'],[H,'hana']]){r=await call('/api/me',{method:'POST',tok:t,body:{handle:h,name:h.toUpperCase(),agree:true}});expect('プロフィール作成 '+h,r[0]===200,r)}
r=await call('/api/dm');expect('ログインなしではメッセージを読めない',r[0]===401||r[0]===503,r);
r=await call('/api/me/private',{method:'POST',tok:F,body:{on:true}});expect('非公開アカウントにできる',r[0]===200&&r[1].private===true,r);
r=await call('/api/me',{tok:F});expect('自分のプロフィールに非公開の印',r[1].user&&r[1].user.private===true,r);
tick();r=await call('/api/notes',{method:'POST',tok:F,body:{body:'鍵の中の投稿'}});const fn=r[1].id;
r=await call('/api/u/frank',{tok:E});expect('非公開の人のプロフィール（locked）',r[0]===200&&r[1].user.private&&r[1].user.locked&&!r[1].user.followed,r[1].user);
r=await call('/api/u/frank/notes',{tok:E});expect('許可されていない人には投稿を見せない',r[1].locked&&r[1].notes.length===0,r[1]);
r=await call('/api/tl',{tok:E});expect('みんなのタイムラインにも出さない',!r[1].notes.some(x=>x.id===fn),'');
r=await call('/api/notes/'+fn,{tok:E});expect('1件を読むのも不可',r[0]===404,r);
r=await call('/api/dm/with/frank',{tok:E});expect('非公開の相手には送れない（理由つき）',r[0]===200&&r[1].can===false&&r[1].reason==='このユーザーは非公開アカウントのためメッセージを送信できません',r[1]);
r=await call('/api/dm/send',{method:'POST',tok:E,body:{to:'frank',body:'こんにちは'}});expect('送信もサーバーで断る',r[0]===403&&r[1].locked,r);
r=await call('/api/follow',{method:'POST',tok:E,body:{handle:'frank'}});expect('非公開の人へのフォローはリクエストになる',r[0]===200&&r[1].requested&&!r[1].followed&&r[1].followers===0,r);
r=await call('/api/u/frank',{tok:E});expect('リクエスト中',r[1].user.requested&&r[1].user.locked,r[1].user);
r=await call('/api/dm/send',{method:'POST',tok:E,body:{to:'frank',body:'こんにちは'}});expect('リクエスト中はまだ送れない',r[0]===403,r);
r=await call('/api/notifs',{tok:F});expect('リクエストがお知らせに届く',r[1].notifs.some(x=>x.kind==='freq'&&x.user.handle==='eve'),r[1]);
r=await call('/api/follow/answer',{method:'POST',tok:E,body:{handle:'frank',ok:true}});expect('ほかの人は答えられない',r[0]===404,r);
r=await call('/api/follow/answer',{method:'POST',tok:F,body:{handle:'eve',ok:true}});expect('リクエストを許可',r[0]===200&&r[1].accepted,r);
r=await call('/api/u/frank',{tok:E});expect('許可されるとフォロー',r[1].user.followed&&!r[1].user.locked&&r[1].user.followers===1,r[1].user);
r=await call('/api/u/frank/notes',{tok:E});expect('許可されると投稿が見える',r[1].notes.some(x=>x.id===fn),r[1]);
r=await call('/api/notifs',{tok:E});expect('許可のお知らせ',r[1].notifs.some(x=>x.kind==='facc'&&x.user.handle==='frank'),r[1]);
r=await call('/api/dm/send',{method:'POST',tok:E,body:{to:'frank',body:'許可ありがとう'}});expect('許可されたフォロワーは送れる',r[0]===200&&r[1].conv>0,r);const cv=r[1].conv;
for(const bad of ['ディスコやってる？','d i s c o r d で話そう','LINE交換しよう','らいん教えて','見て https://example.com','abc.xyz に来て','@taro_123 で探して','IDは abc123','メールは a@b.jp','09012345678','090-1234-5678','ツイッターやってる？','インスタ見て']){
  tick(3e3);r=await call('/api/dm/send',{method:'POST',tok:E,body:{to:'frank',body:bad}});expect('外部への誘導を止める：'+bad,r[0]===400&&r[1].outside,r)}
for(const ok of ['オンラインで対戦しよう','ガブリアスの型どうしてる？','1.5倍になるよ','HP 252振り']){
  tick(3e3);r=await call('/api/dm/send',{method:'POST',tok:E,body:{to:'frank',body:ok}});expect('ふつうの文は送れる：'+ok,r[0]===200,r)}
r=await call('/api/dm/send',{method:'POST',tok:E,body:{to:'frank',body:'すぐ次'}});expect('連続の送信は少しあける',r[0]===429,r);
r=await call('/api/dm/unread',{tok:F});expect('読んでいない数',r[1].unread===5,r[1]);
r=await call('/api/dm',{tok:F});expect('会話の一覧（個人）',r[1].convs.length===1&&r[1].convs[0].members[0].handle==='eve'&&r[1].convs[0].unread===5,r[1]);
r=await call('/api/dm/with/eve',{tok:F});expect('会話を開く（古い順・既読になる）',r[1].can&&r[1].msgs.length===5&&r[1].msgs[0].body==='許可ありがとう'&&!r[1].msgs[0].mine,r[1]);
r=await call('/api/dm/unread',{tok:F});expect('開くと既読',r[1].unread===0,r[1]);
tick(3e3);r=await call('/api/dm/send',{method:'POST',tok:F,body:{conv:cv,body:'どういたしまして'}});expect('非公開の本人は返事できる',r[0]===200&&r[1].conv===cv,r);
r=await call('/api/dm/with/eve?after='+r[1].msg.id,{tok:F});expect('続きだけ読む',r[1].msgs.length===0,r[1]);
r=await call('/api/dm/'+cv,{tok:G});expect('会話に入っていない人は読めない',r[0]===404,r);
r=await call('/api/dm/send',{method:'POST',tok:G,body:{conv:cv,body:'のぞき'}});expect('会話に入っていない人は送れない',r[0]===404,r);
/* 相手が非公開の人をフォローしている（こちらから頼んでいない）なら送れる */
r=await call('/api/follow',{method:'POST',tok:F,body:{handle:'gina'}});
r=await call('/api/dm/with/frank',{tok:G});expect('非公開の人にフォローされていれば送れる',r[1].can===true,r[1]);
/* グループ */
tick(3e3);r=await call('/api/dm/group',{method:'POST',tok:E,body:{title:'構築相談',handles:['gina','hana']}});expect('グループを作る',r[0]===200&&r[1].conv>0,r);const gc=r[1].conv;
r=await call('/api/dm/group',{method:'POST',tok:G,body:{title:'x',handles:['eve','frank']}});expect('グループでも非公開の人は入れられない（フォロー関係があれば可）',r[0]===200,r);
r=await call('/api/dm/group',{method:'POST',tok:H,body:{title:'x',handles:['frank']}});expect('関係のない非公開の人はグループに入れられない',r[0]===403&&r[1].locked,r);
tick(3e3);r=await call('/api/dm/send',{method:'POST',tok:G,body:{conv:gc,body:'よろしく'}});expect('グループで送れる',r[0]===200,r);
r=await call('/api/dm?kind=group',{tok:H});expect('グループの一覧',r[1].convs.some(c=>c.id===gc&&c.title==='構築相談'&&c.n===3),r[1]);
r=await call('/api/dm/'+gc,{tok:H});expect('グループを開く',r[1].conv.title==='構築相談'&&r[1].conv.members.length===2&&r[1].msgs.some(x=>x.body==='よろしく'&&x.user.handle==='gina'),r[1]);
r=await call('/api/dm?kind=dm',{tok:H});expect('個人の一覧にはグループを出さない',r[1].convs.length===0,r[1]);
r=await call('/api/dm/'+gc+'/leave',{method:'POST',tok:H});r=await call('/api/dm/'+gc,{tok:H});expect('抜けると読めない',r[0]===404,r);
/* フォロー中・フォロワーの一覧、リクエストの一覧（2026/11/11） */
r=await call('/api/u/frank/follows?kind=followers',{tok:G});expect('鍵垢のフォロワー一覧は許可されていない人には見せない',r[1].locked===true&&r[1].users.length===0,r[1]);
r=await call('/api/u/frank/follows?kind=followers',{tok:E});expect('許可されたフォロワーは一覧を見られる',!r[1].locked&&r[1].users.some(x=>x.handle==='eve'&&x.me),r[1]);
r=await call('/api/u/frank/follows?kind=following',{tok:F});expect('本人はフォロー中を見られる（相手の状態つき）',r[1].users.some(x=>x.handle==='gina'&&x.followed===true&&x.follows_me===false),r[1]);
r=await call('/api/u/gina/follows?kind=followers');expect('公開アカウントの一覧はログインなしでも見られる',r[0]===200&&r[1].users.some(x=>x.handle==='frank'),r[1]);
tick(3e3);r=await call('/api/follow',{method:'POST',tok:G,body:{handle:'frank'}});
r=await call('/api/follow/requests',{tok:F});expect('届いたリクエストの一覧',r[0]===200&&r[1].incoming.some(x=>x.handle==='gina')&&!r[1].incoming.some(x=>x.handle==='eve'),r[1]);
r=await call('/api/follow/requests',{tok:G});expect('送ったリクエストの一覧',r[1].sent.some(x=>x.handle==='frank'),r[1]);
r=await call('/api/notifs/count',{tok:F});expect('お知らせの数にリクエストの数',r[1].requests===1,r[1]);
r=await call('/api/u/frank/follows?kind=followers',{tok:F});expect('リクエスト中の人はフォロワーに出ない',!r[1].users.some(x=>x.handle==='gina'),r[1]);
r=await call('/api/follow/answer',{method:'POST',tok:F,body:{handle:'gina',ok:false}});
r=await call('/api/follow/requests',{tok:F});expect('断るとリクエストの一覧から消える',r[1].incoming.length===0,r[1]);
r=await call('/api/follow/requests');expect('リクエストの一覧はログインが必要',r[0]===401,r);
/* 公開に戻すとリクエストは許可になる */
r=await call('/api/follow',{method:'POST',tok:H,body:{handle:'frank'}});expect('リクエスト',r[1].requested,r);
r=await call('/api/me/private',{method:'POST',tok:F,body:{on:false}});
r=await call('/api/u/frank',{tok:H});expect('公開に戻すと待っていたリクエストが許可される',r[1].user.followed&&!r[1].user.private,r[1].user);
/* アカウントを消すと会話も消える */
r=await call('/api/me/delete',{method:'POST',tok:E,body:{confirm:'DELETE'}});
r=await call('/api/dm',{tok:F});expect('消した人との会話は消える',r[0]===200&&r[1].convs.length===0,[r[0],r[1]]);
r=await call('/api/dm/'+gc,{tok:G});expect('グループのその人のメッセージは消える',r[0]===200&&!r[1].msgs.some(x=>x.user&&x.user.handle==='eve'),r[1]);
Date.now=realNow;}
console.log(bad?`social: NG（${bad}件）`:`social: OK（${n}項目）`);if(bad)process.exitCode=1;
