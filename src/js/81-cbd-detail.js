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
  if(!CBD_DETAIL)return Promise.resolve({st:'none'});
  if(!id)return Promise.resolve({st:'noid'});
  if(CBDD.key===key&&CBDD.p)return CBDD.p;
  cbddDrop();CBDD.key=key;CBDD.st='loading';
  const pr=(async()=>{
    try{
      const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),15000);
      const r=await fetch(`${CBD}/api/battle/${fmt==='double'?'Doubles':'Singles'}/${encodeURIComponent(id)}`,{cache:'no-store',credentials:'omit',signal:ctl.signal});clearTimeout(tm);
      if(r.status===404)return{st:'none'};
      if(!r.ok)return{st:'err'};
      const j=await r.json();
      /* 答えの形式が頼んだ形式と違えば、見出しを取りちがえないように使わない（読めなかった扱い） */
      const want=fmt==='double'?'doubles':'singles';
      if(j&&j.format!=null&&String(j.format).toLowerCase()!==want)return{st:'err'};
      const d=cbddParse(j);
      if(!d.mv.length&&!d.it.length&&!d.ab.length)return{st:'none'};
      return{st:'ok',d,at:new Date()};
    }catch(e){return{st:'err'}}
  })().then(res=>{if(CBDD.key===key){CBDD.st=res.st;CBDD.d=res.d||null;CBDD.at=res.at||null;if(res.st==='err')CBDD.p=null}return res});
  CBDD.p=pr;return pr;
}
const CBDD_STAT={'attack':1,'defense':2,'sp. atk':3,'sp. def':4,'speed':5};
const cbddPad=n=>String(n).padStart(2,'0');
/* 表示の形（2026/11/16 依頼主「データを見つけやすく」）：
   いつも見える＝見出し（形式）・1行のまとめ（提供元の並び順・取得した時刻）・技／持ち物／特性／性格／能力ポイント・出典の文とリンク。
   たたむ（<details>、はじめは閉じる）＝出典の名前・取得した日時・集計期間／レギュレーション／対戦数（不明）・並び順と割合と能力ポイントの注意書き */
function cbddHTML(p,fmt,res){
  const fN=fmt==='double'?'ダブル':'シングル';
  const head=`<h3 class="cbdd-h">ランクバトルの集計（${fN}）</h3>`;
  if(res.st==='loading')return `<div class="cbdd" data-cbdd="loading" role="status" aria-live="polite">${head}<p class="cbdd-st"><span class="cbdd-sp" aria-hidden="true"></span>読み込んでいます…</p></div>`;
  if(res.st==='err')return `<div class="cbdd" data-cbdd="err" role="alert">${head}<p class="cbdd-st">集計を読み込めませんでした（前に読めたデータは表示しません）。<button class="cbdd-retry" data-cbdd-retry>もう一度読み込む</button></p>${cbdAttrHTML()}</div>`;
  if(res.st==='noid')return `<div class="cbdd" data-cbdd="noid">${head}<p class="cbdd-st">このポケモンは、提供元の名前との対応がないため、集計を表示できません。</p></div>`;
  if(res.st==='none')return `<div class="cbdd" data-cbdd="none">${head}<p class="cbdd-st">${esc(p.n)}の${fN}の集計は、提供元にありませんでした。</p>${cbdAttrHTML()}</div>`;
  const d=res.d,at=res.at;
  const pc=v=>v==null?'<i class="cbdd-pu">割合不明</i>':`<i>${v}%</i>`;
  const row=(t,a,f)=>a.length?`<div class="cbdd-r" data-cbdd-row="${t}"><b>${t}</b><ul>${a.map(x=>`<li><span>${f(x)}</span>${pc(x[x.length-1])}</li>`).join('')}</ul></div>`:'';
  const mv=x=>{const id=MVKA[nrm(x[0])];return id?`<a href="#/move/${id}">${esc(mName(id))}</a>`:esc(x[0])};
  const it=x=>{const k=nrm(x[0])==='leek'?'stick':nrm(x[0]);return ITEMN[k]?esc(ITEMN[k]):esc(x[0])};
  const ab=x=>{const k=ABK[nrm(x[0])];return esc(k&&ABN[k]?ABN[k]:x[0])};
  const nat=x=>{const u=CBDD_STAT[x[1].toLowerCase()],dn=CBDD_STAT[x[2].toLowerCase()];return u&&dn&&u!==dn?esc(natName(u,dn)):`${esc(x[0])}${!x[1]&&!x[2]?'（補正なし）':''}`};
  const sp=x=>x[0].map((v,i)=>v?`${SN[i]}${v}`:'').filter(Boolean).join('・')||'振りなし';
  const hm=`${cbddPad(at.getHours())}:${cbddPad(at.getMinutes())}`;
  const sum=[d.pos?`並び順 ${d.pos}位`:'',`${at.getMonth()+1}/${at.getDate()} ${hm}取得`].filter(Boolean).join(' · ');
  return `<div class="cbdd" data-cbdd="ok">${head}
    <p class="cbdd-sum" data-cbdd-at="${at.getTime()}">${sum}</p>
    <div class="cbdd-rows">${row('技',d.mv.slice(0,10),mv)}${row('持ち物',d.it.slice(0,10),it)}${row('特性',d.ab.slice(0,4),ab)}${row('性格',d.nat.slice(0,5),nat)}${row('能力ポイント',d.sp.slice(0,5),sp)}</div>
    ${cbdAttrHTML()}
    <details class="cbdd-more"><summary>データの見方・注意書き <span aria-hidden="true">▼</span></summary>
      <dl class="cbdd-meta"><div><dt>出典</dt><dd>Pokémon Champions Battle Data（非公式の集計。公式のデータではありません）</dd></div>
        <div><dt>取得した日時</dt><dd>${at.getFullYear()}/${at.getMonth()+1}/${at.getDate()} ${hm}</dd></div>
        <div><dt>集計期間</dt><dd>不明</dd></div><div><dt>レギュレーション</dt><dd>不明</dd></div><div><dt>対戦数</dt><dd>不明</dd></div></dl>
      <ul class="cbdd-notes">
        ${d.pos?'<li>表示している順位は提供元の並び順です。ポケモンの使用率を示すものではありません。</li>':''}
        <li>技・持ち物・特性などの割合は、それぞれの項目ごとの集計です。これらを組み合わせた「1つの型」の使用率ではありません。</li>
        ${d.sp.length?'<li>能力ポイントの表示は提供元のデータ項目をもとにしています。項目の正確な意味や集計方法は確認できていないため、参考情報としてご覧ください。</li>':''}
        <li>集計期間・レギュレーション・対戦数は提供元のデータに書かれていないため「不明」としています。取得した日時から推し量っていません。</li>
      </ul></details></div>`;
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
