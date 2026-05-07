const { describe, it, expect, beforeAll } = require('@jest/globals');

const PORTS = {
  node22: 3002,
  node20: 3001,
  npm: 3003,
  yarn: 3004,
};

const BASE_METADATA = [
  { path: 'functions/add.js', route: '/add' },
  { path: 'functions/cors-custom.js', route: '/cors-custom' },
  { path: 'functions/cors-disabled.js', route: '/cors-disabled' },
  { path: 'functions/greet.js', route: '/greet' },
  { path: 'functions/hello.ts', route: '/hello' },
  { path: 'functions/index.js', route: '/' },
  { path: 'functions/sharp.ts', route: '/sharp' },
  { path: 'functions/sub/hello.ts', route: '/sub/hello' },
  { path: 'functions/sub/index.ts', route: '/sub/' },
];

// example-pnpm/ has the checked-in hot-reload fixture (`hotreload-consumer.js`
// + `_utils/hotreload-helper.js`) and is the target of
// `build/dev/docker/mutate.sh`, which adds two further entry files at
// dev-env-up time. example-npm/ and example-yarn/ remain at the base set.
const PNPM_METADATA = BASE_METADATA.concat([
  { path: 'functions/hotreload-consumer.js', route: '/hotreload-consumer' },
  {
    path: 'functions/hotreload-makefile-add.js',
    route: '/hotreload-makefile-add',
  },
  {
    path: 'functions/hotreload-makefile-change.js',
    route: '/hotreload-makefile-change',
  },
]);

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
  ['node22 (pnpm)', PORTS.node22, 'nodejs22.x', PNPM_METADATA],
  ['node20 (pnpm)', PORTS.node20, 'nodejs20.x', PNPM_METADATA],
  ['node22 (npm)', PORTS.npm, 'nodejs22.x', BASE_METADATA],
  ['node22 (yarn)', PORTS.yarn, 'nodejs22.x', BASE_METADATA],
])('functions runtime (%s)', (label, port, expectedRuntime, expectedMetadata) => {
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

  it('default CORS headers are present on user function responses', async () => {
    const res = await fetch(`${base}/hello?name=World`);
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-headers')).toBe(
      'origin,Accept,Authorization,Content-Type',
    );
  });

  it('function can disable default CORS headers by setting them empty', async () => {
    const res = await fetch(`${base}/cors-disabled`);
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('');
    expect(res.headers.get('access-control-allow-headers')).toBe('');
  });

  it('function can override default CORS headers', async () => {
    const res = await fetch(`${base}/cors-custom`);
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://example.com',
    );
    expect(res.headers.get('access-control-allow-headers')).toBe(
      'X-Custom-Header',
    );
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

    const expected = expectedMetadata.map((entry) => ({
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

// Hot-reload coverage. The mutations themselves are choreographed from the
// host by build/dev/docker/mutate.sh during make dev-env-up — these tests
// run inside the Nix build sandbox (which can't write to the host
// bind-mount source) and only confirm, over HTTP, that chokidar in the
// container observed each event and that the resulting bundle is loaded.
//
// example-pnpm/ is bind-mounted into both pnpm containers; the mutator
// targets node22's port for waiting, but node20 sees the same filesystem
// changes. We assert against node22 — single-target coverage is enough
// since the watch mechanism is identical across runtimes.
describe('hot reload (node22-pnpm)', () => {
  const port = PORTS.node22;
  const base = `http://127.0.0.1:${port}`;
  let events;

  beforeAll(async () => {
    await waitForHealthy(port, 'node22 (pnpm) hot-reload');
    const res = await fetch(`${base}/_nhost_functions_events`);
    expect(res.status).toBe(200);
    events = (await res.json()).events;
  }, 120_000);

  function findEvents(type, file) {
    return events.filter((e) => e.type === type && e.file === file);
  }

  it('add: chokidar observed creation of a new function file', () => {
    expect(findEvents('add', 'hotreload-makefile-add.js')).not.toHaveLength(0);
  });

  it('add: the new route returns its bundled response', async () => {
    const res = await fetch(`${base}/hotreload-makefile-add`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ marker: 'added-via-makefile' });
  });

  it('change: chokidar observed an edit and the new content is bundled', async () => {
    expect(
      findEvents('change', 'hotreload-makefile-change.js'),
    ).not.toHaveLength(0);
    const res = await fetch(`${base}/hotreload-makefile-change`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ value: 'second' });
  });

  it('unlink: chokidar observed a deletion and the route is gone', async () => {
    expect(
      findEvents('unlink', 'hotreload-makefile-delete.js'),
    ).not.toHaveLength(0);
    const res = await fetch(`${base}/hotreload-makefile-delete`);
    expect(res.status).toBe(404);
  });

  it('change in _utils/: imported helper edit drove a rebuild loading new code', async () => {
    expect(findEvents('change', '_utils/hotreload-helper.js')).not.toHaveLength(
      0,
    );
    // mutate.sh changed compute() from `a + b` to `(a + b) * 10`. The route
    // returning 70 for a=3,b=4 confirms the rebuild observed by chokidar
    // actually rebuilt and reloaded the bundle for the consumer.
    const res = await fetch(`${base}/hotreload-consumer?a=3&b=4`);
    expect(res.status).toBe(200);
    expect((await res.json()).result).toBe(70);
  });
});
