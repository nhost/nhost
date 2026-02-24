import type { ErrorResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import { type JSX, useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/nhost/AuthProvider';

interface DeviceRequestInfo {
  clientId: string;
  scopes: string[];
}

export default function DeviceVerify(): JSX.Element {
  const { nhost, isAuthenticated, isLoading: authLoading, user } = useAuth();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const prefilled = params.get('user_code') ?? '';

  const [userCode, setUserCode] = useState(prefilled);
  const [deviceRequest, setDeviceRequest] = useState<DeviceRequestInfo | null>(
    null,
  );
  const [isFetching, setIsFetching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<'approved' | 'denied' | null>(
    null,
  );

  const fetchDeviceRequest = useCallback(
    async (code: string) => {
      setIsFetching(true);
      setError(null);
      setDeviceRequest(null);

      try {
        const response = await nhost.auth.oauth2DeviceVerifyGet({
          user_code: code,
        });
        setDeviceRequest(response.body);
      } catch (err) {
        const fetchErr = err as FetchError<ErrorResponse>;
        setError(fetchErr.body?.message || 'Invalid or expired user code.');
      } finally {
        setIsFetching(false);
      }
    },
    [nhost.auth],
  );

  // Auto-fetch when user_code is pre-filled via query param
  useEffect(() => {
    if (prefilled && isAuthenticated) {
      fetchDeviceRequest(prefilled);
    }
  }, [prefilled, isAuthenticated, fetchDeviceRequest]);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userCode.trim()) return;
    fetchDeviceRequest(userCode.trim());
  };

  const handleAction = async (action: 'approve' | 'deny') => {
    setIsSubmitting(true);
    setError(null);

    try {
      await nhost.auth.oauth2DeviceVerifyPost({
        userCode: userCode.trim(),
        action,
      });
      setCompleted(action === 'approve' ? 'approved' : 'denied');
    } catch (err) {
      const fetchErr = err as FetchError<ErrorResponse>;
      setError(fetchErr.body?.message || 'Failed to process device request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="glass-card w-full p-8">
          <p className="text-center text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  const signInUrl = `/signin?redirect=${encodeURIComponent(`/oauth2/device${userCode ? `?user_code=${userCode}` : ''}`)}`;

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center">
        <h1 className="text-3xl mb-6 gradient-text">Device Authorization</h1>
        <div className="glass-card w-full p-8">
          <p className="text-muted mb-6">
            You need to sign in before you can authorize a device.
          </p>
          <Link to={signInUrl} className="btn btn-primary w-full text-center">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="flex flex-col items-center justify-center">
        <h1 className="text-3xl mb-6 gradient-text">Device Authorization</h1>
        <div className="glass-card w-full p-8 text-center">
          {completed === 'approved' ? (
            <>
              <div className="text-4xl mb-4" aria-hidden="true">
                &#x2705;
              </div>
              <h2 className="text-2xl mb-2">Device Authorized</h2>
              <p className="text-muted">
                You can close this page and return to your device.
              </p>
            </>
          ) : (
            <>
              <div className="text-4xl mb-4" aria-hidden="true">
                &#x274C;
              </div>
              <h2 className="text-2xl mb-2">Request Denied</h2>
              <p className="text-muted">
                The device authorization request was denied.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <h1 className="text-3xl mb-6 gradient-text">Device Authorization</h1>

      {!deviceRequest ? (
        <div className="glass-card w-full p-8">
          <h2 className="text-2xl mb-4">Enter Device Code</h2>
          <p className="text-muted mb-6">
            Enter the code displayed on your device to authorize it.
          </p>

          <form onSubmit={handleLookup}>
            <input
              type="text"
              className="input w-full mb-4"
              placeholder="XXXX-XXXX"
              value={userCode}
              onChange={(e) => setUserCode(e.target.value.toUpperCase())}
              maxLength={9}
              style={{
                textAlign: 'center',
                fontSize: '1.5rem',
                letterSpacing: '0.25em',
                fontFamily: 'var(--font-geist-mono)',
              }}
            />
            {error && <div className="alert alert-error mb-4">{error}</div>}
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={!userCode.trim() || isFetching}
            >
              {isFetching ? 'Looking up...' : 'Continue'}
            </button>
          </form>
        </div>
      ) : (
        <div className="glass-card w-full p-8">
          <h2 className="text-2xl mb-4">Authorize Device</h2>
          <p className="text-muted mb-6">
            An application is requesting access to your account.
          </p>

          <div className="mb-6">
            <div className="mb-3">
              <span className="text-sm text-muted">Client ID</span>
              <p
                className="font-medium"
                style={{
                  fontFamily: 'var(--font-geist-mono)',
                  fontSize: '0.875rem',
                }}
              >
                {deviceRequest.clientId}
              </p>
            </div>
            <div className="mb-3">
              <span className="text-sm text-muted">Requested Scopes</span>
              <div className="scope-tags">
                {deviceRequest.scopes.map((scope) => (
                  <span key={scope} className="scope-tag">
                    {scope}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <span className="text-sm text-muted">Signed in as</span>
              <p className="font-medium">{user?.email}</p>
            </div>
          </div>

          {error && <div className="alert alert-error mb-4">{error}</div>}

          <button
              type="button"
              className="btn btn-primary w-full mb-3"
              disabled={isSubmitting}
              onClick={() => handleAction('approve')}
            >
              {isSubmitting ? 'Processing...' : 'Authorize'}
            </button>
            <button
              type="button"
              className="btn btn-secondary w-full"
              disabled={isSubmitting}
              onClick={() => handleAction('deny')}
            >
              Deny
            </button>
        </div>
      )}
    </div>
  );
}
