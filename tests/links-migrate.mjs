// 表の移しかえの確認（docs/secure-link-posting-handoff.md）：前の版の表（note_links・sanctions などが無い）のまま新しいサーバーを動かす。
// 足すだけ（消さない・書きかえない）・何度・同時に動いても大丈夫・前の行はそのまま読める。まっさらの D1 から確かめるため、別のプロセスで動かす
import path from 'node:path';
import {makeD1} from './d1mock.mjs';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
const OUT=[];globalThis.fetch=async u=>{OUT.push(String(u));return new Response('',{status:404})};
const w=(await import(path.join(ROOT,'worker/dist/worker.js'))).default;
const DB=makeD1();
/* 前の版の表と行 */
for(const sql of [`CREATE TABLE users(uid TEXT PRIMARY KEY,handle TEXT UNIQUE COLLATE NOCASE,name TEXT,bio TEXT,created_at INTEGER,updated_at INTEGER,agreed_at INTEGER,banned INTEGER DEFAULT 0)`,
  `CREATE TABLE notes(id INTEGER PRIMARY KEY AUTOINCREMENT,uid TEXT NOT NULL,body TEXT,media TEXT,created_at INTEGER,likes INTEGER DEFAULT 0,hidden INTEGER DEFAULT 0,ip TEXT)`,
  `INSERT INTO users(uid,handle,name,created_at,banned) VALUES('old','oldone','Old',1,0),('ban','banned1','B',1,1)`,
  `INSERT INTO notes(uid,body,created_at,ip) VALUES('old','前の版の投稿',1,''),('ban','停止中の人',2,'')`])await DB.prepare(sql).run();
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
await w.scheduled({cron:'0 * * * *',scheduledTime:Date.now()},env,{waitUntil(p){return p}});
ok((await DB.prepare(`SELECT banned FROM users WHERE uid='ban'`).first()).banned===1,'1時間ごとの掃除でも手動の停止は戻さない','');
ok(OUT.every(u=>!/webrisk/.test(u)),'変数がなければ安全確認に何も送らない',OUT);
console.log(bad?`links-migrate: NG（${bad}/${n}）`:`links-migrate: OK（${n}項目）`);if(bad)process.exit(1);
