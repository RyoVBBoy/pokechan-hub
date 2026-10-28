// サーバーの動作確認：画像読み取り（Gemini）と集計データをまねた応答で、通知の文章が作られるかを確かめる
import path from 'node:path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
globalThis.caches={default:{match:async()=>null,put:async()=>{}}};
globalThis.fetch=async(url)=>{url=String(url);
  if(url.includes('models?'))return new Response(JSON.stringify({models:[{name:'models/gemini-3.8-flash',supportedGenerationMethods:['generateContent']}]}));
  if(url.includes('generateContent'))return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({opponent:[
   {name:'オニシズクモ',types:['みず','むし'],confidence:.9},{name:'ルカリオ',types:['かくとう','はがね'],confidence:.9},{name:'ソウブレイズ',types:['ほのお','ゴースト'],confidence:.8},
   {name:'ガブリアス',types:['ドラゴン','じめん'],confidence:.9},{name:'ジャローダ',types:['くさ'],confidence:.9},{name:'ピクシー',types:['フェアリー'],confidence:.9}]})}]}}]}));
  return new Response('',{status:404})};
const w=(await import(path.join(ROOT,'worker/dist/worker.js'))).default;
const img=new Uint8Array(4096);img.set([137,80,78,71,13,10,26,10]);
let bad=0;
for(const team of ['130,3,6,547,983,1000','D!130,3,6,547,983,1000']){
  const r=await w.fetch(new Request('https://x.dev/',{method:'POST',headers:{'content-type':'image/png','x-app-token':'t','x-team':team},body:img}),{APP_TOKEN:'t',GEMINI_API_KEY:'k'},{waitUntil(){}});
  const t=await r.text();if(!/選出/.test(t)||!/予想/.test(t)){bad++;console.error('NG',team,t.slice(0,200))}
}
const r2=await w.fetch(new Request('https://x.dev/',{method:'POST',headers:{'x-app-token':'wrong'},body:img}),{APP_TOKEN:'t'},{waitUntil(){}});
if(r2.status!==401){bad++;console.error('NG 合言葉が違うのに通りました',r2.status)}
console.log(bad?'worker: NG':'worker: OK');if(bad)process.exitCode=1;
