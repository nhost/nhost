// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import OtpSignIn from '@/app/auth/otp/index.vue';
import { mountAt } from '@/test/mount';

vi.mock('@/app/signin/methods', () => ({
  methods: [{}, {}],
  buttons: [],
}));

const render = async (search: string) =>
  (await mountAt(OtpSignIn, `/auth/otp${search}`)).el.innerHTML;

describe('email code page', () => {
  // The link in the code email carries no address, so the visitor starts over.
  it('opens on the email step from the email link', async () => {
    const html = await render('');

    expect(html).toContain('Send me a code');
    expect(html).not.toContain('one-time-code');
  });

  it('opens on the code step for a given address', async () => {
    const html = await render('?email=user%40example.com');

    expect(html).toContain('We sent a code to user@example.com');
    expect(html).toContain('one-time-code');
    expect(html).not.toContain('Send me a code');
  });
});
