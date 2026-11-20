import { useEffect } from 'react';
import { nhost } from '@/lib/nhost/client';
import PasswordChanged from '@/screens/auth/password/PasswordChanged';

/**
 * The changed card, for a change that could not sign this device back in.
 * The stored session is cleared only once the card has replaced the account
 * screen, so nothing under it reacts to the sign-out. The change already
 * revoked it, so there is nothing to tell the auth service.
 */
export default function ChangedAndSignedOut() {
  useEffect(() => {
    nhost.sessionStorage.remove();
  }, []);

  return <PasswordChanged />;
}
