import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

// Falls back to a dot rather than an empty disc: a display name can be an
// empty string, and an account made by magic link often starts that way.
const initialOf = (displayName: string): string =>
  displayName.trim().slice(0, 1).toUpperCase() || '·';

/** The account's initial in a disc `size` points across. */
export default function UserAvatar({
  displayName,
  size,
}: {
  displayName: string;
  size: number;
}) {
  return (
    <View
      aria-hidden
      style={[
        styles.disc,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.initial, { fontSize: Math.round(size * 0.4) }]}>
        {initialOf(displayName)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.muted,
  },
  initial: {
    color: colors.mutedForeground,
    fontWeight: '500',
  },
});
