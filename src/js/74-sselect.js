/* ===================== 名前で絞り込める選ぶ欄（2026/11/12 依頼主「長い一覧から探すのが大変」） =====================
   持ち物（約85種）・特性・技のような長い一覧（<select>）に、押すと開く「検索できる選ぶ画面」を重ねる。
   ・中身は今までの <select> のまま（値・並び順・グループ・採用率の表示・確かめの処理はそのまま使う）。選ぶと select の値を変えて change を出す。
     ＝データの形や、覚える技・持てる特性の決まりは今までの画面が守る。新しい人気順は作らない（select の並び＝育成の画面ではランクバトルで使われている順）。
   ・ゲームに関係しない部品（どの select にも使える）。文字の見分けは kfold（ひらがな・カタカナ・小さい字・大きい字を同じに見る）。
   ・使い方：ssEnhance(親の要素, 'CSS の選び方')。同じ select に2回はつけない（data-ss）。画面を描き直したら、もう一度呼ぶ。 */
const ssNorm=s=>{s=String(s||'');try{return typeof kfold==='function'?kfold(s):s.toLowerCase()}catch(e){return s.toLowerCase()}};
const ssText=o=>(o&&o.textContent||'').trim();
function ssEnhance(root,q){
  if(!root)return;
  root.querySelectorAll(q).forEach(sel=>{
    if(sel.tagName!=='SELECT'||sel.dataset.ss)return;
    sel.dataset.ss='1';
    const lab=(sel.getAttribute('aria-label')||(sel.closest('.natr')&&sel.closest('.natr').querySelector('span')||{}).textContent||'').trim()||'項目';
    const b=document.createElement('button');b.type='button';b.className='sel ss-btn';b.setAttribute('aria-haspopup','dialog');
    if(sel.hasAttribute('data-notr'))b.setAttribute('data-notr','');
    const paint=()=>{const t=ssText(sel.options[sel.selectedIndex]);b.textContent=t||'（未選択）';b.setAttribute('aria-label',`${lab}：${t||'未選択'}（押すと名前で探して選べます）`)};
    paint();b.ssPaint=paint;
    sel.classList.add('ss-src');sel.tabIndex=-1;sel.setAttribute('aria-hidden','true');
    sel.after(b);
    sel.addEventListener('change',paint);
    b.onclick=()=>ssOpen(sel,lab,b);
  });
}
function ssOpen(sel,title,btn){
  const full=!matchMedia('(min-width:700px)').matches;
  /* select の中身を並べる（グループの見出しも） */
  const items=[];
  [...sel.children].forEach(c=>{
    if(c.tagName==='OPTGROUP'){[...c.children].forEach(o=>items.push({o,g:c.label}))}
    else if(c.tagName==='OPTION')items.push({o:c,g:''});
  });
  items.forEach((x,i)=>{const t=ssText(x.o),k=t.indexOf('　');x.i=i;x.t=t;x.main=k>0?t.slice(0,k):t;x.sub=k>0?t.slice(k+1).trim():'';x.n=ssNorm(t)+' '+ssNorm(x.g)});
  const curV=sel.value;
  const o=document.createElement('div');o.className='psheet mpsheet ssheet'+(full?' mpfull':'');
  o.innerHTML=`<div class="psheet-bg"></div><div class="psheet-p" role="dialog" aria-modal="true" aria-label="${esc(title)}を選ぶ">
    <div class="mp-top"><div class="srch">${SVG(I.search,18)}<input class="ss-q" placeholder="${esc(title)}の名前で探す（ひらがなOK）" autocomplete="off" enterkeyhint="done" aria-label="${esc(title)}の名前で探す" role="combobox" aria-expanded="true" aria-controls="ss-list"></div>${full?'<button class="mp-x">やめる</button>':''}</div>
    <div class="ss-cur">いまの${esc(title)}：<b>${esc(ssText(sel.options[sel.selectedIndex])||'未選択')}</b></div>
    <div class="mp-list" id="ss-list" role="listbox" aria-label="${esc(title)}の一覧"></div>${full?'':'<button class="psheet-x">やめる</button>'}</div>`;
  const vv=window.visualViewport,fit=()=>{if(!full||!vv)return;o.style.top=vv.offsetTop+'px';o.style.height=vv.height+'px'};
  if(full&&vv){fit();vv.addEventListener('resize',fit);vv.addEventListener('scroll',fit)}
  document.body.appendChild(o);requestAnimationFrame(()=>o.classList.add('on'));
  const qi=o.querySelector('.ss-q'),list=o.querySelector('#ss-list');let act=-1,vis=[],fin=false;
  const done=pickI=>{if(fin)return;fin=true;document.removeEventListener('keydown',onEsc,true);
    if(full&&vv){vv.removeEventListener('resize',fit);vv.removeEventListener('scroll',fit)}
    try{qi.blur()}catch(e){}
    o.classList.remove('on');setTimeout(()=>o.remove(),180);
    if(pickI!=null){const it=items[pickI];if(it&&it.o.value!==sel.value){sel.value=it.o.value;sel.dispatchEvent(new Event('change',{bubbles:true}))}
      if(btn.ssPaint)btn.ssPaint()}
    if(btn.isConnected)try{btn.focus({preventScroll:true})}catch(e){}
  };
  const draw=()=>{
    const q=ssNorm(qi.value.trim());
    vis=items.filter(x=>!q||x.n.includes(q));
    let h='',lg=null;
    vis.forEach(x=>{if(x.g!==lg){lg=x.g;if(x.g)h+=`<div class="mp-h" role="presentation">${esc(x.g)}</div>`}
      const on=x.o.value===curV;
      h+=`<button type="button" class="row mp-r ss-r${on?' on':''}" role="option" aria-selected="${on}" data-i="${x.i}" id="ss-o${x.i}"><span class="row-m"><span class="row-t">${esc(x.main)}</span>${x.sub?`<span class="row-s">${esc(x.sub)}</span>`:''}</span>${on?`<span class="ss-ck" aria-hidden="true">${SVG(I.check||'<path d="m5 12.5 4.5 4.5L19 7.5"/>',18)}</span>`:''}</button>`});
    list.innerHTML=h||`<p class="empty" style="padding:28px 16px">「${esc(qi.value.trim())}」に合うものがありません。<br>文字を消すと、すべて表示されます。</p>`;
    act=q&&vis.length?0:-1;mark();
  };
  const mark=()=>{list.querySelectorAll('.ss-r').forEach(b=>b.classList.toggle('act',vis[act]&&+b.dataset.i===vis[act].i));
    if(act>=0&&vis[act]){qi.setAttribute('aria-activedescendant','ss-o'+vis[act].i);const b=list.querySelector('#ss-o'+vis[act].i);if(b)b.scrollIntoView({block:'nearest'})}else qi.removeAttribute('aria-activedescendant')};
  qi.oninput=draw;
  qi.onkeydown=e=>{
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!vis.length)return;act=e.key==='ArrowDown'?Math.min(vis.length-1,act+1):Math.max(0,act-1);mark()}
    else if(e.key==='Enter'){e.preventDefault();const x=vis[act>=0?act:0];if(x)done(x.i)}
    else if(e.key==='Escape'){e.preventDefault();done(null)}};
  /* Esc はどこに入力の場所があっても閉じる（スマホは検索欄に入らないで開くため） */
  const onEsc=e=>{if(e.key==='Escape'&&e.target!==qi){e.preventDefault();done(null)}};
  document.addEventListener('keydown',onEsc,true);
  list.onclick=e=>{const b=e.target.closest('[data-i]');if(b)done(+b.dataset.i)};
  o.querySelector('.psheet-bg').onclick=()=>done(null);o.querySelector('.psheet-x,.mp-x').onclick=()=>done(null);
  draw();
  /* いま選んでいるものを見える所へ。スマホはキーボードで一覧が隠れないよう、自分で検索欄を押したときだけ文字を入れる */
  const on=list.querySelector('.ss-r.on');if(on)on.scrollIntoView({block:'center'});
  if(!full)qi.focus();
}
