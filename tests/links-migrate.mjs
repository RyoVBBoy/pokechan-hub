// 表の移しかえの確認（docs/secure-link-posting-handoff.md）：前の版の表（note_links・sanctions などが無い）のまま新しいサーバーを動かす。
// 足すだけ（消さない・書きかえない）・何度・同時に動いても大丈夫・前の行はそのまま読める。まっさらの D1 から確かめるため、別のプロセスで動かす
import path from 'node:path';
import {makeD1} from './d1mock.mjs';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
if(process.argv[2]==='altfail'){
  const w=(await import(path.join(ROOT,'worker/dist/worker.js'))).default,real=makeD1();let broken=true;
  const DBx={prepare:q=>{if(broken&&/^ALTER TABLE note_links ADD COLUMN vh/.test(q))return{bind(){return this},run:async()=>{throw new Error('disk I/O error')},first:async()=>{throw new Error('disk I/O error')},all:async()=>{throw new Error('disk I/O error')}};return real.prepare(q)},batch:l=>real.batch(l)};
  await real.prepare(`CREATE TABLE note_links(note_id INTEGER PRIMARY KEY,uid TEXT NOT NULL,url TEXT NOT NULL,host TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',verdict TEXT,verdict_at INTEGER,expires_at INTEGER,created_at INTEGER,updated_at INTEGER)`).run();
  const env={DB:DBx,FIREBASE_PROJECT_ID:'pokechan-test',APP_TOKEN:'t'};
  const st=async()=>(await w.fetch(new Request('https://x.dev/api/links/config'),env,{waitUntil(){}})).status;
  const a=await st();broken=false;const b=await st();
  console.log(a>=500&&b===200?'ALTFAIL-OK':'ALTFAIL-NG '+a+' '+b);process.exit(0);
}
const OUT=[];globalThis.fetch=async u=>{OUT.push(String(u));return new Response('',{status:404})};
const w=(await import(path.join(ROOT,'worker/dist/worker.js'))).default;
const DB=makeD1();
/* 前の版の表と行 */
for(const sql of [`CREATE TABLE users(uid TEXT PRIMARY KEY,handle TEXT UNIQUE COLLATE NOCASE,name TEXT,bio TEXT,created_at INTEGER,updated_at INTEGER,agreed_at INTEGER,banned INTEGER DEFAULT 0)`,
  `CREATE TABLE notes(id INTEGER PRIMARY KEY AUTOINCREMENT,uid TEXT NOT NULL,body TEXT,media TEXT,created_at INTEGER,likes INTEGER DEFAULT 0,hidden INTEGER DEFAULT 0,ip TEXT)`,
  `INSERT INTO users(uid,handle,name,created_at,banned) VALUES('old','oldone','Old',1,0),('ban','banned1','B',1,1)`,
  `INSERT INTO notes(uid,body,created_at,ip) VALUES('old','前の版の投稿',1,''),('ban','停止中の人',2,'')`,
  /* このブランチの前の版（レビュー前）の表：root_key・case_id・rev・vh が無く、鍵の入れかえの写しが parent で何段もつながる */
  `CREATE TABLE sanctions(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT NOT NULL,uid TEXT,ehash TEXT,kver TEXT,permanent INTEGER NOT NULL DEFAULT 0,starts_at INTEGER,expires_at INTEGER,reason TEXT NOT NULL,evidence TEXT,source TEXT,actor TEXT,status TEXT NOT NULL DEFAULT 'active',appeal TEXT,parent INTEGER,created_at INTEGER,updated_at INTEGER)`,
  `INSERT INTO sanctions(id,kind,uid,reason,parent) VALUES(1,'uid','x','r',NULL),(2,'email',NULL,'r',1),(3,'email',NULL,'r',2),(4,'email',NULL,'r',3),(5,'uid','y','r',NULL)`,
  /* 前の1行の回数の表（レビュー4回目より前）：日 50 回・月 1200 回 */
  `CREATE TABLE link_budget(id TEXT PRIMARY KEY,day TEXT NOT NULL DEFAULT '',dn INTEGER NOT NULL DEFAULT 0,month TEXT NOT NULL DEFAULT '',mn INTEGER NOT NULL DEFAULT 0)`,
  `INSERT INTO link_budget VALUES('webrisk','2026-11-26',50,'2026-11',1200)`,
`CREATE TABLE note_links(note_id INTEGER PRIMARY KEY,uid TEXT NOT NULL,url TEXT NOT NULL,host TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',verdict TEXT,verdict_at INTEGER,expires_at INTEGER,created_at INTEGER,updated_at INTEGER)`])await DB.prepare(sql).run();
const env={DB,FIREBASE_PROJECT_ID:'pokechan-test',APP_TOKEN:'t',ADMIN_TOKEN:'admin-secret-123'};
const call=p=>w.fetch(new Request('https://x.dev'+p,{headers:{'cf-connecting-ip':'10.0.0.1'}}),env,{waitUntil(){}}).then(async r=>[r.status,await r.json()]);
let n=0,bad=0;const ok=(c,m,i)=>{n++;if(!c){bad++;console.error('NG',m,JSON.stringify(i))}};
const rs=await Promise.all([call('/api/tl'),call('/api/tl'),call('/api/links/config'),call('/api/tl')]);
ok(rs.every(x=>x[0]===200),'古い表のまま同時に読める',rs.map(x=>x[0]));
ok(rs[0][1].notes.length===1&&rs[0][1].notes[0].body==='前の版の投稿'&&!('ulink' in rs[0][1].notes[0])&&rs[0][1].notes[0].link===null,'前の行はそのまま（リンクなし・停止中の人は出ない）',rs[0][1]);
ok(rs[2][1].post===false&&rs[2][1].click===false,'変数がなければすべて止めている',rs[2][1]);
const tb=(await DB.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all()).results.map(x=>x.name);
ok(['note_links','link_verdicts','link_attempts','link_clicks','link_quota','link_events','sanctions','sanction_events','user_emails'].every(t=>tb.includes(t)),'新しい表を足した',tb);
ok((await DB.prepare(`SELECT COUNT(*) AS c FROM notes`).first()).c===2&&(await DB.prepare(`SELECT banned FROM users WHERE uid='ban'`).first()).banned===1,'前の行・手動の停止を書きかえない','');
const again=await Promise.all([1,2,3].map(()=>call('/api/tl')));ok(again.every(x=>x[0]===200),'もう一度・同時に動いても大丈夫','');
{const bd=(await DB.prepare(`SELECT day,month,n FROM link_budget_d ORDER BY day`).all()).results,ob=await DB.prepare(`SELECT * FROM link_budget WHERE id='webrisk'`).first();
  ok(JSON.stringify(bd)===JSON.stringify([{day:'2026-11-00',month:'2026-11',n:1150},{day:'2026-11-26',month:'2026-11',n:50}])&&ob.dn===0&&ob.mn===0,'前の1行の回数を日ごとの表に1回だけ移す（日 50・月の合計 1200・何度動いても2回数えない）',{bd,ob})}
await w.scheduled({cron:'0 * * * *',scheduledTime:Date.now()},env,{waitUntil(p){return p}});
ok((await DB.prepare(`SELECT banned FROM users WHERE uid='ban'`).first()).banned===1,'1時間ごとの掃除でも手動の停止は戻さない','');
ok(OUT.every(u=>!/webrisk/.test(u)),'変数がなければ安全確認に何も送らない',OUT);
{const rk=(await DB.prepare(`SELECT id,root_key FROM sanctions ORDER BY id`).all()).results;
  ok(rk.slice(0,4).every(x=>x.root_key==='id:1')&&rk[4].root_key==='id:5','前の版の写しは何段でも同じ root にまとめる',rk)}
{const cols=(await DB.prepare(`SELECT name FROM pragma_table_info('note_links')`).all()).results.map(x=>x.name);ok(cols.includes('rev')&&cols.includes('vh'),'前の版の表に列を足す',cols)}
/* 列を足すのが「すでにある」以外の理由で失敗したら閉じる（別のプロセスで） */
{const {execFileSync}=await import('node:child_process');let out='';
  try{out=execFileSync(process.execPath,[new URL(import.meta.url).pathname,'altfail'],{encoding:'utf8',stdio:['ignore','pipe','pipe']})}catch(e){out=String(e.stdout||'')+String(e.stderr||'')}
  ok(/ALTFAIL-OK/.test(out),'列を足すのに失敗したら閉じる・直れば使える',out.slice(-300))}
console.log(bad?`links-migrate: NG（${bad}/${n}）`:`links-migrate: OK（${n}項目）`);if(bad)process.exit(1);
