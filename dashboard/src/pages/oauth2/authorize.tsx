import GlobalStyles from '@mui/material/GlobalStyles';
import type { ErrorResponse, OAuth2LoginResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { type ReactElement, useCallback, useEffect, useState } from 'react';
import { BaseLayout } from '@/components/layout/BaseLayout';
import { Container } from '@/components/layout/Container';
import { ThemeProvider } from '@/components/ui/v2/ThemeProvider';
import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import { Spinner } from '@/components/ui/v3/spinner';
import { useAuth } from '@/providers/Auth';
import { useNhostClient } from '@/providers/nhost';

function clientDisplayName(info: OAuth2LoginResponse): string {
  try {
    return new URL(info.redirectUri).hostname;
  } catch {
    return info.clientId;
  }
}

export default function OAuth2AuthorizePage() {
  const router = useRouter();
  const nhost = useNhostClient();
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();

  const requestId =
    typeof router.query.request_id === 'string'
      ? router.query.request_id
      : null;

  const [authRequest, setAuthRequest] = useState<OAuth2LoginResponse | null>(
    null,
  );
  const [isFetching, setIsFetching] = useState(true);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthLoading || !router.isReady) {
      return;
    }

    if (!isAuthenticated) {
      const consentPath = requestId
        ? `/oauth2/authorize?request_id=${encodeURIComponent(requestId)}`
        : '/oauth2/authorize';
      // Both are needed: the query param is used by UnauthenticatedLayout for
      // email/password sign-in, while sessionStorage is used by AuthProvider for
      // OAuth sign-in (where the redirect to the external provider loses the query param).
      sessionStorage.setItem('postSignInRedirect', consentPath);
      router.replace(`/signin?redirect=${encodeURIComponent(consentPath)}`);
    }
  }, [isAuthLoading, isAuthenticated, router, requestId]);

  useEffect(() => {
    if (!router.isReady || isAuthLoading || !isAuthenticated) {
      return;
    }

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
  }, [nhost, requestId, router.isReady, isAuthLoading, isAuthenticated]);

  const handleAuthorize = useCallback(async () => {
    if (!authRequest) {
      return;
    }

    setIsAuthorizing(true);
    setError(null);

    try {
      const consentResponse = await nhost.auth.oauth2LoginPost({
        requestId: authRequest.requestId,
      });
      window.location.href = consentResponse.body.redirectUri;
    } catch (err) {
      const fetchErr = err as FetchError<ErrorResponse>;
      setError(fetchErr.message || 'Authorization failed.');
      setIsAuthorizing(false);
    }
  }, [authRequest, nhost]);

  if (isAuthLoading || !router.isReady || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="small">
          <span className="text-[#A2B3BE] text-sm">Loading...</span>
        </Spinner>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <Container
        rootClassName="bg-transparent"
        className="flex max-w-md flex-col items-center gap-8 bg-transparent py-12"
      >
        <div className="relative flex items-center justify-center">
          <div className="backface-hidden absolute right-0 left-0 z-0 mx-auto h-20 w-20 transform-gpu rounded-full bg-primary-main opacity-80 blur-[56px]" />
          <Image
            src="/assets/logo.svg"
            width={119}
            height={40}
            alt="Nhost Logo"
          />
        </div>

        <div className="w-full rounded-md border p-6 lg:p-8">
          {isFetching ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="small">
                <span className="text-[#A2B3BE] text-sm">
                  Loading authorization request...
                </span>
              </Spinner>
            </div>
          ) : error && !authRequest ? (
            <div className="grid gap-4">
              <h3 className="text-center font-semibold text-xl">Error</h3>
              <p className="text-center text-red-500">{error}</p>
            </div>
          ) : authRequest ? (
            <div className="grid gap-6">
              <div className="grid gap-2 text-center">
                <h3 className="font-semibold text-xl">Authorize Application</h3>
                <p className="text-[#A2B3BE]">
                  <strong>{clientDisplayName(authRequest)}</strong> is
                  requesting access to your account.
                </p>
              </div>

              <div className="grid gap-3">
                <div>
                  <p className="font-medium text-[#A2B3BE] text-sm">
                    Application
                  </p>
                  <p>{clientDisplayName(authRequest)}</p>
                </div>
                <div>
                  <p className="font-medium text-[#A2B3BE] text-sm">
                    Redirect URI
                  </p>
                  <p className="break-all text-sm">{authRequest.redirectUri}</p>
                </div>
                <div>
                  <p className="font-medium text-[#A2B3BE] text-sm">Scopes</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {authRequest.scopes.map((scope) => (
                      <Badge key={scope} variant="secondary">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {error && <p className="text-center text-red-500">{error}</p>}

              {user && (
                <p className="text-center text-[#A2B3BE] text-sm">
                  Signed in as <strong>{user.email}</strong>
                </p>
              )}

              <div className="grid gap-2">
                <Button
                  disabled={isAuthorizing}
                  onClick={handleAuthorize}
                  className="w-full"
                >
                  {isAuthorizing ? 'Authorizing...' : 'Authorize'}
                </Button>
                <Button
                  variant="outline"
                  disabled={isAuthorizing}
                  onClick={() => {
                    const url = new URL(authRequest.redirectUri);
                    url.searchParams.set('error', 'access_denied');
                    url.searchParams.set(
                      'error_description',
                      'The user denied the authorization request.',
                    );
                    window.location.href = url.toString();
                  }}
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </Container>
    </div>
  );
}

OAuth2AuthorizePage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ThemeProvider color="dark">
      <BaseLayout title="Authorize Application">
        <GlobalStyles
          styles={{
            'html, body': {
              backgroundColor: '#000 !important',
            },
            '#__next': {
              overflow: 'auto',
            },
          }}
        />
        {page}
      </BaseLayout>
    </ThemeProvider>
  );
};
