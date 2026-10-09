// @vitest-environment happy-dom
import type { Session } from '@nhost/nhost-js/auth';
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ResetPasswordPage from './+page.svelte';

type Result = { error?: string; success?: boolean };

const setNewPassword = vi.hoisted(() => vi.fn<() => Promise<Result>>());

vi.mock('../actions', () => ({ setNewPassword }));

// Reactive, as the app's own session is, so clearing it re-renders the page.
let session = $state<Session | null>(null);

vi.mock('$lib/nhost/auth.svelte', () => ({
  useAuth: () => ({
    nhost: {},
    get session() {
      return session;
    },
    linkError: null,
  }),
}));

// A browser's own stylesheet hides `[hidden]`; happy-dom's does not.
document.head.innerHTML = '<style>[hidden] { display: none }</style>';

let page: ReturnType<typeof mount>;

const shown = (): string => document.body.innerText;

async function submit(password: string): Promise<void> {
  const input = document.querySelector('input') as HTMLInputElement;
  input.value = password;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();

  document.querySelector('button')?.click();
  await tick();
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

  return async (result) => {
    answer(result);
    await tick();
  };
}

describe('password reset page, through a change', () => {
  beforeEach(() => {
    setNewPassword.mockReset();
    session = { user: { email: 'ada@example.com' } } as Session;
    page = mount(ResetPasswordPage, { target: document.body });
  });

  afterEach(() => {
    unmount(page);
  });

  it('ends on the changed card, never the dead link', async () => {
    const answer = answerLater();
    const seen = [shown()];

    await submit('a new password');
    seen.push(shown());

    expect(document.querySelector('button')?.disabled).toBe(true);

    // The SDK clears the session before the call returns.
    session = null;
    flushSync();
    seen.push(shown());

    await answer({ success: true });
    seen.push(shown());

    expect(seen[0]).toContain('Choose a new password');
    expect(seen[1]).toContain('Saving…');
    expect(seen[2]).toBe('');
    expect(seen[3]).toContain('Password changed');
    expect(seen.join()).not.toContain('This link no longer works');
  });

  it('keeps a refused change on the form and says why', async () => {
    setNewPassword.mockResolvedValue({ error: 'Password is too short' });

    await submit('short');

    expect(shown()).toContain('Password is too short');
    expect(shown()).toContain('Save the new password');
    expect(document.querySelector('button')?.disabled).toBe(false);
  });

  it('reports a dead link when a failed change finds no session', async () => {
    const answer = answerLater();

    await submit('a new password');
    session = null;
    flushSync();
    await answer({ error: 'The reset link has expired. Request another.' });

    expect(shown()).toContain('This link no longer works');
  });
});
