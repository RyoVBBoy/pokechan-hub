/* ===================== このパーティの戦い方（2026/11/15 依頼主「Party Evaluation Redesign」） =====================
   チェックタブの最初に「戦い方・強み・おすすめの選出・戦い方の流れ」を出す。新しい判定・点の重みは作らない：
   ・戦い方の型＝teamArch（天気・トリックルーム・おいかぜ・teamKind）。決まらなければ「まだはっきりしない」とだけ書き、型を作らない
   ・強み＝dgTeam の1対1の結果（上から倒せる数・安定して受けられる数・◎の数）と、天気／トリックルームの仲間、partyCheck の「弱点を受け合える」
   ・おすすめの選出＝dgSelect の1番（使用率の上位の相手に対する基本の選出。いつも最適とは限らないと書く）
   ・戦い方の流れ＝selPlan の先発・残り・詰め役（finWhy）。詰め役の理由がなければ、そう書く
   メガストーンを持つ匹が2匹以上なら、dgTeam0 と同じく1匹だけメガシンカした場合で計算（選び方の札もここに出す）。
   「メガシンカしない場合」は押したときだけ dgTeam1(…,-1) で別に計算し、上の結果には混ぜない */
const ST_APPROACH={
  sun:'天気を晴れにして、得をする仲間で攻める',rain:'天気を雨にして、得をする仲間で攻める',sand:'天気を砂嵐にして、得をする仲間で攻める',snow:'天気を雪にして、得をする仲間で攻める',
  tr:'トリックルームを張り、遅いポケモンから先に攻撃する',tailwind:'おいかぜで味方を速くして、先に攻撃する',
  tm:'1匹ずつ、有利な相手に出して倒していく（対面）',ac:'交代をくり返しながら、攻撃役で削っていく（攻めのサイクル）',dc:'硬いポケモンで受けながら、少しずつ削っていく（受けのサイクル）',su:'場を整えてから、能力を上げたエースで一気に倒す（積み）'};
const ST_SUP={trickroom:'トリックルーム',tailwind:'おいかぜ',reflect:'リフレクター',lightscreen:'ひかりのかべ',auroraveil:'オーロラベール',stealthrock:'ステルスロック',spikes:'まきびし'};
/* 天気の型で、得をする仲間がいないときは「攻める」と言わない（型をつくらない） */
function stApproach(a,W){if(a.unset)return 'トリックルームを登録したときに使える戦い方の候補';if(['sun','rain','sand','snow'].includes(a.k)&&W&&W.k===a.k&&!W.gain.length)return `天気を${ARCH_BADGE[a.k][0]}にできる（いまは${ARCH_BADGE[a.k][0]}で得をする仲間がいません）`;return ST_APPROACH[a.k]||''}
const stList=(a,f,k)=>a.slice(0,k||4).map(f).join('・')+(a.length>(k||4)?` など${a.length}匹`:'');
function stHTML(){return `<div id="st-box" class="stg-card"><p class="dgu-loading">このパーティの戦い方をまとめています…</p></div>`}
/* 1匹ずつの、上位の相手に対する数（dgTeam の res から。判定は dgAnalyze・dgSelect と同じ基準） */
function stMemStats(T){
  return T.ms.map((o,i)=>{const z=T.rows.map(r=>({q:r.q,z:r.res.find(x=>x.i===i)})).filter(y=>y.z);
    return{i,ko:z.filter(y=>y.z.k==='ko_fast'),adv:z.filter(y=>y.z.r>=4),
      safe:z.filter(y=>y.z.swIn==='win')}});
}
const stNames=(a,k)=>a.slice(0,k||3).map(y=>esc(y.q.n)).join('・')+(a.length>(k||3)?'など':'');
function stStrengths(T,W){
  if(!T.rows.length)return [];
  const N=T.rows.length,nm=i=>`<b>${esc(T.ms[i].p.n)}</b>`,out=[],used=new Set();
  /* ① 戦い方の型に合う強み（天気で得をする仲間・トリックルーム） */
  if(W&&W.gain.length)out.push({k:'wx',t:`${esc(W.by)}の${esc(ABN[W.ab]||'特性')}で${esc(ARCH_BADGE[W.k][0])}になり、${W.gain.map(n=>`<b>${esc(n)}</b>`).join('・')}が得をする`,
    how:`${esc(W.by)}を早めに出して天気を作り、${W.gain.map(esc).join('・')}で攻める。${W.guess?'（特性が未登録なので、この特性と仮定しています）':''}`});
  const trFast=(T.tr?.slow||[]).filter(i=>T.rows.some(r=>r.resTR?.some(z=>z.i===i&&z.spd===1)));
  if(T.tr?.on&&trFast.length>=2)out.push({k:'tr',t:`${T.tr.setters.map(s=>nm(s.i)).join('・')}がトリックルームを張れた場合、${stList(trFast,nm)}が先に動ける対面がある`,
    how:`${T.tr.setters.map(s=>esc(T.ms[s.i].p.n)).join('か')}でトリックルームを張れたら、その間に${trFast.slice(0,2).map(i=>esc(T.ms[i].p.n)).join('・')}で攻める。${T.tr.unset?'（いまの技にトリックルームが入っていません。入れると、この戦い方ができます）':''}`});
  /* ② 上から倒せる攻撃役・安定して受けられる匹（それぞれ上位の4分の1以上のときだけ） */
  const S=stMemStats(T),q4=Math.max(3,Math.ceil(N/4));
  const a=[...S].sort((x,y)=>y.ko.length-x.ko.length||x.i-y.i)[0];
  if(a&&a.ko.length>=q4){used.add(a.i);out.push({t:`${nm(a.i)}は、比較対象${N}匹のうち${a.ko.length}匹を先に倒せる`,how:`相手に${stNames(a.ko)}がいたら、${esc(T.ms[a.i].p.n)}を出して先に倒せる対面を使う。`})}
  const d=[...S].filter(x=>!used.has(x.i)).sort((x,y)=>y.safe.length-x.safe.length||x.i-y.i)[0];
  if(d&&d.safe.length>=q4)out.push({t:`${nm(d.i)}は、上位${N}匹のうち${d.safe.length}匹に後出しして勝てる`,how:`${stNames(d.safe)}には、計算時と同じHP・場の条件で${esc(T.ms[d.i].p.n)}に交代できる。`});
  /* ③ 相手の多くに2匹以上で対応できる */
  const st=T.rows.filter(r=>r.lvl===4).length;
  if(st>=Math.ceil(N/2)){const c={};T.rows.filter(r=>r.lvl===4).forEach(r=>r.stable.forEach(z=>c[z.i]=(c[z.i]||0)+1));
    const top=Object.keys(c).map(Number).sort((x,y)=>c[y]-c[x]||x-y).slice(0,3);
    out.push({t:`上位${N}匹のうち${st}匹に、2匹以上で安定して対応できる（${top.map(nm).join('・')}が中心）`,how:`相手の6匹を見て、${top.map(i=>esc(T.ms[i].p.n)).join('・')}から有利なポケモンを選べば、選出で迷いにくい。`})}
  return out.slice(0,3);
}
function stWx(T){
  const w=T.weather;
  if(!w)return null;
  const gain=T.M.filter(m=>m&&(WX_GAIN[w.k]||[]).includes(m.ab)).map(m=>m.p.n);
  return {...w,gain};
}
// 上部カード・選出画面・下書きで、実際に選んだ対面を共通の根拠にする。
function stSelectionFlow(P0,entries){
  const B=P0.DS.best,lead=P0.lead,pn=i=>byNo[entries[i].no].n;
  const back=B.c.filter(i=>!lead.includes(i));
  const adv=B.rows.filter(row=>row.zs.some(z=>lead.includes(z.i)&&z.r>=4)).slice(0,3).map(row=>row.r.q.n);
  const watch=B.rows.filter(row=>!row.zs.some(z=>lead.includes(z.i)&&z.r>=4));
  const switches=watch.flatMap(row=>{
    const matchups=row.zs.filter(z=>back.includes(z.i)&&z.swIn==='win');
    return matchups.length?[{opponent:row.r.q,choices:matchups.map(z=>z.i),matchups}]:[];
  });
  const risky=watch.filter(row=>!row.zs.some(z=>back.includes(z.i)&&z.swIn==='win')).slice(0,2).map(row=>row.r.q.n);
  const head=`先発候補は${lead.map(pn).join('・')}。${adv.length?`対面で有利な相手の例は${adv.join('・')}。`:'先発で有利と判定できた相手は見つかりませんでした。'}`;
  const mega=B.megaI>=0?`この選出は${P0.DS.megaNm(B.megaI)}を使う場合の評価です。`
    :P0.DS.H.length?'この選出はメガシンカなしで評価しています。':'';
  const setup=B.trUse?`${B.tr.setters.filter(s=>B.c.includes(s.i)).map(s=>pn(s.i)).join('・')}でトリックルームを張れた場合は、場が有効な間に攻めます。`
    :B.weather?`${B.weather.by}が${ARCH_BADGE[B.weather.k][0]}を作れた場合は、天候が有効な間に攻めます。`:'';
  const mid=switches.slice(0,3).map(x=>`${x.opponent.n}には${x.matchups.map(z=>pn(z.i)+'の'+z.me.mvn).join('／')}が後出しから倒し切る候補。`).join('')+
    (switches.length?'計算と同じHP・場の条件が前提です。':watch.length?'先発が有利を取れない相手への、後出しで勝てる控えは見つかりませんでした。':'比較した相手には、先発候補のいずれかが対面で有利です。')+
    (risky.length?`${risky.join('・')}は後出しで勝てる控えがいないため、選出や先発を見直す候補です。`:'');
  const reason=P0.finWhy&&{prio:'先制技',scarf:'持ち物',setup:'積み技'}[P0.finWhy[0]];
  const fin=reason?{n:pn(P0.finisher),t:`${reason}の${P0.finWhy[1]}`}:null;
  const end=fin?`終盤の候補は${fin.n}。 ${fin.t}を使える場面で、相手を倒せるHPまで削れているか確認します。`:'終盤の候補を決める根拠が足りません。残った相手のHPと先に動けるかを確認します。';
  return {sel:B.c.map(pn),ld:lead.map(pn),adv,fin,switches,steps:[['序盤',head+mega+setup],['中盤',mid],['終盤',end]]};
}
function stFill(entries){
  const box=document.getElementById('st-box');if(!box)return;
  let T,P0=null;
  try{T=dgTeam(entries,20)}catch(e){box.innerHTML='<p class="stg-p" role="status">戦い方の判定に必要な計算を完了できませんでした。</p>';return}
  const N=T.rows.length;
  try{P0=selPlan(entries)}catch(e){}
  const arch=(()=>{try{return teamArch(entries,T)}catch(e){return []}})(),W=stWx(T);
  const nmE=i=>esc(byNo[entries[i].no].n);
  /* 推定の匹（技を登録していない匹は、使用率の高い型か自動の型で計算） */
  const guess=entries.filter(x=>!(x.set&&(x.set.mv||[]).some(m=>m&&m.id))).map(x=>byNo[x.no]?.n||String(x.no));
  /* 1. 戦い方 */
  const sec1=`<div class="stg-sec"><h3>このパーティの戦い方</h3>
    ${arch.length?`<ul class="stg-arch">${arch.map(a=>`<li><a class="tarch-b tarch-${a.k}${a.unset?' tarch-unset':''}" href="#/arch/${ARCH_BADGE[a.k][1]}">${esc(ARCH_BADGE[a.k][0])}</a><span><b>${esc(stApproach(a,W))}</b><small>${esc(a.why)}</small></span></li>`).join('')}</ul>`
      :`<p class="stg-p">まだはっきりした型（天気・トリックルーム・対面・サイクルなど）は見つかっていません。${entries.filter(x=>x.set).length<3?'技・持ち物を3匹以上登録すると、対面・サイクル・積みも判定します。':'下の強みと選出から、戦い方を組み立ててみてください。'}</p>`}
    ${typeof dgMegaBarHTML==='function'?dgMegaBarHTML(T):''}
    ${T.mega&&T.mega.holders&&T.mega.holders.length?`<details class="stg-nomega" id="stg-nomega"><summary>メガシンカしない場合と比べる</summary><div class="stg-nm-b"><p class="dgu-loading">開くと計算します</p></div></details>`:''}
    <p class="stg-f">${FMTN()}・${N?`パーティ全体を${esc(T.opponentSource)}${N}匹と1匹ずつ比較した結果です。`:'比較できる相手がいないため、対面の判定を保留しています。'}${guess.length?`育成の技を登録していない${guess.slice(0,4).map(esc).join('・')}${guess.length>4?' など':''}は、推定の型で計算した<b>推定</b>です。`:''}${FMT==='double'?DG_DOUBLE_SCOPE+DG_DOUBLE_LIMITS:''}</p></div>`;
  /* 2. 強み */
  const G=stStrengths(T,W);
  const sec2=`<div class="stg-sec"><h3>パーティの強み</h3>${G.length?`<p class="stg-f">パーティ全体の評価です。トリックルーム中の強みは条件付きで示します。</p><ol class="stg-gl">${G.map(g=>`<li><p class="stg-gt">${g.t}</p><p class="stg-gh"><span>使い方</span>${g.how}</p></li>`).join('')}</ol>`
    :'<p class="stg-p">計算では、目立った強みはまだ見つかりませんでした。下の「気をつけたい相手・場面」と改善案から、少しずつ整えていきましょう。</p>'}</div>`;
  /* 3. おすすめの選出と先発 */
  const DS=P0&&P0.DS,B=DS&&DS.best;
  const flow=B?stSelectionFlow(P0,entries):null;
  let sec3='';
  if(B){
    const ld=B.pairs?B.pairs[0].pr:[B.lead1[0].i];
    const roleOf=i=>{const r=[];if(ld.includes(i))r.push('先発');if(B.atk.includes(i))r.push('上から倒す');if(B.rows.some(row=>row.zs.some(z=>z.i===i&&z.swIn==='win')))r.push('後出し候補');
      const s=B.sup.find(x=>x.i===i);if(s)r.push(s.k.map(k=>ST_SUP[k]).join('・'));if(P0.finisher===i&&P0.finWhy)r.push('詰め役');return r};
    const order=[...ld,...B.c.filter(i=>!ld.includes(i))];
    sec3=`<div class="stg-sec"><h3>おすすめの選出と先発</h3>
      <ul class="stg-sel">${order.map(i=>{const l=B.lead1.find(x=>x.i===i),r=roleOf(i);
        return `<li${ld.includes(i)?' class="stg-lead"':''}><b>${nmE(i)}</b>${r.length?`<span class="stg-rl">${r.map(t=>`<i>${esc(t)}</i>`).join('')}</span>`:''}<small>${l&&l.adv.length?`有利に戦える相手 ${l.adv.length}匹（${l.adv.slice(0,3).map(y=>esc(y.x.r.q.n)).join('・')}${l.adv.length>3?' など':''}）`:'有利と判定できた相手はありません'}</small></li>`}).join('')}</ul>
      <p class="stg-f">${esc(DS.T.opponentSource)}${DS.N}匹を相手にした<b>基本の選出</b>です（${DS.list.length}通りを比べた1番。◎${B.cnt[4]}・○${B.cnt[3]}）。いつも最適とは限らないので、相手の6匹を見て変えてください。${B.pairs?DG_DOUBLE_SCOPE:''}</p>
      ${(()=>{const notes=[];const inC=n=>B.c.some(i=>byNo[entries[i].no].n===n);
        if(B.weather)notes.push(`${esc(ARCH_BADGE[B.weather.k][0])}は${esc(B.weather.by)}が作った場合を、該当する対面に反映しています${B.weather.guess?'（特性は推定）':''}。`);
        else if(W&&W.gain.length&&!inC(W.by))notes.push(`この選出には${ARCH_BADGE[W.k][0]}を作る${esc(W.by)}が入っていません。${ARCH_BADGE[W.k][0]}で戦うなら、${esc(W.by)}と${W.gain.map(esc).join('・')}を入れた選出も比べてください。`);
        if(T.tr&&T.tr.on&&!T.tr.setters.some(t=>B.c.includes(t.i)))notes.push(`この選出にはトリックルームを張れるポケモン（${T.tr.setters.map(t=>esc(T.ms[t.i].p.n)).join('・')}）が入っていません。トリックルームで戦うなら、張る役を入れた選出も比べてください。`);
        return notes.map(t=>`<p class="stg-warn">${t}</p>`).join('')})()}
      <div class="stg-btns">${(()=>{const sel=entries.map((x,i)=>x.sel?i:-1).filter(i=>i>=0);return sel.length===B.c.length&&B.c.every(i=>sel.includes(i))?'<span class="stg-done">✓ いま選出にしている組み合わせです</span>':`<button class="btn btn-p" data-stg-sel="${B.c.join(',')}">この組み合わせを選出にする</button>`})()}
        <button class="dgu-link" data-dgu-tab="plan">選出の理由・ほかの選出と比べる</button></div></div>`;
  }else sec3=`<div class="stg-sec"><h3>おすすめの選出と先発</h3><p class="stg-p">${P0?.issue?esc(P0.issue):`選出を比べるには、選出する数（${PICK()}匹）より多くポケモンを入れてください。`}</p></div>`;
  /* 4. 戦い方の流れ */
  const steps=flow?.steps||[];
  const sec4=flow?`<div class="stg-sec"><h3>戦い方の流れ（目安）</h3><ol class="stg-flow">${steps.map(([h,t])=>`<li><span class="stg-ph">${h}</span><p>${esc(t)}</p></li>`).join('')}</ol>
    <p class="stg-f">表示した選出の対面から組み立てた目安です。実際の相手の型や残りHP、場の条件を確認してください。</p></div>`:'';
  /* 自動の文（書きこみの下書き・投稿に使う。文字だけ） */
  const autoTp=arch.map(a=>a.k).filter(k=>ST_TYPE[k]);
  ST_LAST={entries,flow,G,sig:mpSig()};
  const auto={tp:autoTp.join(','),arch:stTpLabel(autoTp,''),style:stTpDraft(autoTp,entries,flow),
    str:stStrDraft(autoTp,G),plan:steps.map(([h,t])=>`${h}：${stTx(t)}`).join('\n')};
  ST_LAST.auto=auto;
  const own=stOwn(),has=ST_KEYS.some(k=>own[k]);
  box.innerHTML=`<div class="dgu-head"><h2>このパーティの戦い方</h2><span class="dgu-fmt">${FMTN()}</span></div>
    <div class="stg-acts"><button class="btn btn-s" data-stg-edit>${has?'✎ 書いた戦い方を編集':'✎ 自分の言葉で書く'}</button><button class="btn btn-s" data-stg-post>この戦い方を投稿する</button></div>
    ${has?stOwnHTML(own,auto):''}
    ${has?'<p class="stg-autol">自動の診断（計算から）</p>':''}
    ${sec1.replace('<h3>このパーティの戦い方</h3>','<h3>戦い方の型</h3>')}${sec2}${sec3}${sec4}`;
  stBind(box);
  if(typeof dgMegaBind==='function')dgMegaBind(box);
  box.querySelectorAll('[data-dgu-tab]').forEach(b=>b.onclick=()=>ttJump(b.dataset.dguTab,'sel-box'));
  const stamp=teamActionStamp(entries);
  const sb=box.querySelector('[data-stg-sel]');if(sb)sb.onclick=()=>{if(!sb.isConnected||!teamActionCurrent(stamp))return;const c=sb.dataset.stgSel.split(',').map(Number);entries.forEach((x,i)=>x.sel=c.includes(i));saveTeam();toast('この組み合わせを選出にしました');const y=scrY();teamRender();scrTo(0,y)};
  const nmD=box.querySelector('#stg-nomega');if(nmD)nmD.addEventListener('toggle',()=>{if(!nmD.open||nmD.dataset.done)return;nmD.dataset.done=1;setTimeout(()=>{if(nmD.isConnected&&teamActionStamp()===stamp)stNoMegaFill(entries,T,nmD)},20)});
}
/* メガシンカしない場合：メガストーンを持つ匹は全員メガシンカしない姿（持ち物なし）で、同じ相手と計算し直す。上の結果とは別に並べるだけ */
function stNoMegaFill(entries,T,el){
  const b=el.querySelector('.stg-nm-b');
  try{
    const opponents=T.rows.map(r=>r.from);
    const T0=impWith(entries,()=>dgTeam0(entries,opponents.length,{noMega:true,opponents}));
    if(T0.rows.length!==opponents.length||T0.rows.some((r,i)=>r.from!==opponents[i]))throw Error('opponents changed');
    const a=dgMetric(T),z=dgMetric(T0);
    const row=(l,x,y,low)=>`<tr><th>${l}</th><td>${x}匹</td><td>${y}匹</td><td>${x===y?'同じ':((low?y<x:y>x)?'メガなしの方が良い':'メガありの方が良い')}</td></tr>`;
    b.innerHTML=`<table class="stg-nmt"><thead><tr><th></th><th>メガシンカあり</th><th>なし</th><th></th></tr></thead><tbody>${row('◎ 安定して対応',a.st,z.st,false)}${row('答えがない相手',a.x,z.x,true)}${row('△以下の相手',a.w,z.w,true)}${row('後出しできない相手',a.nosw,z.nosw,true)}</tbody></table><p class="stg-f">メガストーンを持つポケモンを、メガシンカしない姿（持ち物なし）で同じ相手${opponents.length}匹と計算しました。「メガシンカあり」はパーティ全体の診断で選んだメガシンカです。</p>`}
  catch(e){b.innerHTML='<p class="stg-p">計算できませんでした。</p>'}
}

/* ===================== 自分の言葉で書く・投稿する（2026/11/15 依頼主：自動の診断に、こだわりのある人が書き加えて投稿できるのがサイトの強み） =====================
   保存先はパーティの戦術メモと同じ MEMO.party[枠].s（arch 型・style 戦い方・str 強み・plan 流れ）。ログイン中はサーバーと同期（/api/me/memo）。
   下書き（自動の文）のまま変えていない項目は保存しない＝パーティを変えれば自動の文も新しくなる。計算（選出など）は変えない */
const ST_KEYS=['tp','arch','style','str','plan'];
const ST_FIELDS=[['style','戦い方','序盤・中盤・終盤に、どのポケモンで何をするか'],['str','強み','この6匹だから生まれる強みと、その活かし方'],['plan','戦い方の流れ（前に書いたもの）','']];
let ST_LAST=null;
const stTx=h=>{const d=document.createElement('div');d.innerHTML=String(h);return d.textContent.trim()};
const stOwn=()=>{const s=mpOf();const o={};ST_KEYS.forEach(k=>{if(s[k])o[k]=s[k]});return o};
function stSaveOwn(o){const k=mpKey(),e=MEMO.party[k]||{s:{}};const s={...(e.s||{})};ST_KEYS.forEach(x=>{if(o[x])s[x]=o[x];else delete s[x]});
  MEMO.party[k]={s,at:Date.now(),sig:mpSig()};memoSave()}
const stLines=t=>esc(t).replace(/\n/g,'<br>');
/* ===================== 戦い方の型の選び方（2026/11/15 依頼主「Improve Battle Strategy Type Selection」） =====================
   3つの分類（天気・フィールド／素早さの操作・展開／構築の方針）＋「その他」「明確な型なし」。いくつでも選べて、1つをメインにできる。
   保存は MEMO.party[枠].s.tp＝"メイン,ほか,…"（id の並び。先頭がメイン）と、その他の名前 arch（40字）。
   自動で見つけた型（teamArch）ははじめから選んだ状態で、外したり足したりできる。足りない根拠で型を決めない（自動で見つからなければ何も選ばない）。
   根拠（stTpEv）は 登録した技・特性＝確認済み／覚えられる・持てるだけ＝未確認（仮定）を分けて出す。ない役は「見つかりません」と書く */
const ST_CATS=[['wx','天気・フィールド'],['spd','素早さの操作・展開'],['team','構築の方針'],['etc','そのほか']];
const ST_TYPES=[
  {id:'rain',c:'wx',l:'雨',ab:['drizzle'],mv:['raindance'],gain:'rain'},
  {id:'sun',c:'wx',l:'晴れ',ab:['drought'],mv:['sunnyday'],gain:'sun'},
  {id:'sand',c:'wx',l:'砂嵐',ab:['sand-stream'],mv:['sandstorm'],gain:'sand'},
  {id:'snow',c:'wx',l:'雪',ab:['snow-warning'],mv:['snowscape','chillyreception'],gain:'snow'},
  {id:'tr',c:'spd',l:'トリックルーム',mv:['trickroom']},
  {id:'tailwind',c:'spd',l:'おいかぜ',mv:['tailwind']},
  {id:'spd',c:'spd',l:'その他の素早さ操作',mv:['icywind','electroweb','thunderwave','scaryface','rocktomb','bulldoze','stickyweb','glare','nuzzle'],ap:'相手の素早さを下げて、味方が先に動けるようにする'},
  {id:'tm',c:'team',l:'対面構築'},
  {id:'ac',c:'team',l:'攻めサイクル',mv:['uturn','voltswitch','flipturn','partingshot','shedtail']},
  {id:'dc',c:'team',l:'受けサイクル',mv:['recover','roost','slackoff']},
  {id:'su',c:'team',l:'積み展開',mv:['swordsdance','dragondance','nastyplot','calmmind','bulkup','quiverdance','shellsmash']},
  {id:'scr',c:'team',l:'壁展開',mv:['reflect','lightscreen','auroraveil'],ap:'壁で受けるダメージを減らし、そのあいだに味方で攻める'},
  {id:'ctl',c:'team',l:'妨害・コントロール',mv:['taunt','encore','willowisp','toxic','sleeppowder','hypnosis','yawn','disable','trick','haze','roar','whirlwind','fakeout'],ap:'状態異常や技の制限で、相手のしたいことをさせない'},
  {id:'other',c:'etc',l:'その他'},
  {id:'none',c:'etc',l:'明確な型なし',ap:'型は決めず、相手に合わせて選出と立ち回りを変える'}];
const ST_TYPE=Object.fromEntries(ST_TYPES.map(t=>[t.id,t]));
const ST_MVID=(()=>{let m=null;return k=>{if(!m){m={};Object.keys(MD).forEach(i=>m[MD[i][3]]=+i)}return m[k]}})();
const stTpParse=v=>[...new Set(String(v||'').split(',').map(x=>x.trim()).filter(x=>ST_TYPE[x]))];
/* 表示の名前（2026/11/15 依頼主「型・名前を別のものとして」）：メイン・サブ・名前を分けて書く。
   1つだけ＝「雨」、2つ以上＝「メイン：雨・サブ：壁展開」、名前があれば「雨パ・スタンダード（メイン：雨・サブ：壁展開）」 */
const stTpL=id=>ST_TYPE[id]?ST_TYPE[id].l:'';
function stTpLabel(tp,name){
  const t=tp.length>1?`メイン：${stTpL(tp[0])}・サブ：${tp.slice(1).map(stTpL).join('・')}`:tp.length?stTpL(tp[0]):'';
  return name?(t?`${name}（${t}）`:name):t;
}
/* 根拠：パーティの中で、その型の役になれるポケモン。reg＝登録した技・特性・メガストーン（確認済み）、can＝覚えられる／持てるだけ（未確認）。
   regN・canN はポケモンの名前だけ。覚えられることは、実際にその技を使うことを意味しない */
function stTpEv(id,entries){
  const t=ST_TYPE[id],reg=[],can=[],regN=[],canN=[];if(!t||(!t.mv&&!t.ab))return null;
  const abOf=set=>set&&set.ab?(set.ab.k||(typeof set.ab==='string'?set.ab:null)):null;
  entries.forEach(x=>{const p=byNo[x.no];if(!p)return;const nm=formInfo(p).base,set=x.set||{},r=[],c=[];
    const mv=(set.mv||[]).filter(m=>m&&m.id).map(m=>m.id),ls=lsOf(p);
    /* 技を4つ登録していれば、その中にない技は「使わない」とわかる（覚えられても未確認にしない）。特性も登録していれば同じ */
    const mvFull=mv.length>=4,abSet=!!abOf(set);
    (t.mv||[]).forEach(k=>{const id2=ST_MVID(k);if(!id2)return;if(mv.includes(id2))r.push(mName(id2));else if(!mvFull&&ls.includes(id2))c.push(mName(id2))});
    (t.ab||[]).forEach(k=>{if(abOf(set)===k)r.push(ABN[k]||k);else if(!abSet&&(ABD[p.no]||[]).some(z=>z[0]===k))c.push(ABN[k]||k)});
    const it=set.it&&set.it.k;let mg=null;try{mg=it?megaOf(p.no,it):null}catch(e){}
    if(mg&&mg.ab&&(t.ab||[]).includes(mg.ab))r.push(`メガシンカで${ABN[mg.ab]||mg.ab}`);
    if(r.length){reg.push(`${nm}の${r.join('・')}`);regN.push(nm)}else if(c.length){can.push(`${nm}（${c.join('・')}）`);canN.push(nm)}});
  let gain=null;if(t.gain){gain={reg:[],can:[]};entries.forEach(x=>{const p=byNo[x.no];if(!p)return;const nm=formInfo(p).base,g=WX_GAIN[t.gain]||[];
    if(g.includes(abOf(x.set)))gain.reg.push(nm);else if((ABD[p.no]||[]).some(z=>g.includes(z[0])))gain.can.push(nm)})}
  return{reg,can,regN,canN,gain,what:t.ab&&!t.mv?'特性':t.ab?'特性・技':'技'};
}
const stCut=(a,k)=>a.slice(0,k||3).join('・')+(a.length>(k||3)?` ほか${a.length-(k||3)}匹`:'');
/* 確かさ：ok 確認済み／part 一部未確認／un 未確認／no 役がいない／auto 自動の判定／user あなたが設定 */
const ST_LV={ok:'確認済み',part:'一部未確認',un:'未確認',no:'役のポケモンがいません',auto:'自動の判定',user:'あなたが設定'};
function stConf(id,entries,autoTp){
  const e=stTpEv(id,entries),L=stTpL(id);
  if(!e){if(id==='none')return{lv:'user',t:'型を決めず、相手に合わせて選出と立ち回りを変える方針です。'};
    if(id==='other')return{lv:'user',t:'リストにない型です。名前の欄に、自分の呼び方を書けます。'};
    return (autoTp||[]).includes(id)?{lv:'auto',t:'登録した持ち物・技から自動で判定しました。'}:{lv:'user',t:'自動では判定していません。あなたの考えとして保存します。'}}
  const g=e.gain,gTxt=!g?'':g.reg.length?`得をする仲間：${stCut(g.reg)}。`:g.can.length?`得をする仲間（${stCut(g.can)}）の特性が未登録です。`:'この天気で得をする仲間はいません。';
  /* 天気は作る役が1匹確かめられれば十分なので、ほかの作れそうな匹は出さない（得をする仲間の確かさだけ見る） */
  if(e.reg.length){const more=g?[]:e.canN,part=(g&&!g.reg.length&&g.can.length)||more.length;
    return{lv:part?'part':'ok',t:`${stCut(e.reg)}（登録済み）。${more.length?`${stCut(more)}は${e.what}が未登録です。`:''}${gTxt}`}}
  if(e.can.length)return{lv:'un',t:`${stCut(e.canN)}が${L}の役をできますが、${e.what}が未登録です（覚えられても、実際に使うとは限りません）。${e.what}を登録すると、より正確に判定できます。${gTxt}`};
  return{lv:'no',t:`パーティに${L}の役になるポケモンがいません。${gTxt}`};
}
/* 互換：前の版の1行の根拠 */
function stTpEvTxt(id,entries){const c=stConf(id,entries,[]);return `${ST_LV[c.lv]}：${c.t}`}
/* 未登録の情報（判定に効くもの）を1行で */
function stMissing(entries){
  const nm=x=>byNo[x.no]?formInfo(byNo[x.no]).base:'',m=[],noMv=entries.filter(x=>!(x.set&&(x.set.mv||[]).some(v=>v&&v.id))).map(nm),
    noAb=entries.filter(x=>!(x.set&&x.set.ab&&(x.set.ab.k||typeof x.set.ab==='string'))).map(nm),noIt=entries.filter(x=>!(x.set&&x.set.it&&x.set.it.k)).map(nm);
  if(noMv.length)m.push(`技（${stCut(noMv)}）`);if(noAb.length)m.push(`特性（${stCut(noAb)}）`);if(noIt.length)m.push(`持ち物（${stCut(noIt)}）`);
  return m.length?`未登録：${m.join('・')}。登録した分だけ、判定が「確認済み」になります。`:'';
}
/* 「戦い方」の下書き（2026/11/15 依頼主「型の説明をつなげるのではなく、6匹の使い方を」）：
   序盤・中盤・終盤を、選出の計算（dgSelect の1番・selPlan の詰め役）と、確認できた型の役のポケモンから組み立てる。
   未確認の型は流れに入れず、そのことを最後に1行だけ書く */
function stTpDraft(tp,entries,flow){
  const real=tp.filter(id=>id!=='other'&&id!=='none');
  if(!flow)return '';
  const conf=Object.fromEntries(real.map(id=>[id,stConf(id,entries,[])]));
  const okT=real.filter(id=>conf[id].lv==='ok'||conf[id].lv==='part'),unT=real.filter(id=>conf[id].lv==='un'||conf[id].lv==='no');
  const inSel=n=>flow.sel.includes(n),J=a=>a.join('・');
  let open='',mid='',noteSel='',subs=[];
  /* 確かめられた役のポケモン（登録した技・特性）だけで書く */
  const act=(id,who)=>{const t=ST_TYPE[id];return t.gain?`${J(who)}を早めに出して${t.l}にする。`:{tr:`${J(who)}で${t.l}を使い、遅いポケモンが先に動ける場を作る。`,tailwind:`${J(who)}で${t.l}を使い、味方が先に動ける場を作る。`,
    scr:`${J(who)}で壁を張り、受けるダメージを減らす。`,spd:`${J(who)}で相手の素早さを下げ、味方が先に動けるようにする。`,su:`${J(who)}が積み技を使える隙を作る。`,
    ctl:`${J(who)}で相手の動きを止め、したいことをさせない。`,ac:`${J(who)}の交代技で、有利な相手に引きつぐ。`,dc:`${J(who)}の回復技で粘りながら、相手を削る。`}[id]||''};
  const withEv=okT.filter(id=>stTpEv(id,entries));
  const main=withEv[0]||null,ev=main&&stTpEv(main,entries);
  if(main&&ev){const who=ev.regN,t=ST_TYPE[main];open=act(main,who);
    if(t.gain){const g=ev.gain.reg;if(g.length)mid=`${t.l}のあいだに${J(g.slice(0,2))}で攻め、数を減らす。`}
    subs=withEv.slice(1).map(id=>`${stTpL(id)}：${act(id,stTpEv(id,entries).regN)}`);
    const all=[...new Set([main,...withEv.slice(1)].flatMap(id=>stTpEv(id,entries).regN))].filter(n=>!inSel(n));
    if(all.length)noteSel=`（${J(all)}はおすすめの選出に入っていないので、この戦い方をするときは選出に入れてください）`}
  if(!open)open=flow.steps[0][1];
  if(!mid)mid=flow.steps[1][1];
  const end=flow.steps[2][1];
  const L=[`序盤：${open}${noteSel}`,...subs.map(x=>`　${x}`),`中盤：${mid}`,`終盤：${end}`];
  if(unT.length)L.push(`※${J(unT.map(stTpL))}は技・特性が未登録のため、上の流れには入れていません。`);
  return L.join('\n');
}
/* 「強み」の下書き：この6匹で生まれる強みと活かし方（1行ずつ）。戦い方の序盤に書いた天気・トリックルームの話はくり返さない */
function stStrDraft(tp,G){
  const skip=new Set();if(tp.some(id=>ST_TYPE[id]&&ST_TYPE[id].gain))skip.add('wx');if(tp.includes('tr'))skip.add('tr');
  const L=(G||[]).filter(g=>!skip.has(g.k)).map(g=>`・${stTx(g.t)}。${stTx(g.how)}`);
  return L.length?L.join('\n'):'';
}
function stConfHTML(ids,entries,autoTp){
  return ids.map(id=>{const c=stConf(id,entries,autoTp);return `<li class="stg-cf"><b>「${esc(stTpL(id))}」</b><span class="stg-lv stg-lv-${c.lv}">${ST_LV[c.lv]}</span><p>${esc(c.t)}</p></li>`}).join('');
}
function stOwnHTML(own,auto){
  const stale=(MEMO.party[mpKey()]||{}).sig&&(MEMO.party[mpKey()]||{}).sig!==mpSig();
  const tp=own.tp?stTpParse(own.tp):stTpParse(auto.tp);const ents=ST_LAST?ST_LAST.entries:team;
  const typeHTML=tp.length?`<div class="stg-ownf"><b>戦い方の型</b><p class="stg-owna">${tp.map((id,k)=>`<span class="tarch-b tarch-own${k===0&&tp.length>1?' stg-main':''}">${k===0&&tp.length>1?'<small>メイン</small>':tp.length>1?'<small>サブ</small>':''}${esc(stTpL(id))}</span>`).join('')}</p>
    <ul class="stg-cfl">${stConfHTML(tp,ents,stTpParse(auto.tp))}</ul></div>`:'';
  return `<div class="stg-own" data-notr><p class="stg-ownl">あなたが書いた戦い方</p>
    ${own.arch?`<div class="stg-ownf"><b>名前</b><p class="stg-owna"><span class="tarch-b tarch-own">${esc(own.arch)}</span></p></div>`:''}
    ${typeHTML}
    ${ST_FIELDS.filter(([k])=>own[k]).map(([k,l])=>`<div class="stg-ownf"><b>${l}</b><p>${stLines(own[k])}</p></div>`).join('')}
    ${stale?'<p class="stg-warn">書いたあとにパーティのポケモンが変わっています。内容が合っているか確かめてください。</p>':''}</div>`;
}
function stBind(box){
  const e=box.querySelector('[data-stg-edit]');if(e)e.onclick=()=>stEdit(box);
  const p=box.querySelector('[data-stg-post]');if(p)p.onclick=()=>stPost();
}
function stEdit(box){
  if(!ST_LAST)return;const auto=ST_LAST.auto,own=stOwn(),ents=ST_LAST.entries,flow=ST_LAST.flow;
  const autoTp=stTpParse(auto.tp);
  let sel=own.tp?stTpParse(own.tp):[...autoTp];
  const fields=ST_FIELDS.filter(([k])=>k!=='plan'||own.plan);
  const draftOf=k=>k==='style'?stTpDraft(sel,ents,flow):k==='str'?stStrDraft(sel,ST_LAST.G):auto[k]||'';
  const miss=stMissing(ents);
  box.innerHTML=`<div class="dgu-head"><h2>戦い方を書く</h2><span class="dgu-fmt">${FMTN()}</span></div>
    <p class="stg-f">自動の下書きが入っています。自由に書きかえてください。保存すると、この画面とパーティの戦術メモに残り、投稿にも使えます。</p>
    <div class="stg-ef" id="stg-tpbox"><b>戦い方の型<small>（いくつでも選べます）</small></b>
      ${autoTp.length?`<p class="stg-f" style="margin:0">「自動」の札は、パーティの特性・技・計算から見つけた型です。外すこともできます。</p>`:'<p class="stg-f" style="margin:0">自動では型を決められませんでした（根拠が足りないときは決めません）。合うものを選ぶか、「明確な型なし」を選んでください。</p>'}
      ${ST_CATS.map(([c,cl])=>`<fieldset class="stg-cat"><legend>${cl}</legend><div class="stg-archs">${ST_TYPES.filter(t=>t.c===c).map(t=>`<button type="button" class="pill stg-tp" data-stp="${t.id}" aria-pressed="false">${esc(t.l)}${autoTp.includes(t.id)?'<small class="stg-auto">自動</small>':''}</button>`).join('')}</div></fieldset>`).join('')}
      <div id="stg-main" class="stg-mainbox"></div>
      <ul id="stg-ev" class="stg-cfl"></ul>
      ${miss?`<p class="stg-miss">${esc(miss)}</p>`:''}
    </div>
    <div class="stg-ef" id="stg-otherf"><b>この構築の名前<small>（任意・40字まで）</small></b><input id="stg-arch" maxlength="40" value="${esc(own.arch||'')}" placeholder="例：雨パ・スタンダード" data-notr></div>
    <p class="stg-sum" id="stg-sum"></p>
    ${fields.map(([k,l,ph])=>`<div class="stg-ef"><b>${l}</b><textarea id="stg-${k}" maxlength="${MP_MAX}" placeholder="${esc(k==='style'&&!flow?'選出する数より多くポケモンを入れると、序盤・中盤・終盤の流れを下書きします。':ph)}" data-notr>${esc(own[k]||draftOf(k)||'')}</textarea><div class="mp-f stg-ff"><span class="stg-st" id="stg-st-${k}"></span>${k==='plan'?'':`<button type="button" class="mp-r" data-st-r="${k}">${k==='style'?'選んだ型から下書きを作り直す':'自動の下書きに戻す'}</button>`}</div></div>`).join('')}
    <div class="stg-acts"><button class="btn btn-p" id="stg-save">保存する</button><button class="btn btn-s" id="stg-cancel">やめる</button></div>
    ${ST_KEYS.some(k=>own[k])?'<button class="dgu-link" id="stg-clear">書いた戦い方を消して、自動の診断に戻す</button>':''}`;
  const grow=ta=>{ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight+2,240)+'px'};
  box.querySelectorAll('textarea').forEach(t=>{grow(t);t.addEventListener('input',()=>{grow(t);status()})});
  const ai=box.querySelector('#stg-arch'),ta=k=>box.querySelector('#stg-'+k);
  /* 下書きのままか、自分で書いたか（自分で書いた文は、型を変えても自動では書きかえない） */
  const last={};fields.forEach(([k])=>{const v=ta(k).value;last[k]=!own[k]&&v===draftOf(k)?v:null});
  const isDraft=k=>last[k]!==null&&ta(k).value===last[k];
  const status=()=>fields.forEach(([k])=>{const e=box.querySelector('#stg-st-'+k);if(e){const d=isDraft(k);e.textContent=d?'自動の下書き':'あなたが書いた文';e.className='stg-st '+(d?'stg-st-d':'stg-st-u')}});
  const paint=()=>{
    box.querySelectorAll('[data-stp]').forEach(b=>{const on=sel.includes(b.dataset.stp);b.setAttribute('aria-pressed',on);b.classList.toggle('stg-ismain',on&&sel[0]===b.dataset.stp&&sel.length>1)});
    const mb=box.querySelector('#stg-main');
    mb.innerHTML=sel.length>1?`<b>メインの型</b><div class="stg-archs" role="radiogroup" aria-label="メインの型">${sel.map((id,k)=>`<button type="button" class="pill" role="radio" data-stmain="${id}" aria-checked="${k===0}">${esc(stTpL(id))}</button>`).join('')}</div>`:'';
    mb.querySelectorAll('[data-stmain]').forEach(b=>b.onclick=()=>{sel=[b.dataset.stmain,...sel.filter(x=>x!==b.dataset.stmain)];changed()});
    box.querySelector('#stg-ev').innerHTML=stConfHTML(sel,ents,autoTp);
    const nm=ai.value.trim();box.querySelector('#stg-sum').innerHTML=sel.length||nm?[sel.length?`<span><b>メイン</b>${esc(stTpL(sel[0]))}</span>`:'',sel.length>1?`<span><b>サブ</b>${esc(sel.slice(1).map(stTpL).join('・'))}</span>`:'',nm?`<span><b>名前</b>${esc(nm)}</span>`:''].join(''):'';
    status();
  };
  const changed=()=>{paint();fields.forEach(([k])=>{if(k!=='plan'&&isDraft(k)){ta(k).value=last[k]=draftOf(k);grow(ta(k))}});status()};
  box.querySelectorAll('[data-stp]').forEach(b=>b.onclick=()=>{const id=b.dataset.stp;
    if(sel.includes(id))sel=sel.filter(x=>x!==id);
    else if(id==='none')sel=['none'];            /* 明確な型なし は、ほかと一緒に選ばない */
    else sel=[...sel.filter(x=>x!=='none'),id];
    changed()});
  ai.oninput=()=>paint();
  /* 作り直す・戻す：自分で書いた文があるときは、置きかえる前に確かめる（黙って置きかえない） */
  box.querySelectorAll('[data-st-r]').forEach(b=>b.onclick=async()=>{const k=b.dataset.stR;
    if(!isDraft(k)&&ta(k).value.trim()&&!(await askConfirm({title:'自動の下書きに置きかえますか？',text:'いまの文は消えます（保存するまでは、やめるで元に戻せます）。',ok:'置きかえる',danger:true})))return;
    ta(k).value=last[k]=draftOf(k);grow(ta(k));status()});
  paint();
  box.querySelector('#stg-cancel').onclick=()=>stFill(ST_LAST.entries);
  const cl=box.querySelector('#stg-clear');if(cl)cl.onclick=async()=>{if(!(await askConfirm({title:'書いた戦い方を消しますか？',text:'自動の診断の文に戻ります。',ok:'消す',danger:true})))return;stSaveOwn({});toast('書いた戦い方を消しました');stFill(ST_LAST.entries)};
  box.querySelector('#stg-save').onclick=()=>{const o={};
    if(!sel.length&&auto.tp){toast('型を1つ以上選ぶか、「明確な型なし」を選んでください');box.querySelector('#stg-tpbox').scrollIntoView({block:'center'});return}
    const tp=sel.join(',');if(tp!==auto.tp)o.tp=tp||'none';
    const a=ai.value.trim().slice(0,40);if(a)o.arch=a;
    /* 自動の下書きのまま（いまのパーティから作った文と同じ）なら保存しない＝パーティが変われば新しい下書きになる */
    fields.forEach(([k])=>{const v=ta(k).value.trim().slice(0,MP_MAX);if(v&&v!==(auto[k]||'').trim()&&!(isDraft(k)&&tp===auto.tp))o[k]=v});
    stSaveOwn(o);toast(Object.keys(o).length?'戦い方を保存しました':'自動の診断のままにしました');stFill(ST_LAST.entries);
    const b=document.getElementById('st-box');if(b)b.scrollIntoView({block:'start'})};
  box.scrollIntoView({block:'start'});
}
/* 投稿：書いた文（なければ自動の文）を画像のカードにして、ホームの投稿欄に入れて開く（文は140字まで・リンクは付けない） */
function stPostData(){
  const a=ST_LAST&&ST_LAST.auto||{},o=stOwn(),v=k=>o[k]||a[k]||'';
  const tp=o.tp?stTpParse(o.tp):stTpParse(a.tp);
  /* 流れは「戦い方」に入っているので、前に書いた「戦い方の流れ」があるときだけ別に出す */
  return{arch:stTpLabel(tp,o.arch||''),style:v('style'),str:v('str'),plan:o.plan||'',own:ST_KEYS.filter(k=>o[k])};
}
function stPostText(d){
  const nm=typeof teamName==='function'?teamName(TEAMS.cur):'マイパーティ';
  const mons=team.map(x=>byNo[x.no]?formInfo(byNo[x.no]).base:'').filter(Boolean).join('・');
  const tags='\n#パーティ紹介 #GameKids';
  let t=`【${nm}の戦い方】${d.arch?d.arch:''}\n${mons}`;
  const head=(d.style||'').split('\n')[0];
  if(head)t+=`\n${head}`;
  const max=TW_MAX-[...tags].length;if([...t].length>max)t=[...t].slice(0,max-1).join('')+'…';
  return t+tags;
}
function stWrap(g,t,w){const out=[];String(t).split('\n').forEach(par=>{let line='';for(const ch of par){if(g.measureText(line+ch).width>w&&line&&!/[、。，．）」』】・ー…！？]/.test(ch)){out.push(line);line=ch}else line+=ch}out.push(line)});return out}
async function strategyCard(d){
  const W=1200,FF='"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",Meiryo,sans-serif';
  const m=document.createElement('canvas').getContext('2d'),secs=[['戦い方',d.style],['強み',d.str],['戦い方の流れ',d.plan]].filter(x=>x[1]);
  m.font=`500 26px ${FF}`;const L=secs.map(([h,t])=>[h,stWrap(m,t,W-140).slice(0,14)]);
  const H=Math.min(2400,330+(d.arch?70:0)+L.reduce((s,[,ls])=>s+70+ls.length*38,0)+70);
  const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  const bg=g.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#0b1220');bg.addColorStop(1,'#16102a');g.fillStyle=bg;g.fillRect(0,0,W,H);
  const nm=typeof teamName==='function'?teamName(TEAMS.cur):'マイパーティ';
  g.fillStyle='#fff';g.font=`800 40px ${FF}`;g.fillText(fitText(g,nm+'の戦い方',W-360),56,78);
  g.fillStyle='rgba(255,255,255,.6)';g.font=`600 22px ${FF}`;g.fillText(`ポケモンチャンピオンズ・${FMTN()}`,58,112);
  g.textAlign='right';g.fillStyle='#fff';g.font=`800 26px ${FF}`;g.fillText('Game Kid/s',W-56,70);g.fillStyle='rgba(255,255,255,.55)';g.font=`600 18px ${FF}`;g.fillText(SITE_BASE().replace(/^https?:\/\//,''),W-56,98);g.textAlign='left';
  /* 6匹（種族値の形と名前） */
  const cw=(W-112)/6;
  for(let k=0;k<team.length&&k<6;k++){const p=byNo[team[k].no];if(!p)continue;const x=56+k*cw;
    const im=await svgImg(stamp(p),84,84);if(im)g.drawImage(im,x+(cw-84)/2,140,84,84);
    g.fillStyle='#fff';g.font=`700 20px ${FF}`;g.textAlign='center';g.fillText(fitText(g,formInfo(p).base,cw-8),x+cw/2,256);g.textAlign='left'}
  let y=300;
  if(d.arch){g.font=`800 26px ${FF}`;const w=g.measureText(d.arch).width+40;rrect(g,56,y,Math.min(w,W-112),48,24);g.fillStyle='rgba(124,92,255,.35)';g.fill();g.fillStyle='#fff';g.fillText(fitText(g,d.arch,W-152),76,y+33);y+=70}
  L.forEach(([h,ls])=>{g.fillStyle='#ffd400';g.font=`800 28px ${FF}`;g.fillText(h,56,y+30);y+=52;g.fillStyle='rgba(255,255,255,.9)';g.font=`500 26px ${FF}`;ls.forEach(l=>{g.fillText(l,70,y+26);y+=38});y+=18});
  g.fillStyle='rgba(255,255,255,.5)';g.font=`600 18px ${FF}`;
  g.fillText(d.own.length?'自動の診断に、トレーナーが書き加えた戦い方です':'対面計算から作った自動の診断です（目安）',56,H-30);
  try{return await new Promise((r,j)=>{try{c.toBlob(r,'image/png')}catch(e){j(e)}})}catch(e){return null}
}
let TWC_PRE=null;
async function stPost(){
  if(!(typeof AUTH!=='undefined'&&AUTH&&AUTH.user)){toast('投稿するにはログインしてください');nav('#/account');return}
  if(!ST_LAST){toast('戦い方をまとめ終わってから、もう一度押してください');return}
  const d=stPostData();let blob=null;try{blob=await strategyCard(d)}catch(e){}
  TWC_PRE={text:stPostText(d),blobs:blob?[blob]:[]};
  nav('#/');let n=0;
  const wait=()=>{if(keyOf(cur)!=='')return;
    if(document.querySelector('#view .twc')){fabPost();return}
    if(++n>40||(!document.querySelector('#view .empty')&&document.getElementById('tl-seg'))){TWC_PRE=null;fabPost();return}
    setTimeout(wait,100)};
  setTimeout(wait,100);
}
