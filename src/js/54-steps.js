/* ===================== パーティ作りの道のり（2026/11/05 依頼主の要望） =====================
   ポケモンを決めたあと、技 → 持ち物 → 能力ポイントと性格 まで寄り添う。
   育成をまだ入れていないことを「気になる点」として責めるのではなく、「次にやること」として1つずつ案内する。
   ・パーティの画面の「育成」「チェック」タブの上に出す（全部そろったら出さない）
   ・各段階の「次は〇〇の△△を決める」で、その匹の育成画面（#/edit/番号）へ
   ・「おすすめの型でまとめて埋める」：まだ決めていないところだけを、計算で組んだ型（archSets）で埋める。決めたところは変えない */
const tsHas={
  mv:x=>!!(x.set&&x.set.mv&&x.set.mv.length),
  it:x=>!!(x.set&&x.set.it&&x.set.it.k),
  sp:x=>!!(x.set&&Array.isArray(x.set.sp)&&x.set.sp.some(v=>v>0))
};
function teamStepsHTML(){
  if(!team.length)return '';
  const n=team.length,cnt=k=>team.filter(tsHas[k]).length;
  const steps=[
    {k:'mon',t:'ポケモンを6匹そろえる',c:n,of:6},
    {k:'mv',t:'技を決める',c:cnt('mv'),of:n},
    {k:'it',t:'持ち物を決める',c:cnt('it'),of:n},
    {k:'sp',t:'能力ポイントと性格を決める',c:cnt('sp'),of:n}
  ];
  if(steps.every(s=>s.c>=s.of))return '';
  const curI=steps.findIndex(s=>s.c<s.of),cur=steps[curI];
  const nm=i=>esc(byNo[team[i].no]?formInfo(byNo[team[i].no]).base:'');
  let next='';
  if(cur.k==='mon')next=`<a class="btn btn-p ts-go" href="#/pair">${SVG(I.search,17)}相性のいい仲間を探す（あと${6-n}匹）</a><a class="btn btn-s ts-go" href="#/kodawari">こだわり条件で組む</a>`;
  else{const i=team.findIndex(x=>!tsHas[cur.k](x));
    const w={mv:'技',it:'持ち物',sp:'能力ポイントと性格'}[cur.k];
    next=`<a class="btn btn-p ts-go" href="#/edit/${i}">次は${nm(i)}の${w}を決める</a>`}
  const pct=Math.round(steps.reduce((t,s)=>t+Math.min(1,s.c/s.of),0)/steps.length*100);
  const why={mon:'6匹そろうと、パーティ全体の弱点や組み合わせを見られます。',
    mv:'技が決まると、「先制技があるか」「能力を上げた相手を止められるか」「どのタイプを突けるか」などを、実際の技で確かめられます。',
    it:'持ち物が決まると、こだわりスカーフ・きあいのタスキ・メガストーンなどを入れた、より本番に近いチェックになります。',
    sp:'最後の仕上げです。能力ポイントと性格が決まると、ダメージや素早さの計算が正確になります。'}[cur.k];
  return `<section class="ts">
    <div class="ts-h"><b>パーティ作りの進み具合</b><span class="num">${pct}%</span></div>
    <div class="ts-bar"><i style="width:${pct}%"></i></div>
    <ol class="ts-l">${steps.map((s,i)=>`<li class="${s.c>=s.of?'done':i===curI?'now':''}"><span class="ts-dot">${s.c>=s.of?'✓':i+1}</span><span class="ts-t">${s.t}</span><span class="ts-c num">${Math.min(s.c,s.of)}/${s.of}</span></li>`).join('')}</ol>
    <p class="ts-why">${why}</p>
    <div class="ts-btns">${next}${team.some(x=>!tsHas.mv(x)||!tsHas.it(x)||!tsHas.sp(x))?`<button class="btn btn-s ts-go" id="ts-fill">おすすめの型でまとめて埋める</button>`:''}</div>
    ${team.some(x=>!tsHas.mv(x)||!tsHas.it(x)||!tsHas.sp(x))?'<p class="note" style="padding:6px 0 0">「まとめて埋める」は、まだ決めていないところだけを計算で組んだ型で埋めます。決めたところは変えず、あとから自由に変えられます。</p>':''}
  </section>`;
}
function teamStepsBind(root){
  const b=root&&root.querySelector('#ts-fill');if(!b)return;
  b.onclick=async()=>{
    if(!await askConfirm({title:'おすすめの型で埋めますか？',text:'まだ決めていない技・持ち物・能力ポイントと性格だけを、計算で組んだ型で埋めます。決めたところは変わりません。',ok:'埋める',danger:false}))return;
    const mons=team.map(x=>byNo[x.no]).filter(Boolean);
    let ss=[];try{ss=archSets(['axis'],mons)}catch(e){toast('型を組めませんでした');return}
    const usedIt=new Set(team.map(x=>x.set&&x.set.it&&x.set.it.k).filter(Boolean));
    /* メガシンカの枠：持ち物をもう決めた匹は変えない。パーティのメガストーンが2つ未満なら、持ち物が空いている匹から足す（型の例の持ち物より優先） */
    const haveStone=[...usedIt].filter(k=>isStone(k)).length;
    const mp=haveStone>=2?[]:megaPick(mons,team.map(x=>tsHas.it(x)),2-haveStone).filter(x=>!usedIt.has(x.k));
    mp.forEach(({i,k})=>{if(ss[i])ss[i]={...ss[i],item:k}});
    /* 型の例の中のメガストーンのうち、ここで選ばなかったものは外す（3つ以上にしない） */
    ss.forEach((s,i)=>{if(s&&isStone(s.item)&&!mp.some(x=>x.i===i)){
      const alt=['lifeorb','expertbelt','sitrusberry','leftovers','focussash','lumberry','rockyhelmet'].find(k=>!usedIt.has(k)&&!ss.some(o=>o&&o.item===k));ss[i]={...s,item:alt||null}}});
    let filled=0;
    team.forEach((x,i)=>{const g=ss[i]&&toSaved(ss[i]);if(!g)return;const s={...(x.set||{})};let ch=false;
      if(!tsHas.mv(x)&&g.mv&&g.mv.length){s.mv=g.mv;ch=true}
      if(!tsHas.it(x)&&g.it&&!usedIt.has(g.it.k)){s.it=g.it;usedIt.add(g.it.k);ch=true}
      if(!tsHas.sp(x)&&g.sp){s.sp=g.sp;s.up=g.up;s.dn=g.dn;ch=true}
      if(!s.ab&&g.ab){s.ab=g.ab;ch=true}
      if(ch){x.set={...s,src:x.set&&x.set.src||'copy'};filled++}});
    saveTeam();toast(filled?`${filled}匹の育成を埋めました（あとから変えられます）`:'埋められるところがありませんでした');teamRender();
  };
}
