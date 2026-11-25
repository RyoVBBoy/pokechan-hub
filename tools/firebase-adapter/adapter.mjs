// Firebase 側の利用停止アダプター（docs/secure-link-posting-runbook.md §6）。Worker ではなく、Firebase Admin SDK が使える Node のサーバーで動かす。
// Worker の fb_sync（アカウントごとの「あるべき状態」）に合わせて、確かめた停止の UID を Firebase で止め（disabled）・ログインの印（refresh token）を取り消す。
// 手順（UID ごと）：claim（借りる）→ 今の状態を読む → intent（外を変える前に最初の状態とすることを記録。戻すときは Worker がここで停止がないことを確かめ直す）
//   → Firebase を変える → 読み直して確かめる → ack。失敗は ack(failed) で数え、Worker がだんだん間をあけてやり直させる（10回で止めて管理画面に出す）。
// 戻すのは、この仕組みが止めた・最初は止まっていなかった・いま有効な停止も手動の停止もないときだけ（Worker が決める）。ほかの理由で止まっているアカウントは触らない。
// 取り消しても、すでに出ている ID トークンはすぐには無効にならない（最大1時間）。その間はサイトの門（links.js の sanctionGate）が止める。
// D1 と Firebase は1つの取引にできない：intent と ack のあいだに停止が変わると、一度だけ古い向きに変わることがある（番号が進むので次の回に直す）。
// 本番で動かすのは依頼主の承認のあと。テストは tests/fb-adapter.mjs（にせものの auth）。
/* 送ってよい Worker（決まったアドレスだけ。https・同じ文字列のとき） */
export const API_ALLOW=Object.freeze(['https://pokechan-tap.pokechan.workers.dev']);
const withTimeout=(p,ms,what)=>{let t;return Promise.race([p,new Promise((_,rej)=>{t=setTimeout(()=>rej(Object.assign(new Error('timeout'),{code:'timeout:'+what})),ms)})]).finally(()=>clearTimeout(t))};
export async function runOnce({api,token,auth,projectId,approvedProject,fetchImpl=globalThis.fetch,allow=API_ALLOW,timeoutMs=8000,max=10,log=()=>{}}){
  if(typeof api!=='string'||!allow.includes(api))throw new Error('api-not-allowed');
  if(!/^https:\/\//.test(api)&&!(allow!==API_ALLOW&&/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(api)))throw new Error('api-not-https');
  if(!token||token.length<32)throw new Error('token');
  /* 承認された Firebase のプロジェクトだけ（SDK が読んだプロジェクトと、承認されたプロジェクトが同じ） */
  if(!approvedProject||projectId!==approvedProject)throw new Error('project-not-approved');
  const h={'x-fb-adapter-token':token,'content-type':'application/json'};
  const post=async(p,body)=>{const ac=new AbortController(),t=setTimeout(()=>ac.abort(),timeoutMs);
    try{const r=await fetchImpl(api+p,{method:'POST',headers:h,body:JSON.stringify(body),redirect:'error',signal:ac.signal});
      let j=null;try{j=await r.json()}catch(e){}return{status:r.status,j:j||{}}}finally{clearTimeout(t)}};
  const fb=(p,what)=>withTimeout(p,timeoutMs,what);
  const c=await post('/api/fb/claim',{max});
  if(c.status!==200||!Array.isArray(c.j.items))throw new Error('claim '+c.status);
  const sum={done:0,failed:0,stale:0,noop:0,dead:0};
  for(const it of c.j.items){
    const base={uid:it.uid,lease:it.lease,gen:it.gen};
    const ack=async b=>{for(let i=0;i<3;i++){let x;try{x=await post('/api/fb/ack',{...base,...b})}catch(e){continue}
        if(x.status===200)return x.j;if(x.status===409)return{stale:true};return{bad:x.status}}
      return{lost:true}};
    try{
      if(it.want==='none'||it.want==='hold'){const a=await ack({result:'done',want:it.want});a.stale?sum.stale++:sum.noop++;continue}
      let u;try{u=await fb(auth.getUser(it.uid),'get')}catch(e){if(e&&e.code==='auth/user-not-found'){await ack({result:'done',want:'missing'});sum.noop++;continue}throw e}
      if(it.want==='disabled'){
        const i=await post('/api/fb/intent',{...base,action:'disable',observed_disabled:!!u.disabled});
        if(i.status===409){sum.stale++;continue}
        if(i.status!==200)throw Object.assign(new Error('intent'),{code:'intent:'+i.status});
        if(!u.disabled)await fb(auth.updateUser(it.uid,{disabled:true}),'update');
        await fb(auth.revokeRefreshTokens(it.uid),'revoke');
        const u2=await fb(auth.getUser(it.uid),'verify');
        if(!u2.disabled)throw Object.assign(new Error('verify'),{code:'verify-failed'});
        const a=await ack({result:'done',want:'disabled',observed_disabled:true,revoked:true});
        a.stale?sum.stale++:sum.done++;
      }else if(it.want==='enabled'){
        const i=await post('/api/fb/intent',{...base,action:'enable',observed_disabled:!!u.disabled});
        /* 409＝いま停止がある・手動の停止がある・最初から止まっていた・番号が進んだ：戻さない（番号が進んでいれば次の回にもう一度決める） */
        if(i.status===409){sum.stale++;continue}
        if(i.status!==200)throw Object.assign(new Error('intent'),{code:'intent:'+i.status});
        if(u.disabled)await fb(auth.updateUser(it.uid,{disabled:false}),'update');
        const u2=await fb(auth.getUser(it.uid),'verify');
        if(u2.disabled)throw Object.assign(new Error('verify'),{code:'verify-failed'});
        const a=await ack({result:'done',want:'enabled',observed_disabled:false});
        a.stale?sum.stale++:sum.done++;
      }else{sum.stale++}
    }catch(e){
      sum.failed++;log('failed '+String(it.uid).slice(0,6)+'…');
      const a=await ack({result:'failed',want:it.want==='enabled'?'enabled':'disabled',error:String(e&&e.code||'error').slice(0,60)});
      if(a&&a.dead)sum.dead++}
  }
  return sum;
}
/* 手で動かすとき：node tools/firebase-adapter/adapter.mjs --live
   要るもの：npm ci（このフォルダの package-lock.json の firebase-admin）・サービスアカウント（Firebase Authentication の管理だけ）・
   FB_PROJECT_ID（承認されたプロジェクト）・FB_ADAPTER_API（API_ALLOW のどれか）・FB_ADAPTER_TOKEN。
   10回失敗したもの（dead）があれば終わりの値を 3 にする（見守りの仕組みで知らせる） */
if(import.meta.url===`file://${process.argv[1]}`){
  if(!process.argv.includes('--live')){console.error('本物の Firebase を変えます。依頼主の承認のあと --live を付けて動かしてください。');process.exit(2)}
  const pid=process.env.FB_PROJECT_ID;if(!pid){console.error('FB_PROJECT_ID（承認された Firebase のプロジェクト）を指定してください。');process.exit(2)}
  const {initializeApp,applicationDefault}=await import('firebase-admin/app');const {getAuth}=await import('firebase-admin/auth');
  const app=initializeApp({credential:applicationDefault(),projectId:pid});
  const s=await runOnce({api:process.env.FB_ADAPTER_API,token:process.env.FB_ADAPTER_TOKEN,auth:getAuth(app),projectId:app.options.projectId,approvedProject:pid,log:m=>console.error(m)});
  console.log(JSON.stringify(s));
  if(s.dead)process.exit(3);
}
