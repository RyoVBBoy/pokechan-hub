/* ===================== 投稿のリンク（利用者が付けたもの、2026/11/25 docs/secure-link-posting-handoff.md） =====================
   サーバー（worker/src/links.js）が正しさの元。ここは見た目と、押したときの確認だけ。
   ・投稿の中には、リンクを <a href> で置かない。押せるボタン（ホストだけを表示）にして、押すとサーバーで「いまも開いてよいか」を確かめ、
     確認の画面（行き先のホストと全部のアドレス）を出す。そこで利用者が「開く」を押したときだけ別のタブで開く（noopener noreferrer）。
   ・アドレスの文字は textContent で入れる（innerHTML に入れない）。サーバーから届いた値も、ここで形を確かめ直し、だめなら押せない文字にする。
   ・サイトからリンク先を先に読みこむこと（画像・プレビュー・先読み）はしない。
   ・運営の bot のリンク（n.link・twInApp）はこれまでどおり別のもの。 */
let LKCFG={post:false,click:false},LKCFG_AT=0;
/* サーバーの設定（止めているかどうか）を読む。読めなければ「止めている」と同じ */
async function ulinkCfg(){
  if(Date.now()-LKCFG_AT<5*60e3)return LKCFG;
  LKCFG_AT=Date.now();
  try{if(typeof COMM_API==='undefined'||!COMM_API)throw 0;const r=await fetch(COMM_API+'/api/links/config');const j=r.ok?await r.json():{};LKCFG={post:j.post===true,click:j.click===true}}
  catch(e){LKCFG={post:false,click:false}}
  return LKCFG;
}
/* サーバーと同じ考え方のうち、表示のための最小の確かめ（https・ASCII だけ・ユーザー名やポートなし・ホストが入力と同じ） */
function ulinkSafe(u){
  if(typeof u!=='string'||u.length>2048||!/^https:\/\/[\x21-\x7e]+$/.test(u)||/[\\<>"`{}|^]/.test(u))return null;
  try{const x=new URL(u),auth=u.slice(8).split(/[\/?#]/)[0].toLowerCase();
    if(x.protocol!=='https:'||x.username||x.password||x.port||x.hostname!==auth||!x.hostname.includes('.')||/^[0-9.]+$/.test(x.hostname))return null;
    return{url:x.href,host:x.hostname}}catch(e){return null}
}
/* 投稿の中の表示（twHtml から）。押せるのは形の正しいものだけ */
function ulinkHTML(n){
  const l=n&&n.ulink;if(!l)return '';
  const s=l.state==='ok'&&ulinkSafe(l.url);
  if(!s)return `<div class="tw-ul tw-ul--off">${L('このリンクは表示を止めています','This link has been disabled')}</div>`;
  return `<button type="button" class="tw-ul" data-ul aria-label="${esc(L('外部リンクを開く（確認画面が出ます）：','Open external link (confirmation first): ')+s.host)}"><b>${L('外部リンク','External link')}</b><small data-notr>${esc(s.host)}</small></button>`;
}
/* 押したとき：サーバーで確かめる → 確認の画面 → 利用者が「開く」を押したときだけ開く */
async function ulinkOpen(id,btn){
  if(btn)btn.disabled=true;
  let j;
  try{j=await authFetch(`/api/links/${+id}/open`,{})}
  catch(err){toast(err.message);if(btn){btn.disabled=false;if(err.status===410||err.status===403){btn.outerHTML=`<div class="tw-ul tw-ul--off">${esc(L('このリンクは表示を止めています','This link has been disabled'))}</div>`}}return}
  if(btn)btn.disabled=false;
  const s=j&&j.ok&&ulinkSafe(j.url);
  if(!s||s.host!==j.host){toast(L('このリンクは開けません','This link cannot be opened'));return}
  ulinkConfirm(s,btn);
}
function ulinkConfirm(s,from){
  const d=document.createElement('div');d.className='xc ulc';
  const bg=document.createElement('div');bg.className='xc-bg';
  const p=document.createElement('div');p.className='xc-p';p.setAttribute('role','dialog');p.setAttribute('aria-modal','true');p.setAttribute('aria-labelledby','ulc-h');
  const h=document.createElement('h3');h.id='ulc-h';h.textContent=L('外部のサイトを開きますか？','Open an external site?');
  const ho=document.createElement('p');ho.className='ulc-host';ho.setAttribute('data-notr','');ho.textContent=s.host;
  const full=document.createElement('p');full.className='ulc-url';full.setAttribute('data-notr','');full.textContent=s.url;
  const w=document.createElement('p');w.className='ulc-w';
  w.textContent=L('このサイトの外のページです。安全確認で問題が見つからなかったことは、安全の保証ではありません。ログイン情報・個人情報・支払いの情報は入力しないでください。',
    'This page is outside this site. Passing our safety check does not guarantee it is safe. Do not enter login, personal or payment details.');
  const a=document.createElement('a');a.className='xc-ok xc-plain';a.href=s.url;a.target='_blank';a.rel='noopener noreferrer nofollow ugc';a.referrerPolicy='no-referrer';a.textContent=L('開く','Open');
  const no=document.createElement('button');no.type='button';no.className='xc-no';no.textContent=L('キャンセル','Cancel');
  p.append(h,ho,full,w,a,no);d.append(bg,p);document.body.appendChild(d);
  requestAnimationFrame(()=>d.classList.add('on'));
  const done=()=>{d.classList.remove('on');document.removeEventListener('keydown',key,true);setTimeout(()=>d.remove(),150);if(from&&document.body.contains(from))from.focus()};
  const key=e=>{if(e.key==='Escape'){e.preventDefault();done()}
    else if(e.key==='Tab'){const f=[a,no],i=f.indexOf(document.activeElement);e.preventDefault();f[(i+(e.shiftKey?-1:1)+f.length)%f.length].focus()}};
  document.addEventListener('keydown',key,true);
  a.addEventListener('click',()=>setTimeout(done,0));no.onclick=done;bg.onclick=done;
  no.focus();
}
/* 投稿欄のリンク欄（twComposer・返信）。設定が「開いている」ときだけ出す。
   本文に https:// で始まるリンク1つだけを貼ったときは、リンク欄に移して知らせる（貼った文はそのまま、まわりの文は消さない） */
function ulinkField(id){return `<div class="twc-ul" id="${id}-w" hidden><input id="${id}" class="twc-ui" type="url" inputmode="url" maxlength="2048" autocomplete="off" spellcheck="false" placeholder="${esc(L('リンク（https:// で始まるもの・1つだけ）','Link (https:// only, one per post)'))}" aria-label="${esc(L('リンク','Link'))}"><p class="twc-uh">${L('リンクは本文の文字数に数えません。ログインの印や合言葉を含むリンクは付けないでください。メッセージ・掲示板・募集ではこれまでどおりリンクは使えません。','Links do not count toward the text limit. Do not include login tokens or passwords. Links are still not allowed in messages, boards or the lobby.')}</p></div>`}
async function ulinkBind(t,id){
  const w=document.getElementById(id+'-w'),f=document.getElementById(id);if(!w||!f)return ()=>'';
  const c=await ulinkCfg();if(!document.body.contains(w))return ()=>'';
  if(!c.post){w.remove();return ()=>''}
  w.hidden=false;
  t.addEventListener('paste',e=>{
    const v=((e.clipboardData&&e.clipboardData.getData('text/plain'))||'').trim();
    if(f.value.trim()||!/^https:\/\/\S+$/i.test(v))return;
    e.preventDefault();f.value=v;f.focus();toast(L('リンクをリンク欄に移しました','Moved the link to the link field'));t.dispatchEvent(new Event('input'));
  });
  return ()=>f.value.trim();
}
