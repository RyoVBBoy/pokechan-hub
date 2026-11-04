/* 共有されたパーティのリンク（/t/445-149-…）。2026/11/04
   X などにリンクを貼ったとき、ここが返す題名・説明・画像（og）がカードとして表示される。
   人が開いたときは、すぐにサイトの「共有されたパーティ」の画面（#/share/…）へ移る。
   ポケモンの名前は、公開のときに作る /assets/mon-names.json（tools/gen-pages.cjs）から引く。 */
const SITE='ポケチャン攻略Hub';
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
export async function onRequest({request,env}){
  const u=new URL(request.url);
  const raw=(u.pathname.split('/')[2]||'').trim();
  const nos=/^\d{1,5}(-\d{1,5}){0,5}$/.test(raw)?raw.split('-').map(Number):[];
  if(!nos.length)return Response.redirect(u.origin+'/',302);
  let names={};
  try{const r=await env.ASSETS.fetch(new URL('/assets/mon-names.json',u.origin));if(r.ok)names=await r.json()}catch(e){}
  const list=nos.map(n=>names[n]).filter(Boolean);
  const title=list.length?`パーティ：${list.join('・')}｜${SITE}`:`共有されたパーティ｜${SITE}`;
  const desc=`ポケモンチャンピオンズのパーティ${list.length?`（${list.length}匹）`:''}。開くと種族値・弱点が見られ、ボタン1つで自分のパーティに入れたり、選出アシストで相手にしたりできます。`;
  const to=u.origin+'/#/share/'+nos.join('-'),img=u.origin+'/og-party.png';
  const html=`<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="${SITE}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(u.origin+u.pathname)}"><meta property="og:image" content="${esc(img)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(img)}">
<meta http-equiv="refresh" content="0;url=${esc(to)}"><link rel="canonical" href="${esc(u.origin+'/')}"></head>
<body style="background:#000;color:#fff;font-family:sans-serif"><p><a href="${esc(to)}" style="color:#1d9bf0">パーティを開く</a></p><script>location.replace(${JSON.stringify(to)})</script></body></html>`;
  return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=3600'}});
}
