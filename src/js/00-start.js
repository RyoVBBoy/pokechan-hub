
/* スクロールはページ全体ではなく body の中で行う（iPhone の Safari でアドレスバーが縮んで、下のメニューがずれないように）。
   window.scrollY / scrollTo の代わりに scrY() / scrTo() を使う */
const SCROLLER=document.body;
const scrY=()=>SCROLLER.scrollTop;
const scrTo=(a,b)=>typeof a==='object'?SCROLLER.scrollTo(a):SCROLLER.scrollTo(a||0,b||0);

/* iPhone の Safari は「拡大しない」設定を無視するので、2本指でのズームとダブルタップのズームをここで止める（2026/11/03） */
['gesturestart','gesturechange'].forEach(t=>document.addEventListener(t,e=>e.preventDefault(),{passive:false}));

/* ===== iPhone の「ホーム画面に追加」で開いたときの下の空き（2026/11/19 依頼主のスクリーンショット） =====
   この開き方では、iOS がページの高さを画面より短く渡すことがある（上の時刻の帯ほど＝約60pt。画面の下に黒い帯が残り、
   下のメニュー・投稿がそこで切れる）。iPhone のホーム画面から開いたとき（navigator.standalone＝iPhone だけが持つ）だけ、
   画面の高さとページの高さの差（足りない分）を測り、--vshim に入れる。0〜120px 以外は 0（Android・Safari・iPad の分割画面などは何も変えない）。
   styles.css の html.vshim がページをその分だけ下へのばし、下のメニュー・⚡・通知・全画面の窓を画面の下にそろえる */
function vpShim(){
  try{
    const r=document.documentElement;let s=0;
    if(navigator.standalone===true&&window.screen){
      const port=!window.matchMedia||matchMedia('(orientation: portrait)').matches;
      const sh=port?Math.max(screen.width,screen.height):Math.min(screen.width,screen.height);
      const d=Math.round(sh-window.innerHeight);
      if(d>0&&d<=120)s=d;
    }
    r.style.setProperty('--vshim',s+'px');r.classList.toggle('vshim',s>0);
  }catch(e){}
}
vpShim();
['resize','pageshow','focus'].forEach(t=>window.addEventListener(t,vpShim));
window.addEventListener('orientationchange',()=>setTimeout(vpShim,300));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)vpShim()});
/* のばしたぶん、ページ全体（window）が少し動けるようになるので、いつも一番上に止める（中身のスクロールは body の中のまま） */
window.addEventListener('scroll',()=>{if(window.scrollY&&document.documentElement.classList.contains('vshim'))window.scrollTo(0,0)},{passive:true});
