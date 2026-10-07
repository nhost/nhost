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
// redeems on the way in. So a session means the link worked, and no session
// means it was expired or already used.
export default function ResetPasswordPage() {
  const { session, isLoading } = useAuth();

  // The token is redeemed before this resolves, so waiting is what keeps a
  // working link from being reported as expired.
  if (isLoading) {
    return null;
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>This link no longer works</CardTitle>
            <CardDescription>
              It has expired or was already used. Request another one and open
              it from the same browser.
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
