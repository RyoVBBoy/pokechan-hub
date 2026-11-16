// 図鑑のページだけの実戦データ（81-cbd-detail.js、2026/11/16 依頼主「限定して、決まりに合う形で再開」）の確認
// 提供元（Pokémon Champions Battle Data）は、決まった中身のにせものに置きかえる（本物には通信しない）。
// ①「型・育成」タブを開いたときにだけ、その1匹・その形式の分を1回読む ②出典の文とリンク ③集計期間・レギュレーション・対戦数は「不明」、
// 取得した時刻は実際に読めた時刻、並び順は「使用率ではない」と書く ④端末に何も残さない ⑤ほかの画面（流行・ランキング・診断・選出）は休止のまま
// ⑥読めない・データなしをはっきり出す（前のデータを出さない）⑦PokéKit・当サイトの計算の所に提供元の出典を付けない
import {chromium} from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
const SHOT=process.env.SHOT||'';
let n=0;const ok=(c,m,x)=>{n++;if(!c){console.error('NG',m,x===undefined?'':JSON.stringify(x).slice(0,400));process.exitCode=1}};
const E={stat_up:'',stat_down:'',hp_points:'',attack_points:'',defense_points:'',sp_atk_points:'',sp_def_points:'',speed_points:''};
const R=(pos,category,rank,name,pv,x={})=>({pokemon:'X',column_position:pos,category,rank,name,percentage:pv==null?'':pv+'%',...E,...x,percentage_value:pv});
const FIX=(fmt,pos)=>({pokemon:'Garchomp',showdownId:'garchomp',format:fmt,season:'Current',date:null,source:'x.csv',columns:[],rows:[
  R(pos,'move',1,'Earthquake',75.5),R(pos,'move',2,'Dragon Claw',41.2),R(pos,'move',3,'Totally New Move',3.3),R(pos,'move',4,'Protect',null),
  R(pos,'held_item',1,'Choice Scarf',32.8),R(pos,'held_item',2,'<img src=x onerror=alert(1)>',1.1),
  R(pos,'teammate',1,'Primarina',null),
  R(pos,'stat_alignment',1,'Jolly',31,{stat_up:'Speed',stat_down:'Sp. Atk'}),R(pos,'stat_alignment',2,'Serious',2.5),
  R(pos,'stat_points',1,'',34,{hp_points:2,attack_points:32,defense_points:0,sp_atk_points:0,sp_def_points:0,speed_points:32}),
  R(pos,'ability',1,'Rough Skin',99.2)]});
const ATTR='Battle data provided by Pokémon Champions Battle Data';
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
for(const W of [390,1280]){
  const ctx=await b.newContext({viewport:{width:W,height:W<700?844:900},locale:'ja-JP',hasTouch:W<700,isMobile:W<700,deviceScaleFactor:SHOT?2:1});
  await ctx.addInitScript(()=>{try{if(!sessionStorage.getItem('__i')){localStorage.setItem('pcstart','1');localStorage.setItem('pcidx',JSON.stringify({t:Date.now(),v:{garchomp:'Garchomp'}}));
    localStorage.setItem('pccsv3single445',JSON.stringify({t:Date.now(),v:{mv:[['Old Cached Move',99]],it:[],ab:[],tm:[],nat:[],sp:[],rank:7}}))}sessionStorage.setItem('__i','1')}catch(e){}});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  const reqs=[];let mode='ok';
  await pg.route(/championsbattledata\.com/,async r=>{const u=decodeURIComponent(r.request().url());reqs.push(u);
    const H={'Access-Control-Allow-Origin':'*','Content-Type':'application/json'};
    if(mode==='err')return r.fulfill({status:500,headers:H,body:'{}'});
    if(mode==='none')return r.fulfill({status:404,headers:H,body:'{}'});
    if(mode==='empty')return r.fulfill({headers:H,body:JSON.stringify({format:/\/Doubles\//.test(u)?'Doubles':'Singles',rows:[]})});
    const m=u.match(/\/api\/battle\/(Singles|Doubles)\/garchomp$/);
    if(!m)return r.fulfill({status:404,headers:H,body:'{}'});
    await new Promise(z=>setTimeout(z,mode==='slow'?900:120));
    /* wrongfmt：頼んだ形式と違う形式の答え（見出しを取りちがえないよう、使わない） */
    const f=mode==='wrongfmt'?(m[1]==='Singles'?'Doubles':'Singles'):m[1];
    return r.fulfill({headers:H,body:JSON.stringify(FIX(f,m[1]==='Singles'?1:3))})});
  const store=()=>pg.evaluate(async()=>({ls:Object.keys(localStorage).sort().map(k=>k+'='+localStorage.getItem(k).length),ss:Object.keys(sessionStorage).sort(),idb:(indexedDB.databases?(await indexedDB.databases()).map(d=>d.name):[]).sort(),
    cs:typeof caches!=='undefined'&&caches.keys?await caches.keys().catch(()=>[]):[]}));
  const tab=async i=>{await pg.click(`#seg [data-i="${i}"]`);await pg.waitForTimeout(500)};
  await pg.goto(URL0+'#/p/445');await pg.waitForTimeout(1200);
  const st0=await store();
  ok(reqs.length===0,W+'：ページを開いただけでは読まない',reqs);
  /* 読み込み中：小さな表示（データ・出典の文はまだ出さない） */
  mode='slow';const t0=Date.now();await pg.click('#seg [data-i="4"]');await pg.waitForTimeout(200);
  const ld=await pg.$eval('#cbdd-box',e=>({st:(e.querySelector('[data-cbdd]')||{}).dataset?.cbdd,t:e.innerText,h:e.getBoundingClientRect().height}));
  ok(ld.st==='loading'&&/読み込んでいます/.test(ld.t)&&!/%|取得/.test(ld.t)&&ld.h<140,W+'：読み込み中は小さな表示だけ',ld);
  ok(await pg.$eval('#cbdd-box',e=>!!e.querySelector('[data-cbdd]')),W+'：「型・育成」タブに置き場所');
  await pg.waitForSelector('#cbdd-box [data-cbdd="ok"]',{timeout:5000}).catch(()=>{});mode='ok';await pg.waitForTimeout(200);
  ok(reqs.length===1&&/\/api\/battle\/Singles\/garchomp$/.test(reqs[0]),W+'：タブを開くと、その1匹・その形式の分を1回だけ読む',reqs);
  /* いつも見える所（たたんだ状態）と、たたんだ中を分けて取り出す */
  const v=await pg.$eval('#cbdd-box',e=>{const d=e.querySelector('details.cbdd-more'),c=e.querySelector('[data-cbdd]').cloneNode(true);c.querySelector('details')?.remove();
    const a=[...e.querySelectorAll('.cbdd-attr a')],ar=a[0]&&a[0].getBoundingClientRect();
    return{vis:e.innerText,out:c.textContent,det:d?d.textContent:'',open:d?d.open:null,sumTxt:d?d.querySelector('summary').textContent:'',
      title:(e.querySelector('.cbdd-h')||{}).textContent,sum:(e.querySelector('.cbdd-sum')||{}).textContent,
      a:a.map(x=>[x.textContent,x.href,x.target,x.rel,!!x.closest('details')]),aVis:!!ar&&ar.width>0&&ar.height>0,
      at:+(e.querySelector('[data-cbdd-at]')||{dataset:{}}).dataset.cbddAt,img:e.querySelectorAll('img').length,w:e.getBoundingClientRect().right<=innerWidth+1,
      rows:[...e.querySelectorAll('.cbdd-r>b')].map(x=>x.textContent),firstRowTop:(e.querySelector('.cbdd-r')||{getBoundingClientRect:()=>({top:1e9})}).getBoundingClientRect().top-e.getBoundingClientRect().top}});
  ok(v.title==='ランクバトルの集計（シングル）',W+'：見出しは形式どおり',v.title);
  const atD=new Date(v.at),pad=x=>String(x).padStart(2,'0');
  ok(v.sum===`並び順 1位 · ${atD.getMonth()+1}/${atD.getDate()} ${pad(atD.getHours())}:${pad(atD.getMinutes())}取得`,W+'：1行のまとめ＝提供元の並び順と取得した時刻',v.sum);
  ok(v.at>=t0-50&&v.at<=Date.now()+50,W+'：取得した時刻は実際に読めた時刻',[v.at,t0]);
  ok(v.open===false&&/^データの見方・注意書き\s*▼$/.test(v.sumTxt.trim()),W+'：注意書きは「データの見方・注意書き ▼」で、はじめは閉じている',[v.open,v.sumTxt]);
  ok(v.rows.join()==='技,持ち物,特性,性格,能力ポイント'&&v.firstRowTop<90,W+'：技・持ち物・特性・性格・能力ポイントが、見出しのすぐ下に並ぶ',[v.rows,v.firstRowTop]);
  ok(/じしん\s*75\.5%/.test(v.vis)&&/ドラゴンクロー\s*41\.2%/.test(v.vis)&&/こだわりスカーフ\s*32\.8%/.test(v.vis)&&/さめはだ\s*99\.2%/.test(v.vis),W+'：技・持ち物・特性は提供元の割合のまま（閉じたままで見える）',v.vis.slice(0,500));
  ok(/ようき（素早さ↑特攻↓）\s*31%/.test(v.vis)&&/Serious（補正なし）\s*2\.5%/.test(v.vis)&&/HP2・攻撃32・素早さ32\s*34%/.test(v.vis),W+'：性格・能力ポイントの振り方（閉じたままで見える）',v.vis);
  ok(/まもる\s*割合不明/.test(v.vis)&&!/まもる\s*\d/.test(v.vis),W+'：提供元に割合がない項目は「割合不明」（数字を作らない）');
  ok(v.a.length===1&&v.a[0][0]===ATTR&&v.a[0][1]==='https://championsbattledata.com/'&&v.a[0][2]==='_blank'&&!v.a[0][4]&&v.aVis,W+'：出典の文とリンクは、閉じたままで見える（たたむ所の外）',v.a);
  ok(/集計期間\s*不明/.test(v.det)&&/レギュレーション\s*不明/.test(v.det)&&/対戦数\s*不明/.test(v.det),W+'：集計期間・レギュレーション・対戦数は「不明」（たたむ所の中）',v.det.slice(0,300));
  ok(/表示している順位は提供元の並び順です。ポケモンの使用率を示すものではありません。/.test(v.det)
    &&/それぞれの項目ごとの集計です。これらを組み合わせた「1つの型」の使用率ではありません。/.test(v.det)
    &&/項目の正確な意味や集計方法は確認できていないため、参考情報としてご覧ください。/.test(v.det)&&/取得した日時から推し量っていません/.test(v.det),W+'：注意書き（並び順・項目ごとの割合・能力ポイント・不明の理由）はたたむ所の中',v.det);
  ok(!/集計期間|レギュレーション|対戦数|使用率を示す|1つの型|参考情報/.test(v.out),W+'：いつも見える所には注意書き・不明の欄を出さない',v.out.slice(0,400));
  ok(!/使用率\s*1位|使用率ランキング|位（使用率/.test(v.vis+v.det),W+'：並び順を使用率と書かない');
  ok(!/M-[A-C]|シーズン|Current|現行|現在の/.test(v.vis+v.det),W+'：レギュレーション・シーズンを書かない',(v.vis+v.det).match(/M-[A-C]|シーズン|Current|現行|現在の/));
  ok(/Totally New Move\s*3\.3%/.test(v.vis)&&v.img===0&&/<img src=x/.test(v.vis),W+'：表にない名前は提供元の文字のまま（HTML として動かさない）');
  ok(!/Old Cached Move|Primarina|アシレーヌ/.test(v.vis+v.det),W+'：端末に残っていた前の値・一緒に使われるポケモンは出さない');
  ok(v.w,W+'：枠が画面に収まる');
  {const hs=await pg.$$eval('#cbdd-box .cbdd-r>b',a=>a.map(b=>[b.textContent,b.getBoundingClientRect().height,parseFloat(getComputedStyle(b).lineHeight)]));ok(hs.every(([,h,lh])=>h<lh*1.5+4),W+'：項目名（能力ポイント等）が1行に収まる',hs)}
  /* 開く：キーボード（スマホは指で押す）。開いても出典は同じ所に見える */
  if(W<700)await pg.tap('#cbdd-box summary');else{await pg.focus('#cbdd-box summary');await pg.keyboard.press('Enter')}
  await pg.waitForTimeout(250);
  const op=await pg.$eval('#cbdd-box',e=>{const d=e.querySelector('details'),a=e.querySelector('.cbdd-attr a').getBoundingClientRect(),m=d.querySelector('.cbdd-meta').getBoundingClientRect();return{open:d.open,meta:m.height>0,a:a.height>0,vis:e.innerText}});
  ok(op.open&&op.meta&&op.a&&/集計期間\s*不明/.test(op.vis),W+'：'+(W<700?'指で押す':'キーボード（Enter）')+'と開いて、中が見える・出典も見えたまま',op);
  if(SHOT){await pg.$eval('#cbdd-box',e=>e.scrollIntoView({block:'start'}));await pg.evaluate(()=>{const g=document.getElementById('seg');document.body.scrollTop-=(g?g.getBoundingClientRect().bottom:60)+8});await pg.waitForTimeout(150);await pg.screenshot({path:path.join(SHOT,'cbdd2-'+W+'-open.png')})}
  if(W<700)await pg.tap('#cbdd-box summary');else await pg.keyboard.press('Enter');
  await pg.waitForTimeout(250);ok(await pg.$eval('#cbdd-box details',d=>!d.open),W+'：もう一度押すと閉じる');
  if(SHOT){await pg.$eval('#cbdd-box',e=>e.scrollIntoView({block:'start'}));await pg.evaluate(()=>{const g=document.getElementById('seg');document.body.scrollTop-=(g?g.getBoundingClientRect().bottom:60)+8});await pg.waitForTimeout(150);await pg.screenshot({path:path.join(SHOT,'cbdd2-'+W+'-closed.png')})}
  /* ほかの所に提供元の出典を付けない・型の一覧に「集計の型」を作らない */
  const o=await pg.evaluate(A=>({attr:[...document.querySelectorAll('#view *')].filter(e=>e.children.length===0&&e.textContent.includes(A)).length,
    live:LIVE.csv[445],off:LIVE.off,files:LIVE.files,liveSets:monGuide(byNo[445],{parts:true}).sets.filter(s=>s.live).length,card:/ランクバトルでよく使われている型/.test(document.getElementById('bdpanel').innerText),
    theory:/当サイトが計算で組んだ提案/.test(document.getElementById('bdpanel').innerText),mvp:typeof mvpSet==='function'&&!!MVP_DATA.version}),ATTR);
  ok(o.attr===1,W+'：出典の文は実戦データの枠の中だけ',o.attr);
  ok(o.live===undefined&&o.off===true&&o.files===null&&o.liveSets===0&&!o.card,W+'：全体の集計（LIVE）には入れない・組み合わせた型を作らない',o);
  ok(o.theory&&o.mvp,W+'：当サイトの提案・PokéKit はそのまま');
  /* 同じ画面の描き直しでは読み直さない・形式を変えるとその形式を読む */
  await tab(0);await tab(4);ok(reqs.length===1,W+'：タブを開き直しても読み直さない',reqs.length);
  await pg.click('#bdpanel [data-dpf="double"]');await pg.waitForSelector('#cbdd-box [data-cbdd="ok"]',{timeout:5000}).catch(()=>{});await pg.waitForTimeout(200);
  ok(reqs.length===2&&/Doubles\/garchomp$/.test(reqs[1])&&await pg.$eval('#cbdd-box',e=>e.querySelector('.cbdd-h').textContent==='ランクバトルの集計（ダブル）'&&/^並び順 3位 · /.test(e.querySelector('.cbdd-sum').textContent)),W+'：ダブルに切りかえるとダブルの分を読む（見出しもダブル）',reqs);
  /* 端末に残さない */
  const st1=await store();
  ok(JSON.stringify(st1)===JSON.stringify(st0),W+'：localStorage・sessionStorage・IndexedDB・Cache に何も足さない',[st0,st1]);
  ok(await pg.evaluate(()=>Object.keys(localStorage).every(k=>!/garchomp|Earthquake/i.test(localStorage.getItem(k)||'')||/^pc(idx|csv3)/.test(k))),W+'：集計の中身を端末に書かない');
  /* 読めないとき：はっきり出す・前のデータを出さない・読み直せる */
  mode='err';await pg.evaluate(()=>{location.hash='#/p/149'});await pg.waitForTimeout(700);
  ok(await pg.evaluate(()=>CBDD.key===null&&CBDD.d===null),W+'：ほかのポケモンに移ったら前の分を捨てる');
  await pg.evaluate(()=>{location.hash='#/p/445'});await pg.waitForTimeout(900);await tab(4);await pg.waitForSelector('#cbdd-box [data-cbdd="err"]',{timeout:5000}).catch(()=>{});
  const e1=await pg.$eval('#cbdd-box',e=>({t:e.innerText,retry:!!e.querySelector('[data-cbdd-retry]'),attr:e.querySelectorAll('.cbdd-attr a').length}));
  ok(/集計を読み込めませんでした/.test(e1.t)&&e1.retry&&e1.attr===1&&!/じしん|%|取得/.test(e1.t),W+'：読めないときは「読み込めませんでした」（前のデータ・時刻を出さない・やり直せる・出典の文）',e1);
  mode='ok';await pg.click('[data-cbdd-retry]');await pg.waitForSelector('#cbdd-box [data-cbdd="ok"]',{timeout:5000}).catch(()=>{});
  ok(await pg.$eval('#cbdd-box',e=>/じしん/.test(e.innerText)),W+'：「もう一度読み込む」で読める');
  mode='none';await pg.evaluate(()=>{location.hash='#/p/6'});await pg.waitForTimeout(900);await tab(4);await pg.waitForSelector('#cbdd-box [data-cbdd="none"]',{timeout:5000}).catch(()=>{});
  ok(await pg.$eval('#cbdd-box',e=>/提供元にありませんでした/.test(e.innerText)&&!/%|取得|並び順/.test(e.innerText)&&e.querySelectorAll('.cbdd-attr a').length===1),W+'：データがないときは「ありませんでした」');
  /* 答えはあるが使える行がない：データなしと同じ。形式が違う答え：見出しを取りちがえないよう、読めなかった扱い */
  mode='empty';await pg.evaluate(()=>{location.hash='#/p/149'});await pg.waitForTimeout(700);await pg.evaluate(()=>{location.hash='#/p/6'});await pg.waitForTimeout(900);await tab(4);
  await pg.waitForSelector('#cbdd-box [data-cbdd="none"]',{timeout:5000}).catch(()=>{});
  ok(await pg.$eval('#cbdd-box',e=>e.querySelector('[data-cbdd]').dataset.cbdd==='none'&&!/%/.test(e.innerText)),W+'：使える行がない答えは「ありませんでした」');
  mode='wrongfmt';await pg.evaluate(()=>{location.hash='#/p/149'});await pg.waitForTimeout(700);await pg.evaluate(()=>{location.hash='#/p/445'});await pg.waitForTimeout(900);await tab(4);
  await pg.waitForSelector('#cbdd-box [data-cbdd="err"]',{timeout:5000}).catch(()=>{});
  ok(await pg.$eval('#cbdd-box',e=>e.querySelector('[data-cbdd]').dataset.cbdd==='err'&&!/じしん|%/.test(e.innerText)),W+'：頼んだ形式と違う答えは使わない（見出しを取りちがえない）');
  /* 提供元の名前と対応がない匹：通信しない・出典の文も出さない */
  {const noid=await pg.evaluate(()=>(P.find(q=>!q.base&&!ENSP[q.no])||{}).no);
    if(noid){const k=reqs.length;await pg.evaluate(h=>{location.hash=h},'#/p/'+noid);await pg.waitForTimeout(900);await tab(4);
      ok(reqs.length===k&&await pg.$eval('#cbdd-box',e=>e.querySelector('[data-cbdd]').dataset.cbdd==='noid'&&!e.querySelector('.cbdd-attr')),W+'：提供元の名前と対応がない匹は読まず、そう書く')}
    else ok(await pg.evaluate(()=>cbddHTML(byNo[445],'single',{st:'noid'}).includes('対応がない')),W+'：提供元の名前と対応がない匹の表示（全部の匹に対応があるので、表示だけ確かめる）')}
  if(SHOT&&W<700){mode='err';await pg.evaluate(()=>{location.hash='#/p/149'});await pg.waitForTimeout(900);await tab(4);await pg.waitForSelector('#cbdd-box [data-cbdd="err"]',{timeout:5000}).catch(()=>{});
    await pg.$eval('#cbdd-box',e=>e.scrollIntoView({block:'start'}));await pg.evaluate(()=>{const g=document.getElementById('seg');document.body.scrollTop-=(g?g.getBoundingClientRect().bottom:60)+8});await pg.waitForTimeout(150);await pg.screenshot({path:path.join(SHOT,'cbdd2-'+W+'-err.png')});mode='ok'}
  /* メガシンカの姿のページでは読まない */
  mode='ok';const nMega=reqs.length;const mega=await pg.evaluate(()=>(P.concat(typeof MEGAP!=='undefined'?MEGAP:[]).find(q=>q.base===445)||{}).no);
  if(mega){await pg.evaluate(h=>{location.hash=h},'#/p/'+mega);await pg.waitForTimeout(900);await tab(4);
    ok(reqs.length===nMega&&!(await pg.$('#cbdd-box')),W+'：メガシンカの姿のページでは読まない',reqs.slice(nMega))}
  /* ほかの画面は休止のまま・読みにいかない */
  const nOther=reqs.length;
  for(const h of ['#/tier','#/meta','#/team','#/assist','#/calc','#/pair','#/dex']){await pg.evaluate(h=>{location.hash=h},h);await pg.waitForTimeout(600)}
  ok(reqs.length===nOther,W+'：ほかの画面（ランキング・流行・パーティ・選出・計算・相性・図鑑の一覧）からは読まない',reqs.slice(nOther));
  await pg.evaluate(()=>{location.hash='#/tier'});await pg.waitForTimeout(500);
  ok(await pg.$eval('#view',e=>e.textContent.includes('ランキングは、いま休止しています')&&!e.querySelector('.tr-r')),W+'：ランキングは休止のまま');
  await pg.evaluate(()=>{location.hash='#/meta'});await pg.waitForTimeout(500);
  ok(await pg.$eval('#view',e=>e.textContent.includes('いま休止しています')&&!e.querySelector('.rk')),W+'：流行は休止のまま');
  ok(await pg.evaluate(()=>CBDD.key===null&&CBDD.d===null),W+'：図鑑のページを離れたら、読んだ分を捨てる');
  ok(!errs.length,W+'：エラーなし',errs);
  await ctx.close();
}
await b.close();
/* スイッチ：全体は休止のまま、図鑑のページだけ別のスイッチ。書きこむ処理を足していない */
{const s=fs.readFileSync(path.join(ROOT,'src/js/81-cbd-detail.js'),'utf8'),code=s.replace(/\/\*[\s\S]*?\*\//g,'');
  ok(/const CBD_DETAIL=true;/.test(s)&&/const CBD_ON=false,CBD_PERSIST=false;/.test(fs.readFileSync(path.join(ROOT,'src/js/15-battle.js'),'utf8')),'全体は休止のまま・図鑑のページだけ別のスイッチ');
  ok(!/localStorage|sessionStorage|indexedDB|lsSet|lsGet|caches\.|LIVE\.csv|META\.|COMM_API/.test(code)&&/cache:'no-store'/.test(code),'81-cbd-detail.js は端末・サーバー・全体の集計に書かない');
  ok(/const CBD_ON=false,CBD_CACHE=false;/.test(fs.readFileSync(path.join(ROOT,'worker/src/worker_src.js'),'utf8'))&&/const RANK_PAUSED=true;/.test(fs.readFileSync(path.join(ROOT,'worker/src/rankbot.js'),'utf8'))&&/const CBD_ON=false;/.test(fs.readFileSync(path.join(ROOT,'tools/gen-pages.cjs'),'utf8')),'サーバー・bot・公開のページは休止のまま');
  ok(!fs.readFileSync(path.join(ROOT,'dist/pokemon/445/index.html'),'utf8').includes('championsbattledata.com/api')&&!fs.existsSync(path.join(ROOT,'dist/assets/tier.json')),'検索向けの静的ページには集計を入れない・tier.json なし')}
console.log(process.exitCode?'cbddetail: NG':`cbddetail: OK（${n}項目）`);
