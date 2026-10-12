const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHandler } = require('../api/uniform-tables.js');
const { validateBackup } = require('../adventsource/uniform-table-schema.js');

const origin = 'https://editor.example';
const passphrase = 'test-only-passphrase-not-a-real-secret';
const sha = 'a'.repeat(40);
const commitSha = 'b'.repeat(40);
const fileSha = 'c'.repeat(40);
const key = JSON.stringify(['pathfinder', 'Uniform-Woman.svg', 'shirt']);
const backup = {
  version: 1,
  tables: {
    [key]: { columns: ['Item', 'Size', 'Price'], rows: [['Example', 'M', '$10']] }
  }
};
const env = {
  PUBLISH_ALLOWED_ORIGIN: origin,
  PUBLISH_PASSPHRASE: passphrase,
  GITHUB_TOKEN: 'test-only-github-token'
};

async function invoke({ method = 'POST', headers = {}, body = { backup, expectedSha: sha },
  environment = env, response = { content: { sha: fileSha }, commit: { sha: commitSha } },
  status = 200, fetchError } = {}) {
  const calls = [];
  const handler = createHandler({
    env: environment,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (fetchError) throw fetchError;
      return new Response(JSON.stringify(response), {
        status, headers: { 'Content-Type': 'application/json' }
      });
    }
  });
  const result = { headers: {}, calls };
  const res = {
    setHeader(name, value) { result.headers[name] = value; },
    status(code) { result.status = code; return this; },
    json(value) { result.body = value; return this; },
    end() { return this; }
  };
  await handler({
    method,
    headers: { origin, authorization: `Bearer ${passphrase}`, 'content-type': 'application/json', ...headers },
    body
  }, res);
  return result;
}

test('validates the real published backup without losing table data', () => {
  const data = JSON.parse(fs.readFileSync(
    path.join(__dirname, '../adventsource/uniform-details-backup.json'), 'utf8'
  ));
  assert.deepEqual(validateBackup(data), data.tables);
});

test('supports all column options and independent stacked-table identities', () => {
  for (const count of [3, 4, 5, 6]) {
    for (const [program, uniform, part, maximum] of [
      ['pathfinder', 'Uniform-Woman.svg', 'shirt', 2],
      ['pathfinder', 'Uniform-Man.svg', 'shirt', 2],
      ['pathfinder', 'Uniform-Girl.svg', 'shirt', 4],
      ['pathfinder', 'Uniform-Boy.svg', 'shirt', 2],
      ['adventurer', 'Uniform-Woman.svg', 'shirt', 4],
      ['adventurer', 'Uniform-Man.svg', 'shirt', 4],
      ['adventurer', 'Uniform-Girl.svg', 'shirt', 2],
      ['adventurer', 'Uniform-Boy.svg', 'shirt', 2],
      ['pathfinder', 'Uniform-Woman.svg', 'pants', 2],
      ['pathfinder', 'Uniform-Girl.svg', 'pants', 4],
      ['pathfinder', 'Uniform-Boy.svg', 'pants', 2]
    ]) {
      const identity = [program, uniform, part, maximum - 1];
      const table = { columns: Array(count).fill('Header'), rows: [Array(count).fill('Cell')] };
      const data = { version: 1, tables: { [JSON.stringify(identity)]: table } };
      assert.deepEqual(validateBackup(data), data.tables);
      identity[3] = maximum;
      assert.throws(() => validateBackup({ version: 1, tables: { [JSON.stringify(identity)]: table } }));
    }
  }
});

test('rejects invalid schema and drops retired T-shirt tables', () => {
  for (const data of [
    { version: 2, tables: {} },
    { version: 1, tables: [] },
    { version: 1, tables: { invalid: backup.tables[key] } },
    { version: 1, tables: { '[\"pathfinder\",\"Uniform-Woman.svg\",\"unknown\"]': backup.tables[key] } },
    { version: 1, tables: { [key]: { columns: ['A', 'B'], rows: [] } } },
    { version: 1, tables: { [key]: { columns: ['A', 'B', 'C'], rows: [['short']] } } },
    { version: 1, tables: { [key]: { columns: ['A', 'B', 'C'], rows: [[1, 2, 3]] } } }
  ]) assert.throws(() => validateBackup(data));
  const retired = JSON.stringify(['pathfinder', 'Uniform-Woman.svg', 'adventurer-t-shirts', 'song']);
  assert.deepEqual(validateBackup({ version: 1, tables: { ...backup.tables, [retired]: {} } }), backup.tables);
});

test('refuses missing configuration, disallowed origins, and invalid authentication before GitHub access', async () => {
  const cases = [
    { environment: {}, expected: 503 },
    { environment: { ...env, PUBLISH_PASSPHRASE: 'short' }, expected: 503 },
    { environment: { ...env, PUBLISH_ALLOWED_ORIGIN: origin + '/' }, expected: 503 },
    { headers: { origin: 'https://untrusted.example' }, expected: 403 },
    { headers: { origin: undefined }, expected: 403 },
    { headers: { authorization: undefined }, expected: 401 },
    { headers: { authorization: 'Bearer incorrect' }, expected: 401 },
    { headers: { authorization: 'Bearer ' + 'x'.repeat(1100) }, expected: 401 }
  ];
  for (const { expected, ...options } of cases) {
    const result = await invoke(options);
    assert.equal(result.status, expected);
    assert.equal(result.calls.length, 0);
    assert.equal(result.headers['Cache-Control'], 'no-store');
    assert.ok(!JSON.stringify(result.body).includes(env.GITHUB_TOKEN));
  }
});

test('allows CORS preflight without credentials and rejects unsupported methods', async () => {
  const preflight = await invoke({ method: 'OPTIONS', headers: { authorization: undefined } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers['Access-Control-Allow-Origin'], origin);
  assert.equal(preflight.headers['Access-Control-Allow-Headers'], 'Authorization, Content-Type');
  assert.equal(preflight.calls.length, 0);
  const rejected = await invoke({ method: 'DELETE' });
  assert.equal(rejected.status, 405);
  assert.equal(rejected.calls.length, 0);
});

test('reads the existing file SHA on the configured branch', async () => {
  const result = await invoke({
    method: 'GET', environment: { ...env, GITHUB_BRANCH: 'publishing branch' },
    response: { type: 'file', sha }
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { sha });
  assert.equal(result.calls[0].url,
    'https://api.github.com/repos/Lonnynelson/startpage/contents/adventsource/uniform-details-backup.json?ref=publishing%20branch');
  assert.equal(result.calls[0].options.method, 'GET');
  assert.equal(result.calls[0].options.headers.Authorization, 'Bearer ' + env.GITHUB_TOKEN);
  assert.equal(result.calls[0].options.body, undefined);
});

test('permits authenticated same-origin reads without an Origin header', async () => {
  const result = await invoke({
    method: 'GET', response: { type: 'file', sha },
    headers: { origin: undefined, host: 'editor.example', 'sec-fetch-site': 'same-origin' }
  });
  assert.equal(result.status, 200);
  const rejected = await invoke({
    method: 'GET',
    headers: { origin: undefined, host: 'untrusted.example', 'sec-fetch-site': 'same-origin' }
  });
  assert.equal(rejected.status, 403);
});

test('publishes only the fixed file with expected SHA and UTF-8 data', async () => {
  const unicodeBackup = {
    version: 1, tables: { [key]: { columns: ['Item', 'Size', 'Price'], rows: [['Caf\u00e9', 'M', '$10']] } }
  };
  const result = await invoke({
    body: { backup: unicodeBackup, expectedSha: sha, repository: 'attacker/repo', path: 'other.json' }
  });
  assert.equal(result.status, 200);
  assert.equal(result.calls.length, 1);
  assert.equal(result.calls[0].url,
    'https://api.github.com/repos/Lonnynelson/startpage/contents/adventsource/uniform-details-backup.json');
  assert.equal(result.calls[0].options.method, 'PUT');
  const payload = JSON.parse(result.calls[0].options.body);
  assert.equal(payload.sha, sha);
  assert.equal(payload.branch, 'main');
  assert.deepEqual(JSON.parse(Buffer.from(payload.content, 'base64').toString('utf8')), unicodeBackup);
  assert.deepEqual(result.body, {
    commitSha, fileSha,
    commitUrl: 'https://github.com/Lonnynelson/startpage/commit/' + commitSha
  });
});

test('accepts JSON-string request bodies and rejects invalid or oversized payloads', async () => {
  assert.equal((await invoke({ body: JSON.stringify({ backup, expectedSha: sha }) })).status, 200);
  const cases = [
    { headers: { 'content-type': 'text/plain' }, expected: 415 },
    { body: null, expected: 400 },
    { body: '{', expected: 400 },
    { body: { backup, expectedSha: 'invalid' }, expected: 400 },
    { body: { backup, expectedSha: [sha] }, expected: 400 },
    { body: { backup: { version: 1, tables: {} }, expectedSha: sha }, expected: 400 },
    { body: { backup: { version: 2, tables: {} }, expectedSha: sha }, expected: 400 },
    { body: 'x'.repeat(1024 * 1024 + 1), expected: 413 }
  ];
  for (const { expected, ...options } of cases) {
    const result = await invoke(options);
    assert.equal(result.status, expected);
    if (expected !== 200) assert.equal(result.calls.length, 0);
  }
});

test('enforces the exact 1 MiB request boundary', async () => {
  const body = { backup, expectedSha: sha, padding: '' };
  body.padding = 'x'.repeat(1024 * 1024 - Buffer.byteLength(JSON.stringify(body), 'utf8'));
  assert.equal(Buffer.byteLength(JSON.stringify(body), 'utf8'), 1024 * 1024);
  assert.equal((await invoke({ body })).status, 200);
  body.padding += 'x';
  const rejected = await invoke({ body });
  assert.equal(rejected.status, 413);
  assert.equal(rejected.calls.length, 0);
});

test('surfaces conflicts and GitHub failures without leaking upstream secrets or retrying', async () => {
  for (const status of [401, 403, 404, 409, 422, 429, 500]) {
    const result = await invoke({ status, response: { message: 'private-upstream-details' } });
    assert.equal(result.status, status === 409 ? 409 : 502);
    assert.equal(result.calls.length, 1);
    assert.equal(JSON.stringify(result.body).includes('private-upstream-details'), false);
    assert.equal(JSON.stringify(result.body).includes(env.GITHUB_TOKEN), false);
  }
});

test('rejects malformed success responses and reports network failures', async () => {
  const malformed = await invoke({ method: 'GET', response: { type: 'file', sha: [sha] } });
  assert.equal(malformed.status, 502);
  const invalidCommit = await invoke({ response: { content: {}, commit: {} } });
  assert.equal(invalidCommit.status, 502);
  const unavailable = await invoke({ fetchError: new TypeError('test-only-network-failure') });
  assert.equal(unavailable.status, 502);
  assert.equal(unavailable.calls.length, 1);
  assert.equal(JSON.stringify(unavailable.body).includes('test-only-network-failure'), false);
});
