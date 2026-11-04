/* ===================== お問い合わせ・間違いの報告（2026/11/04、サーバーは worker/src/contact.js） =====================
   ・#/contact：お問い合わせ（種類・内容・返事がほしいときの連絡先＝任意）
   ・#/contact/<どの画面から（encodeURIComponent した #/…）>：「間違いを報告」から来たとき。種類は「データの間違い」から始め、画面の名前を出す
   ・どの画面の下にも「間違いを報告」（index.html の data-report）。図鑑のページにも。ログインしなくても送れる */
const CT_KINDS=[['data','データの間違い'],['bug','動かない・表示がおかしい'],['idea','ほしい機能・要望'],['other','そのほか']];
const reportLink=()=>'#/contact/'+encodeURIComponent(cur||'#/');
/* どの画面かを、人が読める名前にする */
function pageLabel(h){
  const [k,a]=String(h||'').replace(/^#\/?/,'').split('/');
  const p=a&&byNo[+a];
  return ({p:p&&`${p.n}の図鑑`,counter:p&&`${p.n}の対策`,move:a&&MD[+a]&&`技「${mName(+a)}」`,ability:a&&`特性「${ABN[a]||a}」`,item:a&&`持ち物「${ITEMN[a]||a}」`,
    calc:'ダメージ計算',assist:'選出アシスト',team:'パーティ',edit:'育成',import:'画像から取り込む',meta:'流行のポケモン',types:'タイプ相性',pair:'相性のいい仲間を探す',
    learn:'攻略ガイド',arch:'構築の型',season:'上位パーティ',replay:'対戦の振り返り','':'ホーム',tl:'タイムライン',search:'検索',dex:'図鑑の一覧'})[k]||String(h||'');
}
function contactView(arg){
  const from=arg?decodeURIComponent(arg):'';
  setHeader(from?'間違いを報告':'お問い合わせ',from&&/^#\//.test(from)?from:'#/');
  let kind=from?'data':'idea';
  const draw=()=>{
    V.innerHTML=`<div class="ct">
      <p class="note" style="padding-top:14px">${from?`<b>${esc(pageLabel(from))}</b>の間違いや、おかしなところを教えてください。いただいた内容は運営者が確認して直します。`:'サイトについてのご意見・ご要望・不具合などを送れます。ログインしなくても送れます。'}</p>
      <div class="ct-k" role="radiogroup" aria-label="種類">${CT_KINDS.map(([k,l])=>`<button class="pill" role="radio" data-k="${k}" aria-pressed="${k===kind}">${l}</button>`).join('')}</div>
      <div class="cform" style="padding:0 16px">
        <label>内容<textarea id="ct-b" rows="6" maxlength="2000" placeholder="${kind==='data'?'例：ガブリアスの素早さの種族値が、ゲームでは〇〇でした。':'例：〇〇の画面で、△△を押すと動かなくなります（iPhone）。'}"></textarea></label>
        <label>返事がほしいときの連絡先（任意）<input id="ct-r" maxlength="100" autocomplete="email" placeholder="メールアドレスか X のID"></label>
      </div>
      <p class="note" style="color:var(--mute);padding-top:0">連絡先は運営者だけが見ます。ほかの人には表示されません。すべてのお問い合わせに返事ができるとは限りません。個人情報は書かないでください。</p>
      <div class="btns"><button class="btn btn-p" id="ct-send">送る</button></div><div id="ct-msg"></div></div>`;
    V.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{const t=document.getElementById('ct-b').value,r=document.getElementById('ct-r').value;kind=b.dataset.k;draw();document.getElementById('ct-b').value=t;document.getElementById('ct-r').value=r});
    document.getElementById('ct-send').onclick=async e=>{
      const btn=e.currentTarget,body=document.getElementById('ct-b').value.trim(),reply=document.getElementById('ct-r').value.trim();
      const msg=t=>{document.getElementById('ct-msg').innerHTML=`<div class="bnote" style="margin:8px 16px">${esc(t)}</div>`};
      if(body.length<5){msg('内容を5文字以上で書いてください。');return}
      btn.disabled=true;
      try{
        const h={'Content-Type':'application/json'};
        try{if(typeof AUTH!=='undefined'&&AUTH.user)h.Authorization='Bearer '+await AUTH.user.getIdToken()}catch(_){}
        let r;try{r=await fetch(COMM_API+'/api/contact',{method:'POST',headers:h,body:JSON.stringify({kind,body,page:from||'',reply})})}catch(_){throw new Error('送れませんでした。電波のよいところでもう一度試してください。')}
        const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'送れませんでした。');
        V.innerHTML=`<div class="ct-done"><div class="ct-ok">✓</div><h2>送りました</h2><p>ありがとうございます。運営者が確認します。${reply?'返事が必要なときは、書いていただいた連絡先にお送りします。':''}</p>
          <div class="btns">${from&&/^#\//.test(from)?`<a class="btn btn-p" href="${esc(from)}">元の画面に戻る</a>`:''}<a class="btn btn-s" href="#/">ホームへ</a></div></div>`;
      }catch(err){msg(err.message);btn.disabled=false}};
  };
  draw();
}
/* どの画面の下にもある「間違いを報告」：いまの画面を付けて開く */
/* ほかのリンクの処理（06-router.js）より先に動くよう、捕まえる段階（capture）で受ける */
document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('[data-report]');if(!a)return;e.preventDefault();e.stopPropagation();const to=reportLink();if(typeof drawerClose==='function'&&DR.open)drawerClose();nav(to)},true);
