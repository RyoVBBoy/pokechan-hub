// 対面の診断エンジン（src/js/60-diag.js）の確認：計算の数字・素早さ・先制技・タスキ・天気・無効・パーティ全体・選出の組み合わせ・データ不足
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const pg=await (await b.newContext({viewport:{width:390,height:844},locale:'ja-JP'})).newPage();
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.route(/^https?:/,r=>r.abort());
let n=0,bad=0;const ok=(c,m)=>{n++;if(!c){bad++;console.error('NG',m)}};
await pg.goto(URL0+'#/');await pg.waitForTimeout(700);
const R=await pg.evaluate(()=>{
  const N=s=>P.find(x=>x.n===s),S=(p,ids,o={})=>mkMon(p,o.side||'me',{ab:o.ab||(ABD[p.no]||[[null]])[0][0],item:o.item||null,moves:ids.map(mvObj),sp:o.sp||[2,32,0,0,0,32],up:o.up??1,dn:o.dn??3});
  const r={};
  /* 1. ダメージは bcalc の乱数最小・最大と同じ */
  const g=S(N('ガブリアス'),[89]),t=S(N('バンギラス'),[242],{side:'op'});
  const x=dgMove(g,g.moves[0],t);
  r.d1=[x.min,bcalc(g,g.moves[0],t,{r:85}).dmg/t.max*100,x.max,bcalc(g,g.moves[0],t,{r:100}).dmg/t.max*100];
  /* 2. タイプ相性・特性の無効：ふゆう にじめん技は0 */
  const lv=P.find(p=>(ABD[p.no]||[]).some(a=>a[0]==='levitate'));
  r.lev=lv?dgMove(g,g.moves[0],S(lv,[33],{side:'op',ab:'levitate'})).max:-1;
  r.immType=dgMove(g,g.moves[0],S(N('ボーマンダ'),[33],{side:'op'})).max;
  /* 3. 素早さ：同じ育成どうしは同速（first 0）で、上から倒せる にしない */
  const a1=S(N('ガブリアス'),[200]),a2=S(N('ガブリアス'),[200],{side:'op'});
  const m3=dgMatch(a1,a2);r.tie=[m3.spd,m3.first,m3.k];
  /* 4. 先制技：遅くても先制技で確定で倒せるなら ko_fast */
  const sl=S(N('ハッサム')||N('メタグロス'),[418],{sp:[2,32,0,0,0,0],up:1,dn:5}),fr=S(N('ゲッコウガ')||N('ドラパルト'),[56],{side:'op'});
  fr.max=fr.hp=12;const m4=dgMatch(sl,fr);r.prio=[m4.spd,m4.k,!!m4.pr];
  /* 5. 相手のきあいのタスキ：一撃の計算でも確定2発 */
  const big=S(N('ガブリアス'),[89]),tg=S(N('ゲンガー')||N('サーフゴー'),[247],{side:'op',item:'focussash'});
  const b5=dgBest(big,tg);r.sash=[b5&&b5.max,b5&&b5.nMin];
  /* 6. こちらのタスキだけで勝てるなら「条件つき」 */
  const me6=S(N('ゲッコウガ')||N('ドラパルト'),[56],{item:'focussash',sp:[2,0,0,32,0,32],up:3,dn:1}),op6=S(N('ガブリアス'),[89],{side:'op',sp:[2,32,0,0,0,32]});
  op6.st[5]=999;me6.max=me6.hp=10;op6.max=op6.hp=10;me6.moves=[mvObj(57)];const m6=dgMatch(me6,op6);r.sash6=[m6.k,m6.opW,m6.myN];
  /* 7. 天気：バンギラス（すなおこし）が相手だと特殊技のダメージが下がる */
  const sp=S(N('アシレーヌ'),[56],{sp:[2,0,0,32,0,32],up:3,dn:1}),ty=S(N('バンギラス'),[242],{side:'op',ab:'sand-stream'});
  r.wx=[dgMatch(sp,ty).me.min,dgMatch0(sp,ty).me.min];
  /* 8. パーティ全体：安定（r>=4）の判定が計算と食い違わない */
  const nos=['ガブリアス','サーフゴー','アシレーヌ','ドドゲザン','ウルガモス','カイリュー'].map(s=>N(s)).filter(Boolean).map(p=>({no:p.no}));
  const T=dgTeam(nos,20);let inc=0;
  T.rows.forEach(row=>{row.res.forEach(z=>{if(z.r>=4&&!(z.myN<9))inc++;if(z.k==='ko_fast'&&!(z.first===1||z.pr))inc++;
    if((z.k==='tank'||z.k==='switch')&&!(z.first===1?z.myN<=z.opW:z.myN<z.opW))inc++});
    if(row.lvl===4&&row.stable.length<2)inc++;if(row.lvl===3&&row.stable.length!==1)inc++});
  r.team=[T.rows.length,inc,T.liveAll];
  /* 9・10. 選出の組み合わせ：シングル6匹から3匹＝20通り、ダブル4匹＝15通り */
  r.combos=[combos([0,1,2,3,4,5],3).length,combos([0,1,2,3,4,5],4).length];
  const nn=nos.map(x=>x.no),op=metaOpps(6).map(q=>q.base||q.no).filter(x=>!nn.includes(x)).slice(0,6);
  const A1=analyze(nn,op);setFmt('double');const A2=analyze(nn,op);setFmt('single');
  r.sel=[A1.best.length,A1.full.length,A2.best.length,A2.full.length];
  return r;
});
ok(Math.abs(R.d1[0]-R.d1[1])<1e-9&&Math.abs(R.d1[2]-R.d1[3])<1e-9&&R.d1[0]<R.d1[2],'ダメージが bcalc と合いません '+R.d1);
ok(R.lev===0,'ふゆうにじめん技が当たっています '+R.lev);
ok(R.immType===0,'ひこうタイプにじめん技が当たっています '+R.immType);
ok(R.tie[0]===0&&R.tie[1]===0&&R.tie[2]!=='ko_fast','同速の扱い '+R.tie);
ok(R.prio[0]===-1&&R.prio[1]==='ko_fast'&&R.prio[2],'先制技の扱い '+R.prio);
ok(R.sash[0]>=100&&R.sash[1]>=2,'きあいのタスキ '+R.sash);
ok(R.sash6[0]==='cond','こちらのタスキだけで勝つときは条件つき '+R.sash6);
ok(R.wx[0]<R.wx[1],'すなあらしの特防1.5倍が入っていません '+R.wx);
ok(R.team[0]>0&&R.team[1]===0,'パーティ全体の判定が計算と食い違います '+R.team);
ok(R.team[2]===false,'集計が読めていないのに読めた扱いになっています');
ok(R.combos[0]===20&&R.combos[1]===15,'選出の組み合わせの数 '+R.combos);
ok(R.sel[0]===3&&R.sel[2]===4&&R.sel[1]>0&&R.sel[1]<=20&&R.sel[3]>0&&R.sel[3]<=15,'選出の計算 '+R.sel);
/* 第4段階：パーティ全体の分析 */
const R4=await pg.evaluate(()=>{
  const N=s=>P.find(x=>x.n===s),r={};
  /* 作った結果で、1匹に頼っている形を見つけられるか（計算に依らない確認） */
  const mon=i=>({p:P[i]}),mv={n:'わざ',t:'ノーマル'};
  const z=(i,o)=>({i,swIn:'no',k:'lose',r:1,t:'',why:[''],me:null,op:null,spd:-1,first:-1,sa:100,so:120,myN:9,opW:1,pr:null,...o});
  const kill=i=>z(i,{me:{mv,min:60,max:70,nMin:2,nMax:2,ohko:0},op:{mv,min:50,max:60,nMin:2,nMax:2,eff:1},opW:2,myN:2,first:1,spd:1,sa:150,k:'ko_fast',r:5,swIn:'survive'});
  const tank=i=>z(i,{op:{mv,min:20,max:25,nMin:4,nMax:4,eff:.5},opW:4,me:{mv,min:20,max:25,nMin:4,nMax:4,ohko:0},myN:4,k:'wall',r:3,swIn:'win'});
  const T={ms:[mon(0),mon(1),mon(2)],rows:[0,1,2,3].map(j=>({q:{n:'相手'+j},o:{},res:[kill(0),tank(1),z(2)],lvl:3})),unk:[],live:false,liveAll:false};
  const A=dgAnalyze(T),ts=A.bad.map(x=>x.t);
  r.soleK=ts.some(t=>/だけが確定2発で倒せる相手が4匹/.test(t));
  r.soleS=ts.some(t=>/後出しできるのが.*だけの相手が4匹/.test(t));
  r.soleF=ts.some(t=>/先に動けるのが.*だけの相手が4匹/.test(t));
  r.noBad=!ts.some(t=>/確定2発で倒せるポケモンがいない/.test(t))&&!ts.some(t=>/後出しして勝てる匹がいない/.test(t));
  /* 受けの3つの数え方（2026/11/10 依頼主の確認②）：受けて有利が0匹でも、安全に交代できる匹がいれば「受けに回れる匹がいない」にしない */
  const piv=i=>z(i,{op:{mv,min:30,max:40,fmax:40,nMin:3,nMax:3,eff:1},opW:3,k:'lose',r:1,swIn:'survive'});
  const T3={ms:[mon(0),mon(1),mon(2),mon(3)],rows:[0,1,2,3].map(j=>({q:{n:'相手'+j},o:{},res:[kill(0),kill(1),kill(2),piv(3)],lvl:4})),unk:[],live:false,liveAll:false};
  const A3=dgAnalyze(T3);r.piv=!A3.bad.some(x=>/受けに回れる匹が0匹|受けに回れる匹がいない/.test(x.t))&&A3.bad.some(x=>/受けに回れるのが.*1匹だけ/.test(x.t)&&x.ev.some(e=>/安全に交代できる 4匹/.test(e)));
  const T4={...T3,rows:T3.rows.map(row=>({...row,res:[kill(0),kill(1),kill(2),z(3,{op:{mv,min:100,max:120,fmax:120,nMin:1,nMax:1,eff:2}})]}))};r.piv0=dgAnalyze(T4).bad.some(x=>/攻撃に偏っている：攻撃役3匹に対して、受けに回れる匹が0匹/.test(x.t)&&x.sev===3);
  /* 全員が遅く、先制技で確定で倒せるとき */
  const T2={...T,rows:T.rows.map(row=>({...row,res:row.res.map(x=>({...x,spd:-1,first:-1,pr:x.i===0?{mv,min:120,max:140}:null}))}))};
  const sp=dgAnalyze(T2).bad.find(x=>/だれよりも速い相手/.test(x.t));r.prio=!!sp&&/先制技で確定で倒せます/.test(sp.d)&&sp.sev<=2;
  /* 実際のパーティ：計算の項目が dgTeam の数と合う・タイプだけの気になる点には計算の根拠がある */
  team.length=0;['ガブリアス','サーフゴー','アシレーヌ','ドドゲザン','ウルガモス','カイリュー'].forEach(s=>team.push({no:N(s).no}));
  const C=partyCheck(team),DT=dgTeam(team,20);
  const noSw=DT.rows.filter(row=>!row.res.some(x=>x.swIn==='win')).length,noK=DT.rows.filter(row=>!row.res.some(x=>x.me&&x.me.nMin<=2)).length;
  const f1=C.fix.find(x=>/後出しして勝てる匹がいない相手/.test(x.t)),f2=C.fix.find(x=>/確定2発で倒せるポケモンがいない/.test(x.t));
  r.match=[noSw?!!f1&&f1.t.includes(noSw+'匹'):!f1,noK?!!f2&&f2.t.includes(noK+'匹'):!f2];
  r.typeEv=C.fix.filter(x=>x.k==='type').every(x=>x.ev&&x.ev.length&&!/参考/.test(x.ev[0]));
  r.calcEv=C.fix.filter(x=>x.k==='calc').every(x=>x.ev&&x.ev.length&&x.sev>=1&&x.area);
  r.unk=/計算に入っていない特性/.test(C.premise);
  /* ★で選出を見るとき・ダブル */
  team.forEach((x,i)=>x.sel=i<3);const C3=partyCheck(team);r.sel=C3.fix.every(x=>x.k!=='type')&&/★/.test(C3.scope);
  setFmt('double');team.forEach((x,i)=>x.sel=i<4);const C4=partyCheck(team);r.dbl=/ダブル/.test(C4.premise)&&/ダブル/.test(C4.scope);setFmt('single');
  return r;
});
ok(R4.soleK,'攻撃役が1匹に頼っている形を見つけられません');
ok(R4.soleS,'後出しが1匹に頼っている形を見つけられません');
ok(R4.soleF,'素早さが1匹に頼っている形を見つけられません');
ok(R4.noBad,'倒せる・後出しできる相手を「いない」と言っています');
ok(R4.prio,'先制技で補えることが書かれていません');
ok(R4.match.every(Boolean),'パーティのチェックの数が計算と合いません '+R4.match);
ok(R4.typeEv,'タイプ相性だけの気になる点に計算の根拠がありません');
ok(R4.calcEv,'計算の項目に根拠・深刻度がありません');
ok(R4.unk,'計算に入っていない特性が書かれていません');
ok(R4.sel,'★の選出で見るとき');
ok(R4.dbl,'ダブルのとき');
/* 2026/11/10 依頼主の検証（第4段階の精度） */
const V=await pg.evaluate(()=>{
  const N=s=>P.find(x=>x.n===s),r={};
  /* マルチスケイル：初撃だけ半分。回数は「初撃（半分）＋2発目から（そのまま）」で数える（前は二重に半分） */
  const g=mkMon(N('ガブリアス'),'me',detSet(N('ガブリアス'))),d=mkMon(N('カイリュー'),'op',{...detSet(N('カイリュー')),ab:'multiscale'});
  const x=dgBest(g,d),exp=x.fmin>=100?1:1+Math.ceil((100-x.fmin)/x.min);
  d.hp=d.max-1;const full=bcalc(g,x.mv,d,{r:85}).dmg/d.max*100;d.hp=d.max;const first=bcalc(g,x.mv,d,{r:85}).dmg/d.max*100;
  r.ms=[Math.abs(x.min-full)<1e-9,Math.abs(first-Math.floor(full*d.max/100/2)/d.max*100)<1.5,x.nMin===exp,duel(g,d).mt===exp];
  /* 66〜79%（初撃）の例：前の計算では確定3発、正しくは2発目が132%以上なので確定2発 */
  r.ex=duTurns(132,{mv:x.mv,acc:100},g,d);
  /* 同速：上を取れると言わない */
  const a=mkMon(N('サーフゴー'),'me',detSet(N('サーフゴー'))),b=mkMon(N('ルカリオ'),'op',detSet(N('ルカリオ')));a.st[5]=b.st[5]=223;
  const t=dgMatch(a,b);r.tie=[t.spd===0,t.why.some(w=>/同速/.test(w)),!t.why.some(w=>/先に動ける|上を取れる/.test(w)),t.k!=='ko_fast'||!!t.pr];
  /* 後出し：交代で受ける1発目と、そのあとを分ける */
  const s1=dgMatch(mkMon(N('アーマーガア'),'me',detSet(N('アーマーガア'))),mkMon(N('カイリュー'),'op',detSet(N('カイリュー'))));
  r.sw=['win','survive','no'].includes(s1.swIn)&&/交代で受ける1発目/.test(s1.swTxt);
  /* 根拠が5匹を超えたら「ほか〇匹」 */
  const mv={n:'わざ',t:'ノーマル'};
  const T={ms:[{p:P[0]},{p:P[1]}],rows:[...Array(8).keys()].map(j=>({q:{n:'相手'+j,no:j},o:{},lvl:1,res:[0,1].map(i=>({i,swIn:'no',k:'lose',r:1,t:'',why:[''],me:{mv,min:10,max:12,nMin:9,nMax:9},op:{mv,min:80,max:120,fmin:80,fmax:120,nMin:2,nMax:1,eff:1},spd:-1,first:-1,sa:1,so:2,myN:9,opW:1,pr:null}))})),unk:[]};
  const A=dgAnalyze(T);r.more=A.bad.filter(b=>/8匹/.test(b.t)).every(b=>b.ev.some(e=>/^ほか3匹/.test(e)));
  /* 入れかえ案は、変更後の6匹で計算し直して悪くならないものだけ */
  team.length=0;['ギャラドス','ブリジュラス','ガブリアス','ドドゲザン','ウルガモス','カミツオロチ'].forEach(s=>team.push({no:N(s).no}));
  const sw=prSwaps();r.swap=sw.every(z=>z.calc&&z.calc.a.x<=z.calc.b.x&&!z.calc.worse.length);
  team.length=0;['ドドゲザン','ボスゴドラ','ヌメルゴン（ヒスイ）','ウルガモス','カミツオロチ','バンギラス'].forEach(s=>team.push({no:N(s).no}));
  const L=loseReasons(team).find(z=>/答えられない/.test(z.t));
  r.lose=!L||/計算し直して良くなる案|見つかりませんでした/.test(L.how)||!/外して/.test(L.how);
  if(L&&/外して(.+?)を入れる/.test(L.how)){const m=L.how.match(/(\S+?)を外して(\S+?)を入れる/);
    const outN=m[1].replace(/^.*：/,''),inN=m[2];const i=team.findIndex(x=>byNo[x.no].n===outN),q=P.find(p=>p.n===inN);
    if(i>=0&&q){const T0=dgTeam0(team,20),T1=dgTeam0(team.map((x,k)=>k===i?{no:q.no}:x),20);r.lose2=T1.rows.filter(z=>z.lvl===1).length<T0.rows.filter(z=>z.lvl===1).length}}
  return r;
});
ok(V.ms.every(Boolean),'マルチスケイルの数え方 '+V.ms);
ok(V.ex===2,'初撃66%・2発目132%は確定2発 '+V.ex);
ok(V.tie.every(Boolean),'同速の扱い '+V.tie);
ok(V.sw,'後出しの1発目とそのあとの区別');
ok(V.more,'根拠が5匹を超えたときの「ほか〇匹」');
ok(V.swap,'入れかえ案が計算で悪くなっていないか');
ok(V.lose&&V.lose2!==false,'敗因の診断の入れかえ案を変更後に計算し直すと良くなるか '+V.lose+' '+V.lose2);
/* 2026/11/10 依頼主の検証2：タイプ相性・無効技・敗因の診断との食い違い・マルチスケイルの書き方・上から倒す */
import {createRequire} from 'node:module';
const TC=(()=>{const {Generations}=createRequire(import.meta.url)('@smogon/calc');const g=Generations.get(9),o={};for(const t of g.types){if(t.name==='???'||t.name==='Stellar')continue;o[t.name]=t.effectiveness}return o})();
const V2=await pg.evaluate(tc=>{
  const J={Normal:'ノーマル',Fire:'ほのお',Water:'みず',Electric:'でんき',Grass:'くさ',Ice:'こおり',Fighting:'かくとう',Poison:'どく',Ground:'じめん',Flying:'ひこう',Psychic:'エスパー',Bug:'むし',Rock:'いわ',Ghost:'ゴースト',Dragon:'ドラゴン',Dark:'あく',Steel:'はがね',Fairy:'フェアリー'};
  const r={};let bad=0;for(const a in J)for(const d in J)if(mult(J[a],[J[d]])!==tc[a][d])bad++;r.chart=bad;
  const N=s=>P.find(x=>x.n===s),S=(p,ids,o={})=>mkMon(p,o.side||'me',{ab:o.ab||(ABD[p.no]||[[null]])[0][0],item:null,moves:ids.map(mvObj),sp:[2,32,0,0,0,32],up:1,dn:3});
  /* エスパー技：ゴースト（イダイトウ）には等倍、あく（バンギラス）には無効 */
  const at=S(N('メタグロス'),[94]),ida=S(N('イダイトウ'),[56],{side:'op'}),ty=S(N('バンギラス'),[242],{side:'op',ab:'sand-stream'});
  r.psy=[dgMove(at,at.moves[0],ida).eff===1&&dgMove(at,at.moves[0],ida).min>0,dgMove(at,at.moves[0],ty).max===0];
  /* 無効の技をいちばん痛い技に選ばない */
  const at2=S(N('メタグロス'),[94,399]);const b2=dgBest(at2,ty);r.pick=!!b2&&b2.mv.id===399&&b2.min>0;
  const g1=S(N('ゴリランダー')||N('ケンタロス'),[33,370]),gh=S(N('ゲンガー'),[247],{side:'op'});const b3=dgBest(g1,gh);r.ghost=!b3||b3.max===0||(b3.eff>0&&b3.mv.t!=='ノーマル'&&b3.mv.t!=='かくとう');
  /* 無効の技しかない相手：こちらは一撃も受けないので後出しで勝てる・相手の反撃は書かない */
  const only=S(N('メタグロス'),[94],{side:'op'}),dk=S(N('バンギラス'),[242]);const m=dgMatch(dk,only);r.immune=[m.swIn==='win',!m.op,m.r>=4];
  /* マルチスケイル：受ける側のHPが満タンのときの1発目、と書く */
  const g=mkMon(N('ガブリアス'),'me',detSet(N('ガブリアス'))),d=mkMon(N('カイリュー'),'op',{...detSet(N('カイリュー')),ab:'multiscale'});
  const mm=dgMatch(g,d);r.ms=mm.why.join(' ').includes('相手のHPが満タンのとき、こちらの攻撃の1発目だけ');
  /* 上から：一撃でないときは「〇発で倒しきれる」「一撃で倒せるとは限らない」 */
  const ib=mkMon(N('イダイトウ'),'me',detSet(N('イダイトウ'))),hp=mkMon(N('カバルドン'),'op',detSet(N('カバルドン')));const mh=dgMatch(ib,hp);
  r.fast=mh.k!=='ko_fast'||(mh.myN===1?/一撃（確定）/.test(mh.t):(/発で倒しきれる/.test(mh.t)&&mh.why.some(w=>/一撃で倒せるとは限らない/.test(w))));
  return r},TC);
ok(V2.chart===0,'タイプ相性が @smogon/calc と '+V2.chart+'か所ちがう');
ok(V2.psy.every(Boolean),'エスパー技：ゴーストに等倍・あくに無効 '+V2.psy);
ok(V2.pick,'無効の技をいちばん痛い技に選んでいる');
ok(V2.ghost,'ゴーストにノーマル・かくとう技を選んでいる');
ok(V2.immune.every(Boolean),'無効の技しかない相手との判定 '+V2.immune);
ok(V2.ms,'マルチスケイルの書き方');
ok(V2.fast,'上から倒す（一撃とは限らない）の書き方');
/* 依頼主の6匹（ペリッパー・ブリジュラス・イダイトウ・ライチュウ・ゴリランダー・アーマーガア）：敗因の診断が「問題なし」なのに計算の注意がある、を出さない */
await pg.evaluate(()=>{team.length=0;['ペリッパー','ブリジュラス','イダイトウ','ライチュウ','ゴリランダー','アーマーガア'].forEach(s=>team.push({no:P.find(x=>x.n===s).no}));saveTeam();sessionStorage.setItem('pcttab','check');TTAB='check';location.hash='#/team';route()});
await pg.waitForTimeout(1800);
const LS=await pg.evaluate(()=>{const cb=dgAnalyze(dgTeam(team,20)).bad.filter(x=>x.sev>=2).length,el=document.getElementById('lose-box');const st=el?el.querySelector('.ls-s b').textContent:'';
  return {cb,st,note:!!(el&&el.querySelector('.ls-cb')),rows:dgTeam(team,20).rows.length,check:document.querySelectorAll('.pc-i').length}});
ok(LS.rows>0&&LS.check>0,'6匹の計算・チェックが出ない');
ok(!LS.cb||(LS.st!=='問題なし'&&LS.note),'計算の注意があるのに「構築：問題なし」 '+JSON.stringify(LS));
/* 2026/11/10 依頼主の検証3：素早さの比べ方・パーティの天気・技のタイプの変化・全体への反映 */
const V3=await pg.evaluate(()=>{
  const N=s=>P.find(x=>x.n===s),r={};
  const S=(p,ids,o={})=>mkMon(p,o.side||'me',{ab:o.ab||(ABD[p.no]||[[null]])[0][0],item:o.item||null,moves:ids.map(mvObj),sp:[2,32,0,0,0,32],up:1,dn:3});
  /* こちらが速い → spd 1・上から、こちらが遅い → spd -1・上からにならない（先制技なし） */
  const a=S(N('ルチャブル'),[413]),g=S(N('ギャラドス'),[127],{side:'op'});a.st[5]=170;g.st[5]=133;const m1=dgMatch(a,g);
  r.fast=[m1.spd===1,m1.sa===170&&m1.so===133,!/下になる/.test(m1.spdTxt)];
  a.st[5]=120;const m2=dgMatch(a,g);r.slow=[m2.spd===-1,m2.k!=='ko_fast',/下になる/.test(m2.spdTxt)];
  /* 晴れ（パーティのひでり）＋ようりょくそ：素早さ2倍で比べる。ひでりがいなければそのまま */
  team.length=0;['リザードン','フシギバナ'].forEach(s=>team.push({no:N(s).no}));team[0].set={it:{k:'charizarditey',n:''},mv:[]};team[1].set={ab:{k:'chlorophyll',n:''},mv:[]};
  const ve=mkMon(N('フシギバナ'),'me',mySetFor(N('フシギバナ').no)),o=mkMon(N('ガブリアス'),'op',detSet(N('ガブリアス')));
  const base=ve.st[5],m3=dgMatch(ve,o);r.sun=[m3.sa===base*2,m3.why.some(w=>/晴れの中で計算/.test(w))];
  const A=analyze([N('フシギバナ').no],[N('ガブリアス').no]);r.sunSel=A.fast[0][0]===(base*2>effSpd(o));
  team.length=0;team.push({no:N('フシギバナ').no,set:{ab:{k:'chlorophyll',n:''},mv:[]}});
  const ve2=mkMon(N('フシギバナ'),'me',mySetFor(N('フシギバナ').no));r.noSun=dgMatch(ve2,o).sa===ve2.st[5];
  /* スカイスキン：すてみタックルをひこう技として計算し、名前にそう書く */
  const bo=mkMon(N('ボーマンダ'),'op',{...detSet(N('ボーマンダ')),item:'salamencite',moves:[mvObj(38)]}),t=S(N('ルチャブル'),[413]);
  const x=dgMove(bo,bo.moves[0],t);r.skin=[bo.ab==='aerilate',/スカイスキンでひこう技/.test(x.mvn),hitType(bo,bo.moves[0])==='ひこう'];
  return r});
ok(V3.fast.every(Boolean),'こちらが速いとき '+V3.fast);
ok(V3.slow.every(Boolean),'こちらが遅いとき '+V3.slow);
ok(V3.sun.every(Boolean),'パーティの晴れ＋ようりょくそ '+V3.sun);
ok(V3.sunSel,'選出の計算にもパーティの晴れが入る');
ok(V3.noSun,'晴れにする匹がいないのに2倍にしている');
ok(V3.skin.every(Boolean),'スカイスキンの書き方 '+V3.skin);
/* 2026/11/10 トリックルーム構築 */
const V4=await pg.evaluate(()=>{
  const N=s=>P.find(x=>x.n===s),r={};
  team.length=0;['ブリムオン','リキキリン','ドサイドン','ヤドラン','カビゴン','ハッサム'].forEach(s=>team.push({no:N(s).no}));
  const T=dgTeam0(team,20);r.on=T.tr.on&&T.tr.setters.some(x=>T.ms[x.i].p.n==='ブリムオン');
  r.rows=T.rows.every(row=>row.resTR&&row.resTR.length&&row.lvlTR>=1);
  /* トリックルーム中は遅い方が先：こちらが遅い対面で spd が 1 になる */
  const z=T.rows.flatMap(row=>row.res.map(x=>[x,row.resTR.find(y=>y.i===x.i)])).filter(([x])=>x.sa<x.so);
  r.inv=z.length>0&&z.every(([x,y])=>y.spd===1&&y.tr===true&&x.spd===-1);
  const A=dgAnalyze(T);r.noSevere=!A.bad.some(b=>/だれよりも速い相手/.test(b.t))&&A.ref.some(b=>/トリックルームを張る前/.test(b.t));
  r.setters=A.good.some(g=>/トリックルームを張れる匹/.test(g.t))||A.bad.some(b=>/トリックルームを張れるのが/.test(b.t));
  /* 速いパーティはトリックルーム構築にしない */
  team.length=0;['ガブリアス','ドラパルト','サーフゴー','ウインディ','ルチャブル','アシレーヌ'].forEach(s=>team.push({no:N(s).no}));
  r.off=!dgTeam0(team,20).tr.on;
  /* みらいよちは撃ち合いの技に入れない */
  const yd=mkMon(N('リキキリン'),'me',{ab:'armor-tail',item:null,moves:[mvObj(248)],sp:[2,0,0,32,0,0],up:3,dn:5}),o=mkMon(N('ガブリアス'),'op',detSet(N('ガブリアス')));
  r.fs=!dgBest(yd,o);
  return r});
ok(V4.on,'トリックルーム構築を見つけられない');
ok(V4.rows,'トリックルーム中の計算がない');
ok(V4.inv,'トリックルーム中に遅い方が先にならない');
ok(V4.noSevere,'トリックルーム構築に「だれよりも速い相手」の警告が出る');
ok(V4.setters,'張れる匹の数が出ない');
ok(V4.off,'速いパーティをトリックルーム構築にしている');
ok(V4.fs,'みらいよちを撃ち合いの技にしている');
/* 構築の型のバッジ */
const V5=await pg.evaluate(()=>{
  const N=s=>P.find(x=>x.n===s),r={};const run=(names,mod)=>{team.length=0;names.forEach(s=>team.push({no:N(s).no}));mod&&mod();TWX_K=null;return teamArch(team).map(a=>a.k)};
  r.tr=run(['ブリムオン','リキキリン','ドサイドン','ヤドラン','カビゴン','ハッサム']).includes('tr');
  r.sun=run(['リザードン','フシギバナ','ルチャブル','ガブリアス'],()=>{team[0].set={it:{k:'charizarditey',n:''},mv:[]}}).includes('sun');
  r.rain=run(['ペリッパー','イダイトウ','ブリジュラス']).includes('rain');
  const sc={it:{k:'choicescarf',n:''},mv:[{id:89,n:'じしん'}]},ss={it:{k:'focussash',n:''},mv:[{id:89,n:'じしん'}]},lo={it:{k:'lifeorb',n:''},mv:[{id:89,n:'じしん'}]};
  r.tm=run(['ガブリアス','ルカリオ','ドドゲザン'],()=>{team[0].set=sc;team[1].set=ss;team[2].set=lo}).includes('tm');
  run(['ガブリアス','サーフゴー','アシレーヌ']);r.none=/判定中/.test(teamArchHTML(team))&&!teamArch(team).length;
  return r});
ok(V5.tr&&V5.sun&&V5.rain&&V5.tm&&V5.none,'構築の型のバッジ '+JSON.stringify(V5));
/* 2026/11/10 依頼主の指摘：技を登録したトリックルーム向きのパーティが「晴れ・対面」になった */
const V6=await pg.evaluate(()=>{
  const N=s=>P.find(x=>x.n===s),r={};team.length=0;['ブリムオン','リキキリン','コータス','ドサイドン','カビゴン','オニシズクモ'].forEach(s=>team.push({no:N(s).no}));
  const ss=archSets(['axis'],team.map(x=>byNo[x.no]));team.forEach((x,i)=>{x.set=toSaved(ss[i])});TWX_K=null;
  const A=teamArch(team);r.first=A[0]&&A[0].k==='tr'&&A[0].unset===true;r.sun=A.some(a=>a.k==='sun');
  r.warn=dgAnalyze(dgTeam(team,20)).bad.some(b=>/トリックルームの技が入っていない/.test(b.t));
  const t2=archSets(ARCHS.find(x=>x[0]==='tr'),team.map(x=>byNo[x.no]));r.fill=t2.some(z=>toSaved(z).mv.some(m=>m.n==='トリックルーム'));
  return r});
ok(V6.first&&V6.sun,'トリックルーム向きのパーティのバッジ '+JSON.stringify(V6));
ok(V6.warn,'トリックルームの技が入っていない注意が出ない');
ok(V6.fill,'トリックルームの型で組むとトリックルームが入らない');
/* 2026/11/10 依頼主の検証⑤：攻撃偏重のパーティ（固定した型）で弱点を見つけられるか */
const V7=await pg.evaluate(()=>{
  const N=s=>P.find(x=>x.n===s),r={};
  const D=[['ドラパルト','clear-body','lifeorb',['dragondarts','phantomforce','uturn','suckerpunch'],[2,32,0,0,0,32],1,3],
    ['オオニューラ','unburden','focussash',['closecombat','direclaw','fakeout','throatchop'],[2,32,0,0,0,32],5,3],
    ['マスカーニャ','protean','choicescarf',['flowertrick','knockoff','uturn','playrough'],[2,32,0,0,0,32],5,3],
    ['ガブリアス','rough-skin','garchompite',['earthquake','dragonclaw','stoneedge','swordsdance'],[2,32,0,0,0,32],5,3],
    ['ウルガモス','flame-body','expertbelt',['quiverdance','fierydance','bugbuzz','gigadrain'],[2,0,0,32,0,32],5,1],
    ['ドドゲザン','supreme-overlord','blackglasses',['kowtowcleave','ironhead','suckerpunch','swordsdance'],[32,32,0,0,2,0],1,3]];
  team.length=0;r.valid=true;
  D.forEach(([n,ab,it,mvs,sp,up,dn])=>{const p=N(n),ids=mvs.map(lfId),ls=(LSD[p.no]||[0,[]])[1];
    if(!ids.every(x=>x&&ls.includes(x))||!(ABD[p.no]||[]).some(a=>a[0]===ab)||!(CH_ITEMS.has?CH_ITEMS.has(it):Object.prototype.hasOwnProperty.call(CH_ITEMS,it))&&!isStone(it))r.valid=false;
    team.push({no:p.no,set:{ab:{k:ab,n:ABN[ab]},it:{k:it,n:ITEMN[it]},mv:ids.map(x=>({id:x,n:mName(x)})),sp,up,dn,src:'manual'}})});
  TWX_K=null;const T=dgTeam0(team,20),A=dgAnalyze(T),nm=i=>T.ms[i].p.n;
  r.bias=A.bad.some(b=>/攻撃に偏っている/.test(b.t)&&b.sev>=2&&b.ev.every(e=>/受けて有利 \d+匹／安全に交代できる \d+匹／後出しして勝てる \d+匹/.test(e)));
  r.noSw=A.bad.some(b=>/後出しして勝てる匹がいない相手/.test(b.t));
  r.ohko=A.bad.some(b=>/一撃で倒せる相手/.test(b.t)&&b.ev.some(e=>/最大\d+%/.test(e)&&/（[^）]+ 最大/.test(e)));
  /* タスキで1だけ残るのは後出しに数えない */
  const sashZ=T.rows.flatMap(row=>row.res.filter(z=>T.ms[z.i].p.n==='オオニューラ'&&z.op&&z.op.fmax>=100));
  r.sash=sashZ.length>0&&sashZ.every(z=>z.swIn!=='win');
  r.sashTxt=sashZ.some(z=>z.swIn==='sash'&&/きあいのタスキで耐えても.*後出しできるとは数えない/.test(z.swTxt));
  /* タスキ→かるわざで先に一撃なら「条件つき」（sashwin）、一撃で倒せなければ数えない */
  r.sashWin=sashZ.some(z=>z.swIn==='sashwin')&&sashZ.filter(z=>z.swIn==='sashwin').every(z=>z.me.nMin===1&&z.sa2>z.so&&(z.sa>z.so||z.op.fmin>=100)&&/①交代で受ける1発目/.test(z.swTxt)&&/②素早さ/.test(z.swTxt)&&/③.*確定1発/.test(z.swTxt)&&/前提：交代時にHP満タン/.test(z.swTxt));
  r.sashNoWin=sashZ.filter(z=>z.swIn==='sash').every(z=>!!z.sashBlock);
  r.multiOut=T.rows.some(row=>row.q.n==='セグレイブ'&&row.res.some(z=>z.i===T.ms.findIndex(m=>m.p.n==='オオニューラ')&&z.swIn==='sash'&&z.sashBlock==='multi'));
  r.condSplit=A.bad.some(b=>/安定して後出しして勝てる匹がいない相手が\d+匹（うち\d+匹は条件つき/.test(b.t)&&b.ev.some(e=>/【条件つき】/.test(e)));
  /* 2026/11/10 依頼主の確認：作った条件で1つずつ確かめる（ダメージは実際の計算。HP・素早さ・技だけ変える） */
  const oo=T.ms.findIndex(m=>m.p.n==='オオニューラ'),row0=T.rows.find(row=>row.q.n==='フラエッテ（えいえんのはな）');
  const base=mySetFor(T.ms[oo].p.no);
  const mkA=(ab,H)=>{const a=mkMon(T.ms[oo].p,'me',{...base,ab});if(H){a.max=a.hp=H}return a};
  const mkO=(spd,hp,add)=>{const o={...row0.o,st:[...row0.o.st],moves:[...row0.o.moves,...(add||[]).map(mvObj)]};o.st[5]=spd;if(hp){o.max=o.hp=hp}return o};
  const a0=mkA('unburden'),sa=effSpd(a0),o0=mkO(sa+1),bm=dgBest(o0,a0),dmin=bcalc(o0,bm.mv,a0,{r:85}).dmg,dmax=bcalc(o0,bm.mv,a0,{r:100}).dmg;
  const C=(ab,H,spd,hp,add)=>{const z=dgMatch(mkA(ab,H),mkO(spd,hp,add));return [z.swIn,z.sashBlock||'']};
  const slowO=Math.floor(sa*1.4),fastO=sa-5;
  r.cases={
    sure:C('unburden',dmin,slowO,1),
    unsure:dmin<dmax?C('unburden',dmax,slowO,1):['skip'],
    noUb:C('pressure',dmin,slowO,1),
    prio:C('unburden',dmin,slowO,1,[453]),
    nokill:C('unburden',dmin,slowO,99999),
    multi:C('unburden',dmin,slowO,1,[331]),
    fastUnsure:dmin<dmax?C('unburden',dmax,fastO,1):['skip']
  };
  /* 後出しで負ける（survive）と後出しできない（no）を分ける */
  const all=T.rows.flatMap(row=>row.res);r.kinds=['no','survive'].every(k=>all.some(z=>z.swIn===k));
  r.surviveOk=all.filter(z=>z.swIn==='survive').every(z=>z.op.fmax<100);
  /* 攻撃技があるだけでは対策に数えない：効く技があっても負ける対面は ◎○の数に入らない */
  r.notCounted=T.rows.every(row=>row.stable.every(z=>z.r>=4)&&row.res.filter(z=>z.me&&z.k==='lose').every(z=>!row.stable.includes(z)&&!row.ok.includes(z)));
  r.hasLoseWithMove=all.some(z=>z.me&&z.me.max>0&&z.k==='lose');
  /* 入れかえ案は変更後の6匹で計算し直して良くなる */
  const S=dgDefSwaps(team,T);r.sw=S.length>0&&S.every(x=>{const T1=dgTeam0(team.map((y,k)=>k===x.i?{no:x.c.no,set:x.S.sv}:y),20);const m=dgMetric(T1,x.D.keep);return m.nosw===x.a.nosw&&m.nosw<x.b.nosw&&m.x<=x.b.x&&m.w<=x.b.w&&m.ohko<=x.b.ohko&&m.slow===x.a.slow});
  /* 入れる匹の育成：外す匹の技・持ち物を引きつがない。技は覚えるもの、特性は持てるもの、持ち物はゲームにあって残る5匹と重ならない */
  r.swSet=S.every(x=>{const sv=x.S.sv,out=team[x.i].set,ls=(LSD[x.c.no]||[0,[]])[1],rest=team.filter((_,k)=>k!==x.i).map(y=>y.set.it.k);
    return sv.mv.length>=3&&sv.mv.every(m=>m.id===182||ls.includes(m.id))&&!sv.mv.some(m=>out.mv.some(o=>o.id===m.id)&&!ls.includes(m.id))&&(ABD[x.c.no]||[]).some(a=>a[0]===sv.ab.k)&&sv.it&&(CH_ITEMS.has(sv.it.k)||isStone(sv.it.k))&&!rest.includes(sv.it.k)&&sv.sp.reduce((a,b)=>a+b,0)>=60&&sv.up>=0});
  r.swDiff=S.every(x=>Array.isArray(x.D.up)&&Array.isArray(x.D.dn)&&/共通の相手/.test(x.D.note)&&x.a.n===x.b.n);
  const pc=partyCheck(team);r.pcSw=pc.fix.some(x=>x.k==='calc'&&x.sw&&x.sw.some(w=>/計算し直すと/.test(w.calc||'')));
  return r});
ok(R4.piv&&R4.piv0,'受けの3つの数え方（受けて有利0匹だけで受け役0にしない） '+[R4.piv,R4.piv0]);
ok(V7.valid,'攻撃偏重の型に覚えない技・ない持ち物がある');
ok(V7.bias,'攻撃偏重（受け役がいない）を深刻で出さない');
ok(V7.noSw,'後出しして勝てる匹がいない相手を出さない');
ok(V7.ohko,'一撃で倒される根拠に技とダメージがない');
ok(V7.sash&&V7.sashTxt,'きあいのタスキで1だけ残るのを後出しできるに数えている');
ok(V7.sashWin&&V7.sashNoWin,'タスキ→かるわざで先に一撃の「条件つき」の見分け '+JSON.stringify([V7.sashWin,V7.sashNoWin]));
ok(V7.condSplit,'安定した後出しと条件つきを分けて出さない');
ok(V7.multiOut,'連続技を持つ相手（セグレイブ）を条件つきにしている');
{const c=V7.cases,E=(k,sw,bl)=>ok(c[k][0]==='skip'||(c[k][0]===sw&&(bl==null||c[k][1]===bl)),'タスキ＋かるわざ：'+k+' '+JSON.stringify(c[k]));
 E('sure','sashwin');E('unsure','sash','unsure');E('noUb','sash','slow');E('prio','sash','prio');E('nokill','sash','nokill');E('fastUnsure','sashwin');
 ok(c.multi[0]!=='sashwin','連続技でタスキが効かないのに条件つき '+c.multi);ok(c.unsure[0]!=='skip','最大だけ100%以上の場合を作れない')}
ok(V7.swSet,'入れかえ案の匹の育成が適切でない（引きつぎ・覚えない技・重なる持ち物）');
ok(V7.swDiff,'入れかえ案の良くなる・悪くなるの比べ方');
ok(V7.kinds&&V7.surviveOk,'後出しできない／後出しして負けるを分けていない');
ok(V7.notCounted&&V7.hasLoseWithMove,'攻撃技を持っているだけで対策に数えている');
ok(V7.sw,'入れかえ案を計算し直すと良くならない '+JSON.stringify(V7));
ok(V7.pcSw,'パーティのチェックに計算し直した入れかえ案が出ない');
/* 第5段階：選出の比較（シングル20通り・ダブル15通り・メガは1匹まで・軸・パーティの天気・トリックルーム） */
const V8=await pg.evaluate(()=>{
  const N=s=>P.find(x=>x.n===s),r={};
  const setT=ns=>{team.length=0;ns.forEach(s=>team.push({no:N(s).no}));TWX_K=null};
  setT(['ガブリアス','サーフゴー','アシレーヌ','ドドゲザン','ウルガモス','カイリュー']);
  let D=dgSelect(team);r.single=[D.K===3,D.list.length===20,D.list.every(x=>x.c.length===3),D.best===D.list[0],D.list.every((x,k)=>!k||D.list[k-1].sc>=x.sc)];
  r.cnt=D.list.every(x=>x.cnt[1]+x.cnt[2]+x.cnt[3]+x.cnt[4]===D.N);
  /* 1つの選出の ◎〜× を dgTeam の結果から手で数え直して一致（天気・トリックルームのないパーティ） */
  const T=dgTeam(team,20),x=D.list[3];
  r.recount=x.rows.every((y,j)=>{const zs=T.rows[j].res.filter(z=>x.c.includes(z.i)),st=zs.filter(z=>z.r>=4).length,ok=zs.filter(z=>z.r>=3).length,wk=zs.filter(z=>z.r===2).length;return y.lvl===(st>=2?4:st===1?3:ok||wk?2:1)});
  r.lead=D.list.every(x=>x.c.includes(x.leads[0]));
  r.plan=JSON.stringify(selPlan(team).base.slice().sort())===JSON.stringify(D.best.c.slice().sort());
  const W=dgSelWhy(D,D.best,D.list[1]);r.why=W.good.some(t=>/上位\d+匹のうち ◎\d+・○\d+・△\d+・×\d+/.test(t))&&W.good.some(t=>/先発/.test(t));
  /* 選ばなかった匹に頼る相手：パーティ全体で◎○なのに、この選出で△以下 */
  r.lost=D.list.every(x=>x.lost.every(l=>{const j=T.rows.findIndex(z=>z.q.no===l.q.no);return T.rows[j].lvl>=3&&x.rows[j].lvl<=2}));
  /* ★の選出の順位 */
  team.forEach((y,i)=>y.sel=[1,2,3].includes(i));D=dgSelect(team);r.mine=!!D.mine&&D.mineRank>=1&&D.list[D.mineRank-1]===D.mine;team.forEach(y=>y.sel=false);
  /* ダブル：4匹・15通り・先発2匹 */
  FMT='double';D=dgSelect(team);r.double=[D.K===4,D.list.length===15,D.list.every(x=>x.c.length===4),selPlan(team).lead.length===2];FMT='single';
  /* メガストーンを持つ匹は選出に1匹まで・軸は必ず入れる */
  setT(['ガブリアス','ガルーラ','リザードン','サーフゴー','アシレーヌ','カイリュー']);team[0].set={it:{k:'garchompite',n:''},mv:[]};team[1].set={it:{k:'kangaskhanite',n:''},mv:[]};
  D=dgSelect(team);r.mega=D.excluded===4&&D.list.length===16&&D.list.every(x=>!(x.c.includes(0)&&x.c.includes(1)));
  team[3].axis=true;D=dgSelect(team);r.axis=D.list.every(x=>x.c.includes(3));
  /* パーティの天気：天気を作る匹を選ばない選出では、ようりょくそを天気なしで計算 */
  setT(['リザードン','フシギバナ','ルチャブル','ガブリアス','サーフゴー','アシレーヌ']);team[0].set={it:{k:'charizarditey',n:''},mv:[]};team[1].set={ab:{k:'chlorophyll',n:''},mv:[]};TWX_K=null;
  D=dgSelect(team);const fb=D.T.ms.findIndex(o=>o.p.n==='フシギバナ');
  const c1=D.list.find(x=>x.c.includes(fb)&&x.c.includes(D.wxBy)),c2=D.list.find(x=>x.c.includes(fb)&&!x.c.includes(D.wxBy));
  const sp=c=>c.rows.map(y=>y.zs.find(z=>z.i===fb))[0].sa;
  r.wx=[D.gain.length===1,sp(c1)===2*sp(c2)||sp(c1)>sp(c2)*1.9,!c2.wxOk,dgSelWhy(D,c2).warn.some(t=>/天気にならず/.test(t))];
  /* トリックルーム：張れる匹がいる選出だけ trUse */
  setT(['ブリムオン','リキキリン','ドサイドン','ヤドラン','カビゴン','ハッサム']);D=dgSelect(team);
  r.tr=D.tr.on&&D.list.every(x=>x.trUse===D.tr.setters.some(s=>x.c.includes(s.i)));
  return r});
ok(V8.single.every(Boolean),'シングルの選出の比較 '+V8.single);
ok(V8.cnt,'選出の ◎〜× の合計が相手の数と合わない');
ok(V8.recount,'選出の ◎〜× が dgTeam の結果と食い違う');
ok(V8.lead,'先発が選出に入っていない');
ok(V8.plan,'基本選出が選出の比較の1番と違う');
ok(V8.why,'選出の理由に数の根拠がない');
ok(V8.lost,'選ばなかった匹に頼る相手の判定');
ok(V8.mine,'★の選出の順位');
ok(V8.double.every(Boolean),'ダブルの選出の比較 '+V8.double);
ok(V8.mega,'メガストーン2匹の選出を除いていない');
ok(V8.axis,'軸が選出に入っていない');
ok(V8.wx.every(Boolean),'天気を作る匹を選ばない選出の計算 '+V8.wx);
ok(V8.tr,'トリックルームを張れる匹がいる選出だけトリックルーム中で計算');
/* 第5段階の確認（2026/11/10 依頼主）：先発（シングル3通り・ダブル6通り）・順位の決め方・攻撃偏重の6匹の1位とジャラランガ */
const V9=await pg.evaluate(()=>{
  const N=s=>P.find(x=>x.n===s),r={};
  const setT=ns=>{team.length=0;ns.forEach(s=>team.push({no:N(s).no}));TWX_K=null};
  setT(['ガブリアス','サーフゴー','アシレーヌ','ドドゲザン','ウルガモス','カイリュー']);
  let D=dgSelect(team);const T=dgTeam(team,20),W=T.rows.reduce((t,_,j)=>t+(j<8?1.5:1),0);
  /* シングル：3匹それぞれの先発の点を手で数え直す */
  r.lead1=D.list.every(x=>x.lead1.length===3&&x.pairs===null&&x.lead1.every((l,k)=>!k||x.lead1[k-1].sc>=l.sc)&&x.leads[0]===x.lead1[0].i);
  const x0=D.list[2];r.leadRe=x0.lead1.every(l=>{const v=T.rows.reduce((t,row,j)=>{const z=row.res.find(q=>q.i===l.i);const lv=z.r>=4?1:z.r>=3?.6:z.r===2?.25:0,d=z.op&&z.op.nMax===1&&z.spd!==1;return t+(j<8?1.5:1)*(lv-(d?.5:0))},0)/W;return Math.abs(v-l.sc)<1e-9});
  r.planLead1=selPlan(team).lead[0]===D.best.lead1[0].i;
  /* 点の内訳の合計＝点、順位は点の順（同点は×→一撃→◎○→後出し→先手） */
  r.parts=D.list.every(x=>Math.abs(x.P.cov+x.P.sw+x.P.swc+x.P.fast+x.P.danger+x.P.role+x.P.over-x.sc)<1e-9);
  r.order=D.list.every((x,k)=>{if(!k)return true;const a=D.list[k-1];if(Math.abs(a.sc-x.sc)>=.001)return a.sc>x.sc;return a.cnt[1]<x.cnt[1]||(a.cnt[1]===x.cnt[1]&&(a.danger.length<x.danger.length||(a.danger.length===x.danger.length&&(a.cnt[4]+a.cnt[3]>=x.cnt[4]+x.cnt[3]))))});
  r.cmp=/点の内訳/.test(dgSelCmpHTML(D,D.list[0],D.list[1]))&&/×が少ない→/.test(dgSelCmpHTML(D,D.list[0],D.list[1]));
  /* ダブル：4匹の選出ごとに先発2匹の6通り。先発2匹＋後ろ2匹＝選出の4匹 */
  FMT='double';D=dgSelect(team);
  r.pairs=D.list.every(x=>x.pairs.length===6&&x.pairs.every(p=>p.pr.length===2&&p.back.length===2&&[...p.pr,...p.back].sort().join()===[...x.c].sort().join())&&new Set(x.pairs.map(p=>p.pr.join())).size===6&&x.pairs.every((p,k)=>!k||x.pairs[k-1].sc>=p.sc));
  const pl=selPlan(team);r.planPair=pl.lead.length===2&&pl.lead.every(i=>D.best.pairs[0].pr.includes(i))&&pl.base.length===4;
  const h=dgLeadHTML(D,D.best);r.pairHTML=/先発2匹：6通り/.test(h)&&(h.match(/class="sel-c/g)||[]).length===6;
  FMT='single';
  /* 攻撃偏重の6匹（固定の型）：1位とジャラランガ */
  const sets={ドラパルト:['clear-body','lifeorb',['dragondarts','phantomforce','uturn','suckerpunch'],[2,32,0,0,0,32],1,3],オオニューラ:['unburden','focussash',['closecombat','direclaw','fakeout','throatchop'],[2,32,0,0,0,32],5,3],マスカーニャ:['protean','choicescarf',['flowertrick','knockoff','uturn','playrough'],[2,32,0,0,0,32],5,3],ガブリアス:['rough-skin','garchompite',['earthquake','dragonclaw','stoneedge','swordsdance'],[2,32,0,0,0,32],5,3],ウルガモス:['flame-body','expertbelt',['quiverdance','fierydance','bugbuzz','gigadrain'],[2,0,0,32,0,32],5,1],ドドゲザン:['supreme-overlord','blackglasses',['kowtowcleave','ironhead','suckerpunch','swordsdance'],[32,32,0,0,2,0],1,3]};
  team.length=0;Object.entries(sets).forEach(([n,[ab,it,mv,sp,up,dn]])=>team.push({no:N(n).no,set:{ab:{k:ab,n:ABN[ab]},it:{k:it,n:ITEMN[it]},mv:mv.map(lfId).map(id=>({id,n:mName(id)})),sp,up,dn}}));TWX_K=null;
  D=dgSelect(team);const nm=D.nm,T2=dgTeam(team,20);
  r.best=D.best.c.map(nm).sort().join('・');
  const jr=T2.rows.findIndex(row=>row.q.n==='ジャラランガ'),L=D.best.lost.find(l=>l.q.n==='ジャラランガ');
  const by=L?L.by.map(nm).sort().join('・'):'';
  r.jr=[!!L,by,T2.rows[jr].lvl,D.best.rows[jr].lvl,T2.rows[jr].res.filter(z=>z.r>=4).map(z=>nm(z.i)).sort().join('・'),D.best.rows[jr].zs.every(z=>z.r<4)];
  /* 遅いのに先制技のとどめで倒すときは「上から」と書かない（ドドゲザン 対 ボーマンダ） */
  const bm=T2.rows.find(row=>row.q.n==='ボーマンダ'),dd=bm&&bm.res.find(z=>nm(z.i)==='ドドゲザン');
  r.label=!dd||dd.k!=='ko_fast'||(dd.spd!==1&&/先制技のとどめ/.test(dd.t)&&!/^上から/.test(dd.t));
  return r});
ok(V9.lead1&&V9.leadRe,'シングルの先発の比較（3匹それぞれ・点の数え直し） '+[V9.lead1,V9.leadRe]);
ok(V9.planLead1,'基本選出の先発が先発の比較の1番と違う');
ok(V9.parts,'点の内訳の合計が点と合わない');
ok(V9.order,'選出の順位（点の順・同点の決め方）');
ok(V9.cmp,'1番と2番の点の内訳の表示');
ok(V9.pairs,'ダブルの先発2匹の6通り');
ok(V9.planPair,'ダブルの基本選出の先発2匹');
ok(V9.pairHTML,'ダブルの先発の比較の表示');
ok(V9.best==='オオニューラ・ガブリアス・ドドゲザン','攻撃偏重の6匹の1位 '+V9.best);
ok(V9.jr[0]&&V9.jr[1]==='ドラパルト・マスカーニャ'&&V9.jr[2]===4&&V9.jr[3]<=2&&V9.jr[4]==='ドラパルト・マスカーニャ'&&V9.jr[5],'ジャラランガを選ばなかった匹に頼っている表示 '+JSON.stringify(V9.jr));
ok(V9.label,'遅いのに「上から」と書いている');
/* 第5段階の完成確認（2026/11/10 依頼主）：カイリューのマルチスケイル・連続技・特性が分からない相手・ダブルの簡易比較の説明 */
const V10=await pg.evaluate(()=>{
  const N=s=>P.find(x=>x.n===s),r={};
  const sets={ドラパルト:['clear-body','lifeorb',['dragondarts','phantomforce','uturn','suckerpunch'],[2,32,0,0,0,32],1,3],オオニューラ:['unburden','focussash',['closecombat','direclaw','fakeout','throatchop'],[2,32,0,0,0,32],5,3],マスカーニャ:['protean','choicescarf',['flowertrick','knockoff','uturn','playrough'],[2,32,0,0,0,32],5,3],ガブリアス:['rough-skin','garchompite',['earthquake','dragonclaw','stoneedge','swordsdance'],[2,32,0,0,0,32],5,3],ウルガモス:['flame-body','expertbelt',['quiverdance','fierydance','bugbuzz','gigadrain'],[2,0,0,32,0,32],5,1],ドドゲザン:['supreme-overlord','blackglasses',['kowtowcleave','ironhead','suckerpunch','swordsdance'],[32,32,0,0,2,0],1,3]};
  team.length=0;Object.entries(sets).forEach(([n,[ab,it,mv,sp,up,dn]])=>team.push({no:N(n).no,set:{ab:{k:ab,n:ABN[ab]},it:{k:it,n:ITEMN[it]},mv:mv.map(lfId).map(id=>({id,n:mName(id)})),sp,up,dn}}));TWX_K=null;
  const T=dgTeam0(team,20),nm=i=>T.ms[i].p.n,row=T.rows.find(x=>x.q.n==='カイリュー');
  const zi=n=>row.res.find(z=>nm(z.i)===n);
  /* 集計がないので特性が分からない → こちらに不利なマルチスケイルで計算 */
  r.ab=[!row.live,row.o.ab,row.abAssume&&row.abAssume.ab,row.abAssume&&row.abAssume.auto];
  /* ガブリアスのドラゴンクロー：1発目は半分（マルチスケイル）で一撃にならない → 上から一撃にしない */
  const g=zi('ガブリアス');r.garchomp=[g.me.half==='multiscale',Math.abs(g.me.fmin-g.me.min/2)<1e-9,g.me.min>=100&&g.me.fmax<100,g.me.nMin===2,g.k!=='ko_fast',!/上から一撃/.test(g.t)];
  /* マルチスケイルなしなら一撃（適用前と後の違い） */
  const o2={...row.o,ab:'inner-focus'},g2=dgMatch(T.M[T.ms.findIndex(m=>m.p.n==='ガブリアス')],o2);r.before=[g2.me.half===null,g2.me.nMin===1,g2.k==='ko_fast'];
  /* 連続技（ドラゴンアロー2回）：最初の1回だけ半分＝1発目は 0.75倍。duTurns も同じ数え方 */
  const d=zi('ドラパルト');r.darts=[d.me.h===2,Math.abs(d.me.fmin-(d.me.hit1[0]+d.me.hitN[0])/d.me.hpMax*100)<1e-9,d.me.nMin===duTurns(d.me.min,{mv:d.me.mv,acc:100},T.M[d.i],row.o)];
  /* 先発の理由に、マルチスケイルのカイリューを「上から一撃」と書かない・1発目と2発目を分けて書く */
  const D=dgSelect(team),h=dgLeadHTML(D,D.best);
  r.lead=!/カイリュー → ガブリアス：上から一撃/.test(h);
  r.ztxt=/1発目.*マルチスケイルでHP満タンのときは半分.*2発目から/.test(dgZTxt(D,g));
  r.dfill=(()=>{dgFill(team);return true})();
  r.premise=/こちらにいちばん不利な特性で計算/.test(dgPremise(T));
  /* ダブルの先発の比較：簡易比較で、未計算のことと「いつも最適とは限らない」を書く */
  FMT='double';const E=dgSelect(team),hd=dgLeadHTML(E,E.best);FMT='single';
  r.dbl=[/簡易比較/.test(hd),/範囲技/.test(hd)&&/同時に攻撃/.test(hd)&&/味方のサポート/.test(hd)&&/まもる/.test(hd),/勝率や実戦での強さではなく/.test(hd),/いつも最適な先発とは限りません/.test(hd),!/最適な先発です/.test(hd),/同時に1匹を狙う場合は数えていません/.test(hd)];
  /* 1発で倒しきれない連続技でない相手：マルチスケイルの数え方が前と同じ（1回の技なら初撃半分） */
  const one=dgMatch(T.M[T.ms.findIndex(m=>m.p.n==='ガブリアス')],row.o);r.single=Math.abs(one.me.fmin*2-one.me.min)<1e-9;
  return r});
ok(V10.ab[0]&&V10.ab[1]==='multiscale'&&V10.ab[2]==='multiscale'&&V10.ab[3]==='inner-focus','集計のないカイリューの特性 '+V10.ab);
ok(V10.garchomp.every(Boolean),'マルチスケイルのカイリューにガブリアスが上から一撃になっている '+V10.garchomp);
ok(V10.before.every(Boolean),'マルチスケイルなしのカイリューには一撃 '+V10.before);
ok(V10.darts.every(Boolean),'連続技とマルチスケイル（最初の1回だけ半分） '+V10.darts);
ok(V10.lead&&V10.ztxt,'先発の理由のマルチスケイル '+[V10.lead,V10.ztxt]);
ok(V10.premise,'特性が分からない相手の前提が書かれていない');
ok(V10.dbl.every(Boolean),'ダブルの先発の比較の説明（簡易比較・未計算） '+V10.dbl);
ok(V10.single,'1回の技のマルチスケイル');
/* 2026/11/10 依頼主の確認：ドラゴンアロー（1回で2回当たる）とマルチスケイル。1回目の当たりだけ半分・2回目は半分にならない・合計で回数を数える */
const V11=await pg.evaluate(()=>{
  const N=s=>P.find(x=>x.n===s),r={};
  const set={ab:'clear-body',item:'lifeorb',moves:['dragondarts','phantomforce','uturn','suckerpunch'].map(lfId).map(mvObj),sp:[2,32,0,0,0,32],up:1,dn:3};
  const a=mkMon(N('ドラパルト'),'me',set),mv=a.moves[0];
  const dr=ab=>mkMon(N('カイリュー'),'op',{...detSet(N('カイリュー')),ab,item:null});
  const d=dr('multiscale'),dn=dr('inner-focus');
  /* 手で：乱数16段階ずつ、1回目の当たり（HP満タン）と2回目の当たり（満タンでない）を bcalc で */
  const at=(dd,r,full)=>{const hp=dd.hp;dd.hp=full?dd.max:dd.max-1;try{return bcalc(a,mv,dd,{r}).dmg}finally{dd.hp=hp}};
  const h1=DG_ROLLS.map(q=>at(d,q,true)),h2=DG_ROLLS.map(q=>at(d,q,false)),hn=DG_ROLLS.map(q=>at(dn,q,true));
  r.hit=[h1.every((x,k)=>Math.abs(x-h2[k]/2)<=1),h2.every((x,k)=>x===hn[k])];           /* 1回目は半分（端数は計算の丸め）・2回目は満タンでないので半分にならない＝マルチスケイルなしと同じ */
  const x=dgMove(a,mv,d),L=15;
  r.sum=[x.h===2,x.hit1[0]===h1[0]&&x.hit1[1]===h1[L],x.hitN[0]===h2[0]&&x.hitN[1]===h2[L],Math.abs(x.fmin-(h1[0]+h2[0])/d.max*100)<1e-9,Math.abs(x.fmax-(h1[L]+h2[L])/d.max*100)<1e-9];
  let ko=0;h1.forEach(p=>h2.forEach(q=>{if(p+q>=d.max)ko++}));r.ko=[ko,x.ohko*16];
  /* 1回目の当たりだけでは倒せない（h1 の最大 < HP）のに、合計で確定1発になる */
  r.notHit1=[h1[L]<d.max,h2[L]<d.max,h1[0]+h2[0]>=d.max];
  const dm=dgMatch(a,d);r.match=[dm.me.nMin===1,dm.k==='ko_fast',/1回で2回当たる合計/.test(dm.why.join()),/最初の当たりだけ半分/.test(dm.why.join())];
  /* マルチスケイルなし：合計は2回とも半分にならない（hn×2）＝前の 149〜176% */
  const xn=dgMove(a,mv,dn);r.noMs=[xn.half===null,Math.abs(xn.fmin-hn[0]*2/dn.max*100)<1e-9,Math.abs(xn.min-xn.fmin)<1e-9];
  /* 1回の技（2回当たる）を「2回使う」と数えない：倒すまでの回数は技を使う回数 */
  r.uses=[dgMatch(a,d).me.nMin===1,duTurns(x.min,{mv,acc:100,f:x.fmin},a,d)===1];
  /* 1回目の当たりだけ HP を超えないように弱くした場合：合計でも届かなければ確定1発にしない */
  const weak=mkMon(N('ドラパルト'),'me',{...set,item:null,sp:[2,24,0,0,0,32],up:1,dn:3});const xw=dgMove(weak,weak.moves[0],d),fw=dgMatch(weak,d);
  r.weak=[xw.fmin<100,xw.min>=100,fw.me.nMin>=2];  /* 合計で届かない（マルチスケイルなしなら確定1発）→ 確定2発 */
  /* 3回以上の連続技でもマルチスケイルは最初の当たりだけ（タネマシンガン等：回数は平均の3回で計算） */
  return r});
ok(V11.hit.every(Boolean),'1回目の当たりだけ半分・2回目は半分にならない '+V11.hit);
ok(V11.sum.every(Boolean),'1回目と2回目の当たりを足した1発目のダメージ '+V11.sum);
ok(V11.ko[0]===V11.ko[1],'乱数の組み合わせ（16×16）で一撃の数 '+V11.ko);
ok(V11.notHit1.every(Boolean),'1回目の当たりだけで倒せるとしていない '+V11.notHit1);
ok(V11.match.every(Boolean),'ドラパルト対マルチスケイルのカイリュー '+V11.match);
ok(V11.noMs.every(Boolean),'マルチスケイルなしのドラゴンアロー '+V11.noMs);
ok(V11.uses.every(Boolean),'技を使う回数と当たる回数を混同していない '+V11.uses);
ok(V11.weak.every(Boolean),'合計で届かない連続技を確定1発にしていない '+V11.weak);
/* 第6段階：改善案（変更後を計算し直して比べる） */
const V12=await pg.evaluate(()=>{
  const N=s=>P.find(x=>x.n===s),r={};
  const sets={ドラパルト:['clear-body','lifeorb',['dragondarts','phantomforce','uturn','suckerpunch'],[2,32,0,0,0,32],1,3],オオニューラ:['unburden','focussash',['closecombat','direclaw','fakeout','throatchop'],[2,32,0,0,0,32],5,3],マスカーニャ:['protean','choicescarf',['flowertrick','knockoff','uturn','playrough'],[2,32,0,0,0,32],5,3],ガブリアス:['rough-skin','garchompite',['earthquake','dragonclaw','stoneedge','swordsdance'],[2,32,0,0,0,32],5,3],ウルガモス:['flame-body','expertbelt',['quiverdance','fierydance','bugbuzz','gigadrain'],[2,0,0,32,0,32],5,1],ドドゲザン:['supreme-overlord','blackglasses',['kowtowcleave','ironhead','suckerpunch','swordsdance'],[32,32,0,0,2,0],1,3]};
  const mk=()=>{team.length=0;Object.entries(sets).forEach(([n,[ab,it,mv,sp,up,dn]])=>team.push({no:N(n).no,set:{ab:{k:ab,n:ABN[ab]},it:{k:it,n:ITEMN[it]},mv:mv.map(lfId).map(id=>({id,n:mName(id)})),sp,up,dn}}));TWX_K=null};
  mk();const before=JSON.stringify(team);
  const R=dgImprove(team);const L=R.list.filter(o=>o.kind!=='sel');
  r.n=[L.length>0,JSON.stringify(team)===before];   /* 計算のあと、パーティは元のまま */
  r.kinds=[...new Set(L.map(o=>o.kind))];
  /* 1匹だけ計算し直した結果＝パーティ全体を計算し直した結果 */
  r.recalc=L.every(o=>{const T1=impWith(o.entries,()=>dgTeam0(o.entries,20)),D=dgDiff(R.T0,T1),m=impMetric(T1,D.keep);return ['x','w','nosw','ohko','slow','st'].every(k=>m[k]===o.J.a[k])});
  /* 大事な役目を失わない：◎○→△以下なし・×が増えない・変える匹の役目も大きく減らない */
  r.keep=L.every(o=>!o.J.lost.length&&o.J.a.x<=o.J.b.x&&o.J.gain>.5&&(o.kind==='swap'||!impRoleLoss(R.T0,o.T1,o.i)));
  r.dropped=R.dropped.some(d=>/ガブリアスを耐久の型に/.test(d.title)&&/上から倒せる相手が\d+→0匹/.test(d.loss));
  /* ゲームにある持ち物・覚える技だけ・持ち物が重ならない・メガストーンは変えない */
  r.valid=L.every(o=>{const it=o.entries.map(x=>x.set&&x.set.it&&x.set.it.k).filter(Boolean);
    const okIt=it.every(k=>CH_ITEMS.has(k)||isStone(k))&&new Set(it).size===it.length;
    const st0=team.map(x=>x.set.it.k).filter(isStone).join(),st1=o.kind==='swap'?st0:it.filter(isStone).join();
    const x=o.entries[o.i],ls=(LSD[x.no]||[0,[]])[1];
    const okMv=(x.set.mv||[]).every(m=>m.id===182||ls.includes(m.id))&&!(x.set.mv||[]).some(m=>IMP_NOMV.has(MD[m.id]&&MD[m.id][3]));
    return okIt&&st0===st1&&okMv});
  /* 技の案は、ねこだまし・交代技・先制技を入れかえ先にしない */
  r.keepMv=L.filter(o=>o.kind==='move').every(o=>{const b=o.base.mv.map(m=>m.id),a=o.entries[o.i].set.mv.map(m=>m.id),gone=b.filter(id=>!a.includes(id));return gone.every(id=>{const m=mvObj(id);return !(m.pri>0)&&!IMP_KEEP.has(MD[id][3])})});
  /* 良くなる・悪くなるの両方と、変える匹の変化が出る */
  r.card=L.every(o=>{const h=impCard(o,0);return /悪くなるところ/.test(h)&&(/良くなるところ/.test(h)||o.J.D.up.length===0)&&(o.kind==='swap'||/変える匹の変化/.test(h))});
  r.statDown=L.filter(o=>o.kind==='nat'&&o.T1.M[o.i].st[5]<R.T0.M[o.i].st[5]).every(o=>o.mem.some(m=>m.bad&&/素早さ \d+→\d+/.test(m.t)));
  /* 選出の変え方：★がいちばん良い選出でないとき */
  const S=dgSelect(team),wr=S.list[S.list.length-1].c;team.forEach((x,k)=>x.sel=wr.includes(k));DG_SELC.clear();
  const R2=dgImprove(team);r.sel=R2.list.some(o=>o.kind==='sel'&&o.selFix.join()===S.best.c.join());team.forEach(x=>x.sel=false);DG_SELC.clear();
  /* ダブルでも計算できる・3匹未満は計算しない */
  FMT='double';DG_SELC.clear();const R3=dgImprove(team);FMT='single';DG_SELC.clear();r.dbl=Array.isArray(R3.list);
  r.few=/3匹以上/.test(dgImprove(team.slice(0,2)).note||'');
  /* いちばん頼れる技：同じ回数で倒せるなら命中90以上（だいもんじよりほのおのまい） */
  const v=mkMon(N('ウルガモス'),'me',{ab:'flame-body',item:null,moves:['fireblast','fierydance'].map(lfId).map(mvObj),sp:[2,0,0,32,0,32],up:5,dn:1});
  const tg=mkMon(N('メタグロス'),'op',detSet(N('メタグロス')));const b=dgBest(v,tg);
  const xs=v.moves.map(m=>{const x=dgMove(v,m,tg);return duTurns(x.min,{mv:m,acc:100,f:x.fmin},v,tg)});
  r.acc=xs[0]!==xs[1]||b.mv.id===lfId('fierydance');
  return r});
ok(V12.n.every(Boolean),'改善案が出ない／計算のあとパーティが変わった '+V12.n);
ok(V12.recalc,'改善案の数が、パーティ全体を計算し直した結果と合わない');
ok(V12.keep,'改善案が大事な役目を失わせている');
ok(V12.dropped,'役目を大きく失う案（ガブリアスを耐久の型に）を外していない');
ok(V12.valid,'改善案に、ゲームにない持ち物・覚えない技・重なる持ち物・メガストーンの変更がある');
ok(V12.keepMv,'技の案で先制技・交代技を外している');
ok(V12.card,'改善案に良くなる・悪くなる・変える匹の変化が出ない');
ok(V12.statDown,'性格で素早さが下がることを悪くなるところに出していない');
ok(V12.sel,'選出の変え方の案');
ok(V12.dbl&&V12.few,'ダブル・3匹未満 '+[V12.dbl,V12.few]);
ok(V12.acc,'同じ回数なら命中の高い技を選ぶ');
/* 第6段階：天気・トリックルームのパーティでも、改善案の数＝全体を計算し直した数 */
const V13=await pg.evaluate(()=>{
  const N=s=>P.find(x=>x.n===s),r={};
  const chk=R=>R.list.filter(o=>o.kind!=='sel').every(o=>{const T1=impWith(o.entries,()=>dgTeam0(o.entries,20)),D=dgDiff(R.T0,T1),m=impMetric(T1,D.keep);return ['x','w','nosw','ohko','slow','st'].every(k=>m[k]===o.J.a[k])});
  team.length=0;['リザードン','フシギバナ','ルチャブル','ガブリアス','サーフゴー','アシレーヌ'].forEach(s=>team.push({no:N(s).no}));team[0].set={it:{k:'charizarditey',n:''},mv:[]};team[1].set={ab:{k:'chlorophyll',n:''},mv:[]};TWX_K=null;DG_SELC.clear();
  let R=dgImprove(team);r.wx=[chk(R),R.list.length];
  team.length=0;['ブリムオン','リキキリン','ドサイドン','ヤドラン','カビゴン','ハッサム'].forEach(s=>team.push({no:N(s).no}));TWX_K=null;DG_SELC.clear();
  R=dgImprove(team);r.tr=[chk(R),R.list.length];
  return r});
ok(V13.wx[0],'天気のパーティの改善案の計算し直し '+V13.wx);
ok(V13.tr[0],'トリックルームのパーティの改善案の計算し直し '+V13.tr);
/* 名前の検索：小さい字・ひらがな・半角でも正式名が出る（2026/11/10 ウィンディ→ウインディ） */
const NS=await pg.evaluate(()=>[['ウィンディ',59],['うぃんでぃ',10230],['ﾐﾐｯｷｭ',null],['ガブ',445]].map(([q,no])=>{const h=P.filter(p=>nmHit(p,q));return no?h.some(p=>p.no===no):h.length>0}));
ok(NS.every(Boolean),'名前の検索（小さい字・半角） '+NS);
/* 11. 画面：パーティの「チェック」に出る・データ不足を書く */
await pg.evaluate(()=>{team.length=0;['ガブリアス','サーフゴー','アシレーヌ'].forEach(s=>team.push({no:P.find(x=>x.n===s).no}));saveTeam();sessionStorage.setItem('pcttab','check');TTAB='check';location.hash='#/team'});
await pg.waitForTimeout(1500);
const ui=await pg.evaluate(()=>{const e=document.getElementById('dg-box');return e?[e.querySelectorAll('.dg-r').length,/集計を読めていません/.test(e.textContent)]:[0,false]});
ok(ui[0]>0,'パーティのチェックに「相手ごとの対応力」が出ません');
ok(ui[1],'集計が読めないことが書かれていません');
await pg.evaluate(()=>{team.length=0;['ガブリアス','サーフゴー','アシレーヌ','ドドゲザン','ウルガモス','カイリュー'].forEach(s=>team.push({no:P.find(x=>x.n===s).no}));saveTeam();sessionStorage.setItem('pcttab','plan');TTAB='plan';teamRender()});
await pg.waitForTimeout(1500);
const ui2=await pg.evaluate(()=>{const e=document.querySelector('.sel-box');return e?[/20通りを計算/.test(e.textContent),e.querySelectorAll('.sel-all .sel-c').length]:[false,0]});
ok(ui2[0]&&ui2[1]===20,'構築と選出タブに選出の比較が出ない '+ui2);
/* UI改善 第4段階：選出の比較の見せ方（数は dgSelect のまま・先発の行・2番目との違い・はみ出さない） */
const U4=await pg.evaluate(()=>{const e=document.getElementById('sel-box'),S=dgSelect(team),B=S.best,R2=S.list[1],r={};
  r.mons=[...e.querySelectorAll('.selu-best .dgu-mon')].map(x=>x.firstChild.textContent).join('・')===B.c.map(S.nm).join('・');
  r.bars=[4,3,2,1].every(l=>e.querySelector('.selu-best .dgu-l'+l+' .dgu-bn').textContent.startsWith(B.cnt[l]+'匹'));
  const k=[...e.querySelectorAll('.selu-kpi b')].map(x=>parseInt(x.textContent));r.kpi=k.join()===[B.sw,B.fast,B.danger.length,B.cnt[1]].join();
  r.lead=e.querySelectorAll('.selu-sub .selu-row').length===B.lead1.length;
  const better=B.rows.filter((y,j)=>y.lvl>R2.rows[j].lvl).length,worse=B.rows.filter((y,j)=>y.lvl<R2.rows[j].lvl).length;
  r.cmp=e.querySelectorAll('.selu-sub .selu-g').length>=better&&new RegExp('1番の方が良い相手（'+better+'匹）').test(e.textContent)&&new RegExp('2番の方が良い相手（'+worse+'匹）').test(e.textContent);
  r.over=document.body.scrollWidth<=innerWidth;return r});
ok(Object.values(U4).every(Boolean),'選出の比較の見せ方 '+JSON.stringify(U4));
await pg.evaluate(()=>{sessionStorage.setItem('pcttab','check');TTAB='check';teamRender()});await pg.waitForTimeout(800);
/* 診断のまとめが後ろで計算して一覧も出すので、ボタンが残っているときだけ押す */
await pg.waitForTimeout(4000);if(await pg.$('#imp-run'))await pg.click('#imp-run');await pg.waitForTimeout(1500);
const ui3=await pg.evaluate(()=>[document.querySelectorAll('#imp-box .imp-c').length,document.querySelectorAll('#imp-box [data-imp]').length,/計算していないこと/.test(document.getElementById('imp-box').textContent)]);
ok(ui3[0]>=0&&ui3[1]===ui3[0]&&ui3[2],'改善案の画面 '+ui3);
ok(!errs.length,'画面のエラー: '+errs.join(' / '));
/* UI改善 第1段階：診断のまとめ（数字は計算結果と同じ・深刻な弱点の順番・選出・改善案の後ろ計算と使い回し・スマホではみ出さない） */
await pg.evaluate(()=>{const N=s=>P.find(x=>x.n===s);const sets={ドラパルト:['clear-body','lifeorb',['dragondarts','phantomforce','uturn','suckerpunch'],[2,32,0,0,0,32],1,3],オオニューラ:['unburden','focussash',['closecombat','direclaw','fakeout','throatchop'],[2,32,0,0,0,32],5,3],マスカーニャ:['protean','choicescarf',['flowertrick','knockoff','uturn','playrough'],[2,32,0,0,0,32],5,3],ガブリアス:['rough-skin','garchompite',['earthquake','dragonclaw','stoneedge','swordsdance'],[2,32,0,0,0,32],5,3],ウルガモス:['flame-body','expertbelt',['quiverdance','fierydance','bugbuzz','gigadrain'],[2,0,0,32,0,32],5,1],ドドゲザン:['supreme-overlord','blackglasses',['kowtowcleave','ironhead','suckerpunch','swordsdance'],[32,32,0,0,2,0],1,3]};
  team.length=0;Object.entries(sets).forEach(([n,[ab,it,mv,sp,up,dn]])=>team.push({no:N(n).no,set:{ab:{k:ab,n:ABN[ab]},it:{k:it,n:ITEMN[it]},mv:mv.map(lfId).map(id=>({id,n:mName(id)})),sp,up,dn}}));
  TWX_K=null;IMP_CACHE.clear();DG_SELC.clear();saveTeam();sessionStorage.setItem('pcttab','check');TTAB='check';teamRender()});
const U0=await pg.evaluate(async()=>{await new Promise(r=>setTimeout(r,20));const e=document.getElementById('dgu-sum'),i=document.getElementById('dgu-imp');return [!!e,!!i&&/計算中/.test(i.textContent)]});
await pg.waitForTimeout(4500);
const U=await pg.evaluate(()=>{const r={},box=document.getElementById('dgu-sum'),T=dgTeam(team,20),A=dgAnalyze(T),C=partyCheck(team),S=dgSelect(team);
  const cnt={1:0,2:0,3:0,4:0};T.rows.forEach(x=>cnt[x.lvl]++);
  r.bars=[4,3,2,1].every(l=>{const b=box.querySelector('.dgu-l'+l+' .dgu-bn').textContent;return b.startsWith(cnt[l]+'匹')&&b.includes('（'+Math.round(cnt[l]/T.rows.length*100)+'%）')});
  r.areas=[...box.querySelectorAll('.dgu-area')].map(a=>{const n=a.querySelector('.dgu-an').textContent,s=Math.max(0,...A.bad.filter(x=>x.area===n).map(x=>x.sev));return a.querySelector('.dgu-sev').textContent.includes(DGU_SEV[s][0])}).every(Boolean);
  const calc=C.fix.filter(x=>x.k==='calc');
  r.weak=[...box.querySelectorAll('.dgu-weak .dgu-wt')].map(x=>x.textContent).join('|')===calc.slice(0,3).map(x=>x.t.replace(/<[^>]+>/g,'')).join('|');
  r.order=calc.every((x,k)=>!k||calc[k-1].sev>=x.sev);
  r.jump=[...box.querySelectorAll('[data-dgu-go]')].every(a=>!!document.getElementById(a.dataset.dguGo));
  r.sel=[...box.querySelectorAll('.dgu-mon')].map(x=>x.firstChild.textContent).join('・')===S.best.c.map(S.nm).join('・')&&box.querySelector('.dgu-lead').firstChild.textContent===S.nm(S.best.lead1[0].i);
  const R=impCached(team);r.imp=!!R&&!!R.list.length&&document.querySelector('#dgu-imp .dgu-it b').textContent===R.list[0].title&&document.querySelectorAll('#imp-box .imp-c').length===R.list.length;
  r.reuse=impGet(team)===R;
  r.over=document.body.scrollWidth<=innerWidth;
  r.top=box.getBoundingClientRect().top<document.getElementById('dg-box').getBoundingClientRect().top;
  return r});
ok(U0[0]&&U0[1],'診断のまとめ・改善案の「計算中」 '+U0);
ok(U.bars,'まとめの◎○△×の匹数・割合が計算と違う');
ok(U.areas,'まとめの4分野の状態が気になる点の重要度と違う');
ok(U.weak&&U.order,'まとめの深刻な弱点の並び '+[U.weak,U.order]);
ok(U.jump,'まとめの弱点から下のカードへ移れない');
ok(U.sel,'まとめのおすすめの選出が選出の比較の1番と違う');
ok(U.imp&&U.reuse,'まとめの改善案（後ろで計算・使い回し） '+[U.imp,U.reuse]);
ok(U.over,'スマホ幅で横にはみ出している');
ok(U.top,'まとめが一番上にない');
/* UI改善 第5段階：改善案のカード（変更前→変更後の数は計算と同じ・上位3件・残りはたたむ・悪くなるところはいつも見える） */
const U5=await pg.evaluate(()=>{const R=impCached(team),box=document.getElementById('imp-box'),r={};if(!R||!R.list.length)return{none:true};
  const cards=[...box.querySelectorAll('.imp-c')];r.n=cards.length===R.list.length;
  r.vis=box.querySelectorAll(':scope > .imp-c').length===Math.min(3,R.list.length)&&(R.list.length<=3||!!box.querySelector('.imp-more .imp-c'));
  r.met=R.list.every((o,k)=>{const rows=[...cards[k].querySelectorAll('.imp-mr')];const want=IMP_MET.filter(([key])=>o.J.b[key]!=null&&o.J.a[key]!=null&&o.J.b[key]!==o.J.a[key]);
    return rows.length===want.length&&want.every(([key,,low],j)=>{const t=rows[j].querySelector('.imp-mv').textContent;return t.startsWith(o.J.b[key]+'→'+o.J.a[key])&&rows[j].classList.contains((low?o.J.a[key]<o.J.b[key]:o.J.a[key]>o.J.b[key])?'up':'dn')})});
  r.dn=cards.every(c=>{const d=c.querySelector('.imp-d');return d&&!d.closest('details:not(.imp-more)')});
  r.btn=cards.every((c,k)=>c.querySelector('[data-imp]').dataset.imp===String(k));
  r.over=document.body.scrollWidth<=innerWidth;return r});
ok(U5.none||Object.values(U5).every(Boolean),'改善案のカード '+JSON.stringify(U5));
/* UI改善 第2段階：弱点のカード（根拠は全部残す・起きる相手の数・理由と改善の出し方・開いても数字が変わらない） */
const U2=await pg.evaluate(()=>{const r={},C=partyCheck(team),calc=C.fix.filter(x=>x.k==='calc');
  r.cards=calc.every((x,k)=>{const e=document.getElementById('pcw'+k);if(!e)return false;const txt=e.textContent;
    const evOk=(x.ev||[]).every(v=>txt.includes(v));
    const tOk=e.querySelector('.dgc-t').textContent===x.t.replace(/<[^>]+>/g,'');
    const cls=e.classList.contains('dgc-s'+x.sev);
    /* 深刻・注意は理由と改善が最初から見える（たたむ中ではない）、軽いはたたむ */
    const rows=[...e.querySelectorAll(':scope > .dgc-row .dgc-k')].map(z=>z.textContent);
    const vis=x.sev>=2?(!x.d||rows.includes('理由'))&&(!x.how||rows.includes('改善する方法')):!rows.includes('理由');
    const ops=!x.opps||(e.querySelectorAll('.dgc-op').length===Math.min(6,x.opps.length)&&(x.opps.length<=6||txt.includes('ほか'+(x.opps.length-6)+'匹')));
    return evOk&&tOk&&cls&&vis&&ops});
  /* 見出しの「相手がN匹」と起きる相手の数が合う */
  r.oppsN=calc.filter(x=>/相手が(\d+)匹/.test(x.t)&&x.opps).every(x=>+x.t.match(/相手が(\d+)匹/)[1]===x.opps.length);
  const T=dgTeam(team,20),names=new Set(T.rows.map(z=>z.q.n));r.oppsIn=calc.every(x=>(x.opps||[]).every(n=>names.has(n)));
  r.good=C.good.every(x=>[...document.querySelectorAll('.dgc-ok .dgc-t')].some(e=>e.textContent===x.t.replace(/<[^>]+>/g,'')));
  r.lose=!!document.querySelector('#lose-box .ls-more')&&/数え方/.test(document.querySelector('#lose-box .ls-more summary').textContent);
  const bars0=[...document.querySelectorAll('.dgu-bn')].map(e=>e.textContent).join();
  document.querySelectorAll('#view details').forEach(d=>d.open=true);
  r.open=[...document.querySelectorAll('.dgu-bn')].map(e=>e.textContent).join()===bars0&&document.body.scrollWidth<=innerWidth;
  document.querySelectorAll('#view details').forEach(d=>d.open=false);
  return r});
ok(U2.cards,'弱点のカード（根拠・見出し・重要度・理由と改善・起きる相手）');
ok(U2.oppsN&&U2.oppsIn,'起きる相手の数と見出しの数 '+[U2.oppsN,U2.oppsIn]);
ok(U2.good,'よいところのカード');
ok(U2.lose,'敗因の診断の説明をたたむ');
ok(U2.open,'たたんだ所を全部開いても数字が変わらず、はみ出さない');
/* 「〇〇の対策を見る」はサイトの中の図鑑の対策タブ（サイトの外のページに飛ばない・左上の←で戻れる）（2026/11/10 依頼主） */
const BK=await pg.evaluate(async()=>{const N=s=>P.find(x=>x.n===s);const keep=team.slice();team.length=0;['ピカチュウ','ヤドラン','ニャオニクス（オス）'].forEach(s=>team.push({no:N(s).no}));TWX_K=null;
  const R=loseReasons(team),acts=R.flatMap(r=>r.act||[]).map(a=>a[0]);team.length=0;keep.forEach(x=>team.push(x));TWX_K=null;
  const noOut=acts.every(h=>h.startsWith('#/'));const br=acts.find(h=>/\/break$/.test(h));
  location.hash=br||'#/p/149/break';await new Promise(r=>setTimeout(r,900));
  const tab=document.querySelector('#seg [aria-selected="true"]').textContent,back=!!document.querySelector('a[data-back]');
  return [noOut,!!br,tab,back,twInApp('https://pokechan-hub.pages.dev/ranking/'),twInApp('https://news.pokemon-home.com/ja/page/1.html')]});
ok(BK[0]&&BK[1]&&BK[2]==='対策'&&BK[3]&&BK[4]==='#/tier'&&BK[5]===null,'対策を見るボタンの行き先と戻り方 '+JSON.stringify(BK));
await pg.evaluate(()=>{location.hash='#/team'});await pg.waitForTimeout(800);
/* UI改善 第3段階：相手ごとの対応力（横棒・一覧はたたむ・1匹ずつの表の数字は計算と同じ・根拠は全部残す） */
const U3=await pg.evaluate(()=>{const r={},T=dgTeam(team,20),box=document.getElementById('dg-box');
  const cnt={1:0,2:0,3:0,4:0};T.rows.forEach(x=>cnt[x.lvl]++);
  r.bars=[4,3,2,1].every(l=>box.querySelector('.dgu-l'+l+' .dgu-bn').textContent.startsWith(cnt[l]+'匹'));
  const list=box.querySelector('.dg-list');r.fold=!!list&&!list.open&&list.querySelectorAll(':scope > .dg-r').length===T.rows.length;
  const order=[...T.rows].sort((a,b)=>a.lvl-b.lvl);
  r.tables=[...list.querySelectorAll(':scope > .dg-r')].every((el,j)=>{const row=order[j],all=[...row.res].sort((a,b)=>b.r-a.r),ms=[...el.querySelectorAll('.dgm')];
    if(ms.length!==all.length)return false;
    return ms.every((m,k)=>{const z=all[k],dd=[...m.querySelectorAll('dd')].map(d=>d.textContent),txt=m.textContent;
      const ko=!z.me?'—':z.me.nMin===1?'100%（確定）':z.me.nMax===1?Math.round(z.me.ohko/16*100)+'%':'0%（一撃では倒せない）';
      return dd[0]===(z.me?z.me.mvn:'効く技がない')&&dd[2]===ko&&dd[3]===(z.me?dgKoTxt(z.me):'—')&&dd[5].includes(String(z.sa))&&dd[5].includes(String(z.so))&&z.why.every(w=>txt.includes(w))})});
  list.open=true;list.querySelectorAll('details').forEach(d=>d.open=true);r.over=document.body.scrollWidth<=innerWidth;
  list.querySelectorAll('details').forEach(d=>d.open=false);list.open=false;
  return r});
ok(U3.bars,'対応力の横棒の匹数');
ok(U3.fold,'相手ごとの一覧をたたんで全部の相手を入れる');
ok(U3.tables,'1匹ずつの表の数字が計算と違う／根拠が欠けている');
ok(U3.over,'表を全部開いたときにスマホ幅からはみ出す');
/* 改善案の計算に失敗したとき：もう一度計算できる */
await pg.evaluate(()=>{IMP_CACHE.clear();window.__impG=impGet;impGet=()=>{throw new Error('test')};teamRender()});await pg.waitForTimeout(2500);
const RT0=await pg.evaluate(()=>!!document.getElementById('dgu-retry'));
await pg.evaluate(()=>{impGet=window.__impG;document.getElementById('dgu-retry').click()});await pg.waitForTimeout(3000);
const RT1=await pg.evaluate(()=>!!document.querySelector('#dgu-imp .dgu-it'));
ok(RT0&&RT1,'改善案の計算に失敗したときの再試行 '+[RT0,RT1]);
await b.close();
if(bad){console.error(`diag: ${bad}/${n} 項目が失敗`);process.exit(1)}
console.log(`diag: OK（${n}項目）`);
