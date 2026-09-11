import type { Row } from '@tanstack/react-table';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import CreateRecordForm from '@/features/orgs/projects/database/dataGrid/components/CreateRecordForm/CreateRecordForm';
import CreateRelationshipDialog from '@/features/orgs/projects/database/dataGrid/components/CreateRelationshipDialog/CreateRelationshipDialog';
import CreateTableForm from '@/features/orgs/projects/database/dataGrid/components/CreateTableForm/CreateTableForm';
import EditRecordForm from '@/features/orgs/projects/database/dataGrid/components/EditRecordForm/EditRecordForm';
import EditTableForm from '@/features/orgs/projects/database/dataGrid/components/EditTableForm/EditTableForm';
import type { DataBrowserColumnMetadata } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { UnknownDataGridRow } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid';
import { mockMatchMediaValue } from '@/tests/mocks';
import {
  mockPointerEvent,
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';

const HASURA_APP_URL = 'http://hasura.example.test';
const CONFLICT_MESSAGE =
  'metadata resource version referenced (42) did not match current version';
const DIRECT_CONFLICT = {
  path: '$',
  error: CONFLICT_MESSAGE,
  code: 'conflict',
};
const TABLE_COLUMN: DataBrowserColumnMetadata = {
  id: 'name',
  isPrimary: true,
  isNullable: false,
  isIdentity: false,
  isUnique: true,
  defaultValue: undefined,
  specificType: 'text',
  baseType: 'text',
  isArray: false,
  displayType: 'text',
};
const RAW_TABLE_COLUMN = {
  column_name: 'name',
  data_type: 'text',
  udt_name: 'text',
  full_data_type: 'text',
  is_primary: true,
  is_nullable: 'NO',
  is_identity: 'NO',
  is_unique: true,
  column_default: null,
  column_comment: null,
  unique_constraints: [],
  primary_constraints: [],
  foreign_key_relation: null,
};

mockPointerEvent();

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
  configurable: true,
  value: vi.fn(() => ({
    width: 100,
    height: 40,
    top: 0,
    left: 0,
    bottom: 40,
    right: 100,
  })),
});

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  trackEvent: vi.fn(),
  useTableSchemaQuery: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: () => ({
    asPath: '/orgs/example/projects/example/database',
    push: mocks.push,
    query: {
      orgSlug: 'example',
      appSubdomain: 'example',
      dataSourceSlug: 'default',
      schemaSlug: 'public',
      tableSlug: 'users',
    },
  }),
}));
vi.mock('@/features/orgs/projects/common/hooks/useAdminApiTarget', () => ({
  useAdminApiTarget: () => ({
    appUrl: HASURA_APP_URL,
    adminSecret: 'not-recorded-in-errors',
  }),
}));
vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: () => true,
}));
vi.mock(
  '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion',
  () => ({ useGetMetadataResourceVersion: () => ({ data: 7 }) }),
);
vi.mock('@/features/orgs/projects/common/hooks/useGetDataSources', () => ({
  useGetDataSources: () => ({ data: ['default'] }),
}));
vi.mock('@/features/orgs/projects/common/hooks/useMetadataTables', () => ({
  useMetadataTables: () => [
    { source: 'default', schema: 'public', table: 'users' },
    { source: 'default', schema: 'public', table: 'teams' },
  ],
}));
vi.mock(
  '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery',
  () => ({ useTableSchemaQuery: mocks.useTableSchemaQuery }),
);
vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: () => ({
    project: { id: 'project-id', subdomain: 'example' },
  }),
}));
vi.mock(
  '@/features/orgs/projects/remote-schemas/hooks/useGetRemoteSchemas',
  () => ({ useGetRemoteSchemas: () => ({ data: [], status: 'success' }) }),
);
vi.mock('@/hooks/useTrackEvent', () => ({
  useTrackEvent: () => mocks.trackEvent,
}));

let directRequestCount = 0;
let metadataRequestCount = 0;
const server = setupServer(
  http.post(`${HASURA_APP_URL}/v2/query`, () => {
    directRequestCount += 1;
    return HttpResponse.json(DIRECT_CONFLICT, { status: 409 });
  }),
  http.post(`${HASURA_APP_URL}/v1/metadata`, () => {
    metadataRequestCount += 1;
    return HttpResponse.json(DIRECT_CONFLICT, { status: 409 });
  }),
);

async function expectOneConflictToast() {
  await waitFor(() => {
    expect(document.querySelectorAll('.error-toast')).toHaveLength(1);
  });
  expect(screen.getAllByText(CONFLICT_MESSAGE).length).toBeGreaterThan(0);
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

beforeEach(() => {
  directRequestCount = 0;
  metadataRequestCount = 0;
  mocks.useTableSchemaQuery.mockReturnValue({
    data: { columns: [RAW_TABLE_COLUMN], foreignKeyRelations: [] },
    error: null,
    status: 'success',
  });
});

afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
  toast.remove();
  vi.clearAllMocks();
});

afterAll(() => server.close());

it('shows a persistent conflict toast from the CreateTableForm submit exit', async () => {
  const onSubmit = vi.fn();
  render(
    <CreateTableForm
      schema="public"
      redirectOnSuccess={false}
      onSubmit={onSubmit}
    />,
  );
  const user = new TestUserEvent();

  await user.type(screen.getByTestId('tableNameInput'), 'projects');
  const removeColumnButtons = screen.getAllByRole('button', {
    name: 'Remove column',
  });
  await user.click(removeColumnButtons[1]);
  await TestUserEvent.fireClickEvent(
    screen.getByRole('button', { name: 'Create' }),
  );

  await waitFor(() => {
    expect(directRequestCount).toBe(1);
  });
  await expectOneConflictToast();
  expect(directRequestCount).toBe(1);
  expect(metadataRequestCount).toBe(0);
  expect(onSubmit).not.toHaveBeenCalled();
  expect(mocks.trackEvent).not.toHaveBeenCalled();
  expect(mocks.push).not.toHaveBeenCalled();
  expect(screen.getByTestId('tableNameInput')).toHaveValue('projects');
});

it('shows a persistent conflict toast from the CreateRelationshipDialog submit exit', async () => {
  render(
    <CreateRelationshipDialog
      source="default"
      schema="public"
      tableName="users"
    />,
  );
  const user = new TestUserEvent();

  await user.click(screen.getByRole('button', { name: /Relationship/ }));
  await user.type(screen.getByLabelText('Relationship Name'), 'team');
  await user.click(screen.getByTestId('toReferenceSourceSelect'));
  await user.click(screen.getByRole('option', { name: 'default' }));
  await user.click(screen.getByTestId('toReferenceSchemaSelect'));
  await user.click(screen.getByRole('option', { name: 'public' }));
  await user.click(screen.getByTestId('toReferenceTableCombobox'));
  await user.click(screen.getByRole('option', { name: 'teams' }));
  await user.click(screen.getByRole('button', { name: 'Add New Mapping' }));
  await TestUserEvent.fireClickEvent(
    screen.getByRole('button', { name: 'Create Relationship' }),
  );

  await expectOneConflictToast();
  expect(metadataRequestCount).toBe(1);
  expect(directRequestCount).toBe(0);
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByLabelText('Relationship Name')).toHaveValue('team');
});

it('shows a persistent conflict toast from the EditTableForm submit exit', async () => {
  const onSubmit = vi.fn();
  render(
    <EditTableForm schema="public" tableName="users" onSubmit={onSubmit} />,
  );
  const user = new TestUserEvent();

  const tableName = await screen.findByTestId('tableNameInput');
  await user.clear(tableName);
  await user.type(tableName, 'accounts');
  await TestUserEvent.fireClickEvent(
    screen.getByRole('button', { name: 'Save' }),
  );

  await expectOneConflictToast();
  expect(directRequestCount).toBe(1);
  expect(onSubmit).not.toHaveBeenCalled();
  expect(mocks.push).not.toHaveBeenCalled();
  expect(tableName).toHaveValue('accounts');
});

it('shows a persistent conflict toast from the CreateRecordForm submit exit', async () => {
  const onSubmit = vi.fn();
  render(
    <CreateRecordForm
      columns={[TABLE_COLUMN]}
      currentOffset={0}
      initialValues={{ name: 'Alice' }}
      onSubmit={onSubmit}
    />,
  );

  await TestUserEvent.fireClickEvent(
    screen.getByRole('button', { name: 'Insert' }),
  );

  await expectOneConflictToast();
  expect(directRequestCount).toBe(1);
  expect(onSubmit).not.toHaveBeenCalled();
  expect(mocks.trackEvent).not.toHaveBeenCalled();
});

it('shows a persistent conflict toast from the EditRecordForm submit exit', async () => {
  const onSubmit = vi.fn();
  const row = {
    original: { name: 'Alice' },
    getAllCells: () => [
      {
        column: {
          id: 'name',
          columnDef: { meta: TABLE_COLUMN },
        },
      },
    ],
  } as unknown as Row<UnknownDataGridRow>;
  render(
    <EditRecordForm
      row={row}
      columns={[TABLE_COLUMN]}
      currentOffset={0}
      onSubmit={onSubmit}
    />,
  );
  const user = new TestUserEvent();

  const input = screen.getByRole('textbox', { name: /name/i });
  await user.clear(input);
  await user.type(input, 'Bob');
  await TestUserEvent.fireClickEvent(
    screen.getByRole('button', { name: 'Save' }),
  );

  await expectOneConflictToast();
  expect(directRequestCount).toBe(1);
  expect(onSubmit).not.toHaveBeenCalled();
  expect(input).toHaveValue('Bob');
});
