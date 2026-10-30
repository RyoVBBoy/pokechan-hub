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
const routes=['#/','#/dex','#/p/10058','#/season','#/learn/build','#/arch/rain','#/arch/tr','#/p/445','#/p/10230','#/types','#/team','#/tools','#/calc','#/assist','#/meta','#/report','#/community','#/lobby','#/bbs','#/games','#/sources','#/battle','#/edit/0','#/cmp/445','#/account','#/terms','#/privacy','#/tl','#/notif','#/u/someone','#/search','#/search/'+encodeURIComponent('#ガブリアス'),'#/learn','#/learn/word','#/item/choicescarf','#/item/garchompitez','#/word/tr','#/learn/move','#/learn/ability','#/move/89','#/ability/intimidate'];
for(const r of routes){
  await pg.evaluate(h=>{location.hash=h},r);await pg.waitForTimeout(250);
  const n=await pg.evaluate(()=>document.querySelector('main')?.innerText.trim().length||0);
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
// パーティの選出ボタンは大きく押しやすい／スクロールしても下のメニューは画面の下に固定
await pg.evaluate(()=>{team.length=0;[445,149,248,10230].forEach(no=>team.push({no,sel:false}));saveTeam();location.hash='#/team'});await pg.waitForTimeout(400);
await pg.click('[data-sel="1"]');await pg.waitForTimeout(150);
const ts=await pg.evaluate(()=>{const b=document.querySelector('.t-sel').getBoundingClientRect();scrTo(0,600);return[b.height,b.width,team[1].sel,location.hash]});
await pg.waitForTimeout(150);
const tb=await pg.evaluate(()=>[scrY()>0,window.scrollY,Math.round(document.querySelector('.tabbar').getBoundingClientRect().bottom),innerHeight]);
if(!(ts[0]>=40&&ts[1]>=90&&ts[2]===true&&ts[3]==='#/team'))fail('選出ボタン: '+ts.join());
if(!(tb[0]&&tb[1]===0&&tb[2]===tb[3]))fail('スクロールと下のメニュー: '+tb.join());
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
if(/やけど|まひ|ねむり/.test(mt[0])||/攻撃できる/.test(mt[1])||!/防御・特防が下がる/.test(mt[2])||!/やけど/.test(mt[3]))fail('技の使いどころ: '+mt.join(' ｜ '));
// 明るい画面：端末がライトモードなら明るい色、ダークモードなら暗い色
await pg.emulateMedia({colorScheme:'light'});await pg.waitForTimeout(200);
const lt=await pg.evaluate(()=>[document.documentElement.dataset.theme,getComputedStyle(document.body).backgroundColor]);
await pg.emulateMedia({colorScheme:'dark'});await pg.waitForTimeout(200);
const dk=await pg.evaluate(()=>[document.documentElement.dataset.theme,getComputedStyle(document.body).backgroundColor]);
if(lt[0]!=='light'||lt[1]!=='rgb(255, 255, 255)'||dk[0]!=='dark'||dk[1]!=='rgb(0, 0, 0)')fail('ライト／ダークの切りかえ: '+lt.join()+' / '+dk.join());
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
