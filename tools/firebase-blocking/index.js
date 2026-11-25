// Firebase のブロッキング関数（beforeUserCreated / beforeUserSignedIn）。Identity Platform への切りかえが要る（費用あり・依頼主の承認が要る）。
// まだ置いていない。置くときは docs/secure-link-posting-runbook.md §6 の手順で。外すときは関数を消せばよい（サイトの門はそのまま効く）。
// 送り先は決まったアドレスだけ（設定で変えられない）。転送には従わない。メールや UID を記録（console.log など）しない。
const {beforeUserCreated,beforeUserSignedIn,HttpsError}=require('firebase-functions/v2/identity');
const {defineSecret,defineString}=require('firebase-functions/params');
const {decide}=require('./decide');
const CHECK_URL='https://pokechan-tap.pokechan.workers.dev/api/fb/check';
const HOOK_TOKEN=defineSecret('FB_HOOK_TOKEN');
const ON_ERROR=defineString('FB_HOOK_ON_ERROR',{default:'deny'});
async function check(q,signal){
  const r=await fetch(CHECK_URL,{method:'POST',headers:{'content-type':'application/json','x-fb-hook-token':HOOK_TOKEN.value()},body:JSON.stringify(q),redirect:'error',signal});
  if(!r.ok)throw new Error('check '+r.status);
  return r.json();
}
async function gate(event){
  const d=await decide({user:event.data,check,onError:ON_ERROR.value()==='allow'?'allow':'deny'});
  if(d.block)throw new HttpsError('permission-denied',d.message);
}
exports.beforecreated=beforeUserCreated({secrets:[HOOK_TOKEN]},gate);
exports.beforesignedin=beforeUserSignedIn({secrets:[HOOK_TOKEN]},gate);
exports.CHECK_URL=CHECK_URL;
