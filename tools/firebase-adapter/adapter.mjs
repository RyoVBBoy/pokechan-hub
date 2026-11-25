// Firebase 側の利用停止アダプター（docs/secure-link-posting-runbook.md §6）。Worker ではなく、Firebase Admin SDK が使える Node のサーバーで動かす。
// Worker の順番待ち（fb_outbox）を読み、確かめた停止の UID を Firebase で止め（disabled）・ログインの印（refresh token）を取り消す。
// 戻すのは、この仕組みが止めた・前から止まっていなかった・ほかの有効な制限がない（Worker が allowed で返す）ときだけ。ほかの理由で止まっているアカウントは触らない。
// 取り消しても、すでに出ている ID トークンはすぐには無効にならない（最大1時間）。その間はサイトの門（links.js の sanctionGate）が止める。
// 本番で動かすのは依頼主の承認のあと。テストは tests/fb-adapter.mjs（にせものの auth）。
export async function runOnce({api,token,auth,fetchImpl=globalThis.fetch,log=()=>{}}){
  if(!api||!/^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)/.test(api))throw new Error('api');
  if(!token||token.length<32)throw new Error('token');
  const h={'x-fb-adapter-token':token,'content-type':'application/json'};
  const r=await fetchImpl(api+'/api/fb/outbox',{headers:h});
  if(!r.ok)throw new Error('outbox '+r.status);
  const {items=[]}=await r.json();
  const sum={done:0,skipped:0,failed:0};
  const report=async(id,body)=>{const x=await fetchImpl(api+'/api/fb/outbox/'+id,{method:'POST',headers:h,body:JSON.stringify(body)});if(!x.ok)throw new Error('report '+x.status)};
  for(const it of items){
    try{
      let u;try{u=await auth.getUser(it.uid)}catch(e){if(e&&e.code==='auth/user-not-found'){await report(it.id,{result:'skipped'});sum.skipped++;continue}throw e}
      if(it.action==='disable'){
        const prior=!!u.disabled;
        if(!prior)await auth.updateUser(it.uid,{disabled:true});
        await auth.revokeRefreshTokens(it.uid);
        await report(it.id,{result:'done',prior_disabled:prior});sum.done++;
      }else if(it.action==='enable'){
        if(!it.allowed){await report(it.id,{result:'skipped'});sum.skipped++;continue}
        if(u.disabled)await auth.updateUser(it.uid,{disabled:false});
        await report(it.id,{result:'done'});sum.done++;
      }else{await report(it.id,{result:'skipped'});sum.skipped++}
    }catch(e){sum.failed++;log('failed '+it.id);try{await report(it.id,{result:'failed',error:String(e&&e.code||e&&e.message||'error').slice(0,80)})}catch(e2){}}
  }
  return sum;
}
/* 手で動かすとき：node tools/firebase-adapter/adapter.mjs --live（firebase-admin と、サービスアカウント〔Firebase Authentication の管理だけ〕が要る） */
if(import.meta.url===`file://${process.argv[1]}`){
  if(!process.argv.includes('--live')){console.error('本物の Firebase を変えます。依頼主の承認のあと --live を付けて動かしてください。');process.exit(2)}
  const {initializeApp,applicationDefault}=await import('firebase-admin/app');const {getAuth}=await import('firebase-admin/auth');
  initializeApp({credential:applicationDefault()});
  const s=await runOnce({api:process.env.FB_ADAPTER_API,token:process.env.FB_ADAPTER_TOKEN,auth:getAuth()});
  console.log(JSON.stringify(s));
}
