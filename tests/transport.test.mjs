import test from 'node:test';
import assert from 'node:assert/strict';

process.env.GEMINI_MAX_ATTEMPTS = '2';
process.env.GEMINI_MAX_REQUESTS_PER_SESSION = '8';
process.env.GEMINI_MIN_INTERVAL_MS = '1000';

const { geminiRequest, geminiStatus } = await import('../lib/gemini-transport.mjs');

const response = (status, payload, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: name => headers[name.toLowerCase()] || null },
  json: async () => payload,
});

test('retries a temporary provider error with the same credential and cools down failing key while alternate key succeeds', async () => {
  const credentials = [];
  let calls = 0;
  const fetcher = async (_url, options) => {
    credentials.push(options.headers['x-goog-api-key']);
    calls += 1;
    if (calls === 1) return response(503, { error: { message: 'temporary' } }, { 'retry-after': '0' });
    return response(200, { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] });
  };

  const completed = await geminiRequest('test-key-A', 'gemini-test', '{}', fetcher);
  assert.equal(completed.transport.attempts, 2);
  assert.deepEqual(credentials, ['test-key-A', 'test-key-A']);

  const quotaFetcher = async () => response(429, {
    error: {
      details: [{
        '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
        violations: [{ quotaValue: '0', quotaId: 'requests-per-day' }],
      }],
    },
  }, { 'retry-after': '0' });

  await assert.rejects(
    geminiRequest('test-key-A', 'gemini-test', '{}', quotaFetcher),
    error => error.code === 'GEMINI_HTTP_429',
  );

  // Subsequent call with key-A is blocked by key-A's cooldown
  await assert.rejects(
    geminiRequest('test-key-A', 'gemini-test', '{}', async () => {}),
    error => error.code === 'PROVIDER_COOLDOWN',
  );

  // But key-B in the multi-key pool can immediately take over and succeed
  const completedB = await geminiRequest('test-key-B', 'gemini-test', '{}', async () => response(200, { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }));
  assert.equal(completedB.transport.attempts, 1);
});
