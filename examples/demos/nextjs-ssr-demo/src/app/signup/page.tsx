import Link from "next/link";
import MagicLinkForm from "../components/MagicLinkForm";
import SocialSignIn from "../components/SocialSignIn";
import TabForm from "../components/TabForm";
import WebAuthnSignUpForm from "../components/WebAuthnSignUpForm";
import { sendMagicLink } from "./actions";
import SignUpForm from "./SignUpForm";

export default async function SignUp({
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
        <h2 className="text-2xl mb-6">Sign Up</h2>

        {magicLinkSent ? (
          <div className="text-center">
            <p className="mb-4">
              Magic link sent! Check your email to sign in.
            </p>
            <Link href="/signup" className="btn btn-secondary">
              Back to sign up
            </Link>
          </div>
        ) : (
          <TabForm
            passwordTabContent={<SignUpForm initialError={error} />}
            magicTabContent={
              <div>
                <MagicLinkForm
                  sendMagicLinkAction={sendMagicLink}
                  showDisplayName
                  buttonLabel="Sign up with Magic Link"
                />
              </div>
            }
            socialTabContent={
              <div className="text-center">
                <p className="mb-6">Sign up using your Social account</p>
                <SocialSignIn provider="github" />
              </div>
            }
            webauthnTabContent={
              <WebAuthnSignUpForm buttonLabel="Sign up with Security Key" />
            }
          />
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
