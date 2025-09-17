import { useState, useEffect } from "react";
import { Link, router } from "expo-router";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "./lib/nhost/AuthProvider";
import { commonStyles } from "./styles/commonStyles";
import { colors } from "./styles/theme";

export default function SignIn() {
  const { nhost, isAuthenticated } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use useEffect for navigation after authentication is confirmed
  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/profile");
    }
  }, [isAuthenticated]);

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Use the signIn function from auth context
      const response = await nhost.auth.signInEmailPassword({
        email,
        password,
      });

      // If we have a session, sign in was successful
      if (response.body?.session) {
        router.replace("/profile");
      } else {
        setError("Failed to sign in. Please check your credentials.");
      }
    } catch (err) {
      const message = (err as Error).message || "Unknown error";
      setError(`An error occurred during sign in: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={commonStyles.container}
    >
      <ScrollView
        contentContainerStyle={commonStyles.centerContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={commonStyles.title}>Sign In</Text>

        <View style={commonStyles.card}>
          <View style={commonStyles.formField}>
            <Text style={commonStyles.labelText}>Email</Text>
            <TextInput
              style={commonStyles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={commonStyles.formField}>
            <Text style={commonStyles.labelText}>Password</Text>
            <TextInput
              style={commonStyles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {error && (
            <View style={commonStyles.errorContainer}>
              <Text style={commonStyles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[commonStyles.button, commonStyles.fullWidth]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.surface} />
            ) : (
              <Text style={commonStyles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={commonStyles.linkContainer}>
          <Text style={commonStyles.linkText}>
            Don't have an account?{" "}
            <Link href="/signup" style={commonStyles.link}>
              Sign Up
            </Link>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
