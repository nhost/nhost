import { Stack } from 'expo-router';
import CenteredLayout from '@/components/CenteredLayout';
import { screenLayout } from '@/components/ScreenLayout';
import { colors } from '@/theme';

/**
 * Every method's screens, in a stack of their own under the root's nav. The
 * root stack leaves this one bare, so its `screenLayout` frames and guards
 * each screen.
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
      screenLayout={({ route, children }) =>
        screenLayout({
          route,
          children: <CenteredLayout>{children}</CenteredLayout>,
        })
      }
    />
  );
}
