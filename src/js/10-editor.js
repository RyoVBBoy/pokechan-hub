/* ===================== 育成の編集 ===================== */
const NATS=[['補正なし',-1,-1],['さみしがり',1,2],['いじっぱり',1,3],['やんちゃ',1,4],['ゆうかん',1,5],['ずぶとい',2,1],['わんぱく',2,3],['のうてんき',2,4],['のんき',2,5],
 ['ひかえめ',3,1],['おっとり',3,2],['うっかりや',3,4],['れいせい',3,5],['おだやか',4,1],['おとなしい',4,2],['しんちょう',4,3],['なまいき',4,5],['おくびょう',5,1],['せっかち',5,2],['ようき',5,3],['むじゃき',5,4]];
const natName=(u,d)=>u>0&&d>0?((NATS.find(x=>x[1]===u&&x[2]===d)||[''])[0]+`（${SN[u]}↑${SN[d]}↓）`):'';
const spLine=sp=>sp.map((v,i)=>v?['H','A','B','C','D','S'][i]+v:'').filter(Boolean).join(' ')||'ポイントなし';
const ITEM_ORDER=['choicescarf','choiceband','choicespecs','lifeorb','focussash','sitrusberry','assaultvest','leftovers'];
/* 計算用の型（ab:キー, item:キー, moves:技オブジェクト）→ 保存形式 */
function setToSaved(p,c){
  let sp=c.sp,up=c.up??-1,dn=c.dn??-1;
  if(!sp){const phys=p.s[1]>=p.s[3],ai=phys?1:3;sp=[2,0,0,0,0,0];sp[ai]=32;sp[5]=32;up=ai;dn=phys?3:1}
  return{ab:c.ab?{n:ABN[c.ab]||c.ab,k:c.ab}:null,it:c.item?{n:ITEMN[c.item]||c.item,k:c.item}:null,
    mv:(c.moves||[]).slice(0,4).map(m=>m.prot?{n:'まもる',id:182}:m.id>0?{n:m.n,id:m.id}:null).filter(Boolean),sp:[...sp],up,dn};
}
let ED=null;
function editView(a){
  const idx=+a,x=team[idx],p=x&&byNo[x.no];
  if(!p){nav('#/team');return}
  setHeader(p.n+'の育成','#/team');
  const fresh=!(x.set&&x.set.sp);
  const base=x.set&&x.set.sp?JSON.parse(JSON.stringify(x.set)):{...setToSaved(p,mySetFor(p.no)),...(x.set?{ab:x.set.ab||setToSaved(p,mySetFor(p.no)).ab,it:x.set.it||null,mv:x.set.mv&&x.set.mv.length?x.set.mv:setToSaved(p,mySetFor(p.no)).mv}:{})};
  while(base.mv.length<4)base.mv.push(null);
  ED={idx,no:p.no,s:base,dirty:false};
  const ls=LSD[p.no],abl=ABD[p.no]||[];
  const mvIds=ls?ls[1].filter(id=>MV[id]):[];
  const byT={};mvIds.forEach(id=>{const t=MV[id][1];(byT[t]=byT[t]||[]).push(id)});
  const mvOpts=(cur)=>{
    let h=`<option value="">（なし）</option>`;
    if(!ls||ls[0])h+=`<option value="182"${cur&&(cur.id===182||cur.id===197)?' selected':''}>まもる</option>`;
    if(cur&&cur.id!==182&&cur.id!==197&&!mvIds.includes(cur.id)&&!(ls&&ls[1].includes(cur.id)))h+=`<option value="x" selected>${cur.n}（計算には使いません）</option>`;
    const ord=[...p.t,...T.filter(t=>!p.t.includes(t))];
    ord.forEach(t=>{if(!byT[t])return;h+=`<optgroup label="${t}">`+byT[t].sort((a,b)=>MV[b][2]-MV[a][2]).map(id=>{const m=MV[id];
      return `<option value="${id}"${cur&&cur.id===id?' selected':''}>${m[0]}　${['物理','特殊','変化'][m[4]]||''}${m[2]?' 威力'+m[2]:''}</option>`}).join('')+'</optgroup>'});
    const rest=(ls?ls[1]:[]).filter(id=>!MV[id]&&id!==182&&id!==197&&MD[id]).sort((a,b)=>mName(a).localeCompare(mName(b),'ja'));
    const sts=rest.filter(id=>MVU[id]&&MVU[id][1]===2),oth=rest.filter(id=>!(MVU[id]&&MVU[id][1]===2));
    if(sts.length)h+=`<optgroup label="変化技（計算には使いません）">`+sts.map(id=>`<option value="${id}"${cur&&cur.id===id?' selected':''}>${mName(id)}</option>`).join('')+'</optgroup>';
    if(oth.length)h+=`<optgroup label="計算できない攻撃技">`+oth.map(id=>`<option value="${id}"${cur&&cur.id===id?' selected':''}>${mName(id)}${MVU[id]&&MVU[id][2]?' 威力'+MVU[id][2]:''}</option>`).join('')+'</optgroup>';
    return h};
  const itOpts=()=>{const cur=ED.s.it;let h=`<option value="">（なし）</option>`;
    if(cur&&cur.k&&!ITEMN[cur.k]||cur&&!cur.k&&cur.n)h+=`<option value="x" selected>${cur.n}（計算には使いません）</option>`;
    const ks=[...Object.keys(MEGA).filter(k=>itemFor(p.no,k)),...ITEM_ORDER,...Object.keys(ITEMN).filter(k=>!ITEM_ORDER.includes(k)&&!isStone(k))];
    return h+ks.map(k=>`<option value="${k}"${cur&&cur.k===k?' selected':''}>${ITEMN[k]}${ITEMT[k]?'（'+ITEMT[k]+'↑）':''}</option>`).join('')};
  const abOpts=()=>{const cur=ED.s.ab;let h='';
    if(!abl.length)h+=`<option value="${cur&&cur.k||''}">${cur&&cur.n||'（データなし）'}</option>`;
    return h+abl.map(([k,hid])=>`<option value="${k}"${cur&&cur.k===k?' selected':''}>${ABN[k]||k}${hid?'（隠れ特性）':''}${ABIMPL.has(k)?'':'　※計算では効果なし'}</option>`).join('')};
  V.innerHTML=`<div id="ed-root">
  <div class="row" style="border-bottom:1px solid var(--line)"><span class="av">${stamp(p)}</span><div class="row-m"><div class="row-t">${nm(p)}</div><div class="chips">${p.t.map(chip).join('')}</div></div></div>
  ${fresh?`<div class="bnote" style="margin:12px 16px 0">いまは<b>自動で決めた型</b>（よくある型）で計算しています。下の値を変えると、<b>あなたの育成</b>として保存され、選出アシストや模擬戦の計算に使われます。</div>`:''}
  <div class="btns" style="flex-wrap:wrap"><button class="btn btn-s" id="ed-pop">${SVG(I.zap,16)}よく使われている型を入れる</button></div>
  <div class="sec"><h2>特性・持ち物</h2></div>
  <div class="natr"><span style="width:56px">特性</span><select class="sel" id="ed-ab">${abOpts()}</select></div>
  <p class="note" id="ed-abd" style="padding:0 16px 6px">${ED.s.ab&&ABDS[ED.s.ab.k]?esc(ABDS[ED.s.ab.k]):''}</p>
  <div class="natr"><span style="width:56px">持ち物</span><select class="sel" id="ed-it">${itOpts()}</select></div>
  <div class="sec"><h2>技</h2><span style="font-size:13px;color:var(--dim)">覚える攻撃技から選ぶ</span></div>
  ${[0,1,2,3].map(k=>`<div class="natr"><span style="width:56px">技${k+1}</span><select class="sel" data-mv="${k}">${mvOpts(ED.s.mv[k])}</select></div>`).join('')}
  <p class="note" style="padding-top:2px;color:var(--mute)">変化技（おにび・トリックルームなど）も選べます。変化技と、カウンター・一撃必殺技など一部の技は育成として保存されますが、ダメージ計算・模擬戦では使いません。${LS_EST.has(p.no)?'<br><b>このポケモンの覚える技は、チャンピオンズ版のデータがまだ公開されていないため、本編のデータから推定しています。</b>':''}</p>
  <div class="sec"><h2>能力ポイント・性格</h2></div>
  <div class="calc">
    <div class="spbar"><div><div style="font-size:12px;color:var(--dim)">能力ポイント 残り</div><span class="big" id="ed-left">66</span><span style="color:var(--mute);font-size:12px"> / ${SP_TOTAL}</span></div>
      <button class="btn btn-s" style="flex:none;height:34px;padding:0 15px;font-size:12px" id="ed-zero">0にする</button></div>
    ${SN.map((n,i)=>`<div class="sprow"><em>${n}</em><input type="range" min="0" max="${SP_CAP}" value="${ED.s.sp[i]}" id="ed-sp${i}" aria-label="${n}に振る能力ポイント"><span class="v" id="ed-v${i}">0</span><span class="o" id="ed-o${i}">0</span></div>`).join('')}
    <div class="natr"><span>性格</span><select class="sel" id="ed-nat">${NATS.map(([n,u,d],j)=>`<option value="${j}"${(u===ED.s.up&&d===ED.s.dn)||(u<0&&!(ED.s.up>0))?' selected':''}>${n}${u>0?`（${SN[u]}↑ ${SN[d]}↓）`:''}</option>`).join('')}</select></div>
    <p class="note" id="ed-spd"></p>
  </div>
  ${pipBuildPanel()}
  <details class="edd"><summary>ゲームの実数値から入力する</summary>
    <p class="note" style="padding-top:6px">ゲームのステータス画面の数値（HP〜素早さ）を入れると、能力ポイントと性格を逆算します。</p>
    <div class="edgrid">${SN.map((n,i)=>`<label><span>${n}</span><input type="number" inputmode="numeric" id="ed-r${i}"></label>`).join('')}</div>
    <div class="btns"><button class="btn btn-p" id="ed-solve">能力ポイントを計算</button></div>
  </details>
  <div class="btns" style="flex-wrap:wrap"><a class="btn btn-p" href="#/team">完了</a><button class="btn btn-s" id="ed-clear" style="flex:none;padding:0 18px">未設定に戻す</button></div>
  <p class="note" style="color:var(--mute)">背面タップを使っている場合は、育成を変えたあと<a href="#/tap" style="color:var(--acc)">パーティコード</a>をショートカットに入れ直すと通知にも反映されます。<br>入力した内容はこの端末の中だけに保存されます。HP＝種族値＋ポイント＋75、ほかの能力＝（種族値＋ポイント＋20）×性格補正（Lv50）。</p>
  </div>`;
  const save=()=>{const cur=team[ED.idx];if(!cur||cur.no!==ED.no)return;
    const o=ED.s;cur.set={ab:o.ab,it:o.it,mv:o.mv.filter(Boolean),sp:[...o.sp],up:o.up,dn:o.dn,src:'manual'};saveTeam()};
  const upd=()=>{const o=ED.s,r=calcStats(p,o.sp,o.up,o.dn);
    r.forEach((v,i)=>{document.getElementById('ed-o'+i).textContent=v;document.getElementById('ed-v'+i).textContent=o.sp[i];
      const el=document.getElementById('ed-sp'+i);el.value=o.sp[i];el.style.setProperty('--p',(o.sp[i]/SP_CAP*100)+'%');
      const o2=document.getElementById('ed-o'+i);o2.style.color=o.up===i?'#ff8a7a':o.dn===i?'#7ab8ff':''});
    document.getElementById('ed-left').textContent=SP_TOTAL-o.sp.reduce((a,b)=>a+b,0);
    const sp=r[5],sc=o.it&&o.it.k==='choicescarf'?Math.floor(sp*1.5):0,eff=sc||sp;
    const slower=P.filter(q=>q.no!==p.no&&maxSpe(q)<eff).length,same=P.filter(q=>q.no!==p.no&&maxSpe(q)===eff).length;
    document.getElementById('ed-spd').innerHTML=`素早さ <b>${sp}</b>${sc?`（スカーフ込み <b>${sc}</b>）`:''}は、収録${P.length}匹の<b>最速</b>のうち <b>${slower}匹</b> より速いです${same?`（${same}匹と同速）`:''}。`};
  const touch=()=>{ED.dirty=true;save();upd();pipSchedule()};
  SN.forEach((_,i)=>document.getElementById('ed-sp'+i).oninput=e=>{const o=ED.s,others=o.sp.reduce((a,b,j)=>j===i?a:a+b,0);
    o.sp[i]=Math.max(0,Math.min(+e.target.value,SP_CAP,SP_TOTAL-others));touch()});
  document.getElementById('ed-zero').onclick=()=>{ED.s.sp=[0,0,0,0,0,0];touch()};
  document.getElementById('ed-nat').onchange=e=>{const n=NATS[+e.target.value];ED.s.up=n[1];ED.s.dn=n[2];touch()};
  document.getElementById('ed-ab').onchange=e=>{const k=e.target.value;ED.s.ab=k?{n:ABN[k]||k,k}:null;document.getElementById('ed-abd').textContent=ABDS[k]||'';touch()};
  document.getElementById('ed-it').onchange=e=>{const k=e.target.value;if(k==='x')return;ED.s.it=k?{n:ITEMN[k],k}:null;touch()};
  document.querySelectorAll('[data-mv]').forEach(el=>el.onchange=e=>{const k=+el.dataset.mv,v=e.target.value;if(v==='x')return;
    const id=+v;if(id&&ED.s.mv.some((m,j)=>j!==k&&m&&m.id===id)){toast('同じ技はえらべません');el.value=ED.s.mv[k]?String(ED.s.mv[k].id):'';return}
    ED.s.mv[k]=!v?null:id===182?{n:'まもる',id:182}:{n:mName(id),id};touch()});
  document.getElementById('ed-solve').onclick=()=>{const vals=SN.map((_,i)=>+document.getElementById('ed-r'+i).value);
    if(vals.some(v=>!(v>0))){toast('6つの数値をすべて入れてください');return}
    const r=solveStats(p,vals,null);if(!r){toast('この実数値になる配分が見つかりませんでした。数値を確かめてください');return}
    ED.s.sp=r.sp;ED.s.up=r.up;ED.s.dn=r.dn;document.getElementById('ed-nat').value=String(Math.max(0,NATS.findIndex(n=>n[1]===r.up&&n[2]===r.dn)));touch();toast('能力ポイントと性格を入れました')};
  document.getElementById('ed-pop').onclick=async e=>{const b=e.currentTarget;b.disabled=true;b.textContent='集計データを確認中…';
    let d=null;try{if(await liveInit())d=await liveMon(p.no)}catch(err){}
    const c=d?buildSet(p,d,true):chooseSet(p,true),sv=setToSaved(p,c);
    /* 技は集計の上位4つをそのまま入れる（変化技も含む） */
    const top4=d?d.mv.map(([n])=>MVKA[nrm(n)]).filter(id=>id&&LSD[p.no]&&LSD[p.no][1].includes(id)).slice(0,4).map(id=>({n:mName(id),id})):null;
    ED.s={...sv,mv:top4&&top4.length?top4:[...sv.mv]};while(ED.s.mv.length<4)ED.s.mv.push(null);save();
    toast(d?'使用率の集計（championsbattledata）で最も多い型を入れました':'集計データが取れないため、自動で決めた型を入れました');editView(String(idx))};
  document.getElementById('ed-clear').onclick=()=>{const cur=team[ED.idx];if(cur){delete cur.set;saveTeam()}toast('未設定に戻しました');nav('#/team')};
  upd();pipBuildBind(idx);
}

