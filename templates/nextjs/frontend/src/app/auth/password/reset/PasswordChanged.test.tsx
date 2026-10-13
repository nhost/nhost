import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ResetPasswordLayout from '@/app/auth/password/reset/layout';
import PasswordChanged from '@/app/auth/password/reset/PasswordChanged';

describe('password changed card', () => {
  it('sends them to sign in with the new password', () => {
    const html = renderToStaticMarkup(<PasswordChanged />);

    expect(html).toContain('Password changed');
    expect(html).toContain('signed you out everywhere');
    expect(html).toContain('href="/auth/password?intent=sign-in"');
  });

  it('is not shown before a change', () => {
    const html = renderToStaticMarkup(
      <ResetPasswordLayout>
        <p>The reset page</p>
      </ResetPasswordLayout>,
    );

    expect(html).toBe('<p>The reset page</p>');
  });
});
