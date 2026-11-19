
/* スクロールはページ全体ではなく body の中で行う（iPhone の Safari でアドレスバーが縮んで、下のメニューがずれないように）。
   window.scrollY / scrollTo の代わりに scrY() / scrTo() を使う */
const SCROLLER=document.body;
const scrY=()=>SCROLLER.scrollTop;
const scrTo=(a,b)=>typeof a==='object'?SCROLLER.scrollTo(a):SCROLLER.scrollTo(a||0,b||0);

/* iPhone の Safari は「拡大しない」設定を無視するので、2本指でのズームとダブルタップのズームをここで止める（2026/11/03） */
['gesturestart','gesturechange'].forEach(t=>document.addEventListener(t,e=>e.preventDefault(),{passive:false}));
