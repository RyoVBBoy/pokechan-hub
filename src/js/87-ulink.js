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
/* ホストの形（サーバーが確かめた ASCII のホスト名だけ） */
const ulinkHost=h=>typeof h==='string'&&h.length<=253&&/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(h)&&/(^|\.)(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(h)?h:null;
/* 投稿の中の表示（twHtml から）。一覧には全部のアドレスは来ない（ホストと状態だけ）。押せるのは state:'ok'（サーバーで LINKS_CLICK が開いている）だけ */
function ulinkHTML(n){
  const l=n&&n.ulink;if(!l)return '';
  const h=ulinkHost(l.host);
  if(l.state==='off'&&h)return `<div class="tw-ul tw-ul--off"><b>${L('外部リンク（いまは開けません）','External link (unavailable now)')}</b><small data-notr>${esc(h)}</small></div>`;
  if(l.state!=='ok'||!h)return `<div class="tw-ul tw-ul--off">${L('このリンクは表示を止めています','This link has been disabled')}</div>`;
  return `<button type="button" class="tw-ul" data-ul aria-label="${esc(L('外部リンクを開く（確認画面が出ます）：','Open external link (confirmation first): ')+h)}"><b>${L('外部リンク','External link')}</b><small data-notr>${esc(h)}</small></button>`;
}
const ulinkInert=btn=>{if(btn&&document.body.contains(btn)&&btn.matches('button.tw-ul')){const d=document.createElement('div');d.className='tw-ul tw-ul--off';d.textContent=L('このリンクは表示を止めています','This link has been disabled');btn.replaceWith(d)}};
let ULINK_BUSY=false;
/* 押したとき：①サーバーで確かめる（確認の画面に出すアドレスと、1回だけ・60秒だけの許可） → 確認の画面 → ②「開く」でもう一度サーバーが確かめてから開く */
async function ulinkOpen(id,btn){
  if(ULINK_BUSY)return;ULINK_BUSY=true;if(btn)btn.disabled=true;
  let j;
  try{j=await authFetch(`/api/links/${+id}/open`,{})}
  catch(err){ULINK_BUSY=false;if(btn)btn.disabled=false;toast(err.message);if(err.data&&err.data.inert)ulinkInert(btn);return}
  ULINK_BUSY=false;if(btn)btn.disabled=false;
  const s=j&&j.ok&&ulinkSafe(j.url);
  if(!s||s.host!==j.host||typeof j.intent!=='string'||!/^[0-9a-f]{32}$/.test(j.intent)){toast(L('このリンクは開けません','This link cannot be opened'));return}
  ulinkConfirm(id,s,j.intent,Math.max(5,Math.min(60,+j.ttl||60)),btn);
}
/* 開いたタブを、リファラーを送らずに行き先へ（タブの中の meta で。サイトのページは渡さない） */
function ulinkGo(w,url){
  try{w.opener=null}catch(e){}
  try{const d=w.document;d.open();d.write('<!doctype html><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="refresh" content="0;url='+esc(url)+'"><title>…</title>');d.close();return true}
  catch(e){try{w.location.replace(url);return true}catch(e2){return false}}
}
function ulinkConfirm(id,s,intent,ttl,from){
  const d=document.createElement('div');d.className='xc ulc';
  const bg=document.createElement('div');bg.className='xc-bg';
  const p=document.createElement('div');p.className='xc-p';p.setAttribute('role','dialog');p.setAttribute('aria-modal','true');p.setAttribute('aria-labelledby','ulc-h');
  const h=document.createElement('h3');h.id='ulc-h';h.textContent=L('外部のサイトを開きますか？','Open an external site?');
  const ho=document.createElement('p');ho.className='ulc-host';ho.setAttribute('data-notr','');ho.textContent=s.host;
  const full=document.createElement('p');full.className='ulc-url';full.setAttribute('data-notr','');full.textContent=s.url;
  const w=document.createElement('p');w.className='ulc-w';
  w.textContent=L('このサイトの外のページです。安全確認で問題が見つからなかったことは、安全の保証ではありません。ログイン情報・個人情報・支払いの情報は入力しないでください。',
    'This page is outside this site. Passing our safety check does not guarantee it is safe. Do not enter login, personal or payment details.');
  const st=document.createElement('p');st.className='ulc-st';st.setAttribute('role','status');
  const ok=document.createElement('button');ok.type='button';ok.className='xc-ok xc-plain';ok.textContent=L('開く','Open');
  const no=document.createElement('button');no.type='button';no.className='xc-no';no.textContent=L('キャンセル','Cancel');
  p.append(h,ho,full,w,st,ok,no);d.append(bg,p);document.body.appendChild(d);
  requestAnimationFrame(()=>d.classList.add('on'));
  let closed=false,used=false;
  const exp=setTimeout(()=>{if(used)return;ok.disabled=true;st.textContent=L('確認の期限が切れました。もう一度リンクを押してください。','This confirmation expired. Press the link again.')},Math.max(1,ttl-2)*1000);
  const done=()=>{if(closed)return;closed=true;clearTimeout(exp);d.classList.remove('on');document.removeEventListener('keydown',key,true);setTimeout(()=>d.remove(),150);if(from&&document.body.contains(from))from.focus()};
  const key=e=>{if(e.key==='Escape'){e.preventDefault();done()}
    else if(e.key==='Tab'){const f=[ok,no].filter(x=>!x.disabled),i=f.indexOf(document.activeElement);e.preventDefault();if(f.length)f[(i+(e.shiftKey?-1:1)+f.length)%f.length].focus()}};
  document.addEventListener('keydown',key,true);
  ok.onclick=async()=>{
    if(used||ok.disabled)return;used=true;ok.disabled=true;st.textContent=L('確かめています…','Checking…');
    /* 押した操作の中でタブを先に開く（あとから開くと止められるため）。中身はサーバーが許可するまで空のまま */
    let tab=null;try{tab=window.open('about:blank','_blank')}catch(e){}
    if(tab)try{tab.opener=null}catch(e){}
    let j;
    try{j=await authFetch(`/api/links/${+id}/go`,{intent})}
    catch(err){if(tab)try{tab.close()}catch(e){}toast(err.message);if(err.data&&err.data.inert)ulinkInert(from);done();return}
    const g=j&&j.ok&&ulinkSafe(j.url);
    if(!g||g.url!==s.url){if(tab)try{tab.close()}catch(e){}toast(L('このリンクは開けません','This link cannot be opened'));done();return}
    if(tab&&ulinkGo(tab,g.url)){done();return}
    /* タブを止められたとき：その場で押せるリンクを15秒だけ出す（新しいタブ・opener なし・リファラーなし） */
    const a=document.createElement('a');a.className='xc-ok xc-plain';a.href=g.url;a.target='_blank';a.rel='noopener noreferrer nofollow ugc';a.referrerPolicy='no-referrer';a.textContent=L('このリンクを開く','Open this link');
    st.textContent=L('ブラウザが新しいタブを止めました。下を押して開いてください。','Your browser blocked the new tab. Press below to open it.');
    ok.replaceWith(a);a.focus();a.addEventListener('click',()=>setTimeout(done,0));setTimeout(()=>{if(!closed)done()},15000);
  };
  no.onclick=done;bg.onclick=done;
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
