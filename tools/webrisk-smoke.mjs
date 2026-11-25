// Web Risk の本物の問い合わせを、手で1回だけ確かめる（docs/secure-link-posting-runbook.md §8）。CI からは動かさない。
// 使うのは、依頼主が承認した、ほかと分けた鍵（Web Risk だけに制限）だけ。本番の Worker の鍵は使わない。
// 送るのは「問題のないはずのページ」と、Google の資料に書かれた試験用のアドレス（--fixture で渡す。資料で確かめてから）だけ。
// 鍵・アドレス・問い合わせの文字は表示しない（答えの形だけを表示する）。自動で Google に報告（submit）はしない。
//   WEBRISK_SMOKE_KEY=… node tools/webrisk-smoke.mjs --i-have-approval [--fixture https://…]
const args=process.argv.slice(2);
if(!args.includes('--i-have-approval')){console.error('本物の Web Risk に問い合わせます（費用がかかることがあります）。承認された鍵で --i-have-approval を付けて動かしてください。');process.exit(2)}
const key=process.env.WEBRISK_SMOKE_KEY||'';if(key.length<20){console.error('WEBRISK_SMOKE_KEY がありません。');process.exit(2)}
const TYPES=['MALWARE','SOCIAL_ENGINEERING','UNWANTED_SOFTWARE','SOCIAL_ENGINEERING_EXTENDED_COVERAGE'];
const urls=['https://www.google.com/'];const fi=args.indexOf('--fixture');if(fi>=0&&args[fi+1])urls.push(args[fi+1]);
const shape=j=>j&&typeof j==='object'?Object.fromEntries(Object.entries(j).map(([k,v])=>[k,v&&typeof v==='object'?Object.keys(v):typeof v])):typeof j;
for(const [i,u] of urls.entries()){
  const qs=TYPES.map(t=>'threatTypes='+t).join('&')+'&uri='+encodeURIComponent(u);
  const r=await fetch('https://webrisk.googleapis.com/v1/uris:search?'+qs,{headers:{'x-goog-api-key':key,accept:'application/json'},redirect:'manual'});
  let j=null;try{j=await r.json()}catch(e){}
  const exp=j&&j.threat&&j.threat.expireTime;
  console.log(JSON.stringify({case:i===0?'benign':'fixture',status:r.status,shape:shape(j),threatTypes:j&&j.threat&&j.threat.threatTypes||null,expireTimeRfc3339:typeof exp==='string'?/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.test(exp):null}));
}
