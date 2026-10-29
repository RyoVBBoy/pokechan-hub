// テスト用：Cloudflare D1 のまね（Node 標準の SQLite を使う）
import {DatabaseSync} from 'node:sqlite';
export function makeD1(){
  const sq=new DatabaseSync(':memory:');
  const isRead=sql=>/^\s*(SELECT|WITH)\b/i.test(sql)||/\bRETURNING\b/i.test(sql);
  class St{constructor(sql,args=[]){this.sql=sql;this.args=args}
    bind(...a){return new St(this.sql,a.map(x=>typeof x==='boolean'?(x?1:0):x===undefined?null:x))}
    async all(){const st=sq.prepare(this.sql);if(isRead(this.sql))return{results:st.all(...this.args),meta:{}};const r=st.run(...this.args);return{results:[],meta:{changes:Number(r.changes)}}}
    async first(){const st=sq.prepare(this.sql);return (isRead(this.sql)?st.get(...this.args):(st.run(...this.args),undefined))||null}
    async run(){const st=sq.prepare(this.sql);if(isRead(this.sql)){st.all(...this.args);return{meta:{changes:0}}}const r=st.run(...this.args);return{meta:{changes:Number(r.changes)}}}
  }
  return{prepare:sql=>new St(sql),batch:async l=>{const out=[];for(const s of l)out.push(await s.run());return out}};
}
