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
ok(!/物理アタッカーとして使いやすい|向いている役割/.test(O),'概要：旧来の役割断定を表示しない');
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
const CJ=await pg.evaluate(()=>{
 const a={r:3,myN:2,opW:3,first:1,swIn:'survive',me:{acc:100,fmin:55},op:{fmax:40}};
 return {same:!brJointDominates(a,a),better:brJointDominates(a,{...a,myN:1,me:{acc:100,fmin:100}}),loss:!brJointDominates(a,{...a,myN:1,op:{fmax:41}}),accuracy:!brJointDominates(a,{...a,myN:1,me:{acc:90,fmin:100}})};
});
ok(CJ.same&&CJ.better&&CJ.loss&&CJ.accuracy,'対策用育成の採用条件 '+JSON.stringify(CJ));
const BRW=await pg.evaluate(()=>{const bad=[],noH=[];[...P,...MEGAP].forEach(p=>{let h='';try{h=breakHTML(p)}catch(e){return}
  if(/手順/.test(h))bad.push(p.n);if(!/<h3>崩す方法<\/h3>/.test(h)&&/<ol class="gtips">/.test(h))noH.push(p.n)});return{bad,noH}});
ok(!BRW.bad.length&&!BRW.noH.length,'対策は「崩す方法」と書く（「手順」なし） '+JSON.stringify(BRW));
ok(!BF.tsu.length,'10以上を「Nつ」と数えない '+BF.tsu.join('・'));
ok(BF.ag.every(Boolean),'ギルガルドはブレードフォルムの攻撃で判定 '+JSON.stringify(BF.ag));
ok(BF.pf.every(Boolean),'イルカマンはマイティフォルムで判定 '+JSON.stringify(BF.pf));
/* Evidence overview: actual attack values, legal abilities, no fabricated ratings. */
const EV=await pg.evaluate(()=>{const cases=[184,308,660,752,676,964,768,10057,10280];const rows=cases.map(no=>{const p=byNo[no],e=dpEvidenceHTML(p);return {no,headline:e.headline,html:e.html}});const bad=[...P,...MEGAP].filter(p=>{try{const e=dpEvidenceHTML(p);const g=monGuide(p,{parts:true});const h=dpOverviewHTML(p,g);return !e.headline||/undefined|NaN|Infinity/.test(e.headline+e.html)||/向いている役割|役割・姿の詳しい説明/.test(h)}catch(err){return true}}).map(p=>p.no);return {rows,bad}});
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
      if(!r)return {no:p.no,name:p.n,status:h.includes('比較は計算できませんでした')?'exception':skips.length&&(!h.includes('改善候補がないという判定ではありません')||h.includes('今回の探索範囲では全条件を維持しながら改善する候補は見つかりませんでした'))?'invalid report':skips[0]||'no benchmark',ms,moves:s.moves,ab:s.ab,item:s.item,baselineFailure:baselineFailures[0]||null};
      const stone=p.base?Object.keys(MEGA).find(k=>MEGA[k][p.base]===p.no):null;
      const megaBad=!!p.base&&(!stone||r.eligibleItems.length!==1||r.eligibleItems[0]!==stone||r.attemptedItems.length!==1||r.attemptedItems[0]!==stone||[r.baseline,...r.best].some(v=>{
        const x=v.x,f=resolveForm(p.no,x.item);
        return x.item!==stone||!f.ok||!f.mega||f.form.no!==p.no||!x.moves.every(id=>(LSD[p.no]?.[1]||LSD[p.base]?.[1]||[]).includes(id))||x.sp.length!==6||x.sp.some(n=>!Number.isInteger(n)||n<0||n>32)||x.sp.reduce((a,b)=>a+b,0)!==s.sp.reduce((a,b)=>a+b,0);
      }));
      const recoveryBad=[r.baseline,...r.best].some(v=>v.rows.some((row,i)=>{
        const expectedHP=Math.max(0,row.postMargin);
        const end=v.x.item==='leftovers'&&expectedHP>0?Math.min(row.max,expectedHP+Math.max(1,Math.floor(row.max/16))):expectedHP;
        const ref=r.baseline.rows[i];
        return row.endHP!==end||row.endHP<ref.endHP||(r.recovery?( !Number.isInteger(row.recoveryHP)||row.recoveryHP<0||row.recoveryHP>row.max||row.recoveryHP<ref.recoveryHP):row.recoveryHP!==null);
      }));
      const bad=recoveryBad||megaBad||r.attempts>360||r.valid<1||r.valid>r.attempts||r.eligibleItems.some(x=>!r.attemptedItems.includes(x))||!h.includes('技・持ち物・能力ポイントの一体比較');
      return {no:p.no,name:p.n,status:bad?'invalid report':'evaluated',ms,searchMs:Math.round(r.elapsedMs),candidates:r.best.length,attempts:r.attempts,recovery:r.recovery||null,leftovers:r.eligibleItems.includes('leftovers')};
    }catch(e){return {no:p.no,name:p.n,status:'exception',error:String(e)}}
  });
});
const ICS={total:IC.length,counts:IC.reduce((a,x)=>(a[x.status]=(a[x.status]||0)+1,a),{}),rows:IC};
console.log('integrated coverage '+JSON.stringify(ICS));
console.log('integrated recovery coverage '+JSON.stringify({direct:IC.filter(x=>x.status==='evaluated'&&x.recovery),leftovers:IC.filter(x=>x.status==='evaluated'&&x.leftovers).length}));
ok(IC.some(x=>x.status==='evaluated'&&x.leftovers),'統合探索：たべのこし候補を実際に評価');
const megaNos=await pg.evaluate(()=>MEGAP.map(p=>p.no));
const megaRows=IC.filter(x=>megaNos.includes(x.no));
console.log('mega integrated coverage '+JSON.stringify({total:megaRows.length,counts:megaRows.reduce((a,x)=>(a[x.status]=(a[x.status]||0)+1,a),{}),rows:megaRows}));
ok(megaRows.some(x=>x.status==='evaluated')&&megaRows.every(x=>x.status!=='mega item fixed'&&x.status!=='mega form mismatch'&&x.status!=='invalid report'&&x.status!=='exception'),'メガストーン固定探索：実行例・姿・技・能力ポイントの整合性');
// Keep excluded formats distinct from evaluated single-battle builds.
const DC=await pg.evaluate(()=>[...new Map([...P,...MEGAP].map(p=>[p.no,p])).values()].map(p=>{
  try {
    const reports=[],g=monGuide(p,{parts:true,auditCoverage:true,auditDouble:r=>reports.push(r)});
    const s=g.sets.find(x=>x.fmt==='double'&&!x.live&&!x.usage);
    if(!s)return {no:p.no,name:p.n,status:'no local double build'};
    const h=g.auditBenchmark(s);
    const focus=reports[0]?.focus||[],focusInvalid=focus.some(f=>f.orders.length!==2||f.orders.some(x=>x.rolls!==256||x.ko<0||x.ko>256||x.min<0||x.max<x.min)||f.min!==Math.min(...f.orders.map(x=>x.min))||f.max!==Math.max(...f.orders.map(x=>x.max)));
    const friendly=reports[0]?.friendly||[],friendlyInvalid=friendly.some(f=>!f.targeted||f.min<0||f.max<f.min||f.max>f.hp||mvObj(f.id).tg!==2);
    const support=reports[0]?.support||[],supportInvalid=support.some(f=>!['helpingHand','friendGuard'].includes(f.kind)||!f.source||f.normal.length!==2||f.modified.length!==2||f.normal.some((v,i)=>!Number.isFinite(v)||!Number.isFinite(f.modified[i])||(f.kind==='helpingHand'?f.modified[i]<v:f.modified[i]>v)));
    const joint=reports[0]?.doubleJoint, jointInvalid=joint!=null&&(!Number.isInteger(joint.attempts)||joint.attempts<1||joint.attempts>48||!Array.isArray(joint.best)||joint.best.length>3||joint.best.some(v=>!reviewedDoublePolicyDominance(joint.baseline,v.profiles)||reviewedDoublePolicyDominance(v.profiles,joint.baseline))),rows=reports[0]?.rows||[],invalid=jointInvalid||focusInvalid||friendlyInvalid||supportInvalid||rows.some(r=>r.one.length!==2||r.many.length!==2||r.one.some((v,i)=>!Number.isFinite(v)||!Number.isFinite(r.many[i])||(r.tg?r.many[i]>v:r.many[i]!==v)));
    return {no:p.no,name:p.n,status:!h.includes('ダブル：攻撃対象別の計算例')||!h.includes('ダブルの統合比較は限定条件のみ対応します')||reports.length!==1||invalid?'invalid double benchmark':rows.length?'double damage benchmark':'no supported double attacks',rows:rows.length,focus:focus.length,joint:joint?{attempts:joint.attempts,accepted:joint.accepted,best:joint.best.length}:null,jointReason:reports[0]?.jointReason,unsupportedAttacks:reports[0]?.unsupportedAttacks||[],spread:rows.filter(r=>r.tg&&r.many.some((v,i)=>v<r.one[i])).length,moves:s.moves,ab:s.ab,item:s.item};
  }catch(e){return {no:p.no,name:p.n,status:'exception',error:String(e)}}
}));
const DCS={total:DC.length,counts:DC.reduce((a,x)=>(a[x.status]=(a[x.status]||0)+1,a),{}),rows:DC};
console.log('double integrated coverage '+JSON.stringify(DCS));
console.log('double joint actual coverage '+JSON.stringify({total:DC.length,evaluated:DC.filter(x=>x.joint).length,withCandidates:DC.filter(x=>x.joint?.best>0).length,attempts:DC.reduce((n,x)=>n+(x.joint?.attempts||0),0),reasons:DC.reduce((a,x)=>{const k=x.jointReason||x.status;a[k]=(a[k]||0)+1;return a},{})}));
const doubleMissing=DC.flatMap(x=>x.unsupportedAttacks||[]).reduce((a,id)=>(a[id]=(a[id]||0)+1,a),{});
console.log('double excluded attack frequency '+JSON.stringify(Object.entries(doubleMissing).sort((a,b)=>b[1]-a[1])));
ok(DC.filter(x=>x.jointReason?.includes('unsupported attack')).every(x=>x.unsupportedAttacks.length>0),'ダブルの未対応攻撃技を具体的に記録');
ok(DC.length===selectable.length&&DC.every(x=>['double damage benchmark','no supported double attacks','no local double build'].includes(x.status))&&DC.some(x=>x.spread>0),'ダブル：対象数補正・単体技不変・未対応範囲 '+JSON.stringify(DCS.counts));
// An evaluated report and a deliberately skipped build are different outcomes.
const reasonCounts=IC.filter(x=>x.status!=='evaluated').reduce((a,x)=>{
  const reason=x.baselineFailure?.reason||x.status;
  a[reason]=(a[reason]||0)+1;return a;
},{});
console.log('integrated coverage exclusions '+JSON.stringify({total:IC.length,evaluated:ICS.counts.evaluated||0,excluded:IC.length-(ICS.counts.evaluated||0),reasonCounts}));
const excludedMoves=IC.filter(x=>x.status!=='evaluated').flatMap(x=>(x.baselineFailure?.moves||[]).map(id=>({id,no:x.no,reason:x.status})));
console.log('integrated excluded move frequency '+JSON.stringify(excludedMoves.reduce((a,x)=>{const k=x.reason+':'+x.id;a[k]=(a[k]||0)+1;return a},{})));
ok(IC.filter(x=>['unsupported move','unsupported status move','multiple setup moves'].includes(x.status)).every(x=>Array.isArray(x.baselineFailure?.moves)&&x.baselineFailure.moves.length>0),'未対応の技を具体的に記録');
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
          const deltas={276:{atk:-1,def:-1},370:{def:-1,spd:-1},315:{spa:-2},437:{spa:-2},434:{spa:-2},488:{spe:1},885:{spe:1},872:{spe:1},871:{spa:1}}[mv.id];
          const post={...a,stg:{...a.stg}};
          if(deltas&&Math.max(...raw)>0&&row.hit.acc>0)for(const [k,n] of Object.entries(deltas))post.stg[k]=Math.max(-6,Math.min(6,post.stg[k]+n));
          const recoil={36:[1,4],38:[33,100],394:[33,100],413:[33,100],452:[33,100],834:[33,100],528:[1,4],457:[1,2],344:[33,100]}[mv.id];
          if(recoil&&Math.max(...raw)>0&&row.hit.acc>0&&!['rock-head','magic-guard'].includes(post.ab)){
            const dealt=Math.min(op.hp,Math.max(...raw));
            post.hp=Math.max(0,post.hp-Math.max(1,Math.floor((2*dealt*recoil[0]+recoil[1])/(2*recoil[1]))));
          }
          if(mv.id===796&&post.ab!=='magic-guard')post.hp=Math.max(0,post.hp-Math.ceil(post.max/2));
          const drain={409:[1,2],202:[1,2],141:[1,2],532:[1,2],577:[3,4],71:[1,2],72:[1,2],613:[3,4]}[mv.id];
          if(drain&&Math.max(...raw)>0&&row.hit.acc>0&&post.hp>0)post.hp=Math.min(post.max,post.hp+Math.floor((2*Math.min(op.hp,Math.max(0,Math.min(...raw)))*drain[0]+drain[1])/(2*drain[1])));
          if(post.item==='lifeorb'&&post.ab!=='magic-guard'&&Math.max(...raw)>0&&row.hit.acc>0)post.hp=Math.max(0,post.hp-Math.max(1,Math.floor(post.max/10)));
          const targetDelta={491:['spd',-2],855:['spd',-2],886:['atk',-1],679:['atk',-1],688:['atk',-1]}[mv.id];
          const target={...op,stg:{...op.stg}};
          if(targetDelta&&Math.max(...raw)>0&&row.hit.acc>0&&!sfSup(a,mv))target.stg[targetDelta[0]]=Math.max(-6,target.stg[targetDelta[0]]+targetDelta[1]);
          if(Object.keys(target.stg).some(k=>row.targetStages[k]!==target.stg[k]))errors.push('target stages mismatch');
          const rp=post.hp>0?dmgRolls(post,mv,target,opt):[0],rv=post.hp===0?[0]:mv.maxH>1?hitRemainingDist(post,mv,op,opt).map(([hp])=>op.hp-hp):(rp.dist?rp.dist.map(x=>x[0]):rp);
          const postIncoming=post.hp===0?[0]:target.moves.map(m=>{const z=dmgRolls(target,m,post,opt),v=z.dist?z.dist.map(x=>x[0]):z;return Math.max(...v.map(n=>z.surv&&post.hp===z.surv.max?Math.min(n,post.hp-1):n+(z.loss||0)))});
          const loss=mv.maxH>1?rv:rv.map(n=>rp.surv&&op.hp===rp.surv.max?Math.min(n,op.hp-1):n+(rp.loss||0));
          if(row.repeat.lo!==Math.min(...rv)||row.repeat.hi!==Math.max(...rv)||Math.abs(row.repeatQuality-Math.min(1,Math.min(...loss)/op.hp)*accOf(post,mv,op)/100)>1e-9||row.postMargin!==post.hp-Math.max(...postIncoming)||row.postHP!==post.hp||row.postOrder!==(post.hp>0?Math.sign(effSpd(post,op)-effSpd(op,post)):-1)||row.postSpeed!==(post.hp>0?effSpd(post,op):0)||Object.keys(post.stg).some(k=>row.postStages[k]!==post.stg[k]))errors.push('post-move calculator mismatch');
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
const FX=await pg.evaluate(()=>{
  const mk=(no,ab)=>mkMon(byNo[no],'me',{ab,item:null,sp:[2,32,0,0,0,32],up:1,dn:3,moves:[]});
  const a=mk(445,'rough-skin'),d=mk(65,'magic-guard'),rows=[];
  const opt={format:'single',spread:false,crit:false,protean:true,noNext:true};
  for(const id of [69,101,162]){
    if(!MV[id])continue;
    const m=mvObj(id);
    for(const hp of [1,2,49,50,51,99,100,101])for(const type of ['ノーマル','ゴースト','エスパー','いわ'])for(const item of [null,'lifeorb']){
      const target={...d,hp,max:Math.max(d.max,hp),p:{...d.p,t:[type]}};
      const attacker={...a,item};
      const expected=(type==='ゴースト'&&id!==101)||(type==='ノーマル'&&id===101)?0:id===162?Math.max(1,Math.floor(hp/2)):50;
      const raw=bcalc(attacker,m,target,{...opt,r:100}),rolls=dmgRolls(attacker,m,target,opt);
      rows.push({id,hp,type,item,error:raw.dmg!==expected||!rolls.length||Array.from(rolls).some(n=>n!==expected)});
    }
  }
  return {total:rows.length,failed:rows.filter(x=>x.error),available:[69,101,162].filter(id=>!!MV[id])};
});
console.log('fixed damage audit '+JSON.stringify(FX));
ok(FX.total>0&&!FX.failed.length,'固定ダメージ：HP・無効タイプ・持ち物補正 '+JSON.stringify(FX));
const ALTSTAT=await pg.evaluate(()=>{
  const mk=no=>mkMon(byNo[no],'me',{ab:'pressure',item:null,sp:[2,32,0,0,0,32],up:1,dn:3,moves:[]});
  const a=mk(445),d=mk(65),opt={format:'single',spread:false,crit:false,protean:false,r:100},rows=[];
  const damage=(id,x,y)=>bcalc(x,mvObj(id),y,opt).dmg;
  for(const [id,source,ignored] of [[776,'def','atk'],[492,'atk','spa'],[473,'def','spd']]){
    if(!MV[id])continue;
    const base=damage(id,a,d),actor=id===776?a:d;
    const changed={...actor,stg:{...actor.stg,[source]:2}},other={...actor,stg:{...actor.stg,[ignored]:2}};
    const v=id===776?damage(id,changed,d):damage(id,a,changed);
    const u=id===776?damage(id,other,d):damage(id,a,other);
    rows.push({id,base,v,u,error:!(base>0)||!(id===473?v<base:v>base)||u!==base});
  }
  if(MV[573])for(const [types,expected] of [[['みず'],2],[['みず','じめん'],4],[['みず','こおり'],1],[['みず','ドラゴン'],4]]){
    const target={...d,p:{...d.p,t:types}},v=bcalc(a,mvObj(573),target,opt);
    rows.push({id:573,types,expected,actual:v.eff,error:v.eff!==expected});
  }
  return {rows,failed:rows.filter(x=>x.error)};
});
console.log('alternate stat audit '+JSON.stringify(ALTSTAT));
ok(ALTSTAT.rows.length>0&&!ALTSTAT.failed.length,'特殊参照技：能力ランクとフリーズドライ相性 '+JSON.stringify(ALTSTAT.failed));
const VP=await pg.evaluate(()=>{
  const mk=no=>mkMon(byNo[no],'me',{ab:'pressure',item:null,sp:[2,32,0,0,0,32],up:1,dn:3,moves:[]});
  const a=mk(445),d=mk(65),rows=[];
  const speed=(x,n)=>({...x,st:x.st.map((v,i)=>i===5?n:v)});
  const check=(id,x,y,expected,label)=>{if(!MV[id])return;const actual=varPow(x,mvObj(id),y,{});rows.push({id,label,expected,actual,error:actual!==expected})};
  for(const [sa,sd,gyro,electro] of [[100,100,26,60],[99,100,26,40],[200,100,13,80],[300,100,9,120],[400,100,7,150],[10,100,150,40],[199,100,13,60],[299,100,9,80],[399,100,7,120]]){
    check(360,speed(a,sa),speed(d,sd),gyro,'speed '+sa+'/'+sd);
    check(486,speed(a,sa),speed(d,sd),electro,'speed '+sa+'/'+sd);
  }
  for(const max of [159,160,201])for(const hp of [1,Math.floor(max/2),max-1,max])for(const id of [284,323])check(id,{...a,hp,max},d,Math.max(1,Math.floor(150*hp/max)),'HP '+hp+'/'+max);
  for(const stages of [[0,0,0,0,0],[2,-2,1,0,1],[6,6,6,6,6],[-6,-6,-6,-6,-6]])for(const id of [500,681])check(id,{...a,stg:Object.fromEntries(['atk','def','spa','spd','spe'].map((k,i)=>[k,stages[i]]))},d,20+20*stages.filter(n=>n>0).reduce((t,n)=>t+n,0),'stages '+stages.join(','));
  const weighted=[...P,...MEGAP].filter(p=>(WT[p.no]||WT[p.base])>0);
  const byWeight=weighted.slice().sort((x,y)=>(WT[x.no]||WT[x.base])-(WT[y.no]||WT[y.base]));
  const sample=[byWeight[0],byWeight[Math.floor(byWeight.length/2)],byWeight.at(-1)].filter(Boolean);
  for(const p of sample)for(const q of sample)for(const ab of ['pressure','heavy-metal','light-metal']){
    const ratio=(WT[p.no]||WT[p.base])/(WT[q.no]||WT[q.base])*(ab==='heavy-metal'?2:ab==='light-metal'?0.5:1);
    for(const id of [484,535])check(id,{...a,p,ab},{...d,p:q},ratio>=5?120:ratio>=4?100:ratio>=3?80:ratio>=2?60:40,'weight '+p.no+'/'+q.no+'/'+ab);
  }
  return {total:rows.length,failed:rows.filter(x=>x.error),available:[284,323,360,484,486,500,535,681].filter(id=>!!MV[id])};
});
console.log('variable power audit '+JSON.stringify(VP));
ok(VP.total>0&&!VP.failed.length,'威力変動技：素早さ・HP・能力ランク・体重 '+JSON.stringify(VP));
const CR=await pg.evaluate(()=>{
  const mk=no=>mkMon(byNo[no],'me',{ab:'pressure',item:null,sp:[2,32,0,0,0,32],up:1,dn:3,moves:[]});
  const a=mk(445),d={...mk(65),p:{...byNo[65],t:['ノーマル']}},rows=[];
  const opt={format:'single',spread:false,crit:false,protean:false,r:100};
  for(const id of [480,524,870]){
    if(!MV[id])continue;
    const m=mvObj(id);
    for(const aa of ['pressure','mold-breaker','sniper'])for(const da of ['pressure','shell-armor','battle-armor']){
      const attacker={...a,ab:aa},target={...d,ab:da},expected=aa==='mold-breaker'||da==='pressure';
      const hit=bcalc(attacker,m,target,opt),replay=bhits(attacker,m,target,opt);
      const lowered={...attacker,stg:{...attacker.stg,atk:-2,spa:-2}};
      const raised={...target,stg:{...target.stg,def:2,spd:2}};
      const altered=bcalc(lowered,m,raised,opt),screen=bcalc(attacker,m,target,{...opt,screen:true});
      rows.push({id,aa,da,expected,error:hit.crit!==expected||replay.hits[0]?.crit!==expected||(expected?(altered.dmg!==hit.dmg||screen.dmg!==hit.dmg):(altered.dmg>=hit.dmg||screen.dmg>=hit.dmg))});
    }
    const normal=bcalc(a,m,d,opt),sniper=bcalc({...a,ab:'sniper'},m,d,opt);
    rows.push({id,sniper:true,error:sniper.dmg<normal.dmg||Math.abs(sniper.dmg-normal.dmg*1.5)>1});
  }
  const m=mvObj(89),ordinary=bcalc(a,m,d,opt),requested=bcalc(a,m,d,{...opt,crit:true}),blocked=bcalc(a,m,{...d,ab:'shell-armor'},{...opt,crit:true});
  rows.push({ordinary:true,error:ordinary.crit!==false||requested.crit!==true||blocked.crit!==false||requested.dmg<=ordinary.dmg||blocked.dmg!==ordinary.dmg});
  return {rows,failed:rows.filter(x=>x.error),available:[480,524,870].filter(id=>!!MV[id])};
});
console.log('critical hit audit '+JSON.stringify(CR));
ok(CR.rows.length>1&&!CR.failed.length,'確定急所・急所防止・能力ランク・壁・スナイパー '+JSON.stringify(CR.failed));
const DGARD=await pg.evaluate(()=>{
  const mk=no=>mkMon(byNo[no],'me',{ab:'pressure',item:null,sp:[2,32,0,0,0,32],up:1,dn:3,moves:[]});
  const a=mk(445),d={...mk(184),p:{...byNo[184],t:['ノーマル']}},rows=[];
  for(const id of REVIEWED_GUARD_ATTACKS)if(MV[id]){
    const m=mvObj(id);
    for(const multipleTargets of [false,true]){
      const before=JSON.stringify([a,d]),normal=reviewedDoubleGuard(a,m,d,{guard:'none',multipleTargets}),protect=reviewedDoubleGuard(a,m,d,{guard:'protect',multipleTargets}),wide=reviewedDoubleGuard(a,m,d,{guard:'wideGuard',multipleTargets});
      const rolls=dmgRolls(a,m,d,{format:'double',spread:multipleTargets,crit:false,protean:false,noNext:true});
      rows.push({id,multipleTargets,error:!normal||!protect||!wide||normal.blocked||normal.min!==Math.min(...rolls)||normal.max!==Math.max(...rolls)||!protect.blocked||protect.min!==0||protect.max!==0||wide.blocked!==!!m.tg||wide.min!==(m.tg?0:normal.min)||wide.max!==(m.tg?0:normal.max)||before!==JSON.stringify([a,d])});
    }
  }
  const guard=reviewedDoubleGuard({...a,ab:'unseen-fist'},mvObj(89),d,{guard:'protect',multipleTargets:true})===null;
  return {total:rows.length,failed:rows.filter(x=>x.error),guard};
});
console.log('double guard audit '+JSON.stringify(DGARD));
ok(DGARD.total>0&&DGARD.failed.length===0&&DGARD.guard,'ダブル防御技：対象範囲・乱数・状態保持・例外 '+JSON.stringify(DGARD));
const JLIMIT=await pg.evaluate(()=>{
  const s={moves:[1,2,3,4],item:'a',sp:[0,0,0,0,0,0]};
  const candidates=Array.from({length:20},(_,i)=>({...s,item:'i'+i}));
  const reports=Array.from({length:6},()=>reviewedDoublePolicySearch(s,candidates,()=>true,x=>[{id:null,scores:[x.item==='a'?0:1]}],12));
  return {members:reports.length,total:reports.reduce((a,b)=>a+b.attempts,0),all:reports.every(r=>r.attempts===12)};
});
ok(JLIMIT.members===6&&JLIMIT.total===72&&JLIMIT.all,'統合育成の探索予算 '+JSON.stringify(JLIMIT));
const JBR=await pg.evaluate(()=>{
 const p=byNo[445],learn=(lsOf(p)||[]).filter(id=>MV[id]||MD[id]).slice(0,4);
 const ab=(ABD[445]||[])[0]?.[0],base={ab:{k:ab},it:{k:'expertbelt'},mv:learn.map(id=>({id,n:mName(id)})),sp:[2,32,0,0,0,32],up:1,dn:3};
 const x={ab,item:'expertbelt',moves:learn,sp:[2,28,4,0,0,32],up:1,dn:3};
 const before=JSON.stringify([base,x]),v=impJointSaved(p.no,base,x,new Set());
 return {valid:!!v,duplicate:impJointSaved(p.no,base,x,new Set(['expertbelt']))===null,illegal:impJointSaved(p.no,base,{...x,sp:[2,33,0,0,0,31]},new Set())===null,unchanged:before===JSON.stringify([base,x])};
});
ok(JBR.valid&&JBR.duplicate&&JBR.illegal&&JBR.unchanged,'統合育成の保存変換 '+JSON.stringify(JBR));
const DST=await pg.evaluate(()=>{
  const d={hp:100,max:200,stg:{atk:0,def:0,spa:0,spd:0,spe:0},ab:'pressure',item:null};
  const b=JSON.stringify(d),heal=reviewedDirectHeal(d,105,true),setup=reviewedSetupState(d,14,{ab:'pressure'});
  const recovery=reviewedRecoveryExchange(d,105,0,()=>80);
  return {heal:heal?.hp,atk:setup?.stg.atk,min:recovery?.minHP,max:recovery?.maxHP,unchanged:JSON.stringify(d)===b};
});
ok(DST.heal===200&&DST.atk===2&&DST.min===120&&DST.max===120&&DST.unchanged,'ダブル変化技：既存処理の条件別検査 '+JSON.stringify(DST));
const DFIRST=await pg.evaluate(()=>{
 const a={id:252,maxH:1,tg:0,pri:3},b={id:660,maxH:1,tg:0,pri:2},c={id:89,maxH:1,tg:2,pri:0};
 return reviewedDoubleFirstTurn(a)&&reviewedDoubleFirstTurn(b)&&!reviewedDoubleFirstTurn(c)&&!reviewedDoubleFirstTurn({...a,tg:1})&&reviewedDoubleRepeatable([a,b,c]).length===1&&reviewedDoubleRepeatable([a,b,c])[0]===c;
});
ok(DFIRST,'初回限定技を通常攻撃候補から分離');
const DPOST=await pg.evaluate(()=>{
 const a={hp:100,max:100,item:'lifeorb',ab:'pressure',stg:{atk:0,def:0,spa:0,spd:0,spe:0}},d={hp:60,max:60,item:null};
 const m={id:370,tg:0,maxH:1,e:{s:[['def',-1,100],['spd',-1,100]]}};
 const recoil={id:413,tg:0,maxH:1,drain:-33};
 const x=reviewedDoublePostAttack(a,m,d,90,true),y=reviewedDoublePostAttack(a,recoil,d,90,true),z=reviewedDoublePostAttack(a,m,d,0,false);
 return {stage:x?.stg,stageHP:x?.hp,recoil:y?.hp,immune:z?.hp,unchanged:a.stg.def===0&&a.hp===100,spread:reviewedDoublePostAttack(a,{...recoil,tg:1},d,90,true)===null};
});
ok(DPOST.stage?.def===-1&&DPOST.stage?.spd===-1&&DPOST.stageHP===90&&DPOST.recoil===70&&DPOST.immune===100&&DPOST.unchanged&&DPOST.spread,'ダブル単体技：能力下降・反動・いのちのたま・無効 '+JSON.stringify(DPOST));
const DBERRY=await pg.evaluate(()=>{
 const d={max:101},s={hp:50,item:'sitrusberry'},before=JSON.stringify(s);
 return {at:reviewedDoubleBerry(d,s,{}),above:reviewedDoubleBerry(d,{...s,hp:51},{}),dead:reviewedDoubleBerry(d,{...s,hp:0},{}),blocked:reviewedDoubleBerry(d,s,{ab:'unnerve'}),consumed:reviewedDoubleBerry(d,{hp:20,item:null},{}),unchanged:JSON.stringify(s)===before};
});
ok(DBERRY.at?.hp===75&&DBERRY.at?.item===null&&DBERRY.above?.hp===51&&DBERRY.dead?.hp===0&&DBERRY.blocked?.hp===50&&DBERRY.consumed?.hp===20&&DBERRY.unchanged,'ダブル：オボンのみの発動境界・消費・阻害 '+JSON.stringify(DBERRY));
const DALLY=await pg.evaluate(()=>{
  const a=[{one:100,many:75,order:[1],allyLoss:50},{one:20,many:20,order:[1],allyLoss:0}];
  const v=reviewedDoubleAllyScores(a,[0,50]);
  const u=reviewedDoubleAllyScores([{...a[0],allyLoss:51},a[1]],[0,50]);
  return {v,u,invalid:reviewedDoubleAllyScores(a,[-1])===null};
});
ok(DALLY.v?.[1]===20&&DALLY.v?.[10]===100&&DALLY.u?.[10]===20&&DALLY.invalid,'ダブル巻き込み制約と同一技の火力 '+JSON.stringify(DALLY));
const DFS=await pg.evaluate(()=>{
  const r={orders:[{first:2,min:0,max:80,ko:64,rolls:256},{first:1,min:10,max:90,ko:0,rolls:256}]};
  const v=reviewedFocusScores(r,[1,2]);
  const invalid=[{orders:[r.orders[0],r.orders[0]]},{orders:[{...r.orders[0],ko:0},r.orders[1]]},{orders:[{...r.orders[0],rolls:255},r.orders[1]]}].every(x=>reviewedFocusScores(x,[1,2])===null);
  return {v,invalid};
});
ok(JSON.stringify(DFS.v)==='[10,90,256,0,80,192]'&&DFS.invalid,'ダブル集中攻撃：順序別HP・生存数・不正入力 '+JSON.stringify(DFS));
const DCP=await pg.evaluate(()=>{
  const groups=[[{id:1,one:100,many:75,order:[1]},{id:2,one:10,many:10,order:[0]}],[{id:1,one:10,many:10,order:[0]},{id:2,one:100,many:75,order:[1]}]];
  const free=reviewedDoubleChoiceProfiles(groups,false),locked=reviewedDoubleChoiceProfiles(groups,true);
  return {ids:locked?.map(v=>v.id),freeWins:reviewedDoublePolicyDominance(locked,free),lockedWins:reviewedDoublePolicyDominance(free,locked)};
});
ok(JSON.stringify(DCP.ids)==='[1,2]'&&DCP.freeWins&&!DCP.lockedWins,'ダブルこだわり固定技の比較 '+JSON.stringify(DCP));
const DAS=await pg.evaluate(()=>{
  const a=[{one:100,many:75,order:[-1,1]},{one:20,many:20,order:[1,0]}];
  const b=[{one:100,many:75,order:[1,1]}];
  const x=reviewedDoubleActionScores(a),y=reviewedDoubleActionScores(b);
  return {x,y,invalid:reviewedDoubleActionScores([{one:1,many:1,order:[2]}])===null};
});
ok(JSON.stringify(DAS.x)===JSON.stringify([100,75,1,20,20,1,20,20,1,100,75,1,100,75])&&DAS.y[6]===100&&DAS.invalid,'ダブル同一技の火力と行動順 '+JSON.stringify(DAS));
const DJ=await pg.evaluate(()=>{
  const s={moves:[1,2,3,4],item:'a',sp:[0,0,0,0,0,0]};
  const candidates=[{...s,item:'b'},{...s,item:'c'},{...s,item:'d'},{...s,item:'e'},{...s,item:'f'}];
  const values={a:[5,5],b:[6,4],c:[5,6],d:[7,6],e:[6,7],f:[99,99]};
  const r=reviewedDoubleSearch(s,candidates,x=>x.item!=='f',x=>values[x.item],5);
  return {attempts:r?.attempts,best:r?.best.map(x=>x.x.item).sort().join(','),accepted:r?.accepted};
});
ok(DJ.attempts===5&&DJ.best==='d,e'&&DJ.accepted===4,'ダブル統合探索：上限・合法性・個別悪化・支配関係 '+JSON.stringify(DJ));
const DTO=await pg.evaluate(()=>{
  const base={out:[20,40,80],hp:[50,60]};
  const rows=[];
  for(const x of [-5,0,5])for(const y of [-5,0,5])for(const z of [-5,0,5]){
    const next={out:[20+x,40+y,80],hp:[50+z,60]};
    const before=JSON.stringify([base,next]),r=reviewedDoubleTradeoff(base,next);
    rows.push(!r||r.outMin!==Math.min(x,y,0)||r.outMax!==Math.max(x,y,0)||r.hpMin!==Math.min(z,0)||r.hpMax!==Math.max(z,0)||r.preserved!==(x>=0&&y>=0&&z>=0)||before!==JSON.stringify([base,next]));
  }
  const invalid=[{out:[],hp:[50,60]},{out:[20,40],hp:[50,60]},{out:[20,40,NaN],hp:[50,60]}].every(x=>reviewedDoubleTradeoff(base,x)===null);
  return {total:rows.length,failed:rows.filter(Boolean).length,invalid};
});
ok(DTO.total===27&&DTO.failed===0&&DTO.invalid,'ダブル再配分：個別火力・耐久差と悪化判定 '+JSON.stringify(DTO));
const DO=await pg.evaluate(()=>{
  const mk=(no,speed)=>{const a=mkMon(byNo[no],'me',{ab:'pressure',item:null,sp:[2,32,0,0,0,32],up:1,dn:3,moves:[]});return {...a,st:a.st.map((v,i)=>i===5?speed:v),ab:'pressure',status:null,item:null}};
  const rows=[];
  for(const x of [60,100,200])for(const y of [60,100,200])for(const ownTailwind of [false,true])for(const oppTailwind of [false,true])for(const trickRoom of [false,true])for(const pa of [0,1])for(const pd of [0,1]){
    const a=mk(445,x),d=mk(184,y),m={...mvObj(89),pri:pa},n={...mvObj(583),pri:pd},before=JSON.stringify([a,d]);
    const actual=reviewedDoubleOrder(a,m,d,n,{ownTailwind,oppTailwind,trickRoom});
    const sa=x*(ownTailwind?2:1),sd=y*(oppTailwind?2:1),order=pa!==pd?Math.sign(pa-pd):Math.sign(sa-sd)*(trickRoom?-1:1);
    rows.push(!actual||actual.sa!==sa||actual.sd!==sd||actual.order!==order||JSON.stringify([a,d])!==before);
  }
  return {total:rows.length,errors:rows.filter(Boolean).length};
});
ok(DO.total===288&&DO.errors===0,'ダブル行動順：おいかぜ・トリックルーム・優先度・同速 '+JSON.stringify(DO));
const DS=await pg.evaluate(()=>{
  const mk=no=>mkMon(byNo[no],'me',{ab:'pressure',item:null,sp:[2,32,0,0,0,32],up:1,dn:3,moves:[]});
  const a=mk(445),d={...mk(184),p:{...byNo[184],t:['ノーマル']}},rows=[];
  for(const id of [89,58,85])if(MV[id]){
    const m=mvObj(id);
    for(const r of [85,92,100])for(const spread of [false,true]){
      const opt={format:'double',spread,crit:false,protean:false,r};
      const base=bcalc(a,m,d,opt).dmg,help=bcalc(a,m,d,{...opt,helpingHand:true}).dmg,guard=bcalc(a,m,d,{...opt,friendGuard:true}).dmg;
      const single=bcalc(a,m,d,{...opt,format:'single'}).dmg,ignored=bcalc(a,m,d,{...opt,format:'single',helpingHand:true,friendGuard:true}).dmg;
      rows.push({id,r,spread,error:base<=0||help<=base||Math.abs(guard-base*.75)>1||single!==ignored});
    }
  }
  return rows;
});
console.log('double support audit '+JSON.stringify(DS));
ok(DS.length>0&&DS.every(x=>!x.error),'てだすけ・フレンドガード・シングル非適用 '+JSON.stringify(DS));
const FF=await pg.evaluate(()=>{
  const mk=(no,ab)=>mkMon(byNo[no],'me',{ab,item:null,sp:[2,32,0,0,0,32],up:1,dn:3,moves:[]});
  const a=mk(445,'rough-skin'),base=mk(184,'huge-power'),rows=[];
  for(const [id,ab,types,zero] of [[89,'pressure',['ひこう'],true],[89,'levitate',['ノーマル'],true],[89,'pressure',['ノーマル'],false],[89,'telepathy',['ノーマル'],true],[57,'water-absorb',['ノーマル'],true],[57,'pressure',['ノーマル'],false],[89,'multiscale',['ノーマル'],false]]){
    if(!MV[id])continue;
    const d={...base,ab,p:{...base.p,t:types}},m=mvObj(id),before=JSON.stringify(d),x=reviewedFriendlyHit(a,m,d);
    const direct=Array.from({length:16},(_,i)=>{const y=bhits(a,m,d,{format:'double',spread:true,surv:true,protean:false,r:85+i});return d.hp-Math.max(0,y.state.hp)});
    rows.push({id,ab,error:!x||!x.targeted||(zero?x.max!==0:x.max<=0)||(ab!=='telepathy'&&(x.min!==Math.min(...direct)||x.max!==Math.max(...direct)))||JSON.stringify(d)!==before});
  }
  for(const id of [58,605,585])if(MV[id]&&mvObj(id).tg!==2){const x=reviewedFriendlyHit(a,mvObj(id),base);rows.push({id,error:!x||x.targeted||x.max!==0});}
  return rows;
});
console.log('friendly fire audit '+JSON.stringify(FF));
ok(FF.length>0&&FF.every(x=>!x.error),'味方への巻き込み・無効・対象外・乱数比較 '+JSON.stringify(FF));
const DF=await pg.evaluate(()=>{
  const mk=(no,ab,item)=>mkMon(byNo[no],'me',{ab,item,sp:[2,32,0,0,0,32],up:1,dn:3,moves:[]});
  const a=mk(445,'rough-skin',null),b=mk(184,'huge-power',null),rows=[];
  for(const [ab,item] of [['pressure',null],['multiscale',null],['sturdy',null],['pressure','focussash'],['pressure','airballoon'],['disguise',null],['stamina',null]]){
    const d=mk(65,ab,item);if(ab==='disguise')d.disg=true;
    const before=JSON.stringify(d),m=mvObj(89),n=mvObj(583),actual=reviewedDoubleFocus(a,m,b,n,d);
    const expected=[];
    for(const seq of [[[a,m],[b,n]],[[b,n],[a,m]]]){
      const hps=[];
      for(let i=85;i<=100;i++)for(let j=85;j<=100;j++){
        let target={...d,stg:{...d.stg}};
        for(const [k,[att,move]] of seq.entries()){
          if(target.hp<=0)break;
          const x=bhits(att,move,target,{format:'double',spread:!!move.tg,surv:true,protean:false,r:k?j:i});
          target={...target,hp:Math.max(0,x.state.hp),item:x.state.item,disg:x.state.disg,stg:{...x.state.stg}};
        }
        hps.push(target.hp);
      }
      expected.push({first:seq[0][0].p.no,min:Math.min(...hps),max:Math.max(...hps),ko:hps.filter(h=>h===0).length,rolls:256});
    }
    rows.push({ab,item,error:!actual||JSON.stringify(actual.orders)!==JSON.stringify(expected)||JSON.stringify(d)!==before});
  }
  return rows;
});
console.log('double focus fire audit '+JSON.stringify(DF));
ok(DF.every(x=>!x.error),'ダブル集中攻撃：両順序・全乱数・生存条件・状態保持 '+JSON.stringify(DF));
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
  const expected={276:{atk:-1,def:-1},370:{def:-1,spd:-1},315:{spa:-2},437:{spa:-2},434:{spa:-2},488:{spe:1},885:{spe:1},872:{spe:1},871:{spa:1}};
  const rows=[];
  for(const [key,delta] of Object.entries(expected)){
    const id=Number(key),m=mvObj(id);
    if(!MV[id])continue;
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
const RC=await pg.evaluate(()=>{
  const fractions={36:[1,4],38:[33,100],394:[33,100],413:[33,100],452:[33,100],834:[33,100],528:[1,4],457:[1,2],344:[33,100]};
  const rows=[],missing=[];
  for(const [key,[num,den]] of Object.entries(fractions)){
    const id=Number(key);
    // Synthetic move fixtures verify arithmetic independently of availability.
    // Separately record local data agreement for each available move.
    const m={id,drain:-100*num/den};
    if(!MV[id])missing.push({id,reason:'not in MV'});
    else if(Math.abs(mvObj(id).drain-m.drain)>1e-9)missing.push({id,reason:'local recoil mismatch',actual:mvObj(id).drain,expected:m.drain});
    for(const ab of ['rough-skin','rock-head','magic-guard','reckless','sheer-force'])for(const hp of [1,168])for(const dealt of [0,1,2,3,30,50,149,150,151,168]){
      const a={ab,hp,max:168,stg:{atk:0,def:0,spa:0,spd:0,spe:0}},before=JSON.stringify(a),out=reviewedMoveRecoilAfterHit(a,m,dealt);
      const amount=dealt===0||ab==='rock-head'||ab==='magic-guard'?0:Math.max(1,Math.floor((2*dealt*num+den)/(2*den)));
      rows.push({id,ab,hp,dealt,error:!out||out.hp!==Math.max(0,hp-amount)||JSON.stringify(a)!==before||out.stg===a.stg});
    }
  }
  const a={ab:'rough-skin',hp:168,max:168,stg:{}};
  const guard=reviewedMoveRecoilAfterHit(a,{id:38,drain:-34},150)===null&&reviewedMoveRecoilAfterHit(a,{id:89,drain:0},150)===null&&reviewedMoveRecoilAfterHit(a,{id:38,drain:-33},-1)===null;
  return {rows,missing,guard};
});
console.log('move recoil audit '+JSON.stringify({total:RC.rows.length,failed:RC.rows.filter(x=>x.error),localDataGaps:RC.missing,guard:RC.guard}));
ok(RC.rows.every(x=>!x.error)&&RC.guard,'技の反動：割合・端数・特性・ひんし・入力検証 '+JSON.stringify(RC.rows.filter(x=>x.error)));
const DH=await pg.evaluate(()=>{
  const rows=[],gaps=[];
  const fractions={409:[1,2],202:[1,2],141:[1,2],532:[1,2],577:[3,4],71:[1,2],72:[1,2],613:[3,4]};
  for(const [key,[n,d]] of Object.entries(fractions)){
    const id=Number(key),m={id,drain:100*n/d};
    if(!MV[id]||mvObj(id).drain!==m.drain)gaps.push({id,actual:MV[id]?mvObj(id).drain:null,expected:m.drain});
    for(const hp of [0,1,84,167,168])for(const dealt of [0,1,2,3,30,50,149,150,151,168]){
      const a={hp,max:168,item:null,stg:{atk:0}},before=JSON.stringify(a);
      const out=reviewedDrainAfterHit(a,m,dealt,{ab:'rough-skin'});
      const expected=hp===0?0:Math.min(168,hp+Math.floor((2*dealt*n+d)/(2*d)));
      rows.push({id,hp,dealt,error:!out||out.hp!==expected||JSON.stringify(a)!==before||out.stg===a.stg});
    }
  }
  const a={hp:84,max:168,item:null,stg:{}},m={id:409,drain:50};
  const guard=reviewedDrainAfterHit({...a,item:'bigroot'},m,10,{})===null&&reviewedDrainAfterHit(a,m,10,{ab:'liquid-ooze'})===null&&reviewedDrainAfterHit({...a,healblock:true},m,10,{})===null&&reviewedDrainAfterHit(a,{...m,drain:75},10,{})===null;
  return {rows,gaps,guard};
});
console.log('drain HP audit '+JSON.stringify({total:DH.rows.length,failed:DH.rows.filter(x=>x.error),localDataGaps:DH.gaps,guard:DH.guard}));
ok(DH.rows.every(x=>!x.error)&&DH.guard,'吸収技のHP回復・上限・端数・入力検証 '+JSON.stringify(DH.rows.filter(x=>x.error)));
const SU=await pg.evaluate(()=>{
  const specs={349:{atk:1,spe:1},14:{atk:2},417:{spa:2},483:{spa:1,spd:1,spe:1},504:{atk:2,spa:2,spe:2,def:-1,spd:-1},347:{spa:1,spd:1},339:{atk:1,def:1},97:{spe:2},334:{def:2},133:{spd:2},397:{spe:2}};
  const rows=[];
  for(const [id,delta] of Object.entries(specs))for(const stage of [-6,-5,-1,0,1,5,6])for(const ab of ['multiscale','levitate','thick-fat','reckless','hyper-cutter','shell-armor','pressure','soundproof','simple','contrary'])for(const item of ['lifeorb','leftovers']){
    const a={hp:167,max:167,ab,item,stg:Object.fromEntries(['atk','def','spa','spd','spe'].map(k=>[k,stage]))},before=JSON.stringify(a);
    const x=reviewedSetupState(a,Number(id),{ab:'rough-skin'});
    const expected={...a.stg};for(const [k,v] of Object.entries(delta))expected[k]=Math.max(-6,Math.min(6,stage+v*(ab==='simple'?2:ab==='contrary'?-1:1)));
    const changed=Object.keys(delta).some(k=>expected[k]!==stage);
    rows.push({id,stage,ab,item,error:JSON.stringify(a)!==before||(changed?(!x||x.hp!==a.hp||x.item!==item||JSON.stringify(x.stg)!==JSON.stringify(expected)||x.stg===a.stg):x!==null)});
  }
  for(const max of [1,159,160,167,168])for(const hp of [...new Set([1,Math.max(1,Math.floor(max/2)),Math.ceil(max/2),max])])for(const atk of [-6,0,5,6])for(const item of ['sitrusberry','leftovers'])for(const opp of ['unnerve','rough-skin']){
    const a={hp,max,ab:'thick-fat',item,stg:{atk,def:0,spa:0,spd:0,spe:0}},x=reviewedSetupState(a,187,{ab:opp});
    const fail=hp<=max/2||atk===6||max===1;
    let h=hp-Math.floor(max/2),it=item;if(item==='sitrusberry'&&h<=Math.floor(max/2)&&opp!=='unnerve'){h=Math.min(max,h+Math.floor(max/4));it=null}
    rows.push({id:187,max,hp,atk,item,opp,error:fail?x!==null:(!x||x.hp!==h||x.item!==it||x.stg.atk!==6)});
  }
  return {total:rows.length,failed:rows.filter(x=>x.error)};
});
console.log('shared setup audit '+JSON.stringify(SU));
const setupGuards=await pg.evaluate(()=>['simple','contrary'].every(ab=>reviewedSetupState({hp:168,max:168,ab,item:'leftovers',stg:{atk:0,def:0,spa:0,spd:0,spe:0}},187,{ab:'rough-skin'})===null));
ok(setupGuards,'はらだいこ：未検証のたんじゅん・あまのじゃくとの組合せを除外');
ok(!SU.failed.length,'共通積み技：ランク加算・上限・持ち物・HP条件 '+JSON.stringify(SU.failed));
const RH=await pg.evaluate(()=>{
  const rows=[],availability=[];
  for(const id of [105,303,135,208,456]){
    availability.push({id,present:!!MD[id]&&!MV[id]});
    for(const max of [1,2,9,10,159,160,167,168,201])for(const hp of [...new Set([0,1,Math.floor(max/2),Math.max(0,max-1),max])])for(const canAct of [false,true]){
      const a={hp,max,stg:{atk:1,def:0,spa:0,spd:0,spe:0}},before=JSON.stringify(a),out=reviewedDirectHeal(a,id,canAct);
      const expected=canAct&&hp>0?Math.min(max,hp+Math.floor((max+1)/2)):hp;
      rows.push({id,max,hp,canAct,error:!out||out.hp!==expected||JSON.stringify(a)!==before||out.stg===a.stg});
    }
  }
  const a={hp:50,max:101,stg:{}};
  const guards=[355,659,235,236,234,156,273,89].every(id=>reviewedDirectHeal(a,id,true)===null)&&reviewedDirectHeal({...a,healblock:true},105,true)===null&&reviewedDirectHeal({...a,hp:102},105,true)===null&&reviewedDirectHeal(a,105,'yes')===null;
  return {rows,availability,guards};
});
console.log('direct heal audit '+JSON.stringify({total:RH.rows.length,failed:RH.rows.filter(x=>x.error),availability:RH.availability,guards:RH.guards}));
ok(RH.rows.every(x=>!x.error)&&RH.guards,'通常回復技：最大HP・端数・行動可否・入力検証 '+JSON.stringify(RH.rows.filter(x=>x.error)));
const RE=await pg.evaluate(()=>{
  const rows=[];
  for(const max of [159,160,167,168])for(const hp of [1,Math.floor(max/2),max-1])for(const damage of [0,1,50,100,200])for(const order of [-1,0,1]){
    const a={hp,max,item:null,stg:{atk:0}},before=JSON.stringify(a);
    // Synthetic full-HP-dependent incoming loss, independently evaluated.
    const incoming=x=>x.hp===max?Math.floor(damage/2):damage;
    const x=reviewedRecoveryExchange(a,105,order,incoming);
    const healed=Math.min(max,hp+Math.floor((max+1)/2));
    const first=Math.max(0,healed-(healed===max?Math.floor(damage/2):damage));
    const after=Math.max(0,hp-damage),second=after===0?0:Math.min(max,after+Math.floor((max+1)/2));
    const expected=order===0?[first,second]:[order===1?first:second];
    rows.push({max,hp,damage,order,error:!x||x.minHP!==Math.min(...expected)||x.maxHP!==Math.max(...expected)||x.guaranteedSurvival!==expected.every(h=>h>0)||JSON.stringify(a)!==before});
  }
  const a={hp:50,max:100,item:null,stg:{}};
  const guard=reviewedRecoveryExchange(a,105,1,()=>NaN)===null&&reviewedRecoveryExchange({...a,item:'sitrusberry'},105,1,()=>20)===null&&reviewedRecoveryExchange(a,105,2,()=>20)===null;
  return {total:rows.length,failed:rows.filter(x=>x.error),guard};
});
console.log('recovery exchange audit '+JSON.stringify(RE));
ok(!RE.failed.length&&RE.guard,'回復行動：先後・同速・ひんし・HP依存被弾 '+JSON.stringify(RE));
const LE=await pg.evaluate(()=>{
  const rows=[];
  for(const max of [1,2,15,16,17,159,160,167,168,201])for(const hp of [...new Set([0,1,Math.floor(max/2),max-1,max])])for(const item of [null,'leftovers','lifeorb'])for(const healblock of [false,true]){
    const a={hp,max,item,healblock,stg:{atk:1}},before=JSON.stringify(a),out=reviewedLeftoversEnd(a);
    const expected=item==='leftovers'&&hp>0&&!healblock?Math.min(max,hp+Math.max(1,Math.floor(max/16))):hp;
    rows.push({max,hp,item,healblock,error:!out||out.hp!==expected||JSON.stringify(a)!==before||out.stg===a.stg});
  }
  for(const max of [159,160,167,168])for(const hp of [1,Math.floor(max/2),max-1])for(const damage of [0,1,50,100,200])for(const order of [-1,0,1]){
    const a={hp,max,item:'leftovers',stg:{}},x=reviewedRecoveryExchange(a,105,order,()=>damage);
    const first=Math.max(0,Math.min(max,hp+Math.round(max/2))-damage),after=Math.max(0,hp-damage),second=after?Math.min(max,after+Math.round(max/2)):0;
    const expected=(order===0?[first,second]:[order===1?first:second]).map(h=>h?Math.min(max,h+Math.max(1,Math.floor(max/16))):0);
    rows.push({max,hp,damage,order,error:!x||x.minEndHP!==Math.min(...expected)||x.maxEndHP!==Math.max(...expected)});
  }
  return {total:rows.length,failed:rows.filter(x=>x.error)};
});
console.log('leftovers recovery audit '+JSON.stringify(LE));
ok(!LE.failed.length,'たべのこし：端数・満タン・ひんし・回復封じ・回復行動の先後 '+JSON.stringify(LE));
const MO=await pg.evaluate(()=>{
  const rows=[];
  const mk=(p,ab,item)=>mkMon(p,'me',{ab,item,sp:[2,32,0,0,0,32],up:1,dn:3,moves:[]});
  for(const p of MEGAP){
    const stone=Object.keys(MEGA).find(k=>Object.values(MEGA[k]).includes(p.no));
    if(!stone)continue;
    const a=mk(p,p.ab,stone),injured={...a,hp:Math.max(1,Math.floor(a.max/2))};
    const setup=reviewedSetupState(a,14,{ab:'pressure'});
    const heal=injured.hp<injured.max?reviewedRecoveryExchange(injured,105,1,()=>0):null;
    const wrong=Object.keys(MEGA).find(k=>k!==stone&&!Object.values(MEGA[k]).includes(p.no));
    rows.push({no:p.no,stone,error:!reviewedFixedMegaItem(a)||(!!wrong&&reviewedFixedMegaItem({...a,item:wrong}))||(REVIEWED_SETUP_AB.has(a.ab)&&(!setup||setup.item!==stone))||(injured.hp<injured.max&&(!heal||heal.minEndHP!==a.max))});
  }
  const a=mk(byNo[445],'pressure',null),d=mk(byNo[65],'pressure',null);
  const speed=(x,n)=>({...x,st:x.st.map((v,i)=>i===5?n:v)});
  for(const [ab,sa,sd,pri,expected] of [['pressure',100,100,0,0],['pressure',200,100,1,-1],['pressure',50,100,-1,1],['prankster',50,100,0,1],['prankster',50,100,1,-1],['triage',50,100,2,1],['triage',50,100,4,-1]]){
    const actual=reviewedRecoveryOrder({...speed(a,sa),ab},105,speed(d,sd),{...mvObj(89),pri});
    rows.push({ab,sa,sd,pri,expected,actual,error:actual!==expected});
  }
  if(MV[332]){
    const slow=speed(a,50),fast=speed(d,100),gale={...slow,ab:'gale-wings'};
    // Faster healer wins only when the slower flying attacker is not at full HP.
    for(const full of [true,false]){
      const attacker={...gale,hp:full?gale.max:gale.max-1},actual=reviewedRecoveryOrder(fast,105,attacker,mvObj(332)),expected=full?-1:1;
      rows.push({gale:true,full,actual,expected,error:actual!==expected});
    }
  }
  return {total:rows.length,failed:rows.filter(x=>x.error),mega:rows.filter(x=>x.stone).length};
});
console.log('mega recovery and order audit '+JSON.stringify(MO));
ok(MO.mega>0&&!MO.failed.length,'メガ固定石・回復技の優先度・同速 '+JSON.stringify(MO));
const SA=await pg.evaluate(()=>{
  const rows=[];
  const deltas={276:{atk:-1,def:-1},370:{def:-1,spd:-1},315:{spa:-2},437:{spa:-2},434:{spa:-2},488:{spe:1},885:{spe:1},872:{spe:1},871:{spa:1}};
  for(const [key,delta] of Object.entries(deltas))for(const ab of ['levitate','thick-fat','reckless','hyper-cutter','shell-armor','pressure','soundproof'])for(const stage of [-6,-5,0,5,6])for(const connected of [false,true]){
    const id=Number(key);if(!MV[id])continue;const a={ab,item:null,stg:Object.fromEntries(['atk','def','spa','spd','spe'].map(k=>[k,stage]))},before=JSON.stringify(a);
    const x=reviewedSelfStageAfterHit(a,mvObj(id),connected),expected={...a.stg};
    if(connected)for(const [k,v] of Object.entries(delta))expected[k]=Math.max(-6,Math.min(6,stage+v));
    rows.push({id,ab,stage,connected,error:!REVIEWED_POST_STAGE_AB.has(ab)||!x||JSON.stringify(x.stg)!==JSON.stringify(expected)||JSON.stringify(a)!==before});
  }
  return {total:rows.length,failed:rows.filter(x=>x.error)};
});
const TD=await pg.evaluate(()=>{
  const rows=[],specs={491:['spd',-2],855:['spd',-2],886:['atk',-1],679:['atk',-1],688:['atk',-1]};
  for(const [key,[stat,delta]] of Object.entries(specs)){
    const id=Number(key);if(!MV[id])continue;
    const m=mvObj(id);
    for(const ab of ['pressure','clear-body','white-smoke','full-metal-body','hyper-cutter','shield-dust','contrary','simple','defiant','competitive'])for(const source of ['pressure','mold-breaker','sheer-force'])for(const item of [null,'covertcloak'])for(const stage of [-6,-5,0,5,6])for(const connected of [false,true]){
      const a={ab:source},d={ab,item,stg:{atk:stage,def:stage,spa:stage,spd:stage,spe:stage}},before=JSON.stringify(d),x=reviewedTargetStageAfterHit(a,m,d,connected);
      const expected={...d.stg};
      const bypass=source==='mold-breaker'&& !['full-metal-body','defiant','competitive'].includes(ab),effective=bypass?'pressure':ab;
      if(connected&&source!=='sheer-force'&&!item&&!['clear-body','white-smoke','full-metal-body','shield-dust'].includes(effective)&&!(effective==='hyper-cutter'&&stat==='atk')){
        expected[stat]=Math.max(-6,Math.min(6,stage+delta*(effective==='contrary'?-1:effective==='simple'?2:1)));
        if(expected[stat]<stage&&effective==='defiant')expected.atk=Math.min(6,expected.atk+2);
        if(expected[stat]<stage&&effective==='competitive')expected.spa=Math.min(6,expected.spa+2);
      }
      rows.push({id,ab,source,item,stage,connected,error:!x||JSON.stringify(x.stg)!==JSON.stringify(expected)||JSON.stringify(d)!==before||x.stg===d.stg});
    }
    const d={ab:'mirror-armor',item:null,stg:{atk:0,def:0,spa:0,spd:0,spe:0}};
    rows.push({id,guard:'reflection',error:reviewedTargetStageAfterHit({ab:'pressure'},m,d,true)!==null});
  }
  return {total:rows.length,failed:rows.filter(x=>x.error)};
});
console.log('target stage audit '+JSON.stringify(TD));
ok(TD.total>0&&!TD.failed.length,'相手の能力低下・防止特性・反応特性・上下限 '+JSON.stringify(TD));
const SB=await pg.evaluate(()=>[488,885,872,871].filter(id=>!!MV[id]).map(id=>{
  const m=mvObj(id),a={ab:'sheer-force',item:null,stg:{atk:0,def:0,spa:0,spd:0,spe:0}},x=reviewedSelfStageAfterHit(a,m,true);
  return {id,error:!sfSup(a,m)||!x||Object.values(x.stg).some(v=>v!==0)};
}));
ok(SB.every(x=>!x.error),'自己能力上昇：ちからずくによる追加効果の抑止 '+JSON.stringify(SB));
console.log('expanded post-stage audit '+JSON.stringify(SA));
ok(!SA.failed.length,'能力低下技：追加特性7種との組み合わせ '+JSON.stringify(SA));
console.log('remaining HP audit '+JSON.stringify(HR));
ok(HR.every(x=>x.error===false&&x.trials>0),'独立乱数の全列挙と残りHP分布が一致 '+JSON.stringify(HR));
console.log('integrated audit '+JSON.stringify(IA));
ok(IA.every(x=>!x.missing&&x.render&&x.errors.length===0&&x.valid>0&&x.attempts<=360),'統合探索：合法性・計算一致・探索上限 '+JSON.stringify(IA));
const CANDIDATE_RANK_AUDIT=await pg.evaluate(()=>{
  const a={hit:{id:1},quality:.4,repeatQuality:.4,margin:50,postMargin:40,postHP:80,endHP:40,recoveryHP:20,order:-1,postOrder:-1};
  const failures=[];let total=0;
  for(const k of ['quality','repeatQuality','margin','postMargin','postHP','endHP','recoveryHP','order','postOrder']){
    const b={...a,hit:{id:2},[k]:a[k]+(['quality','repeatQuality'].includes(k)?.1:1)};
    total++;if([a,b].sort(gmIntegratedChoiceRank)[0]!==b)failures.push('move '+k);
    total++;if(gmIntegratedBuildRank({rows:[a,a]},{rows:[a,b]})<=0)failures.push('build '+k);
    total++;if(gmIntegratedBuildRank({rows:[a,b]},{rows:[a,a]})>=0)failures.push('reverse '+k);
  }
  total++;if([{...a,hit:{id:2}},a].sort(gmIntegratedChoiceRank)[0]!==a)failures.push('tie');
  return {total,failures};
});
ok(CANDIDATE_RANK_AUDIT.total===28&&!CANDIDATE_RANK_AUDIT.failures.length,'統合探索順位：全評価指標・逆順・同値 '+JSON.stringify(CANDIDATE_RANK_AUDIT));
const STEEL_BEAM_AUDIT=await pg.evaluate(()=>{
  const m=mvObj(796),failures=[];let total=0;
  for(const max of [1,2,199,200,201])for(const hp of [...new Set([0,1,Math.floor(max/2),Math.ceil(max/2),max])])for(const ab of ['pressure','magic-guard','rock-head','sheer-force'])for(const item of [null,'lifeorb'])for(const [executed,hit] of [[false,false],[true,false],[true,true]]){
    const a={hp,max,ab,item,stg:{atk:0,def:0,spa:0,spd:0,spe:0}},before=JSON.stringify(a);
    const x=reviewedSteelBeamCost(a,m,executed);
    const y=x?reviewedLifeOrbAfterHit(x,m,hit):null;
    let expected=hp;
    if(executed&&ab!=='magic-guard')expected=Math.max(0,expected-Math.ceil(max/2));
    if(hit&&item==='lifeorb'&&ab!=='magic-guard'&&expected>0)expected=Math.max(0,expected-Math.max(1,Math.floor(max/10)));
    total++;
    if(!y||y.hp!==expected||JSON.stringify(a)!==before||y.stg===a.stg)failures.push({hp,max,ab,item,executed,hit,expected,actual:y?.hp});
  }
  const a={hp:100,max:100,ab:'pressure',stg:{}};
  for(const [state,move,executed] of [[a,{...m,pow:139},true],[a,{...m,id:1},true],[{...a,hp:101},m,true],[a,m,null]]){
    total++;if(reviewedSteelBeamCost(state,move,executed)!==null)failures.push('invalid input');
  }
  return {total,failures};
});
console.log('steel beam cost audit '+JSON.stringify(STEEL_BEAM_AUDIT));
ok(STEEL_BEAM_AUDIT.total===460&&!STEEL_BEAM_AUDIT.failures.length,'てっていこうせん：HP消費・いのちのたま・特性・入力検査 '+JSON.stringify(STEEL_BEAM_AUDIT));
const WEATHER_ATTACK_AUDIT=await pg.evaluate(()=>{
  const failures=[];let total=0;
  const check=(name,actual,expected)=>{total++;if(actual!==expected)failures.push({name,actual,expected});};
  const weather=B.weather;
  try{
    for(const [id,power,accuracy,type] of [[542,110,70,'ひこう'],[815,70,100,'じめん']]){
      const m=mvObj(id);
      check(id+' power',m.pow,power);check(id+' accuracy',m.acc,accuracy);check(id+' type',m.t,type);
      check(id+' category',m.cls,1);check(id+' hits',m.maxH,1);
      for(const w of [null,'rain','sun','sand','snow'])for(const ab of ['pressure','sheer-force','no-guard','cloud-nine','air-lock']){
        B.weather=w?{k:w}:null;
        const a={ab,item:null,stg:{acc:0}},d={ab:'pressure',item:null,stg:{eva:0}};
        const expected=ab==='no-guard'?100:id===542&&!['cloud-nine','air-lock'].includes(ab)?w==='rain'?100:w==='sun'?50:70:accuracy;
        check(id+' '+w+' '+ab,accOf(a,m,d),expected);
        check(id+' sheer force '+ab,sfOn(a,m),ab==='sheer-force');
        check(id+' secondary suppression '+ab,sfSup(a,m),ab==='sheer-force');
      }
      B.weather={k:'rain'};
      check(id+' defender weather suppression',accOf({ab:'pressure',stg:{}},m,{ab:'cloud-nine',stg:{}}),accuracy);
      const a={ab:'sheer-force',item:'lifeorb',hp:200,max:200,stg:{}};
      check(id+' life orb suppressed',reviewedLifeOrbAfterHit(a,m,true)?.hp,200);
      check(id+' ordinary life orb',reviewedLifeOrbAfterHit({...a,ab:'pressure'},m,true)?.hp,180);
    }
  }finally{B.weather=weather;}
  return {total,failures};
});
console.log('weather attack audit '+JSON.stringify(WEATHER_ATTACK_AUDIT));
ok(WEATHER_ATTACK_AUDIT.total===166&&!WEATHER_ATTACK_AUDIT.failures.length,'ぼうふう・ねっさのだいち：データ・天候・命中・ちからずく '+JSON.stringify(WEATHER_ATTACK_AUDIT));
const PSYCHIC_FANGS_AUDIT=await pg.evaluate(()=>{
  const failures=[];let total=0;
  const check=(name,condition)=>{total++;if(!condition)failures.push(name);};
  const m=mvObj(706),control=mvObj(337);
  check('metadata',m.pow===85&&m.acc===100&&m.cls===0&&m.t==='エスパー'&&m.maxH===1);
  check('contact and bite',mfl(m,'c')&&mfl(m,'b'));
  check('not sheer force',!sfOn({ab:'sheer-force'},m));
  const make=(no,moves)=>mkMon(byNo[no],'me',{ab:'pressure',item:null,sp:[0,32,0,0,0,32],up:1,dn:3,moves:moves.map(mvObj)});
  const a=make(149,[706,337]),d=make(184,[89]),weather=B.weather;
  try{
    B.weather=null;
    for(const format of ['single','double'])for(let r=85;r<=100;r++){
      const opt={format,r,crit:false,spread:false,noNext:true};
      const raw=bcalc(a,m,d,opt).dmg,screen=bcalc(a,m,d,{...opt,screen:true}).dmg;
      check(format+' '+r+' breaks screen',raw>0&&screen===raw);
      const normal=bcalc(a,control,d,opt).dmg,shielded=bcalc(a,control,d,{...opt,screen:true}).dmg;
      check(format+' '+r+' normal screen',normal>0&&shielded>0&&shielded<normal);
      const jaw=bcalc({...a,ab:'strong-jaw'},m,d,opt).dmg;
      check(format+' '+r+' strong jaw',jaw>raw);
      check(format+' '+r+' strong jaw screen',bcalc({...a,ab:'strong-jaw'},m,d,{...opt,screen:true}).dmg===jaw);
    }
  }finally{B.weather=weather;}
  return {total,failures};
});
console.log('psychic fangs audit '+JSON.stringify(PSYCHIC_FANGS_AUDIT));
ok(PSYCHIC_FANGS_AUDIT.total===131&&!PSYCHIC_FANGS_AUDIT.failures.length,'サイコファング：壁補正・かみつき・乱数・シングルダブル '+JSON.stringify(PSYCHIC_FANGS_AUDIT));
const THROAT_CHOP_AUDIT=await pg.evaluate(()=>{
  const failures=[];let total=0;
  const check=(name,condition)=>{total++;if(!condition)failures.push(name);};
  const m=mvObj(675);
  check('metadata',m.pow===80&&m.acc===100&&m.cls===0&&m.t==='あく'&&m.maxH===1);
  check('contact, not sound',mfl(m,'c')&&!mfl(m,'o'));
  const make=no=>mkMon(byNo[no],'me',{ab:'pressure',item:null,sp:[2,32,0,0,0,32],up:1,dn:3,moves:[]});
  const a=make(149),d=make(184),weather=B.weather;
  try{
    B.weather=null;
    for(const format of ['single','double'])for(let r=85;r<=100;r++){
      const opt={format,r,crit:false,spread:false,noNext:true};
      const raw=bcalc(a,m,d,opt).dmg;
      check(format+' '+r+' soundproof',raw>0&&bcalc(a,m,{...d,ab:'soundproof'},opt).dmg===raw);
      check(format+' '+r+' sheer force',bcalc({...a,ab:'sheer-force'},m,d,opt).dmg>raw);
    }
    for(const ab of ['pressure','sheer-force','magic-guard'])for(const connected of [false,true]){
      const x={...a,ab,item:'lifeorb',hp:200,max:200};
      check(ab+' '+connected+' secondary',sfSup(x,m)===(ab==='sheer-force'));
      check(ab+' '+connected+' life orb',reviewedLifeOrbAfterHit(x,m,connected)?.hp===(connected&&ab==='pressure'?180:200));
    }
  }finally{B.weather=weather;}
  return {total,failures};
});
console.log('throat chop audit '+JSON.stringify(THROAT_CHOP_AUDIT));
ok(THROAT_CHOP_AUDIT.total===78&&!THROAT_CHOP_AUDIT.failures.length,'じごくづき：データ・防音・ちからずく・いのちのたま '+JSON.stringify(THROAT_CHOP_AUDIT));
const DIRECT_ATTACK_BATCH_AUDIT=await pg.evaluate(()=>{
  const failures=[];let total=0;
  const check=(name,condition)=>{total++;if(!condition)failures.push(name);};
  const cases=[[25,120,75,0,'ノーマル',false],[402,80,100,0,'くさ',false],[398,80,100,0,'どく',true],[403,75,95,1,'ひこう',true],[231,100,75,0,'はがね',true],[348,90,100,0,'くさ',false],[529,80,95,0,'じめん',false],[280,75,100,0,'かくとう',false]];
  const make=no=>mkMon(byNo[no],'me',{ab:'pressure',item:null,sp:[2,32,0,0,0,32],up:1,dn:3,moves:[]});
  const a=make(149),rawTarget=make(184),d={...rawTarget,p:{...rawTarget.p,t:['ノーマル']}},weather=B.weather;
  try{
    B.weather=null;
    for(const [id,pow,acc,cls,type,sheer] of cases){
      const m=mvObj(id);
      check(id+' metadata',m.pow===pow&&m.acc===acc&&m.cls===cls&&m.t===type&&m.maxH===1);
      check(id+' accuracy',accOf(a,m,d)===acc);
      check(id+' sheer force',sfOn({...a,ab:'sheer-force'},m)===sheer);
      for(let r=85;r<=100;r++){
        const opt={format:'single',r,crit:false,spread:false,noNext:true};
        const hit=bcalc(a,m,d,opt).dmg,boost=bcalc({...a,ab:'sheer-force'},m,d,opt).dmg;
        check(id+' '+r+' damage',hit>0&&(sheer?boost>hit:boost===hit));
        if(id===280)check(id+' '+r+' screen',bcalc(a,m,d,{...opt,screen:true}).dmg===hit);
      }
    }
  }finally{B.weather=weather;}
  return {total,failures};
});
console.log('direct attack batch audit '+JSON.stringify(DIRECT_ATTACK_BATCH_AUDIT));
ok(DIRECT_ATTACK_BATCH_AUDIT.total===168&&!DIRECT_ATTACK_BATCH_AUDIT.failures.length,'攻撃技8種：基本データ・命中・特性・乱数・壁 '+JSON.stringify(DIRECT_ATTACK_BATCH_AUDIT));
ok(!errs.length,'エラーなし '+errs.join(' / '));
await b.close();
if(fail){console.log(`dexpage: ${fail}/${n} NG`);process.exit(1)}console.log(`dexpage: OK（${n}項目）`);
