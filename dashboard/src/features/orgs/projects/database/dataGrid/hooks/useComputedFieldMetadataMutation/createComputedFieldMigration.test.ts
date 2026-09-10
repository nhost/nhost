import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { AddComputedFieldArgs } from '@/utils/hasura-api/generated/schemas';
import createComputedFieldMigration from './createComputedFieldMigration';

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
    'https://local.hasura.local.nhost.run/apis/migrate',
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

describe('createComputedFieldMigration', () => {
  it('posts a migration with an add up step and a drop down step to /apis/migrate with the admin secret', async () => {
    await createComputedFieldMigration({ ...baseOptions, args });

    expect(capturedBody).toEqual({
      name: 'add_computed_field_public_users_full_name',
      up: [{ type: 'pg_add_computed_field', args }],
      down: [
        {
          type: 'pg_drop_computed_field',
          args: { table: args.table, name: args.name, source: 'default' },
        },
      ],
      datasource: 'default',
      skip_execution: false,
    });
    expect(capturedHeaders?.get('x-hasura-admin-secret')).toBe('test-secret');
  });

  it('defaults datasource to "default" and threads it into the down step when args.source is undefined', async () => {
    const { source: _omitted, ...argsWithoutSource } = args;

    await createComputedFieldMigration({
      ...baseOptions,
      args: argsWithoutSource,
    });

    const body = capturedBody as {
      datasource: string;
      down: Array<{ args: { source: string } }>;
    };
    expect(body.datasource).toBe('default');
    expect(body.down[0].args.source).toBe('default');
  });

  it('forwards a non-default source onto datasource and the down step', async () => {
    await createComputedFieldMigration({
      ...baseOptions,
      args: { ...args, source: 'analytics' },
    });

    const body = capturedBody as {
      datasource: string;
      down: Array<{ args: { source: string } }>;
    };
    expect(body.datasource).toBe('analytics');
    expect(body.down[0].args.source).toBe('analytics');
  });

  it('throws with the server-provided error message on non-200', async () => {
    server.use(
      http.post('https://local.hasura.local.nhost.run/apis/migrate', () =>
        HttpResponse.json({ error: 'internal error' }, { status: 500 }),
      ),
    );

    await expect(
      createComputedFieldMigration({ ...baseOptions, args }),
    ).rejects.toThrow('internal error');
  });

  it('returns the response payload on success', async () => {
    const result = await createComputedFieldMigration({ ...baseOptions, args });

    expect(result).toEqual({ message: 'success' });
  });
});
