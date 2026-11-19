import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Centres a screen's single card in the space under the nav, for the sign-in
 * list, every method's screen and the home screen.
 */
export default function CenteredLayout({ children }: { children: ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create({
  centered: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
