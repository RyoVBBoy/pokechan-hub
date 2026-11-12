/* ===================== 共通パーツ ===================== */
const AXO=[0,1,2,5,4,3];
const polar=(k,r)=>{const a=-Math.PI/2+k*Math.PI/3;return[Math.cos(a)*r,Math.sin(a)*r]};
let _u=0;
function stamp(p,full){
  const R=full?80:39,ref=150,id='rg'+(++_u);
  const f=n=>n.toFixed(1);
  const hex=m=>AXO.map((_,k)=>polar(k,R*m).map(f).join(',')).join(' ');
  const pts=AXO.map((si,k)=>polar(k,R*Math.min(1,Math.max(.07,p.s[si]/ref))).map(f).join(',')).join(' ');
  const c1=TXT[p.t[0]],c2=TXT[p.t[1]||p.t[0]];
  const defs=`<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>`;
  const poly=`<polygon points="${pts}" fill="url(#${id})" fill-opacity="${full?.5:.8}" stroke="url(#${id})" stroke-width="${full?2:2.2}" stroke-linejoin="round"/>`;
  if(!full)return `<svg viewBox="-50 -50 100 100" role="img" aria-label="${p.n}の種族値の形">${defs}<circle r="46" class="rg-bg" style="fill:${COL[p.t[0]]};fill-opacity:.22;stroke:${COL[p.t[1]||p.t[0]]};stroke-width:4;stroke-opacity:.85"/><polygon class="rg-ring" points="${hex(1)}"/>${poly}</svg>`;
  const rings=[1/3,2/3,1].map(m=>`<polygon class="rg-ring" points="${hex(m)}"/>`).join('');
  const spokes=AXO.map((_,k)=>{const[x,y]=polar(k,R);return `<line class="rg-spoke" x1="0" y1="0" x2="${f(x)}" y2="${f(y)}"/>`}).join('');
  const labs=AXO.map((si,k)=>{const[x,y]=polar(k,R+15);const an=Math.abs(x)<1?'middle':x>0?'start':'end';const dy=k===0?-12:k===3?6:-2;
    return `<text class="rg-t" x="${f(x)}" y="${f(y+dy)}" text-anchor="${an}">${SN[si]}</text><text class="rg-v" x="${f(x)}" y="${f(y+dy+13)}" text-anchor="${an}">${p.s[si]}</text>`}).join('');
  return `<svg viewBox="-125 -122 250 244" role="img" aria-label="${p.n}の種族値レーダー">${defs}${rings}${spokes}${poly}${labs}</svg>`;
}
function artHTML(p){
  if(ART_URL)return `<img src="${ART_URL.replace('{no}',p.no)}" alt="${p.n}" onerror="this.style.display='none'">`;
  return stamp(p);
}
const chip=t=>`<span class="chip" style="background:${COL[t]}26;color:${TXT[t]};box-shadow:inset 0 0 0 1px ${COL[t]}55">${ticon(t,12,'ci')}${t}</span>`;
const tkb=(cols,opts={})=>`<div class="tkb tkb--${cols}" role="group">${T.map(t=>
  `<button class="tk" data-t="${t}" ${opts.pressed?`aria-pressed="${opts.pressed(t)}"`:''} aria-label="${t}" style="background:${COL[t]};color:${ONC[t]}">${ticon(t,cols===9?19:22)}<small>${t}</small></button>`).join('')}</div>`;
const LAB=[[4,'×4','大弱点','var(--w4)'],[2,'×2','弱点','var(--w2)'],[.5,'×½','半減','var(--r2)'],[.25,'×¼','4分の1','var(--r4)'],[0,'×0','無効','var(--r0)']];
const mxBlocks=types=>{const tb=defTable(types);return LAB.map(([v,m,l,c])=>{const g=tb.filter(x=>x[1]===v);
  return g.length?`<div class="mx"><h3 style="color:${c}"><span>${m}</span>${l}<span style="color:var(--mute);font-weight:600">${g.length}</span></h3><div class="chips" style="margin:0">${g.map(x=>chip(x[0])).join('')}</div></div>`:''}).join('')};
/* ポケモンの名前の表示（公式の画像を使わずに、ひと目で分かるように）：名前を太く大きく＋姿の違いの札＋図鑑番号
   札：メガ（X/Y/Z）・地方の姿（アローラ・ガラル・ヒスイ・パルデア）・そのほか（オス／メス・サイズなど） */
const FORM_EN={アローラ:'Alola',ガラル:'Galar',ヒスイ:'Hisui','パルデア・コンバット種':'Paldea Combat','パルデア・ブレイズ種':'Paldea Blaze','パルデア・ウォーター種':'Paldea Aqua','パルデア・アクア種':'Paldea Aqua',
  オス:'Male',メス:'Female',たそがれ:'Dusk',まよなかのすがた:'Midnight',ハイなすがた:'Amped',ローなすがた:'Low Key',ブルーフェザー:'Blue',イエローフェザー:'Yellow',ホワイトフェザー:'White',えいえんのはな:'Eternal Flower',ちいさいサイズ:'Small',おおきいサイズ:'Large',とくだいサイズ:'Super Size',こだましゅ:'Small',ちゅうだましゅ:'Average',おおだましゅ:'Large',ギガだましゅ:'Super Size',まひるのすがた:'Midday',たそがれのすがた:'Dusk',グリーンフェザー:'Green'};
function formInfo(p){
  if(p._f)return p._f;
  const ja=p.ja||p.n;let base=p.n,tag=null,kind='';
  if(p.base){const sfx=(ja.match(/([XYZ])$/)||[])[1],b=byNo[p.base];kind='mega';tag=(LANG==='en'?'Mega':'メガ')+(sfx?' '+sfx:'');base=b?formInfo(b).base:p.n.replace(/^メガ|^Mega /,'').replace(/ ?[XYZ]$/,'');
    const sub=ja.match(/（(.+)）$/);if(sub)tag+=' '+(LANG==='en'?(FORM_EN[sub[1]]||sub[1]):sub[1])}
  else{const m=ja.match(/^(.+?)（(.+)）$/);
    if(m){kind=/アローラ|ガラル|ヒスイ|パルデア/.test(m[2])?'reg':'oth';tag=LANG==='en'?(FORM_EN[m[2]]||m[2]):m[2].replace('・',' ');
      base=LANG==='en'?((typeof NAMES!=='undefined'&&NAMES.en.p[DNO[p.no]])||p.n):m[1]}}
  return p._f={base,tag,kind};
}
const nm=(p,o={})=>{const f=formInfo(p);return `<span class="pn${o.big?' pn-big':''}"><b class="pn-n">${esc(f.base)}</b>${f.tag?`<i class="ftag ftag-${f.kind}">${esc(f.tag)}</i>`:''}${o.no===false?'':`<span class="no">#${String(p.dno||p.no).padStart(4,'0')}</span>`}</span>`};
/* 素早さの順位：収録ポケモンの最速（性格で上げ・ポイント32）と比べて、全体で何位か（自分は数えない）。同じ速さの数も返す */
const spdRank=(v,self)=>{const o=P.filter(q=>q.no!==self);return{rank:o.filter(q=>maxSpe(q)>v).length+1,same:o.filter(q=>maxSpe(q)===v).length,n:o.length+1}};
const spdRankHTML=(v,self)=>{const r=spdRank(v,self);return L(`収録${r.n}匹の最速（性格で上げ・ポイント32）と比べると、<b>全体で${r.rank}位</b>${r.same?`（同じ速さが${r.same}匹）`:''}です。`,
  `Compared with the max Speed (boosting nature, 32 points) of all ${r.n} Pokémon, this ranks <b>#${r.rank}</b>${r.same?` (tied with ${r.same})`:''}.`)};
const rowP=(p,metric)=>{const v=metric==null?p.bst:p.s[metric],lb=metric==null?'合計':SN[metric];
  return `<a class="row" href="#/p/${p.no}"><span class="av">${stamp(p)}</span><div class="row-m"><div class="row-t">${nm(p)}</div><div class="chips">${p.t.map(chip).join('')}<span class="rt">${p.roles.join('・')}</span></div></div><div class="row-n"><b>${v}</b><span>${lb}</span></div><span class="chev">${SVG(I.chev,18)}</span></a>`};
const counters=types=>P.filter(p=>p.t.some(t=>mult(t,types)>=2)).sort((a,b)=>b.bst-a.bst);
/* 広告の置き場所。広告を始めるまでは何も出さない（ADS_ON を true にすると枠が出る） */
const ADS_ON=false;
const adSlot=l=>ADS_ON?`<div class="ad">広告枠（${l}）</div>`:'';


/* タブの中身を左右のスワイプで切りかえる（パーティ・図鑑で共通）。
   指に合わせて中身と下線（ind）が動き、幅の4分の1以上か速く動かすと隣のタブへ。上下のスクロール・入力欄・横にスクロールする部品の上では動かない */
function segSwipe(area,o){
  let sx=0,sy=0,dx=0,mode=0,t0=0;
  const cur=()=>area.querySelector(':scope>[data-sw]:not([hidden])');
  const hscroll=t=>{for(let e=t;e&&e!==area;e=e.parentElement){if(e.matches('input,textarea,select,.hscroll'))return true;if(e.scrollWidth>e.clientWidth+2){const ox=getComputedStyle(e).overflowX;if(ox==='auto'||ox==='scroll')return true}}return false};
  area.addEventListener('touchstart',e=>{if(e.touches.length!==1){mode=-1;return}sx=e.touches[0].clientX;sy=e.touches[0].clientY;dx=0;mode=0;t0=Date.now()},{passive:true});
  area.addEventListener('touchmove',e=>{if(mode<0)return;const x=e.touches[0].clientX-sx,y=e.touches[0].clientY-sy;
    if(!mode){if(Math.abs(x)<10&&Math.abs(y)<10)return;if(Math.abs(y)>Math.abs(x)||hscroll(e.target)){mode=-1;return}mode=1}
    const i=o.idx(),edge=(x>0&&i===0)||(x<0&&i===o.n-1);dx=edge?x/4:x;
    const pn=cur();if(pn){pn.style.transition='none';pn.style.transform=`translateX(${dx}px)`}
    if(o.ind){o.ind.style.transition='none';o.ind.style.transform=`translateX(${(i-dx/area.offsetWidth)*100}%)`}},{passive:true});
  area.addEventListener('touchend',()=>{if(mode!==1){mode=0;return}mode=0;const i=o.idx(),w=area.offsetWidth,fast=Math.abs(dx)>40&&Date.now()-t0<300,j=i+(dx<0?1:-1);
    if((Math.abs(dx)>w*.25||fast)&&j>=0&&j<o.n){o.go(j,dx<0?1:-1);return}
    const pn=cur();if(pn){pn.style.transition='transform .2s ease-out';pn.style.transform=''}
    if(o.ind){o.ind.style.transition='';o.ind.style.transform=`translateX(${i*100}%)`}},{passive:true});
}
/* 新しく出したタブの中身を、進む向きからすべり込ませる */
function segSlideIn(pn,dir){if(!pn)return;pn.style.transform='';pn.style.transition='';pn.classList.remove('tt-in-l','tt-in-r');void pn.offsetWidth;pn.classList.add(dir>0?'tt-in-r':'tt-in-l')}
/* 確認の画面（X と同じ形：中央のカード・太い見出し・説明・赤い実行ボタンと枠だけの「キャンセル」を縦に並べる）。
   askConfirm({title,text,ok,danger}) → Promise<true/false>。端末の confirm() の代わりに使う */
function askConfirm(o){
  if(typeof o==='string')o={title:o};
  return new Promise(res=>{
    const d=document.createElement('div');d.className='xc';
    d.innerHTML=`<div class="xc-bg"></div><div class="xc-p" role="alertdialog" aria-modal="true" aria-labelledby="xc-t"><h3 id="xc-t">${esc(o.title||'よろしいですか？')}</h3>${o.text?`<p>${esc(o.text)}</p>`:''}
      <button class="xc-ok${o.danger===false?' xc-plain':''}">${esc(o.ok||'削除')}</button><button class="xc-no">キャンセル</button></div>`;
    document.body.appendChild(d);requestAnimationFrame(()=>d.classList.add('on'));
    const done=v=>{d.classList.remove('on');document.removeEventListener('keydown',key);setTimeout(()=>d.remove(),150);res(v)};
    const key=e=>{if(e.key==='Escape')done(false)};document.addEventListener('keydown',key);
    d.querySelector('.xc-ok').onclick=()=>done(true);d.querySelector('.xc-no').onclick=()=>done(false);d.querySelector('.xc-bg').onclick=()=>done(false);
  });
}

/* 外のアドレスを画面のリンクにするときは https:// のものだけ（javascript: などを入れさせない。2026/11/05 セキュリティ対策） */
const safeUrl=u=>/^https:\/\/[^\s"'<>]+$/i.test(String(u||''))?String(u):'#';
/* 公式の「ポケモンずかん」のそのポケモンのページへの、ふつうのリンク（2026/11/06 依頼主と決めた案 A）。
   公式の画像はこのサイトに表示しない（直接のリンクで画像を出すこともしない）。押すと公式のサイトが別のタブで開く。
   姿の違い（メガ・地方の姿など）は、公式の図鑑ではそのポケモンのページの中で切りかえるので、全国図鑑の番号のページへ。 */
/* 姿ごとのページ（公式の図鑑の「番号-枝番」。2026/11/06 GitHub Actions から公式の図鑑の一覧＝zukan-api/api/search を読んで確かめた）。
   メガシンカは書いていなければ枝番1。ここにないふつうの姿は枝番なし。 */
const ZK_SUB={10034:1,10035:2,10057:1,10307:2,10058:1,10309:2,10059:1,10310:2,10304:2,10305:3,10071:1,10165:2,10295:2,10061:1,10296:2,
  10025:1,10314:2,10326:2,10126:1,10152:2,10184:1,10186:1,10260:1,10261:2,10262:3,10008:1,10009:2,10010:3,10011:4,10012:5,10248:1,
  10250:1,10251:2,10252:3,10100:1,10104:1,10108:1,10172:1,10180:1,10230:1,10233:1,10236:1,10239:1,10242:1,10243:1,10244:1};
/* 戦闘中の姿（図鑑のスイッチで切りかえたとき）：ギルガルドのブレードフォルム・イルカマンのマイティフォルム */
const ZK_SW={681:1,964:1};
const zukanUrl=(p,sw)=>{const n=+(p&&p.dno)||0;if(!(n>0&&n<2000))return null;
  const sub=sw&&ZK_SW[p.no]?ZK_SW[p.no]:ZK_SUB[p.no]||(p.base?1:0);
  return `https://zukan.pokemon.co.jp/detail/${String(n).padStart(4,'0')}${sub?'-'+sub:''}`};
function zukanLink(p){const u=zukanUrl(p);if(!u)return '';
  return `<a class="zk-l" id="zk-l" href="${u}" target="_blank" rel="noopener noreferrer nofollow">${L('ポケモンずかんで姿を見る','See it in the official Pokédex')}<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg></a>`}
/* 押した感覚（触覚）。2026/11/08 依頼主の要望（下のメニューを押したとき）。
   Android などは navigator.vibrate。iPhone の Safari は vibrate に対応していないので、
   iPhone（iOS 18 以降）でスイッチ部品（<input type="checkbox" switch>）を切りかえると触覚が出るしくみを使う：
   見えないスイッチの label を押したことにする。押した操作の中で呼ぶ必要がある。localStorage pchaptic='off' で止める */
let HAPTIC_EL=null;
/* 日本語の短い文を、ことばの切れ目（文節）でだけ改行する（2026/11/12 依頼主：通知の「ログイン」が「ロ／グイン」で改行されていた）。
   ひらがなのあとに漢字・カタカナ・英数字が来る所と、句読点のあとにだけ <wbr> を入れ、CSS の word-break:keep-all（.jwrap）でほかの所では改行しない。
   1つの文節が幅に入らないときは overflow-wrap:anywhere で折り返す。文字は textContent で入れる（HTML として読まない） */
function jaWrap(el,text){
  el.textContent='';el.classList.add('jwrap');
  const s=String(text==null?'':text),hira=c=>c>='\u3041'&&c<='\u309f';
  let buf='';
  for(let i=0;i<s.length;i++){
    const c=s[i],p=s[i-1];
    if(i&&buf&&((hira(p)&&!hira(c)&&!/[\s、。，．！？!?・…ー）」』】)]/.test(c))||/[、。，！？!?]/.test(p))){el.append(buf,document.createElement('wbr'));buf=''}
    buf+=c;
  }
  if(buf)el.append(buf);
  return el;
}
function haptic(){
  try{if(localStorage.getItem('pchaptic')==='off')return}catch(e){}
  try{if(navigator.vibrate&&!/iP(hone|ad|od)/.test(navigator.userAgent)){navigator.vibrate(8);return}}catch(e){}
  try{
    if(!HAPTIC_EL){const l=document.createElement('label');l.setAttribute('aria-hidden','true');
      l.style.cssText='position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
      const i=document.createElement('input');i.type='checkbox';i.setAttribute('switch','');i.tabIndex=-1;l.appendChild(i);document.body.appendChild(l);HAPTIC_EL=l}
    HAPTIC_EL.click();
  }catch(e){}
}
/* 下のメニュー（スマホ）のタブを押したとき */
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('.tabbar .tb');if(t)haptic()},true);
