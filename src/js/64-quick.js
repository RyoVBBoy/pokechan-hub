/* ===================== ⚡ボタンのカスタマイズ（2026/11/10 依頼主「⚡ボタンのカスタマイズ機能」） =====================
   ⚡＝スマホの右下の六角形のボタン（#fab）と、PC の左のメニューのボタン（#pc-post）。
   ・押すと、選んだ機能をすぐ開く：相性を調べる（はじめ・今までと同じ）／新規投稿／パーティ新規作成
   ・ホームとタイムラインの右下のボタンは今までどおり「投稿」に固定（46-ptr.js の fabIsPost・fabPost）。⚡の設定はそれ以外の画面で使う
   ・設定は⚡ボタンと一体の小さな「▾」（⚡のふちに付いた同じ色のつまみ）・右クリック・長押し・キーボードの↑↓から開くメニューで。
     選ぶとすぐ保存して、その機能を実行（この端末の localStorage の pcquick。読めない・おかしな値なら「相性を調べる」）。メニューを開いただけでは変えない
     （2026/11/10 依頼主：⚡の横の独立した ⚙ はナビの見た目から浮くので廃止）
   ・ほかの画面へ移る機能で、投稿欄（#twc-t）に書きかけの文があれば確認を出す（キャンセルなら何も変えない）
   ・新しい画面は作らない：相性＝openSheet（11-matchup.js）、投稿＝ホームの投稿欄を出す fabPost、パーティ＝空いている枠に切りかえて pickMon→addTeam（13-party.js） */
const QA_KEY='pcquick',QA_DEF='type-check';
const QA=[
  {id:'type-check',t:['相性を調べる','Type matchups'],s:['相性','Types']},
  {id:'community-post',t:['新規投稿','New post'],s:['投稿','Post']},
  {id:'party-create',t:['パーティ新規作成','New team'],s:['パーティ','Team']}];
const qaOf=id=>QA.find(x=>x.id===id);
const qaName=id=>{const q=qaOf(id)||qaOf(QA_DEF);return L(q.t[0],q.t[1])};
function qaGet(){let v=null;try{v=localStorage.getItem(QA_KEY)}catch(e){}return qaOf(v)?v:QA_DEF}
function qaSet(id){if(!qaOf(id))id=QA_DEF;try{localStorage.setItem(QA_KEY,id)}catch(e){}qaPaint()}
/* 投稿欄に書きかけの文があるか（投稿の画面に移した投稿欄も同じ textarea） */
const qaDraft=()=>{const t=document.getElementById('twc-t');return !!(t&&t.value.trim())};
const QA_LEAVE=()=>L('この画面を離れると、書きかけの投稿が消えます。移動しますか？','If you leave this screen, your unsent post will be lost. Leave?');
async function qaLeaveOk(){if(!qaDraft())return true;return askConfirm({title:QA_LEAVE(),ok:L('移動する','Leave'),danger:false})}
async function qaRun(){
  qaMenuClose();const id=qaGet();
  if(id==='type-check'){openSheet();return}
  if(id==='community-post'){
    /* ホームとタイムラインなら、その場で投稿の画面（今までと同じ） */
    if(typeof fabIsPost==='function'&&fabIsPost()){fabPost();return}
    if(!(await qaLeaveOk()))return;
    /* ログインしていない・プロフィールがないときは、今までの投稿ボタンと同じくアカウントの画面へ */
    if(!(typeof AUTH!=='undefined'&&AUTH&&AUTH.user)){toast(L('投稿するにはログインしてください','Please log in to post'));nav('#/account');return}
    nav('#/');let n=0;
    const wait=()=>{if(keyOf(cur)!==''){return}
      if(document.querySelector('#view .twc')){fabPost();return}
      /* 読み込みが終わっても投稿欄がない（プロフィールがない等）なら fabPost が案内する */
      if(++n>40||(!document.querySelector('#view .empty')&&document.getElementById('tl-seg'))){fabPost();return}
      setTimeout(wait,100)};
    setTimeout(wait,100);return}
  if(id==='party-create'){
    /* 空いている枠（いま選んでいる枠が空ならそこ）。3枠とも埋まっていれば何も変えずにお知らせだけ */
    const cnt=i=>(i===TEAMS.cur?team:TEAMS.list[i].team).length;
    const free=cnt(TEAMS.cur)===0?TEAMS.cur:TEAMS.list.findIndex((_,i)=>cnt(i)===0);
    if(free<0){toast(L('空いている枠がありません','No empty team slot'));return}
    if(keyOf(cur)!=='team'&&!(await qaLeaveOk()))return;
    if(free!==TEAMS.cur){switchTeam(free);toast(L(`「${teamName(TEAMS.cur)}」に切り替えました`,`Switched to ${teamName(TEAMS.cur)}`))}
    if(keyOf(cur)==='team')teamRender();else nav('#/team');
    setTimeout(async()=>{if(keyOf(cur)!=='team')return;const no=await pickMon(0,{add:true});if(no)addTeam(no)},120);
  }
}
/* ⚡の見た目：名前（PC のボタンの文字・押す前の名前・スマホの六角形の中の短い名前）。⚡の絵・場所・色は変えない */
function qaPaint(){
  const id=qaGet(),n=qaName(id),q=qaOf(id);
  const p=document.getElementById('pc-post');
  if(p){p.title='⚡ '+n;p.setAttribute('aria-label',n);const s=p.querySelector('span');if(s)s.textContent=n}
  document.querySelectorAll('.qa-more').forEach(b=>{b.title=L('⚡ボタンの機能を選ぶ','Choose what ⚡ does');b.setAttribute('aria-label',L(`⚡ボタンの機能を選ぶ（いまは「${n}」）`,`Choose what the ⚡ button does (now: ${n})`))});
  if(typeof fabMode==='function')fabMode();
  const m=document.getElementById('qa-menu');if(m)m.querySelectorAll('[data-qa]').forEach(b=>b.setAttribute('aria-checked',b.dataset.qa===id));
  return q;
}
/* 設定のメニュー：3つの機能。いまの機能に✓。選ぶとすぐ保存して閉じる */
let QA_ANCHOR=null;
function qaMenuClose(){const m=document.getElementById('qa-menu');if(!m)return;m.remove();document.removeEventListener('pointerdown',qaOut,true);document.removeEventListener('keydown',qaKey);if(QA_ANCHOR){QA_ANCHOR.setAttribute('aria-expanded','false');QA_ANCHOR.focus({preventScroll:true})}QA_ANCHOR=null}
const qaOut=e=>{const m=document.getElementById('qa-menu');if(m&&!m.contains(e.target)&&!(QA_ANCHOR&&QA_ANCHOR.contains(e.target)))qaMenuClose()};
const qaKey=e=>{if(e.key==='Escape')qaMenuClose()};
function qaMenuOpen(anchor){
  if(document.getElementById('qa-menu')){qaMenuClose();return}
  const id=qaGet(),m=document.createElement('div');m.id='qa-menu';m.className='qa-menu';m.setAttribute('role','menu');
  m.innerHTML=`<p class="qa-h">${L('⚡ボタンで開く機能','What the ⚡ button opens')}</p>${QA.map(q=>`<button type="button" role="menuitemradio" data-qa="${q.id}" aria-checked="${q.id===id}"><span class="qa-ck" aria-hidden="true">✓</span><span>${L(q.t[0],q.t[1])}</span></button>`).join('')}
    `;
  document.body.appendChild(m);QA_ANCHOR=anchor;anchor.setAttribute('aria-expanded','true');
  /* 置き場所：PC＝⚡ボタンの右横（下をそろえる）、スマホ＝⚡ボタンの上。どちらも画面の内側に収める */
  const btn=anchor.closest('.qa-pc,.fabin')?.querySelector('#pc-post,#fab')||anchor,r=btn.getBoundingClientRect(),pc=matchMedia('(min-width:700px)').matches;
  const w=Math.min(pc?260:280,innerWidth-16),h=m.offsetHeight;
  let left,top;
  if(pc){left=r.right+10;top=r.bottom-h;if(left+w>innerWidth-8){left=r.left;top=r.top-h-8}}
  else{left=r.right-w;top=r.top-h-10}
  left=Math.max(8,Math.min(left,innerWidth-w-8));top=Math.max(8,Math.min(top,innerHeight-h-8));
  Object.assign(m.style,{left:left+'px',top:top+'px',width:w+'px'});
  /* 選ぶ＝保存して、その機能をすぐ実行（書きかけの投稿の確認・空き枠の決まりは qaRun のまま） */
  m.querySelectorAll('[data-qa]').forEach(b=>b.onclick=()=>{qaSet(b.dataset.qa);qaMenuClose();qaRun()});
  /* ↑↓で選択肢を移る */
  m.onkeydown=e=>{if(e.key!=='ArrowDown'&&e.key!=='ArrowUp')return;e.preventDefault();const it=[...m.querySelectorAll('[data-qa]')],i=it.indexOf(document.activeElement);it[(i+(e.key==='ArrowDown'?1:it.length-1))%it.length].focus()};
  setTimeout(()=>{document.addEventListener('pointerdown',qaOut,true);document.addEventListener('keydown',qaKey)},0);
  (m.querySelector('[aria-checked=true]')||m.querySelector('[data-qa]')).focus({preventScroll:true});
}
/* ⚡ボタンと一体のつまみ「▾」（⚡と同じ色で、ふちに重ねる）。押すとメニュー。
   ほかに、⚡の右クリック・長押し（0.5秒）・キーボードの↑↓／メニューキーでも開く（長押しだけが入口にはしない） */
(function qaInit(){
  const mk=cls=>{const b=document.createElement('button');b.type='button';b.className='qa-more '+cls;b.setAttribute('aria-haspopup','menu');b.setAttribute('aria-expanded','false');
    b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
    b.onclick=e=>{e.stopPropagation();qaMenuOpen(b)};return b};
  const fi=document.querySelector('#fabwrap .fabin');if(fi&&!fi.querySelector('.qa-more'))fi.appendChild(mk('qa-more-sp'));
  const p=document.getElementById('pc-post');if(p&&!p.parentNode.classList.contains('qa-pc')){const w=document.createElement('div');w.className='qa-pc';p.parentNode.insertBefore(w,p);w.appendChild(p);w.appendChild(mk('qa-more-pc'))}
  /* 右クリック・長押し・キーボード（ホーム・タイムラインの右下＝投稿のときは何もしない） */
  const extra=(btn,more)=>{if(!btn||!more)return;let t=0,long=false;
    const off=()=>btn.id==='fab'&&typeof fabIsPost==='function'&&fabIsPost();
    btn.addEventListener('contextmenu',e=>{if(off())return;e.preventDefault();qaMenuOpen(more)});
    btn.addEventListener('pointerdown',e=>{if(off()||e.button)return;long=false;clearTimeout(t);t=setTimeout(()=>{long=true;qaMenuOpen(more)},500)});
    ['pointerup','pointerleave','pointercancel'].forEach(ev=>btn.addEventListener(ev,()=>clearTimeout(t)));
    btn.addEventListener('click',e=>{if(long){long=false;e.stopImmediatePropagation();e.preventDefault()}},true);
    btn.addEventListener('keydown',e=>{if(off())return;if(e.key==='ArrowDown'||e.key==='ArrowUp'||e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){e.preventDefault();qaMenuOpen(more)}})};
  extra(p,document.querySelector('.qa-more-pc'));extra(document.getElementById('fab'),document.querySelector('.qa-more-sp'));
  /* 押したとき：選んだ機能（ホーム・タイムラインの右下は今までどおり投稿） */
  const f=document.getElementById('fab');if(f)f.onclick=()=>{if(typeof fabIsPost==='function'&&fabIsPost())fabPost();else qaRun()};
  if(p)p.onclick=()=>qaRun();
  addEventListener('hashchange',qaMenuClose);addEventListener('resize',qaMenuClose);
  qaPaint();
})();
