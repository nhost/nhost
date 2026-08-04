import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { act } from 'react';
import { toast } from 'react-hot-toast';
import { vi } from 'vitest';
import NativeQueryDetails from '@/features/orgs/projects/database/native-queries/components/NativeQueryDetails';
import hasuraMetadataQuery from '@/tests/msw/mocks/rest/hasuraMetadataQuery';
import { queryClient, render, screen, within } from '@/tests/testUtils';

const mocks = vi.hoisted(() => ({
  router: {
    query: {
      orgSlug: 'test',
      appSubdomain: 'local',
      dataSourceSlug: 'default',
      querySlug: 'search_authors',
    },
    push: vi.fn(),
    events: { on: vi.fn(), off: vi.fn() },
  },
  mutateAsync: vi.fn(),
  reset: vi.fn(),
}));

vi.mock('next/router', () => ({ useRouter: () => mocks.router }));
vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value }: { value: string }) => (
    <pre data-testid="sql-editor">{value}</pre>
  ),
}));
vi.mock(
  '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation',
  () => ({
    default: () => ({
      mutateAsync: mocks.mutateAsync,
      reset: mocks.reset,
      isPending: false,
    }),
  }),
);

const server = setupServer(hasuraMetadataQuery);

describe('NativeQueryDetails', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
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
  });

  afterEach(() => {
    queryClient.clear();
    server.resetHandlers();
    mocks.router.query.querySlug = 'search_authors';
    vi.clearAllMocks();
    act(() => toast.remove());
  });

  afterAll(() => server.close());

  it('renders the entity comment separately from argument descriptions', async () => {
    const { container } = render(<NativeQueryDetails />);

    expect(
      await screen.findByRole('heading', { name: 'search_authors' }),
    ).toBeInTheDocument();
    const queryDescription = screen.getByText('Searches authors');
    expect(queryDescription).toHaveClass('break-words');
    expect(queryDescription).toHaveStyle('-webkit-line-clamp: 3');
    const descriptionRow = queryDescription.closest('.max-w-prose');
    expect(descriptionRow).toHaveClass('text-muted-foreground', 'text-sm');
    expect(
      descriptionRow?.querySelector('.lucide-message-square-text'),
    ).toBeInTheDocument();
    expect(
      container.querySelectorAll('.lucide-message-square-text'),
    ).toHaveLength(1);
    expect(screen.getByTestId('sql-editor')).toHaveTextContent(
      'SELECT * FROM authors WHERE name ILIKE {{search}}',
    );
    expect(screen.getByRole('link', { name: 'author_result' })).toHaveAttribute(
      'href',
      '/orgs/test/projects/local/database/native-queries/default/models/author_result',
    );
    expect(screen.getByText('search')).toBeInTheDocument();
    expect(screen.getByText('text')).toBeInTheDocument();
    expect(screen.getByText('Search text').textContent).toBe('Search text');
    const whitespaceDescriptionRow = screen
      .getByText('blank_description')
      .closest('tr');
    expect(whitespaceDescriptionRow).not.toBeNull();
    expect(
      within(whitespaceDescriptionRow as HTMLTableRowElement).getByText('—'),
    ).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
    expect(screen.getByText('1 object · 1 array')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'featured_author' }),
    ).toHaveAttribute(
      'href',
      '/orgs/test/projects/local/database/native-queries/default/queries/featured_author',
    );
    expect(
      screen.getByRole('link', { name: 'search_authors' }),
    ).toHaveAttribute(
      'href',
      '/orgs/test/projects/local/database/native-queries/default/queries/search_authors',
    );
  });

  it('renders a non-empty comment that looks like an empty sentinel', async () => {
    server.use(
      http.post('https://local.hasura.local.nhost.run/v1/metadata', () =>
        HttpResponse.json({
          metadata: {
            version: 3,
            sources: [
              {
                name: 'default',
                kind: 'postgres',
                native_queries: [
                  {
                    root_field_name: 'search_authors',
                    type: 'query',
                    arguments: {},
                    code: 'SELECT 1',
                    returns: 'author_result',
                    comment: 'null',
                  },
                ],
                logical_models: [{ name: 'author_result', fields: [] }],
              },
            ],
          },
          resource_version: 10,
        }),
      ),
    );

    const { container } = render(<NativeQueryDetails />);

    expect(
      await screen.findByRole('heading', { name: 'search_authors' }),
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
  ])('omits the comment row for %s values', async (_, comment) => {
    server.use(
      http.post('https://local.hasura.local.nhost.run/v1/metadata', () =>
        HttpResponse.json({
          metadata: {
            version: 3,
            sources: [
              {
                name: 'default',
                kind: 'postgres',
                native_queries: [
                  {
                    root_field_name: 'search_authors',
                    type: 'query',
                    arguments: {},
                    code: 'SELECT 1',
                    returns: 'author_result',
                    comment,
                  },
                ],
                logical_models: [{ name: 'author_result', fields: [] }],
              },
            ],
          },
          resource_version: 10,
        }),
      ),
    );

    const { container } = render(<NativeQueryDetails />);

    expect(
      await screen.findByRole('heading', { name: 'search_authors' }),
    ).toBeInTheDocument();
    expect(
      container.querySelector('.lucide-message-square-text'),
    ).not.toBeInTheDocument();
    expect(container.querySelector('.max-w-prose')).not.toBeInTheDocument();
  });

  it('renders a not-found state for an unknown query', async () => {
    mocks.router.query.querySlug = 'missing_query';
    render(<NativeQueryDetails />);

    expect(
      await screen.findByText('Native query not found'),
    ).toBeInTheDocument();
    expect(screen.getByText('missing_query')).toBeInTheDocument();
  });
});
