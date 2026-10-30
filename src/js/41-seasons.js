/* ===================== シーズンごとの上位パーティ（#/season・#/season/番号） =====================
   シーズンは運営者が管理画面で登録する。パーティは利用者が自分の結果を登録するか、運営者が登録する（サーバーは worker/src/ladder.js）。
   ほかの人が登録した育成は、このサイトのデータ（技・特性・持ち物の表）から名前を引き直して表示・保存する（書かれた文字はそのまま使わない） */
I.trophy='<path d="M7.5 4.5h9v4a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 6H4.5v1.5A3 3 0 0 0 7.5 10.5M16.5 6h3v1.5a3 3 0 0 1-3 3M12 13v3.5M8.5 20h7M9.5 16.5h5V20h-5z"/>';
/* 登録された育成を、このサイトの表から作り直す（知らない技・特性・持ち物は外す） */
function cleanSet(s){
  if(!s||typeof s!=='object')return undefined;
  const ab=s.ab&&ABN[s.ab.k]?{n:ABN[s.ab.k],k:s.ab.k}:null,it=s.it&&ITEMN[s.it.k]?{n:ITEMN[s.it.k],k:s.it.k}:null;
  const mv=(Array.isArray(s.mv)?s.mv:[]).map(x=>x&&+x.id).filter(id=>id===182||MD[id]||MV[id]).slice(0,4).map(id=>({n:id===182?'まもる':mName(id),id}));
  const sp=Array.isArray(s.sp)&&s.sp.length===6?s.sp.map(v=>Math.max(0,Math.min(SP_CAP,+v||0))):null;
  const nat=v=>Number.isInteger(v)&&v>=-1&&v<=5?v:-1;
  return{ab,it,mv,sp:sp&&sp.reduce((a,b)=>a+b,0)<=SP_TOTAL?sp:null,up:nat(s.up),dn:nat(s.dn)};
}
/* ほかから持ってきたパーティを、空いているパーティの枠に入れる（空きがなければ確認していまのパーティを入れかえる） */
function useTeam(name,list){
  let i=TEAMS.cur;
  if(team.length){const e=TEAMS.list.findIndex(x=>!x.team.length);
    if(e>=0)i=e;else if(!confirm(`「${teamName(TEAMS.cur)}」を、このパーティに入れかえます。よろしいですか？`))return}
  if(i!==TEAMS.cur)switchTeam(i);
  team=list.filter(x=>byNo[x.no]).slice(0,6).map((x,k)=>{const o={no:x.no,sel:k<PICK()},s=cleanSet(x.set);if(s&&(s.sp||s.mv.length))o.set=s;return o});
  if(!TEAMS.list[i].name)TEAMS.list[i].name=String(name||'').slice(0,20);
  saveTeam();toast(`「${teamName(i)}」に入れました`);nav('#/team');
}
const SEAS={list:null,formSlot:null};
const today=()=>new Date().toISOString().slice(0,10);
const pnm=p=>esc(formInfo(p).base)+(formInfo(p).tag?'（'+esc(formInfo(p).tag)+'）':'');
/* 実際のパーティがどの型か（まとめ用。覚えられるかではなく、特性の組み合わせと登録された技で厳しめに見る） */
function szKinds(t){
  const ms=t.team.map(x=>({p:byNo[x.no],s:cleanSet(x.set)})).filter(x=>x.p);
  const ab=x=>x.s&&x.s.ab?[x.s.ab.k]:(ABD[x.p.no]||[]).map(a=>a[0]);
  const has=k=>ms.some(x=>ab(x).includes(k)),mv=k=>ms.some(x=>x.s&&x.s.mv.some(m=>MD[m.id]&&MD[m.id][3]===k));
  const out=[];
  if((has('drizzle')||mv('raindance'))&&(has('swift-swim')||ms.filter(x=>x.p.t.includes('みず')).length>=3))out.push('rain');
  if((has('drought')||mv('sunnyday'))&&(has('chlorophyll')||has('solar-power')||ms.filter(x=>x.p.t.includes('ほのお')).length>=2))out.push('sun');
  if(has('sand-stream')&&(has('sand-rush')||has('sand-force')||ms.filter(x=>x.p.t.includes('いわ')).length>=2))out.push('sand');
  if((has('snow-warning')||mv('snowscape'))&&(has('slush-rush')||mv('auroraveil')||ms.filter(x=>x.p.t.includes('こおり')).length>=2))out.push('snow');
  if(mv('trickroom')||ms.filter(x=>x.p.s[5]<=50).length>=3)out.push('tr');
  if(mv('tailwind'))out.push('tailwind');
  return out;
}
/* ---- シーズンのまとめ：登録されたパーティから、当サイトが自動で傾向を文章にする（記事の写しではない） ---- */
function szSummary(j){
  const s=j.season,T=j.teams.map(t=>({t,ps:t.team.map(x=>byNo[x.no]).filter(Boolean)})).filter(x=>x.ps.length>=3),n=T.length;
  const head=`<div class="sec"><h2>シーズンのまとめ</h2><span style="font-size:12px;color:var(--dim)">${n}件の登録から</span></div>`
    +(s.note?`<div class="gdoc gsub"><h3>運営者より</h3><p class="sz-note" data-notr>${esc(s.note)}</p></div>`:'');
  if(n<3)return s.note?head:'';
  const pc=x=>Math.round(x/n*100);
  /* 軸：一緒に使われた2匹・3匹の組み合わせ */
  const pairs={},trios={};
  T.forEach(({ps})=>{const ns=[...new Set(ps.map(p=>p.no))].sort((a,b)=>a-b);
    for(let a=0;a<ns.length;a++)for(let b=a+1;b<ns.length;b++){const k=ns[a]+'-'+ns[b];pairs[k]=(pairs[k]||0)+1;
      for(let c=b+1;c<ns.length;c++){const k3=k+'-'+ns[c];trios[k3]=(trios[k3]||0)+1}}});
  const top=(o,min)=>Object.entries(o).filter(([,c])=>c>=min).sort((a,b)=>b[1]-a[1]).map(([k,c])=>({ps:k.split('-').map(Number).map(x=>byNo[x]),c}));
  const tri=top(trios,Math.max(2,Math.ceil(n*.15))).slice(0,3),pr=top(pairs,2).filter(x=>!tri.some(t=>x.ps.every(p=>t.ps.includes(p)))).slice(0,4);
  /* 構築の型：天気・トリックルーム・おいかぜだけを数える（対面・サイクルなどは技や立ち回りによるので数えない） */
  const kinds=T.map(x=>szKinds(x.t));
  const ar=ARCHS.map(a=>({a,c:kinds.filter(k=>k.includes(a[0])).length})).filter(x=>x.c>0).sort((x,y)=>y.c-x.c);
  const plain=kinds.filter(k=>!k.length).length;
  /* 上位（順位100位以内。少なければ並びの上から3分の1）と全体の採用率の差 */
  let up=T.filter(x=>x.t.rank&&x.t.rank<=100);if(up.length<3)up=T.slice(0,Math.max(3,Math.ceil(n/3)));
  const share=(g,no)=>g.filter(x=>x.ps.some(p=>p.no===no)).length/g.length;
  const nos=[...new Set(T.flatMap(x=>x.ps.map(p=>p.no)))];
  const stand=up.length<n?nos.map(no=>({p:byNo[no],u:share(up,no),a:share(T,no)})).filter(x=>x.u>=.3&&x.u-x.a>=.1).sort((a,b)=>(b.u-b.a)-(a.u-a.a)).slice(0,5):[];
  /* 持ち物（育成が登録されていれば） */
  const its={};T.forEach(x=>x.t.team.forEach(m=>{const c=cleanSet(m.set);if(c&&c.it)its[c.it.k]=(its[c.it.k]||0)+1}));
  const itTop=Object.entries(its).sort((a,b)=>b[1]-a[1]),megas=itTop.filter(([k])=>isStone(k));
  const most=j.usage[0]&&byNo[j.usage[0].no];
  /* 文章 */
  const t=[];
  if(most)t.push(`${esc(s.name)}の${j.fmt==='double'?'ダブル':'シングル'}では、${pnm(most)}がいちばん多く、登録されたパーティの${j.usage[0].pc}%に入っていました。`);
  if(tri[0])t.push(`軸として多かったのは${tri[0].ps.map(pnm).join('・')}の3匹で、${tri[0].c}件（${pc(tri[0].c)}%）がこの組み合わせを使っていました。`);
  else if(pr[0])t.push(`${pr[0].ps.map(pnm).join('と')}を一緒に使うパーティが${pr[0].c}件（${pc(pr[0].c)}%）と目立ちました。`);
  if(ar[0])t.push(`天気やトリックルームなどの「場づくり」を軸にしたものでは「${esc(ar[0].a[1])}」が${pc(ar[0].c)}%${ar[1]?`、「${esc(ar[1].a[1])}」が${pc(ar[1].c)}%`:''}で、${plain>n/2?'それ以外の、場づくりに頼らないパーティが多数派でした':'場づくりを軸にしたパーティが多いシーズンでした'}（${pc(plain)}%）。`);
  else t.push('天気やトリックルームなどの「場づくり」を軸にしたパーティは少なく、ポケモンの強さで押すパーティが中心でした。');
  if(stand[0])t.push(`上位のパーティほど${stand.slice(0,2).map(x=>pnm(x.p)).join('・')}の採用が多く、${pnm(stand[0].p)}は上位で${Math.round(stand[0].u*100)}%、全体では${Math.round(stand[0].a*100)}%でした。`);
  if(megas.length)t.push(`メガシンカは${megas.slice(0,3).map(([k])=>esc(ITEMN[k])).join('・')}を持たせたパーティが多く見られました。`);
  else if(itTop[0]&&itTop[0][1]>=2)t.push(`持ち物では${itTop.slice(0,3).map(([k])=>esc(ITEMN[k]||k)).join('・')}がよく使われていました。`);
  const monsRow=ps=>`<span class="sz-core">${ps.map(p=>`<a href="#/p/${p.no}" class="sz-m"><span class="av">${stamp(p)}</span><small>${esc(formInfo(p).base)}</small></a>`).join('')}</span>`;
  return head+`<div class="gdoc gsub"><h3>全体の傾向</h3><p>${t.join('')}</p></div>`
    +(tri.length||pr.length?`<div class="gdoc gsub"><h3>よく見られた軸（一緒に使われた組み合わせ）</h3></div>${[...tri,...pr].slice(0,5).map(x=>`<div class="sz-axis">${monsRow(x.ps)}<b>${x.c}件<small>${pc(x.c)}%</small></b></div>`).join('')}`:'')
    +(ar.length?`<div class="gdoc gsub"><h3>構築の型（場づくり）</h3><p class="note" style="padding:0">天気を作る特性と天気で強くなる特性の組み合わせ、登録された技（トリックルーム・おいかぜ）から判定しています。</p></div>${ar.map(x=>`<a class="sz-bar" href="#/arch/${x.a[0]}"><span>${esc(x.a[1])}</span><i style="--w:${pc(x.c)}%"></i><b>${pc(x.c)}%</b></a>`).join('')}<div class="sz-bar"><span>場づくりなし</span><i style="--w:${pc(plain)}%"></i><b>${pc(plain)}%</b></div>`:'')
    +(stand.length?`<div class="gdoc gsub"><h3>上位で目立ったポケモン</h3><p class="note" style="padding:0">${up.length<n&&up.some(x=>x.t.rank&&x.t.rank<=100)?'100位以内':'上位'}のパーティでの採用率と、全体での採用率の差が大きいものです。</p></div><div class="sz-use sz-use--w">${stand.map(x=>`<a class="sz-u" href="#/p/${x.p.no}"><span class="av">${stamp(x.p)}</span><span class="sz-un">${esc(formInfo(x.p).base)}</span><b>${Math.round(x.u*100)}%<small style="color:var(--dim);font-weight:500"> / ${Math.round(x.a*100)}%</small></b></a>`).join('')}</div>`:'')
    +(()=>{const us=[...new Set(j.teams.flatMap(x=>x.sources||[]))];return us.length?`<div class="gdoc gsub"><h3>出典</h3><p class="note" style="padding:0">一部のパーティは、次のページに書かれた事実（順位・6匹など）を当サイトが自動で集め、2つ以上のページで一致したものだけを載せています。文章は当サイトが集計から作ったものです。</p>${srcLinks(us)}</div>`:''})()
    +`<p class="note" style="color:var(--mute)">登録されたパーティから当サイトが自動で集計した傾向です。登録が少ないうちは、実際の流行とずれることがあります。</p>`;
}
async function seasonView(a){
  setHeader('シーズンの上位パーティ','#/tools');
  V.innerHTML='<p class="empty">読み込み中…</p>';
  const prof=await twAuth();if(keyOf(cur)!=='season')return;
  try{if(!SEAS.list)SEAS.list=(await authFetch('/api/seasons')).seasons}
  catch(e){V.innerHTML=`<div class="bnote" style="margin:16px">${esc(e.message)}</div>`;return}
  if(!SEAS.list.length){V.innerHTML='<p class="empty" style="padding:40px 24px">まだシーズンが登録されていません。<br>運営者がシーズンを登録すると、ここに上位のパーティが並びます。</p>';return}
  const s=SEAS.list.find(x=>x.id===+a)||SEAS.list[0];
  V.innerHTML=`<div class="pills sz-pills">${SEAS.list.map(x=>`<a class="pill" href="#/season/${x.id}" aria-pressed="${x.id===s.id}"><span data-notr>${esc(x.name)}</span>${x.end&&x.end<today()?'<small class="sz-end">終了</small>':''}</a>`).join('')}</div>
    <div class="fmtbar"><span>対戦の形式</span>${fmtSwitch()}</div>
    <p class="note" style="padding-top:2px">${s.start||s.end?`期間 ${esc(s.start||'')}〜${esc(s.end||'')}。`:''}このシーズンに上位になった人のパーティです。本人が登録したもの（スクリーンショットを運営者が確かめたものは「確認済み」）と、運営者が登録したものがあります。</p>
    <div class="btns" style="padding-top:4px"><button class="btn btn-p" id="sz-new">${SVG(I.trophy,16)}自分の結果を登録する</button></div>
    <div id="sz-form"></div><div id="sz-body"><p class="empty">読み込み中…</p></div>`;
  bindFmt(V,()=>seasonView(String(s.id)));
  document.getElementById('sz-new').onclick=()=>{if(!prof){toast(AUTH.user?'先にプロフィールを作ってください':'登録するにはログインしてください');nav('#/account');return}szForm(s,mine)};
  let mine=null;
  try{
    const j=await authFetch(`/api/seasons/${s.id}/teams?fmt=${FMT}`);
    mine=j.teams.find(t=>t.mine)||null;if(mine)document.getElementById('sz-new').lastChild.textContent='自分の登録を直す';
    const body=document.getElementById('sz-body');if(!body)return;
    body.innerHTML=szSummary(j)+(j.usage.length?`<div class="sec"><h2>よく使われたポケモン</h2><span style="font-size:12px;color:var(--dim)">${j.total}件の登録から</span></div>
      <div class="sz-use">${j.usage.filter(u=>byNo[u.no]).slice(0,12).map(u=>{const p=byNo[u.no];return `<a class="sz-u" href="#/p/${p.no}"><span class="av">${stamp(p)}</span><span class="sz-un">${esc(formInfo(p).base)}${formInfo(p).tag?`<i class="ftag ftag-${formInfo(p).kind}">${esc(formInfo(p).tag)}</i>`:''}</span><b>${u.pc}%</b></a>`}).join('')}</div>`:'')
      +`<div class="sec"><h2>パーティ</h2><span style="font-size:12px;color:var(--dim)">順位の高い順</span></div>`
      +(j.teams.length?j.teams.map(szCard).join(''):`<p class="empty" style="padding:28px 24px">${FMTN()}の登録はまだありません。<br>上位になったら、ぜひ登録してください。</p>`);
    body.querySelectorAll('[data-vs]').forEach(b=>b.onclick=()=>{const t=j.teams.find(x=>x.id===+b.dataset.vs),el=document.getElementById('sz-vs-'+b.dataset.vs);if(!t||!el)return;
      if(el.innerHTML){el.innerHTML='';b.textContent='自分のパーティと比べる';return}
      el.innerHTML=szVs(t);b.textContent='比べるのをやめる';const g=el.querySelector('[data-goassist]');if(g)g.onclick=()=>{opp6=t.team.map(x=>x.no).filter(n=>byNo[n]).slice(0,6);saveOpp6();nav('#/assist')}});
    body.querySelectorAll('[data-use]').forEach(b=>b.onclick=()=>{const t=j.teams.find(x=>x.id===+b.dataset.use);if(t)useTeam(`${s.name} ${t.rank?t.rank+'位':''}`.trim(),t.team)});
    body.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(!confirm('この登録を消します。よろしいですか？'))return;
      try{await authFetch(`/api/seasons/teams/${+b.dataset.del}/delete`,{});SEAS.list=null;toast('消しました');seasonView(String(s.id))}catch(e){toast(e.message)}});
    /* スクショから読み取って戻ってきたとき：登録欄をそのパーティで開く */
    if(SEAS.formSlot!=null&&prof){const sl=SEAS.formSlot;SEAS.formSlot=null;szForm(s,mine,sl)}
  }catch(e){const b=document.getElementById('sz-body');if(b)b.innerHTML=`<div class="bnote" style="margin:16px">${esc(e.message)}</div>`}
}
function szCard(t){
  const mons=t.team.map(x=>({p:byNo[x.no],s:cleanSet(x.set)})).filter(x=>x.p);
  const who=t.player.handle?`<a href="#/u/${esc(t.player.handle)}" data-notr>${esc(t.player.name)}</a>`:`<span data-notr>${esc(t.player.name)}</span>`;
  return `<div class="sz-card">
    <div class="sz-h">${t.rank?`<b class="sz-rk">${t.rank}位</b>`:''}${t.rate?`<span class="sz-rt">レート ${t.rate}</span>`:''}<span class="sz-who">${who}</span>${t.verified?'<span class="atag on">確認済み</span>':''}${t.auto?`<span class="atag">自動集計・出典${t.sources.length}件</span>`:''}</div>
    <div class="sz-mons">${mons.map(({p})=>`<a class="sz-m" href="#/p/${p.no}"><span class="av">${stamp(p)}</span><small>${esc(formInfo(p).base)}</small></a>`).join('')}</div>
    ${t.comment?`<p class="sz-c" data-notr>${esc(t.comment)}</p>`:''}${srcLinks(t.sources)}
    ${mons.some(x=>x.s&&(x.s.it||x.s.mv.length))?`<details class="sz-det"><summary>育成を見る</summary>${mons.map(({p,s})=>`<div class="sz-set"><b>${nm(p,{no:false})}</b><span>${s?[s.it&&esc(s.it.n),s.ab&&esc(s.ab.n),s.up>0&&s.dn>0&&esc(natName(s.up,s.dn).replace(/（.*$/,''))].filter(Boolean).join('・'):''}</span><span>${s?s.mv.map(m=>esc(m.n)).join('・'):''}</span></div>`).join('')}</details>`:''}
    <div class="sz-vs" id="sz-vs-${t.id}"></div>
    <div class="sz-a"><button class="btn btn-p" data-vs="${t.id}">自分のパーティと比べる</button><button class="btn btn-s" data-use="${t.id}">このパーティを使う</button>${t.mine?`<button class="bback" data-del="${t.id}" style="color:var(--w2)">登録を消す</button>`:''}</div></div>`;
}
/* 自分の結果を登録する欄（保存したパーティから選ぶ） */
function szForm(s,mine,pre){
  const el=document.getElementById('sz-form');if(!el)return;
  const slots=TEAMS.list.map((x,i)=>({i,t:i===TEAMS.cur?team:x.team})).filter(x=>x.t.length);
  const shot=`<div class="btns" style="padding:0 0 8px"><button class="btn btn-s" id="sz-shot">${SVG(I.image,16)}チーム画面のスクショから読み取る</button></div>`;
  if(!slots.length){el.innerHTML=`<div class="sz-f"><p class="note" style="padding:12px 0 8px">ゲームのチーム画面のスクリーンショットを選ぶと、6匹と技・持ち物・能力ポイントまで読み取って、そのまま登録できます。</p>${shot}<p class="note" style="padding:0 0 12px">または、先に<a href="#/team" style="color:var(--acc)">パーティ</a>を作ってから登録してください。</p></div>`;szShotBind(s);return}
  let pick=slots.find(x=>x.i===pre)?pre:slots.find(x=>x.i===TEAMS.cur)?TEAMS.cur:slots[0].i,proof=null;
  el.innerHTML=`<div class="sz-f"><div class="sec" style="padding-left:0"><h2>${esc(s.name)}・${FMTN()}の結果</h2></div>
    <div class="pills" style="padding:0 0 8px">${slots.map(x=>`<button class="pill" data-slot="${x.i}" aria-pressed="${x.i===pick}">${esc(teamName(x.i))}</button>`).join('')}</div>
    <div class="sz-mons" id="sz-pv" style="margin-bottom:10px"></div>${shot}
    <div class="cform" style="padding:0"><label>最終順位<input type="number" id="sz-rank" inputmode="numeric" min="1" placeholder="例：120" value="${mine&&mine.rank||''}"></label>
      <label>レート（わかれば）<input type="number" id="sz-rate" inputmode="numeric" min="1" placeholder="例：1850" value="${mine&&mine.rate||''}"></label>
      <label>ひとこと（140文字まで・なくてもよい）<textarea id="sz-cm" maxlength="140" rows="2" placeholder="例：初めての2桁！">${esc(mine&&mine.comment||'')}</textarea></label>
      <label>証拠のスクリーンショット（なくてもよい）<input type="file" id="sz-proof" accept="image/*"></label></div>
    <p class="note" style="padding:0 0 8px;color:var(--mute)">スクリーンショットは運営者だけが見ます（ほかの人には表示しません）。確かめられたら「確認済み」の印が付きます。保存したパーティの育成（技・持ち物など）も一緒に公開されます。</p>
    <div class="btns" style="padding:0 0 12px"><button class="btn btn-p" id="sz-send">登録する</button><button class="btn btn-s" id="sz-cancel">やめる</button></div></div>`;
  const pv=()=>{const t=slots.find(x=>x.i===pick).t;document.getElementById('sz-pv').innerHTML=t.map(x=>byNo[x.no]).filter(Boolean).map(p=>`<span class="sz-m"><span class="av">${stamp(p)}</span><small>${esc(formInfo(p).base)}</small></span>`).join('')};pv();
  el.querySelectorAll('[data-slot]').forEach(b=>b.onclick=()=>{pick=+b.dataset.slot;el.querySelectorAll('[data-slot]').forEach(x=>x.setAttribute('aria-pressed',x===b));pv()});
  szShotBind(s);
  document.getElementById('sz-proof').onchange=async e=>{const f=e.target.files[0];proof=null;if(!f)return;try{proof=await twShrink(f)}catch(err){toast(err.message);e.target.value=''}};
  document.getElementById('sz-cancel').onclick=()=>{el.innerHTML=''};
  const send=document.getElementById('sz-send');
  send.onclick=async()=>{send.disabled=true;
    try{const t=slots.find(x=>x.i===pick).t;let key=null;
      if(proof){send.textContent='スクリーンショットを送信中…';key=await twUpload(proof)}
      await authFetch(`/api/seasons/${s.id}/teams`,{fmt:FMT,rank:document.getElementById('sz-rank').value,rate:document.getElementById('sz-rate').value,comment:document.getElementById('sz-cm').value,proof:key,
        team:t.map(x=>({no:x.no,set:x.set||undefined}))});
      SEAS.list=null;toast('登録しました');seasonView(String(s.id))}
    catch(e){toast(e.message);send.disabled=false;send.textContent='登録する'}};
  el.scrollIntoView({block:'start',behavior:reduceMotion?'auto':'smooth'});
}
/* 「チーム画面のスクショから読み取る」：取り込みの画面へ行き、保存したらこのシーズンの登録欄に戻る（18-import.js の imSave） */
function szShotBind(s){const b=document.getElementById('sz-shot');if(b)b.onclick=()=>{IMPORT_NEXT='#/season/'+s.id;nav('#/import')}}
/* プロフィールに出す実績の印 */
const rankLabel=r=>r.rank?(r.rank<10?'最終1桁':r.rank<100?'最終2桁':r.rank<1000?'最終3桁':`最終${r.rank}位`)+`（${r.rank}位）`:`レート${r.rate}`;
const resultBadges=rs=>(rs||[]).length?`<div class="sz-badges">${rs.map(r=>`<span class="sz-badge${r.verified?' on':''}">${SVG(I.trophy,14)}<span data-notr>${esc(r.season)}</span> ${r.fmt==='double'?'ダブル':'シングル'} ${rankLabel(r)}${r.verified?'・確認済み':''}</span>`).join('')}</div>`:'';
/* ---- 自分のパーティと比べる：選出アシストと同じ計算（analyze）で、両方から見た最善の選出と、お互いに何%入るかを出す ----
   相手の育成は、登録されていればそれを使い、なければ「よくある型」を仮定する */
function szVs(t){
  const my=team.map(x=>x.no).filter(n=>byNo[n]),op=t.team.map(x=>x.no).filter(n=>byNo[n]);
  if(!my.length)return `<div class="bnote" style="margin:8px 0">先に<a href="#/team" style="color:var(--acc)">パーティ</a>を作ってください（いま選んでいるパーティと比べます）。</div>`;
  const opSet={};t.team.forEach(x=>{const c=cleanSet(x.set);if(c)opSet[x.no]=savedToCalc(x.no,c)});
  const opSF=n=>opSet[n]||detSet(byNo[n]);
  let A,P;try{A=analyze(my,op,mySetFor,opSF);P=analyze(op,my,opSF,mySetFor)}catch(e){return `<div class="bnote" style="margin:8px 0">計算できませんでした。</div>`}
  const d=A.full[0].s-P.full[0].s;
  const verdict=d>.08?['有利','sz-good','こちらの選出のほうが、お互いに最善を尽くしたときの点数が高くなりました。']:d<-.08?['不利','sz-bad','相手の選出のほうが点数が高くなりました。下の「気をつけたい相手」への対策を考えましょう。']:['五分','','お互いの点数がほぼ同じです。先発と立ち回りで差がつきます。'];
  const nmS=p=>esc(formInfo(p).base);
  const pick=A.best.map(i=>A.M[i].p),lead=A.lead.map(i=>A.M[i].p);
  const opPick=P.best.map(i=>P.M[i].p);
  /* こちらのだれも半分以上入らない相手・こちらの多くを一撃で倒せる相手 */
  const wall=A.O.map((o,j)=>({o,j,mx:Math.max(...A.M.map((_,i)=>A.D[i][j].pct))})).filter(x=>x.mx<50);
  const threat=A.O.map((o,j)=>({o,j,n:A.M.filter((_,i)=>A.R[j][i].pct>=100).length})).filter(x=>x.n>=Math.ceil(A.M.length/2)).sort((a,b)=>b.n-a.n);
  const cell=v=>{const r=Math.round(v);return `<td class="${r>=100?'k1':r>=50?'k2':''}">${r>=100?'確1':r+'%'}</td>`};
  const row=i=>`<tr><th>${A.best.includes(i)?'<i class="sz-star">★</i>':''}${nmS(A.M[i].p)}</th>${A.O.map((_,j)=>cell(Math.min(A.D[i][j].pct,999))).join('')}</tr>`;
  const rowR=j=>`<tr><th>${nmS(A.O[j].p)}</th>${order.map(i=>cell(Math.min(A.R[j][i].pct,999))).join('')}</tr>`;
  const headOf=ps=>`<thead><tr><th></th>${ps.map(p=>`<th><span class="av">${stamp(p)}</span><small>${nmS(p)}</small></th>`).join('')}</tr></thead>`;
  const order=[...A.best,...A.M.map((_,i)=>i).filter(i=>!A.best.includes(i))];
  return `<div class="sz-vsb">
    <div class="sz-vh"><b class="sz-vd ${verdict[1]}">${verdict[0]}</b><span>${esc(teamName(TEAMS.cur))} と比べた結果</span></div>
    <p class="sz-vp">${verdict[2]}</p>
    <p class="sz-vp"><b>おすすめの選出</b>：${pick.map(nmS).join('・')}（先発 ${lead.map(nmS).join('・')}）</p>
    <p class="sz-vp"><b>相手が選びそうな${PICK()}匹</b>：${opPick.map(nmS).join('・')}</p>
    ${threat.length?`<p class="sz-vp" style="color:var(--w2)"><b>気をつけたい相手</b>：${threat.slice(0,3).map(x=>`${nmS(x.o.p)}（こちらの${x.n}匹を一撃で倒せる）`).join('、')}</p>`:''}
    ${wall.length?`<p class="sz-vp" style="color:var(--w2)"><b>崩しにくい相手</b>：${wall.slice(0,3).map(x=>nmS(x.o.p)).join('・')}（こちらのだれも半分以上のダメージを与えられない）</p>`:''}
    <p class="sz-vp"><b>こちら → 相手</b>（左のポケモンが、上の相手に与えるダメージ）</p>
    <div class="sz-tw"><table class="sz-tb">${headOf(A.O.map(o=>o.p))}<tbody>${order.map(row).join('')}</tbody></table></div>
    <details class="sz-det"><summary>相手 → こちら（受けるダメージ）を見る</summary><div class="sz-tw"><table class="sz-tb">${headOf(order.map(i=>A.M[i].p))}<tbody>${A.O.map((_,j)=>rowR(j)).join('')}</tbody></table></div></details>
    <p class="note" style="padding:4px 0 0">表は、いちばんダメージの大きい技で、相手の最大HPの何%を削れるか（★はおすすめの選出。確1＝1回で倒せる）。相手の育成は${Object.keys(opSet).length?'登録されたもの（ないポケモンは「よくある型」）':'「よくある型」'}で計算しています。</p>
    <div class="btns" style="padding:8px 0 0"><button class="btn btn-s" data-goassist>選出アシストでくわしく見る</button></div></div>`;
}
/* 出典のリンク（アドレスの名前だけを出す。リンク先の評価はしない＝nofollow） */
const hostOf=u=>{try{return new URL(u).hostname.replace(/^www\./,'')}catch(e){return''}};
const srcLinks=us=>(us||[]).length?`<div class="sz-src">出典：${us.filter(u=>/^https?:\/\//.test(u)).map(u=>`<a href="${esc(u)}" target="_blank" rel="noopener nofollow ugc">${esc(hostOf(u))}</a>`).join('、')}</div>`:'';
