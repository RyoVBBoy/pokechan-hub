// Boundary matrix using the production damage function: critical hits, stat stages, screens,
// doubles spread and format, Unaware, Marvel Scale. Not Champions device evidence.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(path.join(root,p),'utf8');
const bs=read('src/js/15-battle.js'),cs=read('src/js/21-calc.js');
const pR=x=>{const f=Math.floor(x);return x-f>.5?f+1:f};
const deps={hitType:(_a,m)=>m.t,ABSORB:{},mult:()=>1,mkey:m=>m.id,
 disgLoss:()=>1,fixedDmg:()=>null,stgV:(v,k)=>k>=0?Math.floor(v*(2+k)/2):Math.floor(v*2/(2-k)),
 B:{weather:null},varPow:(_a,m)=>m.pow,chM:(c,m)=>(c*m+2048)>>12,
 apM:(v,m)=>pR(v*m/4096),SKIN:{},ITEMT:{},mfl:()=>false,PINCH:{},
 pR,RES_BERRY:{},rnd:()=>0,sfOn:()=>false,MB_REP:new Set(['meteorbeam','electroshot'])};
const start=bs.indexOf('function bcalc('),end=bs.indexOf('/* ---- 連続技を1発ずつ',start);
assert.ok(start>=0&&end>start);
const bcalc=new Function(...Object.keys(deps),bs.slice(start,end)+';return bcalc;')(...Object.values(deps));
const mon=(ab='',atkStage=0,defStage=0,status='')=>({
 ab,item:null,p:{no:1,t:['ノーマル']},st:[200,140,120,140,120],
 stg:{atk:atkStage,def:defStage,spa:atkStage,spd:defStage,spe:0},
 hp:200,max:200,status
});
const mv={id:'controlled',t:'ノーマル',cls:0,pow:80,e:{}};
const hit=(a,d,o={})=>bcalc(a,mv,d,{r:100,...o}).dmg;
let checks=0;
for(const rank of [-6,-4,-2,-1,0,1,2,4,6]){
 for(const crit of [false,true]){
  const a=mon('',rank),d=mon('unaware');
  assert.equal(hit(a,d,{crit}),hit(mon('',0),d,{crit}),`defensive Unaware rank ${rank} crit ${crit}`);checks++;
  const b=mon('unaware'),target=mon('',0,rank);
  assert.equal(hit(b,target,{crit}),hit(b,mon(''),{crit}),`offensive Unaware rank ${rank} crit ${crit}`);checks++;
 }
}
for(const status of ['', 'brn','psn','par','slp','frz','tox']){
 const d=mon('marvel-scale',0,0,status),base=mon('',0,0,status);
 const a=mon();
 assert.ok(status?hit(a,d)<hit(a,base):hit(a,d)===hit(a,base),`Marvel Scale status ${status}`);checks++;
}
for(const format of ['single','double']){
 for(const spread of [false,true]){
  for(const crit of [false,true]){
   const a=mon(),d=mon();
   const noScreen=hit(a,d,{format,spread,crit});
   const screened=hit(a,d,{format,spread,crit,screen:true});
   assert.ok(crit?screened===noScreen:screened<noScreen,`screen format=${format} spread=${spread} crit=${crit}`);checks++;
   if(!spread){
    const spreadHit=hit(a,d,{format,spread:true,crit});
    assert.ok(spreadHit<=noScreen,`spread reduction format=${format}`);checks++;
   }
  }
 }
}
// A single-target doubles move must use doubles screen strength, not singles strength.
for(const crit of [false,true]){
 const a=mon(),d=mon();
 const singles=hit(a,d,{format:'single',spread:false,screen:true,crit});
 const doubles=hit(a,d,{format:'double',spread:false,screen:true,crit});
 const base=hit(a,d,{format:'single',spread:false,crit});
 if(crit)assert.equal(singles,doubles,'critical hit bypasses screens regardless of format');
 else {
  assert.ok(singles<doubles&&doubles<base,'doubles screen is weaker than singles screen even for single-target moves');
 }
 checks++;
}
const signature=cs.match(/const calcSig=\(\)=>JSON\.stringify\(\[([^\]]+)\]\);/);
assert.ok(signature,'calculator fingerprint definition');
const keys=signature[1].split(',').map(x=>x.trim());
for(const key of ['CS.hits','CS.protean','FMT'])assert.ok(keys.includes(key),`fingerprint must include ${key}`);
console.log(`PASS: ${checks} production bcalc ability/critical/format boundary invariants + calculator fingerprint`);
