import { StyleSheet, Text } from 'react-native';
import { colors } from '@/theme';

/** Marks the way the visitor last signed in on the sign-in list. */
export default function LastUsedBadge() {
  return <Text style={styles.badge}>Last used</Text>;
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -8,
    right: 8,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.primary,
    color: colors.primaryForeground,
    fontSize: 11,
    fontWeight: '600',
  },
});
