import type { ErrorResponse } from "@nhost/nhost-js/auth";
import type { FetchError } from "@nhost/nhost-js/fetch";
import { useState, useEffect, useId } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/nhost/AuthProvider";

export default function SignIn() {
  const { nhost, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") || null
  );
  const emailId = useId();
  const passwordId = useId();

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

      // If we have a session, sign in was successful
      if (response.body?.session) {
        navigate("/profile");
      } else {
        setError("Failed to sign in. Please check your credentials.");
      }
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      setError(`An error occurred during sign in: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h1>Sign In</h1>

      {isVerifying && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#fff3cd',
          color: '#856404',
          borderRadius: '8px',
          marginBottom: '1rem'
        }}>
          <p>Please sign in to complete the verification process.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ maxWidth: '400px' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor={emailId}>Email</label>
          <input
            id={emailId}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor={passwordId}>Password</label>
          <input
            id={passwordId}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
          />
        </div>

        {error && (
          <div style={{
            color: 'red',
            marginBottom: '1rem',
            padding: '0.5rem',
            backgroundColor: '#fee',
            borderRadius: '4px'
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer'
          }}
        >
          {isLoading ? "Signing In..." : "Sign In"}
        </button>
      </form>

      <div style={{ marginTop: '1rem' }}>
        <p>
          Don't have an account? <Link to="/signup">Sign Up</Link>
        </p>
      </div>
    </div>
  );
}
