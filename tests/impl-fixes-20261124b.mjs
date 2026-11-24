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
  o.mh={assumed:koInfo(ra,sn.hp).assumed,chosen:koInfo(rs,sn.hp).assumed||null,skill:koInfo(dmgRolls(sl,rb,sn,{}),sn.hp).assumed||null,label:koLabel(koInfo(ra,sn.hp)),badge:koBadge(koInfo(ra,sn.hp))};
  /* ⑤ メテオビーム：2回目は特攻+2 */
  const mb=mvObj(id('meteorbeam')),sa=mon(143,'me','thick-fat',{sp:[2,0,0,32,0,32],up:3,dn:1}),sd=mon(143,'op','thick-fat',{sp:[0,0,0,0,0,0],up:-1,dn:-1});
  const m0=bcalc(sa,mb,sd,{r:100,useN:0}).dmg,m1=bcalc(sa,mb,sd,{r:100,useN:1}).dmg,dmr=dgMove(sa,mb,sd);
  o.mb={m0,m1,seqUp:dmr.seqMin[1]>dmr.seqMin[0],nNew:duTurns(dmr.min,{mv:mb,acc:100,f:dmr.fmin,seq:dmr.seqMin},sa,sd),nOld:duTurns(dmr.min,{mv:mb,acc:100,f:dmr.fmin},sa,sd),
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
  return o});
await b.close();
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
ok(R.mh.assumed&&R.mh.assumed.n===3&&!R.mh.chosen&&!R.mh.skill,'ロックブラスト：回数を選ばなければ「3回と仮定」の印、選んだ・スキルリンクなら印なし',R.mh);
ok(/仮定/.test(R.mh.label)&&/仮定/.test(R.mh.badge),'仮定の印が札と文に出る',R.mh);
ok(R.mb.m1>R.mb.m0&&R.mb.seqUp&&R.mb.nNew<R.mb.nOld&&R.mb.calcNext,'メテオビーム：2回目は+2で、回数は使うごとのダメージで数える',R.mb);
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
