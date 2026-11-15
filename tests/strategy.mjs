/* このパーティの戦い方（2026/11/15 78-strategy.js）：チェックタブの最初に 戦い方→強み→選出→流れ、その下に気をつけたい相手・場面、くわしい分析はたたむ。
   判定は前のまま（dgTeam・dgSelect・selPlan）。型をつくらない・選出はいつも最適とは言わない・メガは1匹ずつ・メガなしは別に計算 */
import {chromium} from 'playwright';
import {fileURLToPath} from 'url';import path from 'path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
let fail=0;const ok=(c,m)=>{if(c)console.log('  ok',m.slice(0,150));else{fail++;console.log('  NG',m)}};
const SC={
  rain:{fmt:'single',m:[['ペリッパー',null,'drizzle'],['イダイトウ',null,'swift-swim'],['ガブリアス'],['ハッサム'],['アシレーヌ'],['サーフゴー']]},
  plain:{fmt:'single',m:[['ガブリアス'],['サーフゴー'],['アーマーガア'],['アシレーヌ'],['ウインディ'],['カイリュー']]},
  two:{fmt:'single',m:[['ピカチュウ'],['フシギバナ']]},
  double:{fmt:'double',m:[['ガブリアス'],['サーフゴー'],['アーマーガア'],['アシレーヌ'],['ウインディ'],['カイリュー']]},
  mega:{fmt:'single',m:[['リザードン','charizarditey'],['ガブリアス','garchompite'],['ルカリオ','lucarionite'],['カビゴン'],['ゲンガー'],['アシレーヌ']]},
};
for(const [k,S] of Object.entries(SC)){
  console.log('--',k);
  const ctx=await b.newContext({locale:'ja-JP',viewport:{width:390,height:844},colorScheme:'dark'});const pg=await ctx.newPage();
  const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(/^https?:/,r=>r.abort());await pg.goto('file://'+root+'/dist/index.html');await pg.waitForTimeout(600);
  await pg.evaluate(S=>{FMT=S.fmt;try{localStorage.setItem('pcfmt',S.fmt)}catch(e){}const N=s=>P.find(x=>x.n===s).no;team.length=0;
    S.m.forEach(([n,it,ab])=>team.push({no:N(n),sel:false,...(it||ab?{set:{it:it?{k:it,n:ITEMN[it]}:null,mv:[],sp:null,up:-1,dn:-1,ab:ab||null}}:{})}));saveTeam();TTAB='check';location.hash='#/team'},S);
  await pg.waitForFunction(()=>document.querySelector('#st-box .dgu-head'),null,{timeout:60000});
  const R=await pg.evaluate(()=>{const st=document.getElementById('st-box'),t=st.textContent,hs=[...st.querySelectorAll('h3')].map(h=>h.textContent);
    const T=dgTeam(team,20),A=teamArch(team),S=dgSelect(team),adv=document.getElementById('dg-adv');
    return{hs,t,arch:A.map(a=>a.k),archShown:[...st.querySelectorAll('.stg-arch .tarch-b')].length,
      strengths:st.querySelectorAll('.stg-gl>li').length,how:[...st.querySelectorAll('.stg-gl>li')].every(li=>li.querySelector('.stg-gh')&&/<b>|[ァ-ヶー]{2,}/.test(li.querySelector('.stg-gt').innerHTML)),
      sel:S&&S.best?S.best.c.map(i=>byNo[team[i].no].n):null,selShown:[...st.querySelectorAll('.stg-sel li>b')].map(b=>b.textContent),
      firstTop:st.compareDocumentPosition(document.getElementById('dgu-sum')||st)&Node.DOCUMENT_POSITION_FOLLOWING,
      advClosed:!!adv&&!adv.open&&!!adv.querySelector('#dg-box')&&(team.length<3||!!adv.querySelector('#imp-box')),
      mega:T.mega&&T.mega.holders?T.mega.holders.length:0,megaBar:!!st.querySelector('.dgm-bar'),noMega:!!st.querySelector('#stg-nomega'),
      over:document.body.scrollWidth>innerWidth+1}});
  ok(!errs.length,'エラーなし '+errs.join(' / '));
  ok(R.hs[0]==='戦い方の型'&&R.hs[1]==='パーティの強み'&&R.hs[2]==='おすすめの選出と先発','順番：戦い方→強み→選出 '+R.hs.join('・'));
  ok(R.firstTop,'戦い方が「気をつけたい相手・場面」より上');
  ok(R.advClosed,'くわしい分析（相手ごとの対応力・改善案）はたたんで残す');
  ok(R.archShown===R.arch.length,'戦い方の型は teamArch のものだけ（作らない） '+R.arch.join(','));
  if(!R.arch.length)ok(/まだはっきりした型/.test(R.t),'型が決まらないときは、まだはっきりしないと書く');
  ok(R.strengths<=3&&R.how,'強みは3つまで・ポケモンの名前と使い方つき '+R.strengths);
  if(R.sel){ok(R.sel.length===R.selShown.length&&R.sel.every(n=>R.selShown.includes(n)),'選出は dgSelect の1番 '+R.selShown.join('・'));
    ok(/いつも最適とは限らない/.test(R.t)&&/基本の選出/.test(R.t),'選出は「基本の選出・いつも最適とは限らない」と書く');
    ok(R.hs.includes('戦い方の流れ（目安）')&&/必ずこの通りになるわけではありません/.test(R.t),'流れは目安と書く')}
  else ok(/より多くポケモンを入れてください/.test(R.t),'選出できないときは案内');
  if(k==='double')ok(/範囲技・味方のサポート/.test(R.t)&&/簡易比較/.test(R.t),'ダブルは計算の限界を書く');
  if(k==='rain'){ok(R.arch.includes('rain')&&/イダイトウが得をする/.test(R.t),'雨：作る役と得をする仲間の名前');
    ok(!R.sel.includes('ペリッパー')?/雨を作るペリッパーが入っていません/.test(R.t):true,'雨を作る役が選出にいなければ、そう書く')}
  if(k==='mega'){ok(R.mega>=2&&R.megaBar&&R.noMega,'メガ2匹以上：どのメガで計算したかと切りかえ・メガなしの比較');
    await pg.evaluate(()=>{const d=document.getElementById('stg-nomega');d.open=true});
    await pg.waitForFunction(()=>document.querySelector('#stg-nomega .stg-nmt'),null,{timeout:30000});
    const M=await pg.evaluate(()=>{const T=dgTeam(team,20),a=dgMetric(T),rows=[...document.querySelectorAll('#stg-nomega tbody tr')].map(tr=>[...tr.children].map(c=>c.textContent));
      return{rows,st:+rows[0][1].replace('匹',''),a:a.st,same:dgTeam(team,20)===T}});
    ok(M.st===M.a,'メガありの数は上の計算と同じ '+JSON.stringify(M.rows));
    ok(M.same,'メガなしを計算しても上の結果（キャッシュ）は変わらない')}
  /* くり返しても同じ */
  const again=await pg.evaluate(async()=>{const tx=()=>{const c=document.getElementById('st-box').cloneNode(true);c.querySelectorAll('#stg-nomega').forEach(e=>e.remove());return c.textContent};const a=tx();teamRender();await new Promise(r=>setTimeout(r,2500));return a===tx()});
  ok(again,'描き直しても同じ結果');
  ok(!R.over,'390pxではみ出さない');
  if(k==='plain'){
    /* 移動：優先ポイントから、たたんだ中の弱点のカードへ（開く） */
    const J=await pg.evaluate(async()=>{const a=document.querySelector('#dgu-sum [data-dgu-go]');if(!a)return 'none';a.click();await new Promise(r=>setTimeout(r,300));return document.getElementById('dg-adv').open});
    ok(J==='none'||J===true,'たたんだ中へ移動するときは開く '+J);
    const C=await pg.evaluate(async()=>{const b=document.querySelector('[data-stg-sel]');if(!b)return 'done';b.click();await new Promise(r=>setTimeout(r,800));const S=dgSelect(team);return S.best.c.every(i=>team[i].sel)&&team.filter(x=>x.sel).length===S.best.c.length});
    ok(C==='done'||C===true,'「この組み合わせを選出にする」で選出が変わる '+C)}
  await ctx.close();
}
/* 自分の言葉で書く・投稿（2026/11/15 依頼主）：自動の文が下書きに入る・保存すると上に出る・変えていない項目は保存しない・計算は変わらない・投稿の文は140字まで・画像のカード・投稿欄に入る */
{
  const ctx=await b.newContext({locale:'ja-JP',viewport:{width:390,height:844},colorScheme:'dark'});const pg=await ctx.newPage();
  const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(/^https?:/,r=>r.abort());await pg.goto('file://'+root+'/dist/index.html');await pg.waitForTimeout(600);
  await pg.evaluate(()=>{FMT='single';const N=s=>P.find(x=>x.n===s).no;const mv=k=>({id:+Object.keys(MD).find(i=>MD[i][3]===k)});team.length=0;
    team.push({no:N('ペリッパー'),sel:false,set:{it:null,mv:[mv('hurricane'),mv('uturn')].filter(m=>m.id),sp:null,up:-1,dn:-1,ab:{k:'drizzle',n:ABN.drizzle}}});
    team.push({no:N('イダイトウ'),sel:false,set:{it:null,mv:[],sp:null,up:-1,dn:-1,ab:{k:'swift-swim',n:ABN['swift-swim']}}});
    team.push({no:N('サーフゴー'),sel:false,set:{it:null,mv:[mv('reflect')],sp:null,up:-1,dn:-1,ab:null}});
    ['ガブリアス','ハッサム','アシレーヌ'].forEach(n=>team.push({no:N(n),sel:false}));saveTeam();TTAB='check';location.hash='#/team'});
  await pg.waitForFunction(()=>document.querySelector('#st-box .dgu-head'),null,{timeout:60000});
  const sel0=await pg.evaluate(()=>JSON.stringify(dgSelect(team).best.c));
  await pg.click('[data-stg-edit]');await pg.waitForTimeout(300);
  const pressed=()=>pg.evaluate(()=>[...document.querySelectorAll('[data-stp][aria-pressed="true"]')].map(b=>b.dataset.stp).join());
  const F=await pg.evaluate(()=>({cats:[...document.querySelectorAll('.stg-cat legend')].map(l=>l.textContent),n:document.querySelectorAll('[data-stp]').length,P:[...document.querySelectorAll('[data-stp][aria-pressed="true"]')].map(b=>b.dataset.stp),
    autoTag:[...document.querySelectorAll('[data-stp] .stg-auto')].map(x=>x.parentNode.dataset.stp),style:document.getElementById('stg-style').value,str:document.getElementById('stg-str').value,plan:!!document.getElementById('stg-plan'),
    auto:ST_LAST.auto,ev:document.getElementById('stg-ev').innerText,name:!document.getElementById('stg-otherf').hidden,miss:document.querySelector('.stg-miss')?.textContent||'',st:document.getElementById('stg-st-style').textContent}));
  ok(F.cats.join('|')==='天気・フィールド|素早さの操作・展開|構築の方針|そのほか'&&F.n===15,'型は3つの分類＋そのほか（15こ） n='+F.n);
  ok(F.P.join()===F.auto.tp&&F.P.includes('rain')&&F.autoTag.join()===F.auto.tp,'自動で見つけた型だけが選ばれていて「自動」の札 '+F.P.join());
  ok(F.style===F.auto.style&&/^序盤：ペリッパーを早めに出して雨にする/.test(F.style)&&/中盤：雨のあいだにイダイトウで攻め/.test(F.style)&&/終盤：/.test(F.style),'戦い方＝実際の6匹の序盤・中盤・終盤 '+F.style.split('\n')[0]);
  ok(!/得をする仲間で攻める|天気を雨にして/.test(F.style),'戦い方は型の一般的な説明をつなげない');
  ok(F.str===F.auto.str&&!/序盤|中盤|終盤/.test(F.str)&&!/ペリッパーのあめふらしで雨になり/.test(F.str),'強みは戦い方をくり返さない '+F.str.split('\n')[0]);
  ok(!F.plan,'「戦い方の流れ」は戦い方に入るので、前に書いていなければ欄を出さない');
  ok(/「雨」確認済み/.test(F.ev)&&/ペリッパーのあめふらし（登録済み）/.test(F.ev)&&/得をする仲間：イダイトウ/.test(F.ev),'登録した特性は確認済み '+F.ev.replace(/\n/g,' '));
  ok(/^未登録：技（/.test(F.miss)&&/特性（/.test(F.miss)&&/持ち物（/.test(F.miss),'判定に効く未登録の情報を1行で '+F.miss);
  ok(F.name&&F.st==='自動の下書き','名前の欄はいつも出る（型とは別）・下書きの印');
  const UN=await pg.evaluate(()=>{const N=s=>P.find(x=>x.n===s).no;return stConf('rain',[{no:N('ペリッパー')},{no:N('イダイトウ')}],[])});
  ok(UN.lv==='un'&&/未登録/.test(UN.t)&&/実際に使うとは限りません/.test(UN.t),'特性を登録していなければ「未確認」 '+UN.t);
  /* 技を4つ登録していれば、覚えられるだけの技は「未確認」に数えない */
  const FULL=await pg.evaluate(()=>{const N=s=>P.find(x=>x.n===s).no,mv=k=>({id:+Object.keys(MD).find(i=>MD[i][3]===k)});
    return stConf('scr',[{no:N('ハッサム'),set:{mv:['bulletpunch','uturn','swordsdance','closecombat'].map(mv),ab:{k:'technician'}}},{no:N('サーフゴー')}],[])});
  ok(!/ハッサム/.test(FULL.t),'技を4つ登録したポケモンは、覚えられるだけでは候補にしない '+FULL.t);
  /* 雨＋壁展開 */
  await pg.click('[data-stp="scr"]');
  const G=await pg.evaluate(()=>({ev:document.getElementById('stg-ev').innerText,style:document.getElementById('stg-style').value,main:document.querySelectorAll('[data-stmain]').length,sum:document.getElementById('stg-sum').innerText}));
  ok(/「壁展開」一部未確認/.test(G.ev)&&/サーフゴーのリフレクター（登録済み）/.test(G.ev)&&/ハッサム・アシレーヌは技が未登録です/.test(G.ev),'一部だけ登録 → 一部未確認と、未登録のポケモン '+G.ev.replace(/\n/g,' '));
  ok(/壁展開：サーフゴーで壁を張り/.test(G.style)&&/^序盤：ペリッパー/.test(G.style),'サブの型は確かめられた役のポケモンで1行');
  ok(G.main===2&&/メイン雨/.test(G.sum)&&/サブ壁展開/.test(G.sum),'メイン・サブを分けて表示 '+G.sum.replace(/\n/g,' '));
  await pg.click('[data-stmain="scr"]');
  const H=await pg.evaluate(()=>({first:document.getElementById('stg-style').value.split('\n')[0],chk:document.querySelector('[data-stmain][aria-checked="true"]').dataset.stmain}));
  ok(/^序盤：サーフゴーで壁を張り/.test(H.first)&&H.chk==='scr','メインを変えると序盤が変わる '+H.first);
  await pg.click('[data-stmain="rain"]');
  /* 未確認の型は流れに入れず、その旨を書く */
  await pg.click('[data-stp="tailwind"]');
  const TW=await pg.evaluate(()=>document.getElementById('stg-style').value);
  ok(/※おいかぜは技・特性が未登録のため、上の流れには入れていません/.test(TW)||!/おいかぜ/.test(TW.split('\n').slice(0,-1).join('')),'未確認・役のいない型は流れに入れない');
  await pg.click('[data-stp="tailwind"]');
  /* 明確な型なし はほかと同時に選ばない */
  await pg.click('[data-stp="none"]');const P1=await pressed();await pg.click('[data-stp="rain"]');const P2=await pressed();
  ok(P1==='none'&&P2==='rain','「明確な型なし」はほかと同時に選ばない '+P1+' / '+P2);
  await pg.click('[data-stp="scr"]');
  await pg.fill('#stg-arch','雨パ・スタンダード');
  ok(/名前雨パ・スタンダード/.test(await pg.evaluate(()=>document.getElementById('stg-sum').innerText)),'名前は型と別に表示');
  /* 自分で書いた戦い方は、型を変えても上書きしない・作り直すときは確かめる */
  await pg.fill('#stg-style','ペリッパーで雨にして、イダイトウで押し切る。');
  ok(await pg.evaluate(()=>document.getElementById('stg-st-style').textContent)==='あなたが書いた文','書きかえると「あなたが書いた文」');
  await pg.click('[data-stp="sun"]');await pg.click('[data-stp="sun"]');
  ok(await pg.evaluate(()=>document.getElementById('stg-style').value)==='ペリッパーで雨にして、イダイトウで押し切る。','型を変えても自分で書いた文は書きかえない');
  await pg.click('[data-st-r="style"]');await pg.waitForSelector('.xc.on .xc-no');await pg.click('.xc-no');await pg.waitForTimeout(250);
  ok(await pg.evaluate(()=>document.getElementById('stg-style').value)==='ペリッパーで雨にして、イダイトウで押し切る。','作り直しはキャンセルできる（黙って置きかえない）');
  await pg.click('[data-st-r="style"]');await pg.waitForSelector('.xc.on .xc-ok');await pg.click('.xc-ok');await pg.waitForTimeout(250);
  const RG=await pg.evaluate(()=>({v:document.getElementById('stg-style').value,st:document.getElementById('stg-st-style').textContent}));
  ok(/^序盤：ペリッパー/.test(RG.v)&&/壁展開：サーフゴー/.test(RG.v)&&RG.st==='自動の下書き','確かめてから、選んだ型で作り直す');
  await pg.fill('#stg-style','ペリッパーで雨にして、イダイトウで押し切る。');
  const ov=await pg.evaluate(()=>document.body.scrollWidth<=innerWidth+1&&[...document.querySelectorAll('#st-box [data-stp],#st-box .stg-cf,#st-box textarea')].every(b=>b.getBoundingClientRect().right<=innerWidth)&&[...document.querySelectorAll('#st-box textarea')].every(t=>t.getBoundingClientRect().height<=242));
  ok(ov,'390pxではみ出さない・入力欄は高くなりすぎない');
  await pg.click('#stg-save');await pg.waitForTimeout(600);
  const S=await pg.evaluate(()=>({own:document.querySelector('#st-box .stg-own')?.innerText||'',s:MEMO.party[mpKey()].s,sel:JSON.stringify(dgSelect(team).best.c),auto:!!document.querySelector('#st-box .stg-autol'),
    txt:stPostText(stPostData())}));
  ok(/名前\s*雨パ・スタンダード/.test(S.own)&&/メイン\s*雨/.test(S.own)&&/サブ\s*壁展開/.test(S.own)&&/イダイトウで押し切る/.test(S.own),'保存すると名前・メイン・サブ・戦い方を分けて表示 '+S.own.slice(0,80).replace(/\n/g,' '));
  ok(S.s.tp==='rain,scr'&&S.s.arch==='雨パ・スタンダード'&&S.s.style&&!S.s.str&&!S.s.plan,'型（メインが先）・名前・書いた戦い方を保存、変えていない強みは保存しない '+JSON.stringify(S.s));
  ok(/雨パ・スタンダード（メイン：雨・サブ：壁展開）/.test(S.txt),'投稿の文：名前（メイン・サブ） '+S.txt.split('\n')[0]);
  /* 開き直すと選び方・名前・書いた文が残っている */
  await pg.click('[data-stg-edit]');await pg.waitForTimeout(300);
  const R2=await pg.evaluate(()=>({P:[...document.querySelectorAll('[data-stp][aria-pressed="true"]')].map(b=>b.dataset.stp).join(),main:document.querySelector('[data-stmain][aria-checked="true"]')?.dataset.stmain,name:document.getElementById('stg-arch').value,style:document.getElementById('stg-style').value,st:document.getElementById('stg-st-style').textContent}));
  ok(R2.P.split(',').sort().join()==='rain,scr'&&R2.main==='rain'&&R2.name==='雨パ・スタンダード'&&R2.style==='ペリッパーで雨にして、イダイトウで押し切る。'&&R2.st==='あなたが書いた文','開き直しても型・メイン・名前・書いた文が残る '+JSON.stringify(R2));
  /* 開き直したあと型を変えても、保存した文は書きかえない */
  await pg.click('[data-stp="tr"]');ok(await pg.evaluate(()=>document.getElementById('stg-style').value)==='ペリッパーで雨にして、イダイトウで押し切る。','保存した文は、型を変えても書きかえない');
  await pg.click('#stg-cancel');await pg.waitForTimeout(300);
  ok(S.auto,'自動の診断も下に残る');
  ok(S.sel===sel0,'書いても計算（選出）は変わらない');
  ok([...S.txt].length<=140&&/#パーティ紹介/.test(S.txt)&&!/https?:/.test(S.txt),'投稿の文は140字まで・リンクなし '+[...S.txt].length);
  const long=await pg.evaluate(()=>{const d=stPostData();d.style='あ'.repeat(300);return [...stPostText(d)].length});
  ok(long<=140,'長い文でも140字に収める '+long);
  const card=await pg.evaluate(async()=>{const bl=await strategyCard(stPostData());if(!bl)return null;const im=await createImageBitmap(bl);return [im.width,im.height,bl.type]});
  ok(card&&card[0]===1200&&card[1]>400&&card[2]==='image/png','投稿用の画像のカード '+JSON.stringify(card));
  const C=await pg.evaluate(async()=>{TWC_PRE={text:'てすと',blobs:[await strategyCard(stPostData())]};const c=twComposer({h:'me',n:'me'},()=>{});const d=document.createElement('div');d.innerHTML=c.html;document.body.appendChild(d);c.bind();
    for(let i=0;i<40&&!document.querySelector('#twc-pv .twc-th');i++)await new Promise(r=>setTimeout(r,100));const r={t:document.getElementById('twc-t').value,th:document.querySelectorAll('#twc-pv .twc-th').length,on:!document.getElementById('twc-b').disabled,left:TWC_PRE};d.remove();return r});
  ok(C.t==='てすと'&&C.th===1&&C.on&&C.left===null,'投稿欄に文と画像が入る（1回だけ） '+JSON.stringify(C));
  /* パーティの戦術メモを保存しても、書いた戦い方は消えない */
  await pg.evaluate(()=>{location.hash='#/memo/party'});await pg.waitForTimeout(800);await pg.click('#mp-save');await pg.waitForTimeout(300);
  const K=await pg.evaluate(()=>MEMO.party[mpKey()].s);ok(K.tp==='rain,scr'&&K.arch==='雨パ・スタンダード'&&K.style,'戦術メモを保存しても書いた戦い方（型・名前も）は残る');
  await pg.evaluate(()=>{location.hash='#/team'});await pg.waitForFunction(()=>document.querySelector('#st-box .stg-own'),null,{timeout:60000});
  await pg.click('[data-stg-edit]');await pg.waitForTimeout(300);
  /* 何も選ばずに保存はできない（自動の型があるとき） */
  for(const id of ['rain','scr'])await pg.click(`[data-stp="${id}"]`);
  await pg.click('#stg-save');await pg.waitForTimeout(300);
  const E=await pg.evaluate(()=>({still:!!document.getElementById('stg-tpbox'),s:MEMO.party[mpKey()].s.tp}));
  ok(E.still&&E.s==='rain,scr','型を全部外すと保存しない（明確な型なしを選ぶよう知らせる）');
  await pg.click('[data-stp="rain"]');
  await pg.evaluate(()=>{document.getElementById('stg-style').value=ST_LAST.auto.style;document.getElementById('stg-arch').value=''});await pg.click('#stg-save');await pg.waitForTimeout(500);
  const Z=await pg.evaluate(()=>({own:!!document.querySelector('#st-box .stg-own'),s:MEMO.party[mpKey()].s}));
  ok(!Z.own&&!Z.s.tp&&!Z.s.arch&&!Z.s.style,'自動の型と文に戻して保存すると、書いた戦い方はなくなる '+JSON.stringify(Z.s));
  /* 自動で型が見つからないパーティ：何も選ばれていない */
  await pg.evaluate(()=>{const N=s=>P.find(x=>x.n===s).no;team.length=0;team.push({no:N('ピカチュウ'),sel:false},{no:N('フシギバナ'),sel:false});saveTeam();teamRender()});
  await pg.waitForFunction(()=>document.querySelector('#st-box [data-stg-edit]'),null,{timeout:60000});await pg.click('[data-stg-edit]');await pg.waitForTimeout(300);
  const NA=await pg.evaluate(()=>({P:document.querySelectorAll('[data-stp][aria-pressed="true"]').length,t:document.getElementById('stg-tpbox').textContent,style:document.getElementById('stg-style').value}));
  ok(NA.P===0&&/自動では型を決められませんでした/.test(NA.t)&&NA.style==='','根拠がないときは型を選ばない・決めつけない');
  await pg.setViewportSize({width:1280,height:900});await pg.waitForTimeout(300);
  const ovP=await pg.evaluate(()=>document.body.scrollWidth<=innerWidth+1&&[...document.querySelectorAll('#st-box [data-stp]')].every(b=>{const r=b.getBoundingClientRect(),c=document.getElementById('st-box').getBoundingClientRect();return r.right<=c.right+1}));
  ok(ovP,'1280pxでも型のボタンが枠に収まる');
  ok(!errs.length,'エラーなし '+errs.join(' / '));
  await ctx.close();
}

await b.close();
if(fail){console.log(`strategy: ${fail} NG`);process.exit(1)}console.log('strategy: all ok');
