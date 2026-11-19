// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { h, ref } from 'vue';
import UserAvatar from '@/components/UserAvatar.vue';
import { type Mounted, mountAt, settle } from '@/test/mount';

const getFile = vi.hoisted(() => vi.fn());

vi.mock('@/lib/nhost/client', () => ({
  nhost: {
    storage: { getFile },
    sessionStorage: { onChange: () => () => undefined },
  },
}));

const FILE_ID = '0b5e3f6c-8d2a-4c1e-9f7b-3a6d2e1c4b5a';

const avatarUrl = ref<string>();
let mounted: Mounted;

async function srcFor(url: string | undefined): Promise<string | null> {
  avatarUrl.value = url;
  await settle();
  return mounted.el.querySelector('img')?.getAttribute('src') ?? null;
}

describe('UserAvatar', () => {
  const originalCreate = URL.createObjectURL;

  beforeEach(async () => {
    getFile.mockReset();
    getFile.mockResolvedValue({
      body: new Blob(['png-bytes'], { type: 'image/png' }),
      headers: new Headers({ 'content-type': 'image/png' }),
    });
    URL.createObjectURL = vi.fn(() => 'blob:http://localhost:3000/avatar');
    avatarUrl.value = undefined;
    mounted = await mountAt(() =>
      h(UserAvatar, {
        avatarUrl: avatarUrl.value,
        displayName: 'Ada',
        width: 64,
      }),
    );
    return () => {
      URL.createObjectURL = originalCreate;
    };
  });

  // Under the SPA rewrite an app path answers with index.html, and the
  // avatar's own path needs a session an <img> cannot send.
  it('never puts an app-relative URL in the image', async () => {
    expect(await srcFor(`/api/avatar/${FILE_ID}`)).toBe(
      'blob:http://localhost:3000/avatar',
    );
    expect(await srcFor('/api/avatar/not-a-file')).toBeNull();
    expect(await srcFor('/somewhere/me.png')).toBeNull();
  });

  it('shows the initial, with an absolute URL over it', async () => {
    const gravatar = 'https://www.gravatar.com/avatar/abc?d=blank';

    expect(await srcFor(gravatar)).toBe(gravatar);
    expect(mounted.el.textContent?.trim()).toBe('A');
  });

  it('shows only the initial without an avatar', async () => {
    expect(await srcFor(undefined)).toBeNull();
    expect(mounted.el.textContent?.trim()).toBe('A');
  });
});
