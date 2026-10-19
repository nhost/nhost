// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MagicLinkForm from '@/app/auth/magic-link/MagicLinkForm';

const sendMagicLink = vi.hoisted(() => vi.fn());

vi.mock('@/app/auth/magic-link/actions', () => ({ sendMagicLink }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

// React listens for `input` and reads the value through the native setter,
// so a plain assignment to `.value` would be invisible to it.
async function type(value: string): Promise<void> {
  const input = container.querySelector('input');
  const set = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  await act(async () => {
    set?.call(input, value);
    input?.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('magic link form', () => {
  beforeEach(async () => {
    sendMagicLink.mockReset();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    await act(async () =>
      root.render(<MagicLinkForm next="/account" mailboxURL={null} />),
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  // The link signs in whichever browser opens it, so the copy has to say
  // which one rather than promise this device.
  it('tells the visitor to open the link in this browser', async () => {
    sendMagicLink.mockResolvedValueOnce({ success: true });
    await type('user@example.com');

    await act(async () =>
      container
        .querySelector('form')
        ?.dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        ),
    );

    expect(container.textContent).toContain(
      'A sign-in link is on its way to user@example.com. Open it in this browser to sign in here.',
    );
  });
});
