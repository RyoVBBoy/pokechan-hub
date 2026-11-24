// 再現用（2026/11/20 作成・2026/11/24 直したので tests/run.mjs に入れた。もとに戻ると NG）
// 改善案（62-improve.js dgImprove の「技」）が、使用データでいちばん多く使われている技を「上位の相手にいちばん使われていない技」と書いて入れかえを勧める。
// 数えているのは使用率ではなく、上位18匹との1対1で「いちばんダメージの大きい技（dgBest）に選ばれた回数」（bestUse）。
// PokéKit（75-mvp-data.js）golisopodmega：シングル きゅうけつ71.8%（ふいうち77.1%に次ぐ2位・入れかえ対象の攻撃技では1位）、ダブル98.3%（1位）。
import {chromium} from 'playwright';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const pg=await (await b.newContext({locale:'ja-JP'})).newPage();
await pg.route(/^https?:/,r=>r.abort());
await pg.goto('file://'+path.join(ROOT,'dist/index.html')+'#/team');await pg.waitForTimeout(800);
const R=await pg.evaluate(()=>{const id=k=>+Object.keys(MD).find(i=>MD[i][3]===k);const mv=ks=>ks.map(k=>({id:id(k),n:mName(id(k))}));
  team=[{no:768,set:{ab:{k:'emergency-exit',n:''},it:{k:'golisopite',n:''},mv:mv(['suckerpunch','leechlife','swordsdance','closecombat']),sp:[2,32,0,0,0,32],up:1,dn:3}},{no:445},{no:130},{no:143},{no:6},{no:9}];
  try{DG_CACHE.clear()}catch(e){}
  const row=MVP_DATA.sets.single.rows.find(r=>r.id==='golisopodmega');const pct=Object.fromEntries(row.mv);
  const L=dgImprove(team).list.filter(o=>o.kind==='move'&&o.i===0);
  return{pctLeech:pct.leechlife,pctCC:pct.closecombat,bad:L.filter(o=>/きゅうけつは上位の相手にいちばん使われていない/.test(o.why)).map(o=>o.title)}});
await b.close();
const bug=R.bad.length>0&&R.pctLeech>R.pctCC;
console.log(bug?'NG（再現した）':'OK（再現しない）',JSON.stringify(R));
process.exit(bug?1:0);
