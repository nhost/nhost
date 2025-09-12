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
        // Verification email sent
        setSuccess(true);
      }
    } catch (err) {
      const message = (err as Error).message || "Unknown error";
      setError(`An error occurred during sign up: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div>
        <h1>Check Your Email</h1>
        <div className="success-message">
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

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-form-field">
          <label htmlFor={displayNameId}>Display Name</label>
          <input
            id={displayNameId}
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
className="auth-input"
          />
        </div>

        <div className="auth-form-field">
          <label htmlFor={emailId}>Email</label>
          <input
            id={emailId}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
className="auth-input"
          />
        </div>

        <div className="auth-form-field">
          <label htmlFor={passwordId}>Password</label>
          <input
            id={passwordId}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
className="auth-input"
          />
          <small className="help-text">Minimum 8 characters</small>
        </div>

        {error && (
          <div className="auth-error">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className={`auth-button primary`}
        >
          {isLoading ? "Creating Account..." : "Sign Up"}
        </button>
      </form>

      <div className="auth-links">
        <p>
          Already have an account? <Link to="/signin">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
