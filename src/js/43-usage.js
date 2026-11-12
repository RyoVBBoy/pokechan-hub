/* ===================== 当サイトの使用率（worker/src/usage.js の集計を読む） =====================
   選出画面の読み取り・対戦の記録で見た相手の6匹と、利用者が保存した育成から集計したもの。
   流行の画面に「当サイトの集計」、ポケモンの解説に「当サイトの利用者の育成」と、それをもとにした型を出す */
const USAGE={single:null,double:null,st:{}};
function usageGet(fmt,cb){
  if(USAGE[fmt]||USAGE.st[fmt])return;
  const c=lsGet('pcusage_'+fmt,6*36e5);if(c){USAGE[fmt]=c;return}
  if(typeof COMM_API==='undefined'||!COMM_API||/^file:/.test(location.href))return;
  USAGE.st[fmt]='loading';
  fetch(COMM_API+'/api/usage?fmt='+fmt).then(r=>r.ok?r.json():null).then(d=>{if(d&&d.fmt){USAGE[fmt]=d;lsSet('pcusage_'+fmt,d);cb&&cb()}}).catch(()=>{}).finally(()=>{USAGE.st[fmt]='done'});
}
/* 解説で使う：そのポケモンの育成の集計（5件以上のときだけ） */
const usageBuildOf=(no,fmt)=>{const d=USAGE[fmt];const b=d&&d.builds&&d.builds[no];return b&&b.n>=5?b:null};
/* 集計から型を1つ組む（いちばん多い持ち物・特性・技4つ・性格・能力ポイント） */
function usageSet(p,b){
  const ls=LSD[p.no]?LSD[p.no][1]:[];
  const abs=(ABD[p.no]||[]).map(a=>a[0]),ab=(b.ab.find(([k])=>abs.includes(k))||[])[0]||null;
  const it=(b.it.find(([k])=>ITEMN[k])||[])[0]||null;
  const mv=b.mv.map(x=>x[0]).filter(id=>(id===182||ls.includes(id))&&(MV[id]||MD[id])).slice(0,4);
  const nat=b.nat[0]?b.nat[0][0].split('-').map(Number):[-1,-1];
  const sp=b.sp[0]?b.sp[0][0].split('-').map(Number):null;
  if(mv.length<2||!sp)return null;
  return{title:'当サイトでよく使われている型',why:`当サイトの利用者の育成${b.n}件で、それぞれいちばん多い持ち物・特性・技・性格・能力ポイントを組み合わせたものです。`,ab,item:it,up:nat[0],dn:nat[1],sp,moves:mv,k:/^choice|lifeorb|focussash|expertbelt/.test(it||'')?'attacker':it==='leftovers'?'bulky':'attacker',usage:true};
}
function usageGuideHTML(p,fmt,lk){
  const b=usageBuildOf(p.no,fmt);if(!b)return '';
  const row=(t,a,f)=>a.length?`<div class="gus"><b>${t}</b><div>${a.map(([k,v])=>`<span>${f(k)} <i>${v}%</i></span>`).join('')}</div></div>`:'';
  return `<div class="sec"><h2>当サイトの利用者の育成</h2><span style="font-size:12px;color:var(--dim)">${fmt==='double'?'ダブル':'シングル'}・${b.n}件</span></div>
    <div class="gdoc" style="padding-top:0">${row('持ち物',b.it,k=>`<a href="${lk('#/item/'+k)}" style="color:var(--acc)">${esc(ITEMN[k]||k)}</a>`)}${row('特性',b.ab,k=>esc(ABN[k]||k))}${row('技',b.mv.slice(0,8),id=>`<a href="${lk('#/move/'+id)}" style="color:var(--acc)">${esc(mName(id))}</a>`)}${row('性格',b.nat,k=>{const [u,d]=k.split('-').map(Number);return esc(natName(u,d)||'—')})}</div>
    <p class="note" style="padding-top:0;color:var(--mute)">ログインした利用者が保存したパーティ・上位パーティの登録・対戦の記録から集計しています（だれの育成かは出しません）。</p>`;
}
function usageMetaHTML(){
  const d=USAGE[FMT];
  if(!d)return '';
  const top=d.seen.slice(0,20);
  return `<div class="sec"><h2>当サイトの集計</h2><span style="font-size:13px;color:var(--dim)">直近${d.days}日・選出画面${d.previews}件</span></div>
    ${top.length&&d.previews>=20?top.map((x,i)=>byNo[x[0]]?`<a class="row" href="#/p/${x[0]}"><span class="rk">${i+1}</span><span class="av">${stamp(byNo[x[0]])}</span><div class="row-m"><div class="row-t">${byNo[x[0]].n}</div><div class="row-s">相手の選出画面の ${x[2]}% に登場</div></div><span class="chev">${SVG(I.chev,18)}</span></a>`:'').join('')
      :`<div class="bnote" style="margin:8px 16px">まだ数が少ないため、集計中です。選出アシストの「スクショから読む」や「対戦の振り返り」を使うと、相手のポケモンがこの集計に入ります（だれが見たかは出しません）。</div>`}`;
}
/* ===================== アクセス解析（worker/src/hits.js） =====================
   画面が開かれるたびに「どの画面か」だけを送る。クッキー・利用者の番号は使わない。
   その訪問の最初の画面のときだけ、スマホ/PC と、どこから来たか（検索・SNS・直接・その他）も送る */
function hitSend(k){
  try{
    if(navigator.webdriver||/^file:|\/\/(localhost|127\.)/.test(location.href)||k==='admin'||typeof COMM_API==='undefined'||!COMM_API)return;
    const b={k:String(k||'').toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,24)};
    let first=false;try{first=!sessionStorage.getItem('pcvis');sessionStorage.setItem('pcvis','1')}catch(e){}
    if(first){b.v=1;b.d=matchMedia('(min-width:700px)').matches?'pc':'sp';
      let h='';try{h=document.referrer?new URL(document.referrer).hostname:''}catch(e){}
      b.r=!h||h===location.hostname?'direct':/google\.|yahoo\.|bing\.|duckduckgo\.|ecosia\./.test(h)?'search':/(^|\.)(x|twitter|t|youtube|discord|line|instagram|tiktok|facebook|reddit)\.(com|co|me|gg)$/.test(h)?'social':'other'}
    navigator.sendBeacon(COMM_API+'/api/hit',new Blob([JSON.stringify(b)],{type:'text/plain'}));
  }catch(e){}
}
/* 管理画面の「アクセス」タブ */
const HIT_NAMES={home:'ホーム（タイムライン）',search:'検索',dex:'図鑑の一覧',p:'図鑑（ポケモンごと）',tools:'ツール',team:'パーティ',edit:'育成の編集',community:'コミュニティ',tl:'タイムライン',n:'投稿',u:'プロフィール',notif:'お知らせ',account:'アカウント',
  move:'技のページ',ability:'特性のページ',item:'道具のページ',word:'用語のページ',arch:'構築の型のページ',lobby:'対戦募集（旧）',bbs:'掲示板（旧）',thread:'掲示板のスレッド（旧）',terms:'利用規約',privacy:'プライバシーポリシー',rules:'利用ルール'};
/* ===================== 機能の操作の回数（2026/11/12 依頼主「開いただけでなく、実際に使われたか」） =====================
   決めた種類（EV_KEYS、サーバーの worker/src/hits.js の HIT_EV と同じ）だけを、日付ごとの回数としてサーバーに数えてもらう（{e:'種類'} だけを送る）。
   ポケモン・検索語・パーティ・画像などの中身は送らない。利用者を見分ける番号も使わない。
   evCount(種類, sig)：sig を渡すと、このタブで同じ sig は1回だけ数える（描き直し・同じ結果の出し直しで二重に数えない。sig は端末の中だけで使い、送らない）。
   テスト・file:// ・自分の端末では送らない（EV_LOG に残すだけ＝テストで数を確かめる） */
const EV_KEYS=['calc_done','dex_find','diag_done','diag_ng','assist_done','oppread_ok','oppread_ng','import_ok','import_ng','replay_start','replay_ok','replay_ng','pair_done','kd_done','tier_ok','tier_nolive'];
const EV_SEEN=new Set(),EV_LOG=[];
function evCount(k,sig){
  try{
    if(!EV_KEYS.includes(k))return false;
    if(sig!==undefined){const id=k+'|'+sig;if(EV_SEEN.has(id))return false;EV_SEEN.add(id)}
    EV_LOG.push(k);
    if(navigator.webdriver||/^file:|\/\/(localhost|127\.)/.test(location.href)||typeof COMM_API==='undefined'||!COMM_API||keyOf(cur)==='admin')return true;
    navigator.sendBeacon(COMM_API+'/api/hit',new Blob([JSON.stringify({e:k})],{type:'text/plain'}));
    return true;
  }catch(e){return false}
}
/* ===================== 管理画面の「アクセス」タブ（2026/11/12 作りかえ） =====================
   ・期間（7・30・90日、日本時間の日付）で、すべての数・グラフ・順位を切りかえる。前の同じ長さの期間と比べる（記録が足りるときだけ）。
   ・「訪問」はブラウザのタブを開いてから閉じるまでを1回（同じ人でも別のタブ・別の日は別に数える）。人数ではない。
   ・スマホ/PC と来た場所は、訪問の最初の表示だけで数える。
   ・操作は記録を始めた日（evStart）より前は「未計測」。0回とは分ける。操作を数えていない機能は「未計測（表示回数だけ）」 */
const ADH_OPS=[
  {id:'calc',t:'ダメージ計算',page:'calc',ok:'calc_done',okL:'条件を変えて計算した'},
  {id:'dex',t:'図鑑の検索・絞り込み',page:'dex',ok:'dex_find',okL:'検索・絞り込みを使った（1回の表示で1回）'},
  {id:'diag',t:'パーティの診断',page:'team',ok:'diag_done',okL:'診断を出した（同じパーティ・同じデータは1回）',ng:'diag_ng',ngL:'データを読めず診断できなかった'},
  {id:'assist',t:'選出アシスト',page:'assist',ok:'assist_done',okL:'相手6匹そろって計算した'},
  {id:'oppread',t:'選出画面のスクショ読み取り',page:'assist',ok:'oppread_ok',okL:'読み取れた',ng:'oppread_ng',ngL:'読み取れなかった（回数切れ・通信を含む）'},
  {id:'import',t:'画像から取り込む',page:'import',ok:'import_ok',okL:'読み取れた',ng:'import_ng',ngL:'読み取れなかった'},
  {id:'replay',t:'対戦の振り返り',page:'replay',start:'replay_start',ok:'replay_ok',okL:'動画を読み取れた',ng:'replay_ng',ngL:'読み取れなかった'},
  {id:'pair',t:'相性のいい仲間',page:'pair',ok:'pair_done',okL:'おすすめを出した（同じパーティは1回）'},
  {id:'kd',t:'こだわり条件で組む',page:'pair',ok:'kd_done',okL:'条件で組んだ'},
  {id:'tier',t:'強いポケモンランキング',page:'tier',ok:'tier_ok',okL:'集計ありで出した',ng:'tier_nolive',ngL:'集計が読めず代わりの表示'},
];
/* 操作を数えていないツール（表示回数だけ見られる） */
const ADH_UNTRACKED=['types','meta','season','memo','pip','learn','cmp','battle','share','edit'];
/* 画面のまとまり（まとまりごとの合計と、中の画面1つずつ） */
const ADH_GROUPS=[['ホーム・交流',['home','tl','n','u','notif','search','messages','bookmarks','requests','community','news','lobby','bbs']],
  ['ツール',['tools','calc','assist','pip','tier','meta','season','replay','types','memo','battle','cmp']],
  ['パーティ',['team','edit','import','share','pair','kodawari']],
  ['図鑑・攻略',['dex','p','learn','item','move','ability','word','arch','guide']],
  ['アカウント・案内',['account','help','contact','terms','privacy','sources','verify','games']]];
/* HIT_NAMES にない画面の名前（アクセスの表だけで使う） */
Object.assign(HIT_NAMES,Object.fromEntries(Object.entries({messages:'メッセージ',bookmarks:'ブックマーク',requests:'フォローのリクエスト',news:'公式のお知らせ',battle:'模擬戦（旧）',share:'共有されたパーティ',pair:'相性のいい仲間',kodawari:'こだわり条件（旧アドレス）',guide:'攻略ガイド（旧アドレス）',help:'ツールの使い方',contact:'お問い合わせ',sources:'データの出典',verify:'データの確認',games:'ゲームの切りかえ'}).filter(([k])=>!HIT_NAMES[k])));
let ADH_DAYS=(()=>{try{const v=+sessionStorage.getItem('pcadmhd');return [7,30,90].includes(v)?v:30}catch(e){return 30}})();
async function hitsDash(el,aget){
  const draw=async()=>{
    el.innerHTML=`${adhPeriodHTML()}<div id="adh-body" aria-live="polite"><p class="empty">読み込み中…（${ADH_DAYS}日間）</p></div>`;
    el.querySelectorAll('[data-adhd]').forEach(b=>b.onclick=()=>{ADH_DAYS=+b.dataset.adhd;try{sessionStorage.setItem('pcadmhd',ADH_DAYS)}catch(e){}draw()});
    const body=el.querySelector('#adh-body');let j;
    try{j=await aget('/api/admin/hits?days='+ADH_DAYS+'&cmp=1');if(!j||!Array.isArray(j.rows)||!j.from)throw new Error('アクセス解析のデータの形が正しくありません。')}
    catch(e){if(!body.isConnected)return;
      body.innerHTML=`<div class="adh-err" role="alert"><b>アクセス解析を読み込めませんでした</b><p>${esc(e.message||'通信できませんでした。')}<br>数は0ではなく「読めていない」状態です。</p><button class="btn btn-p" id="adh-retry">もう一度読み込む</button></div>`;
      body.querySelector('#adh-retry').onclick=draw;return}
    if(!body.isConnected)return;
    body.innerHTML=hitsHTML(j);
  };
  await draw();
}
const adhPeriodHTML=()=>`<div class="adh-per" role="group" aria-label="期間">${[7,30,90].map(d=>`<button class="pill" data-adhd="${d}" aria-pressed="${d===ADH_DAYS}">${d}日間</button>`).join('')}</div>`;
function hitsHTML(j){
  if(Array.isArray(j))j={rows:j,days:30};/* 前の呼び方（rows だけ）も受ける */
  const rows=j.rows||[],from=j.from,to=j.to,pfrom=j.pfrom,pto=j.pto;
  const dayList=(a,b)=>{const o=[];if(!a||!b)return o;for(let t=Date.parse(a+'T00:00:00Z');t<=Date.parse(b+'T00:00:00Z');t+=864e5)o.push(new Date(t).toISOString().slice(0,10));return o};
  const CUR=new Set(dayList(from,to)),PRV=new Set(dayList(pfrom,pto));
  const tot=(k,set)=>rows.reduce((a,r)=>a+((typeof k==='function'?k(r.k):r.k===k)&&set.has(r.day)?r.n:0),0);
  const isP=k=>k.startsWith('p:');
  const pvStart=j.pvStart||null,evStart=j.evStart||null;
  const cmpOK=!!pvStart&&pvStart<=pfrom,cmpEV=!!evStart&&evStart<=pfrom;
  const n=v=>v.toLocaleString('ja-JP');
  const delta=(c,p,ok)=>!ok?'<span class="adh-dl na" title="前の期間の記録が足りないので比べられません">比較なし</span>':p===0?(c?'<span class="adh-dl up">新規</span>':'<span class="adh-dl">±0</span>'):(()=>{const d=Math.round((c-p)/p*100);return `<span class="adh-dl ${d>0?'up':d<0?'dn':''}" title="前の${j.days}日間：${n(p)}">${d>0?'+':''}${d}%</span>`})();
  const md=d=>`${+d.slice(5,7)}/${+d.slice(8)}`;
  const tl=typeof toolsOf==='function'?toolsOf(curGame()):[],name=k=>HIT_NAMES[k]||((tl.find(t=>t.href==='#/'+k)||{}).t)||k;
  /* 数 */
  const visit=tot('_visit',CUR),view=tot(isP,CUR),sp=tot('d:sp',CUR),pc=tot('d:pc',CUR);
  const pkeys=new Set([...ADH_GROUPS.flatMap(g=>g[1]),...rows.filter(r=>isP(r.k)).map(r=>r.k.slice(2))]);
  const pages=[...pkeys].map(k=>({k,c:tot('p:'+k,CUR),p:tot('p:'+k,PRV)}));
  const topPage=[...pages].sort((a,b)=>b.c-a.c)[0];
  const evIn=!!evStart&&evStart<=to;
  const ops=ADH_OPS.map(o=>({...o,c:tot('e:'+o.ok,CUR),p:tot('e:'+o.ok,PRV),cng:o.ng?tot('e:'+o.ng,CUR):null,cst:o.start?tot('e:'+o.start,CUR):null}));
  const topOp=evIn?[...ops].sort((a,b)=>b.c-a.c)[0]:null;
  const nodata=!rows.some(r=>CUR.has(r.day)&&(isP(r.k)||r.k==='_visit'));
  /* 1日ごと（1つのグラフに1つの数。軸は1本） */
  const days=[...CUR].sort();
  const series=(f)=>days.map(d=>rows.reduce((a,r)=>a+(r.day===d&&f(r.k)?r.n:0),0));
  const OPOK=new Set(ADH_OPS.map(o=>'e:'+o.ok));
  const chart=(title,vals,opt={})=>{const mx=Math.max(1,...vals),W=days.length,bw=100/W,sum=vals.reduce((a,b)=>a+b,0);
    const bars=vals.map((v,i)=>{const off=opt.before&&days[i]<opt.before;const h=v?Math.max(1.5,v/mx*44):0;
      return `<g class="adh-b${off?' off':''}"><rect x="${(i*bw).toFixed(2)}" y="0" width="${bw.toFixed(2)}" height="48" fill="transparent"><title>${md(days[i])}：${off?'未計測':n(v)+'回'}</title></rect>${h?`<rect x="${(i*bw+bw*.12).toFixed(2)}" y="${(48-h).toFixed(2)}" width="${(bw*.76).toFixed(2)}" height="${h.toFixed(2)}" rx="${Math.min(.9,bw*.2).toFixed(2)}" class="adh-bar"/>`:''}</g>`}).join('');
    return `<figure class="adh-ch"><figcaption><b>${title}</b><span>計 ${n(sum)}・1日の最大 ${n(Math.max(0,...vals))}</span></figcaption>
      <svg viewBox="0 0 100 50" preserveAspectRatio="none" role="img" aria-label="${title}の1日ごとの回数（${md(days[0])}〜${md(days[W-1])}）"><line x1="0" y1="48.5" x2="100" y2="48.5" class="adh-base"/>${bars}</svg>
      <div class="adh-ax"><span>${md(days[0])}</span>${opt.note?`<span class="adh-axn">${opt.note}</span>`:''}<span>${md(days[W-1])}</span></div></figure>`};
  const pct=(a,t)=>t?Math.round(a/t*100):0;
  const split=(lab,pre)=>{const t=Object.keys(lab).reduce((a,k)=>a+tot(pre+k,CUR),0);
    return t?Object.entries(lab).map(([k,l])=>{const v=tot(pre+k,CUR);return `<div class="adh-sr"><span class="adh-sl">${l}</span><span class="adh-sb"><i style="width:${pct(v,t)}%"></i></span><b>${pct(v,t)}%</b><small>${n(v)}</small></div>`}).join('')
      :'<p class="adh-na">この期間の記録はありません。</p>'};
  const grpOf=k=>(ADH_GROUPS.find(g=>g[1].includes(k))||['そのほか'])[0];
  const groups=[...ADH_GROUPS.map(g=>g[0]),'そのほか'].map(g=>{const ps=pages.filter(x=>grpOf(x.k)===g).sort((a,b)=>b.c-a.c||a.k.localeCompare(b.k));return{g,ps,c:ps.reduce((a,x)=>a+x.c,0),p:ps.reduce((a,x)=>a+x.p,0)}}).filter(x=>x.ps.length);
  const pmx=Math.max(1,...pages.map(x=>x.c));
  return `<p class="adh-range">${from.replace(/-/g,'/')}〜${to.replace(/-/g,'/')}（日本時間・${j.days}日間）${cmpOK?`<span>比較：前の${j.days}日間（${md(pfrom)}〜${md(pto)}）</span>`:''}</p>
  ${pvStart&&pvStart>from?`<p class="adh-note">表示回数の記録は${md(pvStart)}からです。それより前の日は0ではなく記録がありません。</p>`:''}
  ${nodata?'<div class="adh-err adh-empty"><b>この期間の記録はありません</b><p>読み込みはできましたが、この期間に数えた表示がありません（0回と記録なしの区別はできません）。</p></div>':''}
  <section class="adh-sum" aria-label="概要">
    <div class="adh-k"><span>訪問（タブ単位）</span><b>${n(visit)}</b>${delta(visit,tot('_visit',PRV),cmpOK)}</div>
    <div class="adh-k"><span>表示回数（合計）</span><b>${n(view)}</b>${delta(view,tot(isP,PRV),cmpOK)}</div>
    <div class="adh-k"><span>スマホの訪問</span><b>${n(sp)}</b><small>${pct(sp,sp+pc)}%</small></div>
    <div class="adh-k"><span>PCの訪問</span><b>${n(pc)}</b><small>${pct(pc,sp+pc)}%</small></div>
    <div class="adh-k adh-kw"><span>いちばん見られた画面</span><b class="adh-kt">${topPage&&topPage.c?esc(name(topPage.k)):'—'}</b><small>${topPage&&topPage.c?n(topPage.c)+'回':'記録なし'}</small></div>
    <div class="adh-k adh-kw"><span>いちばん使われた機能（操作）</span><b class="adh-kt">${!evIn?'未計測':topOp&&topOp.c?esc(topOp.t):'—'}</b><small>${!evIn?'操作の記録はまだありません':topOp&&topOp.c?n(topOp.c)+'回':'この期間は0回'}</small></div>
  </section>
  <p class="adh-note">「訪問」はブラウザのタブを開いてから閉じるまでを1回として数えています（同じ人でも別のタブ・別の日は別の訪問）。人数ではありません。クッキー・IPアドレス・利用者の番号は使っていません。</p>
  <div class="sec"><h2>1日ごとの動き</h2></div>
  <div class="adh-chs">${chart('訪問',series(k=>k==='_visit'))}${chart('表示回数',series(isP))}${chart('機能の操作（成功）',series(k=>OPOK.has(k)),{before:evStart||'9999',note:!evStart?'操作の記録はまだありません':evStart>from?`${md(evStart)}から記録`:''})}</div>
  <div class="sec"><h2>機能の操作</h2><span class="adh-h">開いた回数ではなく、実際に使われた回数</span></div>
  ${!evIn?'<p class="adh-note">操作の記録はまだありません（この版を公開した日から数え始めます）。下の表の「—」は0回ではなく「未計測」です。</p>':evStart>from?`<p class="adh-note">操作の記録は${md(evStart)}から始めました。それより前の日は未計測です。</p>`:''}
  <div class="adh-tw"><table class="adh-t"><thead><tr><th>機能</th><th class="num">成功</th><th class="num">失敗</th><th class="num">前の期間比</th></tr></thead><tbody>
  ${[...ops].sort((a,b)=>evIn?b.c-a.c||a.t.localeCompare(b.t,'ja'):0).map(o=>`<tr><td><b>${esc(o.t)}</b><small>${esc(o.okL)}${o.ng?`／失敗＝${esc(o.ngL)}`:''}${o.start&&evIn?`／試した回数 ${n(o.cst)}`:''}</small></td>
    <td class="num">${evIn?n(o.c):'—'}</td><td class="num">${o.ng?(evIn?n(o.cng):'—'):'<span class="adh-na" title="失敗を数えていない機能">対象外</span>'}</td><td class="num">${evIn?delta(o.c,o.p,cmpEV):'—'}</td></tr>`).join('')}
  </tbody></table></div>
  <details class="adh-un"><summary>操作を数えていない機能（表示回数だけ）</summary><div class="adh-tw"><table class="adh-t"><tbody>${ADH_UNTRACKED.map(k=>`<tr><td>${esc(name(k))}<small>未計測（表示回数だけ）</small></td><td class="num">${n(tot('p:'+k,CUR))}回表示</td></tr>`).join('')}</tbody></table></div></details>
  <div class="sec"><h2>画面ごとの表示回数</h2><span class="adh-h">まとまりを押すと画面ごと</span></div>
  ${groups.map((x,gi)=>`<details class="adh-g"${gi===0?' open':''}><summary><span class="adh-gn">${esc(x.g)}</span><b>${n(x.c)}</b>${delta(x.c,x.p,cmpOK)}</summary>
    <div class="adh-tw"><table class="adh-t"><tbody>${x.ps.map(p=>`<tr${p.c?'':' class="adh-zero"'}><td>${esc(name(p.k))}</td><td class="adh-bc"><span class="adh-sb"><i style="width:${pct(p.c,pmx)}%"></i></span></td><td class="num">${n(p.c)}</td><td class="num">${delta(p.c,p.p,cmpOK)}</td></tr>`).join('')}</tbody></table></div></details>`).join('')}
  <div class="sec"><h2>スマホとPC・来た場所</h2></div>
  <p class="adh-note">どちらも、訪問の<b>最初の表示だけ</b>で数えています（そのあと開いた画面は数えません）。</p>
  <div class="adh-split"><div><h3>端末</h3>${split({sp:'スマホ',pc:'PC'},'d:')}</div><div><h3>来た場所</h3>${split({search:'検索',social:'SNS',direct:'直接・ブックマーク',other:'ほかのサイト'},'r:')}</div></div>`;
}
