const fs = require('node:fs');
const path = require('node:path');
const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');

const PORTS = {
  node22: 3002,
  node20: 3001,
  npm: 3003,
  yarn: 3004,
};

const HOST_FUNCTIONS_DIR = path.join(
  __dirname,
  '..',
  'example-pnpm',
  'functions',
);

// Hot-reload tests use this prefix for the temp function files they create.
// Must NOT start with '_' — discoverFunctions / isEntryFile both exclude any
// path segment starting with '_' (the `_utils/` convention), and we need
// these files to be classified as entry files so add/unlink drives a full
// rebuild rather than an incremental one.
const HOTRELOAD_PREFIX = 'hotreload-test-';

// Strip any orphaned hot-reload test files from a previously aborted run so
// the metadata-count assertion below stays at 9. Then wait long enough for the
// running container's chokidar (1s polling + 200ms awaitWriteFinish) to settle
// the resulting unlink events before tests start asserting.
beforeAll(async () => {
  const entries = await fs.promises.readdir(HOST_FUNCTIONS_DIR);
  await Promise.all(
    entries
      .filter((name) => name.startsWith(HOTRELOAD_PREFIX))
      .map((name) =>
        fs.promises.unlink(path.join(HOST_FUNCTIONS_DIR, name)).catch(() => {}),
      ),
  );
  await new Promise((r) => setTimeout(r, 2000));
}, 30_000);

const EXPECTED_METADATA = [
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

// Hot-reload coverage. Runs against the node22 (pnpm) container only —
// example-pnpm/ is bind-mounted into both node20 and node22, but the
// hot-reload mechanism (chokidar + usePolling) is identical across runtimes,
// so single-target coverage is enough. Filenames are unique per test and
// scrubbed in afterAll, with the top-level beforeAll above protecting against
// orphans from aborted runs.
describe('hot reload (node22-pnpm)', () => {
  const port = PORTS.node22;
  const base = `http://127.0.0.1:${port}`;
  const createdFiles = [];

  function tempName(suffix) {
    const rand = Math.random().toString(36).slice(2, 8);
    return `${HOTRELOAD_PREFIX}${process.pid}-${Date.now()}-${rand}${suffix}`;
  }

  async function getStats() {
    const res = await fetch(`${base}/_nhost_functions_rebuild_stats`);
    expect(res.status).toBe(200);
    return res.json();
  }

  // Polls the stats endpoint until the named counter exceeds the baseline,
  // then keeps polling until rebuildsCompleted catches up so callers can
  // safely hit the function and observe the new bundle.
  async function waitForRebuild(counter, baseline, timeoutMs = 30_000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const stats = await getStats();
      if (
        stats[counter] > baseline[counter] &&
        stats.rebuildsCompleted > baseline.rebuildsCompleted
      ) {
        return stats;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(
      `Timeout waiting for ${counter} > ${baseline[counter]} (last seen: ${JSON.stringify(await getStats())})`,
    );
  }

  beforeAll(async () => {
    await waitForHealthy(port, 'node22 (pnpm) hot-reload');
  }, 120_000);

  afterAll(async () => {
    await Promise.all(
      createdFiles.map((p) => fs.promises.unlink(p).catch(() => {})),
    );
  });

  it('add: creating a new function file registers a route via full rebuild', async () => {
    const fileName = tempName('_added.js');
    const fullPath = path.join(HOST_FUNCTIONS_DIR, fileName);
    createdFiles.push(fullPath);

    const baseline = await getStats();
    await fs.promises.writeFile(
      fullPath,
      `module.exports = (req, res) => res.json({ ok: true, marker: 'added' });\n`,
    );

    await waitForRebuild('fullRebuildsScheduled', baseline);

    const route = `/${fileName.replace(/\.js$/, '')}`;
    const res = await fetch(`${base}${route}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, marker: 'added' });
  }, 60_000);

  it('change: editing an existing function reflects via incremental rebuild', async () => {
    const fileName = tempName('_change.js');
    const fullPath = path.join(HOST_FUNCTIONS_DIR, fileName);
    createdFiles.push(fullPath);
    const route = `/${fileName.replace(/\.js$/, '')}`;

    let baseline = await getStats();
    await fs.promises.writeFile(
      fullPath,
      `module.exports = (req, res) => res.json({ value: 'first' });\n`,
    );
    await waitForRebuild('fullRebuildsScheduled', baseline);

    let res = await fetch(`${base}${route}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ value: 'first' });

    baseline = await getStats();
    await fs.promises.writeFile(
      fullPath,
      `module.exports = (req, res) => res.json({ value: 'second' });\n`,
    );
    await waitForRebuild('incrementalRebuildsScheduled', baseline);

    res = await fetch(`${base}${route}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ value: 'second' });
  }, 60_000);

  it('unlink: deleting a function file removes its route via full rebuild', async () => {
    const fileName = tempName('_delete.js');
    const fullPath = path.join(HOST_FUNCTIONS_DIR, fileName);
    // Track for afterAll cleanup before any awaits — if the test fails between
    // writeFile and unlink, we still need afterAll to remove the file so it
    // doesn't show up as an untracked file in git.
    createdFiles.push(fullPath);
    const route = `/${fileName.replace(/\.js$/, '')}`;

    let baseline = await getStats();
    await fs.promises.writeFile(
      fullPath,
      `module.exports = (req, res) => res.send('present');\n`,
    );
    await waitForRebuild('fullRebuildsScheduled', baseline);

    let res = await fetch(`${base}${route}`);
    expect(res.status).toBe(200);

    baseline = await getStats();
    await fs.promises.unlink(fullPath);
    await waitForRebuild('fullRebuildsScheduled', baseline);

    res = await fetch(`${base}${route}`);
    expect(res.status).toBe(404);
  }, 60_000);

  it('change in _utils/: imported helper edit drives an incremental rebuild', async () => {
    const utilsAddPath = path.join(HOST_FUNCTIONS_DIR, '_utils', 'add.js');
    const original = await fs.promises.readFile(utilsAddPath, 'utf-8');

    try {
      let res = await fetch(`${base}/add?a=3&b=4`);
      expect(res.status).toBe(200);
      expect((await res.json()).result).toBe(7);

      const baseline = await getStats();
      await fs.promises.writeFile(
        utilsAddPath,
        `export function add(a, b) {\n  return (a + b) * 10;\n}\n`,
      );
      await waitForRebuild('incrementalRebuildsScheduled', baseline);

      res = await fetch(`${base}/add?a=3&b=4`);
      expect(res.status).toBe(200);
      expect((await res.json()).result).toBe(70);
    } finally {
      // Always restore so the file (which is checked into git) is left clean
      // even if assertions failed mid-test.
      const baseline = await getStats();
      await fs.promises.writeFile(utilsAddPath, original);
      await waitForRebuild('incrementalRebuildsScheduled', baseline).catch(
        () => {},
      );
    }
  }, 60_000);
});
