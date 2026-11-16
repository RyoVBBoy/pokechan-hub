// 型の出どころ（82-prov.js）の互換性と記録の正しさの点検（2026/11/16 依頼主「保存の前の点検」）
// A. サーバー：出どころつきの型を保存・読み直しても形が変わらない。写した型（src:'copy'）は出どころがあってもサイトの集計に数えない
// B. 出どころの無い、前の形のパーティ（3枠）：読める・中身が変わらない・勝手に書きかえない・育成の画面で開いても変わらない・
//    1か所変えても他は変わらない・読み直し・くり返しても減らない。PROV_BASE（前の版の dist）を渡すと、同じ操作を前の版でも行い、
//    出どころの欄（prov）を除いて結果が同じかを比べる
// C. 記録の正しさ：入れるだけでは「あなたの育成」にならない・変えたら1つ前の出どころを残す（重ねない）・取り込み・割合を保存しない・
//    同期でサーバーに送る中身・別の端末で読み直したとき・3万文字の上限
import {chromium} from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import {makeD1} from './d1mock.mjs';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
const BASE=process.env.PROV_BASE?'file://'+path.join(process.env.PROV_BASE,'index.html'):null;
let n=0;const ok=(c,m,x)=>{n++;if(!c){console.error('NG',m,x===undefined?'':JSON.stringify(x).slice(0,600));process.exitCode=1}};
const noProv=v=>JSON.parse(JSON.stringify(v,(k,x)=>k==='prov'?undefined:x));
/* 保存がブラウザに書き終わるのを待つ（2026/11/16）：
   localStorage.setItem はそのページの中ではすぐ読めるが、ブラウザ全体の保存（読み直したページが読む所）へは少し遅れて届く。
   同じページで読み直しても「書けた」ことにはならないので、アプリの入っていない別のページ（同じ file:// の静的ページ）から読み、
   編集したページが保存した中身とぴったり同じになるまで待つ（最大10秒）。届いたかどうかを返す（失敗にできるように） */
const OBS_URL='file://'+path.join(ROOT,'dist/ranking/index.html');
if(!fs.existsSync(path.join(ROOT,'dist/ranking/index.html'))){console.error('NG 見張り用の静的ページ dist/ranking/index.html がありません（tools/gen-pages.cjs を先に動かす）');process.exit(1)}
async function persisted(pg,obs){
  const want=await pg.evaluate(()=>localStorage.getItem('pcteams'));
  for(let t=0;t<400;t++){if(await obs.evaluate(()=>localStorage.getItem('pcteams'))===want)return true;await obs.waitForTimeout(25)}
  return false;
}
/* テスト用のパーティは、ページを開く前に1回だけ、見張り用の静的ページから入れる（2026/11/16）。
   前は「ページを開くたびに動く準備（addInitScript）」で、タブごとの印（sessionStorage）が無ければ入れ直していたが、file:// のページでは
   読み直したときにその印が消えていることがあり（30回中3回）、変えた中身をテスト用のパーティで上書きしていた＝テストの準備の問題 */
async function seedObs(ctx,L){const obs=await ctx.newPage();await obs.goto(OBS_URL);
  await obs.evaluate(L=>{localStorage.setItem('pcstart','1');if(L!=null)localStorage.setItem('pcteams',L)},L);return obs}
/* アプリを読み終えるまで待つ（決まった時間ではなく、ページの読み込みが終わり、パーティ（TEAMS）が読めるまで） */
const appReady=pg=>pg.waitForFunction(()=>document.readyState==='complete'&&typeof TEAMS==='object'&&!!document.querySelector('#view'),null,{timeout:20000});
/* 画面を移る：育成の画面なら、その匹の性格の表が出るまで待つ */
async function goTo(pg,h){await pg.evaluate(h=>{location.hash=h},h);
  const m=h.match(/^#\/edit\/(\d+)$/);
  if(m)await pg.waitForFunction(i=>typeof ED!=='undefined'&&ED&&ED.idx===i&&!!document.querySelector('#ed-nat [data-nat]'),+m[1],{timeout:20000});
  else await pg.waitForTimeout(500)}
/* 性格を1つ変える：押したあと、その匹の型が実際に変わって保存されるまで待つ（変わらなければ失敗にする） */
async function natChange(pg){
  const before=await pg.evaluate(()=>JSON.stringify(team[ED.idx]&&team[ED.idx].set||null));
  await pg.evaluate(()=>{const c=[...document.querySelectorAll('#ed-nat [data-nat]')].find(e=>e.getAttribute('aria-pressed')!=='true');c.click()});
  await pg.waitForFunction(b=>JSON.stringify(team[ED.idx]&&team[ED.idx].set||null)!==b&&localStorage.getItem('pcteams')===JSON.stringify(TEAMS),before,{timeout:10000})}
/* 2つの中身の違う所（どの欄が・何から何へ）。失敗したときに出す */
const diff=(a,c,p='')=>{if(JSON.stringify(a)===JSON.stringify(c))return[];if(typeof a!=='object'||typeof c!=='object'||!a||!c)return[[p,JSON.stringify(a)?.slice(0,140),JSON.stringify(c)?.slice(0,140)]];
  return [...new Set([...Object.keys(a),...Object.keys(c)])].flatMap(k=>diff(a[k],c[k],p+'.'+k))};

/* ================= A. サーバー ================= */
{const PID='pokechan-test',enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  const kp=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const jwk={...(await crypto.subtle.exportKey('jwk',kp.publicKey)),kid:'k1',use:'sig',alg:'RS256'},now=Math.floor(Date.now()/1000);
  const tok=async uid=>{const h=enc({alg:'RS256',kid:'k1',typ:'JWT'}),p=enc({iss:'https://securetoken.google.com/'+PID,aud:PID,sub:uid,iat:now-10,exp:now+3600,auth_time:now-10,email:uid+'@example.com'});
    return h+'.'+p+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',kp.privateKey,new TextEncoder().encode(h+'.'+p))).toString('base64url')};
  globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
  globalThis.fetch=async u=>{u=String(u);if(u.includes('securetoken@system.gserviceaccount.com'))return new Response(JSON.stringify({keys:[jwk]}));return new Response('',{status:404})};
  const w=(await import(path.join(ROOT,'worker/dist/worker.js'))).default,env={DB:makeD1(),FIREBASE_PROJECT_ID:PID,APP_TOKEN:'t',ADMIN_TOKEN:'admin-secret-123'};
  let ip=0;const call=async(p,{method='GET',tok:t,body}={})=>{const h={'content-type':'application/json','cf-connecting-ip':'10.1.0.'+(++ip%250)};if(t)h.authorization='Bearer '+t;
    const r=await w.fetch(new Request('https://x.dev'+p,{method,headers:h,body:body?JSON.stringify(body):undefined}),env,{waitUntil(){}});return[r.status,await r.json().catch(()=>({}))]};
  const PV={v:1,s:'pokekit',c:'external',m:'aggregated',g:'showdown',f:'single',per:'2026-10（月の集計）',n:87848,lb:'Champions BSS reg.MC'};
  const PU={v:1,s:'user',c:'user',m:'original',g:'site',from:{v:1,s:'season',c:'observed',m:'original',g:'champions',f:'single',vs:'article',id:'season-team:9'}};
  const tm=(no,src,prov,it)=>({cur:0,list:[{name:'x',team:[{no,sel:true,set:{it:{k:it,n:'x'},ab:{k:'roughskin'},mv:[{id:89},{id:200}],sp:[2,32,0,0,0,32],up:1,dn:3,src,prov}}]}]});
  for(const u of ['pa','pb','pc']){
    const t=await tok(u);await call('/api/me',{method:'POST',tok:t,body:{handle:u+'xx',name:u,agree:true}});
    let r=await call('/api/me/teams',{method:'POST',tok:t,body:{teams:tm(445,'manual',PU,'choicescarf'),updated_at:Date.now()}});ok(r[0]===200,'サーバー：出どころつきの型を保存できる',r);
    r=await call('/api/me/teams',{tok:t});ok(JSON.stringify(r[1].teams.list[0].team)===JSON.stringify(tm(445,'manual',PU,'choicescarf').list[0].team),'サーバー：読み直しても出どころ・型が同じ',r[1].teams);
    const t2=await tok(u+'c');await call('/api/me',{method:'POST',tok:t2,body:{handle:u+'cc',name:u,agree:true}});
    r=await call('/api/me/teams',{method:'POST',tok:t2,body:{teams:tm(6,'copy',PV,'lifeorb'),updated_at:Date.now()}});ok(r[0]===200,'サーバー：写した型（出どころつき）を保存できる',r)}
  const r=await call('/api/usage?fmt=single');
  ok(r[0]===200&&r[1].builds&&r[1].builds[445]&&r[1].builds[445].it[0][0]==='choicescarf','サイトの集計：自分で入れた型（出どころつき）は数える',r[1].builds);
  ok(r[1].builds&&!r[1].builds[6],'サイトの集計：写した型（src:copy）は出どころがあっても数えない',r[1].builds)}

/* ================= B・C. ブラウザ ================= */
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
/* 前の形のパーティ（出どころの欄が無い）を、ゲームのデータから決まった形で作る（保存の形は 10-editor.js・18-import.js・41-seasons.js の useTeam と同じ） */
let FIX;{const pg=await (await b.newContext({locale:'ja-JP'})).newPage();await pg.goto(URL0+'#/tools');await pg.waitForTimeout(700);
  FIX=await pg.evaluate(()=>{
    const ab=no=>{const a=(ABD[no]||[])[0];return a?{n:ABN[a[0]]||a[0],k:a[0]}:null};
    const it=k=>({n:ITEMN[k]||k,k});
    const mv=no=>(LSD[no]?LSD[no][1]:[]).filter(id=>MV[id]&&MV[id][2]>0).slice(0,4).map(id=>({n:mName(id),id}));
    const stone=Object.keys(MEGA).find(k=>MEGA[k][445]);
    const reg=P.find(q=>!q.base&&/アローラ|ガラル|ヒスイ|パルデア/.test(formInfo(q).tag||'')&&LSD[q.no]);
    const S=(no,o)=>({ab:ab(no),it:null,mv:mv(no),sp:[2,32,0,0,0,32],up:1,dn:3,...o});
    const slot0=[{no:445,sel:true,axis:true,set:S(445,{it:it(stone),src:'manual'})},
      {no:149,sel:true,set:S(149,{it:it('lifeorb'),sp:[32,0,2,0,32,0],up:2,dn:3,src:'manual'})},
      {no:887,sel:true,set:S(887,{it:it('choicescarf'),src:'copy'})},
      {no:reg.no,set:S(reg.no,{it:it('focussash'),src:'import',vals:[183,152,100,110,95,152]})},
      {no:6,set:{ab:ab(6),it:it('charcoal'),mv:mv(6).slice(0,2),sp:null,up:-1,dn:-1,src:'copy'}},
      {no:1000}];
    const slot1=[{no:983,sel:true,set:S(983,{it:it('leftovers'),src:'copy'})},{no:3,sel:true,set:S(3,{src:'copy'})},{no:130,sel:true},{no:547,set:S(547,{it:it('focussash'),src:'manual'})}];
    return{cur:0,list:[{name:'旧パーティ',team:slot0,at:1794000000000},{name:'',team:slot1,at:1793900000000},{name:'',team:[],at:0}],reg:reg.no,stone}});
  await pg.context().close()}
ok(FIX.list[0].team.length===6&&!JSON.stringify(FIX).includes('"prov"'),'前の形のパーティを作れた（出どころの欄なし）');
const LEG=JSON.stringify({cur:FIX.cur,list:FIX.list});

/* 同じ操作を行い、各段階の中身を返す（前の版・いまの版のどちらでも動く操作だけ） */
async function scenario(url){
  const ctx=await b.newContext({viewport:{width:390,height:844},locale:'ja-JP'});
  const obs=await seedObs(ctx,LEG);
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));await pg.route(/championsbattledata|workers\.dev|googleapis/,r=>r.abort());
  const snap=()=>pg.evaluate(()=>({list:JSON.parse(JSON.stringify(TEAMS.list.map(s=>({name:s.name,team:s.team})))),cur:TEAMS.cur,team:JSON.parse(JSON.stringify(team)),ls:localStorage.getItem('pcteams')}));
  const go=h=>goTo(pg,h),nat=()=>natChange(pg);
  /* 読み直す前に：①アプリがいまの中身（TEAMS）を保存に書いたか（同じページで読む）②それがブラウザ全体の保存に届いたか（別のページで読む、persisted）。
     （前は②を決まった時間待つだけだった。file:// のページで保存の直後に読み直すと、届く前に読み直して前の中身が読まれることがあった＝テストの手順の問題） */
  const settle=async()=>{const ok1=await pg.evaluate(()=>localStorage.getItem('pcteams')===JSON.stringify(TEAMS));(R.pre=R.pre||[]).push(ok1);(R.obs=R.obs||[]).push(await persisted(pg,obs))};
  const R={};
  await pg.goto(url+'#/team');await appReady(pg);R.load=await snap();
  for(let i=0;i<6;i++)await go('#/edit/'+i);await go('#/team');
  await pg.evaluate(()=>switchTeam(1));await pg.waitForTimeout(300);await pg.evaluate(()=>switchTeam(0));await pg.waitForTimeout(300);
  R.visit=await snap();
  await go('#/edit/2');await nat();R.editCopy=await snap();
  await go('#/edit/3');await nat();R.editImport=await snap();
  await go('#/edit/4');await nat();R.editNoSp=await snap();
  await settle();await pg.reload();await appReady(pg);R.reload=await snap();
  for(let k=0;k<3;k++){await go('#/edit/0');await nat();await settle();await pg.reload();await appReady(pg)}
  R.cycles=await snap();
  R.errs=errs;await ctx.close();return R;
}
const C=await scenario(URL0);
ok(C.pre&&C.pre.length===4&&C.pre.every(Boolean),'B：読み直す前の時点で、変えた中身はもう端末の保存に書かれている（アプリは保存できている）',C.pre);
ok(C.obs&&C.obs.length===4&&C.obs.every(Boolean),'B：読み直す前に、保存がブラウザ全体に届いた（別のページから同じ中身が読める）のを確かめてから読み直している',C.obs);
const L0=JSON.parse(LEG).list;
/* B-1 読める・中身が同じ・勝手に書きかえない */
ok(JSON.stringify(C.load.list.map(s=>s.team))===JSON.stringify(L0.map(s=>s.team)),'B：前の形のパーティを、3枠とも中身そのままで読める（姿・技・持ち物・特性・性格・能力ポイント・取り込みの実数値・軸・選出）',C.load.list[0].team[0]);
ok(C.load.ls===LEG,'B：読んだだけでは保存の中身を書きかえない（移しかえをしない）');
ok(!C.load.ls.includes('"prov"')&&!C.visit.ls.includes('"prov"'),'B：読む・育成の画面を開く・枠を切りかえるだけでは出どころを付けない');
/* 2026/11/16 に直した：前は能力ポイントの無い型（sp:null）を育成の画面で開くと、技の並びに空き（null）が足されて保存され、
   変更時刻（at・updated）も進んでいた（10-editor.js の editView が保存の配列をそのまま使っていたため）。いまは1文字も変わらない */
ok(C.visit.ls===LEG,'B：育成の画面を6匹とも開いて閉じ、枠を切りかえても、保存の中身は1文字も変わらない',diff(JSON.parse(LEG),JSON.parse(C.visit.ls)));
/* B-2 出どころは不明（推し量らない） */
{const pg=await (await b.newContext({locale:'ja-JP'})).newPage();await pg.goto(URL0+'#/tools');await pg.waitForTimeout(600);
  const pv=await pg.evaluate(L=>JSON.parse(L).list[0].team.map(x=>x.set?provOf(x.set):'noset'),LEG);
  ok(pv[0]===null&&pv[1]===null&&pv[2]===null&&pv[3].s==='import'&&pv[4]===null&&pv[5]==='noset','B：前の形の型の出どころ：取り込み（src:import）だけ分かる。manual（育成の画面と改善案の両方が書く）・copy は不明（分類を作らない）',pv);
  await pg.context().close()}
/* B-3 1か所変えても、ほかは変わらない */
const t0=L0[0].team,ec=C.editCopy.list[0].team;
const tv=C.visit.list[0].team;
ok(JSON.stringify(ec.filter((x,i)=>i!==2))===JSON.stringify(tv.filter((x,i)=>i!==2))&&JSON.stringify(C.editCopy.list.slice(1))===JSON.stringify(C.load.list.slice(1)),'B：1匹の性格を変えても、ほかの匹・ほかの枠は1文字も変わらない（開いた直後の中身と比べる）',diff(C.visit.list,C.editCopy.list).filter(d=>!d[0].startsWith('.0.team.2')));
{const a=ec[2].set,o=t0[2].set;
  ok(JSON.stringify([a.ab,a.it,a.mv,a.sp])===JSON.stringify([o.ab,o.it,o.mv,o.sp])&&(a.up!==o.up||a.dn!==o.dn)&&a.src==='manual','B：変えた匹も、特性・持ち物・技・能力ポイントはそのまま（性格だけ変わる・src は manual＝前と同じ）',[a,o]);
  ok(a.prov&&a.prov.s==='user'&&a.prov.c==='user'&&!a.prov.from,'B：出どころ不明の写した型を変えると「あなたの育成」。元の出どころは作らない（from なし）',a.prov)}
{const a=C.editImport.list[0].team[3].set,o=t0[3].set;
  ok(JSON.stringify([a.ab,a.it,a.mv,a.sp])===JSON.stringify([o.ab,o.it,o.mv,o.sp])&&a.prov&&a.prov.s==='user'&&a.prov.from&&a.prov.from.s==='import'&&!a.prov.from.from,'B：取り込んだ型を変えると「あなたの育成」、最初の出どころ（取り込み）を from に',a);
  /* 前からある動き（前の版でも同じ。出どころとは関係なし。この作業では直さない）：取り込みの実数値（vals）は、育成を変えて保存すると消える */
  ok(Array.isArray(o.vals)&&!('vals' in a),'B：（記録）前からある動き：取り込みの実数値は、育成を変えて保存すると消える＝前の版と同じ',[o.vals,a.vals])}
{const a=C.editNoSp.list[0].team[4].set,o=t0[4].set;
  ok(a&&JSON.stringify([a.ab,a.it])===JSON.stringify([o.ab,o.it])&&JSON.stringify(a.mv.slice(0,o.mv.length))===JSON.stringify(o.mv)&&Array.isArray(a.sp),'B：能力ポイントの無い型も開いて変えられる（特性・持ち物・技は残る）',a)}
/* B-4 読み直し・くり返し */
ok(JSON.stringify(C.reload.list)===JSON.stringify(C.editNoSp.list),'B：読み直しても、変えた所・変えていない所が同じ',diff(C.editNoSp.list,C.reload.list));
{const a=C.cycles.list[0].team[0].set,o=t0[0].set;
  ok(JSON.stringify([a.ab,a.it,a.mv,a.sp])===JSON.stringify([o.ab,o.it,o.mv,o.sp])&&a.src==='manual','B：開く→変える→保存→読み直しを3回くり返しても、技・持ち物・特性・能力ポイントが減らない',a);
  ok(a.prov&&a.prov.s==='user'&&!a.prov.from,'B：手で入れた型をくり返し変えても、出どころは「あなたの育成」のまま（重ならない）',a.prov);
  ok(JSON.stringify(C.cycles.list.slice(1))===JSON.stringify(C.load.list.slice(1))&&JSON.stringify(C.cycles.list[0].team.slice(1))===JSON.stringify(C.reload.list[0].team.slice(1)),'B：くり返しても、ほかの匹・ほかの枠は変わらない')}
ok(!C.errs.length,'B：エラーなし',C.errs);
/* B-5 前の版との比べ：同じ操作で、出どころの欄を除いて結果が同じ */
if(BASE){const O=await scenario(BASE);
  for(const k of ['load','visit','editCopy','editImport','editNoSp','reload','cycles'])
    ok(JSON.stringify(noProv(C[k].list))===JSON.stringify(O[k].list),'B（前の版と比べる）：'+k+' の結果は、出どころの欄を除いて前の版と同じ',{now:noProv(C[k].list)[0].team.map(x=>x.set),base:O[k].list[0].team.map(x=>x.set)});
  ok(!O.errs.length,'B（前の版）：エラーなし',O.errs);
  console.log('provcompat: 前の版（'+process.env.PROV_BASE+'）と比べた')}
else console.log('provcompat: 前の版との比べは行っていない（PROV_BASE なし）');

/* ================= C. 記録の正しさ ================= */
{const ctx=await b.newContext({viewport:{width:390,height:844},locale:'ja-JP'});
  const obs=await seedObs(ctx,LEG);
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));await pg.route(/championsbattledata|workers\.dev|googleapis/,r=>r.abort());
  await pg.goto(URL0+'#/team');await appReady(pg);
  const go=h=>goTo(pg,h),nat=()=>natChange(pg);
  /* 上位パーティを空いている枠（3枠目）に入れる */
  await pg.evaluate(async()=>{const t={auto:true,id:31};await useTeam('上位',[{no:445,set:{ab:{k:'rough-skin'},it:{k:'focussash'},mv:[{id:89},{id:200}],sp:[2,32,0,0,0,32],up:1,dn:3},prov:mkProv({s:'season',f:'single',vs:provSeasonVs(t),id:'season-team:31',lb:'S1'})},
    {no:149,set:{ab:{k:'multiscale'},mv:[{id:89},{id:200}],sp:[2,32,0,0,0,32],up:1,dn:3},prov:mkProv({s:'calc',f:'single'})}])});
  await pg.waitForTimeout(400);
  const s1=await pg.evaluate(()=>({cur:TEAMS.cur,p:team.map(x=>x.set.prov),src:team.map(x=>x.set.src)}));
  ok(s1.cur===2&&s1.p[0].s==='season'&&s1.p[0].vs==='article'&&s1.p[1].s==='calc'&&s1.src.every(x=>x==='copy'),'C：パーティに入れるだけでは出どころは元のまま（上位パーティ・計算）、src は copy',s1);
  await go('#/edit/0');await go('#/edit/1');await go('#/team');await pg.evaluate(()=>{switchTeam(0)});await pg.waitForTimeout(200);await pg.evaluate(()=>{switchTeam(2)});await pg.waitForTimeout(200);
  ok(await persisted(pg,obs),'C：読み直す前に、保存がブラウザ全体に届いた');await pg.reload();await appReady(pg);
  const s2=await pg.evaluate(()=>team.map(x=>x.set.prov));
  ok(JSON.stringify(s2)===JSON.stringify(s1.p),'C：育成の画面を開くだけ・枠の切りかえ・読み直しでは出どころが変わらない（入れる≠変える）',s2);
  await go('#/edit/0');await nat();
  const s3=await pg.evaluate(()=>team[0].set);
  ok(s3.src==='manual'&&s3.prov.s==='user'&&s3.prov.from&&s3.prov.from.s==='season'&&s3.prov.from.vs==='article'&&s3.prov.from.id==='season-team:31'&&s3.prov.from.lb==='S1'&&!s3.prov.from.from,'C：変えると「あなたの育成」、1つ前の出どころ（上位パーティ・記事から・記録の番号）を from に正しく残す',s3.prov);
  await nat();ok(await persisted(pg,obs),'C：読み直す前に、保存がブラウザ全体に届いた（2回目）');await pg.reload();await appReady(pg);
  const s4=await pg.evaluate(()=>team[0].set.prov);
  ok(s4.s==='user'&&s4.from&&s4.from.s==='season'&&!s4.from.from,'C：もう一度変えて読み直しても、from は元の出どころ1つだけ（重ならない）',s4);
  /* 割合を保存しない：PokéKit の型・こだわり条件の型・図鑑の型を入れて、端末の保存・同期で送る中身を見る */
  const s5=await pg.evaluate(async()=>{
    const row=MVP_DATA.sets.single.rows.find(r=>byNo[r.num]&&mvpSet('single',r.num,{used:new Set()}).st==='ok'),ms=mvpSet('single',row.num,{used:new Set()});
    switchTeam(1);team=team.slice(0,3);saveTeam();
    team.push({no:row.num,sel:false,set:{...ms.sv}});saveTeam();
    const g=monGuide(byNo[887],{parts:true});await dpToParty(byNo[887],g.sets[0]);
    const k=kdMakeSet(byNo[149],null,null,['axis'],new Set(),{});team.push({no:149,sel:false,set:{...toSaved(k),src:'copy'}});saveTeam();
    return{pctUi:!!ms.pct&&ms.pct.ab!=null,svPct:'pct' in (ms.sv.prov||{}),t:team.map(x=>x.set&&x.set.prov&&x.set.prov.s)}});
  ok(s5.pctUi&&!s5.svPct,'C：PokéKit の型：画面用の割合は残っている（pct）、パーティに入る形には入れない',s5);
  ok(s5.t.slice(3).every(Boolean),'C：PokéKit・図鑑・こだわり条件の型を入れると、どれにも出どころが付く',s5.t);
  /* 同期で送る中身（ログインした状態をまね、authFetch の中身を取り出す）と、別の端末で読み直したとき */
  const sy=await pg.evaluate(async()=>{const sent=[];
    window.twAuth=async()=>{};AUTH.user={uid:'u1'};
    window.authFetch=async(p,body)=>{if(body)sent.push({p,body:JSON.parse(JSON.stringify(body))});return p==='/api/me/teams'?{teams:null,updated_at:0,now:Date.now()}:{}};
    SYNC.busy=false;SYNC.at=0;await teamSync(true);return sent.filter(x=>x.p==='/api/me/teams')});
  ok(sy.length===1,'C：同期でパーティを送る（ログインをまねた）',sy.length);
  const body=sy[0]&&sy[0].body,txt=JSON.stringify(body||{});
  ok(!/"pct"/.test(txt),'C：サーバーに送る中身に、項目ごとの割合が入っていない');
  ok(txt.includes('"s":"season"')&&txt.includes('"s":"pokekit"')&&txt.includes('"src":"copy"'),'C：サーバーに送る中身に、出どころと src（copy）がそのまま入る');
  const all=await pg.evaluate(()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);o[k]=localStorage.getItem(k)}return o});
  ok(!Object.entries(all).some(([k,v])=>/"pct"/.test(v||'')),'C：端末の保存（すべての鍵）に、項目ごとの割合が入っていない',Object.keys(all).filter(k=>/"pct"/.test(all[k]||'')));
  /* 別の端末：サーバーの中身だけを読み直す（cleanTeam を通る） */
  const ctx2=await b.newContext({locale:'ja-JP'});await ctx2.addInitScript(()=>{try{localStorage.setItem('pcstart','1')}catch(e){}});
  const p2=await ctx2.newPage();await p2.route(/championsbattledata|workers\.dev|googleapis/,r=>r.abort());await p2.goto(URL0+'#/tools');await p2.waitForTimeout(800);
  const rt=await p2.evaluate(async B=>{window.twAuth=async()=>{};AUTH.user={uid:'u1'};
    window.authFetch=async(p,body)=>p==='/api/me/teams'&&!body?{teams:B.teams,updated_at:B.updated_at,now:Date.now()}:{};
    SYNC.busy=false;SYNC.at=0;await teamSync(true);return TEAMS.list.map(s=>s.team)},body);
  ok(JSON.stringify(rt)===JSON.stringify(body.teams.list.map(s=>s.team)),'C：別の端末で読み直しても、出どころつきの型が同じ（サーバー→端末で落ちない）');
  await ctx2.close();
  /* 3万文字：3枠×6匹すべてに、いちばん長くなる出どころ（from つき）と取り込みの実数値 */
  const sz=await pg.evaluate(()=>{const pv=provForSave(mkProv({s:'user',from:mkProv({s:'season',f:'single',vs:'article',id:'season-team:'+'9'.repeat(40),lb:'あ'.repeat(40)})}));
    const s=no=>({ab:{k:'rough-skin',n:'さめはだ'},it:{k:'focussash',n:'きあいのタスキ'},mv:[89,200,444,14].map(id=>({id,n:mName(id)})),sp:[2,32,0,0,0,32],up:1,dn:3,src:'manual',vals:[183,152,100,110,95,152],prov:pv});
    const T={cur:0,list:[0,1,2].map(()=>({name:'あ'.repeat(20),team:[445,149,887,6,983,1000].map((no,k)=>({no,sel:k<3,axis:k===0,set:s(no)})),at:Date.now()}))};
    return JSON.stringify(T).length});
  ok(sz<30000,'C：3枠×6匹すべてに長い出どころ（from つき）と実数値があっても、サーバーの保存の上限（3万文字）より小さい',sz);
  /* 1匹から組む → パーティへ（tbTransfer）：PokéKit の型の出どころが残る（確かめの画面は「このまま入れる」） */
  const tb=await pg.evaluate(async()=>{window.askConfirm=async()=>true;switchTeam(2);team=[];saveTeam();
    const rows=MVP_DATA.sets.single.rows.filter(r=>byNo[r.num]&&!byNo[r.num].base).slice(0,8),used=new Set(),mem=[];
    for(const r of rows){const m=mvpSet('single',r.num,{used});if(m.st==='ok'){used.add(m.sv.it&&m.sv.it.k);mem.push({no:r.num,set:m.sv,src:'pokekit'})}if(mem.length>=3)break}
    mem.push({no:445,set:null,src:'none'});
    await tbTransfer(mem,'1匹から');return team.map(x=>x.set?{src:x.set.src,p:x.set.prov}:null)});
  ok(tb.length===4&&tb.slice(0,3).every(x=>x&&x.src==='copy'&&x.p&&x.p.s==='pokekit'&&x.p.c==='external'&&!x.p.pct)&&tb[3]===null,'C：1匹から組む→パーティ：PokéKit の型は外部の参考のまま（割合なし・src は copy）、型の無い匹には付けない',tb);
  /* 改善案（dgImprove）：変えた型は「当サイトの計算」、元の型の出どころを from に。入れかえ案の型は src:copy */
  const im=await pg.evaluate(()=>{switchTeam(0);const L=dgImprove(team);
    const Ls=L.list.filter(c=>c.kind!=='sel'&&c.entries);return{n:Ls.length,items:Ls.map(c=>{const x=c.entries[c.i];return{kind:c.kind,no:x.no,src:x.set&&x.set.src,p:x.set&&x.set.prov,orig:provOf(team[c.i].set)}})}});
  ok(im.n>0&&im.items.some(c=>c.kind!=='swap'),'C：改善案が計算できた（型を変える案がある＝確かめる対象がある）',im.items.map(c=>c.kind));
  ok(im.items.every(c=>c.kind==='swap'?c.src==='copy'&&c.p&&['pokekit','calc'].includes(c.p.s)&&!c.p.pct
      :c.src==='manual'&&c.p&&c.p.s==='calc'&&c.p.c==='theory'&&(c.orig?c.p.from&&c.p.from.s===(c.orig.from||c.orig).s:!c.p.from)),'C：改善案：型を変える案は「当サイトの計算」で、最初の出どころ（無ければ無し）を from に。入れかえ案は src:copy',im.items);
  /* 最初の出どころ：上位パーティ→手で変える→改善案を使う→手で変える、どの段でも from は上位パーティのまま（直前の版にはならない・重ならない） */
  const ch=await pg.evaluate(()=>{switchTeam(1);
    const s0=provForSave(mkProv({s:'user',from:mkProv({s:'season',f:'single',vs:'confirmed',id:'season-team:55',lb:'S2'})}));
    team=[{no:445,sel:true,set:{ab:{k:'rough-skin',n:'さめはだ'},it:{k:'focussash',n:'きあいのタスキ'},mv:[89,200].map(id=>({id,n:mName(id)})),sp:[2,32,0,0,0,32],up:1,dn:3,src:'manual',prov:s0}},
      {no:149,sel:true},{no:887,sel:true},{no:6}];saveTeam();
    const L=dgImprove(team),c=L.list.find(x=>x.kind!=='swap'&&x.kind!=='sel'&&x.entries&&x.i===0);
    if(!c)return{none:true,kinds:L.list.map(x=>x.kind+':'+x.i)};
    team=c.entries.map(x=>JSON.parse(JSON.stringify(x)));saveTeam();return{p:team[0].set.prov}});
  if(ch.none)console.log('provcompat: 1匹目の型を変える改善案が無かったので、改善案→手で変えるの確かめは関数だけ（prov.mjs）',ch.kinds);
  else{ok(ch.p.s==='calc'&&ch.p.from&&ch.p.from.s==='season'&&ch.p.from.id==='season-team:55'&&!ch.p.from.from,'C：「あなたの育成（元は上位パーティ）」に改善案を使う：当サイトの計算・from は上位パーティのまま',ch.p);
    await go('#/edit/0');await nat();
    const ch2=await pg.evaluate(()=>team[0].set.prov);
    ok(ch2.s==='user'&&ch2.from&&ch2.from.s==='season'&&ch2.from.vs==='confirmed'&&!ch2.from.from,'C：そのあと手で変える：あなたの育成・from は上位パーティのまま（改善案の版を指さない）',ch2)}
  ok(!errs.length,'C：エラーなし',errs);
  await ctx.close()}
await b.close();
console.log(process.exitCode?'provcompat: NG':`provcompat: OK（${n}項目）`);
