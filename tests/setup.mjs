// ダメージ計算の「積み技・ランク」とバトンタッチ（86-setup.js、2026/11/16 依頼主）の確認
// そのポケモンが覚える積み技だけ／複数の能力・くり返し・-6〜+6／育成の欄の5つのランクと同じ値（どちらからでも）／ポケモンを変えたら古い状態を残さない／
// バトンタッチ（覚えるポケモンだけ・同じポケモン不可・受け取る側のランクになる・受け取る側は覚えていなくてよい・外すと元に戻る・入れかえで向きも入れかわる）／条件の欄の高さ
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
const SHOT=process.env.SHOT||'';
let n=0;const ok=(c,m,x)=>{n++;if(!c){console.error('NG',m,x===undefined?'':JSON.stringify(x).slice(0,500));process.exitCode=1}};
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const K=['atk','def','spa','spd','spe'];
for(const W of [390,1280]){
  const ctx=await b.newContext({viewport:{width:W,height:W<700?844:900},locale:'ja-JP',hasTouch:W<700,isMobile:W<700,deviceScaleFactor:SHOT?2:1});
  await ctx.addInitScript(()=>{try{localStorage.setItem('pcstart','1')}catch(e){}});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));await pg.route(/^https?:/,r=>r.abort());
  await pg.goto(URL0+'#/calc');await pg.waitForSelector('#calc-root .cv-vs');await pg.waitForTimeout(300);
  const W8=(t=200)=>pg.waitForTimeout(t);
  const open=async()=>{await pg.evaluate(()=>{const d=document.getElementById('su-box');if(d&&!d.open){d.open=true;d.dispatchEvent(new Event('toggle'))}});await W8(100)};
  const side=async s=>{await open();await pg.click(`#su-box [data-su-side="${s}"]`);await W8()};
  const chips=()=>pg.$$eval('#su-box [data-su-mv]',a=>a.map(x=>+x.dataset.suMv));
  const tap=async(id,k=1)=>{for(let i=0;i<k;i++){await open();await pg.click(`#su-box [data-su-mv="${id}"]`);await W8(120)}};
  const st=s=>pg.evaluate(([s,K])=>{const g=k=>{const e=document.querySelector(`#calc-root select[data-c="${s}.stg.${k}"]`);return e?+e.value:null};
    return{st:Object.fromEntries(K.map(k=>[k,CS[s].stg[k]||0])),dd:Object.fromEntries(K.map(k=>[k,g(k)]))}},[s,K]);
  const same=x=>K.every(k=>x.st[k]===x.dd[k]);
  const lastToast=()=>pg.$$eval('.toast',a=>a.map(t=>t.textContent).pop()||'');
  /* ポケモンを選ぶ：選ぶ画面のボタンと同じく、見えない select の値を変えて change を起こす（11-matchup.js の monField。計算の画面の処理はそのまま動く） */
  const choose=async(s,no)=>{await pg.evaluate(([s,no])=>{const e=document.querySelector(`#calc-root select[data-c="${s}.no"]`);e.value=String(no);e.dispatchEvent(new Event('change'))},[s,no]);await W8(400);return pg.evaluate(s=>CS[s].no,s)};

  /* 1. そのポケモンが覚える積み技だけ（当サイトの覚える技の表と積み技の表の重なり） */
  await open();
  const want=await pg.evaluate(()=>SETUP_ORDER.filter(id=>LSD[CS.a.no][1].includes(id)&&MD[id]));
  let c=await chips();
  ok(c.length>0&&JSON.stringify([...c].sort())===JSON.stringify([...want].sort()),W+'：札はそのポケモン（ガブリアス）が覚える積み技と同じ',[c,want]);
  ok(c.includes(14)&&!c.includes(417)&&!c.includes(349),W+'：つるぎのまいはあり、覚えない わるだくみ・りゅうのまい は出ない',c);
  ok(await pg.evaluate(()=>[...document.querySelectorAll('#su-box [data-su-mv]')].every(b=>LSD[CS.a.no][1].includes(+b.dataset.suMv))),W+'：どの札も覚える技の表にある');
  /* 2. くり返し・上限：つるぎのまい 3回で+6、4回目は変わらない */
  await tap(14);let s=await st('a');ok(s.st.atk===2&&same(s),W+'：つるぎのまい1回で攻撃+2（育成の欄も+2）',s);
  const p2=await pg.evaluate(()=>{const R=calcResult();return Math.max(...R.r)});
  await tap(14,2);s=await st('a');ok(s.st.atk===6&&same(s),W+'：3回で+6',s);
  await tap(14);s=await st('a');ok(s.st.atk===6&&/これ以上/.test(await lastToast()),W+'：+6からは上がらない（知らせる）',[s.st.atk,await lastToast()]);
  const p6=await pg.evaluate(()=>{const R=calcResult();return Math.max(...R.r)});ok(p6/p2>1.9,W+'：ランクがダメージに入る（+2→+6で約2倍）',[p2,p6]);
  /* 3. 育成の欄から札へ・札から欄へ（同じ値） */
  await pg.evaluate(()=>{document.querySelector('details[data-more="a"]').open=true});
  ok(await pg.$$eval('#calc-root select[data-c^="a.stg."]',a=>a.length)===5&&await pg.$$eval('#calc-root select[data-c^="d.stg."]',a=>a.length)===5,W+'：育成の欄に攻撃・防御・特攻・特防・素早さの5つのランク（両方のポケモン）');
  await pg.selectOption('#calc-root select[data-c="a.stg.atk"]','-1');await W8();await open();
  ok((await pg.$eval('#su-box .su-now',e=>e.textContent)).includes('攻-1'),W+'：欄で-1にすると、積み技の欄の「いまのランク」も攻-1');
  await tap(14);s=await st('a');ok(s.st.atk===1&&same(s),W+'：欄の-1から つるぎのまい で+1（欄の値から足す）',s);
  await pg.click('#su-box [data-su-reset]');await W8();s=await st('a');ok(K.every(k=>s.st[k]===0)&&same(s),W+'：「ランクを0に戻す」で5つとも0',s);
  /* 4. 複数の能力・下がる能力・-6：からをやぶる（9 カメックス） */
  ok(await choose('a',9)===9,W+'：攻撃側をカメックスに変える');await open();
  c=await chips();ok(c.includes(504)&&!c.includes(14),W+'：ポケモンを変えると札も変わる（からをやぶる はある・つるぎのまい は覚えない）',c);
  s=await st('a');ok(K.every(k=>s.st[k]===0),W+'：新しいポケモンのランクは0から（前のポケモンのランクを残さない）',s);
  await tap(504);s=await st('a');ok(s.st.atk===2&&s.st.spa===2&&s.st.spe===2&&s.st.def===-1&&s.st.spd===-1&&same(s),W+'：からをやぶる＝攻撃・特攻・素早さ+2、防御・特防-1（5つの欄も同じ）',s);
  await tap(504,6);s=await st('a');ok(s.st.atk===6&&s.st.def===-6&&s.st.spd===-6&&same(s),W+'：くり返すと+6・-6で止まる',s);
  await pg.click('#su-box [data-su-reset]');await W8();
  /* 5. はらだいこ・たくわえる（カビゴン）・のろい（ゴーストかどうか）・せいちょう（はれ）・はいすいのじん（1回だけ） */
  await choose('a',143);await open();c=await chips();ok(c.includes(187)&&c.includes(254)&&c.includes(174),W+'：カビゴン：はらだいこ・たくわえる・のろい',c);
  await tap(187);s=await st('a');ok(s.st.atk===6,W+'：はらだいこで攻撃+6',s);
  await tap(187);ok(/最大/.test(await lastToast()),W+'：攻撃+6ではもう使えない');
  await pg.click('#su-box [data-su-reset]');await W8();
  await tap(254,4);s=await st('a');ok(s.st.def===3&&s.st.spd===3&&/3回まで/.test(await lastToast()),W+'：たくわえるは3回まで（4回目は使えない）',[s.st,await lastToast()]);
  await pg.click('#su-box [data-su-reset]');await W8();
  await tap(174);s=await st('a');ok(s.st.atk===1&&s.st.def===1&&s.st.spe===-1,W+'：のろい（ゴースト以外）＝攻撃+1・防御+1・素早さ-1',s);
  await pg.click('#su-box [data-su-reset]');await W8();
  await choose('a',94);await open();c=await chips();ok(!c.includes(174),W+'：ゲンガー（ゴースト）にはのろいの札を出さない（ランクが変わらない技のため）',c);
  const gr=await pg.evaluate(()=>{const p=P.find(q=>LSD[q.no]&&LSD[q.no][1].includes(74));return p&&p.no});
  await choose('a',gr);await pg.selectOption('#calc-root select[data-c="weather"]','sun');await W8();await tap(74);s=await st('a');
  ok(s.st.atk===2&&s.st.spa===2,W+'：はれの中のせいちょうは攻撃・特攻+2',s);
  await pg.selectOption('#calc-root select[data-c="weather"]','');await W8();await pg.click('#su-box [data-su-reset]');await W8();await tap(74);s=await st('a');ok(s.st.atk===1&&s.st.spa===1,W+'：はれでなければ+1',s);
  await choose('a',870);await open();await tap(748,2);s=await st('a');ok(K.every(k=>s.st[k]===1)&&/1回しか/.test(await lastToast()),W+'：はいすいのじんは5つとも+1で、1回だけ',[s.st,await lastToast()]);
  /* 6. 受ける側も：受ける側の札は受ける側のランク */
  await side('d');c=await chips();const dWant=await pg.evaluate(()=>SETUP_ORDER.filter(id=>LSD[CS.d.no][1].includes(id)&&MD[id]));
  ok(JSON.stringify([...c].sort())===JSON.stringify([...dWant].sort()),W+'：受ける側の札は受ける側のポケモンが覚える積み技',[c,dWant]);
  if(c.length){const id=c[0];const bf=await st('d');await tap(id);const af=await st('d');ok(JSON.stringify(af.st)!==JSON.stringify(bf.st)&&same(af),W+'：受ける側の札は受ける側のランクを変える（欄も同じ）',af)}
  await pg.click('#su-box [data-su-reset]');await W8();await side('a');
  /* 7. バトンタッチ：受け取る側（攻撃側）・使う側（シャワーズ） */
  await choose('a',445);await open();
  const opts=await pg.$$eval('#su-box [data-su-bp] option',a=>a.map(o=>+o.value).filter(Boolean));
  ok(opts.length>0&&await pg.evaluate(o=>o.every(no=>LSD[no][1].includes(226)),opts),W+'：使う側に選べるのはバトンタッチを覚えるポケモンだけ',opts.length);
  ok(!opts.includes(445),W+'：受け取る側と同じポケモンは選べない');
  await pg.selectOption('#calc-root select[data-c="a.stg.atk"]','1');await W8();await open();
  await pg.selectOption('#su-box [data-su-bp]','134');await W8();await open();
  s=await st('a');ok(K.every(k=>s.st[k]===0),W+'：バトンタッチを選ぶと、受け取る側のランクは使う側が積む前の0から',s);
  c=await chips();const vap=await pg.evaluate(()=>SETUP_ORDER.filter(id=>LSD[134][1].includes(id)&&MD[id]));
  ok(JSON.stringify([...c].sort())===JSON.stringify([...vap].sort()),W+'：札は使う側（シャワーズ）が覚える積み技になる',[c,vap]);
  const notLearned=await pg.evaluate(c=>c.find(id=>!LSD[445][1].includes(id)),c);
  ok(!!notLearned,W+'：受け取る側（ガブリアス）が覚えない積み技も使える（例：'+notLearned+'）');
  const note=await pg.$eval('#su-box .su-bp-note',e=>e.textContent);ok(/シャワーズ.*バトンタッチを使う側.*ガブリアス.*受け取る側/.test(note),W+'：使う側と受け取る側をはっきり書く',note);
  if(notLearned){await tap(notLearned);s=await st('a');ok(K.some(k=>s.st[k]!==0)&&same(s),W+'：使う側の積み技で、受け取る側のランク（欄も同じ）が変わる',s)}
  const amn=c.includes(133)?133:c.includes(347)?347:null;
  if(amn){await pg.click('#su-box [data-su-reset]');await W8();await tap(amn,2);s=await st('a')}
  ok(/シャワーズからバトンタッチ/.test(await pg.$eval('#su-box summary',e=>e.textContent)),W+'：たたんだ行にも「〇〇からバトンタッチ」');
  const recvDmg=await pg.evaluate(()=>{CS.mv=null;const R=calcResult();return{a:R.a.stg,no:R.a.p.no}});ok(recvDmg.no===445&&K.every(k=>(recvDmg.a[k]||0)===(s.st[k]||0)),W+'：ダメージの計算は受け取る側のランクで行う',recvDmg);
  /* 攻守の入れかえ：バトンタッチの向きもいっしょに入れかわる */
  await pg.click('#calc-root .cv-swi');await W8(400);
  ok(await pg.evaluate(()=>CS.setup.bp&&CS.setup.bp.side==='d'&&CS.d.no===445),W+'：攻守を入れかえると、受け取る側（ガブリアス）といっしょに受ける側へ');
  await pg.click('#calc-root .cv-swi');await W8(400);await open();
  /* 外すと、受け取る側のランクを選ぶ前（攻撃+1）に戻す */
  await pg.selectOption('#su-box [data-su-bp]','');await W8();s=await st('a');
  ok(s.st.atk===1&&K.filter(k=>k!=='atk').every(k=>s.st[k]===0)&&await pg.evaluate(()=>!CS.setup.bp),W+'：バトンタッチをやめると、受け取る側のランクは選ぶ前（攻撃+1）に戻る',s);
  /* 使う側を変えると、積んだランクは0から（前の使う側のランクを残さない） */
  await pg.selectOption('#su-box [data-su-bp]','134');await W8();await open();if(amn)await tap(amn);
  const other=opts.find(x=>x!==134);await pg.selectOption('#su-box [data-su-bp]',String(other));await W8();s=await st('a');
  ok(K.every(k=>s.st[k]===0),W+'：使う側を変えると0から',s);
  /* 受け取る側を変えると、バトンタッチの設定は消える */
  await choose('a',149);ok(await pg.evaluate(()=>!CS.setup.bp),W+'：受け取る側のポケモンを変えるとバトンタッチは解除');
  /* 正しくない組み合わせはサーバーではなく画面の関数でも断る */
  await choose('a',134);   /* 受け取る側もバトンタッチを覚えるポケモンにして「同じポケモン」を確かめる */
  const inv=await pg.evaluate(()=>[bpSet('a',445),bpSet('a',134),!CS.setup.bp]);
  ok(/覚えません/.test(inv[0]||'')&&/同じ/.test(inv[1]||'')&&inv[2],W+'：バトンタッチを覚えないポケモン・同じポケモンからは受け取れない（設定も変えない）',inv);
  /* 9. ＋／−で1段ずつ（2026/11/17）：両方の側・-6〜+6・積み技の札と育成の欄と同じ値・ポケモンを変えたとき・バトンタッチのあと */
  await pg.evaluate(()=>{CS=null;route()});await W8(400);await open();
  const step=async(k,d,n=1)=>{for(let i=0;i<n;i++){await open();await pg.click(`#su-box [data-su-st="${k}"][data-su-d="${d}"]`);await W8(100)}};
  const cell=k=>pg.evaluate(k=>{const c=document.querySelector(`#su-box [data-su-st="${k}"]`).closest('.su-st');const b=d=>c.querySelector(`[data-su-d="${d}"]`).disabled;
    return{v:c.querySelector('.su-st-v').textContent,cls:c.className.replace('su-st ','').trim(),minusOff:b(-1),plusOff:b(1)}},k);
  const dmg=()=>pg.evaluate(()=>{CS.mv=CS.mv;const R=calcResult();return Math.max(...R.r)});
  ok(await pg.$$eval('#su-box .su-st',a=>a.length)===5&&await pg.$$eval('#su-box .su-st-b',a=>a.length)===10,W+'：攻撃・防御・特攻・特防・素早さに＋と−（10個）');
  let c0=await cell('atk');ok(c0.v==='±0'&&c0.cls==='su-zero'&&!c0.minusOff&&!c0.plusOff,W+'：はじめは±0（灰色）で＋−どちらも押せる',c0);
  const d0=await dmg();
  await step('atk',1);s=await st('a');c0=await cell('atk');
  ok(s.st.atk===1&&same(s)&&c0.v==='+1'&&c0.cls==='su-pos',W+'：＋で攻撃+1（育成の欄も+1・緑）',[s,c0]);
  ok(await dmg()>d0,W+'：＋でダメージの計算もすぐ変わる');
  await step('def',-1,2);s=await st('a');c0=await cell('def');ok(s.st.def===-2&&same(s)&&c0.v==='−2'&&c0.cls==='su-neg',W+'：−2回で防御-2（欄も-2・赤）',[s,c0]);
  ok((await pg.$eval('#su-box summary',e=>e.textContent)).includes('攻+1 防-2'),W+'：たたんだ行のランクも変わる');
  /* くり返し・上限：＋を7回で+6、＋は押せなくなる。−を7回で-6、−は押せなくなる */
  await step('spe',1,6);c0=await cell('spe');ok(c0.v==='+6'&&c0.plusOff&&!c0.minusOff,W+'：素早さ＋6回で+6、＋は押せない（−は押せる）',c0);
  ok(await pg.evaluate(()=>{const b=document.querySelector('#su-box [data-su-st="spe"][data-su-d="1"]');b.click();return CS.a.stg.spe}).then(v=>v===6),W+'：+6の＋を押しても+7にならない');
  await step('spa',-1,6);c0=await cell('spa');s=await st('a');ok(s.st.spa===-6&&same(s)&&c0.minusOff&&!c0.plusOff,W+'：特攻−6回で-6、−は押せない',[s,c0]);
  ok(await pg.evaluate(()=>setupStep('a','spa',-1))&&(await st('a')).st.spa===-6,W+'：-6からは下がらない（関数でも）');
  await step('spa',1,6);
  /* 積み技の札と合わせて */
  await tap(14);s=await st('a');ok(s.st.atk===3&&same(s)&&(await cell('atk')).v==='+3',W+'：攻撃+1から つるぎのまい で+3（＋−の表示も+3）',s);
  await step('atk',-1);s=await st('a');ok(s.st.atk===2&&same(s),W+'：−で+2に（欄も+2）',s);
  ok(/×1/.test(await pg.$eval('#su-box [data-su-mv="14"]',e=>e.textContent)),W+'：＋−で変えても、積み技を使った回数の表示は変えない');
  await pg.evaluate(()=>{document.querySelector('details[data-more="a"]').open=true});await pg.selectOption('#calc-root select[data-c="a.stg.atk"]','5');await W8();await open();
  c0=await cell('atk');ok(c0.v==='+5'&&!c0.plusOff,W+'：育成の欄で+5にすると＋−も+5',c0);
  await step('atk',1);c0=await cell('atk');s=await st('a');ok(s.st.atk===6&&same(s)&&c0.plusOff,W+'：+5から＋で+6（欄も+6・＋は押せない）',[s,c0]);
  await tap(14);ok((await st('a')).st.atk===6&&/これ以上/.test(await lastToast()),W+'：+6でつるぎのまいは失敗（今までどおり）');
  /* 続けて押せる：押したあと焦点がそのボタンに残る */
  await step('def',1);ok(await pg.evaluate(()=>{const a=document.activeElement;return a&&a.dataset.suSt==='def'&&a.dataset.suD==='1'}),W+'：押したあと焦点が同じボタンに残る（続けて押せる）');
  /* 受ける側：受ける側のランクだけ変わる */
  const aBefore=(await st('a')).st;await side('d');
  ok((await cell('def')).v==='±0',W+'：受ける側に切りかえると受ける側のランク（±0）');
  const dd0=await dmg();await step('def',-1,2);const sd=await st('d');
  ok(sd.st.def===-2&&same(sd)&&JSON.stringify((await st('a')).st)===JSON.stringify(aBefore),W+'：受ける側の防御-2（受ける側の欄も-2）、攻撃側は変わらない',[sd,aBefore]);
  ok(await dmg()>dd0,W+'：受ける側の防御を下げると、物理技のダメージが上がる');
  await side('a');ok((await cell('def')).v===(aBefore.def>0?'+'+aBefore.def:aBefore.def===0?'±0':'−'+(-aBefore.def)),W+'：攻撃側に戻すと攻撃側の値');
  /* 攻守の入れかえ：ランクはポケモンといっしょに */
  await pg.click('#calc-root .cv-swi');await W8(400);ok(await pg.evaluate(()=>CS.a.stg.def===-2&&CS.d.stg.atk===6),W+'：攻守を入れかえると、ランクもポケモンといっしょに入れかわる');
  await pg.click('#calc-root .cv-swi');await W8(400);
  /* ポケモンを変える：その側は0から・＋−も±0 */
  await choose('a',9);await open();
  ok(await pg.$$eval('#su-box .su-st-v',a=>a.every(e=>e.textContent==='±0'))&&(await st('a')).st.atk===0,W+'：攻撃側のポケモンを変えると＋−も±0');
  ok(await pg.evaluate(()=>CS.d.stg.def===-2),W+'：受ける側のランクはそのまま');
  /* バトンタッチのあと手で変える：受け取る側のランクが変わり、バトンタッチの設定・使う側の札はそのまま。やめると選ぶ前に戻る */
  await choose('a',445);await open();await step('atk',1);
  await pg.selectOption('#su-box [data-su-bp]','134');await W8();await open();
  ok((await cell('atk')).v==='±0',W+'：バトンタッチを選ぶと受け取る側は0から（＋−も±0）');
  const cm=await pg.$('#su-box [data-su-mv="347"]');if(cm){await tap(347)}
  await step('atk',1,2);s=await st('a');
  ok(s.st.atk===2&&same(s)&&await pg.evaluate(()=>!!CS.setup.bp&&CS.setup.bp.from===134),W+'：バトンタッチのあとも＋で受け取る側の攻撃+2（バトンタッチの設定はそのまま）',s);
  ok(!cm||(s.st.spa===1&&s.st.spd===1),W+'：使う側の めいそう で上がった特攻・特防も残る',s);
  ok(await pg.$('#su-box .su-bp-note')!==null&&JSON.stringify(await pg.$$eval('#su-box [data-su-mv]',a=>a.map(x=>+x.dataset.suMv)))===JSON.stringify(await pg.evaluate(()=>SETUP_ORDER.filter(id=>LSD[134][1].includes(id)&&MD[id]))),W+'：札は使う側（シャワーズ）のまま・説明も出たまま');
  const recv=await pg.evaluate(()=>{const R=calcResult();return R.a.stg.atk});ok(recv===2,W+'：ダメージの計算は手で変えたあとの受け取る側のランク',recv);
  await pg.selectOption('#su-box [data-su-bp]','');await W8();s=await st('a');
  ok(s.st.atk===1&&s.st.spa===0&&s.st.spd===0&&same(s),W+'：バトンタッチをやめると、選ぶ前（攻撃+1）に戻る',s);
  /* 既定の高さ：たたんだままなら＋−があってもページの高さは変わらない */
  await pg.evaluate(()=>{CS=null;route()});await W8(400);
  const H=await pg.evaluate(()=>{const d=document.getElementById('su-box');d.open=false;const sc=document.scrollingElement||document.body;const h1=document.body.scrollHeight;
    const st=d.querySelector('.su-steps');const keep=st.outerHTML;st.remove();const h0=document.body.scrollHeight;return{h0,h1}});
  ok(H.h0===H.h1,W+'：たたんだ状態では＋−を足してもページの高さは同じ',H);
  /* 10. 操作の回数（calc_done、2026/11/17）：積み技・ランクの操作も、計算の条件が変わったときだけ数える。あとから型が入れかわっても、何も変えない操作は数えない。
     同じ条件はタブの中で1回だけ数える決まりなので、前の確かめで出てこない状態（受ける側のHP 37%）から始める */
  await pg.evaluate(()=>{CS=null;route();CS.dHP=37;route()});await W8(400);await open();
  const ev=()=>pg.evaluate(()=>EV_LOG.filter(x=>x==='calc_done').length);
  let e0=await ev();
  await tap(14);ok(await ev()===e0+1,W+'：積み技の札（つるぎのまい）は1回と数える');
  await pg.evaluate(()=>{CS.a={...CS.a,item:'lifeorb',sp:[2,32,0,0,0,32]};CS.d={...CS.d,item:'leftovers'};route()});await W8(300);await open();
  e0=await ev();ok(e0===await ev(),W+'：（準備）型の入れかえ');
  await pg.evaluate(()=>{CS.a.stg.atk=6});await pg.evaluate(()=>route());await W8(300);await open();e0=await ev();
  await tap(14);ok(await ev()===e0&&/これ以上/.test(await lastToast()),W+'：型が入れかわったあと、+6でつるぎのまい（何も変わらない）は数えない');
  await pg.evaluate(()=>{const b=document.querySelector('#su-box [data-su-st="atk"][data-su-d="1"]');b.disabled=false;b.click()});await W8(200);
  ok(await ev()===e0,W+'：+6の＋（何も変わらない）は数えない');
  await side('d');ok(await ev()===e0,W+'：攻撃側／受ける側の切りかえだけでは数えない');
  await step('def',-1);ok(await ev()===e0+1,W+'：＋／−で受ける側の防御を変えると1回と数える');
  await side('a');await pg.selectOption('#su-box [data-su-bp]','134');await W8();ok(await ev()===e0+2,W+'：バトンタッチを選ぶと1回と数える');
  /* 8. 条件の欄の高さ・はみ出し */
  await pg.evaluate(()=>{CS=null;route()});await W8(400);
  const L=await pg.evaluate(()=>{const d=document.getElementById('su-box');d.open=false;const h=d.getBoundingClientRect().height;return{h,over:document.body.scrollWidth-document.documentElement.clientWidth}});
  ok(L.h<=50&&L.over<=1,W+'：たたんだ状態は1行（高さ50px以下）・はみ出さない',L);
  await open();const L2=await pg.evaluate(()=>({over:document.body.scrollWidth-document.documentElement.clientWidth,minH:Math.min(...[...document.querySelectorAll('#su-box button,#su-box select')].map(e=>e.getBoundingClientRect().height))}));
  ok(L2.over<=1&&L2.minH>=30,W+'：開いてもはみ出さず、押しやすい',L2);
  if(SHOT){await tap(14);const y=await pg.$eval('#su-box',e=>{e.scrollIntoView({block:'center'});return 0});await W8(300);
    const r=await pg.$eval('#su-box',e=>{const r=e.getBoundingClientRect();return{y:r.top-70,h:r.height+90}});await pg.screenshot({path:path.join(SHOT,`setup-${W}.png`),clip:{x:0,y:Math.max(0,r.y),width:W<700?W:900,height:Math.min(700,r.h)}})}
  ok(!errs.length,W+'：エラーなし',errs);await ctx.close();
}
await b.close();
console.log(process.exitCode?'setup: NG':`setup: OK（${n}項目）`);
