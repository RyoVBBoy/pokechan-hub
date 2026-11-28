/* 図鑑のページの6つのタブ（2026/11/15 79-dexpage.js）：前の7つ（種族値・解説・実数値・弱点・対策・技・特性）の中身がどこかに残る・姿ごとのデータ・
   型の出典の札・シングル/ダブル・パーティに入れるときは置きかえを確かめる・390/320px ではみ出さない */
import {chromium} from 'playwright';
import {fileURLToPath} from 'url';import path from 'path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
let fail=0,n=0;const ok=(c,m)=>{n++;if(!c){fail++;console.log('  NG',m)}};
const ctx=await b.newContext({locale:'ja-JP',viewport:{width:390,height:844},colorScheme:'dark'});const pg=await ctx.newPage();
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.route(/^https?:/,r=>r.abort());await pg.goto('file://'+root+'/dist/index.html');await pg.waitForTimeout(600);
const open=async no=>{await pg.evaluate(n=>{location.hash='#/p/'+n},String(no));await pg.waitForTimeout(500)};
const tab=async i=>{await pg.click(`#seg [data-i="${i}"]`);await pg.waitForTimeout(i===4||i===0?900:350)};
/* 1枚の姿・メガのある姿・タイプが変わるメガ・特性が変わるメガ（リザードン）・戦闘中に姿が変わる（ギルガルド）・天気（ペリッパー・イダイトウ） */
const SAMPLE=[445,10058,10309,6,681,279,902,130];
for(const no of SAMPLE){
  await open(no);
  const labels=await pg.$$eval('#seg button',x=>x.map(e=>e.textContent).join(','));
  ok(labels==='概要,能力,相性,技・特性,型・育成,対策',no+' タブは6つ '+labels);
  for(let i=0;i<6;i++){await tab(i);
    const r=await pg.evaluate(i=>{const el=document.querySelector(`[data-panel="${i}"]`);const t=el.innerText;return{len:t.length,bad:/undefined|NaN|\[object/.test(t),over:document.body.scrollWidth>innerWidth+1,clip:[...document.querySelectorAll('#seg button')].some(b=>b.scrollWidth>b.clientWidth+1)}},i);
    ok(r.len>80&&!r.bad&&!r.over&&!r.clip,`${no} タブ${i}：中身がある・undefined なし・はみ出さない ${JSON.stringify(r)}`)}
}
/* 前の7つの中身がどこにあるか */
await open(445);
await tab(1);const S=await pg.evaluate(()=>({stat:[...document.querySelectorAll('[data-panel="1"] .stat b')].map(b=>+b.textContent).join(),p:byNo[445].s.join(),radar:!!document.querySelector('[data-panel="1"] .radarbox'),sp:!!document.getElementById('sp0'),cond:/レベル50/.test(document.querySelector('.dp-cond').textContent),spd:document.getElementById('spd-note').textContent,rk:/メガシンカの姿は入れていない/.test(document.querySelector('[data-panel="1"]').textContent)}));
ok(S.stat===S.p&&S.radar&&S.sp&&S.cond&&/位/.test(S.spd)&&S.rk,'能力＝種族値と実数値（条件と素早さの順位の比べ方つき） '+JSON.stringify(S));
await tab(2);const M=await pg.evaluate(()=>({t:document.querySelector('[data-panel="2"]').innerText}));
ok(/大弱点/.test(M.t)&&/こおり/.test(M.t)&&/攻めるとき/.test(M.t)&&/タイプ相性だけの目安/.test(M.t),'相性＝受けるとき（4倍の弱点）と攻めるとき・タイプ相性だけと書く');
await tab(3);ok(await pg.$$eval('#mvpanel .mvr',x=>x.length)>=40&&/技の入れかえ候補/.test(await pg.evaluate(()=>document.querySelector('[data-panel="3"]').innerText)),'技・特性＝覚える技の一覧・入れかえ候補');
const RP=await pg.evaluate(()=>[...document.querySelectorAll('.dp-rp')].map(e=>e.innerText).slice(0,2));
ok(RP.length&&RP.every(t=>/良くなること/.test(t)&&/失うこと/.test(t)),'入れかえ候補に良くなること・失うこと');
await tab(5);ok(await pg.$$eval('#brpanel .row',x=>x.length)>=3&&/上から一撃/.test(await pg.evaluate(()=>document.querySelector('[data-panel="5"]').innerText)),'対策＝崩し方と場面ごとの相手（理由つき）');
await tab(0);const O=await pg.evaluate(()=>document.querySelector('[data-panel="0"]').textContent);
ok(/物理アタッカーとして使いやすい/.test(O)&&!/積んで勝負を決める役として使いやすい/.test(O)&&/型によっては/.test(O),'概要：積み技のない型まで積む役とは書かない '+O.split('\n')[2]);
ok(/ほかの姿/.test(O)&&/メガ Z/.test(O),'概要：ほかの姿の違い');
/* 姿ごとのデータ：メガガブリアスZはドラゴンだけ（こおり4倍ではない）・タイプ一致はドラゴン */
await open(10309);await tab(2);const Z=await pg.evaluate(()=>document.querySelector('[data-panel="2"]').innerText);
ok(!/大弱点/.test(Z)&&/タイプ一致技（\s*ドラゴン）/.test(Z.replace(/\n/g,'')),'メガガブリアスZの相性はその姿のタイプで');
await tab(1);const ZS=await pg.evaluate(()=>[...document.querySelectorAll('[data-panel="1"] .stat b')].map(b=>+b.textContent).join()===byNo[10309].s.join());
ok(ZS,'メガガブリアスZの種族値はその姿の値');
await tab(0);ok(/メガシンカで変わるところ/.test(await pg.evaluate(()=>document.querySelector('[data-panel="0"]').innerText)),'メガの姿の概要にメガシンカで変わるところ');
/* 型・育成：出典の札・シングルとダブルを分ける */
await open(445);await tab(4);
const B1=await pg.evaluate(()=>({n:document.querySelectorAll('#bdpanel .gset').length,meta:[...document.querySelectorAll('#bdpanel .gset')].every(g=>g.querySelector('.gset-meta .gsm-v')),f:[...document.querySelectorAll('#bdpanel .gsm-f')].map(e=>e.textContent),sec:[...document.querySelectorAll('#bdpanel .dp-bsec>h3')].map(h=>h.textContent)}));
ok(B1.n>=1&&B1.meta&&B1.f.every(x=>x==='シングル')&&/実際の使用データ/.test(B1.sec[0])&&/計算で組んだ提案/.test(B1.sec[1])&&/自分で組む/.test(B1.sec[2]),'型：3つに分け、出典の札、シングルだけ '+JSON.stringify(B1));
await pg.click('[data-dpf="double"]');await pg.waitForTimeout(300);
const B2=await pg.evaluate(()=>[...document.querySelectorAll('#bdpanel .gsm-f')].map(e=>e.textContent));
ok(B2.length&&B2.every(x=>x==='ダブル'),'ダブルに切りかえるとダブルの型だけ '+B2.join());
await pg.click('[data-dpf="single"]');await pg.waitForTimeout(300);
/* パーティに入れる：同じポケモンの育成があれば確かめる（キャンセルで変わらない）・6匹なら入れない */
await pg.evaluate(()=>{const N=s=>P.find(x=>x.n===s).no;team.length=0;team.push({no:445,sel:true,set:{it:{k:'focussash',n:'x'},mv:[],ab:null,sp:null,up:-1,dn:-1}});saveTeam()});
await pg.click('#bdpanel [data-useset]');await pg.waitForSelector('.xc.on .xc-no');await pg.click('.xc-no');await pg.waitForTimeout(250);
ok(await pg.evaluate(()=>team[0].set.it.k==='focussash'),'置きかえはキャンセルできる');
await pg.click('#bdpanel [data-useset]');await pg.waitForSelector('.xc.on .xc-ok');await pg.click('.xc-ok');await pg.waitForTimeout(250);
const U=await pg.evaluate(()=>({it:team[0].set.it.k,mv:team[0].set.mv.length,src:team[0].set.src,len:team.length}));
ok(U.it!=='focussash'&&U.mv>=2&&U.src==='copy'&&U.len===1,'確かめてから型に置きかえる '+JSON.stringify(U));
await pg.evaluate(()=>{team.length=0;[3,6,9,25,130,149].forEach(no=>team.push({no,sel:false}));saveTeam()});
await pg.click('#bdpanel [data-useset]');await pg.waitForTimeout(300);
ok(await pg.evaluate(()=>team.length===6&&!team.some(x=>x.no===445)),'6匹そろっていれば入れない（黙って入れかえない）');
/* 対策を見る（#/p/番号/break）は対策タブで開く */
await pg.evaluate(()=>{location.hash='#/p/445/break'});await pg.waitForTimeout(700);
ok(await pg.evaluate(()=>document.querySelector('#seg [aria-selected="true"]').dataset.i)==='5','#/p/番号/break は対策タブ');
/* 320px でもタブの文字が切れない */
await pg.setViewportSize({width:320,height:700});await open(445);
ok(await pg.evaluate(()=>![...document.querySelectorAll('#seg button')].some(b=>b.scrollWidth>b.clientWidth+1)&&document.body.scrollWidth<=innerWidth+1),'320px でタブの文字が切れない');
/* 2026/11/15 依頼主の指摘：メガの姿の文に持ち物（きあいのタスキ等）を勧めない・「〇〇タイプため」の文の誤り・強いメガはアタッカーが中心 */
const MG=await pg.evaluate(()=>{const names=Object.entries(ITEMN).filter(([k])=>!MEGA[k]).map(([,n])=>n).filter(Boolean),bad=[],gram=[];
  [...P,...MEGAP].forEach(p=>{const g=monGuide(p,{parts:true}),t=[g.lead,...g.pros.map(x=>x[0]+x[1]),...g.cons.map(x=>x[0]+x[1]),...g.roles.map(r=>r.name+r.text)].join('｜').replace(/<[^>]+>/g,'');
    if(p.base&&names.some(n=>t.includes(n)))bad.push(p.n);if(/タイプため/.test(t))gram.push(p.n)});
  const az=MEGAP.find(m=>m.n==='メガアブソルZ');return{bad,gram,az:az?monGuide(az,{parts:true}).lead:''}});
ok(!MG.bad.length,'メガの姿の文に持ち物の名前を出さない '+MG.bad.join(','));
ok(!MG.gram.length,'「タイプため」の文の誤りがない '+MG.gram.slice(0,3).join(','));
ok(/物理アタッカー/.test(MG.az)&&!/起点作りとして使いやすい/.test(MG.az),'メガアブソルZ のひとことはアタッカー '+MG.az);
/* 姿が変わるポケモンの切りかえは、メガの切りかえと同じ上の場所に */
await pg.setViewportSize({width:390,height:844});await open(681);
const FS=await pg.evaluate(()=>{const sw=document.getElementById('bsw');return{top:!!sw&&!!sw.closest('.dp-fsw')&&!sw.closest('[data-panel]'),d:document.querySelector('.dp-fsw .bsw-d')?.textContent||''}});
ok(FS.top&&/ブレードフォルムになると/.test(FS.d)&&/攻撃 50→140/.test(FS.d),'ギルガルドの切りかえは上の場所・変わる能力を書く '+FS.d);
/* パーティのチェック：押したらすぐ「計算しています」を出してから計算する */
await pg.evaluate(()=>{team.length=0;[445,6,130,279,902,681].forEach(no=>team.push({no,sel:false}));saveTeam();TTAB='sets';try{sessionStorage.setItem('pcttab','sets')}catch(e){}location.hash='#/team'});await pg.waitForTimeout(900);
const LD=await pg.evaluate(async()=>{document.querySelector('[data-tt="check"]').click();const now=!!document.querySelector('#tout .tt-load');
  for(let i=0;i<200&&!document.querySelector('#tout #st-box');i++)await new Promise(r=>setTimeout(r,50));return{now,done:!!document.querySelector('#tout #st-box'),gone:!document.querySelector('#tout .tt-load')}});
ok(LD.now&&LD.done&&LD.gone,'チェックを押すとすぐ「計算しています」→中身に置きかわる '+JSON.stringify(LD));
/* 2026/11/16 依頼主に届いた報告：「12つ」の数え方・ギルガルドの火力をシールドフォルムで判定しない */
const BF=await pg.evaluate(()=>{const g=monGuide(byNo[681]),k=monGuide(byNo[964]);
  return{tsu:[...P,...MEGAP].filter(p=>{try{return /\d{2}つ/.test(monGuide(p))}catch(e){return false}}).map(p=>p.n),
    ag:[!/攻撃・特攻が控えめ|攻撃50・特攻50/.test(g),/攻撃140（ブレードフォルム）/.test(g),/12個/.test(g)],
    pf:[!/攻撃・特攻が控えめ/.test(k),/160（マイティフォルム）/.test(k)]}});
const FL=await pg.evaluate(()=>{const L=[445,10058,10309].map(n=>monGuide(byNo[n],{parts:true}).lead);
  const all=[...P,...MEGAP],fam={};all.forEach(p=>{const k=p.base||p.no;(fam[k]=fam[k]||[]).push(monGuide(p,{parts:true}).lead.replace(/^[^は]+は、/,''))});
  return{diff:new Set(L.map(t=>t.replace(/^[^は]+は、/,''))).size===3,mz:/特攻が80→141/.test(L[2])&&/ふゆう/.test(L[2]),m:/攻撃が130→170/.test(L[1]),
    dup:Object.entries(fam).filter(([k,a])=>a.length>1&&new Set(a).size<a.length).map(([k])=>byNo[k].n),bad:all.filter(p=>/上がり。/.test(monGuide(p,{parts:true}).lead)).map(p=>p.n)}});
ok(FL.diff&&FL.mz&&FL.m,'ガブリアス・メガ・メガZ の「どんなポケモン？」が姿ごとに違う '+JSON.stringify(FL));
ok(!FL.dup.length&&!FL.bad.length,'姿の違うページで同じ説明・文の終わりの誤り '+JSON.stringify(FL));
/* 姿の切りかえ：技・特性を見たあと概要に戻し、メガ→元の姿と切りかえても概要のまま */
/* 2026/11/17：GitHub の公開の機械では0.9秒で描き終わらないことがあった（#seg がまだ無い）。決まった時間ではなく、描き終わるまで待つ */
await pg.evaluate(()=>{location.hash='#/p/445'});await pg.waitForSelector('#seg [data-i="3"]');await pg.waitForSelector('.fam-pills a[href="#/p/10058"]');await pg.waitForTimeout(300);
const FSW=await pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms)),tab=()=>document.querySelector('#seg [aria-selected="true"]').dataset.i,out=[];
  document.querySelector('#seg [data-i="3"]').click();await w(300);document.querySelector('#seg [data-i="0"]').click();await w(300);
  for(const no of [10058,10309,445,10058,445]){const a=document.querySelector(`.fam-pills a[href="#/p/${no}"]`);if(!a){out.push('no'+no);continue}a.click();for(let k=0;k<60&&!(curNo===no&&document.querySelector('#seg [aria-selected="true"]'));k++)await w(100);await w(200);out.push(tab())}
  document.querySelector('#seg [data-i="3"]').click();await w(300);const a=document.querySelector('.fam-pills a[href="#/p/10058"]');a.click();await w(500);out.push(tab());return out});
ok(FSW.slice(0,5).every(t=>t==="0")&&FSW[5]==="3","姿を切りかえても開いていたタブのまま "+FSW.join(','));
/* 2026/11/17 依頼主：対策の番号は別々の崩し方なので「崩す手順」ではなく「崩す方法」。全部の姿で「手順」と書かない */
const BRW=await pg.evaluate(()=>{const bad=[],noH=[];[...P,...MEGAP].forEach(p=>{let h='';try{h=breakHTML(p)}catch(e){return}
  if(/手順/.test(h))bad.push(p.n);if(!/<h3>崩す方法<\/h3>/.test(h)&&/<ol class="gtips">/.test(h))noH.push(p.n)});return{bad,noH}});
ok(!BRW.bad.length&&!BRW.noH.length,'対策は「崩す方法」と書く（「手順」なし） '+JSON.stringify(BRW));
ok(!BF.tsu.length,'10以上を「Nつ」と数えない '+BF.tsu.join('・'));
ok(BF.ag.every(Boolean),'ギルガルドはブレードフォルムの攻撃で判定 '+JSON.stringify(BF.ag));
ok(BF.pf.every(Boolean),'イルカマンはマイティフォルムで判定 '+JSON.stringify(BF.pf));
/* Evidence overview: actual attack values, legal abilities, no fabricated ratings. */
const EV=await pg.evaluate(()=>{const cases=[184,308,660,752,676,964,768,10057,10280];const rows=cases.map(no=>{const p=byNo[no],e=dpEvidenceHTML(p);return {no,headline:e.headline,html:e.html}});const bad=[...P,...MEGAP].filter(p=>{try{const e=dpEvidenceHTML(p);return !e.headline||/undefined|NaN|Infinity/.test(e.headline+e.html)}catch(err){return true}}).map(p=>p.no);return {rows,bad}});
ok(!EV.bad.length,'根拠概要：全姿で生成できる '+EV.bad.join(','));
ok(EV.rows[0].html.includes('112')&&EV.rows[0].html.includes('224')&&EV.rows[0].headline.includes('ちからもち'),'マリルリ：特性による攻撃の比較');
ok(EV.rows[3].html.includes('すいほう')&&EV.rows[4].html.includes('ファーコート'),'すいほう・ファーコートの説明');
ok(EV.rows[5].headline.includes('交代')&&EV.rows[6].headline.includes('交代'),'イルカマン・グソクムシャの発動条件');
ok(EV.rows[7].html.includes('マジックミラー')&&EV.rows[7].html.includes('メガシンカ前後の種族値'),'メガアブソル：固有特性と変化量');
ok(EV.rows[8].headline.includes('ちからもち'),'メガスターミー：物理火力の特性');
await open(184);await tab(0);ok(await pg.evaluate(()=>document.body.scrollWidth<=innerWidth+1&&document.querySelector('[data-panel="0"]').textContent.includes('特性で変わる攻撃')),'スマホで根拠グラフが表示される');
/* Pilot build evidence must render and preserve legal allocation. */
const PA=await pg.evaluate(()=>{
  return [149,184].map(no=>{
    const p=byNo[no],g=monGuide(p,{parts:true}),i=g.sets.findIndex(s=>Array.isArray(s.refs));
    if(i<0)return {no,missing:true};
    const s=g.sets[i],h=g.setHTML(s,i);
    return {no,legal:s.sp.length===6&&s.sp.every(v=>Number.isInteger(v)&&v>=0&&v<=32)&&s.sp.reduce((a,b)=>a+b,0)===66,
      moves:s.moves.length===4&&s.moves.every(id=>LSD[no][1].includes(id)&&(MV[id]||MD[id])),
      allocation:h.includes('能力配分の計算根拠'),
      damage:h.includes('火力・耐久の計算例')&&!h.includes('比較は計算できませんでした'),
      finite:!/NaN|Infinity|undefined/.test(h)};
  });
});
ok(PA.every(x=>x.legal&&x.moves&&x.allocation&&x.damage&&x.finite),'先行育成例：合法性・能力配分・火力耐久の根拠 '+JSON.stringify(PA));
/* Inventory every form separately; never equate overview generation with integrated support. */
const COVER=await pg.evaluate(()=>{
  const forms=[...new Map([...P,...MEGAP,...RANKP].map(p=>[p.no,p])).values()];
  const rows=forms.map(p=>{
    const learn=LSD[p.no]?.[1]||LSD[p.base]?.[1]||[];
    const abilities=ABD[p.no]||(p.ab?[[p.ab,0]]:[]);
    const attacks=learn.filter(id=>!!MV[id]),status=learn.filter(id=>!!MD[id]&&!MV[id]);
    let g=null,error=null;
    try{g=monGuide(p,{parts:true})}catch(e){error=String(e)}
    const sets=Array.isArray(g?.sets)?g.sets:[];
    const invalid=sets.flatMap((x,i)=>{
      const why=[];
      if(!Array.isArray(x.moves)||!x.moves.length||x.moves.some(id=>!learn.includes(id)||!(MV[id]||MD[id]))||new Set(x.moves).size!==x.moves.length||x.moves.length>4)why.push('moves');
      if(!Array.isArray(x.sp)||x.sp.length!==6||x.sp.some(n=>!Number.isInteger(n)||n<0||n>32)||x.sp.reduce((a,b)=>a+b,0)>66)why.push('AP');
      if(!abilities.some(a=>a[0]===x.ab))why.push('ability');
      if(!((x.up===-1&&x.dn===-1)||(Number.isInteger(x.up)&&Number.isInteger(x.dn)&&x.up>=1&&x.up<=5&&x.dn>=1&&x.dn<=5&&x.up!==x.dn)))why.push('nature');
      if(x.item&&!Object.prototype.hasOwnProperty.call(ITEMN,x.item))why.push('item');
      try{const f=resolveForm(p.no,x.item||null);if(!f.ok||(p.base?(!f.mega||f.form.no!==p.no):!!f.mega))why.push('form')}catch(e){why.push('form exception')}
      return why.length?[{i,why}]:[];
    });
    const formats=[...new Set(sets.map(x=>x.fmt||'single'))];
    return {no:p.no,name:p.n,form:p.base?'mega':'other',attacks:attacks.length,status:status.length,abilities:abilities.map(a=>a[0]),sets:sets.length,invalid:invalid.length,invalidDetails:invalid,formats,error,integratedPilot:[149,184,212,65].includes(p.no)};
  });
  return {total:rows.length,withLearn:rows.filter(x=>x.attacks>0).length,withSets:rows.filter(x=>x.sets>0).length,pilots:rows.filter(x=>x.integratedPilot).length,errors:rows.filter(x=>x.error||x.invalid||!x.sets),rows};
});
console.log('form coverage '+JSON.stringify(COVER));
const selectable=await pg.evaluate(()=>[...new Set([...P,...MEGAP].map(p=>p.no))]);
const gaps=COVER.rows.filter(x=>selectable.includes(x.no)&&(x.error||x.invalid||!x.formats.includes('single')||!x.formats.includes('double')));
ok(!gaps.length,'全選択可能な姿の合法育成・両形式 '+JSON.stringify(gaps));
const DT=await pg.evaluate(()=>monGuide(byNo[132],{parts:true}).sets.filter(x=>x.k==='transform').map(x=>({fmt:x.fmt,ab:x.ab,item:x.item,moves:x.moves,sp:x.sp})));
ok(['single','double'].every(f=>DT.some(x=>x.fmt===f&&x.ab==='imposter'&&x.item==='choicescarf'&&x.moves.length===1&&x.moves[0]===144&&x.sp[0]===32)),'メタモンの合法な変身型 '+JSON.stringify(DT));
ok(COVER.total>0&&COVER.rows.length===COVER.total&&COVER.pilots===4,'全姿の育成対応状況を個別に記録 '+COVER.total+'姿');
/* Measure actual integrated coverage on every selectable form, separately from ordinary build coverage.
   Audit only one local single-battle build per form to keep runtime bounded. */
const IC=await pg.evaluate(()=>{
  const forms=[...new Map([...P,...MEGAP].map(p=>[p.no,p])).values()];
  return forms.map(p=>{
    const reports=[],skips=[],baselineFailures=[];
    try{
      const g=monGuide(p,{parts:true,auditCoverage:true,auditIntegrated:r=>reports.push(r),auditSkipped:r=>skips.push(r),auditBaselineFailure:r=>baselineFailures.push(r)});
      const s=g.sets.find(x=>x.fmt==='single'&&!x.live&&!x.usage);
      if(!s)return {no:p.no,name:p.n,status:'no local single build'};
      const t=performance.now(),h=g.auditBenchmark(s),ms=Math.round(performance.now()-t),r=reports[0];
      if(!r)return {no:p.no,name:p.n,status:h.includes('比較は計算できませんでした')?'exception':skips[0]||'no benchmark',ms,moves:s.moves,ab:s.ab,item:s.item,baselineFailure:baselineFailures[0]||null};
      const bad=r.attempts>360||r.valid<1||r.valid>r.attempts||r.eligibleItems.some(x=>!r.attemptedItems.includes(x))||!h.includes('技・持ち物・能力ポイントの一体比較');
      return {no:p.no,name:p.n,status:bad?'invalid report':'evaluated',ms,searchMs:Math.round(r.elapsedMs),candidates:r.best.length,attempts:r.attempts};
    }catch(e){return {no:p.no,name:p.n,status:'exception',error:String(e)}}
  });
});
const ICS={total:IC.length,counts:IC.reduce((a,x)=>(a[x.status]=(a[x.status]||0)+1,a),{}),rows:IC};
console.log('integrated coverage '+JSON.stringify(ICS));
ok(IC.length===selectable.length&&IC.every(x=>x.status!=='exception'&&x.status!=='invalid report'),'統合エンジン全姿の適用範囲・例外検査 '+JSON.stringify(ICS.counts));
/* Audit actual generated integrated candidates, rather than only checking HTML. */
const IA=await pg.evaluate(()=>{
  return [149,184,212,65].map(no=>{
    const p=byNo[no],reports=[],g=monGuide(p,{parts:true,auditIntegrated:x=>reports.push(x)}),i=g.sets.findIndex(s=>Array.isArray(s.refs));
    if(i<0)return {no,missing:true};
    const s=g.sets[i],t=performance.now(),h=g.setHTML(s,i),totalMs=performance.now()-t,r=reports[0];
    if(!r)return {no,missing:true,totalMs,render:h.includes('技・持ち物・能力ポイントの一体比較')};
    const errors=[];
    if(!r.opponents.length||!r.attempts||r.attempts>360||r.valid>r.attempts)errors.push('search bounds');
    if(!Array.isArray(r.eligibleItems)||!r.eligibleItems.length||!Array.isArray(r.attemptedItems)||r.eligibleItems.some(item=>!r.attemptedItems.includes(item)))errors.push('held item search coverage');
    const weather=B.weather;B.weather=null;
    try{
      for(const v of [r.baseline,...r.best]){
        const x=v.x;
        if(x.moves.length!==4||new Set(x.moves).size!==4||!x.moves.every(id=>LSD[no][1].includes(id)&&(MD[id]||MV[id]))||x.sp.length!==6||x.sp.some(n=>!Number.isInteger(n)||n<0||n>32)||x.sp.reduce((a,b)=>a+b,0)!==66||!ITEMN[x.item])errors.push('illegal build');
        for(let j=0;j<r.opponents.length;j++){
          const op=r.opponents[j],row=v.rows[j],a=mkMon(p,'me',{...x,moves:x.moves.filter(id=>MV[id]).map(mvObj)});
          if(no===149){a.stg.atk=1;a.stg.spe=1}
          if(no===212)a.stg.atk=2;
          if(no===65)a.stg.spa=2;
          if(no===184){a.stg.atk=6;a.hp-=Math.floor(a.max/2);if(a.item==='sitrusberry'&&a.hp<=Math.floor(a.max/2)){a.hp+=Math.floor(a.max/4);a.item=null}}
          const opt={format:'single',spread:false,crit:false,protean:true,noNext:true};
          const mv=mvObj(row.hit.id),rr=dmgRolls(a,mv,op,opt),raw=mv.maxH>1?hitRemainingDist(a,mv,op,opt).map(([hp])=>op.hp-hp):(rr.dist?rr.dist.map(x=>x[0]):rr);
          const incoming=op.moves.map(m=>{const z=dmgRolls(op,m,a,opt),v=z.dist?z.dist.map(x=>x[0]):z;return Math.max(...v.map(n=>z.surv&&a.hp===z.surv.max?Math.min(n,a.hp-1):n+(z.loss||0)))});
          if(row.hit.lo!==Math.min(...raw)||row.hit.hi!==Math.max(...raw)||row.hit.acc!==accOf(a,mv,op)||row.margin!==a.hp-Math.max(...incoming)||row.remaining!==a.hp||row.speed!==effSpd(a,op)||row.order!==Math.sign(effSpd(a,op)-effSpd(op,a)))errors.push('calculator mismatch');
          const ref=r.baseline.rows[j];
          const deltas={276:{atk:-1,def:-1},370:{def:-1,spd:-1},315:{spa:-2},437:{spa:-2},434:{spa:-2}}[mv.id];
          const post={...a,stg:{...a.stg}};
          if(deltas&&Math.max(...raw)>0&&row.hit.acc>0)for(const [k,n] of Object.entries(deltas))post.stg[k]=Math.max(-6,Math.min(6,post.stg[k]+n));
          if(post.item==='lifeorb'&&post.ab!=='magic-guard'&&Math.max(...raw)>0&&row.hit.acc>0)post.hp=Math.max(0,post.hp-Math.max(1,Math.floor(post.max/10)));
          const rp=post.hp>0?dmgRolls(post,mv,op,opt):[0],rv=post.hp===0?[0]:mv.maxH>1?hitRemainingDist(post,mv,op,opt).map(([hp])=>op.hp-hp):(rp.dist?rp.dist.map(x=>x[0]):rp);
          const postIncoming=post.hp===0?[0]:op.moves.map(m=>{const z=dmgRolls(op,m,post,opt),v=z.dist?z.dist.map(x=>x[0]):z;return Math.max(...v.map(n=>z.surv&&post.hp===z.surv.max?Math.min(n,post.hp-1):n+(z.loss||0)))});
          const loss=mv.maxH>1?rv:rv.map(n=>rp.surv&&op.hp===rp.surv.max?Math.min(n,op.hp-1):n+(rp.loss||0));
          if(row.repeat.lo!==Math.min(...rv)||row.repeat.hi!==Math.max(...rv)||Math.abs(row.repeatQuality-Math.min(1,Math.min(...loss)/op.hp)*accOf(post,mv,op)/100)>1e-9||row.postMargin!==post.hp-Math.max(...postIncoming)||row.postHP!==post.hp||Object.keys(post.stg).some(k=>row.postStages[k]!==post.stg[k]))errors.push('post-move calculator mismatch');
          if(row.quality+1e-9<ref.quality||row.repeatQuality+1e-9<ref.repeatQuality||row.margin<ref.margin||row.postMargin<ref.postMargin||row.postHP<ref.postHP||row.order<ref.order)errors.push('regression');
        }
      }
    }finally{B.weather=weather}
    return {no,errors,attempts:r.attempts,valid:r.valid,candidates:r.best.length,eligibleItems:r.eligibleItems,attemptedItems:r.attemptedItems,elapsedMs:Math.round(r.elapsedMs),totalMs:Math.round(totalMs),render:h.includes('技・持ち物・能力ポイントの一体比較')};
  });
});
/* Independent direct checks of the calculator metadata used by integrated HP-loss evaluation. */
const SV=await pg.evaluate(()=>{
  const make=(no,ab,item,sp,up,dn,moves)=>mkMon(byNo[no],'me',{ab,item,sp,up,dn,moves:moves.map(mvObj)});
  const a=make(445,'rough-skin',null,[2,32,0,0,0,32],1,3,[89]);
  const d=make(65,'magic-guard','focussash',[2,0,0,32,0,32],5,1,[94]);
  const opt={format:'single',spread:false,crit:false,protean:true,noNext:true};
  const m=mvObj(89);
  const full=dmgRolls(a,m,d,opt),chip=dmgRolls(a,m,{...d,hp:d.hp-1},opt);
  const sturdy=dmgRolls(a,m,{...d,item:null,ab:'sturdy'},opt);
  const bypass=dmgRolls({...a,ab:'mold-breaker'},m,{...d,item:null,ab:'sturdy'},opt);
  const disguise=dmgRolls(a,m,{...d,item:null,ab:'disguise',disg:true},opt);
  return {full:full.surv?.k,chip:!!chip.surv,sturdy:sturdy.surv?.k,bypass:!!bypass.surv,disguise:disguise.loss,expectedLoss:Math.floor(d.max/8),raw:Math.max(...full)};
});
ok(SV.full==='focussash'&&!SV.chip&&SV.sturdy==='sturdy'&&!SV.bypass&&SV.disguise===SV.expectedLoss,'単発技の生存条件・HP減少の計算メタデータ '+JSON.stringify(SV));
/* Compare the compressed state distribution against explicit enumeration of
   every independent damage roll (up to three hits). Synthetic ability states
   isolate mechanics; this is not a claim of legal builds or device validation. */
const HR=await pg.evaluate(()=>{
  const make=(no,ab,item)=>mkMon(byNo[no],'me',{ab,item,sp:[2,32,0,0,0,32],up:1,dn:3,moves:[]});
  const a=make(445,'rough-skin',null),d=make(65,'magic-guard',null);
  const opt={format:'single',spread:false,crit:false,protean:true,surv:true};
  const cases=[
    ['single',a,mvObj(89),d,1],
    ['sash',a,mvObj(89),{...d,item:'focussash'},1],
    ['sturdy',a,mvObj(89),{...d,ab:'sturdy'},1],
    ['bypass',{...a,ab:'mold-breaker'},mvObj(89),{...d,ab:'sturdy'},1],
    ['disguise',a,mvObj(89),{...d,ab:'disguise',disg:true},1],
    ['two hits',a,mvObj(331),{...d,item:'focussash'},2],
    ...[24,458,751,814].flatMap(id=>[
      ['fixed two-hit '+id,a,mvObj(id),{...d,item:'focussash'},2],
      ['fixed two-hit sturdy '+id,a,mvObj(id),{...d,ab:'sturdy'},2],
      ['fixed two-hit disguise '+id,a,mvObj(id),{...d,ab:'disguise',disg:true},2]
    ]),
    ['three hits',a,mvObj(331),{...d,ab:'stamina'},3],
    ['triple axel',a,mvObj(813),{...d,ab:'disguise',disg:true},3],
    ['parental bond',{...a,ab:'parental-bond'},mvObj(89),{...d,item:'focussash'},1]
  ];
  const rows=[];
  for(const [name,aa,m,dd,n] of cases){
    if(!m||!MV[m.id]){rows.push({name,error:'missing move'});continue}
    const o={...opt,hits:n,nHits:n},hitN=bhits(aa,m,dd,{...o,r:100}).n;
    const counts=new Map();let trials=0;
    function walk(rolls){
      if(rolls.length===hitN){
        const b=bhits(aa,m,dd,{...o,rolls}),hp=Math.max(0,Math.min(dd.max,b.state.hp));
        counts.set(hp,(counts.get(hp)||0)+1);trials++;return;
      }
      for(let k=85;k<=100;k++)walk([...rolls,k]);
    }
    walk([]);
    const t=performance.now(),actual=hitRemainingDist(aa,m,dd,o),ms=performance.now()-t;
    const ref=new Map([...counts].map(([hp,c])=>[hp,c/trials]));
    const error=actual.length!==ref.size||actual.some(([hp,p])=>!ref.has(hp)||Math.abs(ref.get(hp)-p)>1e-10)||Math.abs(actual.reduce((s,x)=>s+x[1],0)-1)>1e-10;
    rows.push({name,trials,states:actual.length,error,ms:Math.round(ms*100)/100});
  }
  return rows;
});
/* Variable hit count mixtures: use fixed-count replay as a reference for the independent count weights. */
const HM=await pg.evaluate(()=>{
  const mk=(no,ab,item)=>mkMon(byNo[no],'me',{ab,item,sp:[2,32,0,0,0,32],up:1,dn:3,moves:[]});
  const a=mk(445,'rough-skin',null),d=mk(184,'huge-power',null);
  const opt={format:'single',spread:false,crit:false,protean:true};
  const rows=[];
  for(const id of [31,42,198,292,331,333,350,541,594,813]){
    const m=mvObj(id);
    for(const ab of ['rough-skin','skill-link']){
      const aa={...a,ab};
      const t=performance.now(),actual=hitRemainingDist(aa,m,d,opt),ms=performance.now()-t;
      const expected=new Map(),p=accOf(aa,m,d)/100;
      const weights=ab==='skill-link'?[[m.maxH,1]]:id===813?[[1,1-p],[2,p*(1-p)],[3,p*p]]:[[2,.35],[3,.35],[4,.15],[5,.15]];
      for(const [n,w] of weights.filter(x=>x[1]>0)){
        for(const [hp,q] of hitRemainingDist(aa,m,d,{...opt,nHits:n}))expected.set(hp,(expected.get(hp)||0)+w*q);
      }
      const error=actual.length!==expected.size||actual.some(([hp,q])=>!expected.has(hp)||Math.abs(expected.get(hp)-q)>1e-9)||Math.abs(actual.reduce((t,x)=>t+x[1],0)-1)>1e-9;
      rows.push({id,ab,error,states:actual.length,ms:Math.round(ms*100)/100});
    }
  }
  return rows;
});
console.log('variable hit audit '+JSON.stringify(HM));
ok(HM.every(x=>!x.error),'連続技の攻撃回数分布・スキルリンク・追加命中判定 '+JSON.stringify(HM));
const PS=await pg.evaluate(()=>{
  const expected={276:{atk:-1,def:-1},370:{def:-1,spd:-1},315:{spa:-2},437:{spa:-2},434:{spa:-2}};
  const rows=[];
  for(const [key,delta] of Object.entries(expected)){
    const id=Number(key),m=mvObj(id);
    for(const [ab,factor] of [['rough-skin',1],['contrary',-1],['simple',2]])for(const initial of [-6,0,6])for(const connected of [true,false]){
      const a={ab,item:null,stg:{atk:initial,def:initial,spa:initial,spd:initial,spe:initial}},before=JSON.stringify(a),out=reviewedSelfStageAfterHit(a,m,connected);
      const target=Object.fromEntries(Object.keys(a.stg).map(k=>[k,Math.max(-6,Math.min(6,initial+(connected?(delta[k]||0)*factor:0)))]));
      rows.push({id,ab,initial,connected,error:!out||Object.keys(target).some(k=>out.stg[k]!==target[k])||before!==JSON.stringify(a)||out.stg===a.stg});
    }
    const a={ab:'rough-skin',item:'whiteherb',stg:{atk:0,def:0,spa:0,spd:0,spe:0}};
    rows.push({id,whiteHerb:true,error:reviewedSelfStageAfterHit(a,m,true)!==null});
  }
  return rows;
});
console.log('post-move stage audit '+JSON.stringify({total:PS.length,failed:PS.filter(x=>x.error)}));
ok(PS.every(x=>!x.error),'使用後の能力変化・命中条件・上下限・元データ保持 '+JSON.stringify(PS.filter(x=>x.error)));
const LH=await pg.evaluate(()=>{
  const rows=[];
  for(const max of [9,10,159,168,200])for(const hp of [1,max])for(const item of [null,'lifeorb'])for(const [ab,id,immune] of [['multiscale',89,false],['magic-guard',89,true],['sheer-force',53,true],['sheer-force',89,false]])for(const hit of [false,true]){
    const a={max,hp,item,ab,stg:{atk:0,def:0,spa:0,spd:0,spe:0}},before=JSON.stringify(a);
    const m=mvObj(id),v=reviewedLifeOrbAfterHit(a,m,hit);
    const expected=item==='lifeorb'&&hit&&!immune?Math.max(0,hp-Math.max(1,Math.floor(max/10))):hp;
    rows.push({max,hp,item,ab,id,hit,error:!v||v.hp!==expected||JSON.stringify(a)!==before||v.stg===a.stg});
  }
  return rows;
});
console.log('Life Orb HP audit '+JSON.stringify({total:LH.length,failed:LH.filter(x=>x.error)}));
ok(LH.every(x=>!x.error),'いのちのたまのHP消費・特性による無効・元データ保持 '+JSON.stringify(LH.filter(x=>x.error)));
console.log('remaining HP audit '+JSON.stringify(HR));
ok(HR.every(x=>x.error===false&&x.trials>0),'独立乱数の全列挙と残りHP分布が一致 '+JSON.stringify(HR));
console.log('integrated audit '+JSON.stringify(IA));
ok(IA.every(x=>!x.missing&&x.render&&x.errors.length===0&&x.valid>0&&x.attempts<=360),'統合探索：合法性・計算一致・探索上限 '+JSON.stringify(IA));
ok(!errs.length,'エラーなし '+errs.join(' / '));
await b.close();
if(fail){console.log(`dexpage: ${fail}/${n} NG`);process.exit(1)}console.log(`dexpage: OK（${n}項目）`);
