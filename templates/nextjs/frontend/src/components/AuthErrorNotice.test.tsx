import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AuthErrorNotice from '@/components/AuthErrorNotice';

describe('AuthErrorNotice', () => {
  it('renders nothing without an error', () => {
    expect(renderToStaticMarkup(<AuthErrorNotice error={undefined} />)).toBe(
      '',
    );
    expect(renderToStaticMarkup(<AuthErrorNotice error="" />)).toBe('');
  });

  it('shows the message for a known code, and the code', () => {
    const html = renderToStaticMarkup(
      <AuthErrorNotice error="disabled-endpoint" />,
    );

    expect(html).toContain('enable it in nhost/nhost.toml');
    expect(html).toContain('(disabled-endpoint)');
    expect(html).toContain('role="alert"');
  });

  it('shows only a generic line for an unknown code', () => {
    const html = renderToStaticMarkup(
      <AuthErrorNotice error="account-locked" />,
    );

    expect(html).toContain('Sign-in failed.');
    expect(html).not.toContain('account-locked');
  });

  it('takes the first value when a parameter is repeated', () => {
    const html = renderToStaticMarkup(
      <AuthErrorNotice error={['invalid-ticket', 'disabled-endpoint']} />,
    );

    expect(html).toContain('(invalid-ticket)');
    expect(html).toContain('This link is invalid or has expired.');
    expect(html).not.toContain('disabled-endpoint');
  });
});
