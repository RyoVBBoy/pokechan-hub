import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = filename => readFileSync(new URL('../src/js/' + filename, import.meta.url), 'utf8');
const calc = source('21-calc.js');
const probability = calc.match(/^const pctTxt=.*$/m)?.[0];
assert.ok(probability, 'The calculator probability formatter is available');
const pctTxt = vm.runInNewContext(probability + '\npctTxt');
assert.equal(pctTxt(0), '0%');
assert.equal(pctTxt(0.0005), '0.1%未満');
assert.equal(pctTxt(0.5), '50%');
assert.equal(pctTxt(1), '100%');

const mvp = source('76-mvp.js');
const compareFunction = mvp.slice(mvp.indexOf('function mvpCompare('), mvp.indexOf('/* 入れかえ案。'));
const compare = vm.runInNewContext(compareFunction + '\nmvpCompare', {WX_GAIN: {sun: ['chlorophyll'], rain: ['swift-swim']}});
const weather = w => ({k: 'weather', w, sc: true});
const scenario = (no, roles, abilities, weak = []) => ({
  mem: [{no}, {no: 3}, {no: 6}],
  roles,
  abs: abilities,
  scen: [{key: 'none', u: -1, weak, rows: []}]
});
const sun = scenario(324, [[weather('sun')], [], []], ['drought', 'chlorophyll', 'blaze'], [{key: 'fixed', crit: true}]);
const rain = scenario(279, [[weather('rain')], [], []], ['drizzle', 'chlorophyll', 'blaze']);
const lostSun = compare(sun, rain, 324, 279);
assert.equal(lostSun.roles.lost[0].w, 'sun');
assert.equal(lostSun.roles.added[0].w, 'rain');
assert.equal(lostSun.roleLoss, true);
assert.equal(lostSun.verdict, 'tradeoff');
const preserved = compare(sun, {...rain, roles: [rain.roles[0], [], [weather('sun')]]}, 324, 279);
assert.equal(preserved.roles.lost.length, 0);
assert.equal(preserved.verdict, 'better');
const unused = compare(sun, {...rain, abs: ['drizzle', 'overgrow', 'blaze']}, 324, 279);
assert.equal(unused.roleLoss, false);
console.log('Calculator probability and weather role releases: 11 checks passed');
