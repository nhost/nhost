// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { h } from 'vue';
import AvatarForm from '@/app/account/AvatarForm.vue';
import { AVATAR_TOO_LARGE, MAX_AVATAR_BYTES } from '@/app/account/avatar';
import { type Mounted, mountAt, settle, textOf } from '@/test/mount';

const refresh = vi.hoisted(() => vi.fn());
const actions = vi.hoisted(() => ({
  uploadAvatar: vi.fn(),
  removeAvatar: vi.fn(),
}));

vi.mock('@/components/useRefresh', () => ({ useRefresh: () => refresh }));
vi.mock('@/app/account/actions', () => actions);

let mounted: Mounted;

// What the browser does when a file is picked: the input holds it, then the
// input fires `change`.
async function choose(file: File): Promise<void> {
  const input =
    mounted.el.querySelector<HTMLInputElement>('input[type="file"]');
  const transfer = new DataTransfer();
  transfer.items.add(file);
  if (input) {
    input.files = transfer.files;
  }
  input?.dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
}

const image = (bytes = 8): File =>
  new File([new Uint8Array(bytes)], 'me.png', { type: 'image/png' });

describe('avatar control', () => {
  beforeEach(async () => {
    refresh.mockReset();
    actions.uploadAvatar.mockReset();
    actions.removeAvatar.mockReset();
    // A stand-in for the image, which the page renders and passes in.
    mounted = await mountAt(() =>
      h(AvatarForm, { canRemove: true }, () => h('div', { id: 'the-image' })),
    );
  });

  // Choosing the file is the whole gesture: there is no second press.
  it('uploads as soon as a file is chosen and loads the page again', async () => {
    actions.uploadAvatar.mockResolvedValueOnce({ success: true });

    await choose(image());

    expect(actions.uploadAvatar).toHaveBeenCalledOnce();
    expect(actions.uploadAvatar.mock.calls[0]?.[0]).toBeInstanceOf(FormData);
    expect(refresh).toHaveBeenCalled();
  });

  it('refuses an oversized file without calling the action', async () => {
    await choose(image(MAX_AVATAR_BYTES + 1));

    expect(textOf(mounted.el, 'alert')).toBe(AVATAR_TOO_LARGE);
    expect(actions.uploadAvatar).not.toHaveBeenCalled();
  });
});
