import type { ErrorResponse } from "@nhost/nhost-js/auth";
import type { FetchError } from "@nhost/nhost-js/fetch";
import { useState, useEffect, useId } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/nhost/AuthProvider";

export default function SignUp() {
  const { nhost, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const displayNameId = useId();
  const emailId = useId();
  const passwordId = useId();

  // Redirect authenticated users to profile
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/profile");
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await nhost.auth.signUpEmailPassword({
        email,
        password,
        options: {
          displayName,
          // Set the redirect URL for email verification
          redirectTo: `${window.location.origin}/verify`,
        },
      });

      if (response.body?.session) {
        // Successfully signed up and automatically signed in
        navigate("/profile");
      } else {
        // Verification email sent or user created but needs verification
        setSuccess(true);
      }
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      setError(`An error occurred during sign up: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div>
        <h1>Check Your Email</h1>
        <div style={{
          padding: '1rem',
          backgroundColor: '#d4edda',
          color: '#155724',
          borderRadius: '8px',
          marginBottom: '1rem'
        }}>
          <p>
            We've sent a verification link to <strong>{email}</strong>
          </p>
          <p>
            Please check your email and click the verification link to activate your account.
          </p>
        </div>
        <p>
          <Link to="/signin">Back to Sign In</Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1>Sign Up</h1>

      <form onSubmit={handleSubmit} style={{ maxWidth: '400px' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor={displayNameId}>Display Name</label>
          <input
            id={displayNameId}
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor={emailId}>Email *</label>
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
          <label htmlFor={passwordId}>Password *</label>
          <input
            id={passwordId}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
          />
          <small style={{ color: '#666' }}>Minimum 8 characters</small>
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
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer'
          }}
        >
          {isLoading ? "Creating Account..." : "Sign Up"}
        </button>
      </form>

      <div style={{ marginTop: '1rem' }}>
        <p>
          Already have an account? <Link to="/signin">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
