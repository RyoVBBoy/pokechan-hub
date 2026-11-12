/* ===================== ツールの使い方（2026/11/12 依頼主：はじめての人がツールの使い方を分からない） =====================
   ・はじめてそのツールを開いたときだけ、画面の上に「はじめての方へ」のカード（手順2〜4つ）を出す。
     「わかった」で閉じると、その端末では次から出さない（localStorage pchowto）。「くわしい使い方」は #/help/ID へ。
   ・ヘルプセンター（左のメニュー）に「ツールの使い方」＝ #/help（全部の一覧）・#/help/ID（1つずつ）。
   ・カードは #view の外（すぐ前）に置くので、画面があとから描き直されても消えない。画面を移ると消える。
   ・説明はサイトの画面の言葉で書く（ほかのサイトの文章は使わない）。 */
const HOWTO={
  team:{t:'パーティ',ic:'grid',lead:'自分のパーティ（6匹）を作り、育成・弱点・選出をまとめて見る画面です。',
    steps:['上の6つの枠の「追加する」を押して、ポケモンを選びます（名前を打つと絞り込めます）。',
      '「育成」タブでポケモンを押すと、技・持ち物・性格・能力ポイントを決められます。「おすすめの型でまとめて埋める」で一度に入れることもできます。',
      '「チェック」タブで、よく使われる相手に対する弱点や、改善案を確かめます。',
      '「構築と選出」タブで、おすすめの選出（だれを出すか）と先発を確かめます。'],
    tips:['パーティは3つまで保存できます。ログインすると、ほかの端末でも同じパーティを使えます。','ゲームのチーム画面のスクショから、まとめて取り込むこともできます（「画像から取り込む」）。']},
  assist:{t:'選出アシスト',ic:'target',lead:'相手の6匹から、自分のパーティのだれを出すとよいか、先発はだれか、相手がだれを出してきそうかを計算します。',
    steps:['先に「パーティ」の画面で自分のパーティを作っておきます。',
      '相手の6匹を入れます。名前で選ぶほか、「タイプで探す」や、選出画面のスクショから読み取る方法（ログインが必要）もあります。',
      'おすすめの選出・先発・相手の選出予想と、その理由が出ます。'],
    tips:['PiP を使うと、対戦中にゲームの上で結果を見られます。']},
  calc:{t:'ダメージ計算',ic:'calc',lead:'攻撃する側と受ける側を選んで、技のダメージが何％になるか、何回で倒せるかを計算します。',
    steps:['上の「攻撃する」と「受ける」のポケモンを選びます。',
      '技を押すと、その技のダメージ（％）と、何回で倒せるか（確定数）がすぐ下に出ます。',
      '真ん中の回る矢印のボタンで、攻撃する側と受ける側を入れかえられます。'],
    tips:['「育成を変える」で、性格・能力ポイント・持ち物などを細かく変えられます。','「あなたの育成」を選ぶと、パーティで登録した育成で計算します。']},
  types:{t:'タイプ相性',ic:'zap',lead:'相手のポケモンやタイプから、効く技のタイプと、出すとよいポケモンを調べます。',
    steps:['相手のポケモン（またはタイプ）を選びます。','効果ばつぐんのタイプ・いまひとつのタイプと、出すとよいポケモンが出ます。'],
    tips:['「早見表」で18タイプの相性を一覧で見られます。']},
  cmp:{t:'ポケモン比較',ic:'cmp',lead:'2匹のポケモンの種族値とタイプ相性を重ねて比べます。',
    steps:['比べたい2匹を選びます。','種族値のグラフが重なって表示され、どちらがどの能力で上かが分かります。']},
  tier:{t:'強いポケモンランキング',ic:'trophy',lead:'ランクバトルの使用率と、上位のポケモンとの1対1の計算から、ポケモンを S〜C に分けて並べます（毎日更新）。',
    steps:['上でシングル・ダブルを選びます。','ポケモンを押すと、そのランクになった理由（有利な相手・苦手な相手など）が見られます。']},
  meta:{t:'流行のポケモンとパーティ',ic:'trend',lead:'ランクバトルで使われているポケモンの順位と、よく一緒に使われる組み合わせを見ます。',
    steps:['使用率の順にポケモンが並びます。','ポケモンを押すと、図鑑のページで使用率の高い型（技・持ち物など）が見られます。']},
  season:{t:'シーズンの上位パーティ',ic:'trophy',lead:'シーズンごとに、上位になった人のパーティと育成を見られます。',
    steps:['見たいシーズンを選びます。','パーティを押すと育成が見られます。「このパーティを使う」で自分のパーティの枠に入れられます。','「自分のパーティと比べる」で、有利か不利かを計算できます。'],
    tips:['自分の結果を登録することもできます（ログインが必要）。']},
  memo:{t:'戦術メモ',ic:'list',lead:'「このポケモン・このタイプが来たらどうするか」を書いておき、対戦中に PiP で見るためのメモです。',
    steps:['メモしたい相手のポケモンかタイプを選びます。','「自動＋書き込み」なら、いまのパーティから計算した下書きが入ります。直して「保存する」を押します。','パーティ全体の作戦は「パーティの戦術メモ」に書けます。'],
    tips:['ログインすると、ほかの端末でも同じメモを見られます。']},
  replay:{t:'対戦の振り返り',ic:'replay',lead:'ゲームの画面収録の動画から、相手のポケモン・お互いの選出・勝ち負けを読み取って記録します（ログインが必要）。',
    steps:['画面収録した対戦の動画を選びます（動画そのものは送らず、場面の画像だけを読みます）。','読み取った結果を確かめて、まちがいを直します。','「記録する」で保存すると、勝率や苦手な相手がまとまっていきます。']},
  pip:{t:'PiP（ピクチャ・イン・ピクチャ）',ic:'pip',lead:'選出やダメージ、育成のカードを、ゲームの画面の上に小さく浮かべて見る機能です。',
    steps:['「育成するとき」か「対戦するとき」を選びます。','見たいカードを選んで、PiP を始めます。','ゲームに切りかえても、カードが画面の上に浮かんだまま見られます。'],
    tips:['相手のポケモンを入れると、選出やダメージのカードも使えます（選出アシストから）。']},
  import:{t:'画像から取り込む',ic:'image',lead:'ゲームのチーム画面のスクショから、ポケモン・技・持ち物・能力ポイントを読み取ってパーティに入れます。',
    steps:['ゲームのチーム画面のスクショを選びます（読み取りはこの端末の中で行います）。','読み取った結果を確かめ、ちがうところは選び直します。','保存すると、パーティに入ります。']},
  pair:{t:'相性のいい仲間を探す',ic:'search',lead:'いまのパーティに合う仲間を、相性のいい順に、理由つきで探します。',
    steps:['パーティの画面で1匹以上入れておきます（入れなくても探せます）。','相性のいい順に候補が出ます。札で理由（弱点を受けられる等）が分かります。','「こだわり条件で組む」で、構築のタイプなどの条件から6匹まとめて組むこともできます。']},
  learn:{t:'攻略ガイド',ic:'book',lead:'持ち物・技・特性の使いどころ、構築の型、用語の説明を読めます。',
    steps:['読みたい分類（道具・技・特性・構築・戦術）を選びます。','検索の画面から、名前で探すこともできます。']},
  dex:{t:'図鑑',ic:'dex',lead:'ポケモンの種族値・弱点・覚える技・使用率の高い型などを見られます。',
    steps:['名前で探すか、タイプ・役割で絞り込みます。','ポケモンを押すと、種族値・解説・実数値・弱点・対策・技と特性のタブが見られます。'],
    tips:['☆を押すとお気に入りに登録でき、ポケモンを選ぶ画面の「お気に入り」から選べます。']}
};
const HOWTO_ORDER=['team','assist','calc','types','dex','tier','meta','season','memo','pair','pip','import','replay','cmp','learn'];
const howtoSeen=()=>{const o=lsJ('pchowto',{});return o&&typeof o==='object'?o:{}};
function howtoDone(k){const o=howtoSeen();o[k]=1;try{localStorage.setItem('pchowto',JSON.stringify(o))}catch(e){}}
function howtoTip(k){
  document.querySelectorAll('.ht-tip').forEach(e=>e.remove());
  const h=HOWTO[k];if(!h||howtoSeen()[k])return;
  /* テストの画面ではふだん出さない（位置を調べるテストがずれるため）。pchowtotest=1 のときだけ出す */
  try{if(navigator.webdriver&&localStorage.getItem('pchowtotest')!=='1')return}catch(e){}
  const c=document.createElement('section');c.className='ht-tip';c.setAttribute('aria-label',`はじめての方へ：${h.t}の使い方`);
  c.innerHTML=`<div class="ht-top"><span class="ht-ic">${SVG(I.help,20)}</span><b>はじめての方へ：${esc(h.t)}の使い方</b><button class="ht-x" aria-label="閉じる">${SVG(I.x,18)}</button></div>
    <ol class="ht-steps">${h.steps.slice(0,4).map(s=>`<li>${esc(s)}</li>`).join('')}</ol>
    <div class="ht-btns"><button class="btn btn-p btn-s ht-ok">わかった</button><a class="btn btn-s ht-more" href="#/help/${k}">くわしい使い方</a></div>`;
  const done=()=>{howtoDone(k);if(reduceMotion){c.remove();return}c.classList.add('ht-out');setTimeout(()=>c.remove(),220)};
  c.querySelector('.ht-ok').onclick=done;c.querySelector('.ht-x').onclick=done;
  c.querySelector('.ht-more').addEventListener('click',()=>howtoDone(k));
  if(typeof jaWrap==='function')jaWrap(c.querySelector('.ht-top b'),`はじめての方へ：${h.t}の使い方`);
  V.parentNode.insertBefore(c,V);
}
/* #/help（一覧）・#/help/ID（1つのツール） */
function helpView(id){
  const h=HOWTO[id];
  if(!h){
    setHeader('ツールの使い方');
    V.innerHTML=`<p class="note">それぞれのツールの使い方です。押すと、手順とコツが見られます。各ツールをはじめて開いたときにも、画面の上に短い使い方が出ます。</p>
      ${HOWTO_ORDER.filter(k=>HOWTO[k]).map(k=>{const x=HOWTO[k];return `<a class="row" href="#/help/${k}"><span class="ht-ric">${SVG(I[x.ic]||I.help,22)}</span><div class="row-m"><div class="row-t">${esc(x.t)}</div><div class="row-s">${esc(x.lead)}</div></div><span class="chev">${SVG(I.chev,18)}</span></a>`}).join('')}
      <div class="btns"><button class="btn btn-s" id="ht-reset">はじめての方へのカードをもう一度出す</button></div>`;
    V.querySelector('#ht-reset').onclick=()=>{try{localStorage.removeItem('pchowto')}catch(e){}toast('各ツールをはじめて開いたときのカードを、もう一度出すようにしました')};
    return;
  }
  setHeader(h.t+'の使い方','#/help');
  const go={team:'#/team',assist:'#/assist',calc:'#/calc',types:'#/types',cmp:'#/cmp',tier:'#/tier',meta:'#/meta',season:'#/season',memo:'#/memo',replay:'#/replay',pip:'#/pip',import:'#/import',pair:'#/pair',learn:'#/learn',dex:'#/dex'}[id];
  V.innerHTML=`<section class="ht-doc"><div class="ht-hd"><span class="ht-ric">${SVG(I[h.ic]||I.help,24)}</span><h2>${esc(h.t)}</h2></div>
    <p class="ht-lead">${esc(h.lead)}</p>
    <h3>使い方</h3><ol class="ht-steps ht-steps--big">${h.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>
    ${h.tips&&h.tips.length?`<h3>コツ</h3><ul class="ht-tips">${h.tips.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`:''}
    ${go?`<div class="btns"><a class="btn btn-p" href="${go}">${esc(h.t)}を開く</a></div>`:''}</section>`;
}
