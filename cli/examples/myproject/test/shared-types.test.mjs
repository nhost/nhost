import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import sharedGreeting from '../functions/shared-greeting.ts';
import { createGreetingServer } from '../services/my-service/src/server.ts';
import { createGreeting } from '../shared/greeting.ts';

test('shared helper supports both consumers', () => {
  for (const source of ['function', 'run-service']) {
    assert.deepEqual(createGreeting(source), {
      message: 'Hello from shared code!',
      source,
    });
  }
});

test('serverless function imports shared code from outside functions/', () => {
  let body;
  sharedGreeting(
    {},
    {
      json(value) {
        body = value;
      },
    },
  );

  assert.deepEqual(body, {
    message: 'Hello from shared code!',
    source: 'function',
  });
});

test('Run service serves the shared response over HTTP', async (t) => {
  const server = createGreetingServer();
  t.after(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );

  const listening = once(server, 'listening');
  server.listen(0, '127.0.0.1');
  await listening;

  const { port } = server.address();
  const cases = [
    {
      path: '/shared-greeting',
      method: 'GET',
      status: 200,
      body: { message: 'Hello from shared code!', source: 'run-service' },
    },
    {
      path: '/missing',
      method: 'GET',
      status: 404,
      body: { error: 'Not found' },
    },
    {
      path: '/shared-greeting',
      method: 'POST',
      status: 404,
      body: { error: 'Not found' },
    },
  ];

  for (const tc of cases) {
    await t.test(`${tc.method} ${tc.path}`, async () => {
      const response = await fetch(`http://127.0.0.1:${port}${tc.path}`, {
        method: tc.method,
      });
      assert.equal(response.status, tc.status);
      assert.equal(response.headers.get('content-type'), 'application/json');
      assert.deepEqual(await response.json(), tc.body);
    });
  }
});
