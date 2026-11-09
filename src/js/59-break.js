/* ===================== 図鑑の「対策」タブ＝崩し方（2026/11/08 依頼主の要望） =====================
   前はタイプ一致で弱点を突けるポケモンを並べるだけで、「どう崩すか」が分からなかった。
   相手（p）の使用率の高い型（detSet）を mkMon にして、データだけから手順を作る（ほかのサイトの文章は使わない）：
   ①弱点と効きにくいタイプ（monDef＝特性込み）と、物理・特殊のどちらが通りやすいか（HP×防御 と HP×特防）
   ②素早さ（上を取るのに要る素早さ種族値・こだわりスカーフ・先制技）
   ③持ち物（BR_ITEM）・特性（BR_AB。型の特性＋持てるほかの特性は「特性が〇〇なら」）
   ④技（型の技：先制技・同じ技を続ける技・自分の能力が下がる技・交代技、積み技 boost、覚える回復技）
   ⑤受けるなら（型の攻撃技を全部半減以下で受けられるタイプ）
   そのあと monCounters（47-share.js）で「崩す役の例」を、理由（技・ダメージ・素早さ）つきで出す。
   検索向けの静的ページ counter/番号/（gen-pages）も breakSteps を使う。 */
const BR_ITEM={
  focussash:'<b>きあいのタスキ</b>を持っていることが多い。HPが満タンだと一撃では倒れないので、連続技・先制技でとどめを刺すか、設置技・天気で先に少し削ってから攻める。',
  choicescarf:'<b>こだわりスカーフ</b>で素早さが1.5倍になっていることがある。素早さで勝っているつもりでも先に攻撃されるので、HPに余裕のある匹で1回受け、技が1つに固定されたところで、その技を受けられる匹に交代して返す。',
  leftovers:'<b>たべのこし</b>で毎ターン少しずつ回復する。少しずつ削るより、2回までで倒しきれる火力の匹を当てる。',
  sitrusberry:'<b>オボンのみ</b>で、HPが半分を切ると1回だけ大きく回復する。「2回で倒せる」計算でも回復で3回かかることがあるので、一気に削るか、もうどくでじわじわ削る。',
  lumberry:'<b>ラムのみ</b>を持っていることがあり、状態異常は1回治される。状態異常で止める作戦は、あてにしすぎない。',
  lifeorb:'<b>いのちのたま</b>で火力が高いかわりに、攻撃するたびにHPが減る。受けられる匹で受けて、反動で削れたところを先制技や速い匹で倒す。',
  rockyhelmet:'<b>ゴツゴツメット</b>で、接触技で攻撃するとダメージを返される。特殊技や、触れない物理技で攻める。',
  whiteherb:'<b>しろいハーブ</b>で、下がった能力を1回元に戻される。いかくや能力を下げる技は、1回目は効かないと考える。',
  mentalherb:'<b>メンタルハーブ</b>で、ちょうはつ・アンコールで止めても1回は治される。',
  lightclay:'<b>ひかりのねんど</b>で壁（リフレクター・ひかりのかべ）を長く張ってくる。かわらわり・サイコファングで壁を壊すか、壁のターンが終わるまで交代やまもるで時間を稼ぐ。',
  airballoon:'<b>ふうせん</b>でじめん技が当たらない。先に別の技を当てて割ってから、じめん技を使う。',
  ejectbutton:'<b>だっしゅつボタン</b>で、攻撃すると手持ちに戻って後ろのポケモンが出てくる。後ろから出てくる相手にも強い匹で攻める。',
  redcard:'<b>レッドカード</b>で、攻撃すると控えと入れかえられる。積んでから攻撃すると上げた能力が消されるので、積まずに攻めるか、変化技で崩す。'};
const BR_AB={
  multiscale:'HPが満タンのときは受けるダメージが半分になる。連続技・設置技・天気・先制技で少しでも削ってから本命の技を当てる。',
  'shadow-shield':'HPが満タンのときは受けるダメージが半分になる。連続技・設置技・天気・先制技で少しでも削ってから本命の技を当てる。',
  sturdy:'HPが満タンからは一撃で倒れない。連続技を使うか、先に少し削ってから攻める。',
  disguise:'最初の1回の攻撃を防がれる。威力の低い技や連続技で先に化けの皮をはがす。',
  intimidate:'場に出たときにこちらの攻撃を下げてくる。物理アタッカーはあとから出すか、特殊アタッカーで攻める（まけんき・かちき・クリアボディの匹なら逆に有利）。',
  regenerator:'交代すると回復する。少しずつ削っても戻されるので、1〜2回で倒しきれる火力を当てる。',
  'magic-bounce':'変化技（ステルスロック・ちょうはつ・どくどく等）をはね返す。攻撃技で崩す。',
  'magic-guard':'どく・やけど・設置技・ゴツゴツメットのダメージを受けない。直接の攻撃で倒す。',
  unaware:'こちらが能力を上げても無視される。積まずに、そのままの高い火力で攻める。',
  prankster:'変化技を先に出してくる。あくタイプには、いたずらごころの変化技が効かない。',
  'speed-boost':'毎ターン素早さが上がっていく。出てきた最初のターンに倒すか、先制技で倒す。',
  guts:'状態異常になると攻撃が上がる。やけど・どくで止めようとしない。',
  'poison-heal':'どくになるとむしろ回復する。どく技を当てない。',
  'rough-skin':'接触技で攻撃するとダメージを返される。特殊技や触れない技で攻める。',
  'iron-barbs':'接触技で攻撃するとダメージを返される。特殊技や触れない技で攻める。',
  'flame-body':'接触技で攻撃すると、やけどになることがある。物理アタッカーは特に注意。',
  static:'接触技で攻撃すると、まひになることがある。',
  protean:'技を出すたびにその技のタイプに変わる。弱点が変わるので、タイプ相性より火力で押す。',
  libero:'技を出すたびにその技のタイプに変わる。弱点が変わるので、タイプ相性より火力で押す。',
  moxie:'相手を倒すたびに攻撃が上がる。倒されそうな匹で無理に戦わず、受けられる匹に交代する。',
  'huge-power':'攻撃が2倍になっている。物理技は見た目の種族値よりずっと強いので、防御の高い匹で受ける。',
  'pure-power':'攻撃が2倍になっている。物理技は見た目の種族値よりずっと強いので、防御の高い匹で受ける。',
  competitive:'能力を下げると、逆に特攻が上がる。いかくや能力を下げる技を使わない。',
  defiant:'能力を下げると、逆に攻撃が上がる。いかくや能力を下げる技を使わない。',
  'thick-fat':'ほのお・こおり技のダメージが半分になる。',
  levitate:'じめん技が当たらない。'};
const BR_LOCK=['outrage','thrash','petaldance','ragingfury'],BR_HPCOST=['steelbeam','mindblown','chloroblast'];
/* 技の役割（38-guide-moves.js の MOVE_ROLES の技の一覧）を引く */
const brRole=(id,r)=>{const k=MD[id]&&MD[id][3],R=MOVE_ROLES.find(x=>x[0]===r);return !!(k&&R&&R[R.length-1].includes&&R[R.length-1].includes(k))};
const brNames=a=>[...new Set(a)].map(x=>`「${x}」`).join('');
/* 素早さ s を上回るのに要る素早さ種族値（性格で上がる・能力ポイント最大）。スカーフなら sc=1.5 */
const brNeedBase=(s,sc=1)=>{for(let b=1;b<=255;b++)if(Math.floor(Math.floor((b+SP_CAP+20)*1.1)*sc)>s)return b;return null};

function breakSteps(p,c){
  c=c||monCounters(p);
  const s=c.set||detSet(p),M=mkMon(p,'op',s),st=M.st,nm0=formInfo(p).base,steps=[];
  const def=monDef(p),weak=def.filter(x=>x.m>=2).sort((a,b)=>b.m-a.m),res=def.filter(x=>x.m>0&&x.m<1).sort((a,b)=>a.m-b.m),imm=def.filter(x=>x.m===0);
  const fr=m=>m>=4?'4倍':m<=.25?'1/4':'';
  /* ①弱点・物理か特殊か */
  const phy=st[0]*st[2],spc=st[0]*st[4],r=phy/spc;
  const side=r>1.15?`特殊技の方が通りやすい（防御${st[2]}・特防${st[4]}）。`:r<1/1.15?`物理技の方が通りやすい（防御${st[2]}・特防${st[4]}）。`:`防御${st[2]}・特防${st[4]}で、物理・特殊どちらでも同じくらい通る。`;
  steps.push({h:'弱点を突く',t:`${weak.length?`弱点は${weak.map(x=>`<b>${x.t}</b>${fr(x.m)?'（'+fr(x.m)+'）':''}`).join('・')}。`:'弱点のタイプがない。等倍の高い威力の技で押す。'}${res.length?`${res.map(x=>x.t+(fr(x.m)?'（'+fr(x.m)+'）':'')).join('・')}は効きにくい。`:''}${imm.length?`${imm.map(x=>x.t).join('・')}は効かない${imm.some(x=>x.by)?'（特性による）':''}。`:''}${side}`});
  /* ②素早さ */
  const scarf=s.item==='choicescarf',sp=Math.floor(st[5]*(scarf?1.5:1)),nb=brNeedBase(sp),nbs=brNeedBase(sp,1.5);
  const prio=(s.moves||[]).filter(m=>m&&m.pow>0&&m.pri>0);
  steps.push({h:'素早さで上を取る',t:`使用率の高い型の素早さは<b>${sp}</b>${scarf?'（こだわりスカーフ込み）':''}。${nb?`上から動くには、素早さ種族値${nb}以上のポケモンを最速（性格で素早さを上げ、能力ポイント${SP_CAP}）にする${nbs&&nbs<nb?`。こだわりスカーフなら${nbs}以上でよい`:''}。`:'素早さで上を取るのは難しいので、先制技やトリックルームで動く。'}${prio.length?`ただし先制技${brNames(prio.map(m=>m.n))}を持つので、HPが減った匹で上から殴ろうとしても先に倒されることがある。`:'遅い匹は、先制技でとどめを刺すか、1回耐えてから返す。'}`});
  /* ③持ち物・特性 */
  const it=[];
  if(s.item&&BR_ITEM[s.item])it.push(BR_ITEM[s.item]);
  else if(s.item&&typeof RES_BERRY!=='undefined'&&RES_BERRY[s.item]){const t=RES_BERRY[s.item];it.push(`<b>${ITEMN[s.item]||s.item}</b>で、${t==='ノーマル'?'ノーマル技':'弱点の'+t+'技'}のダメージを1回半分にされる。一撃で倒せる計算でも耐えられることがあるので、2回目を当てられる匹で。`)}
  else if(s.item&&typeof MEGA!=='undefined'&&MEGA[s.item])it.push(`<b>メガシンカ</b>する型が多い。メガシンカの姿の種族値・特性で計算した崩し方も確かめる（このページの上の切りかえ）。`);
  if(M.ab&&BR_AB[M.ab])it.push(`特性<b>${ABN[M.ab]||M.ab}</b>：${BR_AB[M.ab]}`);
  (ABD[p.no]||[]).map(a=>a[0]).filter(a=>a!==M.ab&&BR_AB[a]).slice(0,2).forEach(a=>it.push(`特性が<b>${ABN[a]||a}</b>なら：${BR_AB[a]}`));
  if(it.length)steps.push({h:'持ち物と特性に気をつける',t:it});
  /* ④技 */
  const mv=[],atk=(s.moves||[]).filter(m=>m&&m.pow>0);
  const boost=[...new Set([...(s.boost?[s.boost].flat():[]),...(M.boost?[M.boost].flat():[])].map(b=>typeof b==='string'?b:b&&(b.n||b.k)).filter(Boolean))];
  const ls=(LSD[p.base||p.no]||LSD[p.no]||[0,[]])[1]||[];
  const boostN=boost.length?boost.map(b=>{const id=Object.keys(MD).find(i=>MD[i][3]===b);return id?mName(+id):b}):ls.filter(id=>MD[id]&&DU_BOOST[MD[id][3]]).map(id=>mName(id)).slice(0,2);
  if(boostN.length)mv.push(`${boost.length?'積み技':'覚える積み技'}${brNames(boostN)}で能力を上げて${boost.length?'くる':'くることがある'}。積まれる前に倒すか、ちょうはつ・あくび・ほえる・ドラゴンテール・くろいきりで止める。`);
  const heal=ls.filter(id=>MD[id]&&MD[id][3]!=='rest'&&brRole(id,'heal')).map(id=>mName(id)).slice(0,2);
  if(heal.length)mv.push(`回復技${brNames(heal)}を覚える。1回で削れる量が回復量より少ないと倒しきれないので、半分以上削れる匹を当てる。もうどくも有効。`);
  /* 同じ技を2〜3ターン出し続ける技は名前で決める（技のデータの e.o は「ほかの効果あり」の印で、出し続ける印ではない。2026/11/08 依頼主の指摘：てっていこうせんに出ていた） */
  const key=m=>MD[m.id]&&MD[m.id][3];
  const lock=atk.filter(m=>BR_LOCK.includes(key(m)));
  lock.forEach(m=>{const nt=T.filter(t=>mult(m.t,[t])===0);mv.push(`「${m.n}」は2〜3ターン同じ技を出し続ける。${nt.length?`${nt.join('・')}タイプには効かないので、そこへ交代すると`:'まもるで1ターン透かすと'}相手の動きが止まる。`)});
  const hpc=atk.filter(m=>BR_HPCOST.includes(key(m)));
  if(hpc.length)mv.push(`${brNames(hpc.map(m=>m.n))}は、使うと自分の最大HPの半分を失う。受けられる匹で1回受ければ、相手は自分で大きく削れる。`);
  const rc=atk.filter(m=>m.e&&m.e.rc&&!BR_HPCOST.includes(key(m)));
  if(rc.length)mv.push(`${brNames(rc.map(m=>m.n))}は反動で自分のHPも減る。受けて返すと、反動と合わせて早く倒せる。`);
  const drop=atk.filter(m=>m.e&&m.e.s&&m.e.s.some(x=>x[1]<0));
  if(drop.length)mv.push(`${brNames(drop.map(m=>m.n))}は使ったあと自分の能力が下がる。一度受けてから有利な匹を出すと、下がった相手を倒しやすい。`);
  const piv=atk.filter(m=>brRole(m.id,'pivot'));
  if(piv.length)mv.push(`${brNames(piv.map(m=>m.n))}で交代しながら攻めてくる。後ろから出てくる相手も考えて、2匹に強い匹を出す。`);
  if(mv.length)steps.push({h:'技の動きを読む',t:mv});
  /* ⑤受けるなら */
  const ats=[...new Set(atk.map(m=>m.t))];
  if(ats.length){const rt=T.filter(t=>ats.every(a=>mult(a,[t])<=.5));
    const w=c.wall.slice(0,3).map(r=>r.q.n);
    steps.push({h:'攻撃を受ける',t:`使用率の高い型の攻撃技は${ats.join('・')}タイプ。${rt.length?`<b>${rt.join('・')}</b>タイプなら全部を半減以下で受けられる。`:'1つのタイプで全部を半減できるタイプはないので、型の技をよく見て受ける。'}${w.length?`計算では${w.join('・')}などが35%未満しか受けない。`:''}`})}
  /* ひとこと */
  const best=[...c.ohko,...c.strong][0];
  const lead=`${nm0}は${weak.length?weak.slice(0,2).map(x=>x.t).join('・')+'が弱点':'弱点のタイプがなく'}、素早さは${sp}。${best?`使用率の高い型どうしで計算すると、<b>${best.q.n}</b>の${best.mv?'「'+esc(best.mv)+'」':'攻撃'}が${best.my>=100?'一撃で倒せる':'最大'+Math.round(best.my)+'%'}など、下の手順で崩せる。`:'1匹で崩すのは難しいので、下の手順で2匹がかりで崩す。'}`;
  return{lead,steps,set:s,sp,c};
}
/* 崩す役1匹の理由（技・ダメージ・素早さ・受けるダメージ） */
const brWhy=(p,r)=>{const n=formInfo(p).base,pc=v=>v>=100?'一撃で倒せる':`最大${Math.round(v)}%`;
  return `${r.fast?'先に動いて':'1回受けてから'}${r.mv?'「'+esc(r.mv)+'」で':''}${pc(r.my)}。${n}からは${r.tmv?'「'+esc(r.tmv)+'」で':''}${r.their>=100?'一撃で倒されるほど受けるが、先に動けば間に合う':'最大'+Math.round(r.their)+'%'}。`};
/* 手順の一覧（図鑑のタブと静的ページ counter/ で共通） */
const brStepsHTML=B=>`<h3>崩す手順</h3><ol class="gtips">${B.steps.map(x=>`<li><b>${x.h}</b>${Array.isArray(x.t)?`<ul>${x.t.map(y=>`<li>${y}</li>`).join('')}</ul>`:'：'+x.t}</li>`).join('')}</ol>`;
function breakHTML(p){
  let B;try{B=breakSteps(p)}catch(e){return '<p class="empty">計算できませんでした。</p>'}
  const {c}=B,s=B.set,href=q=>`#/p/${q.no}`;
  const setTxt=[s.item&&ITEMN[s.item]?'持ち物 '+ITEMN[s.item]:'',s.ab&&ABN[s.ab]?'特性 '+ABN[s.ab]:'',(s.moves||[]).map(m=>m&&m.n).filter(Boolean).join('・')].filter(Boolean).join('／');
  const rows=(a,f)=>a.length?a.slice(0,5).map(r=>`<a class="row" href="${href(r.q)}"><span class="av">${stamp(r.q)}</span><div class="row-m"><div class="row-t">${nm(r.q)}</div><div class="row-s" style="white-space:normal">${f(r)}</div></div><span class="chev">${SVG(I.chev,18)}</span></a>`).join(''):'<p class="note" style="padding-top:0">当てはまるポケモンは見つかりませんでした。</p>';
  const sec=(h,sub,a,f)=>`<div class="sec"><h2>${h}</h2></div><p class="note" style="padding-top:0">${sub}</p>${rows(a,f)}`;
  const n=formInfo(p).base,cs=counters(p.t).filter(q=>q.no!==p.no).slice(0,12);
  return `<div class="gdoc"><h2>${esc(n)}の崩し方</h2><p>${B.lead}</p>
    ${brStepsHTML(B)}
    <p class="note" style="padding:8px 0 0">計算の前提：${esc(n)}は使用率の高い型（${esc(setTxt)||'—'}）。こちらは合計種族値の高いポケモンとメガシンカの姿を、それぞれの使用率の高い型で計算しています。乱数・急所・育成の違いで結果は変わります。</p></div>
  ${sec('上から一撃で倒せる','先に動けて、1回の攻撃で倒せる相手です。',c.ohko,r=>brWhy(p,r))}
  ${sec('強く出られる',`半分以上削れて、${esc(n)}からは半分未満しか受けない相手です。`,c.strong,r=>brWhy(p,r))}
  ${sec('受けてから返せる',`${esc(n)}の攻撃が35%未満しか入らないので、交代で受けてから反撃できる相手です。`,c.wall,r=>`${esc(n)}の攻撃は最大${Math.round(r.their)}%${r.tmv?'（'+esc(r.tmv)+'）':''}。こちらの${r.mv?'「'+esc(r.mv)+'」':'攻撃'}は${r.my>=100?'一撃で倒せる':'最大'+Math.round(r.my)+'%'}。`)}
  ${sec('出すと危ない',`${esc(n)}から半分以上受けて、こちらは3割未満しか削れない相手です。${esc(n)}が見えたら、出すのを考え直しましょう。`,c.threat,r=>`${esc(n)}の${r.tmv?'「'+esc(r.tmv)+'」で':''}${r.their>=100?'一撃で倒される':'最大'+Math.round(r.their)+'%'}。こちらは最大${Math.round(r.my)}%。`)}
  <div class="btns" style="flex-wrap:wrap"><a class="btn btn-s" href="#/calc">自分の育成でダメージ計算</a><a class="btn btn-s" href="#/memo/${p.base||p.no}">戦術メモに書く</a></div>
  <details class="gdoc"><summary>タイプ一致で弱点を突けるポケモン（合計種族値の高い順）</summary>${cs.map(q=>rowP(q)).join('')||'<p class="empty">該当するポケモンがいません。</p>'}</details>`;
}
