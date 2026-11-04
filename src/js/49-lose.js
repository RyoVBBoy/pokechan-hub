/* ===================== 負けやすい理由（パーティの画面の「チェック」の先頭。2026/11/04） =====================
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
const lsOpps=()=>{const live=typeof META!=='undefined'&&META.rank&&META.rank.length>=20;return(live?META.rank.map(x=>byNo[x.no]):gmOpps()).filter(Boolean).slice(0,20)};
function loseReasons(entries){
  const ms=entries.map(x=>({x,p:byNo[x.no]})).filter(o=>o.p),out=[];if(!ms.length)return out;
  const item=o=>o.x.set&&o.x.set.it&&o.x.set.it.k;
  const opps=lsOpps();
  /* ① 止める手段（ストッパー） */
  const pr=ms.map(o=>({o,...LS_PRIO(o)}));
  const stop=pr.filter(r=>['choicescarf','focussash'].includes(item(r.o))||r.reg.length);
  const aces=opps.filter(q=>{const b=byNo[q.base]||q;return prKnows(b,LS_SETUP).length&&Math.max(q.s[1],q.s[3])>=110}).slice(0,3);
  if(!stop.length&&aces.length){
    /* 先制技はほとんど物理なので、攻撃の高い匹から */
    const canPr=pr.filter(r=>r.can.length).sort((a,b)=>b.o.p.s[1]-a.o.p.s[1]);
    out.push({ph:'構築',w:3,t:'相手に1回能力を上げられると、止める手段がない',
      d:`よく使われる${aces.map(q=>formInfo(q).base).join('・')}などは、能力を上げる技で一気に勝ちにくるポケモンです。パーティに「こだわりスカーフ」「きあいのタスキ」「先制技」のどれもないため、1回積まれると止められず、そのまま負けてしまいます。`,
      how:canPr.length?`${canPr.slice(0,2).map(r=>`${formInfo(r.o.p).base}に先制技（${mName(r.can.sort((a,b)=>(MV[b][2]||0)-(MV[a][2]||0))[0])}など）を覚えさせる`).join('、または')}。ほかに、素早い1匹にこだわりスカーフやきあいのタスキを持たせる方法もあります。`:'素早い1匹にこだわりスカーフかきあいのタスキを持たせるか、先制技を覚えるポケモンを入れましょう。',
      act:[['#/pair','先制技を持つ仲間を探す']]});
  }
  /* ② よく使われる相手への答え */
  const me=ms.map(o=>{try{return mkMon(o.p,'me',mySetFor(o.x.no))}catch(e){return null}});
  const spd=m=>m.st[5]*(m.item==='choicescarf'?1.5:1);
  const miss=[];
  opps.forEach((q,j)=>{if(ms.some(o=>(o.p.base||o.p.no)===(q.base||q.no)))return;
    let op;try{op=mkMon(q,'op',q.base&&byNo[q.base]?{...detSet(byNo[q.base]),ab:q.ab,item:null}:detSet(q))}catch(e){return}
    const ok=me.some(a=>{if(!a)return false;try{const x=estHit(a,op).pct,y=estHit(op,a).pct;return y<50||(x>=50&&y<50)||(spd(a)>spd(op)&&x>=100)}catch(e){return false}});
    if(!ok)miss.push({q,j})});
  if(miss.length){
    const top=miss.slice(0,3),q0=top[0].q;
    let cand=[];try{const c=monCounters(q0);cand=[...c.ohko,...c.strong,...c.wall].map(r=>r.q).filter(q=>!q.base&&!ms.some(o=>o.p.no===q.no)).slice(0,3)}catch(e){}
    out.push({ph:'構築',w:2.4+.3*top.length-top[0].j*.02,t:`よく使われる${top.map(m=>formInfo(m.q).base).join('・')}に、だれも答えられない`,
      d:`${top.map(m=>formInfo(m.q).base).join('・')}を相手にすると、パーティのだれもが「2回耐える」「先に半分以上削る」「上から一撃で倒す」のどれもできません。選出画面にいるだけで動きが苦しくなり、対面したら崩されます。`,
      how:cand.length?`${formInfo(q0).base}に強い${cand.map(q=>formInfo(q).base).join('・')}などを入れることを考えましょう。または、${formInfo(q0).base}の攻撃を2回耐えられるように、だれかの能力ポイントを耐久に回します。`:`${formInfo(q0).base}の攻撃を2回耐えられる仲間か、上から倒せる仲間を入れましょう。`,
      act:[[q0.base?`#/p/${q0.no}`:`counter/${q0.no}/`,`${formInfo(q0).base}の対策を見る`],['#/pair','相性のいい仲間を探す']]});
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
  const lead={};done.forEach(b=>{const n=b.my_sel&&b.my_sel[0];if(!n||!byNo[n])return;const o=lead[n]=lead[n]||{n,c:0,w:0};o.c++;if(b.result==='win')o.w++});
  const badLead=Object.values(lead).filter(o=>o.c>=3&&pct(o.w,o.c)<40).sort((a,b)=>pct(a.w,a.c)-pct(b.w,b.c))[0];
  if(badLead)out.push({ph:'選出',w:2.2,t:`${formInfo(byNo[badLead.n]).base}を先発にした試合で負けやすい`,
    d:`記録では、${formInfo(byNo[badLead.n]).base}を先発にした${badLead.c}戦の勝率が${pct(badLead.w,badLead.c)}%です。相手の先発に勝てない形で始まり、最初のターンで数が不利になっている可能性があります。`,
    how:'相手の6匹を見て、相手が先発に出しやすいポケモンに勝てる匹を先発にしましょう。選出アシストの「選出の3ステップ」が使えます。',act:[['#/assist','選出アシストで確かめる']]});
  const opp={};done.forEach(b=>(b.opp||[]).forEach(n=>{if(!byNo[n])return;const o=opp[n]=opp[n]||{n,c:0,w:0};o.c++;if(b.result==='win')o.w++}));
  const hard=Object.values(opp).filter(o=>o.c>=3&&pct(o.w,o.c)<45).sort((a,b)=>pct(a.w,a.c)-pct(b.w,b.c))[0];
  if(hard)out.push({ph:'選出',w:2,t:`相手に${formInfo(byNo[hard.n]).base}がいると負けやすい`,
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
function loseHTML(){
  return `<div id="lose-box"><div class="sec"><h2>負けやすい理由</h2><span style="font-size:12px;color:var(--dim)">重い順に3つまで</span></div><p class="empty" style="padding:14px">計算中…</p></div>`;
}
async function loseFill(entries){
  const el=document.getElementById('lose-box');if(!el)return;
  let R=[];try{R=loseReasons(entries)}catch(e){}
  const draw=all=>{const top=all.sort((a,b)=>b.w-a.w).slice(0,3);if(!document.body.contains(el))return;
    el.innerHTML=`<div class="sec"><h2>負けやすい理由</h2><span style="font-size:12px;color:var(--dim)">重い順に3つまで</span></div>
      ${top.length?top.map((r,i)=>`<div class="ls-i"><div class="ls-h"><span class="ls-n">${i+1}</span><span class="ls-ph">${r.ph}</span><b>${esc(r.t)}</b></div><p>${esc(r.d)}</p><p class="pc-how"><b>こうすると良くなる：</b>${esc(r.how)}</p>${r.act?`<div class="ls-a">${r.act.map(([h,l])=>`<a class="btn btn-s" href="${h}">${esc(l)}</a>`).join('')}</div>`:''}</div>`).join('')
        :'<p class="note">パーティの形から分かる大きな負け筋は見つかりませんでした。負けが続くときは、下の確認リストで選出や動き方を振り返ってみましょう。</p>'}
      <details class="ls-chk"><summary>負けた試合を振り返る確認リスト（選出・プレイング・情報戦）</summary><ul>${LOSE_CHECK.map(([p,t])=>`<li><span class="ls-ph">${p}</span>${t}</li>`).join('')}</ul>
      <p class="note" style="padding:4px 0 0">対戦の振り返り（ツール）で記録をためると、負けやすい先発や相手もここに出ます。</p></details>`};
  draw(R.slice());
  try{const more=await loseFromRecords();if(more.length)draw([...R,...more])}catch(e){}
}
