/* ===================== プロフィール画面＝トレーナーカード（2026/11/05 依頼主の要望：ほかの SNS を参考にしつつ、このサイトにしかない画面） =====================
   ・上の帯は「相棒のポケモン」のタイプの色。右に相棒の種族値の形を大きく透かし、六角形の模様を重ねる（相棒がいなければ、その人の色）
   ・アイコンは丸（人）。ふちは相棒のタイプの色の輪
   ・名前・@ID・自己紹介、相棒の札・はじめた月
   ・数字はガラスのカード1枚に：投稿・フォロワー・フォロー中・もらったいいね
   ・シーズンの実績（resultBadges）
   ・看板パーティ：6匹の形（六角形＝ポケモン）。押すとそのパーティの画面（#/share/…）
   ・下は「投稿／画像」の切りかえ
   相棒と看板パーティは POST /api/me/card で保存（自分の画面の「カードを編集」から） */
const PF_I={
  cal:'<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  img:'<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M20 16l-5-5-8.5 8.5"/>',
  post:'<path d="M5 5h14v10H9l-4 4z"/>'
};
const pfMonth=t=>{const d=new Date(t||Date.now());return LANG==='en'?d.toLocaleDateString('en-US',{year:'numeric',month:'short'}):`${d.getFullYear()}年${d.getMonth()+1}月`};
const pfNum=n=>n>=10000?(n/10000).toFixed(n>=100000?0:1)+'万':String(n||0);
/* 帯の色：相棒のタイプ2色。いなければ名前ごとの色とテーマの色 */
function pfColors(u){
  const p=u.partner&&byNo[u.partner];
  if(p)return [COL[p.t[0]],COL[p.t[1]||p.t[0]],p];
  return [avCol(u.handle),'var(--accf)',null];
}
function pfCover(u){
  const [c1,c2,p]=pfColors(u);
  /* 相棒の種族値の形を大きく、白で透かす */
  const big=p?`<svg class="pf-big" viewBox="-100 -100 200 200" aria-hidden="true"><polygon points="${AXO.map((si,k)=>polar(k,92).map(n=>n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1.2"/>`
    +`<polygon points="${AXO.map((si,k)=>polar(k,92*Math.min(1,Math.max(.08,p.s[si]/150))).map(n=>n.toFixed(1)).join(',')).join(' ')}" fill="rgba(255,255,255,.22)" stroke="rgba(255,255,255,.55)" stroke-width="2" stroke-linejoin="round"/></svg>`:'';
  return `<div class="pf-cover" style="--c1:${c1};--c2:${c2}">${big}</div>`;
}
function pfShowcase(u){
  const sc=u.showcase;
  if(!sc||!Array.isArray(sc.t)||!sc.t.length){
    return u.me?`<button class="pf-empty" id="pf-edit2">${SVG(PF_I.edit,18)}<span><b>看板パーティを選ぶ</b><small>自分のパーティから1つ選ぶと、ここに6匹が並びます</small></span></button>`:'';
  }
  const ms=sc.t.map(no=>byNo[no]).filter(Boolean);
  return `<section class="pf-card pf-sc">
    <div class="pf-sc-h"><b>看板パーティ</b>${sc.n?`<span data-notr>${esc(sc.n)}</span>`:''}${u.me?`<button class="pf-sc-ed" id="pf-edit4">${SVG(PF_I.edit,14)}編集</button>`:''}</div>
    <div class="pf-sc-g">${ms.map(p=>`<a class="pf-mon" href="#/p/${p.no}" style="--t1:${COL[p.t[0]]}"><span class="pf-mon-s">${stamp(p)}</span><span class="pf-mon-n">${esc(p.n)}</span></a>`).join('')}</div>
    <a class="pf-sc-go" href="#/share/${ms.map(p=>p.no).join('-')}">このパーティを見る ${SVG(I.chev,16)}</a>
  </section>`;
}
async function userView(h){
  setHeader('プロフィール','#/tl');
  if(!/^[A-Za-z0-9_]{3,15}$/.test(h||'')){V.innerHTML='<p class="empty">ユーザーが見つかりません。</p>';return}
  V.innerHTML='<p class="empty">読み込み中…</p>';
  await twAuth();if(keyOf(cur)!=='u')return;
  let u;try{u=(await authFetch('/api/u/'+h)).user}catch(e){V.innerHTML=`<div class="bnote" style="margin:16px">${esc(e.message)}</div>`;return}
  setHeader(esc(u.name),'#/tl');
  const isMuted=muted().has(u.handle.toLowerCase());
  const [c1,c2,pp]=pfColors(u);
  V.innerHTML=`<div class="pf">
    ${pfCover(u)}
    <div class="pf-head">
      <div class="pf-row">
        <span class="pf-av" style="--c1:${c1};--c2:${c2}"><span class="ac-av" style="background:${avCol(u.handle)}" data-notr>${avIn(u)}</span></span>
        <div class="pf-btns">
          <button class="pf-ic" id="pf-share" aria-label="プロフィールのリンクをコピー">${SVG(PF_I.link,19)}</button>
          ${u.me?`<a class="btn btn-s pf-b" href="#/account">プロフィールを編集</a>`
            :`<button class="btn ${u.followed?'btn-s':'btn-p'} pf-b" id="twp-f">${u.followed?'フォロー中':'フォローする'}</button>`}
        </div>
      </div>
      <h2 class="pf-n" data-notr>${esc(u.name)}</h2>
      <div class="pf-h">@${esc(u.handle)}${u.follows_me?'<span class="pf-fm">フォローされています</span>':''}</div>
      ${u.bio?`<p class="pf-bio" data-notr>${linkTags(u.bio)}</p>`:''}
      <div class="pf-meta">
        ${pp?(u.me?`<button class="pf-chip" id="pf-edit" style="--t1:${COL[pp.t[0]]}"><span class="pf-chip-s">${stamp(pp)}</span>相棒 <b>${esc(pp.n)}</b>${SVG(PF_I.edit,13)}</button>`:`<a class="pf-chip" href="#/p/${pp.no}" style="--t1:${COL[pp.t[0]]}"><span class="pf-chip-s">${stamp(pp)}</span>相棒 <b>${esc(pp.n)}</b></a>`):(u.me?`<button class="pf-chip pf-chip--add" id="pf-edit3">＋ 相棒を選ぶ</button>`:'')}
        <span class="pf-since">${SVG(PF_I.cal,15)}${pfMonth(u.created_at)}からトレーナー</span>
      </div>
    </div>
    <div class="pf-card pf-stats">
      <div><b class="num">${pfNum(u.notes)}</b><span>投稿</span></div>
      <div><b class="num" id="twp-fc">${pfNum(u.followers)}</b><span>フォロワー</span></div>
      <div><b class="num">${pfNum(u.following)}</b><span>フォロー中</span></div>
      <div><b class="num">${pfNum(u.liked)}</b><span>もらったいいね</span></div>
    </div>
    ${(u.results||[]).length?`<div class="pf-res">${resultBadges(u.results)}</div>`:''}
    ${pfShowcase(u)}
    ${isMuted?`<div class="bnote" style="margin:8px 12px 0">この人の投稿は、あなたの画面では表示しない設定です。<button class="bback" id="twp-um" style="padding:0">表示する</button></div>`:''}
    <div class="pf-tabs" role="tablist"><button role="tab" aria-selected="true" data-pt="all">${SVG(PF_I.post,17)}投稿</button><button role="tab" aria-selected="false" data-pt="media">${SVG(PF_I.img,17)}画像</button></div>
  </div><div id="twp-list"></div>`;
  /* フォロー */
  const fb=document.getElementById('twp-f');
  if(fb)fb.onclick=async()=>{
    if(!AUTH.profile){toast(AUTH.user?'先にプロフィールを作ってください':'フォローするにはログインしてください');nav('#/account');return}
    const on=fb.textContent!=='フォロー中';fb.disabled=true;
    try{const j=await authFetch('/api/follow',{handle:u.handle,on});fb.textContent=j.followed?'フォロー中':'フォローする';fb.className='btn '+(j.followed?'btn-s':'btn-p')+' pf-b';document.getElementById('twp-fc').textContent=pfNum(j.followers)}
    catch(e){toast(e.message)}finally{fb.disabled=false}};
  /* リンクのコピー */
  document.getElementById('pf-share').onclick=()=>{const url=SITE_BASE()+'/#/u/'+u.handle;
    (navigator.clipboard?navigator.clipboard.writeText(url):Promise.reject()).then(()=>toast('プロフィールのリンクをコピーしました')).catch(()=>prompt('リンクをコピーしてください',url))};
  ['pf-edit','pf-edit2','pf-edit3','pf-edit4'].forEach(id=>{const b=document.getElementById(id);if(b)b.onclick=()=>pfEdit(u,()=>userView(h))});
  const um=document.getElementById('twp-um');if(um)um.onclick=()=>{const s=muted();s.delete(u.handle.toLowerCase());lsW('pcmute',[...s]);userView(h)};
  /* 投稿／画像 */
  const list=document.getElementById('twp-list');
  const load=t=>{if(isMuted)return;list.innerHTML='';twFeed(list,`/api/u/${u.handle}/notes${t==='media'?'?media=1':''}`,t==='media'?'まだ画像つきの投稿がありません。':'まだ投稿がありません。')};
  V.querySelectorAll('[data-pt]').forEach(b=>b.onclick=()=>{if(b.getAttribute('aria-selected')==='true')return;
    V.querySelectorAll('[data-pt]').forEach(x=>x.setAttribute('aria-selected',String(x===b)));load(b.dataset.pt)});
  load('all');
}
/* カードを編集：相棒と看板パーティ */
function pfEdit(u,done){
  let partner=u.partner||null,sc=u.showcase&&u.showcase.t?{n:u.showcase.n||'',t:u.showcase.t.slice()}:null;
  const teams=(typeof TEAMS!=='undefined'?TEAMS.list:[]).map((x,i)=>({i,n:teamName(i),t:(i===TEAMS.cur?team:x.team).map(m=>m.no).filter(no=>byNo[no])})).filter(x=>x.t.length);
  const o=document.createElement('div');o.className='psheet';
  const draw=()=>{
    const p=partner&&byNo[partner];
    o.innerHTML=`<div class="psheet-bg"></div><div class="psheet-p pf-ed" role="dialog" aria-modal="true" aria-label="トレーナーカードを編集">
      <h3>トレーナーカードを編集</h3>
      <div class="pf-ed-l">相棒のポケモン</div>
      <p class="note" style="padding:0 0 8px">プロフィールの上の帯が、相棒のタイプの色になります。</p>
      <div class="pf-ed-p">${p?`<span class="pf-chip" style="--t1:${COL[p.t[0]]}"><span class="pf-chip-s">${stamp(p)}</span><b>${esc(p.n)}</b></span>`:'<span class="note" style="padding:0">まだ選んでいません</span>'}
        <button class="btn btn-s pf-b" data-ed="pick">${p?'変える':'選ぶ'}</button>${p?'<button class="btn btn-s pf-b" data-ed="nop">外す</button>':''}</div>
      <div class="pf-ed-l">看板パーティ</div>
      <p class="note" style="padding:0 0 8px">保存しているパーティから選びます。ポケモンだけを見せます（育成の中身は見せません）。</p>
      <div class="pf-ed-t">${teams.length?teams.map(x=>{const on=sc&&sc.t.join()===x.t.join();
        return `<button class="pf-ed-team${on?' on':''}" data-team="${x.i}"><b>${esc(x.n)}</b><span>${x.t.map(no=>`<i>${stamp(byNo[no])}</i>`).join('')}</span></button>`}).join(''):'<p class="note" style="padding:0">保存しているパーティがありません。パーティの画面で作ってから選べます。</p>'}
        ${sc?'<button class="btn btn-s pf-b" data-ed="nosc" style="margin-top:8px">看板パーティを外す</button>':''}</div>
      <div class="btns" style="padding:16px 0 4px"><button class="btn btn-s" data-ed="x">やめる</button><button class="btn btn-p" data-ed="save">保存する</button></div>
    </div>`;
  };
  draw();document.body.appendChild(o);requestAnimationFrame(()=>o.classList.add('on'));
  const close=()=>{o.classList.remove('on');setTimeout(()=>o.remove(),180)};
  addEventListener('hashchange',close,{once:true});
  o.addEventListener('click',async e=>{
    if(e.target.closest('.psheet-bg'))return close();
    const tb=e.target.closest('[data-team]');if(tb){const x=teams.find(y=>y.i===+tb.dataset.team);sc={n:x.n,t:x.t.slice()};draw();return}
    const b=e.target.closest('[data-ed]');if(!b)return;const k=b.dataset.ed;
    if(k==='x')return close();
    if(k==='nop'){partner=null;draw();return}
    if(k==='nosc'){sc=null;draw();return}
    if(k==='pick'){const v=await pickMon(partner||0);if(v){partner=v;draw()}return}
    if(k==='save'){b.disabled=true;try{await authFetch('/api/me/card',{partner,showcase:sc});toast('トレーナーカードを保存しました');close();done&&done()}catch(err){toast(err.message);b.disabled=false}}
  });
}
