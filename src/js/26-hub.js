/* ===================== ツール一覧・みんな ===================== */
const hubRow=(h,t,d,badge)=>`<a class="row" href="${h}"><div class="row-m"><div class="row-t">${t}${badge?`<span class="atag" style="margin-left:6px">${badge}</span>`:''}</div><div class="row-s">${d}</div></div><span class="chev">${SVG(I.chev,18)}</span></a>`;
function toolsView(){
  setHeader('ツール');
  V.innerHTML=`<div class="fmtbar"><span>対戦の形式</span>${fmtSwitch()}</div>
  <p class="note" style="padding-top:4px">選んだ形式（いまは<b>${FMTN()}</b>：${PICK()}匹選出・先発${LEADN()}匹）で、選出・予想・使用率を計算します。</p>
  <div class="sec"><h2>対戦の準備</h2></div>
  ${hubRow('#/assist','選出アシスト',`相手の6匹から、出すべき${PICK()}匹と先発・相手の予想選出を出す`)}
  ${hubRow('#/meta','流行のポケモンとパーティ',`${FMTN()}の使用率ランキングと、よく使われる組み合わせ`)}
  ${hubRow('#/report','パーティの強みと弱み','あなたのパーティの強み・弱み・警戒すべき相手をまとめて')}
  <div class="sec"><h2>計算</h2></div>
  ${hubRow('#/assist/pip','バトル中の小窓表示','選出・ダメージ・素早さなどのカードを動画にして、ゲームの上に小窓で浮かべる')}
  ${hubRow('#/calc','ダメージ計算','あなたの育成やよくある型で、乱数16段階・確定数まで')}
  ${hubRow('#/types','タイプ相性','相手のポケモンやタイプから、効く技と出すべきポケモン')}
  ${hubRow('#/cmp','ポケモン比較','2匹の種族値とタイプ相性を重ねて比べる')}
  <div class="sec"><h2>練習</h2></div>
  ${hubRow('#/battle','模擬戦','技・特性つきの対戦で練習（今はダブルのみ）','β')}
  <div class="sec"><h2>連携</h2></div>
  ${hubRow('#/tap','アプリ・背面タップ連携','対戦中に、相手の読み取りと選出を自動で','β')}
  ${hubRow('#/import','画像から取り込む','ゲームのチーム画面のスクショから、技・持ち物・能力ポイントまで')}
  <div class="sec"><h2>資料</h2></div>
  ${hubRow('#/guide','基本ルール','能力ポイント・性格・計算式など')}
  ${hubRow('#/sources','データの出典と確認状況','数値の出どころと、どこまで確かめたか')}`;
  bindFmt(V,toolsView);
}
function communityView(){
  setHeader('みんな');
  V.innerHTML=`<p class="note" style="padding-top:14px">ほかのトレーナーと対戦したり、情報を交換したりする場所です。匿名で使えます。</p>
  ${hubRow('#/lobby','対戦募集','プライベート対戦の相手を募集・参加する（あいことばを共有）')}
  ${hubRow('#/bbs','掲示板','雑談・構築相談・質問・大会の情報')}
  ${hubRow('#/rules','利用ルール','禁止していること・通報と削除・保存する情報')}`;
}


