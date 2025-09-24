import type { ErrorResponse } from "@nhost/nhost-js/auth";
import type { FetchError } from "@nhost/nhost-js/fetch";
import { type JSX, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/nhost/AuthProvider";

export default function Verify(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"verifying" | "success" | "error">(
    "verifying",
  );
  const [error, setError] = useState<string>("");
  const [urlParams, setUrlParams] = useState<Record<string, string>>({});

  const { nhost } = useAuth();

  useEffect(() => {
    // Extract the refresh token from the URL
    const params = new URLSearchParams(location.search);
    const refreshToken = params.get("refreshToken");

    if (!refreshToken) {
      // Collect all URL parameters to display
      const allParams: Record<string, string> = {};
      params.forEach((value, key) => {
        allParams[key] = value;
      });
      setUrlParams(allParams);

      setStatus("error");
      setError("No refresh token found in URL");
      return;
    }

    // Flag to handle component unmounting during async operations
    let isMounted = true;

    async function processToken(): Promise<void> {
      try {
        // First display the verifying message for at least a moment
        await new Promise((resolve) => setTimeout(resolve, 500));

        if (!isMounted) return;

        if (!refreshToken) {
          // Collect all URL parameters to display
          const allParams: Record<string, string> = {};
          params.forEach((value, key) => {
            allParams[key] = value;
          });
          setUrlParams(allParams);

          setStatus("error");
          setError("No refresh token found in URL");
          return;
        }

        // Process the token
        await nhost.auth.refreshToken({ refreshToken });

        if (!isMounted) return;

        setStatus("success");

        // Wait to show success message briefly, then redirect
        setTimeout(() => {
          if (isMounted) navigate("/profile");
        }, 1500);
      } catch (err) {
        const error = err as FetchError<ErrorResponse>;
        if (!isMounted) return;

        setStatus("error");
        setError(`An error occurred during verification: ${error.message}`);
      }
    }

    processToken();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [location.search, navigate, nhost.auth]);

  return (
    <div className="flex flex-col items-center justify-center">
      <h1 className="text-3xl mb-6 gradient-text">Nhost SDK Demo</h1>

      <div className="glass-card w-full p-8 mb-6">
        <h2 className="text-2xl mb-6">Email Verification</h2>

        <div className="text-center py-4">
          {status === "verifying" && (
            <div>
              <p className="mb-4">Verifying your email...</p>
              <div className="w-8 h-8 border-t-2 border-blue-500 rounded-full animate-spin mx-auto" />
            </div>
          )}

          {status === "success" && (
            <div>
              <p className="mb-4 text-green-500 font-bold">
                ✓ Successfully verified!
              </p>
              <p>You&apos;ll be redirected to your profile page shortly...</p>
            </div>
          )}

          {status === "error" && (
            <div>
              <p className="mb-4 text-red-500 font-semibold">
                Verification failed
              </p>
              <p className="mb-4">{error}</p>

              {Object.keys(urlParams).length > 0 && (
                <div className="mb-4 p-4 bg-gray-100 rounded-md text-left overflow-auto max-h-48">
                  <p className="font-semibold mb-2">URL Parameters:</p>
                  {Object.entries(urlParams).map(([key, value]) => (
                    <div key={key} className="mb-1">
                      <span className="font-mono text-blue-600">{key}:</span>{" "}
                      <span className="font-mono">{value}</span>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => navigate("/signin")}
                className="btn btn-primary"
              >
                Back to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
