import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/nhost/AuthProvider';

export default function Verify() {
  const location = useLocation();
  const navigate = useNavigate();

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>(
    'verifying',
  );
  const [error, setError] = useState<string | null>(null);
  const [urlParams, setUrlParams] = useState<Record<string, string>>({});

  const { nhost } = useAuth();

  useEffect(() => {
    // Extract the refresh token from the URL
    const params = new URLSearchParams(location.search);
    const refreshToken = params.get('refreshToken');

    if (!refreshToken) {
      // Collect all URL parameters to display for debugging
      const allParams: Record<string, string> = {};
      params.forEach((value, key) => {
        allParams[key] = value;
      });
      setUrlParams(allParams);

      setStatus('error');
      setError('No refresh token found in URL');
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

          setStatus('error');
          setError('No refresh token found in URL');
          return;
        }

        // Process the token
        await nhost.auth.refreshToken({ refreshToken });

        if (!isMounted) return;

        setStatus('success');

        // Wait to show success message briefly, then redirect
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

    processToken();

    // Cleanup function
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
