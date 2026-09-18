import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ResetPasswordForm } from '@/app/reset-password/ResetPasswordForm';
import SignOutButton from '@/components/SignOutButton';
import { Button } from '@/components/ui/button';
import {
  createNhostClient,
  passwordResetGrantUserId,
} from '@/lib/nhost/server';

export const dynamic = 'force-dynamic';

// The reset email's verification link signs the user in and redirects here,
// so by the time this page renders there is a session to change the password
// under. Without one, the link was invalid or expired.
export default async function ResetPassword() {
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();

  if (!session?.user) {
    redirect('/signin');
  }

  // The form below sets a password without asking for the current one, and the
  // grant is the only thing that permits that. It expires long before the
  // session does, so a session alone is not enough to render a form that would
  // work: coming back to this page an hour later, or pressing Back after a
  // successful reset, leaves a signed-in visitor whose grant is gone. Reading
  // the cookie here rather than letting `changePassword` refuse is what turns
  // "Enter your current password" - on a page with no field to enter it in -
  // into something the visitor can act on.
  const grantUserId = await passwordResetGrantUserId();

  // Two different things land here and they cannot be told apart from this
  // request. The grant may have expired or been spent - but the proxy also
  // refuses to redeem a link for an account other than the one already signed
  // in, and a refusal issues no grant at all, so arriving as the wrong person
  // looks identical to arriving too late.
  //
  // Naming only the expiry sent the second case round a loop: asking for
  // another link produces one that is refused in exactly the same way, burning
  // a fresh token each time, while the way out - signing out first - is not
  // mentioned and lives behind the user menu. So the copy names both causes and
  // the branch carries the escape.
  if (grantUserId !== session.user.id) {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-bold text-3xl tracking-tight">
            This link cannot set a password
          </h1>
          <p className="text-muted-foreground">
            It may have been used already, or opened too long ago - reset links
            only set a password for a short while. It also happens when you are
            signed in as a different account from the one the link was for,
            because the link is refused rather than switching you over. Sign out
            and open the link again, or ask for a new one.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button asChild>
            <Link href="/signin">Request a new link</Link>
          </Button>
          <SignOutButton />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-bold text-3xl tracking-tight">
          Set a new password
        </h1>
        <p className="text-muted-foreground">
          The reset link signed you in. Pick the new password now.
        </p>
      </div>

      <ResetPasswordForm />
    </div>
  );
}
