import type { User } from '@nhost/nhost-js/auth';
import type * as Testing from '@testing-library/react-native/pure';
import type SignInSettingsType from '@/screens/account/SignInSettings';
import type * as Methods from '@/screens/signin/methods';

jest.mock('@/screens/auth/passkey/manage/actions', () => ({
  listPasskeys: async () => ({ keys: [] }),
}));

const user = {
  id: 'user-1',
  email: 'user@example.com',
  emailVerified: true,
  activeMfaType: '',
} as unknown as User;

const saved = process.env.EXPO_PUBLIC_NHOST_PASSKEY_DOMAIN;

afterEach(() => {
  if (saved === undefined) {
    delete process.env.EXPO_PUBLIC_NHOST_PASSKEY_DOMAIN;
  } else {
    process.env.EXPO_PUBLIC_NHOST_PASSKEY_DOMAIN = saved;
  }
});

// The registry reads the domain once, when it loads, so each case loads it
// afresh, with React and the renderer, which have to come from the same load.
async function withDomain(
  domain: string | undefined,
  check: (loaded: {
    methods: typeof Methods.methods;
    renderSettings: () => Promise<Testing.RenderResult>;
  }) => Promise<void>,
): Promise<void> {
  if (domain === undefined) {
    delete process.env.EXPO_PUBLIC_NHOST_PASSKEY_DOMAIN;
  } else {
    process.env.EXPO_PUBLIC_NHOST_PASSKEY_DOMAIN = domain;
  }

  await jest.isolateModulesAsync(async () => {
    // `pure`, as the main entry registers cleanup hooks, which a test cannot.
    const { cleanup, render } = jest.requireActual<typeof Testing>(
      '@testing-library/react-native/pure',
    );
    const { methods } = jest.requireActual<typeof Methods>(
      '@/screens/signin/methods',
    );
    const SignInSettings = jest.requireActual<{
      default: typeof SignInSettingsType;
    }>('@/screens/account/SignInSettings').default;

    try {
      await check({
        methods,
        renderSettings: () => render(<SignInSettings user={user} />),
      });
    } finally {
      await cleanup();
    }
  });
}

// A fresh load of React Native takes seconds.
jest.setTimeout(30_000);

describe('passkeys in the registry', () => {
  it('are left out without a passkey domain', async () => {
    await withDomain(undefined, async ({ methods, renderSettings }) => {
      expect(methods.map((method) => method.href)).not.toContain(
        '/auth/passkey',
      );

      const { getByText, queryByText } = await renderSettings();
      expect(getByText('Email')).toBeTruthy();
      expect(queryByText('Passkeys')).toBeNull();
    });
  });

  it('add the sign-in entry and the account row once one is set', async () => {
    await withDomain('example.com', async ({ methods, renderSettings }) => {
      expect(methods.map((method) => method.href)).toContain('/auth/passkey');

      const { findByText } = await renderSettings();
      expect(await findByText('Passkeys')).toBeTruthy();
    });
  });
});
