/* ===================== PiP の調査ページ（#/piplab、どこからもリンクしない） =====================
   2026/11/27 依頼主：iPhone の「ホーム画面に追加」したアプリ（スタンドアロン）の中で、PiP を直接開けるかを実機で確かめる。
   WebKit の不具合報告 303885（ホーム画面のウェブアプリでは requestPictureInPicture が NotSupportedError・
   webkitSupportsPresentationMode('picture-in-picture') が false・ネイティブの PiP ボタンも出ない。Apple 内部 rdar://121964774）を参考に、
   ・標準の requestPictureInPicture と WebKit の webkitSetPresentationMode
   ・全画面の再生（webkitEnterFullscreen）から PiP ボタン
   ・動画の種類（サイトが作る動画＝本番と同じ／H.264 の MP4／音ありの MP4／HLS）
   ・押してからの時間（すぐ・再生を待ってから・0秒後・1.5秒後・6秒後）
   を1つずつ試し、結果（例外・イベント・最後の状態）と「実際に小さな画面が出たか」を記録して、文字で写せるようにする。
   ここで「対応している」と言ってよいのは、実機で開いて「出た」を押した記録があるときだけ。 */
const PL={src:'blob',log:[],ev:[],blob:null,blobRate:1,sound:false,busy:false};
const PL_SRCS=[['blob','サイトが作る動画（本番と同じ）'],['mp4','MP4（H.264・音なし）'],['mp4a','MP4（H.264・音あり）'],['hls','HLS（.m3u8）']];
const PL_METHODS=[
  ['std','標準：requestPictureInPicture（押してすぐ）'],
  ['wk','WebKit：webkitSetPresentationMode（押してすぐ）'],
  ['play','再生を待ってから requestPictureInPicture'],
  ['d0','0秒後に requestPictureInPicture'],
  ['d1500','1.5秒後に requestPictureInPicture'],
  ['d6000','6秒後に requestPictureInPicture（押した効果が切れたあと）'],
  ['wkd1500','1.5秒後に webkitSetPresentationMode'],
  ['fs','全画面で再生 → 画面の PiP ボタンを押す'],
  ['auto','自動 PiP（再生したままホームに戻る）']
];
function plEnv(){
  const v=document.getElementById('pl-v');
  const ua=navigator.userAgent,ios=(ua.match(/OS (\d+)[._](\d+)(?:[._](\d+))? like Mac/)||[]).slice(1).filter(Boolean).join('.');
  const mm=q=>{try{return matchMedia(q).matches}catch(e){return null}};
  return{
    standalone:navigator.standalone===true,
    displayMode:mm('(display-mode: standalone)')?'standalone':mm('(display-mode: fullscreen)')?'fullscreen':mm('(display-mode: minimal-ui)')?'minimal-ui':'browser',
    ios:ios||'-',ua,
    pipEnabled:document.pictureInPictureEnabled,
    hasReq:!!(window.HTMLVideoElement&&'requestPictureInPicture' in HTMLVideoElement.prototype),
    hasWk:!!(window.HTMLVideoElement&&'webkitSetPresentationMode' in HTMLVideoElement.prototype),
    wkSupports:v&&typeof v.webkitSupportsPresentationMode==='function'?v.webkitSupportsPresentationMode('picture-in-picture'):null,
    fsSupports:v?(typeof v.webkitEnterFullscreen==='function'):null,
    autoAttr:v?('autoPictureInPicture' in v):null,
    activation:navigator.userActivation?{active:navigator.userActivation.isActive,been:navigator.userActivation.hasBeenActive}:null
  };
}
const plState=v=>({rs:v.readyState,paused:v.paused,muted:v.muted,mode:v.webkitPresentationMode||'-',pipEl:document.pictureInPictureElement===v,wk:typeof v.webkitSupportsPresentationMode==='function'?v.webkitSupportsPresentationMode('picture-in-picture'):null});
async function plBlob(){
  if(PL.blob)return PL.blob;
  /* 本番の PiP と同じ作り方（pipEncodeWC → だめなら pipEncodeRec）で、相手なしでも出せる「タイプ相性」のカード */
  const cfg=PIP.cfg,mode=PIP.mode;
  try{
    PIP.cfg={...cfg,cards:['type']};PIP.mode='battle';
    await pipIcons();PIP.pages=pipData();
    if(!PIP.pages.length)throw new Error('カードを作れませんでした');
    if(!PIP.cv){PIP.cv=document.createElement('canvas');PIP.cv.width=PIP_W;PIP.cv.height=PIP_H}
    let r=null,how='WebCodecs';try{r=await pipEncodeWC()}catch(e){how='MediaRecorder（'+(e.message||e)+'）';r=await pipEncodeRec()}
    PL.blob=URL.createObjectURL(r.blob);PL.blobRate=r.rate;PL.blobHow=how+'・'+r.blob.type+'・'+Math.round(r.blob.size/1024)+'KB';
    return PL.blob;
  }finally{PIP.cfg=cfg;PIP.mode=mode;PIP.sig=null;PIP.state='idle'}
}
async function plLoad(){
  const v=document.getElementById('pl-v'),info=document.getElementById('pl-srcinfo');if(!v)return;
  const k=PL.src;let url;
  info.textContent=L('読み込み中…','Loading…');
  try{
    url=k==='blob'?await plBlob():k==='mp4'?'piplab-h264.mp4':k==='mp4a'?'piplab-h264-aac.mp4':'piplab-hls.m3u8';
    if(k==='hls'&&!v.canPlayType('application/vnd.apple.mpegurl')){info.textContent=L('この端末は HLS をそのまま再生できません（iPhone の Safari ならできます）','This browser cannot play HLS natively');plPush({kind:'load',src:k,ok:false,err:'HLS not supported'});return}
    v.src=url;v.playbackRate=v.defaultPlaybackRate=k==='blob'?PL.blobRate:1;v.load();
    await new Promise(r=>{const t=setTimeout(r,6000);v.addEventListener('loadedmetadata',()=>{clearTimeout(t);r()},{once:true})});
    v.playbackRate=k==='blob'?PL.blobRate:1;
    info.textContent=`${L('読み込み','Loaded')}：${k==='blob'?PL.blobHow:url}・readyState ${v.readyState}・${Math.round(v.duration*10)/10||'?'}${L('秒','s')}`;
  }catch(e){info.textContent=L('読み込めませんでした：','Failed: ')+(e.message||e);plPush({kind:'load',src:k,ok:false,err:String(e.message||e)})}
  plDraw();
}
function plPush(x){x.t=new Date().toISOString().slice(11,23);PL.log.push(x);plDraw()}
/* 試す：押した処理の中で、まっ先に呼ぶ（間に await を入れない）ものと、わざと待つものを分ける */
function plTry(m){
  const v=document.getElementById('pl-v');if(!v)return;
  v.muted=!PL.sound;
  const before=plState(v),act=navigator.userActivation?navigator.userActivation.isActive:null;
  const rec={kind:'try',src:PL.src,m,before,act,standalone:navigator.standalone===true,ev:[]};
  PL.cur=rec;
  const finish=(res)=>{Object.assign(rec,res);setTimeout(()=>{rec.after=plState(v);plDraw()},2500);plPush(rec)};
  const std=()=>{try{const p=v.requestPictureInPicture?v.requestPictureInPicture():null;if(!p)return finish({call:'requestPictureInPicture',res:'unsupported',err:'no method'});
      return p.then(()=>finish({call:'requestPictureInPicture',res:'resolved'}),e=>finish({call:'requestPictureInPicture',res:'rejected',err:(e.name||'')+': '+(e.message||'')}))}
    catch(e){finish({call:'requestPictureInPicture',res:'threw',err:(e.name||'')+': '+(e.message||'')})}};
  const wk=()=>{try{if(typeof v.webkitSetPresentationMode!=='function')return finish({call:'webkitSetPresentationMode',res:'unsupported'});
      v.webkitSetPresentationMode('picture-in-picture');finish({call:'webkitSetPresentationMode',res:'called'})}
    catch(e){finish({call:'webkitSetPresentationMode',res:'threw',err:(e.name||'')+': '+(e.message||'')})}};
  if(m!=='play'&&m!=='fs'&&m!=='auto'&&v.paused){const p=v.play();if(p&&p.catch)p.catch(()=>{})}
  if(m==='std')return std();
  if(m==='wk')return wk();
  if(m==='play'){const p=v.play();Promise.resolve(p).then(()=>{rec.actAfter=navigator.userActivation?navigator.userActivation.isActive:null;std()},e=>finish({call:'play',res:'rejected',err:(e.name||'')+': '+(e.message||'')}));return}
  if(m==='d0')return setTimeout(()=>{rec.actAfter=navigator.userActivation?navigator.userActivation.isActive:null;std()},0);
  if(m==='d1500')return setTimeout(()=>{rec.actAfter=navigator.userActivation?navigator.userActivation.isActive:null;std()},1500);
  if(m==='d6000')return setTimeout(()=>{rec.actAfter=navigator.userActivation?navigator.userActivation.isActive:null;std()},6000);
  if(m==='wkd1500')return setTimeout(wk,1500);
  if(m==='fs'){
    try{const p=v.play();if(p&&p.catch)p.catch(()=>{})}catch(e){}
    try{if(typeof v.webkitEnterFullscreen==='function'){v.webkitEnterFullscreen();finish({call:'webkitEnterFullscreen',res:'called',note:L('全画面のプレーヤーに PiP のボタンがあれば押して、戻ってから下で結果を選んでください','Tap the PiP button in the fullscreen player if present, then report below')})}
      else if(v.requestFullscreen){v.requestFullscreen().then(()=>finish({call:'requestFullscreen',res:'resolved'}),e=>finish({call:'requestFullscreen',res:'rejected',err:(e.name||'')+': '+(e.message||'')}))}
      else finish({call:'fullscreen',res:'unsupported'})}
    catch(e){finish({call:'webkitEnterFullscreen',res:'threw',err:(e.name||'')+': '+(e.message||'')})}
    return}
  if(m==='auto'){
    try{v.autoPictureInPicture=true;v.setAttribute('autopictureinpicture','')}catch(e){}
    const p=v.play();Promise.resolve(p).then(()=>finish({call:'autoPictureInPicture',res:'playing',note:L('再生したまま、ホームに戻ってください（上にスワイプ）。小さな画面が出たかを、戻ってから下で選んでください','Go to the Home Screen while playing, then report below')}),e=>finish({call:'play',res:'rejected',err:(e.name||'')+': '+(e.message||'')}));
  }
}
function plSeen(ok){const r=[...PL.log].reverse().find(x=>x.kind==='try');if(!r)return;r.seen=ok;plDraw()}
function plReport(){
  const e=plEnv(),L1=[];
  L1.push('# PiP調査 '+new Date().toISOString());
  L1.push(`iOS ${e.ios} / standalone=${e.standalone} / display-mode=${e.displayMode}`);
  L1.push(`pictureInPictureEnabled=${e.pipEnabled} / requestPictureInPicture=${e.hasReq} / webkitSetPresentationMode=${e.hasWk} / webkitSupportsPresentationMode(pip)=${e.wkSupports} / webkitEnterFullscreen=${e.fsSupports} / autoPictureInPicture=${e.autoAttr}`);
  L1.push('UA: '+e.ua);
  for(const x of PL.log){
    if(x.kind==='load'){L1.push(`[${x.t}] 読み込み失敗 ${x.src}: ${x.err}`);continue}
    if(x.kind==='ev'){L1.push(`[${x.t}]   event ${x.name}${x.mode?' mode='+x.mode:''}`);continue}
    const a=x.after||{};
    L1.push(`[${x.t}] ${x.src} × ${x.m} → ${x.call} ${x.res}${x.err?' ('+x.err+')':''} | act=${x.act}${x.actAfter!==undefined?'→'+x.actAfter:''} | 前 rs${x.before.rs} paused=${x.before.paused} muted=${x.before.muted} wk=${x.before.wk} | 後 mode=${a.mode} pipEl=${a.pipEl} | 見えた=${x.seen===true?'はい':x.seen===false?'いいえ':'未回答'}`);
  }
  return L1.join('\n');
}
function plDraw(){
  const el=document.getElementById('pl-log'),env=document.getElementById('pl-env');if(!el)return;
  const e=plEnv();
  if(env)env.innerHTML=[
    [L('ホーム画面のアプリとして開いている','Standalone'),e.standalone?L('はい','Yes'):L('いいえ（Safari など）','No (browser)')],
    ['iOS',e.ios],
    ['display-mode',e.displayMode],
    ['pictureInPictureEnabled',String(e.pipEnabled)],
    ['webkitSupportsPresentationMode(pip)',String(e.wkSupports)],
    ['requestPictureInPicture / webkitSetPresentationMode',`${e.hasReq} / ${e.hasWk}`],
    ['webkitEnterFullscreen / autoPictureInPicture',`${e.fsSupports} / ${e.autoAttr}`]
  ].map(([k,v])=>`<div class="pl-kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
  const tries=PL.log.filter(x=>x.kind!=='ev');
  el.innerHTML=tries.length?tries.slice(-12).reverse().map(x=>x.kind==='load'?`<li class="pl-bad">${esc(x.t)} ${esc(x.src)}：${esc(x.err)}</li>`:
    `<li class="${x.res==='resolved'||(x.after&&(x.after.mode==='picture-in-picture'||x.after.pipEl))?'pl-ok':x.res==='rejected'||x.res==='threw'||x.res==='unsupported'?'pl-bad':''}"><b>${esc(x.src)} × ${esc(x.m)}</b> → ${esc(x.call)} <b>${esc(x.res)}</b>${x.err?`<br><small>${esc(x.err)}</small>`:''}${x.note?`<br><small>${esc(x.note)}</small>`:''}<br><small>${L('押した効果','activation')}：${esc(String(x.act))}${x.actAfter!==undefined?' → '+esc(String(x.actAfter)):''}・${L('あと','after')}：mode=${esc(x.after?x.after.mode:'…')} pipEl=${esc(x.after?String(x.after.pipEl):'…')}・${L('見えた','seen')}：${x.seen===true?L('はい','yes'):x.seen===false?L('いいえ','no'):L('未回答','—')}</small></li>`).join(''):`<li class="pl-dim">${L('まだ試していません','No attempts yet')}</li>`;
  const ta=document.getElementById('pl-rep');if(ta)ta.value=plReport();
}
function piplabView(){
  setHeader(L('PiP の調査','PiP lab'),'#/pip');
  V.innerHTML=`<div class="pl" data-notr>
  <p class="lead" style="padding:14px 16px 4px">${L('iPhone の「ホーム画面に追加」したアプリの中で、PiP を開けるかを確かめるページです。上から順に試して、最後に「結果を写す」で写したものを送ってください。','Checks whether PiP can open inside the installed Home Screen app.')}</p>
  <div class="pl-sec"><h3>1. ${L('この端末','This device')}</h3><div id="pl-env"></div></div>
  <div class="pl-sec"><h3>2. ${L('動画の種類','Video')}</h3>
    <div class="pills" style="padding:0 0 8px;flex-wrap:wrap">${PL_SRCS.map(([k,t])=>`<button class="pill" data-pls="${k}" aria-pressed="${k===PL.src}">${esc(t)}</button>`).join('')}</div>
    <label class="pl-chk"><input type="checkbox" id="pl-snd"${PL.sound?' checked':''}> ${L('音を出す（消音しない）','Unmuted')}</label>
    <video id="pl-v" class="pl-v" playsinline webkit-playsinline muted loop controls preload="auto"></video>
    <p class="vcap" id="pl-srcinfo"></p></div>
  <div class="pl-sec"><h3>3. ${L('開き方を試す（1つ押すごとに、小さな画面が出たかを答える）','Try each way (then answer below)')}</h3>
    <div class="pl-btns">${PL_METHODS.map(([k,t])=>`<button class="btn btn-s" data-plm="${k}">${esc(t)}</button>`).join('')}</div>
    <div class="pl-seen"><span>${L('いま試したもので、小さな画面（PiP）は出ましたか？','Did a PiP window appear?')}</span><button class="btn btn-p" data-plseen="1">${L('出た','Yes')}</button><button class="btn btn-s" data-plseen="0">${L('出なかった','No')}</button></div>
    <ul class="pl-log" id="pl-log"></ul></div>
  <div class="pl-sec"><h3>4. ${L('結果を写す','Copy the results')}</h3>
    <textarea id="pl-rep" class="pl-rep" readonly rows="8"></textarea>
    <div class="btns" style="padding:8px 0 0"><button class="btn btn-p" id="pl-copy">${L('結果を写す（コピー）','Copy')}</button><button class="btn btn-s" id="pl-clear">${L('記録を消す','Clear')}</button></div></div>
  <div class="pl-sec"><h3>5. ${L('最後の手段：Safari で開く','Last resort: open in Safari')}</h3>
    <p class="vcap">${L('ホーム画面のアプリで開けないときだけ使う方法です。Safari で同じページを開き、同じ試し方をして比べてください（下のボタンで Safari が開くかも確かめます。開かない iOS もあります）。','Use only if PiP cannot open in the installed app.')}</p>
    <div class="btns"><a class="btn btn-s" id="pl-safari" href="x-safari-https://${esc(location.host)}${esc(location.pathname)}#/piplab">${L('Safari で開く（試験）','Open in Safari (experimental)')}</a></div></div>
  </div>`;
  const v=document.getElementById('pl-v');
  const evs=['enterpictureinpicture','leavepictureinpicture','webkitpresentationmodechanged','webkitbeginfullscreen','webkitendfullscreen','play','pause','error'];
  evs.forEach(n=>v.addEventListener(n,()=>{if(n==='play'||n==='pause')return;PL.log.push({kind:'ev',name:n,mode:v.webkitPresentationMode,t:new Date().toISOString().slice(11,23)});if(PL.cur&&n!=='error')PL.cur.ev.push(n);plDraw()}));
  if(!plView._vis){plView._vis=true;document.addEventListener('visibilitychange',()=>{if(keyOf(cur)==='piplab'){PL.log.push({kind:'ev',name:'visibility:'+document.visibilityState,t:new Date().toISOString().slice(11,23)});plDraw()}})}
  V.querySelector('.pl').addEventListener('click',e=>{
    const s=e.target.closest('[data-pls]');if(s){PL.src=s.dataset.pls;V.querySelectorAll('[data-pls]').forEach(b=>b.setAttribute('aria-pressed',b===s));plLoad();return}
    const m=e.target.closest('[data-plm]');if(m){plTry(m.dataset.plm);return}
    const sn=e.target.closest('[data-plseen]');if(sn){plSeen(sn.dataset.plseen==='1');return}
    if(e.target.closest('#pl-copy')){const t=plReport();(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>toast(L('結果をコピーしました','Copied'))).catch(()=>{const ta=document.getElementById('pl-rep');ta.focus();ta.select();toast(L('選んだ文字を長押しでコピーしてください','Select and copy the text'))});return}
    if(e.target.closest('#pl-clear')){PL.log=[];plDraw();return}
    if(e.target.closest('#pl-safari'))PL.log.push({kind:'ev',name:'open-safari-tapped',t:new Date().toISOString().slice(11,23)});
  });
  document.getElementById('pl-snd').onchange=e=>{PL.sound=e.target.checked;v.muted=!PL.sound};
  plDraw();plLoad();
}
const plView=piplabView;
