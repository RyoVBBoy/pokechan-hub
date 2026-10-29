/* ポケチャン攻略Hub の通知の受け取り（Service Worker）。
   サーバーから届いた通知（暗号化はブラウザがほどく）を表示し、押されたらその画面を開く。
   画面のファイルのキャッシュはしない（いつも最新を読むため）。 */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('push',e=>{
  let m={};try{m=e.data?e.data.json():{}}catch(_){m={body:e.data&&e.data.text()}}
  const title=m.title||'ポケチャン攻略Hub';
  e.waitUntil(self.registration.showNotification(title,{body:m.body||'',icon:'icon-192.png',badge:'badge-96.png',tag:m.tag||undefined,renotify:!!m.tag,data:{url:m.url||'#/notif'}}));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const url=new URL(e.notification.data&&e.notification.data.url||'#/notif',self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{
    for(const c of cs){if('focus' in c){c.navigate?c.navigate(url).catch(()=>{}):0;return c.focus()}}
    return self.clients.openWindow(url);
  }));
});
