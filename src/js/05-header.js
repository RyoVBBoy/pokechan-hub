/* ===================== ヘッダー / タブバー ===================== */
I.tool='<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3.6 17.2a1.6 1.6 0 0 0 2.3 2.3l5.7-5.7a4 4 0 0 0 5.2-5.4l-2.5 2.5-2.1-.6-.6-2.1z"/>';
I.chat='<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5z"/>';
/* 下のメニューの中身はゲームごとに違うので、27-games.js の drawNav() で作る */
const V=document.getElementById('view'),HI=document.getElementById('hdr-in'),HD=document.getElementById('hdr');
function setHeader(title,back){
  HI.innerHTML=(back?`<a class="ibtn" href="${back}" data-back aria-label="戻る">${SVG(I.back,22)}</a>`
    :`<button class="mark mbtn" id="brand" aria-label="メニューを開く（いまは${esc(curGame().name)}）">${BRAND.logo?`<img src="${BRAND.logo}" alt="">`:gameMark(curGame(),32)}<i aria-hidden="true">▾</i></button>`)+`<h1>${title}</h1>`;
}
let lastY=0;
addEventListener('scroll',()=>{
  const y=scrollY;HD.classList.toggle('sc',y>4);
  if(sheetOpen)return;
  if(y>lastY+8&&y>140)HD.classList.add('hide');
  else if(y<lastY-8||y<140)HD.classList.remove('hide');
  lastY=y;
},{passive:true});
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('on');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('on'),2200)}

