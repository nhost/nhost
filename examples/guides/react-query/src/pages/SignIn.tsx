import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import { type JSX, useEffect, useId, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/nhost/AuthProvider';

export default function SignIn(): JSX.Element {
  const { nhost, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const emailId = useId();
  const passwordId = useId();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get('error') || null,
  );

  const isVerifying = params.has('fromVerify');

  // Use useEffect for navigation after authentication is confirmed
  useEffect(() => {
    if (isAuthenticated && !isVerifying) {
      navigate('/home');
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
        navigate('/home');
      } else {
        setError('Failed to sign in');
      }
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      setError(`An error occurred during sign in: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <h1 className="text-3xl mb-6 gradient-text">Nhost SDK Demo</h1>

      <div className="glass-card w-full p-8 mb-6">
        <h2 className="text-2xl mb-6">Sign In</h2>
        <div>
          <div className="tabs-container">
            <button type="button" className="tab-button tab-active">
              Email + Password
            </button>
          </div>
          <div className="tab-content">
            <form onSubmit={handleSubmit} className="space-y-5">
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
              </div>

              {error && <div className="alert alert-error">{error}</div>}

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p>
          Don&apos;t have an account? <Link to="/signup">Sign Up</Link>
        </p>
      </div>
    </div>
  );
}
