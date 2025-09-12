import Link from "next/link";
import SignUpForm from "./SignUpForm";

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
  const verificationSent = params?.verify === "success";
  const email = params?.email;

  return (
    <div className="flex flex-col items-center justify-center">
      <h1 className="text-3xl mb-6 gradient-text">Nhost Next.js Demo</h1>

      <div className="glass-card w-full p-8 mb-6">
        {verificationSent ? (
          <>
            <h2 className="text-2xl mb-6">Check Your Email</h2>

            <div className="text-center py-4">
              <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-md">
                <p className="mb-2">
                  We've sent a verification link to <strong>{email}</strong>
                </p>
                <p>
                  Please check your email and click the verification link to
                  activate your account.
                </p>
              </div>

              <Link href="/signin" className="btn btn-primary">
                Back to Sign In
              </Link>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-2xl mb-6">Sign Up</h2>
            <SignUpForm initialError={error} />
          </>
        )}
      </div>

      <div className="mt-4">
        <p>
          Already have an account? <Link href="/signin">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
