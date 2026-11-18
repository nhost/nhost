// @vitest-environment happy-dom
import type { StoredSession } from '@nhost/nhost-js/session';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AvatarWidth } from '@/app/account/avatar';
import { useAvatarSrc } from '@/app/account/useAvatarSrc';

const getFile = vi.hoisted(() => vi.fn());
// Kept across tests: the hook subscribes once, on first use.
const sessionListeners = vi.hoisted(
  () => [] as Array<(session: StoredSession | null) => void>,
);

vi.mock('@/lib/nhost/client', () => ({
  nhost: {
    storage: { getFile },
    sessionStorage: {
      onChange: (listener: (session: StoredSession | null) => void) => {
        sessionListeners.push(listener);
        return () => undefined;
      },
    },
  },
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const FILE_ID = '0b5e3f6c-8d2a-4c1e-9f7b-3a6d2e1c4b5a';
const OTHER_ID = '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b';

const served = (type = 'image/png') => ({
  body: new Blob(['png-bytes'], { type }),
  headers: new Headers({ 'content-type': type }),
});

const createObjectURL = vi.fn();
const revokeObjectURL = vi.fn();
const originalURL = {
  create: URL.createObjectURL,
  revoke: URL.revokeObjectURL,
};

function Avatar({ url, width }: { url?: string; width?: AvatarWidth }) {
  return <p>{useAvatarSrc(url, width) ?? 'none'}</p>;
}

let container: HTMLElement;
let root: Root;

async function render(
  avatars: Array<{ url?: string; width?: AvatarWidth }>,
): Promise<string[]> {
  await act(async () =>
    root.render(
      avatars.map((props, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list per render
        <Avatar key={index} {...props} />
      )),
    ),
  );
  return [...container.querySelectorAll('p')].map((p) => p.textContent ?? '');
}

const signOut = (): void => {
  for (const listener of sessionListeners) {
    listener(null);
  }
};

describe('useAvatarSrc', () => {
  beforeEach(() => {
    let n = 0;
    getFile.mockReset();
    getFile.mockImplementation(async () => served());
    createObjectURL.mockReset();
    createObjectURL.mockImplementation(() => `blob:avatar-${++n}`);
    revokeObjectURL.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    // Empties the module's cache between tests.
    signOut();
    URL.createObjectURL = originalURL.create;
    URL.revokeObjectURL = originalURL.revoke;
    vi.restoreAllMocks();
  });

  it('fetches a file this app uploaded with the session and shows it as an object URL', async () => {
    expect(
      await render([{ url: `/api/avatar/${FILE_ID}`, width: 192 }]),
    ).toEqual(['blob:avatar-1']);
    expect(getFile).toHaveBeenCalledWith(
      FILE_ID,
      { w: 192, q: 80, f: 'auto' },
      { headers: { Accept: 'image/avif,image/webp,image/*' } },
    );
  });

  it('asks for the original without a width', async () => {
    await render([{ url: `/api/avatar/${FILE_ID}` }]);

    expect(getFile.mock.calls[0]?.[1]).toBeUndefined();
  });

  it('passes an absolute URL such as gravatar through, without fetching', async () => {
    const gravatar = 'https://www.gravatar.com/avatar/abc?d=blank';

    expect(await render([{ url: gravatar, width: 64 }])).toEqual([gravatar]);
    expect(getFile).not.toHaveBeenCalled();
  });

  // Under the SPA rewrite, a path loads index.html; `..` would also aim the
  // session at another storage path.
  it.each([
    '/api/avatar/..',
    '/api/avatar/../other',
    '/api/avatar/file-1',
    '/elsewhere.png',
    '//cdn.example/me.png',
    'javascript:alert(1)',
  ])('shows nothing for %j and asks storage for nothing', async (url) => {
    expect(await render([{ url, width: 64 }])).toEqual(['none']);
    expect(getFile).not.toHaveBeenCalled();
  });

  it('asks storage for no width but the ones the app uses', async () => {
    expect(
      await render([
        { url: `/api/avatar/${FILE_ID}`, width: 4000 as AvatarWidth },
      ]),
    ).toEqual(['none']);
    expect(getFile).not.toHaveBeenCalled();
  });

  // Storage takes any file into the bucket and avatar_url can name any of them.
  it.each(['text/html; charset=utf-8', 'image/svg+xml'])(
    'refuses a file served as %s',
    async (type) => {
      getFile.mockResolvedValueOnce(served(type));

      expect(
        await render([{ url: `/api/avatar/${FILE_ID}`, width: 64 }]),
      ).toEqual(['none']);
      expect(createObjectURL).not.toHaveBeenCalled();
    },
  );

  it('fetches once for every avatar showing the same file at the same width', async () => {
    const url = `/api/avatar/${FILE_ID}`;

    expect(
      await render([
        { url, width: 64 },
        { url, width: 64 },
        { url, width: 192 },
      ]),
    ).toEqual(['blob:avatar-1', 'blob:avatar-1', 'blob:avatar-2']);
    expect(getFile).toHaveBeenCalledTimes(2);
  });

  // The nav and the account page show the same file: one leaving must not
  // blank the other.
  it('keeps the object URL when one avatar unmounts', async () => {
    const url = `/api/avatar/${FILE_ID}`;
    await render([
      { url, width: 64 },
      { url, width: 64 },
    ]);

    expect(await render([{ url, width: 64 }])).toEqual(['blob:avatar-1']);
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it('revokes the old object URLs once the avatar changes', async () => {
    await render([{ url: `/api/avatar/${FILE_ID}`, width: 64 }]);

    expect(
      await render([{ url: `/api/avatar/${OTHER_ID}`, width: 64 }]),
    ).toEqual(['blob:avatar-2']);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:avatar-1');
  });

  it('revokes the object URLs on sign-out', async () => {
    await render([{ url: `/api/avatar/${FILE_ID}`, width: 64 }]);

    signOut();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:avatar-1');
  });

  it('tries again after a failed fetch', async () => {
    getFile.mockRejectedValueOnce(new Error('offline'));
    const url = `/api/avatar/${FILE_ID}`;

    expect(await render([{ url, width: 64 }])).toEqual(['none']);
    await render([]);

    expect(await render([{ url, width: 64 }])).toEqual(['blob:avatar-1']);
    expect(getFile).toHaveBeenCalledTimes(2);
  });
});
