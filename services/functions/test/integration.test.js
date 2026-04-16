const { describe, it, expect, beforeAll } = require('@jest/globals');

const PORTS = {
  node22: 3002,
  node20: 3001,
  npm: 3003,
  yarn: 3004,
};

const EXPECTED_METADATA = [
  { path: 'functions/add.js', route: '/add' },
  { path: 'functions/greet.js', route: '/greet' },
  { path: 'functions/hello.ts', route: '/hello' },
  { path: 'functions/index.js', route: '/' },
  { path: 'functions/sharp.ts', route: '/sharp' },
  { path: 'functions/sub/hello.ts', route: '/sub/hello' },
  { path: 'functions/sub/index.ts', route: '/sub/' },
];

async function waitForHealthy(port, label, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${label} did not become healthy after ${maxAttempts}s`);
}

describe.each([
  ['node22 (pnpm)', PORTS.node22, 'nodejs22.x'],
  ['node20 (pnpm)', PORTS.node20, 'nodejs20.x'],
  ['node22 (npm)', PORTS.npm, 'nodejs22.x'],
  ['node22 (yarn)', PORTS.yarn, 'nodejs22.x'],
])('functions runtime (%s)', (label, port, expectedRuntime) => {
  const base = `http://127.0.0.1:${port}`;

  beforeAll(async () => {
    await waitForHealthy(port, label);
  }, 120_000);

  it('GET /healthz returns ok', async () => {
    const res = await fetch(`${base}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });

  it('GET / returns index function response', async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('This is the index function');
  });

  it('GET /hello?name=World returns greeting', async () => {
    const res = await fetch(`${base}/hello?name=World`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Hello, World!');
  });

  it('GET /sub/ returns sub-directory index', async () => {
    const res = await fetch(`${base}/sub/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Index of a sub-directory');
  });

  it('GET /sub/hello?name=Test returns sub greeting', async () => {
    const res = await fetch(`${base}/sub/hello?name=Test`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Hello from a subdirectory, Test!');
  });

  it('GET /add imports from _utils', async () => {
    const res = await fetch(`${base}/add?a=3&b=4`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result).toBe(7);
  });

  it('GET /greet uses uuid dependency', async () => {
    const res = await fetch(`${base}/greet?name=test`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe('Hello, test!');
    expect(body.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('GET /sharp returns 500 (native dependency fails at runtime)', async () => {
    const res = await fetch(`${base}/sharp`);
    expect(res.status).toBe(500);
  });

  it('GET /nonexistent returns 404', async () => {
    const res = await fetch(`${base}/nonexistent`);
    expect(res.status).toBe(404);
  });

  it('returns expected function metadata', async () => {
    const res = await fetch(`${base}/_nhost_functions_metadata`);
    expect(res.status).toBe(200);
    const body = await res.json();

    const expected = EXPECTED_METADATA.map((entry) => ({
      ...entry,
      runtime: expectedRuntime,
      createdAt: '0001-01-01T00:00:00Z',
      updatedAt: '0001-01-01T00:00:00Z',
      functionName: '',
      createdWithCommitSha: 'localdev',
    }));

    expect(body).toEqual({
      functions: expect.arrayContaining(expected),
    });
    expect(body.functions).toHaveLength(expected.length);
  });
});
