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

// A stand-in for the image, which the server renders and passes in.
async function render(canRemove: boolean): Promise<void> {
  await act(async () =>
    root.render(
      <AvatarForm canRemove={canRemove}>
        <div data-testid="the-image" />
      </AvatarForm>,
    ),
  );
}

const _byText = (label: string): HTMLButtonElement | undefined =>
  [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === label,
  );

const fileInput = (): HTMLInputElement | null =>
  container.querySelector<HTMLInputElement>('input[type="file"]');

const _byLabel = (label: string): HTMLButtonElement | undefined =>
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

  // Choosing the file is the whole gesture: there is no second press.
  it('uploads as soon as a file is chosen and re-reads the page', async () => {
    actions.uploadAvatar.mockResolvedValueOnce({ success: true });

    await choose(image());

    expect(actions.uploadAvatar).toHaveBeenCalledOnce();
    expect(actions.uploadAvatar.mock.calls[0]?.[0]).toBeInstanceOf(FormData);
    expect(router.refresh).toHaveBeenCalled();
  });

  it('refuses an oversized file without calling the action', async () => {
    await choose(image(MAX_AVATAR_BYTES + 1));

    expect(text('alert')).toBe(AVATAR_TOO_LARGE);
    expect(actions.uploadAvatar).not.toHaveBeenCalled();
  });
});
