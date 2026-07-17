import { vi } from 'vitest';
import EditTableForm from '@/features/orgs/projects/database/dataGrid/components/EditTableForm/EditTableForm';
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
  () => ({
    useUpdateTableMutation: () => ({
      mutateAsync: mocks.updateTable,
      error: null,
      reset: vi.fn(),
    }),
  }),
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

function mockSchemaData(constraintColumnSets: string[][]) {
  mocks.useTableSchemaQuery.mockImplementation(
    (_queryKey: unknown, options: { table?: string }) =>
      options.table === 'authors'
        ? {
            data: {
              columns: [{ column_name: 'id' }],
              foreignKeyRelations: [],
              constraintColumnSets: [['id']],
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
});
