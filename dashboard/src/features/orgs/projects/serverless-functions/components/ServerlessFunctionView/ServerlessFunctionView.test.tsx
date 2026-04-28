import { vi } from 'vitest';
import { mockMatchMediaValue } from '@/tests/mocks';
import { render, screen } from '@/tests/testUtils';
import ServerlessFunctionView from './ServerlessFunctionView';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  useGetNhostFunctions: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

vi.mock(
  '@/features/orgs/projects/serverless-functions/hooks/useGetNhostFunctions',
  () => ({
    __esModule: true,
    default: mocks.useGetNhostFunctions,
    useGetNhostFunctions: mocks.useGetNhostFunctions,
  }),
);

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

beforeEach(() => {
  mocks.useRouter.mockReturnValue({
    query: { functionSlug: 'hello' },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ServerlessFunctionView', () => {
  it('shows a spinner while functions are loading', () => {
    mocks.useGetNhostFunctions.mockReturnValue({
      data: [],
      loading: true,
      error: null,
    });

    render(<ServerlessFunctionView />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows the "does not exist" empty state when functions cannot be loaded', () => {
    mocks.useGetNhostFunctions.mockReturnValue({
      data: [],
      loading: false,
      error: new Error('boom'),
    });

    render(<ServerlessFunctionView />);

    expect(screen.getByText('Function not found')).toBeInTheDocument();
    expect(screen.getByText(/does not exist/)).toBeInTheDocument();
    expect(screen.getByText('/hello')).toBeInTheDocument();
  });

  it('shows a "does not exist" empty state when the slug does not match any function', () => {
    mocks.useRouter.mockReturnValue({
      query: { functionSlug: 'unknown' },
    });
    mocks.useGetNhostFunctions.mockReturnValue({
      data: [mockFunction],
      loading: false,
      error: null,
    });

    render(<ServerlessFunctionView />);

    expect(screen.getByText('Function not found')).toBeInTheDocument();
    expect(screen.getByText(/does not exist/)).toBeInTheDocument();
    expect(screen.getByText('/unknown')).toBeInTheDocument();
  });

  it('renders the details panel when the slug matches a function', () => {
    mocks.useGetNhostFunctions.mockReturnValue({
      data: [mockFunction],
      loading: false,
      error: null,
    });

    render(<ServerlessFunctionView />);

    expect(screen.getByTestId('function-details-panel')).toHaveTextContent(
      '/hello',
    );
  });

  it('joins array slugs (catch-all routes) before matching', () => {
    mocks.useRouter.mockReturnValue({
      query: { functionSlug: ['nested', 'hello'] },
    });
    mocks.useGetNhostFunctions.mockReturnValue({
      data: [{ ...mockFunction, route: '/nested/hello' }],
      loading: false,
      error: null,
    });

    render(<ServerlessFunctionView />);

    expect(screen.getByTestId('function-details-panel')).toHaveTextContent(
      '/nested/hello',
    );
  });
});
