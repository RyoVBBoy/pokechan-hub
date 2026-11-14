/* ===================== 1匹から組む（2026/11/14 依頼主「Pokémon-Based Team Building」、docs/pokemon-team-building-audit.md） =====================
   1匹を選んだところから、①環境のパーティを見る ②こだわり条件で組む ③自分で組む の3つの道。3つは同じ下書き TB を見る。
   ・下書きはパーティとは別（localStorage pctb、端末だけ）。「パーティに入れる」で既存の useTeam（空いている枠へ・空きがなければ確かめてから）
   ・評価は入れかえ案と同じ 76-mvp.js（mvpEvalTeam・mvpCompare・mvpRoles）。新しい評価は作らない
   ・データの種類を分けて書く：上位パーティ（運営者が確認／本人の申告／記事から集めた）・PokéKit（Showdown の集計）・当サイトが組んだ理論上の型
   ・勝率・順位・使用率は作らない。ダブルは1対1の計算だけ（画面に書く） */
const TB_KEY='pctb';
const TB_SRC={pokekit:'集計の型（PokéKit・Showdown の集計）',theory:'当サイトが組んだ理論上の型',team:'上位パーティに登録された育成',user:'あなたが登録した育成',none:'育成なし（計算は推定の型）'};
const tbFam=no=>mvpFam(byNo[no]);
const tbBase=no=>{const p=byNo[no];return p&&p.base&&byNo[p.base]?p.base:no};
function tbLoad(){try{const o=JSON.parse(localStorage.getItem(TB_KEY)||'null');
  if(o&&o.v===1&&byNo[o.start]&&Array.isArray(o.mem)&&o.mem.length&&o.mem[0].no===o.start)return{...o,mem:o.mem.filter(x=>byNo[x.no]).slice(0,6),cond:{must:[],ng:[],mega:'auto',type:'auto',...(o.cond||{})}}}catch(e){}return null}
let TB=tbLoad(),TB_TOK=0,TB_HIST=[],TB_PROP=null,TB_FIND=null;
function tbSave(){if(!TB)return;try{TB.at=Date.now();localStorage.setItem(TB_KEY,JSON.stringify(TB))}catch(e){}}
const tbNew=no=>({v:1,start:no,fmt:FMT,mem:[{no,set:null,src:'none'}],cond:{must:[],ng:[],mega:'auto',type:'auto'},tab:'manual',at:Date.now()});
/* 変える前の形を覚えて「1つ前に戻す」 */
function tbPush(){TB_HIST.push(JSON.stringify(TB.mem));if(TB_HIST.length>10)TB_HIST.shift()}
const tbEntries=mem=>(mem||TB.mem).map(x=>({no:x.no,sel:false,...(x.set?{set:x.set}:{})}));
const tbSetTxt=s=>{if(!s)return '育成なし';const sp=Array.isArray(s.sp)?SN.map((n,i)=>s.sp[i]?`${n}${s.sp[i]}`:'').filter(Boolean).join('・'):'';
  return `特性 ${s.ab?esc(s.ab.n||ABN[s.ab.k]||''):'―'}／持ち物 ${s.it?esc(s.it.n||ITEMN[s.it.k]||''):'なし'}／性格 ${esc(natName(s.up,s.dn)||'補正なし')}${sp?`／能力ポイント ${esc(sp)}`:''}／技 ${(s.mv||[]).map(m=>esc(m.n||mName(m.id))).join('・')||'―'}`};
const tbFmtN=f=>f==='double'?'ダブル':'シングル';

/* ---- 型の確かめ（すべての案と追加で使う）：使えるか・メガストーン・持ち物の重なり・覚える技・能力ポイント（合計66・1つ32まで） ---- */
function tbValidate(mem){
  const notes=[],used=new Set(),out=[];
  mem.forEach(x=>{const p=byNo[x.no];if(!p){notes.push('図鑑に無いポケモンを外しました');return}
    const lg=mvpLegal(x.no);if(lg.st!=='ok')notes.push(`${p.n}：${lg.st==='unverified'?'M-C で使えるか未確認':'公式の M-C の一覧に無い'}（${lg.why||''}）`);
    let s=x.set?JSON.parse(JSON.stringify(x.set)):null;
    if(s){const it=s.it&&s.it.k;
      if(it&&isStone(it)){if(!megaOf(x.no,it)){notes.push(`${p.n}：持てないメガストーン（${ITEMN[it]||it}）を外しました`);s.it=null}
        else if(mvpStoneSt(it,x.no)!=='ok'){notes.push(`${p.n}：${ITEMN[it]||it}は M-C で使えるか未確認なので外しました（持ち物なし）`);s.it=null}}
      else if(it&&!CH_ITEMS.has(it)){notes.push(`${p.n}：ゲームに無い持ち物（${ITEMN[it]||it}）を外しました`);s.it=null}
      if(s.it&&used.has(s.it.k)){notes.push(`${p.n}：${s.it.n||ITEMN[s.it.k]}はほかの匹と重なるので外しました（同じ持ち物は2匹に持たせられません）`);s.it=null}
      if(s.it)used.add(s.it.k);
      const ls=(LSD[x.no]||[0,[]])[1],bad=(s.mv||[]).filter(m=>!(m.id===182||ls.includes(m.id)));
      if(bad.length){notes.push(`${p.n}：覚えない技（${bad.map(m=>m.n||mName(m.id)).join('・')}）を外しました`);s.mv=s.mv.filter(m=>!bad.includes(m))}
      if(Array.isArray(s.sp)&&(s.sp.some(v=>v>SP_CAP||v<0)||s.sp.reduce((a,b)=>a+b,0)>SP_TOTAL)){notes.push(`${p.n}：能力ポイントが決まり（合計${SP_TOTAL}・1つ${SP_CAP}まで）を超えるので外しました`);s.sp=null}}
    out.push({...x,set:s})});
  return{mem:out,notes};
}

/* ---- 入口 ---- */
async function tbView(arg){
  setHeader('1匹から組む','#/team');
  const n=+arg;
  if(n&&byNo[n]){const b=tbBase(n);
    if(TB&&TB.start!==b&&TB.mem.length>1&&!await askConfirm({title:'作りかけのパーティがあります',text:`「${byNo[TB.start].n}から組む」の作りかけ（${TB.mem.length}匹）を消して、${byNo[b].n}から始めますか？（保存したパーティは変わりません）`,ok:'新しく始める',danger:false})){}
    else if(!TB||TB.start!==b){TB=tbNew(b);TB_HIST=[];TB_PROP=null;TB_FIND=null;tbSave()}
    cur='#/tb';setUrl('#/tb')}
  tbDraw();
}
function tbDraw(){
  if(!TB){V.innerHTML=`<div class="tbd"><p class="note" style="padding:16px">まだ始めていません。最初の1匹を選ぶと、その1匹からパーティを組めます。</p><div class="btns" style="padding:0 16px"><button class="btn btn-p" id="tb-pick">${SVG(I.plus,16)}最初の1匹を選ぶ</button></div></div>`;
    document.getElementById('tb-pick').onclick=async()=>{const no=await pickMon(0);if(no)nav('#/tb/'+tbBase(no))};return}
  const st=byNo[TB.start],tab=['find','cond','manual'].includes(TB.tab)?TB.tab:'manual';
  const fmtWarn=TB.fmt!==FMT?`<div class="mvp-warn tbd-fmtw">このパーティは<b>${tbFmtN(TB.fmt)}</b>で作り始めました。いまの形式は<b>${tbFmtN(FMT)}</b>です。集計・計算は形式ごとに別なので、どちらで続けるか選んでください。
    <div class="btns"><button class="btn btn-s" data-tbfmt="${TB.fmt}">${tbFmtN(TB.fmt)}に戻す</button><button class="btn btn-s" data-tbfmt="keep">${tbFmtN(FMT)}で続ける</button></div></div>`:'';
  const tabs=[['find','① 環境のパーティを見る',`${esc(formInfo(st).base)}が入った上位パーティと、集計の型`],['cond','② こだわり条件で組む','条件を決めて、2つの考え方で案を作る'],['manual','③ 自分で組む','1匹ずつ選び、そのたびに分析と候補']];
  V.innerHTML=`<div class="tbd">
    <div class="tbd-head"><a class="av" href="#/p/${st.no}">${stamp(st)}</a><div class="row-m"><div class="row-t">${nm(st)}<span class="mvp-tag">最初の1匹</span></div>
      <div class="tbd-ctx">${tbFmtN(FMT)}・レギュレーション ${esc(MVP_DATA.legal.reg)}（公式の一覧 ${esc(MVP_DATA.legal.fetched)}）</div></div></div>
    ${fmtWarn}
    <div class="tbd-tabs" role="tablist">${tabs.map(([k,t,d])=>`<button role="tab" class="tbd-tab" data-tbtab="${k}" aria-selected="${tab===k}"><b>${t}</b><small>${d}</small></button>`).join('')}</div>
    <div id="tb-body"></div>
    <div class="tbd-bar"><div class="tbd-bar-m">${TB.mem.map(x=>`<span class="av">${stamp(byNo[x.no])}</span>`).join('')}<small>${TB.mem.length}/6匹</small></div>
      <button class="btn btn-p" id="tb-go">パーティに入れる</button></div></div>`;
  V.querySelectorAll('[data-tbtab]').forEach(b=>b.onclick=()=>{TB.tab=b.dataset.tbtab;tbSave();tbDraw()});
  V.querySelectorAll('[data-tbfmt]').forEach(b=>b.onclick=()=>{const v=b.dataset.tbfmt;if(v==='keep'){TB.fmt=FMT;TB_PROP=null;TB_FIND=null}else setFmt(v);tbSave();tbDraw()});
  document.getElementById('tb-go').onclick=()=>tbTransfer(TB.mem,`${formInfo(st).base}から組む`);
  const body=document.getElementById('tb-body');
  if(tab==='manual')tbManual(body);else if(tab==='find')tbFind(body);else tbCond(body);
}
/* パーティに入れる：既存の useTeam（空いている枠へ。空きがなければ確かめてから入れかえ）。育成は確かめてから */
async function tbTransfer(mem,name){
  if(!mem.length)return;
  const V2=tbValidate(mem);
  if(V2.notes.length&&!await askConfirm({title:'入れる前に直したところがあります',text:V2.notes.join('\n'),ok:'このまま入れる',danger:false}))return;
  await useTeam(name,V2.mem.map(x=>({no:x.no,set:x.set})));
}
const tbDblNote=()=>FMT==='double'?`<p class="mvp-dbl"><b>ダブルの評価はまだ完成していません。</b>1匹ずつの1対1だけで比べていて、ねこだまし・おいかぜ・トリックルームの効果・範囲技・このゆびとまれ・まもる・味方との組み合わせは計算に入っていません。</p>`:'';

/* ===================== ③ 自分で組む ===================== */
function tbManual(el){
  const tok=++TB_TOK;
  el.innerHTML=`${tbDblNote()}<div class="sec"><h2>あなたのパーティ（下書き）</h2>${TB_HIST.length?'<button class="btn btn-s tbd-undo" id="tb-undo">1つ前に戻す</button>':''}</div>
    <div class="tbd-slots">${Array.from({length:6},(_,i)=>{const x=TB.mem[i];if(!x)return `<button class="tbd-slot tbd-empty" data-tbadd="1">${SVG(I.plus,18)}<span>追加する</span></button>`;
      const p=byNo[x.no];return `<div class="tbd-slot"><a class="av" href="#/p/${p.no}">${stamp(p)}</a><b>${esc(formInfo(p).base)}</b><small>${i===0?'最初の1匹':esc(TB_SRC[x.src]||'')}</small>
        <div class="tbd-sbtn"><button class="btn btn-s" data-tbrep="${i}">入れかえ</button>${i?`<button class="btn btn-s" data-tbrm="${i}">外す</button>`:''}</div>
        <details class="tbd-set"><summary>育成</summary><p class="note">${tbSetTxt(x.set)}${x.set?`<br><small>${esc(TB_SRC[x.src]||'')}${x.srcTxt?'：'+esc(x.srcTxt):''}</small>`:''}</p></details></div>`}).join('')}</div>
    <div id="tb-an"><p class="empty">分析中…（いまの${TB.mem.length}匹を、入れかえ案と同じ計算で見ています）</p></div>
    <div id="tb-sug"></div>`;
  const un=document.getElementById('tb-undo');if(un)un.onclick=()=>{const s=TB_HIST.pop();if(s){TB.mem=JSON.parse(s);tbSave();tbDraw()}};
  el.querySelectorAll('[data-tbadd]').forEach(b=>b.onclick=()=>tbPickAdd(-1));
  el.querySelectorAll('[data-tbrep]').forEach(b=>b.onclick=()=>tbPickAdd(+b.dataset.tbrep));
  el.querySelectorAll('[data-tbrm]').forEach(b=>b.onclick=()=>{tbPush();TB.mem.splice(+b.dataset.tbrm,1);tbSave();tbDraw()});
  setTimeout(()=>{if(tok!==TB_TOK||!el.isConnected)return;
    let A;try{A=tbAnalyze(TB.mem)}catch(e){A={st:'error',why:String(e&&e.message||e)}}
    if(tok!==TB_TOK||!el.isConnected)return;
    document.getElementById('tb-an').innerHTML=tbAnalyzeHTML(A);
    setTimeout(()=>{if(tok!==TB_TOK||!el.isConnected)return;tbSugDraw(document.getElementById('tb-sug'),tok)},20)},30);
}
/* 追加（i<0）か入れかえ（i）。同じ種類（メガ・姿も同じ種類）は入れない。最初の1匹の入れかえは「最初の1匹から組み直す」 */
async function tbPickAdd(i){
  const no=await pickMon(0);if(!no)return;const b=tbBase(no);
  if(i===0){if(b!==TB.start)nav('#/tb/'+b);return}
  if(TB.mem.some((x,k)=>k!==i&&tbFam(x.no)===tbFam(b))){toast('同じ種類のポケモンはもう入っています');return}
  if(i<0&&TB.mem.length>=6){toast('6匹そろっています');return}
  const S=mvpSet(FMT,b,{used:new Set(TB.mem.filter((_,k)=>k!==i).map(x=>x.set&&x.set.it&&x.set.it.k).filter(Boolean))});
  const e={no:b,set:S.st==='ok'?S.sv:null,src:S.st==='ok'?'pokekit':'none',srcTxt:S.st==='ok'?`${mvpSrcTxt(FMT)}（能力ポイントは仮定）`:''};
  if(S.st!=='ok')toast(`${byNo[b].n}：集計の型が組めないので、育成なしで入れました（${S.why||S.st}）`);
  tbPush();if(i<0)TB.mem.push(e);else TB.mem[i]=e;tbSave();tbDraw();
}
/* いまの下書きの分析：入れかえ案と同じ評価（mvpEvalTeam）＋タイプの受け・役わり・素早さ */
function tbAnalyze(mem){
  if(!MVP_DATA.sets[FMT])return{st:'nodata',why:`${tbFmtN(FMT)}のデータが無い`};
  const ent=tbEntries(mem),E=mvpEvalTeam(ent,FMT);if(E.st!=='ok')return E;
  const ms=mem.map(x=>prMon({no:x.no,set:x.set})).filter(Boolean);
  const holes=prHoles(ms);
  const roles={};E.roles.forEach((rs,i)=>rs.forEach(r=>{(roles[r.k]=roles[r.k]||[]).push(i)}));
  const over=Object.entries(roles).filter(([k,v])=>v.length>=3).map(([k,v])=>({k,n:MVP_ROLES[k][0],who:v}));
  const miss=['trickroom','tailwind','pivot','hazclear','hazard'].filter(k=>!roles[k]).map(k=>MVP_ROLES[k][0]);
  const spd=mem.map((x,i)=>({i,p:ms[i]})).filter(z=>z.p).sort((a,b)=>b.p.s[5]-a.p.s[5]);
  return{st:'ok',E,holes,roles,over,miss,spd,mem};
}
function tbAnalyzeHTML(A){
  if(A.st!=='ok')return `<p class="note"><b>分析できませんでした</b>：${esc(A.why||A.st)}</p>`;
  const nmI=i=>esc(formInfo(byNo[A.mem[i].no]).base);
  const rl=Object.entries(A.roles).map(([k,v])=>`${esc(MVP_ROLES[k][0])}（${v.map(nmI).join('・')}）`).join('、');
  return `${mvpWeakHTML(A.E)}
    <div class="tbd-an2">
      <p><b>受けにくいタイプ</b>：${A.holes.length?A.holes.map(chip).join(''):'なし（2匹以上が弱点で、半減以下で受けられる匹がいないタイプはありません）'}</p>
      <p><b>役わり</b>（型の技と特性から）：${rl||'まだ見つかりません'}</p>
      ${A.miss.length?`<p class="note">まだいない役わり：${A.miss.map(esc).join('・')}（必ず要るわけではありません）</p>`:''}
      ${A.over.length?`<p class="note">3匹以上が同じ役わり：${A.over.map(o=>`${esc(o.n)}（${o.who.map(nmI).join('・')}）`).join('、')}</p>`:''}
      <p><b>素早さ</b>（種族値の速い順）：${A.spd.map(z=>`${nmI(z.i)} ${z.p.s[5]}`).join('・')}</p>
    </div>
    <p class="note" style="color:var(--mute)">相手は ${esc(mvpSrcTxt(FMT))} の使用率の上位${MVP_OPPN}匹。ゲーム内の公式の集計ではありません。メガシンカは1匹ずつの場合に分けて計算しています。</p>`;
}
/* ---- 候補（6匹未満）：PokéKit の型が組める・使えると確認できた匹を、入れたあとの6匹（いまの匹数＋1）で計算し直す ---- */
const TB_PRE=8;
function tbRowOf(fmt,no){const R=mvpRows(fmt);return R&&(R.rows.find(r=>r.no===no&&!r.stone)||R.rows.find(r=>r.no===no))||null}
/* 一緒に使われる仲間（PokéKit の tm）：いまの匹のだれかの使用者のうち、その候補も入れていた人の割合のいちばん高いもの */
function tbCo(fmt,mem,row){let best=null;mem.forEach(x=>{const r=tbRowOf(fmt,x.no);const t=r&&(r.tm||[]).find(([id])=>id===row.id);if(t&&(!best||t[1]>best.pc))best={pc:t[1],with:x.no}});return best}
function tbCands(mem,opt){
  opt=opt||{};const fmt=FMT,R=mvpRows(fmt);if(!R)return{st:'nodata',why:`${tbFmtN(fmt)}のデータが無い`};
  const ent=tbEntries(mem),E0=mvpEvalTeam(ent,fmt);if(E0.st!=='ok')return E0;
  const fams=new Set(mem.map(x=>tbFam(x.no))),ng=new Set((opt.ng||[]).map(tbFam));
  const used=new Set(mvpTeamSets(ent,fmt).map(t=>t.item).filter(Boolean));
  const crit=new Map();E0.scen.forEach(s=>s.weak.filter(w=>w.crit).forEach(w=>crit.set(w.op.key,w.op)));
  const O=mvpOpps(fmt),pre=[],seen=new Set();
  mvpCtx(ent,()=>[...R.rows].sort((a,b)=>a.rank-b.rank).forEach(r=>{
    if(mvpLegal(r.no).st!=='ok'||fams.has(tbFam(r.no))||ng.has(tbFam(r.no)))return;
    if(r.stone&&(mvpStoneSt(r.stone,r.no)!=='ok'||opt.noMega||(opt.megaOnly&&opt.megaOnly!==r.no)))return;
    const id=r.no+'|'+(r.stone||'');if(seen.has(id))return;seen.add(id);
    const S=mvpSet(fmt,r.no,{stone:r.stone,used});if(S.st!=='ok')return;
    let a;try{a=mkMon(byNo[r.no],'me',savedToCalc(r.no,S.sv))}catch(e){return}
    let hit=0;O.list.forEach(op=>{if(!crit.has(op.key))return;const z=mvpMatch(a,'c:'+id+':'+JSON.stringify(S.sv),op,E0.wx);if(z&&(z.r>=4||z.sw))hit++});
    pre.push({r,S,hit,co:tbCo(fmt,mem,r)})}));
  pre.sort((x,y)=>y.hit-x.hit||((y.co&&y.co.pc)||0)-((x.co&&x.co.pc)||0)||x.r.no-y.r.no||(x.r.stone||'').localeCompare(y.r.stone||''));
  const res=pre.slice(0,opt.n||TB_PRE).map(c=>{
    const nx=[...ent,{no:c.r.no,sel:false,set:c.S.sv}],E1=mvpEvalTeam(nx,fmt);if(E1.st!=='ok')return null;
    const C=mvpCompare(E0,E1,0,c.r.no);
    const addR=(E1.roles[E1.roles.length-1]||[]).filter(r=>!E0.roles.some(rs=>rs.some(z=>z.k===r.k)));
    const ovR=(E1.roles[E1.roles.length-1]||[]).map(r=>({r,who:E0.roles.map((rs,i)=>rs.some(z=>z.k===r.k)?i:-1).filter(i=>i>=0)})).filter(z=>z.who.length);
    const cw=prDef(prMon({no:c.r.no,set:c.S.sv})),ovT=mem.map((x,i)=>{const d=prDef(prMon({no:x.no,set:x.set}));return{i,t:T.filter(t=>cw[t]>=2&&d[t]>=2)}}).filter(z=>z.t.length);
    return{...c,E1,C,addR,ovR,ovT}}).filter(Boolean);
  /* 並べ方（理由をそのまま書ける順）：新しい大きな弱点を作らない→減る大きな弱点が多い→残る大きな弱点が少ない→一緒に使われる割合→図鑑番号 */
  res.sort((x,y)=>(x.C.cm>0)-(y.C.cm>0)||y.C.cf-x.C.cf||x.C.worstC1-y.C.worstC1||((y.co&&y.co.pc)||0)-((x.co&&x.co.pc)||0)||x.r.no-y.r.no);
  return{st:'ok',E0,res,pre:pre.length,rows:R.rows.length};
}
function tbSugDraw(el,tok){
  if(!el)return;
  if(TB.mem.length>=6){el.innerHTML='<p class="empty">6匹そろいました。入れかえ案を計算中…</p>';
    setTimeout(()=>{if(tok!==TB_TOK||!el.isConnected)return;let R;try{R=mvpSwaps(tbEntries(),FMT)}catch(e){R={st:'error',why:String(e&&e.message||e)}}
      if(tok!==TB_TOK||!el.isConnected)return;el.innerHTML=`<div class="sec"><h2>6匹の入れかえ案</h2></div>`+mvpResultHTML(R).replace(/<p class="mvp-dbl">[\s\S]*?<\/p>/,'');
      el.querySelectorAll('[data-mvsw]').forEach(b=>b.onclick=async()=>{const [i,no,st]=b.dataset.mvsw.split(':');const ix=+i,n=+no;if(!TB.mem[ix])return;
        if(ix===0){toast('最初の1匹は入れかえません');return}
        const S=mvpSet(FMT,n,{stone:st||null,used:new Set(TB.mem.filter((_,k)=>k!==ix).map(x=>x.set&&x.set.it&&x.set.it.k).filter(Boolean))});if(S.st!=='ok'){toast('この型は使えなくなりました');return}
        if(!await askConfirm({title:`${byNo[TB.mem[ix].no].n}を${byNo[n].n}に入れかえますか？`,text:'「1つ前に戻す」で戻せます。',ok:'入れかえる',danger:false}))return;
        tbPush();TB.mem[ix]={no:n,set:S.sv,src:'pokekit',srcTxt:`${mvpSrcTxt(FMT)}（能力ポイントは仮定）`};tbSave();tbDraw()})},30);return}
  el.innerHTML='<p class="empty">候補を計算中…</p>';
  let R;try{R=tbCands(TB.mem)}catch(e){R={st:'error',why:String(e&&e.message||e)}}
  if(tok!==TB_TOK||!el.isConnected)return;
  if(R.st!=='ok'){el.innerHTML=`<p class="note"><b>候補を計算できませんでした</b>：${esc(R.why||R.st)}</p>`;return}
  const nmI=i=>esc(formInfo(byNo[TB.mem[i].no]).base);
  el.innerHTML=`<div class="sec"><h2>次に入れる候補</h2><span style="font-size:12px;color:var(--dim)">新しい大きな弱点を作らない→減る大きな弱点が多い順</span></div>
    ${R.res.map((c,k)=>{const p=byNo[c.r.mega||c.r.no],C=c.C;const fx=C.pairs.flatMap(z=>z.fixed.filter(w=>w.crit)),mk=C.pairs.flatMap(z=>z.made);
      return `<div class="pr-c tbd-c"><div class="row"><a class="av" href="#/p/${p.no}">${stamp(p)}</a><div class="row-m"><div class="row-t">${nm(p)}</div>
        <div class="chips"><span class="mvp-tag mvp-ok">M-C で使える（公式の一覧で確認）</span>${C.cm?'<span class="mvp-tag mvp-unv">新しい大きな弱点あり</span>':''}</div></div></div>
        <div class="mvp-body">${C.pairs.map(z=>`<div class="mvp-pl">${esc(z.b.label)}：大きな弱点 ${z.a.weak.filter(w=>w.crit).length} → ${z.c1}件</div>`).join('')}
          ${fx.length?`<div class="mvp-h">なくなる大きな弱点（この候補が解決する問題）</div><ul class="mvp-up">${fx.slice(0,5).map(w=>`<li>${mvpWkTxt(w)}</li>`).join('')}${fx.length>5?`<li>ほか${fx.length-5}件</li>`:''}</ul>`:''}
          ${mk.length?`<div class="mvp-h">新しくできる弱点</div><ul class="mvp-dn">${mk.slice(0,4).map(w=>`<li>${mvpWkTxt(w)}${w.crit?'（大きな弱点）':''}</li>`).join('')}${mk.length>4?`<li>ほか${mk.length-4}件</li>`:''}</ul>`:''}
          ${c.addR.length?`<p class="note">加わる役わり：${c.addR.map(r=>esc(r.n)).join('・')}</p>`:''}
          ${c.ovR.length||c.ovT.length?`<p class="note">重なり：${[...c.ovR.map(z=>`${esc(z.r.n)}（${z.who.map(nmI).join('・')}と同じ）`),...c.ovT.map(z=>`${z.t.join('・')}が弱点（${nmI(z.i)}と同じ）`)].join('、')}</p>`:''}
          ${c.co?`<p class="note">一緒に使われる割合：${nmI(TB.mem.findIndex(x=>x.no===c.co.with))}の使用者の${c.co.pc}%（Showdown の集計。強さの証拠ではありません）</p>`:''}
          <details class="tbd-set"><summary>入れる型（データの出典）</summary><p class="note">${esc(c.S.txt)}${c.S.notes.length?'。'+esc(c.S.notes.join('。')):''}<br>能力ポイントは仮定。出典：${esc(mvpSrcTxt(FMT))}</p></details>
          <div class="tbd-cmp" id="tb-cmp${k}"></div></div>
        <div class="btns" style="padding:0 16px 12px"><button class="btn btn-p btn-s" data-tbin="${k}">追加する</button>${TB.mem.length>1?`<button class="btn btn-s" data-tbvs="${k}">いまの匹と比べる</button>`:''}</div></div>`}).join('')||'<p class="note">候補が見つかりませんでした。</p>'}
    <p class="note" style="color:var(--mute)">くわしく比べた候補 ${R.res.length}匹（集計の${R.rows}匹から、M-C で使える・型が組める・持ち物が重ならない匹を、いまの大きな弱点の相手に有利か後出しできる数で並べた上位）。勝率ではありません。</p>`;
  el.querySelectorAll('[data-tbin]').forEach(b=>b.onclick=()=>{const c=R.res[+b.dataset.tbin];if(TB.mem.length>=6)return;
    tbPush();TB.mem.push({no:c.r.no,set:c.S.sv,src:'pokekit',srcTxt:`${mvpSrcTxt(FMT)}（能力ポイントは仮定）`});tbSave();tbDraw()});
  el.querySelectorAll('[data-tbvs]').forEach(b=>b.onclick=()=>{const k=+b.dataset.tbvs,c=R.res[k],box=document.getElementById('tb-cmp'+k);
    box.innerHTML=`<p class="note">どの匹と比べますか？</p><div class="btns">${TB.mem.map((x,i)=>i?`<button class="btn btn-s" data-tbvi="${i}">${nmI(i)}</button>`:'').join('')}</div><div class="tbd-cmpr"></div>`;
    box.querySelectorAll('[data-tbvi]').forEach(q=>q.onclick=()=>{const i=+q.dataset.tbvi,out=box.querySelector('.tbd-cmpr');
      const nx=tbEntries().map((x,j)=>j===i?{no:c.r.no,sel:false,set:c.S.sv}:x),E1=mvpEvalTeam(nx,FMT),C=mvpCompare(R.E0,E1,TB.mem[i].no,c.r.no,i);
      out.innerHTML=mvpCardHTML({i,outNo:TB.mem[i].no,c,S:c.S,C,E1},9).replace(/<div class="btns"[\s\S]*$/,'</div></div>')+`<div class="btns"><button class="btn btn-s" data-tbsw="${i}">${nmI(i)}と入れかえる</button></div>`;
      out.querySelector('[data-tbsw]').onclick=()=>{tbPush();TB.mem[i]={no:c.r.no,set:c.S.sv,src:'pokekit',srcTxt:`${mvpSrcTxt(FMT)}（能力ポイントは仮定）`};tbSave();tbDraw()}})});
}

/* ===================== ① 環境のパーティを見る ===================== */
/* 上位パーティ（サーバーの seasons）：出典の種類を分ける。勝率・順位は作らない */
const TB_CAT={chk:['確認済み','ランクバトルの最終順位の登録で、運営者が証拠を確認したもの'],self:['本人の申告','ランクバトルの最終順位の登録（運営者の確認はまだ）'],auto:['記事から集めた','公開された記事から、2つ以上の出典で一致した事実（6匹・順位など）だけを集めたもの']};
const tbCatOf=t=>t.verified||t.by_admin?'chk':t.auto?'auto':'self';
async function tbFindLoad(fmt){
  const ss=((await authFetch('/api/seasons')).seasons||[]).filter(s=>s.n>0).slice(0,4),out=[];
  for(const s of ss){let j;try{j=await authFetch(`/api/seasons/${s.id}/teams?fmt=${fmt}`)}catch(e){continue}
    (j.teams||[]).forEach(t=>out.push({...t,season:s.name,sid:s.id,team:(t.team||[]).filter(x=>byNo[x.no])}))}
  return{fmt,seasons:ss.map(s=>({id:s.id,name:s.name})),teams:out,at:Date.now()};
}
function tbFind(el){
  const tok=++TB_TOK,fmt=FMT,st=byNo[TB.start],f=tbFam(TB.start);
  el.innerHTML=`${tbDblNote()}<div id="tb-teams"><p class="empty">上位パーティを読み込み中…</p></div><div id="tb-sets"></div>`;
  document.getElementById('tb-sets').innerHTML=tbSetsHTML(fmt);
  tbSetsBind(document.getElementById('tb-sets'));
  const box=document.getElementById('tb-teams');
  const draw=()=>{if(tok!==TB_TOK||!box.isConnected)return;const D=TB_FIND;
    if(D.err){box.innerHTML=`<div class="sec"><h2>${esc(formInfo(st).base)}が入った上位パーティ</h2></div><p class="note">上位パーティを読み込めませんでした（${esc(D.err)}）。下の集計の型は使えます。</p><div class="btns" style="padding:0 16px"><button class="btn btn-s" id="tb-fr">もう一度読む</button></div>`;
      document.getElementById('tb-fr').onclick=()=>{TB_FIND=null;tbFind(el)};return}
    const all=D.teams.filter(t=>t.team.some(x=>tbFam(x.no)===f));
    const flt=TB.fflt||{cat:'all',sid:'all'};
    const list=all.filter(t=>(flt.cat==='all'||tbCatOf(t)===flt.cat)&&(flt.sid==='all'||String(t.sid)===String(flt.sid)));
    const sIdx=new Map(D.seasons.map((s,i)=>[s.id,i]));
    list.sort((a,b)=>sIdx.get(a.sid)-sIdx.get(b.sid)||(a.rank==null)-(b.rank==null)||(a.rank||0)-(b.rank||0)||(b.rate||0)-(a.rate||0)||a.id-b.id);
    TB_FIND.list=list;
    box.innerHTML=`<div class="sec"><h2>${esc(formInfo(st).base)}が入った上位パーティ</h2><span style="font-size:12px;color:var(--dim)">${tbFmtN(fmt)}・${all.length}件</span></div>
      <p class="note">当サイトの「上位パーティ」に登録されたパーティです。並びは、新しいシーズン→順位→レート（強さの点数はつけていません）。大会の結果は区別して持っていません。</p>
      <div class="pills tbd-flt">${[['all','すべて'],...Object.entries(TB_CAT).map(([k,v])=>[k,v[0]])].map(([k,t])=>`<button class="pill" data-tbcat="${k}" aria-pressed="${flt.cat===k}">${t}</button>`).join('')}</div>
      ${D.seasons.length>1?`<div class="pills tbd-flt">${[['all','全シーズン'],...D.seasons.map(s=>[String(s.id),s.name])].map(([k,t])=>`<button class="pill" data-tbsid="${esc(k)}" aria-pressed="${String(flt.sid)===k}">${esc(t)}</button>`).join('')}</div>`:''}
      ${list.length?list.slice(0,30).map((t,k)=>tbTeamCard(t,k)).join(''):`<p class="note" style="padding:8px 16px">${all.length?'この絞り込みに合うパーティはありません。':`${esc(formInfo(st).base)}が入った${tbFmtN(fmt)}の上位パーティは、まだ登録されていません。下の集計の型と仲間の割合を参考にするか、②・③で組んでください。`}</p>`}`;
    box.querySelectorAll('[data-tbcat]').forEach(b=>b.onclick=()=>{TB.fflt={...flt,cat:b.dataset.tbcat};tbSave();draw()});
    box.querySelectorAll('[data-tbsid]').forEach(b=>b.onclick=()=>{TB.fflt={...flt,sid:b.dataset.tbsid};tbSave();draw()});
    box.querySelectorAll('[data-tbopen]').forEach(b=>b.onclick=()=>{const t=list[+b.dataset.tbopen];tbLoadTeam(t.team.map(x=>({no:x.no,set:cleanSet(x.set)||null,src:'team',srcTxt:`${t.season}・${TB_CAT[tbCatOf(t)][0]}`})),`${t.season}の上位パーティ`)});
    box.querySelectorAll('[data-tbuse]').forEach(b=>b.onclick=()=>{const t=list[+b.dataset.tbuse];tbTransfer(t.team.map(x=>({no:x.no,set:cleanSet(x.set)||null})),`${t.season}・${t.rank?t.rank+'位':''}`)});
    box.querySelectorAll('[data-tbcalc]').forEach(b=>b.onclick=()=>{const t=list[+b.dataset.tbcalc],o=document.getElementById('tb-tc'+b.dataset.tbcalc);
      let A;try{A=tbAnalyze(t.team.map(x=>({no:x.no,set:cleanSet(x.set)||null})))}catch(e){A={st:'error',why:String(e)}}
      o.innerHTML=`<p class="note"><b>当サイトの分析</b>（登録した人の考えではありません）</p>`+tbAnalyzeHTML(A);b.remove()});
  };
  if(TB_FIND&&TB_FIND.fmt===fmt&&(TB_FIND.teams||TB_FIND.err)){draw();return}
  tbFindLoad(fmt).then(D=>{TB_FIND=D;draw()}).catch(e=>{TB_FIND={fmt,err:String(e&&e.message||e)};draw()});
}
function tbTeamCard(t,k){
  const c=tbCatOf(t),me=t.team.find(x=>tbFam(x.no)===tbFam(TB.start));const ms=cleanSet(me&&me.set);
  const res=[t.rank?`最終${t.rank}位`:'',t.rate?`レート${t.rate}`:''].filter(Boolean).join('・');
  return `<div class="pr-c tbd-c"><div class="tbd-tt"><span class="mvp-tag ${c==='chk'?'mvp-ok':''}" title="${esc(TB_CAT[c][1])}">${TB_CAT[c][0]}</span><b>${esc(t.season)}</b>${res?`<span>${esc(res)}${c==='self'?'（申告）':''}</span>`:''}</div>
    <div class="tbd-six">${t.team.map(x=>`<a class="av" href="#/p/${x.no}" title="${esc(byNo[x.no].n)}">${stamp(byNo[x.no])}</a>`).join('')}</div>
    <details class="tbd-set"><summary>くわしく（6匹の育成・出典）</summary>
      <p class="note">${esc(TB_CAT[c][1])}。${c==='auto'&&t.sources&&t.sources.length?`出典：${t.sources.map(u=>`<a href="${esc(safeUrl(u))}" target="_blank" rel="noopener nofollow">${esc(u.replace(/^https?:\/\//,'').slice(0,40))}</a>`).join('／')}`:''}</p>
      <ul class="tbd-mem">${t.team.map(x=>{const s=cleanSet(x.set),known=s&&(s.mv.length||s.it||s.ab);return `<li><b>${esc(byNo[x.no].n)}</b>：${known?tbSetTxt(s):'育成の登録なし'}</li>`}).join('')}</ul>
      ${t.comment?`<p class="note"><b>登録した人のひとこと</b>：<span data-notr>${esc(t.comment)}</span></p>`:''}
      <p class="note">${esc(formInfo(byNo[TB.start]).base)}の育成：${ms&&(ms.mv.length||ms.it)?tbSetTxt(ms):'登録なし'}${ms&&ms.mv.length?`。型から分かる役わり：${mvpRoles(me.no,ms.mv.map(m=>m.id),ms.ab&&ms.ab.k,ms.it&&ms.it.k).map(r=>esc(r.n)).join('・')||'特になし'}（当サイトの読み取り）`:''}</p>
      <div id="tb-tc${k}"><button class="btn btn-s" data-tbcalc="${k}">このパーティを当サイトの計算で見る</button></div></details>
    <div class="btns" style="padding:0 16px 12px"><button class="btn btn-s" data-tbopen="${k}">③ 自分で組むで開く</button><button class="btn btn-s" data-tbuse="${k}">パーティに入れる</button></div></div>`;
}
/* 最初の1匹の集計の型（PokéKit・形式ごと）と一緒に使われる仲間 */
function tbSetsHTML(fmt){
  const R=mvpRows(fmt),st=byNo[TB.start],m=mvpMeta(fmt);if(!R||!m)return `<p class="note">${tbFmtN(fmt)}の集計のデータがありません。</p>`;
  const rows=R.rows.filter(r=>r.no===TB.start);
  const sets=rows.map(r=>{const S=mvpSet(fmt,r.no,{stone:r.stone,anyLegal:true,anyMv:true});const p=byNo[r.mega||r.no];
    const unv=r.stone&&mvpStoneSt(r.stone,r.no)!=='ok';
    return `<div class="pr-c tbd-c"><div class="row"><span class="av">${stamp(p)}</span><div class="row-m"><div class="row-t">${nm(p)}</div><div class="chips"><span class="mvp-tag">使用率 ${r.usage}%・${r.rank}位（Showdown）</span>${unv?'<span class="mvp-tag mvp-unv">メガストーンは M-C で未確認</span>':''}</div></div></div>
      <p class="note" style="padding:0 16px 10px">${S.st==='ok'?esc(S.txt)+'。能力ポイントは集計に無い（仮定で計算）':'この行からは型を組めません（'+esc(S.why||S.st)+'）'}</p></div>`}).join('');
  const base=rows.find(r=>!r.stone)||rows[0];
  const tm=(base&&base.tm||[]).map(([id,pc])=>{const z=R.rows.find(r=>r.id===id);return z?{z,pc}:null}).filter(Boolean).slice(0,10);
  return `<div class="sec"><h2>${esc(formInfo(st).base)}の集計の型</h2></div>
    <p class="note">出典：${esc(mvpSrcTxt(fmt))}（取得 ${esc(m.fetched)}）。<b>Pokémon Showdown の集計で、ゲーム内の公式の集計ではありません。</b>型は、項目ごとにいちばん多いものを組み合わせたもので、この組み合わせのまま使われているとは限りません。</p>
    ${sets||`<p class="note">${esc(formInfo(st).base)}は${tbFmtN(fmt)}の集計の上位150匹に入っていません。</p>`}
    ${tm.length?`<div class="sec"><h2>一緒に使われる仲間</h2></div><p class="note">${esc(formInfo(st).base)}を使った人のうち、その仲間も入れていた人の割合です（Showdown の集計）。<b>6匹のパーティではありません</b>。よく使われることは強さの証拠ではありません。</p>
      <ul class="tbd-tm">${tm.map(({z,pc})=>{const p=byNo[z.mega||z.no],lg=mvpLegal(z.no).st;return `<li><span class="av">${stamp(p)}</span><span>${esc(p.n)}</span><b>${pc}%</b>${lg==='ok'&&!TB.mem.some(x=>tbFam(x.no)===tbFam(z.no))&&TB.mem.length<6?`<button class="btn btn-s" data-tbtm="${z.no}" data-tbst="${z.stone||''}">③に追加</button>`:lg!=='ok'?'<small>M-C で未確認</small>':''}</li>`}).join('')}</ul>`:''}`;
}
function tbSetsBind(el){el.querySelectorAll('[data-tbtm]').forEach(b=>b.onclick=()=>{const no=+b.dataset.tbtm,st=b.dataset.tbst||null;
  if(st&&mvpStoneSt(st,no)!=='ok'){toast('このメガストーンは M-C で使えるか未確認です');return}
  if(TB.mem.length>=6||TB.mem.some(x=>tbFam(x.no)===tbFam(no)))return;
  const S=mvpSet(FMT,no,{stone:st,used:new Set(TB.mem.map(x=>x.set&&x.set.it&&x.set.it.k).filter(Boolean))});
  tbPush();TB.mem.push({no,set:S.st==='ok'?S.sv:null,src:S.st==='ok'?'pokekit':'none',srcTxt:S.st==='ok'?`${mvpSrcTxt(FMT)}（能力ポイントは仮定）`:''});tbSave();toast(`${byNo[no].n}を③の下書きに入れました`);tbDraw()})}
/* ①②の案を③の下書きに入れる（いまの下書きに2匹以上いれば確かめる） */
async function tbLoadTeam(mem,label){
  if(!mem.some(x=>tbFam(x.no)===tbFam(TB.start))){toast('最初の1匹が入っていません');return}
  if(TB.mem.length>1&&!await askConfirm({title:'下書きを入れかえますか？',text:`③の下書き（${TB.mem.length}匹）を「${label}」に入れかえます。「1つ前に戻す」で戻せます。保存したパーティは変わりません。`,ok:'入れかえる',danger:false}))return;
  const st=mem.find(x=>tbFam(x.no)===tbFam(TB.start));const rest=mem.filter(x=>x!==st);
  tbPush();TB.mem=[{...st,no:TB.start},...rest].slice(0,6);TB.tab='manual';tbSave();tbDraw();scrTo(0,0);
}

/* ===================== ② こだわり条件で組む ===================== */
/* 必ず守る条件：入れたい匹（最初の1匹＋2匹まで）・入れたくない匹・メガシンカ（おまかせ／なし／この匹）。できれば守る条件：構築のタイプ */
function tbCondCheck(c){
  const err=[],all=[TB.start,...c.must];
  all.forEach(no=>{const lg=mvpLegal(no);if(lg.st!=='ok')err.push(`${byNo[no].n}は${lg.st==='unverified'?'M-C で使えるか未確認です':'公式の M-C の一覧にありません'}（${lg.why||''}）。入れたい匹から外してください。`)});
  const fams=all.map(tbFam);if(new Set(fams).size!==fams.length)err.push('同じ種類のポケモンが入れたい匹に2回入っています。');
  c.ng.forEach(no=>{if(fams.includes(tbFam(no)))err.push(`${byNo[no].n}は「入れたい匹」と「入れたくない匹」の両方に入っています。どちらかから外してください。`)});
  if(c.mega&&c.mega.startsWith('must:')){const no=+c.mega.slice(5);const ks=Object.keys(MEGA).filter(k=>MEGA[k][no]);
    if(!all.includes(no))err.push('メガシンカさせたい匹が、入れたい匹に入っていません。');
    else if(!ks.length)err.push(`${byNo[no].n}はメガシンカできません。`);
    else if(!ks.some(k=>mvpStoneSt(k,no)==='ok'))err.push(`${byNo[no].n}のメガストーン（${ks.map(k=>ITEMN[k]||k).join('・')}）は、M-C で使えるか確認できていません（公式ページで確認できたのは${MVP_DATA.legal.newMegas.join('・')}だけ）。メガシンカを「おまかせ」か「なし」にしてください。`)}
  return err;
}
function tbCond(el){
  const c=TB.cond,nmN=no=>esc(byNo[no].n);
  const megaOpt=[['auto','おまかせ（確認できたメガストーンだけ）'],['none','メガシンカなし'],...[TB.start,...c.must].filter(no=>Object.keys(MEGA).some(k=>MEGA[k][no])).map(no=>['must:'+no,`${byNo[no].n}をメガシンカさせる`])];
  const types=KD_TYPES.map(t=>[t[0],t[1]]);
  el.innerHTML=`${tbDblNote()}<div class="tbd-cond">
    <div class="sec"><h2>必ず守る条件</h2></div>
    <div class="tbd-cr"><b>入れたい匹</b><div class="tbd-cl"><span class="mvp-tag">${nmN(TB.start)}（最初の1匹）</span>${c.must.map(no=>`<span class="mvp-tag">${nmN(no)}<button class="tbd-x" data-tbmust-rm="${no}" aria-label="${nmN(no)}を外す">×</button></span>`).join('')}${c.must.length<2?'<button class="btn btn-s" id="tb-must">追加</button>':''}</div></div>
    <div class="tbd-cr"><b>入れたくない匹</b><div class="tbd-cl">${c.ng.map(no=>`<span class="mvp-tag">${nmN(no)}<button class="tbd-x" data-tbng-rm="${no}" aria-label="${nmN(no)}を外す">×</button></span>`).join('')||'<small>なし</small>'}${c.ng.length<10?'<button class="btn btn-s" id="tb-ng">追加</button>':''}</div></div>
    <div class="tbd-cr"><b>メガシンカ</b><select id="tb-mega">${megaOpt.map(([k,t])=>`<option value="${k}"${c.mega===k?' selected':''}>${esc(t)}</option>`).join('')}</select></div>
    <div class="sec"><h2>できれば守る条件</h2></div>
    <div class="tbd-cr"><b>構築のタイプ</b><select id="tb-type">${types.map(([k,t])=>`<option value="${k}"${c.type===k?' selected':''}>${esc(t)}</option>`).join('')}</select></div>
    <p class="note">「必ず守る条件」は外しません。守れないときは理由を出して止めます。「できれば守る条件」は、守れなかったときに案の中で知らせます。</p>
    <div class="btns" style="padding:0 16px"><button class="btn btn-p" id="tb-run">この条件で2つの案を作る</button></div>
    <div id="tb-prop">${TB_PROP&&TB_PROP.sig===tbCondSig()?tbPropHTML(TB_PROP):''}</div></div>`;
  const re=()=>{TB_PROP=null;tbSave();tbDraw()};
  const pm=document.getElementById('tb-must');if(pm)pm.onclick=async()=>{const no=await pickMon(0);if(!no)return;const b=tbBase(no);if(b===TB.start||c.must.includes(b))return;c.must.push(b);re()};
  const pn=document.getElementById('tb-ng');if(pn)pn.onclick=async()=>{const no=await pickMon(0);if(!no)return;const b=tbBase(no);if(!c.ng.includes(b))c.ng.push(b);re()};
  el.querySelectorAll('[data-tbmust-rm]').forEach(b=>b.onclick=()=>{c.must=c.must.filter(n=>n!==+b.dataset.tbmustRm);if(c.mega==='must:'+b.dataset.tbmustRm)c.mega='auto';re()});
  el.querySelectorAll('[data-tbng-rm]').forEach(b=>b.onclick=()=>{c.ng=c.ng.filter(n=>n!==+b.dataset.tbngRm);re()});
  document.getElementById('tb-mega').onchange=e=>{c.mega=e.target.value;re()};
  document.getElementById('tb-type').onchange=e=>{c.type=e.target.value;re()};
  document.getElementById('tb-run').onclick=()=>tbPropRun(document.getElementById('tb-prop'));
  tbPropBind(document.getElementById('tb-prop'));
}
const tbCondSig=()=>JSON.stringify([FMT,TB.start,TB.cond]);
function tbPropRun(box){
  const err=tbCondCheck(TB.cond);
  if(err.length){box.innerHTML=`<div class="mvp-warn"><b>この条件では組めません</b><ul>${err.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>`;return}
  const tok=++TB_TOK;box.innerHTML='<p class="empty">案を作っています…（2つの考え方で、6匹を組んで計算し直しています）</p>';
  setTimeout(()=>{if(tok!==TB_TOK||!box.isConnected)return;
    let P;try{P={sig:tbCondSig(),A:tbPropPref(),B:tbPropComp()}}catch(e){P={sig:tbCondSig(),err:String(e&&e.stack||e)}}
    if(tok!==TB_TOK||!box.isConnected)return;TB_PROP=P;box.innerHTML=tbPropHTML(P);tbPropBind(box)},30);
}
/* 案A こだわり優先：既存の「こだわり条件で組む」（kdBuild）を、下書きの入れたい匹で呼ぶ（team と KD は必ず戻す）。型は当サイトが組んだ理論上のもの */
function tbPropPref(){
  const c=TB.cond,ent=[TB.start,...c.must].map(no=>({no,sel:false}));
  const keep={type:KD.type,big:KD.big,ng:KD.ng,mega:KD.mega,seed:KD.seed,res:KD.res,opt:KD.opt},keepOut=new Set(PR_OUT);
  let r;
  try{KD.type=c.type;KD.big=Object.keys(KD_SUB).find(k=>KD_SUB[k].some(s=>s[0]===c.type))||'auto';KD.ng=c.ng.slice();KD.mega=c.mega==='none'?0:c.mega==='auto'?2:1;KD.seed=0;PR_OUT.clear();
    r=impWith(ent,()=>kdBuild())}
  finally{Object.assign(KD,keep);PR_OUT.clear();keepOut.forEach(x=>PR_OUT.add(x))}
  let mem=r.mons.map((p,i)=>({no:p.no,set:toSaved(r.ss[i])||null,src:'theory',srcTxt:'当サイトが組んだ理論上の型（実際に使われた型ではありません）',why:(r.why[p.no]||[]).slice(0,3)}));
  mem=tbMegaFix(mem);const V2=tbValidate(mem);
  return tbPropEval('pref',V2.mem,V2.notes,r.checks.map(([t,ok])=>({t,ok})),r.type&&r.type[1]);
}
/* メガシンカの条件をそろえる：なし→メガストーンを外す／この匹→その匹だけ（確認できたメガストーン） */
function tbMegaFix(mem){const c=TB.cond;
  if(c.mega==='none')return mem.map(x=>x.set&&x.set.it&&isStone(x.set.it.k)?{...x,set:{...x.set,it:null}}:x);
  if(c.mega.startsWith('must:')){const no=+c.mega.slice(5),k=Object.keys(MEGA).find(k=>MEGA[k][no]&&mvpStoneSt(k,no)==='ok');
    return mem.map(x=>{if(x.no===no&&k)return{...x,set:{...(x.set||{mv:[],sp:null,up:-1,dn:-1,ab:null}),it:{k,n:ITEMN[k]||k}}};return x.set&&x.set.it&&isStone(x.set.it.k)?{...x,set:{...x.set,it:null}}:x})}
  return mem}
/* 案B 勝ちやすさ寄り：入れたい匹から始め、入れかえ案と同じ計算で、大きな弱点がいちばん少なくなる匹を1匹ずつ足す（型は PokéKit の集計） */
function tbPropComp(){
  const c=TB.cond,fmt=FMT;
  const used=new Set();
  let mem=[TB.start,...c.must].map(no=>{const ms=c.mega==='must:'+no?Object.keys(MEGA).find(k=>MEGA[k][no]&&mvpStoneSt(k,no)==='ok'):null;
    let S=mvpSet(fmt,no,{stone:ms,used});if(S.st!=='ok'&&ms)S=mvpSet(fmt,no,{used});
    if(S.st==='ok'&&S.sv.it)used.add(S.sv.it.k);
    return{no,set:S.st==='ok'?S.sv:null,src:S.st==='ok'?'pokekit':'none',srcTxt:S.st==='ok'?`${mvpSrcTxt(fmt)}（能力ポイントは仮定）`:'',why:['入れたい匹（必ず守る条件）']}});
  mem=tbMegaFix(mem);
  while(mem.length<6){
    const R=tbCands(mem,{ng:c.ng,noMega:c.mega==='none'||c.mega.startsWith('must:'),n:6});
    if(R.st!=='ok'||!R.res.length)break;
    const b=R.res[0],fx=b.C.pairs.flatMap(z=>z.fixed.filter(w=>w.crit));
    mem.push({no:b.r.no,set:b.S.sv,src:'pokekit',srcTxt:`${mvpSrcTxt(fmt)}（能力ポイントは仮定）`,why:[fx.length?`入れると大きな弱点が${b.C.cf}件減る（${fx.slice(0,2).map(w=>w.op.n).join('・')}など）`:'大きな弱点は減らないが、候補の中で悪くならない',...(b.co?[`一緒に使われる割合 ${b.co.pc}%（Showdown）`]:[])]});
  }
  const V2=tbValidate(mem);
  return tbPropEval('comp',V2.mem,V2.notes,[{t:'構築のタイプ（できれば守る条件）',ok:null,note:'この案は勝ちやすさ寄りなので、構築のタイプは考えていません'}],null);
}
/* 案の評価と、条件を守れたか */
function tbPropEval(kind,mem,notes,checks,typeName){
  const c=TB.cond,E=mvpEvalTeam(tbEntries(mem),FMT);
  const req=[{t:`入れたい匹（${[TB.start,...c.must].map(n=>byNo[n].n).join('・')}）`,ok:[TB.start,...c.must].every(n=>mem.some(x=>tbFam(x.no)===tbFam(n)))},
    {t:'入れたくない匹を入れない',ok:!mem.some(x=>c.ng.some(n=>tbFam(n)===tbFam(x.no)))},
    {t:`メガシンカ：${c.mega==='none'?'なし':c.mega==='auto'?'おまかせ':byNo[+c.mega.slice(5)].n+'をメガシンカ'}`,ok:c.mega==='none'?!mem.some(x=>x.set&&x.set.it&&isStone(x.set.it.k)):c.mega.startsWith('must:')?mem.some(x=>x.no===+c.mega.slice(5)&&x.set&&x.set.it&&isStone(x.set.it.k)):true},
    {t:'6匹そろう',ok:mem.length===6}];
  return{kind,mem,notes,E,req,pref:checks,typeName,roles:E.st==='ok'?E.roles:null};
}
function tbPropHTML(P){
  if(P.err)return `<p class="note"><b>案を作れませんでした</b>：${esc(P.err)}</p>`;
  const one=(X,k)=>{const head=X.kind==='pref'?['案A こだわり優先','あなたの条件と構築のタイプを優先して組んだ案。型は当サイトが組んだ理論上のもの（実際に使われた型ではありません）。']:['案B 勝ちやすさ寄り','必ず守る条件はそのままに、入れかえ案と同じ計算で、大きな弱点がいちばん少なくなる匹を1匹ずつ足した案。型は Showdown の集計（PokéKit）。勝率が高いという意味ではありません（理論上の計算）。'];
    const E=X.E;const crit=E.st==='ok'?E.scen.map(s=>`${esc(s.label)}：大きな弱点${s.weak.filter(w=>w.crit).length}件`).join('・'):'計算できませんでした';
    return `<div class="pr-c tbd-c tbd-prop"><div class="tbd-tt"><b>${head[0]}</b></div><p class="note">${head[1]}</p>
      <div class="tbd-six">${X.mem.map(x=>`<a class="av" href="#/p/${x.no}" title="${esc(byNo[x.no].n)}">${stamp(byNo[x.no])}</a>`).join('')}</div>
      <ul class="tbd-req">${X.req.map(r=>`<li>${r.ok?'✓':'×'} ${esc(r.t)}</li>`).join('')}${(X.pref||[]).map(r=>`<li>${r.ok===true?'✓':r.ok===false?'△':'―'} ${esc(r.t)}${r.note?`（${esc(r.note)}）`:r.ok===false?'（守れませんでした）':''}</li>`).join('')}</ul>
      <p class="note"><b>計算の結果</b>：${crit}${X.typeName?`。構築のタイプ：${esc(X.typeName)}`:''}</p>
      ${X.notes.length?`<div class="mvp-warn">直したところ：${X.notes.map(esc).join('。')}</div>`:''}
      <details class="tbd-set"><summary>1匹ずつの理由と育成</summary><ul class="tbd-mem">${X.mem.map((x,i)=>`<li><b>${esc(byNo[x.no].n)}</b>：${(x.why||[]).map(esc).join('／')||'―'}${X.roles&&X.roles[i]&&X.roles[i].length?`<br><small>役わり（型から）：${X.roles[i].map(r=>esc(r.n)).join('・')}</small>`:''}<br><small>${tbSetTxt(x.set)}（${esc(TB_SRC[x.src]||'')}）</small></li>`).join('')}</ul>
        ${E.st==='ok'?mvpWeakHTML(E):''}</details>
      <div class="btns" style="padding:0 16px 12px"><button class="btn btn-s" data-tbpo="${k}">③ 自分で組むで開く</button><button class="btn btn-s" data-tbpu="${k}">パーティに入れる</button></div></div>`};
  return `<div class="sec"><h2>2つの案</h2></div>${one(P.A,'A')}${one(P.B,'B')}`;
}
function tbPropBind(box){if(!box)return;
  box.querySelectorAll('[data-tbpo]').forEach(b=>b.onclick=()=>{const X=TB_PROP[b.dataset.tbpo];tbLoadTeam(X.mem.map(x=>({no:x.no,set:x.set,src:x.src,srcTxt:x.srcTxt})),X.kind==='pref'?'案A こだわり優先':'案B 勝ちやすさ寄り')});
  box.querySelectorAll('[data-tbpu]').forEach(b=>b.onclick=()=>{const X=TB_PROP[b.dataset.tbpu];tbTransfer(X.mem,`${formInfo(byNo[TB.start]).base}・${X.kind==='pref'?'案A':'案B'}`)})}
