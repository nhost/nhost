import { act } from 'react';
import { toast } from 'react-hot-toast';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import NativeQueryDetails from '@/features/orgs/projects/database/native-queries/components/NativeQueryDetails';
import hasuraMetadataQuery from '@/tests/msw/mocks/rest/hasuraMetadataQuery';
import { render, screen, } from '@/tests/testUtils';

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
    server.resetHandlers();
    mocks.router.query.querySlug = 'search_authors';
    vi.clearAllMocks();
    act(() => toast.remove());
  });

  afterAll(() => server.close());

  it('renders SQL, the return model link, and arguments', async () => {
    render(<NativeQueryDetails />);

    expect(
      await screen.findByRole('heading', { name: 'search_authors' }),
    ).toBeInTheDocument();
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
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('renders a not-found state for an unknown query', async () => {
    mocks.router.query.querySlug = 'missing_query';
    render(<NativeQueryDetails />);

    expect(await screen.findByText('Native query not found')).toBeInTheDocument();
    expect(screen.getByText('missing_query')).toBeInTheDocument();
  });

});
