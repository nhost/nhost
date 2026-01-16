import { redirect } from 'next/navigation';
import { createNhostClient } from '../../lib/nhost/server';
import MfaVerificationForm from './MfaVerificationForm';

export default async function MfaVerification({
  searchParams,
}: {
  searchParams: Promise<{ ticket?: string; error?: string }>;
}) {
  // Extract ticket and error from URL
  const params = await searchParams;
  const ticket = params.ticket;
  const error = params.error;

  // Check if user is already authenticated
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();

  // If user is already authenticated, redirect to profile
  if (session) {
    redirect('/profile');
  }

  // If no ticket is provided, redirect to sign in
  if (!ticket) {
    redirect('/signin');
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <h1 className="text-3xl mb-6 gradient-text">Nhost SDK Demo</h1>

      <div className="glass-card w-full p-8 mb-6">
        <h2 className="text-2xl mb-6">Verification Required</h2>

        <div>
          <p className="mb-4">
            A verification code is required to complete sign in. Please enter
            the code from your authenticator app.
          </p>

          <MfaVerificationForm ticket={ticket} initialError={error} />
        </div>
      </div>
    </div>
  );
}
