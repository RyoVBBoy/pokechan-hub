/* ===================== ⚡ボタンのカスタマイズ（2026/11/10 依頼主「⚡ボタンのカスタマイズ機能」） =====================
   ⚡＝スマホの右下の六角形のボタン（#fab）と、PC の左のメニューのボタン（#pc-post）。
   ・押すと、選んだ機能をすぐ開く：相性を調べる（はじめ・今までと同じ）／新規投稿／パーティ新規作成
   ・ホームとタイムラインの右下のボタンは今までどおり「投稿」に固定（46-ptr.js の fabIsPost・fabPost）。⚡の設定はそれ以外の画面で使う
   ・どの機能にするかは、左から出るメニューの「設定とプライバシー」の「お気に入りショートカット」で選ぶ（34-drawer.js が qaSettingsHTML を置く）。
     選んだ時点で保存（この端末の localStorage の pcquick。読めない・おかしな値なら「相性を調べる」）。選んでも実行はしない
     （2026/11/10 依頼主：⚡ボタン自体には設定の操作〔歯車・▾・メニュー・長押し〕を付けない。⚡は実行するだけ）
   ・ほかの画面へ移る機能で、投稿欄（#twc-t）に書きかけの文があれば確認を出す（キャンセルなら何も変えない）
   ・新しい画面は作らない：相性＝openSheet（11-matchup.js）、投稿＝ホームの投稿欄を出す fabPost、パーティ＝空いている枠に切りかえて pickMon→addTeam（13-party.js） */
const QA_KEY='pcquick',QA_DEF='type-check';
const QA=[
  {id:'type-check',t:['相性を調べる','Type matchups'],s:['相性','Types'],ic:'zap',d:['効く技と、出すべきポケモンを調べる','Best moves and who to send in']},
  {id:'community-post',t:['新規投稿','New post'],s:['投稿','Post'],ic:'pen',d:['コミュニティに投稿する','Post to the community']},
  {id:'party-create',t:['パーティ新規作成','New team'],s:['パーティ','Team'],ic:'plus',d:['空いている枠で新しい構築を作る','Start a new team in an empty slot']}];
const qaOf=id=>QA.find(x=>x.id===id);
const qaName=id=>{const q=qaOf(id)||qaOf(QA_DEF);return L(q.t[0],q.t[1])};
function qaGet(){let v=null;try{v=localStorage.getItem(QA_KEY)}catch(e){}return qaOf(v)?v:QA_DEF}
function qaSet(id){if(!qaOf(id))id=QA_DEF;try{localStorage.setItem(QA_KEY,id)}catch(e){}qaPaint()}
/* 投稿欄に書きかけの文があるか（投稿の画面に移した投稿欄も同じ textarea） */
const qaDraft=()=>{const t=document.getElementById('twc-t');return !!(t&&t.value.trim())};
const QA_LEAVE=()=>L('この画面を離れると、書きかけの投稿が消えます。移動しますか？','If you leave this screen, your unsent post will be lost. Leave?');
async function qaLeaveOk(){if(!qaDraft())return true;return askConfirm({title:QA_LEAVE(),ok:L('移動する','Leave'),danger:false})}
/* その機能が今の画面を離れるか（書きかけの投稿の確認が要るか） */
function qaLeaves(id){
  if(id==='community-post')return !(typeof fabIsPost==='function'&&fabIsPost());
  if(id==='party-create'){if(keyOf(cur)==='team')return false;const cnt=i=>(i===TEAMS.cur?team:TEAMS.list[i].team).length;return TEAMS.list.some((_,i)=>cnt(i)===0)}
  return false}
async function qaRun(id,o={}){
  id=qaOf(id)?id:qaGet();
  /* 書きかけの投稿があれば、先に確認（キャンセルなら何もしない） */
  if(!o.ok&&qaLeaves(id)&&!(await qaLeaveOk()))return;
  if(id==='type-check'){openSheet();return}
  if(id==='community-post'){
    /* ホームとタイムラインなら、その場で投稿の画面（今までと同じ） */
    if(typeof fabIsPost==='function'&&fabIsPost()){fabPost();return}
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
  if(typeof fabMode==='function')fabMode();
  return q;
}
/* 設定画面（左から出るメニューの「設定とプライバシー」）の「お気に入りショートカット」。ラジオボタンで選ぶと保存（実行はしない）。
   2026/11/10 依頼主：縦に長いのでカプセル型の札（絵＋名前）を並べる。短い説明は札の title に */
function qaSettingsHTML(){const id=qaGet();
  return `<div class="dr-lab">${SVG(I.zap,18)}${L('お気に入りショートカット','Favorite shortcut')}</div>
    <p class="qa-sd">${L('サイドナビの⚡ボタンを押したときに実行する機能を選択できます。','Choose what the ⚡ button in the side navigation does.')}</p>
    <div class="qa-set" role="radiogroup" aria-label="${L('お気に入りショートカット','Favorite shortcut')}">${QA.map(q=>`<label class="qa-opt" title="${L(q.d[0],q.d[1])}"><input type="radio" name="qa-set" value="${q.id}"${q.id===id?' checked':''}><span class="qa-ic" aria-hidden="true">${SVG(I[q.ic]||I.zap,16)}</span><span class="qa-tx"><b>${L(q.t[0],q.t[1])}</b></span></label>`).join('')}</div>`}
/* 選んだら保存。⚡の名前（PC の文字・スマホの六角形の中）もすぐ変わる */
document.addEventListener('change',e=>{const r=e.target;if(r&&r.name==='qa-set'&&r.checked)qaSet(r.value)});
/* ⚡を押したとき：設定した機能を実行（ホーム・タイムラインの右下は今までどおり投稿） */
(function qaInit(){
  const f=document.getElementById('fab');if(f)f.onclick=()=>{if(typeof fabIsPost==='function'&&fabIsPost())fabPost();else qaRun()};
  const p=document.getElementById('pc-post');if(p)p.onclick=()=>qaRun();
  qaPaint();
})();
