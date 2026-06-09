import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type {
  AddComputedFieldArgs,
  ComputedFieldItem,
} from '@/utils/hasura-api/generated/schemas';
import editComputedField from './editComputedField';

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

describe('editComputedField', () => {
  it('drops the field by its original name (with cascade) then re-adds it with the new args, in that order', async () => {
    await editComputedField({
      ...baseOptions,
      resourceVersion: 11,
      args,
      original,
    });

    expect(capturedBody).toEqual({
      type: 'bulk',
      source: 'default',
      resource_version: 11,
      args: [
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
      ],
    });
    expect(capturedHeaders?.get('x-hasura-admin-secret')).toBe('test-secret');
  });

  it('defaults source to "default" on both the bulk wrapper and the drop step when args.source is undefined', async () => {
    const { source: _omitted, ...argsWithoutSource } = args;

    await editComputedField({
      ...baseOptions,
      resourceVersion: 11,
      args: argsWithoutSource,
      original,
    });

    const body = capturedBody as {
      source: string;
      args: Array<{ args: { source: string } }>;
    };
    expect(body.source).toBe('default');
    expect(body.args[0].args.source).toBe('default');
  });

  it('forwards a non-default source onto the bulk wrapper and the drop step', async () => {
    await editComputedField({
      ...baseOptions,
      resourceVersion: 11,
      args: { ...args, source: 'analytics' },
      original,
    });

    const body = capturedBody as {
      source: string;
      args: Array<{ args: { source: string } }>;
    };
    expect(body.source).toBe('analytics');
    expect(body.args[0].args.source).toBe('analytics');
  });

  it('throws with the server-provided error message on non-200', async () => {
    server.use(
      http.post('https://local.hasura.local.nhost.run/v1/metadata', () =>
        HttpResponse.json({ error: 'internal error' }, { status: 500 }),
      ),
    );

    await expect(
      editComputedField({
        ...baseOptions,
        resourceVersion: 11,
        args,
        original,
      }),
    ).rejects.toThrow('internal error');
  });

  it('returns the response payload on success', async () => {
    const result = await editComputedField({
      ...baseOptions,
      resourceVersion: 11,
      args,
      original,
    });

    expect(result).toEqual({ message: 'success' });
  });
});
