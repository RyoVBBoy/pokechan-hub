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
  const r=await w.fetch(new Request('https://x.dev/',{method:'POST',headers:{'content-type':'image/png','x-app-token':'t','x-team':team},body:img}),{APP_TOKEN:'t',GEMINI_API_KEY:'k',LEGACY_TAP:'1'},{waitUntil(){}});
  const t=await r.text();if(!/選出/.test(t)||!/予想/.test(t)){bad++;console.error('NG',team,t.slice(0,200))}
}
const r2=await w.fetch(new Request('https://x.dev/',{method:'POST',headers:{'x-app-token':'wrong'},body:img}),{APP_TOKEN:'t',LEGACY_TAP:'1'},{waitUntil(){}});
if(r2.status!==401){bad++;console.error('NG 合言葉が違うのに通りました',r2.status)}
/* セキュリティ対策（2026/11/05）：背面タップの受け口は閉じている・見出し・呼び出してよいサイトだけに答える */
const r3=await w.fetch(new Request('https://x.dev/',{method:'POST',headers:{'content-type':'image/png','x-app-token':'t'},body:img}),{APP_TOKEN:'t',GEMINI_API_KEY:'k'},{waitUntil(){}});
if(r3.status!==410){bad++;console.error('NG 背面タップの受け口が開いています',r3.status)}
for(const k of ['x-content-type-options','x-frame-options','content-security-policy','strict-transport-security'])if(!r3.headers.get(k)){bad++;console.error('NG 見出しがありません',k)}
const pre=async o=>(await w.fetch(new Request('https://x.dev/api/tl',{method:'OPTIONS',headers:{origin:o}}),{},{waitUntil(){}})).headers.get('access-control-allow-origin');
if(await pre('https://pokechan-hub.pages.dev')!=='https://pokechan-hub.pages.dev'){bad++;console.error('NG 本番のサイトから呼べません')}
if(await pre('https://abc123.pokechan-hub.pages.dev')!=='https://abc123.pokechan-hub.pages.dev'){bad++;console.error('NG 試し公開から呼べません')}
if(await pre('https://evil.example')){bad++;console.error('NG ほかのサイトから呼べてしまいます')}
if(await pre('https://pokechan-hub.pages.dev.evil.example')){bad++;console.error('NG 似せたアドレスから呼べてしまいます')}
console.log(bad?'worker: NG':'worker: OK');if(bad)process.exitCode=1;
