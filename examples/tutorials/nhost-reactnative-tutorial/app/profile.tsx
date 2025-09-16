import { ScrollView, Text, View } from "react-native";
import ProtectedScreen from "./components/ProtectedScreen";
import { useAuth } from "./lib/nhost/AuthProvider";
import { commonStyles, profileStyles } from "./styles/commonStyles";

export default function Profile() {
  const { user, session } = useAuth();

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

          <View style={[profileStyles.profileItem, profileStyles.profileItemLast]}>
            <Text style={commonStyles.labelText}>Email Verified:</Text>
            <Text style={[
              commonStyles.valueText,
              user?.emailVerified ? commonStyles.successText : commonStyles.errorText
            ]}>
              {user?.emailVerified ? "✓ Yes" : "✗ No"}
            </Text>
          </View>
        </View>

        <View style={commonStyles.card}>
          <Text style={commonStyles.cardTitle}>Session Information</Text>
          <View style={commonStyles.sessionInfo}>
            <Text style={commonStyles.sessionLabel}>Refresh Token ID:</Text>
            <Text
              style={commonStyles.sessionValue}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {session?.refreshTokenId || "None"}
            </Text>

            <Text style={commonStyles.sessionLabel}>Access Token Expires In:</Text>
            <Text style={commonStyles.sessionValue}>
              {session?.accessTokenExpiresIn
                ? `${session.accessTokenExpiresIn}s`
                : "N/A"}
            </Text>
          </View>
        </View>
      </ScrollView>
    </ProtectedScreen>
  );
}
