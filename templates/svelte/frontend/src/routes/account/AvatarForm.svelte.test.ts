import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AvatarForm from './AvatarForm.svelte';
import { AVATAR_TOO_LARGE, MAX_AVATAR_BYTES } from './avatar.ts';

const refreshAll = vi.hoisted(() => vi.fn());
const actions = vi.hoisted(() => ({
  uploadAvatar: undefined as unknown,
  removeAvatar: vi.fn(),
}));
const upload = vi.hoisted(() => ({ submit: undefined as unknown }));

vi.mock('$app/navigation', () => ({ refreshAll }));
vi.mock('./actions.remote.ts', async () => {
  const { fakeForm } = await import('#lib/testing/remoteForm.ts');
  const { form, submit } = fakeForm();
  actions.uploadAvatar = form;
  upload.submit = submit;
  return actions;
});

const submit = () => upload.submit as ReturnType<typeof vi.fn>;

// A stand-in for the image, which the page renders and passes in.
const children = createRawSnippet(() => ({
  render: () => '<div data-testid="the-image"></div>',
}));

// What the browser does when a file is picked: the input holds it, then the
// input fires `change`.
async function choose(file: File): Promise<void> {
  const input = screen.getByLabelText('New avatar image') as HTMLInputElement;
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  await fireEvent.change(input);
}

const image = (bytes = 8): File =>
  new File([new Uint8Array(bytes)], 'me.png', { type: 'image/png' });

describe('avatar control', () => {
  beforeEach(() => {
    refreshAll.mockReset();
    actions.removeAvatar.mockReset();
    submit().mockReset();
    render(AvatarForm, { props: { canRemove: true, children } });
  });

  // Choosing the file is the whole gesture: there is no second press.
  it('uploads as soon as a file is chosen', async () => {
    submit().mockResolvedValueOnce({ success: true });

    await choose(image());

    expect(submit()).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says why the server refused the file', async () => {
    submit().mockResolvedValueOnce({
      error: 'Use a PNG, JPEG, WebP or AVIF image.',
    });

    await choose(image());

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Use a PNG',
    );
  });

  it('refuses an oversized file without sending it', async () => {
    await choose(image(MAX_AVATAR_BYTES + 1));

    expect(screen.getByRole('alert').textContent?.trim()).toBe(
      AVATAR_TOO_LARGE,
    );
    expect(submit()).not.toHaveBeenCalled();
  });
});
