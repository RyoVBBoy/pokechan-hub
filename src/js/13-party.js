/* ===================== パーティ診断 ===================== */
let team=[];
/* 図鑑の見直しで番号が変わったもの（旧670フラエッテ → えいえんのはな） */
const NO_MOVED={670:10061};
/* パーティは3つまで保存できる（pcteams：{cur:いま選んでいる番号, list:[{name,team}]}）。
   いま選んでいるパーティが team（ほかの画面はすべて team を使う）。pcteam は前の版との互換のために同じ中身を入れておく */
const TEAM_N=3;
const cleanTeam=a=>(Array.isArray(a)?a:[]).map(x=>x&&NO_MOVED[x.no]?{...x,no:NO_MOVED[x.no]}:x).filter(x=>x&&(byNo[x.no]||ensureMon(x.no)));
let TEAMS=(()=>{let o=null;try{o=JSON.parse(localStorage.getItem('pcteams')||'null')}catch(e){}
  if(!o||!Array.isArray(o.list)){let old=[];try{old=JSON.parse(localStorage.getItem('pcteam')||'[]')}catch(e){}o={cur:0,list:[{name:'',team:old}]}}
  while(o.list.length<TEAM_N)o.list.push({name:'',team:[]});o.list=o.list.slice(0,TEAM_N);if(!(o.cur>=0&&o.cur<TEAM_N))o.cur=0;
  o.list.forEach(s=>{s.team=cleanTeam(s.team);s.name=String(s.name||'').slice(0,20)});return o})();
team=TEAMS.list[TEAMS.cur].team.map(x=>({...x}));
const teamName=i=>TEAMS.list[i].name||L(`パーティ${i+1}`,`Team ${i+1}`);
const saveTeam=fromServer=>{TEAMS.list[TEAMS.cur].team=team;if(fromServer!==true){TEAMS.updated=Date.now();if(typeof teamSyncSoon==='function')teamSyncSoon()}try{localStorage.setItem('pcteams',JSON.stringify(TEAMS));localStorage.setItem('pcteam',JSON.stringify(team))}catch(e){}};
function switchTeam(i){if(i===TEAMS.cur||!TEAMS.list[i])return;saveTeam();TEAMS.cur=i;team=TEAMS.list[i].team.map(x=>({...x}));saveTeam()}
let tq='';
function addTeam(no){
  if(team.some(x=>x.no===no)){nav('#/team');return}
  if(team.length>=6){toast('パーティは6匹までです');return}
  team.push({no,sel:team.filter(x=>x.sel).length<PICK()});saveTeam();nav('#/team');
}
function teamView(arg){
  setHeader('パーティ');
  if(arg){const ids=[...new Set(arg.split('-').map(Number).filter(n=>byNo[n]))].slice(0,6);
    if(ids.length){team=ids.map((no,i)=>({no,sel:i<PICK()}));saveTeam();cur='#/team';setUrl('#/team')}}
  V.innerHTML=`
  <div class="pills tslots" id="tslots"></div><div id="tsync"></div>
  <p class="note" style="padding:6px 16px 12px">6匹まで登録し、<b>★で選出する${PICK()}匹</b>を決めます（${FMTN()}の形式）。</p>
  <div class="grid3" id="slots"></div>
  <div id="tsets"></div>
  <a class="row" href="#/import" style="border-top:1px solid var(--line);margin-top:12px"><div class="row-m"><div class="row-t">画像から取り込む</div><div class="row-s">ゲームのチーム画面のスクリーンショットから、技・持ち物・能力ポイントまで読み取る</div></div><span class="chev">${SVG(I.chev,18)}</span></a>
  <div class="btns">
    <button class="btn btn-p" id="shr">${SVG(I.share,17)}URLをコピー</button>
    <button class="btn btn-s" id="clr" style="flex:none;padding:0 20px">クリア</button></div>
  <div class="btns" style="padding-top:0"><button class="btn btn-s" id="tren">${SVG(I.list,16)}このパーティの名前を変える</button></div>


  <div id="tout"></div>
  <div class="sec"><h2>ポケモンを追加</h2></div>
  <div class="srch">${SVG(I.search,18)}<input id="tq" value="${tq}" placeholder="ポケモン名で検索" autocomplete="off" aria-label="追加するポケモンを検索"></div>
  <div id="tp" style="margin-top:8px"></div>`;
  document.getElementById('tq').oninput=e=>{tq=e.target.value;tpRender()};
  document.getElementById('shr').onclick=shareTeam;
  document.getElementById('clr').onclick=()=>{if(team.length&&!confirm(`「${teamName(TEAMS.cur)}」のポケモンをすべて外します。よろしいですか？`))return;team=[];saveTeam();teamRender()};
  document.getElementById('tren').onclick=()=>{const v=prompt('パーティの名前（20文字まで）',TEAMS.list[TEAMS.cur].name||teamName(TEAMS.cur));if(v==null)return;TEAMS.list[TEAMS.cur].name=v.trim().slice(0,20);saveTeam();teamRender()};
  document.getElementById('tslots').onclick=e=>{const b=e.target.closest('[data-tslot]');if(!b)return;switchTeam(+b.dataset.tslot);toast(`「${teamName(TEAMS.cur)}」に切り替えました`);teamRender()};
  teamRender();tpRender();syncBadge();if(PCF)teamSync();
}
function tpRender(){
  const q=tq.trim(),l=P.filter(p=>!q||nmHit(p,q)).slice(0,30);
  document.getElementById('tp').innerHTML=l.length?l.map(p=>
    `<button class="row" data-no="${p.no}" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line);text-align:left;color:inherit">
      <span class="av">${stamp(p)}</span><div class="row-m"><div class="row-t">${nm(p)}</div><div class="chips">${p.t.map(chip).join('')}<span class="rt">${p.roles.join('・')}</span></div></div>
      <div class="row-n"><b>${p.bst}</b><span>合計</span></div></button>`).join('')
    :'<p class="empty">見つかりません。</p>';
  document.querySelectorAll('#tp [data-no]').forEach(b=>b.onclick=()=>addTeam(+b.dataset.no));
}
function shareTeam(){
  if(!team.length){toast('パーティが空です');return}
  const u=location.href.split('#')[0]+'#/team/'+team.map(x=>x.no).join('-');
  (navigator.clipboard?navigator.clipboard.writeText(u):Promise.reject())
    .then(()=>toast('URLをコピーしました')).catch(()=>prompt('URLをコピーしてください',u));
}
function teamRender(){
  const ts=document.getElementById('tslots');
  if(ts)ts.innerHTML=TEAMS.list.map((s,i)=>`<button class="pill" data-tslot="${i}" aria-pressed="${i===TEAMS.cur}"><span data-notr>${esc(teamName(i))}</span><small>${(i===TEAMS.cur?team:s.team).length}${L('匹','')}</small></button>`).join('');
  document.getElementById('slots').innerHTML=Array.from({length:6},(_,i)=>{
    const x=team[i],p=x&&byNo[x.no];
    return p?`<div class="tile${x.sel?' on':''}" data-ti="${i}" style="cursor:pointer">
      <button class="t-rm" data-rm="${i}" aria-label="${p.n}を外す">${SVG(I.x,16)}</button>
      <span class="av" style="width:38px;height:38px">${stamp(p)}</span><div class="nm">${nm(p,{no:false})}</div><div class="tt">${p.t.map(t=>`<span style="background:${COL[t]};color:${ONC[t]}" title="${t}">${ticon(t,14)}</span>`).join('')}</div>
      <button class="t-sel${x.sel?' lit':''}" data-sel="${i}" aria-label="${p.n}を選出する" aria-pressed="${x.sel}">${SVG(I.star,16).replace('fill="none"',x.sel?'fill="currentColor"':'fill="none"')}<span>${x.sel?L('選出','Picked'):L('選出する','Pick')}</span></button></div>`
    :`<div class="tile empty">枠 ${i+1}</div>`}).join('');
  document.getElementById('tsets').innerHTML=team.length?`<div class="sec" style="padding-top:18px"><h2>育成</h2><span style="font-size:13px;color:var(--dim)">タップで編集</span></div>`+team.map((x,i)=>{const p=byNo[x.no],s=x.set;
    const sub=s&&s.sp?[`<div class="row-s">${[s.ab&&s.ab.n,s.it&&s.it.n,natName(s.up,s.dn)].filter(Boolean).map(esc).join('／')}</div>`,`<div class="row-s">${(s.mv||[]).filter(m=>m&&m.n).map(m=>esc(m.n)).join('・')}</div>`,`<div class="row-s" style="color:var(--mute)">${spLine(s.sp)}</div>`].join('')
      :`<div class="row-s" style="color:var(--mute)">${s?'能力ポイント未入力':'未設定'}（よくある型で計算中）</div>`;
    return `<a class="row" href="#/edit/${i}" style="align-items:flex-start;content-visibility:visible"><span class="av">${stamp(p)}</span><div class="row-m"><div class="row-t">${nm(p)}${s&&s.src==='manual'?'<span class="atag on" style="margin-left:6px">入力済み</span>':s&&s.sp?'<span class="atag" style="margin-left:6px">画像から</span>':''}</div>${sub}</div><span class="chev">${SVG(I.chev,18)}</span></a>`}).join(''):'';
  document.querySelectorAll('#slots .tile[data-ti]').forEach(t=>t.onclick=e=>{if(e.target.closest('button'))return;nav('#/edit/'+t.dataset.ti)});
  document.querySelectorAll('[data-sel]').forEach(b=>b.onclick=()=>{
    const x=team[+b.dataset.sel];
    if(!x.sel&&team.filter(y=>y.sel).length>=PICK()){toast(`${FMTN()}で選出できるのは${PICK()}匹までです`);return}
    x.sel=!x.sel;saveTeam();teamRender()});
  document.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{team.splice(+b.dataset.rm,1);saveTeam();teamRender()});

  const out=document.getElementById('tout');
  if(!team.length){out.innerHTML='<p class="empty">ポケモンを追加すると、パーティのチェックが始まります。</p>';return}
  const C=partyCheck(team);
  const item=(x,bad)=>`<div class="pc-i ${bad?'pc-fix':'pc-ok'}"><b>${bad?'！':'✓'} ${x.t}</b>${x.d?`<p>${x.d}</p>`:''}${x.how?`<p class="pc-how"><b>こうすると良くなる：</b>${x.how}</p>`:''}${x.c&&x.c.length?`<div class="pills gchips" style="padding:6px 0 0">${x.c.map(p=>`<a class="pill gchip" href="#/p/${p.no}">${esc(formInfo(p).base)}${formInfo(p).tag?'（'+esc(formInfo(p).tag)+'）':''}</a>`).join('')}</div>`:''}</div>`;
  out.innerHTML=`
  <div class="sec"><h2>パーティのチェック</h2></div>
  <p class="note" style="padding-top:0">${C.scope}を、タイプ相性（特性も入れて）・組み合わせ・持ち物・技・素早さの面から見ています。点数はつけず、気になる点にはそれぞれ直し方を書いています。</p>
  ${C.fix.length?`<h3 class="pc-h">気になる点（${C.fix.length}件）</h3>${C.fix.map(x=>item(x,true)).join('')}`:'<p class="note">いまのところ、大きく気になる点はありません。</p>'}
  ${C.good.length?`<h3 class="pc-h">よいところ</h3>${C.good.map(x=>item(x,false)).join('')}`:''}
  <div class="btns"><a class="btn btn-p" href="#/report">強み・弱み・警戒をくわしく見る</a></div>
  ${adSlot('診断結果下')}`;
}
/* ---- パーティのチェック：タイプだけでなく、組み合わせ・持ち物・技・素早さも見て、直し方を添える（点数はつけない） ---- */
function partyCheck(entries){
  /* 選出（★）が決まっていれば（${PICK()}匹）その匹で、決まっていなければパーティ全体で見る */
  const sel=entries.filter(x=>x.sel),full=sel.length===Math.min(PICK(),entries.length);
  const use=full?sel:entries;
  const scope=full?`★を付けた選出の${sel.length}匹（${FMTN()}）`:`パーティの${entries.length}匹全体（★を${PICK()}匹付けると、選出の${PICK()}匹で見ます${sel.length?`。いま★は${sel.length}匹`:''}）`;
  const allMs=entries.map(x=>({x,p:byNo[x.no]})).filter(o=>o.p);
  const ms=use.map(x=>({x,p:byNo[x.no]})).filter(o=>o.p);
  const inTeam=new Set(entries.map(x=>formInfo(byNo[x.no]||{n:''}).base));
  const ab=o=>o.x.set&&o.x.set.ab&&o.x.set.ab.k?[o.x.set.ab.k]:(ABD[o.p.no]||[]).map(a=>a[0]);
  const mvKeys=o=>((o.x.set&&o.x.set.mv)||[]).map(m=>m&&MD[m.id]&&MD[m.id][3]).filter(Boolean);
  const learns=(o,k)=>{const ls=LSD[o.p.no]?LSD[o.p.no][1]:[];return ls.some(id=>MD[id]&&MD[id][3]===k)};
  const hasSets=ms.some(o=>o.x.set&&o.x.set.mv&&o.x.set.mv.length);
  const good=[],fix=[];
  const names=a=>a.map(o=>esc(o.p.n)).join('・');
  /* 1. 弱点の重なり（特性も入れる） */
  const md=new Map(ms.map(o=>[o.p.no,monDef(o.p)]));
  const m=(o,t)=>md.get(o.p.no).find(z=>z.t===t).m;
  const rows=T.map(t=>({t,w:ms.filter(o=>m(o,t)>=2),r:ms.filter(o=>m(o,t)<1)}));
  const need=Math.max(2,Math.ceil(ms.length/2));
  const danger=rows.filter(r=>r.w.length>=need&&!r.r.length);
  const cands=types=>P.filter(p=>!inTeam.has(formInfo(p).base)&&types.every(t=>monDef(p).find(z=>z.t===t).m<1)).sort((a,b)=>b.bst-a.bst).slice(0,4);
  if(danger.length)danger.slice(0,2).forEach(r=>fix.push({t:`${r.t}技を受けられるポケモンがいない`,d:`${names(r.w)}の${r.w.length}匹が${r.t}技を弱点で受け、半減以下で受けられる味方がいません。${r.t}技を持つ相手に続けて押し込まれやすい形です。`,
    how:`${r.t}技を半減以下で受けられるポケモンを1匹入れるか、${r.t}技を使う相手を先に倒せる味方を用意します。候補：`,c:cands([r.t])}));
  else if(ms.length>=3)good.push({t:'弱点が大きく重なっていない',d:`${need}匹以上が同じ弱点で、受けられる味方もいない、というタイプはありません。`});
  /* 2. 攻撃の範囲：登録した技があればその技、なければタイプ一致技で */
  const atkTypes=o=>{const mv=((o.x.set&&o.x.set.mv)||[]).map(z=>z&&mvInfo(z.id)).filter(i=>i&&i.pow>0).map(i=>i.t);return mv.length?mv:o.p.t};
  const hits=new Set();ms.forEach(o=>atkTypes(o).forEach(a=>T.forEach(d=>{if(mult(a,[d])>=2)hits.add(d)})));
  const miss=T.filter(d=>!hits.has(d));
  if(miss.length>=3){const sub=[];
    ms.forEach(o=>{const ls=LSD[o.p.no]?LSD[o.p.no][1]:[];const best=ls.map(id=>({id,i:mvInfo(id)})).filter(z=>z.i&&z.i.pow>=70&&z.i.cls<2&&miss.some(d=>mult(z.i.t,[d])>=2)).sort((a,b)=>miss.filter(d=>mult(b.i.t,[d])>=2).length-miss.filter(d=>mult(a.i.t,[d])>=2).length||b.i.pow-a.i.pow)[0];
      if(best)sub.push(`${esc(o.p.n)}の${esc(mName(best.id))}（${best.i.t}）`)});
    fix.push({t:`効果ばつぐんを取れないタイプが${miss.length}タイプある`,d:`${hasSets?'登録した技':'タイプ一致の技'}では、${miss.join('・')}タイプの相手に効果ばつぐんを取れません。`,how:sub.length?`サブの技を入れると範囲が広がります。例：${sub.slice(0,3).join('、')}。`:'ほかのタイプの技を持つポケモンを入れます。'})}
  else good.push({t:'攻撃の範囲が広い',d:`${hasSets?'登録した技':'タイプ一致の技'}で、18タイプのうち${18-miss.length}タイプに効果ばつぐんを取れます。`});
  /* 3. 組み合わせ：天気・トリックルーム・物理/特殊の偏り */
  const setter=ms.filter(o=>ab(o).some(k=>WSET[k])),abuser=ms.filter(o=>ab(o).some(k=>WSPD[k]));
  setter.forEach(o=>{const w=WSET[ab(o).find(k=>WSET[k])];const ok=abuser.some(a=>ab(a).some(k=>WSPD[k]===w));
    if(ok)good.push({t:`天気（${GM_WN[w]}）の組み合わせがある`,d:`${esc(o.p.n)}が${GM_WN[w]}にし、${names(abuser.filter(a=>ab(a).some(k=>WSPD[k]===w)))}がその天気で速くなります。`})});
  abuser.forEach(o=>{const w=WSPD[ab(o).find(k=>WSPD[k])];if(setter.some(s=>ab(s).some(k=>WSET[k]===w))||ms.some(s=>mvKeys(s).includes({rain:'raindance',sun:'sunnyday',sand:'sandstorm',snow:'snowscape'}[w])))return;
    const inParty=allMs.filter(s=>!ms.includes(s)&&ab(s).some(k=>WSET[k]===w));
    if(inParty.length){fix.push({t:`${esc(o.p.n)}の特性が活きにくい`,d:`${esc(o.p.n)}は${GM_WN[w]}のときに素早さが2倍になりますが、選出に天気を${GM_WN[w]}にできる味方がいません。`,how:`パーティにいる${names(inParty)}を一緒に選出すると、組み合わせで強くなります。`});return}
    fix.push({t:`${esc(o.p.n)}の特性が活きにくい`,d:`${esc(o.p.n)}は${GM_WN[w]}のときに素早さが2倍になりますが、天気を${GM_WN[w]}にできる味方がいません。`,how:`天気を${GM_WN[w]}にする特性のポケモンを入れると、組み合わせで強くなります。候補：`,c:P.filter(p=>!inTeam.has(formInfo(p).base)&&(ABD[p.no]||[]).some(a=>WSET[a[0]]===w)).sort((a,b)=>b.bst-a.bst).slice(0,3)})});
  const trS=ms.filter(o=>hasSets?mvKeys(o).includes('trickroom'):false),slow=ms.filter(o=>o.p.s[5]<=50&&Math.max(o.p.s[1],o.p.s[3])>=100);
  if(trS.length&&slow.length)good.push({t:'トリックルームの組み合わせがある',d:`${names(trS)}がトリックルームを使い、遅くて強い${names(slow)}が先に動けます。`});
  else if(slow.length>=2&&!trS.length)fix.push({t:'遅いポケモンが多い',d:`${names(slow)}は遅いぶん、相手に先に攻撃されやすくなります。`,how:`トリックルームを使える味方を入れると、遅さが強みに変わります。${ms.filter(o=>learns(o,'trickroom')).length?`${names(ms.filter(o=>learns(o,'trickroom')))}も覚えられます。`:'候補：'}`,c:ms.some(o=>learns(o,'trickroom'))?[]:P.filter(p=>!inTeam.has(formInfo(p).base)&&LSD[p.no]&&LSD[p.no][1].some(id=>MD[id]&&MD[id][3]==='trickroom')).sort((a,b)=>(a.s[5]-b.s[5])||(b.bst-a.bst)).slice(0,3)});
  const phys=ms.filter(o=>o.p.s[1]>=o.p.s[3]+15).length,spec=ms.filter(o=>o.p.s[3]>=o.p.s[1]+15).length;
  if(ms.length>=3&&(phys===ms.length||spec===ms.length))fix.push({t:`${phys===ms.length?'物理':'特殊'}アタッカーばかり`,d:`全員が${phys===ms.length?'攻撃':'特攻'}で戦うので、${phys===ms.length?'いかく・おにび・リフレクター':'ひかりのかべ・特防の高い相手'}でまとめて止められやすくなります。`,how:`${phys===ms.length?'特殊':'物理'}で攻めるポケモンを1匹入れると、受けられにくくなります。`});
  /* 交代で受け合える組み合わせ（Aの弱点をBが、Bの弱点をAが半減以下で受けられる） */
  let pair=null;
  for(let a=0;a<ms.length;a++)for(let b=a+1;b<ms.length;b++){const A=ms[a],B=ms[b];
    const wa=T.filter(t=>m(A,t)>=2),wb=T.filter(t=>m(B,t)>=2);if(!wa.length||!wb.length)continue;
    const v=wa.filter(t=>m(B,t)<1).length/wa.length+wb.filter(t=>m(A,t)<1).length/wb.length;if(!pair||v>pair.v)pair={A,B,v,wa,wb}}
  if(pair&&pair.v>=1.4)good.push({t:`${esc(pair.A.p.n)}と${esc(pair.B.p.n)}が弱点を受け合える`,d:`${esc(pair.A.p.n)}の弱点（${pair.wa.join('・')}）の多くを${esc(pair.B.p.n)}が、${esc(pair.B.p.n)}の弱点（${pair.wb.join('・')}）の多くを${esc(pair.A.p.n)}が受けられます。不利な相手が出てきたら、交代で受け合えます。`});
  else if(ms.length>=3&&T.some(t=>m(ms[0],t)>=2))fix.push({t:'交代で受け合える組み合わせが少ない',d:'お互いの弱点を受け合える2匹がいないので、不利な相手が出てきたときに、交代で受けにくい形です。',how:`${esc(ms[0].p.n)}の弱点（${T.filter(t=>m(ms[0],t)>=2).join('・')||'なし'}）を受けられるポケモンを入れると、交代しやすくなります。候補：`,c:cands(T.filter(t=>m(ms[0],t)>=2))});
  /* 4. 持ち物（何を持たせているか） */
  const it=o=>o.x.set&&o.x.set.it&&o.x.set.it.k;
  const megas=ms.filter(o=>it(o)&&isStone(it(o)));
  if(megas.length>=2)fix.push({t:'メガストーンが2匹以上',d:`メガシンカできるのは1試合に1匹だけです（${names(megas)}）。`,how:'メガシンカさせる1匹を決め、ほかの1匹には別の持ち物を持たせると、持ち物の効果をむだにしません。'});
  ms.forEach(o=>{const k=it(o);if(!k)return;const mv=mvKeys(o);
    if(/^choice/.test(k)&&mv.some(z=>[...GM_PSET,...GM_SSET,...GM_BSET].includes(z)))fix.push({t:`${esc(o.p.n)}：こだわり系と積み技`,d:`${esc(ITEMN[k])}を持つと最初に選んだ技しか出せないので、積み技を使うと攻撃できなくなります。`,how:'積み技を外して攻撃技にするか、持ち物をいのちのたまなどに変えます。'});
    if(k==='assaultvest'&&mv.some(z=>{const id=Object.keys(MD).find(i=>MD[i][3]===z);const i=id&&mvInfo(+id);return i&&i.cls===2}))fix.push({t:`${esc(o.p.n)}：とつげきチョッキと変化技`,d:'とつげきチョッキを持つと、変化技（攻撃しない技）が使えません。',how:'変化技を攻撃技に変えるか、持ち物を変えます。'});});
  const items=ms.map(it).filter(Boolean);
  if(items.length>=3&&new Set(items).size===items.length)good.push({t:'持ち物が分かれている',d:`${items.length}匹の持ち物が重なっていません。`});
  if(!items.length&&ms.length)fix.push({t:'持ち物がまだ決まっていない',d:'育成で持ち物を入れると、こだわり系・メガストーンなどを含めてチェックできます。',how:'パーティの「育成」から、それぞれの持ち物を入れます（画像から取り込むこともできます）。'});
  /* 5. 素早さ：先に動く手段があるか */
  const fastest=Math.max(...ms.map(o=>maxSpe(o.p)));
  const scarf=ms.some(o=>it(o)==='choicescarf'),prio=ms.some(o=>((o.x.set&&o.x.set.mv)||[]).some(z=>{const i=z&&mvInfo(z.id);return i&&i.pri>0&&i.pow>0}));
  const tw=ms.some(o=>mvKeys(o).includes('tailwind'));
  if(fastest>=165)good.push({t:'速いポケモンがいる',d:`いちばん速いポケモンは最速で${fastest}。多くの相手より先に動けます。`});
  else if(!scarf&&!prio&&!tw&&!trS.length)fix.push({t:'先に動く手段が少ない',d:`いちばん速いポケモンでも最速で${fastest}で、速い相手には先に攻撃されます。`,how:'こだわりスカーフ・先制技（でんこうせっか など）・おいかぜ・トリックルームのどれかを用意すると、速い相手にも対応しやすくなります。'});
  if(ms.length<entries.length||entries.length<6){}
  return{scope,good,fix};
}

