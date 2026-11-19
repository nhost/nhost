import { FetchError } from '@nhost/nhost-js/fetch';
import { describe, expect, it } from 'vitest';
import { errorMessage, RETRY_IN } from './errors.ts';

const failed = (status: number, body: unknown = '') =>
  new FetchError(body, status, new Headers());

describe('errorMessage', () => {
  it("passes auth's own message through", () => {
    expect(
      errorMessage(
        failed(401, {
          error: 'invalid-email-password',
          message: 'Incorrect email or password',
        }),
      ),
    ).toBe('Incorrect email or password');
  });

  it('says how long to wait when rate-limited', () => {
    expect(errorMessage(failed(429))).toBe(
      'Too many attempts. Try again in a minute.',
    );
    expect(errorMessage(failed(429), RETRY_IN.signIn)).toBe(
      'Too many attempts. Try again in 5 minutes.',
    );
    expect(errorMessage(failed(429), RETRY_IN.email)).toBe(
      'Too many attempts. Try again in an hour.',
    );
  });
});
