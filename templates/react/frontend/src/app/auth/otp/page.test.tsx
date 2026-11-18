import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import OtpSignIn from '@/app/auth/otp/page';

vi.mock('@/app/signin/methods', () => ({
  methods: [{}, {}],
  buttons: [],
}));

function render(search: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[`/auth/otp${search}`]}>
      <OtpSignIn />
    </MemoryRouter>,
  );
}

describe('email code page', () => {
  // The link in the code email carries no address, so the visitor starts over.
  it('opens on the email step from the email link', () => {
    const html = render('');

    expect(html).toContain('Send me a code');
    expect(html).not.toContain('one-time-code');
  });

  it('opens on the code step for a given address', () => {
    const html = render('?email=user%40example.com');

    expect(html).toContain('We sent a code to user@example.com');
    expect(html).toContain('one-time-code');
    expect(html).not.toContain('Send me a code');
  });
});
