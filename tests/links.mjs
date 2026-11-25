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
const WR={calls:[],mode:{},pending:[]},OUT=[];
const WR_KEY='wr-test-key-DO-NOT-LEAK-1234567890';
globalThis.fetch=async(u,o={})=>{u=String(u);OUT.push(u);
  if(u.includes('securetoken@system.gserviceaccount.com'))return new Response(JSON.stringify({keys:[jwk]}));
  if(u.startsWith('https://webrisk.googleapis.com/v1/uris:search?')){
    const q=new URL(u),uri=q.searchParams.get('uri');WR.calls.push({uri,types:q.searchParams.getAll('threatTypes'),key:(o.headers||{})['x-goog-api-key'],inUrl:u.includes(WR_KEY),redirect:o.redirect});
    const m=Object.entries(WR.mode).find(([k])=>uri.includes(k));const md=m?m[1]:'clean';
    if(md==='defer')return new Promise(res=>WR.pending.push({uri,res}));
    if(md==='clean')return new Response('{}',{status:200});
    if(md==='unsafe')return new Response(JSON.stringify({threat:{threatTypes:['SOCIAL_ENGINEERING'],expireTime:new Date(Date.now()+36e5).toISOString()}}));
    if(md==='unsafe-3d')return new Response(JSON.stringify({threat:{threatTypes:['MALWARE'],expireTime:new Date(Date.now()+3*864e5).toISOString()}}));
    if(md==='unsafe-noexp')return new Response(JSON.stringify({threat:{threatTypes:['MALWARE']}}));
    if(md==='unsafe-badexp')return new Response(JSON.stringify({threat:{threatTypes:['MALWARE'],expireTime:'tomorrow'}}));
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
/* 日本時間の暦の月（テストの期待値の計算用。サーバーの jstAddMonths と別に書く） */
const jstAddMonthsT=(ms,mo)=>{const d=new Date(ms+9*3600e3);d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+mo);return d.getTime()-9*3600e3};
let clock=Date.now();const realNow=Date.now;Date.now=()=>clock;const tick=(ms=16e3)=>{clock+=ms};
let ipN=0;const RESP=[];const LATER=[];
const call=async(p,{method='GET',tok,body,ip,admin,raw,E,W}={})=>{const h={'content-type':'application/json','cf-connecting-ip':ip||('10.0.0.'+(++ipN%250))};if(tok)h.authorization='Bearer '+tok;if(admin)h['x-admin-token']=admin;
  const r=await (W||w).fetch(new Request('https://x.dev'+p,{method,headers:h,body:raw!==undefined?raw:body?JSON.stringify(body):undefined}),E||env,{waitUntil(p){LATER.push(p)}});
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
{env=mkEnv({LINKS_WEBRISK_DAY:'2'});await env.DB.prepare('DELETE FROM link_budget').run();const X=await mk('uX','xavier');let s=[];for(const i of [1,2,3]){s.push((await tryLink(X,'https://note.com/day'+i))[0])}
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

/* ---------- 5. 一覧（ホストと状態だけ）・押したとき（2段階：open → 確認の画面 → go） ---------- */
env=mkEnv();
const P=await mk('uP','pat'),V=await mk('uV','vic'),K=await mk('uK','kagi');
const IPV='10.77.0.1';
const openGo=async(id,o={})=>{const a=await call(`/api/links/${id}/open`,{method:'POST',tok:o.tok,body:{},ip:o.ip||IPV,E:o.E});if(a[0]!==200)return[a[0],a[1],'open'];
  const g=await call(`/api/links/${id}/go`,{method:'POST',tok:o.tok,body:{intent:a[1].intent},ip:o.ip||IPV,E:o.E});return[g[0],{...g[1],open:a[1]},'go']};
tick();r=await call('/api/notes',{method:'POST',tok:P,body:{body:'記事 #攻略',url:'https://note.com/pat/n/n1'}});const pn=r[1].id;expect('リンク付きの投稿',r[0]===200,r);
r=await call('/api/tl');{const x=r[1].notes.find(n=>n.id===pn);expect('一覧はホストと状態だけ（全部のアドレスは出さない）',x&&x.ulink&&x.ulink.host==='note.com'&&x.ulink.state==='ok'&&!('url' in x.ulink)&&x.link===null&&!RESP.slice(-1)[0].includes('/pat/n/n1'),x)}
r=await call('/api/tl',{E:{...env,LINKS_CLICK:''}});expect('押せないときは一覧でも state:off',r[1].notes.find(n=>n.id===pn)?.ulink?.state==='off',r[1].notes[0]);
expect('一覧に uid・メール・ハッシュを出さない',!RESP.slice(-1)[0].match(/uP|mail\.test-gk|ehash|verdict/),'');
tick();r=await call(`/api/notes/${pn}/repost`,{method:'POST',tok:V,body:{}});r=await call('/api/tl');expect('リポストにもリンク',r[1].notes.find(n=>n.rp&&n.id===pn)?.ulink?.state==='ok',r[1].notes[0]);
tick();await clearSlots();r=await call('/api/notes',{method:'POST',tok:V,body:{body:'返信',reply_to:pn,url:'https://note.com/vic/n/r1'}});const rn=r[1].id;expect('返信にもリンク',r[0]===200,r);
r=await call(`/api/notes/${pn}/replies`);expect('返信の一覧にリンク',r[1].notes[0]?.ulink?.host==='note.com',r[1]);
r=await call(`/api/notes/${rn}`);expect('1件の画面にリンク',r[1].note.ulink.state==='ok',r);
r=await call('/api/search?q='+encodeURIComponent('#攻略'));expect('タグの検索にリンク',r[1].notes[0]?.ulink?.state==='ok',r[1]);
r=await call('/api/u/pat/notes');expect('プロフィールの投稿にリンク',r[1].notes[0]?.ulink?.state==='ok',r[1]);
await call(`/api/notes/${pn}/bookmark`,{method:'POST',tok:V,body:{on:true}});r=await call('/api/me/bookmarks',{tok:V});expect('ブックマークにリンク',r[1].notes[0]?.ulink?.state==='ok',r[1]);
r=await call('/api/search?q=note.com');expect('リンクは本文の検索に出ない（本文に入れていない）',!r[1].notes.some(n=>n.id===pn),r[1].notes.map(n=>n.id));
const outBefore=OUT.filter(u=>u.includes('note.com/pat')&&!u.startsWith('https://webrisk')).length;
r=await call(`/api/links/${pn}/open`,{method:'POST',body:{},ip:IPV});expect('open：確認の画面のアドレスと、1回だけの許可（60秒）',r[0]===200&&r[1].url==='https://note.com/pat/n/n1'&&/^[0-9a-f]{32}$/.test(r[1].intent)&&r[1].ttl===60,r);
{const it=r[1].intent;
  let g=await call(`/api/links/${pn}/go`,{method:'POST',body:{intent:it},ip:'10.77.0.2'});expect('go：別の人（接続元）の許可は使えない',g[0]===410&&g[1].expired,g);
  g=await call(`/api/links/${pn}/go`,{method:'POST',body:{intent:it},ip:IPV});expect('go：もう一度確かめてからアドレス',g[0]===200&&g[1].url==='https://note.com/pat/n/n1',g);
  g=await call(`/api/links/${pn}/go`,{method:'POST',body:{intent:it},ip:IPV});expect('go：許可は1回だけ',g[0]===410&&g[1].expired,g);
  g=await call(`/api/links/${pn}/go`,{method:'POST',body:{intent:'x'},ip:IPV});expect('go：形のおかしい許可',g[0]===410,g);
  g=await call(`/api/links/${rn}/go`,{method:'POST',body:{intent:it},ip:IPV});expect('go：ほかの投稿の許可は使えない',g[0]===410,g)}
{const a=await call(`/api/links/${pn}/open`,{method:'POST',body:{},ip:IPV});tick(61e3);const g=await call(`/api/links/${pn}/go`,{method:'POST',body:{intent:a[1].intent},ip:IPV});expect('go：60秒を過ぎた許可は使えない',g[0]===410&&g[1].expired,g)}
{const a=await call(`/api/links/${pn}/open`,{method:'POST',body:{},ip:IPV});const g=await call(`/api/links/${pn}/go`,{method:'POST',body:{intent:a[1].intent},ip:IPV,E:{...env,LINKS_CLICK:''}});expect('go：確認の画面のあいだに止めたら開かない',g[0]===403&&g[1].inert,g)}
r=await call(`/api/links/${pn}/open`,{method:'GET'});expect('押す：GET では開かない',r[0]===404||r[0]===405,r);
r=await call(`/api/links/${pn}/open`,{method:'POST',body:{},E:{...env,LINKS_CLICK:''}});expect('押す：止めているときは開かない',r[0]===403&&r[1].inert,r);
r=await call(`/api/links/999999/open`,{method:'POST',body:{}});expect('押す：ない投稿',r[0]===404,r);
WR.mode['note.com/pat/n/n1']='unsafe';tick(31*60e3);
r=await openGo(pn);expect('押す：期限が切れたら確かめ直し、危険なら開かない',r[0]===410&&r[1].inert&&r[2]==='open',r);
r=await call(`/api/notes/${pn}`);expect('危険になったリンクは一覧で blocked（ホストも出さない）',r[1].note.ulink&&r[1].note.ulink.state==='blocked'&&!r[1].note.ulink.host,r[1].note.ulink);
expect('サーバーは行き先を一度も開いていない',OUT.filter(u=>u.includes('note.com/pat')&&!u.startsWith('https://webrisk')).length===outBefore&&OUT.every(u=>u.startsWith('https://webrisk.googleapis.com/')||u.includes('securetoken@system')),OUT.filter(u=>!u.startsWith('https://webrisk')&&!u.includes('securetoken')));
tick();await clearSlots();r=await call('/api/notes',{method:'POST',tok:P,body:{body:'2つ目',url:'https://note.com/pat/n/n2'}});const pn2=r[1].id;
WR.mode['note.com/pat/n/n2']='error';tick(31*60e3);r=await openGo(pn2);expect('押す：確かめられなければ開かない（閉じる）',r[0]===503,r);
delete WR.mode['note.com/pat/n/n2'];r=await openGo(pn2);expect('押す：確かめられたら開く',r[0]===200&&r[1].url,r);
await call('/api/me/private',{method:'POST',tok:K,body:{on:true}});tick();await clearSlots();r=await call('/api/notes',{method:'POST',tok:K,body:{body:'鍵の中',url:'https://note.com/kagi/n/1'}});const kn=r[1].id;
r=await openGo(kn,{tok:V});expect('鍵の投稿のリンクは、許可されていない人には返さない',r[0]===404,r);
r=await openGo(kn,{tok:K});expect('鍵の投稿のリンクも本人には返す',r[0]===200,r);
r=await call('/api/admin/delete',{method:'POST',admin:'admin-secret-123',body:{kind:'note',id:pn2}});r=await openGo(pn2);expect('非表示の投稿のリンクは返さない',r[0]===404,r);
await env.DB.prepare(`INSERT INTO notes(uid,body,created_at,ip) VALUES('uP','古い行',?,'')`).bind(clock).run();const old=(await q('SELECT MAX(id) AS id FROM notes'))[0].id;
await env.DB.prepare(`INSERT INTO note_links(note_id,uid,url,host,state,verdict_at,expires_at,created_at,updated_at) VALUES(?,'uP','javascript:alert(1)','x','ok',?,?,?,?)`).bind(old,clock,clock+9e9,clock,clock).run();
r=await call(`/api/notes/${old}`);expect('こわれたリンクの行は押せない（ホストも出さない）',r[1].note.ulink.state==='blocked'&&!r[1].note.ulink.host,r[1].note);
r=await openGo(old);expect('こわれたリンクの行は開かない',r[0]===410,r);
{let c=0;for(let i=0;i<125;i++){const x=await call(`/api/links/${rn}/open`,{method:'POST',tok:V,body:{}});if(x[0]===429)c++}expect('押す回数の枠（1時間120回・open と go の合計）',c>=1,c)}

/* ---------- 6. 確かめているあいだの変化（遅らせた安全確認で、順番を決めて確かめる） ---------- */
const waitPend=async(n=1)=>{for(let i=0;i<400&&WR.pending.length<n;i++)await new Promise(r=>setTimeout(r,5))};
const relPend=(body='{}')=>{const p=WR.pending.shift();p&&p.res(new Response(body))};
const mkLink=async(t,url)=>{tick();await clearSlots();const x=await call('/api/notes',{method:'POST',tok:t,body:{body:'race',url}});return x[1].id};
const st=async id=>(await q('SELECT state,rev FROM note_links WHERE note_id=?',id))[0];
{const id=await mkLink(P,'https://note.com/race/a');tick(31*60e3);WR.mode['note.com/race/a']='defer';
  const p=openGo(id);await waitPend();
  await call(`/api/admin/links/${id}`,{method:'POST',admin:'admin-secret-123',body:{action:'quarantine',reason:'確認のため止める',confirm:true}});
  relPend();r=await p;const s=await st(id);
  expect('確かめている途中に運営者が止めた → 開かない・止めたまま（問題なしの答えで上書きしない）',r[0]===410&&r[2]==='open'&&s.state==='quarantined',{r,s})}
{const id=await mkLink(P,'https://note.com/race/b');tick(31*60e3);WR.mode['note.com/race/b']='defer';
  const p=openGo(id);await waitPend();await call('/api/admin/delete',{method:'POST',admin:'admin-secret-123',body:{kind:'note',id}});relPend();r=await p;
  expect('確かめている途中に投稿を非表示 → 開かない',r[0]===404&&r[2]==='open',r)}
{const M=await mk('uR','rachel');const id=await mkLink(M,'https://note.com/race/c');tick(31*60e3);WR.mode['note.com/race/c']='defer';
  const p=openGo(id,{tok:V});await waitPend();await call('/api/me/private',{method:'POST',tok:M,body:{on:true}});relPend();r=await p;
  expect('確かめている途中に非公開にした → 許可されていない人には開かない',r[0]===404&&r[2]==='open',r)}
{const id=await mkLink(P,'https://note.com/race/d');
  await call(`/api/admin/links/${id}`,{method:'POST',admin:'admin-secret-123',body:{action:'quarantine',reason:'確認のため止める',confirm:true}});
  WR.mode['note.com/race/d']='defer';
  const p=call(`/api/admin/links/${id}`,{method:'POST',admin:'admin-secret-123',body:{action:'restore',reason:'問題なしと確認',confirm:true}});await waitPend();
  await call(`/api/admin/links/${id}`,{method:'POST',admin:'admin-secret-123',body:{action:'quarantine',reason:'やはり止める',confirm:true}});
  relPend();r=await p;const s=await st(id);
  expect('戻している途中にもう一度止めた → 戻さない（新しい判断を守る）',r[0]===409&&r[1].stale&&s.state==='quarantined',{r,s})}
{const id=await mkLink(P,'https://note.com/race/e');WR.mode['note.com/race/e']='defer';tick(11*60e3);
  const p=call(`/api/notes/${id}/report`,{method:'POST',tok:V,body:{reason:'フィッシング・危険なリンク'}});await waitPend();
  await call(`/api/admin/links/${id}`,{method:'POST',admin:'admin-secret-123',body:{action:'quarantine',reason:'確認のため止める',confirm:true}});
  const rv0=(await st(id)).rev;
  relPend(JSON.stringify({threat:{threatTypes:['MALWARE']}}));await p;await settle();const s=await st(id);
  expect('古い確かめ直し（通報）の答えで、運営者のあとの判断（止める）を上書きしない',s.state==='quarantined'&&s.rev===rv0,{s,rv0})}
{const id=await mkLink(P,'https://note.com/race/f');const a=await call(`/api/links/${id}/open`,{method:'POST',body:{},ip:IPV});
  await call(`/api/admin/links/${id}`,{method:'POST',admin:'admin-secret-123',body:{action:'quarantine',reason:'確認のため止める',confirm:true}});
  const g=await call(`/api/links/${id}/go`,{method:'POST',body:{intent:a[1].intent},ip:IPV});
  expect('確認の画面のあいだに止めた → 「開く」でも開かない',g[0]===410&&g[1].inert,g)}
{const id=await mkLink(P,'https://note.com/race/g');const a=await call(`/api/links/${id}/open`,{method:'POST',body:{},ip:IPV});
  await call(`/api/admin/links/${id}`,{method:'POST',admin:'admin-secret-123',body:{action:'quarantine',reason:'確認のため止める',confirm:true}});
  await call(`/api/admin/links/${id}`,{method:'POST',admin:'admin-secret-123',body:{action:'restore',reason:'問題なしと確認',confirm:true}});
  const g=await call(`/api/links/${id}/go`,{method:'POST',body:{intent:a[1].intent},ip:IPV});
  expect('止めて戻したあとは、前の許可は使えない（rev が変わる）',g[0]===410,g)}
for(const k of Object.keys(WR.mode))if(WR.mode[k]==='defer')delete WR.mode[k];

/* ---------- 7. 同時に外へ送る数（どの isolate でも共通の札）・1日の回数・覚えの順番と上限 ---------- */
{const w2=(await import(path.join(ROOT,'worker/dist/worker.js')+'?inst=2')).default;
  const E=mkEnv({LINKS_WEBRISK_CONC:'2'});await E.DB.prepare('DELETE FROM link_budget').run();
  const us=[];for(let i=0;i<4;i++)us.push(await mk('uL'+i,'lease'+i));
  WR.mode['lease-fixture']='defer';await clearSlots();tick();const q0=WR.calls.length;
  const ps=us.map((t,i)=>call('/api/notes',{method:'POST',tok:t,body:{body:'L',url:`https://note.com/lease-fixture/${i}`},E,W:i%2?w2:w}));
  await waitPend(2);await new Promise(r=>setTimeout(r,80));
  expect('2つの isolate から4つ同時でも、外へ送るのは2つまで',WR.pending.length===2,WR.pending.length);
  relPend();relPend();const rs=await Promise.all(ps);
  expect('札がとれなかったものは混み合っていると断る（503）',rs.filter(x=>x[0]===200).length===2&&rs.filter(x=>x[0]===503).length===2,rs.map(x=>x[0]));
  expect('1日・1か月の回数は、札をとれたものだけ使う',(await q('SELECT dn,mn FROM link_budget'))[0].dn===2&&(await q('SELECT dn,mn FROM link_budget'))[0].mn===2&&WR.calls.length-q0===2,await q('SELECT * FROM link_budget'));
  expect('終わったら札を返す',(await q('SELECT COUNT(*) AS c FROM link_leases WHERE expires_at>?',clock))[0].c===0,await q('SELECT * FROM link_leases'));
  delete WR.mode['lease-fixture'];
  await E.DB.prepare(`UPDATE link_leases SET holder='dead',expires_at=?`).bind(clock+36e5).run();
  tick();await clearSlots();r=await call('/api/notes',{method:'POST',tok:us[0],body:{body:'L',url:'https://note.com/lease2/x'},E});expect('札が全部使われていれば閉じる',r[0]===503,r);
  tick();r=await call('/api/notes',{method:'POST',tok:us[0],body:{body:'札がなくてもふつうの投稿'},E});expect('札がなくてもリンクなしは投稿できる',r[0]===200,r);
  await E.DB.prepare(`UPDATE link_leases SET expires_at=?`).bind(clock-1).run();
  tick(16e3);await clearSlots();r=await call('/api/notes',{method:'POST',tok:us[0],body:{body:'L',url:'https://note.com/lease2/y'},E});expect('落ちた isolate の札も期限で戻る',r[0]===200,r);
  const real=E.DB,Ebad={...E,DB:{prepare:s=>{if(/link_leases/.test(s))throw new Error('down');return real.prepare(s)},batch:l=>real.batch(l)}};
  tick(16e3);await clearSlots();r=await call('/api/notes',{method:'POST',tok:us[1],body:{body:'L',url:'https://note.com/lease3/z'},E:Ebad});expect('札の表を読めなければ閉じる',r[0]===503,r)}
{const sh=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const U='https://note.com/order/x';
  const id=await mkLink(P,U);const h=(await q('SELECT vh FROM note_links WHERE note_id=?',id))[0].vh;
  expect('覚えの鍵は方針の版ごと（リンクだけのハッシュではない）',h&&h!==await sh('lk|'+U),h);
  await env.DB.prepare(`UPDATE link_verdicts SET verdict='unsafe',types='MALWARE',checked_at=?,expires_at=? WHERE h=?`).bind(clock,clock+36e5,h).run();
  r=await call(`/api/admin/links/${id}`,{method:'POST',admin:'admin-secret-123',body:{action:'recheck',reason:'確かめ直す',confirm:true}});
  const c=(await q('SELECT verdict FROM link_verdicts WHERE h=?',h))[0];
  expect('期限内の「危険」の覚えを「問題なし」で上書きしない・答えも危険を使う',c.verdict==='unsafe'&&r[1].verdict==='unsafe',{c,r});
  const ins=[];for(let i=0;i<5100;i++)ins.push(env.DB.prepare(`INSERT OR IGNORE INTO link_verdicts(h,verdict,types,checked_at,expires_at) VALUES(?,?,?,?,?)`).bind('fill'+i,'clean','',clock-1e6+i,clock+36e5));
  await env.DB.batch(ins);await mkLink(P,'https://note.com/order/bound');
  expect('覚えは5000件まで',(await q('SELECT COUNT(*) AS c FROM link_verdicts'))[0].c<=5000,(await q('SELECT COUNT(*) AS c FROM link_verdicts'))[0].c)}

/* ---------- 8. 送られてくる中身の上限・形のおかしいもの・同時の投稿の回数 ---------- */
{const raw=async(body,ip='10.88.0.1',hdr={})=>{const rr=await w.fetch(new Request('https://x.dev/api/notes',{method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':ip,authorization:'Bearer '+A,...hdr},body,duplex:'half'}),env,{waitUntil(){}});return[rr.status,await rr.json().catch(()=>({}))]};
  const big=new ReadableStream({start(c){for(let i=0;i<40;i++)c.enqueue(new Uint8Array(10000).fill(32));c.close()}});
  r=await raw(big);expect('Content-Length のない大きな中身は、上限で読むのをやめて413',r[0]===413,r);
  let pulled=0;const huge=new ReadableStream({pull(c){pulled++;c.enqueue(new Uint8Array(65536).fill(32));if(pulled>1000)c.close()}});
  r=await raw(huge);expect('とても大きな中身も、上限をこえたところでやめる',r[0]===413&&pulled<20,{r,pulled});
  for(const [nm,b] of [['null','null'],['配列','[]'],['文字','"x"'],['数','123'],['こわれた JSON','{"body":'],['こわれた UTF-8',new Uint8Array([0x7b,0x22,0xff,0xfe,0x22,0x7d])]]){r=await raw(b,'10.88.0.'+(2+nm.length));expect('読めない中身は400：'+nm,r[0]===400,r)}
  r=await raw(JSON.stringify({body:'日本語の本文 '.repeat(3)}),'10.88.0.50');expect('ふつうの日本語の本文（複数バイト）は前と同じ',r[0]===200||r[0]===400&&/15秒/.test(r[1].error),r);
  let s429=0;for(let i=0;i<35;i++){const x=await raw('{bad','10.88.9.9');if(x[0]===429)s429++}expect('形のおかしい送信は同じ接続元から10分30回まで（そのあと429）',s429===5,s429);
  tick();r=await call('/api/notes',{method:'POST',tok:A,body:{body:'形のおかしい送信のあとでも、ほかの接続元のふつうの投稿'},ip:'10.88.1.1'});expect('ほかの接続元は止めない',r[0]===200,r)}
await clearSlots();tick();
r=await call('/api/notes',{method:'POST',tok:B,body:{body:'x',url:123}});expect('形のおかしいリンク欄も枠に数える（1回目は400）',r[0]===400&&r[1].code==='type',r);
r=await call('/api/notes',{method:'POST',tok:B,body:{body:'x',url:'https://note.com/after-bad'}});expect('形のおかしいリンク欄のすぐあと（10秒以内）は429',r[0]===429&&r[1].code==='slot',r);
await clearSlots();tick();
r=await call('/api/notes',{method:'POST',tok:B,body:{body:{x:1},url:'https://note.com/a'}});expect('本文の形がおかしい＋リンクのつもり＝枠に数える',r[0]===400,r);
r=await call('/api/notes',{method:'POST',tok:B,body:{body:'x',url:'https://note.com/after-bad2'}});expect('そのすぐあとは429',r[0]===429,r);
{const X=await mk('uMix','mixer');tick(20e3);await clearSlots();const n0=(await q(`SELECT COUNT(*) AS c FROM notes WHERE uid='uMix'`))[0].c;
  const rs=await Promise.all([...[1,2,3,4].map(i=>call('/api/notes',{method:'POST',tok:X,body:{body:'plain'+i}})),...[1,2,3].map(i=>call('/api/notes',{method:'POST',tok:X,body:{body:'lnk',url:'https://note.com/mix/'+i}}))]);
  const n1=(await q(`SELECT COUNT(*) AS c FROM notes WHERE uid='uMix'`))[0].c;
  expect('リンクあり・なしを同時に7件送っても、15秒に1件だけ書く',n1-n0===1&&rs.filter(x=>x[0]===200).length===1,{d:n1-n0,st:rs.map(x=>x[0])});
  expect('書けなかったリンクの行は残さない',(await q(`SELECT COUNT(*) AS c FROM note_links l LEFT JOIN notes n ON n.id=l.note_id WHERE n.id IS NULL OR n.uid<>l.uid`))[0].c===0,'');
  const ins=[];for(let i=0;i<99-(n1-n0);i++)ins.push(env.DB.prepare(`INSERT INTO notes(uid,body,created_at,ip) VALUES('uMix','fill',?,'')`).bind(clock-80e6+i*20e3));await env.DB.batch(ins);
  tick(20e3);const rs2=await Promise.all([1,2,3].map(i=>call('/api/notes',{method:'POST',tok:X,body:{body:'day'+i}})));
  expect('1日100件も同時に送ってこえない',(await q(`SELECT COUNT(*) AS c FROM notes WHERE uid='uMix' AND created_at>?`,clock-864e5))[0].c===100&&rs2.filter(x=>x[0]===200).length===1,rs2.map(x=>x[0]));
  tick(20e3);r=await call('/api/notes',{method:'POST',tok:X,body:{body:'101件目'}});expect('101件目は断る',r[0]===400&&/100/.test(r[1].error),r)}

/* ---------- 9. 確認の記録・利用停止・確認済みメール ---------- */
env=mkEnv();
const ADM={admin:'admin-secret-123'};
const Z=await mk('uZ','zed',{email:'Zed.Attacker+gk@Mail.Test-GK.net'}),N=await mk('uN','neighbor'),O=await mk('uO','olive',{email:null});
tick();r=await call('/api/notes',{method:'POST',tok:Z,body:{body:'ふつうの投稿'}});const zNote=r[1].id;
tick();await clearSlots();r=await call('/api/notes',{method:'POST',tok:Z,body:{body:'攻撃のリンク',url:'https://note.com/zed/attack'}});const zLink=r[1].id;
expect('確認済みメールはハッシュだけを記録（生のメールは残さない）',(await q(`SELECT ehash,kver FROM user_emails WHERE uid='uZ'`)).length===1&&!JSON.stringify(await q(`SELECT * FROM user_emails`)).toLowerCase().includes('zed.attacker'),await q(`SELECT * FROM user_emails`));
const SUM='このリンクがフィッシングと確かめた（記録の番号と画面で確認）';
const mkCase=async(h,refs,kind='attack',x={})=>call('/api/admin/cases',{method:'POST',...ADM,body:{handle:h,kind,summary:SUM,refs,...x}});
r=await call('/api/admin/cases',{method:'POST',body:{handle:'zed',kind:'attack',summary:SUM,refs:[{t:'note',id:zNote}]}});expect('確認の記録は管理者だけ',r[0]===401,r);
r=await mkCase('zed',[]);expect('根拠のない確認の記録は作れない',r[0]===400,r);
r=await mkCase('zed',[{t:'ip',id:1}]);expect('IP アドレスは根拠にできない',r[0]===400,r);
r=await mkCase('zed',[{t:'note',id:pn}]);expect('ほかの人の記録は根拠にできない',r[0]===400,r);
r=await mkCase('zed',[{t:'note',id:999999}]);expect('ない記録は根拠にできない',r[0]===400,r);
r=await call('/api/admin/cases',{method:'POST',...ADM,body:{handle:'zed',kind:'attack',summary:'短い',refs:[{t:'note',id:zNote}]}});expect('確かめた内容は20文字以上',r[0]===400,r);
r=await mkCase('zed',[{t:'link',id:zLink},{t:'note',id:zNote}],'attack');expect('確認の記録を作れる',r[0]===200&&r[1].case_id>0,r);const zc=r[1].case_id;
const RAT='意図的にフィッシングのリンクを広めたと確認したため停止する';
const sanc=(b)=>call('/api/admin/sanctions',{method:'POST',...ADM,body:{rationale:RAT,confirm:'SANCTION',...b}});
r=await sanc({kind:'perpetrator'});expect('確認の記録なしでは停止できない',r[0]===400,r);
r=await sanc({kind:'perpetrator',case_id:zc,rationale:'短い'});expect('理由は20文字以上',r[0]===400,r);
r=await sanc({kind:'perpetrator',case_id:zc,confirm:true});expect('確認の言葉が要る',r[0]===400,r);
r=await sanc({kind:'linked',case_id:zc});expect('種類と確認の記録が合わなければ断る',r[0]===400,r);
r=await call('/api/admin/sanctions',{method:'POST',...ADM,body:{kind:'perpetrator',case_id:zc,rationale:RAT,confirm:'SANCTION'},E:{...env,SANCTIONS_ON:''}});expect('SANCTIONS_ON が無ければ作れない',r[0]===503,r);
/* 途中で失敗したら何も残さない（1つの取引） */
{const real=env.DB,c0=(await q('SELECT COUNT(*) AS c FROM sanctions'))[0].c,Ef={...env,DB:{prepare:s=>real.prepare(/UPDATE sanction_cases SET status='sanctioned'/.test(s)?s.replace('sanction_cases','sanction_cases_nope'):s),batch:l=>real.batch(l)}};
  r=await call('/api/admin/sanctions',{method:'POST',...ADM,body:{kind:'perpetrator',case_id:zc,rationale:RAT,confirm:'SANCTION'},E:Ef});
  expect('作る途中で失敗したら、停止・メール・記録・表示のどれも残さない',r[0]===500&&(await q('SELECT COUNT(*) AS c FROM sanctions'))[0].c===c0&&(await q(`SELECT banned FROM users WHERE uid='uZ'`))[0].banned===0,{r,c0})}
r=await sanc({kind:'perpetrator',case_id:zc});
expect('確かめた攻撃者：いつまでもの停止＋確認済みメールの記録',r[0]===200&&r[1].permanent&&r[1].email==='recorded'&&/^[0-9a-f]{32}$/.test(r[1].root),r);const zs=r[1].id,zroot=r[1].root;
r=await sanc({kind:'perpetrator',case_id:zc});expect('同じ確認の記録で2回は停止できない（409）',r[0]===409&&r[1].conflict,r);
tick();r=await call('/api/notes',{method:'POST',tok:Z,body:{body:'停止中'}});expect('停止中は投稿できない（前に作ったログインのままでも）',r[0]===403&&r[1].sanction&&r[1].sanction.permanent,r);
r=await call('/api/media',{method:'POST',tok:Z,raw:'x'});expect('停止中は画像も送れない',r[0]===403,r);
r=await call('/api/dm/send',{method:'POST',tok:Z,body:{to:'neighbor',body:'hi'}});expect('停止中はメッセージも送れない',r[0]===403,r);
r=await call('/api/me',{tok:Z});expect('停止中：/api/me は理由を返す',r[0]===403&&/停止/.test(r[1].error),r);
r=await call('/api/me/teams',{tok:Z});expect('停止中：ほかの /api/me も止める',r[0]===403,r);
r=await call('/api/tl',{tok:Z});expect('停止中でも、ログインしていない人と同じように読める',r[0]===200,r[0]);
r=await call('/api/u/zed');expect('停止中の人のプロフィールは出ない',r[0]===404,r);
expect('停止の記録で banned=2',(await q(`SELECT banned FROM users WHERE uid='uZ'`))[0].banned===2,'');
for(const [name,o,st] of [['同じメール（大文字小文字だけ違う）',{email:'zed.attacker+gk@mail.test-gk.net'},403],['同じメール',{email:'Zed.Attacker+gk@Mail.Test-GK.net'},403],
  ['+ が違う（別のアドレスとして扱う）',{email:'zed.attacker@mail.test-gk.net'},200],['. が違う（別のアドレス）',{email:'zedattacker+gk@mail.test-gk.net'},200],['同じメールでも未確認（結びつけない）',{email:'zed.attacker+gk@mail.test-gk.net',verified:false},200]]){
  const t=await tok('new-'+name,o);r=await call('/api/me',{method:'POST',tok:t,body:{handle:'n'+Math.abs([...name].reduce((a,c)=>a*31+c.charCodeAt(0)|0,7)).toString(36).slice(0,10),name:'New',agree:true}});expect('新しい UID：'+name,r[0]===st,r)}
{const t=await tok('forger',{email:'other@mail.test-gk.net'});r=await call('/api/me',{method:'POST',tok:t,body:{handle:'forger',name:'F',agree:true,email:'zed.attacker+gk@mail.test-gk.net',email_verified:true,banned:0,sanction:null}});
  expect('送ってきた本文のメール・停止の値は使わない',r[0]===200,r)}
tick();r=await call('/api/notes',{method:'POST',tok:N,body:{body:'同じ接続元の別の人'},ip:'10.9.9.9'});expect('同じ接続元の関係ない人は止めない',r[0]===200,r);
r=await call('/api/admin/ban',{method:'POST',...ADM,body:{handle:'zed',on:false}});expect('前からの解除でも、記録があれば停止のまま',r[0]===200&&r[1].sanctioned&&(await q(`SELECT banned FROM users WHERE uid='uZ'`))[0].banned===2,r);
r=await call('/api/admin/sanctions',ADM);expect('運営者の一覧（メール・ハッシュ・UID は出さない）・鍵の状態',r[0]===200&&r[1].sanctions.some(s=>s.id===zs&&s.live===1&&s.handle==='zed')&&r[1].health.ok&&!/uZ"|ehash|mail\.test-gk|zed\.attacker/i.test(JSON.stringify(r[1])),r[1].health);
/* 前からある、同じ確認済みメールを使っていたアカウント（メールのつけかえ） */
{const P1=await mk('uShare','sharer',{email:'shared@mail.test-gk.net'});tick();await call('/api/notes',{method:'POST',tok:P1,body:{body:'前からいる'}});
  const P2=await tok('uShare2',{email:'shared@mail.test-gk.net'});r=await call('/api/me',{method:'POST',tok:P2,body:{handle:'sharer2',name:'S2',agree:true}});tick();
  const pn3=(await call('/api/notes',{method:'POST',tok:P2,body:{body:'あとから同じメール'}}))[1].id;
  const c=await mkCase('sharer2',[{t:'note',id:pn3}]);await sanc({kind:'perpetrator',case_id:c[1].case_id});
  tick();r=await call('/api/notes',{method:'POST',tok:P1,body:{body:'x'}});expect('同じ確認済みメールの前からのアカウントも止める（メールのつけかえの危険は runbook に）',r[0]===403,r)}
/* メールを変えた人：どちらのメールも記録して止める */
{const H1=await tok('uHist',{email:'hist-one@mail.test-gk.net'});await call('/api/me',{method:'POST',tok:H1,body:{handle:'hist',name:'H',agree:true}});tick();await call('/api/notes',{method:'POST',tok:H1,body:{body:'1'}});
  const H2=await tok('uHist',{email:'hist-two@mail.test-gk.net'});tick();const hn=(await call('/api/notes',{method:'POST',tok:H2,body:{body:'2'}}))[1].id;
  const c=await mkCase('hist',[{t:'note',id:hn}]);r=await sanc({kind:'perpetrator',case_id:c[1].case_id});
  expect('メールを変えた人は、確認済みのメールを両方記録',(await q('SELECT COUNT(*) AS c FROM sanctions WHERE root_key=? AND kind=?',r[1].root,'email'))[0].c===2,r);
  for(const e of ['hist-one@mail.test-gk.net','hist-two@mail.test-gk.net']){const x=await call('/api/me',{method:'POST',tok:await tok('uHistNew'+e,{email:e}),body:{handle:'hn'+e.length+e[5],name:'X',agree:true}});expect('前のメールでも新しい UID を止める：'+e,x[0]===403,x)}}
r=await mkCase('olive',[{t:'note',id:(await call('/api/notes',{method:'POST',tok:O,body:{body:'o'}}))[1].id||zNote}]);
{tick();const on=(await call('/api/notes',{method:'POST',tok:O,body:{body:'olive の投稿'}}))[1].id;const c=await mkCase('olive',[{t:'note',id:on}]);r=await sanc({kind:'perpetrator',case_id:c[1].case_id});
  expect('メールの記録がなければ「未解決」（推測で結びつけない）',r[1].email==='unresolved',r)}

/* ---------- 10. 鍵の束（3回以上の入れかえ・版が足りないとき・取り消し） ---------- */
{const KS={v1:EK,v2:'email-hmac-key-test-v2-0123456789abcdef',v3:'email-hmac-key-test-v3-0123456789abcdef',v4:'email-hmac-key-test-v4-0123456789abcdef'};
  const ring=(cur,ks=KS)=>({EMAIL_HMAC_KEY:'',EMAIL_HMAC_KEYRING:JSON.stringify(ks),EMAIL_HMAC_KEY_CURRENT:cur});
  const E4={...env,...ring('v4')};
  r=await call('/api/me',{method:'POST',tok:await tok('dormant-1',{email:'zed.attacker+gk@mail.test-gk.net'}),body:{handle:'dormant1',name:'D',agree:true},E:E4});
  expect('3回入れかえたあとでも（間に一度も来ていなくても）、v1 の停止で止める',r[0]===403,r);
  expect('今の版（v4）の写しを同じ root で記録',(await q(`SELECT COUNT(*) AS c FROM sanctions WHERE root_key=? AND kver='v4' AND status='active'`,zroot))[0].c===1,await q(`SELECT kver,source FROM sanctions WHERE root_key=?`,zroot));
  r=await call('/api/me',{method:'POST',tok:await tok('dormant-1b',{email:'zed.attacker+gk@mail.test-gk.net'}),body:{handle:'dormant1b',name:'D',agree:true},E:E4});
  expect('写しは何度来ても1行',(await q(`SELECT COUNT(*) AS c FROM sanctions WHERE root_key=? AND kver='v4'`,zroot))[0].c===1&&r[0]===403,'');
  for(const v of ['v2','v3']){await call('/api/me',{method:'POST',tok:await tok('rk-'+v,{email:'zed.attacker+gk@mail.test-gk.net'}),body:{handle:'rk'+v,name:'R',agree:true},E:{...env,...ring(v)}})}
  expect('入れかえのたびに写しが増える（v1〜v4 の4行）',(await q(`SELECT COUNT(DISTINCT kver) AS c FROM sanctions WHERE root_key=? AND kind='email' AND status='active'`,zroot))[0].c===4,await q(`SELECT kver FROM sanctions WHERE root_key=?`,zroot));
  const Emiss={...env,...ring('v4',{v2:KS.v2,v3:KS.v3,v4:KS.v4})};
  r=await call('/api/notes',{method:'POST',tok:N,body:{body:'x'},E:{...env,...ring('v4',{v4:KS.v4})}});
  expect('v1 の鍵を外すと、ほかの版の鍵があっても閉じる（ログインした人の書きこみ）',r[0]===503,r);
  r=await call('/api/admin/sanctions',{...ADM,E:{...env,...ring('v4',{v4:KS.v4})}});expect('管理画面の鍵の状態に、足りない版が出る',r[1].health.ok===false&&r[1].health.missing_tombstone_versions.includes('v1'),r[1].health);
  r=await call('/api/tl',{E:{...env,...ring('v4',{v4:KS.v4})}});expect('鍵が足りなくても、ログインしていない人は読める',r[0]===200,r[0]);
  r=await call('/api/notes',{method:'POST',tok:N,body:{body:'x'},E:{...env,EMAIL_HMAC_KEYRING:'{bad',EMAIL_HMAC_KEY:''}});expect('鍵の束が読めなければ閉じる',r[0]===503,r);
  r=await call('/api/links/config',{E:{...env,EMAIL_HMAC_KEYRING:'{bad'}});expect('鍵の束が読めなければリンク欄も出さない',r[1].post===false,r);
  void Emiss;
  /* 取り消し：同じ root の行を全部（何回入れかえた写しも） */
  r=await call(`/api/admin/sanctions/${zs}/reverse`,{method:'POST',...ADM,body:{confirm:true}});expect('取り消しには理由が要る',r[0]===400,r);
  r=await call(`/api/admin/sanctions/${zs}/appeal`,{method:'POST',...ADM,body:{reason:'本人から異議',decision:'open',confirm:true}});expect('異議を記録できる',r[0]===200&&r[1].appeal==='open',r);
  const p1=call(`/api/admin/sanctions/${zs}/reverse`,{method:'POST',...ADM,body:{reason:'誤りと確認したため取り消し',confirm:true}});
  const p2=call('/api/me',{method:'POST',tok:await tok('race-rekey',{email:'zed.attacker+gk@mail.test-gk.net'}),body:{handle:'racerk',name:'R',agree:true},E:{...env,...ring('v3')}});
  const [rv]=await Promise.all([p1,p2]);
  expect('取り消せる（UID・メール・すべての写し）',rv[0]===200&&rv[1].rows>=5,rv);
  expect('取り消しと写しが同時でも、生き返らない',(await q(`SELECT COUNT(*) AS c FROM sanctions WHERE root_key=? AND status='active'`,zroot))[0].c===0,await q(`SELECT kver,status FROM sanctions WHERE root_key=?`,zroot));
  r=await call('/api/me',{method:'POST',tok:await tok('after-rev',{email:'zed.attacker+gk@mail.test-gk.net'}),body:{handle:'afterrev',name:'A',agree:true},E:E4});expect('取り消したら、どの版でも同じメールの新しい UID を使える',r[0]===200,r);
  tick();r=await call('/api/notes',{method:'POST',tok:Z,body:{body:'取り消し後'}});expect('取り消すと本人も投稿できる',r[0]===200,r);
  expect('記録の履歴（作成・メール・異議・取り消し）',(await q(`SELECT action FROM sanction_events WHERE root_key=? ORDER BY id`,zroot)).map(x=>x.action).join(',')==='create,email_recorded,appeal_open,reverse',await q(`SELECT action FROM sanction_events WHERE root_key=?`,zroot))
  /* ここからは鍵の束（v1〜v4、今は v1）のまま。v3・v4 で記録したハッシュもあるので、v1 だけにすると停止を作れない（版が足りない＝正しい動き） */
  env={...env,...ring('v1')};
  r=await call('/api/admin/sanctions',{...ADM,E:mkEnv()});expect('記録したハッシュの版（v3・v4）の鍵がないと、管理画面に知らせる',r[1].health.missing_identity_versions.includes('v4'),r[1].health)}
/* 別々の停止が同じメールを持つとき、1つを取り消してもほかは残る */
{const I1=await mk('uInd1','indone',{email:'ind@mail.test-gk.net'});tick();const n1=(await call('/api/notes',{method:'POST',tok:I1,body:{body:'1'}}))[1].id;
  const I2=await tok('uInd2',{email:'ind@mail.test-gk.net'});await call('/api/me',{method:'POST',tok:I2,body:{handle:'indtwo',name:'I',agree:true}});
  const c1=await mkCase('indone',[{t:'note',id:n1}]);const s1=await sanc({kind:'perpetrator',case_id:c1[1].case_id});
  await env.DB.prepare(`INSERT INTO notes(uid,body,created_at,ip) VALUES('uInd2','2',?,'')`).bind(clock).run();const n2=(await q(`SELECT MAX(id) AS id FROM notes WHERE uid='uInd2'`))[0].id;
  await env.DB.prepare(`INSERT OR IGNORE INTO user_emails(uid,ehash,kver,first_at,last_at) SELECT 'uInd2',ehash,kver,?,? FROM user_emails WHERE uid='uInd1'`).bind(clock,clock).run();
  const c2=await mkCase('indtwo',[{t:'note',id:n2}]);const s2=await sanc({kind:'perpetrator',case_id:c2[1].case_id});
  expect('同じメールに別々の停止を2つ作れる',s1[0]===200&&s2[0]===200&&s1[1].root!==s2[1].root,{s1,s2});
  await call(`/api/admin/sanctions/${s1[1].id}/reverse`,{method:'POST',...ADM,body:{reason:'1つ目は誤り',confirm:true}});
  r=await call('/api/me',{method:'POST',tok:await tok('ind-new',{email:'ind@mail.test-gk.net'}),body:{handle:'indnew',name:'N',agree:true}});
  expect('1つを取り消しても、もう1つの停止は残る',r[0]===403,r)}
/* 関連アカウント（確かめた攻撃者の有効な停止に結びつける。IP だけでは作れない）・暦の月・期限・手動の停止と並ぶとき */
const postLink=async(t,url)=>{tick();await clearSlots();const x=await call('/api/notes',{method:'POST',tok:t,body:{body:'link',url}});expect('リンクの投稿（根拠用）',x[0]===200,x);return x[1].id};
const PR=await mk('uPerp','perp',{email:'perp@mail.test-gk.net'});tick();const ppn=(await call('/api/notes',{method:'POST',tok:PR,body:{body:'p'}}))[1].id;
const ppl=await postLink(PR,'https://note.com/attack/shared');
const pc=await mkCase('perp',[{t:'note',id:ppn},{t:'link',id:ppl}]);const ps=await sanc({kind:'perpetrator',case_id:pc[1].case_id});const proot=ps[1].root;
const T=await mk('uT','tempo'),M=await mk('uM','manual');const tl=await postLink(T,'https://note.com/attack/shared'),ml=await postLink(M,'https://note.com/attack/shared');tick();const tn=(await call('/api/notes',{method:'POST',tok:T,body:{body:'t'}}))[1].id;tick();const mn=(await call('/api/notes',{method:'POST',tok:M,body:{body:'m'}}))[1].id;
r=await mkCase('tempo',[{t:'note',id:tn}],'linked');expect('関連アカウントは、もとの攻撃者の停止を指定しないと作れない',r[0]===400,r);
r=await mkCase('tempo',[{t:'note',id:tn}],'linked',{related_root:'0'.repeat(32)});expect('ない停止は指定できない',r[0]===400,r);
r=await mkCase('perp',[{t:'note',id:ppn}],'linked',{related_root:proot});expect('同じ人を関連アカウントにはできない',r[0]===400,r);
r=await mkCase('tempo',[{t:'note',id:tn}],'linked',{related_root:proot});expect('ふつうの投稿と攻撃者の停止だけでは関連の根拠にならない',r[0]===400,r);
{const ol=await postLink(T,'https://note.com/unrelated/page');r=await mkCase('tempo',[{t:'link',id:ol}],'linked',{related_root:proot});expect('ちがう行き先のリンクは関連の根拠にならない',r[0]===400,r)}
r=await mkCase('tempo',[{t:'link',id:tl}],'linked',{related_root:proot});const tc=r[1].case_id;expect('関連アカウントの確認の記録',r[0]===200,r);
r=await sanc({kind:'linked',case_id:tc,months:7});expect('期間は3〜6か月',r[0]===400,r);
r=await sanc({kind:'linked',case_id:tc});
expect('関連アカウント：はじめは90日・メールは記録しない',r[0]===200&&!r[1].permanent&&Math.round((r[1].expires_at-clock)/864e5)===90&&r[1].email==='none',r);
r=await mkCase('manual',[{t:'link',id:ml}],'linked',{related_root:proot});const mc=r[1].case_id;
r=await sanc({kind:'temporary',case_id:mc,months:3});expect('3か月の停止',r[0]===200,r);
await call('/api/admin/ban',{method:'POST',...ADM,body:{handle:'manual'}});
expect('手動の停止をすると 1',(await q(`SELECT banned FROM users WHERE uid='uM'`))[0].banned===1,'');
tick();r=await call('/api/notes',{method:'POST',tok:T,body:{body:'期間中'}});expect('期間中は投稿できない',r[0]===403&&r[1].sanction.until>clock,r);
const tExp=(await q(`SELECT expires_at FROM sanctions WHERE uid='uT' AND kind='uid'`))[0].expires_at;
clock=tExp+60e3;
r=await call('/api/u/tempo');expect('期限が来ても、1時間ごとの見直しまでは表示は止めたまま（安全側・最大1時間）',r[0]===404,r);
await w.scheduled({cron:'0 * * * *',scheduledTime:clock},env,{waitUntil(p){LATER.push(p)}});await settle();
r=await call('/api/u/tempo');expect('1時間ごとの見直しで表示が戻る',r[0]===200,r);
tick();r=await call('/api/notes',{method:'POST',tok:T,body:{body:'期限が来た'}});expect('期限が来たら投稿できる',r[0]===200,r);
clock=jstAddMonthsT(clock,0)+100*864e5;
await w.scheduled({cron:'0 * * * *',scheduledTime:clock},env,{waitUntil(p){LATER.push(p)}});await settle();
expect('期限が来ても手動の停止（1）は戻さない',(await q(`SELECT banned FROM users WHERE uid='uM'`))[0].banned===1,'');
tick();r=await call('/api/notes',{method:'POST',tok:M,body:{body:'x'}});expect('手動の停止は続く',r[0]===403,r);
r=await call('/api/notes',{method:'POST',tok:PR,body:{body:'x'}});expect('いつまでもの停止は期限で戻らない',r[0]===403,r);
/* 変数をすべて止めても、有効な停止は守る */
r=await call('/api/notes',{method:'POST',tok:PR,body:{body:'x'},E:{...env,LINKS_POST:'',LINKS_CLICK:'',SANCTIONS_ON:''}});expect('変数を全部止めても、有効な停止は守る',r[0]===403,r);
r=await mkCase('tempo',[{t:'link',id:tl}],'linked',{related_root:proot});
await call(`/api/admin/sanctions/${ps[1].id}/reverse`,{method:'POST',...ADM,body:{reason:'攻撃者の停止を取り消し',confirm:true}});
r=await sanc({kind:'linked',case_id:r[1].case_id});expect('もとの攻撃者の停止が取り消されていれば、関連アカウントは作れない',r[0]===409,r);
/* 日本時間の暦の月（月末はその月の最後の日） */
for(const [start,mo,want] of [['2027-01-31T10:00:00+09:00',3,'2027-04-30T10:00:00+09:00'],['2026-11-30T23:30:00+09:00',3,'2027-02-28T23:30:00+09:00'],['2027-08-31T00:15:00+09:00',6,'2028-02-29T00:15:00+09:00'],['2027-03-31T12:00:00+09:00',6,'2027-09-30T12:00:00+09:00']]){
  clock=Date.parse(start);const u=await mk('uMon'+start.slice(0,10),'mon'+start.slice(2,10).replace(/-/g,''));tick(0);
  await env.DB.prepare(`INSERT INTO notes(uid,body,created_at,ip) VALUES(?,?,?,'')`).bind('uMon'+start.slice(0,10),'m',clock).run();const nid=(await q('SELECT MAX(id) AS id FROM notes'))[0].id;
  const PX=await mk('uPx'+start.slice(0,10),'px'+start.slice(2,10).replace(/-/g,''));await env.DB.prepare(`INSERT INTO notes(uid,body,created_at,ip) VALUES(?,?,?,'')`).bind('uPx'+start.slice(0,10),'p',clock).run();
  const pxn=(await q('SELECT MAX(id) AS id FROM notes'))[0].id;
  for(const [nn,uu] of [[nid,'uMon'+start.slice(0,10)],[pxn,'uPx'+start.slice(0,10)]])await env.DB.prepare(`INSERT INTO note_links(note_id,uid,url,host,state,verdict_at,expires_at,created_at,updated_at,vh) VALUES(?,?,'https://note.com/mon','note.com','ok',?,?,?,?,?)`).bind(nn,uu,clock,clock+36e5,clock,clock,'vh-'+start).run();
  const pxc=await mkCase('px'+start.slice(2,10).replace(/-/g,''),[{t:'link',id:pxn}]);const pxs=await sanc({kind:'perpetrator',case_id:pxc[1].case_id});
  const c=await mkCase('mon'+start.slice(2,10).replace(/-/g,''),[{t:'link',id:nid}],'linked',{related_root:pxs[1].root});r=await sanc({kind:'linked',case_id:c[1].case_id,months:mo});
  expect(`暦の月：${start} ＋${mo}か月 → ${want}`,r[0]===200&&r[1].expires_at===Date.parse(want),{got:r[1].expires_at&&new Date(r[1].expires_at+9*3600e3).toISOString(),r});
  void u;void PX}
/* アカウントを消しても、いつまでもの記録は残る */
{const D=await mk('uDel','delme',{email:'del.me@mail.test-gk.net'});tick();const dn=(await call('/api/notes',{method:'POST',tok:D,body:{body:'x'}}))[1].id;
  const c=await mkCase('delme',[{t:'note',id:dn}]);await sanc({kind:'perpetrator',case_id:c[1].case_id});
  await env.DB.prepare(`DELETE FROM users WHERE uid='uDel'`).run();await env.DB.prepare(`DELETE FROM user_emails WHERE uid='uDel'`).run();
  r=await call('/api/me',{method:'POST',tok:await tok('uDel2',{email:'Del.Me@mail.test-gk.net'}),body:{handle:'delme2',name:'D',agree:true}});expect('アカウントを消したあとも、同じ確認済みメールは使えない',r[0]===403,r);
  r=await call('/api/me',{method:'POST',tok:D,body:{handle:'delme',name:'D',agree:true}});expect('同じ UID のまま作り直しても使えない',r[0]===403,r)}
{const D=await mk('uDel3','delthree',{email:'d3@mail.test-gk.net'});tick();await call('/api/notes',{method:'POST',tok:D,body:{body:'x'}});
  r=await call('/api/me/delete',{method:'POST',tok:D,body:{}});expect('ふつうの削除ではメールの対応も消す',r[0]===200&&(await q(`SELECT COUNT(*) AS c FROM user_emails WHERE uid='uDel3'`))[0].c===0,r)}

/* ---------- 13. レビュー2回目（A：安全確認の覚えと回数・B：鍵の印・確認の記録の取りあい・書く文の中の確かめ・決まった時刻の仕事） ---------- */
{
const w2=(await import(path.join(ROOT,'worker/dist/worker.js')+'?inst=r2')).default;
const U1=await mk('uR2a','rtwoa'),U2=await mk('uR2b','rtwob'),U3=await mk('uR2c','rtwoc');
const wr=()=>WR.calls.length;
await env.DB.prepare('DELETE FROM link_budget').run();
/* A1 危険の答えは業者の期限まで（24時間で切らない）・その間は問い合わせない */
WR.mode['longthreat-fixture']='unsafe-3d';
r=await tryLink(U1,'https://longthreat-fixture.test-gk.net/x');expect('A1 危険（期限3日）は断る',r[0]===400,r);
tick(2*864e5);let c0=wr();
r=await tryLink(U2,'https://longthreat-fixture.test-gk.net/x');expect('A1 2日後も、業者の期限まで覚えた危険で断る（問い合わせない）',r[0]===400&&wr()===c0,{r,d:wr()-c0});
/* A2 期限のない・形のおかしい・過ぎた期限 */
WR.mode['noexp-fixture']='unsafe-noexp';c0=wr();
r=await tryLink(U1,'https://noexp-fixture.test-gk.net/x');expect('A2 危険なのに期限がない＝形がおかしい（閉じる）',r[0]===503,r);
r=await tryLink(U2,'https://noexp-fixture.test-gk.net/x');expect('A2 形のおかしい答えは覚えない（もう一度問い合わせる）',r[0]===503&&wr()-c0===2,wr()-c0);
WR.mode['badexp-fixture']='unsafe-badexp';r=await tryLink(U1,'https://badexp-fixture.test-gk.net/x');expect('A2 期限の書き方がおかしい（RFC3339 でない）＝閉じる',r[0]===503,r);
WR.mode['pastexp-fixture']='unsafe-past';c0=wr();r=await tryLink(U1,'https://pastexp-fixture.test-gk.net/x');expect('A2 期限が過ぎた危険は今回は断る',r[0]===400,r);
delete WR.mode['pastexp-fixture'];r=await tryLink(U2,'https://pastexp-fixture.test-gk.net/x');expect('A2 過ぎた期限の危険は覚えない（次はもう一度問い合わせる）',r[0]===200&&wr()-c0===2,{r,d:wr()-c0});
/* A3 同じ行き先の投稿：あとで危険と分かったら、前に問題なしだった投稿も止める（その投稿の期限の前でも） */
const dupA=(await tryLink(U1,'https://dup-fixture.test-gk.net/page'))[1].id,dupB=(await tryLink(U2,'https://dup-fixture.test-gk.net/page'))[1].id;
expect('A3 同じ行き先の2つ目は覚えを使う',!!dupA&&!!dupB,{dupA,dupB});
const dlg=await call(`/api/links/${dupA}/open`,{method:'POST',body:{},ip:IPV});expect('A3 先に確認の画面を開いておく',dlg[0]===200,dlg);
WR.mode['dup-fixture']='unsafe-3d';
r=await call(`/api/admin/links/${dupB}`,{method:'POST',admin:'admin-secret-123',body:{action:'recheck',reason:'確かめ直す',confirm:true}});expect('A3 片方を確かめ直して危険と分かる',r[1].verdict==='unsafe',r);
r=await call(`/api/links/${dupA}/go`,{method:'POST',body:{intent:dlg[1].intent},ip:IPV});expect('A3 開いていた確認の画面の「開く」も止める（共有の危険）',r[0]===410&&r[1].inert,r);
expect('A3 もう片方も期限の前に危険（押せない）に変わる',(await q('SELECT state FROM note_links WHERE note_id=?',dupA))[0].state==='unsafe',await q('SELECT state,expires_at FROM note_links WHERE note_id=?',dupA));
const dupC=(await call('/api/notes',{method:'POST',tok:U3,body:{body:'x',url:'https://dup-fixture.test-gk.net/page'}}));
expect('A3 3つ目の投稿も断る',dupC[0]===400,dupC);
/* A4 戻すのも、期限内の危険があれば問い合わせずに断る */
await call(`/api/admin/links/${dupB}`,{method:'POST',admin:'admin-secret-123',body:{action:'quarantine',reason:'確認のため止める',confirm:true}});
delete WR.mode['dup-fixture'];c0=wr();
r=await call(`/api/admin/links/${dupB}`,{method:'POST',admin:'admin-secret-123',body:{action:'restore',reason:'誤判定だと思う',confirm:true}});
expect('A4 期限内の危険は、新しく確かめる指定でも短くしない（戻せない・問い合わせない）',r[0]===409&&r[1].verdict==='unsafe'&&wr()===c0,{r,d:wr()-c0});
/* A5 1日と1か月の回数（1つの文で同時に。片方だけ減らない）・UTC の月が変われば戻る */
const bset=(day,dn,month,mn)=>env.DB.prepare(`UPDATE link_budget SET day=?,dn=?,month=?,mn=? WHERE id='webrisk'`).bind(day,dn,month,mn).run();
const today=new Date(clock).toISOString().slice(0,10),mon=today.slice(0,7);
await bset(today,0,mon,89999);r=await tryLink(U1,'https://budget-a.test-gk.net/1');expect('A5 1か月の最後の1回は使える',r[0]===200,r);
r=await tryLink(U1,'https://budget-a.test-gk.net/2');expect('A5 1か月の上限で閉じる',r[0]===503,r);
await bset(today,3000,mon,10);c0=wr();r=await tryLink(U1,'https://budget-a.test-gk.net/3');
const bb=(await q(`SELECT dn,mn FROM link_budget`))[0];expect('A5 1日の上限のときは、1か月の回数も減らさない',r[0]===503&&bb.mn===10&&bb.dn===3000&&wr()===c0,bb);
await bset('2000-01-31',3000,'2000-01',90000);r=await tryLink(U1,'https://budget-a.test-gk.net/4');
expect('A5 日・月が変われば数え直す（UTC）',r[0]===200&&(await q(`SELECT dn,mn,month FROM link_budget`))[0].mn===1,await q(`SELECT * FROM link_budget`));
await bset(today,0,mon,90000);tick();r=await call('/api/notes',{method:'POST',tok:U1,body:{body:'回数の上限でもリンクなしは投稿できる'}});expect('A5 上限でもリンクなしは投稿できる',r[0]===200,r);
await env.DB.prepare('DELETE FROM link_budget').run();
/* A6 覚えの上限で、期限内の危険は消さない */
{const ins=[];for(let i=0;i<20;i++)ins.push(env.DB.prepare(`INSERT OR REPLACE INTO link_verdicts(h,verdict,types,checked_at,expires_at) VALUES(?,'unsafe','MALWARE',?,?)`).bind('uns'+i,clock-1e7,clock+864e5));
  for(let i=0;i<5100;i++)ins.push(env.DB.prepare(`INSERT OR IGNORE INTO link_verdicts(h,verdict,types,checked_at,expires_at) VALUES(?,'clean','',?,?)`).bind('cln'+i,clock-1e6+i,clock+36e5));
  await env.DB.batch(ins);await tryLink(U2,'https://evict.test-gk.net/x');
  const nu=(await q(`SELECT COUNT(*) AS c FROM link_verdicts WHERE h LIKE 'uns%'`))[0].c,tot=(await q(`SELECT COUNT(*) AS c FROM link_verdicts`))[0].c;
  expect('A6 上限で消すのは問題なしだけ（期限内の危険は残る）・合計は上限まで',nu===20&&tot<=5000,{nu,tot})}
/* A7 覚えを読めなければ閉じる（リンクなしは使える） */
{const real=env.DB,E={...env,DB:{prepare:s=>{if(/FROM link_verdicts/.test(s))throw new Error('down');return real.prepare(s)},batch:l=>real.batch(l)}};
  await clearSlots();tick();r=await call('/api/notes',{method:'POST',tok:U3,body:{body:'x',url:'https://cache-down.test-gk.net/'},E});expect('A7 覚えを読めなければリンクは閉じる',r[0]===503,r);
  tick();r=await call('/api/notes',{method:'POST',tok:U3,body:{body:'覚えが読めなくてもふつうの投稿'},E});expect('A7 覚えが読めなくてもリンクなしは投稿できる',r[0]===200,r)}
/* B1 同じ版のまま鍵の中身を差しかえた＝閉じる（版の名前がそろっていても） */
{const KS={v1:EK,v2:'email-hmac-key-test-v2-0123456789abcdef',v3:'email-hmac-key-test-v3-0123456789abcdef',v4:'email-hmac-key-test-v4-0123456789abcdef'};
  const live=(await q(`SELECT COUNT(*) AS c FROM sanctions WHERE kind='email' AND status='active'`))[0].c;expect('B1 有効なメールの停止がある前提',live>0,live);
  const Ebad={...env,EMAIL_HMAC_KEY:'',EMAIL_HMAC_KEYRING:JSON.stringify({...KS,v1:'WRONG-material-for-v1-0123456789abcdef'}),EMAIL_HMAC_KEY_CURRENT:'v1'};
  tick();r=await call('/api/notes',{method:'POST',tok:U1,body:{body:'x'},E:Ebad});expect('B1 同じ版で中身がちがう鍵は閉じる',r[0]===503,r);
  r=await call('/api/admin/sanctions',{...ADM,E:Ebad});expect('B1 管理画面に「中身がちがう版」を出す（鍵そのものは出さない）',r[1].health.err==='key-mismatch'&&r[1].health.mismatch_versions.includes('v1')&&!JSON.stringify(r[1]).includes('WRONG-material'),r[1].health);
  r=await call('/api/links/config',{E:Ebad});
  tick();r=await call('/api/notes',{method:'POST',tok:U1,body:{body:'もとの鍵に戻すと使える'}});expect('B1 もとの鍵に戻すと使える',r[0]===200,r);
  expect('B1 印は鍵そのものではない（返事にも記録にも鍵が出ない）',!JSON.stringify(await q('SELECT * FROM key_sentinels')).includes(EK),'')}
/* B2 1つの確認の記録への同時の停止（2つの isolate から）・同じ op の送り直し・根拠や対象が変わったら作らない・もとの停止の取り消し中 */
{const AT=await mk('uAtk2','attacktwo',{email:'atk2@mail.test-gk.net'});const al=await postLink(AT,'https://note.com/attack2/shared');
  const ac=await mkCase('attacktwo',[{t:'link',id:al}]);
  const body={kind:'perpetrator',case_id:ac[1].case_id,rationale:RAT,confirm:'SANCTION'};
  const rs=await Promise.all([call('/api/admin/sanctions',{method:'POST',...ADM,body}),call('/api/admin/sanctions',{method:'POST',...ADM,body,W:w2})]);
  expect('B2 同じ確認の記録を2つの isolate から同時に → 1つだけ',rs.filter(x=>x[0]===200).length===1&&rs.filter(x=>x[0]===409).length===1&&(await q(`SELECT COUNT(*) AS c FROM sanctions WHERE case_id=? AND kind='uid'`,ac[1].case_id))[0].c===1,rs.map(x=>x[0]));
  const win=rs.find(x=>x[0]===200)[1];
  r=await call('/api/admin/sanctions',{method:'POST',...ADM,body:{...body,op:win.op}});expect('B2 同じ op の送り直しは前の結果（何度送っても1つ）',r[0]===200&&r[1].repeat&&r[1].id===win.id,r);
  const aroot=win.root;
  const LK=await mk('uLk2','linktwo');const ll=await postLink(LK,'https://note.com/attack2/shared');
  const lc=await mkCase('linktwo',[{t:'link',id:ll}],'linked',{related_root:aroot});expect('B2 関連の確認の記録（同じ行き先のリンク）',lc[0]===200,lc);
  await env.DB.prepare('DELETE FROM note_links WHERE note_id=?').bind(ll).run();
  r=await sanc({kind:'linked',case_id:lc[1].case_id});expect('B2 根拠が消えていたら停止しない（記録は open のまま）',r[0]===409&&(await q('SELECT status FROM sanction_cases WHERE id=?',lc[1].case_id))[0].status==='open',r);
  const ll2=await postLink(LK,'https://note.com/attack2/shared');const lc2=await mkCase('linktwo',[{t:'link',id:ll2}],'linked',{related_root:aroot});
  const GH=await mk('uGhost','ghostone');const gl=await postLink(GH,'https://note.com/attack2/shared');const gc=await mkCase('ghostone',[{t:'link',id:gl}],'linked',{related_root:aroot});
  await env.DB.prepare(`DELETE FROM users WHERE uid='uGhost'`).run();
  r=await sanc({kind:'linked',case_id:gc[1].case_id});expect('B2 対象がいなくなっていたら停止しない',r[0]===409,r);
  r=await sanc({kind:'linked',case_id:lc2[1].case_id});expect('B2 関連アカウントの停止',r[0]===200,r);const lid=r[1].id;
  tick();r=await call('/api/notes',{method:'POST',tok:LK,body:{body:'x'}});expect('B2 関連アカウントは停止中',r[0]===403,r);
  r=await call(`/api/admin/sanctions/${win.id}/reverse`,{method:'POST',...ADM,body:{reason:'攻撃者の停止は誤りだった',confirm:true}});
  expect('B2 もとの攻撃者を取り消すと、結びついた関連の停止は保留（自動で有罪のままにしない）',r[0]===200&&r[1].held===1&&(await q('SELECT status FROM sanctions WHERE id=?',lid))[0].status==='held',r);
  tick();r=await call('/api/notes',{method:'POST',tok:LK,body:{body:'保留のあいだは止めない'}});expect('B2 保留の停止は効かない',r[0]===200,r);
  expect('B2 保留の記録',(await q(`SELECT action FROM sanction_events WHERE sanction_id=?`,lid)).some(x=>x.action==='hold_parent_reversed'),'');
  const LK3=await mk('uLk3','linkthree');const l3=await postLink(LK3,'https://note.com/attack2/shared');
  r=await mkCase('linkthree',[{t:'link',id:l3}],'linked',{related_root:aroot});expect('B2 取り消された攻撃者には関連の確認の記録を作れない',r[0]===400,r);
  expect('B2 取り消しと保留のとき Firebase を戻す依頼（決めるのはアダプター）',(await q(`SELECT COUNT(*) AS c FROM fb_outbox WHERE action='enable' AND uid IN ('uAtk2','uLk2')`))[0].c===2,await q(`SELECT uid,action FROM fb_outbox`))}
/* B3 門を通ったあとに停止が作られた投稿は書かない（書く文の中で確かめる） */
{const RC=await mk('uRace3','racethree');const real=env.DB;let fired=false;
  const E={...env,DB:{prepare:s=>{if(!fired&&/^INSERT INTO notes\(uid,body/.test(s.trim())){fired=true;real.prepare(`INSERT INTO sanctions(kind,uid,permanent,starts_at,reason,status,root_key,created_at,updated_at) VALUES('uid','uRace3',1,?,'race test','active','race-root',?,?)`).bind(clock,clock,clock).runSync?.()}return real.prepare(s)},batch:l=>real.batch(l)}};
  tick();r=await call('/api/notes',{method:'POST',tok:RC,body:{body:'門のあとに停止'},E});
  expect('B3 門を通ったあとに停止されたら、投稿は書かない（403）',fired&&r[0]===403&&(await q(`SELECT COUNT(*) AS c FROM notes WHERE uid='uRace3'`))[0].c===0,{fired,r})}
expect('B3 同じ確認済みメールの前からのアカウントは表示も止める',(await q(`SELECT banned FROM users WHERE uid='uShare'`))[0].banned===2,await q(`SELECT banned FROM users WHERE uid='uShare'`));
/* B3 決まった時刻の仕事の記録（成功・失敗） */
{await w.scheduled({cron:'0 * * * *',scheduledTime:clock},env,{waitUntil(p){LATER.push(p)}});await settle();
  const j=(await q(`SELECT * FROM job_runs WHERE name='sanction_sweep'`))[0];expect('B3 期限の見直しの成功を記録',j&&j.last_ok===1&&j.ok_at===clock,j);
  const real=env.DB,E={...env,DB:{prepare:s=>{if(/^UPDATE users SET banned=0/.test(s.trim()))throw new Error('down');return real.prepare(s)},batch:l=>real.batch(l)}};
  tick(36e5);await w.scheduled({cron:'0 * * * *',scheduledTime:clock},E,{waitUntil(p){LATER.push(p.catch(()=>{}))}});await settle();
  const j2=(await q(`SELECT * FROM job_runs WHERE name='sanction_sweep'`))[0];expect('B3 失敗も記録（次の回にもう一度）',j2.last_ok===0&&j2.fails===1&&j2.ok_at===j.ok_at,j2);
  r=await call('/api/admin/sanctions',ADM);expect('B3 管理画面に仕事の結果',r[1].jobs.some(x=>x.name==='sanction_sweep'),r[1].jobs)}
}
/* ---------- 11. 1回のリクエストで増える D1 の問い合わせの数（報告に書く） ---------- */
{const real=env.DB;let cnt=0;const Ec={...env,DB:{prepare:s=>{cnt++;return real.prepare(s)},batch:l=>real.batch(l)}};
  const QN=Ec.DB;const tl0=(()=>{cnt=0})();void tl0;
  await call('/api/tl',{E:Ec});const anon=cnt;cnt=0;await call('/api/tl',{tok:N,E:Ec});const authed=cnt;cnt=0;
  tick();await call('/api/notes',{method:'POST',tok:N,body:{body:'数える'},E:Ec});const post=cnt;
  console.log(`  D1 の問い合わせ：ログインなしの /api/tl ${anon}・ログインありの /api/tl ${authed}・ふつうの投稿 ${post}（利用停止の確かめで増える分＝${authed-anon}）`);
  expect('ログインした人の読むだけで増える問い合わせ（前からの本人の確かめ1つ＋利用停止の確かめ2つ）は3つまで',authed-anon<=3,{anon,authed});void QN}
/* ---------- 12. 合言葉をどこにも出さない ---------- */
expect('Web Risk の合言葉・メールの鍵・メールは返事に出ない',!RESP.some(t=>t.includes(WR_KEY)||t.includes('email-hmac-key')||/zed\.attacker|mail\.test-gk\.net/i.test(t)),RESP.find(t=>t.includes(WR_KEY)));
Date.now=realNow;
console.log(bad?`links: NG（${bad}/${n}）`:`links: OK（${n}項目）`);
if(bad)process.exit(1);
