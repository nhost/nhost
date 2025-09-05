import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useAuth } from "../lib/nhost/AuthProvider";

export default function MFAVerification() {
  const { nhost } = useAuth();
  const params = useLocalSearchParams();
  const ticket = params["ticket"] as string;

  const [verificationCode, setVerificationCode] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if no ticket is provided
  useEffect(() => {
    if (!ticket) {
      Alert.alert("Error", "Invalid authentication request");
      router.replace("/signin");
    }
  }, [ticket]);

  const handleSubmit = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    if (!ticket) {
      setError("Missing authentication ticket");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Complete MFA verification
      await nhost.auth.verifySignInMfaTotp({
        ticket,
        otp: verificationCode,
      });
    } catch (err) {
      const errMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(`Verification failed: ${errMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={styles.container}
      keyboardVerticalOffset={40}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={styles.scrollViewContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.contentContainer}>
            <Text style={styles.title}>Multi-Factor Authentication</Text>

            <View style={styles.card}>
              <Text style={styles.instructions}>
                Enter the verification code from your authenticator app to
                complete sign in.
              </Text>

              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Authentication Code</Text>
                <TextInput
                  style={styles.input}
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  placeholder="Enter 6-digit code"
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    Keyboard.dismiss();
                    if (verificationCode.length === 6 && !isLoading) {
                      void handleSubmit();
                    }
                  }}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.button,
                  (isLoading || verificationCode.length !== 6) &&
                    styles.buttonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={isLoading || verificationCode.length !== 6}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Verify</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backLink}
                onPress={() => router.back()}
                disabled={isLoading}
              >
                <Text style={styles.backLinkText}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  contentContainer: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#333",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  instructions: {
    fontSize: 16,
    color: "#4b5563",
    marginBottom: 20,
    textAlign: "center",
  },
  errorContainer: {
    backgroundColor: "#fee2e2",
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#ef4444",
  },
  errorText: {
    color: "#b91c1c",
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: "#374151",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    padding: 12,
    fontSize: 18,
    backgroundColor: "#f9fafb",
    textAlign: "center",
    letterSpacing: 8,
  },
  button: {
    backgroundColor: "#6366f1",
    padding: 15,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  backLink: {
    marginTop: 20,
    alignItems: "center",
  },
  backLinkText: {
    color: "#6366f1",
    fontSize: 16,
  },
});
