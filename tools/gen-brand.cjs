/* サイト名の画像を作り直す（2026/11/09 サイト名を「Game Kid/s」に変えたときに作成）。
   node tools/gen-brand.cjs で src/static/ の og-site.png・og-party.png・icon-192/512・apple-touch-icon・badge-96 を作る。
   文字は HTML で書いて Playwright で写真にする（公式の画像は使わない）。サイトのマークは src/static/logo.png（白い方位の星）。 */
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const ST=path.join(__dirname,'..','src','static');
const NAME='Game Kid/s',URL_TXT='game-kids.app';
const logo='data:image/png;base64,'+fs.readFileSync(path.join(ST,'logo.png')).toString('base64');
const FONT=`Inter,'IPAPGothic','IPAGothic',sans-serif`;
const BG=`background:#0f1020;background-image:radial-gradient(900px 500px at 10% 0%,rgba(31,111,180,.55),transparent 60%),radial-gradient(700px 500px at 100% 100%,rgba(88,52,160,.55),transparent 60%);`;
const og=(title,sub)=>`<div style="width:1200px;height:630px;${BG}display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:${FONT};color:#fff">
  <img src="${logo}" style="width:150px;height:150px;margin-top:20px">
  <div style="font-weight:800;font-size:${title.length>8?72:96}px;margin-top:26px;letter-spacing:.01em">${title}</div>
  <div style="font-weight:700;font-size:30px;color:#c9cbe0;margin-top:22px">${sub}</div>
  <div style="position:absolute;bottom:34px;font-size:22px;color:#8a8ca3">${URL_TXT}</div></div>`;
const icon=s=>`<div style="width:${s}px;height:${s}px;background:linear-gradient(140deg,#3a7bfd 0%,#7b3fe4 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:${FONT};color:#fff">
  <div style="font-weight:900;font-size:${s*.42}px;line-height:1;letter-spacing:-.02em">GK</div>
  <div style="font-weight:800;font-size:${s*.12}px;margin-top:${s*.04}px;letter-spacing:.08em">KID/S</div></div>`;
const badge=s=>`<div style="width:${s}px;height:${s}px;display:flex;align-items:center;justify-content:center;font-family:${FONT};color:#fff;font-weight:900;font-size:${s*.5}px">GK</div>`;
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const shot=async(html,w,h,file,transparent)=>{const pg=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:1});
    await pg.setContent(`<!doctype html><html><body style="margin:0;${transparent?'background:transparent':''}">${html}</body></html>`);await pg.waitForTimeout(150);
    await pg.screenshot({path:path.join(ST,file),omitBackground:!!transparent,clip:{x:0,y:0,width:w,height:h}});await pg.close();console.log('wrote',file)};
  await shot(og(NAME,'ポケモンチャンピオンズの選出・ダメージ計算・パーティ診断'),1200,630,'og-site.png');
  await shot(og('このパーティを見る',`ポケモンチャンピオンズ｜${NAME}`),1200,630,'og-party.png');
  for(const [s,f] of [[192,'icon-192.png'],[512,'icon-512.png'],[180,'apple-touch-icon.png']])await shot(icon(s),s,s,f);
  await shot(badge(96),96,96,'badge-96.png',true);
  await b.close();
})();
