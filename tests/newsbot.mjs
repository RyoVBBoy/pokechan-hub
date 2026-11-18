// お知らせbot の時刻（2026/11/18）：見つける（:47・1時間に1回）と投稿する（ちょうどの時刻 HH:00）を分けたことの確認。
//  ・16:47 に見つけた → 17:00 に投稿、16:59 → 17:00、17:00 ちょうどの前（16:59:59）には投稿しない
//  ・同じ時刻の回が2回・同時に動いても二度投稿しない。投稿に失敗したら次のちょうどの時刻にもう一度
//  ・読めない・何もないときは何もしない。前の行（state なし）は投稿しなおさない
//  ・scheduled の cron の振り分け（"47 * * * *"＝見つける、"0 * * * *"＝投稿、ランキングbot は前と同じ回だけ）
import path from 'node:path';
import {makeD1} from './d1mock.mjs';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
let FEED={data:[]},FAIL=false,TIER_CALLS=0,AI_CALLS=0;
globalThis.fetch=async u=>{u=String(u);
  if(u.includes('champions-news.pokemon-home.com')){if(FAIL)throw new Error('network');return new Response(JSON.stringify(FEED),{headers:{'content-type':'application/json'}})}
  if(u.includes('generativelanguage.googleapis.com')){AI_CALLS++;return new Response('{}',{status:500})}
  if(u.endsWith('/assets/tier.json')){TIER_CALLS++;return new Response('',{status:404})}
  return new Response('',{status:404})};
const w=(await import(path.join(ROOT,'worker/dist/worker.js'))).default;
const DB=makeD1();const env={DB,APP_TOKEN:'t',ADMIN_TOKEN:'admin-secret-123',GEMINI_API_KEY:'test-key'};
/* 本番と同じく、表（users など）を先に作っておく（サイトへの最初のアクセスで作られる） */
await w.fetch(new Request('https://x.dev/api/tl',{headers:{'cf-connecting-ip':'10.0.0.1'}}),env,{waitUntil(){}});
let bad=0,n=0;const ok=(c,m,i)=>{n++;if(!c){bad++;console.error('NG',m,i===undefined?'':JSON.stringify(i))}};
/* 日本時間の時刻（Asia/Tokyo＝UTC+9） */
const JST=(y,mo,d,h,mi,s=0)=>Date.UTC(y,mo-1,d,h-9,mi,s);
const run=async(cron,at)=>{const ps=[];const real=Date.now;Date.now=()=>at;
  try{await w.scheduled({cron,scheduledTime:at},env,{waitUntil:p=>ps.push(p)});await Promise.all(ps)}finally{Date.now=real}};
const posts=async()=>(await DB.prepare(`SELECT n.id,n.body,n.link,n.created_at FROM notes n WHERE n.uid='bot:news' ORDER BY n.id`).all()).results;
const item=(i,title)=>({title,infoKind:9,kindTxt:'お知らせ',stAt:Math.floor(JST(2026,11,18,10,0)/1000)+i,link:`page/${i}.html`});
const seen=async url=>DB.prepare(`SELECT state,fetched_at,publish_at,posted_at,note_id FROM news_seen WHERE url=?`).bind(url).first();
const U=i=>`https://news.pokemon-home.com/ja/page/${i}.html`;

/* 1. 16:47 に見つける：すぐには投稿しない。投稿の時刻は 17:00 */
FEED={data:[item(1,'メンテナンスのお知らせ')]};
await run('47 * * * *',JST(2026,11,18,16,47));
let s1=await seen(U(1));
ok(s1&&s1.state==='queued'&&s1.fetched_at===JST(2026,11,18,16,47)&&s1.publish_at===JST(2026,11,18,17,0),'16:47 に見つけた → 待ち・投稿は 17:00（見つけた時刻と投稿の時刻を分けて残す）',s1);
ok((await posts()).length===0,'見つけた回では投稿しない');
/* 2. 16:59 に見つけたものも 17:00 */
FEED={data:[item(2,'アップデートのお知らせ'),item(1,'メンテナンスのお知らせ')]};
await run('47 * * * *',JST(2026,11,18,16,59,30));
let s2=await seen(U(2));ok(s2&&s2.publish_at===JST(2026,11,18,17,0),'16:59 に見つけた → 17:00',s2);
ok((await seen(U(1))).fetched_at===JST(2026,11,18,16,47),'同じお知らせは2回待ちに入れない（最初に見つけた時刻のまま）');
/* 3. 17:00 より前の投稿の回では出さない */
await run('0 * * * *',JST(2026,11,18,16,59,59));
ok((await posts()).length===0,'16:59:59 には投稿しない');
/* 4. 17:00 ちょうどの回で投稿（古い順） */
await run('0 * * * *',JST(2026,11,18,17,0));
let P=await posts();
ok(P.length===2&&P.every(p=>p.created_at===JST(2026,11,18,17,0))&&/メンテナンス/.test(P[0].body)&&/アップデート/.test(P[1].body),'17:00 に2件を投稿（古い順・投稿の時刻は 17:00）',P);
s1=await seen(U(1));ok(s1.state==='posted'&&s1.posted_at===JST(2026,11,18,17,0)&&s1.note_id===P[0].id,'投稿したら posted と時刻と投稿の番号',s1);
/* 5. 同じ時刻の回がもう一度動いても・同時に2つ動いても、二度投稿しない */
await run('0 * * * *',JST(2026,11,18,17,0));
FEED={data:[item(3,'不具合のお知らせ')]};await run('47 * * * *',JST(2026,11,18,17,47));
await Promise.all([run('0 * * * *',JST(2026,11,18,18,0)),run('0 * * * *',JST(2026,11,18,18,0))]);
P=await posts();ok(P.length===3&&P.filter(p=>/不具合/.test(p.body)).length===1,'やり直し・同時に動いても1回だけ投稿',P.map(p=>p.body));
/* 6. 少し遅れて動いた回（scheduledTime は 19:00、動いたのは 19:00:40）でも、その時刻の分は出す */
FEED={data:[item(4,'アンケートのお知らせ')]};await run('47 * * * *',JST(2026,11,18,18,47));
await run('0 * * * *',JST(2026,11,18,19,0,40));
ok((await posts()).some(p=>/アンケート/.test(p.body)),'遅れて動いた 19:00 の回でも 19:00 の分を投稿');
/* 7. 読めない・何もない回は何もしない */
FAIL=true;await run('47 * * * *',JST(2026,11,18,19,47));FAIL=false;
FEED={data:[]};await run('47 * * * *',JST(2026,11,18,20,47));await run('0 * * * *',JST(2026,11,18,21,0));
ok((await posts()).length===4&&!(await DB.prepare(`SELECT 1 FROM news_seen WHERE state='queued'`).first()),'読めない・何もない回では何も待ちに入らず、何も投稿しない');
/* 8. 投稿に失敗したら待ちに戻し、次の時刻にもう一度（投稿中のまま止まらない） */
FEED={data:[item(5,'イベントのお知らせ')]};await run('47 * * * *',JST(2026,11,18,21,47));
const realPrep=DB.prepare.bind(DB);let broke=true;
DB.prepare=sql=>{if(broke&&/^INSERT INTO notes/.test(sql))throw new Error('db down');return realPrep(sql)};
await run('0 * * * *',JST(2026,11,18,22,0));
ok((await seen(U(5))).state==='queued','投稿に失敗したら待ちに戻す',await seen(U(5)));
broke=false;DB.prepare=realPrep;await run('0 * * * *',JST(2026,11,18,23,0));
ok((await seen(U(5))).state==='posted'&&(await posts()).filter(p=>/イベント/.test(p.body)).length===1,'次のちょうどの時刻に1回だけ投稿');
/* 8b. 投稿した直後、「済み」の印を付ける前に失敗（取引の途中で失敗）：投稿と印は1つの取引なので、投稿も残らない → 次の時刻に1回だけ */
FEED={data:[item(6,'取引のお知らせ')]};await run('47 * * * *',JST(2026,11,18,22,47));
{const rp=DB.prepare.bind(DB);DB.prepare=sql=>{const st=rp(sql);if(/^UPDATE news_seen SET state='posted'/.test(sql)){return{bind:(...a)=>({run:async()=>{throw new Error('crash after post')}})}}return st};
 await run('0 * * * *',JST(2026,11,18,23,0));DB.prepare=rp}
ok((await posts()).filter(p=>/取引/.test(p.body)).length===0&&(await seen(U(6))).state==='queued','印を付ける前に失敗したら投稿も取り消され、待ちに戻る（片方だけにならない）',await seen(U(6)));
await run('0 * * * *',JST(2026,11,19,0,0));
ok((await posts()).filter(p=>/取引/.test(p.body)).length===1&&(await seen(U(6))).state==='posted','次の時刻に1回だけ投稿');
/* 8c. 待ちを取った直後に止まった（posting のまま・投稿なし）：15分たったら待ちに戻して投稿（なくさない） */
FEED={data:[item(7,'止まったお知らせ')]};await run('47 * * * *',JST(2026,11,19,0,47));
await DB.prepare(`UPDATE news_seen SET state='posting',claimed_at=? WHERE url=?`).bind(JST(2026,11,19,1,0),U(7)).run();
await run('0 * * * *',JST(2026,11,19,1,10));ok((await seen(U(7))).state==='posting','止まってから15分たつまでは触らない（ほかの回がまだ投稿中かもしれない）');
await run('0 * * * *',JST(2026,11,19,2,0));
ok((await seen(U(7))).state==='posted'&&(await posts()).filter(p=>/止まった/.test(p.body)).length===1,'15分たったら待ちに戻して1回だけ投稿');
/* 8d. posting のまま止まっているが、投稿はもうある：二度投稿せず「済み」にする */
FEED={data:[item(8,'投稿済みのお知らせ')]};await run('47 * * * *',JST(2026,11,19,2,47));
await DB.prepare(`UPDATE news_seen SET state='posting',claimed_at=? WHERE url=?`).bind(JST(2026,11,19,2,50),U(8)).run();
await DB.prepare(`INSERT INTO notes(uid,body,created_at,ip,reply_to,media,link) VALUES('bot:news','投稿済みのお知らせ',?,'bot',0,NULL,?)`).bind(JST(2026,11,19,2,51),U(8)).run();
await run('0 * * * *',JST(2026,11,19,4,0));
ok((await seen(U(8))).state==='posted'&&(await posts()).filter(p=>/投稿済み/.test(p.body)).length===1,'投稿がもうあれば「済み」にするだけ（二度投稿しない）',await seen(U(8)));
/* 9. 前の版の行（state なし）は投稿しなおさない */
await DB.prepare(`INSERT INTO news_seen(url,title,note_id,created_at) VALUES(?,?,0,?)`).bind(U(9),'前の版で記録だけ',JST(2026,11,1,10,0)).run();
FEED={data:[item(9,'前の版で記録だけ')]};await run('47 * * * *',JST(2026,11,18,23,47));await run('0 * * * *',JST(2026,11,19,0,0));
ok(!(await posts()).some(p=>/前の版/.test(p.body)),'前の版の行は投稿しなおさない');
/* 10. 一度に新しいものがたくさんあっても、新しい3件だけ待ちに（残りは記録だけ） */
FEED={data:[10,11,12,13,14].map(i=>item(i,'まとめて'+i))};await run('47 * * * *',JST(2026,11,19,0,47));
const st=(await DB.prepare(`SELECT state,COUNT(*) AS c FROM news_seen WHERE title LIKE 'まとめて%' GROUP BY state`).all()).results;
ok(JSON.stringify(st.sort((a,b)=>a.state.localeCompare(b.state)))==='[{"state":"queued","c":3},{"state":"skipped","c":2}]','新しい3件だけ待ち、残りは記録だけ',st);
/* 11. ランキングbot は前と同じ回（毎日 3:23 と日本時間 10:47・16:47・22:47）だけ */
TIER_CALLS=0;await run('47 * * * *',JST(2026,11,19,14,47));await run('0 * * * *',JST(2026,11,19,15,0));
ok(TIER_CALLS===0,'ランキングbot：14:47・15:00 の回では動かない');
await run('47 * * * *',JST(2026,11,19,16,47));ok(TIER_CALLS===1,'ランキングbot：16:47 の回では動く');
/* 12. 管理画面の「今すぐ確認」も待ちに入れるだけ（投稿は次のちょうどの時刻） */
FEED={data:[item(20,'管理画面から確認')]};const real=Date.now;Date.now=()=>JST(2026,11,19,16,52);
const r=await w.fetch(new Request('https://x.dev/api/admin/news/run',{method:'POST',headers:{'content-type':'application/json','x-admin-token':'admin-secret-123','cf-connecting-ip':'10.0.0.9'},body:'{}'}),env,{waitUntil(){}});Date.now=real;
const j=await r.json();ok(r.status===200&&j.queued>=1&&j.publish_at===JST(2026,11,19,17,0)&&!(await posts()).some(p=>/管理画面/.test(p.body)),'今すぐ確認：待ちに入れ、17:00 に投稿する予定を返す',j);
/* 13. 公式のデータが読めないとき：AI・検索の予備は前と同じ1日3回（日本時間 10:47・16:47・22:47）だけ。ほかの毎時の回では AI を呼ばない */
FAIL=true;AI_CALLS=0;await run('47 * * * *',JST(2026,11,19,17,47));await run('47 * * * *',JST(2026,11,19,18,47));
ok(AI_CALLS===0,'公式が読めない毎時の回では AI を呼ばない',AI_CALLS);
await run('47 * * * *',JST(2026,11,19,22,47));ok(AI_CALLS>0,'22:47 の回では前と同じく予備（AI）を使う',AI_CALLS);/* 同じ 22:47 の回がもう一度・同時に2つ動いても（やり直し・Worker の起動し直し）、AI の予備は使わない（D1 の news_ai で1回だけ） */
{const c0=AI_CALLS;await Promise.all([run('47 * * * *',JST(2026,11,19,22,47,5)),run('47 * * * *',JST(2026,11,19,22,47,9))]);
ok(AI_CALLS===c0,'同じ回が重ねて動いても AI の予備は2回目を使わない',[c0,AI_CALLS])}
/* 1日に予備を使った回は3回まで（D1 に残る）：別の日の 10:47・16:47・22:47 で3回、その日の記録は3行 */
for(const h of [10,16,22])await run('47 * * * *',JST(2026,11,20,h,47));
{const r=await DB.prepare(`SELECT day,COUNT(*) AS c FROM news_ai GROUP BY day ORDER BY day`).all();
 ok(JSON.stringify(r.results)==='[{"day":"2026-11-19","c":1},{"day":"2026-11-20","c":3}]','予備を使った回は D1 に残り、1日3回まで',r.results)}
/* 上限の確かめ：表に同じ日の3行があれば、予備の回でも使わない */
await DB.prepare(`INSERT INTO news_ai(slot,day,at) VALUES('2026-11-21-x1','2026-11-21',0),('2026-11-21-x2','2026-11-21',0),('2026-11-21-x3','2026-11-21',0)`).run();
{const c0=AI_CALLS;await run('47 * * * *',JST(2026,11,21,10,47));ok(AI_CALLS===c0,'その日にもう3回使っていれば使わない',[c0,AI_CALLS])}
FAIL=false;
console.log(bad?`newsbot: NG（${bad}件）`:`newsbot: OK（${n}項目）`);if(bad)process.exitCode=1;
