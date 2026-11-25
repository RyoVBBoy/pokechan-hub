import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const url='file://'+path.join(root,'dist/index.html');
const shots=process.env.SHOT||path.join(root,'release-screenshots');
await mkdir(shots,{recursive:true});
const browser=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
let n=0;
function ok(condition,label){assert.ok(condition,label);n++;console.log('PASS',label)}
try{
for(const [width,lang,theme] of [[1280,'ja','dark'],[1920,'en','light'],[390,'ja','light'],[430,'en','dark']]){
  const label=width+'-'+lang+'-'+theme;
  const context=await browser.newContext({viewport:{width,height:900},locale:lang==='ja'?'ja-JP':'en-US',reducedMotion:'reduce'});
  const pg=await context.newPage();const errors=[];pg.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(({lang,theme})=>{localStorage.setItem('pclang',lang);localStorage.setItem('pctheme',theme);localStorage.setItem('pctoolsguide','1');localStorage.setItem('pcstart','1');localStorage.setItem('pchowtotest','1')},{lang,theme});
  await pg.route(/^https?:/,route=>route.abort());
  await pg.goto(url+'#/tools');
  await pg.locator('.tprim').waitFor();
  const ids=()=>pg.locator('#view .tquick .ttile').evaluateAll(es=>es.map(e=>e.getAttribute('href')));
  const side=()=>pg.locator('#pcs-tools .pcs-t').evaluateAll(es=>es.map(e=>e.getAttribute('href')));
  const star=id=>pg.locator('#view [data-tpin="'+id+'"]');
  const defaults=['#/assist','#/calc','#/types','#/meta'];
  ok(JSON.stringify(await ids())===JSON.stringify(defaults),label+' default stars');
  ok(await star('calc').getAttribute('aria-pressed')==='true',label+' calculator starred');
  await pg.screenshot({path:path.join(shots,label+'-tools.png')});
  await star('calc').click();
  ok(!(await ids()).includes('#/calc'),label+' calculator unstar');
  if(width>=1280){
    ok(JSON.stringify(await side())===JSON.stringify(await ids()),label+' sidebar synced');
    const search=pg.locator('#pcs-q');
    const bounds=await pg.locator('#pcs-search').evaluate(el=>{const r=el.getBoundingClientRect();const es=[...el.children].map(x=>x.getBoundingClientRect());return r.width>0&&r.right<=innerWidth+1&&es.every(x=>x.left>=r.left&&x.right<=r.right&&x.width>0)&&es[0].right<=es[1].left&&es[1].right<=es[2].left});
    ok(bounds,label+' search controls contained and not overlapping');
    ok(await search.getAttribute('placeholder')===(lang==='ja'?'ポケモン・#タグ・言葉で検索':'Search Pokémon, #tags, words'),label+' localized search placeholder');
    await pg.evaluate(()=>{
      const user={handle:'release_test',name:'Release Test',bio:'Test fixture'};
      twAuth=async()=>null;
      authFetch=async route=>route.startsWith('/api/tags/trend')?{tags:[{tag:'fixture',n:1}]}:route.startsWith('/api/search')?{notes:[{id:123,body:'fixture #fixture',user,media:[],created_at:Date.now(),likes:0,replies:0,reposts:0}],users:[user],next:null}:{};
    });
    await search.fill(lang==='ja'?'ピカチュウ':'Pikachu');await search.press('Enter');
    await pg.locator('.sr-mon[href="#/p/25"]').waitFor();
    ok(await pg.locator('.sr-mon[href="#/p/25"]').isVisible(),label+' actual Pokemon search result');
    await pg.locator('#sr-list .tw').waitFor();await pg.locator('#sr-users a[href="#/u/release_test"]').waitFor();
    ok((await pg.locator('#sr-list .tw-b').textContent()).includes('fixture'),label+' post result fixture');
    ok(await pg.locator('#sr-users a[href="#/u/release_test"]').isVisible(),label+' trainer result fixture');
    await pg.screenshot({path:path.join(shots,label+'-search.png')});
    await search.fill('#fixture');await pg.locator('.pcs-search-go').click();
    await pg.waitForFunction(()=>decodeURIComponent(location.hash)==='#/search/#fixture');
    await pg.locator('#sr-list .tw').waitFor();ok(await pg.locator('#sr-list .tw-b a.htag').isVisible(),label+' hashtag result fixture');
    await search.fill('');await search.press('Enter');
    await pg.locator('#sr-trend a').waitFor();ok(await pg.locator('#sr-trend a').isVisible(),label+' trending fixture');
    await pg.locator('#pcs-matchup').click();await pg.locator('#sheet').waitFor();ok(await pg.locator('#sheet').isVisible(),label+' matchup retained');
    await pg.screenshot({path:path.join(shots,label+'-matchup.png')});
    await pg.keyboard.press('Escape');await pg.locator('#sheet').waitFor({state:'hidden'});
  }else{
    ok(!(await pg.locator('#pcs-search').isVisible()),label+' desktop search remains hidden');
    ok(await pg.locator('.tb[data-k="search"]').isVisible(),label+' mobile search remains available');
  }
  ok(await pg.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' no horizontal overflow');
  ok(errors.length===0,label+' no page errors: '+errors.join(';'));
  await context.close();
}
}finally{await browser.close()}
console.log('release UI:',n,'assertions passed');
