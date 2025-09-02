import type { ErrorResponse } from "@nhost/nhost-js/auth";
import type { FetchError } from "@nhost/nhost-js/fetch";
import React, { type JSX, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../lib/nhost/AuthProvider";

interface VerificationResponse {
  success?: boolean;
  error?: string;
}

export default function MfaVerification(): JSX.Element {
  // Extract ticket from URL search params
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const ticket = searchParams.get("ticket");
  const initialError = searchParams.get("error");

  const { isAuthenticated, nhost } = useAuth();
  const [otp, setOtp] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(initialError);

  // Use effect to handle redirects
  useEffect(() => {
    // If user is already authenticated, redirect to profile
    if (isAuthenticated) {
      navigate("/profile", { replace: true });
    }

    // If no ticket is provided, redirect to sign in
    if (!ticket && !isLoading) {
      navigate("/signin", { replace: true });
    }
  }, [isAuthenticated, ticket, navigate, isLoading]);

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await verifyMfa(ticket as string, otp);

      if (result.error) {
        setError(result.error);
      } else if (result.success) {
        navigate("/profile", { replace: true });
      }
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      setError(`An error occurred during verification: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to verify MFA code
  const verifyMfa = async (
    ticket: string,
    otp: string,
  ): Promise<VerificationResponse> => {
    try {
      // We already imported nhost client at the top of the file

      // Verify MFA code
      const response = await nhost.auth.verifySignInMfaTotp({
        ticket,
        otp,
      });

      // Check for successful verification
      if (response.body?.session) {
        return { success: true };
      }

      return { error: "Failed to verify MFA code. Please try again." };
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      return { error: `Failed to verify code: ${error.message}` };
    }
  };

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

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="otp">Verification Code</label>
              <input
                id="otp"
                name="otp"
                type="text"
                placeholder="Enter 6-digit code"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
              />
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="flex space-x-3">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
              >
                {isLoading ? "Verifying..." : "Verify"}
              </button>

              <Link to="/signin" className="btn btn-secondary">
                Back
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
