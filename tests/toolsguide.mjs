// ツールの画面の並び（まずはこの3つ → すぐ使う → その他のツール）と、画面で見る使い方（84-toolsguide.js）の確認（2026/11/16 依頼主）
// SHOT=フォルダ を付けると、確かめた画面のスクリーンショットをそこに書く
import {chromium} from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
const SHOT=process.env.SHOT||'';
let n=0;const ok=(c,m,x)=>{n++;if(!c){console.error('NG',m,x===undefined?'':JSON.stringify(x).slice(0,400));process.exitCode=1}};
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const W8=(pg,t=400)=>pg.waitForTimeout(t);

/* 画像のファイル：作った分がそろっていて、WebP で、TG_SHOTS の大きさと合う */
{const src=fs.readFileSync(path.join(ROOT,'src/js/83-guide-shots.js'),'utf8'),S=JSON.parse(src.match(/TG_SHOTS=(\{.*\});/)[1]);
  ok(['tools','calc','team','pin'].every(k=>S[k]),'画像の一覧に4つの場面がある',Object.keys(S));
  ok(Object.values(S).every(x=>x.d&&x.l&&x.d.f!==x.l.f),'場面ごとに暗い色・明るい色の2つの画像がある',S);
  for(const [k,s] of Object.entries(S).flatMap(([k,x])=>[[k+'(暗)',x.d],[k+'(明)',x.l]])){const f=path.join(ROOT,'dist',s.f);
    ok(fs.existsSync(f),'画像が公開する所にある：'+s.f);
    const buf=fs.readFileSync(f);ok(buf.slice(0,4).toString()==='RIFF'&&buf.slice(8,12).toString()==='WEBP','画像は WebP：'+s.f);
    ok(buf.length<80*1024,'画像は80KB未満：'+s.f,buf.length);
    ok(s.r.every(v=>v>=0)&&s.r[0]+s.r[2]<=100.5&&s.r[1]+s.r[3]<=100.5,'押す場所の枠が画像の中：'+k,s.r)}}

for(const W of [390,1280]){
  const ctx=await b.newContext({viewport:{width:W,height:W<700?844:900},locale:'ja-JP',hasTouch:W<700,isMobile:W<700,deviceScaleFactor:SHOT?2:1});
  await ctx.addInitScript(()=>{try{if(!sessionStorage.getItem('__i')){localStorage.setItem('pchowtotest','1');localStorage.setItem('pcstart','1')}sessionStorage.setItem('__i','1')}catch(e){}});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));await pg.route(/^https?:/,r=>r.abort());
  await pg.goto(URL0+'#/tools');await pg.waitForFunction(()=>typeof TEAMS==='object'&&!!document.querySelector('.tprim'));await W8(pg,500);

  /* ① 並び：まずはこの3つ → すぐ使う → その他のツール（すぐ使うがその他の下に無い） */
  const ord=await pg.evaluate(()=>{const y=s=>{const e=document.querySelector('#view '+s);return e?e.getBoundingClientRect().top:null};
    const h=[...document.querySelectorAll('#view h2')].map(e=>e.textContent.trim());
    return{prim:y('.tprim'),quick:y('.tquick'),other:y('.tother-h'),hero:y('.hero'),h,quickN:document.querySelectorAll('#view .tquick .ttile').length,
      afterOther:[...document.querySelectorAll('#view .tother-h ~ *')].some(e=>e.matches('.tquick')||!!e.querySelector('.tgrid'))}});
  ok(ord.prim!=null&&ord.quick!=null&&ord.other!=null&&ord.prim<ord.quick&&ord.quick<ord.other&&ord.other<ord.hero,W+'：並びが まずはこの3つ → すぐ使う → その他のツール → そのほか',ord);
  ok(!ord.afterOther,W+'：「すぐ使う」が「その他のツール」の下に無い');
  ok(ord.h.indexOf('まずはこの3つ')<ord.h.indexOf('すぐ使う')&&ord.h.indexOf('すぐ使う')<ord.h.indexOf('その他のツール')&&!ord.h.includes('そのほかのツール'),W+'：見出しの順と名前',ord.h);
  ok(ord.quickN>0,W+'：すぐ使うのツールが出る',ord.quickN);
  ok(await pg.evaluate(()=>document.body.scrollWidth-document.documentElement.clientWidth)<=1,W+'：横にはみ出さない');
  ok(await pg.$eval('.tprim',e=>e.getAttribute('aria-labelledby')==='tprim-h')&&await pg.$eval('.tquick',e=>e.getAttribute('aria-labelledby')==='tquick-h'),W+'：まとまりに見出しの名前が付いている');

  /* ② はじめてだけのカード */
  ok(await pg.$eval('#view > .tg-card:first-child',e=>e.textContent.includes('はじめての方へ')).catch(()=>false),W+'：はじめて開くと、いちばん上に使い方のカード');
  ok(await pg.$eval('.tg-card',e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.height<=90}),W+'：カードは小さく画面に収まる');
  ok(await pg.$eval('[data-tg-x]',e=>!!e.getAttribute('aria-label')&&e.getBoundingClientRect().width>=44),W+'：閉じるボタンに名前・押しやすい大きさ');
  if(SHOT)await pg.screenshot({path:path.join(SHOT,`tools-${W}.png`)});

  /* ③ 見る：1ステップずつ。実際の画面の画像・押す場所の枠・短い説明・前へ／次へ */
  await pg.click('.tg-card [data-tg-open]');await W8(pg);
  const dlg=await pg.$eval('.tg-p',e=>({role:e.getAttribute('role'),modal:e.getAttribute('aria-modal'),lb:document.getElementById(e.getAttribute('aria-labelledby'))?.textContent,n:e.querySelector('.tg-n').textContent,focus:document.activeElement===e.querySelector('.tg-next')}));
  ok(dlg.role==='dialog'&&dlg.modal==='true'&&dlg.lb==='まずはこの3つから'&&dlg.n==='1 / 4'&&dlg.focus,W+'：開くと1つ目のステップ（ダイアログ・見出し・「次へ」に焦点）',dlg);
  const fig=async()=>pg.evaluate(()=>{const im=document.querySelector('.tg-img'),f=document.querySelector('.tg-fig').getBoundingClientRect(),r=document.querySelector('.tg-ring').getBoundingClientRect(),i=im.getBoundingClientRect();
    return{nw:im.naturalWidth,alt:im.alt,inFig:r.left>=f.left-1&&r.right<=f.right+1&&r.top>=f.top-1&&r.bottom<=f.bottom+1,
      /* 枠が画像の上の、撮ったときと同じ場所（TG_SHOTS の％、1.5%まで）にある */
      sameBox:(()=>{const st=TG_STEPS[+document.querySelector('.tg-n').textContent.split(' / ')[0]-1],R=tgShot(st).r,q=[(r.left-i.left)/i.width,(r.top-i.top)/i.height,r.width/i.width,r.height/i.height].map(v=>v*100);
        return q.every((v,k)=>Math.abs(v-R[k])<1.5)})(),
      panelIn:(()=>{const p=document.querySelector('.tg-p').getBoundingClientRect();return p.left>=-1&&p.right<=innerWidth+1&&p.top>=-1&&p.bottom<=innerHeight+1})(),
      btnIn:(()=>{const p=document.querySelector('.tg-next').getBoundingClientRect();return p.bottom<=innerHeight+1&&p.height>=44})()}});
  await pg.waitForFunction(()=>document.querySelector('.tg-img').complete&&document.querySelector('.tg-img').naturalWidth>0);
  let F=await fig();
  ok(F.nw===780&&/実際の画面/.test(F.alt),W+'：実際の画面の画像（2倍の解像度）が読める・画像の説明がある',F);
  ok(F.inFig&&F.sameBox,W+'：押す場所の枠が画像の上の、撮ったときと同じ場所にある（ずれない）',F);
  ok(F.panelIn&&F.btnIn,W+'：画面に収まり、「次へ」が画面の中で押しやすい大きさ',F);
  ok(await pg.$eval('.tg-prev',e=>e.disabled),W+'：1つ目では「前へ」を押せない');
  if(SHOT)await pg.screenshot({path:path.join(SHOT,`guide-1-${W}.png`)});
  const seen=[];
  for(let k=0;k<4;k++){await pg.waitForFunction(()=>document.querySelector('.tg-img').complete);
    seen.push(await pg.evaluate(()=>[document.querySelector('.tg-n').textContent,document.getElementById('tg-t').textContent,document.querySelector('.tg-img').getAttribute('src'),document.querySelector('.tg-img').naturalWidth>0,document.querySelectorAll('.tg-dots i.on').length]));
    if(k<3){if(k===1)await pg.keyboard.press('ArrowRight');else await pg.click('.tg-next');await W8(pg,250)}}
  const want=await pg.evaluate(()=>TG_STEPS.map(st=>tgShot(st).f).join());
  ok(seen.map(x=>x[2]).join()===want&&seen.every(x=>x[3]&&x[4]===1),W+'：4つの画面を順に見られる（ボタン・→キー）',[seen,want]);
  ok(want.split(',').every(f=>/-light\.webp$/.test(f))===(await pg.evaluate(()=>document.documentElement.dataset.theme==='light')),W+'：画像はいまの明るさに合うもの',want);
  F=await fig();ok(F.inFig&&F.sameBox&&F.panelIn,W+'：最後のステップでも枠がずれない',F);
  if(SHOT)await pg.screenshot({path:path.join(SHOT,`guide-4-${W}.png`)});
  ok(await pg.$eval('.tg-next',e=>e.textContent)==='はじめる',W+'：最後のボタンは「はじめる」');
  await pg.keyboard.press('ArrowLeft');await W8(pg,200);ok(await pg.$eval('.tg-n',e=>e.textContent)==='3 / 4',W+'：←キーで戻れる');
  /* Tab は中で回る */
  for(let k=0;k<6;k++)await pg.keyboard.press('Tab');
  ok(await pg.evaluate(()=>!!document.activeElement.closest('.tg-p')),W+'：Tab で焦点がダイアログの外へ出ない');
  /* Esc で閉じる：カードも消え、次から出さない。焦点は開いたところへ */
  await pg.keyboard.press('Escape');await W8(pg,250);
  ok(!(await pg.$('.tg-v'))&&!(await pg.$('.tg-card')),W+'：Esc で閉じ、カードも消える');
  ok(await pg.evaluate(()=>localStorage.getItem('pctoolsguide')==='1'&&location.hash==='#/tools'),W+'：見たことを覚え、画面は移らない');
  ok(await pg.evaluate(()=>document.activeElement&&document.activeElement.matches('.tg-link,[data-tg-open]')),W+'：閉じたら焦点が「使い方を見る」に戻る');
  /* 見直す：見出しの横の「使い方を見る」。最後まで進めて「はじめる」で閉じる */
  await pg.evaluate(()=>{location.hash='#/calc'});await W8(pg);await pg.evaluate(()=>{location.hash='#/tools'});await W8(pg,500);
  ok(!(await pg.$('.tg-card')),W+'：一度見たらカードは出ない');
  ok(await pg.$eval('.tprim-hd .tg-link',e=>e.textContent.includes('使い方を見る')&&e.getBoundingClientRect().height>=44),W+'：「まずはこの3つ」の横に「使い方を見る」（いつでも見直せる）');
  await pg.click('.tprim-hd .tg-link');await W8(pg);
  ok(await pg.$eval('.tg-n',e=>e.textContent)==='1 / 4',W+'：見直すと1つ目から');
  for(let k=0;k<4;k++){await pg.click('.tg-next');await W8(pg,150)}
  ok(!(await pg.$('.tg-v')),W+'：最後の「はじめる」で閉じる');
  if(W>=700){await pg.click('.tprim-hd .tg-link');await W8(pg);await pg.mouse.click(5,5);await W8(pg,200);
    ok(!(await pg.$('.tg-v')),W+'：後ろの暗いところを押しても閉じる（パソコン。スマホは画面いっぱいで ✕・Esc）')}
  /* ④ ×だけでも閉じられる（見ずに） */
  await pg.evaluate(()=>{localStorage.removeItem('pctoolsguide');location.hash='#/calc'});await W8(pg);await pg.evaluate(()=>{location.hash='#/tools'});await W8(pg,500);
  ok(!!(await pg.$('.tg-card')),W+'：覚えを消すとカードがまた出る');
  await pg.click('[data-tg-x]');await W8(pg,200);
  ok(!(await pg.$('.tg-card'))&&!(await pg.$('.tg-v'))&&await pg.evaluate(()=>localStorage.getItem('pctoolsguide')==='1'),W+'：×でカードを閉じると、開かずに次から出さない');
  /* ⑤ スターと表示が一致し、外したツールは使っても戻らない */
  const tiles=()=>pg.locator('#view .tquick .ttile').evaluateAll(links=>links.map(a=>a.getAttribute('href')));
  const defaults=['assist','calc','types','meta'];
  const star=id=>pg.locator(`#view [data-tpin="${id}"]`);
  const checkPins=async ids=>JSON.stringify(await tiles())===JSON.stringify(ids.map(id=>'#/'+id));
  ok(await checkPins(defaults)&&await pg.locator('#view [data-tpin][aria-pressed="true"]').count()===4,
    W+'：初回は指定した4件がスター済みで「すぐ使う」に出る');
  ok(await star('calc').evaluate(e=>!e.closest('a')&&e.getBoundingClientRect().width>=44),
    W+'：ダメージ計算のカードに、リンクから独立したスターを表示');
  await star('calc').click();
  ok(await checkPins(['assist','types','meta'])&&await star('calc').getAttribute('aria-pressed')==='false',
    W+'：スターを外すとダメージ計算がすぐ消える');
  if(W>=700)ok(!(await pg.$('#pcs-tools .pcs-t[href="#/calc"]')),W+'：右側のすぐ使うにも反映');
  await pg.click('#view .tprim-c[href="#/calc"]');
  await pg.waitForFunction(()=>location.hash==='#/calc');
  await pg.goto(URL0+'#/tools');
  await star('calc').waitFor();
  ok(await checkPins(['assist','types','meta']),W+'：外したツールは開き直しで再表示されない');
  for(const id of ['assist','types','meta'])await star(id).click();
  /* 読み直す前に、端末に保存されたこと（localStorage の pctools）を確かめる。読み直したあとは起動の合図（__APP_READY）を待つ */
  const savedPins=()=>pg.evaluate(()=>{const o=JSON.parse(localStorage.getItem('pctools')||'{}');const g=curGame();return o[g.id]===undefined?null:o[g.id]});
  await pg.waitForFunction(()=>{const o=JSON.parse(localStorage.getItem('pctools')||'{}');const v=o[curGame().id];return Array.isArray(v)&&v.length===0},null,{timeout:10000}).catch(()=>{});
  const pinsBefore=await savedPins();ok(Array.isArray(pinsBefore)&&pinsBefore.length===0,W+'：読み直す前に、すべて外した状態が端末に保存されている',pinsBefore);
  await pg.reload();
  await pg.waitForFunction(()=>window.__APP_READY===true,null,{timeout:30000});
  ok(JSON.stringify(await savedPins())==='[]',W+'：読み直しても保存された値は同じ',await savedPins());
  await star('calc').waitFor();
  ok(await checkPins([])&&await pg.locator('#view .tquick').textContent().then(t=>t.includes('ここに追加')),
    W+'：すべて外した状態も再読み込み後に保つ');
  await star('cmp').click();
  await star('calc').click();
  ok(await checkPins(['calc','cmp']),W+'：追加したツールだけが新しい順で並ぶ');
  await pg.locator('#view .tquick .ttile[href="#/cmp"]').click();
  await pg.waitForFunction(()=>location.hash==='#/cmp');
  await pg.evaluate(()=>localStorage.setItem('pctools','{"pokechamp":["pip"]}'));
  await pg.goto(URL0+'#/tools');
  await star('pip').waitFor();
  ok(await checkPins(['pip']),W+'：以前に保存したスターを引き継ぐ');
  ok(!errs.length,W+'：エラーなし',errs);
  await ctx.close();
}

/* ⑧ 暗い色でも：画像は暗い色のもの・押す場所の枠がずれない・スマホは下からのシート（下に大きな空きがない） */
for(const W of [390,1280]){const ctx=await b.newContext({viewport:{width:W,height:W<700?844:900},locale:'ja-JP',colorScheme:'dark',hasTouch:W<700,isMobile:W<700});
  await ctx.addInitScript(()=>{try{localStorage.setItem('pchowtotest','1');localStorage.setItem('pcstart','1')}catch(e){}});
  const pg=await ctx.newPage();await pg.route(/^https?:/,r=>r.abort());await pg.goto(URL0+'#/tools');await W8(pg,700);
  await pg.click('.tprim-hd .tg-link');await pg.waitForFunction(()=>document.querySelector('.tg-img')&&document.querySelector('.tg-img').complete&&document.querySelector('.tg-img').naturalWidth>0);await W8(pg,200);
  const d=await pg.evaluate(()=>{const i=document.querySelector('.tg-img').getBoundingClientRect(),r=document.querySelector('.tg-ring').getBoundingClientRect(),R=tgShot(TG_STEPS[0]).r;
    const body=document.querySelector('.tg-body').getBoundingClientRect(),ft=document.querySelector('.tg-ft').getBoundingClientRect(),dots=document.querySelector('.tg-dots').getBoundingClientRect(),hd=document.querySelector('.tg-hd').getBoundingClientRect(),fig=document.querySelector('.tg-fig').getBoundingClientRect();
    return{f:document.querySelector('.tg-img').getAttribute('src'),theme:document.documentElement.dataset.theme,
      ring:[(r.left-i.left)/i.width,(r.top-i.top)/i.height,r.width/i.width,r.height/i.height].map((v,k)=>Math.abs(v*100-R[k])<1.5).every(Boolean),
      gapBelow:ft.top-dots.bottom,gapAbove:fig.top-hd.bottom,sheet:(()=>{const p=document.querySelector('.tg-p').getBoundingClientRect();return Math.abs(p.bottom-innerHeight)<2&&p.top>0})()}});
  ok(d.theme==='dark'&&!/-light/.test(d.f),W+'：暗い色では暗い色の画像',d);
  ok(d.ring,W+'：暗い色でも押す場所の枠がずれない',d);
  if(W<700)ok(d.gapBelow<48&&d.sheet,W+'：スマホは下からのシートで、画像と説明のすぐ下にボタン（大きな空きがない）',d);
  await ctx.close()}
/* ⑨ 読みやすさ：すりガラスの上の文字の明るさの比が4.5以上（明るい色・暗い色、スマホ・パソコン）。実際に描かれた画面の色で測る */
for(const W of [390,1280])for(const cs of ['light','dark']){
  const ctx=await b.newContext({viewport:{width:W,height:W<700?844:900},locale:'ja-JP',colorScheme:cs,hasTouch:W<700,isMobile:W<700});
  await ctx.addInitScript(()=>{try{if(!sessionStorage.getItem('__c')){localStorage.setItem('pchowtotest','1');localStorage.setItem('pcstart','1')}sessionStorage.setItem('__c','1')}catch(e){}});
  const pg=await ctx.newPage();await pg.route(/^https?:/,r=>r.abort());await pg.goto(URL0+'#/tools');await W8(pg,900);
  const ratio=async sel=>{const el=await pg.$(sel);const info=await el.evaluate(e=>{const r=e.getBoundingClientRect();return{c:getComputedStyle(e).color,r:{x:r.left,y:r.top,w:r.width,h:r.height}}});
    await el.evaluate(e=>{e.dataset.cc=e.style.color;e.style.color='transparent'});
    const shot=await pg.screenshot({clip:{x:Math.max(0,info.r.x),y:Math.max(0,info.r.y),width:Math.max(1,Math.min(info.r.w,40)),height:Math.max(1,info.r.h)}});
    await el.evaluate(e=>{e.style.color=e.dataset.cc});
    const bg=await pg.evaluate(async b64=>{const im=new Image();im.src='data:image/png;base64,'+b64;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);const d=x.getImageData(0,0,c.width,c.height).data;let r=0,g=0,bl=0,n=0;for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];bl+=d[i+2];n++}return[r/n,g/n,bl/n]},shot.toString('base64'));
    const nums=info.c.match(/[\d.]+/g).slice(0,3).map(Number),fg=/^color\(srgb/.test(info.c)?nums.map(v=>v*255):nums;
    const L=a=>{const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4};return .2126*f(a[0])+.7152*f(a[1])+.0722*f(a[2])};
    const l1=L(fg),l2=L(bg);return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)};
  const out={};for(const [k,s] of [['カードの題',' .tg-card-m b'],['カードの説明','.tg-card-m span'],['使い方を見る','.tprim-hd .tg-link'],['3つの説明','.tprim-d']])out[k]=+(await ratio(s)).toFixed(2);
  await pg.click('.tg-card [data-tg-open]');await pg.waitForFunction(()=>document.querySelector('.tg-img')&&document.querySelector('.tg-img').complete);await W8(pg,300);
  for(const [k,s] of [['見出し','#tg-t'],['説明','.tg-d'],['ステップ','.tg-n']])out[k]=+(await ratio(s)).toFixed(2);
  ok(Object.values(out).every(v=>v>=4.5),`${W}・${cs}：文字の明るさの比が4.5以上`,out);
  await ctx.close()}
/* ⑥ テストの画面（pchowtotest なし）ではカードを出さない＝ほかのテストの位置を変えない。見直しの入口は出る */
{const ctx=await b.newContext({viewport:{width:390,height:844},locale:'ja-JP'});const pg=await ctx.newPage();await pg.route(/^https?:/,r=>r.abort());
  await pg.goto(URL0+'#/tools');await W8(pg,700);
  ok(!(await pg.$('.tg-card'))&&!!(await pg.$('.tprim-hd .tg-link')),'テストの画面ではカードを出さない（見直しの入口は出る）');
  await ctx.close()}
/* ⑦ 英語では出さない（画像は日本語の画面なので） */
{const ctx=await b.newContext({viewport:{width:390,height:844},locale:'en-US'});await ctx.addInitScript(()=>{try{localStorage.setItem('pchowtotest','1')}catch(e){}});
  const pg=await ctx.newPage();await pg.route(/^https?:/,r=>r.abort());await pg.goto(URL0+'#/tools');await W8(pg,700);
  ok(await pg.evaluate(()=>LANG==='en')&&!(await pg.$('.tg-card'))&&!(await pg.$('.tg-link')),'英語の画面では使い方の画像を出さない');
  const o=await pg.evaluate(()=>[document.querySelector('.tprim').getBoundingClientRect().top,document.querySelector('.tquick').getBoundingClientRect().top,document.querySelector('.tother-h').getBoundingClientRect().top]);
  ok(o[0]<o[1]&&o[1]<o[2],'英語でも並びは同じ',o);
  await ctx.close()}
await b.close();
console.log(process.exitCode?'toolsguide: NG':`toolsguide: OK（${n}項目）`);
