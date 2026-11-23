// すべてのテストを順に実行（どれか1つでも失敗したら止める）
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const D=path.dirname(new URL(import.meta.url).pathname);
for(const t of ['worker.mjs','auth.mjs','social.mjs','ranksrc.mjs','push.mjs','site.mjs','csp.mjs','login.mjs','dm.mjs','compactid.mjs','navlayout.mjs','gameswitch.mjs','newsbot.mjs','i18n.mjs','diag.mjs','dex.mjs','quick.mjs','follows.mjs','pfcard.mjs','calcswap.mjs','setup.mjs','picker.mjs','bookmark.mjs','viewer.mjs','twtap.mjs','favs.mjs','sync.mjs','ux1.mjs','dgdet.mjs','admhits.mjs','help.mjs','toolsguide.mjs','tips.mjs','replay.mjs','mvp.mjs','mvp-bench.mjs','dgmega.mjs','teambuild.mjs','kodawari.mjs','strategy.mjs','dexpage.mjs','disguise.mjs','screen-format-regression.mjs','screen-damage-regression.mjs','screen-property-regression.mjs','diagnosis-unsupported-regression.mjs','diagnosis-selection-impact-regression.mjs','champions-ability-data-regression.mjs','calc-cases.mjs','calc-ref.mjs']){
  try{execFileSync(process.execPath,[path.join(D,t)],{stdio:'inherit'})}catch(e){console.error(`テスト失敗: ${t}`);process.exit(1)}
}
console.log('すべてのテストに合格しました');
