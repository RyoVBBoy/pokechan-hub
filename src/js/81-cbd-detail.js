/* ===================== 図鑑のページだけの実戦データ（2026/11/16 依頼主「限定して、決まりに合う形で再開」） =====================
   Pokémon Champions Battle Data（非公式の集計）を、図鑑のページの「型・育成」タブを開いたときにだけ、その1匹分だけ読んで出す。
   ・全体の休止（15-battle.js の CBD_ON=false・CBD_PERSIST=false）はそのまま。ここは別のスイッチ CBD_DETAIL で、ほかの画面（診断・選出・流行・ランキング・
     使用率の高い型・bot・公開のページ）には一切つながらない（LIVE.csv には入れない）。
   ・残さない：localStorage・sessionStorage・IndexedDB・サーバーに書かない。ブラウザの通信の控えも使わない（cache:'no-store'）。
     覚えるのは、いま開いている1匹・1形式の分だけ（CBDD）。ほかのポケモン・ほかの画面に移ったら捨てる。同じ読み込みが重なったら1回にまとめるだけ。
   ・書かれていないことは書かない：集計期間・レギュレーション・対戦数は提供元のデータに無いので「不明」。取得した時刻は、実際に読めた時刻だけ。
     提供元の並び順（column_position）は「並び順」と書き、使用率とは書かない。割合は項目ごと（技・持ち物・特性・性格・能力ポイントの振り方）で、
     組み合わせた型の割合は作らない。
   ・出典（提供元の API の決まり https://championsbattledata.com/api-rules/ ）：このデータを出す所には必ず
     「Battle data provided by Pokémon Champions Battle Data」とリンクを出す（cbdAttrHTML）。PokéKit や当サイトの計算の所には出さない */
const CBD_DETAIL=true;
const CBD_ATTR_TXT='Battle data provided by Pokémon Champions Battle Data';
const cbdAttrHTML=()=>`<p class="cbdd-attr" data-notr><a href="${CBD}/" target="_blank" rel="noopener noreferrer">${CBD_ATTR_TXT}</a></p>`;
const CBDD={key:null,p:null,d:null,at:null,st:'idle'};
const cbddDrop=()=>{CBDD.key=null;CBDD.p=null;CBDD.d=null;CBDD.at=null;CBDD.st='idle'};
/* 図鑑のページを離れた・ほかのポケモンのページに移った → 読んだ分を捨てる */
if(typeof window!=='undefined')window.addEventListener('hashchange',()=>{const m=location.hash.match(/^#\/p\/(\d+)/);if(!m||!CBDD.key||CBDD.key.split(':')[0]!==m[1])cbddDrop()});
/* 提供元の答え（/api/battle/形式/名前 の rows）を、項目ごとに分ける。値は変えない（割合は提供元の数字のまま） */
function cbddParse(j){
  const d={pos:null,mv:[],it:[],ab:[],nat:[],sp:[]};
  const num=v=>typeof v==='number'&&isFinite(v)?v:null;
  (Array.isArray(j&&j.rows)?j.rows:[]).forEach(r=>{if(!r||typeof r!=='object')return;
    const pc=num(r.percentage_value),nm=String(r.name||'');
    if(d.pos==null&&Number.isInteger(r.column_position)&&r.column_position>0)d.pos=r.column_position;
    if(r.category==='move'&&nm)d.mv.push([nm,pc]);
    else if(r.category==='held_item'&&nm)d.it.push([nm,pc]);
    else if(r.category==='ability'&&nm)d.ab.push([nm,pc]);
    else if(r.category==='stat_alignment'&&nm)d.nat.push([nm,String(r.stat_up||''),String(r.stat_down||''),pc]);
    else if(r.category==='stat_points'){const v=[r.hp_points,r.attack_points,r.defense_points,r.sp_atk_points,r.sp_def_points,r.speed_points];
      if(v.every(x=>Number.isInteger(x)&&x>=0))d.sp.push([v,pc])}});
  return d;
}
/* 読む：同じ匹・同じ形式の読み込みが重なったら1回にまとめる。読めたものは、その匹のページを開いている間だけ持つ */
function cbddLoad(p,fmt){
  const id=ENSP[p.no],key=p.no+':'+fmt;
  if(!CBD_DETAIL||!id)return Promise.resolve({st:'none'});
  if(CBDD.key===key&&CBDD.p)return CBDD.p;
  cbddDrop();CBDD.key=key;CBDD.st='loading';
  const pr=(async()=>{
    try{
      const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),15000);
      const r=await fetch(`${CBD}/api/battle/${fmt==='double'?'Doubles':'Singles'}/${encodeURIComponent(id)}`,{cache:'no-store',credentials:'omit',signal:ctl.signal});clearTimeout(tm);
      if(r.status===404)return{st:'none'};
      if(!r.ok)return{st:'err'};
      const d=cbddParse(await r.json());
      if(!d.mv.length&&!d.it.length&&!d.ab.length)return{st:'none'};
      return{st:'ok',d,at:new Date()};
    }catch(e){return{st:'err'}}
  })().then(res=>{if(CBDD.key===key){CBDD.st=res.st;CBDD.d=res.d||null;CBDD.at=res.at||null;if(res.st==='err')CBDD.p=null}return res});
  CBDD.p=pr;return pr;
}
const CBDD_STAT={'attack':1,'defense':2,'sp. atk':3,'sp. def':4,'speed':5};
const cbddPc=v=>v==null?'<i class="cbdd-u">割合は不明</i>':`<i>${v}%</i>`;
function cbddHTML(p,fmt,res){
  const fN=fmt==='double'?'ダブル':'シングル';
  const head=`<div class="cbdd-h"><b>ランクバトルの集計（項目ごと・${fN}）</b><span class="cbdd-tag">実戦データ</span></div>`;
  if(res.st==='loading')return `<div class="cbdd" data-cbdd="loading" role="status">${head}<p class="cbdd-n">集計を読み込んでいます…</p></div>`;
  if(res.st==='err')return `<div class="cbdd" data-cbdd="err" role="alert">${head}<p class="cbdd-n"><b>集計を読めませんでした。</b>提供元につながらないか、答えを読み取れませんでした。前に読めたデータは表示しません。</p><div class="btns" style="padding:8px 0 0"><button class="btn btn-s" data-cbdd-retry>もう一度読み込む</button></div>${cbdAttrHTML()}</div>`;
  if(res.st==='none')return `<div class="cbdd" data-cbdd="none">${head}<p class="cbdd-n">${esc(p.n)}の${fN}の集計は、提供元にありませんでした。</p>${cbdAttrHTML()}</div>`;
  const d=res.d,at=res.at;
  const row=(t,a,f)=>a.length?`<div class="gus"><b>${t}</b><div>${a.map(x=>`<span>${f(x)} ${cbddPc(x[x.length-1])}</span>`).join('')}</div></div>`:'';
  const mv=x=>{const id=MVKA[nrm(x[0])];return id?`<a href="#/move/${id}" style="color:var(--acc)">${esc(mName(id))}</a>`:esc(x[0])};
  const it=x=>{const k=nrm(x[0])==='leek'?'stick':nrm(x[0]);return ITEMN[k]?esc(ITEMN[k]):esc(x[0])};
  const ab=x=>{const k=ABK[nrm(x[0])];return esc(k&&ABN[k]?ABN[k]:x[0])};
  const nat=x=>{const u=CBDD_STAT[x[1].toLowerCase()],dn=CBDD_STAT[x[2].toLowerCase()];return u&&dn&&u!==dn?esc(natName(u,dn)):`${esc(x[0])}${!x[1]&&!x[2]?'（補正なし）':''}`};
  const sp=x=>x[0].map((v,i)=>v?`${SN[i]}${v}`:'').filter(Boolean).join('・')||'振りなし';
  const tm=`${at.getFullYear()}/${at.getMonth()+1}/${at.getDate()} ${at.getHours()}:${String(at.getMinutes()).padStart(2,'0')}`;
  return `<div class="cbdd" data-cbdd="ok">${head}
    <dl class="cbdd-meta"><div><dt>出典</dt><dd>Pokémon Champions Battle Data（非公式の集計）</dd></div>
      <div><dt>取得した時刻</dt><dd data-cbdd-at="${at.getTime()}">${tm}</dd></div>
      <div><dt>集計期間</dt><dd>不明</dd></div><div><dt>レギュレーション</dt><dd>不明</dd></div><div><dt>対戦数</dt><dd>不明</dd></div>
      ${d.pos?`<div><dt>提供元での並び順</dt><dd>${d.pos}番目<small>（提供元の並び順です。使用率ではありません）</small></dd></div>`:''}</dl>
    <p class="cbdd-n">下の割合は<b>項目ごと</b>のものです。技・持ち物・特性などを組み合わせた「1つの型」が使われた割合ではありません。</p>
    ${row('技',d.mv.slice(0,10),mv)}${row('持ち物',d.it.slice(0,10),it)}${row('特性',d.ab.slice(0,4),ab)}${row('性格',d.nat.slice(0,5),nat)}${row('能力ポイント',d.sp.slice(0,5),sp)}
    ${d.sp.length?'<p class="cbdd-n cbdd-prov">能力ポイントの振り方は、提供元のデータの欄の名前から読み取ったものです。欄の正確な意味と集計の方法は、まだ確かめられていません。</p>':''}
    ${cbdAttrHTML()}</div>`;
}
/* 「型・育成」タブの中の置き場所（#cbdd-box）に出す。メガシンカの姿のページでは読まない（元の姿のページで見る） */
function cbddMount(root,p,fmt){
  const box=root&&root.querySelector('#cbdd-box');if(!box||!CBD_DETAIL||p.base)return;
  const draw=res=>{box.innerHTML=cbddHTML(p,fmt,res);const rb=box.querySelector('[data-cbdd-retry]');if(rb)rb.onclick=()=>{cbddDrop();cbddMount(root,p,fmt)}};
  const key=p.no+':'+fmt;
  if(CBDD.key===key&&CBDD.st==='ok'){draw({st:'ok',d:CBDD.d,at:CBDD.at});return}
  draw({st:'loading'});
  cbddLoad(p,fmt).then(res=>{if(box.isConnected&&CBDD.key===key)draw(res)});
}
