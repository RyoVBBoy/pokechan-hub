/* ===================== ダメージ計算の「積み技・バトンタッチ」（2026/11/16 依頼主） =====================
   ・ランクの値は1つだけ＝各ポケモンの育成の欄のランク（CS.a.stg・CS.d.stg：攻撃・防御・特攻・特防・素早さ）。積み技の札は押すたびにそこへ足す（-6〜+6）。
     育成の欄の5つのランクと同じ値なので、どちらから変えても合う。命中・回避のランクは計算機が扱っていないので入れない。
   ・札に出すのは、そのポケモンがチャンピオンズで覚える技（LSD：当サイトの覚える技の表）のうち、下の SETUP_FX にある技だけ。
   ・SETUP_FX の上がり方は Pokémon Showdown の champions mod（data/mods/champions/moves.ts。ないものは data/moves.ts を引きつぐ）から写した（2026/11/16 に読んだ）。
     チャンピオンズで変わっていた のろい（ゴーストタイプ以外だけ 攻撃+1・防御+1・素早さ-1）・はいすいのじん・ソウルビートはその中身で確かめた。
     入れていない技：かげぶんしん・ちいさくなる（回避だけ）・きあいだめ（急所のランク）・つぼをつく（どれが上がるか決まらない）・パワートリック（入れかえ）・
     キングシールド・じばそうさ・コーチング・デコレーション・アロマミスト（自分のランクではない・味方用）・ほおばる（きのみが要る）。
     HP を払う技（はらだいこ・ソウルビート）の HP、じゅうでん の次のでんき技2倍、とぐろをまく の命中+1 は計算に入れない（札に注記）。
   ・バトンタッチ（226）：champions mod で変わっていない＝ランクの変化をすべて引きつぐ（selfSwitch: copyvolatile）。ランクバトルの決まり（BSS Reg M-C＝Flat Rules）に
     バトンタッチの禁止はない。受け取る側を「バトンタッチを使う側」と決めると、札はその側のポケモンが覚える積み技になり、上げたランクは受け取る側のランクになる
     （受け取る側はその技を覚えていなくてよい）。使う側はバトンタッチを覚えるポケモンだけ・受け取る側と同じポケモンにはできない。
     みがわり・きあいだめ などランク以外の引きつぎは計算に入れない。 */
const SETUP_FX={
  14:{b:{atk:2}},74:{b:{atk:1,spa:1},sun:{atk:2,spa:2}},97:{b:{spe:2}},133:{b:{spd:2}},151:{b:{def:2}},174:{b:{atk:1,def:1,spe:-1},noGhost:true},
  187:{max:'atk',note:'HPの半分を払う（計算に入れない）'},254:{b:{def:1,spd:1},cap:3},268:{b:{spd:1},note:'次のでんき技の威力2倍は計算に入れない'},322:{b:{def:1,spd:1}},
  334:{b:{def:2}},336:{b:{atk:1}},339:{b:{atk:1,def:1}},347:{b:{spa:1,spd:1}},349:{b:{atk:1,spe:1}},397:{b:{spe:2}},417:{b:{spa:2}},
  483:{b:{spa:1,spd:1,spe:1}},489:{b:{atk:1,def:1},note:'命中+1は計算に入れない'},504:{b:{atk:2,spa:2,spe:2,def:-1,spd:-1}},508:{b:{atk:1,spe:2}},
  538:{b:{def:3}},748:{b:{atk:1,def:1,spa:1,spd:1,spe:1},cap:1},775:{b:{atk:1,def:1,spa:1,spd:1,spe:1},note:'HPの1/3を払う（計算に入れない）'},
  842:{b:{def:2}},882:{b:{atk:1,spe:1}}
};
const SETUP_ORDER=[14,417,349,483,347,339,508,504,882,748,775,187,74,336,489,174,97,397,334,151,842,538,133,322,254,268];
const STG_KEYS=[['atk','攻撃','攻'],['def','防御','防'],['spa','特攻','特攻'],['spd','特防','特防'],['spe','素早さ','速']];
const BATON=226;
function setupState(){if(!CS.setup)CS.setup={side:'a',open:false,bp:null,uses:{a:{},d:{}}};return CS.setup}
const setupMon=X=>X&&(megaOf(X.no,X.item)||byNo[X.no]);
/* そのポケモンが使える積み技（チャンピオンズで覚える技の表から） */
function setupMoves(no,mon){
  const ls=LSD[no]&&LSD[no][1]||[];const ghost=mon&&mon.t&&mon.t.includes('ゴースト');
  return SETUP_ORDER.filter(id=>ls.includes(id)&&MD[id]&&!(SETUP_FX[id].noGhost&&ghost));
}
const bpOk=no=>!!(LSD[no]&&LSD[no][1].includes(BATON));
const sameMon=(a,b)=>{const A=byNo[a],B=byNo[b];return a===b||!!(A&&B&&formInfo(A).base===formInfo(B).base)};
function bpPassers(recvNo){return P.filter(p=>bpOk(p.no)&&!sameMon(p.no,recvNo)).sort((x,y)=>x.n.localeCompare(y.n,'ja'))}
const fxOf=(id)=>{const f=SETUP_FX[id];return f.sun&&CS.weather==='sun'?f.sun:f.b};
const STG_EN={atk:'Atk',def:'Def',spa:'SpA',spd:'SpD',spe:'Spe'};
const stgAb=(k,s)=>L(s,STG_EN[k]);
const fxTxt=id=>{const f=SETUP_FX[id];if(f.max)return L('攻撃を+6に','Atk to +6');const b=fxOf(id);return STG_KEYS.filter(([k])=>b[k]).map(([k,,s])=>`${stgAb(k,s)}${b[k]>0?'+':''}${b[k]}`).join(' ')};
const stgSum=st=>STG_KEYS.filter(([k])=>st[k]).map(([k,,s])=>`${stgAb(k,s)}${st[k]>0?'+':''}${st[k]}`).join(' ');
const suMvN=id=>typeof mName==='function'?mName(+id):MD[id][0];
const SU_NOTE_EN={187:'Costs half of max HP (not included)',268:"Doubling the next Electric move isn't included",489:"Accuracy +1 isn't included",775:'Costs 1/3 of max HP (not included)'};
const suNote=id=>L(SETUP_FX[id].note,SU_NOTE_EN[id]||SETUP_FX[id].note);
/* 1回使う：ランクを足す（-6〜+6）。何も変わらなければ失敗（ゲームと同じく使えない）。回数に上限のある技は数える */
function setupUse(side,id){
  const S=setupState(),X=CS[side],f=SETUP_FX[id],st=X.stg,u=S.uses[side];
  if(f.cap&&(u[id]||0)>=f.cap)return f.cap===1?L(`${suMvN(id)}は1回しか使えません`,`${suMvN(id)} can only be used once`):L(`${suMvN(id)}は${f.cap}回までです`,`${suMvN(id)} can be used up to ${f.cap} times`);
  if(f.max){if((st.atk||0)>=6)return L('攻撃はもう最大（+6）です','Attack is already at +6');st.atk=6;u[id]=(u[id]||0)+1;return null}
  const b=fxOf(id);let ch=false;
  for(const [k] of STG_KEYS)if(b[k]){const o=st[k]||0,v=Math.max(-6,Math.min(6,o+b[k]));if(v!==o)ch=true;st[k]=v}
  if(!ch)return L('これ以上ランクが変わりません（-6〜+6）','No stat can change any further (-6 to +6)');
  u[id]=(u[id]||0)+1;return null;
}
/* 手で1段ずつ変える（2026/11/17 依頼主）：＋／−で、選んでいる側のポケモンのランクを1段。-6〜+6 の外へは動かさない（ボタンを止める）。
   積み技の札・育成の欄と同じ値（CS[side].stg）を変える。回数の覚え（たくわえる等）とバトンタッチの設定はそのまま（手で変えるのは育成の欄と同じ扱い） */
function setupStep(side,k,d){
  const st=CS[side].stg,o=st[k]||0,v=Math.max(-6,Math.min(6,o+(d>0?1:-1)));
  if(v===o)return o>0?L('これ以上上がりません（+6）','Already at +6'):L('これ以上下がりません（-6）','Already at -6');
  st[k]=v;return null;
}
function setupStepsHTML(side){
  const st=CS[side].stg;
  return `<div class="su-steps" role="group" aria-label="${L('ランクを1段ずつ変える','Change stages one at a time')}">${STG_KEYS.map(([k,n])=>{const v=st[k]||0,cls=v>0?'pos':v<0?'neg':'zero',nn=L(n,{atk:'Attack',def:'Defense',spa:'Sp. Atk',spd:'Sp. Def',spe:'Speed'}[k]);
    return `<div class="su-st su-${cls}"><span class="su-st-n">${nn}</span>
      <button class="su-st-b" data-su-st="${k}" data-su-d="-1"${v<=-6?' disabled':''} aria-label="${L(`${n}を1段下げる`,`Lower ${nn} by one stage`)}">−</button>
      <output class="su-st-v num" aria-live="polite" aria-label="${L(`${n}のランク`,`${nn} stage`)} ${v>0?'+'+v:v}">${v>0?'+'+v:v===0?'±0':'−'+(-v)}</output>
      <button class="su-st-b" data-su-st="${k}" data-su-d="1"${v>=6?' disabled':''} aria-label="${L(`${n}を1段上げる`,`Raise ${nn} by one stage`)}">＋</button></div>`}).join('')}</div>`;
}
function setupReset(side){const S=setupState(),X=CS[side];STG_KEYS.forEach(([k])=>X.stg[k]=0);S.uses[side]={}}
/* ポケモンを変えたとき（21-calc.js から）：その側の回数の覚えとバトンタッチを捨てる（新しいポケモンのランクは calcX で0） */
function setupSideChanged(side){const S=setupState();S.uses[side]={};if(S.bp&&S.bp.side===side)S.bp=null}
/* 攻守の入れかえ（21-calc.js の calcSwapData から）：ランクはポケモンといっしょに入れかわるので、覚えも入れかえる */
function setupSwap(){const S=setupState();S.uses={a:S.uses.d||{},d:S.uses.a||{}};if(S.bp)S.bp.side=S.bp.side==='a'?'d':'a';S.side=S.side==='a'?'d':'a'}
function bpSet(side,from){
  const S=setupState(),X=CS[side];
  if(!from){if(S.bp&&S.bp.side===side){STG_KEYS.forEach(([k])=>X.stg[k]=S.bp.prev[k]||0);S.bp=null;S.uses[side]={}}return null}
  if(!bpOk(from))return L('このポケモンはバトンタッチを覚えません','This Pokémon cannot learn Baton Pass');
  if(sameMon(from,X.no))return L('同じポケモンにはバトンタッチできません','A Pokémon cannot Baton Pass to the same Pokémon');
  const prev=S.bp&&S.bp.side===side?S.bp.prev:Object.fromEntries(STG_KEYS.map(([k])=>[k,X.stg[k]||0]));
  if(S.bp&&S.bp.side!==side)bpSet(S.bp.side,null);
  S.bp={side,from,prev};setupReset(side);return null;
}
function setupHTML(R){
  if(!R)return '';
  const S=setupState(),side=S.side,X=CS[side],bp=S.bp&&S.bp.side===side?S.bp:null;
  if(S.bp&&!byNo[S.bp.from])S.bp=null;
  const src=bp?bp.from:X.no,srcMon=bp?byNo[bp.from]:setupMon(X),ids=setupMoves(src,srcMon);
  const nm=s=>esc(byNo[CS[s].no].n),sum=s=>stgSum(CS[s].stg)||L('なし','none');
  const bpAny=S.bp?L(`（${esc(byNo[S.bp.from].n)}からバトンタッチ）`,` (Baton Pass from ${esc(byNo[S.bp.from].n)})`):'';
  const sideN=s=>s==='a'?L('攻撃側','Attacker'):L('受ける側','Defender');
  const passers=bpPassers(X.no);
  return `<details class="su-box" id="su-box"${S.open?' open':''}><summary><b>${L('積み技・ランク','Setup moves & stat stages')}</b><span class="su-sum" data-notr>${sideN('a')}${L('：',': ')}${sum('a')}${S.bp&&S.bp.side==='a'?bpAny:''}${L('／',' / ')}${sideN('d')}${L('：',': ')}${sum('d')}${S.bp&&S.bp.side==='d'?bpAny:''}</span></summary>
    <div class="su-in">
      <div class="pills su-side" role="group" aria-label="${L('ランクを変えるポケモン','Pokémon whose stages to change')}">${['a','d'].map(s=>`<button class="pill" data-su-side="${s}" aria-pressed="${s===side}" data-notr>${sideN(s)}${L('：',': ')}${nm(s)}</button>`).join('')}</div>
      ${bp?`<p class="su-bp-note" data-notr>${L(`<b>${esc(byNo[bp.from].n)}</b>（バトンタッチを使う側）が積んだランクを、<b>${nm(side)}</b>（受け取る側）が引きつぎます。${nm(side)}はこの積み技を覚えていなくてかまいません。`,
        `<b>${nm(side)}</b> (receiver) inherits the stat stages set up by <b>${esc(byNo[bp.from].n)}</b> (Baton Pass user). ${nm(side)} does not need to learn these setup moves.`)}</p>`:''}
      <div class="su-h"><span data-notr>${L(`${bp?esc(byNo[bp.from].n):nm(side)}の積み技`,`${bp?esc(byNo[bp.from].n):nm(side)}'s setup moves`)}</span><small>${L('押すたびに1回ぶん（チャンピオンズで覚える技だけ）','One use per tap (only moves learnable in Champions)')}</small></div>
      ${ids.length?`<div class="pills su-chips">${ids.map(id=>`<button class="pill su-chip" data-su-mv="${id}" aria-label="${esc(suMvN(id))}（${fxTxt(id)}）"${SETUP_FX[id].note?` title="${esc(suNote(id))}"`:''} data-notr>${esc(suMvN(id))}<small>${fxTxt(id)}${(S.uses[side][id]||0)?` ×${S.uses[side][id]}`:''}</small></button>`).join('')}</div>`
        :`<p class="note su-none" data-notr>${L(`${bp?esc(byNo[bp.from].n):nm(side)}が覚える積み技はありません。`,`${bp?esc(byNo[bp.from].n):nm(side)} learns no setup moves.`)}</p>`}
      <div class="su-row"><span class="su-now" data-notr>${L('いまのランク：','Current stages: ')}<b>${sum(side)}</b></span><button class="pill su-reset" data-su-reset>${L('ランクを0に戻す','Reset stages')}</button></div>
      ${setupStepsHTML(side)}
      <div class="natr su-bp"><span>${L('バトンタッチ','Baton Pass')}</span><select class="sel" data-su-bp data-notr aria-label="${L(`バトンタッチを使うポケモン（${sideN(side)}が受け取る）`,`Baton Pass user (${sideN(side)} receives)`)}">
        <option value="">${L('使わない（自分で積む）','None (sets up itself)')}</option>${passers.map(p=>`<option value="${p.no}"${bp&&bp.from===p.no?' selected':''}>${L(`${esc(p.n)}から受け取る`,`Receive from ${esc(p.n)}`)}</option>`).join('')}</select></div>
      ${ids.some(id=>SETUP_FX[id].note)?`<p class="note su-notes" data-notr>${ids.filter(id=>SETUP_FX[id].note).map(id=>`${esc(suMvN(id))}${L('：',': ')}${esc(suNote(id))}`).join(L('／',' / '))}</p>`:''}
    </div></details>`;
}
function setupBind(root,redraw){
  const S=setupState(),box=root.querySelector('#su-box');if(!box)return;
  box.addEventListener('toggle',()=>{S.open=box.open});
  box.querySelectorAll('[data-su-side]').forEach(b=>b.onclick=()=>{S.side=b.dataset.suSide;redraw()});
  box.querySelectorAll('[data-su-mv]').forEach(b=>b.onclick=()=>{const e=setupUse(S.side,+b.dataset.suMv);if(e)toast(e);redraw()});
  const r=box.querySelector('[data-su-reset]');if(r)r.onclick=()=>{setupReset(S.side);redraw()};
  box.querySelectorAll('[data-su-st]').forEach(b=>b.onclick=()=>{const e=setupStep(S.side,b.dataset.suSt,+b.dataset.suD);if(e)toast(e);redraw();
    /* 描き直したあとも、押したボタンに焦点を戻す（続けて押せるように。止まったボタンなら同じ能力のもう一方へ） */
    const q=document.querySelector(`#su-box [data-su-st="${b.dataset.suSt}"][data-su-d="${b.dataset.suD}"]`);const f=q&&!q.disabled?q:document.querySelector(`#su-box [data-su-st="${b.dataset.suSt}"]:not([disabled])`);if(f)f.focus({preventScroll:true})});
  const sel=box.querySelector('[data-su-bp]');if(sel)sel.onchange=()=>{const e=bpSet(S.side,+sel.value||0);if(e)toast(e);redraw()};
}
