// Real bundled data, offline Chromium; no production writes.
// Modes: integration, legality, performance. Each writes evidence before exiting.
import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const mode=process.argv[2];
if(!['integration','legality','performance'].includes(mode))throw Error('Specify audit mode');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const report={mode,sha:process.env.GITHUB_SHA||null,checks:[],errors:[],results:[]};
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
try{
 for(const fmt of ['single','double']){
  const pg=await b.newPage({viewport:{width:390,height:844},locale:'ja-JP'});
  pg.on('pageerror',e=>report.errors.push({fmt,error:e.message}));
  await pg.route(/^https?:/,r=>r.abort());
  await pg.goto(pathToFileURL(path.join(root,'dist/index.html')).href+'#/'); 
  await pg.waitForFunction(()=>typeof tbProps==='function'&&typeof mvpRows==='function');
  if(mode==='performance'){const c=await pg.context().newCDPSession(pg);await c.send('Emulation.setCPUThrottlingRate',{rate:4});}
  const r=await pg.evaluate(({fmt,mode})=>{
   FMT=fmt;
   const checks=[],results=[],check=(ok,label,detail)=>checks.push({pass:!!ok,label,detail});
   const timed=(label,fn)=>{const t=performance.now();try{const value=fn();results.push({label,ms:performance.now()-t});return value}catch(e){checks.push({pass:false,label,detail:String(e)});return null}};
   const rows=mvpRows(fmt);check(rows&&rows.rows.length>0,'real dataset present',rows?.rows.length);
   if(!rows)return {checks,results};
   const legal=(no,s,expectedStone=null,allowMissing=false)=>{
    const p=byNo[no],bad=[],unknown=[];if(!p)return {bad:['unknown species'],unknown};
    const lg=mvpLegal(no);if(lg.st==='illegal')bad.push('illegal species');else if(lg.st!=='ok')unknown.push('species '+lg.st);
    if(!s){(allowMissing?unknown:bad).push('missing build');return {bad,unknown}}
    const it=s.it?.k,mg=it&&isStone(it)?megaOf(no,it):null;
    if(expectedStone&&it!==expectedStone)bad.push('missing expected Mega Stone');
    if(it&&isStone(it)&&!mg)bad.push('wrong Mega Stone');
    if(mg&&mvpStoneSt(it,no)!=='ok')unknown.push('Mega regulation unverified');
    if(it&&!isStone(it)){if(!CH_ITEMS.has(it))bad.push('unknown item');else unknown.push('item regulation unverified')}
    const abs=(ABD[no]||[]).map(x=>x[0]);if(mg)abs.push(mg.ab);
    if(s.ab?.k&&!abs.includes(s.ab.k))bad.push('ability '+s.ab.k);
    if(!s.ab?.k)unknown.push('ability unspecified');
    const ids=(s.mv||[]).map(x=>x?.id),ls=(LSD[no]||[0,[]])[1];
    if(ids.length>4||new Set(ids).size!==ids.length||ids.some(i=>!MD[i]||!ls.includes(i)))bad.push('moves '+ids.join(','));
    if(!ids.length)unknown.push('moves unspecified');
    if(s.sp!=null&&(!Array.isArray(s.sp)||s.sp.length!==6||s.sp.some(v=>!Number.isInteger(v)||v<0||v>32)||s.sp.reduce((a,b)=>a+b,0)>66))bad.push('stat points');
    if(s.sp==null)unknown.push('stat points unspecified');
    const u=s.up,d=s.dn;if(!((u===-1&&d===-1)||(Number.isInteger(u)&&Number.isInteger(d)&&u>=1&&u<=5&&d>=1&&d<=5)))bad.push('nature '+u+'/'+d);
    return {bad,unknown};
   };
   const auditTeam=(label,mem)=>{check(Array.isArray(mem)&&mem.length===6,label+' six members',mem?.length);if(!mem)return;const items=mem.map(x=>x.set?.it?.k).filter(Boolean);check(new Set(items).size===items.length,label+' unique items',items);check(new Set(mem.map(x=>tbFam(x.no))).size===mem.length,label+' unique families');for(const x of mem){const v=legal(x.no,x.set,null,true);check(!v.bad.length,label+' '+byNo[x.no]?.n,v);results.push({label,no:x.no,...v})}};
   const pool=rows.rows.filter(r=>!r.stone&&mvpLegal(r.no).st==='ok').map(r=>mvpSet(fmt,r.no,{anyMv:true})).filter(x=>x.st==='ok');
   if(mode==='legality'){
    for(const row of rows.rows){const s=mvpSet(fmt,row.no,{stone:row.stone,anyMv:true});const v=s.st==='ok'?legal(row.no,s.sv,row.stone):{bad:[],unknown:[s.st+': '+s.why]};results.push({no:row.no,name:byNo[row.no]?.n,stone:row.stone,status:s.st,...v});check(!v.bad.length,'mvpSet '+row.id,v)}
    results.push({unmapped:rows.unmapped});check(results.some(x=>x.status==='ok'),'nonempty generated sets');
    /* 2026-11-24: construction A/B with Mega conditions (the earlier audit only used mega='none').
       Every start that has a verified Mega Stone row is built with mega='must:<start>' and 'auto'. */
    const starts=[...new Set(rows.rows.filter(r=>r.stone&&mvpStoneSt(r.stone,r.no)==='ok'&&mvpLegal(r.no).st==='ok').map(r=>r.no))].slice(0,6);
    check(starts.length>0,'verified Mega starts available',starts.length);
    for(const no of starts){for(const mode of ['must','auto']){
      TB=tbNew(no);TB.cond.mega=mode==='must'?'must:'+no:'auto';let P=null;try{P=tbProps()}catch(e){check(false,'tbProps '+mode+' '+no,String(e));continue}
      for(const k of ['A','B']){const X=P[k];auditTeam(k+' '+mode+' '+byNo[no].n,X.mem);
        const st=X.mem.find(x=>x.no===no);
        if(mode==='must')check(st&&st.set&&st.set.it&&megaOf(no,st.set.it.k),k+' '+mode+' start holds its matching Mega Stone',st&&st.set&&st.set.it);
        for(const x of X.mem){const it=x.set&&x.set.it&&x.set.it.k,ab=x.set&&x.set.ab&&x.set.ab.k;
          const megaAb=Object.keys(MEGA).some(s=>{const m=megaOf(x.no,s);return m&&m.ab===ab})&&!(ABD[x.no]||[]).some(z=>z[0]===ab);
          check(!megaAb||(it&&megaOf(x.no,it)&&megaOf(x.no,it).ab===ab),k+' '+mode+' Mega ability only with matching stone '+byNo[x.no].n,{it,ab})}
        check(X.req.every(q=>q.ok),k+' '+mode+' required conditions '+byNo[no].n,X.req.filter(q=>!q.ok));
        check(X.E.st==='ok',k+' '+mode+' evaluated '+byNo[no].n,X.E.st)}}}
   }
   check(pool.length>=6,'six real registered sets available',pool.length);
   if(pool.length<6)return {checks,results};
   const used=new Set(),entries=[];for(const p of pool){if(entries.some(x=>tbFam(x.no)===tbFam(p.no)))continue;const s=mvpSet(fmt,p.no,{anyMv:true,used});if(s.st!=='ok')continue;if(s.sv.it)used.add(s.sv.it.k);entries.push({no:p.no,set:s.sv,axis:entries.length===0});if(entries.length===6)break}
   check(entries.length===6,'six distinct sets with unique items');
   if(entries.length!==6)return {checks,results};
   team.length=0;team.push(...entries);dgMegaSet(0);
   const run=()=>{const D=timed('diagnosis',()=>dgTeam0(team,20));if(D){check(D.rows.length>0,'diagnosis nonempty');timed('diagnosis analysis',()=>dgAnalyze(D));}
    DG_SELC.clear();const S=timed('selection',()=>dgSelect(team));check(S&&S.best&&S.list.length>0,'selection nonempty');
    if(S)check(S.list.every(x=>x.c.includes(0)&&Object.values(x.cnt).reduce((a,b)=>a+b,0)===S.N),'selection axis and count totals');
    TB=tbNew(entries[0].no);TB.cond.mega='none';const P=timed('construction A/B',()=>tbProps());
    if(P)for(const k of ['A','B']){auditTeam(k,P[k].mem);check(P[k].req.every(q=>q.ok),k+' required conditions',P[k].req);check(P[k].E.st==='ok',k+' evaluated',P[k].E.st)}
    const I=timed('improvements',()=>dgImprove(team));check(I&&Array.isArray(I.list)&&I.T0?.rows.length>0,'improvement evaluation completed',I?.list.length);
    if(I)for(const [i,o] of I.list.entries()){auditTeam('improvement '+i,o.entries);check(o.entries?.[0]?.no===entries[0].no,'improvement retains axis');}
   };
   run();
   if(mode==='performance'){run();run();results.push({cpuThrottle:4,viewport:'390x844',note:'three runs; simulated CPU, not device benchmark; no approved SLA'})}
   if(mode==='integration'){
    const mega=rows.rows.filter(r=>r.stone).map(r=>mvpSet(fmt,r.no,{stone:r.stone,anyMv:true})).filter(s=>s.st==='ok'&&s.sv.it?.k===s.stone);
    const a=mega[0],z=mega.find(s=>a&&tbFam(s.no)!==tbFam(a.no)&&s.stone!==a.stone);
    check(a&&z,'two actual Mega builds available');
    if(a&&z){const es=[{no:a.no,set:a.sv},{no:z.no,set:z.sv},...entries.filter(x=>![tbFam(a.no),tbFam(z.no)].includes(tbFam(x.no)))].slice(0,6).map(x=>({...x,axis:false}));team.length=0;team.push(...es);DG_SELC.clear();const S=timed('two Mega selection',()=>dgSelect(team));check(S?.list.some(x=>x.c.includes(0)&&x.c.includes(1)),'both Mega holders selectable');check(S?.list.some(x=>!x.c.includes(0)&&x.c.includes(1)&&x.megaI===1),'second holder evaluated as Mega');
      /* 2026-11-24: one Mega per scenario; a selection with both holders evaluates each holder separately with the other in normal form */
      const both=S?.list.find(x=>x.c.includes(0)&&x.c.includes(1));
      check(both&&both.megaI>=0&&both.megaHold?.length===2&&both.megaAlt?.length===1,'two-holder selection records chosen Mega and the alternative',both&&{megaI:both.megaI,alt:both.megaAlt});
      if(both){const T1=dgTeam0(team,20,{megaNo:es[both.megaI].no});check(T1.mega.i===both.megaI&&T1.M.filter((m,i)=>m&&i!==both.megaI&&es[i].set?.it&&isStone(es[i].set.it.k)).every(m=>!m.p.mega&&!m.item),'non-evolving holder uses normal form without stone',null)}
      check(S?.list.every(x=>x.rows.length===S.N),'same opponent population for every selection',null);
      const I2=timed('two Mega improvements',()=>dgImprove(team));check(I2&&Array.isArray(I2.list),'two Mega improvements computed');
      if(I2)for(const [i,o] of I2.list.entries()){auditTeam('two Mega improvement '+i,o.entries);
        const F=dgTeam(o.entries,20);
        check(JSON.stringify(dgMetric(F))===JSON.stringify(dgMetric(o.T1))&&F.mega.no===o.T1.mega.no,'improvement '+i+' after-values equal full recomputation',{shown:dgMetric(o.T1),full:dgMetric(F)});
        check(JSON.stringify(impMetric(I2.T0,o.J.D.keep))===JSON.stringify(o.J.b)&&JSON.stringify(impMetric(F,o.J.D.keep))===JSON.stringify(o.J.a),'improvement '+i+' displayed before/after match evaluated builds')}}
    const id=+Object.keys(MD).find(i=>MD[i][3]==='trickroom');
    const slow=pool.filter(s=>byNo[s.no].s[5]<=70);const setter=slow.find(s=>(LSD[s.no]||[0,[]])[1].includes(id));
    check(setter&&slow.length>=6,'real slow Trick Room fixture');
    if(setter&&slow.length>=6){const base=[setter,...slow.filter(s=>s.no!==setter.no)].slice(0,6).map(s=>({no:s.no,set:{...s.sv,it:null,mv:s.sv.mv.filter(m=>m.id!==id)}}));team.length=0;team.push(...base);const D=dgTeam0(team,20);const after=base.map((x,i)=>i?x:{...x,set:{...x.set,mv:[{id,n:mName(id)},...x.set.mv].slice(0,4)}});const R=timed('Trick Room change',()=>impRecalc(after));const F=dgTeam(after,20);check(R&&JSON.stringify(R.tr)===JSON.stringify(F.tr)&&JSON.stringify(dgMetric(R))===JSON.stringify(dgMetric(F)),'Trick Room change equals full recomputation');DG_SELC.clear();const no=dgSelect(team);check(no&&!no.list.some(x=>x.trUse),'unregistered Trick Room not used');}
   }
   return {checks,results};
  },{fmt,mode});
  report.checks.push(...r.checks.map(x=>({fmt,...x})));report.results.push(...r.results.map(x=>({fmt,...x})));await pg.close();
 }
}catch(e){report.errors.push({error:String(e),stack:e.stack})}finally{await b.close();writeFileSync('audit-'+mode+'.json',JSON.stringify(report,null,2));}
const failures=report.checks.filter(x=>!x.pass);console.log(JSON.stringify({mode,checks:report.checks.length,failures,errors:report.errors,timings:report.results.filter(x=>x.ms!=null)},null,2));if(!report.checks.length||failures.length||report.errors.length)process.exitCode=1;
