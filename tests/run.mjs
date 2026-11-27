// テストを順に実行。--keep-going を指定すると、失敗を記録して残りのテストも実行する。
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const D=path.dirname(new URL(import.meta.url).pathname);
const keepGoing=process.argv.includes('--keep-going');
const failures=[];
for(const t of ['worker.mjs','auth.mjs','social.mjs','links.mjs','links-migrate.mjs','fb-adapter.mjs','fb-sdk.mjs','fb-emulator.mjs','staging-check.mjs','webrisk-smoke.mjs','d1-integration.mjs','ranksrc.mjs','push.mjs','site.mjs','csp.mjs','login.mjs','links-ui.mjs','dm.mjs','compactid.mjs','navlayout.mjs','gameswitch.mjs','newsbot.mjs','i18n.mjs','diag.mjs','dex.mjs','quick.mjs','follows.mjs','pfcard.mjs','calcswap.mjs','setup.mjs','picker.mjs','bookmark.mjs','viewer.mjs','twtap.mjs','favs.mjs','sync.mjs','ux1.mjs','dgdet.mjs','admhits.mjs','help.mjs','toolsguide.mjs','tips.mjs','replay.mjs','mvp.mjs','mvp-bench.mjs','release-guards.mjs','move-learners.mjs','dgmega.mjs','teambuild.mjs','kodawari.mjs','strategy.mjs','dexpage.mjs','disguise.mjs','screen-format-regression.mjs','screen-damage-regression.mjs','screen-property-regression.mjs','diagnosis-unsupported-regression.mjs','diagnosis-selection-impact-regression.mjs','champions-ability-data-regression.mjs','ability-diagnosis-selection-integration.mjs','ability-critical-double-matrix.mjs','ko-probability-format-regression.mjs','calc-cases.mjs','formid.mjs','logic-fixes-20261124.mjs','impl-fixes-20261124b.mjs','learnset-ui.mjs','mechanics-20261124c.mjs','repro-golisopod-move.mjs','calc-ref.mjs']){
  try{
    execFileSync(process.execPath,[path.join(D,t)],{stdio:'inherit'});
  }catch(e){
    console.error(`テスト失敗: ${t}`);
    if(!keepGoing)process.exit(1);
    failures.push(t);
  }
}
if(failures.length){
  console.error(`失敗したテスト（${failures.length}件）: ${failures.join(', ')}`);
  process.exitCode=1;
}else{
  console.log('すべてのテストに合格しました');
}
