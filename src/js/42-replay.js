/* ===================== 対戦の振り返り（#/replay） =====================
   iPhone の画面収録の動画を選ぶと、この端末の中で画面が変わった場面の静止画を取り出し、その静止画だけをサーバー（worker/src/replay.js）へ送る。
   AI が読んだ事実（相手の6匹・お互いの選出・相手の技と持ち物・勝ち負け）を直してから記録し、記録から勝率や苦手な相手を出す。
   動画そのものはどこにも送らない・保存しない */
const RP={read:null,list:null,busy:false,saving:false};
const RP_MAXF=96,RP_SEEKS=700,RP_FEW=5,RP_AI_WAIT=300000;
const rpErr=(m,code)=>Object.assign(new Error(m),{code});
/* 決めた時間で待つのをやめる（動画が開けない・読み取りの返事が来ないままにしない） */
const rpWait=(p,ms,m)=>{let tm;return Promise.race([p,new Promise((_,rej)=>{tm=setTimeout(()=>rej(rpErr(m,'timeout')),ms)})]).finally(()=>clearTimeout(tm))};
/* 多すぎるときは、変わり方の小さいものから減らす。最初と、結果の画面が入りやすい最後の4枚は必ず残す（時間の順のまま） */
function rpTrim(out,max){
  if(out.length<=max)return out;
  const tail=out.slice(-4),mid=out.slice(1,-4);
  const keep=new Set([out[0],...tail,...mid.slice().sort((a,b)=>b.s-a.s).slice(0,Math.max(0,max-1-tail.length))]);
  return out.filter(f=>keep.has(f));
}
/* 動画から静止画を取り出す：動画の最初から最後まで（多くても700か所）を見て、画面が変わったとき（技・持ち物の文字が出た、ポケモンが入れかわった等）だけ残す。
   同じ画面が続くあいだ（技を選んでいる間など）は送らない。最後は結果の画面。
   2026/11/13：開けない・長さが分からない・読み込みが止まる動画で待ち続けないようにした。20分より長い動画は後ろが切れていた（結果の画面が入らない）ので、最後まで見るようにした */
async function rpFrames(file,onp){
  if(file&&file.type&&!/^video\//.test(file.type))throw rpErr('動画のファイルではないようです。画面収録の動画を選んでください。','type');
  const url=URL.createObjectURL(file),v=document.createElement('video');
  v.muted=true;v.playsInline=true;v.preload='auto';v.src=url;
  try{
    await rpWait(new Promise((res,rej)=>{v.onloadedmetadata=res;v.onerror=()=>rej(rpErr('動画を開けませんでした（対応していない形式か、ファイルが壊れているかもしれません）。','open'))}),20000,'動画を開けませんでした（読み込みに時間がかかりすぎました）。');
    try{await rpWait(v.play(),3000,'');v.pause()}catch(e){try{v.pause()}catch(e2){}}
    if(!v.videoWidth||!v.videoHeight)throw rpErr('この動画には映像が入っていないようです。','novideo');
    let dur=v.duration;
    /* 長さが書かれていない動画（録画のしかたによる）：最後まで送ると長さが分かる */
    if(dur===Infinity){try{await rpWait(new Promise(res=>{v.ondurationchange=()=>{if(isFinite(v.duration))res()};v.currentTime=1e7}),8000,'')}catch(e){}dur=v.duration}
    if(!isFinite(dur))throw rpErr('動画の長さを読めませんでした。','dur');
    if(!(dur>2))throw rpErr('動画が短すぎます（2秒より長い動画を選んでください）。','short');
    const step=Math.max(1,dur/RP_SEEKS),ts=[];for(let t=.5;t<dur-.7;t+=step)ts.push(t);ts.push(Math.max(0,dur-.6));
    const W=v.videoWidth,H=v.videoHeight,sc=Math.min(1,512/Math.max(W,H)),c=document.createElement('canvas');
    c.width=Math.round(W*sc);c.height=Math.round(H*sc);const g=c.getContext('2d');
    const tw=48,th=27,tc=document.createElement('canvas');tc.width=tw;tc.height=th;const tg=tc.getContext('2d',{willReadFrequently:true});
    const thumb=()=>{tg.drawImage(v,0,0,tw,th);const d=tg.getImageData(0,0,tw,th).data,a=new Float32Array(tw*th);for(let i=0;i<a.length;i++)a[i]=(d[i*4]+d[i*4+1]+d[i*4+2])/3;return a};
    /* 画面を横4×縦3に分け、いちばん変わったところの変わり具合（0〜255）。文字の帯やポケモンの入れかわりのような一部の変化も拾う */
    const diff=(x,y)=>{const S=new Float32Array(12);for(let i=0;i<x.length;i++){const cx=Math.min(3,Math.floor((i%tw)/(tw/4))),cy=Math.min(2,Math.floor(Math.floor(i/tw)/(th/3)));S[cy*4+cx]+=Math.abs(x[i]-y[i])}return Math.max(...S)/(x.length/12)};
    let out=[],last=null,stall=0,stalls=0;
    for(let i=0;i<ts.length;i++){
      /* 場所の移動（seek）が3秒で終わらなければ、その場所は飛ばす（前の場面のままの絵を使わない）。5回続けば止まったとみなす */
      const okSeek=await new Promise(res=>{let tm;const done=ok=>{clearTimeout(tm);v.removeEventListener('seeked',onS);res(ok)},onS=()=>done(true);v.addEventListener('seeked',onS);tm=setTimeout(()=>done(false),3000);v.currentTime=ts[i]});
      if(!okSeek){stalls++;if(++stall>=5)throw rpErr('動画の読み込みが止まってしまいました。ほかのアプリを閉じるか、短い動画で試してください。','stall');onp&&onp(i+1,ts.length,out.length);continue}
      stall=0;
      const th1=thumb(),sc1=last?diff(th1,last):999;
      if(sc1>=12||i===ts.length-1){g.drawImage(v,0,0,c.width,c.height);out.push({t:Math.round(ts[i]*10)/10,d:c.toDataURL('image/jpeg',.6).split(',')[1],s:sc1});last=th1}
      onp&&onp(i+1,ts.length,out.length);
    }
    if(out.length<3)throw rpErr('動画の中で画面が変わった場面がほとんど見つかりませんでした。対戦の画面が映っている動画か確かめてください。','few');
    const n0=out.length;out=rpTrim(out,RP_MAXF);
    return{frames:out.map(({t,d})=>({t,d})),dur,step:Math.round(step*10)/10,found:n0,dropped:n0-out.length,skipped:stalls};
  }finally{v.removeAttribute('src');try{v.load()}catch(e){}URL.revokeObjectURL(url)}
}
/* うまくいかなかった理由を、利用者に分かる言葉に */
function rpErrText(err){
  const s=err&&err.status;
  if(s===429)return'今日のAI読み取りの回数（1日20本）を使い切りました（明日また使えます）。';
  if(s===503)return/設定/.test(err.message||'')?err.message:'AIが混み合っているか、AIの1日の回数の上限に達していて、いまは読み取れません。少し時間をおいてもう一度試してください。';
  if(s===401)return'ログインの期限が切れました。もう一度ログインしてください。';
  if(s===504)return'AIの読み取りに時間がかかりすぎました。少し時間をおいてもう一度試すか、手で記録してください。';
  if(s===400||s===404)return err.message||'送った内容を読めませんでした。';
  if(s>=500)return'AIの読み取りがうまくいきませんでした（サーバーの不具合か時間切れ）。少し時間をおいてもう一度試してください。';
  if(err&&err.code==='timeout')return err.message||'時間がかかりすぎたため、読み取りをやめました。';
  return(err&&err.message)||'読み取れませんでした。';
}
/* 図鑑にある番号だけ・重ならないように */
const rpNos=(a,max=6)=>[...new Set((Array.isArray(a)?a:[]).map(Number).filter(n=>byNo[n]))].slice(0,max);
/* サーバーの読み取り結果を、直す欄のための形に。読めなかったこと・推測で埋めたことは warn に書く（成功のように見せない。warn は文字のまま、出すときに esc） */
function rpFromRead(j,partyNos){
  const fmt=j.fmt==='double'||j.fmt==='single'?j.fmt:null,cap=(fmt||FMT)==='double'?4:3;
  const r={fmt:fmt||FMT,result:j.result==='win'||j.result==='lose'?j.result:null,opp:rpNos(j.opp),my:rpNos(j.my),opp_sel:rpNos(j.opp_sel,cap),my_sel:rpNos(j.my_sel,cap),info:{},warn:(Array.isArray(j.warn)?j.warn:[]).filter(x=>typeof x==='string').slice(0,12),myFromTeam:false,partial:!!(j.batches&&j.batches.failed),nothing:!!j.nothing};
  if(j.info&&typeof j.info==='object')for(const [k,v] of Object.entries(j.info))if(r.opp.includes(+k)&&v&&typeof v==='object')r.info[k]={mv:(Array.isArray(v.mv)?v.mv:[]).map(Number).filter(Boolean).slice(0,4),it:typeof v.it==='string'?v.it:undefined};
  if(!fmt)r.warn.push(`シングルかダブルかは読み取れなかったので、いま選んでいる${r.fmt==='double'?'ダブル':'シングル'}にしています。違っていれば直してください。`);
  if(!r.my.length&&partyNos&&partyNos.length){r.my=rpNos(partyNos);r.myFromTeam=true;r.warn.push('自分の6匹は読み取れなかったので、いまのパーティを入れています。違っていれば直してください。')}
  const u=j.unknown||{},L=a=>(Array.isArray(a)?a:[]).filter(x=>typeof x==='string').slice(0,8).join('、');
  if(L(u.mon))r.warn.push(`ポケモンの名前として読めなかった文字：${L(u.mon)}（入れていません）`);
  if(L(u.mv))r.warn.push(`技として入れなかったもの：${L(u.mv)}`);
  if(L(u.it))r.warn.push(`持ち物として読めなかった文字：${L(u.it)}（入れていません）`);
  return r;
}
/* 記録する前の確かめ（サーバーと同じ決まり）。問題がなければ空 */
function rpCheck(r){
  const cap=r.fmt==='double'?4:3,F=r.fmt==='double'?'ダブル':'シングル';
  if(r.opp_sel.length>cap||r.my_sel.length>cap)return`${F}で出したポケモンは${cap}匹までです。多い分を外してください。`;
  for(const [s,t,w] of [['opp_sel','opp','相手'],['my_sel','my','自分']]){const out=r[s].filter(n=>!r[t].includes(n));if(out.length&&r[t].length+out.length>6)return`${w}が出したポケモン（${out.map(n=>byNo[n]?byNo[n].n:'').join('・')}）が「${w}の6匹」に入っていません。`}
  if(!r.opp.length&&!r.opp_sel.length)return'相手のポケモンを1匹以上入れてください。';
  return'';
}
const rpChips=(nos,key)=>nos.map(n=>byNo[n]?`<span class="aop"><span class="aopi"><span class="av">${stamp(byNo[n])}</span><b>${esc(byNo[n].n)}</b></span><button class="aox" data-rprm="${key}:${n}" aria-label="${esc(byNo[n].n)}を外す">${SVG(I.x,14)}</button></span>`:'').join('');
async function replayView(){
  setHeader('対戦の振り返り','#/tools');
  V.innerHTML='<p class="empty">読み込み中…</p>';
  try{await fbLoad();await AUTH.wait}catch(e){}
  if(keyOf(cur)!=='replay')return;
  if(!AUTH.user){V.innerHTML=`<div class="bnote" style="margin:16px">対戦の振り返りは、記録を自分だけのものとして残すため、<a href="#/account" style="color:var(--acc)">ログイン</a>が必要です。</div>`;return}
  V.innerHTML=`<div id="rp-root"><p class="note" style="padding-top:14px">iPhoneの<b>画面収録</b>で対戦を録画し、その動画を選ぶと、相手の6匹・お互いの選出・相手が使った技と持ち物・勝ち負けを読み取ります。読み取った内容を確かめて直してから記録します。記録がたまると、勝率や苦手な相手が分かります。</p>
    <div class="as-read"><label class="btn btn-p" for="rp-file" id="rp-pick" style="cursor:pointer">${SVG(I.image,18)}対戦の動画を選ぶ</label><input type="file" id="rp-file" accept="video/*" hidden><button class="btn btn-s" id="rp-man" style="margin-top:8px">動画を使わずに手で記録する</button>
      <p class="vcap">動画はこの端末の中で、画面が変わった場面の静止画だけを取り出して送ります。動画そのものは送りません（静止画も読み取りに使うだけで保存しません）。選出画面から結果の画面まで入っている動画がいちばん正確です。AIの読み取りは1日20本まで。読み取りに失敗しても、手で記録できます。</p><div id="rp-msg" aria-live="polite"></div></div>
    <div id="rp-edit"></div><div id="rp-stats"><p class="empty">記録を読み込み中…</p></div></div>`;
  const msg=(t,bad)=>{const m=document.getElementById('rp-msg');if(m)m.innerHTML=t?`<div class="bnote rp-msg${bad?' rp-bad':''}" style="margin:8px 0 0${bad?';box-shadow:inset 0 0 0 1px var(--w2)':''}">${t}</div>`:''};
  const lock=on=>{RP.busy=on;const l=document.getElementById('rp-pick'),f=document.getElementById('rp-file');if(l){l.classList.toggle('dis',on);l.setAttribute('aria-disabled',on?'true':'false');l.style.opacity=on?'.5':'';l.style.pointerEvents=on?'none':''}if(f)f.disabled=on};
  document.getElementById('rp-file').onchange=async e=>{
    const f=e.target.files[0];e.target.value='';if(!f||RP.busy)return;
    if(typeof evCount==='function')evCount('replay_start');
    lock(true);let stage='frames';
    try{msg('1/3　動画から場面を取り出しています…（この端末の中で行います）');
      const X=await rpFrames(f,(i,n,k)=>msg(`1/3　動画から場面を取り出しています… ${Math.round(i/n*100)}%（画面が変わった場面 ${k}枚）`));
      stage='ai';
      /* 待っている間は経過の秒数を出す（止まっていないと分かるように）。サーバーは遅い束を100秒で切るので、ここでは長めに待つ（2026/11/13：150秒で待つのをやめていた） */
      const t0=Date.now(),aiMsg=()=>msg(`2/3　AIが読み取っています…（${X.frames.length}枚・${Math.round((Date.now()-t0)/1000)}秒経過。1〜2分ほど、長いときは3分ほどかかります）。この画面のままお待ちください。`);
      aiMsg();const tick=setInterval(()=>{if(document.getElementById('rp-msg'))aiMsg();else clearInterval(tick)},1000);
      let j;try{j=await rpWait(authFetch('/api/replay-read',{frames:X.frames}),RP_AI_WAIT,'AIの読み取りに時間がかかりすぎたため、待つのをやめました。少し時間をおいてもう一度試すか、手で記録してください。')}finally{clearInterval(tick)}
      if(!document.getElementById('rp-msg'))return;
      const r=rpFromRead(j,team.map(x=>x.no));
      if(X.step>1.05)r.warn.push(`長い動画なので、${X.step}秒ごとに見ています。短い時間だけ出た文字は読めていないことがあります。`);
      if(X.dropped)r.warn.push(`画面が変わった場面が多かったため、変化の小さい${X.dropped}枚は送っていません。`);
      if(X.skipped)r.warn.push(`動画の${X.skipped}か所は読み込めなかったため飛ばしました。`);
      RP.read=r;
      if(typeof evCount==='function')evCount(r.nothing?'replay_ng':'replay_ok');
      if(r.nothing)msg('<b>動画から対戦の情報を読み取れませんでした。</b><br>対戦の画面が映っているか確かめてください。下の欄で手で入れて記録することもできます。',true);
      else if(r.partial||r.warn.length)msg(`3/3　読み取りが終わりました（${j.sec}秒）。<b>一部は読み取れていないか、確かめが必要です。</b>下の注意を見て、違うところを直してから「記録する」を押してください。`,r.partial);
      else msg(`3/3　読み取りが終わりました（${j.sec}秒）。AIの読み取りは間違えることがあります。確かめて、違うところがあれば直してから「記録する」を押してください。`);
      rpEdit();
    }catch(err){if(typeof evCount==='function')evCount('replay_ng');
      if(!document.getElementById('rp-msg'))return;
      /* どこで止まったか・なぜか・どうすればよいかを出し、手で記録する欄を開く（読み取りが失敗しても記録は残せる） */
      const why=stage==='frames'&&!err.status?esc(err.message||'動画から場面を取り出せませんでした。'):esc(rpErrText(err));
      msg(`<b>${stage==='frames'?'動画から場面を取り出せませんでした。':'読み取れませんでした。'}</b><br>${why}<br>下の欄で、手で記録することもできます。`,true);rpManual();
    }finally{lock(false)}};
  document.getElementById('rp-man').onclick=()=>{rpManual();const e=document.getElementById('rp-edit');if(e)e.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'start'})};
  rpLoad();
}
/* 手で記録する（AI を使わない） */
function rpManual(){if(!RP.read)RP.read={fmt:FMT,result:null,opp:[],my:rpNos(team.map(x=>x.no)),opp_sel:[],my_sel:[],info:{},warn:[],myFromTeam:!!team.length,manual:true};rpEdit()}
/* 読み取った結果を直す欄 */
function rpEdit(){
  const el=document.getElementById('rp-edit'),r=RP.read;if(!el)return;if(!r){el.innerHTML='';return}
  const cap=r.fmt==='double'?4:3;
  const row=(t,key,max,note)=>`<div class="sec"><h2>${t}</h2><span style="font:700 14px Inter,sans-serif;color:${r[key].length>max?'var(--w2)':'var(--dim)'}">${r[key].length}/${max}</span></div>${note?`<p class="vcap" style="margin:0 16px 6px">${note}</p>`:''}<div class="aopp">${rpChips(r[key],key)}</div>`;
  const bad=rpCheck(r);
  el.innerHTML=`<div class="rp-box">
    ${r.warn&&r.warn.length?`<div class="rp-warn" style="margin:12px 16px 0;padding:10px 12px;border-radius:12px;background:var(--acc-t);font-size:13px;line-height:1.5"><b>確かめてほしいこと</b><ul style="margin:4px 0 0;padding-left:18px">${r.warn.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></div>`:''}
    <div class="pills" style="padding:4px 0 0"><button class="pill" data-rpres="win" aria-pressed="${r.result==='win'}">勝ち</button><button class="pill" data-rpres="lose" aria-pressed="${r.result==='lose'}">負け</button><button class="pill" data-rpres="" aria-pressed="${!r.result}">わからない</button></div>
      <div class="pills" style="padding:6px 0 0"><button class="pill" data-rpfmt="single" aria-pressed="${r.fmt!=='double'}">シングル</button><button class="pill" data-rpfmt="double" aria-pressed="${r.fmt==='double'}">ダブル</button></div>
    ${!r.result?'<p class="vcap" style="margin:4px 16px 0">「わからない」の対戦は、勝率には入りません。</p>':''}
    ${row('相手の6匹','opp',6)}${row('相手が出してきたポケモン','opp_sel',cap)}${row('自分の6匹','my',6,r.myFromTeam?'いまのパーティを入れています。この対戦で使ったパーティと違えば直してください。':'')}${row('自分が出したポケモン','my_sel',cap)}
    ${Object.keys(r.info).length?`<div class="sec"><h2>相手が見せた技・持ち物</h2></div>${Object.entries(r.info).filter(([n])=>byNo[n]).map(([n,v])=>`<div class="row-s" style="padding:2px 16px">${esc(byNo[n].n)}：${[v.it&&esc(ITEMN[v.it]||v.it),...(v.mv||[]).map(id=>esc(mName(id)))].filter(Boolean).join('・')||'—'}</div>`).join('')}`:''}
    <div class="cform" style="padding:8px 16px 0"><label>ポケモンを足す（入れる欄を選んでから名前を入れる）<select class="sel" id="rp-to"><option value="opp">相手の6匹</option><option value="opp_sel">相手が出した</option><option value="my">自分の6匹</option><option value="my_sel">自分が出した</option></select><input id="rp-q" placeholder="ポケモン名（ひらがなOK）" autocomplete="off"></label></div><div id="rp-sg"></div>
    <div id="rp-err" role="alert">${bad?`<p class="vcap" style="margin:8px 16px 0;color:var(--w2)">${esc(bad)}</p>`:''}</div>
    <div class="btns"><button class="btn btn-p" id="rp-save"${RP.saving?' disabled':''}>${RP.saving?'記録しています…':'記録する'}</button><button class="btn btn-s" id="rp-assist">選出アシストで見る</button></div>
    <button class="bback" id="rp-cancel" style="margin:0 16px 12px">記録しない</button></div>`;
  const sel=document.getElementById('rp-to');if(RP.to)sel.value=RP.to;sel.onchange=()=>{RP.to=sel.value};
  const q=document.getElementById('rp-q'),sg=document.getElementById('rp-sg');
  q.oninput=()=>{const t=q.value.trim();sg.innerHTML=t?P.filter(p=>nmHit(p,t)).slice(0,5).map(p=>`<button class="row" data-rpadd="${p.no}" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line);text-align:left;color:inherit"><span class="av">${stamp(p)}</span><div class="row-m"><div class="row-t">${nm(p)}</div></div></button>`).join(''):''};
  el.onclick=async e=>{
    const rm=e.target.closest('[data-rprm]');if(rm){const[k,n]=rm.dataset.rprm.split(':');r[k]=r[k].filter(x=>x!==+n);if(k==='opp')delete r.info[n];if(k==='my')r.myFromTeam=false;rpEdit();return}
    const ad=e.target.closest('[data-rpadd]');if(ad){const k=document.getElementById('rp-to').value,no=+ad.dataset.rpadd,max=k==='opp'||k==='my'?6:cap;if(r[k].includes(no)){toast('もう入っています');return}if(r[k].length>=max){toast(`${max}匹までです`);return}r[k].push(no);
      /* 出したポケモンは、その側の6匹にも入れる（6匹に空きがあるとき） */
      const tk=k==='opp_sel'?'opp':k==='my_sel'?'my':null;if(tk&&!r[tk].includes(no)&&r[tk].length<6)r[tk].push(no);if(k==='my'||tk==='my')r.myFromTeam=false;rpEdit();return}
    const rs=e.target.closest('[data-rpres]');if(rs){r.result=rs.dataset.rpres||null;rpEdit();return}
    const fm=e.target.closest('[data-rpfmt]');if(fm){r.fmt=fm.dataset.rpfmt;rpEdit();return}
    if(e.target.closest('#rp-cancel')){if(RP.saving)return;RP.read=null;rpEdit();return}
    if(e.target.closest('#rp-assist')){opp6=r.opp.slice(0,6);saveOpp6();nav('#/assist');return}
    if(e.target.closest('#rp-save')){
      if(RP.saving)return;const why=rpCheck(r);if(why){toast(why);return}
      /* 押したらすぐ止める（二度押しで2件にしない）。失敗しても直した中身は消さない */
      RP.saving=true;rpEdit();
      try{const j=await authFetch('/api/battles',{fmt:r.fmt,result:r.result,opp:r.opp,my:r.my,opp_sel:r.opp_sel,my_sel:r.my_sel,info:r.info});
        RP.saving=false;if(RP.read===r)RP.read=null;rpEdit();toast(j.dup?'同じ記録がすでにあります':'記録しました');
        const m=document.getElementById('rp-msg');if(m)m.innerHTML='';rpLoad();
      }catch(err){RP.saving=false;rpEdit();const x=document.getElementById('rp-err');const t=err.status===429?err.message:err.status===400?err.message:rpErrText(err);
        if(x)x.innerHTML=`<p class="vcap" style="margin:8px 16px 0;color:var(--w2)"><b>記録できませんでした。</b>${esc(t)}（入れた内容はそのまま残っています）</p>`;toast('記録できませんでした')}}
  };
}
/* 記録から数える（2026/11/13）：当たった回数は全部の対戦、勝率は勝ち負けが分かっている対戦だけ（わからないは入れない） */
function rpStats(bs){
  const kn=b=>b.result==='win'||b.result==='lose',known=bs.filter(kn),win=known.filter(b=>b.result==='win').length;
  const agg=key=>{const m={};bs.forEach(b=>[...new Set(b[key]||[])].forEach(n=>{if(!byNo[n])return;const o=m[n]=m[n]||{n:+n,c:0,k:0,w:0};o.c++;if(kn(b)){o.k++;if(b.result==='win')o.w++}}));return Object.values(m)};
  const seen=agg('opp').sort((a,b)=>b.c-a.c||b.k-a.k);
  const hard=seen.filter(o=>o.k>=3&&o.w/o.k<.45).sort((a,b)=>a.w/a.k-b.w/b.k||b.k-a.k).slice(0,5);
  const picked=agg('opp_sel').sort((a,b)=>b.c-a.c).slice(0,6);
  const sets={};bs.filter(b=>(b.my_sel||[]).length).forEach(b=>{const k=[...new Set(b.my_sel)].filter(n=>byNo[n]).sort((x,y)=>x-y).join('-');if(!k)return;const o=sets[k]=sets[k]||{k,c:0,kn:0,w:0};o.c++;if(kn(b)){o.kn++;if(b.result==='win')o.w++}});
  const mine=Object.values(sets).sort((a,b)=>b.c-a.c).slice(0,5);
  return{total:bs.length,known:known.length,win,lose:known.length-win,unknown:bs.length-known.length,seen,hard,picked,mine};
}
const rpPct=(w,n)=>n?Math.round(w/n*100):null;
/* 記録から：勝率・よく当たる相手と勝率・苦手な相手・よく選んだ組み合わせ */
async function rpLoad(){
  const el=document.getElementById('rp-stats');if(!el)return;
  let bs;try{bs=(await authFetch('/api/battles')).battles}catch(e){if(!document.body.contains(el))return;el.innerHTML=`<div class="bnote" style="margin:16px">記録を読み込めませんでした。${esc(e.message)}<br><button class="btn btn-s" id="rp-reload" style="margin-top:8px">もう一度読み込む</button></div>`;const b=document.getElementById('rp-reload');if(b)b.onclick=()=>{el.innerHTML='<p class="empty">記録を読み込み中…</p>';rpLoad()};return}
  if(!document.body.contains(el))return;
  if(!Array.isArray(bs)||!bs.length){el.innerHTML='<p class="empty" style="padding:28px 24px">まだ記録がありません。<br>対戦の動画を選ぶか手で記録すると、ここに勝率や苦手な相手が出ます。</p>';return}
  const S=rpStats(bs),pctT=(w,n)=>{const p=rpPct(w,n);return p===null?'—':p+'%'};
  const few=n=>n<RP_FEW?`<span style="font-size:11px;color:var(--mute)">（${n}戦だけなので目安）</span>`:'';
  const rec=o=>!o.k?`${o.c}戦（勝ち負けは不明）`:o.k<o.c?`${o.c}戦（勝ち負けがわかる${o.k}戦：${o.w}勝 ${o.k-o.w}敗）`:`${o.c}戦 ${o.w}勝 ${o.k-o.w}敗`;
  const mrow=o=>`<a class="row" href="#/p/${o.n}"><span class="av">${stamp(byNo[o.n])}</span><div class="row-m"><div class="row-t">${nm(byNo[o.n])}</div><div class="row-s">${rec(o)}</div></div><div class="row-n"><b>${pctT(o.w,o.k)}</b><span>勝率</span></div></a>`;
  el.innerHTML=`<div class="sec"><h2>これまでの記録</h2></div>
    <div class="prof"><div><b>${S.total}</b><span>対戦</span></div><div><b>${S.win}-${S.lose}</b><span>勝ち-負け</span></div><div><b>${pctT(S.win,S.known)}</b><span>勝率</span></div></div>
    ${S.unknown?`<p class="vcap" style="margin:4px 16px 0">勝ち負けがわからない対戦が${S.unknown}件あります（勝率には入れていません）。</p>`:''}
    ${S.known&&S.known<RP_FEW?`<p class="vcap" style="margin:4px 16px 0">勝ち負けがわかる対戦がまだ${S.known}件なので、勝率は目安です。</p>`:''}
    ${S.hard.length?`<div class="sec"><h2>苦手な相手</h2><span style="font-size:12px;color:var(--dim)">勝ち負けがわかる対戦で3回以上当たり、勝率45%未満</span></div>${S.hard.map(mrow).join('')}
      <div class="btns"><button class="btn btn-s" id="rp-hard">苦手な相手を選出アシストに入れる</button></div>`:''}
    <div class="sec"><h2>よく当たる相手</h2><span style="font-size:12px;color:var(--dim)">相手の6匹にいた回数</span></div>${S.seen.slice(0,8).map(mrow).join('')}
    ${S.picked.length?`<div class="sec"><h2>相手によく出されたポケモン</h2></div>${S.picked.map(mrow).join('')}`:''}
    ${S.mine.length?`<div class="sec"><h2>自分の選出ごとの勝率</h2></div>${S.mine.map(o=>`<div class="row"><div class="row-m"><div class="row-t" style="font-size:14px">${o.k.split('-').map(n=>byNo[n]?esc(byNo[n].n):'').join('・')}</div><div class="row-s">${!o.kn?`${o.c}戦（勝ち負けは不明）`:o.kn<o.c?`${o.c}戦（勝ち負けがわかる${o.kn}戦：${o.w}勝）`:`${o.c}戦 ${o.w}勝`} ${few(o.kn)}</div></div><div class="row-n"><b>${pctT(o.w,o.kn)}</b><span>勝率</span></div></div>`).join('')}`:''}
    <div class="sec"><h2>最近の対戦</h2></div>${bs.slice(0,20).map(b=>`<div class="row"><div class="row-m"><div class="row-t" style="font-size:14px">${b.result==='win'?'<b style="color:#00a36c">勝ち</b>':b.result==='lose'?'<b style="color:var(--w2)">負け</b>':'<span style="color:var(--dim)">勝敗不明</span>'}　${b.fmt==='double'?'ダブル':'シングル'}　${new Date(b.at).toLocaleDateString('ja-JP')}</div><div class="row-s">相手：${(b.opp||[]).map(n=>byNo[n]?esc(byNo[n].n):'').filter(Boolean).join('・')||'—'}</div></div><button class="bback" data-rpdel="${+b.id}" style="color:var(--w2)">消す</button></div>`).join('')}
    <p class="note" style="color:var(--mute)">勝率は「勝ち・負け」が分かっている対戦だけで計算しています（新しい300件まで）。記録はあなただけが見られます。</p>`;
  const h=document.getElementById('rp-hard');if(h)h.onclick=()=>{opp6=S.hard.map(o=>o.n).slice(0,6);saveOpp6();nav('#/assist')};
  el.querySelectorAll('[data-rpdel]').forEach(b=>b.onclick=async()=>{if(b.disabled)return;if(!await askConfirm({title:'記録を削除しますか？',text:'この対戦の記録を消します。この操作は取り消せません。',ok:'削除'}))return;b.disabled=true;
    try{await authFetch(`/api/battles/${b.dataset.rpdel}/delete`,{});toast('記録を削除しました');rpLoad()}catch(e){b.disabled=false;toast(e.status===404?e.message:'削除できませんでした。'+rpErrText(e));if(e.status===404)rpLoad()}});
}
