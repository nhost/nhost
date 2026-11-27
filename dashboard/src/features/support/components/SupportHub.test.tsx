import { setupServer } from 'msw/node';
import { vi } from 'vitest';
import { getSupportHubLayout } from '@/features/support/components/SupportArea';
import SupportHub from '@/features/support/components/SupportHub';
import { AuthContext } from '@/providers/Auth';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { render, screen } from '@/tests/testUtils';

const server = setupServer(tokenQuery);
let requests: string[] = [];

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  server.events.on('request:start', ({ request }) => {
    requests.push(request.url);
  });
});
beforeEach(() => {
  requests = [];
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
});
afterEach(() => {
  server.resetHandlers();
  vi.unstubAllEnvs();
});
afterAll(() => server.close());

describe('SupportHub', () => {
  it('works for signed-out visitors without loading session data', async () => {
    render(
      <AuthContext.Provider
        value={{
          user: null,
          session: null,
          isAuthenticated: false,
          isLoading: false,
          isSigningOut: false,
          signout: vi.fn(async () => {}),
          updateSession: vi.fn(),
          clearIsSigningOut: vi.fn(),
        }}
      >
        {getSupportHubLayout(<SupportHub />)}
      </AuthContext.Provider>,
    );

    expect(
      await screen.findByRole('heading', { name: 'How can we help?' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(
      screen.getByRole('link', { name: /Contact support/ }),
    ).toHaveAttribute('href', '/support/tickets');
    expect(screen.getByRole('link', { name: /Read the docs/ })).toHaveAttribute(
      'href',
      'https://docs.nhost.io',
    );
    expect(
      screen.getByRole('link', { name: /Ask the community/ }),
    ).toHaveAttribute('href', 'https://discord.com/invite/9V7Qb2U');
    expect(
      screen.getByRole('link', { name: /Report on GitHub/ }),
    ).toHaveAttribute(
      'href',
      'https://github.com/nhost/nhost/issues/new/choose',
    );
    expect(requests.filter((url) => url.includes('graphql'))).toEqual([]);
  });
});
