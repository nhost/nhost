import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize } from '@/theme';
import { signInWithProvider } from './actions';
import OAuthButtons from './OAuthButtons';
import { configuredProviders, type Provider, providerHref } from './providers';

/**
 * A button for each provider the deployment set up, shown on the sign-in list
 * itself.
 */
export default function ProviderSignIn({
  destination,
  lastUsed,
}: {
  destination: string;
  lastUsed: string | null;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const signIn = async (id: Provider['id']): Promise<void> => {
    if (pending) {
      return;
    }
    setError(undefined);
    setPending(true);
    try {
      const result = await signInWithProvider(id, destination);
      setError(result.error);
    } finally {
      setPending(false);
    }
  };

  const buttons = configuredProviders().map(({ id, label }) => ({
    id,
    label,
    lastUsed: providerHref(id) === lastUsed,
    onPress: () => void signIn(id),
  }));

  return (
    <View style={styles.wrapper}>
      <OAuthButtons buttons={buttons} disabled={pending} />
      {error ? (
        <Text role="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 12,
  },
  error: {
    color: colors.destructive,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
});
