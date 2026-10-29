/* ===================== スマホに届く通知（受け取る側） =====================
   sw.js（通知の受け取り）を登録し、利用者が「通知をオン」にしたら、サーバー（/api/me/push）に宛先を登録する。
   iPhone は「ホーム画面に追加」したアイコンから開いたときだけ通知を受け取れる（Apple の決まり）。 */
const PUSH={sub:null,ready:false};
const isIOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const isStandalone=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true;
const pushSupported=()=>location.protocol==='https:'&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
if(location.protocol==='https:'&&'serviceWorker' in navigator)
  navigator.serviceWorker.register('sw.js').then(r=>r.pushManager?r.pushManager.getSubscription():null).then(s=>{PUSH.sub=s||null;PUSH.ready=true}).catch(()=>{PUSH.ready=true});
const u8=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'=')),c=>c.charCodeAt(0));
async function pushOn(){
  if(!AUTH.user){toast('通知を受け取るにはログインしてください');nav('#/account');return false}
  const perm=await Notification.requestPermission();
  if(perm!=='granted'){toast('通知が許可されませんでした');return false}
  try{
    const reg=await navigator.serviceWorker.ready,{key}=await authFetch('/api/push/key');
    let sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:u8(key)});
    await authFetch('/api/me/push',sub.toJSON());PUSH.sub=sub;toast('通知をオンにしました');return true;
  }catch(e){toast('通知をオンにできませんでした：'+(e.message||e));return false}
}
async function pushOff(){
  const s=PUSH.sub;if(!s)return;
  try{await authFetch('/api/me/push/delete',{endpoint:s.endpoint})}catch(e){}
  try{await s.unsubscribe()}catch(e){}
  PUSH.sub=null;toast('通知をオフにしました');
}
/* 通知の設定の欄（メニューの「設定」とお知らせの画面に出す） */
function pushRow(el,compact){
  if(!el)return;
  const on=PUSH.sub&&window.Notification&&Notification.permission==='granted';
  const box=(t,btn)=>`<div class="push-row">${SVG(I.bell,18)}<div><div>${t}</div>${btn||''}</div></div>`;
  if(!pushSupported()){
    el.innerHTML=isIOS&&!isStandalone&&location.protocol==='https:'?box('iPhone で通知を受け取るには、Safari の<b>共有ボタン</b>（□に↑）→<b>「ホーム画面に追加」</b>を押し、追加したアイコンからこのサイトを開いてください。そこで「通知をオン」にできます。')
      :compact?'':box('このブラウザは、スマホへの通知に対応していません。');
    return;
  }
  if(window.Notification&&Notification.permission==='denied'){el.innerHTML=box('通知がブロックされています。端末（ブラウザ）の設定で、このサイトの通知を「許可」にしてください。');return}
  if(on){el.innerHTML=compact?'':box('<b>通知：オン</b>　いいね・フォローされたときに、スマホに届きます。',`<div class="push-b"><button class="btn btn-s" data-push="test">テスト通知を送る</button><button class="btn btn-s" data-push="off">オフにする</button></div>`)}
  else el.innerHTML=box('いいね・フォローされたときに、スマホに通知が届くようにできます。',`<div class="push-b"><button class="btn btn-p" data-push="on">${SVG(I.bell,16)}通知をオンにする</button></div>`);
  el.onclick=async e=>{const b=e.target.closest('[data-push]');if(!b)return;b.disabled=true;
    if(b.dataset.push==='on')await pushOn();else if(b.dataset.push==='off')await pushOff();
    else{try{await authFetch('/api/me/push/test',{});toast('テスト通知を送りました')}catch(err){toast(err.message)}}
    pushRow(el,compact)};
}
