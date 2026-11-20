import { readFlows } from '@/lib/nhost/links';
import { codeChallenge } from '@/lib/nhost/pkce';
import { sendMagicLink } from '@/screens/auth/magic-link/actions';

type Sent = {
  email: string;
  options: { redirectTo: string };
  codeChallenge: string;
};

const mockSignIn = jest.fn<Promise<unknown>, [Sent]>();

jest.mock('@/lib/nhost/client', () => ({
  ...jest.requireActual('@/lib/nhost/client'),
  nhost: {
    auth: { signInPasswordlessEmail: (body: Sent) => mockSignIn(body) },
  },
}));

const sent = (): Sent => mockSignIn.mock.calls[0][0];

beforeEach(() => {
  mockSignIn.mockReset();
  mockSignIn.mockResolvedValue({});
});

describe('sendMagicLink', () => {
  // The link comes back with a code that signs in only with the verifier
  // this device kept, so it is useless to another app holding the scheme.
  it('asks for a link that only this device can sign in with', async () => {
    expect(await sendMagicLink('user@example.com', '/account?tab=1')).toEqual({
      success: true,
    });

    const [flow] = readFlows();
    expect(flow).toMatchObject({ kind: 'signIn' });
    expect(sent().options.redirectTo).toBe(
      `nhost-starter://account?tab=1&flow=${flow?.id}`,
    );
    expect(sent().codeChallenge).toBe(
      await codeChallenge(flow?.verifier ?? ''),
    );
  });

  // Anything can call it, so `next` here is whatever the caller sent.
  it('keeps the link in this app whatever next it is given', async () => {
    for (const hostile of ['//evil.example/', 'https://evil.example', '.']) {
      mockSignIn.mockClear();

      await sendMagicLink('user@example.com', hostile);

      expect(sent().options.redirectTo).toMatch(
        /^nhost-starter:\/\/account\?flow=[\w-]+$/,
      );
    }
  });

  // A keyboard's suggestion can leave a space after the address.
  it('sends the address without surrounding spaces', async () => {
    await sendMagicLink(' user@example.com ', '/');

    expect(sent().email).toBe('user@example.com');
    expect(await sendMagicLink('  ', '/')).toEqual({
      error: 'Email is required.',
    });
  });

  it('names the email limit when auth refuses for the rate', async () => {
    mockSignIn.mockRejectedValue({ status: 429, message: '' });

    expect(await sendMagicLink('user@example.com', '/account')).toEqual({
      error:
        'Could not send the link: Too many attempts. Try again in an hour.',
    });
  });
});
