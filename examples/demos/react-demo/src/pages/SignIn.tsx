import { useState, useEffect, type JSX } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import TabForm from "../components/TabForm";
import MagicLinkForm from "../components/MagicLinkForm";
import WebAuthnSignInForm from "../components/WebAuthnSignInForm";
import { useAuth } from "../lib/nhost/AuthProvider";
import { type ErrorResponse } from "@nhost/nhost-js/auth";
import { type FetchError } from "@nhost/nhost-js/fetch";

export default function SignIn(): JSX.Element {
  const { nhost, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") || null,
  );

  const magicLinkSent = params.get("magic") === "success";
  const isVerifying = params.has("fromVerify");

  // Use useEffect for navigation after authentication is confirmed
  useEffect(() => {
    if (isAuthenticated && !isVerifying) {
      navigate("/profile");
    }
  }, [isAuthenticated, isVerifying, navigate]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Use the signIn function from auth context
      const response = await nhost.auth.signInEmailPassword({
        email,
        password,
      });

      // Check if MFA is required
      if (response.body?.mfa) {
        navigate(`/signin/mfa?ticket=${response.body.mfa.ticket}`);
        return;
      }

      // If we have a session, sign in was successful
      if (response.body?.session) {
        navigate("/profile");
      } else {
        setError("Failed to sign in");
      }
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      setError(`An error occurred during sign in: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialSignIn = (provider: "github") => {
    // Get the current origin (to build the redirect URL)
    const origin = window.location.origin;
    const redirectUrl = `${origin}/verify`;

    // Sign in with the specified provider
    const url = nhost.auth.signInProviderURL(provider, {
      redirectTo: redirectUrl,
    });

    window.location.href = url;
  };

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
            <Link to="/signin" className="btn btn-secondary">
              Back to sign in
            </Link>
          </div>
        ) : (
          <TabForm
            passwordTabContent={
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                {error && <div className="alert alert-error">{error}</div>}

                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  disabled={isLoading}
                >
                  {isLoading ? "Signing In..." : "Sign In"}
                </button>
              </form>
            }
            magicTabContent={
              <div>
                <MagicLinkForm buttonLabel="Sign in with Magic Link" />
              </div>
            }
            socialTabContent={
              <div className="text-center">
                <p className="mb-6">Sign in using your Social account</p>
                <button
                  type="button"
                  onClick={() => handleSocialSignIn("github")}
                  className="btn btn-secondary w-full flex items-center justify-center gap-2"
                  disabled={isLoading}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  Continue with GitHub
                </button>
              </div>
            }
            webauthnTabContent={<WebAuthnSignInForm />}
          />
        )}
      </div>

      <div className="mt-4">
        <p>
          Don&apos;t have an account? <Link to="/signup">Sign Up</Link>
        </p>
      </div>
    </div>
  );
}
