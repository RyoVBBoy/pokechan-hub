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
/* 名前の検索：小さい字・ひらがな・半角でも正式名が出る（2026/11/10 ウィンディ→ウインディ） */
const NS=await pg.evaluate(()=>[['ウィンディ',59],['うぃんでぃ',10230],['ﾐﾐｯｷｭ',null],['ガブ',445]].map(([q,no])=>{const h=P.filter(p=>nmHit(p,q));return no?h.some(p=>p.no===no):h.length>0}));
ok(NS.every(Boolean),'名前の検索（小さい字・半角） '+NS);
/* 11. 画面：パーティの「チェック」に出る・データ不足を書く */
await pg.evaluate(()=>{team.length=0;['ガブリアス','サーフゴー','アシレーヌ'].forEach(s=>team.push({no:P.find(x=>x.n===s).no}));saveTeam();sessionStorage.setItem('pcttab','check');TTAB='check';location.hash='#/team'});
await pg.waitForTimeout(1500);
const ui=await pg.evaluate(()=>{const e=document.getElementById('dg-box');return e?[e.querySelectorAll('.dg-r').length,/集計を読めていません/.test(e.textContent)]:[0,false]});
ok(ui[0]>0,'パーティのチェックに「相手ごとの対応力」が出ません');
ok(ui[1],'集計が読めないことが書かれていません');
ok(!errs.length,'画面のエラー: '+errs.join(' / '));
await b.close();
if(bad){console.error(`diag: ${bad}/${n} 項目が失敗`);process.exit(1)}
console.log(`diag: OK（${n}項目）`);
