/* ===================== 出典・確認状況 ===================== */
const LV={official:['公式','#1d9bf0','公式サイト・公式発表で確認したもの'],ingame:['ゲーム内で確認','#00ba7c','実際のゲーム画面で値を確かめたもの'],multi:['複数の出典で一致','#7856ff','互いに独立した出典で同じ値だったもの'],single:['出典1つ','#8b98a5','1か所の出典（またはそれをもとにしたデータ）だけのもの'],unverified:['未確認・推定','#ff7a00','まとめ記事の情報や、このサイトの計算による目安']};
const SRC={
 stats:{name:'種族値・タイプ',lv:'single',date:'2026/10/18',per:['t','s'],src:[['PokeTools（Champions図鑑）',null],['PokeAPI','https://pokeapi.co/']],
  note:'208匹すべてで2つの値が一致しましたが、PokeToolsはPokeAPIのデータをもとにしているため、独立した確認にはなりません。Champions独自の調整があっても反映されていない可能性があります。'},
 learn:{name:'覚える技・特性',lv:'multi',date:'2026/10/28',per:['a','m'],src:[['Pokémon Showdown（Champions用データ）','https://github.com/smogon/pokemon-showdown'],['PokeAPI（日本語名）','https://pokeapi.co/']],
  note:'Pokémon ShowdownのChampions用の習得技リスト（変化技を含む全技）と、収録ポケモン264匹の一覧を使っています。技の性能はゲーム内で書き写した510技と照らし合わせ、504技が一致しました（PPなどが違った5技はゲーム内の値を採用）。効果の説明は当サイトがデータからまとめた文章です。'},
 movedata:{name:'技のタイプ・分類・威力・命中・PP',lv:'ingame',date:'2026/10/19',src:[['ゲーム内の技の説明（510技を書き写し）',null],['PokeAPI（510技に含まれない技のみ）','https://pokeapi.co/']],
  note:'ゲーム画面から書き写した510技の値を使っています。本編シリーズ（PokeAPI）と比べると、威力・命中・タイプが違う技が約20個（例：きりさく 70→80、スターアサルト 150→170、トラバサミ くさ→はがね）、PPは412技で違いました。書き写しの際の入力ミスがあれば、見つけしだい直します。'},
 typechart:{name:'タイプ相性',lv:'single',date:'2026/10/18',src:[['本編シリーズの相性表（第6世代以降・フェアリーを含む）',null]],
  note:'長く変わっていない仕様ですが、Championsで独自の変更がないかは確認していません。'},
 formula:{name:'Lv50の計算式・能力ポイントの上限',lv:'ingame',date:'2026/10/19',src:[['ゲームのチーム画面（6匹分のステータス）',null],['第三者のまとめ記事',null]],
  note:'HP＝種族値＋ポイント＋75、ほか＝（種族値＋ポイント＋20）×性格補正（1.1倍・0.9倍、端数切り捨て）、合計66・1項目32まで。ゲームのステータス画面の6匹・36の数値すべてで、この式と一致しました。'},
 regulation:{name:'レギュレーションの期間',lv:'unverified',date:'2026/10/18',src:[['第三者のまとめ記事',null]],
  note:'M-A（4月8日〜）、M-B（6月17日〜）、M-C（9月9日〜）。公式の発表では確認していません。'},
 ladder:{name:'ラダー集計（よく使われる型・一緒に使われるポケモン）',lv:'single',date:'',src:[['Pokémon Champions Battle Data（非公式）','https://championsbattledata.com/']],
  note:'非公式の集計サイトのデータを、表示のたびに取得しています。集計の方法は公開されていません。現行レギュレーション（M-C）のデータです。'},
 calc:{name:'このサイトの計算（役割・診断・選出・模擬戦）',lv:'unverified',date:'',src:[['このサイト独自の計算式',null]],
  note:'役割タグのしきい値、パーティ診断の点数、選出アシストの評価、模擬戦の簡易ダメージ計算は、このサイトで決めた式による目安です。'}
};
const SRC_LOG=[['2026/10/21','図鑑の670番の名前を「フラベベ」から正しい「フラエッテ」に修正（ゲーム画面との照合で発見）'],['2026/10/19','技のタイプ・威力・命中・PPを、ゲーム内の説明から書き写した510技の値に更新（ゲーム内で確認）'],['2026/10/19','ゲーム画面で計算式と5匹（リザードン・カイリュー・アーマーガア・ガブリアス・ブリムオン）の種族値・タイプを確認'],['2026/10/19','スクリーンショットからのパーティ取り込みを追加（読み取り：Tesseract.js）'],['2026/10/28','特性216種類すべてに効果の説明を追加。けたぐり・ジャイロボール・ふんか・たたりめ・はたきおとす・ちきゅうなげ・ソーラービーム・はかいこうせん・ふいうちなど78技を計算に追加（計算画面に残りHP・状態異常・技の条件の入力を追加。模擬戦はため・反動・失敗の条件も再現）'],['2026/10/28','覚える技を全技（変化技を含む）に拡大し、図鑑に「技・特性」タブを追加。技ごとに威力・命中・PP・優先度・性質と効果の説明を表示。収録ポケモンを264匹に見直し（ペルシアン（アローラ）・ケンタロス（パルデア）・ロトムの全フォルムなど29匹を追加）。育成で変化技も選べるように'],['2026/10/27','メガシンカに対応（82種類・メガガブリアスZなどの新しいメガも含む）。メガストーンを持たせると、計算・相手予想・模擬戦でメガシンカ後の姿になります。ボディプレス・からげんきと、かたいツメ・スカイスキンなどメガシンカの特性を計算に追加'],['2026/10/27','実際の対戦で使われている30匹（ゴリランダー・グソクムシャ・ボーマンダ・リージョンフォームなど）を図鑑に追加。ダメージ計算を本編と同じ端数処理に変更'],['2026/10/18','種族値・タイプ（208匹）、タイプ相性、計算式を掲載'],['2026/10/19','覚える技・特性、技の威力・命中をPokeAPIから追加'],['2026/10/19','ラダー集計（Pokémon Champions Battle Data）の取得に対応'],['2026/10/19','出典バッジと確認状況の表示を追加']];
/* ゲーム内で確認した結果。書き出したデータをここに反映すると、全員に表示されます */
const VERIFIED_BAKED={6:{t:1,s:1,d:'2026-10-19'},149:{t:1,s:1,d:'2026-10-19'},823:{t:1,s:1,d:'2026-10-19'},445:{t:1,s:1,d:'2026-10-19'},858:{t:1,s:1,d:'2026-10-19'}};
const getVer=()=>{try{return JSON.parse(localStorage.getItem('pcverify')||'{}')}catch(e){return{}}};
const setVer=v=>{try{localStorage.setItem('pcverify',JSON.stringify(v))}catch(e){}};
const verOf=no=>({...(VERIFIED_BAKED[no]||{}),...(getVer()[no]||{})});
function lvOf(id,no){
  const d=SRC[id];let lv=d.lv,bad=false;
  if(no&&d.per){const v=verOf(no);if(d.per.some(k=>v[k]===0))bad=true;else if(d.per.every(k=>v[k]===1))lv='ingame'}
  return{lv,bad};
}
const srcDate=id=>id==='ladder'?(LIVE.at?`${LIVE.at.getMonth()+1}/${LIVE.at.getDate()}`:''):(SRC[id].date||'').replace(/^\d{4}\//,'');
function srcBadge(id,no){
  const{lv,bad}=lvOf(id,no),[lab,c]=bad?['ゲーム内の値と違う','#f4212e']:LV[lv],dt=srcDate(id);
  return `<button class="srcb" data-src="${id}"${no?` data-no="${no}"`:''} style="--c:${c}" aria-label="${SRC[id].name}の出典：${lab}"><i></i>${lab}${dt?`<span>・${dt}</span>`:''}</button>`;
}
const srcLine=(...ids)=>`<div class="srcline">${ids.map(x=>Array.isArray(x)?srcBadge(x[0],x[1]):srcBadge(x)).join('')}</div>`;
function srcInfoHTML(id,no){
  const d=SRC[id],{lv,bad}=lvOf(id,no);
  return `<div style="padding:4px 16px 12px"><div style="font-size:13px;color:var(--dim)">${no?byNo[no].n+'の':''}データ</div><h3 style="margin:2px 0 10px;font-size:20px;font-weight:800;line-height:1.35">${d.name}</h3>${srcBadge(id,no)}</div>
  <div class="sinfo">
    <div><span>確認状況</span><b>${bad?'ゲーム内の値と違うという確認結果があります。修正前の値を表示しています。':LV[lv][0]+'：'+LV[lv][2]}</b></div>
    <div><span>出典</span><b>${d.src.map(([n,u])=>u?`<a href="${u}" target="_blank" rel="noopener">${n}</a>`:n).join('<br>')}</b></div>
    <div><span>取得日</span><b>${id==='ladder'?(LIVE.at?LIVE.at.toLocaleString('ja-JP'):'まだ取得していません'):id==='calc'?'—':d.date}</b></div>
    <div><span>注意点</span><b style="font-weight:400;color:var(--dim)">${d.note}</b></div>
  </div>
  <p class="note">誤りに気づいたら、X（準備中）で教えてください。</p>
  <div class="btns"><a class="btn btn-s" href="#/sources">すべてのデータの出典を見る</a></div>`;
}
function openInfo(id,no){
  lastFocus=document.activeElement;
  document.getElementById('sheet-t').textContent='データの出典';
  sheet.hidden=false;sheetOpen=true;document.body.style.overflow='hidden';
  sbody.innerHTML=srcInfoHTML(id,no);sbody.scrollTop=0;
}
document.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('[data-src]');if(!b)return;
  e.preventDefault();e.stopPropagation();openInfo(b.dataset.src,b.dataset.no?+b.dataset.no:null);
},true);
const verCount=keys=>P.filter(p=>{const v=verOf(p.no);return keys.every(k=>v[k]===1)}).length;
const badCount=()=>P.filter(p=>{const v=verOf(p.no);return['t','s','a','m'].some(k=>v[k]===0)}).length;
function sourcesView(){
  setHeader('データの出典','#/guide');
  const cs=verCount(['t','s']),cm=verCount(['a','m']),bd=badCount();
  V.innerHTML=`<p class="note" style="padding-top:14px">このサイトの数値が、どこから来ていて、どこまで確かめられているかの一覧です。<b>公式で確認できたデータは、まだありません。</b>確認が進んだものから段階を上げていきます。</p>
  <div class="sec"><h2>確認の段階</h2></div>
  ${Object.entries(LV).map(([k,[l,c,d]])=>`<div class="row" style="content-visibility:visible"><span class="srcdot" style="background:${c}"></span><div class="row-m"><div class="row-t">${l}</div><div class="row-s">${d}</div></div></div>`).join('')}
  <div class="sec"><h2>データごとの状況</h2></div>
  ${Object.entries(SRC).map(([id,d])=>`<button class="row srow" data-src="${id}"><div class="row-m"><div class="row-t">${d.name}</div><div class="row-s">${d.src.map(x=>x[0]).join('、')}</div></div>${srcBadge(id)}</button>`).join('')}
  <div class="sec"><h2>ゲーム内での確認</h2></div>
  <div class="vprog"><div><span>種族値・タイプ</span><b>${cs}<small> / ${P.length}匹</small></b></div><div class="bar"><i style="width:${cs/P.length*100}%;background:#00ba7c"></i></div></div>
  <div class="vprog"><div><span>覚える技・特性</span><b>${cm}<small> / ${P.length}匹</small></b></div><div class="bar"><i style="width:${cm/P.length*100}%;background:#00ba7c"></i></div></div>
  ${bd?`<p class="note" style="color:#f59aa1">${bd}匹で、ゲーム内の値と違うという確認結果があります。</p>`:''}
  <a class="row" href="#/verify" style="border-top:1px solid var(--line)"><div class="row-m"><div class="row-t">確認用の画面（運営者向け）</div><div class="row-s">ゲームの画面と見比べて、一致・違うを記録します</div></div><span class="chev">${SVG(I.chev,18)}</span></a>
  <div class="sec"><h2>誤りの報告</h2></div>
  <p class="note" style="padding-top:0">X での受け付けを準備しています。</p>
  <div class="sec"><h2>更新履歴</h2></div>
  ${[...SRC_LOG].reverse().map(([d,t])=>`<div class="row" style="content-visibility:visible"><div class="row-m"><div class="row-s" style="font:600 12px Inter,sans-serif">${d}</div><div style="font-size:14px">${t}</div></div></div>`).join('')}`;
}

/* ---- 確認用の画面 ---- */
let vq='',vfil='todo',vsort='bst',vOpen=null;
const VF=[['t','タイプ'],['s','種族値'],['a','特性'],['m','覚える攻撃技']];
function verSet(no,k,val){const all=getVer();const v=all[no]||{};if(v[k]===val)delete v[k];else v[k]=val;v.d=new Date().toISOString().slice(0,10);all[no]=v;setVer(all)}
function verFix(no,k,val){const all=getVer();const v=all[no]||{};v.fix=v.fix||{};v.fix[k]=val;all[no]=v;setVer(all)}
function vItem(p){
  const v=verOf(p.no),st=VF.map(([k,l])=>`<span class="${v[k]===1?'ok':v[k]===0?'ng':''}">${l.slice(0,3)}</span>`).join('');
  const open=vOpen===p.no;
  let body='';
  if(open){
    const btn=k=>`<span><button class="vbtn ok" data-v="${k}" data-val="1" aria-pressed="${v[k]===1}">一致</button><button class="vbtn ng" data-v="${k}" data-val="0" aria-pressed="${v[k]===0}">違う</button></span>`;
    const fx=v.fix||{};
    const ab=(ABD[p.no]||[]).map(([k,h])=>`${ABN[k]||k}${h?'（隠れ特性）':''}`).join('、')||'データなし';
    const ls=LSD[p.no]?LSD[p.no][1].map(mName):[];
    body=`<div class="vbody">
      <div class="vf"><h4>タイプ${btn('t')}</h4><div class="chips" style="margin:0">${p.t.map(chip).join('')}</div>
        ${v.t===0?`<input class="vin vtx" data-fix="t" value="${fx.t||''}" placeholder="正しいタイプ（例：ドラゴン・じめん）">`:''}</div>
      <div class="vf"><h4>種族値${btn('s')}</h4>
        <div class="vstat">${p.s.map((x,i)=>`<div><em>${SN[i]}</em><b>${x}</b><small>${i?x+20:x+75}</small></div>`).join('')}</div>
        <p class="vcap">上段が種族値、下段がLv50・能力ポイント0・性格補正なしの実数値です。ゲームに出る数値の種類に合わせて見比べてください。</p>
        ${v.s===0?`<div class="vstat">${p.s.map((x,i)=>`<div><em>${SN[i]}</em><input class="vin" type="number" inputmode="numeric" data-fix="s" data-i="${i}" value="${fx.s?fx.s[i]:x}"></div>`).join('')}</div><p class="vcap">正しい<b>種族値</b>を入れてください。</p>`:''}</div>
      <div class="vf"><h4>特性${btn('a')}</h4><div style="font-size:14px">${ab}</div>
        ${v.a===0?`<input class="vin vtx" data-fix="a" value="${fx.a||''}" placeholder="正しい特性">`:''}</div>
      <div class="vf"><h4>覚える攻撃技 <small style="color:var(--dim);font-weight:500">${ls.length}個</small>${btn('m')}</h4>
        <details><summary style="cursor:pointer;color:var(--acc);font-size:13px">技の一覧を見る</summary><div style="font-size:13px;color:var(--dim);line-height:1.8;margin-top:6px">${ls.join('、')||'データなし'}</div></details>
        <p class="vcap">変化技（まもる以外）は収録していないので、ゲーム内の攻撃技とだけ見比べてください。</p>
        ${v.m===0?`<input class="vin vtx" data-fix="m" value="${fx.m||''}" placeholder="足りない技・余分な技">`:''}</div>
    </div>`;
  }
  return `<div class="vitem${open?' open':''}"><button class="vh" data-open="${p.no}"><span class="av" style="width:40px;height:40px">${stamp(p)}</span><div class="row-m"><div class="row-t">${nm(p)}<span class="no">#${String(p.dno).padStart(4,'0')}</span></div><div class="vst">${st}</div></div><span class="chev" style="transform:rotate(${open?90:0}deg);transition:transform .2s">${SVG(I.chev,18)}</span></button>${body}</div>`;
}
function vList(){
  const done=p=>{const v=verOf(p.no);return VF.every(([k])=>v[k]!==undefined)};
  const bad=p=>{const v=verOf(p.no);return VF.some(([k])=>v[k]===0)};
  let l=P.filter(p=>!vq||nmHit(p,vq));
  if(vfil==='todo')l=l.filter(p=>!done(p)||p.no===vOpen);else if(vfil==='bad')l=l.filter(p=>bad(p)||p.no===vOpen);
  l=[...l].sort(vsort==='bst'?(a,b)=>b.bst-a.bst||a.no-b.no:(a,b)=>a.no-b.no);
  const all=P.length,dn=P.filter(done).length;
  document.getElementById('vf-prog').innerHTML=`<div><span>確認した項目がそろったポケモン</span><b>${dn}<small> / ${all}匹</small></b></div><div class="bar"><i style="width:${dn/all*100}%;background:#00ba7c"></i></div>`;
  document.getElementById('vf-list').innerHTML=l.slice(0,60).map(vItem).join('')+(l.length>60?`<p class="note">ほか${l.length-60}匹。検索で絞り込めます。</p>`:'')+(l.length?'':'<p class="empty">該当するポケモンはいません。</p>');
}
function verifyView(){
  setHeader('ゲーム内で確認','#/sources');
  V.innerHTML=`<div id="vf-root"><p class="note" style="padding-top:14px">ゲームの画面と見比べて、合っていれば<b>一致</b>、違えば<b>違う</b>を押します（もう一度押すと取り消し）。結果はこの端末に保存されます。サイト全体に反映するときは、下の<b>書き出す</b>で出たデータを開発に渡してください。</p>
  <div class="vprog" id="vf-prog"></div>
  <div class="srch" style="margin-top:12px">${SVG(I.search,18)}<input id="vf-q" value="${vq}" placeholder="ポケモン名で検索" autocomplete="off"></div>
  <div class="pills"><button class="pill" data-fil="todo">未確認</button><button class="pill" data-fil="bad">違う報告あり</button><button class="pill" data-fil="all">すべて</button><span style="flex:none;width:8px"></span><button class="pill" data-sort="bst">合計種族値順</button><button class="pill" data-sort="no">図鑑順</button></div>
  <div id="vf-list"></div>
  <div class="sec"><h2>結果の書き出し・読み込み</h2></div>
  <div class="btns" style="flex-wrap:wrap"><button class="btn btn-p" id="vf-exp">${SVG(I.share,17)}書き出す（コピー）</button><button class="btn btn-s" id="vf-imp">読み込む</button></div>
  <textarea id="vf-ta" class="vta" placeholder="書き出したデータがここに出ます。読み込むときは、ここに貼り付けて「読み込む」を押します。"></textarea>
  <div class="btns"><button class="btn btn-s" id="vf-del" style="color:#f59aa1">この端末の確認結果をすべて消す</button></div></div>`;
  const root=document.getElementById('vf-root'),ta=document.getElementById('vf-ta');
  const syncP=()=>root.querySelectorAll('[data-fil]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.fil===vfil))||root.querySelectorAll('[data-sort]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.sort===vsort));
  syncP();vList();
  document.getElementById('vf-q').oninput=e=>{vq=e.target.value.trim();vList()};
  root.addEventListener('click',e=>{
    const o=e.target.closest('[data-open]');if(o){const n=+o.dataset.open;vOpen=vOpen===n?null:n;vList();return}
    const vb=e.target.closest('[data-v]');if(vb){verSet(vOpen,vb.dataset.v,+vb.dataset.val);vList();return}
    const f=e.target.closest('[data-fil]');if(f){vfil=f.dataset.fil;syncP();vList();return}
    const so=e.target.closest('[data-sort]');if(so){vsort=so.dataset.sort;syncP();vList();return}
    if(e.target.closest('#vf-exp')){const txt=JSON.stringify({site:'pc-hub',v:1,exported:new Date().toISOString(),items:getVer()});ta.value=txt;
      (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>toast('確認結果をコピーしました')).catch(()=>{ta.select();toast('下の欄からコピーしてください')});return}
    if(e.target.closest('#vf-imp')){try{const o=JSON.parse(ta.value);const items=o.items||o;const all=getVer();Object.entries(items).forEach(([k,v])=>{all[k]={...(all[k]||{}),...v}});setVer(all);toast('読み込みました');vList()}catch(err){toast('データの形式が正しくありません')}return}
    if(e.target.closest('#vf-del')){if(confirm('この端末に保存した確認結果をすべて消します。よろしいですか？')){setVer({});vList();toast('消しました')}}
  });
  root.addEventListener('change',e=>{
    const x=e.target.closest('[data-fix]');if(!x||vOpen==null)return;
    if(x.dataset.fix==='s'){const cur2=(verOf(vOpen).fix||{}).s||[...byNo[vOpen].s];cur2[+x.dataset.i]=+x.value;verFix(vOpen,'s',cur2)}
    else verFix(vOpen,x.dataset.fix,x.value);
    toast('修正内容を保存しました');
  });
}


