import { vi } from 'vitest';
import EditTableForm from '@/features/orgs/projects/database/dataGrid/components/EditTableForm/EditTableForm';
import type { CandidateKey } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';

const mocks = vi.hoisted(() => ({
  useTableSchemaQuery: vi.fn(),
  trackForeignKeyRelations: vi.fn(),
  updateTable: vi.fn(),
  useDatabaseQuery: vi.fn(() => ({ data: undefined })),
  push: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: () => ({ query: {}, push: mocks.push }),
}));

vi.mock('@/utils/toast', () => ({ triggerToast: vi.fn() }));

vi.mock(
  '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery',
  () => ({ useTableSchemaQuery: mocks.useTableSchemaQuery }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery',
  () => ({ useDatabaseQuery: mocks.useDatabaseQuery }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useTrackForeignKeyRelationsMutation',
  () => ({
    useTrackForeignKeyRelationsMutation: () => ({
      mutateAsync: mocks.trackForeignKeyRelations,
      error: null,
      reset: vi.fn(),
    }),
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useUpdateTableMutation',
  async () => {
    const { useState } = await vi.importActual<typeof import('react')>('react');

    return {
      useUpdateTableMutation: () => {
        const [error, setError] = useState<Error | null>(null);

        return {
          mutateAsync: async (...args: unknown[]) => {
            try {
              return await mocks.updateTable(...args);
            } catch (mutationError) {
              setError(mutationError as Error);
              throw mutationError;
            }
          },
          error,
          reset: () => setError(null),
        };
      },
    };
  },
);

const columns = [
  {
    column_name: 'author_id',
    data_type: 'uuid',
    full_data_type: 'uuid',
    udt_name: 'uuid',
    is_nullable: 'NO',
  },
  {
    column_name: 'editor_id',
    data_type: 'uuid',
    full_data_type: 'uuid',
    udt_name: 'uuid',
    is_nullable: 'NO',
  },
];

const foreignKeyRelation = {
  id: 'child_author_id_fkey',
  name: 'child_author_id_fkey',
  columns: ['author_id'],
  referencedSchema: 'public',
  referencedTable: 'authors',
  referencedColumns: ['id'],
  updateAction: 'RESTRICT' as const,
  deleteAction: 'RESTRICT' as const,
};

function mockSchemaData(
  constraintColumnSets: string[][],
  uniqueConstraints: Array<{
    id: string;
    originalName: string;
    name: string;
    columns: string[];
  }> = [],
  referencedCandidateKeys: CandidateKey[] = [
    {
      id: 'p:authors_pkey',
      name: 'authors_pkey',
      kind: 'primaryKey',
      columns: ['id'],
    },
  ],
) {
  mocks.useTableSchemaQuery.mockImplementation(
    (_queryKey: unknown, options: { table?: string }) =>
      options.table === 'authors'
        ? {
            data: {
              columns: [{ column_name: 'id' }],
              foreignKeyRelations: [],
              candidateKeys: referencedCandidateKeys,
              constraintColumnSets: [['id']],
              uniqueConstraints: [],
              error: null,
            },
            status: 'success',
            error: null,
          }
        : {
            data: {
              columns,
              foreignKeyRelations: [foreignKeyRelation],
              constraintColumnSets,
              uniqueConstraints,
              error: null,
            },
            status: 'success',
            error: null,
          },
  );
}

async function editAndSaveForeignKey() {
  await TestUserEvent.fireClickEvent(
    await screen.findByRole('button', { name: 'Edit' }),
  );
  await TestUserEvent.fireClickEvent(
    await screen.findByTestId('foreignKeyFormSubmitButton'),
  );
  await waitFor(() => {
    expect(
      screen.queryByTestId('foreignKeyFormSubmitButton'),
    ).not.toBeInTheDocument();
  });
  await TestUserEvent.fireClickEvent(
    screen.getByRole('button', { name: 'Save' }),
  );
  await waitFor(() => {
    expect(mocks.updateTable).toHaveBeenCalledTimes(1);
  });

  return mocks.updateTable.mock.calls[0][0].updatedTable.foreignKeyRelations[0];
}

describe('EditTableForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPointerEvent();
  });
  it('keeps the loading fallback while schema data is unavailable', () => {
    mocks.useTableSchemaQuery.mockReturnValue({
      data: undefined,
      status: 'loading',
      error: null,
    });

    render(<EditTableForm schema="public" tableName="children" />);

    expect(screen.getByText('Loading columns...')).toBeInTheDocument();
  });

  it('initializes and serializes loaded UNIQUE constraints from type-u metadata only', async () => {
    mockSchemaData(
      [],
      [
        {
          id: 'u:children_author_key',
          originalName: 'Children Author Key',
          name: 'Children Author Key',
          columns: ['author_id'],
        },
      ],
    );

    render(<EditTableForm schema="public" tableName="children" />);

    expect(await screen.findByTestId('columns.0.isUnique')).toBeChecked();
    expect(screen.getByTestId('columns.1.isUnique')).not.toBeChecked();
    await TestUserEvent.fireClickEvent(
      screen.getByRole('button', { name: 'Save' }),
    );
    await waitFor(() => expect(mocks.updateTable).toHaveBeenCalledTimes(1));

    expect(
      mocks.updateTable.mock.calls[0][0].updatedTable.uniqueConstraints,
    ).toEqual([
      {
        id: 'u:children_author_key',
        originalName: 'Children Author Key',
        name: 'Children Author Key',
        columns: ['author_id'],
      },
    ]);
  });

  it('ignores coarse column uniqueness without type-u metadata', async () => {
    mocks.useTableSchemaQuery.mockReturnValue({
      data: {
        columns: [{ ...columns[0], is_unique: true }, columns[1]],
        foreignKeyRelations: [foreignKeyRelation],
        constraintColumnSets: [['author_id']],
        uniqueConstraints: [],
        error: null,
      },
      status: 'success',
      error: null,
    });

    render(<EditTableForm schema="public" tableName="children" />);

    expect(await screen.findByTestId('columns.0.isUnique')).not.toBeChecked();
  });

  it('surfaces a PostgreSQL RESTRICT error from the update unchanged', async () => {
    const restrictErrorMessage =
      'cannot drop constraint "children_author_id_key" on table "children" because other objects depend on it';
    mocks.updateTable.mockRejectedValueOnce(new Error(restrictErrorMessage));
    mockSchemaData([]);

    render(<EditTableForm schema="public" tableName="children" />);

    await TestUserEvent.fireClickEvent(
      await screen.findByRole('button', { name: 'Save' }),
    );

    expect(await screen.findByText(restrictErrorMessage)).toBeInTheDocument();
  });

  it('persists oneToOne: true for an exact standalone-index column set on edit', async () => {
    mockSchemaData([['author_id']]);

    render(<EditTableForm schema="public" tableName="children" />);

    const relation = await editAndSaveForeignKey();

    expect(relation.oneToOne).toBe(true);
  });

  it('persists oneToOne: false for a strict subset of a composite index on edit', async () => {
    mockSchemaData([['author_id', 'editor_id']]);

    render(<EditTableForm schema="public" tableName="children" />);

    const relation = await editAndSaveForeignKey();

    expect(relation.oneToOne).toBe(false);
  });

  it('round-trips an embedded index-backed legacy foreign key', async () => {
    mockSchemaData(
      [],
      [],
      [
        {
          id: 'i:authors_id_idx',
          name: 'authors_id_idx',
          kind: 'standaloneUniqueIndex',
          columns: ['id'],
        },
      ],
    );

    render(<EditTableForm schema="public" tableName="children" />);

    const relation = await editAndSaveForeignKey();

    expect(relation).toMatchObject({
      columns: ['author_id'],
      referencedColumns: ['id'],
      referencedSchema: 'public',
      referencedTable: 'authors',
    });
  });
});
