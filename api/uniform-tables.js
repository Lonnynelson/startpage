const { createHash, timingSafeEqual } = require('node:crypto');
const { validateBackup } = require('../adventsource/uniform-table-schema.js');

const repository = 'Lonnynelson/startpage';
const filePath = 'adventsource/uniform-details-backup.json';
const apiUrl = `https://api.github.com/repos/${repository}/contents/${filePath}`;
const maxBytes = 1024 * 1024;
const shaPattern = /^[a-f0-9]{40}$/;

function validOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.origin === value;
  } catch {
    return false;
  }
}

function authenticated(header, passphrase) {
  if (typeof header !== 'string' || header.length > 1024 || !header.startsWith('Bearer ')) return false;
  const hash = value => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(header.slice(7)), hash(passphrase));
}

function createHandler({ fetchImpl = globalThis.fetch, env = process.env } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Origin');
    const reply = (status, body) => res.status(status).json(body);
    const origin = env.PUBLISH_ALLOWED_ORIGIN;
    if (!validOrigin(origin) || !env.GITHUB_TOKEN ||
        typeof env.PUBLISH_PASSPHRASE !== 'string' ||
        !/^[\x20-\x7e]{24,1000}$/.test(env.PUBLISH_PASSPHRASE)) {
      return reply(503, { error: 'Publishing is not configured. Contact the site administrator.' });
    }
    const sameOriginRead = req.method === 'GET' && !req.headers.origin &&
      req.headers['sec-fetch-site'] === 'same-origin' &&
      req.headers.host === new URL(origin).host;
    if (req.headers.origin !== origin && !sameOriginRead) {
      return reply(403, { error: 'This site is not allowed to publish tables.' });
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (!['GET', 'POST'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, OPTIONS');
      return reply(405, { error: 'Method not allowed.' });
    }
    if (!authenticated(req.headers.authorization, env.PUBLISH_PASSPHRASE)) {
      return reply(401, { error: 'The publishing passphrase is incorrect.' });
    }

    let content;
    let expectedSha;
    if (req.method === 'POST') {
      if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
        return reply(415, { error: 'Send the backup as application/json.' });
      }
      try {
        const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        if (!raw) {
          return reply(400, { error: 'A JSON publishing request is required.' });
        }
        if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
          return reply(413, { error: 'The publishing request must be no larger than 1 MiB.' });
        }
        const body = JSON.parse(raw);
        if (!body || typeof body.expectedSha !== 'string' || !shaPattern.test(body.expectedSha)) {
          return reply(400, { error: 'A current GitHub file SHA is required.' });
        }
        const tables = validateBackup(body.backup);
        if (Object.keys(tables).length === 0) {
          return reply(400, { error: 'An empty backup cannot be published.' });
        }
        expectedSha = body.expectedSha;
        content = Buffer.from(JSON.stringify({ version: 1, tables }, null, 2) + '\n', 'utf8').toString('base64');
      } catch (error) {
        return reply(400, { error: 'Invalid publishing request: ' + error.message });
      }
    }

    const branch = env.GITHUB_BRANCH || 'main';
    try {
      const response = await fetchImpl(
        req.method === 'GET' ? `${apiUrl}?ref=${encodeURIComponent(branch)}` : apiUrl,
        {
          method: req.method === 'GET' ? 'GET' : 'PUT',
          cache: 'no-store',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${env.GITHUB_TOKEN}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'AdventSource-table-publisher',
            ...(req.method === 'POST' ? { 'Content-Type': 'application/json' } : {})
          },
          signal: AbortSignal.timeout(10000),
          ...(req.method === 'POST' ? {
            body: JSON.stringify({
              message: 'Update AdventSource uniform tables',
              content,
              sha: expectedSha,
              branch
            })
          } : {})
        }
      );
      if (!response.ok) {
        if (response.status === 409) {
          return reply(409, { error: 'The file changed on GitHub. Review the latest backup before publishing again.' });
        }
        if (response.status === 404) {
          return reply(502, { error: 'GitHub could not find the backup. Check the repository, branch, and token access.' });
        }
        if ([401, 403, 422].includes(response.status)) {
          return reply(502, { error: 'GitHub rejected the request. Check token permissions, branch protection, and API rate limits.' });
        }
        return reply(502, { error: `GitHub could not complete the request (HTTP ${response.status}).` });
      }
      const result = await response.json();
      if (req.method === 'GET') {
        if (result.type !== 'file' || typeof result.sha !== 'string' || !shaPattern.test(result.sha)) {
          throw new Error('Invalid GitHub file response.');
        }
        return reply(200, { sha: result.sha });
      }
      if (typeof result.commit?.sha !== 'string' || !shaPattern.test(result.commit.sha) ||
          typeof result.content?.sha !== 'string' || !shaPattern.test(result.content.sha)) {
        throw new Error('Invalid GitHub commit response.');
      }
      return reply(200, {
        commitSha: result.commit.sha,
        fileSha: result.content.sha,
        commitUrl: `https://github.com/${repository}/commit/${result.commit.sha}`
      });
    } catch (error) {
      console.error('Table publishing request failed:', error.name);
      return reply(502, { error: 'Could not complete the GitHub request. Please try again.' });
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
