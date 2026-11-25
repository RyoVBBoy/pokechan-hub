// ブロッキング関数の判断（純粋な関数。tests/fb-adapter.mjs で確かめる）。Worker の /api/fb/check（FB_HOOK_TOKEN）に、UID と、確認済みのメールだけを送る
// （確認されていないメールは本人の証拠にしないので送らない）。答えは deny だけ。メールはここでも Worker でも保存・記録しない。
// 時間を区切る：check に AbortSignal を渡し、時間が来たら通信も止める（タイマーは必ず片づける）。
// Worker に届かない・時間切れのときは onError（'deny' はじめ／'allow'）。利用者に出す文はどちらも同じで、理由を言わない。
// 続けて届かないとき（breaker）：5回続けて失敗したら、30秒は Worker に聞かずに onError で答える（止まっている Worker を何度も待たせない）
const NEUTRAL='いまはこのアカウントでログインできません。お問い合わせください。';
function makeBreaker({fails=5,coolMs=30e3,now=()=>Date.now()}={}){
  let n=0,until=0;
  return{open:()=>now()<until,ok:()=>{n=0;until=0},fail:()=>{n++;if(n>=fails){until=now()+coolMs;n=0}}};
}
const DEFAULT_BREAKER=makeBreaker();
async function decide({user,check,timeoutMs=2000,onError='deny',breaker=DEFAULT_BREAKER}){
  const vf=!!(user&&user.emailVerified);
  const q={uid:String(user&&user.uid||''),email:vf&&user.email?user.email:null,email_verified:vf};
  const err=why=>onError==='allow'?{block:false,why:why+'-allow'}:{block:true,message:NEUTRAL,why:why+'-deny'};
  if(breaker&&breaker.open())return err('breaker');
  const ac=new AbortController();let t;
  let res;
  try{res=await Promise.race([check(q,ac.signal),new Promise((_,rej)=>{t=setTimeout(()=>{ac.abort();rej(new Error('timeout'))},timeoutMs)})])}
  catch(e){breaker&&breaker.fail();return err('error')}
  finally{clearTimeout(t)}
  if(!res||typeof res.deny!=='boolean'){breaker&&breaker.fail();return err('bad')}
  breaker&&breaker.ok();
  return res.deny?{block:true,message:NEUTRAL,why:'sanctioned'}:{block:false,why:'ok'};
}
module.exports={decide,NEUTRAL,makeBreaker};
