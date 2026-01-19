import { Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { AuthProvider } from './lib/nhost/AuthProvider';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#f5f5f5',
          },
          headerTintColor: '#333',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Home' }} />
        <Stack.Screen name="signin" options={{ title: 'Sign In' }} />
        <Stack.Screen
          name="signin/mfa"
          options={{ title: 'MFA Verification' }}
        />
        <Stack.Screen name="signup" options={{ title: 'Sign Up' }} />
        <Stack.Screen name="profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="upload" options={{ title: 'File Upload' }} />
        <Stack.Screen name="verify" options={{ title: 'Verify Email' }} />
      </Stack>
    </AuthProvider>
  );
}

// Error boundary to catch and display errors
export function ErrorBoundary(props: { error: Error }) {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
        An error occurred
      </Text>
      <Text style={{ color: 'red', marginBottom: 10 }}>
        {props.error.message}
      </Text>
      <Text>{props.error.stack}</Text>
    </View>
  );
}
