import { useRouter } from "expo-router";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import ProtectedScreen from "./components/ProtectedScreen";
import { useAuth } from "./lib/nhost/AuthProvider";
import { commonStyles, profileStyles } from "./styles/commonStyles";

export default function Profile() {
  const router = useRouter();
  const { user, session, nhost } = useAuth();

  const handleSignOut = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            if (session) {
              await nhost.auth.signOut({
                refreshToken: session.refreshToken,
              });
            }
            router.replace("/");
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            Alert.alert("Error", `Failed to sign out: ${message}`);
          }
        },
      },
    ]);
  };

  return (
    <ProtectedScreen>
      <ScrollView
        style={commonStyles.container}
        contentContainerStyle={commonStyles.contentContainer}
      >
        <Text style={commonStyles.title}>Your Profile</Text>

        <View style={commonStyles.card}>
          <Text style={commonStyles.cardTitle}>User Information</Text>

          <View style={profileStyles.profileItem}>
            <Text style={commonStyles.labelText}>Display Name:</Text>
            <Text style={commonStyles.valueText}>
              {user?.displayName || "Not set"}
            </Text>
          </View>

          <View style={profileStyles.profileItem}>
            <Text style={commonStyles.labelText}>Email:</Text>
            <Text style={commonStyles.valueText}>
              {user?.email || "Not available"}
            </Text>
          </View>

          <View style={profileStyles.profileItem}>
            <Text style={commonStyles.labelText}>User ID:</Text>
            <Text
              style={commonStyles.valueText}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {user?.id || "Not available"}
            </Text>
          </View>

          <View style={profileStyles.profileItem}>
            <Text style={commonStyles.labelText}>Roles:</Text>
            <Text style={commonStyles.valueText}>
              {user?.roles?.join(", ") || "None"}
            </Text>
          </View>

          <View
            style={[profileStyles.profileItem, profileStyles.profileItemLast]}
          >
            <Text style={commonStyles.labelText}>Email Verified:</Text>
            <Text
              style={[
                commonStyles.valueText,
                user?.emailVerified
                  ? commonStyles.successText
                  : commonStyles.errorText,
              ]}
            >
              {user?.emailVerified ? "✓ Yes" : "✗ No"}
            </Text>
          </View>
        </View>

        <View style={commonStyles.card}>
          <Text style={commonStyles.cardTitle}>Session Information</Text>
          <View style={commonStyles.sessionInfo}>
            <Text style={commonStyles.sessionValue}>
              {JSON.stringify(session, null, 2)}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[commonStyles.button, { backgroundColor: "#ef4444" }]}
          onPress={handleSignOut}
        >
          <Text style={commonStyles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </ProtectedScreen>
  );
}
