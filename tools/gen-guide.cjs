// ツールの画面の「画面で見る使い方」（84-toolsguide.js）の画像を、当サイトの実際の画面から撮る（2026/11/16）。
// 使い方：node tools/build.mjs のあとに  node tools/gen-guide.cjs  → もう一度 node tools/build.mjs
//   ・dist/index.html をスマホの幅（390px・2倍）で、暗い色と明るい色の両方で開き、画面の上の部分を切り出して
//     src/static/guide-*.webp（暗い色）・guide-*-light.webp（明るい色）に書く（2026/11/16 依頼主：まわりの画面と色をそろえる）
//   ・押す場所（丸い枠）の位置は画像に焼きこまず、画像に対する％で src/js/83-guide-shots.js（TG_SHOTS）に書く（このファイルは手で直さない）
//   ・公式の画像は使っていない（当サイトはポケモンを種族値の図形で描く）。画面を変えたら撮り直す
const path=require('path'),fs=require('fs');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..'),URL0='file://'+path.join(ROOT,'dist/index.html');
const W=390,DPR=2,Q=0.8;
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const out={};
  for(const [cs,sfx,key] of [['dark','','d'],['light','-light','l']]){
  const ctx=await b.newContext({viewport:{width:W,height:1400},deviceScaleFactor:DPR,locale:'ja-JP',colorScheme:cs,hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  await ctx.addInitScript(()=>{try{if(!sessionStorage.getItem('__g')){localStorage.clear();localStorage.setItem('pcstart','1');localStorage.setItem('pctoolsguide','1')}sessionStorage.setItem('__g','1')}catch(e){}});
  const pg=await ctx.newPage();await pg.route(/^https?:/,r=>r.abort());
  await pg.goto(URL0+'#/tools');await pg.waitForFunction(()=>typeof TEAMS==='object'&&!!document.querySelector('.tprim'));
  const go=async(h,sel)=>{await pg.evaluate(h=>{location.hash=h},h);await pg.waitForSelector(sel,{state:'visible'});await pg.waitForTimeout(700);
    await pg.evaluate(()=>{document.querySelectorAll('.toast').forEach(e=>e.remove());if(typeof scrTo==='function')scrTo(0,0)});await pg.waitForTimeout(150)};
  const rect=sel=>pg.$eval(sel,e=>{const r=e.getBoundingClientRect();return{x:r.left,y:r.top,w:r.width,h:r.height,b:r.bottom}});
  /* 切り出し（top〜bottom、CSS px）と枠（ring の要素）。枠は少し広げる */
  async function shot(id,top,bottom,ringSel){
    top=Math.max(0,Math.floor(top));bottom=Math.ceil(bottom);const h=bottom-top;
    const png=await pg.screenshot({clip:{x:0,y:top,width:W,height:h}});
    const r=await rect(ringSel),pad=4;
    const webp=await pg.evaluate(async([b64,q])=>{const im=new Image();im.src='data:image/png;base64,'+b64;await im.decode();
      const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);
      return c.toDataURL('image/webp',q).split(',')[1]},[png.toString('base64'),Q]);
    const f='guide-'+id+sfx+'.webp';fs.writeFileSync(path.join(ROOT,'src/static',f),Buffer.from(webp,'base64'));
    const pc=(v,t)=>Math.round(v/t*1000)/10;
    (out[id]=out[id]||{w:W})[key]={f,h,r:[pc(Math.max(0,r.x-pad),W),pc(Math.max(0,r.y-pad-top),h),pc(Math.min(W,r.w+pad*2),W),pc(Math.min(h,r.h+pad*2),h)]};
    console.log(id,cs,f,h+'px',Math.round(Buffer.from(webp,'base64').length/1024)+'KB');
  }
  await go('#/tools','.tprim-g');
  await shot('tools',0,(await rect('.tprim')).b+12,'.tprim-g');
  await go('#/calc','#calc-root .cv-vs');
  const cv=await rect('#calc-root .cv-vs'),res=await rect('#calc-root .cres-big').catch(()=>cv);
  await shot('calc',0,Math.min(Math.max(cv.b,res.b)+60,cv.b+300),'#calc-root .cv-vs');
  await go('#/team','#tonb-pick');
  await shot('team',0,(await rect('#tonb')).b+12,'#tonb-pick');
  await go('#/tools','.tquick');
  const q=await rect('.tquick'),row=await rect('#view .trow');
  await shot('pin',q.y-6,row.b+8,'#view .trow .tpin');
  await ctx.close();
  }
  fs.writeFileSync(path.join(ROOT,'src/js/83-guide-shots.js'),
    '/* tools/gen-guide.cjs が作るファイル（手で直さない）：ツールの使い方の画像と、押す場所の枠（画像に対する％：左・上・幅・高さ）。d＝暗い色・l＝明るい色 */\n'+
    'const TG_SHOTS='+JSON.stringify(out)+';\n');
  await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
