// 2026/11/18 の見た目の直しの確認：PC の左のメニュー・左上のアイコン・スマホのホームの左のはみ出し・コミュニティの余白・ホームの右の列・ホームの通知の位置
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
let n=0,bad=0;const ok=(c,m)=>{n++;if(!c){bad++;console.error('NG',m)}};
async function page(W,H,theme='dark'){
  const ctx=await b.newContext({viewport:{width:W,height:H},locale:'ja-JP',hasTouch:W<700,isMobile:W<700});
  await ctx.addInitScript(t=>{try{localStorage.setItem('pctheme',t)}catch(e){};window.__fakeLogin=1},theme);
  const pg=await ctx.newPage();pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));
  await pg.route(/^https?:/,r=>{const p=new URL(r.request().url()).pathname;
    const J=o=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(o)});
    if(p==='/api/tl')return J({notes:[],next:null});if(p==='/api/search')return J({notes:[],users:[],next:null});if(p==='/api/tags/trend')return J({tags:[]});if(/^\/api\/u\//.test(p))return J({user:{handle:'minato',name:'ミナト',bio:'',created_at:Date.now(),notes:0,followers:0,following:0,me:true,results:[],games:{}}});
    return r.abort()});
  await pg.goto(URL0+'#/tools');await pg.waitForTimeout(700);
  await pg.evaluate(()=>{AUTH.user={getIdToken:async()=>'t'};AUTH.profile={handle:'minato',name:'ミナト',bio:'',av:null};twAuth=async()=>AUTH.profile;refreshBrand()});
  return pg}
const go=async(pg,h)=>{await pg.evaluate(h=>{location.hash=h},h);await pg.waitForTimeout(900)};
/* ---- B：PC の左のメニュー ---- */
for(const [W,H] of [[1024,800],[1280,900],[1920,1080]]){
  const pg=await page(W,H);await go(pg,'#/');
  const r=await pg.evaluate(()=>{const prim=[...document.querySelectorAll('#nav a')].map(a=>a.getAttribute('href')),more=[...document.querySelectorAll('#pc-more a.pcm, #pc-more [data-pcm], #pc-more summary.pcm')].map(a=>a.getAttribute('href')||a.dataset.pcm||'help');
    const rail=document.querySelector('.tabbar').getBoundingClientRect(),all=[...document.querySelectorAll('#pc-more .pcm')].filter(e=>!e.hidden).map(e=>e.getBoundingClientRect());
    return{prim,more,dup:more.filter(h=>prim.includes(h)),inRail:all.every(q=>q.left>=rail.left-1&&q.right<=rail.right+1),labels:getComputedStyle(document.querySelector('#pc-more .pcm-l')).position,
      titles:[...document.querySelectorAll('#pc-more .pcm')].every(e=>e.getAttribute('title')),vis:getComputedStyle(document.getElementById('pc-more')).display}});
  ok(r.vis==='flex'&&r.more.includes('#/u/minato')&&r.more.includes('#/notif')&&r.more.includes('#/bookmarks')&&r.more.includes('#/community')&&r.more.includes('settings')&&r.more.includes('help')&&r.more.some(h=>/%23%E5%AF%BE%E6%88%A6/.test(h)),W+'：左のメニューに、左から出るメニューにあった項目 '+JSON.stringify(r.more));
  ok(!r.dup.length&&r.prim.length>=5,W+'：同じ行き先を2回出さない '+JSON.stringify(r.dup));
  ok(r.inRail&&r.titles,W+'：左の列の中に収まる・名前（title）がある');
  ok(W>=1280?r.labels==='static':r.labels==='absolute',W+'：1280px以上は文字、それより狭いと記号だけ '+r.labels);
  /* 左上のアイコン：PC は自分のプロフィールへ（メニューは開かない） */
  await pg.click('#brand');await pg.waitForTimeout(700);
  ok(await pg.evaluate(()=>location.hash)==='#/u/minato'&&!(typeof DR!=='undefined'&&DR.open),W+'：左上のアイコンで自分のプロフィールへ（メニューは開かない）');
  ok(await pg.evaluate(()=>document.querySelector('#pc-more a[href="#/u/minato"]').getAttribute('aria-current'))==='page',W+'：いまの画面の項目に印');
  /* 選んでいる項目の色（2026/11/18）：スマホの下のメニューと同じテーマの色（--acc）をアイコンと名前に・下地はうすいテーマの色。
     選んでいない項目はテーマの色にしない・マウスを乗せた下地は選んでいる下地と別の色 */
  {const sel=async()=>pg.evaluate(()=>{const tmp=document.createElement('i');tmp.style.color='var(--acc)';document.body.appendChild(tmp);const acc=getComputedStyle(tmp).color;tmp.style.color='var(--acc-t)';const acct=getComputedStyle(tmp).color;tmp.remove();
      const C=e=>e&&getComputedStyle(e).color,B=e=>getComputedStyle(e).backgroundColor;
      const cur=[...document.querySelectorAll('.tabbar .tb[aria-current=page], #pc-more .pcm[aria-current=page]')];
      const oth=[...document.querySelectorAll('.tabbar .tb:not([aria-current]), #pc-more a.pcm:not([aria-current])')];
      return{acc,acct,n:cur.length,cur:cur.every(e=>C(e)===acc&&C(e.querySelector('svg'))===acc&&(!e.querySelector('span,.pcm-l')||C(e.querySelector('span,.pcm-l'))===acc)&&B(e)===acct),
        oth:oth.length>0&&oth.every(e=>C(e)!==acc&&B(e)!==acct)}});
    const p1=await sel();ok(p1.n===1&&p1.cur&&p1.oth,W+'：左の列の続きの項目（プロフィール）を選ぶと、アイコンと名前がテーマの色・ほかはそのまま '+JSON.stringify(p1));
    await go(pg,'#/tools');const p2=await sel();ok(p2.n===1&&p2.cur&&p2.oth,W+'：主な項目（ツール）も同じ選んでいる色 '+JSON.stringify(p2));
    await pg.hover('.tabbar .tb:not([aria-current])');await pg.waitForTimeout(300);
    const hv=await pg.evaluate(()=>{const h=document.querySelector('.tabbar .tb:not([aria-current]):hover'),s=document.querySelector('.tabbar .tb[aria-current=page]');return{h:getComputedStyle(h).backgroundColor,hc:getComputedStyle(h).color,s:getComputedStyle(s).backgroundColor,sc:getComputedStyle(s).color}});
    ok(hv.h!==hv.s&&hv.hc!==hv.sc&&hv.h!=='rgba(0, 0, 0, 0)',W+'：マウスを乗せた色と選んでいる色は別 '+JSON.stringify(hv));
    await pg.mouse.move(W-5,H-5)}
  /* 設定とヘルプ */
  await pg.click('#pc-more [data-pcm="settings"]');await pg.waitForTimeout(500);
  ok(await pg.evaluate(()=>{const m=document.querySelector('.setm');return !!m&&!m.hidden}),W+'：設定とプライバシーで設定の画面');
  await pg.keyboard.press('Escape');await pg.waitForTimeout(400);
  await pg.click('#pc-more summary.pcm');await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>[...document.querySelectorAll('#pc-more .pcm-sub a')].map(a=>a.getAttribute('href')).join())==='#/help,#/rules,#/guide,#/sources,#/contact,#/contact',W+'：ヘルプセンターの行き先は前と同じ');
  await pg.evaluate(()=>notifBadge(4));ok(await pg.evaluate(()=>document.getElementById('pc-nf').textContent==='4'&&!document.getElementById('pc-nf').hidden),W+'：お知らせの未読の数');
  await pg.evaluate(()=>notifBadge(0));
  {const sw=await pg.evaluate(()=>[document.documentElement.scrollWidth,innerWidth,document.querySelector('.tabbar').scrollWidth,document.querySelector('.tabbar').clientWidth,[...document.querySelectorAll('.tabbar *')].filter(e=>e.getBoundingClientRect().right>document.querySelector('.tabbar').getBoundingClientRect().right+1).map(e=>e.className+':'+Math.round(e.getBoundingClientRect().right))]);const ox=await pg.evaluate(()=>{const t=document.querySelector('.tabbar'),sub=document.querySelector('#pc-more .pcm-sub').getBoundingClientRect();return{ox:getComputedStyle(t).overflowX,sub:sub.width>0&&sub.left>=0&&sub.right<=innerWidth&&(innerWidth>=1280||sub.bottom<=innerHeight)}});
  ok(sw[0]<=sw[1]&&(sw[2]<=sw[3]+1||ox.ox==='hidden')&&ox.sub,W+'：横にはみ出さない（左の列に横のスクロールが出ない・ヘルプの一覧は画面の中） '+JSON.stringify([sw,ox]))}
  /* E：ホームの右の列（1280px以上） */
  if(W>=1280){await go(pg,'#/');
    const e=await pg.evaluate(()=>{const R=s=>document.querySelector(s).getBoundingClientRect();const hd=R('#hdr'),sr=R('#pcs-search');
      const tx=[...document.querySelectorAll('.pcside .pcs-t > span:last-child')].map(x=>Math.round(x.getBoundingClientRect().left));
      const box=[...document.querySelectorAll('.pcside .pcs-box')].map(x=>x.getBoundingClientRect());
      return{sMid:Math.round((sr.top+sr.bottom)/2),hMid:Math.round((hd.top+hd.bottom)/2),tx:[...new Set(tx)],gap:Math.round(box[1].top-box[0].bottom),boxL:[...new Set(box.map(q=>Math.round(q.left)))]}});
    ok(Math.abs(e.sMid-e.hMid)<=6,W+'：検索欄は上の見出しの行にそろう '+JSON.stringify([e.sMid,e.hMid]));
    ok(e.tx.length===1&&e.boxL.length===1&&e.gap===12,W+'：「すぐ使う」と「コミュニティ」の文の左がそろう・箱の間は12px '+JSON.stringify(e));
    const input=pg.locator('#pcs-q');
    await input.fill('  ピカチュウ  ');await input.press('Enter');
    await pg.waitForFunction(()=>decodeURIComponent(location.hash)==='#/search/ピカチュウ'&&document.querySelector('#sr-q')?.value==='ピカチュウ');
    ok(await pg.locator('#pcs-q').inputValue()==='ピカチュウ',W+'：右上でポケモンを検索');
    await input.fill('#構築相談');await pg.locator('.pcs-search-go').click();
    await pg.waitForFunction(()=>decodeURIComponent(location.hash)==='#/search/#構築相談'&&document.querySelector('#sr-q')?.value==='#構築相談');
    ok(await pg.locator('#pcs-q').inputValue()==='#構築相談',W+'：検索ボタンでタグを検索');
    await input.fill('a/b & c');await input.press('Enter');
    await pg.waitForFunction(()=>document.querySelector('#sr-q')?.value==='a/b & c');
    ok(await pg.evaluate(()=>location.hash)==='#/search/a%2Fb%20%26%20c',W+'：特殊文字を安全にURL化');
    await pg.goBack();await pg.waitForFunction(()=>document.querySelector('#pcs-q')?.value==='#構築相談');
    await input.fill('');await input.press('Enter');
    await pg.waitForFunction(()=>location.hash==='#/search'&&!!document.querySelector('#sr-live'));
    ok(await pg.locator('#pcs-q').inputValue()==='',W+'：空欄の検索は検索トップを開く');
    await pg.locator('#pcs-matchup').click();
    ok(await pg.locator('#sheet').isVisible(),W+'：相性確認も従来どおり開く');
    await pg.keyboard.press('Escape');await pg.waitForFunction(()=>document.getElementById('sheet').hidden);
  }
  /* A：コミュニティの左のふちがそろう */
  await go(pg,'#/community');
  const c=await pg.evaluate(()=>{const col=document.querySelector('#view').getBoundingClientRect(),note=document.querySelector('.cmv>.note'),r=document.createRange();r.selectNodeContents(note);const t=r.getClientRects()[0];
    const row=document.querySelector('.cmv .row').getBoundingClientRect();return{note:Math.round(t.left-col.left),card:Math.round(row.left-col.left),right:Math.round(col.right-row.right)}});
  ok(Math.abs(c.note-c.card)<=1&&c.card===c.right&&c.card>=14&&c.card<=20,W+'：コミュニティの説明の文とカードの左がそろう・左右の余白が同じ '+JSON.stringify(c));
  ok(!pg.errs.length,W+'：エラーなし '+pg.errs.join('|'));await pg.close();
}
/* ---- スマホ：左上のアイコンは今までどおりメニュー・ホームの左のふちにはみ出しがない ---- */
for(const W of [390,430]){
  const pg=await page(W,844);await go(pg,'#/');
  const vis=async()=>pg.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return r.width&&r.height&&cs.visibility!=='hidden'&&cs.display!=='none'&&(r.right>0.5&&r.left<-0.5||r.left<innerWidth-0.5&&r.right>innerWidth+0.5)}).map(e=>e.tagName+'.'+e.className));
  ok(!(await vis()).length,W+'：開いたことがない状態で左右にはみ出さない');
  await pg.click('#brand');await pg.waitForTimeout(600);ok(await pg.evaluate(()=>DR.open&&location.hash==='#/'),W+'：スマホは左上のアイコンでメニュー（前と同じ）');
  await pg.mouse.click(W-20,400);await pg.waitForTimeout(700);
  ok(await pg.evaluate(()=>!DR.open&&getComputedStyle(document.querySelector('.dr-p')).visibility==='hidden'),W+'：閉じたメニューは見えない');
  ok(!(await vis()).length,W+'：メニューを開いて閉じたあとも、左のふちにはみ出さない（影・線が出ない）');
  ok(await pg.evaluate(()=>!document.querySelector('#pc-more .pcm')||getComputedStyle(document.getElementById('pc-more')).display==='none'),W+'：スマホでは左の列の項目を出さない');
  /* ホームの通知：右のはし・ロゴと同じ行・左のアイコンの反対・重ならない */
  const bl=await pg.evaluate(()=>{const R=s=>document.querySelector(s).getBoundingClientRect();const be=R('#hd-bell'),lo=R('.hd-logo'),br=R('#brand'),hd=R('#hdr-in');
    const over=(a,b)=>!(a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom);
    return{right:Math.round(hd.right-be.right),row:Math.abs((be.top+be.bottom)/2-(lo.top+lo.bottom)/2)<=2&&Math.abs((br.top+br.bottom)/2-(lo.top+lo.bottom)/2)<=3,left:br.left<lo.left&&lo.right<be.left,ov:over(be,lo)||over(be,br),w:Math.round(be.width),h:Math.round(be.height),title:document.querySelector('#hdr-in h1').textContent}});
  ok(bl.right<=16&&bl.row&&bl.left&&!bl.ov&&bl.w>=44&&bl.h>=44&&bl.title==='',W+'：通知は右のはし・ロゴと同じ行・左のアイコンの反対・44px・「ホーム」の文字なし '+JSON.stringify(bl));
  await pg.evaluate(()=>notifBadge(2));ok(await pg.evaluate(()=>document.getElementById('hd-bell-n').textContent==='2'&&getComputedStyle(document.querySelector('#brand'),'::after').display==='none'),W+'：未読は通知の数だけ（左上の点を重ねない）');
  await pg.click('#hd-bell');await pg.waitForTimeout(600);ok(await pg.evaluate(()=>location.hash)==='#/notif',W+'：通知で #/notif');
  ok(!pg.errs.length,W+'：エラーなし '+pg.errs.join('|'));await pg.close();
}
/* ---- ホーム画面に追加したとき（端末の下の余白あり）も、メニューの下に何もない帯を作らない（2026/11/19） ----
   CDP で下の余白（safe-area-inset-bottom）を作って確かめる：メニューの下＝max(8, 余白−10)、下をふさぐ帯はそれ＋4px まで、⚡とメニューの間は同じ */
for(const [W,H,sa] of [[375,667,0],[390,844,0],[390,844,34],[430,932,34],[360,780,24]]){
  const ctx=await b.newContext({viewport:{width:W,height:H},locale:'ja-JP',hasTouch:true,isMobile:true});
  const pg=await ctx.newPage();await pg.route(/^https?:/,r=>r.abort());
  const cdp=await ctx.newCDPSession(pg);await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:sa?47:0,bottom:sa,left:0,right:0}});
  await pg.goto(URL0+'#/tools');await pg.waitForTimeout(900);
  const r=await pg.evaluate(()=>{const t=document.querySelector('.tabbar').getBoundingClientRect(),f=document.querySelector('.fabwrap .fab').getBoundingClientRect();
    const p=document.createElement('div');p.style.cssText='position:fixed;bottom:0;height:env(safe-area-inset-bottom)';document.body.appendChild(p);const sa=p.getBoundingClientRect().height;p.remove();
    const last=document.querySelector('.app').getBoundingClientRect(),pad=parseFloat(getComputedStyle(document.querySelector('.app')).paddingBottom);
    return{sa,gap:Math.round(innerHeight-t.bottom),cover:parseFloat(getComputedStyle(document.body,'::after').height),fab:Math.round(t.top-f.bottom),clear:pad>=innerHeight-t.top+20}});
  const want=Math.max(8,sa-10);
  ok(r.sa===sa&&r.gap===want&&r.cover<=want+4&&r.fab===14&&r.clear,`${W}x${H} 下の余白${sa}px：メニューの下は${want}px（何もない帯を作らない）・下をふさぐ帯は小さく・⚡との間は同じ・ページの終わりはメニューに隠れない `+JSON.stringify(r));
  await ctx.close();
}
/* ---- iPhone のホーム画面から開いたとき（navigator.standalone）、screen.height と innerHeight が違っても、下のメニューは画面の中・中身はスクロールできる ----
   2026/11/19：差の分だけページをのばしてメニューを下げる作り（vpShim）を入れたら、依頼主の iPhone でメニューが画面の下で切れ、画面も動かなくなった（もとに戻した） */
for(const ex of [0,59,62]){
  const ctx=await b.newContext({viewport:{width:390,height:780},locale:'ja-JP',hasTouch:true,isMobile:true});
  await ctx.addInitScript(ex=>{Object.defineProperty(Navigator.prototype,'standalone',{get:()=>true,configurable:true});
    Object.defineProperty(Screen.prototype,'height',{get:()=>innerHeight+ex,configurable:true})},ex);
  const pg=await ctx.newPage();await pg.route(/^https?:/,r=>r.abort());
  const cdp=await ctx.newCDPSession(pg);await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:47,bottom:34,left:0,right:0}});
  await pg.goto(URL0+'#/tools');await pg.waitForTimeout(900);
  const r=await pg.evaluate(()=>{const t=document.querySelector('.tabbar').getBoundingClientRect();return{H:innerHeight,bot:Math.round(t.bottom),top:Math.round(t.top),html:Math.round(document.documentElement.getBoundingClientRect().height)}});
  ok(r.bot<=r.H&&r.H-r.bot===24&&r.html===r.H,`ホーム画面（差${ex}px）：下のメニューは画面の中（下から24px）・ページはのばさない `+JSON.stringify(r));
  await pg.mouse.move(195,300);await pg.mouse.wheel(0,500);await pg.waitForTimeout(400);
  const top=await pg.evaluate(()=>document.body.scrollTop);ok(top>100,`ホーム画面（差${ex}px）：中身はスクロールできる（${top}）`);
  await ctx.close();
}
await b.close();
console.log(bad?`navlayout: NG（${bad}件）`:`navlayout: OK（${n}項目）`);if(bad)process.exitCode=1;
