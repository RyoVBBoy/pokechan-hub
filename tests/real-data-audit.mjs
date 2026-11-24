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
  const r=await pg.evaluate(async ({fmt,mode})=>{
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

    // Phase one acceptance cases run through the shipped calculation and display code.
    const saved={rank:META.rank,top:TOPT.st,team,render:teamRender,confirm:askConfirm,slot:TEAMS.cur,slots:TEAMS.list,updated:TEAMS.updated,teamSignatures:TEAM_SIG,localSlots:localStorage.getItem('pcteams'),localTeam:localStorage.getItem('pcteam')};
    const fixture=document.createElement('div');
    fixture.innerHTML='<div id="st-box"></div><div id="dg-box"></div><div id="dgu-sum"></div><div class="stg-nm-b"></div><div class="test-imp"></div>';
    document.body.appendChild(fixture);
    const member=(no,it=null)=>({no,set:{...setToSaved(byNo[no],chooseSet(byNo[no],true)),it:it?{k:it}:null}});
    try{
      META.rank=[];TOPT.st='idle';
      team=[member(6,'charizarditey'),...([445,149,143,700,279].map(no=>member(no)))];
      const base=dgTeam(team,20),opponents=base.rows.map(r=>r.from);
      const noMega=dgTeam0(team,opponents.length,{noMega:true,opponents});
      stNoMegaFill(team,base,fixture);
      check(base.rows.length===18&&noMega.rows.length===18&&noMega.rows.every((r,i)=>r.from===opponents[i])&&/同じ相手18匹/.test(fixture.querySelector('.stg-nm-b').textContent),'P05 Mega comparison uses the same 18 opponents in the same order');
      stFill(team);dgFill(team);
      dguSumFill(team,{fix:[]});
      const selection=dgSelect(team);
      const html=[fixture.querySelector('#st-box').textContent,fixture.querySelector('#dg-box').textContent,fixture.querySelector('#dgu-sum').textContent,dgSelHTML(selection,team)];
      check(html.every(t=>t.includes('種族値などから選んだ相手')&&!t.includes('使用率の上位')),'P06 fallback source is displayed in strategy, matchup, summary and selection');
      check(base.opponentSource==='種族値などから選んだ相手','P06 fallback provenance comes from the opponent data');
      team[1]={...member(445,'charizarditey'),axis:true};
      stFill(team);
      const blocked=fixture.querySelector('#st-box'),plan=document.createElement('div');
      plan.innerHTML=planHTML(team);
      check(!dgSelect(team)&&!blocked.querySelector('[data-stg-sel]')&&/軸のガブリアスは計算できません/.test(blocked.textContent)&&/軸のガブリアスは計算できません/.test(plan.querySelector('[data-psub-p="sel"]').textContent),'P08 invalid axis blocks both selection entry points and explains why');
      delete team[1].axis;
      const eligible=dgSelect(team);
      check(eligible?.list.length===(fmt==='single'?10:5)&&eligible.excluded===1&&eligible.list.every(x=>!x.c.includes(1)),'P08 invalid non-axis slot is excluded without blocking legal combinations');
      team[1]=member(445);
      teamRender=()=>{};
      const panel=fixture.querySelector('.test-imp');
      const proposal={kind:'swap',i:0,title:'リザードン → コータス',entries:[member(324),...team.slice(1)],J:{b:{},a:{}}};
      const renderPlan=o=>impRender(panel,{list:[o],tried:1});
      let resolve;
      askConfirm=()=>new Promise(r=>{resolve=r});
      renderPlan(proposal);
      const pending=panel.querySelector('[data-imp]').onclick();
      const external=JSON.parse(JSON.stringify(TEAMS));
      external.list[saved.slot].team=[member(248),...team.slice(1)];
      teamsFromStore(JSON.stringify(external));
      resolve(true);await pending;
      check(team[0].no===248,'P10 confirmation cannot overwrite a party edited while the dialog is open');
      renderPlan(proposal);
      const queued=panel.querySelector('[data-imp]').onclick();
      external.list[saved.slot].team[0]=member(334);
      localStorage.setItem('pcteams',JSON.stringify(external));
      resolve(true);await queued;
      check(team[0].no===248&&JSON.parse(localStorage.getItem('pcteams')).list[saved.slot].team[0].no===334,'P10 saved edits are detected before their storage event is delivered');
      teamsFromStore(localStorage.getItem('pcteams'));
      renderPlan({kind:'sel',title:'選出',selFix:[0,1,2,3].slice(0,PICK()),J:{b:{},a:{}}});
      TEAMS.cur=(saved.slot+1)%TEAMS.list.length;
      await panel.querySelector('[data-imp]').onclick();
      check(team.every(x=>!x.sel),'P10 selection button cannot apply to a different slot with identical contents');
      TEAMS.cur=saved.slot;
      askConfirm=async()=>true;
      renderPlan(proposal);
      await panel.querySelector('[data-imp]').onclick();
      check(team[0].no===324,'P10 current improvement remains applicable');

      // Phase two acceptance cases use the original audited inputs and visible outputs.
      const withAbility=(no,k)=>{const x=member(no);x.set.ab={k};return x};
      const swift=P.find(p=>/イダイトウ/.test(p.n)&&(ABD[p.no]||[]).some(([ab])=>ab==='swift-swim'));
      team=[withAbility(324,'drought'),withAbility(279,'drizzle'),withAbility(swift.no,'swift-swim'),...[445,143,700].map(no=>member(no))];
      const weather=dgSelect(team);
      const rain=weather.list.find(x=>x.c.includes(1)&&x.c.includes(2)&&!x.c.includes(0));
      const clear=weather.list.find(x=>x.c.includes(2)&&!x.c.includes(0)&&!x.c.includes(1));
      const salamence=x=>x.rows.find(y=>y.r.q.no===373).zs.find(z=>z.i===2);
      const rainy=salamence(rain),dry=salamence(clear);
      check(rain.weather?.no===279&&!clear.weather&&rainy.sa===260&&dry.sa===130&&rainy.swIn==='win'&&dry.swIn!=='win','P01 selected Pelipper and no-setter matchups use the correct conditions',[rainy.sa,dry.sa,rainy.swIn,dry.swIn]);
      check(dgSelWhy(weather,rain).good.some(t=>/ペリッパー.*雨/.test(t)),'P01 selection explanation names the weather actually evaluated');

      const slowTeam=physical=>[981,324,143,450,534,306].map((no,i)=>{
        const x=member(no),phys=physical&&x.no!==981&&byNo[no].s[1]>=byNo[no].s[3];
        x.set.sp=phys?[32,32,0,0,2,0]:[32,0,0,32,2,0];
        x.set.up=physical&&byNo[no].s[3]<=byNo[no].s[1]?1:3;
        x.set.dn=5;
        if(!i)x.set.mv=[{id,n:mName(id)},...x.set.mv].slice(0,4);
        return x;
      });
      team=slowTeam(false);
      const tr=dgTeam(team,20),arch=tr.rows.find(r=>r.q.n==='ブリジュラス');
      check(tr.tr.on&&arch?.o.ab==='sturdy'&&arch.oTR?.ab==='stamina'&&arch.lvlTR===3,'P02 Trick Room switches Archaludon from Sturdy to Stamina and rates it circle',{ordinary:arch?.o.ab,active:arch?.oTR?.ab,level:arch?.lvlTR});
      const plainStart=fmt==='single'?11:0,opt=[...rows.rows.filter(r=>!r.stone&&mvpLegal(r.no).st==='ok')].slice(plainStart);
      team=[];const usedItems=new Set();
      for(const r of opt){
        if(team.some(x=>tbFam(x.no)===tbFam(r.no)))continue;
        const s=mvpSet(fmt,r.no,{anyMv:true,used:usedItems});if(s.st!=='ok')continue;
        if(s.sv.it)usedItems.add(s.sv.it.k);
        team.push({no:r.no,set:s.sv});
        if(team.length===6)break;
      }
      const selected=dgSelect(team),wanted=fmt==='single'?[1,4,5]:[1,2,3,5];
      const line=selected.list.find(x=>x.c.join()===wanted.join()).rows.find(y=>y.r.q.n==='ブリジュラス');
      check(line.lvl===(fmt==='single'?1:2)&&line.r.o.ab===(fmt==='single'?'sturdy':'stamina'),'P02 Archaludon is evaluated for members in the actual selection',{actual:line.lvl,ab:line.r.o.ab});

      team=[6,445,143,700,324,279].map(no=>member(no));
      const original=LIVE.csv[149];
      try{
        LIVE.csv[149]=digest('category,name,percentage\nmove,Dragon Claw,100');
        LIVE.csv[149].mv=chooseSet(byNo[149],true).moves.filter(x=>!x.prot).map(m=>[m.n,100]);
        const dn=dgTeam(team,20).rows.find(r=>r.from.no===149);
        const fromDefault=dn.variants.find(v=>v.o.ab==='inner-focus');
        check(dn.live&&dn.abAssume?.ab==='multiscale'&&dgLevel(fromDefault.rs)===4&&dn.lvl===2,'P03 move-only usage data still tests Dragonite abilities');
      }finally{if(original===undefined)delete LIVE.csv[149];else LIVE.csv[149]=original}

      team=slowTeam(true);
      const improvements=dgImprove(team);
      const title='ローブシンの技：ばかぢから → はやてがえし';
      const refused=improvements.dropped.find(x=>x.title===title);
      impRender(panel,improvements);
      check(!improvements.list.some(x=>x.title===title)&&/通常時 \+4\.8点／トリックルーム中 -2\.0点/.test(refused?.loss)&&/セグレイブ/.test(refused?.loss)&&panel.textContent.includes(refused?.loss),'P04 Trick Room regression is rejected and the normal and active scores are shown',refused);
      check(improvements.list.filter(x=>x.T1).every(x=>x.J.tr&&x.J.tr.gain>=0&&!x.J.tr.loss),'P04 recommended changes preserve Trick Room and show both scenarios');

      const candidates=[1.00150,1.00075,1.00000].map((sc,i)=>({sc,c:[i],cnt:{1:3-i,3:0,4:0},danger:[],sw:0,fast:0}));
      const [A,B,C]=candidates;
      const orders=[[A,B,C],[A,C,B],[B,A,C],[B,C,A],[C,A,B],[C,B,A]];
      check(orders.map(x=>x.sort(dgSelOrder).map(o=>o.c[0]).join()).every(s=>s==='0,1,2'),'P09 close scores have a deterministic ranking for all six input orders');

      team=[member(6,'charizarditey'),...[445,149,143,700,279].map(no=>member(no))];
      const view=selPlan(team),lineups=view.DS.list;
      const unsafeLine=lineups.find(x=>x.c.includes(3)&&!x.leads.slice(0,LEADN()).includes(3)&&x.rows.find(r=>r.r.q.no===248)?.zs.some(z=>z.i===3&&z.swIn==='no'));
      const unsafeFlow=stSelectionFlow({...view,DS:{...view.DS,best:unsafeLine},lead:unsafeLine.leads.slice(0,LEADN())},team);
      check(unsafeLine&&unsafeFlow.switches.every(x=>x.opponent.no!==248||!x.choices.includes(3)),'P07 Snorlax cannot be suggested as a switch into Tyranitar in the known KO matchup');
      const flow=stSelectionFlow(view,team);
      const evidence=view.DS.best.rows.flatMap(row=>{
        if(row.zs.some(z=>view.lead.includes(z.i)&&z.r>=4))return [];
        const choices=row.zs.filter(z=>!view.lead.includes(z.i)&&z.swIn==='win').map(z=>z.i);
        return choices.length?[[row.r.q.no,choices]]:[];
      });
      check(JSON.stringify(flow.switches.map(x=>[x.opponent.no,x.choices]))===JSON.stringify(evidence)
        &&(evidence.length>0||/見つかりません|先発候補のいずれか/.test(flow.steps[1][1])),'P07 every switch follows the matchup evidence and empty cases explain their status',evidence.length);
      stFill(team);plan.innerHTML=planHTML(team);
      const strategy=fixture.querySelector('#st-box');
      const strategyMid=strategy.querySelector('.stg-flow li:nth-child(2) p')?.textContent;
      const planMid=plan.querySelector('.pc-story li:nth-child(2)')?.textContent;
      check(strategyMid===flow.steps[1][1]&&planMid.endsWith(strategyMid)&&view.lead.every(i=>strategy.querySelector('.stg-sel').textContent.includes(byNo[team[i].no].n)),'P11 strategy and detailed selection show the same evidence and leads');
      const selectionMega=view.DS.best.megaI>=0?view.DS.megaNm(view.DS.best.megaI):'メガシンカなし';
      check(strategy.querySelector('.stg-flow li:first-child').textContent.includes(selectionMega)
        &&plan.querySelector('.pc-story li:first-child').textContent.includes(selectionMega),'P11 both battle plans label the Mega assumption of the actual selection');
      check(view.situ.every(s=>view.DS.list.some(x=>x.c.includes(s.in)&&!x.c.includes(s.out)&&x.c.every(i=>i===s.in||view.base.includes(i))&&s.opps.every(q=>x.rows.some((r,i)=>r.r.q.no===q.no&&r.lvl>=3&&view.DS.best.rows[i].lvl<=2)))),'P11 alternate selections are checked on the same opponents and actual field assumptions');
      const notes=partyCheck(team);
      notes.fix.filter(x=>x.k==='calc').forEach((x,i)=>x.id='pcw'+i);
      dguSumFill(team,notes);
      const priority=fixture.querySelector('.dgu-weak a');
      check(!!priority&&priority.dataset.dguGo==='pcw0'&&priority.querySelector('.dgu-wt').innerHTML===notes.fix.find(x=>x.k==='calc').t,'P11 priority summary and detailed card use the same issue and anchor');
      // The party evaluator passes one opponent to the damage engine, even in doubles.
      // Contrast that with the calculator's explicit multiple-target setting.
      const attacker=mkMon(byNo[445],'me',dgCalcSet({x:team[1],p:byNo[445]}));
      const defender=mkMon(byNo[143],'op',dgCalcSet({x:team[3],p:byNo[143]}));
      const targetDamage=(id,spread)=>bhits(attacker,mvObj(id),defender,{r:100,spread}).total;
      const eq=mvObj(89),singleTarget=707;
      const one=targetDamage(89,false),many=targetDamage(89,true);
      check(one>many&&many>0&&Math.round(dgMove(attacker,eq,defender).fmax*defender.max/100)===one
        &&targetDamage(singleTarget,false)>0&&targetDamage(singleTarget,false)===targetDamage(singleTarget,true),'Earthquake in party diagnosis uses one target; spread reduction applies only to spread moves',{one,many});
      dgFill(team);
      const summary=fixture.querySelector('#dgu-sum');
      const rendered=[strategy.textContent,plan.textContent,summary.textContent,fixture.querySelector('#dg-box').textContent,panel.textContent];
      check(rendered.every(copy=>copy.includes(DG_DOUBLE_LIMITS)===(FMT==='double')),'all five party result views disclose the double-battle assumptions only in doubles');
      dguSumFill(team,{diagnosis:{...notes.diagnosis,unk:[],formErr:[],mySet:team.map(()=>true),liveAll:true},analysis:{bad:[]},fix:[]});
      const statusLabels=[...summary.querySelectorAll('.dgu-area .dgu-sev')];
      check(statusLabels.length===4&&statusLabels.every(x=>x.textContent.includes(FMT==='double'?'判定は暫定':'問題なし')),'doubles remain provisional even with complete build and opponent data');
      team.forEach((x,i)=>x.sel=view.base.includes(i));
      const chosenScope=partyCheck(team);
      dguSumFill(team,chosenScope);
      const scopeCounts=[...fixture.querySelectorAll('#dgu-sum .dgu-bn b')].reduce((n,x)=>n+parseInt(x.textContent,10),0);
      check(chosenScope.diagnosis.ms.length===PICK()&&scopeCounts===chosenScope.diagnosis.rows.length
        &&fixture.querySelector('#dgu-sum').textContent.includes(chosenScope.scope),'P11 priority counts and scope use the selected party when a selection is set');
      team.forEach(x=>delete x.sel);

      const memoKey=mpKey(),savedMemo=MEMO.party[memoKey],memoStorage=localStorage.getItem('pcmemo');
      const own={tp:'rain,scr',arch:'保存済みテスト',style:'自分で書いた戦い方',str:'自分で書いた強み',plan:'自分で書いた流れ'};
      try{
        stSaveOwn(own);
        const state=JSON.stringify(stOwn());
        stFill(team);
        team[0]={...team[0],set:{...team[0].set,it:null}};
        stFill(team);
        stEdit(strategy);
        check(JSON.stringify(stOwn())===state&&strategy.querySelector('#stg-style').value===own.style&&strategy.querySelector('#stg-str').value===own.str,'P13 saved strategy, strengths, battle plan and style survive recalculation and opening the editor');
        stFill(team);
        META.rank=Array.from({length:20},(_,i)=>({no:team[i%team.length].no}));
        dguSumFill(team,partyCheck(team));stFill(team);
        check(!dgSelect(team)&&/判定を保留/.test(fixture.querySelector('#dgu-sum').textContent)&&/判定を保留/.test(strategy.textContent)&&strategy.querySelector('.stg-own')?.textContent.includes(own.style),'P12 no eligible opponents results in a pending diagnosis and keeps the saved strategy');
        META.rank=[];
      }finally{
        if(savedMemo===undefined)delete MEMO.party[memoKey];else MEMO.party[memoKey]=savedMemo;
        if(memoStorage===null)localStorage.removeItem('pcmemo');else localStorage.setItem('pcmemo',memoStorage);
      }
      const savedAuth=AUTH.user,savedFetch=authFetch;
      try{
        AUTH.user={id:'fixture'};
        const record={my:team.map(x=>x.no),my_sel:[team[0].no],opp:[248],fmt,result:'lose'};
        authFetch=async()=>({battles:[
          ...Array(4).fill(record),
          ...Array(5).fill({...record,fmt:fmt==='single'?'double':'single'}),
          ...Array(5).fill({...record,my:[445]})
        ]});
        const scarce=await loseFromRecords(team,fmt);
        check(scarce.count===4&&!scarce.rec,'P12 battle history from other formats and parties does not lift the minimum sample size');
        authFetch=async()=>({battles:Array(5).fill(record)});
        fixture.insertAdjacentHTML('beforeend',loseHTML());
        await loseFill(team);
        const lost=fixture.querySelector('#lose-box').textContent;
        check(/同じ形式・同じパーティの5試合/.test(lost)&&/対戦記録/.test(lost),'P12 battle history cards show their matching sample count and provenance');
      }finally{AUTH.user=savedAuth;authFetch=savedFetch}
    }finally{
      fixture.remove();META.rank=saved.rank;TOPT.st=saved.top;team=saved.team;
      teamRender=saved.render;askConfirm=saved.confirm;TEAMS.cur=saved.slot;
      TEAMS.list=saved.slots;TEAMS.updated=saved.updated;TEAM_SIG=saved.teamSignatures;
      for(const [key,value] of [['pcteams',saved.localSlots],['pcteam',saved.localTeam]]){
        if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);
      }
    }
   }
   return {checks,results};
  },{fmt,mode});
  report.checks.push(...r.checks.map(x=>({fmt,...x})));report.results.push(...r.results.map(x=>({fmt,...x})));
  if(mode==='integration')for(const width of [390,1280]){
    await pg.setViewportSize({width,height:844});
    const layout=await pg.evaluate(()=>{
      team=[6,445,149,143,700,279].map(no=>({no,set:setToSaved(byNo[no],chooseSet(byNo[no],true))}));
      const slot=document.createElement('div');slot.id='st-box';slot.className='stg-card';
      document.body.append(slot);
      try{
        stFill(team);
        const d=slot.querySelector('.stg-flow');
        return !!d&&[...d.querySelectorAll('li')].every(x=>x.getBoundingClientRect().right<=innerWidth+1)
          &&d.scrollWidth<=d.clientWidth+1;
      }finally{slot.remove()}
    });
    report.checks.push({fmt,pass:layout,label:'P13 strategy flow fits '+width+'px width'});
  }
  await pg.close();
 }
}catch(e){report.errors.push({error:String(e),stack:e.stack})}finally{await b.close();writeFileSync('audit-'+mode+'.json',JSON.stringify(report,null,2));}
const failures=report.checks.filter(x=>!x.pass);console.log(JSON.stringify({mode,checks:report.checks.length,failures,errors:report.errors,timings:report.results.filter(x=>x.ms!=null)},null,2));if(!report.checks.length||failures.length||report.errors.length)process.exitCode=1;
