// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import {
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
});
