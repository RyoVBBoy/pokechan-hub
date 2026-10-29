// ダメージ計算の照合：対戦で広く使われている計算機（@smogon/calc）と、ランダムな組み合わせで乱数16段階を比べる
import {chromium} from 'playwright';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {calculate,Pokemon,Move,Field,Generations,Side}=require('@smogon/calc');
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const N=+(process.env.CALC_N||1500);
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const pg=await (await b.newContext({locale:'ja-JP'})).newPage();await pg.route(/^https?:/,r=>r.abort());
await pg.goto('file://'+path.join(ROOT,'dist/index.html'));await pg.waitForTimeout(500);
const cases=await pg.evaluate(N=>{
  const R=n=>Math.floor(Math.random()*n),pick=a=>a[R(a.length)];
  const AAB=[null,null,null,'huge-power','hustle','technician','pixilate','refrigerate','adaptability','tinted-lens','water-bubble','mold-breaker','tough-claws','iron-fist','strong-jaw','mega-launcher','sharpness','sand-force','solar-power','fairy-aura','scrappy','aerilate','galvanize'];
  const DAB=[null,null,null,'thick-fat','heatproof','water-bubble','fur-coat','multiscale','solid-rock','filter'];
  const AIT=[null,null,'choiceband','choicespecs','lifeorb','expertbelt','muscleband','wiseglasses','charcoal','mysticwater','fairyfeather','silkscarf','magnet','softsand'];
  const SKIP=new Set(['bodypress','facade','weatherball','knockoff','storedpower','powertrip','acrobatics','solarbeam','solarblade','meteorbeam','electroshot','freezedry','flyingpress','hex','venoshock','infernalparade','barbbarrage','shellsidearm','snaptrap','dragonclaw','frostbreath','stormthrow','flowertrick','terrainpulse']);
  const out=[];let g=0;
  while(out.length<N&&g++<N*30){
    const pa=pick(P),pd=pick(P),ls=LSD[pa.no];if(!ls)continue;
    const ids=ls[1].filter(id=>MV[id]&&MV[id][2]>0&&MV[id][4]<2&&!(MV[id][8]>1)&&!SKIP.has(mkey({id}))&&fixedDmg({hp:1},{id},{hp:1})==null&&varPow({p:{no:0},stg:{},hp:1,max:1,item:1},mvObj(id),{p:{no:0},hp:1,max:1},{})===MV[id][2]);
    if(!ids.length)continue;const mv=mvObj(pick(ids));if(mv.e&&(mv.e.fp||mv.e.ps))continue;
    const sp=()=>{const s=[0,0,0,0,0,0];let left=66;for(let k=0;k<6&&left>0;k++){const v=Math.min(32,R(left+1));s[R(6)]=Math.min(32,s[R(6)]+v);left-=v}return s};
    const nat=()=>{const n=pick(NATS);return[n[1],n[2]]};const [au,ad]=nat(),[du,dd]=nat();const st=Math.random()<.4;
    const a=mkMon(pa,'me',{ab:pick(AAB),item:pick(AIT),moves:[mv],sp:sp(),up:au,dn:ad});
    const d=mkMon(pd,'op',{ab:pick(DAB),item:pick([null,null,'assaultvest']),moves:[mv],sp:sp(),up:du,dn:dd});
    const sg=()=>st?R(13)-6:0;a.stg={atk:sg(),def:0,spa:sg(),spd:0,spe:0};d.stg={atk:0,def:sg(),spa:0,spd:sg(),spe:0};
    if(Math.random()<.1)a.status='brn';
    const o={crit:Math.random()<.2,spread:Math.random()<.15,screen:Math.random()<.15};
    const wk=pick([null,null,null,'sun','rain','sand','snow']);const sw=B.weather;B.weather=wk?{k:wk,t:5}:null;
    let rolls,eff;try{rolls=[];for(let k=85;k<=100;k++)rolls.push(bcalc(a,mv,d,{...o,r:k}).dmg);eff=bcalc(a,mv,d,o).eff}finally{B.weather=sw}
    if(!eff)continue;
    out.push({a:{t:a.p.t,st:a.st,ab:a.ab,item:a.item,stg:a.stg,brn:a.status==='brn'},d:{t:d.p.t,st:d.st,ab:d.ab,item:d.item,stg:d.stg},mv:{t:mv.t,pow:mv.pow,cls:mv.cls,id:mv.id},fl:(MDK[mv.id]||'|').split('|')[1],o,w:wk,rolls});
  }
  return out;
},N);
await b.close();
const gen=Generations.get(9);
const oc=Pokemon.prototype.clone;Pokemon.prototype.clone=function(){const c=oc.call(this);c.types=[...this.types];c.rawStats={...this.rawStats};c.stats={...this.stats};c.originalCurHP=this.originalCurHP;return c};
const TY={ノーマル:'Normal',ほのお:'Fire',みず:'Water',でんき:'Electric',くさ:'Grass',こおり:'Ice',かくとう:'Fighting',どく:'Poison',じめん:'Ground',ひこう:'Flying',エスパー:'Psychic',むし:'Bug',いわ:'Rock',ゴースト:'Ghost',ドラゴン:'Dragon',あく:'Dark',はがね:'Steel',フェアリー:'Fairy'};
const IT={choiceband:'Choice Band',choicespecs:'Choice Specs',lifeorb:'Life Orb',expertbelt:'Expert Belt',muscleband:'Muscle Band',wiseglasses:'Wise Glasses',charcoal:'Charcoal',mysticwater:'Mystic Water',fairyfeather:'Fairy Feather',silkscarf:'Silk Scarf',magnet:'Magnet',softsand:'Soft Sand',assaultvest:'Assault Vest'};
const AB=a=>a?a.split('-').map(w=>w[0].toUpperCase()+w.slice(1)).join(' '):'Synchronize';
const W={sun:'Sun',rain:'Rain',sand:'Sand',snow:'Snow'};
const FL={c:'contact',p:'punch',b:'bite',l:'pulse',s:'slicing',o:'sound',w:'wind',x:'bullet',d:'dance'};
const mk=(x,isA)=>{const p=new Pokemon(gen,'Mew',{level:50,ability:AB(x.ab),item:x.item?IT[x.item]:undefined,status:isA&&x.brn?'brn':'',boosts:isA?{atk:x.stg.atk,spa:x.stg.spa}:{def:x.stg.def,spd:x.stg.spd}});
  p.types=x.t.map(t=>TY[t]);const s={hp:x.st[0],atk:x.st[1],def:x.st[2],spa:x.st[3],spd:x.st[4],spe:x.st[5]};p.rawStats={...s};p.stats={...s};p.originalCurHP=x.st[0];return p};
let ok=0;const bad=[];
for(const c of cases){
  const flags={};[...c.fl].forEach(ch=>{if(FL[ch])flags[FL[ch]]=1});
  const mv=new Move(gen,c.mv.cls?'Swift':'Stone Edge',{isCrit:c.o.crit,overrides:{basePower:c.mv.pow,type:TY[c.mv.t],category:c.mv.cls?'Special':'Physical',target:c.o.spread?'allAdjacentFoes':'normal',flags}});
  const f=new Field({gameType:c.o.spread?'Doubles':'Singles',weather:c.w?W[c.w]:undefined,defenderSide:new Side({isReflect:c.o.screen&&!c.mv.cls,isLightScreen:c.o.screen&&!!c.mv.cls})});
  let r=calculate(gen,mk(c.a,1),mk(c.d,0),mv,f).damage;r=Array.isArray(r)?r:[r];
  if(JSON.stringify(r)===JSON.stringify(c.rolls))ok++;else bad.push({c,ref:r});
}
const rate=ok/cases.length;
console.log(`calc: ${ok}/${cases.length} 一致（${(rate*100).toFixed(2)}%）`);
if(bad.length)console.log('違い（参考）',JSON.stringify(bad.slice(0,2).map(x=>({ab:x.c.a.ab,mv:x.c.mv.id,ours:x.c.rolls.slice(0,3),ref:x.ref.slice(0,3)}))));
if(cases.length<N*.8||rate<.999){console.error('NG ダメージ計算が照合先と合いません',JSON.stringify(bad.slice(0,3)));process.exitCode=1}
