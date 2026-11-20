import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import OtpSignIn from './+page.svelte';

const url = vi.hoisted(() => ({ current: 'http://localhost/auth/otp' }));

vi.mock('$app/state', () => ({
  page: {
    get url() {
      return new URL(url.current);
    },
  },
}));
vi.mock('#routes/signin/methods.ts', () => ({
  methods: [{}, {}],
  buttons: [],
}));

function html(search: string): string {
  url.current = `http://localhost/auth/otp${search}`;
  return render(OtpSignIn).body;
}

describe('email code page', () => {
  // The link in the code email carries no address, so the visitor starts over.
  it('opens on the email step from the email link', () => {
    const page = html('');

    expect(page).toContain('Send me a code');
    expect(page).not.toContain('one-time-code');
  });

  it('opens on the code step for a given address', () => {
    const page = html('?email=user%40example.com');

    expect(page).toContain('We sent a code to user@example.com');
    expect(page).toContain('one-time-code');
    expect(page).not.toContain('Send me a code');
  });
});
