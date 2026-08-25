import { setupServer } from 'msw/node';
import { CreateForeignKeyForm } from '@/features/orgs/projects/database/dataGrid/components/CreateForeignKeyForm';
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

async function selectReferencedTable() {
  await selectOption(
    screen.getByRole('combobox', { name: 'Schema' }),
    'public',
  );
  await selectOption(
    screen.getByRole('combobox', { name: 'Table' }),
    'authors',
  );
}

describe('CreateForeignKeyForm', () => {
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

  it('offers primary and UNIQUE constraints but excludes standalone indexes', async () => {
    render(
      <CreateForeignKeyForm
        availableColumns={availableColumns}
        constraintColumnSets={[]}
      />,
    );
    await selectReferencedTable();

    const keySelect = screen.getByRole('combobox', { name: 'Referenced key' });
    const user = new TestUserEvent();
    await user.click(keySelect);

    expect(
      await screen.findByRole('option', {
        name: 'PRIMARY KEY authors_pkey (id)',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('option', {
        name: 'UNIQUE authors_id_uuid_key (id, uuid)',
      }),
    ).toBeVisible();
    expect(screen.queryByText(/authors_uuid_idx/)).not.toBeInTheDocument();
  });

  it('offers a draft table and its composite key for self-references', async () => {
    render(
      <CreateForeignKeyForm
        availableColumns={availableColumns}
        constraintColumnSets={[]}
        draftReferencedTable={{
          schema: 'public',
          name: 'comments',
          candidateKeys: [
            {
              id: 'form-primary-key',
              name: 'comments_pkey',
              kind: 'primaryKey',
              columns: ['author_id', 'editor_id'],
            },
          ],
        }}
      />,
    );

    await selectOption(
      screen.getByRole('combobox', { name: 'Table' }),
      'comments',
    );
    await selectOption(
      screen.getByRole('combobox', { name: 'Referenced key' }),
      'PRIMARY KEY comments_pkey (author_id, editor_id)',
    );

    expect(
      screen.getByRole('combobox', { name: 'Local column for author_id' }),
    ).toBeVisible();
    expect(
      screen.getByRole('combobox', { name: 'Local column for editor_id' }),
    ).toBeVisible();
  });

  it('selects a composite key atomically and submits fixed referenced order', async () => {
    const onSubmit = vi.fn();
    render(
      <CreateForeignKeyForm
        availableColumns={availableColumns}
        constraintColumnSets={[]}
        onSubmit={onSubmit}
      />,
    );
    await selectReferencedTable();
    await selectOption(
      screen.getByRole('combobox', { name: 'Referenced key' }),
      'UNIQUE authors_id_uuid_key (id, uuid)',
    );

    expect(screen.getByText('id', { selector: 'div' })).toBeVisible();
    expect(screen.getByText('uuid', { selector: 'div' })).toBeVisible();

    await selectOption(
      screen.getByRole('combobox', { name: 'Local column for id' }),
      'author_id',
    );
    await selectOption(
      screen.getByRole('combobox', { name: 'Local column for uuid' }),
      'editor_id',
    );
    await TestUserEvent.fireClickEvent(
      screen.getByTestId('foreignKeyFormSubmitButton'),
    );

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      columns: ['author_id', 'editor_id'],
      referencedColumns: ['id', 'uuid'],
      referencedSchema: 'public',
      referencedTable: 'authors',
    });
  });

  it('resets mappings when the selected key changes', async () => {
    render(
      <CreateForeignKeyForm
        availableColumns={availableColumns}
        constraintColumnSets={[]}
      />,
    );
    await selectReferencedTable();
    await selectOption(
      screen.getByRole('combobox', { name: 'Referenced key' }),
      'UNIQUE authors_id_uuid_key (id, uuid)',
    );
    await selectOption(
      screen.getByRole('combobox', { name: 'Local column for id' }),
      'author_id',
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

  it('blocks incomplete mappings and computes one-to-one unchanged', async () => {
    const onSubmit = vi.fn();
    render(
      <CreateForeignKeyForm
        availableColumns={availableColumns}
        constraintColumnSets={[['author_id']]}
        onSubmit={onSubmit}
      />,
    );
    await selectReferencedTable();
    await selectOption(
      screen.getByRole('combobox', { name: 'Referenced key' }),
      'PRIMARY KEY authors_pkey (id)',
    );

    await TestUserEvent.fireClickEvent(
      screen.getByTestId('foreignKeyFormSubmitButton'),
    );
    await waitFor(() =>
      expect(screen.getByText('This field is required.')).toBeVisible(),
    );
    expect(onSubmit).not.toHaveBeenCalled();

    await selectOption(
      screen.getByRole('combobox', { name: 'Local column for id' }),
      'author_id',
    );
    await TestUserEvent.fireClickEvent(
      screen.getByTestId('foreignKeyFormSubmitButton'),
    );
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].oneToOne).toBe(true);
  });
});
