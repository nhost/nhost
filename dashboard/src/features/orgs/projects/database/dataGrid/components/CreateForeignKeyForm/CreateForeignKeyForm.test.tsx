/** biome-ignore-all lint/suspicious/noExplicitAny: test mock */
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import type { DatabaseColumn } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';
import CreateForeignKeyForm from './CreateForeignKeyForm';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

function databaseResult() {
  return {
    result_type: 'TuplesOk',
    result: [['data'], [JSON.stringify({ schema_name: 'public' })]],
  };
}

function tableLikeObjectsResult() {
  return {
    result_type: 'TuplesOk',
    result: [
      ['data'],
      [
        JSON.stringify({
          table_schema: 'public',
          table_name: 'authors',
          table_type: 'ORDINARY TABLE',
          updatability: 1,
        }),
      ],
    ],
  };
}

function functionsResult() {
  return { result_type: 'TuplesOk', result: [['data']] };
}

function authorsColumnsResult() {
  return {
    result_type: 'TuplesOk',
    result: [
      ['row_to_json'],
      [
        JSON.stringify({
          table_schema: 'public',
          table_name: 'authors',
          column_name: 'id',
          ordinal_position: 1,
          data_type: 'uuid',
          udt_name: 'uuid',
          is_primary: true,
          is_unique: true,
        }),
      ],
      [
        JSON.stringify({
          table_schema: 'public',
          table_name: 'authors',
          column_name: 'uuid',
          ordinal_position: 2,
          data_type: 'uuid',
          udt_name: 'uuid',
          is_primary: false,
          is_unique: false,
        }),
      ],
    ],
  };
}

function authorsConstraintsResult() {
  return {
    result_type: 'TuplesOk',
    result: [
      ['row_to_json'],
      [
        JSON.stringify({
          constraint_name: 'authors_pkey',
          constraint_type: 'p',
          constraint_definition: 'PRIMARY KEY (id)',
          column_name: 'id',
        }),
      ],
    ],
  };
}

const databaseAndTableQuery = http.post(
  'https://local.hasura.local.nhost.run/v2/query',
  async ({ request }) => {
    const body = (await request.json()) as any;
    const firstSql: string = body?.args?.[0]?.args?.sql ?? '';

    if (/information_schema.schemata/i.test(firstSql)) {
      return HttpResponse.json([
        databaseResult(),
        tableLikeObjectsResult(),
        functionsResult(),
      ]);
    }

    if (/table_name = 'authors'/i.test(firstSql)) {
      return HttpResponse.json([
        authorsColumnsResult(),
        authorsConstraintsResult(),
      ]);
    }

    return HttpResponse.json([]);
  },
);

const server = setupServer(tokenQuery, databaseAndTableQuery);

const availableColumns: DatabaseColumn[] = [
  { name: 'author_id', type: 'uuid' },
  { name: 'editor_id', type: 'uuid' },
];

async function selectOption(combobox: HTMLElement, optionName: string) {
  const user = new TestUserEvent();
  await user.click(combobox);
  await user.click(await screen.findByRole('option', { name: optionName }));
}

function getColumnPairRows(): HTMLElement[] {
  return screen
    .getAllByRole('button', { name: 'Remove column pair' })
    .map((button) => button.parentElement as HTMLElement);
}

function getPairComboboxes(row: HTMLElement) {
  const [fromSelect, toSelect] = within(row).getAllByRole('combobox');
  return { fromSelect, toSelect };
}

describe('CreateForeignKeyForm', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_ENV = 'dev';
    server.listen();
  });

  beforeEach(() => {
    mockPointerEvent();
    mocks.useRouter.mockReturnValue({
      basePath: '',
      pathname: '/orgs/xyz/projects/test-project',
      route: '/orgs/[orgSlug]/projects/[appSubdomain]',
      asPath: '/orgs/xyz/projects/test-project',
      isLocaleDomain: false,
      isReady: true,
      isPreview: false,
      query: {
        orgSlug: 'xyz',
        appSubdomain: 'test-project',
        dataSourceSlug: 'default',
      },
      push: vi.fn(),
      replace: vi.fn(),
      reload: vi.fn(),
      back: vi.fn(),
      prefetch: vi.fn(),
      beforePopState: vi.fn(),
      events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
      isFallback: false,
      forward: vi.fn(),
    });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it('submits a composite foreign key as parallel columns/referencedColumns arrays', async () => {
    const onSubmit = vi.fn();
    const user = new TestUserEvent();

    render(
      <CreateForeignKeyForm
        availableColumns={availableColumns}
        onSubmit={onSubmit}
      />,
    );

    await selectOption(
      screen.getByRole('combobox', { name: 'Schema' }),
      'public',
    );
    await selectOption(
      screen.getByRole('combobox', { name: 'Table' }),
      'authors',
    );

    await waitFor(() => {
      expect(getColumnPairRows()).toHaveLength(1);
    });

    const firstPair = getPairComboboxes(getColumnPairRows()[0]);
    await selectOption(firstPair.fromSelect, 'author_id');
    await selectOption(firstPair.toSelect, 'id');

    await user.click(screen.getByRole('button', { name: /add column pair/i }));

    await waitFor(() => {
      expect(getColumnPairRows()).toHaveLength(2);
    });

    const secondPair = getPairComboboxes(getColumnPairRows()[1]);
    await selectOption(secondPair.fromSelect, 'editor_id');
    await selectOption(secondPair.toSelect, 'uuid');

    await TestUserEvent.fireClickEvent(
      screen.getByTestId('foreignKeyFormSubmitButton'),
    );

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    const values = onSubmit.mock.calls[0][0];
    expect(values.columns).toEqual(['author_id', 'editor_id']);
    expect(values.referencedColumns).toEqual(['id', 'uuid']);
    expect(values.referencedSchema).toBe('public');
    expect(values.referencedTable).toBe('authors');
  });

  it('disables removing the only pair and adds/removes additional pairs', async () => {
    const user = new TestUserEvent();

    render(<CreateForeignKeyForm availableColumns={availableColumns} />);

    await waitFor(() => {
      expect(getColumnPairRows()).toHaveLength(1);
    });

    const removeButtons = screen.getAllByRole('button', {
      name: 'Remove column pair',
    });
    expect(removeButtons).toHaveLength(1);
    expect(removeButtons[0]).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /add column pair/i }));

    await waitFor(() => {
      expect(getColumnPairRows()).toHaveLength(2);
    });

    const enabledRemoveButtons = screen.getAllByRole('button', {
      name: 'Remove column pair',
    });
    expect(enabledRemoveButtons).toHaveLength(2);
    for (const button of enabledRemoveButtons) {
      expect(button).toBeEnabled();
    }

    await user.click(enabledRemoveButtons[1]);

    await waitFor(() => {
      expect(getColumnPairRows()).toHaveLength(1);
    });
    expect(
      screen.getByRole('button', { name: 'Remove column pair' }),
    ).toBeDisabled();
  });

  it('blocks submission and shows required-field errors for an empty pair', async () => {
    const onSubmit = vi.fn();

    render(
      <CreateForeignKeyForm
        availableColumns={availableColumns}
        onSubmit={onSubmit}
      />,
    );

    await waitFor(() => {
      expect(getColumnPairRows()).toHaveLength(1);
    });

    await TestUserEvent.fireClickEvent(
      screen.getByTestId('foreignKeyFormSubmitButton'),
    );

    await waitFor(() => {
      expect(
        screen.getAllByText('This field is required.').length,
      ).toBeGreaterThan(0);
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits oneToOne: false when the column is only part of a composite unique index', async () => {
    const onSubmit = vi.fn();

    render(
      <CreateForeignKeyForm
        availableColumns={[
          { name: 'author_id', type: 'uuid', isUnique: true },
          { name: 'editor_id', type: 'uuid' },
        ]}
        constraintColumnSets={[['author_id', 'editor_id']]}
        onSubmit={onSubmit}
      />,
    );

    await selectOption(
      screen.getByRole('combobox', { name: 'Schema' }),
      'public',
    );
    await selectOption(
      screen.getByRole('combobox', { name: 'Table' }),
      'authors',
    );

    await waitFor(() => {
      expect(getColumnPairRows()).toHaveLength(1);
    });

    const pair = getPairComboboxes(getColumnPairRows()[0]);
    await selectOption(pair.fromSelect, 'author_id');
    await selectOption(pair.toSelect, 'id');

    await TestUserEvent.fireClickEvent(
      screen.getByTestId('foreignKeyFormSubmitButton'),
    );

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    expect(onSubmit.mock.calls[0][0].oneToOne).toBe(false);
  });

  it('submits oneToOne: true for an exact persisted unique-index set', async () => {
    const onSubmit = vi.fn();

    render(
      <CreateForeignKeyForm
        availableColumns={[
          { name: 'author_id', type: 'uuid' },
          { name: 'editor_id', type: 'uuid' },
        ]}
        constraintColumnSets={[['author_id']]}
        onSubmit={onSubmit}
      />,
    );

    await selectOption(
      screen.getByRole('combobox', { name: 'Schema' }),
      'public',
    );
    await selectOption(
      screen.getByRole('combobox', { name: 'Table' }),
      'authors',
    );

    await waitFor(() => {
      expect(getColumnPairRows()).toHaveLength(1);
    });

    const pair = getPairComboboxes(getColumnPairRows()[0]);
    await selectOption(pair.fromSelect, 'author_id');
    await selectOption(pair.toSelect, 'id');

    await TestUserEvent.fireClickEvent(
      screen.getByTestId('foreignKeyFormSubmitButton'),
    );

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    expect(onSubmit.mock.calls[0][0].oneToOne).toBe(true);
  });

  it('submits oneToOne: true for a unique column when no constraint sets exist yet', async () => {
    const onSubmit = vi.fn();

    render(
      <CreateForeignKeyForm
        availableColumns={[
          { name: 'author_id', type: 'uuid', isUnique: true },
          { name: 'editor_id', type: 'uuid' },
        ]}
        onSubmit={onSubmit}
      />,
    );

    await selectOption(
      screen.getByRole('combobox', { name: 'Schema' }),
      'public',
    );
    await selectOption(
      screen.getByRole('combobox', { name: 'Table' }),
      'authors',
    );

    await waitFor(() => {
      expect(getColumnPairRows()).toHaveLength(1);
    });

    const pair = getPairComboboxes(getColumnPairRows()[0]);
    await selectOption(pair.fromSelect, 'author_id');
    await selectOption(pair.toSelect, 'id');

    await TestUserEvent.fireClickEvent(
      screen.getByTestId('foreignKeyFormSubmitButton'),
    );

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    expect(onSubmit.mock.calls[0][0].oneToOne).toBe(true);
  });
});
