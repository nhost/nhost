import type { StoredSession } from '@nhost/nhost-js/session';
import { Slot } from 'expo-router';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import { SecureStoreStorage } from '@/lib/nhost/storage';
import { mockDevice } from '@/test/device';
import { json, liveSession } from '@/test/session';

type AuthProviderModule = typeof import('@/lib/nhost/AuthProvider');
type StartSessionModule = typeof import('@/lib/nhost/startSession');

const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
global.fetch = fetchMock as typeof fetch;

function Who({ useSession }: { useSession: () => StoredSession | null }) {
  return <Text>{useSession() ? 'signed in' : 'signed out'}</Text>;
}

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// The real client, so the SDK's own handling of a late 401 is what runs.
describe('startSession on a slow network', () => {
  it('lets a refresh that times out clear the session when it is refused later', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.useFakeTimers();

    new SecureStoreStorage().set(
      liveSession({
        decodedToken: { exp: Date.now() - 1000 },
      } as Partial<StoredSession>),
    );
    let answerFirst: (response: Response) => void = () => undefined;
    fetchMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            answerFirst = resolve;
          }),
      )
      .mockImplementation(async () => json({ error: 'invalid-token' }, 401));

    // Loaded now, over what the device holds, as on a launch.
    const { startSession } =
      require('@/lib/nhost/startSession') as StartSessionModule;
    const { default: AuthProvider, useSession } =
      require('@/lib/nhost/AuthProvider') as AuthProviderModule;

    const started = startSession();
    await jest.advanceTimersByTimeAsync(10_000);
    await started;

    await renderRouter({
      _layout: () => (
        <AuthProvider>
          <Slot />
        </AuthProvider>
      ),
      index: () => <Who useSession={useSession} />,
    });

    expect(screen.getByText('signed in')).toBeOnTheScreen();

    await act(async () => {
      answerFirst(json({ error: 'invalid-token' }, 401));
      await jest.runAllTimersAsync();
    });

    expect(screen.getByText('signed out')).toBeOnTheScreen();
    expect(mockDevice().secureStore.get('nhostSession')).toBe('');
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/v1\/token$/);
  });
});
