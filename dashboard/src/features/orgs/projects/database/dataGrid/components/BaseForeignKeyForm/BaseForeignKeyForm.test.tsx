import { yupResolver } from '@hookform/resolvers/yup';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { FormProvider, useForm } from 'react-hook-form';
import { vi } from 'vitest';
import type * as Yup from 'yup';
import { normalizeTableConstraints } from '@/features/orgs/projects/database/common/utils/normalizeTableConstraints';
import type { DatabaseColumn } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getProjectQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  mockScrollIntoViewAndPointerCapture,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import BaseForeignKeyForm, {
  baseForeignKeyValidationSchema,
} from './BaseForeignKeyForm';

const mocks = vi.hoisted(() => ({
  onSubmit: vi.fn(),
}));

const countyQuery = http.post(
  'https://local.hasura.local.nhost.run/v2/query',
  async ({ request }) => {
    // biome-ignore lint/suspicious/noExplicitAny: mock request body
    const body = (await request.json()) as any;
    const sql: string = body?.args?.[0]?.args?.sql ?? '';

    if (sql.includes('information_schema.schemata')) {
      return HttpResponse.json([
        {
          result_type: 'TuplesOk',
          result: [['row_to_json'], ['{"schema_name":"public"}']],
        },
        {
          result_type: 'TuplesOk',
          result: [
            ['row_to_json'],
            '{"table_schema":"public","table_name":"county","table_type":"ORDINARY TABLE","updatability":true}',
          ],
        },
        { result_type: 'TuplesOk', result: [['row_to_json']] },
      ]);
    }

    return HttpResponse.json([
      {
        result_type: 'TuplesOk',
        result: [
          ['row_to_json'],
          '{"table_schema":"public","table_name":"county","column_name":"id","ordinal_position":1,"data_type":"uuid","udt_name":"uuid","is_nullable":"NO","is_identity":"NO","is_primary":true,"is_unique":false}',
          '{"table_schema":"public","table_name":"county","column_name":"region","ordinal_position":2,"data_type":"text","udt_name":"text","is_nullable":"NO","is_identity":"NO","is_primary":false,"is_unique":true}',
          '{"table_schema":"public","table_name":"county","column_name":"code","ordinal_position":3,"data_type":"text","udt_name":"text","is_nullable":"NO","is_identity":"NO","is_primary":false,"is_unique":true}',
        ],
      },
      {
        result_type: 'TuplesOk',
        result: [
          ['row_to_json'],
          '{"constraint_name":"county_pkey","constraint_type":"p","constraint_definition":"PRIMARY KEY (id)","column_name":"id"}',
          '{"constraint_name":"county_region_code_key","constraint_type":"u","constraint_definition":"UNIQUE (region, code)","column_name":"region"}',
          '{"constraint_name":"county_region_code_key","constraint_type":"u","constraint_definition":"UNIQUE (region, code)","column_name":"code"}',
        ],
      },
    ]);
  },
);

const server = setupServer(tokenQuery, getProjectQuery, countyQuery);

const availableColumns: DatabaseColumn[] = [
  { name: 'id', type: 'uuid', isPrimary: true },
  { name: 'county_region', type: 'text' },
  { name: 'county_code', type: 'text' },
];

const defaultFormValues: Yup.InferType<typeof baseForeignKeyValidationSchema> =
  {
    columns: [],
    referencedSchema: 'public',
    referencedTable: 'county',
    referencedKeyName: '',
    referencedColumns: [],
    updateAction: 'RESTRICT',
    deleteAction: 'RESTRICT',
  };

function TestWrapper({
  columns = availableColumns,
}: {
  columns?: DatabaseColumn[];
}) {
  const form = useForm<Yup.InferType<typeof baseForeignKeyValidationSchema>>({
    defaultValues: defaultFormValues,
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseForeignKeyValidationSchema),
  });

  return (
    <FormProvider {...form}>
      <BaseForeignKeyForm
        availableColumns={columns}
        onSubmit={mocks.onSubmit}
      />
    </FormProvider>
  );
}

function introspectOneToOne(
  rawColumns: Record<string, unknown>[],
  rawConstraints: Record<string, unknown>[],
) {
  const { foreignKeyRelations } = normalizeTableConstraints(
    rawColumns.map((column) => JSON.stringify(column)),
    rawConstraints.map((constraint) => JSON.stringify(constraint)),
    'public',
  );

  return foreignKeyRelations[0].oneToOne;
}

async function selectOption(
  user: TestUserEvent,
  label: string,
  option: string,
) {
  await user.click(await screen.findByRole('combobox', { name: label }));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('BaseForeignKeyForm', () => {
  beforeAll(() => {
    server.listen();
  });

  beforeEach(() => {
    mockScrollIntoViewAndPointerCapture();
    mocks.onSubmit.mockReset();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it('lists the candidate keys of the referenced table as options', async () => {
    render(<TestWrapper />);

    const user = new TestUserEvent();
    await user.click(
      await screen.findByRole('combobox', { name: 'Referenced key' }),
    );

    expect(
      await screen.findByRole('option', {
        name: 'PRIMARY KEY county_pkey (id)',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', {
        name: 'UNIQUE county_region_code_key (region, code)',
      }),
    ).toBeInTheDocument();
  });

  it('shows a validation message when no referenced key is selected', async () => {
    render(<TestWrapper />);
    const user = new TestUserEvent();

    await screen.findByRole('combobox', { name: 'Referenced key' });
    await user.click(screen.getByTestId('foreignKeyFormSubmitButton'));

    expect(
      await screen.findByText('Select a referenced key.'),
    ).toBeInTheDocument();
    expect(mocks.onSubmit).not.toHaveBeenCalled();
  });

  it('renders one local column select per column of the selected key', async () => {
    render(<TestWrapper />);

    const user = new TestUserEvent();
    await selectOption(
      user,
      'Referenced key',
      'UNIQUE county_region_code_key (region, code)',
    );

    expect(
      await screen.findByRole('combobox', { name: 'Local column for region' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Local column for code' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Local column for id' }),
    ).not.toBeInTheDocument();
  });

  it('submits columns and referencedColumns as arrays in key order', async () => {
    render(<TestWrapper />);

    const user = new TestUserEvent();
    await selectOption(
      user,
      'Referenced key',
      'UNIQUE county_region_code_key (region, code)',
    );
    await selectOption(user, 'Local column for region', 'county_region');
    await selectOption(user, 'Local column for code', 'county_code');
    await user.click(screen.getByTestId('foreignKeyFormSubmitButton'));

    await waitFor(() => {
      expect(mocks.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          columns: ['county_region', 'county_code'],
          referencedColumns: ['region', 'code'],
          referencedKeyName: 'county_region_code_key',
          referencedSchema: 'public',
          referencedTable: 'county',
          oneToOne: false,
        }),
      );
    });
  });

  it('round-trips oneToOne for a member of a composite primary key', async () => {
    render(
      <TestWrapper
        columns={[
          {
            name: 'region_code',
            type: 'text',
            isPrimary: true,
            isUnique: true,
          },
          { name: 'dept_code', type: 'text', isPrimary: true, isUnique: true },
        ]}
      />,
    );

    const user = new TestUserEvent();
    await selectOption(user, 'Referenced key', 'PRIMARY KEY county_pkey (id)');
    await selectOption(user, 'Local column for id', 'region_code');
    await user.click(screen.getByTestId('foreignKeyFormSubmitButton'));

    await waitFor(() => {
      expect(mocks.onSubmit).toHaveBeenCalled();
    });

    const introspected = introspectOneToOne(
      [
        {
          column_name: 'region_code',
          ordinal_position: 1,
          is_primary: true,
          is_unique: true,
        },
        {
          column_name: 'dept_code',
          ordinal_position: 2,
          is_primary: true,
          is_unique: true,
        },
      ],
      [
        {
          constraint_name: 'dept_pkey',
          constraint_type: 'p',
          column_name: 'region_code',
          constraint_definition: 'PRIMARY KEY (region_code, dept_code)',
        },
        {
          constraint_name: 'dept_region_fkey',
          constraint_type: 'f',
          column_name: 'region_code',
          constraint_definition:
            'FOREIGN KEY (region_code) REFERENCES county(id)',
        },
      ],
    );

    expect(mocks.onSubmit.mock.calls[0][0].oneToOne).toBe(false);
    expect(introspected).toBe(false);
  });

  it('round-trips oneToOne for a composite key partially covering a unique constraint', async () => {
    render(
      <TestWrapper
        columns={[
          {
            name: 'a',
            type: 'text',
            isUnique: true,
            uniqueConstraints: ['ab_key'],
          },
          {
            name: 'b',
            type: 'text',
            isUnique: true,
            uniqueConstraints: ['ab_key'],
          },
          { name: 'c', type: 'text' },
        ]}
      />,
    );

    const user = new TestUserEvent();
    await selectOption(
      user,
      'Referenced key',
      'UNIQUE county_region_code_key (region, code)',
    );
    await selectOption(user, 'Local column for region', 'a');
    await selectOption(user, 'Local column for code', 'c');
    await user.click(screen.getByTestId('foreignKeyFormSubmitButton'));

    await waitFor(() => {
      expect(mocks.onSubmit).toHaveBeenCalled();
    });

    const introspected = introspectOneToOne(
      [
        { column_name: 'a', ordinal_position: 1, is_unique: true },
        { column_name: 'b', ordinal_position: 2, is_unique: true },
        { column_name: 'c', ordinal_position: 3 },
      ],
      [
        {
          constraint_name: 'ab_key',
          constraint_type: 'u',
          column_name: 'a',
          constraint_definition: 'UNIQUE (a, b)',
        },
        {
          constraint_name: 'ac_fkey',
          constraint_type: 'f',
          column_name: 'a',
          constraint_definition:
            'FOREIGN KEY (a, c) REFERENCES county(region, code)',
        },
      ],
    );

    expect(mocks.onSubmit.mock.calls[0][0].oneToOne).toBe(false);
    expect(introspected).toBe(false);
  });

  it('reports one-to-one when the local columns cover the whole primary key', async () => {
    render(<TestWrapper />);

    const user = new TestUserEvent();
    await selectOption(user, 'Referenced key', 'PRIMARY KEY county_pkey (id)');
    await selectOption(user, 'Local column for id', 'id');
    await user.click(screen.getByTestId('foreignKeyFormSubmitButton'));

    await waitFor(() => {
      expect(mocks.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          columns: ['id'],
          referencedColumns: ['id'],
          oneToOne: true,
        }),
      );
    });
  });
});
