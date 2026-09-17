import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ResetPasswordForm } from '@/app/reset-password/ResetPasswordForm';
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

  if (grantUserId !== session.user.id) {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-bold text-3xl tracking-tight">
            This reset link has expired
          </h1>
          <p className="text-muted-foreground">
            Reset links can only set a password for a short while after they are
            opened. Ask for a new one and follow it straight away.
          </p>
        </div>

        <div>
          <Button asChild>
            <Link href="/signin">Request a new link</Link>
          </Button>
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
