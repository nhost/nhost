import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { AuthProvider } from './lib/nhost/AuthProvider';

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#0f172a' },
            headerTintColor: '#ffffff',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Nhost + Expo' }} />
          <Stack.Screen name="signin" options={{ title: 'Sign in' }} />
          <Stack.Screen name="protected" options={{ title: 'Your todos' }} />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  );
}
