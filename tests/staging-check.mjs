// ステージングの設定の確かめ（tools/staging/check.mjs）が、本番と混ざった設定を断り、別の設定だけを通すこと。外へは何もつながない
import path from 'node:path';
import fs from 'node:fs';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const {parseToml,checkStaging}=await import(path.join(ROOT,'tools/staging/check.mjs'));
let n=0,bad=0;const ok=(c,m,i)=>{n++;if(!c){bad++;console.error('NG',m,JSON.stringify(i))}};
const ex=parseToml(fs.readFileSync(path.join(ROOT,'tools/staging/wrangler.staging.example.toml'),'utf8'));
const MAP={environments:{production:{approved:false,project:'pokechan-hub',worker:'https://pokechan-tap.pokechan.workers.dev',workerEnvId:'prod',serviceAccount:'a@prod'},staging:{approved:false,project:'gk-stg',worker:'https://gk-links-staging.x.workers.dev',workerEnvId:'stg-env',serviceAccount:'a@stg'}}};
const good=()=>{const c=JSON.parse(JSON.stringify(ex));c.name='gk-links-staging';c.d1_databases[0].database_name='gk-links-staging';c.d1_databases[0].database_id='stg-id-123';c.vars.FB_ENV_ID='stg-env';return c};
ok(checkStaging(ex,{prodD1Id:'prod-id'}).length>0,'見本のままでは通らない（決まっていない値）','');
ok(checkStaging(good(),{prodD1Id:'prod-id',envMap:MAP}).length===0,'別の名前・別の D1・別の環境なら通る',checkStaging(good(),{prodD1Id:'prod-id',envMap:MAP}));
const cases=[['Worker の名前が本番',c=>{c.name='pokechan-tap'}],['D1 の名前が本番',c=>{c.d1_databases[0].database_name='pokechan-community'}],['D1 の id が本番',c=>{c.d1_databases[0].database_id='prod-id'}],
  ['R2 が本番',c=>{c.r2_buckets=[{bucket_name:'pokechan-media'}]}],['本番のアドレスに付ける',c=>{c.routes=['game-kids.app/*']}],['呼び出してよいサイトに本番',c=>{c.vars.ALLOWED_ORIGINS='https://game-kids.app'}],
  ['合言葉を設定ファイルに',c=>{c.vars.ADMIN_TOKEN='x'}],['本番の cron',c=>{c.triggers.crons=['23 18 * * *']}],['D1 が2つ',c=>{c.d1_databases.push({...c.d1_databases[0]})}],['対応表にない環境',c=>{c.vars.FB_ENV_ID='other'}]];
for(const [m,f] of cases){const c=good();f(c);ok(checkStaging(c,{prodD1Id:'prod-id',envMap:MAP}).length>0,'断る：'+m,'')}
ok(checkStaging(good(),{envMap:MAP}).some(e=>/prod-d1-id/.test(e)),'本番の database_id を渡さなければ通らない（比べられないため）','');
{const M2=JSON.parse(JSON.stringify(MAP));M2.environments.staging.project='pokechan-hub';ok(checkStaging(good(),{prodD1Id:'prod-id',envMap:M2}).some(e=>/firebase-env/.test(e)),'断る：Firebase の環境が本番と同じプロジェクト','')}
const dep=fs.readFileSync(path.join(ROOT,'.github/workflows/deploy.yml'),'utf8');ok(!/staging/.test(dep),'本番の公開（deploy.yml）はステージングの設定を読まない','');
console.log(bad?`staging-check: NG（${bad}/${n}）`:`staging-check: OK（${n}項目）`);if(bad)process.exit(1);
