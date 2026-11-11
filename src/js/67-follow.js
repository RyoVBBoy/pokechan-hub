/* ===================== フォロー中・フォロワーの一覧とフォローのリクエスト（2026/11/11 依頼主の要望） =====================
   ・#/u/ID/following・#/u/ID/followers：プロフィールの「〇 フォロー中」「〇 フォロワー」を押すと開く。上の切りかえで行き来できる。
     非公開アカウントは本人と許可されたフォロワーだけが見られる（サーバー GET /api/u/ID/follows?kind=）
   ・#/requests：届いたフォローのリクエストを「許可する／断る」、送ったリクエストを「取り消す」（GET /api/follow/requests・POST /api/follow/answer）。
     入口は、自分のプロフィール・お知らせの画面の上・左のメニュー（届いているときだけ）・設定の「アカウント＆セキュリティ」 */
let FREQ_N=0;
function freqBadge(n){
  FREQ_N=n;
  const d=document.getElementById('dr-fq');if(d)d.textContent=n?(n>9?'9+':n):'';
  const r=document.getElementById('dr-fqrow');if(r)r.hidden=!n;
  const b=document.getElementById('nf-fq');if(b){b.hidden=!n;const c=b.querySelector('b.num');if(c)c.textContent=n}
  const p=document.getElementById('pf-fq-n');if(p)p.textContent=n?n+'件':'';
}
const fwRowHTML=(x,o={})=>`<div class="fw-row" data-fh="${esc(x.handle)}">
  <a class="fw-a" href="#/u/${esc(x.handle)}">${dmAv(x)}<div class="row-m"><div class="dm-l1"><b data-notr>${esc(x.name)}</b>${x.private?SVG(I.lock,13):''}</div>
    <div class="fw-h"><span class="tw-t" data-notr>@${esc(x.handle)}</span>${x.follows_me&&!o.req?'<span class="pf-fm">フォローされています</span>':''}</div>
    ${x.bio?`<div class="fw-bio" data-notr>${esc(x.bio)}</div>`:''}</div></a>
  ${o.btns||''}</div>`;
const fwFollowBtn=x=>x.me||!(typeof AUTH!=='undefined'&&AUTH.profile)?'':`<button class="btn ${x.followed||x.requested?'btn-s':'btn-p'} fw-b" data-ff="${esc(x.handle)}">${pfFollowTxt(x)}</button>`;
/* 行をたたんで消す（許可・断る・取り消すのあと）。高さを0にしながら薄くする＝なめらか */
function fwCollapse(row,done){
  if(reduceMotion){row.remove();done&&done();return}
  row.style.height=row.offsetHeight+'px';row.style.overflow='hidden';
  requestAnimationFrame(()=>{row.classList.add('fw-out');row.style.height='0px'});
  setTimeout(()=>{row.remove();done&&done()},300);
}
async function followListView(h,kind){
  const fl=kind==='followers';
  setHeader('読み込み中…','#/u/'+h);
  V.innerHTML=`<div class="fw-seg" role="tablist" aria-label="フォローの一覧">
      <a role="tab" href="#/u/${esc(h)}/following" aria-selected="${!fl}">フォロー中</a><a role="tab" href="#/u/${esc(h)}/followers" aria-selected="${fl}">フォロワー</a></div>
    <div id="fw-list"><p class="empty">読み込み中…</p></div>`;
  V.querySelectorAll('.fw-seg a').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();if(a.getAttribute('aria-selected')==='true')return;haptic();setUrl(a.getAttribute('href'),false);cur=a.getAttribute('href');followListView(h,a.getAttribute('href').endsWith('followers')?'followers':'following')}));
  const here=cur;await twAuth();if(cur!==here)return;
  let u=null;try{u=(await authFetch('/api/u/'+h)).user}catch(e){V.innerHTML=`<div class="bnote" style="margin:16px">${esc(e.message)}</div>`;return}
  if(cur!==here)return;
  setHeader(esc(u.name),'#/u/'+u.handle);
  const tabs=V.querySelectorAll('.fw-seg a');tabs[0].innerHTML=`<b class="num">${pfNum(u.following)}</b> フォロー中`;tabs[1].innerHTML=`<b class="num">${pfNum(u.followers)}</b> フォロワー`;
  const box=document.getElementById('fw-list');
  const load=async(before,append)=>{
    let j;try{j=await authFetch(`/api/u/${u.handle}/follows?kind=${fl?'followers':'following'}${before?'&before='+before:''}`)}catch(e){box.innerHTML=`<div class="bnote" style="margin:16px">${esc(e.message)}</div>`;return}
    if(cur!==here)return;
    if(j.locked){box.innerHTML=`<div class="pf-locked">${SVG(I.lock,30)}<b>このアカウントは非公開です</b><span>フォローが許可されると、フォロー中・フォロワーの一覧も見られます。</span></div>`;return}
    const html=j.users.map(x=>fwRowHTML(x,{btns:fwFollowBtn(x)})).join('');
    const more=j.next?`<button class="bback fw-more" data-more="${j.next}">もっと見る</button>`:'';
    if(append){box.querySelector('.fw-more')?.remove();box.insertAdjacentHTML('beforeend',html+more)}
    else box.innerHTML=j.users.length?`<div class="fw-card">${html}</div>${more}`:`<div class="dm-empty">${SVG(I.user,34)}<b>${fl?'まだフォロワーはいません':'まだだれもフォローしていません'}</b></div>`;
    if(append){const c=box.querySelector('.fw-card');if(c)box.querySelectorAll(':scope > .fw-row').forEach(r=>c.appendChild(r))}
  };
  box.onclick=async e=>{
    const mb=e.target.closest('[data-more]');if(mb){mb.disabled=true;load(mb.dataset.more,true);return}
    const fb=e.target.closest('[data-ff]');if(!fb)return;
    const x={handle:fb.dataset.ff,followed:fb.textContent==='フォロー中',requested:fb.textContent==='リクエスト中',private:fb.textContent==='フォローをリクエスト'||fb.textContent==='リクエスト中'};
    if(x.followed&&!await askConfirm({title:`@${x.handle} のフォローをやめますか？`,text:'あとからもう一度フォローできます。',ok:'フォローをやめる'}))return;
    fb.disabled=true;
    try{const j=await authFetch('/api/follow',{handle:x.handle,on:!x.followed&&!x.requested});x.followed=j.followed;x.requested=!!j.requested;fb.textContent=pfFollowTxt(x);fb.className='btn '+(j.followed||j.requested?'btn-s':'btn-p')+' fw-b';haptic()}
    catch(er){toast(er.message)}finally{fb.disabled=false}};
  load(0,false);
}
async function requestsView(quiet){
  let tab='in';try{if(sessionStorage.getItem('pcfqt')==='sent')tab='sent'}catch(e){}
  setHeader('フォローリクエスト','#/notif');
  const here=cur;if(quiet!==true)V.innerHTML='<p class="empty">読み込み中…</p>';
  const prof=await twAuth();if(cur!==here)return;
  if(!prof){V.innerHTML=`<div class="bnote" style="margin:16px"><a href="#/account" style="color:var(--acc)">ログイン</a>すると、フォローのリクエストを確かめられます。</div>`;return}
  let j;try{j=await authFetch('/api/follow/requests')}catch(e){V.innerHTML=`<div class="bnote" style="margin:16px">${esc(e.message)}</div>`;return}
  if(cur!==here)return;
  freqBadge(j.incoming.length);
  const draw=()=>{
    const list=tab==='in'?j.incoming:j.sent;
    V.innerHTML=`<div class="fw-seg" role="tablist" aria-label="フォローのリクエスト">
        <button role="tab" data-fqt="in" aria-selected="${tab==='in'}">届いたリクエスト${j.incoming.length?`<i class="fw-n">${j.incoming.length}</i>`:''}</button><button role="tab" data-fqt="sent" aria-selected="${tab==='sent'}">送ったリクエスト</button></div>
      ${tab==='in'?`<p class="note fw-note">${prof.private?'あなたのアカウントは非公開です。許可した人だけが投稿を見られ、メッセージを送れます。':'あなたのアカウントは公開中です（新しいリクエストは届きません）。非公開にするには「設定とプライバシー」→「アカウントを非公開にする（鍵垢）」。'}</p>`:''}
      <div id="fq-list">${list.length?`<div class="fw-card">${list.map(x=>fwRowHTML(x,{req:true,btns:tab==='in'
        ?`<div class="fw-bs"><button class="btn btn-p fw-b" data-ok="1">許可する</button><button class="btn btn-s fw-b" data-ok="0">断る</button></div>`
        :`<button class="btn btn-s fw-b" data-cancel>取り消す</button>`})).join('')}</div>`
        :`<div class="dm-empty">${SVG(I.user,34)}<b>${tab==='in'?'届いているリクエストはありません':'送ったリクエストはありません'}</b><span>${tab==='in'?'非公開アカウントをフォローしたい人からのリクエストが、ここに届きます。':'非公開アカウントにフォローのリクエストを送ると、許可されるまでここに出ます。'}</span></div>`}</div>`;
    V.querySelectorAll('[data-fqt]').forEach(b=>b.onclick=()=>{if(b.dataset.fqt===tab)return;tab=b.dataset.fqt;try{sessionStorage.setItem('pcfqt',tab)}catch(e){}haptic();draw()});
  };
  draw();
  V.onclick=async e=>{
    const b=e.target.closest('[data-ok],[data-cancel]');if(!b)return;
    const row=b.closest('[data-fh]'),h=row.dataset.fh;row.querySelectorAll('button').forEach(x=>x.disabled=true);
    try{
      if(b.dataset.cancel!==undefined){await authFetch('/api/follow',{handle:h,on:false});toast(`@${h} へのリクエストを取り消しました`);j.sent=j.sent.filter(x=>x.handle!==h)}
      else{const ok=b.dataset.ok==='1';await authFetch('/api/follow/answer',{handle:h,ok});toast(ok?`@${h} のフォローを許可しました`:`@${h} のリクエストを断りました`);j.incoming=j.incoming.filter(x=>x.handle!==h);freqBadge(j.incoming.length)}
      haptic();fwCollapse(row,()=>{const c=V.querySelector('.fw-card');if(c&&!c.children.length)draw();else{const n=V.querySelector('.fw-n');if(n)n.textContent=j.incoming.length||'';}});
    }catch(er){toast(er.message);row.querySelectorAll('button').forEach(x=>x.disabled=false)}};
}
