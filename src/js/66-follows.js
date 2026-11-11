/* ===================== フォロー中・フォロワーの一覧（2026/11/11 依頼主「X のようなユーザー一覧」） =====================
   開き方：左から出るメニューの「◯ フォロー」「◯ フォロワー」・プロフィールの「フォロワー」「フォロー中」（data-fl="following|followers" data-flh="ユーザーID"）、
   または #/u/ユーザーID/following・#/u/ユーザーID/followers（53-profile.js の userView が開く）。
   ・見た目は設定の画面（65-settings.js）と同じ：PC は真ん中に幅600px、スマホ（699px以下）は下からすべり上がる全画面
   ・上：←（閉じる）・その人の名前と @ID・✕。その下に「フォロー中／フォロワー」のタブ（下線がすべる）
   ・1行：丸いアイコン・名前（鍵のかかったアカウントなら🔒。いまはこのサイトに鍵のアカウントは無いので、サーバーが locked を返したときだけ）・@ID・自己紹介（2行まで）・右に「フォローする／フォロー中」
   ・行（ボタン以外）を押すと、その人のプロフィール（#/u/ID）へ。フォローのボタンはその場で切りかえる（/api/follow）
   ・一覧は GET /api/u/ID/following・/followers（worker/src/social.js、50人ずつ、下まで見ると続きを読む） */
const FL={el:null,h:null,tab:'following',data:{},changed:false,route:false,last:null};
const FL_TABS=[['following','フォロー中'],['followers','フォロワー']];
const FL_EMPTY={following:'まだだれもフォローしていません。',followers:'まだフォロワーはいません。'};
function flEnsure(){
  if(FL.el)return FL.el;
  const o=document.createElement('div');o.className='setm flm';o.id='flm';o.hidden=true;
  o.innerHTML=`<div class="sm-bg"></div><div class="sm-p" role="dialog" aria-modal="true" aria-labelledby="fl-t" tabindex="-1">
    <header class="sm-h fl-h"><button class="sm-ib" data-fl-x="back" aria-label="戻る">${SVG(I.back,20)}</button>
      <div class="fl-ttl"><h2 id="fl-t" data-notr></h2><small id="fl-hd" data-notr></small></div>
      <button class="sm-ib" data-fl-x="close" aria-label="閉じる">${SVG(I.x,20)}</button></header>
    <div class="fl-tabs" role="tablist">${FL_TABS.map(([k,n])=>`<button role="tab" data-fl-tab="${k}" aria-selected="false">${n}</button>`).join('')}<span class="fl-ind" aria-hidden="true"><i></i></span></div>
    <div class="sm-body fl-body"><div class="fl-list" role="tabpanel"></div></div></div>`;
  document.body.appendChild(o);FL.el=o;
  o.addEventListener('click',async e=>{
    if(e.target.closest('.sm-bg')||e.target.closest('[data-fl-x]')){flClose();return}
    const tb=e.target.closest('[data-fl-tab]');if(tb){flTab(tb.dataset.flTab);return}
    const fb=e.target.closest('[data-fl-fb]');if(fb){e.preventDefault();flFollow(fb);return}
    if(e.target.closest('[data-fl-more]')){flLoad(FL.tab,true);return}
    const row=e.target.closest('[data-fl-go]');if(row){e.preventDefault();const h=row.dataset.flGo;flClose(true);nav('#/u/'+h)}
  });
  o.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();flClose()}
    /* タブは左右の矢印でも切りかえる */
    if((e.key==='ArrowLeft'||e.key==='ArrowRight')&&e.target.closest('[data-fl-tab]')){flTab(e.key==='ArrowRight'?'followers':'following');o.querySelector(`[data-fl-tab="${FL.tab}"]`).focus()}});
  /* 下まで見たら続きを読む */
  o.querySelector('.fl-body').addEventListener('scroll',e=>{const b=e.currentTarget;if(b.scrollTop+b.clientHeight>b.scrollHeight-240){const d=FL.data[FL.tab];if(d&&d.next&&!d.busy)flLoad(FL.tab,true)}},{passive:true});
  return o;
}
/* 開く。name＝見出しに出す名前（分かっていれば。分からなければ @ID だけ出して、読めたら入れる） */
function followListOpen(h,tab,o={}){
  if(!/^[A-Za-z0-9_]{3,15}$/.test(h||''))return;
  const el=flEnsure();FL.last=document.activeElement;
  if((FL.h||'').toLowerCase()!==h.toLowerCase())FL.data={};
  FL.h=h;FL.changed=false;FL.route=!!o.route;
  el.querySelector('#fl-t').textContent=o.name||'';el.querySelector('#fl-hd').textContent='@'+h;
  if(!o.name)authFetch('/api/u/'+h).then(j=>{if(FL.h===h&&j.user)el.querySelector('#fl-t').textContent=j.user.name}).catch(()=>{});
  flTab(tab==='followers'?'followers':'following',true);
  el.hidden=false;document.body.classList.add('sm-lock');
  requestAnimationFrame(()=>requestAnimationFrame(()=>{el.classList.add('on');el.querySelector('.sm-p').focus({preventScroll:true})}));
}
/* 閉じる。go＝この後ほかの画面へ移る（描き直しはそちらに任せる） */
function flClose(go){
  const el=FL.el;if(!el||el.hidden)return;
  el.classList.remove('on');document.body.classList.remove('sm-lock');
  setTimeout(()=>{if(!el.classList.contains('on'))el.hidden=true},matchMedia('(prefers-reduced-motion: reduce)').matches?0:260);
  /* #/u/ID/following から開いたときは、アドレスをプロフィール（#/u/ID）に戻す（画面は描き直さない） */
  if(FL.route&&!go){const h='#/u/'+FL.h;try{history.replaceState(history.state,'',h)}catch(e){}cur=h}
  FL.route=false;
  /* フォローを切りかえていたら、いまの画面（プロフィールの数など）を描き直す */
  if(FL.changed&&!go&&typeof route==='function'&&(keyOf(cur)==='u'))route();
  try{FL.last&&FL.last.focus&&FL.last.focus({preventScroll:true})}catch(e){}
}
function flTab(t,quiet){
  const el=FL.el;FL.tab=t;const i=FL_TABS.findIndex(x=>x[0]===t);
  el.querySelectorAll('[data-fl-tab]').forEach(b=>{const on=b.dataset.flTab===t;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1});
  el.querySelector('.fl-ind').style.transform=`translateX(${i*100}%)`;
  const list=el.querySelector('.fl-list');list.setAttribute('aria-label',FL_TABS[i][1]);
  if(!quiet){list.classList.remove('fl-in-l','fl-in-r');void list.offsetWidth;list.classList.add(i?'fl-in-r':'fl-in-l')}
  el.querySelector('.fl-body').scrollTop=0;
  const d=FL.data[t];if(d&&d.users)flDraw();else flLoad(t);
}
async function flLoad(t,more){
  const h=FL.h,d=FL.data[t]||(FL.data[t]={users:null,next:null,busy:false,err:null});
  if(d.busy)return;d.busy=true;d.err=null;if(!more){d.users=null;d.next=null}
  flDraw();
  try{const j=await authFetch(`/api/u/${h}/${t}${more&&d.next?'?before='+d.next:''}`);
    if(FL.h!==h)return;d.users=(more&&d.users?d.users:[]).concat(j.users||[]);d.next=j.next||null}
  catch(e){d.err=e.message||'読み込めませんでした'}
  finally{d.busy=false}
  if(FL.h===h&&FL.tab===t)flDraw();
}
const flBtn=u=>u.me?'':`<button class="fl-fb${u.followed?' on':''}" data-fl-fb="${esc(u.handle)}" aria-pressed="${u.followed}" aria-label="${u.followed?'フォローをやめる':'フォローする'}：${esc(u.name)}">${u.followed?'<span class="fl-a">フォロー中</span><span class="fl-b">フォロー解除</span>':'フォローする'}</button>`;
function flRow(u){
  return `<div class="fl-row" data-fl-go="${esc(u.handle)}" role="link" tabindex="0" aria-label="${esc(u.name)}（@${esc(u.handle)}）のプロフィール">
    <span class="tw-av fl-av" style="background:${avCol(u.handle)}" aria-hidden="true">${avIn(u)}</span>
    <span class="fl-tx"><span class="fl-nm"><b data-notr>${esc(u.name)}</b>${u.locked?'<span class="fl-lock" title="非公開のアカウント">🔒</span>':''}</span>
      <span class="fl-hd" data-notr>@${esc(u.handle)}${u.follows_me&&!u.me?'<em>フォローされています</em>':''}</span>
      ${u.bio?`<span class="fl-bio" data-notr>${esc(u.bio)}</span>`:''}</span>
    ${flBtn(u)}</div>`;
}
function flDraw(){
  const el=FL.el,list=el.querySelector('.fl-list'),d=FL.data[FL.tab];
  if(!d||(!d.users&&d.busy)){list.innerHTML='<p class="fl-msg">読み込み中…</p>';return}
  if(d.err&&!d.users){list.innerHTML=`<p class="fl-msg">${esc(d.err)}<br><button class="btn btn-s" data-fl-more>もう一度読む</button></p>`;return}
  if(!d.users.length){list.innerHTML=`<p class="fl-msg">${FL_EMPTY[FL.tab]}</p>`;return}
  list.innerHTML=d.users.map(flRow).join('')+(d.next?`<p class="fl-msg">${d.busy?'読み込み中…':'<button class="btn btn-s" data-fl-more>続きを見る</button>'}</p>`:'');
}
/* フォローする／やめる（ワンタップ）。押した直後に見た目を変え、失敗したら戻す */
async function flFollow(b){
  if(!(typeof AUTH!=='undefined'&&AUTH.profile)){toast(AUTH&&AUTH.user?'先にプロフィールを作ってください':'フォローするにはログインしてください');flClose(true);nav('#/account');return}
  const h=b.dataset.flFb,on=!b.classList.contains('on');
  const set=v=>{for(const t in FL.data){const us=FL.data[t].users||[];us.forEach(u=>{if(u.handle===h)u.followed=v})}
    FL.el.querySelectorAll(`[data-fl-fb="${CSS.escape(h)}"]`).forEach(x=>{const u=(FL.data[FL.tab].users||[]).find(y=>y.handle===h)||{handle:h,name:h,followed:v};x.outerHTML=flBtn({...u,followed:v})})};
  b.disabled=true;set(on);
  try{const j=await authFetch('/api/follow',{handle:h,on});set(!!j.followed);FL.changed=true}
  catch(e){set(!on);toast(e.message)}
}
/* どの画面からでも data-fl を押すと開く（左のメニューは閉じてから） */
document.addEventListener('click',e=>{const a=e.target.closest('[data-fl]');if(!a||!a.dataset.flh)return;e.preventDefault();
  const inDr=a.closest('#drawer');if(inDr&&typeof drawerClose==='function')drawerClose();
  setTimeout(()=>followListOpen(a.dataset.flh,a.dataset.fl,{name:a.dataset.fln||''}),inDr?180:0)});
/* 行はキーボードの Enter でも開く */
document.addEventListener('keydown',e=>{if(e.key!=='Enter')return;const r=e.target.closest&&e.target.closest('#flm [data-fl-go]');if(r&&!e.target.closest('[data-fl-fb]'))r.click()});
