// すべてのテストを順に実行（どれか1つでも失敗したら止める）
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const D=path.dirname(new URL(import.meta.url).pathname);
for(const t of ['worker.mjs','auth.mjs','social.mjs','push.mjs','site.mjs','csp.mjs','login.mjs','dm.mjs','i18n.mjs','diag.mjs','dex.mjs','quick.mjs','follows.mjs','calcswap.mjs','picker.mjs','bookmark.mjs','favs.mjs','sync.mjs','ux1.mjs','dgdet.mjs','admhits.mjs','help.mjs','replay.mjs','mvp.mjs','mvp-bench.mjs','dgmega.mjs','disguise.mjs','calc-cases.mjs','calc-ref.mjs']){
  try{execFileSync(process.execPath,[path.join(D,t)],{stdio:'inherit'})}catch(e){console.error(`テスト失敗: ${t}`);process.exit(1)}
}
console.log('すべてのテストに合格しました');
