/* ===================== 運営者用の管理画面 ===================== */
let admTab='reports';
function adminView(){
  setHeader('管理（運営者用）','#/rules');
  const tok=(()=>{try{return localStorage.getItem('pcadmin')||''}catch(e){return''}})();
  const kindJa={post:'書き込み',thread:'スレッド',lobby:'対戦募集'};
  const aget=async path=>{const r=await fetch(COMM_API+path,{headers:{'X-Admin-Token':tok}});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'通信エラー');return j};
  const apost=async(path,body)=>{const r=await fetch(COMM_API+path,{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Token':tok},body:JSON.stringify(body)});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'通信エラー');return j};
  V.innerHTML=`<div id="adm-root">
  <p class="note" style="padding-top:14px">通報された書き込みの確認と削除ができます。サーバーに設定した<b>管理用の合言葉（ADMIN_TOKEN）</b>を入れてください。アプリや背面タップ用の合言葉（APP_TOKEN）では入れません。合言葉はこの端末にだけ保存されます。</p>
  <div class="cform" style="padding:0 16px"><label>管理用の合言葉<input type="password" id="adm-tok" value="${esc(tok)}" autocomplete="off"></label></div>
  <div class="btns"><button class="btn btn-p" id="adm-save">保存して読み込む</button></div>
  <div class="pills" style="padding:0 16px 8px"><button class="pill" data-at="reports" aria-pressed="${admTab==='reports'}">通報</button><button class="pill" data-at="recent" aria-pressed="${admTab==='recent'}">最近の書き込み</button></div>
  <div id="adm-list">${tok?'<p class="empty">読み込み中…</p>':'<p class="empty">合言葉を入れてください。</p>'}</div></div>`;
  document.getElementById('adm-save').onclick=()=>{try{localStorage.setItem('pcadmin',document.getElementById('adm-tok').value.trim())}catch(e){}adminView()};
  V.querySelectorAll('[data-at]').forEach(b=>b.onclick=()=>{admTab=b.dataset.at;adminView()});
  if(!tok)return;
  const el=document.getElementById('adm-list');
  const act=async(fn,msg)=>{try{await fn();toast(msg);load()}catch(e){toast(e.message)}};
  const load=async()=>{
    try{
      if(admTab==='reports'){
        const j=await aget('/api/admin/reports');
        el.innerHTML=j.reports.length?j.reports.map(r=>`<div class="lcard">
          <div class="lcard-h"><span class="atag ${r.n>=3?'on':''}">${kindJa[r.kind]||r.kind}</span><b>通報 ${r.n}件</b><span class="lt">${ago(r.last)}</span></div>
          <div class="lcm" style="white-space:pre-wrap">${r.content==null?'（見つかりません）':esc(r.content)}</div>
          <div class="lmeta">理由：${esc(r.reasons||'')}　ID:${esc(r.aid||'')}　${r.hidden?'<b style="color:var(--w2)">非表示中</b>':'表示中'}</div>
          <div class="btns" style="padding:8px 0 0;flex-wrap:wrap">
            ${r.hidden?`<button class="btn btn-s" data-res="${r.kind}:${r.target}">元に戻す</button>`:`<button class="btn btn-p" data-del="${r.kind}:${r.target}">非表示にする</button>`}
            <button class="btn btn-s" data-dis="${r.kind}:${r.target}">問題なし（通報を消す）</button>
            ${r.thread_id?`<a class="btn btn-s" href="#/thread/${r.thread_id}">スレッドを開く</a>`:''}</div></div>`).join(''):'<p class="empty" style="padding:28px 24px">通報はありません。</p>';
      }else{
        const j=await aget('/api/admin/recent');
        el.innerHTML=`<div class="sec"><h2>掲示板</h2></div>`+(j.posts.length?j.posts.map(p=>`<div class="bpost"><div class="bpost-h"><b>${p.no}</b>「${esc(p.title||'')}」　${esc(p.name)}　ID:${esc(p.aid)}　${ago(p.created_at)}${p.hidden?'　<b style="color:var(--w2)">非表示中</b>':''}</div><div class="bpost-b">${esc(p.body).replace(/\n/g,'<br>')}</div>
          <div style="padding-top:6px">${p.hidden?`<button class="bback" data-res="post:${p.id}" style="padding:0">元に戻す</button>`:`<button class="bback" data-del="post:${p.id}" style="padding:0;color:var(--w2)">非表示にする</button>`}</div></div>`).join(''):'<p class="empty">書き込みはありません。</p>')
          +`<div class="sec"><h2>対戦募集</h2></div>`+(j.lobby.length?j.lobby.map(x=>`<div class="bpost"><div class="bpost-h">${x.fmt==='single'?'シングル':'ダブル'}　${esc(x.rule)}　あいことば ${esc(x.pass)}　ID:${esc(x.aid)}　${ago(x.created_at)}${x.hidden?'　<b style="color:var(--w2)">非表示中</b>':''}</div><div class="bpost-b">${esc(x.comment||'')}</div>
          <div style="padding-top:6px">${x.hidden?`<button class="bback" data-res="lobby:${x.id}" style="padding:0">元に戻す</button>`:`<button class="bback" data-del="lobby:${x.id}" style="padding:0;color:var(--w2)">非表示にする</button>`}</div></div>`).join(''):'<p class="empty">募集はありません。</p>');
      }
      el.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{const[k,i]=b.dataset.del.split(':');act(()=>apost('/api/admin/delete',{kind:k,id:+i}),'非表示にしました')});
      el.querySelectorAll('[data-res]').forEach(b=>b.onclick=()=>{const[k,i]=b.dataset.res.split(':');act(()=>apost('/api/admin/delete',{kind:k,id:+i,restore:true}),'元に戻しました')});
      el.querySelectorAll('[data-dis]').forEach(b=>b.onclick=()=>{const[k,i]=b.dataset.dis.split(':');act(()=>apost('/api/admin/dismiss',{kind:k,id:+i}),'通報を消しました')});
    }catch(e){el.innerHTML=`<div class="bnote" style="margin:12px 16px">${esc(e.message)}</div>`}
  };
  load();
}


