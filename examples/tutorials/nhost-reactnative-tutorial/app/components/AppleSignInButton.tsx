import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet } from 'react-native';
import { useAuth } from '../lib/nhost/AuthProvider';

interface AppleSignInButtonProps {
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
}

export default function AppleSignInButton({ setIsLoading }: AppleSignInButtonProps) {
  const { nhost } = useAuth();
  const router = useRouter();
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);

  useEffect(() => {
    const checkAvailability = async () => {
      if (Platform.OS === 'ios') {
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        setAppleAuthAvailable(isAvailable);
      }
    };

    void checkAvailability();
  }, []);

  const handleAppleSignIn = async () => {
    try {
      setIsLoading(true);

      // Generate a random nonce for security
      const nonce = Math.random().toString(36).substring(2, 15);

      // Hash the nonce for Apple Authentication
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        nonce,
      );

      // Request Apple authentication with our hashed nonce
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (credential.identityToken) {
        // Use the identity token to sign in with Nhost
        // Pass the original unhashed nonce to the SDK
        // so the server can verify it
        const response = await nhost.auth.signInIdToken({
          provider: 'apple',
          idToken: credential.identityToken,
          nonce,
        });

        if (response.body?.session) {
          router.replace('/profile');
        } else {
          Alert.alert(
            'Authentication Error',
            'Failed to authenticate with Nhost',
          );
        }
      } else {
        Alert.alert(
          'Authentication Error',
          'No identity token received from Apple',
        );
      }
    } catch (error: unknown) {
      // Handle user cancellation gracefully
      if (error instanceof Error && error.message.includes('canceled')) {
        // User cancelled the sign-in flow, don't show an error
        return;
      }

      // Handle other errors
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to authenticate with Apple';
      Alert.alert('Authentication Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  // Only show the button on iOS devices where Apple authentication is available
  if (Platform.OS !== 'ios' || !appleAuthAvailable) {
    return null;
  }

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={5}
      style={styles.appleButton}
      onPress={handleAppleSignIn}
    />
  );
}

const styles = StyleSheet.create({
  appleButton: {
    width: '100%',
    height: 45,
    marginBottom: 10,
  },
});
