/* ===================== 対戦の振り返り（#/replay） =====================
   iPhone の画面収録の動画を選ぶと、この端末の中で画面が変わった場面の静止画を取り出し、その静止画だけをサーバー（worker/src/replay.js）へ送る。
   AI が読んだ事実（相手の6匹・お互いの選出・相手の技と持ち物・勝ち負け）を直してから記録し、記録から勝率や苦手な相手を出す。
   動画そのものはどこにも送らない・保存しない */
const RP={read:null,list:null};
/* 動画から静止画を取り出す：1秒ごとに見て、画面が変わったとき（技・持ち物の文字が出た、ポケモンが入れかわった等）だけ残す。
   同じ画面が続くあいだ（技を選んでいる間など）は送らない。最後は結果の画面 */
async function rpFrames(file,onp){
  const url=URL.createObjectURL(file),v=document.createElement('video');
  v.muted=true;v.playsInline=true;v.preload='auto';v.src=url;
  try{
    await new Promise((res,rej)=>{v.onloadedmetadata=res;v.onerror=()=>rej(new Error('動画を開けませんでした（対応していない形式かもしれません）。'))});
    try{await v.play();v.pause()}catch(e){}
    const dur=Math.min(v.duration||0,1200);if(!(dur>2))throw new Error('動画が短すぎるか、長さを読めませんでした。');
    const step=Math.max(1,dur/700),ts=[];for(let t=.5;t<dur-.7;t+=step)ts.push(t);ts.push(Math.max(0,dur-.6));
    const W=v.videoWidth||512,H=v.videoHeight||288,sc=Math.min(1,512/Math.max(W,H)),c=document.createElement('canvas');
    c.width=Math.round(W*sc);c.height=Math.round(H*sc);const g=c.getContext('2d');
    const tw=48,th=27,tc=document.createElement('canvas');tc.width=tw;tc.height=th;const tg=tc.getContext('2d',{willReadFrequently:true});
    const thumb=()=>{tg.drawImage(v,0,0,tw,th);const d=tg.getImageData(0,0,tw,th).data,a=new Float32Array(tw*th);for(let i=0;i<a.length;i++)a[i]=(d[i*4]+d[i*4+1]+d[i*4+2])/3;return a};
    /* 画面を横4×縦3に分け、いちばん変わったところの変わり具合（0〜255）。文字の帯やポケモンの入れかわりのような一部の変化も拾う */
    const diff=(x,y)=>{const S=new Float32Array(12);for(let i=0;i<x.length;i++){const cx=Math.min(3,Math.floor((i%tw)/(tw/4))),cy=Math.min(2,Math.floor(Math.floor(i/tw)/(th/3)));S[cy*4+cx]+=Math.abs(x[i]-y[i])}return Math.max(...S)/(x.length/12)};
    let out=[],last=null;
    for(let i=0;i<ts.length;i++){
      await new Promise(res=>{const done=()=>{v.removeEventListener('seeked',done);res()};v.addEventListener('seeked',done);v.currentTime=ts[i];setTimeout(done,3000)});
      const th1=thumb(),sc1=last?diff(th1,last):999;
      if(sc1>=12||i===ts.length-1){g.drawImage(v,0,0,c.width,c.height);out.push({t:Math.round(ts[i]*10)/10,d:c.toDataURL('image/jpeg',.6).split(',')[1],s:sc1});last=th1}
      onp&&onp(i+1,ts.length,out.length);
    }
    /* 多すぎるときは、変わり方の小さいものから減らす（最初と最後は残す） */
    const MAX=96;
    if(out.length>MAX){const keep=new Set([out[0],out[out.length-1],...out.slice(1,-1).sort((a,b)=>b.s-a.s).slice(0,MAX-2)]);out=out.filter(f=>keep.has(f))}
    return out.map(({t,d})=>({t,d}));
  }finally{URL.revokeObjectURL(url)}
}
const rpChips=(nos,key)=>nos.map(n=>byNo[n]?`<span class="aop"><span class="aopi"><span class="av">${stamp(byNo[n])}</span><b>${esc(byNo[n].n)}</b></span><button class="aox" data-rprm="${key}:${n}" aria-label="${esc(byNo[n].n)}を外す">${SVG(I.x,14)}</button></span>`:'').join('');
async function replayView(){
  setHeader('対戦の振り返り','#/tools');
  V.innerHTML='<p class="empty">読み込み中…</p>';
  try{await fbLoad();await AUTH.wait}catch(e){}
  if(keyOf(cur)!=='replay')return;
  if(!AUTH.user){V.innerHTML=`<div class="bnote" style="margin:16px">対戦の振り返りは、記録を自分だけのものとして残すため、<a href="#/account" style="color:var(--acc)">ログイン</a>が必要です。</div>`;return}
  V.innerHTML=`<div id="rp-root"><p class="note" style="padding-top:14px">iPhoneの<b>画面収録</b>で対戦を録画し、その動画を選ぶと、相手の6匹・お互いの選出・相手が使った技と持ち物・勝ち負けを読み取って記録します。記録がたまると、勝率や苦手な相手が分かります。</p>
    <div class="as-read"><label class="btn btn-p" for="rp-file" style="cursor:pointer">${SVG(I.image,18)}対戦の動画を選ぶ</label><input type="file" id="rp-file" accept="video/*" hidden>
      <p class="vcap">動画はこの端末の中で、画面が変わった場面の静止画だけを取り出して送ります。、動画そのものは送りません（静止画も読み取りに使うだけで保存しません）。選出画面から結果の画面まで入っている動画がいちばん正確です。1日20本まで。</p><div id="rp-msg"></div></div>
    <div id="rp-edit"></div><div id="rp-stats"><p class="empty">記録を読み込み中…</p></div></div>`;
  const msg=(t,bad)=>{document.getElementById('rp-msg').innerHTML=t?`<div class="bnote" style="margin:8px 0 0${bad?';box-shadow:inset 0 0 0 1px var(--w2)':''}">${t}</div>`:''};
  document.getElementById('rp-file').onchange=async e=>{
    const f=e.target.files[0];e.target.value='';if(!f)return;
    try{msg('動画から静止画を取り出しています…');
      const fr=await rpFrames(f,(i,n,k)=>msg(`動画を確かめています… ${Math.round(i/n*100)}%（画面が変わった場面 ${k}枚）`));
      msg(`AIが読み取っています…（${fr.length}枚・30〜60秒ほど）`);
      const j=await authFetch('/api/replay-read',{frames:fr});
      RP.read={fmt:j.fmt||FMT,result:j.result,opp:j.opp,my:j.my.length?j.my:team.map(x=>x.no),opp_sel:j.opp_sel,my_sel:j.my_sel,info:j.info||{}};
      msg(`読み取りました（${j.sec}秒）。違うところがあれば直してから「記録する」を押してください。`);rpEdit();
    }catch(err){msg(esc(err.message||'読み取れませんでした。'),true)}};
  rpLoad();
}
/* 読み取った結果を直す欄 */
function rpEdit(){
  const el=document.getElementById('rp-edit'),r=RP.read;if(!el)return;if(!r){el.innerHTML='';return}
  const row=(t,key,max)=>`<div class="sec"><h2>${t}</h2><span style="font:700 14px Inter,sans-serif;color:var(--dim)">${r[key].length}/${max}</span></div><div class="aopp">${rpChips(r[key],key)}</div>`;
  el.innerHTML=`<div class="rp-box">
    <div class="pills" style="padding:4px 0 0"><button class="pill" data-rpres="win" aria-pressed="${r.result==='win'}">勝ち</button><button class="pill" data-rpres="lose" aria-pressed="${r.result==='lose'}">負け</button><button class="pill" data-rpres="" aria-pressed="${!r.result}">わからない</button>
      <span style="margin-left:auto"></span><button class="pill" data-rpfmt="single" aria-pressed="${r.fmt!=='double'}">シングル</button><button class="pill" data-rpfmt="double" aria-pressed="${r.fmt==='double'}">ダブル</button></div>
    ${row('相手の6匹','opp',6)}${row('相手が出してきたポケモン','opp_sel',r.fmt==='double'?4:3)}${row('自分が出したポケモン','my_sel',r.fmt==='double'?4:3)}
    ${Object.keys(r.info).length?`<div class="sec"><h2>相手が見せた技・持ち物</h2></div>${Object.entries(r.info).filter(([n])=>byNo[n]).map(([n,v])=>`<div class="row-s" style="padding:2px 16px">${esc(byNo[n].n)}：${[v.it&&esc(ITEMN[v.it]||v.it),...(v.mv||[]).map(id=>esc(mName(id)))].filter(Boolean).join('・')}</div>`).join('')}`:''}
    <div class="cform" style="padding:8px 16px 0"><label>ポケモンを足す（入れる欄を選んでから名前を入れる）<select class="sel" id="rp-to"><option value="opp">相手の6匹</option><option value="opp_sel">相手が出した</option><option value="my_sel">自分が出した</option></select><input id="rp-q" placeholder="ポケモン名（ひらがなOK）" autocomplete="off"></label></div><div id="rp-sg"></div>
    <div class="btns"><button class="btn btn-p" id="rp-save">記録する</button><button class="btn btn-s" id="rp-assist">選出アシストで見る</button></div>
    <button class="bback" id="rp-cancel" style="margin:0 16px 12px">記録しない</button></div>`;
  const q=document.getElementById('rp-q'),sg=document.getElementById('rp-sg');
  q.oninput=()=>{const t=q.value.trim();sg.innerHTML=t?P.filter(p=>nmHit(p,t)).slice(0,5).map(p=>`<button class="row" data-rpadd="${p.no}" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line);text-align:left;color:inherit"><span class="av">${stamp(p)}</span><div class="row-m"><div class="row-t">${nm(p)}</div></div></button>`).join(''):''};
  el.onclick=async e=>{
    const rm=e.target.closest('[data-rprm]');if(rm){const[k,n]=rm.dataset.rprm.split(':');r[k]=r[k].filter(x=>x!==+n);rpEdit();return}
    const ad=e.target.closest('[data-rpadd]');if(ad){const k=document.getElementById('rp-to').value,max=k==='opp'?6:(r.fmt==='double'?4:3);if(r[k].length>=max){toast(`${max}匹までです`);return}if(!r[k].includes(+ad.dataset.rpadd))r[k].push(+ad.dataset.rpadd);rpEdit();return}
    const rs=e.target.closest('[data-rpres]');if(rs){r.result=rs.dataset.rpres||null;rpEdit();return}
    const fm=e.target.closest('[data-rpfmt]');if(fm){r.fmt=fm.dataset.rpfmt;rpEdit();return}
    if(e.target.closest('#rp-cancel')){RP.read=null;rpEdit();return}
    if(e.target.closest('#rp-assist')){opp6=r.opp.slice(0,6);saveOpp6();nav('#/assist');return}
    if(e.target.closest('#rp-save')){if(!r.opp.length){toast('相手のポケモンを入れてください');return}
      try{await authFetch('/api/battles',r);RP.read=null;rpEdit();toast('記録しました');rpLoad()}catch(err){toast(err.message)}}
  };
}
/* 記録から：勝率・よく当たる相手と勝率・苦手な相手・よく選んだ組み合わせ */
async function rpLoad(){
  const el=document.getElementById('rp-stats');if(!el)return;
  let bs;try{bs=(await authFetch('/api/battles')).battles}catch(e){el.innerHTML=`<div class="bnote" style="margin:16px">${esc(e.message)}</div>`;return}
  if(!document.body.contains(el))return;
  if(!bs.length){el.innerHTML='<p class="empty" style="padding:28px 24px">まだ記録がありません。<br>対戦の動画を選ぶと、ここに勝率や苦手な相手が出ます。</p>';return}
  const done=bs.filter(b=>b.result),win=done.filter(b=>b.result==='win').length;
  const pct=(w,n)=>n?Math.round(w/n*100):0;
  const agg=(key)=>{const m={};done.forEach(b=>b[key].forEach(n=>{const o=m[n]=m[n]||{n:+n,c:0,w:0};o.c++;if(b.result==='win')o.w++}));return Object.values(m).filter(o=>byNo[o.n])};
  const seen=agg('opp').sort((a,b)=>b.c-a.c),hard=seen.filter(o=>o.c>=3&&pct(o.w,o.c)<45).sort((a,b)=>pct(a.w,a.c)-pct(b.w,b.c)).slice(0,5);
  const picked=agg('opp_sel').sort((a,b)=>b.c-a.c).slice(0,6);
  const sets={};done.filter(b=>b.my_sel.length).forEach(b=>{const k=[...b.my_sel].sort((x,y)=>x-y).join('-');const o=sets[k]=sets[k]||{k,c:0,w:0};o.c++;if(b.result==='win')o.w++});
  const mine=Object.values(sets).sort((a,b)=>b.c-a.c).slice(0,5);
  const mrow=o=>`<a class="row" href="#/p/${o.n}"><span class="av">${stamp(byNo[o.n])}</span><div class="row-m"><div class="row-t">${nm(byNo[o.n])}</div><div class="row-s">${o.c}戦 ${o.w}勝 ${o.c-o.w}敗</div></div><div class="row-n"><b>${pct(o.w,o.c)}%</b><span>勝率</span></div></a>`;
  el.innerHTML=`<div class="sec"><h2>これまでの記録</h2></div>
    <div class="prof"><div><b>${bs.length}</b><span>対戦</span></div><div><b>${win}-${done.length-win}</b><span>勝ち-負け</span></div><div><b>${pct(win,done.length)}%</b><span>勝率</span></div></div>
    ${hard.length?`<div class="sec"><h2>苦手な相手</h2><span style="font-size:12px;color:var(--dim)">3回以上当たって勝率が低い</span></div>${hard.map(mrow).join('')}
      <div class="btns"><button class="btn btn-s" id="rp-hard">苦手な相手を選出アシストに入れる</button></div>`:''}
    <div class="sec"><h2>よく当たる相手</h2><span style="font-size:12px;color:var(--dim)">相手の6匹にいた回数</span></div>${seen.slice(0,8).map(mrow).join('')}
    ${picked.length?`<div class="sec"><h2>相手によく出されたポケモン</h2></div>${picked.map(mrow).join('')}`:''}
    ${mine.length?`<div class="sec"><h2>自分の選出ごとの勝率</h2></div>${mine.map(o=>`<div class="row"><div class="row-m"><div class="row-t" style="font-size:14px">${o.k.split('-').map(n=>byNo[n]?esc(byNo[n].n):'').join('・')}</div><div class="row-s">${o.c}戦 ${o.w}勝</div></div><div class="row-n"><b>${pct(o.w,o.c)}%</b><span>勝率</span></div></div>`).join('')}`:''}
    <div class="sec"><h2>最近の対戦</h2></div>${bs.slice(0,20).map(b=>`<div class="row"><div class="row-m"><div class="row-t" style="font-size:14px">${b.result==='win'?'<b style="color:#00a36c">勝ち</b>':b.result==='lose'?'<b style="color:var(--w2)">負け</b>':'—'}　${b.fmt==='double'?'ダブル':'シングル'}　${new Date(b.at).toLocaleDateString('ja-JP')}</div><div class="row-s">相手：${b.opp.map(n=>byNo[n]?esc(byNo[n].n):'').join('・')}</div></div><button class="bback" data-rpdel="${b.id}" style="color:var(--w2)">消す</button></div>`).join('')}
    <p class="note" style="color:var(--mute)">勝率は「勝ち・負け」が分かっている対戦だけで計算しています。記録はあなただけが見られます。</p>`;
  const h=document.getElementById('rp-hard');if(h)h.onclick=()=>{opp6=hard.map(o=>o.n).slice(0,6);saveOpp6();nav('#/assist')};
  el.querySelectorAll('[data-rpdel]').forEach(b=>b.onclick=async()=>{if(!confirm('この記録を消します。よろしいですか？'))return;try{await authFetch(`/api/battles/${b.dataset.rpdel}/delete`,{});rpLoad()}catch(e){toast(e.message)}});
}
