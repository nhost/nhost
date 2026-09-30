import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { NormalizedQueryDataRow } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { mockMatchMediaValue, mockRouter } from '@/tests/mocks';
import hasuraMetadataQuery from '@/tests/msw/mocks/rest/hasuraMetadataQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { queryClient, render, screen, TestUserEvent } from '@/tests/testUtils';
import { createDataGridColumn, extractColumnMetadata } from './DataBrowserGrid';
import DataBrowserGridContainer from './DataBrowserGridContainer';

vi.mock('next/router', () => ({
  useRouter: () => ({
    ...mockRouter,
    query: {
      ...mockRouter.query,
      dataSourceSlug: 'default',
      schemaSlug: 'public',
      tableSlug: 'records',
    },
  }),
}));

function makeColumn(
  overrides: Partial<NormalizedQueryDataRow> = {},
): NormalizedQueryDataRow {
  return {
    column_name: 'col',
    data_type: 'text',
    udt_name: 'text',
    full_data_type: 'text',
    is_primary: false,
    is_nullable: 'YES',
    column_default: null,
    ...overrides,
  };
}

describe('extractColumnMetadata', () => {
  it.each([
    ['timestamp with time zone', 'timestamptz'],
    ['time with time zone', 'timetz'],
  ])(
    'derives canonical baseType from FORMAT_TYPE %s, not udt_name %s',
    (fullDataType, udtName) => {
      const metadata = extractColumnMetadata(
        makeColumn({
          data_type: fullDataType,
          full_data_type: fullDataType,
          udt_name: udtName,
        }),
      );

      expect(metadata.specificType).toBe(fullDataType);
      expect(metadata.baseType).toBe(fullDataType);
      expect(metadata.displayType).toBe(udtName);
    },
  );
});

describe('createDataGridColumn — enableSorting', () => {
  it.each([
    ['point'],
    ['line'],
    ['lseg'],
    ['box'],
    ['path'],
    ['polygon'],
    ['circle'],
    ['json'],
    ['xml'],
  ])('disables sorting for unsortable type %s', (type) => {
    const column = createDataGridColumn(
      makeColumn({ data_type: type, udt_name: type }),
    );
    expect(column.enableSorting).toBe(false);
  });

  it.each([
    ['text', 'text'],
    ['integer', 'int4'],
    ['boolean', 'bool'],
    ['uuid', 'uuid'],
    ['jsonb', 'jsonb'],
    ['timestamp with time zone', 'timestamptz'],
  ])('keeps sorting enabled for sortable type %s', (dataType, udtName) => {
    const column = createDataGridColumn(
      makeColumn({ data_type: dataType, udt_name: udtName }),
    );
    expect(column.enableSorting).toBe(true);
  });
});

describe('Clone row', () => {
  const server = setupServer(tokenQuery, hasuraMetadataQuery);

  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn(mockMatchMediaValue),
    });
    HTMLElement.prototype.scrollTo = vi.fn();
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    server.resetHandlers();
    queryClient.clear();
  });

  afterAll(() => server.close());

  function tuples(rows: unknown[]) {
    return {
      result_type: 'TuplesOk',
      result: [['row_to_json'], ...rows.map((row) => [JSON.stringify(row)])],
    };
  }

  async function openClone(
    columns: NormalizedQueryDataRow[],
    row: Record<string, string>,
  ) {
    server.use(
      http.post(
        'https://local.hasura.local.nhost.run/v2/query',
        async ({ request }) => {
          const { args } = (await request.json()) as {
            args: { args: { sql: string } }[];
          };
          const { sql } = args[0].args;

          if (sql.includes('information_schema.schemata')) {
            return HttpResponse.json([
              tuples([]),
              tuples([
                {
                  table_schema: 'public',
                  table_name: 'records',
                  table_type: 'ORDINARY TABLE',
                },
              ]),
              tuples([]),
            ]);
          }

          if (sql.includes('INFORMATION_SCHEMA.COLUMNS')) {
            return HttpResponse.json([tuples(columns), tuples([])]);
          }

          return HttpResponse.json([
            tuples([row]),
            { result_type: 'TuplesOk', result: [['count'], ['1']] },
          ]);
        },
      ),
    );

    render(<DataBrowserGridContainer />);
    await new TestUserEvent().click(
      await screen.findByRole('button', { name: 'Clone row' }),
    );
    await screen.findByRole('button', { name: 'Insert' }, { timeout: 5000 });
  }

  it('keeps primary and unique columns without defaults', async () => {
    await openClone(
      [
        makeColumn({ column_name: 'id', is_primary: true }),
        makeColumn({ column_name: 'code', is_unique: true }),
      ],
      { id: '1', code: 'A' },
    );

    expect(screen.getByLabelText(/^id/)).toHaveValue('1');
    expect(screen.getByLabelText(/^code/)).toHaveValue('A');
  });

  it('clears primary and unique columns with defaults', async () => {
    await openClone(
      [
        makeColumn({
          column_name: 'id',
          is_primary: true,
          column_default: 'gen_random_uuid()',
        }),
        makeColumn({
          column_name: 'code',
          is_unique: true,
          column_default: 'gen_random_uuid()',
        }),
      ],
      { id: '1', code: 'A' },
    );

    expect(screen.getByLabelText(/^id/)).toHaveValue('');
    expect(screen.getByLabelText(/^code/)).toHaveValue('');
  });

  it('clears identity columns', async () => {
    await openClone([makeColumn({ is_identity: 'YES' })], { col: '1' });

    expect(screen.getByLabelText(/^col/)).toHaveValue('');
  });

  it('keeps non-key columns with defaults', async () => {
    await openClone([makeColumn({ column_default: "'PENDING'::text" })], {
      col: 'APPROVED',
    });

    expect(screen.getByLabelText(/^col/)).toHaveValue('APPROVED');
  });
});
