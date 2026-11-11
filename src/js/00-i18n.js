/* ===================== ことば（日本語・英語） =====================
   LANG：'ja' か 'en'。はじめは端末の言語で決め、利用者が選んだらこの端末に保存する（pclang）。
   L('日本語','English')：その場で言語を選ぶ（文の中に数字や太字が入るところ用）。
   ほかの決まった文字は 98-i18n.js が画面に出たあとで辞書（97-dict-en.js）で置きかえる。
   名前（ポケモン・技・特性・持ち物・性格）は 98-i18n.js が NAMES（02-names.js）で入れかえる。 */
const LANGS=[['ja','日本語'],['en','English']];
const LANG=(()=>{let v='';try{v=localStorage.getItem('pclang')||''}catch(e){}
  if(!LANGS.some(x=>x[0]===v))v=/^ja\b/i.test(navigator.language||'ja')?'ja':'en';return v})();
const L=(ja,en)=>LANG==='en'&&en!=null?en:ja;
function setLang(v){try{localStorage.setItem('pclang',v)}catch(e){}location.reload()}
document.documentElement.lang=LANG;

/* ===================== 画面の明るさ（端末に合わせる／ライト／ダーク） =====================
   pctheme：'auto'（はじめ）・'light'・'dark'。決まった色は styles.css の [data-theme=light]。 */
let THEME_PREF=(()=>{try{const v=localStorage.getItem('pctheme');return['auto','light','dark'].includes(v)?v:'auto'}catch(e){return'auto'}})();
const themeMQ=window.matchMedia?matchMedia('(prefers-color-scheme: light)'):null;
const themeNow=()=>THEME_PREF==='light'||(THEME_PREF==='auto'&&themeMQ&&themeMQ.matches)?'light':'dark';
let THEME=themeNow();
/* テーマの色（2026/11/05 依頼主と決めた新しい見た目）：ボタン・選んでいるタブ・#タグ・背景の光の色。pcaccent に保存。はじめは紫。
   1色ごとに [名前, 英語, ライトの文字の色, ライトの塗りの色, ダークの文字の色, ダークの塗りの色, 塗りの上の文字の色(ダーク)]。
   背景の光の強さは pcglow＝'strong'・'normal'（はじめ）・'off' */
const ACCENTS={purple:['紫','Purple','#5B57D9','#5B57D9','#A99CFF','#7C6CF0','#fff'],blue:['青','Blue','#2563D9','#2F6FE0','#6AAEFF','#3B82F6','#fff'],
  green:['緑','Green','#12805F','#138A66','#4AD3A0','#17A07A','#fff'],pink:['ピンク','Pink','#C93360','#D63B63','#FF7A99','#E5476F','#fff'],
  orange:['オレンジ','Orange','#B85E08','#C76A0A','#FFAD5C','#E07B12','#fff'],mono:['灰色','Gray','#1E2030','#1E2030','#D5D7DE','#E8E9EE','#000']};
let ACCENT=(()=>{try{const v=localStorage.getItem('pcaccent');return ACCENTS[v]?v:'purple'}catch(e){return'purple'}})();
let GLOW=(()=>{try{const v=localStorage.getItem('pcglow');return['strong','normal','off'].includes(v)?v:'normal'}catch(e){return'normal'}})();
const hexRgb=h=>{const n=parseInt(h.slice(1),16);return `${n>>16},${n>>8&255},${n&255}`};
function accentApply(){const a=ACCENTS[ACCENT],L=THEME==='light',s=document.documentElement.style;
  const tx=L?a[2]:a[4],fill=L?a[3]:a[5],glow=a[5];
  s.setProperty('--acc',tx);s.setProperty('--acc2',tx);s.setProperty('--accf',fill);s.setProperty('--onacc',L?'#fff':a[6]);
  s.setProperty('--acc-rgb',hexRgb(tx));s.setProperty('--glow-rgb',hexRgb(glow));
  s.setProperty('--acc-t',`rgba(${hexRgb(tx)},${L?.12:.18})`);
  const g={strong:L?1.3:1.45,normal:1,off:0}[GLOW];s.setProperty('--glow-k',g);
  document.documentElement.dataset.glow=GLOW}
function themeApply(){document.documentElement.dataset.theme=THEME;accentApply();const m=document.querySelector('meta[name=theme-color]');if(m)m.content=THEME==='light'?'#EEF0F5':'#000000'}
themeApply();
/* 明るさ・テーマの色・背景の光を変える（2026/11/11 依頼主：読み直さずにその場で変える）。保存してから、色の変数と data-theme を入れかえる。
   明るさが変わったときはタイプの文字の色（txtCalc）も作り直し、いまの画面を描き直す（端末の明るさが変わったときと同じ処理） */
function setTheme(v){try{localStorage.setItem('pctheme',v)}catch(e){}
  if(!['auto','light','dark'].includes(v))v='auto';THEME_PREF=v;const was=THEME;THEME=themeNow();themeApply();
  if(THEME!==was){if(typeof txtCalc==='function')txtCalc();if(typeof route==='function')route()}}
function setAccent(k,v){try{localStorage.setItem(k,v)}catch(e){}
  if(k==='pcaccent'&&ACCENTS[v])ACCENT=v;if(k==='pcglow'&&['strong','normal','off'].includes(v))GLOW=v;accentApply()}
