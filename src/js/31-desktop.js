/* ===================== PC・広い画面 =====================
   広い画面では、下のタブが左のメニューになり、右に「よく使う機能」が出る（見た目は styles.css の最後）。
   左の⚡は設定された機能、右上はサイト内検索。右上の⚡で従来の相性確認を開く。 */
/* 右の列の「すぐ使う」は、スターを付けたツールに合わせて入れかわる */
/* ===== PC（700px以上）の左のメニュー（2026/11/18）：前は左上のアイコンを押すと開いていた左から出るメニューの項目を、ここ（左の列）に並べる。
   ホーム〜メッセージ（#nav）のあとに、プロフィール・お知らせ・フォローリクエスト・ブックマーク・コミュニティ・対戦募集・構築相談・設定・ヘルプセンター、最後に⚡。
   同じ行き先は2回出さない（メッセージ・パーティ・ツール＝マイツールは #nav にある）。スマホは今までどおり左から出るメニュー */
function pcNavDraw(){
  const el=document.getElementById('pc-more');if(!el)return;
  const pr=typeof AUTH!=='undefined'&&AUTH.profile;
  const it=(href,ic,label,o={})=>`<a class="pcm" href="${href}"${o.id?` id="${o.id}"`:''}${o.hidden?' hidden':''} title="${label}">${SVG(ic,24)}<span class="pcm-l">${label}</span>${o.badge!=null?`<i class="pcm-n" id="${o.badge}"${o.n?'':' hidden'}>${o.n?(o.n>9?'9+':o.n):''}</i>`:''}</a>`;
  const nf=typeof notifN!=='undefined'?notifN:0,fq=typeof FREQ_N!=='undefined'?FREQ_N:0;
  el.innerHTML=it(pr?'#/u/'+esc(pr.handle):'#/account',I.user,pr?'プロフィール':'ログイン')
    +it('#/notif',I.bell,'お知らせ',{badge:'pc-nf',n:nf})
    +(pr?it('#/requests',I.user,'フォローリクエスト',{id:'pc-fqrow',hidden:!fq,badge:'pc-fq',n:fq}):'')
    +it('#/bookmarks',I.bookmark,'ブックマーク')
    +it('#/community',I.chat,'コミュニティ')
    +it('#/search/'+encodeURIComponent('#対戦募集'),I.swords||I.chat,'対戦募集')
    +it('#/search/'+encodeURIComponent('#構築相談'),I.chat,'構築相談・質問')
    +`<button class="pcm" type="button" data-pcm="settings" title="設定とプライバシー">${SVG(I.gear,24)}<span class="pcm-l">設定とプライバシー</span></button>`
    +`<details class="pcm-d"><summary class="pcm" title="ヘルプセンター">${SVG(I.help,24)}<span class="pcm-l">ヘルプセンター</span></summary><div class="pcm-sub">
      ${[['#/help','ツールの使い方'],['#/rules','コミュニティの利用ルール'],['#/guide','基本ルール（計算式など）'],['#/sources','データの出典と確認状況'],['#/contact','お問い合わせ']].map(([h,t])=>`<a href="${h}">${t}</a>`).join('')}<a href="#/contact" data-report>この画面の間違いを報告</a></div></details>`;
  pcNavMark();
}
/* いまの画面の項目に印（aria-current） */
function pcNavMark(){const el=document.getElementById('pc-more');if(!el)return;const h=location.hash||'#/';
  let hit=false;
  el.querySelectorAll('a.pcm').forEach(a=>{const on=a.getAttribute('href')===h||(h.startsWith('#/u/')&&a.getAttribute('href')===h.split('/').slice(0,3).join('/'));if(on)hit=true;on?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current')});
  /* PC で続きの項目（プロフィール・お知らせなど）がいまの画面なら、その項目だけを選んでいる印にする（2026/11/18）。
     下のメニューの仲間分け（例：プロフィールはホームのタブ）で主な項目にも印が付き、2つ光っていたため。スマホ（続きの項目を出さない）は今までどおり */
  if(hit&&matchMedia('(min-width:700px)').matches)document.querySelectorAll('.tabbar .tb[aria-current]').forEach(e=>e.removeAttribute('aria-current'))}
/* 画面の幅がスマホ⇔PC に変わったら、主な項目の印を付け直す（route と同じ決め方） */
try{matchMedia('(min-width:700px)').addEventListener('change',()=>{const k=(typeof cur==='string'?cur:location.hash).replace(/^#\/?/,'').split('/')[0];
  document.querySelectorAll('.tb').forEach(e=>{const on=e.dataset.k===navGroup(k);on?e.setAttribute('aria-current','page'):e.removeAttribute('aria-current')});pcNavMark();if(typeof moveTbPill==='function')moveTbPill()})}catch(e){}
document.addEventListener('click',e=>{if(e.target.closest('[data-pcm="settings"]')&&typeof settingsOpen==='function')settingsOpen()});
function drawSide(){
  pcSearchSync();
  if(!document.getElementById('pc-more').innerHTML)pcNavDraw();else pcNavMark();
  const el=document.getElementById('pcs-tools');if(!el||getComputedStyle(el.parentNode).display==='none')return;
  const qt=quickTools(6);
  el.innerHTML=`<h2>すぐ使う</h2>${qt.map(t=>`<a href="${t.href}" class="pcs-t"><span class="ttile-i">${SVG(t.ic,20)}</span><span><b>${esc(t.t)}</b><small>${t.d}</small></span></a>`).join('')}<a href="#/tools" class="pcs-more">ツールをすべて見る</a>`;
}
const pcSearchForm=document.getElementById('pcs-search'),pcSearchInput=document.getElementById('pcs-q');
let pcSearchRoute=null;
function pcSearchSync(){
  if(!pcSearchInput||pcSearchRoute===cur)return;
  pcSearchRoute=cur;
  const [k,a]=cur.replace(/^#\/?/,'').split('/');
  let q='';
  if(k==='search')try{q=decodeURIComponent(a||'')}catch(e){q=a||''}
  pcSearchInput.value=q;
}
if(pcSearchForm&&pcSearchInput){
  let composing=false;
  pcSearchInput.addEventListener('compositionstart',()=>{composing=true});
  pcSearchInput.addEventListener('compositionend',()=>{composing=false});
  pcSearchForm.addEventListener('submit',e=>{
    e.preventDefault();
    if(composing)return;
    const q=pcSearchInput.value.trim();
    pcSearchInput.value=q;pcSearchInput.blur();
    nav(q?'#/search/'+encodeURIComponent(q):'#/search');
  });
}
const pcMatchup=document.getElementById('pcs-matchup');if(pcMatchup)pcMatchup.onclick=()=>openSheet();
const pcPost=document.getElementById('pc-post');if(pcPost)pcPost.onclick=()=>typeof qaRun==='function'?qaRun():openSheet();
