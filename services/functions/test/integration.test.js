const { describe, it, expect, beforeAll } = require('@jest/globals');

const PORTS = {
  node22: 3002,
  node20: 3001,
};

const EXPECTED_ROUTES = ['/', '/hello', '/add', '/sub/', '/sub/hello'];

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
  ['node22', PORTS.node22, 'nodejs22.x'],
  ['node20', PORTS.node20, 'nodejs20.x'],
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
    expect(await res.text()).toContain('Hullo, World!');
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

  it('GET /nonexistent returns 404', async () => {
    const res = await fetch(`${base}/nonexistent`);
    expect(res.status).toBe(404);
  });

  describe('metadata endpoint', () => {
    let metadata;

    beforeAll(async () => {
      const res = await fetch(`${base}/_nhost_functions_metadata`);
      expect(res.status).toBe(200);
      metadata = await res.json();
    });

    it('returns an array of functions', () => {
      expect(Array.isArray(metadata)).toBe(true);
      expect(metadata.length).toBeGreaterThan(0);
    });

    it.each(EXPECTED_ROUTES)('contains route %s', (route) => {
      const entry = metadata.find((m) => m.route === route);
      expect(entry).toBeDefined();
    });

    it('all entries have the correct runtime', () => {
      for (const entry of metadata) {
        expect(entry.runtime).toBe(expectedRuntime);
      }
    });

    it('all entries have createdWithCommitSha set to localdev', () => {
      for (const entry of metadata) {
        expect(entry.createdWithCommitSha).toBe('localdev');
      }
    });

    it('all entries have required fields', () => {
      for (const entry of metadata) {
        expect(entry).toHaveProperty('path');
        expect(entry).toHaveProperty('route');
        expect(entry).toHaveProperty('runtime');
      }
    });
  });
});
