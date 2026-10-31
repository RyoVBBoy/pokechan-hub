/* ===================== ツール一覧・コミュニティ ===================== */
const hubRow=(h,t,d,badge)=>`<a class="row" href="${h}"><div class="row-m"><div class="row-t">${t}${badge?`<span class="atag" style="margin-left:6px">${badge}</span>`:''}</div><div class="row-s">${d}</div></div><span class="chev">${SVG(I.chev,18)}</span></a>`;
function toolsView(){
  setHeader('ツール');
  const g=curGame(),all=toolsOf(g),pins=tPins(g),by=id=>all.find(t=>t.id===id);
  const mine=pins.map(by).filter(Boolean),recent=tRecent(g).map(by).filter(t=>t&&!pins.includes(t.id)).slice(0,4);
  const secs=[...new Set(all.map(t=>t.sec))];
  const row=t=>`<div class="trow"><a class="trow-a" href="${t.href}"><span class="ttile-i">${SVG(t.ic,22)}</span><span class="row-m"><span class="row-t">${esc(t.t)}${t.badge?`<span class="atag" style="margin-left:6px">${t.badge}</span>`:''}</span><span class="row-s">${t.d}</span></span></a>
    <button class="tpin${pins.includes(t.id)?' on':''}" data-tpin="${t.id}" aria-pressed="${pins.includes(t.id)}" aria-label="${esc(t.t)}をマイツールに${pins.includes(t.id)?'入れない':'入れる'}">${SVG(I.star,20)}</button></div>`;
  V.innerHTML=`${g.id==='pokechamp'?`<div class="fmtbar"><span>対戦の形式</span>${fmtSwitch()}</div>
  <p class="note" style="padding-top:4px">選んだ形式（いまは<b>${FMTN()}</b>：${PICK()}匹選出・先発${LEADN()}匹）で、選出・予想・使用率を計算します。</p>`:''}
  ${g.id==='pokechamp'?toolsTopHTML():''}
  ${secs.map(sc=>`<div class="sec"><h2>${esc(sc)}</h2></div>${all.filter(t=>t.sec===sc).map(row).join('')}`).join('')}
  ${g.id==='pokechamp'?toolsBottomHTML():''}`;
  if(g.id==='pokechamp')toolsTopBind(V);
  if(g.id==='pokechamp')bindFmt(V,toolsView);
  V.querySelectorAll('[data-tpin]').forEach(b=>b.onclick=()=>{const t=by(b.dataset.tpin),on=tTogglePin(t.id);toast(on?`「${t.s||t.t}」をマイツールに入れました`:`「${t.s||t.t}」をマイツールから外しました`);const y=scrY();toolsView();scrTo(0,y)});
}
function communityView(){
  setHeader('コミュニティ');
  V.innerHTML=`<p class="note" style="padding-top:14px">ほかのトレーナーと対戦したり、情報を交換したりする場所です。対戦募集・相談・質問は、タイムラインにタグを付けて投稿します（タグを押すと、そのタグの投稿と投稿欄が開きます）。</p>
  ${hubRow('#/tl','タイムライン','トレーナーの投稿を見る・投稿する・フォローする')}
  ${hubRow('#/notif','お知らせ','いいね・フォローされたとき<span id="cm-notif-n" style="color:var(--acc);margin-left:6px">'+(notifN?'未読 '+notifN+'件':'')+'</span>')}
  ${hubRow('#/account','アカウント',typeof AUTH!=='undefined'&&AUTH.profile?`@${esc(AUTH.profile.handle)}・プロフィール`:'ログイン・プロフィール')}
  ${hubRow('#/search/'+encodeURIComponent('#対戦募集'),'<span data-notr>#対戦募集</span>','プライベート対戦の相手を募集する（形式・ルール・あいことばを書いて投稿）')}
  ${hubRow('#/search/'+encodeURIComponent('#構築相談'),'<span data-notr>#構築相談</span>','パーティの組み方を相談する')}
  ${hubRow('#/search/'+encodeURIComponent('#質問'),'<span data-notr>#質問</span>','わからないことを聞く')}
  ${hubRow('#/search/'+encodeURIComponent('#雑談'),'<span data-notr>#雑談</span>','なんでも話す')}
  ${hubRow('#/rules','利用ルール','禁止していること・通報と削除・保存する情報')}`;
}


