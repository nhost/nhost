import { afterEach, beforeEach, vi } from 'vitest';
import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import trackForeignKeyRelationsMigration from './trackForeignKeyRelationsMigration';

const fetchMock = vi.fn();

function ok(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

function notOk(body: unknown) {
  return { ok: false, json: async () => body } as Response;
}

const baseOptions = {
  dataSource: 'default',
  schema: 'public',
  table: 'books',
  appUrl: 'https://hasura.example',
  adminSecret: 'test-secret',
};

const unTrackedForeignKeyRelations: ForeignKeyRelation[] = [
  {
    name: 'authors_author_id_fkey',
    columns: ['author_id'],
    referencedSchema: 'public',
    referencedTable: 'authors',
    referencedColumns: ['id'],
    updateAction: 'RESTRICT',
    deleteAction: 'RESTRICT',
  },
];

describe('trackForeignKeyRelationsMigration', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('serializes `up` as an array of relationship operations', async () => {
    fetchMock.mockResolvedValueOnce(ok([{ message: 'success' }]));

    await trackForeignKeyRelationsMigration({
      ...baseOptions,
      unTrackedForeignKeyRelations,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, requestInit] = fetchMock.mock.calls[0];
    const body = JSON.parse(requestInit.body as string);

    expect(Array.isArray(body.up)).toBe(true);
    expect(body.up).toHaveLength(2);
    expect(body.up[0]).toMatchObject({ type: 'pg_create_object_relationship' });
    expect(body.up[1]).toMatchObject({ type: 'pg_create_array_relationship' });

    expect(body).toMatchObject({
      dataSource: 'default',
      skip_execution: false,
      name: 'track_foreign_key_relations_public_books',
      down: [],
    });
  });

  it('throws a normalized error when the response is not ok', async () => {
    fetchMock.mockResolvedValueOnce(notOk({ error: 'boom' }));

    await expect(
      trackForeignKeyRelationsMigration({
        ...baseOptions,
        unTrackedForeignKeyRelations,
      }),
    ).rejects.toThrow('boom');
  });
});
