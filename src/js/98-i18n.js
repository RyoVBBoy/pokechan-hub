/* ===================== 英語表示（LANG==='en' のときだけ動く） =====================
   1) 名前の入れかえ：ポケモン・技・特性・持ち物・性格を、NAMES（02-names.js）の正式名にする。
      元の日本語名は .ja に残す（検索で日本語も使えるように）。計算は番号・IDで動くので影響しない。
   2) 画面の文字：画面に出た文字を辞書 EN（97-dict-en.js）で置きかえる（完全に一致するものだけ）。
      利用者が書いた文章（投稿・掲示板・名前）は data-notr を付けた部分の中を訳さない。 */
const TYPE_EN=LANG==='en'?NAMES.en.t:{};
const tName=t=>TYPE_EN[t]||t;
if(LANG==='en'){
  const N=NAMES.en;
  P.forEach(p=>{p.ja=p.n;p.n=N.p[p.no]||p.n});
  MEGAP.forEach(p=>{if(!p.ja){p.ja=p.n;p.n=N.p[p.no]||p.n}});
  for(const no in SPXM)if(N.p[no]){SPXM[no].ja=SPXM[no][1];SPXM[no][1]=N.p[no]}
  for(const id in MV)if(N.m[id])MV[id][0]=N.m[id];
  for(const id in MVX)if(N.m[id])MVX[id][0]=N.m[id];
  for(const id in MD)if(N.m[id])MD[id][0]=N.m[id];
  for(const k in ABN){const id=(typeof ABK!=='undefined'&&ABK[k])||k;if(N.a[id]||N.a[k])ABN[k]=N.a[id]||N.a[k]}
  for(const k in ITEMN)if(N.i[k])ITEMN[k]=N.i[k];
  NATS.forEach(n=>{if(N.n[n[0]])n[0]=N.n[n[0]];else if(n[0]==='補正なし')n[0]='Neutral'});
  SN.splice(0,6,'HP','Atk','Def','SpA','SpD','Spe');
  for(const k in TYPE_EN)EN[k]=EN[k]||TYPE_EN[k];
  document.title='PokeChamp Hub | Stats, Type Matchups, Damage Calc & Team Builder';
}
/* 画面の文字の置きかえ */
const I18N_ATTR=['placeholder','aria-label','title'];
const JP=/[぀-ヿ㐀-鿿]/;
function trText(s){
  const k=s.trim();if(!k||!JP.test(k))return null;
  let v=EN[k];
  if(v==null)for(const [re,f] of EN_RE){const m=k.match(re);if(!m)continue;v=typeof f==='function'?f(...m):k.replace(re,f);if(v!=null)break}
  return v==null?null:s.replace(k,v);
}
function trNode(root){
  if(LANG!=='en'||!root)return;
  if(root.nodeType===3){if(!root.parentElement||root.parentElement.closest('[data-notr],script,style,textarea'))return;const v=trText(root.nodeValue);if(v!=null)root.nodeValue=v;return}
  if(root.nodeType!==1||root.closest('[data-notr]'))return;
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT,{acceptNode:n=>n.nodeType===1&&(n.hasAttribute('data-notr')||n.tagName==='SCRIPT'||n.tagName==='STYLE'||n.tagName==='TEXTAREA')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
  const els=[root];let n;
  while((n=w.nextNode())){if(n.nodeType===3){const v=trText(n.nodeValue);if(v!=null)n.nodeValue=v}else els.push(n)}
  for(const e of els)for(const a of I18N_ATTR){const t=e.getAttribute&&e.getAttribute(a);if(t){const v=trText(t);if(v!=null)e.setAttribute(a,v)}}
}
if(LANG==='en'){
  trNode(document.body);
  new MutationObserver(ms=>{for(const m of ms){
    if(m.type==='characterData')trNode(m.target);
    else m.addedNodes.forEach(trNode);
  }}).observe(document.body,{childList:true,subtree:true,characterData:true});
}
/* 言語を選ぶ（ゲーム切り替えシート・ゲーム選択画面・フッターから） */
function langSheet(){pickSheet('言語 / Language',LANGS.map(x=>x[1])).then(v=>{const l=LANGS.find(x=>x[1]===v);if(l&&l[0]!==LANG)setLang(l[0])})}
document.addEventListener('click',e=>{const a=e.target.closest('[data-lang]');if(a){e.preventDefault();langSheet()}});
