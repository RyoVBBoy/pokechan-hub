// ブロッキング関数の判断（純粋な関数。tests/fb-adapter.mjs で確かめる）。Worker の /api/fb/check（FB_HOOK_TOKEN）に、UID・メール・確認済みかだけを送る。
// 答えは deny だけ。メールはここでも Worker でも保存・記録しない。確認されていないメールは本人の証拠にしない（そのメールで止めない）。
// Worker に届かない・時間切れのときは onError（'deny' はじめ／'allow'）。利用者に出す文はどちらも同じで、理由を言わない。
const NEUTRAL='いまはこのアカウントでログインできません。お問い合わせください。';
async function decide({user,check,timeoutMs=2000,onError='deny'}){
  const q={uid:String(user&&user.uid||''),email:user&&user.email||null,email_verified:!!(user&&user.emailVerified)};
  let res;
  try{res=await Promise.race([check(q),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),timeoutMs))])}
  catch(e){return onError==='allow'?{block:false,why:'error-allow'}:{block:true,message:NEUTRAL,why:'error-deny'}}
  if(!res||typeof res.deny!=='boolean')return onError==='allow'?{block:false,why:'bad-allow'}:{block:true,message:NEUTRAL,why:'bad-deny'};
  return res.deny?{block:true,message:NEUTRAL,why:'sanctioned'}:{block:false,why:'ok'};
}
module.exports={decide,NEUTRAL};
