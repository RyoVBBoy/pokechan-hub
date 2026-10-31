/* ===================== 当サイトの使用率（worker/src/usage.js の集計を読む） =====================
   選出画面の読み取り・対戦の記録で見た相手の6匹と、利用者が保存した育成から集計したもの。
   流行の画面に「当サイトの集計」、ポケモンの解説に「当サイトの利用者の育成」と、それをもとにした型を出す */
const USAGE={single:null,double:null,st:{}};
function usageGet(fmt,cb){
  if(USAGE[fmt]||USAGE.st[fmt])return;
  const c=lsGet('pcusage_'+fmt,6*36e5);if(c){USAGE[fmt]=c;return}
  if(typeof COMM_API==='undefined'||!COMM_API||/^file:/.test(location.href))return;
  USAGE.st[fmt]='loading';
  fetch(COMM_API+'/api/usage?fmt='+fmt).then(r=>r.ok?r.json():null).then(d=>{if(d&&d.fmt){USAGE[fmt]=d;lsSet('pcusage_'+fmt,d);cb&&cb()}}).catch(()=>{}).finally(()=>{USAGE.st[fmt]='done'});
}
/* 解説で使う：そのポケモンの育成の集計（5件以上のときだけ） */
const usageBuildOf=(no,fmt)=>{const d=USAGE[fmt];const b=d&&d.builds&&d.builds[no];return b&&b.n>=5?b:null};
/* 集計から型を1つ組む（いちばん多い持ち物・特性・技4つ・性格・能力ポイント） */
function usageSet(p,b){
  const ls=LSD[p.no]?LSD[p.no][1]:[];
  const abs=(ABD[p.no]||[]).map(a=>a[0]),ab=(b.ab.find(([k])=>abs.includes(k))||[])[0]||null;
  const it=(b.it.find(([k])=>ITEMN[k])||[])[0]||null;
  const mv=b.mv.map(x=>x[0]).filter(id=>(id===182||ls.includes(id))&&(MV[id]||MD[id])).slice(0,4);
  const nat=b.nat[0]?b.nat[0][0].split('-').map(Number):[-1,-1];
  const sp=b.sp[0]?b.sp[0][0].split('-').map(Number):null;
  if(mv.length<2||!sp)return null;
  return{title:'当サイトでよく使われている型',why:`当サイトの利用者の育成${b.n}件で、それぞれいちばん多い持ち物・特性・技・性格・能力ポイントを組み合わせたものです。`,ab,item:it,up:nat[0],dn:nat[1],sp,moves:mv,k:/^choice|lifeorb|focussash|expertbelt/.test(it||'')?'attacker':it==='leftovers'?'bulky':'attacker',usage:true};
}
function usageGuideHTML(p,fmt,lk){
  const b=usageBuildOf(p.no,fmt);if(!b)return '';
  const row=(t,a,f)=>a.length?`<div class="gus"><b>${t}</b><div>${a.map(([k,v])=>`<span>${f(k)} <i>${v}%</i></span>`).join('')}</div></div>`:'';
  return `<div class="sec"><h2>当サイトの利用者の育成</h2><span style="font-size:12px;color:var(--dim)">${fmt==='double'?'ダブル':'シングル'}・${b.n}件</span></div>
    <div class="gdoc" style="padding-top:0">${row('持ち物',b.it,k=>`<a href="${lk('#/item/'+k)}" style="color:var(--acc)">${esc(ITEMN[k]||k)}</a>`)}${row('特性',b.ab,k=>esc(ABN[k]||k))}${row('技',b.mv.slice(0,8),id=>`<a href="${lk('#/move/'+id)}" style="color:var(--acc)">${esc(mName(id))}</a>`)}${row('性格',b.nat,k=>{const [u,d]=k.split('-').map(Number);return esc(natName(u,d)||'—')})}</div>
    <p class="note" style="padding-top:0;color:var(--mute)">ログインした利用者が保存したパーティ・上位パーティの登録・対戦の記録から集計しています（だれの育成かは出しません）。</p>`;
}
function usageMetaHTML(){
  const d=USAGE[FMT];
  if(!d)return '';
  const top=d.seen.slice(0,20);
  return `<div class="sec"><h2>当サイトの集計</h2><span style="font-size:13px;color:var(--dim)">直近${d.days}日・選出画面${d.previews}件</span></div>
    ${top.length&&d.previews>=20?top.map((x,i)=>byNo[x[0]]?`<a class="row" href="#/p/${x[0]}"><span class="rk">${i+1}</span><span class="av">${stamp(byNo[x[0]])}</span><div class="row-m"><div class="row-t">${byNo[x[0]].n}</div><div class="row-s">相手の選出画面の ${x[2]}% に登場</div></div><span class="chev">${SVG(I.chev,18)}</span></a>`:'').join('')
      :`<div class="bnote" style="margin:8px 16px">まだ数が少ないため、集計中です。選出アシストの「スクショから読む」や「対戦の振り返り」を使うと、相手のポケモンがこの集計に入ります（だれが見たかは出しません）。</div>`}`;
}
