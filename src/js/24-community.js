/* ===================== コミュニティ（対戦募集・掲示板） ===================== */
/* 書き込みはサーバー（Cloudflare Worker＋D1）に保存。匿名。通報3件で自動非表示、NGワード・リンク・連投は不可。 */
const COMM_API=(()=>{try{return localStorage.getItem('pccomm')||''}catch(e){return''}})()||'https://pokechan-tap.22311328rn.workers.dev';
const BOARDS_JA=[['zatsu','雑談'],['kouchiku','構築相談'],['shitsumon','質問'],['taikai','大会・イベント']];
const lsJ=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||'null')??d}catch(e){return d}};
const lsW=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const blocked=()=>new Set(lsJ('pcblock',[]));
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const ago=ms=>{const s=Math.max(0,(Date.now()-ms)/1000);return s<60?'たった今':s<3600?`${Math.floor(s/60)}分前`:s<86400?`${Math.floor(s/3600)}時間前`:`${Math.floor(s/86400)}日前`};
async function capi(path,body){
  const r=await fetch(COMM_API+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
  let j={};try{j=await r.json()}catch(e){}
  if(!r.ok)throw new Error(j.error||('通信エラー（'+r.status+'）'));
  return j;
}
const commNote=`<p class="note" style="color:var(--mute)">書き込む前に<a href="#/rules" style="color:var(--acc)">利用ルール</a>を読んでください。個人情報・誹謗中傷・リンク・売買の書き込みはできません。</p>`;
function commMenu(kind,id,aid){
  return `<span class="cmenu"><button data-rep="${kind}:${id}" aria-label="通報">通報</button>${aid?`<button data-blk="${aid}" aria-label="このIDを非表示">非表示</button>`:''}</span>`;
}
function commBind(root,reload){
  root.querySelectorAll('[data-rep]').forEach(b=>b.onclick=async()=>{
    const [kind,id]=b.dataset.rep.split(':');
    const reason=await pickSheet('通報の理由を選んでください',REPORT_REASONS,'3人から通報されると自動的に非表示になり、運営者が確認します。');if(!reason)return;
    try{await capi('/api/report',{kind,id:+id,reason});toast('通報しました。ご協力ありがとうございます')}catch(e){toast(e.message)}});
  root.querySelectorAll('[data-blk]').forEach(b=>b.onclick=()=>{
    const s=blocked();s.add(b.dataset.blk);lsW('pcblock',[...s].slice(-200));toast('このIDの書き込みを、あなたの画面では表示しません');reload()});
}

/* ---- 対戦募集 ---- */
let lobbyTimer=null;
function lobbyView(){
  setHeader('対戦募集','#/community');
  const mine=new Set(lsJ('pclobbymine',[]));
  V.innerHTML=`<div id="lb-root">
  <p class="note" style="padding-top:14px">プライベート対戦の相手を募集・参加できます。ゲームでルームを作り、その<b>あいことば</b>を書いて募集します。参加する人は、あいことばをコピーしてゲームで入力します。</p>
  <details class="edd" id="lb-new"><summary>募集を出す</summary>
    <div class="pills" style="padding:8px 0"><button class="pill" data-fmt="single" aria-pressed="true">シングル</button><button class="pill" data-fmt="double" aria-pressed="false">ダブル</button></div>
    <div class="cform">
      <label>ルール<input id="lb-rule" maxlength="20" value="ランクバトルと同じ"></label>
      <label>ルームのあいことば（数字・英字）<input id="lb-pass" maxlength="16" inputmode="numeric" placeholder="例：1234"></label>
      <label>ひとこと（任意）<input id="lb-cm" maxlength="200" placeholder="例：初心者歓迎です"></label>
      <label>名前（任意）<input id="lb-nm" maxlength="16" placeholder="名無しのトレーナー"></label>
      <label>募集する時間<select class="sel" id="lb-min"><option value="15">15分</option><option value="30" selected>30分</option><option value="60">60分</option></select></label>
    </div>
    <div class="btns" style="padding:8px 0"><button class="btn btn-p" id="lb-post">募集する</button></div>${commNote}
  </details>
  <div class="sec"><h2>募集中</h2><button class="bback" id="lb-ref" style="padding:0">更新</button></div>
  <div id="lb-list"><p class="empty">読み込み中…</p></div></div>`;
  let fmt='single';
  V.querySelectorAll('[data-fmt]').forEach(b=>b.onclick=()=>{fmt=b.dataset.fmt;V.querySelectorAll('[data-fmt]').forEach(x=>x.setAttribute('aria-pressed',x===b))});
  const load=async()=>{
    const el=document.getElementById('lb-list');if(!el)return;
    try{
      const j=await capi('/api/lobby'),bl=blocked();const L=j.lobby.filter(x=>!bl.has(x.aid));
      el.innerHTML=L.length?L.map(x=>`<div class="lcard">
        <div class="lcard-h"><span class="atag on">${x.fmt==='single'?'シングル':'ダブル'}</span><b>${esc(x.rule)}</b><span class="lt">あと${Math.max(1,Math.ceil((x.expires_at-Date.now())/60000))}分</span></div>
        <div class="lpass"><span>あいことば</span><b>${esc(x.pass)}</b><button class="btn btn-s" data-copy="${esc(x.pass)}">コピー</button></div>
        ${x.comment?`<div class="lcm">${esc(x.comment)}</div>`:''}
        <div class="lmeta">${esc(x.name)}　ID:${esc(x.aid)}　${ago(x.created_at)}${mine.has(x.id)?`　<button class="bback" data-close="${x.id}" style="padding:0">しめきる</button>`:''}${commMenu('lobby',x.id,x.aid)}</div>
      </div>`).join(''):'<p class="empty" style="padding:28px 24px">いま募集はありません。<br>上の「募集を出す」から募集できます。</p>';
      el.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>{(navigator.clipboard?navigator.clipboard.writeText(b.dataset.copy):Promise.reject()).then(()=>toast('あいことばをコピーしました')).catch(()=>prompt('あいことば',b.dataset.copy))});
      el.querySelectorAll('[data-close]').forEach(b=>b.onclick=async()=>{try{await capi(`/api/lobby/${b.dataset.close}/close`,{});toast('しめきりました');load()}catch(e){toast(e.message)}});
      commBind(el,load);
    }catch(e){el.innerHTML=`<div class="bnote" style="margin:12px 16px">${esc(e.message)}</div>`}
  };
  document.getElementById('lb-ref').onclick=load;
  document.getElementById('lb-post').onclick=async e=>{
    const b=e.currentTarget;b.disabled=true;
    try{const j=await capi('/api/lobby',{fmt,rule:document.getElementById('lb-rule').value,pass:document.getElementById('lb-pass').value,comment:document.getElementById('lb-cm').value,name:document.getElementById('lb-nm').value,minutes:+document.getElementById('lb-min').value});
      if(j.id){mine.add(j.id);lsW('pclobbymine',[...mine].slice(-30))}
      toast('募集しました');document.getElementById('lb-new').open=false;document.getElementById('lb-pass').value='';load()}
    catch(err){toast(err.message)}finally{b.disabled=false}};
  load();
  clearInterval(lobbyTimer);lobbyTimer=setInterval(()=>{if(keyOf(cur)!=='lobby'){clearInterval(lobbyTimer);return}load()},20000);
}

/* ---- 掲示板 ---- */
let bbsBoard='zatsu';
function bbsView(a){
  if(a&&BOARDS_JA.some(x=>x[0]===a))bbsBoard=a;
  setHeader('掲示板','#/community');
  V.innerHTML=`<div id="bb-root">
  <div class="pills" style="padding:12px 16px 6px;flex-wrap:wrap">${BOARDS_JA.map(([k,n])=>`<button class="pill" data-bd="${k}" aria-pressed="${k===bbsBoard}">${n}</button>`).join('')}</div>
  <details class="edd" id="bb-new"><summary>スレッドを立てる</summary>
    <div class="cform"><label>タイトル<input id="bb-tt" maxlength="40"></label>
      <label>本文<textarea id="bb-bd" maxlength="1000" rows="5"></textarea></label>
      <label>名前（任意）<input id="bb-nm" maxlength="16" placeholder="名無しのトレーナー"></label></div>
    <div class="btns" style="padding:8px 0"><button class="btn btn-p" id="bb-post">立てる</button></div>${commNote}
  </details>
  <div id="bb-list"><p class="empty">読み込み中…</p></div></div>`;
  V.querySelectorAll('[data-bd]').forEach(b=>b.onclick=()=>{bbsBoard=b.dataset.bd;bbsView()});
  const load=async()=>{
    const el=document.getElementById('bb-list');
    try{const j=await capi('/api/threads?board='+bbsBoard);
      el.innerHTML=j.threads.length?j.threads.map(t=>`<a class="row" href="#/thread/${t.id}"><div class="row-m"><div class="row-t">${esc(t.title)}</div><div class="row-s">${t.count}件　最終 ${ago(t.last_at)}</div></div><span class="chev">${SVG(I.chev,18)}</span></a>`).join(''):'<p class="empty" style="padding:28px 24px">まだスレッドがありません。</p>'}
    catch(e){el.innerHTML=`<div class="bnote" style="margin:12px 16px">${esc(e.message)}</div>`}
  };
  document.getElementById('bb-post').onclick=async e=>{
    const b=e.currentTarget;b.disabled=true;
    try{const j=await capi('/api/threads',{board:bbsBoard,title:document.getElementById('bb-tt').value,body:document.getElementById('bb-bd').value,name:document.getElementById('bb-nm').value});
      toast('スレッドを立てました');nav('#/thread/'+j.id)}catch(err){toast(err.message)}finally{b.disabled=false}};
  load();
}
function threadView(id){
  setHeader('スレッド','#/bbs');
  V.innerHTML=`<div id="th-root"><p class="empty">読み込み中…</p></div>`;
  const load=async(toEnd)=>{
    const root=document.getElementById('th-root');if(!root)return;
    try{
      const j=await capi('/api/threads/'+(+id)),bl=blocked();
      setHeader(esc(j.thread.title).slice(0,24),'#/bbs/'+j.thread.board);
      root.innerHTML=`<div class="sec" style="padding-top:14px"><h2 style="font-size:17px">${esc(j.thread.title)}</h2><span style="font-size:12px;color:var(--dim)">${j.thread.count}件</span></div>
      ${j.posts.map(p=>p.hidden?`<div class="bpost"><div class="bpost-h">${p.no}</div><div class="bpost-b" style="color:var(--mute)">（このレスは削除されました）</div></div>`
        :bl.has(p.aid)?`<div class="bpost"><div class="bpost-h">${p.no}</div><div class="bpost-b" style="color:var(--mute)">（非表示にしたIDの書き込み）</div></div>`
        :`<div class="bpost" id="r${p.no}"><div class="bpost-h"><b>${p.no}</b> ${esc(p.name)}　${new Date(p.created_at).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}　ID:${esc(p.aid)}${commMenu('post',p.id,p.aid)}</div><div class="bpost-b">${esc(p.body).replace(/&gt;&gt;(\d+)/g,'<a href="javascript:void 0" data-anc="$1">&gt;&gt;$1</a>').replace(/\n/g,'<br>')}</div></div>`).join('')}
      <div class="sec"><h2>書き込む</h2></div>
      <div class="cform" style="padding:0 16px"><label>本文<textarea id="th-bd" maxlength="1000" rows="4" placeholder="返信は >>番号 で指定できます"></textarea></label><label>名前（任意）<input id="th-nm" maxlength="16" placeholder="名無しのトレーナー"></label></div>
      <div class="btns"><button class="btn btn-p" id="th-post">書き込む</button><button class="btn btn-s" id="th-ref" style="flex:none;padding:0 18px">更新</button></div>${commNote}`;
      root.querySelectorAll('[data-anc]').forEach(a=>a.onclick=()=>{const t=document.getElementById('r'+a.dataset.anc);t&&t.scrollIntoView({behavior:'smooth',block:'center'})});
      document.getElementById('th-ref').onclick=()=>load();
      document.getElementById('th-post').onclick=async e=>{const b=e.currentTarget;b.disabled=true;
        try{await capi(`/api/threads/${+id}/posts`,{body:document.getElementById('th-bd').value,name:document.getElementById('th-nm').value});toast('書き込みました');load(true)}catch(err){toast(err.message);b.disabled=false}};
      commBind(root,()=>load());
      if(toEnd)scrollTo(0,document.body.scrollHeight);
    }catch(e){root.innerHTML=`<div class="bnote" style="margin:16px">${esc(e.message)}</div>`}
  };
  load();
}

/* ---- 利用ルール ---- */
function rulesView(){
  setHeader('コミュニティの利用ルール','#/community');
  V.innerHTML=`<div class="rules">
  <p>対戦募集と掲示板は、だれでも匿名で書き込めます。みんなが気持ちよく使えるよう、次のルールを守ってください。</p>
  <h3>禁止していること</h3><ul>
  <li>誹謗中傷、差別、脅し、いやがらせ</li><li>自分や他人の個人情報（本名・住所・学校・電話番号・SNSのアカウントなど）を書くこと</li>
  <li>アカウントやポケモン・ゲーム内のものの売買、代行、リアルマネートレード</li><li>不正行為（改造・チート・不正ツールなど）の紹介や勧誘</li>
  <li>わいせつな内容、出会いを目的とする書き込み</li><li>宣伝やリンクの書き込み、同じ内容のくり返し（荒らし）</li><li>法律やゲームの利用規約に反すること</li></ul>
  <h3>しくみ</h3><ul>
  <li>NGワードやリンクを含む書き込み、20秒以内の連続書き込みはできません。</li>
  <li>不適切な書き込みは「通報」してください。3人から通報されると自動的に非表示になり、運営者が確認します。</li>
  <li>「非表示」を押すと、そのIDの書き込みをあなたの画面にだけ表示しなくなります。</li>
  <li>IDは、書き込んだ人のIPアドレスと日付から作られ、日が変わると変わります。</li>
  <li>対戦募集は、設定した時間が過ぎると自動で消えます。</li></ul>
  <h3>保存する情報</h3><ul>
  <li>書き込みの内容と時刻、表示用のID。</li>
  <li>荒らしや法律にもとづく請求への対応のため、書き込んだ端末のIPアドレスを90日間保存し、その後消去します。それ以外の目的には使いません。</li></ul>
  <h3>運営者への連絡</h3><ul><li>削除の依頼やお問い合わせは、Xのアカウント（準備中）で受け付けます。</li></ul>
  <p style="color:var(--mute)">非公式のファンサイトです。株式会社ポケモン・任天堂・ゲームフリーク・クリーチャーズとは関係ありません。このルールは予告なく変わることがあります。</p>
  <p style="margin-top:24px"><a href="#/admin" style="color:var(--mute);font-size:12px">運営者用の管理画面</a></p>
  </div>`;
}


/* ---- 選択肢シート（通報の理由など） ---- */
const REPORT_REASONS=['誹謗中傷・嫌がらせ','個人情報','売買・代行・RMT','わいせつ・出会い目的','宣伝・荒らし・スパム','不正行為の紹介','その他'];
function pickSheet(title,opts,sub){
  return new Promise(res=>{
    const o=document.createElement('div');o.className='psheet';
    o.innerHTML=`<div class="psheet-bg"></div><div class="psheet-p" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h3>${esc(title)}</h3>${sub?`<p>${esc(sub)}</p>`:''}${opts.map((t,i)=>`<button class="psheet-o" data-i="${i}">${esc(t)}</button>`).join('')}<button class="psheet-x">やめる</button></div>`;
    document.body.appendChild(o);requestAnimationFrame(()=>o.classList.add('on'));
    const done=v=>{o.classList.remove('on');setTimeout(()=>o.remove(),180);res(v)};
    o.querySelector('.psheet-bg').onclick=()=>done(null);o.querySelector('.psheet-x').onclick=()=>done(null);
    o.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>done(opts[+b.dataset.i]));
  });
}

