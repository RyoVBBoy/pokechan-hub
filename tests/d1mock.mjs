// テスト用：Cloudflare D1 のまね（Node 標準の SQLite を使う）
import {DatabaseSync} from 'node:sqlite';
export function makeD1(){
  const sq=new DatabaseSync(':memory:');
  const isRead=sql=>/^\s*(SELECT|WITH)\b/i.test(sql)||/\bRETURNING\b/i.test(sql);
  class St{constructor(sql,args=[]){this.sql=sql;this.args=args}
    bind(...a){return new St(this.sql,a.map(x=>typeof x==='boolean'?(x?1:0):x===undefined?null:x))}
    async all(){const st=sq.prepare(this.sql);if(isRead(this.sql))return{results:st.all(...this.args),meta:{}};const r=st.run(...this.args);return{results:[],meta:{changes:Number(r.changes)}}}
    async first(){const st=sq.prepare(this.sql);return (isRead(this.sql)?st.get(...this.args):(st.run(...this.args),undefined))||null}
    runSync(){const st=sq.prepare(this.sql);if(isRead(this.sql)){/* 本物の D1 の batch と同じく、読む文（RETURNING も）の結果を返す */return{results:st.all(...this.args),meta:{changes:0}}}const r=st.run(...this.args);return{meta:{changes:Number(r.changes)}}}
    async run(){return this.runSync()}
  }
  /* 本物の D1 と同じく、batch は1つの取引（どれかが失敗したら全部取り消す）。
     途中で await しない＝同時に動くほかの batch と取引が重ならない */
  return{prepare:sql=>new St(sql),batch:async l=>{const out=[];sq.exec('BEGIN');try{for(const s of l)out.push(s.runSync());sq.exec('COMMIT')}catch(e){sq.exec('ROLLBACK');throw e}return out}};
}
