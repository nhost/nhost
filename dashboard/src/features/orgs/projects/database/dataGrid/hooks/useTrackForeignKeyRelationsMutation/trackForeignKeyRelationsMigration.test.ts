import { afterEach, beforeEach, vi } from 'vitest';
import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { MetadataVersionConflictError } from '@/utils/hasura-api/metadata-version-conflict-error';
import trackForeignKeyRelationsMigration from './trackForeignKeyRelationsMigration';

const fetchMock = vi.fn();

function ok(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

function notOk(body: unknown, status = 400) {
  return { ok: false, status, json: async () => body } as Response;
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
    columnName: 'author_id',
    referencedSchema: 'public',
    referencedTable: 'authors',
    referencedColumn: 'id',
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
    expect(body).not.toHaveProperty('appUrl');
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

  it('preserves a migration metadata version conflict before normalization', async () => {
    fetchMock.mockResolvedValueOnce(
      notOk({
        code: 'data_api_error',
        message: JSON.stringify({
          path: '$',
          error:
            'metadata resource version referenced (42) did not match current version',
          code: 'conflict',
        }),
      }),
    );

    await expect(
      trackForeignKeyRelationsMigration({
        ...baseOptions,
        unTrackedForeignKeyRelations,
      }),
    ).rejects.toBeInstanceOf(MetadataVersionConflictError);
  });
});
