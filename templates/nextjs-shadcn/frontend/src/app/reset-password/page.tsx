import { redirect } from 'next/navigation';
import { ResetPasswordForm } from '@/app/reset-password/ResetPasswordForm';
import { createNhostClient } from '@/lib/nhost/server';

export const dynamic = 'force-dynamic';

// The reset email's verification link signs the user in and redirects here,
// so by the time this page renders there is a session to change the password
// under. Without one, the link was invalid or expired.
export default async function ResetPassword() {
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();

  if (!session) {
    redirect('/signin');
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">
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
