// ステージングの確かめ（.github/workflows/staging-d1.yml）で、本番と混ざらないことを「閉じる側」で確かめる小さな道具（docs/secure-link-posting-runbook.md §7）。
// 外へは何もつながない。ワークフローが Cloudflare から読んだ JSON（D1 の一覧・Worker の設定・cron）を渡し、合わなければ 1 で止める。
//   node tools/staging/guard.mjs prod     --list d1.json --name <本番の D1 の名前> --var-id <変数の本番の id>      → 本番の id を出す
//   node tools/staging/guard.mjs stgrow   --list d1.json --name gk-links-staging --prod-id <本番の id>          → 消してよいステージングの id（なければ空）
//   node tools/staging/guard.mjs stgnew   --list d1.json --name gk-links-staging --prod-id <本番の id>          → 作ったばかりのステージングの id
//   node tools/staging/guard.mjs prodflags --settings prod-set.json   → 本番の Worker でリンクの投稿・押す・Web Risk の鍵が止まっているか（読むだけ・名前だけ出す）
//   node tools/staging/guard.mjs deployed --settings set.json --schedules sch.json --name gk-links-staging --stg-id <id> --prod-id <本番の id>
import fs from 'node:fs';
import {PROD} from './check.mjs';
export const STG_NAME='gk-links-staging';
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/* 公開したステージングの Worker にあってよいもの（これ以外のつなぎ先・変数・合言葉があれば止める） */
export const STG_VARS=['LINKS_POST','LINKS_CLICK','SANCTIONS_ON','FIREBASE_PROJECT_ID','ALLOWED_ORIGINS','ADMIN_REVIEWER','DEBUG_ERR'];
export const STG_SECRETS=['ADMIN_TOKEN','APP_TOKEN','EMAIL_HMAC_KEY','FB_ADAPTER_TOKEN'];
const fail=m=>{const e=new Error(m);e.guard=true;throw e};
const rows=l=>{if(!Array.isArray(l))fail('D1 の一覧が配列ではない');return l};
/* 本番の D1：その名前の行がちょうど1つ・id は UUID・変数の id と同じ（変数がない・空・違えば止める）。本番の名前は決まった表にあるものだけ */
export function resolveProd(list,{name,varId}){
  if(!name||!PROD.d1.includes(name))fail('本番の D1 の名前が決まった表にない: '+String(name));
  if(!varId||!UUID.test(String(varId)))fail('本番の D1 の id の変数がない・UUID ではない');
  const m=rows(list).filter(r=>r&&r.name===name);
  if(m.length!==1)fail('本番の D1 の名前の行がちょうど1つではない（'+m.length+'）');
  const id=m[0].uuid;if(typeof id!=='string'||!UUID.test(id))fail('本番の D1 の行の id がない・UUID ではない');
  if(id!==varId)fail('本番の D1 の id が変数と違う');
  if(rows(list).filter(r=>r&&r.uuid===id).length!==1)fail('本番の D1 の id の行が1つではない');
  return id}
/* ステージングの D1：名前はちょうど gk-links-staging・本番の名前の表にない・id は UUID で本番と違う。mode='old' はなくてもよい（消す前）、'new' は1つだけ要る（作ったあと） */
export function resolveStg(list,{name,prodId,mode}){
  if(name!==STG_NAME)fail('ステージングの名前が '+STG_NAME+' ではない: '+String(name));
  if(PROD.d1.includes(name)||PROD.workers.includes(name))fail('ステージングの名前が本番と同じ');
  if(!prodId||!UUID.test(String(prodId)))fail('本番の id が決まっていない（先に prod で確かめる）');
  const m=rows(list).filter(r=>r&&r.name===name);
  if(m.length>1)fail('ステージングの名前の行が2つ以上');
  if(!m.length){if(mode==='new')fail('作ったはずのステージングの D1 がない');return ''}
  const id=m[0].uuid;if(typeof id!=='string'||!UUID.test(id))fail('ステージングの D1 の id がない・UUID ではない');
  if(id===prodId)fail('ステージングの D1 の id が本番と同じ');
  return id}
/* 公開したあとの Worker：D1 のつなぎ先は DB＝ステージングの id の1つだけ。ほかの種類のつなぎ先（R2・KV・ほかの Worker など）はない。
   変数はステージングの決まった名前だけ・合言葉は決まった4つだけ（Web Risk・Gemini・Firebase など本物の合言葉がない）。cron はない */
export function checkDeployed(settings,schedules,{name,stgId,prodId}){const errs=[];
  if(name!==STG_NAME)errs.push('Worker の名前が '+STG_NAME+' ではない');
  if(!stgId||!UUID.test(String(stgId)))errs.push('ステージングの D1 の id がない');
  if(!prodId||!UUID.test(String(prodId)))errs.push('本番の D1 の id がない');
  const b=settings&&settings.result&&settings.result.bindings;
  if(!Array.isArray(b))return [...errs,'Worker の設定（bindings）が読めない'];
  const d1=b.filter(x=>x.type==='d1'),other=b.filter(x=>!['d1','plain_text','secret_text'].includes(x.type));
  if(d1.length!==1)errs.push('D1 のつなぎ先がちょうど1つではない（'+d1.length+'）');
  for(const x of d1){const id=x.id||x.database_id;if(x.name!=='DB')errs.push('D1 のつなぎ先の名前が DB ではない: '+x.name);
    if(id!==stgId)errs.push('D1 のつなぎ先がステージングの id ではない');if(prodId&&id===prodId)errs.push('D1 のつなぎ先が本番の D1');}
  for(const x of other)errs.push('決まっていないつなぎ先: '+x.type+' '+x.name);
  const vars=b.filter(x=>x.type==='plain_text').map(x=>x.name).sort(),sec=b.filter(x=>x.type==='secret_text').map(x=>x.name).sort();
  for(const v of vars)if(!STG_VARS.includes(v))errs.push('決まっていない変数: '+v);
  if(JSON.stringify(sec)!==JSON.stringify([...STG_SECRETS].sort()))errs.push('合言葉が決まった4つではない: '+sec.join(','));
  const sc=schedules&&schedules.result&&schedules.result.schedules;
  if(!Array.isArray(sc))errs.push('cron の一覧が読めない');else if(sc.length)errs.push('cron がある（'+sc.length+'）');
  return errs}
/* 本番の Worker（読むだけ）：リンクの投稿・押すは止まっている（LINKS_POST・LINKS_CLICK が "1" でない）、Web Risk の鍵を置いていない。
   ほかの変数の値は見ない・出さない（返すのはリンクにかかわる名前と、止まっているかだけ） */
export const LINK_VARS=['LINKS_POST','LINKS_CLICK','SANCTIONS_ON'];
export function checkProdFlags(settings){
  const b=settings&&settings.result&&settings.result.bindings;
  if(!Array.isArray(b))return{errs:['本番の Worker の設定（bindings）が読めない'],seen:null};
  const errs=[],seen={};
  for(const k of LINK_VARS){const x=b.find(y=>y.name===k);seen[k]=!x?'unset':x.type!=='plain_text'?'set('+x.type+')':(x.text==='1'?'on':'off')}
  seen.WEBRISK_API_KEY=b.some(y=>y.name==='WEBRISK_API_KEY')?'present':'absent';
  if(seen.LINKS_POST==='on'||String(seen.LINKS_POST).startsWith('set('))errs.push('本番でリンクの投稿（LINKS_POST）が止まっていない');
  if(seen.LINKS_CLICK==='on'||String(seen.LINKS_CLICK).startsWith('set('))errs.push('本番でリンクを押す（LINKS_CLICK）が止まっていない');
  if(seen.WEBRISK_API_KEY==='present')errs.push('本番に Web Risk の鍵がある（本物の確かめが済むまで置かない）');
  return{errs,seen}}
if(import.meta.url===`file://${process.argv[1]}`){
  const a=process.argv.slice(2),cmd=a[0],arg=k=>{const i=a.indexOf('--'+k);return i>0?a[i+1]:''};
  const J=f=>{try{return JSON.parse(fs.readFileSync(f,'utf8'))}catch(e){fail('JSON が読めない: '+f)}};
  try{
    if(cmd==='prod')console.log(resolveProd(J(arg('list')),{name:arg('name'),varId:arg('var-id')}));
    else if(cmd==='stgrow'||cmd==='stgnew')console.log(resolveStg(J(arg('list')),{name:arg('name'),prodId:arg('prod-id'),mode:cmd==='stgnew'?'new':'old'}));
    else if(cmd==='prodflags'){const r=checkProdFlags(J(arg('settings')));console.log(JSON.stringify(r.seen));if(r.errs.length)fail(r.errs.join(' / '));console.log('ok: 本番ではリンクの投稿・押すが止まっていて、Web Risk の鍵もない')}
    else if(cmd==='deployed'){const e=checkDeployed(J(arg('settings')),J(arg('schedules')),{name:arg('name'),stgId:arg('stg-id'),prodId:arg('prod-id')});
      if(e.length)fail(e.join(' / '));console.log('ok: DB＝ステージングの D1 だけ・決まった変数と合言葉4つだけ・cron なし')}
    else fail('使い方：prod | stgrow | stgnew | deployed')
  }catch(e){console.error('止めます（何も変えていません）：'+(e.guard?e.message:'予期しないエラー'));process.exit(1)}
}
