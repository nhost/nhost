import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { mockMatchMediaValue } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import {
  expectFullTextRendered,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import FunctionDetailsPanel from './FunctionDetailsPanel';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  useIsPlatform: vi.fn(),
  useProject: vi.fn(),
  useAppClient: vi.fn(),
  useLocalMimirClient: vi.fn(),
  useCurrentOrg: vi.fn(),
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

vi.mock('@/features/orgs/projects/hooks/useLocalMimirClient', () => ({
  useLocalMimirClient: mocks.useLocalMimirClient,
}));

vi.mock('@/features/orgs/projects/hooks/useCurrentOrg', () => ({
  useCurrentOrg: mocks.useCurrentOrg,
}));

// jsdom has no layout engine, so the ResizeObserver-backed useMeasure never
// reports a size: `width` stays null and MetricsTab floors it to chartWidth = 0.
// That leaves useFunctionMetrics gated on `committedWidth > 0`, so the metrics
// query never fires — without this mock the "metrics tab" test below hangs on
// "No data available." and fails. Report a real width so the query runs.
vi.mock('@uidotdev/usehooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@uidotdev/usehooks')>();
  const measureRef = () => {};
  const measured = { width: 800, height: 400 };
  return {
    ...actual,
    useMeasure: () => [measureRef, measured],
  };
});

const fn = {
  path: 'functions/hello.ts',
  route: '/hello',
  runtime: 'nodejs22.x',
  functionName: 'hello',
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-02T00:00:00Z',
};

const PAYWALL_TITLE =
  'To unlock Function Metrics, transfer this project to a Pro or Team organization.';

// All metrics series empty → MetricsTab reaches its data branch and every
// chart/table shows "No data available." without mounting Recharts.
const EMPTY_METRICS = {
  totalInvocations: [],
  totalBytesSent: [],
  totalDuration: [],
  totalErrors: [],
  totalRequestsByMethod: [],
  invocations: [],
  responseStatus: [],
  averageResponseSize: [],
  averageResponseTime: [],
  errorRate: [],
  durationP75: [],
  durationP95: [],
  durationMax: [],
};

const metricsRouter = {
  pathname: '/orgs/[orgSlug]/projects/[appSubdomain]/functions/[functionSlug]',
  asPath: '/orgs/org-1/projects/app-1/functions/hello?tab=metrics',
  query: {
    orgSlug: 'org-1',
    appSubdomain: 'app-1',
    functionSlug: 'hello',
    tab: 'metrics',
  },
  isReady: true,
  replace: vi.fn(),
  push: vi.fn(),
};

const settingsHandler = (data: Record<string, unknown>) =>
  nhostGraphQLLink.query('GetServerlessFunctionsSettings', () =>
    HttpResponse.json({ data }),
  );

const server = setupServer(settingsHandler({ config: null }));

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers(settingsHandler({ config: null }));
  vi.restoreAllMocks();
});
afterAll(() => server.close());

beforeEach(() => {
  mocks.useRouter.mockReturnValue({
    pathname:
      '/orgs/[orgSlug]/projects/[appSubdomain]/functions/[functionSlug]',
    query: {
      orgSlug: 'org-1',
      appSubdomain: 'app-1',
      functionSlug: 'hello',
    },
    replace: vi.fn(),
  });
  mocks.useIsPlatform.mockReturnValue(true);
  mocks.useProject.mockReturnValue({
    project: { id: 'project-id' },
  });
  mocks.useAppClient.mockReturnValue({
    functions: { baseURL: 'https://app.example.com/v1' },
  });
  mocks.useLocalMimirClient.mockReturnValue(null);
  mocks.useCurrentOrg.mockReturnValue({
    org: undefined,
    loading: false,
    error: null,
    refetch: vi.fn(),
  });
});

describe('FunctionDetailsPanel', () => {
  it('renders the function route as the heading and the file path', () => {
    render(<FunctionDetailsPanel fn={fn} />);

    expect(
      screen.getByRole('heading', { level: 1, name: '/hello' }),
    ).toBeInTheDocument();
    expect(screen.getByText('functions/hello.ts')).toBeInTheDocument();
  });

  it('renders Overview, Execute, and Logs tabs', () => {
    render(<FunctionDetailsPanel fn={fn} />);

    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Execute' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Logs' })).toBeInTheDocument();
  });

  it('changes tab via router.replace when a different tab is clicked', async () => {
    const replace = vi.fn();
    mocks.useRouter.mockReturnValue({
      pathname:
        '/orgs/[orgSlug]/projects/[appSubdomain]/functions/[functionSlug]',
      query: {
        orgSlug: 'org-1',
        appSubdomain: 'app-1',
        functionSlug: 'hello',
      },
      replace,
    });

    render(<FunctionDetailsPanel fn={fn} />);

    const user = new TestUserEvent({ pointerEventsCheck: 0 });
    await user.click(screen.getByRole('tab', { name: 'Execute' }));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({ tab: 'execute' }),
        }),
        undefined,
        expect.objectContaining({ shallow: true, scroll: false }),
      );
    });
  });

  it('renders Created and Last Updated relative times in the header when dates are real', () => {
    render(<FunctionDetailsPanel fn={fn} />);

    expect(screen.getByText(/Created .* ago/)).toBeInTheDocument();
    expect(screen.getByText(/Last Updated .* ago/)).toBeInTheDocument();
  });

  it('hides the timestamps row when both dates are Go zero values', () => {
    render(
      <FunctionDetailsPanel
        fn={{
          ...fn,
          createdAt: '0001-01-01T00:00:00Z',
          updatedAt: '0001-01-01T00:00:00Z',
        }}
      />,
    );

    expect(screen.queryByText(/Created .* ago/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Last Updated .* ago/)).not.toBeInTheDocument();
  });

  it('shows only Last Updated when createdAt is a Go zero value', () => {
    render(
      <FunctionDetailsPanel
        fn={{ ...fn, createdAt: '0001-01-01T00:00:00Z' }}
      />,
    );

    expect(screen.queryByText(/Created .* ago/)).not.toBeInTheDocument();
    expect(screen.getByText(/Last Updated .* ago/)).toBeInTheDocument();
  });

  it('uses the custom-domain endpoint URL when GraphQL returns an FQDN', async () => {
    server.use(
      settingsHandler({
        config: {
          functions: {
            resources: {
              networking: {
                ingresses: [{ fqdn: ['custom.example.com'] }],
              },
            },
          },
        },
      }),
    );

    mocks.useRouter.mockReturnValue({
      pathname:
        '/orgs/[orgSlug]/projects/[appSubdomain]/functions/[functionSlug]',
      query: {
        orgSlug: 'org-1',
        appSubdomain: 'app-1',
        functionSlug: 'hello',
        tab: 'overview',
      },
      replace: vi.fn(),
    });

    render(<FunctionDetailsPanel fn={fn} />);

    const expectedUrl = 'https://custom.example.com/v1/hello';
    await waitFor(() => {
      expectFullTextRendered(expectedUrl);
    });
  });

  it('disables the Metrics tab and redirects to /404 on a non-platform project', async () => {
    const push = vi.fn();
    mocks.useIsPlatform.mockReturnValue(false);
    mocks.useRouter.mockReturnValue({ ...metricsRouter, push });

    render(<FunctionDetailsPanel fn={fn} />);

    expect(screen.getByRole('tab', { name: 'Metrics' })).toBeDisabled();
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/404');
    });
    expect(
      screen.queryByTestId('metricsTimeRangeTrigger'),
    ).not.toBeInTheDocument();
  });

  it('shows the upgrade paywall instead of metrics for a free organization', async () => {
    mocks.useRouter.mockReturnValue(metricsRouter);
    mocks.useCurrentOrg.mockReturnValue({
      org: { plan: { isFree: true } },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<FunctionDetailsPanel fn={fn} />);

    expect(await screen.findByText(PAYWALL_TITLE)).toBeInTheDocument();
    expect(
      screen.queryByTestId('metricsTimeRangeTrigger'),
    ).not.toBeInTheDocument();
  });

  it('renders the metrics tab for a paid organization on a platform project', async () => {
    server.use(
      nhostGraphQLLink.query('getFunctionsMetricsDashboard', () =>
        HttpResponse.json({ data: EMPTY_METRICS }),
      ),
    );
    mocks.useRouter.mockReturnValue(metricsRouter);
    mocks.useCurrentOrg.mockReturnValue({
      org: { plan: { isFree: false } },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<FunctionDetailsPanel fn={fn} />);

    expect(
      await screen.findByTestId('metricsTimeRangeTrigger'),
    ).toBeInTheDocument();
    await screen.findAllByText('No data available.');
    expect(screen.queryByText(PAYWALL_TITLE)).not.toBeInTheDocument();
  });
});
