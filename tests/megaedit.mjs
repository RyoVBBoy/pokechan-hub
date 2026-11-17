// 図鑑の「型・育成」タブの「パーティに入れて育成を決める」（79-dexpage.js の dpToParty／dpMegaToEdit、2026/11/16 依頼主 段階2）の確認：
// メガシンカの姿のページから押すと、元の姿＋その姿のメガストーンで入れる（前はメガストーンを持たせていなかった）。
// いる匹の持ち物は黙って置きかえない（確かめ・キャンセルなら何も変えない）・変えるなら持ち物だけ・ほかの欄（src・出どころ・取り込みの実数値・軸）を残す。
// ふつうの姿のページは前と同じ（いなければ入れて育成の画面・いれば育成の画面を開くだけ）
import {chromium} from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
const OBS_URL='file://'+path.join(ROOT,'dist/ranking/index.html');
if(!fs.existsSync(path.join(ROOT,'dist/ranking/index.html'))){console.error('NG 見張り用の静的ページ dist/ranking/index.html がありません（tools/gen-pages.cjs を先に動かす）');process.exit(1)}
let n=0;const ok=(c,m,x)=>{n++;if(!c){console.error('NG',m,x===undefined?'':JSON.stringify(x).slice(0,600));process.exitCode=1}};
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});

for(const W of [390,1280]){
  const ctx=await b.newContext({viewport:{width:W,height:W<700?844:900},locale:'ja-JP',hasTouch:W<700,isMobile:W<700});
  const obs=await ctx.newPage();await obs.goto(OBS_URL);await obs.evaluate(()=>{localStorage.setItem('pcstart','1')});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));await pg.route(/championsbattledata|workers\.dev|googleapis/,r=>r.abort());
  await pg.goto(URL0+'#/tools');await pg.waitForFunction(()=>document.readyState==='complete'&&typeof TEAMS==='object');
  /* ゲームのデータから確かめる（番号・メガストーンを決めつけない） */
  const D=await pg.evaluate(()=>{const z=MEGAP.find(m=>m.base===445&&m.stone==='garchompitez'),g=MEGAP.find(m=>m.base===445&&m.stone==='garchompite');
    return{z:z&&z.no,g:g&&g.no,zN:z&&z.n,zS:ITEMN.garchompitez,gS:ITEMN.garchompite,sash:ITEMN.focussash,base:byNo[445].n}});
  ok(D.z&&D.g&&D.zS&&D.gS&&D.sash,W+'：メガガブリアス・メガガブリアスZ とメガストーンがデータにある',D);
  const SASH={ab:{k:'rough-skin',n:'さめはだ'},it:{k:'focussash',n:D.sash},mv:[{id:89,n:'じしん'},{id:200,n:'げきりん'}],sp:[2,32,0,0,0,32],up:1,dn:3,src:'copy',
    vals:[183,182,115,90,105,169],
    prov:{v:1,s:'season',c:'observed',m:'original',g:'champions',f:'single',vs:'article',id:'season-team:31',lb:'S1'}};
  const OTHER={no:149,sel:true,set:{ab:{k:'multiscale',n:'マルチスケイル'},it:{k:'leftovers',n:'たべのこし'},mv:[{id:89,n:'じしん'}],sp:[32,0,2,0,32,0],up:2,dn:3,src:'manual'}};
  const setParty=async(slot,t0,t1)=>{await pg.evaluate(([slot,t0,t1])=>{TEAMS.list[0].team=t0;TEAMS.list[1].team=t1;TEAMS.list[2].team=[];TEAMS.cur=slot;team=TEAMS.list[slot].team.map(x=>({...x}));saveTeam();location.hash='#/tools'},[slot,t0,t1]);await pg.waitForTimeout(200)};
  const state=()=>pg.evaluate(()=>({cur:TEAMS.cur,list:JSON.parse(JSON.stringify(TEAMS.list.map(s=>s.team))),ls:localStorage.getItem('pcteams'),hash:location.hash}));
  /* 図鑑のページの「型・育成」タブを開き、「パーティに入れて育成を決める」を押す */
  const openB=async no=>{await pg.evaluate(h=>{location.hash=h},'#/p/'+no);await pg.waitForSelector('#seg [data-i="4"]');
    await pg.click('#seg [data-i="4"]');await pg.waitForSelector('[data-dpcustom]',{state:'visible'});await pg.waitForTimeout(150)};
  const press=()=>pg.click('[data-dpcustom]');
  const dialog=()=>pg.$eval('.xc',d=>({t:d.querySelector('#xc-t').textContent,p:(d.querySelector('p')||{}).textContent||'',ok:d.querySelector('.xc-ok').textContent})).catch(()=>null);
  const edAt=async i=>{await pg.waitForFunction(i=>location.hash==='#/edit/'+i&&typeof ED!=='undefined'&&ED&&ED.idx===i,i,{timeout:10000}).catch(()=>{});
    return pg.evaluate(()=>location.hash.startsWith('#/edit/')&&ED?{idx:ED.idx,no:ED.no,it:ED.s.it&&ED.s.it.k}:null)};

  /* 1. メガ・元の姿がいない：元の姿＋メガストーンだけで、いま選んでいる枠（2枠目）に入れ、その匹の育成の画面へ */
  await setParty(1,[{no:887,sel:true}],[OTHER]);
  await openB(D.z);await press();
  let e=await edAt(1);let s=await state();
  ok(!(await dialog()),W+'：メガ・元の姿がいない：確かめを出さない');
  ok(s.cur===1&&s.list[1].length===2&&s.list[1][1].no===445&&JSON.stringify(s.list[1][1].set)===JSON.stringify({it:{n:D.zS,k:'garchompitez'}}),W+'：メガ・元の姿がいない：元の姿（メガシンカの姿の番号ではない）＋その姿のメガストーンだけで入る',s.list[1]);
  ok(e&&e.idx===1&&e.no===445&&e.it==='garchompitez',W+'：メガ・元の姿がいない：入れた匹の育成の画面が開き、持ち物はメガストーン',e);
  ok(JSON.stringify(s.list[1][0])===JSON.stringify(OTHER)&&JSON.stringify(s.list[0])===JSON.stringify([{no:887,sel:true}]),W+'：ほかの匹・ほかの枠は変わらない');
  /* もう1回押しても同じ匹を2匹にしない（同じメガストーンなので書きかえもしない） */
  const b1=await state();await openB(D.z);await press();e=await edAt(1);s=await state();
  ok(s.ls===b1.ls&&s.list[1].filter(x=>x.no===445).length===1&&e&&e.idx===1,W+'：もう1回押しても同じ匹は増えず、何も書きかえずに育成の画面へ',s.list[1]);

  /* 2. メガ・元の姿がほかの持ち物（きあいのタスキ）：確かめ。キャンセル・Esc で何も変えない */
  const AX={no:445,sel:true,axis:true,set:SASH};
  await setParty(0,[OTHER,AX],[{no:6}]);
  const before=await state();
  await openB(D.z);await press();await pg.waitForSelector('.xc .xc-ok');
  const dg=await dialog();
  ok(dg&&dg.t.includes(D.base)&&dg.p.includes('「パーティ1」')&&dg.p.includes('2番目')&&dg.p.includes(D.sash)&&dg.p.includes(D.zS)&&dg.p.includes(D.zN)&&/キャンセルすると、いまのまま/.test(dg.p)&&dg.ok==='持ち物を変える',W+'：確かめ：パーティ名・何番目・ポケモン・いまの持ち物・変えるメガストーン',dg);
  await pg.evaluate(()=>document.querySelector('[data-dpcustom]').click());await pg.waitForTimeout(200);
  ok((await pg.$$('.xc')).length===1,W+'：確かめが出ている間に押しても、2つ目は出ない');
  await pg.click('.xc .xc-no');await pg.waitForTimeout(300);
  s=await state();
  ok(s.ls===before.ls&&JSON.stringify(s.list)===JSON.stringify(before.list),W+'：キャンセル：パーティは1文字も変わらない');
  ok(s.hash==='#/p/'+D.z,W+'：キャンセル：図鑑のページのまま（育成の画面へ行かない）',s.hash);
  await press();await pg.waitForSelector('.xc .xc-ok');await pg.keyboard.press('Escape');await pg.waitForTimeout(300);
  s=await state();ok(s.ls===before.ls&&s.hash==='#/p/'+D.z,W+'：Esc で閉じても何も変えない');

  /* 3. 変える：持ち物だけ。src・取り込みの実数値・軸・選出の印はそのまま、出どころは育成の画面で変えたのと同じ */
  await press();await pg.waitForSelector('.xc .xc-ok');await pg.click('.xc .xc-ok');
  e=await edAt(1);s=await state();const g=s.list[0][1].set;
  ok(g.it.k==='garchompitez'&&g.it.n===D.zS,W+'：変える：持ち物がメガストーンになる',g.it);
  ok(JSON.stringify([g.ab,g.mv,g.sp,g.up,g.dn,g.vals])===JSON.stringify([SASH.ab,SASH.mv,SASH.sp,SASH.up,SASH.dn,SASH.vals]),W+'：変える：特性・技・能力ポイント・性格・取り込みの実数値は変わらない',g);
  ok(g.src==='copy'&&g.prov&&g.prov.s==='user'&&g.prov.c==='user'&&g.prov.from&&g.prov.from.s==='season'&&g.prov.from.id==='season-team:31'&&!g.prov.from.from,W+'：変える：src は元のまま（copy）・出どころは「あなたの育成」で最初の出どころ（上位パーティ）を from に',g);
  ok(s.list[0][1].axis===true&&s.list[0][1].sel===true&&s.list[0].length===2&&JSON.stringify(s.list[0][0])===JSON.stringify(OTHER)&&JSON.stringify(s.list[1])===JSON.stringify(before.list[1]),W+'：変える：軸・選出の印・ほかの匹・ほかの枠は変わらない・匹は増えない',s.list);
  ok(e&&e.idx===1&&e.it==='garchompitez',W+'：変える：その匹の育成の画面へ（持ち物はメガストーン）',e);
  /* 変えたあと育成の画面を開いただけでは、保存の中身は変わらない */
  const b3=await state();await pg.evaluate(()=>{location.hash='#/team'});await pg.waitForTimeout(400);
  ok((await state()).ls===b3.ls,W+'：育成の画面を開いて閉じただけでは、保存の中身は変わらない');

  /* 4. 別のメガ（メガガブリアス）：いまのメガストーン（Z）を変えるか確かめる。変えても出どころは重ならない */
  await openB(D.g);await press();await pg.waitForSelector('.xc .xc-ok');
  const dg4=await dialog();ok(dg4&&dg4.p.includes(D.zS)&&dg4.p.includes(D.gS),W+'：別のメガストーンを持っているときも確かめる',dg4);
  await pg.click('.xc .xc-ok');await edAt(1);
  s=await state();const g4=s.list[0][1].set;
  ok(g4.it.k==='garchompite'&&JSON.stringify(g4.mv)===JSON.stringify(SASH.mv)&&g4.src==='copy'&&g4.prov.s==='user'&&g4.prov.from.s==='season'&&!g4.prov.from.from,W+'：メガストーンを変える：持ち物だけ・出どころは最初の出どころのまま（重ならない）',g4);

  /* 5. 元の姿がいて持ち物なし（育成はある）：確かめずに持たせて育成の画面へ。ほかは変えない */
  await setParty(0,[{no:445,sel:true,set:{...SASH,it:null}}],[]);
  await openB(D.z);await press();e=await edAt(0);
  s=await state();const g5=s.list[0][0].set;
  ok(!(await dialog())&&g5.it.k==='garchompitez'&&JSON.stringify([g5.ab,g5.mv,g5.sp,g5.vals])===JSON.stringify([SASH.ab,SASH.mv,SASH.sp,SASH.vals])&&g5.src==='copy'&&g5.prov.s==='user'&&g5.prov.from.s==='season',W+'：持ち物なし：確かめずに持たせる・ほかの欄は残す・src は元のまま',g5);
  ok(e&&e.idx===0&&e.it==='garchompitez',W+'：持ち物なし：その匹の育成の画面へ',e);
  /* 育成の無い匹：メガストーンだけ（出どころの記録は作らない） */
  await setParty(0,[{no:445,sel:false}],[]);
  await openB(D.z);await press();await edAt(0);
  s=await state();ok(JSON.stringify(s.list[0][0])===JSON.stringify({no:445,sel:false,set:{it:{n:D.zS,k:'garchompitez'}}}),W+'：育成の無い匹：メガストーンだけを持たせる',s.list[0][0]);
  /* 出どころの無い前の形の型（src:manual）：持ち物だけ変え、src はそのまま */
  const OLD={ab:SASH.ab,it:null,mv:SASH.mv,sp:SASH.sp,up:1,dn:3,src:'manual'};
  await setParty(0,[{no:445,sel:true,set:OLD}],[]);
  await openB(D.z);await press();await edAt(0);
  s=await state();const g6=s.list[0][0].set;
  ok(g6.it.k==='garchompitez'&&g6.src==='manual'&&JSON.stringify(g6.mv)===JSON.stringify(OLD.mv),W+'：出どころの無い型：持ち物だけ変え、src（manual）はそのまま',g6);

  /* 6. 6匹そろっていて元の姿がいない：入れない・何も書きかえない・育成の画面へ行かない */
  const SIX=[149,887,1000,6,983,3].map((no,k)=>({no,sel:k<3}));
  await setParty(0,SIX,[]);const b6=await state();
  await openB(D.z);await press();await pg.waitForTimeout(400);
  s=await state();const msg=await pg.$$eval('.toast',a=>a.map(t=>t.textContent).join(' '));
  ok(s.ls===b6.ls&&!(await dialog())&&s.hash==='#/p/'+D.z,W+'：6匹そろっていると入れない（何も書きかえない・図鑑のページのまま）',s.hash);
  ok(/6匹そろっています/.test(msg),W+'：入れられない理由を出す',msg);

  /* 7. 確かめている間に枠を切りかえた：どの枠も変えない */
  await setParty(0,[{no:445,sel:true,set:SASH}],[OTHER]);const b7=await state();
  await openB(D.z);await press();await pg.waitForSelector('.xc .xc-ok');
  await pg.evaluate(()=>switchTeam(1));await pg.click('.xc .xc-ok');await pg.waitForTimeout(400);
  s=await state();ok(JSON.stringify(s.list)===JSON.stringify(b7.list),W+'：確かめている間に枠が変わったら、どの枠も変えない',s.list);

  /* 8. ふつうの姿のページは前と同じ */
  await setParty(0,[{no:445,sel:true,set:SASH}],[]);const b8=await state();
  await openB(445);await press();e=await edAt(0);
  s=await state();ok(s.ls===b8.ls&&!(await dialog())&&e&&e.idx===0&&e.it==='focussash',W+'：ふつうの姿・もういる：何も書きかえずに育成の画面を開く（持ち物はきあいのタスキのまま）',e);
  await openB(149);await press();e=await edAt(1);
  s=await state();ok(s.list[0].length===2&&JSON.stringify(s.list[0][1])===JSON.stringify({no:149,sel:true})&&e&&e.idx===1,W+'：ふつうの姿・いない：育成なしで入れて育成の画面へ（前と同じ）',s.list[0]);
  await setParty(0,SIX,[]);const b8b=await state();
  await openB(445);await press();await pg.waitForTimeout(400);
  s=await state();ok(s.ls===b8b.ls&&/6匹そろっています/.test(await pg.$$eval('.toast',a=>a.map(t=>t.textContent).join(' '))),W+'：ふつうの姿・6匹：入れない（前と同じ）');

  /* 9. 読み直しても変えた結果のまま（保存がブラウザ全体に届いてから読み直す） */
  await setParty(0,[OTHER,AX],[]);
  await openB(D.z);await press();await pg.waitForSelector('.xc .xc-ok');await pg.click('.xc .xc-ok');await edAt(1);
  const want=await pg.evaluate(()=>localStorage.getItem('pcteams'));let seen=false;
  for(let t=0;t<400&&!seen;t++){seen=(await obs.evaluate(()=>localStorage.getItem('pcteams')))===want;if(!seen)await obs.waitForTimeout(25)}
  ok(seen,W+'：保存がブラウザ全体に届いた');
  await pg.reload();await pg.waitForFunction(()=>document.readyState==='complete'&&typeof TEAMS==='object');
  s=await state();const g9=s.list[0][1];
  ok(g9.set.it.k==='garchompitez'&&g9.axis===true&&g9.set.src==='copy'&&g9.set.prov.from.s==='season'&&JSON.stringify(g9.set.vals)===JSON.stringify(SASH.vals)&&JSON.stringify(s.list[0][0])===JSON.stringify(OTHER),W+'：読み直しても、持ち物・軸・src・出どころ・取り込みの実数値・ほかの匹が同じ',s.list[0]);
  ok(!errs.length,W+'：エラーなし',errs);
  await ctx.close();
}
await b.close();
console.log(process.exitCode?'megaedit: NG':`megaedit: OK（${n}項目）`);
