import Link from 'next/link';
import { ResetPasswordForm } from '@/app/reset-password/ResetPasswordForm';
import { Card, CardContent } from '@/components/ui/card';
import { readRecoveryToken } from '@/lib/nhost/server';

export const dynamic = 'force-dynamic';

// The reset link comes back with a one-time code, which the proxy exchanges
// against the verifier this browser kept and sets aside as the recovery
// cookie. No session is created: whoever was signed in here stays signed in,
// and the new password goes to the account the link named.
export default async function ResetPassword() {
  if (!(await readRecoveryToken())) {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">
            This link cannot be used
          </h1>
          <p className="text-muted-foreground">
            A reset link works once, and only in the browser that asked for it.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Link className="underline" href="/signin">
              Ask for a new reset link
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Set a new password
        </h1>
        <p className="text-muted-foreground">
          Pick the new password now. You will be signed in with it.
        </p>
      </div>

      <ResetPasswordForm />
    </div>
  );
}
