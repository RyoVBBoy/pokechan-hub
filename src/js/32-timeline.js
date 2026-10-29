/* ===================== タイムライン（投稿・フォロー・いいね・お知らせ） =====================
   #/tl（みんな）・#/tl/following（フォロー中）・#/u/ユーザーID（プロフィール）・#/n/投稿番号・#/notif（お知らせ）
   見るのはログインなしでもできる。投稿・いいね・フォローはログインしてプロフィールを作った人だけ。
   サーバー側は worker/src/social.js。 */
I.heart='<path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/>';
I.more='<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>';
I.bell='<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0"/>';
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
function twHtml(n){
  return `<article class="tw" data-id="${n.id}" data-h="${esc(n.user.handle)}" data-mine="${n.mine?1:0}">
    ${twAv(n.user)}
    <div class="tw-m"><div class="tw-h"><a href="#/u/${esc(n.user.handle)}" class="tw-who"><b>${esc(n.user.name)}</b><span>@${esc(n.user.handle)}</span></a><span class="tw-t">· ${ago(n.created_at)}</span>
      <button class="tw-more" data-more aria-label="そのほかの操作">${SVG(I.more,18)}</button></div>
      <div class="tw-b">${esc(n.body)}</div>
      <div class="tw-a"><button class="tw-like" data-like aria-pressed="${n.liked}" aria-label="いいね">${SVG(I.heart,18)}<span>${n.likes||''}</span></button></div>
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
      <textarea id="twc-t" rows="2" maxlength="${TW_MAX*2}" placeholder="いまどうしてる？（構築・対戦の感想など）"></textarea>
      <div class="twc-f"><span class="twc-n" id="twc-n"></span><button class="btn btn-p twc-b" id="twc-b" disabled>投稿する</button></div></div></div>`,
    bind(){
      const t=document.getElementById('twc-t'),b=document.getElementById('twc-b'),c=document.getElementById('twc-n');
      const upd=()=>{const n=[...t.value.trim()].length,left=TW_MAX-[...t.value].length;c.textContent=left<=20?left:'';c.classList.toggle('over',left<0);b.disabled=n<1||left<0;t.style.height='auto';t.style.height=t.scrollHeight+'px'};
      t.oninput=upd;
      b.onclick=async()=>{b.disabled=true;
        try{await authFetch('/api/notes',{body:t.value});t.value='';upd();toast('投稿しました');onDone()}catch(err){toast(err.message);upd()}};
    }};
}
let tlTab='all';
async function tlView(a){
  if(a==='following'||a==='all')tlTab=a;
  setHeader('タイムライン','#/community');
  V.innerHTML='<p class="empty">読み込み中…</p>';
  const prof=await twAuth();if(keyOf(cur)!=='tl')return;
  if(tlTab==='following'&&!prof)tlTab='all';
  const tabs=[['all','みんな'],['following','フォロー中']],ti=tabs.findIndex(x=>x[0]===tlTab);
  const comp=prof?twComposer(prof,()=>{if(tlTab!=='following')tlTab='all';twFeed(document.getElementById('tl-list'),'/api/tl?tab='+tlTab,'')}):null;
  V.innerHTML=`<div class="seg" id="tl-seg">${tabs.map(([k,l],i)=>`<button role="tab" aria-selected="${i===ti}" data-tab="${k}">${l}</button>`).join('')}<span class="seg-i" style="width:50%;transform:translateX(${ti*100}%)"></span></div>
    ${comp?comp.html:`<div class="bnote" style="margin:12px 16px">${AUTH.user?'投稿するには、<a href="#/account" style="color:var(--acc)">プロフィールを作って</a>ください。':'<a href="#/account" style="color:var(--acc)">ログイン</a>すると、投稿・いいね・フォローができます。見るだけならログインは不要です。'}</div>`}
    <div id="tl-list"></div>`;
  V.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{
    if(b.dataset.tab==='following'&&!prof){toast('フォロー中を見るにはログインしてください');return}
    tlTab=b.dataset.tab;setUrl('#/tl/'+tlTab);cur='#/tl/'+tlTab;tlView(tlTab)});
  if(comp)comp.bind();
  twFeed(document.getElementById('tl-list'),'/api/tl?tab='+tlTab,tlTab==='following'?'フォローしている人の投稿がここに出ます。<br>「みんな」から気になるトレーナーを探してフォローしてみましょう。':'まだ投稿がありません。最初の投稿をしてみましょう。');
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
    <h2 class="twp-n">${esc(u.name)}</h2><div class="twp-h">@${esc(u.handle)}${u.follows_me?'<span class="atag" style="margin-left:6px">フォローされています</span>':''}</div>
    ${u.bio?`<p class="twp-b">${esc(u.bio)}</p>`:''}
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
async function noteView(id){
  setHeader('投稿','#/tl');
  V.innerHTML='<p class="empty">読み込み中…</p>';
  await twAuth();if(keyOf(cur)!=='n')return;
  try{const j=await authFetch('/api/notes/'+(+id));V.innerHTML=`<div id="tw-one">${twHtml(j.note)}</div>`;twBind(V,()=>nav('#/tl'))}
  catch(e){V.innerHTML=`<div class="bnote" style="margin:16px">${esc(e.message)}</div>`}
}
async function notifView(){
  setHeader('お知らせ','#/community');
  V.innerHTML='<p class="empty">読み込み中…</p>';
  const prof=await twAuth();if(keyOf(cur)!=='notif')return;
  if(!prof){V.innerHTML=`<div class="bnote" style="margin:16px"><a href="#/account" style="color:var(--acc)">ログイン</a>すると、いいねやフォローのお知らせがここに届きます。</div>`;return}
  try{
    const j=await authFetch('/api/notifs');
    V.innerHTML=j.notifs.length?j.notifs.map(n=>`<a class="twn${n.id>j.seen?' new':''}" href="${n.kind==='like'&&n.note_id?'#/n/'+n.note_id:'#/u/'+esc(n.user.handle)}">
      <span class="twn-i twn-i--${n.kind}">${SVG(n.kind==='like'?I.heart:I.user,22)}</span>
      <div class="tw-m"><div><b>${esc(n.user.name)}</b> <span class="tw-t">@${esc(n.user.handle)}</span></div>
      <div>${n.kind==='like'?'あなたの投稿にいいねしました':'あなたをフォローしました'}<span class="tw-t">　${ago(n.created_at)}</span></div>
      ${n.body?`<div class="twn-b">${esc(n.body)}</div>`:''}</div></a>`).join(''):'<p class="empty" style="padding:40px 24px">まだお知らせはありません。<br>いいねやフォローされると、ここに届きます。</p>';
    if(j.notifs.some(n=>n.id>j.seen))authFetch('/api/notifs/seen',{}).then(()=>notifBadge(0)).catch(()=>{});
  }catch(e){V.innerHTML=`<div class="bnote" style="margin:16px">${esc(e.message)}</div>`}
}
/* 未読のお知らせの数を「みんな」タブに出す（ログインしたことがある端末だけ、1分ごと） */
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
