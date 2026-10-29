/* ===================== ホーム ===================== */
/* ホームは投稿（32-timeline.js の tlView）。もとのホームの中身（すぐ使う・相性・役割・ランキング）はツール画面の上に出す */
function home(){tlView(null,true)}
function toolsTopHTML(){
  const top=(i,n)=>[...P].sort((a,b)=>b.s[i]-a.s[i]).slice(0,n);
  const qt=quickTools(8);
  return `
  <div class="sec" style="padding-top:14px"><h2>すぐ使う</h2><span style="font-size:12px;color:var(--dim)">☆を押したツールが先頭に</span></div>
  <div class="tgrid">${qt.map(toolTile).join('')}</div>
  <section class="hero" style="padding-top:8px">
    <span class="kicker"><i></i>レギュレーション M-C ／ 2026年9月9日から</span>${srcLine('regulation').replace('srcline','srcline" style="padding:8px 0 0')}
    <h2>${P.length}匹の種族値と<br>Lv50ステータス</h2>
    <p>能力ポイント（合計66・1項目32まで）にそのまま対応した計算機つき。</p>
    <div class="btns" style="padding:16px 0 0;flex-wrap:wrap"><button class="btn btn-p" id="h-m">${SVG(I.zap,17)}相性をワンタップで調べる</button></div>
  </section>
  <div class="sec" style="padding-top:8px"><h2>相手のタイプをタップ</h2><span style="font-size:11px;color:var(--mute)">効く技がすぐ分かります</span></div>
  ${tkb(6)}
  <p class="cap">ポケモン名で調べたいときは、「相性」ボタン（スマホは右下・パソコンは左のメニュー）から。</p>
`;
}
function toolsBottomHTML(){
  const top=(i,n)=>[...P].sort((a,b)=>b.s[i]-a.s[i]).slice(0,n);
  return `
  <div class="sec"><h2>役割から探す</h2><span style="font-size:11px;color:var(--mute)">種族値から自動判定</span></div>
  ${RDESC.map(([r,t,d])=>`<a class="row" href="#/dex" data-role="${r}"><div class="row-m"><div class="row-t">${t}</div><div class="row-s">${r}：${d}</div></div><span class="chev">${SVG(I.chev,18)}</span></a>`).join('')}

  <div class="sec"><h2>素早さ種族値</h2><a href="#/dex" data-sort="5">すべて見る</a></div>
  <div>${top(5,5).map(p=>rowP(p,5)).join('')}</div>
  ${adSlot('インフィード')}
  <div class="sec"><h2>合計種族値</h2><a href="#/dex" data-sort="bst">すべて見る</a></div>
  <div>${[...P].sort((a,b)=>b.bst-a.bst).slice(0,5).map(p=>rowP(p)).join('')}</div>

`;
}
function toolsTopBind(V){
  V.querySelectorAll('.tk').forEach(b=>b.onclick=()=>openSheet({types:[b.dataset.t]}));
  document.getElementById('h-m').onclick=()=>openSheet();
  V.querySelectorAll('[data-sort]').forEach(a=>a.onclick=()=>{dq={q:'',type:'',sort:a.dataset.sort,role:''}});
  V.querySelectorAll('[data-role]').forEach(a=>a.onclick=()=>{dq={q:'',type:'',sort:'no',role:a.dataset.role}});
}

