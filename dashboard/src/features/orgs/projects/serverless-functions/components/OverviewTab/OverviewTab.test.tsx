import { vi } from 'vitest';
import { mockMatchMediaValue } from '@/tests/mocks';
import { expectFullTextRendered, render, screen } from '@/tests/testUtils';
import OverviewTab from './OverviewTab';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  useIsPlatform: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: mocks.useIsPlatform,
}));

const baseFn = {
  path: 'functions/hello.ts',
  route: '/hello',
  runtime: 'nodejs22.x',
  functionName: 'hello',
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-02T00:00:00Z',
};

const ENDPOINT = 'https://app.example.com/v1/hello';

beforeEach(() => {
  mocks.useRouter.mockReturnValue({
    query: { orgSlug: 'org-1', appSubdomain: 'app-1' },
  });
  mocks.useIsPlatform.mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OverviewTab', () => {
  it('renders the default endpoint section only when defaultEndpointUrl is provided', () => {
    const { rerender } = render(
      <OverviewTab fn={baseFn} endpointUrl={ENDPOINT} />,
    );
    expect(screen.queryByText('Default endpoint')).not.toBeInTheDocument();

    rerender(
      <OverviewTab
        fn={baseFn}
        endpointUrl="https://custom.example.com/hello"
        defaultEndpointUrl={ENDPOINT}
      />,
    );
    expect(screen.getByText('Default endpoint')).toBeInTheDocument();
    expectFullTextRendered(ENDPOINT);
  });

  it('renders runtime, route, and file in the runtime card', () => {
    render(<OverviewTab fn={baseFn} endpointUrl={ENDPOINT} />);

    expect(screen.getByText('nodejs22.x')).toBeInTheDocument();
    expect(screen.getByText('Route')).toBeInTheDocument();
    expect(screen.getByText('File')).toBeInTheDocument();
  });

  it('shows the deployment card on platform when commit and checksum are present', () => {
    render(
      <OverviewTab
        fn={{
          ...baseFn,
          createdWithCommitSha: 'abcdef0123456789',
          checksum: 'sha-1234',
        }}
        endpointUrl={ENDPOINT}
      />,
    );

    expect(screen.getByText('Deployment')).toBeInTheDocument();
    expect(screen.getByText('Commit')).toBeInTheDocument();
    expect(screen.getByText('abcdef0')).toBeInTheDocument();
    expect(screen.getByText('Checksum')).toBeInTheDocument();
  });

  it('hides the deployment card when not on platform', () => {
    mocks.useIsPlatform.mockReturnValue(false);

    render(
      <OverviewTab
        fn={{
          ...baseFn,
          createdWithCommitSha: 'abcdef0123456789',
          checksum: 'sha-1234',
        }}
        endpointUrl={ENDPOINT}
      />,
    );

    expect(screen.queryByText('Deployment')).not.toBeInTheDocument();
    expect(screen.queryByText('Commit')).not.toBeInTheDocument();
  });

  it('hides the deployment card when commit and checksum are both empty', () => {
    render(<OverviewTab fn={baseFn} endpointUrl={ENDPOINT} />);

    expect(screen.queryByText('Deployment')).not.toBeInTheDocument();
  });

  it('renders the timestamps card when at least one date is set', () => {
    render(<OverviewTab fn={baseFn} endpointUrl={ENDPOINT} />);

    expect(screen.getByText('Timestamps')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Updated')).toBeInTheDocument();
  });

  it('hides the timestamps card when both dates are Go zero values', () => {
    render(
      <OverviewTab
        fn={{
          ...baseFn,
          createdAt: '0001-01-01T00:00:00Z',
          updatedAt: '0001-01-01T00:00:00Z',
        }}
        endpointUrl={ENDPOINT}
      />,
    );

    expect(screen.queryByText('Timestamps')).not.toBeInTheDocument();
  });
});
