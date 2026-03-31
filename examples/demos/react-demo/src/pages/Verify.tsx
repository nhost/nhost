import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/nhost/AuthProvider';
import { consumePKCEVerifier } from '../lib/utils';

export default function Verify() {
  const location = useLocation();
  const navigate = useNavigate();

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>(
    'verifying',
  );
  const [error, setError] = useState<string>('');
  const [urlParams, setUrlParams] = useState<Record<string, string>>({});

  const { nhost } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');

    if (!code) {
      const allParams: Record<string, string> = {};
      params.forEach((value, key) => {
        allParams[key] = value;
      });
      setUrlParams(allParams);

      setStatus('error');
      setError('No authorization code found in URL');
      return;
    }

    const authCode = code;
    let isMounted = true;

    async function exchangeCode(): Promise<void> {
      try {
        // Small delay to ensure component is fully mounted
        await new Promise((resolve) => setTimeout(resolve, 500));

        if (!isMounted) return;

        const codeVerifier = consumePKCEVerifier();
        if (!codeVerifier) {
          setStatus('error');
          setError(
            'No PKCE verifier found. The sign-in must be initiated from the same browser tab.',
          );
          return;
        }

        await nhost.auth.tokenExchange({ code: authCode, codeVerifier });

        if (!isMounted) return;

        setStatus('success');

        setTimeout(() => {
          if (isMounted) navigate('/profile');
        }, 1500);
      } catch (err) {
        const message = (err as Error).message || 'Unknown error';
        if (!isMounted) return;

        setStatus('error');
        setError(`An error occurred during verification: ${message}`);
      }
    }

    exchangeCode();

    return () => {
      isMounted = false;
    };
  }, [location.search, navigate, nhost.auth]);

  return (
    <div>
      <h1>Email Verification</h1>

      <div className="page-center">
        {status === 'verifying' && (
          <div>
            <p className="margin-bottom">Verifying your email...</p>
            <div className="spinner-verify" />
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}

        {status === 'success' && (
          <div>
            <p className="verification-status">✓ Successfully verified!</p>
            <p>You'll be redirected to your profile page shortly...</p>
          </div>
        )}

        {status === 'error' && (
          <div>
            <p className="verification-status error">Verification failed</p>
            <p className="margin-bottom">{error}</p>

            {Object.keys(urlParams).length > 0 && (
              <div className="debug-panel">
                <p className="debug-title">URL Parameters:</p>
                {Object.entries(urlParams).map(([key, value]) => (
                  <div key={key} className="debug-item">
                    <span className="debug-key">{key}:</span>{' '}
                    <span className="debug-value">{value}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => navigate('/signin')}
              className="auth-button secondary"
            >
              Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
