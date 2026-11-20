// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UserAvatar from '@/components/UserAvatar';

const getFile = vi.hoisted(() => vi.fn());

vi.mock('@/lib/nhost/client', () => ({
  nhost: {
    storage: { getFile },
    sessionStorage: { onChange: () => () => undefined },
  },
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const FILE_ID = '0b5e3f6c-8d2a-4c1e-9f7b-3a6d2e1c4b5a';

let container: HTMLElement;
let root: Root;

async function srcFor(avatarUrl: string | undefined): Promise<string | null> {
  await act(async () =>
    root.render(
      <UserAvatar avatarUrl={avatarUrl} displayName="Ada" width={64} />,
    ),
  );
  return container.querySelector('img')?.getAttribute('src') ?? null;
}

describe('UserAvatar', () => {
  const originalCreate = URL.createObjectURL;

  beforeEach(() => {
    getFile.mockReset();
    getFile.mockResolvedValue({
      body: new Blob(['png-bytes'], { type: 'image/png' }),
      headers: new Headers({ 'content-type': 'image/png' }),
    });
    URL.createObjectURL = vi.fn(() => 'blob:http://localhost:3000/avatar');
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    URL.createObjectURL = originalCreate;
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
    expect(container.textContent).toBe('A');
  });

  it('shows only the initial without an avatar', async () => {
    expect(await srcFor(undefined)).toBeNull();
    expect(container.textContent).toBe('A');
  });
});
