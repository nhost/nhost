import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import DataBrowserGrid from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataBrowserGrid';
import { mockMatchMediaValue } from '@/tests/mocks';
import {
  fireEvent,
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
const RAW_TABLE_COLUMN = {
  column_name: 'id',
  data_type: 'integer',
  udt_name: 'int4',
  full_data_type: 'integer',
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
Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
  configurable: true,
  value: vi.fn(),
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
  refetch: vi.fn(),
  setSortBy: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: () => ({
    asPath: '/orgs/example/projects/example/database',
    query: {
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
vi.mock(
  '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider',
  () => ({
    useDataGridQueryParams: () => ({
      appliedFilters: [],
      currentOffset: 0,
      sortBy: [],
      setSortBy: mocks.setSortBy,
    }),
  }),
);
vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useIsReadOnlyDatabaseObject',
  () => ({ useIsReadOnlyDatabaseObject: () => false }),
);
vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useRefreshMaterializedView',
  () => ({
    useRefreshMaterializedView: () => ({
      handleRefresh: vi.fn(),
      isRefreshing: false,
    }),
  }),
);
vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery',
  async () => {
    const actual = await vi.importActual<
      typeof import('@/features/orgs/projects/database/dataGrid/hooks/useTableQuery')
    >('@/features/orgs/projects/database/dataGrid/hooks/useTableQuery');

    return {
      ...actual,
      useTableQuery: () => ({
        data: {
          columns: [RAW_TABLE_COLUMN],
          rows: [{ id: 1 }],
          numberOfRows: 1,
          metadata: {},
          error: null,
        },
        error: null,
        refetch: mocks.refetch,
        status: 'success',
      }),
    };
  },
);
vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useTableType',
  () => ({ useTableType: () => ({ tableType: 'ORDINARY TABLE' }) }),
);
vi.mock(
  '@/features/orgs/projects/events/event-triggers/hooks/useGetEventTriggersByTable',
  () => ({ useGetEventTriggersByTable: () => ({ data: [] }) }),
);

let mutationRequestCount = 0;
const server = setupServer(
  http.post(`${HASURA_APP_URL}/v2/query`, () => {
    mutationRequestCount += 1;
    return HttpResponse.json(DIRECT_CONFLICT, { status: 409 });
  }),
);

async function editIdCell(user: TestUserEvent, value: string) {
  const editableCell = screen
    .getAllByRole('cell')
    .find((cell) => cell.id === '0_id');

  if (!editableCell) {
    throw new Error('Editable ID cell was not rendered.');
  }

  fireEvent.click(editableCell, { detail: 2 });
  const input = await screen.findByRole('spinbutton');
  await user.clear(input);
  await user.type(input, value);
  await user.keyboard('{Enter}');
}

async function expectOneConflictToast() {
  await waitFor(() => {
    expect(document.querySelectorAll('.error-toast')).toHaveLength(1);
  });
  expect(screen.getAllByText(CONFLICT_MESSAGE).length).toBeGreaterThan(0);
  expect(mocks.refetch).not.toHaveBeenCalled();
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

beforeEach(() => {
  mutationRequestCount = 0;
  mocks.refetch.mockResolvedValue({ data: [] });
  vi.spyOn(queryClient, 'invalidateQueries');
});

afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
  toast.remove();
  vi.restoreAllMocks();
});

afterAll(() => server.close());

it('shows one persistent conflict toast from the single-row delete exit', async () => {
  render(<DataBrowserGrid />);
  const user = new TestUserEvent();

  await user.click(screen.getByRole('button', { name: 'Delete row' }));
  await user.click(screen.getByRole('button', { name: 'Delete' }));

  await expectOneConflictToast();
  expect(mutationRequestCount).toBe(1);
  expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  expect(
    screen.queryByText('The row has been deleted successfully.'),
  ).not.toBeInTheDocument();
});

it('shows one persistent conflict toast from the bulk-row delete exit', async () => {
  render(<DataBrowserGrid />);
  const user = new TestUserEvent();

  const [, rowCheckbox] = screen.getAllByRole('checkbox');
  await user.click(rowCheckbox);
  await waitFor(() => {
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  await user.click(screen.getByRole('button', { name: 'Delete' }));

  await expectOneConflictToast();
  expect(mutationRequestCount).toBe(1);
  expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  expect(
    screen.queryByText('The row has been deleted successfully.'),
  ).not.toBeInTheDocument();
});

it('shows one persistent conflict toast from an inline cell update', async () => {
  render(<DataBrowserGrid />);
  const user = new TestUserEvent();

  await editIdCell(user, '2');

  await expectOneConflictToast();
  expect(mutationRequestCount).toBe(1);
  expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  expect(
    screen.queryByText(`Error: ${CONFLICT_MESSAGE}`),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText('Your changes were successfully saved.'),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('spinbutton')).toHaveValue(1);
});

it('preserves the ordinary inline cell update error toast', async () => {
  server.use(
    http.post(`${HASURA_APP_URL}/v2/query`, () => {
      mutationRequestCount += 1;
      return HttpResponse.json(
        { error: 'ordinary update failed', code: 'postgres-error' },
        { status: 400 },
      );
    }),
  );
  render(<DataBrowserGrid />);
  const user = new TestUserEvent();

  await editIdCell(user, '2');

  expect(
    await screen.findByText('Error: ordinary update failed'),
  ).toBeInTheDocument();
  expect(document.querySelectorAll('.error-toast')).toHaveLength(0);
  expect(mutationRequestCount).toBe(1);
  expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  expect(
    screen.queryByText('Your changes were successfully saved.'),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('spinbutton')).toHaveValue(1);
});
