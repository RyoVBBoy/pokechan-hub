const fs=require('fs'),R='/home/user/pokechan-hub/src/js/';
const J=(f,n)=>JSON.parse(fs.readFileSync(R+f,'utf8').match(new RegExp('const '+n+'=(\\{.*?\\});','s'))[1]);
const MD=J('18-import.js','MD'),MVE=J('18-import.js','MVE');const M=require('./merge.cjs');
const SK={atk:'atk',def:'def',spa:'spa',spd:'spd',spe:'spe',accuracy:'acc',evasion:'eva'};
const ST={par:'par',brn:'brn',psn:'psn',tox:'tox',slp:'slp',frz:'frz'};
const norm=e=>JSON.stringify(e);
const out=[];
for(const [id,d] of Object.entries(MD)){const r=M[d[3]];if(!r)continue;const e=MVE[id]||{};
 const ref={};const secs=r.secondaries||(r.secondary?[r.secondary]:[]);
 for(const s of secs){if(!s)continue;const c=s.chance||100;
   if(s.status)ref.a=[s.status,c];if(s.volatileStatus==='flinch')ref.f=c;if(s.volatileStatus==='confusion')ref.a=['cnf',c];
   if(s.boosts)for(const [k,v] of Object.entries(s.boosts))(ref.t=ref.t||[]).push([k,v,c]);
   if(s.self&&s.self.boosts)for(const [k,v] of Object.entries(s.self.boosts))(ref.s=ref.s||[]).push([k,v,c]);}
 if(r.self&&r.self.boosts)for(const [k,v] of Object.entries(r.self.boosts))(ref.s=ref.s||[]).push([k,v,100]);
 if(r.selfBoost&&r.selfBoost.boosts)for(const [k,v] of Object.entries(r.selfBoost.boosts))(ref.s=ref.s||[]).push([k,v,100]);
 if(r.boosts){for(const [k,v] of Object.entries(r.boosts))(r.target==='self'||r.target==='adjacentAllyOrSelf'||r.target==='allies'||r.target==='allySide'?(ref.s=ref.s||[]):(ref.t=ref.t||[])).push([k,v,100])}
 if(r.status&&r.category==='Status')ref.a=[r.status,100];if(r.volatileStatus==='confusion'&&r.category==='Status')ref.a=['cnf',100];
 const mine={};if(e.a)mine.a=e.a;if(e.f)mine.f=e.f;if(e.t)mine.t=e.t;if(e.s)mine.s=e.s;
 const srt=x=>x&&[...x].sort((p,q)=>p[0]<q[0]?-1:1);
 const A=norm({a:mine.a,f:mine.f,t:srt(mine.t),s:srt(mine.s)}),B=norm({a:ref.a,f:ref.f,t:srt(ref.t),s:srt(ref.s)});
 if(A!==B)out.push(id+' '+d[3]+' '+d[0]+'\n   ours '+A+'\n   ref  '+B+(r.onHit||r.onTryHit||r.onAfterHit||r.onModifyMove||r.condition?'  [handler]':''));}
console.log(out.length);console.log(out.join('\n'));
