// Evidence gate: a green comparison suite is not proof of Pokémon Champions accuracy.
// Usage: node tests/champions-evidence-gate.mjs
// This intentionally fails closed until independently sourced device observations exist.
import {readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const file='tests/fixtures/champions-device-observations.json';
if(!existsSync(file)){
 console.error('UNVERIFIED: missing device observation manifest '+file);
 process.exitCode=1;
}else{
 try{
  const rows=JSON.parse(readFileSync(file,'utf8'));
  assert.ok(Array.isArray(rows)&&rows.length>0,'nonempty observations required');
  const required=['id','gameVersion','format','attacker','defender','move','conditions','observedDamage','source','observedAt','reproduction'];
  const ids=new Set();
  for(const r of rows){
   for(const key of required)assert.ok(r[key]!==undefined&&r[key]!==null&&r[key]!=='',r.id+': missing '+key);
   assert.ok(!ids.has(r.id),'duplicate '+r.id);ids.add(r.id);
   assert.ok(['single','double'].includes(r.format),'invalid format');
   assert.ok(typeof r.observedDamage==='number'&&Number.isInteger(r.observedDamage)&&r.observedDamage>=0,'invalid observed damage');
   assert.ok(typeof r.source==='string'&&/^https:\/\//.test(r.source),'source must be traceable HTTPS evidence');
   assert.ok(typeof r.reproduction==='string'&&r.reproduction.length>=20,'reproduction must specify steps');
   assert.ok(typeof r.conditions==='object'&&!Array.isArray(r.conditions),'conditions must be structured');
  }
  // This validates evidence metadata only. It does NOT compare production damage
  // against observations; the full oracle test must replay each fixture independently.
  console.error('UNVERIFIED: '+rows.length+' observation metadata rows found, but no independent replay, expected-roll comparison, or authenticity review has been performed. Device accuracy gate remains BLOCKED.');
  process.exitCode=1;
 }catch(e){console.error('INVALID EVIDENCE:',e.message);process.exitCode=1;}
}
