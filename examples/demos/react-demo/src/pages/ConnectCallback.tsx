import { type JSX, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * ConnectCallback renders the result of the provider "connect" (account
 * linking) flow.
 *
 * The connect flow does NOT return an authorization code — Auth redirects back
 * here directly after linking. Success looks like `?state=<provider>`; failure
 * adds `?error=<code>&errorDescription=<text>`. There is nothing to exchange,
 * so (unlike `/verify`) we only read the query params and report the outcome.
 */
export default function ConnectCallback(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();

  const params = new URLSearchParams(location.search);
  const error = params.get('error');
  const errorDescription = params.get('errorDescription');
  // We pass the provider id as `state` when starting the link.
  const provider = params.get('state');

  const [status] = useState<'success' | 'error'>(error ? 'error' : 'success');

  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => navigate('/profile'), 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [status, navigate]);

  const providerLabel = provider === 'github' ? 'GitHub' : provider || 'provider';

  return (
    <div>
      <h1>Account Linking</h1>

      <div className="page-center">
        {status === 'success' ? (
          <div>
            <p className="verification-status">✓ {providerLabel} linked!</p>
            <p>Your account is now connected. Redirecting to your profile...</p>
          </div>
        ) : (
          <div>
            <p className="verification-status error">Linking failed</p>
            <p className="margin-bottom">
              {errorDescription || error || 'Unknown error'}
            </p>
            <p className="margin-bottom text-sm" style={{ color: 'var(--text-muted)' }}>
              If the server requires elevated permissions, you must elevate your
              session (e.g. with a security key) before linking a provider.
            </p>

            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="btn btn-secondary"
            >
              Back to Profile
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
