const fs=require('fs'),R='/home/user/pokechan-hub/src/js/';
const J=(f,n)=>JSON.parse(fs.readFileSync(R+f,'utf8').match(new RegExp('const '+n+'=(\\{.*?\\});\\n','s'))[1]);
const MD=J('18-import.js','MD'),MVU=J('18-import.js','MVU'),MV=J('14-rules-engine.js','MV'),MVE=J('18-import.js','MVE');
const MDK=J('15-battle.js','MDK');
const M=require('./merge.cjs');
const TY={ノーマル:'Normal',ほのお:'Fire',みず:'Water',でんき:'Electric',くさ:'Grass',こおり:'Ice',かくとう:'Fighting',どく:'Poison',じめん:'Ground',ひこう:'Flying',エスパー:'Psychic',むし:'Bug',いわ:'Rock',ゴースト:'Ghost',ドラゴン:'Dragon',あく:'Dark',はがね:'Steel',フェアリー:'Fairy'};
const CAT=['Physical','Special','Status'];
const ppC=p=>{p=Math.min(p,20);return (p/5+1)*4};
const FL={c:'contact',p:'punch',b:'bite',l:'pulse',s:'slicing',o:'sound',w:'wind',x:'bullet',d:'dance'};
const out=[];let cnt={tot:0,phys:0,spec:0,stat:0};
for(const [id,d] of Object.entries(MD)){const k=d[3],r=M[k];cnt.tot++;if(!r){out.push(id+' '+k+' NOREF');continue}
 const u=MVU[id];if(!u){out.push(id+' '+k+' noMVU');continue}
 cnt[['phys','spec','stat'][u[1]]]++;
 const diff=[];
 if(TY[u[0]]!==r.type)diff.push('type '+u[0]+'/'+r.type);
 if(CAT[u[1]]!==r.category)diff.push('cat '+u[1]+'/'+r.category);
 if((u[2]||0)!==(r.basePower||0)&&r.category!=='Status')diff.push('pow '+u[2]+'/'+r.basePower);
 const acc=r.accuracy===true?0:r.accuracy;if((u[3]||0)!==acc)diff.push('acc '+u[3]+'/'+r.accuracy);
 if(u[4]!==(r.noPPBoosts?r.pp:ppC(r.pp)))diff.push('pp '+u[4]+'/'+ppC(r.pp)+'(raw '+r.pp+')');
 if((u[5]||0)!==(r.priority||0))diff.push('pri '+u[5]+'/'+r.priority);
 const myF=new Set([...(MDK[id]||'|').split('|')[1]]),rf=new Set(Object.keys(FL).filter(c=>r.flags&&r.flags[FL[c]]));
 const fd=[...new Set([...myF,...rf])].filter(c=>myF.has(c)!==rf.has(c));if(fd.length)diff.push('flags MDK '+[...myF].join('')+'/ref '+[...rf].join(''));
 const mdF=new Set([...(d[2]||'')]);const fd2=[...new Set([...mdF,...rf])].filter(c=>mdF.has(c)!==rf.has(c));if(fd2.length)diff.push('flags MD '+[...mdF].join('')+'/ref '+[...rf].join(''));
 if(MV[id]){const m=MV[id];if(TY[m[1]]!==r.type)diff.push('MVtype');if(m[2]!==(r.basePower||0))diff.push('MVpow '+m[2]+'/'+r.basePower);const a2=r.accuracy===true?0:r.accuracy;if(m[3]!==a2&&!(m[3]===100&&r.accuracy===true))diff.push('MVacc '+m[3]+'/'+r.accuracy);if(m[5]!==(r.priority||0))diff.push('MVpri');if(CAT[m[4]]!==r.category)diff.push('MVcat')}
 if(diff.length)out.push(id+' '+k+' '+d[0]+' : '+diff.join('; '));
}
console.log(JSON.stringify(cnt));console.log(out.join('\n'));
