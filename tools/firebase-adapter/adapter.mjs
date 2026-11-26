// Firebase 側の利用停止アダプター（docs/secure-link-posting-runbook.md §6）。Worker ではなく、Firebase Admin SDK が使える Node のサーバーで動かす。
// Worker の fb_sync（アカウントごとの「あるべき状態」）に合わせて、確かめた停止の UID を Firebase で止め（disabled）・ログインの印（refresh token）を取り消す。
// 手順（1つのアカウントずつ、必要になった直前に借りる）：claim → 今の状態を読む → renew（借りる時間をのばす）→ intent（外を変える前に最初の状態とすることを記録。
//   戻すときは Worker がここで停止がないことを確かめ直す）→ renew → Firebase を変える → 読み直して確かめる → ack。
// 時間切れ：SDK の呼び出しは止められない（あとで終わることがある）。時間切れは「結果が分からない（unknown）」として報告し、この回ではそのアカウントに二度とさわらず、
//   最後に遅れた呼び出しが終わるのを待って（最大 settleMs）読み直し、見た状態だけを observe で残す（終えたことにはしない）。
// Firebase には分散した「比べて書きかえる」仕組みがないので、D1 と Firebase を1つの取引にはできない。残るすきまは runbook §6 に書いた（できないことを約束しない）。
// 環境：tools/firebase-env.json の承認された環境だけ（はじめは全部 approved:false＝動かない）。外を変える前に、SDK のプロジェクト・サービスアカウント・
//   Worker の環境の答え（/api/fb/env）がすべて対応表と同じかを確かめ、違えば何も変えずに止める。
// 本番で動かすのは依頼主の承認のあと。テストは tests/fb-adapter.mjs（にせものの auth）。
import {readFileSync} from 'node:fs';
const withTimeout=(p,ms,what,onLate)=>{let t,done=false;const pp=Promise.resolve(p).finally(()=>{done=true});
  return Promise.race([pp,new Promise((_,rej)=>{t=setTimeout(()=>{if(!done&&onLate)onLate(pp);rej(Object.assign(new Error('timeout'),{code:'timeout:'+what,timeout:true}))},ms)})]).finally(()=>clearTimeout(t))};
const PLACE=/^<.*>$/;
/* 対応表から1つの環境を選ぶ。承認されていない・決まっていない値がある・https でない・本番と同じ値を使う（本番以外）なら投げる */
export function pickEnv(map,name){
  const envs=map&&map.environments;if(!envs||typeof envs!=='object')throw new Error('env-map');
  const e=envs[name];if(!e)throw new Error('env-unknown');
  if(e.approved!==true)throw new Error('env-not-approved');
  for(const k of ['project','worker','workerEnvId','serviceAccount'])if(typeof e[k]!=='string'||!e[k]||PLACE.test(e[k]))throw new Error('env-incomplete:'+k);
  /* http://127.0.0.1 などは、エミュレーターだけのプロジェクト（demo- で始まる）で allowLocal:true のときだけ */
  if(!/^https:\/\/[a-z0-9.-]+$/.test(e.worker)&&!(e.allowLocal===true&&/^demo-[a-z0-9-]+$/.test(e.project)&&/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(e.worker)))throw new Error('env-worker');
  if(name!=='production'&&envs.production)for(const k of ['project','worker','workerEnvId','serviceAccount'])if(e[k]===envs.production[k])throw new Error('env-shares-production:'+k);
  return{name,...e};
}
export async function runOnce({env,token,auth,sdk,fetchImpl=globalThis.fetch,timeoutMs=8000,settleMs=30000,max=10,log=()=>{}}){
  if(!env||typeof env.worker!=='string')throw new Error('env');
  if(!token||token.length<32)throw new Error('token');
  /* SDK が使うプロジェクト・サービスアカウントが、承認された環境と同じか（外を変える前） */
  if(!sdk||sdk.projectId!==env.project)throw new Error('project-mismatch');
  if(sdk.serviceAccount!==env.serviceAccount)throw new Error('service-account-mismatch');
  const api=env.worker,h={'x-fb-adapter-token':token,'content-type':'application/json'};
  const req=async(method,p,body)=>{const ac=new AbortController(),t=setTimeout(()=>ac.abort(),timeoutMs);
    try{const r=await fetchImpl(api+p,{method,headers:h,body:body?JSON.stringify(body):undefined,redirect:'error',signal:ac.signal});
      let j=null;try{j=await r.json()}catch(e){}return{status:r.status,j:j||{}}}finally{clearTimeout(t)}};
  const post=(p,b)=>req('POST',p,b);
  /* つないだ Worker の環境とプロジェクトが同じか（外を変える前） */
  const hs=await req('GET','/api/fb/env');
  if(hs.status!==200||hs.j.env!==env.workerEnvId||hs.j.project!==env.project)throw new Error('worker-env-mismatch');
  const late=[],touched=new Set(),unknownUids=new Set();
  /* 時間切れの呼び出しは、uid ごとに「終わったか」を覚える（終わったものだけ読み直して observe。終わらないものは unknown のまま残す＝管理画面に出る） */
  const pend=new Map();
  /* 変える呼び出し（update）が遅れて本当にどう終わったか（ok/error）も覚え、observe で送る（Worker は成功したときだけ「この仕組みが止めた」にする） */
  const fb=(p,what,uid)=>withTimeout(p,timeoutMs,what,pp=>{unknownUids.add(uid);const e=pend.get(uid)||{n:0,done:0};e.n++;pend.set(uid,e);
    late.push(pp.then(()=>{if(what==='update')e.upd='ok'},()=>{if(what==='update')e.upd='error'}).finally(()=>{e.done++}))});
  const sum={done:0,failed:0,unknown:0,stale:0,noop:0,dead:0,lost:0,observed:0,bad:0,superseded:0};
  /* 時間切れになった uid ごとの、その時の借りた印（observe でこれを送る。Worker は、いま残っている印と同じときだけ片づける） */
  const unkOp=new Map();
  for(let n=0;n<max;n++){
    const c=await post('/api/fb/claim',{skip:[...touched]});
    if(c.status!==200||!Array.isArray(c.j.items))throw new Error('claim '+c.status);
    const it=c.j.items[0];if(!it)break;
    touched.add(it.uid);
    const base={uid:it.uid,lease:it.lease,gen:it.gen};
    const renew=async()=>{const r=await post('/api/fb/renew',base);if(r.status!==200)throw Object.assign(new Error('lease'),{code:r.j&&r.j.superseded?'superseded':'lease-lost',lease:true,superseded:!!(r.j&&r.j.superseded)})};
    const ack=async b=>{for(let i=0;i<3;i++){let x;try{x=await post('/api/fb/ack',{...base,...b})}catch(e){continue}
        if(x.status===200){if(x.j.repeat)sum.lost++;return x.j}if(x.status===409)return{stale:true};return{bad:x.status}}
      return{lostAck:true}};
    /* 報告の答えを数える（200 以外・409 以外は「受け取られなかった」＝bad。終えたことに数えない） */
    const tally=(a,okKey)=>{if(a.stale)sum.stale++;else if(a.bad)sum.bad++;else if(a.lostAck)sum.lost++;else if(a.superseded){sum.superseded++;touched.delete(it.uid)}else sum[okKey]++};
    try{
      if(it.want==='none'||it.want==='hold'||it.want==='review'){tally(await ack({result:'done',want:it.want}),'noop');continue}
      let u;try{u=await fb(auth.getUser(it.uid),'get',it.uid)}catch(e){if(e&&e.code==='auth/user-not-found'){tally(await ack({result:'done',want:'missing'}),'noop');continue}throw e}
      await renew();
      if(it.want==='disabled'){
        const i=await post('/api/fb/intent',{...base,action:'disable',observed_disabled:!!u.disabled});
        if(i.status===409){sum.stale++;continue}
        if(i.status!==200)throw Object.assign(new Error('intent'),{code:'intent:'+i.status});
        await renew();
        if(!u.disabled)await fb(auth.updateUser(it.uid,{disabled:true}),'update',it.uid);
        await renew();
        await fb(auth.revokeRefreshTokens(it.uid),'revoke',it.uid);
        const u2=await fb(auth.getUser(it.uid),'verify',it.uid);
        if(!u2.disabled)throw Object.assign(new Error('verify'),{code:'verify-failed'});
        tally(await ack({result:'done',want:'disabled',observed_disabled:true,revoked:true}),'done');
      }else if(it.want==='enabled'){
        const i=await post('/api/fb/intent',{...base,action:'enable',observed_disabled:!!u.disabled});
        /* 409＝いま停止がある・手動の停止がある・最初から止まっていた・持ち主がはっきりしない・番号が進んだ・借りる時間が切れた：戻さない */
        if(i.status===409){sum.stale++;continue}
        if(i.status!==200)throw Object.assign(new Error('intent'),{code:'intent:'+i.status});
        await renew();
        if(u.disabled)await fb(auth.updateUser(it.uid,{disabled:false}),'update',it.uid);
        const u2=await fb(auth.getUser(it.uid),'verify',it.uid);
        if(u2.disabled)throw Object.assign(new Error('verify'),{code:'verify-failed'});
        tally(await ack({result:'done',want:'enabled',observed_disabled:false}),'done');
      }else{sum.stale++}
    }catch(e){
      /* あるべき状態が途中で変わった：いまの Firebase の状態を読み、失敗ではなく superseded として報告（すぐ次の回で合わせる） */
      /* ここの読み取りは時間切れでも「結果が分からない」にしない（何も変えない読み取りなので、遅れて終わっても外は変わらない） */
      if(e&&e.superseded){let od;try{od=!!(await withTimeout(auth.getUser(it.uid),timeoutMs,'get')).disabled}catch(e2){}
        const a=await ack({result:'superseded',want:it.want==='enabled'?'enabled':'disabled',...(typeof od==='boolean'?{observed_disabled:od}:{})});
        if(a.bad)sum.bad++;else if(a.stale)sum.stale++;else{sum.superseded++;touched.delete(it.uid)}continue}
      const unk=!!(e&&e.timeout);
      unk?sum.unknown++:sum.failed++;if(unk)unkOp.set(it.uid,it.lease);log((unk?'unknown ':'failed ')+String(it.uid).slice(0,6)+'…');
      const a=await ack({result:'failed',unknown:unk,want:it.want==='enabled'?'enabled':'disabled',error:String(e&&e.code||'error').slice(0,60)});
      if(a&&a.dead)sum.dead++}
  }
  /* 遅れて終わるかもしれない SDK の呼び出しを待ち、結果が分からないアカウントを読み直して、見た状態だけを残す（終えたことにはしない） */
  if(late.length){let t;await Promise.race([Promise.allSettled(late),new Promise(r=>{t=setTimeout(r,settleMs)})]);clearTimeout(t)}
  for(const uid of unknownUids){const e=pend.get(uid);if(!e||e.done<e.n)continue;try{const u=await withTimeout(auth.getUser(uid),timeoutMs,'observe');if(!unkOp.has(uid))continue;const o=await post('/api/fb/observe',{uid,op:unkOp.get(uid),observed_disabled:!!u.disabled,settled:e.upd||'none'});if(o.status===200&&!o.j.recorded_only)sum.observed++}catch(e){}}
  return sum;
}
/* 手で動かすとき：node tools/firebase-adapter/adapter.mjs --live --env <名前>
   要るもの：npm ci（このフォルダの package-lock.json）・tools/firebase-env.json でその環境が approved:true（依頼主の承認）・
   FB_ACTIVATE=<環境の名前>:<プロジェクト>（はっきりした「動かしてよい」の合図。対応表と同じでなければ止める）・
   GOOGLE_APPLICATION_CREDENTIALS（その環境のサービスアカウントの鍵。Firebase Authentication の管理だけ）・FB_ADAPTER_TOKEN。
   10回失敗・結果が分からないものがあれば終わりの値を 3 にする（見守りの仕組みで知らせる） */
if(import.meta.url===`file://${process.argv[1]}`){
  const ai=process.argv.indexOf('--env'),name=ai>0?process.argv[ai+1]:'';
  if(!process.argv.includes('--live')||!name){console.error('本物の Firebase を変えます。依頼主の承認のあと --live --env <名前> を付けて動かしてください。');process.exit(2)}
  let env;try{env=pickEnv(JSON.parse(readFileSync(new URL('../firebase-env.json',import.meta.url),'utf8')),name)}catch(e){console.error('環境を使えません：'+e.message);process.exit(2)}
  if(process.env.FB_ACTIVATE!==env.name+':'+env.project){console.error('FB_ACTIVATE が承認された環境と一致しません。');process.exit(2)}
  const cred=JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS||'/nonexistent','utf8'));
  if(cred.project_id!==env.project||cred.client_email!==env.serviceAccount){console.error('サービスアカウントの鍵が承認された環境のものではありません。');process.exit(2)}
  const {initializeApp,cert}=await import('firebase-admin/app');const {getAuth}=await import('firebase-admin/auth');
  const app=initializeApp({credential:cert(cred),projectId:env.project});
  const s=await runOnce({env,token:process.env.FB_ADAPTER_TOKEN,auth:getAuth(app),sdk:{projectId:app.options.projectId,serviceAccount:cred.client_email},log:m=>console.error(m)});
  console.log(JSON.stringify(s));
  if(s.dead||s.unknown||s.bad)process.exit(3);
}
