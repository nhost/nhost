import type { ErrorResponse } from "@nhost/nhost-js/auth";
import type { FetchError } from "@nhost/nhost-js/fetch";
import { type JSX, useId, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/nhost/AuthProvider";

export default function SignUp(): JSX.Element {
  const { nhost, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const displayNameId = useId();
  const emailId = useId();
  const passwordId = useId();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated, redirect to profile
  if (isAuthenticated) {
    return <Navigate to="/home" />;
  }

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await nhost.auth.signUpEmailPassword({
        email,
        password,
        options: {
          displayName,
        },
      });

      if (response.body) {
        // Successfully signed up and automatically signed in
        navigate("/home");
      } else {
        // Verification email sent
        navigate("/verify");
      }
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      setError(`An error occurred during sign up: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <h1 className="text-3xl mb-6 gradient-text">Nhost SDK Demo</h1>

      <div className="glass-card w-full p-8 mb-6">
        <h2 className="text-2xl mb-6">Sign Up</h2>

        <div>
          <div className="tabs-container">
            <button type="button" className="tab-button tab-active">
              Email + Password
            </button>
          </div>
          <div className="tab-content">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor={displayNameId}>Display Name</label>
                <input
                  id={displayNameId}
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor={emailId}>Email</label>
                <input
                  id={emailId}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label htmlFor={passwordId}>Password</label>
                <input
                  id={passwordId}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <p className="text-xs mt-1 text-gray-400">
                  Password must be at least 8 characters long
                </p>
              </div>

              {error && <div className="alert alert-error">{error}</div>}

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={isLoading}
              >
                {isLoading ? "Signing Up..." : "Sign Up"}
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p>
          Already have an account? <Link to="/signin">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
