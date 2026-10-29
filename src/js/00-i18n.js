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
const THEME_PREF=(()=>{try{const v=localStorage.getItem('pctheme');return['auto','light','dark'].includes(v)?v:'auto'}catch(e){return'auto'}})();
const themeMQ=window.matchMedia?matchMedia('(prefers-color-scheme: light)'):null;
const themeNow=()=>THEME_PREF==='light'||(THEME_PREF==='auto'&&themeMQ&&themeMQ.matches)?'light':'dark';
let THEME=themeNow();
function themeApply(){document.documentElement.dataset.theme=THEME;const m=document.querySelector('meta[name=theme-color]');if(m)m.content=THEME==='light'?'#ffffff':'#000000'}
themeApply();
function setTheme(v){try{localStorage.setItem('pctheme',v)}catch(e){}location.reload()}
