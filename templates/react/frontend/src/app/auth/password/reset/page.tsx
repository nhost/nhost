import { Link } from 'react-router';
import { passwordSignIn } from '@/app/auth/password/passwordSignIn';
import ResetPasswordForm from '@/app/auth/password/reset/ResetPasswordForm';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useSession } from '@/lib/nhost/AuthProvider';

// The reset email's link goes through the auth service, which sends the user
// back here with a refresh token startup redeems only for a signed-out
// visitor.
export default function ResetPassword() {
  const session = useSession();

  if (!session) {
    return (
      <div className="mx-auto max-w-sm">
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
              <Link to={passwordSignIn}>Request a new link</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>
            You are signed in as {session.user?.email ?? 'this account'}. Choose
            a new password for this account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
