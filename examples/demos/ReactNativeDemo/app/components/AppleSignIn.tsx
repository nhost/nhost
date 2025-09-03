import React from "react";
import { Platform, StyleSheet, Alert } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { useAuth } from "../lib/nhost/AuthProvider";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";

interface AppleSignInProps {
  action: "Sign In" | "Sign Up";
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
}

const AppleSignIn: React.FC<AppleSignInProps> = ({ setIsLoading }) => {
  const { nhost } = useAuth();

  // Check if Apple authentication is available on this device
  const [appleAuthAvailable, setAppleAuthAvailable] = React.useState(false);

  React.useEffect(() => {
    const checkAvailability = async () => {
      if (Platform.OS === "ios") {
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        setAppleAuthAvailable(isAvailable);
      }
    };

    void checkAvailability();
  }, []);

  const handleAppleSignIn = async () => {
    try {
      setIsLoading(true);

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
          provider: "apple",
          idToken: credential.identityToken,
          nonce,
        });

        if (response.body?.session) {
          router.replace("/profile");
        } else {
          Alert.alert(
            "Authentication Error",
            "Failed to authenticate with Nhost",
          );
        }
      } else {
        Alert.alert(
          "Authentication Error",
          "No identity token received from Apple",
        );
      }
    } catch (error: unknown) {
      // Handle other errors
      const message =
        error instanceof Error
          ? error.message
          : "Failed to authentica with Apple";
      Alert.alert("Authentication Error", message);
    } finally {
      setIsLoading(false);
    }
  };

  // Only show the button on iOS devices where Apple authentication is available
  if (Platform.OS !== "ios" || !appleAuthAvailable) {
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
};

const styles = StyleSheet.create({
  appleButton: {
    width: "100%",
    height: 45,
    marginBottom: 10,
  },
});

export default AppleSignIn;
