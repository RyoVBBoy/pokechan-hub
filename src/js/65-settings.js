/* ===================== 設定とプライバシー＝画面の真ん中に開く設定の画面（2026/11/10 依頼主「X の設定画面と同じに」） =====================
   左から出るメニューの「設定とプライバシー」を押すと開く（メニューの幅では狭く、名前が「…」で切れていたため）。
   ・PC：画面の真ん中に幅600pxまでの画面。スマホ（699px以下）：下からすべり上がる全画面
   ・上：←（中のページなら一覧へ戻る／一覧なら閉じる）・題名「設定」・✕（閉じる）
   ・一覧：1項目＝1行（左に絵・太字の名前・右に今の設定と ›）。選ぶ項目は行を押すと、その項目のページ（✓ が今の選択）に切りかわる
   ・保存のしかた（localStorage）は前と同じ。明るさ・テーマの色・背景の光・お気に入りショートカットは読み直さずにその場で変わり、画面は開いたまま（2026/11/11）。
     言語だけは読み直し、読み直したあとに同じページを動きなしで開き直す（sessionStorage pcsmre） */
const SM={el:null,page:null,last:null};
const SM_VAL={
  qa:()=>qaName(qaGet()),
  theme:()=>({auto:'端末に合わせる',light:'ライト',dark:'ダーク'}[THEME_PREF]),
  accent:()=>drDot(accCol(ACCENTS[ACCENT]))+L(ACCENTS[ACCENT][0],ACCENTS[ACCENT][1]),
  glow:()=>({strong:'強め',normal:'ふつう',off:'なし'}[GLOW]||'ふつう'),
  lang:()=>(LANGS.find(x=>x[0]===LANG)||LANGS[0])[1]};
const SM_PAGES={
  qa:{ic:I.zap,t:()=>L('お気に入りショートカット','Favorite shortcut'),body:()=>qaOptsHTML()},
  theme:{ic:I.sun,t:()=>'明るさ',body:()=>[['auto','端末に合わせる',I.phone],['light','ライト',I.sun],['dark','ダーク',I.moon]].map(([k,n,ic])=>drOpt(`data-theme-set="${k}"`,THEME_PREF===k,ic,n)).join('')},
  accent:{ic:I.palette,t:()=>'テーマの色',body:()=>Object.entries(ACCENTS).map(([k,a])=>drOpt(`data-acc-set="${k}"`,ACCENT===k,drDot(accCol(a)),L(a[0],a[1]))).join('')},
  glow:{ic:I.spark,t:()=>'背景の光',body:()=>[['strong','強め'],['normal','ふつう'],['off','なし']].map(([k,n])=>drOpt(`data-glow-set="${k}"`,GLOW===k,I.spark,n)).join('')},
  lang:{ic:I.globe,t:()=>'言語 / Language',body:()=>LANGS.map(([k,n])=>drOpt(`data-lang-set="${k}"`,LANG===k,I.globe,n)).join('')}};
const smRow=id=>{const p=SM_PAGES[id];return `<button class="dr-row" data-sm-go="${id}">${drRowIn(p.ic,p.t(),'',`<span class="dr-rv" id="sm-v-${id}">${SM_VAL[id]()}</span>${drChev()}`)}</button>`};
function smMainHTML(){
  const ids=(curGame().fab?['qa']:[]).concat(['theme','accent','glow','lang']);
  return `<section class="sm-sec" aria-label="表示・カスタマイズ"><h3 class="sm-sh">表示・カスタマイズ</h3>${ids.map(smRow).join('')}</section>
    <section class="sm-sec" aria-label="通知"><h3 class="sm-sh">通知</h3><div id="sm-push"></div></section>
    <section class="sm-sec" aria-label="アカウントとセキュリティ"><h3 class="sm-sh">アカウント＆セキュリティ</h3>
      ${typeof AUTH!=='undefined'&&AUTH.profile&&typeof privSetRowHTML==='function'?privSetRowHTML(AUTH.profile)+drLink('#/requests',I.user,'フォローリクエスト'):''}${drLink('#/account',I.user,'アカウント')}${drLink('#/privacy',I.lock,'プライバシーポリシー')}${drLink('#/terms',I.doc,'利用規約')}</section>`}
function smEnsure(){
  if(SM.el)return SM.el;
  const o=document.createElement('div');o.className='setm';o.id='setm';o.hidden=true;
  o.innerHTML=`<div class="sm-bg"></div><div class="sm-p" role="dialog" aria-modal="true" aria-labelledby="sm-t" tabindex="-1">
    <header class="sm-h"><button class="sm-ib" data-sm="back" aria-label="戻る">${SVG(I.back,20)}</button><h2 id="sm-t">設定</h2><button class="sm-ib" data-sm="close" aria-label="閉じる">${SVG(I.x,20)}</button></header>
    <div class="sm-body"><div class="sm-pg sm-main"></div><div class="sm-pg sm-sub" hidden></div></div></div>`;
  document.body.appendChild(o);SM.el=o;
  o.addEventListener('click',e=>{
    if(e.target.closest('.sm-bg')||e.target.closest('[data-sm=close]')){settingsClose();return}
    if(e.target.closest('[data-sm=back]')){SM.page?smBack():settingsClose();return}
    const go=e.target.closest('[data-sm-go]');if(go){smGo(go.dataset.smGo);return}
    const ts=e.target.closest('[data-theme-set]');if(ts){smPick(ts,'theme',()=>setTheme(ts.dataset.themeSet));return}
    const as=e.target.closest('[data-acc-set]');if(as){if(as.dataset.accSet!==ACCENT)smPick(as,'accent',()=>setAccent('pcaccent',as.dataset.accSet));return}
    const gs=e.target.closest('[data-glow-set]');if(gs){if(gs.dataset.glowSet!==GLOW)smPick(gs,'glow',()=>setAccent('pcglow',gs.dataset.glowSet));return}
    const ls=e.target.closest('[data-lang-set]');if(ls){if(ls.dataset.langSet!==LANG)smPick(ls,'lang',()=>setLang(ls.dataset.langSet));return}
    if(e.target.closest('a[href^="#/"]'))settingsClose();
  });
  o.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();SM.page?smBack():settingsClose()}});
  return o;
}
/* 開く（page を渡すとその項目のページから） */
function settingsOpen(page,opt={}){
  const o=smEnsure();SM.last=document.activeElement;
  o.querySelector('.sm-main').innerHTML=smMainHTML();
  if(typeof pushRow==='function')pushRow(document.getElementById('sm-push'),false,true);
  if(typeof privRowBind==='function')privRowBind(o);
  smBack(true);if(page&&SM_PAGES[page])smGo(page,true);
  o.hidden=false;document.body.classList.add('sm-lock');
  /* 読み直したあとに開き直すときは、動き（下からすべり上がる・ふわっと出る）なしでその場に出す（2026/11/10 依頼主：設定を変えるたびに下から上に動くのが気になる） */
  if(opt.instant){o.classList.add('sm-now','on');o.querySelector('.sm-p').focus({preventScroll:true});requestAnimationFrame(()=>requestAnimationFrame(()=>o.classList.remove('sm-now')));return}
  requestAnimationFrame(()=>requestAnimationFrame(()=>{o.classList.add('on');o.querySelector('.sm-p').focus({preventScroll:true})}));
}
function settingsClose(){
  const o=SM.el;if(!o||o.hidden)return;
  o.classList.remove('on');document.body.classList.remove('sm-lock');
  setTimeout(()=>{if(!o.classList.contains('on'))o.hidden=true},matchMedia('(prefers-reduced-motion: reduce)').matches?0:260);
  try{SM.last&&SM.last.focus&&SM.last.focus({preventScroll:true})}catch(e){}
}
/* 項目のページへ（一覧はそのまま残し、ページだけ入れかえる） */
function smGo(id,quiet){
  const p=SM_PAGES[id],o=SM.el;if(!p||!o)return;SM.page=id;
  const sub=o.querySelector('.sm-sub');
  sub.innerHTML=`<div class="dr-opts" role="group" aria-label="${p.t()}">${p.body()}</div>`;
  o.querySelector('.sm-main').hidden=true;sub.hidden=false;o.querySelector('#sm-t').textContent=p.t();
  sub.classList.remove('in');if(!quiet){void sub.offsetWidth;sub.classList.add('in')}
  o.querySelector('.sm-body').scrollTop=0;
}
function smBack(quiet){
  const o=SM.el;if(!o)return;const was=SM.page;SM.page=null;
  const main=o.querySelector('.sm-main'),sub=o.querySelector('.sm-sub');
  sub.hidden=true;sub.innerHTML='';main.hidden=false;o.querySelector('#sm-t').textContent='設定';
  main.classList.remove('in');if(!quiet){void main.offsetWidth;main.classList.add('in')}
  const r=was&&o.querySelector(`[data-sm-go="${was}"]`);if(r&&!quiet)r.focus({preventScroll:true});
}
/* 選択肢を押したとき：✓ と一覧の右の表示をすぐ変えて保存し、その場で見た目を変える（2026/11/11 依頼主：読み直さない・設定の画面は開いたまま）。
   言語だけは、ポケモン・技などの名前を起動のときに入れかえる作りなので読み直す（読み直したあと同じページを動きなしで開き直す） */
function smPick(btn,id,fn){
  const box=btn.closest('.dr-opts');if(box)box.querySelectorAll('.dr-opt').forEach(x=>x.setAttribute('aria-pressed',x===btn?'true':'false'));
  const v=document.getElementById('sm-v-'+id);if(v)v.innerHTML=(id==='accent'?btn.querySelector('.dr-ri').innerHTML:'')+btn.querySelector('.dr-rt b').textContent;
  if(id==='lang'){try{sessionStorage.setItem('pcsmre',id)}catch(e){}setTimeout(fn,matchMedia('(prefers-reduced-motion: reduce)').matches?0:180);return}
  fn();smRefresh()}
/* 設定の画面の中身を、いまの設定で描き直す（明るさが変わると色の丸の色も変わるため）。開いているページ・スクロール位置はそのまま */
function smRefresh(){
  const o=SM.el;if(!o||o.hidden)return;const body=o.querySelector('.sm-body'),y=body.scrollTop;
  o.querySelector('.sm-main').innerHTML=smMainHTML();
  if(typeof pushRow==='function')pushRow(document.getElementById('sm-push'),false,true);
  if(SM.page){const p=SM_PAGES[SM.page];o.querySelector('.sm-sub').innerHTML=`<div class="dr-opts" role="group" aria-label="${p.t()}">${p.body()}</div>`}
  body.scrollTop=y}
/* 読み直したあと、設定の画面を開き直す（選んでいた項目のページのまま・動きなし） */
(function(){let re=null;try{re=sessionStorage.getItem('pcsmre');sessionStorage.removeItem('pcsmre')}catch(e){}if(re)settingsOpen(SM_PAGES[re]?re:null,{instant:true})})();
