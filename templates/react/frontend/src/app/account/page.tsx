import type { User } from '@nhost/nhost-js/auth';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import DeleteAccountSetting from '@/app/account/DeleteAccountSetting';
import ProfileSummary from '@/app/account/ProfileSummary';
import SessionsCard from '@/app/account/SessionsCard';
import SignInSettings from '@/app/account/SignInSettings';
import { signInHref } from '@/app/signin/destination';
import Code from '@/components/Code';
import { SettingsList } from '@/components/Setting';
import { Card } from '@/components/ui/card';
import { getVerifiedUser, nhost } from '@/lib/nhost/client';
import { useLoad } from '@/lib/useLoad';

// A stored session the auth service turned down was revoked or never real.
// Cleared first, or the sign-in page would send the visitor straight back.
function SignInAgain() {
  const navigate = useNavigate();

  useEffect(() => {
    nhost.sessionStorage.remove();
    void navigate(signInHref('/account'), { replace: true });
  }, [navigate]);

  return null;
}

export default function Account() {
  // The guard only reads the stored session, which any script on the page can
  // write, so it redirects the signed-out but proves nothing.
  const verified = useLoad(getVerifiedUser);

  // A reload that comes back empty keeps the account on screen: whatever ended
  // the session navigates away on its own.
  const [last, setLast] = useState<User | null>(null);
  if (verified?.user && verified.user !== last) {
    setLast(verified.user);
  }
  const user = verified?.user ?? last;

  if (!user) {
    if (!verified || verified.user) {
      return null;
    }

    // Anything but a refusal says nothing about the session, and sending it to
    // the sign-in page, which sends a session here, would loop until it ends.
    if (verified.reason === 'unavailable') {
      return (
        <p
          role="alert"
          className="mx-auto max-w-2xl text-center text-destructive text-sm"
        >
          Could not load your account. Reload the page to try again.
        </p>
      );
    }

    return <SignInAgain />;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <ProfileSummary user={user} />
      <SignInSettings user={user} />
      <SessionsCard />
      {/* Untitled: the label says what the row is, and the dialog it opens
          spells out what the button does. */}
      <Card className="gap-0 py-0">
        <SettingsList>
          <DeleteAccountSetting />
        </SettingsList>
      </Card>

      <p className="mt-2 text-center text-muted-foreground text-sm">
        Edit this page in <Code>src/app/account/</Code>.
      </p>
    </div>
  );
}
