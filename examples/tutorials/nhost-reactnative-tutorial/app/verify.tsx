import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from './lib/nhost/AuthProvider';
import { commonStyles } from './styles/commonStyles';
import { colors } from './styles/theme';

const PKCE_VERIFIER_KEY = 'nhost_pkce_verifier';

function consumePKCEVerifier(): string | null {
  const verifier = localStorage.getItem(PKCE_VERIFIER_KEY);
  if (verifier) {
    localStorage.removeItem(PKCE_VERIFIER_KEY);
  }
  return verifier;
}

export default function Verify() {
  const params = useLocalSearchParams();

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>(
    'verifying',
  );
  const [error, setError] = useState<string>('');
  const [urlParams, setUrlParams] = useState<Record<string, string>>({});

  const { nhost } = useAuth();

  useEffect(() => {
    const code = params.code as string;

    if (!code) {
      const allParams: Record<string, string> = {};
      Object.entries(params).forEach(([key, value]) => {
        if (typeof value === 'string') {
          allParams[key] = value;
        }
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
          if (isMounted) router.replace('/profile');
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
  }, [params, nhost.auth]);

  return (
    <View style={commonStyles.centerContent}>
      <Text style={commonStyles.title}>Email Verification</Text>

      <View style={commonStyles.card}>
        {status === 'verifying' && (
          <View style={commonStyles.alignCenter}>
            <Text style={[commonStyles.bodyText, commonStyles.marginBottom]}>
              Verifying your email...
            </Text>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}

        {status === 'success' && (
          <View style={commonStyles.alignCenter}>
            <Text style={commonStyles.successText}>
              ✓ Successfully verified!
            </Text>
            <Text style={commonStyles.bodyText}>
              You'll be redirected to your profile page shortly...
            </Text>
          </View>
        )}

        {status === 'error' && (
          <View style={commonStyles.alignCenter}>
            <Text style={commonStyles.errorText}>Verification failed</Text>
            <Text style={[commonStyles.bodyText, commonStyles.marginBottom]}>
              {error}
            </Text>

            {Object.keys(urlParams).length > 0 && (
              <View style={commonStyles.debugContainer}>
                <Text style={commonStyles.debugTitle}>URL Parameters:</Text>
                {Object.entries(urlParams).map(([key, value]) => (
                  <View key={key} style={commonStyles.debugItem}>
                    <Text style={commonStyles.debugKey}>{key}:</Text>
                    <Text style={commonStyles.debugValue}>{value}</Text>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[commonStyles.button, commonStyles.fullWidth]}
              onPress={() => router.replace('/signin')}
            >
              <Text style={commonStyles.buttonText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}
