import type { Session } from '@nhost/nhost-js/auth';
import { describe, expect, it, vi } from 'vitest';
import { watchSignIn } from '@/lib/nhost/watchSignIn';

const STORED = { refreshToken: 'stored' } as Session;
const NEW = { refreshToken: 'new' } as Session;

describe('watchSignIn', () => {
  // The order `AuthProvider` sees when a failed link arrives as an event
  // while the disk is being read: memory is shown empty, the stored session
  // is read, the link's error is set, and only then is the session shown. A
  // user who was signed in all along must keep that notice.
  it('does not count the stored session as a sign-in', () => {
    const onSignIn = vi.fn();
    const signIns = watchSignIn(onSignIn);

    signIns.seen(null);
    signIns.hydrated(STORED);
    signIns.seen(STORED);

    expect(onSignIn).not.toHaveBeenCalled();
  });

  it('counts a session where there was none', () => {
    const onSignIn = vi.fn();
    const signIns = watchSignIn(onSignIn);

    signIns.hydrated(null);
    signIns.seen(null);
    signIns.seen(NEW);

    expect(onSignIn).toHaveBeenCalledOnce();
  });

  it('does not count a session that is refreshed', () => {
    const onSignIn = vi.fn();
    const signIns = watchSignIn(onSignIn);

    signIns.hydrated(STORED);
    signIns.seen(NEW);

    expect(onSignIn).not.toHaveBeenCalled();
  });

  it('counts signing in again after signing out', () => {
    const onSignIn = vi.fn();
    const signIns = watchSignIn(onSignIn);

    signIns.hydrated(STORED);
    signIns.seen(null);
    signIns.seen(NEW);

    expect(onSignIn).toHaveBeenCalledOnce();
  });
});
