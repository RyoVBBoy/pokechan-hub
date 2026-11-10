/* ===================== 戦術メモ（2026/11/06 依頼主の要望） =====================
   「このポケモン（このタイプ）が来たら、どうするか」を自分で書いておき、選出アシストの PiP で対戦中に見られるようにする。
   ・書き方は2つ：手で書く（マニュアル＝空の欄から自分で全部書く）／自動＋書き込み（ハイブリッド＝いまのパーティから計算したメモの下書きに、自分で書き足す）
   ・ポケモンごと（メガシンカの姿は元の姿にまとめる）とタイプごと
   ・保存：この端末（localStorage pcmemo）。ログイン中は /api/me/memo でどの端末でも同じに（1つずつ、新しく書いたほうを残す）
   ・PiP：「戦術メモ」のカード。相手の6匹のうち、メモ（ハイブリッドなら自動の下書きも）がある匹を1枚ずつ */
const MEMO_MAX=400;
const MEMO=(()=>{let m=null;try{m=JSON.parse(localStorage.getItem('pcmemo')||'null')}catch(e){}
  m=m&&typeof m==='object'?m:{};m.mon=m.mon||{};m.type=m.type||{};m.party=m.party&&typeof m.party==='object'?m.party:{};m.mode=m.mode==='manual'?'manual':'hybrid';return m})();
const memoSave=()=>{try{localStorage.setItem('pcmemo',JSON.stringify(MEMO))}catch(e){}memoSyncSoon()};
const memoKey=p=>p?(p.base&&byNo[p.base]?p.base:p.no):0;
const memoOf=p=>{const e=MEMO.mon[memoKey(p)];return e&&e.t?e.t:''};
const memoTypeOf=t=>{const e=MEMO.type[t];return e&&e.t?e.t:''};
/* 自動の下書き：いまのパーティ（なければ何も作らない）と、相手の使用率の高い型での1対1 */
function memoAuto(q){
  if(!q||!team.length)return '';
  let op;try{op=mkMon(q,'op',q.base&&byNo[q.base]?{...detSet(byNo[q.base]),ab:q.ab,item:null}:detSet(q))}catch(e){return ''}
  const spd=b=>b.st[5]*(b.item==='choicescarf'?1.5:1);
  const rows=team.map(x=>{const p=byNo[x.no];if(!p)return null;try{const a=mkMon(p,'me',mySetFor(x.no)),d=duel(a,op);
    return{p,h:d.h,r:d.r,f:d.f>0,tie:d.f===0&&withWx(a,op,()=>effSpd(a)===effSpd(op)),sc:d.s,up:d.up}}catch(e){return null}}).filter(Boolean);
  if(!rows.length)return '';
  const nm=p=>formInfo(p).base,mv=d=>d&&d.mv?d.mv.n:'';
  const L1=[];
  const good=rows.filter(r=>r.sc>=1).sort((a,b)=>b.sc-a.sc||b.h.pct-a.h.pct).slice(0,2);
  if(good.length)L1.push('◎出す：'+good.map(r=>`${nm(r.p)}（${r.up?r.up+'を積んで':''}${r.f?'先に':r.tie?'同速（五分）で':'後から'}${mv(r.h)}${r.h.pct>=100?'で一撃':`で約${Math.round(r.h.pct)}%`}）`).join('、'));
  else L1.push('△1対1で有利な匹がいない。2匹で削るか、交代で受けてから倒す');
  const bad=rows.filter(r=>r.r.pct>=80||r.sc<=-1).sort((a,b)=>b.r.pct-a.r.pct).slice(0,2);
  if(bad.length)L1.push('×出さない：'+bad.map(r=>`${nm(r.p)}（${mv(r.r)}${r.r.pct>=100?'で一撃':`で約${Math.round(r.r.pct)}%`}）`).join('、'));
  const fast=rows.filter(r=>r.f).map(r=>nm(r.p)),tie=rows.filter(r=>r.tie).map(r=>nm(r.p));
  L1.push(`速さ：相手は最速${maxSpe(q)}。${fast.length?`上から動けるのは${fast.slice(0,3).join('・')}`:tie.length?'上から動ける匹はいない':'こちらは全員が後から動く'}${tie.length?`。同速（五分）は${tie.slice(0,3).join('・')}`:''}`);
  return L1.join('\n');
}
/* PiP・画面で見せる中身（モードに合わせる） */
function memoShown(q){
  const own=memoOf(q),types=q.t.map(t=>[t,memoTypeOf(t)]).filter(x=>x[1]);
  const auto=!own&&MEMO.mode==='hybrid'?memoAuto(q):'';
  let pl=[];try{pl=team.length?mpLinesFor(q):[]}catch(e){}
  return{own,auto,types,pl};
}
/* ---- サーバーと合わせる（ログイン中だけ） ---- */
let MEMO_T=null;
function memoSyncSoon(){if(typeof AUTH==='undefined'||!AUTH.user)return;clearTimeout(MEMO_T);MEMO_T=setTimeout(memoPush,1500)}
async function memoPush(){try{await authFetch('/api/me/memo',{memo:{mon:MEMO.mon,type:MEMO.type,party:MEMO.party}})}catch(e){}}
async function memoPull(){
  if(typeof AUTH==='undefined'||!AUTH.user)return;
  let j;try{j=await authFetch('/api/me/memo')}catch(e){return}
  const s=j&&j.memo;if(!s)return memoPush();
  let ch=false;
  for(const k of ['mon','type','party'])Object.entries(s[k]||{}).forEach(([id,e])=>{const l=MEMO[k][id];if(e&&(!l||(e.at||0)>(l.at||0))){MEMO[k][id]=e;ch=true}});
  try{localStorage.setItem('pcmemo',JSON.stringify(MEMO))}catch(e){}
  const send=['mon','type','party'].some(k=>Object.entries(MEMO[k]).some(([id,e])=>!s[k]||!s[k][id]||(e.at||0)>(s[k][id].at||0)));
  if(send)memoPush();
  if(ch&&typeof keyOf==='function'&&keyOf(cur)==='memo')memoView(cur.split('/').slice(2).join('/'));
}
/* ---- 画面：#/memo（一覧）・#/memo/番号（ポケモン）・#/memo/t/タイプ ---- */
function memoView(arg){
  arg=decodeURIComponent(arg||'');
  if(arg==='party')return memoPartyEdit();
  if(arg)return memoEdit(arg);
  setHeader('戦術メモ','#/tools');
  const mons=Object.entries(MEMO.mon).filter(([,e])=>e&&e.t).map(([no,e])=>({p:byNo[+no],e})).filter(x=>x.p).sort((a,b)=>(b.e.at||0)-(a.e.at||0));
  const tys=T.filter(t=>memoTypeOf(t));
  const opp=(typeof opp6!=='undefined'?opp6:[]).map(n=>byNo[n]).filter(Boolean);
  V.innerHTML=`<p class="note">「このポケモン・このタイプが来たら、どうするか」を書いておくと、選出アシストの <b>PiP</b>（ゲームの上に浮かぶ画面）で対戦中に見られます。</p>
  <div class="sec"><h2>書き方</h2></div>
  <div class="pills" style="padding:0 16px 6px" id="mm-mode"><button class="pill" data-mm="hybrid" aria-pressed="${MEMO.mode==='hybrid'}">自動＋書き込み</button><button class="pill" data-mm="manual" aria-pressed="${MEMO.mode==='manual'}">自分で全部書く</button></div>
  <p class="note" style="padding-top:0">${MEMO.mode==='hybrid'?'いまのパーティとの1対1の計算から、出す匹・出さない匹・素早さの下書きを作ります。下書きに自由に書き足せます（書いたメモがあれば、そちらを出します）。':'自動の下書きは作りません。自分で書いたメモだけを PiP に出します。'}</p>
  <div class="sec"><h2>パーティの戦術</h2></div>
  ${(()=>{const sh=team.length?mpShown():[],nOwn=sh.filter(s=>s.own).length,nAuto=sh.filter(s=>s.auto).length;
    return `<a class="row" href="#/memo/party"><div class="row-m"><div class="row-t">${esc(typeof teamName==='function'?teamName(TEAMS.cur):'パーティ')}の戦術メモ</div><div class="row-s">${!team.length?'パーティを作ると書けます':`7つの項目（選出の型・初手・引き先・メガ・勝ち筋・負け筋・立ち回り）　書いた${nOwn}${nAuto?`・下書き${nAuto}`:''}`}</div></div>${SVG(I.chev,18)}</a>`})()}
  <div class="sec"><h2>相手のポケモンごとのメモ</h2></div>
  <button class="btn btn-p" id="mm-add" style="margin:8px 16px 0;width:calc(100% - 32px)">${SVG(I.search,17)}ポケモンのメモを書く</button>
  ${opp.length?`<div class="sec"><h2>いまの相手（選出アシスト）</h2></div>${opp.map(p=>{const s=memoShown(p);return `<a class="row" href="#/memo/${memoKey(p)}"><span class="av">${stamp(p)}</span><div class="row-m"><div class="row-t">${esc(formInfo(p).base)}</div><div class="row-s">${s.own?esc(s.own.split('\n')[0]):s.auto?'自動の下書きあり（押して書き足す）':'メモなし（押して書く）'}</div></div>${SVG(I.chev,18)}</a>`}).join('')}`:''}
  <div class="sec"><h3 style="font-size:15px;margin:0">書いたメモ</h3><span style="font-size:12px;color:var(--dim)">${mons.length}匹</span></div>
  ${mons.length?mons.map(({p,e})=>`<a class="row" href="#/memo/${memoKey(p)}"><span class="av">${stamp(p)}</span><div class="row-m"><div class="row-t">${esc(formInfo(p).base)}</div><div class="row-s" data-notr>${esc(e.t.split('\n')[0])}</div></div>${SVG(I.chev,18)}</a>`).join(''):'<p class="note">まだありません。</p>'}
  <div class="sec"><h2>タイプのメモ</h2></div>
  <p class="note" style="padding-top:0">そのタイプのポケモンが来たときに、いつも出したいメモ（例：はがねが来たら、ほのおの技を持つ匹を残す）。</p>
  <div class="as-tyg" style="padding:0 16px">${T.map(t=>`<a class="as-tyb" href="#/memo/t/${encodeURIComponent(t)}" style="--tc:${COL[t]};display:grid;place-items:center;text-decoration:none;${memoTypeOf(t)?'opacity:1;box-shadow:0 0 0 2px var(--fg)':''}">${t}</a>`).join('')}</div>
  ${tys.length?tys.map(t=>`<a class="row" href="#/memo/t/${encodeURIComponent(t)}"><div class="row-m"><div class="row-t">${chip(t)}</div><div class="row-s" data-notr>${esc(memoTypeOf(t).split('\n')[0])}</div></div>${SVG(I.chev,18)}</a>`).join(''):''}
  <a class="row" href="#/assist" style="margin-top:16px"><div class="row-m"><div class="row-t">選出アシストの PiP で見る</div><div class="row-s">PiP の「表示するカード」で「戦術メモ」を選びます</div></div>${SVG(I.chev,18)}</a>`;
  V.querySelectorAll('[data-mm]').forEach(b=>b.onclick=()=>{MEMO.mode=b.dataset.mm;memoSave();memoView('')});
  document.getElementById('mm-add').onclick=async()=>{const no=await pickMon(0);if(no)nav('#/memo/'+memoKey(byNo[no]))};
}
function memoEdit(arg){
  const isT=arg.startsWith('t/'),ty=isT?arg.slice(2):null,p=isT?null:byNo[+arg];
  if(isT&&!T.includes(ty)||!isT&&!p){V.innerHTML='<p class="empty">見つかりません。</p>';return}
  setHeader(isT?`${ty}タイプのメモ`:`${formInfo(p).base}のメモ`,'#/memo');
  const box=isT?MEMO.type:MEMO.mon,key=isT?ty:memoKey(p),cur0=box[key]&&box[key].t||'';
  const auto=!isT&&MEMO.mode==='hybrid'?memoAuto(p):'';
  const start=cur0||(auto||'');
  V.innerHTML=`${isT?`<div style="padding:16px 16px 4px">${chip(ty)}</div>`:`<div class="row" style="pointer-events:none"><span class="av">${stamp(p)}</span><div class="row-m"><div class="row-t">${esc(formInfo(p).base)}</div><div class="row-s">${p.t.map(chip).join('')}　最速${maxSpe(p)}</div></div></div>`}
  ${!isT&&MEMO.mode==='hybrid'?(auto?`<p class="note">${cur0?'書いたメモを出しています。':'いまのパーティとの1対1の計算から作った<b>下書き</b>です。'}自由に書きかえてください。${cur0?'':'保存すると、あなたのメモになります。'}</p>`:'<p class="note">パーティを登録すると、自動の下書きが作られます。</p>'):''}
  <div class="cform" style="padding:8px 16px"><textarea id="mm-t" rows="8" maxlength="${MEMO_MAX}" placeholder="${isT?'例：はがねが来たら、ほのおの技を持つ匹を最後まで残す':'例：先発で来たらガブリアスで上から。スカーフの可能性があるので、HPが半分を切ったら交代'}" data-notr style="width:100%;font-size:16px;line-height:1.7">${esc(start)}</textarea>
  <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--dim);margin-top:4px"><span>PiP では上から8行ほどが見えます</span><span id="mm-n" class="num">${start.length}/${MEMO_MAX}</span></div></div>
  <div class="btns"><button class="btn btn-p" id="mm-save">保存する</button>${auto?'<button class="btn btn-s" id="mm-auto" style="flex:none;padding:0 16px">下書きに戻す</button>':''}${cur0?'<button class="btn btn-s" id="mm-del" style="flex:none;padding:0 16px">消す</button>':''}</div>`;
  const ta=document.getElementById('mm-t');ta.oninput=()=>{document.getElementById('mm-n').textContent=`${ta.value.length}/${MEMO_MAX}`};
  document.getElementById('mm-save').onclick=()=>{const v=ta.value.trim().slice(0,MEMO_MAX);
    if(v)box[key]={t:v,at:Date.now()};else box[key]={t:'',at:Date.now()};memoSave();toast('メモを保存しました');nav('#/memo')};
  const ra=document.getElementById('mm-auto');if(ra)ra.onclick=()=>{ta.value=auto;ta.oninput()};
  const dl=document.getElementById('mm-del');if(dl)dl.onclick=async()=>{if(!await askConfirm({title:'メモを消しますか？',text:'このメモを消します。',ok:'消す'}))return;box[key]={t:'',at:Date.now()};memoSave();toast('消しました');nav('#/memo')};
}
/* ---- PiP のカード ---- */
function memoPipPages(opp){
  let pp=[];try{pp=team.length?mpPipPages():[]}catch(e){}
  return[...pp,...opp.map((p,j)=>{const s=memoShown(p);return(s.own||s.auto||s.types.length||s.pl.length)?{kind:'memo',p,j,s}:null}).filter(Boolean)];
}
function memoPipDraw(g,pg){
  let y0=0;const W0=PIP_W-56;
  const wrapAt=(txt,col,fs,lh,lim)=>{g.fillStyle=col;g.font=`700 ${fs}px ${FF}`;
    for(const para of String(txt).split('\n')){let line='';for(const ch of para){if(g.measureText(line+ch).width>W0){if(y0>lim)return false;g.fillText(line,28,y0+fs);y0+=lh;line=ch}else line+=ch}
      if(y0>lim)return false;g.fillText(line,28,y0+fs);y0+=lh}return true};
  if(pg.party){
    g.fillStyle='#e7e9ea';fitTxt(g,(typeof teamName==='function'?teamName(TEAMS.cur):'パーティ')+'の戦術',28,62,PIP_W-56,36,800);
    y0=88;const per=pg.secs.length>1?(PIP_H-88-60)/pg.secs.length:PIP_H-148;
    pg.secs.forEach((s,k)=>{const top=88+k*per;y0=top;
      g.fillStyle='#ffd400';g.font=`800 24px ${FF}`;g.fillText(`${MP_SECS.findIndex(x=>x.k===s.k)+1}. ${s.t}${s.own?'':'（下書き）'}`,28,y0+24);y0+=38;
      wrapAt(s.v,'#e7e9ea',24,33,top+per-40)});
    return;
  }
  const p=pg.p,s=pg.s;
  p.t.forEach((t,k)=>tIcon(g,t,28+k*58,30,52));
  g.fillStyle='#e7e9ea';fitTxt(g,formInfo(p).base,28+p.t.length*58+10,74,PIP_W-60-p.t.length*58,48,800);
  g.fillStyle='#ffd400';g.font=`800 24px ${FF}`;g.fillText(s.own?'戦術メモ':s.auto?'戦術メモ（自動の下書き）':'戦術メモ',28,124);
  /* 折り返して書く */
  let y=150;const W=PIP_W-56,lh=36;
  const wrap=(txt,col,fs)=>{g.fillStyle=col;g.font=`700 ${fs}px ${FF}`;
    for(const para of String(txt).split('\n')){let line='';for(const ch of para){if(g.measureText(line+ch).width>W){if(y>PIP_H-70)return;g.fillText(line,28,y+fs);y+=lh;line=ch}else line+=ch}
      if(y>PIP_H-70)return;g.fillText(line,28,y+fs);y+=lh}};
  if(s.own||s.auto)wrap(s.own||s.auto,'#e7e9ea',27);
  if(s.pl&&s.pl.length&&y<PIP_H-110){y+=8;g.fillStyle='#ffd400';g.font=`800 22px ${FF}`;g.fillText('パーティの戦術メモから',28,y+22);y+=36;wrap(s.pl.join('\n'),'#e7e9ea',25)}
  s.types.forEach(([t,m])=>{if(y>PIP_H-110)return;y+=10;tIcon(g,t,28,y,30);g.fillStyle='#8b98a5';g.font=`800 22px ${FF}`;g.fillText(`${t}タイプのメモ`,68,y+23);y+=40;wrap(m,'#c4c9cc',24)});
}

/* ===================== パーティの戦術メモ（2026/11/06 依頼主の「選出・戦術メモに必要な7つの要素」） =====================
   自分のパーティ（保存している3つのうちの1つずつ）について、7つの項目を書く。
   自動＋書き込みのときは、項目ごとに計算の下書きを作る（selPlan＝使用率上位40匹との1対1、estHit、loseReasons、bdMon）。
   計算で決めにくい項目（立ち回りの分岐）は、パーティの技から作る「書き方の例」。 */
const MP_SECS=[
  {k:'kind',t:'相手の構築タイプ別の選出',d:'相手の軸（対面・受けサイクル・展開）ごとに、先発1匹＋後ろ2匹を決めておく。',ph:'対 対面：先発（行動保証）＋メガエース＋スイーパー'},
  {k:'lead',t:'よく来る相手への初手（先発）',d:'先発に出てきやすい相手に、だれを合わせるか。',ph:'初手カバルドン → アシレーヌを合わせて、みずの技で圧力'},
  {k:'pivot',t:'相手のエースへの引き先',d:'相手のエースが出てきたら、だれで受けて、だれで返すか。',ph:'ガブリアス → カバルドンで受ける → あくびで流す'},
  {k:'mega',t:'メガシンカを切るタイミング',d:'いつ・どの相手のときにメガシンカするか（しないか）。',ph:'ゴーストタイプが倒れたあと、わるだくみを安全に積めるときだけ'},
  {k:'win',t:'勝ち筋（詰め役）の順番',d:'終盤にだれで相手の残りを倒すか。プランA・Bの順に。',ph:'プランA：メガルカリオでわるだくみ→全抜き'},
  {k:'lose',t:'負け筋・気をつける技と特性',d:'これをされると負ける、という形。',ph:'相手のこだわりスカーフに、エースが上から叩かれる'},
  {k:'flow',t:'立ち回りの分岐',d:'「〇〇されたら××する」。',ph:'相手が引いた → 積み技を選ぶ'}
];
const MP_MAX=600;
const mpKey=()=>String(typeof TEAMS!=='undefined'?TEAMS.cur:0);
const mpOf=()=>{const e=MEMO.party[mpKey()];return e&&e.s?e.s:{}};
const mpSig=()=>team.map(x=>x.no).join('-');
let MP_AUTO=null;
function memoPartyAuto(){
  const sig=mpSig()+'|'+team.map(x=>JSON.stringify(x.set||0)).join('|');
  if(MP_AUTO&&MP_AUTO.sig===sig)return MP_AUTO.v;
  let v={};try{v=mpAutoCalc()}catch(e){v={}}
  MP_AUTO={sig,v};return v;
}
function mpAutoCalc(){
  if(team.length<4)return{};
  const P=selPlan(team);if(!P)return{};
  const n=team.length,me=P.me,S=P.S,opps=P.opps,ix=[...Array(n).keys()].filter(i=>me[i]);
  const nm=i=>formInfo(byNo[team[i].no]).base,qn=q=>formInfo(q).base;
  const item=i=>team[i].set&&team[i].set.it&&team[i].set.it.k;
  const keys=i=>((team[i].set&&team[i].set.mv)||[]).map(m=>m&&MD[m.id]&&MD[m.id][3]).filter(Boolean);
  const mvn=k=>{const id=Object.keys(MD).find(x=>MD[x][3]===k);return id?mName(+id):k};
  const spd=b=>b.st[5]*(b.item==='choicescarf'?1.5:1);
  const w=opps.map((_,j)=>1-j/(opps.length*2)),avg=i=>S[i].reduce((t,v,j)=>t+v*w[j],0);
  const OPM={};const opm=j=>{if(OPM[j]!==undefined)return OPM[j];const q=opps[j];try{OPM[j]=mkMon(q,'op',q.base&&byNo[q.base]?{...detSet(byNo[q.base]),ab:q.ab,item:null}:detSet(q))}catch(e){OPM[j]=null}return OPM[j]};
  const hit=(a,d)=>{try{return estHit(a,d)}catch(e){return{pct:0,mv:null}}};
  const mvName=h=>h&&h.mv?h.mv.n:'';
  const dm=h=>`${mvName(h)}${h.pct>=100?'で一撃':`で約${Math.round(h.pct)}%`}`;
  const bd=team.map(x=>{try{return bdMon(x)}catch(e){return null}});
  const SETS=[...GM_PSET,...GM_SSET,...GM_BSET];
  const setup=i=>keys(i).find(k=>SETS.includes(k));
  const prio=i=>me[i]&&me[i].moves.find(m=>m&&m.pri>0&&m.pow>0);
  const guard=i=>item(i)==='focussash'?'きあいのタスキ':['sturdy','multiscale','shadow-shield','disguise'].includes(me[i]&&me[i].ab)?ABN[me[i].ab]:'';
  const megaI=ix.filter(i=>isStone(item(i)));
  const atk=i=>Math.max(me[i].st[1],me[i].st[3]);
  const bulk=i=>me[i].st[0]*(me[i].st[2]+me[i].st[4]);
  const byAvg=[...ix].sort((a,b)=>avg(b)-avg(a));
  /* 3匹を、重ならず・メガは1匹までで選ぶ */
  const pick3=lists=>{const out=[];lists.forEach(L=>{const c=L.find(i=>i!=null&&!out.includes(i)&&!(megaI.includes(i)&&out.some(o=>megaI.includes(o))));if(c!=null)out.push(c)});
    byAvg.forEach(i=>{if(out.length<3&&!out.includes(i)&&!(megaI.includes(i)&&out.some(o=>megaI.includes(o))))out.push(i)});return out};
  const tag=(i,why)=>`${nm(i)}${why?`（${why}）`:''}`;
  const R={};
  /* ① 構築タイプ別 */
  {const fin=P.finisher;
    const g=ix.filter(i=>guard(i));
    const a=pick3([[...g,...P.lead],megaI.length?megaI:byAvg,[fin,...byAvg]]);
    const brk=[...ix].sort((x,y)=>(setup(y)?1:0)-(setup(x)?1:0)||atk(y)-atk(x));
    const cush=ix.filter(i=>bd[i]&&bd[i].wall).sort((x,y)=>bulk(y)-bulk(x));
    const b=pick3([brk,cush.length?cush:[...ix].sort((x,y)=>bulk(y)-bulk(x)),[fin,...byAvg]]);
    const tn=ix.filter(i=>keys(i).some(k=>['taunt','encore','whirlwind','roar','haze','defog','rapidspin'].includes(k)));
    const fast=[...ix].sort((x,y)=>spd(me[y])-spd(me[x]));
    const c=pick3([tn.length?tn:fast,[fin,...megaI,...byAvg],byAvg]);
    const why0=i=>guard(i)||(megaI.includes(i)?'メガ':'');
    R.kind=[`対 対面：先発${tag(a[0],guard(a[0]))}＋${tag(a[1],megaI.includes(a[1])?'メガエース':'')}＋${tag(a[2],'詰め役')}`,
      `対 受けサイクル：先発${tag(b[0],setup(b[0])?mvn(setup(b[0]))+'で崩す':'崩し役')}＋${tag(b[1],'クッション')}＋${tag(b[2],'エース')}`,
      `対 展開（壁・ステロ）：先発${tag(c[0],tn.includes(c[0])?mvn(keys(c[0]).find(k=>['taunt','encore','whirlwind','roar','haze','defog','rapidspin'].includes(k)))+'で止める':'速さで先に削る')}＋${tag(c[1],'エース')}＋${tag(c[2],'補完')}`].join('\n');
    void why0;}
  /* 2026/11/08 依頼主の指摘で作りかえ：
     ・相手が場に出ると天気を変える（バンギラスの砂嵐など）なら、その天気で計算（estHit/duel の withWx）。理由にも書く
     ・候補は1匹に決めつけず、有利な匹が2匹いれば「AまたはB」
     ・受けた匹がそのまま勝てるなら、別の匹に交代させず「そのまま〇〇で返す」
     ・「受ける」は⑥と同じ基準（いちばん痛い技で50%未満＝2回耐える） */
  const WXJ={sun:'晴れ',rain:'雨',sand:'砂嵐',snow:'雪'};
  const wxNote=o=>{const k=o&&WSET[o.ab];return k?`（${qn(o.p)}の特性で${WXJ[k]}になるので、${WXJ[k]}の中で計算）`:''};
  const why=(i,o)=>{const h=hit(me[i],o),[x,y]=withWx(me[i],o,()=>[effSpd(me[i]),effSpd(o)]);return `${x>y?'先に':x===y?'同速（五分）で':'後から'}${dm(h)}`};
  const both=(L,o)=>L.length>1?`${nm(L[0])}（${why(L[0],o)}）または${nm(L[1])}（${why(L[1],o)}）`:`${nm(L[0])}（${why(L[0],o)}）`;
  /* ② 初手の答え：使用率の上位から6匹 */
  {const L=[];opps.slice(0,6).forEach((q,j)=>{const o=opm(j);if(!o)return;
      const rank=[...ix].sort((x,y)=>S[y][j]-S[x][j]||hit(me[y],o).pct-hit(me[x],o).pct),good=rank.filter(i=>S[i][j]>=1);
      if(good.length)L.push(`初手${qn(q)} → ${both(good.slice(0,2),o)}を合わせる${wxNote(o)}`);
      else{const g=ix.find(i=>guard(i)&&i!==rank[0]),dmg=[...ix].sort((x,y)=>hit(me[y],o).pct-hit(me[x],o).pct)[0],a=[dmg,...(g!=null&&g!==dmg?[g]:[])];
        L.push(`初手${qn(q)} → 有利な匹がいない。${a.map(i=>`${nm(i)}${guard(i)?`（${guard(i)}）`:''}`).join('または')}で削ってから後ろへつなぐ${wxNote(o)}`)}});
    R.lead=L.join('\n')}
  /* ③ エースへの引き先：攻撃か特攻が高い相手 */
  {const L=[];opps.map((q,j)=>({q,j})).filter(({q})=>Math.max(q.s[1],q.s[3])>=120).slice(0,4).forEach(({q,j})=>{const o=opm(j);if(!o)return;
      const tk=ix.map(i=>({i,h:hit(o,me[i])})).sort((a,b)=>a.h.pct-b.h.pct),rc=tk[0];if(!rc)return;
      const rets=[...ix].filter(i=>i!==rc.i&&S[i][j]>=1).sort((x,y)=>S[y][j]-S[x][j]);
      const retTxt=pre=>rets.length?`${pre}${both(rets.slice(0,2),o)}で返す`:`${pre}削り合う（有利に返せる匹がいない）`;
      if(rc.h.pct<50){const self=S[rc.i][j]>=1;
        L.push(`${qn(q)} → ${nm(rc.i)}で受ける（いちばん痛い${mvName(rc.h)||'技'}で約${Math.round(rc.h.pct)}%）→ ${self?`そのまま${nm(rc.i)}で返す（${dm(hit(me[rc.i],o))}）`:retTxt('')}${wxNote(o)}`)}
      else{const all=[...ix].filter(i=>S[i][j]>=1).sort((x,y)=>S[y][j]-S[x][j]);
        L.push(`${qn(q)} → 2回耐えられる匹がいない。${all.length?`1匹倒されてから${both(all.slice(0,2),o)}を出して返す`:'先に倒すか、ほかの匹で削っておく'}${wxNote(o)}`)}});
    R.pivot=L.join('\n')}
  /* ④ メガシンカ */
  if(megaI.length){const L=[];
    if(megaI.length>=2){const [m1,m2]=megaI,a1=[],a2=[];opps.slice(0,20).forEach((q,j)=>{const d=S[m1][j]-S[m2][j];if(d>=1)a1.push(qn(q));else if(d<=-1)a2.push(qn(q))});
      L.push(`どちらを出すか：${a1.length?`${a1.slice(0,3).join('・')}がいる→${nm(m1)}`:''}${a1.length&&a2.length?'、':''}${a2.length?`${a2.slice(0,3).join('・')}がいる→${nm(m2)}`:''}`)}
    megaI.forEach(m=>{const good=opps.map((q,j)=>({q,j})).filter(({j})=>S[m][j]>=1).slice(0,3).map(x=>qn(x.q));
      const bad=opps.map((q,j)=>({q,j})).filter(({j})=>S[m][j]<=-1).slice(0,2).map(({q,j})=>{const o=opm(j),r=o?hit(o,me[m]):null;return `${qn(q)}${r&&r.mv?`（${mvName(r)}で約${Math.round(r.pct)}%）`:''}`});
      L.push(`${nm(m)}：${good.length?`${good.join('・')}が相手のときに切る`:'有利な相手が少ない。場が整ってから切る'}${bad.length?`。${bad.join('・')}が残っている間は控え、倒してから`:''}`)});
    R.mega=L.join('\n')}
  else R.mega='';
  /* ⑤ 勝ち筋 */
  {const L=[],used=[];
    const su=[...ix].filter(setup).sort((x,y)=>atk(y)-atk(x))[0];
    if(su!=null){L.push(`プランA：${nm(su)}で${mvn(setup(su))}→全抜き`);used.push(su)}
    const pr=[...ix].filter(i=>!used.includes(i)&&prio(i)).sort((x,y)=>atk(y)-atk(x))[0];
    if(pr!=null){L.push(`プラン${L.length?'B':'A'}：相手を削ったあと、${nm(pr)}の${prio(pr).n}で詰める`);used.push(pr)}
    const sc=[...ix].find(i=>!used.includes(i)&&item(i)==='choicescarf');
    if(sc!=null&&L.length<2){L.push(`プラン${L.length?'B':'A'}：${nm(sc)}のこだわりスカーフで上から倒す`);used.push(sc)}
    const fs=[...ix].filter(i=>!used.includes(i)).sort((x,y)=>spd(me[y])*atk(y)-spd(me[x])*atk(x))[0];
    if(L.length<2&&fs!=null)L.push(`プラン${L.length?'B':'A'}：${nm(fs)}で上から削り切る（最速${me[fs].st[5]}）`);
    R.win=L.join('\n')}
  /* ⑥ 負け筋 */
  {const L=[];
    /* よく使われる相手への答え（⑥。③と同じ基準：2回耐える／半分以上削って半分未満しか受けない／上から一撃）。
       答えが0匹＝だれも答えられない、1匹だけ＝その匹に頼りすぎ（先に倒される・状態異常で止められると崩れる）。
       loseReasons の「だれも答えられない」は使わない（③と食い違うため。2026/11/08 依頼主の指摘） */
    const no=[],dep={};
    opps.slice(0,10).forEach((q,j)=>{const o=opm(j);if(!o)return;
      const ans=ix.filter(i=>{const x=hit(me[i],o).pct,y=hit(o,me[i]).pct;return y<50||(x>=50&&y<50)||(spd(me[i])>spd(o)&&x>=100)});
      if(!ans.length)no.push(qn(q));else if(ans.length===1)(dep[ans[0]]=dep[ans[0]]||[]).push(qn(q))});
    if(no.length)L.push(`よく使われる${no.slice(0,3).join('・')}に、だれも答えられない`);
    const dk=Object.keys(dep).sort((a,b)=>dep[b].length-dep[a].length)[0];
    if(dk!=null)L.push(`${dep[dk].slice(0,3).join('・')}への答えが${nm(+dk)}だけ。${nm(+dk)}が先に倒されたり、状態異常で動けなくなったりすると止められない`);
    try{loseReasons(team).filter(r=>!/だれも答えられない/.test(r.t)).sort((a,b)=>b.w-a.w).slice(0,1).forEach(r=>L.push(r.t))}catch(e){}
    const fin=P.finisher;if(fin!=null&&me[fin]){const th=opps.slice(0,15).map((q,j)=>({q,j})).find(({q,j})=>{const o=opm(j);return o&&maxSpe(q)*1.5>spd(me[fin])&&maxSpe(q)<=spd(me[fin])&&hit(o,me[fin]).pct>=50});
      if(th)L.push(`相手のこだわりスカーフ（${qn(th.q)}など）に、${nm(fin)}が上から叩かれる`)}
    const phys=ix.filter(i=>me[i].st[1]>me[i].st[3]&&me[i].moves.some(m=>m&&m.cls===0&&m.pow>0));
    if(phys.length>=2)L.push(`おにびで物理の${phys.slice(0,3).map(nm).join('・')}が止まる`);
    if(!bd.some(o=>o&&o.phaze))L.push('相手の起点づくり（ステルスロック・あくび・壁）を許す展開');
    R.lose=L.slice(0,4).join('\n')}
  /* ⑦ 立ち回りの分岐（パーティの技から作る書き方の例） */
  {const L=[];const su=[...ix].filter(setup).sort((x,y)=>atk(y)-atk(x))[0];
    L.push(su!=null?`相手が引いた → ${nm(su)}は${mvn(setup(su))}を積む`:'相手が引いた → 交代先にも通る技を選ぶ');
    L.push('相手が突っ込んできた → 確定数を重視して、いちばん強い技で削る');
    const cs=ix.filter(i=>bd[i]&&bd[i].wall).sort((x,y)=>bulk(y)-bulk(x))[0];
    if(cs!=null)L.push(`先発が不利な対面 → ${nm(cs)}に引いて受ける`);
    const pr=[...ix].filter(i=>prio(i))[0];if(pr!=null)L.push(`相手の残りのHPが少ない → ${nm(pr)}の${prio(pr).n}で詰める`);
    if(megaI.length)L.push(`メガシンカ → ④の条件がそろうまで切らない`);
    R.flow=L.join('\n')}
  return R;
}
/* 画面・PiP に出す中身：書いたもの、なければ（自動＋書き込みのとき）下書き */
function mpShown(){
  const own=mpOf(),auto=MEMO.mode==='hybrid'?memoPartyAuto():{};
  return MP_SECS.map(s=>({...s,own:own[s.k]||'',auto:own[s.k]?'':(auto[s.k]||'')})).map(s=>({...s,v:s.own||s.auto}));
}
function memoPartyEdit(){
  setHeader('パーティの戦術メモ','#/memo');
  const tn=typeof teamName==='function'?teamName(TEAMS.cur):'';
  const own=mpOf(),auto=MEMO.mode==='hybrid'?memoPartyAuto():{};
  const few=team.length<4;
  V.innerHTML=`<div class="sec"><h2>${esc(tn)}</h2><a href="#/team" style="font-size:13px">パーティを見る</a></div>
  ${TEAMS.list.length>1?`<div class="pills" style="padding:0 16px 6px">${TEAMS.list.map((_,i)=>`<button class="pill" data-mp-team="${i}" aria-pressed="${i===TEAMS.cur}">${esc(teamName(i))}</button>`).join('')}</div>`:''}
  <div style="display:flex;gap:4px;padding:0 16px 8px">${team.map(x=>byNo[x.no]?`<span class="av" style="width:34px;height:34px">${stamp(byNo[x.no])}</span>`:'').join('')}</div>
  <p class="note" style="padding-top:0">${MEMO.mode==='hybrid'?(few?'ポケモンが4匹以上になると、自動の下書きが作られます。':'項目ごとに、計算で作った<b>下書き</b>が入っています（使用率の上位の相手との1対1の計算から）。自由に書きかえてください。⑦は書き方の例です。'):'自動の下書きは作りません。自分で全部書きます。'}</p>
  ${MP_SECS.map((s,i)=>{const v=own[s.k]||auto[s.k]||'';return `<div class="mp-s" data-k="${s.k}">
    <div class="mp-h"><span class="mp-n num">${i+1}</span><b>${s.t}</b></div>
    <p class="mp-d">${s.d}</p>
    <textarea rows="${Math.max(3,Math.min(7,v.split('\n').length+1))}" maxlength="${MP_MAX}" placeholder="例：${esc(s.ph)}" data-notr>${esc(v)}</textarea>
    <div class="mp-f"><span>${own[s.k]?'書いたメモ':auto[s.k]?'自動の下書き':''}</span>${auto[s.k]?`<button class="mp-r" data-r="${s.k}">下書きに戻す</button>`:''}</div></div>`}).join('')}
  <div class="btns"><button class="btn btn-p" id="mp-save">保存する</button></div>
  <p class="note">選出アシストの PiP で「戦術メモ」を選ぶと、対戦中にこのメモを見られます。②③は、相手の6匹にいるポケモンの行だけを、そのポケモンのページに出します。</p>`;
  const grow=ta=>{ta.style.height='auto';ta.style.height=(ta.scrollHeight+2)+'px'};
  V.querySelectorAll('.mp-s textarea').forEach(ta=>{grow(ta);ta.addEventListener('input',()=>grow(ta))});
  V.querySelectorAll('[data-mp-team]').forEach(b=>b.onclick=()=>{switchTeam(+b.dataset.mpTeam);memoPartyEdit()});
  V.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{const ta=V.querySelector(`.mp-s[data-k="${b.dataset.r}"] textarea`);ta.value=auto[b.dataset.r]||'';grow(ta)});
  document.getElementById('mp-save').onclick=()=>{const s={};
    V.querySelectorAll('.mp-s').forEach(d=>{const k=d.dataset.k,v=d.querySelector('textarea').value.trim().slice(0,MP_MAX);
      /* 下書きのまま変えていない項目は保存しない（パーティを変えたら下書きも新しくなるように） */
      if(v&&!(v===(auto[k]||'').trim()&&!own[k]))s[k]=v});
    MEMO.party[mpKey()]={s,at:Date.now(),sig:mpSig()};memoSave();toast('メモを保存しました');nav('#/memo')};
}
/* PiP：パーティのページ（①⑤ → ④⑥ → ⑦）。相手が分かっているときは、②③の行のうち相手の6匹の名前を含む行を、相手ごとのページへ */
function mpPipPages(){
  const sh=mpShown(),by=k=>sh.find(s=>s.k===k);
  return [['kind','win'],['mega','lose'],['flow']].map(ks=>ks.map(by).filter(s=>s&&s.v)).filter(a=>a.length).map(secs=>({kind:'memo',party:true,secs}));
}
function mpLinesFor(p){
  const nmz=formInfo(p).base,sh=mpShown(),out=[];
  ['lead','pivot'].forEach(k=>{const s=sh.find(x=>x.k===k);if(s&&s.v)s.v.split('\n').filter(l=>l.split('→')[0].includes(nmz)).forEach(l=>out.push(l))});
  return out;
}
