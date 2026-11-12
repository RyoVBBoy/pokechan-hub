// 使いやすさの改善 第1段階（2026/11/12）の確認：
// ①空のパーティのはじめ方（診断・選出は隠す、ダメージ計算は残す）②選ぶ画面を閉じずに続けて選ぶ（重なり・6匹の上限・3つの枠）
// ③育成の自動保存の表示（端末だけ／ログイン中は同期が終わってから ✓／失敗）④名前で絞り込める選ぶ欄（持ち物・特性・技、同じ技は選べない）
// ⑤ダメージ計算の結果の札（計算の数は変えない）⑥右下の⚡のつまみ・入力中は隠す ⑦幅390・1280で横にはみ出さない
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
let ng=0,n=0;const ok=(c,m)=>{n++;if(!c){ng++;console.log('NG '+m)}};
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const errs=[];
const pg=await (await b.newContext({viewport:{width:390,height:844},locale:'ja-JP'})).newPage();
pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(URL0+'#/team');await pg.waitForTimeout(1200);
const W=ms=>pg.waitForTimeout(ms);

/* ---------- ①空のパーティ ---------- */
await pg.evaluate(()=>{team=[];saveTeam();teamRender()});await W(200);
let st=await pg.evaluate(()=>({onb:!!document.querySelector('#tonb .tonb'),rec:document.querySelector('#tonb a[href="#/learn/build"]')?.textContent,imp:!!document.querySelector('#tonb a[href="#/import"]'),
  slots:document.getElementById('slots').hidden,diag:!document.querySelector('[data-tqa]')&&![...document.querySelectorAll('.tqa a,.tqa button')].some(b=>/^(診断|選出)$/.test(b.textContent.trim())),calc:!!document.querySelector('.tqa a[href="#/calc"]')&&getComputedStyle(document.querySelector('.tqa a[href="#/calc"]')).display!=='none'}));
ok(st.onb&&/おすすめパーティから始める/.test(st.rec||'')&&st.imp,'空のパーティのはじめ方が出ません '+JSON.stringify(st));
ok(st.slots&&st.diag&&st.calc,'診断・選出のボタンが残っているか、ダメージ計算がありません '+JSON.stringify(st));

/* ---------- ②続けて選ぶ ---------- */
await pg.click('#tonb-pick');await W(400);
ok(await pg.$('.mpsheet #mp-pt'),'続けて選ぶ画面に、いまのパーティの並びが出ません');
for(const no of [445,149,6]){await pg.click(`.mpsheet [data-no="${no}"]`);await W(200)}
st=await pg.evaluate(()=>({open:!!document.querySelector('.mpsheet'),n:team.map(x=>x.no).join(),st:document.getElementById('mp-st')?.textContent,pt:document.querySelector('.mp-pt-n')?.textContent,hid:!document.querySelector('.mpsheet [data-no="445"]')}));
ok(st.open&&st.n==='445,149,6'&&/3\/6/.test(st.st)&&/3\/6/.test(st.pt.replace(/\s/g,'')),'選んでも閉じずに続けて選べません '+JSON.stringify(st));
ok(st.hid,'入れた匹が一覧に残っています（2回選べてしまう）');
/* 同じ匹・7匹目は足さない（判定は teamAddQuiet） */
st=await pg.evaluate(()=>[teamAddQuiet(445),team.length]);
ok(st[0].ok===false&&/もうパーティ/.test(st[0].msg)&&st[1]===3,'同じポケモンが2回入ります '+JSON.stringify(st));
for(const no of [9,3]){await pg.click(`.mpsheet [data-no="${no}"]`);await W(200)}
await pg.click('.mpsheet [data-no="25"]');await W(300);
st=await pg.evaluate(()=>({n:team.length,st:document.getElementById('mp-st')?.textContent}));
ok(st.n===6&&/6匹そろいました/.test(st.st||''),'6匹そろったことが分かりません '+JSON.stringify(st));
await W(1100);
ok(!(await pg.$('.mpsheet')),'6匹そろっても選ぶ画面が閉じません');
ok(await pg.evaluate(()=>teamAddQuiet(94).ok===false&&team.length===6),'7匹目が入ります');
st=await pg.evaluate(()=>({tiles:document.querySelectorAll('#slots .tile[data-ti]').length,onb:!!document.querySelector('#tonb .tonb'),diag:/ダメージ計算/.test(document.querySelector('.tqa').textContent)&&/↗/.test(document.querySelector('.tqa').textContent)}));
ok(st.tiles===6&&!st.onb&&st.diag,'閉じたあとにパーティの画面が描き直されません '+JSON.stringify(st));
/* やめると何も足さない・3つの枠 */
await pg.evaluate(()=>{switchTeam(1);team=[{no:445,sel:true}];saveTeam();teamRender()});await W(100);
await pg.click('#slots [data-add]');await W(300);await pg.click('.mpsheet .mp-x');await W(300);
ok(await pg.evaluate(()=>team.length===1&&TEAMS.list[0].team.length===6),'やめたのにポケモンが入ったか、ほかの枠が変わりました');
await pg.evaluate(()=>{switchTeam(2);teamRender()});await W(100);
ok(await pg.evaluate(()=>!!document.querySelector('#tonb .tonb')&&/パーティ3/.test(document.getElementById('tonb-h').textContent)),'空の枠に切りかえてもはじめ方が出ません');
await pg.evaluate(()=>{switchTeam(0);teamRender()});await W(100);
ok(await pg.evaluate(()=>team.length===6&&!document.querySelector('#tonb .tonb')),'枠を切りかえて戻るとパーティが変わります');
await pg.evaluate(()=>{switchTeam(0)});

/* ---------- ③自動保存の表示 ---------- */
await pg.evaluate(()=>{location.hash='#/edit/0'});await W(700);
ok(await pg.$eval('#ed-save',e=>/自動で保存/.test(e.textContent)),'育成の画面に保存の表示がありません');
ok(await pg.evaluate(()=>{const d=document.querySelector('.ed-intro');return !d||(!d.open&&d.querySelector('summary').textContent.length<60)}),'説明が1行にたたまれていません');
await pg.evaluate(()=>{const e=document.getElementById('ed-sp0');e.value=10;e.dispatchEvent(new Event('input'))});await W(100);
ok(await pg.$eval('#ed-save',e=>e.textContent==='自動保存済み ✓'),'ログインしていないとき、端末に保存しても ✓ になりません');
/* ログイン中：同期が終わるまで「保存中…」、終わったら ✓、失敗なら「保存できませんでした」 */
await pg.evaluate(()=>{window.__fail=false;window.__hold=null;AUTH.user={uid:'U',getIdToken:async()=>'x'};AUTH.profile={handle:'u'};
  window.twAuth=async()=>({handle:'u'});
  window.authFetch=async(p,body)=>{if(window.__hold)await window.__hold;if(window.__fail)throw Object.assign(new Error('x'),{status:0});
    if(p==='/api/me/teams')return body?{ok:true}:{teams:null,updated_at:0,now:Date.now()};return{}}});
await pg.evaluate(()=>{window.__hold=new Promise(r=>window.__rel=r);const e=document.getElementById('ed-sp0');e.value=12;e.dispatchEvent(new Event('input'))});await W(100);
ok(await pg.$eval('#ed-save',e=>e.textContent==='保存中…'),'ログイン中に保存中…になりません');
await W(1800);
ok(await pg.$eval('#ed-save',e=>e.textContent==='保存中…'),'サーバーへの保存が終わる前に ✓ になりました');
await pg.evaluate(()=>window.__rel());await W(400);
ok(await pg.$eval('#ed-save',e=>e.textContent==='自動保存済み ✓'),'サーバーへの保存が終わっても ✓ になりません');
/* 続けて変える：前の同期の成功では ✓ にしない */
await pg.evaluate(()=>{window.__hold=new Promise(r=>window.__rel=r);const e=document.getElementById('ed-sp0');e.value=14;e.dispatchEvent(new Event('input'));
  document.dispatchEvent(new CustomEvent('pcsync',{detail:{state:'ok',started:Date.now()-5000}}))});await W(100);
ok(await pg.$eval('#ed-save',e=>e.textContent==='保存中…'),'前の同期の成功で ✓ になりました');
await pg.evaluate(()=>{window.__fail=true;window.__rel()});await W(2200);
ok(await pg.$eval('#ed-save',e=>e.textContent==='保存できませんでした'),'サーバーに保存できないときに失敗が出ません');
await pg.evaluate(()=>{window.__fail=false;AUTH.user=null;AUTH.profile=null;clearTimeout(SYNC.t)});

/* ---------- ④名前で絞り込める選ぶ欄 ---------- */
ok(await pg.evaluate(()=>['#ed-ab','#ed-it','[data-mv="0"]'].every(q=>{const s=document.querySelector(q);return s&&s.classList.contains('ss-src')&&s.nextElementSibling.classList.contains('ss-btn')})),'育成の画面の持ち物・特性・技が検索できる欄になっていません');
const n0=await pg.evaluate(()=>document.querySelectorAll('#ed-it option').length);
await pg.click('#ed-it + .ss-btn');await W(300);
ok(await pg.evaluate(n=>document.querySelectorAll('.ssheet .ss-r').length===n,n0),'持ち物の一覧が全部出ません');
await pg.fill('.ss-q','たべのこし');await W(100);
ok(await pg.evaluate(()=>[...document.querySelectorAll('.ssheet .ss-r')].length===1),'持ち物を名前で絞り込めません');
await pg.fill('.ss-q','');await W(100);
ok(await pg.evaluate(n=>document.querySelectorAll('.ssheet .ss-r').length===n,n0),'文字を消しても全部に戻りません');
await pg.fill('.ss-q','たべのこし');await pg.keyboard.press('Enter');await W(300);
st=await pg.evaluate(()=>[team[0].set.it&&team[0].set.it.k,document.querySelector('#ed-it + .ss-btn').textContent,!!document.querySelector('.ssheet')]);
ok(st[0]==='leftovers'&&/たべのこし/.test(st[1])&&!st[2],'持ち物を選べません '+JSON.stringify(st));
/* 特性：持てる特性だけ */
await pg.click('#ed-ab + .ss-btn');await W(300);
st=await pg.evaluate(()=>[document.querySelectorAll('.ssheet .ss-r').length,(ABD[445]||[]).length]);
ok(st[0]===st[1],'特性の一覧が持てる特性と違います '+JSON.stringify(st));
await pg.keyboard.press('Escape');await W(300);
ok(!(await pg.$('.ssheet')),'Esc で閉じません');
/* 技：同じ技は2つ選べない（今までの確かめをそのまま使う） */
const m1=await pg.evaluate(()=>team[0].set.mv[0]&&team[0].set.mv[0].n);
await pg.click('[data-mv="1"] + .ss-btn');await W(300);
await pg.fill('.ss-q',m1);await W(100);await pg.click('.ssheet .ss-r');await W(400);
st=await pg.evaluate(()=>[team[0].set.mv.map(m=>m.n),document.querySelector('[data-mv="1"] + .ss-btn').textContent]);
ok(st[0].filter(x=>x===m1).length===1&&!st[1].startsWith(m1),'同じ技を2つ選べてしまいます '+JSON.stringify(st));

/* ---------- ⑤ダメージ計算の結果 ---------- */
await pg.evaluate(()=>{location.hash='#/calc'});await W(900);
st=await pg.evaluate(()=>{const R=calcResult(),lo=Math.min(...R.r),hi=Math.max(...R.r),p=v=>(v/R.d.max*100).toFixed(1);
  return{big:document.querySelector('.cres-big').textContent.replace(/\s/g,''),exp:`${p(lo)}%〜${p(hi)}%`,kb:document.querySelector('.cv-kb')?.textContent,lab:koLabel(R.ko),raw:document.querySelector('.cv-raw')?.textContent.replace(/\s/g,''),rawExp:`ダメージ${lo}–${hi}／HP${R.d.max}`,
    fs:[parseFloat(getComputedStyle(document.querySelector('.cres-big')).fontSize),parseFloat(getComputedStyle(document.querySelector('.cv-raw')).fontSize)]}});
ok(st.big===st.exp,'ダメージの％が計算と違います '+JSON.stringify(st));
ok(st.kb&&st.lab.startsWith(st.kb.replace(/\d+(\.\d+)?%$|0\.1%未満$/,'')),'確定・乱数の札が計算と違います '+JSON.stringify(st));
ok(st.raw===st.rawExp&&st.fs[1]<st.fs[0]/2,'ダメージとHPの数が小さい別の行になっていません '+JSON.stringify(st));
ok(await pg.evaluate(()=>['a.item','d.ab','mv'].every(k=>{const s=document.querySelector(`[data-c="${k}"]`);return !s||s.nextElementSibling&&s.nextElementSibling.classList.contains('ss-btn')})),'ダメージ計算の持ち物・特性・技が検索できる欄になっていません');
/* 計算の画面で持ち物を選ぶと計算が変わる（select の change が届く） */
await pg.evaluate(()=>{document.querySelector('details[data-more="a"]').open=true});
const before=await pg.evaluate(()=>CS.a.item);
await pg.click('[data-c="a.item"] + .ss-btn');await W(300);await pg.fill('.ss-q','いのちのたま');await pg.keyboard.press('Enter');await W(400);
ok(await pg.evaluate(()=>CS.a.item==='lifeorb')&&before!=='lifeorb','ダメージ計算の持ち物を選べません');

/* ---------- ⑥右下の⚡ ---------- */
st=await pg.evaluate(()=>{const w=document.getElementById('fabwrap'),f=document.getElementById('fab').getBoundingClientRect();return{dock:w.classList.contains('dock'),w:f.width,r:Math.round(innerWidth-f.right)}});
ok(st.dock&&st.w<=24&&st.r<=1,'ダメージ計算の画面で⚡が右の端のつまみになりません '+JSON.stringify(st));
/* つまみが数字・ボタンに重ならない（右の16pxの余白＋少しだけ） */
const over=await pg.evaluate(()=>{const f=document.getElementById('fab').getBoundingClientRect();
  return [...document.querySelectorAll('#view .cv-mp,#view .cres-big,#view .cv-kb,#view .cv-mk,#view .ss-btn')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>f.left+1&&r.bottom>f.top&&r.top<f.bottom}).map(e=>e.className)});
ok(!over.length,'⚡のつまみが数字に重なっています '+over.join());
await pg.click('#fab');await W(400);
ok(await pg.evaluate(()=>typeof sheetOpen!=='undefined'&&sheetOpen),'つまみを押しても相性の画面が開きません');
await pg.evaluate(()=>closeSheet());
await pg.evaluate(()=>{location.hash='#/tools'});await W(700);
ok(await pg.evaluate(()=>!document.getElementById('fabwrap').classList.contains('dock')),'ツールの画面の上で⚡が元の形になりません');
await pg.evaluate(()=>{SCROLLER.scrollTop=600;SCROLLER.dispatchEvent(new Event('scroll'))});await W(200);
ok(await pg.evaluate(()=>document.getElementById('fabwrap').classList.contains('dock')),'下にスクロールしても⚡がつまみになりません');
await pg.evaluate(()=>{SCROLLER.scrollTop=0;SCROLLER.dispatchEvent(new Event('scroll'))});await W(200);
ok(await pg.evaluate(()=>!document.getElementById('fabwrap').classList.contains('dock')),'上に戻っても⚡が元の形になりません');
await pg.evaluate(()=>{location.hash='#/calc'});await W(800);
await pg.evaluate(()=>{document.querySelector('details[data-more="x"]').open=true});
await pg.focus('[data-c="aHP"]');await W(200);
ok(await pg.evaluate(()=>getComputedStyle(document.getElementById('fabwrap')).visibility==='hidden'),'入力中に⚡が隠れません');
await pg.evaluate(()=>document.activeElement.blur());await W(300);
ok(await pg.evaluate(()=>getComputedStyle(document.getElementById('fabwrap')).visibility!=='hidden'),'入力が終わっても⚡が戻りません');

/* ---------- ⑦はみ出し（390・1280） ---------- */
for(const w of [390,1280]){
  await pg.setViewportSize({width:w,height:900});
  for(const h of ['#/team','#/edit/0','#/calc']){await pg.evaluate(x=>{location.hash=x},h);await W(700);
    const o=await pg.evaluate(()=>document.body.scrollWidth-document.documentElement.clientWidth);ok(o<=1,`幅${w}の ${h} が横にはみ出します（${o}px）`)}
}
await pg.setViewportSize({width:1280,height:900});await pg.evaluate(()=>{location.hash='#/edit/0'});await W(600);
await pg.click('#ed-it + .ss-btn');await W(300);
st=await pg.evaluate(()=>{const p=document.querySelector('.ssheet .psheet-p').getBoundingClientRect();return{w:Math.round(p.width),focus:document.activeElement&&document.activeElement.classList.contains('ss-q')}});
ok(st.w<=560&&st.focus,'パソコンで検索できる選ぶ欄が真ん中に出ないか、検索欄に入りません '+JSON.stringify(st));
await pg.keyboard.press('ArrowDown');await pg.keyboard.press('ArrowDown');
ok(await pg.evaluate(()=>!!document.querySelector('.ssheet .ss-r.act')),'矢印キーで選べません');
await pg.keyboard.press('Escape');await W(300);

ok(!errs.length,'ページのエラー: '+errs.join(' / '));
await b.close();
console.log(ng?`ux1: NG （${n}項目）`:`ux1: OK（${n}項目）`);
process.exit(ng?1:0);
