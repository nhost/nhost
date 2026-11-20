import type { StoredSession } from '@nhost/nhost-js/session';
import { router, Slot } from 'expo-router';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import AuthProvider, { useSession } from '@/lib/nhost/AuthProvider';
import type { SessionCallbacks } from '@/lib/nhost/watchSession';

const mockWatch = {
  callbacks: null as SessionCallbacks | null,
  checkRevoked: jest.fn(async () => undefined),
  stop: jest.fn(),
};

jest.mock('@/lib/nhost/watchSession', () => ({
  watchSession: (callbacks: SessionCallbacks) => {
    mockWatch.callbacks = callbacks;
    return { checkRevoked: mockWatch.checkRevoked, stop: mockWatch.stop };
  },
}));

jest.mock('@/lib/nhost/client', () => ({
  nhost: { getUserSession: () => null },
}));

function Email() {
  return <Text>{useSession()?.user?.email ?? 'signed out'}</Text>;
}

const routes = {
  _layout: () => (
    <AuthProvider>
      <Slot />
    </AuthProvider>
  ),
  index: Email,
  'other/index': Email,
};

beforeEach(() => {
  mockWatch.callbacks = null;
  mockWatch.checkRevoked.mockClear();
  mockWatch.stop.mockClear();
});

describe('AuthProvider', () => {
  // Startup has just checked the screen the app opened on.
  it('asks whether the session was revoked on every later navigation', async () => {
    await renderRouter(routes);
    expect(mockWatch.checkRevoked).not.toHaveBeenCalled();

    await act(() => router.push('/other'));
    await act(() => router.push('/'));

    expect(mockWatch.checkRevoked).toHaveBeenCalledTimes(2);
  });

  it('shows the session as the watcher reports it', async () => {
    await renderRouter(routes);
    expect(screen.getByText('signed out')).toBeOnTheScreen();

    await act(async () =>
      mockWatch.callbacks?.onSession({
        user: { email: 'ada@example.com' },
      } as StoredSession),
    );

    expect(screen.getByText('ada@example.com')).toBeOnTheScreen();
  });

  it('stops watching when it unmounts', async () => {
    const { unmount } = await renderRouter(routes);

    await unmount();

    expect(mockWatch.stop).toHaveBeenCalled();
  });
});
