// Game Kid/s AI（Stage A）の固定評価セット tests/ai-eval/fixed-v1.json を作る（一度だけ作って保存する。テストは作り直さない）。
// 期待値はAIの台帳を使わずに出す：図鑑の事実＝サイトの元データ（src/js の RAWDATA・MEGAP・ABD・LSD・MV）を直接読む、
// 計算＝いまのダメージ計算の画面（dist/index.html の calcResult＝画面と同じ関数）で同じ条件を計算する。
// 使い方: node tools/build.mjs && CHROMIUM=/opt/pw-browsers/chromium node tools/gen-ai-eval.mjs
// 期待値を変えるときは、差分を見て理由を書いてから保存し直す。
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const s=JSON.parse(fs.readFileSync(path.join(ROOT,'src/js/order.json'),'utf8')).map(f=>fs.readFileSync(path.join(ROOT,'src/js',f),'utf8')).join('');
const obj=n=>JSON.parse(s.match(new RegExp('const '+n+'=(\\{.*?\\});\\n','s'))[1]);
const TC=JSON.parse(fs.readFileSync(path.join(ROOT,'worker/src/chart.txt'),'utf8').split('\n')[1].replace(/'/g,'"'));
const RAW=s.match(/const RAWDATA=`(.*?)`/s)[1].trim().split('\n').map(l=>{const a=l.split(',');return{no:+a[0],n:a[1],t:[...a[2]].map(c=>TC[c]),s:a.slice(3,9).map(Number)}});
const MEGAP=s.match(/const MEGAP=`(.*?)`/s)[1].trim().split('\n').map(l=>{const a=l.split(',');return{no:+a[0],n:a[1],t:[...a[2]].map(c=>TC[c]),s:a.slice(3,9).map(Number),stone:a[9],base:+a[10],ab:a[11]}});
const ABD=obj('ABD'),LSD=obj('LSD'),MV=obj('MV'),MD=obj('MD');
const by=Object.fromEntries([...RAW,...MEGAP].map(p=>[p.no,p]));
const E=[];let k=0;const id=p=>p+String(++k).padStart(3,'0');
const T=['ガブリアス','リザードン','カイリュー','ウインディ（ヒスイ）','ライチュウ（アローラ）','メガリザードンX','メガガブリアス','ミミッキュ','ルカリオ','ドドゲザン','アシレーヌ','サーフゴー','オーロンゲ','ケンタロス（パルデア・ブレイズ種）','メガゲンガー'];
for(const n of T){const p=[...RAW,...MEGAP].find(x=>x.n===n);if(!p)continue;E.push({id:id('E'),suite:'evidence',q:`${n}のタイプは？`,expect:{status:'answered',template:'species_types',species:p.no,types:p.t}})}
for(const n of ['ガブリアス','カイリュー','ミミッキュ','サーフゴー','ドドゲザン','メガリザードンY','ペリッパー','ブリジュラス','イダイトウ（メス）','ウォッシュロトム']){const p=[...RAW,...MEGAP].find(x=>x.n===n);if(!p)continue;E.push({id:id('E'),suite:'evidence',q:`${n}の種族値を教えて`,expect:{status:'answered',template:'species_stats',species:p.no,stats:p.s}})}
for(const n of ['ガブリアス','ミミッキュ','カイリュー','サーフゴー','ペリッパー']){const p=RAW.find(x=>x.n===n);if(!p)continue;E.push({id:id('E'),suite:'evidence',q:`${n}の特性は？`,expect:{status:'answered',template:'species_abilities',species:p.no,abilities:ABD[p.no].map(x=>x[0])}})}
const learn=[['ガブリアス','じしん'],['カイリュー','しんそく'],['ミミッキュ','じゃれつく'],['ガブリアス','なみのり'],['ミミッキュ','じしん'],['サーフゴー','しんそく'],['ペリッパー','ぼうふう']];
for(const [a,m] of learn){const p=RAW.find(x=>x.n===a),mid=+Object.keys(MD).find(k=>MD[k][0]===m);if(!p||!mid)continue;E.push({id:id('E'),suite:'evidence',q:`${a}は${m}を覚える？`,expect:{status:'answered',template:'learns_move',species:p.no,move:mid,learns:LSD[p.no][1].includes(mid)}})}
for(const m of ['じしん','しんそく','ムーンフォース','ドラゴンアロー','10まんボルト','アクアジェット']){const mid=Object.keys(MD).find(k=>MD[k][0].normalize('NFKC')===m.normalize('NFKC'));if(!mid||!MV[mid])continue;const v=MV[mid];
  E.push({id:id('E'),suite:'evidence',q:`${MD[mid][0]}の威力と命中は？`,expect:{status:'answered',template:'move_info',move:+mid,type:v[1],power:v[2],accuracy:v[3]||null}})}
for(const m of ['つるぎのまい','まもる']){const mid=Object.keys(MD).find(k=>MD[k][0]===m);if(mid&&!MV[mid])E.push({id:id('E'),suite:'evidence',q:`${m}の威力は？`,expect:{status:'insufficient_evidence',reasonCode:'evidence_missing'}})}
for(const n of ['リザードン','ゲンガー','ガブリアス']){const p=RAW.find(x=>x.n===n);if(!p)continue;E.push({id:id('E'),suite:'evidence',q:`${n}のメガシンカは？`,expect:{status:'partial',template:'species_megas',species:p.no,megas:MEGAP.filter(m=>m.base===p.no).map(m=>m.no).sort((a,b)=>a-b),hold:'ruleset_unverified'}})}
E.push({id:id('E'),suite:'evidence',q:'能力ポイントの上限は？',expect:{status:'answered',template:'sp_rule',total:66,per:32}});
E.push({id:id('E'),suite:'evidence',q:'APの合計はいくつまで？',expect:{status:'answered',template:'sp_rule',total:66,per:32}});
for(const n of ['ウインディ','ライチュウ','ケンタロス','ルガルガン（まひるのすがた）','パンプジン（ちゅうだましゅ）']){const base=n.replace(/（.*$/,'');const fam=RAW.filter(x=>x.n.replace(/（.*$/,'')===base).map(x=>x.no).sort((a,b)=>a-b);
  E.push({id:id('E'),suite:'evidence',q:`${base}のタイプは？`,expect:{status:'needs_input',reasonCode:'form_ambiguous',choices:fam}})}
for(const [en,n] of [['Garchomp','ガブリアス'],['Dragonite','カイリュー'],['Gholdengo','サーフゴー']]){const p=RAW.find(x=>x.n===n);if(p)E.push({id:id('E'),suite:'evidence',q:`${en}のタイプ`,expect:{status:'answered',template:'species_types',species:p.no,types:p.t}})}
E.push({id:id('E'),suite:'evidence',q:'ガブリアスはいまのレギュレーションで使える？',expect:{status:'insufficient_evidence',reasonCode:'ruleset_unverified'}});
E.push({id:id('E'),suite:'evidence',q:'メガゲンガーはランクバトルで禁止？',expect:{status:'insufficient_evidence',reasonCode:'ruleset_unverified'}});

/* 計算：対応するケース（シングル・ダブル）と、対応しないケース */
const ABOK=['pressure','inner-focus','keen-eye','frisk','unnerve','natural-cure','regenerator','shed-skin','synchronize','early-bird','limber','oblivious','own-tempo','insomnia','vital-spirit','cursed-body','pickpocket','big-pecks','tangled-feet','run-away','pickup','illuminate','stench','shield-dust','magma-armor','immunity','sweet-veil','aroma-veil','damp','suction-cups','sticky-hold','rattled','steadfast','anticipation','forewarn','overcoat','weak-armor','cute-charm','poison-point','static','flame-body','effect-spore','rough-skin','gooey','mummy','wandering-spirit','gluttony','cheek-pouch','ripen','harvest','unburden','klutz','quick-feet','surge-surfer'];
const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const pg=await (await b.newContext({locale:'ja-JP'})).newPage();
await pg.goto('file://'+path.join(ROOT,'dist/index.html')+'#/calc');await pg.waitForTimeout(600);
/* 計算の中で名前で特別扱いされる技・特性（AI の計算の対応表の外）。worker/build.py が作る worker/dist/ai_meta.json の special */
const SPECIAL=new Set(JSON.parse(fs.readFileSync(path.join(ROOT,'worker/dist/ai_meta.json'),'utf8')).specialList);
const outside=[];
const okMons=RAW.filter(p=>(ABD[p.no]||[]).some(x=>ABOK.includes(x[0]))&&![681,964].includes(p.no));
const C=[];let seed=7;const rnd=n=>{seed=(seed*1103515245+12345)%2147483648;return seed%n};
const spOpts=[[2,32,0,0,0,32],[32,0,2,0,32,0],[0,0,0,32,2,32],[32,32,2,0,0,0],[4,30,0,0,0,32]],nat=[[1,3],[-1,-1],[3,1],[5,3],[1,5]];
for(const fmt of ['single','double']){let got=0,tries=0;
  while(got<17&&tries<5000){tries++;
    const A=okMons[rnd(okMons.length)],D=okMons[rnd(okMons.length)];if(A.no===D.no)continue;
    const ms=LSD[A.no][1].filter(m=>MV[m]&&MV[m][2]>0&&!(MV[m][8]>1)&&MV[m][6]===0);if(!ms.length)continue;const m=ms[rnd(ms.length)];
    const sa=spOpts[rnd(5)],sd=spOpts[rnd(5)],na=nat[rnd(5)],nd=nat[rnd(5)];
    const abA=ABD[A.no].map(x=>x[0]).find(x=>ABOK.includes(x)),abD=ABD[D.no].map(x=>x[0]).find(x=>ABOK.includes(x));
    const r=await pg.evaluate(([a,d,m,sa,sd,na,nd,abA,abD,fmt])=>{
      FMT=fmt;const X=(no,ab,sp,n)=>({no,src:'common',ab,item:'',sp:[...sp],up:n[0],dn:n[1],moves:[],stg:{atk:0,def:0,spa:0,spd:0,spe:0}});
      CS={a:X(a,abA,sa,na),d:X(d,abD,sd,nd),mv:m,crit:false,spread:false,burn:false,screen:false,weather:'',aHP:100,dHP:100,dSt:'',cond:false,cnt:0,hits:0,protean:true};
      const R=calcResult();if(!R||R.mv.id!==m)return null;
      const t=hitType(R.a,R.mv);return{eff:mult(t,R.d.p.t),rolls:[...R.r],hp:R.d.max,ko:{n:R.ko.n,p:R.ko.p,sure:R.ko.sure},dist:!!R.r.dist,mvk:mkey(R.mv)};
    },[A.no,D.no,m,sa,sd,na,nd,abA,abD,fmt]);
    if(!r||r.eff!==1||r.dist)continue;
    /* 対応表の外の技（溜める・反動で動けない・威力が変わる等）は、未対応のケースとして残す */
    if(SPECIAL.has(r.mvk)){if(outside.length<6&&!outside.some(o=>o.mvk===r.mvk))outside.push({mvk:r.mvk,fmt,q:`${A.n}の${MD[m][0]}で${D.n}へのダメージは？`,calc:{attacker:{id:'sp:'+A.no,sp:sa,nature:{up:na[0],dn:na[1]},ability:abA},defender:{id:'sp:'+D.no,sp:sd,nature:{up:nd[0],dn:nd[1]},ability:abD},move:'mv:'+m}});continue}
    if(C.some(c=>c.mvk===r.mvk&&c.fmt===fmt))continue;
    C.push({fmt,mvk:r.mvk,case:{id:'',suite:'calc',format:fmt,q:`${A.n}の${MD[m][0]}で${D.n}へのダメージは？`,
      calc:{attacker:{id:'sp:'+A.no,sp:sa,nature:{up:na[0],dn:na[1]},ability:abA},defender:{id:'sp:'+D.no,sp:sd,nature:{up:nd[0],dn:nd[1]},ability:abD},move:'mv:'+m},
      expect:{status:'answered',template:'damage_calc',min:Math.min(...r.rolls),max:Math.max(...r.rolls),hp:r.hp,ko:r.ko,rolls:r.rolls,ref:'screen:calcResult'}}});got++}
}
await b.close();
/* 対応しない：連続技・威力が変わる・範囲技・メガ・計算に影響する特性・相性が等倍でない・変化技・覚えない技・能力ポイントの上限超え・性格の誤り・ギルガルド */
const U=[
  ['連続技',{attacker:{id:'sp:445',sp:[2,32,0,0,0,32],nature:{up:1,dn:3},ability:'sand-veil'},defender:{id:'sp:149',sp:[2,0,32,0,32,0],nature:{up:-1,dn:-1},ability:'inner-focus'},move:'mv:350'},['ability_unsupported','move_unsupported','move_not_learnable']],
  ['メガの姿',{attacker:{id:'sp:10034',sp:[2,32,0,0,0,32],nature:{up:1,dn:3},ability:'tough-claws'},defender:{id:'sp:149',sp:[2,0,32,0,32,0],nature:{up:-1,dn:-1},ability:'inner-focus'},move:'mv:89'},['form_unsupported']],
  ['計算に影響する特性',{attacker:{id:'sp:445',sp:[2,32,0,0,0,32],nature:{up:1,dn:3},ability:'rough-skin'},defender:{id:'sp:149',sp:[2,0,32,0,32,0],nature:{up:-1,dn:-1},ability:'multiscale'},move:'mv:89'},['ability_unsupported']],
  ['変化技',{attacker:{id:'sp:445',sp:[2,32,0,0,0,32],nature:{up:1,dn:3},ability:'rough-skin'},defender:{id:'sp:6',sp:[2,0,32,0,32,0],nature:{up:-1,dn:-1},ability:'blaze'},move:'mv:14'},['move_not_attack','ability_unsupported']],
  ['覚えない技',{attacker:{id:'sp:445',sp:[2,32,0,0,0,32],nature:{up:1,dn:3},ability:'rough-skin'},defender:{id:'sp:6',sp:[2,0,32,0,32,0],nature:{up:-1,dn:-1},ability:'blaze'},move:'mv:245'},['move_not_learnable','ability_unsupported']],
  ['能力ポイントの上限超え',{attacker:{id:'sp:445',sp:[32,32,32,0,0,0],nature:{up:1,dn:3},ability:'rough-skin'},defender:{id:'sp:6',sp:[2,0,32,0,32,0],nature:{up:-1,dn:-1},ability:'blaze'},move:'mv:89'},['sp_invalid']],
  ['1つ32超え',{attacker:{id:'sp:445',sp:[2,33,0,0,0,31],nature:{up:1,dn:3},ability:'rough-skin'},defender:{id:'sp:6',sp:[2,0,32,0,32,0],nature:{up:-1,dn:-1},ability:'blaze'},move:'mv:89'},['sp_invalid']],
  ['性格の誤り',{attacker:{id:'sp:445',sp:[2,32,0,0,0,32],nature:{up:1,dn:1},ability:'rough-skin'},defender:{id:'sp:6',sp:[2,0,32,0,32,0],nature:{up:-1,dn:-1},ability:'blaze'},move:'mv:89'},['nature_invalid']],
  ['ギルガルド',{attacker:{id:'sp:681',sp:[2,32,0,0,0,32],nature:{up:1,dn:3},ability:'stance-change'},defender:{id:'sp:6',sp:[2,0,32,0,32,0],nature:{up:-1,dn:-1},ability:'blaze'},move:'mv:89'},['form_unsupported']],
  ['持てない特性',{attacker:{id:'sp:445',sp:[2,32,0,0,0,32],nature:{up:1,dn:3},ability:'pressure'},defender:{id:'sp:6',sp:[2,0,32,0,32,0],nature:{up:-1,dn:-1},ability:'blaze'},move:'mv:89'},['ability_not_learnable']],
  ['図鑑にない',{attacker:{id:'sp:99999',sp:[2,32,0,0,0,32],nature:{up:1,dn:3},ability:'pressure'},defender:{id:'sp:6',sp:[2,0,32,0,32,0],nature:{up:-1,dn:-1},ability:'blaze'},move:'mv:89'},['species_unknown']],
  ['条件の不足',{attacker:{id:'sp:445'},defender:{id:'sp:6'},move:'mv:89'},['need']]
];
U.forEach(([n,c,ok])=>C.push({case:{id:'',suite:'calc',format:'single',q:`${n}のダメージは？`,calc:c,expect:{status:ok[0]==='need'?'needs_input':'unsupported',reasonCodes:ok[0]==='need'?['calc_input_missing']:ok,noNumbers:true}}}));
outside.forEach(o=>C.push({case:{id:'',suite:'calc',format:o.fmt,q:o.q,calc:o.calc,expect:{status:'unsupported',reasonCodes:['move_unsupported'],noNumbers:true,why:'対応表の外の技（'+o.mvk+'）'}}}));
let ci=0;const cases=[...E,...C.map(x=>({...x.case,id:'C'+String(++ci).padStart(3,'0')}))];
const out={version:'fixed-v1',created:new Date().toISOString().slice(0,10),note:'期待値はAIの台帳を使わずに、サイトの元データと、ダメージ計算の画面（calcResult）から作った。テストでは作り直さない。',
  counts:{evidence:E.length,calc:C.length},cases};
fs.mkdirSync(path.join(ROOT,'tests/ai-eval'),{recursive:true});
fs.writeFileSync(path.join(ROOT,'tests/ai-eval/fixed-v1.json'),JSON.stringify(out,null,1)+'\n');
console.log('evidence',E.length,'calc',C.length);
