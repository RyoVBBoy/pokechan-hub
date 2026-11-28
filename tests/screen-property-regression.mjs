// Deterministic property regression for wall handling in the real bcalc body.
// Run: node tests/screen-property-regression.mjs
// Neutral fixtures only; NOT a Smogon/Champions accuracy comparison.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const src=readFileSync(path.join(root,'src/js/15-battle.js'),'utf8');
const start=src.indexOf('const REVIEWED_ALWAYS_CRIT='),end=src.indexOf('/* ---- 連続技を1発ずつ',start);
assert.ok(start>=0&&end>start,'bcalc source boundaries');
const pR=x=>{const f=Math.floor(x);return x-f>.5?f+1:f};
const __B={weather:null};/* 2026-11-24: shared weather state for the new wxEffK/effPri helpers */
const deps={hitType:(_a,m)=>m.t,ABSORB:{},mult:()=>1,mkey:m=>m.id,
 disgLoss:()=>1,fixedDmg:()=>null,stgV:(v,k)=>k>=0?Math.floor(v*(2+k)/2):Math.floor(v*2/(2-k)),
 B:__B,varPow:(_a,m)=>m.pow,chM:(c,m)=>(c*m+2048)>>12,
 apM:(v,m)=>pR(v*m/4096),SKIN:{},ITEMT:{},mfl:()=>false,PINCH:{},
 pR,RES_BERRY:{},rnd:()=>0,sfOn:()=>false,MB_REP:new Set(['meteorbeam','electroshot']),wxEffK:(a,d)=>(__B.weather&&__B.weather.k&&!['cloud-nine','air-lock'].includes(a&&a.ab)&&!['cloud-nine','air-lock'].includes(d&&d.ab))?__B.weather.k:null,effPri:(a,mv)=>(mv&&mv.pri)||0};
const bcalc=new Function(...Object.keys(deps),src.slice(start,end)+';return bcalc;')(...Object.values(deps));
let seed=20261123;
const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const mon=()=>({ab:'',item:null,p:{t:['ノーマル'],no:1},
 st:[200,...Array.from({length:4},()=>Math.floor(40+rand()*250))],
 stg:{atk:Math.floor(rand()*13)-6,def:Math.floor(rand()*13)-6,
 spa:Math.floor(rand()*13)-6,spd:Math.floor(rand()*13)-6,spe:0},
 hp:200,max:200,status:''});
for(let i=0;i<1500;i++){
 const a=mon(),d=mon(),m={id:'tackle',t:'ノーマル',cls:i%2,
 pow:20+Math.floor(rand()*130),e:{}};
 const base={format:i%3===0?'single':'double',spread:i%5===0,r:85+Math.floor(rand()*16)};
 const no=bcalc(a,m,d,{...base,screen:false}).dmg;
 const wall=bcalc(a,m,d,{...base,screen:true}).dmg;
 const crit=bcalc(a,m,d,{...base,screen:false,crit:true}).dmg;
 const critWall=bcalc(a,m,d,{...base,screen:true,crit:true}).dmg;
 assert.ok(wall<=no,`case ${i}: screen increased damage`);
 assert.equal(critWall,crit,`case ${i}: screen affected critical hit`);
}
console.log('PASS: 1500 deterministic wall/critical invariants (neutral fixtures)');
