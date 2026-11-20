import { useHeaderHeight } from 'expo-router/react-navigation';
import type { ReactElement, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthErrorFromUrl from '@/components/AuthErrorFromUrl';
import Footer from '@/components/Footer';
import SessionGuard from '@/components/SessionGuard';
import { colors, inset } from '@/theme';

/**
 * What the web layout's <main> and footer are, around one screen: one scroll
 * view, so short screens centre and long ones scroll, behind the session
 * guard.
 */
export default function ScreenLayout({ children }: { children: ReactNode }) {
  const { bottom } = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  // Android too: drawn edge to edge, the window does not shrink for the
  // keyboard. The offset is for the header, which sits above this view.
  return (
    <SessionGuard>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior="padding"
        keyboardVerticalOffset={headerHeight}
      >
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
      </KeyboardAvoidingView>
    </SessionGuard>
  );
}

/**
 * A stack's `screenLayout`, which puts each of its screens in `ScreenLayout`
 * exactly once. A route named in `navigators` holds a nested navigator, whose
 * own `screenLayout` wraps its screens, so it is left bare: wrapping it too
 * would run the guard twice per navigation and nest one scroll view in
 * another.
 */
export function screenLayout(
  { route, children }: { route: { name: string }; children: ReactElement },
  navigators: readonly string[] = [],
): ReactElement {
  if (navigators.includes(route.name)) {
    return children;
  }
  return <ScreenLayout>{children}</ScreenLayout>;
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
    paddingHorizontal: inset.screen,
    paddingVertical: 24,
  },
});
