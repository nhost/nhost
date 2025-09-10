import type { ErrorResponse } from "@nhost/nhost-js/auth";
import type { FetchError } from "@nhost/nhost-js/fetch";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/nhost/AuthProvider";

export default function Verify() {
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
      // Collect all URL parameters to display for debugging
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
    <div>
      <h1>Email Verification</h1>

      <div style={{ textAlign: 'center', padding: '2rem' }}>
        {status === "verifying" && (
          <div>
            <p style={{ marginBottom: '1rem' }}>Verifying your email...</p>
            <div style={{
              width: '32px',
              height: '32px',
              border: '3px solid #f3f3f3',
              borderTop: '3px solid #007bff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto'
            }} />
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}

        {status === "success" && (
          <div>
            <p style={{
              marginBottom: '1rem',
              color: '#28a745',
              fontSize: '1.2rem',
              fontWeight: 'bold'
            }}>
              ✓ Successfully verified!
            </p>
            <p>You'll be redirected to your profile page shortly...</p>
          </div>
        )}

        {status === "error" && (
          <div>
            <p style={{
              marginBottom: '1rem',
              color: '#dc3545',
              fontSize: '1.1rem',
              fontWeight: 'bold'
            }}>
              Verification failed
            </p>
            <p style={{ marginBottom: '1rem' }}>{error}</p>

            {Object.keys(urlParams).length > 0 && (
              <div style={{
                marginBottom: '1rem',
                padding: '1rem',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                textAlign: 'left',
                maxHeight: '200px',
                overflow: 'auto'
              }}>
                <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  URL Parameters:
                </p>
                {Object.entries(urlParams).map(([key, value]) => (
                  <div key={key} style={{ marginBottom: '0.25rem' }}>
                    <span style={{ fontFamily: 'monospace', color: '#007bff' }}>
                      {key}:
                    </span>{" "}
                    <span style={{ fontFamily: 'monospace' }}>{value}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => navigate("/signin")}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
