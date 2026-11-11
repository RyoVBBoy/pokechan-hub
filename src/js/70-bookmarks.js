/* ===================== ブックマーク（2026/11/11 依頼主） =====================
   投稿の下の 🔖（32-timeline.js の twBind）で保存した投稿の一覧。#/bookmarks、左のメニューの「ブックマーク」から。
   保存はサーバー（worker/src/social.js の bookmarks 表、POST /api/notes/番号/bookmark・GET /api/me/bookmarks）なので、
   ログインしていればどの端末でも同じ。本人だけが見られ、投稿した人には知らせない。並びは保存した新しい順。 */
async function bookmarksView(){
  setHeader('ブックマーク','#/');
  const here=cur;V.innerHTML='<p class="empty">読み込み中…</p>';
  const prof=await twAuth();if(cur!==here)return;
  if(!prof){V.innerHTML=`<div class="bnote" style="margin:16px"><a href="#/account" style="color:var(--acc)">ログイン</a>すると、🔖 で保存した投稿をここでいつでも見返せます。</div>`;return}
  V.innerHTML=`<p class="bm-note">投稿の下の ${SVG(I.bookmark,15)} を押すと、ここに保存されます。保存したことは相手には知らされません。</p><div id="bm-list" class="tl-list"></div>`;
  twFeed(document.getElementById('bm-list'),'/api/me/bookmarks','まだブックマークした投稿はありません。気になる投稿の 🔖 を押して保存しましょう。');
}
