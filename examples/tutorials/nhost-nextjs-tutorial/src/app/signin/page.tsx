import Link from "next/link";
import SignInForm from "./SignInForm";

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Extract error from URL parameters
  const params = await searchParams;
  const error = params?.error;

  return (
    <div className="flex flex-col items-center justify-center">
      <h1 className="text-3xl mb-6 gradient-text">Nhost Next.js Demo</h1>

      <div className="glass-card w-full p-8 mb-6">
        <h2 className="text-2xl mb-6">Sign In</h2>
        <SignInForm initialError={error} />
      </div>

      <div className="mt-4">
        <p>
          Don't have an account? <Link href="/signup">Sign Up</Link>
        </p>
      </div>
    </div>
  );
}
