/* ===================== 引っぱって更新（2026/11/03 依頼主の要望。昔の Twitter アプリのように） =====================
   ・ホーム（とタイムライン）でいちばん上にいるとき、下に引っぱると上に矢印が出て、指を離すと読み直す
   ・音：引っぱって「離せば更新」になったところで「シュッ」、読み終わったら「パッ」。
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
function ptrSound(kind){
  if(navigator.webdriver)return;
  let off=false;try{off=localStorage.getItem('pcptrsnd')==='off'}catch(e){}
  if(off)return;
  const c=ptrCtx();if(!c||c.state!=='running')return;
  const t=c.currentTime,g=c.createGain();g.connect(c.destination);
  if(kind==='swish'){
    /* シュッ：短い雑音を、高い音から低い音へ流すように絞る */
    const n=Math.floor(c.sampleRate*.16),b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);
    for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
    const s=c.createBufferSource();s.buffer=b;
    const f=c.createBiquadFilter();f.type='bandpass';f.Q.value=1.4;f.frequency.setValueAtTime(5200,t);f.frequency.exponentialRampToValueAtTime(1400,t+.15);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.22,t+.02);g.gain.exponentialRampToValueAtTime(.001,t+.16);
    s.connect(f);f.connect(g);s.start(t);s.stop(t+.17);
  }else{
    /* パッ：短く高い「ポン」 */
    const o=c.createOscillator();o.type='sine';o.frequency.setValueAtTime(1250,t);o.frequency.exponentialRampToValueAtTime(620,t+.07);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.25,t+.006);g.gain.exponentialRampToValueAtTime(.001,t+.11);
    o.connect(g);o.start(t);o.stop(t+.12);
  }
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
