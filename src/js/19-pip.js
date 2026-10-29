/* ===================== PiP（ピクチャ・イン・ピクチャ）で早見カード ===================== */
/* カードを canvas に描き、動画にして端末の PiP 機能で画面に浮かべます。
   PiP の中は操作できないため、再生／一時停止でカードを切り替えます。
   mode：'battle'＝選出アシスト（バトル中に見る）、'build'＝育成画面（ゲームで育成するときに見る）。 */
const PIP={cv:null,vid:null,page:0,pages:[],timer:null,auto:false,icons:{},ready:false,mode:'battle',bidx:0,ball:false};
const PIP_W=600,PIP_H=750;
function pipIcons(){
  if(PIP.ready)return Promise.resolve();
  return Promise.all(T.map(t=>new Promise(res=>{const im=new Image();
    im.onload=()=>{PIP.icons[t]=im;res()};im.onerror=()=>res();
    im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96" fill="#fff" style="color:#fff">${TICON[t].replace(/currentColor/g,'#fff')}</svg>`)}))).then(()=>{PIP.ready=true});
}
/* ---- カードの種類と設定 ---- */
const PCARDS=[['plan','選出プラン'],['weak','弱点まとめ'],['speed','素早さ順'],['dmg','ダメージ早見'],['sets','相手の型'],['type','タイプ相性']];
const PPRESET={jissen:['plan','speed','dmg','sets'],hajime:['weak','type','sets']};
PIP.cfg=(()=>{try{const c=JSON.parse(localStorage.getItem('pcpip')||'null');if(c&&Array.isArray(c.cards)&&c.cards.length)return c}catch(e){}return{cards:[...PPRESET.jissen],sec:4}})();
const pipSave=()=>{try{localStorage.setItem('pcpip',JSON.stringify(PIP.cfg))}catch(e){}};
let ITJR=null;const itemJa=k=>{if(!ITJR){ITJR={};Object.entries(ITJ).forEach(([n,v])=>{if(!ITJR[v])ITJR[v]=n})}return ITJR[k]||null};
function pipData(){
  if(PIP.mode==='build')return pipBuildPages();
  const opp=opp6.map(n=>byNo[n]).filter(Boolean);
  let A=null;if(team.length>=4&&opp.length){try{A=analyze(team.map(x=>x.no),opp6)}catch(e){A=null}}
  const pages=[];
  PIP.cfg.cards.forEach(c=>{
    if(c==='plan')pages.push({kind:'plan',A,opp});
    else if(c==='weak')pages.push({kind:'sum',opp});
    else if(c==='speed')pages.push({kind:'speed',A,opp});
    else if(c==='dmg')pages.push({kind:'dmg',A,opp});
    else if(c==='type')pages.push({kind:'type'});
    else if(c==='sets')opp.forEach((p,j)=>pages.push({kind:'one',p,j,A}));
  });
  return pages.length?pages:[{kind:'sum',opp}];
}
const FF='-apple-system,"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif';
function rr(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}
function tIcon(g,t,x,y,s){g.fillStyle=COL[t];g.beginPath();g.arc(x+s/2,y+s/2,s/2,0,Math.PI*2);g.fill();const im=PIP.icons[t];if(im)g.drawImage(im,x+s*.2,y+s*.2,s*.6,s*.6)}
function pill(g,txt,x,y,bg,fg,fs){g.font=`800 ${fs}px ${FF}`;const w=g.measureText(txt).width+fs*1.1;rr(g,x,y,w,fs*1.7,fs*.85);g.fillStyle=bg;g.fill();g.fillStyle=fg;g.fillText(txt,x+fs*.55,y+fs*1.22);return w}
function fitTxt(g,t,x,y,max,fs,w){let f=fs;do{g.font=`${w||700} ${f}px ${FF}`;f--}while(g.measureText(t).width>max&&f>12);g.fillText(t,x,y)}
const pct=v=>Math.min(999,Math.round(v));
function pipDraw(){
  const g=PIP.cv.getContext('2d'),pg=PIP.pages[PIP.page]||PIP.pages[0];
  g.fillStyle='#000';g.fillRect(0,0,PIP_W,PIP_H);g.textBaseline='alphabetic';g.textAlign='left';
  const title=t=>{g.fillStyle='#e7e9ea';g.font=`800 36px ${FF}`;g.fillText(t,28,62)};
  const foot=()=>{g.fillStyle='#71767b';g.font=`600 21px ${FF}`;g.textAlign='left';g.fillText(`${PIP.page+1} / ${PIP.pages.length}`,28,PIP_H-24);g.textAlign='right';g.fillText(L(`▶ ${PIP.cfg.sec}秒ごとに次へ　⏸ 固定`,`▶ next every ${PIP.cfg.sec}s　⏸ hold`),PIP_W-28,PIP_H-24);g.textAlign='left'};
  const need=t=>{g.fillStyle='#71767b';g.font=`700 26px ${FF}`;g.fillText(t,28,130)};
  if(!pg){foot();return}
  if(pg.kind==='build'){pipDrawBuild(g,pg);foot();return}
  if(pg.kind==='team'){pipDrawTeam(g,pg);foot();return}
  if(pg.kind==='type'){
    title('タイプ相性　技→ばつぐんの相手');
    const rh=(PIP_H-130)/18;
    T.forEach((a,k)=>{const y=86+k*rh;tIcon(g,a,28,y,rh-6);g.fillStyle='#71767b';g.font=`800 ${rh*.5}px ${FF}`;g.fillText('→',28+rh+2,y+rh*.62);
      let x=28+rh+34;T.filter(d=>mult(a,[d])>=2).forEach(d=>{tIcon(g,d,x,y+2,rh-10);x+=rh-4});
      if(!T.some(d=>mult(a,[d])>=2)){g.fillStyle='#5b6167';g.font=`600 ${rh*.45}px ${FF}`;g.fillText('なし',x,y+rh*.62)}});
    foot();return;
  }
  if(pg.kind!=='one'&&(!pg.opp||!pg.opp.length)){title('相手を入れてください');foot();return}
  if(pg.kind==='sum'){
    title('相手の6匹　弱点まとめ');
    const rowH=Math.min(104,(PIP_H-150)/pg.opp.length);
    pg.opp.forEach((p,j)=>{const y=96+j*rowH;
      g.strokeStyle='#2f3336';g.lineWidth=2;g.beginPath();g.moveTo(20,y+rowH-6);g.lineTo(PIP_W-20,y+rowH-6);g.stroke();
      p.t.forEach((t,k)=>tIcon(g,t,28+k*34,y+6,30));
      g.fillStyle='#e7e9ea';g.font=`800 30px ${FF}`;g.fillText(p.n,100,y+32);
      g.textAlign='right';g.fillStyle='#71767b';g.font=`700 22px ${FF}`;g.fillText(`最速${maxSpe(p)}`,PIP_W-28,y+30);g.textAlign='left';
      const wk=defTable(p.t).filter(x=>x[1]>=2).sort((a,b)=>b[1]-a[1]);let x=28;
      wk.forEach(([t,m])=>{if(x>PIP_W-110)return;x+=pill(g,`${t}${m>=4?'×4':''}`,x,y+44,m>=4?'#f4212e':COL[t],m>=4?'#fff':ONC[t],20)+8});
      if(!wk.length){g.fillStyle='#71767b';g.font=`600 20px ${FF}`;g.fillText('弱点なし',28,y+70)}});
    foot();return;
  }
  if(pg.kind==='plan'){
    title('選出プラン');const A=pg.A;
    if(!A){need('編成でパーティ（4匹以上）を登録すると表示されます');foot();return}
    const row=(i,tag,y,col)=>{const m=A.M[i];
      pill(g,tag,28,y,col,'#fff',22);m.p.t.forEach((t,k)=>tIcon(g,t,110+k*34,y+2,30));
      g.fillStyle='#e7e9ea';g.font=`800 32px ${FF}`;g.fillText(m.p.n,184,y+30);
      const hits=A.O.map((o,j)=>({o,d:A.D[i][j]})).filter(x=>x.d.pct>=50).sort((a,b)=>b.d.pct-a.d.pct).slice(0,3);
      g.fillStyle='#c4c9cc';fitTxt(g,hits.length?`狙い：${hits.map(x=>x.o.p.n).join('・')}（${hits[0].d.mv?hits[0].d.mv.n:''}）`:'狙い：全体に等倍で削る',28,y+72,PIP_W-56,23,600)};
    let y=96;A.lead.forEach(i=>{row(i,'先発',y,'#1d9bf0');y+=112});
    g.strokeStyle='#2f3336';g.lineWidth=2;g.beginPath();g.moveTo(20,y-12);g.lineTo(PIP_W-20,y-12);g.stroke();y+=8;
    A.back.forEach(i=>{row(i,'控え',y,'#536471');y+=112});
    foot();return;
  }
  if(pg.kind==='speed'){
    title('素早さ順（相手は最速想定）');const A=pg.A;const L=[];
    if(A)A.best.forEach(i=>L.push({n:A.M[i].p.n,t:A.M[i].p.t,v:A.M[i].st[5],me:1}));
    pg.opp.forEach(p=>{const v=maxSpe(p),d=LIVE.csv[p.no];const sc=d&&d.it.find(([n,pc])=>nrm(n)==='choicescarf'&&pc>=15);L.push({n:p.n,t:p.t,v,me:0,sc:sc?Math.floor(v*1.5):0})});
    L.sort((a,b)=>b.v-a.v);const rh=Math.min(56,(PIP_H-150)/L.length);
    L.forEach((e,k)=>{const y=86+k*rh;rr(g,20,y,PIP_W-40,rh-6,10);g.fillStyle=e.me?'rgba(29,155,240,.18)':'rgba(244,33,46,.12)';g.fill();
      g.fillStyle=e.me?'#1d9bf0':'#f4212e';g.font=`800 ${rh*.42}px ${FF}`;g.fillText(e.me?'自分':'相手',32,y+rh*.6);
      e.t.forEach((t,q)=>tIcon(g,t,100+q*(rh-14),y+5,rh-16));
      g.fillStyle='#e7e9ea';g.font=`800 ${rh*.48}px ${FF}`;g.fillText(e.n,100+2*(rh-14)+10,y+rh*.62);
      g.textAlign='right';g.font=`800 ${rh*.5}px Inter,${FF}`;g.fillText(String(e.v),PIP_W-36,y+rh*.64);
      if(e.sc){g.fillStyle='#ffd400';g.font=`700 ${rh*.34}px ${FF}`;g.fillText(`スカーフ${e.sc}`,PIP_W-110,y+rh*.62)}g.textAlign='left'});
    if(!A){g.fillStyle='#71767b';g.font=`600 20px ${FF}`;g.fillText('パーティを登録すると自分も並びます',28,PIP_H-60)}
    foot();return;
  }
  if(pg.kind==='dmg'){
    title('ダメージ早見（自分→相手）');const A=pg.A;
    if(!A){need('編成でパーティ（4匹以上）を登録すると表示されます');foot();return}
    const rows=A.best,cw=(PIP_W-170)/A.O.length,top=96;
    A.O.forEach((o,j)=>{const x=150+j*cw;tIcon(g,o.p.t[0],x+cw/2-17,top,34);g.fillStyle='#c4c9cc';g.textAlign='center';fitTxt(g,o.p.n.slice(0,4),x+cw/2,top+62,cw-4,18,700);g.textAlign='left'});
    const rh=Math.min(120,(PIP_H-top-150)/rows.length);
    rows.forEach((i,k)=>{const y=top+84+k*rh;g.fillStyle='#e7e9ea';fitTxt(g,A.M[i].p.n,28,y+rh*.55,118,26,800);
      A.O.forEach((o,j)=>{const d=A.D[i][j],x=150+j*cw,p=d.pct,lab=d.mv?koShort(koInfo(dmgRolls(A.M[i],d.mv,A.O[j],{}),A.O[j].max)):'—';
        rr(g,x+3,y+4,cw-6,rh-10,12);g.fillStyle=p>=100?'#00ba7c':p>=50?'rgba(0,186,124,.4)':p>=34?'rgba(0,186,124,.16)':'#16181c';g.fill();
        g.fillStyle=p>=50?'#fff':'#8b98a5';g.textAlign='center';g.font=`800 ${Math.min(30,cw*.38)}px ${FF}`;g.fillText(lab,x+cw/2,y+rh*.5);
        g.font=`600 ${Math.min(17,cw*.24)}px Inter,${FF}`;g.fillText(p?pct(p)+'%':'',x+cw/2,y+rh*.5+22);g.textAlign='left'})});
    g.fillStyle='#71767b';g.font=`600 19px ${FF}`;g.fillText('確1＝確定1発、乱1＝乱数1発（乱数16段階で計算）',28,PIP_H-62);
    foot();return;
  }
  /* 相手の型（1匹ずつ） */
  const p=pg.p,A=pg.A;
  p.t.forEach((t,k)=>tIcon(g,t,28+k*58,30,52));
  g.fillStyle='#e7e9ea';fitTxt(g,p.n,28+p.t.length*58+10,74,PIP_W-60-p.t.length*58,50,800);
  g.fillStyle='#71767b';g.font=`700 24px ${FF}`;g.fillText(`${p.t.join('・')}　素早さ ${p.s[5]}（最速${maxSpe(p)}）`,28,124);
  const tb=defTable(p.t);let y=158;
  const lineOf=(lab,arr,col)=>{g.fillStyle=col;g.font=`800 24px ${FF}`;g.fillText(lab,28,y+26);let x=130,yy=y;
    if(!arr.length){g.fillStyle='#71767b';g.font=`600 22px ${FF}`;g.fillText('なし',x,y+26)}
    arr.forEach(([t,m])=>{const s=`${t}${m>=4?'×4':m===.25?'×¼':''}`;g.font=`800 22px ${FF}`;const w=g.measureText(s).width+24;if(x+w>PIP_W-24){x=130;yy+=44}x+=pill(g,s,x,yy,m>=4?'#f4212e':COL[t],m>=4?'#fff':ONC[t],22)+8});
    y=yy+52};
  lineOf('弱点',tb.filter(x=>x[1]>=2).sort((a,b)=>b[1]-a[1]),'#ff7a00');
  const imm=tb.filter(x=>x[1]===0);if(imm.length)lineOf('無効',imm,'#8b98a5');
  const d=LIVE.csv[p.no];
  if(d){
    const mvn=d.mv.map(([n,pc])=>{const id=MVKA[nrm(n)];return id===182?['まもる',pc]:id&&mName(id)?[mName(id),pc]:null}).filter(Boolean).slice(0,4);
    const its=d.it.map(([n,pc])=>[itemJa(nrm(n))||n,pc]).slice(0,2),abs=d.ab.map(([n,pc])=>[ABN[ABK[nrm(n)]]||n,pc]).slice(0,1);
    g.fillStyle='#e7e9ea';g.font=`800 24px ${FF}`;g.fillText('よく使われる型',28,y+26);y+=36;g.fillStyle='#c4c9cc';
    fitTxt(g,mvn.map(([n,pc])=>`${n}${Math.round(pc)}%`).join('・'),28,y+24,PIP_W-56,22,600);y+=36;
    fitTxt(g,`持ち物 ${its.map(([n,pc])=>`${n}${Math.round(pc)}%`).join('・')}　特性 ${abs.map(([n])=>n).join('')}`,28,y+24,PIP_W-56,22,600);y+=48;
  }
  if(A){
    const j=pg.j,best=A.M.map((m,i)=>({i,d:A.D[i][j]})).sort((a,b)=>b.d.pct-a.d.pct)[0];
    const thr=A.M.map((m,i)=>({i,r:A.R[j][i]})).sort((a,b)=>b.r.pct-a.r.pct)[0];
    g.fillStyle='#00ba7c';g.font=`800 24px ${FF}`;g.fillText('攻める',28,y+26);
    g.fillStyle='#e7e9ea';fitTxt(g,best&&best.d.mv?`${A.M[best.i].p.n}の${best.d.mv.n}（約${pct(best.d.pct)}%）`:'—',130,y+26,PIP_W-158,24);y+=46;
    g.fillStyle='#f4212e';g.font=`800 24px ${FF}`;g.fillText('警戒',28,y+26);
    g.fillStyle='#e7e9ea';fitTxt(g,thr&&thr.r.mv?`${thr.r.mv.n}で${A.M[thr.i].p.n}に約${pct(thr.r.pct)}%`:'—',130,y+26,PIP_W-158,24);
  }
  foot();
}
function pipGo(d){PIP.page=(PIP.page+d+PIP.pages.length)%PIP.pages.length;pipDraw()}
/* ---- 動画ファイル（MP4）を作って、端末標準の PiP で表示 ----
   カード1枚＝4秒の動画を作り、ループ再生します。再生中は自動で次のカードへ、一時停止でそのカードに止まります。
   JavaScriptが止められても（ゲーム中でも）動画の機能だけで動きます。 */
const PIP_CFG={mux:'https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.1/build/mp4-muxer.js'};
if(window.__PIP_CFG)Object.assign(PIP_CFG,window.__PIP_CFG);
const SEG_=()=>PIP.cfg.sec||4;
PIP.state='idle';
function pipSetUI(){
  const pc=document.getElementById('pip-cards');if(!pc)return;const a=PIP.cfg.cards;
  pc.innerHTML=PCARDS.map(([k,l])=>{const i=a.indexOf(k);return `<button class="pill" data-pc="${k}" aria-pressed="${i>=0}">${i>=0?`<b class="pn">${i+1}</b>`:''}${l}</button>`}).join('');
  document.querySelectorAll('[data-ps]').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.ps===PIP.cfg.sec));
  document.querySelectorAll('[data-pp]').forEach(b=>b.setAttribute('aria-pressed',JSON.stringify(PPRESET[b.dataset.pp])===JSON.stringify(a)));
}
function pipUI(){
  pipSetUI();
  const b=document.getElementById(PIP.mode==='build'?'ed-pip':'as-pip'),m=document.getElementById('pip-msg');if(!b)return;
  b.disabled=PIP.state!=='ready';
  b.textContent=PIP.state==='building'?L('カードを準備中…','Preparing cards…'):PIP.state==='fail'?L('この端末では作れませんでした','Not supported on this device'):L('PiPで表示','Show in PiP');
  if(m&&PIP.state==='fail')m.textContent='動画を作れませんでした：'+(PIP.err||'')+'。iOS 16.4以降のSafari、またはパソコンのChromeでお試しください。';
}
async function pipEncodeWC(){
  if(!window.VideoEncoder||!window.VideoFrame)throw new Error('VideoEncoder非対応');
  if(!window.Mp4Muxer)await loadScript(PIP_CFG.mux);
  const W=PIP_W,H=PIP_H,fps=2;let pick=null;
  for(const c of [{codec:'avc1.42001f',m:'avc'},{codec:'avc1.4d0028',m:'avc'},{codec:'vp09.00.10.08',m:'vp9'}]){
    try{const r=await VideoEncoder.isConfigSupported({codec:c.codec,width:W,height:H,bitrate:800000,framerate:fps});if(r.supported){pick=c;break}}catch(e){}}
  if(!pick)throw new Error('対応する動画形式なし');
  const muxer=new Mp4Muxer.Muxer({target:new Mp4Muxer.ArrayBufferTarget(),video:{codec:pick.m,width:W,height:H},fastStart:'in-memory'});
  let err=null;const enc=new VideoEncoder({output:(ch,meta)=>muxer.addVideoChunk(ch,meta),error:e=>{err=e}});
  enc.configure({codec:pick.codec,width:W,height:H,bitrate:800000,framerate:fps});
  const per=SEG_()*fps,dt=1e6/fps;
  for(let k=0;k<PIP.pages.length;k++){PIP.page=k;pipDraw();
    for(let f=0;f<per;f++){const fr=new VideoFrame(PIP.cv,{timestamp:Math.round((k*per+f)*dt),duration:Math.round(dt)});enc.encode(fr,{keyFrame:f===0});fr.close()}}
  await enc.flush();if(err)throw err;muxer.finalize();
  return{blob:new Blob([muxer.target.buffer],{type:'video/mp4'}),rate:1};
}
async function pipEncodeRec(){
  if(!window.MediaRecorder||!PIP.cv.captureStream)throw new Error('録画非対応');
  const type=['video/mp4','video/webm;codecs=vp9','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));if(!type)throw new Error('録画形式なし');
  const st=PIP.cv.captureStream(10),rec=new MediaRecorder(st,{mimeType:type}),chunks=[];
  rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  const done=new Promise(r=>rec.onstop=r);rec.start(200);
  for(let k=0;k<PIP.pages.length;k++){PIP.page=k;for(let i=0;i<10;i++){pipDraw();await new Promise(r=>setTimeout(r,100))}}
  rec.stop();await done;st.getTracks().forEach(t=>t.stop());
  return{blob:new Blob(chunks,{type:type.split(';')[0]}),rate:1/SEG_()};
}
let pipT=null;
function pipSchedule(){clearTimeout(pipT);pipT=setTimeout(pipBuild,500)}
async function pipBuild(){
  if(PIP.mode==='battle'&&!opp6.length)return;
  const sig=PIP.mode==='build'?JSON.stringify(['build',PIP.bidx,PIP.ball,team,PIP.cfg.sec]):JSON.stringify([opp6,team.map(x=>x.no),Object.keys(LIVE.csv).filter(k=>LIVE.csv[k]).length,PIP.cfg]);
  if(PIP.sig===sig&&(PIP.state==='ready'||PIP.state==='building'))return;
  PIP.sig=sig;PIP.state='building';pipUI();
  try{
    await pipIcons();PIP.pages=pipData();
    if(!PIP.cv){PIP.cv=document.createElement('canvas');PIP.cv.width=PIP_W;PIP.cv.height=PIP_H}
    let r=null;try{r=await pipEncodeWC()}catch(e){PIP.err=e.message||String(e)}
    if(!r)r=await pipEncodeRec();
    if(PIP.sig!==sig)return;
    if(PIP.url)URL.revokeObjectURL(PIP.url);PIP.url=URL.createObjectURL(r.blob);
    if(!PIP.vid){const v=document.createElement('video');v.muted=true;v.loop=true;v.playsInline=true;v.setAttribute('playsinline','');v.setAttribute('webkit-playsinline','');v.controls=true;v.preload='auto';v.className='pipv';PIP.vid=v}
    const v=PIP.vid;v.src=PIP.url;v.defaultPlaybackRate=r.rate;v.playbackRate=r.rate;
    await new Promise(res=>{if(v.readyState>=1)res();else{v.onloadedmetadata=()=>res();setTimeout(res,3000)}});
    v.playbackRate=r.rate;
    const box=document.getElementById('pip-box');if(box&&!box.contains(v)){box.innerHTML='';box.appendChild(v)}
    PIP.state='ready';
  }catch(e){PIP.state='fail';PIP.err=e.message||String(e)}
  pipUI();
}
/* ボタンを押した瞬間に PiP を頼む（待ち時間を挟むとiPhoneが許可しないため） */
function pipStart(){
  const msg=t=>{const el=document.getElementById('pip-msg');if(el)el.textContent=t};
  if(PIP.state!=='ready'){pipBuild();return}
  const v=PIP.vid;const p=v.play();if(p&&p.catch)p.catch(()=>{});
  try{
    if(v.webkitSupportsPresentationMode&&v.webkitSupportsPresentationMode('picture-in-picture')&&!v.requestPictureInPicture){v.webkitSetPresentationMode('picture-in-picture');msg(L(`PiPで表示中です。再生中は${SEG_()}秒ごとに次のカード、一時停止でそのカードに止まります。`,`Showing in PiP. While playing it moves to the next card every ${SEG_()}s; pause to hold a card.`));return}
    if(v.requestPictureInPicture){v.requestPictureInPicture().then(()=>msg(L(`PiPで表示中です。再生中は${SEG_()}秒ごとに次のカード、一時停止でそのカードに止まります。ホームやゲームに切り替えても残ります。`,`Showing in PiP. While playing it moves to the next card every ${SEG_()}s; pause to hold a card. It stays when you switch to the game.`))).catch(e=>{
      if(v.webkitSupportsPresentationMode&&v.webkitSupportsPresentationMode('picture-in-picture')){try{v.webkitSetPresentationMode('picture-in-picture');return}catch(_){}}
      msg(L('PiPを開けませんでした（','Could not open PiP (')+(e.name||e.message||e)+L('）。下の動画の右上にある「PiP」アイコンを押して開いてください。','). Use the PiP icon on the video below.'))});return}
    msg(L('このブラウザはPiPに対応していません。下の動画を再生して使ってください。','This browser does not support PiP. Play the video below instead.'));
  }catch(e){msg(L('PiPを開けませんでした（','Could not open PiP (')+(e.message||e)+L('）。下の動画の「PiP」アイコンからも開けます。','). You can also use the PiP icon on the video below.'))}
}



/* ---- 育成カード（育成画面から。ゲームの育成画面で見ながら入力する用） ---- */
function pipMember(i){
  const x=team[i],p=x&&byNo[x.no];if(!p)return null;
  const auto=!(x.set&&x.set.sp),s=auto?setToSaved(p,mySetFor(p.no)):x.set;
  return{p,s,auto,st:calcStats(p,s.sp,s.up,s.dn)};
}
function pipBuildPages(){
  const idx=team[PIP.bidx]?PIP.bidx:0,order=[idx,...team.map((_,i)=>i).filter(i=>i!==idx)];
  const list=(PIP.ball?order:[idx]).map(i=>({kind:'build',m:pipMember(i),i})).filter(x=>x.m);
  if(PIP.ball&&list.length>1)list.push({kind:'team',ms:order.map(pipMember).filter(Boolean)});
  return list;
}
const pipAb=s=>s.ab?(ABN[s.ab.k]||s.ab.n||''):'';
const pipIt=s=>s.it?(ITEMN[s.it.k]||s.it.n||''):L('なし','None');
const pipMv=m=>m?(m.id===182?L('まもる','Protect'):mName(m.id)||m.n||''):'';
const pipNat=s=>s.up>0&&s.dn>0?`${(NATS.find(n=>n[1]===s.up&&n[2]===s.dn)||[''])[0]}（${SN[s.up]}↑ ${SN[s.dn]}↓）`:L('補正なし','Neutral');
function pipDrawBuild(g,pg){
  const {p,s,auto,st}=pg.m;
  p.t.forEach((t,k)=>tIcon(g,t,28+k*56,26,50));
  g.fillStyle='#e7e9ea';fitTxt(g,p.n,28+p.t.length*56+10,68,PIP_W-200-p.t.length*56,46,800);
  g.textAlign='right';g.fillStyle=auto?'#ffd400':'#1d9bf0';g.font=`800 22px ${FF}`;g.fillText(auto?L('おまかせの型','Auto set'):L('あなたの育成','Your build'),PIP_W-28,62);g.textAlign='left';
  const kv=(k,v,y)=>{g.fillStyle='#71767b';g.font=`700 22px ${FF}`;g.fillText(k,28,y);g.fillStyle='#e7e9ea';fitTxt(g,v||'—',150,y,PIP_W-178,27,800)};
  kv(L('持ち物','Item'),pipIt(s),122);kv(L('特性','Ability'),pipAb(s),162);kv(L('性格','Nature'),pipNat(s),202);
  /* 能力ポイント（ゲームで入れる数）を大きく */
  const top=222,rh=52;
  g.fillStyle='#71767b';g.font=`700 20px ${FF}`;g.fillText(L('能力','Stat'),28,top+20);g.textAlign='center';g.fillText(L('能力ポイント','Points'),300,top+20);g.fillText(L('Lv50の数値','Lv. 50'),490,top+20);g.textAlign='left';
  SN.forEach((n,i)=>{const y=top+32+i*rh,up=s.up===i,dn=s.dn===i;
    rr(g,20,y,PIP_W-40,rh-8,12);g.fillStyle=i%2?'#0b0c0e':'#16181c';g.fill();
    g.fillStyle=up?'#ff8a7a':dn?'#7ab8ff':'#e7e9ea';g.font=`800 26px ${FF}`;g.fillText(n+(up?' ↑':dn?' ↓':''),36,y+rh*.6);
    const v=s.sp[i]||0;rr(g,240,y+6,120,rh-20,10);g.fillStyle=v?'#1d9bf0':'#202327';g.fill();
    g.fillStyle=v?'#fff':'#71767b';g.textAlign='center';g.font=`800 32px Inter,${FF}`;g.fillText(String(v),300,y+rh*.66);
    g.fillStyle='#e7e9ea';g.font=`800 30px Inter,${FF}`;g.fillText(String(st[i]),490,y+rh*.64);g.textAlign='left'});
  const left=SP_TOTAL-s.sp.reduce((a,b)=>a+b,0);
  g.fillStyle=left?'#ffd400':'#71767b';g.font=`700 20px ${FF}`;g.fillText(left?L(`能力ポイント 残り${left}`,`${left} stat points left`):L(`能力ポイント 合計${SP_TOTAL}`,`Stat points total ${SP_TOTAL}`),28,top+32+6*rh+20);
  /* 技 */
  const my=top+32+6*rh+34,mv=[0,1,2,3].map(k=>pipMv(s.mv&&s.mv[k]));
  mv.forEach((n,k)=>{const x=20+(k%2)*((PIP_W-40)/2),y=my+Math.floor(k/2)*46;rr(g,x+2,y,(PIP_W-40)/2-4,40,10);g.fillStyle='#16181c';g.fill();
    g.fillStyle=n?'#e7e9ea':'#5b6167';fitTxt(g,n||'—',x+16,y+28,(PIP_W-40)/2-30,23,700)});
}
function pipDrawTeam(g,pg){
  g.fillStyle='#e7e9ea';g.font=`800 36px ${FF}`;g.fillText(L('パーティの育成','Team builds'),28,62);
  const rh=Math.min(104,(PIP_H-140)/pg.ms.length);
  pg.ms.forEach((m,k)=>{const y=86+k*rh;
    g.strokeStyle='#2f3336';g.lineWidth=2;g.beginPath();g.moveTo(20,y+rh-6);g.lineTo(PIP_W-20,y+rh-6);g.stroke();
    m.p.t.forEach((t,q)=>tIcon(g,t,28+q*32,y+6,28));
    g.fillStyle='#e7e9ea';fitTxt(g,m.p.n,100,y+30,230,28,800);
    g.fillStyle='#c4c9cc';g.textAlign='right';fitTxt(g,pipIt(m.s),PIP_W-28,y+30,220,20,700);g.textAlign='left';
    g.fillStyle='#1d9bf0';fitTxt(g,m.s.sp.map((v,i)=>v?`${SN[i]}${v}`:'').filter(Boolean).join(' ')||L('ポイントなし','No points'),28,y+64,PIP_W-56,24,800);
    g.fillStyle='#71767b';fitTxt(g,pipNat(m.s),28,y+92,PIP_W-56,19,600)});
}
/* 育成画面に置く PiP の欄 */
function pipBuildPanel(){
  return `<div class="pipwrap" id="ed-pipw"><div class="pipt"><b>${L('PiPで見ながらゲームで育成','Build in the game with PiP')}</b><span class="atag on" style="margin-left:6px">β</span></div>
  <p class="vcap" style="margin:4px 0 10px">${L('ここで作った育成を<b>PiP（ピクチャ・イン・ピクチャ）</b>で画面に浮かべたまま、ゲームの育成画面に切り替えて入力できます。スクショを撮って行き来する必要はありません。値を変えると、数秒でPiPの中身も新しくなります。','Float this build in <b>PiP (picture-in-picture)</b> and switch to the game to enter it — no screenshots needed. Changes here update the PiP within a few seconds.')}</p>
  <div class="pills" style="padding:0 0 10px"><button class="pill" data-pball="0" aria-pressed="${!PIP.ball}">${L('この1匹','This Pokémon')}</button><button class="pill" data-pball="1" aria-pressed="${PIP.ball}">${L('パーティ全員','Whole team')}</button></div>
  <div class="btns" style="padding:0 0 8px"><button class="btn btn-a" id="ed-pip" disabled>${L('カードを準備中…','Preparing cards…')}</button></div>
  <div id="pip-box"></div><p class="vcap" id="pip-msg"></p></div>`;
}
function pipBuildBind(idx){
  PIP.mode='build';PIP.bidx=idx;
  const w=document.getElementById('ed-pipw');if(!w)return;
  {const bx=document.getElementById('pip-box');if(bx&&PIP.vid&&!bx.contains(PIP.vid))bx.appendChild(PIP.vid)}
  w.addEventListener('click',e=>{
    if(e.target.closest('#ed-pip')){pipStart();return}
    const b=e.target.closest('[data-pball]');if(b){PIP.ball=b.dataset.pball==='1';w.querySelectorAll('[data-pball]').forEach(x=>x.setAttribute('aria-pressed',x===b));pipSchedule()}
  });
  pipUI();pipSchedule();
}
