/* ===================== ⚡ボタンのカスタマイズ（2026/11/10 依頼主「⚡ボタンのカスタマイズ機能」） =====================
   ⚡＝スマホの右下の六角形のボタン（#fab）と、PC の左のメニューのボタン（#pc-post）。
   ・押すと、選んだ機能をすぐ開く：相性を調べる（はじめ・今までと同じ）／新規投稿／パーティ新規作成
   ・ホームとタイムラインの右下のボタンは今までどおり「投稿」に固定（46-ptr.js の fabIsPost・fabPost）。⚡の設定はそれ以外の画面で使う
   ・設定は⚡の横の ⚙ から。選ぶとすぐ保存・反映（この端末の localStorage の pcquick。読めない・おかしな値なら「相性を調べる」）
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
  const g=document.querySelectorAll('.qa-gear');g.forEach(b=>{b.title=L('⚡ボタンの機能を変える','Change the ⚡ button');b.setAttribute('aria-label',L(`⚡ボタンの機能を変える（いまは「${n}」）`,`Change the ⚡ button (now: ${n})`))});
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
    <p class="qa-n">${L('ホームとタイムラインの右下のボタンは、いつも「投稿」です。','On Home and the timeline, the bottom-right button always posts.')}</p>`;
  document.body.appendChild(m);QA_ANCHOR=anchor;anchor.setAttribute('aria-expanded','true');
  /* 置き場所：ボタンの上（入らなければ下）、左右は画面の内側に収める */
  const r=anchor.getBoundingClientRect(),w=Math.min(280,innerWidth-16),h=m.offsetHeight;
  let left=matchMedia('(min-width:700px)').matches?r.left:r.right-w;left=Math.max(8,Math.min(left,innerWidth-w-8));
  let top=r.top-h-8;if(top<8)top=Math.min(r.bottom+8,innerHeight-h-8);
  Object.assign(m.style,{left:left+'px',top:Math.max(8,top)+'px',width:w+'px'});
  m.querySelectorAll('[data-qa]').forEach(b=>b.onclick=()=>{qaSet(b.dataset.qa);toast(L(`⚡ボタン：${qaName(b.dataset.qa)}`,`⚡ button: ${qaName(b.dataset.qa)}`));qaMenuClose()});
  setTimeout(()=>{document.addEventListener('pointerdown',qaOut,true);document.addEventListener('keydown',qaKey)},0);
  (m.querySelector('[aria-checked=true]')||m.querySelector('[data-qa]')).focus({preventScroll:true});
}
/* ⚙ のボタンを置く（スマホ＝六角形の右上、PC＝左のメニューのボタンのとなり）。押す・Enter で開く */
(function qaInit(){
  const mk=cls=>{const b=document.createElement('button');b.type='button';b.className='qa-gear '+cls;b.setAttribute('aria-haspopup','menu');b.setAttribute('aria-expanded','false');
    b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
    b.onclick=e=>{e.stopPropagation();qaMenuOpen(b)};return b};
  const fi=document.querySelector('#fabwrap .fabin');if(fi&&!fi.querySelector('.qa-gear'))fi.appendChild(mk('qa-gear-sp'));
  const p=document.getElementById('pc-post');if(p&&!p.parentNode.classList.contains('qa-pc')){const w=document.createElement('div');w.className='qa-pc';p.parentNode.insertBefore(w,p);w.appendChild(p);w.appendChild(mk('qa-gear-pc'))}
  /* 押したとき：選んだ機能（ホーム・タイムラインの右下は今までどおり投稿） */
  const f=document.getElementById('fab');if(f)f.onclick=()=>{if(typeof fabIsPost==='function'&&fabIsPost())fabPost();else qaRun()};
  if(p)p.onclick=()=>qaRun();
  addEventListener('hashchange',qaMenuClose);addEventListener('resize',qaMenuClose);
  qaPaint();
})();
