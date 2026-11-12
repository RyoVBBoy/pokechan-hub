// サイトの動作確認：主な画面を順に開き、エラーが出ないこと・中身が表示されることを確かめる
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const pg=await (await b.newContext({viewport:{width:390,height:844},locale:'ja-JP'})).newPage();
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.route(/^https?:/,r=>r.abort());   // 外部への通信はしない
const fail=m=>{console.error('NG',m);process.exitCode=1};
await pg.goto(URL0+'#/');await pg.waitForTimeout(600);
const routes=['#/','#/dex','#/replay','#/p/10058','#/season','#/learn/build','#/arch/rain','#/arch/tr','#/p/445','#/p/10230','#/types','#/team','#/tools','#/calc','#/assist','#/meta','#/report','#/community','#/messages','#/lobby','#/bbs','#/games','#/sources','#/battle','#/edit/0','#/cmp/445','#/account','#/terms','#/privacy','#/tl','#/notif','#/u/someone','#/search','#/search/'+encodeURIComponent('#ガブリアス'),'#/learn','#/learn/word','#/item/choicescarf','#/item/garchompitez','#/word/tr','#/learn/move','#/learn/ability','#/move/89','#/ability/intimidate'];
for(const r of routes){
  await pg.evaluate(h=>{location.hash=h},r);await pg.waitForTimeout(250);
  /* 通信して表示する画面（シーズンなど）は、読み込み中の表示が消えるまで少し待つ */
  let n=0;for(let k=0;k<12;k++){n=await pg.evaluate(()=>document.querySelector('main')?.innerText.trim().length||0);if(n>=20)break;await pg.waitForTimeout(250)}
  if(n<20)fail(`${r} の中身が空です`);
  if(await pg.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))fail(`${r} が横にはみ出しています`);
}
// 図鑑の「技・特性」タブ
await pg.evaluate(()=>{location.hash='#/p/445'});await pg.waitForTimeout(300);
await pg.click('#seg [data-i="5"]');await pg.waitForTimeout(200);
const mvn=await pg.$$eval('.mvr',x=>x.length);if(mvn<40)fail('覚える技の表示が少なすぎます: '+mvn);
// 画像つき投稿：送る前に縮める（長い辺1600px・WebPかJPEG）
const sh=await pg.evaluate(async()=>{const c=document.createElement('canvas');c.width=3000;c.height=1000;c.getContext('2d').fillRect(0,0,10,10);
  const b=await new Promise(r=>c.toBlob(r,'image/png'));const x=await twShrink(new File([b],'a.png',{type:'image/png'}));return[x.w,x.h,x.blob.type,x.blob.size]});
if(!(sh[0]===1600&&sh[1]===533&&/webp|jpeg/.test(sh[2])&&sh[3]<9e5))fail('画像を縮められません: '+sh.join(','));
// シーズンのまとめ：登録から傾向の文章を作る（型は特性・技で厳しめに判定）・名前で登録
const sz=await pg.evaluate(()=>{const tm=n=>({team:n.map(no=>({no})),rank:1});const teams=[tm([279,902,904,134,706,445]),tm([445,1000,149,887,727,812]),tm([445,1000,149,94,130,248]),tm([445,1000,149,6,9,3])];
  const h=szSummary({season:{name:'S',note:''},fmt:'single',teams,usage:[{no:445,n:4,pc:100}]});return[/ガブリアス/.test(h),/あめパーティ/.test(h),/おいかぜパーティ/.test(h),JSON.stringify(admNames('ガブリアス、カイリュー サーフゴー'))]});
if(!(sz[0]&&sz[1]&&!sz[2]&&sz[3]==='{"nos":[445,149,1000],"bad":[]}'))fail('シーズンのまとめ: '+sz.join(','));
// 上位パーティと比べる：両方の選出とダメージの表が出る
const vs=await pg.evaluate(()=>{const keep=team;team=[{no:445},{no:6},{no:9},{no:130}];const h=szVs({team:[{no:149,set:{it:{k:'choicescarf'},mv:[{id:89}]}},{no:1000},{no:727}]});team=keep;
  return[/おすすめの選出/.test(h),/相手が選びそうな/.test(h),(h.match(/<tr>/g)||[]).length,/有利|不利|五分/.test(h)]});
if(!(vs[0]&&vs[1]&&vs[2]>=8&&vs[3]))fail('上位パーティと比べる: '+vs.join(','));
// 自動集計のパーティ：印と出典のリンク（nofollow・https だけ）
const cd=await pg.evaluate(()=>szCard({id:1,fmt:'single',rank:1,rate:null,team:[{no:445},{no:149}],comment:'',verified:false,auto:true,sources:['https://a.example/x','javascript:alert(1)'],player:{name:'Taro'},mine:false}));
if(!(/自動集計・出典2件/.test(cd)&&/href="https:\/\/a\.example\/x"[^>]*nofollow/.test(cd)&&!/javascript:/.test(cd)))fail('自動集計の印・出典: '+cd.slice(0,200));
// 解説：特性でタイプ相性が変わる（ウォッシュロトムはふゆうでじめん無効→弱点はくさだけ）・強いところ／弱いところが出る
const wr=await pg.evaluate(()=>{const p=P.find(x=>/ウォッシュ/.test(x.n));const h=monGuide(p);return[/弱点がくさだけ/.test(h),/HPが低め/.test(h),monDef(p).find(x=>x.t==='じめん').m,/強いところ/.test(monGuide(byNo[445]))]});
if(!(wr[0]&&wr[1]&&wr[2]===0&&wr[3]))fail('解説（特性と相性・強いところ）: '+wr.join(','));
// メガシンカの姿も同じ形で解説する（メガガブリアスZはタイプと弱点の変化を書く）
const mg=await pg.evaluate(()=>{const h=monGuide(byNo[445]);return[(h.match(/class="gmeg-band"/g)||[]).length,/メガシンカで変わるところ/.test(h),/弱点がこおり（4倍）・ドラゴン・フェアリーからこおり・ドラゴン・フェアリーになる/.test(h),
  (h.match(/<h2>向いている役割<\/h2>/g)||[]).length,(h.match(/を軸にしたパーティの例/g)||[]).length,AXIS_DATA[445]&&AXIS_DATA[445].list.length,AXIS_DATA[10309]&&AXIS_DATA[10309].list[0].set.it.k]});
if(!(mg[0]===2&&mg[1]&&mg[2]&&mg[3]===3&&mg[4]===3&&mg[5]===6&&mg[6]==='garchompitez'))fail('メガシンカの解説・軸のパーティ: '+mg.join(','));
// メガシンカの姿のページ：全部のタブが開け、技はもとの姿のもの
await pg.evaluate(()=>{location.hash='#/p/10058'});await pg.waitForTimeout(400);
for(let i=1;i<6;i++){await pg.click(`#seg [data-i="${i}"]`);await pg.waitForTimeout(150)}
const mp=await pg.evaluate(()=>[document.querySelectorAll('.mvr').length,!!document.querySelector('.fam-pills'),/メガガブリアス/.test(document.getElementById('hdr').textContent)]);
if(!(mp[0]>=40&&mp[1]&&mp[2]))fail('メガシンカの姿のページ: '+mp.join(','));
// タブごとに最後の画面を覚える（ツール→ダメ計→ホーム→ツールでダメ計に戻る。もう一度押すとツールの最初へ）
await pg.evaluate(()=>{location.hash='#/tools'});await pg.waitForTimeout(300);await pg.evaluate(()=>nav('#/calc'));await pg.waitForTimeout(300);
await pg.click('.tb[data-k=""]');await pg.waitForTimeout(300);await pg.click('.tb[data-k="tools"]');await pg.waitForTimeout(300);
const tm1=await pg.evaluate(()=>location.hash);await pg.click('.tb[data-k="tools"]');await pg.waitForTimeout(300);const tm2=await pg.evaluate(()=>location.hash);
if(!(tm1==='#/calc'&&tm2==='#/tools'))fail('タブの記憶: '+tm1+' '+tm2);
await pg.evaluate(()=>{location.hash='#/p/445'});await pg.waitForTimeout(400);
// パーティのチェック：点数をつけない・シングルの選出は3匹・持ち物の組み合わせ・直し方を書く
const pcx=await pg.evaluate(()=>{const st=(it,mv)=>({it:{n:'',k:it},mv:mv.map(id=>({id,n:''}))});
  const C=partyCheck([{no:445,sel:true,set:st('choicescarf',[14,89])},{no:6,sel:true,set:st('charizarditey',[53])},{no:130,sel:true,set:st('gyaradosite',[127])},{no:9},{no:94}]);
  const C2=partyCheck([{no:902,sel:true},{no:279},{no:130}]);
  return[/選出に選んだ3匹/.test(C.scope),C.fix.some(x=>/メガストーン/.test(x.t)),C.fix.some(x=>/こだわり系と積み技/.test(x.t)),C.fix.every(x=>x.how),C2.good.some(x=>/あめ/.test(x.t))]});
if(pcx.some(v=>!v))fail('パーティのチェック: '+pcx.join(','));
// 構築の型：例のパーティを6匹組める
const ab=await pg.evaluate(()=>ARCHS.filter(a=>{const ex=archBuild(a),ss=archSets(a,ex);return ex.length!==6||ss.some(x=>!x||x.moves.length!==4||x.sp.reduce((p,q)=>p+q,0)>66||!ITEMN[x.item])||new Set(ss.map(x=>x.item)).size!==6}).map(a=>a[0]));if(ab.length)fail('構築の型の例（6匹・技4つ・持ち物が重ならない）が組めません: '+ab.join(','));
// 図鑑の「解説」タブ（データから組み立てる。全ポケモンでエラーにならない）
await pg.click('#seg [data-i="1"]');await pg.waitForTimeout(200);
if(!(await pg.$('#gmpanel .gset')))fail('解説タブに型の例が出ません');
const gbad=await pg.evaluate(()=>P.filter(p=>{try{return /undefined|NaN/.test(monGuide(p).replace(/<[^>]+>/g,''))}catch(e){return true}}).map(p=>p.n));
if(gbad.length)fail('解説が作れないポケモン: '+gbad.slice(0,5).join('・'));
// ダメージ計算が数字を出す
await pg.evaluate(()=>{location.hash='#/calc'});await pg.waitForTimeout(300);
const big=await pg.$eval('.cres-big',x=>x.textContent).catch(()=>'');if(!/%/.test(big))fail('ダメージ計算の結果が出ません');
// 計算エンジンの一貫性
const chk=await pg.evaluate(()=>{const a=mkMon(byNo[445],'me',{item:'garchompitez',moves:[mvObj(89)],ab:'rough-skin'});return[a.p.n,P.length,Object.keys(LSD).length,Object.keys(MD).length]});
if(chk[0]!=='メガガブリアスZ')fail('メガシンカの計算: '+chk[0]);
if(chk[1]<200||chk[2]<200||chk[3]<400)fail('データ件数が少なすぎます: '+chk.join(','));
// マイツール：☆を押すと、ホームの「すぐ使う」の先頭に出る。下のメニューに名前が出る
await pg.evaluate(()=>{location.hash='#/tools'});await pg.waitForTimeout(300);
await pg.click('[data-tpin="cmp"]');await pg.waitForTimeout(200);
if(!(await pg.$('.tgrid .ttile[href="#/cmp"]')))fail('マイツールに入りません');
await pg.evaluate(()=>{location.hash='#/tools'});await pg.waitForTimeout(300);
if(await pg.$eval('.tgrid .ttile',a=>a.getAttribute('href')).catch(()=>'')!=='#/cmp')fail('ツールの「すぐ使う」の先頭にマイツールが出ません');
// ホームは投稿（みんな／フォロー中）、左上のマークでメニューが開く
await pg.evaluate(()=>{location.hash='#/'});await pg.waitForTimeout(400);
if(!(await pg.$('#tl-seg')))fail('ホームに投稿のタブが出ません');
await pg.click('#brand');await pg.waitForTimeout(450);
const drw=await pg.evaluate(()=>{const p=document.querySelector('.dr-p');return[DR.open,p&&p.getBoundingClientRect().left,document.querySelectorAll('.dr-i').length]});
if(!(drw[0]&&drw[1]>-2&&drw[2]>=6))fail('メニューが開きません: '+drw.join());
await pg.click('.dr-bg',{position:{x:370,y:400}});await pg.waitForTimeout(450);
if(await pg.evaluate(()=>DR.open))fail('メニューが閉じません');
if(!(await pg.$eval('.tb[data-k="search"] span',s=>s.offsetWidth>10).catch(()=>false)))fail('スマホの下のメニューに名前が出ません');
await pg.evaluate(()=>{tTogglePin('cmp')});
// 育成画面の PiP：欄が出て、この1匹／パーティ全員のカードが作れる。「小窓」という言い方が残っていない
await pg.evaluate(()=>{team.length=0;[445,149].forEach(no=>team.push({no}));saveTeam();location.hash='#/edit/0'});await pg.waitForTimeout(500);
const pb=await pg.evaluate(()=>{const a=!!document.getElementById('ed-pipw');PIP.ball=false;const one=pipBuildPages().length;PIP.ball=true;const all=pipBuildPages().length;PIP.ball=false;return[a,one,all,document.body.innerText.includes('小窓')]});
if(!pb[0]||pb[1]!==1||pb[2]!==3)fail('育成画面のPiP: '+pb.join(','));
if(pb[3])fail('「小窓」という言い方が残っています');
await pg.evaluate(()=>{team.length=0;saveTeam()});
// 画像から取り込む：ニックネームでも、実数値・技・特性・メガストーンから正しいポケモンを予測する
const gs=await pg.evaluate(()=>{const mk=(no,sp,up,dn)=>calcStats(byNo[no],sp,up,dn);
  const cs=[[{nameRaw:'ちょんぼ',vals:mk(445,[2,32,0,0,0,32],1,3),spr:[2,32,0,0,0,32],mvRaw:['じしん','げきりん','ストーンエッジ','まもる'],abRaw:'さめはだ'},445],
    [{nameRaw:'ポチ',vals:mk(445,[2,32,0,0,0,32],1,3),spr:[2,32,0,0,0,32]},445],
    [{nameRaw:'りゅうくん',mvRaw:['しんそく','げきりん','じしん','はねやすめ'],abRaw:'マルチスケイル'},149],
    [{nameRaw:'ああああ',mvRaw:['じしん','かみくだく','ストーンエッジ','まもる'],abRaw:'すなおこし',itRaw:'バンギラスナイト'},248],
    [{nameRaw:'ガブリアス'},445],
    [{nameRaw:'カイリュ',vals:mk(445,[2,32,0,0,0,32],1,3),spr:[2,32,0,0,0,32],mvRaw:['じしん','げきりん','ストーンエッジ','まもる']},445]];
  return cs.map(([sl,want])=>{sl={pos:0,...sl};imResolve(sl);return sl.no===want?'':`${sl.nameRaw}→${sl.no}`}).filter(Boolean)});
if(gs.length)fail('ニックネームからの予測: '+gs.join(' / '));
// 技の読みまちがい（濁点が別の文字に読まれる）：ポケモンが決まったら覚える技の中から選び直す（2026/11/03 依頼主の指摘）
const tx=await pg.evaluate(()=>{const sl={pos:0,nameRaw:'フシギバナ',mvRaw:['とこぐとこぐぐく','つるぎのまい','のしかかり','すてみタックル']};imResolve(sl);return sl.mv[0].n});
if(tx!=='どくどく')fail('技の読みまちがいの補正: とこぐとこぐぐく→'+tx);
// 共有されたパーティ（#/share）は見るだけ：自分のパーティを書きかえない（2026/11/04）
const shv=await pg.evaluate(async()=>{const before=JSON.stringify(team.map(x=>x.no));location.hash='#/share/445-149-248';await new Promise(r=>setTimeout(r,400));
  return[before===JSON.stringify(team.map(x=>x.no)),document.querySelectorAll('#view .row').length,!!document.getElementById('sh-use'),shareLink([445,149])]});
if(!(shv[0]&&shv[1]===3&&shv[2]&&/\/t\/445-149$/.test(shv[3])))fail('共有されたパーティの画面: '+shv.join());
const cnt=await pg.evaluate(()=>{const c=monCounters(byNo[445]);return[c.ohko.length+c.strong.length,c.spd>0]});
if(!(cnt[0]>0&&cnt[1]))fail('対策の計算（monCounters）: '+cnt.join());
// 相性のいい仲間を探す（48-pair.js）：依頼主の資料の例（アーマーガア＋ブリジュラス、マスカーニャ＋アシレーヌ）は、
// ランクバトルで一緒に使われている情報があれば上位8匹に入る。無効で受ける方が半減より高い点になる
const pr=await pg.evaluate(()=>{const sv={files:LIVE.files,c1:LIVE.csv[823],c2:LIVE.csv[908]};
  LIVE.files={};P.forEach(q=>{if(ENSP[q.no])LIVE.files[ENSP[q.no]]='x'});LIVE.csv[823]={tm:['Archaludon']};LIVE.csv[908]={tm:['Primarina']};
  const rk=(a,w)=>prRank([byNo[a]]).findIndex(o=>o.c.no===w)+1;const r=[rk(823,1018),rk(908,730)];
  LIVE.files=sv.files;LIVE.csv[823]=sv.c1;LIVE.csv[908]=sv.c2;
  const one=prScore(byNo[445],[byNo[823]]).R.find(r=>r.k==='cover');return[...r,one?one.txt:'']});
if(!(pr[0]>=1&&pr[0]<=8&&pr[1]>=1&&pr[1]<=8))fail('相性のいい仲間の順位: '+pr.join());
// 負けやすい理由（49-lose.js）：先制技・スカーフ・タスキのないパーティは「止める手段がない」、
// こだわりスカーフを持たせると消える。いわ4倍（リザードン）で設置技を消す手段がなければ指摘
// （2026/11/05）技をまだ決めていない匹がいるうちは「止める手段がない」と言わない（進み具合の案内で技を決めてもらう）
const lr=await pg.evaluate(()=>{const base=[445,6,130,94,59,887].map(no=>({no,set:{mv:[{id:89}]}}));const a=loseReasons(base).map(r=>r.t);
  const b=loseReasons(base.map((x,i)=>i?x:{...x,set:{it:{k:'choicescarf'},mv:[{id:89}]}})).map(r=>r.t);
  const c=loseReasons(base.map(x=>({no:x.no}))).map(r=>r.t);
  return[a.some(t=>/止める手段/.test(t)),a.some(t=>/ステルスロック/.test(t)),!b.some(t=>/止める手段/.test(t)),!c.some(t=>/止める手段/.test(t))]});
if(lr.join()!=='true,true,true,true')fail('負けやすい理由: '+lr.join());
// 公式の図鑑へのリンク：メガ・地方の姿は、その姿のページ（2026/11/06 公式の一覧で確かめた枝番）
const zk=await pg.evaluate(()=>[zukanUrl(byNo[445]),zukanUrl(byNo[10058]),zukanUrl(byNo[10309]),zukanUrl(byNo[10100]),zukanUrl(byNo[10165]),zukanUrl(byNo[681],true)].map(u=>u.split('/').pop()).join(','));
if(zk!=='0445,0445-1,0445-2,0026-1,0080-2,0681-1')fail('公式の図鑑へのリンク: '+zk);
// まとめて育成を入れてもメガシンカの枠が残る（2026/11/08 依頼主の指摘：メガストーンが0になる）
const mgS=await pg.evaluate(()=>{const mons=[445,823,1018,730,812,448].map(n=>byNo[n]);const ss=archSets(['axis'],mons);
  const st=ss.filter(s=>s&&isStone(s.item)).map(s=>s.item);return[st.length,new Set(ss.map(s=>s&&s.item)).size===ss.length]});
if(!(mgS[0]>=1&&mgS[0]<=2&&mgS[1]))fail('まとめて育成のメガストーン: '+JSON.stringify(mgS));
// こだわり条件で組む（2026/11/08）：絶対入れたい匹（メガの姿）・入れたくない匹・メガの数・トリルは遅い匹
const kd=await pg.evaluate(()=>{const s=JSON.stringify(KD),t0=team.slice();team.length=0;team.push({no:10058,sel:true});Object.assign(KD,{type:'ofcycle',big:'cycle',ng:[149],mega:2,opt:{fast:true,resist:true},seed:0});
  const A=kdBuild();KD.type='tr';team.length=0;KD.ng=[];KD.mega=0;const B=kdBuild();Object.assign(KD,JSON.parse(s));team.length=0;t0.forEach(x=>team.push(x));
  return[A.mons.length===6,A.mons[0].no===445&&A.ss[0].item==='garchompite',!A.mons.some(m=>m.no===149),A.ss.filter(x=>x&&isStone(x.item)).length===2,
    B.ss.filter(x=>x&&isStone(x.item)).length===0,B.mons.filter(m=>m.s[5]<=60).length>=4]});
if(kd.join()!=='true,true,true,true,true,true')fail('こだわり条件で組む: '+kd.join());
// 細かい型（壁展開・フィールド・害悪）：その役わりの匹が入る・ポケモンを選ばなくても組める
const kd2=await pg.evaluate(()=>{const s=JSON.stringify(KD);const r=[];
  for(const [big,tp,test] of [['tenkai','screens',p=>kdK(p,['reflect'])&&kdK(p,['lightscreen'])||kdK(p,['auroraveil'])],['stall','toxstall',p=>kdK(p,['toxic'])&&kdK(p,['protect'])],['cycle','pivot',p=>kdK(p,PR_PIV)],['tenkai','baton',p=>kdK(p,['batonpass'])],['stall','perish',p=>kdK(p,['perishsong'])],['combo','moody',p=>(ABD[p.no]||[]).some(a=>a[0]==='moody')],['speed','tr',p=>p.s[5]<=60]]){
    const t0=team.slice();team.length=0;Object.assign(KD,{big,type:tp,ng:[],mega:1,opt:{resist:true},seed:0});const R=kdBuild();team.length=0;t0.forEach(x=>team.push(x));r.push(R.mons.length===6&&R.mons.some(test))}
  Object.assign(KD,JSON.parse(s));return r});
// 帯の数（2026/11/08 依頼主：組み合わせの数ではなく「最初に決めた匹と相性がよく、条件に合う匹の数」）
const kc=await pg.evaluate(()=>{const s=JSON.stringify(KD),t0=team.slice();team.length=0;Object.assign(KD,{big:'auto',type:'auto',ng:[],opt:{resist:true}});const all=kdMatch().n;Object.assign(KD,{big:'combo',type:'revival'});const one=kdMatch().n;
  KD.big='auto';KD.type='auto';team.push({no:149,sel:true});const withMon=kdMatch().n;team.length=0;t0.forEach(x=>team.push(x));Object.assign(KD,JSON.parse(s));return[all>=200,one>0&&one<all,withMon>0&&withMon<all]});
const kg=await pg.evaluate(()=>{const s=JSON.stringify(KD),t0=team.slice();team.length=0;Object.assign(KD,{big:'stall',type:'perish',ng:[],mega:2,opt:{resist:true},seed:0});const R=kdBuild();team.length=0;t0.forEach(x=>team.push(x));Object.assign(KD,JSON.parse(s));
  const i=R.mons.findIndex(m=>m.no===94);return[kdHasAb(byNo[94],['shadow-tag']),i>=0&&R.ss[i].item==='gengarite',abHolders('shadow-tag').some(m=>m.no===10038)]});
if(kg.join()!=='true,true,true')fail('メガシンカ後の特性（メガゲンガーのかげふみ）: '+kg.join());
if(kc.join()!=='true,true,true')fail('こだわり条件の匹の数: '+kc.join());
if(kd2.join()!=='true,true,true,true,true,true,true')fail('こだわり条件の細かい型: '+kd2.join());
// ツール一覧の入口が消えていない（2026/11/08 戦術メモの入口を誤って消していた）
const tl=await pg.evaluate(()=>{const ids=GAMES[0].tools().map(t=>t.id);return ['memo','pip','assist','calc','pair','tier','meta','season','replay'].filter(k=>!ids.includes(k)&&!(k==='pair'))});
if(tl.length)fail('ツール一覧から消えている: '+tl.join());
// 1対1の判定（2026/11/06 duel）：きあいのタスキで一撃では倒れない・ばけのかわを「倒せない」と数えない・積み技の記録
const du=await pg.evaluate(()=>{const g=byNo[445],gg=byNo[94],mm=byNo[778];const A=mkMon(g,'me',detSet(g));
  const o1=mkMon(gg,'op',{...detSet(gg),item:null}),o2=mkMon(gg,'op',{...detSet(gg),item:'focussash'});
  const d1=duel(A,o1),d2=duel(A,o2),d3=duel(A,mkMon(mm,'op',detSet(mm)));
  const sd=+Object.keys(MD).find(i=>MD[i][3]==='swordsdance'),sc=savedToCalc(445,{mv:[{id:sd},{id:89}]});
  return[d1.mt<2,d2.mt>=2,d3.h.pct>0&&d3.mt<9,sc.boost==='swordsdance']});
if(du.join()!=='true,true,true,true')fail('1対1の判定: '+du.join());
// 上位構築のデータ（2026/11/06 57-topteams.js）：組み合わせ・相手の候補・相手の型に混ざる
const tp=await pg.evaluate(()=>{const T=(r,nos)=>({r,old:0,v:1,team:nos.map(no=>({no,set:no===887?{mv:[{id:434}],it:{k:'choicescarf'}}:null}))});
  topBuild([T(1,[445,823,1018,887,1000,149]),T(5,[445,823,1018,887,130,727]),T(9,[445,823,887,1000,149,130]),T(30,[1018,823,445,1000,727,212])],FMT,Date.now(),'テスト');
  const r=[topReady(),TOPT.core2[0]&&TOPT.core2[0].nos.includes(445),metaOpps(10).some(q=>q.no===823),detSet(byNo[887]).item==='choicescarf'&&detSet(byNo[887]).moves.length===4,/上位構築/.test(topCoresHTML([{no:445},{no:823}]))];
  TOPT.st='idle';TOPT.n=0;return r});
if(tp.join()!=='true,true,true,true,true')fail('上位構築のデータ: '+tp.join());
// 画像の読み取り：特性は、そのポケモンが持てる特性から選ぶ（2026/11/05：いかく が「いかがかぐく」と読まれた件）
const abr=await pg.evaluate(()=>{const sl={nameRaw:'ボーマンダ',noFix:373,abRaw:'いかがかぐく',itRaw:'',mvRaw:[]};try{imResolve(sl)}catch(e){return 'ERR '+e.message}return sl.ab&&sl.ab.k});
if(abr!=='intimidate')fail('画像の読み取りの特性: '+abr);
// 画像の読み取り：覚えない技・読めない文字は出さない（2026/11/05 依頼主：ない技が表示されるのはまずい）。あとから足した43技も名前から引ける
const mvr=await pg.evaluate(()=>{const sl={nameRaw:'ゴリランダー',noFix:812,abRaw:'グラスメイカー',itRaw:'1用矢了)た圭',mvRaw:['にコルムルデアウッワ','|すれ拓か','ドラムアタック','つるぎのまい']};imResolve(sl);
  const ls=LSD[812][1];const bad=sl.mv.filter(m=>m.id&&!(ls.includes(m.id)||m.id===182||m.id===197));
  return [bad.length,sl.mv.every(m=>m.id||m.n===''),!!MVJ['うたかたのアリア'],!!MVJ['アクセルロック'],sl.it.k===null||!!ITEMN[sl.it.k]||!!ITJ[sl.it.n]].join()});
if(mvr!=='0,true,true,true,true')fail('画像の読み取りの技: '+mvr);
// 持ち物（2026/11/04 依頼主の完全なリスト）：ゲームにある85種はすべて選べて、ないもの（こだわりハチマキ・こだわりメガネ・とつげきチョッキ）は選べない。読み取りの表にもない
const itc=await pg.evaluate(()=>[CH_ITEMS.size,[...CH_ITEMS].filter(k=>!ITEMN[k]).join(),['choiceband','choicespecs','assaultvest','heavydutyboots'].filter(k=>ITEMN[k]||Object.values(ITJ).includes(k)).join(),
  Object.keys(ITEMN).filter(k=>!CH_ITEMS.has(k)&&!isStone(k)).join(),[...CH_ITEMS].filter(k=>!ITEM_GUIDE[k]).join()]);
if(!(itc[0]===85&&!itc[1]&&!itc[2]&&!itc[3]&&!itc[4]))fail('持ち物の一覧: '+JSON.stringify(itc));
// 間違いを報告（50-contact.js）：図鑑のページから押すと、その画面の名前を付けて報告の画面が開く
await pg.evaluate(()=>{location.hash='#/p/445'});await pg.waitForTimeout(500);
await pg.click('#view [data-report]');await pg.waitForTimeout(400);
const ctv=await pg.evaluate(()=>[location.hash,document.querySelector('.ct .note')&&document.querySelector('.ct .note').textContent.includes('ガブリアスの図鑑'),!!document.getElementById('ct-send')]);
if(!(ctv[0]==='#/contact/'+encodeURIComponent('#/p/445')&&ctv[1]&&ctv[2]))fail('間違いを報告: '+ctv.join());
// 強いポケモンランキング（51-tier.js）：S〜Cに分かれ、どれにも理由が付く
const tier=await pg.evaluate(()=>{const T=tierCompute();return[T.n,['S','A','B','C'].every(t=>T.rows.some(r=>r.tier===t)),T.rows.every(r=>tierWhy(r,T).length>=2),T.rows[0].score>=T.rows[T.n-1].score]});
if(!(tier[0]>=40&&tier[1]&&tier[2]&&tier[3]))fail('強いポケモンランキング: '+tier.join());
// 戦闘中に変わる姿（2026/11/04 依頼主のリストとの照らし合わせ）：ギルガルドは攻撃をブレードフォルム、受けをシールドフォルムで、イルカマンはマイティフォルムで計算。名前の直し
const bfm=await pg.evaluate(()=>{const a=mkMon(byNo[681],'me',{ab:'stance-change',sp:[0,0,0,0,0,0],up:-1,dn:-1,moves:[]}),h=mkMon(byNo[964],'me',{ab:'zero-to-hero',sp:[0,0,0,0,0,0],up:-1,dn:-1,moves:[]});
  return[a.stAtk[1],a.st[2],h.st[1],byNo[678].n,byNo[711].n,byNo[745].n,byNo[931].n,!!battleFormHTML(byNo[351])]});
if(bfm.join()!=='160,160,180,ニャオニクス（オス）,パンプジン（ちゅうだましゅ）,ルガルガン（まひるのすがた）,イキリンコ（グリーンフェザー）,true')fail('戦闘中の姿・名前: '+bfm.join());
// 特性（2026/11/04 依頼主のリストと照らし合わせ）：ゲッコウガに「きずなへんげ」はない。メガの特性3つは日本語の名前
const abc=await pg.evaluate(()=>[(ABD[658]||[]).some(a=>a[0]==='battle-bond'),ABN['eelevate'],ABN['fire-mane'],ABN['aura-guard']].join());
if(abc!=='false,うなぎのぼり,ほのおのたてがみ,はどうのぼうご')fail('特性の照らし合わせ: '+abc);
// ギルガルドのバトルスイッチ（52-statmorph.js）：スイッチでブレードフォルムの種族値に変わる
await pg.evaluate(()=>{location.hash='#/p/681'});await pg.waitForTimeout(500);
await pg.evaluate(()=>document.getElementById('bsw').click());await pg.waitForTimeout(900);
const bsw=await pg.evaluate(()=>[document.getElementById('bsw').getAttribute('aria-checked'),[...document.querySelectorAll('#dp-pages [data-panel="0"] .stat b')].slice(0,6).map(b=>b.textContent).join('-')]);
if(bsw.join()!=='true,60-140-50-140-50-60')fail('バトルスイッチ: '+bsw.join());
await pg.evaluate(()=>{location.hash='#/p/964'});await pg.waitForTimeout(500);
await pg.evaluate(()=>document.getElementById('bsw').click());await pg.waitForTimeout(900);
const bsw2=await pg.evaluate(()=>[document.querySelector('.bsw .bsw-l[data-side="1"]').textContent,document.getElementById('bsw').getAttribute('aria-checked'),[...document.querySelectorAll('#dp-pages [data-panel="0"] .stat b')].slice(0,6).map(b=>b.textContent).join('-')]);
if(bsw2.join()!=='マイティフォルム,true,100-160-97-106-87-100')fail('マイティチェンジ: '+bsw2.join());
// 図鑑の「元の姿・メガ」の切りかえはその場で（ページを移さない・スクロールとタブはそのまま・戻る履歴を増やさない）
await pg.evaluate(()=>{location.hash='#/p/6'});await pg.waitForTimeout(500);
const fam=await pg.evaluate(async()=>{document.querySelector('#seg [data-i="3"]').click();await new Promise(r=>setTimeout(r,300));SCROLLER.scrollTop=200;const h0=history.length,y0=scrY();
  document.querySelectorAll('.fam-pills a')[1].click();await new Promise(r=>setTimeout(r,800));
  return[history.length===h0,Math.abs(scrY()-y0)<5,document.querySelector('#seg [aria-selected="true"]').dataset.i,!!byNo[+location.hash.split('/')[2]].base]});
if(fam.join()!=='true,true,3,true')fail('姿の切りかえ: '+fam.join());
// ダメージ計算：ポケモンは名前を打って絞り込んで選ぶ
await pg.evaluate(()=>{location.hash='#/calc'});await pg.waitForTimeout(400);
await pg.click('.mpick >> nth=1');await pg.waitForTimeout(250);
await pg.keyboard.type('はっさ');await pg.waitForTimeout(150);
const mpc=await pg.$$eval('.mp-r .pn-n',x=>x.map(e=>e.textContent));
await pg.keyboard.press('Enter');await pg.waitForTimeout(400);
const mpa=await pg.evaluate(()=>[...document.querySelectorAll('.mpick b')].map(b=>b.textContent)[1]);
if(mpc.join()!=='ハッサム'||mpa!=='ハッサム')fail('ポケモンの絞り込み選択: '+mpc.join(',')+' → '+mpa);
// パーティは3つまで保存して切り替えられる（中身は別々に残る）
const tr=await pg.evaluate(()=>{const c0=TEAMS.cur;switchTeam(1);team=[{no:445,sel:true}];saveTeam();switchTeam(2);const e=team.length;switchTeam(1);const a=team.map(x=>x.no).join();
  const st=JSON.parse(localStorage.getItem('pcteams'));switchTeam(c0);return[e,a,st.list.length,st.list[1].team[0].no]});
if(tr.join()!=='0,445,3,445')fail('パーティの保存・切り替え: '+tr.join());
// パーティの選出ボタンは大きく押しやすい／スクロールしても下のメニューは画面の下に固定（2026/11/03 から少し浮いた形＝下から16px以内）
await pg.evaluate(()=>{team.length=0;[445,149,248,10230].forEach(no=>team.push({no,sel:false}));saveTeam();location.hash='#/team'});await pg.waitForTimeout(400);
await pg.click('[data-sel="1"]');await pg.waitForTimeout(150);
const ts=await pg.evaluate(()=>{const b=document.querySelector('.t-sel').getBoundingClientRect();scrTo(0,600);return[b.height,b.width,team[1].sel,location.hash]});
await pg.waitForTimeout(150);
const tb=await pg.evaluate(()=>[scrY()>0,window.scrollY,Math.round(document.querySelector('.tabbar').getBoundingClientRect().bottom),innerHeight]);
if(!(ts[0]>=40&&ts[1]>=90&&ts[2]===true&&ts[3]==='#/team'))fail('選出ボタン: '+ts.join());
if(!(tb[0]&&tb[1]===0&&tb[2]<=tb[3]&&tb[2]>=tb[3]-16))fail('スクロールと下のメニュー: '+tb.join());
await pg.evaluate(()=>{scrTo(0,0);team.length=0;saveTeam()});
// 選出アシスト：相手とパーティを入れると「選出のアドバイス」が出る（ペリッパー→天気、カイリュー→受けられない技など）
await pg.evaluate(()=>{team.length=0;[445,149,248,6,9,94].forEach(no=>team.push({no,sel:false}));saveTeam();
  opp6.length=0;['カイリュー','ガオガエン','ブリムオン','ペリッパー','メタグロス','ドドゲザン'].forEach(n=>{const p=P.find(q=>q.n===n);if(p)opp6.push(p.no)});saveOpp6();location.hash='#/assist'});
await pg.waitForTimeout(1200);
const adv=await pg.evaluate(()=>[...document.querySelectorAll('.adv b')].map(e=>e.textContent));
if(!(adv.length>=2&&adv.some(t=>/ペリッパー/.test(t))))fail('選出のアドバイス: '+adv.join(' / '));
await pg.evaluate(()=>{opp6.length=0;saveOpp6();team.length=0;saveTeam()});
// 技のページの使いどころは、その技のデータから作る（グループの説明と食い違わない）
const mt=await pg.evaluate(()=>{const g=k=>moveTips(mvKeyId[k]).join(' ');return[g('confuseray'),g('protect'),g('closecombat'),g('willowisp')]});
// スケイルショット：防御が下がり素早さが上がる（2026/11/07 依頼主の指摘）・「続けて使うと弱くなる」とは書かない
const ss=await pg.evaluate(()=>[MD[799][1],moveTips(799).join(' ')]);
if(!/防御が1段階下がり、素早さが1段階上がる/.test(ss[0])||/続けて使うと弱くなる/.test(ss[1]))fail('スケイルショット: '+ss.join(' ｜ '));
if(/やけど|まひ|ねむり/.test(mt[0])||/攻撃できる/.test(mt[1])||!/防御・特防が下がり/.test(mt[2])||!/やけど/.test(mt[3]))fail('技の使いどころ: '+mt.join(' ｜ '));
// 明るい画面：端末がライトモードなら明るい色、ダークモードなら暗い色
await pg.emulateMedia({colorScheme:'light'});await pg.waitForTimeout(200);
const lt=await pg.evaluate(()=>[document.documentElement.dataset.theme,getComputedStyle(document.body).backgroundColor]);
await pg.emulateMedia({colorScheme:'dark'});await pg.waitForTimeout(200);
const dk=await pg.evaluate(()=>[document.documentElement.dataset.theme,getComputedStyle(document.body).backgroundColor]);
if(lt[0]!=='light'||lt[1]!=='rgb(238, 240, 245)'||dk[0]!=='dark'||dk[1]!=='rgb(0, 0, 0)')fail('ライト／ダークの切りかえ: '+lt.join()+' / '+dk.join());
// PC（広い画面）：左のメニュー・右の列が出て、横にはみ出さず、「相性を調べる」が開く
for(const [w,side] of [[1440,true],[1024,false]]){
  await pg.setViewportSize({width:w,height:900});await pg.evaluate(()=>{location.hash='#/dex'});await pg.waitForTimeout(300);
  const L=await pg.evaluate(()=>{const r=e=>document.querySelector(e).getBoundingClientRect();
    return{nav:r('.tabbar'),app:r('.app'),side:getComputedStyle(document.querySelector('.pcside')).display,
      over:document.documentElement.scrollWidth>innerWidth,fab:getComputedStyle(document.getElementById('fabwrap')).display}});
  if(!(L.nav.height>500&&L.nav.right<=L.app.left+1))fail(`PC(${w}px)：左のメニューの位置が正しくありません`);
  if(L.app.width>601||L.app.width<599)fail(`PC(${w}px)：本文の幅が600pxではありません: ${L.app.width}`);
  if((L.side!=='none')!==side)fail(`PC(${w}px)：右の列の表示が正しくありません`);
  if(L.over)fail(`PC(${w}px)：横にはみ出しています`);
  if(L.fab!=='none')fail(`PC(${w}px)：右下の丸いボタンが残っています`);
  await pg.click('#pc-post');await pg.waitForTimeout(400);
  if(await pg.evaluate(()=>document.getElementById('sheet').hidden))fail(`PC(${w}px)：「相性を調べる」が開きません`);
  await pg.keyboard.press('Escape');await pg.evaluate(()=>closeSheet());await pg.waitForTimeout(300);
}
await pg.setViewportSize({width:390,height:844});
const bad=errs.filter(e=>!/Failed to load resource|net::/.test(e));
if(bad.length)fail('ページのエラー: '+bad.slice(0,5).join(' / '));
await b.close();
console.log(process.exitCode?'site: NG':'site: OK',`（${routes.length}画面）`);
