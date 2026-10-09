import { describe, expect, it } from 'vitest';
import { passwordSignIn, resetView } from './resetView';

const state = {
  changed: false,
  pending: false,
  signedIn: true,
  linkFailed: false,
};

describe('resetView', () => {
  it('offers the form to whoever is signed in', () => {
    expect(resetView(state)).toBe('form');
    expect(resetView({ ...state, pending: true })).toBe('form');
  });

  it('says the link failed without a session or with an error', () => {
    expect(resetView({ ...state, signedIn: false })).toBe('link-failed');
    expect(resetView({ ...state, linkFailed: true })).toBe('link-failed');
  });

  // The SDK clears the session the moment the server accepts the change, a
  // little before the call returns.
  it('waits rather than reporting a dead link while the change returns', () => {
    expect(resetView({ ...state, pending: true, signedIn: false })).toBe(
      'waiting',
    );
  });

  it('says the password changed once the session is gone', () => {
    expect(
      resetView({ ...state, changed: true, pending: true, signedIn: false }),
    ).toBe('changed');
    expect(resetView({ ...state, changed: true, signedIn: false })).toBe(
      'changed',
    );
  });

  it('never shows a dead link at any step of a change that worked', () => {
    const steps = [
      state,
      { ...state, pending: true },
      { ...state, pending: true, signedIn: false },
      { ...state, pending: true, signedIn: false, changed: true },
      { ...state, signedIn: false, changed: true },
    ];

    expect(steps.map(resetView)).not.toContain('link-failed');
  });

  // Only that mode offers a reset link, and it is the one the new password
  // signs in with. The form opens on sign up without an intent.
  it('sends both ways out to the sign-in mode of the password form', () => {
    expect(passwordSignIn).toBe('/auth/password?intent=sign-in');
  });
});
