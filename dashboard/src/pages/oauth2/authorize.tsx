import GlobalStyles from '@mui/material/GlobalStyles';
import type { ErrorResponse, OAuth2LoginResponse } from '@nhost/nhost-js/auth';
import type { FetchError } from '@nhost/nhost-js/fetch';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { type ReactElement, useCallback, useEffect, useState } from 'react';
import { BaseLayout } from '@/components/layout/BaseLayout';
import { Container } from '@/components/layout/Container';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
import { ThemeProvider } from '@/components/ui/v2/ThemeProvider';
import { Button } from '@/components/ui/v3/button';
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
        <ActivityIndicator label="Loading..." />
      </div>
    );
  }

  return (
    <Box
      className="flex min-h-screen items-center justify-center"
      sx={{ backgroundColor: (theme) => theme.palette.common.black }}
    >
      <Container
        rootClassName="bg-transparent"
        className="flex max-w-md flex-col items-center gap-8 bg-transparent py-12"
      >
        <div className="relative flex items-center justify-center">
          <Box
            className="backface-hidden absolute right-0 left-0 z-0 mx-auto h-20 w-20 transform-gpu rounded-full opacity-80 blur-[56px]"
            sx={{
              backgroundColor: (theme) => theme.palette.primary.main,
            }}
          />
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
              <ActivityIndicator label="Loading authorization request..." />
            </div>
          ) : error && !authRequest ? (
            <div className="grid gap-4">
              <Text variant="h3" className="text-center">
                Error
              </Text>
              <Text className="text-center text-red-500">{error}</Text>
            </div>
          ) : authRequest ? (
            <div className="grid gap-6">
              <div className="grid gap-2 text-center">
                <Text variant="h3">Authorize Application</Text>
                <Text color="secondary">
                  <strong>{clientDisplayName(authRequest)}</strong> is
                  requesting access to your account.
                </Text>
              </div>

              <div className="grid gap-3">
                <div>
                  <Text variant="subtitle2" color="secondary">
                    Application
                  </Text>
                  <Text>{clientDisplayName(authRequest)}</Text>
                </div>
                <div>
                  <Text variant="subtitle2" color="secondary">
                    Redirect URI
                  </Text>
                  <Text className="break-all text-sm">
                    {authRequest.redirectUri}
                  </Text>
                </div>
                <div>
                  <Text variant="subtitle2" color="secondary">
                    Scopes
                  </Text>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {authRequest.scopes.map((scope) => (
                      <Box
                        key={scope}
                        className="rounded-full px-3 py-1 text-sm"
                        sx={{
                          backgroundColor: (theme) =>
                            theme.palette.action.hover,
                        }}
                      >
                        {scope}
                      </Box>
                    ))}
                  </div>
                </div>
              </div>

              {error && (
                <Text className="text-center text-red-500">{error}</Text>
              )}

              {user && (
                <Text variant="body2" color="secondary" className="text-center">
                  Signed in as <strong>{user.email}</strong>
                </Text>
              )}

              <Button
                disabled={isAuthorizing}
                onClick={handleAuthorize}
                className="w-full"
              >
                {isAuthorizing ? 'Authorizing...' : 'Authorize'}
              </Button>
            </div>
          ) : null}
        </div>
      </Container>
    </Box>
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
