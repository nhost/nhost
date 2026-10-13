import Link from 'next/link';
import { redirect } from 'next/navigation';
import MfaForm from '@/app/auth/password/mfa/MfaForm';
import { signInHref } from '@/app/signin/destination';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getVerifiedUser } from '@/lib/nhost/server';

export const dynamic = 'force-dynamic';

// Guards itself rather than being listed in the proxy's protected routes: that
// list is shared code, and shared code never names a method.
export default async function Mfa() {
  const user = await getVerifiedUser();

  if (!user) {
    redirect(signInHref('/auth/password/mfa'));
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Two-factor authentication</CardTitle>
          <CardDescription>
            A code from an authenticator app, asked for when signing in with a
            password. Other sign-in methods are not challenged.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <MfaForm active={user.activeMfaType === 'totp'} />
          <Button
            asChild
            variant="link"
            size="sm"
            className="h-auto self-start p-0"
          >
            <Link href="/account">Back to your account</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
