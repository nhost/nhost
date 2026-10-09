// @vitest-environment happy-dom
import type { Session } from '@nhost/nhost-js/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type App, createApp, nextTick, shallowRef } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import ResetPasswordRoute from '@/auth/password/reset/route.vue';

type Result = { error?: string; success?: boolean };

const setNewPassword = vi.hoisted(() => vi.fn<() => Promise<Result>>());

vi.mock('@/auth/password/actions', () => ({ setNewPassword }));

const session = shallowRef<Session | null>(null);
const linkError = shallowRef<string | null>(null);

vi.mock('@/lib/nhost/auth', () => ({
  useAuth: () => ({ nhost: {}, session, linkError }),
}));

let app: App;

const shown = (): string => document.body.innerText;

// Lets the form's call settle and the page render what it led to.
const settle = (): Promise<void> => new Promise((done) => setTimeout(done));

async function submit(password: string): Promise<void> {
  const input = document.querySelector('input') as HTMLInputElement;
  input.value = password;
  input.dispatchEvent(new Event('input'));
  await nextTick();

  document.querySelector('button')?.click();
  await nextTick();
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

  return (result) => {
    answer(result);
    return settle();
  };
}

describe('password reset page, through a change', () => {
  beforeEach(() => {
    setNewPassword.mockReset();
    session.value = { user: { email: 'ada@example.com' } } as Session;
    linkError.value = null;

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:p(.*)', component: { render: () => null } }],
    });
    app = createApp(ResetPasswordRoute).use(router);
    app.mount(document.body.appendChild(document.createElement('div')));
  });

  afterEach(() => {
    app.unmount();
    document.body.innerHTML = '';
  });

  it('ends on the changed card, never the dead link', async () => {
    const answer = answerLater();
    const seen = [shown()];

    await submit('a new password');
    seen.push(shown());

    expect(document.querySelector('button')?.disabled).toBe(true);

    // The SDK clears the session before the call returns.
    session.value = null;
    await nextTick();
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
    await settle();

    expect(shown()).toContain('Password is too short');
    expect(shown()).toContain('Save the new password');
    expect(document.querySelector('button')?.disabled).toBe(false);
  });

  it('reports a dead link when a failed change finds no session', async () => {
    const answer = answerLater();

    await submit('a new password');
    session.value = null;
    await nextTick();
    await answer({ error: 'The reset link has expired. Request another.' });

    expect(shown()).toContain('This link no longer works');
  });
});
