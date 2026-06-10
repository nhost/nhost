import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { AddComputedFieldArgs } from '@/utils/hasura-api/generated/schemas';
import createComputedField from './createComputedField';

const baseOptions = {
  appUrl: 'https://local.hasura.local.nhost.run',
  adminSecret: 'test-secret',
};

const args: AddComputedFieldArgs = {
  table: { schema: 'public', name: 'users' },
  name: 'full_name',
  definition: { function: { schema: 'public', name: 'compute_full_name' } },
  source: 'default',
};

let capturedBody: unknown = null;
let capturedHeaders: Headers | null = null;

const server = setupServer(
  http.post(
    'https://local.hasura.local.nhost.run/v1/metadata',
    async ({ request }) => {
      capturedBody = await request.json();
      capturedHeaders = request.headers;
      return HttpResponse.json({ message: 'success' });
    },
  ),
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  capturedBody = null;
  capturedHeaders = null;
});
afterAll(() => server.close());

describe('createComputedField', () => {
  it('posts a bulk pg_add_computed_field step to /v1/metadata with the admin secret', async () => {
    await createComputedField({
      ...baseOptions,
      resourceVersion: 7,
      args,
    });

    expect(capturedBody).toEqual({
      type: 'bulk',
      source: 'default',
      resource_version: 7,
      args: [{ type: 'pg_add_computed_field', args }],
    });
    expect(capturedHeaders?.get('x-hasura-admin-secret')).toBe('test-secret');
    expect(capturedHeaders?.get('content-type')).toBe('application/json');
  });

  it('defaults the outer bulk source to "default" when args.source is undefined', async () => {
    const { source: _omitted, ...argsWithoutSource } = args;

    await createComputedField({
      ...baseOptions,
      resourceVersion: 7,
      args: argsWithoutSource,
    });

    const body = capturedBody as { source: string };
    expect(body.source).toBe('default');
  });

  it('forwards a non-default source onto the outer bulk', async () => {
    await createComputedField({
      ...baseOptions,
      resourceVersion: 7,
      args: { ...args, source: 'analytics' },
    });

    const body = capturedBody as { source: string };
    expect(body.source).toBe('analytics');
  });

  it('throws with the server-provided error message on non-200', async () => {
    server.use(
      http.post('https://local.hasura.local.nhost.run/v1/metadata', () =>
        HttpResponse.json({ error: 'internal error' }, { status: 500 }),
      ),
    );

    await expect(
      createComputedField({ ...baseOptions, resourceVersion: 7, args }),
    ).rejects.toThrow('internal error');
  });

  it('returns the response payload on success', async () => {
    const result = await createComputedField({
      ...baseOptions,
      resourceVersion: 7,
      args,
    });

    expect(result).toEqual({ message: 'success' });
  });
});
