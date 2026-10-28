/* ===================== 背面タップ連携（β） ===================== */
const getTapUrl=()=>{try{return localStorage.getItem('pctapurl')||''}catch(e){return''}};
const setTapUrl=u=>{try{localStorage.setItem('pctapurl',u)}catch(e){}};
/* 背面タップ用パーティコード（v2）：育成を入れたポケモンは「図鑑番号:能力ポイント:性格:持ち物:技:特性」、未入力は図鑑番号だけ。「_」でつなぐ */
function tapCode(){
  return team.map(x=>{
    if(!(x.set&&x.set.sp))return String(x.no);
    const c=teamSet(x.no);if(!c||!c.sp)return String(x.no);
    const mv=(c.moves||[]).map(m=>m.prot?182:m.id).filter(id=>id>0).join('.');
    return [x.no,c.sp.join('.'),`${c.up??-1}.${c.dn??-1}`,c.item||'',mv,c.ab||''].join(':');
  }).join('_').replace(/^/,FMT==='double'?'D!':'');
}
function tapView(){
  setHeader('アプリ・背面タップ連携（β）','#/tools');
  const code=tapCode();const tok=(()=>{try{return localStorage.getItem('pctaptok')||''}catch(e){return''}})();
  const step=(n,t,b)=>`<div class="tstep"><span class="tn">${n}</span><div><b>${t}</b><div class="row-s" style="margin-top:4px;line-height:1.75">${b}</div></div></div>`;
  V.innerHTML=`<div id="tap-root">
  <p class="note" style="padding-top:14px">ゲームを開いたまま、<b>iPhoneの背面を2回たたく</b>だけで、相手の6匹の弱点・素早さ・こちらの攻め役が<b>通知でゲームの上に</b>出ます。Safariに切り替えないので、切断の心配がありません。</p>
  <div class="bnote" style="margin-top:12px"><b>しくみ</b><br>背面タップ → 選出画面のスクリーンショット → 計算用サーバー → 画像を理解できるAI（Claude）が相手のポケモンとタイプを読む → タイプで検算 → 通知<br><span style="color:var(--mute)">相手側の画面には名前が出ないため、絵とタイプのアイコンで判別します。</span></div>
  <div class="bnote" style="margin-top:10px;box-shadow:inset 0 0 0 1px #ff7a00"><b>いまは「見本モード」です</b><br>AI読み取りはまだつないでいません。サーバー・ショートカット・背面タップ・通知までの流れは全部動き、通知には「画像を受け取りました」と<b>見本の相手</b>が出ます。ゲームが切断されないか、通知が見やすいかを先に確かめられます。AIはあとから「6. AI読み取りをつなぐ」で追加でき、ほかの部分は作り直さずに済みます。</div>
  <div class="sec"><h2>1. 計算用サーバーを用意する</h2></div>
  ${step(1,'Cloudflareに無料登録','dash.cloudflare.com でメールアドレスで登録します。')}
  ${step(2,'Workerを作る','「Workers & Pages」→「作成」→「Worker」→ 名前を pokechan-tap などにして「デプロイ」。')}
  ${step(3,'コードを貼り付ける','「コードを編集」で最初のコードを全部消し、下の「サーバーのコード」の中身を貼り付けて「デプロイ」。')}
  ${step(4,'合言葉を登録','Workerの「設定」→「変数とシークレット」で、種類「シークレット」を追加します。<br>・<b>APP_TOKEN</b>＝自分で決めた合言葉（英数字で長めに）<br>合言葉は、他人にサーバーを使われないようにするためのものです（AIをつないだあと、利用料を守る役目もします）。')}
  ${step(5,'URLを控える','https://pokechan-tap.（あなたの名前）.workers.dev のようなURLを、下の欄に入れて「動作確認」。')}
  <div class="btns" style="padding-top:4px"><a class="btn btn-s" href="tools/tap-worker.js" target="_blank" rel="noopener">サーバーのコードを開く</a></div>
  <div class="srch" style="margin-top:4px"><input id="tap-url" value="${getTapUrl()}" placeholder="https://pokechan-tap.xxxx.workers.dev" autocomplete="off" inputmode="url" aria-label="サーバーのURL"></div>
  <div class="srch" style="margin-top:8px"><input id="tap-tok" value="${tok}" placeholder="合言葉（APP_TOKEN）" autocomplete="off" aria-label="合言葉"></div>
  <div class="btns"><button class="btn btn-p" id="tap-ping">動作確認</button></div><p class="vcap" id="tap-ping-msg" style="padding:0 16px"></p>
  <div class="sec"><h2>2. パーティコード</h2></div>
  <p class="note" style="padding-top:0">ショートカットの <b>X-Team</b> に入れると、通知に<b>おすすめ選出（先発＋控え）</b>と<b>相手の予想選出</b>が出ます。育成を入れたポケモンは、その能力ポイント・持ち物・技で計算します。<b>パーティや育成を変えたら、コードを入れ直してください。</b></p>
  <div class="tcode">${code||'（編成でパーティを登録してください）'}</div>
  <div class="btns"><button class="btn btn-s" id="tap-copy" ${code?'':'disabled'}>${SVG(I.share,17)}パーティコードをコピー</button></div>
  <div class="bnote" style="margin:4px 16px 0"><b>iPhoneアプリ「ポケチャン選出」を使う場合（β）</b><br>アプリなら、対戦前に「読み取り開始」を押すだけで、選出画面を自動で見つけて通知します（背面タップの設定は不要）。下の1と5でサーバーのURLと合言葉を入れてから、このボタンを押すと、URL・合言葉・パーティコード・このサイトのアドレスがアプリに入ります（アプリの「攻略」タブでこのサイトを開けるようになります）。</div>
  <div class="btns"><button class="btn btn-p" id="tap-app">アプリに設定を送る</button></div>
  <div class="sec"><h2>3. ショートカットを作る</h2></div>
  <p class="note" style="padding-top:0">iPhoneの「ショートカット」アプリで、右上の「＋」から新しいショートカットを作り、次の5つの部品を順に追加します。部品は下の検索欄に名前を入れると出てきます。</p>
  ${step(1,'スクリーンショットを撮る','検索欄に「スクリーンショット」。')}
  ${step(2,'イメージのサイズを変更','幅を <b>1280</b> にします（高さは自動）。送る量を減らして速くするためです。')}
  ${step(3,'イメージを変換','形式を <b>JPEG</b>、画質を <b>0.8</b> くらいにします。')}
  ${step(4,'URLの内容を取得','URLに<b>サーバーのURL</b>。「▶」を開いて、方法＝<b>POST</b>、要求本文＝<b>ファイル</b>（ファイル＝変換されたイメージ）。「ヘッダ」に2つ追加します。<br>・<b>X-App-Token</b>＝合言葉<br>・<b>X-Team</b>＝パーティコード')}
  ${step(5,'通知を表示','本文に「URLの内容」を選びます。ショートカット名を「相手チェック」にして保存します。')}
  <div class="sec"><h2>4. 背面タップに割り当てる</h2></div>
  ${step(1,'設定を開く','設定 → アクセシビリティ → タッチ → 背面タップ → ダブルタップ。')}
  ${step(2,'ショートカットを選ぶ','一覧の下の方にある「相手チェック」を選びます。')}
  ${step(3,'練習で試す','カジュアルバトルなど負けても困らない対戦の選出画面で、背面を2回たたき、通知が出るか・ゲームが切れないかを確かめます。')}
  <div class="sec"><h2>通知の読み方</h2></div>
  <div class="tnotif"><b>相手チェック</b><br>ガブリアス 弱❄️×4🐉🧚 S169(ス253) 攻セグレ 危カイリ<br>エルレイド? 弱🪽👻🧚 S145 攻イダイ 危ドドゲ!</div>
  <p class="note">弱＝弱点（×4は4倍）、S＝最速の素早さ、(ス)＝こだわりスカーフが多いポケモンのスカーフ時、攻＝こちらでタイプ一致ばつぐんを取れる味方、危＝相手のタイプ一致ばつぐんを受ける味方（!は4倍）。<b>?</b>＝種類の読み取りに自信がないもの（弱点はタイプのアイコンから出しているので正確です）。</p>
  <p class="note">${Object.entries({ノーマル:'⚪',ほのお:'🔥',みず:'💧',でんき:'⚡',くさ:'🌿',こおり:'❄️',かくとう:'👊',どく:'☠️',じめん:'⛰️',ひこう:'🪽',エスパー:'🔮',むし:'🐛',いわ:'🪨',ゴースト:'👻',ドラゴン:'🐉',あく:'🌙',はがね:'⚙️',フェアリー:'🧚'}).map(([t,e])=>`${e}${t}`).join('　')}</p>
  <div class="sec"><h2>5. 試してみる（ゲームなし）</h2></div>
  <p class="note" style="padding-top:0">選出画面のスクリーンショットを選ぶと、ショートカットと同じ形でサーバーに送り、通知の中身を表示します。</p>
  <div class="btns"><label class="btn btn-p" for="tap-file" style="cursor:pointer">スクリーンショットで試す</label></div><input type="file" id="tap-file" accept="image/*" hidden>
  <div id="tap-out"></div>
  <div class="sec"><h2>6. AI読み取りをつなぐ（あとで・任意）</h2></div>
  <p class="note" style="padding-top:0">見本ではなく、実際の相手を読み取れるようになります。スクリーンショットは読み取りのためにAIへ送られ、サーバーには保存しません。読み取り1回ごとに少額の利用料がかかります（目安：普段は1回0.05円ほど、読み直しが入ると1円ほど）。</p>
  ${step(1,'Anthropicに登録','パソコンで console.anthropic.com を開いて登録し、「Billing」でクレジットを少額購入します。')}
  ${step(2,'APIキーを作る','「API Keys」→「Create Key」でキーを作り、表示された文字列を控えます（あとで見られないので注意）。')}
  ${step(3,'Workerに登録','Workerの「設定」→「変数とシークレット」で、シークレット <b>ANTHROPIC_API_KEY</b> にキーを入れて保存。これだけで、見本モードから本番の読み取りに切り替わります。')}
  <p class="note" style="color:var(--dim);padding-bottom:12px">ランクマッチでの補助ツールの利用は、ゲームの規約・大会のルールを確認のうえ、自己責任でお使いください。公式大会での使用はおすすめしません。</p></div>`;
  const root=document.getElementById('tap-root'),ui=document.getElementById('tap-url'),ti=document.getElementById('tap-tok');
  ui.onchange=()=>setTapUrl(ui.value.trim().replace(/\/+$/,''));ti.onchange=()=>{try{localStorage.setItem('pctaptok',ti.value.trim())}catch(e){}};
  const base=()=>(ui.value.trim()||getTapUrl()).replace(/\/+$/,'');
  const show=t=>{document.getElementById('tap-out').innerHTML=`<div class="tnotif"><b>相手チェック</b><br>${String(t).replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'})[c]).replace(/\n/g,'<br>')}</div>`};
  root.addEventListener('click',async e=>{
    if(e.target.closest('#tap-app')){const u=base(),t=(document.getElementById('tap-tok')||{}).value||'';
      if(!u||!t.trim()){toast('先にサーバーのURLと合言葉を入れてください');document.getElementById('tap-url').scrollIntoView({behavior:'smooth',block:'center'});return}
      setTapUrl(u);location.href='pokechan://setup?'+new URLSearchParams({url:u,token:t.trim(),team:code,site:/^https?:/.test(location.protocol)?location.href.split('#')[0]:''}).toString();return}
    if(e.target.closest('#tap-copy')){(navigator.clipboard?navigator.clipboard.writeText(code):Promise.reject()).then(()=>toast('パーティコードをコピーしました')).catch(()=>toast(code));return}
    if(e.target.closest('#tap-ping')){const m=document.getElementById('tap-ping-msg');setTapUrl(base());if(!base()){m.textContent='URLを入れてください';return}
      m.textContent='確認中…';try{const r=await fetch(base());const t=await r.text();m.textContent=r.ok?'✓ '+t:'エラー：'+r.status}catch(err){m.textContent='つながりませんでした。URLが正しいか、デプロイが終わっているか確認してください。'}return}
  });
  document.getElementById('tap-file').onchange=async e=>{
    const f=e.target.files[0];e.target.value='';if(!f)return;if(!base()){show('先にサーバーのURLを入れてください。');return}
    show('読み取り中…（10秒ほどかかることがあります）');
    try{let blob=f;try{const im=await createImageBitmap(f);const sc=Math.min(1,1280/im.width),c=document.createElement('canvas');c.width=Math.round(im.width*sc);c.height=Math.round(im.height*sc);c.getContext('2d').drawImage(im,0,0,c.width,c.height);blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.8))}catch(_){}
      const r=await fetch(base(),{method:'POST',headers:{'Content-Type':'image/jpeg','X-App-Token':ti.value.trim(),'X-Team':code},body:blob});show(await r.text())}
    catch(err){show('サーバーにつながりませんでした。')}
  };
}


