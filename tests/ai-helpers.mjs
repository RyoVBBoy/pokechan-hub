// Game Kid/s AI（Stage A）のテスト用の道具：試験用の Firebase トークン、AI_DB の移行SQL、環境
import fs from 'node:fs';
import path from 'node:path';
export const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
export const PID='pokechan-ai-test';
export const ORIGIN='https://ai-test.game-kids.example';
const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
export async function makeSigner(){
  const kp=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const other=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const jwk={...(await crypto.subtle.exportKey('jwk',kp.publicKey)),kid:'k1',use:'sig',alg:'RS256'};
  const now=Math.floor(Date.now()/1000);
  const sign=async(uid,o={},key=kp.privateKey)=>{const h=enc({alg:'RS256',kid:'k1',typ:'JWT'}),p=enc({iss:'https://securetoken.google.com/'+PID,aud:PID,sub:uid,iat:now-10,exp:now+3600,auth_time:now-10,email:uid+'@example.com',...o});
    return h+'.'+p+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(h+'.'+p))).toString('base64url')};
  return{jwk,sign,other:other.privateKey,now};
}
/* 移行SQLを文に分ける（トリガーの BEGIN…END の中の ; では切らない。行頭の -- は捨てる） */
export function migrationStatements(){
  const sql=fs.readFileSync(path.join(ROOT,'worker/migrations-ai/0001_ai_init.sql'),'utf8').split('\n').filter(l=>!/^\s*--/.test(l)).join('\n');
  const out=[];let cur='',inTrig=false;
  for(const line of sql.split('\n')){
    cur+=line+'\n';
    if(/CREATE TRIGGER/i.test(line))inTrig=true;
    if(inTrig){if(/\bEND;\s*$/.test(line)){out.push(cur.trim().replace(/;$/,''));cur='';inTrig=false}continue}
    if(/;\s*$/.test(line)){out.push(cur.trim().replace(/;$/,''));cur=''}
  }
  if(cur.trim())out.push(cur.trim());
  return out.map(s=>s.replace(/\s*--[^\n']*$/gm,'')).filter(Boolean);
}
export async function migrate(db){for(const s of migrationStatements())await db.prepare(s).run()}
export const baseEnv=o=>({AI_ENABLED:'1',AI_PROVIDER:'mock',AI_HASH_KEY:'test-only-hash-key-0123456789abcdef',AI_BUDGET_MICRO:'100000000',AI_ALLOWED_ORIGINS:ORIGIN,FIREBASE_PROJECT_ID:PID,...o});
let SEQ=0;export const rid=p=>(p||'req')+'_'+(++SEQ).toString(36)+'_'+Math.random().toString(36).slice(2,8);
