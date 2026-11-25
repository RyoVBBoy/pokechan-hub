import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/js/62-improve.js',import.meta.url),'utf8');
const start=src.indexOf('const IMP_USED='),end=src.indexOf('function dgImprove(entries)');
assert.ok(start>=0&&end>start);
const helper=src.slice(start,end);
const run=new Function(`const LIVE={csv:{25:{mv:[['move1',71.8],['move2',10]]}}};const MVKA={move1:1,move2:2,move3:3};const nrm=x=>x;const FMT='single';const mvpRowOf=(fmt,no,stone)=>{if(no===25&&stone==='stone')return{mv:[['move1',98.3],['move3',30]]};return null};${helper}
const use=impUsePct(25,'stone');return {use,protected:[1,2,3].filter(id=>(use[id]||0)>=IMP_USED),missing:impUsePct(999,null)}`)();
assert.deepEqual(run.use,{1:98.3,2:10,3:30});
assert.deepEqual(run.protected,[1,3]);
assert.deepEqual(run.missing,{});
assert.ok(src.includes('atkIdx.filter(o=>!((use[o.m.id]||0)>=IMP_USED))'));
assert.ok(!src.includes('は上位の相手にいちばん使われていない技'));
assert.ok(src.includes('最善の攻撃に選ばれた相手が'));
console.log('party move usage: 6 assertions passed');
