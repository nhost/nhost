import { setupServer } from 'msw/node';
import { act } from 'react';
import { toast } from 'react-hot-toast';
import { NativeQueryDetails } from '@/features/orgs/projects/database/native-queries/components/NativeQueryDetails';
import { mockMatchMediaValue } from '@/tests/mocks';
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
}));

vi.mock('next/router', () => ({ useRouter: () => mocks.router }));
vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value }: { value: string }) => (
    <pre data-testid="sql-editor">{value}</pre>
  ),
}));

const server = setupServer(hasuraMetadataQuery);

describe('NativeQueryDetails', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  });

  afterEach(() => {
    queryClient.clear();
    server.resetHandlers();
    mocks.router.query.querySlug = 'search_authors';
    vi.clearAllMocks();
    act(() => toast.remove());
  });

  afterAll(() => server.close());

  it('renders the entity description separately from argument descriptions', async () => {
    render(<NativeQueryDetails />);

    expect(
      await screen.findByRole('heading', { name: 'search_authors' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Searches authors')).toBeInTheDocument();
    expect(screen.getByTestId('sql-editor')).toHaveTextContent(
      'SELECT * FROM authors WHERE name ILIKE {{search}}',
    );
    expect(screen.getByRole('link', { name: 'author_result' })).toHaveAttribute(
      'href',
      '/orgs/test/projects/local/database/native-queries/default/models/author_result',
    );
    expect(screen.getByText('search')).toBeInTheDocument();
    expect(screen.getByText('text')).toBeInTheDocument();
    expect(screen.getByText('Search text')).toBeInTheDocument();
    const whitespaceDescriptionRow = screen
      .getByText('blank_description')
      .closest('tr');
    expect(whitespaceDescriptionRow).not.toBeNull();
    expect(
      within(whitespaceDescriptionRow as HTMLTableRowElement).getByText('—'),
    ).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Relationships' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('1 object · 1 array')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'featured_author' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'search_authors' }),
    ).not.toBeInTheDocument();
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
