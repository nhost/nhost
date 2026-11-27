import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize } from '@/theme';

export default function Footer() {
  return (
    <View style={styles.footer}>
      <Link href="https://docs.nhost.io" asChild>
        <Text role="link" aria-label="Docs" style={styles.link}>
          Docs ↗
        </Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  link: {
    color: colors.foreground,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
});
