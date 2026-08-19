import trackForeignKeyRelations from '@/features/orgs/projects/database/dataGrid/hooks/useTrackForeignKeyRelationsMutation/trackForeignKeyRelations';

const mocks = vi.hoisted(() => ({
  fetchExportMetadata: vi.fn(),
}));

vi.mock('@/features/orgs/projects/common/utils/fetchExportMetadata', () => ({
  fetchExportMetadata: mocks.fetchExportMetadata,
}));

const fetchMock = vi.fn();
const options = {
  dataSource: 'default',
  schema: 'public',
  table: 'books',
  appUrl: 'https://hasura.example',
  adminSecret: 'secret',
};

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  mocks.fetchExportMetadata.mockResolvedValue({
    resource_version: 1,
    metadata: { version: 3, sources: [] },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  mocks.fetchExportMetadata.mockReset();
});

describe('trackForeignKeyRelations', () => {
  it('sends scalar-compatible metadata operations for a composite relation', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    await trackForeignKeyRelations({
      ...options,
      unTrackedForeignKeyRelations: [
        {
          name: 'books_tenant_author_fkey',
          columns: ['tenant_id', 'author_id'],
          referencedSchema: 'public',
          referencedTable: 'authors',
          referencedColumns: ['tenant_id', 'id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(request.args).toHaveLength(2);
    expect(request.args[0].args.using.foreign_key_constraint_on).toEqual([
      'tenant_id',
      'author_id',
    ]);
    expect(request.args[1].args.using.foreign_key_constraint_on).toEqual({
      columns: ['tenant_id', 'author_id'],
      table: { name: 'books', schema: 'public' },
    });
  });

  it('retains singular metadata tracking', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    await trackForeignKeyRelations({
      ...options,
      unTrackedForeignKeyRelations: [
        {
          name: 'books_author_fkey',
          columns: ['author_id'],
          referencedSchema: 'public',
          referencedTable: 'authors',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(request.args).toHaveLength(2);
    expect(request.args[0].args.using.foreign_key_constraint_on).toBe(
      'author_id',
    );
    expect(request.args[1].args.using.foreign_key_constraint_on).toEqual({
      column: 'author_id',
      table: { name: 'books', schema: 'public' },
    });
  });

  it('does not send an empty metadata request', async () => {
    await trackForeignKeyRelations({
      ...options,
      unTrackedForeignKeyRelations: [],
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not send a metadata request for action-only composite changes', async () => {
    mocks.fetchExportMetadata.mockResolvedValue({
      resource_version: 1,
      metadata: {
        version: 3,
        sources: [
          {
            name: 'default',
            kind: 'postgres',
            tables: [
              {
                table: { schema: 'public', name: 'books' },
                configuration: {},
                object_relationships: [
                  {
                    name: 'author',
                    using: {
                      foreign_key_constraint_on: ['tenant_id', 'author_id'],
                    },
                  },
                ],
              },
              {
                table: { schema: 'public', name: 'authors' },
                configuration: {},
                array_relationships: [
                  {
                    name: 'books',
                    using: {
                      foreign_key_constraint_on: {
                        columns: ['tenant_id', 'author_id'],
                        table: { schema: 'public', name: 'books' },
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    const trackedForeignKey = {
      name: 'books_tenant_author_fkey',
      columns: ['tenant_id', 'author_id'],
      referencedSchema: 'public',
      referencedTable: 'authors',
      referencedColumns: ['tenant_id', 'id'],
      updateAction: 'RESTRICT' as const,
      deleteAction: 'RESTRICT' as const,
    };

    await trackForeignKeyRelations({
      ...options,
      trackedForeignKeyRelations: [trackedForeignKey],
      unTrackedForeignKeyRelations: [
        {
          ...trackedForeignKey,
          updateAction: 'CASCADE',
          deleteAction: 'SET NULL',
        },
      ],
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not send a metadata request for an invalid relation', async () => {
    await trackForeignKeyRelations({
      ...options,
      unTrackedForeignKeyRelations: [
        {
          name: 'invalid_fkey',
          columns: ['tenant_id', 'author_id'],
          referencedSchema: 'public',
          referencedTable: 'authors',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
