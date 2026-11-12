/* ===================== 流行（使用率ランキングと流行パーティ） ===================== */
/* 集計データの各ポケモンのファイルには、使用率の順位（column_position）が入っている。
   上位のポケモンは互いの「一緒によく使われる」に出てくるので、それをたどって上位をまとめて集める。 */
const META={st:'idle',rank:[],teams:[],at:null,p:null};
const tmNo=n=>{const l=(SP2NO[nrm(n)]||[]).filter(x=>byNo[x]);return l.find(x=>!byNo[x].ext)||l[0]||null};
function metaLoad(onStep){
  if(META.st==='ready')return Promise.resolve(true);
  if(META.p)return META.p;
  META.p=(async()=>{
    if(!(await liveInit())){META.st='fail';return false}
    META.st='loading';
    const seen=new Set(),got=new Map();
    let queue=[445,727,812,...team.map(t=>t.no)].filter(n=>byNo[n]);
    const prio=new Map();queue.forEach(n=>prio.set(n,50));
    let fetched=0;
    while(queue.length&&fetched<48){
      queue.sort((a,b)=>(prio.get(a)||99)-(prio.get(b)||99));
      const batch=[];while(queue.length&&batch.length<6){const n=queue.shift();if(!seen.has(n)){seen.add(n);batch.push(n)}}
      if(!batch.length)break;
      const ds=await Promise.all(batch.map(liveMon));fetched+=batch.length;
      ds.forEach((d,i)=>{if(!d)return;const no=batch[i];got.set(no,d);const r=d.rank||99;
        d.tm.slice(0,8).forEach((nm,k)=>{const t=tmNo(nm);if(!t||seen.has(t))return;prio.set(t,Math.min(prio.get(t)||99,r+k*.5));if(!queue.includes(t))queue.push(t)})});
      onStep&&onStep(got.size);
    }
    META.rank=[...got].filter(([,d])=>d.rank).sort((a,b)=>a[1].rank-b[1].rank).map(([no,d])=>({no,d,rank:d.rank}));
    META.teams=metaTeams(got);META.st=META.rank.length?'ready':'fail';META.at=new Date();
    return META.st==='ready';
  })();
  return META.p;
}
/* 上位のポケモンを軸に、「一緒によく使われる」を順にたどって6匹を組む（いちばん多い組み合わせ） */
function metaTeams(got){
  const out=[],keys=new Set();
  for(const {no} of META.rank.slice(0,10)){
    const t=[no];
    for(let guard=0;t.length<6&&guard<12;guard++){
      let add=null;
      for(const m of t){const d=got.get(m);if(!d)continue;
        for(const nm of d.tm){const c=tmNo(nm);if(c&&!t.includes(c)&&got.has(c)){add=c;break}}
        if(add)break}
      if(!add)break;t.push(add);
    }
    if(t.length<6)continue;
    const key=[...t].sort().join();if(keys.has(key))continue;keys.add(key);
    out.push(t);if(out.length>=6)break;
  }
  return out;
}
function metaSetLine(no){
  const d=LIVE.csv[no];if(!d)return'';
  const it=d.it[0]?`${itNameEn(d.it[0][0])} ${Math.round(d.it[0][1])}%`:'';
  const mv=d.mv.filter(x=>nrm(x[0])!=='protect').slice(0,3).map(x=>mvNameEn(x[0])).join('・');
  return [it,mv].filter(Boolean).join('　');
}
function metaView(){
  setHeader('流行のポケモンとパーティ','#/tools');
  usageGet(FMT,()=>{if(keyOf(cur)==='meta')metaView()});
  const draw=()=>{
    /* 読めないとき（2026/11/12）：前に読めた集計（端末に覚えた pcmetalast＋形式）か、なければ合計種族値の高いポケモンを代わりに出す。空の画面にしない */
    const sk='pcmetalast'+FMT;let R=META.rank,TM=META.teams,fb='',gm=false;
    if(META.st==='ready'){try{localStorage.setItem(sk,JSON.stringify({at:Date.now(),r:R.slice(0,30).map(x=>[x.no,x.rank]),t:TM}))}catch(e){}}
    else if(META.st==='fail'){
      const c=lsJ(sk,null);
      if(c&&Array.isArray(c.r)&&c.r.length){R=c.r.filter(([n])=>byNo[n]).map(([no,rank])=>({no,rank}));TM=(c.t||[]).filter(t=>t.every(n=>byNo[n]));
        const d=new Date(c.at);fb=`集計の提供元に今つながらないため、${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}に読めた集計を表示しています。`}
      else{gm=true;R=gmOpps().filter(q=>!q.mega).slice(0,30).map((q,i)=>({no:q.no,rank:i+1}));TM=[];
        fb='集計の提供元に今つながらないため、使用率の代わりに<b>合計種族値の高いポケモン</b>を表示しています（使用率の順位ではありません）。'}}
    if(META.st!=='ready'&&!fb){
      V.innerHTML=`<div class="fmtbar"><span>対戦の形式</span>${fmtSwitch()}</div><p class="note" style="padding-top:4px">${FMTN()}のランクバトルで、いま多く使われているポケモンと、その組み合わせから作った<b>流行パーティ</b>を表示します。</p>${usageMetaHTML()}
      <div class="bnote" style="margin:12px 16px">${META.st==='fail'?'集計データを取得できませんでした。通信できる環境で、もう一度開いてください。':'集計データを読み込んでいます…'}<span id="meta-n"></span></div>`;bindFmt(V,()=>metaView());return}
    V.innerHTML=`<div class="fmtbar"><span>対戦の形式</span>${fmtSwitch()}</div><p class="note" style="padding-top:4px">${FMTN()}のランクバトルで、いま多く使われているポケモンです。流行パーティは、上位のポケモンから「一緒によく使われるポケモン」をたどって組んだ<b>代表的な組み合わせ</b>です（実在の特定のプレイヤーの構築ではありません）。</p>${usageMetaHTML()}
    ${fb?`<p class="fbk">${SVG(I.info||I.help,15)}<span>${fb}</span></p>`:''}${TM.length?`<div class="sec"><h2>流行パーティ</h2><span style="font-size:13px;color:var(--dim)">${TM.length}組</span></div>
    ${TM.map((t,k)=>`<div class="mteam">
      <div class="mteam-h"><b>パーティ${k+1}</b><span>${byNo[t[0]].n}軸</span></div>
      <div class="mteam-m">${t.map(n=>`<a href="#/p/${n}" class="mmon"><span class="av">${stamp(byNo[n])}</span><b>${byNo[n].n}</b><small>${metaSetLine(n)}</small></a>`).join('')}</div>
      <div class="btns" style="padding:8px 0 0"><button class="btn btn-s" data-opp="${k}">選出アシストで対策</button></div>
    </div>`).join('')}`:''}
    <div class="sec"><h2>${gm?'合計種族値の高いポケモン':'使用率ランキング（上位）'}</h2><span style="font-size:13px;color:var(--dim)">${gm?'代わりの表示':FMTN()+'・現在のシーズン'}</span></div>
    ${R.slice(0,30).map(x=>`<a class="row" href="#/p/${x.no}"><span class="rk">${x.rank}</span><span class="av">${stamp(byNo[x.no])}</span><div class="row-m"><div class="row-t">${byNo[x.no].n}</div><div class="row-s">${metaSetLine(x.no)}</div></div><span class="chev">${SVG(I.chev,18)}</span></a>`).join('')}
    ${gm?'':`<p class="note" style="color:var(--mute)">順位は、データ提供元の集計で「一緒によく使われるポケモン」をたどって見つかった範囲のものです。すべてのポケモンを調べているわけではないため、30位より下は抜けている場合があります。</p>`}
    ${srcLine('ladder')}`;
    bindFmt(V,()=>metaView());
    V.querySelectorAll('[data-opp]').forEach(b=>b.onclick=()=>{opp6=[...TM[+b.dataset.opp]];saveOpp6();nav('#/assist')});
    V.querySelectorAll('[data-sim]').forEach(b=>b.onclick=()=>{
      if(team.length<4){toast('先にあなたのパーティを4匹以上登録してください');return}
      const t=TM[+b.dataset.sim],myNos=team.map(x=>x.no);const sets={};myNos.forEach(n=>sets[n]=mySetFor(n));
      const osets={};t.forEach(n=>osets[n]=LIVE.csv[n]?buildSet(byNo[n],LIVE.csv[n],false):chooseSet(byNo[n]));
      const A=analyze(myNos,t);
      B={phase:'pick',my:{name:'あなたのパーティ',nos:myNos,src:'own'},mySets:sets,opT:{name:`流行パーティ（${byNo[t[0]].n}軸）`,nos:[...t],sets:osets},sel:[...A.lead,...A.back].map(i=>myNos[i])};
      nav('#/battle')});
  };
  draw();
  if(META.st!=='ready')metaLoad(n=>{const e=document.getElementById('meta-n');if(e)e.textContent=`（${n}匹分）`}).then(()=>{if(keyOf(cur)==='meta')draw()});
}

/* 起動の少しあとに、使用率の上位とパーティの匹のランクバトルの集計を読んでおく（2026/11/09 依頼主：「使用率の高い型」をどの画面でも集計どおりに）。
   集計は端末に6時間覚えるので、2回目からは通信しない。読めたら、パーティの画面ならその場で描き直す */
setTimeout(()=>{if(typeof navigator!=='undefined'&&navigator.webdriver)return;
  metaLoad().then(()=>Promise.all(team.map(t=>liveMon(t.no)))).then(()=>{
    if(typeof PR_HIT!=='undefined')for(const k in PR_HIT)delete PR_HIT[k];
    if(keyOf(cur)==='team'&&typeof teamRender==='function')teamRender()}).catch(()=>{})},2500);
