import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import SQLEditor from '@/features/orgs/projects/database/dataGrid/components/SQLEditor/SQLEditor';
import { mockMatchMediaValue } from '@/tests/mocks';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';

const originalEnv = { ...process.env };
const HASURA_APP_URL = 'http://hasura.example.test';
const MIGRATION_URL = 'http://migrations.example.test/apis/migrate';
const SQL = 'CREATE TABLE public.users (id int);';
const TWO_TABLES_SQL = [SQL, 'CREATE TABLE public.teams (id int);'].join('\n');
const CONFLICT_MESSAGE =
  'metadata resource version referenced (42) did not match current version';
const DIRECT_CONFLICT = {
  path: '$',
  error: CONFLICT_MESSAGE,
  code: 'conflict',
};

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  trackEvent: vi.fn(),
  useAdminApiTarget: vi.fn(),
  useIsPlatform: vi.fn(),
  useProject: vi.fn(),
  useUserData: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: () => ({
    asPath: '/orgs/example/projects/example/database',
    query: { dataSourceSlug: 'default' },
  }),
}));
vi.mock('@uiw/react-codemirror', () => ({
  __esModule: true,
  Prec: { highest: (extension: unknown) => extension },
  keymap: { of: (bindings: unknown) => bindings },
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <textarea
      aria-label="SQL editor"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));
vi.mock('@/features/orgs/projects/common/hooks/useAdminApiTarget', () => ({
  useAdminApiTarget: mocks.useAdminApiTarget,
}));
vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: mocks.useIsPlatform,
}));
vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery',
  () => ({
    useDatabaseQuery: () => ({ refetch: mocks.refetch }),
  }),
);
vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));
vi.mock('@/hooks/useTrackEvent', () => ({
  useTrackEvent: () => mocks.trackEvent,
}));
vi.mock('@/hooks/useUserData', () => ({
  useUserData: mocks.useUserData,
}));

let sqlRequestCount = 0;
let metadataRequestCount = 0;
let migrationRequestCount = 0;

const server = setupServer(
  http.post(`${HASURA_APP_URL}/v2/query`, () => {
    sqlRequestCount += 1;
    return HttpResponse.json({ result_type: 'CommandOk', result: null });
  }),
  http.post(`${HASURA_APP_URL}/v1/metadata`, () => {
    metadataRequestCount += 1;
    return HttpResponse.json(DIRECT_CONFLICT, { status: 409 });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

beforeEach(() => {
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_NHOST_HASURA_MIGRATIONS_API_URL: MIGRATION_URL,
  };
  sqlRequestCount = 0;
  metadataRequestCount = 0;
  migrationRequestCount = 0;
  mocks.refetch.mockResolvedValue({ data: [] });
  mocks.useAdminApiTarget.mockReturnValue({
    appUrl: HASURA_APP_URL,
    adminSecret: 'not-recorded-in-errors',
  });
  mocks.useIsPlatform.mockReturnValue(true);
  mocks.useProject.mockReturnValue({
    project: { id: 'project-id', subdomain: 'example' },
  });
  mocks.useUserData.mockReturnValue({ id: 'user-id' });
});

afterEach(() => {
  process.env = { ...originalEnv };
  server.resetHandlers();
  toast.remove();
  vi.clearAllMocks();
});

afterAll(() => server.close());

function getSQLEditor() {
  return screen.getByRole('textbox', { name: 'SQL editor' });
}

async function expectTerminalConflict(expectedSQL = SQL) {
  expect(await screen.findByText(CONFLICT_MESSAGE)).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Run' })).toBeEnabled();
  });

  expect(getSQLEditor()).toHaveValue(expectedSQL);
  expect(document.querySelectorAll('.error-toast')).toHaveLength(1);
  expect(
    screen.queryByText('Success, no rows returned'),
  ).not.toBeInTheDocument();
  expect(mocks.trackEvent).not.toHaveBeenCalled();
  expect(mocks.refetch).not.toHaveBeenCalled();
}

it('retains SQL and re-enables Run after a direct SQL conflict', async () => {
  server.use(
    http.post(`${HASURA_APP_URL}/v2/query`, () => {
      sqlRequestCount += 1;
      return HttpResponse.json(DIRECT_CONFLICT, { status: 409 });
    }),
  );
  render(<SQLEditor />);
  const user = new TestUserEvent();

  await user.click(getSQLEditor());
  await user.type(getSQLEditor(), SQL);
  await user.click(screen.getByRole('button', { name: 'Run' }));

  await expectTerminalConflict();
  expect(sqlRequestCount).toBe(1);
  expect(metadataRequestCount).toBe(0);
  expect(migrationRequestCount).toBe(0);
});

it('retains SQL and re-enables Run after a migration conflict', async () => {
  mocks.useIsPlatform.mockReturnValue(false);
  server.use(
    http.post(MIGRATION_URL, () => {
      migrationRequestCount += 1;
      return HttpResponse.json(
        {
          code: 'data_api_error',
          message: JSON.stringify(DIRECT_CONFLICT),
        },
        { status: 400 },
      );
    }),
  );
  render(<SQLEditor initialSQL={SQL} />);
  const user = new TestUserEvent();

  await user.click(screen.getByRole('switch', { name: 'This is a migration' }));
  await user.click(screen.getByRole('button', { name: 'Run' }));

  await expectTerminalConflict();
  expect(sqlRequestCount).toBe(0);
  expect(metadataRequestCount).toBe(0);
  expect(migrationRequestCount).toBe(1);
});

it('waits for all local tracking results and prioritizes a delayed conflict', async () => {
  mocks.useIsPlatform.mockReturnValue(false);
  let resolveConflict!: VoidFunction;
  const conflictBlocked = new Promise<void>((resolve) => {
    resolveConflict = resolve;
  });
  server.use(
    http.post(MIGRATION_URL, async () => {
      migrationRequestCount += 1;
      if (migrationRequestCount === 1) {
        return HttpResponse.error();
      }

      await conflictBlocked;
      return HttpResponse.json(
        {
          code: 'data_api_error',
          message: JSON.stringify(DIRECT_CONFLICT),
        },
        { status: 400 },
      );
    }),
  );
  render(<SQLEditor initialSQL={TWO_TABLES_SQL} />);
  const user = new TestUserEvent();

  await user.click(screen.getByRole('switch', { name: 'Track this' }));
  await user.click(screen.getByRole('button', { name: 'Run' }));

  await waitFor(() => {
    expect(migrationRequestCount).toBe(2);
  });
  expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled();
  expect(mocks.refetch).not.toHaveBeenCalled();
  expect(screen.queryByText(CONFLICT_MESSAGE)).not.toBeInTheDocument();

  resolveConflict();

  await expectTerminalConflict(TWO_TABLES_SQL);
  expect(sqlRequestCount).toBe(1);
  expect(metadataRequestCount).toBe(0);
  expect(migrationRequestCount).toBe(2);
});

it('retains SQL and re-enables Run after post-SQL tracking conflicts', async () => {
  render(<SQLEditor initialSQL={SQL} />);
  const user = new TestUserEvent();

  await user.click(screen.getByRole('switch', { name: 'Track this' }));
  await user.click(screen.getByRole('button', { name: 'Run' }));

  await expectTerminalConflict();
  expect(sqlRequestCount).toBe(1);
  expect(metadataRequestCount).toBe(1);
  expect(migrationRequestCount).toBe(0);
});
