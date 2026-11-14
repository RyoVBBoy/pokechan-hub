// 1匹から組む（77-teambuild.js、docs/pokemon-team-building-audit.md）の確認（2026/11/14）
// ・上位パーティの通信（authFetch）は、テスト用に作った返事に差しかえる（実在のパーティではない）。ポケモンを選ぶ画面・確認の画面も差しかえる
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
let n=0,bad=0;const ok=(c,m)=>{n++;if(!c){bad++;console.error('NG',m)}};
const ctx=await b.newContext({locale:'ja-JP',viewport:{width:390,height:844}});
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.route(/^https?:/,r=>r.abort());
await pg.goto('file://'+path.join(ROOT,'dist/index.html'));await pg.waitForTimeout(600);
const wait=ms=>pg.waitForTimeout(ms);

/* ---- 準備：差しかえ ---- */
await pg.evaluate(()=>{
  window.N=s=>P.find(x=>x.n===s).no;
  window.__pick=[];pickMon=async()=>window.__pick.shift()||null;
  window.__conf=[];askConfirm=async o=>{window.__conf.push(o.title);if(window.__confSeq&&window.__confSeq.length)return window.__confSeq.shift();return window.__confAns!==undefined?window.__confAns:true};
  window.__fetch=[];
  /* テスト用の上位パーティ（作り物）：確認済み・記事から（出典つき）・本人の申告（育成なし・4匹）・図鑑に無い番号を含むもの */
  const G=N('ガブリアス'),T6=['ドドゲザン','ガオガエン','ゴリランダー','ブリジュラス','アシレーヌ'].map(N);
  authFetch=async u=>{window.__fetch.push(u);if(window.__fail)throw new Error('通信できません（テスト）');
    if(u==='/api/seasons')return{seasons:[{id:2,name:'テストシーズン2',n:3},{id:1,name:'テストシーズン1',n:1}]};
    const fmt=(u.match(/fmt=(\w+)/)||[])[1];
    if(/seasons\/2\/teams/.test(u))return{teams:fmt==='single'?[
      {id:11,rank:12,rate:2100,verified:true,team:[{no:G,set:{ab:{k:'roughskin'},it:{k:'focussash'},mv:[{id:89}],sp:[2,32,0,0,0,32],up:5,dn:3}},...T6.map(no=>({no}))]},
      {id:12,rank:3,rate:null,auto:true,sources:['https://example.com/a','https://example.org/b'],team:[{no:G},...T6.map(no=>({no}))]},
      {id:13,rank:null,rate:1900,team:[{no:G},{no:T6[0]},{no:T6[1]},{no:999999}]},
      {id:14,rank:1,rate:2200,verified:true,team:T6.map(no=>({no}))}]:[{id:21,rank:5,rate:1800,verified:true,team:[{no:G},...T6.map(no=>({no}))]}]};
    return{teams:[]}};
  localStorage.removeItem('pctb');team.length=0;
});

/* 下のメニューのボタン（.tb）の形：この画面の見た目の名前と重ならない（2026/11/14 依頼主の iPhone で、.tb の余白が下のメニューに付いて崩れた） */
const tbInBar=()=>pg.evaluate(()=>{const bar=document.querySelector('.tabbar');const bs=[...document.querySelectorAll('.tabbar .tb')];if(!bar||!bs.length)return 'メニューが無い';const R=bar.getBoundingClientRect();
  const bad=bs.filter(b=>{const r=b.getBoundingClientRect(),ic=b.querySelector('svg'),ir=ic&&ic.getBoundingClientRect();return r.top<R.top-1||r.bottom>R.bottom+1||!ir||ir.height<8||ir.top<R.top-1||ir.bottom>R.bottom+1});
  return bad.length?`はみ出したボタン${bad.length}個`:'ok'});
/* 確かめ方そのものの確かめ：前の崩れ（.tb の下の余白84px）を一時的に再現すると見つけられる */
const TBX=await pg.evaluate(()=>{const st=document.createElement('style');st.id='tbx-test';st.textContent='.tb{padding-bottom:84px}';document.head.appendChild(st);return 1});
const TBS_BAD=await tbInBar();await pg.evaluate(()=>document.getElementById('tbx-test').remove());
ok(TBS_BAD!=='ok','確かめ方：前の崩れを再現すると見つけられる '+TBS_BAD);
const TBS0=await tbInBar();ok(TBS0==='ok','はじめの画面で下のメニューのボタンが枠の中 '+TBS0);
/* ---- 1 最初の1匹・下書き ---- */
await pg.evaluate(()=>{location.hash='#/tb/'+N('ガブリアス')});await wait(2500);
const A=await pg.evaluate(()=>({mem:TB.mem.map(x=>x.no),start:TB.start,fmt:TB.fmt,team:team.length,tab:TB.tab,an:!!document.querySelector('#tb-an .mvp-weak'),sug:document.querySelectorAll('#tb-sug .tbd-c').length,
  over:document.body.scrollWidth>innerWidth+1}));
ok(A.mem.length===1&&A.mem[0]===A.start&&A.fmt==='single','最初の1匹が1枠目に入る');
ok(A.team===0,'保存したパーティは変えない');
const TBS1=await tbInBar();ok(TBS1==='ok','1匹から組むを開いても下のメニューのボタンが枠の中 '+TBS1);
ok(A.an&&A.sug>0,'分析と候補が出る '+A.sug);
ok(!A.over,'390px ではみ出さない');
/* メガの姿から始めても元の姿 */
const MB=await pg.evaluate(()=>{const m=MEGAP.find(x=>x.base===N('ガブリアス'));return tbBase(m.no)===N('ガブリアス')});ok(MB,'メガの姿から始めても元の姿で始める');

/* ---- 2 追加・同じ種類・6匹まで・外す・入れかえ・1つ前に戻す ---- */
const B=await pg.evaluate(async()=>{const r={};
  __pick.push(MEGAP.find(x=>x.base===N('ガブリアス')).no);await tbPickAdd(-1);r.dup=TB.mem.length===1;
  for(const s of ['ドドゲザン','ガオガエン','ゴリランダー','ブリジュラス','アシレーヌ']){__pick.push(N(s));await tbPickAdd(-1)}
  r.six=TB.mem.length===6;__pick.push(N('カイリュー'));await tbPickAdd(-1);r.max=TB.mem.length===6;
  const items=TB.mem.map(x=>x.set&&x.set.it&&x.set.it.k).filter(Boolean);r.noDupItem=new Set(items).size===items.length;
  r.src=TB.mem.slice(1).every(x=>x.src==='pokekit'||x.src==='none');
  __pick.push(N('カイリュー'));await tbPickAdd(2);r.rep=TB.mem[2].no===N('カイリュー')&&TB.mem.length===6;
  TB_HIST.length&&document.getElementById('tb-undo')&&document.getElementById('tb-undo').click();r.undo=TB.mem[2].no===N('ガオガエン');
  TB.mem.splice(5,1);tbSave();r.rm=TB.mem.length===5;
  r.saved=JSON.parse(localStorage.getItem('pctb')).mem.length===5;
  return r});
ok(B.dup,'同じ種類（メガの姿も）は入れない');
ok(B.six&&B.max,'6匹まで');
ok(B.noDupItem,'集計の型の持ち物が重ならない');
ok(B.src,'型の出典を持つ');
ok(B.rep&&B.undo,'入れかえと「1つ前に戻す」');
ok(B.rm&&B.saved,'外す・端末に覚える');

/* ---- 3 候補：入れたあとを計算し直す・説明 ---- */
await pg.evaluate(()=>tbDraw());await wait(3500);
const C=await pg.evaluate(()=>{const R=tbCands(TB.mem);const t=document.getElementById('tb-sug').textContent;
  return{st:R.st,all:R.res.every(c=>mvpLegal(c.r.no).st==='ok'&&(!c.r.stone||mvpStoneSt(c.r.stone,c.r.no)==='ok')&&!TB.mem.some(x=>tbFam(x.no)===tbFam(c.r.no))),
    real:R.res.every(c=>c.C.pairs.every(p=>p.fixed.every(w=>!p.b.weak.some(v=>v.key===w.key)))),
    order:R.res.every((c,i)=>!i||!(R.res[i-1].C.cm>0&&c.C.cm===0)),
    words:/なくなる大きな弱点|新しくできる弱点/.test(t)&&/Showdown/.test(t)&&!/必ず勝|最強/.test(t)}});
ok(C.st==='ok'&&C.all,'候補は使えると確認できた匹・確認できたメガストーンだけ・同じ種類なし');
ok(C.real,'候補で「なくなる」とした弱点は、入れたあとに本当に無い');
ok(C.order,'新しい大きな弱点を作る候補は後ろ');
ok(C.words,'候補の説明（解決する問題・新しい弱点・出典）');
/* 比べる */
await pg.evaluate(()=>{const b=document.querySelector('[data-tbvs="0"]');b&&b.click()});await wait(100);
await pg.evaluate(()=>{const b=document.querySelector('[data-tbvi="1"]');b&&b.click()});await wait(400);
const CM=await pg.evaluate(()=>{const o=document.querySelector('#tb-cmp0 .tbd-cmpr');return !!o&&/大きな弱点/.test(o.textContent)&&!!o.querySelector('[data-tbsw]')});
ok(CM,'いまの匹と比べる（入れかえたときの変化）');

/* ---- 4 ① 環境のパーティ：種類を分ける・形式を分ける・作らない ---- */
await pg.evaluate(()=>{document.querySelector('[data-tbtab="find"]').click()});await wait(1500);
const D=await pg.evaluate(()=>{const box=document.getElementById('tb-teams'),t=box.textContent,cards=[...box.querySelectorAll('.tbd-c')];
  return{n:cards.length,fmt:__fetch.filter(u=>/teams/.test(u)).every(u=>/fmt=single/.test(u)),
    cats:/確認済み/.test(t)&&/記事から集めた/.test(t)&&/本人の申告/.test(t),self:/レート1900（申告）/.test(t),
    noFake:!/勝率\s*[0-9０-９]/.test(t)&&!/勝率が?高い/.test(t),order:cards.map(c=>c.querySelector('.tbd-tt').textContent).join('|'),
    nostart:!t.includes('最終1位'),bad:!box.innerHTML.includes('999999'),
    src:box.innerHTML.includes('example.org')&&/rel="noopener nofollow"/.test(box.innerHTML),
    noSet:/育成の登録なし/.test(t),sets:/Showdown/.test(document.getElementById('tb-sets').textContent)&&/6匹のパーティではありません/.test(document.getElementById('tb-sets').textContent)}});
ok(D.n===3,'最初の1匹が入ったパーティだけ（入っていないパーティは出さない） '+D.n);
ok(D.nostart,'最初の1匹が入っていないパーティの順位を出さない');
ok(D.fmt,'いまの形式のパーティだけ読む');
ok(D.cats&&D.self,'出典の種類（確認済み・記事から集めた・本人の申告）を分ける');
ok(D.noFake,'勝率を出さない');
ok(D.bad,'図鑑に無い番号は出さない');
ok(D.src,'記事の出典のリンク（nofollow）');
ok(D.noSet,'育成が無いときは「育成の登録なし」');
ok(D.sets,'集計の型は Showdown の集計と明記・仲間は6匹のパーティではないと明記');
ok(/^確認済み/.test(D.order.split('|')[0])||/テストシーズン2/.test(D.order.split('|')[0]),'並びは新しいシーズン→順位 '+D.order);
/* 絞り込み */
await pg.evaluate(()=>document.querySelector('[data-tbcat="auto"]').click());await wait(200);
const DF=await pg.evaluate(()=>document.querySelectorAll('#tb-teams .tbd-c').length);ok(DF===1,'出典の種類で絞り込む '+DF);
await pg.evaluate(()=>document.querySelector('[data-tbcat="all"]').click());await wait(200);
/* ③で開く・パーティに入れる */
await pg.evaluate(async()=>{__confAns=true;document.querySelector('[data-tbopen="0"]').click()});await wait(800);
const DO=await pg.evaluate(()=>({tab:TB.tab,n:TB.mem.length,first:TB.mem[0].no===TB.start,src:TB.mem.every(x=>x.set?x.src==='team':x.src==='teamnoset')&&TB.mem.some(x=>x.src==='teamnoset'),hist:TB_HIST.length>0}));
ok(DO.tab==='manual'&&DO.n===6&&DO.first&&DO.src&&DO.hist,'上位パーティを③の下書きに開く（最初の1匹は1枠目、戻せる）');
/* 読めないとき */
await pg.evaluate(()=>{__fail=true;TB_FIND=null;TB.tab='find';tbDraw()});await wait(600);
const DE=await pg.evaluate(()=>/読み込めませんでした/.test(document.getElementById('tb-teams').textContent)&&!!document.getElementById('tb-fr')&&/集計の型/.test(document.getElementById('tb-sets').textContent));
ok(DE,'読めないときは理由ともう一度読むボタン、集計の型は使える');
await pg.evaluate(()=>{__fail=false;TB_FIND=null});

/* ---- 5 ダブルを分ける ---- */
const DB=await pg.evaluate(async()=>{setFmt('double');tbDraw();const w=!!document.querySelector('.tbd-fmtw');
  const hs=tbSetsHTML('double'),ss=tbSetsHTML('single');
  const dRow=mvpRows('double').rows.find(r=>r.no===TB.start&&!r.stone),sRow=mvpRows('single').rows.find(r=>r.no===TB.start&&!r.stone);
  document.querySelector('[data-tbfmt="keep"]').click();await new Promise(r=>setTimeout(r,1200));
  const t=document.getElementById('tb-teams')?document.getElementById('tb-teams').textContent:'';
  const r={warn:w,keep:TB.fmt==='double',dmeta:/ダブル/.test(hs)&&/シングル/.test(ss)&&!/ダブル・2026/.test(ss),tmDiff:JSON.stringify(dRow.tm)!==JSON.stringify(sRow.tm),
    dblNote:!!document.querySelector('#tb-body .mvp-dbl'),dteams:/テストシーズン2/.test(t)&&__fetch.some(u=>/fmt=double/.test(u))};
  setFmt('single');TB.fmt='single';tbSave();return r});
ok(DB.warn&&DB.keep,'形式が違うと知らせ、黙って切りかえない');
ok(DB.dmeta&&DB.tmDiff,'シングルとダブルの集計を混ぜない');
ok(DB.dblNote,'ダブルで見ていないことを書く');
ok(DB.dteams,'ダブルの上位パーティはダブルで読む');

/* ---- 6 ② こだわり条件 ---- */
const E=await pg.evaluate(()=>{const r={};const c=TB.cond;
  /* 矛盾 */
  const viv=P.find(p=>mvpLegal(p.no).st==='unverified');
  TB.cond={must:[viv.no],ng:[],mega:'auto',type:'auto'};r.illegal=tbCondCheck(TB.cond).some(e=>/未確認/.test(e));
  TB.cond={must:[N('ドドゲザン')],ng:[N('ドドゲザン')],mega:'auto',type:'auto'};r.both=tbCondCheck(TB.cond).some(e=>/両方/.test(e));
  TB.cond={must:[N('リザードン')],ng:[],mega:'must:'+N('リザードン'),type:'auto'};r.stone=tbCondCheck(TB.cond).some(e=>/確認できていません/.test(e));
  TB.cond={must:[],ng:[],mega:'must:'+N('ドドゲザン'),type:'auto'};r.notIn=tbCondCheck(TB.cond).length>0;
  /* 組めるとき：入れたい匹・入れたくない匹・メガ（ルカリオZは確認済み） */
  TB.cond={must:[N('ルカリオ')],ng:[N('ミミッキュ'),N('メタグロス')],mega:'must:'+N('ルカリオ'),type:'rain'};
  const keepTeam=JSON.stringify(team),keepKD=JSON.stringify([KD.type,KD.ng,KD.mega]);
  r.err=tbCondCheck(TB.cond);const A=tbPropPref(),B=tbPropComp();
  r.restore=JSON.stringify(team)===keepTeam&&JSON.stringify([KD.type,KD.ng,KD.mega])===keepKD;
  const chk=X=>{const st=X.mem.filter(x=>x.set&&x.set.it&&isStone(x.set.it.k));const V2=tbValidate(X.mem);const its=X.mem.map(x=>x.set&&x.set.it&&x.set.it.k).filter(Boolean);
    return{req:X.req.every(q=>q.ok),ng:!X.mem.some(x=>[N('ミミッキュ'),N('メタグロス')].includes(tbFam(x.no))),mega:st.length===1&&st[0].no===N('ルカリオ')&&mvpStoneSt(st[0].set.it.k,st[0].no)==='ok',
      legal:X.mem.every(x=>mvpLegal(x.no).st==='ok'),clean:!V2.notes.length,items:new Set(its).size===its.length,
      sp:X.mem.every(x=>!x.set||!x.set.sp||(x.set.sp.reduce((a,b)=>a+b,0)<=66&&x.set.sp.every(v=>v<=32))),scen:X.E.scen.length===2&&X.E.scen.some(s=>s.key==='none'&&!s.megaIdx.length)&&X.E.scen.every(s=>s.megaIdx.length<=1),six:X.mem.length===6}};
  r.A=chk(A);r.B=chk(B);r.kinds=A.kind!==B.kind&&A.mem.every(x=>x.src==='theory')&&B.mem.slice(2).every(x=>x.src==='pokekit');
  r.pref=A.pref.length===1&&B.pref.length===1&&A.pref[0].k==='type'&&B.pref[0].k==='type'&&[A,B].every(X=>X.pref[0].ok||!!X.pref[0].why)&&!A.pref.some(q=>/メガシンカ|最初に決めた/.test(q.t));
  r.prefSep=A.req.length===B.req.length;
  /* メガなし */
  TB.cond={must:[],ng:[],mega:'none',type:'auto'};const Bn=tbPropComp(),An=tbPropPref();
  r.none=[Bn,An].every(X=>!X.mem.some(x=>x.set&&x.set.it&&isStone(x.set.it.k)));
  TB.cond=c;return r});
ok(E.illegal&&E.both&&E.stone&&E.notIn,'守れない必ず守る条件を理由つきで止める（未確認の匹・両方に入れた匹・未確認のメガストーン・入れたい匹にいないメガ）');
ok(!E.err.length,'組める条件では止めない '+E.err.join('/'));
ok(E.restore,'こだわり優先の計算のあと、いまのパーティと保存した条件は元のまま');
ok(E.A.req&&E.A.ng&&E.A.mega&&E.A.six,'案A：必ず守る条件を守る '+JSON.stringify(E.A));
ok(E.B.req&&E.B.ng&&E.B.mega&&E.B.six,'案B：必ず守る条件を守る '+JSON.stringify(E.B));
ok(E.A.legal&&E.A.clean&&E.A.items&&E.A.sp&&E.B.legal&&E.B.clean&&E.B.items&&E.B.sp,'案の型は使える匹・重ならない持ち物・覚える技・能力ポイントの決まりを守る');
ok(E.A.scen&&E.B.scen,'メガシンカは1匹の場合だけ＋メガシンカなしの場合');
ok(E.kinds,'2つの案を分ける（理論上の型／集計の型）');
ok(E.pref&&E.prefSep,'できれば守る条件は別に書き、必ず守る条件と混ぜない・守れなければ理由');
ok(E.none,'メガシンカなしならメガストーンを持たせない');
/* 画面：案を作る・③で開く */
await pg.evaluate(()=>{TB.cond={must:[],ng:[],mega:'auto',type:'auto'};TB.tab='cond';TB_PROP=null;tbDraw();document.getElementById('tb-run').click()});
await pg.waitForFunction(()=>document.getElementById('tb-prop')&&!/案を作っています/.test(document.getElementById('tb-prop').textContent),null,{timeout:60000});
const F=await pg.evaluate(()=>{const t=document.getElementById('tb-prop').textContent;return{two:/案A こだわり優先/.test(t)&&/案B 勝ちやすさ寄り/.test(t),theory:/理論上/.test(t),noWin:/勝率が高いという意味ではありません/.test(t),over:document.body.scrollWidth>innerWidth+1}});
ok(F.two&&F.theory&&F.noWin,'2つの案と、理論上の計算であることを書く');ok(!F.over,'② 390px ではみ出さない');
await pg.evaluate(()=>{__confAns=true;document.querySelector('[data-tbpo="B"]').click()});await wait(600);
const G=await pg.evaluate(()=>({tab:TB.tab,n:TB.mem.length,first:TB.mem[0].no===TB.start}));
ok(G.tab==='manual'&&G.n===6&&G.first,'案を③の下書きに開く');

/* ---- 7 パーティに入れる：既存の useTeam。空き枠へ・空きが無ければ確かめる ---- */
const H=await pg.evaluate(async()=>{const r={};
  for(let i=0;i<TEAMS.list.length;i++){switchTeam(i);team.length=0;saveTeam()}switchTeam(0);
  team.push({no:N('カビゴン'),sel:false});saveTeam();
  __conf.length=0;__confAns=true;await tbTransfer(TB.mem,'テスト');
  r.slot=TEAMS.cur!==0&&TEAMS.list[0].team.length===1&&TEAMS.list[0].team[0].no===N('カビゴン')&&team.length===6&&team[0].no===TB.start;
  r.set=team.some(x=>x.set&&x.set.mv&&x.set.mv.length);
  /* 枠がすべて埋まっている：断ったら何も変えない */
  for(let i=0;i<TEAMS.list.length;i++){if(!TEAMS.list[i].team.length){switchTeam(i);team.push({no:N('カビゴン'),sel:false});saveTeam()}}
  const before=JSON.stringify(TEAMS.list.map(x=>x.team.map(y=>y.no)));
  __conf.length=0;__confSeq=[true,false];await tbTransfer(TB.mem,'テスト2');__confSeq=null;
  r.asked=__conf.some(t=>/入れかえ/.test(t));r.kept=JSON.stringify(TEAMS.list.map(x=>x.team.map(y=>y.no)))===before;
  __confAns=true;return r});
ok(H.slot,'空いている枠に入れ、いまのパーティは残す');
ok(H.set,'育成も入る');
ok(H.asked&&H.kept,'空きが無ければ確かめ、断れば何も変えない');

/* ---- 8 確かめ：未確認のメガストーン・重なる持ち物・覚えない技を直す ---- */
const V=await pg.evaluate(()=>{const g=N('ガブリアス'),l=N('ルカリオ');
  const R=tbValidate([{no:g,set:{it:{k:'garchompite'},mv:[{id:89}],sp:[2,32,0,0,0,32]}},{no:l,set:{it:{k:'lucarionitez'},mv:[{id:89},{id:1}]}},{no:N('カイリュー'),set:{it:{k:'lucarionitez'},mv:[],sp:[32,32,32,0,0,0]}}]);
  return{stone:R.mem[0].set.it===null&&R.notes.some(t=>/未確認/.test(t)),ok:R.mem[1].set.it&&R.mem[1].set.it.k==='lucarionitez',
    dupStone:R.mem[2].set.it===null,mv:R.notes.some(t=>/覚えない技/.test(t)),sp:R.mem[2].set.sp===null&&R.notes.some(t=>/能力ポイント/.test(t))}});
ok(V.stone&&V.ok,'未確認のメガストーンは外し、確認できたものは残す');
ok(V.dupStone,'持てないメガストーンは外す');
ok(V.mv,'覚えない技を外す');
ok(V.sp,'能力ポイントの決まり（合計66・1つ32まで）を超えたら外す');

/* ---- 9 画面の切りかえで下書きが残る・古い計算で上書きしない ---- */
/* 直前の「パーティに入れる」でパーティの画面に移っているので、この画面に戻してから */
await pg.evaluate(()=>{location.hash='#/tb'});await pg.waitForFunction(()=>!!document.querySelector('.tbd-tabs'),null,{timeout:15000});
const S=await pg.evaluate(async()=>{const m=JSON.stringify(TB.mem);for(const t of ['find','cond','manual','find','manual']){TB.tab=t;tbDraw()}
  const t0=Date.now();while(Date.now()-t0<30000&&/分析中/.test((document.getElementById('tb-an')||{}).textContent||''))await new Promise(r=>setTimeout(r,200));
  return{kept:JSON.stringify(TB.mem)===m,one:document.querySelectorAll('#tb-an').length===1&&!/分析中/.test(document.getElementById('tb-an').textContent)&&TB.tab==='manual'}});
ok(S.kept,'3つの道を切りかえても下書きが残る');ok(S.one,'切りかえを続けても最後の画面の計算だけを描く');
await pg.reload();await wait(800);
const RL=await pg.evaluate(()=>!!TB&&TB.mem.length===6);ok(RL,'読み直しても下書きが残る');

/* ---- 10 続き（docs/pokemon-team-building-followup-audit.md） ---- */
/* 読み直したので差しかえをもう一度 */
await pg.evaluate(()=>{window.N=s=>P.find(x=>x.n===s).no;window.__pick=[];pickMon=async()=>window.__pick.shift()||null;
  window.__conf=[];askConfirm=async o=>{window.__conf.push(o.title);if(window.__confSeq&&window.__confSeq.length)return window.__confSeq.shift();return true};
  authFetch=async u=>u==='/api/seasons'?{seasons:[]}:{teams:[]}});
/* 図鑑のページから入れる */
await pg.evaluate(()=>{location.hash='#/p/'+N('ガブリアス')});await wait(1500);
const ENT=await pg.evaluate(()=>[...document.querySelectorAll('#view a[href^="#/tb/"]')].some(a=>a.getAttribute('href')==='#/tb/'+N('ガブリアス')));
ok(ENT,'図鑑のページから「このポケモンから組む」で入れる');
/* メガシンカ：なしの場合を必ず入れる・同時に2匹がメガにならない */
const MG=await pg.evaluate(()=>{const g=N('ガブリアス'),l=N('ルカリオ'),m=N('ドドゲザン');
  const E1=tbEval([{no:g,set:null},{no:m,set:null}]),E2=tbEval([{no:l,set:{it:{k:'lucarionitez'},mv:[{id:89}]}},{no:g,set:{it:{k:'garchompite'},mv:[{id:89}]}},{no:m}]);
  return{one:E1.scen.length===1&&E1.scen[0].key==='none',two:E2.scen.length===3&&E2.scen[0].key==='none'&&E2.scen.every(s=>s.megaIdx.length<=1)&&E2.scen.filter(s=>s.megaIdx.length===1).length===2,
    swap:mvpEvalTeam([{no:l,sel:false,set:{it:{k:'lucarionitez'},mv:[{id:89}]}}],'single').scen.length===1}});
ok(MG.one,'メガストーンが無ければ「メガシンカなし」の1つだけ');
ok(MG.two,'メガストーンが2匹なら「なし」と1匹ずつの3つ（2匹同時にメガにしない）');
ok(MG.swap,'入れかえ案（mvpEvalTeam の既定）は前と同じ');
/* ③：最後のメガシンカできる匹を外すときは確かめる。断れば変えない */
const LM=await pg.evaluate(async()=>{TB=tbNew(N('ガブリアス'));TB.mem.push({no:N('ルカリオ'),set:{it:{k:'lucarionitez'},mv:[{id:89}]},src:'user'},{no:N('ドドゲザン'),set:null,src:'none'});tbSave();TB.tab='manual';tbDraw();
  __conf.length=0;__confSeq=[false];document.querySelector('[data-tbrm="1"]').click();await new Promise(r=>setTimeout(r,200));
  const kept=TB.mem.length===3,asked=__conf.includes('メガシンカできる匹がいなくなります');
  __conf.length=0;__confSeq=null;document.querySelector('[data-tbrm="2"]').click();await new Promise(r=>setTimeout(r,200));
  return{kept,asked,noAsk:!__conf.length&&TB.mem.length===2}});
ok(LM.asked&&LM.kept,'最後のメガシンカできる匹を外すときは確かめ、断れば外さない');
ok(LM.noAsk,'メガストーンを持たない匹は確かめずに外す');
/* ③：分析がそのたびに変わる（タイプの表・1匹ずつの働き） */
await pg.waitForFunction(()=>document.querySelector('#tb-an .tbd-mi'),null,{timeout:30000});
const AN1=await pg.evaluate(()=>({n:document.querySelectorAll('#tb-an .tbd-mi > li').length,ty:document.querySelectorAll('#tb-an .tbd-tyr').length,
  three:/1対1で有利/.test(document.getElementById('tb-an').textContent)&&/安全に受けられる/.test(document.getElementById('tb-an').textContent)&&/後出しして勝てる/.test(document.getElementById('tb-an').textContent)}));
await pg.evaluate(()=>{__pick.push(N('アシレーヌ'));tbPickAdd(-1)});
await pg.waitForFunction(()=>document.querySelectorAll('#tb-an .tbd-mi > li').length===3,null,{timeout:30000});
const AN2=await pg.evaluate(()=>document.querySelectorAll('#tb-an .tbd-mi > li').length);
ok(AN1.n===2&&AN1.ty===18,'③ 分析：1匹ずつの働きとタイプの表（18タイプ） '+JSON.stringify(AN1));
ok(AN1.three,'③ 1対1で有利・安全に受けられる・後出しして勝てる を分けて出す');
ok(AN2===3,'③ 匹を足すと分析が変わる');
const TY=await pg.evaluate(()=>{const Y=tbTypes([{no:N('ガブリアス')},{no:N('ドドゲザン')}]);const ice=Y.def.find(d=>d.t==='こおり');return ice.w===1&&Y.est&&Y.at.includes('じめん')});
ok(TY,'タイプの表の数（ガブリアスはこおり4倍・技が無ければタイプ一致で数える）');
/* パーティに入れる：集計の型の仮定の能力ポイントは入れない。登録した育成の能力ポイントは残す */
const SPX=await pg.evaluate(()=>{const S=mvpSet('single',N('ドドゲザン'),{});const F=tbForParty([{no:N('ガブリアス'),set:{mv:[{id:89}],sp:[2,32,0,0,0,32]},src:'team'},{no:N('ドドゲザン'),set:S.sv,src:'pokekit'}]);
  return{reg:!!F.mem[0].set.sp,kit:F.mem[1].set.sp===null&&F.mem[1].set.mv.length>0,note:F.notes.length===1}});
ok(SPX.reg&&SPX.kit&&SPX.note,'集計の型の仮定の能力ポイントはパーティに入れない（登録した値は残す）');
/* ①：登録の能力ポイントは丸めない */
const RS=await pg.evaluate(()=>{const R=tbRegSet({sp:[40,32,0,0,0,0],mv:[{id:89},{id:99999}]});const R2=tbRegSet({sp:[2,32,0,0,0,32]});return{bad:R.s&&R.s.sp===null&&R.notes.length===2,good:R2.s&&R2.s.sp[1]===32,none:tbRegSet(null).s===null}});
ok(RS.bad&&RS.good&&RS.none,'登録の能力ポイントが決まりの外なら丸めずに使わない・表に無い技を知らせる');
/* ①：0件・一部だけ読めた・シーズンが無い */
const findTxt=async()=>{await pg.evaluate(()=>{TB_FIND=null;TB=tbNew(N('ガブリアス'));TB.tab='find';tbSave();tbDraw()});await pg.waitForFunction(()=>!/読み込み中/.test(document.getElementById('tb-teams').textContent),null,{timeout:15000});
  return pg.evaluate(()=>({t:document.getElementById('tb-teams').textContent,none:!!document.querySelector('#tb-teams .tbd-none'),cards:document.querySelectorAll('#tb-teams .tbd-c').length,sets:/集計の型/.test(document.getElementById('tb-sets').textContent)&&!!document.querySelector('#tb-sets .tbd-tm')}))};
await pg.evaluate(()=>{window.__af=authFetch;authFetch=async u=>u==='/api/seasons'?{seasons:[{id:5,name:'空のシーズン',n:2,start:'2026-10-01',end:'2026-10-31'}]}:{teams:[{id:1,rank:1,team:[{no:N('カビゴン')}]}]}});
const F0=await findTxt();
ok(F0.none&&F0.cards===0&&/読み込みは成功しました/.test(F0.t)&&!/読み込めませんでした/.test(F0.t),'① 0件：読み込みの失敗と分けて、調べた範囲を書く');
ok(/2026-10-01〜2026-10-31/.test(F0.t)&&/登録 1件のうち/.test(F0.t),'① 調べたシーズンの期間と件数（標本の大きさ）');
ok(F0.sets,'① 0件でも集計の型と仲間は出る');
await pg.evaluate(()=>{authFetch=async u=>u==='/api/seasons'?{seasons:[]}:{teams:[]}});
const F1=await findTxt();ok(F1.none&&/まだパーティが登録されたシーズンがありません/.test(F1.t),'① シーズンが無いときの表示');
await pg.evaluate(()=>{authFetch=async u=>{if(u==='/api/seasons')return{seasons:[{id:6,name:'読めるS',n:1},{id:7,name:'読めないS',n:1}]};if(/seasons\/7/.test(u))throw new Error('x');return{teams:[{id:9,rank:4,verified:true,team:[{no:N('ガブリアス')},{no:N('カビゴン')}]}]}}});
const F2=await findTxt();ok(F2.cards===1&&/一部のシーズン（読めないS）を読み込めませんでした/.test(F2.t),'① 一部のシーズンが読めないときは知らせる');
await pg.evaluate(()=>{authFetch=window.__af;TB_FIND=null});
/* ②：できれば守る条件・矛盾・決まった結果 */
const C2=await pg.evaluate(()=>{const r={};TB=tbNew(N('ガブリアス'));
  r.wantNg=tbCondCheck({must:[],ng:[N('カイリュー')],want:[N('カイリュー')],mega:'auto',type:'auto',style:[]}).some(e=>/できれば入れたい匹」と「入れたくない匹/.test(e));
  r.wantMust=tbCondCheck({must:[N('カイリュー')],ng:[],want:[N('カイリュー')],mega:'auto',type:'auto',style:[]}).some(e=>/両方/.test(e));
  r.excl=tbCondCheck({must:[],ng:[],want:[],mega:'auto',type:'auto',style:['phys','spec']}).some(e=>/同時に選べません/.test(e));
  r.trw=tbCondWarn({type:'tr',style:['fast']}).length===1;
  TB.cond={must:[],ng:[],want:[N('カビゴン')],mega:'auto',type:'tr',style:['heal','clear']};
  const k0=JSON.stringify(KD.opt);KD.opt={scarf:true,popular:true};const P1=tbProps();KD.opt={rare:true,bst:true};const P2=tbProps();r.kdIso=JSON.stringify(P1.A.mem.map(x=>x.no))===JSON.stringify(P2.A.mem.map(x=>x.no))&&JSON.stringify(KD.opt)===JSON.stringify({rare:true,bst:true});
  r.det=JSON.stringify([P1.A.mem,P1.B.mem])===JSON.stringify([P2.A.mem,P2.B.mem]);
  r.aWant=P1.A.mem.some(x=>x.no===N('カビゴン'));
  const bw=P1.B.pref.find(q=>q.k==='want');r.bWant=!!bw&&(bw.ok||!!bw.why);
  r.prefAll=[P1.A,P1.B].every(X=>X.pref.length===4&&X.pref.every(q=>q.ok||q.why));
  r.reqAll=[P1.A,P1.B].every(X=>X.req.every(q=>q.ok));
  r.info=[P1.A,P1.B].every(X=>X.info.length===6&&X.info.every(f=>'adv' in f&&'recv' in f&&'sw' in f)&&X.mem.every(x=>(x.why||[]).length));
  r.cmp=P1.A.critN!=null&&P1.B.critN!=null;
  TB.cond={must:[],ng:[],want:[],mega:'auto',type:'auto',style:[]};return r});
ok(C2.wantNg&&C2.wantMust&&C2.excl,'② できれば入れたい匹と入れたくない匹・入れたい匹の矛盾、同時に選べない条件を止める');
ok(C2.trw,'② 両立しにくい好みは止めずに知らせる');
ok(C2.kdIso,'② ほかの画面で保存したこだわり条件（KD.opt）を使わず、元に戻す');
ok(C2.det,'② 同じ条件なら同じ2つの案');
ok(C2.aWant,'② 案A：できれば入れたい匹を入れる');
ok(C2.bWant,'② 案B：できれば入れたい匹は、入れたか入れなかった理由');
ok(C2.prefAll&&C2.reqAll,'② 必ず守る条件は守り、できれば守る条件はすべて ✓ か理由');
ok(C2.info,'② 1匹ずつ：選んだ理由・有利・受け・後出し');
ok(C2.cmp,'② 案Aと案Bの大きな弱点の数を比べる');
/* ②：作った案は読み直しても同じ条件なら作り直す */
await pg.evaluate(()=>{TB.cond={must:[],ng:[],want:[],mega:'none',type:'auto',style:['fast']};TB.tab='cond';TB_PROP=null;tbSave();tbDraw();document.getElementById('tb-run').click()});
await pg.waitForFunction(()=>/2つの案/.test((document.getElementById('tb-prop')||{}).textContent||''),null,{timeout:60000});
const P0=await pg.evaluate(()=>JSON.stringify([TB_PROP.A.mem.map(x=>x.no),TB_PROP.B.mem.map(x=>x.no)]));
await pg.evaluate(()=>{location.hash='#/tb'});await wait(300);
await pg.reload();await wait(1500);await pg.evaluate(()=>{window.N=s=>P.find(x=>x.n===s).no});
await pg.waitForFunction(()=>/2つの案/.test((document.getElementById('tb-prop')||{}).textContent||''),null,{timeout:60000}).catch(()=>{});
const P1=await pg.evaluate(()=>TB&&TB.tab==='cond'&&TB_PROP?JSON.stringify([TB_PROP.A.mem.map(x=>x.no),TB_PROP.B.mem.map(x=>x.no)]):'');
ok(P0===P1,'② 読み直しても同じ条件の案が同じに出る');
const W390=await pg.evaluate(()=>document.body.scrollWidth<=innerWidth+1);ok(W390,'② 390px ではみ出さない（条件を足したあと）');
/* 古い集計 */
const ST=await pg.evaluate(()=>{const f=Date.parse(mvpMeta('single').fetched+'T00:00:00+09:00');return{old:tbStale('single',f+60*864e5)===60,fresh:tbStale('single',f+10*864e5)===null}});
ok(ST.old&&ST.fresh,'集計が古いとき（45日より前）は知らせる');
/* データが無い形式 */
const ND=await pg.evaluate(()=>{const k=MVP_DATA.sets.single;MVP_DATA.sets.single=null;let r;try{r=tbAnalyze([{no:N('ガブリアス')}]).st}finally{MVP_DATA.sets.single=k}return r});
ok(ND==='nodata','集計が無い形式では分析しないで理由を出す');
ok(!errs.length,'ページのエラーなし '+errs.join(' / '));
await b.close();
console.log(`teambuild: ${bad?'NG':'OK'}（${n}項目${bad?`・${bad}件NG`:''}）`);
if(bad)process.exitCode=1;
