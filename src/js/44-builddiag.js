/* ===================== 構築の診断（くわしく）：パーティの画面「構築と選出」タブ =====================
   2026/11/03 依頼主の資料（プロの構築の考え方の要約。文章は使わず考え方だけ）をもとに、データと計算で判定する。
   ・受けと攻め（3受け3攻め）・物理受け/特殊受けの分担・中速枠・タイプ受け
   ・設置技（撒く側か対策する側か、いわ4倍弱点）
   ・メガシンカの切りかえ（2匹のときどちらを選ぶか）
   ・構築の失敗パターン10項目のチェック
   育成（技・持ち物・能力ポイント）を登録した匹ほど正確。登録がない匹は種族値と覚える技で見る */
const BD_HAZ=['stealthrock','spikes','toxicspikes','stickyweb'];
const BD_ANTI={spin:['rapidspin','courtchange','defog','tidyup','mortalspin'],ab:['magicbounce','magicguard']};
const BD_PHAZE=['haze','clearsmog','whirlwind','roar','dragontail','circlethrow','taunt','encore','yawn','perishsong'];
const BD_HEAL=['recover','roost','slackoff','milkdrink','morningsun','synthesis','moonlight','softboiled','shoreup','strengthsap','wish','rest','painsplit','drainpunch','gigadrain','hornleech','leechseed'];
function bdMon(x){
  const p=byNo[x.no];if(!p)return null;const s=x.set||{};
  const ids=(s.mv||[]).map(m=>m&&m.id).filter(Boolean),keys=ids.map(id=>MD[id]&&MD[id][3]).filter(Boolean);
  const info=ids.map(id=>({id,i:mvInfo(id)})).filter(z=>z.i);
  const it=s.it&&s.it.k,mg=it&&megaOf(p.no,it),q=mg||p;
  const ab=mg&&mg.ab?mg.ab:s.ab&&s.ab.k?s.ab.k:null,abs=ab?[ab]:(ABD[p.no]||[]).map(a=>a[0]);
  const sp=Array.isArray(s.sp)?s.sp:null,has=ids.length>0||!!it;
  const [h,A,B,C,D,S]=q.s;
  /* 受けか攻めか：能力ポイントがあれば HP と防御/特防の振り方、なければ種族値（耐久の平均と攻撃の高い方を比べる） */
  const bulkBy=sp?(sp[0]>=20&&(sp[2]>=20||sp[4]>=20)):((h+B+D)/3>Math.max(A,C)+5);
  const heal=keys.some(k=>BD_HEAL.includes(k))||['leftovers','blacksludge','sitrusberry'].includes(it)||abs.includes('regenerator');
  const wall=bulkBy||(keys.filter(k=>BD_HEAL.includes(k)).length&&Math.max(A,C)<110);
  const wallSide=sp?(sp[2]>=sp[4]?'phys':'spec'):(B>=D?'phys':'spec');
  const atkCls=[...new Set(info.filter(z=>z.i.pow>0&&z.i.cls<2).map(z=>z.i.cls))];
  return{x,p,q,s,ids,keys,info,it,mg,ab,abs,sp,has,wall,wallSide,heal,atkCls,spe:S,
    prio:info.some(z=>z.i.pri>0&&z.i.pow>0),piv:keys.some(k=>GM_PIV.includes(k)),
    haz:keys.filter(k=>BD_HAZ.includes(k)),anti:keys.some(k=>BD_ANTI.spin.includes(k))||abs.some(a=>BD_ANTI.ab.includes(a)),
    phaze:keys.some(k=>BD_PHAZE.includes(k))||abs.includes('unaware'),
    lowAcc:info.filter(z=>z.i.pow>0&&z.i.acc>0&&z.i.acc<85),def:monDef(q)};
}
function buildDiagHTML(entries,P0){
  const ms=entries.map(bdMon).filter(Boolean);if(ms.length<3)return '';
  const N=o=>esc(o.p.n),names=a=>a.map(N).join('・'),withSet=ms.filter(o=>o.has).length;
  const res=(o,t)=>o.def.find(z=>z.t===t).m;
  /* ---- 受けと攻め ---- */
  const walls=ms.filter(o=>o.wall),atks=ms.filter(o=>!o.wall);
  const pw=walls.filter(o=>o.wallSide==='phys'),sw=walls.filter(o=>o.wallSide==='spec');
  const mid=ms.filter(o=>o.spe>=100&&o.spe<=130);
  const typeRes=T.map(t=>({t,r:ms.filter(o=>res(o,t)<1),imm:ms.filter(o=>res(o,t)===0)}));
  const immBy=ms.filter(o=>o.def.some(z=>z.m===0&&z.by));
  /* ---- 設置技 ---- */
  const setters=ms.filter(o=>o.haz.length),anti=ms.filter(o=>o.anti);
  const fastN=ms.filter(o=>o.prio||o.it==='choicescarf'||o.spe>=120).length;
  const rock4=ms.filter(o=>res(o,'いわ')>=4);
  /* ---- メガの切りかえ ---- */
  const megas=ms.filter(o=>o.it&&isStone(o.it));
  let megaRoute=null;
  if(megas.length>=2&&P0&&P0.S){const idx=megas.map(o=>entries.indexOf(o.x));
    const pick=P0.opps.map((q,j)=>{const v=idx.map(i=>P0.S[i][j]);const b=v.indexOf(Math.max(...v));return Math.max(...v)>=1&&v[b]>v[1-b]?b:-1});
    megaRoute=megas.slice(0,2).map((o,k)=>({o,opps:P0.opps.filter((_,j)=>pick[j]===k)}))}
  /* ---- 失敗パターン10項目 ---- */
  const chk=[];const C=(ok,t,d,how)=>chk.push({ok,t,d,how});
  C(!(walls.length>=4||(walls.length>=3&&atks.length<3)),'受けが多すぎない',walls.length>=3?`受け寄りが${walls.length}匹（${names(walls)}）、攻め寄りが${atks.length}匹。`:`受け寄り${walls.length}匹・攻め寄り${atks.length}匹。`,'受け寄りの1匹を、弱点を突けるアタッカーに入れかえます。受け3・攻め3が目安です。');
  const zero=typeRes.filter(x=>!x.r.length).map(x=>x.t);
  C(!zero.length,'半減以下で受けられないタイプがない',zero.length?`<b style="color:var(--w2)">${zero.join('・')}</b>タイプの技を、6匹のだれも半減以下で受けられません（いちばん重い欠点）。`:'18タイプすべてに、半減以下で受けられる匹がいます。',zero.length?`${zero.join('・')}技を半減以下で受けられるポケモンを1匹入れます。`:'');
  const pr=ms.filter(o=>o.prio);
  C(pr.length>0||!withSet,'先制技がある',pr.length?`${names(pr)}が先制技を持っています。`:withSet?'登録した技に、先制技（優先度+1以上の攻撃技）がありません。':'育成が未登録のため、まだ判定できません。','削れた相手を先に倒せるよう、1匹は先制技を持たせます。');
  C(megas.length<2||(megaRoute&&megaRoute.every(r=>r.opps.length)),'メガシンカの使い分けが決まっている',megas.length<2?(megas.length?`メガシンカは${N(megas[0])}の1匹です。`:'メガストーンを持つ匹はいません。'):megaRoute.every(r=>r.opps.length)?'上の「メガシンカの切りかえ」のとおり、相手で選び分けられます。':`${names(megas)}のうち、もう一方より有利に戦える相手がいない匹がいます。`,'2匹のメガシンカが同じ相手を見ているなら、片方の持ち物を変えるか、別の相手に強いメガシンカにします。');
  const apBad=ms.filter(o=>o.sp&&o.atkCls.length===1&&((o.atkCls[0]===0&&o.sp[3]>=20&&o.sp[1]<10)||(o.atkCls[0]===1&&o.sp[1]>=20&&o.sp[3]<10)));
  const trBad=ms.filter(o=>o.sp&&o.keys.includes('trickroom')&&o.sp[5]>=20);
  C(!apBad.length&&!trBad.length,'能力ポイントが役割に合っている',apBad.length||trBad.length?[apBad.length?`${names(apBad)}は使う攻撃技と、能力ポイントを振った攻撃の種類（物理/特殊）が合っていません。`:'',trBad.length?`${names(trBad)}はトリックルームを使うのに素早さに振っています。`:''].join(''):withSet?'登録した育成で、大きな食い違いはありません。':'育成が未登録の匹は、よくある振り方で見ています。','技の種類に合わせて、攻撃か特攻のどちらかに振り直します。');
  C(!rock4.length||anti.length>0||fastN>=3,'設置技への対策がある',rock4.length?`${names(rock4)}はいわタイプを4倍で受けるので、ステルスロックを撒かれると出るたびに大きく削られます。${anti.length?`対策：${names(anti)}。`:fastN>=3?'先に動ける匹が多く、撒かれる前に攻め切れます。':'設置を消す技・特性がありません。'}`:anti.length?`${names(anti)}が設置技を消す（はね返す）ことができます。`:'いわ4倍の匹はいません。','こうそくスピン・コートチェンジ・きりばらい、マジックミラー/マジックガードを持つ匹を入れるか、いわ4倍の匹の出し方を絞ります。');
  const ans=ms.filter(o=>o.phaze||o.prio);
  C(ans.length>0||!withSet,'積み技への答えがある',ans.length?`${names(ans)}（ふきとばし・ほえる・くろいきり・ちょうはつ・アンコール・先制技・てんねん など）で、能力を上げた相手を止められます。`:withSet?'能力を上げた相手を止める技（ふきとばし・くろいきり・ちょうはつ・先制技など）がありません。':'育成が未登録のため、まだ判定できません。','1匹に、ふきとばし・ほえる・くろいきり・ちょうはつ・アンコールのどれかを持たせます。');
  const noHeal=walls.filter(o=>o.has&&!o.heal);
  C(!noHeal.length,'受け役に回復の手段がある',noHeal.length?`${names(noHeal)}は受け役なのに、回復技・たべのこし・さいせいりょくがありません。`:walls.length?'受け役は回復の手段を持っています。':'受け役はいません。','回復技か、たべのこし（どくタイプはくろいヘドロ）を持たせます。');
  const low=ms.filter(o=>o.lowAcc.length&&!o.prio&&!o.piv);
  C(!low.length,'命中の低い技に二の手がある',low.length?low.map(o=>`${N(o)}の${o.lowAcc.map(z=>esc(mName(z.id))).join('・')}`).join('、')+'は外れることがあり、外したときの先制技や交代技がありません。':'命中85未満の技を使う匹は、先制技か交代技も持っています（またはそうした技がありません）。','命中の高い技に変えるか、外したときに引ける味方を用意します。');
  const leads=P0&&P0.S?ms.filter(o=>{const i=entries.indexOf(o.x);const a=P0.S[i].reduce((t,v)=>t+v,0)/P0.S[i].length;return a>-.2}):[];
  C(!P0||leads.length>=3,'先発の候補が3匹以上いる',P0?`多くの相手に互角以上に戦える匹：${leads.length?names(leads):'なし'}（${leads.length}匹）。`:'',`先発が1〜2匹に決まっていると、相手に読まれて対策されます。先発もできる匹を増やします。`);
  const ng=chk.filter(c=>!c.ok).length;
  const row=c=>`<div class="bd-c ${c.ok?'ok':'ng'}"><b>${c.ok?'✓':'！'} ${c.t}</b><p>${c.d}</p>${!c.ok&&c.how?`<p class="pc-how"><b>こうすると良くなる：</b>${c.how}</p>`:''}</div>`;
  return `<div class="sec"><h2>受けと攻めの分担</h2></div>
  <div class="pc-i pc-plan"><p>受け寄り <b>${walls.length}</b> 匹（物理受け ${pw.length}・特殊受け ${sw.length}）／攻め寄り <b>${atks.length}</b> 匹。目安は受け3・攻め3です。</p>
    ${walls.length?`<p class="vcap">受け寄り：${names(walls)}${pw.length&&sw.length?'（物理と特殊で受ける役が分かれていて、むだがありません）':walls.length>=2?'（受ける側が物理か特殊にかたよっています。もう一方を受ける匹がいると交代が楽になります）':''}</p>`:''}
    <p class="vcap">中速（素早さの種族値100〜130）の匹：${mid.length?names(mid):'<b style="color:var(--w2)">いません</b>（有利な対面を作って交代につなげる役がいると、サイクルが回りやすくなります）'}</p>
    <p class="vcap">技を無効にできる匹（タイプ・特性）：${immBy.length?immBy.map(o=>`${N(o)}（${o.def.filter(z=>z.m===0).map(z=>z.t).join('・')}）`).join('、'):ms.filter(o=>o.def.some(z=>z.m===0)).length?names(ms.filter(o=>o.def.some(z=>z.m===0))):'なし'}。乱数に左右されない受け方なので、交代先として安定します。</p></div>
  <div class="sec"><h2>設置技</h2></div>
  <div class="pc-i pc-plan"><p>${setters.length?`<b>撒く側</b>：${setters.map(o=>`${N(o)}（${o.haz.map(k=>esc(mName(+Object.keys(MD).find(i=>MD[i][3]===k)))).join('・')}）`).join('、')}。先発で確実に撒けるよう、きあいのタスキや交代技があると動きやすくなります。`:'<b>撒く側</b>：登録した技に設置技はありません。'}</p>
    <p>${anti.length?`<b>対策する側</b>：${names(anti)}。`:fastN>=3?'<b>対策する側</b>：先に動ける匹が多く、撒かれる前に攻め切る形です。':'<b>対策する側</b>：設置技を消す技・はね返す特性がありません。'}${rock4.length?`<br><b style="color:var(--w2)">${names(rock4)}はいわ4倍</b>なので、ステルスロックに特に注意します。`:''}</p></div>
  ${megaRoute?`<div class="sec"><h2>メガシンカの切りかえ</h2></div><div class="pc-i pc-plan">${megaRoute.map(r=>`<p><b>${N(r.o)}</b>をメガシンカ：${r.opps.length?`相手に ${r.opps.slice(0,5).map(q=>esc(formInfo(q).base)).join('・')} がいるとき`:'<span style="color:var(--w2)">こちらを選ぶべき相手が見つかりません</span>'}</p>`).join('')}</div>`:''}
  <div class="sec"><h2>構築の失敗パターン</h2><span style="font-size:12px;color:var(--dim)">10項目中 ${10-ng} 項目クリア</span></div>
  ${withSet<ms.length?`<p class="note" style="padding-top:0">育成（技・持ち物・能力ポイント）を登録していない匹は、種族値と覚える技で見ています。登録すると正確になります。</p>`:''}
  <div class="bd-list">${[...chk.filter(c=>!c.ok),...chk.filter(c=>c.ok)].map(row).join('')}</div>`;
}
/* 軸のポケモンに合わせて、空いている枠を埋める（ポケモンの解説の「〇〇を軸にしたパーティの例」と同じ考え方） */
function bdFill(){
  const ax=team.find(x=>x.axis);if(!ax||team.length>=6)return;
  const mons=axisTeam(byNo[ax.no],{}).filter(q=>!team.some(x=>formInfo(byNo[x.no]).base===formInfo(q).base));
  const add=mons.slice(0,6-team.length),ss=archSets(['axis'],add);
  add.forEach((q,i)=>team.push({no:q.no,sel:false,set:ss[i]?{...toSaved(ss[i]),src:'copy'}:undefined}));
  saveTeam();toast(`${add.length}匹を足しました（育成は計算で組んだ例です）`);teamRender();
}

/* ===================== 選出の3ステップ（選出アシスト） =====================
   ① 相手の選出を3パターン予想（oppPredict の上位3つ）
   ② それぞれに対する「通し筋」：その3匹に対するこちらのいちばんよい選出と、だれがだれを倒すか
   ③ 初手：3つの通し筋に共通して出しやすい匹（予想の確からしさで重みづけ） */
function threeStepHTML(myNos,PR){
  if(!PR||!PR.top||PR.top.length<2||opp6.length<=PICK())return '';
  const tops=PR.top.slice(0,3);
  const nm1=n=>esc(byNo[n].n);
  const scen=tops.map(t=>{const oNos=t.c.map(j=>opp6[j]);const A=analyze(myNos,oNos);
    const plan=A.O.map((o,j)=>{const i=[...A.best].sort((a,b)=>A.offV(b,j)-A.offV(a,j))[0];const d=A.D[i][j];return{o,i,d}});
    return{p:t.p,oNos,A,plan}});
  const sc={};scen.forEach(s=>{s.A.best.forEach(i=>{sc[i]=(sc[i]||0)+s.p*(s.A.lead.includes(i)?1:.4)})});
  const leadI=Object.keys(sc).map(Number).sort((a,b)=>sc[b]-sc[a]).slice(0,LEADN());
  const inN=i=>scen.filter(s=>s.A.best.includes(i)).length;
  return `<div class="sec"><h2>選出の3ステップ</h2></div>
  <div class="pc-i pc-plan"><b>① 相手の選出の予想</b>
    ${scen.map((s,k)=>`<p><b>${k+1}.</b> ${s.oNos.map(nm1).join('・')} <span class="vcap">（${Math.round(s.p*100)}%）</span></p>`).join('')}
    <h4>② それぞれへの通し筋</h4>
    ${scen.map((s,k)=>`<div class="pc-situ"><p><b>${k+1}で来たら</b>：${s.A.best.map(i=>`<b>${esc(s.A.M[i].p.n)}</b>`).join('・')}（先発 ${s.A.lead.map(i=>esc(s.A.M[i].p.n)).join('・')}）</p>
      <ul class="pc-story">${s.plan.map(x=>`<li>${esc(s.A.M[x.i].p.n)}が${esc(x.o.p.n)}に${x.d.mv?esc(x.d.mv.n)+'で':''}${Math.round(Math.min(x.d.pct,999))>=100?'一撃':'約'+Math.round(x.d.pct)+'%'}${x.d.pct<50?'<span class="vcap">（決め手に欠けるので、交代や削りと合わせる）</span>':''}</li>`).join('')}</ul></div>`).join('')}
    <h4>③ 初手</h4>
    <p><b>${leadI.map(i=>esc(byNo[myNos[i]].n)).join('・')}</b>：3つの通し筋のうち${leadI.map(inN).join('・')}つに入り、どの予想でも先発として動きやすい匹です。先発を見て、相手がどの選出かを見きわめ、②の通し筋に切りかえます。</p>
  </div>`;
}
