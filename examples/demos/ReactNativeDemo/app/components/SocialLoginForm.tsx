import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../lib/nhost/AuthProvider";

interface SocialLoginFormProps {
  action: "Sign In" | "Sign Up";
  isLoading?: boolean;
}

export default function SocialLoginForm({
  action,
  isLoading: initialLoading = false,
}: SocialLoginFormProps) {
  const { nhost } = useAuth();
  const [isLoading] = useState(initialLoading);

  const handleSocialLogin = (provider: "github") => {
    // Use the same redirect URL approach as the magic link
    const redirectUrl = Linking.createURL("verify");

    // Sign in with the specified provider
    const url = nhost.auth.signInProviderURL(provider, {
      redirectTo: redirectUrl,
    });

    // Open the URL in browser
    void Linking.openURL(url);
  };

  return (
    <View style={styles.socialContainer}>
      <Text style={styles.socialText}>{action} using your Social account</Text>
      {isLoading ? (
        <ActivityIndicator size="large" color="#6366f1" />
      ) : (
        <TouchableOpacity
          style={styles.socialButton}
          onPress={() => handleSocialLogin("github")}
          disabled={isLoading}
        >
          <View style={styles.buttonContent}>
            <Ionicons name="logo-github" size={22} style={styles.githubIcon} />
            <Text style={styles.socialButtonText}>Continue with GitHub</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  socialContainer: {
    alignItems: "center",
    paddingVertical: 10,
  },
  socialText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
    color: "#4a5568",
  },
  socialButton: {
    backgroundColor: "#24292e",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 5,
    width: "100%",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  githubIcon: {
    marginRight: 10,
    color: "#ffffff",
  },
  socialButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
