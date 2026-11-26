import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { mockMatchMediaValue } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import { render, screen, TestUserEvent } from '@/tests/testUtils';
import AccountMfaSettings from './AccountMfaSettings';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const AUTH_URL = 'https://local.auth.local.nhost.run/v1';
const server = setupServer(
  http.get(`${AUTH_URL}/elevate`, () =>
    HttpResponse.json({ elevationRequired: false, methods: [] }),
  ),
  http.get(`${AUTH_URL}/mfa/totp/generate`, () =>
    HttpResponse.json({
      imageUrl: 'data:image/png;base64,AA==',
      totpSecret: '',
    }),
  ),
  http.post(`${AUTH_URL}/user/mfa`, () => HttpResponse.json({})),
);

describe('AccountMfaSettings', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it.each([
    { activeMfaType: '', action: 'Enable', result: 'enabled' },
    { activeMfaType: 'totp', action: 'Disable', result: 'disabled' },
  ])(
    'uses multi-factor wording when $action is selected',
    async ({ activeMfaType, action, result }) => {
      server.use(
        nhostGraphQLLink.query('getActiveMfaType', () =>
          HttpResponse.json({ data: { user: { activeMfaType } } }),
        ),
      );
      const user = new TestUserEvent();
      render(<AccountMfaSettings />);

      expect(
        screen.getByRole('heading', { name: 'Multi-factor authentication' }),
      ).toBeInTheDocument();
      await user.click(
        await screen.findByRole('button', {
          name: `${action} multi-factor authentication`,
        }),
      );
      expect(
        await screen.findByRole('dialog', {
          name: `${action} multi-factor authentication`,
        }),
      ).toBeInTheDocument();
      await user.type(
        await screen.findByPlaceholderText('Enter TOTP'),
        '123456',
      );
      await user.click(screen.getByRole('button', { name: 'Verify' }));

      expect(
        await screen.findByText(
          `Multi-factor authentication has been ${result}.`,
        ),
      ).toBeInTheDocument();
    },
  );
});
