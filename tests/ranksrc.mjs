// 上位パーティの出どころ（2026/11/18 依頼主の決定）と、非公開アカウントのプロフィールの確認
//  ・4つの出どころ：verified 確認済み／self 自己申告／article 記事から集計／operator 運営が登録
//  ・前の版の行（verified・by_admin・auto だけの行）の分け方と、読むだけの試し（何も書きかえない）
//  ・確認済みは証拠のスクリーンショットがあり、確認の記録（だれ・いつ・どの証拠）が残るときだけ。中身が変われば外れる
//  ・非公開アカウント：本人と許可されたフォロワー以外には、自己紹介・相棒・看板パーティ・実績・もらったいいねを送らない
import path from 'node:path';
import {makeD1} from './d1mock.mjs';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const PID='pokechan-test';
const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const kp=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...(await crypto.subtle.exportKey('jwk',kp.publicKey)),kid:'k1',use:'sig',alg:'RS256'};
const sec=Math.floor(Date.now()/1000);
const tok=async uid=>{const h=enc({alg:'RS256',kid:'k1',typ:'JWT'}),p=enc({iss:'https://securetoken.google.com/'+PID,aud:PID,sub:uid,iat:sec-10,exp:sec+3600,auth_time:sec-10,email:uid+'@example.com'});
  return h+'.'+p+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',kp.privateKey,new TextEncoder().encode(h+'.'+p))).toString('base64url')};
globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
globalThis.fetch=async u=>{u=String(u);if(u.includes('securetoken@system.gserviceaccount.com'))return new Response(JSON.stringify({keys:[jwk]}));return new Response('',{status:404})};
const w=(await import(path.join(ROOT,'worker/dist/worker.js'))).default;
const DB=makeD1();
const env={DB,FIREBASE_PROJECT_ID:PID,APP_TOKEN:'t',ADMIN_TOKEN:'admin-secret-123'};
const ADM='admin-secret-123';
let ipN=0;
const call=async(p,{method='GET',tok,body,admin}={})=>{const h={'content-type':'application/json','cf-connecting-ip':'10.1.0.'+(++ipN%250)};if(tok)h.authorization='Bearer '+tok;if(admin)h['x-admin-token']=admin;
  const r=await w.fetch(new Request('https://x.dev'+p,{method,headers:h,body:body?JSON.stringify(body):undefined}),env,{waitUntil(){}});return[r.status,await r.json().catch(()=>({}))]};
const up=async(t,bytes)=>{const h={'content-type':'application/octet-stream','cf-connecting-ip':'10.9.9.9',authorization:'Bearer '+t};
  const r=await w.fetch(new Request('https://x.dev/api/media?w=4&h=3',{method:'POST',headers:h,body:bytes}),env,{waitUntil(){}});return[r.status,await r.json().catch(()=>({}))]};
const getM=async(k,admin)=>(await w.fetch(new Request('https://x.dev/m/'+k,{headers:admin?{'x-admin-token':admin}:{}}),env,{waitUntil(){}})).status;
const JPG=new Uint8Array([0xFF,0xD8,0xFF,0xE0,...Array(300).fill(7)]);
let bad=0,n=0;const expect=(name,cond,info)=>{n++;if(!cond){bad++;console.error('NG',name,JSON.stringify(info))}};
let clock=Date.now();const realNow=Date.now;Date.now=()=>clock;const tick=(ms=16e3)=>{clock+=ms};
const TM=nos=>nos.map(no=>({no}));
let r;
const A=await tok('rsA'),B=await tok('rsB'),C=await tok('rsC'),D=await tok('rsD');
for(const [t,h] of [[A,'ann'],[B,'ben'],[C,'cat'],[D,'dan']]){r=await call('/api/me',{method:'POST',tok:t,body:{handle:h,name:h.toUpperCase(),agree:true}});expect('プロフィール作成 '+h,r[0]===200,r)}
r=await call('/api/admin/seasons',{method:'POST',admin:ADM,body:{name:'S1'}});const S=r[1].id;
r=await call('/api/admin/seasons',{method:'POST',admin:ADM,body:{name:'S0'}});const S0=r[1].id;
const list=async(o={})=>(await call(`/api/seasons/${S}/teams?fmt=single`,o))[1];
const byId=(j,id)=>j.teams.find(t=>t.id===id);

/* ---- 1. 新しい登録：4つの出どころ ---- */
r=await up(A,JPG);const pA=r[1].key;
r=await call(`/api/seasons/${S}/teams`,{method:'POST',tok:A,body:{fmt:'single',rank:10,team:TM([445,149,887,1000,727,812]),proof:pA}});const TA=r[1].id;
r=await call(`/api/seasons/${S}/teams`,{method:'POST',tok:B,body:{fmt:'single',rank:20,team:TM([445,149,887])}});const TB=r[1].id;
r=await call('/api/admin/season-teams',{method:'POST',admin:ADM,body:{season_id:S,fmt:'single',player:'有名',rank:1,team:TM([445,149,887,1000])}});const TO=r[1].id;
let j=await list();
expect('自己申告（証拠あり・未確認）',byId(j,TA).source==='self'&&!byId(j,TA).verified,byId(j,TA));
expect('自己申告（証拠なし）',byId(j,TB).source==='self',byId(j,TB));
expect('運営者の登録は「運営が登録」で確認済みではない',byId(j,TO).source==='operator'&&!byId(j,TO).verified,byId(j,TO));
expect('まだ確認済みがないので、よく使われたポケモンは0件',j.usage.length===0&&j.verified_total===0&&j.by_source.self===2&&j.by_source.operator===1,j);

/* ---- 2. 確認済みにする：証拠が要る・記録が残る ---- */
r=await call('/api/admin/season-teams',{method:'POST',admin:ADM,body:{id:TO,review:'verify'}});expect('運営が登録（証拠なし）は確認済みにできない',r[0]===400,r);
r=await call('/api/admin/season-teams',{method:'POST',admin:ADM,body:{id:TB,review:'verify'}});expect('証拠のない自己申告は確認済みにできない',r[0]===400,r);
r=await call('/api/admin/season-teams',{method:'POST',admin:ADM,body:{id:TA,review:'verify',proof:'0'.repeat(32)}});expect('見た証拠が今の証拠と違えば止める',r[0]===409,r);
r=await call('/api/admin/season-teams',{method:'POST',body:{id:TA,review:'verify'}});expect('確認は管理者だけ',r[0]===401,r);
r=await call('/api/admin/season-teams',{method:'POST',admin:ADM,body:{id:TA,review:'verify',proof:pA,reviewer:'うんえい',note:'画面で順位10位を確認'}});expect('証拠のある登録を確認済みにできる',r[0]===200,r);
j=await list();expect('確認済みになる',byId(j,TA).source==='verified'&&byId(j,TA).verified,byId(j,TA));
expect('よく使われたポケモンは確認済みの1件から',j.verified_total===1&&j.usage.length===6&&j.usage.every(u=>u.pc===100),j.usage);
expect('公開の一覧に確認した人・証拠の鍵は出さない',!JSON.stringify(j).includes(pA)&&!JSON.stringify(j).includes('うんえい'),'');
r=await call(`/api/admin/season-teams/${TA}/reviews`,{admin:ADM});
expect('確認の記録：だれ・いつ・どの証拠',r[1].reviews.length===1&&r[1].reviews[0].action==='verify'&&r[1].reviews[0].proof===pA&&r[1].reviews[0].by==='admin:うんえい'&&r[1].reviews[0].created_at>0,r[1]);
r=await call('/api/admin/season-teams',{admin:ADM});{const t=r[1].teams.find(x=>x.id===TA);expect('運営者の一覧：出どころと確認した人',t.source==='verified'&&t.review==='reviewed'&&t.reviewed_by==='admin:うんえい',t)}
r=await call('/api/u/ann');expect('プロフィールの実績は確認済み',r[1].user.results[0].source==='verified'&&r[1].user.results[0].verified,r[1].user.results);

/* ---- 3. 中身を変えると確認は外れる（ひとことだけなら外れない） ---- */
tick();r=await call(`/api/seasons/${S}/teams`,{method:'POST',tok:A,body:{fmt:'single',rank:10,team:TM([445,149,887,1000,727,812]),comment:'ひとことだけ変更'}});
j=await list();expect('ひとことだけの変更では確認済みのまま',byId(j,TA).source==='verified',byId(j,TA));
tick();r=await call(`/api/seasons/${S}/teams`,{method:'POST',tok:A,body:{fmt:'single',rank:3,team:TM([445,149,887,1000,727,812])}});
j=await list();expect('順位を変えると確認済みが外れて自己申告に',byId(j,TA).source==='self'&&!byId(j,TA).verified&&j.verified_total===0&&j.usage.length===0,byId(j,TA));
r=await call(`/api/admin/season-teams/${TA}/reviews`,{admin:ADM});expect('確認が外れたことも記録に残る',r[1].reviews[0].action==='reset'&&r[1].reviews[0].by==='system',r[1].reviews);
r=await call('/api/admin/season-teams',{method:'POST',admin:ADM,body:{id:TA,review:'verify',proof:pA}});
tick();r=await up(A,JPG);const pA2=r[1].key;
r=await call(`/api/seasons/${S}/teams`,{method:'POST',tok:A,body:{fmt:'single',rank:3,team:TM([445,149,887,1000,727,812]),proof:pA2}});
j=await list();expect('証拠を差しかえると確認済みが外れる',byId(j,TA).source==='self',byId(j,TA));
r=await call('/api/admin/season-teams',{method:'POST',admin:ADM,body:{id:TA,review:'verify',proof:pA2}});
r=await call('/api/admin/season-teams',{method:'POST',admin:ADM,body:{id:TA,review:'unverify',note:'順位の表示が読めない'}});
j=await list();expect('確認済みを外せる',byId(j,TA).source==='self',byId(j,TA));
r=await call(`/api/admin/season-teams/${TA}/reviews`,{admin:ADM});expect('外したことも記録に残る',r[1].reviews[0].action==='unverify'&&r[1].reviews.length===6,r[1].reviews.map(x=>x.action));
/* 前の形（verified:true）で送っても、証拠と記録の決まりは同じ */
r=await call('/api/admin/season-teams',{method:'POST',admin:ADM,body:{id:TO,verified:true}});expect('前の形でも証拠なしは確認済みにできない',r[0]===400,r);
r=await call('/api/admin/season-teams',{method:'POST',admin:ADM,body:{id:TA,verified:true}});j=await list();expect('前の形でも記録つきで確認済み',byId(j,TA).source==='verified',byId(j,TA));

/* ---- 4. 前の版の行（決まりの1〜6）。サーバーを通さずに前の形のまま入れる ---- */
const now=clock;
r=await up(C,JPG);const pC=r[1].key;
const ins=async(o)=>{const k=Object.keys(o);const x=await DB.prepare(`INSERT INTO season_teams(season_id,fmt,${k.join(',')},created_at,updated_at) VALUES(?,?,${k.map(()=>'?').join(',')},?,?) RETURNING id`).bind(S0,'single',...k.map(c=>o[c]),now,now).first();return x.id};
const uidOf=async h=>(await DB.prepare(`SELECT uid FROM users WHERE handle=?`).bind(h).first()).uid;
const L1=await ins({uid:await uidOf('cat'),rank:5,team:JSON.stringify(TM([445,149,887])),proof:pC,verified:1});        /* 4：利用者・verified=1・証拠あり */
const L2=await ins({uid:await uidOf('dan'),rank:6,team:JSON.stringify(TM([445,149,887])),verified:1});                  /* 3：利用者・verified=1・証拠なし */
const L3=await ins({player:'運営',rank:1,team:JSON.stringify(TM([445,149,887])),verified:1,by_admin:1});                /* 2：運営者の登録（前は確認済み） */
const L4=await ins({player:'記事',rank:2,team:JSON.stringify(TM([445,149,887])),verified:0,by_admin:1,auto:1,sources:'["https://a.example/1","https://b.example/2"]'}); /* 1：auto が先 */
const L5=await ins({player:'記事2',rank:3,team:JSON.stringify(TM([445,149,887])),verified:1,by_admin:1,auto:1});         /* 1：auto が先（verified=1 でも） */
const snap=async()=>JSON.stringify((await DB.prepare(`SELECT * FROM season_teams ORDER BY id`).all()).results)+JSON.stringify((await DB.prepare(`SELECT COUNT(*) AS c FROM rank_reviews`).first()));
const before=await snap();
r=await call('/api/admin/season-teams/classify');expect('分け方の試しは管理者だけ',r[0]===401,r);
r=await call('/api/admin/season-teams/classify',{admin:ADM});const cj=r[1];
expect('分け方の試しは読むだけ（行・記録は変わらない）',(await snap())===before&&cj.dry_run===true,'');
const j0=(await call(`/api/seasons/${S0}/teams?fmt=single`))[1];
expect('決まり4：前の確認済み＋証拠あり＝自己申告・もう一度確かめる（確認済みの集計には入らない）',byId(j0,L1).source==='self'&&!byId(j0,L1).verified,byId(j0,L1));
expect('決まり3：前の確認済み＋証拠なし＝自己申告',byId(j0,L2).source==='self',byId(j0,L2));
expect('決まり2：前の運営者の登録＝運営が登録',byId(j0,L3).source==='operator'&&!byId(j0,L3).verified,byId(j0,L3));
expect('決まり1：auto=1 は記事から集計（by_admin=1 でも）',byId(j0,L4).source==='article'&&byId(j0,L4).sources.length===2,byId(j0,L4));
expect('決まり1：auto=1 は verified=1 でも記事から集計',byId(j0,L5).source==='article'&&!byId(j0,L5).verified,byId(j0,L5));
expect('決まり5：記録がないので、前の行に確認済みは1つもない',j0.verified_total===0&&j0.usage.length===0,j0);
r=await call('/api/admin/season-teams',{admin:ADM});
{const t=r[1].teams.find(x=>x.id===L1);expect('運営者の一覧：もう一度確かめる印',t.pending&&t.review==='rereview'&&t.legacy_verified,t);
 expect('もう一度確かめるものが一覧の先頭',r[1].teams[0].pending,r[1].teams.slice(0,2))}
expect('分け方の数：前の確認済み4件の行き先',cj.legacy_verified.total===4&&cj.legacy_verified.to.verified===0&&cj.legacy_verified.to.self===2&&cj.legacy_verified.to.operator===1&&cj.legacy_verified.to.article===1,cj.legacy_verified);
expect('分け方の数：出どころごと',cj.by_source.article===2&&cj.by_source.operator===2&&cj.by_source.verified===1&&cj.by_review.rereview===1&&cj.pending===1,cj);
expect('決まり6：分け直しても証拠のスクリーンショットは残る',(await getM(pC,ADM))===200,'');
r=await call('/api/admin/season-teams',{method:'POST',admin:ADM,body:{id:L4,review:'verify'}});expect('記事から集計は確認済みにできない',r[0]===400,r);
r=await call('/api/admin/season-teams',{method:'POST',admin:ADM,body:{id:L1,review:'verify',proof:pC}});
{const j1=(await call(`/api/seasons/${S0}/teams?fmt=single`))[1];expect('もう一度確かめて記録すると確認済み',byId(j1,L1).source==='verified'&&j1.verified_total===1,byId(j1,L1))}

/* ---- 5. 非公開アカウント：サーバーから送らない ---- */
r=await call('/api/me',{method:'POST',tok:C,body:{handle:'cat',name:'CAT',bio:'ひみつの自己紹介 #タグ',agree:true}});
r=await call('/api/me/card',{method:'POST',tok:C,body:{partner:445,showcase:{n:'看板',t:[445,149,887]}}});expect('カードを保存',r[0]===200,r);
r=await call('/api/me/private',{method:'POST',tok:C,body:{on:true}});
const hidden=u=>u.locked&&u.bio===''&&u.partner===null&&u.showcase===null&&Array.isArray(u.results)&&u.results.length===0&&!('liked' in u);
const shown=u=>!u.locked&&u.bio.includes('ひみつ')&&u.partner===445&&u.showcase&&u.showcase.n==='看板'&&u.results.length===1&&!('liked' in u);
r=await call('/api/u/cat');expect('ログインしていない人には送らない',hidden(r[1].user)&&!JSON.stringify(r[1]).includes('ひみつ'),r[1].user);
r=await call('/api/u/cat',{tok:D});expect('フォローしていない人には送らない',hidden(r[1].user),r[1].user);
expect('名前・ID・数は見せる',r[1].user.name==='CAT'&&r[1].user.handle==='cat'&&typeof r[1].user.followers==='number',r[1].user);
r=await call('/api/u/cat',{tok:C});expect('本人には全部',shown(r[1].user),r[1].user);
r=await call('/api/follow',{method:'POST',tok:D,body:{handle:'cat'}});
r=await call('/api/u/cat',{tok:D});expect('リクエスト中（まだ許可されていない）には送らない',hidden(r[1].user)&&r[1].user.requested,r[1].user);
r=await call('/api/follow/answer',{method:'POST',tok:C,body:{handle:'dan',ok:true}});
r=await call('/api/u/cat',{tok:D});expect('許可されたフォロワーには全部',shown(r[1].user),r[1].user);
r=await call('/api/u/cat',{tok:B});expect('アカウントを切りかえると（別の人）送らない',hidden(r[1].user),r[1].user);
r=await call('/api/u/cat');expect('ログアウトすると送らない',hidden(r[1].user),r[1].user);
r=await call('/api/search?q=cat',{tok:B});{const u=(r[1].users||[]).find(x=>x.handle==='cat');expect('検索のトレーナーにも自己紹介を出さない',u&&u.bio===''&&u.private,r[1].users)}
r=await call('/api/search?q=cat',{tok:D});{const u=(r[1].users||[]).find(x=>x.handle==='cat');expect('検索：許可されたフォロワーには自己紹介',u&&u.bio.includes('ひみつ'),r[1].users)}
r=await call('/api/follow',{method:'POST',tok:C,body:{handle:'ben'}});
r=await call('/api/u/ben/follows?kind=followers',{tok:B});{const u=r[1].users.find(x=>x.handle==='cat');expect('フォローの一覧にも非公開の人の自己紹介を出さない',u&&u.bio==='',r[1].users)}
r=await call('/api/u/ben/follows?kind=followers',{tok:D});{const u=r[1].users.find(x=>x.handle==='cat');expect('フォローの一覧：許可されたフォロワーには自己紹介',u&&u.bio.includes('ひみつ'),r[1].users)}
const jS0=async t=>(await call(`/api/seasons/${S0}/teams?fmt=single`,{tok:t}))[1];
/* A20：非公開の人の行は、本人と許可されたフォロワー以外にはまるごと送らない（名前を隠した行も、件数・よく使われたポケモンにも入れない） */
{let j=await jS0(B);expect('シーズンの一覧：非公開の人の行を送らない（フォローしていない人）',!byId(j,L1)&&j.verified_total===0&&j.usage.length===0&&!JSON.stringify(j).includes('cat'),j.teams.map(t=>t.id));
 j=await jS0(null);expect('シーズンの一覧：ログインなしでも送らない',!byId(j,L1)&&j.total===4,j.total);
 let x=byId(await jS0(D),L1);expect('シーズンの一覧：許可されたフォロワーには行と名前',x&&x.player.handle==='cat',x);
 x=byId(await jS0(C),L1);expect('シーズンの一覧：本人には行と mine',x&&x.mine,x)}
r=await call('/api/me/private',{method:'POST',tok:C,body:{on:false}});
r=await call('/api/u/cat',{tok:B});expect('公開に戻すとだれにでも見える',shown(r[1].user),r[1].user);

/* ---- 6. ゲームごとのカード（共通の users と分ける）・前の版のデータとの互換 ---- */
const rowG=async h=>DB.prepare(`SELECT g.* FROM game_profiles g JOIN users u ON u.uid=g.uid WHERE u.handle=?`).bind(h).all();
{let g=(await rowG('cat')).results;expect('カードは game_profiles（ポケモンチャンピオンズ）に入る',g.length===1&&g[0].game==='pokechamp'&&g[0].partner===445,g)}
r=await call('/api/u/cat',{tok:B});expect('ゲームごとの中身を games で返す（実績も game つき）',r[1].user.games.pokechamp.partner===445&&r[1].user.games.pokechamp.results.length===1&&r[1].user.results[0].game==='pokechamp',r[1].user.games);
r=await call('/api/me/card',{method:'POST',tok:C,body:{game:'efootball',partner:1}});expect('まだないゲームのカードは作れない',r[0]===400,r);
r=await call('/api/me/card',{method:'POST',tok:C,body:{partner:149}});
{const u=await DB.prepare(`SELECT partner FROM users WHERE handle='cat'`).first();expect('前の版のために users にも書く',u.partner===149,u)}
/* 前の版のデータ：game_profiles に行がなく、users の列だけある人 */
await DB.prepare(`UPDATE users SET partner=887,showcase=? WHERE handle='ben'`).bind(JSON.stringify({n:'前の看板',t:[887,445]})).run();
r=await call('/api/u/ben');expect('前の版のデータ（users の列だけ）も読める',r[1].user.partner===887&&r[1].user.showcase.n==='前の看板'&&r[1].user.games.pokechamp.partner===887,r[1].user);
expect('読むだけでは game_profiles に書かない',(await rowG('ben')).results.length===0,'');
/* ゲームカードを作ったか（created）：行がある・前の版の相棒/看板パーティがある＝作った。どちらもない人は作っていない（戦績があってもカードの入口は「作った」ではない） */
/* 2026/11/18：created は本人が「ゲームカードを作る」で保存したとき（card:true）だけ。行・相棒・看板パーティ・前の版の列・戦績からは決めない */
r=await call('/api/u/cat',{tok:B});expect('created：相棒を保存しただけ（card なし）では false・輪もなし',r[1].user.games.pokechamp.created===false&&!r[1].user.card,r[1].user.games);
r=await call('/api/u/ben');expect('created：前の版のデータ（users の列）だけでは false',r[1].user.games.pokechamp.created===false&&!r[1].user.card,r[1].user.games);
r=await call('/api/u/ann');expect('created：戦績があっても作っていなければ false',r[1].user.games.pokechamp&&r[1].user.games.pokechamp.created===false&&!r[1].user.card,r[1].user.games);
{const g=(await rowG('cat')).results[0];expect('作っていない人の前のデータ（相棒）は残っている',g&&g.partner===149&&!g.card,g)}
r=await call('/api/me/card',{method:'POST',tok:C,body:{partner:149,card:true}});expect('ゲームカードを作る（card:true）',r[0]===200&&r[1].created===true,r);
r=await call('/api/u/cat',{tok:B});expect('作ると created・輪の印（card）',r[1].user.games.pokechamp.created===true&&r[1].user.card===true,r[1].user);
r=await call('/api/me/card',{method:'POST',tok:C,body:{partner:445}});{const g=(await rowG('cat')).results[0];expect('作ったあとで card なしで保存しても作ったまま',g.card===1&&g.partner===445,g)}
/* 輪の印（card）は、見られる人にだけ：投稿・検索・お知らせ・フォローの一覧も同じ */
clock+=2e4;r=await call('/api/notes',{method:'POST',tok:C,body:{body:'カードを作りました'}});const cn=r[1].id;
const tl=async t=>((await call('/api/u/cat/notes',{tok:t}))[1].notes||[]).find(x=>x.id===cn);
expect('投稿の人にも輪の印（公開のカード）',(await tl(B)).user.card===true,'');
r=await call('/api/search?q=cat',{tok:B});expect('検索のトレーナーにも輪の印',(r[1].users||[]).find(x=>x.handle==='cat').card===true,r[1].users);
r=await call('/api/me/card',{method:'POST',tok:C,body:{partner:445,vis:'only_me'}});
r=await call('/api/u/cat',{tok:B});expect('「自分だけ」：訪問者には created も輪もない',JSON.stringify(r[1].user.games)==='{}'&&!r[1].user.card,r[1].user);
expect('「自分だけ」：投稿の人にも輪を出さない',!(await tl(B)).user.card,'');
r=await call('/api/search?q=cat',{tok:B});expect('「自分だけ」：検索にも輪を出さない',!(r[1].users||[]).find(x=>x.handle==='cat').card,r[1].users);
r=await call('/api/u/cat',{tok:C});expect('「自分だけ」：本人には見える',r[1].user.card===true&&r[1].user.games.pokechamp.created===true,r[1].user);
r=await call('/api/me/card',{method:'POST',tok:C,body:{partner:445,vis:'followers'}});
expect('「フォロワーのみ」：フォローしていない人に輪なし',!(await tl(B)).user.card,'');
expect('「フォロワーのみ」：許可されたフォロワーには輪',(await tl(D)).user.card===true,'');
r=await call('/api/me/card',{method:'POST',tok:C,body:{partner:445,vis:'public'}});
/* お知らせとフォローの一覧の輪（2026/11/18）：サーバーが見ている人に許したときだけ card。見られない人には何も残さない */
clock+=2e4;{const dn=(await call('/api/notes',{method:'POST',tok:D,body:{body:'ダンの投稿'}}))[1].id;await call(`/api/notes/${dn}/like`,{method:'POST',tok:C,body:{on:true}})}
await call('/api/follow',{method:'POST',tok:A,body:{handle:'ben'}});
const nfCard=async t=>{const j=(await call('/api/notifs',{tok:t}))[1];const x=(j.notifs||[]).find(n=>n.user.handle==='cat');return x?('card' in x.user?x.user.card:false):'none'};
const flCard=async(t,h='cat')=>{const j=(await call('/api/u/ben/follows?kind=followers',{tok:t}))[1];const x=(j.users||[]).find(u=>u.handle===h);return x?('card' in x?x.card:false):'none'};
const cvis=v=>call('/api/me/card',{method:'POST',tok:C,body:{partner:445,vis:v}});
expect(await nfCard(B)===true&&await nfCard(D)===true,'公開：お知らせの相手のアイコンに輪（ben・dan）',[await nfCard(B),await nfCard(D)]);
expect(await flCard(B)===true&&await flCard(null)===true,'公開：フォローの一覧に輪（ログインなしでも）',[await flCard(B),await flCard(null)]);
expect(await flCard(B,'ann')===false,'カードを作っていない人は輪なし（ann）',await flCard(B,'ann'));
await cvis('followers');
expect(await nfCard(B)===false&&await flCard(B)===false&&await flCard(null)===false,'フォロワーのみ：フォローしていない人・ログインなしには輪なし',[await nfCard(B),await flCard(B),await flCard(null)]);
expect(await nfCard(D)===true&&await flCard(D)===true,'フォロワーのみ：許可されたフォロワーには輪',[await nfCard(D),await flCard(D)]);
await cvis('only_me');
expect(await nfCard(B)===false&&await nfCard(D)===false&&await flCard(B)===false&&await flCard(D)===false,'自分だけ：だれにも輪なし',[await nfCard(D),await flCard(D)]);
expect(await flCard(C)===true,'自分だけ：本人には輪',await flCard(C));
await cvis('public');await call('/api/me/private',{method:'POST',tok:C,body:{on:true}});
expect(await nfCard(B)===false&&await flCard(B)===false,'非公開アカウント：フォローしていない人には「公開」のカードでも輪なし',[await nfCard(B),await flCard(B)]);
expect(await nfCard(D)===true&&await flCard(D)===true,'非公開アカウント：許可されたフォロワーには輪',[await nfCard(D),await flCard(D)]);
{const j=(await call('/api/notifs',{tok:B}))[1];expect(!JSON.stringify(j).includes('"card":false')&&!(j.notifs.find(n=>n.user.handle==='cat').user.card),'見られない人の返事には card の項目そのものを出さない',j.notifs.map(n=>n.user))}
await call('/api/me/private',{method:'POST',tok:C,body:{on:false}});
/* ゲームごとの公開範囲（A5・A19）：アカウントの設定のほうがいつも先 */
const gcard=b=>call('/api/me/card',{method:'POST',tok:C,body:{partner:445,showcase:{n:'看板',t:[445,149,887]},...b}});
r=await gcard({vis:'everyone'});expect('公開範囲の値が正しくなければ拒否',r[0]===400,r);
r=await gcard({vis:'only_me'});expect('公開範囲を保存できる',r[0]===200,r);
r=await call('/api/u/cat',{tok:D});expect('「自分だけ」：フォロワーにもゲームの中身を送らない（ゲームがあることも）',JSON.stringify(r[1].user.games)==='{}'&&r[1].user.partner===null&&r[1].user.showcase===null&&r[1].user.results.length===0&&r[1].user.bio.includes('ひみつ'),r[1].user);
expect('「自分だけ」：シーズンの一覧にも行を出さない',!byId(await jS0(D),L1),'');
r=await call('/api/u/cat',{tok:C});expect('「自分だけ」：本人には中身と設定',r[1].user.games.pokechamp.vis==='only_me'&&r[1].user.games.pokechamp.eff==='only_me'&&r[1].user.partner===445,r[1].user.games);
r=await gcard({});{const g=(await rowG('cat')).results[0];expect('公開範囲を送らずに保存すると、前の設定のまま',g.vis==='only_me',g)}
r=await gcard({vis:'followers'});
r=await call('/api/u/cat',{tok:B});expect('「フォロワーのみ」（公開アカウント）：フォロワーでない人には送らない',JSON.stringify(r[1].user.games)==='{}'&&r[1].user.partner===null&&!r[1].user.locked&&r[1].user.bio.includes('ひみつ'),r[1].user);
expect('「フォロワーのみ」：フォロワーでない人のシーズンの一覧にも出さない',!byId(await jS0(B),L1),'');
r=await call('/api/u/cat',{tok:D});expect('「フォロワーのみ」：フォロワーには送る',r[1].user.games.pokechamp.partner===445&&!('vis' in r[1].user.games.pokechamp),r[1].user.games);
expect('「フォロワーのみ」：フォロワーのシーズンの一覧には出す',!!byId(await jS0(D),L1),'');
r=await gcard({vis:'public'});
r=await call('/api/me/private',{method:'POST',tok:C,body:{on:true}});
r=await call('/api/u/cat',{tok:B});expect('非公開なら、どのゲームの中身も送らない',JSON.stringify(r[1].user.games)==='{}'&&r[1].user.partner===null,r[1].user);
r=await call('/api/u/cat',{tok:D});expect('A19：アカウントが非公開なら「公開」のゲームもフォロワーのみ（フォロワーには送る）',r[1].user.games.pokechamp.partner===445,r[1].user.games);
r=await call('/api/u/cat',{tok:C});expect('A19：本人には「アカウントが非公開のため狭くなっている」印',r[1].user.games.pokechamp.vis==='public'&&r[1].user.games.pokechamp.eff==='followers'&&r[1].user.games.pokechamp.capped===true,r[1].user.games);
r=await call('/api/me/private',{method:'POST',tok:C,body:{on:false}});
r=await call('/api/u/cat',{tok:B});expect('A19：公開に戻すと、ゲームの「公開」も元どおり',r[1].user.games.pokechamp.partner===445,r[1].user.games);
r=await call('/api/me/private',{method:'POST',tok:C,body:{on:true}});
/* A11：アカウントを消すと、本人の登録・証拠・確認の記録も消える */
const nrev=async()=>(await DB.prepare(`SELECT COUNT(*) AS c FROM rank_reviews WHERE team_id=?`).bind(L1).first()).c;
expect('消す前は確認の記録がある',(await nrev())>0,'');
r=await call('/api/me/delete',{method:'POST',tok:C,body:{confirm:'DELETE'}});
expect('アカウントを消すと game_profiles も消える',(await DB.prepare(`SELECT COUNT(*) AS c FROM game_profiles`).first()).c===0,r);
expect('アカウントを消すと登録と確認の記録も消える',!(await DB.prepare(`SELECT id FROM season_teams WHERE id=?`).bind(L1).first())&&(await nrev())===0,'');
expect('アカウントを消すと証拠のスクリーンショットも消える',(await getM(pC,ADM))===404,'');
/* 本人が登録を消したときも、確認の記録を消す */
{const rv=(await DB.prepare(`SELECT COUNT(*) AS c FROM rank_reviews WHERE team_id=?`).bind(TA).first()).c;
 r=await call(`/api/seasons/teams/${TA}/delete`,{method:'POST',tok:A,body:{}});
 expect('本人が登録を消すと確認の記録も消える',r[0]===200&&rv>0&&(await DB.prepare(`SELECT COUNT(*) AS c FROM rank_reviews WHERE team_id=?`).bind(TA).first()).c===0,[rv,r])}
/* 記事から集計・運営が登録はカードの実績に出さない（本人のものと確かめられない） */
{const did=await uidOf('dan');await DB.prepare(`UPDATE season_teams SET uid=?,season_id=? WHERE id=?`).bind(did,S,L3).run();
 r=await call('/api/u/dan');expect('運営が登録の行はカードの実績に出さない',!r[1].user.results.some(x=>x.source==='operator')&&r[1].user.results.every(x=>x.source==='self'||x.source==='verified'),r[1].user.results)}

Date.now=realNow;
console.log(bad?`ranksrc: NG（${bad}件）`:`ranksrc: OK（${n}項目）`);if(bad)process.exitCode=1;
