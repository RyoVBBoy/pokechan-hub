// Guard unsupported ability/item warnings shared by party diagnosis and selection.
// Run: node tests/diagnosis-unsupported-regression.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(path.join(root,p),'utf8');
const dg=read('src/js/60-diag.js'),calc=read('src/js/21-calc.js'),sel=read('src/js/61-select.js');
const fn=dg.match(/const dgCalcUnsupported=m=>\{[\s\S]*?return out\};/);
const ab=calc.match(/const CALC_UNIMPL=\[[^\n]+\];/),it=calc.match(/const CALC_UNIMPL_IT=\[[^\n]+\];/);
assert.ok(fn&&ab&&it,'unsupported modifier source markers');
const check=new Function('ABN','ITEMN',ab[0]+'\n'+it[0]+'\nconst DG_SIMONLY=new Set([\'intimidate\']);\n'+fn[0]+'\nreturn dgCalcUnsupported;')(
 {unaware:'てんねん','marvel-scale':'ふしぎなうろこ','friend-guard':'フレンドガード'},
 {ironball:'くろいてっきゅう'});
for(const [m,name] of [[{ab:'unaware'},'てんねん'],[{ab:'marvel-scale'},'ふしぎなうろこ'],
 [{ab:'friend-guard'},'フレンドガード'],[{item:'ironball'},'くろいてっきゅう'],
 [{ab:'intimidate'},'特性']]){
 assert.ok(check(m).join(' ').includes(name),name);
}
assert.deepEqual(check({ab:'rough-skin',item:'leftovers'}),[],'supported modifiers not falsely flagged');
assert.ok(dg.includes('◎〜×と後出し判定は暫定評価です'),'diagnosis visible caveat');
assert.ok(sel.includes('選出順位・先発・後出しの判定は暫定評価です'),'selection visible caveat');
console.log('PASS: 6 unsupported modifier cases + 2 UI caveat checks');
