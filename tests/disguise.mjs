// ばけのかわ（ミミッキュ）の確認（2026/11/13）：15-battle.js の bcalc・bhits・runTurn、21-calc.js の dmgRolls・koInfo・画面、56-duel.js の duTurns
// ①はがれたときに減るHP＝最大HPの1/8（切り捨て・最低1）②減ったHPで倒れる境目（減る量＋1→1残る、減る量・減る量−1→倒れる）
// ③連続技（2回・5回）は1発目だけ防ぎ、残りはふつうに受ける ④減ったHPで倒れたら残りの当たりはない ⑤かたやぶりは無視して、はがれない
// ⑥タイプで効かない技でははがれない ⑦急所でも1発目は0 ⑧対戦（runTurn）でも同じ・倒れた印 ⑨ダメージ計算の画面の表示と倒せる回数
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const pg=await (await b.newContext({locale:'ja-JP',viewport:{width:390,height:844}})).newPage();
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.route(/^https?:/,r=>r.abort());
await pg.goto('file://'+path.join(ROOT,'dist/index.html')+'#/calc');await pg.waitForSelector('#c-swap');await pg.waitForTimeout(300);
let n=0,bad=0;const ok=(c,m)=>{n++;if(!c){bad++;console.error('NG',m)}};

const R=await pg.evaluate(()=>{
  const out={};
  const id=k=>+Object.keys(MV).find(i=>mkey({id:+i})===k);
  const mv=k=>mvObj(id(k));
  const mimi=(hp,o={})=>{const d=mkMon(byNo[778],'op',{ab:'disguise',moves:[],sp:o.sp||[0,0,0,0,0,0],item:o.item||null});if(hp!=null)d.hp=hp;return d};
  const att=(ab,o={})=>mkMon(byNo[o.no||445],'me',{ab:ab||null,moves:[],item:o.item||null,sp:[0,32,0,32,0,2]});
  /* ①1/8 の端数：切り捨て・最低1・最大HPで決まる（いまのHPではない） */
  out.round=[1,7,8,9,15,16,17,130,131,135,136,160].map(m=>[m,disgLoss({max:m,hp:1})]);
  const d0=mimi();out.max=d0.max;out.loss=disgLoss(d0);
  /* 1発の技（シャドーボール）：技のダメージ0・1/8が減る・はがれる */
  const sb=mv('shadowball'),A=att();
  const x0=bcalc(A,sb,d0,{r:100});out.single={dmg:x0.dmg,disg:!!x0.disg,loss:x0.loss,eff:x0.eff};
  const h0=bhits(A,sb,mimi(),{r:100});out.singleH={total:h0.total,loss:h0.loss,hpLoss:h0.hpLoss,fainted:h0.fainted,n:h0.hits.length};
  /* ②境目（1発の技） */
  out.th=[1,0,-1].map(k=>{const d=mimi(out.loss+k),h=bhits(A,sb,d,{r:100}),r=dmgRolls(A,sb,d,{}),ko=koInfo(r,d.hp);
    return{k,hp:d.hp,left:d.hp-h.hpLoss,fainted:h.fainted,disgFaint:h.disgFaint,ko,restored:d.disg===true&&d.hp===out.loss+k}});
  /* ③2回の技（ダブルウイング）・5回（スキルリンク＋タネマシンガン） */
  const two=mv('dualwingbeat');
  const d2=mimi(),h2=bhits(A,two,d2,{r:100});
  const ref2=(()=>{const d=mimi(d0.max-out.loss);d.disg=false;return bcalc(A,two,d,{r:100}).dmg})();
  out.two={n:h2.hits.length,first:h2.hits[0],second:h2.hits[1]&&h2.hits[1].dmg,ref2,total:h2.total,hpLoss:h2.hpLoss,fainted:h2.fainted};
  const five=mv('bulletseed'),S=att('skill-link',{no:3});
  const h5=bhits(S,five,mimi(),{r:100});
  const ref5=(()=>{const d=mimi();d.disg=false;let hp=d.max-out.loss,s=[];for(let i=0;i<4;i++){d.hp=hp;const v=bcalc(S,five,d,{r:100}).dmg;s.push(v);hp-=v}return s})();
  out.five={n:h5.hits.length,disg:h5.hits.map(h=>!!h.disg),dmg:h5.hits.map(h=>h.dmg),ref5,total:h5.total,loss:h5.loss};
  /* 当たりごとの乱数・急所：1発目（ばけのかわ）は急所でも0、2発目からは指定どおり */
  const hc=bhits(A,two,mimi(),{rolls:[100,85],crits:[true,true]});
  const refc=(()=>{const d=mimi(d0.max-out.loss);d.disg=false;return bcalc(A,two,d,{r:85,crit:true}).dmg})();
  out.crit={first:hc.hits[0].dmg,firstCrit:hc.hits[0].crit,second:hc.hits[1].dmg,refc};
  /* ④連続技で、減ったHPで倒れる：残りの当たりはない */
  const hf=bhits(S,five,mimi(out.loss),{r:100});out.multiFaint={n:hf.hits.length,fainted:hf.fainted,disgFaint:hf.disgFaint,total:hf.total};
  const hf2=bhits(S,five,mimi(out.loss+1),{r:100});out.multiSurvive={n:hf2.hits.length,fainted:hf2.fainted};
  /* ⑤かたやぶり：ばけのかわを無視してふつうのダメージ、はがれない */
  const M=att('mold-breaker'),dm=mimi(),hm=bhits(M,sb,dm,{r:100});
  const refm=(()=>{const d=mimi();d.disg=false;return bcalc(M,sb,d,{r:100}).dmg})();
  out.mold={total:hm.total,loss:hm.loss,refm,disgAfter:dm.disg,disgHit:hm.hits.some(h=>h.disg)};
  /* ⑥タイプで効かない技（ノーマル技・かくとう技はゴーストに効かない）ではがれない */
  const im=bhits(A,mv('bodyslam'),mimi(),{r:100}),im2=bhits(A,mv('closecombat'),mimi(),{r:100});
  out.immune={eff:im.eff,loss:im.loss,eff2:im2.eff,loss2:im2.loss,ko:koInfo(dmgRolls(A,mv('bodyslam'),mimi(),{}),d0.max)};
  /* 固定ダメージの技（ナイトヘッド。ちきゅうなげはかくとう技でゴーストに効かない）も1発目は防ぐ */
  const st=bhits(A,mv('nightshade'),mimi(),{});out.fixed={total:st.total,loss:st.loss};
  /* 倒せる回数：1回目＝技のダメージ＋1/8、2回目からは はがれたあと */
  const rr=dmgRolls(A,sb,mimi(),{});out.ko={r:[Math.min(...rr),Math.max(...rr)],loss:rr.loss,next:rr.next&&[Math.min(...rr.next),Math.max(...rr.next)],ko:koInfo(rr,d0.max)};
  { const dd=mimi();dd.disg=false;const nx=dmgRolls(A,sb,dd,{});
    /* 手で数える：1回目で loss、2回目から nx の16段階。n回で倒せる確率 */
    let dist=new Map([[out.loss,1]]),res=null;for(let k=2;k<=8&&!res;k++){const nd=new Map();for(const[s,c]of dist)for(const v of nx){const t=Math.min(s+v,d0.max);nd.set(t,(nd.get(t)||0)+c/16)}dist=nd;const p=dist.get(d0.max)||0;if(p>0)res={n:k,p}}
    out.koHand=res}
  /* オボンのみ：はがれた減少で半分以下になったら対戦では回復する */
  /* ⑧対戦（runTurn）：乱数を固定（0.5＝命中する・急所なし・乱数93・2〜5回の技は3回）。相手は動かない */
  const sim=(atk,move,d)=>{const sr=Math.random,sa=aiChoose,sv={me:B.me,op:B.op,plan:B.plan,weather:B.weather,turn:B.turn,se:B.se,hit:B.hit,log:B.log};
    try{Math.random=()=>0.5;aiChoose=(bb)=>({b:bb,mv:null});d.recharge=true;
      B.me={mons:[atk],act:[0]};B.op={mons:[d],act:[0]};B.weather=null;B.turn=1;B.se={me:0,op:0};B.plan=[{b:atk,mv:move,tg:d}];
      const lg=runTurn();return{hp:d.hp,fainted:d.fainted,disg:d.disg,item:d.item,log:(Array.isArray(lg)?lg:B.log||[]).join('\n')}}
    finally{Math.random=sr;aiChoose=sa;Object.assign(B,sv)}};
  out.simTh=[1,0,-1].map(k=>{const d=mimi(out.loss+k);return{k,...sim(att(),sb,d)}});
  { const d=mimi();const s=sim(att(),two,d);const h=bhits(att(),two,mimi(),{r:93});out.simTwo={...s,expHp:d0.max-h.hpLoss,n:h.hits.length}}
  { const d=mimi();const s=sim(S,five,d);const h=bhits(S,five,mimi(),{r:93});out.simFive={...s,expHp:Math.max(0,d0.max-h.hpLoss)}}
  { const d=mimi(out.loss);const s=sim(S,five,d);out.simFiveFaint=s}
  { const d=mimi();const s=sim(M,sb,d);const h=bhits(M,sb,mimi(),{r:93});out.simMold={...s,expHp:Math.max(0,d0.max-h.total)}}
  { const hp=Math.floor(d0.max/2)+out.loss;const d=mimi(hp,{item:'sitrusberry'});const s=sim(att(),sb,d);out.simSitrus={...s,hp0:hp,exp:hp-out.loss+Math.floor(d0.max/4)}}
  /* ⑨duTurns：1/8 を数える（1発 40% の技なら 1回目で12.5%、残り87.5%を40%ずつ＝計4回。前の「1回多い」なら4回、30%なら1+3=4・前は5） */
  { const d=mimi();const ls=disgLoss(d)/d.max*100;
    out.du=[40,30,60].map(p=>({p,got:duTurns(p,{mv:sb,acc:100},att(),d),exp:1+Math.ceil((100-ls)/p)}));
    const pm=60;out.duMulti={got:duTurns(pm,{mv:five,acc:100},S,d),exp:(()=>{const f=pm*(1-1/5)+ls;return f>=100?1:1+Math.ceil((100-f)/pm)})()}}
  return out;
});
ok(JSON.stringify(R.round)===JSON.stringify([[1,1],[7,1],[8,1],[9,1],[15,1],[16,2],[17,2],[130,16],[131,16],[135,16],[136,17],[160,20]]),'1/8 は切り捨て・最低1 '+JSON.stringify(R.round));
ok(R.loss===Math.floor(R.max/8),'ミミッキュの減る量 = floor(最大HP/8) '+R.max+'→'+R.loss);
ok(R.single.dmg===0&&R.single.disg&&R.single.loss===R.loss&&R.single.eff>0,'1発目は技のダメージ0で、1/8 を loss として返す '+JSON.stringify(R.single));
ok(R.singleH.total===0&&R.singleH.loss===R.loss&&R.singleH.hpLoss===R.loss&&!R.singleH.fainted&&R.singleH.n===1,'1発の技：技のダメージ0・HPは1/8だけ減る '+JSON.stringify(R.singleH));
const [t1,t0,tm]=R.th;
ok(t1.left===1&&!t1.fainted&&t1.ko.n===2&&t1.ko.p>=.9999,'HP=減る量+1 → 1残る・2回目で倒れる '+JSON.stringify(t1));
ok(t0.left<=0&&t0.fainted&&t0.disgFaint&&t0.ko.n===1&&t0.ko.p>=.9999,'HP=減る量 → 倒れる '+JSON.stringify(t0));
ok(tm.left<0&&tm.fainted&&tm.disgFaint&&tm.ko.n===1&&tm.ko.p>=.9999,'HP=減る量−1 → 倒れる '+JSON.stringify(tm));
ok(R.th.every(t=>t.restored),'計算のあと、ばけのかわとHPは元に戻る');
ok(R.two.n===2&&R.two.first.disg&&R.two.first.dmg===0&&R.two.second===R.two.ref2&&R.two.total===R.two.ref2&&R.two.hpLoss===R.two.ref2+R.loss,'2回の技：1発目は防ぎ、2発目はふつう（HPが1/8減った状態）'+JSON.stringify(R.two));
ok(R.five.n===5&&R.five.disg.join()==='true,false,false,false,false'&&JSON.stringify(R.five.dmg.slice(1))===JSON.stringify(R.five.ref5)&&R.five.total===R.five.ref5.reduce((s,v)=>s+v,0),'5回の技：1発目だけ防ぎ、残り4回はふつう '+JSON.stringify(R.five));
ok(R.crit.first===0&&R.crit.firstCrit===false&&R.crit.second===R.crit.refc,'急所でも1発目は0、2発目は当たりごとの乱数・急所 '+JSON.stringify(R.crit));
ok(R.multiFaint.n===1&&R.multiFaint.fainted&&R.multiFaint.disgFaint&&R.multiFaint.total===0,'連続技で1/8の減少で倒れたら、残りの当たりはない '+JSON.stringify(R.multiFaint));
ok(R.multiSurvive.n===5,'1残れば残りの当たりを受ける '+JSON.stringify(R.multiSurvive));
ok(R.mold.loss===0&&!R.mold.disgHit&&R.mold.total===R.mold.refm&&R.mold.disgAfter===true,'かたやぶり：ふつうのダメージ・はがれない '+JSON.stringify(R.mold));
ok(R.immune.eff===0&&R.immune.loss===0&&R.immune.eff2===0&&R.immune.loss2===0&&R.immune.ko.n===0,'タイプで効かない技でははがれない '+JSON.stringify(R.immune));
ok(R.fixed.total===0&&R.fixed.loss===R.loss,'固定ダメージの技も1発目は防ぐ '+JSON.stringify(R.fixed));
ok(R.ko.r[0]===0&&R.ko.r[1]===0&&R.ko.loss===R.loss&&R.ko.next[0]>0&&R.koHand&&R.ko.ko.n===R.koHand.n&&Math.abs(R.ko.ko.p-R.koHand.p)<1e-9,'倒せる回数：1回目は1/8だけ、2回目からはふつう '+JSON.stringify(R.ko)+' '+JSON.stringify(R.koHand));
const [s1,s0,sm]=R.simTh;
ok(s1.hp===1&&!s1.fainted&&s1.disg===false&&/ばけのかわが はがれた/.test(s1.log)&&!/たおれた/.test(s1.log),'対戦：HP=減る量+1 → 1残る '+JSON.stringify(s1));
ok(s0.hp===0&&s0.fainted&&/たおれた/.test(s0.log),'対戦：HP=減る量 → 倒れた印 '+JSON.stringify(s0));
ok(sm.hp===0&&sm.fainted&&/たおれた/.test(sm.log),'対戦：HP=減る量−1 → 倒れた印 '+JSON.stringify(sm));
ok(!/0%/.test(s1.log.split('\n').filter(x=>/に \d+%/.test(x)).join('')),'対戦：防いだ1発だけのときは「0%」と出さない '+s1.log);
ok(R.simTwo.hp===R.simTwo.expHp&&!R.simTwo.fainted&&/（2回）/.test(R.simTwo.log),'対戦：2回の技は1発目を防ぎ2発目を受ける（計算と同じHP） '+JSON.stringify(R.simTwo));
ok(R.simFive.hp===R.simFive.expHp&&/（5回）/.test(R.simFive.log),'対戦：5回の技（スキルリンク） '+JSON.stringify(R.simFive));
ok(R.simFiveFaint.fainted&&R.simFiveFaint.hp===0&&!/（\d回）/.test(R.simFiveFaint.log)&&(R.simFiveFaint.log.match(/たおれた/g)||[]).length===1,'対戦：1/8で倒れたら残りの当たりはない '+JSON.stringify(R.simFiveFaint));
ok(R.simMold.hp===R.simMold.expHp&&R.simMold.disg===true&&!/ばけのかわが はがれた/.test(R.simMold.log),'対戦：かたやぶりは無視してはがれない '+JSON.stringify(R.simMold));
ok(R.simSitrus.hp===R.simSitrus.exp&&R.simSitrus.item===null&&/オボンのみ/.test(R.simSitrus.log),'対戦：1/8の減少で半分以下になればオボンのみで回復 '+JSON.stringify(R.simSitrus));
ok(R.du.every(x=>x.got===x.exp),'duTurns は1/8を数える '+JSON.stringify(R.du));
ok(R.duMulti.got===R.duMulti.exp,'duTurns（連続技） '+JSON.stringify(R.duMulti));

/* ⑨ダメージ計算の画面：受ける側をミミッキュにする */
await pg.evaluate(()=>{CS.a=calcX(445);CS.d=calcX(778,'common');CS.d.ab='disguise';CS.d.item=null;
  CS.mv=+Object.keys(MV).find(i=>mkey({id:+i})==='shadowball');CS.hits=0;route()});
await pg.waitForSelector('.cv-disg');
const ui=await pg.evaluate(()=>({big:document.querySelector('.cres-big').textContent,disg:document.querySelector('.cv-disg').textContent,raw:document.querySelector('.cv-raw').textContent,
  rem:document.querySelector('.cres-s').textContent,ko:document.querySelector('.cv-ko').textContent,pill:!!document.querySelector('[data-t="disgOff"]'),note:(document.querySelector('.cres-n')||{}).textContent||''}));
ok(/技のダメージ/.test(ui.big)&&/0\.0/.test(ui.big),'画面：大きな数は「技のダメージ」0% '+ui.big);
ok(/ばけのかわ/.test(ui.disg)&&/1\/8/.test(ui.disg)&&/技のダメージではありません/.test(ui.disg),'画面：1/8 の減少を技のダメージと分けて出す '+ui.disg);
ok(/ばけのかわ −\d+/.test(ui.raw),'画面：数の行に「ばけのかわ −N」 '+ui.raw);
ok(/^残りHP: \d+%$/.test(ui.rem.trim())&&!/100%/.test(ui.rem),'画面：残りHPに1/8の減少が入る '+ui.rem);
ok(/回/.test(ui.ko)&&!/ダメージを与えられません/.test(ui.ko),'画面：倒せる回数が出る（前は「ダメージを与えられません」） '+ui.ko);
ok(ui.pill&&/1\/8/.test(ui.note),'画面：「ばけのかわがはがれている」の条件と説明 '+ui.note);
/* はがれている条件：ばけのかわの行が消え、ふつうのダメージ */
await pg.click('[data-t="disgOff"]');await pg.waitForTimeout(100);
const ui2=await pg.evaluate(()=>({disg:!!document.querySelector('.cv-disg'),big:document.querySelector('.cres-big').textContent,note:(document.querySelector('.cres-n')||{}).textContent||''}));
ok(!ui2.disg&&!/技のダメージ/.test(ui2.big)&&!/^0\.0/.test(ui2.big.trim())&&/はがれたあと/.test(ui2.note),'画面：はがれている条件ではふつうのダメージ '+JSON.stringify(ui2));
/* HPが少ないとき：1/8 の減少で倒れる */
await pg.evaluate(()=>{CS.disgOff=false;CS.dHP=5;route()});await pg.waitForSelector('.cv-disg');
const ui3=await pg.evaluate(()=>({disg:document.querySelector('.cv-disg').textContent,rem:document.querySelector('.cres-s').textContent,ko:document.querySelector('.cv-ko').textContent}));
ok(/倒れます/.test(ui3.disg)&&/倒れます/.test(ui3.rem)&&/1回当てれば必ず倒せます/.test(ui3.ko),'画面：HPが少なければ1/8で倒れる '+JSON.stringify(ui3));
ok(!errs.length,'ページのエラーなし '+errs.join(' / '));
await b.close();
console.log(`disguise: ${bad?'NG':'OK'}（${n}項目${bad?`・${bad}件NG`:''}）`);
if(bad)process.exitCode=1;
