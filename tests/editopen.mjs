// 育成の画面を開くだけでは保存しているパーティを書きかえないことの確認（2026/11/16）
// 前は能力ポイントの無い型（sp:null。上位パーティから写した型など）を育成の画面（#/edit/N）で開くと、editView が保存している
// 技の並びの配列をそのまま編集用に使い、4つにそろえるための空き（null）をその配列に足していた。次の保存（枠の切りかえなど）で
// 空きと変更時刻（枠の at・updated）が localStorage の pcteams に書かれ、何も変えていないのに同期でサーバーにも送られていた。
// A. 6匹とも開いて閉じ、枠を切りかえ、ほかの枠の匹も開き、読み直しても、pcteams が1文字も変わらない（時刻・入れ子の中身も）
// B. 本当に変えたとき（性格を変える）は今までどおり保存される（src:'manual'・空きを捨てる・技は減らない・その枠の時刻だけ進む）
import {chromium} from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
let n=0,ng=0;const ok=(c,m,x)=>{n++;if(!c){ng++;console.error('NG',m,x===undefined?'':JSON.stringify(x).slice(0,600))}};
/* テスト用のパーティは、アプリの入っていない静的ページ（同じ file:// の保存を使う）から、アプリを開く前に1回だけ入れる。
   読み直す前には、そのページから読んで保存がブラウザ全体に届いたことを確かめる */
const OBS_URL='file://'+path.join(ROOT,'dist/ranking/index.html');
if(!fs.existsSync(path.join(ROOT,'dist/ranking/index.html'))){console.error('NG 静的ページ dist/ranking/index.html がありません（tools/gen-pages.cjs を先に動かす）');process.exit(1)}
const appReady=pg=>pg.waitForFunction(()=>document.readyState==='complete'&&typeof TEAMS==='object'&&!!document.querySelector('#view'),null,{timeout:20000});
async function goTo(pg,h){await pg.evaluate(h=>{location.hash=h},h);
  const m=h.match(/^#\/edit\/(\d+)$/);
  if(m)await pg.waitForFunction(i=>typeof ED!=='undefined'&&ED&&ED.idx===i&&!!document.querySelector('#ed-nat [data-nat]'),+m[1],{timeout:20000});
  else await pg.waitForTimeout(400)}
async function persisted(pg,obs){const want=await pg.evaluate(()=>localStorage.getItem('pcteams'));
  for(let t=0;t<400;t++){if(await obs.evaluate(()=>localStorage.getItem('pcteams'))===want)return true;await obs.waitForTimeout(25)}return false}
const diff=(a,c,p='')=>{if(JSON.stringify(a)===JSON.stringify(c))return[];if(typeof a!=='object'||typeof c!=='object'||!a||!c)return[[p,JSON.stringify(a)?.slice(0,140),JSON.stringify(c)?.slice(0,140)]];
  return [...new Set([...Object.keys(a),...Object.keys(c)])].flatMap(k=>diff(a[k],c[k],p+'.'+k))};

const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
/* テスト用のパーティ（ゲームのデータから決まった形で作る）。能力ポイントの無い型を、技2つ・1つ・4つで入れ、ほかの枠にも置く */
let FIX;{const pg=await (await b.newContext({locale:'ja-JP'})).newPage();await pg.goto(URL0+'#/tools');await pg.waitForTimeout(700);
  FIX=await pg.evaluate(()=>{
    const ab=no=>{const a=(ABD[no]||[])[0];return a?{n:ABN[a[0]]||a[0],k:a[0]}:null};
    const it=k=>({n:ITEMN[k]||k,k});
    const mv=no=>(LSD[no]?LSD[no][1]:[]).filter(id=>MV[id]&&MV[id][2]>0).slice(0,4).map(id=>({n:mName(id),id}));
    const S=(no,o)=>({ab:ab(no),it:null,mv:mv(no),sp:[2,32,0,0,0,32],up:1,dn:3,...o});
    const N=(no,k,o)=>({ab:ab(no),it:null,mv:mv(no).slice(0,k),sp:null,up:-1,dn:-1,src:'copy',...o});
    const slot0=[{no:445,sel:true,axis:true,set:S(445,{it:it('lifeorb'),src:'manual'})},
      {no:149,sel:true,set:N(149,2,{it:it('leftovers')})},
      {no:887,sel:true,set:S(887,{it:it('choicescarf'),src:'copy'})},
      {no:983,set:S(983,{it:it('focussash'),src:'import',vals:[183,152,100,110,95,152]})},
      {no:6,set:N(6,2,{it:it('charcoal')})},
      {no:1000,set:N(1000,1,{})}];
    const slot1=[{no:130,sel:true,set:N(130,2,{it:it('sitrusberry')})},{no:3,sel:true,set:N(3,4,{})},{no:547}];
    return{cur:0,list:[{name:'テスト',team:slot0,at:1794000000000},{name:'二つ目',team:slot1,at:1793900000000},{name:'',team:[],at:0}],updated:1794000000000}});
  await pg.context().close()}
ok(FIX.list[0].team.filter(x=>x.set&&!x.set.sp&&x.set.mv.length<4).length===3,'テスト用のパーティに、能力ポイントが無く技が4つ未満の型が入っている',FIX.list[0].team);
const LEG=JSON.stringify(FIX);

const ctx=await b.newContext({viewport:{width:390,height:844},locale:'ja-JP'});
const obs=await ctx.newPage();await obs.goto(OBS_URL);
await obs.evaluate(L=>{localStorage.setItem('pcstart','1');localStorage.setItem('pcteams',L)},LEG);
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.route(/championsbattledata|workers\.dev|googleapis/,r=>r.abort());
const ls=()=>pg.evaluate(()=>localStorage.getItem('pcteams'));
await pg.goto(URL0+'#/team');await appReady(pg);
ok(await ls()===LEG,'A：読んだだけでは保存の中身を書きかえない');

/* ================= A. 開くだけ ================= */
for(let i=0;i<6;i++){await goTo(pg,'#/edit/'+i);
  /* 編集用の中身は保存している型と別のもの（同じ配列を使っていない） */
  const sep=await pg.evaluate(()=>{const s=team[ED.idx].set;return !s||(ED.s!==s&&ED.s.mv!==s.mv&&(!s.sp||ED.s.sp!==s.sp))});
  ok(sep,'A：育成の画面の編集用の中身は、保存している型の配列をそのまま使わない（'+i+'匹目）');
  ok(await pg.evaluate(()=>ED.s.mv.length===4),'A：育成の画面の技の欄は4つ（'+i+'匹目）')}
await goTo(pg,'#/team');
ok(await ls()===LEG,'A：6匹とも育成の画面を開いて閉じても、保存の中身は1文字も変わらない',diff(JSON.parse(LEG),JSON.parse(await ls())));
await pg.evaluate(()=>switchTeam(1));await pg.waitForTimeout(300);
for(let i=0;i<3;i++)await goTo(pg,'#/edit/'+i);
await goTo(pg,'#/team');
await pg.evaluate(()=>switchTeam(0));await pg.waitForTimeout(300);
const vis=await ls();
ok(vis===LEG,'A：枠を切りかえ、ほかの枠の匹も開いても、保存の中身は1文字も変わらない（時刻 at・updated・技の並び・取り込みの実数値も）',diff(JSON.parse(LEG),JSON.parse(vis)));
ok(await pg.evaluate(L=>JSON.stringify(TEAMS.list.map(s=>s.team))===JSON.stringify(JSON.parse(L).list.map(s=>s.team)),LEG),'A：アプリの中のパーティ（TEAMS）も変わらない');
ok(await persisted(pg,obs),'A：保存がブラウザ全体に届いた');
await pg.reload();await appReady(pg);
for(let i=0;i<6;i++)await goTo(pg,'#/edit/'+i);
await goTo(pg,'#/team');await pg.evaluate(()=>{switchTeam(1);switchTeam(0)});await pg.waitForTimeout(300);
ok(await ls()===LEG,'A：読み直してからもう一度開いても、保存の中身は1文字も変わらない',diff(JSON.parse(LEG),JSON.parse(await ls())));

/* ================= B. 本当に変えたとき ================= */
const before=JSON.parse(await ls());
await goTo(pg,'#/edit/4');
const prevSet=await pg.evaluate(()=>JSON.stringify(team[4].set));
/* 能力が上がる・下がる性格（まじめ等の補正なしでない）で、いま選んでいないものを押す */
const pick=await pg.evaluate(()=>{const c=[...document.querySelectorAll('#ed-nat [data-nat]')].find(e=>{const q=NATS[+e.dataset.nat];return q[1]>=0&&q[2]>=0&&q[1]!==q[2]&&!(q[1]===ED.s.up&&q[2]===ED.s.dn)});
  const q=NATS[+c.dataset.nat];c.click();return[q[1],q[2]]});
await pg.waitForFunction(b=>JSON.stringify(team[4].set)!==b&&localStorage.getItem('pcteams')===JSON.stringify(TEAMS),prevSet,{timeout:10000});
const aft=JSON.parse(await ls()),s0=before.list[0].team[4].set,s1=aft.list[0].team[4].set;
ok(s1.src==='manual','B：変えて保存した型は src:manual',s1);
ok(s1.up===pick[0]&&s1.dn===pick[1]&&(s0.up!==pick[0]||s0.dn!==pick[1]),'B：押した性格（上がる・下がる能力）がそのまま保存されている',[pick,s1.up,s1.dn]);
ok(Array.isArray(s1.sp)&&s1.sp.length===6,'B：能力ポイントが無かった型にも、編集の能力ポイントが保存される',s1.sp);
ok(JSON.stringify(s1.mv)===JSON.stringify(s0.mv),'B：技は空き（null）を捨てて、前と同じ技だけが保存される',[s0.mv,s1.mv]);
ok(JSON.stringify(s1.ab)===JSON.stringify(s0.ab)&&JSON.stringify(s1.it)===JSON.stringify(s0.it),'B：特性・持ち物は変わらない',[s0,s1]);
ok(JSON.stringify(aft.list[0].team.filter((x,i)=>i!==4))===JSON.stringify(before.list[0].team.filter((x,i)=>i!==4)),'B：同じ枠のほかの匹は1文字も変わらない');
ok(JSON.stringify(aft.list.slice(1))===JSON.stringify(before.list.slice(1)),'B：ほかの枠は1文字も変わらない（時刻も）');
ok(aft.list[0].at>before.list[0].at&&aft.updated>before.updated,'B：変えた枠の変更時刻（at）と updated は進む',[before.list[0].at,aft.list[0].at,before.updated,aft.updated]);
ok(await persisted(pg,obs),'B：保存がブラウザ全体に届いた');
const saved=await ls();await pg.reload();await appReady(pg);
ok(await ls()===saved&&await pg.evaluate(()=>team[4].set.src==='manual'),'B：読み直しても変えた中身のまま');
ok(errs.length===0,'エラーが出ない',errs);
await b.close();
if(ng){console.error(`editopen: NG ${ng}/${n}`);process.exit(1)}
console.log(`editopen: OK（${n}項目）`);
