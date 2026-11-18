// プレイヤーカード（#/u/ID）を、見本の人で手元で見るための道具（レビュー用。本番のデータ・サーバーには触らない）。
//   node tools/build.mjs                       … 先にサイトを組み立てる（dist/）
//   node tools/pcard-review.mjs                … http://localhost:8790/ で開く（Ctrl+C で止める）
//   node tools/pcard-review.mjs shots [フォルダ] … 390px と 1280px のスクリーンショットを撮る（はじめは docs/social-redesign/player-card-review/screenshots）
// サイトの /api/* の代わりに tests/fixtures/pcard-users.mjs の見本を返す。ほかの外への通信はしない。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {PCARD_USERS,PCARD_NOTES} from '../tests/fixtures/pcard-users.mjs';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const DIST=path.join(ROOT,'dist'),PORT=+process.env.PORT||8790;
if(!fs.existsSync(path.join(DIST,'index.html'))){console.error('dist/ がありません。先に node tools/build.mjs を実行してください。');process.exit(1)}
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};
/* 見本の画面：サイトの API の向き先をこのサーバーにし、ログインの読み込み（Firebase）を止める */
const BOOT=`<script>try{localStorage.setItem('pccomm',location.origin);localStorage.setItem('pcstart','1');localStorage.setItem('pchowto','{"all":1}')}catch(e){}window.PC_REVIEW=1</script>`;
const J=(res,o,st=200)=>{res.writeHead(st,{'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*','access-control-allow-headers':'*'});res.end(JSON.stringify(o))};
function api(u,res){
  let m;
  if((m=u.pathname.match(/^\/api\/u\/(\w+)$/))){const x=PCARD_USERS[m[1].toLowerCase()];return x?J(res,{user:x}):J(res,{error:'ユーザーが見つかりません。'},404)}
  if((m=u.pathname.match(/^\/api\/u\/(\w+)\/notes$/))){const x=PCARD_USERS[m[1].toLowerCase()];return J(res,x&&x.locked?{notes:[],next:null,locked:true}:{notes:u.searchParams.get('media')==='1'?[]:PCARD_NOTES(m[1].toLowerCase()),next:null})}
  if(u.pathname==='/api/notifs/count')return J(res,{n:0,requests:0,dm:0});
  /* タイムライン：見本の人の投稿を並べる（レビュー用） */
  if(u.pathname==='/api/tl')return J(res,{notes:['ren','yui','akari'].flatMap(h=>PCARD_NOTES(h).slice(0,1)),next:null});
  return J(res,{});
}
function serve(){
  const srv=http.createServer((req,res)=>{const u=new URL(req.url,'http://x');
    if(req.method==='OPTIONS')return J(res,{});
    if(u.pathname.startsWith('/api/'))return api(u,res);
    if(u.pathname.startsWith('/m/')){res.writeHead(404);return res.end()}
    let f=path.join(DIST,decodeURIComponent(u.pathname));if(!f.startsWith(DIST)){res.writeHead(403);return res.end()}
    if(u.pathname==='/'||!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(DIST,'index.html');
    let body=fs.readFileSync(f);
    if(f.endsWith('index.html'))body=Buffer.from(body.toString().replace('<head>','<head>'+BOOT));
    res.writeHead(200,{'content-type':TYPES[path.extname(f)]||'application/octet-stream'});res.end(body)});
  return new Promise(r=>srv.listen(PORT,'127.0.0.1',()=>r(srv)));
}
export const PCARD_PAGES=[
  ['ren','公開アカウント・確認済み＋自己申告（訪問者として）'],['kagi','非公開アカウント（フォローしていない人として）'],
  ['minato','本人の画面（非公開アカウント・ゲームはフォロワーのみ）'],['akari','確認済みだけ（レートだけの行もある）'],
  ['sora','自己申告だけ'],['yui','戦績なしのゲームカード（相棒と看板パーティだけ）'],['nao','ゲームカードが「自分だけ」（訪問者には何も出ない）'],
  ['riku','ゲームカードなし（訪問者として。アイコンを押すと大きく見る）'],['mio','写真のアイコン・ゲームカードなし（アイコンを押すと画像を見る画面）'],['kenta','戦績はあるが、ゲームカードは作っていない（カードの入口も輪もない）'],['hajime','はじめたばかりの本人（ゲームカードを作るの入口だけ）']];
const mode=process.argv[2]||'serve';
const srv=await serve();
if(mode==='serve'){
  console.log(`プレイヤーカードの見本：http://localhost:${PORT}/#/u/ren`);
  PCARD_PAGES.forEach(([h,t])=>console.log(`  http://localhost:${PORT}/#/u/${h}  … ${t}`));
  console.log('止めるときは Ctrl+C');
}else if(mode==='shots'){
  const out=path.resolve(process.argv[3]||path.join(ROOT,'docs/social-redesign/player-card-review/screenshots'));fs.mkdirSync(out,{recursive:true});
  const {chromium}=await import('playwright');
  const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  for(const [W,H] of [[390,844],[1280,900]])for(const [h] of PCARD_PAGES){
    const ctx=await b.newContext({viewport:{width:W,height:H},deviceScaleFactor:2,locale:'ja-JP',isMobile:W<700,hasTouch:W<700});
    await ctx.addInitScript(()=>{try{localStorage.setItem('pctheme','dark')}catch(e){}});
    const pg=await ctx.newPage();await pg.route(u=>!/^http:\/\/(localhost|127\.0\.0\.1):/.test(String(u)),r=>r.abort());
    await pg.goto(`http://localhost:${PORT}/#/u/${h}`);await pg.waitForSelector('.gkp',{timeout:15000});await pg.waitForTimeout(700);
    await pg.screenshot({path:path.join(out,`${h}-${W}.png`)});
    const full=await pg.evaluate(()=>{const s=document.scrollingElement;return Math.max(document.body.scrollHeight,s?s.scrollHeight:0)});
    await pg.setViewportSize({width:W,height:Math.min(full+40,4000)});await pg.waitForTimeout(400);
    await pg.screenshot({path:path.join(out,`${h}-${W}-full.png`)});
    /* ゲームカード（あれば開いて撮る） */
    await pg.setViewportSize({width:W,height:H});await pg.waitForTimeout(200);
    if(await pg.$('#pf-card')){await pg.click('#pf-card');await pg.waitForSelector('.gkcm.on');await pg.waitForTimeout(450);
      await pg.screenshot({path:path.join(out,`${h}-${W}-card.png`)});
      const ch=await pg.evaluate(()=>{const p=document.querySelector('.gkcm-p');return p.scrollHeight});
      await pg.setViewportSize({width:W,height:Math.min(ch+(W<700?0:60),4000)});await pg.waitForTimeout(400);
      await pg.screenshot({path:path.join(out,`${h}-${W}-card-full.png`)})}
    await ctx.close();console.log('撮影',h,W)}
  /* ホーム（右上の通知）と、明るい色（プロフィール・カード） */
  for(const [W,H] of [[390,844],[1280,900]])for(const th of ['dark','light']){
    const ctx=await b.newContext({viewport:{width:W,height:H},deviceScaleFactor:2,locale:'ja-JP',isMobile:W<700,hasTouch:W<700});
    await ctx.addInitScript(t=>{try{localStorage.setItem('pctheme',t)}catch(e){}},th);
    const pg=await ctx.newPage();await pg.route(u=>!/^http:\/\/(localhost|127\.0\.0\.1):/.test(String(u)),r=>r.abort());
    await pg.goto(`http://localhost:${PORT}/#/`);await pg.waitForSelector('#hd-bell',{timeout:15000});await pg.waitForTimeout(800);
    await pg.screenshot({path:path.join(out,`home-${W}-${th}.png`),clip:{x:0,y:0,width:W,height:Math.min(H,420)}});
    /* 未読がある見た目（見本：notifBadge(3) を呼んだだけ。本物の数ではない） */
    await pg.evaluate(()=>notifBadge(3));await pg.waitForTimeout(150);
    await pg.screenshot({path:path.join(out,`home-${W}-${th}-unread-sample.png`),clip:{x:0,y:0,width:W,height:Math.min(H,420)}});
    if(th==='light'){await pg.goto(`http://localhost:${PORT}/#/u/ren`);await pg.waitForSelector('.gkp');await pg.waitForTimeout(700);
      await pg.screenshot({path:path.join(out,`ren-${W}-light.png`)});await pg.click('#pf-card');await pg.waitForSelector('.gkcm.on');await pg.waitForTimeout(450);
      await pg.screenshot({path:path.join(out,`ren-${W}-light-card.png`)})}
    await ctx.close();console.log('撮影 home',W,th)}
  await b.close();srv.close();
}
