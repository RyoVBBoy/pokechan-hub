/* ===================== メッセージ（1対1・グループ）と非公開アカウント（2026/11/11 依頼主の要望） =====================
   下のメニューの5つ目＝「メッセージ」（#/messages）。前の「コミュニティ」は左のメニューから開く。
   ・#/messages：個人／グループの切りかえ（sessionStorage pcdmk）と「新しいメッセージ」
   ・#/messages/ID：1対1の会話（プロフィールの ✉ から）／#/messages/g/番号：グループ／#/messages/new：相手を選ぶ
   ・相手が非公開アカウント（鍵垢）で、許可されたフォロワーでも相手からフォローされてもいないときは、
     入力欄を止めて DM_LOCKED_T を出す（サーバー worker/src/dm.js も同じ条件で断る）
   ・外部のSNS・連絡先（URL・ID・メール・電話番号）は送れない。打っている間にも dmOutsideC で知らせる（サーバーの dmOutside と同じ決まり） */
const DM_LOCKED_T='このユーザーは非公開アカウントのためメッセージを送信できません';
const DM={timer:0,last:0,key:'',dmN:0};
const DM_SNS_C=['discord','ディスコ','でぃすこ','twitter','ツイッター','ついったー','instagram','インスタ','いんすた','tiktok','ティックトック','てぃっくとっく',
  'facebook','フェイスブック','kakao','カカオ','telegram','テレグラム','wechat','skype','スカイプ','snapchat','bluesky','threads.net','ラインid','ラインやって','ライン交換','らいん','lineid','x.com','gmail','icloud','yahoo','メアド','メールアドレス','電話番号','でんわばんごう'];
function dmOutsideC(text){
  const s=String(text).normalize('NFKC').toLowerCase();
  const z=s.replace(/[\s​-‍⁠﻿・･\-‐_*'"`|\/\\()（）「」【】]+/g,'');
  if(/https?:|www\.|:\/\/|[a-z0-9-]+\.(com|net|org|jp|gg|me|io|app|co|ly|tv|xyz|link|cc|be|info|biz|to|dev|page|site)\b/.test(s))return '外部のURL（リンク）は送れません。';
  if(/[a-z0-9._%+-]+@[a-z0-9-]+\.[a-z.]{2,}/.test(s))return 'メールアドレスは送れません。';
  if(DM_SNS_C.some(w=>z.includes(w))||/(^|[^a-z])line([^a-z]|$)/.test(s)||/(^|[^a-z])(dc|ig|insta|tw)\s*[:：]/.test(s))return '外部のSNS・連絡先の名前やIDは送れません。';
  if(/@[a-z0-9_.]{2,}/.test(s)||/(^|[^a-z])id\s*[:：は=]/.test(s))return 'IDは送れません。';
  if(/0\d{9,10}/.test(s.replace(/[\s\-‐ー()（）]/g,'')))return '電話番号は送れません。';
  return null;
}
/* ---- 非公開アカウント（鍵垢）の切りかえ：アカウントの画面と、左のメニューの「設定とプライバシー」 ---- */
function privRowHTML(p,compact){
  const on=!!(p&&p.private);
  return `<label class="pv-row${compact?' pv-row--c':''}">${SVG(I.lock,18)}<span class="pv-t"><b>アカウントを非公開にする（鍵垢）</b>
    <small>${on?'オン：投稿を見られるのは許可したフォロワーだけ。メッセージも、許可したフォロワーか自分がフォローしている人からしか届きません。':'オフ：だれでも投稿を見られ、メッセージを送れます。'}</small></span>
    <input type="checkbox" class="pv-sw" data-priv${on?' checked':''} role="switch" aria-checked="${on}"></label>`;
}
/* 設定の画面（65-settings.js）の「アカウント＆セキュリティ」の1行 */
const privSetRowHTML=p=>`<label class="dr-row pv-dr">${drRowIn(I.lock,'アカウントを非公開にする（鍵垢）','',`<input type="checkbox" class="pv-sw" data-priv${p&&p.private?' checked':''} role="switch" aria-checked="${!!(p&&p.private)}" aria-label="アカウントを非公開にする（鍵垢）">`)}</label>`;
function privRowBind(root){
  root.querySelectorAll('[data-priv]').forEach(cb=>cb.onchange=async()=>{
    const on=cb.checked;
    if(!on&&!await askConfirm({title:'アカウントを公開しますか？',text:'だれでも投稿を見られるようになり、待っているフォローのリクエストはすべて許可されます。',ok:'公開する',danger:false})){cb.checked=true;return}
    cb.disabled=true;
    try{await authFetch('/api/me/private',{on});if(AUTH.profile)AUTH.profile.private=on;haptic();
      toast(on?'アカウントを非公開にしました':'アカウントを公開しました');
      const row=cb.closest('.pv-row,.pv-dr');if(row)row.outerHTML=row.classList.contains('pv-dr')?privSetRowHTML(AUTH.profile):privRowHTML(AUTH.profile,row.classList.contains('pv-row--c'));privRowBind(root)}
    catch(e){cb.checked=!on;toast(e.message)}finally{cb.disabled=false}});
}
/* ---- 下のメニューの印（読んでいないメッセージの数） ---- */
function dmBadge(n){
  DM.dmN=n;
  document.querySelectorAll('.tb[data-k="messages"]').forEach(t=>{let b=t.querySelector('.tb-badge');
    if(!n){b&&b.remove();return}if(!b){b=document.createElement('i');b.className='tb-badge';t.appendChild(b)}b.textContent=n>9?'9+':n});
}
const dmAgo=t=>{const d=new Date(t),n=new Date();return d.toDateString()===n.toDateString()?`${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`:ago(t)};
const dmTime=t=>{const d=new Date(t);return `${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`};
const dmDay=t=>{const d=new Date(t),n=new Date();if(d.toDateString()===n.toDateString())return '今日';const y=new Date(n-864e5);if(d.toDateString()===y.toDateString())return '昨日';
  return `${d.getFullYear()!==n.getFullYear()?d.getFullYear()+'年':''}${d.getMonth()+1}月${d.getDate()}日`};
const dmAv=(u,sz)=>`<span class="tw-av dm-av" style="background:${avCol(u.handle||'')}${sz?`;width:${sz}px;height:${sz}px`:''}" data-notr>${avIn(u)}</span>`;
const dmGroupAv=c=>`<span class="dm-gav">${(c.members||[]).slice(0,2).map(u=>dmAv(u)).join('')||`<span class="tw-av dm-av">${SVG(I.user,18)}</span>`}</span>`;
function dmStop(){clearInterval(DM.timer);DM.timer=0;document.body.classList.remove('dm-talk')}
async function messagesView(){
  dmStop();
  const seg=cur.replace(/^#\/?/,'').split('/').slice(1);
  if(seg[0]==='new')return dmNewView();
  if(seg[0]==='g'&&/^\d+$/.test(seg[1]||''))return dmTalkView({conv:+seg[1]});
  if(seg[0]&&/^[A-Za-z0-9_]{3,15}$/.test(seg[0]))return dmTalkView({handle:seg[0]});
  return dmListView();
}
const dmKind=()=>{try{return sessionStorage.getItem('pcdmk')==='group'?'group':'dm'}catch(e){return 'dm'}};
function dmNeedLogin(prof){
  if(prof)return false;
  V.innerHTML=`<div class="dm-empty">${SVG(I.mail,40)}<b>メッセージ</b><span>ログインしてプロフィールを作ると、ほかのトレーナーと1対1やグループでメッセージをやりとりできます。</span>
    <a class="btn btn-p" href="#/account">${typeof AUTH!=='undefined'&&AUTH.user?'プロフィールを作る':'ログインする'}</a></div>`;
  return true;
}
async function dmListView(){
  setHeader('メッセージ');
  const kind=dmKind();
  V.innerHTML=`<div class="dm-top"><div class="dm-seg" role="tablist" aria-label="会話の種類">
      <button role="tab" data-dmk="dm" aria-selected="${kind==='dm'}">${SVG(I.user,16)}個人</button><button role="tab" data-dmk="group" aria-selected="${kind==='group'}">${SVG(I.grid,16)}グループ</button></div>
    <a class="btn btn-p dm-new" href="#/messages/new" aria-label="新しいメッセージ">${SVG(I.mail,17)}<span>新しいメッセージ</span></a></div>
    <div id="dm-push" class="dm-push"></div><div id="dm-list"><p class="empty">読み込み中…</p></div>`;
  V.querySelectorAll('[data-dmk]').forEach(b=>b.onclick=()=>{if(b.dataset.dmk===dmKind())return;try{sessionStorage.setItem('pcdmk',b.dataset.dmk)}catch(e){}haptic();dmListView()});
  const prof=await twAuth();if(keyOf(cur)!=='messages')return;
  const box=document.getElementById('dm-list');if(!box)return;
  if(!prof){V.querySelector('.dm-top').remove();dmNeedLogin(prof);return}
  /* この端末で通知がオフなら、オンにする欄を出す（オンなら何も出さない） */
  if(typeof pushRow==='function'){let w=0;const show=()=>{const el=document.getElementById('dm-push');if(!el)return;if(!PUSH.ready&&w++<15){setTimeout(show,200);return}pushResync();pushRow(el,true)};show()}
  try{
    const j=await authFetch('/api/dm?kind='+kind);if(!document.getElementById('dm-list'))return;
    box.innerHTML=j.convs.length?j.convs.map(c=>{
      const u=c.members[0]||{handle:'',name:'（退会したユーザー）'};
      const href=c.kind==='group'?'#/messages/g/'+c.id:'#/messages/'+esc(u.handle);
      const title=c.kind==='group'?esc(c.title):esc(u.name);
      const sub=c.kind==='group'?`${c.n}人`:`@${esc(u.handle)}`;
      return `<a class="row dm-row${c.unread?' dm-unread':''}" href="${href}">${c.kind==='group'?dmGroupAv(c):dmAv(u)}
        <div class="row-m"><div class="dm-l1"><b data-notr>${title}</b>${c.kind!=='group'&&u.private?SVG(I.lock,13):''}<span class="tw-t" data-notr>${sub}</span><span class="dm-at">${dmAgo(c.last_at)}</span></div>
        <div class="dm-l2" data-notr>${c.last_mine?'<span class="dm-you">あなた：</span>':''}${esc(c.last)}</div></div>${c.unread?`<i class="dm-badge">${c.unread}</i>`:''}</a>`}).join('')
      :`<div class="dm-empty">${SVG(kind==='group'?I.grid:I.mail,36)}<b>${kind==='group'?'グループはまだありません':'メッセージはまだありません'}</b>
        <span>${kind==='group'?'「新しいメッセージ」から、メンバーを選んでグループを作れます。':'トレーナーのプロフィールの ✉ か「新しいメッセージ」から送れます。'}</span></div>`;
  }catch(e){box.innerHTML=`<div class="bnote" style="margin:16px">${esc(e.message)}</div>`}
}
/* ---- 相手を選ぶ（個人は1人、グループは複数＋名前） ---- */
async function dmNewView(){
  const kind=dmKind();
  setHeader(kind==='group'?'グループを作る':'新しいメッセージ','#/messages');
  const prof=await twAuth();if(keyOf(cur)!=='messages')return;
  if(dmNeedLogin(prof))return;
  const sel=new Map();
  V.innerHTML=`<div class="dm-seg dm-seg--w" role="tablist" aria-label="会話の種類" style="margin:12px 16px 0">
      <button role="tab" data-dmk="dm" aria-selected="${kind==='dm'}">${SVG(I.user,16)}個人</button><button role="tab" data-dmk="group" aria-selected="${kind==='group'}">${SVG(I.grid,16)}グループ</button></div>
    ${kind==='group'?`<div class="cform" style="padding:12px 16px 0"><label>グループの名前（30文字まで）<input id="dm-gt" maxlength="30" placeholder="例：構築相談の会"></label></div><div id="dm-sel" class="dm-sel"></div>`:''}
    <div class="srch" style="margin:12px 16px">${SVG(I.search,18)}<input id="dm-q" placeholder="名前かユーザーIDで探す" autocomplete="off" aria-label="相手を探す"></div>
    <div id="dm-res"><p class="note" style="color:var(--mute)">${kind==='group'?'メンバーにする人を探して選んでください（自分を入れて20人まで）。':'メッセージを送る相手を探してください。'}</p></div>
    ${kind==='group'?`<div class="btns"><button class="btn btn-p" id="dm-mk" disabled>グループを作る</button></div><div id="dm-msg"></div>`:''}`;
  V.querySelectorAll('[data-dmk]').forEach(b=>b.onclick=()=>{try{sessionStorage.setItem('pcdmk',b.dataset.dmk)}catch(e){}dmNewView()});
  const q=document.getElementById('dm-q'),res=document.getElementById('dm-res');
  const drawSel=()=>{const el=document.getElementById('dm-sel');if(!el)return;
    el.innerHTML=[...sel.values()].map(u=>`<button class="dm-chip" data-un="${esc(u.handle)}" data-notr>${esc(u.name)} ×</button>`).join('');
    el.querySelectorAll('[data-un]').forEach(b=>b.onclick=()=>{sel.delete(b.dataset.un);drawSel();search()});
    document.getElementById('dm-mk').disabled=!sel.size};
  let tm=0,seq=0;
  const search=async()=>{const v=q.value.trim();if(!v)return;const my=++seq;
    try{const j=await authFetch('/api/search?q='+encodeURIComponent(v.replace(/^[#＃@]/,'')));if(my!==seq)return;
      const us=(j.users||[]).filter(u=>u.handle!==prof.handle);
      res.innerHTML=us.length?us.map(u=>`<button class="row dm-pick" data-h="${esc(u.handle)}">${dmAv(u)}<div class="row-m"><div class="dm-l1"><b data-notr>${esc(u.name)}</b>${u.private?SVG(I.lock,13):''}<span class="tw-t" data-notr>@${esc(u.handle)}</span></div>
        ${u.bio?`<div class="dm-l2" data-notr>${esc(u.bio)}</div>`:''}</div>${kind==='group'?`<span class="dm-ck${sel.has(u.handle)?' on':''}">${sel.has(u.handle)?'✓':''}</span>`:''}</button>`).join('')
        :'<p class="empty">見つかりませんでした。</p>';
      res.querySelectorAll('[data-h]').forEach(b=>b.onclick=()=>{const u=us.find(x=>x.handle===b.dataset.h);
        if(kind!=='group'){nav('#/messages/'+u.handle);return}
        if(sel.has(u.handle))sel.delete(u.handle);else{if(sel.size>=19){toast('グループは20人までです');return}sel.set(u.handle,u)}
        drawSel();search()});
    }catch(e){res.innerHTML=`<div class="bnote" style="margin:16px">${esc(e.message)}</div>`}};
  q.oninput=()=>{clearTimeout(tm);tm=setTimeout(search,250)};
  q.onkeydown=e=>{if(e.key==='Enter'){clearTimeout(tm);search()}};
  const mk=document.getElementById('dm-mk');
  if(mk)mk.onclick=async()=>{const title=document.getElementById('dm-gt').value.trim(),msg=document.getElementById('dm-msg');
    if(!title){msg.innerHTML='<div class="bnote" style="margin:8px 16px">グループの名前を入れてください。</div>';return}
    mk.disabled=true;
    try{const j=await authFetch('/api/dm/group',{title,handles:[...sel.keys()]});toast('グループを作りました');nav('#/messages/g/'+j.conv)}
    catch(e){msg.innerHTML=`<div class="bnote" style="margin:8px 16px">${esc(e.message)}</div>`;mk.disabled=false}};
  setTimeout(()=>q.focus(),60);
}
/* ---- 会話の画面 ---- */
function dmBubbles(msgs,group,prevAt){
  let out='',pd=prevAt?dmDay(prevAt):'',pu='';
  for(const m of msgs){
    const d=dmDay(m.created_at);if(d!==pd){out+=`<div class="dm-day"><span>${d}</span></div>`;pd=d;pu=''}
    const who=m.user?m.user.handle:'';
    out+=`<div class="dm-m${m.mine?' me':''}" data-id="${m.id}">${!m.mine&&group&&who!==pu?`<div class="dm-who" data-notr>${esc(m.user?m.user.name:'（退会したユーザー）')}</div>`:''}
      <div class="dm-b" data-notr>${esc(m.body).replace(/\n/g,'<br>')}</div><div class="dm-tm">${dmTime(m.created_at)}</div></div>`;
    pu=m.mine?'':who;
  }
  return out;
}
async function dmTalkView(o){
  setHeader('メッセージ','#/messages');
  V.innerHTML='<p class="empty">読み込み中…</p>';
  const here=cur;const prof=await twAuth();if(cur!==here)return;
  if(dmNeedLogin(prof))return;
  if(o.handle&&o.handle.toLowerCase()===prof.handle.toLowerCase()){V.innerHTML='<p class="empty">自分にはメッセージを送れません。</p>';return}
  let j;
  try{j=await authFetch(o.conv?'/api/dm/'+o.conv:'/api/dm/with/'+o.handle)}catch(e){if(cur===here)V.innerHTML=`<div class="bnote" style="margin:16px">${esc(e.message)}</div>`;return}
  if(cur!==here)return;
  const group=!!j.conv&&typeof j.conv==='object';
  const u=j.user,conv=group?j.conv.id:j.conv;
  let convId=conv,lastId=j.msgs.length?j.msgs[j.msgs.length-1].id:0,lastAt=j.msgs.length?j.msgs[j.msgs.length-1].created_at:0;
  setHeader(group?esc(j.conv.title):esc(u.name),'#/messages');
  document.body.classList.add('dm-talk');
  const head=group?`<div class="dm-peer"><span class="dm-gav">${j.conv.members.slice(0,3).map(x=>dmAv(x)).join('')}</span><div class="row-m"><b data-notr>${esc(j.conv.title)}</b>
      <span class="tw-t" data-notr>${j.conv.members.length+1}人：あなた・${j.conv.members.map(x=>esc(x.name)).join('・')}</span></div><button class="btn btn-s dm-leave" id="dm-leave">抜ける</button></div>`
    :`<a class="dm-peer" href="#/u/${esc(u.handle)}">${dmAv(u,40)}<div class="row-m"><b data-notr>${esc(u.name)}${u.private?SVG(I.lock,14):''}</b><span class="tw-t" data-notr>@${esc(u.handle)}${u.private?'・非公開アカウント':''}</span></div><span class="chev">${SVG(I.chev,18)}</span></a>`;
  const lock=!j.can;
  V.innerHTML=`<div class="dm-talkv">${head}
    <div class="dm-log" id="dm-log">${j.more?'<button class="bback dm-older" id="dm-older">前のメッセージを読む</button>':''}${j.msgs.length?dmBubbles(j.msgs,group):`<div class="dm-first">${lock?'':`<b>${group?'グループを作りました':esc(u.name)+'さんとのメッセージ'}</b><span>最初のメッセージを送ってみましょう。対戦の相談やあいさつなど、このサイトの中でやりとりしてください。</span>`}</div>`}</div>
    <div class="dm-safe">${SVG(I.lock,13)}外部のSNS・連絡先（URL・ID・メール・電話番号）は送れません。知らない人に個人情報を教えないでください。</div>
    <div class="dm-comp${lock?' locked':''}">
      ${lock?`<div class="dm-lock" role="alert">${SVG(I.lock,20)}<div><b>${esc(j.reason||DM_LOCKED_T)}</b>${j.reason===DM_LOCKED_T||!j.reason?`<span>フォローのリクエストを送り、許可されるとメッセージを送れるようになります。</span><a class="btn btn-s" href="#/u/${esc(u.handle)}" style="margin-top:8px">プロフィールを見る</a>`:''}</div></div>`:''}
      <div class="dm-in"><textarea id="dm-t" rows="1" maxlength="500" placeholder="${lock?'送信できません':'メッセージを入力'}" aria-label="メッセージ" ${lock?'disabled':''}></textarea>
      <button class="dm-send" id="dm-send" aria-label="送信" disabled>${SVG('<path d="M4 12 20 4l-6.5 16-2.6-6.9z"/><path d="m10.9 13.1 4.6-4.6"/>',20)}</button></div>
      <div class="dm-warn" id="dm-warn" role="status"></div></div></div>`;
  const log=document.getElementById('dm-log'),ta=document.getElementById('dm-t'),sb=document.getElementById('dm-send'),warn=document.getElementById('dm-warn');
  const toBottom=()=>scrTo(0,SCROLLER.scrollHeight);
  requestAnimationFrame(toBottom);
  const check=()=>{const v=ta.value.trim(),w=v?dmOutsideC(v):null;warn.textContent=w?w+'（このサイトの中でやりとりしてください）':[...ta.value].length>450?`あと${500-[...ta.value].length}文字`:'';
    warn.classList.toggle('bad',!!w);sb.disabled=lock||!v||!!w;
    ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight,140)+'px'};
  ta.oninput=check;
  ta.onkeydown=e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();sb.click()}};
  const add=msgs=>{if(!msgs.length)return;const f=log.querySelector('.dm-first');if(f)f.remove();
    const near=SCROLLER.scrollHeight-scrY()-SCROLLER.clientHeight<160;
    log.insertAdjacentHTML('beforeend',dmBubbles(msgs.filter(m=>!log.querySelector(`[data-id="${m.id}"]`)),group,lastAt));
    lastId=Math.max(lastId,...msgs.map(m=>m.id));lastAt=msgs[msgs.length-1].created_at;if(near)toBottom()};
  sb.onclick=async()=>{const v=ta.value.trim();if(!v||sb.disabled)return;sb.disabled=true;
    try{const r=await authFetch('/api/dm/send',convId?{conv:convId,body:v}:{to:u.handle,body:v});convId=r.conv;ta.value='';check();add([r.msg]);toBottom();haptic()}
    catch(e){if(e.status===403&&e.message===DM_LOCKED_T){dmTalkView(o);return}warn.textContent=e.message;warn.classList.add('bad');sb.disabled=false}};
  const ol=document.getElementById('dm-older');
  if(ol)ol.onclick=async()=>{const first=log.querySelector('.dm-m');const b=first?+first.dataset.id:0;ol.disabled=true;
    try{const r=await authFetch((group?'/api/dm/'+conv:'/api/dm/with/'+u.handle)+'?before='+b);const h0=SCROLLER.scrollHeight,y0=scrY();
      ol.insertAdjacentHTML('afterend',dmBubbles(r.msgs,group));if(!r.more)ol.remove();else ol.disabled=false;scrTo(0,y0+SCROLLER.scrollHeight-h0)}catch(e){toast(e.message);ol.disabled=false}};
  const lv=document.getElementById('dm-leave');
  if(lv)lv.onclick=async()=>{if(!await askConfirm({title:'グループを抜けますか？',text:'抜けると、このグループのメッセージは見られなくなります。',ok:'抜ける'}))return;
    try{await authFetch('/api/dm/'+conv+'/leave',{});toast('グループを抜けました');nav('#/messages')}catch(e){toast(e.message)}};
  /* 新しいメッセージを4秒ごとに読む（この画面を開いている間だけ） */
  const poll=async()=>{if(cur!==here){dmStop();return}if(document.hidden||!convId)return;
    try{const r=await authFetch((group?'/api/dm/'+conv:'/api/dm/with/'+u.handle)+'?after='+lastId);if(cur===here)add(r.msgs)}catch(e){}};
  DM.timer=setInterval(poll,4e3);
  dmBadgeRefresh();
}
async function dmBadgeRefresh(){try{if(!(AUTH&&AUTH.profile))return;const j=await authFetch('/api/dm/unread');dmBadge(j.unread)}catch(e){}}
