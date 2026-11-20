import type { StoredSession } from '@nhost/nhost-js/session';
import { Slot } from 'expo-router';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import { useRefresh } from '@/components/useRefresh';
import AuthProvider from '@/lib/nhost/AuthProvider';
import type { SessionCallbacks } from '@/lib/nhost/watchSession';
import { useLoad } from '@/lib/useLoad';

const mockWatch = { callbacks: null as SessionCallbacks | null };

jest.mock('@/lib/nhost/watchSession', () => ({
  watchSession: (callbacks: SessionCallbacks) => {
    mockWatch.callbacks = callbacks;
    return { checkRevoked: async () => undefined, stop: () => undefined };
  },
}));

jest.mock('@/lib/nhost/client', () => ({
  nhost: { getUserSession: () => null },
}));

let refresh: VoidFunction = () => undefined;

function Loaded({ load }: { load: () => Promise<string> }) {
  refresh = useRefresh();
  return <Text testID="loaded">{useLoad(load) ?? 'loading'}</Text>;
}

async function render(load: () => Promise<string>) {
  return renderRouter({
    _layout: () => (
      <AuthProvider>
        <Slot />
      </AuthProvider>
    ),
    index: () => <Loaded load={load} />,
  });
}

const shown = () => screen.getByTestId('loaded');

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useLoad', () => {
  it('shows what the load resolved to, and loads again on useRefresh()', async () => {
    let n = 0;
    await render(async () => `load ${++n}`);

    expect(shown()).toHaveTextContent('load 1');

    await act(async () => refresh());

    expect(shown()).toHaveTextContent('load 2');
  });

  it('loads once however often the screen renders', async () => {
    const load = jest.fn(async () => 'loaded');
    await render(load);

    await act(async () =>
      mockWatch.callbacks?.onSession({
        user: { id: 'user-id' },
      } as StoredSession),
    );

    expect(load).toHaveBeenCalledTimes(1);
  });

  // A slow first answer must not overwrite the one a refresh brought.
  it('drops an answer that a newer load overtook', async () => {
    const answers: Array<(value: string) => void> = [];
    await render(
      () =>
        new Promise<string>((resolve) => {
          answers.push(resolve);
        }),
    );
    await act(async () => refresh());

    await act(async () => answers[1]?.('second'));
    await act(async () => answers[0]?.('first'));

    expect(shown()).toHaveTextContent('second');
  });

  it('keeps what it had when a load fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    let fail = false;
    await render(async () => {
      if (fail) {
        throw new Error('offline');
      }
      return 'loaded';
    });

    fail = true;
    await act(async () => refresh());

    expect(shown()).toHaveTextContent('loaded');
  });
});
