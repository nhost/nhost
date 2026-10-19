import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PasswordChanged from '@/app/auth/password/PasswordChanged';
import PasswordChangedLayout from '@/app/auth/password/PasswordChangedLayout';

describe('password changed card', () => {
  it('sends them to sign in with the new password', () => {
    const html = renderToStaticMarkup(<PasswordChanged />);

    expect(html).toContain('Password changed');
    expect(html).toContain('signed you out everywhere');
    expect(html).toContain('href="/auth/password?intent=sign-in"');
  });

  it('is not shown before a change', () => {
    const html = renderToStaticMarkup(
      <PasswordChangedLayout>
        <p>The page</p>
      </PasswordChangedLayout>,
    );

    expect(html).toBe('<p>The page</p>');
  });
});
