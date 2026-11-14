/* ===================== 入れかえ案 MVP：6匹の評価と入れかえの比較（2026/11/13、docs/party-building-mvp-spec.md） =====================
   ・データ：75-mvp-data.js（MVP_DATA）だけを使う。公式の M-C の一覧と PokéKit（Smogon / Pokémon Showdown の集計）の形式ごとの行。
     利用者のブラウザから外へ読みに行かない。通信を待たないので、同じ入力なら同じ結果。
   ・使えるか（mvpLegal）：公式の「図鑑番号-姿の番号」で決める。対応が確かめられない姿は unverified（ふつうの順位に出さない）。
   ・型（mvpSet）：同じ形式・同じ月の PokéKit のその匹の行だけから組む（各項目で割合がいちばん高い、使えるもの）。
     組めなければ insufficient（自動の型で埋めない）。持ち物は残りの5匹と重ならないもの（同じ行の一覧にあるものだけ）。
     PokéKit の evs は能力ポイントとして未確認なので使わず、全員同じ仮定の振り方（MVP_SP）で計算する。
   ・1対1は 60-diag.js の dgMatch をそのまま使う。3つを分けて数える：
       有利（adv）＝dgMatch の r>=4（先に倒せる・耐えて倒せる・後出しできる）
       後出し（sw）＝交代で1発受けてから勝てる（swIn==='win'）
       受け（recv）＝相手のいちばん痛い技を最大の乱数でも50%未満（2回は耐えられる）
   ・メガシンカ：メガストーンを持つ匹ごとに「その1匹だけがメガシンカ」の場合を別々に計算。同時に2匹をメガの姿にしない。
   ・大きな弱点（MVP_WK）は場合ごとに、相手ごとに決まった条件で数える（足し算の点にしない）。
   ・選出（3匹・4匹）の組み合わせは数えない（選出アシストの役目）。ダブルの補助・範囲技・味方との関わりは評価しない（画面に書く）。 */
const MVP_SP={phys:[2,32,0,0,0,32],spec:[2,0,0,32,0,32]};
const MVP_OPPN=20,MVP_TOPN=10,MVP_PRE=8;
const MVP_NAT={Hardy:[-1,-1],Docile:[-1,-1],Serious:[-1,-1],Bashful:[-1,-1],Quirky:[-1,-1],Lonely:[1,2],Adamant:[1,3],Naughty:[1,4],Brave:[1,5],
  Bold:[2,1],Impish:[2,3],Lax:[2,4],Relaxed:[2,5],Modest:[3,1],Mild:[3,2],Rash:[3,4],Quiet:[3,5],Calm:[4,1],Gentle:[4,2],Careful:[4,3],Sassy:[4,5],
  Timid:[5,1],Hasty:[5,2],Jolly:[5,3],Naive:[5,4]};
const MVP_WK={none:'1対1で有利に戦える匹がいない',nosw:'交代で受けられる匹がいない（後出しして勝てる匹も、2回耐えられる匹もいない）',ohko:'半分以上の匹が一撃で倒される',nohit:'いちばん高い乱数でも半分以上削れる匹がいない'};
/* 型（技・特性）から分かる役わり（2026/11/14 第3段階 P3-04）。sc＝素早さの操作・天気：パーティでその匹だけが持つのに外す案はおすすめにしない */
const MVP_ROLE_MV={trickroom:'trickroom',tailwind:'tailwind',fakeout:'fakeout',followme:'redirect',ragepowder:'redirect',
  rapidspin:'hazclear',defog:'hazclear',mortalspin:'hazclear',stealthrock:'hazard',spikes:'hazard',toxicspikes:'hazard',stickyweb:'hazard',
  reflect:'screen',lightscreen:'screen',auroraveil:'screen',uturn:'pivot',voltswitch:'pivot',flipturn:'pivot',partingshot:'pivot'};
const MVP_ROLES={trickroom:['トリックルーム',1],tailwind:['おいかぜ',1],weather:['天気を変える特性',1],fakeout:['ねこだまし'],redirect:['このゆびとまれ・いかりのこな'],
  hazclear:['設置技を消す技'],hazard:['設置技'],screen:['壁（リフレクター等）'],pivot:['交代技'],intimidate:['いかく']};
const MVP_WXK={drought:'sun',drizzle:'rain',sandstream:'sand',snowwarning:'snow'},MVP_WXAB=new Set(Object.keys(MVP_WXK));
/* mv＝技の番号（変化技も。計算用の型は攻撃技しか持たないので、登録した育成・集計の型から）、ab＝特性のキー */
const mvpAbK=a=>String(a||'').replace(/-/g,'');
function mvpRoles(no,mv,ab,stone){
  const ks=new Set();let w=null;(mv||[]).forEach(id=>{const k=id>0&&MD[id]&&MD[id][3];if(k&&MVP_ROLE_MV[k])ks.add(MVP_ROLE_MV[k])});
  if(MVP_WXAB.has(mvpAbK(ab))){ks.add('weather');w=MVP_WXK[mvpAbK(ab)]}if(mvpAbK(ab)==='intimidate')ks.add('intimidate');
  if(stone){const m=megaOf(no,stone);if(m&&MVP_WXAB.has(mvpAbK(m.ab))){ks.add('weather');w=w||MVP_WXK[mvpAbK(m.ab)]}}
  return [...ks].sort().map(k=>({k,n:MVP_ROLES[k][0],sc:!!MVP_ROLES[k][1],...(k==='weather'?{w}:{})}));
}
/* 計算の条件をそろえる：パーティを entries にし、ランクバトルの集計と画面の天気は使わない（P3-13：候補のしぼりこみも同じ条件） */
function mvpCtx(entries,fn){
  return impWith(entries,()=>{const keepCsv=LIVE.csv;LIVE.csv={};const wB=B.weather;B.weather=null;try{return fn()}finally{LIVE.csv=keepCsv;B.weather=wB}});
}
const mvpFam=p=>p?(p.base||p.no):0;
const mvpPad=(n,k)=>String(n).padStart(k,'0');
/* サイトの番号 → 公式の「図鑑番号-姿の番号」（図鑑のリンクと同じ番号の付け方。2026/11/13 に262件中256件で一致を確かめた） */
const mvpOffId=p=>p&&p.dno>0?`${mvpPad(p.dno,4)}-${mvpPad(ZK_SUB[p.no]||0,3)}`:null;
let MVP_IDS=null;
/* 使えるか：ok（公式の一覧で確認）／unverified（対応が確かめられない）／illegal（公式の一覧に無い）。メガの姿は元の姿で見る */
function mvpLegal(no){
  const p=byNo[no];if(!p)return{st:'illegal',why:'図鑑に無い'};
  const q=p.base?byNo[p.base]:p;const id=mvpOffId(q);if(!id)return{st:'illegal',why:'公式の番号が分からない'};
  const L=MVP_DATA.legal;if(!MVP_IDS)MVP_IDS=new Set(L.ids);
  const u=L.unverifiedDex[id.slice(0,4)];if(u)return{st:'unverified',id,why:u};
  return MVP_IDS.has(id)?{st:'ok',id}:{st:'illegal',id,why:`公式の M-C の一覧に ${id} が無い`};
}
/* メガストーンが M-C で使えるか：公式ページの「新しくメガシンカできる」6つだけ確認。ほかは未確認（使えるとみなさない） */
const mvpStoneSt=(stone,no)=>{const m=megaOf(no,stone);return m&&MVP_DATA.legal.newMegas.includes(m.n)?'ok':'unverified'};
/* PokéKit の行 → サイトの番号。メガは「元の姿＋メガストーン」 */
const MVP_ROWS={};
function mvpRows(fmt){
  if(MVP_ROWS[fmt])return MVP_ROWS[fmt];
  const S=MVP_DATA.sets[fmt];if(!S)return null;
  const byId={};Object.entries(ENSP).forEach(([no,k])=>{if(byNo[+no]&&!byNo[+no].base)(byId[k]=byId[k]||[]).push(+no)});
  const rows=[],unmapped=[];
  S.rows.forEach(r=>{
    const mm=r.id.match(/mega([xyz]?)$/);
    if(mm){const suf=mm[1];const c=MEGAP.filter(m=>m.dno===r.num&&m.stone&&((m.stone.match(/ite([xyz])$/)||[])[1]||'')===suf);
      if(c.length===1)rows.push({...r,no:c[0].base,stone:c[0].stone,mega:c[0].no});else unmapped.push(r.id)}
    else{const c=byId[r.id]||[];if(c.length===1)rows.push({...r,no:c[0],stone:null,mega:null});else unmapped.push(r.id)}});
  return MVP_ROWS[fmt]={rows,unmapped,meta:S.meta};
}
const mvpRowOf=(fmt,no,stone)=>{const R=mvpRows(fmt);return R&&R.rows.find(r=>r.no===no&&(r.stone||null)===(stone||null))||null};
const mvpMeta=fmt=>{const S=MVP_DATA.sets[fmt];return S?S.meta:null};
const mvpSrcTxt=fmt=>{const m=mvpMeta(fmt);return m?`PokéKit（Smogon / Pokémon Showdown の集計）・${fmt==='double'?'ダブル':'シングル'}・${m.month}・${m.battles.toLocaleString()}戦・レート${m.cutoff}以上`:''};
/* 型を組む。opt.used＝残りの匹の持ち物、opt.stone＝メガの行。戻り値 st：ok／illegal／unverified／nodata（上位150匹に無い）／insufficient／item_conflict */
function mvpSet(fmt,no,opt){
  opt=opt||{};const p=byNo[no];
  const lg=mvpLegal(no);if(lg.st!=='ok'&&!opt.anyLegal)return{st:lg.st,why:lg.why,no};
  const r=mvpRowOf(fmt,no,opt.stone);if(!r)return{st:'nodata',no,why:`${fmt==='double'?'ダブル':'シングル'}の PokéKit の上位150匹に${opt.stone?'このメガシンカの行が':''}無い`};
  const notes=[];
  /* 特性：その姿が持てる特性（メガはメガの特性） */
  const mg=r.mega?byNo[r.mega]:null;
  const can=mg?[mg.ab]:(ABD[no]||[]).map(a=>a[0]);
  const abR=r.ab.find(([k])=>can.includes(ABK[nrm(k)]));
  if(!abR)return{st:'insufficient',no,why:'持てる特性が集計に無い'};
  /* 持ち物：ゲームにある持ち物かその匹のメガストーン。割合の高い順に、残りの匹と重ならない最初のもの */
  const used=opt.used||new Set();let itR=null,first=null,idx=-1;
  r.it.forEach(([k,pc],i)=>{if(itR)return;const kk=k==='leek'?'stick':k==='nothing'?'':k;
    const ok=kk===''?true:r.mega?kk===r.stone:(CH_ITEMS.has(kk)&&!isStone(kk));if(!ok)return;
    if(!first)first=[kk,pc];if(kk&&used.has(kk))return;itR=[kk,pc];idx=i});
  if(!first)return{st:'insufficient',no,why:'使える持ち物が集計に無い'};
  if(!itR)return{st:'item_conflict',no,why:`持ち物（${ITEMN[first[0]]||first[0]}）がパーティのほかの匹と重なり、集計にほかの持ち物も無い`};
  if(itR!==first&&itR[0]!==first[0])notes.push(`持ち物：いちばん多い${ITEMN[first[0]]||first[0]}（${first[1]}%）はパーティのほかの匹と重なるので、同じ集計の${ITEMN[itR[0]]||'持ち物なし'}（${itR[1]}%）`);
  /* 技：覚える技だけ、割合の高い順に4つ。攻撃技が1つも無ければ組めない */
  const ls=(LSD[no]||[0,[]])[1];const mv=[];
  for(const [k] of r.mv){if(mv.length>=4)break;const id=MVKA[nrm(k)];if(!id||!(ls.includes(id)||id===182))continue;mv.push({id,n:mName(id)})}
  if(!mv.some(m=>MV[m.id]&&MV[m.id][2]>0))return{st:'insufficient',no,why:'覚える攻撃技が集計に無い'};
  /* 1対1の計算で正しく扱えない技（自分の能力が下がる・ためる・反動で動けない等、62-improve.js の IMP_NOMV）を含む型は、候補として比べない（型は変えない）。
     パーティの匹・相手の型（opt.anyMv）はそのまま使う */
  const nomv=typeof IMP_NOMV!=='undefined'?mv.filter(m=>IMP_NOMV.has(MD[m.id]&&MD[m.id][3])):[];
  if(nomv.length&&!opt.anyMv)return{st:'insufficient',no,why:`計算で正しく扱えない技（${nomv.map(m=>m.n).join('・')}）を含むため比べられない`};
  const nat=r.nat[0]&&MVP_NAT[r.nat[0][0]];
  const phys=(()=>{const c=mv.map(m=>MV[m.id]).filter(x=>x&&x[2]>0);const ph=c.filter(x=>x[4]===0).length,sp=c.filter(x=>x[4]===1).length;return ph>sp||(ph===sp&&p.s[1]>=p.s[3])})();
  const sv={ab:{k:ABK[nrm(abR[0])],n:ABN[ABK[nrm(abR[0])]]||abR[0]},it:itR[0]?{k:itR[0],n:ITEMN[itR[0]]||itR[0]}:null,mv,sp:[...(phys?MVP_SP.phys:MVP_SP.spec)],
    up:nat?nat[0]:(phys?1:3),dn:nat?nat[1]:(phys?3:1),src:'copy'};
  const stSt=r.stone?mvpStoneSt(r.stone,no):null;
  return{st:'ok',no,sv,stone:r.stone||null,stoneSt:stSt,notes,row:{rank:r.rank,usage:r.usage,ab:abR[1],it:itR[1],nat:r.nat[0]||null,itAlt:idx>0},
    txt:`特性 ${sv.ab.n}（${abR[1]}%）／持ち物 ${sv.it?sv.it.n:'なし'}（${itR[1]}%）／性格 ${natName(sv.up,sv.dn)||'補正なし'}${r.nat[0]?`（${r.nat[0][1]}%）`:''}／技 ${mv.map(m=>m.n).join('・')}`};
}
/* パーティの1匹の型：登録した育成 → 同じ形式の PokéKit の型 → 自動の型（推定。候補ではないので使ってよい）。
   PokéKit の型の持ち物は、6匹全体で重ならないように選ぶ（used。同じ行の一覧にあるものだけ。無ければ持ち物なしの推定） */
function mvpMemberSet(x,fmt,used){
  const s=x.set;const reg=s&&((s.mv&&s.mv.length)||(s.it&&s.it.k)||(s.ab&&s.ab.k));
  if(reg)return{src:'reg',calc:savedToCalc(x.no,s),item:s.it&&s.it.k||null,mv:(s.mv||[]).map(m=>m&&m.id).filter(Boolean)};
  let m=mvpSet(fmt,x.no,{anyMv:true,used});
  if(m.st==='item_conflict'){const c=chooseSet(byNo[x.no],true);const m0=mvpSet(fmt,x.no,{anyMv:true});
    if(m0.st==='ok'){const calc=savedToCalc(x.no,{...m0.sv,it:null});return{src:'pokekit',calc:{...calc,item:null},item:null,noItem:true,mv:m0.sv.mv.map(v=>v.id)}}
    return{src:'auto',calc:{...c,item:null},item:null}}
  if(m.st==='ok')return{src:'pokekit',calc:savedToCalc(x.no,m.sv),item:m.sv.it&&m.sv.it.k||null,mv:m.sv.mv.map(v=>v.id)};
  const c=chooseSet(byNo[x.no],true);return{src:'auto',calc:{...c,item:null},item:null};
}
/* 相手：同じ形式の PokéKit の使用率の上位。型が組めない相手は「評価していない」に分ける（弱くないとはみなさない） */
const MVP_OPPC={};
function mvpOpps(fmt){
  if(MVP_OPPC[fmt])return MVP_OPPC[fmt];
  const R=mvpRows(fmt);if(!R)return null;
  const out=[],skip=[];
  for(const r of [...R.rows].sort((a,b)=>a.rank-b.rank)){if(out.length>=MVP_OPPN)break;
    const S=mvpSetRaw(fmt,r);if(!S){skip.push(r.id);continue}
    let o;try{o=mkMon(byNo[r.no],'op',savedToCalc(r.no,S))}catch(e){skip.push(r.id);continue}
    /* sig に形式を入れる（P3-01：シングルとダブルで同じ id でも相手の型は別） */
    out.push({key:r.id,rank:r.rank,no:r.mega||r.no,n:(byNo[r.mega||r.no]||{}).n||r.name,o,sig:fmt+':'+r.id})}
  return MVP_OPPC[fmt]={list:out,skip,unmapped:R.unmapped};
}
/* 相手の型は使えるかを問わない（実際に使われている相手のため）。持ち物の重なりも見ない */
const mvpSetRaw=(fmt,r)=>{const m=mvpSet(fmt,r.no,{stone:r.stone,anyLegal:true,anyMv:true});return m.st==='ok'?m.sv:null};
/* 1対1の結果を覚える（同じ匹・同じ型・同じメガの状態・同じ天気・同じ相手なら同じ） */
const MVP_MC=new Map();
function mvpMatch(a,aSig,op,wx){
  const k=aSig+'|'+op.sig+'|'+wx;if(MVP_MC.has(k))return MVP_MC.get(k);
  let z=null;try{const m=dgMatch(a,op.o);z={r:m.r,k:m.k,sw:m.swIn==='win',recv:!m.op||m.op.fmax<50,oh:!!(m.op&&m.op.nMax===1),hit:!!(m.me&&m.me.max>=50),fast:m.spd===1,t:m.t}}catch(e){z=null}
  MVP_MC.set(k,z);return z;
}
/* 6匹の型をまとめて決める：登録した育成を先に、そのあと登録の無い匹を並び順に、持ち物が重ならないように */
function mvpTeamSets(entries,fmt){
  const out=new Array(entries.length),used=new Set();
  entries.forEach((x,i)=>{const s=x.set;if(s&&((s.mv&&s.mv.length)||(s.it&&s.it.k)||(s.ab&&s.ab.k))){out[i]=mvpMemberSet(x,fmt);if(out[i].item)used.add(out[i].item)}});
  entries.forEach((x,i)=>{if(out[i])return;out[i]=mvpMemberSet(x,fmt,used);if(out[i].item)used.add(out[i].item)});
  return out;
}
/* 6匹の評価。メガシンカする匹ごとの場合（なければ「メガシンカなし」1つ） */
/* opt.none＝メガストーンを持つ匹がいても「メガシンカしない」場合も足す（1匹から組む。入れかえ案の画面は今までどおり足さない） */
function mvpEvalTeam(entries,fmt,opt){
  const O=mvpOpps(fmt);if(!O||!O.list.length)return{st:'nodata',why:'この形式の相手のデータが無い'};
  const TS=mvpTeamSets(entries,fmt);
  const mem=entries.map((x,i)=>{const p=byNo[x.no];const S=TS[i];const st=S.calc.item&&isStone(S.calc.item)&&megaOf(x.no,S.calc.item)?S.calc.item:null;return{x,p,S,stone:st}});
  const users=mem.map((m,i)=>m.stone?i:-1).filter(i=>i>=0);
  const scen=(users.length?(opt&&opt.none?[-1,...users]:users):[-1]).map(u=>({u,key:u<0?'none':'mega:'+mem[u].x.no,label:u<0?'メガシンカなし':`${byNo[megaOf(mem[u].x.no,mem[u].stone).no].n}（${formInfo(mem[u].p).base}がメガシンカ）`,
    stoneSt:u<0?null:mvpStoneSt(mem[u].stone,mem[u].x.no)}));
  return mvpCtx(entries,()=>{
    let wx='';try{const w=teamWx();wx=w?w.k+':'+w.by:''}catch(e){}
      scen.forEach(sc=>{
        const mons=mem.map((m,i)=>{const mega=i===sc.u;const set=m.stone&&!mega?{...m.S.calc,item:null}:m.S.calc;
          const sig=m.x.no+':'+JSON.stringify([set.ab,set.item,(set.moves||[]).map(v=>v.id+(v.prot?'p':'')),set.sp,set.up,set.dn]);
          return{a:mkMon(m.p,'me',set),sig}});
        /* 確かめ用：この場合でメガの姿で計算した匹（いつも0匹か1匹） */
        sc.megaIdx=mons.map((m,i)=>m.a.p.base?i:-1).filter(i=>i>=0);
        sc.rows=O.list.map(op=>{const z=mons.map(m=>mvpMatch(m.a,m.sig,op,wx));
          const ok=z.filter(Boolean);const n=mons.length,adv=ok.filter(v=>v.r>=4).length,sw=ok.filter(v=>v.sw).length,recv=ok.filter(v=>v.recv).length,oh=ok.filter(v=>v.oh).length,hit=ok.filter(v=>v.hit).length,any3=ok.filter(v=>v.r>=3).length;
          const wk=[];if(!any3)wk.push('none');if(!sw&&!recv)wk.push('nosw');if(n>=2&&oh>=Math.ceil(n/2))wk.push('ohko');if(!hit)wk.push('nohit');
          const top=op.rank<=MVP_TOPN;
          return{op,z,adv,sw,recv,oh,hit,wk:wk.map(k=>({k,crit:k==='ohko'||top}))}});
        sc.weak=[];sc.rows.forEach(r=>r.wk.forEach(w=>sc.weak.push({key:r.op.key+'|'+w.k,op:r.op,k:w.k,crit:w.crit})))});
      return{st:'ok',fmt,ver:MVP_DATA.version,meta:mvpMeta(fmt),mem:mem.map(m=>({no:m.x.no,src:m.S.src,item:m.S.calc.item||null,stone:m.stone,noItem:!!m.S.noItem,lg:mvpLegal(m.x.no)})),scen,wx,oppSkip:O.skip,unmapped:O.unmapped,
        /* 自動の型（推定）は攻撃技しか分からないので、役わりは攻撃技と特性だけ */
        abs:mem.map(m=>m.S.calc.ab||null),
        roles:mem.map(m=>mvpRoles(m.x.no,m.S.mv||(m.S.calc.moves||[]).map(v=>v&&v.id),m.S.calc.ab,m.stone)),
        dup:mvpDupItems(mem.map(m=>m.S.calc.item))}});
}
/* 6匹の持ち物の重なり（M-C：参加させるポケモンのうち2匹以上に同じ持ち物は不可） */
const mvpDupItems=items=>{const c={};items.filter(Boolean).forEach(k=>c[k]=(c[k]||0)+1);return Object.keys(c).filter(k=>c[k]>1).sort()};
/* 変更前と変更後を、同じメガの場合どうしで比べる */
/* i＝入れかえる枠（その枠の匹の数と、役わりの増減に使う。無ければ outNo/inNo の位置） */
function mvpCompare(E0,E1,outNo,inNo,i){
  const pairs=[],lost=[],added=[];
  const by1=new Map(E1.scen.map(s=>[s.key,s]));
  const used1=new Set();const pair=(a,b)=>{pairs.push([a,b]);used1.add(b)};
  E0.scen.forEach(s=>{
    if(by1.has(s.key)){pair(s,by1.get(s.key));return}
    /* 外す匹のメガの場合：入れる匹のメガの場合と比べる（P3-03）。入れる匹がメガでなければメガなしと比べる */
    if(s.key==='mega:'+outNo){lost.push(s);const t=by1.get('mega:'+inNo)||by1.get('none');if(t&&!used1.has(t))pair(s,t);return}
    if(s.key==='none'){const s1=by1.get('mega:'+inNo);if(s1)pair(s,s1)}});
  E1.scen.forEach(s=>{if(!E0.scen.some(z=>z.key===s.key)&&!used1.has(s))added.push(s)});
  if(E0.scen.length&&!pairs.length&&added.length)E0.scen.forEach(s=>added.forEach(a=>pairs.push([s,a])));
  const ix0=i!=null?i:E0.mem.findIndex(m=>m.no===outNo),ix1=i!=null?i:E1.mem.findIndex(m=>m.no===inNo);
  /* その枠の匹がしていたこと（P3-07）：1対1で有利・後出しして勝てる・2回耐えられる、を分けて数える */
  const slotCnt=(s,k)=>k<0?null:{adv:s.rows.filter(r=>r.z[k]&&r.z[k].r>=4).length,sw:s.rows.filter(r=>r.z[k]&&r.z[k].sw).length,recv:s.rows.filter(r=>r.z[k]&&r.z[k].recv).length,n:s.rows.length};
  const P=pairs.map(([a,b])=>{const ka=new Set(a.weak.map(w=>w.key)),kb=new Set(b.weak.map(w=>w.key));
    const fixed=a.weak.filter(w=>!kb.has(w.key)),made=b.weak.filter(w=>!ka.has(w.key));
    return{a,b,fixed,made,cf:fixed.filter(w=>w.crit).length,cm:made.filter(w=>w.crit).length,n0:a.weak.length,n1:b.weak.length,c1:b.weak.filter(w=>w.crit).length,
      slot:{a:slotCnt(a,ix0),b:slotCnt(b,ix1)}}});
  const megaB=E0.scen.some(s=>s.u>=0),megaA=E1.scen.some(s=>s.u>=0);
  /* 役わり（P3-04）：外す匹だけが持っていた役わりと、入れる匹が新しく加える役わり */
  let roles=null;
  if(E0.roles&&E1.roles&&ix0>=0&&ix1>=0){
    const has=(R,skip,k)=>R.some((rs,j)=>j!==skip&&rs.some(r=>r.k===k));
    /* 天気は、その天気で得をする特性（WX_GAIN）の仲間が残るときだけ大事な役わり（天気の効果そのものは1対1の計算に入っている） */
    const wxNeed=r=>r.k!=='weather'||(E1.abs||[]).some((a,j)=>j!==ix1&&(WX_GAIN[r.w]||[]).includes(a));
    roles={lost:E0.roles[ix0].filter(r=>!has(E1.roles,-1,r.k)).map(r=>({...r,sc:r.sc&&wxNeed(r)})),added:E1.roles[ix1].filter(r=>!has(E0.roles,-1,r.k))}}
  const roleLoss=!!(roles&&roles.lost.some(r=>r.sc));
  const cf=P.reduce((t,p)=>t+p.cf,0),cm=P.reduce((t,p)=>t+p.cm,0);
  /* おすすめ（better）にしない条件は足し算にしない：大きな弱点を増やす・弱点の数が増える・素早さの操作か天気を失う、のどれか1つでも tradeoff */
  const verdict=!P.length?'nocompare':cf===0?'none':cm===0&&P.every(p=>p.n1<=p.n0)&&!roleLoss?'better':'tradeoff';
  return{pairs:P,lost,added,lastMegaLost:megaB&&!megaA,megaAdded:!megaB&&megaA,cf,cm,verdict,roles,roleLoss,
    dup:E1.dup,worstC1:Math.max(0,...P.map(p=>p.c1)),net:P.reduce((t,p)=>t+p.fixed.length-p.made.length,0)};
}
/* 入れかえ案。opt.slots＝外してよい枠（なければ軸以外の全員）。候補は段階を追ってしぼる：
   ①同じ形式の PokéKit の行 ②M-C で使えると確認 ③パーティと同じ種類でない ④型が組める（持ち物が重ならない）
   ⑤いまのパーティの大きな弱点の相手に、有利か後出しできる ⑥上位 MVP_PRE 匹だけ、変更後の6匹を計算し直して比べる */
function mvpSwaps(entries,fmt,opt){
  opt=opt||{};fmt=fmt||FMT;
  if(!MVP_DATA.sets[fmt])return{st:'nodata',why:`${fmt==='double'?'ダブル':'シングル'}のデータが無い`};
  if(entries.length<6)return{st:'notfull'};
  const E0=mvpEvalTeam(entries,fmt);if(E0.st!=='ok')return E0;
  const R=mvpRows(fmt);
  const slots=(opt.slots&&opt.slots.length?opt.slots:entries.map((x,i)=>x.axis?-1:i)).filter(i=>i>=0);
  const crit=new Map();E0.scen.forEach(s=>s.weak.filter(w=>w.crit).forEach(w=>crit.set(w.op.key,w.op)));
  const fams=new Set(entries.map(x=>mvpFam(byNo[x.no])));
  const excluded=[];const pre=[];
  const seen=new Set();
  mvpCtx(entries,()=>[...R.rows].sort((a,b)=>a.rank-b.rank).forEach(r=>{
    const lg=mvpLegal(r.no),nm=byNo[r.mega||r.no]?byNo[r.mega||r.no].n:r.name;
    if(lg.st!=='ok'){excluded.push({n:nm,st:lg.st,why:lg.why});return}
    if(fams.has(mvpFam(byNo[r.no])))return;
    if(r.stone&&mvpStoneSt(r.stone,r.no)!=='ok'){excluded.push({n:nm,st:'unverified',why:`${ITEMN[r.stone]||r.stone}が M-C で使えるかは未確認`});return}
    const id=r.no+'|'+(r.stone||'');if(seen.has(id))return;seen.add(id);
    const S=mvpSet(fmt,r.no,{stone:r.stone});if(S.st!=='ok'){excluded.push({n:nm,st:S.st,why:S.why});return}
    let a;try{a=mkMon(byNo[r.no],'me',savedToCalc(r.no,S.sv))}catch(e){return}
    const sig='c:'+id+':'+JSON.stringify(S.sv);
    const O=mvpOpps(fmt);let hit=0;
    O.list.forEach(op=>{if(!crit.has(op.key))return;const z=mvpMatch(a,sig,op,E0.wx);if(z&&(z.r>=4||z.sw))hit++});
    if(hit)pre.push({r,S,nm,hit})}));
  pre.sort((x,y)=>y.hit-x.hit||x.r.no-y.r.no||(x.r.stone||'').localeCompare(y.r.stone||''));
  const cands=pre.slice(0,MVP_PRE);
  const res=[];
  const TS0=mvpTeamSets(entries,fmt);
  cands.forEach(c=>slots.forEach(i=>{
    const used=new Set(TS0.filter((_,k)=>k!==i).map(t=>t.item).filter(Boolean));
    const S=mvpSet(fmt,c.r.no,{stone:c.r.stone,used});
    if(S.st!=='ok'){res.push({i,c,S,st:S.st,outNo:entries[i].no});return}
    const nx=entries.map((x,k)=>k===i?{no:c.r.no,sel:!!x.sel,set:S.sv}:x);
    const E1=mvpEvalTeam(nx,fmt);if(E1.st!=='ok')return;
    const C=mvpCompare(E0,E1,entries[i].no,c.r.no,i);
    res.push({i,c,S,E1,C,st:C.verdict,outNo:entries[i].no})}));
  const ord=(x,y)=>y.C.cf-x.C.cf||x.C.worstC1-y.C.worstC1||y.C.net-x.C.net||x.c.r.no-y.c.r.no||x.i-y.i;
  const better=res.filter(x=>x.st==='better').sort(ord),trade=res.filter(x=>x.st==='tradeoff').sort(ord);
  return{st:'ok',fmt,E0,better,trade,conflict:res.filter(x=>x.st==='item_conflict'),excluded,
    pool:{rows:R.rows.length,unmapped:R.unmapped,pre:pre.length,checked:cands.length,slots},ver:MVP_DATA.version,meta:mvpMeta(fmt)};
}
/* 60-diag.js の dgSwapSet（パーティのチェック・改善案の入れかえ候補の型）用：確かめた型だけ。無ければ null（自動の型で埋めない） */
function mvpSwapSet(c,rest){
  const used=new Set(mvpTeamSets(rest,FMT).map(t=>t.item).filter(Boolean));
  const S=mvpSet(FMT,c.no,{used});if(S.st!=='ok')return null;
  return{sv:S.sv,src:'PokéKit',txt:`${mvpSrcTxt(FMT)}：${S.txt}${S.notes.length?'。'+S.notes.join('。'):''}（能力ポイントは仮定）`};
}
const mvpOk=no=>mvpLegal(no).st==='ok';
/* ほかの入口（パーティのチェック・改善案・敗因の診断）の入れかえ案を、この計算でも確かめる（2026/11/14 第3段階 P3-02）。
   入れかえ案の計算で新しい大きな弱点ができる案・素早さの操作か天気を失う案は ok:false（出さない）。
   この形式のデータが無い・6匹でないときは確かめない（ok:true・C:null。前と同じ動き）。E0 は同じパーティで使い回せる */
function mvpGate(entries,i,inEntry,E0){
  if(!MVP_DATA.sets[FMT]||entries.length<6)return{ok:true,C:null,E0:null};
  E0=E0||mvpEvalTeam(entries,FMT);if(E0.st!=='ok')return{ok:true,C:null,E0};
  const E1=mvpEvalTeam(entries.map((x,k)=>k===i?inEntry:x),FMT);if(E1.st!=='ok')return{ok:true,C:null,E0};
  const C=mvpCompare(E0,E1,entries[i].no,inEntry.no,i);return{ok:C.cm===0&&!C.roleLoss,C,E0};
}
const mvpGateWhy=C=>[C.cm?`入れかえ案の計算（相手：${mvpSrcTxt(FMT)}の上位${MVP_OPPN}匹・メガシンカは1匹ずつ）では新しい大きな弱点が${C.cm}件できる`:'',
  C.roleLoss?`パーティでその匹だけの${C.roles.lost.filter(r=>r.sc).map(r=>r.n).join('・')}を失う`:''].filter(Boolean).join('。');
/* ---- 画面（相性のいい仲間を探す：6匹そろったときの入れかえ案） ---- */
let MVP_TOK=0;
const mvpWkTxt=w=>`${esc(w.op.n)}：${MVP_WK[w.k]}`;
function mvpLimitsHTML(fmt){
  const m=mvpMeta(fmt);
  return `<details class="mvp-lim"><summary>この入れかえ案で見ていること・見ていないこと</summary><ul>
  <li><b>相手</b>：${esc(mvpSrcTxt(fmt))} の使用率の上位${MVP_OPPN}匹（集計の取得 ${esc(m?m.fetched:'')}）。ゲーム内の公式の集計ではありません。使われている数は強さの証拠ではありません。</li>
  <li><b>使えるか</b>：公式の「レギュレーションM-C」の参加できるポケモン（${esc(MVP_DATA.legal.fetched)} 取得）で確認できたポケモンだけを候補にします。メガストーンは公式ページで新しく使えると書かれた6つ以外は「未確認」として候補にしません。持ち物はゲームにある持ち物ですが、M-C で使えるかの一覧は確認していません。</li>
  <li><b>型</b>：同じ集計の、その匹の行で割合のいちばん高い特性・持ち物・技・性格（組み合わせとしての割合は集計にありません）。<b>能力ポイントは仮定</b>（攻撃側の能力32・素早さ32・HP2）。集計の振り方の数字は、チャンピオンズの能力ポイントと確かめていないので使っていません。</li>
  <li><b>3つを分けています</b>：「1対1で有利」（先に倒せる・耐えて倒せる）、「後出し」（交代で1発受けてから勝てる）、「受け」（いちばん痛い技でも半分未満）。1対1で勝てても、交代で安全に出せるとは限りません。</li>
  <li><b>役わり</b>：型の技と特性から、トリックルーム・おいかぜ・天気を変える特性・ねこだまし・このゆびとまれ等・設置技・設置技を消す技・壁・交代技・いかくを数えます。パーティでその匹だけが持つ役わりを失うときは案に書き、素早さの操作（トリックルーム・おいかぜ）と、天気で得をする特性（すいすい等）の仲間がいるときの天気を失う案はおすすめにしません（天気の効果そのものは1対1の計算に入っています）。役わりの効果そのもの（何ターン速くなるか等）や、役わりの重なりの良し悪しは計算していません。</li>
  <li><b>メガシンカ</b>：1回の対戦で1匹だけ。メガストーンを持つ匹ごとに、その1匹だけがメガシンカした場合を別々に計算しています。</li>
  <li><b>持ち物</b>：6匹で同じ持ち物は持てません。候補の持ち物が重なるときは、同じ集計にあるほかの持ち物だけを使い、無ければ出しません。</li>
  <li><b>選出</b>：どの3匹${fmt==='double'?'（4匹）':''}を出すかは計算していません（選出アシストで決めてください）。</li>
  ${fmt==='double'?'<li><b>ダブルで見ていないこと</b>：ねこだまし・おいかぜ・トリックルーム・範囲技の当たり方・このゆびとまれ等・まもるの読み合い・味方との組み合わせ。ダブルの評価は1対1の計算だけで、完成していません。</li>':''}
  <li>計算に入っていないもの：${esc(DG_NOTE)}</li></ul></details>`;
}
function mvpWeakHTML(E){
  const rows=E.scen.map(s=>{const c=s.weak.filter(w=>w.crit);
    return `<div class="mvp-sc"><b>${esc(s.label)}</b>${s.stoneSt==='unverified'?'<span class="mvp-tag mvp-unv">メガストーンは M-C で未確認</span>':''}${c.length?`<ul>${c.slice(0,6).map(w=>`<li>${mvpWkTxt(w)}</li>`).join('')}${c.length>6?`<li>ほか${c.length-6}件</li>`:''}</ul>`:'<p class="note">大きな弱点は見つかりませんでした（上位の相手に対して）。</p>'}</div>`}).join('');
  const dup=E.dup.length?`<p class="mvp-warn">持ち物が重なっています：${E.dup.map(k=>esc(ITEMN[k]||k)).join('・')}（M-C では2匹以上に同じ持ち物は持たせられません）</p>`:'';
  /* パーティの匹が M-C で使えるか（P3-06）。計算はするが、使えない・未確認であることを先に出す */
  const lgBad=E.mem.filter(m=>m.lg&&m.lg.st!=='ok');
  const lgw=lgBad.length?`<p class="mvp-warn">${lgBad.map(m=>`${esc(formInfo(byNo[m.no]).base)}は${m.lg.st==='unverified'?'M-C で使えるか未確認です':'公式の M-C の一覧にありません'}（${esc(m.lg.why||'')}）`).join('。')}。この匹を入れたままの計算は参考にとどめてください。</p>`:'';
  const est=E.mem.filter(m=>m.src==='auto').map(m=>esc(formInfo(byNo[m.no]).base)),noIt=E.mem.filter(m=>m.noItem).map(m=>esc(formInfo(byNo[m.no]).base)),pk=E.mem.filter(m=>m.src==='pokekit').map(m=>esc(formInfo(byNo[m.no]).base));
  return `<div class="mvp-weak"><h3>いまのパーティの大きな弱点</h3>${lgw}${rows}${dup}${pk.length?`<p class="note">${pk.join('・')}は育成が未登録なので、集計の型（推定。持ち物は6匹で重ならないように選んだもの）で計算しています。${noIt.length?`${noIt.join('・')}は集計の持ち物がほかの匹と重なるため、持ち物なしで計算しています。`:''}</p>`:''}${est.length?`<p class="note">${est.join('・')}は育成が未登録で集計の型も無いため、自動の型（推定）で計算しています。</p>`:''}</div>`;
}
function mvpCardHTML(x,k){
  const old=byNo[x.outNo!=null?x.outNo:team[x.i].no],c=byNo[x.c.r.no],C=x.C,S=x.S,meg=x.c.r.mega?byNo[x.c.r.mega]:null;
  const lst=(a,cls)=>a.length?`<ul class="${cls}">${a.slice(0,6).map(p=>`<li>${mvpWkTxt(p)}</li>`).join('')}${a.length>6?`<li>ほか${a.length-6}件</li>`:''}</ul>`:'';
  /* その枠の匹がしていたこと（P3-07）：3つを分けて、外す匹 → 入れる匹 */
  const slotTxt=p=>{const a=p.slot&&p.slot.a,b=p.slot&&p.slot.b;if(!a||!b)return '';
    return `<div class="mvp-slot">${esc(formInfo(old).base)} → ${esc(formInfo(meg||c).base)}（相手${a.n}匹のうち）：1対1で有利 ${a.adv}→${b.adv}匹・後出しして勝てる ${a.sw}→${b.sw}匹・2回耐えられる ${a.recv}→${b.recv}匹</div>`};
  const pr=C.pairs.map(p=>{const fx=p.fixed.filter(w=>w.crit);return `<div class="mvp-pair"><div class="mvp-pl">${esc(p.a.label)}${p.a.key!==p.b.key?` → ${esc(p.b.label)}`:''}：大きな弱点 ${p.a.weak.filter(w=>w.crit).length} → ${p.c1}件</div>${slotTxt(p)}${fx.length?`<div class="mvp-h">なくなる大きな弱点</div>${lst(fx,'mvp-up')}`:''}${p.made.length?`<div class="mvp-h">新しくできる弱点${p.made.some(w=>w.crit)?'（大きな弱点を含む）':'（大きな弱点ではない）'}</div>${lst(p.made,'mvp-dn')}`:''}</div>`}).join('');
  /* 役わりの増減（P3-04）。素早さの操作・天気を失うときはおすすめにしていない */
  const rl=C.roles&&C.roles.lost.length?`<div class="mvp-h">失われる役わり（パーティでこの匹だけが持っていたもの）</div><ul class="mvp-dn">${C.roles.lost.map(r=>`<li>${esc(r.n)}${r.sc?r.k==='weather'?'（この天気で得をする仲間がいるので、この案はおすすめに入れていません）':'（素早さの操作を失うので、この案はおすすめに入れていません）':''}</li>`).join('')}</ul>`:'';
  const ra=C.roles&&C.roles.added.length?`<div class="mvp-h">加わる役わり</div><ul class="mvp-up">${C.roles.added.map(r=>`<li>${esc(r.n)}</li>`).join('')}</ul>`:'';
  /* 比べる前の場合が無いメガの場合は、判定に入れていないことと、その場合の大きな弱点の数を出す */
  const addN=C.added.map(s=>`「${esc(s.label)}」の場合が増えます（この場合の大きな弱点${s.weak.filter(w=>w.crit).length}件。比べる前の場合が無いので、判定には入れていません）`);
  const warn=[C.lastMegaLost?'メガシンカできる匹がいなくなります':'',C.lost.length?`「${C.lost.map(s=>esc(s.label)).join('・')}」の場合がなくなります`:'',...addN,C.megaAdded?'メガシンカできる匹ができます':''].filter(Boolean);
  return `<div class="pr-c mvp-c"><div class="row pr-sw"><span class="av">${stamp(old)}</span><span class="pr-arrow">→</span><a class="av" href="#/p/${c.no}">${stamp(meg||c)}</a><div class="row-m"><div class="row-t">${k<3?`<span class="pr-rank">${k+1}</span>`:''}${esc(formInfo(old).base)} → ${nm(meg||c)}</div>
    <div class="chips"><span class="mvp-tag mvp-ok">M-C で使える（公式の一覧で確認）</span>${meg?'<span class="mvp-tag mvp-ok">メガストーンも公式で確認</span>':''}${x.S.row.itAlt?'<span class="mvp-tag">持ち物を2番目以降に</span>':''}</div></div></div>
    <div class="mvp-body">${pr}${rl}${ra}${warn.length?`<p class="mvp-warn">${warn.join('。')}</p>`:''}
    <details><summary>入れる型（データの出典）</summary><p class="note">${esc(S.txt)}${S.notes.length?'。'+esc(S.notes.join('。')):''}<br>能力ポイントは仮定（${esc(SN.map((n,q)=>S.sv.sp[q]?`${n}${S.sv.sp[q]}`:'').filter(Boolean).join('・'))}）。出典：${esc(mvpSrcTxt(FMT))}（集計の使用率${x.c.r.usage}%・順位${x.c.r.rank}位。使われている数は強さの証拠ではありません）</p></details></div>
    <div class="btns" style="padding:0 16px 12px"><button class="btn btn-s" data-mvsw="${x.i}:${x.c.r.no}:${x.c.r.stone||''}">入れかえる</button></div></div>`;
}
/* 計算して描く。古い計算の結果で新しい画面を上書きしない（MVP_TOK） */
function mvpSwapDraw(el,opt){
  if(!el)return;const tok=++MVP_TOK,fmt=FMT,sig=JSON.stringify([fmt,team.map(x=>[x.no,x.set||0,!!x.axis]),opt&&opt.slots||0]);
  el.innerHTML='<p class="empty">計算中…（6匹と入れかえ候補を、同じデータ・同じ形式で計算し直しています）</p>';
  setTimeout(()=>{if(tok!==MVP_TOK||!el.isConnected)return;
    let R;try{R=mvpSwaps(team.slice(),fmt,opt)}catch(e){R={st:'error',why:String(e&&e.message||e)}}
    if(tok!==MVP_TOK||!el.isConnected||sig!==JSON.stringify([FMT,team.map(x=>[x.no,x.set||0,!!x.axis]),opt&&opt.slots||0]))return;
    if(typeof evCount==='function'&&R.st==='ok')evCount('pair_done',sig);
    el.innerHTML=mvpResultHTML(R);mvpBind(el,opt)},30);
}
function mvpResultHTML(R){
  if(R.st!=='ok')return `<div class="mvp-none"><p class="note"><b>入れかえ案を計算できませんでした</b>：${esc(R.why||R.st)}。データが足りないときは、案を作りません。</p></div>`;
  const fmt=R.fmt,cards=R.better.map(mvpCardHTML).join('');
  const trade=R.trade.length?`<details class="mvp-trade"><summary>良くなるところと悪くなるところがある入れかえ（${R.trade.length}件・おすすめには入れていません）</summary>${R.trade.slice(0,6).map((x,k)=>mvpCardHTML(x,9)).join('')}</details>`:'';
  const exN=R.excluded.length+R.conflict.length;
  const ex=exN?`<details class="mvp-ex"><summary>比べなかった候補（${exN}件：M-C で未確認・データ不足・持ち物の重なり）</summary><ul>${[...R.excluded,...R.conflict.map(x=>({n:byNo[x.c.r.no].n,st:x.S.st,why:x.S.why}))].slice(0,40).map(x=>`<li>${esc(x.n)}：${esc({unverified:'未確認',illegal:'M-C の一覧に無い',nodata:'データ不足',insufficient:'データ不足',item_conflict:'持ち物が重なる'}[x.st]||x.st)}（${esc(x.why||'')}）</li>`).join('')}</ul></details>`:'';
  /* ダブルで見ていないこと（P3-08）：たたまずに出す */
  const dbl=fmt==='double'?`<p class="mvp-dbl"><b>ダブルの評価はまだ完成していません。</b>1匹ずつの1対1だけで比べていて、ねこだまし・おいかぜ・トリックルームの効果・範囲技の当たり方・このゆびとまれ・まもる・味方との組み合わせは計算に入っていません（おいかぜ・トリックルームを使える匹がいなくなることだけは知らせます）。</p>`:'';
  /* 評価していない相手（P3-09）：型が組めない相手は弱くないとみなさず、数と名前を出す */
  const sk=R.E0.oppSkip||[];
  const skip=sk.length?`<p class="note">集計の上位のうち、型が組めないため評価していない相手：${sk.length}匹（${esc(sk.slice(0,6).join('・'))}${sk.length>6?' ほか':''}）。この相手への強さ・弱さは分かりません。</p>`:'';
  return `${dbl}${mvpWeakHTML(R.E0)}${skip}
    <div class="sec"><h2>入れかえ案</h2><span style="font-size:12px;color:var(--dim)">${R.better.length?'大きな弱点を減らし、ほかが悪くならない順':''}</span></div>
    ${cards||'<p class="note">大きな弱点を減らして、ほかの大きな弱点を増やさない1匹の入れかえは見つかりませんでした。気になるポケモンを上で押すと、その枠だけで探します。</p>'}
    ${trade}${ex}${mvpLimitsHTML(fmt)}
    <p class="note" style="color:var(--mute)">データの版：${esc(R.ver)}。くわしく調べた候補 ${R.pool.checked}匹（集計の${R.pool.rows}匹から、M-C で使える・型が組める・いまの弱点の相手に有利か後出しできる匹にしぼった上位）。${R.pool.unmapped.length?`集計のうちサイトのポケモンに対応しない行 ${R.pool.unmapped.length}件（${esc(R.pool.unmapped.join('・'))}）は使っていません。`:''}</p>`;
}
function mvpBind(el,opt){
  el.querySelectorAll('[data-mvsw]').forEach(b=>b.onclick=async()=>{const [i,no,st]=b.dataset.mvsw.split(':');const ix=+i,n=+no;
    const x=team[ix];if(!x)return;
    const S=mvpSet(FMT,n,{stone:st||null,used:new Set(mvpTeamSets(team,FMT).filter((_,k)=>k!==ix).map(t=>t.item).filter(Boolean))});if(S.st!=='ok'){toast('この型は使えなくなりました');return}
    if(!await askConfirm({title:`${byNo[x.no].n}を${byNo[n].n}に入れかえますか？`,text:`${byNo[x.no].n}の育成は消えます。${byNo[n].n}には集計の型（${S.txt}。能力ポイントは仮定）が入ります。`,ok:'入れかえる',danger:false}))return;
    const old=byNo[x.no].n;prReplace(ix,n,S.sv);toast(`${old}を外して${byNo[n].n}を入れました`);prDraw();scrTo(0,0)});
}
