import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { useDialog } from '@/components/common/DialogProvider';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { LogicalModelDetails } from '@/features/orgs/projects/database/native-queries/components/LogicalModelDetails';
import { NativeQueriesBrowserSidebar } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesBrowserSidebar';
import NativeQueriesLandingPage from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/database/native-queries';
import NativeQueriesIndexPage from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/database/native-queries/[dataSourceSlug]';
import { mockMatchMediaValue } from '@/tests/mocks';
import {
  act,
  fireEvent,
  mockPointerEvent,
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';
import type { ExportMetadataResponse } from '@/utils/hasura-api/generated/schemas';

const mocks = vi.hoisted(() => ({
  routeChangeStart: undefined as VoidFunction | undefined,
  router: {
    isReady: true,
    asPath: '/orgs/test/projects/local/database/native-queries',
    query: {
      orgSlug: 'test',
      appSubdomain: 'local',
      dataSourceSlug: '',
      modelSlug: 'shared_model',
    },
    push: vi.fn(),
    replace: vi.fn(),
    events: { on: vi.fn(), off: vi.fn() },
  },
}));
vi.mock('next/router', () => ({ useRouter: () => mocks.router }));
vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: () => false,
}));
vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: () => ({
    project: {
      subdomain: 'local',
      region: 'local',
      config: { hasura: { adminSecret: 'secret' } },
    },
  }),
}));

function sourceFixture(name: string, field: string) {
  return {
    name,
    kind: 'postgres',
    tables: [],
    logical_models: [
      {
        name: 'shared_model',
        fields: [{ name: field, type: { scalar: 'text', nullable: false } }],
      },
    ],
    native_queries: [
      {
        root_field_name: 'shared_query',
        code: `SELECT ${field}`,
        returns: 'shared_model',
      },
    ],
  };
}
let metadata: ExportMetadataResponse;
let metadataStatus = 200;
const server = setupServer(
  http.post(
    'https://local.hasura.local.nhost.run/v1/metadata',
    async ({ request }) => {
      expect(await request.json()).toEqual({
        type: 'export_metadata',
        version: 2,
        args: {},
      });
      return metadataStatus === 200
        ? HttpResponse.json(metadata)
        : HttpResponse.json({ error: 'unavailable' }, { status: 500 });
    },
  ),
);

function DirtyDraftHarness() {
  const { setDirtySource } = useDialog();
  return (
    <button type="button" onClick={() => setDirtySource('draft', true)}>
      Mark draft dirty
    </button>
  );
}

function chooseSource(source: string) {
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Data Source' }), {
    key: 'Enter',
  });
  fireEvent.click(screen.getByRole('option', { name: source }));
}

describe('native-query source routes', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
    Element.prototype.scrollIntoView = vi.fn();
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  });
  beforeEach(() => {
    mockPointerEvent();
    queryClient.clear();
    metadataStatus = 200;
    metadata = {
      resource_version: 1,
      metadata: {
        version: 3,
        sources: [
          sourceFixture('default', 'default_field'),
          sourceFixture('analytics source', 'analytics_field'),
        ],
      },
    };
    mocks.router.query.dataSourceSlug = '';
    mocks.router.query.modelSlug = 'shared_model';
    mocks.router.asPath = '/orgs/test/projects/local/database/native-queries';
    mocks.routeChangeStart = undefined;
    mocks.router.push.mockReset().mockImplementation(async () => {
      mocks.routeChangeStart?.();
      return true;
    });
    mocks.router.replace.mockReset().mockResolvedValue(true);
    mocks.router.events.on.mockImplementation(
      (event: string, handler: VoidFunction) => {
        if (event === 'routeChangeStart') {
          mocks.routeChangeStart = handler;
        }
      },
    );
  });
  afterEach(() => {
    server.resetHandlers();
    queryClient.clear();
  });
  afterAll(() => server.close());

  it('uses the default overview only when a supported default exists', async () => {
    render(<NativeQueriesLandingPage />);
    await waitFor(() =>
      expect(mocks.router.replace).toHaveBeenCalledWith(
        '/orgs/test/projects/local/database/native-queries/default',
      ),
    );
  });

  it('offers an explicit choice when default is absent and encodes the chosen source', async () => {
    metadata.metadata.sources = [
      sourceFixture('analytics source', 'analytics_field'),
    ];
    render(
      <>
        <NativeQueriesBrowserSidebar />
        <NativeQueriesLandingPage />
      </>,
    );
    await screen.findByRole('heading', { name: 'Select a data source' });
    expect(mocks.router.replace).not.toHaveBeenCalled();
    chooseSource('analytics source');
    await waitFor(() =>
      expect(mocks.router.push).toHaveBeenCalledWith(
        '/orgs/test/projects/local/database/native-queries/analytics%20source',
      ),
    );
  });

  it('shows no-supported-source and metadata-error states without redirecting', async () => {
    metadata.metadata.sources = [
      { name: 'sqlite', kind: 'sqlite', tables: [] },
    ];
    const view = render(<NativeQueriesLandingPage />);
    await screen.findByRole('heading', { name: 'No supported data sources' });
    metadataStatus = 500;
    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: [EXPORT_METADATA_QUERY_KEY, 'local'],
      });
    });
    view.rerender(<NativeQueriesLandingPage />);
    await screen.findByRole('heading', { name: 'Could not load data sources' });
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it.each([
    'missing',
    'default',
    'sqlite',
  ])('never falls back from the explicit %s URL', async (source) => {
    metadata.metadata.sources = [
      sourceFixture('analytics source', 'analytics_field'),
      { name: 'sqlite', kind: 'sqlite', tables: [] },
    ];
    mocks.router.query.dataSourceSlug = source;
    render(<NativeQueriesIndexPage />);
    expect(screen.queryByText('Database not found')).not.toBeInTheDocument();
    await screen.findByRole('heading', {
      name:
        source === 'sqlite' ? 'Unsupported data source' : 'Database not found',
    });
    expect(mocks.router.replace).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: 'New logical model' }),
    ).not.toBeInTheDocument();
  });

  it('resolves duplicate model names against the exact decoded route source', async () => {
    mocks.router.query.dataSourceSlug = 'analytics source';
    render(<LogicalModelDetails />);
    await screen.findByRole('cell', { name: 'analytics_field' });
    expect(
      screen.queryByRole('cell', { name: 'default_field' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'shared_query' })).toHaveAttribute(
      'href',
      '/orgs/test/projects/local/database/native-queries/analytics%20source/queries/shared_query',
    );
  });

  it('removes actions when the selected source disappears after a metadata refresh', async () => {
    mocks.router.query.dataSourceSlug = 'analytics source';
    render(<NativeQueriesBrowserSidebar />);
    await screen.findByRole('button', { name: 'New native query' });
    metadata.metadata.sources = [sourceFixture('default', 'default_field')];
    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: [EXPORT_METADATA_QUERY_KEY, 'local'],
      });
    });
    await screen.findByRole('heading', { name: 'Database not found' });
    expect(
      screen.queryByRole('button', { name: 'New native query' }),
    ).not.toBeInTheDocument();
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it('switches to the source overview rather than a same-named object', async () => {
    mocks.router.query.dataSourceSlug = 'default';
    render(<NativeQueriesBrowserSidebar />);
    await screen.findByRole('link', { name: 'shared_model' });
    chooseSource('analytics source');
    await waitFor(() =>
      expect(mocks.router.push).toHaveBeenCalledWith(
        '/orgs/test/projects/local/database/native-queries/analytics%20source',
      ),
    );
  });

  it('keeps the route and controlled source selector when dirty navigation is cancelled', async () => {
    mocks.router.query.dataSourceSlug = 'default';
    render(
      <>
        <NativeQueriesBrowserSidebar />
        <DirtyDraftHarness />
      </>,
    );
    await screen.findByRole('link', { name: 'shared_model' });
    fireEvent.click(screen.getByRole('button', { name: 'Mark draft dirty' }));
    chooseSource('analytics source');
    const dialog = await screen.findByRole('dialog', {
      name: 'Unsaved changes',
    });
    await new TestUserEvent().click(
      within(dialog).getByRole('button', { name: 'Cancel' }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Unsaved changes' }),
      ).not.toBeInTheDocument(),
    );
    expect(mocks.router.query.dataSourceSlug).toBe('default');
    expect(
      screen.getByRole('combobox', { name: 'Data Source' }),
    ).toHaveTextContent('default');
  });
});
