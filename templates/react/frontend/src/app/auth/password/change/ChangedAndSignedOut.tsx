import { useEffect } from 'react';
import PasswordChanged from '@/app/auth/password/PasswordChanged';
import { nhost } from '@/lib/nhost/client';

/**
 * The changed card, for a change that could not sign this browser back in.
 * The stored session is cleared only once the card has replaced the account
 * page, so nothing under it reacts to the sign-out. The change already revoked
 * it, so there is nothing to tell the auth service.
 */
export default function ChangedAndSignedOut() {
  useEffect(() => {
    nhost.sessionStorage.remove();
  }, []);

  return <PasswordChanged />;
}
