import { useState } from 'react';
import { Link } from 'react-router';
import ResetPasswordForm from '@/auth/password/reset/ResetPasswordForm';
import { resetView } from '@/auth/password/reset/resetView';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/lib/nhost/AuthProvider';
import { DEFAULT_DESTINATION } from '@/signin/destination';
import { signInQuery } from '@/signin/query';

// The password form in its sign-in mode, the only one that offers to send
// another reset link.
const passwordSignIn = `/auth/password${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`;

// The reset email's link goes through the auth service, which sends the
// browser back here with a refresh token that `lib/nhost/linkToken.ts`
// redeems on the way in, or with an error when the link expired or was
// already used. The error is checked first: a visitor who was already signed
// in still has a session when the link fails, and it is not the link's.
export default function ResetPasswordPage() {
  const { session, isLoading, linkError } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [changed, setChanged] = useState(false);

  // The token is redeemed before this resolves, so waiting is what keeps a
  // working link from being reported as expired.
  if (isLoading) {
    return null;
  }

  const view = resetView({
    changed,
    pending: isSaving,
    signedIn: session !== null,
    linkFailed: linkError !== null,
  });

  if (view === 'changed') {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Password changed</CardTitle>
            <CardDescription>
              Changing it signed you out everywhere, this browser included. Sign
              in again with the new password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to={passwordSignIn}>Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (view === 'waiting') {
    return null;
  }

  if (view === 'link-failed') {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>This link no longer works</CardTitle>
            <CardDescription>
              {/* With an error, the notice above the page already says why. */}
              {linkError
                ? 'Request another one and open it from the same browser.'
                : 'It has expired or was already used. Request another one and open it from the same browser.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to={passwordSignIn}>Request a new link</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>
            The link signed you in as {session?.user?.email ?? 'this account'}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm
            isSaving={isSaving}
            onSavingChange={setIsSaving}
            onChanged={() => setChanged(true)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
