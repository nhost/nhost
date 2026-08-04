import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import LogicalModelDetails from '@/features/orgs/projects/database/native-queries/components/LogicalModelDetails';
import NoLogicalModelsEmptyState from '@/features/orgs/projects/database/native-queries/components/NoLogicalModelsEmptyState';
import hasuraMetadataQuery from '@/tests/msw/mocks/rest/hasuraMetadataQuery';
import { queryClient, render, screen, within } from '@/tests/testUtils';

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
    queryClient.clear();
    server.resetHandlers();
    mocks.router.query.modelSlug = 'author_result';
    vi.clearAllMocks();
  });

  afterAll(() => server.close());

  it('renders fields with readable recursive types and permission roles', async () => {
    const { container } = render(<LogicalModelDetails />);

    expect(
      await screen.findByRole('heading', { name: 'author_result' }),
    ).toBeInTheDocument();
    expect(container.querySelector('.lucide-shapes')).toBeInTheDocument();
    const modelDescription = screen.getByText(
      'Author records returned by search',
    );
    expect(modelDescription.textContent).toBe(
      'Author records returned by search',
    );
    expect(modelDescription).toHaveClass('break-words');
    expect(modelDescription).toHaveStyle('-webkit-line-clamp: 3');
    const descriptionRow = modelDescription.closest('.max-w-prose');
    expect(descriptionRow).toHaveClass('text-muted-foreground', 'text-sm');
    expect(
      descriptionRow?.querySelector('.lucide-message-square-text'),
    ).toBeInTheDocument();
    expect(screen.getByText('uuid')).toBeInTheDocument();
    expect(screen.getByText('text | null')).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Description' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Primary identifier').textContent).toBe(
      'Primary identifier',
    );
    const whitespaceDescriptionRow = screen
      .getByText('display_name')
      .closest('tr');
    expect(whitespaceDescriptionRow).not.toBeNull();
    expect(
      within(whitespaceDescriptionRow as HTMLTableRowElement).getByText('—'),
    ).toBeInTheDocument();
    expect(screen.getByText('user')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'search_authors' }),
    ).toHaveAttribute(
      'href',
      '/orgs/test/projects/local/database/native-queries/default/queries/search_authors',
    );
  });

  it('renders nested arrays readably', async () => {
    mocks.router.query.modelSlug = 'author_collection';
    const { container } = render(<LogicalModelDetails />);

    expect(
      await screen.findByRole('heading', { name: 'author_collection' }),
    ).toBeInTheDocument();
    expect(
      container.querySelector('.lucide-message-square-text'),
    ).not.toBeInTheDocument();
    expect(container.querySelector('.max-w-prose')).not.toBeInTheDocument();
    expect(screen.getByText('author_result[]')).toBeInTheDocument();
    expect(
      screen.getByText('No roles have select permission.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('No native queries return this logical model.'),
    ).toBeInTheDocument();
  });

  it('renders a non-empty description that looks like an empty sentinel', async () => {
    server.use(
      http.post('https://local.hasura.local.nhost.run/v1/metadata', () =>
        HttpResponse.json({
          metadata: {
            version: 3,
            sources: [
              {
                name: 'default',
                kind: 'postgres',
                native_queries: [],
                logical_models: [
                  {
                    name: 'sentinel_description',
                    description: 'null',
                    fields: [],
                  },
                ],
              },
            ],
          },
          resource_version: 10,
        }),
      ),
    );
    mocks.router.query.modelSlug = 'sentinel_description';

    const { container } = render(<LogicalModelDetails />);

    expect(
      await screen.findByRole('heading', { name: 'sentinel_description' }),
    ).toBeInTheDocument();
    expect(screen.getByText('null')).toBeInTheDocument();
    expect(
      container.querySelector('.lucide-message-square-text'),
    ).toBeInTheDocument();
    expect(container.querySelector('.max-w-prose')).toBeInTheDocument();
  });

  it.each([
    ['missing', undefined],
    ['blank', ''],
    ['whitespace-only', '   '],
  ])('omits the description row for %s values', async (_, description) => {
    server.use(
      http.post('https://local.hasura.local.nhost.run/v1/metadata', () =>
        HttpResponse.json({
          metadata: {
            version: 3,
            sources: [
              {
                name: 'default',
                kind: 'postgres',
                native_queries: [],
                logical_models: [
                  {
                    name: 'empty_description',
                    description,
                    fields: [],
                  },
                ],
              },
            ],
          },
          resource_version: 10,
        }),
      ),
    );
    mocks.router.query.modelSlug = 'empty_description';

    const { container } = render(<LogicalModelDetails />);

    expect(
      await screen.findByRole('heading', { name: 'empty_description' }),
    ).toBeInTheDocument();
    expect(
      container.querySelector('.lucide-message-square-text'),
    ).not.toBeInTheDocument();
    expect(container.querySelector('.max-w-prose')).not.toBeInTheDocument();
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
    const { container } = render(<NoLogicalModelsEmptyState />);

    expect(
      screen.getByText('Create your first logical model'),
    ).toBeInTheDocument();
    expect(container.querySelector('.lucide-shapes')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'New logical model' }),
    ).toBeInTheDocument();
  });
});
