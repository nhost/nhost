import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { mockMatchMediaValue } from '@/tests/mocks';
import { getProjectQuery } from '@/tests/msw/mocks/graphql/getProjectQuery';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import {
  expectFullTextRendered,
  render,
  screen,
  waitFor,
} from '@/tests/testUtils';
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

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

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
    isReady: true,
  });
  mocks.useIsPlatform.mockReturnValue(true);
  server.use(
    getProjectQuery,
    nhostGraphQLLink.query('getUnifiedDeploymentByCommitSHA', () =>
      HttpResponse.json({ data: { unifiedDeployments: [] } }),
    ),
  );
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

  it('links the commit to the specific deployment when found', async () => {
    server.use(
      nhostGraphQLLink.query('getUnifiedDeploymentByCommitSHA', () =>
        HttpResponse.json({
          data: { unifiedDeployments: [{ id: 'deployment-42' }] },
        }),
      ),
    );

    render(
      <OverviewTab
        fn={{ ...baseFn, createdWithCommitSha: 'abcdef0123456789' }}
        endpointUrl={ENDPOINT}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('abcdef0').closest('a')).toHaveAttribute(
        'href',
        '/orgs/org-1/projects/app-1/deployments/deployment-42',
      );
    });
  });

  it('falls back to the deployments list when no matching deployment is found', async () => {
    server.use(
      nhostGraphQLLink.query('getUnifiedDeploymentByCommitSHA', () =>
        HttpResponse.json({ data: { unifiedDeployments: [] } }),
      ),
    );

    render(
      <OverviewTab
        fn={{ ...baseFn, createdWithCommitSha: 'abcdef0123456789' }}
        endpointUrl={ENDPOINT}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('abcdef0').closest('a')).toHaveAttribute(
        'href',
        '/orgs/org-1/projects/app-1/deployments',
      );
    });
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
});
