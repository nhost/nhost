import Link from 'next/link';
import { redirect } from 'next/navigation';
import ChangeEmailForm from '@/app/account/email/ChangeEmailForm';
import { signInHref } from '@/app/signin/destination';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { localMailboxURL } from '@/lib/nhost/env';
import { getVerifiedUser } from '@/lib/nhost/server';

export const dynamic = 'force-dynamic';

export default async function Email() {
  // Under /account, so the proxy already turns a signed-out visitor away.
  // This asks the auth service, which is what the page then shows.
  const user = await getVerifiedUser();

  if (!user) {
    redirect(signInHref('/account/email'));
  }

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
          <CardDescription>
            {user.email ?? 'No address on this account.'} A new address is not
            applied here: the auth service sends a confirmation link to it, and
            the account moves when that link is opened.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ChangeEmailForm
            email={user.email}
            verified={user.emailVerified}
            mailboxURL={localMailboxURL()}
          />
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
