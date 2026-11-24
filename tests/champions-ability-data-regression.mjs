// Real Game Kid/s species base stats + actual bcalc source.
// Controlled 80-power neutral physical attack; not a verified Champions battle log.
// Run: node tests/champions-ability-data-regression.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(path.join(root,p),'utf8');
const src=read('src/js/15-battle.js'),data=read('src/js/02-data.js');
const start=src.indexOf('function bcalc('),end=src.indexOf('/* ---- 連続技を1発ずつ',start);
assert.ok(start>=0&&end>start);
const pR=x=>{const f=Math.floor(x);return x-f>.5?f+1:f};
const deps={hitType:(_a,m)=>m.t,ABSORB:{},mult:()=>1,mkey:m=>m.id,
 disgLoss:()=>1,fixedDmg:()=>null,stgV:(v,k)=>k>=0?Math.floor(v*(2+k)/2):Math.floor(v*2/(2-k)),
 B:{weather:null},varPow:(_a,m)=>m.pow,chM:(c,m)=>(c*m+2048)>>12,
 apM:(v,m)=>pR(v*m/4096),SKIN:{},ITEMT:{},mfl:()=>false,PINCH:{},
 pR,RES_BERRY:{},rnd:()=>0,sfOn:()=>false};
const bcalc=new Function(...Object.keys(deps),src.slice(start,end)+';return bcalc;')(...Object.values(deps));
const mon=(no,ab='',stage=0,status='')=>{
 const line=data.split('\n').find(x=>x.startsWith(no+','));
 assert.ok(line,'missing Pokémon '+no);
 const row=line.split(','),base=row.slice(3,9).map(Number);
 assert.equal(base.length,6);
 return{ab,item:null,p:{no,n:row[1],t:['ノーマル']},
  st:[base[0]+75,...base.slice(1,5).map(v=>v+20)],
  stg:{atk:stage,def:stage,spa:stage,spd:stage,spe:0},
  hp:base[0]+75,max:base[0]+75,status};
};
const move={id:'controlled80',t:'ノーマル',cls:0,pow:80,e:{}};
const damage=(a,d)=>bcalc(a,move,d,{r:100}).dmg;
const attacker=mon(445,'',2),skeledirge=mon(911);
const unawareOff=damage(attacker,skeledirge);
skeledirge.ab='unaware';
const unawareOn=damage(attacker,skeledirge);
assert.equal(unawareOff,135);
assert.equal(unawareOn,69);
assert.equal(Math.ceil(skeledirge.max/unawareOff),2);
assert.equal(Math.ceil(skeledirge.max/unawareOn),3);
const milotic=mon(350,'marvel-scale');
const marvelOff=damage(mon(445),milotic);
milotic.status='brn';
const marvelOn=damage(mon(445),milotic);
assert.equal(marvelOff,82);
assert.equal(marvelOn,55);
assert.equal(Math.ceil(milotic.max/marvelOff),3);
assert.equal(Math.ceil(milotic.max/marvelOn),4);
// Mold Breaker ignores defender's Unaware and Marvel Scale.
const breaker=mon(445,'mold-breaker',2);
assert.equal(damage(breaker,skeledirge),unawareOff);
const noBoost=mon(445,'mold-breaker');
assert.equal(damage(noBoost,milotic),marvelOff);
// Foul Play uses the defender's own Attack stat. 2026-11-24 correction: when that defender has Unaware, its Attack rank is ignored
// (Pokémon Showdown ModifyBoost / @smogon/calc 0.12.0 gen 9: Garchomp Foul Play vs Skeledirge +3 Atk = 128 with Unaware, 318 without, 128 at +0).
// The earlier assertion here expected the opposite. This is Gen 9 reference agreement, not Champions device verification.
const foul={...move,id:'foulplay',e:{fp:true}};
const target=mon(911,'unaware');target.stg.atk=3;
const attackerFoul=mon(445);
const fpUnaware=bcalc(attackerFoul,foul,target,{r:100}).dmg;
target.ab='';
const fpBoosted=bcalc(attackerFoul,foul,target,{r:100}).dmg;
target.stg.atk=0;
const fpZero=bcalc(attackerFoul,foul,target,{r:100}).dmg;
assert.equal(fpUnaware,fpZero,'defender Unaware ignores its own Attack rank used by Foul Play');
assert.ok(fpBoosted>fpZero,'without Unaware the +3 rank is used');
// Attacker Unaware does not erase the target's Attack rank used by Foul Play.
target.stg.atk=3;const unawareAtk=mon(445,'unaware');
assert.equal(bcalc(unawareAtk,foul,target,{r:100}).dmg,bcalc(mon(445),foul,target,{r:100}).dmg,'attacker Unaware keeps Foul Play target rank');
target.stg.atk=0;
// Defensive Unaware must also ignore a negative offensive rank, not just boosts.
const debuffed=mon(445,'',-3);
const targetUnaware=mon(911,'unaware');
assert.ok(damage(debuffed,targetUnaware)>damage(debuffed,mon(911)),
 'Unaware ignores offensive debuffs too');
// Sacred Sword / Darkest Lariat ignore the target's Defense rank (both directions); a normal move does not.
const wall=mon(911);wall.stg.def=2;
const ss={...move,id:'sacredsword'},plain=mon(911);
assert.equal(bcalc(mon(445),ss,wall,{r:100}).dmg,bcalc(mon(445),ss,plain,{r:100}).dmg,'Sacred Sword ignores +2 Defense');
const soft=mon(911);soft.stg.def=-2;
assert.equal(bcalc(mon(445),{...move,id:'darkestlariat'},soft,{r:100}).dmg,bcalc(mon(445),{...move,id:'darkestlariat'},plain,{r:100}).dmg,'Darkest Lariat ignores -2 Defense');
assert.ok(damage(mon(445),wall)<damage(mon(445),plain),'ordinary move uses +2 Defense');
// Body Press uses the attacker's own Defense rank; defender Unaware erases it.
const bpA=mon(445);bpA.stg.def=2;const bpMv={...move,id:776};bpMv.id=776;
const bpU=mon(911,'unaware');
assert.equal(bcalc(bpA,{...move,id:776},bpU,{r:100}).dmg,bcalc(mon(445),{...move,id:776},mon(911),{r:100}).dmg,'Body Press +2 Def ignored by defender Unaware');
assert.ok(bcalc(bpA,{...move,id:776},mon(911),{r:100}).dmg>bcalc(mon(445),{...move,id:776},mon(911),{r:100}).dmg,'Body Press uses own +2 Def');
console.log('PASS: repository species stats and bcalc: Unaware, Marvel Scale, Mold Breaker Foul Play and KO-count changes');
