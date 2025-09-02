import type { ErrorResponse } from "@nhost/nhost-js/auth";
import type { FetchError } from "@nhost/nhost-js/fetch";
import * as Linking from "expo-linking";
import { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../lib/nhost/AuthProvider";

interface MagicLinkFormProps {
  buttonLabel?: string;
}

export default function MagicLinkForm({
  buttonLabel = "Send Magic Link",
}: MagicLinkFormProps) {
  const [email, setEmail] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { nhost } = useAuth();

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // For Expo Go, we need to create the correct URL format
      // This will work both in Expo Go and standalone app
      const redirectUrl = Linking.createURL("verify");

      await nhost.auth.signInPasswordlessEmail({
        email,
        options: {
          redirectTo: redirectUrl,
        },
      });

      setSuccess(true);
    } catch (err) {
      const error = err as FetchError<ErrorResponse>;
      setError(
        `An error occurred while sending the magic link: ${error.message}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <View style={styles.container}>
        <Text style={styles.successText}>
          Magic link sent! Check your email to sign in.
        </Text>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => setSuccess(false)}
        >
          <Text style={styles.secondaryButtonText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Enter your email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity
        style={styles.button}
        onPress={handleSubmit}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{buttonLabel}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    color: "#333",
  },
  input: {
    height: 45,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 5,
    paddingHorizontal: 10,
    fontSize: 16,
    backgroundColor: "#fafafa",
  },
  errorText: {
    color: "#e53e3e",
    marginBottom: 10,
  },
  successText: {
    fontSize: 16,
    color: "#38a169",
    textAlign: "center",
    marginBottom: 15,
  },
  button: {
    backgroundColor: "#6366f1",
    paddingVertical: 12,
    borderRadius: 5,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "#e2e8f0",
    paddingVertical: 12,
    borderRadius: 5,
    alignItems: "center",
    marginTop: 10,
  },
  secondaryButtonText: {
    color: "#4a5568",
    fontSize: 16,
    fontWeight: "600",
  },
});
