import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import { type JSX, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/nhost/AuthProvider';

interface AuthRequestInfo {
  requestId: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

function clientDisplayName(info: AuthRequestInfo): string {
  try {
    return new URL(info.redirectUri).hostname;
  } catch {
    return info.clientId;
  }
}

export default function Consent(): JSX.Element {
  const { nhost, isAuthenticated, user } = useAuth();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const requestId = params.get('request_id');

  const [authRequest, setAuthRequest] = useState<AuthRequestInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestId) {
      setError(
        'Missing request_id parameter. This page should be accessed via an OAuth2 authorization flow.',
      );
      setIsFetching(false);
      return;
    }

    const fetchAuthRequest = async () => {
      try {
        const response = await nhost.auth.oauth2LoginGet({
          request_id: requestId,
        });
        setAuthRequest(response.body);
      } catch (err) {
        const fetchErr = err as FetchError<ErrorResponse>;
        setError(fetchErr.message || 'Failed to load authorization request.');
      } finally {
        setIsFetching(false);
      }
    };

    fetchAuthRequest();
  }, [nhost, requestId]);

  const signInUrl = `/signin?redirect=${encodeURIComponent(`/oauth2/consent?request_id=${requestId}`)}`;

  const handleAuthorize = async () => {
    if (!authRequest) return;
    setIsLoading(true);
    setError(null);

    try {
      const consentResponse = await nhost.auth.oauth2LoginPost({
        requestId: authRequest.requestId,
      });

      window.location.href = consentResponse.body.redirectUri;
    } catch (err) {
      const fetchErr = err as FetchError<ErrorResponse>;
      setError(fetchErr.message || 'Authorization failed.');
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="glass-card w-full p-8">
          <p className="text-center text-muted">
            Loading authorization request...
          </p>
        </div>
      </div>
    );
  }

  if (!authRequest) {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="glass-card w-full p-8">
          <h2 className="text-2xl mb-6">Error</h2>
          {error && <div className="alert alert-error">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <h1 className="text-3xl mb-6 gradient-text">Authorize Application</h1>

      <div className="glass-card w-full p-8 mb-6">
        <h2 className="text-2xl mb-4">
          {isAuthenticated ? 'Authorize' : 'Sign in to continue'}
        </h2>
        <p className="text-muted mb-6">
          <strong>{clientDisplayName(authRequest)}</strong> is requesting access
          to your account.
        </p>

        <div className="client-info mb-6">
          <div className="mb-3">
            <span className="text-sm text-muted">Application</span>
            <p className="font-medium">{clientDisplayName(authRequest)}</p>
          </div>
          <div className="mb-3">
            <span className="text-sm text-muted">Redirect</span>
            <p className="text-sm" style={{ wordBreak: 'break-all' }}>
              {authRequest.redirectUri}
            </p>
          </div>
          <div>
            <span className="text-sm text-muted">Scopes</span>
            <div className="scope-tags">
              {authRequest.scopes.map((scope) => (
                <span key={scope} className="scope-tag">
                  {scope}
                </span>
              ))}
            </div>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {isAuthenticated ? (
          <>
            {user && (
              <p className="text-sm text-muted mb-4">
                Signed in as <strong>{user.email}</strong>
              </p>
            )}

            <button
              type="button"
              className="btn btn-primary w-full"
              disabled={isLoading}
              onClick={handleAuthorize}
            >
              {isLoading ? 'Authorizing...' : 'Authorize'}
            </button>
          </>
        ) : (
          <Link to={signInUrl} className="btn btn-primary w-full text-center">
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}
