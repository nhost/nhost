import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type {
  AddComputedFieldArgs,
  ComputedFieldItem,
} from '@/utils/hasura-api/generated/schemas';
import editComputedFieldMigration from './editComputedFieldMigration';

const baseOptions = {
  appUrl: 'https://local.hasura.local.nhost.run',
  adminSecret: 'test-secret',
};

const original: ComputedFieldItem = {
  name: 'full_name',
  definition: { function: { schema: 'public', name: 'compute_full_name' } },
  comment: 'Concatenates first + last',
};

const args: AddComputedFieldArgs = {
  table: { schema: 'public', name: 'users' },
  name: 'display_name',
  definition: { function: { schema: 'public', name: 'compute_display_name' } },
  comment: 'New comment',
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

describe('editComputedFieldMigration', () => {
  it('names the migration after the original field name (so renames stay traceable)', async () => {
    await editComputedFieldMigration({ ...baseOptions, args, original });

    const body = capturedBody as { name: string };
    expect(body.name).toBe('update_computed_field_public_users_full_name');
    expect(capturedHeaders?.get('x-hasura-admin-secret')).toBe('test-secret');
  });

  it('drops the original (with cascade) then adds the new args on up', async () => {
    await editComputedFieldMigration({ ...baseOptions, args, original });

    const body = capturedBody as { up: unknown };
    expect(body.up).toEqual([
      {
        type: 'pg_drop_computed_field',
        args: {
          table: args.table,
          name: original.name,
          source: 'default',
          cascade: true,
        },
      },
      {
        type: 'pg_add_computed_field',
        args,
      },
    ]);
  });

  it('drops the new field (without cascade) then re-adds the original definition on down', async () => {
    await editComputedFieldMigration({ ...baseOptions, args, original });

    const body = capturedBody as {
      down: Array<{ args: Record<string, unknown> }>;
    };
    expect(body.down).toEqual([
      {
        type: 'pg_drop_computed_field',
        args: {
          table: args.table,
          name: args.name,
          source: 'default',
        },
      },
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
    ]);
    expect(body.down[0].args).not.toHaveProperty('cascade');
  });

  it('forwards a non-default source onto datasource, the up drop, and both down steps', async () => {
    await editComputedFieldMigration({
      ...baseOptions,
      args: { ...args, source: 'analytics' },
      original,
    });

    const body = capturedBody as {
      datasource: string;
      up: Array<{ args: { source: string } }>;
      down: Array<{ args: { source: string } }>;
    };
    expect(body.datasource).toBe('analytics');
    expect(body.up[0].args.source).toBe('analytics');
    expect(body.down[0].args.source).toBe('analytics');
    expect(body.down[1].args.source).toBe('analytics');
  });

  it('defaults datasource to "default" when args.source is undefined', async () => {
    const { source: _omitted, ...argsWithoutSource } = args;

    await editComputedFieldMigration({
      ...baseOptions,
      args: argsWithoutSource,
      original,
    });

    const body = capturedBody as { datasource: string };
    expect(body.datasource).toBe('default');
  });

  it('throws with the server-provided error message on non-200', async () => {
    server.use(
      http.post('https://local.hasura.local.nhost.run/apis/migrate', () =>
        HttpResponse.json({ error: 'internal error' }, { status: 500 }),
      ),
    );

    await expect(
      editComputedFieldMigration({ ...baseOptions, args, original }),
    ).rejects.toThrow('internal error');
  });
});
