import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../lib/nhost/AuthProvider';

export default function SignIn() {
  const { nhost, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/protected');
    }
  }, [isAuthenticated, navigate]);

  const sendCode = async () => {
    setLoading(true);
    setError(null);
    try {
      await nhost.auth.signInOTPEmail({ email });
      setSent(true);
    } catch (err) {
      setError(`Could not send the code: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await nhost.auth.verifySignInOTPEmail({ email, otp });
      if (response.body?.session) {
        navigate('/protected');
      } else {
        setError('Invalid or expired code. Please try again.');
      }
    } catch (err) {
      setError(`Could not verify the code: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (sent) {
      void verify();
    } else {
      void sendCode();
    }
  };

  return (
    <div className="stack">
      <h1>Sign in</h1>
      <p className="muted">
        Enter your email and we'll send a one-time code. While running locally,
        the email with the code is captured by the local mail viewer.
      </p>

      <form className="card stack" onSubmit={onSubmit}>
        {sent ? (
          <label className="field">
            <span>Code sent to {email}</span>
            <input
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              inputMode="numeric"
              placeholder="123456"
              autoComplete="one-time-code"
            />
          </label>
        ) : (
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>
        )}

        <button
          className="button"
          type="submit"
          disabled={loading || (sent ? !otp : !email)}
        >
          {loading ? 'Working…' : sent ? 'Verify' : 'Send code'}
        </button>

        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
