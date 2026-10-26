// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  alreadyRegistered,
  forgetPasskey,
  passkeysOnThisDevice,
  rememberPasskey,
} from '@/app/auth/passkey/thisDevice';

beforeEach(() => {
  localStorage.clear();
});

describe('passkeys on this device', () => {
  it('remembers a passkey once, and forgets it again', () => {
    rememberPasskey('cred-1');
    rememberPasskey('cred-2');
    rememberPasskey('cred-1');

    expect([...passkeysOnThisDevice()]).toEqual(['cred-2', 'cred-1']);

    forgetPasskey('cred-2');

    expect([...passkeysOnThisDevice()]).toEqual(['cred-1']);
  });

  // One browser can sign in to many accounts, but not to hundreds.
  it('keeps only the most recent twenty', () => {
    for (let n = 1; n <= 25; n += 1) {
      rememberPasskey(`cred-${n}`);
    }

    const ids = passkeysOnThisDevice();
    expect(ids.size).toBe(20);
    expect(ids.has('cred-5')).toBe(false);
    expect(ids.has('cred-25')).toBe(true);
  });

  it('reads anything else in its place as nothing remembered', () => {
    localStorage.setItem('nhostPasskeys', '{not json');
    expect(passkeysOnThisDevice().size).toBe(0);

    localStorage.setItem('nhostPasskeys', JSON.stringify({ id: 'cred' }));
    expect(passkeysOnThisDevice().size).toBe(0);
  });
});

describe('alreadyRegistered', () => {
  it('recognises the device refusing an excluded passkey', () => {
    expect(
      alreadyRegistered(
        Object.assign(new Error('registered'), { name: 'InvalidStateError' }),
      ),
    ).toBe(true);
    expect(
      alreadyRegistered(
        Object.assign(new Error('cancelled'), { name: 'NotAllowedError' }),
      ),
    ).toBe(false);
  });
});
