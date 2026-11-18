/* ===================== プロフィール画面＝プレイヤーカード（2026/11/18 V3.4 を本番へ。もとは 2026/11/05 のトレーナーカード） =====================
   ・カードは #/u/ID だけ（ほかの画面は名前とアイコンだけ＝IA §16）。作りは gkcHTML（下の gkc-* の部品）
   ・1枚の持ち上げた面：帯（六角形の構図・紫がかった黒）→アイコン（帯のふちにかける）→名前・@ID・利用開始（A24）→数（もらったいいねは出さない A12）
     →ゲームの名札（ゲームごと）→シーズンの戦績（確認済み＝最高位＋新しい3件＋もっと見る A23、自己申告は別のまとまり IA §7）→看板パーティ
   ・見せる範囲はサーバーの返事だけで決まる（非公開・ゲームの公開範囲 A5・A19。見られない人には games が空）
   ・相棒・看板パーティ・ゲームの公開範囲は POST /api/me/card（「カードを編集」pfEdit）。投稿／画像はカードの外 */
const PF_I={
  info:'<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',plus:'<path d="M12 5v14M5 12h14"/>',
  chk:'<path d="M5 12.5l4.2 4.2L19 7"/>',
  cal:'<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  img:'<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M20 16l-5-5-8.5 8.5"/>',
  post:'<path d="M5 5h14v10H9l-4 4z"/>'
};
const pfMonth=t=>{const d=new Date(t||Date.now());return LANG==='en'?d.toLocaleDateString('en-US',{year:'numeric',month:'short'}):`${d.getFullYear()}年${d.getMonth()+1}月`};
const pfNum=n=>n>=10000?(n/10000).toFixed(n>=100000?0:1)+'万':String(n||0);
/* ===== プレイヤーカード V3.4（2026/11/18、docs/social-redesign/v3.4 の見本を本番へ。見た目の名前は gkc-*） =====
   1枚の持ち上げた面に：帯（この画面のための六角形の構図・紫がかった黒）→アイコン（帯のふちにかける）→名前・@ID・利用開始→数
   →ゲームの名札（ゲームごとの部品）→シーズンの戦績（確認済み＝新しい3件＋もっと見る、自己申告は別のまとまり）→看板パーティ。投稿はカードの外。
   どこまで見せるかはサーバーの返事（/api/u）だけで決まる（見られない人には games が空・results が空） */
const pfGameName=id=>{const g=typeof GAMES!=='undefined'&&GAMES.find(x=>x.id===id);return g?g.name:id};
const gkcHex=(R,vals)=>[0,1,2,3,4,5].map(i=>{const r=R*(vals?vals[i]:1),[x,y]=polar(i,r);return x.toFixed(1)+','+y.toFixed(1)}).join(' ');
const gkcStat=p=>AXO.map(si=>Math.max(.15,Math.min(1,p.s[si]/150)));
/* 帯：六角形の格子（左は消える）＋斜めの面＋相棒の種族値の形（線で・紫1色） */
function gkcCover(p){
  const hx=[];for(let row=-1;row<6;row++)for(let col=-1;col<26;col++){const x=col*30+(row%2?15:0),y=row*26;hx.push(`<polygon points="${gkcHex(15).split(' ').map(q=>{const[a,b]=q.split(',').map(Number);return (a+x).toFixed(1)+','+(b+y).toFixed(1)}).join(' ')}"/>`)}
  const big=p?`<g transform="translate(520,64)"><polygon points="${gkcHex(74)}" fill="none" stroke="var(--gkc-ln)" stroke-opacity=".18" stroke-width="1.2"/><polygon points="${gkcHex(52)}" fill="none" stroke="var(--gkc-ln)" stroke-opacity=".12"/>
    <polygon points="${gkcHex(74,gkcStat(p))}" fill="rgba(var(--gkc-rgb),.2)" stroke="var(--gkc-ln)" stroke-opacity=".75" stroke-width="1.6" stroke-linejoin="round"/></g>`:'';
  return `<svg viewBox="0 0 600 128" preserveAspectRatio="xMaxYMid slice" aria-hidden="true"><defs><linearGradient id="gkcf" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".55" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff"/></linearGradient><mask id="gkcm"><rect width="600" height="128" fill="url(#gkcf)"/></mask></defs>
    <g mask="url(#gkcm)" fill="none" stroke="var(--gkc-ln)" stroke-opacity=".07">${hx.join('')}</g>
    <polygon points="380,0 600,0 600,128 300,128" fill="rgba(var(--gkc-rgb),.07)"/><polygon points="470,0 600,0 600,128 410,128" fill="rgba(var(--gkc-rgb),.06)"/>${big}</svg>`;
}
/* ゲームの記号（このサイトで作った図形・ゲームごと）：ポケモンチャンピオンズ＝6つの面の六角形 */
const GKC_EMBLEM={pokechamp:()=>`<svg viewBox="-48 -48 96 96" aria-hidden="true"><polygon points="${gkcHex(38)}" fill="rgba(var(--gkc-rgb),.12)" stroke="var(--gkc-ln)" stroke-width="3" stroke-linejoin="round"/><polygon points="${gkcHex(20)}" fill="var(--gkc-ln)" fill-opacity=".9"/>${[0,1,2,3,4,5].map(i=>{const[a,b]=polar(i,20),[c,d]=polar(i,38);return `<line x1="${a.toFixed(1)}" y1="${b.toFixed(1)}" x2="${c.toFixed(1)}" y2="${d.toFixed(1)}" stroke="var(--gkc-ln)" stroke-opacity=".55" stroke-width="2.4"/>`}).join('')}</svg>`};
/* 段位の印：六角形を下から満たす（1桁＝全部・2桁＝3分の2・3桁＝3分の1・それ以外・レートだけ＝線だけ）。自己申告は灰色の線だけ */
let GKC_ID=0;
function gkcTier(r,quiet){const lv=!r.rank?0:r.rank<10?3:r.rank<100?2:r.rank<1000?1:0,id='gkct'+(++GKC_ID);
  const nm=!r.rank?'レート':lv===3?'最終1桁':lv===2?'最終2桁':lv===1?'最終3桁':'最終順位';
  return `<svg class="gkc-tier" viewBox="-12 -12 24 24" role="img" aria-label="${nm}"><defs><clipPath id="${id}"><polygon points="${gkcHex(10.5)}"/></clipPath></defs>
    ${quiet||!lv?'':`<rect x="-12" y="${(12-24*lv/3).toFixed(1)}" width="24" height="24" fill="var(--gkc-ln)" fill-opacity=".85" clip-path="url(#${id})"/>`}
    <polygon points="${gkcHex(10.5)}" fill="none" stroke="${quiet?'var(--gkc-q)':'var(--gkc-ln)'}" stroke-width="1.6" stroke-linejoin="round"/></svg>`}
const gkcTierName=r=>!r.rank?'最終レート':r.rank<10?'最終1桁':r.rank<100?'最終2桁':r.rank<1000?'最終3桁':'最終順位';
const gkcSealSvg=()=>`<svg viewBox="-12 -12 24 24" aria-hidden="true"><polygon points="${gkcHex(10.5)}" fill="rgba(var(--gkc-rgb),.16)" stroke="var(--gkc-ln)" stroke-width="1.6" stroke-linejoin="round"/><path d="M-4.6 .3l3.1 3.1 6-6.2" fill="none" stroke="var(--gkc-ln)" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const gkcPlace=r=>r.rank?`${r.rank}<i>位</i>`:`${r.rate||'—'}<i>レート</i>`;
const gkcFmt=f=>f==='double'?'ダブル':'シングル';
const PF_RES_N=3;
/* シーズンの戦績（IA §7・A23）：確認済みだけで見出し（最高位）と新しい3件＋もっと見る。自己申告は別のまとまりで、どの行にも「自己申告」。
   記事から集計・運営が登録はサーバーがカードに送らない */
function gkcRecord(rs){
  rs=rs||[];const v=rs.filter(r=>r.source==='verified'),s=rs.filter(r=>r.source!=='verified');
  if(!rs.length)return '';
  const best=v.length?v.slice().sort((a,b)=>(a.rank||1e9)-(b.rank||1e9)||(b.rate||0)-(a.rate||0))[0]:null;
  const row=r=>`<li class="gkc-rr">${gkcTier(r)}<span class="gkc-rr-m"><b data-notr>${esc(r.season)}</b><small>${gkcFmt(r.fmt)}・${gkcTierName(r)}</small></span><span class="gkc-rr-p num">${gkcPlace(r)}</span><span class="gkc-seal" title="確認済み" aria-label="確認済み">${gkcSealSvg()}</span></li>`;
  const srow=r=>`<li class="gkc-rr">${gkcTier(r,1)}<span class="gkc-rr-m"><b data-notr>${esc(r.season)}</b><small>${gkcFmt(r.fmt)}</small></span><span class="gkc-rr-p num">${gkcPlace(r)}</span><span class="gkc-srt">自己申告</span></li>`;
  return `<div class="gkc-rec"><div class="gkc-rh"><h3>シーズンの戦績</h3><button class="gkc-what" id="gkc-what">${SVG(PF_I.info,15)}確認済みとは</button></div>
    ${best?`<div class="gkc-best"><div class="gkc-best-n num">${best.rank?`<b>${best.rank}</b><i>位</i>`:`<b>${best.rate}</b><i>レート</i>`}</div><div class="gkc-best-m"><small>最高位</small><b data-notr>${esc(best.season)}・${gkcFmt(best.fmt)}</b><span>${gkcTierName(best)}</span></div><span class="gkc-seal lg">${gkcSealSvg()}確認済み</span></div>
      <ul class="gkc-rl" aria-label="確認済みの戦績">${v.slice(0,PF_RES_N).map(row).join('')}</ul>
      ${v.length>PF_RES_N?`<details class="gkc-more"><summary>もっと見る（${v.length-PF_RES_N}件）${SVG(I.chev,15)}</summary><ul class="gkc-rl">${v.slice(PF_RES_N).map(row).join('')}</ul></details>`:''}`:''}
    ${s.length?`<div class="gkc-self" aria-label="自己申告の戦績"><h4>自己申告 <small>運営者の確認はまだです</small></h4><ul class="gkc-rl">${s.map(srow).join('')}</ul></div>`:''}</div>`;
}
/* 看板パーティ（ポケモンだけ。育成は出さない） */
function gkcShowcase(u){
  const sc=u.showcase,ms=sc&&Array.isArray(sc.t)?sc.t.map(no=>byNo[no]).filter(Boolean):[];
  if(!ms.length)return u.me?`<button class="gkc-addrow" id="pf-edit2">${SVG(PF_I.edit,16)}<span><b>看板パーティを選ぶ</b><small>自分のパーティから1つ選ぶと、ここに6匹が並びます</small></span></button>`:'';
  return `<div class="gkc-sc"><div class="gkc-sc-h"><h3>看板パーティ</h3>${sc.n?`<span data-notr>${esc(sc.n)}</span>`:''}${u.me?`<button class="gkc-ed" id="pf-edit4" aria-label="看板パーティを編集">${SVG(PF_I.edit,15)}</button>`:''}</div>
    <div class="gkc-sc-g">${ms.map(p=>`<a href="#/p/${p.no}" class="gkc-mon"><span class="gkc-sig gkc-sig--m" style="--t1:${COL[p.t[0]]}">${stamp(p)}</span><small>${esc(p.n)}</small></a>`).join('')}</div>
    <a class="gkc-sc-go" href="#/share/${ms.map(p=>p.no).join('-')}">このパーティを見る ${SVG(I.chev,15)}</a></div>`;
}
/* ===== 2026/11/18 作りかえ：ふつうのプロフィール（#/u/ID）と、別に開くゲームカードを分ける =====
   ・ふつうのプロフィール＝名前・@ID・印・フォロー/メッセージ・自己紹介・利用開始・数・（あれば）ゲームカードへの入口 → すぐ下に投稿／画像
   ・ゲームカード＝V3.4 のカード（選手の写真＝アイコン・ゲームの名札・自己紹介・戦績・看板パーティ）。上に重ねて開き、閉じると同じ画面に戻る
   ・ゲームカードは作らなくてもよい。戦績がなくても作れる（ゲーム・相棒・自己紹介だけでもよい）
   ・見られない人・作っていない人には、ゲームカードがあることも出さない（サーバーが games を空にする） */
/* カードがあるのは、本人が作った（サーバーの created）ときだけ。相棒・看板パーティ・戦績からは決めない（2026/11/18） */
const gkcCardOf=u=>{const g=u.games&&u.games.pokechamp;return g&&g.created&&!u.locked?g:null};
/* ゲームの名札（カードの中） */
function gkcPlate(u,g){
  const pp=u.partner&&byNo[u.partner],rs=u.results||[];
  const vis=u.me&&g.eff&&g.eff!=='public'?`<span class="gkc-vis" title="${esc(pfVisNote(g))}">${SVG(I.lock,12)}${PF_VIS[g.eff]}</span>`:'';
  const plateIn=`<span class="gkc-sig gkc-sig--l">${GKC_EMBLEM.pokechamp()}</span><span class="gkc-gp-t"><b>${esc(pfGameName('pokechamp'))}${vis}</b>
    <span>${pp?`<em>相棒</em><span class="gkc-sig gkc-sig--xs" style="--t1:${COL[pp.t[0]]}">${stamp(pp)}</span><span data-notr>${esc(pp.n)}</span>`:u.me?'<em>相棒を選ぶ</em>':''}</span></span>`;
  const plate=u.me?`<button class="gkc-gp" id="pf-edit" aria-label="ゲームカードを編集">${plateIn}<span class="gkc-gp-x">${SVG(PF_I.edit,17)}</span></button>`
    :pp?`<a class="gkc-gp" href="#/p/${pp.no}">${plateIn}<span class="gkc-gp-x">${SVG(I.chev,17)}</span></a>`:`<div class="gkc-gp">${plateIn}</div>`;
  /* 事実は戦績があるときだけ（戦績がない人を「戦績なし」と見せない） */
  const v=rs.filter(r=>r.source==='verified').length;
  const fm=(()=>{const c={};rs.forEach(r=>c[r.fmt]=(c[r.fmt]||0)+1);const k=Object.keys(c).sort((a,b)=>c[b]-c[a])[0];return k?gkcFmt(k):''})();
  const facts=rs.length?`<div class="gkc-gf"><div><small>主な形式</small><b>${fm}</b></div>${v?`<div><small>確認済みの戦績</small><b class="num">${v}件</b></div>`:''}</div>`:'';
  return plate+facts;
}
/* ゲームカード（重ねて開く） */
function gkcCardHTML(u,g){
  const pp=u.partner&&byNo[u.partner];
  return `<div class="gkcm-bg" data-gkcx></div>
  <div class="gkcm-p gkc-page" role="dialog" aria-modal="true" aria-labelledby="gkcm-t">
    <div class="gkcm-top"><b id="gkcm-t">ゲームカード</b><button class="gkc-ic" data-gkcx aria-label="閉じる">${SVG(I.x,18)}</button></div>
    <section class="gkc gkc--card" aria-label="${esc(pfGameName('pokechamp'))}のゲームカード">
      <div class="gkc-cv">${gkcCover(pp)}</div>
      <div class="gkc-idr"><span class="gkc-av gkc-av--xl" style="background:${avCol(u.handle)}" data-notr>${avIn(u)}</span></div>
      <div class="gkc-who"><h2 class="gkc-nm"><span data-notr>${esc(u.name)}</span>${u.private?`<span class="gkc-lk" aria-label="非公開アカウント">${SVG(I.lock,16)}</span>`:''}</h2><div class="gkc-hd"><span>@${esc(u.handle)}</span></div>
        ${u.bio?`<p class="gkc-bio" data-notr>${linkTags(u.bio)}</p>`:''}</div>
      <section class="gkc-gm">${gkcPlate(u,g)}${gkcRecord(u.results)}${gkcShowcase(u)}</section>
    </section>
  </div>`;
}
/* ゲームカードの開け閉め（2026/11/18）。
   ・開くと、同じアドレスのまま履歴を1つ足す（history.pushState({gkc})）。ブラウザ・Android の「戻る」はカードだけ閉じる
     （ルーターはアドレスが同じ popstate では描き直さない＝06-router.js の onPop。プロフィールとスクロールはそのまま）
   ・✕・Esc・後ろで閉じると、足した履歴を戻して消す（戻る・進むがずれない）
   ・カードの中のリンクで別の画面へ行くときは、先にカードを閉じて履歴をもどしてから移る
   ・編集はカードを隠して開く。やめる＝同じカードに戻る、保存＝新しい中身で同じカードに戻る（履歴は足さない） */
let GKC_OPEN=null,GKC_SKIP=false,GKC_AFTER='';
function gkcBind(o,u){
  o.querySelectorAll('[data-gkcx]').forEach(b=>b.onclick=()=>gkcClose());
  const gw=o.querySelector('#gkc-what');if(gw)gw.onclick=()=>askConfirm({title:'確認済みとは',text:'確認済み＝運営者が証拠のスクリーンショットで、順位とパーティを確かめた結果です。自己申告＝本人が登録した結果です（まだ確かめていません）。結果はシーズンの結果の画面から登録します。',ok:'閉じる',danger:false});
  ['pf-edit','pf-edit2','pf-edit4'].forEach(id=>{const b=o.querySelector('#'+id);if(b)b.onclick=()=>gkcEdit(u)});
}
function gkcOpen(u,from){
  const g=gkcCardOf(u);if(!g)return;if(GKC_OPEN)gkcClose(true);
  const o=document.createElement('div');o.className='gkcm';o.innerHTML=gkcCardHTML(u,g);document.body.appendChild(o);document.body.classList.add('gkcm-on');
  gkcBind(o,u);
  /* カードの中のリンク：カードを閉じて履歴を戻してから移る（戻るでカードの空の履歴に止まらないように） */
  o.addEventListener('click',e=>{const a=e.target.closest('a[href^="#/"]');if(!a||e.metaKey||e.ctrlKey)return;e.preventDefault();e.stopPropagation();
    GKC_AFTER=a.getAttribute('href');gkcClose(true)});
  const key=e=>{if(o.classList.contains('gkcm-off'))return;if(e.key==='Escape'){e.preventDefault();gkcClose()}
    if(e.key==='Tab'){const f=[...o.querySelectorAll('a[href],button:not([disabled]),summary')].filter(x=>x.offsetParent);if(!f.length)return;
      if(e.shiftKey&&document.activeElement===f[0]){e.preventDefault();f[f.length-1].focus()}else if(!e.shiftKey&&document.activeElement===f[f.length-1]){e.preventDefault();f[0].focus()}}};
  document.addEventListener('keydown',key);
  const hc=()=>{if(GKC_OPEN&&GKC_OPEN.o===o)gkcRemove()};addEventListener('hashchange',hc);
  let pushed=false;try{history.pushState({gkc:u.handle},'',location.href);pushed=true}catch(e){}
  GKC_OPEN={o,key,hc,from,u,pushed,edit:null};
  requestAnimationFrame(()=>{o.classList.add('on');const x=o.querySelector('.gkcm-top [data-gkcx]');if(x)x.focus()});
}
/* 画面から消すだけ（履歴は触らない） */
function gkcRemove(focus){
  if(!GKC_OPEN)return;const {o,key,hc,from,edit}=GKC_OPEN;GKC_OPEN=null;
  if(edit)try{edit()}catch(e){}
  document.removeEventListener('keydown',key);removeEventListener('hashchange',hc);document.body.classList.remove('gkcm-on');
  o.classList.remove('on');setTimeout(()=>o.remove(),focus?180:0);
  if(focus&&from&&from.isConnected)from.focus();
}
/* 閉じる（✕・Esc・後ろ）：消して、足した履歴を戻す */
function gkcClose(quiet){
  if(!GKC_OPEN)return;const pushed=GKC_OPEN.pushed;gkcRemove(!quiet);
  if(pushed&&history.state&&history.state.gkc){GKC_SKIP=true;history.back()}
  else if(GKC_AFTER){const h=GKC_AFTER;GKC_AFTER='';nav(h)}
}
addEventListener('popstate',()=>{
  if(GKC_SKIP){GKC_SKIP=false;if(GKC_AFTER){const h=GKC_AFTER;GKC_AFTER='';setTimeout(()=>nav(h),0)}return}
  if(GKC_OPEN){gkcRemove(true);return}   /* 戻る：カードだけ閉じる */
  /* カードが開いていないのにカードの履歴に来た（「進む」で古いカードの履歴へ）：何も開かず、1つ戻ってふつうの履歴に */
  if(history.state&&history.state.gkc){GKC_SKIP=true;history.back()}
});
/* 読み直したとき、カードの履歴の上にいたら（カードを開いたまま読み直した）：カードは開かず、1つ戻ってその下のふつうの履歴に立つ。
   前は書きかえていたので、同じプロフィールの履歴が2つ重なり、次の「戻る」が1回きかなかった（2026/11/18） */
try{if(history.state&&history.state.gkc){GKC_SKIP=true;history.back()}}catch(e){}
/* カードから編集：カードは隠すだけ。やめる＝同じカード、保存＝読み直した中身で同じカード */
function gkcEdit(u){
  if(!GKC_OPEN)return;const G=GKC_OPEN;G.o.classList.add('gkcm-off');
  G.edit=pfEdit(u,async()=>{G.edit=null;
      let nu=u;try{nu=(await authFetch('/api/u/'+u.handle)).user}catch(e){}
      pfHeadRefresh(nu);
      if(GKC_OPEN!==G)return;const g=gkcCardOf(nu);if(!g){gkcClose();return}
      G.u=nu;G.o.innerHTML=gkcCardHTML(nu,g);gkcBind(G.o,nu);G.o.classList.remove('gkcm-off');const x=G.o.querySelector('.gkcm-top [data-gkcx]');if(x)x.focus()},
    {onCancel:()=>{G.edit=null;if(GKC_OPEN!==G)return;G.o.classList.remove('gkcm-off');const b=G.o.querySelector('#pf-edit')||G.o.querySelector('[data-gkcx]');if(b)b.focus()}});
}
/* アイコンを大きく見る（ゲームカードがないとき）：写真なら画像を見る画面、写真がなければ大きな頭文字 */
function gkcAvatarView(u){
  if(u.av&&/^[0-9a-f]{32}$/.test(u.av)&&typeof twViewer==='function')return twViewer([u.av],0);
  const o=document.createElement('div');o.className='gkl';o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');o.setAttribute('aria-label',`${u.name}のアイコン`);
  o.innerHTML=`<span class="gkl-av" style="background:${avCol(u.handle)}" data-notr>${esc((u.name||'?').slice(0,1))}</span><button class="gkc-ic gkl-x" aria-label="閉じる">${SVG(I.x,20)}</button>`;
  document.body.appendChild(o);const close=()=>{document.removeEventListener('keydown',key);o.remove()};const key=e=>{if(e.key==='Escape')close()};
  document.addEventListener('keydown',key);o.onclick=close;addEventListener('hashchange',close,{once:true});o.querySelector('.gkl-x').focus();
}
/* ふつうのプロフィール */
function gkcHTML(u,isMuted){
  const g=gkcCardOf(u),pp=u.partner&&byNo[u.partner];
  const acts=u.me?`<button class="gkc-ic" id="pf-share" aria-label="プロフィールのリンクをコピー">${SVG(PF_I.link,18)}</button><button class="gkc-btn gkc-btn--s" id="pf-editp">プロフィールを編集</button>`
    :`<button class="gkc-ic" id="pf-share" aria-label="プロフィールのリンクをコピー">${SVG(PF_I.link,18)}</button><a class="gkc-ic" id="pf-dm" href="#/messages/${esc(u.handle)}" aria-label="メッセージを送る" title="メッセージを送る">${SVG(I.mail,18)}</a>
      <button class="gkc-btn ${u.followed||u.requested?'gkc-btn--s':'gkc-btn--p'}" id="twp-f">${pfFollowTxt(u)}</button>`;
  const entry=g?`<button class="gkp-card" id="pf-card" aria-haspopup="dialog"><span class="gkc-sig gkc-sig--s">${GKC_EMBLEM.pokechamp()}</span><span class="gkp-card-t"><b>ゲームカード</b><small>${esc(pfGameName('pokechamp'))}${pp?`・相棒 <span data-notr>${esc(pp.n)}</span>`:''}</small></span>${SVG(I.chev,16)}</button>`
    :u.me&&!u.locked?`<button class="gkp-mk" id="pf-edit3">${SVG(PF_I.plus,15)}ゲームカードを作る</button>`:'';
  return `<div class="pf gkc-page gkp">
  <section class="gkp-head" aria-label="プロフィール">
    <div class="gkp-cv" aria-hidden="true">${gkcCover(null)}</div>
    <div class="gkp-idr"><button class="gkp-av${u.card&&g?' gk-cr gk-cr--lg':''}" id="pf-av" style="background:${avCol(u.handle)}" aria-label="${g?`${esc(u.name)}のゲームカードを開く`:`${esc(u.name)}のアイコンを大きく見る`}" data-notr>${avIn(u)}</button><div class="gkc-acts">${acts}</div></div>
    <div class="gkp-id"><h2 class="gkp-nm"><span data-notr>${esc(u.name)}</span>${u.private?`<span class="gkc-lk" title="非公開アカウント" aria-label="非公開アカウント">${SVG(I.lock,16)}</span>`:''}</h2>
      <div class="gkp-hd"><span>@${esc(u.handle)}</span>${u.follows_me?'<span class="gkc-fm">フォローされています</span>':''}</div></div>
    ${u.bio?`<p class="gkp-bio" data-notr>${linkTags(u.bio)}</p>`:''}
    <div class="gkp-sub"><span class="gkc-since">${SVG(PF_I.cal,14)}${L('利用開始：','Joined ')}${pfMonth(u.created_at)}</span></div>
    <div class="gkp-meta pf-stats"><span class="gkc-st num"><b>${pfNum(u.notes)}</b>投稿</span>
      <button class="gkc-st pf-st-b num" data-fl="followers" data-flh="${esc(u.handle)}" data-fln="${esc(u.name)}" aria-label="フォロワーの一覧を見る"><b id="twp-fc">${pfNum(u.followers)}</b><span>フォロワー</span></button>
      <button class="gkc-st pf-st-b num" data-fl="following" data-flh="${esc(u.handle)}" data-fln="${esc(u.name)}" aria-label="フォロー中の一覧を見る"><b>${pfNum(u.following)}</b><span>フォロー中</span></button></div>
    ${entry}
    ${u.locked?`<div class="gkc-lock gkp-lock">${SVG(I.lock,20)}<span><b>このアカウントは非公開です</b>フォローが許可されると、投稿を見られます。</span></div>`:''}
  </section>
  ${u.me&&(u.private||FREQ_N)?`<a class="pf-fq gkc-fq" href="#/requests">${SVG(I.user,18)}<span>フォローリクエスト</span><b id="pf-fq-n">${FREQ_N?FREQ_N+'件':''}</b>${SVG(I.chev,16)}</a>`:''}
  ${isMuted?`<div class="bnote" style="margin:8px 12px 0">この人の投稿は、あなたの画面では表示しない設定です。<button class="bback" id="twp-um" style="padding:0">表示する</button></div>`:''}
  ${u.locked?'':`<div class="pf-tabs gkc-tabs gkp-tabs" role="tablist"><button role="tab" aria-selected="true" data-pt="all">${SVG(PF_I.post,17)}投稿</button><button role="tab" aria-selected="false" data-pt="media">${SVG(PF_I.img,17)}画像</button></div>`}
  </div><div id="twp-list"></div>`;
}
/* ゲームの公開範囲（本人だけに見える札） */
const PF_VIS={inherit:'アカウントに合わせる',public:'公開',followers:'フォロワーのみ',only_me:'自分だけ'};
const pfVisNote=g=>g&&g.capped?'アカウントが非公開のため、このゲームのプロフィールはフォロワーのみに表示されています。':'';
/* フォローのボタンの文字（非公開アカウントにはリクエスト、2026/11/11） */
const pfFollowTxt=u=>u.followed?'フォロー中':u.requested?'リクエスト中':u.private?'フォローをリクエスト':'フォローする';
/* プロフィールの上の部分（名前・ボタン・入口）を結びつける。カードを作った・直したあとは pfHeadRefresh でここだけ描き直す（投稿とスクロールはそのまま） */
function pfBindHead(u){
  const h=u.handle;
  /* フォロー */
  const fb=document.getElementById('twp-f');
  if(fb)fb.onclick=async()=>{
    if(!AUTH.profile){toast(AUTH.user?'先にプロフィールを作ってください':'フォローするにはログインしてください');nav('#/account');return}
    const on=!u.followed&&!u.requested;fb.disabled=true;
    try{const j=await authFetch('/api/follow',{handle:u.handle,on});u.followed=j.followed;u.requested=!!j.requested;fb.textContent=pfFollowTxt(u);fb.className='gkc-btn '+(j.followed||j.requested?'gkc-btn--s':'gkc-btn--p');document.getElementById('twp-fc').textContent=pfNum(j.followers);
      if(j.requested&&on)toast('フォローのリクエストを送りました。相手が許可するとフォローになります')}
    catch(e){toast(e.message)}finally{fb.disabled=false}};
  /* リンクのコピー */
  document.getElementById('pf-share').onclick=()=>{const url=SITE_BASE()+'/#/u/'+u.handle;
    (navigator.clipboard?navigator.clipboard.writeText(url):Promise.reject()).then(()=>toast('プロフィールのリンクをコピーしました')).catch(()=>prompt('リンクをコピーしてください',url))};
  /* プロフィールを編集＝画面の上に開く（69-profile-edit.js、2026/11/11） */
  const pe=document.getElementById('pf-editp');if(pe)pe.onclick=()=>profEditOpen();
  /* ゲームカードを作る（ふつうのプロフィールから）：やめる＝何もしない、保存＝入口を出してカードを開く */
  const mk=document.getElementById('pf-edit3');if(mk)mk.onclick=()=>pfEdit(u,async()=>{let nu=u;try{nu=(await authFetch('/api/u/'+u.handle)).user}catch(e){}
    pfHeadRefresh(nu);const e2=document.getElementById('pf-card');if(gkcCardOf(nu))gkcOpen(nu,e2||document.getElementById('pf-av'))},{onCancel:()=>{const b=document.getElementById('pf-edit3');if(b)b.focus()}});
  /* ゲームカード：入口とアイコン。カードがなければアイコンを大きく見る */
  const cb=document.getElementById('pf-card');if(cb)cb.onclick=()=>gkcOpen(u,cb);
  const av=document.getElementById('pf-av');if(av)av.onclick=()=>gkcCardOf(u)?gkcOpen(u,av):gkcAvatarView(u);
}
function pfHeadRefresh(nu){
  const cur0=document.querySelector('.gkp-head');if(!cur0||!nu)return;
  const t=document.createElement('div');t.innerHTML=gkcHTML(nu,false);const nh=t.querySelector('.gkp-head');if(!nh)return;
  cur0.replaceWith(nh);pfBindHead(nu);
}
async function userView(h){
  {const sub=(cur.replace(/^#\/?/,'').split('/')[2]||'');if(sub==='followers'||sub==='following')return followListView(h,sub)}
  setHeader('プロフィール','#/tl');
  if(!/^[A-Za-z0-9_]{3,15}$/.test(h||'')){V.innerHTML='<p class="empty">ユーザーが見つかりません。</p>';return}
  V.innerHTML='<p class="empty">読み込み中…</p>';
  await twAuth();if(keyOf(cur)!=='u')return;
  let u;try{u=(await authFetch('/api/u/'+h)).user}catch(e){V.innerHTML=`<div class="bnote" style="margin:16px">${esc(e.message)}</div>`;return}
  setHeader(esc(u.name),'#/tl');
  const isMuted=muted().has(u.handle.toLowerCase());
  V.innerHTML=gkcHTML(u,isMuted);
  pfBindHead(u);
  const um=document.getElementById('twp-um');if(um)um.onclick=()=>{const s=muted();s.delete(u.handle.toLowerCase());lsW('pcmute',[...s]);userView(h)};
  /* 投稿／画像 */
  const list=document.getElementById('twp-list');
  const load=t=>{if(isMuted)return;list.innerHTML='';
    if(u.locked)return; /* 非公開の知らせはカードの中（gkc-lock）に1回だけ */twFeed(list,`/api/u/${u.handle}/notes${t==='media'?'?media=1':''}`,t==='media'?'まだ画像つきの投稿がありません。':'まだ投稿がありません。')};
  V.querySelectorAll('[data-pt]').forEach(b=>b.onclick=()=>{if(b.getAttribute('aria-selected')==='true')return;
    V.querySelectorAll('[data-pt]').forEach(x=>x.setAttribute('aria-selected',String(x===b)));load(b.dataset.pt)});
  load('all');

}
/* カードを編集：相棒と看板パーティ */
function pfEdit(u,done,opt={}){
  const creating=!gkcCardOf(u);
  let partner=u.partner||null,sc=u.showcase&&u.showcase.t?{n:u.showcase.n||'',t:u.showcase.t.slice()}:null;
  const g0=u.games&&u.games.pokechamp||{};let vis=g0.vis||'inherit';
  const teams=(typeof TEAMS!=='undefined'?TEAMS.list:[]).map((x,i)=>({i,n:teamName(i),t:(i===TEAMS.cur?team:x.team).map(m=>m.no).filter(no=>byNo[no])})).filter(x=>x.t.length);
  const o=document.createElement('div');o.className='psheet';
  const draw=()=>{
    const p=partner&&byNo[partner];
    o.innerHTML=`<div class="psheet-bg"></div><div class="psheet-p pf-ed" role="dialog" aria-modal="true" aria-label="${creating?'ゲームカードを作る':'ゲームカードを編集'}">
      <h3>${creating?'ゲームカードを作る':'ゲームカードを編集'}</h3>${creating?'<p class="note" style="padding:0 0 4px">戦績がなくても作れます。相棒や看板パーティは、あとからでもかまいません。</p>':''}
      <div class="pf-ed-l">相棒のポケモン</div>
      <p class="note" style="padding:0 0 8px">プロフィールの上の帯が、相棒のタイプの色になります。</p>
      <div class="pf-ed-p">${p?`<span class="pf-chip" style="--t1:${COL[p.t[0]]}"><span class="pf-chip-s">${stamp(p)}</span><b>${esc(p.n)}</b></span>`:'<span class="note" style="padding:0">まだ選んでいません</span>'}
        <button class="btn btn-s pf-b" data-ed="pick">${p?'変える':'選ぶ'}</button>${p?'<button class="btn btn-s pf-b" data-ed="nop">外す</button>':''}</div>
      <div class="pf-ed-l">看板パーティ</div>
      <p class="note" style="padding:0 0 8px">保存しているパーティから選びます。ポケモンだけを見せます（育成の中身は見せません）。</p>
      <div class="pf-ed-t">${teams.length?teams.map(x=>{const on=sc&&sc.t.join()===x.t.join();
        return `<button class="pf-ed-team${on?' on':''}" data-team="${x.i}"><b>${esc(x.n)}</b><span>${x.t.map(no=>`<i>${stamp(byNo[no])}</i>`).join('')}</span></button>`}).join(''):'<p class="note" style="padding:0">保存しているパーティがありません。パーティの画面で作ってから選べます。</p>'}
        ${sc?'<button class="btn btn-s pf-b" data-ed="nosc" style="margin-top:8px">看板パーティを外す</button>':''}</div>
      <div class="pf-ed-l">このゲームのプロフィールを見られる人</div>
      <p class="note" style="padding:0 0 8px">相棒・看板パーティ・シーズンの実績が対象です。アカウントの公開範囲より広くはなりません。</p>
      <div class="pills pf-ed-vis" role="radiogroup">${Object.entries(PF_VIS).map(([k,t])=>`<button class="pill" role="radio" data-vis="${k}" aria-checked="${vis===k}" aria-pressed="${vis===k}">${t}</button>`).join('')}</div>
      ${u.private&&(vis==='public'||vis==='inherit')?`<p class="note pf-ed-cap">アカウントが非公開のため、このゲームのプロフィールはフォロワーのみに表示されています。</p>`:''}
      <div class="btns" style="padding:16px 0 4px"><button class="btn btn-s" data-ed="x">やめる</button><button class="btn btn-p" data-ed="save">保存する</button></div>
    </div>`;
  };
  draw();document.body.appendChild(o);requestAnimationFrame(()=>o.classList.add('on'));
  setTimeout(()=>{const f=o.querySelector('[data-ed="pick"]');if(f)f.focus()},60);
  const close=()=>{removeEventListener('hashchange',close);o.classList.remove('on');setTimeout(()=>o.remove(),180)};
  const cancel=()=>{close();opt.onCancel&&opt.onCancel()};
  addEventListener('hashchange',close);
  o.addEventListener('click',async e=>{
    if(e.target.closest('.psheet-bg'))return cancel();
    const tb=e.target.closest('[data-team]');if(tb){const x=teams.find(y=>y.i===+tb.dataset.team);sc={n:x.n,t:x.t.slice()};draw();return}
    const vb=e.target.closest('[data-vis]');if(vb){vis=vb.dataset.vis;draw();return}
    const b=e.target.closest('[data-ed]');if(!b)return;const k=b.dataset.ed;
    if(k==='x')return cancel();
    if(k==='nop'){partner=null;draw();return}
    if(k==='nosc'){sc=null;draw();return}
    if(k==='pick'){const v=await pickMon(partner||0);if(v){partner=v;draw()}return}
    if(k==='save'){b.disabled=true;try{await authFetch('/api/me/card',{partner,showcase:sc,vis,card:true});toast(creating?'ゲームカードを作りました':'ゲームカードを保存しました');close();done&&done()}catch(err){toast(err.message);b.disabled=false}}
  });
  return close;
}
