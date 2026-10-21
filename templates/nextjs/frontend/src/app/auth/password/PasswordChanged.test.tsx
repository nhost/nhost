import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PasswordChanged from '@/app/auth/password/PasswordChanged';

describe('password changed card', () => {
  it('sends them to sign in with the new password', () => {
    const html = renderToStaticMarkup(<PasswordChanged />);

    expect(html).toContain('Password changed');
    expect(html).toContain('signed you out everywhere');
    expect(html).toContain('href="/auth/password?intent=sign-in"');
  });
});
