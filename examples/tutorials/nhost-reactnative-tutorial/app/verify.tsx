import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "./lib/nhost/AuthProvider";
import { commonStyles } from "./styles/commonStyles";
import { colors } from "./styles/theme";

export default function Verify() {
  const params = useLocalSearchParams();

  const [status, setStatus] = useState<"verifying" | "success" | "error">(
    "verifying",
  );
  const [error, setError] = useState<string | null>(null);
  const [urlParams, setUrlParams] = useState<Record<string, string>>({});

  const { nhost } = useAuth();

  useEffect(() => {
    // Extract the refresh token from the URL
    const refreshToken = params.refreshToken as string;

    if (!refreshToken) {
      // Collect all URL parameters to display for debugging
      const allParams: Record<string, string> = {};
      Object.entries(params).forEach(([key, value]) => {
        if (typeof value === "string") {
          allParams[key] = value;
        }
      });
      setUrlParams(allParams);

      setStatus("error");
      setError("No refresh token found in URL");
      return;
    }

    // Flag to handle component unmounting during async operations
    let isMounted = true;

    async function processToken(): Promise<void> {
      try {
        // First display the verifying message for at least a moment
        await new Promise((resolve) => setTimeout(resolve, 500));

        if (!isMounted) return;

        if (!refreshToken) {
          // Collect all URL parameters to display
          const allParams: Record<string, string> = {};
          Object.entries(params).forEach(([key, value]) => {
            if (typeof value === "string") {
              allParams[key] = value;
            }
          });
          setUrlParams(allParams);

          setStatus("error");
          setError("No refresh token found in URL");
          return;
        }

        // Process the token
        await nhost.auth.refreshToken({ refreshToken });

        if (!isMounted) return;

        setStatus("success");

        // Wait to show success message briefly, then redirect
        setTimeout(() => {
          if (isMounted) router.replace("/profile");
        }, 1500);
      } catch (err) {
        const message = (err as Error).message || "Unknown error";
        if (!isMounted) return;

        setStatus("error");
        setError(`An error occurred during verification: ${message}`);
      }
    }

    processToken();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [params, nhost.auth]);

  return (
    <View style={commonStyles.centerContent}>
      <Text style={commonStyles.title}>Email Verification</Text>

      <View style={commonStyles.card}>
        {status === "verifying" && (
          <View style={commonStyles.alignCenter}>
            <Text style={[commonStyles.bodyText, commonStyles.marginBottom]}>
              Verifying your email...
            </Text>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}

        {status === "success" && (
          <View style={commonStyles.alignCenter}>
            <Text style={commonStyles.successText}>
              ✓ Successfully verified!
            </Text>
            <Text style={commonStyles.bodyText}>
              You'll be redirected to your profile page shortly...
            </Text>
          </View>
        )}

        {status === "error" && (
          <View style={commonStyles.alignCenter}>
            <Text style={commonStyles.errorText}>
              Verification failed
            </Text>
            <Text style={[commonStyles.bodyText, commonStyles.marginBottom]}>
              {error}
            </Text>

            {Object.keys(urlParams).length > 0 && (
              <View style={commonStyles.debugContainer}>
                <Text style={commonStyles.debugTitle}>
                  URL Parameters:
                </Text>
                {Object.entries(urlParams).map(([key, value]) => (
                  <View key={key} style={commonStyles.debugItem}>
                    <Text style={commonStyles.debugKey}>
                      {key}:
                    </Text>
                    <Text style={commonStyles.debugValue}>{value}</Text>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[commonStyles.button, commonStyles.fullWidth]}
              onPress={() => router.replace("/signin")}
            >
              <Text style={commonStyles.buttonText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}
