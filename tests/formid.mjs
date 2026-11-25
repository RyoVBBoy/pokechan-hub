// 姿の決め方と名前（2026/11/20 データの正しさの直し 段階1）：02-data.js の resolveForm・learnBase、15-battle.js の chooseSet・mkMon、
// 47-share.js の monCounters、59-break.js の breakSteps・breakHTML・brWhy、39-guide-mons.js のメガの型の説明、41-seasons.js の useTeam
// ①(番号,持ち物)→姿が1つに決まる。決められないときは計算しない（持ち物が合わない＝invalid-item／データが足りない＝insufficient-data）
// ②ニャオニクスは番号で分かれる ③メガ82姿の型は元の姿の技＋メガの特性＋そのストーン（仮の技「〇〇わざ」を作らない）
// ④メガの特性の無効が対策の計算に入る ⑤対策の文の名前は計算した姿の名前 ⑥メガの型の説明が「。」で始まらない
// ⑦共有リンクのメガの番号は元の姿＋ストーンで入る ⑧型の出どころの札（1人が実際に使った型ではない）
// ⑨使用率の集計の形の「作った見本」（架空の割合。championsbattledata の生のデータは使わない）で、メガストーンを持つ元の姿の型：
//   対象の姿＝計算した姿と書く、相手役の行の名前＝計算した姿、同じ姿の行は1回
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const pg=await (await b.newContext({locale:'ja-JP',viewport:{width:390,height:844}})).newPage();
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.route(/^https?:/,r=>r.abort());
await pg.goto('file://'+path.join(ROOT,'dist/index.html')+'#/calc');await pg.waitForSelector('#c-swap');await pg.waitForTimeout(300);
let n=0,bad=0;const ok=(c,m)=>{n++;if(!c){bad++;console.error('NG',m)}};

const R=await pg.evaluate(async()=>{
  const o={};
  /* ① 264姿×（持ち物なし・自分のストーン・ほかの種族のストーン） */
  const stones=Object.keys(MEGA);let mis=[];
  P.forEach(p=>{
    const r0=resolveForm(p.no,null);if(!r0.ok||r0.form!==p||r0.mega)mis.push([p.no,'none']);
    const r1=resolveForm(p.no,'leftovers');if(!r1.ok||r1.form!==p)mis.push([p.no,'item']);
    stones.forEach(k=>{const r=resolveForm(p.no,k),m=megaOf(p.no,k);
      if(m){if(!r.ok||r.form!==m||r.base!==p||r.stone!==k)mis.push([p.no,k])}
      else if(r.ok||r.why!=='invalid-item')mis.push([p.no,k,'other'])});
  });
  o.mis=mis.slice(0,5);o.misN=mis.length;
  o.unknown=resolveForm(99999,null).why;
  o.megaNull=MEGAP.filter(m=>{const r=resolveForm(m.no,null);return !(r.ok&&r.form===m&&r.base===byNo[m.base]&&r.stone===m.stone)}).length;
  o.megaOwn=MEGAP.filter(m=>{const r=resolveForm(m.no,m.stone);return !(r.ok&&r.form===m)}).length;
  o.megaOther=resolveForm(10309,'leftovers').why;
  o.megaOtherStone=resolveForm(10309,'garchompite').why;
  /* ② ニャオニクス */
  o.meow=[resolveForm(678,'meowsticite').form.no,resolveForm(10025,'meowsticite').form.no];
  /* mkMon：合わない持ち物は理由を残す（計算の結果を出す画面が止める）。合う持ち物は前と同じ姿 */
  o.mkBad=mkMon(byNo[445],'op',{ab:'roughskin',item:'charizarditex',moves:[]}).formErr;
  const mz=mkMon(byNo[445],'op',{ab:'roughskin',item:'garchompitez',moves:[]});o.mkOk=[mz.p.no,mz.ab,mz.formErr];
  const mm=mkMon(byNo[10309],'op',{ab:'roughskin',item:null,moves:[]});o.mkMega=[mm.p.no,mm.ab,mm.formErr];
  /* ③ メガ82姿の型 */
  const ph=[],abx=[],itx=[],few=[];
  MEGAP.forEach(m=>{const s=detSet(m);if(!s){ph.push(m.no);return}
    if(s.moves.some(x=>x.id===-1||/わざ$/.test(x.n||'')))ph.push(m.no);
    if(s.ab!==m.ab)abx.push(m.no);if(s.item!==m.stone)itx.push(m.no);
    const ls=LSD[m.base][1];if(s.moves.filter(x=>x.id>0&&!x.prot).some(x=>!ls.includes(x.id)))few.push(m.no)});
  o.ph=ph;o.abx=abx;o.itx=itx;o.notLearn=few;
  /* ④ 特性の無効（ふゆう・ひらいしん・うなぎのぼり 等）が対策の対象の計算に入る */
  const best=(a,d)=>estHit(a,d);
  const id=k=>+Object.keys(MV).find(i=>mkey({id:+i})===k);
  const g=mkMon(byNo[445],'me',{ab:'roughskin',item:null,moves:[mvObj(id('earthquake'))]});
  const MZ=mkMon(byNo[10309],'op',detSet(byNo[10309]));
  o.eqMZ=bcalc(g,mvObj(id('earthquake')),MZ,{r:100}).dmg;
  /* うなぎのぼりの浮遊は参照の接地判定に含まれる。 */
  {const m=MEGAP.find(x=>x.n==='メガシビルドン');const T=mkMon(m,'op',detSet(m));o.immunEel=[T.ab,bcalc(g,mvObj(id('earthquake')),T,{r:100}).dmg]}
  o.immun=[['メガジュカイン','electric'],['メガマフォクシー','ground'],['メガチリーン','ground'],['メガガブリアスZ','ground']].map(([nm,ty])=>{
    const m=MEGAP.find(x=>x.n===nm);if(!m)return[nm,'none'];const T=mkMon(m,'op',detSet(m));
    const mv={electric:'thunderbolt',ground:'earthquake'}[ty];const A=mkMon(byNo[ty==='electric'?135:445],'me',{ab:null,item:null,moves:[mvObj(id(mv))]});
    return[nm,T.ab,bcalc(A,mvObj(id(mv)),T,{r:100}).dmg]});
  /* ⑤ 対策の画面 */
  const hz=breakHTML(byNo[10309]),hm=breakHTML(byNo[10226]||MEGAP.find(x=>x.n==='メガガブリアス'));
  o.hzName=(hz.match(/メガガブリアスZからは/g)||[]).length;
  o.hzBare=(hz.match(/。ガブリアスからは/g)||[]).length;
  o.hzZero=/最大0%/.test(hz);
  o.hzPh=/わざ[」で]/.test(hz)||/わざ・|わざ）/.test(hz);
  o.hzKind=hz.includes('1人が実際に使った型ではありません');
  o.hzItem=hz.includes('ガブリアスナイトZ');
  /* 82姿のすべてで：仮の技・元の名前だけの主語（〇〇からは）が無い */
  o.allBare=[];o.allPh=[];
  MEGAP.forEach(m=>{const h=breakHTML(m);const bn=formInfo(m).base;
    if(bn!==m.n&&h.includes('。'+bn+'からは'))o.allBare.push(m.n);
    if(/[^ぁ-ん]わざ[」で）・]/.test(h.replace(/<[^>]+>/g,'')))o.allPh.push(m.n)});
  /* F7：姿のデータが無いときは計算せず理由を出す（元の姿として計算しない） */
  const fake={...byNo[445],no:99999};
  o.refuseC=(()=>{try{monCounters(fake);return 'calc'}catch(e){return e.message}})();
  o.refuseH=breakHTML(fake);
  /* ⑩ moveUsable：失敗する技（フィールドなしのアイアンローラー・ゲップ・とっておき・いびき・きあいパンチ）は1対1・診断で使わない（本編の決まり＝前提） */
  const sr=mvObj(id('steelroller')),bl=mvObj(id('belch')),eq=mvObj(id('earthquake'));
  o.mu=[moveUsable(sr),moveUsable(bl),moveUsable(eq),moveUsable(mvObj(id('fakeout'))),moveUsable(mvObj(id('fakeout')),{turn:'later'})].map(x=>x.ok?'ok':x.why+'/'+x.mechanics);
  const sx=P.find(p=>p.n==='カビゴン'),tgt=mkMon(sx,'op',detSet(sx));
  const A1=mkMon(byNo[445],'me',{ab:null,item:null,moves:[sr,bl]});
  o.muEst=estHit(A1,tgt).pct;
  const A2=mkMon(byNo[445],'me',{ab:null,item:null,moves:[sr,eq]});
  o.muEst2=(estHit(A2,tgt).mv||{}).n;const bb=dgBest(A2,tgt);o.muBest=bb&&bb.mv?mkey(bb.mv):'none';
  /* ⑥ メガの型の説明 */
  o.dotStart=MEGAP.filter(m=>{try{const h=monGuide(m);return /(^|[>「])。持ち物は/.test(h)}catch(e){return false}}).map(m=>m.n);
  /* ⑦ 共有リンクのメガの番号（10309）→ 元の姿＋ストーン */
  team=[];await useTeam('テスト',[{no:10309},{no:445}]);
  o.share=team.map(x=>[x.no,x.set&&x.set.it&&x.set.it.k||null]);
  o.shareSet=(()=>{const x=team[0],s=savedToCalc(x.no,x.set);const M=mkMon(byNo[x.no],'me',s);return[M.p.no,M.moves.some(m=>m.id===-1)]})();
  team=[];
  /* ⑨ 作った見本：メガストーンを持つ元の姿の型（架空の割合） */
  const fx=`category,name,percentage,stat_up,stat_down,hp_points,attack_points,defense_points,sp_atk_points,sp_def_points,speed_points,column_position
ability,Rough Skin,90,,,,,,,,,1
held_item,Garchompite Z,60,,,,,,,,,
held_item,Choice Scarf,25,,,,,,,,,
move,Earthquake,95,,,,,,,,,
move,Dragon Claw,70,,,,,,,,,
move,Stone Edge,50,,,,,,,,,
move,Swords Dance,40,,,,,,,,,
stat_alignment,,40,atk,spa,,,,,,,
stat_points,,30,,,2,32,0,0,0,32,`;
  LIVE.csv[445]=digest(fx);
  const c=monCounters(byNo[445]);o.fxForm=c.form&&c.form.no;o.fxKind=c.kind&&c.kind.k;
  const bh=breakHTML(byNo[445]);o.fxNote=bh.includes('ガブリアスナイトZを持つ（メガガブリアスZの型）ので、ガブリアスは当サイトの提案の型で計算しています');
  o.fxBaseItem=c.set.item||null;
  /* RC2：メガのページは元の姿の集計の型（このストーン）を推定の型として使う */
  const cz=monCounters(byNo[10309]);o.fxMega=[cz.form.no,cz.kind.k,cz.set.item,cz.set.ab,!!cz.note];
  const ci=monCounters(byNo[10226]||MEGAP.find(x=>x.n==='メガガブリアス'));o.fxMegaOther=ci.kind.k;
  /* 型の画面：元の姿のページにメガストーンの型を「集計の型」として出さない */
  o.fxGuide=(()=>{try{const h=monGuide(byNo[445]);return /ガブリアスナイトZ/.test((h.match(/ランクバトルの集計から組み合わせた推定の型[\s\S]{0,1500}/)||[''])[0])}catch(e){return 'x'+e.message}})();
  /* 相手役：シルヴァディ等の対象で、行の名前＝計算した姿、同じ姿は1回 */
  const tg=byNo[700]||P.find(p=>p.n==='ニンフィア');const c2=monCounters(tg);const all=[...c2.ohko,...c2.strong,...c2.wall,...c2.threat];
  o.fxRowLabel=all.filter(r=>r.from&&r.from.no===445).map(r=>r.q.no);
  /* 全部の行で、名前の姿＝計算した姿（from を mkMon したときの姿） */
  o.fxLabelMis=all.filter(r=>{const q=r.from||r.q,set=q.base&&byNo[q.base]?{...detSet(byNo[q.base]),ab:q.ab,item:null}:detSet(q);return mkMon(q,'me',set).p.no!==r.q.no}).length;
  const nos=['ohko','strong','wall','threat'].map(k=>c2[k].map(r=>r.q.no));
  o.fxDup=nos.some(a=>new Set(a).size!==a.length);
  delete LIVE.csv[445];
  return o});

const R2=await pg.evaluate(async()=>{
  const o={};const id=k=>+Object.keys(MV).find(i=>mkey({id:+i})===k);
  /* ⑪ detSet：上位パーティの登録などに合わない持ち物が混ざっても使わない */
  const tsc=topSetCalc;topSetCalc=p=>p.no===445?{ab:'roughskin',item:'charizarditex',moves:[mvObj(id('earthquake'))]}:null;
  try{const i=detSetInfo(byNo[445]);o.detSkip=i.src+'/'+(i.skip[0]&&i.skip[0].why)}finally{topSetCalc=tsc}
  /* 選出（analyze）：こちらの型が合わない持ち物 */
  const bad={ab:'roughskin',item:'charizarditex',moves:[mvObj(id('earthquake'))]};
  const opp=[6,9,3,149,248,94].filter(n=>byNo[n]);
  try{const A=analyze([445,130,143,887].filter(n=>byNo[n]),opp,n=>n===445?bad:detSet(byNo[n]),null);o.an={fe:A.formErr&&A.formErr[0].no,ok:!A.none}}catch(e){o.an={x:e.message}}
  /* 診断（dgTeam） */
  const sv=team;team=[{no:445,set:{ab:{k:'roughskin',n:'さめはだ'},it:{k:'charizarditex',n:'x'},mv:[{id:id('earthquake'),n:'じしん'}],sp:null}},{no:143},{no:130}].filter(x=>byNo[x.no]);
  try{DG_CACHE&&DG_CACHE.clear&&DG_CACHE.clear()}catch(e){}
  try{const T=dgTeam(team,20);o.dg={fe:T.formErr&&T.formErr[0]&&T.formErr[0].no,m0:T.M[0],prem:dgPremise(T).includes('計算に入れていない匹')}}catch(e){o.dg={x:e.message}}
  /* ⑯ 改善案（62-improve.js）：合わない持ち物の匹がいれば改善案を出さず理由。部分的な計算し直し（impRecalc）も同じ決まりで外す */
  try{const R=dgImprove(team);o.imp={n:R.list.length,fe:R.formErr&&R.formErr[0]&&R.formErr[0].no,note:!!(R.note&&R.note.includes('持ち物がポケモンの姿と合わない'))}}catch(e){o.imp={x:e.message}}
  const good=[{no:445,set:{ab:{k:'roughskin',n:'さめはだ'},it:{k:'leftovers',n:'たべのこし'},mv:[{id:id('earthquake'),n:'じしん'}],sp:null}},{no:143},{no:130}].filter(x=>byNo[x.no]);
  team=good;try{DG_CACHE&&DG_CACHE.clear&&DG_CACHE.clear()}catch(e){}
  try{const T0=dgTeam0(good,20);const es=good.map((x,k)=>k===0?{...x,set:{...x.set,it:{k:'charizarditex',n:'x'}}}:x);
    const T1=impRecalc(es);o.rec={t0:(T0.formErr||[]).length,fe:T1.formErr&&T1.formErr[0]&&T1.formErr[0].no,m0:T1.M[0]};
    const Rg=dgImprove(good);o.impOk={fe:!!Rg.formErr,note:Rg.note||null,list:Array.isArray(Rg.list)}}catch(e){o.rec={x:e.message}}
  team=sv;
  /* ダメージ計算 */
  const ca={...CS.a};CS.a.no=445;CS.a.item='charizarditex';
  try{const R=calcResult();o.calc={nul:R===null,fe:CALC_FE&&CALC_FE[0].why}}catch(e){o.calc={x:e.message}}finally{CS.a=ca;CALC_FE=null}
  /* ⑫ 条件の文 */
  o.why={scarf:brWhy(byNo[445],{fast:true,scarf:true,my:120,their:30,mv:'x'},byNo[445],[]).includes('こだわりスカーフで先に動いて'),
    sash:brWhy(byNo[445],{fast:true,my:120,their:30,mv:'x'},byNo[445],['きあいのタスキ']).includes('きあいのタスキ'),
    tScarf:brWhy(byNo[445],{fast:false,tScarf:true,my:40,their:30},byNo[445],[]).includes('相手のこだわりスカーフ')};
  const fx=`category,name,percentage,stat_up,stat_down,hp_points,attack_points,defense_points,sp_atk_points,sp_def_points,speed_points,column_position
ability,Rough Skin,90,,,,,,,,,1
held_item,Focus Sash,60,,,,,,,,,
move,Earthquake,95,,,,,,,,,
move,Dragon Claw,70,,,,,,,,,
move,Stone Edge,50,,,,,,,,,
move,Fire Fang,40,,,,,,,,,
stat_alignment,,40,atk,spa,,,,,,,
stat_points,,30,,,2,32,0,0,0,32,`;
  LIVE.csv[445]=digest(fx);
  try{const c=monCounters(byNo[445]);o.fxSashT=c.tHold;const h=breakHTML(byNo[445]);o.fxSash=c.tHold.includes('きあいのタスキ')&&(c.ohko.length===0||h.includes('きあいのタスキを持つので、HPが満タンなら1回は耐えられる'))}finally{delete LIVE.csv[445]}
  /* ⑬ へんげんじざい */
  const gk=MEGAP.find(x=>x.ab==='protean');const hg=breakHTML(gk);
  o.prot={note:hg.includes('へんげんじざい・リベロは発動しない前提'),txt:!/技を出すたびに/.test(Object.values(BR_AB).join(''))};
  /* ⑭ 対策の画面（346姿）に「使用率の高い型」が無い */
  o.label=[...P,...MEGAP].filter(p=>breakHTML(p).includes('使用率の高い型')).map(p=>p.n);
  return o});
ok(R.misN===0,'①264姿×持ち物の姿 '+JSON.stringify(R.mis));
ok(R.unknown==='insufficient-data','①知らない番号は insufficient-data');
ok(R.megaNull===0&&R.megaOwn===0,'①メガの番号（持ち物なし・そのストーン）は読める（F8）');
ok(R.megaOther==='invalid-item'&&R.megaOtherStone==='invalid-item','①メガの番号にほかの持ち物は invalid-item');
ok(R.meow[0]===10314&&R.meow[1]===10326,'②ニャオニクス '+R.meow);
ok(R.mkBad==='invalid-item','mkMon：ほかの種族のストーンは formErr');
ok(R.mkOk[0]===10309&&R.mkOk[1]==='levitate'&&!R.mkOk[2],'mkMon：自分のストーン '+R.mkOk);
ok(R.mkMega[0]===10309&&R.mkMega[1]==='levitate'&&!R.mkMega[2],'mkMon：メガの番号 '+R.mkMega);
ok(R.ph.length===0,'③仮の技 '+R.ph);
ok(R.abx.length===0,'③特性＝メガの特性 '+R.abx);
ok(R.itx.length===0,'③持ち物＝そのメガストーン '+R.itx);
ok(R.notLearn.length===0,'③技は元の姿が覚える技 '+R.notLearn);
ok(R.eqMZ===0,'④メガガブリアスZにじしん＝0（ふゆう） '+R.eqMZ);
R.immun.forEach(([nm,ab,d])=>ok(d===0,`④${nm}（${ab}）の無効 ${d}`));
ok(R.immunEel[0]==='eelevate'&&R.immunEel[1]===0,'④メガシビルドン（うなぎのぼり）はじめん技が無効（参照の実装） '+R.immunEel);
ok(R.hzName>0&&R.hzBare===0,'⑤メガガブリアスZの対策の文の名前 '+R.hzName+'/'+R.hzBare);
ok(!R.hzPh,'⑤仮の技が文に無い');
ok(R.hzKind&&R.hzItem,'⑧型の出どころの札・持ち物');
ok(R.allBare.length===0,'⑤82姿：元の名前だけの主語 '+R.allBare);
ok(R.allPh.length===0,'⑤82姿：仮の技 '+R.allPh);
ok(R.refuseC==='form:insufficient-data'&&R.refuseH.includes('姿のデータが足りない'),'F7：計算しない・理由 '+R.refuseC);
ok(JSON.stringify(R.mu)===JSON.stringify(['fails-without-terrain/main-series-assumed','needs-condition/main-series-assumed','ok','ok','first-turn-only/main-series-assumed']),'⑩moveUsable '+R.mu);
ok(R.muEst===0,'⑩失敗する技だけなら 0% '+R.muEst);
ok(R.muEst2==='じしん'&&R.muBest==='earthquake','⑩最善の技にアイアンローラーを選ばない '+R.muEst2+' '+R.muBest);
ok(R.dotStart.length===0,'⑥「。」で始まる説明 '+R.dotStart);
ok(JSON.stringify(R.share)===JSON.stringify([[445,'garchompitez'],[445,null]]),'⑦共有リンクのメガの番号 '+JSON.stringify(R.share));
ok(R.shareSet[0]===10309&&!R.shareSet[1],'⑦入れたあと メガガブリアスZで計算・仮の技なし '+R.shareSet);
ok(R.fxForm===445&&R.fxKind==='theory'&&!R.fxBaseItem,'⑨RC2：元の姿のページは元の姿で計算（メガストーンの型を使わない） '+R.fxForm+' '+R.fxKind+' '+R.fxBaseItem);
ok(R.fxNote,'⑨RC2：理由を書く');
ok(R.fxMega[0]===10309&&R.fxMega[1]==='synthetic'&&R.fxMega[2]==='garchompitez'&&R.fxMega[3]==='levitate'&&R.fxMega[4],'⑨RC2：メガZのページは集計の型（このストーン） '+R.fxMega);
ok(R.fxMegaOther==='theory','⑨RC2：ほかのストーンのメガは提案の型 '+R.fxMegaOther);
ok(R.fxGuide===false,'⑨RC2：型の画面に元の姿の集計の型としてメガストーンを出さない '+R.fxGuide);
ok(R.fxRowLabel.every(x=>x===10309),'⑨見本：相手役の行の名前＝計算した姿 '+R.fxRowLabel);
ok(R.fxLabelMis===0,'⑨見本：全部の行で名前＝計算した姿 '+R.fxLabelMis);
ok(!R.fxDup,'⑨見本：同じ姿の行は1回');
ok(R2.detSkip==='theory/invalid-item','⑪detSet：合わない持ち物の型を使わず次へ '+R2.detSkip);
ok(R2.an&&R2.an.fe===445&&R2.an.ok,'⑪選出：合わない型は計算から外して知らせる '+JSON.stringify(R2.an));
ok(R2.dg&&R2.dg.fe===445&&R2.dg.m0===null&&R2.dg.prem,'⑪診断：外して前提に書く '+JSON.stringify(R2.dg));
ok(R2.imp&&R2.imp.n===0&&R2.imp.fe===445&&R2.imp.note,'⑯改善案：合わない持ち物の匹がいれば出さず理由 '+JSON.stringify(R2.imp));
ok(R2.rec&&R2.rec.t0===0&&R2.rec.fe===445&&R2.rec.m0===null,'⑯impRecalc：変えたあと合わない匹は外す '+JSON.stringify(R2.rec));
ok(R2.impOk&&!R2.impOk.fe&&!R2.impOk.note&&R2.impOk.list,'⑯改善案：合うパーティは今までどおり '+JSON.stringify(R2.impOk));
ok(R2.calc&&R2.calc.nul&&R2.calc.fe==='invalid-item','⑪ダメージ計算：計算せず理由 '+JSON.stringify(R2.calc));
ok(R2.why.scarf&&R2.why.sash&&R2.why.tScarf,'⑫条件：スカーフ・タスキを行に書く '+JSON.stringify(R2.why));
ok(R2.fxSash,'⑫条件：対象がタスキの型なら一撃の行に書く');
ok(R2.prot.note&&R2.prot.txt,'⑬へんげんじざい：前提を書く・文の食い違いなし '+JSON.stringify(R2.prot));
ok(R2.label.length===0,'⑭「使用率の高い型」と書いた対策の画面 '+R2.label.slice(0,3));
ok(errs.length===0,'ページのエラー '+errs.join(' / '));
/* ⑮ サーバー（worker）もサイトと同じ：姿の決め方・合わない持ち物の型を選出の計算から外す（worker/dist/worker.js の関数を一時ファイルで取り出して確かめる） */
{const fs=await import('node:fs'),os=await import('node:os');
 const src=fs.readFileSync(path.join(ROOT,'worker/dist/worker.js'),'utf8').replace(/export default\s*\{/,'const __def={')+'\nexport {resolveForm,mkMon,analyze,byNo,mvObj,MV,mkey};';
 const tmp=path.join(os.tmpdir(),'formid-worker-'+process.pid+'.mjs');fs.writeFileSync(tmp,src);
 try{const W=await import(tmp);const id=k=>+Object.keys(W.MV).find(i=>W.mkey({id:+i})===k);
  ok(W.resolveForm(445,'charizarditex').why==='invalid-item'&&W.resolveForm(10309,null).base.no===445,'⑮サーバーの resolveForm');
  const m=W.mkMon(W.byNo[445],'me',{ab:'roughskin',item:'garchompitez',moves:[]});ok(m.p.no===10309&&!m.formErr,'⑮サーバーの mkMon（メガ）');
  ok(W.mkMon(W.byNo[445],'me',{ab:'roughskin',item:'charizarditex',moves:[]}).formErr==='invalid-item','⑮サーバーの mkMon（合わない持ち物）');
  const bad={ab:'roughskin',item:'charizarditex',moves:[W.mvObj(id('earthquake'))]};const ok6=n=>({ab:null,item:null,moves:[W.mvObj(id('earthquake'))]});
  const A=W.analyze([445,143,130],[6,9,3],n=>n===445?bad:ok6(n),n=>ok6(n));ok(A&&A.formErr&&A.formErr[0].no===445,'⑮サーバーの選出も外す');
 }catch(e){ok(false,'⑮サーバー '+e.message)}finally{fs.unlinkSync(tmp)}}
await b.close();
console.log(
`姿の決め方：${n-bad}/${n} 合格`);
if(bad)process.exit(1);
