// Source-level impact regression: diagnosis categories, switch-in counts and selection rank.
// These are synthetic boundary fixtures, NOT measured Pokémon Champions damage.
// Run: node tests/diagnosis-selection-impact-regression.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const src=readFileSync(path.join(root,'src/js/61-select.js'),'utf8');
const fn=src.slice(src.indexOf('function dgSelect(entries){'),src.indexOf('/* 1つの選出の説明'));
assert.ok(fn.startsWith('function dgSelect(entries){')&&fn.includes('return out;'),'real selection function extracted');
const setup=`
const DG_SELC=new Map(),SEL_LV={4:1,3:.7,2:.25,1:0};
const PICK=()=>2,dgDataSig=()=> 'impact-fixture';
const formInfo=p=>({base:p.n}),teamWx=()=>null,isStone=()=>false;
const combos=(arr,k)=>k===0?[[]]:arr.flatMap((x,i)=>combos(arr.slice(i+1),k-1).map(z=>[x,...z]));
const MD={},FMT='single',dgTeam=()=>globalT;`;
const factory=new Function('globalT',setup+fn+'return dgSelect;');
const make=(a,b)=>{
  const ms=['A','B','C'].map(n=>({p:{n}}));
  const rows=Array.from({length:4},(_,j)=>{
    const res=[a,b,1].map((r,i)=>({i,r,k:r>=4?'ko_fast':'lose',swIn:r>=4?'win':'no',
      spd:i===0?1:-1,op:{nMax:3,fmax:40},me:{min:40},wxTeam:false}));
    return {q:{no:j+1,n:'Opponent'+j},res,lvl:3,stable:res.filter(x=>x.r>=4)};
  });
  const T={ms,M:ms.map(x=>({p:x.p})),rows,tr:{on:false},unk:[]};
  return factory(T)(ms.map((x,i)=>({no:i+1,axis:i===2})));
};
const before=make(4,1),after=make(1,4);
assert.deepEqual(before.best.c,[0,2],'before: A plus fixed axis C');
assert.deepEqual(after.best.c,[1,2],'after: B plus fixed axis C');
assert.equal(before.best.cnt[3],4,'before: four opponents rated circle');
assert.equal(after.best.cnt[3],4,'after: four opponents rated circle');
assert.equal(before.list[1].cnt[1],4,'before: other selection has four crosses');
assert.equal(after.list[1].cnt[1],4,'after: other selection has four crosses');
assert.equal(before.best.sw,4,'before: four switch-in wins');
assert.equal(after.best.sw,4,'after: four switch-in wins');
assert.equal(before.list[1].sw,0,'before: runner-up has zero switch-in wins');
assert.equal(after.list[1].sw,0,'after: runner-up has zero switch-in wins');
assert.ok(before.best.sc>before.list[1].sc&&after.best.sc>after.list[1].sc,'ranking changes with diagnosis inputs');
console.log('PASS: real dgSelect source responds to fixture changes in category counts, switch-in counts and selection ranking');
