/* ===================== パーティの強み・弱み・警戒（一括表示） ===================== */
function reportData(nos,metaNos){
  const mons=nos.map(n=>byNo[n]);
  /* 受け：各タイプの技を、何匹が弱点で受け、何匹が半減以下で受けるか */
  const def=T.map(t=>{const w=mons.filter(p=>mult(t,p.t)>=2),r=mons.filter(p=>mult(t,p.t)<1);return{t,w,r}});
  const shared=def.filter(x=>x.w.length>=Math.max(2,Math.ceil(mons.length/2))&&x.r.length<=1).sort((a,b)=>b.w.length-a.w.length||a.r.length-b.r.length);
  /* 攻め：タイプ一致技で抜群を取れるタイプ */
  const off=T.map(t=>({t,by:mons.filter(p=>p.t.some(a=>mult(a,[t])>=2))}));
  const holes=off.filter(x=>!x.by.length).map(x=>x.t);
  /* 実数値（あなたの育成があればそれで） */
  const M=nos.map(n=>mkMon(byNo[n],'me',mySetFor(n)));
  const out={mons,def,shared,off,holes,M};
  if(metaNos&&metaNos.length){
    const A=analyze(nos,metaNos);out.A=A;
    out.threats=A.O.map((o,j)=>{
      const hit=A.M.map((m,i)=>({i,d:A.R[j][i]}));const big=hit.filter(x=>x.d.pct>=70).length;
      const ans=A.M.map((m,i)=>({i,d:A.D[i][j],fast:A.fast[i][j]})).sort((a,b)=>b.d.pct-a.d.pct)[0];
      return{o,j,big,score:hit.reduce((s,x)=>s+Math.min(x.d.pct,150),0)-(ans?Math.min(ans.d.pct,150)*.8:0),ans,top:hit.sort((a,b)=>b.d.pct-a.d.pct)[0]};
    }).sort((a,b)=>b.score-a.score);
    out.faster=A.M.map((m,i)=>({m,slower:A.O.filter((o,j)=>!A.fast[i][j]).map(o=>o.p.n)}));
  }
  return out;
}
function reportView(){
  setHeader('パーティの強みと弱み','#/team');
  if(team.length<2){V.innerHTML=`<div class="bnote" style="margin:20px 16px"><b>先にパーティを登録してください</b><br>2匹以上で診断できます（いま${team.length}匹）。</div><div class="btns"><a class="btn btn-p" href="#/team">パーティを登録する</a></div>`;return}
  const nos=team.map(t=>t.no);
  const draw=()=>{
    const metaNos=META.st==='ready'?META.rank.slice(0,16).map(x=>x.no).filter(n=>!nos.includes(n)).slice(0,12):[];
    const R=reportData(nos,metaNos);
    const strong=[],weak=[],warn=[];
    const covered=18-R.holes.length;
    strong.push(`タイプ一致技で<b>${covered}／18タイプ</b>に抜群を取れる`);
    const fastest=[...R.M].sort((a,b)=>effSpd(b)-effSpd(a))[0];
    strong.push(`いちばん速いのは<b>${fastest.p.n}</b>（素早さ ${effSpd(fastest)}）`);
    const bulky=[...R.M].sort((a,b)=>(b.st[0]*(b.st[2]+b.st[4]))-(a.st[0]*(a.st[2]+a.st[4])))[0];
    strong.push(`いちばん打たれ強いのは<b>${bulky.p.n}</b>`);
    if(R.shared.length)R.shared.slice(0,3).forEach(x=>weak.push(`<b>${x.t}</b>技が${x.w.length}匹の弱点（${x.w.map(p=>p.n).join('・')}）${x.r.length?`、受けられるのは${x.r.map(p=>p.n).join('・')}だけ`:'、半減で受けられるポケモンがいない'}`));
    else weak.push('3匹以上が同じ弱点を持つタイプはありません');
    if(R.holes.length)weak.push(`タイプ一致で抜群を取れないタイプ：<b>${R.holes.join('・')}</b>`);
    if(R.threats){R.threats.slice(0,4).forEach(t=>warn.push(`<b>${t.o.p.n}</b>：${t.big?`${t.big}匹に大ダメージ`:'大きなダメージは受けにくい'}${t.top&&t.top.d.mv?`（${R.M[t.top.i].p.n}に${t.top.d.mv.n}で約${Math.round(t.top.d.pct)}%）`:''}。${t.ans&&t.ans.d.pct>=50?`対策は<b>${R.M[t.ans.i].p.n}</b>の${t.ans.d.mv?t.ans.d.mv.n:''}（約${Math.round(t.ans.d.pct)}%${t.ans.fast?'・先に動ける':''}）`:'<span style="color:var(--w2)">有効な打点が少ない</span>'}`))}
    const box=(title,cls,items)=>`<div class="rbox ${cls}"><h3>${title}</h3><ul>${items.map(x=>`<li>${x}</li>`).join('')}</ul></div>`;
    V.innerHTML=`<div class="fmtbar"><span>対戦の形式</span>${fmtSwitch()}</div><p class="note" style="padding-top:4px">登録した<b>${nos.length}匹</b>（あなたの育成があればその数値）で、強み・弱み・警戒すべき相手をまとめて表示します。</p>
    <div class="rteam">${R.mons.map(p=>`<span class="av" title="${p.n}">${stamp(p)}</span>`).join('')}</div>
    ${box('強み','good',strong)}
    ${box('弱み','bad',weak)}
    ${R.threats?box('警戒すべき流行のポケモン','warn',warn):`<div class="bnote" style="margin:10px 16px">${META.st==='fail'?'集計データを取得できないため、警戒すべき相手は表示できません。':'流行のポケモンを読み込んでいます…（警戒すべき相手を計算します）'}</div>`}
    <div class="sec"><h2>受けるタイプ別</h2><span style="font-size:12px;color:var(--dim)">弱点の数 ／ 半減以下の数</span></div>
    <div class="rgrid">${R.def.map(x=>`<div class="rcell ${x.w.length>=3&&x.r.length<=1?'hot':x.w.length>=2?'mid':''}"><span style="background:${COL[x.t]};color:${ONC[x.t]}">${ticon(x.t,14)}</span><b>${x.w.length}</b><small>${x.r.length}</small></div>`).join('')}</div>
    ${R.faster?`<div class="sec"><h2>素早さ</h2><span style="font-size:12px;color:var(--dim)">流行のポケモンとの比較</span></div>
    ${R.faster.map(x=>`<div class="row" style="content-visibility:visible"><span class="av">${stamp(x.m.p)}</span><div class="row-m"><div class="row-t">${x.m.p.n}<span style="margin-left:8px;font:700 13px Inter,sans-serif;color:var(--dim)">${effSpd(x.m)}</span></div><div class="row-s">${x.slower.length?`より速い相手：${x.slower.slice(0,6).join('・')}${x.slower.length>6?` ほか${x.slower.length-6}匹`:''}`:'流行の相手には先に動ける'}</div></div></div>`).join('')}`:''}
    <div class="btns" style="flex-wrap:wrap"><a class="btn btn-s" href="#/calc">ダメージ計算</a><a class="btn btn-s" href="#/meta">流行のパーティを見る</a></div>
    <p class="note" style="color:var(--mute)">ダメージは乱数の中央付近・1対1で計算した目安です。相手は集計でいちばん多い型として計算しています。メガストーンを持つ型はメガシンカ後の姿で計算します（実際の対戦でメガシンカできるのは1匹だけです）。</p>
    ${srcLine('ladder','calc')}`;
  };
  const draw2=()=>{draw();bindFmt(V,()=>reportView())};
  draw2();
  if(META.st!=='ready')metaLoad().then(()=>{if(keyOf(cur)==='report')draw2()});
}


