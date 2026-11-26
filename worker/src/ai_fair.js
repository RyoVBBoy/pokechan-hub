/* ===================== Game Kid/s AI：フェアプレイの判定（docs/ai/stage-b-fair-play-spec.md） =====================
   ・提供元（生成AI）を呼ぶ前に、サーバーが決まった規則で決める（生成AIの判定は使わない）。拒否・制限・確認・保留では提供元も道具も呼ばず、回答枠も使わない
   ・試合の状態（準備・仮想の練習・終わった試合・進行中・不明）は、質問の言葉と、サーバーに残した会話の状態の両方から決める。
     「大会じゃない」「練習」などの自己申告だけでは、進行中の手がかり（選出画面・残り◯秒・対戦中…）を外さない。進行中のあとは「どっち？」「同じ相手」も制限のまま。
     「試合が終わった」「振り返りたい」で終わった試合に移れる
   ・個別の助言（選出・次の技・交代・いまの盤面の計算・相手の隠れた技の推定）だけを止める。一般の仕様・準備・終わった試合の振り返りは止めない
   ・違反者と決めつけない文で案内する。判定の結果は policyDecision（allow・allow_general・restrict・refuse・clarify・hold）として返す */
const FP_REFUSE=[
  ['evasion',/(AI|ＡＩ|ツール|アプリ)(の利用|を使っていること|の使用)?を(隠|ごまか)|隠す方法|バレ(ない|ずに)|ばれ(ない|ずに)|検出(を|から)?(回避|逃れ|すり抜)|失格(を)?(回避|逃れ)/i],
  ['cheat',/チート|改造(ポケ|データ|した|する|の方法|して)|わざと切断|切断(の|する)?(手順|方法|やり方|技)|回線(を)?(切|抜)|八百長|代行|(BOT|ボット)(を|で)?(使|作|動)/i],
  ['exploit',/(不具合|バグ|グリッチ)を(使|利用|悪用)/],
  ['disrupt',/妨害/],
  ['private_info',/(連絡先|住所|本名|電話番号|個人情報|顔写真|学校|勤務先|アカウント|本垢|裏垢)(を|が)?(特定|調べ|突き止|晒|教えて)|特定して|晒(す|して|したい|し上げ)/],
  ['internal',/制限を(解除|外|無効)|秘密を(表示|見せ|教え|出)|(システム)?プロンプトを(表示|見せ|教え|出)|内部(の)?(情報|設定|データ)を|非公開の(設定|情報|データ)を(表示|見せ|教え|出)|管理者(の)?(権限|用の)|jailbreak|脱獄/i]];
const FP_HOLD=/(未発表|未公開|リーク|発表前|非公式の噂)/;
const FP_DONE=/昨日|おととい|一昨日|先週|先日|さっき終わ|終わった(試合|対戦|大会)|(試合|対戦|大会|バトル)(が|は|も)?終わ|試合後|対戦後|大会後|振り返|(対戦|試合|大会|ランクマ)中だった|(対戦|試合|大会)中でした/;
const FP_LIVE=/選出画面|残り\s*[0-9０-９]+\s*秒|あと\s*[0-9０-９]+\s*秒|残り時間|(大会|対戦|試合|ランクマ|ランクバトル|フレンド戦|マッチ|バトル)中(?!だった|でした)|今(ランクマ|ランクバトル|大会|対戦|試合|フレンド戦)(?![^。]*(後|終わ))|(対戦|試合|バトル)(が)?始まっ|マッチング(した|中)|今の盤面|現在の盤面|[0-9０-９]+ターン目/;
const FP_PRACTICE=/架空|仮想|例にして|例えば|たとえば|練習用|シミュレーション|仮定/;
const FP_ADVICE=/(何|誰|だれ|どれ|どの子|どいつ|どのポケモン)(を|が)?(出す|出せば|出したら|選出|選ぶ|選べば|投げ)|出す[0-9０-９３]?匹|選出(を|して|は)?(決め|教え|考え|して)|(次|今)(に|の)?(出す|使う|打つ|撃つ|選ぶ)?(技|一手|行動)|一手|交代(する|させる|先|すべき|するなら|するポケモン|して)|居座る?(べき|か)|どっち|どちら|何ダメ|ダメージ|確定数|乱数|倒せる[？?]|耐える[？?]|相手の(6匹|６匹|持ち物|技|型|残り)/;
const FP_SITUATION=/この(盤面|状況|場面|相手)|今の(盤面|状況|相手)|相手の(6匹|６匹)|次に/;
const FP_CONT=/同じ相手|さっきの相手|この相手|今の相手|その相手/;
const FP_GENERAL=/一般(的な|の)?(仕様|ルール|仕組み)|仕組み|仕様を|とは[？?]?$|って何/;
const FP_MSG={restrict:'進行中の対戦への個別の助言は控えています。試合が終わったら、選出や立ち回りを一緒に振り返れます。',
  refuse:'その内容にはお答えできません（フェアプレイと安全のため）。ルールや一般的な仕組みについてなら説明できます。',
  clarify:'この相談は、練習用・仮想の盤面ですか？それとも終わった試合の振り返りですか？（進行中の対戦への個別の助言は控えています）',
  hold:'未発表・未確認の情報は、確定した事実としては出せません。公式の発表を確かめてからお答えします。'};
/* fp＝会話に残した状態 {phase,at,pending}。戻り値 {decision, phase, kind, reason} */
function aiFairPlay(q,fp,now,matchPhase){
  const t=String(q||'').normalize('NFKC');
  for(const [k,re] of FP_REFUSE)if(re.test(t))return{decision:'refuse',phase:(fp&&fp.phase)||'unknown',kind:k};
  if(FP_HOLD.test(t))return{decision:'hold',phase:(fp&&fp.phase)||'unknown',kind:'unverified_claim'};
  const live0=fp&&fp.phase==='ongoing'&&now-fp.at<AI_CONV_TTL;
  let phase='unknown';
  if(FP_DONE.test(t))phase='completed';
  else if(FP_LIVE.test(t)||live0)phase='ongoing';
  else if(matchPhase&&fp&&fp.pending==='clarify')phase=matchPhase;   /* 確認への答え（進行中のあとでは使わない） */
  else if(FP_PRACTICE.test(t))phase='practice';
  const advice=FP_ADVICE.test(t);
  if(phase==='ongoing'){
    if(FP_GENERAL.test(t)&&!advice&&!FP_SITUATION.test(t))return{decision:'allow_general',phase,kind:'game_mechanic'};
    if(advice||FP_CONT.test(t)||FP_SITUATION.test(t)||(live0&&t.replace(/[\s？?。、!！]/g,'').length<=12))return{decision:'restrict',phase,kind:'live_advice'};
    return{decision:'allow_general',phase,kind:'general'};
  }
  if(phase==='unknown'&&advice&&FP_SITUATION.test(t))return{decision:'clarify',phase,kind:'phase_unknown'};
  return{decision:'allow',phase,kind:'general'};
}
/* 次の会話の状態：進行中は「終わった」と言うまで続く。練習・不明は進行中を外さない */
function aiFpNext(fp,r,now){
  if(r.phase==='completed')return{phase:'completed',at:now};
  if(r.phase==='ongoing')return{phase:'ongoing',at:now};
  if(r.decision==='clarify')return{...(fp||{}),pending:'clarify',at:now};
  return fp&&fp.phase?{phase:fp.phase,at:fp.at}:null;
}
/* 進行中の対戦で、個別の道具（計算・使用率・選出・構築の候補）につながる意図 */
const AI_FP_INDIVIDUAL=['damage_calc','usage_share','party_tool','team_recommend','team_followup','compare'];
