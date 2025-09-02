import Link from "next/link";
import MagicLinkForm from "../components/MagicLinkForm";
import SocialSignIn from "../components/SocialSignIn";
import TabForm from "../components/TabForm";
import WebAuthnSignInForm from "../components/WebAuthnSignInForm";
import { sendMagicLink } from "./actions";
import SignInForm from "./SignInForm";

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; magic?: string }>;
}) {
  // Extract error and magic link status from URL
  const params = await searchParams;
  const error = params?.error;
  const magicLinkSent = params?.magic === "success";

  return (
    <div className="flex flex-col items-center justify-center">
      <h1 className="text-3xl mb-6 gradient-text">Nhost SDK Demo</h1>

      <div className="glass-card w-full p-8 mb-6">
        <h2 className="text-2xl mb-6">Sign In</h2>

        {magicLinkSent ? (
          <div className="text-center">
            <p className="mb-4">
              Magic link sent! Check your email to sign in.
            </p>
            <Link href="/signin" className="btn btn-secondary">
              Back to sign in
            </Link>
          </div>
        ) : (
          <TabForm
            passwordTabContent={<SignInForm initialError={error} />}
            magicTabContent={
              <div>
                <MagicLinkForm
                  sendMagicLinkAction={sendMagicLink}
                  buttonLabel="Sign in with Magic Link"
                />
              </div>
            }
            socialTabContent={
              <div className="text-center">
                <p className="mb-6">Sign in using your Social account</p>
                <SocialSignIn provider="github" />
              </div>
            }
            webauthnTabContent={
              <WebAuthnSignInForm buttonLabel="Sign in with Security Key" />
            }
          />
        )}
      </div>

      <div className="mt-4">
        <p>
          Don&apos;t have an account? <Link href="/signup">Sign Up</Link>
        </p>
      </div>
    </div>
  );
}
