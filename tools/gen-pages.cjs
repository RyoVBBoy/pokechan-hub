const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const SITE_URL=(process.env.SITE_URL||'').replace(/\/$/,'');
if(!SITE_URL){console.error('SITE_URL を指定してください（例：SITE_URL=https://pokechan-hub.pages.dev）');process.exit(1)}

// 検索エンジン向けの静的ページ（ポケモン別・タイプ別・一覧）を dist/ に作る
// 使い方: node tools/build.mjs のあとで node tools/gen-pages.cjs（SITE_URL を環境変数で指定）
const ROOT=path.resolve(__dirname,'..');
const OUT=path.join(ROOT,'dist');
const SRC=path.join(OUT,'index.html');
const SITE='ポケチャン攻略Hub';
const TSLUG={'ノーマル':'normal','ほのお':'fire','みず':'water','でんき':'electric','くさ':'grass','こおり':'ice','かくとう':'fighting','どく':'poison','じめん':'ground','ひこう':'flying','エスパー':'psychic','むし':'bug','いわ':'rock','ゴースト':'ghost','ドラゴン':'dragon','あく':'dark','はがね':'steel','フェアリー':'fairy'};
(async()=>{
 const app=fs.readFileSync(SRC,'utf8');
 const css=fs.readFileSync(path.join(ROOT,'src/styles.css'),'utf8');
 fs.mkdirSync(OUT+'/assets',{recursive:true});
 fs.writeFileSync(OUT+'/assets/site.css',css+`
/* 静的ページ用 */
.sp{padding-bottom:110px}.crumb{padding:12px 16px 0;font-size:12.5px;color:var(--dim)}.crumb a{color:var(--acc)}
.sh1{display:flex;align-items:center;gap:14px;padding:12px 16px 6px}.sh1 h1{margin:0;font-size:28px;font-weight:800;letter-spacing:-.02em;line-height:1.25}
.sh1 .no{display:block;font:600 13px Inter,sans-serif;color:var(--dim)}.lead{padding:6px 16px 4px;font-size:15px;line-height:1.8}
.tbl{width:calc(100% - 32px);margin:4px 16px;border-collapse:collapse;font-size:14px}.tbl th,.tbl td{padding:9px 6px;border-bottom:1px solid var(--line);text-align:right}
.tbl th:first-child,.tbl td:first-child{text-align:left}.tbl thead th{font-size:12px;color:var(--dim);font-weight:600}.tbl td b{font:800 15px Inter,sans-serif}
.mvt td{white-space:nowrap}.mvt td:first-child{white-space:normal}.mvt{font-size:13px}.mvt th,.mvt td{padding:8px 4px}
.sp .row{content-visibility:visible}.mvt .chip{margin:0}.cta{display:flex;flex-wrap:wrap;gap:10px;padding:14px 16px}.cta a{flex:1 1 140px}
.pn{display:flex;justify-content:space-between;gap:10px;padding:16px;font-size:14px}.pn a{color:var(--acc)}.srcs{padding:6px 16px;font-size:12px;color:var(--dim);line-height:1.8}
.radarbox.st svg{max-width:280px}.grid2{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:0 12px;padding:0 4px}
`);
 const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const pg=await b.newPage({locale:'ja-JP'});
 await pg.route(/championsbattledata|googleapis|gstatic/,r=>r.abort());
 await pg.goto('file://'+SRC+'#/');await pg.waitForTimeout(400);
 const D=await pg.evaluate((TSLUG)=>{
  const out={mons:[],types:[]};
  const lvRange=(p,i)=>{const b=p.s[i];if(i===0)return[b+75,b+75,b+32+75];return[Math.floor((b+20)*.9),b+20,Math.floor((b+32+20)*1.1)]};
  const rowL=(q,root)=>`<a class="row" href="${root}pokemon/${q.no}/"><span class="av">${stamp(q)}</span><div class="row-m"><div class="row-t">${q.n}<span class="no">#${String(q.dno||q.no).padStart(4,'0')}</span></div><div class="chips">${q.t.map(chip).join('')}</div></div><div class="row-n"><b>${q.bst}</b><span>合計</span></div></a>`;
  const badge=(lab,c)=>`<span class="srcb" style="--c:${c};cursor:default"><i></i>${lab}</span>`;
  P.forEach((p,k)=>{
   const tb=defTable(p.t),weak=tb.filter(x=>x[1]>=2).sort((a,b)=>b[1]-a[1]),res=tb.filter(x=>x[1]<1);
   const w4=weak.filter(x=>x[1]>=4).map(x=>x[0]);
   const abl=(ABD[p.no]||[]).map(([kk,h])=>`<b>${ABN[kk]||kk}</b>${h?'（隠れ特性）':''}${ABDS[kk]?`<br><small>${ABDS[kk]}</small>`:''}`);
   const mvs=(LSD[p.no]?LSD[p.no][1]:[]).filter(id=>MVU[id]&&MD[id]).map(id=>({id,u:MVU[id],d:MD[id]})).sort((x,y)=>x.u[1]-y.u[1]||(y.u[2]||0)-(x.u[2]||0)||x.d[0].localeCompare(y.d[0],'ja'));
   const cs=counters(p.t).filter(q=>q.no!==p.no).slice(0,10);
   const lv=lvOf('stats',p.no);
   const sumRank=1+P.filter(q=>q.bst>p.bst).length;
   const desc=`${p.n}（ポケモンチャンピオンズ）の種族値・弱点・耐性・覚える技・特性・Lv50実数値。${p.t.join('・')}タイプ、合計種族値${p.bst}。弱点は${weak.map(x=>x[0]+(x[1]>=4?'(4倍)':'')).join('・')||'なし'}。`;
   const R='__ROOT__';
   const html=`
<nav class="crumb"><a href="${R}">ホーム</a> › <a href="${R}pokemon/">ポケモン一覧</a> › ${p.n}</nav>
<div class="sh1"><span class="av" style="width:64px;height:64px">${stamp(p)}</span><div><span class="no">#${String(p.dno||p.no).padStart(4,'0')}</span><h1>${p.n}</h1><div class="chips">${p.t.map(t=>`<a href="${R}type/${TSLUG[t]}/">${chip(t)}</a>`).join('')}<span class="rt">${p.roles.join('・')}</span></div></div></div>
<p class="lead">${p.n}は<b>${p.t.join('・')}</b>タイプのポケモンです。合計種族値は<b>${p.bst}</b>で、収録${P.length}匹中${sumRank}位。いちばん高い能力は${SN[p.mi]}（${p.s[p.mi]}）です。弱点は${weak.length?weak.map(x=>`<b>${x[0]}</b>${x[1]>=4?'（4倍）':''}`).join('・'):'ありません'}${w4.length?'。とくに'+w4.join('・')+'の技は4倍のダメージを受けます':''}。</p>
<div class="cta"><a class="btn btn-p" href="${R}#/p/${p.no}">Lv50の実数値を計算</a><a class="btn btn-s" href="${R}#/assist">選出アシストで使う</a></div>
<div class="sec"><h2>種族値</h2><span style="font-size:12px;color:var(--dim)">右は収録${P.length}匹中の順位</span></div>
<div class="radarbox st">${stamp(p,true)}</div>
<table class="tbl"><thead><tr><th>能力</th><th>種族値</th><th>順位</th><th>Lv50 最低</th><th>無振り</th><th>最高</th></tr></thead><tbody>
${p.s.map((v,i)=>{const r=lvRange(p,i);return `<tr><td>${SN[i]}</td><td><b>${v}</b></td><td>${p.rank[i]}位</td><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`}).join('')}
<tr><td>合計</td><td><b>${p.bst}</b></td><td>${sumRank}位</td><td colspan="3"></td></tr></tbody></table>
<p class="note">Lv50・個体値31。最低＝能力ポイント0・性格で下降、無振り＝ポイント0・補正なし、最高＝ポイント32・性格で上昇（HPは性格の影響なし）。</p>
<div class="sec"><h2>弱点と耐性</h2><span style="font-size:12px;color:var(--dim)">受けるダメージの倍率</span></div>
${mxBlocks(p.t)}
<div class="sec"><h2>特性</h2></div>
<div class="advs" style="border-top:1px solid var(--line)">${abl.length?abl.map(x=>`<p><span>${x}</span></p>`).join(''):'<p><span>データなし</span></p>'}</div>
<div class="sec"><h2>覚える技</h2><span style="font-size:12px;color:var(--dim)">全${mvs.length}種類・物理→特殊→変化の順</span></div>
${mvs.length?`<table class="tbl mvt"><thead><tr><th>技</th><th>タイプ</th><th>分類</th><th>威力</th><th>命中</th><th>PP</th></tr></thead><tbody>${mvs.map(({id,u,d})=>`<tr><td><b>${d[0]}</b>${d[1]?`<br><small>${d[1]}</small>`:''}</td><td>${chip(u[0])}</td><td>${['物理','特殊','変化'][u[1]]}</td><td>${u[1]<2?(u[2]||'—'):'—'}</td><td>${u[3]||'—'}</td><td>${u[4]||'—'}</td></tr>`).join('')}</tbody></table><p class="note">効果の説明はデータをもとに当サイトがまとめたものです。</p>`:'<p class="note">データがありません。</p>'}
<div class="sec"><h2>${p.n}の対策になるポケモン</h2></div>
<p class="note" style="padding-top:0">タイプ一致で弱点を突けるポケモン（合計種族値の高い順）。</p>
${cs.map(q=>rowL(q,R)).join('')}
<div class="cta"><a class="btn btn-s" href="${R}#/types">相手のタイプから効く技を調べる</a><a class="btn btn-s" href="${R}#/cmp/${p.no}">ほかのポケモンと比較</a></div>
<div class="srcs">データの確認状況：種族値・タイプ ${badge(LV[lv.lv][0],LV[lv.lv][1])}　技の数値 ${badge(LV[SRC.movedata.lv][0],LV[SRC.movedata.lv][1])}　覚える技・特性 ${badge(LV[SRC.learn.lv][0],LV[SRC.learn.lv][1])}<br><a href="${R}#/sources" style="color:var(--acc)">出典と確認状況の詳細</a></div>
<div class="pn">${k>0?`<a href="${R}pokemon/${P[k-1].no}/">← ${P[k-1].n}</a>`:'<span></span>'}${k<P.length-1?`<a href="${R}pokemon/${P[k+1].no}/">${P[k+1].n} →</a>`:''}</div>`;
   out.mons.push({no:p.no,n:p.n,t:p.t,desc,html});
  });
  T.forEach(t=>{
   const atk=T.filter(d=>mult(t,[d])>=2),atkR=T.filter(d=>mult(t,[d])>0&&mult(t,[d])<1),atk0=T.filter(d=>mult(t,[d])===0);
   const dw=T.filter(a=>mult(a,[t])>=2),dr=T.filter(a=>mult(a,[t])>0&&mult(a,[t])<1),d0=T.filter(a=>mult(a,[t])===0);
   const ms=P.filter(p=>p.t.includes(t)).sort((a,b)=>b.bst-a.bst);const R='__ROOT__';
   const line=(l,arr)=>`<div class="mx"><h3>${l}</h3><div class="chips" style="margin:0">${arr.length?arr.map(x=>`<a href="${R}type/${TSLUG[x]}/">${chip(x)}</a>`).join(''):'<span class="mx2">なし</span>'}</div></div>`;
   const html=`<nav class="crumb"><a href="${R}">ホーム</a> › <a href="${R}type/">タイプ一覧</a> › ${t}</nav>
<div class="sh1"><span style="width:64px;height:64px;border-radius:50%;display:grid;place-items:center;background:${COL[t]};color:${ONC[t]}">${ticon(t,36)}</span><div><span class="no">タイプ相性</span><h1>${t}タイプの弱点・耐性</h1></div></div>
<p class="lead"><b>${t}</b>タイプのポケモンは、${dw.length?dw.map(x=>`<b>${x}</b>`).join('・')+'の技が弱点':'弱点がありません'}です。${t}の技は、${atk.length?atk.join('・')+'タイプにばつぐん':'どのタイプにもばつぐんを取れません'}です。</p>
<div class="cta"><a class="btn btn-p" href="${R}#/types">2タイプの組み合わせも調べる</a></div>
<div class="sec"><h2>${t}タイプが受けるとき</h2></div>${line('弱点（2倍）',dw)}${line('いまひとつ（半減）',dr)}${line('効果なし（無効）',d0)}
<div class="sec"><h2>${t}の技で攻めるとき</h2></div>${line('ばつぐん（2倍）',atk)}${line('いまひとつ（半減）',atkR)}${line('効果なし',atk0)}
<p class="note">2つのタイプを持つポケモンは、倍率をかけ算します（2倍×2倍＝4倍、2倍×半減＝等倍）。</p>
<div class="sec"><h2>${t}タイプのポケモン</h2><span style="font-size:12px;color:var(--dim)">${ms.length}匹・合計種族値順</span></div>
${ms.map(q=>`<a class="row" href="${R}pokemon/${q.no}/"><span class="av">${stamp(q)}</span><div class="row-m"><div class="row-t">${q.n}</div><div class="chips">${q.t.map(chip).join('')}</div></div><div class="row-n"><b>${q.bst}</b><span>合計</span></div></a>`).join('')}`;
   out.types.push({t,slug:TSLUG[t],html,desc:`ポケモンチャンピオンズの${t}タイプの弱点・耐性・相性表と、${t}タイプのポケモン${ms.length}匹の一覧。`});
  });
  out.pokeIndex=P.map(q=>`<a class="row" href="__ROOT__pokemon/${q.no}/"><span class="av">${stamp(q)}</span><div class="row-m"><div class="row-t">${q.n}<span class="no">#${String(q.dno||q.no).padStart(4,'0')}</span></div><div class="chips">${q.t.map(chip).join('')}</div></div><div class="row-n"><b>${q.bst}</b><span>合計</span></div></a>`).join('');
  out.typeIndex=`<div class="tkb tkb--6" style="padding-top:12px">${T.map(t=>`<a class="tk" href="__ROOT__type/${TSLUG[t]}/" style="background:${COL[t]};color:${ONC[t]}">${ticon(t,22)}<small>${t}</small></a>`).join('')}</div>`;
  return out;
 },TSLUG);
 await b.close();
 const esc=s=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
 const NAV=[['','ホーム','<path d="M3 10.9 12 3.7l9 7.2V20a1 1 0 0 1-1 1h-5.1v-6.1H9.1V21H4a1 1 0 0 1-1-1z"/>'],['#/dex','図鑑','<path d="M4 5.3c3.6-.8 6.3-.3 8 1.4 1.7-1.7 4.4-2.2 8-1.4v13.1c-3.6-.8-6.3-.3-8 1.4-1.7-1.7-4.4-2.2-8-1.4z"/><path d="M12 6.7v13.1"/>'],['#/types','相性','<path d="M13.3 2.5 4.9 13.6h5.9l-1.1 7.9 8.4-11.1h-5.9z"/>'],['#/team','編成','<path d="M4.2 4.4h6.2v6.2H4.2zM13.6 4.4h6.2v6.2h-6.2zM4.2 13.4h6.2v6.2H4.2zM13.6 13.4h6.2v6.2h-6.2z"/>'],['#/guide','ルール','<path d="M5 7h14M5 12h14M5 17h9"/>']];
 const page=({rel,title,desc,body,crumbs})=>{
  const depth=rel.split('/').filter(Boolean).length,root=depth?'../'.repeat(depth):'./';
  const url=SITE_URL+'/'+rel;
  const ld=[{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":crumbs.map((c,i)=>({"@type":"ListItem","position":i+1,"name":c[0],"item":SITE_URL+'/'+c[1]}))}];
  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${url}">
<meta name="theme-color" content="#000000"><meta property="og:type" content="article"><meta property="og:site_name" content="${SITE}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}"><meta name="twitter:card" content="summary">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${root}assets/site.css">
<script type="application/ld+json">${JSON.stringify(ld)}</script></head>
<body><div class="app sp"><header class="hdr"><div class="hdr-in"><a href="${root}" style="display:flex;align-items:center;gap:20px;min-width:0"><span class="mark" aria-hidden="true">PC</span><b style="font-size:20px;font-weight:800;white-space:nowrap">${SITE}</b></a></div></header>
<main>${body.replace(/__ROOT__/g,root)}</main>
<footer class="foot"><a href="${root}#/sources" style="color:var(--acc)">データの出典と確認状況</a><br>非公式のファンサイトです。ポケモンおよび関連する名称は各権利者の商標です。画像は使用していません。</footer></div>
<nav class="tabbar"><div class="tabbar-in">${NAV.map(([h,l,ic])=>`<a class="tb" href="${root}${h}" aria-label="${l}" title="${l}"><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ic}</svg><span>${l}</span></a>`).join('')}</div></nav>
</body></html>`;};
 const write=(rel,html)=>{const f=path.join(OUT,rel,'index.html');fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,html)};
 const urls=[''];
 D.mons.forEach(m=>{const rel=`pokemon/${m.no}/`;urls.push(rel);write(rel,page({rel,title:`${m.n}の種族値・弱点・対策・覚える技｜ポケモンチャンピオンズ｜${SITE}`,desc:m.desc,body:m.html,crumbs:[['ホーム',''],['ポケモン一覧','pokemon/'],[m.n,rel]]}))});
 D.types.forEach(t=>{const rel=`type/${t.slug}/`;urls.push(rel);write(rel,page({rel,title:`${t.t}タイプの弱点・耐性・相性｜ポケモンチャンピオンズ｜${SITE}`,desc:t.desc,body:t.html,crumbs:[['ホーム',''],['タイプ一覧','type/'],[t.t,rel]]}))});
 write('pokemon/',page({rel:'pokemon/',title:`ポケモン一覧（${D.mons.length}匹）｜ポケモンチャンピオンズ｜${SITE}`,desc:`ポケモンチャンピオンズに登場するポケモン${D.mons.length}匹の一覧。種族値・タイプ・弱点のページへ。`,body:`<nav class="crumb"><a href="__ROOT__">ホーム</a> › ポケモン一覧</nav><div class="sh1"><h1>ポケモン一覧</h1></div><p class="lead">${D.mons.length}匹を図鑑番号順に並べています。名前をタップすると、種族値・弱点・覚える技のページに移ります。</p>`+D.pokeIndex,crumbs:[['ホーム',''],['ポケモン一覧','pokemon/']]}));urls.push('pokemon/');
 write('type/',page({rel:'type/',title:`タイプ相性一覧（18タイプ）｜ポケモンチャンピオンズ｜${SITE}`,desc:'ポケモンチャンピオンズの18タイプそれぞれの弱点・耐性・ばつぐんになる相手の一覧。',body:`<nav class="crumb"><a href="__ROOT__">ホーム</a> › タイプ一覧</nav><div class="sh1"><h1>タイプ相性一覧</h1></div><p class="lead">タイプを選ぶと、そのタイプの弱点・耐性と、そのタイプのポケモンが見られます。</p>`+D.typeIndex+`<div class="cta"><a class="btn btn-p" href="__ROOT__#/types">相性の早見表を開く</a></div>`,crumbs:[['ホーム',''],['タイプ一覧','type/']]}));urls.push('type/');
 // app index with SEO head + links to static pages
 let idx=app.replace('<meta name="theme-color" content="#000000">',`<meta name="theme-color" content="#000000">\n<link rel="canonical" href="${SITE_URL}/">\n<meta property="og:url" content="${SITE_URL}/">\n<meta name="twitter:card" content="summary">\n<script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"WebSite","name":SITE,"url":SITE_URL+'/',"inLanguage":"ja"})}</script>`);
 idx=idx.replace('<main id="view"></main>',`<main id="view"></main>\n  <nav class="seo-links" aria-label="ページ一覧" style="padding:8px 16px 0;font-size:12.5px;color:var(--dim)"><a href="pokemon/" style="color:var(--acc)">ポケモン一覧（${D.mons.length}匹）</a>　<a href="type/" style="color:var(--acc)">タイプ相性一覧</a></nav>`);
 fs.writeFileSync(OUT+'/index.html',idx);
 fs.writeFileSync(OUT+'/404.html',page({rel:'404/',title:`ページが見つかりません｜${SITE}`,desc:'',body:`<div class="sh1"><h1>ページが見つかりません</h1></div><div class="cta"><a class="btn btn-p" href="${SITE_URL}/">ホームへ</a></div>`,crumbs:[['ホーム','']]}).replace(/href="\.\.\/assets/,`href="${SITE_URL}/assets`));
 fs.writeFileSync(OUT+'/.nojekyll','');
 const wk=path.join(ROOT,'worker/dist/worker.js');if(fs.existsSync(wk)){fs.mkdirSync(OUT+'/tools',{recursive:true});fs.copyFileSync(wk,OUT+'/tools/tap-worker.js')}
 fs.writeFileSync(OUT+'/robots.txt',`User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
 const today=new Date().toISOString().slice(0,10);
 fs.writeFileSync(OUT+'/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u=>`<url><loc>${SITE_URL}/${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
 console.log('pages',urls.length,'mons',D.mons.length,'types',D.types.length);
})();
