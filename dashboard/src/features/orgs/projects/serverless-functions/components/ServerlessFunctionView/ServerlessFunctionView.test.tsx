import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { mockMatchMediaValue } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import {
  createGraphqlMockResolver,
  queryClient,
  render,
  screen,
  waitFor,
} from '@/tests/testUtils';
import ServerlessFunctionView from './ServerlessFunctionView';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  useIsPlatform: vi.fn(),
  useProject: vi.fn(),
  useAppClient: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: mocks.useIsPlatform,
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));

vi.mock('@/features/orgs/projects/hooks/useAppClient', () => ({
  useAppClient: mocks.useAppClient,
}));

vi.mock(
  '@/features/orgs/projects/serverless-functions/components/FunctionDetailsPanel',
  () => ({
    __esModule: true,
    FunctionDetailsPanel: ({ fn }: { fn: { route: string } }) => (
      <div data-testid="function-details-panel">{fn.route}</div>
    ),
  }),
);

const mockFunction = {
  path: 'functions/hello.ts',
  route: '/hello',
  runtime: 'nodejs22.x',
  functionName: 'hello',
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-01T00:00:00Z',
};

const functionsHandler = (functions: unknown[]) =>
  nhostGraphQLLink.query('getAppFunctionsMetadata', () =>
    HttpResponse.json({
      data: {
        app: {
          id: 'project-id',
          metadataFunctions: functions,
        },
      },
    }),
  );

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

beforeEach(() => {
  mocks.useRouter.mockReturnValue({
    query: { functionSlug: 'hello' },
  });
  mocks.useIsPlatform.mockReturnValue(true);
  mocks.useProject.mockReturnValue({
    project: { id: 'project-id' },
  });
  mocks.useAppClient.mockReturnValue({
    functions: { baseURL: 'https://app.example.com/v1' },
  });
});

describe('ServerlessFunctionView', () => {
  it('shows a spinner while functions are loading', () => {
    const resolver = createGraphqlMockResolver(
      'getAppFunctionsMetadata',
      'query',
    );
    server.use(resolver.handler);

    render(<ServerlessFunctionView />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows the "does not exist" empty state when functions cannot be loaded', async () => {
    server.use(
      nhostGraphQLLink.query('getAppFunctionsMetadata', () =>
        HttpResponse.json({ data: { app: null } }),
      ),
    );

    render(<ServerlessFunctionView />);

    await waitFor(() => {
      expect(screen.getByText('Function not found')).toBeInTheDocument();
    });
    expect(screen.getByText(/does not exist/)).toBeInTheDocument();
    expect(screen.getByText('/hello')).toBeInTheDocument();
  });

  it('shows a "does not exist" empty state when the slug does not match any function', async () => {
    mocks.useRouter.mockReturnValue({
      query: { functionSlug: 'unknown' },
    });
    server.use(functionsHandler([mockFunction]));

    render(<ServerlessFunctionView />);

    await waitFor(() => {
      expect(screen.getByText('Function not found')).toBeInTheDocument();
    });
    expect(screen.getByText(/does not exist/)).toBeInTheDocument();
    expect(screen.getByText('/unknown')).toBeInTheDocument();
  });

  it('renders the details panel when the slug matches a function', async () => {
    server.use(functionsHandler([mockFunction]));

    render(<ServerlessFunctionView />);

    await waitFor(() => {
      expect(screen.getByTestId('function-details-panel')).toHaveTextContent(
        '/hello',
      );
    });
  });

  it('joins array slugs (catch-all routes) before matching', async () => {
    mocks.useRouter.mockReturnValue({
      query: { functionSlug: ['nested', 'hello'] },
    });
    server.use(functionsHandler([{ ...mockFunction, route: '/nested/hello' }]));

    render(<ServerlessFunctionView />);

    await waitFor(() => {
      expect(screen.getByTestId('function-details-panel')).toHaveTextContent(
        '/nested/hello',
      );
    });
  });
});
