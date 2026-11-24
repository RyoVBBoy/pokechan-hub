// Focused regression for battle-format/screen selection.
// Run: node tests/screen-format-regression.mjs
// This exercises the exact modifier-selection expression extracted from production source.
// It does NOT validate Pokémon Champions' actual wall multipliers or full damage results.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const battle=readFileSync(path.join(root,'src/js/15-battle.js'),'utf8');
const calc=readFileSync(path.join(root,'src/js/21-calc.js'),'utf8');
const reference=readFileSync(path.join(root,'tests/calc-cases.mjs'),'utf8');

const selection=battle.match(/fm=chM\(fm,(\(o\.format==='double'.*?\))\?2732:2048\);/);
assert.ok(selection,'Cannot find the production wall-format selection expression');
const modifier=new Function('o',`return ${selection[1]} ? 2732 : 2048`);

let count=0;
for(const format of ['single','double']){
  for(const spread of [false,true]){
    assert.equal(modifier({format,spread}),format==='double'?2732:2048,`${format}, spread=${spread}`);
    count++;
  }
}
for(const [spread,expected] of [[false,2048],[true,2732]]){
  assert.equal(modifier({spread}),expected,`legacy caller, spread=${spread}`);
  count++;
}
/* 2026-11-24: Infiltrator also bypasses screens (Pokémon Showdown e7f50cd); the crit and wall-breaker exemptions are still required. */
assert.match(battle,/if\(o\.screen&&!crit&&a\.ab!=='infiltrator'&&!\['brickbreak','psychicfangs','ragingbull'\]\.includes\(mk\)\)/);
assert.match(calc,/format:FMT,spread:FMT==='double'&&CS\.spread/);
assert.match(reference,/gameType:o\.format==='double'\?'Doubles':'Singles'/);
assert.match(reference,/format:o\.format\|\|'single'/);
console.log(`PASS: ${count} wall-format selection cases; four integration guards found`);
