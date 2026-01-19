import { useEffect, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/nhost/AuthProvider';

export default function SignIn() {
  const { nhost, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailId = useId();
  const passwordId = useId();

  // Use useEffect for navigation after authentication is confirmed
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/profile');
    }
  }, [isAuthenticated, navigate]);

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
        navigate('/profile');
      } else {
        setError('Failed to sign in. Please check your credentials.');
      }
    } catch (err) {
      const message = (err as Error).message || 'Unknown error';
      setError(`An error occurred during sign in: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h1>Sign In</h1>

      <form onSubmit={handleSubmit} className="auth-form">
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
            className="auth-input"
          />
        </div>

        {error && <div className="auth-error">{error}</div>}

        <button
          type="submit"
          disabled={isLoading}
          className={`auth-button secondary`}
        >
          {isLoading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>

      <div className="auth-links">
        <p>
          Don't have an account? <Link to="/signup">Sign Up</Link>
        </p>
      </div>
    </div>
  );
}
