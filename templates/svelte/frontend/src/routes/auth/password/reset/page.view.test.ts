import { render } from 'svelte/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResetPasswordPage from './+page.svelte';
import type { ResetView } from './resetView';

// Which view a state maps to is `resetView.test.ts`. This is what the page
// draws for each, since the server renderer cannot change the page's state.
const view = vi.hoisted(() => ({ current: 'form' as ResetView }));

vi.mock('./resetView', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./resetView')>()),
  resetView: () => view.current,
}));

vi.mock('$lib/nhost/auth.svelte', () => ({
  useAuth: () => ({
    nhost: {},
    session: { user: { email: 'ada@example.com' } },
    linkError: null,
  }),
}));

const html = (): string => render(ResetPasswordPage).body;

describe('password reset page views', () => {
  beforeEach(() => {
    view.current = 'form';
  });

  it('says the password changed in place of everything else', () => {
    view.current = 'changed';
    const out = html();

    expect(out).toContain('Password changed');
    expect(out).not.toContain('This link no longer works');
    expect(out).not.toContain('Save the new password');
  });

  // The form's call is still out, and it is the form that reports how it
  // ended, so it has to stay mounted.
  it('hides the form rather than dropping it while a change returns', () => {
    view.current = 'waiting';

    expect(html()).toMatch(/<div hidden="">[\s\S]*Save the new password/);
  });

  it('shows the form otherwise', () => {
    const out = html();

    expect(out).not.toContain('<div hidden');
    expect(out).toContain('Save the new password');
  });
});
