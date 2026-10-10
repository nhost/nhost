import { useEffect, useRef } from 'react';
import { NavigationType, useLocation, useNavigationType } from 'react-router';
import { useAuth } from '@/lib/nhost/AuthProvider';

/**
 * Says why the link or provider redirect the visitor arrived from did not
 * sign them in. It sits above every page because that can be any of them: an
 * auth email or a provider comes back to wherever `next` said.
 *
 * It belongs to the page the visitor arrived on and goes once they move on. A
 * protected page's redirect to sign-in replaces that page rather than leaving
 * it, so the reason follows them there.
 */
export default function LinkErrorNotice() {
  const { linkError, clearLinkError } = useAuth();
  const { key } = useLocation();
  const navigationType = useNavigationType();
  const arrival = useRef(key);

  useEffect(() => {
    if (key !== arrival.current && navigationType !== NavigationType.Replace) {
      clearLinkError();
    }
  }, [key, navigationType, clearLinkError]);

  if (!linkError) {
    return null;
  }

  return (
    <p role="alert" className="mx-auto mb-6 max-w-md text-destructive text-sm">
      {linkError}
    </p>
  );
}
