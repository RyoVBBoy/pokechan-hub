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
  const z=(i,o)=>({i,k:'lose',r:1,t:'',why:[''],me:null,op:null,spd:-1,first:-1,sa:100,so:120,myN:9,opW:1,pr:null,...o});
  const kill=i=>z(i,{me:{mv,min:60,max:70,nMin:2,nMax:2,ohko:0},op:{mv,min:50,max:60,nMin:2,nMax:2,eff:1},opW:2,myN:2,first:1,spd:1,sa:150,k:'ko_fast',r:5});
  const tank=i=>z(i,{op:{mv,min:20,max:25,nMin:4,nMax:4,eff:.5},opW:4,me:{mv,min:20,max:25,nMin:4,nMax:4,ohko:0},myN:4,k:'wall',r:3});
  const T={ms:[mon(0),mon(1),mon(2)],rows:[0,1,2,3].map(j=>({q:{n:'相手'+j},o:{},res:[kill(0),tank(1),z(2)],lvl:3})),unk:[],live:false,liveAll:false};
  const A=dgAnalyze(T),ts=A.bad.map(x=>x.t);
  r.soleK=ts.some(t=>/だけが確定2発で倒せる相手が4匹/.test(t));
  r.soleS=ts.some(t=>/後出しできるのが.*だけの相手が4匹/.test(t));
  r.soleF=ts.some(t=>/先に動けるのが.*だけの相手が4匹/.test(t));
  r.noBad=!ts.some(t=>/確定2発で倒せるポケモンがいない/.test(t))&&!ts.some(t=>/後出しできる匹がいない/.test(t));
  /* 全員が遅く、先制技で確定で倒せるとき */
  const T2={...T,rows:T.rows.map(row=>({...row,res:row.res.map(x=>({...x,spd:-1,first:-1,pr:x.i===0?{mv,min:120,max:140}:null}))}))};
  const sp=dgAnalyze(T2).bad.find(x=>/だれよりも速い相手/.test(x.t));r.prio=!!sp&&/先制技で確定で倒せます/.test(sp.d)&&sp.sev<=2;
  /* 実際のパーティ：計算の項目が dgTeam の数と合う・タイプだけの気になる点には計算の根拠がある */
  team.length=0;['ガブリアス','サーフゴー','アシレーヌ','ドドゲザン','ウルガモス','カイリュー'].forEach(s=>team.push({no:N(s).no}));
  const C=partyCheck(team),DT=dgTeam(team,20);
  const noSw=DT.rows.filter(row=>!row.res.some(x=>x.opW>=3)).length,noK=DT.rows.filter(row=>!row.res.some(x=>x.me&&x.me.nMin<=2)).length;
  const f1=C.fix.find(x=>/後出しできる匹がいない相手/.test(x.t)),f2=C.fix.find(x=>/確定2発で倒せるポケモンがいない/.test(x.t));
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
