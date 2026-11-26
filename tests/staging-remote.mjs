// ステージング（gk-links-staging）の本物の Cloudflare の D1 と Worker で確かめる（docs/secure-link-posting-runbook.md §7）。
// .github/workflows/staging-d1.yml から動かす。合成のデータだけ。本番の Worker・D1 には何もしない（名前を確かめてから動く）。
// 外の安全確認（Web Risk）と Firebase は使わない（WEBRISK_API_KEY なし・ログインのトークンを送らない）。
// 要るもの（環境変数）：STG_BASE（https://gk-links-staging.<サブドメイン>.workers.dev）・STG_ADMIN・STG_AT（アダプターの合言葉）・STG_DB（gk-links-staging）
// D1 への SQL は wrangler d1 execute --remote（CLOUDFLARE_API_TOKEN・CLOUDFLARE_ACCOUNT_ID はワークフローの秘密。ここでは出さない）
import {spawnSync} from 'node:child_process';
const BASE=process.env.STG_BASE,ADMIN=process.env.STG_ADMIN,AT=process.env.STG_AT,DB=process.env.STG_DB||'';
if(!BASE||!ADMIN||!AT||DB!=='gk-links-staging'){console.error('staging-remote: 設定が足りないか、D1 の名前がステージングではありません');process.exit(2)}
if(!/^https:\/\/gk-links-staging\.[a-z0-9-]+\.workers\.dev$/.test(BASE)){console.error('staging-remote: アドレスがステージングの Worker ではありません');process.exit(2)}
const WR=process.env.WRANGLER||'wrangler';
let n=0,bad=0;const ok=(c,m,i)=>{n++;console.log((c?'ok ':'NG ')+m+(c?'':' '+JSON.stringify(i)?.slice(0,400)));if(!c)bad++};
/* 本物の D1 に SQL（読む・書く）。結果は results の配列 */
/* 本物の D1 はときどき一時的な失敗（internal error など）を返すので、同じ文を3回まで間をあけて送り直す（読む文・IGNORE つきの文・1回だけ当たる文だけをここで使う） */
const sleepS=ms=>{const t=Date.now()+ms;while(Date.now()<t){Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,Math.min(500,t-Date.now()))}};
let sqlRetries=0;
/* 送り直してよいのは、何度送っても同じになる文だけ（SELECT・OR IGNORE・IF [NOT] EXISTS）。ほかは1回だけ */
const sqlSafe=q=>/^\s*SELECT\b/i.test(q)||/\bOR IGNORE\b|\bIF (NOT )?EXISTS\b/i.test(q);
const sql=q=>{let last='';const max=sqlSafe(q)?3:1;for(let t=1;t<=max;t++){const r=spawnSync(WR,['d1','execute',DB,'--remote','--json','--command',q],{encoding:'utf8',env:{...process.env,WRANGLER_SEND_METRICS:'false'},maxBuffer:1<<24});
    if(r.status===0){try{const j=JSON.parse(r.stdout);return (Array.isArray(j)?j:[j]).flatMap(x=>x.results||[])}catch(e){last='json: '+e.message}}
    else last=((r.stderr||'')+' '+(r.stdout||'')).replace(/\s+/g,' ').slice(-300);
    if(t<max){sqlRetries++;console.log('  (d1 execute をやり直す '+t+'/2: '+last.slice(0,160)+')');sleepS(5000*t)}}
  throw new Error('d1 execute failed: '+last)};
const H={'content-type':'application/json'};
const call=async(p,{method='GET',body,admin,ad}={})=>{const h={...H};if(admin)h['x-admin-token']=ADMIN;if(ad)h['x-fb-adapter-token']=AT;
  const r=await fetch(BASE+p,{method,headers:h,body:body?JSON.stringify(body):undefined});let j=null;try{j=await r.json()}catch(e){}return[r.status,j||{}]};
const fbp=(p,b)=>call(p,{method:'POST',body:b,ad:true});
const ADM={admin:true};
/* 0. 公開されるまで待つ（新しい workers.dev は少しかかる） */
let up=null;for(let i=0;i<30&&!up;i++){try{const r=await call('/api/links/config');if(r[0]===200)up=r}catch(e){}if(!up)await new Promise(r=>setTimeout(r,4000))}
ok(!!up,'R1 ステージングの Worker に届く',up);if(!up)process.exit(1);
ok(up[1].post===false&&up[1].click===true,'R1 Web Risk の鍵がないのでリンクの投稿は止まっている（click は設定どおり）',up[1]);
/* 1. 移しかえ：前の版の表（ワークフローで先に入れた）が、はじめての呼び出しで新しい形になる（本物の D1） */
/* はじめての呼び出しが本物の D1 の一時的な失敗で 500 になっても、準備のしるし（READY）は成功してから立てるので、次の呼び出しで最後まで作れる */
let r=await call('/api/tl'),first=r[0],tries=1;
while(r[0]!==200&&tries<4){await new Promise(z=>setTimeout(z,4000*tries));r=await call('/api/tl');tries++}
if(first!==200)console.log('  (はじめての呼び出しは '+first+'。'+tries+' 回目で 200)');
ok(r[0]===200,'R1 はじめての呼び出し（表の作成・移しかえ。一時的な失敗のあとも次の呼び出しで最後まで作れる）',{first,tries,last:r[0]});
const tb=sql(`SELECT name FROM sqlite_master WHERE type='table'`).map(x=>x.name);
ok(['note_links','link_verdicts','link_state','link_intents','link_budget_d','sanctions','sanction_cases','fb_sync','fb_ops','key_sentinels'].every(t=>tb.includes(t)),'R1 新しい表がある（本物の D1）',tb);
const fo=sql(`SELECT op,uid,kind,intent,resolved_at FROM fb_ops WHERE uid IN ('m1','m2','m3') ORDER BY uid`);
ok(JSON.stringify(fo)===JSON.stringify([{op:'legacy:m1',uid:'m1',kind:'crash',intent:'disable',resolved_at:null},{op:'oldop',uid:'m2',kind:'timeout',intent:'disable',resolved_at:null}]),'R1 前の版の報告のない記録・結果が分からない記録を操作の記録に移す（本物の D1）',fo);
const bd=sql(`SELECT day,month,n FROM link_budget_d ORDER BY day`),ob=sql(`SELECT dn,mn FROM link_budget WHERE id='webrisk'`)[0];
ok(JSON.stringify(bd)===JSON.stringify([{day:'2026-11-00',month:'2026-11',n:1150},{day:'2026-11-26',month:'2026-11',n:50}])&&ob.dn===0&&ob.mn===0,'R1 前の1行の回数を日ごとの表に1回だけ移す（本物の D1）',{bd,ob});
ok(sql(`SELECT COUNT(*) AS c FROM notes`)[0].c===2&&sql(`SELECT banned FROM users WHERE uid='ban'`)[0].banned===1,'R1 前の行・手動の停止を書きかえない（本物の D1）','');
await Promise.all([1,2,3].map(()=>call('/api/tl')));
ok(sql(`SELECT COUNT(*) AS c FROM fb_ops WHERE uid IN ('m1','m2')`)[0].c===2,'R1 同時にもう一度動いても2回移さない（本物の D1）','');
/* 2. 合言葉 */
r=await call('/api/admin/sanctions');ok(r[0]===401||r[0]===403,'R2 運営者の合言葉なしは断る',r[0]);
r=await call('/api/fb/claim',{method:'POST',body:{}});ok(r[0]===404,'R2 アダプターの合言葉なしは見つからない（404）',r[0]);
/* 3. 合成の利用者と確認の記録・停止（同時に3つ → 1つだけ） */
const now=Date.now();
sql(`INSERT OR IGNORE INTO users(uid,handle,name,created_at,updated_at,agreed_at,banned) VALUES('sA','stga','合成A',${now},${now},${now},0)`);
sql(`INSERT INTO notes(uid,body,created_at,ip) VALUES('sA','合成の証拠の投稿',${now},'')`);
const nid=sql(`SELECT id FROM notes WHERE uid='sA' ORDER BY id DESC LIMIT 1`)[0].id;
const cs=await call('/api/admin/cases',{method:'POST',...ADM,body:{handle:'stga',kind:'attack',summary:'合成の利用者の合成の証拠を確かめた（ステージングのテスト）',refs:[{t:'note',id:nid}],evidence_kinds:['direct'],attest:true,reviewer:'staging'}});
ok(cs[0]===200&&cs[1].case_id>0,'R3 確認の記録を作る（本物の D1）',cs);
const sb={kind:'temporary',case_id:cs[1].case_id,rationale:'ステージングのテストのための一時的な停止です（合成）',confirm:'SANCTION',reviewer:'staging',months:3};
const ss=await Promise.all([1,2,3].map(()=>call('/api/admin/sanctions',{method:'POST',...ADM,body:sb})));
ok(ss.filter(x=>x[0]===200).length===1&&ss.filter(x=>x[0]===409).length===2,'R3 同じ確認の記録へ同時に3つ → 停止は1つ（本物の D1）',ss.map(x=>x[0]));
ok(sql(`SELECT COUNT(*) AS c FROM sanctions WHERE case_id=${cs[1].case_id} AND kind='uid'`)[0].c===1&&sql(`SELECT banned FROM users WHERE uid='sA'`)[0].banned===2,'R3 停止の行は1つ・表示も止める（本物の D1）','');
const sid=ss.find(x=>x[0]===200)[1].id;
/* 4. Firebase の同期の受け口（同時に2つ借りても同じ人は1つ・記録と同じ取引で操作の記録・報告で片づく） */
const [c1,c2]=await Promise.all([fbp('/api/fb/claim',{}),fbp('/api/fb/claim',{})]);
const its=[...(c1[1].items||[]),...(c2[1].items||[])].filter(x=>x.uid==='sA');
ok(c1[0]===200&&c2[0]===200&&its.length===1&&its[0].want==='disabled','R4 同時に2つ借りても同じ人は1つ（本物の D1）',{c1:c1[1],c2:c2[1]});
for(const x of [...(c1[1].items||[]),...(c2[1].items||[])].filter(x=>x.uid!=='sA'))await fbp('/api/fb/ack',{uid:x.uid,lease:x.lease,gen:x.gen,result:'superseded',want:'disabled'});
const x=its[0];
r=await fbp('/api/fb/intent',{uid:'sA',lease:x.lease,gen:x.gen,action:'disable',observed_disabled:false});
let o=sql(`SELECT kind,intent,resolved_at FROM fb_ops WHERE op='${x.lease}'`)[0];
ok(r[0]===200&&o&&o.kind==='pending'&&o.intent==='disable'&&o.resolved_at===null,'R4 外を変える前の記録と同じ取引で pending の操作（本物の D1）',{r,o});
r=await fbp('/api/fb/ack',{uid:'sA',lease:x.lease,gen:x.gen,result:'done',want:'disabled',observed_disabled:true,revoked:true});
const r2=await fbp('/api/fb/ack',{uid:'sA',lease:x.lease,gen:x.gen,result:'done',want:'disabled',observed_disabled:true,revoked:true});
o=sql(`SELECT how FROM fb_ops WHERE op='${x.lease}'`)[0];const fs=sql(`SELECT owned,prior,gen,done_gen FROM fb_sync WHERE uid='sA'`)[0];
ok(r[0]===200&&r2[0]===200&&r2[1].repeat===true&&o.how==='done'&&fs.owned===1&&fs.prior===0&&fs.done_gen===fs.gen,'R4 報告で片づく・同じ報告をもう一度でも1回分（本物の D1）',{r,r2,o,fs});
/* 5. 落ちた回（報告なし）：crash・そのアカウントは借りない */
await call(`/api/admin/sanctions/${sid}/reverse`,{method:'POST',...ADM,body:{reason:'ステージングのテストで取り消す',confirm:true}});
let c3=await fbp('/api/fb/claim',{});const y=(c3[1].items||[]).find(z=>z.uid==='sA');
for(const z of (c3[1].items||[]).filter(z=>z.uid!=='sA'))await fbp('/api/fb/ack',{uid:z.uid,lease:z.lease,gen:z.gen,result:'superseded',want:'disabled'});
r=await fbp('/api/fb/intent',{uid:'sA',lease:y.lease,gen:y.gen,action:'enable',observed_disabled:true});
ok(y&&y.want==='enabled'&&r[0]===200,'R5 取り消しのあと戻す記録（本物の D1）',{y,r});
sql(`UPDATE fb_sync SET lease_until=0 WHERE uid='sA'`);
c3=await fbp('/api/fb/claim',{});for(const z of (c3[1].items||[]).filter(z=>z.uid!=='sA'))await fbp('/api/fb/ack',{uid:z.uid,lease:z.lease,gen:z.gen,result:'superseded',want:'disabled'});
o=sql(`SELECT kind,resolved_at FROM fb_ops WHERE op='${y.lease}'`)[0];
ok(!(c3[1].items||[]).some(z=>z.uid==='sA')&&o.kind==='crash'&&o.resolved_at===null,'R5 報告がないまま借りる時間が切れた：crash・借りない（本物の D1）',{c3:c3[1],o});
/* 6. 取引の取り消し：読み直しの2つ目の文を本物の D1 のトリガーで失敗させる → 1つ目（操作の片づけ）も取り消される */
const g0=sql(`SELECT gen FROM fb_sync WHERE uid='sA'`)[0].gen;
sql(`CREATE TABLE IF NOT EXISTS stg_inj(x INTEGER)`);sql(`DELETE FROM stg_inj`);sql(`INSERT INTO stg_inj VALUES(1)`);
sql(`DROP TRIGGER IF EXISTS stg_fail`);sql(`CREATE TRIGGER stg_fail BEFORE UPDATE ON fb_sync WHEN (SELECT COUNT(*) FROM stg_inj)>0 BEGIN SELECT RAISE(ABORT,'injected'); END`);
r=await fbp('/api/fb/observe',{uid:'sA',op:y.lease,observed_disabled:false,settled:'ok'});
o=sql(`SELECT resolved_at,how FROM fb_ops WHERE op='${y.lease}'`)[0];
ok(r[0]>=500&&o.resolved_at===null&&o.how===null&&sql(`SELECT gen FROM fb_sync WHERE uid='sA'`)[0].gen===g0,'R6 取引の途中で失敗：操作の片づけも取り消され、番号も変わらない（本物の D1 の batch）',{r,o});
c3=await fbp('/api/fb/claim',{});ok(!(c3[1].items||[]).some(z=>z.uid==='sA'),'R6 そのあいだもアカウントは借りられない（本物の D1）',c3[1]);
for(const z of (c3[1].items||[]).filter(z=>z.uid!=='sA'))await fbp('/api/fb/ack',{uid:z.uid,lease:z.lease,gen:z.gen,result:'superseded',want:'disabled'});
sql(`DELETE FROM stg_inj`);
r=await fbp('/api/fb/observe',{uid:'sA',op:y.lease,observed_disabled:false,settled:'ok'});
o=sql(`SELECT resolved_at,how FROM fb_ops WHERE op='${y.lease}'`)[0];
ok(r[0]===200&&!r[1].recorded_only&&o.how==='observe'&&sql(`SELECT gen FROM fb_sync WHERE uid='sA'`)[0].gen===g0+1,'R6 やり直すと片づき、番号も同じ取引で進む（本物の D1）',{r,o});
r=await fbp('/api/fb/observe',{uid:'sA',op:y.lease,observed_disabled:false,settled:'ok'});
ok(r[1].recorded_only===true&&sql(`SELECT gen FROM fb_sync WHERE uid='sA'`)[0].gen===g0+1,'R6 同じ読み直しは1回分だけ（本物の D1）',r);
sql(`DROP TRIGGER IF EXISTS stg_fail`);sql(`DROP TABLE IF EXISTS stg_inj`);
/* 7. 上限の印：本物の D1 に印があると、リンクを押しても開かない（503） */
sql(`INSERT INTO notes(uid,body,created_at,ip) VALUES('sA','合成のリンクの投稿',${now+1},'')`);
const ln=sql(`SELECT id FROM notes WHERE uid='sA' ORDER BY id DESC LIMIT 1`)[0].id;
sql(`UPDATE users SET banned=0 WHERE uid='sA'`);
sql(`INSERT INTO note_links(note_id,uid,url,host,state,verdict,verdict_at,expires_at,created_at,updated_at,rev,vh,pol) VALUES(${ln},'sA','https://example.com/stg','example.com','ok','clean',${now},${now+36e5},${now},${now},0,'stg-vh','p0:OLD')`);
sql(`INSERT OR REPLACE INTO link_state(k,v,at,until) VALUES('wr_saturated','unsafe-cache-full',${now},${now+36e5})`);
r=await call(`/api/links/${ln}/open`,{method:'POST',body:{}});ok(r[0]===503&&r[1].saturated===true,'R7 上限の印があれば開かない（本物の D1）',r);
sql(`DELETE FROM link_state WHERE k='wr_saturated'`);
r=await call(`/api/links/${ln}/open`,{method:'POST',body:{}});ok(!r[1].saturated,'R7 印を外すと上限の答えではなくなる（前の方針の行は確かめ直しへ。鍵がないので開かない）',r);
/* 8. 管理画面の状態 */
r=await call('/api/admin/sanctions',{...ADM});ok(r[0]===200&&r[1].fb_sync&&Array.isArray(r[1].fb_sync.open_ops),'R8 管理画面の同期の状態（本物の D1）',r[0]);
console.log('staging-remote: d1 execute のやり直し '+sqlRetries+' 回');
console.log(bad?`staging-remote: NG（${bad}/${n}）`:`staging-remote: OK（${n}項目・Cloudflare の本物の D1 と Worker：${BASE.replace(/^https:\/\//,'')}）`);process.exit(bad?1:0);
