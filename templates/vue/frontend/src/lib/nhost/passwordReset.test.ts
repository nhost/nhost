// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  endPasswordReset,
  pendingPasswordReset,
  startPasswordReset,
} from '@/lib/nhost/passwordReset';

describe('password reset marker', () => {
  it('holds the reset page until the reset ends', () => {
    startPasswordReset('/auth/password/reset');
    expect(pendingPasswordReset()).toBe('/auth/password/reset');

    endPasswordReset();
    expect(pendingPasswordReset()).toBeNull();
  });
});
