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
const SEAS={list:null};
async function seasonView(a){
  setHeader('シーズンの上位パーティ','#/tools');
  V.innerHTML='<p class="empty">読み込み中…</p>';
  const prof=await twAuth();if(keyOf(cur)!=='season')return;
  try{if(!SEAS.list)SEAS.list=(await authFetch('/api/seasons')).seasons}
  catch(e){V.innerHTML=`<div class="bnote" style="margin:16px">${esc(e.message)}</div>`;return}
  if(!SEAS.list.length){V.innerHTML='<p class="empty" style="padding:40px 24px">まだシーズンが登録されていません。<br>運営者がシーズンを登録すると、ここに上位のパーティが並びます。</p>';return}
  const s=SEAS.list.find(x=>x.id===+a)||SEAS.list[0];
  V.innerHTML=`<div class="pills sz-pills">${SEAS.list.map(x=>`<a class="pill" href="#/season/${x.id}" aria-pressed="${x.id===s.id}" data-notr>${esc(x.name)}</a>`).join('')}</div>
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
    body.innerHTML=(j.usage.length?`<div class="sec"><h2>よく使われたポケモン</h2><span style="font-size:12px;color:var(--dim)">${j.total}件の登録から</span></div>
      <div class="sz-use">${j.usage.filter(u=>byNo[u.no]).slice(0,12).map(u=>{const p=byNo[u.no];return `<a class="sz-u" href="#/p/${p.no}"><span class="av">${stamp(p)}</span><span class="sz-un">${esc(formInfo(p).base)}${formInfo(p).tag?`<i class="ftag ftag-${formInfo(p).kind}">${esc(formInfo(p).tag)}</i>`:''}</span><b>${u.pc}%</b></a>`}).join('')}</div>`:'')
      +`<div class="sec"><h2>パーティ</h2><span style="font-size:12px;color:var(--dim)">順位の高い順</span></div>`
      +(j.teams.length?j.teams.map(szCard).join(''):`<p class="empty" style="padding:28px 24px">${FMTN()}の登録はまだありません。<br>上位になったら、ぜひ登録してください。</p>`);
    body.querySelectorAll('[data-use]').forEach(b=>b.onclick=()=>{const t=j.teams.find(x=>x.id===+b.dataset.use);if(t)useTeam(`${s.name} ${t.rank?t.rank+'位':''}`.trim(),t.team)});
    body.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(!confirm('この登録を消します。よろしいですか？'))return;
      try{await authFetch(`/api/seasons/teams/${+b.dataset.del}/delete`,{});SEAS.list=null;toast('消しました');seasonView(String(s.id))}catch(e){toast(e.message)}});
  }catch(e){const b=document.getElementById('sz-body');if(b)b.innerHTML=`<div class="bnote" style="margin:16px">${esc(e.message)}</div>`}
}
function szCard(t){
  const mons=t.team.map(x=>({p:byNo[x.no],s:cleanSet(x.set)})).filter(x=>x.p);
  const who=t.player.handle?`<a href="#/u/${esc(t.player.handle)}" data-notr>${esc(t.player.name)}</a>`:`<span data-notr>${esc(t.player.name)}</span>`;
  return `<div class="sz-card">
    <div class="sz-h">${t.rank?`<b class="sz-rk">${t.rank}位</b>`:''}${t.rate?`<span class="sz-rt">レート ${t.rate}</span>`:''}<span class="sz-who">${who}</span>${t.verified?'<span class="atag on">確認済み</span>':''}</div>
    <div class="sz-mons">${mons.map(({p})=>`<a class="sz-m" href="#/p/${p.no}"><span class="av">${stamp(p)}</span><small>${esc(formInfo(p).base)}</small></a>`).join('')}</div>
    ${t.comment?`<p class="sz-c" data-notr>${esc(t.comment)}</p>`:''}
    ${mons.some(x=>x.s&&(x.s.it||x.s.mv.length))?`<details class="sz-det"><summary>育成を見る</summary>${mons.map(({p,s})=>`<div class="sz-set"><b>${nm(p,{no:false})}</b><span>${s?[s.it&&esc(s.it.n),s.ab&&esc(s.ab.n),s.up>0&&s.dn>0&&esc(natName(s.up,s.dn).replace(/（.*$/,''))].filter(Boolean).join('・'):''}</span><span>${s?s.mv.map(m=>esc(m.n)).join('・'):''}</span></div>`).join('')}</details>`:''}
    <div class="sz-a"><button class="btn btn-s" data-use="${t.id}">このパーティを使う</button>${t.mine?`<button class="bback" data-del="${t.id}" style="color:var(--w2)">登録を消す</button>`:''}</div></div>`;
}
/* 自分の結果を登録する欄（保存したパーティから選ぶ） */
function szForm(s,mine){
  const el=document.getElementById('sz-form');if(!el)return;
  const slots=TEAMS.list.map((x,i)=>({i,t:i===TEAMS.cur?team:x.team})).filter(x=>x.t.length);
  if(!slots.length){el.innerHTML=`<div class="bnote" style="margin:8px 16px">先に<a href="#/team" style="color:var(--acc)">パーティ</a>を作ってから登録してください。</div>`;return}
  let pick=slots.find(x=>x.i===TEAMS.cur)?TEAMS.cur:slots[0].i,proof=null;
  el.innerHTML=`<div class="sz-f"><div class="sec" style="padding-left:0"><h2>${esc(s.name)}・${FMTN()}の結果</h2></div>
    <div class="pills" style="padding:0 0 8px">${slots.map(x=>`<button class="pill" data-slot="${x.i}" aria-pressed="${x.i===pick}">${esc(teamName(x.i))}</button>`).join('')}</div>
    <div class="sz-mons" id="sz-pv" style="margin-bottom:10px"></div>
    <div class="cform" style="padding:0"><label>最終順位<input type="number" id="sz-rank" inputmode="numeric" min="1" placeholder="例：120" value="${mine&&mine.rank||''}"></label>
      <label>レート（わかれば）<input type="number" id="sz-rate" inputmode="numeric" min="1" placeholder="例：1850" value="${mine&&mine.rate||''}"></label>
      <label>ひとこと（140文字まで・なくてもよい）<textarea id="sz-cm" maxlength="140" rows="2" placeholder="例：初めての2桁！">${esc(mine&&mine.comment||'')}</textarea></label>
      <label>証拠のスクリーンショット（なくてもよい）<input type="file" id="sz-proof" accept="image/*"></label></div>
    <p class="note" style="padding:0 0 8px;color:var(--mute)">スクリーンショットは運営者だけが見ます（ほかの人には表示しません）。確かめられたら「確認済み」の印が付きます。保存したパーティの育成（技・持ち物など）も一緒に公開されます。</p>
    <div class="btns" style="padding:0 0 12px"><button class="btn btn-p" id="sz-send">登録する</button><button class="btn btn-s" id="sz-cancel">やめる</button></div></div>`;
  const pv=()=>{const t=slots.find(x=>x.i===pick).t;document.getElementById('sz-pv').innerHTML=t.map(x=>byNo[x.no]).filter(Boolean).map(p=>`<span class="sz-m"><span class="av">${stamp(p)}</span><small>${esc(formInfo(p).base)}</small></span>`).join('')};pv();
  el.querySelectorAll('[data-slot]').forEach(b=>b.onclick=()=>{pick=+b.dataset.slot;el.querySelectorAll('[data-slot]').forEach(x=>x.setAttribute('aria-pressed',x===b));pv()});
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
