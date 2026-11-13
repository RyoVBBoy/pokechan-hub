#!/usr/bin/env node
/* 入れかえ案 MVP のデータを作る（2026/11/13、docs/party-building-mvp-spec.md）。手で動かす道具（定期的には動かさない）。
   入力（先に取得しておく）：
     --official <file>  公式「参加できるポケモン」のページ（https://web-view.app.pokemonchampions.jp/battle/pages/events/rs178713870219xeaaio/ja/pokemon.html）を保存した HTML
     --single <file>    PokéKit https://poke.itlibra.com/opendata/usage-championssingles.json
     --double <file>    PokéKit https://poke.itlibra.com/opendata/usage-champions.json
     --fetched YYYY-MM-DD  取得した日
   出力：src/js/75-mvp-data.js（const MVP_DATA）。形が違えば何も書かずに止まる（中途半端な版を出さない）。
   ここでは出典の値を確かめて小さくするだけ。サイトの番号との対応・覚える技・持ち物の確かめは、サイトの中（76-mvp.js）で行う。 */
const fs=require('fs'),path=require('path');
const arg=k=>{const i=process.argv.indexOf('--'+k);return i>0?process.argv[i+1]:null};
const need=k=>{const v=arg(k);if(!v){console.error('missing --'+k);process.exit(1)}return v};
const fail=m=>{console.error('NG: '+m);process.exit(1)};
const fetched=need('fetched');if(!/^\d{4}-\d{2}-\d{2}$/.test(fetched))fail('--fetched は YYYY-MM-DD');
/* 公式の一覧 */
const html=fs.readFileSync(need('official'),'utf8');
const m=html.match(/const pokemons = (\[[\s\S]*?\]);/);if(!m)fail('公式ページに pokemons の配列がない');
const off=JSON.parse(m[1]);
if(!Array.isArray(off)||off.length<100)fail('公式の一覧の件数がおかしい '+off.length);
off.forEach(x=>{if(!Array.isArray(x)||!/^\d{4}-\d{3}$/.test(x[0])||typeof x[2]!=='string')fail('公式の一覧の形がおかしい '+JSON.stringify(x))});
/* PokéKit */
const pk=(file,fmt,game)=>{
  const d=JSON.parse(fs.readFileSync(file,'utf8'));
  if(d.format!==fmt)fail(`${file}: format が ${fmt} でない（${d.format}）`);
  if(d.gameType!==game)fail(`${file}: gameType が ${game} でない`);
  if(!/reg\.?\s*MC/i.test(d.label||''))fail(`${file}: レギュレーション M-C のデータでない（${d.label}）`);
  if(!/^\d{4}-\d{2}$/.test(d.month||''))fail(`${file}: month がない`);
  if(!(d.battles>0))fail(`${file}: battles がない`);
  if(!Array.isArray(d.pokemon)||!d.pokemon.length||d.pokemon.length>150)fail(`${file}: pokemon の件数がおかしい`);
  const pc=a=>(a||[]).filter(x=>x&&x.id&&typeof x.pct==='number').map(x=>[x.id,x.pct]);
  const rows=d.pokemon.map(p=>{
    if(!p.id||!(p.rank>0))fail(`${file}: 行の形がおかしい`);
    return{rank:p.rank,id:p.id,name:p.name,num:p.num,usage:p.usage,
      ab:pc(p.abilities),it:pc(p.items),mv:pc(p.moves),
      /* 性格：振り方の行の nature と割合（同じ性格は足す） */
      nat:Object.entries((p.spreads||[]).reduce((o,s)=>{if(s&&s.nature)o[s.nature]=Math.round(((o[s.nature]||0)+(s.pct||0))*10)/10;return o},{})).sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:1)),
      /* 振り方の数字（evs）は能力ポイントとして未確認なので持たない（件数だけ残す） */
      evsN:(p.spreads||[]).length,
      teraEmpty:!(p.tera&&p.tera.length)}});
  return{meta:{source:'PokéKit（Smogon / Pokémon Showdown の集計をまとめたもの）',sourceUrl:d.sourceUrl||'',docUrl:'https://poke.itlibra.com/en/opendata',
    fileUrl:`https://poke.itlibra.com/opendata/usage-${fmt}.json`,format:fmt,label:d.label,gameType:game,month:d.month,battles:d.battles,cutoff:d.cutoff,fetched,
    note:'ゲーム内の公式の集計ではない（Pokémon Showdown のランク対戦）。上位150匹だけ。割合は項目ごと（組み合わせの割合は無い）。tera は使わない。evs は能力ポイントとして未確認のため使わない'},rows};
};
const single=pk(need('single'),'championssingles','singles'),double=pk(need('double'),'champions','doubles');
const out={
  version:`M-C/${fetched}/pokekit-${single.meta.month}`,
  legal:{reg:'M-C',period:'2026-09-09 〜 2026-12-02 10:59',announce:'https://news.pokemon-home.com/ja/page/816.html',
    listUrl:'https://web-view.app.pokemonchampions.jp/battle/pages/events/rs178713870219xeaaio/ja/pokemon.html',fetched,
    ids:off.map(x=>x[0]),
    /* 公式の姿の番号とサイトの番号の対応が確かめられない図鑑番号（2026/11/13 の照合、spec 1-2）。ふつうの順位から外す */
    unverifiedDex:{'0666':'ビビヨン：公式は 0666-018、サイトは 0666-000（模様の番号の付け方が違う）','0670':'フラエッテ：公式は 0670-005「フラエッテ」、サイトは えいえんのはな','0925':'イッカネズミ：公式は 0925-001、サイトは 0925-000','0931':'イキリンコ：公式は 0931-000 と 0931-002（名前はどちらも「イキリンコ」）。色との対応が確かめられない'},
    /* 公式ページで「このレギュレーションで新しくメガシンカできる」と書かれたメガ（M-C で使えるメガストーンの全部ではない） */
    newMegas:['メガアブソルZ','メガボーマンダ','メガガブリアスZ','メガルカリオZ','メガグソクムシャ','メガセグレイブ'],
    rules:{oneMegaPerBattle:true,itemClause:'参加させるポケモンのうち2匹以上に同じ持ち物は持たせられない'}},
  sets:{single:{meta:single.meta,rows:single.rows},double:{meta:double.meta,rows:double.rows}}};
const js=`/* 自動で作ったファイル（tools/gen-mvp-data.cjs）。手で直さない。出典と確認の状態は docs/party-building-mvp-spec.md */\nconst MVP_DATA=${JSON.stringify(out)};\n`;
fs.writeFileSync(path.join(__dirname,'..','src/js/75-mvp-data.js'),js);
console.log('OK',out.version,'公式',off.length,'件・シングル',single.rows.length,'行・ダブル',double.rows.length,'行・',Math.round(js.length/1024)+'KB');
