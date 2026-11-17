import { setupServer } from 'msw/node';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { vi } from 'vitest';
import { AuthArea } from '@/features/orgs/projects/authentication/layout';
import { mockMatchMediaValue, mockRouter } from '@/tests/mocks';
import {
  getProjectQuery,
  getProjectStateQuery,
} from '@/tests/msw/mocks/graphql/getProjectQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  mockScrollIntoViewAndPointerCapture,
  queryClient,
  render,
  screen,
  TestUserEvent,
  within,
} from '@/tests/testUtils';
import { ApplicationStatus } from '@/types/application';

vi.mock('next/router', () => ({ useRouter: vi.fn() }));
vi.mock('@/features/orgs/projects/common/hooks/useAppPausedReason', () => ({
  useAppPausedReason: () => ({
    isLocked: false,
    lockedReason: '',
    freeAndLiveProjectsNumberExceeded: false,
    loading: false,
  }),
}));

const server = setupServer(tokenQuery, getProjectQuery);
const AUTH_ROUTE = '/orgs/[orgSlug]/projects/[appSubdomain]/auth';
const AUTH_PATH = '/orgs/xyz/projects/test-project/auth';
const childMounted = vi.fn();

function PageContent() {
  useEffect(() => {
    childMounted();
  }, []);

  return <h1>Auth content</h1>;
}

function renderRoute(route: string, path: string) {
  vi.mocked(useRouter).mockReturnValue({
    ...mockRouter,
    route: `${AUTH_ROUTE}${route}`,
    pathname: `${AUTH_ROUTE}${route}`,
    asPath: `${AUTH_PATH}${path}`,
    query: { orgSlug: 'xyz', appSubdomain: 'test-project' },
  });

  return render(
    <AuthArea>
      <PageContent />
    </AuthArea>,
  );
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

beforeEach(() => {
  mockScrollIntoViewAndPointerCapture();
  vi.mocked(mockRouter.push).mockResolvedValue(true);
  vi.mocked(mockRouter.prefetch).mockResolvedValue(undefined);
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    ...mockMatchMediaValue(query),
    matches: true,
  }));
  server.use(
    getProjectStateQuery([{ stateId: ApplicationStatus.Paused }], {
      desiredState: ApplicationStatus.Paused,
    }),
  );
});

afterEach(() => {
  queryClient.clear();
  server.resetHandlers();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

afterAll(() => {
  server.close();
});

describe('AuthArea', () => {
  it.each([
    ['/users', '/users', 'Users'],
    ['/oauth2-clients', '/oauth2-clients', 'OAuth2 Clients'],
  ])(
    'keeps navigation above the state gate on %s',
    async (route, path, activeTab) => {
      renderRoute(route, path);

      expect(
        await screen.findByText(
          'This project is paused. Unpause to make this available.',
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: 'Auth content' }),
      ).not.toBeInTheDocument();
      expect(childMounted).not.toHaveBeenCalled();

      const navigation = screen.getByRole('navigation', {
        name: 'Auth section navigation',
      });
      expect(
        within(navigation).getByRole('link', { name: activeTab }),
      ).toHaveAttribute('aria-current', 'page');
      expect(
        within(navigation).getAllByRole('link', { current: 'page' }),
      ).toHaveLength(1);
      expect(
        within(navigation).getByRole('link', { name: 'Settings' }),
      ).toHaveAttribute('href', `${AUTH_PATH}/settings`);
    },
  );

  it.each([
    ['/users', '/users', 'Users'],
    ['/oauth2-clients', '/oauth2-clients', 'OAuth2 Clients'],
    ['/settings', '/settings?tab=jwt', 'Settings'],
  ])('selects the current mobile tab on %s', async (route, path, activeTab) => {
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
    renderRoute(route, path);

    expect(
      await screen.findByRole('combobox', {
        name: 'Auth section navigation',
      }),
    ).toHaveTextContent(activeTab);
  });

  it('navigates from a paused page to settings using the mobile selector', async () => {
    window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
    const user = new TestUserEvent();
    renderRoute('/users', '/users');

    await screen.findByText(
      'This project is paused. Unpause to make this available.',
    );
    await user.click(
      screen.getByRole('combobox', { name: 'Auth section navigation' }),
    );
    await user.click(screen.getByRole('option', { name: 'Settings' }));

    expect(mockRouter.push).toHaveBeenCalledWith(`${AUTH_PATH}/settings`);
    expect(childMounted).not.toHaveBeenCalled();
  });

  describe('without a config server', () => {
    beforeEach(() => {
      vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
      vi.stubEnv('NEXT_PUBLIC_NHOST_CONFIGSERVER_URL', '');
    });

    it('disables the settings tab on desktop', () => {
      renderRoute('/users', '/users');

      const navigation = screen.getByRole('navigation', {
        name: 'Auth section navigation',
      });
      expect(
        within(navigation).queryByRole('link', { name: 'Settings' }),
      ).not.toBeInTheDocument();
      expect(within(navigation).getByText('Settings')).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });

    it('disables the settings option on mobile', async () => {
      window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
      const user = new TestUserEvent();
      renderRoute('/users', '/users');

      await user.click(
        screen.getByRole('combobox', { name: 'Auth section navigation' }),
      );
      const settings = screen.getByRole('option', { name: 'Settings' });
      expect(settings).toHaveAttribute('aria-disabled', 'true');

      await user.click(settings);
      expect(mockRouter.push).not.toHaveBeenCalled();
    });
  });

  it('enables settings with a local config server', () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
    vi.stubEnv(
      'NEXT_PUBLIC_NHOST_CONFIGSERVER_URL',
      'https://local.graphql.local.nhost.run/v1',
    );
    renderRoute('/users', '/users');

    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      `${AUTH_PATH}/settings`,
    );
  });

  it('leaves settings content available while the project is paused', async () => {
    renderRoute('/settings', '/settings?tab=jwt');

    expect(
      await screen.findByRole('heading', { name: 'Auth content' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(childMounted).toHaveBeenCalledOnce();
  });

  it('renders Auth content when the project is live', async () => {
    server.use(getProjectStateQuery([{ stateId: ApplicationStatus.Live }]));
    renderRoute('/users', '/users');

    expect(
      await screen.findByRole('heading', { name: 'Auth content' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(childMounted).toHaveBeenCalledOnce();
  });
});
