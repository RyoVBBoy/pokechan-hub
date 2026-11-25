// Firebase のブロッキング関数（beforeUserCreated / beforeUserSignedIn）。Identity Platform への切りかえが要る（費用あり・依頼主の承認が要る）。
// まだ置いていない。置くときは docs/secure-link-posting-runbook.md §6 の手順で。外すときは関数を消せばよい（サイトの門はそのまま効く）。
const {beforeUserCreated,beforeUserSignedIn,HttpsError}=require('firebase-functions/v2/identity');
const {defineSecret,defineString}=require('firebase-functions/params');
const {decide}=require('./decide');
const HOOK_TOKEN=defineSecret('FB_HOOK_TOKEN');
const API=defineString('FB_CHECK_API');
const ON_ERROR=defineString('FB_HOOK_ON_ERROR',{default:'deny'});
async function check(q){
  const r=await fetch(API.value()+'/api/fb/check',{method:'POST',headers:{'content-type':'application/json','x-fb-hook-token':HOOK_TOKEN.value()},body:JSON.stringify(q)});
  if(!r.ok)throw new Error('check '+r.status);
  return r.json();
}
async function gate(event){
  const d=await decide({user:event.data,check,onError:ON_ERROR.value()});
  if(d.block)throw new HttpsError('permission-denied',d.message);
}
exports.beforecreated=beforeUserCreated({secrets:[HOOK_TOKEN]},gate);
exports.beforesignedin=beforeUserSignedIn({secrets:[HOOK_TOKEN]},gate);
