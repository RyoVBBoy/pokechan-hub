/* ===================== 運営者用の管理画面 ===================== */
let admTab='reports';
/* 名前で打ったポケモンを番号に（ぴったりの名前を優先。地方の姿は「ガラル」などを付けて区別） */
function admNames(t){
  const out={nos:[],bad:[]};
  String(t||'').split(/[、,，\s]+/).map(x=>x.trim()).filter(Boolean).slice(0,6).forEach(w=>{const k=kata(w);
    const p=P.find(p=>p.n===k||p.n===w)||P.find(p=>formInfo(p).base===k&&!formInfo(p).tag)||P.find(p=>formInfo(p).base===k)||(P.filter(p=>nmHit(p,w)).length===1?P.find(p=>nmHit(p,w)):null);
    p&&!out.nos.includes(p.no)?out.nos.push(p.no):out.bad.push(w)});
  return out;
}
function adminView(){
  setHeader('管理（運営者用）','#/rules');
  /* 管理用の合言葉は、画面（タブ）を閉じると消える場所に置く（2026/11/05 セキュリティ対策：端末にずっと残さない）。前の保存場所からは移して消す */
  const tok=(()=>{try{const old=localStorage.getItem('pcadmin');if(old){sessionStorage.setItem('pcadmin',old);localStorage.removeItem('pcadmin')}return sessionStorage.getItem('pcadmin')||''}catch(e){return''}})();
  const kindJa={post:'書き込み',note:'タイムライン',thread:'スレッド',lobby:'対戦募集'};
  const aget=async path=>{const r=await fetch(COMM_API+path,{headers:{'X-Admin-Token':tok}});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'通信エラー');return j};
  const apost=async(path,body)=>{const r=await fetch(COMM_API+path,{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Token':tok},body:JSON.stringify(body)});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'通信エラー');return j};
  V.innerHTML=`<div id="adm-root">
  <p class="note" style="padding-top:14px">通報された書き込みの確認と削除ができます。サーバーに設定した<b>管理用の合言葉（ADMIN_TOKEN）</b>を入れてください。アプリや背面タップ用の合言葉（APP_TOKEN）では入れません。合言葉はこの端末にだけ保存されます。</p>
  <div class="cform" style="padding:0 16px"><label>管理用の合言葉<input type="password" id="adm-tok" value="${esc(tok)}" autocomplete="off"></label></div>
  <div class="btns"><button class="btn btn-p" id="adm-save">保存して読み込む</button></div>
  <div class="pills" style="padding:0 16px 8px;flex-wrap:wrap"><button class="pill" data-at="quota" aria-pressed="${admTab==='quota'}">使用量</button><button class="pill" data-at="contact" aria-pressed="${admTab==='contact'}">お問い合わせ</button><button class="pill" data-at="hits" aria-pressed="${admTab==='hits'}">アクセス</button><button class="pill" data-at="reports" aria-pressed="${admTab==='reports'}">通報</button><button class="pill" data-at="recent" aria-pressed="${admTab==='recent'}">最近の書き込み</button><button class="pill" data-at="banned" aria-pressed="${admTab==='banned'}">停止中のアカウント</button><button class="pill" data-at="season" aria-pressed="${admTab==='season'}">シーズン</button><button class="pill" data-at="news" aria-pressed="${admTab==='news'}">公式のお知らせ</button></div>
  <div id="adm-list">${tok?'<p class="empty">読み込み中…</p>':'<p class="empty">合言葉を入れてください。</p>'}</div></div>`;
  document.getElementById('adm-save').onclick=()=>{try{sessionStorage.setItem('pcadmin',document.getElementById('adm-tok').value.trim())}catch(e){}adminView()};
  V.querySelectorAll('[data-at]').forEach(b=>b.onclick=()=>{admTab=b.dataset.at;adminView()});
  if(!tok)return;
  const el=document.getElementById('adm-list');
  const act=async(fn,msg)=>{try{await fn();toast(msg);load()}catch(e){toast(e.message)}};
  /* 画像は合言葉を付けて読み込む（確認待ちの画像も見られる） */
  const admMedia=m=>{let a=[];try{a=m?JSON.parse(m):[]}catch(e){}return a.length?`<div class="adm-media" data-keys="${a.map(x=>esc(x.k)).join(',')}"></div>`:''};
  const loadMedia=()=>el.querySelectorAll('.adm-media[data-keys]').forEach(box=>{const ks=box.dataset.keys.split(',');box.removeAttribute('data-keys');
    ks.forEach(async k=>{try{const r=await fetch(COMM_API+'/m/'+k,{headers:{'X-Admin-Token':tok}});if(!r.ok)return;const im=document.createElement('img');im.src=URL.createObjectURL(await r.blob());im.alt='';box.appendChild(im)}catch(e){}})});
  const load=async()=>{
    try{
      if(admTab==='reports'){
        const j=await aget('/api/admin/reports');
        el.innerHTML=j.reports.length?j.reports.map(r=>`<div class="lcard">
          <div class="lcard-h"><span class="atag ${r.n>=3?'on':''}">${kindJa[r.kind]||r.kind}</span><b>通報 ${r.n}件</b><span class="lt">${ago(r.last)}</span></div>
          <div class="lcm" style="white-space:pre-wrap">${r.content==null?'（見つかりません）':esc(r.content)}</div>${admMedia(r.media)}
          ${r.media_hidden?'<div class="lmeta"><b style="color:var(--w2)">画像は確認待ち（「問題なし」か「元に戻す」で表示に戻ります）</b></div>':''}
          <div class="lmeta">理由：${esc(r.reasons||'')}　ID:${esc(r.aid||'')}　${r.hidden?'<b style="color:var(--w2)">非表示中</b>':'表示中'}</div>
          <div class="btns" style="padding:8px 0 0;flex-wrap:wrap">
            ${r.hidden?`<button class="btn btn-s" data-res="${r.kind}:${r.target}">元に戻す</button>`:`<button class="btn btn-p" data-del="${r.kind}:${r.target}">非表示にする</button>`}
            <button class="btn btn-s" data-dis="${r.kind}:${r.target}">問題なし（通報を消す）</button>
            ${r.kind==='note'&&r.aid?`<button class="btn btn-s" data-ban="${esc(String(r.aid).replace(/^@/,''))}" style="color:var(--w2)">${esc(r.aid)} を停止</button>`:''}
            ${r.kind==='note'?'':r.thread_id?`<a class="btn btn-s" href="#/thread/${r.thread_id}">スレッドを開く</a>`:''}</div></div>`).join(''):'<p class="empty" style="padding:28px 24px">通報はありません。</p>';
      }else if(admTab==='news'){
        const j=await aget('/api/admin/news');
        el.innerHTML=`<p class="note" style="padding-top:0">公式サイトの新しいお知らせを、「お知らせbot（非公式）」が題名とリンクだけでタイムラインに自動投稿します（6時間ごと）。本文は写しません。公式サイト（pokemonchampions.jp・pokemon.co.jp・pokemon.com・nintendo.co.jp・nintendo.com）のアドレスだけを載せます。</p>
          <div class="sec"><h2>お知らせの一覧ページ</h2></div>
          <p class="note" style="padding-top:0">ポケモンチャンピオンズの公式のお知らせが並んでいるページのアドレスを入れると、そこから探します（いちばん確実です）。入れていないときは、Google 検索で探します。</p>
          ${j.src.map(u=>`<div class="bpost"><div style="word-break:break-all">${esc(u)}</div><button class="bback" data-nsdel="${esc(u)}" style="padding:0;color:var(--w2)">外す</button></div>`).join('')}
          <div class="cform" style="padding:0 16px"><label>一覧ページのアドレス<input id="adm-nsrc" placeholder="https://…" autocomplete="off"></label></div>
          <div class="btns"><button class="btn btn-s" id="adm-nsadd">追加する</button><button class="btn btn-p" id="adm-nrun">今すぐ確認して投稿</button></div>
          <div id="adm-nmsg"></div>
          <div class="sec"><h2>手で投稿する</h2></div>
          <div class="cform" style="padding:0 16px"><label>種類<select class="sel" id="adm-nc">${['お知らせ','連携ソフト','メンテナンス','アップデート','不具合','アンケート'].map(c=>`<option>${c}</option>`).join('')}</select></label><label>題名<input id="adm-nt" maxlength="100"></label><label>公式サイトのアドレス<input id="adm-nu" placeholder="https://…"></label></div>
          <div class="btns"><button class="btn btn-s" id="adm-npost">お知らせbotとして投稿</button></div>
          <div class="sec"><h2>見つけたお知らせ</h2></div>
          ${j.seen.length?j.seen.map(x=>`<div class="bpost"><div class="bpost-h">${ago(x.created_at)}${x.note_id?'　投稿済み':'　記録だけ（初回）'}${x.cat?'　'+esc(x.cat):''}${x.date?'　'+esc(x.date):''}</div><div>${esc(x.title||'')}</div><div class="vcap" style="word-break:break-all">${esc(x.url)}</div></div>`).join(''):'<p class="empty">まだありません。</p>'}`;
        el.querySelectorAll('[data-nsdel]').forEach(b=>b.onclick=()=>act(()=>apost('/api/admin/news/src',{url:b.dataset.nsdel,del:true}),'外しました'));
        document.getElementById('adm-nsadd').onclick=()=>act(()=>apost('/api/admin/news/src',{url:document.getElementById('adm-nsrc').value.trim()}),'追加しました');
        document.getElementById('adm-npost').onclick=()=>act(()=>apost('/api/admin/news/post',{cat:document.getElementById('adm-nc').value,title:document.getElementById('adm-nt').value,url:document.getElementById('adm-nu').value.trim()}),'投稿しました');
        document.getElementById('adm-nrun').onclick=async()=>{const m=document.getElementById('adm-nmsg');m.innerHTML='<p class="note">確認しています…（30秒ほど）</p>';
          try{const r=await apost('/api/admin/news/run',{});m.innerHTML=`<p class="note">${r.found}件見つけ、${r.posted}件投稿しました。${r.found>r.posted?'それより古いものは記録だけしました（「公式のお知らせ」の画面には出ます）。':''}</p>${r.found?'':`<p class="vcap" style="padding:0 16px;word-break:break-all">調べた結果（開発者向け）：${esc(JSON.stringify(r.dbg||{}))}</p>`}`;setTimeout(load,1500)}catch(e){m.innerHTML=`<p class="note">${esc(e.message)}</p>`}};
      }else if(admTab==='contact'){
        const st=sessionStorage.getItem('pcadmct')||'new',j=await aget('/api/admin/contacts?st='+st);
        const KN={data:'データの間違い',bug:'不具合',idea:'要望',other:'そのほか'};
        el.innerHTML=`<div class="pills" style="padding:0 16px 8px">${[['new',`未対応（${j.unread}）`],['done','対応済み'],['all','すべて']].map(([k,l])=>`<button class="pill" data-cst="${k}" aria-pressed="${k===st}">${l}</button>`).join('')}</div>`+
          (j.contacts.length?j.contacts.map(c=>`<div class="lcard"><div class="lcard-h"><span class="atag ${c.kind==='data'||c.kind==='bug'?'on':''}">${KN[c.kind]||c.kind}</span><b>${c.page?esc(pageLabel(c.page)):'お問い合わせ'}</b><span class="lt">${ago(c.created_at)}</span></div>
            <div class="lcm" style="white-space:pre-wrap" data-notr>${esc(c.body)}</div>
            <div class="lmeta">${c.page?`<a href="${esc(c.page)}" style="color:var(--acc)">画面を開く</a>　`:''}${c.reply?`連絡先：<span data-notr>${esc(c.reply)}</span>　`:''}${c.login?'ログイン中　':''}${c.note?'メモ：'+esc(c.note):''}</div>
            <div class="lmeta" style="color:var(--mute);font-size:11px">${esc(c.ua||'')}</div>
            <div class="btns" style="padding:6px 0 0">${c.st==='new'?`<button class="btn btn-s" data-cdone="${c.id}">対応済みにする</button>`:`<button class="btn btn-s" data-cnew="${c.id}">未対応に戻す</button>`}</div></div>`).join(''):'<p class="empty">ありません。</p>');
        el.querySelectorAll('[data-cst]').forEach(b=>b.onclick=()=>{sessionStorage.setItem('pcadmct',b.dataset.cst);load()});
        el.querySelectorAll('[data-cdone]').forEach(b=>b.onclick=async()=>{const note=await askText('対応のメモ（任意）','メモ');if(note===null)return;act(()=>apost('/api/admin/contacts',{id:+b.dataset.cdone,st:'done',note:note||''}),'対応済みにしました')});
        el.querySelectorAll('[data-cnew]').forEach(b=>b.onclick=()=>act(()=>apost('/api/admin/contacts',{id:+b.dataset.cnew,st:'new'}),'未対応に戻しました'));
      }else if(admTab==='quota'){
        const j=await aget('/api/admin/quota');el.innerHTML=quotaHTML(j);
      }else if(admTab==='hits'){
        const j=await aget('/api/admin/hits?days=30');el.innerHTML=hitsHTML(j.rows);
      }else if(admTab==='season'){
        /* シーズンの登録・上位パーティの登録と確認（ladder.js） */
        const [sj,tj]=await Promise.all([fetch(COMM_API+'/api/seasons').then(r=>r.json()),aget('/api/admin/season-teams')]);
        const ss=sj.seasons||[],slots=TEAMS.list.map((x,i)=>({i,t:i===TEAMS.cur?team:x.team})).filter(x=>x.t.length);
        const day=v=>`<input type="date" value="${esc(v||'')}">`;
        el.innerHTML=`<div class="sec"><h2>シーズン</h2></div>
          ${ss.map(x=>`<div class="bpost" data-sid="${x.id}"><div class="cform" style="padding:0"><label>名前<input class="as-n" value="${esc(x.name)}"></label><label>始まり${day(x.start).replace('<input','<input class="as-s"')}</label><label>終わり${day(x.end).replace('<input','<input class="as-e"')}</label>
              <label>運営者の解説（シーズンのまとめの上に出ます・2000文字まで）<textarea class="as-t" rows="4" maxlength="2000" placeholder="例：このシーズンは〜が流行し、終盤は〜で対策するパーティが増えました">${esc(x.note||'')}</textarea></label></div>
            <div style="display:flex;gap:16px;padding-top:6px"><button class="bback" data-ssave style="padding:0">保存する</button><button class="bback" data-sdel style="padding:0;color:var(--w2)">消す</button><span class="lmeta">登録 ${x.n}件</span></div></div>`).join('')}
          <div class="bpost"><b>新しいシーズン</b><div class="cform" style="padding:0"><label>名前<input id="as-nn" placeholder="例：シーズン1"></label><label>始まり<input type="date" id="as-ns"></label><label>終わり<input type="date" id="as-ne"></label></div>
            <div class="btns" style="padding:8px 0 0"><button class="btn btn-p" id="as-add">シーズンを登録する</button></div></div>
          <div class="sec"><h2>記事から自動で集める</h2></div>
          ${ss.length?`<div class="bpost"><p class="note" style="padding:0 0 8px">Gemini がページを読み、上位のパーティの<b>事実（順位・6匹・持ち物など）だけ</b>を取り出します。<b>2つ以上のページで一致したものだけ</b>自動で載せ、1つのページにしかないものは下の「確認待ち」に出ます。文章は書かせません。毎日1回、期間中と終わって14日以内のシーズンを自動で集め直します。</p>
            <div class="cform" style="padding:0"><label>シーズン<select class="sel" id="col-s">${ss.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label>
            <label>形式<select class="sel" id="col-f"><option value="single">シングル</option><option value="double">ダブル</option></select></label></div>
            <div id="col-box"><p class="empty">読み込み中…</p></div></div>`:'<p class="note">先にシーズンを登録してください。</p>'}
          <div class="sec"><h2>運営者としてパーティを登録</h2></div>
          ${ss.length?`<div class="bpost"><div class="cform" style="padding:0">
            <label>シーズン<select class="sel" id="at-s">${ss.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label>
            <label>形式<select class="sel" id="at-f"><option value="single">シングル</option><option value="double">ダブル</option></select></label>
            <label>プレイヤーの名前<input id="at-p" maxlength="30"></label><label>最終順位<input type="number" id="at-r"></label><label>レート<input type="number" id="at-rt"></label>
            <label>ポケモンの名前（6匹を「、」や空白で区切って。育成なしで登録します）<input id="at-names" placeholder="例：ガブリアス、カイリュー、サーフゴー…"></label>
            ${slots.length?`<label>または、あなたが保存したパーティ（育成ごと登録）<select class="sel" id="at-t"><option value="">（名前で入力する）</option>${slots.map(x=>`<option value="${x.i}">${esc(teamName(x.i))}：${x.t.map(y=>byNo[y.no]?esc(byNo[y.no].n):'').join('・')}</option>`).join('')}</select></label>`:''}
            <label>ひとこと<input id="at-c" maxlength="140"></label></div><div class="btns" style="padding:8px 0 0"><button class="btn btn-p" id="at-add">登録する</button></div>
            <p class="note" style="padding:6px 0 0">過去のシーズンは、ポケモンの名前だけで登録できます（シーズンのまとめの集計に使われます）。育成まで載せたいときは、先にパーティの画面で作って保存し、下で選んでください。運営者の登録は「確認済み」になります。</p></div>`
            :'<p class="note">先にシーズンを登録してください。</p>'}
          <div class="sec"><h2>登録されたパーティ</h2><span style="font-size:12px;color:var(--dim)">確認待ちが上</span></div>
          ${(tj.teams||[]).length?tj.teams.map(t=>`<div class="bpost"><div class="bpost-h"><b>${esc(t.season)}</b>　${t.fmt==='double'?'ダブル':'シングル'}　${t.rank?t.rank+'位':''}　${t.rate?'レート'+t.rate:''}　${esc(t.player.name)}${t.player.handle?'（@'+esc(t.player.handle)+'）':''}
            ${t.verified?'　<b>確認済み</b>':t.proof_key?'　<b style="color:var(--w2)">確認待ち</b>':''}${t.hidden?'　<b style="color:var(--w2)">非表示中</b>':''}</div>
            <div class="bpost-b">${t.team.map(x=>byNo[x.no]?esc(byNo[x.no].n):'').join('・')}${t.comment?'<br>'+esc(t.comment):''}</div>
            ${t.proof_key?`<div class="adm-media" data-keys="${esc(t.proof_key)}"></div>`:''}
            <div style="display:flex;gap:16px;padding-top:6px;flex-wrap:wrap"><button class="bback" data-tv="${t.id}:${t.verified?0:1}" style="padding:0">${t.verified?'確認済みを外す':'確認済みにする'}</button>
              <button class="bback" data-th="${t.id}:${t.hidden?0:1}" style="padding:0;color:var(--w2)">${t.hidden?'表示に戻す':'非表示にする'}</button>
              <button class="bback" data-tx="${t.id}" style="padding:0;color:var(--w2)">消す</button></div></div>`).join(''):'<p class="empty">まだ登録はありません。</p>'}`;
        const sp=b=>{const r=b.closest('[data-sid]');return{id:+r.dataset.sid,name:r.querySelector('.as-n').value,start:r.querySelector('.as-s').value,end:r.querySelector('.as-e').value,note:r.querySelector('.as-t').value}};
        el.querySelectorAll('[data-ssave]').forEach(b=>b.onclick=()=>act(()=>apost('/api/admin/seasons',sp(b)),'保存しました'));
        el.querySelectorAll('[data-sdel]').forEach(b=>b.onclick=async()=>{if(await askConfirm({title:'シーズンを削除しますか？',text:'このシーズンを消します。',ok:'削除'}))act(()=>apost('/api/admin/seasons',{id:sp(b).id,delete:true}),'消しました')});
        document.getElementById('as-add').onclick=()=>act(()=>apost('/api/admin/seasons',{name:document.getElementById('as-nn').value,start:document.getElementById('as-ns').value,end:document.getElementById('as-ne').value}),'シーズンを登録しました');
        const ta=document.getElementById('at-add');if(ta)ta.onclick=()=>{
          const ts=document.getElementById('at-t'),sl=ts&&ts.value!==''?slots.find(x=>x.i===+ts.value):null;let tm;
          if(sl)tm=sl.t.map(x=>({no:x.no,set:x.set||undefined}));
          else{const r=admNames(document.getElementById('at-names').value);if(r.bad.length){toast('見つからない名前：'+r.bad.join('、'));return}if(!r.nos.length){toast('ポケモンの名前を入れてください');return}tm=r.nos.map(no=>({no}))}
          act(()=>apost('/api/admin/season-teams',{season_id:+document.getElementById('at-s').value,fmt:document.getElementById('at-f').value,player:document.getElementById('at-p').value,
            rank:document.getElementById('at-r').value,rate:document.getElementById('at-rt').value,comment:document.getElementById('at-c').value,team:tm}),'登録しました')};
        el.querySelectorAll('[data-tv]').forEach(b=>b.onclick=()=>{const[i,v]=b.dataset.tv.split(':');act(()=>apost('/api/admin/season-teams',{id:+i,verified:v==='1'}),v==='1'?'確認済みにしました':'確認済みを外しました')});
        el.querySelectorAll('[data-th]').forEach(b=>b.onclick=()=>{const[i,v]=b.dataset.th.split(':');act(()=>apost('/api/admin/season-teams',{id:+i,hidden:v==='1'}),v==='1'?'非表示にしました':'表示に戻しました')});
        el.querySelectorAll('[data-tx]').forEach(b=>b.onclick=async()=>{if(await askConfirm({title:'登録を削除しますか？',text:'スクリーンショットも消えます。',ok:'削除'}))act(()=>apost('/api/admin/season-teams',{id:+b.dataset.tx,delete:true}),'消しました')});
        if(typeof SEAS!=='undefined')SEAS.list=null;
        /* 記事から自動で集める（collect.js） */
        const colBox=document.getElementById('col-box');
        const colLoad=async()=>{if(!colBox)return;const sid=+document.getElementById('col-s').value,fmt=document.getElementById('col-f').value;
          colBox.innerHTML='<p class="empty">読み込み中…</p>';
          try{const c=await aget(`/api/admin/collect?season_id=${sid}&fmt=${fmt}`);
            const stJa={ok:'読めた',err:'読めなかった',new:'まだ',off:'止めた'};
            colBox.innerHTML=`<div class="sec" style="padding-left:0"><h2>出典のページ</h2><span style="font-size:12px;color:var(--dim)">${c.sources.length}</span></div>
              ${c.sources.map(x=>`<div class="lmeta" style="padding:4px 0"><a href="${esc(safeUrl(x.url))}" target="_blank" rel="noopener" style="color:var(--acc)">${esc(x.title||hostOf(x.url))}</a>　${x.kind==='found'?'（検索で発見）':''}${stJa[x.status]||''}${x.status==='ok'?` ${x.n}件`:''}${x.err?`<br><span style="color:var(--w2)">${esc(x.err)}</span>`:''}
                <button class="bback" data-cdel="${x.id}" style="padding:0 0 0 10px;color:var(--w2)">外す</button></div>`).join('')||'<p class="note" style="padding:0">まだありません。「記事を探す」か、アドレスを貼ってください。</p>'}
              <div class="cform" style="padding:8px 0 0"><label>ページのアドレスを足す<input id="col-u" placeholder="https://…"></label></div>
              <div class="btns" style="padding:8px 0 0;flex-wrap:wrap"><button class="btn btn-s" id="col-add">足す</button><button class="btn btn-s" id="col-find">記事を探す（Google検索）</button><button class="btn btn-p" id="col-run">集めて照らし合わせる</button></div>
              <div id="col-msg"></div>
              <div class="sec" style="padding-left:0"><h2>確認待ち</h2><span style="font-size:12px;color:var(--dim)">出典が1つだけ</span></div>
              ${c.pending.map(g=>`<div class="bpost" style="padding:8px 0"><div class="bpost-h">${g.rank?g.rank+'位':''} ${g.rate?'レート'+g.rate:''} ${esc(g.player||'（名前なし）')}</div>
                <div class="bpost-b">${g.team.map(x=>byNo[x.no]?esc(byNo[x.no].n):'').join('・')}</div><div class="lmeta">${(g.urls||[]).map(u=>`<a href="${esc(safeUrl(u))}" target="_blank" rel="noopener" style="color:var(--acc)">${esc(hostOf(u))}</a>`).join('、')}</div>
                <div style="display:flex;gap:16px;padding-top:6px"><button class="bback" data-cpub="${esc(g.gkey)}" style="padding:0">確かめたので載せる</button><button class="bback" data-cskip="${esc(g.gkey)}" style="padding:0;color:var(--w2)">載せない</button></div></div>`).join('')||'<p class="note" style="padding:0">ありません。</p>'}`;
            const post=async(path,body,msg)=>{try{const r=await apost(path,{season_id:sid,fmt,...body});toast(msg(r));colLoad()}catch(e){toast(e.message)}};
            document.getElementById('col-add').onclick=()=>post('/api/admin/collect/source',{url:document.getElementById('col-u').value.trim()},()=>'足しました');
            document.getElementById('col-find').onclick=e=>{e.target.disabled=true;e.target.textContent='探しています…';post('/api/admin/collect/find',{},r=>`${r.found}件見つかりました`)};
            document.getElementById('col-run').onclick=e=>{e.target.disabled=true;e.target.textContent='集めています（1〜2分）…';post('/api/admin/collect/run',{},r=>`自動で${r.published}件を載せました（確認待ち ${r.pending}件）`)};
            colBox.querySelectorAll('[data-cdel]').forEach(b=>b.onclick=()=>post('/api/admin/collect/source',{delete:true,id:+b.dataset.cdel},()=>'外しました'));
            colBox.querySelectorAll('[data-cpub]').forEach(b=>b.onclick=()=>post('/api/admin/collect/decide',{gkey:b.dataset.cpub,publish:true},()=>'載せました'));
            colBox.querySelectorAll('[data-cskip]').forEach(b=>b.onclick=()=>post('/api/admin/collect/decide',{gkey:b.dataset.cskip,publish:false},()=>'載せないことにしました'));
          }catch(e){colBox.innerHTML=`<div class="bnote">${esc(e.message)}</div>`}};
        if(colBox){document.getElementById('col-s').onchange=colLoad;document.getElementById('col-f').onchange=colLoad;colLoad()}
      }else if(admTab==='banned'){
        const j=await aget('/api/admin/banned');
        el.innerHTML=`<p class="note" style="padding-top:0">停止したアカウントは、投稿・プロフィールが表示されず、書き込みもできなくなります。解除すると元に戻ります。</p>
          <div class="cform" style="padding:0 16px"><label>停止するユーザーID<input id="adm-bh" placeholder="例：trainer_01" autocomplete="off" autocapitalize="off"></label></div>
          <div class="btns"><button class="btn btn-p" id="adm-bb">停止する</button></div><div class="sec"><h2>停止中</h2></div>`
          +(j.users.length?j.users.map(u=>`<div class="bpost"><div class="bpost-h"><b>${esc(u.name||'')}</b>　@${esc(u.handle)}</div><div style="padding-top:6px"><button class="bback" data-unban="${esc(u.handle)}" style="padding:0">停止を解除する</button></div></div>`).join(''):'<p class="empty">停止中のアカウントはありません。</p>');
        document.getElementById('adm-bb').onclick=async()=>{const h=document.getElementById('adm-bh').value.trim().replace(/^@/,'');if(!h)return;
          if(await askConfirm({title:`@${h} を停止しますか？`,text:'投稿とプロフィールが表示されなくなり、書き込みもできなくなります。あとで解除できます。',ok:'停止する'}))act(()=>apost('/api/admin/ban',{handle:h}),'停止しました')};
      }else{
        const j=await aget('/api/admin/recent');
        el.innerHTML=`<div class="sec"><h2>タイムライン</h2></div>`+((j.notes||[]).length?j.notes.map(p=>`<div class="bpost"><div class="bpost-h">${esc(p.name||'（削除済み）')}　@${esc(p.handle||'')}　${ago(p.created_at)}${p.hidden?'　<b style="color:var(--w2)">非表示中</b>':''}${p.media_hidden?'　<b style="color:var(--w2)">画像は確認待ち</b>':''}</div><div class="bpost-b">${esc(p.body||'').replace(/\n/g,'<br>')}</div>${admMedia(p.media)}
          <div style="padding-top:6px;display:flex;gap:16px">${p.hidden?`<button class="bback" data-res="note:${p.id}" style="padding:0">元に戻す</button>`:`<button class="bback" data-del="note:${p.id}" style="padding:0;color:var(--w2)">非表示にする</button>`}${p.handle?`<button class="bback" data-ban="${esc(p.handle)}" style="padding:0;color:var(--w2)">このアカウントを停止</button>`:''}</div></div>`).join(''):'<p class="empty">投稿はありません。</p>')
          +`<div class="sec"><h2>掲示板</h2></div>`+(j.posts.length?j.posts.map(p=>`<div class="bpost"><div class="bpost-h"><b>${p.no}</b>「${esc(p.title||'')}」　${esc(p.name)}　ID:${esc(p.aid)}　${ago(p.created_at)}${p.hidden?'　<b style="color:var(--w2)">非表示中</b>':''}</div><div class="bpost-b">${esc(p.body).replace(/\n/g,'<br>')}</div>
          <div style="padding-top:6px">${p.hidden?`<button class="bback" data-res="post:${p.id}" style="padding:0">元に戻す</button>`:`<button class="bback" data-del="post:${p.id}" style="padding:0;color:var(--w2)">非表示にする</button>`}</div></div>`).join(''):'<p class="empty">書き込みはありません。</p>')
          +`<div class="sec"><h2>対戦募集</h2></div>`+(j.lobby.length?j.lobby.map(x=>`<div class="bpost"><div class="bpost-h">${x.fmt==='single'?'シングル':'ダブル'}　${esc(x.rule)}　あいことば ${esc(x.pass)}　ID:${esc(x.aid)}　${ago(x.created_at)}${x.hidden?'　<b style="color:var(--w2)">非表示中</b>':''}</div><div class="bpost-b">${esc(x.comment||'')}</div>
          <div style="padding-top:6px">${x.hidden?`<button class="bback" data-res="lobby:${x.id}" style="padding:0">元に戻す</button>`:`<button class="bback" data-del="lobby:${x.id}" style="padding:0;color:var(--w2)">非表示にする</button>`}</div></div>`).join(''):'<p class="empty">募集はありません。</p>');
      }
      loadMedia();
      el.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{const[k,i]=b.dataset.del.split(':');act(()=>apost('/api/admin/delete',{kind:k,id:+i}),'非表示にしました')});
      el.querySelectorAll('[data-res]').forEach(b=>b.onclick=()=>{const[k,i]=b.dataset.res.split(':');act(()=>apost('/api/admin/delete',{kind:k,id:+i,restore:true}),'元に戻しました')});
      el.querySelectorAll('[data-ban]').forEach(b=>b.onclick=async()=>{const h=b.dataset.ban;if(await askConfirm({title:`@${h} を停止しますか？`,text:'投稿とプロフィールが表示されなくなり、書き込みもできなくなります。あとで解除できます。',ok:'停止する'}))act(()=>apost('/api/admin/ban',{handle:h}),'停止しました')});
      el.querySelectorAll('[data-unban]').forEach(b=>b.onclick=()=>act(()=>apost('/api/admin/ban',{handle:b.dataset.unban,on:false}),'停止を解除しました'));
      el.querySelectorAll('[data-dis]').forEach(b=>b.onclick=()=>{const[k,i]=b.dataset.dis.split(':');act(()=>apost('/api/admin/dismiss',{kind:k,id:+i}),'通報を消しました')});
    }catch(e){el.innerHTML=`<div class="bnote" style="margin:12px 16px">${esc(e.message)}</div>`}
  };
  load();
}



/* 使用量（2026/11/05）：無料枠の目安と、今日・7日間の使い方。8割を超えたら赤 */
function quotaHTML(j){
  const d=j.days||{},td=d[j.today]||{req:0,ai:0,ai_ng:0,visit:0,view:0};
  const MB=b=>b==null?'—':b>=1e9?(b/1e9).toFixed(2)+' GB':(b/1e6).toFixed(1)+' MB';
  const bar=(label,v,max,unit,note)=>{const p=max?Math.min(100,v/max*100):0,c=p>=80?'var(--w4)':p>=50?'var(--w2)':'var(--accf)';
    return `<div class="qt"><div class="qt-h"><b>${label}</b><span class="num">${unit(v)} / ${unit(max)}</span></div><div class="qt-b"><i style="width:${p.toFixed(1)}%;background:${c}"></i></div>${note?`<p>${note}</p>`:''}</div>`};
  const n=v=>Math.round(v).toLocaleString();
  const days=Object.keys(d).sort();
  const dbB=j.db_bytes,medD1=j.media?j.media.d1:0;
  return `<p class="note" style="padding-top:0">無料で使える量の目安と比べています。赤くなったら、有料プランへの切りかえ（月数百円〜）か、使い方の見直しを考えます。</p>
  <div class="pc-i pc-plan">
    ${bar('サーバーへのアクセス（今日・見積もり）',td.req,100000,n,'Cloudflare Workers の無料枠は1日10万回。20回に1回だけ数えて見積もっています（この表は日本時間の0時、Cloudflare の数え直しは朝9時）。')}
    ${bar('データベースの大きさ',dbB||0,5e9,MB,'Cloudflare D1 の無料枠は5GB。'+(j.r2?'':'画像もここに入っているので、画像が増えたら R2（画像の保存場所）に移します。'))}
    ${j.r2?bar('画像の保存場所（R2）',j.media.r2||0,1e10,MB,'R2 の無料枠は10GB。'):`<div class="qt"><div class="qt-h"><b>画像（データベースの中）</b><span class="num">${MB(medD1)}・${n(j.media?j.media.n:0)}枚</span></div></div>`}
    <div class="qt"><div class="qt-h"><b>AI（Gemini）を呼んだ回数（今日）</b><span class="num">${n(td.ai)}回</span></div>
      <p>${td.ai_ng?`<b style="color:var(--w4)">混雑・回数制限で断られた：${n(td.ai_ng)}回</b>。続くようなら、Google AI Studio で有料の枠に切りかえるか、もう1つの AI（Claude）の合言葉を設定します。`:'今日は断られていません。'}無料枠の回数はモデル・時期で変わるため、正確な上限は Google AI Studio の画面で確かめます。${j.ai2?'もう1つの AI（Claude）も設定済み。':''}</p></div>
  </div>
  <div class="sec"><h2>今日の使われ方</h2></div>
  <div class="pc-i pc-plan"><p>訪問 <b class="num">${n(td.visit)}</b>・画面の表示 <b class="num">${n(td.view)}</b>・投稿 <b class="num">${n(j.notes)}</b>（24時間）・スクショ読み取り <b class="num">${n(j.opp_reads)}</b>・対戦の振り返り <b class="num">${n(j.replay_reads)}</b>・登録した人 <b class="num">${n(j.users||0)}</b></p></div>
  <div class="sec"><h2>7日間</h2></div>
  <div class="qt-t"><table><tr><th>日付</th><th>アクセス</th><th>AI</th><th>断られた</th><th>訪問</th></tr>${days.map(k=>`<tr><td>${k.slice(5)}</td><td class="num">${n(d[k].req)}</td><td class="num">${n(d[k].ai)}</td><td class="num">${n(d[k].ai_ng)}</td><td class="num">${n(d[k].visit)}</td></tr>`).join('')||'<tr><td colspan="5">まだ記録がありません</td></tr>'}</table></div>`;
}
