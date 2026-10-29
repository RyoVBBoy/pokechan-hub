/* ===================== PC・広い画面 =====================
   広い画面では、下のタブが左のメニューになり、右に「よく使う機能」が出る（見た目は styles.css の最後）。
   左の「相性を調べる」と右の検索ボタンは、スマホの右下の丸いボタンと同じ画面を開く。 */
['pc-post','pcs-search'].forEach(id=>{const e=document.getElementById(id);if(e)e.onclick=()=>openSheet()});
