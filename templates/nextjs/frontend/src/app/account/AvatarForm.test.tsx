// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AvatarForm from '@/app/account/AvatarForm';
import { AVATAR_TOO_LARGE, MAX_AVATAR_BYTES } from '@/app/account/avatar';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
const actions = vi.hoisted(() => ({
  uploadAvatar: vi.fn(),
  removeAvatar: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/app/account/actions', () => actions);

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

// A stand-in for the image, which the server renders and passes in. A real
// <img> here only trips the lint rule that the one in ProfileSummary has a
// documented exception for.
async function render(canRemove: boolean): Promise<void> {
  await act(async () =>
    root.render(
      <AvatarForm canRemove={canRemove}>
        <div data-testid="the-image" />
      </AvatarForm>,
    ),
  );
}

const byText = (label: string): HTMLButtonElement | undefined =>
  [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === label,
  );

const fileInput = (): HTMLInputElement | null =>
  container.querySelector<HTMLInputElement>('input[type="file"]');

const byLabel = (label: string): HTMLButtonElement | undefined =>
  [...container.querySelectorAll('button')].find(
    (candidate) => candidate.getAttribute('aria-label') === label,
  );

// What the browser does when a file is picked: the input holds it, then the
// input fires `change`.
async function choose(file: File): Promise<void> {
  const input = fileInput();
  const transfer = new DataTransfer();
  transfer.items.add(file);
  if (input) {
    input.files = transfer.files;
  }
  await act(async () =>
    input?.dispatchEvent(new Event('change', { bubbles: true })),
  );
}

const image = (bytes = 8): File =>
  new File([new Uint8Array(bytes)], 'me.png', { type: 'image/png' });

const text = (role: string): string | null =>
  container.querySelector(`[role="${role}"]`)?.textContent ?? null;

describe('avatar control', () => {
  beforeEach(async () => {
    router.refresh.mockReset();
    actions.uploadAvatar.mockReset();
    actions.removeAvatar.mockReset();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    await render(true);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  // The image is the server's to render, so it arrives as children and this
  // only wraps it. One image on the page, whatever the controls do.
  it('wraps the image it is given rather than rendering its own', () => {
    expect(container.querySelector('[data-testid="the-image"]')).not.toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  // The file name is the input's own rendering, which is why it is hidden:
  // the two buttons are the whole control.
  it('keeps the file input out of sight behind the buttons', () => {
    expect(fileInput()?.className).toContain('sr-only');
    expect(byLabel('Upload a new avatar')).toBeDefined();
  });

  it('only accepts raster images and names the field the action reads', () => {
    expect(fileInput()?.getAttribute('accept')).toBe(
      'image/png,image/jpeg,image/gif,image/webp,image/avif',
    );
    expect(fileInput()?.getAttribute('name')).toBe('avatar');
  });

  // Choosing the file is the whole gesture: there is no second press.
  it('uploads as soon as a file is chosen and re-reads the page', async () => {
    actions.uploadAvatar.mockResolvedValueOnce({ success: true });

    await choose(image());

    expect(actions.uploadAvatar).toHaveBeenCalledOnce();
    expect(actions.uploadAvatar.mock.calls[0]?.[0]).toBeInstanceOf(FormData);
    expect(router.refresh).toHaveBeenCalled();
  });

  // Storage can take a few seconds, and without this the image just sat
  // there unchanged with nothing saying it was being replaced.
  it('covers the image with a spinner while the upload runs', async () => {
    let finish: (result: { success: true }) => void = () => {};
    actions.uploadAvatar.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );

    await choose(image());

    expect(text('status')).toBe('Updating the avatar');
    expect(byLabel('Upload a new avatar')?.disabled).toBe(true);

    await act(async () => finish({ success: true }));

    expect(text('status')).toBeNull();
  });

  it('shows the action error and does not re-read', async () => {
    actions.uploadAvatar.mockResolvedValueOnce({ error: 'storage said no' });

    await choose(image());

    expect(text('alert')).toBe('storage said no');
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it('refuses an oversized file without calling the action', async () => {
    await choose(image(MAX_AVATAR_BYTES + 1));

    expect(text('alert')).toBe(AVATAR_TOO_LARGE);
    expect(actions.uploadAvatar).not.toHaveBeenCalled();
  });

  // Otherwise picking the same file after a failure would not fire `change`.
  it('clears the input so the same file can be chosen again', async () => {
    actions.uploadAvatar.mockResolvedValueOnce({ success: true });

    await choose(image());

    expect(fileInput()?.value).toBe('');
  });

  it('removes the avatar and re-reads the page', async () => {
    actions.removeAvatar.mockResolvedValueOnce({ success: true });

    await act(async () => byText('Remove')?.click());

    expect(actions.removeAvatar).toHaveBeenCalledOnce();
    expect(router.refresh).toHaveBeenCalled();
  });

  // There is nothing to take down when the account has no avatar, and the
  // page says so by leaving the link out. The + stays either way.
  it('offers no remove link when there is no avatar', async () => {
    await render(false);

    expect(byText('Remove')).toBeUndefined();
    expect(byLabel('Upload a new avatar')).toBeDefined();
  });
});
