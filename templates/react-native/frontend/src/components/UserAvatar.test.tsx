import { render, screen } from '@testing-library/react-native';
import UserAvatar from '@/components/UserAvatar';

jest.mock('@/lib/nhost/client', () => ({
  nhost: {
    refreshSession: async () => ({ accessToken: 'access-token' }),
    storage: { baseURL: 'https://local.storage.local.nhost.run/v1' },
    sessionStorage: { onChange: () => () => undefined },
  },
}));

const FILE_ID = '0b5e3f6c-8d2a-4c1e-9f7b-3a6d2e1c4b5a';

async function imageFor(avatarUrl: string | undefined) {
  await render(
    <UserAvatar avatarUrl={avatarUrl} displayName="Ada" width={64} size={32} />,
  );
  return screen.queryByTestId('avatar-image', { includeHiddenElements: true });
}

describe('UserAvatar', () => {
  // A path names nothing on a device, and the avatar's own path needs a
  // session only a storage URL can carry.
  it('never makes an image source of an app-relative URL', async () => {
    expect((await imageFor(`/api/avatar/${FILE_ID}`))?.props.source).toEqual([
      expect.objectContaining({
        uri: expect.stringMatching(/^https:\/\/local\.storage\./),
      }),
    ]);
    expect(await imageFor('/api/avatar/not-a-file')).toBeNull();
    expect(await imageFor('/somewhere/me.png')).toBeNull();
  });

  // Signing out drops the memory cache; a disk cache would keep the picture
  // past the session that could read it.
  it('keeps a storage image in memory only', async () => {
    expect((await imageFor(`/api/avatar/${FILE_ID}`))?.props.cachePolicy).toBe(
      'memory',
    );
  });

  it('shows the initial, with an absolute URL over it', async () => {
    const gravatar = 'https://www.gravatar.com/avatar/abc?d=blank';

    expect((await imageFor(gravatar))?.props.source).toEqual([
      expect.objectContaining({ uri: gravatar }),
    ]);
    expect(
      screen.getByText('A', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it('shows only the initial without an avatar', async () => {
    expect(await imageFor(undefined)).toBeNull();
    expect(
      screen.getByText('A', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });
});
