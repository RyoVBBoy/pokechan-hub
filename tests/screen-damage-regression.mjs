// Focused integration regression: run the actual bcalc function with neutral fixtures.
// Run: node tests/screen-damage-regression.mjs
// Does not prove Pokémon Champions' device-specific damage rules.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(path.join(root,'src/js/15-battle.js'),'utf8');
const start=source.indexOf('function bcalc('),end=source.indexOf('/* ---- 連続技を1発ずつ',start);
assert.ok(start>=0&&end>start,'bcalc source boundary');
const __B={weather:null};/* 2026-11-24: shared weather state for the new wxEffK/effPri helpers */
const deps={
 hitType:(_a,m)=>m.t, ABSORB:{}, mult:()=>1, mkey:m=>m.id,
 disgLoss:()=>1, fixedDmg:()=>null, stgV:v=>v, B:__B,
 varPow:(_a,m)=>m.pow, chM:(c,m)=>Math.floor((c*m+2048)/4096),
 apM:(v,m)=>Math.floor(v*m/4096+0.5), SKIN:{}, ITEMT:{},
 mfl:()=>false, PINCH:{}, pR:Math.round, RES_BERRY:{}, rnd:()=>0,sfOn:()=>false,MB_REP:new Set(['meteorbeam','electroshot']),wxEffK:(a,d)=>(__B.weather&&__B.weather.k&&!['cloud-nine','air-lock'].includes(a&&a.ab)&&!['cloud-nine','air-lock'].includes(d&&d.ab))?__B.weather.k:null,effPri:(a,mv)=>(mv&&mv.pri)||0
};
const bcalc=new Function(...Object.keys(deps),source.slice(start,end)+';return bcalc;')(...Object.values(deps));
const mon=()=>({ab:'',item:null,p:{t:['ノーマル'],no:1},st:[200,120,100,120,100],stg:{atk:0,def:0,spa:0,spd:0,spe:0},hp:200,max:200,status:''});
const move=(id='tackle',cls=0)=>({id,t:'ノーマル',cls,pow:80,e:{}});
const a=mon(),d=mon(),cases=[];
for(const format of ['single','double'])
 for(const spread of [false,true])
  for(const screen of [false,true])
   for(const crit of [false,true])
    for(const cls of [0,1])
     cases.push({format,spread,screen,crit,cls,dmg:bcalc(a,move('tackle',cls),d,{format,spread,screen,crit,r:100}).dmg});
for(const c of cases){
 const base=cases.find(x=>x.format===c.format&&x.spread===c.spread&&x.cls===c.cls&&!x.screen&&x.crit===c.crit);
 if(c.screen&&c.crit)assert.equal(c.dmg,base.dmg,'critical hits must bypass walls');
 if(c.screen&&!c.crit)assert.ok(c.dmg<=base.dmg,'wall must not increase damage');
}
const damage=(format,spread,screen)=>bcalc(a,move(),d,{format,spread,screen,r:100}).dmg;
assert.deepEqual([damage('single',false,false),damage('single',false,true)],[66,33]);
assert.deepEqual([damage('double',false,false),damage('double',false,true)],[66,44]);
/* 2026-11-24: spread 0.75x applies only to spread-target moves (mv.tg); a single-target move with the spread flag is not reduced */
const spreadMv={...move(),tg:1};
assert.deepEqual([bcalc(a,spreadMv,d,{format:'double',spread:true,screen:false,r:100}).dmg,bcalc(a,spreadMv,d,{format:'double',spread:true,screen:true,r:100}).dmg],[50,33]);
assert.deepEqual([damage('double',true,false),damage('double',true,true)],[66,44],'single-target move ignores spread reduction');
for(const id of ['brickbreak','psychicfangs','ragingbull'])
 assert.equal(bcalc(a,move(id),d,{format:'double',screen:true,r:100}).dmg,bcalc(a,move(id),d,{format:'double',screen:false,r:100}).dmg,id+' bypasses wall');
console.log('PASS: 32 bcalc scenarios, 3 numerical checks, 3 wall-breaking move checks');
