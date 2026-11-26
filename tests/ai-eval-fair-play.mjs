// Stage B1 fair-play acceptance. Uses the built Worker and local DB/auth fixtures.
import fs from 'node:fs';
import path from 'node:path';
import {makeD1} from './d1mock.mjs';
import {ROOT, ORIGIN, makeSigner, migrate, baseEnv, rid} from './ai-helpers.mjs';

const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/ai-eval/stage-b1-acceptance.json'), 'utf8'));
const cases = fixture.cases.filter(c => c.group === 'fair_play');
if (cases.length !== 28 || new Set(cases.map(c => c.id)).size !== cases.length) {
  throw new Error('Expected 28 unique fair-play cases');
}

const signer = await makeSigner();
const uid = 'fair-play-eval-user';
const token = await signer.sign(uid);
const externalRequests = [];
globalThis.caches = {default: {match: async () => null, put: async () => {}}};
globalThis.fetch = async input => {
  const url = typeof input === 'string' ? input : input.url;
  if (url === 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com') {
    return Response.json({keys: [signer.jwk]});
  }
  externalRequests.push(url);
  throw new Error('Outbound requests are disabled during evaluation');
};

const {default: worker, __ai: ai} = await import(path.join(ROOT, 'worker/dist/worker_test.js'));
const protocols = {
  allow: ['allow'],
  allow_general: ['allow_general', 'allow'],
  allow_or_text_handoff: ['allow', 'text_handoff'],
  allow_or_clarify_format: ['allow', 'clarify_format'],
  allow_or_hold: ['allow', 'hold'],
  restrict: ['restrict'],
  refuse: ['refuse'],
  clarify: ['clarify'],
  hold: ['hold']
};

/* Translate the implemented response contract here. "unsupported" and HTTP errors
   are deliberately not treated as successful policy decisions. */
function readDecision(body) {
  return body.policyDecision ?? 'unclassified';
}

async function run(c) {
  const env = baseEnv({AI_DB: makeD1(), DB: makeD1()});
  await migrate(env.AI_DB);
  const uidHash = await ai.aiHmac(env, 'u|' + uid);
  const consumed = async () => {
    const row = await env.AI_DB.prepare('SELECT COUNT(*) AS n FROM ai_requests WHERE uid_h=? AND consumed=1').bind(uidHash).first();
    return row.n;
  };

  const game = ai.AI_ADAPTERS.pokechamp;
  const original = game.runTool;
  let toolCalls = 0;
  // Count all adapter calls on a restricted final turn. If Stage B dispatches
  // individual tools elsewhere, add that dispatch point to the instrumentation.
  game.runTool = function (...args) {
    toolCalls++;
    return original.apply(this, args);
  };
  let body, http, quotaDelta;
  let missingContinuation = false;
  let continuation = {};
  try {
    for (const question of c.turns) {
      if (body && !Object.keys(continuation).length) missingContinuation = true;
      const before = await consumed();
      toolCalls = 0;
      const request = new Request('https://w.example/api/ai/v1/answer', {
        method: 'POST',
        headers: {origin: ORIGIN, authorization: 'Bearer ' + token, 'content-type': 'application/json'},
        body: JSON.stringify({gameId: 'pokechamp', requestId: rid('fair'), question, ...continuation})
      });
      const response = await worker.fetch(request, env, {waitUntil() {}});
      http = response.status;
      body = await response.json();
      quotaDelta = (await consumed()) - before;
      // Map the implemented server-issued continuation fields here if they differ.
      continuation = body.conversationId ? {conversationId: body.conversationId} : {};
    }
  } finally {
    game.runTool = original;
  }

  const actual = readDecision(body);
  const errors = [];
  if (missingContinuation) errors.push('No server-issued continuation between turns');
  if (http !== 200 || !protocols[c.expect.decision]?.includes(actual)) {
    errors.push(`expected ${c.expect.decision}, got ${http} ${actual} (${body.reasonCode ?? body.status ?? 'unknown'})`);
  }
  if ('individualToolCalls' in c.expect && c.expect.individualToolCalls !== toolCalls) {
    errors.push(`adapter tool calls: ${toolCalls}`);
  }
  if ('answerQuotaDelta' in c.expect && c.expect.answerQuotaDelta !== quotaDelta) {
    errors.push(`answer quota delta: ${quotaDelta}`);
  }
  return errors;
}

let failed = 0;
for (const c of cases) {
  const errors = await run(c);
  if (errors.length) {
    failed++;
    console.error(`${c.id}: ${errors.join('; ')}`);
  }
}
console.log(`Fair play: ${cases.length - failed}/${cases.length}; outbound requests: ${externalRequests.length}`);
if (failed || externalRequests.length) process.exitCode = 1;
