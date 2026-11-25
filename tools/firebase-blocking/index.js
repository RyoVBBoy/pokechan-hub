// Firebase のブロッキング関数（beforeUserCreated / beforeUserSignedIn）。Identity Platform への切りかえが要る（費用あり・依頼主の承認が要る）。
// まだ置いていない。置くときは docs/secure-link-posting-runbook.md §6 の手順で。外すときは関数を消せばよい（サイトの門はそのまま効く）。
// 送り先は firebase-env.json の承認された環境だけ（FB_ENV で名前を選ぶ。はじめは全部 approved:false＝外へ送らず onError の答え）。
// 動いているプロジェクト（GCLOUD_PROJECT）が対応表と違えば送らない。Worker の答えの env が対応表と違えば、届かなかったのと同じ扱い。転送には従わない。メールや UID を記録しない。
const {beforeUserCreated,beforeUserSignedIn,HttpsError}=require('firebase-functions/v2/identity');
const {defineSecret,defineString}=require('firebase-functions/params');
const {decide,envFor}=require('./decide');
const MAP=require('./firebase-env.json');
const HOOK_TOKEN=defineSecret('FB_HOOK_TOKEN');
const ENV_NAME=defineString('FB_ENV',{default:''});
const ON_ERROR=defineString('FB_HOOK_ON_ERROR',{default:'deny'});
async function check(q,signal){
  const e=envFor(MAP,ENV_NAME.value(),process.env.GCLOUD_PROJECT||'');
  const r=await fetch(e.checkUrl,{method:'POST',headers:{'content-type':'application/json','x-fb-hook-token':HOOK_TOKEN.value()},body:JSON.stringify(q),redirect:'error',signal});
  if(!r.ok)throw new Error('check '+r.status);
  const j=await r.json();
  if(!j||j.env!==e.workerEnvId)throw new Error('env-mismatch');
  return{deny:j.deny};
}
async function gate(event){
  const d=await decide({user:event.data,check,onError:ON_ERROR.value()==='allow'?'allow':'deny'});
  if(d.block)throw new HttpsError('permission-denied',d.message);
}
exports.beforecreated=beforeUserCreated({secrets:[HOOK_TOKEN]},gate);
exports.beforesignedin=beforeUserSignedIn({secrets:[HOOK_TOKEN]},gate);
