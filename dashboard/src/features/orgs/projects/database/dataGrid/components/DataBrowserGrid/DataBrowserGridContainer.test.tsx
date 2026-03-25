import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { COLUMN_CONFIGURATION_STORAGE_KEY } from '@/features/orgs/projects/storage/dataGrid/utils/PersistentDataTableConfigurationStorage';
import { getProjectQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import hasuraMetadataQuery from '@/tests/msw/mocks/rest/hasuraMetadataQuery';
import tableQuery from '@/tests/msw/mocks/rest/tableQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  localStorageMock,
  queryClient,
  render,
  screen,
  setInitialStore,
  waitFor,
} from '@/tests/testUtils';
import DataBrowserGridContainer from './DataBrowserGridContainer';
import { DataGridQueryParamsProvider } from './DataGridQueryParamsProvider';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

const server = setupServer(
  tokenQuery,
  tableQuery,
  hasuraMetadataQuery,
  getProjectQuery,
);

function createRouterValue(tableSlug: string) {
  return {
    query: {
      orgSlug: 'xyz',
      appSubdomain: 'test-project',
      dataSourceSlug: 'default',
      schemaSlug: 'public',
      tableSlug,
    },
    pathname:
      '/orgs/[orgSlug]/projects/[appSubdomain]/database/browser/[dataSourceSlug]/[schemaSlug]/tables/[tableSlug]',
    route:
      '/orgs/[orgSlug]/projects/[appSubdomain]/database/browser/[dataSourceSlug]/[schemaSlug]/tables/[tableSlug]',
    asPath: `/orgs/xyz/projects/test-project/database/browser/default/public/tables/${tableSlug}`,
    basePath: '',
    isLocaleDomain: false,
    isReady: true,
    isPreview: false,
    isFallback: false,
    push: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    beforePopState: vi.fn(),
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
  };
}

describe('DataBrowserGridContainer', () => {
  beforeAll(() => {
    global.localStorage = localStorageMock();
    window.HTMLElement.prototype.scrollTo = vi.fn();
    server.listen();
  });

  beforeEach(() => {
    localStorage.clear();
    queryClient.clear();
  });

  afterAll(() => {
    server.close();
  });

  it('should load the correct column visibility for each table when switching', async () => {
    // Both "authors" and "town" tables have a shared "name" column.
    // "authors" has "name" visible, "town" has "name" hidden.
    // Switching tables should update the grid to reflect the stored config.
    const authorsTablePath = 'default.public.authors';
    const townTablePath = 'default.public.town';

    setInitialStore({
      [COLUMN_CONFIGURATION_STORAGE_KEY]: JSON.stringify({
        [authorsTablePath]: {
          columnVisibility: { name: true },
          columnOrder: [],
        },
        [townTablePath]: {
          columnVisibility: { name: false },
          columnOrder: [],
        },
      }),
    });

    mocks.useRouter.mockReturnValue(createRouterValue('authors'));

    const { rerender } = render(
      <DataGridQueryParamsProvider>
        <DataBrowserGridContainer />
      </DataGridQueryParamsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    expect(
      screen.getByRole('columnheader', { name: /name/i }),
    ).toBeInTheDocument();

    mocks.useRouter.mockReturnValue(createRouterValue('town'));

    rerender(
      <DataGridQueryParamsProvider>
        <DataBrowserGridContainer />
      </DataGridQueryParamsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(
        screen.queryByRole('columnheader', { name: /name/i }),
      ).not.toBeInTheDocument();
    });
  });
});
