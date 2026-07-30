import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import LogicalModelDetails from '@/features/orgs/projects/database/native-queries/components/LogicalModelDetails';
import NoLogicalModelsEmptyState from '@/features/orgs/projects/database/native-queries/components/NoLogicalModelsEmptyState';
import hasuraMetadataQuery from '@/tests/msw/mocks/rest/hasuraMetadataQuery';
import { render, screen, TestUserEvent } from '@/tests/testUtils';

const mocks = vi.hoisted(() => ({
  router: {
    query: {
      orgSlug: 'test',
      appSubdomain: 'local',
      dataSourceSlug: 'default',
      modelSlug: 'author_result',
    },
    push: vi.fn(),
    events: { on: vi.fn(), off: vi.fn() },
  },
  mutateAsync: vi.fn(),
  reset: vi.fn(),
}));

vi.mock('next/router', () => ({ useRouter: () => mocks.router }));
vi.mock('@/features/orgs/hooks/useRemoteApplicationGQLClient', () => ({
  useRemoteApplicationGQLClient: () => ({}),
}));
vi.mock('@/generated/graphql', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/generated/graphql')>();
  return {
    ...actual,
    useGetRemoteAppRolesQuery: () => ({
      data: { authRoles: [{ role: 'user' }] },
      loading: false,
      error: undefined,
    }),
  };
});
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
  '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelPermissionMutation',
  () => ({
    default: () => ({
      mutateAsync: mocks.mutateAsync,
      reset: mocks.reset,
      isPending: false,
    }),
  }),
);
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

const server = setupServer(hasuraMetadataQuery);

describe('LogicalModelDetails', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

  afterEach(() => {
    server.resetHandlers();
    mocks.router.query.modelSlug = 'author_result';
    vi.clearAllMocks();
  });

  afterAll(() => server.close());

  it('renders fields with readable recursive types and permission roles', async () => {
    render(<LogicalModelDetails />);

    expect(
      await screen.findByRole('heading', { name: 'author_result' }),
    ).toBeInTheDocument();
    expect(screen.getByText('uuid')).toBeInTheDocument();
    expect(screen.getByText('text | null')).toBeInTheDocument();
    expect(screen.getByText('user')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'search_authors' }),
    ).toHaveAttribute(
      'href',
      '/orgs/test/projects/local/database/native-queries/default/queries/search_authors',
    );
  });

  it('opens permissions management from the summary', async () => {
    const user = new TestUserEvent();
    render(<LogicalModelDetails />);

    await screen.findByRole('heading', { name: 'author_result' });
    await user.click(screen.getByRole('button', { name: 'Edit permissions' }));

    expect(
      screen.getByText('Roles & permissions overview'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'user select: full access' }),
    ).toBeInTheDocument();
  });

  it('renders nested arrays readably', async () => {
    mocks.router.query.modelSlug = 'author_collection';
    render(<LogicalModelDetails />);

    expect(
      await screen.findByRole('heading', { name: 'author_collection' }),
    ).toBeInTheDocument();
    expect(screen.getByText('author_result[]')).toBeInTheDocument();
    expect(
      screen.getByText('No roles have select permission.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('No native queries return this logical model.'),
    ).toBeInTheDocument();
  });

  it('renders a not-found state for an unknown model', async () => {
    mocks.router.query.modelSlug = 'missing_model';
    render(<LogicalModelDetails />);

    expect(
      await screen.findByText('Logical model not found'),
    ).toBeInTheDocument();
    expect(screen.getByText('missing_model')).toBeInTheDocument();
  });

  it('renders the no-models empty state', () => {
    render(<NoLogicalModelsEmptyState />);

    expect(
      screen.getByText('Create your first logical model'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'New logical model' }),
    ).toBeInTheDocument();
  });
});
