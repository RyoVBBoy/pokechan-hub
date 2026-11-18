/* ===================== ツールの画面の「画面で見る使い方」（2026/11/16 依頼主：はじめての人向けに、実際の画面の画像で、どこを押すと何が起きるかを短く） =====================
   ・画像は当サイトの実際の画面を tools/gen-guide.cjs（Playwright）で撮ったもの（src/static/guide-*.webp）。公式の画像・ほかのサイトの画像は使わない。
     押す場所の丸い枠は画像に焼きこまず、撮ったときの位置（83-guide-shots.js の TG_SHOTS、画像に対する％）に重ねて描く。画面を変えたら撮り直す。
   ・ツールの画面のいちばん上に、はじめてだけ小さなカード（見る／×）。見終わるか×で、その端末では次から出さない（localStorage pctoolsguide）。
     「まずはこの3つ」の見出しの横の「使い方を見る」と、ヘルプのツールの使い方の一覧から、いつでも見直せる。
   ・画像の上の％の枠がずれないよう、枠（.tg-fig）を画像と同じ縦横の比にし、高さが --tg-mh（パソコン50%・スマホ58%）を超えないよう幅で縮める。
   ・見た目（2026/11/16 依頼主）：すりガラスのカード・押す場所はテーマの色のスポットライト（太い黄色の枠はやめた）・画像はいまの明るさに合うもの。
     スマホは画面いっぱいで、画像と説明（.tg-body）を上下の真ん中に置き、下のボタンとのあいだに大きな空きを作らない。
   ・テストの画面ではカードを出さない（73-help.js の howtoTip と同じ。位置を調べるほかのテストがずれるため）。pchowtotest=1 のときだけ出す */
const TG_STEPS=[
  {s:'tools',t:'まずはこの3つから',d:'迷ったら、ここの3つから。押すとそのツールが開きます。'},
  {s:'calc',t:'ダメージを調べる',d:'「攻撃する」「受ける」を押してポケモンを選ぶと、すぐ下にダメージ（％）と何回で倒せるかが出ます。'},
  {s:'team',t:'パーティを作る',d:'「ポケモンを1匹ずつ選ぶ」で6匹を入れると、弱点のチェックとおすすめの選出が見られます。'},
  {s:'pin',t:'よく使うツールを手元に',d:'☆を押したツールが「すぐ使う」の先頭に並びます。'}
].filter(x=>typeof TG_SHOTS!=='undefined'&&TG_SHOTS[x.s]&&LANG!=='en');
/* 英語のときは出さない：画像は日本語の画面なので、英語の画面とちがって見え、かえって迷わせるため */
/* いまの明るさに合う画像（d＝暗い色・l＝明るい色）。前の形（f・h・r が直接ある）も読める */
function tgShot(st){const S=TG_SHOTS[st.s],light=document.documentElement.getAttribute('data-theme')==='light';
  const v=(light?S.l:S.d)||S.d||S.l||S;return{f:v.f,w:S.w||v.w,h:v.h,r:v.r}}
const tgSeen=()=>{try{return localStorage.getItem('pctoolsguide')==='1'}catch(e){return true}};
function tgDone(){try{localStorage.setItem('pctoolsguide','1')}catch(e){}}
function toolsGuideCardHTML(){
  if(!TG_STEPS.length||tgSeen())return '';
  try{if(navigator.webdriver&&localStorage.getItem('pchowtotest')!=='1')return ''}catch(e){}
  return `<section class="tg-card" aria-labelledby="tg-card-h"><span class="tg-card-i">${SVG(I.help,20)}</span>
    <div class="tg-card-m"><b id="tg-card-h">はじめての方へ</b><span>画面で見る使い方（${TG_STEPS.length}ステップ）</span></div>
    <button class="btn btn-p btn-s" data-tg-open>見る</button><button class="tg-x" data-tg-x aria-label="使い方のカードを閉じる">${SVG(I.x,18)}</button></section>`;
}
function toolsGuideLinkHTML(){return TG_STEPS.length?`<button class="tg-link" data-tg-open>${SVG(I.help,16)}使い方を見る</button>`:''}
function toolsGuideBind(root){
  root.querySelectorAll('[data-tg-open]').forEach(b=>b.onclick=()=>toolsGuideOpen(b));
  const x=root.querySelector('[data-tg-x]');
  if(x)x.onclick=()=>{tgDone();const c=x.closest('.tg-card');if(c)c.remove();const l=document.querySelector('.tg-link');if(l)l.focus()};
}
/* 1ステップずつ見る画面（中央のカード。スマホは画面いっぱい）。←→・Esc・前へ／次へ。閉じたら押したボタンに戻る */
function toolsGuideOpen(from){
  if(!TG_STEPS.length||document.querySelector('.tg-v'))return;
  let k=0;
  const d=document.createElement('div');d.className='tg-v';
  d.innerHTML=`<div class="tg-bk" data-tg-close></div><div class="tg-p" role="dialog" aria-modal="true" aria-labelledby="tg-t" tabindex="-1">
    <div class="tg-hd"><span class="tg-n" aria-live="polite"></span><button class="tg-close" data-tg-close aria-label="閉じる">${SVG(I.x,20)}</button></div>
    <div class="tg-body"><div class="tg-fig"><img class="tg-img" alt="" decoding="async"><span class="tg-ring" aria-hidden="true"></span></div>
    <h2 id="tg-t"></h2><p class="tg-d"></p>
    <div class="tg-dots" aria-hidden="true">${TG_STEPS.map(()=>'<i></i>').join('')}</div></div>
    <div class="tg-ft"><button class="btn btn-s tg-prev">前へ</button><button class="btn btn-p tg-next">次へ</button></div></div>`;
  document.body.appendChild(d);
  const $=s=>d.querySelector(s),img=$('.tg-img'),ring=$('.tg-ring');
  const draw=()=>{const st=TG_STEPS[k],sh=tgShot(st);
    img.src=sh.f;img.width=sh.w;img.height=sh.h;$('.tg-fig').style.width=`min(100%,calc(var(--tg-mh) * ${(sh.w/sh.h).toFixed(4)}))`;
    img.alt=`実際の画面：${st.t}（枠で囲んだところを押します）`;
    ring.style.cssText=`left:${sh.r[0]}%;top:${sh.r[1]}%;width:${sh.r[2]}%;height:${sh.r[3]}%`;
    ring.classList.remove('tg-pulse');void ring.offsetWidth;if(!reduceMotion)ring.classList.add('tg-pulse');
    $('.tg-n').textContent=`${k+1} / ${TG_STEPS.length}`;$('#tg-t').textContent=st.t;$('.tg-d').textContent=st.d;
    d.querySelectorAll('.tg-dots i').forEach((e,i)=>e.classList.toggle('on',i===k));
    $('.tg-prev').disabled=k===0;$('.tg-next').textContent=k===TG_STEPS.length-1?'はじめる':'次へ'};
  const close=()=>{tgDone();document.removeEventListener('keydown',key,true);d.remove();
    const c=document.querySelector('.tg-card');if(c)c.remove();
    const back=from&&document.body.contains(from)?from:document.querySelector('.tg-link');if(back)back.focus()};
  const go=n=>{if(n<0)return;if(n>=TG_STEPS.length){close();return}k=n;draw()};
  const key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close()}
    else if(e.key==='ArrowRight'){e.preventDefault();go(k+1)}else if(e.key==='ArrowLeft'){e.preventDefault();go(k-1)}
    else if(e.key==='Tab'){const f=[...d.querySelectorAll('button:not(:disabled)')];if(!f.length)return;const i=f.indexOf(document.activeElement);
      if(e.shiftKey&&i<=0){e.preventDefault();f[f.length-1].focus()}else if(!e.shiftKey&&i===f.length-1){e.preventDefault();f[0].focus()}}};
  document.addEventListener('keydown',key,true);
  d.querySelectorAll('[data-tg-close]').forEach(b=>b.onclick=close);
  $('.tg-prev').onclick=()=>go(k-1);$('.tg-next').onclick=()=>go(k+1);
  draw();$('.tg-next').focus();
}
