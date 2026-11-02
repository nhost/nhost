import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import OtpSignIn from '@/app/auth/otp/page';

vi.mock('next/navigation', () => ({ useRouter: () => ({}) }));
vi.mock('@/app/signin/methods', () => ({
  methods: [{}, {}],
  buttons: [],
}));

async function render(params: { email?: string }): Promise<string> {
  return renderToStaticMarkup(
    await OtpSignIn({ searchParams: Promise.resolve(params) }),
  );
}

describe('email code page', () => {
  // The link in the code email lands here with the address it was sent to.
  it('opens on the code step from the email link', async () => {
    const html = await render({ email: 'user@example.com' });

    expect(html).toContain('We sent a code to user@example.com');
    expect(html).toContain('one-time-code');
    expect(html).not.toContain('Send me a code');
  });
});
