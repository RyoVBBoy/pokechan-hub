// Read-only audit of source-derived item support and reference-oracle assumptions.
// This does not certify Pokémon Champions mechanics.
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const battle=readFileSync('src/js/15-battle.js','utf8');
const calc=readFileSync('src/js/21-calc.js','utf8');
const ref=readFileSync('tests/calc-ref.mjs','utf8');
const cases=readFileSync('tests/calc-cases.mjs','utf8');
const report={};
const unimpl=calc.match(/const CALC_UNIMPL_IT=\[([^\]]*)\]/);
assert.ok(unimpl,'unsupported item list missing');
report.explicitUnsupported=[...unimpl[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
const supported=[...battle.matchAll(/(?:a|d|b|t)\.item\s*===?\s*'([^']+)'/g)].map(x=>x[1]);
report.explicitBattleBranches=[...new Set(supported)].sort();
report.bothMarkedUnsupported=report.explicitUnsupported.filter(x=>report.explicitBattleBranches.includes(x));
report.coverage={unsupportedCount:report.explicitUnsupported.length,battleBranchCount:report.explicitBattleBranches.length};
report.comparisonUsesGen9=/Generations\.get\(9\)/.test(ref)&&/@smogon\/calc/.test(ref);
report.referenceRandomRange85to100=/k=85;k<=100/.test(ref);
report.namedCaseUsesSmogon=/@smogon\/calc/.test(cases);
report.externalDisputes=[
 {topic:'random-roll range',sources:['https://github.com/tinoxo/PokeCalc','https://github.com/alfredocox/Pokemon-Champions-Sim-Planner/blob/main/BATTLE_DAMAGE_DOCUMENT.md'],note:'PokeCalc describes 16 rolls 85..100; another Champions-specific source describes 15 rolls 86..100. Neither is device proof.'},
 {topic:'M-C item legality',sources:['https://pochamlab.com/en/guides/regulation-m-c/','https://github.com/tinoxo/PokeCalc'],note:'Secondary sources list Choice Band, Choice Specs and Assault Vest as not legal in M-C; verify official regulations.'}
];
assert.ok(report.comparisonUsesGen9&&report.referenceRandomRange85to100&&report.namedCaseUsesSmogon,'reference assumptions changed: re-audit');
const output=JSON.stringify(report,null,2);
if(process.env.ITEM_AUDIT_REPORT)writeFileSync(process.env.ITEM_AUDIT_REPORT,output+'\n');
console.log(output);
