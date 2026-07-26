import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { act } from 'react';
import { toast } from 'react-hot-toast';
import { vi } from 'vitest';
import NativeQueriesBrowserSidebar from '@/features/orgs/projects/database/native-queries/components/NativeQueriesBrowserSidebar/NativeQueriesBrowserSidebar';
import hasuraMetadataQuery from '@/tests/msw/mocks/rest/hasuraMetadataQuery';
import {
  fireEvent,
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';
import type {
  LogicalModelItem,
  NativeQueryItem,
} from '@/utils/hasura-api/generated/schemas';

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  nativeQueryMutateAsync: vi.fn(),
  permissionMutateAsync: vi.fn(),
  reset: vi.fn(),
  router: {
    asPath:
      '/orgs/test/projects/local/database/native-queries/default/models/author_result',
    query: {
      orgSlug: 'test',
      appSubdomain: 'local',
      dataSourceSlug: 'default',
      modelSlug: 'author_result',
    },
    push: vi.fn(),
    events: { on: vi.fn(), off: vi.fn() },
  },
}));

vi.mock('next/router', () => ({ useRouter: () => mocks.router }));
vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: () => false,
}));
vi.mock('@/features/orgs/hooks/useRemoteApplicationGQLClient', () => ({
  useRemoteApplicationGQLClient: () => ({}),
}));
vi.mock('@/generated/graphql', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/generated/graphql')>();
  return {
    ...actual,
    useGetRemoteAppRolesQuery: () => ({
      data: { authRoles: [{ role: 'user' }, { role: 'editor' }] },
      loading: false,
      error: undefined,
    }),
  };
});
vi.mock('@uiw/react-codemirror', () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange?: (value: string) => void;
  }) => (
    <textarea
      aria-label="SQL editor"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));
vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: () => ({
    loading: false,
    project: {
      subdomain: 'local',
      region: 'local',
      config: { hasura: { adminSecret: 'secret' } },
    },
  }),
}));
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation',
  () => ({
    default: () => ({
      mutateAsync: mocks.mutateAsync,
      reset: mocks.reset,
      isPending: false,
    }),
  }),
);
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelPermissionMutation',
  () => ({
    default: () => ({
      mutateAsync: mocks.permissionMutateAsync,
      reset: mocks.reset,
      isPending: false,
    }),
  }),
);
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation',
  () => ({
    default: () => ({
      mutateAsync: mocks.nativeQueryMutateAsync,
      reset: mocks.reset,
      isPending: false,
    }),
  }),
);

const server = setupServer(hasuraMetadataQuery);

interface MetadataResources {
  logicalModels: LogicalModelItem[];
  nativeQueries: NativeQueryItem[];
}

function metadataResourcesHandler({
  logicalModels,
  nativeQueries,
}: MetadataResources) {
  return http.post('https://local.hasura.local.nhost.run/v1/metadata', () =>
    HttpResponse.json({
      metadata: {
        version: 3,
        sources: [
          {
            name: 'default',
            kind: 'postgres',
            logical_models: logicalModels,
            native_queries: nativeQueries,
            tables: [],
          },
        ],
      },
      resource_version: 10,
    }),
  );
}

const logicalModel = (name: string): LogicalModelItem => ({ name, fields: [] });
const nativeQuery = (rootFieldName: string): NativeQueryItem => ({
  root_field_name: rootFieldName,
  code: 'SELECT 1',
  returns: 'alpha_model',
});

describe('NativeQueriesBrowserSidebar', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
    Element.prototype.scrollIntoView = vi.fn();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  beforeEach(() => {
    mocks.mutateAsync.mockResolvedValue({ message: 'success' });
    mocks.nativeQueryMutateAsync.mockResolvedValue({ message: 'success' });
  });

  afterEach(() => {
    server.resetHandlers();
    queryClient.clear();
    vi.clearAllMocks();
    act(() => toast.remove());
  });

  afterAll(() => server.close());

  it('renders labelled sections and sorts resources within each section', async () => {
    server.use(
      metadataResourcesHandler({
        nativeQueries: [nativeQuery('zeta_query'), nativeQuery('alpha_query')],
        logicalModels: [
          logicalModel('zeta_model'),
          logicalModel('alpha_model'),
        ],
      }),
    );
    render(<NativeQueriesBrowserSidebar />);

    const queriesSection = await screen.findByRole('region', {
      name: 'Native queries',
    });
    const modelsSection = screen.getByRole('region', {
      name: 'Logical models',
    });

    expect(
      queriesSection.compareDocumentPosition(modelsSection) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      within(queriesSection)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['alpha_query', 'zeta_query']);
    expect(
      within(modelsSection)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['alpha_model', 'zeta_model']);
    expect(within(queriesSection).queryByText('alpha_model')).toBeNull();
    expect(within(modelsSection).queryByText('alpha_query')).toBeNull();
  });

  it('filters each section independently and keeps both sections visible', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);

    const queriesSection = await screen.findByRole('region', {
      name: 'Native queries',
    });
    const modelsSection = screen.getByRole('region', {
      name: 'Logical models',
    });
    const search = screen.getByPlaceholderText('Search models and queries...');

    await user.type(search, 'search');
    expect(within(queriesSection).getByText('search_authors')).toBeVisible();
    expect(
      within(modelsSection).getByText('No logical models match your search.'),
    ).toBeVisible();

    await user.clear(search);
    await user.type(search, 'collection');
    expect(within(modelsSection).getByText('author_collection')).toBeVisible();
    expect(
      within(queriesSection).getByText('No native queries match your search.'),
    ).toBeVisible();

    await user.clear(search);
    await user.type(search, 'missing');
    expect(
      within(queriesSection).getByText('No native queries match your search.'),
    ).toBeVisible();
    expect(
      within(modelsSection).getByText('No logical models match your search.'),
    ).toBeVisible();
  });

  it('shows a resource-empty message only in the empty section', async () => {
    server.use(
      metadataResourcesHandler({
        nativeQueries: [],
        logicalModels: [logicalModel('author_result')],
      }),
    );
    render(<NativeQueriesBrowserSidebar />);

    const queriesSection = await screen.findByRole('region', {
      name: 'Native queries',
    });
    const modelsSection = screen.getByRole('region', {
      name: 'Logical models',
    });

    expect(
      within(queriesSection).getByText('No native queries yet.'),
    ).toBeVisible();
    expect(within(modelsSection).getByText('author_result')).toBeVisible();
    expect(within(modelsSection).queryByText(/No logical models/)).toBeNull();
  });

  it('keeps both empty sections and native query creation enabled', async () => {
    server.use(
      metadataResourcesHandler({ nativeQueries: [], logicalModels: [] }),
    );
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);

    const queriesSection = await screen.findByRole('region', {
      name: 'Native queries',
    });
    const modelsSection = screen.getByRole('region', {
      name: 'Logical models',
    });
    expect(
      within(queriesSection).getByText('No native queries yet.'),
    ).toBeVisible();
    expect(
      within(modelsSection).getByText('No logical models yet.'),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'New' }));
    expect(
      screen.getByRole('menuitem', { name: 'Native query' }),
    ).not.toHaveAttribute('data-disabled');
  });

  it('offers logical model creation', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);

    await screen.findByText('author_result');
    await user.click(screen.getByRole('button', { name: 'New' }));
    expect(
      screen.getByRole('menuitem', { name: 'Native query' }),
    ).not.toHaveAttribute('data-disabled');

    await user.click(screen.getByRole('menuitem', { name: 'Logical model' }));
    expect(screen.getByText('Create logical model')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'author_result' },
    });
    fireEvent.change(screen.getByLabelText('Field 1 name'), {
      target: { value: 'id' },
    });
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Save logical model' })
        .closest('form')!,
    );
    expect(
      await screen.findByText('A logical model with this name already exists.'),
    ).toBeInTheDocument();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'new_result' },
    });
    await user.click(
      screen.getByRole('combobox', { name: 'Scalar type level 0' }),
    );
    await user.click(screen.getByRole('option', { name: 'uuid' }));
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Save logical model' })
        .closest('form')!,
    );
    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        args: {
          source: 'default',
          name: 'new_result',
          fields: [
            {
              name: 'id',
              type: { scalar: 'uuid', nullable: true },
            },
          ],
        },
      }),
    );
  });

  it('opens edit from the item menu and submits the existing model', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);

    await screen.findByText('author_result');
    await user.click(
      screen.getByRole('button', { name: 'Actions for author_result' }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: 'Edit logical model' }),
    );
    expect(screen.getByText(/Edit/)).toBeInTheDocument();
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Save logical model' })
        .closest('form')!,
    );

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.objectContaining({ name: 'author_result' }),
        }),
      ),
    );
  });

  it('opens logical model permissions from the item menu', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);

    await screen.findByText('author_result');
    await user.click(
      screen.getByRole('button', { name: 'Actions for author_result' }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: 'Edit permissions' }),
    );

    expect(
      screen.getByText('Roles & permissions overview'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'user select: full access' }),
    ).toBeInTheDocument();
  });

  it('opens native query creation and submits the form', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);

    await screen.findByText('search_authors');
    await user.click(screen.getByRole('button', { name: 'New' }));
    await user.click(screen.getByRole('menuitem', { name: 'Native query' }));
    expect(screen.getByText('Create native query')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Root field name'), {
      target: { value: 'search_authors' },
    });
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Save native query' })
        .closest('form')!,
    );
    expect(
      await screen.findByText(
        'A native query with this root field name already exists.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('SQL is required.')).toBeInTheDocument();
    expect(mocks.nativeQueryMutateAsync).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Root field name'), {
      target: { value: 'list_authors' },
    });
    fireEvent.change(screen.getByLabelText('SQL editor'), {
      target: { value: 'SELECT * FROM authors' },
    });
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Save native query' })
        .closest('form')!,
    );

    await waitFor(() =>
      expect(mocks.nativeQueryMutateAsync).toHaveBeenCalledWith({
        args: {
          source: 'default',
          root_field_name: 'list_authors',
          type: 'query',
          arguments: {},
          code: 'SELECT * FROM authors',
          returns: 'author_result',
        },
      }),
    );
  });

  it('navigates to native query relationships from the item menu', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);

    await screen.findByText('search_authors');
    await user.click(
      screen.getByRole('button', { name: 'Actions for search_authors' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Relationships' }));

    expect(mocks.router.push).toHaveBeenCalledWith(
      '/orgs/test/projects/local/database/native-queries/default/queries/search_authors#relationships',
    );
  });

  it('opens edit and delete flows for native queries', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);

    await screen.findByText('search_authors');
    await user.click(
      screen.getByRole('button', { name: 'Actions for search_authors' }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: 'Edit native query' }),
    );
    fireEvent.submit(
      screen
        .getByRole('button', { name: 'Save native query' })
        .closest('form')!,
    );
    await waitFor(() =>
      expect(mocks.nativeQueryMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          original: expect.objectContaining({
            root_field_name: 'search_authors',
          }),
          args: expect.objectContaining({ root_field_name: 'search_authors' }),
        }),
      ),
    );

    mocks.nativeQueryMutateAsync.mockClear();
    await user.click(
      screen.getByRole('button', { name: 'Actions for search_authors' }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: 'Delete native query' }),
    );
    expect(screen.getByText('Delete native query?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(mocks.nativeQueryMutateAsync).toHaveBeenCalledWith({
        original: expect.objectContaining({
          root_field_name: 'search_authors',
        }),
      }),
    );
  });

  it('confirms deletion from the logical model item menu', async () => {
    const user = new TestUserEvent();
    render(<NativeQueriesBrowserSidebar />);

    await screen.findByText('author_result');
    await user.click(
      screen.getByRole('button', { name: 'Actions for author_result' }),
    );
    await user.click(
      screen.getByRole('menuitem', { name: 'Delete logical model' }),
    );
    expect(screen.getByText('Delete logical model?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        original: expect.objectContaining({ name: 'author_result' }),
      }),
    );
  });
});
