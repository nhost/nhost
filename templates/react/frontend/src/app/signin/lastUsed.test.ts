// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  lastUsedSignIn,
  promoteSignInAttempt,
  recordSignInAttempt,
} from '@/app/signin/lastUsed';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('last used sign-in', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('becomes the attempt once a session starts, and the attempt goes', () => {
    recordSignInAttempt('/auth/otp');
    promoteSignInAttempt();

    expect(lastUsedSignIn()).toBe('/auth/otp');
    expect(localStorage.getItem('nhostSignInAttempt')).toBeNull();
  });

  it('stays when there is no attempt to promote', () => {
    recordSignInAttempt('/auth/otp');
    promoteSignInAttempt();
    promoteSignInAttempt();

    expect(lastUsedSignIn()).toBe('/auth/otp');
  });

  it('ignores an attempt older than a day', () => {
    recordSignInAttempt('/auth/otp');
    vi.advanceTimersByTime(DAY_MS);
    promoteSignInAttempt();

    expect(lastUsedSignIn()).toBeNull();
  });

  it('is forgotten after a year', () => {
    recordSignInAttempt('/auth/otp');
    promoteSignInAttempt();
    vi.advanceTimersByTime(365 * DAY_MS);

    expect(lastUsedSignIn()).toBeNull();
  });

  it('reads an entry it cannot parse as none', () => {
    localStorage.setItem('nhostLastSignIn', '/auth/otp');

    expect(lastUsedSignIn()).toBeNull();
    expect(localStorage.getItem('nhostLastSignIn')).toBeNull();
  });
});
