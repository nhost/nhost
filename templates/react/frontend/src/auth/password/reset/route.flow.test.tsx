// @vitest-environment happy-dom
import type { Session } from '@nhost/nhost-js/auth';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ResetPasswordPage from '@/auth/password/reset/route';

type Result = { error?: string; success?: boolean };

const setNewPassword = vi.hoisted(() => vi.fn<() => Promise<Result>>());

vi.mock('@/auth/password/actions', () => ({ setNewPassword }));

const auth = vi.hoisted(() => ({
  nhost: {},
  session: null as Session | null,
  isLoading: false,
  linkError: null,
}));

vi.mock('@/lib/nhost/AuthProvider', () => ({ useAuth: () => auth }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

// Rendering again is what the provider does when the session changes.
async function render(): Promise<void> {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <ResetPasswordPage />
      </MemoryRouter>,
    ),
  );
}

// React reads a controlled input through its own setter, so the value is set
// past it and announced the way typing does.
function type(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function submit(password: string): Promise<void> {
  await act(async () => {
    for (const input of container.querySelectorAll('input')) {
      type(input, password);
    }
  });
  await act(async () => container.querySelector('button')?.click());
}

// The server's answer, held until the test has played what happens while the
// call is out.
function answerLater(): (result: Result) => Promise<void> {
  let answer: (result: Result) => void = () => {};
  setNewPassword.mockImplementation(
    () =>
      new Promise((resolve) => {
        answer = resolve;
      }),
  );

  return (result) => act(async () => answer(result));
}

describe('password reset page, through a change', () => {
  beforeEach(() => {
    setNewPassword.mockReset();
    auth.session = { user: { email: 'ada@example.com' } } as Session;
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('ends on the changed card, never the dead link', async () => {
    const answer = answerLater();
    await render();
    const seen = [container.innerText];

    await submit('a new password');
    seen.push(container.innerText);

    expect(container.querySelector('button')?.disabled).toBe(true);

    // The SDK clears the session before the call returns.
    auth.session = null;
    await render();
    seen.push(container.innerText);

    await answer({ success: true });
    seen.push(container.innerText);

    expect(seen[0]).toContain('Choose a new password');
    expect(seen[1]).toContain('Saving…');
    expect(seen[2]).toBe('');
    expect(seen[3]).toContain('Password changed');
    expect(seen.join()).not.toContain('This link no longer works');
  });

  it('keeps a refused change on the form and says why', async () => {
    setNewPassword.mockResolvedValue({ error: 'Password is too short' });
    await render();

    await submit('short');

    expect(container.innerText).toContain('Password is too short');
    expect(container.innerText).toContain('Save password');
    expect(container.querySelector('button')?.disabled).toBe(false);
  });

  it('reports a dead link when a failed change finds no session', async () => {
    const answer = answerLater();
    await render();

    await submit('a new password');
    auth.session = null;
    await render();
    await answer({ error: 'The reset link has expired. Request another.' });

    expect(container.innerText).toContain('This link no longer works');
  });
});
