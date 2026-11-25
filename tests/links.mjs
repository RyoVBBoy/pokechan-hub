// タイムラインのリンク（docs/secure-link-posting-handoff.md）のサーバーの確認。
// 本物のサーバーのプログラム（worker/dist/worker.js）を、D1 のまね（Node の SQLite）と、にせものの安全確認（Web Risk）で動かす。
// 外には一切つながない（fetch はすべてこの中で答える。行き先のサイトを開いていないことも数えて確かめる）。危険なサイトは使わない（作った名前だけ）。
import path from 'node:path';
import {makeD1} from './d1mock.mjs';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const PID='pokechan-test';
const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const kp=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...(await crypto.subtle.exportKey('jwk',kp.publicKey)),kid:'k1',use:'sig',alg:'RS256'};
const T0=Math.floor(Date.now()/1000);
/* テスト用の署名つきトークン（本番の確かめを飛ばす仕組みではない：同じ verifyIdToken が公開鍵で確かめる） */
const tok=async(uid,o={})=>{const h=enc({alg:'RS256',kid:'k1',typ:'JWT'}),p=enc({iss:'https://securetoken.google.com/'+PID,aud:PID,sub:uid,iat:T0-10,exp:T0+3600*24*400,auth_time:T0-10,
  ...(o.email===null?{}:{email:o.email||uid+'@mail.test-gk.net'}),...(o.verified===false?{}:{email_verified:true})});
  return h+'.'+p+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',kp.privateKey,new TextEncoder().encode(h+'.'+p))).toString('base64url')};
globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
/* にせものの Web Risk：リンクの名前で答えを変える */
const WR={calls:[],mode:{}},OUT=[];
const WR_KEY='wr-test-key-DO-NOT-LEAK-1234567890';
globalThis.fetch=async(u,o={})=>{u=String(u);OUT.push(u);
  if(u.includes('securetoken@system.gserviceaccount.com'))return new Response(JSON.stringify({keys:[jwk]}));
  if(u.startsWith('https://webrisk.googleapis.com/v1/uris:search?')){
    const q=new URL(u),uri=q.searchParams.get('uri');WR.calls.push({uri,types:q.searchParams.getAll('threatTypes'),key:(o.headers||{})['x-goog-api-key'],inUrl:u.includes(WR_KEY),redirect:o.redirect});
    const m=Object.entries(WR.mode).find(([k])=>uri.includes(k));const md=m?m[1]:'clean';
    if(md==='clean')return new Response('{}',{status:200});
    if(md==='unsafe')return new Response(JSON.stringify({threat:{threatTypes:['SOCIAL_ENGINEERING'],expireTime:new Date(Date.now()+36e5).toISOString()}}));
    if(md==='unsafe-past')return new Response(JSON.stringify({threat:{threatTypes:['MALWARE'],expireTime:'2000-01-01T00:00:00Z'}}));
    if(md==='error')return new Response('oops',{status:500});
    if(md==='quota')return new Response('{}',{status:429});
    if(md==='malformed')return new Response(JSON.stringify({threat:{threatTypes:['NOT_A_TYPE']}}));
    if(md==='malformed2')return new Response('not json');
    if(md==='extra')return new Response(JSON.stringify({threat:{threatTypes:['MALWARE']},x:1}));
    if(md==='big')return new Response('{"a":"'+'x'.repeat(20000)+'"}');
    if(md==='redirect')return new Response('',{status:302,headers:{location:'https://elsewhere.test-gk.net/'}});
    if(md==='timeout')return new Promise((_,rej)=>{o.signal&&o.signal.addEventListener('abort',()=>rej(Object.assign(new Error('aborted'),{name:'AbortError'})))});
  }
  return new Response('',{status:404})};
const w=(await import(path.join(ROOT,'worker/dist/worker.js'))).default;
const EK='email-hmac-key-test-0123456789abcdef-v1';
const SHARED=makeD1();
const mkEnv=(x={})=>({DB:SHARED,FIREBASE_PROJECT_ID:PID,APP_TOKEN:'t',ADMIN_TOKEN:'admin-secret-123',LINKS_POST:'1',LINKS_CLICK:'1',SANCTIONS_ON:'1',EMAIL_HMAC_KEY:EK,WEBRISK_API_KEY:WR_KEY,LINKS_WEBRISK_MS:'300',...x});
let env=mkEnv();
let clock=Date.now();const realNow=Date.now;Date.now=()=>clock;const tick=(ms=16e3)=>{clock+=ms};
let ipN=0;const RESP=[];const LATER=[];
const call=async(p,{method='GET',tok,body,ip,admin,raw,E}={})=>{const h={'content-type':'application/json','cf-connecting-ip':ip||('10.0.0.'+(++ipN%250))};if(tok)h.authorization='Bearer '+tok;if(admin)h['x-admin-token']=admin;
  const r=await w.fetch(new Request('https://x.dev'+p,{method,headers:h,body:raw!==undefined?raw:body?JSON.stringify(body):undefined}),E||env,{waitUntil(p){LATER.push(p)}});
  const t=await r.text();RESP.push(t);let j={};try{j=JSON.parse(t)}catch(e){}return[r.status,j]};
const settle=async()=>{while(LATER.length)await LATER.shift()};
let bad=0,n=0;const expect=(name,cond,info)=>{n++;if(!cond){bad++;console.error('NG',name,JSON.stringify(info)?.slice(0,400))}};
const db=()=>env.DB;
const q=async(sql,...a)=>(await env.DB.prepare(sql).bind(...a).all()).results;
const clearSlots=()=>env.DB.prepare('DELETE FROM link_attempts').run();
const mk=async(uid,h,o)=>{const t=await tok(uid,o);const r=await call('/api/me',{method:'POST',tok:t,body:{handle:h,name:h.toUpperCase(),agree:true}});expect('プロフィール '+h,r[0]===200,r);return t};
const A=await mk('uA','alice'),B=await mk('uB','bob'),C=await mk('uC','carol');

/* ---------- 1. 設定（サイトに出す値） ---------- */
let r=await call('/api/links/config');expect('設定：開いている',r[0]===200&&r[1].post===true&&r[1].click===true,r);
for(const [k,v] of [['LINKS_POST',''],['SANCTIONS_ON',''],['EMAIL_HMAC_KEY','short'],['WEBRISK_API_KEY','']]){r=await call('/api/links/config',{E:{...env,[k]:v}});expect('設定：'+k+' が無ければ投稿は出さない',r[1].post===false,r)}
r=await call('/api/links/config',{E:{...env,LINKS_CLICK:''}});expect('設定：押せないとき',r[1].click===false,r);

/* ---------- 2. リンクの形（表で） ---------- */
const OKC=[
  ['note の記事（リンク欄）',{body:'S2 の構築記事です #構築',url:'https://note.com/taro/n/n0123456789ab'},'https://note.com/taro/n/n0123456789ab','S2 の構築記事です #構築'],
  ['パラメータと #見出し',{body:'攻略',url:'https://note.com/taro/n/n0123456789ab?from=share#h2'},'https://note.com/taro/n/n0123456789ab?from=share#h2','攻略'],
  ['本文の中のリンク（日本語の句読点）',{body:'構築記事です→https://note.com/a/n/nabc。ぜひ'},'https://note.com/a/n/nabc','構築記事です→。ぜひ'],
  ['本文の中のリンク（空白で区切る）',{body:'見てください https://www.pokemonchampions.jp/ja/news/ よろしく'},'https://www.pokemonchampions.jp/ja/news/','見てください よろしく'],
  ['リンクだけの投稿',{body:'https://game8.jp/pokemon-champions/123'},'https://game8.jp/pokemon-champions/123',''],
  ['かっこの中',{body:'記事(https://note.com/a/n/nx)です'},'https://note.com/a/n/nx','記事()です'],
  ['大文字のスキーム・ホスト',{body:'x',url:'HTTPS://Note.COM/Path'},'https://note.com/Path','x'],
  ['punycode のホスト（ASCII で見せる）',{body:'x',url:'https://xn--r8jz45g.jp/'},'https://xn--r8jz45g.jp/','x'],
  ['140文字の本文＋リンク欄',{body:'あ'.repeat(140),url:'https://note.com/taro/n/n0123456789ab'},'https://note.com/taro/n/n0123456789ab','あ'.repeat(140)],
  ['画像なし・本文なし・リンク欄だけ',{body:'',url:'https://note.com/taro/n/n0123456789ab'},'https://note.com/taro/n/n0123456789ab',''],
];
const posted=[];
for(const [name,b,url,text] of OKC){await clearSlots();tick();r=await call('/api/notes',{method:'POST',tok:A,body:b});
  const row=r[1].id?(await q('SELECT n.body,l.url,l.state FROM notes n JOIN note_links l ON l.note_id=n.id WHERE n.id=?',r[1].id))[0]:null;
  expect('受け付ける：'+name,r[0]===200&&row&&row.url===url&&row.body===text&&row.state==='ok',{r,row});if(r[1].id)posted.push(r[1].id)}
expect('安全確認には #見出し を送らない',WR.calls.some(c=>c.uri==='https://note.com/taro/n/n0123456789ab?from=share')&&!WR.calls.some(c=>c.uri.includes('#')),WR.calls.map(c=>c.uri));
expect('安全確認：合言葉はヘッダーだけ（アドレスに入れない）・4種類すべて・転送しない',WR.calls.length>0&&WR.calls.every(c=>c.key===WR_KEY&&!c.inUrl&&c.types.length===4&&c.redirect==='manual'),WR.calls[0]);
expect('同じリンクは覚えた結果を使う（何度も送らない）',WR.calls.filter(c=>c.uri==='https://note.com/taro/n/n0123456789ab').length===1,WR.calls.length);
expect('リンクはハッシュタグにしない',(await q(`SELECT tag FROM note_tags`)).every(x=>x.tag==='構築'),await q(`SELECT tag FROM note_tags`));

const NGC=[
  ['http',{url:'http://note.com/a'},'http'],['javascript:',{url:'javascript:alert(1)'},'scheme'],['data:',{url:'data:text/html,<b>x</b>'},'ascii'],['data:（記号なし）',{url:'data:text/plain;base64,SGk='},'scheme'],
  ['mailto',{url:'mailto:a@b.jp'},'scheme'],['file',{url:'file:///etc/passwd'},'scheme'],['スキームなし',{url:'note.com/a'},'scheme'],['//から',{url:'//note.com/a'},'scheme'],
  ['ユーザー名・パスワード',{url:'https://user:pass@note.com/'},'cred'],['@ でごまかす',{url:'https://note.com@evil.test-gk.net/'},'cred'],
  ['ポート',{url:'https://note.com:8443/'},'port'],[':443 も書かせない',{url:'https://note.com:443/'},'port'],
  ['IPv4',{url:'https://127.0.0.1/'},'ip'],['16進の IPv4',{url:'https://0x7f.1/'},'host'],['10進の IPv4',{url:'https://2130706433/'},'host'],['IPv6',{url:'https://[::1]/'},'port'],
  ['localhost',{url:'https://localhost/'},'host'],['1語のホスト',{url:'https://intranet/'},'host'],['.local',{url:'https://printer.local/'},'internal'],['.internal',{url:'https://svc.internal/'},'internal'],
  ['末尾の点',{url:'https://note.com./'},'host'],['下線のホスト',{url:'https://a_b.com/'},'host'],['数字の TLD',{url:'https://a.123/'},'parse'],
  ['短縮URL',{url:'https://bit.ly/abc'},'short'],['t.co',{url:'https://t.co/x'},'short'],['連絡先 discord',{url:'https://discord.gg/abc'},'contact'],['連絡先 LINE',{url:'https://line.me/ti/p/x'},'contact'],
  ['向きを変える文字',{url:'https://note.com/a\u202Ecod.exe'},'ascii'],['ゼロ幅',{url:'https://no\u200Bte.com/'},'ascii'],['全角',{url:'ｈｔｔｐｓ：／／note.com'},'ascii'],
  ['日本語のホスト',{url:'https://例え.jp/'},'ascii'],['空白',{url:'https://note.com/a b'},'ascii'],['制御文字',{url:'https://note.com/\u0007'},'ascii'],
  ['%で書いた向きを変える文字',{url:'https://note.com/%E2%80%AEgpj.exe'},'ambiguous'],['%00',{url:'https://note.com/%00'},'ambiguous'],['こわれた%',{url:'https://note.com/%zz'},'enc'],['途中の%',{url:'https://note.com/%E2%80'},'enc'],
  ['ホストの%',{url:'https://exa%6dple.com/'},'enc'],['\\',{url:'https://note.com\\@evil.test-gk.net/'},'backslash'],
  ['転送（パラメータ）',{url:'https://note.com/x?redirect=https://evil.test-gk.net'},'redirect'],['転送（%で書いた）',{url:'https://note.com/x?u=https%3A%2F%2Fevil.test-gk.net'},'redirect'],
  ['転送（ドメインだけ）',{url:'https://note.com/x?url=evil.test-gk.net/a'},'redirect'],['転送（パスの中）',{url:'https://note.com/out/https://evil.test-gk.net'},'redirect'],
  ['ログインの印',{url:'https://note.com/x?access_token=abc'},'sens'],['#のあとのログインの印',{url:'https://note.com/cb#access_token=abc&state=1'},'sens'],['#のあとの転送',{url:'https://note.com/cb#next=//evil.test-gk.net'},'redirect'],['合言葉',{url:'https://note.com/x?password=1'},'sens'],['key',{url:'https://note.com/x?KEY=1'},'sens'],
  ['HTML（"<>）',{url:'https://note.com/"><script>alert(1)</script>'},'ascii'],['NGワード（%で書いた）',{url:'https://note.com/%E6%AD%BB%E3%81%AD'},'ng'],
  ['長すぎる',{url:'https://note.com/'+'a'.repeat(2100)},'long'],['数字',{url:123},'type'],['配列',{url:['https://note.com/']},'type'],['物',{url:{href:'https://note.com/'}},'type'],
];
const LKE=(await import(path.join(ROOT,'worker/dist/worker.js')));
for(const [name,b,code] of NGC){await clearSlots();tick();const before=(await q('SELECT COUNT(*) AS c FROM notes'))[0].c;
  r=await call('/api/notes',{method:'POST',tok:A,body:{body:'本文',...b}});
  const after=(await q('SELECT COUNT(*) AS c FROM notes'))[0].c;
  expect('断る：'+name+'（'+code+'）',r[0]===400&&after===before&&r[1].code===code&&typeof r[1].error==='string',{r,code})}
const NGT=[['2つのリンク','a https://note.com/a b https://note.com/b','multi'],['本文とリンク欄の両方',null,'dup'],['リンク＋ドメインの書き方','https://note.com/a と www.note.com','bare'],['リンク＋.com','https://note.com/a 見て evil.com','bare'],
  ['前が英字','evilhttps://note.com/a','edge'],['後ろが記号','https://note.com/a<b>','edge'],['全角のスキーム（本文）','ｈｔｔｐｓ：／／note.com/a',null],['http（本文）','http://note.com/a','http'],['javascript（本文）','javascript://note.com/%0aalert(1)',null],
  ['NGワード（本文）','https://note.com/a 死ね','ng'],['連絡先（本文）','https://discord.gg/abc','contact']];
for(const [name,t,code] of NGT){await clearSlots();tick();r=await call('/api/notes',{method:'POST',tok:A,body:t===null?{body:'見て https://note.com/a',url:'https://note.com/b'}:{body:t}});expect('断る（本文）：'+name,r[0]===400&&(code?r[1].code===code:/リンク/.test(r[1].error)),r)}
/* 本文の型・長さ（形を直す前に） */
tick();r=await call('/api/notes',{method:'POST',tok:A,body:{body:{x:1}}});expect('本文が文字でなければ断る',r[0]===400,r);
tick();r=await call('/api/notes',{method:'POST',tok:A,body:{body:'あ'.repeat(1300)}});expect('とても長い本文は形を直す前に断る',r[0]===400,r);
tick();r=await call('/api/notes',{method:'POST',tok:A,body:{body:'あ'.repeat(141),url:'https://note.com/taro/n/n0123456789ab'}});expect('141文字はリンク欄があっても断る',r[0]===400,r);
tick();r=await call('/api/notes',{method:'POST',tok:A,body:{body:'あ'.repeat(140)+' https://note.com/taro/n/n0123456789ab'}});expect('本文の中のリンクは140文字に数えない',r[0]===200,r);
tick();r=await call('/api/notes',{method:'POST',tok:A,raw:'{"body":"x","url":"https://note.com/a"'});expect('こわれた JSON',r[0]===400,r);
tick();r=await call('/api/notes',{method:'POST',tok:A,body:{body:'リンクなしのふつうの投稿 #雑談'}});expect('リンクなしの投稿は前と同じ',r[0]===200,r);
tick();r=await call('/api/notes',{method:'POST',tok:A,body:{body:'見て example.com'}});expect('リンクなしでもドメインの書き方は前と同じく断る',r[0]===400,r);
expect('断ったものは安全確認に送らない',!WR.calls.some(c=>/evil|bit\.ly|127|localhost|discord|line\.me|access_token/.test(c.uri)),WR.calls.map(c=>c.uri));

/* ---------- 3. 回数の枠（断ったものも数える・同時に送っても枠をこえない） ---------- */
await clearSlots();tick();
r=await call('/api/notes',{method:'POST',tok:B,body:{body:'x',url:'http://bad'}});
r=await call('/api/notes',{method:'POST',tok:B,body:{body:'x',url:'https://note.com/ok1'}});expect('断ったものも10秒の枠に数える',r[0]===429,r);
await clearSlots();tick();
{const rs=await Promise.all([1,2,3,4,5,6].map(i=>call('/api/notes',{method:'POST',tok:B,body:{body:'同時'+i,url:'https://note.com/par'+i}})));
  expect('同時に6件送っても、リンク付きは1件だけ',rs.filter(x=>x[0]===200).length===1&&rs.filter(x=>x[0]===429).length===5,rs.map(x=>x[0]))}
await clearSlots();{let ok=0;for(let i=0;i<14;i++){tick(11e3);const x=await call('/api/notes',{method:'POST',tok:B,body:{body:'h'+i,url:'https://note.com/h'+i}});if(x[0]===200)ok++}
  expect('1時間に12回まで',ok<=12,ok)}

/* ---------- 4. 安全確認の答え ---------- */
const tryLink=async(t,url)=>{await clearSlots();tick();return call('/api/notes',{method:'POST',tok:t,body:{body:'確認',url}})};
for(const [md,host,st] of [['unsafe','unsafe-fixture',400],['unsafe-past','unsafe-past-fixture',400],['error','err-fixture',503],['quota','quota-fixture',503],['malformed','malformed-fixture',503],['malformed2','malformed2-fixture',503],
  ['extra','extra-fixture',503],['big','big-fixture',503],['redirect','redirect-fixture',503],['timeout','timeout-fixture',503]]){
  WR.mode[host]=md;const before=(await q('SELECT COUNT(*) AS c FROM notes'))[0].c;
  r=await tryLink(C,`https://${host}.test-gk.net/page`);
  expect('安全確認 '+md+' → 投稿しない（閉じる）',r[0]===st&&(await q('SELECT COUNT(*) AS c FROM notes'))[0].c===before&&!/安全です|safe/i.test(r[1].error||''),r)}
expect('危険の判定は記録する（URL そのものは残さない）',(await q(`SELECT kind,host,detail FROM link_events WHERE kind='reject_unsafe'`)).length===2&&!(await q(`SELECT * FROM link_events`)).some(e=>JSON.stringify(e).includes('/page')),await q(`SELECT * FROM link_events WHERE kind='reject_unsafe'`));
expect('危険の判定だけで停止しない',(await q(`SELECT banned FROM users WHERE uid='uC'`))[0].banned===0&&(await q(`SELECT COUNT(*) AS c FROM sanctions`))[0].c===0,'');
tick();r=await call('/api/notes',{method:'POST',tok:C,body:{body:'安全確認が止まっていてもリンクなしは投稿できる'}});expect('安全確認が使えなくてもリンクなしは投稿できる',r[0]===200,r);
r=await tryLink(C,'https://err-fixture.test-gk.net/page');expect('失敗は覚えない（次もまた確かめる）',r[0]===503,r);
/* 合言葉がない・1日の回数 */
{const E=mkEnv({WEBRISK_API_KEY:''});env=E;const X=await mk('uX','xavier');r=await tryLink(X,'https://note.com/nokey');expect('合言葉がなければ閉じる',r[0]===503,r);
  r=await call('/api/notes',{method:'POST',tok:X,body:{body:'ふつう'}});tick();expect('合言葉がなくてもリンクなしは投稿できる',r[0]===200,r)}
{env=mkEnv({LINKS_WEBRISK_DAY:'2'});await env.DB.prepare('DELETE FROM link_quota').run();const X=await mk('uX','xavier');let s=[];for(const i of [1,2,3]){s.push((await tryLink(X,'https://note.com/day'+i))[0])}
  expect('1日の安全確認の回数をこえたら閉じる',s[0]===200&&s[1]===200&&s[2]===503,s)}
{env=mkEnv({SANCTIONS_ON:''});const X=await mk('uX','xavier');r=await tryLink(X,'https://note.com/nosanc');expect('利用停止の記録が止まっていればリンクは付けられない',r[0]===503,r)}
{env=mkEnv();const X=await mk('uX','xavier',{verified:false});r=await tryLink(X,'https://note.com/unv');expect('メール未確認の人はリンクを付けられない',r[0]===403,r);
  const Y=await mk('uY','yuki',{email:null});r=await tryLink(Y,'https://note.com/nomail');expect('メールのない人はリンクを付けられない',r[0]===403,r);
  r=await call('/api/notes',{method:'POST',tok:Y,body:{body:'メールがなくてもふつうの投稿はできる'}});expect('メールがなくてもふつうの投稿',r[0]===200,r)}
/* 止めているとき：前の動きのまま（リンク欄は黙って捨てない） */
{env=mkEnv({LINKS_POST:''});const X=await mk('uX','xavier');tick();const wr0=WR.calls.length;
  r=await call('/api/notes',{method:'POST',tok:X,body:{body:'見てね https://note.com/a'}});expect('止めているとき：本文のリンクは前と同じく断る',r[0]===400&&/リンク/.test(r[1].error),r);
  tick();r=await call('/api/notes',{method:'POST',tok:X,body:{body:'x',url:'https://note.com/a'}});expect('止めているとき：リンク欄も断る（黙って捨てない）',r[0]===400,r);
  tick();r=await call('/api/notes',{method:'POST',tok:X,body:{body:'ふつう'}});expect('止めているとき：ふつうの投稿',r[0]===200,r);
  expect('止めているとき：安全確認に送らない',WR.calls.length===wr0,WR.calls.slice(wr0))}

/* ---------- 5. 一覧・押したとき ---------- */
env=mkEnv();
const P=await mk('uP','pat'),V=await mk('uV','vic'),K=await mk('uK','kagi');
tick();r=await call('/api/notes',{method:'POST',tok:P,body:{body:'記事 #攻略',url:'https://note.com/pat/n/n1'}});const pn=r[1].id;expect('リンク付きの投稿',r[0]===200,r);
r=await call('/api/tl');{const x=r[1].notes.find(n=>n.id===pn);expect('一覧に ulink（ホスト・アドレス・状態だけ）',x&&x.ulink&&x.ulink.url==='https://note.com/pat/n/n1'&&x.ulink.host==='note.com'&&x.ulink.state==='ok'&&x.link===null,x)}
expect('一覧に uid・メール・ハッシュを出さない',!RESP.slice(-1)[0].match(/uP|mail\.test-gk|ehash|verdict/),'');
tick();r=await call(`/api/notes/${pn}/repost`,{method:'POST',tok:V,body:{}});r=await call('/api/tl');expect('リポストにもリンク',r[1].notes.find(n=>n.rp&&n.id===pn)?.ulink?.state==='ok',r[1].notes[0]);
tick();await clearSlots();r=await call('/api/notes',{method:'POST',tok:V,body:{body:'返信',reply_to:pn,url:'https://note.com/vic/n/r1'}});const rn=r[1].id;expect('返信にもリンク',r[0]===200,r);
r=await call(`/api/notes/${pn}/replies`);expect('返信の一覧にリンク',r[1].notes[0]?.ulink?.url==='https://note.com/vic/n/r1',r[1]);
r=await call(`/api/notes/${rn}`);expect('1件の画面にリンク',r[1].note.ulink.state==='ok',r);
r=await call('/api/search?q='+encodeURIComponent('#攻略'));expect('タグの検索にリンク',r[1].notes[0]?.ulink?.state==='ok',r[1]);
r=await call('/api/u/pat/notes');expect('プロフィールの投稿にリンク',r[1].notes[0]?.ulink?.state==='ok',r[1]);
await call(`/api/notes/${pn}/bookmark`,{method:'POST',tok:V,body:{on:true}});r=await call('/api/me/bookmarks',{tok:V});expect('ブックマークにリンク',r[1].notes[0]?.ulink?.state==='ok',r[1]);
r=await call('/api/search?q=note.com');expect('リンクは本文の検索に出ない（本文に入れていない）',!r[1].notes.some(n=>n.id===pn),r[1].notes.map(n=>n.id));
/* 押す */
const outBefore=OUT.filter(u=>u.includes('note.com/pat')&&!u.startsWith('https://webrisk')).length;
r=await call(`/api/links/${pn}/open`,{method:'POST',body:{}});expect('押す：見られる投稿なら行き先を返す（ログインなしでも）',r[0]===200&&r[1].url==='https://note.com/pat/n/n1'&&r[1].host==='note.com',r);
r=await call(`/api/links/${pn}/open`,{method:'GET'});expect('押す：GET では開かない',r[0]===404||r[0]===405,r);
r=await call(`/api/links/${pn}/open`,{method:'POST',body:{},E:{...env,LINKS_CLICK:''}});expect('押す：止めているときは開かない',r[0]===403&&r[1].inert,r);
r=await call(`/api/links/999999/open`,{method:'POST',body:{}});expect('押す：ない投稿',r[0]===404,r);
/* 期限が切れた判定は押したときに確かめ直す（危険になっていたら押せない文字に） */
WR.mode['note.com/pat/n/n1']='unsafe';tick(31*60e3);
r=await call(`/api/links/${pn}/open`,{method:'POST',body:{}});expect('押す：期限が切れたら確かめ直し、危険なら開かない',r[0]===410&&r[1].inert,r);
r=await call(`/api/notes/${pn}`);expect('危険になったリンクは一覧でもアドレスを出さない',r[1].note.ulink&&r[1].note.ulink.state==='blocked'&&!r[1].note.ulink.url,r[1].note.ulink);
expect('サーバーは行き先を一度も開いていない',OUT.filter(u=>u.includes('note.com/pat')&&!u.startsWith('https://webrisk')).length===outBefore&&OUT.every(u=>u.startsWith('https://webrisk.googleapis.com/')||u.includes('securetoken@system')),OUT.filter(u=>!u.startsWith('https://webrisk')&&!u.includes('securetoken')));
tick();await clearSlots();r=await call('/api/notes',{method:'POST',tok:P,body:{body:'2つ目',url:'https://note.com/pat/n/n2'}});const pn2=r[1].id;
WR.mode['note.com/pat/n/n2']='error';tick(31*60e3);r=await call(`/api/links/${pn2}/open`,{method:'POST',body:{}});expect('押す：確かめられなければ開かない（閉じる）',r[0]===503,r);
delete WR.mode['note.com/pat/n/n2'];r=await call(`/api/links/${pn2}/open`,{method:'POST',body:{}});expect('押す：確かめられたら開く',r[0]===200,r);
/* 見られない投稿のリンクは返さない */
await call('/api/me/private',{method:'POST',tok:K,body:{on:true}});tick();await clearSlots();r=await call('/api/notes',{method:'POST',tok:K,body:{body:'鍵の中',url:'https://note.com/kagi/n/1'}});const kn=r[1].id;
r=await call(`/api/links/${kn}/open`,{method:'POST',tok:V,body:{}});expect('鍵の投稿のリンクは、許可されていない人には返さない',r[0]===404,r);
r=await call(`/api/links/${kn}/open`,{method:'POST',tok:K,body:{}});expect('鍵の投稿のリンクも本人には返す',r[0]===200,r);
r=await call('/api/admin/delete',{method:'POST',admin:'admin-secret-123',body:{kind:'note',id:pn2}});r=await call(`/api/links/${pn2}/open`,{method:'POST',body:{}});expect('非表示の投稿のリンクは返さない',r[0]===404,r);
/* 古い行・こわれた行（直接書かれた値）も押せない文字 */
await env.DB.prepare(`INSERT INTO notes(uid,body,created_at,ip) VALUES('uP','古い行',?,'')`).bind(clock).run();const old=(await q('SELECT MAX(id) AS id FROM notes'))[0].id;
await env.DB.prepare(`INSERT INTO note_links(note_id,uid,url,host,state,verdict_at,expires_at,created_at,updated_at) VALUES(?,'uP','javascript:alert(1)','x','ok',?,?,?,?)`).bind(old,clock,clock+9e9,clock,clock).run();
r=await call(`/api/notes/${old}`);expect('こわれたリンクの行は押せない（アドレスを出さない）',r[1].note.ulink.state==='blocked'&&!r[1].note.ulink.url,r[1].note);
r=await call(`/api/links/${old}/open`,{method:'POST',body:{}});expect('こわれたリンクの行は開かない',r[0]===410,r);
{let c=0;for(let i=0;i<62;i++){const x=await call(`/api/links/${rn}/open`,{method:'POST',tok:V,body:{}});if(x[0]===429)c++}expect('押す回数の枠（1時間60回）',c>=1,c)}

/* ---------- 6. 通報・運営者 ---------- */
tick();await clearSlots();r=await call('/api/notes',{method:'POST',tok:P,body:{body:'通報される',url:'https://note.com/pat/n/rep'}});const rp=r[1].id;
WR.mode['note.com/pat/n/rep']='unsafe';tick(11*60e3);
r=await call(`/api/notes/${rp}/report`,{method:'POST',tok:V,body:{reason:'フィッシング・危険なリンク'}});await settle();
expect('通報で確かめ直し、危険ならリンクだけ止める（投稿・アカウントはそのまま）',(await q('SELECT state FROM note_links WHERE note_id=?',rp))[0].state==='unsafe'&&(await q('SELECT hidden FROM notes WHERE id=?',rp))[0].hidden===0&&(await q(`SELECT banned FROM users WHERE uid='uP'`))[0].banned===0,await q('SELECT * FROM note_links WHERE note_id=?',rp));
r=await call('/api/reasons');expect('通報の理由に「フィッシング・危険なリンク」',r[1].reasons.includes('フィッシング・危険なリンク'),r);
r=await call('/api/admin/links');expect('運営者のリンクの一覧は管理者だけ',r[0]===401,r);
r=await call('/api/admin/links',{admin:'admin-secret-123'});expect('運営者のリンクの一覧',r[0]===200&&r[1].links.some(x=>x.note_id===rp&&x.state==='unsafe')&&r[1].flags.post===true,r[1].flags);
expect('運営者の一覧にもメール・ハッシュ・合言葉を出さない',!/mail\.test-gk|ehash|wr-test-key|email-hmac/.test(JSON.stringify(r[1])),'');
r=await call(`/api/admin/links/${pn2}`,{method:'POST',admin:'admin-secret-123',body:{action:'quarantine',confirm:true}});expect('止めるには理由が要る',r[0]===400,r);
r=await call(`/api/admin/links/${pn2}`,{method:'POST',admin:'admin-secret-123',body:{action:'quarantine',reason:'確認のため止める'}});expect('止めるには確認が要る',r[0]===400,r);
r=await call(`/api/admin/links/${pn2}`,{method:'POST',body:{action:'quarantine',reason:'確認のため止める',confirm:true}});expect('止めるのは管理者だけ',r[0]===401,r);
r=await call(`/api/admin/links/${rn}`,{method:'POST',admin:'admin-secret-123',body:{action:'quarantine',reason:'確認のため止める',confirm:true}});expect('運営者が止められる',r[0]===200&&r[1].state==='quarantined',r);
r=await call(`/api/links/${rn}/open`,{method:'POST',tok:P,body:{}});expect('止めたリンクは開かない',r[0]===410,r);
r=await call(`/api/admin/links/${rp}`,{method:'POST',admin:'admin-secret-123',body:{action:'restore',reason:'誤判定の確認',confirm:true}});expect('危険のままなら戻せない',r[0]===409,r);
r=await call(`/api/admin/links/${rn}`,{method:'POST',admin:'admin-secret-123',body:{action:'restore',reason:'問題なしと確認',confirm:true}});expect('新しい確認で問題なければ戻せる',r[0]===200&&r[1].state==='ok',r);

/* ---------- 7. 利用停止の記録・確認済みメール ---------- */
env=mkEnv();
const Z=await mk('uZ','zed',{email:'Zed.Attacker+gk@Mail.Test-GK.net'}),N=await mk('uN','neighbor'),O=await mk('uO','olive',{email:null});
tick();r=await call('/api/notes',{method:'POST',tok:Z,body:{body:'ふつうの投稿'}});
expect('確認済みメールはハッシュだけを記録（生のメールは残さない）',(await q(`SELECT ehash,kver FROM user_emails WHERE uid='uZ'`)).length===1&&!JSON.stringify(await q(`SELECT * FROM user_emails`)).toLowerCase().includes('zed.attacker'),await q(`SELECT * FROM user_emails`));
r=await call('/api/admin/sanctions',{method:'POST',body:{handle:'zed',kind:'perpetrator',reason:'意図的な攻撃のリンク',evidence:'link#1',confirm:'SANCTION'}});expect('利用停止は管理者だけ',r[0]===401,r);
r=await call('/api/admin/sanctions',{method:'POST',admin:'admin-secret-123',body:{handle:'zed',kind:'perpetrator',evidence:'link#1',confirm:'SANCTION'}});expect('理由が要る',r[0]===400,r);
r=await call('/api/admin/sanctions',{method:'POST',admin:'admin-secret-123',body:{handle:'zed',kind:'perpetrator',reason:'意図的な攻撃のリンク',confirm:'SANCTION'}});expect('根拠の番号が要る',r[0]===400,r);
r=await call('/api/admin/sanctions',{method:'POST',admin:'admin-secret-123',body:{handle:'zed',kind:'perpetrator',reason:'意図的な攻撃のリンク',evidence:'link#1',confirm:true}});expect('確認の言葉が要る',r[0]===400,r);
r=await call('/api/admin/sanctions',{method:'POST',admin:'admin-secret-123',body:{handle:'zed',kind:'perpetrator',reason:'意図的な攻撃のリンク',evidence:'link#1',confirm:'SANCTION'},E:{...env,SANCTIONS_ON:''}});expect('SANCTIONS_ON が無ければ作れない',r[0]===503,r);
r=await call('/api/admin/sanctions',{method:'POST',admin:'admin-secret-123',body:{handle:'zed',kind:'perpetrator',reason:'意図的な攻撃のリンク',evidence:'link#1',confirm:'SANCTION'}});
expect('確かめた攻撃者：いつまでもの停止＋確認済みメールの記録',r[0]===200&&r[1].permanent&&r[1].email==='recorded',r);const zs=r[1].id;
tick();r=await call('/api/notes',{method:'POST',tok:Z,body:{body:'停止中'}});expect('停止中は投稿できない（前に作ったログインのままでも）',r[0]===403&&r[1].sanction&&r[1].sanction.permanent,r);
r=await call('/api/media',{method:'POST',tok:Z,raw:'x'});expect('停止中は画像も送れない',r[0]===403,r);
r=await call('/api/dm/send',{method:'POST',tok:Z,body:{to:'neighbor',body:'hi'}});expect('停止中はメッセージも送れない',r[0]===403,r);
r=await call('/api/me',{tok:Z});expect('停止中：/api/me は理由を返す',r[0]===403&&/停止/.test(r[1].error),r);
r=await call('/api/me/teams',{tok:Z});expect('停止中：ほかの /api/me も止める',r[0]===403,r);
r=await call('/api/tl',{tok:Z});expect('停止中でも、ログインしていない人と同じように読める',r[0]===200,r[0]);
r=await call('/api/u/zed');expect('停止中の人のプロフィールは出ない',r[0]===404,r);
expect('停止の記録で banned=2',(await q(`SELECT banned FROM users WHERE uid='uZ'`))[0].banned===2,'');
/* 同じ確認済みメールの新しい UID */
for(const [name,o,st] of [['同じメール（大文字小文字だけ違う）',{email:'zed.attacker+gk@mail.test-gk.net'},403],['同じメール',{email:'Zed.Attacker+gk@Mail.Test-GK.net'},403],
  ['+ が違う（別のアドレスとして扱う）',{email:'zed.attacker@mail.test-gk.net'},200],['. が違う（別のアドレス）',{email:'zedattacker+gk@mail.test-gk.net'},200],['同じメールでも未確認（結びつけない）',{email:'zed.attacker+gk@mail.test-gk.net',verified:false},200]]){
  const t=await tok('new-'+name,o);r=await call('/api/me',{method:'POST',tok:t,body:{handle:'n'+Math.abs([...name].reduce((a,c)=>a*31+c.charCodeAt(0)|0,7)).toString(36).slice(0,10),name:'New',agree:true}});expect('新しい UID：'+name,r[0]===st,r)}
{const t=await tok('forger',{email:'other@mail.test-gk.net'});r=await call('/api/me',{method:'POST',tok:t,body:{handle:'forger',name:'F',agree:true,email:'zed.attacker+gk@mail.test-gk.net',email_verified:true,banned:0,sanction:null}});
  expect('送ってきた本文のメール・停止の値は使わない',r[0]===200,r)}
tick();r=await call('/api/notes',{method:'POST',tok:N,body:{body:'同じ接続元の別の人'},ip:'10.9.9.9'});expect('同じ接続元の関係ない人は止めない',r[0]===200,r);
/* 古い解除の操作で記録を飛ばせない */
r=await call('/api/admin/ban',{method:'POST',admin:'admin-secret-123',body:{handle:'zed',on:false}});expect('前からの解除でも、記録があれば停止のまま',r[0]===200&&r[1].sanctioned&&(await q(`SELECT banned FROM users WHERE uid='uZ'`))[0].banned===2,r);
r=await call('/api/admin/sanctions',{admin:'admin-secret-123'});expect('運営者の一覧（メール・ハッシュ・UID は出さない）',r[0]===200&&r[1].sanctions.some(s=>s.id===zs&&s.live===1&&s.handle==='zed')&&!/uZ"|ehash|mail\.test-gk|zed\.attacker/i.test(JSON.stringify(r[1])),r[1]);
/* メールの記録がない人 */
r=await call('/api/admin/sanctions',{method:'POST',admin:'admin-secret-123',body:{handle:'olive',kind:'perpetrator',reason:'意図的な攻撃のリンク',evidence:'link#2',confirm:'SANCTION'}});expect('メールの記録がなければ「未解決」（推測で結びつけない）',r[1].email==='unresolved',r);
/* 鍵の入れかえ */
{const E2={...env,EMAIL_HMAC_KEY:'email-hmac-key-test-NEW-0123456789abcdef',EMAIL_HMAC_KEY_VER:'v2',EMAIL_HMAC_KEY_PREV:EK,EMAIL_HMAC_KEY_PREV_VER:'v1'};
  const t=await tok('rekey-1',{email:'zed.attacker+gk@mail.test-gk.net'});r=await call('/api/me',{method:'POST',tok:t,body:{handle:'rekey1',name:'R',agree:true},E:E2});
  expect('鍵を入れかえても、前の鍵の記録で止める',r[0]===403,r);
  expect('前の鍵で見つかったら、今の鍵でも記録する',(await q(`SELECT COUNT(*) AS c FROM sanctions WHERE kind='email' AND kver='v2' AND status='active'`))[0].c===1,await q(`SELECT kind,kver,source FROM sanctions`));
  const E3={...env,EMAIL_HMAC_KEY:'email-hmac-key-test-NEW-0123456789abcdef',EMAIL_HMAC_KEY_VER:'v2',EMAIL_HMAC_KEY_PREV:''};
  r=await call('/api/me',{method:'POST',tok:await tok('rekey-2',{email:'zed.attacker+gk@mail.test-gk.net'}),body:{handle:'rekey2',name:'R',agree:true},E:E3});expect('前の鍵を外したあとも止める',r[0]===403,r)}
/* 鍵がないとき（メールの停止があるのに確かめられない）＝閉じる */
r=await call('/api/me',{method:'POST',tok:N,body:{handle:'neighbor',name:'N2'},E:{...env,EMAIL_HMAC_KEY:''}});expect('鍵がないときは、ログインした人の書きこみを閉じる',r[0]===503,r);
r=await call('/api/tl',{E:{...env,EMAIL_HMAC_KEY:''}});expect('鍵がなくても、ログインしていない人は読める',r[0]===200,r[0]);
/* 記録を読めないとき＝閉じる */
{const real=env.DB,E={...env,DB:{prepare:s=>{if(/FROM sanctions/.test(s))throw new Error('down');return real.prepare(s)},batch:l=>real.batch(l)}};
  r=await call('/api/notes',{method:'POST',tok:N,body:{body:'x'},E});expect('記録を読めなければ書きこみを閉じる',r[0]===503,r);
  r=await call('/api/tl',{E});expect('記録を読めなくても、ログインしていない人は読める',r[0]===200,r[0])
  r=await call('/api/tl',{tok:N,E});expect('記録を読めなくても、ログインした人の読むだけはログインなしと同じに続ける',r[0]===200,r[0]);
  r=await call('/api/me',{tok:N,E});expect('記録を読めなければ /api/me は閉じる',r[0]===503,r)}
/* 期限つき（つながりを確かめたアカウント）・手動の停止と並ぶとき */
const T=await mk('uT','tempo'),M=await mk('uM','manual');
r=await call('/api/admin/sanctions',{method:'POST',admin:'admin-secret-123',body:{handle:'tempo',kind:'linked',months:7,reason:'関連アカウントと確認',evidence:'case#3',confirm:'SANCTION'}});expect('期間は3〜6か月',r[0]===400,r);
r=await call('/api/admin/sanctions',{method:'POST',admin:'admin-secret-123',body:{handle:'tempo',kind:'linked',reason:'関連アカウントと確認',evidence:'case#3',confirm:'SANCTION'}});
expect('関連アカウント：はじめは90日',r[0]===200&&!r[1].permanent&&Math.round((r[1].expires_at-clock)/864e5)===90&&r[1].email==='none',r);
r=await call('/api/admin/sanctions',{method:'POST',admin:'admin-secret-123',body:{handle:'manual',kind:'temporary',months:3,reason:'関連アカウントと確認',evidence:'case#4',confirm:'SANCTION'}});expect('3か月の停止',r[0]===200,r);
await call('/api/admin/ban',{method:'POST',admin:'admin-secret-123',body:{handle:'manual'}});
expect('手動の停止をすると 1',(await q(`SELECT banned FROM users WHERE uid='uM'`))[0].banned===1,'');
tick();r=await call('/api/notes',{method:'POST',tok:T,body:{body:'期間中'}});expect('期間中は投稿できない',r[0]===403&&r[1].sanction.until>clock,r);
const save=clock;tick(95*864e5);
tick();r=await call('/api/notes',{method:'POST',tok:T,body:{body:'期限が来た'}});expect('期限が来たら投稿できる（banned=2 も戻る）',r[0]===200&&(await q(`SELECT banned FROM users WHERE uid='uT'`))[0].banned===0,r);
await w.scheduled({cron:'0 * * * *',scheduledTime:clock},env,{waitUntil(p){LATER.push(p)}});await settle();
expect('期限が来ても手動の停止（1）は戻さない',(await q(`SELECT banned FROM users WHERE uid='uM'`))[0].banned===1,'');
tick();r=await call('/api/notes',{method:'POST',tok:M,body:{body:'x'}});expect('手動の停止は続く',r[0]===403,r);
r=await call('/api/notes',{method:'POST',tok:Z,body:{body:'x'}});expect('いつまでもの停止は期限で戻らない',r[0]===403,r);
/* 取り消し・異議 */
r=await call(`/api/admin/sanctions/${zs}/reverse`,{method:'POST',admin:'admin-secret-123',body:{confirm:true}});expect('取り消しには理由が要る',r[0]===400,r);
r=await call(`/api/admin/sanctions/${zs}/appeal`,{method:'POST',admin:'admin-secret-123',body:{reason:'本人から異議',decision:'open',confirm:true}});expect('異議を記録できる',r[0]===200&&r[1].appeal==='open',r);
r=await call(`/api/admin/sanctions/${zs}/reverse`,{method:'POST',admin:'admin-secret-123',body:{reason:'誤りと確認したため取り消し',confirm:true}});expect('取り消せる',r[0]===200&&r[1].status==='reversed',r);
tick();r=await call('/api/notes',{method:'POST',tok:Z,body:{body:'取り消し後'}});expect('取り消すと投稿できる（メールの記録も取り消す）',r[0]===200,r);
r=await call('/api/me',{method:'POST',tok:await tok('rekey-3',{email:'zed.attacker+gk@mail.test-gk.net'}),body:{handle:'rekey3',name:'R',agree:true}});expect('取り消したら同じメールの新しい UID も使える（鍵の写しも取り消す）',r[0]===200,r);
expect('記録の履歴（作成・メール・異議・取り消し）',(await q(`SELECT action FROM sanction_events WHERE sanction_id=? ORDER BY id`,zs)).map(x=>x.action).join(',')==='create,email_recorded,appeal_open,reverse',await q(`SELECT action FROM sanction_events WHERE sanction_id=?`,zs));
/* アカウントを消しても、いつまでもの記録は残る */
{const D=await mk('uDel','delme',{email:'del.me@mail.test-gk.net'});tick();await call('/api/notes',{method:'POST',tok:D,body:{body:'x'}});
  r=await call('/api/admin/sanctions',{method:'POST',admin:'admin-secret-123',body:{handle:'delme',kind:'perpetrator',reason:'意図的な攻撃のリンク',evidence:'link#9',confirm:'SANCTION'}});
  await env.DB.prepare(`DELETE FROM users WHERE uid='uDel'`).run();await env.DB.prepare(`DELETE FROM user_emails WHERE uid='uDel'`).run();
  r=await call('/api/me',{method:'POST',tok:await tok('uDel2',{email:'Del.Me@mail.test-gk.net'}),body:{handle:'delme2',name:'D',agree:true}});expect('アカウントを消したあとも、同じ確認済みメールは使えない',r[0]===403,r);
  r=await call('/api/me',{method:'POST',tok:D,body:{handle:'delme',name:'D',agree:true}});expect('同じ UID のまま作り直しても使えない',r[0]===403,r)}
{const D=await mk('uDel3','delthree',{email:'d3@mail.test-gk.net'});tick();await call('/api/notes',{method:'POST',tok:D,body:{body:'x'}});
  r=await call('/api/me/delete',{method:'POST',tok:D,body:{}});expect('ふつうの削除ではメールの対応も消す',r[0]===200&&(await q(`SELECT COUNT(*) AS c FROM user_emails WHERE uid='uDel3'`))[0].c===0,r)}

/* 表の移しかえ（古い表・何度も・同時）は tests/links-migrate.mjs（別のプロセスで、まっさらの D1 から） */
/* ---------- 9. 合言葉をどこにも出さない ---------- */
expect('Web Risk の合言葉・メールの鍵・メールは返事に出ない',!RESP.some(t=>t.includes(WR_KEY)||t.includes('email-hmac-key')||/zed\.attacker|mail\.test-gk\.net/i.test(t)),RESP.find(t=>t.includes(WR_KEY)));
Date.now=realNow;
console.log(bad?`links: NG（${bad}/${n}）`:`links: OK（${n}項目）`);
if(bad)process.exit(1);
