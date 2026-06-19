import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { mockMatchMediaValue } from '@/tests/mocks';
import {
  createExportActionsMetadataHandler,
  HASURA_API_URL,
} from '@/tests/msw/mocks/rest/exportActionsMetadataQuery';
import {
  mockPointerEvent,
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import ActionsBrowserSidebar from './ActionsBrowserSidebar';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

// CreateActionForm (rendered by the sidebar) pulls in the CodeMirror editor.
vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value }: { value?: string }) => <textarea value={value} readOnly />,
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const server = setupServer(createExportActionsMetadataHandler());

describe('ActionsBrowserSidebar', () => {
  beforeAll(() => server.listen());

  beforeEach(() => {
    mockPointerEvent();
    queryClient.clear();
    mocks.useRouter.mockReturnValue({
      basePath: '',
      pathname: '/orgs/[orgSlug]/projects/[appSubdomain]/graphql/actions',
      route: '/orgs/[orgSlug]/projects/[appSubdomain]/graphql/actions',
      asPath: '/orgs/xyz/projects/test-project/graphql/actions',
      isReady: true,
      query: { orgSlug: 'xyz', appSubdomain: 'test-project' },
      push: vi.fn(),
      replace: vi.fn(),
      reload: vi.fn(),
      back: vi.fn(),
      prefetch: vi.fn(),
      beforePopState: vi.fn(),
      events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
      isFallback: false,
    });
  });

  afterEach(() => server.resetHandlers());

  afterAll(() => server.close());

  it('renders an entry for each action plus the Custom Types Editor link', async () => {
    render(<ActionsBrowserSidebar />);

    expect(await screen.findByTestId('action-menu-login')).toBeInTheDocument();
    expect(screen.getByTestId('action-menu-getProfile')).toBeInTheDocument();

    const customTypesLink = screen.getByRole('link', {
      name: /Custom Types Editor/i,
    });
    expect(customTypesLink).toHaveAttribute(
      'href',
      '/orgs/xyz/projects/test-project/graphql/actions/custom-types',
    );
  });

  it('filters the list by the search query (case-insensitive)', async () => {
    const user = new TestUserEvent();
    render(<ActionsBrowserSidebar />);

    await screen.findByTestId('action-menu-login');

    await user.type(screen.getByPlaceholderText('Search actions...'), 'PROFILE');

    await waitFor(() =>
      expect(screen.queryByTestId('action-menu-login')).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('action-menu-getProfile')).toBeInTheDocument();
  });

  it('shows "No actions found." when the search matches nothing', async () => {
    const user = new TestUserEvent();
    render(<ActionsBrowserSidebar />);

    await screen.findByTestId('action-menu-login');

    await user.type(
      screen.getByPlaceholderText('Search actions...'),
      'does-not-exist',
    );

    expect(await screen.findByText('No actions found.')).toBeInTheDocument();
  });

  it('shows an error message when actions fail to load', async () => {
    server.use(
      http.post(`${HASURA_API_URL}/v1/metadata`, () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
    );

    render(<ActionsBrowserSidebar />);

    expect(
      await screen.findByText('Actions could not be loaded.'),
    ).toBeInTheDocument();
  });
});
