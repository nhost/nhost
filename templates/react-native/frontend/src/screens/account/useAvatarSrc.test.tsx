import type { StoredSession } from '@nhost/nhost-js/session';
import { render, screen } from '@testing-library/react-native';
import { Image } from 'expo-image';
import { Text } from 'react-native';
import type { AvatarWidth } from '@/screens/account/avatar';
import { useAvatarSrc } from '@/screens/account/useAvatarSrc';

const mockRefreshSession = jest.fn();
// Kept across tests: the hook subscribes once, on first use.
const mockSessionListeners: Array<(session: StoredSession | null) => void> = [];

jest.mock('@/lib/nhost/client', () => ({
  nhost: {
    refreshSession: (margin: number) => mockRefreshSession(margin),
    storage: { baseURL: 'https://local.storage.local.nhost.run/v1' },
    sessionStorage: {
      onChange: (listener: (session: StoredSession | null) => void) => {
        mockSessionListeners.push(listener);
        return () => undefined;
      },
    },
  },
}));

const FILE_ID = '0b5e3f6c-8d2a-4c1e-9f7b-3a6d2e1c4b5a';
const STORAGE = 'https://local.storage.local.nhost.run/v1';

function Avatar({ url, width }: { url?: string; width?: AvatarWidth }) {
  return (
    <Text testID="source">
      {JSON.stringify(useAvatarSrc(url, width) ?? 'none')}
    </Text>
  );
}

async function sourceFor(url: string | undefined, width?: AvatarWidth) {
  await render(<Avatar url={url} width={width} />);
  return JSON.parse(String(screen.getByTestId('source').props.children));
}

beforeEach(() => {
  mockRefreshSession.mockReset();
  mockRefreshSession.mockResolvedValue({ accessToken: 'access-token' });
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useAvatarSrc', () => {
  it('points at a file this app uploaded, with a fresh token in the header', async () => {
    expect(await sourceFor(`/api/avatar/${FILE_ID}`, 192)).toEqual({
      uri: `${STORAGE}/files/${FILE_ID}?w=192&q=80&f=auto`,
      headers: {
        Authorization: 'Bearer access-token',
        Accept: 'image/avif,image/webp,image/*',
      },
    });
    expect(mockRefreshSession).toHaveBeenCalledWith(60);
  });

  it('asks for the original without a width', async () => {
    expect((await sourceFor(`/api/avatar/${FILE_ID}`)).uri).toBe(
      `${STORAGE}/files/${FILE_ID}`,
    );
  });

  it('passes an absolute URL such as gravatar through, without a token', async () => {
    const gravatar = 'https://www.gravatar.com/avatar/abc?d=blank';

    expect(await sourceFor(gravatar, 64)).toEqual({ uri: gravatar });
    expect(mockRefreshSession).not.toHaveBeenCalled();
  });

  // A path names nothing on a device, and `..` would aim the token at another
  // storage path.
  it.each([
    '/api/avatar/..',
    '/api/avatar/../other',
    '/api/avatar/file-1',
    '/elsewhere.png',
    '//cdn.example/me.png',
    'file:///data/me.png',
    'javascript:alert(1)',
  ])('shows nothing for %j and sends the token nowhere', async (url) => {
    expect(await sourceFor(url, 64)).toBe('none');
    expect(mockRefreshSession).not.toHaveBeenCalled();
  });

  it('asks storage for no width but the ones the app uses', async () => {
    expect(await sourceFor(`/api/avatar/${FILE_ID}`, 4000 as AvatarWidth)).toBe(
      'none',
    );
    expect(mockRefreshSession).not.toHaveBeenCalled();
  });

  it('shows nothing once the session is gone', async () => {
    mockRefreshSession.mockResolvedValueOnce(null);

    expect(await sourceFor(`/api/avatar/${FILE_ID}`, 64)).toBe('none');
  });

  it('shows nothing when the session cannot be refreshed', async () => {
    mockRefreshSession.mockRejectedValueOnce(new Error('offline'));

    expect(await sourceFor(`/api/avatar/${FILE_ID}`, 64)).toBe('none');
  });

  it('drops the cached images on sign-out', async () => {
    const clear = jest.spyOn(Image, 'clearMemoryCache');
    await sourceFor(`/api/avatar/${FILE_ID}`, 64);

    for (const listener of mockSessionListeners) {
      listener({ accessToken: 'next' } as StoredSession);
    }
    expect(clear).not.toHaveBeenCalled();

    for (const listener of mockSessionListeners) {
      listener(null);
    }
    expect(clear).toHaveBeenCalled();
  });
});
