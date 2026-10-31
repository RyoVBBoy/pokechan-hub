/* ===================== ルーター ===================== */
let cur='';try{cur=location.hash}catch(e){}
function setUrl(h,push){try{history[push?'pushState':'replaceState'](null,'',h)}catch(e){}}
let ROOTS=['','dex','tools','team','community'];  /* 27-games.js の drawNav() がゲームに合わせて入れ直す */
const keyOf=h=>(h||'').replace(/^#\/?/,'').split('/')[0];
const scrollMem={};let depth=0;
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
function nav(h,dir){
  if(h===cur){route();return}
  scrollMem[cur]=scrY();
  const fromK=keyOf(cur),toK=keyOf(h);
  if(!dir)dir=ROOTS.includes(toK)&&ROOTS.includes(fromK)?'tab':'fwd';
  cur=h;setUrl(h,true);depth++;
  transit(dir,dir==='tab'?(scrollMem[h]||0):0);
}
function transit(dir,y){
  const run=()=>{route();scrTo(0,y||0);HD.classList.remove('hide');lastY=y||0};
  if(reduceMotion){run();return}
  if(document.startViewTransition){
    document.documentElement.dataset.dir=dir;
    try{const t=document.startViewTransition(run);t.ready.catch(()=>{});t.finished.catch(()=>{}).finally(()=>{delete document.documentElement.dataset.dir})}catch(e){run()}
  }else{
    run();V.classList.remove('vt-fallback','fwd','back');void V.offsetWidth;V.classList.add('vt-fallback');if(dir==='fwd'||dir==='back')V.classList.add(dir);
  }
}
document.addEventListener('click',e=>{
  const a=e.target.closest&&e.target.closest('a[href^="#/"]');
  if(!a||e.defaultPrevented||e.metaKey||e.ctrlKey)return;
  e.preventDefault();
  const h=a.getAttribute('href');
  if(a.hasAttribute('data-back')){if(depth>0){history.back()}else{nav(h,'back')}return}
  /* 下（PCは左）のタブ：ほかのタブから来たら、そのタブで最後に開いていた画面へ。
     いるタブをもう一度押したら、そのタブの最初の画面へ（最初の画面にいるなら上までスクロール） */
  if(a.classList.contains('tb')){
    const g=a.dataset.k;
    if(navGroup(keyOf(cur))===g){if(h===cur)scrTo({top:0,behavior:reduceMotion?'auto':'smooth'});else nav(h,'tab');return}
    const mem=TABMEM[g];nav(mem&&mem!==cur?mem:h,'tab');return;
  }
  nav(h);
});
const NAVG={learn:'tools',arch:'tools',season:'tools',replay:'tools',item:'tools',word:'tools',move:'tools',ability:'tools',p:'search',dex:'search',cmp:'search',types:'tools',assist:'tools',calc:'tools',meta:'tools',battle:'tools',guide:'tools',sources:'tools',verify:'tools',
  games:'-',team:'team',edit:'team',import:'team',report:'team',community:'community',lobby:'community',bbs:'community',thread:'community',rules:'community',admin:'community',account:'community',tl:'community',u:'community',n:'community',notif:'community',terms:'community',privacy:'community'};
const navGroup=k=>NAVG[k]??(k||'');
/* タブごとに最後に開いていた画面（このタブを閉じるまで覚える） */
const TABMEM=(()=>{try{return JSON.parse(sessionStorage.getItem('pctabmem')||'{}')||{}}catch(e){return{}}})();
function rememberTab(){const g=navGroup(keyOf(cur));if(!ROOTS.includes(g))return;TABMEM[g]=cur||'#/';try{sessionStorage.setItem('pctabmem',JSON.stringify(TABMEM))}catch(e){}}
function route(){
  const [k,a]=cur.replace(/^#\/?/,'').split('/');
  document.querySelectorAll('.tb').forEach(e=>{
    const on=e.dataset.k===navGroup(k);
    on?e.setAttribute('aria-current','page'):e.removeAttribute('aria-current')});
  closeSheet();
  document.getElementById('fabwrap').hidden=!curGame().fab||(k==='types'||k==='battle');
  trackTool(cur);drawSide();rememberTab();if(typeof hitSend==='function')hitSend(k);
  ({'':home,dex,p:detail,types:typesView,cmp:cmpView,team:teamView,guide,battle:battleView,assist:assistView,sources:sourcesView,verify:verifyView,import:importView,edit:editView,calc:calcView,meta:metaView,report:reportView,lobby:lobbyView,bbs:bbsView,thread:threadView,rules:rulesView,admin:adminView,tools:toolsView,community:communityView,games:gamesView,account:accountView,search:searchView,learn:learnView,arch:archView,season:seasonView,replay:replayView,item:itemView,word:wordView,move:moveView,ability:abilityView,tl:tlView,u:userView,n:noteView,notif:notifView,terms:termsView,privacy:privacyView})[k||'']?.(a);
  HD.classList.toggle('sc',scrY()>4);
}
function onPop(){
  const h=location.hash;if(h===cur)return;
  scrollMem[cur]=scrY();cur=h;depth=Math.max(0,depth-1);
  transit('back',scrollMem[h]||0);
}
addEventListener('popstate',onPop);
addEventListener('hashchange',onPop);

