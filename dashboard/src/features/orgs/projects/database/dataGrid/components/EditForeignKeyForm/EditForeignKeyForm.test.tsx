import { setupServer } from 'msw/node';
import { EditForeignKeyForm } from '@/features/orgs/projects/database/dataGrid/components/EditForeignKeyForm';
import {
  foreignKeyFormAvailableColumns as availableColumns,
  databaseAndTableQuery,
  selectOption,
} from '@/tests/msw/mocks/rest/foreignKeyFormQueries';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  mockPointerEvent,
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';

const server = setupServer(tokenQuery, databaseAndTableQuery);

describe('EditForeignKeyForm', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_ENV = 'dev';
    server.listen();
  });
  beforeEach(() => {
    mockPointerEvent();
  });
  afterEach(() => {
    server.resetHandlers();
    queryClient.clear();
  });
  afterAll(() => server.close());

  it('resolves a permuted genuine key without rewriting persisted positional pairing', async () => {
    const onSubmit = vi.fn();
    render(
      <EditForeignKeyForm
        availableColumns={availableColumns}
        constraintColumnSets={[]}
        foreignKeyRelation={{
          id: 'fk-1',
          name: 'posts_authors_fkey',
          columns: ['author_id', 'editor_id'],
          referencedSchema: 'public',
          referencedTable: 'authors',
          referencedColumns: ['uuid', 'id'],
          updateAction: 'RESTRICT',
          deleteAction: 'CASCADE',
        }}
        onSubmit={onSubmit}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Referenced key' }),
      ).toHaveTextContent('authors_id_uuid_key'),
    );
    await TestUserEvent.fireClickEvent(
      screen.getByTestId('foreignKeyFormSubmitButton'),
    );
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      columns: ['author_id', 'editor_id'],
      referencedColumns: ['uuid', 'id'],
      updateAction: 'RESTRICT',
      deleteAction: 'CASCADE',
    });
  });

  it('round-trips an index-backed unmanaged target while allowing local and action edits', async () => {
    const onSubmit = vi.fn();
    render(
      <EditForeignKeyForm
        availableColumns={availableColumns}
        constraintColumnSets={[]}
        foreignKeyRelation={{
          id: 'fk-2',
          columns: ['author_id'],
          referencedSchema: 'public',
          referencedTable: 'authors',
          referencedColumns: ['uuid'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        }}
        onSubmit={onSubmit}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Referenced key' }),
      ).toHaveTextContent('UNIQUE INDEX authors_uuid_idx'),
    );
    await selectOption(
      screen.getByRole('combobox', { name: 'Local column for uuid' }),
      'editor_id',
    );
    await selectOption(
      screen.getByRole('combobox', { name: 'On Delete' }),
      'CASCADE',
    );
    await TestUserEvent.fireClickEvent(
      screen.getByTestId('foreignKeyFormSubmitButton'),
    );

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      columns: ['editor_id'],
      referencedColumns: ['uuid'],
      deleteAction: 'CASCADE',
    });
  });

  it('replaces persisted mappings only after an explicit target switch', async () => {
    render(
      <EditForeignKeyForm
        availableColumns={availableColumns}
        constraintColumnSets={[]}
        foreignKeyRelation={{
          columns: ['author_id', 'editor_id'],
          referencedSchema: 'public',
          referencedTable: 'authors',
          referencedColumns: ['uuid', 'id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        }}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Referenced key' }),
      ).toHaveTextContent('authors_id_uuid_key'),
    );
    await selectOption(
      screen.getByRole('combobox', { name: 'Referenced key' }),
      'PRIMARY KEY authors_pkey (id)',
    );
    expect(
      screen.getByRole('combobox', { name: 'Local column for id' }),
    ).toHaveTextContent('Select a column');
    expect(
      screen.queryByRole('combobox', { name: 'Local column for uuid' }),
    ).not.toBeInTheDocument();
  });
});
