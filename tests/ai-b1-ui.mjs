// Game Kid/s AI B1 の画面のテスト：自由文のパーティ相談 → 形式を聞く → 候補 → 続き（2つ目・残したい・メガの姿）／回数切れで質問を残す。
// Worker は手元のコードそのもの（模擬の提供元）。外部への送信はしない。
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {makeD1} from './d1mock.mjs';
import {ROOT,ORIGIN,makeSigner,migrate,baseEnv} from './ai-helpers.mjs';
import {seedB1} from './ai-b1-fixture.mjs';
const S=await makeSigner();
globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
const OUT=[];globalThis.fetch=async u=>{u=String(u);if(u.includes('securetoken@system.gserviceaccount.com'))return new Response(JSON.stringify({keys:[S.jwk]}));OUT.push(u);throw new Error('blocked')};
const mod=await import(path.join(ROOT,'worker/dist/worker_test.js'));const w=mod.default,A=mod.__ai;
async function mkEnv(o){const AI=makeD1();await migrate(AI);const env=baseEnv({AI_DB:AI,DB:makeD1(),AI_B1_ENABLED:'1',AI_RL_USER_MIN:'1000',AI_RL_IP_MIN:'1000',...o});env.__ids=await seedB1(env,null,A);return env}
let env=await mkEnv({AI_FREE_DAY:'100',AI_FREE_MONTH:'100'});
const TOKEN=await S.sign('b1-user');
const SHOTS=[];const R={n:0,ok:0};let bad=0;const res=(name,cond,info)=>{R.n++;if(cond)R.ok++;else{bad++;console.error('NG',name,info!==undefined?JSON.stringify(info).slice(0,400):'')}};
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const URL0='file://'+path.join(ROOT,'dist/index.html');
async function page(vp){
  const ctx=await b.newContext({viewport:vp,locale:'ja-JP'});const pg=await ctx.newPage();
  const errs=[];pg.on('pageerror',e=>errs.push(e.message));
  await pg.route('**/api/battles',async r=>r.fulfill({
    status:r.request().method()==='OPTIONS'?204:200,
    headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Content-Type':'application/json'},
    body:r.request().method()==='OPTIONS'?undefined:JSON.stringify({battles:[]})
  }));
  await pg.route('https://pokechan-tap.pokechan.workers.dev/api/ai/**',async r=>{
    const q=r.request(),hd={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Content-Type':'application/json'};
    if(q.method()==='OPTIONS')return r.fulfill({status:204,headers:hd});
    const h={origin:ORIGIN,authorization:q.headers().authorization||''};if(q.method()==='POST')h['content-type']='application/json';
    const x=await w.fetch(new Request(q.url().replace('https://pokechan-tap.pokechan.workers.dev','https://w.example'),{method:q.method(),headers:h,body:q.method()==='POST'?q.postData():undefined}),env,{waitUntil(){}});
    return r.fulfill({status:x.status,headers:hd,body:await x.text()})});
  await pg.addInitScript(()=>{try{sessionStorage.setItem('pcaitest','1')}catch(e){}});
  await pg.goto(URL0+'#/');await pg.waitForTimeout(400);
  await pg.evaluate(t=>{AI_CFG.auditHold=false;AUTH.user={uid:'b1-user',email:null,getIdToken:async()=>t}},TOKEN);
  await pg.evaluate(()=>{location.hash='#/ai'});await pg.waitForTimeout(500);
  return{pg,ctx,errs};
}
for(const vp of [{width:390,height:844},{width:1280,height:900}]){
  const {pg,ctx,errs}=await page(vp),W=vp.width;
  const shot=async n=>{const f=`tests/out/ai-b1-${W}-${n}.png`;fs.mkdirSync(path.join(ROOT,'tests/out'),{recursive:true});await pg.screenshot({path:path.join(ROOT,f)});SHOTS.push(f)};
  const askUI=async q=>{const n0=await pg.$$eval('#ai-log .ai-msg.bot',x=>x.length);
    if(q!==null){await pg.fill('#ai-q',q);await pg.click('#ai-send')}
    await pg.waitForFunction(n=>document.querySelectorAll('#ai-log .ai-msg.bot').length>=n&&!document.querySelector('#ai-log .ai-wait'),n0+(q===null?0:1),{timeout:10000});
    return pg.$eval('#ai-log .ai-msg.bot:last-child',e=>e.textContent)};
  const names=()=>pg.$$eval('#ai-log .ai-msg.bot:last-child .ai-tm',x=>x.map(e=>[...e.querySelectorAll('.ai-tm-p')].map(p=>p.textContent).join(',')));
  let t=await askUI('今オススメのパーティ教えて');
  res(W+' 形式が無ければ聞く',/シングルとダブルで答えが変わります/.test(t)&&(await pg.$$('#ai-log .ai-msg.bot:last-child [data-aichoose]')).length===2,t);
  await pg.click('#ai-log .ai-msg.bot:last-child [data-aichoose="double"]');t=await askUI(null);
  let tm=await names();
  res(W+' 候補は3件・6匹ずつ',tm.length===3&&tm.every(x=>x.split(',').length===6),tm);
  res(W+' 現行を確認できないことを書く',/「今のおすすめ」とは言えません/.test(t)&&/過去のシーズン/.test(t),t);
  res(W+' 出どころ（運営が確認した記録・シーズンへのリンク）',/運営が証拠を確認した上位の記録/.test(t)&&(await pg.$$eval('#ai-log .ai-msg.bot:last-child .ai-tm a',as=>as.every(a=>/^#\/season\/\d+$/.test(a.getAttribute('href'))))),t);
  res(W+' 登録した人・コメントは出さない',!/player-|コメント（AI/.test(t));
  res(W+' 続きの例を出す',(await pg.$$('#ai-log .ai-msg.bot:last-child [data-aifill]')).length>=1);
  res(W+' 会話の番号を覚える',await pg.evaluate(()=>/^c[0-9a-f]{32}$/.test(AI_ST.conv||'')));
  await shot('candidates');
  t=await askUI('2つ目で、メガリザードンYは残したい');tm=await names();
  res(W+' 続き：2つ目に近く、メガリザードンYを残す',tm.length===1&&tm[0].includes('メガリザードンY')&&/案2と\d匹が同じ/.test(t)&&/残す メガリザードンY/.test(t),{tm,t});
  t=await askUI('さっきの案でメガリザードンは残したい');
  /* 前の条件（Y）が残っているので、聞かずにそのまま */
  res(W+' 条件は引きつぐ（Yのまま・聞き直さない）',!(await pg.$('#ai-log .ai-msg.bot:last-child [data-aichoose]'))&&/メガリザードンY/.test(t),t);
  /* 新しく相談：メガの姿を聞く → 選ぶと同じ相談に続ける */
  await pg.evaluate(()=>{AI_ST.conv=null});
  t=await askUI('ダブルでメガリザードンを入れたおすすめのパーティ教えて');
  const ch=await pg.$$eval('#ai-log .ai-msg.bot:last-child [data-aichoose]',x=>x.map(e=>e.textContent));
  res(W+' メガの姿で変わるときだけ聞く',/どのメガシンカの姿か/.test(t)&&ch.includes('メガリザードンX')&&ch.includes('メガリザードンY'),{t,ch});
  await pg.click('#ai-log .ai-msg.bot:last-child [data-aichoose="sp:10034"]');t=await askUI(null);tm=await names();
  res(W+' 選んだ姿で続ける',tm.length>=1&&tm.every(x=>x.includes('メガリザードンX')),tm);
  /* 条件に合わなければゆるめずに道具へ */
  t=await askUI('雪寄りにして');
  res(W+' 合わなければゆるめず、こだわり条件で組むへ',/条件はゆるめていません/.test(t)&&!!(await pg.$('#ai-log .ai-msg.bot:last-child a[href="#/pair/kd"]')),t);
  res(W+' 横にはみ出さない',await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await shot('followup');
  await askUI('今大会の対戦中です。選出を決めて');
  t=await askUI('試合が終わった。ダブルでおすすめのパーティを教えて');
  const replay=pg.locator('#ai-log .ai-msg.bot:last-child a[href="#/replay"]');
  res(W+' 終了を申告しても助言を再開せず振り返りを案内',await replay.count()===1&&(await names()).length===0,t);
  await replay.click();
  await pg.waitForSelector('#rp-root');
  res(W+' 振り返り画面へ移動し動画を自動選択しない',await pg.evaluate(()=>location.hash==='#/replay'&&document.querySelector('#rp-file').files.length===0));
  /* ログアウトで会話の番号も消す */
  await pg.evaluate(()=>aiReset());res(W+' 消去で会話の番号も消える',await pg.evaluate(()=>AI_ST.conv===null));
  res(W+' 画面のエラーなし',!errs.length,errs);
  await ctx.close();
}
/* 回数切れ：質問を入力欄に残し、回復の時刻と AI を使わないツールを出す */
{ env=await mkEnv({AI_FREE_DAY:'1',AI_FREE_MONTH:'30'});const {pg,ctx,errs}=await page({width:390,height:844});
  const askUI=async q=>{const n0=await pg.$$eval('#ai-log .ai-msg.bot',x=>x.length);await pg.fill('#ai-q',q);await pg.click('#ai-send');
    await pg.waitForFunction(n=>document.querySelectorAll('#ai-log .ai-msg.bot').length>=n&&!document.querySelector('#ai-log .ai-wait'),n0+1,{timeout:10000});return pg.$eval('#ai-log .ai-msg.bot:last-child',e=>e.textContent)};
  await askUI('ダブルのおすすめのパーティ教えて');
  const t=await askUI('ダブルの雨のおすすめのパーティ');
  res('回数切れ：理由と回復の時刻',/今日の回数を使い切りました/.test(t)&&/以降にまた使えます/.test(t),t);
  res('回数切れ：質問を入力欄に残す',(await pg.inputValue('#ai-q'))==='ダブルの雨のおすすめのパーティ');
  res('回数切れ：AI を使わないツール',(await pg.$$eval('#ai-log .ai-msg.bot:last-child a',as=>as.map(a=>a.getAttribute('href')))).join()==='#/dex,#/calc,#/pair/kd');
  const f=`tests/out/ai-b1-390-quota.png`;await pg.screenshot({path:path.join(ROOT,f)});SHOTS.push(f);
  res('画面のエラーなし（回数切れ）',!errs.length,errs);await ctx.close()}
/* 独立評価 reliability-11：アカウントを切りかえた直後に届いた（遅い）答えは画面に出さない */
{ env=await mkEnv({AI_FREE_DAY:'100',AI_FREE_MONTH:'100',AI_MOCK_DELAY_MS:'1200'});const {pg,ctx,errs}=await page({width:390,height:844});
  await pg.fill('#ai-q','ダブルのおすすめのパーティ教えて');await pg.click('#ai-send');await pg.waitForTimeout(250);
  await pg.evaluate(t=>{AUTH.user={uid:'b1-other',email:null,getIdToken:async()=>t};aiAuthChanged('b1-other')},await S.sign('b1-other'));
  await pg.waitForTimeout(2000);
  const shown=await pg.$$eval('#ai-log .ai-tm',x=>x.length),me=await pg.$$eval('#ai-log .ai-msg.me',x=>x.length);
  res('切りかえ直後の遅い答えは出さない（独立評価 reliability-11）',shown===0&&me===0&&await pg.evaluate(()=>AI_ST.conv===null),{shown,me});
  res('画面のエラーなし（切りかえ）',!errs.length,errs);await ctx.close()}
/* 実際のパーティチェックにある相談入口。表示だけでは質問を送らない。 */
for(const width of [390,1280]){
  const monthly=width===1280;
  env=await mkEnv({AI_FREE_DAY:'1',AI_FREE_MONTH:monthly?'1':'30'});
  const {pg,ctx,errs}=await page({width,height:844});
  const requests=[];
  pg.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/ai/v1/answer'))requests.push(r.postDataJSON())});
  await pg.evaluate(()=>{
    AI_CFG.enabled=false;
    AUTH.user=null;
    sessionStorage.removeItem('pcaitest');
    location.hash='#/team';
  });
  await pg.waitForFunction(()=>location.hash==='#/team'&&!document.querySelector('#ai-root'));
  const shortcut=pg.getByRole('link',{name:'AIに相談',exact:true});
  res(width+' パーティ相談の入口は既定で非表示',await shortcut.count()===0);
  await pg.evaluate(()=>{
    AI_CFG.partyConsult=true;
    sessionStorage.setItem('pcaipreviewad','1');
    FMT='double';DGD.allow='off';LIVE.st='fail';
    team=[{no:445,sel:true},{no:149,sel:true}];
    teamView();
  });
  res(width+' ダメージ計算と同じ行に専用ロゴ付きのAIリンク',await shortcut.evaluate(el=>{
    const calc=el.parentElement.querySelector('a[href="#/calc"]');
    return !!el.querySelector('svg.ai-party-mark')&&!!calc&&Math.abs(calc.getBoundingClientRect().top-el.getBoundingClientRect().top)<2;
  }));
  res(width+' パーティ相談だけを有効化できる',await pg.evaluate(()=>aiUiOn(true)&&!aiUiOn()));
  const entry=pg.getByRole('button',{name:'この結果について相談する'});
  const shotLink=`tests/out/ai-party-${width}-shortcut.png`;
  await pg.waitForFunction(()=>!document.documentElement.dataset.dir);
  await shortcut.scrollIntoViewIfNeeded();
  await pg.screenshot({path:path.join(ROOT,shotLink)});SHOTS.push(shotLink);
  await pg.evaluate(t=>{AUTH.user={uid:'b1-user',email:null,getIdToken:async()=>t}},TOKEN);
  await shortcut.click();
  await entry.click();
  const dialog=pg.locator('#ai-party-dialog'),last=dialog.locator('#ai-log .ai-msg.bot').last();
  await dialog.locator('#ai-quota').getByText('今日あと1回').waitFor();
  res(width+' 診断の前提が見え、開いた時点では送信しない',requests.length===0&&/ダブル.*ガブリアス.*カイリュー/.test(await last.textContent()));
  const ask=async q=>{
    await dialog.locator('#ai-q').fill(q);
    await dialog.locator('#ai-send').click();
    await dialog.locator('#ai-send:enabled').waitFor();
    return await last.textContent();
  };
  let answer=await ask('今対戦中です。パーティの強みを教えて');
  res(width+' 対戦中は助言せず振り返りへ案内',await last.locator('a[href="#/replay"]').count()===1&&!/次の練習で試すこと/.test(answer));
  res(width+' 対戦中の制限では回数を減らさない',await dialog.locator('#ai-quota summary').textContent()==='今日あと1回');
  const cid=await pg.evaluate(()=>AI_ST.conv);
  await dialog.getByRole('button',{name:'閉じる',exact:true}).click();
  res(width+' 閉じると相談ボタンに戻り、会話IDは保持',await entry.evaluate(el=>el===document.activeElement)&&await pg.evaluate(id=>AI_ST.conv===id,cid));
  await entry.click();
  answer=await ask('試合が終わったのでこのパーティの強みを教えて');
  await last.locator('a[href="#/replay"]').click();
  await pg.waitForSelector('#rp-root');
  res(width+' 振り返りを開くと相談パネルは閉じ、動画を自動選択しない',await dialog.count()===0&&await pg.evaluate(()=>document.querySelector('#rp-file').files.length===0));
  await pg.evaluate(()=>{aiReset();nav('#/team/consult')});
  await entry.click();
  await dialog.locator('#ai-quota').getByText('今日あと1回').waitFor();
  answer=await ask('運営の発表で一番新しいニュースを教えて');
  res(width+' 対象外は既存ツールを案内し、回数を消費しない',await last.locator('a[href="#/tools"]').count()===1&&await dialog.locator('#ai-quota summary').textContent()==='今日あと1回');
  answer=await ask('このパーティの強みは？');
  res(width+' 同じ端末の計算と練習案を表示して1回消費',/この端末の計算.*対応できる目安.*次の練習で試すこと/.test(answer)&&await dialog.locator('#ai-quota summary').textContent()==='今日あと0回',answer);
  const sent=requests.at(-1);
  res(width+' 許可した要約と対戦形式だけを送る',sent?.format==='double'&&Object.keys(sent.toolInput.partyCheck).sort().join()==='basis,example,members,responses,stable,total',sent?.toolInput);
  await last.getByRole('button',{name:'元のチェック結果を見る'}).click();
  await entry.click();
  await dialog.locator('#ai-quota').getByText('今日あと0回').waitFor();
  answer=await ask('次に何を練習する？');
  const preview=last.locator('details');
  res(width+' 上限の理由と質問の復元',(monthly?/今月の回数を使い切りました/:/今日の回数を使い切りました/).test(answer)&&await dialog.locator('#ai-q').inputValue()==='次に何を練習する？');
  if(monthly){
    res(width+' 月の上限では広告を表示しない',await preview.count()===0);
  }else{
    res(width+' 日の上限では広告は任意のプレビュー',await preview.count()===1&&!await preview.evaluate(el=>el.open));
    await preview.locator('summary').click();
    res(width+' 広告プレビューは回数を付与しない',/追加回数は付与されません/.test(await preview.textContent())&&await dialog.locator('#ai-quota summary').textContent()==='今日あと0回');
  }
  if(width===390){
    await pg.evaluate(()=>aiKbApply(300));
    const composer=await dialog.locator('#ai-comp').boundingBox();
    res('390 パネル内の入力欄はキーボード相当の領域より上',composer&&composer.y+composer.height<546,composer);
    await pg.evaluate(()=>aiKbApply(0));
  }
  const shot=`tests/out/ai-party-${width}-quota.png`;
  await pg.screenshot({path:path.join(ROOT,shot)});SHOTS.push(shot);
  const beforeChange=requests.length;
  await pg.evaluate(()=>{FMT='single'});
  answer=await ask('強みは？');
  res(width+' 対戦形式が変わったら送信せず再表示を案内',/結果が更新されました/.test(answer)&&requests.length===beforeChange,answer);
  await pg.evaluate(()=>aiReset());
  res(width+' セッション消去後はパネルと下書きが残らない',await dialog.count()===0&&await pg.evaluate(()=>!AI_ST.q&&!AI_ST.log.length&&!AI_ST.conv));
  res(width+' 画面のエラーなし（パーティ相談）',!errs.length,errs);
  await ctx.close();
}
/* 初回ユーザーの経路。手持ちが空のままパーティ画面から始める。 */
for(const width of [390,1280]){
  env=await mkEnv({});
  const {pg,ctx,errs}=await page({width,height:844});
  await pg.evaluate(()=>{sessionStorage.removeItem('pcaitest');AUTH.user=null;nav('#/team')});
  await pg.waitForSelector('#tt-seg');
  const entry=pg.getByRole('link',{name:'AIに相談',exact:true});
  res(width+' ベータ無効時はパーティの行に出さない',await entry.count()===0);
  await pg.evaluate(()=>{AI_CFG.partyConsult=true;teamView()});
  await entry.click();
  const card=pg.getByRole('region',{name:'攻略AIに相談（ベータ版）'});
  await card.getByText(/あと2匹/).waitFor();
  res(width+' パーティのAIリンクから直接チェックへ移動',await pg.evaluate(()=>cur==='#/team/consult'&&document.querySelector('[data-tt="check"]').getAttribute('aria-selected')==='true'));
  await pg.evaluate(()=>{DGD.allow='off';LIVE.st='fail'});
  const add=async(name,no)=>{
    await card.getByRole('button',{name:'ポケモンを追加する'}).click();
    const picker=pg.getByRole('dialog',{name:'ポケモンを選ぶ'});
    await picker.getByRole('textbox',{name:'ポケモン名'}).fill(name);
    await picker.locator(`button[data-no="${no}"]`).click();
    await picker.getByRole('button',{name:'完了',exact:true}).click();
    await picker.waitFor({state:'detached'});
  };
  await add('ガブリアス',445);
  res(width+' 1匹追加すると残り1匹を案内',await card.getByText(/あと1匹/).isVisible());
  await add('カイリュー',149);
  const start=card.getByRole('button',{name:'この結果について相談する'});
  await start.waitFor();
  res(width+' 追加後に相談の見出しへ戻る',await card.getByRole('heading').evaluate(el=>el===document.activeElement&&el.getBoundingClientRect().top>=0&&el.getBoundingClientRect().bottom<innerHeight));
  const shot=`tests/out/ai-party-${width}-start.png`;
  await pg.screenshot({path:path.join(ROOT,shot)});SHOTS.push(shot);
  await pg.evaluate(t=>{AUTH.user={uid:'b1-user',email:null,getIdToken:async()=>t}},TOKEN);
  await start.click();
  await pg.locator('#ai-party-dialog').getByText(/ガブリアス.*カイリュー/).waitFor();
  await pg.locator('#ai-party-dialog').getByRole('button',{name:'閉じる'}).click();
  res(width+' 2匹で相談が開き、閉じると同じボタンへ戻る',await start.evaluate(el=>el===document.activeElement));
  await pg.locator('[data-tt="sets"]').click();
  await card.getByRole('button',{name:'チェックを開く'}).click();
  await start.waitFor();
  res(width+' 育成タブからチェックへ戻れる',await pg.evaluate(()=>TTAB==='check'));
  res(width+' 初回ユーザー経路で画面のエラーなし',!errs.length,errs);
  await ctx.close();
}
/* 運営者用のプレビューは実装済みの公開停止を維持したまま試せる。 */
{
  const {pg,ctx,errs}=await page({width:390,height:844});
  const demoToken='admin-ui-test-token';
  const previewEnv=baseEnv({DB:makeD1(),ADMIN_TOKEN:demoToken});
  await pg.route('**/api/admin/ai-preview',async r=>{
    const q=r.request(),headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Content-Type':'application/json'};
    if(q.method()==='OPTIONS')return r.fulfill({status:204,headers});
    const h={origin:'https://pokechan-hub.pages.dev',authorization:q.headers().authorization||'','x-admin-token':q.headers()['x-admin-token']||''};
    if(q.method()==='POST')h['content-type']='application/json';
    const {default:deployed}=await import(path.join(ROOT,'worker/dist/worker.js'));
    const response=await deployed.fetch(new Request('https://w.example/api/admin/ai-preview',{method:q.method(),headers:h,body:q.postData()||undefined}),previewEnv,{waitUntil(){}});
    return r.fulfill({status:response.status,headers,body:await response.text()});
  });
  await pg.evaluate(()=>{AI_CFG.auditHold=true;DGD.allow='off';LIVE.st='fail';team=[{no:445,sel:true},{no:149,sel:true}];nav('#/team')});
  await pg.waitForSelector('#tt-seg');
  res('運営者確認前はAIに相談が表示されない',await pg.locator('.ai-party-link').count()===0);
  await pg.evaluate(()=>nav('#/admin'));
  await pg.locator('#adm-tok').fill(demoToken);
  await pg.locator('#adm-save').click();
  await pg.getByRole('button',{name:'AI相談の検証'}).click();
  await pg.getByRole('link',{name:'パーティ画面を開く'}).click();
  await pg.getByRole('link',{name:'AIに相談',exact:true}).click();
  await pg.getByRole('button',{name:'この結果について相談する'}).click();
  const dialog=pg.locator('#ai-party-dialog');
  await dialog.getByRole('button',{name:'このパーティの強みは？'}).click();
  await dialog.getByText('次の練習で試すこと').waitFor();
  res('運営者本人の操作で回答カードが出る',await dialog.getByText('運営者限定・模擬回答').isVisible());
  res('質問の入力欄は模擬検証では出さない',!await dialog.locator('#ai-q').isVisible());
  await pg.evaluate(()=>{AUTH.user=null;aiAuthChanged(null)});
  res('ログアウトでプレビューパネルと入口を消す',await dialog.count()===0&&await pg.locator('.ai-party-start').count()===0);
  res('運営者用プレビューに画面のエラーなし',!errs.length,errs);
  await ctx.close();
}
await b.close();
res('外部への送信 0 件',OUT.length===0,OUT);
fs.writeFileSync(path.join(ROOT,'tests/out/ai-b1-ui-results.json'),JSON.stringify({total:R.n,bad,shots:SHOTS},null,1));
console.log(bad?`ai-b1-ui: NG（${bad}件 / ${R.n}項目）`:`ai-b1-ui: OK（${R.n}項目）`);if(bad)process.exitCode=1;
