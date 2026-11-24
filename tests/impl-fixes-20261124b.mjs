// 2026/11/24（2回目の直し）の回帰テスト。第9世代の参照（Pokémon Showdown・@smogon/calc 0.12.0）と依頼主がゲーム内で確かめた決まりに合わせたもの。
// チャンピオンズの実機で確かめたことにはしない。
// ①ちからずく（技ごとの表・威力1.3倍・追加効果のある技だけ・いのちのたまの反動）②かたやぶり×がんじょう×一撃必殺 ③タスキ/がんじょうの条件つきの耐え
// ④回数を仮定した連続技に印 ⑤メテオビームの2回目から ⑥能力補正の印 ⑦3ぼんのや ⑧トリックルームは技に入っている匹だけ
// ⑨選出：メガストーン2匹でも選出に入り、1匹ずつメガ ⑩1匹から組むの型の確かめ ⑪改善案のメガの候補
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const pg=await (await b.newContext({locale:'ja-JP'})).newPage();
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.route(/^https?:/,r=>r.abort());
await pg.goto('file://'+path.join(ROOT,'dist/index.html')+'#/team');await pg.waitForTimeout(800);
let n=0,bad=0;const ok=(c,m,info)=>{n++;if(!c){bad++;console.error('NG',m,info===undefined?'':JSON.stringify(info))}};
const R=await pg.evaluate(()=>{const o={};const id=k=>+Object.keys(MD).find(i=>MD[i][3]===k);
  const mon=(no,side,ab,extra)=>mkMon(byNo[no],side,{ab,item:null,moves:[],sp:[2,32,0,32,0,32],up:1,dn:3,...(extra||{})});
  /* ① ちからずく */
  const lb=mon(534,'me','sheer-force'),lg=mon(534,'me','guts'),sn=mon(143,'op','thick-fat',{sp:[32,0,32,0,2,0],up:2,dn:3});
  const dm=(a,k)=>bcalc(a,mvObj(id(k)),sn,{r:100}).dmg;
  o.sf={ice:[dm(lb,'icepunch'),dm(lg,'icepunch')],cc:[dm(lb,'closecombat'),dm(lg,'closecombat')],mach:[dm(lb,'machpunch'),dm(lg,'machpunch')],
    size:SF_SEC.size,generic:Object.keys(MVE).filter(i=>MVE[i].o&&!SF_SEC.has(MD[i]&&MD[i][3])).length,
    fd:SF_SEC.has('freezedry'),scale:SF_SEC.has('scaleshot'),fc:SF_SEC.has('flamecharge'),eshot:[SF_SEC.has('electroshot'),sfOn(lb,mvObj(id('electroshot'))),sfSup(lb,mvObj(id('electroshot')))],
    lo:[sfSup(lb,mvObj(id('icepunch'))),sfSup(lb,mvObj(id('closecombat'))),sfSup(lg,mvObj(id('icepunch')))],
    unimpl:CALC_UNIMPL.includes('sheer-force'),impl:ABIMPL.has('sheer-force')};
  /* ② かたやぶり×がんじょう×一撃必殺 */
  const st=mon(306,'op','sturdy'),gm=mvObj(id('fissure'))||mvObj(id('guillotine'))||mvObj(id('horndrill'))||mvObj(id('sheercold'));
  o.ohko=gm?[fixedDmg(mon(143,'me','thick-fat'),gm,st),fixedDmg(mon(143,'me','mold-breaker'),gm,st)===st.hp]:null;
  /* ③ タスキの条件つきの耐え：一撃で倒せる相手に、タスキがあれば1回目は耐える前提、ないときの確率も出す */
  const big=mon(445,'me','rough-skin'),thin=mkMon(byNo[94]||byNo[445],'op',{ab:'cursed-body',item:'focussash',moves:[],sp:[0,0,0,0,0,0],up:-1,dn:-1});
  const eq=mvObj(id('earthquake'));const r0=dmgRolls(big,eq,thin,{}),k0=koInfo(r0,thin.hp);
  thin.item=null;const r1=dmgRolls(big,eq,thin,{}),k1=koInfo(r1,thin.hp);thin.item='focussash';thin.hp=thin.max-1;const k2=koInfo(dmgRolls(big,eq,thin,{}),thin.hp);
  o.sash={withSash:k0,without:k1,notFull:k2,raw:Math.min(...r1)>=thin.max,note:calcNotes({a:big,d:{...thin,hp:thin.max},mv:eq,n:1,ko:k0,r:r0}).some(t=>/きあいのタスキ/.test(t)&&/条件つき/.test(t))};
  /* ④ 回数が決まらない連続技（ロックブラスト）は、回数を選ばなければ仮定の印 */
  const rb=mvObj(id('rockblast'));const ra=dmgRolls(big,rb,sn,{}),rs=dmgRolls(big,rb,sn,{hits:5});
  const sl=mon(214,'me','skill-link');
  o.mh={hc:koInfo(ra,sn.hp).hitCounts,chosen:koInfo(rs,sn.hp).hitCounts||null,skill:koInfo(dmgRolls(sl,rb,sn,{}),sn.hp).hitCounts||null,label:koLabel(koInfo(ra,sn.hp)),plain:koPlain(koInfo(ra,sn.hp)),distSum:ra.dist.reduce((t,x)=>t+x[1],0),lo:ra.dist[0][0],hi:ra.dist[ra.dist.length-1][0],two:bhits(big,rb,sn,{r:85,nHits:2}).total,five:bhits(big,rb,sn,{r:100,nHits:5}).total};
  /* ⑤ メテオビーム：2回目は特攻+2 */
  const mb=mvObj(id('meteorbeam')),sa=mon(143,'me','thick-fat',{sp:[2,0,0,32,0,32],up:3,dn:1}),sd=mon(143,'op','thick-fat',{sp:[0,0,0,0,0,0],up:-1,dn:-1});
  const m0=bcalc(sa,mb,sd,{r:100,useN:0}).dmg,m1=bcalc(sa,mb,sd,{r:100,useN:1}).dmg,dmr=dgMove(sa,mb,sd);
  o.mb={m0,m1,seqUp:dmr.seqMin[1]>dmr.seqMin[0],nNew:duTurns(dmr.min,{mv:mb,acc:100,f:dmr.fmin,seq:dmr.seqMin},sa,sd),manual:(()=>{let t=0,k=0;while(t<100&&k<9){t+=dmr.seqMin[Math.min(k,5)];k++}return k*2})(),first:dmr.fmin,s0:dmr.seqMin[0],
    calcNext:dmgRolls(sa,mb,sd,{}).nexts[0][15]===m1};
  /* ⑥ 能力補正の印 */
  const pp=byNo[445];/* base atk 130: 130+0+20=150 → 10で割り切れる */
  o.mark={red:natMark(pp,[0,0,0,0,0,0],1,3,1),noRed:natMark(pp,[0,1,0,0,0,0],1,3,1),hp:natMark(pp,[0,0,0,0,0,0],0,3,0),
    blueOk:(()=>{const sp=[0,0,0,0,0,0];for(let v=0;v<=10;v++){sp[3]=v;if((pp.s[3]+v+20)%10===1)return natMark(pp,sp,1,3,3)}return 'none'})(),noBlue:natMark(pp,[0,0,0,0,0,0],1,3,3),neutral:natMark(pp,[0,0,0,0,0,0],1,1,1),vp:NAT_VP,
    stats:calcStats(pp,[0,0,0,0,0,0],1,3),exp:[pp.s[0]+75,Math.floor((pp.s[1]+20)*1.1),Math.floor((pp.s[3]+20)*.9),pp.s[5]+20]};
  /* ⑦ 名前 */
  o.ta=[MD[843]&&MD[843][0],MV[843]&&MV[843][0],MVJ['3ぼんのや']];
  /* ⑧ トリックルーム：覚えられるだけでは張らない */
  const TRID=id('trickroom');const slowNos=P.filter(p=>p.s[5]<=50&&!p.mega&&LSD[p.no]&&mvpLegal(p.no).st==='ok').map(p=>p.no);
  const setter=slowNos.find(no=>LSD[no][1].includes(TRID));
  const fam=new Set(),six=[];for(const no of [setter,...slowNos]){const f=byNo[no].base||no;if(fam.has(f))continue;fam.add(f);six.push(no);if(six.length===6)break}
  const mkSet=(no,withTR)=>{const s=setToSaved(byNo[no],mySetFor(no));const atk=(LSD[no][1]).filter(i=>MV[i]&&MV[i][2]>=70).slice(0,3).map(i=>({id:i,n:mName(i)}));return{...s,it:null,mv:withTR?[{id:TRID,n:mName(TRID)},...atk]:atk}};
  const keepT=team.slice();
  try{
    team.length=0;six.forEach((no,i)=>team.push({no,set:mkSet(no,false)}));DG_SELC.clear();
    const T=dgTeam0(team,20),A=dgAnalyze(T);
    team[0].set=mkSet(six[0],true);const T2=dgTeam0(team,20);DG_SELC.clear();const S2=dgSelect(team);
    o.tr={six:six.length,setterLearn:!!setter,unreg:{on:T.tr.on,setters:T.tr.setters.length,cand:T.tr.cand.length,unset:T.tr.unset,suit:T.tr.suit},
      slowWarn:A.bad.some(x=>/だれよりも速い相手/.test(x.t)),unsetWarn:A.bad.some(x=>/トリックルームの技が入っていない/.test(x.t)),
      reg:{on:T2.tr.on,setters:T2.tr.setters.map(s=>s.i)},trUse:S2?S2.list.filter(x=>x.trUse).every(x=>x.c.includes(0)):null,
      noUseWithout:S2?S2.list.filter(x=>!x.c.includes(0)).every(x=>!x.trUse):null};
    /* ⑨ 選出：メガストーンを持つ2匹（リザードン X・Y ではなく別の種類）を入れても選出から外さない */
    const stones=Object.keys(MEGA).filter(k=>Object.keys(MEGA[k]).length===1).map(k=>({k,no:+Object.keys(MEGA[k])[0]})).filter(x=>byNo[x.no]&&mvpLegal(x.no).st==='ok'&&mvpStoneSt(x.k,x.no)==='ok');
    const a1=stones[0],a2=stones.find(x=>(byNo[x.no].base||x.no)!==(byNo[a1.no].base||a1.no));
    const rest=[134,143,445,248,700,887].filter(no=>byNo[no]&&![a1.no,a2.no].includes(no)).slice(0,4);
    team.length=0;[{no:a1.no,set:{...setToSaved(byNo[a1.no],mySetFor(a1.no)),it:{k:a1.k,n:ITEMN[a1.k]||a1.k}}},{no:a2.no,set:{...setToSaved(byNo[a2.no],mySetFor(a2.no)),it:{k:a2.k,n:ITEMN[a2.k]||a2.k}}},...rest.map(no=>({no,set:{...setToSaved(byNo[no],mySetFor(no)),it:null}}))].forEach(x=>team.push(x));
    DG_SELC.clear();const S=dgSelect(team);const both=S&&S.list.filter(x=>x.c.includes(0)&&x.c.includes(1));
    o.mega={n:S&&S.list.length,total:S&&S.total,excluded:S&&S.excluded,both:both&&both.length,bothMega:both&&both.every(x=>[0,1].includes(x.megaI)&&x.megaAlt.length===1),
      one0:S&&S.list.filter(x=>x.c.includes(0)&&!x.c.includes(1)).every(x=>x.megaI===0),none:S&&S.list.filter(x=>!x.c.includes(0)&&!x.c.includes(1)).every(x=>x.megaI===-1),
      why:both&&both[0]?dgSelWhy(S,both[0]).good.some(t=>/メガシンカ：/.test(t)&&/メガストーンの効果なし/.test(t)):null,
      html:S?/メガ<\/small>/.test(dgSelHTML(S,team)):null,old:S?/除いています/.test(dgSelHTML(S,team)):null};
    /* ⑪ 改善案のメガの候補：持ち物を変える前後でメガストーンの匹が同じなら同じメガ、変わったら実際の条件 */
    const T0=dgTeam0(team,20);
    o.mopt={same:JSON.stringify(dgMegaOpt(T0,team.map(x=>({...x})))),drop:JSON.stringify(dgMegaOpt(T0,team.map((x,i)=>i===T0.mega.i?{...x,set:{...x.set,it:null}}:x)))};
  }finally{team.length=0;keepT.forEach(x=>team.push(x));DG_SELC.clear()}
  /* ⑩ 1匹から組むの型の確かめ：メガストーンを外したのにメガ後の特性が残る型・同じ種類・同じ技 */
  const megaNo=Object.keys(MEGA).map(k=>({k,no:+Object.keys(MEGA[k])[0]})).find(x=>{const m=megaOf(x.no,x.k);return m&&m.ab&&!(ABD[x.no]||[]).some(z=>z[0]===m.ab)});
  const mab=megaOf(megaNo.no,megaNo.k).ab;
  const V=tbValidate([{no:megaNo.no,set:{ab:{k:mab,n:ABN[mab]},it:null,mv:[],sp:null,up:-1,dn:-1}},{no:megaNo.no,set:null},{no:143,set:{ab:null,it:null,mv:[{id:id('bodyslam'),n:'x'},{id:id('bodyslam'),n:'x'}],sp:null,up:-1,dn:-1}}]);
  o.tbv={n:V.mem.length,ab:V.mem[0].set.ab&&V.mem[0].set.ab.k,abOk:(ABD[megaNo.no]||[]).some(z=>z[0]===(V.mem[0].set.ab&&V.mem[0].set.ab.k)),mv:V.mem[1]&&V.mem[1].set.mv.length,notes:V.notes.length};
  /* ⑫ 改善案の計算の1対1の使い回し（DG_MEMO）：使い回しなしで全部計算し直した結果と同じ（シングル・ダブル、実際の集計の型の6匹） */
  o.memo={};const keepT2=team.slice(),fmt0=FMT;
  try{for(const fmt of ['single','double']){FMT=fmt;const rows=mvpRows(fmt);if(!rows){o.memo[fmt]=null;continue}
    const pool=rows.rows.filter(r=>!r.stone&&mvpLegal(r.no).st==='ok').map(r=>mvpSet(fmt,r.no,{anyMv:true})).filter(x=>x.st==='ok');
    const used=new Set(),es=[];for(const q of pool){if(es.some(x=>tbFam(x.no)===tbFam(q.no)))continue;const s=mvpSet(fmt,q.no,{anyMv:true,used});if(s.st!=='ok')continue;if(s.sv.it)used.add(s.sv.it.k);es.push({no:q.no,set:s.sv,axis:es.length===0});if(es.length===6)break}
    team.length=0;team.push(...es);
    const grid=T=>T?.rows.map(r=>[r.q.no,r.o.ab,r.lvl,r.lvlTR,r.res,r.resTR]);
    const rank=S=>S?S.list.map(x=>[x.c,x.sc,x.cnt,x.sw,x.swc,x.fast,x.megaI,x.trUse,x.wxOk,x.rows.map(r=>[r.r.q.no,r.r.o.ab,r.lvl,r.zs]),x.leads]):null;
    const sig=I=>JSON.stringify({grid:grid(I.T0),l:I.list.map(x=>[x.kind,x.i,x.title,x.why,x.J.b,x.J.a,x.J.gain,x.J.D.up,x.J.D.dn,x.megaChg,grid(x.T1),x.T1?.mega.no,
      x.sel&&[x.sel.b.c.map(x.sel.beforeNm),x.sel.a.c.map(x.sel.afterNm),x.sel.b.sc,x.sel.a.sc,x.sel.b.cnt,x.sel.a.cnt,x.sel.b.sw,x.sel.a.sw]]),d:I.dropped,t:I.tried});
    const cold=fn=>{DG_CACHE.k=null;DG_SELC.clear();IMP_CACHE.clear();MVP_MC.clear();return fn()};
    DG_MEMO_OFF=true;let t=performance.now();const A=cold(()=>dgImprove(team));const tA=performance.now()-t;
    const all=team.map(x=>({...x,axis:false}));
    const SA=cold(()=>rank(dgSelect(all)));
    DG_MEMO_OFF=false;
    t=performance.now();const B2=cold(()=>dgImprove(team));const tB=performance.now()-t;
    const SB=cold(()=>rank(dgSelect(all))),warm=rank(dgSelect(all));
    const proposals=B2.list.filter(x=>x.T1);
    const independent=proposals.every(x=>impWith(x.entries,()=>{
      const full=cold(()=>dgTeam(x.entries,20));
      return full.mega.no===x.T1.mega.no&&JSON.stringify(grid(full))===JSON.stringify(grid(x.T1))
        && (!x.sel||JSON.stringify(rank(cold(()=>dgSelect(x.entries)))[0].slice(0,9))
                  ===JSON.stringify([x.sel.a.c,x.sel.a.sc,x.sel.a.cnt,x.sel.a.sw,x.sel.a.swc,x.sel.a.fast,x.sel.a.megaI,x.sel.a.trUse,x.sel.a.wxOk]));
    }));
    o.memo[fmt]={eq:sig(A)===sig(B2),selection:JSON.stringify(SA)===JSON.stringify(SB)&&JSON.stringify(SB)===JSON.stringify(warm),
      independent,proposals:proposals.length,n:B2.list.length,ranked:SB?.length,tA:Math.round(tA),tB:Math.round(tB)};}}
  finally{DG_MEMO_OFF=false;FMT=fmt0;team.length=0;keepT2.forEach(x=>team.push(x))}
  /* ⑬ メガリザードンYを外した選出は、メガなし・晴れなしの独立した診断と、各対面まで同じ。 */
  o.recalc=impWith([6,3,445,143,700,149].map((no,i)=>({no,set:{...setToSaved(byNo[no],mySetFor(no)),
    ...(i===0?{it:{k:'charizarditey'},ab:{k:'drought'}}:i===1?{it:null,ab:{k:'chlorophyll'}}:{it:null})}})),()=>{
    const selection=dgSelect(team);
    const without=selection.list.filter(x=>!x.c.includes(0)&&x.c.includes(1));
    const withSun=selection.list.filter(x=>x.c.includes(0)&&x.c.includes(1));
    const zero=dgTeam0(team,20,{noMega:true});
    const dry=new Map(zero.rows.map(r=>[(r.from||r.q).no,r]));
    const matchSelection=(x,y,z)=>{
      const variants=x.trUse?z.variantsTR:z.variants;
      const results=x.trUse?z.resTR:z.res;
      const expected=variants?dgOpponentChoice(variants,x.c):{o:z.o,rs:results.filter(v=>x.c.includes(v.i))};
      return y.r.o.ab===expected.o.ab&&JSON.stringify(y.zs)===JSON.stringify(expected.rs);
    };
    const same=without.every(x=>x.megaI===-1&&x.rows.every(y=>{
      const z=dry.get((y.r.from||y.r.q).no);
      return matchSelection(x,y,z);
    }));
    const swapGate=mvpEvalTeam(team,FMT,{none:true});
    const gateDry=swapGate.scen.find(s=>s.u<0);
    const gateWet=swapGate.scen.find(s=>s.u===0);
    const weatherChangesMvp=!!gateDry&&!!gateWet&&gateWet.rows.some((r,j)=>r.z[1]?.fast!==gateDry.rows[j].z[1]?.fast);
    team[0]={no:324,set:{...setToSaved(byNo[324],mySetFor(324)),it:null,ab:{k:'drought'}}};
    const noSetter=dgSelect(team).list.filter(x=>!x.c.includes(0)&&x.c.includes(1));
    const savedOff=WX_OFF;
    let fromScratch;
    try{WX_OFF=true;fromScratch=dgTeam0(team,20)}finally{WX_OFF=savedOff}
    const clean=new Map(fromScratch.rows.map(r=>[(r.from||r.q).no,r]));
    const drySame=noSetter.length>0&&noSetter.every(x=>!x.wxOk&&x.rows.every(y=>{
      const z=clean.get((y.r.from||y.r.q).no);
      return matchSelection(x,y,z);
    }));
    const target=zero.rows[0].from.no,prev=LIVE.csv[target];
    let changed;
    try{
      LIVE.csv[target]={mv:[]};
      const first=dgTeam(team,20);
      LIVE.csv[target]={mv:[['ステルスロック',100]]};
      changed=dgTeam(team,20)!==first;
    }finally{if(prev===undefined)delete LIVE.csv[target];else LIVE.csv[target]=prev}
    return{without:without.length,withSun:withSun.length,same,drySame,changed,weatherChangesMvp,
      sun:withSun.some(x=>x.rows.some(r=>r.zs.some(z=>z.i===1&&z.wxTeam)))};
  });
  const result={c:[0],cnt:{1:0,2:0,3:1,4:0}};
  const card=impCard({kind:'swap',J:{b:{},a:{}},sel:{b:result,a:result,beforeNm:()=>'コータス',afterNm:()=>'ペリッパー'}},0);
  o.swapNames=/コータス（[^）]+）→ ペリッパー（/.test(card);
  return o});
await b.close();
for(const f of ['single','double']){
  const m=R.memo[f];
  ok(m?.eq&&m.proposals>0,`改善案（${f}）：使い回しありとなしで各対面・改善提案の順位・前後の値が同じ`,m);
  ok(m?.selection&&m.ranked===(f==='single'?20:15),`選出（${f}）：キャッシュありとなしで全順位・後出し・先発の順が同じ`,m);
  ok(m?.independent&&m.proposals>0,`改善案（${f}）：各提案を独立して全体計算しても各対面と最上位選出が同じ`,m);
}
ok(R.recalc.without>0&&R.recalc.withSun>0&&R.recalc.sun&&R.recalc.same,'メガリザードンYを選ばない場合は、メガなしで全体を計算した対面と一致する',R.recalc);
ok(R.recalc.drySame,'コータスを選ばない場合は、天候役の補正なしで全体を計算した対面と一致する',R.recalc);
ok(R.swapNames,'入れかえ案の選出比較では変更前と変更後それぞれの名前を表示する');
ok(R.recalc.weatherChangesMvp,'入れかえ案の判定でメガリザードンYの有無に応じてフシギバナの行動順が変わる',R.recalc);
ok(R.recalc.changed,'同じ相手の使用データが更新されたら診断キャッシュを更新する',R.recalc);
console.log('改善案の時間（使い回しなし→あり）',JSON.stringify(R.memo));
const S=R.sf;
ok(S.ice[0]>S.ice[1]&&Math.abs(S.ice[0]/S.ice[1]-1.3)<.03,'ちからずく：れいとうパンチは1.3倍',S.ice);
ok(S.cc[0]===S.cc[1],'ちからずく：インファイト（自分が下がるだけ）は上がらない',S.cc);
ok(S.mach[0]===S.mach[1],'ちからずく：追加効果のない技は上がらない',S.mach);
ok(S.size===123,'ちからずくの表は技ごと（チャンピオンズの技データの secondaries 123技）',S.size);
ok(S.generic>0,'一般的な「ほかの効果あり」の印（MVE.o）だけの技は表に入らない',S.generic);
ok(!S.fd&&!S.scale&&S.fc,'フリーズドライ（チャンピオンズ）・スケイルショット（追加効果ではない）は入らず、ニトロチャージは入る',S);
ok(!S.eshot[0]&&S.eshot[1]&&!S.eshot[2],'エレクトロビームは威力だけ上がり、効果を止めない',S.eshot);
ok(S.lo[0]&&!S.lo[1]&&!S.lo[2],'いのちのたまの反動を止めるのは、ちからずくが働いた技だけ',S.lo);
ok(!S.unimpl&&S.impl,'ちからずくを未対応の一覧から外した');
ok(R.ohko&&R.ohko[0]===0&&R.ohko[1],'がんじょうは一撃必殺を防ぐが、かたやぶりでは防げない',R.ohko);
ok(R.sash.raw&&R.sash.without.n===1&&R.sash.withSash.n===2&&R.sash.withSash.surv&&R.sash.withSash.surv.raw>0,'タスキ：HP満タンなら1回目は耐える前提（条件つき）・ないときの確率も残す',R.sash);
ok(R.sash.notFull.n===1&&!R.sash.notFull.surv,'タスキ：HPが満タンでなければ耐えない',R.sash.notFull);
ok(R.sash.note,'タスキの条件つきの説明が出る');
/* 2026/11/24（2回目）：「3回と仮定」をやめ、参照どおりの回数の分布（2回35%・3回35%・4回15%・5回15%）で確率を出す */
ok(JSON.stringify(R.mh.hc)==='[[2,0.35],[3,0.35],[4,0.15],[5,0.15]]'&&!R.mh.chosen&&!R.mh.skill,'ロックブラスト：回数を選ばなければ回数の分布、選んだ・スキルリンクなら分布なし',R.mh);
ok(Math.abs(R.mh.distSum-1)<1e-9&&R.mh.lo===R.mh.two&&R.mh.hi===R.mh.five,'分布の合計1・最小＝2回の最小・最大＝5回の最大',R.mh);
ok(/分布/.test(R.mh.label)&&/2回35%/.test(R.mh.plain),'札と文に分布を入れたことが出る',R.mh);
ok(R.mb.m1>R.mb.m0&&R.mb.seqUp&&R.mb.nNew===R.mb.manual&&Math.abs(R.mb.first-R.mb.s0)<1e-9&&R.mb.calcNext,'メテオビーム：2回目は+2で、回数は使うごとのダメージを足して数える（ためるので1回2ターン）',R.mb);
ok(R.mark.red==='red'&&R.mark.noRed===''&&R.mark.hp===''&&R.mark.blueOk==='blue'&&R.mark.noBlue===''&&R.mark.neutral===''&&R.mark.vp===500,'能力補正の印（赤＝10で割り切れる・青＝一の位が1・HPなし）と500VP',R.mark);
ok(R.mark.stats[0]===R.mark.exp[0]&&R.mark.stats[1]===R.mark.exp[1]&&R.mark.stats[3]===R.mark.exp[2]&&R.mark.stats[5]===R.mark.exp[3],'能力の式は前のまま（HP＝種族値＋ポイント＋75・ほか floor((種族値＋ポイント＋20)×補正)）',R.mark);
ok(R.ta[0]==='3ぼんのや'&&R.ta[1]==='3ぼんのや'&&R.ta[2]===843,'3ぼんのや の名前',R.ta);
ok(R.tr.six===6&&R.tr.setterLearn,'トリックルームの場面ができる',R.tr);
ok(!R.tr.unreg.on&&R.tr.unreg.setters===0&&R.tr.unreg.cand>=1,'覚えられるだけではトリックルームを張らない',R.tr.unreg);
ok(R.tr.slowWarn,'覚えられるだけのトリックルームで、遅さの弱点を消さない',R.tr);
ok(R.tr.unreg.unset&&R.tr.unsetWarn||!R.tr.unreg.suit,'向いている形なら「技が入っていない」と知らせる',R.tr);
ok(!R.tr.reg.on||R.tr.reg.setters.includes(0),'技に入れた匹だけが張る匹',R.tr.reg);
ok(R.tr.trUse!==false&&R.tr.noUseWithout!==false,'選出：張る匹を選んだ選出だけトリックルーム',R.tr);
ok(R.mega.n===R.mega.total&&R.mega.excluded===0,'メガストーン2匹の選出も除かない',R.mega);
ok(R.mega.both>0&&R.mega.bothMega,'2匹とも入った選出は、1匹ずつメガにして比べ、選ばなかった方も残す',R.mega);
ok(R.mega.one0&&R.mega.none,'1匹だけならその匹がメガ、0匹ならメガなし',R.mega);
ok(R.mega.why&&R.mega.html&&!R.mega.old,'どの匹をメガにしたかを出し、古い説明（除いています）を出さない',R.mega);
ok(R.mopt.same.includes('megaNo')&&R.mopt.drop==='{}','改善案：メガストーンの匹が同じなら同じメガ、変わったら実際の条件',R.mopt);
ok(R.tbv.n===2&&R.tbv.abOk&&R.tbv.mv===1&&R.tbv.notes>=3,'1匹から組む：メガストーンなしのメガ後の特性・同じ種類・同じ技を直す',R.tbv);
ok(!errs.length,'ページのエラーなし',errs);
console.log(`impl-fixes-20261124b: ${bad?'NG':'OK'}（${n}項目）`);if(bad)process.exitCode=1;
