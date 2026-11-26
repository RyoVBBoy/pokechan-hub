// 本物の D1 の動き（Cloudflare の workerd と Miniflare、手元の使い捨ての D1）で確かめる（docs/secure-link-posting-runbook.md §7）。
// 本番の ID・合言葉・外への書きこみは使わない。外への通信（ログインの鍵・安全確認）は、この中のにせもので答える。
// テストの D1 のまね（d1mock.mjs）で頼っていた動き（batch の結果の形・RETURNING・取引の取り消し・条件つきの書きこみ）が本物でも同じかを見る
import path from 'node:path';
import {Miniflare} from 'miniflare';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const PID='pokechan-test';
const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const kp=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...(await crypto.subtle.exportKey('jwk',kp.publicKey)),kid:'k1',use:'sig',alg:'RS256'};
const T0=Math.floor(Date.now()/1000);
const tok=async uid=>{const h=enc({alg:'RS256',kid:'k1',typ:'JWT'}),p=enc({iss:'https://securetoken.google.com/'+PID,aud:PID,sub:uid,iat:T0-10,exp:T0+3600,auth_time:T0-10,email:uid+'@mail.test-gk.net',email_verified:true});
  return h+'.'+p+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',kp.privateKey,new TextEncoder().encode(h+'.'+p))).toString('base64url')};
let n=0,bad=0;const ok=(c,m,i)=>{n++;if(!c){bad++;console.error('NG',m,JSON.stringify(i)?.slice(0,400))}};
const WR={inflight:0,max:0,calls:0,delay:0};
const mf=new Miniflare({modules:true,scriptPath:path.join(ROOT,'worker/dist/worker.js'),compatibilityDate:'2025-01-01',d1Databases:['DB'],
  bindings:{FB_ADAPTER_TOKEN:'adapter-token-it-0123456789abcdef-0123',FIREBASE_PROJECT_ID:PID,APP_TOKEN:'t',ADMIN_TOKEN:'admin-secret-123',LINKS_POST:'1',LINKS_CLICK:'1',SANCTIONS_ON:'1',EMAIL_HMAC_KEY:'email-hmac-key-test-0123456789abcdef-it',WEBRISK_API_KEY:'wr-it-key-0000000000',LINKS_WEBRISK_CONC:'1',LINKS_WEBRISK_MS:'3000'},
  outboundService:async req=>{const u=req.url;
    if(u.includes('securetoken@system.gserviceaccount.com'))return new Response(JSON.stringify({keys:[jwk]}),{headers:{'content-type':'application/json'}});
    if(u.startsWith('https://webrisk.googleapis.com/v1/uris:search?')){WR.calls++;WR.inflight++;WR.max=Math.max(WR.max,WR.inflight);
      try{if(WR.delay)await new Promise(r=>setTimeout(r,WR.delay));
        if(WR.bad&&decodeURIComponent(u).includes(WR.bad))return new Response(JSON.stringify({threat:{threatTypes:['MALWARE'],expireTime:new Date(Date.now()+3*864e5).toISOString()}}),{headers:{'content-type':'application/json'}});
        return new Response('{}',{headers:{'content-type':'application/json'}})}finally{WR.inflight--}}
    return new Response('',{status:404})}});
const db=await mf.getD1Database('DB');
const call=async(p,{method='GET',tok,body,admin}={})=>{const h={'content-type':'application/json','cf-connecting-ip':'10.6.0.1'};if(tok)h.authorization='Bearer '+tok;if(admin)h['x-admin-token']=admin;
  const r=await mf.dispatchFetch('https://x.dev'+p,{method,headers:h,body:body?JSON.stringify(body):undefined});return[r.status,await r.json().catch(()=>({}))]};
try{
/* ---- 1. D1 そのものの動き ---- */
await db.exec(`CREATE TABLE it_t(id INTEGER PRIMARY KEY AUTOINCREMENT,v TEXT UNIQUE)`);
let b=await db.batch([db.prepare(`INSERT INTO it_t(v) VALUES('a')`),db.prepare(`SELECT id,v FROM it_t`),db.prepare(`INSERT INTO it_t(v) VALUES('b') RETURNING id`),db.prepare(`INSERT INTO it_t(v) SELECT 'c' WHERE 0 RETURNING id`)]);
ok(Array.isArray(b)&&b.length===4&&b[1].results.length===1&&b[2].results[0].id===2&&b[3].results.length===0&&b[0].meta.changes===1&&b[3].meta.changes===0,'batch：読む文・RETURNING の結果が返る・何も書かない条件つきの文は結果なし',b.map(x=>({r:x.results,c:x.meta.changes})));
b=await db.batch([db.prepare(`INSERT INTO it_t(v) SELECT 'z' WHERE 0`),db.prepare(`SELECT last_insert_rowid() AS r`)]);
ok(b[1].results[0].r!==0,'書かなかった文のあとの last_insert_rowid() は前の行の番号のまま（だから使わない）',b[1].results);
let threw=false;try{await db.batch([db.prepare(`INSERT INTO it_t(v) VALUES('d')`),db.prepare(`INSERT INTO it_t(v) VALUES('a')`)])}catch(e){threw=true}
ok(threw&&!(await db.prepare(`SELECT 1 AS x FROM it_t WHERE v='d'`).first()),'batch は1つの取引：途中で失敗したら前の文も取り消す',threw);
ok((await db.prepare(`SELECT name FROM pragma_table_info('it_t')`).all()).results.map(x=>x.name).join()==='id,v','pragma_table_info が使える','');
await db.exec(`CREATE TABLE it_s(id INTEGER PRIMARY KEY,parent INTEGER,rk TEXT)`);await db.prepare(`INSERT INTO it_s(id,parent) VALUES(1,NULL),(2,1),(3,2),(4,3)`).run();
await db.prepare(`WITH RECURSIVE anc(id,rk,d) AS (SELECT id,'id:'||id,0 FROM it_s WHERE parent IS NULL UNION ALL SELECT s.id,a.rk,a.d+1 FROM it_s s JOIN anc a ON s.parent=a.id WHERE a.d<64) UPDATE it_s SET rk=(SELECT rk FROM anc WHERE anc.id=it_s.id) WHERE rk IS NULL`).run();
ok((await db.prepare(`SELECT COUNT(*) AS c FROM it_s WHERE rk='id:1'`).first()).c===4,'WITH RECURSIVE … UPDATE（root を何段でもたどる）','');
await db.exec(`CREATE TABLE it_b(id TEXT PRIMARY KEY,day TEXT,dn INTEGER,month TEXT,mn INTEGER)`);await db.prepare(`INSERT INTO it_b VALUES('w','2000-01-01',5,'2000-01',7)`).run();
const bu=await db.prepare(`UPDATE it_b SET dn=CASE WHEN day=?1 THEN dn+1 ELSE 1 END,mn=CASE WHEN month=?2 THEN mn+1 ELSE 1 END,day=?1,month=?2 WHERE id='w' AND (CASE WHEN day=?1 THEN dn ELSE 0 END)<?3 AND (CASE WHEN month=?2 THEN mn ELSE 0 END)<?4 RETURNING dn,mn`).bind('2000-01-02','2000-01',10,8).first();
ok(bu&&bu.dn===1&&bu.mn===8,'1行の UPDATE … RETURNING：SET は書きかえ前の値を使う（1日・1か月の回数を同時に）',bu);
ok(!(await db.prepare(`UPDATE it_b SET mn=mn+1 WHERE id='w' AND mn<8 RETURNING mn`).first()),'条件に合わなければ RETURNING は空（回数をこえない）','');
/* ---- 2. サーバーのプログラムを本物の D1 で ---- */
const rs=await Promise.all([call('/api/links/config'),call('/api/links/config'),call('/api/tl')]);
ok(rs.every(x=>x[0]===200),'まっさらの D1 で、同時に表を作っても動く',rs.map(x=>x[0]));
ok((await db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name IN ('sanctions_case_uid','sanctions_root_eh','fb_sync_due','note_links_vh','notes_op')`).all()).results.length===5,'足した索引がある','');
const U={};for(const id of ['iA','iB','iC','iD','iE','iF','iG'])U[id]=await tok(id);
for(const id in U){const r=await call('/api/me',{method:'POST',tok:U[id],body:{handle:'h'+id,name:id,agree:true}});ok(r[0]===200,'プロフィール '+id,r)}
let r=await call('/api/notes',{method:'POST',tok:U.iA,body:{body:'本物の D1 でふつうの投稿'}});ok(r[0]===200&&r[1].id>0,'ふつうの投稿',r);
r=await call('/api/notes',{method:'POST',tok:U.iB,body:{body:'リンク付き',url:'https://note.com/it/a'}});const ln=r[1].id;
const lr=await db.prepare(`SELECT l.note_id,n.uid FROM note_links l JOIN notes n ON n.id=l.note_id WHERE l.note_id=?`).bind(ln).first();
ok(r[0]===200&&lr&&lr.uid==='iB','リンクの行が、いま書いた投稿（同じ人）につく（last_insert_rowid を使わない）',{r,lr});
const mix=await Promise.all([...[1,2,3].map(i=>call('/api/notes',{method:'POST',tok:U.iC,body:{body:'plain'+i}})),...[1,2].map(i=>call('/api/notes',{method:'POST',tok:U.iC,body:{body:'lnk',url:'https://note.com/it/m'+i}}))]);
ok((await db.prepare(`SELECT COUNT(*) AS c FROM notes WHERE uid='iC'`).first()).c===1,'リンクあり・なしを同時に5件 → 15秒に1件だけ',mix.map(x=>x[0]));
ok((await db.prepare(`SELECT COUNT(*) AS c FROM note_links l LEFT JOIN notes n ON n.id=l.note_id WHERE n.id IS NULL OR n.uid<>l.uid`).first()).c===0,'書けなかったリンクの行は残らない','');
r=await call(`/api/links/${ln}/open`,{method:'POST',body:{}});const g=await call(`/api/links/${ln}/go`,{method:'POST',body:{intent:r[1].intent}});
ok(r[0]===200&&g[0]===200&&g[1].url==='https://note.com/it/a','open → go（許可を使い切るのと読むのを1つの batch で）',{r,g});
ok((await call(`/api/links/${ln}/go`,{method:'POST',body:{intent:r[1].intent}}))[0]===410,'許可は1回だけ','');
/* 同時に外へ送る数（LINKS_WEBRISK_CONC=1）・1か月の上限 */
WR.delay=400;WR.max=0;const c0=WR.calls;
const par=await Promise.all(['iD','iE','iF'].map((id,i)=>call('/api/notes',{method:'POST',tok:U[id],body:{body:'p',url:'https://note.com/it/par'+i}})));
ok(WR.max===1&&par.filter(x=>x[0]===200).length>=1&&par.filter(x=>x[0]===503).length>=1,'同時に外へ送るのは1つまで（D1 の札）・とれなければ 503',{max:WR.max,st:par.map(x=>x[0]),calls:WR.calls-c0});
ok((await db.prepare(`SELECT COUNT(*) AS c FROM link_leases WHERE expires_at>?`).bind(Date.now()).first()).c===0,'終わったら札を返す','');
WR.delay=0;
const mo=new Date().toISOString().slice(0,7),dy=new Date().toISOString().slice(0,10);
await db.prepare(`DELETE FROM link_budget_d`).run();await db.prepare(`INSERT INTO link_budget_d(day,month,n) VALUES(?,?,5),(?,?,89995)`).bind(dy,mo,mo+'-00',mo).run();
r=await call('/api/notes',{method:'POST',tok:U.iG,body:{body:'x',url:'https://note.com/it/quota'}});
const bq={dn:(await db.prepare(`SELECT n FROM link_budget_d WHERE day=?`).bind(dy).first()).n,mn:(await db.prepare(`SELECT SUM(n) AS n FROM link_budget_d WHERE month=?`).bind(mo).first()).n};
ok(r[0]===503&&bq.dn===5&&bq.mn===90000,'1か月の上限で閉じ、1日の回数も減らさない',{r,bq});
/* 確認の記録への同時の停止 → 1つだけ */
const ADM={admin:'admin-secret-123'};
const nA=(await db.prepare(`SELECT id FROM notes WHERE uid='iA' LIMIT 1`).first()).id;
const cs=await call('/api/admin/cases',{method:'POST',...ADM,body:{handle:'hiA',kind:'attack',summary:'このリンクがフィッシングと確かめた（記録の番号で確認）',refs:[{t:'note',id:nA}],attest:true,reviewer:'テスト担当',evidence_kinds:['direct']}});
const sb={kind:'perpetrator',case_id:cs[1].case_id,rationale:'意図的にフィッシングのリンクを広めたと確認したため停止する',confirm:'SANCTION',reviewer:'テスト担当',basis:'deliberate_attack'};
const ss=await Promise.all([1,2,3].map(()=>call('/api/admin/sanctions',{method:'POST',...ADM,body:sb})));
ok(ss.filter(x=>x[0]===200).length===1&&ss.filter(x=>x[0]===409).length===2&&(await db.prepare(`SELECT COUNT(*) AS c FROM sanctions WHERE case_id=? AND kind='uid'`).bind(cs[1].case_id).first()).c===1,'同じ確認の記録へ同時に3つ → 停止は1つ（ほかは 409）',ss.map(x=>x[0]));
ok((await db.prepare(`SELECT COUNT(*) AS c FROM fb_sync WHERE uid='iA' AND gen>done_gen`).first()).c===1,'Firebase の同期の行も1つ（同じ人は1行）','');
/* Firebase の同期の受け口を本物の D1 で：借りる（UPDATE … WHERE uid IN (SELECT … LIMIT) RETURNING）・記録・報告 */
{const AT='adapter-token-it-0123456789abcdef-0123';
  const fbp=async(p,b)=>{const r=await mf.dispatchFetch('https://x.dev'+p,{method:'POST',headers:{'content-type':'application/json','x-fb-adapter-token':AT},body:JSON.stringify(b)});return[r.status,await r.json().catch(()=>({}))]};
  const [c1,c2]=await Promise.all([fbp('/api/fb/claim',{max:20}),fbp('/api/fb/claim',{max:20})]);
  const it=[...c1[1].items||[],...c2[1].items||[]].filter(x=>x.uid==='iA');
  ok(c1[0]===200&&c2[0]===200&&it.length===1&&it[0].want==='disabled','同時に2つ借りても、同じ人は1つだけ（本物の D1）',{c1:c1[1],c2:c2[1]});
  const x=it[0];
  let r1=await fbp('/api/fb/intent',{uid:'iA',lease:x.lease,gen:x.gen,action:'disable',observed_disabled:false});
  let r2=await fbp('/api/fb/ack',{uid:'iA',lease:x.lease,gen:x.gen,result:'done',want:'disabled',observed_disabled:true,revoked:true});
  let r3=await fbp('/api/fb/ack',{uid:'iA',lease:x.lease,gen:x.gen,result:'done',want:'disabled',observed_disabled:true,revoked:true});
  const fr=await db.prepare(`SELECT owned,prior,done_gen,gen FROM fb_sync WHERE uid='iA'`).first();
  ok(r1[0]===200&&r2[0]===200&&r3[0]===200&&r3[1].repeat===true&&fr.owned===1&&fr.prior===0&&fr.done_gen===fr.gen,'記録→報告・同じ報告をもう一度でも1回分（本物の D1）',{r1,r2,r3,fr});
  const o1=await db.prepare(`SELECT kind,how,resolved_at,intent FROM fb_ops WHERE op=?`).bind(x.lease).first();
  ok(o1&&o1.intent==='disable'&&o1.how==='done'&&o1.resolved_at>0,'R7 操作の記録は intent と同じ取引で作られ、報告で片づく（本物の D1）',o1);
}
r=await call('/api/notes',{method:'POST',tok:U.iA,body:{body:'停止中'}});ok(r[0]===403,'停止中は投稿できない',r);
/* リンクの行は、このリクエストの使い捨ての鍵で書いた投稿だけにつく（本物の D1。同じ人の同じ時刻を鍵にしない） */
{await db.prepare(`DELETE FROM link_budget_d`).run();
  const UK=await tok('iK');await call('/api/me',{method:'POST',tok:UK,body:{handle:'hiK',name:'iK',agree:true}});
  /* 先に1回確かめて覚えさせる（同時に外へ送るのは1つまでの設定なので、覚えを使って同時に書く） */
  r=await call('/api/notes',{method:'POST',tok:UK,body:{body:'先に1回',url:'https://note.com/it/shared-op'}});ok(r[0]===200,'先に1回（覚えさせる）',r);
  const U2={};for(const id of ['iH','iI','iJ']){U2[id]=await tok(id);await call('/api/me',{method:'POST',tok:U2[id],body:{handle:'h'+id,name:id,agree:true}})}
  const pr=await Promise.all(Object.keys(U2).map(id=>call('/api/notes',{method:'POST',tok:U2[id],body:{body:'同じリンク',url:'https://note.com/it/shared-op'}})));
  const rows=(await db.prepare(`SELECT l.uid AS lu,n.uid AS nu,n.op FROM note_links l JOIN notes n ON n.id=l.note_id WHERE l.url='https://note.com/it/shared-op'`).all()).results;
  ok(pr.every(x=>x[0]===200)&&rows.length===4&&rows.every(x=>x.lu===x.nu&&/^[0-9a-f]{32}$/.test(x.op))&&new Set(rows.map(x=>x.op)).size===4,'同じリンクを同時に3人（と先の1人）：どれも自分の投稿につく（本物の D1）',{st:pr.map(x=>x[0]),rows});
  let dupErr=false;try{await db.prepare(`INSERT INTO notes(uid,body,created_at,ip,op) VALUES('iH','x',1,'',?)`).bind(rows[0].op).run()}catch(e){dupErr=true}
  ok(dupErr,'使い捨ての鍵は重ならない（本物の D1 の一意の索引）','')}
/* 期限の見直し（決まった時刻の仕事） */
await db.prepare(`INSERT INTO sanctions(kind,uid,permanent,starts_at,expires_at,reason,status,root_key,created_at,updated_at) VALUES('uid','iF',0,1,2,'old','active','it-exp',1,1)`).run();
await db.prepare(`UPDATE users SET banned=2 WHERE uid='iF'`).run();
const wk=await mf.getWorker();await wk.scheduled({cron:'0 * * * *',scheduledTime:new Date()});
await new Promise(r=>setTimeout(r,500));
const jr=await db.prepare(`SELECT last_ok FROM job_runs WHERE name='sanction_sweep'`).first();
ok((await db.prepare(`SELECT banned FROM users WHERE uid='iF'`).first()).banned===0&&jr&&jr.last_ok===1,'1時間ごとの仕事で、期限の来た停止の表示を戻し、結果を残す',jr);
ok((await db.prepare(`SELECT banned FROM users WHERE uid='iA'`).first()).banned===2,'いつまでもの停止は戻さない','');
/* R7（最後に動かす：iA の停止を取り消すため） */
{const AT='adapter-token-it-0123456789abcdef-0123';
  const fbp=async(p,b)=>{const r=await mf.dispatchFetch('https://x.dev'+p,{method:'POST',headers:{'content-type':'application/json','x-fb-adapter-token':AT},body:JSON.stringify(b)});return[r.status,await r.json().catch(()=>({}))]};
  const SID=(await db.prepare(`SELECT id FROM sanctions WHERE uid='iA' AND kind='uid' AND status='active' ORDER BY id LIMIT 1`).first()).id;
  /* R7 戻す呼び出しを送って落ちた（報告なし）：その操作は crash になり、片づくまでそのアカウントは借りられない（本物の D1） */
  const sid=SID;
  await call(`/api/admin/sanctions/${sid}/reverse`,{method:'POST',...ADM,body:{reason:'本物の D1 のテストで取り消す',confirm:true}});
  let c3=await fbp('/api/fb/claim',{});const y=c3[1].items.find(z=>z.uid==='iA');
  let r4=await fbp('/api/fb/intent',{uid:'iA',lease:y.lease,gen:y.gen,action:'enable',observed_disabled:true});
  ok(y&&y.want==='enabled'&&r4[0]===200&&(await db.prepare(`SELECT kind FROM fb_ops WHERE op=?`).bind(y.lease).first()).kind==='pending','R7 戻す前の記録と pending の操作（本物の D1）',{y,r4});
  await db.prepare(`UPDATE fb_sync SET lease_until=0 WHERE uid='iA'`).run();
  c3=await fbp('/api/fb/claim',{});const o2=await db.prepare(`SELECT kind,resolved_at FROM fb_ops WHERE op=?`).bind(y.lease).first();
  ok(!c3[1].items.some(z=>z.uid==='iA')&&o2.kind==='crash'&&o2.resolved_at===null,'R7 報告がないまま借りる時間が切れた：crash・そのアカウントは借りない（本物の D1）',{c3:c3[1],o2});
  /* R7 読み直しの片づけの取引の2つ目の文を、本物の D1 の中で失敗させる（トリガー）：1つ目（操作の片づけ）も取り消される */
  const g0=(await db.prepare(`SELECT gen FROM fb_sync WHERE uid='iA'`).first()).gen;
  await db.exec(`CREATE TABLE it_inj(x INTEGER)`);await db.exec(`INSERT INTO it_inj VALUES(1)`);
  await db.exec(`CREATE TRIGGER it_fail BEFORE UPDATE ON fb_sync WHEN (SELECT COUNT(*) FROM it_inj)>0 BEGIN SELECT RAISE(ABORT,'injected'); END`);
  let r5=await fbp('/api/fb/observe',{uid:'iA',op:y.lease,observed_disabled:false,settled:'ok'});
  const o3=await db.prepare(`SELECT resolved_at,how FROM fb_ops WHERE op=?`).bind(y.lease).first();
  ok(r5[0]>=500&&o3.resolved_at===null&&o3.how===null&&(await db.prepare(`SELECT gen FROM fb_sync WHERE uid='iA'`).first()).gen===g0,'R7 取引の途中で失敗：操作の片づけも取り消され、番号も変わらない（本物の D1 の batch の取り消し）',{r5,o3});
  c3=await fbp('/api/fb/claim',{});ok(!c3[1].items.some(z=>z.uid==='iA'),'R7 そのあいだもアカウントは借りられない（本物の D1）',c3[1]);
  await db.exec(`DELETE FROM it_inj`);
  r5=await fbp('/api/fb/observe',{uid:'iA',op:y.lease,observed_disabled:false,settled:'ok'});
  const o4=await db.prepare(`SELECT resolved_at,how FROM fb_ops WHERE op=?`).bind(y.lease).first();
  ok(r5[0]===200&&!r5[1].recorded_only&&o4.how==='observe'&&(await db.prepare(`SELECT gen FROM fb_sync WHERE uid='iA'`).first()).gen===g0+1,'R7 やり直すと片づき、番号も同じ取引で進む（本物の D1）',{r5,o4});
  r5=await fbp('/api/fb/observe',{uid:'iA',op:y.lease,observed_disabled:false,settled:'ok'});ok(r5[1].recorded_only===true&&(await db.prepare(`SELECT gen FROM fb_sync WHERE uid='iA'`).first()).gen===g0+1,'R7 同じ読み直しは1回分だけ（本物の D1）',r5);
  await db.exec(`DROP TRIGGER it_fail`)}
/* R8 危険の答え（覚えに入らない＝上限）：覚える・同じ行き先を止める・上限の印は1つの取引。最後の文を本物の D1 の中で失敗させると全部取り消され、印だけの文で閉じる */
{await db.prepare(`DELETE FROM link_budget_d`).run();await db.prepare(`DELETE FROM link_state`).run();
  for(const id of ['iH','iI']){U[id]=await tok(id);await call('/api/me',{method:'POST',tok:U[id],body:{handle:'h'+id,name:id,agree:true}})}
  const clr=async()=>{await db.prepare(`DELETE FROM link_attempts`).run();await db.prepare(`UPDATE notes SET created_at=created_at-60000`).run()};
  await clr();const p1=await call('/api/notes',{method:'POST',tok:U.iH,body:{body:'r8',url:'https://note.com/it/r8same'}});await clr();const p2=await call('/api/notes',{method:'POST',tok:U.iI,body:{body:'r8',url:'https://note.com/it/r8same'}});
  ok(p1[0]===200&&p2[0]===200,'R8 同じ行き先の投稿を2つ（問題なし）',{p1,p2});
  const now=Date.now();
  await db.prepare(`WITH RECURSIVE c(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM c WHERE i<20000) INSERT OR REPLACE INTO link_verdicts(h,verdict,types,checked_at,expires_at) SELECT 'it8fill'||i,'unsafe','MALWARE',?,? FROM c`).bind(now,now+864e5).run();
  const vh=(await db.prepare(`SELECT vh FROM note_links WHERE note_id=?`).bind(p1[1].id).first()).vh;
  await db.prepare(`INSERT OR REPLACE INTO link_verdicts(h,verdict,types,checked_at,expires_at) VALUES(?,'clean','',?,?)`).bind(vh,now,now+864e5).run();
  const snap=async()=>({l:(await db.prepare(`SELECT state,rev FROM note_links WHERE note_id IN (?,?) ORDER BY note_id`).bind(p1[1].id,p2[1].id).all()).results,v:(await db.prepare(`SELECT verdict FROM link_verdicts WHERE h=?`).bind(vh).all()).results.map(x=>x.verdict),
    f:(await db.prepare(`SELECT v FROM link_state WHERE k='wr_saturated'`).all()).results.map(x=>x.v),u:(await db.prepare(`SELECT COUNT(*) AS c FROM link_verdicts WHERE verdict='unsafe'`).first()).c});
  const s0=await snap();WR.bad='r8same';
  await db.exec(`CREATE TRIGGER it_r8 BEFORE INSERT ON link_state WHEN NEW.v='unsafe-cache-full' BEGIN SELECT RAISE(ABORT,'injected-r8'); END`);
  try{
    const rc=await call(`/api/admin/links/${p1[1].id}`,{method:'POST',...ADM,body:{action:'recheck',reason:'本物の D1 の取引の取り消し',confirm:true}});
    const s1=await snap();
    ok(JSON.stringify(s1.l)===JSON.stringify(s0.l)&&s1.v.join()==='clean'&&s1.u===s0.u,'R8 最後の文（上限の印）が失敗：投稿の状態・番号・覚えは書きかわらない（本物の D1 の batch の取り消し）',{rc,s0,s1});
    ok(s1.f.join()==='unsafe-write-failed','R8 取引が書けなければ、印だけの文で上限の印を立てる（本物の D1）',s1);
    const o2=await call(`/api/links/${p2[1].id}/open`,{method:'POST',body:{}});ok(o2[0]===503,'R8 そのあいだ、同じ行き先の古い投稿は開けない（本物の D1）',o2);
  }finally{await db.exec(`DROP TRIGGER it_r8`)}
  await db.prepare(`DELETE FROM link_state`).run();
  const rc2=await call(`/api/admin/links/${p1[1].id}`,{method:'POST',...ADM,body:{action:'recheck',reason:'本物の D1 でふつうに書ける',confirm:true}});
  const s2=await snap();
  ok(rc2[0]===200&&rc2[1].verdict==='unsafe'&&s2.l.every(x=>x.state==='unsafe')&&s2.l.every((x,i)=>x.rev>s0.l[i].rev)&&s2.v.length===0&&s2.f.join()==='unsafe-cache-full'&&s2.u<=s0.u,'R8 1つの取引で：同じ行き先の投稿をどれも止める・問題なしの覚えを消す・上限の印・危険の行は増えない（本物の D1）',{rc2,s2});
  WR.bad=null;await db.prepare(`DELETE FROM link_verdicts WHERE h LIKE 'it8fill%'`).run();await db.prepare(`DELETE FROM link_state`).run()}
}finally{await mf.dispose()}
console.log(bad?`d1-integration: NG（${bad}/${n}）`:`d1-integration: OK（${n}項目・Miniflare/workerd の手元の D1）`);if(bad)process.exit(1);
