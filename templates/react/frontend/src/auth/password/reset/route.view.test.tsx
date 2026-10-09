import type { Session } from '@nhost/nhost-js/auth';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResetView } from '@/auth/password/reset/resetView';
import ResetPasswordPage from '@/auth/password/reset/route';

// Which view a state maps to is `resetView.test.ts`. This is what the page
// draws for each, since nothing here can change the page's own state.
const view = vi.hoisted(() => ({ current: 'form' as ResetView }));

vi.mock('@/auth/password/reset/resetView', () => ({
  resetView: () => view.current,
}));

vi.mock('@/lib/nhost/AuthProvider', () => ({
  useAuth: () => ({
    nhost: {},
    session: { user: { email: 'ada@example.com' } } as Session,
    isLoading: false,
    linkError: null,
  }),
}));

function render(): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <ResetPasswordPage />
    </MemoryRouter>,
  );
}

describe('password reset page views', () => {
  beforeEach(() => {
    view.current = 'form';
  });

  it('says the password changed and sends them to sign in with it', () => {
    view.current = 'changed';
    const html = render();

    expect(html).toContain('Password changed');
    expect(html).toContain('signed you out everywhere');
    expect(html).toContain('href="/auth/password?intent=sign-in"');
    expect(html).not.toContain('This link no longer works');
  });

  it('shows nothing while a change that dropped the session returns', () => {
    view.current = 'waiting';

    expect(render()).toBe('');
  });

  it('offers the form otherwise', () => {
    expect(render()).toContain('Choose a new password');
  });
});
