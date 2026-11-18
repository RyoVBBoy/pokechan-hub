// ふつうのプロフィール（#/u/ID）と、別に開くゲームカード（2026/11/18 作りかえ）の確認。見本の人は tests/fixtures/pcard-users.mjs
//  ・プロフィールは短く：名前・@ID・自己紹介・利用開始・数・（あれば）ゲームカードの入口 → すぐ下に投稿。ゲームの中身（戦績・看板パーティ）は出さない
//  ・ゲームカードは作った人だけ（作っていない・見られない人には入口も出さない）。アイコンを押すと、カードがあれば開き、なければアイコンを大きく見る
//  ・カードは上に重ねて開き、閉じると同じ画面（スクロールの位置も）に戻る。✕・Esc・後ろ・画面の移動で閉じる
//  ・カードの中：確認済みと自己申告を分ける・新しい3件＋もっと見る・戦績がない人に「戦績なし」と出さない・看板パーティ6匹の名前と記号が読める
//  ・390／430／1280px：はみ出し・文字が切れない・11px以上
import {chromium} from 'playwright';
import path from 'node:path';
import {PCARD_USERS,PCARD_NOTES} from './fixtures/pcard-users.mjs';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
let n=0,bad=0;const ok=(c,m)=>{n++;if(!c){bad++;console.error('NG',m)}};
async function page(W){
  const ctx=await b.newContext({viewport:{width:W,height:W<700?844:900},locale:'ja-JP',hasTouch:W<700,isMobile:W<700});
  await ctx.addInitScript(()=>{try{if(!localStorage.getItem('pctheme'))localStorage.setItem('pctheme','dark')}catch(e){};window.__fakeLogin=1});
  const pg=await ctx.newPage();pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));pg.calls=[];
  /* ページごとに見本を写し、保存（/api/me/card）をこの写しに反映する（本人＝pg.me） */
  const U=pg.U=structuredClone(PCARD_USERS);
  await pg.route(/^https?:/,async r=>{const u=new URL(r.request().url());const p=u.pathname;
    if(!/\/api\//.test(p))return r.abort();
    pg.calls.push(r.request().method()+' '+p+(r.request().postData()?' '+r.request().postData():''));
    const J=o=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(o)});
    let m;if((m=p.match(/^\/api\/u\/(\w+)$/))&&U[m[1]])return J({user:U[m[1]]});
    if((m=p.match(/^\/api\/u\/(\w+)\/notes$/)))return J({notes:PCARD_NOTES(m[1]),next:null});
    if(p==='/api/me/card'){const bd=JSON.parse(r.request().postData()||'{}'),x=U[pg.me];if(x){const g=x.games.pokechamp||(x.games.pokechamp={});
        x.partner=bd.partner??null;x.showcase=bd.showcase??null;g.partner=x.partner;g.showcase=x.showcase;if(bd.vis){g.vis=bd.vis;g.eff=bd.vis==='only_me'?'only_me':bd.vis==='followers'||x.private?'followers':'public';g.capped=bd.vis==='public'&&x.private}
        if(bd.card===true){g.created=true;x.card=true}}
      return J({ok:true,game:'pokechamp',created:!!(x&&x.card)})}
    if(p==='/api/follow'){const bd=JSON.parse(r.request().postData()||'{}');return J({ok:true,followed:bd.on!==false,requested:false,followers:343})}
    return r.abort()});
  return pg}
const open=async(pg,h)=>{await pg.evaluate(h=>{location.hash='#/u/'+h},h);await pg.waitForSelector('.gkp',{timeout:8000});await pg.waitForTimeout(450)};
const layout=(pg,root)=>pg.evaluate(root=>{const R=document.querySelector(root);const Q=s=>[...R.querySelectorAll(s)];
  return{over:document.documentElement.scrollWidth>innerWidth+1||document.body.scrollWidth>innerWidth+1,
    clip:Q('b,small,span,em,h2,h3,button').filter(e=>e.children.length===0&&e.textContent.trim()&&e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflow!=='visible').map(e=>e.textContent),
    tiny:Q('*').filter(e=>e.children.length===0&&e.textContent.trim()&&parseFloat(getComputedStyle(e).fontSize)<11).map(e=>e.textContent.trim())}},root);
const snsText=pg=>pg.evaluate(()=>document.querySelector('.gkp').innerText);
const cardOpen=pg=>pg.evaluate(()=>!!document.querySelector('.gkcm.on'));
const clickPt=async(pg,sel)=>{const el=await pg.$(sel);const bx=await el.boundingBox();await pg.mouse.click(bx.x+bx.width/2,bx.y+bx.height/2)};
for(const W of [390,430,1280]){
  const pg=await page(W);await pg.goto(URL0+'#/tools');await pg.waitForTimeout(700);
  await pg.evaluate(()=>{AUTH.user={getIdToken:async()=>'t'};AUTH.profile={handle:'minato',name:'ミナト',bio:'',av:null}});
  /* ---- ふつうのプロフィール（訪問者・カードあり） ---- */
  await open(pg,'ren');let t=await snsText(pg);
  ok(!/戦績|最高位|看板パーティ|自己申告|確認済み/.test(t),W+'：プロフィールにはゲームの中身（戦績・看板パーティ）を出さない');
  ok(/利用開始：2025年12月/.test(t)&&!/いいね/.test(t),W+'：利用開始・もらったいいねなし');
  const sp=await pg.evaluate(()=>{const R=s=>document.querySelector(s).getBoundingClientRect();const av=R('.gkp-av'),nm=R('.gkp-nm'),hd=R('.gkp-hd'),bio=R('.gkp-bio'),sub=R('.gkp-sub'),meta=R('.gkp-meta'),tabs=R('.gkp-tabs'),first=document.querySelector('#twp-list .tw');
    return{nmGap:Math.round(nm.top-av.bottom),hdGap:Math.round(hd.top-nm.bottom),bioGap:Math.round(bio.top-hd.bottom),subGap:Math.round(sub.top-bio.bottom),metaGap:Math.round(meta.top-sub.bottom),tabsTop:Math.round(tabs.top),firstTop:first?Math.round(first.getBoundingClientRect().top):9999,vh:innerHeight}});
  ok(sp.nmGap>=10&&sp.hdGap>=2&&sp.bioGap>=8&&sp.subGap>=6&&sp.metaGap>=0,W+'：名前・@ID・自己紹介・利用開始・数の間がつまっていない '+JSON.stringify(sp));
  ok(sp.firstTop<sp.vh-60,W+'：最初の投稿が最初の画面に見える '+sp.firstTop+'/'+sp.vh);
  ok(!!await pg.$('#pf-card')&&/ゲームカード/.test(t)&&/ポケモンチャンピオンズ/.test(t),W+'：カードがあれば控えめな入口');
  let L=await layout(pg,'.gkp');ok(!L.over&&!L.clip.length&&!L.tiny.length,W+'：プロフィールがはみ出さない・切れない・11px以上 '+JSON.stringify(L));
  ok(await pg.evaluate(()=>document.getElementById('pf-dm').getAttribute('href'))==='#/messages/ren'&&!!await pg.$('#pf-share'),W+'：メッセージ・リンク');
  await pg.click('#twp-f');await pg.waitForTimeout(400);ok(await pg.evaluate(()=>document.getElementById('twp-f').textContent==='フォロー中'&&document.getElementById('twp-fc').textContent==='343'),W+'：フォロー');
  /* ---- ゲームカードを開く・閉じる（同じ画面・同じ位置に戻る） ---- */
  await pg.evaluate(()=>scrTo(0,60));await pg.waitForTimeout(150);const y0=await pg.evaluate(()=>scrY());
  await pg.click('#pf-card');await pg.waitForTimeout(400);
  ok(await cardOpen(pg)&&await pg.evaluate(()=>document.activeElement.closest('.gkcm-top')!==null&&document.querySelector('.gkcm-p').getAttribute('role')==='dialog'),W+'：カードが開く（ダイアログ・閉じるボタンに焦点）');
  const c=await pg.evaluate(()=>{const q=s=>document.querySelector('.gkcm '+s),Q=s=>[...document.querySelectorAll('.gkcm '+s)];
    return{best:(q('.gkc-best')||{}).innerText?.replace(/\s+/g,' ').trim()||'',ver:Q('.gkc-rec > .gkc-rl .gkc-rr').map(r=>r.innerText.replace(/\s+/g,' ').trim()),verSeal:Q('.gkc-rec > .gkc-rl .gkc-seal').length,
      more:Q('.gkc-more .gkc-rr').length,self:Q('.gkc-self .gkc-rr').map(r=>r.innerText.replace(/\s+/g,' ').trim()),selfSeal:!!q('.gkc-self .gkc-seal'),
      av:Math.round(q('.gkc-av').getBoundingClientRect().width),t:q('.gkcm-p').innerText}});
  ok(/^8 ?位 最高位 S6・シングル 最終1桁 確認済み/.test(c.best),W+'：カード：確認済みの最高位 '+c.best);
  ok(c.ver.length===3&&c.verSeal===3&&c.more===1&&c.self.length===2&&c.self.every(x=>/自己申告$/.test(x))&&!c.selfSeal,W+'：カード：確認済み3件＋もっと見る・自己申告は別 '+c.ver);
  ok(c.av>=90&&/レン/.test(c.t)&&/@ren/.test(c.t)&&/シングル中心/.test(c.t),W+'：カード：アイコンを選手の写真として大きく・名前・自己紹介');
  L=await layout(pg,'.gkcm-p');ok(!L.over&&!L.clip.length&&!L.tiny.length,W+'：カードがはみ出さない・切れない・11px以上 '+JSON.stringify(L));
  await pg.click('#gkc-what');await pg.waitForTimeout(300);ok(await pg.evaluate(()=>/確認済み＝運営者が証拠/.test((document.querySelector('.xc-p')||{}).textContent||'')),W+'：確認済みとは');
  await pg.click('.xc-ok');await pg.waitForTimeout(250);ok(await cardOpen(pg),W+'：説明を閉じてもカードは開いたまま');
  await pg.click('.gkcm-top [data-gkcx]');await pg.waitForTimeout(350);
  ok(!await cardOpen(pg)&&!await pg.$('.gkcm')&&await pg.evaluate(()=>location.hash)==='#/u/ren'&&Math.abs(await pg.evaluate(()=>scrY())-y0)<=2&&await pg.evaluate(()=>document.activeElement&&document.activeElement.id==='pf-card'),W+'：✕で閉じると同じ画面・同じ位置・入口に焦点');
  await pg.click('#pf-card');await pg.waitForTimeout(350);await pg.keyboard.press('Escape');await pg.waitForTimeout(300);ok(!await cardOpen(pg),W+'：Esc で閉じる');
  if(W>=700){await pg.click('#pf-card');await pg.waitForTimeout(350);await pg.mouse.click(30,450);await pg.waitForTimeout(300);ok(!await cardOpen(pg),W+'：後ろを押すと閉じる')}
  await clickPt(pg,'#pf-av');await pg.waitForTimeout(350);ok(await cardOpen(pg),W+'：カードがある人のアイコンを押すとカード');
  await pg.evaluate(()=>{location.hash='#/tl'});await pg.waitForTimeout(500);ok(!await pg.$('.gkcm')&&!await pg.$('.pf'),W+'：画面を移るとカードは閉じる・ほかの画面にカードなし');
  /* ---- カードがない人（訪問者）：アイコンを大きく見る ---- */
  for(const h of ['riku','nao']){await open(pg,h);t=await snsText(pg);
    ok(!await pg.$('#pf-card')&&!await pg.$('#pf-edit3')&&!/ゲームカード|ポケモンチャンピオンズ/.test(t),`${W}：${h}：カードの入口も、あることも出さない`);
    await clickPt(pg,'#pf-av');await pg.waitForTimeout(350);
    ok(!await cardOpen(pg)&&!!await pg.$('.gkl'),`${W}：${h}：アイコンを押すと大きく見る（空のカードは開かない）`);
    ok(await pg.evaluate(()=>{const r=document.querySelector('.gkl-av').getBoundingClientRect();return r.width>=200&&document.activeElement.classList.contains('gkl-x')}),`${W}：${h}：大きなアイコン・閉じるに焦点`);
    await pg.keyboard.press('Escape');await pg.waitForTimeout(200);ok(!await pg.$('.gkl'),`${W}：${h}：Esc で閉じる`)}
  /* 写真のアイコン：今までの画像を見る画面（twViewer）で大きく */
  await open(pg,'mio');await clickPt(pg,'#pf-av');await pg.waitForTimeout(400);
  ok(!await cardOpen(pg)&&await pg.evaluate(()=>{const v=document.querySelector('.tw-view');return !!v&&/0123456789abcdef0123456789abcdef/.test(v.innerHTML)}),W+'：写真のアイコンは画像を見る画面で大きく');
  await pg.keyboard.press('Escape');await pg.waitForTimeout(300);ok(!await pg.$('.tw-view'),W+'：画像を見る画面は Esc で閉じる');
  /* ---- 非公開をフォローしていない人 ---- */
  await open(pg,'kagi');t=await snsText(pg);
  ok(!await pg.$('#pf-card')&&!/ゲームカード|戦績/.test(t)&&(t.match(/このアカウントは非公開です/g)||[]).length===1&&!await pg.$('.gkp-tabs')&&!!await pg.$('#pf-dm'),W+'：非公開：カードの入口なし・知らせは1回・投稿のタブなし・メッセージは前と同じ');
  /* ---- 戦績なしのカード：戦績の欄も「なし」も出さない。看板パーティが読める ---- */
  await open(pg,'yui');await pg.click('#pf-card');await pg.waitForTimeout(400);
  const y=await pg.evaluate(()=>{const p=document.querySelector('.gkcm-p'),mons=[...p.querySelectorAll('.gkc-mon')];
    return{t:p.innerText,n:mons.length,sig:Math.round(mons[0].querySelector('.gkc-sig').getBoundingClientRect().width),fs:parseFloat(getComputedStyle(mons[0].querySelector('small')).fontSize),
      cut:mons.filter(m=>{const s=m.querySelector('small');return s.scrollWidth>s.clientWidth+1}).map(m=>m.innerText),
      rows:[...new Set(mons.map(m=>Math.round(m.getBoundingClientRect().top)))].length,hs:[...new Set(mons.map(m=>Math.round(m.getBoundingClientRect().height)))].length,
      h:Math.round(p.querySelector('.gkc-sc').getBoundingClientRect().height)}});
  ok(!/戦績|最高位|確認済み|自己申告|なし|主な形式/.test(y.t)&&/相棒/.test(y.t)&&/アシレーヌ/.test(y.t),W+'：戦績がない人のカードに戦績・「なし」を出さない');
  ok(y.n===6&&y.sig>=46&&y.fs>=13&&!y.cut.length&&y.rows===2&&y.hs===1,W+'：看板パーティ6匹：記号48px・名前13px・切れない・3×2でそろう '+JSON.stringify(y));
  ok(y.h<=320,W+'：看板パーティの高さが大きすぎない '+y.h);
  await pg.keyboard.press('Escape');await pg.waitForTimeout(250);
  /* ---- 自己申告だけ：見出しなし、確認済みの件数も出さない ---- */
  await open(pg,'sora');await pg.click('#pf-card');await pg.waitForTimeout(400);
  const so=await pg.evaluate(()=>document.querySelector('.gkcm-p').innerText);
  ok(!/最高位|確認済みの戦績/.test(so)&&/自己申告/.test(so)&&/主な形式/.test(so),W+'：自己申告だけ：最高位なし・自己申告のまとまり');
  await pg.keyboard.press('Escape');await pg.waitForTimeout(250);
  /* ---- 本人：カードの編集（公開範囲）と、閉じて開き直す ---- */
  pg.me='minato';await open(pg,'minato');t=await snsText(pg);
  ok(/プロフィールを編集/.test(t)&&!await pg.$('#twp-f')&&!!await pg.$('#pf-card'),W+'：本人：編集・カードの入口');
  const hl0=await pg.evaluate(()=>history.length);
  await pg.click('#pf-card');await pg.waitForTimeout(400);
  ok(/フォロワーのみ/.test(await pg.evaluate(()=>document.querySelector('.gkcm .gkc-vis').textContent)),W+'：本人だけにカードの公開範囲の札');
  /* カードから編集：カードは隠すだけ。やめる＝同じカード */
  await pg.click('.gkcm #pf-edit');await pg.waitForTimeout(500);
  ok(await pg.evaluate(()=>{const m=document.querySelector('.gkcm');return !!m&&m.classList.contains('gkcm-off')&&getComputedStyle(m).visibility==='hidden'&&/ゲームカードを編集/.test(document.querySelector('.pf-ed h3').textContent)&&!!document.querySelector('.pf-ed-cap')}),W+'：カードから編集を開く（カードは隠すだけ）');
  await pg.click('.pf-ed-vis [data-vis=followers]');await pg.click('[data-ed=x]');await pg.waitForTimeout(450);
  ok(await cardOpen(pg)&&!await pg.evaluate(()=>document.querySelector('.gkcm').classList.contains('gkcm-off'))&&/フォロワーのみ/.test(await pg.evaluate(()=>document.querySelector('.gkcm .gkc-vis').textContent))
    &&!pg.calls.some(c=>/POST \/api\/me\/card/.test(c))&&await pg.evaluate(()=>document.querySelectorAll('.gkcm').length===1),W+'：やめると同じカードに戻る（保存しない・カードは1枚）');
  /* 保存：新しい中身で同じカードに戻る（履歴は足さない） */
  await pg.click('.gkcm #pf-edit');await pg.waitForTimeout(450);
  await pg.click('.pf-ed-vis [data-vis=only_me]');await pg.click('[data-ed=save]');await pg.waitForTimeout(1000);
  ok(pg.calls.some(c=>/POST \/api\/me\/card .*"vis":"only_me".*"card":true/.test(c))&&await cardOpen(pg)&&/自分だけ/.test(await pg.evaluate(()=>document.querySelector('.gkcm .gkc-vis').textContent))
    &&await pg.evaluate(()=>document.querySelectorAll('.gkcm').length===1),W+'：保存すると新しい中身で同じカードに戻る');
  await pg.click('.gkcm-top [data-gkcx]');await pg.waitForTimeout(400);
  ok(await pg.evaluate(()=>history.length)===hl0+1&&!await cardOpen(pg)&&/自分だけ/.test(await pg.evaluate(()=>document.querySelector('.gkp').innerText+(document.querySelector('.gkp-card')?'自分だけ':''))),W+'：編集のあとも履歴は1つだけ足して戻した');
  /* 編集中に戻る：編集もカードも閉じ、プロフィールはそのまま */
  await pg.click('#pf-card');await pg.waitForTimeout(350);await pg.click('.gkcm #pf-edit');await pg.waitForTimeout(400);
  await pg.goBack();await pg.waitForTimeout(600);
  ok(!await pg.$('.gkcm')&&!await pg.$('.pf-ed.on, .psheet.on')&&await pg.evaluate(()=>location.hash)==='#/u/minato'&&!!await pg.$('.gkp'),W+'：編集中に戻ると編集とカードが閉じ、プロフィールはそのまま');
  /* ---- はじめたばかりの本人：作る入口だけ（空のカードは開かない） ---- */
  pg.me='hajime';await open(pg,'hajime');
  ok(!!await pg.$('#pf-edit3')&&!await pg.$('#pf-card')&&!await pg.$('.gkp-av.gk-cr'),W+'：はじめたばかり：ゲームカードを作るの入口だけ・輪なし');
  await clickPt(pg,'#pf-av');await pg.waitForTimeout(300);ok(!await cardOpen(pg)&&!!await pg.$('.gkl'),W+'：はじめたばかり：アイコンは大きく見る');await pg.keyboard.press('Escape');
  /* 作るのをやめる：作られない */
  const nCard=()=>pg.calls.filter(c=>/POST \/api\/me\/card/.test(c)).length,n0=nCard();
  await pg.click('#pf-edit3');await pg.waitForTimeout(400);ok(await pg.evaluate(()=>/ゲームカードを作る/.test(document.querySelector('.pf-ed h3').textContent)&&/戦績がなくても作れます/.test(document.querySelector('.pf-ed').textContent)),W+'：作るを押すと「ゲームカードを作る」（戦績なしでよい）');
  await pg.click('[data-ed=x]');await pg.waitForTimeout(350);
  ok(nCard()===n0&&!await pg.$('#pf-card')&&!!await pg.$('#pf-edit3')&&!pg.U.hajime.card,W+'：やめると作られない（送らない）');
  /* 作って保存：card:true を送り、入口・輪が出てカードが開く（戦績なしでも） */
  await pg.click('#pf-edit3');await pg.waitForTimeout(400);await pg.click('[data-ed=save]');await pg.waitForTimeout(1000);
  ok(pg.calls.some(c=>/POST \/api\/me\/card .*"card":true/.test(c))&&await cardOpen(pg)&&!!await pg.$('#pf-card')&&!!await pg.$('.gkp-av.gk-cr'),W+'：作って保存すると入口と輪が出てカードが開く');
  ok(!/戦績|なし/.test(await pg.evaluate(()=>document.querySelector('.gkcm-p').innerText)),W+'：戦績がないカードに戦績・「なし」を出さない');
  await pg.keyboard.press('Escape');await pg.waitForTimeout(300);
  /* ---- 戦績はあるがカードは作っていない：入口も輪もない ---- */
  await open(pg,'kenta');t=await snsText(pg);
  ok(!await pg.$('#pf-card')&&!await pg.$('.gkp-av.gk-cr')&&!/ゲームカード|戦績/.test(t),W+'：戦績だけではカードにしない（入口・輪なし）');
  /* ---- アイコンの輪：カードがある人だけ（プロフィール・投稿）。ない人・見られない人はふつう ---- */
  await open(pg,'ren');
  const ring=await pg.evaluate(()=>{const a=document.querySelector('.gkp-av'),s=getComputedStyle(a,'::after'),f=document.querySelector('#twp-list .tw .tw-av');
    return{on:a.classList.contains('gk-cr'),bg:s.backgroundImage,anim:s.animationName,feed:!!f&&f.classList.contains('gk-cr'),w:Math.round(a.getBoundingClientRect().width)}});
  ok(ring.on&&/conic-gradient/.test(ring.bg)&&(ring.anim==='none'||!ring.anim)&&ring.feed&&ring.w===72,W+'：カードがある人のアイコンに輪（動かない・大きさは同じ）・投稿のアイコンにも '+JSON.stringify(ring));
  for(const h of ['riku','nao','kenta','mio']){await open(pg,h);ok(!await pg.$('.gk-cr'),`${W}：${h}：輪なし`)}
  /* ---- 戻る：カードだけ閉じる。プロフィールはそのまま（描き直さない・位置も同じ） ---- */
  await pg.evaluate(()=>{location.hash='#/tl'});await pg.waitForTimeout(500);await open(pg,'ren');
  await pg.evaluate(()=>{scrTo(0,40);document.querySelector('.gkp').dataset.mark='1'});await pg.waitForTimeout(150);
  const y1=await pg.evaluate(()=>scrY()),hl=await pg.evaluate(()=>history.length);
  await pg.click('#pf-card');await pg.waitForTimeout(400);ok(await cardOpen(pg),W+'：カードを開く');
  await pg.goBack();await pg.waitForTimeout(500);
  ok(!await cardOpen(pg)&&await pg.evaluate(()=>location.hash)==='#/u/ren'&&await pg.evaluate(()=>document.querySelector('.gkp')?.dataset.mark==='1')&&Math.abs(await pg.evaluate(()=>scrY())-y1)<=2,W+'：戻るでカードだけ閉じる（プロフィールはそのまま・位置も同じ）');
  for(let i=0;i<4;i++){await pg.click('#pf-card');await pg.waitForTimeout(300);if(i%2)await pg.keyboard.press('Escape');else await pg.click('.gkcm-top [data-gkcx]');await pg.waitForTimeout(300)}
  ok(await pg.evaluate(()=>history.length)<=hl+1&&await pg.evaluate(()=>!(history.state&&history.state.gkc)),W+'：開け閉めをくり返しても履歴がふえない '+(await pg.evaluate(()=>history.length))+'/'+hl);
  await pg.goBack();await pg.waitForTimeout(600);ok(/^#\/tl/.test(await pg.evaluate(()=>location.hash)),W+'：カードを閉じたあとの戻るは前の画面（空の戻るがない）');
  await pg.goForward();await pg.waitForTimeout(600);ok(await pg.evaluate(()=>location.hash)==='#/u/ren'&&!await cardOpen(pg),W+'：進むでプロフィールに戻る（カードは勝手に開かない）');
  /* カードの中のリンク：カードを閉じてから移る。戻るとプロフィール、もう一度戻ると前の画面 */
  await pg.click('#pf-card');await pg.waitForTimeout(350);await pg.click('.gkcm a.gkc-gp');await pg.waitForTimeout(800);
  ok(/^#\/p\/445/.test(await pg.evaluate(()=>location.hash))&&!await pg.$('.gkcm'),W+'：カードの中のリンクで図鑑へ（カードは閉じる）');
  await pg.goBack();await pg.waitForTimeout(700);ok(await pg.evaluate(()=>location.hash)==='#/u/ren'&&!await cardOpen(pg),W+'：戻るとプロフィール');
  await pg.goBack();await pg.waitForTimeout(700);ok(/^#\/tl/.test(await pg.evaluate(()=>location.hash)),W+'：もう一度戻ると前の画面（カードの空の履歴に止まらない）');
  /* 別の人のプロフィールを開く・アドレスを直接開いてもカードは開かない */
  await open(pg,'ren');await pg.click('#pf-card');await pg.waitForTimeout(300);await pg.keyboard.press('Escape');await pg.waitForTimeout(300);
  await open(pg,'akari');ok(await pg.evaluate(()=>/アカリ/.test(document.querySelector('.gkp').innerText))&&!await cardOpen(pg),W+'：閉じたあと別の人のプロフィールが正しく開く');
  await pg.reload();await pg.waitForSelector('.gkp',{timeout:8000});await pg.waitForTimeout(500);ok(!await cardOpen(pg),W+'：アドレスを直接開いてもカードは開かない');
  /* カードを開いたまま読み直す：カードは開かず、次の「戻る」1回で前の画面へ（空の戻るがない）。くり返しても同じ */
  for(let i=0;i<2;i++){
    await pg.evaluate(()=>{location.hash='#/tl'});await pg.waitForTimeout(500);await open(pg,'ren');
    await pg.click('#pf-card');await pg.waitForTimeout(350);
    await pg.reload();await pg.waitForSelector('.gkp',{timeout:8000});await pg.waitForTimeout(700);
    ok(!await cardOpen(pg)&&await pg.evaluate(()=>location.hash)==='#/u/ren'&&await pg.evaluate(()=>!(history.state&&history.state.gkc)),W+'：カードを開いたまま読み直す→カードは開かない・ふつうの履歴に立つ '+i);
    await pg.goBack();await pg.waitForTimeout(700);
    ok(/^#\/tl/.test(await pg.evaluate(()=>location.hash)),W+'：読み直したあとの最初の「戻る」で前の画面へ '+i+' '+await pg.evaluate(()=>location.hash));
    await pg.goForward();await pg.waitForTimeout(700);
    ok(await pg.evaluate(()=>location.hash)==='#/u/ren'&&!await cardOpen(pg)&&!!await pg.$('.gkp'),W+'：進むでプロフィール（カードは開かない・操作できる） '+i);
  }
  await pg.evaluate(()=>{AUTH.user={getIdToken:async()=>'t'};AUTH.profile={handle:'minato',name:'ミナト',bio:'',av:null}});
  await pg.evaluate(()=>{AUTH.user={getIdToken:async()=>'t'};AUTH.profile={handle:'minato',name:'ミナト',bio:'',av:null}});
  /* ---- ホームの右上の通知 ---- */
  await pg.evaluate(()=>{location.hash='#/'});await pg.waitForTimeout(900);
  const bell=await pg.evaluate(()=>{const a=document.getElementById('hd-bell'),h=document.getElementById('hdr-in');if(!a)return null;const r=a.getBoundingClientRect(),hr=h.getBoundingClientRect();
    /* 文字のない見出し（ホームの h1 は空）は数えない */
    const ov=[...h.querySelectorAll('#brand,.hd-logo,h1')].filter(e=>e.tagName!=='H1'||e.textContent.trim()).filter(e=>{const q=e.getBoundingClientRect();return q.width&&!(q.right<=r.left||q.left>=r.right||q.bottom<=r.top||q.top>=r.bottom)}).map(e=>e.className||e.tagName);
    return{href:a.getAttribute('href'),label:a.getAttribute('aria-label'),w:Math.round(r.width),h:Math.round(r.height),right:Math.round(hr.right-r.right),mid:Math.abs((r.top+r.bottom)/2-(hr.top+hr.bottom)/2)<4,ov,n:document.getElementById('hd-bell-n').hidden,count:document.querySelectorAll('#hd-bell').length}});
  ok(bell&&bell.href==='#/notif'&&bell.label==='通知'&&bell.w>=44&&bell.h>=44&&bell.right<=16&&bell.mid&&!bell.ov.length&&bell.count===1,W+'：ホームの右上に通知（44px・同じ行・重ならない） '+JSON.stringify(bell));
  ok(bell&&bell.n===true,W+'：未読がないときは数を出さない');
  await pg.evaluate(()=>notifBadge(3));ok(await pg.evaluate(()=>{const n=document.getElementById('hd-bell-n');return !n.hidden&&n.textContent==='3'&&/未読3件/.test(document.getElementById('hd-bell').getAttribute('aria-label'))&&getComputedStyle(document.querySelector('#brand'),'::after').display==='none'}),W+'：未読があれば数（左上の点は重ねない）');
  await pg.evaluate(()=>notifBadge(0));ok(await pg.evaluate(()=>document.getElementById('hd-bell-n').hidden),W+'：未読0で数を消す');
  await pg.focus('#hd-bell');await pg.keyboard.press('Tab');await pg.keyboard.press('Shift+Tab');
  ok(await pg.evaluate(()=>{const a=document.activeElement;return a.id==='hd-bell'&&getComputedStyle(a).outlineStyle!=='none'}),W+'：キーボードで選ぶと枠が見える');
  await pg.keyboard.press('Enter');await pg.waitForTimeout(600);ok(await pg.evaluate(()=>location.hash)==='#/notif',W+'：押すとお知らせの画面');
  ok(!await pg.$('#hd-bell'),W+'：ホーム以外には鈴を出さない');
  /* 下のメニューに隠れない（スマホ） */
  if(W<700){await open(pg,'ren');await pg.evaluate(()=>scrTo(0,1e6));await pg.waitForTimeout(400);
    const z=await pg.evaluate(()=>{const tb=document.querySelector('.tabbar').getBoundingClientRect(),last=[...document.querySelectorAll('#twp-list .tw')].pop().getBoundingClientRect();return[Math.round(last.bottom),Math.round(tb.top)]});
    ok(z[0]<=z[1],W+'：いちばん下の投稿は下のメニューに隠れない '+z)}
  ok(!pg.errs.length,W+'：エラーなし '+pg.errs.join('|'));
  await pg.close();
}
await b.close();
console.log(bad?`pfcard: NG（${bad}件）`:`pfcard: OK（${n}項目）`);if(bad)process.exitCode=1;
