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

const fn = {
  path: 'functions/hello.ts',
  route: '/hello',
  runtime: 'nodejs22.x',
  functionName: 'hello',
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-02T00:00:00Z',
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
});
