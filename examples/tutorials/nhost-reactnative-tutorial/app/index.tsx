import { useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "./lib/nhost/AuthProvider";
import { commonStyles, homeStyles } from "./styles/commonStyles";

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();

  return (
    <View style={commonStyles.centerContent}>
      <Text style={commonStyles.title}>Welcome to Nhost React Native Demo</Text>

      <View style={homeStyles.welcomeCard}>
        {isAuthenticated ? (
          <>
            <View style={{ gap: 15, width: "100%" }}>
              <Text style={homeStyles.welcomeText}>
                Hello, {user?.displayName || user?.email}!
              </Text>
              <TouchableOpacity
                style={[commonStyles.button, commonStyles.fullWidth]}
                onPress={() => router.push("/todos")}
              >
                <Text style={commonStyles.buttonText}>My Todos</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[commonStyles.button, commonStyles.fullWidth]}
                onPress={() => router.push("/files")}
              >
                <Text style={commonStyles.buttonText}>My Files</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[commonStyles.button, commonStyles.fullWidth]}
                onPress={() => router.push("/profile")}
              >
                <Text style={commonStyles.buttonText}>Go to Profile</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={homeStyles.authMessage}>You are not signed in.</Text>

            <View style={{ gap: 15, width: "100%" }}>
              <TouchableOpacity
                style={[commonStyles.button, commonStyles.fullWidth]}
                onPress={() => router.push("/signin")}
              >
                <Text style={commonStyles.buttonText}>Sign In</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[commonStyles.button, commonStyles.buttonSecondary, commonStyles.fullWidth]}
                onPress={() => router.push("/signup")}
              >
                <Text style={commonStyles.buttonText}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}
