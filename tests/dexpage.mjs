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
await tab(0);const O=await pg.evaluate(()=>document.querySelector('[data-panel="0"]').innerText);
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
await pg.evaluate(()=>{location.hash='#/p/445'});await pg.waitForTimeout(900);
const FSW=await pg.evaluate(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms)),tab=()=>document.querySelector('#seg [aria-selected="true"]').dataset.i,out=[];
  document.querySelector('#seg [data-i="3"]').click();await w(300);document.querySelector('#seg [data-i="0"]').click();await w(300);
  for(const no of [10058,10309,445,10058,445]){const a=document.querySelector(`.fam-pills a[href="#/p/${no}"]`);if(!a){out.push('no'+no);continue}a.click();await w(500);out.push(tab())}
  document.querySelector('#seg [data-i="3"]').click();await w(300);const a=document.querySelector('.fam-pills a[href="#/p/10058"]');a.click();await w(500);out.push(tab());return out});
ok(FSW.slice(0,5).every(t=>t==="0")&&FSW[5]==="3","姿を切りかえても開いていたタブのまま "+FSW.join(','));
/* 2026/11/17 依頼主：対策の番号は別々の崩し方なので「崩す手順」ではなく「崩す方法」。全部の姿で「手順」と書かない */
const BRW=await pg.evaluate(()=>{const bad=[],noH=[];[...P,...MEGAP].forEach(p=>{let h='';try{h=breakHTML(p)}catch(e){return}
  if(/手順/.test(h))bad.push(p.n);if(!/<h3>崩す方法<\/h3>/.test(h)&&/<ol class="gtips">/.test(h))noH.push(p.n)});return{bad,noH}});
ok(!BRW.bad.length&&!BRW.noH.length,'対策は「崩す方法」と書く（「手順」なし） '+JSON.stringify(BRW));
ok(!BF.tsu.length,'10以上を「Nつ」と数えない '+BF.tsu.join('・'));
ok(BF.ag.every(Boolean),'ギルガルドはブレードフォルムの攻撃で判定 '+JSON.stringify(BF.ag));
ok(BF.pf.every(Boolean),'イルカマンはマイティフォルムで判定 '+JSON.stringify(BF.pf));
ok(!errs.length,'エラーなし '+errs.join(' / '));
await b.close();
if(fail){console.log(`dexpage: ${fail}/${n} NG`);process.exit(1)}console.log(`dexpage: OK（${n}項目）`);
