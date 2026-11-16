// 図鑑のメガシンカの姿の「パーティに追加」（09-pokemon.js の dpAddMega、2026/11/16 依頼主 段階1）の確認：
// 元の姿の持ち物を黙って置きかえない。確かめ（どのパーティの何番目・いまの持ち物・変えるメガストーン）・キャンセルなら何も変えない・
// 変えるなら持ち物だけ・出どころは育成の画面で変えたときと同じ・同じメガストーンなら何もしない・6匹・同じ匹を2匹にしない・読み直し
import {chromium} from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import {makeD1} from './d1mock.mjs';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
const OBS_URL='file://'+path.join(ROOT,'dist/ranking/index.html');
if(!fs.existsSync(path.join(ROOT,'dist/ranking/index.html'))){console.error('NG 見張り用の静的ページ dist/ranking/index.html がありません（tools/gen-pages.cjs を先に動かす）');process.exit(1)}
let n=0;const ok=(c,m,x)=>{n++;if(!c){console.error('NG',m,x===undefined?'':JSON.stringify(x).slice(0,600));process.exitCode=1}};
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
let CHANGED=null;   /* 写した型の持ち物だけを変えた結果（下のサーバーの集計の確かめで使う） */

for(const W of [390,1280]){
  const ctx=await b.newContext({viewport:{width:W,height:W<700?844:900},locale:'ja-JP',hasTouch:W<700,isMobile:W<700});
  const obs=await ctx.newPage();await obs.goto(OBS_URL);await obs.evaluate(()=>{localStorage.setItem('pcstart','1')});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));await pg.route(/championsbattledata|workers\.dev|googleapis/,r=>r.abort());
  await pg.goto(URL0+'#/tools');await pg.waitForFunction(()=>document.readyState==='complete'&&typeof TEAMS==='object');
  /* ゲームのデータから確かめる（番号・メガストーンを決めつけない） */
  const D=await pg.evaluate(()=>{const z=MEGAP.find(m=>m.base===445&&m.stone==='garchompitez'),g=MEGAP.find(m=>m.base===445&&m.stone==='garchompite');
    return{z:z&&z.no,g:g&&g.no,zN:z&&z.n,gN:g&&g.n,zS:ITEMN.garchompitez,gS:ITEMN.garchompite,sash:ITEMN.focussash,base:byNo[445].n}});
  ok(D.z&&D.g&&D.zS&&D.gS&&D.sash,W+'：メガガブリアス・メガガブリアスZ とメガストーンがデータにある',D);
  /* パーティを入れて保存（枠ごと）。2枠目を選んだ状態にして「いま選んでいる枠」に入ることを確かめる */
  const SASH={ab:{k:'rough-skin',n:'さめはだ'},it:{k:'focussash',n:D.sash},mv:[{id:89,n:'じしん'},{id:200,n:'げきりん'}],sp:[2,32,0,0,0,32],up:1,dn:3,src:'copy',
    prov:{v:1,s:'season',c:'observed',m:'original',g:'champions',f:'single',vs:'article',id:'season-team:31',lb:'S1'}};
  const setParty=async(slot,t0,t1)=>{await pg.evaluate(([slot,t0,t1])=>{TEAMS.list[0].team=t0;TEAMS.list[1].team=t1;TEAMS.list[2].team=[];TEAMS.cur=slot;team=TEAMS.list[slot].team.map(x=>({...x}));saveTeam();location.hash='#/tools'},[slot,t0,t1]);await pg.waitForTimeout(200)};
  const state=()=>pg.evaluate(()=>({cur:TEAMS.cur,list:JSON.parse(JSON.stringify(TEAMS.list.map(s=>s.team))),ls:localStorage.getItem('pcteams'),hash:location.hash}));
  const open=async no=>{await pg.evaluate(h=>{location.hash=h},'#/p/'+no);await pg.waitForSelector('#addbtn');await pg.waitForTimeout(150)};
  const dialog=()=>pg.$eval('.xc',d=>({t:d.querySelector('#xc-t').textContent,p:(d.querySelector('p')||{}).textContent||'',ok:d.querySelector('.xc-ok').textContent})).catch(()=>null);
  const OTHER={no:149,sel:true,set:{ab:{k:'multiscale',n:'マルチスケイル'},it:{k:'leftovers',n:'たべのこし'},mv:[{id:89,n:'じしん'}],sp:[32,0,2,0,32,0],up:2,dn:3,src:'manual'}};

  /* 1. 元の姿がいない：元の姿＋メガストーンだけ（ほかの育成・出どころは作らない）。いま選んでいる枠（2枠目）に入る */
  await setParty(1,[{no:887,sel:true}],[OTHER]);
  await open(D.z);await pg.click('#addbtn');await pg.waitForTimeout(400);
  let s=await state();
  ok(!(await dialog()),W+'：元の姿がいないときは確かめを出さない');
  ok(s.cur===1&&s.list[1].length===2&&s.list[1][1].no===445&&JSON.stringify(s.list[1][1].set)===JSON.stringify({it:{n:D.zS,k:'garchompitez'}}),W+'：元の姿がいない：いま選んでいる枠に、元の姿＋メガストーンだけで入る（出どころの記録は作らない）',s.list[1]);
  ok(JSON.stringify(s.list[1][0])===JSON.stringify(OTHER)&&JSON.stringify(s.list[0])===JSON.stringify([{no:887,sel:true}]),W+'：ほかの匹・ほかの枠は変わらない');
  ok(s.hash==='#/team',W+'：入れたらパーティの画面へ（前と同じ）');

  /* 2. 元の姿がほかの持ち物（きあいのタスキ）：確かめ。キャンセルで何も変えない */
  await setParty(0,[OTHER,{no:445,sel:true,set:SASH}],[{no:6}]);
  const before=await state();
  await open(D.z);await pg.click('#addbtn');await pg.waitForSelector('.xc .xc-ok');
  const dg=await dialog();
  ok(dg&&dg.t.includes(D.base)&&dg.p.includes('「パーティ1」')&&dg.p.includes('2番目')&&dg.p.includes(D.sash)&&dg.p.includes(D.zS)&&dg.p.includes(D.zN)&&/キャンセルすると、いまのまま/.test(dg.p)&&dg.ok==='持ち物を変える',W+'：確かめ：パーティ名・何番目・ポケモン・いまの持ち物・変えるメガストーン・キャンセルならいまのまま',dg);
  /* 確かめが出ている間にもう一度押しても、確かめは1つだけ */
  await pg.evaluate(()=>document.getElementById('addbtn').click());await pg.waitForTimeout(200);
  ok((await pg.$$('.xc')).length===1,W+'：確かめが出ている間に押しても、2つ目は出ない');
  await pg.click('.xc .xc-no');await pg.waitForTimeout(300);
  s=await state();
  ok(s.ls===before.ls&&JSON.stringify(s.list)===JSON.stringify(before.list),W+'：キャンセル：パーティは1文字も変わらない（持ち物・技・出どころ・ほかの匹）');
  ok(s.hash==='#/p/'+D.z,W+'：キャンセル：図鑑のページのまま');
  /* Esc でも同じ */
  await pg.click('#addbtn');await pg.waitForSelector('.xc .xc-ok');await pg.keyboard.press('Escape');await pg.waitForTimeout(300);
  s=await state();ok(s.ls===before.ls,W+'：Esc で閉じても何も変えない');

  /* 3. 変える：持ち物だけ。出どころは「あなたの育成」・最初の出どころ（上位パーティ）を from に */
  await pg.click('#addbtn');await pg.waitForSelector('.xc .xc-ok');await pg.click('.xc .xc-ok');await pg.waitForTimeout(400);
  s=await state();const g=s.list[0][1].set;
  ok(g.it.k==='garchompitez'&&g.it.n===D.zS,W+'：変える：持ち物がメガストーンになる',g.it);
  ok(JSON.stringify([g.ab,g.mv,g.sp,g.up,g.dn])===JSON.stringify([SASH.ab,SASH.mv,SASH.sp,SASH.up,SASH.dn]),W+'：変える：特性・技・能力ポイント・性格は変わらない',g);
  if(!CHANGED)CHANGED=JSON.parse(JSON.stringify(g));
  ok(g.src==='copy'&&g.prov&&g.prov.s==='user'&&g.prov.c==='user'&&g.prov.from&&g.prov.from.s==='season'&&g.prov.from.vs==='article'&&g.prov.from.id==='season-team:31'&&!g.prov.from.from,W+'：出どころ：育成の画面で変えたのと同じ（あなたの育成・最初の出どころは上位パーティ）。「上位パーティの型のまま」とは書かない。src は元のまま（copy）',g);
  ok(JSON.stringify(s.list[0][0])===JSON.stringify(OTHER)&&JSON.stringify(s.list[1])===JSON.stringify(before.list[1])&&s.list[0].length===2&&s.list[0][1].sel===true,W+'：変える：ほかの匹・ほかの枠・選出の印は変わらない・匹は増えない');
  ok(s.list[0].filter(x=>x.no===445).length===1,W+'：同じ匹が2匹にならない');

  /* 4. もう同じメガストーンを持っている：確かめを出さず、何も書きかえない */
  const b4=await state();
  await open(D.z);await pg.click('#addbtn');await pg.waitForTimeout(400);
  s=await state();
  ok(!(await dialog())&&s.ls===b4.ls,W+'：同じメガストーンを持っているときは、確かめも書きかえもしない');

  /* 5. メガガブリアス（ほかのメガストーンを持っている＝メガガブリアスZのストーン）：確かめが出て、変えるとストーンだけ変わる。出どころは重ならない */
  await open(D.g);await pg.click('#addbtn');await pg.waitForSelector('.xc .xc-ok');
  const dg5=await dialog();ok(dg5&&dg5.p.includes(D.zS)&&dg5.p.includes(D.gS),W+'：別のメガストーンを持っているときも確かめる',dg5);
  await pg.click('.xc .xc-ok');await pg.waitForTimeout(400);
  s=await state();const g5=s.list[0][1].set;
  ok(g5.it.k==='garchompite'&&JSON.stringify(g5.mv)===JSON.stringify(SASH.mv)&&g5.prov.s==='user'&&g5.prov.from.s==='season'&&!g5.prov.from.from,W+'：メガストーンを変える：持ち物だけ・出どころは最初の出どころのまま（重ならない）',g5);

  /* 6. 元の姿がいて、持ち物なし（育成はある）：置きかえる物が無いので確かめずに持たせる。育成の画面で変えたのと同じ扱い */
  const NOIT={...SASH,it:null};
  await setParty(0,[{no:445,sel:true,set:NOIT}],[]);
  await open(D.z);await pg.click('#addbtn');await pg.waitForTimeout(400);
  s=await state();const g6=s.list[0][0].set;
  ok(!(await dialog())&&g6.it.k==='garchompitez'&&JSON.stringify(g6.mv)===JSON.stringify(SASH.mv)&&g6.src==='copy'&&g6.prov.s==='user'&&g6.prov.from.s==='season',W+'：持ち物なし：確かめずに持たせる・ほかは変えない・出どころは育成の画面と同じ・src は元のまま（copy）',g6);
  /* 育成の無い匹：メガストーンだけ（前と同じ形） */
  await setParty(0,[{no:445,sel:false}],[]);
  await open(D.z);await pg.click('#addbtn');await pg.waitForTimeout(400);
  s=await state();ok(JSON.stringify(s.list[0][0])===JSON.stringify({no:445,sel:false,set:{it:{n:D.zS,k:'garchompitez'}}}),W+'：育成の無い匹：メガストーンだけを持たせる（出どころの記録は作らない）',s.list[0][0]);

  /* 7. 6匹そろっていて元の姿がいない：入れない・ほかの匹を置きかえない */
  const SIX=[149,887,1000,6,983,3].map((no,k)=>({no,sel:k<3}));
  await setParty(0,SIX,[]);const b7=await state();
  await open(D.z);await pg.click('#addbtn');await pg.waitForTimeout(400);
  s=await state();const msg=await pg.$$eval('.toast',a=>a.map(t=>t.textContent).join(' '));
  ok(s.ls===b7.ls&&!(await dialog()),W+'：6匹そろっていると入れない（ほかの匹を置きかえない・何も書きかえない）');
  ok(/6匹そろっています/.test(msg),W+'：入れられない理由を出す',msg);
  /* 6匹そろっていて元の姿がいる（ほかの持ち物）：確かめて持ち物だけ変える（匹の数は6のまま） */
  await setParty(0,[...SIX.slice(0,5),{no:445,sel:false,set:SASH}],[]);
  await open(D.z);await pg.click('#addbtn');await pg.waitForSelector('.xc .xc-ok');
  ok((await dialog()).p.includes('6番目'),W+'：何番目かを正しく出す（6番目）');
  await pg.click('.xc .xc-ok');await pg.waitForTimeout(400);
  s=await state();ok(s.list[0].length===6&&s.list[0][5].set.it.k==='garchompitez'&&JSON.stringify(s.list[0].slice(0,5))===JSON.stringify(SIX.slice(0,5)),W+'：6匹のとき：持ち物だけ変え、ほかの5匹はそのまま');

  /* 8. 確かめている間にパーティが変わった（枠を切りかえた）：何も変えない */
  await setParty(0,[{no:445,sel:true,set:SASH}],[OTHER]);const b8=await state();
  await open(D.z);await pg.click('#addbtn');await pg.waitForSelector('.xc .xc-ok');
  await pg.evaluate(()=>switchTeam(1));await pg.click('.xc .xc-ok');await pg.waitForTimeout(400);
  s=await state();ok(JSON.stringify(s.list)===JSON.stringify(b8.list),W+'：確かめている間に枠が変わったら、どの枠も変えない',s.list);

  /* 9. ふつうの姿の「パーティに追加」は前と同じ（いなければ入れる・いれば何も変えない） */
  await setParty(0,[{no:445,sel:true,set:SASH}],[]);const b9=await state();
  await open(445);await pg.click('#addbtn');await pg.waitForTimeout(400);
  s=await state();ok(s.ls===b9.ls&&!(await dialog()),W+'：ふつうの姿：もういるときは何も変えない（前と同じ）');
  await open(149);await pg.click('#addbtn');await pg.waitForTimeout(400);
  s=await state();ok(s.list[0].length===2&&JSON.stringify(s.list[0][1])===JSON.stringify({no:149,sel:true})&&s.hash==='#/team',W+'：ふつうの姿：いなければ入れる（前と同じ）',s.list[0]);

  /* 10. 変えた結果を読み直しても同じ（保存がブラウザ全体に届いてから読み直す） */
  await setParty(0,[OTHER,{no:445,sel:true,set:SASH}],[]);
  await open(D.z);await pg.click('#addbtn');await pg.waitForSelector('.xc .xc-ok');await pg.click('.xc .xc-ok');await pg.waitForTimeout(300);
  const want=await pg.evaluate(()=>localStorage.getItem('pcteams'));let seen=false;
  for(let t=0;t<400&&!seen;t++){seen=(await obs.evaluate(()=>localStorage.getItem('pcteams')))===want;if(!seen)await obs.waitForTimeout(25)}
  ok(seen,W+'：保存がブラウザ全体に届いた');
  await pg.reload();await pg.waitForFunction(()=>document.readyState==='complete'&&typeof TEAMS==='object');
  s=await state();ok(s.list[0][1].set.it.k==='garchompitez'&&s.list[0][1].set.prov.from.s==='season'&&JSON.stringify(s.list[0][0])===JSON.stringify(OTHER),W+'：読み直しても、変えた持ち物・出どころ・ほかの匹が同じ',s.list[0]);
  ok(!errs.length,W+'：エラーなし',errs);
  await ctx.close();
}
await b.close();

/* 写した型の持ち物だけを変えた結果（src は copy のまま）は、サイトの集計（worker/src/usage.js、利用者の型）に入らない。
   比べのため、同じ型を src:'manual' にしたもの（育成の画面で変えたときの形）は入ることも確かめる（確かめ方が働いている証拠） */
{ok(CHANGED&&CHANGED.src==='copy'&&CHANGED.it.k==='garchompitez','集計の確かめ：ブラウザで持ち物だけを変えた型を取り出せた',CHANGED);
  const PID='pokechan-test',enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  const kp=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const jwk={...(await crypto.subtle.exportKey('jwk',kp.publicKey)),kid:'k1',use:'sig',alg:'RS256'},now=Math.floor(Date.now()/1000);
  const tok=async uid=>{const h=enc({alg:'RS256',kid:'k1',typ:'JWT'}),p=enc({iss:'https://securetoken.google.com/'+PID,aud:PID,sub:uid,iat:now-10,exp:now+3600,auth_time:now-10,email:uid+'@example.com'});
    return h+'.'+p+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',kp.privateKey,new TextEncoder().encode(h+'.'+p))).toString('base64url')};
  globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
  globalThis.fetch=async u=>{u=String(u);if(u.includes('securetoken@system.gserviceaccount.com'))return new Response(JSON.stringify({keys:[jwk]}));return new Response('',{status:404})};
  const w=(await import(path.join(ROOT,'worker/dist/worker.js'))).default,env={DB:makeD1(),FIREBASE_PROJECT_ID:PID,APP_TOKEN:'t',ADMIN_TOKEN:'admin-secret-123'};
  let ip=0;const call=async(p,{method='GET',tok:t,body}={})=>{const h={'content-type':'application/json','cf-connecting-ip':'10.2.0.'+(++ip%250)};if(t)h.authorization='Bearer '+t;
    const r=await w.fetch(new Request('https://x.dev'+p,{method,headers:h,body:body?JSON.stringify(body):undefined}),env,{waitUntil(){}});return[r.status,await r.json().catch(()=>({}))]};
  const save=async(uid,no,set)=>{const t=await tok(uid);await call('/api/me',{method:'POST',tok:t,body:{handle:uid,name:uid,agree:true}});
    return call('/api/me/teams',{method:'POST',tok:t,body:{teams:{cur:0,list:[{name:'x',team:[{no,sel:true,set}]}]},updated_at:Date.now()}})};
  for(const u of ['mga1','mga2','mga3']){const r=await save(u,445,CHANGED);ok(r[0]===200,'集計の確かめ：サーバーに保存できる',r)}
  for(const u of ['mgb1','mgb2','mgb3']){const r=await save(u,149,{...CHANGED,src:'manual'});ok(r[0]===200,'集計の確かめ：比べ用の型を保存できる',r)}
  const r=await call('/api/usage?fmt=single');
  ok(r[0]===200&&r[1].builds&&!r[1].builds[445],'集計の確かめ：写した型の持ち物だけを変えた型（src:copy のまま）は、3人が保存してもサイトの集計に入らない',r[1].builds);
  ok(r[1].builds&&r[1].builds[149]&&r[1].builds[149].it[0][0]==='garchompitez','集計の確かめ（比べ）：同じ型を src:manual にしたものは集計に入る＝確かめ方が働いている',r[1].builds)}
console.log(process.exitCode?'megaadd: NG':`megaadd: OK（${n}項目）`);
