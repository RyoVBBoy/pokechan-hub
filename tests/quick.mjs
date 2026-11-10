// ⚡ボタンのカスタマイズ（src/js/64-quick.js）の確認（2026/11/10）
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
let n=0,bad=0;const ok=(c,m)=>{n++;if(!c){bad++;console.error('NG',m)}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function page(W,init){
  const ctx=await b.newContext({viewport:{width:W,height:844},locale:'ja-JP',hasTouch:W<700,isMobile:W<700});
  if(init)await ctx.addInitScript(init);
  const pg=await ctx.newPage();pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));
  await pg.route(/^https?:/,r=>r.abort());return pg}
const N=(pg,s)=>pg.evaluate(s=>P.find(x=>x.n===s).no,s);
/* パーティを3枠ぶん用意する（数＝それぞれの匹数） */
const setTeams=(pg,counts)=>pg.evaluate(counts=>{const pool=['ガブリアス','サーフゴー','アシレーヌ','カイリュー','ドドゲザン','ウルガモス'].map(s=>P.find(x=>x.n===s).no);
  TEAMS.list.forEach((s,i)=>{s.team=pool.slice(0,counts[i]).map(no=>({no}));s.name=''});TEAMS.cur=0;team=TEAMS.list[0].team.map(x=>({...x}));saveTeam();
  return JSON.stringify(TEAMS.list)},counts);

/* 1. はじめ（保存なし）：相性を調べる。⚡で相性の画面が開く。⚡には設定の操作（歯車・▾・メニュー・長押し・右クリック）が無い */
{const pg=await page(390);await pg.goto(URL0+'#/tools');await pg.waitForTimeout(700);
  const r=await pg.evaluate(()=>[qaGet(),localStorage.getItem('pcquick'),document.getElementById('fab').querySelector('.fl').textContent,document.querySelectorAll('.qa-more,.qa-gear,.qa-menu,.qa-pc,#qa-menu').length,typeof qaMenuOpen]);
  ok(r[0]==='type-check'&&r[1]===null&&r[2]==='相性'&&r[3]===0&&r[4]==='undefined','はじめは相性・⚡に設定の操作なし '+r);
  const f=await pg.evaluate(()=>{const a=document.getElementById('fab').getBoundingClientRect();return [a.width,a.height]});
  ok(f[0]===58&&f[1]===64,'⚡の大きさ '+f);
  /* 長押ししても設定は開かず、ふつうに押したのと同じ（相性の画面） */
  const fb=await pg.$('#fab');const bx=await fb.boundingBox();
  await pg.mouse.move(bx.x+20,bx.y+30);await pg.mouse.down();await pg.waitForTimeout(650);await pg.mouse.up();await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>!document.querySelector('.qa-menu,#qa-menu')&&!document.getElementById('sheet').hidden&&document.getElementById('sheet-t').textContent==='相性を調べる'),'長押しで設定が開いた／相性の画面が開かない');
  await pg.keyboard.press('Escape');
  /* 2. 設定画面（左から出るメニュー →「設定とプライバシー」）の「お気に入りショートカット」 */
  await pg.evaluate(()=>{if(typeof closeSheet==='function')closeSheet();location.hash='#/tools'});await pg.waitForTimeout(400);
  const openSet=async()=>{await pg.evaluate(()=>settingsOpen('qa'));await pg.waitForTimeout(400)};
  await openSet();
  const st=await pg.evaluate(()=>{const g=document.querySelector('#setm .qa-set'),r=[...g.querySelectorAll('input[type=radio]')],sd=document.querySelector('#setm .qa-sd');
    const opt=[...g.querySelectorAll('.qa-opt')].map(o=>o.getBoundingClientRect());
    return {n:r.length,ids:r.map(x=>x.value).join(),checked:r.filter(x=>x.checked).map(x=>x.value).join(),sd:sd.textContent,lab:/お気に入りショートカット/.test(document.getElementById('sm-t').textContent),h:Math.min(...opt.map(o=>o.height)),in:opt.every(o=>o.left>=0&&o.right<=innerWidth),over:document.body.scrollWidth<=innerWidth}});
  ok(st.n===3&&st.ids==='type-check,community-post,party-create'&&st.checked==='type-check'&&st.sd==='サイドナビの⚡ボタンを押したときに実行する機能を選択できます。'&&st.lab&&st.h>=44&&st.in&&st.over,'設定画面のお気に入りショートカット '+JSON.stringify(st));
  /* 選ぶと保存（実行はしない）。⚡の名前もすぐ変わる */
  await pg.evaluate(()=>[...document.querySelectorAll('#setm .qa-opt')].find(o=>o.querySelector('input').value==='party-create').click());await pg.waitForTimeout(300);
  const s=await pg.evaluate(()=>[localStorage.getItem('pcquick'),document.getElementById('fab').querySelector('.fl').textContent,document.getElementById('fab').getAttribute('aria-label'),location.hash,!!document.querySelector('.mpsheet'),document.getElementById('sm-v-qa').textContent==='パーティ新規作成']);
  ok(s[0]==='party-create'&&s[1]==='パーティ'&&s[2]==='パーティ新規作成'&&s[3]==='#/tools'&&!s[4]&&s[5],'設定画面で選ぶと保存（実行しない） '+s);
  await pg.reload();await pg.waitForTimeout(700);
  ok(await pg.evaluate(()=>qaGet()==='party-create'&&document.getElementById('fab').querySelector('.fl').textContent==='パーティ'),'再読み込みで設定が残らない');
  await openSet();
  ok(await pg.evaluate(()=>document.querySelector('#setm input[name=qa-set]:checked').value==='party-create'),'設定画面の選択が再読み込みで残らない');
  await pg.evaluate(()=>[...document.querySelectorAll('#setm .qa-opt')].find(o=>o.querySelector('input').value==='type-check').click());await pg.waitForTimeout(200);
  ok(await pg.evaluate(()=>localStorage.getItem('pcquick')==='type-check'),'相性に戻せない');
  ok(!pg.errs.length,'エラー '+pg.errs);await pg.close()}

/* 3. おかしな値・localStorage が使えない：相性を調べる に戻り、エラーにならない */
{const pg=await page(390,()=>{try{localStorage.setItem('pcquick','xxx')}catch(e){}});await pg.goto(URL0+'#/tools');await pg.waitForTimeout(600);
  ok(await pg.evaluate(()=>qaGet()==='type-check'),'おかしな値で相性に戻らない');ok(!pg.errs.length,'おかしな値でエラー '+pg.errs);await pg.close()}
{const pg=await page(390,()=>{const g=Storage.prototype.getItem,s=Storage.prototype.setItem;Storage.prototype.getItem=function(k){if(k==='pcquick')throw new Error('blocked');return g.call(this,k)};Storage.prototype.setItem=function(k,v){if(k==='pcquick')throw new Error('blocked');return s.call(this,k,v)}});
  await pg.goto(URL0+'#/tools');await pg.waitForTimeout(600);
  const r=await pg.evaluate(()=>{qaSet('party-create');return qaGet()});
  ok(r==='type-check'&&!pg.errs.length,'localStorage が使えないとき '+r+' '+pg.errs);await pg.close()}

/* 4. パーティ新規作成：空いている枠へ（1枠・2枠空き）、3枠とも埋まっていれば上書きせずお知らせだけ */
{const pg=await page(390,()=>{try{localStorage.setItem('pcquick','party-create')}catch(e){}});await pg.goto(URL0+'#/tools');await pg.waitForTimeout(700);
  for(const [counts,want] of [[[6,0,0],1],[[6,4,0],2],[[0,3,6],0],[[3,0,5],1]]){
    await pg.evaluate(()=>{document.querySelectorAll('.mpsheet').forEach(e=>e.remove());location.hash='#/tools'});await pg.waitForTimeout(300);
    const before=await setTeams(pg,counts);
    await pg.click('#fab');await pg.waitForTimeout(700);
    const r=await pg.evaluate(()=>({cur:TEAMS.cur,hash:location.hash,pick:!!document.querySelector('.mpsheet'),list:JSON.stringify(TEAMS.list.map(s=>s.team.map(x=>x.no)))}));
    const bl=JSON.stringify(JSON.parse(before).map(s=>s.team.map(x=>x.no)));
    ok(r.cur===want&&r.hash==='#/team'&&r.pick&&r.list===bl,`空き枠 ${counts}→${want}：`+JSON.stringify(r));
  }
  await pg.evaluate(()=>{document.querySelectorAll('.mpsheet').forEach(e=>e.remove());location.hash='#/tools'});await pg.waitForTimeout(300);
  const before=await setTeams(pg,[6,5,1]);
  await pg.click('#fab');await pg.waitForTimeout(500);
  const r=await pg.evaluate(()=>({cur:TEAMS.cur,hash:location.hash,toast:document.getElementById('toast').textContent,on:document.getElementById('toast').classList.contains('on'),pick:!!document.querySelector('.mpsheet'),list:JSON.stringify(TEAMS.list),saved:localStorage.getItem('pcteams')}));
  ok(r.cur===0&&r.hash==='#/tools'&&r.toast==='空いている枠がありません'&&r.on&&!r.pick&&r.list===before&&JSON.stringify(JSON.parse(r.saved).list)===before,'3枠とも埋まっているとき '+JSON.stringify({...r,list:0,saved:0}));
  /* 5. 書きかけの投稿：キャンセル＝そのまま（文・画面・設定）、移動する＝開く、空なら確認なし */
  await pg.evaluate(()=>{const t=document.createElement('textarea');t.id='twc-t';t.value='書きかけの文';document.getElementById('view').appendChild(t)});
  await setTeams(pg,[6,0,0]);
  await pg.click('#fab');await pg.waitForTimeout(300);
  const c=await pg.evaluate(()=>{const d=document.querySelector('.xc');return d&&d.querySelector('#xc-t').textContent});
  ok(c==='この画面を離れると、書きかけの投稿が消えます。移動しますか？','書きかけの確認が出ない '+c);
  await pg.click('.xc .xc-no');await pg.waitForTimeout(300);
  const k=await pg.evaluate(()=>[location.hash,document.getElementById('twc-t').value,TEAMS.cur,localStorage.getItem('pcquick'),!!document.querySelector('.mpsheet')]);
  ok(k[0]==='#/tools'&&k[1]==='書きかけの文'&&k[2]===0&&k[3]==='party-create'&&!k[4],'キャンセルで何も変わらない '+k);
  await pg.click('#fab');await pg.waitForTimeout(300);await pg.click('.xc .xc-ok');await pg.waitForTimeout(700);
  ok(await pg.evaluate(()=>location.hash==='#/team'&&TEAMS.cur===1&&!!document.querySelector('.mpsheet')),'移動するで開かない');
  await pg.evaluate(()=>{document.querySelectorAll('.mpsheet').forEach(e=>e.remove());location.hash='#/tools'});await pg.waitForTimeout(300);
  await setTeams(pg,[6,0,0]);
  await pg.evaluate(()=>{const t=document.createElement('textarea');t.id='twc-t';t.value='   ';document.getElementById('view').appendChild(t)});
  await pg.click('#fab');await pg.waitForTimeout(600);
  ok(await pg.evaluate(()=>!document.querySelector('.xc')&&location.hash==='#/team'),'空の投稿欄で確認が出た');
  ok(!pg.errs.length,'エラー '+pg.errs);await pg.close()}

/* 6. 新規投稿：ログインしていなければ、今までの投稿ボタンと同じくアカウントの画面へ。書きかけがあれば確認 */
{const pg=await page(390,()=>{try{localStorage.setItem('pcquick','community-post')}catch(e){}});await pg.goto(URL0+'#/tools');await pg.waitForTimeout(700);
  ok(await pg.evaluate(()=>document.getElementById('fab').querySelector('.fl').textContent==='投稿'),'新規投稿の名前');
  await pg.evaluate(()=>{const t=document.createElement('textarea');t.id='twc-t';t.value='下書き';document.getElementById('view').appendChild(t)});
  await pg.click('#fab');await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>!!document.querySelector('.xc')),'新規投稿で書きかけの確認が出ない');
  await pg.click('.xc .xc-ok');await pg.waitForTimeout(500);
  const r=await pg.evaluate(()=>[location.hash,document.getElementById('toast').textContent]);
  ok(r[0]==='#/account'&&r[1]==='投稿するにはログインしてください','ログインしていないときの新規投稿 '+r);
  /* 7. ホーム・タイムラインの右下は設定に関係なく投稿（⚙ も出さない） */
  for(const h of ['#/','#/tl']){await pg.evaluate(h=>{localStorage.setItem('pcquick','party-create');location.hash=h},h);await pg.waitForTimeout(700);
    const before=await pg.evaluate(()=>JSON.stringify(TEAMS));
    const s=await pg.evaluate(()=>[document.getElementById('fab').dataset.mode,document.getElementById('fab').getAttribute('aria-label'),!document.querySelector('.qa-more')]);
    await pg.click('#fab');await pg.waitForTimeout(500);
    const a=await pg.evaluate(()=>[location.hash,document.getElementById('toast').textContent,JSON.stringify(TEAMS)]);
    ok(s[0]==='post'&&s[1]==='投稿する'&&s[2]&&a[0]==='#/account'&&a[1]==='投稿するにはログインしてください'&&a[2]===before,`${h} の右下は投稿のまま `+s+' '+a.slice(0,2));}
  ok(!pg.errs.length,'エラー '+pg.errs);await pg.close()}

/* 8. PC：左のメニューは紫の⚡だけ（大きさは今までどおり・まわりに設定の部品なし）、押す前に「⚡ 機能名」、設定画面で選ぶと名前が変わる */
for(const W of [1000,1280]){const pg=await page(W);await pg.goto(URL0+'#/dex');await pg.waitForTimeout(700);
  const a=await pg.evaluate(()=>{const p=document.getElementById('pc-post'),r=p.getBoundingClientRect();return [p.title,Math.round(r.height),Math.round(r.width),p.parentElement.classList.contains('tabbar'),document.querySelectorAll('.qa-more,.qa-gear,.qa-pc').length]});
  ok(a[0]==='⚡ 相性を調べる'&&a[1]===52&&(W>=1280||a[2]===52)&&a[3]&&a[4]===0,W+'：PC の⚡だけ '+a);
  await pg.click('#pc-post',{button:'right'});await pg.waitForTimeout(200);
  ok(await pg.evaluate(()=>!document.querySelector('.qa-menu,#qa-menu')&&localStorage.getItem('pcquick')===null),W+'：右クリックで設定が開いた');
  await pg.click('#pc-post');await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>!document.getElementById('sheet').hidden),W+'：⚡で相性の画面が開かない');
  await pg.keyboard.press('Escape');await pg.evaluate(()=>{if(typeof closeSheet==='function')closeSheet()});await pg.waitForTimeout(200);
  await pg.evaluate(()=>settingsOpen('qa'));await pg.waitForTimeout(400);
  const g=await pg.evaluate(()=>{const o=[...document.querySelectorAll('#setm .qa-opt')];return [o.length,o.every(x=>{const r=x.getBoundingClientRect();return r.width>0&&r.right<=innerWidth})]});
  ok(g[0]===3&&g[1],W+'：PC の設定画面 '+g);
  await pg.evaluate(()=>[...document.querySelectorAll('#setm .qa-opt')].find(o=>o.querySelector('input').value==='community-post').click());await pg.waitForTimeout(200);
  const t=await pg.evaluate(W=>{const p=document.getElementById('pc-post');return [p.title,p.getAttribute('aria-label'),W<1280||p.querySelector('span').textContent==='新規投稿',localStorage.getItem('pcquick'),location.hash]},W);
  ok(t[0]==='⚡ 新規投稿'&&t[1]==='新規投稿'&&t[2]&&t[3]==='community-post'&&t[4]==='#/dex',W+'：PC で設定画面から選ぶと保存・名前が変わる（実行しない） '+t);
  ok(!pg.errs.length,W+'：エラー '+pg.errs);await pg.close()}
/* 6. 設定とプライバシー＝画面の真ん中に開く設定の画面（2026/11/10 依頼主「X の設定画面と同じに」）：
   メニューの「設定とプライバシー」で開く・PC は真ん中に600pxまで／スマホは全画面・上に ← 題名 ✕・1行＝絵・太字の名前・右に今の設定と ›・名前は省略しない・選ぶ項目は行を押すとページが切りかわる */
for(const W of [320,390,1280]){
  const pg=await page(W,()=>{try{if(!localStorage.getItem('pctheme'))localStorage.setItem('pctheme','dark')}catch(e){}});await pg.goto(URL0+'#/tools');await pg.waitForTimeout(700);
  /* メニューの「設定とプライバシー」を押すと、メニューが閉じて設定の画面が開く */
  await pg.evaluate(()=>drawerOpen());await pg.waitForTimeout(450);
  ok(await pg.evaluate(()=>!document.querySelector('#drawer .dr-acc,#drawer .qa-set,#drawer #dr-push')&&!!document.querySelector('#drawer [data-dr=settings]')),W+'：メニューには設定の中身がなく「設定とプライバシー」の行だけ');
  await pg.click('#drawer [data-dr=settings]');await pg.waitForTimeout(700);
  const c=await pg.evaluate(()=>{const o=document.getElementById('setm'),p=o.querySelector('.sm-p'),pr=p.getBoundingClientRect();
    const secs=[...o.querySelectorAll('.sm-sh')].map(x=>x.textContent);
    const rows=[...o.querySelectorAll('.sm-main .dr-row')];
    const shape=rows.every(r=>r.querySelector('.dr-ri svg,.dr-ri .dr-dot')&&r.querySelector('.dr-rt b')&&r.querySelector('.dr-rr'));
    const capt=rows.filter(r=>r.querySelector('.dr-rt small')&&!r.closest('#sm-push')).map(r=>r.textContent);
    /* 名前と右の表示が省略されず1行で出ている（359px以下は名前の2行まで可） */
    const cut=[...o.querySelectorAll('.sm-main .dr-rt b,.sm-main .dr-rv')].filter(x=>!x.closest('#sm-push')&&(x.scrollWidth>x.clientWidth+1||(innerWidth>=360&&x.getBoundingClientRect().height>26))).map(x=>x.textContent);
    const b0=getComputedStyle(rows[0].querySelector('.dr-rt b')),r0=getComputedStyle(rows[0]);
    const font=[b0.fontSize,b0.fontWeight,r0.paddingTop,r0.paddingLeft,r0.borderBottomColor].join();
    const tap=[...o.querySelectorAll('.dr-row,.sm-ib')].filter(x=>{const r=x.getBoundingClientRect();return r.height<44||r.width<44}).map(x=>x.textContent||x.getAttribute('aria-label'));
    const out=[...p.querySelectorAll('*')].filter(x=>{const r=x.getBoundingClientRect();return r.width&&(r.right>pr.right+0.5||r.left<pr.left-0.5)}).map(x=>x.className);
    return {on:o.classList.contains('on')&&!o.hidden,drawer:DR.open,w:Math.round(pr.width),h:Math.round(pr.height),left:Math.round(pr.left),bg:getComputedStyle(p).backgroundColor,
      head:[o.querySelector('[data-sm=back]')?.getAttribute('aria-label'),document.getElementById('sm-t').textContent,o.querySelector('[data-sm=close]')?.getAttribute('aria-label')].join(),
      secs,shape,capt,cut,font,tap,out,sw:document.documentElement.scrollWidth-innerWidth,qa:document.getElementById('sm-v-qa')?.textContent,focus:p.contains(document.activeElement)}});
  ok(c.on&&!c.drawer&&c.head==='戻る,設定,閉じる'&&c.focus,W+'：設定の画面が開く・上に ← 設定 ✕ '+JSON.stringify([c.on,c.drawer,c.head,c.focus]));
  ok(W>=700?(c.w===600&&c.left===(1280-600)/2&&c.h<900):(c.w===W&&c.h===844),W+'：大きさ（PC は真ん中に600px・スマホは全画面） '+[c.w,c.h,c.left]);
  ok(c.bg==='rgb(0, 0, 0)',W+'：背景は真っ黒 '+c.bg);
  ok(c.secs.join('/')==='表示・カスタマイズ/通知/アカウント＆セキュリティ'&&c.shape&&!c.capt.length,W+'：リストの形 '+c.secs+c.capt);
  ok(c.font==='15px,700,16px,20px,rgba(255, 255, 255, 0.1)',W+'：文字と余白と線 '+c.font);
  ok(!c.cut.length&&c.qa==='相性を調べる',W+'：名前と今の設定を省略しない '+c.cut+' '+c.qa);
  ok(!c.tap.length&&!c.out.length&&c.sw<=0,W+'：44px・はみ出し '+c.tap+' '+c.out+' '+c.sw);
  /* 明るさの行を押すと「明るさ」のページ（✓ が今の選択）、← で一覧へ */
  await pg.click('#setm [data-sm-go=theme]');await pg.waitForTimeout(350);
  const tp=await pg.evaluate(()=>[document.getElementById('sm-t').textContent,document.querySelector('#setm .sm-main').hidden,[...document.querySelectorAll('#setm .sm-sub .dr-opt')].map(o=>o.dataset.themeSet+':'+o.getAttribute('aria-pressed')).join()]);
  ok(tp[0]==='明るさ'&&tp[1]&&tp[2]==='auto:false,light:false,dark:true',W+'：明るさのページ '+tp);
  await pg.click('#setm [data-sm=back]');await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>document.getElementById('sm-t').textContent==='設定'&&!document.querySelector('#setm .sm-main').hidden&&!document.getElementById('setm').hidden),W+'：← で一覧へ戻る');
  /* ✕ で閉じる・Esc でも閉じる */
  await pg.click('#setm [data-sm=close]');await pg.waitForTimeout(400);
  ok(await pg.evaluate(()=>document.getElementById('setm').hidden&&!document.body.classList.contains('sm-lock')),W+'：✕ で閉じる');
  await pg.evaluate(()=>settingsOpen());await pg.waitForTimeout(400);await pg.keyboard.press('Escape');await pg.waitForTimeout(400);
  ok(await pg.evaluate(()=>document.getElementById('setm').hidden),W+'：Esc で閉じる');
  if(W===390){
    /* 明るさ：ライトを押すと ✓ と一覧の表示が変わり、少しあとで保存・切りかえ（保存のしかたは前と同じ pctheme）、読み直したあと設定の画面が開き直る */
    await pg.evaluate(()=>settingsOpen('theme'));await pg.waitForTimeout(400);
    const mv=await pg.evaluate(()=>{document.querySelector('#setm [data-theme-set=light]').click();return [document.querySelector('#setm [data-theme-set=light]').getAttribute('aria-pressed'),document.getElementById('sm-v-theme').textContent,localStorage.getItem('pctheme')]});
    ok(mv[0]==='true'&&mv[1]==='ライト'&&mv[2]==='dark','押した直後の表示 '+mv);await pg.waitForTimeout(1200);
    const t=await pg.evaluate(()=>[localStorage.getItem('pctheme'),document.documentElement.dataset.theme,!!document.getElementById('setm')&&!document.getElementById('setm').hidden,document.getElementById('sm-v-theme')?.textContent,getComputedStyle(document.querySelector('#setm .sm-p')).backgroundColor,document.getElementById('sm-t').textContent,document.querySelector('#setm [data-theme-set=light]')?.getAttribute('aria-pressed')]);
    ok(t[0]==='light'&&t[1]==='light'&&t[2]&&t[3]==='ライト'&&t[4]==='rgb(255, 255, 255)'&&t[5]==='明るさ'&&t[6]==='true','明るさの切りかえ・読み直して同じページを開き直す '+t);
    /* 開き直すときは動かさない（下からすべり上がらない）：開いたその瞬間から位置が決まっている */
    const nm=await pg.evaluate(()=>{settingsClose();const o=document.getElementById('setm');o.hidden=true;o.classList.remove('on');settingsOpen('theme',{instant:true});const p=getComputedStyle(o.querySelector('.sm-p'));return [p.transform,p.opacity,getComputedStyle(o.querySelector('.sm-bg')).opacity]});
    ok(nm[0]==='none'&&nm[1]==='1'&&nm[2]==='1','開き直すときは動かない '+nm);
    /* テーマの色・背景の光も保存される */
    await pg.evaluate(()=>settingsOpen('accent'));await pg.waitForTimeout(300);await pg.evaluate(()=>document.querySelector('#setm [data-acc-set=blue]').click());await pg.waitForTimeout(1200);
    ok(await pg.evaluate(()=>localStorage.getItem('pcaccent')==='blue'),'テーマの色の保存');
    await pg.evaluate(()=>settingsOpen('glow'));await pg.waitForTimeout(300);await pg.evaluate(()=>document.querySelector('#setm [data-glow-set=off]').click());await pg.waitForTimeout(1200);
    ok(await pg.evaluate(()=>localStorage.getItem('pcglow')==='off'),'背景の光の保存');
    /* お気に入りショートカット：行を押すとページ（説明の文＋3つ）、選ぶと保存・一覧へ戻って右の表示が変わる */
    await pg.evaluate(()=>{settingsClose();settingsOpen()});await pg.waitForTimeout(400);
    await pg.click('#setm [data-sm-go=qa]');await pg.waitForTimeout(350);
    ok(await pg.evaluate(()=>document.getElementById('sm-t').textContent==='お気に入りショートカット'&&!!document.querySelector('#setm .qa-sd')&&document.querySelectorAll('#setm .qa-opt').length===3&&[...document.querySelectorAll('#setm .qa-opt')].every(o=>o.getBoundingClientRect().height>=44)),'ショートカットの行を押すとページが開く');
    await pg.click('#setm .qa-opt:has(input[value=party-create])');await pg.waitForTimeout(600);
    ok(await pg.evaluate(()=>localStorage.getItem('pcquick')==='party-create'&&document.getElementById('sm-t').textContent==='設定'&&document.getElementById('sm-v-qa').textContent==='パーティ新規作成'&&document.getElementById('fab').querySelector('.fl').textContent==='パーティ'),'ショートカットを選ぶと保存・一覧へ戻る');
    /* アカウントの行を押すとその画面へ移り、設定の画面は閉じる */
    await pg.click('#setm a[href="#/account"]');await pg.waitForTimeout(500);
    ok(await pg.evaluate(()=>location.hash==='#/account'&&document.getElementById('setm').hidden),'アカウントへ移ると閉じる');}
  ok(!pg.errs.length,W+'：設定のエラー '+pg.errs);await pg.close()}
await b.close();
console.log(bad?`quick: ${bad}/${n} 項目が失敗`:`quick: OK（${n}項目）`);process.exit(bad?1:0);
