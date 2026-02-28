import Link from 'next/link';
import SignInForm from './SignInForm';

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Extract error from URL parameters
  const params = await searchParams;
  const error = params?.error;

  return (
    <div>
      <h1>Sign In</h1>
      <SignInForm initialError={error} />

      <div className="auth-links">
        <p>
          Don't have an account? <Link href="/signup">Sign Up</Link>
        </p>
      </div>
    </div>
  );
}
