// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChangeEmailForm from '@/app/account/ChangeEmailForm';

const actions = vi.hoisted(() => ({
  changeEmail: vi.fn(),
  resendVerification: vi.fn(),
}));

vi.mock('@/app/account/actions', () => actions);

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

async function render(verified: boolean): Promise<void> {
  await act(async () =>
    root.render(
      <ChangeEmailForm
        email="user@example.com"
        verified={verified}
        mailboxURL={null}
      />,
    ),
  );
}

// React listens for `input` and reads the value through the native setter,
// so a plain assignment to `.value` would be invisible to it.
async function type(label: string, value: string): Promise<void> {
  const input = [...container.querySelectorAll('label')].find(
    (candidate) => candidate.textContent === label,
  )?.control as HTMLInputElement | undefined;
  const set = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  await act(async () => {
    set?.call(input, value);
    input?.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function submit(): Promise<void> {
  await act(async () =>
    container
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  );
}

async function _click(label: string): Promise<void> {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === label,
  );
  await act(async () => button?.click());
}

const text = (role: string): string | null =>
  container.querySelector(`[role="${role}"]`)?.textContent ?? null;

describe('change email form', () => {
  beforeEach(() => {
    actions.changeEmail.mockReset();
    actions.resendVerification.mockReset();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('starts the change and says where the link went', async () => {
    actions.changeEmail.mockResolvedValueOnce({ success: true });
    await render(true);
    await type('New email', 'new@example.com');

    await submit();

    expect(actions.changeEmail).toHaveBeenCalledWith('new@example.com');
    expect(text('status')).toContain('confirmation link to new@example.com');
    expect(text('status')).toContain('changes when you open it');
  });
});
