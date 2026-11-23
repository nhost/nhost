import { HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { mockMatchMediaValue } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import { render, screen } from '@/tests/testUtils';
import AccountProfileHeader from './AccountProfileHeader';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const server = setupServer(
  nhostGraphQLLink.query('securityKeys', () =>
    HttpResponse.json({ data: { authUserSecurityKeys: [] } }),
  ),
  nhostGraphQLLink.query('getAuthUserProviders', () =>
    HttpResponse.json({ data: { authUserProviders: [] } }),
  ),
);

describe('AccountProfileHeader', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it.each([
    { activeMfaType: 'totp', label: 'MFA on' },
    { activeMfaType: '', label: 'MFA off' },
  ])(
    'shows $label and links to the multi-factor section',
    async ({ activeMfaType, label }) => {
      server.use(
        nhostGraphQLLink.query('getActiveMfaType', () =>
          HttpResponse.json({ data: { user: { activeMfaType } } }),
        ),
      );
      render(<AccountProfileHeader />);

      expect(screen.getByText('Member since')).toBeInTheDocument();
      expect(screen.queryByText('Organizations')).not.toBeInTheDocument();
      expect(screen.queryByText('Projects')).not.toBeInTheDocument();
      expect(await screen.findByRole('link', { name: label })).toHaveAttribute(
        'href',
        '/account?tab=authentication#multi-factor-authentication',
      );
    },
  );
});
