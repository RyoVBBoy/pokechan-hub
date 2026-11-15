// こだわり条件で組む（58-kodawari.js・80-kdcheck.js）の確かめ（2026/11/15 依頼主「Fix Team Generation and Pokémon Set Generation」）
// 依頼主が報告した場面：最初の1匹アブソル・構築のタイプ 対面＞速攻・メガシンカ2匹・人気の条件「弱点を受け合える」「先に動く手段を入れる」。
// 報告された案2（アブソル スカーフ…／ゲンガー／マスカーニャ／アシレーヌ／サーフゴー／ガブリアス）は「条件を満たしていない例」として、確かめの側が見つけられるかを調べる。
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
let n=0,bad=0;const ok=(c,m)=>{n++;if(!c){bad++;console.error('NG',m)}};
const ctx=await b.newContext({locale:'ja-JP',viewport:{width:390,height:844}});
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.route(/^https?:/,r=>r.abort());
await pg.goto('file://'+path.join(ROOT,'dist/index.html'));await pg.waitForTimeout(600);

/* 準備：報告の条件と、報告された案2 */
await pg.evaluate(()=>{
  window.N=s=>P.find(x=>x.n===s).no;
  window.MID=s=>{const k=Object.keys(MV).find(k=>MV[k][0]===s)||Object.keys(MD).find(k=>mName(+k)===s);if(!k)throw new Error('技が無い '+s);return +k};
  window.KD_CASE=()=>{team.length=0;team.push({no:N('アブソル'),sel:true});Object.assign(KD,{big:'taimen',type:'rush',ng:[],mega:2,opt:{resist:true,fast:true},seed:0})};
  const S=(no,item,mv,phys,ab)=>({ab:ab||(ABD[no]||[])[0][0],item,moves:mv.map(MID),sp:phys?[...MVP_SP.phys]:[...MVP_SP.spec],up:phys?1:3,dn:phys?3:1,src:'theory',fixes:[]});
  window.REPORTED=()=>{const m=['アブソル','ゲンガー','マスカーニャ','アシレーヌ','サーフゴー','ガブリアス'].map(s=>byNo[N(s)]);
    return{mons:m,ss:[S(m[0].no,'choicescarf',['ばかぢから','じごくづき','メガホーン','ストーンエッジ'],1),S(m[1].no,'gengarite',['ヘドロばくだん','シャドーボール','きあいだま','１０まんボルト'],0),
      S(m[2].no,'expertbelt',['トリックフラワー','じごくづき','かわらわり','じゃれつく'],1),S(m[3].no,'wiseglasses',['ムーンフォース','ハイドロポンプ','れいとうビーム','シャドーボール'],0),
      S(m[4].no,'sitrusberry',['ゴールドラッシュ','シャドーボール','きあいだま','１０まんボルト'],0),S(m[5].no,'garchompite',['じしん','げきりん','ストーンエッジ','かみくだく'],1)]}};
  window.PARTS=()=>{const tp=KD_TYPES.find(t=>t[0]===KD.type),a=tp[2]?ARCHS.find(x=>x[0]===tp[2]):null;return{tp,parts:[...(KD_PARTS[KD.type]||[]),...(a?a[7]:[])]}};
});

/* 生成：4つの種で組む（kdEnsure と同じく、種ごとに少しゆらす） */
const G=await pg.evaluate(()=>{KD_CASE();const out=[];
  for(let s=0;s<4;s++){KD.seed=s;const R=kdBuild();out.push(R)}
  window.GEN=out;
  return out.map(R=>({pass:R.pass,mons:R.mons.map(m=>m.no),req:R.V.req.map(r=>({id:r.id,ok:r.ok,hard:r.hard,per:r.per||null})),checks:R.checks}))});
const passed=G.filter(x=>x.pass);
ok(passed.length>=1,'報告の条件で、条件をすべて満たす案を1つ以上組める');
ok(G.every(x=>x.mons[0]===G[0].mons[0]&&x.mons.length===6),'6匹そろい、最初の1匹はアブソル');

/* テスト1：速攻構築 */
const T1=await pg.evaluate(()=>{const r={};
  r.items=GEN.filter(R=>R.pass).every(R=>{const at=R.mons.map((p,i)=>({p,s:R.ss[i]})).filter(x=>kdIsAttacker(x.p,x.s));return at.some(x=>x.s.item==='choicescarf')&&at.some(x=>x.s.item==='focussash')});
  /* 速いアタッカーは、メガシンカの場合ごとに数える（上位の相手の半分より多くに先に動ける攻撃役） */
  r.perScen=GEN.filter(R=>R.pass).every(R=>{const q=R.V.req.find(x=>x.id==='rushFast');return q&&q.per&&q.per.length===2&&q.per.every(z=>z.n>=3)});
  /* 自分で数え直す：mvpEvalTeam の場合ごとに、z.fast が半分より多い攻撃役 */
  r.recount=GEN.filter(R=>R.pass).every(R=>{const E=mvpEvalTeam(R.mons.map((p,i)=>({no:p.no,set:toSaved(R.ss[i])})),FMT);
    return E.scen.every(sc=>{const f=R.mons.map((p,i)=>i).filter(i=>{const p=R.mons[i],z=sc.rows.map(x=>x.z[i]).filter(Boolean);const form=i===sc.u?megaOf(p.no,R.ss[i].item):p;
      return kdAtkN(R.ss[i])>=2&&prAtk(form)>=100&&z.filter(v=>v.fast).length/z.length>.5});return f.length>=3})});
  /* 報告の案2：スカーフ1匹だけでは「速攻」を満たしたことにしない */
  const X=REPORTED(),{tp,parts}=PARTS();const V=kdValidate(X.mons,X.ss,parts,tp,[X.mons[0].no]);
  const ri=V.req.find(x=>x.id==='rushItem');r.repItem=ri&&!ri.ok&&/1匹/.test(ri.detail);r.repPass=V.pass;window.REPV=V;
  return r});
ok(T1.items,'1 速攻：スカーフのアタッカーとタスキのアタッカーがいる');
ok(T1.perScen,'1 速攻：速いアタッカーを、メガシンカの場合ごとに3匹以上と確かめる');
ok(T1.recount,'1 速攻：数え直しても、どの場合も速いアタッカーが3匹以上');
ok(T1.repItem,'1 報告の案2：スカーフ1匹だけなので「スカーフ・タスキのアタッカー2匹以上」は満たしていないと出す');
ok(T1.repPass===false,'1 報告の案2は、条件をすべて満たした案とは出さない');

/* テスト2：先に動く手段 */
const T2=await pg.evaluate(()=>{const r={};const V=REPV;const q=V.req.find(x=>x.id==='prio');
  r.repNo=q&&!q.ok&&V.init.prio.length===0;
  r.repSep=V.init.scarf.some(x=>/アブソル/.test(x.txt))&&V.init.prio.length===0&&/先制技：なし/.test(q.detail)&&/こだわりスカーフ：アブソル/.test(q.detail);
  r.gen=GEN.filter(R=>R.pass).every(R=>R.ss.some(s=>s.moves.some(id=>MV[id]&&MV[id][5]>0&&MV[id][2]>0&&!['fakeout','firstimpression','feint'].includes(MD[id]&&MD[id][3]))));
  r.genSep=GEN.every(R=>R.V.initTxt.length===5&&/^先制技：/.test(R.V.initTxt[0])&&/^こだわりスカーフ：/.test(R.V.initTxt[1]));
  /* もともと速いだけの匹は先制技に数えない */
  r.fastNotPrio=GEN.every(R=>R.V.init.fast.every(x=>!R.ss[x.i].moves.some(kdPrioMv)||R.V.init.prio.some(y=>y.i===x.i)));
  return r});
ok(T2.repNo,'2 報告の案2：先制技が無いので「先に動く手段（先制技）」は満たしていない');
ok(T2.repSep,'2 先制技・スカーフを分けて数え、スカーフのアブソルを先制技に数えない');
ok(T2.gen,'2 組んだ案には、型の技に先制技（ねこだまし等を除く）が入っている');
ok(T2.genSep,'2 先制技・スカーフ・もともとの速さ・素早さ操作・素早さを上げる を分けて書く');
ok(T2.fastNotPrio,'2 もともと速い匹は、先制技を持たなければ先制技に数えない');

/* テスト3：弱点の受け合い（タイプ相性と耐久を分ける） */
const T3=await pg.evaluate(()=>{const r={};const V=REPV;
  const all=[V,...GEN.map(R=>R.V)].flatMap(v=>(v.cover||[]).flatMap(c=>c.types.flatMap(x=>x.cov)));
  r.noOkHigh=all.length>0&&all.every(c=>!(c.max>=50&&c.st==='ok'));
  r.someSoft=all.some(c=>c.st==='chip'||c.st==='no');
  /* 打たれ弱いアブソルがゲンガーの弱点を半減しても、ダメージが50%以上なら「受けられる」にしない */
  const ab=V.cover[0].types.filter(x=>x.weak.some(i=>V&&REPORTED().mons[i].n==='ゲンガー')).flatMap(x=>x.cov.filter(c=>c.i===0).map(c=>({t:x.t,...c})));
  r.absol=ab.length>0&&ab.every(c=>c.st!=='ok'||c.max===undefined||c.max<50);
  r.absolHigh=ab.some(c=>c.st==='chip'||c.st==='no');
  /* 受け出せる匹と、上から倒して返す匹は重ならない */
  r.roles=[V,...GEN.map(R=>R.V)].every(v=>!v.roles||v.roles.every(sc=>sc.out.every(o=>o.rk.every(j=>!o.sw.includes(j)))));
  /* 相性のいい順の理由も、打たれ弱い匹の半減には但し書きを付ける */
  const t=prScore(byNo[N('アブソル')],[byNo[N('ゲンガー')]]).R.filter(x=>x.k==='cover').map(x=>x.txt).join('／');r.prTxt=/打たれ弱い/.test(t)&&/タイプ相性上/.test(t);
  /* 理由の文：タイプ相性だけの半減は「受け出しは不安定」 */
  r.why=GEN.every(R=>Object.values(R.why).flat().every(w=>!/弱点の.+を受けられる/.test(w)||!/不安定/.test(w)));
  r.soft=REPV.req.find(x=>x.id==='resistReal');
  return {...r,soft:r.soft&&{ok:r.soft.ok,d:r.soft.detail}}});
ok(T3.noOkHigh,'3 半減でも、上位の相手の技で50%以上受けるなら「受けられる」にしない');
ok(T3.someSoft,'3 「受けると大きく削られる」「一撃で倒される」を分けて出す');
ok(T3.absolHigh,'3 報告の案2：アブソルはゲンガーの弱点をタイプ相性で半減しても、安定して受けられるとはしない');
ok(T3.roles,'3 受け出せる匹と、上から倒して返す匹を分ける');
ok(T3.prTxt,'3 相性のいい順の理由も、打たれ弱いアブソルには「タイプ相性上」「打たれ弱い」と書く');
ok(T3.soft&&(T3.soft.ok||/タイプ相性上は補完できますが、耐久面から安定した受け出しができるとは限りません/.test(T3.soft.d)),'3 耐久で受けられないときの言い方');

/* テスト4：型のまとまり */
const T4=await pg.evaluate(()=>{const r={};const legal=['learn','ab','item','atk0','choice','dup','setup','cls','itemreq'];
  r.sets=GEN.every(R=>R.mons.every((p,i)=>{const s=R.ss[i];return s&&kdIssues(p,s,{}).filter(x=>legal.includes(x.k)).length===0}));
  r.learn=GEN.every(R=>R.mons.every((p,i)=>R.ss[i].moves.every(id=>id===182||(LSD[p.no]||[0,[]])[1].includes(id))));
  r.items=GEN.every(R=>R.ss.every((s,i)=>!s.item||CH_ITEMS.has(s.item)||!!megaOf(R.mons[i].no,s.item))&&mvpDupItems(R.ss.map(s=>s.item)).length===0);
  r.src=GEN.every(R=>R.ss.every((s,i)=>['data','theory'].includes(s.src)&&s.srcTxt&&(s.src!=='data'||!!mvpRowOf(FMT,R.mons[i].no,isStone(s.item)?s.item:null)||!!mvpRowOf(FMT,R.mons[i].no,null))));
  r.fmtTxt=GEN.every(R=>R.ss.every(s=>s.src!=='data'||/シングル/.test(s.srcTxt)&&!/ダブル/.test(s.srcTxt)));
  /* 1つずつは正しくても、まとまりとしておかしい型は見つける（つるぎのまい＋特殊技だけ・おくびょうに物理技・スカーフに変化技・働く技の無いものしりメガネ） */
  const g=byNo[N('ゲッコウガ')],a=byNo[N('アブソル')],pr=byNo[N('アシレーヌ')];
  const k=(p,s)=>kdIssues(p,{ab:(ABD[p.no]||[])[0][0],sp:[...MVP_SP.spec],up:5,dn:1,src:'theory',...s},{}).map(x=>x.k);
  r.bad=k(g,{item:'lifeorb',moves:['つるぎのまい','ハイドロポンプ','あくのはどう','れいとうビーム'].map(MID)}).includes('setup')
    &&k(g,{item:'lifeorb',moves:['ハイドロポンプ','あくのはどう','れいとうビーム','とんぼがえり'].map(MID)}).includes('cls')
    &&k(a,{item:'choicescarf',sp:[...MVP_SP.phys],up:5,dn:3,moves:['じごくづき','ふいうち','つるぎのまい','まもる'].map(x=>x==='まもる'?182:MID(x))}).includes('choice')
    &&k(pr,{item:'wiseglasses',sp:[...MVP_SP.phys],up:1,dn:3,moves:['アクアジェット','じゃれつく','アクアブレイク','つるぎのまい'].map(MID)}).includes('itemreq');
  /* 決まりに合う組み合わせは、勝手に「おかしい」としない（ものしりメガネ＋シャドーボール、オボンのみ＋ゴールドラッシュ、たつじんのおび＋かわらわり） */
  const X=REPORTED();r.okSets=[3,4,2].every(i=>kdIssues(X.mons[i],X.ss[i],{}).length===0);
  /* 直したところを型に書く */
  r.fixes=GEN.every(R=>R.ss.every(s=>Array.isArray(s.fixes)));
  /* ダブルの使用データはダブルの行だけ（シングルと混ぜない） */
  const keep=FMT;FMT='double';try{const s=kdMakeSet(byNo[N('ゲンガー')],null,null,['taimen'],new Set(),{off:true});r.dbl=s.src==='data'?/ダブル/.test(s.srcTxt)&&!/シングル/.test(s.srcTxt):true;
    const s2=kdMakeSet(byNo[N('ゲンガー')],'gengarite',null,['taimen'],new Set(),{off:true});const row=mvpRowOf('double',N('ゲンガー'),'gengarite');
    r.dblRow=s2.src==='data'?!!row&&s2.moves.every(id=>row.mv.some(([k])=>MVKA[nrm(k)]===id)||s2.fixes.length>0):true}finally{FMT=keep}
  return r});
ok(T4.sets,'4 組んだ型に、覚えない技・持てない特性/持ち物・スカーフの変化技・積み技や性格の食い違い・働かない持ち物が無い');
ok(T4.learn,'4 技はすべて覚える技');ok(T4.items,'4 持ち物はゲームにあるもの・自分のメガストーンで、同じ持ち物は無い');
ok(T4.src,'4 型ごとに「使用データの型／理論上の型」と出どころを書く（使用データの型は同じ形式の行がある）');
ok(T4.fmtTxt,'4 シングルで組んだ使用データの型は、シングルの集計と書く');
ok(T4.bad,'4 まとまりとしておかしい型を見つける（積み技の食い違い・性格の食い違い・スカーフの変化技・ものしりメガネ）');
ok(T4.okSets,'4 決まりに合う組み合わせ（メガネ＋シャドーボール等）は、勝手におかしいとしない');
ok(T4.fixes,'4 直したところを型に残す');ok(T4.dbl&&T4.dblRow,'4 ダブルではダブルの使用データだけを使う');

/* テスト5：メガシンカの場合 */
const T5=await pg.evaluate(()=>{const r={};
  r.two=GEN.every(R=>R.ss.filter((s,i)=>s.item&&megaOf(R.mons[i].no,s.item)).length===2);
  r.scen=GEN.every(R=>R.V.scens.length===2);
  /* 計算でメガの姿になるのは、どの場合も1匹だけ */
  r.one=GEN.every(R=>{const E=mvpEvalTeam(R.mons.map((p,i)=>({no:p.no,set:toSaved(R.ss[i])})),FMT);return E.st==='ok'&&E.scen.length===2&&E.scen.every(sc=>sc.megaIdx.length===1)});
  r.sameScen=GEN.every(R=>{const S=kdScens(R.mons,R.ss);return S.every(sc=>sc.form.filter((f,i)=>f!==R.mons[i]).length===1&&sc.sets.filter(s=>s&&s.item&&isStone(s.item)).length===1)});
  r.txt=GEN.every(R=>/1試合でメガシンカできるのは1匹だけ/.test(R.V.req.find(x=>x.id==='mega').detail));
  return r});
ok(T5.two,'5 メガストーンを持つ匹が2匹');ok(T5.scen,'5 メガシンカする匹ごとに、2つの場合を確かめる');
ok(T5.one,'5 どの場合も、メガの姿で計算するのは1匹だけ');ok(T5.sameScen,'5 確かめの姿：メガシンカしない方のメガストーンは働かない');
ok(T5.txt,'5 メガシンカは1試合に1匹と書く');

/* テスト6：最後に確かめた結果と、画面の表示 */
const T6=await pg.evaluate(()=>{const r={};
  r.same=GEN.every(R=>{const {tp,parts}=PARTS();const V=kdValidate(R.mons,R.ss,parts,tp,kdMust());return V.pass===R.pass&&JSON.stringify(V.req.map(x=>[x.id,x.ok]))===JSON.stringify(R.V.req.map(x=>[x.id,x.ok]))});
  r.checks=GEN.every(R=>JSON.stringify(R.checks)===JSON.stringify(R.V.req.map(x=>[x.label,x.ok])));
  /* 満たしていない条件は ✓ で出さない（報告の案2を画面の部品に通す） */
  const X=REPORTED();const R={...X,why:{},checks:REPV.req.map(x=>[x.label,x.ok]),V:REPV,pass:REPV.pass};
  const d=document.createElement('div');d.innerHTML=kdDetailHTML(R);const t=d.textContent;
  r.ng=REPV.req.filter(x=>!x.ok).every(x=>t.includes('△ '+x.label)&&!t.includes('✓ '+x.label));
  r.warn=/満たしていません/.test(t);
  return r});
ok(T6.same,'6 6匹と型が決まってから、もう一度確かめても同じ結果');
ok(T6.checks,'6 画面の ✓/△ は最後の確かめの結果そのもの');
ok(T6.ng&&T6.warn,'6 満たしていない条件は ✓ で出さず、満たしていないと書く');

/* 画面：#/pair/kd で組んで、案を開く（390px） */
await pg.evaluate(()=>{KD_CASE();try{sessionStorage.setItem('pcprmode','kd')}catch(e){}location.hash='#/pair/kd'});
await pg.waitForTimeout(900);
await pg.evaluate(()=>{PR_MODE='kd';prDraw()});await pg.waitForTimeout(300);
await pg.click('#kd-go');
await pg.waitForFunction(()=>document.querySelector('[data-kd-open="0"]'),null,{timeout:120000});
await pg.click('[data-kd-open="0"]');await pg.waitForTimeout(300);
const UI=await pg.evaluate(()=>{const t=document.getElementById('kd-res').textContent;return{chk:/条件ごとの確かめ方と結果/.test(t),src:/使用データの型|理論上の型/.test(t),prio:/先に動く手段のくわしい内訳/.test(t),mega:/1試合に1匹/.test(t),over:document.body.scrollWidth>innerWidth+1,
  pass:KD.res.list[0].pass,noFalseOk:KD.res.list[0].V.req.filter(x=>!x.ok).every(x=>!t.includes('✓ '+x.label))}});
ok(UI.chk&&UI.src&&UI.prio&&UI.mega,'画面：条件の確かめ・型の出どころ・先に動く手段・メガシンカの場合を出す');
ok(UI.noFalseOk,'画面：満たしていない条件を ✓ にしない');ok(!UI.over,'画面：390px ではみ出さない');
ok(UI.pass,'画面：案1は条件をすべて満たす案');
await pg.screenshot({path:path.join(ROOT,'out','kodawari-390.png'),fullPage:false}).catch(()=>{});

ok(!errs.length,'ページのエラーなし '+errs.join(' / '));
await b.close();
console.log(`kodawari: ${bad?'NG':'OK'}（${n}項目）`);
if(bad)process.exit(1);
