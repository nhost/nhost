import { Link } from 'react-router';
import ResetPasswordForm from '@/auth/password/reset/ResetPasswordForm';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/lib/nhost/AuthProvider';

// The reset email's link goes through the auth service, which sends the
// browser back here with a refresh token that `lib/nhost/linkToken.ts`
// redeems on the way in, or with an error when the link expired or was
// already used. The error is checked first: a visitor who was already signed
// in still has a session when the link fails, and it is not the link's.
export default function ResetPasswordPage() {
  const { session, isLoading, linkError } = useAuth();

  // The token is redeemed before this resolves, so waiting is what keeps a
  // working link from being reported as expired.
  if (isLoading) {
    return null;
  }

  if (linkError || !session) {
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
              <Link to="/auth/password">Request a new link</Link>
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
            The link signed you in as {session.user?.email ?? 'this account'}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
