// 英語の技の名前のうち、02-names.js（PokeAPI から作る）に無いものを、Pokémon Showdown の技データの name で補う表を作る。
// 使い方: node tools/gen-names-ref.cjs <esbuild で CommonJS にした pokemon-showdown の data/moves の .cjs> [<champions の moves の .cjs>]
// 参照: smogon/pokemon-showdown@e7f50cd7bcb36348c631534a97ae8323b8189541（2026/11/24）。出力 src/js/02-names-ref.js（手で直さない）
const fs=require('fs'),path=require('path');
const [mv,cm]=process.argv.slice(2);if(!mv){console.error('moves の .cjs を指定してください');process.exit(1)}
const B=require(path.resolve(mv)).Moves,C=cm?require(path.resolve(cm)).Moves:{};
const R=path.join(__dirname,'..','src/js/');
const MD=JSON.parse(fs.readFileSync(R+'18-import.js','utf8').match(/const MD=(\{.*?\});/s)[1]);
const N=JSON.parse(fs.readFileSync(R+'02-names.js','utf8').match(/const NAMES=(\{.*\});/s)[1]);
const out={};for(const [id,d] of Object.entries(MD)){if(N.en.m[id])continue;const r=(C[d[3]]&&C[d[3]].name)||(B[d[3]]&&B[d[3]].name);if(r)out[id]=r}
fs.writeFileSync(R+'02-names-ref.js',`/* 英語の技の名前の補い（tools/gen-names-ref.cjs が作る。手で直さない）。02-names.js に無い ${Object.keys(out).length} 技を Pokémon Showdown e7f50cd の技データの name で補う */\nconst NAMES_REF_M=${JSON.stringify(out)};\nObject.entries(NAMES_REF_M).forEach(([k,v])=>{if(!NAMES.en.m[k])NAMES.en.m[k]=v});\n`);
console.log('added',Object.keys(out).length);
