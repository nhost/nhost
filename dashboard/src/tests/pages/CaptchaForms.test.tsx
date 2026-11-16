import { webcrypto } from 'node:crypto';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { toast } from 'react-hot-toast';
import SignUpWithEmailAndPasswordForm from '@/features/auth/SignUp/SignUpTabs/SignUpWithEmailAndPassword/components/SignUpWithEmailAndPasswordForm';
import SignUpWithSecurityKeyForm from '@/features/auth/SignUp/SignUpTabs/SignUpWithSecurityKey/components/SignUpWithSecurityKeyForm';
import NewPasswordPage from '@/pages/password/new';
import { mockMatchMediaValue, mockRouter } from '@/tests/mocks';
import {
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';

const mocks = vi.hoisted(() => ({ useRouter: vi.fn() }));
vi.mock('next/router', () => ({ useRouter: mocks.useRouter }));

const forms = [
  {
    name: 'password signup',
    Component: SignUpWithEmailAndPasswordForm,
    path: '/v1/signup/email-password',
    button: 'Sign Up',
    hasName: true,
    hasPassword: true,
  },
  {
    name: 'security-key signup',
    Component: SignUpWithSecurityKeyForm,
    path: '/v1/signup/webauthn',
    button: 'Sign Up',
    hasName: true,
    hasPassword: false,
  },
  {
    name: 'password reset',
    Component: NewPasswordPage,
    path: '/v1/user/password/reset',
    button: 'Send Reset Instructions',
    hasName: false,
    hasPassword: false,
  },
];

let requests: { path: string; turnstileToken: string | null }[] = [];
const server = setupServer(
  http.post('https://local.auth.local.nhost.run/v1/*', ({ request }) => {
    const path = new URL(request.url).pathname;
    requests.push({
      path,
      turnstileToken: request.headers.get('x-cf-turnstile-response'),
    });
    if (path === '/v1/signup/webauthn') {
      return HttpResponse.json(
        { message: 'Stop before browser credential registration in this test' },
        { status: 400 },
      );
    }
    return HttpResponse.json({});
  }),
);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  vi.stubGlobal('crypto', webcrypto);
});
beforeEach(() => {
  requests = [];
  toast.remove();
  queryClient.clear();
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  mocks.useRouter.mockReturnValue({
    ...mockRouter,
    query: {},
    push: vi.fn().mockResolvedValue(true),
  });
});
afterEach(() => {
  server.resetHandlers();
  toast.remove();
  queryClient.clear();
  localStorage.clear();
  document.getElementById('cf-turnstile-script')?.remove();
  vi.unstubAllEnvs();
});
afterAll(() => {
  server.close();
  vi.unstubAllGlobals();
});

describe('Turnstile in authentication forms', () => {
  describe.each([
    {
      reason: 'in development with a configured key',
      nodeEnv: 'development',
      siteKey: 'test-site-key',
    },
    {
      reason: 'when the key is missing',
      nodeEnv: 'production',
      siteKey: undefined,
    },
    {
      reason: 'when the key is empty',
      nodeEnv: 'production',
      siteKey: '',
    },
    {
      reason: 'when the key is FIXME',
      nodeEnv: 'production',
      siteKey: 'FIXME',
    },
  ])('$reason', ({ nodeEnv, siteKey }) => {
    it.each(forms)(
      'disables the widget, token requirement and header for $name',
      async ({ Component, button, path, hasName, hasPassword }) => {
        vi.stubEnv('NODE_ENV', nodeEnv);
        if (siteKey === undefined) {
          delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
        } else {
          vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', siteKey);
        }
        const user = new TestUserEvent();
        render(<Component />);
        expect(screen.queryByText('Verification')).not.toBeInTheDocument();
        expect(
          document.querySelector('script[src*="challenges.cloudflare.com"]'),
        ).toBeNull();
        if (hasName) {
          await user.type(screen.getByLabelText('Name'), 'Local Tester');
        }
        await user.type(screen.getByLabelText('Email'), 'local@example.com');
        if (hasPassword) {
          await user.type(screen.getByLabelText('Password'), 'test-password');
        }
        await user.click(screen.getByRole('button', { name: button }));
        await waitFor(() => {
          expect(requests).toContainEqual({ path, turnstileToken: null });
        });
        expect(
          screen.queryByText('Please complete the CAPTCHA'),
        ).not.toBeInTheDocument();
      },
    );
  });

  it.each(forms)(
    'still requires a CAPTCHA for $name in production',
    async ({ Component, button, hasName, hasPassword }) => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'test-site-key');
      const user = new TestUserEvent();
      render(<Component />);
      expect(screen.getByText('Verification')).toBeInTheDocument();
      if (hasName) {
        await user.type(screen.getByLabelText('Name'), 'Local Tester');
      }
      await user.type(screen.getByLabelText('Email'), 'local@example.com');
      if (hasPassword) {
        await user.type(screen.getByLabelText('Password'), 'test-password');
      }
      await user.click(screen.getByRole('button', { name: button }));
      expect(
        await screen.findByText('Please complete the CAPTCHA'),
      ).toBeInTheDocument();
      expect(requests).toEqual([]);
    },
  );
});
