/* ===================== 公式のお知らせ（#/news、#/news/種類） =====================
   お知らせbot（worker/src/news.js）が見つけた公式サイトのお知らせを、種類ごとに一覧にする。題名・日付・リンクだけ（本文は写さない） */
const NEWS_CATS_UI=['お知らせ','連携ソフト','メンテナンス','アップデート','不具合','アンケート','ランクバトル','レギュレーション','セレクト','バトルパス','キャンペーン','チャンピオンシップス','オンライン大会','オフライン大会'];
async function newsView(a){
  let cat='';try{cat=decodeURIComponent(a||'')}catch(e){}
  if(!NEWS_CATS_UI.includes(cat))cat='';
  setHeader('公式のお知らせ','#/community');
  V.innerHTML=`<p class="note" style="padding-top:14px">ポケモンチャンピオンズの公式サイトのお知らせを、題名とリンクで紹介しています（自動で集めています。このサイトは非公式です）。くわしい内容は公式サイトでご覧ください。</p>
    <div class="pills" style="flex-wrap:wrap;padding-top:0"><a class="pill" href="#/news" aria-pressed="${!cat}">すべて</a>${NEWS_CATS_UI.map(c=>`<a class="pill" href="#/news/${encodeURIComponent(c)}" aria-pressed="${c===cat}">${c}</a>`).join('')}</div>
    <div id="nw-list"><p class="empty">読み込み中…</p></div>`;
  try{const r=await fetch(COMM_API+'/api/news'+(cat?'?cat='+encodeURIComponent(cat):''));const j=await r.json();if(keyOf(cur)!=='news')return;
    const el=document.getElementById('nw-list');
    el.innerHTML=j.items&&j.items.length?j.items.map(x=>`<a class="row nw-r" href="${esc(x.url)}" target="_blank" rel="noopener nofollow"><div class="row-m"><div class="row-s">${x.cat?`<span class="atag on">${esc(x.cat)}</span>`:'<span class="atag">お知らせ</span>'}${x.date?` ${esc(x.date.replace(/-/g,'/'))}`:''}</div><div class="row-t" data-notr>${esc(x.title)}</div><div class="row-s">公式サイトで読む ↗</div></div></a>`).join('')
      :`<p class="empty">${cat?`「${cat}」のお知らせは、まだ見つかっていません。`:'まだお知らせが見つかっていません。'}</p>`}
  catch(e){const el=document.getElementById('nw-list');if(el)el.innerHTML='<p class="empty">読み込めませんでした。通信できる環境で開き直してください。</p>'}
}
