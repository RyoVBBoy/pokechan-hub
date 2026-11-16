// 型の出どころ（82-prov.js、2026/11/16 依頼主「統一した型の形・出どころを失わない」）の確認
// ①4つの分類と3つの作られ方は出典で決まる ②分からないことは null（推し量らない）③項目ごとの割合は保存しない
// ④実際に型を作る所（図鑑の型・理論の型・PokéKit・上位パーティ・こだわり条件・育成の編集・画像の取り込み・入れかえ・改善案）に付く
// ⑤パーティに入れて保存・読み直しても残る ⑥src（とくに copy＝サイトの集計に数えない）は変えない ⑦古い型は「出どころ不明」
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
let n=0;const ok=(c,m,x)=>{n++;if(!c){console.error('NG',m,x===undefined?'':JSON.stringify(x).slice(0,500));process.exitCode=1}};
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const ctx=await b.newContext({viewport:{width:390,height:844},locale:'ja-JP'});
await ctx.addInitScript(()=>{try{if(!sessionStorage.getItem('__i')){localStorage.setItem('pcstart','1')}sessionStorage.setItem('__i','1')}catch(e){}});
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.route(/championsbattledata\.com/,r=>r.abort());
await pg.goto(URL0+'#/tools');await pg.waitForTimeout(800);

/* ---- 1. 出どころの形 ---- */
const u=await pg.evaluate(()=>{
  const cbd=mkProv({s:'cbd',f:'single',reg:'M-C',per:'2026-11',n:999,at:Date.now(),c:'theory',m:'original',vs:'confirmed',pct:{mv:[50]}});
  const se=mkProv({s:'season',f:'double',vs:'article',id:'season-team:5',lb:'シーズン1'});
  const pk=provPokekit('single',{ab:90});
  const su=mkProv({s:'site_usage',f:'single',per:'直近30日',n:12});
  const ca=mkProv({s:'calc',f:'single',vs:'confirmed'});
  const us=mkProv({s:'user'}),im=mkProv({s:'import'});
  return{cbd,se,pk,su,ca,us,im,bad:mkProv({s:'nope'}),badvs:mkProv({s:'season',vs:'ゲーム内で確認'}),noAt:mkProv({s:'cbd',at:'きのう'}),
    save:provForSave(cbd),saveSe:provForSave(se),saveFrom:provForSave(mkProv({s:'user',from:mkProv({s:'user',from:pk})})),chain:(()=>{const u1=provForSave(mkProv({s:'user',from:se})),c1=provForSave(mkProv({s:'calc',from:u1})),u2=provForSave(mkProv({s:'user',from:c1}));return{u1,c1,u2}})(),
    len:JSON.stringify(provForSave(mkProv({s:'user',from:pk}))).length,
    legacy:[provOf({src:'manual'}),provOf({src:'import'}),provOf({src:'copy'}),provOf({}),provOf(null),provOf({src:'copy',prov:{s:'pokekit',c:'user',m:'original',pct:{x:1}}})],
    label:[provLabel(null),provLabel(provForSave(se)),provLabel(provForSave(pk))],
    vsMap:[provSeasonVs({verified:1}),provSeasonVs({by_admin:1}),provSeasonVs({ver:true}),provSeasonVs({auto:1}),provSeasonVs({})],
    meta:mvpMeta('single')}});
ok(u.cbd.c==='observed'&&u.cbd.m==='aggregated'&&u.cbd.g==='champions'&&u.cbd.vs===null,'ランクバトルの集計＝実戦データ・組み合わせ（呼ぶ側が別の分類・確認の状態を渡しても変わらない）',u.cbd);
ok(u.cbd.reg===null&&u.cbd.per===null&&u.cbd.n===null,'ランクバトルの集計のレギュレーション・集計期間・対戦数は、渡されても持たない（提供元のデータに無い）',u.cbd);
ok(u.se.c==='observed'&&u.se.m==='original'&&u.se.vs==='article'&&u.se.reg===null&&u.se.per===null,'上位パーティの登録＝実戦データ・そのままの型・確認の状態つき（レギュレーションは推し量らない）',u.se);
ok(u.pk.c==='external'&&u.pk.m==='aggregated'&&u.pk.g==='showdown'&&u.pk.per===u.meta.month+'（月の集計）'&&u.pk.n===u.meta.battles&&u.pk.lb===u.meta.label&&u.pk.reg===null,'PokéKit＝外部の参考・組み合わせ（月・対戦数・形式名は提供元の値、レギュレーションとは書かない）',u.pk);
ok(u.pk.lim.some(x=>/Showdown/.test(x)&&/チャンピオンズの集計ではない/.test(x))&&u.pk.lim.some(x=>/能力ポイントは仮定/.test(x)),'PokéKit の限界（ゲームの集計ではない・能力ポイントは仮定）',u.pk.lim);
ok(u.su.c==='user'&&u.su.m==='aggregated'&&u.su.n===12&&u.su.lim.some(x=>/利用者だけ/.test(x)),'当サイトの利用者の集計＝利用者のデータ・組み合わせ（ランクバトルの集計とは別）',u.su);
ok(u.ca.c==='theory'&&u.ca.m==='theoretical'&&u.ca.vs===null&&u.ca.lim.some(x=>/実際に使われた型ではない/.test(x)),'当サイトの計算＝理論上の型（確認の状態は付かない）',u.ca);
ok(u.us.c==='user'&&u.us.m==='original'&&u.im.c==='user'&&u.im.m==='original','あなたの育成・画像から取り込み＝利用者のデータ・そのままの型');
ok(u.bad===null&&u.badvs.vs===null&&u.noAt.at===null,'知らない出典・決まりにない確認の状態・数でない時刻は使わない');
ok(!('pct' in u.save)&&!('reg' in u.save)&&!('per' in u.save)&&!('n' in u.save)&&u.save.s==='cbd'&&u.save.c==='observed','保存する形：項目ごとの割合は外す（ランクバトルの集計の値を残さない）',u.save);
ok(u.saveSe.vs==='article'&&u.saveSe.id==='season-team:5','保存する形：確認の状態・元の記録の番号は残す',u.saveSe);
ok(u.saveFrom.from&&u.saveFrom.from.s==='pokekit'&&!u.saveFrom.from.from,'from は最初の出どころ（変えた型をさらに変えても、元の PokéKit の型を指す。直前の版ではない）・1段だけ（重ねない）',u.saveFrom);
ok(u.chain.u1.from.s==='season'&&u.chain.c1.s==='calc'&&u.chain.c1.from.s==='season'&&u.chain.c1.from.vs==='article'&&u.chain.u2.from.s==='season'&&!u.chain.u2.from.from,'上位パーティ→手で変える→改善案→手で変える：どの段でも from は最初の出どころ（上位パーティ・記事から）のまま',u.chain);
ok(u.len<400,'保存する形は短い（パーティの保存は3万文字まで）',u.len);
ok(u.legacy[0]===null&&u.legacy[1].s==='import'&&u.legacy[2]===null&&u.legacy[3]===null&&u.legacy[4]===null,'古い型：取り込み（src:import は取り込みだけが書く）は分かる。manual（育成の画面と改善案の両方が書く）・copy・src なしは出どころ不明（推し量らない）',u.legacy);
ok(u.legacy[5].c==='external'&&u.legacy[5].m==='aggregated'&&!u.legacy[5].pct,'保存されていた出どころの分類・作られ方は、出典から決め直す（書きかえられていても）',u.legacy[5]);
ok(/^出どころ不明/.test(u.label[0])&&/実戦データ・登録されたそのままの型・.*記事から集めた/.test(u.label[1])&&/外部の参考（Showdown）・項目ごとの集計を組み合わせた型/.test(u.label[2]),'1行の説明',u.label);
ok(u.vsMap.join()==='confirmed,confirmed,confirmed,article,self','上位パーティの確認の状態（運営者が確認／記事から／本人の申告）',u.vsMap);

/* ---- 2. 型を作る所に付く ---- */
const c=await pg.evaluate(()=>{
  const g=monGuide(byNo[445],{parts:true});
  const ar=archSets(['axis'],[byNo[445],byNo[149],byNo[887]]);
  const row=MVP_DATA.sets.single.rows.find(r=>byNo[r.num]&&mvpSet('single',r.num,{used:new Set()}).st==='ok');
  const ms=row?mvpSet('single',row.num,{used:new Set()}):null;
  const tpl={s:'シーズンX',r:3,ver:true,id:77};
  const given={mv:[{id:89,n:'じしん'},{id:200,n:'げきりん'}],ab:{k:'rough-skin',n:'さめはだ'},it:null,sp:[2,32,0,0,0,32],up:1,dn:3};
  const k1=kdMakeSet(byNo[445],null,null,['axis'],new Set(),{given,givenTxt:'x',givenProv:mkProv({s:'season',f:FMT,vs:provSeasonVs(tpl),id:'season-team:77',lb:tpl.s})});
  const k2=kdMakeSet(byNo[445],null,null,['axis'],new Set(),{});
  const noData=P.find(q=>!q.base&&!MVP_DATA.sets[FMT].rows.some(r=>r.num===q.no)&&LSD[q.no]);
  const k3=noData?kdMakeSet(noData,null,null,['axis'],new Set(),{}):null;
  const sw=dgSwapSet(byNo[149],[]);
  return{gs:g.sets.map(s=>[s.fmt,s.prov&&s.prov.s,s.prov&&s.prov.c,s.prov&&s.prov.f,!!s.live,!!s.usage]),
    ar:ar.map(s=>s&&s.prov&&[s.prov.s,s.prov.c]),ts:toSaved(ar[0]),
    ms:ms&&{prov:ms.sv.prov,src:ms.sv.src,row:ms.row,pct:ms.pct},k1:[k1.src,k1.prov],k2:[k2.src,k2.prov&&k2.prov.s,k2.prov&&k2.prov.c],k3:k3&&[k3.src,k3.prov&&k3.prov.s],
    sw:sw&&sw.sv?[sw.sv.src,sw.sv.prov]:sw}});
ok(c.gs.length&&c.gs.every(([f,s,cc,pf,live,us])=>s&&pf===f&&(live?s==='cbd'&&cc==='observed':us?s==='site_usage'&&cc==='user':s==='calc'&&cc==='theory')),'図鑑の型：どの型にも出どころ（形式つき）。集計の型・利用者の集計・計算を分ける',c.gs);
ok(!c.gs.some(x=>x[4]),'ランクバトルの集計は休止中なので、集計を組み合わせた型は作らない',c.gs);
ok(c.ar.every(x=>x&&x[0]==='calc'&&x[1]==='theory')&&c.ts.prov&&c.ts.prov.s==='calc'&&!c.ts.prov.pct,'理論の型（archSets）は当サイトの計算。保存する形（toSaved）にも引きつぐ',[c.ar,c.ts&&c.ts.prov]);
ok(c.ms&&c.ms.prov.s==='pokekit'&&c.ms.prov.c==='external'&&c.ms.src==='copy','PokéKit の型（mvpSet）：外部の参考。src は copy のまま',c.ms);
ok(c.ms&&!c.ms.prov.pct&&c.ms.pct&&c.ms.pct.ab===c.ms.row.ab&&c.ms.pct.it===c.ms.row.it&&Array.isArray(c.ms.pct.mv),'PokéKit の型：パーティに入る形（sv）には割合を入れず、項目ごとの割合は別に持つ（提供元の値）',c.ms);
ok(c.k1[0]==='top'&&c.k1[1].s==='season'&&c.k1[1].vs==='confirmed'&&c.k1[1].id==='season-team:77'&&c.k1[1].lb==='シーズンX','こだわり条件：上位パーティに登録された型は、その記録の確認の状態つき',c.k1);
ok(c.k2[0]==='data'?c.k2[1]==='pokekit'&&c.k2[2]==='external':c.k2[1]==='calc','こだわり条件：PokéKit の型は外部の参考（無ければ理論）',c.k2);
ok(!c.k3||(c.k3[0]==='theory'&&c.k3[1]==='calc'),'こだわり条件：データの無い匹は理論上の型',c.k3);
ok(Array.isArray(c.sw)&&c.sw[0]==='copy'&&c.sw[1]&&['pokekit','calc'].includes(c.sw[1].s)&&!c.sw[1].pct,'入れかえ案の型（dgSwapSet）：src は copy のまま・出どころは PokéKit か計算（割合は入れない）',c.sw);

/* ---- 3. パーティに入れて保存・読み直す ---- */
await pg.evaluate(async()=>{team=[];saveTeam();
  const t={verified:false,auto:true,id:9};
  await useTeam('テスト',[{no:445,set:{ab:{k:'rough-skin'},it:{k:'focussash'},mv:[{id:89},{id:200}],sp:[2,32,0,0,0,32],up:1,dn:3},prov:mkProv({s:'season',f:'single',vs:provSeasonVs(t),id:'season-team:9',lb:'S1'})},
    {no:149,set:{ab:{k:'multiscale'},mv:[{id:89},{id:200}],sp:[2,32,0,0,0,32],up:1,dn:3,prov:{s:'pokekit',pct:{ab:1},c:'theory'}}},
    {no:887,set:{ab:null,mv:[{id:89}],sp:[2,32,0,0,0,32],up:1,dn:3}}])});
await pg.waitForTimeout(400);
const t1=await pg.evaluate(()=>team.map(x=>x.set&&{src:x.set.src,prov:x.set.prov||null}));
ok(t1[0].src==='copy'&&t1[0].prov.s==='season'&&t1[0].prov.vs==='article'&&t1[0].prov.id==='season-team:9','上位パーティを入れる：src は copy、出どころ（記事から集めた）を残す',t1[0]);
ok(t1[1].src==='copy'&&t1[1].prov.s==='pokekit'&&t1[1].prov.c==='external'&&!t1[1].prov.pct,'型の中の出どころも引きつぐ（分類は出典から決め直し、割合は落とす）',t1[1]);
ok(t1[2].src==='copy'&&t1[2].prov===null,'出どころの分からない型には付けない（推し量らない）',t1[2]);
/* 図鑑からパーティへ（いまの受け渡しのまま、出どころが付くことだけ確かめる。受け渡しの直しは次の段階） */
await pg.evaluate(async()=>{team=team.slice(0,2);saveTeam();const g=monGuide(byNo[887],{parts:true});await dpToParty(byNo[887],g.sets[0])});
await pg.waitForTimeout(300);
const t2=await pg.evaluate(()=>{const x=team.find(y=>y.no===887);return x&&x.set&&{src:x.set.src,prov:x.set.prov}});
ok(t2&&t2.src==='copy'&&t2.prov&&t2.prov.s==='calc'&&t2.prov.f==='single','図鑑の型をパーティに入れる：出どころ（計算）が付く・src は copy のまま',t2);
/* 育成の編集：変えると「あなたの育成」、元の出どころは from に */
await pg.evaluate(()=>{location.hash='#/edit/0'});await pg.waitForTimeout(900);
await pg.evaluate(()=>{const s=document.querySelector('#ed-nat [data-nat]:not([aria-pressed="true"])')||document.querySelector('[data-nat]');s&&s.click()});await pg.waitForTimeout(500);
const t3=await pg.evaluate(()=>team[0].set&&{src:team[0].set.src,prov:team[0].set.prov});
ok(t3&&t3.src==='manual'&&t3.prov&&t3.prov.s==='user'&&t3.prov.c==='user'&&t3.prov.from&&t3.prov.from.s==='season'&&t3.prov.from.vs==='article','育成を変える：あなたの育成になり、元にした上位パーティの出どころを from に残す',t3);
/* 読み直しても残る（端末の保存） */
await pg.reload();await pg.waitForTimeout(1200);
const t4=await pg.evaluate(()=>({t:team.map(x=>x.set&&x.set.prov&&x.set.prov.s),raw:localStorage.getItem('pcteams').length,big:(()=>{const s=JSON.parse(localStorage.getItem('pcteams'));return JSON.stringify(s).includes('pct')})()}));
ok(t4.t[0]==='user'&&t4.t[1]==='pokekit'&&t4.t.includes('calc'),'読み直しても出どころが残る',t4.t);
ok(!t4.big,'端末に保存したパーティに、項目ごとの割合は入っていない');
/* 画像から取り込み */
const t5=await pg.evaluate(()=>{IM={slots:[{pos:0,no:445,ab:{n:'さめはだ',k:'rough-skin'},mv:[{n:'じしん',id:89}]}],kinds:[]};IMPORT_NEXT=null;imSave();return team[0].set&&{src:team[0].set.src,prov:team[0].set.prov}});
ok(t5&&t5.src==='import'&&t5.prov&&t5.prov.s==='import'&&t5.prov.c==='user'&&Number.isFinite(t5.prov.at),'画像から取り込み：あなたの育成（取り込み）',t5);
/* 3枠×6匹に出どころ（from つき）を入れても保存の上限より小さい */
const sz=await pg.evaluate(()=>{const s={ab:{k:'rough-skin',n:'さめはだ'},it:{k:'focussash',n:'きあいのタスキ'},mv:[89,200,444,14].map(id=>({id,n:mName(id)})),sp:[2,32,0,0,0,32],up:1,dn:3,src:'manual',
  prov:provForSave(mkProv({s:'user',from:mkProv({s:'season',f:'single',vs:'article',id:'season-team:123456',lb:'シーズン M-C 第1期（2026年9月〜12月）'})}))};
  return JSON.stringify({cur:0,list:[0,1,2].map(i=>({name:'パーティ名パーティ名パーティ名パーテ',team:Array.from({length:6},(_,k)=>({no:445,sel:k<3,set:s})),at:Date.now()}))}).length});
ok(sz<30000,'3枠×6匹すべてに出どころがあっても、サーバーの保存の上限（3万文字）より小さい',sz);
ok(!errs.length,'エラーなし',errs);
await b.close();
console.log(process.exitCode?'prov: NG':`prov: OK（${n}項目）`);
