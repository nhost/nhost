// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AvatarForm from '@/app/account/AvatarForm';
import { AVATAR_TOO_LARGE, MAX_AVATAR_BYTES } from '@/app/account/avatar';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
const uploadAvatar = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/app/account/actions', () => ({ uploadAvatar }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

async function submit(): Promise<void> {
  await act(async () =>
    container
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  );
}

const text = (role: string): string | null =>
  container.querySelector(`[role="${role}"]`)?.textContent ?? null;

describe('avatar form', () => {
  beforeEach(async () => {
    router.refresh.mockReset();
    uploadAvatar.mockReset();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    await act(async () =>
      root.render(<AvatarForm avatarUrl="/api/avatar/current" />),
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('shows the current avatar', () => {
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      '/api/avatar/current',
    );
  });

  it('only accepts images and names the field the action reads', () => {
    const input = container.querySelector('input[type="file"]');

    expect(input?.getAttribute('accept')).toBe('image/*');
    expect(input?.getAttribute('name')).toBe('avatar');
  });

  it('hands the form to the action and re-reads the page', async () => {
    uploadAvatar.mockResolvedValueOnce({ success: true });

    await submit();

    expect(uploadAvatar).toHaveBeenCalledOnce();
    expect(uploadAvatar.mock.calls[0]?.[0]).toBeInstanceOf(FormData);
    expect(router.refresh).toHaveBeenCalled();
  });

  it('shows the action error and does not re-read', async () => {
    uploadAvatar.mockResolvedValueOnce({ error: 'over 5 MB' });

    await submit();

    expect(text('alert')).toBe('over 5 MB');
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it('refuses an oversized file without calling the action', async () => {
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([new Uint8Array(MAX_AVATAR_BYTES + 1)], 'me.png', {
        type: 'image/png',
      }),
    );
    if (input) {
      input.files = transfer.files;
    }

    await submit();

    expect(text('alert')).toBe(AVATAR_TOO_LARGE);
    expect(uploadAvatar).not.toHaveBeenCalled();
  });
});
