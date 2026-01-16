import Link from 'next/link';
import SignUpForm from './SignUpForm';

export default async function SignUp({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    verify?: string;
    email?: string;
  }>;
}) {
  // Extract parameters from URL
  const params = await searchParams;
  const error = params?.error;
  const verificationSent = params?.verify === 'success';
  const email = params?.email;

  if (verificationSent) {
    return (
      <div>
        <h1>Check Your Email</h1>
        <div className="success-message">
          <p>
            We've sent a verification link to <strong>{email}</strong>
          </p>
          <p>
            Please check your email and click the verification link to activate
            your account.
          </p>
        </div>
        <p>
          <Link href="/signin">Back to Sign In</Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1>Sign Up</h1>
      <SignUpForm initialError={error} />

      <div className="auth-links">
        <p>
          Already have an account? <Link href="/signin">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
