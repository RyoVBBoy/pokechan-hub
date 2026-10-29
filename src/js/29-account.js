
/* ===================== アカウント（ログイン・プロフィール） =====================
   ログインの仕組みは Firebase Authentication を使う（パスワードは当サイトでは扱わない）。
   設定値は GitHub の Variables から組み立て時に window.PC_CONFIG に入る。未設定なら「準備中」と表示。
   Firebase の部品は、アカウント画面を開いたときにだけ読み込む（ほかの画面は重くならない）。 */
const PCF=(window.PC_CONFIG&&window.PC_CONFIG.firebase&&window.PC_CONFIG.firebase.apiKey)?window.PC_CONFIG.firebase:null;
const FB_VER='10.14.1';
const AUTH={fb:null,user:null,profile:undefined,ready:false,wait:null};
async function fbLoad(){
  if(AUTH.fb)return AUTH.fb;
  if(!PCF)throw new Error('ログインは準備中です');
  let app,au;
  try{app=await import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app.js`);au=await import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-auth.js`)}
  catch(e){throw new Error('ログインの準備ができませんでした。電波のよいところで、ページを読み込み直してください（広告ブロックなどの機能が原因のこともあります）。')}
  const a=app.initializeApp(PCF);const auth=au.getAuth(a);auth.languageCode='ja';
  AUTH.fb={au,auth};
  AUTH.wait=new Promise(res=>au.onAuthStateChanged(auth,u=>{const ch=(AUTH.user&&AUTH.user.uid)!==(u&&u.uid);AUTH.user=u;if(ch)AUTH.profile=undefined;if(u){try{localStorage.setItem('pcin','1')}catch(e){}}AUTH.ready=true;res();if(ch&&['account'].includes(keyOf(cur)))accountView()}));
  return AUTH.fb;
}
async function authFetch(path,body){
  const h={'Content-Type':'application/json'};
  if(AUTH.user)h.Authorization='Bearer '+await AUTH.user.getIdToken();
  let r;try{r=await fetch(COMM_API+path,body?{method:'POST',headers:h,body:JSON.stringify(body)}:{headers:h})}catch(e){throw new Error('通信できませんでした。電波のよいところでもう一度試してください。')}
  const j=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(j.error||'通信エラー'),{status:r.status});return j;
}
async function loadProfile(force){
  if(!AUTH.user){AUTH.profile=null;return null}
  if(AUTH.profile!==undefined&&!force)return AUTH.profile;
  const j=await authFetch('/api/me');AUTH.profile=j.user||null;AUTH.email=j.email||AUTH.user.email;return AUTH.profile;
}
const authErr=e=>{const c=e&&e.code||'';return({
  'auth/popup-closed-by-user':'ログインの画面が閉じられました。','auth/cancelled-popup-request':'ログインの画面が閉じられました。',
  'auth/invalid-email':'メールアドレスの形が正しくありません。','auth/invalid-action-code':'ログイン用のリンクが古いか、すでに使われています。もう一度メールを送ってください。',
  'auth/expired-action-code':'ログイン用のリンクの期限が切れています。もう一度メールを送ってください。','auth/network-request-failed':'通信できませんでした。電波のよいところでもう一度試してください。',
  'auth/too-many-requests':'短い時間に何度も試したため、少し時間をおいてください。','auth/requires-recent-login':'安全のため、もう一度ログインしてから操作してください。',
  'auth/unauthorized-domain':'このアドレスはログインの許可リストに入っていません（運営者の設定が必要です）。','auth/operation-not-allowed':'このログイン方法はまだ有効になっていません。'
})[c]||(e&&e.message)||'うまくいきませんでした。'};
/* メールのリンクから戻ってきたときの処理（?mode=signIn&oobCode=... が付いて開かれる） */
async function finishEmailLink(){
  const {au,auth}=await fbLoad();
  if(!au.isSignInWithEmailLink(auth,location.href))return false;
  let email='';try{email=localStorage.getItem('pcmail')||''}catch(e){}
  if(!email){email=(await askText('確認のため、ログインに使ったメールアドレスを入れてください','メールアドレス'))||'';}
  if(!email)return false;
  await au.signInWithEmailLink(auth,email,location.href);
  try{localStorage.removeItem('pcmail')}catch(e){}
  history.replaceState(null,'',location.pathname+'#/account');
  return true;
}
function askText(title,label){
  return new Promise(res=>{const o=document.createElement('div');o.className='psheet';
    o.innerHTML=`<div class="psheet-bg"></div><div class="psheet-p" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h3>${esc(title)}</h3><div class="cform" style="padding:0"><label>${esc(label)}<input type="email" id="ask-v" autocomplete="email"></label></div><button class="psheet-o" id="ask-ok">決定</button><button class="psheet-x">やめる</button></div>`;
    document.body.appendChild(o);requestAnimationFrame(()=>o.classList.add('on'));
    const done=v=>{o.classList.remove('on');setTimeout(()=>o.remove(),180);res(v)};
    o.querySelector('.psheet-bg').onclick=()=>done(null);o.querySelector('.psheet-x').onclick=()=>done(null);
    o.querySelector('#ask-ok').onclick=()=>done(o.querySelector('#ask-v').value.trim())});
}
async function accountView(){
  setHeader('アカウント','#/community');
  if(!PCF){V.innerHTML=`<p class="empty" style="padding:40px 24px">ログイン機能は準備中です。もうしばらくお待ちください。</p>`;return}
  V.innerHTML='<p class="empty">読み込み中…</p>';
  try{await fbLoad();if(new URLSearchParams(location.search).get('oobCode'))await finishEmailLink();await AUTH.wait}catch(e){V.innerHTML=`<div class="bnote" style="margin:16px">${esc(authErr(e))}</div>`;return}
  if(keyOf(cur)!=='account')return;
  const {au,auth}=AUTH.fb;
  /* ログインしていない */
  if(!AUTH.user){
    V.innerHTML=`<div id="ac-root">
    <p class="note" style="padding-top:16px">ログインすると、プロフィールを作って、ほかのトレーナーとつながれるようになります（フォロー・投稿などは順次追加します）。図鑑や計算などはログインしなくても使えます。</p>
    <div class="btns"><button class="btn btn-p" id="ac-google">Googleでログイン</button></div>
    ${window.PC_CONFIG.apple?'<div class="btns" style="padding-top:0"><button class="btn btn-s" id="ac-apple">Appleでログイン</button></div>':''}
    <div class="sec"><h2>メールでログイン</h2></div>
    <p class="note" style="padding-top:0">メールアドレスにログイン用のリンクを送ります。パスワードは不要です。</p>
    <div class="cform" style="padding:0 16px"><label>メールアドレス<input type="email" id="ac-mail" autocomplete="email" placeholder="you@example.com"></label></div>
    <div class="btns"><button class="btn btn-s" id="ac-send">ログイン用のリンクを送る</button></div>
    <div id="ac-msg"></div>
    <p class="note" style="color:var(--mute)">ログインすると、<a href="#/terms" style="color:var(--acc)">利用規約</a>と<a href="#/privacy" style="color:var(--acc)">プライバシーポリシー</a>に同意したことになります。13歳未満の方は利用できません。</p></div>`;
    const msg=t=>{document.getElementById('ac-msg').innerHTML=`<div class="bnote" style="margin:8px 16px">${esc(t)}</div>`};
    const pop=async prov=>{try{await au.signInWithPopup(auth,prov)}catch(e){if(e.code==='auth/popup-blocked'){await au.signInWithRedirect(auth,prov)}else msg(authErr(e))}};
    document.getElementById('ac-google').onclick=()=>pop(new au.GoogleAuthProvider());
    const ap=document.getElementById('ac-apple');if(ap)ap.onclick=()=>{const p=new au.OAuthProvider('apple.com');p.addScope('email');p.addScope('name');pop(p)};
    document.getElementById('ac-send').onclick=async()=>{
      const email=document.getElementById('ac-mail').value.trim();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){msg('メールアドレスを正しく入れてください。');return}
      try{await au.sendSignInLinkToEmail(auth,email,{url:location.origin+location.pathname+'?login=mail',handleCodeInApp:true});
        try{localStorage.setItem('pcmail',email)}catch(e){}
        msg(`${email} にログイン用のリンクを送りました。メールを開いてリンクを押してください（届かないときは迷惑メールのフォルダも確かめてください）。`)}catch(e){msg(authErr(e))}};
    return;
  }
  /* ログイン済み：プロフィールの確認 */
  let prof;try{prof=await loadProfile()}catch(e){V.innerHTML=`<div class="bnote" style="margin:16px">${esc(e.message)}</div><div class="btns"><button class="btn btn-s" id="ac-out">ログアウト</button></div>`;document.getElementById('ac-out').onclick=()=>au.signOut(auth);return}
  const form=(p,first)=>`<div class="cform" style="padding:0 16px">
      <label>ユーザーID（半角英数字と _ の3〜15文字）<input id="ac-h" value="${esc(p?p.handle:'')}" maxlength="15" autocapitalize="off" autocomplete="off" placeholder="例：trainer_01"></label>
      <label>表示名（20文字まで）<input id="ac-n" value="${esc(p?p.name:'')}" maxlength="20" placeholder="例：トレーナー"></label>
      <label>自己紹介（160文字まで）<textarea id="ac-b" maxlength="160" rows="3" placeholder="よく使うポケモン・ルールなど">${esc(p?p.bio:'')}</textarea></label>
      ${first?`<label class="ac-agree"><input type="checkbox" id="ac-ag"> <span><a href="#/terms" style="color:var(--acc)">利用規約</a>と<a href="#/privacy" style="color:var(--acc)">プライバシーポリシー</a>に同意します（13歳以上です）</span></label>`:''}
    </div><div class="btns"><button class="btn btn-p" id="ac-save">${first?'プロフィールを作る':'保存する'}</button></div><div id="ac-msg"></div>`;
  const bindSave=first=>{document.getElementById('ac-save').onclick=async()=>{
    const b={handle:document.getElementById('ac-h').value.trim(),name:document.getElementById('ac-n').value.trim(),bio:document.getElementById('ac-b').value.trim()};
    if(first){if(!document.getElementById('ac-ag').checked){document.getElementById('ac-msg').innerHTML='<div class="bnote" style="margin:8px 16px">同意のチェックを入れてください。</div>';return}b.agree=true}
    try{const j=await authFetch('/api/me',b);AUTH.profile=j.user;toast(first?'プロフィールを作りました':'保存しました');accountView()}
    catch(e){document.getElementById('ac-msg').innerHTML=`<div class="bnote" style="margin:8px 16px">${esc(e.message)}</div>`}}};
  if(!prof){
    V.innerHTML=`<div id="ac-root"><p class="note" style="padding-top:16px">ログインできました。最後に、ほかの人に表示されるプロフィールを作りましょう。ユーザーIDはあとから変えられます。</p>${form(null,true)}
    <div class="btns"><button class="btn btn-s" id="ac-out">ログアウト</button></div></div>`;
    bindSave(true);document.getElementById('ac-out').onclick=()=>au.signOut(auth);return;
  }
  V.innerHTML=`<div id="ac-root">
    <div class="ac-card"><span class="ac-av">${esc((prof.name||'?').slice(0,1))}</span><div data-notr><b>${esc(prof.name)}</b><small>@${esc(prof.handle)}</small></div></div>
    ${prof.bio?`<p class="note" style="padding-top:4px;white-space:pre-wrap" data-notr>${esc(prof.bio)}</p>`:''}
    <p class="note" style="color:var(--mute);padding-top:0">ログイン中：${esc(AUTH.email||AUTH.user.email||'')}（ほかの人には表示されません）</p>
    <div class="btns" style="padding-top:4px"><a class="btn btn-s" href="#/u/${esc(prof.handle)}">自分のページを見る</a><a class="btn btn-s" href="#/tl">タイムライン</a></div>
    <div class="sec"><h2>プロフィールを編集</h2></div>${form(prof,false)}
    <div class="sec"><h2>そのほか</h2></div>
    <div class="btns" style="flex-wrap:wrap"><button class="btn btn-s" id="ac-out">ログアウト</button><button class="btn btn-s" id="ac-del" style="color:var(--w2)">アカウントを削除</button></div>
    <p class="note" style="color:var(--mute)"><a href="#/terms" style="color:var(--acc)">利用規約</a>・<a href="#/privacy" style="color:var(--acc)">プライバシーポリシー</a></p></div>`;
  bindSave(false);
  document.getElementById('ac-out').onclick=async()=>{await au.signOut(auth);toast('ログアウトしました')};
  document.getElementById('ac-del').onclick=async()=>{
    const v=await askText(`削除すると元に戻せません。確認のため、ユーザーID（${prof.handle}）を入れてください`,'ユーザーID');
    if(v!==prof.handle){if(v!=null)toast('ユーザーIDが一致しませんでした');return}
    try{await authFetch('/api/me/delete',{});await AUTH.user.delete();AUTH.profile=null;toast('アカウントを削除しました')}
    catch(e){toast(authErr(e));if(e.code==='auth/requires-recent-login'){await au.signOut(auth)}}
  };
}
/* メールのリンクから開かれたときは、アカウント画面へ */
(function(){try{const q=new URLSearchParams(location.search);if(q.get('oobCode')&&q.get('mode')==='signIn'&&PCF){cur='#/account';setUrl('#/account')}}catch(e){}})();
