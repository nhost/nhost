import { consumePKCEVerifier } from '@/lib/pkce';
import startGitHubConnect from './startGitHubConnect';

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

it('starts the connect flow with the Nhost session and an absolute PKCE redirect', async () => {
  const redirectTo = `${'https://dashboard.example.com'}/orgs/fixture/projects/example/deployments`;
  await startGitHubConnect({
    nhostAccessToken: 'test-nhost-session',
    redirectTo,
  });
  const url = new URL(window.location.href);
  expect(url.pathname).toBe('/v1/signin/provider/github');
  expect(url.searchParams.get('connect')).toBe('test-nhost-session');
  expect(url.searchParams.get('codeChallenge')).toBeTruthy();
  const redirect = new URL(url.searchParams.get('redirectTo')!);
  expect(`${redirect.origin}${redirect.pathname}`).toBe(redirectTo);
  const pkceId = redirect.searchParams.get('pkceId');
  expect(pkceId).toBeTruthy();
  expect(consumePKCEVerifier(pkceId!)).toBeTruthy();
});

it('keeps the modal callback state and existing redirect query parameters', async () => {
  const redirectTo = `${'https://dashboard.example.com'}?signinProvider=github&state=signin-refresh:fixture:project`;
  await startGitHubConnect({
    nhostAccessToken: 'test-nhost-session',
    redirectTo,
  });
  const redirect = new URL(
    new URL(window.location.href).searchParams.get('redirectTo')!,
  );
  expect(redirect.searchParams.get('signinProvider')).toBe('github');
  expect(redirect.searchParams.get('state')).toBe(
    'signin-refresh:fixture:project',
  );
  expect(redirect.searchParams.get('pkceId')).toBeTruthy();
});
