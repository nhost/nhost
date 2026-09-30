import Link from 'next/link';
import ResetPasswordForm from '@/app/auth/password/reset/ResetPasswordForm';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { createNhostClient } from '@/lib/nhost/server';

export const dynamic = 'force-dynamic';

// The reset email's link goes through the auth service, which sends the user
// back here with a refresh token the proxy redeems on the way in. So a session
// means the link worked, and no session means it was expired or already used.
export default async function ResetPassword() {
  const session = (await createNhostClient()).getUserSession();

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
              <Link href="/auth/password">Request a new link</Link>
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
