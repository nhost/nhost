import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type {
  ComputedFieldItem,
  DropComputedFieldArgs,
} from '@/utils/hasura-api/generated/schemas';
import deleteComputedFieldMigration from './deleteComputedFieldMigration';

const baseOptions = {
  appUrl: 'https://local.hasura.local.nhost.run',
  adminSecret: 'test-secret',
};

const original: ComputedFieldItem = {
  name: 'full_name',
  definition: { function: { schema: 'public', name: 'compute_full_name' } },
  comment: 'Concatenates first + last',
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

describe('deleteComputedFieldMigration', () => {
  it('posts a drop-with-cascade up step and a re-add (from original) down step to /apis/migrate with the admin secret', async () => {
    await deleteComputedFieldMigration({ ...baseOptions, args, original });

    expect(capturedBody).toEqual({
      name: 'drop_computed_field_public_users_full_name',
      up: [
        {
          type: 'pg_drop_computed_field',
          args: { cascade: true, ...args },
        },
      ],
      down: [
        {
          type: 'pg_add_computed_field',
          args: {
            table: args.table,
            name: original.name,
            definition: original.definition,
            comment: original.comment,
            source: 'default',
          },
        },
      ],
      datasource: 'default',
      skip_execution: false,
    });
    expect(capturedHeaders?.get('x-hasura-admin-secret')).toBe('test-secret');
  });

  it('lets the caller override cascade by passing it explicitly in args', async () => {
    await deleteComputedFieldMigration({
      ...baseOptions,
      args: { ...args, cascade: false },
      original,
    });

    const body = capturedBody as { up: Array<{ args: { cascade: boolean } }> };
    expect(body.up[0].args.cascade).toBe(false);
  });

  it('defaults datasource to "default" and threads it into the down re-add when args.source is undefined', async () => {
    const { source: _omitted, ...argsWithoutSource } = args;

    await deleteComputedFieldMigration({
      ...baseOptions,
      args: argsWithoutSource,
      original,
    });

    const body = capturedBody as {
      datasource: string;
      down: Array<{ args: { source: string } }>;
    };
    expect(body.datasource).toBe('default');
    expect(body.down[0].args.source).toBe('default');
  });

  it('forwards a non-default source onto datasource and the down re-add', async () => {
    await deleteComputedFieldMigration({
      ...baseOptions,
      args: { ...args, source: 'analytics' },
      original,
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
      deleteComputedFieldMigration({ ...baseOptions, args, original }),
    ).rejects.toThrow('internal error');
  });
});
