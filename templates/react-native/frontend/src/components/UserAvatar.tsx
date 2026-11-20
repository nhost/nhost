import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import type { AvatarWidth } from '@/screens/account/avatar';
import { useAvatarSrc } from '@/screens/account/useAvatarSrc';
import { colors } from '@/theme';

// Falls back to a dot rather than an empty disc: a display name can be an
// empty string, and an account made by magic link often starts that way.
const initialOf = (displayName: string): string =>
  displayName.trim().slice(0, 1).toUpperCase() || '·';

/**
 * The account's picture over its initial, in a disc `size` points across, so
 * the initial shows wherever the picture does not paint. `width` is the pixel
 * width asked of storage.
 */
export default function UserAvatar({
  avatarUrl,
  displayName,
  width,
  size,
}: {
  avatarUrl: string | undefined;
  displayName: string;
  width: AvatarWidth;
  size: number;
}) {
  const source = useAvatarSrc(avatarUrl, width);

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
      {source ? (
        <Image
          testID="avatar-image"
          source={source}
          // A private avatar is kept off the disk, so it does not outlive the
          // session that could read it.
          cachePolicy={source.headers ? 'memory' : 'disk'}
          contentFit="cover"
          style={StyleSheet.absoluteFill}
        />
      ) : null}
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
