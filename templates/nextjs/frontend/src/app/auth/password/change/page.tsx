import Link from 'next/link';
import { redirect } from 'next/navigation';
import ChangePasswordForm from '@/app/auth/password/change/ChangePasswordForm';
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
export default async function ChangePassword() {
  const user = await getVerifiedUser();

  if (!user) {
    redirect(signInHref('/auth/password/change'));
  }

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Sets a new password. The current one is not asked for: being signed
            in is what authorises the change. An account created by magic link
            or a provider can set one here and sign in with it afterwards.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ChangePasswordForm />
          <Button
            asChild
            variant="link"
            size="sm"
            className="h-auto self-center p-0"
          >
            <Link href="/account">Back to your account</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
