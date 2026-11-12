/* ===================== お気に入りのポケモン（2026/11/12 依頼主） =====================
   ・ポケモンを選ぶ画面（pickMon）・図鑑の一覧（#/dex）・図鑑のページ（#/p/番号）の ☆ で同じ1つの状態を使う。
   ・1匹ずつ、ポケモンの番号（byNo の鍵。姿・地方の姿・メガシンカの姿はそれぞれ別の番号）で覚える。名前や図鑑番号では見分けない。
   ・保存：端末（localStorage pcfavs）。ログイン中はサーバー（/api/me/favs、user_data.favs）とも合わせる＝戦術メモと同じやり方
     （1匹ずつ {on:1|0, at}。外したものも on:0 で残し、ほかの端末で外したことも伝わる。at の新しいほうを残す）。teamSync のたびに読む。
   ・☆ の部品 favBtn(no) はどこに置いても、押すと data-fav が同じ番号の ☆ をすべてその場で付けかえる（画面ごとに別の状態を持たない）。
   ・変わったときは document に 'pcfav' の知らせを出す（ポケモンを選ぶ画面のお気に入りの一覧が描き直す）。 */
I.clock='<circle cx="12" cy="12" r="8.2"/><path d="M12 7.6V12l3 1.9"/>';
const FAV=(()=>{const o=lsJ('pcfavs',{});return o&&typeof o==='object'&&!Array.isArray(o)?o:{}})();
let FAV_T=null;
const favOn=no=>!!(FAV[no]&&FAV[no].on&&byNo[no]);
/* 登録した順（新しい順）。消えた番号（データの入れかえ等）は出さない */
const favList=()=>Object.entries(FAV).filter(([no,e])=>e&&e.on&&byNo[no]).sort((a,b)=>(b[1].at||0)-(a[1].at||0)).map(([no])=>+no);
function favSave(){try{localStorage.setItem('pcfavs',JSON.stringify(FAV))}catch(e){}}
function favSet(no,on){
  no=+no;if(!byNo[no])return;
  if(favOn(no)===!!on)return;
  FAV[no]={on:on?1:0,at:Date.now()};favSave();favPaint(no);favSyncSoon();
  try{document.dispatchEvent(new CustomEvent('pcfav',{detail:{no,on:!!on}}))}catch(e){}
}
/* ☆ の部品。tag は置く場所に合わせる（リンク・ボタンの中では span＋role=button） */
function favBtn(no,opt={}){
  const p=byNo[no];if(!p)return'';const on=favOn(no),nmx=esc(p.n);
  const lab=on?`${nmx}をお気に入りから外す`:`${nmx}をお気に入りに登録`;
  return `<span class="fav-b${on?' on':''}${opt.cls?' '+opt.cls:''}" role="button" tabindex="0" data-fav="${no}" aria-pressed="${on}" aria-label="${lab}" title="${on?'お気に入りから外す':'お気に入りに登録'}">${favIc(on,opt.size||22)}</span>`;
}
const favIc=(on,s)=>SVG(I.star,s).replace('fill="none"',on?'fill="currentColor"':'fill="none"');
function favPaint(no){
  const on=favOn(no),p=byNo[no];
  document.querySelectorAll(`[data-fav="${no}"]`).forEach(b=>{
    b.classList.toggle('on',on);b.setAttribute('aria-pressed',on);
    if(p){b.setAttribute('aria-label',on?`${p.n}をお気に入りから外す`:`${p.n}をお気に入りに登録`);b.title=on?'お気に入りから外す':'お気に入りに登録'}
    const sz=+(b.querySelector('svg')||{getAttribute:()=>22}).getAttribute('width')||22;b.innerHTML=favIc(on,sz)});
}
function favToggle(b){
  const no=+b.dataset.fav,on=!favOn(no);favSet(no,on);
  if(typeof haptic==='function')haptic();
  if(!reduceMotion)try{b.animate([{transform:'scale(.75)'},{transform:'scale(1.18)'},{transform:'scale(1)'}],{duration:260,easing:'cubic-bezier(.2,.8,.2,1)'})}catch(e){}
  toast(on?'お気に入りに登録しました':'お気に入りから外しました');
}
/* ☆ はリンク（図鑑の一覧の行）やボタン（選ぶ画面の行）の中にもあるので、先に受けて行のほうの動き（移動・選ぶ）を止める */
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-fav]');if(!b)return;
  e.preventDefault();e.stopPropagation();favToggle(b)},true);
document.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const b=e.target.closest&&e.target.closest('[data-fav]');if(!b)return;
  e.preventDefault();e.stopPropagation();favToggle(b)},true);
/* ---- ログイン中はサーバーと合わせる（戦術メモの memoPull/memoPush と同じ形） ---- */
function favSyncSoon(){if(typeof AUTH==='undefined'||!AUTH.user)return;clearTimeout(FAV_T);FAV_T=setTimeout(favPush,1200)}
async function favPush(){try{await authFetch('/api/me/favs',{favs:FAV})}catch(e){}}
async function favPull(){
  if(typeof AUTH==='undefined'||!AUTH.user)return;
  let j;try{j=await authFetch('/api/me/favs')}catch(e){return}
  const s=j&&j.favs;if(!s){if(Object.keys(FAV).length)favPush();return}
  const ch=[];
  Object.entries(s).forEach(([no,e])=>{const l=FAV[no];if(e&&(!l||(e.at||0)>(l.at||0))){FAV[no]={on:e.on?1:0,at:e.at||0};ch.push(+no)}});
  if(ch.length){favSave();ch.forEach(favPaint);try{document.dispatchEvent(new CustomEvent('pcfav',{detail:{pull:true}}))}catch(e){}}
  if(Object.entries(FAV).some(([no,e])=>!s[no]||(e.at||0)>(s[no].at||0)))favPush();
}
/* ---- 履歴：図鑑のページを開いたポケモンも「最近」に入れる（ポケモンを選ぶ画面の pcmonrecent と同じ並び。メガは元の姿で） ---- */
const MON_RECENT_N=20;
function monRecentAdd(no){const p=byNo[no];if(!p)return;const v=p.base||p.no;if(!byNo[v])return;
  try{lsW('pcmonrecent',[v,...monRecent().filter(x=>x!==v)].slice(0,MON_RECENT_N))}catch(e){}}
