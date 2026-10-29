/* ===================== 選出のアドバイス（選出アシストの結果に出す） =====================
   対戦でよく知られた選出の考え方を、当サイトの言葉でルールにしたもの（記事の文章は使わない）。
   相手の6匹・予想される型（ラダー集計があればその技・特性・持ち物）・こちらのおすすめ選出から、当てはまるものだけを出す。
   ADV_REFS：参考になる記事へのリンク（本文は載せない）。運営者がページを確かめてから足す。 */
const ADV_REFS=[];/* {t:'記事の題名',src:'サイト名',url:'https://…'} */
const ADVK={
  setup:['swordsdance','dragondance','nastyplot','quiverdance','shellsmash','calmmind','bulkup','bellydrum','shiftgear','coil','victorydance','tidyup','agility','rockpolish','tailglow','geomancy','curse','filletaway','noretreat','growth','workup'],
  tr:['trickroom'],tail:['tailwind'],fake:['fakeout'],redir:['followme','ragepowder'],screen:['reflect','lightscreen','auroraveil'],
  weather:{drizzle:'あめ',drought:'はれ',sandstream:'すなあらし',snowwarning:'ゆき'},choice:['choicescarf','choiceband','choicespecs']
};
const advKey=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
/* 相手が使いそうな技・特性・持ち物（集計があれば上位、なければ計算用の型と持てる特性） */
function advOpp(A,j){
  const o=A.O[j],no=opp6[j],d=LIVE.csv[no];
  const mv=new Set(d?d.mv.filter(([,p])=>p>=10).map(([n])=>advKey(n)):(o.moves||[]).map(m=>m&&MD[m.id]?MD[m.id][3]:'').filter(Boolean));
  const ab=new Set(d?d.ab.filter(([,p])=>p>=15).map(([n])=>advKey(n)):(ABD[no]||[]).map(([k])=>advKey(k)));
  const it=new Set(d?d.it.filter(([,p])=>p>=15).map(([n])=>advKey(n)):[]);
  return{o,no,mv,ab,it,has:k=>k.some(x=>mv.has(x))};
}
function asAdvice(A,PR){
  const out=[],picks=A.best.map(i=>A.M[i]),nm=x=>x.p.n,list=a=>a.slice(0,3).join('・')+(a.length>3?L(' など',' etc.'):'');
  const opps=A.O.map((_,j)=>advOpp(A,j)),likely=j=>!PR||!PR.w||PR.w[j]>=.35;
  const add=(lv,t,d,pri)=>out.push({lv,t,d,pri});
  /* 1. 積み技（起点作り）：一度積まれると止まらない相手には、一撃で大きく削れる駒を残す */
  const su=opps.filter((x,j)=>likely(j)&&x.has(ADVK.setup));
  if(su.length){const ans=su.map(x=>{const j=opps.indexOf(x),b=A.best.map(i=>({i,d:A.D[i][j].pct})).sort((a,b)=>b.d-a.d)[0];return b&&b.d>=50?nm(A.M[b.i]):null});
    add('warn',L(`積み技に注意：${list(su.map(x=>nm(x.o)))}`,`Watch for setup: ${list(su.map(x=>nm(x.o)))}`),
      L(`能力を上げる技を使うことがあります。積む前に大きく削れる${ans.filter(Boolean).length?`ポケモン（${[...new Set(ans.filter(Boolean))].join('・')}）を温存しておく`:'ポケモンが選出にいないため、ちょうはつ・ほえる・ふきとばしなどで流す手段を考える'}と安全です。`,
        `They may use stat-boosting moves. Keep something that can hit them hard${ans.filter(Boolean).length?` (${[...new Set(ans.filter(Boolean))].join(', ')})`:''} in reserve, or plan a way to stop the setup.`),3)}
  /* 2. トリックルーム：遅いポケモンが先に動く。始まったらターンを稼ぐか、先に倒す */
  const tr=opps.filter((x,j)=>likely(j)&&x.has(ADVK.tr));
  if(tr.length)add('warn',L(`トリックルームの可能性：${list(tr.map(x=>nm(x.o)))}`,`Possible Trick Room: ${list(tr.map(x=>nm(x.o)))}`),
    L('5ターンの間、遅いポケモンから動くようになります。使われる前に倒すか、始まったら守る・交代でターンを稼ぐ動きを考えましょう。素早さの低いポケモンを1匹入れておくのも手です。',
      'For 5 turns slower Pokémon move first. Try to KO the setter first, or stall the turns with Protect/switching. A slow Pokémon in your picks also helps.'),3);
  /* 3. 天気 */
  const wx=[];opps.forEach((x,j)=>{if(!likely(j))return;for(const k in ADVK.weather)if(x.ab.has(k))wx.push([nm(x.o),ADVK.weather[k]])});
  if(wx.length)add('tip',L(`天気を変える相手：${list(wx.map(w=>`${w[0]}（${w[1]}）`))}`,`Weather setters: ${list(wx.map(w=>w[0]))}`),
    L('出てくるだけで天気が変わり、技の威力や素早さが変わります。天気に合わせて強くなる相手がいないかを確かめ、こちらも天気を上書きできるなら先発にすると有利です。',
      'Weather changes as soon as they come in, changing move power and Speed. Check which of their Pokémon benefit, and overwrite the weather if you can.'),2);
  /* 4. いかく：物理アタッカーばかりだと攻撃を下げられて崩れる */
  const ik=opps.filter((x,j)=>likely(j)&&x.ab.has('intimidate')),phys=picks.filter(m=>m.p.s[1]>m.p.s[3]+10);
  if(ik.length&&phys.length>=Math.ceil(picks.length/2))add('tip',L(`いかく持ち：${list(ik.map(x=>nm(x.o)))}`,`Intimidate: ${list(ik.map(x=>nm(x.o)))}`),
    L(`選出が物理アタッカー中心（${phys.map(nm).join('・')}）です。いかくで攻撃を下げられると崩れやすいので、特殊技で戦えるポケモンを混ぜるか、交代で下がった能力を戻せるようにしましょう。`,
      `Your picks are mostly physical (${phys.map(nm).join(', ')}). Mix in a special attacker or be ready to switch to reset the drop.`),2);
  /* 5. 素早さ：相手の方が速いポケモンが多い */
  const slowVs=opps.filter((x,j)=>likely(j)&&A.best.filter(i=>!A.fast[i][j]).length>=Math.ceil(A.best.length*.67));
  if(slowVs.length>=2)add('warn',L(`先手を取られやすい：${list(slowVs.map(x=>nm(x.o)))}`,`Likely to be outsped by: ${list(slowVs.map(x=>nm(x.o)))}`),
    L('選出の多くより速い相手がいます。先制技・こだわりスカーフ・素早さを下げる技・耐えてから反撃できる耐久など、上から殴られても崩れない形を意識しましょう。',
      'Several opponents outspeed most of your picks. Priority moves, a Choice Scarf, speed control or enough bulk to take a hit first help here.'),2);
  /* 6. 弱点の重なり（一貫性）：同じタイプの技が選出の2匹以上に抜群 */
  for(const t of T){const weak=picks.filter(m=>mult(t,m.p.t)>=2);if(weak.length<2)continue;
    const users=opps.filter((x,j)=>likely(j)&&x.o.p.t.includes(t));if(!users.length)continue;
    const res=picks.filter(m=>mult(t,m.p.t)<1);
    add(res.length?'tip':'warn',L(`${t}技が通りやすい`,`${tName(t)} moves hit hard`),
      L(`${t}タイプの技が選出の${weak.length}匹（${weak.map(nm).join('・')}）に抜群で、相手には${list(users.map(x=>nm(x.o)))}がいます。${res.length?`受けられるのは${res.map(nm).join('・')}なので、交代先として意識しましょう。`:'半減以下で受けられるポケモンがいないので、先に倒すか選出を見直しましょう。'}`,
        `${tName(t)} moves are super effective on ${weak.length} of your picks (${weak.map(nm).join(', ')}), and they have ${list(users.map(x=>nm(x.o)))}. ${res.length?`${res.map(nm).join(', ')} can switch in.`:'Nothing resists it — KO them first or rethink your picks.'}`),res.length?1:3);
    if(out.length>8)break}
  /* 7. 受け出し先：いちばん危ない相手の技を半減以下で受けられるポケモンがいるか */
  const th=A.O.map((o,j)=>({j,s:A.best.reduce((a,i)=>a+Math.min(A.R[j][i].pct,150),0)})).sort((a,b)=>b.s-a.s)[0];
  if(th){const mv=A.best.map(i=>A.R[th.j][i].mv).find(Boolean);
    if(mv&&mv.t){const res=picks.filter(m=>mult(mv.t,m.p.t)<1);
      if(!res.length)add('warn',L(`${nm(A.O[th.j])}の${mv.n}を受けられない`,`No safe switch-in for ${nm(A.O[th.j])}'s ${mv.n}`),
        L(`選出に${mv.t}タイプを半減以下で受けられるポケモンがいません。先発で有利な相手を当てて先に削るか、控えに受けられるポケモンを入れることを考えましょう。`,
          `None of your picks resists ${tName(mv.t)}. Pressure it early or bring something that resists it.`),3)}}
  /* 8. メガシンカの候補：1試合に1匹だけ。どれがメガかを見極める */
  const mg=opps.filter(x=>megasOf(x.no).length&&(!LIVE.csv[x.no]||[...x.it].some(k=>MEGA[k])));
  if(mg.length>=2)add('tip',L(`メガシンカ候補が${mg.length}匹：${list(mg.map(x=>nm(x.o)))}`,`${mg.length} possible Mega Evolutions: ${list(mg.map(x=>nm(x.o)))}`),
    L('メガシンカできるのは1試合に1匹だけです。先発や技・素早さから、どれがメガストーンを持っているかを早めに見極めると読みやすくなります。',
      'Only one can Mega Evolve per battle. Work out early which one holds the stone from their lead, moves and Speed.'),1);
  /* 9. こだわりアイテム：同じ技しか出せない。技を見てから交代で受ける */
  const ch=opps.filter((x,j)=>likely(j)&&ADVK.choice.some(k=>x.it.has(k)));
  if(ch.length)add('tip',L(`こだわりアイテムの可能性：${list(ch.map(x=>nm(x.o)))}`,`Possible Choice items: ${list(ch.map(x=>nm(x.o)))}`),
    L('こだわり系の持ち物は、交代するまで同じ技しか出せません。1回技を見たら、その技を受けられるポケモンに交代して流れをつかみましょう。',
      'Choice-locked Pokémon repeat the same move until they switch. After seeing the move, switch to something that takes it well.'),1);
  /* 10. ダブル：ねこだまし・このゆびとまれ・おいかぜ */
  if(FMT==='double'){
    const fk=opps.filter((x,j)=>likely(j)&&x.has(ADVK.fake));
    if(fk.length)add('tip',L(`ねこだまし：${list(fk.map(x=>nm(x.o)))}`,`Fake Out: ${list(fk.map(x=>nm(x.o)))}`),
      L('1ターン目に片方の行動を止められます。止められて困るポケモンは先発にしない、またはまもるで受けると安全です。','They can flinch one Pokémon on turn 1. Avoid leading with the one you can\'t afford to stop, or Protect.'),1);
    const rd=opps.filter((x,j)=>likely(j)&&x.has(ADVK.redir));
    if(rd.length)add('tip',L(`技を引きつける相手：${list(rd.map(x=>nm(x.o)))}`,`Redirection: ${list(rd.map(x=>nm(x.o)))}`),
      L('このゆびとまれ・いかりのこなで単体技が吸われます。全体技で一緒に削るか、先に倒しましょう。','Single-target moves get redirected. Use spread moves or KO the redirector first.'),2);
    const tw=opps.filter((x,j)=>likely(j)&&x.has(ADVK.tail));
    if(tw.length)add('tip',L(`おいかぜ：${list(tw.map(x=>nm(x.o)))}`,`Tailwind: ${list(tw.map(x=>nm(x.o)))}`),
      L('4ターンの間、相手の素早さが2倍になります。まもるでターンを稼ぐか、こちらも素早さを操作できると安心です。','Their Speed doubles for 4 turns. Stall with Protect or bring your own speed control.'),2);
  }
  return out.sort((a,b)=>b.pri-a.pri).slice(0,6);
}
function asAdviceHTML(A,PR){
  let items=[];try{items=asAdvice(A,PR)}catch(e){return''}
  if(!items.length&&!ADV_REFS.length)return'';
  return `<div class="sec"><h2>${L('選出のアドバイス','Selection tips')}</h2><span style="font-size:13px;color:var(--dim)">${L('この対面で気をつけること','What to watch for')}</span></div>
  ${items.map(x=>`<div class="adv adv-${x.lv}"><b>${x.lv==='warn'?'⚠ ':'💡 '}${x.t}</b><p>${x.d}</p></div>`).join('')||`<p class="note">${L('特に気をつける点は見つかりませんでした。','Nothing special to watch for.')}</p>`}
  <p class="note" style="color:var(--mute)">${L('対戦でよく知られた考え方をもとに、当サイトがまとめたものです。相手の型は集計データ（なければ自動で決めた型）から推定しています。','Based on widely known battle principles, written by this site. Opponent sets are estimated from usage data (or default sets).')}</p>
  ${ADV_REFS.length?`<div class="sec"><h2>${L('参考になる記事','Further reading')}</h2></div>${ADV_REFS.map(r=>`<a class="row" href="${esc(r.url)}" target="_blank" rel="noopener"><div class="row-m"><div class="row-t">${esc(r.t)}</div><div class="row-s">${esc(r.src)}（${L('外部のサイトが開きます','opens an external site')}）</div></div><span class="chev">${SVG(I.chev,18)}</span></a>`).join('')}`:''}`;
}
