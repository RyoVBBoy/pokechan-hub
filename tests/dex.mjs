// 図鑑の一覧（src/js/08-dex.js）の表示の確認（2026/11/10）：前の画面の通知を消す・高速の絞り込み・素早さの並び替え・併用・名前とタイプとの併用・雷のボタンの名前・出典の札・はみ出し
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
let n=0,bad=0;const ok=(c,m)=>{n++;if(!c){bad++;console.error('NG',m)}};
for(const W of [390,1000,1280]){
  const pg=await (await b.newContext({viewport:{width:W,height:900},locale:'ja-JP',hasTouch:W<700,isMobile:W<700})).newPage();
  const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.route(/^https?:/,r=>r.abort());
  await pg.goto(URL0+'#/team');await pg.waitForTimeout(700);
  /* 1. 前の画面で出ていた通知は、図鑑に移ると消える。図鑑で新しく出した通知は出て、2.2秒で消える（今までどおり） */
  await pg.evaluate(()=>toast('前の画面の通知'));await pg.waitForTimeout(600);
  await pg.evaluate(()=>{location.hash='#/dex'});await pg.waitForTimeout(400);
  ok(!(await pg.evaluate(()=>document.getElementById('toast').classList.contains('on'))),W+'：前の画面の通知が図鑑に残っている');
  await pg.evaluate(()=>toast('図鑑の通知'));await pg.waitForTimeout(300);
  ok(await pg.evaluate(()=>{const t=document.getElementById('toast');return t.classList.contains('on')&&t.textContent==='図鑑の通知'}),W+'：図鑑で出した通知が出ない');
  await pg.waitForTimeout(2200);
  ok(!(await pg.evaluate(()=>document.getElementById('toast').classList.contains('on'))),W+'：通知の消える時間が変わった');
  /* 2〜5. 絞り込み・並び替え。期待値はデータから直接（判定は 02-data.js の roles()＝素早さ種族値100以上） */
  const R=await pg.evaluate(async()=>{const r={},sel=(id,v)=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event(id==='dq'?'input':'change'))};
    const names=()=>[...document.querySelectorAll('#dl a.row')].map(e=>e.getAttribute('href').replace('#/p/',''));
    const cnt=()=>+document.querySelector('.dx-cnt b').textContent.replace('匹','');
    const fast=P.filter(p=>p.s[5]>=100);
    document.querySelector('#pills [data-r="高速"]').click();
    r.fast=cnt()===fast.length&&P.every(p=>p.roles.includes('高速')===(p.s[5]>=100));
    r.fastOrder=names().join()===fast.map(p=>String(p.no)).join();
    r.desc=/高速（素早さ種族値が100以上）/.test(document.querySelector('.dx-cond').textContent)&&document.querySelector('#pills [data-r="高速"]').title==='高速（素早さ種族値が100以上）';
    document.querySelector('#pills [data-r=""]').click();sel('ds','5');
    const bySpd=[...P].sort((a,b)=>b.s[5]-a.s[5]);
    r.sort=cnt()===P.length&&names().join()===bySpd.map(p=>String(p.no)).join();
    document.querySelector('#pills [data-r="高速"]').click();
    r.both=cnt()===fast.length&&names().join()===[...fast].sort((a,b)=>b.s[5]-a.s[5]).map(p=>String(p.no)).join()&&/絞り込んだ中で並び替え/.test(document.querySelector('.dx-cond').textContent);
    sel('dt','ほのお');
    const ft=[...fast].filter(p=>p.t.includes('ほのお')).sort((a,b)=>b.s[5]-a.s[5]);
    r.type=cnt()===ft.length&&names().join()===ft.map(p=>String(p.no)).join();
    sel('dq','リザ');
    const fq=ft.filter(p=>nmHit(p,'リザ'));
    r.name=fq.length>0&&cnt()===fq.length&&names().join()===fq.map(p=>String(p.no)).join();
    sel('dq','');sel('dt','');document.querySelector('#pills [data-r=""]').click();sel('ds','no');
    r.reset=cnt()===P.length&&names()[0]===String(P[0].no);
    /* 出典の札：SRC.stats の名前・確認の状況（LV）・日付と同じ */
    const s=document.querySelector('.dx-src .srcb-l');
    r.src=!!s&&s.textContent.includes(SRC.stats.name)&&s.textContent.includes(LV[SRC.stats.lv][0])&&s.textContent.includes(SRC.stats.date)&&document.querySelector('.dx-src-d').textContent.includes(LV[SRC.stats.lv][2]);
    r.srcApart=!document.querySelector('.dx-cnt').contains(s);
    r.over=document.body.scrollWidth<=innerWidth;
    return r});
  Object.entries(R).forEach(([k,v])=>ok(v,W+'：'+k));
  /* 6. 雷のボタンの名前：PCは左のメニュー（押す前に title で名前、1280px以上は文字）、スマホは右下のボタンに「相性」 */
  const B=await pg.evaluate(W=>{const p=document.getElementById('pc-post'),f=document.getElementById('fab');
    if(W>=700)return [p.title==='相性を調べる',p.getAttribute('aria-label')==='相性を調べる',W<1280||getComputedStyle(p.querySelector('span')).position==='static'];
    const l=f.querySelector('.fl');return [!!l&&l.textContent==='相性',l&&l.getBoundingClientRect().width>1,f.getAttribute('aria-label')==='相性をワンタップで調べる']},W);
  ok(B.every(Boolean),W+'：雷のボタンの名前 '+B);
  ok(!errs.length,W+'：画面のエラー '+errs.join('/'));
  await pg.close();
}
await b.close();
console.log(bad?`dex: ${bad}/${n} 項目が失敗`:`dex: OK（${n}項目）`);process.exit(bad?1:0);
