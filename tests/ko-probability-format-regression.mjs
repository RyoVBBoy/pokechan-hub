// Regression: exactly zero KO probability must never be presented as a nonzero bound.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const src=readFileSync(path.join(root,'src/js/21-calc.js'),'utf8');
const start=src.indexOf('const pctTxt='),end=src.indexOf('\n',start);
assert.ok(start>=0&&end>start,'pctTxt must exist');
const pctTxt=new Function(src.slice(start,end)+';return pctTxt;')();
assert.equal(pctTxt(0),'0%');
assert.equal(pctTxt(0.0005),'0.1%未満');
assert.equal(pctTxt(0.5),'50%');
assert.equal(pctTxt(1),'100%');
console.log('KO probability formatting: 4/4 passed');
