// PiP の切り替えの間隔（2026/11/27 依頼主：3/4/6/8秒→4/6/8/10秒、10秒が「おすすめ」）の確認
// ①保存した値の移し替え（3→4、4/6/8 はそのまま、はじめは4）②どの入口でも同じボタン ③動画の長さが選んだ間隔どおり
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
let n=0;const fail=m=>{console.error('NG',m);process.exitCode=1};const ok=(c,m)=>{n++;if(!c)fail(m)};
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const open=async(saved,hash='#/pip')=>{
  const ctx=await b.newContext({viewport:{width:390,height:844},locale:'ja-JP'});
  await ctx.addInitScript(s=>{try{if(!sessionStorage.getItem('__i')){localStorage.setItem('pcstart','1');if(s===null)localStorage.removeItem('pcpip');else localStorage.setItem('pcpip',s)}sessionStorage.setItem('__i','1')}catch(e){}},saved);
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(URL0+hash);await pg.waitForTimeout(700);return{ctx,pg,errs};
};
const cards='"cards":["type","memo"]';
/* ① 移し替え */
for(const [saved,want,keep] of [[null,4],[`{${cards},"sec":3}`,4,1],[`{${cards},"sec":4}`,4,1],[`{${cards},"sec":6}`,6,1],[`{${cards},"sec":8}`,8,1],[`{${cards},"sec":10}`,10,1],[`{${cards}}`,4,1],[`{${cards},"sec":7}`,4,1]]){
  const {ctx,pg,errs}=await open(saved);
  const r=await pg.evaluate(()=>({sec:PIP.cfg.sec,seg:SEG_(),cards:PIP.cfg.cards.slice(0,2),st:JSON.parse(localStorage.getItem('pcpip')||'null')}));
  ok(r.sec===want&&r.seg===want,`保存 ${saved} → ${want}秒（${r.sec}）`);
  if(keep)ok(JSON.stringify(r.cards)==='["type","memo"]','ほかの設定（カード）はそのまま '+saved);
  if(saved&&/"sec":3/.test(saved))ok(r.st&&r.st.sec===4,'3秒の保存は4秒に書き直す');
  ok(!errs.length,'エラーなし '+errs.join(' / '));
  await ctx.close();
}
/* ② 入口ごとのボタン */
const {ctx,pg,errs}=await open(null,'#/pip');
await pg.evaluate(()=>{team.length=0;team.push({no:445},{no:479});saveTeam&&saveTeam()});
const btns=async()=>pg.$$eval('#pip-sec [data-ps]',a=>a.map(x=>({v:+x.dataset.ps,t:x.textContent.trim(),on:x.getAttribute('aria-pressed')})));
const check=async(where)=>{const a=await btns();
  ok(JSON.stringify(a.map(x=>x.v))==='[4,6,8,10]',where+'：ボタンは4/6/8/10秒 '+JSON.stringify(a.map(x=>x.v)));
  ok(a.find(x=>x.v===10)&&/10秒\s*おすすめ/.test(a.find(x=>x.v===10).t)&&a.filter(x=>/おすすめ/.test(x.t)).length===1,where+'：10秒だけ「おすすめ」');
  ok(!a.some(x=>x.v===3),where+'：3秒はない');
  return a};
for(const [h,where] of [['#/pip','PiP（対戦）'],['#/assist','選出アシスト']]){
  await pg.evaluate(h=>{if(h==='#/pip'){PIPV='battle'}location.hash=h},h);await pg.waitForTimeout(600);
  if(h==='#/pip'){await pg.evaluate(()=>{PIPV='battle';pipView()});await pg.waitForTimeout(200)}
  const a=await check(where);ok(a.find(x=>x.v===4).on==='true',where+'：はじめは4秒を選んでいる');
}
await pg.evaluate(()=>{PIPV='build';location.hash='#/tools';});await pg.waitForTimeout(300);
await pg.evaluate(()=>{location.hash='#/pip'});await pg.waitForTimeout(500);
await pg.evaluate(()=>{PIPV='build';pipView()});await pg.waitForTimeout(200);
await check('PiP（育成）');
await pg.click('#pip-sec [data-ps="10"]');await pg.waitForTimeout(100);
ok(await pg.evaluate(()=>PIP.cfg.sec===10&&JSON.parse(localStorage.getItem('pcpip')).sec===10&&document.querySelector('#pip-sec [data-ps="10"]').getAttribute('aria-pressed')==='true'),'10秒を押すと保存して選んだ状態');
await pg.evaluate(()=>{location.hash='#/edit/0'});await pg.waitForTimeout(700);
if(await pg.$('#ed-pipw')){const a=await check('育成の編集');ok(a.find(x=>x.v===10).on==='true','育成の編集：同じ設定（10秒）を選んでいる');
  await pg.click('#ed-pipw [data-ps="6"]');await pg.waitForTimeout(100);ok(await pg.evaluate(()=>PIP.cfg.sec===6),'育成の編集：押すと変わる')}
else fail('育成の編集に PiP の欄がない');
/* 育成モード：「この1匹」と「パーティ全員」のどちらでも、同じ設定で選べて、動画が選んだ間隔どおり（育成の編集と #/pip の育成の両方） */
const stubEnc=async()=>pg.evaluate(async()=>{
  const real=window.Mp4Muxer;PIP.pages=pipBuildPages();
  if(!PIP.cv){PIP.cv=document.createElement('canvas');PIP.cv.width=PIP_W;PIP.cv.height=PIP_H}
  const ch=[];window.Mp4Muxer={Muxer:class{constructor(){this.target={buffer:new ArrayBuffer(8)}}addVideoChunk(c){ch.push({ts:c.timestamp,d:c.duration,key:c.type==='key'})}finalize(){}},ArrayBufferTarget:class{}};
  let err=null;try{await pipEncodeWC()}catch(e){err=e.message}window.Mp4Muxer=real;
  return{err,pages:PIP.pages.length,end:ch.length?Math.max(...ch.map(c=>c.ts+(c.d||0))):0,keys:ch.filter(c=>c.key).map(c=>c.ts),sec:PIP.cfg.sec}});
for(const [entry,root,go] of [['育成の編集','#ed-pipw',async()=>{await pg.evaluate(()=>{location.hash='#/tools'});await pg.waitForTimeout(200);await pg.evaluate(()=>{location.hash='#/edit/0'});await pg.waitForTimeout(700)}],
  ['PiP（育成）','#pipv-w',async()=>{await pg.evaluate(()=>{location.hash='#/pip'});await pg.waitForTimeout(500);await pg.evaluate(()=>{PIPV='build';pipView()});await pg.waitForTimeout(200)}]]){
  for(const [mode,sel,want] of [['この1匹',entry==='育成の編集'?'[data-pball="0"]':'[data-pbi="0"]',1],['パーティ全員','[data-pball="1"]',3]]){
    await go();
    await pg.click(root+' '+sel);await pg.waitForTimeout(100);
    const ball=await pg.evaluate(()=>PIP.ball);ok(ball===(want>1),`${entry}・${mode}：表示するポケモンが切りかわる`);
    for(const sec of [4,6,8,10]){
      await pg.click(`${root} #pip-sec [data-ps="${sec}"]`);await pg.waitForTimeout(60);
      const st=await pg.evaluate(()=>({sec:PIP.cfg.sec,ball:PIP.ball,saved:JSON.parse(localStorage.getItem('pcpip')).sec,on:[...document.querySelectorAll('#pip-sec [data-ps]')].filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>+b.dataset.ps),sig:JSON.parse(JSON.stringify(['build',PIP.bidx,PIP.ball,team,PIP.cfg.sec]))[4]}));
      ok(st.sec===sec&&st.saved===sec&&JSON.stringify(st.on)===`[${sec}]`&&st.ball===(want>1),`${entry}・${mode}：${sec}秒を選ぶと共通の設定に保存・表示（モードはそのまま）`);
      const t=await stubEnc();
      if(t.err){console.log('（VideoEncoder なし：'+t.err+'）');continue}
      ok(t.pages===want,`${entry}・${mode}：カードの枚数 ${t.pages}（期待 ${want}）`);
      ok(Math.abs(t.end-want*sec*1e6)<=2&&t.keys.length===want&&t.keys.every((k,i)=>Math.abs(k-i*sec*1e6)<=2),`${entry}・${mode}：${sec}秒ごと・長さ ${t.end/1e6}秒`);
    }
  }
  /* モードを切りかえても間隔は変わらない */
  await pg.click(`${root} #pip-sec [data-ps="8"]`);await pg.click(root+' [data-pball="1"]');await pg.waitForTimeout(60);
  ok(await pg.evaluate(()=>PIP.cfg.sec===8&&document.querySelector('#pip-sec [data-ps="8"]').getAttribute('aria-pressed')==='true'),`${entry}：パーティ全員に切りかえても8秒のまま`);
}
/* 間隔を変えると、育成の動画を作り直す（同じ動画を使い回さない） */
ok(await pg.evaluate(()=>{PIP.mode='build';const k=s=>JSON.stringify(['build',PIP.bidx,PIP.ball,team,s]);return k(4)!==k(10)&&/PIP\.cfg\.sec\]\):pipBattleKey/.test(pipBuild.toString())}),'育成の動画の鍵に間隔が入っている');
/* ③ 動画の長さ：VideoEncoder の時刻（MP4 に入る値）と、録画の代わりの再生速度 */
const tm=await pg.evaluate(async()=>{
  const out={};const real=window.Mp4Muxer;
  for(const sec of [4,6,8,10]){
    PIP.cfg.sec=sec;PIP.mode='build';PIP.ball=true;PIP.pages=pipBuildPages();
    if(!PIP.cv){PIP.cv=document.createElement('canvas');PIP.cv.width=PIP_W;PIP.cv.height=PIP_H}
    const ch=[];window.Mp4Muxer={Muxer:class{constructor(){this.target={buffer:new ArrayBuffer(8)}}addVideoChunk(c){ch.push({ts:c.timestamp,d:c.duration,key:c.type==='key'})}finalize(){}},ArrayBufferTarget:class{}};
    let r=null,err=null;try{r=await pipEncodeWC()}catch(e){err=e.message}
    const end=ch.length?Math.max(...ch.map(c=>c.ts+(c.d||0))):0;
    const keys=ch.filter(c=>c.key).map(c=>c.ts);
    out[sec]={err,pages:PIP.pages.length,end,keys,rate:r&&r.rate};
  }
  window.Mp4Muxer=real;
  return out});
for(const sec of [4,6,8,10]){const t=tm[sec];
  if(t.err){console.log('（VideoEncoder が使えない環境のため時刻の確認を飛ばす：'+t.err+'）');continue}
  ok(Math.abs(t.end-t.pages*sec*1e6)<=2,`${sec}秒：動画の長さ ${t.end/1e6}秒＝${t.pages}枚×${sec}秒`);
  ok(t.keys.length===t.pages&&t.keys.every((k,i)=>Math.abs(k-i*sec*1e6)<=2),`${sec}秒：カードの切りかわりが${sec}秒ごと ${t.keys.map(k=>k/1e6)}`);
  ok(t.rate===1,`${sec}秒：等速で再生`);
}
/* 録画の代わり：1枚1秒を録って 1/間隔 の速さで再生＝1枚が間隔の秒数 */
const rr=await pg.evaluate(()=>{const o={};for(const s of [4,6,8,10]){PIP.cfg.sec=s;o[s]=1/SEG_()}return o});
for(const s of [4,6,8,10])ok(Math.abs(rr[s]*s-1)<1e-9,`録画の代わり：${s}秒の再生速度 1/${s}`);
/* ヘルプ */
ok(await pg.evaluate(()=>/4・6・8・10秒/.test(HOWTO.pip.tips.join(''))&&/10秒（おすすめ）/.test(HOWTO.pip.tips.join(''))),'使い方に間隔の説明');
ok(!errs.length,'エラーなし '+errs.join(' / '));
await ctx.close();await b.close();
console.log(`PiP の切り替えの間隔：${n}項目を確認${process.exitCode?'（失敗あり）':''}`);
