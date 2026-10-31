/* ===================== 当サイトの使用率（worker/src/usage.js の集計を読む） =====================
   選出画面の読み取り・対戦の記録で見た相手の6匹と、利用者が保存した育成から集計したもの。
   流行の画面に「当サイトの集計」、ポケモンの解説に「当サイトの利用者の育成」と、それをもとにした型を出す */
const USAGE={single:null,double:null,st:{}};
function usageGet(fmt,cb){
  if(USAGE[fmt]||USAGE.st[fmt])return;
  const c=lsGet('pcusage_'+fmt,6*36e5);if(c){USAGE[fmt]=c;return}
  if(typeof COMM_API==='undefined'||!COMM_API||/^file:/.test(location.href))return;
  USAGE.st[fmt]='loading';
  fetch(COMM_API+'/api/usage?fmt='+fmt).then(r=>r.ok?r.json():null).then(d=>{if(d&&d.fmt){USAGE[fmt]=d;lsSet('pcusage_'+fmt,d);cb&&cb()}}).catch(()=>{}).finally(()=>{USAGE.st[fmt]='done'});
}
/* 解説で使う：そのポケモンの育成の集計（5件以上のときだけ） */
const usageBuildOf=(no,fmt)=>{const d=USAGE[fmt];const b=d&&d.builds&&d.builds[no];return b&&b.n>=5?b:null};
/* 集計から型を1つ組む（いちばん多い持ち物・特性・技4つ・性格・能力ポイント） */
function usageSet(p,b){
  const ls=LSD[p.no]?LSD[p.no][1]:[];
  const abs=(ABD[p.no]||[]).map(a=>a[0]),ab=(b.ab.find(([k])=>abs.includes(k))||[])[0]||null;
  const it=(b.it.find(([k])=>ITEMN[k])||[])[0]||null;
  const mv=b.mv.map(x=>x[0]).filter(id=>(id===182||ls.includes(id))&&(MV[id]||MD[id])).slice(0,4);
  const nat=b.nat[0]?b.nat[0][0].split('-').map(Number):[-1,-1];
  const sp=b.sp[0]?b.sp[0][0].split('-').map(Number):null;
  if(mv.length<2||!sp)return null;
  return{title:'当サイトでよく使われている型',why:`当サイトの利用者の育成${b.n}件で、それぞれいちばん多い持ち物・特性・技・性格・能力ポイントを組み合わせたものです。`,ab,item:it,up:nat[0],dn:nat[1],sp,moves:mv,k:/^choice|lifeorb|focussash|expertbelt/.test(it||'')?'attacker':it==='leftovers'?'bulky':'attacker',usage:true};
}
function usageGuideHTML(p,fmt,lk){
  const b=usageBuildOf(p.no,fmt);if(!b)return '';
  const row=(t,a,f)=>a.length?`<div class="gus"><b>${t}</b><div>${a.map(([k,v])=>`<span>${f(k)} <i>${v}%</i></span>`).join('')}</div></div>`:'';
  return `<div class="sec"><h2>当サイトの利用者の育成</h2><span style="font-size:12px;color:var(--dim)">${fmt==='double'?'ダブル':'シングル'}・${b.n}件</span></div>
    <div class="gdoc" style="padding-top:0">${row('持ち物',b.it,k=>`<a href="${lk('#/item/'+k)}" style="color:var(--acc)">${esc(ITEMN[k]||k)}</a>`)}${row('特性',b.ab,k=>esc(ABN[k]||k))}${row('技',b.mv.slice(0,8),id=>`<a href="${lk('#/move/'+id)}" style="color:var(--acc)">${esc(mName(id))}</a>`)}${row('性格',b.nat,k=>{const [u,d]=k.split('-').map(Number);return esc(natName(u,d)||'—')})}</div>
    <p class="note" style="padding-top:0;color:var(--mute)">ログインした利用者が保存したパーティ・上位パーティの登録・対戦の記録から集計しています（だれの育成かは出しません）。</p>`;
}
function usageMetaHTML(){
  const d=USAGE[FMT];
  if(!d)return '';
  const top=d.seen.slice(0,20);
  return `<div class="sec"><h2>当サイトの集計</h2><span style="font-size:13px;color:var(--dim)">直近${d.days}日・選出画面${d.previews}件</span></div>
    ${top.length&&d.previews>=20?top.map((x,i)=>byNo[x[0]]?`<a class="row" href="#/p/${x[0]}"><span class="rk">${i+1}</span><span class="av">${stamp(byNo[x[0]])}</span><div class="row-m"><div class="row-t">${byNo[x[0]].n}</div><div class="row-s">相手の選出画面の ${x[2]}% に登場</div></div><span class="chev">${SVG(I.chev,18)}</span></a>`:'').join('')
      :`<div class="bnote" style="margin:8px 16px">まだ数が少ないため、集計中です。選出アシストの「スクショから読む」や「対戦の振り返り」を使うと、相手のポケモンがこの集計に入ります（だれが見たかは出しません）。</div>`}`;
}
/* ===================== アクセス解析（worker/src/hits.js） =====================
   画面が開かれるたびに「どの画面か」だけを送る。クッキー・利用者の番号は使わない。
   その訪問の最初の画面のときだけ、スマホ/PC と、どこから来たか（検索・SNS・直接・その他）も送る */
function hitSend(k){
  try{
    if(navigator.webdriver||/^file:|\/\/(localhost|127\.)/.test(location.href)||k==='admin'||typeof COMM_API==='undefined'||!COMM_API)return;
    const b={k:String(k||'').toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,24)};
    let first=false;try{first=!sessionStorage.getItem('pcvis');sessionStorage.setItem('pcvis','1')}catch(e){}
    if(first){b.v=1;b.d=matchMedia('(min-width:700px)').matches?'pc':'sp';
      let h='';try{h=document.referrer?new URL(document.referrer).hostname:''}catch(e){}
      b.r=!h||h===location.hostname?'direct':/google\.|yahoo\.|bing\.|duckduckgo\.|ecosia\./.test(h)?'search':/(^|\.)(x|twitter|t|youtube|discord|line|instagram|tiktok|facebook|reddit)\.(com|co|me|gg)$/.test(h)?'social':'other'}
    navigator.sendBeacon(COMM_API+'/api/hit',new Blob([JSON.stringify(b)],{type:'text/plain'}));
  }catch(e){}
}
/* 管理画面の「アクセス」タブ */
const HIT_NAMES={home:'ホーム（タイムライン）',search:'検索',dex:'図鑑の一覧',p:'図鑑（ポケモンごと）',tools:'ツール',team:'パーティ',edit:'育成の編集',community:'コミュニティ',tl:'タイムライン',n:'投稿',u:'プロフィール',notif:'お知らせ',account:'アカウント',
  move:'技のページ',ability:'特性のページ',item:'道具のページ',word:'用語のページ',arch:'構築の型のページ',lobby:'対戦募集（旧）',bbs:'掲示板（旧）',thread:'掲示板のスレッド（旧）',terms:'利用規約',privacy:'プライバシーポリシー',rules:'利用ルール'};
function hitsHTML(rows){
  const days=[...new Set(rows.map(r=>r.day))].sort(),last7=days.slice(-7);
  const sum=(k,ds)=>rows.filter(r=>r.k===k&&(!ds||ds.includes(r.day))).reduce((a,r)=>a+r.n,0);
  const tl=toolsOf(curGame()),name=k=>HIT_NAMES[k]||((tl.find(t=>t.href==='#/'+k)||{}).t)||k;
  const pages=[...new Set(rows.filter(r=>r.k.startsWith('p:')).map(r=>r.k))].map(k=>({k:k.slice(2),w:sum(k,last7),m:sum(k)})).sort((a,b)=>b.m-a.m);
  const mx=Math.max(1,...pages.map(x=>x.m)),dv=days.map(d=>[d,sum('_visit',[d])]),dmx=Math.max(1,...dv.map(x=>x[1]));
  const bar=(v,m)=>`<span style="display:inline-block;height:8px;border-radius:4px;background:var(--acc);width:${Math.max(2,Math.round(v/m*120))}px;vertical-align:middle"></span>`;
  const split=(pre,lab)=>{const ks=Object.keys(lab),t=Math.max(1,ks.reduce((a,k)=>a+sum(pre+k),0));return ks.map(k=>`${lab[k]} ${Math.round(sum(pre+k)/t*100)}%`).join('・')};
  return `<p class="note" style="padding-top:0">クッキーや利用者の番号は使わず、日付ごと・画面ごとの回数だけを数えています（日本時間）。「訪問」は、ブラウザのタブを開いてから閉じるまでを1回と数えます。</p>
    <div class="sec"><h2>訪問</h2></div>
    <p class="note" style="padding-top:0">この7日間 <b>${sum('_visit',last7)}</b> 回・この30日間 <b>${sum('_visit')}</b> 回<br>スマホとPC：${split('d:',{sp:'スマホ',pc:'PC'})}<br>どこから：${split('r:',{search:'検索',social:'SNS',direct:'直接・ブックマーク',other:'その他のサイト'})}</p>
    ${dv.slice(-14).reverse().map(([d,n])=>`<div class="row-s" style="padding:2px 16px">${d.slice(5)}　${bar(n,dmx)} ${n}</div>`).join('')}
    <div class="sec"><h2>画面ごとの表示回数</h2><span style="font-size:12px;color:var(--dim)">30日間（7日間）</span></div>
    ${pages.length?pages.map(x=>`<div class="row-s" style="padding:4px 16px;display:flex;gap:8px;align-items:center"><span style="flex:1;color:var(--fg)">${esc(name(x.k))}</span>${bar(x.m,mx)}<b style="min-width:64px;text-align:right">${x.m}（${x.w}）</b></div>`).join(''):'<p class="empty">まだ記録がありません。</p>'}`;
}
