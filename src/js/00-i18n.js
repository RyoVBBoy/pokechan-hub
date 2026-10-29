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
