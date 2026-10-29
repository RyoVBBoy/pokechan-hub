// 英語表示の確認：英語の端末で開くと英語になり、名前が正式な英語名になり、主な画面に訳し忘れがないこと
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const URL0='file://'+path.join(ROOT,'dist/index.html');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const pg=await (await b.newContext({viewport:{width:390,height:844},locale:'en-US'})).newPage();
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.route(/^https?:/,r=>r.abort());
const fail=m=>{console.error('NG',m);process.exitCode=1};
let n=0;const ok=(c,m)=>{n++;if(!c)fail(m)};
await pg.goto(URL0+'#/');await pg.waitForTimeout(600);
ok(await pg.evaluate(()=>LANG==='en'&&document.documentElement.lang==='en'),'英語の端末で英語になりません');
ok(await pg.$eval('.tb[data-k="search"] span',s=>s.textContent==='Search'),'下のメニューが英語になりません');
/* 名前 */
await pg.evaluate(()=>{location.hash='#/p/445'});await pg.waitForTimeout(500);
ok(/Garchomp/.test(await pg.$eval('#hdr h1',h=>h.textContent)),'ポケモンの名前が英語になりません');
const nm=await pg.evaluate(()=>[byNo[10100].n,byNo[10309]&&byNo[10309].n,MVX[89][0],ABN['roughskin']||ABN['rough-skin'],ITEMN.choicescarf,NATS[2][0]]);
ok(nm[0]==='Alolan Raichu'&&nm[1]==='Mega Garchomp Z'&&nm[2]==='Earthquake'&&/Rough Skin/.test(nm[3]||'')&&nm[4]==='Choice Scarf'&&nm[5]==='Adamant','名前の英語: '+nm.join(','));
/* 検索は英語でも日本語でも */
ok(await pg.evaluate(()=>[byNo[445]].every(p=>nmHit(p,'garch')&&nmHit(p,'ガブリ')&&nmHit(p,'がぶり'))),'英語・日本語のどちらでも検索できません');
/* 計算は日本語のときと同じ */
await pg.evaluate(()=>{location.hash='#/calc'});await pg.waitForTimeout(400);
ok(/%/.test(await pg.$eval('.cres-big',x=>x.textContent).catch(()=>'')),'英語でダメージ計算の結果が出ません');
/* 主な画面に日本語が残っていない（技・特性の説明と、利用者が書いたものは除く） */
const routes=['#/','#/dex','#/p/445','#/types','#/team','#/tools','#/calc','#/assist','#/community','#/tl','#/notif','#/account','#/games','#/lobby','#/bbs','#/meta','#/report','#/cmp/445','#/search','#/search/garchomp'];
const left=new Set();
for(const r of routes){await pg.evaluate(h=>{location.hash=h},r);await pg.waitForTimeout(350);
  (await pg.evaluate(()=>{const JP=/[぀-ヿ㐀-鿿]/,out=[];const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let x;
    while((x=w.nextNode())){const p=x.parentElement;if(!p||p.closest('[data-notr],script,style,[hidden]')||!p.getClientRects().length)continue;const t=x.nodeValue.trim();if(t&&JP.test(t)&&!/^(言語 \/ Language|Language \/ 言語|日本語)$/.test(t))out.push(t)}return out})).forEach(t=>left.add(r+' '+t))}
ok(left.size===0,'英語にならない文字: '+[...left].slice(0,8).join(' / '));
/* 日本語に切り替えられる */
await pg.evaluate(()=>localStorage.setItem('pclang','ja'));await pg.reload();await pg.waitForTimeout(500);
ok(await pg.evaluate(()=>LANG==='ja'&&byNo[445].n==='ガブリアス'),'日本語に戻せません');
if(errs.length)fail('ページのエラー: '+errs.slice(0,3).join(' / '));
await b.close();
console.log(process.exitCode?'i18n: NG':'i18n: OK',`（${n}項目）`);
