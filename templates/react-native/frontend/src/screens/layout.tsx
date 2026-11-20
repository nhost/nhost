import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { StrictMode, useEffect, useState } from 'react';
import Nav from '@/components/Nav';
import { screenLayout } from '@/components/ScreenLayout';
import AuthProvider from '@/lib/nhost/AuthProvider';
import { startSession } from '@/lib/nhost/startSession';
import { colors } from '@/theme';

// No screen shows a session that is about to change, so the splash stays up
// until startup has settled it.
SplashScreen.preventAutoHideAsync().catch((err: unknown) => {
  console.error('Could not keep the splash screen up:', err);
});

export default function RootLayout() {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    let mounted = true;
    void startSession().then(() => {
      if (mounted) {
        setStarted(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (started) {
      SplashScreen.hide();
    }
  }, [started]);

  if (!started) {
    return null;
  }

  return (
    <StrictMode>
      <AuthProvider>
        <Stack
          screenOptions={{
            header: () => <Nav />,
            contentStyle: { backgroundColor: colors.background },
          }}
          screenLayout={(props) => screenLayout(props)}
        />
        <StatusBar style="light" />
      </AuthProvider>
    </StrictMode>
  );
}
