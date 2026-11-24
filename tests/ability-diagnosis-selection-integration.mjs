// Source integration: Pokémon species stats -> bcalc -> dgMove/dgBest/dgMatch0 -> dgSelect.
// Controlled neutral moves and simplified support dependencies; NOT a Champions device log.
// Run: node tests/ability-diagnosis-selection-integration.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(path.join(root,p),'utf8');
const bs=read('src/js/15-battle.js'),ds=read('src/js/60-diag.js'),
      ss=read('src/js/61-select.js'),raw=read('src/js/02-data.js'),du=read('src/js/56-duel.js');
const pR=x=>{const f=Math.floor(x);return x-f>.5?f+1:f};
const __B={weather:null};/* 2026-11-24: shared weather state for the new wxEffK/effPri helpers */
const deps={hitType:(_a,m)=>m.t,ABSORB:{},mult:()=>1,mkey:m=>m.id,
 disgLoss:()=>1,fixedDmg:()=>null,
 stgV:(v,k)=>k>=0?Math.floor(v*(2+k)/2):Math.floor(v*2/(2-k)),
 B:__B,varPow:(_a,m)=>m.pow,chM:(c,m)=>(c*m+2048)>>12,
 apM:(v,m)=>pR(v*m/4096),SKIN:{},ITEMT:{},mfl:()=>false,PINCH:{},
 pR,RES_BERRY:{},rnd:()=>0,sfOn:()=>false,MB_REP:new Set(['meteorbeam','electroshot']),wxEffK:(a,d)=>(__B.weather&&__B.weather.k&&!['cloud-nine','air-lock'].includes(a&&a.ab)&&!['cloud-nine','air-lock'].includes(d&&d.ab))?__B.weather.k:null,effPri:(a,mv)=>(mv&&mv.pri)||0};
const bStart=bs.indexOf('function bcalc('),bEnd=bs.indexOf('/* ---- 連続技を1発ずつ',bStart);
assert.ok(bStart>=0&&bEnd>bStart);
const bcalc=new Function(...Object.keys(deps),bs.slice(bStart,bEnd)+';return bcalc;')(...Object.values(deps));
const dStart=ds.indexOf('const dgMvName='),dEnd=ds.indexOf('/* ===================== 診断の準備',dStart);
assert.ok(dStart>=0&&dEnd>dStart);
const dgStubs=`
const DG_TR=false,DG_ROLLS=[85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100];
const DG_K={ko_fast:{r:5,t:'fast'},tank:{r:4,t:'tank'},switch:{r:4,t:'switch'},
 wall:{r:3,t:'wall'},shaky:{r:2,t:'shaky'},cond:{r:2,t:'cond'},lose:{r:1,t:'lose'}};
const SKIN={},ABN={},LIVE={csv:{}},MVKA={};
const B={weather:null};
const disgLoss=d=>Math.max(1,Math.floor(d.max/8)),hitType=(_a,m)=>m.t,accOf=()=>100;
const effSpd=a=>a.spd||100,fixedDmg=()=>null,mkey=m=>m.id,duel=()=>({});
const nrm=x=>x,mName=x=>x,mbSeq=()=>null,effPri=(a,mv)=>(mv&&mv.pri)||0,useSeq=()=>null,hitCountDist=()=>[[1,1]],nextUse=(a,mv,d)=>({a,d,changed:false}),bhits=(a,mv,d,o)=>{const x=bcalc(a,mv,d,o||{});return{hits:[{dmg:x.dmg}],total:x.dmg,eff:x.eff,n:1}},hitDist=()=>[];/* 2026-11-24: neutral single-hit stand-ins for the shared multi-hit helpers *//* 中立の技だけ：メテオビームの使うごとのダメージは使わない */
`+(()=>{const a=bs.indexOf('const MFIRST='),b=bs.indexOf('const MCOND=',a);if(a<0||b<a)throw new Error('moveUsable source not found');return bs.slice(a,b)})();/* 2026/11/24：dgBest が moveUsable（失敗する技を除く）を通すので、本物の定義を取り出して使う */
const duStart=du.indexOf('const DU_SURV_AB='),duEnd=du.indexOf('/* 先制技でいちばん強いもの',duStart);
assert.ok(duStart>=0&&duEnd>duStart);
const dgMatch0=new Function('bcalc',dgStubs+du.slice(duStart,duEnd)+ds.slice(dStart,dEnd)+'return dgMatch0;')(bcalc);
const sStart=ss.indexOf('function dgSelect(entries){'),sEnd=ss.indexOf('/* 1つの選出の説明',sStart);
assert.ok(sStart>=0&&sEnd>sStart);
const selStubs=`
const DG_SELC=new Map(),SEL_LV={4:1,3:.7,2:.25,1:0};
const PICK=()=>2,dgDataSig=()=> 'ability-integration-fixture';
const formInfo=p=>({base:p.n}),teamWx=()=>null,isStone=()=>false;
const combos=(arr,k)=>k===0?[[]]:arr.flatMap((x,i)=>combos(arr.slice(i+1),k-1).map(z=>[x,...z]));
const MD={},FMT='single',dgTeam=()=>globalT;`;
const select=T=>new Function('globalT',selStubs+ss.slice(sStart,sEnd)+'return dgSelect;')(T);
const mon=(no,ab='',stage=0,status='',speed=100)=>{
 const line=raw.split('\n').find(x=>x.startsWith(no+','));
 assert.ok(line,'missing species '+no);
 const row=line.split(','),base=row.slice(3,9).map(Number);
 return{ab,item:null,p:{no,n:row[1],t:['ノーマル']},
  st:[base[0]+75,...base.slice(1,5).map(v=>v+20)],
  stg:{atk:stage,def:stage,spa:stage,spd:stage,spe:0},
  hp:base[0]+75,max:base[0]+75,status,spd:speed,moves:[]};
};
const move=pow=>({id:'controlled-physical',n:'controlled physical',t:'ノーマル',
 cls:0,pow,acc:100,pri:0,e:{}});
function build(ab){
 const A=mon(445,'',2,'',150),B=mon(143,'',0,'',100),
       C=mon(350,'',0,'',50),O=mon(911,ab,0,'',100);
 A.moves=[move(40)];B.moves=[move(60)];C.moves=[move(20)];O.moves=[move(100)];
 const ms=[A,B,C];
 const rows=Array.from({length:4},(_,j)=>{
  const res=ms.map((x,i)=>({i,...dgMatch0(x,O)}));
  return{q:{no:911+j,n:'Opponent'+j},res,lvl:res.some(x=>x.r>=4)?3:1,
   stable:res.filter(x=>x.r>=4)};
 });
 const T={ms,M:ms.map(x=>({p:x.p})),rows,tr:{on:false},unk:[]};
 return{match:rows[0].res,selection:select(T)(ms.map((x,i)=>({no:x.p.no,axis:i===2})))};
}
const off=build(''),on=build('unaware');
assert.equal(off.match[0].k,'ko_fast','before: Garchomp favorable');
assert.equal(off.match[0].r,5);
assert.equal(off.match[0].swIn,'win');
assert.equal(on.match[0].k,'lose','after: Garchomp unfavorable');
assert.equal(on.match[0].r,1);
assert.equal(on.match[0].swIn,'survive');
assert.deepEqual(off.selection.best.c,[0,2],'before: Garchomp + Milotic');
assert.deepEqual(on.selection.best.c,[1,2],'after: Snorlax + Milotic');
console.log('PASS: bcalc -> real dgMatch0 -> real dgSelect; Unaware changes rating, switch-in and first selection');
