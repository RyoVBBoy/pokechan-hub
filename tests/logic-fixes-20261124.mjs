// 2026/11/24 監査ブランチの計算の直し（本編〔第9世代〕の決まりにそろえたもの。チャンピオンズのゲーム内では未確認）
// ①テイルアーマー・じょおうのいげんの相手に先制技を数えない（かたやぶりは数える）：moveUsable・estHit・dgPrio・ダメージ計算の注意
// ②おやこあいは、ためる技（ソーラービーム）では2回当たらない
// ③改善案の「技」：使用データで多く使われている技（メガグソクムシャのきゅうけつ）を入れかえ先にしない・名前は計算した姿
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const pg=await (await b.newContext({locale:'ja-JP'})).newPage();
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.route(/^https?:/,r=>r.abort());
await pg.goto('file://'+path.join(ROOT,'dist/index.html')+'#/team');await pg.waitForTimeout(800);
let n=0,bad=0;const ok=(c,m)=>{n++;if(!c){bad++;console.error('NG',m)}};
const R=await pg.evaluate(()=>{const o={};const id=k=>+Object.keys(MD).find(i=>MD[i][3]===k);
  const sp=mvObj(id('suckerpunch')),cc=mvObj(id('closecombat'));
  const far=P.find(p=>p.n==='リキキリン'),tsa=P.find(p=>p.n==='アマージョ');
  const A=(ab)=>mkMon(byNo[768],'me',{ab,item:null,moves:[sp],sp:[2,32,0,0,0,32],up:1,dn:3});
  const F=ab=>mkMon(far,'op',{ab,item:null,moves:[cc],sp:[2,0,32,0,32,0]});
  o.mu=[moveUsable(sp,{a:A(null),d:F('armor-tail')}).why||'ok',moveUsable(sp,{a:A('mold-breaker'),d:F('armor-tail')}).why||'ok',moveUsable(sp,{a:A(null),d:F('cud-chew')}).why||'ok',moveUsable(cc,{a:A(null),d:F('armor-tail')}).why||'ok',
    tsa?moveUsable(sp,{a:A(null),d:mkMon(tsa,'op',{ab:'queenly-majesty',item:null,moves:[cc]})}).why:'none'];
  o.est=[estHit(A(null),F('armor-tail')).pct,estHit(A(null),F('cud-chew')).pct>0];
  o.prio=[dgPrio(A(null),F('armor-tail')),!!dgPrio(A(null),F('cud-chew'))];
  /* ダメージ計算の注意 */
  try{const R0={a:A(null),d:F('armor-tail'),mv:sp,n:1};o.note=calcNotes(R0).some(t=>/先制技が当たりません/.test(t))}catch(e){o.note='x'+e.message}
  /* ②おやこあい */
  const kg=byNo[10039];const K=mkMon(byNo[115]||kg,'me',{ab:'parental-bond',item:'kangaskhanite',moves:[],sp:[2,32,0,32,0,32]});
  const T=mkMon(byNo[143],'op',{ab:'immunity',item:null,moves:[],sp:[0,0,0,0,0,0]});
  o.pb=[K.ab,bhits(K,mvObj(id('solarbeam')),T,{r:100}).n,bhits(K,mvObj(['doubleedge','bodyslam','facade','hypervoice'].map(id).find(x=>x&&MV[x])),T,{r:100}).n];
  /* ④ためる技・反動で動けない技のターン（duTurns） */
  const dmy=mkMon(byNo[143],'op',{ab:'immunity',item:null,moves:[],sp:[0,0,0,0,0,0]}),at=mkMon(byNo[143],'me',{ab:'immunity',item:null,moves:[],sp:[0,0,0,0,0,0]});
  const mvo=k=>mvObj(id(k));const sw=B.weather;
  try{B.weather=null;o.turns=[duTurns(60,{mv:mvo('meteorbeam'),acc:100},at,dmy),duTurns(60,{mv:mvo('flamethrower'),acc:100},at,dmy),duTurns(60,{mv:mvo('hyperbeam'),acc:100},at,dmy),duTurns(120,{mv:mvo('hyperbeam'),acc:100},at,dmy)];
    B.weather={k:'rain',t:5};o.turns.push(duTurns(60,{mv:mvo('electroshot'),acc:100},at,dmy));B.weather=null;o.turns.push(duTurns(60,{mv:mvo('electroshot'),acc:100},at,dmy))}finally{B.weather=sw}
  o.mvn=dgMvName(at,mvo('meteorbeam'));
  /* ③改善案 */
  const mv=ks=>ks.map(k=>({id:id(k),n:mName(id(k))}));
  team=[{no:768,set:{ab:{k:'emergency-exit',n:''},it:{k:'golisopite',n:''},mv:mv(['suckerpunch','leechlife','swordsdance','closecombat']),sp:[2,32,0,0,0,32],up:1,dn:3}},{no:445},{no:130},{no:143},{no:6},{no:9}];
  try{DG_CACHE.clear()}catch(e){}
  const use=impUsePct(768,'golisopite');o.use=[use[id('leechlife')],use[id('closecombat')]];
  const L=dgImprove(team).list.filter(x=>x.kind==='move'&&x.i===0);
  o.imp=L.map(x=>x.title+' :: '+x.why);
  return o});
await b.close();
ok(JSON.stringify(R.mu)===JSON.stringify(['blocked-priority','ok','ok','ok','blocked-priority']),'①moveUsable '+JSON.stringify(R.mu));
ok(R.est[0]===0&&R.est[1],'①estHit：テイルアーマーには ふいうち 0%、ほかの特性なら入る '+R.est);
ok(R.prio[0]==null&&R.prio[1],'①dgPrio：テイルアーマーには先制技なし '+JSON.stringify(R.prio));
ok(R.note===true,'①ダメージ計算に注意を出す '+R.note);
ok(R.pb[0]==='parental-bond'&&R.pb[1]===1&&R.pb[2]===2,'②おやこあい：ソーラービーム1回・ふつうの技2回 '+R.pb);
ok(JSON.stringify(R.turns)===JSON.stringify([4,2,3,1,2,4]),'④ターン：メテオビーム2回分=4・かえんほうしゃ2・はかいこうせん2回=3／1回=1・あめのエレクトロビーム2・あめなし4 '+R.turns);
ok(/ためるので1回に2ターン/.test(R.mvn),'④技の名前に書く '+R.mvn);
ok(R.use[0]>=30,'③きゅうけつの採用率を読める '+R.use);
ok(!R.imp.some(t=>/技：きゅうけつ →/.test(t)),'③きゅうけつを入れかえ先にしない '+R.imp.join(' | '));
ok(R.imp.every(t=>/^メガグソクムシャの技/.test(t)),'③名前は計算した姿 '+R.imp.join(' | '));
ok(R.imp.every(t=>!/いちばん使われていない/.test(t)),'③「使われていない」と書かない');
ok(errs.length===0,'ページのエラー '+errs.join(' / '));
console.log(`logic-fixes-20261124：${n-bad}/${n} 合格`);
if(bad)process.exit(1);
