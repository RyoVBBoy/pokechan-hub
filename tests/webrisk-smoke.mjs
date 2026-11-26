// tools/webrisk-smoke.mjs（本物の Web Risk の手での確かめ）を、偽の fetch だけで確かめる。外へはつながない
import path from 'node:path';
import fs from 'node:fs';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const S=await import(path.join(ROOT,'tools/webrisk-smoke.mjs'));
let n=0,bad=0;const ok=(c,m,i)=>{n++;if(!c){bad++;console.error('NG',m,JSON.stringify(i))}};
const KEY='smoke-key-0123456789abcdef',NOW=Date.parse('2026-11-26T00:00:00Z');
const FX=()=>({approved:true,verified_from:'https://cloud.google.com/web-risk/docs/lookup-api',cases:[
  {case:'benign',uri:'https://benign.test-gk.net/',expect:'clean'},
  {case:'malware',uri:'https://mal.test-gk.net/x',expect:'unsafe',types:['MALWARE']},
  {case:'extended',uri:'https://ext.test-gk.net/y',expect:'unsafe',types:['SOCIAL_ENGINEERING_EXTENDED_COVERAGE']}]});
const EXP=new Date(NOW+6*36e5).toISOString();
const ANS={'benign.test-gk.net':[200,'{}'],'mal.test-gk.net':[200,JSON.stringify({threat:{threatTypes:['MALWARE'],expireTime:EXP}})],'ext.test-gk.net':[200,JSON.stringify({threat:{threatTypes:['SOCIAL_ENGINEERING_EXTENDED_COVERAGE'],expireTime:EXP}})]};
const mkF=(over={})=>{const log=[];const f=async(u,o)=>{log.push({u,o});const q=new URL(u);const host=new URL(q.searchParams.get('uri')).host;const a=over[host]||ANS[host];
  return new Response(a[1],{status:a[0],headers:{'content-type':a[2]||'application/json; charset=UTF-8'}})};f.log=log;return f};
const run=async(fx,F,max)=>S.runSmoke({key:KEY,fixtures:fx,fetch:F,max,now:()=>NOW});
/* 1. ふつう：3つとも合う・呼ぶのは uris:search の GET だけ・鍵はヘッダーだけ・回数は場合の数 */
{const F=mkF();const r=await run(FX(),F);
  ok(r.ok&&r.calls===3&&r.results.every(x=>x.ok),'決まりどおりの答えなら OK（問題なし・MALWARE・拡張）',r);
  ok(F.log.every(x=>x.u.startsWith(S.EP+'?')&&x.o.method==='GET'&&x.o.headers['x-goog-api-key']===KEY&&!x.u.includes(KEY)&&x.o.redirect==='manual'),'呼ぶのは uris:search の GET だけ・鍵はヘッダーだけ（アドレスに入れない）・転送に付いていかない',F.log.map(x=>x.o.method));
  ok(F.log.every(x=>S.TYPES.every(t=>x.u.includes('threatTypes='+t))),'4つの種類（拡張を含む）を毎回たずねる','');
  ok(r.results[1].expiresInH===6&&r.results[1].types.join()==='MALWARE','期限まで何時間か・種類を出す',r.results[1]);
  const out=JSON.stringify(r);ok(!out.includes(KEY)&&!/test-gk\.net/.test(out),'出すもの（結果）に鍵もアドレスも入らない',out.slice(0,200))}
/* 2. 決まりどおりでない答えは NG（1つでも） */
const bads=[['200 でない（403）',{'mal.test-gk.net':[403,'{}']}],['200 でない（500）',{'benign.test-gk.net':[500,'oops']}],['JSON でない',{'benign.test-gk.net':[200,'not json']}],
  ['content-type が JSON でない',{'benign.test-gk.net':[200,'{}','text/html']}],['threat 以外の項目',{'benign.test-gk.net':[200,'{"x":1}']}],
  ['問題なしのはずが危険',{'benign.test-gk.net':ANS['mal.test-gk.net']}],['危険のはずが問題なし',{'mal.test-gk.net':[200,'{}']}],
  ['種類が違う',{'mal.test-gk.net':[200,JSON.stringify({threat:{threatTypes:['UNWANTED_SOFTWARE'],expireTime:EXP}})]}],
  ['知らない種類',{'mal.test-gk.net':[200,JSON.stringify({threat:{threatTypes:['NOPE'],expireTime:EXP}})]}],
  ['期限がない',{'mal.test-gk.net':[200,JSON.stringify({threat:{threatTypes:['MALWARE']}})]}],['期限が RFC 3339 でない',{'mal.test-gk.net':[200,JSON.stringify({threat:{threatTypes:['MALWARE'],expireTime:'tomorrow'}})]}],
  ['期限が過去',{'mal.test-gk.net':[200,JSON.stringify({threat:{threatTypes:['MALWARE'],expireTime:'2000-01-01T00:00:00Z'}})]}],['threat の形が違う',{'mal.test-gk.net':[200,'{"threat":[]}']}]];
for(const [m,o] of bads){const r=await run(FX(),mkF(o));ok(!r.ok&&r.results.some(x=>!x.ok&&x.why),'NG：'+m,r.results.map(x=>x.why))}
{const F=async()=>{throw new Error('net')};const r=await run(FX(),F);ok(!r.ok&&r.results.every(x=>x.why==='つながらない'),'NG：つながらない',r)}
/* 3. 一覧の決まり：承認・出典・clean と unsafe の両方・回数の上限 */
const thr=async(fx,max)=>{try{await run(fx,mkF(),max);return false}catch(e){return true}};
for(const [m,f] of [['承認されていない',x=>{x.approved=false}],['出典がない',x=>{delete x.verified_from}],['出典が Google の資料ではない',x=>{x.verified_from='https://example.com/x'}],
  ['clean がない',x=>{x.cases=x.cases.filter(c=>c.expect!=='clean')}],['unsafe がない',x=>{x.cases=x.cases.filter(c=>c.expect!=='unsafe')}],['unsafe に種類がない',x=>{delete x.cases[1].types}],
  ['アドレスがない',x=>{x.cases[0].uri='<ここ>'}],['ユーザー名つき',x=>{x.cases[0].uri='https://u:p@a.test-gk.net/'}],['名前が重なる',x=>{x.cases[2].case='malware'}]])
  {const x=FX();f(x);ok(await thr(x),'動かさない：'+m,'')}
ok(await thr(FX(),2),'動かさない：場合の数が回数の上限（--max）より多い','');
{const x=FX();x.cases=Array.from({length:11},(_,i)=>({case:'c'+i,uri:'https://benign.test-gk.net/'+i,expect:i?'clean':'unsafe',types:i?undefined:['MALWARE']}));ok(await thr(x,50),'動かさない：10回より多い（--max を大きくしても）','')}
{let calls=0;const F=async()=>{calls++;return new Response('{}',{status:200,headers:{'content-type':'application/json'}})};try{await S.runSmoke({key:'short',fixtures:FX(),fetch:F})}catch(e){};ok(calls===0,'鍵がなければ1回も呼ばない','')}
/* 4. 見本の一覧はそのままでは動かない・道具は報告（submit）や一覧の更新を呼ばない */
{const ex=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/webrisk-fixtures.example.json'),'utf8'));ok(S.loadFixtures(ex).length>0,'見本の一覧のままでは動かない（承認なし・アドレスが決まっていない）','')}
{const src=fs.readFileSync(path.join(ROOT,'tools/webrisk-smoke.mjs'),'utf8').replace(/\/\/.*$/gm,'');ok(!/submissions|uris:submit|threatLists|computeDiff|hashes:search|method:'POST'/.test(src),'道具の中に報告・一覧の更新・POST がない','');
  ok(/WEBRISK_API_KEY/.test(src)&&/--i-have-approval/.test(src),'本番の鍵の名前が環境にあれば動かない・承認の印が要る','')}
{const {spawnSync}=await import('node:child_process');const T=path.join(ROOT,'tools/webrisk-smoke.mjs');const env={PATH:process.env.PATH,WEBRISK_SMOKE_KEY:KEY};
  const a=spawnSync(process.execPath,[T],{env,encoding:'utf8'}),b=spawnSync(process.execPath,[T,'--i-have-approval','--fixtures',path.join(ROOT,'tools/webrisk-fixtures.example.json')],{env:{...env,WEBRISK_API_KEY:'x'},encoding:'utf8'}),
    c=spawnSync(process.execPath,[T,'--i-have-approval','--fixtures',path.join(ROOT,'tools/webrisk-fixtures.example.json')],{env,encoding:'utf8'});
  ok(a.status===2&&b.status===2&&c.status===2&&!(a.stderr+b.stderr+c.stderr+a.stdout+c.stdout).includes(KEY),'コマンド：承認の印なし・本番の鍵の名前あり・見本の一覧では動かさない（外へつながない・鍵を出さない）',[a.status,b.status,c.status])}
console.log(bad?`webrisk-smoke: NG（${bad}/${n}）`:`webrisk-smoke: OK（${n}項目・偽の fetch だけ）`);if(bad)process.exit(1);
