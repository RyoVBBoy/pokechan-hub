// ランクバトルの集計の休止（2026/11/16 依頼主の指示：提供元の利用条件を確かめ終わるまで）の確認
// ・サイト：集計を読みにいかない／端末に残した前の値（pcidx・pccsv3・pcmetalast・pctier）を読まない・書かない・消さない／休止中の表示
// ・サーバー：POST でも GET でも集計を読まない・Cloudflare のキャッシュを使わない
// ・公開のページ：ranking/ は休止中のページ、tier.json は作らない、ほかの検索向けページは作る
// 休止をやめる（CBD_ON を true に戻す）ときは、このテストも見直す
import {chromium} from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
let n=0;const ok=(c,m,x)=>{n++;if(!c){console.error('NG',m,x===undefined?'':JSON.stringify(x).slice(0,300));process.exitCode=1}};

/* ---- 1. サーバー ---- */
const hits={cbd:0,cacheMatch:0,cachePut:0};
globalThis.caches={default:{match:async()=>{hits.cacheMatch++;return null},put:async()=>{hits.cachePut++}}};
globalThis.fetch=async(url)=>{url=String(url);
  if(url.includes('championsbattledata')){hits.cbd++;return new Response('pokemon,column_position,category,rank,name,percentage\nGarchomp,1,held_item,1,Choice Scarf,55.0%\nGarchomp,1,move,1,Earthquake,90.0%\n')}
  if(url.includes('models?'))return new Response(JSON.stringify({models:[{name:'models/gemini-3.8-flash',supportedGenerationMethods:['generateContent']}]}));
  if(url.includes('generateContent'))return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({opponent:[
   {name:'オニシズクモ',types:['みず','むし'],confidence:.9},{name:'ルカリオ',types:['かくとう','はがね'],confidence:.9},{name:'ソウブレイズ',types:['ほのお','ゴースト'],confidence:.8},
   {name:'ガブリアス',types:['ドラゴン','じめん'],confidence:.9},{name:'ジャローダ',types:['くさ'],confidence:.9},{name:'ピクシー',types:['フェアリー'],confidence:.9}]})}]}}]}));
  return new Response('',{status:404})};
const w=(await import(path.join(ROOT,'worker/dist/worker.js'))).default;
const CTX={waitUntil(){}};
const text=encodeURIComponent('ガブリアス ルカリオ ジャローダ ピクシー オニシズクモ ソウブレイズ');
for(const q of ['','&ladder=1','&mode=full']){
  const r=await w.fetch(new Request(`https://x.dev/?text=${text}&team=130,3,6,547,983,1000${q}`),{},CTX);
  ok(r.status===200&&(await r.text()).length>0,'GET /?text= は答える（集計なしで）'+q,r.status)}
{const r=await w.fetch(new Request('https://x.dev/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'ガブリアス ルカリオ ジャローダ',team:'130,3,6,547,983,1000'})}),{LEGACY_TAP:'1'},CTX);ok(r.status===200,'POST（文字）は答える',r.status)}
{const img=new Uint8Array(4096);img.set([137,80,78,71,13,10,26,10]);
  const r=await w.fetch(new Request('https://x.dev/',{method:'POST',headers:{'content-type':'image/png','x-team':'130,3,6,547,983,1000'},body:img}),{GEMINI_API_KEY:'k',LEGACY_TAP:'1'},CTX);
  ok(/選出/.test(await r.text()),'POST（画像）は集計なしで計算して答える')}
ok(hits.cbd===0,'サーバー：GET・POST のどちらからも集計を読みにいかない',hits);
ok(hits.cacheMatch===0&&hits.cachePut===0,'サーバー：Cloudflare のキャッシュを読まない・書かない',hits);
{const src=fs.readFileSync(path.join(ROOT,'worker/src/worker_src.js'),'utf8');
  ok(/const CBD_ON=false,CBD_CACHE=false;/.test(src),'サーバー：休止のスイッチが切ってある');
  ok(src.split('championsbattledata.com/pokemon_champions_assets').length===3&&(src.match(/caches\.default/g)||[]).length===1&&(src.match(/cacheTtl:21600/g)||[]).length===1,'サーバー：集計を読む所は cbdGet の1か所を通る（キャッシュの処理はその中だけ）')}
{const src=fs.readFileSync(path.join(ROOT,'worker/src/rankbot.js'),'utf8');ok(/const RANK_PAUSED=true;/.test(src)&&src.indexOf('if(RANK_PAUSED)return')<src.indexOf("'/assets/tier.json'"),'ランキングbot：tier.json を読む前に止まる')}

/* ---- 2. 公開のページ ---- */
const D=p=>path.join(ROOT,'dist',p);
{const h=fs.readFileSync(D('ranking/index.html'),'utf8'),body=h.replace(/[\s\S]*<main>/,'').replace(/<\/main>[\s\S]*/,'');
  ok(body.includes('ランキングは、いま休止しています')&&body.includes('利用条件を確認'),'ranking/：休止中のページ');
  ok(!/tr-r|tr-why|Sランク|環境の中心|位|%/.test(body.replace(/<[^>]+>/g,'')),'ranking/：順位・使用率などの数字を出さない',body.replace(/<[^>]+>/g,'').slice(0,200));
  ok(/<meta name="robots" content="noindex">/.test(h),'ranking/：検索に載せない印');
  ok(!fs.existsSync(D('assets/tier.json')),'tier.json を作らない');
  const sm=fs.readFileSync(D('sitemap.xml'),'utf8');
  ok(!sm.includes('/ranking/'),'sitemap に ranking/ を入れない');
  ok(fs.existsSync(D('pokemon/445/index.html'))&&fs.existsSync(D('counter/445/index.html'))&&fs.existsSync(D('type'))&&fs.existsSync(D('build'))&&sm.includes('/pokemon/445/')&&sm.includes('/counter/445/'),'ほかの検索向けページ（図鑑・対策・タイプ・構築の型・sitemap）は作る');
  const gp=fs.readFileSync(path.join(ROOT,'tools/gen-pages.cjs'),'utf8');ok(/const CBD_ON=false;/.test(gp),'gen-pages：休止のスイッチが切ってある');
  const wf=fs.readFileSync(path.join(ROOT,'.github/workflows/deploy.yml'),'utf8');ok(wf.includes("cron: '7 20 * * *'"),'毎朝の作り直し（schedule）はそのまま')}

/* ---- 3. サイト ---- */
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const yday=new Date(Date.now()-864e5).toISOString().slice(0,10);
const SEED={pcidx:JSON.stringify({t:Date.now()-36e5,v:{garchomp:'Garchomp'}}),
  pccsv3single445:JSON.stringify({t:Date.now()-36e5,v:{mv:[['Earthquake',90]],it:[['Choice Scarf',55]],ab:[],tm:[],nat:[],sp:[],rank:1}}),
  pcmetalastsingle:JSON.stringify({at:Date.now()-864e5,r:[[445,1],[149,2],[887,3]],t:[]}),
  ['pctiersingle'+yday]:JSON.stringify({at:Date.now()-864e5,live:true,fmt:'single',n:3,opps:3,rows:[{p:445,tier:'S',u:1,good:[],bad:[],mega:null}]})};
for(const W of [390,1280]){
  const ctx=await b.newContext({viewport:{width:W,height:W<700?844:900},locale:'ja-JP',hasTouch:W<700,isMobile:W<700});
  await ctx.addInitScript(S=>{try{if(!sessionStorage.getItem('__i')){localStorage.setItem('pcstart','1');for(const k in S)localStorage.setItem(k,S[k]);
    localStorage.setItem('pcteams',JSON.stringify({cur:0,list:[{name:'',team:[{no:445,sel:true},{no:149,sel:true},{no:887,sel:true}]},{name:'',team:[]},{name:'',team:[]}]}))}sessionStorage.setItem('__i','1')}catch(e){}},SEED);
  const pg=await ctx.newPage();const errs=[];let cbd=0;pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(/championsbattledata/,r=>{cbd++;r.abort()});
  const go=async h=>{await pg.evaluate(h=>{location.hash=h},h);await pg.waitForTimeout(700)};
  await pg.goto('file://'+D('index.html')+'#/tier');await pg.waitForTimeout(1200);
  ok(await pg.$eval('#view',e=>e.textContent.includes('ランキングは、いま休止しています')&&!e.querySelector('.tr-r')&&!e.querySelector('.fbk')),W+'：#/tier は休止中の表示（前のランキングを出さない）');
  await go('#/meta');
  ok(await pg.$eval('#view',e=>e.textContent.includes('いま休止しています')&&!e.querySelector('.rk')&&!e.querySelector('.mteam')&&!e.querySelector('.fbk')),W+'：#/meta は休止中の表示（前に読めた集計を出さない）');
  ok(await pg.$eval('#view',e=>!!e.querySelector('.fmtsw')&&!!e.querySelector('a[href="#/season"]')),W+'：#/meta は形式の切りかえ・上位パーティへの入口を残す');
  await go('#/p/445');await go('#/team');await go('#/assist');await go('#/calc');
  ok(await pg.$eval('#view',e=>/%/.test(e.textContent)),W+'：ダメージ計算は動く');
  const st=await pg.evaluate(async S=>{
    const r1=await liveInit(),r2=await liveMon(445),r3=await metaLoad();
    const keys=Object.keys(localStorage).filter(k=>/^(pcidx|pccsv3|pcmetalast|pctier)/.test(k)).sort();
    return{r1,r2,r3,off:LIVE.off,at:LIVE.at,files:LIVE.files,csv:Object.keys(LIVE.csv).length,rank:META.rank.length,keys,same:Object.keys(S).every(k=>localStorage.getItem(k)===S[k]),
      note:SRC.ladder.note,info:srcInfoHTML('ladder'),det:!!detSet(byNo[445]).moves.length,
      mvp:typeof MVP_DATA==='object'&&!!MVP_DATA.version&&typeof mvpSet==='function',top:typeof topLoad==='function'&&typeof TOPT==='object',usage:typeof usageGet==='function'&&typeof usageMetaHTML==='function',
      team:team.length,dmg:(()=>{const a=mkMon(byNo[445],detSet(byNo[445])),d=mkMon(byNo[149],detSet(byNo[149]));return estHit(a,d).pct>0})()}},SEED);
  ok(st.r1===false&&st.r2===null&&st.r3===false&&st.off===true,W+'：liveInit・liveMon・metaLoad は読みにいかない',st);
  ok(st.files===null&&st.csv===0&&st.rank===0,W+'：端末に残した前の集計（pcidx・pccsv3）を読まない',st);
  ok(st.at===null,W+'：取得した日（LIVE.at）に、開いた時刻を入れない',st.at);
  ok(st.same&&st.keys.length===Object.keys(SEED).length,W+'：前に残した値は消さない・新しく書かない',st.keys);
  ok(cbd===0,W+'：集計の提供元へ通信しない',cbd);
  ok(!/M-C/.test(st.note)&&/不明/.test(st.note),W+'：出典の説明から「M-C のデータ」を外した',st.note);
  ok(/集計期間<\/span><b>不明/.test(st.info)&&/レギュレーション<\/span><b>不明/.test(st.info)&&/対戦数<\/span><b>不明/.test(st.info)&&/取得日<\/span><b>休止中/.test(st.info),W+'：取得日・集計期間・レギュレーション・対戦数を別々に出す（不明は不明）');
  ok(st.det&&st.dmg&&st.mvp&&st.top&&st.usage&&st.team===3,W+'：自動の型・ダメージ計算・PokéKit・上位パーティ・当サイトの集計・パーティの保存は動く',st);
  ok(!errs.length,W+'：エラーなし',errs);
  await ctx.close();
}
await b.close();
console.log(process.exitCode?'cbdpause: NG':`cbdpause: OK（${n}項目）`);
