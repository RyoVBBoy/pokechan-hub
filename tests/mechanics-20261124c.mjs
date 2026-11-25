// 2026/11/24（3回目）：共通の計算の部品（15-battle.js の hitStep・bhits・hitCountDist・hitDist・nextUse・useSeq、21-calc.js の dmgRolls・koInfo、60-diag.js の dgMove）の決まった場面。
// 期待値は、当サイトの計算を使わずに bcalc（1発ずつ）を手で並べた数、または参照（Pokémon Showdown e7f50cd）の決まりから出した数。チャンピオンズの実機で確かめたものではない。
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const pg=await (await b.newContext({locale:'ja-JP'})).newPage();
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.route(/^https?:/,r=>r.abort());
await pg.goto('file://'+path.join(ROOT,'dist/index.html')+'#/team');await pg.waitForTimeout(800);
let n=0,bad=0;const ok=(c,m,info)=>{n++;if(!c){bad++;console.error('NG',m,info===undefined?'':JSON.stringify(info).slice(0,700))}};
const R=await pg.evaluate(()=>{const o={};const id=k=>+Object.keys(MD).find(i=>MD[i][3]===k);const M=k=>mvObj(id(k));
  const N=nm=>P.find(x=>x.n===nm)||byNo[nm];
  /* 実数値をそのまま入れる（性格・ポイントの式は別のテストで確かめる） */
  const mon=(p,side,ab,st,extra)=>{const m=mkMon(p,side,{ab,item:null,moves:[],sp:[0,0,0,0,0,0],up:-1,dn:-1,...(extra||{})});if(st){m.st=[...st];m.hp=m.max=st[0]}if(extra&&extra.item!==undefined)m.item=extra.item;return m};
  const snap=x=>JSON.stringify([x.hp,x.item,x.disg,x.stg,x.st,x.ab,x.status]);
  /* 1 ドデカバシ（スキルリンク）タネマシンガン → じきゅうりょくのバンバドロ：防御が当たるたびに上がる */
  {const A=mon(N('ドデカバシ'),'me','skill-link',[157,172,95,95,95,112]),D=mon(N('バンバドロ'),'op','stamina',[207,145,152,75,107,55]);
   const s0=snap(D),bh=bhits(A,M('bulletseed'),D,{r:100});
   /* 手で：1発ごとに防御+1 */
   const man=[];const D2={...D,stg:{...D.stg}};for(let i=0;i<5;i++){man.push(bcalc(A,M('bulletseed'),D2,{r:100}).dmg);D2.stg.def++;D2.hp-=man[i]}
   o.f1={hits:bh.hits.map(h=>h.dmg),total:bh.total,man,unchanged:snap(D)===s0,noStamina:bhits(A,M('bulletseed'),{...D,ab:'own-tempo'},{r:100}).hits.map(h=>h.dmg)}}
  /* 2 マニューラのトリプルアクセル → カビゴン：計算の画面と診断が同じ（全部の当たりが乱数100・3回） */
  {const A=mon(N('マニューラ'),'me','pressure',null,{sp:[2,32,0,0,0,32],up:1,dn:3}),D=mon(N('カビゴン'),'op','thick-fat');const mv=M('tripleaxel');
   const r=dmgRolls(A,mv,D,{}),x=dgMove(A,mv,D),h3=bhits(A,mv,D,{r:100,nHits:3}).total;
   const man=[20,40,60].reduce((t,p)=>t+bcalc(A,{...mv,pow:p},D,{r:100}).dmg,0);
   o.f2={calc:r[15],diag:Math.round(x.fmax*D.max/100),h3,man,hc:hitCountDist(A,mv,D,{})}}
  /* 3 メガガルーラのおんがえし系（のしかかり）→ カビゴン：おやこあいの2発目も入れて同じ */
  {const A=mkMon(byNo[115],'me',{ab:'scrappy',item:'kangaskhanite',moves:[],sp:[2,32,0,0,0,32],up:1,dn:3}),D=mon(N('カビゴン'),'op','thick-fat');const mv=M('bodyslam');
   const r=dmgRolls(A,mv,D,{}),x=dgMove(A,mv,D),b2=bhits(A,mv,D,{r:100});
   const man=bcalc(A,mv,D,{r:100}).dmg+bcalc(A,mv,{...D,hp:D.hp-bcalc(A,mv,D,{r:100}).dmg},{r:100,pb:true}).dmg;
   o.f3={ab:A.ab,calc:r[15],diag:Math.round(x.fmax*D.max/100),n:b2.n,man}}
  /* 4 イッカネズミのネズミざん：10回のダメージと、10回すべて当たる確率（命中90%を10回）は別の数 */
  {const A=mon(N('イッカネズミ'),'me','technician',null,{sp:[2,32,0,0,0,32],up:1,dn:3}),D=mon(N('カビゴン'),'op','thick-fat');const mv=M('populationbomb');
   const hc=hitCountDist(A,mv,D,{}),acc=accOf(A,mv,D);const p10=hc.find(x=>x[0]===10)[1]*acc/100;
   o.f4={acc,p10,sum:hc.reduce((t,x)=>t+x[1],0),ten:bhits(A,mv,D,{r:100,nHits:10}).total,dist:dmgRolls(A,mv,D,{}).hitCounts.length,skill:hitCountDist({...A,ab:'skill-link'},mv,D,{})}}
  /* 5 りゅうせいぐん：2回目の使用は特攻−2 */
  {const A=mon(N('カイリュー'),'me','inner-focus',null,{sp:[2,0,0,32,0,32],up:3,dn:1}),D=mon(N('カビゴン'),'op','thick-fat');const mv=M('dracometeor');
   const r=dmgRolls(A,mv,D,{}),A2={...A,stg:{...A.stg,spa:-2}},man=bcalc(A2,mv,{...D,hp:D.max-1},{r:100}).dmg;
   o.f5={first:r[15],second:r.nexts&&r.nexts[0][15],man,third:r.nexts&&r.nexts[1][15],man3:bcalc({...A,stg:{...A.stg,spa:-4}},mv,{...D,hp:D.max-1},{r:100}).dmg,a0:A.stg.spa,
     diagSeq:dgMove(A,mv,D).seqMin}}
  /* 6 くだけるよろい：物理の当たりのたびに防御−1（次の当たりが大きい） */
  {const A=mon(N('カイリュー'),'me','inner-focus',null,{sp:[2,32,0,0,0,32],up:1,dn:3}),D=mon(N('カビゴン'),'op','weak-armor');const mv=M('dualwingbeat')||M('doublekick');
   const bh=bhits(A,mv,D,{r:100});const D2={...D,stg:{...D.stg}};const h1=bcalc(A,mv,D2,{r:100}).dmg;D2.stg.def=-1;D2.hp-=h1;const h2=bcalc(A,mv,D2,{r:100}).dmg;
   o.f6={hits:bh.hits.map(h=>h.dmg),man:[h1,h2],mv:mv&&mv.n}}
  /* 7 きあいのタスキ＋おやこあい：1発目で倒れる量でもHP1、2発目で倒れる */
  {const A=mkMon(byNo[115],'me',{ab:'scrappy',item:'kangaskhanite',moves:[],sp:[2,32,0,0,0,32],up:1,dn:3}),D=mon(N('マニューラ'),'op','pressure',null,{item:'focussash'});
   const mv=M('closecombat')||M('bodyslam');const bh=bhits(A,mv,D,{r:100,surv:true});
   const r=dmgRolls(A,mv,D,{});o.f7={first:bh.hits[0].dmg,hp:D.max,second:bh.hits[1]&&bh.hits[1].dmg,fainted:bh.fainted,surv:bh.surv,ko:koInfo(r,D.hp),raw:bcalc(A,mv,D,{r:100}).dmg}}
  /* 8 2回の使用の256通りを手で数えて koInfo と比べる（オボンのみ・半減きのみ・ノーマルジュエル・マルチスケイル・自分の能力が下がる技） */
  {const brute=(A,mv,D,fx)=>{let ko=0;const max=D.max;
     for(let r1=85;r1<=100;r1++)for(let r2=85;r2<=100;r2++){let hp=D.hp;
       const d1=bcalc(A,mv,D,{r:r1}).dmg;hp-=d1;if(hp<=0){ko++;continue}
       let A2=A,D2={...D,hp};if(fx.sitrus&&hp<=Math.floor(max/2)){hp=Math.min(max,hp+Math.floor(max/4));D2.hp=hp}
       if(fx.berry)D2.item=null;if(fx.gem)A2={...A,item:null};if(fx.drop)A2={...A2,stg:{...A2.stg,...fx.drop}};
       const d2=bcalc(A2,mv,D2,{r:r2}).dmg;if(hp-d2<=0)ko++}
     return ko/256};
   const twoP=(A,mv,D)=>{const k=koInfo(dmgRolls(A,mv,D,{}),D.hp);return k.n===1?null:k.n===2?k.p:0};
   const cases=[];
   {const A=mon(N('ガブリアス'),'me','rough-skin',null,{sp:[2,32,0,0,0,32],up:1,dn:3}),D=mon(N('カビゴン'),'op','thick-fat',null,{item:'sitrusberry'});cases.push(['オボンのみ',twoP(A,M('earthquake'),D),brute(A,M('earthquake'),D,{sitrus:1})])}
   {const A=mon(N('サーフゴー'),'me','good-as-gold',null,{sp:[2,0,0,32,0,32],up:3,dn:1}),D=mon(N('ガブリアス'),'op','rough-skin',null,{item:'yacheberry'});cases.push(['ヤチェのみ',twoP(A,M('icebeam'),D),brute(A,M('icebeam'),D,{berry:1})])}
   {const A=mon(N('カビゴン'),'me','thick-fat',null,{item:'normalgem',sp:[2,32,0,0,0,32],up:1,dn:3}),D=mon(N('カビゴン'),'op','thick-fat');cases.push(['ノーマルジュエル',twoP(A,M('doubleedge')||M('bodyslam'),D),brute(A,M('doubleedge')||M('bodyslam'),D,{gem:1})])}
   {const A=mon(N('サーフゴー'),'me','good-as-gold',null,{sp:[2,0,0,32,0,32],up:3,dn:1}),D=mon(N('カイリュー'),'op','multiscale');cases.push(['マルチスケイル',twoP(A,M('icebeam'),D),brute(A,M('icebeam'),D,{})])}
   {const A=mon(N('カイリュー'),'me','inner-focus',null,{sp:[2,0,0,32,0,32],up:3,dn:1}),D=mon(N('カビゴン'),'op','thick-fat');cases.push(['りゅうせいぐん',twoP(A,M('dracometeor'),D),brute(A,M('dracometeor'),D,{drop:{spa:-2}})])}
   o.f8=cases}
  /* 9 決まった2回の技：当たりごとに別々の乱数の分布（16×16）がそのまま */
  {const A=mon(N('カイリュー'),'me','inner-focus',null,{sp:[2,32,0,0,0,32],up:1,dn:3}),D=mon(N('カビゴン'),'op','thick-fat');const mv=M('dualwingbeat')||M('doublekick');
   const dist=dmgRolls(A,mv,D,{}).dist,m=new Map();
   for(let r1=85;r1<=100;r1++)for(let r2=85;r2<=100;r2++){const a1=bcalc(A,mv,D,{r:r1}).dmg,a2=bcalc(A,mv,{...D,hp:D.hp-a1},{r:r2}).dmg;m.set(a1+a2,(m.get(a1+a2)||0)+1/256)}
   const exp=[...m.entries()].sort((x,y)=>x[0]-y[0]);o.f9={same:JSON.stringify(dist.map(([v,p])=>[v,+p.toFixed(12)]))===JSON.stringify(exp.map(([v,p])=>[v,+p.toFixed(12)]))}}
  /* 10 命中・優先度・範囲 */
  {const ce=mon(N('ビビヨン'),'me','compound-eyes'),D=mon(N('カビゴン'),'op','thick-fat');
   const mv100=M('bugbuzz'),mv80=M('focusblast')||{...M('bugbuzz'),acc:80};const m80={...mv100,acc:80};
   const wl={...ce,ab:'shield-dust',item:'widelens'},bp={...D,item:'brightpowder'};
   const th=M('thunder'),hu=M('hurricane'),bz=M('blizzard');const sw=B.weather;
   const wx=k=>{B.weather=k?{k,t:5}:null};const res={};
   try{wx('rain');res.thRain=accOf(ce,th,D);wx('sun');res.thSun=accOf({...ce,ab:'shield-dust'},th,D);res.huSun=accOf({...ce,ab:'shield-dust'},hu,D);wx('snow');res.bzSnow=accOf({...ce,ab:'shield-dust'},bz,D);
     wx(null);res.bzNone=accOf({...ce,ab:'shield-dust'},bz,D);wx('rain');res.thCloud=accOf({...ce,ab:'shield-dust'},th,{...D,ab:'cloud-nine'})}finally{B.weather=sw}
   const fa=mon(N('ファイアロー'),'me','gale-wings');
   o.f10={ce100:accOf(ce,mv100,D),wl80:accOf(wl,m80,D),bp80:accOf({...ce,ab:'shield-dust'},m80,bp),...res,
     gw:[effPri(fa,M('bravebird')),effPri({...fa,hp:fa.max-1},M('bravebird')),effPri(fa,M('flareblitz'))],
     single:[bcalc(mon(N('ガブリアス'),'me','rough-skin'),M('outrage'),D,{r:100,spread:true}).dmg,bcalc(mon(N('ガブリアス'),'me','rough-skin'),M('outrage'),D,{r:100}).dmg],
     spread:[bcalc(mon(N('ガブリアス'),'me','rough-skin'),M('earthquake'),D,{r:100,spread:true}).dmg,bcalc(mon(N('ガブリアス'),'me','rough-skin'),M('earthquake'),D,{r:100}).dmg]}}
  /* 11 確率の書き方：0%・0より大きい・ほぼ100%・必ず */
  o.f11={z:pctTxt(0),small:pctTxt(.0004),near:pctTxt(.99996),half:pctTxt(.5),sure:koSure({n:2,p:1,sure:2}),notSure:koSure({n:2,p:.99999,sure:0}),
    lab:koLabel({n:2,p:.99999,sure:3}),labS:koLabel({n:2,p:1,sure:2})};
  return o});
await b.close();
const {f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11}=R;
ok(JSON.stringify(f1.hits)==='[28,20,16,12,12]'&&f1.total===88,'1 じきゅうりょく：タネマシンガン5回の1発ずつ 28,20,16,12,12・合計88（前は28が5回）',f1);
ok(JSON.stringify(f1.hits)===JSON.stringify(f1.man)&&f1.unchanged,'1 手で並べた値と同じ・もとの相手は変えない',f1);
ok(JSON.stringify(f1.noStamina)==='[28,28,28,28,28]','1 じきゅうりょくでなければ5回とも同じ',f1.noStamina);
ok(f2.calc===f2.diag&&f2.calc===f2.h3&&f2.h3===f2.man,'2 トリプルアクセル：計算の画面＝診断＝手（20→40→60）',f2);
ok(f2.hc.length===3&&Math.abs(f2.hc[2][1]-.81)<1e-9,'2 トリプルアクセルは2発目から命中の判定（3回すべて＝0.9×0.9）',f2.hc);
ok(f3.ab==='parental-bond'&&f3.n===2&&f3.calc===f3.diag&&f3.calc===f3.man,'3 おやこあい：2発目まで入れて計算の画面＝診断＝手',f3);
ok(f4.acc===90&&Math.abs(f4.p10-0.34867844)<1e-8&&Math.abs(f4.sum-1)<1e-12,'4 ネズミざん：10回すべて当たる確率 34.867844%（0.9の10乗）',f4);
ok(f4.ten>0&&f4.dist===10&&JSON.stringify(f4.skill)==='[[10,1]]','4 10回のダメージと当たる確率は別・スキルリンクは10回',f4);
ok(f5.second===f5.man&&f5.third===f5.man3&&f5.second<f5.first&&f5.a0===0,'5 りゅうせいぐん：2回目は特攻−2、3回目は−4（もとの特攻は変えない）',f5);
ok(f5.diagSeq&&f5.diagSeq[1]<f5.diagSeq[0],'5 診断でも2回目は小さい',f5.diagSeq);
ok(JSON.stringify(f6.hits)===JSON.stringify(f6.man)&&f6.hits[1]>f6.hits[0],'6 くだけるよろい：2発目は防御−1で計算',f6);
ok(f7.raw>=f7.hp&&f7.first===f7.hp-1&&f7.second>=1&&f7.fainted&&f7.surv==='focussash','7 タスキ＋おやこあい：1発目はHP1、2発目で倒れる',f7);
ok(f7.ko.n===1&&f7.ko.survMulti,'7 倒せる回数は1回（タスキは当たりごとに入れた）',f7.ko);
for(const [nm,got,exp] of f8)ok(got!=null&&Math.abs(got-exp)<1e-9,`8 2回の使用の256通り：${nm}（koInfo ${got} ＝ 手 ${exp}）`,{got,exp});
ok(f9.same,'9 決まった2回の技：当たりごとに別々の乱数の分布が手の16×16と同じ');
ok(f10.ce100===100,'10 ふくがんでも命中100の技は100%（130%にしない）',f10);
ok(f10.wl80===88&&f10.bp80===72,'10 こうかくレンズ 80→88・ひかりのこな 80→72',f10);
ok(f10.thRain===100&&f10.thSun===50&&f10.huSun===50&&f10.bzSnow===100&&f10.bzNone===70&&f10.thCloud===70,'10 天気の命中（あめ必中・はれ50・ゆきでふぶき必中・ノーてんきで普通）',f10);
ok(f10.gw[0]===1&&f10.gw[1]===0&&f10.gw[2]===0,'10 はやてのつばさ：HP満タンのひこう技だけ+1',f10.gw);
ok(f10.single[0]===f10.single[1]&&f10.spread[0]<f10.spread[1],'10 1匹を狙う技に範囲の0.75倍を掛けない（範囲技は掛ける）',f10);
ok(f11.z==='0%'&&f11.small==='0.1%未満'&&f11.near==='99.5%以上'&&f11.half==='50%','11 確率の書き方（0%・0.1%未満・99.5%以上）',f11);
ok(f11.sure&&!f11.notSure&&/乱数2発/.test(f11.lab)&&/確定2発/.test(f11.labS),'11 99.999%は「確定」にしない',f11);
ok(!errs.length,'ページのエラーなし',errs.slice(0,3));
console.log(`mechanics-20261124c: ${bad?'NG':'OK'}（${n}項目）`);if(bad)process.exitCode=1;
