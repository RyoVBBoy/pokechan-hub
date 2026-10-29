/* ログインの窓口（/__/auth/… と /__/firebase/…）を、このサイトと同じアドレスで受けて Firebase に取り次ぐ。
   スマホのブラウザ（特に iPhone の Safari・ホーム画面に追加したとき）は、ログイン画面とサイトのアドレスが違うと
   途中の情報を受け渡せず "The requested action is invalid." になるため。Cloudflare Pages の Functions として動く。 */
const FIREBASE_HOST='pokechan-hub.firebaseapp.com';
export async function onRequest({request}){
  const u=new URL(request.url);
  const target='https://'+FIREBASE_HOST+u.pathname+u.search;
  const init={method:request.method,headers:new Headers(request.headers),redirect:'manual'};
  init.headers.delete('host');
  if(!['GET','HEAD'].includes(request.method))init.body=await request.arrayBuffer();
  const r=await fetch(target,init);
  const h=new Headers(r.headers);
  return new Response(r.body,{status:r.status,statusText:r.statusText,headers:h});
}
