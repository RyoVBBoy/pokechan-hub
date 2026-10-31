/* ===================== 左から出るメニュー（X の左側のメニューのようなもの） =====================
   開き方：左上のマークを押す／ホームの「みんな」で右にスワイプ（指に合わせて出てくる）。
   ホームでは、左右のスワイプで「みんな」と「フォロー中」を切りかえる。 */
I.gear='<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>';
I.help='<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6M12 16.8h.01"/>';
I.swap='<path d="M7 4 3.5 7.5 7 11M3.5 7.5h13M17 13l3.5 3.5L17 20M20.5 16.5h-13"/>';
I.globe='<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.6 3.5 5.4 3.5 8.5s-1.1 5.9-3.5 8.5c-2.4-2.6-3.5-5.4-3.5-8.5s1.1-5.9 3.5-8.5z"/>';
I.moon='<path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"/>';
const DR={el:null,open:false};
function drawerHTML(){
  const pr=typeof AUTH!=='undefined'&&AUTH.profile,g=curGame();
  const it=(href,ic,label,extra)=>`<a class="dr-i" href="${href}"${extra||''}>${SVG(ic,24)}<span>${label}</span></a>`;
  return `<div class="dr-bg"></div><nav class="dr-p" aria-label="メニュー">
    <div class="dr-head">${pr?`<a href="#/u/${esc(pr.handle)}" class="dr-me">${twAv(pr,'')}<div data-notr><b>${esc(pr.name)}</b><small>@${esc(pr.handle)}</small></div></a><div class="dr-ff" id="dr-ff"></div>`
      :`<a href="#/account" class="dr-me"><span class="tw-av" style="background:var(--elev2);color:var(--dim)">${SVG(I.user,22)}</span><div><b>ログイン</b><small>パーティをどの端末でも・投稿・フォロー</small></div></a>`}</div>
    ${it(pr?'#/u/'+esc(pr.handle):'#/account',I.user,'プロフィール')}
    ${it('#/notif',I.bell,'お知らせ')}
    ${it('#/team',I.grid,'パーティ')}
    ${it('#/tools',I.star,'マイツール')}
    ${MULTI_GAME?`<button class="dr-i" data-dr="game">${SVG(I.swap,24)}<span>ゲームを切り替える</span><span class="dr-g">${gameMark(g,22)}</span></button>`:''}
    ${it('#/search/'+encodeURIComponent('#対戦募集'),I.swords||I.chat,'対戦募集')}
    ${it('#/search/'+encodeURIComponent('#構築相談'),I.chat,'構築相談・質問')}
    <div class="dr-sep"></div>
    <details class="dr-d"><summary>${SVG(I.gear,22)}<span>設定とプライバシー</span></summary>
      <div class="dr-set"><div class="dr-lab">${SVG(I.moon,18)}明るさ</div>
        <div class="pills" style="padding:4px 0 10px">${[['auto','端末に合わせる'],['light','ライト'],['dark','ダーク']].map(([k,n])=>`<button class="pill" data-theme-set="${k}" aria-pressed="${THEME_PREF===k}">${n}</button>`).join('')}</div>
        <div class="dr-lab">${SVG(I.globe,18)}言語 / Language</div>
        <div class="pills" style="padding:4px 0 10px">${LANGS.map(([k,n])=>`<button class="pill" data-lang-set="${k}" aria-pressed="${LANG===k}">${n}</button>`).join('')}</div>
        <div id="dr-push"></div>
        <a class="dr-s" href="#/account">アカウント</a><a class="dr-s" href="#/privacy">プライバシーポリシー</a><a class="dr-s" href="#/terms">利用規約</a></div></details>
    <details class="dr-d"><summary>${SVG(I.help,22)}<span>ヘルプセンター</span></summary>
      <div class="dr-set"><a class="dr-s" href="#/rules">コミュニティの利用ルール</a><a class="dr-s" href="#/guide">基本ルール（計算式など）</a><a class="dr-s" href="#/sources">データの出典と確認状況</a></div></details>
  </nav>`;
}
function drawerEnsure(){
  if(DR.el)return DR.el;
  const o=document.createElement('div');o.className='drawer';o.id='drawer';document.body.appendChild(o);DR.el=o;
  o.addEventListener('click',e=>{
    if(e.target.closest('.dr-bg')){drawerClose();return}
    const ts=e.target.closest('[data-theme-set]');if(ts){setTheme(ts.dataset.themeSet);return}
    const ls=e.target.closest('[data-lang-set]');if(ls){if(ls.dataset.langSet!==LANG)setLang(ls.dataset.langSet);return}
    if(e.target.closest('[data-dr=game]')){drawerClose();setTimeout(gameSheet,200);return}
    if(e.target.closest('a[href^="#/"]'))drawerClose();
  });
  return o;
}
function drawerFill(){
  const o=drawerEnsure();o.innerHTML=drawerHTML();
  const pr=typeof AUTH!=='undefined'&&AUTH.profile;
  if(pr)authFetch('/api/u/'+pr.handle).then(j=>{const el=document.getElementById('dr-ff');if(el)el.innerHTML=`<a href="#/u/${esc(pr.handle)}"><b class="num">${j.user.following}</b> フォロー</a><a href="#/u/${esc(pr.handle)}"><b class="num">${j.user.followers}</b> フォロワー</a>`}).catch(()=>{});
  if(typeof pushRow==='function')pushRow(document.getElementById('dr-push'));
}
function drawerSet(p,anim){/* p：0＝閉じている〜1＝開いている */
  const o=DR.el;if(!o)return;const pn=o.querySelector('.dr-p'),bg=o.querySelector('.dr-bg');
  pn.style.transition=bg.style.transition=anim?'':'none';
  pn.style.transform=`translateX(${(p-1)*100}%)`;bg.style.opacity=p;
  o.classList.toggle('on',p>0);
}
function drawerOpen(){drawerFill();DR.open=true;requestAnimationFrame(()=>{drawerSet(0,false);requestAnimationFrame(()=>drawerSet(1,true))});
  if(PCF&&typeof twAuth==='function'&&!(AUTH&&AUTH.ready))twAuth().then(()=>{if(DR.open)drawerFill(),drawerSet(1,false)})}
function drawerClose(){if(!DR.el)return;DR.open=false;drawerSet(0,true)}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&DR.open)drawerClose()});

/* ---- スワイプ（指に合わせて動かす） ---- */
const SW={x:0,y:0,t:0,mode:null,w:0};
const swOK=t=>!t.closest('input,textarea,select,.pills,.tkb,.mp-list,.psheet,.sheet,.crolls,.edd,[data-noswipe]');
document.addEventListener('touchstart',e=>{
  SW.mode=null;if(e.touches.length!==1)return;const t=e.touches[0];
  SW.x=t.clientX;SW.y=t.clientY;SW.t=Date.now();SW.ok=swOK(e.target);
},{passive:true});
document.addEventListener('touchmove',e=>{
  if(!SW.ok||e.touches.length!==1)return;const t=e.touches[0],dx=t.clientX-SW.x,dy=t.clientY-SW.y;
  if(SW.mode===null){
    if(Math.abs(dx)<12&&Math.abs(dy)<12)return;
    if(Math.abs(dx)<Math.abs(dy)*1.3){SW.mode='none';return}
    if(DR.open)SW.mode=dx<0?'close':'none';
    else if(keyOf(cur)===''&&innerWidth<700&&!document.querySelector('.psheet,.sheet:not([hidden])')){
      if(dx>0&&tlTab==='all'&&SW.x>18){SW.mode='drawer';drawerFill();SW.w=DR.el.querySelector('.dr-p').offsetWidth||300}
      else if((dx<0&&tlTab==='all')||(dx>0&&tlTab==='following'))SW.mode='tabs';
      else SW.mode='none';
    }else SW.mode='none';
  }
  if(SW.mode==='drawer')drawerSet(Math.max(0,Math.min(1,dx/SW.w)),false);
  else if(SW.mode==='close')drawerSet(Math.max(0,Math.min(1,1+dx/(DR.el.querySelector('.dr-p').offsetWidth||300))),false);
  else if(SW.mode==='tabs'){const el=document.getElementById('tl-list');if(el){el.style.transition='none';el.style.transform=`translateX(${dx*.35}px)`;el.style.opacity=1-Math.min(.5,Math.abs(dx)/600)}}
},{passive:true});
document.addEventListener('touchend',e=>{
  if(!SW.mode||SW.mode==='none')return;
  const t=e.changedTouches[0],dx=t.clientX-SW.x,v=dx/Math.max(1,Date.now()-SW.t);
  if(SW.mode==='drawer'){const go=dx>SW.w*.3||v>.45;DR.open=go;drawerSet(go?1:0,true)}
  else if(SW.mode==='close'){const shut=-dx>80||v<-.45;DR.open=!shut;drawerSet(shut?0:1,true)}
  else if(SW.mode==='tabs'){const el=document.getElementById('tl-list');if(el){el.style.transition='transform .2s,opacity .2s';el.style.transform='';el.style.opacity=''}
    if(Math.abs(dx)>60||Math.abs(v)>.45)tlShow(dx<0?'following':'all')}
  SW.mode=null;
},{passive:true});
