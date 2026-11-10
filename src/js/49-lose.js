/* ===================== 敗因の診断（パーティの画面の「チェック」の先頭。2026/11/04、2026/11/06 に「負けやすい理由」から改名） =====================
   依頼主の資料「敗因分析のフレームワーク」の4つの段階（構築・選出・プレイング・情報戦）を、当サイトの言葉と計算にした。
   ・構築（パーティだけで分かる）：①止める手段がない（スカーフ・タスキ・先制技が0）で、環境に積みエースがいる
     ②よく使われる相手に、だれも答えられない（2回耐えられる／半分以上削って半分未満しか受けない／上から一撃 のどれもない）
     ③いわ4倍がいるのに、設置技（ステルスロック）を消す手段がない（あつぞこブーツはゲームにない）
   ・選出（対戦の振り返りの記録から）：負けやすい先発、よく負ける相手
   ・プレイング・情報戦：数字では分からないので、振り返るときの確認リストとして出す
   重い順に3つまで。どれにも「こうすると良くなる」と、次にすること（ボタン）を付ける。 */
const LS_PRIO=o=>{const ids=(o.x.set&&o.x.set.mv||[]).map(m=>m&&m.id).filter(Boolean);
  const reg=ids.filter(id=>MV[id]&&MV[id][5]>0&&MV[id][2]>0);
  const can=(LSD[o.p.no]?LSD[o.p.no][1]:[]).filter(id=>MV[id]&&MV[id][5]>0&&MV[id][2]>0);
  return{reg,can,hasSets:ids.length>0}};
const LS_SETUP=['swordsdance','dragondance','nastyplot','calmmind','bulkup','quiverdance','shellsmash','shiftgear','bellydrum','victorydance','tidyup'];
const LS_CLEAR=['rapidspin','defog','courtchange','tidyup','mortalspin'];
const lsOpps=()=>metaOpps(20);
const lsSpd=m=>m.st[5]*(m.item==='choicescarf'?1.5:1);
function loseReasons(entries){
  const ms=entries.map(x=>({x,p:byNo[x.no]})).filter(o=>o.p),out=[];if(!ms.length)return out;
  const item=o=>o.x.set&&o.x.set.it&&o.x.set.it.k;
  const opps=lsOpps();
  /* ① 止める手段（ストッパー） */
  const pr=ms.map(o=>({o,...LS_PRIO(o)}));
  const stop=pr.filter(r=>['choicescarf','focussash'].includes(item(r.o))||r.reg.length);
  const aces=opps.filter(q=>{const b=byNo[q.base]||q;return prKnows(b,LS_SETUP).length&&Math.max(q.s[1],q.s[3])>=110}).slice(0,3);
  /* 技を決めていない匹がいるうちは判定しない（2026/11/05：先制技を覚えさせる前に「ない」と言わない。進み具合の案内で技を決めてもらう） */
  const undecided=ms.some(o=>!(o.x.set&&o.x.set.mv&&o.x.set.mv.length));
  if(!stop.length&&aces.length&&!undecided){
    /* 先制技はほとんど物理なので、攻撃の高い匹から */
    const canPr=pr.filter(r=>r.can.length).sort((a,b)=>b.o.p.s[1]-a.o.p.s[1]);
    out.push({ph:'構築',w:3,t:'相手に1回能力を上げられると、止める手段がない',
      d:`よく使われる${aces.map(q=>formInfo(q).base).join('・')}などは、能力を上げる技で一気に勝ちにくるポケモンです。パーティに「こだわりスカーフ」「きあいのタスキ」「先制技」のどれもないため、1回積まれると止められず、そのまま負けてしまいます。`,
      how:canPr.length?`${canPr.slice(0,2).map(r=>`${formInfo(r.o.p).base}に先制技（${mName(r.can.sort((a,b)=>(MV[b][2]||0)-(MV[a][2]||0))[0])}など）を覚えさせる`).join('、または')}。ほかに、素早い1匹にこだわりスカーフやきあいのタスキを持たせる方法もあります。`:'素早い1匹にこだわりスカーフかきあいのタスキを持たせるか、先制技を覚えるポケモンを入れましょう。',
      act:[['#/pair','先制技を持つ仲間を探す']]});
  }
  /* ② よく使われる相手への答え
     2026/11/10 依頼主の検証（ガブリアス→カイリューの入れかえ案が、入れかえ後に計算し直すと悪くなっていた）：
     判定は「相手ごとの対応力」と同じ dgTeam（乱数の最小・最大・素早さ・タスキ等）にそろえ、×（パーティ全体で対応が難しい）の相手を出す。
     おすすめ・入れかえ案は、変更後の6匹で dgTeam をもう一度計算し、×が減り、ほかの相手が△以下に落ちないものだけを、変更前→変更後の数で出す */
  let DT=null;try{DT=dgTeam(entries,20)}catch(e){}
  const miss=DT?DT.rows.filter(r=>r.lvl===1):[];
  if(miss.length){
    const top=miss.slice(0,3),q0=top[0].q,nmq=q=>q.n,names=top.map(m=>nmq(m.q)).join('・')+(miss.length>3?`など${miss.length}匹`:'');
    const fam=q=>q.base||q.no;
    const pool=new Map();
    top.forEach(m=>{try{const c=monCounters(m.q);[...c.ohko,...c.strong,...c.wall].forEach(r=>{const q=r.q.base&&byNo[r.q.base]?byNo[r.q.base]:r.q;pool.set(q.no,q)})}catch(e){}});
    metaOpps(40).forEach(q=>{const b=q.base&&byNo[q.base]?byNo[q.base]:q;pool.set(b.no,b)});
    const cands=[...pool.values()].filter(q=>!ms.some(o=>fam(o.p)===fam(q))).map(q=>{
      let a;try{a=mkMon(q,'me',detSet(q))}catch(e){return null}
      const cov=miss.map(m=>{try{return dgMatch(a,m.o).r>=3}catch(e){return false}});return{q,a,cov,n:cov.filter(Boolean).length,topN:cov.slice(0,top.length).filter(Boolean).length}})
      .filter(c=>c&&c.n).sort((x,y)=>y.topN-x.topN||y.n-x.n).slice(0,4);
    /* 変更後の6匹でもう一度計算して比べる */
    const cmp=T1=>{const by=new Map(DT.rows.map(r=>[r.q.no,r]));
      const worse=T1.rows.filter(r=>{const b=by.get(r.q.no);return b&&b.lvl>=3&&r.lvl<=2}).map(r=>r.q.n);
      const fixed=miss.map(m=>({m,a:T1.rows.find(r=>r.q.no===m.q.no)})).filter(z=>z.a&&z.a.lvl>=2).map(z=>`${z.m.q.n}（×→${DG_LV[z.a.lvl][0]}）`);
      const x1=T1.rows.filter(r=>r.lvl===1).length;return{worse,fixed,x1}};
    const plans=[];
    cands.forEach(c=>{
      if(ms.length<6){try{plans.push({c,out:null,...cmp(dgTeam0([...entries,{no:c.q.no}],20))})}catch(e){}}
      else ms.forEach((o,i)=>{if(o.x.axis)return;try{plans.push({c,out:o,...cmp(dgTeam0(entries.map((x,k)=>k===i?{no:c.q.no}:x),20))})}catch(e){}})});
    const good=plans.filter(p=>p.fixed.length&&!p.worse.length&&p.x1<miss.length).sort((a,b)=>a.x1-b.x1||b.fixed.length-a.fixed.length);
    const seen=new Set(),best=good.filter(p=>!seen.has(p.c.q.no)&&seen.add(p.c.q.no)).slice(0,3);
    const planTxt=p=>`${p.out?`${p.out.p.n}を外して`:''}${p.c.q.n}を入れる（×の相手 ${miss.length}匹→${p.x1}匹。${p.fixed.join('・')}。◎○から△以下へ落ちる相手はなし）`;
    const rejected=plans.length&&!good.length;
    out.push({ph:'構築',w:2.4+.3*top.length-DT.rows.indexOf(top[0])*.02,t:`よく使われる${names}に、だれも答えられない`,
      d:`${top.map(m=>nmq(m.q)).join('・')}${miss.length>3?'など':''}には、パーティのだれも「上から倒す」「耐えて倒す」「後出しして勝つ」「受けて有利に戦う」ができず、乱数や同速しだいで勝てる匹もいません（相手ごとの対応力の×）。`,
      how:best.length?`変更後の6匹で計算し直して良くなる案：${best.map(planTxt).join('／')}。または、${nmq(q0)}の攻撃を耐えられるように、だれかの能力ポイントを耐久に回します。`:
        `${rejected?'入れかえの候補を変更後の6匹で計算し直しましたが、×が減って、ほかの相手が△以下に落ちない案は見つかりませんでした。':''}${nmq(q0)}の攻撃を耐えられる仲間か、上から倒せる仲間を「相性のいい仲間を探す」で探しましょう。`,
      act:[[q0.base?`#/p/${q0.no}`:`counter/${q0.no}/`,`${nmq(q0)}の対策を見る`],['#/pair','相性のいい仲間を探す']]});
  }
  /* ③ 設置技 */
  const rock4=ms.filter(o=>{const d=monDef(megaOf(o.p.no,item(o))||o.p).find(z=>z.t==='いわ');return d&&d.m>=4});
  const clear=ms.filter(o=>prKnows(o.p,LS_CLEAR).length||(ABD[o.p.no]||[]).some(a=>a[0]==='magicguard'||a[0]==='magicbounce'));
  if(rock4.length&&!clear.length){
    out.push({ph:'構築',w:1.8,t:`${rock4.map(o=>formInfo(o.p).base).join('・')}がステルスロックに弱い`,
      d:`いわが4倍の弱点なので、ステルスロックをまかれると、出るたびにHPの半分を失います。パーティに、まかれた設置技を消す手段がありません。`,
      how:`こうそくスピン・きりばらいなどを覚えるポケモンを入れましょう。ほかに、ステルスロックをまく相手（先発に多い）を見たら、${formInfo(rock4[0].p).base}を出すのは最後にする・まかれる前に倒す、という選出と動き方でも負担を減らせます。`,act:[['#/pair','設置技を消せる仲間を探す']]});
  }
  return out;
}
/* 対戦の振り返りの記録から（選出の段階） */
async function loseFromRecords(){
  if(typeof AUTH==='undefined'||!AUTH.user)return[];
  let bs;try{bs=(await authFetch('/api/battles')).battles||[]}catch(e){return[]}
  const done=bs.filter(b=>b.result),out=[],pct=(w,n)=>n?Math.round(w/n*100):0;
  if(done.length<5)return out;
  out.rec=true;
  const lead={};done.forEach(b=>{const n=b.my_sel&&b.my_sel[0];if(!n||!byNo[n])return;const o=lead[n]=lead[n]||{n,c:0,w:0};o.c++;if(b.result==='win')o.w++});
  const badLead=Object.values(lead).filter(o=>o.c>=3&&pct(o.w,o.c)<40).sort((a,b)=>pct(a.w,a.c)-pct(b.w,b.c))[0];
  if(badLead)out.push({ph:'選出',w:2.2,t:`${formInfo(byNo[badLead.n]).base}を先発にした試合の勝率が低い（${pct(badLead.w,badLead.c)}%）`,
    d:`記録では、${formInfo(byNo[badLead.n]).base}を先発にした${badLead.c}戦の勝率が${pct(badLead.w,badLead.c)}%です。相手の先発に勝てない形で始まり、最初のターンで数が不利になっている可能性があります。`,
    how:'相手の6匹を見て、相手が先発に出しやすいポケモンに勝てる匹を先発にしましょう。選出アシストの「選出の3ステップ」が使えます。',act:[['#/assist','選出アシストで確かめる']]});
  const opp={};done.forEach(b=>(b.opp||[]).forEach(n=>{if(!byNo[n])return;const o=opp[n]=opp[n]||{n,c:0,w:0};o.c++;if(b.result==='win')o.w++}));
  const hard=Object.values(opp).filter(o=>o.c>=3&&pct(o.w,o.c)<45).sort((a,b)=>pct(a.w,a.c)-pct(b.w,b.c))[0];
  if(hard)out.push({ph:'選出',w:2,t:`相手に${formInfo(byNo[hard.n]).base}がいる試合の勝率が低い（${pct(hard.w,hard.c)}%）`,
    d:`記録では、相手に${formInfo(byNo[hard.n]).base}がいた${hard.c}戦の勝率が${pct(hard.w,hard.c)}%です。`,
    how:`${formInfo(byNo[hard.n]).base}を倒す役（通し筋）を決めてから選出しましょう。答えがパーティにいなければ、入れかえも考えます。`,act:[[`counter/${hard.n}/`,`${formInfo(byNo[hard.n]).base}の対策を見る`],['#/replay','対戦の記録を見る']]});
  return out;
}
const LOSE_CHECK=[
  ['選出','最後にだれで勝つか（通し筋）を決めてから、3匹を選んだか。強い3匹を並べただけになっていないか。'],
  ['選出','相手が先発に出しやすいポケモンに、こちらの先発が負けていないか。負けるなら、後ろに安全に交代できる匹がいるか。'],
  ['選出','相手の「見せるだけで出さない」ポケモンを気にしすぎて、勝ち筋のエースを外していないか。'],
  ['プレイング','終盤に相手のエースを受けるための受け役のHPを、序盤の小さな削り合いで使いすぎていないか。'],
  ['プレイング','相手の交代を読んでこちらも交代する、失敗するとそのまま負ける行動を、必要のない場面で選んでいないか。'],
  ['プレイング','予定のエースが通らないと分かったとき、すぐ別の勝ち筋に切りかえたか。'],
  ['情報戦','相手が、あまり使われない技（受け役に効く意外な技など）を持っていなかったか。'],
  ['情報戦','素早さで勝っていると思ったのに先に動かれたなら、相手がこだわりスカーフを持っていたか、素早さの調整を知らなかったのではないか。']];
/* ---- 表示：敗因の診断（2026/11/06 依頼主「負けやすい理由」→「負ける原因を把握して次につなげる診断」） ----
   上に4つの段階（構築・選出・プレイング・情報戦）の診断の状態、下に見つかった原因を重い順に3つ。
   1つずつ「なぜ起きるか」「次の一手」とボタン、「戦術メモの負け筋に書く」（55-memo.js のパーティの戦術メモ⑥）。 */
const LS_HEAD='<div class="sec"><h2>敗因の診断</h2></div><p class="note" style="padding-top:0">負ける原因を先に見つけて、次の一手につなげます。</p>';
function loseHTML(){
  return `<div id="lose-box">${LS_HEAD}<p class="empty" style="padding:14px">診断中…</p></div>`;
}
async function loseFill(entries){
  const el=document.getElementById('lose-box');if(!el)return;
  let R=[];try{R=loseReasons(entries)}catch(e){}
  const logged=typeof AUTH!=='undefined'&&AUTH.user;
  const draw=(all,rec)=>{const top=all.sort((a,b)=>b.w-a.w).slice(0,3);if(!document.body.contains(el))return;
    const n=ph=>all.filter(r=>r.ph===ph).length;
    const st=[['構築',n('構築')?`${n('構築')}件`:'問題なし',n('構築')?'bad':'ok'],
      ['選出',rec?(n('選出')?`${n('選出')}件`:'問題なし'):'記録が必要',rec?(n('選出')?'bad':'ok'):'wait'],
      ['プレイング','振り返りで','wait'],['情報戦','振り返りで','wait']];
    el.innerHTML=`${LS_HEAD}
      <div class="ls-st">${st.map(([p,v,c])=>`<div class="ls-s ${c}"><span>${p}</span><b>${v}</b></div>`).join('')}</div>
      ${top.length?top.map((r,i)=>`<div class="ls-i"><div class="ls-h"><span class="ls-n">${i+1}</span><span class="ls-ph">${r.ph}</span><b>${esc(r.t)}</b></div>
        <p class="ls-k">なぜ起きるか</p><p>${esc(r.d)}</p><p class="ls-k ls-k2">次の一手</p><p>${esc(r.how)}</p>
        <div class="ls-a">${(r.act||[]).map(([h,l])=>`<a class="btn btn-s" href="${h}">${esc(l)}</a>`).join('')}<button class="btn btn-s" data-ls-memo="${i}">戦術メモの負け筋に書く</button></div></div>`).join('')
        :'<p class="note">パーティの形から分かる大きな原因は見つかりませんでした。負けが続くときは、下の振り返りの確認リストで、選出・プレイング・情報戦を見直しましょう。</p>'}
      ${rec?'':`<div class="ls-rec"><p>${logged?'対戦の振り返りで5試合以上を記録すると、「どの先発・どの相手で負けているか」の選出の診断ができます。':'ログインして対戦の振り返りで試合を記録すると、「どの先発・どの相手で負けているか」の選出の診断ができます。'}</p><a class="btn btn-s" href="#/replay">対戦を記録する</a></div>`}
      <details class="ls-chk"><summary>負けた試合の振り返り（選出・プレイング・情報戦）</summary><ul>${LOSE_CHECK.map(([p,t])=>`<li><span class="ls-ph">${p}</span>${t}</li>`).join('')}</ul></details>`;
    el.querySelectorAll('[data-ls-memo]').forEach(b=>b.onclick=()=>{const r=top[+b.dataset.lsMemo];if(!r||typeof MEMO==='undefined')return;
      const k=mpKey(),e=MEMO.party[k]||{s:{}},cur0=(e.s&&e.s.lose)||'';
      if(cur0.split('\n').includes(r.t)){toast('もう書いてあります');return}
      MEMO.party[k]={...e,s:{...(e.s||{}),lose:(cur0?cur0+'\n':'')+r.t},at:Date.now(),sig:mpSig()};memoSave();
      toast('戦術メモの「負け筋」に書きました');b.textContent='書きました';b.disabled=true})};
  draw(R.slice(),false);
  try{const more=await loseFromRecords();if(more&&more.rec)draw([...R,...more],true)}catch(e){}
}

