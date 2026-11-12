/* ===================== タイムライン（投稿・フォロー・いいね・お知らせ） =====================
   #/tl（みんなの投稿）・#/tl/following（フォロー中）・#/u/ユーザーID（プロフィール）・#/n/投稿番号・#/notif（お知らせ）
   見るのはログインなしでもできる。投稿・いいね・フォローはログインしてプロフィールを作った人だけ。
   サーバー側は worker/src/social.js。 */
I.heart='<path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/>';
I.more='<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>';
I.bell='<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0"/>';
I.reply='<path d="M4.5 11.2c0-3.6 3.3-6.4 7.5-6.4s7.5 2.8 7.5 6.4-3.3 6.4-7.5 6.4c-.9 0-1.8-.1-2.6-.4L5 19.5l.9-3.6c-.9-1.3-1.4-2.9-1.4-4.7z"/>';
I.repost='<path d="M7 7h10.5l-2.5-2.5M17 17H6.5L9 19.5M17.5 7v6M6.5 17v-6"/>';
I.user='<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c.8-3.6 3.9-5.6 7.5-5.6s6.7 2 7.5 5.6"/>';
const TW_MAX=140;
const muted=()=>new Set(lsJ('pcmute',[]));
/* ログイン状態をそろえる（Firebase が未設定なら「ログインなし」として扱う） */
async function twAuth(){
  if(!PCF)return null;
  try{await fbLoad();await AUTH.wait;if(!AUTH.user)return null;await loadProfile();try{localStorage.setItem('pcin','1')}catch(e){}return AUTH.profile||null}
  catch(e){return null}
}
/* アイコンの中身：写真（u.av＝画像の鍵）があれば写真、なければ名前の1文字（2026/11/03） */
const avIn=u=>u&&u.av&&/^[0-9a-f]{32}$/.test(u.av)?`<img src="${COMM_API}/m/${u.av}" alt="" loading="lazy" decoding="async">`:esc(((u&&u.name)||'?').slice(0,1));
/* 写真のない人のアイコンの色（2026/11/05 新しい見た目）：名前ごとに決まった落ち着いた色。人は丸、ポケモンは六角形 */
const AV_COLS=['#E39B5A','#6FA8D6','#9C8FE6','#4FB892','#E07F97','#C49A4E','#7F93B5','#D27FD0'];
const avCol=h=>{let n=0;for(const c of String(h||''))n=(n*31+c.charCodeAt(0))>>>0;return AV_COLS[n%AV_COLS.length]};
const twAv=(u,s)=>`<a class="tw-av${s?' tw-av--'+s:''}" style="background:${avCol(u&&u.handle)}" href="#/u/${esc(u.handle)}" aria-label="${esc(u.name)}のプロフィール">${avIn(u)}</a>`;
/* プロフィールの写真：真ん中を正方形に切り取って 400px に縮める */
async function avShrink(file){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('画像を読み込めませんでした（対応していない形式かもしれません）。'));i.src=url});
    const s=Math.min(img.naturalWidth,img.naturalHeight),S=Math.min(400,s);
    const c=document.createElement('canvas');c.width=c.height=S;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,S,S);
    g.drawImage(img,(img.naturalWidth-s)/2,(img.naturalHeight-s)/2,s,s,0,0,S,S);
    let blob=await new Promise(r=>c.toBlob(r,'image/webp',.85));if(!blob||blob.type!=='image/webp')blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.85));
    if(!blob)throw new Error('画像を縮められませんでした。');
    return{blob,w:S,h:S};
  }finally{URL.revokeObjectURL(url)}
}
/* 本文の #タグ を青い文字にして、押すとそのタグの検索へ（先に文字を区切ってから安全な形にする） */
const TAG_RE=/[#＃]([\p{L}\p{N}_ー]{1,30})/gu;
function linkTags(t){let out='',i=0;for(const m of String(t).matchAll(TAG_RE)){out+=esc(t.slice(i,m.index))+`<a class="htag" href="#/search/${encodeURIComponent('#'+m[1])}">${esc(m[0])}</a>`;i=m.index+m[0].length}return out+esc(t.slice(i))}
/* ---- 画像（サーバーは worker/src/media.js） ---- */
const mediaUrl=k=>COMM_API+'/m/'+k;
function twMediaHTML(n){
  if(n.media_hidden)return `<div class="tw-mh">画像は確認中です（通報があったため、運営者が確認するまで表示しません）</div>`;
  const m=n.media||[];if(!m.length)return'';
  const ar=m.length===1?Math.max(.6,Math.min(1.9,(m[0].w||4)/(m[0].h||3))):0;
  /* 2枚以上も、スマホ・パソコンとも投稿の中に並べて表示し、押すと大きく見る画面を開く（2026/11/12 依頼主：1枚ずつスワイプする形をやめる） */
  return `<div class="tw-md tw-md--${m.length}" data-mk="${m.map(x=>x.k).join(',')}"${ar?` style="aspect-ratio:${ar.toFixed(3)}"`:''}>${m.map((x,i)=>`<button class="tw-mi" data-mi="${i}" aria-label="画像${i+1}を大きく見る"><img src="${mediaUrl(x.k)}" alt="" loading="lazy" decoding="async"></button>`).join('')}</div>`;
}
/* 画像を画面いっぱいに見る：左右にスワイプ（スマホ）・矢印・キーで切りかえ、背景か ✕ で閉じる。
   画像は横に並べて、指の動きにそのまま付いてくるスクロール（scroll-snap）で切りかえる＝なめらか。
   2026/11/12 依頼主：上か下にスワイプしても閉じる（X と同じ）。指に付いて画像が動き、後ろがだんだん透け、
   少し（画面の高さの13%か速く動かす）で閉じ、足りなければ元の位置に戻る */
function twViewer(keys,i){
  const o=document.createElement('div');o.className='tw-view';o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');
  o.innerHTML=`<div class="tw-vt">${keys.map(k=>`<div class="tw-vs"><img alt="" src="${mediaUrl(k)}" decoding="async"></div>`).join('')}</div><button class="tw-vx" aria-label="閉じる">${SVG(I.x,22)}</button>${keys.length>1?`<button class="tw-vp" aria-label="前の画像">‹</button><button class="tw-vn" aria-label="次の画像">›</button><span class="tw-vc"></span>`:''}`;
  const tr=o.querySelector('.tw-vt'),cnt=o.querySelector('.tw-vc');
  const cur_=()=>Math.round(tr.scrollLeft/(tr.clientWidth||1));
  const show=()=>{if(cnt)cnt.textContent=`${cur_()+1} / ${keys.length}`};
  const close=()=>{removeEventListener('keydown',key);document.body.classList.remove('tw-vopen');o.remove()};
  const go=k=>{k=Math.max(0,Math.min(keys.length-1,k));tr.scrollTo({left:k*tr.clientWidth,behavior:reduceMotion?'auto':'smooth'})};
  const key=e=>{if(e.key==='Escape')close();else if(e.key==='ArrowRight')go(cur_()+1);else if(e.key==='ArrowLeft')go(cur_()-1)};
  o.onclick=e=>{if(o._drag)return;if(e.target.closest('.tw-vx'))close();else if(e.target.closest('.tw-vp'))go(cur_()-1);else if(e.target.closest('.tw-vn'))go(cur_()+1);else if(!e.target.closest('img'))close()};
  tr.addEventListener('scroll',()=>requestAnimationFrame(show),{passive:true});
  /* 上下にスワイプして閉じる */
  let t0=null;
  const slide=()=>tr.children[cur_()];
  const setY=(dy,anim)=>{const s=slide();if(!s)return;const k=Math.min(1,Math.abs(dy)/(innerHeight*.5));
    s.style.transition=anim?`transform ${anim}ms cubic-bezier(.2,.8,.2,1)`:"none";o.style.transition=anim?`background ${anim}ms`:"none";
    s.style.transform=dy?`translateY(${dy}px) scale(${1-k*.08})`:'';
    o.style.setProperty('--tw-vk',String(1-k*.85));o.classList.toggle('tw-vdrag',!!dy)};
  tr.addEventListener('touchstart',e=>{if(e.touches.length!==1){t0=null;return}const p=e.touches[0];t0={x:p.clientX,y:p.clientY,t:performance.now(),mode:null,dy:0}},{passive:true});
  tr.addEventListener('touchmove',e=>{if(!t0||e.touches.length!==1)return;const p=e.touches[0],dx=p.clientX-t0.x,dy=p.clientY-t0.y;
    if(!t0.mode){if(Math.abs(dx)<8&&Math.abs(dy)<8)return;t0.mode=Math.abs(dy)>Math.abs(dx)*1.2?'y':'x';if(t0.mode==='y')tr.style.overflowX='hidden'}
    if(t0.mode!=='y')return;e.preventDefault();t0.dy=dy;t0.v=dy/Math.max(1,performance.now()-t0.t);setY(dy)},{passive:false});
  const end=()=>{if(!t0)return;const st=t0;t0=null;if(st.mode!=='y')return;tr.style.overflowX='';
    o._drag=true;setTimeout(()=>{o._drag=false},350);
    if(Math.abs(st.dy)>innerHeight*.13||Math.abs(st.v||0)>.6){const d=reduceMotion?0:200;setY(Math.sign(st.dy)*innerHeight,d);o.style.setProperty('--tw-vk','0');setTimeout(close,d)}
    else setY(0,reduceMotion?0:220)};
  tr.addEventListener('touchend',end);tr.addEventListener('touchcancel',end);
  addEventListener('keydown',key);document.body.appendChild(o);document.body.classList.add('tw-vopen');
  tr.scrollLeft=i*tr.clientWidth;show();
}
/* 画像を縮める：長い辺1600px・WebP（使えなければ JPEG）。描き直すので、撮影場所などの情報（EXIF）は残らない */
async function twShrink(file,maxSide=1600){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('画像を読み込めませんでした（対応していない形式かもしれません）。'));i.src=url});
    const sc=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.max(1,Math.round(img.naturalWidth*sc)),h=Math.max(1,Math.round(img.naturalHeight*sc));
    const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,w,h);g.drawImage(img,0,0,w,h);
    let q=.82,blob=null;
    for(let k=0;k<5;k++){blob=await new Promise(r=>c.toBlob(r,'image/webp',q));if(!blob||blob.type!=='image/webp')blob=await new Promise(r=>c.toBlob(r,'image/jpeg',q));if(blob&&blob.size<9e5)break;q-=.12}
    if(!blob)throw new Error('画像を縮められませんでした。');
    return{blob,w,h};
  }finally{URL.revokeObjectURL(url)}
}
async function twUpload(x){
  const h={'Content-Type':x.blob.type,Authorization:'Bearer '+await AUTH.user.getIdToken()};
  let r;try{r=await fetch(`${COMM_API}/api/media?w=${x.w}&h=${x.h}`,{method:'POST',headers:h,body:x.blob})}catch(e){throw new Error('画像を送れませんでした。電波のよいところでもう一度試してください。')}
  const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'画像を送れませんでした。');return j.key;
}
/* 自分のサイトの静的ページ（ランキング）へのリンクは、サイトの中の画面を同じタブで開く（2026/11/10 依頼主：開いたあと戻れない） */
const TW_INAPP={'/ranking/':'#/tier'};
function twInApp(u){try{const x=new URL(u);if(!(/(^|\.)pokechan-hub\.pages\.dev$|(^|\.)game-kids\.app$/.test(x.hostname)||x.host===location.host))return null;return TW_INAPP[x.pathname]||null}catch(e){return null}}
function twHtml(n,big){
  return `<article class="tw${big?' tw--big':''}" data-id="${n.id}" data-h="${esc(n.user.handle)}" data-mine="${n.mine?1:0}">
    ${twAv(n.user)}
    <div class="tw-m">${n.rp?`<div class="tw-rp">${SVG(I.repost,14)}<a href="#/u/${esc(n.rp.handle)}" data-notr>${esc(n.rp.name)}</a><span>さんがリポスト</span></div>`:''}<div class="tw-h"><a href="#/u/${esc(n.user.handle)}" class="tw-who" data-notr><b>${esc(n.user.name)}</b><span>@${esc(n.user.handle)}</span></a><span class="tw-t">· ${ago(n.created_at)}</span>
      <button class="tw-more" data-more aria-label="そのほかの操作">${SVG(I.more,18)}</button></div>
      ${n.reply_to?`<div class="tw-re">返信先：${n.reply_handle?`<a href="#/u/${esc(n.reply_handle)}" data-notr>@${esc(n.reply_handle)}</a>`:'<span>削除された投稿</span>'}</div>`:''}
      <div class="tw-b" data-notr>${linkTags(n.body)}</div>${twMediaHTML(n)}${n.link&&/^https:\/\//.test(n.link)?`<a class="tw-link" href="${esc(twInApp(n.link)||n.link)}"${twInApp(n.link)?'':' target="_blank" rel="noopener nofollow"'}><b>${/(^|\.)pokechan-hub\.pages\.dev$/.test((()=>{try{return new URL(n.link).hostname}catch(e){return ''}})())||(()=>{try{return new URL(n.link).host===location.host}catch(e){return false}})()?'くわしく見る':'公式サイトで読む'}</b><small>${esc((()=>{try{return new URL(n.link).hostname}catch(e){return ''}})())}</small></a>`:''}
      <div class="tw-a"><button class="tw-like tw-rep" data-reply aria-label="返信">${SVG(TW_IC.reply,18)}<span>${n.replies||''}</span></button><button class="tw-like tw-rpb" data-rp aria-pressed="${!!n.reposted}" aria-label="リポスト">${SVG(TW_IC.repost,18)}<span>${n.reposts||''}</span></button><button class="tw-like" data-like aria-pressed="${n.liked}" aria-label="いいね">${SVG(TW_IC.heart,18)}<span>${n.likes||''}</span></button><button class="tw-like tw-bm" data-bm aria-pressed="${!!n.saved}" aria-label="${n.saved?'ブックマークから外す':'ブックマーク'}">${SVG(TW_IC.bookmark,18)}</button><button class="tw-like tw-sh" data-share aria-label="共有">${SVG(TW_IC.share,18)}</button></div>
    </div></article>`;
}
/* 投稿の下の5つの絵（2026/11/11 依頼主「X と大きさをそろえて」）：X のスクリーンショットの画素で測った形の大きさ（pt）＝返信15.3×14.3・リポスト17.3×12（横長）・いいね15.3×13.7・
   ブックマーク12.7×14.3・共有13.3×13.7、線の太さ約1.5pt に合わせて描き直した（箱23px＝0.958倍で、線を含めてこの大きさになる）。ほかの画面の I.heart 等は変えない */
const TW_IC={
  reply:'<path d="M12 5.8c4.1 0 7.15 2.75 7.15 6.15S16.1 18.1 12 18.1c-1 0-1.9-.15-2.75-.45L5.1 18.9l1.1-3.3C5.35 14.6 4.85 13.35 4.85 11.95 4.85 8.55 7.9 5.8 12 5.8z"/>',
  repost:'<path d="M3.8 9.5 6.5 6.6l2.7 2.9M6.5 7v7.4a3 3 0 0 0 3 3H13M20.2 14.5l-2.7 2.9-2.7-2.9M17.5 17V9.6a3 3 0 0 0-3-3H11"/>',
  heart:'<path d="M12 18.2s-7.15-4.1-7.15-8.7A3.85 3.85 0 0 1 12 7.4a3.85 3.85 0 0 1 7.15 2.1c0 4.6-7.15 8.7-7.15 8.7z"/>',
  bookmark:'<path d="M7.2 5.4h9.6a1 1 0 0 1 1 1v12.2L12 15l-5.8 3.6V6.4a1 1 0 0 1 1-1z"/>',
  share:'<path d="M12 14V5.7M8.4 9.2 12 5.7l3.6 3.5M5.9 12.5v4.8a1 1 0 0 0 1 1h10.2a1 1 0 0 0 1-1v-4.8"/>'};
I.bookmark=I.bookmark||'<path d="M6.5 4.5h11a1 1 0 0 1 1 1v14.2l-6.5-4.4-6.5 4.4V5.5a1 1 0 0 1 1-1z"/>';
/* 投稿のリンク（#/n/番号）を共有する。共有の画面を閉じただけなら何もしない */
async function twShare(el,id){
  const url=location.origin+location.pathname+'#/n/'+id,b=el.querySelector('.tw-b'),txt=(b&&b.textContent||'').trim().slice(0,80);
  if(navigator.share){try{await navigator.share({title:'Game Kid/s',text:txt,url});return}catch(e){if(e&&e.name==='AbortError')return}}
  try{await navigator.clipboard.writeText(url);toast('リンクをコピーしました')}catch(e){toast('リンクをコピーできませんでした')}
}
/* 一覧の中のボタン（いいね・…メニュー）。reload は消したときなどの読み直し */
function twBind(root,reload){
  root.querySelectorAll('.tw:not([data-b])').forEach(el=>{el.dataset.b=1;
    const id=+el.dataset.id;
    el.querySelector('[data-like]').onclick=async e=>{
      const b=e.currentTarget;if(!AUTH.profile){toast(AUTH.user?'先にプロフィールを作ってください':'いいねするにはログインしてください');nav('#/account');return}
      const on=b.getAttribute('aria-pressed')!=='true',sp=b.querySelector('span'),cnt=(+sp.textContent||0)+(on?1:-1);
      b.setAttribute('aria-pressed',on);sp.textContent=cnt>0?cnt:'';
      try{const j=await authFetch(`/api/notes/${id}/like`,{on});sp.textContent=j.likes||''}
      catch(err){b.setAttribute('aria-pressed',!on);sp.textContent=Math.max(0,cnt+(on?-1:1))||'';toast(err.message)}};
    /* 本文を押すと、その投稿の画面（返信も見られる） */
    el.querySelector('.tw-b').onclick=e=>{if(e.target.closest('a')||el.classList.contains('tw--big')||getSelection().toString())return;nav('#/n/'+id)};
    el.querySelectorAll('[data-mi]').forEach(b=>b.onclick=()=>twViewer(b.closest('.tw-md').dataset.mk.split(','),+b.dataset.mi));
    el.querySelector('[data-reply]').onclick=()=>{if(!AUTH.profile){toast(AUTH.user?'先にプロフィールを作ってください':'返信するにはログインしてください');nav('#/account');return}
      twReplySheet(el,id,()=>{const sp=el.querySelector('[data-reply] span');sp.textContent=(+sp.textContent||0)+1;if(keyOf(cur)==='n')noteView(cur.split('/')[2])})};
    el.querySelector('[data-rp]').onclick=async e=>{
      const b=e.currentTarget;if(!AUTH.profile){toast(AUTH.user?'先にプロフィールを作ってください':'リポストするにはログインしてください');nav('#/account');return}
      const on=b.getAttribute('aria-pressed')!=='true',sp=b.querySelector('span'),cnt=(+sp.textContent||0)+(on?1:-1);
      b.setAttribute('aria-pressed',on);sp.textContent=cnt>0?cnt:'';
      try{const j=await authFetch(`/api/notes/${id}/repost`,{on});sp.textContent=j.reposts||'';toast(on?'リポストしました':'リポストを取り消しました')}
      catch(err){b.setAttribute('aria-pressed',!on);sp.textContent=Math.max(0,cnt+(on?-1:1))||'';toast(err.message)}};
    /* ブックマーク（2026/11/11 依頼主）：本人だけの保存。先に見た目を変え、保存できなければ戻す */
    el.querySelector('[data-bm]').onclick=async e=>{
      const b=e.currentTarget;if(!AUTH.profile){toast(AUTH.user?'先にプロフィールを作ってください':'ブックマークするにはログインしてください');nav('#/account');return}
      const on=b.getAttribute('aria-pressed')!=='true';
      const set=v=>{b.setAttribute('aria-pressed',v);b.setAttribute('aria-label',v?'ブックマークから外す':'ブックマーク')};
      set(on);toast(on?'ブックマークに追加しました':'ブックマークから削除しました');
      try{await authFetch(`/api/notes/${id}/bookmark`,{on})}catch(err){set(!on);toast(err.message)}};
    /* 共有：スマホは端末の共有の画面、できなければリンクをコピー */
    el.querySelector('[data-share]').onclick=()=>twShare(el,id);
    el.querySelector('[data-more]').onclick=async()=>{
      const h=el.dataset.h,mine=el.dataset.mine==='1';
      const opts=mine?['この投稿を削除する']:['この投稿を通報する',`@${h} の投稿を表示しない`];
      const c=await pickSheet(mine?'あなたの投稿':`@${h} の投稿`,opts);if(!c)return;
      if(c===opts[0]&&mine){if(!await askConfirm({title:'ポストを削除しますか？',text:'この操作は取り消せません。プロフィール、あなたをフォローしているアカウントのタイムライン、検索結果からポストが削除されます。',ok:'削除'}))return;
        try{await authFetch(`/api/notes/${id}/delete`,{});toast('削除しました');el.remove()}catch(err){toast(err.message)}}
      else if(c===opts[0]){
        if(!AUTH.profile){toast('通報するにはログインしてください');return}
        const reason=await pickSheet('通報の理由を選んでください',REPORT_REASONS,'3人から通報されると自動的に非表示になり、運営者が確認します。');if(!reason)return;
        try{await authFetch(`/api/notes/${id}/report`,{reason});toast('通報しました。ご協力ありがとうございます')}catch(err){toast(err.message)}}
      else{const s=muted();s.add(h.toLowerCase());lsW('pcmute',[...s].slice(-500));toast(`@${h} の投稿を、あなたの画面では表示しません`);reload&&reload()}
    };
  });
}
/* 下までスクロールすると続きを読み込む一覧。path は ?before= を付けて呼ぶAPI */
function twFeed(el,path,emptyMsg,o={}){
  let next=null,busy=false,done=false,io=null;
  const mu=muted();
  const more=async first=>{
    if(busy||done)return;busy=true;
    const sent=el.querySelector('.tw-sent');if(sent)sent.innerHTML='<p class="empty" style="padding:20px">読み込み中…</p>';
    try{
      const j=await authFetch(path+(path.includes('?')?'&':'?')+(next?'before='+next:''));
      if(!document.body.contains(el))return;
      const list=j.notes.filter(n=>!mu.has(n.user.handle.toLowerCase()));
      if(first)el.innerHTML='';
      el.querySelector('.tw-sent')?.remove();
      el.insertAdjacentHTML('beforeend',list.map(twHtml).join(''));
      next=j.next;done=!next;
      if(first&&!el.querySelector('.tw'))el.innerHTML=`<p class="empty" style="padding:40px 24px">${emptyMsg}</p>`;
      if(!done){el.insertAdjacentHTML('beforeend','<div class="tw-sent"><div class="btns"><button class="btn btn-s" data-more-load>もっと見る</button></div></div>');
        const s=el.querySelector('.tw-sent');s.querySelector('[data-more-load]').onclick=()=>more();
        if('IntersectionObserver' in window){io&&io.disconnect();io=new IntersectionObserver(es=>{if(es.some(x=>x.isIntersecting)){io.disconnect();more()}},{rootMargin:'600px'});io.observe(s)}}
      twBind(el,()=>twFeed(el,path,emptyMsg));
    }catch(e){if(first)el.innerHTML=`<div class="bnote" style="margin:16px">${esc(e.message)}</div>`;else toast(e.message);el.querySelector('.tw-sent')?.remove()}
    finally{busy=false}
  };
  /* o.keep：引っぱって更新するときは、新しい中身が届くまで今の中身を残す */
  if(!o.keep)el.innerHTML='<p class="empty">読み込み中…</p>';
  return more(true);
}
/* 投稿する欄 */
function twComposer(prof,onDone){
  return{html:`<div class="twc">${twAv(prof)}<div class="twc-m">
      <textarea id="twc-t" rows="2" maxlength="${TW_MAX*2}" placeholder="いまどうしてる？（#タグ を付けると、みんなが探しやすくなります）"></textarea>
      <div class="twc-pv" id="twc-pv"></div>
      <div class="twc-f"><label class="twc-img" aria-label="画像を付ける（4枚まで）">${SVG(I.image,20)}<input type="file" id="twc-f" accept="image/*" multiple hidden></label><span class="twc-n" id="twc-n"></span><button class="btn btn-p twc-b" id="twc-b" disabled>投稿する</button></div></div></div>`,
    bind(){
      const t=document.getElementById('twc-t'),b=document.getElementById('twc-b'),c=document.getElementById('twc-n'),fi=document.getElementById('twc-f'),pv=document.getElementById('twc-pv');
      let imgs=[];
      const upd=()=>{const n=[...t.value.trim()].length,left=TW_MAX-[...t.value].length;c.textContent=left<=20?left:'';c.classList.toggle('over',left<0);b.disabled=(n<1&&!imgs.length)||left<0;t.style.height='auto';t.style.height=t.scrollHeight+'px'};
      const drawPv=()=>{pv.innerHTML=imgs.map((x,i)=>`<span class="twc-th"><img src="${x.url}" alt=""><button data-rm="${i}" aria-label="この画像を外す">${SVG(I.x,14)}</button></span>`).join('');
        pv.querySelectorAll('[data-rm]').forEach(x=>x.onclick=()=>{URL.revokeObjectURL(imgs[+x.dataset.rm].url);imgs.splice(+x.dataset.rm,1);drawPv();upd()})};
      fi.onchange=async()=>{const fs=[...fi.files].slice(0,4-imgs.length);fi.value='';if(!fs.length){toast('画像は4枚までです');return}
        for(const f of fs){try{const x=await twShrink(f);x.url=URL.createObjectURL(x.blob);imgs.push(x)}catch(err){toast(err.message)}}drawPv();upd()};
      t.oninput=upd;
      b.onclick=async()=>{b.disabled=true;
        try{const media=[];for(let i=0;i<imgs.length;i++){b.textContent=`画像を送信中 ${i+1}/${imgs.length}`;media.push(await twUpload(imgs[i]))}
          b.textContent='投稿する';await authFetch('/api/notes',{body:t.value,media});
          t.value='';imgs.forEach(x=>URL.revokeObjectURL(x.url));imgs=[];drawPv();upd();toast('投稿しました');onDone()}
        catch(err){b.textContent='投稿する';toast(err.message);upd()}};
    }};
}
let tlTab='all',TLP=null;
/* ホーム（#/）とタイムライン（#/tl）は同じ画面。左「みんな」・右「フォロー中」を、押すか左右にスワイプして切りかえる */
async function tlView(a,home){
  if(a==='following'||a==='all')tlTab=a;
  const myKey=keyOf(cur);
  if(home)setHeader('',null,{logo:true});else setHeader('タイムライン','#/community');
  V.innerHTML='<p class="empty">読み込み中…</p>';
  const prof=await twAuth();if(keyOf(cur)!==myKey)return;TLP=prof;
  if(tlTab==='following'&&!prof)tlTab='all';
  const tabs=[['all','みんな'],['following','フォロー中']];
  const comp=prof?twComposer(prof,()=>{postSheetClose();tlShow(tlTab,true)}):null;
  V.innerHTML=`<div class="seg" id="tl-seg">${tabs.map(([k,l])=>`<button role="tab" data-tab="${k}">${l}</button>`).join('')}<span class="seg-i" style="width:50%"></span></div>
    ${comp?comp.html:`<div class="bnote" style="margin:12px 16px">${AUTH.user?'投稿するには、<a href="#/account" style="color:var(--acc)">プロフィールを作って</a>ください。':'<a href="#/account" style="color:var(--acc)">ログイン</a>すると、投稿・いいね・フォローができます。見るだけならログインは不要です。'}</div>`}
    <div id="tl-list" class="tl-list"></div>`;
  V.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>tlShow(b.dataset.tab));
  if(comp)comp.bind();
  tlShow(tlTab,true);
}
/* タブを切りかえる（一覧だけ入れかえて、横にすべらせる） */
const TL_EMPTY=tab=>tab==='following'?'フォローしている人の投稿がここに出ます。<br>「みんな」から気になるトレーナーを探してフォローしてみましょう。':'まだ投稿がありません。最初の投稿をしてみましょう。';
/* 引っぱって更新（46-ptr.js）：いまのタブの投稿を読み直す */
function tlReload(){const el=document.getElementById('tl-list');return el?twFeed(el,'/api/tl?tab='+tlTab,TL_EMPTY(tlTab),{keep:true}):Promise.resolve()}
function tlShow(tab,first){
  if(tab==='following'&&!TLP){toast('フォロー中を見るにはログインしてください');return false}
  const dir=tab==='following'?1:-1,changed=tab!==tlTab;tlTab=tab;
  const ti=tab==='following'?1:0;
  document.querySelectorAll('#tl-seg [data-tab]').forEach((b,i)=>b.setAttribute('aria-selected',i===ti));
  const ind=document.querySelector('#tl-seg .seg-i');if(ind)ind.style.transform=`translateX(${ti*100}%)`;
  if(keyOf(cur)==='tl'){const h='#/tl/'+tab;if(cur!==h){cur=h;setUrl(h)}}
  const el=document.getElementById('tl-list');if(!el)return false;
  if(changed&&!first&&!reduceMotion){el.animate([{transform:`translateX(${dir*40}px)`,opacity:.2},{transform:'none',opacity:1}],{duration:220,easing:'cubic-bezier(.2,.8,.2,1)'})}
  twFeed(el,'/api/tl?tab='+tab,TL_EMPTY(tab));
  return true;
}
/* プロフィール（userView）は 53-profile.js（トレーナーカード） */
/* 返信を書く（下から出る画面）。返信先の投稿を上に小さく見せる */
function twReplySheet(el,id,onDone){
  const h=el.dataset.h,body=el.querySelector('.tw-b').textContent;
  const o=document.createElement('div');o.className='psheet';
  o.innerHTML=`<div class="psheet-bg"></div><div class="psheet-p" role="dialog" aria-modal="true" aria-label="返信">
    <div class="twr-q"><b data-notr>@${esc(h)}</b><span data-notr>${esc(body.slice(0,80))}</span></div>
    <textarea id="twr-t" class="twr-t" rows="3" maxlength="${TW_MAX*2}" placeholder="返信を書く"></textarea>
    <div class="twc-f"><span class="twc-n" id="twr-n"></span><button class="btn btn-p twc-b" id="twr-b" disabled>返信する</button></div>
    <button class="psheet-x">やめる</button></div>`;
  document.body.appendChild(o);requestAnimationFrame(()=>o.classList.add('on'));
  const t=o.querySelector('#twr-t'),b=o.querySelector('#twr-b'),c=o.querySelector('#twr-n');
  const close=()=>{o.classList.remove('on');setTimeout(()=>o.remove(),180)};
  o.querySelector('.psheet-bg').onclick=close;o.querySelector('.psheet-x').onclick=close;
  t.oninput=()=>{const left=TW_MAX-[...t.value].length;c.textContent=left<=20?left:'';c.classList.toggle('over',left<0);b.disabled=!t.value.trim()||left<0};
  b.onclick=async()=>{b.disabled=true;try{await authFetch('/api/notes',{body:t.value,reply_to:id});toast('返信しました');close();onDone&&onDone()}catch(err){toast(err.message);b.disabled=false}};
  setTimeout(()=>t.focus(),60);
}
/* 1件の投稿：返信先（あれば）→ 投稿 → 返信を書く欄 → 返信の一覧 */
async function noteView(id){
  setHeader('投稿','#/tl');
  V.innerHTML='<p class="empty">読み込み中…</p>';
  const prof=await twAuth();if(keyOf(cur)!=='n')return;
  try{const j=await authFetch('/api/notes/'+(+id));
    V.innerHTML=`${j.parent?`<div class="tw-par">${twHtml(j.parent)}</div>`:''}<div id="tw-one">${twHtml(j.note,true)}</div>
      ${prof?`<div class="btns" style="padding:10px 16px"><button class="btn btn-s" id="tw-rb" style="flex:1">${SVG(I.reply,16)}返信する</button></div>`:''}
      <div class="sec"><h2>返信</h2></div><div id="tw-replies"></div>`;
    twBind(V,()=>nav('#/tl'));
    const rb=document.getElementById('tw-rb');if(rb)rb.onclick=()=>twReplySheet(document.querySelector('#tw-one .tw'),+id,()=>noteView(id));
    twFeed(document.getElementById('tw-replies'),`/api/notes/${+id}/replies`,'まだ返信はありません。');}
  catch(e){V.innerHTML=`<div class="bnote" style="margin:16px">${esc(e.message)}</div>`}
}
async function notifView(quiet){
  setHeader('お知らせ','#/community');
  if(quiet!==true)V.innerHTML='<p class="empty">読み込み中…</p>';
  const prof=await twAuth();if(keyOf(cur)!=='notif')return;
  if(!prof){V.innerHTML=`<div class="bnote" style="margin:16px"><a href="#/account" style="color:var(--acc)">ログイン</a>すると、いいねやフォローのお知らせがここに届きます。</div>`;return}
  try{
    const j=await authFetch('/api/notifs');
    const NK={like:[I.heart,'あなたの投稿にいいねしました'],reply:[I.reply,'あなたの投稿に返信しました'],repost:[I.repost,'あなたの投稿をリポストしました'],follow:[I.user,'あなたをフォローしました'],freq:[I.lock,'フォローをリクエストしています'],facc:[I.user,'フォローのリクエストを許可しました']};
    V.innerHTML=j.notifs.length?j.notifs.map(n=>n.kind==='freq'?`<div class="twn twn-req${n.id>j.seen?' new':''}" data-req="${esc(n.user.handle)}">
      <span class="twn-i twn-i--follow">${SVG(I.lock,22)}</span>
      <div class="tw-m"><a href="#/u/${esc(n.user.handle)}" data-notr><b>${esc(n.user.name)}</b> <span class="tw-t">@${esc(n.user.handle)}</span></a>
      <div>${NK.freq[1]}<span class="tw-t">　${ago(n.created_at)}</span></div>
      <div class="twn-act"><button class="btn btn-p" data-ans="1">許可する</button><button class="btn btn-s" data-ans="0">断る</button></div></div></div>`
      :`<a class="twn${n.id>j.seen?' new':''}" href="${n.kind!=='follow'&&n.note_id?'#/n/'+n.note_id:'#/u/'+esc(n.user.handle)}">
      <span class="twn-i twn-i--${n.kind}">${SVG((NK[n.kind]||NK.follow)[0],22)}</span>
      <div class="tw-m"><div data-notr><b>${esc(n.user.name)}</b> <span class="tw-t">@${esc(n.user.handle)}</span></div>
      <div>${(NK[n.kind]||NK.follow)[1]}<span class="tw-t">　${ago(n.created_at)}</span></div>
      ${n.body?`<div class="twn-b" data-notr>${esc(n.body)}</div>`:''}</div></a>`).join(''):'<p class="empty" style="padding:40px 24px">まだお知らせはありません。<br>いいね・返信・リポスト・フォローされると、ここに届きます。</p>';
    V.querySelectorAll('[data-req] [data-ans]').forEach(b=>b.onclick=async()=>{const row=b.closest('[data-req]'),ok=b.dataset.ans==='1';row.querySelectorAll('button').forEach(x=>x.disabled=true);
      try{await authFetch('/api/follow/answer',{handle:row.dataset.req,ok});row.querySelector('.twn-act').innerHTML=`<span class="tw-t">${ok?'許可しました':'断りました'}</span>`}
      catch(e){toast(e.message);row.querySelectorAll('button').forEach(x=>x.disabled=false)}});
    if(j.notifs.some(n=>n.id>j.seen))authFetch('/api/notifs/seen',{}).then(()=>notifBadge(0)).catch(()=>{});
    V.insertAdjacentHTML('afterbegin',`<a class="nf-fq" id="nf-fq" href="#/requests"${FREQ_N?'':' hidden'}>${SVG(I.lock,18)}<span>フォローリクエスト <b class="num">${FREQ_N}</b>件</span>${SVG(I.chev,16)}</a>`);
    V.insertAdjacentHTML('afterbegin','<div id="nf-push"></div>');
    authFetch('/api/notifs/count').then(c=>freqBadge(c.requests||0)).catch(()=>{});if(typeof pushRow==='function')pushRow(document.getElementById('nf-push'),true);
  }catch(e){V.innerHTML=`<div class="bnote" style="margin:16px">${esc(e.message)}</div>`}
}
/* 未読のお知らせの数を「コミュニティ」タブに出す（ログインしたことがある端末だけ、1分ごと） */
let notifN=0;
function notifBadge(n){
  notifN=n;
  /* 2026/11/11：タブが「メッセージ」になったので、お知らせの未読は左上の自分のアイコンの点と左のメニューに出す */
  document.body.dataset.nf=n?'1':'';
  const d=document.getElementById('dr-nf');if(d)d.textContent=n?(n>9?'9+':n):'';
  const c=document.getElementById('cm-notif-n');if(c)c.textContent=n?`未読 ${n}件`:'';
}
let notifAt=0;
async function notifPoll(){
  let was='';try{was=localStorage.getItem('pcin')||''}catch(e){}
  if(!PCF||!was||Date.now()-notifAt<12e3||document.hidden)return;notifAt=Date.now();
  try{if(!(await twAuth()))return;const j=await authFetch('/api/notifs/count');
    /* リアルタイム（2026/11/11 依頼主）：お知らせ・リクエストの画面を開いていて新しいものが来たら、その場で読み直す */
    const k=keyOf(cur),fq=j.requests||0,chg=fq!==FREQ_N;
    if(k==='notif'&&j.unread>0&&!document.querySelector('.psheet,.sheet:not([hidden])'))notifView(true);
    if(k==='requests'&&chg&&!document.querySelector('.fw-out'))requestsView(true);
    notifBadge(k==='notif'?0:j.unread);if(typeof freqBadge==='function')freqBadge(fq);if(typeof dmBadgeRefresh==='function')dmBadgeRefresh();if(typeof pushResync==='function')pushResync()}catch(e){}
}
/* 15秒ごと（画面を見ているときだけ）。ほかのアプリから戻ったときはすぐ読む（2026/11/11 依頼主「リアルタイムで」。前は1分ごと） */
setInterval(notifPoll,15e3);setTimeout(notifPoll,1500);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){notifAt=0;notifPoll()}});

/* ===================== 検索（#/search/言葉） =====================
   ポケモンの名前に合えば、いちばん上にそのポケモン（押すと図鑑の詳しい画面）。その下に人と投稿。
   何も入れていないときは、よく使われているタグ・最近の検索・図鑑への入口。 */
const srRecent=()=>lsJ('pcsearch',[]);
async function searchView(a){
  let q='';try{q=decodeURIComponent(a||'')}catch(e){q=a||''}
  setHeader('検索');
  V.innerHTML=`<div class="srch sr-top">${SVG(I.search,18)}<input id="sr-q" value="${esc(q)}" placeholder="ポケモン・#タグ・言葉で検索" autocomplete="off" enterkeyhint="search" aria-label="検索"></div><div id="sr-res"></div>`;
  const inp=document.getElementById('sr-q'),res=document.getElementById('sr-res');
  const go=v=>{v=v.trim();if(!v)return;lsW('pcsearch',[v,...srRecent().filter(x=>x!==v)].slice(0,8));nav('#/search/'+encodeURIComponent(v))};
  inp.onkeydown=e=>{if(e.key==='Enter'){inp.blur();go(inp.value)}};
  /* 打っている間は、ポケモンの候補だけその場で出す */
  inp.oninput=()=>{const t=inp.value.trim().replace(/^[#＃]/,'');const box=document.getElementById('sr-live');if(!box)return;
    box.innerHTML=t?P.filter(p=>nmHit(p,t)).slice(0,5).map(p=>rowP(p)).join(''):''};
  if(!q){
    const rc=srRecent();
    res.innerHTML=`<div id="sr-live"></div>
      <a class="row" href="#/dex"><span class="ttile-i">${SVG(I.dex,22)}</span><div class="row-m"><div class="row-t">図鑑をすべて見る</div><div class="row-s">${P.length}匹＋メガシンカ${MEGAP.length}種・タイプや役割で絞り込み</div></div><span class="chev">${SVG(I.chev,18)}</span></a>
      ${rc.length?`<div class="sec"><h2>最近の検索</h2><button class="bback" id="sr-clr" style="padding:0">消す</button></div><div class="pills" style="flex-wrap:wrap;padding-top:0">${rc.map(x=>`<a class="pill" href="#/search/${encodeURIComponent(x)}" data-notr>${esc(x)}</a>`).join('')}</div>`:''}
      <div class="sec"><h2>よく使われているタグ</h2><span style="font-size:12px;color:var(--dim)">この7日間</span></div><div id="sr-trend"><p class="empty" style="padding:16px">読み込み中…</p></div>`;
    const c=document.getElementById('sr-clr');if(c)c.onclick=()=>{lsW('pcsearch',[]);searchView('')};
    if(!a)setTimeout(()=>inp.focus(),50);
    try{await twAuth();const j=await authFetch('/api/tags/trend');const el=document.getElementById('sr-trend');if(!el)return;
      el.innerHTML=j.tags.length?j.tags.map((t,i)=>`<a class="row" href="#/search/${encodeURIComponent('#'+t.tag)}"><div class="row-m"><div class="row-s">${i+1}位</div><div class="row-t htag" data-notr>#${esc(t.tag)}</div><div class="row-s">${t.n}件の投稿</div></div></a>`).join(''):'<p class="empty" style="padding:16px 24px">まだタグの付いた投稿がありません。投稿に #タグ を付けると、ここに並びます。</p>'}
    catch(e){const el=document.getElementById('sr-trend');if(el)el.innerHTML=`<p class="empty" style="padding:16px 24px">${esc(e.message)}</p>`}
    return;
  }
  lsW('pcsearch',[q,...srRecent().filter(x=>x!==q)].slice(0,8));
  const t=q.replace(/^[#＃]/,''),mons=P.filter(p=>nmHit(p,t));
  /* 名前がぴったり合うポケモンは大きく、ほかの候補は下に小さく */
  const exact=mons.find(p=>p.n===kata(t)||kfold(p.n)===kfold(t)||kfold(formInfo(p).base)===kfold(t)||(p.ja&&p.ja===kata(t))||formInfo(p).base===kata(t)||p.n.toLowerCase()===t.toLowerCase());
  const top=exact||(mons.length===1?mons[0]:null),others=mons.filter(p=>p!==top).slice(0,5);
  res.innerHTML=`<div id="sr-live"></div>${top?`<a class="sr-mon" href="#/p/${top.no}"><span class="av">${stamp(top)}</span><div class="row-m">${nm(top,{big:true})}<div class="chips" style="margin-top:6px">${top.t.map(chip).join('')}</div>
      <div class="sr-st">${SN.map((n,i)=>`<span><small>${n}</small><b>${top.s[i]}</b></span>`).join('')}<span><small>合計</small><b>${top.bst}</b></span></div><div class="row-s" style="margin-top:4px">図鑑の詳しい画面を見る ›</div></div></a>`:''}
    ${others.length?`<div class="sec"><h2>${top?'ほかのポケモン':'ポケモン'}</h2></div>${others.map(p=>rowP(p)).join('')}`:''}
    ${guideSearch(q)}
    <div id="sr-users"></div><div class="sec"><h2>投稿</h2></div><div id="sr-comp"></div><div id="sr-list"></div>`;
  const prof=await twAuth();
  /* #タグ の検索では、そのタグを入れた投稿欄を出す（対戦募集・構築相談などはここから投稿する） */
  if(/^[#＃]/.test(q)){const box=document.getElementById('sr-comp');
    if(box&&prof){const c=twComposer(prof,()=>searchView(a));box.innerHTML=c.html;c.bind();const ta=document.getElementById('twc-t');if(ta&&!ta.value){ta.value='#'+t+' ';ta.dispatchEvent(new Event('input'))}}
    else if(box)box.innerHTML=`<p class="note" style="padding-top:0"><a href="#/account" style="color:var(--acc)">ログインしてプロフィールを作る</a>と、このタグで投稿できます。</p>`}
  twFeed(document.getElementById('sr-list'),'/api/search?q='+encodeURIComponent(q),`「${esc(q)}」を含む投稿はまだありません。`);
  try{const j=await authFetch('/api/search?q='+encodeURIComponent(q));const el=document.getElementById('sr-users');
    if(el&&j.users&&j.users.length)el.innerHTML=`<div class="sec"><h2>トレーナー</h2></div>`+j.users.map(x=>`<a class="row" href="#/u/${esc(x.handle)}">${twAv(x)}<div class="row-m" data-notr><div class="row-t">${esc(x.name)}</div><div class="row-s">@${esc(x.handle)}${x.bio?'　'+esc(x.bio.slice(0,40)):''}</div></div></a>`).join('')}catch(e){}
}
