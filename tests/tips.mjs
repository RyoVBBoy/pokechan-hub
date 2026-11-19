// 運営の「Game Kid/s Tips」アカウント（worker/src/tips.js・src/js/85-tips.js、2026/11/16 第1段階：画像だけ）の確認
// A. サーバー：アカウントと「運営」の札・なりすまし・運営者だけが投稿・画像の確かめと上限・通報で自動に隠さない・bot へのメッセージ・ふつうの投稿の決まりが前のまま・操作の記録
// B. 画面：ツールの画面の入口（使い方のカードを閉じても出る）・「運営」の札は off のときだけ・「〇〇を開く」で移れる・管理画面の Tips タブ
import path from 'node:path';
import {makeD1} from './d1mock.mjs';
import {chromium} from 'playwright';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
let n=0;const ok=(c,m,x)=>{n++;if(!c){console.error('NG',m,x===undefined?'':JSON.stringify(x).slice(0,500));process.exitCode=1}};
const PID='pokechan-test',ADMIN='admin-secret-123';
const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const kp=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...(await crypto.subtle.exportKey('jwk',kp.publicKey)),kid:'k1',use:'sig',alg:'RS256'},now=Math.floor(Date.now()/1000);
const tok=async uid=>{const h=enc({alg:'RS256',kid:'k1',typ:'JWT'}),p=enc({iss:'https://securetoken.google.com/'+PID,aud:PID,sub:uid,iat:now-10,exp:now+3600,auth_time:now-10,email:uid+'@example.com'});
  return h+'.'+p+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',kp.privateKey,new TextEncoder().encode(h+'.'+p))).toString('base64url')};
globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
globalThis.fetch=async u=>{u=String(u);if(u.includes('securetoken@system.gserviceaccount.com'))return new Response(JSON.stringify({keys:[jwk]}));return new Response('',{status:404})};
const w=(await import(path.join(ROOT,'worker/dist/worker.js'))).default;
const env={DB:makeD1(),FIREBASE_PROJECT_ID:PID,APP_TOKEN:'t',ADMIN_TOKEN:ADMIN};
let ip=0;
const call=async(p,{method='GET',tok:t,body,admin,raw,ctype,fixIp}={})=>{const h={'cf-connecting-ip':fixIp||('10.3.'+((++ip>>8)%250)+'.'+(ip%250))};if(!raw)h['content-type']='application/json';if(ctype)h['content-type']=ctype;
  if(t)h.authorization='Bearer '+t;if(admin)h['x-admin-token']=admin;
  const r=await w.fetch(new Request('https://x.dev'+p,{method,headers:h,body:raw?raw:body?JSON.stringify(body):undefined}),env,{waitUntil(){}});return[r.status,await r.json().catch(()=>({}))]};
const png=(n=64)=>{const b=new Uint8Array(n);b.set([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);return b};
const upload=(buf,admin=ADMIN,t)=>call('/api/admin/tips/media?w=10&h=10',{method:'POST',raw:buf,ctype:'image/png',admin,tok:t});
const mkUser=async(uid,handle,name='トレーナー')=>{const t=await tok(uid);const r=await call('/api/me',{method:'POST',tok:t,body:{handle,name,agree:true}});return[t,r]};

/* ---------- 準備：ふつうの利用者 ---------- */
const [ta,ra]=await mkUser('ua','alice','アリス');ok(ra[0]===200,'利用者を作れる',ra);
const [tb]=await mkUser('ub','bobby','ボブ');const [tc]=await mkUser('uc','carol','キャロル');const [td]=await mkUser('ud','dave_x','デイブ');

/* ---------- 1. 運営者だけが使える ---------- */
let r=await call('/api/admin/tips');ok(r[0]===401,'合言葉なしでは Tips の管理を開けない',r);
r=await call('/api/admin/tips',{admin:'wrong-secret-xyz'});ok(r[0]===401,'違う合言葉では開けない',r);
r=await call('/api/admin/tips',{tok:ta});ok(r[0]===401,'ログインしているだけの利用者は開けない',r);
r=await call('/api/admin/tips/post',{method:'POST',tok:ta,body:{tool:'calc',body:'x'}});ok(r[0]===401,'利用者は Tips を投稿できない',r);
r=await upload(png(),null,ta);ok(r[0]===401,'利用者は Tips の画像を送れない',r);
r=await call('/api/admin/tips',{admin:ADMIN});ok(r[0]===200&&r[1].user.handle==='gamekids_tips'&&r[1].tools.includes('calc'),'運営者は開ける（アカウントができる）',r);

/* ---------- 2. アカウントと「運営」の札（サーバーが uid で決める） ---------- */
r=await call('/api/u/gamekids_tips');ok(r[0]===200&&r[1].user.off===true&&r[1].user.name==='Game Kid/s Tips','運営のアカウントのプロフィールに「運営」の印',r[1].user);
r=await call('/api/u/alice');ok(r[0]===200&&!('off' in r[1].user),'ふつうの利用者には「運営」の印がない',r[1].user);
/* ログインでは bot: のアカウントになれない：同じ ID を取ろうとしても止まる */
r=await call('/api/me',{method:'POST',tok:await tok('evil1'),body:{handle:'gamekids_tips',name:'たろう',agree:true}});ok(r[0]===400||r[0]===409,'運営の ID は取れない',r);

/* ---------- 3. なりすましを止める（ID・表示名） ---------- */
for(const h of ['gamekids','GameKids_2','g4mekids','gamekid_tip','tips']){r=await call('/api/me',{method:'POST',tok:await tok('ev_'+h),body:{handle:h,name:'たろう',agree:true}});ok(r[0]===400,'紛らわしい ID は使えない：'+h,r)}
for(const nm of ['Game Kid/s Tips','ｇａｍｅ　ｋｉｄｓ','G4me-K1ds','ゲーム キッズ','運営チーム','公式']){r=await call('/api/me',{method:'POST',tok:await tok('en_'+nm.length+nm.charCodeAt(0)),body:{handle:'nm'+(1000+nm.length*7+nm.charCodeAt(0)%97),name:nm,agree:true}});ok(r[0]===400,'紛らわしい表示名は使えない：'+nm,r)}
r=await call('/api/me',{method:'POST',tok:ta,body:{handle:'alice',name:'Game Kids',agree:true}});ok(r[0]===400,'あとから紛らわしい名前に変えることもできない',r);
/* 名前の決まりの見直し（2026/11/16）：見た目の似た文字・見えない文字・カナの書きかえ・括弧の札も止め、ふつうの名前は止めない */
{let k=0;const tryName=async nm=>{k++;return call('/api/me',{method:'POST',tok:await tok('nmx'+k),body:{handle:'nmx_'+k,name:nm,agree:true}})};
  for(const nm of ['Gаme Kids','Ga\u200Bme Kids','ｹﾞｰﾑｷｯｽﾞ','げーむきっず','運営アカウント','公式アカウント','サイト運営','【公式】たろう','[運営] はなこ','Tips運営','公式Tips','運 営']){const q=await tryName(nm);ok(q[0]===400,'紛らわしい表示名は使えない：'+JSON.stringify(nm),q)}
  for(const nm of ['大会運営のたろう','公式戦が好き','ポケモン公式ファン','運営さんありがとう','元運営スタッフの山田','ゲームが好きなキッズ','Tips好き','Kids Gamer']){const q=await tryName(nm);ok(q[0]===200,'ふつうの表示名は使える：'+nm,q)}
  for(const h of ['GAMEKIDS','gamek1ds_x','gam3kids','x_gamekid']){const q=await call('/api/me',{method:'POST',tok:await tok('idx_'+h),body:{handle:h,name:'たろう',agree:true}});ok(q[0]===400,'見た目の似た ID は使えない：'+h,q)}}
for(const [h,nm] of [['gamer_kid','Gamer Kidd'],['tipster','たろう'],['my_tips','Games Kid']]){r=await call('/api/me',{method:'POST',tok:await tok('okn_'+h),body:{handle:h,name:nm,agree:true}});ok(r[0]===200,'ふつうの ID・名前は今までどおり使える：'+h+'/'+nm,r)}
r=await call('/api/me',{method:'POST',tok:ta,body:{handle:'alice',name:'アリス',agree:true}});ok(r[0]===200,'今の名前のまま保存できる',r);

/* ---------- 4. 画像：種類・大きさ・枚数・1日の上限（サーバーで確かめる） ---------- */
r=await upload(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'));ok(r[0]===400,'画像でない中身（SVG）は受け付けない',r);
r=await upload(new TextEncoder().encode('GIF89a......'));ok(r[0]===400,'JPEG・PNG・WebP 以外は受け付けない',r);
r=await upload(png(1.3e6));ok(r[0]===413,'1.2MB より大きい画像は受け付けない',r);
const keys=[];for(let i=0;i<5;i++){r=await upload(png());ok(r[0]===200&&/^[0-9a-f]{32}$/.test(r[1].key),'PNG を送れる '+i,r);keys.push(r[1].key)}
/* ほかの人の画像は Tips に付けられない */
const ub=await w.fetch(new Request('https://x.dev/api/media?w=5&h=5',{method:'POST',headers:{authorization:'Bearer '+tb,'content-type':'image/png','cf-connecting-ip':'10.9.9.9'},body:png()}),env,{waitUntil(){}});
const bobKey=(await ub.json()).key;ok(ub.status===200&&bobKey,'（利用者の画像は今までどおり送れる）');

/* ---------- 5. Tips を投稿する ---------- */
const post=b=>call('/api/admin/tips/post',{method:'POST',admin:ADMIN,body:b});
r=await post({body:'ダメージ計算の使い方',media:[]});ok(r[0]===400,'ツールを選ばないと投稿できない',r);
r=await post({tool:'javascript:alert(1)',body:'x'});ok(r[0]===400,'表にないツールは投稿できない',r);
r=await post({tool:'calc',body:'  '});ok(r[0]===400,'本文が空なら投稿できない',r);
r=await post({tool:'calc',body:'あ'.repeat(141)});ok(r[0]===400,'141文字は投稿できない',r);
r=await post({tool:'calc',body:'x',media:keys.slice(0,5)});ok(r[0]===400,'画像5枚は投稿できない',r);
r=await post({tool:'calc',body:'x',media:[bobKey]});ok(r[0]===400,'ほかの人の画像は付けられない',r);
r=await post({tool:'calc',body:'x',media:['0'.repeat(32)]});ok(r[0]===400,'ない画像は付けられない',r);
r=await post({tool:'calc',body:'「攻撃する」「受ける」を押して選ぶと、すぐ下にダメージが出ます #ダメージ計算',media:keys.slice(0,4)});
ok(r[0]===200&&r[1].id>0,'ツール・本文・画像4枚で投稿できる',r);const tipId=r[1].id;
r=await post({tool:'calc',body:'同じ画像をもう一度',media:[keys[0]]});ok(r[0]===400,'ほかの投稿に付いた画像は使い回せない',r);
const tipImgId=(await post({tool:'dex',body:'図鑑は名前で探せます',media:[keys[4]]}))[1].id;ok(tipImgId>0,'2つ目の Tips（画像1枚）');
/* タイムライン・1件の表示で、運営の札とツールが付く */
r=await call('/api/notes/'+tipId);const tn=(r[1].note||r[1].notes&&r[1].notes[0]||r[1]);
r=await call('/api/tl');const tl=r[1].notes.find(x=>x.id===tipId);
ok(tl&&tl.user.off===true&&tl.tool==='calc'&&tl.media.length===4&&tl.user.handle==='gamekids_tips','タイムラインの Tips に「運営」の札・ツール・画像4枚',tl);
r=await call('/api/search?q='+encodeURIComponent('#Tips'));ok(r[0]===200&&JSON.stringify(r[1]).includes('"id":'+tipId),'#Tips のタグで探せる',r[1]);

/* ---------- 6. ふつうの利用者の投稿は前のまま（札もツールも付かない・付けられない） ---------- */
r=await call('/api/notes',{method:'POST',tok:ta,body:{body:'ふつうの投稿です',tool:'calc',off:true}});ok(r[0]===200,'ふつうの投稿ができる',r);
r=await call('/api/tl');const un=r[1].notes.find(x=>x.user.handle==='alice');
ok(un&&!un.user.off&&!('tool' in un),'ふつうの投稿には「運営」の札もツールも付かない（送っても無視）',un);
r=await call('/api/notes',{method:'POST',tok:ta,body:{body:'あ'.repeat(141)}});ok(r[0]===400,'ふつうの投稿の140文字の上限は前のまま',r);
r=await call('/api/notes',{method:'POST',tok:ta,body:{body:'つづけて'}});ok(r[0]===400,'ふつうの投稿の15秒の間隔は前のまま',r);

/* ---------- 7. 通報：Tips は自動で隠さない・管理画面の通報に並ぶ。ふつうの投稿は前のまま ---------- */
for(const t of [tb,tc,td]){r=await call(`/api/notes/${tipId}/report`,{method:'POST',tok:t,body:{reason:'その他'}});ok(r[0]===200&&r[1].review===true,'Tips を通報できる（確認待ちとして受け付け）',r)}
r=await call('/api/tl');const tl2=r[1].notes.find(x=>x.id===tipId);
ok(tl2&&tl2.media.length===4&&!tl2.media_hidden,'通報3件でも Tips の画像も投稿も自動では隠れない',tl2);
r=await call('/api/admin/reports',{admin:ADMIN});const rep=r[1].reports.find(x=>x.kind==='note'&&x.target===tipId);
ok(rep&&rep.n===3&&rep.aid==='@gamekids_tips','Tips の通報は管理画面の「通報」に並ぶ（運営者が確かめる）',rep);
r=await call('/api/admin/tips',{admin:ADMIN});ok(r[1].notes.find(x=>x.id===tipId).reports===3,'Tips の管理画面にも通報の数が出る');
/* ふつうの画像つき投稿：通報1件で画像が確認待ち（前のまま） */
const ua=await w.fetch(new Request('https://x.dev/api/media?w=5&h=5',{method:'POST',headers:{authorization:'Bearer '+tc,'content-type':'image/png','cf-connecting-ip':'10.9.9.8'},body:png()}),env,{waitUntil(){}});
const ck=(await ua.json()).key;r=await call('/api/notes',{method:'POST',tok:tc,body:{body:'画像つき',media:[ck]}});const cid=r[1].id||(r[1].note&&r[1].note.id);
r=await call('/api/tl');const cn=r[1].notes.find(x=>x.user.handle==='carol'&&x.body==='画像つき');
r=await call(`/api/notes/${cn.id}/report`,{method:'POST',tok:ta,body:{reason:'その他'}});
r=await call('/api/tl');const cn2=r[1].notes.find(x=>x.id===cn.id);ok(cn2&&cn2.media.length===0&&cn2.media_hidden===1,'ふつうの画像つき投稿は通報1件で画像が確認待ち（前のまま）',cn2);
for(const t of [tb,td])await call(`/api/notes/${cn.id}/report`,{method:'POST',tok:t,body:{reason:'その他'}});
r=await call('/api/tl');ok(!r[1].notes.find(x=>x.id===cn.id),'ふつうの投稿は通報3件で非表示（前のまま）');

/* ---------- 8. bot のアカウントにはメッセージを送れない ---------- */
r=await call('/api/dm/with/gamekids_tips',{tok:ta});ok(r[0]===200&&r[1].can===false&&/送れません/.test(r[1].reason||''),'運営のアカウントとの会話は「送れない」と出る',r[1]);
r=await call('/api/dm/send',{method:'POST',tok:ta,body:{to:'gamekids_tips',body:'こんにちは'}});ok(r[0]===403,'運営のアカウントにメッセージを送れない',r);
r=await call('/api/dm/group',{method:'POST',tok:ta,body:{title:'なかま',handles:['bobby','gamekids_tips']}});ok(r[0]===403,'グループにも運営のアカウントを入れられない',r);
await call('/api/admin/news/post',{method:'POST',admin:ADMIN,body:{url:'https://www.pokemonchampions.jp/ja/news/1',title:'テスト'}});
r=await call('/api/dm/send',{method:'POST',tok:ta,body:{to:'news_bot',body:'こんにちは'}});ok(r[0]===403,'お知らせbot など、ほかの bot にも送れない',r);
r=await call('/api/dm/send',{method:'POST',tok:ta,body:{to:'bobby',body:'こんにちは'}});ok(r[0]===200,'ふつうの利用者には今までどおり送れる',r);

/* ---------- 9. 取り消し・操作の記録（合言葉は残さない） ---------- */
r=await call('/api/admin/tips/hide',{method:'POST',admin:ADMIN,body:{id:tipImgId}});ok(r[0]===200,'Tips を非表示にできる',r);
r=await call('/api/tl');ok(!r[1].notes.find(x=>x.id===tipImgId),'非表示にした Tips はタイムラインに出ない');
r=await call('/api/admin/tips/hide',{method:'POST',admin:ADMIN,body:{id:cn.id}});ok(r[0]===404,'Tips 以外の投稿はこの操作で変えられない',r);
r=await call('/api/admin/tips',{admin:ADMIN});const log=r[1].log;
ok(['tips_post','tips_hide','tips_media'].every(a=>log.some(l=>l.action===a))&&log.every(l=>/^[0-9a-f]{16}$/.test(l.who)),'運営者の操作（画像・投稿・非表示）が記録される（接続元は番号だけ）',log.slice(0,4));
ok(!JSON.stringify(log).includes(ADMIN),'記録に合言葉は残らない');

/* ---------- 11. 見直しで見つけたこと・別の入口（2026/11/16 セキュリティの見直し） ---------- */
/* ① 前から @gamekids_tips を使っている人がいたら、Tips のアカウントを用意せず止める（黙って続けない）。
   （サーバーは表を作ったことを覚えるので、同じ DB で「運営の行を一度どけて、ほかの人がその ID を持っている」状態を作り、あとで戻す） */
{const db=env.DB;
  await db.prepare(`UPDATE users SET handle='gk_moved_tmp' WHERE uid='bot:tips'`).run();
  await db.prepare(`DELETE FROM users WHERE uid='bot:tips'`).run();
  await db.prepare(`INSERT INTO users(uid,handle,name,bio,created_at,updated_at,agreed_at) VALUES('squatter','GameKids_Tips','Game Kid/s Tips','',1,1,1)`).run();
  let q=await call('/api/admin/tips',{admin:ADMIN});ok(q[0]===409&&q[1].taken,'前から ID を使っている人がいると、Tips のアカウントを用意せず止める',q);
  q=await call('/api/admin/tips/post',{method:'POST',admin:ADMIN,body:{tool:'calc',body:'x'}});ok(q[0]===409,'そのときは投稿もしない',q);
  q=await upload(png());ok(q[0]===409,'画像も受け取らない',q);
  q=await call('/api/u/gamekids_tips');ok(q[0]===200&&!q[1].user.off,'その人のプロフィールに「運営」の印は付かない',q[1].user);
  const row=await db.prepare(`SELECT handle FROM users WHERE uid='squatter'`).first();ok(row.handle==='GameKids_Tips','ほかの人の ID は勝手に変えない',row);
  await db.prepare(`DELETE FROM users WHERE uid='squatter'`).run();
  q=await call('/api/admin/tips',{admin:ADMIN});ok(q[0]===200,'ID が空けば、運営のアカウントをまた用意できる',q)}
/* ② 合言葉の総当たり：Tips の入口でまちがえても数え、8回で正しい合言葉も1時間止める */
{const env3={DB:makeD1(),FIREBASE_PROJECT_ID:PID,APP_TOKEN:'t',ADMIN_TOKEN:ADMIN};
  const c3=async(p,o={})=>{const h={'cf-connecting-ip':'10.8.8.8','content-type':o.ctype||'application/json'};if(o.admin)h['x-admin-token']=o.admin;
    const r=await w.fetch(new Request('https://x.dev'+p,{method:o.method||'GET',headers:h,body:o.raw?o.raw:o.body?JSON.stringify(o.body):undefined}),env3,{waitUntil(){}});return[r.status,await r.json().catch(()=>({}))]};
  for(let i=0;i<8;i++)await c3(i%2?'/api/admin/tips/post':'/api/admin/tips/media',{method:'POST',admin:'wrong-secret-'+i,raw:i%2?undefined:png(),body:i%2?{tool:'calc',body:'x'}:undefined,ctype:i%2?undefined:'image/png'});
  const q=await c3('/api/admin/tips',{admin:ADMIN});ok(q[0]===429,'Tips の入口で8回まちがえると、正しい合言葉でも止まる',q)}
/* ③ 画像の見え方：投稿前の画像は運営者だけ・投稿したら見える・非表示にしたら見えない */
{const k=(await upload(png()))[1].key;
  const get=async(adm)=>{const h={};if(adm)h['x-admin-token']=ADMIN;return (await w.fetch(new Request('https://x.dev/m/'+k,{headers:h}),env,{waitUntil(){}})).status};
  ok(await get(false)===404&&await get(true)===200,'投稿に付ける前の Tips の画像は、運営者だけが見られる');
  const id=(await post({tool:'team',body:'画像の見え方の確認',media:[k]}))[1].id;ok(await get(false)===200,'投稿したら見られる');
  await call('/api/admin/tips/hide',{method:'POST',admin:ADMIN,body:{id}});ok(await get(false)===404,'非表示にした Tips の画像は見られない')}
/* ④ 別の入口：会話の番号で送る・掲示板の通報で投稿を指定する、でも決まりをすり抜けない */
r=await call('/api/dm/send',{method:'POST',tok:ta,body:{conv:999999,body:'x'}});ok(r[0]===404,'会話の番号を決め打ちしても bot には送れない（会話がない）',r);
r=await call('/api/report',{method:'POST',tok:ta,body:{kind:'note',id:tipId,reason:'その他'}});ok(r[0]===400,'掲示板の通報の入口ではタイムラインの投稿を通報できない（Tips の決まりをすり抜けない）',r);
/* ⑤ ログインの uid が bot: で始まっても、bot のアカウントにはなれない（乗っ取れない） */
r=await call('/api/me',{method:'POST',tok:await tok('bot:tips'),body:{handle:'someone1',name:'たろう',agree:true}});ok(r[0]===401,'uid が bot:tips のログインは断る',r);
r=await call('/api/me',{tok:await tok('bot:news')});ok(r[0]===401,'uid が bot: で始まるログインはすべて断る',r);
r=await call('/api/u/gamekids_tips');ok(r[0]===200&&r[1].user.off&&r[1].user.name==='Game Kid/s Tips','運営のアカウントの ID・名前は変わっていない',r[1].user);
r=await call('/api/notes',{method:'POST',tok:await tok('bot:tips'),body:{body:'なりすまし'}});ok(r[0]===401,'uid が bot:tips のログインでは投稿できない',r);

/* ---------- 10. 1日の画像の上限（30枚） ---------- */
const used=(await env.DB.prepare(`SELECT COUNT(*) AS c FROM media WHERE uid='bot:tips'`).first()).c;let last=[200];for(let i=used;i<30;i++){last=await upload(png());}
ok(last&&last[0]===200,'30枚目までは送れる',last);r=await upload(png());ok(r[0]===429,'31枚目は1日の上限で断る',r);


/* ---------- 12. 公式の運営の札（2026/11/19）：運営者のアカウントに付ける。サーバーの設定で決まり、本人は付けられない ---------- */
{const [tz]=await mkUser('uz','zed_admin','ゼッド');
  /* 本人・ほかの利用者は付けられない（合言葉なし・違う合言葉・ログインだけ・自分の保存に off を混ぜる） */
  let q=await call('/api/admin/official',{method:'POST',body:{handle:'zed_admin'}});ok(q[0]===401,'合言葉なしでは運営の札を付けられない',q);
  q=await call('/api/admin/official',{method:'POST',tok:tz,body:{handle:'zed_admin'}});ok(q[0]===401,'本人がログインしていても自分に付けられない',q);
  q=await call('/api/admin/official',{method:'POST',admin:'wrong-secret-xyz',body:{handle:'zed_admin'}});ok(q[0]===401,'違う合言葉では付けられない',q);
  q=await call('/api/admin/official',{tok:tz});ok(q[0]===401,'利用者は一覧も見られない',q);
  q=await call('/api/me',{method:'POST',tok:tz,body:{handle:'zed_admin',name:'ゼッド',agree:true,off:1,official:true}});ok(q[0]===200&&!(q[1].user&&q[1].user.off),'自分の保存に off を混ぜても付かない',q);
  q=await call('/api/u/zed_admin');ok(q[0]===200&&!('off' in q[1].user),'まだ札はない',q[1].user);
  /* 運営者が付ける */
  q=await call('/api/admin/official',{method:'POST',admin:ADMIN,body:{handle:'@Zed_Admin',on:true}});ok(q[0]===200&&q[1].handle==='zed_admin'&&q[1].off===true,'運営者が付けられる（@ や大文字小文字は気にしない）',q);
  q=await call('/api/admin/official',{admin:ADMIN});ok(q[0]===200&&q[1].users.some(x=>x.handle==='zed_admin'&&!x.fixed)&&q[1].users.some(x=>x.handle==='gamekids_tips'&&x.fixed),'一覧に出る（Tips はいつも付く）',q);
  /* どこでも同じ札：プロフィール・投稿・検索・お知らせ・フォローの一覧・メッセージ */
  q=await call('/api/u/zed_admin');ok(q[1].user.off===true,'プロフィールに札',q[1].user);
  const post=await call('/api/notes',{method:'POST',tok:tz,body:{body:'運営からのお知らせです #運営'}});ok(post[0]===200,'札のある人も投稿できる',post);
  q=await call('/api/tl');const mine=(q[1].notes||[]).find(x=>x.user.handle==='zed_admin');ok(mine&&mine.user.off===true&&!mine.tool,'投稿に札（ツールのボタンは付かない）',mine);
  q=await call('/api/search?q=zed');ok((q[1].users||[]).some(x=>x.handle==='zed_admin'&&x.off===true),'検索のトレーナーに札',q[1].users);
  await call('/api/follow',{method:'POST',tok:tz,body:{handle:'alice'}});
  q=await call('/api/notifs',{tok:ta});ok((q[1].notifs||[]).some(x=>x.user.handle==='zed_admin'&&x.user.off===true),'お知らせに札',q[1].notifs);
  q=await call('/api/u/alice/follows?kind=followers',{tok:ta});ok((q[1].users||[]).some(x=>x.handle==='zed_admin'&&x.off===true),'フォローの一覧に札',q[1]);
  q=await call('/api/dm/with/zed_admin',{tok:ta});ok(q[0]===200&&q[1].user.off===true,'メッセージの相手に札',q[1]);
  /* ほかの人には付かない・名前で同じ見た目にはできない */
  q=await call('/api/u/alice');ok(!('off' in q[1].user),'ほかの利用者には付かない',q[1].user);
  /* 通報で自動に隠さない（Tips と同じ：運営者が確かめる） */
  for(const t of [tb,tc,td])await call(`/api/notes/${post[1].id}/report`,{method:'POST',tok:t,body:{reason:'その他'}});
  q=await call('/api/tl');ok((q[1].notes||[]).some(x=>x.id===post[1].id),'札のある人の投稿は通報3件でも自動で隠れない',q[1].notes&&q[1].notes.map(x=>x.id));
  /* 付けられないもの：bot のアカウント・ないID・停止中 */
  q=await call('/api/admin/official',{method:'POST',admin:ADMIN,body:{handle:'gamekids_tips',on:false}});ok(q[0]===400,'Tips の札は外せない',q);
  q=await call('/api/admin/official',{method:'POST',admin:ADMIN,body:{handle:'nobody_here'}});ok(q[0]===404,'ないIDは404',q);
  q=await call('/api/admin/official',{method:'POST',admin:ADMIN,body:{handle:'a b'}});ok(q[0]===400,'IDの形でないものは400',q);
  /* 外す・記録 */
  q=await call('/api/admin/official',{method:'POST',admin:ADMIN,body:{handle:'zed_admin',on:false}});ok(q[0]===200&&q[1].off===false,'外せる',q);
  q=await call('/api/u/zed_admin');ok(!('off' in q[1].user),'外すと札が消える',q[1].user);
  q=await call('/api/tl');const m2=(q[1].notes||[]).find(x=>x.user.handle==='zed_admin');ok(m2&&!m2.user.off,'投稿の札も消える',m2);
  q=await call('/api/admin/tips',{admin:ADMIN});ok(q[1].log.some(l=>l.action==='official_on'&&l.detail==='@zed_admin')&&q[1].log.some(l=>l.action==='official_off'),'付けた・外したは操作の記録に残る',q[1].log);
}

/* ================= B. 画面 ================= */
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const URL0='file://'+path.join(ROOT,'dist/index.html');
for(const W of [390,1280]){
  const ctx=await b.newContext({viewport:{width:W,height:W<700?844:900},locale:'ja-JP',hasTouch:W<700,isMobile:W<700});
  await ctx.addInitScript(()=>{try{if(!sessionStorage.getItem('__t')){localStorage.setItem('pcstart','1');localStorage.setItem('pctoolsguide','1')}sessionStorage.setItem('__t','1')}catch(e){}});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));await pg.route(/^https?:/,r=>r.abort());
  await pg.goto(URL0+'#/tools');await pg.waitForTimeout(800);
  const t=await pg.evaluate(()=>{const a=document.querySelector('#view .tquick .tips-row');const y=s=>document.querySelector('#view '+s).getBoundingClientRect().top;
    return a&&{href:a.getAttribute('href'),txt:a.textContent,h:a.getBoundingClientRect().height,inQuick:!!a.closest('.tquick'),afterGrid:a.getBoundingClientRect().top>=document.querySelector('#view .tquick .tgrid').getBoundingClientRect().bottom-1,
      order:y('.tprim')<y('.tquick')&&y('.tquick')<y('.tother-h'),card:!!document.querySelector('.tg-card'),over:document.body.scrollWidth-document.documentElement.clientWidth}});
  ok(t&&t.href==='#/u/gamekids_tips'&&/Game Kid\/s Tips/.test(t.txt)&&/運営/.test(t.txt)&&t.inQuick&&t.afterGrid&&t.h>=44,W+'：ツールの画面の「すぐ使う」に Game Kid/s Tips の入口',t);
  ok(t.order&&!t.card&&t.over<=1,W+'：使い方のカードを閉じたあとも入口は出る・並びは前のまま・はみ出さない',t);
  await pg.click('#view .tips-row');await pg.waitForTimeout(300);ok(await pg.evaluate(()=>location.hash)==='#/u/gamekids_tips',W+'：入口から運営のアカウントへ移る');
  /* 投稿の表示：札は off のときだけ、ツールのボタンは表にあるツールだけ */
  await pg.evaluate(()=>{location.hash='#/tools'});await pg.waitForTimeout(300);
  const R=await pg.evaluate(()=>{const base={id:1,body:'本文',media:[],created_at:Date.now(),likes:0,replies:0,reposts:0};
    const box=document.createElement('div');box.id='tt';document.getElementById('view').prepend(box);
    const h=n=>{box.innerHTML=twHtml(n);const a=box.querySelector('.tw-tool');return{badge:!!box.querySelector('.tw-off'),tool:a&&a.getAttribute('href'),label:a&&a.textContent}};
    return{off:h({...base,user:{handle:'gamekids_tips',name:'Game Kid/s Tips',off:true},tool:'calc'}),
      user:h({...base,user:{handle:'x',name:'運営'},tool:'calc'}),bad:h({...base,user:{handle:'gamekids_tips',name:'G',off:true},tool:'javascript:alert(1)'}),none:h({...base,user:{handle:'gamekids_tips',name:'G',off:true}})}});
  ok(R.off.badge&&R.off.tool==='#/calc'&&/ダメージ計算を開く/.test(R.off.label),W+'：Tips の投稿に「運営」の札と「ダメージ計算を開く」',R.off);
  ok(!R.user.badge&&!R.user.tool,W+'：ふつうの利用者の投稿には、名前が「運営」でも札もボタンも出ない',R.user);
  ok(R.bad.badge&&!R.bad.tool&&!R.none.tool,W+'：表にないツールはボタンにしない',R);
  await pg.evaluate(()=>{const box=document.getElementById('tt');box.innerHTML=twHtml({id:1,body:'b',media:[],created_at:Date.now(),likes:0,replies:0,reposts:0,user:{handle:'gamekids_tips',name:'G',off:true},tool:'dex'})});
  await pg.click('#tt .tw-tool');await pg.waitForTimeout(400);ok(await pg.evaluate(()=>location.hash)==='#/dex',W+'：「図鑑を開く」で図鑑へ移る');
  ok(!errs.length,W+'：エラーなし',errs);await ctx.close();
}
/* 運営の札（2026/11/19）：検索のトレーナーの行に札・行の中にリンクを重ねない（前は行の中のアイコンもリンクで、行が2つに割れていた） */
{const ctx=await b.newContext({viewport:{width:390,height:844},locale:'ja-JP'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(/^https?:/,r=>{const p=new URL(r.request().url()).pathname;if(p==='/api/search')return r.fulfill({json:{notes:[],next:null,users:[{handle:'zed_admin',name:'ゼッド',bio:'運営',av:null,off:true,card:true},{handle:'zed_fan',name:'ファン',bio:'',av:null}]}});return r.abort()});
  await pg.goto(URL0+'#/search/zed');await pg.waitForTimeout(1200);
  const R=await pg.evaluate(()=>{const rows=[...document.querySelectorAll('#view a.row')].filter(a=>/@zed_/.test(a.textContent));
    return{n:rows.length,nested:rows.some(a=>a.querySelector('a')),av:rows.every(a=>a.querySelector('.tw-av')),badge:rows.map(a=>!!a.querySelector('.tw-off')),ring:!!(rows[0]&&rows[0].querySelector('.tw-av.gk-cr'))}});
  ok(R.n===2&&!R.nested&&R.av&&R.badge.join()==='true,false'&&R.ring,'検索のトレーナー：運営の札は札のある人だけ・行の中にリンクを重ねない',R);
  ok(!errs.length,'検索：エラーなし',errs);await ctx.close()}
/* 管理画面の Tips タブ：合言葉を付けて送る・画像を送ってから投稿する */
{const ctx=await b.newContext({viewport:{width:1280,height:900},locale:'ja-JP'});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  const seen=[];
  await pg.route(/workers\.dev/,async r=>{const u=new URL(r.request().url()),h=r.request().headers();seen.push([u.pathname,h['x-admin-token']||'',r.request().method()]);
    if(u.pathname==='/api/admin/tips')return r.fulfill({json:{tools:['calc','dex'],notes:[{id:5,body:'前の Tips',tool:'calc',created_at:Date.now(),hidden:0,reports:2}],log:[{at:Date.now(),action:'tips_post',target:5,detail:'calc',who:'0123456789abcdef'}],user:{handle:'gamekids_tips'}}});
    if(u.pathname==='/api/admin/tips/media')return r.fulfill({json:{ok:true,key:'a'.repeat(32),w:10,h:10}});
    if(u.pathname==='/api/admin/tips/post')return r.fulfill({json:{ok:true,id:6}});
    if(u.pathname==='/api/admin/official'&&r.request().method()==='GET')return r.fulfill({json:{users:[{handle:'gamekids_tips',name:'Game Kid/s Tips',fixed:true},{handle:'zed_admin',name:'ゼッド',fixed:false}]}});
    if(u.pathname==='/api/admin/official')return r.fulfill({json:{ok:true,handle:'new_admin',off:true}});
    return r.fulfill({json:{}})});
  await pg.route(/^https?:\/\/(?!.*workers\.dev)/,r=>r.abort());
  await pg.goto(URL0+'#/tools');await pg.evaluate(()=>{sessionStorage.setItem('pcadmin','admin-secret-123');location.hash='#/admin'});await pg.waitForTimeout(500);
  await pg.click('[data-at="tips"]');await pg.waitForSelector('#tp-tool');
  ok(await pg.$eval('#view',e=>e.textContent.includes('通報 2件')&&e.textContent.includes('tips_post')),'管理画面：最近の Tips（通報の数）と操作の記録が出る');
  await pg.click('#tp-post');await pg.waitForTimeout(200);ok(!seen.some(s=>s[0]==='/api/admin/tips/post'),'ツール・本文がなければ送らない');
  await pg.selectOption('#tp-tool','calc');await pg.fill('#tp-body','ダメージ計算の使い方');
  await pg.setInputFiles('#tp-img',{name:'a.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64')});
  await pg.click('#tp-post');await pg.waitForTimeout(800);
  const up=seen.find(s=>s[0]==='/api/admin/tips/media'),ps=seen.find(s=>s[0]==='/api/admin/tips/post');
  ok(up&&up[1]===ADMIN&&ps&&ps[1]===ADMIN,'管理画面：画像を送ってから投稿する（どちらも合言葉を付ける）',seen);
  /* 運営の札：一覧（Tips は「いつも付く」・ほかは「外す」）・ID を入れて確かめてから付ける（合言葉を付けて送る） */
  ok(await pg.$eval('#view',e=>/運営の札が付いているアカウント/.test(e.textContent)&&!!e.querySelector('[data-off-rm="zed_admin"]')&&!e.querySelector('[data-off-rm="gamekids_tips"]')&&/いつも付く/.test(e.textContent)),'管理画面：運営の札の一覧');
  await pg.fill('#of-h','@new_admin');await pg.click('#of-add');await pg.waitForTimeout(300);
  const cf=await pg.$('.xc .btn, [role=dialog] button');await pg.evaluate(()=>{const bs=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='付ける');bs[bs.length-1]&&bs[bs.length-1].click()});await pg.waitForTimeout(500);
  const of=seen.find(s=>s[0]==='/api/admin/official'&&s[2]==='POST');ok(of&&of[1]===ADMIN,'管理画面：確かめてから合言葉を付けて運営の札を付ける',seen.filter(s=>s[0].includes('official')));
  ok(!errs.length,'管理画面：エラーなし',errs);await ctx.close()}
await b.close();
console.log(process.exitCode?'tips: NG':`tips: OK（${n}項目）`);
