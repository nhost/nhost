import { useState, useEffect } from "react";
import { Link, router } from "expo-router";
import * as Linking from "expo-linking";
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
import AppleSignInButton from "./components/AppleSignInButton";

export default function SignUp() {
  const { nhost, isAuthenticated } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Redirect authenticated users to profile
  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/profile");
    }
  }, [isAuthenticated]);

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await nhost.auth.signUpEmailPassword({
        email,
        password,
        options: {
          displayName,
          // Set the redirect URL for email verification
          redirectTo: Linking.createURL("verify"),
        },
      });

      if (response.body?.session) {
        // Successfully signed up and automatically signed in
        router.replace("/profile");
      } else {
        // Verification email sent
        setSuccess(true);
      }
    } catch (err) {
      const message = (err as Error).message || "Unknown error";
      setError(`An error occurred during sign up: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <View style={commonStyles.centerContent}>
        <Text style={commonStyles.title}>Check Your Email</Text>
        <View style={commonStyles.successContainer}>
          <Text style={commonStyles.successText}>
            We've sent a verification link to <Text style={commonStyles.emailText}>{email}</Text>
          </Text>
          <Text style={[commonStyles.bodyText, commonStyles.textCenter]}>
            Please check your email and click the verification link to activate your account.
          </Text>
        </View>
        <TouchableOpacity
          style={[commonStyles.button, commonStyles.fullWidth]}
          onPress={() => router.replace("/signin")}
        >
          <Text style={commonStyles.buttonText}>Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={commonStyles.container}
    >
      <ScrollView
        contentContainerStyle={commonStyles.centerContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={commonStyles.title}>Sign Up</Text>

        <View style={commonStyles.card}>
          {/* Apple Sign In Button */}
          <AppleSignInButton isLoading={isLoading} setIsLoading={setIsLoading} />

          {/* Divider */}
          <View style={commonStyles.dividerContainer}>
            <View style={commonStyles.divider} />
            <Text style={commonStyles.dividerText}>or</Text>
            <View style={commonStyles.divider} />
          </View>

          <View style={commonStyles.formField}>
            <Text style={commonStyles.labelText}>Display Name</Text>
            <TextInput
              style={commonStyles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Enter your name"
              autoCapitalize="words"
            />
          </View>

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
            <Text style={commonStyles.helperText}>Minimum 8 characters</Text>
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
              <Text style={commonStyles.buttonText}>Sign Up</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={commonStyles.linkContainer}>
          <Text style={commonStyles.linkText}>
            Already have an account?{" "}
            <Link href="/signin" style={commonStyles.link}>
              Sign In
            </Link>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
