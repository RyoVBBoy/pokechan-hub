/* ===================== ヘッダー / タブバー ===================== */
I.tool='<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3.6 17.2a1.6 1.6 0 0 0 2.3 2.3l5.7-5.7a4 4 0 0 0 5.2-5.4l-2.5 2.5-2.1-.6-.6-2.1z"/>';
I.chat='<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5z"/>';
/* 下のメニューの中身はゲームごとに違うので、27-games.js の drawNav() で作る */
const V=document.getElementById('view'),HI=document.getElementById('hdr-in'),HD=document.getElementById('hdr');
/* 左上のボタン：X と同じように、ログインしてプロフィールがあれば自分のアイコン、なければ人の形（2026/11/03 依頼主の要望）。
   押すと左のメニューが開くのは同じ。ホームでは見出しの文字を出さず、真ん中にサイトのマーク（logo.png）を出す */
function meMark(){
  const pr=typeof AUTH!=='undefined'&&AUTH.profile;
  return pr?`<span class="tw-av hd-av" data-notr>${avIn(pr)}</span>`
    :`<span class="tw-av hd-av hd-av--none">${SVG(I.user,18)}</span>`;
}
function refreshBrand(){const b=document.getElementById('brand');if(b)b.innerHTML=meMark()+(MULTI_GAME?'<i aria-hidden="true">▾</i>':'')}
function setHeader(title,back,o={}){
  HI.innerHTML=(back?`<a class="ibtn" href="${back}" data-back aria-label="戻る">${SVG(I.back,22)}</a>`
    :`<button class="mark mbtn" id="brand" aria-label="メニューを開く">${meMark()}${MULTI_GAME?'<i aria-hidden="true">▾</i>':''}</button>`)+`<h1>${title}</h1>`
    +(o.logo?`<a class="hd-logo" href="#/" aria-label="${esc(L('ホーム','Home'))}"><img src="logo.png" alt="" width="34" height="34"></a>`:'');
  /* 前にログインしていた端末では、プロフィールを読んでからアイコンに入れかえる */
  if(!back&&typeof AUTH!=='undefined'&&AUTH.profile===undefined&&typeof twAuth==='function'){let pin=null;try{pin=localStorage.getItem('pcin')}catch(e){}if(pin)twAuth().then(refreshBrand)}
}
let lastY=0;
SCROLLER.addEventListener('scroll',()=>{
  const y=scrY();HD.classList.toggle('sc',y>4);
  if(sheetOpen)return;
  if(y>lastY+8&&y>140)HD.classList.add('hide');
  else if(y<lastY-8||y<140)HD.classList.remove('hide');
  lastY=y;
},{passive:true});
function toast(m){const t=document.getElementById('toast');jaWrap(t,m);t.classList.add('on');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('on'),2200)}
/* 画面を移ったとき、前の画面で出ていた通知を消す（2026/11/10 図鑑の修正。いまは図鑑の一覧 dex() だけが呼ぶ）。呼んだ時点で出ている通知＝前の画面の通知。移った先でこのあと出す通知はいつもどおり出る。消える時間など通知のしくみは変えない */
function toastDropOld(){const t=document.getElementById('toast');if(!t||!t.classList.contains('on'))return;clearTimeout(toast._t);t.classList.remove('on')}

