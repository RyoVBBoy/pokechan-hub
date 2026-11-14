// 診断のメガシンカは1匹だけ（2026/11/14 依頼主の判断：「選んだメガだけを見せる」。点検 P3-05・前の点検 B-1-1）
// ・メガストーンを持つ匹が2匹以上でも、メガの姿で計算するのは1匹だけ
// ・自動＝メガの匹ごとに計算していちばん良いもの／利用者が選んだメガ／変更前と同じメガで比べる
// ・画面：どのメガで計算したかと切りかえボタン（390px）
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
let n=0,bad=0;const ok=(c,m)=>{n++;if(!c){bad++;console.error('NG',m)}};
const ctx=await b.newContext({locale:'ja-JP',viewport:{width:390,height:844}});
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.route(/^https?:/,r=>r.abort());
await pg.goto('file://'+path.join(ROOT,'dist/index.html'));await pg.waitForTimeout(600);

const R=await pg.evaluate(()=>{
  const r={};const N=s=>P.find(x=>x.n===s).no;const stoneOf=no=>Object.keys(MEGA).find(k=>MEGA[k][no]);
  const st=(n,it)=>({no:N(n),sel:false,set:{it:{k:it,n:ITEMN[it]||it}}});
  const megaN=T=>T.M.filter(m=>m&&m.p.base).length;
  /* 2匹がメガストーン（前の点検 B-1-1 と同じ形：リザードン＋ガブリアス） */
  team.length=0;[st('リザードン','charizarditey'),st('ガブリアス',stoneOf(N('ガブリアス'))),...['ドドゲザン','ガオガエン','ゴリランダー','ブリジュラス'].map(s=>({no:N(s),sel:false}))].forEach(x=>team.push(x));
  dgMegaSet(0);TWX_K=null;
  const T=dgTeam0(team,20);
  r.one=megaN(T)===1&&T.mega.holders.length===2;
  r.auto=T.mega.mode==='auto'&&T.mega.alts&&T.mega.alts.length===2;
  /* 自動で選んだものが、決めた順（×→△以下→後出し→一撃→◎）でいちばん良い */
  const k=a=>[a.x,a.w,a.nosw,a.ohko,-a.st];const best=[...T.mega.alts].sort((p,q)=>{const x=k(p),y=k(q);for(let j=0;j<5;j++)if(x[j]!==y[j])return x[j]-y[j];return 0})[0];
  r.autoBest=best.i===T.mega.i;
  /* ◎（2匹で安定）の2匹が、両方メガの姿ということが起きない */
  r.noDouble=T.rows.every(row=>row.stable.filter(z=>T.M[z.i]&&T.M[z.i].p.base).length<=1);
  /* 利用者が選んだメガ */
  const other=T.mega.holders.find(h=>h.i!==T.mega.i);
  dgMegaSet(other.no);const T2=dgTeam(team,20);
  r.user=T2.mega.mode==='user'&&T2.mega.i===other.i&&megaN(T2)===1&&T2.M[other.i].p.base;
  r.sig=/m\d+/.test(dgDataSig());
  /* 変更前と同じメガで比べる（megaNo） */
  dgMegaSet(0);const T3=dgTeam0(team,20,{megaNo:other.no});r.fixed=T3.mega.mode==='fixed'&&T3.mega.i===other.i;
  /* 改善案：変更後も変更前と同じメガ（メガの匹が残るとき） */
  IMP_CACHE.clear();const I=dgImprove(team);
  r.imp=(I.list||[]).filter(o=>o.T1&&o.T1.mega).every(o=>o.T1.mega.holders.length<2||!o.T1.mega.holders.some(h=>h.no===I.T0.mega.no)||o.T1.mega.no===I.T0.mega.no);
  r.impN=(I.list||[]).length;
  /* メガストーンが1匹だけ：そのままメガ（前と同じ） */
  const one=[st('ガブリアス',stoneOf(N('ガブリアス'))),...['ドドゲザン','ガオガエン','ゴリランダー','ブリジュラス','アシレーヌ'].map(s=>({no:N(s),sel:false}))];
  const T4=dgTeam0(one,20);r.single=T4.mega.mode==='one'&&megaN(T4)===1&&!dgMegaBarHTML(T4);
  /* 計算の前提に書く */
  r.prem=/メガシンカは.+だけで計算/.test(dgPremise(T))&&!/メガシンカは.+だけで計算/.test(dgPremise(T4));
  return r});
ok(R.one,'メガストーンを持つ匹が2匹でも、メガの姿で計算するのは1匹だけ');
ok(R.auto&&R.autoBest,'自動はメガの匹ごとに計算し、決めた順でいちばん良いもの');
ok(R.noDouble,'◎の2匹が両方メガの姿にならない');
ok(R.user,'利用者が選んだメガで計算する');
ok(R.sig,'選んだメガが使い回しの鍵に入る');
ok(R.fixed,'変更前と同じメガを指定できる');
ok(R.imp,'改善案は変更前と同じメガで比べる（'+R.impN+'件）');
ok(R.single,'メガストーンが1匹だけならそのまま・切りかえは出さない');
ok(R.prem,'計算の前提にどのメガで計算したかを書く');

/* ---- 画面：チェックのタブにメガの切りかえ ---- */
await pg.evaluate(()=>{dgMegaSet(0);saveTeam();sessionStorage.setItem('pcttab','check');TTAB='check';location.hash='#/team'});
await pg.waitForTimeout(2500);
const U=await pg.evaluate(()=>{const bar=document.querySelector('#dgu-sum .dgm-bar');if(!bar)return{bar:false};
  const bs=[...bar.querySelectorAll('[data-dgm]')];
  return{bar:true,n:bs.length,auto:bs[0].getAttribute('aria-pressed')==='true',h44:bs.every(x=>x.getBoundingClientRect().height>=44),
    over:document.body.scrollWidth>window.innerWidth+1,txt:/1回の対戦でメガシンカできるのは1匹だけ/.test(bar.textContent)}});
ok(U.bar&&U.n===3&&U.auto&&U.txt,'チェックのタブに、どのメガで計算したかと切りかえ（自動＋2匹） '+JSON.stringify(U));
ok(U.h44&&!U.over,'ボタンは高さ44px以上・390pxではみ出さない');
await pg.evaluate(()=>document.querySelectorAll('#dgu-sum [data-dgm]')[2].click());await pg.waitForTimeout(2500);
const U2=await pg.evaluate(()=>{const bs=[...document.querySelectorAll('#dgu-sum [data-dgm]')];const T=dgTeam(team,20);
  return{pressed:bs.length===3&&bs[2].getAttribute('aria-pressed')==='true'&&bs[0].getAttribute('aria-pressed')==='false',sel:dgMegaSel()===+bs[2].dataset.dgm,mode:T.mega.mode,same:T.ms[T.mega.i].x.no===dgMegaSel()}});
ok(U2.pressed&&U2.sel&&U2.mode==='user'&&U2.same,'押すとそのメガで計算し直して描き直す '+JSON.stringify(U2));
await pg.evaluate(()=>dgMegaSet(0));
ok(!errs.length,'ページのエラーなし '+errs.join(' / '));
await b.close();
console.log(`dgmega: ${bad?'NG':'OK'}（${n}項目${bad?`・${bad}件NG`:''}）`);
if(bad)process.exitCode=1;
