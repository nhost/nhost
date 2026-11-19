import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthErrorFromUrl from '@/components/AuthErrorFromUrl';
import Footer from '@/components/Footer';
import Nav from '@/components/Nav';
import { colors } from '@/theme';

// What the web layout's <main> and footer are, around each screen of the
// stack: one scroll view, so short screens centre and long ones scroll.
function Screen({ children }: { children: ReactNode }) {
  const { bottom } = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: bottom }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.main}>
        <AuthErrorFromUrl />
        {children}
      </View>
      <Footer />
    </ScrollView>
  );
}

export default function RootLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          header: () => <Nav />,
          contentStyle: { backgroundColor: colors.background },
        }}
        screenLayout={({ children }) => <Screen>{children}</Screen>}
      />
      <StatusBar style="light" />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
  },
  main: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 896,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
});
