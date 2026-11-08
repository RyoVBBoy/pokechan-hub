/* ===================== 引っぱって更新（2026/11/03 依頼主の要望。昔の Twitter アプリのように） =====================
   ・ホーム（とタイムライン）でいちばん上にいるとき、下に引っぱると上に矢印が出て、指を離すと読み直す
   ・音：引っぱって「離せば更新」になったところで「シュボッ」（約0.18秒）、読み終わったら「パッ」。
     音はファイルを使わず、その場で作る（Web Audio。Twitter の音そのものではなく、似た感じの短い音）。
     iPhone のマナーモード（消音）では鳴らさない（navigator.audioSession を ambient にする） */
const PTR={on:false,y0:0,x0:0,d:0,lock:0,armed:false,busy:false,el:null,ctx:null,TH:72};
const ptrPage=()=>{const k=keyOf(cur);return k===''||k==='tl'};
function ptrEl(){
  if(PTR.el)return PTR.el;
  const e=document.createElement('div');e.className='ptr';e.setAttribute('aria-hidden','true');
  e.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path class="ptr-a" d="M12 5v14M6 13l6 6 6-6"/><circle class="ptr-s" cx="12" cy="12" r="8" stroke-dasharray="36 60"/></svg>';
  document.body.appendChild(e);return PTR.el=e;
}
/* 音 */
function ptrCtx(){
  try{
    if(!PTR.ctx){const A=window.AudioContext||window.webkitAudioContext;if(!A)return null;
      try{if(navigator.audioSession)navigator.audioSession.type='ambient'}catch(e){}
      PTR.ctx=new A()}
    if(PTR.ctx.state==='suspended')PTR.ctx.resume();
    return PTR.ctx;
  }catch(e){return null}
}
/* 引っぱったときの「シュボッ」（2026/11/08 依頼主の指定：昔の Twitter の更新音のような0.15〜0.2秒の短い音。音のファイルは使わずその場で作る）
   ・もとは雑音（ホワイトノイズを少し低め寄りにしたピンク寄りの雑音）
   ・前半「シュ」（0〜約0.09秒）：高めの帯だけ通す（4800→2400Hz に下げていく）摩擦の音。立ち上がり4ミリ秒、指数的に急に減る
   ・後半「ボッ」（約0.06秒〜0.18秒）：低い方だけ通す（1100→220Hz に下げる）雑音＋高さが急に下がる低い音（190→60Hz）で、空気が抜ける感じ
   ptrSynth は端末で鳴らすときと、確認用にファイルへ書き出すとき（OfflineAudioContext）の両方で使う */
function ptrSynth(c,out,t,kind){
  const g=c.createGain();g.connect(out);
  if(kind==='swish'){
    const L=.19,n=Math.floor(c.sampleRate*L),bf=c.createBuffer(1,n,c.sampleRate),d=bf.getChannelData(0);
    /* ピンク寄りの雑音（Paul Kellet の簡単な式） */
    let b0=0,b1=0,b2=0;for(let k=0;k<n;k++){const w=Math.random()*2-1;b0=.99765*b0+w*.099046;b1=.963*b1+w*.2965164;b2=.57*b2+w*1.0526913;d[k]=(b0+b1+b2+w*.1848)*.22}
    /* シュ */
    const s1=c.createBufferSource();s1.buffer=bf;
    const f1=c.createBiquadFilter();f1.type='bandpass';f1.Q.value=1.1;f1.frequency.setValueAtTime(4800,t);f1.frequency.exponentialRampToValueAtTime(2400,t+.09);
    const h1=c.createBiquadFilter();h1.type='highpass';h1.frequency.value=1200;
    const g1=c.createGain();g1.gain.setValueAtTime(0,t);g1.gain.linearRampToValueAtTime(2.4,t+.004);g1.gain.exponentialRampToValueAtTime(.5,t+.05);g1.gain.exponentialRampToValueAtTime(.001,t+.1);
    s1.connect(f1);f1.connect(h1);h1.connect(g1);g1.connect(g);s1.start(t);s1.stop(t+.11);
    /* ボッ（雑音） */
    const t2=t+.06,s2=c.createBufferSource();s2.buffer=bf;
    const f2=c.createBiquadFilter();f2.type='lowpass';f2.Q.value=2.2;f2.frequency.setValueAtTime(1100,t2);f2.frequency.exponentialRampToValueAtTime(220,t2+.11);
    const g2=c.createGain();g2.gain.setValueAtTime(0,t2);g2.gain.linearRampToValueAtTime(.6,t2+.006);g2.gain.exponentialRampToValueAtTime(.001,t2+.12);
    s2.connect(f2);f2.connect(g2);g2.connect(g);s2.start(t2);s2.stop(t2+.13);
    /* ボッ（低い音） */
    const o=c.createOscillator();o.type='sine';o.frequency.setValueAtTime(190,t2);o.frequency.exponentialRampToValueAtTime(60,t2+.09);
    const g3=c.createGain();g3.gain.setValueAtTime(0,t2);g3.gain.linearRampToValueAtTime(.3,t2+.004);g3.gain.exponentialRampToValueAtTime(.001,t2+.1);
    o.connect(g3);g3.connect(g);o.start(t2);o.stop(t2+.11);
  }else{
    /* パッ：唇をはじいたような音（約0.05秒）。
       はじいた瞬間の「プ」＝ごく短い雑音を中くらいの高さで絞ったもの＋口の中で響く「ポ」＝高さがすぐ下がる低めの音 */
    const n=Math.floor(c.sampleRate*.012),bf=c.createBuffer(1,n,c.sampleRate),d=bf.getChannelData(0);
    for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,3);
    const s=c.createBufferSource();s.buffer=bf;
    const f=c.createBiquadFilter();f.type='bandpass';f.frequency.value=1100;f.Q.value=.9;
    const g1=c.createGain();g1.gain.value=.35;s.connect(f);f.connect(g1);g1.connect(out);s.start(t);s.stop(t+.015);
    const o=c.createOscillator();o.type='sine';o.frequency.setValueAtTime(560,t);o.frequency.exponentialRampToValueAtTime(170,t+.04);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.32,t+.003);g.gain.exponentialRampToValueAtTime(.001,t+.05);
    o.connect(g);o.start(t);o.stop(t+.055);
  }
}
function ptrSound(kind){
  if(navigator.webdriver)return;
  let off=false;try{off=localStorage.getItem('pcptrsnd')==='off'}catch(e){}
  if(off)return;
  const c=ptrCtx();if(!c||c.state!=='running')return;
  ptrSynth(c,c.destination,c.currentTime,kind);
}
/* iPhone は、画面に触れたあとでないと音を出せないので、最初に触れたときに音の準備をしておく */
['touchend','click'].forEach(t=>document.addEventListener(t,()=>{if(!PTR.ctx)ptrCtx();else if(PTR.ctx.state==='suspended')PTR.ctx.resume()},{passive:true}));
function ptrSet(d,anim){
  PTR.d=d;const e=ptrEl();
  const top=HD.getBoundingClientRect().bottom;
  e.style.top=Math.max(0,top)+'px';
  V.style.transition=e.style.transition=anim?'transform .3s cubic-bezier(.2,.8,.2,1),opacity .3s':'none';
  V.style.transform=d?`translateY(${d}px)`:'';
  const p=Math.min(1,d/PTR.TH);
  e.style.opacity=d?String(Math.min(1,p*1.2)):'0';
  e.style.transform=`translate(-50%,${Math.min(d,PTR.TH)/2-14}px)`;
  e.classList.toggle('ptr-arm',d>=PTR.TH);
}
SCROLLER.addEventListener('touchstart',e=>{
  if(PTR.busy||!ptrPage()||scrY()>0||e.touches.length!==1||DR.open||(typeof sheetOpen!=='undefined'&&sheetOpen))return;
  if(e.target.closest('input,textarea,select,.dr-p,.xc-p,.psheet-p,.sheet-p'))return;
  PTR.on=true;PTR.lock=0;PTR.armed=false;PTR.y0=e.touches[0].clientY;PTR.x0=e.touches[0].clientX;
},{passive:true});
SCROLLER.addEventListener('touchmove',e=>{
  if(!PTR.on)return;
  const dy=e.touches[0].clientY-PTR.y0,dx=e.touches[0].clientX-PTR.x0;
  if(!PTR.lock){if(Math.abs(dx)<8&&Math.abs(dy)<8)return;PTR.lock=Math.abs(dy)>Math.abs(dx)&&dy>0?1:-1}
  if(PTR.lock<0||scrY()>0){if(PTR.d)ptrSet(0,true);PTR.on=false;return}
  e.preventDefault();
  const d=Math.min(140,Math.max(0,dy*.5));
  ptrSet(d);
  if(d>=PTR.TH&&!PTR.armed){PTR.armed=true;ptrSound('swish');if(navigator.vibrate)try{navigator.vibrate(8)}catch(_){}}
  else if(d<PTR.TH-10&&PTR.armed)PTR.armed=false;
},{passive:false});
async function ptrEnd(){
  if(!PTR.on)return;PTR.on=false;
  if(PTR.d<PTR.TH){ptrSet(0,true);return}
  PTR.busy=true;ptrEl().classList.add('ptr-load');ptrSet(56,true);
  const t0=Date.now();
  try{await tlReload()}catch(e){}
  await new Promise(r=>setTimeout(r,Math.max(0,450-(Date.now()-t0))));
  ptrSound('pop');
  ptrEl().classList.remove('ptr-load');ptrSet(0,true);
  setTimeout(()=>{PTR.busy=false;V.style.transition=''},320);
}
SCROLLER.addEventListener('touchend',ptrEnd,{passive:true});
SCROLLER.addEventListener('touchcancel',ptrEnd,{passive:true});

/* ===================== 右下の青いボタン：ホームでは投稿する（2026/11/03 依頼主の要望。X と同じ） =====================
   ・ホーム（#/）と #/tl では、ボタンの絵をペンにして、押すと下から投稿の画面を出す
   ・投稿の画面は、ホームの上にある投稿欄（.twc）をそのまま移して使う（画像の追加なども同じに使える）。閉じたら元の場所に戻す
   ・ログインしていない／プロフィールがないときは、アカウントの画面へ */
I.pen='<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>';
const FAB_BOLT='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.3 2.5 4.9 13.6h5.9l-1.1 7.9 8.4-11.1h-5.9z"/></svg><span class="fl">相性</span>';
const fabIsPost=()=>{const k=keyOf(cur);return k===''||k==='tl'};
function fabMode(){
  const b=document.getElementById('fab');if(!b)return;const post=fabIsPost();
  if(b.dataset.mode===(post?'post':'bolt'))return;b.dataset.mode=post?'post':'bolt';
  b.innerHTML=post?`${SVG(I.pen,24)}<span class="fl">投稿</span>`:FAB_BOLT;
  b.setAttribute('aria-label',post?'投稿する':'相性をワンタップで調べる');b.title=post?'投稿する':'相性を調べる';
}
let PS=null;
function fabPost(){
  const c=document.querySelector('#view .twc');
  if(!c){toast(AUTH&&AUTH.user?'投稿するには、先にプロフィールを作ってください':'投稿するにはログインしてください');nav('#/account');return}
  if(PS)return;
  const o=document.createElement('div');o.className='psheet psheet-post';
  o.innerHTML='<div class="psheet-bg"></div><div class="psheet-p" role="dialog" aria-modal="true" aria-label="投稿する"><div class="ps-h"><button class="ps-x" type="button">やめる</button></div><div class="ps-c"></div></div>';
  const mark=document.createComment('twc');c.parentNode.insertBefore(mark,c);
  o.querySelector('.ps-c').appendChild(c);document.body.appendChild(o);
  PS={o,c,mark};requestAnimationFrame(()=>o.classList.add('on'));
  o.querySelector('.psheet-bg').onclick=o.querySelector('.ps-x').onclick=()=>postSheetClose();
  const t=c.querySelector('textarea');setTimeout(()=>t&&t.focus(),60);
}
function postSheetClose(){
  if(!PS)return;const {o,c,mark}=PS;PS=null;
  if(mark.parentNode)mark.parentNode.replaceChild(c,mark);
  o.classList.remove('on');setTimeout(()=>o.remove(),180);
}
addEventListener('hashchange',()=>{if(PS)postSheetClose()});
