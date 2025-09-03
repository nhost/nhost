import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { router, Link, useLocalSearchParams } from "expo-router";
import { useAuth } from "./lib/nhost/AuthProvider";
import MagicLinkForm from "./components/MagicLinkForm";
import SocialLoginForm from "./components/SocialLoginForm";
import NativeLoginForm from "./components/NativeLoginForm";

export default function SignUp() {
  const { nhost, isAuthenticated } = useAuth();
  const params = useLocalSearchParams();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [appleAuthInProgress, setAppleAuthInProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "password" | "magic" | "social" | "native"
  >("password");

  const magicLinkSent = params["magic"] === "success";

  // If already authenticated, redirect to profile
  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/profile");
    }
  }, [isAuthenticated]);

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await nhost.auth.signUpEmailPassword({
        email,
        password,
        options: {
          displayName,
        },
      });

      if (response.body?.session) {
        // Successfully signed up and automatically signed in
        router.replace("/profile");
      } else {
        // Verification email might be required
        router.replace("/signin");
      }
    } catch (err) {
      const errMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(`An error occurred during sign up: ${errMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Social login is now handled by the SocialLoginForm component

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Nhost SDK Demo</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign Up</Text>

          {magicLinkSent ? (
            <View style={styles.messageContainer}>
              <Text style={styles.successText}>
                Magic link sent! Check your email to sign in.
              </Text>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.setParams({ magic: "" })}
              >
                <Text style={styles.secondaryButtonText}>Back to sign up</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.tabContainer}>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    activeTab === "password" && styles.activeTab,
                  ]}
                  onPress={() => setActiveTab("password")}
                >
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === "password" && styles.activeTabText,
                    ]}
                  >
                    Password
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    activeTab === "magic" && styles.activeTab,
                  ]}
                  onPress={() => setActiveTab("magic")}
                >
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === "magic" && styles.activeTabText,
                    ]}
                  >
                    Magic Link
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    activeTab === "social" && styles.activeTab,
                  ]}
                  onPress={() => setActiveTab("social")}
                >
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === "social" && styles.activeTabText,
                    ]}
                  >
                    Social
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tabButton,
                    activeTab === "native" && styles.activeTab,
                  ]}
                  onPress={() => setActiveTab("native")}
                >
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === "native" && styles.activeTabText,
                    ]}
                  >
                    Native
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.form}>
                {activeTab === "password" ? (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Display Name</Text>
                      <TextInput
                        style={styles.input}
                        value={displayName}
                        onChangeText={setDisplayName}
                        placeholder="Enter your name"
                        autoCapitalize="words"
                      />
                    </View>

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

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Password</Text>
                      <TextInput
                        style={styles.input}
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Enter your password"
                        secureTextEntry
                        autoCapitalize="none"
                      />
                      <Text style={styles.helperText}>
                        Password must be at least 8 characters long
                      </Text>
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
                        <Text style={styles.buttonText}>Sign Up</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : activeTab === "magic" ? (
                  <MagicLinkForm buttonLabel="Sign Up with Magic Link" />
                ) : activeTab === "social" ? (
                  <SocialLoginForm action="Sign Up" isLoading={isLoading} />
                ) : (
                  <NativeLoginForm
                    action="Sign Up"
                    isLoading={isLoading || appleAuthInProgress}
                    setAppleAuthInProgress={setAppleAuthInProgress}
                  />
                )}
              </View>
            </>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Already have an account?{" "}
            <Link href="/signin" style={styles.link}>
              Sign In
            </Link>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    color: "#333",
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  tabContainer: {
    flexDirection: "row",
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  tabText: {
    fontSize: 16,
    color: "#718096",
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#6366f1",
  },
  activeTabText: {
    color: "#6366f1",
    fontWeight: "600",
  },
  form: {
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
  helperText: {
    fontSize: 12,
    color: "#666",
    marginTop: 3,
  },
  errorText: {
    color: "#e53e3e",
    marginBottom: 10,
  },
  successText: {
    color: "#38a169",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 15,
  },
  messageContainer: {
    alignItems: "center",
    paddingVertical: 10,
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
    paddingHorizontal: 20,
    borderRadius: 5,
    alignItems: "center",
    marginTop: 10,
  },
  secondaryButtonText: {
    color: "#4a5568",
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    marginTop: 20,
    alignItems: "center",
  },
  footerText: {
    color: "#666",
    fontSize: 14,
  },
  link: {
    color: "#6366f1",
    fontWeight: "bold",
  },
});
