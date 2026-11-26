// ステージング（テスト専用）の設定が本番と混ざっていないかを確かめる（docs/secure-link-posting-runbook.md §7）。外へは何もつながない・何も作らない。
// 使い方：node tools/staging/check.mjs <wrangler.staging.toml> [--prod-d1-id <本番の database_id>]
//   本番の名前は決まった値（Worker pokechan-tap・D1 pokechan-db〔いまの本番〕と pokechan-community〔deploy.yml のはじめの値〕・R2 pokechan-media・本番のアドレス）と、渡された本番の database_id（UUID）。
//   ステージングの名前はちょうど gk-links-staging（Worker・D1 とも）。--stg-d1-id を渡すと、設定の D1 の id がその値と同じかも確かめる。
// 合格したら、ステージングだけで動かすコマンドを表示する（動かさない）。
import fs from 'node:fs';
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'../..');
export const PROD={workers:['pokechan-tap'],d1:['pokechan-db','pokechan-community'],r2:['pokechan-media'],hosts:['pokechan-hub.pages.dev','game-kids.app','www.game-kids.app','pokechan-tap.pokechan.workers.dev']};
/* とても小さな TOML の読み取り（この見本の形だけ：key = "値"・[表]・[[表の並び]]・crons の配列） */
export function parseToml(t){const o={},stack=[o];let cur=o;
  for(const raw of t.split('\n')){const l=raw.replace(/#.*$/,'').trim();if(!l)continue;
    let m;if((m=l.match(/^\[\[([\w.]+)\]\]$/))){(o[m[1]]=o[m[1]]||[]).push(cur={});continue}
    if((m=l.match(/^\[([\w.]+)\]$/))){cur=o[m[1]]=o[m[1]]||{};continue}
    if((m=l.match(/^([\w]+)\s*=\s*(.+)$/))){let v=m[2].trim();if(/^".*"$/.test(v))v=v.slice(1,-1);else if(/^\[.*\]$/.test(v))v=JSON.parse(v);else if(v==='true'||v==='false')v=v==='true';cur[m[1]]=v}}
  return o}
const UUIDRE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const STG='gk-links-staging';
export function checkStaging(cfg,{prodD1Id='',stgD1Id='',envMap=null}={}){const errs=[];
  const ph=v=>typeof v!=='string'||!v||/^<.*>$/.test(v);
  if(ph(cfg.name))errs.push('name が決まっていない');else if(PROD.workers.includes(cfg.name))errs.push('Worker の名前が本番と同じ: '+cfg.name);else if(cfg.name!==STG)errs.push('Worker の名前がちょうど '+STG+' ではない: '+cfg.name);
  const d=(cfg.d1_databases||[]);if(d.length!==1)errs.push('D1 はステージング用の1つだけ');
  for(const x of d){if(ph(x.database_name)||ph(x.database_id))errs.push('D1 の名前と id が決まっていない');
    if(PROD.d1.includes(x.database_name))errs.push('D1 の名前が本番と同じ: '+x.database_name);else if(!ph(x.database_name)&&x.database_name!==STG)errs.push('D1 の名前がちょうど '+STG+' ではない: '+x.database_name);
    if(!ph(x.database_id)&&!UUIDRE.test(x.database_id))errs.push('D1 の id が UUID ではない');
    if(prodD1Id&&x.database_id===prodD1Id)errs.push('D1 の id が本番と同じ');
    if(stgD1Id&&x.database_id!==stgD1Id)errs.push('D1 の id が作ったステージングの D1 と違う');}
  if(!prodD1Id||!UUIDRE.test(String(prodD1Id)))errs.push('本番の database_id（UUID）を --prod-d1-id で渡してください（同じでないことを確かめるため。none・空は通さない）');
  if(stgD1Id&&!UUIDRE.test(String(stgD1Id)))errs.push('--stg-d1-id が UUID ではない');
  for(const x of (cfg.r2_buckets||[]))if(PROD.r2.includes(x.bucket_name))errs.push('R2 が本番と同じ: '+x.bucket_name);
  if(cfg.routes||cfg.route)errs.push('routes は使わない（workers.dev だけ。本番のアドレスに付けない）');
  const v=cfg.vars||{};const ao=String(v.ALLOWED_ORIGINS||'');for(const h of PROD.hosts)if(ao.includes(h))errs.push('ALLOWED_ORIGINS に本番のアドレス: '+h);
  /* 本番の Firebase のログインを受けない：FIREBASE_PROJECT_ID は必ず入れ、demo- のプロジェクトか、本番と違うプロジェクトにする（入れないと本番の pokechan-hub になる） */
  const prodProj=(envMap&&envMap.environments&&envMap.environments.production&&envMap.environments.production.project)||'pokechan-hub';
  if(ph(v.FIREBASE_PROJECT_ID))errs.push('FIREBASE_PROJECT_ID が決まっていない（入れないと本番の Firebase のログインを受ける）');else if(v.FIREBASE_PROJECT_ID===prodProj||v.FIREBASE_PROJECT_ID==='pokechan-hub')errs.push('FIREBASE_PROJECT_ID が本番と同じ');
  /* FB_ENV_ID は Firebase の同期を試すときだけ（入れたら対応表の承認されたステージングの環境と同じ値） */
  const fbOn='FB_ENV_ID' in v;if(fbOn&&ph(v.FB_ENV_ID))errs.push('FB_ENV_ID が決まっていない');
  for(const k of ['ADMIN_TOKEN','APP_TOKEN','WEBRISK_API_KEY','EMAIL_HMAC_KEY','EMAIL_HMAC_KEYRING','FB_ADAPTER_TOKEN','FB_HOOK_TOKEN','GEMINI_API_KEY'])if(k in v)errs.push(k+' を設定ファイルに書かない（wrangler secret put で、ステージング専用の値を）');
  const crons=(cfg.triggers&&cfg.triggers.crons)||[];if(crons.some(c=>c!=='0 * * * *'))errs.push('本番の cron（お知らせ・集計など）は入れない');
  if(envMap&&fbOn){const st=Object.entries(envMap.environments||{}).filter(([k])=>k!=='production');const pr=(envMap.environments||{}).production||{};
    const e=st.find(([,x])=>x.workerEnvId===v.FB_ENV_ID);
    if(!e)errs.push('firebase-env.json に、この FB_ENV_ID の環境がない');
    else for(const k of ['project','worker','workerEnvId','serviceAccount'])if(e[1][k]&&e[1][k]===pr[k])errs.push('firebase-env.json の '+e[0]+' が本番と同じ '+k);}
  return errs}
if(import.meta.url===`file://${process.argv[1]}`){
  const f=process.argv[2];if(!f){console.error('使い方：node tools/staging/check.mjs <wrangler.staging.toml> --prod-d1-id <本番の id>');process.exit(2)}
  const i=process.argv.indexOf('--prod-d1-id');const pid=i>0?process.argv[i+1]:'';const j=process.argv.indexOf('--stg-d1-id');const sid=j>0?process.argv[j+1]:'';
  const cfg=parseToml(fs.readFileSync(f,'utf8'));const map=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/firebase-env.json'),'utf8'));
  const errs=checkStaging(cfg,{prodD1Id:pid,stgD1Id:sid,envMap:map});
  if(errs.length){console.error('ステージングの設定に問題があります（何も作っていません）：\n- '+errs.join('\n- '));process.exit(1)}
  const w=cfg.name,dn=cfg.d1_databases[0].database_name;
  console.log(`合格（${w} / D1 ${dn}）。ステージングだけで動かす手順（依頼主の承認のあと、ステージング専用の API トークンで）：
  npx wrangler@3 d1 create ${dn}            # まだなければ（無料枠）。出た id を設定ファイルへ
  npx wrangler@3 secret put ADMIN_TOKEN --config ${f}     # ほかの合言葉も同じ（本番の値は使わない）
  npx wrangler@3 deploy --config ${f}
  # https://${w}.<アカウント>.workers.dev に合成のデータだけで、runbook §7 の流れを手で確かめる（本番のデータは使わない）
  npx wrangler@3 delete --config ${f} && npx wrangler@3 d1 delete ${dn}    # 終わったら消す`);
}
