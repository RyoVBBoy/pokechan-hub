/* ===================== 型の出どころ（2026/11/16 依頼主「統一した型の形・出どころを失わない」） =====================
   どの型にも、別々の2つを付ける：
   ・分類 c（出どころの種類）：observed＝実戦データ（ゲームの対戦の記録）／external＝外部の参考（Showdown）／theory＝理論上の型（当サイトの計算）／user＝Game Kid/s の利用者のデータ
   ・作られ方 m：original＝登録されたそのままの型／aggregated＝項目ごとの集計を組み合わせた型（「1つの型」が使われた記録ではない）／theoretical＝当サイトの計算で組んだ型
   例：ランクバトルの集計（Pokémon Champions Battle Data）は 分類＝実戦データ・作られ方＝組み合わせ。
   決まり：
   ・分からないことは null のまま（集計期間 per・レギュレーション reg・対戦数 n）。取得した時刻 at から集計期間を推し量らない。今日の日付からレギュレーションを決めない。
   ・型全体の使用率の欄は作らない（どの出典にも無い）。項目ごとの割合 pct は画面に出すときだけ持ち、保存しない（provForSave が外す）。
   ・Pokémon Champions Battle Data の値は保存しない：出どころの記録に残すのは、出典の名前・分類・時刻などの「ラベル」だけ。
   ・前からある src（manual／import／copy 等。とくに copy＝サイトの集計に数えない、worker/src/usage.js）は変えない。出どころはそれとは別の prov に持つ。
   ・from＝「最初の出どころ」（変える前の、元になった型の出どころ）。直前の版ではない。1段だけ持ち、変えるたびに積み重ねない：
     元の型を変えた型をさらに変えても、from は最初の出どころ（例：上位パーティの登録）のまま。元の出どころが分からない型を変えたときは from を付けない。
     決めるのは mkProv の1か所（provOrigin）。入れる・読む・枠を移す・選ぶだけでは出どころを変えない（変えるのは中身を変えたときだけ）。
   ・lb＝出典の中での名前（PokéKit の形式名「Champions BSS reg.MC」、上位パーティのシーズン名など。提供元が書いた名前のままで、当サイトがレギュレーションと決めたものではない）。
   ・保存する形は短く（パーティの保存は3枠で3万文字まで、worker/src/auth.js）。 */
const PROV_CAT={observed:'実戦データ',external:'外部の参考（Showdown）',theory:'理論上の型',user:'Game Kid/s の利用者のデータ'};
const PROV_METHOD={original:'登録されたそのままの型',aggregated:'項目ごとの集計を組み合わせた型',theoretical:'当サイトの計算で組んだ型'};
/* 確認の状態（上位パーティの登録など、1件ずつの記録のときだけ）。どれも同じ確かさではない */
const PROV_VERIFY={confirmed:'運営者が証拠（スクリーンショット）を確認',self:'本人の申告（運営者の確認はまだ）',article:'公開された記事から集めた（独自には確かめていない）'};
/* 出典ごとの決まった値（分類・作られ方・ゲーム）。呼ぶ側はこれを変えられない＝同じ出典が別の分類にならない */
const PROV_SRC={
  cbd:{name:'Pokémon Champions Battle Data',c:'observed',m:'aggregated',g:'champions',url:'https://championsbattledata.com/',
    lim:['項目ごとの割合を組み合わせた型（この組み合わせが使われた記録ではない）','集計期間・レギュレーション・対戦数は提供元のデータに無い']},
  season:{name:'Game Kid/s の上位パーティの登録',c:'observed',m:'original',g:'champions',lim:['1人のプレイヤーのパーティ（全体の傾向ではない）']},
  pokekit:{name:'PokéKit（Smogon / Pokémon Showdown の集計）',c:'external',m:'aggregated',g:'showdown',url:'https://poke.itlibra.com/en/opendata',
    lim:['Pokémon Showdown のランク対戦の集計（ポケモンチャンピオンズの集計ではない）','項目ごとの割合を組み合わせた型','能力ポイントは仮定']},
  site_usage:{name:'Game Kid/s 利用者の育成の集計',c:'user',m:'aggregated',g:'site',lim:['このサイトの利用者だけの集計（ゲーム全体の傾向ではない）','項目ごとのいちばん多いものを組み合わせた型']},
  user:{name:'あなたの育成',c:'user',m:'original',g:'site',lim:[]},
  import:{name:'あなたの育成（画像から取り込み）',c:'user',m:'original',g:'site',lim:['画像の文字の読み取りに間違いがあることがある']},
  calc:{name:'Game Kid/s の計算',c:'theory',m:'theoretical',g:'site',lim:['実際に使われた型ではない']}
};
const PROV_STR=(v,n)=>v==null||v===''?null:String(v).slice(0,n);
/* 出どころを作る。o.s（出典のキー）は必須。分類・作られ方は出典から決まる。分からない値は null（推し量らない） */
function mkProv(o){
  o=o||{};const S=PROV_SRC[o.s];if(!S)return null;
  const P={v:1,s:o.s,c:S.c,m:S.m,g:S.g,f:o.f==='single'||o.f==='double'?o.f:null,
    vs:S.c==='observed'&&S.m==='original'&&PROV_VERIFY[o.vs]?o.vs:null,
    reg:PROV_STR(o.reg,20),per:PROV_STR(o.per,40),at:Number.isFinite(o.at)&&o.at>0?Math.floor(o.at):null,
    n:Number.isInteger(o.n)&&o.n>0?o.n:null,id:PROV_STR(o.id,60),lb:PROV_STR(o.lb,40),
    lim:[...S.lim,...(Array.isArray(o.lim)?o.lim.map(x=>PROV_STR(x,80)).filter(Boolean):[])].slice(0,6)};
  /* 提供元のデータに無いものは、呼ぶ側が渡しても持たない（Pokémon Champions Battle Data は集計期間・レギュレーション・対戦数を出していない） */
  if(o.s==='cbd'){P.reg=null;P.per=null;P.n=null}
  if(o.pct&&typeof o.pct==='object')P.pct=o.pct;   /* 画面に出すときだけ。保存しない */
  {const O=provOrigin(o.from);if(O){const F=provForSave(O);if(F){delete F.from;P.from=F}}}  /* from＝最初の出どころ（直前の版ではない） */
  return P;
}
/* 最初の出どころ：その型がすでに何かを元にしていれば（from があれば）その from、無ければその型自身。分からなければ null */
function provOrigin(p){
  if(!p||typeof p!=='object'||!PROV_SRC[p.s])return null;
  return p.from&&typeof p.from==='object'&&PROV_SRC[p.from.s]?p.from:p;
}
/* 保存する形：項目ごとの割合を外し、決まった欄だけを短くして残す。おかしなものは null */
function provForSave(p){
  if(!p||typeof p!=='object'||!PROV_SRC[p.s])return null;
  const S=PROV_SRC[p.s];
  const o={v:1,s:p.s,c:S.c,m:S.m,g:S.g};
  if(p.f==='single'||p.f==='double')o.f=p.f;
  if(S.c==='observed'&&S.m==='original'&&PROV_VERIFY[p.vs])o.vs=p.vs;
  if(p.s!=='cbd'){const r=PROV_STR(p.reg,20),e=PROV_STR(p.per,40);if(r)o.reg=r;if(e)o.per=e;if(Number.isInteger(p.n)&&p.n>0)o.n=p.n}
  if(Number.isFinite(p.at)&&p.at>0)o.at=Math.floor(p.at);
  const id=PROV_STR(p.id,60),lb=PROV_STR(p.lb,40);if(id)o.id=id;if(lb)o.lb=lb;
  if(p.from&&typeof p.from==='object'&&PROV_SRC[p.from.s]){const F=provForSave({...p.from,from:null});if(F)o.from=F}
  return o;
}
/* 型の出どころを読む：prov があればそれ（形を確かめ直す）。無い古い型は、確かな手がかりがあるものだけ。分からなければ null＝出どころ不明（推し量らない）。
   古い型の手がかり（コミット fd65c9c までの、src を書く所を調べた結果）：
   ・src:'import'＝画像の取り込み（18-import.js の imSave）だけが書く → 取り込み
   ・src:'manual'＝育成の画面で利用者が変えたとき（10-editor.js）と、改善案を使ったとき（62-improve.js。当サイトの計算の型）の両方が書く
     → どちらか分からないので不明（「あなたの育成」と決めない）
   ・src:'copy'・src なし＝どこから写したか記録が無い → 不明
   技・持ち物・能力ポイントなどの中身から、PokéKit・ランクバトルの集計・上位パーティ・計算の型だと推し量ることはしない */
function provOf(set){
  if(!set||typeof set!=='object')return null;
  if(set.prov){const p=provForSave(set.prov);if(p)return p}
  if(set.src==='import')return provForSave(mkProv({s:'import'}));
  return null;
}
/* 画面に出す1行（後の段階で使う。いまは確かめと注意書き用） */
function provLabel(p){
  if(!p)return '出どころ不明（この記録を始める前に入れた型）';
  const S=PROV_SRC[p.s];if(!S)return '出どころ不明';
  return [PROV_CAT[p.c],PROV_METHOD[p.m],S.name,p.vs?PROV_VERIFY[p.vs]:''].filter(Boolean).join('・');
}
/* PokéKit の型の出どころ（形式ごとの集計の見出しから。月・対戦数・レートの下限は提供元に書いてある値） */
function provPokekit(fmt,pct){
  const m=typeof mvpMeta==='function'?mvpMeta(fmt):null;
  return mkProv({s:'pokekit',f:fmt,per:m&&m.month?m.month+'（月の集計）':null,n:m&&Number.isInteger(m.battles)?m.battles:null,
    lb:m&&m.label?m.label:null,lim:m&&m.cutoff?[`レート${m.cutoff}以上の対戦`]:[],pct,at:m&&m.fetched?Date.parse(m.fetched+'T00:00:00+09:00'):null});
}
/* 上位パーティの登録（1件）の確認の状態：運営者が確認／記事から集めた／本人の申告 */
const provSeasonVs=t=>t&&(t.verified||t.ver||t.by_admin)?'confirmed':t&&t.auto?'article':'self';
