// 2026/11/24：覚える技の画面の確かめ。データ（LSD）ではなく、実際に描いた選ぶ欄・図鑑の技の一覧を、覚える技と比べる。
// ①育成の編集（#/edit）の技の欄：264の元の姿すべてで、選べる技＝覚える技（多すぎも足りないもなし）
// ②図鑑の技の一覧：346の姿すべて（メガは元の姿の技）
// ③まもる（182）とみきり（197）は別の技：名前・選べるか・保存して開き直しても残る・計算用の型と保存の形の行き来
// ④覚えない技を保存した型は「覚えません」と出し、ほかの技に置きかえない ⑤技を登録した型の攻撃技が計算できなくても、提案の技に置きかえない
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const pg=await (await b.newContext({locale:'ja-JP',viewport:{width:390,height:844}})).newPage();
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.route(/^https?:/,r=>r.abort());
await pg.goto('file://'+path.join(ROOT,'dist/index.html')+'#/team');await pg.waitForTimeout(800);
let n=0,bad=0;const ok=(c,m,info)=>{n++;if(!c){bad++;console.error('NG',m,info===undefined?'':JSON.stringify(info).slice(0,600))}};
const R=await pg.evaluate(()=>{const o={ed:[],dex:[],det:{}};const keep=team.slice();
  const opts=()=>[...document.querySelectorAll('select[data-mv="0"] option')].map(x=>x.value).filter(v=>v&&v!=='x').map(Number);
  try{
    for(const p of P){team.length=0;team.push({no:p.no});editView('0');const got=opts(),want=lsOf(p);
      const miss=want.filter(id=>!got.includes(id)),extra=got.filter(id=>!want.includes(id)),dup=got.length-new Set(got).size;
      if(miss.length||extra.length||dup)o.ed.push({no:p.no,n:p.n,miss,extra,dup})}
    o.edN=P.length;
    const forms=[...P,...(typeof MEGAP!=='undefined'?MEGAP:[])];o.dexN=forms.length;
    for(const p of forms){let el=document.getElementById('mvpanel');if(!el){el=document.createElement('div');el.id='mvpanel';document.body.appendChild(el)}
      MVS.cat='all';MVS.type='';MVS.q='';movesPanel(p);
      /* 描いた行の技の名前（行には番号を出していないので名前で比べる） */
      const got=[...el.querySelectorAll('#mv-list .mvr-h b')].map(x=>x.textContent.trim());
      const want=lsOf(p).map(mName);const miss=want.filter(x=>!got.includes(x)),extra=got.filter(x=>!want.includes(x));
      if(got.length!==want.length)miss.push('count '+got.length+'/'+want.length);
      if(miss.length||extra.length)o.dex.push({no:p.no,n:p.n,miss:miss.length,extra:extra.length});}
    /* ③ みきり */
    const det=P.filter(p=>lsOf(p).includes(197)),blz=P.find(p=>p.n==='バシャーモ');
    o.det.n=det.length;o.det.megaN=(typeof MEGAP!=='undefined'?MEGAP:[]).filter(p=>lsOf(p).includes(197)).length;
    o.det.both=det.filter(p=>{team.length=0;team.push({no:p.no});editView('0');const g=opts();return g.includes(197)&&(lsOf(p).includes(182)?g.includes(182):!g.includes(182))}).length;
    team.length=0;team.push({no:blz.no,set:{ab:null,it:null,mv:[{id:197,n:'みきり'},{id:299,n:'ブレイズキック'}],sp:[0,32,0,0,2,32],up:1,dn:3}});editView('0');
    const sel0=document.querySelector('select[data-mv="0"]');o.det.shown=sel0.options[sel0.selectedIndex].textContent;o.det.val=sel0.value;
    o.det.name=mName(197);o.det.type=MVU[197]&&MVU[197][0];o.det.pp=MVU[197]&&MVU[197][4];o.det.ppP=MVU[182]&&MVU[182][4];
    /* 保存して開き直す：別の技を選んで変える→戻す */
    sel0.value='182';sel0.dispatchEvent(new Event('change'));o.det.afterProt=team[0].set.mv[0].id;
    sel0.value='197';sel0.dispatchEvent(new Event('change'));o.det.afterDet=team[0].set.mv[0].id;
    editView('0');const s1=document.querySelector('select[data-mv="0"]');o.det.reopen=[s1.value,s1.options[s1.selectedIndex].textContent];
    const c=savedToCalc(blz.no,team[0].set);o.det.calcSid=(c.moves.find(m=>m.prot)||{}).sid;o.det.back=setToSaved(blz,c).mv.map(m=>m.id);
    const both=savedToCalc(blz.no,{mv:[{id:182},{id:197},{id:299}]});o.det.bothBack=setToSaved(blz,both).mv.map(m=>m.id);
    /* メタモンはまもるを覚えない */
    const dit=P.find(p=>p.n==='メタモン');o.ditto={ls:lsOf(dit),learn182:canLearn(dit,182)};
    team.length=0;team.push({no:dit.no});editView('0');o.ditto.opts=opts();
    /* ④ 覚えない技の保存 */
    team.length=0;team.push({no:dit.no,set:{mv:[{id:182,n:'まもる'}],sp:[0,0,0,0,0,0],up:-1,dn:-1}});editView('0');
    const s2=document.querySelector('select[data-mv="0"]');o.ditto.bad=[s2.value,s2.options[s2.selectedIndex].textContent];
    /* ⑤ 計算できない攻撃技だけを登録した型（カウンター）を、提案の技に置きかえない */
    const cnt=P.find(p=>lsOf(p).includes(68)&&lsOf(p).some(id=>MV[id]));
    const cs=savedToCalc(cnt.no,{mv:[{id:68,n:'カウンター'}]});o.uncalc={n:cnt.n,moves:cs.moves.length,uncalc:cs.uncalc,est:cs.estMv,note:dgCalcUnsupported(mkMon(cnt,'me',cs)).join('/')};
    const cs0=savedToCalc(cnt.no,{mv:[]});o.uncalc.empty=[cs0.moves.length>0,cs0.estMv];
  }finally{team.length=0;keep.forEach(x=>team.push(x))}
  return o});
await b.close();
ok(R.edN===264&&!R.ed.length,`育成の編集：264の元の姿の技の欄＝覚える技（違う姿 ${R.ed.length}）`,R.ed.slice(0,5));
ok(R.dexN===346&&!R.dex.length,`図鑑の技の一覧：346の姿＝覚える技（違う姿 ${R.dex.length}）`,R.dex.slice(0,5));
ok(R.det.n===29&&R.det.megaN===12,'みきりを覚える姿：元の姿29・メガ12',R.det);
ok(R.det.both===29,'みきりを覚える29匹すべてで、みきりとまもるが別々に選べる',R.det);
ok(R.det.val==='197'&&/みきり/.test(R.det.shown)&&!/まもる/.test(R.det.shown),'バシャーモのみきりが「みきり」と出る（まもるにならない）',R.det);
ok(R.det.name==='みきり'&&R.det.type==='かくとう'&&R.det.pp>0,'みきりの名前・タイプ（かくとう）・PP',R.det);
ok(R.det.afterProt===182&&R.det.afterDet===197&&R.det.reopen[0]==='197'&&/みきり/.test(R.det.reopen[1]),'保存して開き直してもみきりのまま',R.det);
ok(R.det.calcSid===197&&R.det.back[0]===197,'計算用の型と保存の形の行き来でみきりが残る',R.det);
ok(JSON.stringify(R.det.bothBack.slice(0,2))==='[182,197]','まもるとみきりの両方を登録しても両方残る',R.det.bothBack);
ok(!R.ditto.learn182&&!R.ditto.opts.includes(182),'メタモンはまもるを覚えない・選べない',R.ditto);
ok(R.ditto.bad[0]==='x'&&/覚えません/.test(R.ditto.bad[1]),'覚えない技を保存した型は「覚えません」と出す',R.ditto.bad);
ok(R.uncalc.moves===0&&R.uncalc.uncalc&&R.uncalc.uncalc.length===1&&!R.uncalc.est&&/計算に入っていない攻撃技/.test(R.uncalc.note),'カウンターだけの型を提案の技に置きかえず、計算していないと知らせる',R.uncalc);
ok(R.uncalc.empty[0]&&R.uncalc.empty[1],'技を登録していない型だけ、提案の技（推定）で計算する',R.uncalc.empty);
ok(!errs.length,'ページのエラーなし',errs.slice(0,3));
console.log(`learnset-ui: ${bad?'NG':'OK'}（${n}項目）`);if(bad)process.exitCode=1;
