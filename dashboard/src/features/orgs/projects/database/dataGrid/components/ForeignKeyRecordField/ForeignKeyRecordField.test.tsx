import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { FormProvider, useForm } from 'react-hook-form';
import { vi } from 'vitest';
import BaseRecordForm, {
  type BaseRecordFormProps,
} from '@/features/orgs/projects/database/dataGrid/components/BaseRecordForm/BaseRecordForm';
import type {
  DataBrowserColumnMetadata,
  ForeignKeyRelation,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getCreateRecordFormDefaultValues } from '@/features/orgs/projects/database/dataGrid/utils/recordFormValues';
import {
  mockScrollIntoViewAndPointerCapture,
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';

vi.mock('next/router', () => ({
  useRouter: () => ({
    isReady: true,
    query: {
      dataSourceSlug: 'default',
      schemaSlug: 'public',
      tableSlug: 'tasks',
    },
  }),
}));
vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: () => ({
    project: { config: { hasura: { adminSecret: 'test-only' } } },
  }),
}));
vi.mock('@/features/orgs/projects/common/hooks/useAdminApiTarget', () => ({
  useAdminApiTarget: () => ({
    appUrl: 'https://picker.test',
    adminSecret: 'test-only',
  }),
}));

const relation: ForeignKeyRelation = {
  name: 'membership',
  columns: ['team_id', 'user_id'],
  referencedSchema: 'other',
  referencedTable: 'members',
  referencedColumns: ['team', 'user'],
  updateAction: 'NO ACTION',
  deleteAction: 'NO ACTION',
};
const columns: DataBrowserColumnMetadata[] = [
  {
    id: 'team_id',
    specificType: 'bigint',
    baseType: 'bigint',
    displayType: 'bigint',
    isArray: false,
    isNullable: false,
    isPrimary: true,
  },
  {
    id: 'user_id',
    specificType: 'integer',
    baseType: 'integer',
    displayType: 'integer',
    isArray: false,
    isNullable: true,
    defaultValue: '1',
  },
  {
    id: 'description',
    specificType: 'text',
    baseType: 'text',
    displayType: 'text',
    isArray: false,
    isNullable: true,
  },
];
let rowRequests: string[] = [];
let failRows = false;
let noRows = false;
const result = (rows: unknown[] = []) => ({
  result_type: 'TuplesOk',
  result: [['row_to_json'], ...rows.map((row) => [JSON.stringify(row)])],
});
const server = setupServer(
  http.post('https://picker.test/v2/query', async ({ request }) => {
    const body = (await request.json()) as {
      type: string;
      args: { args: { sql: string } }[] | { sql: string };
    };
    if (Array.isArray(body.args)) {
      if (body.args[0].args.sql.includes('information_schema.schemata')) {
        return HttpResponse.json([result(), result(), result()]);
      }
      return HttpResponse.json([
        result([
          {
            column_name: 'team',
            ordinal_position: 1,
            full_data_type: 'bigint',
          },
          {
            column_name: 'user',
            ordinal_position: 2,
            full_data_type: 'integer',
          },
          { column_name: 'name', ordinal_position: 3, full_data_type: 'text' },
          {
            column_name: 'password',
            ordinal_position: 4,
            full_data_type: 'text',
          },
        ]),
        result(),
      ]);
    }
    rowRequests.push(body.args.sql);
    if (failRows) {
      return HttpResponse.json({ error: 'not permitted' }, { status: 403 });
    }
    if (noRows) {
      return HttpResponse.json(result());
    }
    return HttpResponse.json(
      result([
        { key_0: '9007199254740993', key_1: '11', label: 'Alice' },
        { key_0: '4', key_1: '12', label: 'Bob' },
      ]),
    );
  }),
);

function Harness({
  relations = [relation],
  fieldColumns = columns,
  onSubmit = vi.fn(async () => {}),
}: {
  relations?: ForeignKeyRelation[];
  fieldColumns?: DataBrowserColumnMetadata[];
  onSubmit?: BaseRecordFormProps['onSubmit'];
}) {
  const form = useForm({
    defaultValues: getCreateRecordFormDefaultValues(fieldColumns),
  });
  return (
    <FormProvider {...form}>
      <BaseRecordForm
        columns={fieldColumns}
        foreignKeyRelations={relations}
        onSubmit={onSubmit}
      />
    </FormProvider>
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  queryClient.clear();
  rowRequests = [];
  failRows = false;
  noRows = false;
  mockScrollIntoViewAndPointerCapture();
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Insert foreign key picker', () => {
  it('keeps mixed required and optional composite columns together and normal fields unchanged', () => {
    render(<Harness />);
    expect(screen.getByRole('textbox', { name: /team_id/ })).toHaveFocus();
    expect(
      screen.getByRole('textbox', { name: /team_id/ }).closest('fieldset'),
    ).toBe(
      screen.getByRole('textbox', { name: /user_id/ }).closest('fieldset'),
    );
    expect(screen.getByRole('textbox', { name: /description/ }).tagName).toBe(
      'TEXTAREA',
    );
    expect(screen.getByText('other.members')).toBeInTheDocument();
    expect(rowRequests).toHaveLength(0);
  });

  it('picks all mapped values, allows replacing the chip and submits the original column names', async () => {
    const onSubmit = vi.fn();
    const user = new TestUserEvent();
    render(<Harness onSubmit={onSubmit} />);
    await user.click(
      screen.getByRole('button', { name: 'Search other.members' }),
    );
    await user.click(await screen.findByRole('option', { name: /Alice/ }));
    expect(
      screen.getByText('other.members · team_id 9007199254740993 · user_id 11'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        team_id: { value: '9007199254740993', isArray: false },
        user_id: { value: '11', isArray: false },
      }),
    );
    await user.click(
      screen.getByRole('button', { name: /Replace linked row Alice/ }),
    );
    await user.click(await screen.findByRole('option', { name: /Bob/ }));
    expect(
      screen.getByText('other.members · team_id 4 · user_id 12'),
    ).toBeInTheDocument();
    expect(rowRequests[0]).toContain('FROM other.members');
    expect(rowRequests[0]).not.toContain('password');
  });

  it('clears the complete selection and restores NULL and DEFAULT choices', async () => {
    const user = new TestUserEvent();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await user.click(
      screen.getByRole('button', { name: 'Search other.members' }),
    );
    await user.click(await screen.findByRole('option', { name: /Alice/ }));
    await user.click(screen.getByRole('button', { name: 'Clear linked row' }));
    expect(screen.getByRole('textbox', { name: /team_id/ })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /team_id/ })).toHaveFocus();
    expect(
      screen.getByRole('button', { name: 'Use default for user_id' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await user.click(
      screen.getByRole('button', { name: 'Set user_id to NULL' }),
    );
    await user.type(screen.getByRole('textbox', { name: /team_id/ }), '7');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        team_id: { value: '7', isArray: false },
        user_id: { value: null, fallbackValue: 'NULL' },
      }),
    );
  });

  it('supports search, keyboard selection and Escape without submitting the form', async () => {
    const user = new TestUserEvent();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await user.click(
      screen.getByRole('button', { name: 'Search other.members' }),
    );
    await screen.findByRole('option', { name: /Alice/ });
    const search = screen.getByRole('combobox');
    expect(search).toHaveFocus();
    await user.type(search, 'Alice');
    await waitFor(() =>
      expect(rowRequests.some((sql) => sql.includes('%Alice%'))).toBe(true),
    );
    await screen.findByRole('option', { name: /Alice/ });
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: /Replace linked row/ }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: /Replace linked row/ }),
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('keeps manual values when referenced rows cannot be loaded', async () => {
    failRows = true;
    const user = new TestUserEvent();
    render(<Harness />);
    await user.type(screen.getByRole('textbox', { name: /team_id/ }), '8');
    await user.click(
      screen.getByRole('button', { name: 'Search other.members' }),
    );
    expect(
      await screen.findByText(/Unable to load linked rows/),
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('textbox', { name: /team_id/ })).toHaveValue('8');
  });

  it('distinguishes an empty result from unavailable rows', async () => {
    noRows = true;
    const user = new TestUserEvent();
    render(<Harness />);
    await user.click(
      screen.getByRole('button', { name: 'Search other.members' }),
    );
    expect(await screen.findByText('No rows available.')).toBeInTheDocument();
    await user.type(screen.getByRole('combobox'), 'missing');
    expect(await screen.findByText('No matching rows.')).toBeInTheDocument();
  });

  it('leaves overlapping links and forms without picker opt-in as normal fields', () => {
    const second = {
      ...relation,
      columns: ['user_id'],
      referencedColumns: ['id'],
    };
    const { unmount } = render(<Harness relations={[relation, second]} />);
    expect(
      screen.queryByRole('button', { name: /Search other.members/ }),
    ).not.toBeInTheDocument();
    unmount();
    render(<Harness relations={[]} />);
    expect(
      screen.queryByRole('button', { name: /Search other.members/ }),
    ).not.toBeInTheDocument();
  });

  it('supports a single-column link', async () => {
    const user = new TestUserEvent();
    const single = {
      ...relation,
      columns: ['team_id'],
      referencedColumns: ['team'],
    };
    render(<Harness relations={[single]} />);
    await user.click(
      screen.getByRole('button', { name: 'Search other.members' }),
    );
    await user.click(await screen.findByRole('option', { name: /Alice/ }));
    expect(
      screen.getByText('other.members · team_id 9007199254740993'),
    ).toBeInTheDocument();
  });
});
