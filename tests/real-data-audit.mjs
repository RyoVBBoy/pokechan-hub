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
      check(rain.weather?.no===279&&!clear.weather&&rainy.sa===260&&dry.sa===130
        &&rainy.swIn==='unproven'&&rainy.me.acc<100&&rainy.swTxt.includes('1回外れる')&&dry.swIn==='survive',
        'P01 rain changes speed and creates a finishing window that still depends on accuracy',
        {rainSpeed:rainy.sa,clearSpeed:dry.sa,move:rainy.me.mvn,accuracy:rainy.me.acc,rain:rainy.swIn,clear:dry.swIn});
      check(dgSelWhy(weather,rain).good.some(t=>/ペリッパー.*雨/.test(t)),'P01 selection explanation names the weather actually evaluated');

      // Keep Pelipper's rain active as a scenario, then vary only the opponent's ability.
      const waterAttacker=mkMon(byNo[swift.no],'me',mySetFor(swift.no));
      const opponent=ab=>mkMon(byNo[334],'op',{...chooseSet(byNo[334],true),ab});
      const rainState=WX_TEAM;
      let natural,nine,lock,activeBall,suppressedBall,clearBall;
      try{
        WX_TEAM=rain.weather;
        natural=dgMatch(waterAttacker,opponent('natural-cure'));
        nine=dgMatch(waterAttacker,opponent('cloud-nine'));
        lock=dgMatch(waterAttacker,opponent('air-lock'));
        const ball=mvObj(311);
        const getBall=target=>withWx(waterAttacker,target,()=>[
          hitType(waterAttacker,ball,target),varPow(waterAttacker,ball,target,{}),
          bcalc(waterAttacker,ball,target,{r:100}).dmg,
        ]);
        activeBall=getBall(opponent('natural-cure'));
        suppressedBall=getBall(opponent('cloud-nine'));
        WX_TEAM=null;
        clearBall=getBall(opponent('cloud-nine'));
      }finally{WX_TEAM=rainState}
      check(natural.sa===260&&natural.wxTeam&&nine.sa===130&&!nine.wxTeam&&nine.weatherSuppressed
        &&lock.sa===130&&!lock.wxTeam&&lock.weatherSuppressed,'Cloud Nine and Air Lock suppress rain speed and exclude the party weather benefit',
        {rain:natural.sa,cloudNine:nine.sa,airLock:lock.sa});
      check(activeBall[0]==='みず'&&activeBall[1]===100&&suppressedBall[0]==='ノーマル'&&suppressedBall[1]===50
        &&suppressedBall[2]>0&&JSON.stringify(suppressedBall)===JSON.stringify(clearBall),
        'Weather Ball type, power and damage use effective weather',[activeBall,suppressedBall,clearBall]);
      const suppressedRow={...rain.rows[0],r:{...rain.rows[0].r,q:byNo[334]},zs:[nine]};
      const weatherWarning=dgSelWhy(weather,{...rain,rows:[suppressedRow,...rain.rows.slice(1)]}).warn;
      check(nine.why.some(t=>t.includes('天気の効果なし'))&&weatherWarning.some(t=>t.includes('天気の効果が無効')&&t.includes(byNo[334].n)),
        'matchup and selection explain that an opponent can suppress party weather');

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
      const [high,mid,low]=candidates;
      const orders=[[high,mid,low],[high,low,mid],[mid,high,low],[mid,low,high],[low,high,mid],[low,mid,high]];
      check(orders.map(x=>x.sort(dgSelOrder).map(o=>o.c[0]).join()).every(s=>s==='0,1,2'),'P09 close scores have a deterministic ranking for all six input orders');

      team=[member(6,'charizarditey'),...[445,149,143,700,279].map(no=>member(no))];
      // One-hit immunity is useful only if the switch-in can also finish the matchup.
      const switchMon=(no,side,id)=>mkMon(byNo[no],side,{...chooseSet(byNo[no],true),item:null,moves:[mvObj(id)]});
      const normal=switchMon(143,'me',34),ghost=switchMon(94,'op',247);
      const mutual=dgMatch(normal,ghost);
      const crunch=dgMatch(switchMon(143,'me',242),ghost);
      const unknown=dgMatch(switchMon(143,'me',242),{...ghost,uncalc:['計算対象外の攻撃技']});
      const weak={...normal,moves:[{...mvObj(242),pow:1}]};
      const slow=switchMon(94,'op',247);
      slow.moves=[{...mvObj(94),pow:1}];
      const capped=dgMatch(weak,slow);
      check(!mutual.op&&!mutual.me&&mutual.swIn==='unproven'&&dguMatchHTML(mutual,ghost.p.n,normal.p.n).includes('交代後の勝ちは判定保留'),
        'mutual immunity does not count as a switch-in win');
      check(crunch.swIn==='win'&&crunch.me.mv.id===242&&crunch.swTxt.includes(crunch.me.mvn),
        'one-sided immunity with a finishing move is still a switch-in win');
      check(unknown.swIn==='unproven'&&capped.opW===9&&capped.myN===9&&capped.swIn==='unproven',
        'unsupported attacks and both sides beyond the calculation limit leave the switch-in win unproven',
        {unknown:unknown.swIn,opponentTurns:capped.opW,ownTurns:capped.myN});
      // Control HP, speed and damage so only the accuracy changes the recommendation.
      const fastCrunch=acc=>({...normal,st:[...normal.st.slice(0,5),200],moves:[{...mvObj(242),pow:300,acc}]});
      const slowPsychic={...ghost,st:[...ghost.st.slice(0,5),50],moves:[{...mvObj(94),pow:200}]};
      const cannotMiss=dgMatch(fastCrunch(100),slowPsychic);
      const riskyMiss=dgMatch(fastCrunch(85),slowPsychic);
      const withMargin=dgMatch(fastCrunch(85),{...slowPsychic,moves:[{...mvObj(94),pow:90}]});
      check(cannotMiss.myN===1&&cannotMiss.opW===2&&cannotMiss.swIn==='win'
        &&riskyMiss.swIn==='unproven'&&riskyMiss.swTxt.includes('命中85%')&&riskyMiss.swTxt.includes('1回外れる'),
        'a switch-in that loses its finishing window after one miss is not a stable recommendation',
        {accurate:cannotMiss.swIn,risky:riskyMiss.swIn,ownTurns:cannotMiss.myN,oppTurns:cannotMiss.opW});
      check(withMargin.opW>=3&&withMargin.swIn==='win'&&withMargin.swTxt.includes('命中85%'),
        'a switch-in with room for a miss keeps its effective accuracy in the explanation',
        {oppTurns:withMargin.opW,verdict:withMargin.swIn});
      // A stronger ordinary hit on the switch can be followed by a weaker priority hit.
      const finisher=(pri,speed=200)=>({...fastCrunch(100),st:[...normal.st.slice(0,5),speed],moves:[{...mvObj(242),pow:300,pri}]});
      const priorityOpponent=mv=>({...slowPsychic,st:[...slowPsychic.st.slice(0,1),200,...slowPsychic.st.slice(2)],moves:[...slowPsychic.moves,mv]});
      const fastStrike=priorityOpponent({...mvObj(245),pow:110});
      const priorityLoss=dgMatch(finisher(1),fastStrike);
      const equalPriority=dgMatch(finisher(2),fastStrike);
      const tiedPriority=dgMatch(finisher(2,50),fastStrike);
      const firstOnly=dgMatch(finisher(0),priorityOpponent({...mvObj(252),pow:110}));
      check(priorityLoss.opW===2&&priorityLoss.op.mv.id===94&&priorityLoss.swIn==='unproven'&&priorityLoss.swTxt.includes('しんそく'),
        'a weaker higher-priority finisher after the first hit downgrades a switch-in',
        {turns:priorityLoss.opW,openingMove:priorityLoss.op.mv.id,verdict:priorityLoss.swIn,reason:priorityLoss.swTxt});
      check(equalPriority.swIn==='win'&&tiedPriority.swIn!=='win'&&firstOnly.swIn==='win',
        'equal priority follows speed order and a first-turn-only move cannot be used after the opening hit',
        {faster:equalPriority.swIn,tied:tiedPriority.swIn,firstTurnOnly:firstOnly.swIn});
      const koSash=dgMatch(fastCrunch(85),{...slowPsychic,item:'focussash'});
      const koBand=dgMatch(fastCrunch(85),{...slowPsychic,item:'focusband'});
      check(riskyMiss.koOnUse===.85&&koSash.koOnUse===0&&Math.abs(koBand.koOnUse-.765)<1e-10
        &&dguMatchHTML(riskyMiss,slowPsychic.p.n,normal.p.n).includes('1回使って倒せる確率（命中込み）')
        &&dguKoPct(riskyMiss)==='85%','first-use KO odds include accuracy, Focus Sash and Focus Band',
        [riskyMiss.koOnUse,koSash.koOnUse,koBand.koOnUse]);
      const firstTurn={...normal,moves:[mvObj(252)]};
      const firstTurnTarget={...normal,side:'op'};
      const openingKO={...firstTurn,moves:[{...mvObj(252),pow:1000}]};
      check(dgBest(firstTurn,firstTurnTarget)===null&&dgBest(openingKO,firstTurnTarget)?.nMin===1,
        'first-turn-only moves are not treated as repeatedly usable attacks');
      // Force enough damage for a single hit to trigger survival, then vary the hit count.
      const controlled=(id,ab=null)=>({...fastCrunch(100),ab,moves:[{...mvObj(id),pow:1000}]});
      const sashTarget={...normal,side:'op',item:'focussash'};
      const sturdyTarget={...sashTarget,item:null,ab:'sturdy'};
      for(const target of [sashTarget,sturdyTarget]){
        const bomb=dgMatch(controlled(860),target);
        const bond=dgMatch(controlled(34,'parental-bond'),target);
        check(bomb.me.hMin===1&&bomb.me.nMin>=2&&bomb.me.nMax===1&&Math.abs(bomb.koOnUse-.81)<1e-9
          &&dgKoTxt(bomb.me)==='1回で倒せる場合あり'&&dguKoPct(bomb)==='81%',
          'Population Bomb needs its second hit to KO through survival',
          {survival:target.item||target.ab,minTurns:bomb.me.nMin,maxTurns:bomb.me.nMax,probability:bomb.koOnUse});
        check(bond.me.nHit===2&&bond.me.nMin===1&&bond.koOnUse===1,
          'Parental Bond breaks survival and finishes in the same use',{minTurns:bond.me.nMin,probability:bond.koOnUse});
      }
      const disguised=mkMon(byNo[778],'op',{...chooseSet(byNo[778],true),ab:'disguise'});
      const disguiseIntact=dgMatch(controlled(242),disguised);
      const disguiseBroken=dgMatch(controlled(242),{...disguised,disg:false});
      check(disguiseIntact.me.nMin>=2&&disguiseIntact.koOnUse===0&&disguiseBroken.me.nMin===1&&disguiseBroken.koOnUse===1,
        'only an intact Disguise prevents a single-hit KO',{intact:disguiseIntact.me.nMin,broken:disguiseBroken.me.nMin});
      // The same lethal attack can take one use but two turns.
      const weatherBefore=B.weather;
      let solarClear,solarSun,solarSuppressed,electroRain,electroSuppressed,chargedOpponent,hyper;
      const target={...normal,side:'op',ab:null,moves:[]};
      const cloud={...target,ab:'cloud-nine'};
      const solarUser={...controlled(76),st:[...normal.st.slice(0,3),200,normal.st[4],200]};
      try{
        B.weather=null;
        solarClear=dgMatch0(solarUser,target);
        chargedOpponent=dgMatch0(normal,{...controlled(76),side:'op'});
        const beamUser={...ghost,side:'me',moves:[{...mvObj(63),pow:250}]};
        hyper=dgMatch0(beamUser,target);
        B.weather={k:'sun',t:5};
        solarSun=dgMatch0(solarUser,target);
        solarSuppressed=dgMatch0(solarUser,cloud);
        B.weather={k:'rain',t:5};
        electroRain=dgMatch0(controlled(905),target);
        electroSuppressed=dgMatch0(controlled(905),cloud);
      }finally{B.weather=weatherBefore}
      check(solarClear.myN===2&&solarClear.koOnUse===1&&dgKoTxt(solarClear.me)==='技1回・2ターン'
        &&solarClear.t.includes('2ターン')&&hyper.myN===3&&dgKoTxt(hyper.me)==='技2回・3ターン',
        'charge and recharge estimates distinguish damage-dealing uses from elapsed turns',
        {solar:dgKoTxt(solarClear.me),recharge:dgKoTxt(hyper.me),heading:solarClear.t});
      check(solarSun.myN===1&&solarSuppressed.myN===2&&electroRain.myN===1&&electroSuppressed.myN===2,
        'charge is skipped only while the relevant weather has an effect',
        [solarSun.myN,solarSuppressed.myN,electroRain.myN,electroSuppressed.myN]);
      check(chargedOpponent.swIn==='unproven'&&chargedOpponent.swTxt.includes('ためが済んでいるか'),
        'switch-in advice abstains when the opponent charge phase is unknown');
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
      check(flow.switches.slice(0,3).every(x=>x.matchups.every(z=>strategyMid.includes(z.me.mvn))),
        'battle plan gives the move that corroborates each displayed switch-in win');
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
      const assistTeam=team,assistOpps=opp6;
      try{
        team=[member(6),{...member(359),axis:true},member(445),member(149),member(143),member(700)];
        opp6=[248,373,376,1018,911,306];
        const ownNos=team.map(x=>x.no),predicted=oppPredict(ownNos,opp6),assist=asAnalyze(ownNos,opp6,predicted.w);
        check(!assist.none&&assist.full.every(x=>x.c.some(i=>assist.myNos[i]===359))
          &&predicted.lead.every(i=>predicted.top[0].c.includes(i)),
          'opponent-specific assist keeps the axis and predicts the lead within the adjusted lineup');
        const floatingPlan=pipData().find(x=>x.kind==='plan')?.A;
        check(floatingPlan&&floatingPlan.best.join()===assist.best.join()&&floatingPlan.lead.join()===assist.lead.join(),
          'PiP and the opponent-specific screen use the same selection and lead');
        team[1].set.it={k:'charizarditey'};
        check(asAnalyze(ownNos,opp6,predicted.w).none,'opponent-specific assist stops for an invalid axis');
        delete team[1].axis;
        const pruned=asAnalyze(ownNos,opp6,predicted.w);
        check(!pruned.none&&!pruned.myNos.includes(359)&&pruned.best.every(i=>pruned.M[i].p.no===pruned.myNos[i]),
          'selection indices still point to the actual members after excluding an invalid build');
        const synthetic={O:[{p:{n:'相手A'}},{p:{n:'相手B'}}],best:[0],fast:[[false,false]],speedDiff:[[0,-3]],
          D:[[{pct:85,mv:{n:'技A'}},{pct:75,mv:{n:'技B'}}]],R:[[{pct:0}],[{pct:0}]]};
        const reason=asReason(synthetic,0);
        check(reason.includes('相手Aに技A')&&reason.includes('相手Bに技B')&&asSpeedSummary(synthetic,0)==='同速 1匹'
          &&asSpeedSummary(synthetic,1)==='相手の方が速い 1匹',
          'assist reasons keep separate moves and never count same speed as slower');
        const ground=mkMon(byNo[445],'op',{...chooseSet(byNo[445],true),ab:null,moves:[mvObj(89)]});
        const grounded=estHit(ground,mkMon(byNo[376],'me',{...chooseSet(byNo[376],true),ab:null,item:null}));
        const blast=mkMon(byNo[94],'op',{...chooseSet(byNo[94],true),ab:null,item:null,moves:[{...mvObj(247),pow:180}]});
        const lead=mkMon(byNo[65],'me',{...chooseSet(byNo[65],true),ab:null,item:null,moves:[mvObj(94)]});
        const reserve=id=>mkMon(byNo[143],'me',{...chooseSet(byNo[143],true),ab:null,item:null,moves:[mvObj(id)]});
        const forThreat=id=>{
          const M=[lead,reserve(id)];
          return {M,best:[0,1],back:[1],O:[blast],opNos:[94],
            R:[M.map(m=>estHit(blast,m))],D:M.map(m=>[estHit(m,blast)]),speedDiff:[[0],[0]]};
        };
        const safe=forThreat(242),unsafe=forThreat(34);
        const safeNote=asAdvice(safe).find(x=>x.t.includes('交代候補'));
        const unsafeNote=asAdvice(unsafe).find(x=>x.t.includes('後出しに注意'));
        check(grounded.type==='じめん'&&grounded.eff===2&&asThreats(safe)[0].hits[0].r.mv.id===247,
          'threat uses the actual calculated move type, effectiveness and strongest target');
        check(safeNote?.d.includes('カビゴンのかみくだく')&&safeNote.d.includes('フーディンにシャドーボール')
          &&unsafeNote?.d.includes('控えで安定して後出しから倒せる候補は確認できません')&&!asAdvice(unsafe).some(x=>x.t.includes('交代候補')),
          'an immune reserve is offered only when it can finish after switching',
          {safe:safeNote?.d,unsafe:unsafeNote?.d});
        const threeStones=[member(6,'charizarditey'),member(359,'absolite'),member(445,'garchompite'),member(149)];
        team=threeStones;
        const impossible=asAnalyze(team.map(x=>x.no),opp6);
        check(impossible.none&&impossible.megaSkipped>0,
          'opponent-specific assist abstains when every modeled option assumes several Mega Evolutions');
        team=[...threeStones,member(143),member(700)];
        const partial=asAnalyze(team.map(x=>x.no),opp6);
        check(!partial.none&&partial.megaSkipped>0&&partial.full.every(x=>x.c.filter(i=>partial.M[i].p.mega).length<=1),
          'assist keeps evaluated lineups and discloses the untested combinations with several Mega Stone holders');
      }finally{team=assistTeam;opp6=assistOpps}
      const savedAuth=AUTH.user,savedFetch=authFetch;
      try{
        AUTH.user={id:'fixture'};
        const record={my:team.map(x=>x.no),my_sel:[team[0].no],opp:[248],fmt,result:'lose'};
        authFetch=async()=>({battles:[
          ...Array(4).fill(record),
          ...Array(5).fill({...record,fmt:fmt==='single'?'double':'single'}),
          ...Array(5).fill({...record,my:[445]}),
          ...Array(5).fill({...record,result:'unknown'})
        ]});
        const scarce=await loseFromRecords(team,fmt);
        check(scarce.count===4&&!scarce.rec,'P12 battle history from other formats and parties does not lift the minimum sample size');
        const picked=team[1].no,pickedName=formInfo(byNo[picked]).base;
        const used=[[team[0].no,picked,picked],[team[2].no,picked],[team[3].no,picked],[team[4].no],[team[5].no]];
        authFetch=async()=>({battles:used.map(my_sel=>({...record,my_sel,opp:[248,248]}))});
        const history=await loseFromRecords(team,fmt);
        check(history.count===5&&history.some(x=>x.t.includes(pickedName+'を出した試合')&&x.t.includes('3戦'))
          &&history.some(x=>x.t.includes('相手の6匹に')&&x.t.includes('5戦'))
          &&history.every(x=>!x.t.includes('を先発にした')),
          'records count later appearances once per match and never infer the lead from appearance order');

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
