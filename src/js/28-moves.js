/* ===================== 覚える技・特性（図鑑の「技・特性」タブ） ===================== */
const MVS={cat:'all',type:'',q:'',sort:'type',tab4:null};
const FLN={c:'接触',p:'パンチ',b:'かみつき',l:'波動',s:'切る',o:'音',w:'風',x:'弾',d:'おどり'};
function movesPanel(p){
  const el=document.getElementById('mvpanel');if(!el)return;
  MVS.tab4=p.no;
  const ls=LSD[p.no]?LSD[p.no][1]:[];
  const use=(LIVE.csv[p.no]&&LIVE.csv[p.no].mv)||[];
  const useOf={};use.forEach(([n,pc])=>{const id=MVKA[nrm(n)];if(id)useOf[id]=pc});
  const abl=ABD[p.no]||[];
  const abUse={};((LIVE.csv[p.no]&&LIVE.csv[p.no].ab)||[]).forEach(([n,pc])=>{const k=ABK[nrm(n)];if(k)abUse[k]=pc});
  const rows=ls.map(id=>{const u=MVU[id]||[],d=MD[id]||[];return{id,n:mName(id),t:u[0],cls:u[1],pow:u[2],acc:u[3],pp:u[4],pri:u[5],tg:u[6],desc:d[1]||'',fl:d[2]||'',calc:!!MV[id]||id===182||id===197,use:useOf[id]}});
  const cnt={all:rows.length,0:rows.filter(r=>r.cls===0).length,1:rows.filter(r=>r.cls===1).length,2:rows.filter(r=>r.cls===2).length};
  const draw=()=>{
    const q=MVS.q.trim();
    let list=rows.filter(r=>(MVS.cat==='all'||r.cls===+MVS.cat)&&(!MVS.type||r.t===MVS.type)&&(!q||r.n.includes(q)||r.desc.includes(q)));
    const ti=t=>T.indexOf(t);
    const srt={type:(a,b)=>ti(a.t)-ti(b.t)||a.cls-b.cls||b.pow-a.pow||a.n.localeCompare(b.n,'ja'),pow:(a,b)=>(b.pow||0)-(a.pow||0)||a.n.localeCompare(b.n,'ja'),name:(a,b)=>a.n.localeCompare(b.n,'ja'),use:(a,b)=>(b.use||0)-(a.use||0)||ti(a.t)-ti(b.t)};
    list.sort(srt[MVS.sort]||srt.type);
    document.getElementById('mv-list').innerHTML=list.length?list.map(r=>`<div class="mvr">
      <div class="mvr-h"><b>${r.n}</b>${chip(r.t)}<span class="mvc c${r.cls}">${['物理','特殊','変化'][r.cls]}</span>${r.use!=null?`<span class="mvu">採用 ${r.use}%</span>`:''}</div>
      <div class="mvr-s">${r.cls<2?`<span>威力 <b>${r.pow||'—'}</b></span>`:''}<span>命中 <b>${r.acc?r.acc:'—'}</b></span><span>PP <b>${r.pp||'—'}</b></span>${r.pri?`<span>優先度 <b>${r.pri>0?'+':''}${r.pri}</b></span>`:''}${[...r.fl].map(c=>`<i>${FLN[c]}</i>`).join('')}${r.cls<2&&!r.calc?'<i class="nc">計算対象外</i>':''}</div>
      ${r.desc?`<div class="mvr-d">${esc(r.desc)}</div>`:(r.cls<2?'<div class="mvr-d" style="color:var(--mute)">追加の効果はありません</div>':'')}
    </div>`).join(''):'<p class="empty">条件に合う技がありません。</p>';
    document.getElementById('mv-n').textContent=`${list.length}件`;
  };
  el.innerHTML=`<div class="sec"><h2>特性</h2></div>
  ${abl.map(([k,h])=>`<div class="abr"><b>${ABN[k]||k}</b>${h?'<span class="atag">隠れ特性</span>':''}${abUse[k]!=null?`<span class="mvu">採用 ${abUse[k]}%</span>`:''}${ABDS[k]?`<div class="abr-d">${esc(ABDS[k])}</div>`:''}</div>`).join('')||'<p class="empty">データがありません。</p>'}
  ${megasOf(p.no).map(m=>`<div class="abr"><b>${ABN[m.ab]||m.ab}</b><span class="atag">${m.n}</span>${ABDS[m.ab]?`<div class="abr-d">${esc(ABDS[m.ab])}</div>`:''}</div>`).join('')}
  <p class="note" style="color:var(--mute)">特性の説明は当サイトがまとめたものです。ダメージ計算で扱っている特性は、計算の画面で「※計算外」が付かないものです。</p>
  <div class="sec"><h2>覚える技</h2><span style="font-size:12px;color:var(--dim)" id="mv-n"></span></div>
  <p class="note" style="padding-top:0">チャンピオンズで覚えられる技の全${rows.length}種類です（物理${cnt[0]}・特殊${cnt[1]}・変化${cnt[2]}）。${use.length?'「採用」はランクマッチの集計での採用率です。':''}効果の説明はデータをもとに当サイトがまとめたものです。</p>
  <div class="pills" style="padding:0 16px 8px;flex-wrap:wrap">${[['all','すべて'],['0','物理'],['1','特殊'],['2','変化']].map(([k,n])=>`<button class="pill" data-mc="${k}" aria-pressed="${MVS.cat===k}">${n} ${cnt[k]}</button>`).join('')}</div>
  <div class="natr"><select class="sel" id="mv-type"><option value="">すべてのタイプ</option>${T.map(t=>`<option${MVS.type===t?' selected':''}>${t}</option>`).join('')}</select>
    <select class="sel" id="mv-sort">${[['type','タイプ順'],['pow','威力順'],['name','名前順'],...(use.length?[['use','採用率順']]:[])].map(([k,n])=>`<option value="${k}"${MVS.sort===k?' selected':''}>${n}</option>`).join('')}</select></div>
  <div class="natr"><input class="sel" style="background-image:none" id="mv-q" type="search" placeholder="技の名前・効果で探す（例：まひ、先制）" value="${esc(MVS.q)}" aria-label="技を探す"></div>
  <div id="mv-list"></div>`;
  el.querySelectorAll('[data-mc]').forEach(b=>b.onclick=()=>{MVS.cat=b.dataset.mc;el.querySelectorAll('[data-mc]').forEach(x=>x.setAttribute('aria-pressed',x===b));draw()});
  document.getElementById('mv-type').onchange=e=>{MVS.type=e.target.value;draw()};
  document.getElementById('mv-sort').onchange=e=>{MVS.sort=e.target.value;draw()};
  document.getElementById('mv-q').oninput=e=>{MVS.q=e.target.value;draw()};
  draw();
  /* 採用率（ランクマッチの集計）を読み込めたら表示し直す */
  if(!LIVE.csv[p.no]&&LIVE.csv[p.no]!==null)calcEnsure(p.no).then(ch=>{if(ch&&MVS.tab4===p.no&&document.getElementById('mvpanel')&&!document.getElementById('mvpanel').hidden){if(!use.length&&LIVE.csv[p.no])MVS.sort='use';movesPanel(p)}});
}

/* 計算画面：技ごとの注意書き */
function mvNote(R){
  const k=mkey(R.mv),o=[];
  const VAR={lowkick:'相手の重さ',grassknot:'相手の重さ',heavyslam:'自分と相手の重さ',heatcrash:'自分と相手の重さ',gyroball:'自分と相手の素早さ',electroball:'自分と相手の素早さ',eruption:'自分の残りHP',waterspout:'自分の残りHP',flail:'自分の残りHP',reversal:'自分の残りHP',hardpress:'相手の残りHP',acrobatics:'持ち物の有無',hex:'相手の状態異常',infernalparade:'相手の状態異常',venoshock:'相手のどく状態',barbbarrage:'相手のどく状態',storedpower:'自分の能力の上昇',powertrip:'自分の能力の上昇',weatherball:'天気',knockoff:'相手の持ち物の有無',solarbeam:'天気',solarblade:'天気'};
  if(VAR[k]){let pw=varPow(R.a,R.mv,R.d,{cond:CS.cond,cnt:CS.cnt});const ds=R.d.status;
    if((k==='venoshock'||k==='barbbarrage')&&(ds==='psn'||ds==='tox'))pw*=2;if(k==='knockoff'&&R.d.item&&!isStone(R.d.item))pw*=1.5;
    const w=R.a.ab==='mega-sol'?'sun':(B.weather&&B.weather.k);if((k==='solarbeam'||k==='solarblade')&&w&&w!=='sun')pw/=2;
    o.push(`威力は${VAR[k]}で変わります（今の条件で威力${Math.round(pw)}）`)}
  if(fixedDmg(R.a,R.mv,R.d)!=null)o.push('決まった量のダメージを与える技です（乱数なし）');
  if(MCHG.has(k))o.push(k==='solarbeam'||k==='solarblade'?'はれのとき以外は、1ターン目に力をためます':k==='electroshot'?'あめのとき以外は、1ターン目に力をためます':'1ターン目に力をため、2ターン目に攻撃します');
  if(MRECH.has(k))o.push('使った次のターンは動けません');
  if(MSELFKO.has(k))o.push('使うと自分は倒れます');
  if(MFIRST.has(k))o.push('場に出てすぐのターンだけ成功します');
  if(k==='suckerpunch')o.push('相手が攻撃技を選んだときだけ成功します');
  if(k==='upperhand')o.push('相手が先制技を選んだときだけ成功します');
  if(k==='poltergeist')o.push('相手が持ち物を持っていないと失敗します');
  if(k==='steelroller')o.push('フィールドがないと失敗します');
  if(k==='focuspunch')o.push('このターンに攻撃を受けると失敗します');
  if(k==='belch')o.push('きのみを食べたあとでないと使えません');
  if(k==='lastresort')o.push('ほかの技をすべて使ったあとでないと使えません');
  if(k==='snore')o.push('ねむり状態のときだけ使えます');
  if(k==='meteorbeam'||k==='electroshot')o.push('ためるときに上がる特攻（+1）を含めて計算しています');
  return o.join('。');
}

route();
