/** biome-ignore-all lint/suspicious/noExplicitAny: test mock */
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import EditForeignKeyForm from '@/features/orgs/projects/database/dataGrid/components/EditForeignKeyForm/EditForeignKeyForm';
import type { DatabaseColumn } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  mockPointerEvent,
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';

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
          column_ordinality: 1,
        }),
      ],
      [
        JSON.stringify({
          constraint_name: 'authors_id_uuid_key',
          constraint_type: 'u',
          column_name: 'id',
          column_ordinality: 1,
        }),
      ],
      [
        JSON.stringify({
          constraint_name: 'authors_id_uuid_key',
          constraint_type: 'u',
          column_name: 'uuid',
          column_ordinality: 2,
        }),
      ],
      [
        JSON.stringify({
          constraint_name: 'authors_uuid_idx',
          constraint_type: 'i',
          column_name: 'uuid',
          column_ordinality: 1,
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

const router = {
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
};

describe('EditForeignKeyForm', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_ENV = 'dev';
    server.listen();
  });
  beforeEach(() => {
    mockPointerEvent();
    mocks.useRouter.mockReturnValue(router);
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

  it('round-trips an index-backed legacy target while allowing local and action edits', async () => {
    const onSubmit = vi.fn();
    render(
      <EditForeignKeyForm
        availableColumns={availableColumns}
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
      ).toHaveTextContent('Legacy unique index authors_uuid_idx'),
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
