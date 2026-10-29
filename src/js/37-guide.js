/* ===================== 攻略ガイド（道具・戦術）：当サイトのオリジナルの文章 =====================
   方針：ほかの攻略サイトの記事は使わない（読んで書き直すこともしない）。ゲームのしくみの理解と、
   このサイトのデータ（種族値・覚える技・ダメージ計算）から書く。数値はダメージ計算で使っている値と同じ。
   #/learn（入口）・#/item/キー（道具）・#/word/ID（戦術・用語）。メガストーンはデータから自動で説明を作る。 */
const TYPE_ITEM={};for(const k in ITEMT)TYPE_ITEM[ITEMT[k]]=k;
/* 例のポケモンをデータから選ぶ */
const gSort=(f,n=5)=>[...P].filter(p=>f(p)>-1e9).sort((a,b)=>f(b)-f(a)).slice(0,n);
const offense=p=>Math.max(p.s[1],p.s[3]);
const ITEM_GUIDE={
  choicescarf:{cat:'こだわり系',fx:'素早さが1.5倍になる。そのかわり、最初に選んだ技しか出せなくなる（引っ込めると解除）。',
    use:'もう少しで相手を追い抜ける「中くらいの速さ」のアタッカーに持たせると、先に攻撃して倒しきる役になれる。技が固定されるので、相手の交代や受けに弱い点に注意。終盤の「速い相手の掃除役」として強い。',
    ex:()=>gSort(p=>p.s[5]>=75&&p.s[5]<=105?offense(p)+p.s[5]*.5:-1e9)},
  choiceband:{cat:'こだわり系',fx:'攻撃が1.5倍になる（物理技のダメージがおよそ1.5倍）。最初に選んだ技しか出せなくなる。',
    use:'物理技の一撃で大きく削りたいときに。受けに出てきた相手も押し切れる火力が出るが、技が固定されるので、出す技を読まれると交代で流される。',
    ex:()=>gSort(p=>p.s[1]>p.s[3]+15?p.s[1]:-1e9)},
  choicespecs:{cat:'こだわり系',fx:'特攻が1.5倍になる（特殊技のダメージがおよそ1.5倍）。最初に選んだ技しか出せなくなる。',
    use:'こだわりハチマキの特殊版。範囲の広い技や一貫しやすいタイプの技を持つ特殊アタッカーに向く。',
    ex:()=>gSort(p=>p.s[3]>p.s[1]+15?p.s[3]:-1e9)},
  lifeorb:{cat:'火力アップ',fx:'攻撃技のダメージがおよそ1.3倍。そのかわり、攻撃するたびに最大HPの1/10を失う。',
    use:'技を固定されずに火力を上げたいときの定番。いろいろな技を打ち分けたいアタッカーに向く。反動でHPが減るので、長く場に居座る役には向かない。',
    ex:()=>gSort(p=>offense(p)+p.s[5]*.4)},
  expertbelt:{cat:'火力アップ',fx:'効果がばつぐんの技のダメージが1.2倍になる。',
    use:'いろいろなタイプの技を持ち、弱点を突き分けるアタッカーに。反動も技の固定もないかわりに、等倍の相手には効果がない。',ex:()=>gSort(p=>offense(p))},
  muscleband:{cat:'火力アップ',fx:'物理技の威力が1.1倍になる。',use:'効果は小さいが、反動も技の固定もない。ほかに持たせたい道具がないときの物理アタッカー向け。',ex:()=>gSort(p=>p.s[1]>p.s[3]?p.s[1]:-1e9)},
  wiseglasses:{cat:'火力アップ',fx:'特殊技の威力が1.1倍になる。',use:'ちからのハチマキの特殊版。',ex:()=>gSort(p=>p.s[3]>p.s[1]?p.s[3]:-1e9)},
  focussash:{cat:'耐久・回復',fx:'HPが満タンのときに一撃で倒される攻撃を受けても、HP1で耐える（1回使うとなくなる）。',
    use:'耐久が低くても、確実に1回は行動したい役に。起点作り（壁・天気・トリックルームなど）や、相打ち覚悟のアタッカーと相性がよい。連続技や、天気・やけどなどの小さなダメージを先に受けると効果が消える点に注意。',
    ex:()=>gSort(p=>p.s[5]-(p.s[0]+p.s[2]+p.s[4])/3)},
  sitrusberry:{cat:'耐久・回復',fx:'HPが半分以下になると、最大HPの1/4を回復する（1回）。',
    use:'長く場に残って何度も行動したい役に。1回きりだが回復量が大きく、相手の確定数（何回の攻撃で倒れるか）をずらせることがある。',ex:()=>gSort(p=>p.s[0]+p.s[2]+p.s[4])},
  assaultvest:{cat:'耐久・回復',fx:'特防が1.5倍になる。そのかわり、変化技（攻撃しない技）が使えなくなる。',
    use:'攻撃技だけで戦う、HPの多いアタッカーに。特殊技を受けながら殴り返す役になれる。',ex:()=>gSort(p=>p.s[0]+p.s[4]+offense(p)*.5)},
  leftovers:{cat:'耐久・回復',fx:'毎ターンの終わりに、最大HPの1/16を回復する。',
    use:'まもる・みがわりなどでターンを稼ぐ戦い方や、受けて何度も交代で出る役に。1回の量は少ないが、長い試合ほど差がつく。',ex:()=>gSort(p=>p.s[0]*1.2+p.s[2]+p.s[4])}
};
for(const t in TYPE_ITEM){const k=TYPE_ITEM[t];ITEM_GUIDE[k]={cat:'タイプ強化',type:t,fx:`${t}タイプの技の威力が1.2倍になる。`,
  use:`${t}タイプの技をメインに戦うポケモンに。いのちのたまより上がり方は小さいが、反動がない。こだわり系と違って技も固定されない。`,
  ex:()=>gSort(p=>p.t.includes(t)?offense(p):-1e9)}}
/* メガストーン：データから説明を作る */
function megaGuide(k){
  const tgt=MEGA[k];if(!tgt)return null;const [base,mno]=Object.entries(tgt)[0],p=byNo[+base],m=byNo[mno];if(!p||!m)return null;
  const up=SN.map((n,i)=>({n,d:m.s[i]-p.s[i]})).filter(x=>x.d).sort((a,b)=>b.d-a.d);
  const tch=m.t.join('')!==p.t.join('');
  return{cat:'メガストーン',mega:true,base:p,form:m,
    fx:`${formInfo(p).base}に持たせると、バトル中にメガシンカできる（メガシンカは1試合に1匹だけ）。`,
    use:`種族値の合計が${m.bst-p.bst>0?m.bst-p.bst+'上がる':'変わる'}（${up.map(x=>`${x.n}${x.d>0?'+':''}${x.d}`).join('・')}）。${tch?`タイプが${p.t.join('・')}から${m.t.join('・')}に変わる。`:''}特性は「${ABN[m.ab]||m.ab||'—'}」になる。${m.s[5]>p.s[5]?'素早さも上がるので、メガシンカした後に先手を取れる相手が変わる点を計算に入れよう。':m.s[5]<p.s[5]?'素早さは下がるので、メガシンカした後に先手を取れる相手が変わる点に注意。':''}ほかの道具を持てないので、持ち物の効果とメガシンカのどちらが強いかで選ぶ。`}}
const itemG=k=>ITEM_GUIDE[k]||megaGuide(k);
/* ---- 戦術・用語（当サイトの説明） ---- */
const WORDS=[
 ['taimen','対面構築（たいめん）','交代をあまりせず、場に出たポケモン同士の1対1を次々に有利に進めて勝つ考え方。速さと火力、きあいのタスキなどで「行動する回数」を確保するのが中心になる。','#/assist'],
 ['cycle','サイクル','不利な相手が出てきたら、その攻撃を受けられる味方に交代しながら、少しずつ有利な形を作っていく考え方。交代先が攻撃を受けても倒れないこと（耐性と耐久）が大事。','#/report'],
 ['kiten','起点作り','壁・天気・トリックルーム・ちょうはつなど、味方が戦いやすい状況を先に作る役。自分は倒れてもよいので、後ろのアタッカーが安全に動けるようにする。','#/word/kabe'],
 ['tsumi','積み技','つるぎのまい・りゅうのまいのように、自分の能力を上げる技。1回積むと勝負が決まることもあるので、相手が積む前に大きく削るか、積んだ相手を止める手段（ちょうはつ・ほえる・素早さで上をとるなど）を用意する。','#/assist'],
 ['sensei','先制技','優先度が高く、素早さに関係なく先に出せる技（でんこうせっか・しんそくなど）。威力は低めだが、削れた速い相手にとどめを刺すときに強い。','#/calc'],
 ['speedctl','素早さ操作','おいかぜ（味方の素早さ2倍）、トリックルーム（遅い順に行動）、素早さを下げる技などで、先に動ける側を入れかえること。ダブルでは特に重要。','#/word/tr'],
 ['tr','トリックルーム','5ターンの間、素早さの遅いポケモンから先に動くようになる技。遅くて強いポケモンを活かせる。相手に使われたら、まもる・交代でターンを稼ぐか、使われる前に倒すのが基本。','#/assist'],
 ['weather','天気（はれ・あめ・すなあらし・ゆき）','場の天気によって、ほのお・みずの技の威力や、特定の特性・技の効果が変わる。天気を変える特性を持つポケモンは、出てくるだけで天気が変わる。後から出したほうの天気が残るので、天気の取り合いになることもある。','#/calc'],
 ['kabe','壁（リフレクター・ひかりのかべ）','5ターンの間、味方が受ける物理（リフレクター）・特殊（ひかりのかべ）のダメージを減らす技。起点作りの定番。急所に当たると壁の効果は無視される。','#/calc'],
 ['ikkan','一貫性','ある技のタイプを、相手の選出の誰も半減以下で受けられない状態。一貫している技を持つアタッカーは強く、逆にこちらの選出の多くに通る技があると危ない。','#/report'],
 ['ukedashi','受け出し','味方が倒れる前に、相手の攻撃を受けられるポケモンに交代すること。相手の技を読んで、半減・無効のタイプや耐久の高いポケモンを出す。','#/types'],
 ['kezuri','削り・圏内','相手のHPを、次の攻撃で倒せる量（圏内）まで減らしておくこと。後ろのポケモンの先制技やとどめの一撃が届くようにする考え方。','#/calc'],
 ['kakutei','確定数・乱数','ダメージには15%ほどの幅（乱数）がある。「確定1発」はどの乱数でも1回で倒せること、「乱数1発」は運がよければ1回で倒せること。このサイトのダメージ計算は乱数16段階すべてで確かめられる。','#/calc'],
 ['doosoku','同速','素早さの値が同じこと。同速のポケモン同士は、どちらが先に動くかが毎回ランダムになる。1でも上回れるように能力ポイントを調整することを「抜き調整」という。','#/dex'],
 ['itchi','タイプ一致','ポケモン自身のタイプと同じタイプの技は、威力が1.5倍になる（特性によってはさらに上がる）。種族値とタイプ一致技の組み合わせが、そのポケモンの主な攻撃手段になる。','#/calc'],
 ['senshutsu','選出','対戦の前にお互いの6匹を見て、シングルでは3匹、ダブルでは4匹を選ぶこと。相手が何を出してきそうかを読み、先発と控えを決める。このサイトの選出アシストで計算できる。','#/assist'],
 ['mega','メガシンカ','メガストーンを持ったポケモンが、バトル中に姿を変えて能力が上がること。1試合に1匹だけ。メガシンカ候補が複数いる相手には、どれがメガストーンを持っているかを技や素早さから見極める。','#/learn/item'],
 ['double','ダブルの基本','2匹ずつ戦う形式。ねこだまし（1ターン目に相手をひるませる）、まもる、全体技、2匹で1匹を集中して攻撃すること、このゆびとまれ（攻撃を引きつける）など、シングルとは違う考え方が多い。','#/assist'],
 ['lock','こだわりの読み','こだわり系の道具を持った相手は、交代するまで同じ技しか出せない。1回技を見たら、その技を受けられるポケモンに交代して有利をとる。逆に、相手の交代先を読んで技を選ぶことも大事。','#/learn/item'],
 ['sp','能力ポイント','ポケモンチャンピオンズで、能力を伸ばすためのポイント。合計66・1項目32まで振れる。このサイトの計算はすべてこの仕組みに対応している。','#/guide']
];
const wordOf=id=>WORDS.find(w=>w[0]===id);
const gEx=g=>{try{return(g.ex?g.ex():[]).filter(Boolean)}catch(e){return[]}};
function learnView(a){
  setHeader('攻略ガイド','#/tools');
  const tab=['word','move','ability'].includes(a)?a:'item';
  const TABS=[['item','道具'],['move','技'],['ability','特性'],['word','戦術・用語']],ti=TABS.findIndex(x=>x[0]===tab);
  const cats={};for(const k in ITEMN){const g=itemG(k);if(!g)continue;(cats[g.cat]=cats[g.cat]||[]).push(k)}
  const order=['こだわり系','火力アップ','耐久・回復','タイプ強化','メガストーン'];
  V.innerHTML=`<div class="seg" id="lr-seg">${TABS.map(([k,l])=>`<button data-lt="${k}" aria-selected="${k===tab}">${l}</button>`).join('')}<span class="seg-i" style="width:25%;transform:translateX(${ti*100}%)"></span></div>
  <p class="note" style="padding-top:12px">${({item:'ダメージ計算で扱っている持ち物の効果と使いどころです。',move:'技を役割ごとに分けて、使いどころをまとめました。技を押すと、覚えるポケモンも見られます。',ability:'特性を役割ごとに分けて、使い方をまとめました。特性を押すと、持つポケモンも見られます。',word:'対戦でよく使われる考え方と言葉です。'})[tab]}すべて当サイトが書いた説明で、数値は当サイトの計算と同じ前提です。</p>
  ${tab==='move'?learnMovesHTML():tab==='ability'?learnAbilitiesHTML():tab==='item'?order.filter(c=>cats[c]).map(c=>`<div class="sec"><h2>${c}</h2><span style="font-size:12px;color:var(--dim)">${cats[c].length}</span></div>${cats[c].map(k=>{const g=itemG(k);
    return `<a class="row" href="#/item/${k}">${g.mega?`<span class="av">${stamp(g.form)}</span>`:`<span class="ttile-i">${SVG(g.type?I.zap:g.cat==='耐久・回復'?I.shield:I.star,20)}</span>`}<div class="row-m"><div class="row-t">${esc(ITEMN[k])}</div><div class="row-s">${esc(g.mega?`${formInfo(g.base).base}がメガシンカ`:g.fx)}</div></div><span class="chev">${SVG(I.chev,18)}</span></a>`}).join('')}`).join('')
   :WORDS.map(([id,t,d])=>`<a class="row" href="#/word/${id}"><div class="row-m"><div class="row-t">${esc(t)}</div><div class="row-s">${esc(d.slice(0,44))}…</div></div><span class="chev">${SVG(I.chev,18)}</span></a>`).join('')}`;
  V.querySelectorAll('[data-lt]').forEach(b=>b.onclick=()=>nav('#/learn/'+b.dataset.lt));
}
function itemView(k){
  const g=itemG(k);if(!g||!ITEMN[k]){V.innerHTML='<p class="empty">道具が見つかりません。</p>';return}
  setHeader(esc(ITEMN[k]),'#/learn/item');
  const ex=g.mega?[g.form]:gEx(g);
  V.innerHTML=`<div class="gdoc"><span class="atag">${g.cat}</span><h2>${esc(ITEMN[k])}</h2>
    <h3>効果</h3><p>${esc(g.fx)}</p><h3>${g.mega?'メガシンカすると':'使いどころ'}</h3><p>${esc(g.use)}</p>
    ${g.mega?`<div class="gmega">${nm(g.base)} → ${nm(g.form,{no:false})}</div>`:''}</div>
    ${ex.length?`<div class="sec"><h2>${g.mega?'メガシンカの姿':'持たせる候補の例'}</h2><span style="font-size:12px;color:var(--dim)">${g.mega?'':'種族値から自動で選んだ例'}</span></div>${ex.map(p=>p.roles?rowP(p):`<a class="row" href="#/p/${p.base||p.no}"><span class="av">${stamp(p)}</span><div class="row-m"><div class="row-t">${nm(p)}</div><div class="chips">${p.t.map(chip).join('')}</div></div><div class="row-n"><b>${p.bst}</b><span>合計</span></div><span class="chev">${SVG(I.chev,18)}</span></a>`).join('')}`:''}
    <div class="btns"><a class="btn btn-s" href="#/calc">ダメージ計算で試す</a></div>
    <p class="note" style="color:var(--mute)">当サイトが書いた説明です。効果の数値は本編（スカーレット・バイオレット）と同じ前提で、当サイトのダメージ計算と同じ値です。ゲーム内で確かめていないものもあります。</p>`;
}
function wordView(id){
  const w=wordOf(id);if(!w){V.innerHTML='<p class="empty">見つかりません。</p>';return}
  setHeader(esc(w[1].replace(/（.*$/,'')),'#/learn/word');
  const rel=WORDS.filter(x=>x[0]!==id&&(w[2].includes(x[1].replace(/（.*$/,''))||x[2].includes(w[1].replace(/（.*$/,'')))).slice(0,4);
  V.innerHTML=`<div class="gdoc"><span class="atag">戦術・用語</span><h2>${esc(w[1])}</h2><p>${esc(w[2])}</p></div>
    ${w[3]?`<div class="btns"><a class="btn btn-p" href="${w[3]}">このサイトで試す</a></div>`:''}
    ${rel.length?`<div class="sec"><h2>関係する言葉</h2></div>${rel.map(x=>`<a class="row" href="#/word/${x[0]}"><div class="row-m"><div class="row-t">${esc(x[1])}</div></div><span class="chev">${SVG(I.chev,18)}</span></a>`).join('')}`:''}
    <p class="note" style="color:var(--mute)">当サイトが書いた説明です。</p>`;
}
/* 検索から道具・用語も見つけられるように */
function guideSearch(q){
  const t=kata(q.replace(/^[#＃]/,'').trim()).toLowerCase();if(!t)return'';
  const its=Object.keys(ITEMN).filter(k=>itemG(k)&&(ITEMN[k].toLowerCase().includes(t)||(LANG==='en'?false:kata(ITEMN[k]).includes(t)))).slice(0,5);
  const ws=WORDS.filter(w=>kata(w[1]).toLowerCase().includes(t)).slice(0,5);
  const mvs=Object.keys(MD).map(Number).filter(id=>mName(id).toLowerCase().includes(t)||(LANG!=='en'&&kata(mName(id)).includes(t))).slice(0,5);
  const abs=Object.keys(ABDS).filter(k=>ABN[k]&&(ABN[k].toLowerCase().includes(t)||(LANG!=='en'&&kata(ABN[k]).includes(t)))).slice(0,5);
  if(!its.length&&!ws.length&&!mvs.length&&!abs.length)return'';
  return `<div class="sec"><h2>攻略ガイド</h2></div>${its.map(k=>`<a class="row" href="#/item/${k}"><div class="row-m"><div class="row-t">${esc(ITEMN[k])}</div><div class="row-s">道具・${esc(itemG(k).cat)}</div></div><span class="chev">${SVG(I.chev,18)}</span></a>`).join('')}${mvs.map(id=>`<a class="row" href="#/move/${id}"><div class="row-m"><div class="row-t">${esc(mName(id))}</div><div class="row-s">技</div></div><span class="chev">${SVG(I.chev,18)}</span></a>`).join('')}${abs.map(k=>`<a class="row" href="#/ability/${k}"><div class="row-m"><div class="row-t">${esc(ABN[k])}</div><div class="row-s">特性</div></div><span class="chev">${SVG(I.chev,18)}</span></a>`).join('')}${ws.map(w=>`<a class="row" href="#/word/${w[0]}"><div class="row-m"><div class="row-t">${esc(w[1])}</div><div class="row-s">戦術・用語</div></div><span class="chev">${SVG(I.chev,18)}</span></a>`).join('')}`;
}
