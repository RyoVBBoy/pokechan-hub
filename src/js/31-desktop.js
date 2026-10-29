/* ===================== PC・広い画面 =====================
   広い画面では、下のタブが左のメニューになり、右に「よく使う機能」が出る（見た目は styles.css の最後）。
   左の「相性を調べる」と右の検索ボタンは、スマホの右下の丸いボタンと同じ画面を開く。 */
/* 右の列の「すぐ使う」は、マイツール（☆）・最近使ったツールに合わせて入れかわる */
function drawSide(){
  const el=document.getElementById('pcs-tools');if(!el||getComputedStyle(el.parentNode).display==='none')return;
  const qt=quickTools(6);
  el.innerHTML=`<h2>すぐ使う</h2>${qt.map(t=>`<a href="${t.href}" class="pcs-t"><span class="ttile-i">${SVG(t.ic,20)}</span><span><b>${esc(t.t)}</b><small>${t.d}</small></span></a>`).join('')}<a href="#/tools" class="pcs-more">ツールをすべて見る</a>`;
}
['pc-post','pcs-search'].forEach(id=>{const e=document.getElementById(id);if(e)e.onclick=()=>openSheet()});
