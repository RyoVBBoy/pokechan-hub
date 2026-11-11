/* ===================== プロフィールを編集（画面の上に開く。2026/11/11 依頼主「X のプロフィール編集と同じに」） =====================
   開く所：プロフィールの「プロフィールを編集」（53-profile.js）・アカウントの画面の「プロフィールを編集」（29-account.js）。前のアカウントの画面の入力欄は廃止。
   ・外の形は設定の画面と同じ（.setm .sm-*、PC は真ん中に600px、スマホは下からの全画面）
   ・上：✕（閉じる）・「プロフィールを編集」・右に［保存］（変えたところがあるときだけ押せる）
   ・アイコン：真ん中にカメラの印を重ね、押すと写真を選ぶ（avShrink で真ん中を正方形に縮める）。写真があれば「写真を外す」。
     写真は［保存］を押したときに送る（/api/media → /api/me/avatar）。
   ・入力欄：枠つきで、名前（20文字）・自己紹介（160文字）・ユーザーID（3〜15文字）。文字数を右に出す。保存は POST /api/me（前と同じ）
   ・変えたまま閉じようとしたら「変更を破棄しますか？」 */
I.camera=I.camera||'<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.4-2h4.6l1.4 2h1.8A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.3" r="3.4"/>';
I.logout=I.logout||'<path d="M14 4.5h3.5A2.5 2.5 0 0 1 20 7v10a2.5 2.5 0 0 1-2.5 2.5H14"/><path d="M10.5 16.5 6 12l4.5-4.5M6 12h10"/>';
I.trash=I.trash||'<path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.2A1.5 1.5 0 0 0 8.9 20.5h6.2a1.5 1.5 0 0 0 1.5-1.3L17.5 7"/>';
const PE={el:null,orig:null,photo:null,rm:false,busy:false,last:null};
const PE_F=[['n','名前',20,'name'],['b','自己紹介',160,'bio'],['h','ユーザーID',15,'handle']];
function peEnsure(){
  if(PE.el)return PE.el;
  const o=document.createElement('div');o.className='setm pem';o.id='pem';o.hidden=true;
  o.innerHTML=`<div class="sm-bg"></div><div class="sm-p" role="dialog" aria-modal="true" aria-labelledby="pe-t" tabindex="-1">
    <header class="sm-h pe-h"><button class="sm-ib" data-pe="close" aria-label="閉じる">${SVG(I.x,20)}</button><h2 id="pe-t">プロフィールを編集</h2>
      <button class="pe-save" id="pe-save" disabled>保存</button></header>
    <div class="sm-body pe-body"></div></div>`;
  document.body.appendChild(o);PE.el=o;
  o.addEventListener('click',e=>{if(e.target.closest('.sm-bg')||e.target.closest('[data-pe=close]'))peClose();
    if(e.target.closest('#pe-prm')){PE.photo=null;PE.rm=true;peAvDraw();peDirty()}});
  o.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();peClose()}});
  o.querySelector('#pe-save').onclick=peSave;
  return o;
}
function profEditOpen(){
  if(!(typeof AUTH!=='undefined'&&AUTH.profile)){toast('プロフィールを作るにはログインしてください');nav('#/account');return}
  const o=peEnsure(),p=AUTH.profile;PE.last=document.activeElement;
  PE.orig={name:p.name||'',bio:p.bio||'',handle:p.handle||''};PE.photo=null;PE.rm=false;PE.busy=false;
  o.querySelector('.pe-body').innerHTML=`<div class="pe-avbox"><div class="pe-av" id="pe-av"></div>
      <div class="pe-avbtn"><label class="pe-pick">${SVG(I.camera,18)}<span>写真を選ぶ</span><input type="file" accept="image/*" id="pe-pf" hidden></label><span id="pe-rmw"></span></div>
      <p class="pe-avnote">写真は真ん中が正方形に切り取られ、丸く表示されます。ほかの人も見られます。</p></div>
    ${PE_F.map(([k,t,mx,f])=>`<label class="pe-f" for="pe-${k}"><span class="pe-l">${t}</span><span class="pe-c" id="pe-c${k}"></span>
      ${k==='b'?`<textarea id="pe-${k}" maxlength="${mx}" rows="3" placeholder="よく使うポケモン・ルールなど" data-notr></textarea>`
        :`<span class="pe-in">${k==='h'?'<em>@</em>':''}<input id="pe-${k}" maxlength="${mx}" autocomplete="off"${k==='h'?' autocapitalize="off" spellcheck="false"':''} data-notr></span>`}</label>`).join('')}
    <p class="pe-hint">ユーザーIDは半角英数字と _ の3〜15文字です。変えると、前のIDのリンクは使えなくなります。</p>
    <div id="pe-msg" role="alert"></div>`;
  PE_F.forEach(([k,,,f])=>{const el=o.querySelector('#pe-'+k);el.value=PE.orig[f];el.oninput=()=>{peCount();peDirty()}});
  o.querySelector('#pe-pf').onchange=async e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(!f)return;
    try{PE.photo=await avShrink(f);PE.rm=false;peAvDraw();peDirty()}catch(er){toast(er.message||'写真を読み込めませんでした')}};
  peAvDraw();peCount();peDirty();
  o.hidden=false;document.body.classList.add('sm-lock');
  requestAnimationFrame(()=>requestAnimationFrame(()=>{o.classList.add('on');o.querySelector('.sm-p').focus({preventScroll:true})}));
}
/* アイコンの見た目（選んだ写真・外した・いまの写真） */
function peAvDraw(){
  const o=PE.el,p=AUTH.profile,box=o.querySelector('#pe-av');
  const url=PE.photo?URL.createObjectURL(PE.photo.blob):'';
  const inner=PE.photo?`<img src="${url}" alt="">`:PE.rm?esc((o.querySelector('#pe-n')?.value||p.name||'?').slice(0,1)):avIn(p);
  box.innerHTML=`<span class="ac-av pe-avc" style="background:${avCol(p.handle)}" data-notr>${inner}</span><label class="pe-cam" aria-label="写真を選ぶ">${SVG(I.camera,24)}<input type="file" accept="image/*" hidden></label>`;
  const cam=box.querySelector('.pe-cam input');cam.onchange=o.querySelector('#pe-pf').onchange;
  const has=PE.photo||(!PE.rm&&p.av);o.querySelector('#pe-rmw').innerHTML=has?'<button class="pe-rm" id="pe-prm" type="button">写真を外す</button>':'';
}
function peCount(){PE_F.forEach(([k,,mx])=>{const v=PE.el.querySelector('#pe-'+k).value;const c=PE.el.querySelector('#pe-c'+k);c.textContent=`${[...v].length}/${mx}`})}
const peVals=()=>({name:PE.el.querySelector('#pe-n').value.trim(),bio:PE.el.querySelector('#pe-b').value.trim(),handle:PE.el.querySelector('#pe-h').value.trim()});
function peChanged(){const v=peVals();return !!(PE.photo||PE.rm||v.name!==PE.orig.name||v.bio!==PE.orig.bio||v.handle!==PE.orig.handle)}
function peDirty(){const v=peVals();PE.el.querySelector('#pe-save').disabled=PE.busy||!peChanged()||!v.name||!/^[A-Za-z0-9_]{3,15}$/.test(v.handle)}
async function peClose(force){
  const o=PE.el;if(!o||o.hidden)return;
  if(!force&&peChanged()&&!await askConfirm({title:'変更を破棄しますか？',text:'保存していない変更は消えます。',ok:'破棄する'}))return;
  o.classList.remove('on');document.body.classList.remove('sm-lock');
  setTimeout(()=>{if(!o.classList.contains('on'))o.hidden=true},matchMedia('(prefers-reduced-motion: reduce)').matches?0:260);
  try{PE.last&&PE.last.focus&&PE.last.focus({preventScroll:true})}catch(e){}
}
async function peSave(){
  if(PE.busy||!peChanged())return;
  const o=PE.el,b=o.querySelector('#pe-save'),msg=o.querySelector('#pe-msg'),v=peVals(),was=AUTH.profile.handle;
  PE.busy=true;b.disabled=true;b.textContent='保存中…';msg.innerHTML='';
  try{
    if(PE.photo){const key=await twUpload(PE.photo);AUTH.profile=(await authFetch('/api/me/avatar',{key})).user}
    else if(PE.rm)AUTH.profile=(await authFetch('/api/me/avatar',{remove:true})).user;
    if(v.name!==PE.orig.name||v.bio!==PE.orig.bio||v.handle!==PE.orig.handle)AUTH.profile=(await authFetch('/api/me',v)).user;
    refreshBrand();toast('プロフィールを保存しました');PE.busy=false;
    await peClose(true);
    /* いまの画面を新しいプロフィールで描き直す（IDを変えたら新しいIDのページへ） */
    const k=keyOf(cur);
    if(k==='u'&&AUTH.profile.handle!==was)nav('#/u/'+AUTH.profile.handle);
    else if(k==='u'||k==='account')route();
    if(typeof DR!=='undefined'&&DR.el)DR.el.innerHTML='';
  }catch(e){msg.innerHTML=`<div class="bnote pe-err">${esc(e.message)}</div>`;PE.busy=false;b.textContent='保存';peDirty()}
  finally{if(!PE.busy)b.textContent='保存'}
}
