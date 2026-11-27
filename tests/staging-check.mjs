// ステージングの設定の確かめ（tools/staging/check.mjs）が、本番と混ざった設定を断り、別の設定だけを通すこと。外へは何もつながない
import path from 'node:path';
import fs from 'node:fs';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const {parseToml,checkStaging}=await import(path.join(ROOT,'tools/staging/check.mjs'));
let n=0,bad=0;const ok=(c,m,i)=>{n++;if(!c){bad++;console.error('NG',m,JSON.stringify(i))}};
const PID='d1932bda-a9a7-4861-afc7-60351767c927',SID='62f9898c-a49b-4878-b85c-0c6a3fa58d93';
const ex=parseToml(fs.readFileSync(path.join(ROOT,'tools/staging/wrangler.staging.example.toml'),'utf8'));
const MAP={environments:{production:{approved:false,project:'pokechan-hub',worker:'https://pokechan-tap.pokechan.workers.dev',workerEnvId:'prod',serviceAccount:'a@prod'},staging:{approved:false,project:'gk-stg',worker:'https://gk-links-staging.x.workers.dev',workerEnvId:'stg-env',serviceAccount:'a@stg'}}};
const good=()=>{const c=JSON.parse(JSON.stringify(ex));c.name='gk-links-staging';c.d1_databases[0].database_name='gk-links-staging';c.d1_databases[0].database_id=SID;return c};
const withFb=c=>{c.vars.FB_ENV_ID='stg-env';return c};
ok(checkStaging(ex,{prodD1Id:PID}).length>0,'見本のままでは通らない（決まっていない値）','');
ok(checkStaging(good(),{prodD1Id:PID,envMap:MAP}).length===0,'別の名前・別の D1・別の環境なら通る',checkStaging(good(),{prodD1Id:PID,envMap:MAP}));
const cases=[['Worker の名前が本番',c=>{c.name='pokechan-tap'}],['D1 の名前が本番',c=>{c.d1_databases[0].database_name='pokechan-community'}],['D1 の id が本番',c=>{c.d1_databases[0].database_id=PID}],
  ['R2 が本番',c=>{c.r2_buckets=[{bucket_name:'pokechan-media'}]}],['本番のアドレスに付ける',c=>{c.routes=['game-kids.app/*']}],['呼び出してよいサイトに本番',c=>{c.vars.ALLOWED_ORIGINS='https://game-kids.app'}],
  ['合言葉を設定ファイルに',c=>{c.vars.ADMIN_TOKEN='x'}],['本番の cron',c=>{c.triggers={crons:['23 18 * * *']}}],['D1 が2つ',c=>{c.d1_databases.push({...c.d1_databases[0]})}],['対応表にない環境',c=>{c.vars.FB_ENV_ID='other'}],
  ['Firebase のプロジェクトがない（本番になる）',c=>{delete c.vars.FIREBASE_PROJECT_ID}],['Firebase のプロジェクトが本番',c=>{c.vars.FIREBASE_PROJECT_ID='pokechan-hub'}]];
for(const [m,f] of cases){const c=good();f(c);ok(checkStaging(c,{prodD1Id:PID,envMap:MAP}).length>0,'断る：'+m,'')}
ok(checkStaging(good(),{envMap:MAP}).some(e=>/prod-d1-id/.test(e)),'本番の database_id を渡さなければ通らない（比べられないため）','');
ok(checkStaging(withFb(good()),{prodD1Id:PID,envMap:MAP}).length===0,'Firebase の同期を試すときは対応表のステージングの環境で通る','');
{const M2=JSON.parse(JSON.stringify(MAP));M2.environments.staging.project='pokechan-hub';ok(checkStaging(withFb(good()),{prodD1Id:PID,envMap:M2}).some(e=>/firebase-env/.test(e)),'断る：Firebase の環境が本番と同じプロジェクト','')}
/* 本番の名前（いまの本番 pokechan-db も）・ステージングの名前はちょうど・id は UUID・none は通さない */
for(const [m,f] of [['D1 の名前がいまの本番（pokechan-db）',c=>{c.d1_databases[0].database_name='pokechan-db'}],['Worker の名前がステージングではない（ちょうどでない）',c=>{c.name='gk-links-staging2'}],['D1 の名前がステージングではない',c=>{c.d1_databases[0].database_name='gk-links-stg'}],['D1 の id が UUID ではない',c=>{c.d1_databases[0].database_id='stg-id-123'}]])
  {const c=good();f(c);ok(checkStaging(c,{prodD1Id:PID,envMap:MAP}).length>0,'断る：'+m,'')}
for(const v of ['none','',null,'prod-id'])ok(checkStaging(good(),{prodD1Id:v,envMap:MAP}).some(e=>/prod-d1-id/.test(e)),'断る：本番の id が '+JSON.stringify(v),'');
ok(checkStaging(good(),{prodD1Id:PID,stgD1Id:SID,envMap:MAP}).length===0,'作ったステージングの id と同じなら通る','');
ok(checkStaging(good(),{prodD1Id:PID,stgD1Id:'0fc26614-f2ab-476c-8d1e-b6b2f6962213',envMap:MAP}).length>0,'断る：設定の D1 の id が作ったステージングの id と違う','');
/* tools/staging/guard.mjs：本番の id は一覧のちょうど1つの行から・変数と同じ。ステージングの行・公開したあとのつなぎ先・変数・合言葉・cron */
{const G=await import(path.join(ROOT,'tools/staging/guard.mjs'));const thr=f=>{try{f();return false}catch(e){return !!e.guard}};
  const L=[{name:'pokechan-db',uuid:PID,created_at:'2026-10-27T03:15:17.378Z'},{name:'gk-links-staging',uuid:SID}];
  ok(G.resolveProd(L,{name:'pokechan-db',varId:PID})===PID,'guard：本番の id を一覧のちょうど1つの行から（変数と同じ）','');
  const P=[['変数の id がない',L,{name:'pokechan-db',varId:''}],['変数の id が none',L,{name:'pokechan-db',varId:'none'}],['一覧に本番の行がない',[L[1]],{name:'pokechan-db',varId:PID}],
    ['本番の行が2つ',[...L,{name:'pokechan-db',uuid:SID}],{name:'pokechan-db',varId:PID}],['行の id が null',[{name:'pokechan-db',uuid:null},L[1]],{name:'pokechan-db',varId:PID}],
    ['行の id が変数と違う',[{name:'pokechan-db',uuid:SID}],{name:'pokechan-db',varId:PID}],['本番の名前が表にない（違う名前）',L,{name:'gk-links-staging',varId:SID}],['本番の名前が空',L,{name:'',varId:PID}],
    ['一覧が配列ではない',{x:1},{name:'pokechan-db',varId:PID}],['同じ id の行が2つ（名前が違う）',[...L,{name:'other',uuid:PID}],{name:'pokechan-db',varId:PID}]];
  for(const [m,l,o] of P)ok(thr(()=>G.resolveProd(l,o)),'guard 断る（本番）：'+m,'');
  ok(G.resolveStg(L,{name:'gk-links-staging',prodId:PID,mode:'old'})===SID&&G.resolveStg([L[0]],{name:'gk-links-staging',prodId:PID,mode:'old'})==='','guard：消す前のステージングの行（なければ空）','');
  const S=[['名前がちょうどではない',L,{name:'gk-links-staging2',prodId:PID,mode:'old'}],['ステージングの id が本番と同じ',[L[0],{name:'gk-links-staging',uuid:PID}],{name:'gk-links-staging',prodId:PID,mode:'old'}],
    ['本番の id がない',L,{name:'gk-links-staging',prodId:'',mode:'old'}],['作ったあとに行がない',[L[0]],{name:'gk-links-staging',prodId:PID,mode:'new'}],['ステージングの行が2つ',[...L,{name:'gk-links-staging',uuid:'11111111-2222-3333-4444-555555555555'}],{name:'gk-links-staging',prodId:PID,mode:'new'}],
    ['ステージングの id が UUID ではない',[L[0],{name:'gk-links-staging',uuid:'x'}],{name:'gk-links-staging',prodId:PID,mode:'new'}]];
  for(const [m,l,o] of S)ok(thr(()=>G.resolveStg(l,o)),'guard 断る（ステージング）：'+m,'');
  const set=()=>({result:{bindings:[{type:'d1',name:'DB',id:SID},...G.STG_VARS.map(n=>({type:'plain_text',name:n})),...G.STG_SECRETS.map(n=>({type:'secret_text',name:n}))]}}),NOCRON={result:{schedules:[]}};
  const O={name:'gk-links-staging',stgId:SID,prodId:PID};
  ok(G.checkDeployed(set(),NOCRON,O).length===0,'guard：公開したあと DB＝ステージングの D1・決まった変数と合言葉4つ・cron なしなら通る',G.checkDeployed(set(),NOCRON,O));
  const D=[['D1 のつなぎ先が本番',s=>{s.result.bindings[0].id=PID}],['D1 のつなぎ先が2つ',s=>{s.result.bindings.push({type:'d1',name:'DB2',id:SID})}],['D1 のつなぎ先の名前が違う',s=>{s.result.bindings[0].name='DATA'}],
    ['決まっていないつなぎ先（R2）',s=>{s.result.bindings.push({type:'r2_bucket',name:'MEDIA'})}],['決まっていないつなぎ先（KV）',s=>{s.result.bindings.push({type:'kv_namespace',name:'K'})}],['決まっていないつなぎ先（ほかの Worker）',s=>{s.result.bindings.push({type:'service',name:'S'})}],
    ['本物の合言葉（Web Risk）がある',s=>{s.result.bindings.push({type:'secret_text',name:'WEBRISK_API_KEY'})}],['本物の合言葉（Gemini）がある',s=>{s.result.bindings.push({type:'secret_text',name:'GEMINI_API_KEY'})}],
    ['合言葉が足りない',s=>{s.result.bindings=s.result.bindings.filter(x=>x.name!=='EMAIL_HMAC_KEY')}],['決まっていない変数',s=>{s.result.bindings.push({type:'plain_text',name:'FB_ENV_ID'})}],['設定が読めない',s=>{delete s.result}]];
  for(const [m,f] of D){const x=set();f(x);ok(G.checkDeployed(x,NOCRON,O).length>0,'guard 断る（公開したあと）：'+m,'')}
  ok(G.checkDeployed(set(),{result:{schedules:[{cron:'0 * * * *'}]}},O).length>0,'guard 断る（公開したあと）：cron がある','');
  ok(G.checkDeployed(set(),{},O).length>0,'guard 断る（公開したあと）：cron の一覧が読めない','');
  ok(G.checkDeployed(set(),NOCRON,{...O,name:'pokechan-tap'}).length>0&&G.checkDeployed(set(),NOCRON,{...O,stgId:''}).length>0,'guard 断る（公開したあと）：名前・id が違う','');}
const dep0=()=>fs.readFileSync(path.join(ROOT,'.github/workflows/deploy.yml'),'utf8');
/* 本番のリンクの止まり方（読むだけ）：LINKS_POST・LINKS_CLICK が "1" なら・Web Risk の鍵があれば止める。ほかの変数の値は返さない */
{const G=await import(path.join(ROOT,'tools/staging/guard.mjs'));const S=b=>({result:{bindings:b}});
  const base=[{type:'plain_text',name:'ALLOWED_ORIGINS',text:'https://secret-ish.example'},{type:'secret_text',name:'ADMIN_TOKEN'},{type:'d1',name:'DB',id:'x'}];
  let r=G.checkProdFlags(S(base));ok(r.errs.length===0&&r.seen.LINKS_POST==='unset'&&r.seen.WEBRISK_API_KEY==='absent'&&!JSON.stringify(r).includes('secret-ish'),'本番の確かめ：リンクの変数がなく鍵もなければ通る・ほかの変数の値を返さない',r);
  r=G.checkProdFlags(S([...base,{type:'plain_text',name:'LINKS_POST',text:'0'},{type:'plain_text',name:'LINKS_CLICK',text:''}]));ok(r.errs.length===0&&r.seen.LINKS_POST==='off','本番の確かめ：0・空は止まっている',r);
  for(const [m,x] of [['LINKS_POST が 1',{type:'plain_text',name:'LINKS_POST',text:'1'}],['LINKS_CLICK が 1',{type:'plain_text',name:'LINKS_CLICK',text:'1'}],['LINKS_POST が合言葉の形（値が見えない）',{type:'secret_text',name:'LINKS_POST'}],['Web Risk の鍵がある',{type:'secret_text',name:'WEBRISK_API_KEY'}]])
    ok(G.checkProdFlags(S([...base,x])).errs.length>0,'本番の確かめ 断る：'+m,'');
  ok(G.checkProdFlags({}).errs.length>0,'本番の確かめ 断る：設定が読めない','');}
ok(!/LINKS_POST|LINKS_CLICK|WEBRISK_API_KEY|SANCTIONS_ON/.test(dep0()),'本番の公開（deploy.yml）はリンクの変数・Web Risk の鍵を設定しない（本物の確かめが済むまで止めたまま）','');
const dep=fs.readFileSync(path.join(ROOT,'.github/workflows/deploy.yml'),'utf8');ok(!/staging/.test(dep),'本番の公開（deploy.yml）はステージングの設定を読まない','');
{const wf=fs.readFileSync(path.join(ROOT,'.github/workflows/staging-d1.yml'),'utf8');
ok(/CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_STAGING_TOKEN \}\}/.test(wf)&&!/secrets\.CLOUDFLARE_API_TOKEN/.test(wf)&&!/\|\|\s*secrets\./.test(wf),'ステージングの確かめはステージング専用の鍵だけを使う（本番の公開用の鍵に切りかえない）','');
const iProd=wf.indexOf('guard.mjs prod --list /tmp/d1.json'),iDel=wf.indexOf('wrangler d1 delete'),iCreate=wf.indexOf('wrangler d1 create'),iDeploy=wf.indexOf('wrangler deploy');
ok(iProd>0&&iProd<iDel&&iProd<iCreate&&iProd<iDeploy,'ワークフロー：本番の id を一覧から決めるのは、消す・作る・公開より前','');
ok(!/:-none/.test(wf)&&!/pokechan-community/.test(wf)&&/--prod-d1-id "\$PROD_UUID" --stg-d1-id "\$STG_D1_ID"/.test(wf),'ワークフロー：none を渡さない・本番の名前のはじめの値に頼らない・確かめた id を渡す','');
ok(/guard\.mjs prodflags/.test(wf)&&/guard\.mjs deployed/.test(wf)&&/guard\.mjs stgrow/.test(wf)&&/guard\.mjs stgnew/.test(wf),'ワークフロー：消す前・作ったあと・公開したあとを guard で確かめる','');
ok(/権限が広すぎる/.test(wf)&&/本番の Worker か D1 が変わった/.test(wf)&&/guard\.mjs deployed/.test(wf),'ステージングの確かめは鍵の広さ・本番が変わっていないか・つなぎ先を確かめる','');}
console.log(bad?`staging-check: NG（${bad}/${n}）`:`staging-check: OK（${n}項目）`);if(bad)process.exit(1);
