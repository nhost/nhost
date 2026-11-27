import { fireEvent, render } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UserAvatar from './UserAvatar.svelte';

const GOOGLE_PICTURE = 'https://lh3.googleusercontent.com/a/picture=s96-c';

const renderAvatar = (avatarUrl: string | undefined) =>
  render(UserAvatar, {
    props: { avatarUrl, displayName: 'Ada', width: 64 },
  });

// happy-dom never fetches images, so it reports every one as finished and
// broken. These start each one still loading, as a browser would.
const imageComplete = vi.spyOn(HTMLImageElement.prototype, 'complete', 'get');

describe('user avatar', () => {
  beforeEach(() => {
    imageComplete.mockReturnValue(false);
  });

  it('shows the picture over the initial', () => {
    const { container } = renderAvatar(GOOGLE_PICTURE);

    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      GOOGLE_PICTURE,
    );
    expect(container.textContent).toContain('A');
  });

  it('drops a picture that fails to load, leaving the initial', async () => {
    const { container } = renderAvatar(GOOGLE_PICTURE);
    const img = container.querySelector('img');
    if (!img) {
      throw new Error('no img');
    }

    await fireEvent.error(img);

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent?.trim()).toBe('A');
  });

  it('drops a picture that failed before the page hydrated', () => {
    imageComplete.mockReturnValue(true);
    const { container } = renderAvatar(GOOGLE_PICTURE);

    expect(container.querySelector('img')).toBeNull();
  });

  it('tries a new picture after the last one failed', async () => {
    const { container, rerender } = renderAvatar(GOOGLE_PICTURE);
    const img = container.querySelector('img');
    if (!img) {
      throw new Error('no img');
    }
    await fireEvent.error(img);

    await rerender({
      avatarUrl: '/api/avatar/2b4b0a43-9d0c-4f39-9d5b-6c1f3c1b0e7a',
    });

    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      '/api/avatar/2b4b0a43-9d0c-4f39-9d5b-6c1f3c1b0e7a?w=64',
    );
  });
});
