import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { mockMatchMediaValue } from '@/tests/mocks';
import {
  createExportActionsMetadataHandler,
  HASURA_API_URL,
} from '@/tests/msw/mocks/rest/exportActionsMetadataQuery';
import {
  expectFullTextRendered,
  mockPointerEvent,
  queryClient,
  render,
  screen,
} from '@/tests/testUtils';
import ActionDetails from './ActionDetails';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value }: { value?: string }) => (
    <textarea value={value} readOnly />
  ),
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const server = setupServer(createExportActionsMetadataHandler());

function mockRouter(actionSlug: string) {
  mocks.useRouter.mockReturnValue({
    basePath: '',
    pathname:
      '/orgs/[orgSlug]/projects/[appSubdomain]/graphql/actions/[actionSlug]',
    route:
      '/orgs/[orgSlug]/projects/[appSubdomain]/graphql/actions/[actionSlug]',
    asPath: `/orgs/xyz/projects/test-project/graphql/actions/${actionSlug}`,
    isReady: true,
    query: { orgSlug: 'xyz', appSubdomain: 'test-project', actionSlug },
    push: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
    beforePopState: vi.fn(),
    events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
    isFallback: false,
  });
}

describe('ActionDetails', () => {
  beforeAll(() => server.listen());

  beforeEach(() => {
    mockPointerEvent();
    queryClient.clear();
  });

  afterEach(() => server.resetHandlers());

  afterAll(() => server.close());

  it('renders the action header for an existing action', async () => {
    mockRouter('login');
    render(<ActionDetails />);

    expect(
      await screen.findByRole('heading', { name: 'login' }),
    ).toBeInTheDocument();
    expectFullTextRendered('Logs a user in');
  });

  it('shows a not-found state when the action does not exist', async () => {
    server.use(
      createExportActionsMetadataHandler({ actions: [], customTypes: {} }),
    );
    mockRouter('login');
    render(<ActionDetails />);

    expect(await screen.findByText(/does not exist/i)).toBeInTheDocument();
  });

  it('shows an error state when actions fail to load', async () => {
    server.use(
      http.post(`${HASURA_API_URL}/v1/metadata`, () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
    );
    mockRouter('login');
    render(<ActionDetails />);

    expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument();
  });
});
