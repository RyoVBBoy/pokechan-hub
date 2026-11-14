// 入れかえ案 MVP（76-mvp.js・75-mvp-data.js、docs/party-building-mvp-spec.md）の確認（2026/11/13）
// 使えるか・データの出典と形式・メガシンカの場合・持ち物の重なり・弱点と入れかえの比べ方・同じ入力で同じ結果・古い計算で上書きしない・画面
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
let n=0,bad=0;const ok=(c,m)=>{n++;if(!c){bad++;console.error('NG',m)}};
const ctx=await b.newContext({locale:'ja-JP',viewport:{width:390,height:844}});
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.route(/^https?:/,r=>r.abort());
await pg.goto('file://'+path.join(ROOT,'dist/index.html'));await pg.waitForTimeout(600);

const R=await pg.evaluate(()=>{
  const r={};const N=s=>P.find(x=>x.n===s).no;
  const stoneOf=no=>Object.keys(MEGA).find(k=>MEGA[k][no]);
  /* ---- 使えるか・データ ---- */
  r.legalOk=mvpLegal(N('ガブリアス')).st==='ok'&&mvpSet('single',N('ガブリアス'),{}).st==='ok';
  r.unv=[10260,10262,10061].map(no=>mvpLegal(no).st);
  /* 上位150匹に無い匹は型を作らない */
  const rowsS=mvpRows('single').rows;const inS=new Set(rowsS.map(x=>x.no));
  const outside=P.find(p=>mvpLegal(p.no).st==='ok'&&!inS.has(p.no));
  r.outside=outside?mvpSet('single',outside.no,{}).st:'none';
  /* シングルとダブルを混ぜない：型はその形式の行から。相手もその形式の行から */
  const pick=rowsS.map(x=>x.no).find(no=>{const a=mvpSet('single',no,{}),d=mvpSet('double',no,{});return a.st==='ok'&&d.st==='ok'&&JSON.stringify(a.sv)!==JSON.stringify(d.sv)});
  r.fmtSep=!!pick;
  const dIds=new Set(MVP_DATA.sets.double.rows.map(x=>x.id)),sIds=new Set(MVP_DATA.sets.single.rows.map(x=>x.id));
  r.oppFmt=mvpOpps('double').list.every(o=>dIds.has(o.key))&&mvpOpps('single').list.every(o=>sIds.has(o.key));
  r.meta=['single','double'].map(f=>{const m=mvpMeta(f);return !!(m&&m.month&&m.battles>0&&m.format&&m.fetched&&/PokéKit/.test(m.source))});
  /* 能力ポイント：PokéKit の evs は持たず、仮定の振り方だけ */
  r.noEvs=!/"evs"/.test(JSON.stringify(MVP_DATA))&&rowsS.slice(0,30).every(x=>{const s=mvpSet('single',x.no,{stone:x.stone,anyLegal:true,anyMv:true});return s.st!=='ok'||[MVP_SP.phys.join(),MVP_SP.spec.join()].includes(s.sv.sp.join())});
  /* ---- 6匹 ---- */
  const base=[N('ドドゲザン'),N('ガオガエン'),N('ゴリランダー'),N('ブリジュラス'),N('カバルドン'),N('アシレーヌ')].map(no=>({no,sel:false}));
  const withStone=(e,i,no)=>e.map((x,k)=>k===i?{no,sel:false,set:{it:{k:stoneOf(no),n:''}}}:x);
  const E0=mvpEvalTeam(base,'single');
  r.noMega=E0.scen.length===1&&E0.scen[0].key==='none'&&E0.scen[0].megaIdx.length===0;
  const one=withStone(base,0,N('ガブリアス'));const E1=mvpEvalTeam(one,'single');
  r.oneMega=E1.scen.length===1&&E1.scen[0].key==='mega:'+N('ガブリアス')&&E1.scen[0].megaIdx.join()==='0';
  const two=withStone(one,1,N('リザードン'));const E2=mvpEvalTeam(two,'single');
  r.twoMega=E2.scen.length===2&&E2.scen.every(s=>s.megaIdx.length===1)&&E2.scen.map(s=>s.megaIdx[0]).sort().join()==='0,1';
  /* 最後のメガシンカできる匹を外すと警告 */
  const E1b=mvpEvalTeam(one.map((x,k)=>k===0?{no:N('カイリュー'),sel:false}:x),'single');
  const C1=mvpCompare(E1,E1b,N('ガブリアス'),N('カイリュー'));r.lastMega=C1.lastMegaLost&&C1.lost.length===1;
  /* メガシンカできる候補が入ると、場合が増える（メガなし→その匹がメガ） */
  const C2=mvpCompare(E0,E1,N('ドドゲザン'),N('ガブリアス'));r.megaAdd=C2.megaAdded&&C2.pairs.length===1&&C2.pairs[0].b.key==='mega:'+N('ガブリアス');
  /* ---- 持ち物 ---- */
  const dupT=base.map((x,k)=>k<2?{...x,set:{it:{k:'leftovers',n:''},mv:[{id:89}]}}:x);r.dup=mvpEvalTeam(dupT,'single').dup.join()==='leftovers';
  /* 育成が未登録の匹の推定の持ち物も、6匹で重ならない */
  r.estNoDup=mvpEvalTeam(base,'single').dup.length===0;
  const row=rowsS.find(x=>!x.stone&&x.it.length>=2&&mvpSet('single',x.no,{}).st==='ok');
  const s0=mvpSet('single',row.no,{});const k0=s0.sv.it&&s0.sv.it.k;
  const s1=mvpSet('single',row.no,{used:new Set([k0])});
  r.alt=s1.st==='ok'&&s1.sv.it&&s1.sv.it.k!==k0&&row.it.some(([k])=>k===s1.sv.it.k)&&s1.row.itAlt&&s1.notes.some(t=>/重なる/.test(t));
  const all=new Set(row.it.map(([k])=>k==='leek'?'stick':k));const s2=mvpSet('single',row.no,{used:all});
  r.conflict=row.it.some(([k])=>k==='nothing')?s2.st==='ok'&&!s2.sv.it:s2.st==='item_conflict';
  /* ---- 入れかえ ---- */
  const team6=withStone(two,2,N('ドドゲザン')).map((x,k)=>k===2?{no:x.no,sel:false}:x);
  let combosN=0,selN=0;const oc=combos,os=dgSelect;combos=(...a)=>{combosN++;return oc(...a)};dgSelect=(...a)=>{selN++;return os(...a)};
  let S;try{S=mvpSwaps(team6,'single')}finally{combos=oc;dgSelect=os}
  r.noCombos=[combosN,selN];
  r.st=S.st;r.metaOn=S.meta&&S.meta.month===MVP_DATA.sets.single.meta.month&&S.ver===MVP_DATA.version&&S.fmt==='single';
  r.better=S.better.length;r.trade=S.trade.length;
  /* おすすめは：大きな弱点を1つ以上減らし、どの場合でも大きな弱点を増やさず、弱点の数も増えない。持ち物は重ならない。使えると確認した匹・メガストーンだけ */
  r.betterOk=S.better.every(x=>x.C.cf>0&&x.C.cm===0&&x.C.pairs.every(p=>p.n1<=p.n0)&&x.E1.dup.every(k=>S.E0.dup.includes(k))&&!(x.S.sv.it&&x.E1.mem.filter((m,k)=>k!==x.i).some(m=>m.item===x.S.sv.it.k))&&mvpLegal(x.c.r.no).st==='ok'&&(!x.c.r.stone||mvpStoneSt(x.c.r.stone,x.c.r.no)==='ok'));
  /* 減らしたとする弱点は、変更後の同じ場合に本当に無い */
  r.fixedReal=S.better.every(x=>x.C.pairs.every(p=>p.fixed.every(w=>!p.b.weak.some(v=>v.key===w.key))));
  /* 良くなるが悪くなるところもある案は、おすすめに入れず、悪くなるところを出す */
  r.tradeOk=S.trade.every(x=>x.C.cf>0&&((x.C.cm>0||x.C.pairs.some(p=>p.n1>p.n0))&&x.C.pairs.some(p=>p.made.length)||x.C.roleLoss));
  /* 1対1で強い候補でも、6匹で良くならなければおすすめにしない */
  const recNos=new Set(S.better.map(x=>x.c.r.no));r.notByMatch=S.trade.some(x=>!recNos.has(x.c.r.no))||S.trade.length===0;
  /* 未確認・データ不足の匹は候補に出さず、理由つきで分ける */
  r.exOk=S.excluded.every(x=>['unverified','illegal','nodata','insufficient','item_conflict'].includes(x.st)&&x.why)&&[...S.better,...S.trade].every(x=>mvpLegal(x.c.r.no).st==='ok');
  /* 1対1で有利でも、後出しとは別に数えている */
  r.sep=[...MVP_MC.values()].some(z=>z&&z.r>=4&&!z.sw);
  /* 弱点の判定：「有利に戦える匹がいない」は、本当にだれも r>=3 でない */
  const sc=S.E0.scen[0],w=sc.weak.find(v=>v.k==='none');
  r.weakReal=!w||sc.rows.find(z=>z.op.key===w.op.key).z.every(v=>!v||v.r<3);
  r.hasCrit=S.E0.scen.some(s=>s.weak.some(v=>v.crit));
  /* ---- 同じ入力で同じ結果・並びの決め方 ---- */
  const sum=X=>JSON.stringify([X.better.map(x=>[x.i,x.c.r.no,x.c.r.stone,x.C.cf,x.C.cm]),X.trade.map(x=>[x.i,x.c.r.no]),X.E0.scen.map(s=>s.weak.map(v=>v.key))]);
  const a1=sum(S);MVP_MC.clear();for(const k in MVP_OPPC)delete MVP_OPPC[k];
  const keepRows=MVP_ROWS.single;MVP_ROWS.single={...keepRows,rows:[...keepRows.rows].reverse()};
  let a2;try{a2=sum(mvpSwaps(team6,'single'))}finally{MVP_ROWS.single=keepRows}
  r.det=a1===a2;
  /* ---- データが無いとき：作らない ---- */
  const keepD=MVP_DATA.sets.double;delete MVP_DATA.sets.double;delete MVP_ROWS.double;delete MVP_OPPC.double;
  try{r.noData=mvpSwaps(team6,'double').st}finally{MVP_DATA.sets.double=keepD}
  r.notFull=mvpSwaps(team6.slice(0,5),'single').st;
  /* ダブルの評価で見ていないことを書く */
  r.dblLim=/ねこだまし/.test(mvpLimitsHTML('double'))&&/完成していません/.test(mvpLimitsHTML('double'))&&!/ダブルで見ていないこと/.test(mvpLimitsHTML('single'));
  window.__T6=team6;return r;
});
ok(R.legalOk,'確認できた匹は候補になる');
ok(R.unv.every(x=>x==='unverified'),'対応が確かめられない姿は未確認 '+R.unv);
ok(R.outside==='nodata','上位150匹に無い匹に型を作らない '+R.outside);
ok(R.fmtSep&&R.oppFmt,'シングルとダブルのデータを混ぜない');
ok(R.meta.every(Boolean),'出典・月・対戦数・取得日が付いている');
ok(R.noEvs,'集計の振り方の数字を能力ポイントとして使わない');
ok(R.noMega,'メガシンカできる匹がいない：メガなしの場合1つ');
ok(R.oneMega,'メガシンカできる匹が1匹：その場合1つ');
ok(R.twoMega,'メガシンカできる匹が2匹：場合が2つで、どちらも1匹だけメガ');
ok(R.lastMega,'最後のメガシンカできる匹を外すと警告');
ok(R.megaAdd,'メガシンカできる候補で場合が増える');
ok(R.dup,'6匹の持ち物の重なりを見つける');
ok(R.estNoDup,'未登録の匹の推定の持ち物も重ならない');
ok(R.alt,'持ち物が重なるときは同じ集計のほかの持ち物（印つき）');
ok(R.conflict,'同じ集計にほかの持ち物が無ければ使えない');
ok(R.noCombos.join()==='0,0','選出の組み合わせを数えない '+R.noCombos);
ok(R.st==='ok'&&R.metaOn,'結果に形式・月・版が付く');
ok(R.better+R.trade>0,'入れかえを比べた結果が出る '+R.better+'/'+R.trade);
ok(R.betterOk,'おすすめは大きな弱点を減らし、増やさず、持ち物の重なりも増やさない');
ok(R.fixedReal,'減らした弱点は変更後に本当に無い');
ok(R.tradeOk,'悪くなるところがある案は分けて、悪くなる点を出す');
ok(R.notByMatch,'1対1で強いだけではおすすめにしない');
ok(R.exOk,'未確認・データ不足は理由つきで分け、候補に出さない');
ok(R.sep,'1対1で有利と後出しを分けて数える');
ok(R.weakReal&&R.hasCrit,'大きな弱点の判定');
ok(R.det,'同じ入力で同じ結果（並び順を変えても）');
ok(R.noData==='nodata'&&R.notFull==='notfull','データが無い・6匹いないときは案を作らない '+R.noData+'/'+R.notFull);
ok(R.dblLim,'ダブルで見ていないことを書く');

/* ---- 画面：古い計算で新しい画面を上書きしない・390px ---- */
await pg.evaluate(()=>{team.length=0;window.__T6.forEach(x=>team.push(JSON.parse(JSON.stringify(x))));PR_MODE='list';location.hash='#/pair'});
await pg.waitForTimeout(400);
const A=await pg.evaluate(async()=>{
  let draws=0;const oh=mvpResultHTML;mvpResultHTML=(...a)=>{draws++;return oh(...a)};
  const el=document.getElementById('pr-list');mvpSwapDraw(el,{});mvpSwapDraw(el,{});
  await new Promise(r=>setTimeout(r,3000));mvpResultHTML=oh;
  return{draws,done:!/計算中/.test(el.textContent),weak:!!el.querySelector('.mvp-weak'),lim:!!el.querySelector('.mvp-lim'),
    src:/PokéKit/.test(el.textContent)&&/仮定/.test(el.textContent),over:document.documentElement.scrollWidth>window.innerWidth+1||document.body.scrollWidth>window.innerWidth+1,
    words:!/必ず良くなる|最強|完璧|安全に後出し/.test(el.textContent)}});
ok(A.draws===1,'古い計算の結果で上書きしない（描くのは最後の1回） '+A.draws);
ok(A.done&&A.weak&&A.lim&&A.src,'画面に弱点・見ていないこと・出典が出る');
ok(!A.over,'390px で横にはみ出さない');
ok(A.words,'言い過ぎの言葉を使わない');
ok(!errs.length,'ページのエラーなし '+errs.join(' / '));
await b.close();
console.log(`mvp: ${bad?'NG':'OK'}（${n}項目${bad?`・${bad}件NG`:''}）`);
if(bad)process.exitCode=1;
