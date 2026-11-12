// パーティ・お気に入り・戦術メモの同期の確認（2026/11/12、H1〜H3）：
// サーバーはページの中のにせもの（authFetch を置きかえる。/api/me/teams の 409 もサーバーと同じ決まり）。
// ①H2 枠ごとに合わせる：ほかの端末で直した枠を、この端末の別の枠の変更で消さない／枠を切りかえただけでは時刻を進めない／前の版（at なし）のデータも読める
// ②H1 ログインした人が変わったら、前の人のデータを新しい人のアカウントに送らない・ログアウトで端末から消える・送れないときは確かめる
// ③H3 同じブラウザの2つのタブ：一方の変更がもう一方にすぐ入り、もう一方の保存で消えない（パーティ・お気に入り・戦術メモ）
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
let ng=0,n=0;const ok=(c,m)=>{n++;if(!c){ng++;console.log('NG '+m)}};
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const ctx=await b.newContext({viewport:{width:390,height:844},locale:'ja-JP'});
const errs=[];
/* ページの中のにせのサーバー（window.__srv をタブどうしで共有はしないので、テストからまとめて渡す） */
const MOCK=()=>{
  window.__srv=window.__srv||{};window.__fail=false;window.__calls=[];
  const S=uid=>window.__srv[uid]||(window.__srv[uid]={teams:null,updated_at:0,favs:null,memo:null});
  window.authFetch=async(p,body)=>{
    if(window.__fail)throw Object.assign(new Error('通信できませんでした'),{status:0});
    const uid=AUTH.user&&AUTH.user.uid;if(!uid)throw Object.assign(new Error('ログインし直してください'),{status:401});
    const s=S(uid);window.__calls.push([uid,p,body?'POST':'GET']);
    if(p==='/api/me/teams'){
      if(!body)return JSON.parse(JSON.stringify({teams:s.teams,updated_at:s.updated_at,now:Date.now()}));
      if(s.updated_at>body.updated_at)throw Object.assign(new Error('newer'),{status:409});
      s.teams=JSON.parse(JSON.stringify(body.teams));s.updated_at=body.updated_at;return{ok:true}}
    if(p==='/api/me/favs'){if(!body)return{favs:s.favs};s.favs=JSON.parse(JSON.stringify(body.favs));return{ok:true}}
    if(p==='/api/me/memo'){if(!body)return{memo:s.memo};s.memo=JSON.parse(JSON.stringify(body.memo));return{ok:true}}
    return{};
  };
  window.twAuth=async()=>AUTH.user?{handle:'t'}:null;
  window.__login=uid=>{AUTH.user={uid,getIdToken:async()=>'x'};AUTH.profile={handle:uid};acOwner(uid)};
};
const open=async()=>{const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));await p.goto(URL0+'#/team');await p.waitForTimeout(900);await p.evaluate(MOCK);return p};
const pg=await open();
const slots=p=>p.evaluate(()=>TEAMS.list.map(s=>s.team.map(x=>x.no).join()));

/* ---------- ①H2 ---------- */
await pg.evaluate(()=>{__login('A');TEAMS.cur=0;team=[{no:445,sel:true}];saveTeam()});
await pg.evaluate(()=>teamSync(true));
let srv=await pg.evaluate(()=>__srv.A);
ok(srv.teams&&srv.teams.list[0].team[0].no===445&&srv.teams.list[0].at>0,'H2 保存したとき枠に時刻が付きません '+JSON.stringify(srv.teams));
/* ほかの端末が枠2を直した（サーバーの時刻が新しい） */
await pg.evaluate(()=>{const s=__srv.A;s.teams.list[1]={name:'ほかの端末',team:[{no:149}],at:Date.now()+5000};s.updated_at=Date.now()+5000});
/* この端末は古い中身のまま、枠を切りかえる → 時刻は進まない */
const before=await pg.evaluate(()=>[TEAMS.updated,TEAMS.list.map(s=>s.at)]);
await pg.evaluate(()=>{switchTeam(2);switchTeam(0)});
const after=await pg.evaluate(()=>[TEAMS.updated,TEAMS.list.map(s=>s.at)]);
ok(JSON.stringify(before)===JSON.stringify(after),'H2 枠を切りかえただけで時刻が進みます '+JSON.stringify([before,after]));
/* この端末で枠1を直す → 合わせたあと、枠1はこの端末・枠2はほかの端末のまま */
await pg.evaluate(()=>{team=[{no:445,sel:true},{no:248,sel:true}];saveTeam()});
await pg.evaluate(()=>{clearTimeout(SYNC.t);return teamSync(true)});await pg.waitForTimeout(600);
srv=await pg.evaluate(()=>__srv.A.teams.list.map(s=>s.team.map(x=>x.no).join()));
ok(srv[0]==='445,248'&&srv[1]==='149','H2 ほかの端末の変更が消えました（サーバー） '+JSON.stringify(srv));
let loc=await slots(pg);
ok(loc[0]==='445,248'&&loc[1]==='149','H2 ほかの端末の変更が入りません（端末） '+JSON.stringify(loc));
ok(await pg.evaluate(()=>TEAMS.list[1].name==='ほかの端末'),'H2 枠の名前が入りません');
/* 前の版（枠に at がない）のサーバーのデータ：全体の時刻で比べる */
await pg.evaluate(()=>{__srv.A={teams:{cur:0,list:[{name:'',team:[{no:6}]},{name:'',team:[]},{name:'',team:[]}]},updated_at:Date.now()+60000}});
await pg.evaluate(()=>teamSync(true));await pg.waitForTimeout(600);
loc=await slots(pg);
ok(loc[0]==='6','H2 前の版のデータ（新しいほう）が入りません '+JSON.stringify(loc));
/* 同時に書いた（409）：読み直して合わせる */
await pg.evaluate(()=>{let first=true;const f=window.authFetch;window.authFetch=async(p,body)=>{if(p==='/api/me/teams'&&body&&first){first=false;const s=__srv.A;s.teams.list[2]={name:'',team:[{no:3}],at:teamNow()+9000};s.updated_at=teamNow()+9000;throw Object.assign(new Error('newer'),{status:409})}return f(p,body)};
  team=[{no:6,sel:true},{no:9,sel:true}];saveTeam();clearTimeout(SYNC.t);return teamSync(true)});
await pg.waitForTimeout(1500);
srv=await pg.evaluate(()=>__srv.A.teams.list.map(s=>s.team.map(x=>x.no).join()));
ok(srv[0]==='6,9'&&srv[2]==='3','H2 同時に書いたときに片方が消えました '+JSON.stringify(srv));
await pg.evaluate(MOCK);

/* ---------- ②H1 ---------- */
await pg.evaluate(()=>{favSet(445,true);MEMO.mon[445]={t:'Aのメモ',at:Date.now()};memoSave()});
await pg.evaluate(async()=>{clearTimeout(FAV_T);clearTimeout(MEMO_T);await favPull();await memoPull()});
ok(await pg.evaluate(()=>__srv.A.favs&&__srv.A.favs[445].on===1&&__srv.A.memo.mon[445].t==='Aのメモ'),'H1 準備：A のお気に入り・メモが保存されません');
/* ログアウトせずに（ログインの期限切れ等）別の人 B がログイン */
await pg.evaluate(()=>{AUTH.user=null;__login('B')});
loc=await slots(pg);
ok(loc.every(x=>x===''),'H1 別の人がログインしても前の人のパーティが残ります '+JSON.stringify(loc));
ok(await pg.evaluate(()=>!favOn(445)&&!MEMO.mon[445]),'H1 別の人がログインしても前の人のお気に入り・メモが残ります');
await pg.evaluate(()=>teamSync(true));await pg.waitForTimeout(800);
srv=await pg.evaluate(()=>__srv.B);
ok(!srv||!srv.teams||srv.teams.list.every(s=>!s.team.length),'H1 前の人のパーティが新しい人のアカウントに送られました '+JSON.stringify(srv&&srv.teams));
ok(!srv||!srv.favs||!srv.favs[445],'H1 前の人のお気に入りが新しい人のアカウントに送られました');
ok(!srv||!srv.memo||!(srv.memo.mon||{})[445],'H1 前の人のメモが新しい人のアカウントに送られました');
ok(await pg.evaluate(()=>!localStorage.getItem('pcteams_backup')),'H1 前の人のパーティの控えが端末に残ります');
/* A がもう一度ログイン → サーバーから戻る */
await pg.evaluate(()=>{AUTH.user=null;__login('A')});await pg.evaluate(()=>teamSync(true));await pg.waitForTimeout(800);
loc=await slots(pg);
ok(loc[0]==='6,9'&&loc[2]==='3','H1 同じ人がもう一度ログインしてもパーティが戻りません '+JSON.stringify(loc));
ok(await pg.evaluate(()=>favOn(445)&&MEMO.mon[445]&&MEMO.mon[445].t==='Aのメモ'),'H1 同じ人がもう一度ログインしてもお気に入り・メモが戻りません');
/* ログアウト：送ってから消す（AUTH.fb はにせもの） */
await pg.evaluate(()=>{AUTH.fb={au:{signOut:async()=>{AUTH.user=null}},auth:{}};team=[{no:6,sel:true},{no:9,sel:true},{no:25,sel:true}];saveTeam()});
const out=await pg.evaluate(()=>acSignOut());
srv=await pg.evaluate(()=>__srv.A.teams.list[0].team.map(x=>x.no).join());
ok(out===true&&srv==='6,9,25','H1 ログアウトの前に最後の変更が送られません '+srv);
loc=await slots(pg);
ok(loc.every(x=>x==='')&&await pg.evaluate(()=>!localStorage.getItem('pcowner')&&!localStorage.getItem('pcin')&&!favOn(445)),'H1 ログアウトしても端末にデータが残ります '+JSON.stringify(loc));
/* ログインする前に作ったパーティは、はじめてログインした人のものになる（前と同じ） */
await pg.evaluate(()=>{team=[{no:94,sel:true}];saveTeam();__login('C')});await pg.evaluate(()=>teamSync(true));await pg.waitForTimeout(600);
ok(await pg.evaluate(()=>__srv.C&&__srv.C.teams&&__srv.C.teams.list[0].team[0].no===94),'H1 ログインする前に作ったパーティがアカウントに入りません');
/* 送れないときは確かめる（キャンセルで何もしない） */
await pg.evaluate(()=>{AUTH.fb={au:{signOut:async()=>{AUTH.user=null}},auth:{}};team=[{no:94,sel:true},{no:1,sel:true}];saveTeam();__fail=true});
const pr=pg.evaluate(()=>acSignOut());
await pg.waitForSelector('.xc .xc-ok',{timeout:15000}).catch(()=>{});
ok(await pg.$('.xc'),'H1 送れないときにログアウトの前に確かめません');
await pg.click('.xc button:not(.xc-ok)').catch(()=>{});
ok(await pr===false&&await pg.evaluate(()=>AUTH.user&&AUTH.user.uid==='C'&&team.length===2),'H1 キャンセルしたのにログアウトしました');
await pg.evaluate(()=>{__fail=false});

/* ---------- ③H3 ---------- */
await pg.evaluate(()=>{AUTH.user=null;userLocalReset();localStorage.removeItem('pcowner');team=[{no:445,sel:true}];saveTeam()});
const pg2=await open();
await pg2.evaluate(()=>{AUTH.user=null});
/* タブ2で枠2を直す → タブ1にすぐ入る */
await pg2.evaluate(()=>{switchTeam(1);team=[{no:149,sel:true}];saveTeam()});await pg.waitForTimeout(300);
loc=await slots(pg);
ok(loc[0]==='445'&&loc[1]==='149','H3 ほかのタブの変更が入りません '+JSON.stringify(loc));
ok(await pg.evaluate(()=>TEAMS.cur===0&&team.map(x=>x.no).join()==='445'),'H3 ほかのタブで選んだ枠に切りかわりました');
/* タブ1で枠1を直しても、タブ2の枠2の変更は消えない */
await pg.evaluate(()=>{team=[{no:445,sel:true},{no:248,sel:true}];saveTeam()});await pg2.waitForTimeout(300);
const st=await pg2.evaluate(()=>JSON.parse(localStorage.getItem('pcteams')).list.map(s=>s.team.map(x=>x.no).join()));
ok(st[0]==='445,248'&&st[1]==='149','H3 タブの保存でほかのタブの変更が消えました '+JSON.stringify(st));
ok((await slots(pg2))[0]==='445,248','H3 タブ2の中身が古いままです');
/* パーティの画面を開いていれば描き直す */
await pg.evaluate(()=>{switchTeam(1);team=[{no:149,sel:true},{no:6,sel:true}];saveTeam();switchTeam(0)});await pg2.waitForTimeout(300);
const rr=await pg2.evaluate(()=>{const t=document.getElementById('slots');return !!t&&/リザードン/.test(t.innerText)||'NO:'+(t?t.innerText.slice(0,200):location.hash)});ok(rr===true,'H3 パーティの画面が描き直されません '+rr);
/* お気に入り・戦術メモ */
await pg2.evaluate(()=>favSet(6,true));await pg.waitForTimeout(300);
ok(await pg.evaluate(()=>favOn(6)&&document.querySelectorAll('[data-fav]').length>=0),'H3 ほかのタブの ☆ が入りません');
await pg.evaluate(()=>favSet(25,true));await pg2.waitForTimeout(300);
ok(await pg2.evaluate(()=>favOn(6)&&favOn(25)&&JSON.parse(localStorage.getItem('pcfavs'))[6].on===1),'H3 タブの ☆ の保存でほかのタブの ☆ が消えました');
await pg2.evaluate(()=>{MEMO.mon[149]={t:'タブ2',at:Date.now()};memoSave()});await pg.waitForTimeout(300);
await pg.evaluate(()=>{MEMO.mon[445]={t:'タブ1',at:Date.now()};memoSave()});await pg.waitForTimeout(300);
ok(await pg2.evaluate(()=>{const m=JSON.parse(localStorage.getItem('pcmemo')).mon;return m[149]&&m[445]&&MEMO.mon[445]&&MEMO.mon[445].t==='タブ1'}),'H3 タブのメモの保存でほかのタブのメモが消えました');

ok(!errs.length,'ページのエラー: '+errs.join(' / '));
await b.close();
console.log(ng?`sync: NG （${n}項目）`:`sync: OK（${n}項目）`);
process.exit(ng?1:0);
