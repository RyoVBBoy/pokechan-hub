// 診断の再現性（2026/11/12 依頼主「同じパーティなのに総合評価が変わる」）の確認：
// 使用率の集計（championsbattledata）を、決まった中身のにせものに置きかえ（届く順番・失敗はテストで変える）、
// 同じパーティの診断（相手ごとの結果・攻撃/防御/素早さ/役割・弱点・選出の順位・改善案・構築の型）が、
// ①10回続けて ②ページの開き直し（端末の覚えあり・なし）③タブの切りかえ ④届く順番を変えても まったく同じか。
// ⑤読めないときは評価を出さない ⑥古い読み込みが新しい結果を上書きしない ⑦同点の並びが毎回同じ ⑧乱数が混ざらない（buildSet）
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
let ng=0,n=0;const ok=(c,m)=>{n++;if(!c){ng++;console.log('NG '+m)}};
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const errs=[];

/* ---- にせの集計を作る（ゲームのデータから決まった形で。乱数は使わない） ---- */
let FIX=null;
async function mkFix(){
  const p=await (await b.newContext()).newPage();await p.goto(URL0);await p.waitForTimeout(600);
  const f=await p.evaluate(()=>{
    const inv=o=>{const r={};for(const k in o){if(r[o[k]]==null)r[o[k]]=k}return r};
    const MVN=inv(MVK);
    const seeds=[445,727,812];
    const pool=P.filter(q=>ENSP[q.no]&&LSD[q.no]&&!q.base).sort((a,b)=>b.bst-a.bst||a.no-b.no);
    const list=[...seeds,...pool.map(q=>q.no).filter(x=>!seeds.includes(x))].slice(0,34);
    const out={};
    list.forEach((no,i)=>{const q=byNo[no];
      const mv=LSD[no][1].filter(id=>MV[id]&&MVN[id]).sort((a,b)=>(MV[b][2]||0)-(MV[a][2]||0)||a-b);
      /* 3匹に1匹は「特性の行なし・技2つだけ」（前は buildSet の乱数がここに出ていた） */
      const thin=i%3===2;
      const moves=(thin?mv.slice(0,2):mv.slice(0,6)).map((id,k)=>[MVN[id],60-k*7]);
      const abl=thin?[]:(ABD[no]||[]).slice(0,2).map((a,k)=>[a[0].replace(/-/g,''),k?20:80]);
      const tm=list.filter(x=>x!==no).slice((i*3)%20,(i*3)%20+8).map(x=>ENSP[x]);
      out[no]={fn:ENSP[no],rank:i+1,moves,items:[['lifeorb',35],['focussash',25],['sitrusberry',15]],abl,tm};
    });
    return out});
  await p.context().close();return f;
}
const csvOf=d=>{const L=['category,name,percentage,column_position,stat_up,stat_down,hp_points,attack_points,defense_points,sp_atk_points,sp_def_points,speed_points'];
  d.moves.forEach(([nm,pc])=>L.push(`move,${nm},${pc},${d.rank},,,,,,,,`));d.items.forEach(([nm,pc])=>L.push(`held_item,${nm},${pc},${d.rank},,,,,,,,`));
  d.abl.forEach(([nm,pc])=>L.push(`ability,${nm},${pc},${d.rank},,,,,,,,`));d.tm.forEach((nm,k)=>L.push(`teammate,${nm},${30-k},${d.rank},,,,,,,,`));
  L.push(`stat_alignment,,40,${d.rank},attack,sp.atk,,,,,,`);L.push(`stat_points,,40,${d.rank},,,2,32,0,0,0,32`);return L.join('\n')};
/* order：'fwd'＝図鑑番号の小さい順に早く届く／'rev'＝逆／'mix'＝ばらばら。fail：失敗させる番号 */
async function open({order='fwd',fail=[],keepLS=null,ctx=null}={}){
  const c=ctx||await b.newContext({viewport:{width:390,height:844},locale:'ja-JP'});
  const pg=await c.newPage();pg.on('pageerror',e=>errs.push(e.message));
  const nos=Object.keys(FIX).map(Number).sort((a,b)=>a-b);
  const delay=no=>{const i=nos.indexOf(no);return order==='fwd'?i*3:order==='rev'?(nos.length-i)*3:((i*37)%nos.length)*4};
  await pg.route(/championsbattledata\.com/,async r=>{const u=decodeURIComponent(r.request().url());
    const H={'Access-Control-Allow-Origin':'*','Content-Type':'text/plain'};
    if(/pokemon-index\.json/.test(u))return r.fulfill({headers:H,body:JSON.stringify({files:nos.map(no=>`battle_data/Doubles/${FIX[no].fn}.csv`)})});
    const m=u.match(/\/([^\/]+)\.csv$/);const no=nos.find(x=>FIX[x].fn===(m&&m[1]));
    if(no==null)return r.fulfill({status:404,headers:H,body:''});
    await new Promise(z=>setTimeout(z,delay(no)));
    if(fail.includes(no))return r.fulfill({status:500,headers:H,body:''});
    return r.fulfill({headers:H,body:csvOf(FIX[no])})});
  await pg.addInitScript(()=>{window.__DG_STRICT=true;try{sessionStorage.setItem('pcttab','check')}catch(e){}});
  await pg.goto(URL0+'#/tools');await pg.waitForTimeout(400);
  if(keepLS===false)await pg.evaluate(()=>{Object.keys(localStorage).filter(k=>/^pc(csv3|idx)/.test(k)).forEach(k=>localStorage.removeItem(k))});
  await pg.evaluate(TEAM=>{team=TEAM.map(x=>JSON.parse(JSON.stringify(x)));saveTeam()},TEAM);
  return pg;
}
/* 診断の中身（数・文・並び）をそろえて取り出す */
const snap=pg=>pg.evaluate(()=>{
  const T=dgTeam(team,20),A=dgAnalyze(T),S=dgSelect(team),C=partyCheck(team);
  return JSON.stringify({
    opps:T.rows.map(r=>[r.q.no,r.lvl,r.res.map(x=>[x.i,x.k,x.r,x.swIn]).join(';'),r.o.ab,r.o.item,r.o.moves.map(m=>m.id).join('.')]),
    areas:['攻撃','防御','素早さ','役割'].map(a=>[a,Math.max(0,...A.bad.filter(x=>x.area===a).map(x=>x.sev||0))]),
    bad:A.bad.map(x=>[x.area,x.sev,x.t]),good:(A.good||[]).map(x=>x.t),
    sel:S?S.list.map(x=>[x.c.join(','),Math.round(x.sc*1e6)]):null,lead:S&&S.best?S.best.leads||null:null,
    fix:C.fix.map(x=>x.t),arch:teamArch(team).map(x=>x.k)})});
const waitReady=async pg=>{for(let i=0;i<120;i++){const st=await pg.evaluate(()=>dgState(team));if(st==='ready')return st;if(st==='error')return st;await pg.waitForTimeout(150)}return 'timeout'};
const domTxt=pg=>pg.evaluate(()=>{const o=document.getElementById('tout');return o?o.innerText.replace(/\s+/g,' '):''});

FIX=await mkFix();
const FN=Object.keys(FIX).map(Number);
ok(FN.length>=30&&FN.includes(445),'にせの集計が作れません '+FN.length);
/* 決まったパーティ：3匹は育成あり、3匹は未登録（使用率の高い型で計算）。集計に特性がない匹も入れる */
const TEAM=[{no:445,sel:true,set:{ab:{n:'さめはだ',k:'rough-skin'},it:{n:'こだわりスカーフ',k:'choicescarf'},mv:[{n:'じしん',id:89},{n:'げきりん',id:200}],sp:[2,32,0,0,0,32],up:1,dn:3,src:'manual'}},
  {no:FN[2],sel:true},{no:FN[5],sel:true},{no:FN[8]},{no:FN[10],set:{ab:null,it:{n:'たべのこし',k:'leftovers'},mv:[],sp:[32,0,32,0,2,0],up:2,dn:5,src:'manual'}},{no:FN[11]}];

/* ---------- ①ページの準備：データがそろうまで評価を出さない ---------- */
let pg=await open({order:'mix',keepLS:false});
await pg.evaluate(()=>{location.hash='#/team'});await pg.waitForTimeout(80);
const early=await pg.evaluate(()=>({st:dgState(team),txt:(document.getElementById('tout')||{}).innerText||'',arch:(document.getElementById('tarch')||{}).innerText||''}));
ok(early.st==='loading'&&/読み込んでいます/.test(early.txt)&&!/診断のまとめ|総合評価/.test(early.txt),'データがそろう前に評価を出しています '+JSON.stringify(early).slice(0,200));
ok(/判定中/.test(early.arch),'データがそろう前に構築の型を決めています '+early.arch);
ok(await waitReady(pg)==='ready','データがそろいません');await pg.waitForTimeout(2500);
const base=await snap(pg),baseDom=await domTxt(pg);
ok(/攻撃|防御/.test(baseDom)&&!/読み込んでいます/.test(baseDom),'そろったあとに診断が出ません');

/* ---------- ②10回続けて計算（使い回しを消して計算し直す） ---------- */
const ten=await pg.evaluate(()=>{const r=[];for(let i=0;i<10;i++){DG_CACHE.k=null;DG_SELC.clear();IMP_CACHE.clear();
  const T=dgTeam(team,20),A=dgAnalyze(T),S=dgSelect(team);r.push(JSON.stringify([T.rows.map(x=>[x.q.no,x.lvl,x.res.map(y=>y.k+y.r).join()]),A.bad.map(x=>[x.area,x.sev,x.t]),S&&S.list.map(x=>x.c.join()+':'+x.sc)]))}
  return r});
ok(new Set(ten).size===1,'10回の計算で結果が変わります（'+new Set(ten).size+'通り）');
/* 乱数が混ざらない：集計に特性がない匹・技が少ない匹の使用率の高い型 */
const sets=await pg.evaluate(nos=>nos.map(no=>{const r=new Set();for(let i=0;i<10;i++){const s=detSet(byNo[no]);r.add(JSON.stringify([s.ab,s.item,s.moves.map(m=>m.id)]))}return r.size}),[FN[2],FN[5],FN[8]]);
ok(sets.every(x=>x===1),'使用率の高い型に乱数が混ざっています '+sets);
ok((await snap(pg))===base,'計算し直すと前と違います');

/* ---------- ③タブの切りかえ ---------- */
for(const t of ['plan','sets','check','plan','check']){await pg.click(`#tt-seg [data-tt="${t}"]`);await pg.waitForTimeout(300)}
await pg.waitForTimeout(2200);
ok((await snap(pg))===base,'タブを切りかえると結果が変わります');
ok((await domTxt(pg))===baseDom,'タブを切りかえると、チェックの表示が変わります');
/* 構築 › 選出アシスト の切りかえでパーティ・選出は変わらない */
const before=await pg.evaluate(()=>JSON.stringify(team));
await pg.click('#tt-seg [data-tt="plan"]');await pg.waitForTimeout(300);
const y0=await pg.evaluate(()=>scrY());
await pg.click('[data-psub="sel"]');await pg.waitForTimeout(150);
const ps=await pg.evaluate(()=>({sel:!document.querySelector('[data-psub-p="sel"]').hidden,build:document.querySelector('[data-psub-p="build"]').hidden,box:!!document.querySelector('[data-psub-p="sel"] #sel-box'),y:scrY(),ext:!!document.querySelector('[data-psub-p="sel"] a[href="#/assist"]')}));
ok(ps.sel&&ps.build&&ps.box&&ps.ext,'選出アシストに切りかわりません '+JSON.stringify(ps));
ok(Math.abs(ps.y-y0)<2,'小さなタブの切りかえで画面が動きます');
await pg.click('[data-psub="build"]');await pg.waitForTimeout(150);
ok(await pg.evaluate(()=>!document.querySelector('[data-psub-p="build"]').hidden&&/構築の診断/.test(document.querySelector('[data-psub-p="build"]').innerText)),'構築に戻りません');
ok((await pg.evaluate(()=>JSON.stringify(team)))===before,'タブの切りかえでパーティが変わりました');
await pg.context().close();

/* ---------- ④開き直し：届く順番を変える・端末の覚えあり／なし ---------- */
for(const [order,keepLS] of [['rev',false],['fwd',false],['mix',false]]){
  pg=await open({order,keepLS});await pg.evaluate(()=>{location.hash='#/team'});
  ok(await waitReady(pg)==='ready',`開き直し（${order}）でデータがそろいません`);await pg.waitForTimeout(2500);
  ok((await snap(pg))===base,`開き直し（届く順番 ${order}）で結果が変わります`);
  ok((await domTxt(pg))===baseDom,`開き直し（届く順番 ${order}）でチェックの表示が変わります`);
  /* 同じタブで読み直す（端末に覚えた集計を使う） */
  await pg.reload();await pg.evaluate(TEAM=>{team=TEAM.map(x=>JSON.parse(JSON.stringify(x)));saveTeam();location.hash='#/team'},TEAM);
  ok(await waitReady(pg)==='ready','読み直しでデータがそろいません');await pg.waitForTimeout(2500);
  ok((await snap(pg))===base,`読み直し（端末の覚えあり・${order}）で結果が変わります`);
  await pg.context().close();
}
/* パーティを切りかえてから開いても、相手の候補は同じ（前は開いたときのパーティで上位の並びが変わっていた） */
pg=await open({order:'fwd',keepLS:false});
await pg.evaluate(()=>{switchTeam(1);team=[{no:94,sel:true},{no:149,sel:true},{no:6,sel:true}];saveTeam()});
await pg.evaluate(()=>metaLoad());const rk1=await pg.evaluate(()=>META.rank.map(x=>x.no).join());
await pg.evaluate(()=>{switchTeam(0)});await pg.evaluate(()=>{location.hash='#/team'});await waitReady(pg);await pg.waitForTimeout(2500);
ok((await snap(pg))===base,'別のパーティを開いてから読むと結果が変わります');
await pg.context().close();
pg=await open({order:'rev',keepLS:false});await pg.evaluate(()=>metaLoad());
ok((await pg.evaluate(()=>META.rank.map(x=>x.no).join()))===rk1,'使用率の上位の並びが、開いたときのパーティで変わります');
await pg.context().close();

/* ---------- ⑤読めないとき：評価を出さない／自分で選んだときだけ、読めたデータだけで ---------- */
const failNo=FN[6];
pg=await open({order:'fwd',keepLS:false,fail:[failNo]});await pg.evaluate(()=>{location.hash='#/team'});
ok(await waitReady(pg)==='error','読めない集計があるのに、エラーになりません');await pg.waitForTimeout(300);
let t=await domTxt(pg);
ok(/読み込めませんでした/.test(t)&&!/診断のまとめ|相手ごとの対応力/.test(t),'読めないのに評価を出しています '+t.slice(0,160));
ok(await pg.evaluate(()=>/判定中/.test(document.getElementById('tarch').innerText)),'読めないのに構築の型を決めています');
await pg.click('[data-dg-allow]');await pg.waitForTimeout(2500);
t=await domTxt(pg);
ok(/読めたデータだけ/.test(t)&&/相手ごとの対応力/.test(t),'「読めたデータだけで診断する」を押しても、注意つきで診断が出ません');
/* もう一度読み込む（今度は読める）→ ふつうの結果と同じ */
await pg.unroute(/championsbattledata\.com/);
await pg.route(/championsbattledata\.com/,async r=>{const u=decodeURIComponent(r.request().url());const H={'Access-Control-Allow-Origin':'*'};
  const m=u.match(/\/([^\/]+)\.csv$/);const no=FN.find(x=>FIX[x].fn===(m&&m[1]));return no==null?r.fulfill({status:404,headers:H,body:''}):r.fulfill({headers:H,body:csvOf(FIX[no])})});
await pg.click('[data-dg-retry]');
ok(await waitReady(pg)==='ready','もう一度読み込んでもそろいません');await pg.waitForTimeout(2500);
ok((await snap(pg))===base,'読み直したあとの結果が、ふつうに読めたときと違います');
await pg.context().close();
/* 集計の場所に全くつながらない：評価を出さず、自分で選んだときだけ「集計なし」 */
{const c=await b.newContext({viewport:{width:390,height:844},locale:'ja-JP'});const p2=await c.newPage();p2.on('pageerror',e=>errs.push(e.message));
  await p2.route(/championsbattledata\.com/,r=>r.abort());await p2.addInitScript(()=>{window.__DG_STRICT=true;try{sessionStorage.setItem('pcttab','check')}catch(e){}});
  await p2.goto(URL0+'#/tools');await p2.evaluate(TEAM=>{team=TEAM;saveTeam();location.hash='#/team'},TEAM);
  ok(await waitReady(p2)==='error','集計につながらないのにエラーになりません');await p2.waitForTimeout(300);
  ok(await p2.evaluate(()=>/集計なしで診断する/.test(document.getElementById('tout').innerText)&&!/相手ごとの対応力/.test(document.getElementById('tout').innerText)),'集計につながらないのに評価を出しています');
  await p2.click('[data-dg-allow="off"]');await p2.waitForTimeout(2500);
  const o1=await p2.evaluate(()=>document.getElementById('tout').innerText);
  ok(/集計なし/.test(o1)&&/相手ごとの対応力/.test(o1),'「集計なしで診断する」で注意つきの診断が出ません');
  const s1=await snap(p2);await p2.evaluate(()=>{DG_CACHE.k=null;DG_SELC.clear()});
  ok((await snap(p2))===s1,'集計なしの計算が毎回同じになりません');
  await c.close()}

/* ---------- ⑥古い読み込みが新しい結果を上書きしない ---------- */
pg=await open({order:'rev',keepLS:false});
const calls=await pg.evaluate(async()=>{const got=[];const A=team.slice(0,3),B=team.slice(0,6);
  const p1=dgPrepare(A,()=>got.push('A'));const p2=dgPrepare(B,()=>got.push('B'));await p1;await p2;
  for(let i=0;i<80&&!got.length;i++)await new Promise(r=>setTimeout(r,100));
  return got});
ok(calls.length===1&&calls[0]==='B','古い読み込みの知らせで描き直しています '+JSON.stringify(calls));
/* 読み込み中にパーティを変えた：描き直したときは新しいパーティの結果 */
await pg.evaluate(()=>{location.hash='#/team'});await pg.waitForTimeout(60);
await pg.evaluate(()=>{team.pop();saveTeam();teamRender()});
await waitReady(pg);await pg.waitForTimeout(2500);
ok(await pg.evaluate(()=>{const T=dgTeam(team,20);return T.ms.length===team.length}),'読み込み中にパーティを変えると古いパーティで計算しています');
await pg.context().close();

/* ---------- ⑦同点の並び：選出の並び・相手の並びが毎回同じ（同点を含む） ---------- */
pg=await open({order:'fwd'});await pg.evaluate(()=>{location.hash='#/team'});await waitReady(pg);
const ties=await pg.evaluate(()=>{const r=new Set();let tie=0;for(let i=0;i<10;i++){DG_SELC.clear();DG_CACHE.k=null;const S=dgSelect(team);
  r.add(S.list.map(x=>x.c.join()).join('|'));for(let k=1;k<S.list.length;k++)if(Math.abs(S.list[k].sc-S.list[k-1].sc)<1e-3)tie++}return{n:r.size,tie}});
ok(ties.n===1,'選出の並びが毎回同じになりません '+JSON.stringify(ties));
await pg.context().close();

ok(!errs.length,'ページのエラー: '+[...new Set(errs)].join(' / '));
await b.close();
console.log(ng?`dgdet: NG （${n}項目）`:`dgdet: OK（${n}項目）`);
process.exit(ng?1:0);
