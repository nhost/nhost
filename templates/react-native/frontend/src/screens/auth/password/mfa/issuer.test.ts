import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { User } from '@nhost/nhost-js/auth';
import { TOTP_ISSUER, totpUri } from '@/screens/auth/password/mfa/totp';

const NHOST_TOML = resolve(__dirname, '../../../../../../nhost/nhost.toml');

describe('the two-factor issuer', () => {
  // Auth names the QR code's entry after its own setting; the app's link
  // would otherwise add the same key under another name.
  it('is the one auth issues codes under', () => {
    const toml = readFileSync(NHOST_TOML, 'utf8');
    const totp = toml.slice(toml.indexOf('[auth.totp]'));

    expect(totp.match(/^issuer = '(.*)'$/m)?.[1]).toBe(TOTP_ISSUER);
  });

  it('names the issuer and the account in the authenticator link', () => {
    const uri = totpUri('LBU4RFZ3L6VWIXZG', {
      id: 'user-id',
      email: 'ada@example.com',
    } as User);

    expect(uri).toBe(
      'otpauth://totp/Nhost%20%2B%20React%20Native:ada%40example.com?secret=LBU4RFZ3L6VWIXZG&issuer=Nhost%20%2B%20React%20Native&algorithm=SHA1&digits=6&period=30',
    );
  });
});
