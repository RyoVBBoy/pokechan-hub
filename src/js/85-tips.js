/* ===================== 運営の「Game Kid/s Tips」アカウント（2026/11/16 依頼主 第1段階：画像だけ。サーバーは worker/src/tips.js） =====================
   ・投稿の「運営」の札は、サーバーが付けた user.off だけを見る（名前・ID では決めない）。
   ・投稿のツール（n.tool）は、下の TIPS_GO にあるキーだけボタンにする。行き先はこの表から作る（投稿の中身からアドレスを作らない）。
   ・ツールの画面の「すぐ使う」の下に「Game Kid/s Tips」の入口。はじめての使い方のカードを閉じても、いつも出る。
   ・管理画面の「Tips」タブ：ツール・本文（140字）・画像（4枚まで、twShrink で縮めてから送る）で投稿、最近の Tips と運営者の操作の記録。 */
const TIPS_HANDLE='gamekids_tips';
const TIPS_GO={calc:['ダメージ計算','#/calc'],dex:['図鑑','#/dex'],team:['パーティ','#/team'],assist:['選出アシスト','#/assist'],types:['タイプ相性','#/types'],
  tier:['ランキング','#/tier'],meta:['流行','#/meta'],season:['上位パーティ','#/season'],memo:['戦術メモ','#/memo'],pair:['相性のいい仲間','#/pair'],
  pip:['PiP','#/pip'],import:['画像から取り込む','#/import'],replay:['対戦の振り返り','#/replay'],cmp:['ポケモン比較','#/cmp'],learn:['攻略ガイド','#/learn']};
const tipsBadge=u=>u&&u.off?`<em class="tw-off" title="Game Kid/s の運営アカウント">運営</em>`:'';
const tipsToolBtn=n=>{const g=n&&n.user&&n.user.off&&n.tool&&TIPS_GO[n.tool];return g?`<a class="tw-tool" href="${g[1]}">${SVG(I.chev,16)}<span>${esc(g[0])}を開く</span></a>`:''};
function tipsRowHTML(){
  return `<a class="tips-row" href="#/u/${TIPS_HANDLE}"><span class="tips-ic">${SVG(I.image||I.help,20)}</span>
    <span class="tips-m"><b>Game Kid/s Tips<em class="tw-off">運営</em></b><span>ツールの使い方を、実際の画面で1つずつ紹介</span></span><span class="chev">${SVG(I.chev,18)}</span></a>`;
}
/* 管理画面の Tips タブ */
async function admTipsLoad(el,o){
  const j=await o.aget('/api/admin/tips');
  /* 公式の運営の札（2026/11/19）：運営者のアカウントに「運営」の札を付ける・外す（サーバーの /api/admin/official。本人は自分で付けられない） */
  let off={users:[]};try{off=await o.aget('/api/admin/official')}catch(e){off={users:[],err:e.message}}
  const offHTML=`<div class="sec"><h2>運営の札</h2></div><div class="lcard"><div class="lcard-h"><b>運営の札が付いているアカウント</b></div>
    <p class="lcm">運営者のアカウントに「運営」の札を付けると、投稿・プロフィール・検索・お知らせ・フォローの一覧・メッセージに、Tips と同じ札が出ます。札はここでしか付けられません（本人の設定では付けられません）。</p>
    ${off.err?`<p class="lcm">${esc(off.err)}</p>`:off.users.map(x=>`<div class="lmeta" style="display:flex;align-items:center;gap:8px;justify-content:space-between"><span data-notr>${esc(x.name)} @${esc(x.handle)} ${tipsBadge({off:true})}</span>${x.fixed?'<span class="lt">いつも付く</span>':`<button class="btn btn-s" data-off-rm="${esc(x.handle)}">外す</button>`}</div>`).join('')}
    <div class="cform"><label>札を付けるアカウントのユーザーID<input id="of-h" placeholder="例：gamekids_admin" autocomplete="off"></label></div>
    <div class="btns"><button class="btn btn-p" id="of-add">運営の札を付ける</button></div></div>`;
  const toolOpt=j.tools.filter(k=>TIPS_GO[k]).map(k=>`<option value="${k}">${esc(TIPS_GO[k][0])}</option>`).join('');
  el.innerHTML=`<div class="lcard"><div class="lcard-h"><b>Tips を投稿する</b><span class="lt">@${esc(j.user.handle)}・運営の札つき</span></div>
    <div class="cform"><label>紹介するツール<select class="sel" id="tp-tool"><option value="">選んでください</option>${toolOpt}</select></label>
    <label>本文（140字まで。1つの投稿に1つの使い方）<textarea id="tp-body" maxlength="140" rows="4"></textarea></label><div class="lmeta"><span id="tp-n">0 / 140</span></div>
    <label>画像（JPEG・PNG・WebP、4枚まで。送る前に縮めます）<input type="file" id="tp-img" accept="image/jpeg,image/png,image/webp" multiple></label>
    <div class="adm-media" id="tp-prev"></div></div>
    <div class="btns"><button class="btn btn-p" id="tp-post">投稿する</button></div></div>
    <div class="sec"><h2>最近の Tips</h2></div>
    ${j.notes.length?j.notes.map(n=>`<div class="lcard"><div class="lcard-h"><span class="atag">${esc((TIPS_GO[n.tool]||[n.tool||'—'])[0])}</span>${n.reports?`<span class="atag on">通報 ${n.reports}件・確認してください</span>`:''}${n.hidden?'<span class="atag">非表示</span>':''}<span class="lt">${ago(n.created_at)}</span></div>
      <div class="lcm" style="white-space:pre-wrap">${esc(n.body)}</div>
      <div class="btns"><a class="btn btn-s" href="#/n/${n.id}">見る</a><button class="btn btn-s" data-tp-hide="${n.id}" data-restore="${n.hidden?1:0}">${n.hidden?'表示に戻す':'非表示にする'}</button></div></div>`).join(''):'<p class="empty">まだ Tips はありません。</p>'}
    ${offHTML}
    <div class="sec"><h2>運営者の操作の記録</h2></div>
    ${j.log.length?`<div class="lcard">${j.log.map(l=>`<div class="lmeta">${esc(new Date(l.at).toLocaleString('ja-JP'))}・${esc(l.action)}${l.target?' #'+l.target:''} ${esc(l.detail||'')}・接続元 ${esc(l.who||'')}</div>`).join('')}</div>`:'<p class="empty">記録はまだありません。</p>'}`;
  const ofAdd=el.querySelector('#of-add');
  if(ofAdd)ofAdd.onclick=async()=>{const h=el.querySelector('#of-h').value.trim().replace(/^@/,'');if(!h){toast('ユーザーIDを入れてください');return}
    if(!await askConfirm({title:`@${h} に運営の札を付けますか？`,text:'投稿・プロフィールなどに「運営」の札が出ます。運営者のアカウントだけに付けてください。',ok:'付ける',danger:false}))return;
    try{await o.apost('/api/admin/official',{handle:h,on:true});toast('運営の札を付けました');o.reload()}catch(err){toast(err.message)}};
  el.querySelectorAll('[data-off-rm]').forEach(b=>b.onclick=async()=>{const h=b.dataset.offRm;
    if(!await askConfirm({title:`@${h} の運営の札を外しますか？`,text:'札はすぐに消えます。',ok:'外す'}))return;
    try{await o.apost('/api/admin/official',{handle:h,on:false});toast('運営の札を外しました');o.reload()}catch(err){toast(err.message)}});
  const ta=el.querySelector('#tp-body'),cnt=el.querySelector('#tp-n'),inp=el.querySelector('#tp-img'),prev=el.querySelector('#tp-prev');
  let files=[];
  ta.oninput=()=>{cnt.textContent=`${[...ta.value].length} / 140`};
  inp.onchange=()=>{files=[...inp.files].slice(0,4);if(inp.files.length>4)toast('画像は4枚までです（はじめの4枚を使います）');
    prev.innerHTML='';files.forEach(f=>{const im=document.createElement('img');im.alt='';im.src=URL.createObjectURL(f);prev.appendChild(im)})};
  el.querySelector('#tp-post').onclick=async e=>{const btn=e.currentTarget;
    const tool=el.querySelector('#tp-tool').value,body=ta.value.trim();
    if(!tool){toast('紹介するツールを選んでください');return}if(!body){toast('本文を入れてください');return}
    btn.disabled=true;
    try{const keys=[];
      for(const f of files){const x=await twShrink(f,1600);
        const r=await fetch(`${COMM_API}/api/admin/tips/media?w=${x.w}&h=${x.h}`,{method:'POST',headers:{'Content-Type':x.blob.type,'X-Admin-Token':o.tok},body:x.blob});
        const jj=await r.json().catch(()=>({}));if(!r.ok)throw new Error(jj.error||'画像を送れませんでした');keys.push(jj.key)}
      await o.apost('/api/admin/tips/post',{tool,body,media:keys});toast('Tips を投稿しました');o.reload()}
    catch(err){toast(err.message);btn.disabled=false}};
  el.querySelectorAll('[data-tp-hide]').forEach(b=>b.onclick=async()=>{try{await o.apost('/api/admin/tips/hide',{id:+b.dataset.tpHide,restore:b.dataset.restore==='1'});toast('変えました');o.reload()}catch(err){toast(err.message)}});
}
