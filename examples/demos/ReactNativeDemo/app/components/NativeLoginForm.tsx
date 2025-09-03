import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AppleSignIn from "./AppleSignIn";

interface NativeLoginFormProps {
  action: "Sign In" | "Sign Up";
  isLoading: boolean;
  setAppleAuthInProgress: (inProgress: boolean) => void;
}

export default function NativeLoginForm({
  action,
  isLoading,
  setAppleAuthInProgress,
}: NativeLoginFormProps) {
  // Function to update loading state
  const updateLoadingState = (loading: boolean) => {
    if (setAppleAuthInProgress) {
      setAppleAuthInProgress(loading);
    }
  };

  // Check if we have any native options for this platform
  const hasAppleOption = Platform.OS === "ios";

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {action} using native authentication methods
      </Text>
      {isLoading ? (
        <ActivityIndicator size="large" color="#6366f1" />
      ) : (
        <View style={styles.buttonContainer}>
          <AppleSignIn
            action={action}
            isLoading={isLoading}
            setIsLoading={updateLoadingState}
          />

          {!hasAppleOption && (
            <Text style={styles.noOptionsText}>
              No native authentication options available for your platform
            </Text>
          )}

          {hasAppleOption && (
            <Text style={styles.infoText}>
              Native sign-in methods provide a more streamlined authentication
              experience
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 10,
    width: "100%",
  },
  text: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
    color: "#4a5568",
  },
  buttonContainer: {
    width: "100%",
    alignItems: "center",
  },
  infoText: {
    marginTop: 10,
    fontSize: 12,
    color: "#718096",
    textAlign: "center",
  },
  noOptionsText: {
    marginTop: 20,
    fontSize: 14,
    color: "#a0aec0",
    textAlign: "center",
    fontStyle: "italic",
  },
});
