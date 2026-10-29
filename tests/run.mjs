// すべてのテストを順に実行（どれか1つでも失敗したら止める）
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const D=path.dirname(new URL(import.meta.url).pathname);
for(const t of ['worker.mjs','auth.mjs','social.mjs','site.mjs','login.mjs','i18n.mjs','calc-ref.mjs']){
  try{execFileSync(process.execPath,[path.join(D,t)],{stdio:'inherit'})}catch(e){console.error(`テスト失敗: ${t}`);process.exit(1)}
}
console.log('すべてのテストに合格しました');
