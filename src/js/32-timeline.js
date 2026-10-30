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
const twAv=(u,s)=>`<a class="tw-av${s?' tw-av--'+s:''}" href="#/u/${esc(u.handle)}" aria-label="${esc(u.name)}のプロフィール">${esc((u.name||'?').slice(0,1))}</a>`;
/* 本文の #タグ を青い文字にして、押すとそのタグの検索へ（先に文字を区切ってから安全な形にする） */
const TAG_RE=/[#＃]([\p{L}\p{N}_ー]{1,30})/gu;
function linkTags(t){let out='',i=0;for(const m of String(t).matchAll(TAG_RE)){out+=esc(t.slice(i,m.index))+`<a class="htag" href="#/search/${encodeURIComponent('#'+m[1])}">${esc(m[0])}</a>`;i=m.index+m[0].length}return out+esc(t.slice(i))}
/* ---- 画像（サーバーは worker/src/media.js） ---- */
const mediaUrl=k=>COMM_API+'/m/'+k;
function twMediaHTML(n){
  if(n.media_hidden)return `<div class="tw-mh">画像は確認中です（通報があったため、運営者が確認するまで表示しません）</div>`;
  const m=n.media||[];if(!m.length)return'';
  const ar=m.length===1?Math.max(.6,Math.min(1.9,(m[0].w||4)/(m[0].h||3))):0;
  return `<div class="tw-md tw-md--${m.length}" data-mk="${m.map(x=>x.k).join(',')}"${ar?` style="aspect-ratio:${ar.toFixed(3)}"`:''}>${m.map((x,i)=>`<button class="tw-mi" data-mi="${i}" aria-label="画像${i+1}を大きく見る"><img src="${mediaUrl(x.k)}" alt="" loading="lazy" decoding="async"></button>`).join('')}</div>`;
}
/* 画像を画面いっぱいに見る（左右の矢印・キーで切りかえ、背景かボタンで閉じる） */
function twViewer(keys,i){
  const o=document.createElement('div');o.className='tw-view';o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');
  o.innerHTML=`<img alt=""><button class="tw-vx" aria-label="閉じる">${SVG(I.x,22)}</button>${keys.length>1?`<button class="tw-vp" aria-label="前の画像">‹</button><button class="tw-vn" aria-label="次の画像">›</button><span class="tw-vc"></span>`:''}`;
  const img=o.querySelector('img'),show=()=>{img.src=mediaUrl(keys[i]);const c=o.querySelector('.tw-vc');if(c)c.textContent=`${i+1} / ${keys.length}`};
  const close=()=>{removeEventListener('keydown',key);o.remove()};
  const step=d=>{i=(i+d+keys.length)%keys.length;show()};
  const key=e=>{if(e.key==='Escape')close();else if(e.key==='ArrowRight')step(1);else if(e.key==='ArrowLeft')step(-1)};
  o.onclick=e=>{if(e.target===o||e.target.closest('.tw-vx'))close();else if(e.target.closest('.tw-vp'))step(-1);else if(e.target.closest('.tw-vn'))step(1)};
  addEventListener('keydown',key);document.body.appendChild(o);show();
}
/* 画像を縮める：長い辺1600px・WebP（使えなければ JPEG）。描き直すので、撮影場所などの情報（EXIF）は残らない */
async function twShrink(file){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('画像を読み込めませんでした（対応していない形式かもしれません）。'));i.src=url});
    const sc=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.max(1,Math.round(img.naturalWidth*sc)),h=Math.max(1,Math.round(img.naturalHeight*sc));
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
function twHtml(n,big){
  return `<article class="tw${big?' tw--big':''}" data-id="${n.id}" data-h="${esc(n.user.handle)}" data-mine="${n.mine?1:0}">
    ${twAv(n.user)}
    <div class="tw-m">${n.rp?`<div class="tw-rp">${SVG(I.repost,14)}<a href="#/u/${esc(n.rp.handle)}" data-notr>${esc(n.rp.name)}</a><span>さんがリポスト</span></div>`:''}<div class="tw-h"><a href="#/u/${esc(n.user.handle)}" class="tw-who" data-notr><b>${esc(n.user.name)}</b><span>@${esc(n.user.handle)}</span></a><span class="tw-t">· ${ago(n.created_at)}</span>
      <button class="tw-more" data-more aria-label="そのほかの操作">${SVG(I.more,18)}</button></div>
      ${n.reply_to?`<div class="tw-re">返信先：${n.reply_handle?`<a href="#/u/${esc(n.reply_handle)}" data-notr>@${esc(n.reply_handle)}</a>`:'<span>削除された投稿</span>'}</div>`:''}
      <div class="tw-b" data-notr>${linkTags(n.body)}</div>${twMediaHTML(n)}
      <div class="tw-a"><button class="tw-like tw-rep" data-reply aria-label="返信">${SVG(I.reply,18)}<span>${n.replies||''}</span></button><button class="tw-like tw-rpb" data-rp aria-pressed="${!!n.reposted}" aria-label="リポスト">${SVG(I.repost,18)}<span>${n.reposts||''}</span></button><button class="tw-like" data-like aria-pressed="${n.liked}" aria-label="いいね">${SVG(I.heart,18)}<span>${n.likes||''}</span></button></div>
    </div></article>`;
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
    el.querySelector('[data-more]').onclick=async()=>{
      const h=el.dataset.h,mine=el.dataset.mine==='1';
      const opts=mine?['この投稿を削除する']:['この投稿を通報する',`@${h} の投稿を表示しない`];
      const c=await pickSheet(mine?'あなたの投稿':`@${h} の投稿`,opts);if(!c)return;
      if(c===opts[0]&&mine){if(!confirm('この投稿を削除します。元に戻せません。'))return;
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
function twFeed(el,path,emptyMsg){
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
  el.innerHTML='<p class="empty">読み込み中…</p>';
  more(true);
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
  if(home)setHeader(L('ホーム','Home'));else setHeader('タイムライン','#/community');
  V.innerHTML='<p class="empty">読み込み中…</p>';
  const prof=await twAuth();if(keyOf(cur)!==myKey)return;TLP=prof;
  if(tlTab==='following'&&!prof)tlTab='all';
  const tabs=[['all','みんな'],['following','フォロー中']];
  const comp=prof?twComposer(prof,()=>tlShow(tlTab,true)):null;
  V.innerHTML=`<div class="seg" id="tl-seg">${tabs.map(([k,l])=>`<button role="tab" data-tab="${k}">${l}</button>`).join('')}<span class="seg-i" style="width:50%"></span></div>
    ${comp?comp.html:`<div class="bnote" style="margin:12px 16px">${AUTH.user?'投稿するには、<a href="#/account" style="color:var(--acc)">プロフィールを作って</a>ください。':'<a href="#/account" style="color:var(--acc)">ログイン</a>すると、投稿・いいね・フォローができます。見るだけならログインは不要です。'}</div>`}
    <div id="tl-list" class="tl-list"></div>`;
  V.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>tlShow(b.dataset.tab));
  if(comp)comp.bind();
  tlShow(tlTab,true);
}
/* タブを切りかえる（一覧だけ入れかえて、横にすべらせる） */
function tlShow(tab,first){
  if(tab==='following'&&!TLP){toast('フォロー中を見るにはログインしてください');return false}
  const dir=tab==='following'?1:-1,changed=tab!==tlTab;tlTab=tab;
  const ti=tab==='following'?1:0;
  document.querySelectorAll('#tl-seg [data-tab]').forEach((b,i)=>b.setAttribute('aria-selected',i===ti));
  const ind=document.querySelector('#tl-seg .seg-i');if(ind)ind.style.transform=`translateX(${ti*100}%)`;
  if(keyOf(cur)==='tl'){const h='#/tl/'+tab;if(cur!==h){cur=h;setUrl(h)}}
  const el=document.getElementById('tl-list');if(!el)return false;
  if(changed&&!first&&!reduceMotion){el.animate([{transform:`translateX(${dir*40}px)`,opacity:.2},{transform:'none',opacity:1}],{duration:220,easing:'cubic-bezier(.2,.8,.2,1)'})}
  twFeed(el,'/api/tl?tab='+tab,tab==='following'?'フォローしている人の投稿がここに出ます。<br>「みんな」から気になるトレーナーを探してフォローしてみましょう。':'まだ投稿がありません。最初の投稿をしてみましょう。');
  return true;
}
async function userView(h){
  setHeader('プロフィール','#/tl');
  if(!/^[A-Za-z0-9_]{3,15}$/.test(h||'')){V.innerHTML='<p class="empty">ユーザーが見つかりません。</p>';return}
  V.innerHTML='<p class="empty">読み込み中…</p>';
  await twAuth();if(keyOf(cur)!=='u')return;
  let u;try{u=(await authFetch('/api/u/'+h)).user}catch(e){V.innerHTML=`<div class="bnote" style="margin:16px">${esc(e.message)}</div>`;return}
  setHeader(esc(u.name),'#/tl');
  const isMuted=muted().has(u.handle.toLowerCase());
  V.innerHTML=`<div class="twp">
    <div class="twp-top"><span class="ac-av">${esc((u.name||'?').slice(0,1))}</span>
      ${u.me?'<a class="btn btn-s twp-btn" href="#/account">プロフィールを編集</a>':`<button class="btn ${u.followed?'btn-s':'btn-p'} twp-btn" id="twp-f">${u.followed?'フォロー中':'フォローする'}</button>`}</div>
    <h2 class="twp-n" data-notr>${esc(u.name)}</h2><div class="twp-h">@${esc(u.handle)}${u.follows_me?'<span class="atag" style="margin-left:6px">フォローされています</span>':''}</div>
    ${u.bio?`<p class="twp-b" data-notr>${esc(u.bio)}</p>`:''}${resultBadges(u.results)}
    <div class="twp-c"><span><b class="num">${u.following}</b> フォロー</span><span><b class="num" id="twp-fc">${u.followers}</b> フォロワー</span><span><b class="num">${u.notes}</b> 投稿</span></div>
    ${isMuted?`<div class="bnote" style="margin:8px 0 0">この人の投稿は、あなたの画面では表示しない設定です。<button class="bback" id="twp-um" style="padding:0">表示する</button></div>`:''}
  </div><div class="sec"><h2>投稿</h2></div><div id="twp-list"></div>`;
  const fb=document.getElementById('twp-f');
  if(fb)fb.onclick=async()=>{
    if(!AUTH.profile){toast(AUTH.user?'先にプロフィールを作ってください':'フォローするにはログインしてください');nav('#/account');return}
    const on=fb.textContent!=='フォロー中';fb.disabled=true;
    try{const j=await authFetch('/api/follow',{handle:u.handle,on});fb.textContent=j.followed?'フォロー中':'フォローする';fb.className='btn '+(j.followed?'btn-s':'btn-p')+' twp-btn';document.getElementById('twp-fc').textContent=j.followers}
    catch(e){toast(e.message)}finally{fb.disabled=false}};
  const um=document.getElementById('twp-um');if(um)um.onclick=()=>{const s=muted();s.delete(u.handle.toLowerCase());lsW('pcmute',[...s]);userView(h)};
  if(!isMuted)twFeed(document.getElementById('twp-list'),`/api/u/${u.handle}/notes`,'まだ投稿がありません。');
}
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
async function notifView(){
  setHeader('お知らせ','#/community');
  V.innerHTML='<p class="empty">読み込み中…</p>';
  const prof=await twAuth();if(keyOf(cur)!=='notif')return;
  if(!prof){V.innerHTML=`<div class="bnote" style="margin:16px"><a href="#/account" style="color:var(--acc)">ログイン</a>すると、いいねやフォローのお知らせがここに届きます。</div>`;return}
  try{
    const j=await authFetch('/api/notifs');
    const NK={like:[I.heart,'あなたの投稿にいいねしました'],reply:[I.reply,'あなたの投稿に返信しました'],repost:[I.repost,'あなたの投稿をリポストしました'],follow:[I.user,'あなたをフォローしました']};
    V.innerHTML=j.notifs.length?j.notifs.map(n=>`<a class="twn${n.id>j.seen?' new':''}" href="${n.kind!=='follow'&&n.note_id?'#/n/'+n.note_id:'#/u/'+esc(n.user.handle)}">
      <span class="twn-i twn-i--${n.kind}">${SVG((NK[n.kind]||NK.follow)[0],22)}</span>
      <div class="tw-m"><div data-notr><b>${esc(n.user.name)}</b> <span class="tw-t">@${esc(n.user.handle)}</span></div>
      <div>${(NK[n.kind]||NK.follow)[1]}<span class="tw-t">　${ago(n.created_at)}</span></div>
      ${n.body?`<div class="twn-b" data-notr>${esc(n.body)}</div>`:''}</div></a>`).join(''):'<p class="empty" style="padding:40px 24px">まだお知らせはありません。<br>いいね・返信・リポスト・フォローされると、ここに届きます。</p>';
    if(j.notifs.some(n=>n.id>j.seen))authFetch('/api/notifs/seen',{}).then(()=>notifBadge(0)).catch(()=>{});
    V.insertAdjacentHTML('afterbegin','<div id="nf-push"></div>');if(typeof pushRow==='function')pushRow(document.getElementById('nf-push'),true);
  }catch(e){V.innerHTML=`<div class="bnote" style="margin:16px">${esc(e.message)}</div>`}
}
/* 未読のお知らせの数を「コミュニティ」タブに出す（ログインしたことがある端末だけ、1分ごと） */
let notifN=0;
function notifBadge(n){
  notifN=n;
  document.querySelectorAll('.tb[data-k="community"]').forEach(t=>{let b=t.querySelector('.tb-badge');
    if(!n){b&&b.remove();return}if(!b){b=document.createElement('i');b.className='tb-badge';t.appendChild(b)}b.textContent=n>9?'9+':n});
  const c=document.getElementById('cm-notif-n');if(c)c.textContent=n?`未読 ${n}件`:'';
}
let notifAt=0;
async function notifPoll(){
  let was='';try{was=localStorage.getItem('pcin')||''}catch(e){}
  if(!PCF||!was||Date.now()-notifAt<55e3||document.hidden)return;notifAt=Date.now();
  try{if(!(await twAuth()))return;const j=await authFetch('/api/notifs/count');notifBadge(keyOf(cur)==='notif'?0:j.unread)}catch(e){}
}
setInterval(notifPoll,60e3);setTimeout(notifPoll,1500);

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
      <a class="row" href="#/dex"><span class="ttile-i">${SVG(I.dex,22)}</span><div class="row-m"><div class="row-t">図鑑をすべて見る</div><div class="row-s">${P.length}匹・タイプや役割で絞り込み</div></div><span class="chev">${SVG(I.chev,18)}</span></a>
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
  const exact=mons.find(p=>p.n===kata(t)||(p.ja&&p.ja===kata(t))||formInfo(p).base===kata(t)||p.n.toLowerCase()===t.toLowerCase());
  const top=exact||(mons.length===1?mons[0]:null),others=mons.filter(p=>p!==top).slice(0,5);
  res.innerHTML=`<div id="sr-live"></div>${top?`<a class="sr-mon" href="#/p/${top.no}"><span class="av">${stamp(top)}</span><div class="row-m">${nm(top,{big:true})}<div class="chips" style="margin-top:6px">${top.t.map(chip).join('')}</div>
      <div class="sr-st">${SN.map((n,i)=>`<span><small>${n}</small><b>${top.s[i]}</b></span>`).join('')}<span><small>合計</small><b>${top.bst}</b></span></div><div class="row-s" style="margin-top:4px">図鑑の詳しい画面を見る ›</div></div></a>`:''}
    ${others.length?`<div class="sec"><h2>${top?'ほかのポケモン':'ポケモン'}</h2></div>${others.map(p=>rowP(p)).join('')}`:''}
    ${guideSearch(q)}
    <div id="sr-users"></div><div class="sec"><h2>投稿</h2></div><div id="sr-list"></div>`;
  await twAuth();
  twFeed(document.getElementById('sr-list'),'/api/search?q='+encodeURIComponent(q),`「${esc(q)}」を含む投稿はまだありません。`);
  try{const j=await authFetch('/api/search?q='+encodeURIComponent(q));const el=document.getElementById('sr-users');
    if(el&&j.users&&j.users.length)el.innerHTML=`<div class="sec"><h2>トレーナー</h2></div>`+j.users.map(x=>`<a class="row" href="#/u/${esc(x.handle)}">${twAv(x)}<div class="row-m" data-notr><div class="row-t">${esc(x.name)}</div><div class="row-s">@${esc(x.handle)}${x.bio?'　'+esc(x.bio.slice(0,40)):''}</div></div></a>`).join('')}catch(e){}
}
