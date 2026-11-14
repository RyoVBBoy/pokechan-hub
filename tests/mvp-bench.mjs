// 入れかえ案の第3段階のベンチマーク（2026/11/14、docs/party-building-phase3-audit.md・docs/party-building-phase3-report.md）
// ・パーティの組み合わせは試験用の仮のもの（実在の大会のパーティではない。強さの証拠ではない）。
// ・各匹の育成は PokéKit（Smogon / Pokémon Showdown の集計、75-mvp-data.js の版）の型をそのまま登録したもの（作った型ではない）。
//   ただし能力ポイントは MVP_SP の仮定（集計の evs は使わない）。
// ・期待する動き（expect）が守られているかを確かめる。結果は MVP_BENCH_OUT に JSON で書ける（手で見直すため）。
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
let n=0,bad=0;const ok=(c,m)=>{n++;if(!c){bad++;console.error('NG',m)}};
const ctx=await b.newContext({locale:'ja-JP',viewport:{width:390,height:844}});
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.route(/^https?:/,r=>r.abort());
await pg.goto('file://'+path.join(ROOT,'dist/index.html'));await pg.waitForTimeout(600);

const OUT=await pg.evaluate(()=>{
  const N=s=>{const p=P.find(x=>x.n===s);if(!p)throw new Error('名前が無い '+s);return p.no};
  const megaRow=(f,n)=>mvpRows(f).rows.find(x=>x.mega&&byNo[x.mega].n===n);
  /* 集計の型を登録した匹。メガの名前ならその行（元の姿＋メガストーン） */
  const pk=(f,name)=>{let no,stone=null;const m=megaRow(f,name);if(m){no=m.no;stone=m.stone}else no=N(name);
    const S=mvpSet(f,no,{stone,anyMv:true,anyLegal:true});if(S.st!=='ok')throw new Error(`集計の型が無い ${f} ${name} ${S.st}`);return{no,sel:false,set:{...S.sv}}};
  const mk=(f,names)=>names.map(x=>typeof x==='string'?pk(f,x):x);
  const nmOf=no=>byNo[no].n;
  const crit=s=>s.weak.filter(w=>w.crit).length;
  const ver=MVP_DATA.version;
  const cases=[];
  /* 1つの場面を計算して記録する */
  const run=(id,fmt,title,T,expect,check,opt)=>{
    const t0=performance.now();let R;try{R=mvpSwaps(T,fmt,opt)}catch(e){R={st:'error',why:String(e&&e.stack||e)}}
    const ms=Math.round(performance.now()-t0);
    const top=R.st==='ok'&&(R.better[0]||R.trade[0]);
    const rec={id,fmt,title,ruleset:ver,source:mvpSrcTxt(fmt),party:T.map(x=>nmOf(x.no)),
      partyBuild:'PokéKit の型（能力ポイントは仮定）',st:R.st,ms,
      before:R.st==='ok'?R.E0.scen.map(s=>`${s.label}：大きな弱点${crit(s)}件`):[],
      candidate:top?`${nmOf(T[top.i].no)} → ${nmOf(top.c.r.mega||top.c.r.no)}（${top.st==='better'?'おすすめ':'良くなる所と悪くなる所がある'}）`:'なし',
      candidateBuild:top?top.S.txt:'',
      after:top?top.C.pairs.map(p=>`${p.b.label}：大きな弱点${p.c1}件`):[],
      reasons:top?top.C.pairs.flatMap(p=>p.fixed.filter(w=>w.crit).map(w=>`${w.op.n}：${MVP_WK[w.k]}`)).slice(0,6):[],
      newWeak:top?top.C.pairs.flatMap(p=>p.made.map(w=>`${w.op.n}：${MVP_WK[w.k]}`)).slice(0,6):[],
      lostRoles:top&&top.C.roles?top.C.roles.lost.map(r=>r.n):[],
      counts:R.st==='ok'?{better:R.better.length,trade:R.trade.length,excluded:R.excluded.length+R.conflict.length}:null,
      expect,review:'未確認（手で見直していない）'};
    let res;try{res=check(R)}catch(e){res=[[false,'確かめの途中のエラー '+String(e&&e.message||e)]]}
    rec.actual=res.map(([c,m])=>`${c?'OK':'NG'} ${m}`);cases.push(rec);return R;
  };
  const betterSafe=R=>R.better.every(x=>x.C.cf>0&&x.C.cm===0&&x.C.pairs.every(p=>p.n1<=p.n0));
  const legalOnly=R=>[...R.better,...R.trade].every(x=>mvpLegal(x.c.r.no).st==='ok'&&(!x.c.r.stone||mvpStoneSt(x.c.r.stone,x.c.r.no)==='ok'));
  const noDupItem=R=>[...R.better,...R.trade].every(x=>{const it=x.S.sv.it&&x.S.sv.it.k;return !it||!x.E1.mem.some((m,k)=>k!==x.i&&m.item===it)});

  /* B01 シングル：ふつうのパーティ */
  const S_BAL=mk('single',['ドドゲザン','ガオガエン','ゴリランダー','ブリジュラス','カバルドン','アシレーヌ']);
  run('B01','single','ふつうのパーティ',S_BAL,'おすすめは大きな弱点を減らし、増やさない。使えると確認した匹だけ。持ち物は重ならない',R=>[
    [R.st==='ok','計算できる'],[betterSafe(R),'おすすめは大きな弱点を減らし増やさない'],[legalOnly(R),'使えると確認した匹・メガストーンだけ'],[noDupItem(R),'持ち物が重ならない']]);
  /* B02 同じ弱点が重なる（じめんが弱点の匹が多い） */
  run('B02','single','じめんが弱点の匹が多い',mk('single',['サーフゴー','ブリジュラス','ドドゲザン','キラフロル','ゴウカザル','ガオガエン']),
    '大きな弱点がある。おすすめで減ったとする弱点は、変更後に本当に無い',R=>[
    [R.st==='ok'&&R.E0.scen.some(s=>crit(s)>0),'大きな弱点が見つかる'],
    [[...R.better,...R.trade].every(x=>x.C.pairs.every(p=>p.fixed.every(w=>!p.b.weak.some(v=>v.key===w.key)))),'減った弱点は変更後に無い'],[betterSafe(R),'おすすめは増やさない']]);
  /* B03 受けられる匹が少ない（攻撃に偏った6匹） */
  run('B03','single','攻撃に偏った6匹',mk('single',['ドラパルト','オオニューラ','マスカーニャ','ガブリアス','ウルガモス','ドドゲザン']),
    '交代で受けられる匹がいない相手（nosw）が見つかる',R=>[[R.st==='ok'&&R.E0.scen.some(s=>s.weak.some(w=>w.k==='nosw')),'受けられない相手が見つかる'],[betterSafe(R),'おすすめは増やさない']]);
  /* B04 攻撃の範囲が狭い（受け寄りの6匹） */
  run('B04','single','受け寄りで攻撃の範囲が狭い',mk('single',['カバルドン','ラグラージ','ブリムオン','オーロンゲ','エンペルト','ミミズズ']),
    '削れない相手（nohit）か、有利な匹がいない相手（none）が見つかる',R=>[[R.st==='ok'&&R.E0.scen.some(s=>s.weak.some(w=>w.k==='nohit'||w.k==='none')),'攻めの弱点が見つかる'],[betterSafe(R),'おすすめは増やさない']]);
  /* B05 役わりが重なる：トリックルームの使い手が2匹。1匹を外しても「失われる役わり」にしない */
  const S_TR2=mk('single',['ブリムオン','イエッサン（メス）','カバルドン','ドドゲザン','ガオガエン','アシレーヌ']);
  run('B05','single','トリックルームの使い手が2匹（重なり）',S_TR2,
    'トリックルームの使い手の1匹を外しても、もう1匹いるので「失われる役わり」にトリックルームを出さない',R=>{
      const tr=[...R.better,...R.trade].filter(x=>x.i<=1);
      return [[R.st==='ok','計算できる'],[!!(R.E0.roles&&R.E0.roles[0].some(r=>r.k==='trickroom')&&R.E0.roles[1].some(r=>r.k==='trickroom')),'2匹ともトリックルームを数える'],
        [tr.every(x=>!(x.C.roles&&x.C.roles.lost.some(r=>r.k==='trickroom'))),'もう1匹いるのでトリックルームは失われない']]});
  /* B06 1匹のメガシンカに頼る：メガボーマンダだけ */
  const S_MEGA=mk('single',['メガボーマンダ','ガオガエン','ゴリランダー','ブリジュラス','カバルドン','アシレーヌ']);
  run('B06','single','メガシンカできるのはボーマンダだけ',S_MEGA,'ボーマンダを外す案には「メガシンカできる匹がいなくなる」を必ず出す',R=>{
    const out=[...R.better,...R.trade].filter(x=>x.i===0&&!x.c.r.stone);
    return [[R.st==='ok'&&R.E0.scen.length===1&&R.E0.scen[0].key==='mega:'+S_MEGA[0].no,'メガの場合が1つ'],[out.length>0,`ボーマンダを外す案がある（${out.length}件）`],
      [out.every(x=>x.C.lastMegaLost&&/メガシンカできる匹がいなくなります/.test(mvpCardHTML(x,9))),'メガが無くなる案に警告']]});
  /* B07 大事な役わりを外す：トリックルームの使い手が1匹だけ */
  const S_TR1=mk('single',['ブリムオン','カバルドン','ドドゲザン','ガオガエン','ラグラージ','アシレーヌ']);
  run('B07','single','トリックルームの使い手が1匹だけ',S_TR1,'ブリムオンを外す案はおすすめにせず、失われる役わり「トリックルーム」を出す',R=>{
    const out=[...R.better,...R.trade].filter(x=>x.i===0);
    return [[R.st==='ok','計算できる'],[out.length>0,`ブリムオンを外す案がある（${out.length}件）`],[R.better.every(x=>x.i!==0),'ブリムオンを外す案はおすすめにしない'],
      [out.every(x=>x.C.roles&&x.C.roles.lost.some(r=>r.k==='trickroom')&&/トリックルーム/.test(mvpCardHTML(x,9))),'失われる役わりを出す']]});
  /* B08 1つ良くなり、ほかが悪くなる */
  run('B08','single','良くなる所と悪くなる所がある案',S_BAL,'悪くなる案はおすすめに入れず、新しくできる弱点を相手の名前つきで出す',R=>{
    const tr=R.trade;return [[tr.length>0,'そういう案がある（この場面で）'],[tr.every(x=>!R.better.includes(x)),'おすすめに入れない'],
      [tr.every(x=>{const h=mvpCardHTML(x,9);return x.C.pairs.every(p=>!p.made.length||/新しくできる弱点/.test(h))}),'新しい弱点を出す']]});
  /* B09 データが足りない・未確認の匹 */
  const viv=P.find(p=>mvpLegal(p.no).st==='unverified');
  run('B09','single','未確認の匹がいるパーティ',[{no:viv.no,sel:false},...S_BAL.slice(1)],
    'パーティの未確認の匹に注意を出す。未確認・データ不足の候補は出さず、理由つきで分ける',R=>[
    [R.st==='ok'&&/未確認/.test(mvpWeakHTML(R.E0))&&/M-C/.test(mvpWeakHTML(R.E0)),'パーティの未確認の匹に注意'],
    [R.excluded.some(x=>x.st==='unverified'&&x.why)&&R.excluded.some(x=>(x.st==='insufficient'||x.st==='nodata')&&x.why),'未確認・データ不足を理由つきで分ける'],
    [legalOnly(R),'候補は確認した匹だけ']]);
  /* B10 ダブル：シングルと分ける（先にシングルを計算しても同じ結果） */
  const D_BAL=mk('double',['オオニューラ','ガオガエン','リキキリン','ペリッパー','ゴリランダー','ウルガモス']);
  const sumE=E=>JSON.stringify(E.scen.map(s=>s.rows.map(r=>[r.op.key,r.z.map(z=>z&&[z.r,z.sw,z.recv,z.oh,z.hit])])));
  MVP_MC.clear();const dOnly=sumE(mvpEvalTeam(D_BAL,'double'));MVP_MC.clear();mvpEvalTeam(D_BAL,'single');const dAfter=sumE(mvpEvalTeam(D_BAL,'double'));
  run('B10','double','ダブルのパーティ',D_BAL,'ダブルの相手・型だけ。シングルを先に計算しても結果が変わらない。見ていないことをいつも見える所に書く',R=>[
    [R.st==='ok'&&R.fmt==='double','計算できる'],[dOnly===dAfter,'シングルの結果が混ざらない'],
    [(()=>{const d=document.createElement('div');d.innerHTML=mvpResultHTML(R);const e=d.querySelector('.mvp-dbl');return !!e&&!e.closest('details')&&/ねこだまし/.test(e.textContent)})(),'見ていないことがたたまずに見える所にある'],[betterSafe(R),'おすすめは増やさない']]);
  /* B10b ダブル：おいかぜの使い手が1匹だけ */
  const D_TW=mk('double',['エルフーン','ガオガエン','オオニューラ','ゴリランダー','ウルガモス','ペリッパー']);
  /* ペリッパーもおいかぜを使うので、エルフーンを外しても失われない。ペリッパーを外した版で1匹だけにする */
  const D_TW1=mk('double',['エルフーン','ガオガエン','オオニューラ','ゴリランダー','ウルガモス','リキキリン']);
  run('B10b','double','おいかぜの使い手が1匹だけ',D_TW1,'エルフーンを外す案はおすすめにしない（素早さの操作を失う）',R=>{
    const out=[...R.better,...R.trade].filter(x=>x.i===0);
    return [[R.st==='ok','計算できる'],[out.length>0,`エルフーンを外す案がある（${out.length}件）`],[R.better.every(x=>x.i!==0),'おすすめにしない'],[out.every(x=>x.C.roles&&x.C.roles.lost.some(r=>r.k==='tailwind')),'失われる役わり']]});
  /* B11 メガの匹を別のメガの匹に替える：その2つの場合を比べる */
  const sal=megaRow('single','メガボーマンダ'),luc=megaRow('single','メガルカリオZ'),gar=megaRow('single','メガガブリアスZ');
  const S_MM=mk('single',['メガボーマンダ','メガルカリオZ','ガオガエン','ゴリランダー','ブリジュラス','アシレーヌ']);
  const E0=mvpEvalTeam(S_MM,'single'),T1=S_MM.map((x,k)=>k===1?pk('single','メガガブリアスZ'):x),E1=mvpEvalTeam(T1,'single');
  const C11=mvpCompare(E0,E1,luc.no,gar.no);
  cases.push({id:'B11',fmt:'single',title:'メガの匹を別のメガの匹に替える',ruleset:ver,source:mvpSrcTxt('single'),party:S_MM.map(x=>nmOf(x.no)),candidate:'ルカリオ → ガブリアス（メガガブリアスZ）',
    expect:'外す匹のメガの場合と、入れる匹のメガの場合を比べる',before:E0.scen.map(s=>`${s.label}：${crit(s)}件`),after:E1.scen.map(s=>`${s.label}：${crit(s)}件`),
    actual:[`${C11.pairs.some(p=>p.a.key==='mega:'+luc.no&&p.b.key==='mega:'+gar.no)?'OK':'NG'} メガルカリオZ↔メガガブリアスZを比べる`,`${C11.pairs.some(p=>p.a.key==='mega:'+sal.no&&p.b.key==='mega:'+sal.no)?'OK':'NG'} 残るメガどうしも比べる`],review:'未確認（手で見直していない）'});
  /* B12 入口ごとの食い違い：チェック・改善案・敗因の診断の入れかえ案は、入れかえ案の計算で新しい大きな弱点を作らない */
  const T12=['ドドゲザン','ガオガエン','ゴリランダー','ブリジュラス','カバルドン','アシレーヌ'].map(n=>({no:N(n),sel:false}));
  const keep=team.slice();team.length=0;T12.forEach(x=>team.push(x));const prevFmt=FMT;
  const chk=[];let drops=0;
  try{
    const E=mvpEvalTeam(T12,FMT);const cm=(es,i)=>mvpCompare(E,mvpEvalTeam(es,FMT),T12[i].no,es[i].no).cm;
    DG_FIX.clear();const D=dgDefSwaps(T12);drops+=D.mvpDrop||0;D.forEach(d=>chk.push(['チェック',`${nmOf(T12[d.i].no)}→${d.c.n}`,cm(T12.map((x,k)=>k===d.i?{no:d.c.no,sel:false,set:d.S.sv}:x),d.i)]));
    const I=dgImprove(T12);drops+=(I.dropped||[]).filter(d=>/入れかえ案の計算/.test(d.loss)).length;(I.list||[]).filter(o=>o.kind==='swap').forEach(o=>chk.push(['改善案',o.title,cm(o.entries,o.i)]));
    const L=loseReasons(T12);L.forEach(x=>drops+=x.gDrop||0);L.filter(x=>x.plans).forEach(x=>x.plans.forEach(p=>{const i=p.out?T12.findIndex(t=>t.no===p.out.p.no):-1;if(i>=0)chk.push(['敗因の診断',`${nmOf(T12[i].no)}→${p.c.q.n}`,cm(T12.map((x,k)=>k===i?{no:p.c.q.no,sel:false,set:p.S.sv}:x),i)])}));
  }finally{team.length=0;keep.forEach(x=>team.push(x))}
  cases.push({id:'B12',fmt:FMT,title:'入口ごとの食い違い',ruleset:ver,source:mvpSrcTxt(FMT),party:T12.map(x=>nmOf(x.no)),partyBuild:'育成なし（推定の型）',
    expect:'チェック・改善案・敗因の診断の入れかえ案は、入れかえ案の計算で新しい大きな弱点を作らない（作る案は出さない）',
    candidate:chk.map(c=>`${c[0]}：${c[1]}（新しい大きな弱点${c[2]}件）`).join('／')||'なし',
    actual:[`${chk.every(c=>c[2]===0)?'OK':'NG'} どの入口の案も新しい大きな弱点を作らない（出した案${chk.length}件）`,`${drops>0?'OK':'NG'} 悪くなる案を出さなかったことを数える（${drops}件。この場面では直す前に5案が悪くなる案だった）`],
    dropped:drops,review:'未確認（手で見直していない）'});
  /* B14 天気：得をする仲間がいる天気は大事な役わり、いない天気（カバルドンのすなおこしだけ）は大事な役わりにしない */
  const R14a=mvpSwaps(S_BAL,'single');const hipOut=[...R14a.better,...R14a.trade].filter(x=>x.i===4);
  const S_SUN=mk('single',['コータス','フシギバナ','ガオガエン','ブリジュラス','ドドゲザン','ゴリランダー']);
  const R14b=mvpSwaps(S_SUN,'single');const sunOut=[...R14b.better,...R14b.trade].filter(x=>x.i===0);
  cases.push({id:'B14',fmt:'single',title:'天気の役わり',ruleset:ver,source:mvpSrcTxt('single'),party:S_SUN.map(x=>nmOf(x.no)),partyBuild:'PokéKit の型（能力ポイントは仮定）',
    expect:'ようりょくそのフシギバナがいるとき、ひでりのコータスを外す案はおすすめにしない。すなあらしで得をする仲間のいないカバルドン（B01）を外すことは、大事な役わりの喪失にしない',
    candidate:`B01 でカバルドンを外す案${hipOut.length}件／コータスを外す案${sunOut.length}件`,lostRoles:sunOut[0]&&sunOut[0].C.roles?sunOut[0].C.roles.lost.map(r=>r.n):[],
    actual:[`${hipOut.length>0&&hipOut.every(x=>!x.C.roleLoss)?'OK':'NG'} カバルドンのすなおこしは大事な役わりにしない（${hipOut.length}件）`,
      `${mvpAbK(S_SUN[1].set.ab.k)==='chlorophyll'?'OK':'NG'} フシギバナの集計の型はようりょくそ`,
      `${sunOut.length>0&&sunOut.every(x=>x.C.roleLoss&&x.st!=='better')?'OK':'NG'} 晴れで得をする仲間がいるので、ひでりを失う案はおすすめにしない（${sunOut.length}件）`],review:'未確認（手で見直していない）'});
  /* B13 同じ入力で同じ結果（覚えを消しても・行の並びを逆にしても） */
  const sig=X=>JSON.stringify([X.better.map(x=>[x.i,x.c.r.no,x.c.r.stone,x.C.cf,x.C.cm]),X.trade.map(x=>[x.i,x.c.r.no]),X.E0.scen.map(s=>s.weak.map(v=>v.key))]);
  const a1=sig(mvpSwaps(S_BAL,'single'));MVP_MC.clear();for(const k in MVP_OPPC)delete MVP_OPPC[k];
  const kr=MVP_ROWS.single;MVP_ROWS.single={...kr,rows:[...kr.rows].reverse()};let a2;try{a2=sig(mvpSwaps(S_BAL,'single'))}finally{MVP_ROWS.single=kr}
  MVP_MC.clear();mvpSwaps(S_BAL,'double');const a3=sig(mvpSwaps(S_BAL,'single'));
  cases.push({id:'B13',fmt:'single',title:'同じ入力で同じ結果',ruleset:ver,party:S_BAL.map(x=>nmOf(x.no)),expect:'覚えを消しても、行の並びを逆にしても、ダブルを先に計算しても同じ',
    actual:[`${a1===a2?'OK':'NG'} 並びを逆に`,`${a1===a3?'OK':'NG'} ダブルを先に計算`],review:'—'});
  return cases;
});
for(const c of OUT){for(const a of c.actual||[])ok(a.startsWith('OK'),`${c.id} ${c.title}：${a}`)}
ok(!errs.length,'ページのエラーなし '+errs.join(' / '));
if(process.env.MVP_BENCH_OUT)fs.writeFileSync(process.env.MVP_BENCH_OUT,JSON.stringify(OUT,null,1));
await b.close();
console.log(`mvp-bench: ${bad?'NG':'OK'}（${OUT.length}場面・${n}項目${bad?`・${bad}件NG`:''}）`);
if(bad)process.exitCode=1;
