import { consumePKCEVerifier } from '@/lib/pkce';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
import GithubAuthButton from './GithubAuthButton';

beforeEach(() => {
  const browserWindow = Object.create(window) as Window;
  Object.defineProperty(browserWindow, 'location', {
    value: { href: '', origin: window.location.origin },
  });
  vi.stubGlobal('window', browserWindow);
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

it('keeps the default sign-in button and starts a sign-in rather than a connect flow', async () => {
  render(<GithubAuthButton />);
  const button = screen.getByRole('button', { name: /Continue with GitHub/ });
  expect(button).toHaveClass('btn-emboss-primary', 'h-9');
  await new TestUserEvent().click(button);
  await waitFor(() => expect(window.location.href).not.toBe(''));
  const url = new URL(window.location.href);
  expect(url.pathname).toBe('/v1/signin/provider/github');
  expect(url.searchParams.has('connect')).toBe(false);
  expect(url.searchParams.get('codeChallenge')).toBeTruthy();
});

it('accepts outline and size props with a custom sign-in label and redirect', async () => {
  const redirectTo = `${window.location.origin}/orgs/fixture/projects/example/deployments?signinProvider=github`;
  render(
    <GithubAuthButton
      variant="outline"
      size="xs"
      buttonText="Sign in"
      redirectTo={redirectTo}
    />,
  );
  const button = screen.getByRole('button', { name: /Sign in/ });
  expect(button).toHaveClass('border-input', 'h-8');
  expect(button).not.toHaveClass('btn-emboss-primary');
  await new TestUserEvent().click(button);
  await waitFor(() => expect(window.location.href).not.toBe(''));
  const url = new URL(window.location.href);
  expect(url.searchParams.has('connect')).toBe(false);
  const redirect = new URL(url.searchParams.get('redirectTo')!);
  expect(redirect.pathname).toBe('/orgs/fixture/projects/example/deployments');
  expect(redirect.searchParams.get('signinProvider')).toBe('github');
  expect(
    consumePKCEVerifier(redirect.searchParams.get('pkceId')!),
  ).toBeTruthy();
});
