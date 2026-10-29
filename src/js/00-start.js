
/* スクロールはページ全体ではなく body の中で行う（iPhone の Safari でアドレスバーが縮んで、下のメニューがずれないように）。
   window.scrollY / scrollTo の代わりに scrY() / scrTo() を使う */
const SCROLLER=document.body;
const scrY=()=>SCROLLER.scrollTop;
const scrTo=(a,b)=>typeof a==='object'?SCROLLER.scrollTo(a):SCROLLER.scrollTo(a||0,b||0);
