import { getDeviceItem, setDeviceItem } from '@/lib/deviceStore';
import {
  forgetPasskey,
  passkeysOnThisDevice,
  rememberPasskey,
} from '@/screens/auth/passkey/thisDevice';

describe('passkeys on this device', () => {
  it('remembers a passkey once, and forgets it again', () => {
    rememberPasskey('cred-1');
    rememberPasskey('cred-2');
    rememberPasskey('cred-1');

    expect([...passkeysOnThisDevice()]).toEqual(['cred-2', 'cred-1']);

    forgetPasskey('cred-2');

    expect([...passkeysOnThisDevice()]).toEqual(['cred-1']);
  });

  // Credential ids can run to hundreds of characters, and the list is one
  // SecureStore value.
  it('keeps the newest ids within one SecureStore value', () => {
    for (let n = 0; n < 12; n++) {
      rememberPasskey(`${n}`.padStart(400, 'x'));
    }

    const kept = [...passkeysOnThisDevice()];
    expect(kept.at(-1)).toBe('11'.padStart(400, 'x'));
    expect(kept.length).toBeLessThan(12);
    expect(getDeviceItem('nhostPasskeys')?.length).toBeLessThanOrEqual(2048);
  });

  it('reads an unreadable value as none', () => {
    rememberPasskey('cred-1');
    setDeviceItem('nhostPasskeys', '{');

    expect(passkeysOnThisDevice().size).toBe(0);
  });
});
