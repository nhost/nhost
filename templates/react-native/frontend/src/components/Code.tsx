import { StyleSheet, Text } from 'react-native';
import { colors, monospace } from '@/theme';

/** A file path or command inside running text. */
export default function Code({ children }: { children: string }) {
  return <Text style={styles.code}>{children}</Text>;
}

const styles = StyleSheet.create({
  code: {
    backgroundColor: colors.muted,
    color: colors.foreground,
    fontFamily: monospace,
    fontSize: 13,
  },
});
