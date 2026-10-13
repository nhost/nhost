import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AuthErrorNotice from '@/components/AuthErrorNotice';

describe('AuthErrorNotice', () => {
  it('renders nothing without an error', () => {
    expect(
      renderToStaticMarkup(
        <AuthErrorNotice error={undefined} description={undefined} />,
      ),
    ).toBe('');
  });

  it('shows the description and the code', () => {
    const html = renderToStaticMarkup(
      <AuthErrorNotice
        error="disabled-endpoint"
        description="This endpoint is disabled"
      />,
    );

    expect(html).toContain('This endpoint is disabled');
    expect(html).toContain('(disabled-endpoint)');
    expect(html).toContain('role="alert"');
  });

  it('falls back to a generic line when only the code came back', () => {
    const html = renderToStaticMarkup(
      <AuthErrorNotice error="invalid-ticket" description={undefined} />,
    );

    expect(html).toContain('Sign-in failed.');
  });

  // The auth service's message is interpolated into the page, so it has to
  // arrive as text. React escapes it; this pins that the notice does not undo
  // that by rendering raw HTML.
  it('escapes the description', () => {
    const html = renderToStaticMarkup(
      <AuthErrorNotice error="x" description="<img src=x onerror=alert(1)>" />,
    );

    expect(html).not.toContain('<img');
  });

  it('takes the first value when a parameter is repeated', () => {
    const html = renderToStaticMarkup(
      <AuthErrorNotice error={['first', 'second']} description={['a', 'b']} />,
    );

    expect(html).toContain('(first)');
    expect(html).toContain('>a ');
  });
});
