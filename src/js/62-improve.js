/* ===================== 第6段階：改善案（2026/11/10 依頼主「パーティ診断エンジン強化」） =====================
   入れかえ・技・能力ポイント・性格・持ち物・役割（型）・選出の変え方を、変更後のパーティで dgTeam と同じ計算をし直して比べる。
   ・比べる数：× の相手・△以下・後出しして勝てる匹がいない相手・半分以上を一撃で倒される相手・だれも先に動けない相手・◎
   ・大事な役目を失わせない：変更前に ◎○ だった相手が △以下に落ちる案、× が増える案は出さない
   ・良くなる相手と悪くなる相手（◎→○など、落ちても○以上のもの）を名前と計算で出す
   ・育成の変更は、変えた1匹の分だけ計算し直す（天気・トリックルームの形が変わるときは全部を計算し直す）
   ・ゲームにある持ち物（CH_ITEMS）・覚える技・持てる特性だけを使う。メガストーンは変えない（メガシンカの形が変わるため） */
const IMP_W={x:3,w:1.5,nosw:1,ohko:1,slow:.7,st:.3};
/* 1対1の計算では正しく扱えない技は候補にしない：受けると失敗・ためる・反動で動けない・自分が倒れる・前のターンしだい・最後にしか出せない 等 */
const IMP_NOMV=new Set(['focuspunch','solarbeam','solarblade','skyattack','meteorbeam','electroshot','hyperbeam','gigaimpact','blastburn','frenzyplant','hydrocannon','rockwrecker','explosion','selfdestruct','mistyexplosion','finalgambit','lastresort','belch','futuresight','doomdesire','counter','mirrorcoat','metalburst','spitup','fling','dig','dive','fly','bounce','phantomforce','beakblast','shellsidearm','uproar','thrash','petaldance','outrage','ragingfury','firstimpression','synchronoise','overheat','leafstorm','dracometeor','superpower','makeitrain','psychoboost','fleurcannon','hammerarm','icehammer','spinout','clangingscales','vcreate','headlongrush','armorcannon']);
/* 入れかえ先にしない技（役目のある技）：ねこだまし・交代技・先制技・こうそくスピン等 */
const IMP_KEEP=new Set(['fakeout','uturn','voltswitch','flipturn','rapidspin','mortalspin','knockoff']);
/* 計算用の型 → 保存の形（技は番号、まもるは182） */
function impSaved(no,s){
  const p=byNo[no],phys=p.s[1]>=p.s[3];
  const mv=(s.moves||[]).map(m=>typeof m==='number'?{id:m,n:mName(m)}:m&&m.prot?{id:182,n:'まもる'}:m&&m.id>0?{id:m.id,n:mName(m.id)}:null).filter(Boolean);
  return{ab:s.ab?{k:s.ab,n:ABN[s.ab]||s.ab}:null,it:s.item?{k:s.item,n:ITEMN[s.item]||s.item}:null,mv,sp:s.sp?[...s.sp]:(phys?[2,32,0,0,0,32]:[2,0,0,32,0,32]),up:s.up??(phys?1:3),dn:s.dn??(phys?3:1)};
}
/* いまの育成（未登録の部分は計算に使っている型で埋める）。登録した変化技（つるぎのまい等）はそのまま残す */
function impBase(x){
  const calc=impSaved(x.no,mySetFor(x.no)),s=x.set||{};
  return{...calc,...Object.fromEntries(Object.entries(s).filter(([k,v])=>v!=null&&!(Array.isArray(v)&&!v.length))),mv:(s.mv&&s.mv.length?s.mv:calc.mv).map(m=>({...m})),sp:[...(s.sp||calc.sp)]};
}
/* パーティを一時的に入れかえて計算する（mySetFor・teamWx はいまのパーティ team を見るため）。必ず元に戻す */
function impWith(entries,fn){
  const keep=team.slice(),keepSel=team.map(x=>x.sel);
  team.length=0;entries.forEach(x=>team.push(x));TWX_K=null;
  try{return fn()}finally{team.length=0;keep.forEach((x,k)=>{x.sel=keepSel[k];team.push(x)});TWX_K=null}
}
const impLv=rs=>{const st=rs.filter(r=>r.r>=4).length,ok=rs.filter(r=>r.r>=3).length,wk=rs.filter(r=>r.r===2).length;return st>=2?4:st===1?3:ok||wk?2:1};
/* 1匹だけ変えたときの計算（変えた匹の列だけ dgMatch し直す）。天気・トリックルームの形が変わるなら全部 */
function impRecalc(T0,entries,i){
  return impWith(entries,()=>{
    let wx0=null,wx1=null;
    const full=()=>dgTeam0(entries,20);
    try{wx1=teamWx()}catch(e){}
    wx0=T0.wxKey;
    if(JSON.stringify(wx1&&[wx1.k,wx1.by])!==JSON.stringify(wx0||null))return full();
    const x=entries[i],p=byNo[x.no];let a;try{a=mkMon(p,'me',mySetFor(x.no))}catch(e){return full()}
    const col=T0.rows.map(r=>{try{return{i,...dgMatch(a,r.o)}}catch(e){return null}});
    const rows=T0.rows.map((r,j)=>{const res=r.res.map(z=>z.i===i?col[j]:z).filter(Boolean);
      const stable=res.filter(z=>z.r>=4),ok=res.filter(z=>z.r>=3),weak=res.filter(z=>z.r===2);return{...r,res,stable,ok,weak,lvl:impLv(res),resTR:null,lvlTR:null}});
    const M=T0.M.slice();M[i]=a;
    const T1={...T0,M,rows};
    /* トリックルーム構築か、変えた匹がトリックルームにかかわるときは全部 */
    if(T0.tr&&T0.tr.on)return full();
    return T1;
  });
}
function impMetric(T,keep){const m=dgMetric(T,keep);m.st=(keep?T.rows.filter(r=>keep.has(r.q.no)):T.rows).filter(r=>r.lvl===4).length;return m}
function impGain(b,a){return IMP_W.x*(b.x-a.x)+IMP_W.w*(b.w-a.w)+IMP_W.nosw*(b.nosw-a.nosw)+IMP_W.ohko*(b.ohko-a.ohko)+IMP_W.slow*(b.slow-a.slow)+IMP_W.st*(a.st-b.st)}
/* 変更前→変更後の比べ方（dgDiff）と、大事な役目を失うか（◎○→△以下・×が増える） */
function impJudge(T0,T1){
  const D=dgDiff(T0,T1),b=impMetric(T0,D.keep),a=impMetric(T1,D.keep);
  const by1=new Map(T1.rows.map(r=>[r.q.no,r]));
  const lost=T0.rows.filter(r=>D.keep.has(r.q.no)&&r.lvl>=3&&by1.get(r.q.no).lvl<=2).map(r=>r.q.n);
  const soft=T0.rows.filter(r=>D.keep.has(r.q.no)&&r.lvl===4&&by1.get(r.q.no).lvl===3).map(r=>r.q.n);
  return{D,b,a,lost,soft,gain:impGain(b,a),ok:!lost.length&&a.x<=b.x&&impGain(b,a)>.5};
}
/* 変えた匹（入れかえなら外す匹と入れる匹）の変化：実数値・技・持ち物・特性・その匹自身の成績 */
function impMember(T0,T1,o){
  const i=o.i,out=[];if(i==null||!T0.M[i]||!T1.M[i])return out;
  const a=T0.M[i],b=T1.M[i],nm0=formInfo(T0.ms[i].p).base,nm1=formInfo(T1.ms[i].p).base;
  const own=(T,k)=>{const z=T.rows.map(r=>({r,z:r.res.find(q=>q.i===k)})).filter(y=>y.z);return{atk:z.filter(y=>y.z.k==='ko_fast').map(y=>y.r.q.n),st:z.filter(y=>y.z.r>=4).map(y=>y.r.q.n),sw:z.filter(y=>y.z.swIn==='win').map(y=>y.r.q.n)}};
  const A=own(T0,i),B=own(T1,i);
  const lst=(x,y,lab)=>{const lost=x.filter(n=>!y.includes(n)),gain=y.filter(n=>!x.includes(n));if(lost.length||gain.length)out.push({t:`${lab} ${x.length}→${y.length}匹${gain.length?`（増える：${gain.slice(0,4).join('・')}${gain.length>4?' など':''}）`:''}${lost.length?`（減る：${lost.slice(0,4).join('・')}${lost.length>4?' など':''}）`:''}`,bad:lost.length>gain.length})};
  if(o.kind==='swap'){out.push({t:`外す${nm0}が有利だった相手：${A.st.join('・')||'なし'}／入れる${nm1}が有利な相手：${B.st.join('・')||'なし'}`,bad:false});return out}
  const st=SN.map((n,k)=>a.st[k]!==b.st[k]?`${n} ${a.st[k]}→${b.st[k]}`:'').filter(Boolean);if(st.length)out.push({t:`${nm0}の実数値：${st.join('・')}`,bad:SN.some((_,k)=>b.st[k]<a.st[k])});
  if(a.item!==b.item)out.push({t:`持ち物：${a.item?ITEMN[a.item]:'なし'} → ${b.item?ITEMN[b.item]:'なし'}`,bad:false});
  if(a.ab!==b.ab)out.push({t:`特性：${ABN[a.ab]||'―'} → ${ABN[b.ab]||'―'}`,bad:false});
  const m0=(o.base&&o.base.mv||[]).map(m=>m.n),m1=(o.entries[i].set&&o.entries[i].set.mv||[]).map(m=>m.n);
  const rm=m0.filter(n=>!m1.includes(n)),ad=m1.filter(n=>!m0.includes(n));if(rm.length||ad.length)out.push({t:`技：外れる ${rm.join('・')||'なし'}／入る ${ad.join('・')||'なし'}`,bad:rm.length>0});
  lst(A.atk,B.atk,`${nm0}が上から倒せる相手`);lst(A.st,B.st,`${nm0}が有利（◎の役目）に戦える相手`);lst(A.sw,B.sw,`${nm0}が後出しして勝てる相手`);
  return out;
}
/* 変える匹自身の大事な役目を失うか（2026/11/10）：上から倒せる相手か、有利（◎の役目）に戦える相手が、3匹以上かつ半分以上（有利は3割以上）減るなら失うとみなす */
function impRoleLoss(T0,T1,i){
  const c=(T,f)=>T.rows.filter(r=>{const z=r.res.find(q=>q.i===i);return z&&f(z)}).length;
  const a0=c(T0,z=>z.k==='ko_fast'),a1=c(T1,z=>z.k==='ko_fast'),s0=c(T0,z=>z.r>=4),s1=c(T1,z=>z.r>=4),w0=c(T0,z=>z.swIn==='win'),w1=c(T1,z=>z.swIn==='win');
  const nm=formInfo(T0.ms[i].p).base;
  if(a0-a1>=3&&a1<=a0/2)return `${nm}が上から倒せる相手が${a0}→${a1}匹に減る`;
  if(s0-s1>=3&&s1<=s0*.7)return `${nm}が有利に戦える相手が${s0}→${s1}匹に減る`;
  if(w0-w1>=3&&w1<=w0/2)return `${nm}が後出しして勝てる相手が${w0}→${w1}匹に減る`;
  return null;
}
const IMP_KIND={swap:'入れかえ',move:'技',sp:'能力ポイント',nat:'性格',item:'持ち物',role:'型（役割）',sel:'選出'};
/* 改善案を作る。戻り値：[{kind,i,title,why,entries（変更後）,J（比べた結果）,apply}] */
function dgImprove(entries){
  if(!entries||entries.length<3)return{list:[],note:'3匹以上入れると改善案を計算できます。'};
  const T0=dgTeam0(entries,20);try{const w=teamWx();T0.wxKey=w?[w.k,w.by]:null}catch(e){T0.wxKey=null}
  const out=[],dropped=[],nm=i=>formInfo(T0.ms[i].p).base;
  const used=i=>new Set(entries.filter((_,k)=>k!==i).map(x=>{const s=impBase(x);return s.it&&s.it.k}).filter(Boolean));
  const problem=T0.rows.filter(r=>r.lvl<=2||!r.res.some(z=>z.swIn==='win'));
  const tryEntry=(kind,i,nx,title,why)=>{const es=entries.map((x,k)=>k===i?nx:x);let T1;try{T1=impRecalc(T0,es,i)}catch(e){return}
    const J=impJudge(T0,T1);if(!J.ok)return;const loss=impRoleLoss(T0,T1,i);if(loss){dropped.push({title,loss});return}
    out.push({kind,i,title,why,entries:es,J,T1,base:impBase(entries[i])})};
  entries.forEach((x,i)=>{
    const p=byNo[x.no];if(!p)return;const base=impBase(x),M=T0.M[i];if(!M)return;
    const stone=base.it&&isStone(base.it.k);
    const main=(()=>{const c=(M.moves||[]).filter(m=>m&&m.pow>0);const ph=c.filter(m=>m.cls===0).length,sp=c.filter(m=>m.cls===1).length;return ph>sp||(ph===sp&&p.s[1]>=p.s[3])?1:3})();
    const sub=main===1?3:1;
    const set=o=>({...x,set:{...base,...o,src:'manual'}});
    /* ---- 技：いちばん使われていない攻撃技を、覚える攻撃技と入れかえる（積み技・場を作る技・まもるは残す） ---- */
    const bestUse={};T0.rows.forEach(r=>{const z=r.res.find(q=>q.i===i);if(z&&z.me)bestUse[z.me.mv.id]=(bestUse[z.me.mv.id]||0)+1});
    const atkIdx=base.mv.map((m,k)=>({m,k,info:MV[m.id]?mvObj(m.id):null})).filter(o=>o.info&&o.info.pow>0&&!(o.info.pri>0)&&!IMP_KEEP.has(MD[o.m.id]&&MD[o.m.id][3]));
    if(atkIdx.length){
      const slot=atkIdx.sort((a,b)=>(bestUse[a.m.id]||0)-(bestUse[b.m.id]||0))[0];
      const have=new Set(base.mv.map(m=>m.id)),ls=((LSD[p.no]||LSD[p.base]||[0,[]])[1]||[]);
      const oppT=problem.map(r=>r.q.t||byNo[r.q.no].t);
      const cands=ls.filter(id=>!have.has(id)&&MV[id]&&!IMP_NOMV.has(MD[id]&&MD[id][3])).map(id=>{const m=mvObj(id);if(!(m.pow>0))return null;
        const stab=p.t.includes(m.t)?1.5:1,cl=m.cls===(main===1?0:1)?1:.45,se=oppT.filter(t=>mult(m.t,t)>=2).length;
        return{id,m,v:m.pow*Math.min(100,m.acc||100)/100*stab*cl*(1+.15*se)+(m.pri>0?40:0)}}).filter(Boolean).sort((a,b)=>b.v-a.v).slice(0,7);
      cands.forEach(c=>{const mv=base.mv.map((m,k)=>k===slot.k?{id:c.id,n:mName(c.id)}:m);
        tryEntry('move',i,set({mv}),`${nm(i)}の技：${mName(slot.m.id)} → ${mName(c.id)}`,`${mName(slot.m.id)}は上位の相手にいちばん使われていない技なので、${mName(c.id)}（${c.m.t}・威力${c.m.pow}${c.m.pri>0?'・先制技':''}）にかえる`)});
    }
    /* ---- 能力ポイント（合計66：32＋32＋2） ---- */
    const SPS=[[[main,5],'攻撃と素早さ'],[[0,main],'HPと攻撃'],[[0,2],'HPと防御'],[[0,4],'HPと特防'],[[0,5],'HPと素早さ']];
    SPS.forEach(([[a,b],lab])=>{const sp=[0,0,0,0,0,0];sp[a]=32;sp[b]=32;const rest=[0,2,4,main].find(k=>!sp[k]);sp[rest]=2;
      if(sp.join()===base.sp.join())return;
      const lb=lab.replace('攻撃',main===1?'攻撃':'特攻');
      tryEntry('sp',i,set({sp}),`${nm(i)}の能力ポイント：${lb}に32ずつ`,`いま：${SN.map((n,k)=>base.sp[k]?`${n}${base.sp[k]}`:'').filter(Boolean).join('・')}`)});
    /* ---- 性格（上がる能力を変える。下がるのは使わない方の攻撃） ---- */
    [main,5,2,4].forEach(up=>{if(up===base.up&&sub===base.dn)return;
      tryEntry('nat',i,set({up,dn:sub}),`${nm(i)}の性格：${natName(base.up,base.dn)||'補正なし'} → ${natName(up,sub)}`,'')});
    /* ---- 持ち物（メガストーンは変えない・ほかの匹と重ならない） ---- */
    if(!stone){const u=used(i),cur=base.it&&base.it.k;
      const hasStatus=base.mv.some(m=>MD[m.id]&&!MV[m.id]&&m.id!==182);
      ['lifeorb','choicescarf','focussash','leftovers','sitrusberry','expertbelt','rockyhelmet',TYPE_ITEM[p.t[0]],TYPE_ITEM[p.t[1]]].filter((k,j,a)=>k&&a.indexOf(k)===j&&k!==cur&&CH_ITEMS.has(k)&&!u.has(k)).forEach(k=>{
        tryEntry('item',i,set({it:{k,n:ITEMN[k]}}),`${nm(i)}の持ち物：${cur?ITEMN[cur]:'なし'} → ${ITEMN[k]}`,k==='choicescarf'&&hasStatus?'こだわりスカーフは同じ技しか出せないので、登録している変化技が使いにくくなる':'')});}
    /* ---- 型（役割）：攻撃型・耐久型・サポート型・積み型を組みなおす（解説タブの型の例と同じ組み方） ---- */
    try{const g=monGuide(p,{raw:true}),u=used(i);
      ['attacker','bulky','support','setup'].filter(k=>g.keys.includes(k)||k==='bulky').forEach(k=>{const s=g.make(k);if(!s)return;
        if(stone)s.item=base.it.k;else if(s.item&&(u.has(s.item)||!(CH_ITEMS.has(s.item))))return;
        const sv=impSaved(x.no,s);
        tryEntry('role',i,{...x,set:{...sv,src:'manual'}},`${nm(i)}を${{attacker:'攻撃',bulky:'耐久',support:'サポート',setup:'積み'}[k]}の型に`,`特性 ${sv.ab?sv.ab.n:'―'}・持ち物 ${sv.it?sv.it.n:'なし'}・${natName(sv.up,sv.dn)||'補正なし'}・${SN.map((n,q)=>sv.sp[q]?`${n}${sv.sp[q]}`:'').filter(Boolean).join('・')}・技 ${sv.mv.map(m=>m.n).join('・')}`)})}catch(e){}
  });
  /* ---- 入れかえ：問題の相手に強い候補を先に1対1でしぼり、役目の少ない2匹と入れかえて全部を計算し直す ---- */
  try{const fam=q=>q.base||q.no,inT=new Set(entries.map(x=>fam(byNo[x.no]||{no:x.no}))),seen=new Set(),pool=[];
    [...metaOpps(40),...(typeof gmOpps==='function'?gmOpps():[])].forEach(q=>{if(!q||q.base||inT.has(q.no)||seen.has(q.no))return;seen.add(q.no);pool.push(q)});
    const contrib=T0.ms.map((_,i)=>T0.rows.filter(r=>{const z=r.res.find(q=>q.i===i);return z&&(z.r>=4||z.swIn==='win')}).length);
    const outs=entries.map((x,i)=>i).filter(i=>!entries[i].axis).sort((a,b)=>contrib[a]-contrib[b]).slice(0,2);
    outs.forEach(i=>{const rest=entries.filter((_,k)=>k!==i);
      const sc=pool.map(c=>{const S=dgSwapSet(c,rest);if(!S)return null;let a;try{a=mkMon(c,'me',savedToCalc(c.no,S.sv))}catch(e){return null}
        const v=problem.reduce((t,r)=>{try{const z=dgMatch(a,r.o);return t+(z.r>=4?1:0)+(z.swIn==='win'?.6:0)}catch(e){return t}},0);return{c,S,v}}).filter(z=>z&&z.v>=1.5).sort((a,b)=>b.v-a.v).slice(0,4);
      sc.forEach(({c,S})=>{const es=entries.map((x,k)=>k===i?{no:c.no,sel:!!x.sel,set:{...S.sv,src:'copy'}}:x);let T1;try{T1=impWith(es,()=>dgTeam0(es,20))}catch(e){return}
        const J=impJudge(T0,T1);if(J.ok)out.push({kind:'swap',base:null,i,title:`${nm(i)} → ${c.n}`,why:`${S.txt}（${nm(i)}の持ち物・技は引きつがない）`,entries:es,J,T1})})});
  }catch(e){}
  /* 種類ごとに良い順に2つまで、全体で8つまで。同じ匹・同じ種類の案は良い方だけ */
  out.sort((a,b)=>b.J.gain-a.J.gain);
  const seenK=new Set(),per={},list=[];
  out.forEach(o=>{const k=o.kind+':'+o.i;if(seenK.has(k))return;if((per[o.kind]||0)>=2)return;seenK.add(k);per[o.kind]=(per[o.kind]||0)+1;list.push(o)});
  const top=list.slice(0,8);top.forEach(o=>{try{o.mem=impMember(T0,o.T1,o)}catch(e){o.mem=[]}});
  /* 選出への影響（選出の比較の1番の ◎○△×） */
  let S0=null;try{S0=dgSelect(entries)}catch(e){}
  top.forEach(o=>{try{const S1=impWith(o.entries,()=>{DG_SELC.clear();return dgSelect(o.entries)});o.sel=S0&&S1?{b:S0.best,a:S1.best,nm:S1.nm}:null}catch(e){o.sel=null}});
  DG_SELC.clear();
  /* 選出の変え方：★の選出が1番でないとき */
  if(S0&&S0.mine&&S0.mine!==S0.best){const b=S0.mine,a=S0.best,W=dgSelWhy(S0,a,b);
    top.push({kind:'sel',title:`選出：${b.c.map(S0.nm).join('・')} → ${a.c.map(S0.nm).join('・')}`,why:`いまの★の選出は${S0.list.length}通りのうち${S0.mineRank}番目です。`,selFix:a.c,
      J:{gain:0,b:{x:b.cnt[1],w:b.cnt[1]+b.cnt[2],st:b.cnt[4]},a:{x:a.cnt[1],w:a.cnt[1]+a.cnt[2],st:a.cnt[4]},D:{up:W.good.filter(t=>/2番目の選出/.test(t)).map(t=>t.replace(/^2番目の選出（[^）]*）と比べて、/,'')),dn:[],note:''},lost:[],soft:[]}})}
  return{list:top,tried:out.length,dropped,T0};
}
/* 画面：チェックタブの「相手ごとの対応力」の下。計算に数秒かかるのでボタンで始める */
function impHTML(){return `<div id="imp-box"><div class="sec"><h2>改善案（変更後を計算し直して比べる）</h2></div>
  <p class="note" style="padding-top:0">入れかえ・技・能力ポイント・性格・持ち物・型・選出のどれを変えると良くなるかを、変更後のパーティで「相手ごとの対応力」と同じ計算をし直して比べます。前に答えられていた相手を答えられなくなる案は出しません。</p>
  <button class="btn btn-s" id="imp-run" style="width:100%">改善案を計算する</button></div>`}
function impCard(o,k){
  const B=o.J.b,A=o.J.a,ar=(x,y,lab,low)=>x===y?'':`<li>${lab} ${x}→${y}${(low?y<x:y>x)?' <b class="pc-upv">良くなる</b>':' <b class="pc-dnv">悪くなる</b>'}</li>`;
  const L=l=>DG_LV[l][0];
  return `<div class="pc-i imp-c"><b><span class="pc-area">${IMP_KIND[o.kind]}</span>${esc(o.title)}</b>${o.why?`<p class="vcap">${esc(o.why)}</p>`:''}
    <ul class="pc-ev">${ar(B.x,A.x,'答えがない相手（×）',1)}${ar(B.w,A.w,'△以下の相手',1)}${B.nosw!=null?ar(B.nosw,A.nosw,'後出しして勝てる匹がいない相手',1):''}${B.ohko!=null?ar(B.ohko,A.ohko,'半分以上を一撃で倒される相手',1):''}${B.slow!=null?ar(B.slow,A.slow,'だれも先に動けない相手',1):''}${ar(B.st,A.st,'2匹以上で安定（◎）の相手',0)}</ul>
    ${o.J.D&&o.J.D.up.length?`<p class="sel-wh">良くなるところ</p><ul class="sel-why">${o.J.D.up.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`:''}
    ${o.mem&&o.mem.length?`<p class="sel-wh">変える匹の変化</p><ul class="sel-why">${o.mem.map(m=>`<li${m.bad?' class="sel-w"':''}>${esc(m.t)}</li>`).join('')}</ul>`:''}
    <p class="sel-wh">悪くなるところ（相手ごと）</p><ul class="sel-why sel-warn">${[...(o.J.D?o.J.D.dn:[])].map(t=>`<li>${esc(t)}</li>`).join('')||'<li style="color:var(--dim)">計算した範囲ではなし</li>'}</ul>
    ${o.sel?`<p class="vcap">選出の比較の1番：${o.sel.b.c.map(o.sel.nm).join('・')}（◎${o.sel.b.cnt[4]}○${o.sel.b.cnt[3]}△${o.sel.b.cnt[2]}×${o.sel.b.cnt[1]}）→ ${o.sel.a.c.map(o.sel.nm).join('・')}（◎${o.sel.a.cnt[4]}○${o.sel.a.cnt[3]}△${o.sel.a.cnt[2]}×${o.sel.a.cnt[1]}）</p>`:''}
    ${o.J.D&&o.J.D.note?`<p class="vcap">${esc(o.J.D.note)}</p>`:''}
    <button class="bback" data-imp="${k}" style="padding:0;color:var(--acc)">${o.kind==='sel'?'この選出に★を付ける':'この変更をする'}</button></div>`;
}
let IMP_LAST=null;
/* 同じパーティ・同じ条件の計算結果は使い回す（2026/11/10 依頼主：診断のまとめと改善案の一覧で同じ結果を使う） */
const IMP_CACHE=new Map();
const impKey=entries=>JSON.stringify([FMT,entries.map(x=>[x.no,x.set||0,!!x.sel,!!x.axis]),Object.keys(LIVE.csv).length,typeof META!=='undefined'&&META.rank?META.rank.length:0]);
function impGet(entries){const k=impKey(entries);if(IMP_CACHE.has(k))return IMP_CACHE.get(k);
  const R=dgImprove(entries);if(IMP_CACHE.size>8)IMP_CACHE.clear();IMP_CACHE.set(k,R);return R}
const impCached=entries=>IMP_CACHE.get(impKey(entries))||null;
function impRender(box,R){
  IMP_LAST=R;
  box.innerHTML=`<div class="sec"><h2>改善案（変更後を計算し直して比べる）</h2></div>
        <p class="note" style="padding-top:0">${R.note?esc(R.note):R.list.length?`${R.tried}案のうち、良くなって前に答えられていた相手を失わない案を、良くなる順に出しています（種類ごとに2つまで）。どの数も変更後のパーティで計算し直した結果です。`:'計算した範囲では、ほかを悪くせずに良くなる変更は見つかりませんでした。'}</p>
        ${R.list.map(impCard).join('')}
        ${R.dropped&&R.dropped.length?`<details class="pc-ref"><summary>数は良くなるが、変える匹の大事な役目を失うので出さなかった案（${R.dropped.length}件）</summary><ul class="sel-why">${R.dropped.slice(0,10).map(d=>`<li>${esc(d.title)}：${esc(d.loss)}</li>`).join('')}</ul></details>`:''}
        <details class="pc-ref"><summary>改善案の決め方と、計算していないこと</summary><p class="note">良さの点＝×が減る×3・△以下が減る×1.5・後出しできない相手が減る×1・一撃で半分以上倒される相手が減る×1・だれも先に動けない相手が減る×0.7・◎が増える×0.3。変更前に◎○だった相手が△以下になる案、×が増える案、変える匹自身が上から倒せる相手・有利に戦える相手・後出しして勝てる相手を大きく減らす案（3匹以上かつ半分以上、有利は3割以上）は出しません。比べるのは変更前と変更後の両方にいる相手だけです（入れかえると、入れた種類が相手の候補から外れるため）。技は覚える攻撃技、持ち物はゲームにあってほかの匹と重ならないもの、メガストーンは変えません。計算していないこと：${esc(DG_NOTE)}。ダブルの範囲技・同時攻撃・味方のサポート。相手の型は使用率の高い型（集計がなければ自動の型）です。</p></details>`;
  box.querySelectorAll('[data-imp]').forEach(b=>b.onclick=async()=>{const o=IMP_LAST&&IMP_LAST.list[+b.dataset.imp];if(!o)return;
    if(o.kind==='sel'){team.forEach((x,k)=>x.sel=o.selFix.includes(k));saveTeam();toast('選出に★を付けました');teamRender();return}
    if(!await askConfirm({title:'この変更をしますか？',text:`${o.title}${o.kind==='swap'?'（外す匹の育成は消えます）':''}`,ok:'変更する',danger:false}))return;
    const nx=o.entries[o.i];team[o.i]={...nx,sel:team[o.i]?team[o.i].sel:false,axis:team[o.i]&&team[o.i].axis};if(!team[o.i].axis)delete team[o.i].axis;
    saveTeam();toast('変更しました');teamRender()});
}
function impFill(entries){
  const box=document.getElementById('imp-box');if(!box)return;
  const c=impCached(entries);if(c){impRender(box,c);return}
  const run=box.querySelector('#imp-run');if(!run)return;
  run.onclick=()=>{run.disabled=true;run.textContent='計算しています…';
    setTimeout(()=>{let R;try{R=impGet(entries)}catch(e){run.disabled=false;run.textContent='計算できませんでした。もう一度計算する';return}
      impRender(box,R)},30)};
}
