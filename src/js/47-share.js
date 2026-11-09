/* ===================== パーティを画像で共有する・共有されたパーティを見る（2026/11/04 依頼主の要望：利用者を増やすため） =====================
   ・パーティの画面の「画像で共有」：6匹（名前・タイプ・持ち物・技）を1枚の画像（1200×675）にする。
     iPhone など共有できる端末では、画像＋文＋リンクをそのまま X などに送る（端末の共有の画面）。
     できない端末（パソコン）は、画像を見せて「画像を保存」「X に投稿」（画像はあとから付ける）。
   ・共有のリンクは https://サイト/t/445-149-… 。Cloudflare Pages の functions/t/[[path]].js が、X に貼ったときの
     題名・説明・画像（og）を返してから #/share/445-149-… に移る。#/share は「見るだけ」の画面で、
     自分のパーティを勝手に書きかえない（「このパーティを使う」を押したときだけ空いている枠に入れる）。 */
const SITE_BASE=()=>/^https?:/.test(location.protocol)?location.origin:'https://game-kids.app';
const shareNos=list=>list.map(x=>x.no).filter(n=>byNo[n]).slice(0,6);
const shareLink=nos=>SITE_BASE()+'/t/'+nos.join('-');
/* 画像を作る */
function svgImg(svg,w,h){
  /* 画面の CSS が効かないので、図形の線の色をここで決める */
  const s=svg.replace('<svg ',`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" `).replace('<defs>','<style>.rg-ring{fill:none;stroke:rgba(255,255,255,.28);stroke-width:1.2}</style><defs>');
  return new Promise(res=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>res(null);i.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s)});
}
function rrect(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}
function fitText(g,t,maxW){if(g.measureText(t).width<=maxW)return t;while(t.length>1&&g.measureText(t+'…').width>maxW)t=t.slice(0,-1);return t+'…'}
async function teamCard(list,title,noLogo){
  const W=1200,H=675,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  const FF='"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",Meiryo,sans-serif';
  /* 背景 */
  const bg=g.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#0b1220');bg.addColorStop(1,'#16102a');g.fillStyle=bg;g.fillRect(0,0,W,H);
  const glow=(x,y,r,col)=>{const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,col);gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,W,H)};
  glow(120,60,520,'rgba(29,155,240,.22)');glow(1120,640,560,'rgba(120,86,255,.18)');
  /* 見出し */
  g.fillStyle='#fff';g.font=`800 40px ${FF}`;g.textBaseline='alphabetic';g.fillText(fitText(g,title||'マイパーティ',820),56,78);
  g.fillStyle='rgba(255,255,255,.6)';g.font=`600 22px ${FF}`;g.fillText('ポケモンチャンピオンズ',58,112);
  /* 6匹 */
  const cw=352,ch=226,gx=24,x0=56,y0=140;
  for(let k=0;k<6;k++){
    const x=x0+(k%3)*(cw+gx),y=y0+Math.floor(k/3)*(ch+gx),e=list[k];
    rrect(g,x,y,cw,ch,22);g.fillStyle='rgba(255,255,255,.07)';g.fill();g.strokeStyle='rgba(255,255,255,.14)';g.lineWidth=2;g.stroke();
    if(!e||!byNo[e.no])continue;
    const p=byNo[e.no],im=await svgImg(stamp(p),96,96);if(im)g.drawImage(im,x+18,y+18,96,96);
    const fi=formInfo(p);
    g.fillStyle='#fff';g.font=`800 28px ${FF}`;g.fillText(fitText(g,fi.base,cw-140),x+128,y+52);
    if(fi.tag){g.fillStyle='rgba(255,255,255,.6)';g.font=`700 16px ${FF}`;g.fillText(fitText(g,fi.tag,cw-140),x+128,y+76)}
    /* タイプ */
    let tx=x+128;const ty=y+(fi.tag?88:70);g.font=`700 16px ${FF}`;
    p.t.forEach(t=>{const w=g.measureText(t).width+22;rrect(g,tx,ty,w,28,14);g.fillStyle=COL[t];g.fill();g.fillStyle=ONC[t]||'#fff';g.fillText(t,tx+11,ty+20);tx+=w+6});
    /* 持ち物・技 */
    const s=e.set||{},it=s.it&&s.it.k?ITEMN[s.it.k]:'',mv=(s.mv||[]).filter(m=>m&&m.id).map(m=>mName(m.id)).slice(0,4);
    g.font=`700 18px ${FF}`;g.fillStyle='rgba(255,255,255,.85)';
    if(it)g.fillText(fitText(g,'持ち物：'+it,cw-36),x+18,y+142);
    g.font=`600 17px ${FF}`;g.fillStyle='rgba(255,255,255,.72)';
    mv.forEach((m,i)=>g.fillText(fitText(g,m,(cw-48)/2),x+18+(i%2)*((cw-36)/2),y+(it?172:150)+Math.floor(i/2)*26));
  }
  /* 下：サイトの名前とアドレス */
  const logo=noLogo?null:await new Promise(res=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>res(null);i.src='logo.png'});
  if(logo)g.drawImage(logo,W-56-300-46,y0-96,38,38);
  g.fillStyle='#fff';g.font=`800 26px ${FF}`;g.textAlign='right';g.fillText('Game Kid/s',W-56,y0-68);
  g.fillStyle='rgba(255,255,255,.55)';g.font=`600 18px ${FF}`;g.fillText(SITE_BASE().replace(/^https?:\/\//,''),W-56,y0-42);g.textAlign='left';
  /* マークの画像が読めない場所（file:// など）では画像を書き出せないので、マークなしで作り直す */
  try{return await new Promise((r,j)=>{try{c.toBlob(r,'image/png')}catch(e){j(e)}})}catch(e){if(noLogo)throw e;return teamCard(list,title,true)}
}
/* 共有のボタン */
async function shareTeamImage(){
  if(!team.length){toast('パーティが空です');return}
  const nos=shareNos(team),url=shareLink(nos),name=teamName(TEAMS.cur);
  const text=`${name}：${nos.map(n=>formInfo(byNo[n]).base).join('・')}\n#ポケモンチャンピオンズ #GameKids`;
  let blob;try{blob=await teamCard(team,name)}catch(e){blob=null}
  const file=blob&&new File([blob],'party.png',{type:'image/png'});
  if(file&&navigator.canShare&&navigator.canShare({files:[file]})){
    try{await navigator.share({files:[file],text:text+'\n'+url});return}catch(e){if(e&&e.name==='AbortError')return}
  }
  shareSheet(blob,text,url);
}
function shareSheet(blob,text,url){
  const src=blob?URL.createObjectURL(blob):'';
  const o=document.createElement('div');o.className='psheet';
  o.innerHTML=`<div class="psheet-bg"></div><div class="psheet-p" role="dialog" aria-modal="true" aria-label="パーティを共有">
    <h3>パーティを共有</h3>${src?`<img class="shr-img" src="${src}" alt="パーティの画像">`:''}
    <p>X に投稿するときは、先に「画像を保存」を押して、投稿の画面で画像を付けてください。</p>
    <div class="btns" style="padding:4px 0 8px;flex-wrap:wrap">
      ${src?`<a class="btn btn-s" href="${src}" download="party.png">画像を保存</a>`:''}
      <a class="btn btn-p" href="https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}" target="_blank" rel="noopener">X に投稿</a>
      <button class="btn btn-s" data-copy>リンクをコピー</button></div>
    <button class="psheet-x">閉じる</button></div>`;
  document.body.appendChild(o);requestAnimationFrame(()=>o.classList.add('on'));
  const close=()=>{o.classList.remove('on');setTimeout(()=>{o.remove();if(src)URL.revokeObjectURL(src)},180)};
  o.querySelector('.psheet-bg').onclick=o.querySelector('.psheet-x').onclick=close;addEventListener('hashchange',close,{once:true});
  o.querySelector('[data-copy]').onclick=()=>(navigator.clipboard?navigator.clipboard.writeText(url):Promise.reject()).then(()=>toast('リンクをコピーしました')).catch(()=>prompt('リンクをコピーしてください',url));
}
/* 共有されたパーティを見る（#/share/445-149-…）：自分のパーティは変えない */
function shareView(arg){
  setHeader('共有されたパーティ','#/');
  const nos=[...new Set(String(arg||'').split('-').map(Number).filter(n=>byNo[n]))].slice(0,6);
  if(!nos.length){V.innerHTML='<p class="empty">パーティが見つかりません。</p>';return}
  V.innerHTML=`<p class="note" style="padding-top:14px">ほかの人が共有したパーティです。</p>
    ${nos.map(n=>{const p=byNo[n];return `<a class="row" href="#/p/${n}"><span class="av">${stamp(p)}</span><div class="row-m"><div class="row-t">${nm(p)}</div><div class="chips">${p.t.map(chip).join('')}<span class="rt">${p.roles.join('・')}</span></div></div><div class="row-n"><b>${p.bst}</b><span>合計</span></div></a>`}).join('')}
    <div class="btns" style="flex-wrap:wrap"><button class="btn btn-p" id="sh-use">このパーティを使う</button><button class="btn btn-s" id="sh-opp">選出アシストで相手にする</button></div>
    <p class="note" style="color:var(--mute)">「このパーティを使う」を押すと、空いているパーティの枠に入ります（いまのパーティは消えません）。</p>`;
  document.getElementById('sh-use').onclick=()=>useTeam('',nos.map(no=>({no})));
  document.getElementById('sh-opp').onclick=()=>{opp6=nos.slice();saveOpp6();nav('#/assist')};
}

/* ===================== 「〇〇の対策・倒し方」（検索向けの静的ページ counter/番号/ で使う。2026/11/04） =====================
   相手（p）は使用率の高い型（detSet）、こちらは合計種族値の高い60匹＋メガ20匹（gmOpps）をそれぞれの使用率の高い型で、
   お互いの最大ダメージ（estHit）と素早さで比べる。
   ・上から倒せる：こちらが速く、1回で倒せる
   ・強く出られる：こちらが半分以上削れて、相手からは半分未満
   ・受けられる：相手の攻撃が35%未満
   ・気をつけたい：相手から半分以上受けて、こちらは3割未満しか削れない */
function monCounters(p){
  const spd=m=>m.st[5]*(m.item==='choicescarf'?1.5:1);
  const T=mkMon(p,'op',detSet(p));
  const rows=gmOpps().filter(q=>q.no!==p.no&&(q.base||q.no)!==p.no).map(q=>{
    const set=q.base&&byNo[q.base]?{...detSet(byNo[q.base]),ab:q.ab,item:null}:detSet(q);
    const M=mkMon(q,'me',set),a=estHit(M,T),b=estHit(T,M);
    return{q,my:a.pct,their:b.pct,mv:a.mv&&a.mv.n,tmv:b.mv&&b.mv.n,fast:spd(M)>spd(T)}});
  const by=(f,s)=>rows.filter(f).sort(s).slice(0,8);
  return{
    ohko:by(r=>r.fast&&r.my>=100,(x,y)=>y.my-x.my),
    strong:by(r=>r.my>=50&&r.their<50&&!(r.fast&&r.my>=100),(x,y)=>(y.my-y.their)-(x.my-x.their)),
    wall:by(r=>r.their<35,(x,y)=>x.their-y.their),
    threat:by(r=>r.their>=50&&r.my<30,(x,y)=>(y.their-y.my)-(x.their-x.my)),
    spd:Math.round(spd(T)),set:detSet(p)};
}
