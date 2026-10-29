/* ===================== ゲームの切り替え（総合アプリ化の土台） =====================
   GAMES に追加していけば、ゲーム選択画面・切り替えシートに自動で並ぶ。
   利用者は「マイゲーム」をピン留めし、「起動したときに開く画面」を選べる。 */
const GAMES=[
  {id:'pokechamp',name:'ポケモンチャンピオンズ',short:'ポケチャン',home:'#/',status:'ready',color:'#ffcb05',desc:'図鑑・選出アシスト・ダメージ計算・対戦募集'},
  {id:'efootball',name:'eFootball',short:'イーフト',home:null,status:'soon',color:'#1d9bf0',desc:'育成・スカッド作成など（準備中）'}
];
const BRAND={logo:null}; /* ロゴ画像のURLを入れると、左上の丸の中に表示される（例：'img/logo.png'） */
const gpGet=()=>{const d={pins:['pokechamp'],start:'last',last:'pokechamp'};try{return{...d,...JSON.parse(localStorage.getItem('pcgames')||'{}')}}catch(e){return d}};
const gpSet=o=>{try{localStorage.setItem('pcgames',JSON.stringify({...gpGet(),...o}))}catch(e){}};
const gameOf=id=>GAMES.find(g=>g.id===id);
const curGame=()=>gameOf(gpGet().last)||GAMES[0];
const gameMark=(g,sz=36)=>`<span class="gmark" style="width:${sz}px;height:${sz}px;background:${g.color}"><b style="font-size:${Math.round(sz*.34)}px">${esc(g.short.slice(0,2))}</b></span>`;
function openGame(g){
  if(!g)return;
  if(g.status!=='ready'){toast(`${g.name}は準備中です。ピン留めしておくと、公開したときにすぐ開けます`);return}
  gpSet({last:g.id});nav(g.home);
}
function gameSheet(){
  const gp=gpGet(),cg=curGame();
  const list=(gp.pins.length?gp.pins.map(gameOf).filter(Boolean):GAMES.filter(g=>g.status==='ready'));
  const o=document.createElement('div');o.className='psheet';
  o.innerHTML=`<div class="psheet-bg"></div><div class="psheet-p" role="dialog" aria-modal="true" aria-label="ゲームを切り替える"><h3>ゲームを切り替える</h3>
    ${list.map(g=>`<button class="gsw" data-g="${g.id}">${gameMark(g,34)}<span><b>${esc(g.name)}</b><small>${g.status==='ready'?esc(g.desc):'準備中'}</small></span>${g.id===cg.id?'<i>✓</i>':''}</button>`).join('')}
    <button class="psheet-o" data-more>ゲームを選ぶ・マイゲームを編集</button><button class="psheet-x">閉じる</button></div>`;
  document.body.appendChild(o);requestAnimationFrame(()=>o.classList.add('on'));
  const done=()=>{o.classList.remove('on');setTimeout(()=>o.remove(),180)};
  o.querySelector('.psheet-bg').onclick=done;o.querySelector('.psheet-x').onclick=done;
  o.querySelector('[data-more]').onclick=()=>{done();nav('#/games')};
  o.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{done();openGame(gameOf(b.dataset.g))});
}
function gamesView(){
  setHeader('ゲームを選ぶ',curGame().home||'#/');
  const gp=gpGet();
  const pins=gp.pins.map(gameOf).filter(Boolean);
  const startOpts=[['last','前回開いていたゲーム'],['picker','このゲーム選択画面'],...GAMES.filter(g=>g.status==='ready').map(g=>[g.id,g.name+'（いつも）'])];
  V.innerHTML=`<div id="gm-root">
  <p class="note" style="padding-top:14px">よく使うゲームを<b>マイゲーム</b>にピン留めすると、左上のマークからすぐに切り替えられます。</p>
  <div class="sec"><h2>マイゲーム</h2><span style="font-size:12px;color:var(--dim)">${pins.length}件</span></div>
  ${pins.length?`<div class="ggrid">${pins.map(g=>`<button class="gtile" data-open="${g.id}">${gameMark(g,48)}<b>${esc(g.short)}</b>${g.status!=='ready'?'<small>準備中</small>':''}</button>`).join('')}</div>`:'<p class="empty" style="padding:18px 24px">下の一覧の☆を押すと、ここに並びます。</p>'}
  <div class="sec"><h2>すべてのゲーム</h2></div>
  ${GAMES.map(g=>{const on=gp.pins.includes(g.id);return `<div class="row" style="content-visibility:visible">${gameMark(g,40)}<div class="row-m" data-open="${g.id}" style="cursor:pointer"><div class="row-t">${esc(g.name)}${g.status==='ready'?'':'<span class="atag" style="margin-left:6px">準備中</span>'}</div><div class="row-s">${esc(g.desc)}</div></div>
    <button class="gpin${on?' on':''}" data-pin="${g.id}" aria-pressed="${on}" aria-label="${esc(g.name)}をマイゲームに${on?'入れない':'入れる'}">${on?'★':'☆'}</button></div>`}).join('')}
  <div class="sec"><h2>起動したときに開く画面</h2></div>
  <div class="natr"><select class="sel" id="gm-start">${startOpts.map(([v,n])=>`<option value="${v}"${gp.start===v?' selected':''}>${esc(n)}</option>`).join('')}</select></div>
  <p class="note" style="color:var(--mute)">はじめは「前回開いていたゲーム」が開きます。いろいろなゲームを使う人は「このゲーム選択画面」にすると、毎回ここから選べます。</p>
  </div>`;
  V.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openGame(gameOf(b.dataset.open)));
  V.querySelectorAll('[data-pin]').forEach(b=>b.onclick=()=>{const p=gpGet().pins,id=b.dataset.pin;gpSet({pins:p.includes(id)?p.filter(x=>x!==id):[...p,id]});gamesView()});
  document.getElementById('gm-start').onchange=e=>{gpSet({start:e.target.value});toast('起動時の画面を変更しました')};
}
/* 起動時：設定に合わせて最初の画面を決める（URLで特定のページが指定されているときはそのまま） */
(function(){
  if(cur&&cur!=='#'&&cur!=='#/')return;
  const gp=gpGet();
  const target=gp.start==='picker'?'#/games':gp.start==='last'?(curGame().home||'#/'):((gameOf(gp.start)||{}).home||'#/');
  if(target!=='#/'){cur=target;setUrl(target)}
})();

document.addEventListener('click',e=>{if(e.target.closest('#brand'))gameSheet()});
/* ---- ゲーム内の結果との照らし合わせ（この端末に保存） ---- */
const DVER={unit:'n',open:false};
const dvGet=()=>{try{return JSON.parse(localStorage.getItem('pcverify')||'[]')}catch(e){return[]}};
const dvSet=a=>{try{localStorage.setItem('pcverify',JSON.stringify(a.slice(-200)))}catch(e){}};
function dvJudge(R,v,unit){
  const lo=Math.min(...R.r),hi=Math.max(...R.r),max=R.d.max;
  if(unit==='n'){
    if(R.r.includes(v)){const ks=R.r.map((x,i)=>x===v?85+i:0).filter(Boolean);return{ok:true,msg:`一致しています（乱数${ks[0]}%${ks.length>1?'〜'+ks[ks.length-1]+'%':''}の結果）`}}
    if(v>=lo&&v<=hi)return{ok:false,msg:`範囲内ですが、16段階のどれとも一致しません（計算 ${lo}〜${hi}）。端数の処理がずれている可能性があります`};
    return{ok:false,msg:`計算の範囲外です（計算 ${lo}〜${hi}）。条件の入れ忘れ（ランク・持ち物・特性・天気・急所）がないか確かめてください`};
  }
  /* ％：ゲームの表示は丸められているので、前後1％までは一致とみなす */
  const pl=lo/max*100,ph=hi/max*100;
  if(v>=Math.floor(pl)-1&&v<=Math.ceil(ph)+1)return{ok:true,msg:`範囲内です（計算 ${pl.toFixed(1)}〜${ph.toFixed(1)}%）`};
  return{ok:false,msg:`計算の範囲外です（計算 ${pl.toFixed(1)}〜${ph.toFixed(1)}%）。条件の入れ忘れがないか確かめてください`};
}
function dvList(){
  const a=dvGet();if(!a.length)return'<p class="note" style="color:var(--mute);padding:8px 0 0">記録はまだありません。いろいろな条件（急所・天気・持ち物・ランクなど）で試すほど確かになります。</p>';
  const ok=a.filter(x=>x.ok).length;
  return `<div class="cver-sum"><b>${a.length}件中 ${ok}件 一致</b>${a.length-ok?`<span style="color:var(--w2)">　ずれ ${a.length-ok}件</span>`:''}</div>
  <div class="cver-list">${a.slice().reverse().slice(0,20).map(x=>`<div class="cver-i"><i>${x.ok?'✓':'✗'}</i><span>${esc(x.t)}<small>${esc(x.cond)}　実際 ${x.v}${x.u==='p'?'%':''} ／ 計算 ${x.lo}〜${x.hi}</small></span></div>`).join('')}</div>
  <div class="btns" style="padding:8px 0 0;flex-wrap:wrap"><button class="btn btn-s" id="c-vcopy">記録をコピー</button><button class="btn btn-s" id="c-vclr">記録を消す</button></div>`;
}
function calcVerBind(R,draw){
  const box=document.getElementById('c-ver');if(!box||!R)return;
  box.addEventListener('toggle',()=>{DVER.open=box.open});
  box.querySelectorAll('[data-vu]').forEach(b=>b.onclick=()=>{DVER.unit=b.dataset.vu;const y=scrollY;draw();scrollTo(0,y)});
  const inp=document.getElementById('c-obs'),out=document.getElementById('c-verdict');
  const show=()=>{const v=parseFloat(inp.value);if(!(v>=0)){out.innerHTML='';return null}const j=dvJudge(R,v,DVER.unit);out.innerHTML=`<b style="color:${j.ok?'#4ec98a':'var(--w2)'}">${j.ok?'✓':'✗'}</b> ${esc(j.msg)}`;return{v,j}};
  inp.addEventListener('input',show);
  document.getElementById('c-rec').onclick=()=>{
    const r=show();if(!r){toast('ダメージを入れてください');return}
    const nat=X=>{const n=NATS.find(n=>n[1]===X.up&&n[2]===X.dn);return n?n[0]:''};
    const side=(X,m)=>`${m.p.n}[${(ABN[X.ab]||X.ab||'特性なし')}/${X.item?ITEMN[X.item]:'持ち物なし'}/${nat(X)}/${X.sp.join('-')}]`;
    const cond=[FMT==='double'?'ダブル':'シングル',CS.crit&&'急所',CS.screen&&'壁',CS.burn&&'やけど',CS.spread&&FMT==='double'&&'全体',CS.weather&&({sun:'はれ',rain:'あめ',sand:'すな',snow:'ゆき'})[CS.weather],
      ...['atk','spa'].filter(k=>CS.a.stg[k]).map(k=>(k==='atk'?'攻':'特攻')+(CS.a.stg[k]>0?'+':'')+CS.a.stg[k]),
      ...['def','spd'].filter(k=>CS.d.stg[k]).map(k=>(k==='def'?'防':'特防')+(CS.d.stg[k]>0?'+':'')+CS.d.stg[k])].filter(Boolean).join('・');
    const lo=Math.min(...R.r),hi=Math.max(...R.r),u=DVER.unit;
    const a=dvGet();a.push({at:Date.now(),t:`${R.a.p.n}の${R.mv.n}→${R.d.p.n}`,cond,full:`${side(CS.a,R.a)} ${R.mv.n} → ${side(CS.d,R.d)} HP${R.d.max}`,v:r.v,u,lo:u==='p'?+(lo/R.d.max*100).toFixed(1):lo,hi:u==='p'?+(hi/R.d.max*100).toFixed(1):hi,ok:r.j.ok,rolls:u==='n'?R.r:undefined});
    dvSet(a);toast(r.j.ok?'一致として記録しました':'ずれとして記録しました');DVER.open=true;const y=scrollY;draw();scrollTo(0,y);
  };
  const cp=document.getElementById('c-vcopy');
  if(cp)cp.onclick=async()=>{
    const a=dvGet();
    const txt='ダメージ照合の記録（'+a.length+'件・一致'+a.filter(x=>x.ok).length+'件）\n'+a.map(x=>`${x.ok?'○':'×'} ${x.full}｜${x.cond}｜実際${x.v}${x.u==='p'?'%':''}｜計算${x.lo}〜${x.hi}`).join('\n');
    try{await navigator.clipboard.writeText(txt);toast('コピーしました')}catch(e){toast('コピーできませんでした')}
  };
  const cl=document.getElementById('c-vclr');
  if(cl)cl.onclick=()=>{if(confirm('照合の記録をすべて消しますか？')){dvSet([]);const y=scrollY;draw();scrollTo(0,y)}};
}

