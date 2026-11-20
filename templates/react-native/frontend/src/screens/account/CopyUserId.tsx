import * as Clipboard from 'expo-clipboard';
import { Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useToast } from '@/components/Toast';
import { colors, monospace } from '@/theme';

/** The account's id as a chip that copies it. */
export default function CopyUserId({ id }: { id: string }) {
  const toast = useToast();

  const copy = async (): Promise<void> => {
    try {
      await Clipboard.setStringAsync(id);
      toast('User ID copied');
    } catch (err) {
      console.error('Error copying the user ID:', err);
      toast('Could not copy the user ID');
    }
  };

  return (
    <Pressable
      role="button"
      aria-label="Copy user ID"
      onPress={() => void copy()}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      <Text style={styles.text}>ID</Text>
      <Text
        style={[styles.text, styles.id]}
        numberOfLines={1}
        ellipsizeMode="middle"
      >
        {id}
      </Text>
      <Svg
        width={12}
        height={12}
        viewBox="0 0 24 24"
        fill="none"
        stroke={colors.mutedForeground}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Rect x={9} y={9} width={12} height={12} rx={2} />
        <Path d="M5 15V5a2 2 0 0 1 2-2h10" />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    height: 24,
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
  },
  pressed: {
    opacity: 0.8,
  },
  text: {
    color: colors.mutedForeground,
    fontSize: 11,
  },
  id: {
    flexShrink: 1,
    fontFamily: monospace,
  },
});
