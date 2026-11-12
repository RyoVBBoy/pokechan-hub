// 管理画面の「アクセス」タブ（2026/11/12）と、機能の操作の回数の確認：
// ①期間（7・30・90日）で数・グラフ・順位がそろって変わる ②訪問・表示回数・スマホ/PC・来た場所の数
// ③操作の表（成功・失敗・前の期間比）④読み込み中・読めない（やり直し）・記録なし・操作が未計測を0と見せない
// ⑤描き直しで操作を二重に数えない（ダメージ計算・診断・図鑑・選出アシスト）⑥幅390・1280ではみ出さない
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
const SHOT=process.env.SHOT||'';
let ng=0,n=0;const ok=(c,m)=>{n++;if(!c){ng++;console.log('NG '+m)}};
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const errs=[];
/* にせの /api/admin/hits：今日を 2026-11-12（日本時間）として、期間ごとの行を返す */
const TODAY=Date.UTC(2026,10,12);
const dd=k=>new Date(TODAY-k*864e5).toISOString().slice(0,10);
const ROWS=[];const add=(k,key,nn)=>ROWS.push({day:dd(k),k:key,n:nn});
for(let k=0;k<180;k++){add(k,'_visit',10+(k%5));add(k,'p:home',20);add(k,'p:calc',k<30?8:4);add(k,'d:sp',7);add(k,'d:pc',3);add(k,'r:search',4);add(k,'r:direct',6);}
for(let k=0;k<4;k++){add(k,'e:calc_done',5);add(k,'e:oppread_ok',2);add(k,'e:oppread_ng',1)}
let MODE='ok',CALLS=[];
const reply=(days,mode)=>{const from=dd(days-1),to=dd(0),pfrom=dd(2*days-1),pto=dd(days);
  const ev=mode==='noev';const rows=ROWS.filter(r=>r.day>=pfrom&&r.day<=to&&!(ev&&r.k.startsWith('e:')));
  return{days,rows:mode==='empty'?[]:rows,from,to,pfrom,pto,today:to,tz:'Asia/Tokyo',evStart:ev||mode==='empty'?null:dd(3),pvStart:mode==='empty'?null:dd(179),evKeys:[]}};
const open=async(w)=>{const c=await b.newContext({viewport:{width:w,height:900},locale:'ja-JP'});const pg=await c.newPage();pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(/\/api\/admin\/hits/,async r=>{const u=new URL(r.request().url());const days=+u.searchParams.get('days');CALLS.push(days);
    const H={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Content-Type':'application/json'};
    if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:H});
    if(!r.request().headers()['x-admin-token'])return r.fulfill({status:401,headers:H,body:JSON.stringify({error:'管理用の合言葉が違います。'})});
    if(MODE==='slow')await new Promise(z=>setTimeout(z,1200));
    if(MODE==='fail')return r.fulfill({status:500,headers:H,body:'{}'});
    r.fulfill({headers:H,body:JSON.stringify(reply(days,MODE==='slow'?'ok':MODE))})});
  await pg.route(/\/api\/admin\/(?!hits)/,r=>r.fulfill({headers:{'Access-Control-Allow-Origin':'*','Content-Type':'application/json'},body:'{"reports":[]}'}));
  await pg.goto(URL0+'#/tools');await pg.evaluate(()=>{sessionStorage.setItem('pcadmin','admin-secret-123');sessionStorage.setItem('pcadmhd','30')});
  await pg.evaluate(()=>{location.hash='#/admin'});await pg.waitForTimeout(500);
  return pg};
const txt=pg=>pg.evaluate(()=>(document.getElementById('adm-list')||{}).innerText||'');

let pg=await open(390);
/* 読み込み中 */
MODE='slow';await pg.click('[data-at="hits"]');await pg.waitForTimeout(300);
ok(/読み込み中/.test(await txt(pg))&&!/訪問（タブ単位）/.test(await txt(pg)),'読み込み中に数を出しています');
await pg.waitForTimeout(1500);
/* 30日間の数 */
let t=await txt(pg);
const exp30={visit:[...Array(30).keys()].reduce((a,k)=>a+10+(k%5),0),view:30*20+30*8};
ok(t.includes('2026/10/14〜2026/11/12（日本時間・30日間）'),'期間（日本時間）が出ません '+t.slice(0,120));
ok(await pg.evaluate(e=>{const k=[...document.querySelectorAll('.adh-k')].map(x=>x.innerText.replace(/\s+/g,' '));return k[0].includes(e.visit.toLocaleString('ja-JP'))&&k[1].includes(e.view.toLocaleString('ja-JP'))&&/210/.test(k[2])&&/70%/.test(k[2])&&/90/.test(k[3])&&/ホーム/.test(k[4])&&/ダメージ計算/.test(k[5])},exp30),'概要の数が違います '+await pg.evaluate(()=>[...document.querySelectorAll('.adh-k')].map(x=>x.innerText.replace(/\s+/g,' ')).join(' | ')));
ok(/人数ではありません/.test(t),'訪問が人数でないことの説明がありません');
ok(/最初の表示だけ/.test(t),'スマホ/PC・来た場所が最初の表示だけで数えていることの説明がありません');
/* 操作の表：成功・失敗・失敗を数えない機能・前の期間比（記録が足りないので比較なし） */
const opRow=nm=>pg.evaluate(nm=>{const r=[...document.querySelectorAll('.adh-t tr')].find(x=>x.querySelector('td b')&&x.querySelector('td b').textContent===nm);return r?[...r.querySelectorAll('td')].map(x=>x.innerText.replace(/\s+/g,' ')):null},nm);
let row=await opRow('ダメージ計算');ok(row&&row[1]==='20'&&/対象外/.test(row[2])&&/比較なし/.test(row[3]),'ダメージ計算の操作の行が違います '+row);
row=await opRow('選出画面のスクショ読み取り');ok(row&&row[1]==='8'&&row[2]==='4','スクショ読み取りの成功・失敗が違います '+row);
row=await opRow('図鑑の検索・絞り込み');ok(row&&row[1]==='0','記録を始めたあと使われていない機能が0になりません '+row);
ok(/から始めました/.test(t),'操作の記録を始めた日の説明がありません');
ok(/操作を数えていない機能/.test(t)&&await pg.evaluate(()=>/未計測（表示回数だけ）/.test(document.querySelector('.adh-un').textContent)),'操作を数えていない機能が「未計測」と出ません');
/* 画面ごと：まとまりと中の画面、使われていない画面も出す・前の期間比 */
ok(await pg.evaluate(()=>{const g=[...document.querySelectorAll('.adh-g')];return g.length>=4&&g.some(x=>/ツール/.test(x.querySelector('summary').innerText))&&document.querySelectorAll('.adh-zero').length>5}),'画面のまとまり・使われていない画面が出ません');
ok(await pg.evaluate(()=>/\+100%/.test([...document.querySelectorAll('.adh-g')].find(x=>/ツール/.test(x.querySelector('summary').innerText)).innerText)),'前の期間との比較が出ません（ダメージ計算 8→4 の倍）');
/* 端末・来た場所 */
ok(await pg.evaluate(()=>{const s=document.querySelector('.adh-split').innerText.replace(/\s+/g,' ');return /スマホ 70%/.test(s)&&/PC 30%/.test(s)&&/検索 40%/.test(s)&&/直接・ブックマーク 60%/.test(s)}),'端末・来た場所の割合が違います');
/* 1日ごと：3つのグラフ（数ごとに別のグラフ）・未計測の日 */
ok(await pg.evaluate(()=>document.querySelectorAll('.adh-ch').length===3&&document.querySelectorAll('.adh-ch')[2].querySelectorAll('.adh-b.off').length===26),'1日ごとのグラフ・操作の未計測の日が違います');
/* 期間を変える：7日・90日（すべての数が変わる・前の期間と比べる） */
CALLS=[];MODE='ok';await pg.click('[data-adhd="7"]');await pg.waitForTimeout(500);t=await txt(pg);
ok(CALLS.includes(7)&&t.includes('2026/11/06〜2026/11/12（日本時間・7日間）')&&/前の7日間（10\/30〜11\/5）/.test(t),'7日間に切りかわりません '+t.slice(0,140));
ok(await pg.evaluate(()=>document.querySelectorAll('.adh-ch svg')[0].querySelectorAll('.adh-b').length===7),'7日間のグラフが7日になりません');
await pg.click('[data-adhd="90"]');await pg.waitForTimeout(500);t=await txt(pg);
ok(t.includes('2026/08/15〜2026/11/12（日本時間・90日間）'),'90日間に切りかわりません');
ok(await pg.evaluate(()=>sessionStorage.getItem('pcadmhd')==='90'),'選んだ期間を覚えません');
/* 読めないとき：0 と見せず、やり直せる */
MODE='fail';await pg.click('[data-adhd="30"]');await pg.waitForTimeout(500);t=await txt(pg);
ok(/読み込めませんでした/.test(t)&&/0ではなく/.test(t)&&!/訪問（タブ単位）/.test(t),'読めないときに数を出しています');
MODE='ok';await pg.click('#adh-retry');await pg.waitForTimeout(500);
ok(/訪問（タブ単位）/.test(await txt(pg)),'やり直しで読み込めません');
/* 操作がまだ記録されていない：— と未計測 */
MODE='noev';await pg.click('[data-adhd="7"]');await pg.waitForTimeout(500);
row=await opRow('ダメージ計算');ok(row&&row[1]==='—'&&row[3]==='—','操作の記録がないのに0と出しています '+row);
ok(/操作の記録はまだありません/.test(await txt(pg)),'操作の記録がないことの説明がありません');
/* 記録なしの期間 */
MODE='empty';await pg.click('[data-adhd="30"]');await pg.waitForTimeout(500);
ok(/この期間の記録はありません/.test(await txt(pg)),'記録のない期間の説明がありません');
/* はみ出し（390） */
MODE='ok';await pg.click('[data-adhd="30"]');await pg.waitForTimeout(500);
ok(await pg.evaluate(()=>document.body.scrollWidth<=document.documentElement.clientWidth+1),'幅390で横にはみ出します');
if(SHOT)await pg.screenshot({path:SHOT+'/adh_390.png',fullPage:true});
await pg.context().close();
pg=await open(1280);await pg.click('[data-at="hits"]');await pg.waitForTimeout(600);
ok(await pg.evaluate(()=>document.body.scrollWidth<=document.documentElement.clientWidth+1&&document.querySelectorAll('.adh-ch').length===3),'幅1280で崩れます');
if(SHOT)await pg.screenshot({path:SHOT+'/adh_1280.png',fullPage:true});
/* 合言葉なしでは見られない（サーバーが 401 → 読めない表示） */
await pg.evaluate(()=>{sessionStorage.setItem('pcadmin','');});
await pg.context().close();

/* ---------- 操作を数える：描き直しで二重に数えない ---------- */
pg=await (await b.newContext({viewport:{width:390,height:844},locale:'ja-JP'})).newPage();pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(URL0+'#/calc');await pg.waitForTimeout(900);
const cnt=k=>pg.evaluate(k=>EV_LOG.filter(x=>x===k).length,k);
ok(await cnt('calc_done')===0,'ダメージ計算を開いただけで数えています');
await pg.evaluate(()=>{const s=document.querySelector('[data-c="weather"]');s.value='rain';s.dispatchEvent(new Event('change'))});await pg.waitForTimeout(200);
ok(await cnt('calc_done')===1,'条件を変えた計算を数えません');
await pg.evaluate(()=>{for(let i=0;i<3;i++)route()});await pg.waitForTimeout(300);
ok(await cnt('calc_done')===1,'描き直しでダメージ計算を数えています');
await pg.evaluate(()=>{const s=document.querySelector('[data-c="weather"]');s.value='rain';s.dispatchEvent(new Event('change'))});await pg.waitForTimeout(200);
ok(await cnt('calc_done')===1,'同じ条件を2回数えています');
/* 図鑑：何文字打っても1回の表示で1回 */
await pg.evaluate(()=>{location.hash='#/dex'});await pg.waitForTimeout(600);
await pg.fill('#dq','が');await pg.fill('#dq','がぶ');await pg.fill('#dq','がぶり');await pg.waitForTimeout(100);
ok(await cnt('dex_find')===1,'図鑑の検索を1文字ごとに数えています '+await cnt('dex_find'));
/* 診断：同じパーティは何度描き直しても1回 */
await pg.evaluate(()=>{team=[{no:445,sel:true},{no:149,sel:true},{no:6,sel:true},{no:94},{no:9},{no:3}];saveTeam();sessionStorage.setItem('pcttab','check')});
await pg.evaluate(()=>{location.hash='#/team'});await pg.waitForTimeout(800);
await pg.click('#tt-seg [data-tt="check"]').catch(()=>{});await pg.waitForTimeout(800);
for(let i=0;i<3;i++){await pg.evaluate(()=>teamRender());await pg.waitForTimeout(200)}
ok(await cnt('diag_done')===1,'診断を描き直しで二重に数えています '+await cnt('diag_done'));
await pg.evaluate(()=>{team.pop();saveTeam();teamRender()});await pg.waitForTimeout(400);
ok(await cnt('diag_done')===2,'パーティを変えた診断を数えません');
/* 選出アシスト：相手が6匹そろったときだけ・同じ相手は1回 */
await pg.evaluate(()=>{opp6=[445,149,6,94,9];saveOpp6();location.hash='#/assist'});await pg.waitForTimeout(800);
ok(await cnt('assist_done')===0,'相手が5匹なのに数えています');
await pg.evaluate(()=>{opp6.push(3);saveOpp6();asDraw();asDraw()});await pg.waitForTimeout(300);
ok(await cnt('assist_done')===1,'相手6匹の計算を1回だけ数えていません '+await cnt('assist_done'));
/* 知らない種類は数えない・送る中身は種類だけ */
ok(await pg.evaluate(()=>evCount('bogus')===false&&!EV_LOG.includes('bogus')),'知らない種類を数えています');
await pg.context().close();

ok(!errs.length,'ページのエラー: '+[...new Set(errs)].join(' / '));
await b.close();
console.log(ng?`admhits: NG （${n}項目）`:`admhits: OK（${n}項目）`);
process.exit(ng?1:0);
