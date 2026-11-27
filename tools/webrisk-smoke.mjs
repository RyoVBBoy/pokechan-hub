// Web Risk の本物の問い合わせを、手で1回だけ確かめる（docs/secure-link-posting-runbook.md §8）。CI からは動かさない（テストは偽の fetch だけ）。
// 使うのは、依頼主が承認した、ほかと分けた鍵（Web Risk だけに制限）だけ。本番の Worker の鍵（WEBRISK_API_KEY）が環境にあれば動かない。
// 送るのは、承認された試験用のアドレスの一覧（--fixtures <JSON>。Google の資料で確かめた出典 verified_from と approved:true が要る）だけ。
// 呼ぶのは uris:search（読むだけ）の GET だけ。報告（submit）・一覧の更新（threatLists 等）は呼ばない。回数は --max（はじめ 一覧の数・最大 10）まで。
// 鍵・アドレス・問い合わせの文字・答えの本文は表示しない（場合の名前・HTTP の状態・形・判定・期限まで何時間か だけ）。
// 答えが決まりどおりでなければ（200 でない・形が違う・判定が期待と違う・期限が RFC 3339 でない／過去）1 で終わる。
//   WEBRISK_SMOKE_KEY=… node tools/webrisk-smoke.mjs --i-have-approval --fixtures tools/webrisk-fixtures.json [--max 4]
import fs from 'node:fs';
export const EP='https://webrisk.googleapis.com/v1/uris:search';
export const TYPES=['MALWARE','SOCIAL_ENGINEERING','UNWANTED_SOFTWARE','SOCIAL_ENGINEERING_EXTENDED_COVERAGE'];
export const HARD_MAX=10;
const RFC3339=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;
/* 試験用のアドレスの一覧を確かめる：承認・出典・場合ごとの期待（clean か unsafe と、含まれるはずの種類） */
export function loadFixtures(j){const errs=[];
  if(!j||typeof j!=='object'||j.approved!==true)errs.push('一覧が承認されていない（approved:true）');
  if(!j||typeof j.verified_from!=='string'||!/^https:\/\/(docs\.cloud\.google\.com|cloud\.google\.com|developers\.google\.com)\//.test(j.verified_from))errs.push('出典（verified_from：Google の資料のアドレス）がない');
  const cs=j&&Array.isArray(j.cases)?j.cases:[];if(!cs.length)errs.push('cases がない');
  const seen=new Set();
  for(const c of cs){const n=c&&c.case;
    if(typeof n!=='string'||!/^[a-z0-9_-]{1,32}$/.test(n)||seen.has(n))errs.push('場合の名前がおかしい・重なる');seen.add(n);
    let u;try{u=new URL(c.uri)}catch(e){errs.push(n+'：uri がアドレスではない');continue}
    if(!/^https?:$/.test(u.protocol)||u.username||u.password)errs.push(n+'：uri は http(s) で、ユーザー名なし');
    if(c.expect!=='clean'&&c.expect!=='unsafe')errs.push(n+'：expect は clean か unsafe');
    if(c.expect==='unsafe'&&(!Array.isArray(c.types)||!c.types.length||!c.types.every(t=>TYPES.includes(t))))errs.push(n+'：unsafe には含まれるはずの種類（types）');
    if(c.expect==='clean'&&c.types&&c.types.length)errs.push(n+'：clean に types はいらない')}
  if(!cs.some(c=>c&&c.expect==='clean'))errs.push('問題のない場合（clean）が1つもない');
  if(!cs.some(c=>c&&c.expect==='unsafe'))errs.push('危険の場合（unsafe）が1つもない');
  return errs}
/* 1つの答えを確かめる（本文は外に出さない） */
export function judge(c,status,ctype,text,now){
  const out={case:c.case,status,ok:false,verdict:null,types:null,expiresInH:null,why:''};
  if(status!==200){out.why='HTTP '+status;return out}
  if(!/^application\/json\b/i.test(String(ctype||'')))out.why='content-type が JSON ではない';
  let j;try{j=JSON.parse(text)}catch(e){out.why='JSON ではない';return out}
  if(!j||typeof j!=='object'||Array.isArray(j)||Object.keys(j).some(k=>k!=='threat')){out.why='形が違う（threat 以外の項目）';return out}
  if(j.threat===undefined){out.verdict='clean'}
  else{const t=j.threat;
    if(!t||typeof t!=='object'||!Array.isArray(t.threatTypes)||!t.threatTypes.length||!t.threatTypes.every(x=>TYPES.includes(x))){out.why='threat の形が違う';return out}
    out.verdict='unsafe';out.types=[...new Set(t.threatTypes)];
    if(typeof t.expireTime!=='string'||!RFC3339.test(t.expireTime)){out.why='expireTime が RFC 3339 ではない';return out}
    const ex=Date.parse(t.expireTime);if(!(ex>now)){out.why='expireTime が過去';return out}
    out.expiresInH=Math.round((ex-now)/36e5*10)/10}
  if(out.why)return out;
  if(out.verdict!==c.expect){out.why='判定が期待と違う（'+c.expect+' のはず）';return out}
  if(c.expect==='unsafe'&&!c.types.every(x=>out.types.includes(x))){out.why='期待した種類が入っていない';return out}
  out.ok=true;return out}
export async function runSmoke({key,fixtures,fetch:F,max,now=()=>Date.now()}){
  if(typeof key!=='string'||key.length<20)throw new Error('鍵がない');
  const errs=loadFixtures(fixtures);if(errs.length)throw new Error('一覧：'+errs.join(' / '));
  const lim=Math.min(HARD_MAX,max>0?max:fixtures.cases.length);
  if(fixtures.cases.length>lim)throw new Error('回数の上限（'+lim+'）より場合が多い');
  const res=[];let calls=0;
  for(const c of fixtures.cases){if(calls>=lim)break;calls++;
    const qs=TYPES.map(t=>'threatTypes='+t).join('&')+'&uri='+encodeURIComponent(c.uri);
    let r;try{r=await F(EP+'?'+qs,{method:'GET',headers:{'x-goog-api-key':key,accept:'application/json'},redirect:'manual'})}
    catch(e){res.push({case:c.case,status:0,ok:false,verdict:null,types:null,expiresInH:null,why:'つながらない'});continue}
    let text='';try{text=await r.text()}catch(e){}
    res.push(judge(c,r.status,r.headers&&r.headers.get?r.headers.get('content-type'):'',text.slice(0,8192),now()))}
  return{calls,results:res,ok:res.length===fixtures.cases.length&&res.every(x=>x.ok)}}
if(import.meta.url===`file://${process.argv[1]}`){
  const a=process.argv.slice(2),arg=k=>{const i=a.indexOf('--'+k);return i>=0?a[i+1]:''};
  if(!a.includes('--i-have-approval')){console.error('本物の Web Risk に問い合わせます（費用がかかることがあります）。承認された鍵と一覧で --i-have-approval を付けて動かしてください。');process.exit(2)}
  if(process.env.WEBRISK_API_KEY){console.error('本番の Worker の鍵の名前（WEBRISK_API_KEY）が環境にあります。ほかと分けた鍵だけを WEBRISK_SMOKE_KEY で渡してください。');process.exit(2)}
  const key=process.env.WEBRISK_SMOKE_KEY||'';if(key.length<20){console.error('WEBRISK_SMOKE_KEY がありません。');process.exit(2)}
  let fx;try{fx=JSON.parse(fs.readFileSync(arg('fixtures'),'utf8'))}catch(e){console.error('--fixtures の一覧が読めません。');process.exit(2)}
  try{const r=await runSmoke({key,fixtures:fx,fetch:globalThis.fetch,max:Number(arg('max'))||0});
    for(const x of r.results)console.log(JSON.stringify(x));
    console.log(r.ok?`webrisk-smoke: OK（${r.calls} 回）`:`webrisk-smoke: NG（${r.calls} 回）`);process.exit(r.ok?0:1)}
  catch(e){console.error('webrisk-smoke: 動かしませんでした：'+e.message);process.exit(2)}
}
