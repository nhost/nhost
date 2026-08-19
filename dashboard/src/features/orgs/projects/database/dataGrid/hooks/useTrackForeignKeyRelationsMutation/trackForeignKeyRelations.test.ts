import trackForeignKeyRelations from '@/features/orgs/projects/database/dataGrid/hooks/useTrackForeignKeyRelationsMutation/trackForeignKeyRelations';

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
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe('trackForeignKeyRelations', () => {
  it('does not send metadata for a composite relation', async () => {
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

    expect(fetchMock).not.toHaveBeenCalled();
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
  });
});
