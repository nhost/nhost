import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { DropComputedFieldArgs } from '@/utils/hasura-api/generated/schemas';
import deleteComputedField from './deleteComputedField';

const baseOptions = {
  appUrl: 'https://local.hasura.local.nhost.run',
  adminSecret: 'test-secret',
};

const args: DropComputedFieldArgs = {
  table: { schema: 'public', name: 'users' },
  name: 'full_name',
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

describe('deleteComputedField', () => {
  it('posts a bulk pg_drop_computed_field step with cascade:true to /v1/metadata with the admin secret', async () => {
    await deleteComputedField({
      ...baseOptions,
      resourceVersion: 4,
      args,
    });

    expect(capturedBody).toEqual({
      type: 'bulk',
      source: 'default',
      resource_version: 4,
      args: [
        {
          type: 'pg_drop_computed_field',
          args: { cascade: true, ...args },
        },
      ],
    });
    expect(capturedHeaders?.get('x-hasura-admin-secret')).toBe('test-secret');
  });

  it('lets the caller override cascade by passing it explicitly in args', async () => {
    await deleteComputedField({
      ...baseOptions,
      resourceVersion: 4,
      args: { ...args, cascade: false },
    });

    const body = capturedBody as {
      args: Array<{ args: { cascade: boolean } }>;
    };
    expect(body.args[0].args.cascade).toBe(false);
  });

  it('defaults the outer bulk source to "default" when args.source is undefined', async () => {
    const { source: _omitted, ...argsWithoutSource } = args;

    await deleteComputedField({
      ...baseOptions,
      resourceVersion: 4,
      args: argsWithoutSource,
    });

    const body = capturedBody as { source: string };
    expect(body.source).toBe('default');
  });

  it('throws with the server-provided error message on non-200', async () => {
    server.use(
      http.post('https://local.hasura.local.nhost.run/v1/metadata', () =>
        HttpResponse.json({ error: 'internal error' }, { status: 500 }),
      ),
    );

    await expect(
      deleteComputedField({ ...baseOptions, resourceVersion: 4, args }),
    ).rejects.toThrow('internal error');
  });

  it('returns the response payload on success', async () => {
    const result = await deleteComputedField({
      ...baseOptions,
      resourceVersion: 4,
      args,
    });

    expect(result).toEqual({ message: 'success' });
  });
});
