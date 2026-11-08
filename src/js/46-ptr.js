/* ===================== 引っぱって更新（2026/11/03 依頼主の要望。昔の Twitter アプリのように） =====================
   ・ホーム（とタイムライン）でいちばん上にいるとき、下に引っぱると上に矢印が出て、指を離すと読み直す
   ・音：引っぱって「離せば更新」になったところで「シュボッ」（約0.13秒）、読み終わったら「ポッ」。
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
/* 音（2026/11/08 依頼主が口で鳴らした見本の録音を調べて合わせた）
   ・引っぱったとき「シュボッ」（約0.13秒）：2300Hz あたりにまとまったこもった雑音（帯の幅 約300Hz）。
     急に鳴らさず約0.07秒かけて大きくなり（見本：0.045秒→0.115秒で −19dB→0dB）、少し続いたあと、
     高さが 1450Hz あたりへ急に下がって（「ボ」）、約0.03秒で消える。低い「ドン」という音はほとんど無い。
   ・読み終わったとき「ポッ」（約0.035秒）：雑音のない澄んだ音で、高さが 590Hz → 1100Hz に上がる。立ち上がり約4ミリ秒。
   ptrSynth は端末で鳴らすときと、確認用にファイルへ書き出すとき（OfflineAudioContext）の両方で使う */
function ptrSynth(c,out,t,kind){
  const g=c.createGain();g.connect(out);
  if(kind==='swish'){
    const L=.16,n=Math.floor(c.sampleRate*L),bf=c.createBuffer(1,n,c.sampleRate),d=bf.getChannelData(0);
    for(let k=0;k<n;k++)d[k]=Math.random()*2-1;
    const s1=c.createBufferSource();s1.buffer=bf;
    /* こもった「シュー」：2300Hz の細い帯（2段重ねて幅を約300Hzに）。最後に 1450Hz へ下げる＝「ボ」 */
    const fa=c.createBiquadFilter(),fb=c.createBiquadFilter();[fa,fb].forEach(f=>{f.type='bandpass';f.Q.value=4.2;
      f.frequency.setValueAtTime(2250,t);f.frequency.linearRampToValueAtTime(2400,t+.06);f.frequency.setValueAtTime(2350,t+.088);f.frequency.exponentialRampToValueAtTime(1450,t+.095)});
    const ga=c.createGain();
    ga.gain.setValueAtTime(.0001,t);ga.gain.exponentialRampToValueAtTime(.18,t+.012);ga.gain.exponentialRampToValueAtTime(1,t+.07);
    ga.gain.setValueAtTime(1,t+.092);ga.gain.linearRampToValueAtTime(.8,t+.1);ga.gain.exponentialRampToValueAtTime(.25,t+.118);ga.gain.exponentialRampToValueAtTime(.001,t+.15);
    s1.connect(fa);fa.connect(fb);fb.connect(ga);ga.connect(g);
    /* 見本にある少しのざらつき（広い帯の雑音を1割ほど） */
    const fh=c.createBiquadFilter();fh.type='highpass';fh.frequency.value=1500;const gh=c.createGain();
    gh.gain.setValueAtTime(.0001,t);gh.gain.exponentialRampToValueAtTime(.05,t+.07);gh.gain.exponentialRampToValueAtTime(.0005,t+.12);
    s1.connect(fh);fh.connect(gh);gh.connect(g);
    g.gain.value=2.4;s1.start(t);s1.stop(t+L);
  }else{
    /* ポッ：澄んだ音で、高さが上がる（590→1100Hz、約0.03秒） */
    const o=c.createOscillator();o.type='sine';o.frequency.setValueAtTime(590,t);o.frequency.exponentialRampToValueAtTime(1120,t+.026);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.5,t+.006);g.gain.setValueAtTime(.5,t+.016);g.gain.exponentialRampToValueAtTime(.001,t+.036);
    o.connect(g);o.start(t);o.stop(t+.04);
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
