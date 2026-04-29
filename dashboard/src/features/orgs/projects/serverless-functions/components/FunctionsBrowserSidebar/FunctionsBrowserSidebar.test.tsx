import { vi } from 'vitest';
import { mockMatchMediaValue } from '@/tests/mocks';
import { render, screen } from '@/tests/testUtils';
import FunctionsBrowserSidebar from './FunctionsBrowserSidebar';

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

const mockFunctions = [
  {
    path: 'functions/zeta.ts',
    route: '/zeta',
    runtime: 'nodejs22.x',
    functionName: 'zeta',
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
  },
  {
    path: 'functions/alpha.ts',
    route: '/alpha',
    runtime: 'nodejs22.x',
    functionName: 'alpha',
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
  },
];

beforeEach(() => {
  mocks.useRouter.mockReturnValue({
    query: {
      orgSlug: 'org-1',
      appSubdomain: 'app-1',
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('FunctionsBrowserSidebar', () => {
  it('shows a spinner while functions are loading', () => {
    mocks.useGetNhostFunctions.mockReturnValue({
      data: [],
      loading: true,
      error: null,
    });

    render(<FunctionsBrowserSidebar />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows an error message when functions cannot be loaded', () => {
    mocks.useGetNhostFunctions.mockReturnValue({
      data: [],
      loading: false,
      error: new Error('boom'),
    });

    render(<FunctionsBrowserSidebar />);

    expect(
      screen.getByText('Functions could not be loaded.'),
    ).toBeInTheDocument();
  });

  it('renders functions sorted alphabetically by path', () => {
    mocks.useGetNhostFunctions.mockReturnValue({
      data: mockFunctions,
      loading: false,
      error: null,
    });

    render(<FunctionsBrowserSidebar />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(mockFunctions.length);
    expect(links[0]).toHaveTextContent('/alpha');
    expect(links[1]).toHaveTextContent('/zeta');
  });
});
